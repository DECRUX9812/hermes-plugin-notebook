"""Hermes Notebook — NotebookLM-style notebooks: sources in, cited answers and
study artifacts out, plus two-host audio overviews.

Surfaces: 8 model tools, /notebook slash command, `hermes notebook` CLI, one
bundled skill, one auxiliary task slot (cheap calls route there when pinned).
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from .hermes_notebook import artifacts, audio, ingest, llmio, retrieve, runtime, store
from .hermes_notebook import schemas, tools

logger = logging.getLogger(__name__)

TOOLSET = runtime.TOOLSET
EMOJI = {
    "notebook_list": "📚",
    "notebook_create": "📓",
    "notebook_add_source": "➕",
    "notebook_ask": "💬",
    "notebook_generate": "✨",
    "notebook_audio": "🎙️",
    "notebook_suggest": "💡",
    "notebook_delete": "🗑️",
}
ASYNC_TOOLS = {"notebook_audio"}


def register(ctx) -> None:
    runtime.bind(ctx)

    for schema in schemas.ALL:
        name = schema["name"]
        ctx.register_tool(
            name=name, toolset=TOOLSET, schema=schema,
            handler=runtime.handler(tools.HANDLERS[name]),
            is_async=name in ASYNC_TOOLS,
            description=schema["description"], emoji=EMOJI.get(name, "📓"),
        )

    skill_md = Path(__file__).parent / "skills" / "notebook" / "SKILL.md"
    if skill_md.exists():
        ctx.register_skill(
            "notebook", skill_md,
            description="Drive Hermes Notebook: grounded source Q&A, artifacts, audio overviews.",
        )

    ctx.register_command(
        "notebook", _slash,
        description="Hermes Notebook: list/create notebooks, add sources, ask, suggest",
        args_hint="[list|new <title>|add <nb> <path|url|text>|sources <nb>|ask <nb> <question>|suggest <nb>]",
        argument_mode="text",
    )

    ctx.register_cli_command(
        "notebook", "Hermes Notebook: NotebookLM-style source notebooks",
        _cli_setup, _cli_run,
        description="Manage notebooks, add sources, ask questions, generate artifacts and audio overviews.",
    )

    ctx.register_auxiliary_task(
        "notebook",
        display_name="Notebook (labels & suggestions)",
        description="Cheap LLM calls for source auto-labeling and notebook suggestions.",
        inherit_from="compression",
    )


# ------------------------------------------------------------------ slash

def _slash(raw: str) -> str:
    parts = (raw or "").strip().split(None, 1)
    cmd = parts[0].lower() if parts else ""
    rest = parts[1].strip() if len(parts) > 1 else ""
    try:
        if not cmd or cmd in {"list", "ls"}:
            return _slash_list(rest)
        if cmd in {"new", "create"}:
            if not rest:
                return "Usage: /notebook new <title> [— description]"
            title, _, desc = rest.partition("—")
            out = json.loads(tools.notebook_create({"title": title.strip(), "description": desc.strip()}))
            return f"Created notebook **{out['title']}** (`{out['id']}`)\n{out['dir']}\n\nNext: `/notebook add {out['id']} <path-or-url>` or ask me to add sources."
        if cmd in {"add", "source"}:
            return _slash_add(rest)
        if cmd in {"sources", "src"}:
            nb = store.resolve_notebook(rest or "")
            brief = json.loads(tools.notebook_list({"notebook": nb}))
            lines = [f"**{brief['title']}** — {len(brief['sources'])} sources:"]
            for s in brief["sources"]:
                labels = f" _{', '.join(s['labels'])}_" if s.get("labels") else ""
                lines.append(f"- `{s['id']}` {s['title']} ({s['kind']}, {s['chars']:,} chars){labels}")
            return "\n".join(lines) or "(no sources)"
        if cmd in {"ask", "q"}:
            nb, _, question = rest.partition("::")
            if not question:
                nb, _, question = rest.partition(" ")
            if not question.strip():
                return "Usage: /notebook ask <notebook> <question>   (or <nb>::<question>)"
            out = json.loads(tools.notebook_ask({"notebook": nb.strip(), "question": question.strip()}))
            if not out.get("ok"):
                return f"Error: {out.get('error')}"
            cited = ", ".join(f"[S{s['n']}] {s['title']}" for s in out.get("sources_used", []))
            return f"{out['answer']}\n\n— sources: {cited}"
        if cmd in {"suggest", "ideas"}:
            out = json.loads(tools.notebook_suggest({"notebook": rest or ""}))
            if not out.get("ok"):
                return f"Error: {out.get('error')}"
            sug = out["suggestions"]
            lines = [f"**Ideas for {out.get('title', 'notebook')}**", "", "Questions worth asking:"]
            lines += [f"- {q}" for q in sug.get("questions", [])]
            lines += ["", "Artifacts to generate:"]
            lines += [f"- {a}" for a in sug.get("artifacts", [])]
            lines += ["", "Source gaps:"]
            lines += [f"- {g}" for g in sug.get("gaps", [])]
            return "\n".join(lines)
        return ("Usage: /notebook [list | new <title> | add <nb> <path|url|text> | "
                "sources <nb> | ask <nb> <question> | suggest <nb>]\n"
                "For artifacts and audio overviews, ask me in chat (notebook_generate / notebook_audio).")
    except Exception as exc:
        return f"Notebook error: {exc}"


def _slash_list(rest: str) -> str:
    out = json.loads(tools.notebook_list({}))
    nbs = out.get("notebooks", [])
    if not nbs:
        return "No notebooks yet. `/notebook new <title>` to create one."
    lines = ["**Notebooks**"]
    for n in nbs:
        lines.append(f"- `{n['id']}` **{n['title']}** — {n['sources']} sources, "
                     f"{n['artifacts']} artifacts, {n['total_chars']:,} chars")
    return "\n".join(lines)


def _slash_add(rest: str) -> str:
    nb, _, spec = rest.partition(" ")
    if not spec.strip():
        return "Usage: /notebook add <notebook> <path-or-url-or-text>"
    spec = spec.strip()
    if spec.lower().startswith(("http://", "https://")):
        return json.loads(tools.notebook_add_source({"notebook": nb, "url": spec})) and _added_msg(spec)
    p = Path(spec).expanduser()
    if p.exists() and p.is_file():
        out = json.loads(tools.notebook_add_source({"notebook": nb, "path": str(p)}))
    else:
        out = json.loads(tools.notebook_add_source({"notebook": nb, "text": spec}))
    return _added_msg(spec, out)


def _added_msg(spec: str, out: dict | None = None) -> str:
    if out and out.get("ok"):
        s = out
        labels = f" — _{', '.join(s['labels'])}_" if s.get("labels") else ""
        return (f"Added **{s['title']}** ({s['kind']}, {s['chars']:,} chars){labels}\n"
                f"{s.get('summary', '')}\n_Notebook now has {s['sources_in_notebook']} sources._")
    return f"Added source: {spec[:80]}"


# -------------------------------------------------------------------- CLI

def _cli_setup(parser) -> None:
    sub = parser.add_subparsers(dest="notebook_cmd")

    p = sub.add_parser("list", help="list notebooks (or sources of one)")
    p.add_argument("notebook", nargs="?")

    p = sub.add_parser("new", help="create a notebook")
    p.add_argument("title")
    p.add_argument("--description", default="")

    p = sub.add_parser("add", help="add a source: file path, URL, or --text")
    p.add_argument("notebook")
    p.add_argument("source", nargs="?", help="path or URL (omit with --text)")
    p.add_argument("--text", help="pasted text content")
    p.add_argument("--title", default="")

    p = sub.add_parser("ask", help="ask a question answered from the sources")
    p.add_argument("notebook", nargs="?")
    p.add_argument("question", nargs="+")

    p = sub.add_parser("generate", help="generate an artifact")
    p.add_argument("notebook", nargs="?")
    p.add_argument("kind", choices=list(artifacts.ALL_KINDS))
    p.add_argument("--focus", default="")

    p = sub.add_parser("audio", help="generate a two-host audio overview (mp3)")
    p.add_argument("notebook", nargs="?")
    p.add_argument("--length", choices=list(audio.LENGTHS), default=None)
    p.add_argument("--focus", default="")

    p = sub.add_parser("suggest", help="suggest questions/artifacts/gaps")
    p.add_argument("notebook", nargs="?")

    p = sub.add_parser("delete", help="delete a notebook (asks for --yes)")
    p.add_argument("notebook")
    p.add_argument("--yes", action="store_true")


def _cli_run(args) -> int:
    cmd = getattr(args, "notebook_cmd", None)
    try:
        if cmd == "list":
            print(json.dumps(json.loads(tools.notebook_list({"notebook": args.notebook} if args.notebook else {})), indent=1, ensure_ascii=False))
        elif cmd == "new":
            print(json.dumps(json.loads(tools.notebook_create({"title": args.title, "description": args.description})), indent=1))
        elif cmd == "add":
            payload = {"notebook": args.notebook, "title": args.title or None}
            if args.text is not None:
                payload["text"] = args.text
            elif args.source:
                s = args.source
                payload["url" if s.lower().startswith(("http://", "https://")) else "path"] = s
            else:
                print("add needs a source path/URL or --text")
                return 2
            print(json.dumps(json.loads(tools.notebook_add_source(payload)), indent=1, ensure_ascii=False))
        elif cmd == "ask":
            payload = {"question": " ".join(args.question)}
            if args.notebook:
                payload["notebook"] = args.notebook
            print(json.dumps(json.loads(tools.notebook_ask(payload)), indent=1, ensure_ascii=False))
        elif cmd == "generate":
            payload = {"kind": args.kind, "focus": args.focus}
            if args.notebook:
                payload["notebook"] = args.notebook
            print(json.dumps(json.loads(tools.notebook_generate(payload)), indent=1, ensure_ascii=False))
        elif cmd == "audio":
            import asyncio
            payload = {"length": args.length, "focus": args.focus}
            if args.notebook:
                payload["notebook"] = args.notebook
            out = asyncio.run(tools.notebook_audio(payload))
            print(out)
        elif cmd == "suggest":
            print(json.dumps(json.loads(tools.notebook_suggest({"notebook": args.notebook or ""})), indent=1, ensure_ascii=False))
        elif cmd == "delete":
            if not args.yes:
                print("Refusing to delete without --yes")
                return 2
            print(json.dumps(json.loads(tools.notebook_delete({"notebook": args.notebook, "confirm": True})), indent=1))
        else:
            print("usage: hermes notebook <list|new|add|ask|generate|audio|suggest|delete> ...")
            return 2
        return 0
    except Exception as exc:
        print(f"error: {exc}")
        return 1
