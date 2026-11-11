"""Retrieval: chunk sources, score chunks against a query (BM25-ish), and
assemble a bounded, citation-ready context for ctx.llm calls."""

from __future__ import annotations

import math
import re
from typing import Optional

from . import store

_CHUNK_SIZE = 1400
_CHUNK_OVERLAP = 160
_TOKEN_RE = re.compile(r"[a-z0-9][a-z0-9_\-']{1,}", re.IGNORECASE)
_STOP = {
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of",
    "with", "by", "is", "are", "was", "were", "be", "been", "it", "its", "this",
    "that", "these", "those", "as", "from", "not", "no", "do", "does", "did",
    "what", "which", "who", "whom", "how", "why", "when", "where", "can", "could",
    "should", "would", "will", "may", "might", "must", "i", "you", "he", "she",
    "we", "they", "me", "him", "her", "us", "them", "my", "your", "his", "our",
    "their", "about", "into", "over", "under", "between", "through", "during",
    "if", "then", "than", "so", "such", "there", "here", "all", "any", "each",
    "more", "most", "other", "some", "only", "own", "same", "very", "just",
}


def tokenize(text: str) -> list[str]:
    return [t.lower() for t in _TOKEN_RE.findall(text or "") if t.lower() not in _STOP]


def chunk_text(text: str, size: int = _CHUNK_SIZE, overlap: int = _CHUNK_OVERLAP) -> list[str]:
    """Paragraph-aware-ish chunks with character overlap."""
    text = (text or "").strip()
    if not text:
        return []
    if len(text) <= size:
        return [text]
    chunks: list[str] = []
    start = 0
    n = len(text)
    while start < n:
        end = min(start + size, n)
        if end < n:
            window = text[start:end]
            cut = max(window.rfind("\n\n"), window.rfind(". "), window.rfind("? "), window.rfind("! "))
            if cut > size * 0.6:
                end = start + cut + 1
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= n:
            break
        start = max(end - overlap, start + 1)
    return chunks


def _xml_attr(value) -> str:
    """Escape a value for a double-quoted XML attribute."""
    return (str(value or "")
            .replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            .replace('"', "&quot;"))


def _bm25_scores(query_terms: list[str], docs: list[list[str]]) -> list[float]:
    """Tiny BM25: one score per doc (each doc a token list)."""
    if not query_terms or not docs:
        return [0.0] * len(docs)
    n_docs = len(docs)
    df: dict[str, int] = {}
    for doc in docs:
        for term in set(doc):
            df[term] = df.get(term, 0) + 1
    avgdl = sum(len(d) for d in docs) / max(1, n_docs)
    k1, b = 1.5, 0.75
    scores = []
    for doc in docs:
        tf: dict[str, int] = {}
        for t in doc:
            tf[t] = tf.get(t, 0) + 1
        score = 0.0
        dl = len(doc) or 1
        for term in query_terms:
            if term not in tf:
                continue
            f = tf[term]
            idf = math.log(1 + (n_docs - df.get(term, 0) + 0.5) / (df.get(term, 0) + 0.5))
            score += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * dl / avgdl))
        scores.append(score)
    return scores


def source_numbers(notebook_id: str) -> dict:
    """S<n> assignment: a source's number is its 1-based position in
    ``store.list_sources`` — the rail order.

    One numbering for the page, the prompt, the stored citations, and every
    artifact. Disabled sources keep their number: an unchecked card leaves
    a gap in the sequence rather than renumbering everything after it, so
    ``[S3]`` in an old answer still means the same source.
    """
    return {s.get("id"): i for i, s in enumerate(store.list_sources(notebook_id), 1)}


def _emit_sources(pairs: list[tuple[dict, str]], final_num: dict[str, int],
                  context_parts: list[str], used: int, max_chars: int,
                  order: Optional[dict] = None,
                  head_chars: int = 1200) -> int:
    """Fallback path: emit the head of each source (no query signal)."""
    for rec, text in pairs:
        head = text[:head_chars].strip()
        if not head:
            continue
        if rec["id"] not in final_num:
            final_num[rec["id"]] = (
                order or {}).get(rec["id"], len(final_num) + 1)
        block = f"[S{final_num[rec['id']]} · {rec.get('title')} · {rec.get('kind')}]\n{head}"
        if used + len(block) > max_chars and context_parts:
            break
        context_parts.append(block)
        used += len(block)
    return used


