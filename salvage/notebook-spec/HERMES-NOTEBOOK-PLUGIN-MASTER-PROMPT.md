# MASTER PROMPT — Hermes "NotebookLM" Plugin (Plugin Hackathon Entry)

> Paste everything below the line into a grounded AI chat that has access to the
> Hermes Agent repo/docs (or just use it as the spec). It is written to be
> self-contained: every API fact needed is inline.

---

## ROLE

You are a senior plugin author for **Hermes Agent** (Nous Research's open-source
personal AI agent: CLI + messaging gateway + desktop app, Python core). You are
helping build **`hermes-notebook`**, a plugin that reproduces the core experience
of **Google NotebookLM** inside Hermes, for the **Nous Research Hermes Plugin
Hackathon** ($20,000 prizes, $10k first place; submissions close **Nov 11,
22:00 UTC**; judged on usefulness, reliability, polish, creativity — organizers
say they favor plugins that do *more than a prompt or skill can*).

Your job: critique the design below, find gaps vs. real NotebookLM, flag
technical risks in the Hermes plugin API, and produce concrete improvements —
better tool schemas, missing features worth v1-ing, failure modes, and code for
the weak modules. Be opinionated and specific. If you have repo access, verify
every API claim against the source before trusting it.

## REFERENCE MATERIAL (read if you have filesystem/repo access)

- Hermes plugin authoring guide:
  `website/docs/developer-guide/plugins/index.md`
- Plugin LLM access (`ctx.llm`): `website/docs/developer-guide/plugin-llm-access.md`
- Plugin rules: `plugins/AGENTS.md`, `plugin-catalog/README.md` (admission rules)
- Plugin context implementation: `hermes_cli/plugins.py` (`register_tool`,
  `register_command`, `register_cli_command`, `register_skill`,
  `register_auxiliary_task`, `dispatch_tool`, `ctx.llm`, `ctx.state`,
  `ctx.get_config`/`set_config`, `ctx.has_capability`)
- Durable storage: `plugins/plugin_storage.py` (`plugin_data_dir`, `plugin_db`)
- Tool registry dispatch (async bridging): `tools/registry.py::dispatch`
- Built-in TTS tool: `tools/tts_tool.py` (`text_to_speech`, toolset `tts`,
  Edge TTS free default, `output_path` param)
- Web extraction tool: `tools/web_tools.py` (`web_extract`, toolset `web`)
- Reference plugins to imitate:
  - `hermes-example-plugins/plugin-llm-example` (ctx.llm usage)
  - User's own `hermes-plugin-gameforge` (runtime.bind(ctx) pattern, manifest
    v2, config_schema, skills/, tests/, JSON ok/fail envelope)

## HARD CONSTRAINTS (catalog admission — violations = rejected)

1. Standalone repo, `plugin.yaml` + `__init__.py` with `register(ctx)`. Never
   patch core files or monkeypatch core functions.
2. `provides_tools`/`provides_hooks`/`capabilities` in the manifest must exactly
   match what `register()` registers.
3. Python deps declared with upper bounds (`>=floor,<next_major`), floors on
   API-compatible older versions. No self-updater code.
4. Secrets only via `agent.secret_scope.get_secret` / declared `requires_env` /
   `config_schema` secret fields — never read `.env`/`auth.json`/other tools'
   credential files.
5. Unattended-run safe: anything needing a human (OAuth browser flow) must fail
   cleanly under cron/gateway.
6. `requires_hermes` SemVer floor declared in both catalog YAML and plugin.yaml.
7. Network disclosure in README (fetches URLs, calls edge-tts service, etc.).

## WHAT NOTEBOOKLM DOES (the parity target)

- **Notebooks**: named collections of sources.
- **Sources**: PDFs, Google Docs, pasted text, web URLs, YouTube videos,
  images, audio files.
- **Chat**: grounded Q&A with inline citations to specific sources; says "I
  don't know" when sources don't cover it.
- **Artifacts** (one-click generated docs): summary, briefing doc, study guide,
  FAQ, timeline, mind map, flashcards, quiz.
- **Audio Overview**: the signature feature — a ~10-minute conversational
  podcast between TWO distinct hosts discussing the sources.
- (v2, not v1: video overviews, source discovery/recommendations, shared
  notebooks, chat history persistence.)

## PROPOSED ARCHITECTURE

### Storage — `plugin_data_dir("hermes-notebook")` (survives updates/removal)

