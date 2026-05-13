from __future__ import annotations

import re
from typing import Any

import frontmatter as fm


def parse(text: str) -> tuple[dict[str, Any], str]:
    """Return (metadata_dict, body_text) for a markdown string."""
    post = fm.loads(text)
    return dict(post.metadata), post.content


def dump(metadata: dict[str, Any], body: str) -> str:
    """Serialize metadata + body back to markdown with YAML frontmatter."""
    post = fm.Post(body, **metadata)
    return fm.dumps(post)


def merge_frontmatter(existing: dict[str, Any], partial: dict[str, Any]) -> dict[str, Any]:
    """Non-destructive merge: partial values override existing ones."""
    merged = dict(existing)
    merged.update({k: v for k, v in partial.items() if v is not None})
    return merged


def extract_wikilinks(text: str) -> list[str]:
    """Return a list of wikilink targets from [[Target]] or [[Target|alias]]."""
    return re.findall(r"\[\[([^\|\]]+)(?:\|[^\]]+)?\]\]", text)
