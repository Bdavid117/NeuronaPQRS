from __future__ import annotations

import json
import re


def extract_json(raw: str) -> dict:
    """Extract a JSON object from a model response.

    Handles three cases in order:
    1. Raw JSON string
    2. JSON wrapped in a markdown code block (```json ... ```)
    3. First {...} block found anywhere in the text
    """
    text = raw.strip()

    # Case 1: pure JSON
    try:
        return json.loads(text)
    except (json.JSONDecodeError, ValueError):
        pass

    # Case 2: markdown code block
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except (json.JSONDecodeError, ValueError):
            pass

    # Case 3: first {...} block in the text
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except (json.JSONDecodeError, ValueError):
            pass

    raise ValueError(f"No valid JSON found in response: {text[:120]!r}")
