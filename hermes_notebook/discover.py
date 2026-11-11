"""Discovery that knows what the notebook already has.

NotebookLM's Discover is a search box bolted to Google. This is a research
scout, and it is better for one specific reason: it can see the notebook.

    plan   → the model turns the notebook's *gaps* into 2-4 precise queries
    fanout → every query runs through the host's web search (plus Exa or Tavily
             when their key is configured); results are merged
    rank   → canonical-URL dedupe, per-domain cap, score by topical overlap and
             gap coverage, so six results are six sources, not one blog
    explain→ one honest line per candidate: which gap it closes, or which term
             it matched, or that it just broadens the domain mix

Nothing here is added to the notebook automatically: the page shows candidates
and the person picks (POST /sources does the ingest).
"""
from __future__ import annotations

import json
import os
import re
import urllib.parse
import urllib.request
from typing import Any, Dict, Iterable, List, Optional

from . import llmio, retrieve, runtime, store

#: Tracking params that make two links to the same page look different.
_JUNK_PARAMS = {
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    "utm_id", "ref", "ref_src", "fbclid", "gclid", "mc_cid", "mc_eid",
    "igshid", "spm", "yclid", "msclkid",
}

#: Sites that are almost never a good source for a notebook.
_NOISE_HOSTS = {
    "pinterest.com", "quora.com", "facebook.com", "instagram.com",
    "tiktok.com", "x.com", "twitter.com", "linkedin.com",
}

_STOP = set("""
a an and are as at be by for from has have how in into is it its of on or that
the their they this to was were what when where which who why will with you your
""".split())


# --------------------------------------------------------------------- urls

def canonical_url(url: str) -> str:
    """The same page reached by different links gets one key."""
    raw = (url or "").strip()
    if not raw:
        return ""
    try:
        parts = urllib.parse.urlsplit(raw)
    except ValueError:
        return raw
    host = (parts.hostname or "").lower().removeprefix("www.")
    path = re.sub(r"/+$", "", parts.path or "")
    keep = []
    for key, value in urllib.parse.parse_qsl(parts.query, keep_blank_values=False):
        if key.lower() not in _JUNK_PARAMS:
            keep.append((key, value))
    query = urllib.parse.urlencode(sorted(keep))
    scheme = "https" if parts.scheme in ("http", "https", "") else parts.scheme
    return urllib.parse.urlunsplit((scheme, host, path, query, ""))


def domain_of(url: str) -> str:
    try:
        return (urllib.parse.urlsplit(url).hostname or "").lower().removeprefix("www.")
    except ValueError:
        return ""


def _terms(text: str) -> List[str]:
    out = []
    for tok in re.findall(r"[a-zA-Z][a-zA-Z0-9\-]{2,}", (text or "").lower()):
        if tok in _STOP:
            continue
        out.append(tok)
    return out


# ------------------------------------------------------------------ ranking

def rank_candidates(rows: Iterable[Dict[str, Any]], *, existing: Iterable[str] = (),
                    focus_terms: Iterable[str] = (), per_domain: int = 2,
                    limit: int = 12) -> List[Dict[str, Any]]:
    """Dedupe, diversify, score. Pure — takes the raw search rows and returns
    the page's candidate rows, best first."""
    seen_urls = {canonical_url(u) for u in existing if u}
    focus = [t.lower() for t in focus_terms]
    focus_set = set(focus)
    per_host: Dict[str, int] = {}
    scored: List[Dict[str, Any]] = []
    seen_here = set()

    for row in rows:
        if not isinstance(row, dict):
            continue
        raw_url = str(row.get("url") or row.get("link") or "").strip()
        canon = canonical_url(raw_url)
        host = domain_of(raw_url)
        if not canon or not host or canon in seen_urls or canon in seen_here:
            continue
        if host in _NOISE_HOSTS or any(host.endswith("." + n) for n in _NOISE_HOSTS):
            continue
        if per_host.get(host, 0) >= per_domain:
            continue
        title = str(row.get("title") or raw_url)[:200]
        snippet = re.sub(r"\s+", " ", str(row.get("description") or row.get("snippet") or ""))[:400]
        words = _terms(title + " " + snippet)
        word_set = set(words)

        # topical overlap: how much of the candidate is about the notebook at all
        overlap = len(word_set & focus_set) / max(1, len(word_set)) if focus_set else 0.0
        # a title hit is worth more than a body hit
        title_hits = [t for t in _terms(title) if t in focus_set]

        why = ""
        if title_hits:
            why = "matches " + ", ".join(list(dict.fromkeys(title_hits))[:3])
        elif word_set & focus_set:
            why = "mentions " + ", ".join(list(dict.fromkeys(w for w in words if w in focus_set))[:3])
        elif per_host.get(host, 0) == 0:
            why = "broadens the reading list with a new domain"

        diversity = 0.15 if per_host.get(host, 0) == 0 else 0.0
        score = round(min(1.0, 0.75 * overlap + 0.25 * (1.0 if title_hits else 0.0) + diversity), 3)
        per_host[host] = per_host.get(host, 0) + 1
        seen_here.add(canon)
        scored.append({
            "title": title,
            "url": raw_url,
            "canonical": canon,
            "domain": host,
            "snippet": snippet,
            "why": why,
            "score": score,
            "tags": list(dict.fromkeys([t for t in words if t in focus_set]))[:4],
            "provider": str(row.get("provider") or "web"),
            "round": int(row.get("round") or 1),
        })

    scored.sort(key=lambda r: (-r["score"], r["domain"]))
    return scored[:limit]


