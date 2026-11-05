"""Glue between the plugin context and the handlers: config reads, LLM access,
and the JSON envelope every Notebook tool returns."""

from __future__ import annotations

import json
import logging
import re
import traceback
from pathlib import Path
from typing import Any, Callable

logger = logging.getLogger(__name__)

PLUGIN_ID = "hermes-notebook"
TOOLSET = "hermes_notebook"

_ctx: Any = None


def bind(ctx: Any) -> None:
    global _ctx
    _ctx = ctx


def ctx() -> Any:
    if _ctx is None:
        raise RuntimeError("hermes-notebook is not registered with Hermes")
    return _ctx


def config(key: str, default: Any = None) -> Any:
    try:
        value = ctx().get_config(key, default=default)
    except Exception:
        return default
    return default if value in (None, "") else value


def plugin_data() -> Path:
    from plugins.plugin_storage import plugin_data_dir
    return plugin_data_dir(PLUGIN_ID)


def llm() -> Any:
    return ctx().llm


def dispatch(tool: str, args: dict, **kw) -> str:
    return ctx().dispatch_tool(tool, args, **kw)


def ok(**data: Any) -> str:
    media = [p for p in data.pop("media", []) if p]
    if media:
        data["share"] = " ".join(f"MEDIA:{p}" for p in media)
    return json.dumps({"ok": True, **_jsonable(data)}, indent=1, ensure_ascii=False)


def fail(message: str, **data: Any) -> str:
    return json.dumps({"ok": False, "error": message, **_jsonable(data)}, ensure_ascii=False)


def _jsonable(obj: Any) -> Any:
    if isinstance(obj, Path):
        return str(obj)
    if isinstance(obj, dict):
        return {k: _jsonable(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_jsonable(v) for v in obj]
    return obj


def handler(fn: Callable[..., Any]) -> Callable[..., Any]:
    """Tool handlers return JSON on every path: a bad argument becomes an error
    the model can act on, never an exception in the agent loop. Supports async fns."""
    import asyncio
    import functools
    import inspect

    if inspect.iscoroutinefunction(fn):
        @functools.wraps(fn)
        async def wrapped_async(args: dict, **kwargs):
            try:
                return await fn(args or {}, **kwargs)
            except (ValueError, KeyError, FileNotFoundError, NotADirectoryError) as exc:
                return fail(str(exc))
            except Exception as exc:
                logger.warning("notebook tool %s failed: %s", fn.__name__, exc)
                return fail(f"{type(exc).__name__}: {exc}", trace=traceback.format_exc(limit=3))
        return wrapped_async

    @functools.wraps(fn)
    def wrapped(args: dict, **kwargs):
        try:
            return fn(args or {}, **kwargs)
        except (ValueError, KeyError, FileNotFoundError, NotADirectoryError) as exc:
            return fail(str(exc))
        except Exception as exc:
            logger.warning("notebook tool %s failed: %s", fn.__name__, exc)
            return fail(f"{type(exc).__name__}: {exc}", trace=traceback.format_exc(limit=3))
    return wrapped


def slugify(text: str, limit: int = 48) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug[:limit].strip("-") or "notebook"


def utc_stamp() -> str:
    import datetime
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d-%H%M%S")
