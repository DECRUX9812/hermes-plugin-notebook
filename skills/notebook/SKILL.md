---
name: notebook
description: "Grounded research notebooks with cited Q&A and artifacts."
version: 0.1.0
author: Ritesh Patel
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [Notebook, Research, Citations, Study, Podcast]
    related_skills: [grounded-citations]
---

# Notebook Skill

Drive the `hermes-notebook` plugin: NotebookLM-style notebooks that ingest sources, answer with citations, auto-label content, generate study artifacts (including mind maps) and two-host audio overviews.

## When to Use

- The user wants a NotebookLM-style workspace: drop in files/links/text, then chat with the material.
- The user asks to "make a notebook", "study guide from these docs", "podcast about my sources", "mind map of this", or asks questions that should be answered *only* from specific documents.
- The user pastes several sources and wants synthesis, comparison, or grounded Q&A with citations.

Don't use for: general web research with no fixed source set (use `web_search`/`web_extract` directly), or one-off file reads (use `read_file`).

## Prerequisites

- The `hermes-notebook` plugin enabled (`hermes plugins list`). Its tools: `notebook_list`, `notebook_create`, `notebook_add_source`, `notebook_ask`, `notebook_search`, `notebook_note`, `notebook_refresh`, `notebook_delete_source`, `notebook_update`, `notebook_export`, `notebook_discover`, `notebook_generate`, `notebook_audio`, `notebook_video`, `notebook_suggest`, `notebook_delete`.
- Audio/video overviews need `ffmpeg` on PATH; edge-tts voices need network.
- YouTube sources need the `youtube-transcript-api` dependency (installed with the plugin).

## How to Run

Everything goes through the notebook tools — there is no shell pipeline. Typical flow:

1. `notebook_create` (or reuse an existing one from `notebook_list`).
2. `notebook_add_source` once per source — `path=`, `url=` (articles, docs, YouTube), or `text=` for pasted content. Each source is auto-labeled with topic tags and a one-line summary; report those labels to the user.
3. `notebook_ask` for questions — answers come back with `[S1]`-style citations mapped to source titles. Pass `thread=` for follow-ups so the conversation has memory.
4. `notebook_search` for "where does X say Y" lookups; `notebook_note` to pin user annotations as searchable sources.
5. `notebook_discover` when the user wants more sources on a topic — it returns candidates, then confirm before `notebook_add_source`.
6. `notebook_generate` for artifacts — `summary`, `briefing_doc`, `study_guide`, `faq`, `timeline`, `mind_map`, `flashcards` (md or `format=csv` for Anki), `quiz`, `slides` (HTML deck), `infographic` (PNG).
7. `notebook_audio`/`notebook_video` for overviews (slow: minutes — warn first; video takes `style=cinematic|explainer`).
8. `notebook_suggest` when the user is unsure what to do next; `notebook_refresh` re-pulls changed urls/files; `notebook_update` renames; `notebook_export` zips everything.

Slash shortcut: `/notebook list|new|add|sources|ask|note|search|suggest`. CLI: `hermes notebook <sub>`.

## Quick Reference

| User intent | Tool call |
|---|---|
| "set up a notebook about X" | `notebook_create` → `notebook_add_source` × N |
| "what do my sources say about Y?" | `notebook_ask` (use `thread=` for follow-ups) |
| "find where X is mentioned" | `notebook_search` |
| "remember this / add a note" | `notebook_note` |
| "find more sources on Z" | `notebook_discover` → confirm → `notebook_add_source` |
| "make a study guide / podcast / slides / video" | `notebook_generate` kind=… / `notebook_audio` / `notebook_video` |
| "what should I ask or make?" | `notebook_suggest` |
| "add this link/file/text" | `notebook_add_source` |
| "rename / export / remove a source" | `notebook_update` / `notebook_export` / `notebook_delete_source` |

## Procedure

1. Resolve which notebook the user means — `notebook_list` first; if several exist and the request is ambiguous, ask.
2. When adding sources, batch them: one `notebook_add_source` call per source, but fire them in the same turn when independent. Summarize what landed: title, kind, char count, labels.
3. For questions, prefer `notebook_ask` over reading raw source files — it retrieves the relevant chunks and cites them. Pass `source_ids` when the user scopes the question to specific sources.
4. For artifacts, pick the kind that matches intent: `study_guide`/`flashcards`/`quiz` for learning, `briefing_doc`/`timeline` for research, `mind_map` for structure/overview, `faq` for onboarding material.
5. For audio/video, set expectations (minutes, not seconds) and offer `length` short/medium/long. Video also takes `style=cinematic|explainer`. Results include media + transcript paths.
6. `notebook_discover` only SEARCHES — show candidates to the user and add only what they pick. `notebook_refresh` re-ingests a source in place (same id, fresh text + labels).

## Pitfalls

- `notebook_ask` answers ONLY from stored sources — if coverage is thin, it says so. Don't fabricate; suggest `notebook_suggest` gaps or adding sources.
- Sources cap at ~400k chars each; huge PDFs are truncated at extraction. Mention truncation if `chars` looks suspiciously round.
- `notebook_generate`/`notebook_audio` read the whole notebook digest — on very large notebooks they cost more tokens and time. Warn on notebooks with >20 sources or >500k chars.
- Audio segments synthesize via edge-tts — needs network; a TTS failure returns a clear error, not a partial file.
- Deleting is destructive: `notebook_delete` requires `confirm=true` after explicit user agreement.

## Verification

- `notebook_list` shows the notebook with expected source/artifact counts.
- `notebook_ask` responses carry `[S<n>]` citations whose titles match `notebook_list` sources.
- Generated artifacts exist at the returned `path`; audio returns `audio` + `transcript` paths and `media` for delivery.