# ---------------------------------------------------------------- providers

def _parse_web_payload(raw: Any) -> List[Dict[str, Any]]:
    try:
        data = json.loads(raw) if isinstance(raw, str) else raw
    except (ValueError, TypeError):
        return []
    if not isinstance(data, dict) or data.get("success") is False:
        return []
    inner = data.get("data") if isinstance(data.get("data"), dict) else data
    rows = inner.get("web") or inner.get("results") or []
    return [r for r in rows if isinstance(r, dict)] if isinstance(rows, list) else []


class _WebSearchUnavailable(RuntimeError):
    """The host answered 'Unknown tool: web_search' — the builtin is not
    registered on this surface (a plugin CLI subcommand can run before the
    agent loop imports model_tools)."""


def search_web(query: str, limit: int = 6) -> List[Dict[str, Any]]:
    """The host's own search backend — works with no extra key."""
    raw = runtime.dispatch("web_search", {"query": query, "limit": limit})
    if runtime.unknown_tool(raw, "web_search"):
        raise _WebSearchUnavailable("the host's web_search tool is not registered in this session")
    return _parse_web_payload(raw)


def _http_json(url: str, payload: Dict[str, Any], headers: Dict[str, str]) -> Any:
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers={
        "content-type": "application/json", **headers})
    with urllib.request.urlopen(req, timeout=25) as resp:  # noqa: S310 - fixed hosts
        return json.loads(resp.read().decode("utf-8"))


def search_exa(query: str, limit: int = 6) -> List[Dict[str, Any]]:
    """Exa: neural search with page contents. Needs EXA_API_KEY."""
    key = os.environ.get("EXA_API_KEY", "").strip()
    if not key:
        return []
    try:
        out = _http_json("https://api.exa.ai/search",
                         {"query": query, "numResults": limit, "type": "auto",
                          "contents": {"text": {"maxCharacters": 600}}},
                         {"x-api-key": key})
    except Exception:
        return []
    rows = []
    for r in ((out or {}).get("results") or []):
        if isinstance(r, dict):
            rows.append({"title": r.get("title"), "url": r.get("url"),
                         "description": (r.get("text") or "")[:400],
                         "provider": "exa"})
    return rows


def search_tavily(query: str, limit: int = 6) -> List[Dict[str, Any]]:
    """Tavily: agent-oriented search. Needs TAVILY_API_KEY."""
    key = os.environ.get("TAVILY_API_KEY", "").strip()
    if not key:
        return []
    try:
        out = _http_json("https://api.tavily.com/search",
                         {"query": query, "max_results": limit,
                          "search_depth": "advanced", "include_raw_content": False},
                         {"authorization": f"Bearer {key}"})
    except Exception:
        return []
    rows = []
    for r in ((out or {}).get("results") or []):
        if isinstance(r, dict):
            rows.append({"title": r.get("title"), "url": r.get("url"),
                         "description": r.get("content") or "",
                         "provider": "tavily"})
    return rows


def providers() -> List[str]:
    out = ["web"]
    if os.environ.get("EXA_API_KEY", "").strip():
        out.append("exa")
    if os.environ.get("TAVILY_API_KEY", "").strip():
        out.append("tavily")
    return out


