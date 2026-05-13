from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any

# Direct import of vault tools (same process) — faster than stdio MCP for agents
sys.path.insert(0, str(Path(__file__).parents[5] / "packages" / "mcp-obsidian" / "src"))

from mcp_obsidian import tools as _tools
from mcp_obsidian.vault import VAULT_ROOT as _VAULT_ROOT


def _set_vault_root() -> None:
    """Ensure vault module uses the correct path from Settings."""
    from ..config import get_settings
    import mcp_obsidian.vault as v_mod
    vault = Path(get_settings().vault_root).resolve()
    v_mod.VAULT_ROOT = vault
    os.environ["VAULT_ROOT"] = str(vault)


_set_vault_root()


def read_note(path: str) -> dict[str, Any]:
    return _tools.obsidian_read_note(path)


def write_note(path: str, content: str, frontmatter: dict | None = None, mode: str = "create") -> dict:
    return _tools.obsidian_write_note(path, content, frontmatter=frontmatter, mode=mode)


def search(query: str, tags: list[str] | None = None, folder: str | None = None, top_k: int = 8) -> list[dict]:
    return _tools.obsidian_search(query, tags=tags, folder=folder, top_k=top_k)


def list_by_tag(tag: str, folder: str | None = None) -> list[str]:
    return _tools.obsidian_list_by_tag(tag, folder=folder)


def update_frontmatter(path: str, partial: dict) -> dict:
    return _tools.obsidian_update_frontmatter(path, partial)


def create_case(case_id: str, metadata: dict, body: str) -> dict:
    return _tools.obsidian_create_case(case_id, metadata, body)


def link_notes(from_path: str, to_path: str, alias: str | None = None) -> dict:
    return _tools.obsidian_link(from_path, to_path, alias=alias)


def list_notes(folder: str | None = None) -> list[str]:
    return _tools.obsidian_list_notes(folder)