def retrieve(notebook_id: str, query: str, *, max_chars: int = 28000,
             top_k: int = 24, only_ids: Optional[list[str]] = None) -> dict:
    """Score all chunks of all sources; return context + citation provenance.

    Returns {"context", "sources_used", "chunks_used", "total_chunks"}.
    Citation numbers [S1], [S2]… are the rail order — a source's position in
    ``store.list_sources`` — on every path, so the chip the answer marks is
    the card the user sees.
    """
    rail = source_numbers(notebook_id)
    sources = store.list_sources(notebook_id)
    pairs = store.all_source_texts(notebook_id)
    if only_ids:
        wanted = set(only_ids)
        pairs = [(r, t) for r, t in pairs if r.get("id") in wanted]
        sources = [s for s in sources if s.get("id") in wanted]
    else:
        # unchecked sources stay out of the context window unless the caller
        # names them explicitly
        off = store.disabled_sources(notebook_id)
        if off:
            pairs = [(r, t) for r, t in pairs if r.get("id") not in off]
            sources = [s for s in sources if s.get("id") not in off]
    empty = {"context": "", "sources_used": [], "chunks_used": 0, "total_chunks": 0}
    if not pairs:
        return empty

    chunk_docs: list[tuple[dict, str, list[str]]] = []
    for rec, text in pairs:
        for ch in chunk_text(text):
            chunk_docs.append((rec, ch, tokenize(ch)))
    if not chunk_docs:
        return empty

    # zero-loss path: when every active source fits the caller's context
    # budget, inject them whole inside <source> tags — BM25 top-k is for
    # corpora too big to fit, not for ones that fit
    total_chars = sum(len(t) for _, t in pairs)
    overhead = sum(len(str(r.get("title") or "")) + 140 for r, _ in pairs)
    if total_chars + overhead <= max_chars:
        parts = []
        for i, (rec, text) in enumerate(pairs):
            n = rail.get(rec.get("id"), i + 1)
            title = _xml_attr(rec.get("title"))
            kind = _xml_attr(rec.get("kind"))
            parts.append(
                f"[S{n} · {rec.get('title')} · {rec.get('kind')}]\n"
                f'<source id="S{n}" title="{title}" kind="{kind}">\n'
                f"{text}\n</source>")
        sources_used = [{
            "n": rail.get(rec.get("id"), i + 1), "id": rec["id"],
            "title": rec.get("title"),
            "kind": rec.get("kind"), "origin": rec.get("origin"),
            "labels": rec.get("labels", []),
            # whole-source citations highlight the head, same as the
            # chunked fallback
            "snippet": text[:400].strip(),
        } for i, (rec, text) in enumerate(pairs)]
        return {
            "context": "\n\n".join(parts),
            "sources_used": sources_used,
            "chunks_used": len(parts),
            "total_chunks": len(chunk_docs),
            "full_context": True,
        }

    scores = _bm25_scores(tokenize(query), [d[2] for d in chunk_docs])
    order = sorted(range(len(chunk_docs)), key=lambda i: scores[i], reverse=True)

    context_parts: list[str] = []
    final_num: dict[str, int] = {}
    best_chunk: dict[str, str] = {}
    used = 0

    if order and scores[order[0]] > 0:
        for i in order[:top_k]:
            rec, ch, _ = chunk_docs[i]
            if scores[i] <= 0:
                break  # remaining chunks have no query overlap
            sid = rec["id"]
            if sid not in final_num:
                final_num[sid] = rail.get(sid, len(final_num) + 1)
            if sid not in best_chunk:
                best_chunk[sid] = ch
            block = f"[S{final_num[sid]} · {rec.get('title')} · {rec.get('kind')}]\n{ch}"
            if used + len(block) > max_chars and context_parts:
                continue
            context_parts.append(block)
            used += len(block)
            if used >= max_chars:
                break

    if not context_parts:
        used = _emit_sources(pairs, final_num, context_parts, used, max_chars,
                             order=rail)

    by_id = {s["id"]: s for s in sources}
    inv = {v: k for k, v in final_num.items()}
    pair_text = {rec["id"]: text for rec, text in pairs}
    sources_used = []
    for n in sorted(final_num.values()):
        sid = inv[n]
        s = by_id.get(sid, {})
        sources_used.append({
            "n": n, "id": sid, "title": s.get("title"), "kind": s.get("kind"),
            "origin": s.get("origin"), "labels": s.get("labels", []),
            # the passage this citation was built from — the page highlights
            # it when the source opens; fallback path cites the head
            "snippet": (best_chunk.get(sid) or pair_text.get(sid, ""))[:400].strip(),
        })

    return {
        "context": "\n\n".join(context_parts),
        "sources_used": sources_used,
        "chunks_used": len(context_parts),
        "total_chunks": len(chunk_docs),
    }


