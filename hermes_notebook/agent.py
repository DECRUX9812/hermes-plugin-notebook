"""The agent half of the composer: plan one tool call, run it, answer from it.

Two models calls, never more: one to DECIDE (a small structured plan), one to
ANSWER (the notebook's own grounded ask, with the tool result appended). The
tool runs between them, so the number in the answer is a number that a query
produced — not one the model remembered.

Nothing here decides on its own to run code. Agent mode is a choice the reader
makes in the composer; this module is what that choice is wired to.
"""

from __future__ import annotations

import json
import re
from typing import Any, Dict, List, Optional

from . import agent_tools, llmio, retrieve, tools

MAX_STEPS = 2

PLAN_SCHEMA = {
    "type": "object",
    "properties": {
        "use_tool": {"type": "boolean"},
        "tool": {"type": "string", "enum": ["query_table", "run_script", "mcp_call"]},
        "arguments": {"type": "object"},
        "reason": {"type": "string"},
    },
    "required": ["use_tool"],
}


def _tables_brief(notebook_id: str) -> str:
    rows = agent_tools.tables(notebook_id)
    if not rows:
        return "No tables are loaded for this notebook."
    lines = []
    for t in rows[:8]:
        cols = ", ".join(t["columns"][:8])
        lines.append(f'- "{t["table"]}" ({t["rows"]} rows): {cols}')
    return "\n".join(lines)


def _plan(notebook_id: str, question: str) -> Dict[str, Any]:
    """One structured decision. Failure is a plan that uses no tool."""
    try:
        parsed = llmio.structured(
            instructions=(
                "Decide whether answering this question needs a TOOL, or only the sources.\n"
                "Tools:\n"
                "  query_table  — SQL over the notebook's tables. Use it for any sum, count,\n"
                "                 average, ordering, filtering or comparison of numbers.\n"
                "  run_script   — short Python/Bash. Use it when the answer needs a\n"
                "                 calculation the tables cannot express, or to inspect a file.\n"
                "  mcp_call     — a connected MCP server. Use it only when the question\n"
                "                 needs live external data the sources do not hold.\n"
                'Answer {"use_tool": false, "reason": "..."} when the sources alone answer it.\n'
                'When a tool is needed return {"use_tool": true, "tool": ..., "arguments": {...}, "reason": ...}.\n'
                "For query_table the arguments are {\"sql\": \"<one read-only SELECT>\"}.\n"
                "For run_script they are {\"language\": \"python\", \"code\": \"...\"}.\n"
                "For mcp_call they are {\"server\", \"tool\", \"arguments\"}.\n\n"
                f"Tables available:\n{_tables_brief(notebook_id)}"
            ),
            input=[{"role": "user", "content": question}],
            json_schema=PLAN_SCHEMA,
            schema_name="notebook_tool_plan",
            purpose="notebook.agent.plan",
            max_tokens=700,
            temperature=0,
        )
        return parsed if isinstance(parsed, dict) else {"use_tool": False}
    except Exception:
        return {"use_tool": False}