```
plugin-data/hermes-notebook/
└── notebooks/<slug>/
    ├── notebook.json          # {id,title,description,created_at,updated_at}
    ├── sources/
    │   ├── index.json         # [{id,title,kind,origin,added_at,chars}]
    │   └── <src_id>.txt       # extracted plain text
    └── artifacts/
        └── <UTCts>-<kind>.{md,json,mp3,txt}
```

Notebook id = slugified title (`my-research`), `-2`,`-3` suffix on collision.
Resolution order for tool args: exact id → exact title → unique substring.

### Ingestion (`notebook_add_source`) — auto-detect by arg

| Input | Path |
|---|---|
| `.txt .md .markdown .rst .org .json .jsonl .csv .tsv .log .py .js .ts .html .xml .yaml .yml .toml .ini .cfg .sql .sh .tex .bib .srt .vtt` | read_text utf-8/replace |
| `.pdf` | `pypdf` per-page extract |
| `.docx` `.pptx` | zipfile + XML text (stdlib) or python-docx |
| `.xlsx` | `openpyxl` |
| `.epub` | zipfile XHTML strip |
| `.ipynb` | JSON cells join |
| images `.png .jpg .jpeg .webp .gif` | `ctx.llm.complete_structured` with image input block → vision description becomes the source text (`kind=image`) |
| `http(s)://…youtube…` | `youtube-transcript-api` transcript + oEmbed title |
| other `http(s)://` | PRIMARY `ctx.dispatch_tool("web_extract", {urls:[u]})` (uses the user's configured web backend, handles JS/PDF); FALLBACK direct `urllib` fetch + `trafilatura` extract |
| `text` param | stored verbatim |
| audio/video files | v1: clear "unsupported" error (STT is a v2 item) |

### Retrieval (`notebook_ask`)

- Chunk each source ~1400 chars, ~160 overlap (at query time, pure Python).
- Score chunks vs. query with BM25-ish term weighting; take top chunks until a
  ~28k-char context budget (configurable).
- Prompt via `ctx.llm.complete`: system = "answer ONLY from sources, cite [n],
  say when uncovered"; user = numbered source headers + chunks.
- Result JSON: `{answer, sources_used:[{n,title,kind,origin}]}`.

### Artifacts (`notebook_generate`)

- Markdown kinds via `ctx.llm.complete`: `summary`, `briefing_doc`,
  `study_guide`, `faq`, `timeline`.
- Structured kinds via `ctx.llm.complete_structured` (JSON schema → render .md
  + keep .json): `mind_map` (nested tree), `flashcards` ({front,back}),
  `quiz` ({question,choices?,answer,explanation}).
- Files land in `artifacts/` with UTC timestamps; tool returns path + preview.

### Audio Overview (`notebook_audio`) — async tool (`is_async=True`)

1. `ctx.llm.complete_structured` → `{title, segments:[{speaker:"host_a"|
   "host_b", text}]}`. Length presets: short ~600–900 words (~5 min), medium
   ~1400–1800 (~10 min), long ~2500–3500 (~20 min). Script fed a head+tail
   sample of all sources up to ~40k chars.
2. TTS each segment with **edge-tts** (free, no key, declared dep) — two distinct
   neural voices from `config_schema` (defaults e.g. `en-US-AndrewNeural` +
   `en-US-EmmaNeural`). Small asyncio semaphore (~4) for segment synthesis.
3. `ffmpeg -f concat -c copy` → single `audio_overview-<ts>.mp3` + `.txt`
   transcript (speaker-labeled) + `.json` script. ffmpeg absent → keep segment
   files + clear error (Hermes's own TTS delivery already requires ffmpeg).
4. Engine fallback idea (undecided): `engine=hermes` → `ctx.dispatch_tool(
   "text_to_speech")` per segment, single voice, labels spoken — resilient but
   less polished.

### Surfaces

- **7 tools** (toolset `hermes_notebook`): `notebook_list`, `notebook_create`,
  `notebook_add_source`, `notebook_ask`, `notebook_generate`, `notebook_audio`
  (async), `notebook_delete` (requires `confirm=true`).
- **`/notebook`** slash command: list/new/add/overview (quick paths; ask/audio
  stay tool-driven).
- **`hermes notebook`** CLI: `list|new|add|ask|generate|audio` — good for the
  demo video and scripting.
- **Bundled skill** `skills/notebook/SKILL.md`: teaches the agent the
  NotebookLM workflow ("make a podcast about these files" → create → add →
  audio) so the feature is discoverable in chat.
- **`register_auxiliary_task("notebook", …)`** so users can pin a cheaper model
  for bulk generation; undecided whether llm calls pass `task="notebook"`.

### Manifest sketch (`plugin.yaml`, manifest_version: 2)

```yaml
name: hermes-notebook
version: 0.1.0
manifest_version: 2
api_version: 1
description: NotebookLM-style notebooks for Hermes — sources in, cited answers
  and study artifacts out, plus two-host audio overviews.
author: Ritesh Patel
license: MIT
provides_tools: [notebook_list, notebook_create, notebook_add_source,
  notebook_ask, notebook_generate, notebook_audio, notebook_delete]
provides_hooks: []
config_schema:
  default_notebook: {type: str, default: "", label: Default notebook}
  ask_context_chars: {type: int, default: 28000}
  audio_voice_host_a: {type: str, default: "en-US-AndrewNeural"}
  audio_voice_host_b: {type: str, default: "en-US-EmmaNeural"}
  podcast_length: {type: str, default: medium, choices: [short, medium, long]}
python_dependencies:
  - "pypdf>=4.2,<7"
  - "edge-tts>=7.0,<8"
  - "youtube-transcript-api>=1.0,<2"
  - "trafilatura>=1.6,<3"
  - "openpyxl>=3.1,<4"
requires_hermes: ">=0.22"
```

### Repo layout (matches user's gameforge conventions)

```
hermes-plugin-notebook/
├── plugin.yaml
├── __init__.py            # register(ctx): runtime.bind + tools + skill + slash + CLI
├── hermes_notebook/
│   ├── runtime.py         # bind(ctx), config(), llm(), ok()/fail(), handler()
│   ├── store.py           # notebook CRUD, index.json, artifact listing
│   ├── ingest.py          # per-kind extraction pipeline
│   ├── extract.py         # pdf/docx/pptx/xlsx/epub/ipynb/html → text
│   ├── retrieve.py        # chunking + BM25-ish scoring + context assembly
│   ├── llmio.py           # ctx.llm wrappers w/ purpose= audit strings
│   ├── artifacts.py       # per-kind prompts + renderers (md/json)
│   ├── audio.py           # script → edge-tts → ffmpeg concat
│   ├── schemas.py         # 7 tool schemas
│   └── tools.py           # handlers (JSON envelope, never raise)
├── skills/notebook/SKILL.md
├── tests/                 # pytest: store, ingest (fixtures), retrieve, render — no LLM/network
├── README.md              # features, install, usage, disclosures, roadmap
├── LICENSE (MIT), CHANGELOG.md
└── plugin-catalog/hermes-notebook.yaml   # for the NousResearch/hermes-agent PR
```

## DELIVERABLES FOR THE HACKATHON

1. Public GitHub repo (owner: DECRUX9812).
2. Catalog PR: one file `plugin-catalog/hermes-notebook.yaml` in
   `NousResearch/hermes-agent` pinned to a full 40-hex SHA, `hermes plugins
   validate <path> --install-deps` green locally first.
3. Demo video < 90s on X tagging @NousResearch (suggested arc: create notebook →
   add 2-3 sources incl. a YouTube video → ask a cited question → generate
   flashcards → generate the audio overview and play the first seconds).
4. Entry form submission before Nov 11, 22:00 UTC.

## QUESTIONS I WANT YOU TO ANSWER

1. **Gap analysis**: what does real NotebookLM do that this v1 misses, and which
   gaps are worth closing before Nov 11 vs. roadmap?
2. **API risks**: verify `ctx.dispatch_tool("web_extract")` and
   `ctx.dispatch_tool("text_to_speech")` actually work from plugin tool
   handlers (toolset gating? check_fn? async bridging?). Is `ctx.llm` usable
   from `register_cli_command` handlers and async tool handlers?
3. **Retrieval**: is BM25-ish good enough, or is there a Hermes-native
   embedding/context-engine surface I should use instead (check
   `agent/context_engine.py`, memory providers)?
4. **Audio**: edge-tts two-voice approach vs. alternatives (Hermes TTS
   providers, ElevenLabs dialogue API). Rate-limit/ToS risks of edge-tts for
   ~10-min scripts? SSML single-request multi-voice possibility?
5. **Tool design review**: are 7 tools the right surface? Should
   `notebook_add_source` split into `notebook_add_file|url|text`? Is
   `notebook_generate` + `notebook_audio` split right?
6. **Polish deltas** that would most impress judges given ~6 days: desktop
   `plugin.js` pane? dashboard plugin? source "notes"? chat history? export?
7. **Anything in the catalog admission rules** this design might trip
   (capabilities block contents, security scan flags, dependency review).

Output format: numbered findings by severity (blocker / risk / improvement /
nit), then a concrete revised plan. Cite file paths when verifying claims.
