from __future__ import annotations

import re
from dataclasses import dataclass

from rank_bm25 import BM25Okapi

from .vault import VAULT_ROOT, list_notes, read_note


@dataclass
class SearchResult:
    path: str
    score: float
    excerpt: str
    tags: list[str]


def _tokenize(text: str) -> list[str]:
    return re.findall(r"[a-záéíóúüñA-ZÁÉÍÓÚÜÑ0-9]+", text.lower())


def _extract_tags(text: str) -> list[str]:
    return re.findall(r"(?<!\[)#([a-záéíóúüñA-ZÁÉÍÓÚÜÑ0-9_/-]+)", text)


def _extract_frontmatter_tags(text: str) -> list[str]:
    match = re.search(r"^---\n(.*?)\n---", text, re.DOTALL)
    if not match:
        return []
    tags: list[str] = []
    block = match.group(1)
    for line in block.splitlines():
        if re.match(r"^\s*tags\s*:", line):
            inline = re.findall(r"#?([a-zA-Z0-9_/-]+)", line.split(":", 1)[1])
            tags.extend(inline)
        elif tags:
            item = re.match(r"^\s*-\s+(.+)", line)
            if item:
                tags.append(item.group(1).strip())
            else:
                break
    return tags


def search(query: str, tags: list[str] | None = None, folder: str | None = None, top_k: int = 8) -> list[SearchResult]:
    """BM25 search over vault notes with optional tag + folder filter."""
    paths = list_notes(folder)
    if not paths:
        return []

    docs: list[str] = []
    all_tags: list[list[str]] = []
    for p in paths:
        try:
            text = read_note(p)
        except Exception:
            text = ""
        docs.append(text)
        all_tags.append(_extract_frontmatter_tags(text) + _extract_tags(text))

    tokenized = [_tokenize(d) for d in docs]
    bm25 = BM25Okapi(tokenized)
    scores = bm25.get_scores(_tokenize(query))

    # BM25 can produce negative scores for small corpora; include any doc that
    # passes tag filter and has score above the minimum score in the corpus.
    min_score = min(scores) if len(scores) > 0 else 0.0
    threshold = min_score - 1e-9

    results: list[SearchResult] = []
    for i, (path, score) in enumerate(zip(paths, scores)):
        if tags:
            note_tags = {t.lower() for t in all_tags[i]}
            if not any(t.lower() in note_tags for t in tags):
                continue
        if score <= threshold:
            continue
        body = docs[i]
        lines = [l for l in body.splitlines() if l.strip() and not l.startswith("---")]
        excerpt = " ".join(lines[:3])[:300]
        results.append(SearchResult(path=path, score=float(score), excerpt=excerpt, tags=all_tags[i]))

    results.sort(key=lambda r: r.score, reverse=True)
    return results[:top_k]
