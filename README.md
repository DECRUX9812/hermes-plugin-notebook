# Hermes Notebook

![Hermes Notebook](assets/banner.png)

NotebookLM-style notebooks for [Hermes Agent](https://github.com/NousResearch/hermes-agent): gather sources, ask questions answered **only** from those sources with citations, auto-label everything, generate study artifacts — including mind maps — and produce **audio and video overviews**.

Built for the 2026 Hermes Plugin Competition.

## See it in action

![Video overview](assets/shot-01-video-title.png)
![Video overview — beat card](assets/shot-02-video-beat.png)
![Audio overview](assets/shot-03-audio.png)
![Grounded Q&A](assets/shot-04-ask.png)
![Auto-labeled sources](assets/shot-05-sources.png)
![Generated artifacts](assets/shot-06-artifacts.png)

## What it does

| NotebookLM feature | Hermes Notebook |
|---|---|
| Sources (files, PDFs, Office docs, web, YouTube) | `notebook_add_source` — path / URL / pasted text / images (vision-described) |
| Chat with sources + citations | `notebook_ask` — BM25 retrieval, `[S1]`-style citations mapped to source titles |
| Auto-labeling / source chips | Every source gets 2–5 topic labels + a one-line summary on ingest |
| Suggestions | `notebook_suggest` — questions worth asking, artifacts worth making, source gaps |
| Artifacts | `notebook_generate` — summary, briefing doc, study guide, FAQ, timeline, **mind map**, flashcards, quiz |
| Audio Overview | `notebook_audio` — two-host conversational podcast (edge-tts voices + ffmpeg), with transcript |
| Video Overview | `notebook_video` — cinematic narrated mp4: single-narrator documentary script, per-beat title cards in rotating palettes, ffmpeg assembly |
| — Hermes extras — | `/notebook` slash command, `hermes notebook` CLI, bundled skill, auxiliary task slot, per-notebook persistent storage |

## Install

```bash
hermes plugins install DECRUX9812/hermes-plugin-notebook
# or from a local checkout:
hermes plugins install /path/to/hermes-plugin-notebook
```

Requires Python deps declared in `plugin.yaml` (`pypdf`, `edge-tts`, `youtube-transcript-api`, `trafilatura`, `openpyxl`, `pillow`) — installed by the plugin manager. Audio/video overviews additionally need `ffmpeg` on PATH.

## Quickstart

```
/notebook new Q3 Earnings Analysis
/notebook add q3-earnings-analysis ~/Downloads/earnings.pdf
/notebook add q3-earnings-analysis https://example.com/analyst-note
/notebook ask q3-earnings-analysis what drove the margin expansion?
```

Or just ask in chat: *"create a notebook called X and add these files, then make a study guide and a podcast about it"* — the bundled `notebook` skill teaches the agent the workflow.

CLI equivalents: `hermes notebook list|new|add|ask|generate|audio|suggest|delete`.

## Tools

- `notebook_list` — notebooks, or sources inside one (`include_text` for full text)
- `notebook_create` — new notebook
- `notebook_add_source` — one source per call (`path` | `url` | `text`, plus optional `title`)
- `notebook_ask` — grounded Q&A with citations; optional `source_ids` scope
- `notebook_generate` — artifacts to `<notebook>/artifacts/`
- `notebook_audio` — mp3 + transcript + script JSON
- `notebook_video` — mp4 + transcript + script JSON (Pillow cards + ffmpeg)
- `notebook_suggest` — next-step recommendations
- `notebook_delete` — destructive, requires `confirm=true`

## Configuration

Under `plugins.entries.hermes-notebook.settings` (or `hermes plugins config`):

| key | default | meaning |
|---|---|---|
| `default_notebook` | `""` | notebook used when a call doesn't name one |
| `ask_context_chars` | `28000` | context budget per `notebook_ask` |
| `podcast_context_chars` | `42000` | context budget for scripts/artifacts |
| `podcast_length` | `medium` | default audio length (short ≈5m, medium ≈10m, long ≈18m) |
| `video_length` | `medium` | default video length (short ≈2m, medium ≈4m, long ≈7m) |
| `video_voice` / `video_voice_rate` | `en-US-AndrewNeural` / `-4%` | narrator voice + pace for videos |
| `audio_tts_concurrency` | `4` | parallel TTS segment workers |
| `audio_voice_host_a` / `audio_voice_host_b` | `en-US-AndrewNeural` / `en-US-EmmaNeural` | edge-tts voice names |

Cheap calls (source labeling, suggestions) route through the plugin's own `auxiliary.notebook` task slot — pin a model there if you want labels on a smaller/faster model.

## Storage

All state lives under `<hermes home>/plugin-data/hermes-notebook/notebooks/<id>/` — per-profile, survives plugin updates:

```
notebook.json          metadata
sources/index.json     source records (id, title, kind, labels, summary)
sources/<id>.txt       extracted text
artifacts/             generated .md / .json / .mp3 / .txt
```

## Development

```bash
python -m pytest tests/ -q          # unit tests (no Hermes host needed)
hermes plugins validate .           # manifest + registration checks
hermes plugins doctor               # discovery smoke check
```

Layout: `hermes_notebook/` — `runtime` (ctx glue), `store` (JSON persistence), `extract` (file/HTML → text), `ingest` (sources + auto-labeling), `retrieve` (BM25 chunk retrieval), `llmio` (ctx.llm wrappers), `artifacts`, `audio`, `schemas`, `tools`. `__init__.py` registers tools, `/notebook`, `hermes notebook`, the skill, and the aux task.

## License

MIT