def cited_sources(sources_used: list[dict], answer: str) -> list[dict]:
    """The citation rows an answer should show: only sources it actually marks
    as [S<n>]. Full-context retrieval puts EVERY active source in context, so
    without this filter every answer would chip every source. When the model
    emits no markers at all, keep the full set — unmarked answers keep the
    old behaviour rather than silently dropping provenance."""
    nums = {int(m) for m in re.findall(r"\[S(\d+)\]", answer or "")}
    if not nums:
        return list(sources_used)
    return [s for s in sources_used if s.get("n") in nums]


def search(notebook_id: str, query: str, *, top_k: int = 8,
           snippet_chars: int = 320) -> dict:
    """Full-text search across all sources → ranked hits with snippets.

    Returns {"query", "hits": [{source_id, title, kind, score, snippet,
    chunk_index}], "total_chunks"}. Deterministic — no LLM involved."""
    pairs = store.all_source_texts(notebook_id)
    if not pairs:
        return {"query": query, "hits": [], "total_chunks": 0}
    chunk_docs: list[tuple[dict, int, str, list[str]]] = []
    for rec, text in pairs:
        for ci, ch in enumerate(chunk_text(text)):
            chunk_docs.append((rec, ci, ch, tokenize(ch)))
    if not chunk_docs:
        return {"query": query, "hits": [], "total_chunks": 0}
    scores = _bm25_scores(tokenize(query), [d[3] for d in chunk_docs])
    order = sorted(range(len(chunk_docs)), key=lambda i: scores[i], reverse=True)
    hits = []
    for i in order[:top_k]:
        if scores[i] <= 0:
            break
        rec, ci, ch, _ = chunk_docs[i]
        hits.append({
            "source_id": rec.get("id"), "title": rec.get("title"),
            "kind": rec.get("kind"), "score": round(scores[i], 3),
            "chunk_index": ci, "snippet": ch[:snippet_chars].strip(),
        })
    return {"query": query, "hits": hits, "total_chunks": len(chunk_docs)}


def notebook_digest(notebook_id: str, *, max_chars: int = 42000,
                    cited: bool = False) -> str:
    """Broad-coverage digest for artifact/podcast prompts: head + tail slices of
    every source so generation sees the whole notebook, not just one query.

    ``cited=True`` tags each excerpt ``[S<n> · …]``; the uncited path labels
    them ``[Source <n>: …]``. Either way n is the source's position in
    ``store.list_sources`` — the same numbering the page assigns — so a
    disabled source leaves a gap instead of renumbering its neighbours."""
    pairs = store.all_source_texts(notebook_id)
    off = store.disabled_sources(notebook_id)
    if off:
        pairs = [(r, t) for r, t in pairs if r.get("id") not in off]
    if not pairs:
        return ""
    order = source_numbers(notebook_id)
    per_source = max(1500, max_chars // max(1, len(pairs)))
    parts = []
    for i, (rec, text) in enumerate(pairs, 1):
        n = order.get(rec.get("id"), i)
        labels = ", ".join(rec.get("labels") or [])
        if cited:
            header = f"[S{n} · {rec.get('title')} · {rec.get('kind')}"
            if rec.get("origin") and rec["kind"] in {"url", "youtube"}:
                header += f" — {rec['origin']}"
            header += "]"
        else:
            header = f"[Source {n}: {rec.get('title')} — {rec.get('kind')}"
            if rec.get("origin") and rec["kind"] in {"url", "youtube"}:
                header += f" — {rec['origin']}"
            header += f" — labels: {labels}]" if labels else "]"
        body = text[: per_source * 2 // 3]
        if len(text) > per_source:
            body += "\n\n[... middle omitted ...]\n\n" + text[-(per_source // 3):]
        parts.append(header + "\n" + body)
    return "\n\n".join(parts)[:max_chars]
