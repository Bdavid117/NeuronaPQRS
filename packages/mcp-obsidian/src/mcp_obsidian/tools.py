from __future__ import annotations

import json
from datetime import date
from typing import Any

from . import frontmatter as fm_util
from .search import search as _search
from .vault import list_notes, note_exists, read_note, write_note


def obsidian_read_note(path: str) -> dict[str, Any]:
    """Read a note by vault-relative path. Returns metadata and body."""
    raw = read_note(path)
    meta, body = fm_util.parse(raw)
    return {"path": path, "metadata": meta, "body": body, "raw": raw}


def obsidian_write_note(
    path: str,
    content: str,
    frontmatter: dict[str, Any] | None = None,
    mode: str = "create",
) -> dict[str, str]:
    """Write a note. mode: 'create' | 'overwrite' | 'append'."""
    if frontmatter:
        full_content = fm_util.dump(frontmatter, content)
    else:
        full_content = content
    write_note(path, full_content, mode=mode)
    return {"status": "ok", "path": path, "mode": mode}


def obsidian_search(
    query: str,
    tags: list[str] | None = None,
    folder: str | None = None,
    top_k: int = 8,
) -> list[dict[str, Any]]:
    """BM25 search across the vault. Returns ranked list of {path, score, excerpt, tags}."""
    results = _search(query, tags=tags, folder=folder, top_k=top_k)
    return [{"path": r.path, "score": r.score, "excerpt": r.excerpt, "tags": r.tags} for r in results]


def obsidian_list_by_tag(tag: str, folder: str | None = None) -> list[str]:
    """Return vault-relative paths of notes that carry the given tag."""
    results = _search("", tags=[tag], folder=folder, top_k=200)
    return [r.path for r in results]


def obsidian_update_frontmatter(path: str, partial: dict[str, Any]) -> dict[str, Any]:
    """Merge `partial` into the frontmatter of an existing note (non-destructive)."""
    raw = read_note(path)
    meta, body = fm_util.parse(raw)
    new_meta = fm_util.merge_frontmatter(meta, partial)
    write_note(path, fm_util.dump(new_meta, body), mode="overwrite")
    return {"status": "ok", "path": path, "updated_keys": list(partial.keys())}


def obsidian_create_case(
    case_id: str,
    metadata: dict[str, Any],
    body: str,
) -> dict[str, str]:
    """
    Create a PQRS case note at 20-Casos/{case_id}.md.
    Automatically adds wikilinks to the category and knowledge notes.
    """
    rel_path = f"20-Casos/{case_id}.md"
    if note_exists(rel_path):
        raise FileExistsError(f"Case note already exists: {rel_path}")

    base_meta: dict[str, Any] = {
        "radicado": case_id,
        "creado": date.today().isoformat(),
        "estado": "abierto",
        **metadata,
    }

    cat = metadata.get("categoria", "")
    area = metadata.get("area", "")
    links_section = ""
    if cat:
        links_section += f"\n## Categoría\n[[10-Catalogo-PQRS/{cat}]]\n"
    if area:
        links_section += f"\n## Área responsable\n[[30-Conocimiento/{area}]]\n"

    full_body = body + links_section
    full_content = fm_util.dump(base_meta, full_body)
    write_note(rel_path, full_content, mode="create")
    return {"status": "ok", "path": rel_path, "case_id": case_id}


def obsidian_link(from_path: str, to_path: str, alias: str | None = None) -> dict[str, str]:
    """Append a wikilink to `from_path` pointing at `to_path`."""
    raw = read_note(from_path)
    link = f"[[{to_path}|{alias}]]" if alias else f"[[{to_path}]]"
    write_note(from_path, raw + f"\n{link}", mode="overwrite")
    return {"status": "ok", "from": from_path, "to": to_path}


def obsidian_list_notes(folder: str | None = None) -> list[str]:
    """List all note paths in the vault (or a subfolder)."""
    return list_notes(folder)
