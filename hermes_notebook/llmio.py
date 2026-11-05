"""ctx.llm wrappers: every Notebook LLM call goes through here so purpose=
audit strings, timeouts and error shaping stay consistent."""

from __future__ import annotations

from typing import Any, Optional

from . import runtime

_DEFAULT_TIMEOUT = 180.0


def complete(messages: list[dict], *, purpose: str, max_tokens: Optional[int] = None,
             temperature: Optional[float] = None, timeout: Optional[float] = None,
             task: Optional[str] = None) -> str:
    result = runtime.llm().complete(
        messages=messages,
        max_tokens=max_tokens,
        temperature=temperature,
        timeout=timeout or _DEFAULT_TIMEOUT,
        purpose=purpose,
        task=task,
    )
    return (result.text or "").strip()


def structured(*, instructions: str, input: list[dict], json_schema: Optional[dict] = None,
               schema_name: Optional[str] = None, system_prompt: Optional[str] = None,
               purpose: str, max_tokens: Optional[int] = None,
               temperature: Optional[float] = None, timeout: Optional[float] = None,
               task: Optional[str] = None) -> Any:
    """Returns result.parsed (dict/list) or None when the model didn't produce valid JSON."""
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
    result = runtime.llm().complete_structured(**{k: v for k, v in kwargs.items() if v is not None})
    return result.parsed
