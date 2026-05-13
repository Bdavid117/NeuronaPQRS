from __future__ import annotations

import os
import pytest
from pathlib import Path


@pytest.fixture(autouse=True)
def tmp_vault(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    """Redirect vault operations to a temp directory."""
    vault = tmp_path / "Neurona"
    for d in ["00-Inbox", "10-Catalogo-PQRS", "20-Casos", "30-Conocimiento", "40-Plantillas", "90-Sistema"]:
        (vault / d).mkdir(parents=True)

    monkeypatch.setenv("VAULT_ROOT", str(vault))
    monkeypatch.setenv("ALLOWED_WRITE_DIRS", "00-Inbox,10-Catalogo-PQRS,20-Casos,30-Conocimiento,40-Plantillas,90-Sistema")

    # Reload vault module so env vars take effect
    import importlib
    import mcp_obsidian.vault as v_mod
    v_mod.VAULT_ROOT = vault.resolve()
    v_mod.ALLOWED_WRITE_DIRS = ["00-Inbox", "10-Catalogo-PQRS", "20-Casos", "30-Conocimiento", "40-Plantillas", "90-Sistema"]

    yield vault


def test_write_and_read(tmp_vault: Path):
    from mcp_obsidian.tools import obsidian_write_note, obsidian_read_note
    obsidian_write_note("00-Inbox/test.md", "Hola mundo", frontmatter={"tags": ["prueba"]})
    result = obsidian_read_note("00-Inbox/test.md")
    assert result["body"].strip() == "Hola mundo"
    assert result["metadata"]["tags"] == ["prueba"]


def test_path_traversal_blocked(tmp_vault: Path):
    from mcp_obsidian.vault import write_note
    with pytest.raises(PermissionError):
        write_note("../outside.md", "malicious")


def test_obsidian_config_blocked(tmp_vault: Path):
    from mcp_obsidian.vault import write_note
    with pytest.raises(PermissionError):
        write_note(".obsidian/plugins/evil.json", "{}")


def test_not_in_allowed_dirs(tmp_vault: Path):
    from mcp_obsidian.vault import write_note
    with pytest.raises(PermissionError):
        write_note("secret_dir/note.md", "oops")


def test_update_frontmatter(tmp_vault: Path):
    from mcp_obsidian.tools import obsidian_write_note, obsidian_update_frontmatter, obsidian_read_note
    obsidian_write_note("00-Inbox/fm.md", "Contenido", frontmatter={"estado": "borrador", "prioridad": "baja"})
    obsidian_update_frontmatter("00-Inbox/fm.md", {"estado": "activo"})
    result = obsidian_read_note("00-Inbox/fm.md")
    assert result["metadata"]["estado"] == "activo"
    assert result["metadata"]["prioridad"] == "baja"  # unchanged


def test_create_case(tmp_vault: Path):
    from mcp_obsidian.tools import obsidian_create_case, obsidian_read_note
    result = obsidian_create_case(
        "PQRS-20260506-AABBCC",
        {"tipo": "reclamo", "categoria": "Reclamo-Nota", "area": "Academica", "urgencia": "media"},
        "El estudiante solicita revisión de calificación.",
    )
    assert result["status"] == "ok"
    note = obsidian_read_note("20-Casos/PQRS-20260506-AABBCC.md")
    assert note["metadata"]["radicado"] == "PQRS-20260506-AABBCC"
    assert "Reclamo-Nota" in note["raw"]


def test_create_case_duplicate(tmp_vault: Path):
    from mcp_obsidian.tools import obsidian_create_case
    obsidian_create_case("PQRS-DUP", {}, "Primera")
    with pytest.raises(FileExistsError):
        obsidian_create_case("PQRS-DUP", {}, "Segunda")


def test_search(tmp_vault: Path):
    from mcp_obsidian.tools import obsidian_write_note, obsidian_search
    obsidian_write_note("30-Conocimiento/reglamento.md", "El reglamento estudiantil contempla la revisión de notas en el capítulo 5.", frontmatter={"tags": ["normativa"]})
    results = obsidian_search("revisión de notas", folder="30-Conocimiento")
    assert len(results) > 0
    assert "reglamento" in results[0]["path"]


def test_append_mode(tmp_vault: Path):
    from mcp_obsidian.tools import obsidian_write_note, obsidian_read_note
    obsidian_write_note("00-Inbox/append_test.md", "Línea 1")
    obsidian_write_note("00-Inbox/append_test.md", "Línea 2", mode="append")
    result = obsidian_read_note("00-Inbox/append_test.md")
    assert "Línea 1" in result["raw"]
    assert "Línea 2" in result["raw"]
