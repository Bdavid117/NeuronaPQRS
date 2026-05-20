from __future__ import annotations

import json
from collections.abc import AsyncGenerator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from langchain_core.messages import HumanMessage
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select

from ..agents.graph import get_graph
from ..agents.state import PQRSState
from ..deps import get_db
from ..logging_config import get_logger
from ..models.pqrs import PQRSCase
from ..models.schemas import ChatRequest
from ..services.semantic_cache import get_cached_response, store_response

router = APIRouter(prefix="/chat", tags=["chat"])
log = get_logger("chat")


async def _sse_stream(request: ChatRequest, db: AsyncSession) -> AsyncGenerator[str, None]:
    """Run the LangGraph and emit SSE events."""
    graph = get_graph()
    log.info(f"▶ session={request.session_id[:8]}  msg={request.message[:80]!r}")

    # Load or create PQRS case state
    result = await db.exec(select(PQRSCase).where(PQRSCase.session_id == request.session_id))
    existing_case = result.first()

    init_state: PQRSState = {
        "messages": [HumanMessage(content=request.message)],
        "session_id": request.session_id,
        "pqrs_tipo": existing_case.tipo if existing_case else None,
        "categoria": existing_case.categoria if existing_case else None,
        "area": existing_case.area if existing_case else None,
        "urgencia": existing_case.urgencia if existing_case else "baja",
        "collected_fields": existing_case.collected_fields if existing_case else {},
        "pending_fields": [],
        "validation_errors": existing_case.validation_errors if existing_case else [],
        "attachment_ids": request.attachment_ids,
        "vision_results": [],
        "kb_citations": [],
        "draft_response": None,
        "confidence": 0.0,
        "next_agent": None,
        "radicado": existing_case.radicado if existing_case else None,
        "plazo_label": None,
        "plazo_respuesta": None,
        "requires_human": existing_case.requiere_revision_humana if existing_case else False,
        "agent_runs": [],
        "qr_code_b64": None,
        "case_url": None,
        "confirmed": existing_case.confirmed if existing_case else False,
        "awaiting_confirmation": existing_case.awaiting_confirmation if existing_case else False,
        "escalated": existing_case.estado == "escalado" if existing_case else False,
        "vault_note_path": existing_case.vault_note_path if existing_case else None,
    }

    def _event(name: str, data: object) -> str:
        payload = json.dumps({"event": name, "data": data}, ensure_ascii=False, default=str)
        return f"data: {payload}\n\n"

    # Improvement 1: Semantic cache fast-path.
    # Only attempt lookup when tipo AND categoria are already known from a
    # previous turn (i.e. the classifier has already run).
    if (
        existing_case
        and existing_case.tipo
        and existing_case.categoria
    ):
        cached = await get_cached_response(
            db,
            request.message,
            str(existing_case.tipo),
            existing_case.categoria,
        )
        if cached is not None:
            log.info(f"  💾 cache hit para session={request.session_id[:8]}")
            # Inject the cached draft so the graph skips the resolver
            init_state["draft_response"] = cached["draft_response"]
            init_state["kb_citations"] = cached["kb_citations"]
            init_state["confidence"] = cached["confidence"]

    final_state: dict = init_state
    try:
        async for updates in graph.astream(init_state, stream_mode="updates"):
            # updates = {node_name: state_delta, ...}
            # LangGraph may yield None for terminal state updates (e.g. after wait→END)
            if not updates:
                continue
            for node_name, delta in updates.items():
                if not delta:
                    continue
                log.info(f"  🤖 node={node_name}  keys={[k for k,v in delta.items() if v]}")

                # Emit agent_switch for trackable nodes. "finish" and "wait" have no
                # UI representation; "__start__" is LangGraph's internal init node.
                if node_name not in ("finish", "wait", "__start__"):
                    yield _event("agent_switch", {"agent": node_name})

                new_messages = delta.get("messages", [])
                for msg in new_messages:
                    # Skip HumanMessages — those are the user's own input echoed
                    # back by LangGraph's add_messages reducer, not agent responses.
                    if getattr(msg, "type", None) == "human":
                        continue
                    preview = str(msg.content)[:120].replace("\n", "↵")
                    log.debug(f"    💬 msg name={getattr(msg,'name','-')}  content={preview!r}")
                    if msg.content:
                        yield _event("delta", {"text": msg.content})

                if delta.get("radicado"):
                    log.info(f"  📋 radicado={delta['radicado']}  tipo={delta.get('pqrs_tipo')}  cat={delta.get('categoria')}")
                    yield _event("state", {
                        "radicado": delta["radicado"],
                        "tipo": delta.get("pqrs_tipo") or final_state.get("pqrs_tipo"),
                        "categoria": delta.get("categoria") or final_state.get("categoria"),
                        "area": delta.get("area") or final_state.get("area"),
                        "urgencia": delta.get("urgencia") or final_state.get("urgencia"),
                        "plazo": delta.get("plazo_label"),
                        "case_url": delta.get("case_url"),
                        "requires_human": bool(final_state.get("requires_human", False)),
                        "confidence": round(float(final_state.get("confidence", 0.0)), 2),
                    })

            # Merge delta into final_state for persistence
            for delta in updates.values():
                if delta:
                    final_state = {**final_state, **delta}
    except Exception as exc:
        log.error(f"  ❌ graph error: {exc}", exc_info=True)
        yield _event("error", {"message": str(exc)})
        return

    log.info(f"✔ session={request.session_id[:8]}  radicado={final_state.get('radicado')}  confidence={final_state.get('confidence')}")

    # Improvement 1: Store the resolver response in the semantic cache for
    # future identical queries (only when tipo and categoria are known).
    final_tipo = final_state.get("pqrs_tipo")
    final_draft = final_state.get("draft_response")
    if final_tipo and final_draft:
        try:
            await store_response(
                db,
                request.message,
                str(final_tipo),
                final_state.get("categoria"),
                final_draft,
                final_state.get("kb_citations", []),
            )
        except Exception:
            pass  # non-critical — cache write failure must not break the response

    await _persist_state(db, request.session_id, final_state)

    yield _event("done", {"session_id": request.session_id})


