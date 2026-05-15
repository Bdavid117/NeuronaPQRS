from __future__ import annotations
from pae_api.agents.normalize import normalize_fields


def test_spoken_digits_in_cedula():
    result = normalize_fields({"numero_identificacion": "uno cero dos tres cuatro"})
    assert result["numero_identificacion"] == "10234"


def test_digits_with_dots_stripped():
    result = normalize_fields({"numero_identificacion": "1.023.456.789"})
    assert result["numero_identificacion"] == "1023456789"


def test_spoken_digits_in_codigo():
    result = normalize_fields({"codigo_estudiante": "dos cero dos tres cero ocho"})
    assert result["codigo_estudiante"] == "202308"


def test_email_arroba():
    result = normalize_fields({"correo_contacto": "carlos arroba universidad punto edu punto co"})
    assert result["correo_contacto"] == "carlos@universidad.edu.co"


def test_email_already_correct():
    result = normalize_fields({"correo_contacto": "carlos@uni.edu.co"})
    assert result["correo_contacto"] == "carlos@uni.edu.co"


def test_name_capitalized():
    result = normalize_fields({"nombre_solicitante": "carlos andrés pérez gómez"})
    assert result["nombre_solicitante"] == "Carlos Andrés Pérez Gómez"


def test_name_removes_filler():
    result = normalize_fields({"nombre_solicitante": "eh mi nombre es Laura"})
    assert result["nombre_solicitante"] == "Laura"


def test_non_string_value_passthrough():
    result = normalize_fields({"nombre_solicitante": None})
    assert result["nombre_solicitante"] is None


def test_unknown_field_unchanged():
    result = normalize_fields({"programa_academico": "Ingeniería de Sistemas"})
    assert result["programa_academico"] == "Ingeniería de Sistemas"


def test_telefono_spoken_digits():
    result = normalize_fields({"telefono_contacto": "tres uno cinco cero uno dos"})
    assert result["telefono_contacto"] == "315012"
