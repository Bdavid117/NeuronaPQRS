from __future__ import annotations

import re

_DIGIT_WORDS: dict[str, str] = {
    "cero": "0", "uno": "1", "un": "1", "una": "1",
    "dos": "2", "tres": "3", "cuatro": "4", "cinco": "5",
    "seis": "6", "siete": "7", "ocho": "8", "nueve": "9",
}

_NUMERIC_FIELDS = frozenset({"numero_identificacion", "codigo_estudiante", "telefono_contacto"})
_EMAIL_FIELDS = frozenset({"correo_contacto", "correo_electronico"})
_NAME_FIELDS = frozenset({"nombre_solicitante"})

_FILLER_RE = re.compile(
    r"^\s*(?:eh+|mm+|o sea|pues|bueno|este|a ver|oiga|mire|mi nombre es|me llamo)\s+",
    re.IGNORECASE,
)


def _remove_fillers(s: str) -> str:
    prev = None
    while prev != s:
        prev = s
        s = _FILLER_RE.sub("", s).strip()
    return s


def _normalize_numeric(s: str) -> str:
    words = s.lower().split()
    if any(w in _DIGIT_WORDS for w in words):
        return "".join(_DIGIT_WORDS.get(w, "") for w in words if w in _DIGIT_WORDS or w.isdigit())
    return re.sub(r"[\s.\-]", "", s)


def _normalize_email(s: str) -> str:
    s = s.lower()
    s = re.sub(r"\s*arroba\s*", "@", s)
    s = re.sub(r"\s*punto\s*", ".", s)
    return re.sub(r"\s+", "", s)


def _capitalize_name(s: str) -> str:
    return " ".join(w.capitalize() for w in s.strip().split())


def normalize_fields(fields: dict[str, object]) -> dict[str, object]:
    """Normalize voice-transcribed field values before storing in collected_fields."""
    result: dict[str, object] = {}
    for key, value in fields.items():
        if not isinstance(value, str):
            result[key] = value
            continue
        v = _remove_fillers(value)
        if key in _NUMERIC_FIELDS:
            v = _normalize_numeric(v)
        elif key in _EMAIL_FIELDS:
            v = _normalize_email(v)
        elif key in _NAME_FIELDS:
            v = _capitalize_name(v)
        result[key] = v
    return result