def search_all(queries: List[str], per_query: int = 6,
               state: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    """Fan the queries out across every configured provider.

    `state` is the caller's own bag: when the host lacks web_search the call
    records `state["web_unavailable"] = True` on it, so concurrent discovers
    cannot read each other's flag the way a module global let them.
    """
    rows: List[Dict[str, Any]] = []
    for q in queries:
        for fn in (search_web, search_exa, search_tavily):
            try:
                rows.extend(fn(q, per_query))
            except _WebSearchUnavailable:
                if state is not None:
                    state["web_unavailable"] = True
            except Exception:
                continue
    return rows


# ------------------------------------------------------------------ planning

_PLAN_SCHEMA = {
    "type": "object",
    "properties": {
        "gaps": {"type": "array", "items": {"type": "string"},
                 "description": "2-4 things this notebook does not cover yet, each <= 10 words"},
        "queries": {"type": "array", "items": {"type": "string"},
                    "description": "2-4 web search queries that would close those gaps"},
    },
    "required": ["gaps", "queries"],
}


def plan_queries(meta: Dict[str, Any], src_lines: str, focus: str = "") -> Dict[str, List[str]]:
    """Ask the model what is missing and how to go looking for it."""
    focus_line = f"\nThe user asked for sources about: {focus}\n" if focus.strip() else ""
    parsed = llmio.structured(
        instructions=("You are a research librarian. Given a notebook and the list of "
                      "sources it already has, name the gaps a careful reader would want "
                      "filled and write web search queries that would find material to fill them."),
        input=[{"type": "text", "text":
                f"Notebook: {meta.get('title')}\nDescription: {meta.get('description', '')}\n"
                f"Sources already in the notebook:\n{src_lines}\n{focus_line}\n"
                "Return 2-4 gaps and 2-4 queries. Queries must be specific enough to "
                "exclude material the notebook already covers."}],
        json_schema=_PLAN_SCHEMA,
        schema_name="notebook.discover_plan",
        system_prompt="Output only the JSON. No commentary.",
        purpose="hermes-notebook.discover.plan",
        max_tokens=1200, temperature=0.4, timeout=120.0,
    )
    if not parsed:
        return {"gaps": [], "queries": []}
    gaps = [str(g).strip() for g in (parsed.get("gaps") or []) if str(g).strip()][:4]
    queries = [str(q).strip() for q in (parsed.get("queries") or []) if str(q).strip()][:4]
    return {"gaps": gaps, "queries": queries}


def can_read_rounds() -> int:
    """How many research rounds this build is willing to run: 2 unless the
    person asked for a deeper pass (capped at 3 so a click cannot spend an
    unbounded amount of search quota)."""
    try:
        return max(1, min(3, int(runtime.config("discover_rounds", 2) or 2)))
    except Exception:
        return 2


_REFINE_SCHEMA = {
    "type": "object",
    "properties": {
        "queries": {"type": "array", "items": {"type": "string"},
                    "description": "2-4 NEW web search queries that go deeper than the first pass"},
        "still_missing": {"type": "array", "items": {"type": "string"},
                          "description": "what the first pass failed to find, <= 10 words each"},
    },
    "required": ["queries"],
}


def refine_queries(meta: Dict[str, Any], focus: str, found: List[Dict[str, Any]],
                   gaps: List[str], tried: List[str], round_no: int) -> List[str]:
    """Second-pass planning, the half NotebookLM's Deep Research has and a
    one-shot search does not: read what the first pass *did* return, name what
    it missed, and write different queries — other vocabulary, primary sources,
    data, the counter-argument — instead of re-asking the same words."""
    titles = "\n".join(
        f"- {c.get('title')} ({c.get('domain')}) — {c.get('snippet', '')[:140]}"
        for c in found[:10]) or "(nothing usable came back)"
    tried_lines = "\n".join(f"- {q}" for q in tried[:8]) or "(none)"
    gap_lines = "\n".join(f"- {g}" for g in gaps[:6]) or "(none named)"
    parsed = llmio.structured(
        instructions=("You are a research strategist running the second round of a "
                      "deep-research pass. The first round's queries and results are "
                      "below. Write 2-4 NEW queries that reach material the first "
                      "round could not: different terminology, primary sources, "
                      "datasets, expert or dissenting views. Never repeat a query "
                      "already tried, and do not just reword one."),
        input=[{"type": "text", "text":
                f"Notebook: {meta.get('title')}\nResearch focus: {focus or meta.get('description', '')}\n"
                f"Gaps still open:\n{gap_lines}\n\nQueries already tried:\n{tried_lines}\n\n"
                f"Round {round_no - 1} results:\n{titles}\n\n"
                "Return only new queries."}],
        json_schema=_REFINE_SCHEMA,
        schema_name="notebook.discover_refine",
        system_prompt="Output only the JSON. No commentary.",
        purpose="hermes-notebook.discover.refine",
        max_tokens=900, temperature=0.6, timeout=120.0,
    )
    if not parsed:
        return []
    seen = {q.strip().lower() for q in tried}
    out = []
    for q in (parsed.get("queries") or []):
        q = str(q).strip()
        if q and q.lower() not in seen:
            out.append(q)
    return out[:4]


# ------------------------------------------------------------------- public

def discover(notebook: str, *, query: str = "", max_results: int = 12,
             per_domain: int = 2, plan: bool = True, deep: bool = False,
             rounds: Optional[int] = None) -> Dict[str, Any]:
    """One discovery pass — or a deep-research pass when `deep` is set.

    Round 1 is the plan/fanout/rank pass. In deep mode each further round reads
    what round 1 returned, asks the model for genuinely different queries, and
    merges the new rows into the same ranked list. Nothing is added to the
    notebook either way: the page shows candidates and the person picks.
    """
    search_state: Dict[str, Any] = {}
    nb_id = store.resolve_notebook(notebook)
    meta = store.get_meta(nb_id)
    sources = store.list_sources(nb_id)
    existing = [str(s.get("origin") or "") for s in sources if s.get("origin")]

    base_query = (query or "").strip()
    focus_text = base_query or f"{meta.get('title', '')} {meta.get('description', '')}"
    focus_terms = _terms(focus_text)[:12]

    plan_info = {"gaps": [], "queries": []}
    if plan:
        try:
            src_lines = "\n".join(f"- {s.get('title')} ({s.get('kind')})" for s in sources[:40])
            digest_bits = retrieve.notebook_digest(nb_id, max_chars=6000)
            plan_info = plan_queries(meta, src_lines or digest_bits, base_query)
        except Exception:
            plan_info = {"gaps": [], "queries": []}

    queries = list(dict.fromkeys(plan_info["queries"]))
    if base_query:
        queries.insert(0, base_query)
    if not queries:
        queries = [focus_text.strip() or " ".join(meta.get("title", "").split())]
    queries = [q for q in queries if q][:5]

    rows = search_all(queries, per_query=max(4, max_results), state=search_state)
    for row in rows:
        if isinstance(row, dict):
            row.setdefault("round", 1)
    candidates = rank_candidates(
        rows, existing=existing, focus_terms=focus_terms + plan_info["gaps"],
        per_domain=per_domain, limit=max_results)
    all_queries = list(queries)
    rounds_run = 1

    want_rounds = max(1, min(3, rounds)) if rounds else (can_read_rounds() if deep else 1)
    while deep and rounds_run < want_rounds:
        rounds_run += 1
        try:
            new_queries = refine_queries(meta, focus_text, candidates,
                                         plan_info["gaps"], all_queries, rounds_run)
        except Exception:
            new_queries = []
        if not new_queries:
            break
        all_queries.extend(new_queries)
        more = search_all(new_queries, per_query=max(4, max_results), state=search_state)
        for row in more:
            if isinstance(row, dict):
                row["round"] = rounds_run
        rows.extend(more)
        candidates = rank_candidates(
            rows, existing=existing,
            focus_terms=focus_terms + plan_info["gaps"],
            per_domain=per_domain, limit=max_results)

    if search_state.get("web_unavailable"):
        if providers() == ["web"]:
            # nothing else can search — an empty page would read as "no
            # sources exist", which is a lie
            raise RuntimeError(
                "the host's web_search tool is not registered in this session, "
                "and no EXA_API_KEY or TAVILY_API_KEY is configured — nothing could be searched")
        candidates_note = ("the host's web_search tool is not registered in this "
                           "session — results come only from the configured search providers")
    else:
        candidates_note = ""

    out = {
        "ok": True,
        "notebook": nb_id,
        "query": base_query or (queries[0] if queries else ""),
        "queries": all_queries,
        "gaps": plan_info["gaps"],
        "providers": providers(),
        "candidates": candidates,
        "searched": len(rows),
        "deep": bool(deep),
        "rounds": rounds_run,
        "hint": "Nothing was added — POST /sources with the urls you keep.",
    }
    if candidates_note:
        out["warning"] = candidates_note
    return out