async def _persist_state(db: AsyncSession, session_id: str, state: dict) -> None:
    from datetime import datetime
    from ..models.pqrs import AgentRun, Message

    try:
        result = await db.exec(select(PQRSCase).where(PQRSCase.session_id == session_id))
        case = result.first()

        if case is None:
            case = PQRSCase(session_id=session_id)
            db.add(case)

        if state.get("pqrs_tipo"):
            case.tipo = str(state["pqrs_tipo"]).lower()
        if state.get("categoria"):
            case.categoria = state["categoria"]
        if state.get("area"):
            case.area = state["area"]
        if state.get("urgencia"):
            case.urgencia = str(state["urgencia"]).lower()
        if state.get("collected_fields"):
            existing_fields = case.collected_fields or {}
            case.collected_fields = {**existing_fields, **state["collected_fields"]}
        if state.get("validation_errors") is not None:
            case.validation_errors = state["validation_errors"]
        if state.get("radicado"):
            case.radicado = state["radicado"]
        if state.get("plazo_respuesta"):
            from datetime import date as _date
            try:
                case.plazo_respuesta = _date.fromisoformat(state["plazo_respuesta"])
            except (ValueError, TypeError):
                pass
        if state.get("requires_human"):
            case.requiere_revision_humana = True
        if state.get("escalated"):
            from ..models.pqrs import PQRSEstado
            case.estado = PQRSEstado.ESCALADO.value
        if state.get("vault_note_path"):
            case.vault_note_path = state["vault_note_path"]

        case.confirmed = bool(state.get("confirmed", False))
        case.awaiting_confirmation = bool(state.get("awaiting_confirmation", False))
        case.turn_count = (case.turn_count or 0) + 1
        case.updated_at = datetime.utcnow()

        # flush assigns case.id from DB sequence without committing
        # — required for FK inserts on Message and AgentRun below
        await db.flush()

        # B3: persist current turn's messages (state["messages"] is always only this turn)
        for msg in state.get("messages", []):
            role = getattr(msg, "type", "unknown")
            if role == "human":
                role = "user"
            elif role == "ai":
                role = "assistant"
            content = str(msg.content) if msg.content else ""
            agent_name = getattr(msg, "name", None)
            db.add(Message(
                case_id=case.id,
                role=role,
                content=content,
                agent_name=agent_name,
            ))

        # B4: persist agent telemetry runs
        for run in state.get("agent_runs", []):
            db.add(AgentRun(
                case_id=case.id,
                agent_name=run.get("agent_name", "unknown"),
                model=run.get("model", "unknown"),
                tokens_in=run.get("tokens_in", 0),
                tokens_out=run.get("tokens_out", 0),
                cost_usd=run.get("cost_usd", 0.0),
                duration_ms=run.get("duration_ms", 0),
            ))

        # single atomic commit covers case, messages, and agent_runs
        await db.commit()

    except Exception:
        await db.rollback()
        log.error("_persist_state: transaction rolled back", exc_info=True)
        raise


@router.post("")
async def chat_endpoint(body: ChatRequest, db: AsyncSession = Depends(get_db)) -> StreamingResponse:
    return StreamingResponse(
        _sse_stream(body, db),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
