from __future__ import annotations

import os
from pathlib import Path

_NEVER_WRITE = {".obsidian"}

VAULT_ROOT: Path = Path(os.environ.get("VAULT_ROOT", "Neurona")).resolve()
ALLOWED_WRITE_DIRS: list[str] = os.environ.get(
    "ALLOWED_WRITE_DIRS",
    "00-Inbox,10-Catalogo-PQRS,20-Casos,30-Conocimiento,40-Plantillas,50-Usuarios,90-Sistema",
).split(",")


def _safe_resolve(rel_path: str) -> Path:
    """Resolve a vault-relative path and guard against traversal."""
    resolved = (VAULT_ROOT / rel_path).resolve()
    if not str(resolved).startswith(str(VAULT_ROOT)):
        raise PermissionError(f"Path '{rel_path}' escapes vault root")
    first_segment = resolved.relative_to(VAULT_ROOT).parts[0] if resolved != VAULT_ROOT else ""
    if first_segment in _NEVER_WRITE:
        raise PermissionError(f"Writes to '{first_segment}/' are not allowed")
    return resolved


def _check_writable(rel_path: str) -> Path:
    resolved = _safe_resolve(rel_path)
    first = resolved.relative_to(VAULT_ROOT).parts[0]
    if ALLOWED_WRITE_DIRS and first not in ALLOWED_WRITE_DIRS:
        raise PermissionError(
            f"'{first}/' is not in ALLOWED_WRITE_DIRS. Allowed: {ALLOWED_WRITE_DIRS}"
        )
    return resolved


def read_note(rel_path: str) -> str:
    """Read a note and return its raw text. Raises FileNotFoundError if missing."""
    path = _safe_resolve(rel_path)
    if not path.exists():
        raise FileNotFoundError(f"Note not found: {rel_path}")
    return path.read_text(encoding="utf-8")


def write_note(rel_path: str, content: str, mode: str = "create") -> None:
    """
    Write content to a note.

    mode:
      "create"    — fails if file already exists
      "overwrite" — backup existing file then overwrite
      "append"    — append content to existing file
    """
    path = _check_writable(rel_path)
    path.parent.mkdir(parents=True, exist_ok=True)

    if mode == "create" and path.exists():
        raise FileExistsError(f"Note already exists: {rel_path}. Use mode='overwrite' or 'append'.")

    if mode == "overwrite" and path.exists():
        # mode="overwrite" writes without backup — git is the version history
        pass

    if mode == "append" and path.exists():
        existing = path.read_text(encoding="utf-8")
        content = existing + "\n" + content

    path.write_text(content, encoding="utf-8")


def list_notes(folder: str | None = None) -> list[str]:
    """List all .md files in the vault (or a subfolder), vault-relative."""
    base = _safe_resolve(folder) if folder else VAULT_ROOT
    return [
        str(p.relative_to(VAULT_ROOT))
        for p in sorted(base.rglob("*.md"))
        if ".obsidian" not in p.parts
    ]


def note_exists(rel_path: str) -> bool:
    try:
        return _safe_resolve(rel_path).exists()
    except PermissionError:
        return False
