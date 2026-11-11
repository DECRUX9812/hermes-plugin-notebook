"""Structured output repair: direct parse, fence extraction, one retry.

The host's complete_structured may report parsed=None for several honest
reasons — a small model wrapped JSON in fences, chatted around it, or ignored
the schema. llmio.structured recovers in a fixed order and reports which path
produced the JSON; these tests pin that order with a scriptable fake.
"""

from types import SimpleNamespace

import pytest

from conftest import FakeCtx, FakeLLM

from hermes_notebook import llmio, runtime


class ScriptedLLM(FakeLLM):
    """complete_structured returns queued (text, parsed) results."""

    def __init__(self, results):
        super().__init__()
        self.results = list(results)

    def complete_structured(self, **kw):
        self.calls.append({"kind": "structured", **kw})
        text, parsed = self.results.pop(0)
        return SimpleNamespace(text=text, parsed=parsed, content_type="json",
                               provider="fake", model="fake-1", agent_id="default",
                               usage=None, audit={})


@pytest.fixture()
def ctx(tmp_path, monkeypatch):  # noqa: F811 — shadows the shared fixture's llm
    monkeypatch.setattr(runtime, "plugin_data", lambda: tmp_path / "plugin-data")
    fake = FakeCtx()
    runtime.bind(fake)
    return fake


def _call(ctx, **kw):
    args = dict(instructions="return JSON", purpose="t",
                input=[{"type": "text", "text": "the corpus"}])
    args.update(kw)
    return llmio.structured(**args)


def test_direct_parse_needs_no_help(ctx):
    ctx.llm.parsed_reply = {"a": 1}
    out = []
    assert _call(ctx, parse_out=out) == {"a": 1}
    assert out == ["direct"]
    assert len(ctx.llm.calls) == 1          # no retry spent on valid output


def test_fenced_json_is_extracted(ctx):
    ctx.llm.text_reply = 'Here you go:\n```json\n{"a": 1}\n```\nhope that helps'
    ctx.llm.parsed_reply = None
    out = []
    assert _call(ctx, parse_out=out) == {"a": 1}
    assert out == ["extracted"]
    assert len(ctx.llm.calls) == 1


def test_chattiest_reply_still_extracts(ctx):
    ctx.llm.text_reply = 'Sure, the object is {"ok": true} and the list [1,2]'
    ctx.llm.parsed_reply = None
    out = []
    got = _call(ctx, parse_out=out)
    assert got == {"ok": True}               # outermost value wins (it opens first)
    assert out == ["extracted"]


def test_one_retry_for_unparseable_text(ctx):
    ctx.llm = ScriptedLLM([
        ("I can't produce JSON for this.", None),
        ("anything", {"retried": True}),
    ])
    out = []
    assert _call(ctx, parse_out=out) == {"retried": True}
    assert out == ["retried"]
    calls = ctx.llm.calls
    assert len(calls) == 2                  # exactly one retry
    last_input = calls[1]["input"][-1]
    assert last_input["text"] == (
        "Your last reply was not valid JSON for the schema. "
        "Reply with only the JSON object.")
    # the original input parts are still there — the retry is appended
    assert calls[1]["input"][0]["text"] == "the corpus"


def test_retry_text_can_also_be_extracted(ctx):
    ctx.llm = ScriptedLLM([
        ("no json at all", None),
        ('```\n{"fixed": 1}\n```', None),
    ])
    out = []
    assert _call(ctx, parse_out=out) == {"fixed": 1}
    assert out == ["retried"]


def test_total_failure_returns_none(ctx):
    ctx.llm = ScriptedLLM([
        ("nope", None),
        ("still nope", None),
    ])
    out = []
    assert _call(ctx, parse_out=out) is None
    assert out == []                        # nothing succeeded → nothing claimed
    assert len(ctx.llm.calls) == 2          # and never a third try


def test_retry_exception_propagates(ctx):
    """A dead model call surfaces like before — repair only covers bad JSON."""
    class DeadLLM(FakeLLM):
        def complete_structured(self, **kw):
            self.calls.append({"kind": "structured", **kw})
            raise RuntimeError("host unreachable")
    ctx.llm = DeadLLM()
    with pytest.raises(RuntimeError):
        _call(ctx)
    assert len(ctx.llm.calls) == 1