def _execute(notebook_id: str, plan: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    tool = str(plan.get("tool") or "").strip()
    args = plan.get("arguments") or {}
    if not isinstance(args, dict):
        args = {}
    if tool == "query_table":
        out = agent_tools.query_table(notebook_id, str(args.get("sql") or ""))
    elif tool == "run_script":
        out = agent_tools.run_script(str(args.get("language") or "python"),
                                     str(args.get("code") or ""))
    elif tool == "mcp_call":
        out = agent_tools.mcp_call(str(args.get("server") or ""), str(args.get("tool") or ""),
                                   args.get("arguments") if isinstance(args.get("arguments"), dict) else {})
    else:
        return None
    out = dict(out)
    out["tool"] = tool
    out["why"] = str(plan.get("reason") or "")
    return out


def _evidence(action: Dict[str, Any]) -> str:
    """What the answering model is allowed to use from the tool run."""
    if not action:
        return ""
    if action.get("tool") == "query_table":
        if not action.get("ok"):
            return f"The SQL did not run: {action.get('error')}"
        cols = action.get("columns") or []
        rows = action.get("rows") or []
        body = "\n".join(" | ".join(str(c) for c in r) for r in rows[:40])
        return (f"SQL that ran ({action.get('engine')}): {action.get('sql')}\n"
                f"Columns: {', '.join(map(str, cols))}\nRows:\n{body}")
    if action.get("tool") == "run_script":
        return (f"A script ran (exit {action.get('exit')}). Output:\n"
                f"{(action.get('out') or '').strip()[:2000]}\n"
                f"{(action.get('err') or '').strip()[:800]}")
    return f"MCP result:\n{(action.get('out') or action.get('error') or '')[:2000]}"


def _answer(notebook_id: str, question: str, thread: str, action: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    ask_payload: Dict[str, Any] = {"notebook": notebook_id, "question": question, "thread": thread}
    if action:
        ask_payload["question"] = (
            f"{question}\n\n"
            "The reader asked for this to be executed. Here is what actually ran — use "
            "these values as fact and do not recompute or contradict them:\n"
            f"{_evidence(action)}\n\n"
            "If the tool failed, say what failed and answer from the sources instead."
        )
        ask_payload["retry"] = True
    try:
        out = json.loads(tools.notebook_ask(ask_payload))
    except Exception as exc:
        return {"ok": False, "error": str(exc)}
    return out


COUNCIL_SCHEMA = {
    "type": "object",
    "properties": {
        "verdict": {"type": "string", "enum": ["holds", "partly", "fails"]},
        "unsupported": {"type": "array", "items": {"type": "string"}},
        "note": {"type": "string"},
    },
    "required": ["verdict"],
}


def _council(notebook_id: str, question: str, answer: str) -> Dict[str, Any]:
    """A second pass over the same passages that tries to break the answer.

    This is not a second vendor — it is the same model reading the sources
    again with instructions to refute. It catches the failure that matters in a
    grounded notebook (a claim the passages do not support) and it is labelled
    honestly in the card, because "council" implying two independent models
    when one is bound would be a lie the reader could not detect.
    """
    try:
        pool = retrieve.retrieve(notebook_id, question, max_chars=14000, top_k=14)
    except Exception as exc:
        return {"ok": False, "error": str(exc)}
    passages = pool.get("context") or ""
    if not passages.strip():
        return {"ok": False, "error": "no passages to check against"}
    try:
        parsed = llmio.structured(
            instructions=(
                "You are checking a cited answer for grounding, not for style.\n"
                "You are given the passages that were available and the answer that was written.\n"
                'Return "holds" when every factual claim is supported by a passage,\n'
                '"partly" when some claims are not supported, "fails" when the answer\n'
                "contradicts the passages. List each unsupported claim verbatim in\n"
                "`unsupported` (empty when none). Keep `note` to one sentence."
            ),
            input=[{"role": "user", "content":
                    f"PASSAGES\n{passages[:12000]}\n\nANSWER TO CHECK\n{answer[:4000]}"}],
            json_schema=COUNCIL_SCHEMA,
            schema_name="notebook_council",
            purpose="notebook.council.verify",
            max_tokens=700,
            temperature=0,
        )
        if not isinstance(parsed, dict):
            return {"ok": False, "error": "the check did not return a verdict"}
        return {"ok": True, "verdict": str(parsed.get("verdict") or "partly"),
                "unsupported": [str(x) for x in (parsed.get("unsupported") or [])][:6],
                "note": str(parsed.get("note") or ""),
                "passes": 2, "model": "same model, second pass"}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


def run(notebook_id: str, question: str, thread: str = "", mode: str = "agent") -> Dict[str, Any]:
    """mode: 'agent' (plan + one tool + answer), 'council' (answer + a refuting
    second pass over the same passages) or 'grounded' (answer only)."""
    question = (question or "").strip()
    if not question:
        return {"ok": False, "error": "ask something first"}
    actions: List[Dict[str, Any]] = []
    if mode == "agent":
        for _ in range(MAX_STEPS):
            plan = _plan(notebook_id, question)
            if not plan.get("use_tool"):
                break
            action = _execute(notebook_id, plan)
            if not action:
                break
            actions.append(action)
            # one tool is the contract: a second only happens when the first
            # failed, and re-planning after a success just invites a second
            # guess at arithmetic the first query already settled
            if action.get("ok"):
                break
    if mode == "council":
        # answer first, then try to break it with the same passages
        first = _answer(notebook_id, question, thread, None)
        if not first.get("ok"):
            return first
        first["council"] = _council(notebook_id, question, str(first.get("answer") or ""))
        first["actions"] = []
        first["mode"] = "council"
        return first
    out = _answer(notebook_id, question, thread, actions[-1] if actions else None)
    if not out.get("ok"):
        return {"ok": False, "error": out.get("error") or "the model did not answer", "actions": actions}
    out["actions"] = actions
    out["mode"] = mode
    return out


def rerun(notebook_id: str, tool: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
    """Re-run one recorded action verbatim (the card's ⚡ Re-run button)."""
    got = _execute(notebook_id, {"tool": tool, "arguments": arguments or {}})
    if not got:
        return {"ok": False, "error": f"unknown tool {tool!r}"}
    return {"ok": bool(got.get("ok")), "action": got}
