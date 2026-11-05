import json
import sys
from pathlib import Path
from types import SimpleNamespace
from typing import Any, Optional

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from hermes_notebook import runtime


class FakeLLM:
    """Scriptable ctx.llm: ``complete`` returns ``text_reply``; ``complete_structured``
    returns ``parsed_reply`` (or parses ``text_reply`` as JSON when it looks like JSON)."""

    def __init__(self, text_reply: str = "model answer", parsed_reply: Any = None):
        self.text_reply = text_reply
        self.parsed_reply = parsed_reply
        self.calls: list[dict] = []

    def complete(self, messages, **kw):
        self.calls.append({"kind": "complete", "messages": messages, **kw})
        return SimpleNamespace(text=self.text_reply, provider="fake", model="fake-1",
                               agent_id="default", usage=SimpleNamespace(total_tokens=1), audit={})

    def complete_structured(self, **kw):
        self.calls.append({"kind": "structured", **kw})
        parsed = self.parsed_reply
        if parsed is None:
            try:
                parsed = json.loads(self.text_reply)
            except Exception:
                parsed = None
        text = self.text_reply if isinstance(self.text_reply, str) else json.dumps(self.text_reply)
        return SimpleNamespace(text=text, parsed=parsed, content_type="json" if parsed is not None else "text",
                               provider="fake", model="fake-1", agent_id="default",
                               usage=SimpleNamespace(total_tokens=1), audit={})


class FakeCtx:
    def __init__(self, llm: Optional[FakeLLM] = None, config: Optional[dict] = None,
                 dispatch_results: Optional[dict] = None):
        self.llm = llm or FakeLLM()
        self._config = config or {}
        self._dispatch = dispatch_results or {}
        self.registered_tools: list[str] = []
        self.commands: list[str] = []
        self.skills: list[str] = []

    def get_config(self, key, default=None):
        return self._config.get(key, default)

    def dispatch_tool(self, tool_name, args, **kw):
        result = self._dispatch.get(tool_name)
        if result is None:
            return json.dumps({"error": f"no fake result for {tool_name}"})
        return result(args) if callable(result) else result

    def register_tool(self, name, **kw):
        self.registered_tools.append(name)

    def register_command(self, name, **kw):
        self.commands.append(name)

    def register_cli_command(self, name, *a, **kw):
        self.commands.append(name)

    def register_skill(self, name, *a, **kw):
        self.skills.append(name)

    def register_auxiliary_task(self, *a, **kw):
        pass

    def register_hook(self, *a, **kw):
        pass


@pytest.fixture()
def ctx(tmp_path, monkeypatch):
    """Bound runtime + plugin data dir under tmp_path. Returns the FakeCtx."""
    monkeypatch.setattr(runtime, "plugin_data", lambda: tmp_path / "plugin-data")
    fake = FakeCtx()
    runtime.bind(fake)
    return fake
