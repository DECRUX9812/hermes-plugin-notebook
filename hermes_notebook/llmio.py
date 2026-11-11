"""ctx.llm wrappers: every Notebook LLM call goes through here so purpose=
audit strings, timeouts and error shaping stay consistent."""

from __future__ import annotations

import json
import re
from typing import Any, Optional

from . import runtime

_DEFAULT_TIMEOUT = 180.0

#: the exact sentence appended for the single malformed-JSON retry
_RETRY_TEXT = ("Your last reply was not valid JSON for the schema. "
               "Reply with only the JSON object.")


def _extract_json(text: Any) -> Any:
    """Best-effort JSON recovery from a chatty reply: strip a code fence,
    then take the outermost {...} or [...] (whichever opens first) and parse
    it. Returns the parsed value or None — never raises on model output."""
    t = str(text or "").strip()
    if not t:
        return None
    if t.startswith("```"):
        t = re.sub(r"^```[a-zA-Z0-9_-]*\s*", "", t)
        t = re.sub(r"\s*```\s*$", "", t).strip()
    try:
        return json.loads(t)
    except ValueError:
        pass
    candidates = []
    for open_c, close_c in (("{", "}"), ("[", "]")):
        start = t.find(open_c)
        if start == -1:
            continue
        end = t.rfind(close_c)
        if end > start:
            candidates.append((start, t[start:end + 1]))
    for _start, cand in sorted(candidates):
        try:
            return json.loads(cand)
        except ValueError:
            continue
    return None


def complete(messages: list[dict], *, purpose: str, max_tokens: Optional[int] = None,
             temperature: Optional[float] = None, timeout: Optional[float] = None,
             task: Optional[str] = None,
             usage_out: Optional[list] = None) -> str:
    result = runtime.llm().complete(
        messages=messages,
        max_tokens=max_tokens,
        temperature=temperature,
        timeout=timeout or _DEFAULT_TIMEOUT,
        purpose=purpose,
        task=task,
    )
    # ctx.llm reports token usage on the result; callers that surface a cost
    # line pass a list to catch it (the field is optional on older hosts)
    if usage_out is not None:
        usage_out.append(getattr(result, "usage", None))
    return (result.text or "").strip()


def structured(*, instructions: str, input: list[dict], json_schema: Optional[dict] = None,
               schema_name: Optional[str] = None, system_prompt: Optional[str] = None,
               purpose: str, max_tokens: Optional[int] = None,
               temperature: Optional[float] = None, timeout: Optional[float] = None,
               task: Optional[str] = None,
               parse_out: Optional[list] = None) -> Any:
    """Returns the parsed JSON (dict/list) or None — with repair.

    Small models routinely answer a JSON-schema request with fences, a
    preamble, or an almost-object. Rather than failing the whole artifact,
    the call recovers in order:

    1. ``direct``    — result.parsed was already valid;
    2. ``extracted`` — result.text parsed after stripping fences and taking
                       the outermost JSON value;
    3. ``retried``   — one more call with the retry sentence appended to the
                       user input, parsed or extracted.

    ``parse_out`` (a list the caller passes) records which path produced the
    JSON — artifact writers store it as ``_parse`` so a run's logs can say
    honestly whether the model needed help. A total failure appends nothing
    and returns None; callers keep their existing clear error.
    """
    kwargs = dict(
        instructions=instructions,
        input=input,
        json_schema=json_schema,
        schema_name=schema_name,
        system_prompt=system_prompt,
        purpose=purpose,
        max_tokens=max_tokens,
        temperature=temperature,
        timeout=timeout or _DEFAULT_TIMEOUT,
        task=task,
    )

    def _call(user_input):
        kw = dict(kwargs)
        kw["input"] = user_input
        return runtime.llm().complete_structured(
            **{k: v for k, v in kw.items() if v is not None})

    result = _call(input)
    parsed = getattr(result, "parsed", None)
    if parsed is not None:
        if parse_out is not None:
            parse_out.append("direct")
        return parsed
    parsed = _extract_json(getattr(result, "text", ""))
    if parsed is not None:
        if parse_out is not None:
            parse_out.append("extracted")
        return parsed
    # exactly one retry — the model is told plainly what went wrong
    retry_input = list(input or []) + [{"type": "text", "text": _RETRY_TEXT}]
    result = _call(retry_input)
    parsed = getattr(result, "parsed", None)
    if parsed is None:
        parsed = _extract_json(getattr(result, "text", ""))
    if parsed is not None:
        if parse_out is not None:
            parse_out.append("retried")
        return parsed
    return None
