from __future__ import annotations

import json
import sys
from typing import Any

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, Tool

from .tools import (
    obsidian_create_case,
    obsidian_link,
    obsidian_list_by_tag,
    obsidian_list_notes,
    obsidian_read_note,
    obsidian_search,
    obsidian_update_frontmatter,
    obsidian_write_note,
)

app = Server("mcp-obsidian")

_TOOLS: list[Tool] = [
    Tool(
        name="obsidian_read_note",
        description="Lee una nota del vault Obsidian por ruta relativa. Devuelve frontmatter y cuerpo.",
        inputSchema={
            "type": "object",
            "properties": {"path": {"type": "string", "description": "Ruta relativa desde la raíz del vault (e.g. '30-Conocimiento/Reglamento.md')"}},
            "required": ["path"],
        },
    ),
    Tool(
        name="obsidian_write_note",
        description="Escribe o actualiza una nota en el vault. mode: 'create'|'overwrite'|'append'.",
        inputSchema={
            "type": "object",
            "properties": {
                "path": {"type": "string"},
                "content": {"type": "string"},
                "frontmatter": {"type": "object", "description": "Metadatos YAML opcionales"},
                "mode": {"type": "string", "enum": ["create", "overwrite", "append"], "default": "create"},
            },
            "required": ["path", "content"],
        },
    ),
    Tool(
        name="obsidian_search",
        description="Busca notas en el vault usando BM25. Devuelve lista ranked de {path, score, excerpt, tags}.",
        inputSchema={
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "tags": {"type": "array", "items": {"type": "string"}, "description": "Filtrar por etiquetas"},
                "folder": {"type": "string", "description": "Restringir a una subcarpeta del vault"},
                "top_k": {"type": "integer", "default": 8},
            },
            "required": ["query"],
        },
    ),
    Tool(
        name="obsidian_list_by_tag",
        description="Lista rutas de notas que tienen la etiqueta indicada.",
        inputSchema={
            "type": "object",
            "properties": {
                "tag": {"type": "string"},
                "folder": {"type": "string"},
            },
            "required": ["tag"],
        },
    ),
    Tool(
        name="obsidian_update_frontmatter",
        description="Fusiona claves en el frontmatter de una nota existente (no destructivo).",
        inputSchema={
            "type": "object",
            "properties": {
                "path": {"type": "string"},
                "partial": {"type": "object", "description": "Claves a actualizar/agregar"},
            },
            "required": ["path", "partial"],
        },
    ),
    Tool(
        name="obsidian_create_case",
        description="Crea la nota de un caso PQRS en 20-Casos/{case_id}.md con frontmatter y wikilinks automáticos.",
        inputSchema={
            "type": "object",
            "properties": {
                "case_id": {"type": "string", "description": "Radicado, e.g. PQRS-20260506-A1B2C3"},
                "metadata": {
                    "type": "object",
                    "description": "tipo, categoria, area, urgencia, plazo_respuesta, etc.",
                },
                "body": {"type": "string", "description": "Descripción del caso (markdown)"},
            },
            "required": ["case_id", "metadata", "body"],
        },
    ),
    Tool(
        name="obsidian_link",
        description="Agrega un wikilink en una nota apuntando a otra.",
        inputSchema={
            "type": "object",
            "properties": {
                "from_path": {"type": "string"},
                "to_path": {"type": "string"},
                "alias": {"type": "string"},
            },
            "required": ["from_path", "to_path"],
        },
    ),
    Tool(
        name="obsidian_list_notes",
        description="Lista todas las rutas de notas en el vault o en una subcarpeta.",
        inputSchema={
            "type": "object",
            "properties": {"folder": {"type": "string"}},
        },
    ),
]

_DISPATCH: dict[str, Any] = {
    "obsidian_read_note": obsidian_read_note,
    "obsidian_write_note": obsidian_write_note,
    "obsidian_search": obsidian_search,
    "obsidian_list_by_tag": obsidian_list_by_tag,
    "obsidian_update_frontmatter": obsidian_update_frontmatter,
    "obsidian_create_case": obsidian_create_case,
    "obsidian_link": obsidian_link,
    "obsidian_list_notes": obsidian_list_notes,
}


@app.list_tools()
async def list_tools() -> list[Tool]:
    return _TOOLS


@app.call_tool()
async def call_tool(name: str, arguments: dict[str, Any]) -> list[TextContent]:
    if name not in _DISPATCH:
        raise ValueError(f"Unknown tool: {name}")
    try:
        result = _DISPATCH[name](**arguments)
        return [TextContent(type="text", text=json.dumps(result, ensure_ascii=False, default=str))]
    except (FileNotFoundError, FileExistsError, PermissionError) as exc:
        return [TextContent(type="text", text=json.dumps({"error": str(exc)}))]


def main() -> None:
    import asyncio
    asyncio.run(_run())


async def _run() -> None:
    async with stdio_server() as (reader, writer):
        await app.run(reader, writer, app.create_initialization_options())
