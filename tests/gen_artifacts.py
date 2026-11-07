"""Generate the demo notebook's artifacts through the plugin's own prompts.

Why this exists: the artifacts a judge sees in the studio have to be real model
output from the real prompt builders — not hand-written markdown. This runs
`artifacts.generate()` / `audio.make_audio_overview()` / `video.make_video_overview()`
unchanged, with a ctx whose only job is to route `ctx.llm` at the user's own
configured model (the `hermes chat -q … --oneshot` door, no tools bound).

    python3 tests/gen_artifacts.py --notebook commercial-fusion-2026 --kinds mind_map,flashcards
"""

# needs: PYTHONPATH=<hermes checkout> HERMES_HOME=<profile> and a working model

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from hermes_notebook import artifacts, audio, runtime, video  # noqa: E402


class _Result:
    def __init__(self, text: str, parsed=None):
        self.text = text
        self.parsed = parsed


def _extract_json(text: str):
    fence = re.search(r"```(?:json)?\s*(\{.*?\}|\[.*?\])\s*```", text, re.S)
    raw = fence.group(1) if fence else None
    if raw is None:
        start = min([i for i in (text.find("{"), text.find("[")) if i >= 0], default=-1)
        if start < 0:
            return None
        depth = 0
        for i in range(start, len(text)):
            if text[i] in "{[":
                depth += 1
            elif text[i] in "}]":
                depth -= 1
                if depth == 0:
                    raw = text[start:i + 1]
                    break
    if raw is None:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


def _ask(prompt: str, max_tokens: int = 0) -> str:
    cmd = ["hermes", "chat", "--query-file", "-", "--oneshot", "-Q", "-t", ""]
    done = subprocess.run(cmd, input=prompt, capture_output=True, text=True, timeout=900)
    out = (done.stdout or "").strip()
    # the CLI appends its session id on a trailing line
    out = re.sub(r"\n+session_id:.*$", "", out, flags=re.S).strip()
    if done.returncode != 0 and not out:
        raise RuntimeError((done.stderr or "").strip()[-400:] or f"hermes chat exited {done.returncode}")
    return out


class _LLM:
    """The shape `hermes_notebook.llmio` expects, routed at the user's model."""

    def complete(self, messages, **kw):
        prompt = "\n\n".join(
            f"[{m.get('role')}]\n{m.get('content')}" for m in messages if m.get("content")
        )
        return _Result(_ask(prompt))

    def complete_structured(self, *, instructions, input, json_schema=None, schema_name=None,
                            system_prompt=None, **kw):
        schema_hint = ""
        if json_schema:
            schema_hint = ("\n\nJSON schema the reply must satisfy (return ONLY the JSON value, "
                           "no prose, no fence):\n" + json.dumps(json_schema)[:6000])
        head = (system_prompt + "\n\n" if system_prompt else "") + instructions + schema_hint
        body = "\n\n".join(b.get("text", "") for b in (input or []) if isinstance(b, dict))
        text = _ask(f"[system]\n{head}\n\n[user]\n{body}\n\nRemember: reply with only the JSON value.")
        if os.environ.get("NB_DEBUG_STRUCT"):
            Path(f"/tmp/struct-{schema_name or 'x'}.txt").write_text(text, encoding="utf-8")
        parsed = _extract_json(text)
        if parsed is None and os.environ.get("NB_DEBUG_STRUCT"):
            print(f"  (no JSON parsed; raw head={text[:300]!r})", flush=True)
        return _Result(text, parsed)


class _Ctx:
    def get_config(self, key, default=None):
        return default

    llm = _LLM()


KINDS = ["summary", "briefing_doc", "study_guide", "faq", "timeline",
         "mind_map", "flashcards", "quiz", "slides", "infographic",
         "audio_overview", "video_overview"]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--notebook", required=True)
    ap.add_argument("--kinds", default=",".join(KINDS))
    args = ap.parse_args()

    runtime.bind(_Ctx())
    # the demo data may live under another HERMES_HOME than this process resolves
    for kind in [k.strip() for k in args.kinds.split(",") if k.strip()]:
        try:
            if kind == "audio_overview":
                import asyncio
                out = asyncio.run(audio.make_audio_overview(args.notebook, length="short"))
            elif kind == "video_overview":
                import asyncio
                out = asyncio.run(video.make_video_overview(args.notebook, length="short", style="cinematic"))
            else:
                out = artifacts.generate(args.notebook, kind)
            files = out.get("files") or [out.get("path") or out.get("audio") or out.get("video")]
            print(f"OK   {kind}: {[os.path.basename(str(f)) for f in files if f]}", flush=True)
        except Exception as exc:
            print(f"FAIL {kind}: {type(exc).__name__}: {exc}", flush=True)


if __name__ == "__main__":
    main()
