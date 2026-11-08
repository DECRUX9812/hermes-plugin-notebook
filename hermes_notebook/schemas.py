"""Tool schemas — what the model sees. Kept tight: every schema rides on every
API call while the toolset is enabled."""

from __future__ import annotations

_NB = {
    "type": "string",
    "description": "Notebook id or title (from notebook_list). Optional when only one notebook exists or default_notebook is set.",
}

NOTEBOOK_LIST = {
    "name": "notebook_list",
    "description": (
        "List Hermes notebooks (source collections) with source/artifact counts, "
        "or list the sources inside one notebook when 'notebook' is given."
    ),
    "parameters": {"type": "object", "properties": {
        "notebook": _NB,
        "include_text": {"type": "boolean",
                         "description": "Include each source's extracted text (large — only when needed)."},
    }},
}

NOTEBOOK_CREATE = {
    "name": "notebook_create",
    "description": (
        "Create a new notebook — a named collection of sources for grounded Q&A, "
        "study artifacts and audio overviews (NotebookLM-style)."
    ),
    "parameters": {"type": "object", "properties": {
        "title": {"type": "string", "description": "Notebook title, e.g. 'Q3 Earnings Analysis'"},
        "description": {"type": "string", "description": "Optional one-line description of what the notebook is for"},
    }, "required": ["title"]},
}

NOTEBOOK_ADD_SOURCE = {
    "name": "notebook_add_source",
    "description": (
        "Add ONE source to a notebook. Exactly one of path/url/text: 'path' for a "
        "local file (pdf, docx, pptx, xlsx, epub, ipynb, txt/md/code, images — "
        "images are described by vision), 'url' for a web page or YouTube video "
        "(transcript), 'text' for pasted content. Sources are auto-labeled with "
        "topic tags. Call once per source."
    ),
    "parameters": {"type": "object", "properties": {
        "notebook": _NB,
        "path": {"type": "string", "description": "Absolute or relative path to a local file"},
        "url": {"type": "string", "description": "http(s) URL — article, docs page, or YouTube video"},
        "text": {"type": "string", "description": "Pasted text/notes to store as a source"},
        "title": {"type": "string", "description": "Optional display title (derived automatically when omitted)"},
    }},
}

NOTEBOOK_ASK = {
    "name": "notebook_ask",
    "description": (
        "Ask a question answered ONLY from the notebook's sources, with citations "
        "([S1], [S2]… mapped to source titles). Use for any question about the "
        "material in a notebook — summaries on demand, explanations, comparisons, "
        "lookups. Says so when the sources don't cover the answer."
    ),
    "parameters": {"type": "object", "properties": {
        "notebook": _NB,
        "question": {"type": "string", "description": "The question to answer from the sources"},
        "source_ids": {"type": "array", "items": {"type": "string"},
                       "description": "Optional: restrict to these source ids (from notebook_list)"},
        "max_chars": {"type": "integer",
                      "description": "Optional context budget override (default ~28000 chars)"},
        "thread": {"type": "string",
                   "description": "Optional conversation thread name — prior Q&A in this thread is included as context (NotebookLM chat history). Omit for stateless ask."},
    }, "required": ["question"]},
}

NOTEBOOK_GENERATE = {
    "name": "notebook_generate",
    "description": (
        "Generate a study artifact from ALL the notebook's sources and save it as "
        "a file: summary, briefing_doc, study_guide, faq, timeline (markdown), or "
        "mind_map, flashcards, quiz, slides, data_table, or infographic (a "
        "1200x900 PNG poster in one of 16 bundled looks). Returns the file path."
    ),
    "parameters": {"type": "object", "properties": {
        "notebook": _NB,
        "kind": {"type": "string",
                 "enum": ["summary", "briefing_doc", "study_guide", "faq", "timeline",
                          "mind_map", "flashcards", "quiz", "slides", "infographic",
                          "data_table"]},
        "focus": {"type": "string",
                  "description": "Optional focus/topic for the artifact (e.g. 'only the pricing sections')"},
        "count_hint": {"type": "string",
                       "description": "Optional amount hint, e.g. '10 cards', 'short'"},
        "format": {"type": "string", "enum": ["md", "csv"],
                   "description": "flashcards only: 'csv' writes an Anki-importable CSV instead of markdown"},
        "style": {"type": "string",
                  "enum": ["sections", "editorial", "poster", "swiss", "magazine",
                           "bento", "blueprint", "terminal", "neon", "brutalist",
                           "retro", "risograph", "kraft", "chalkboard", "dashboard",
                           "mission"],
                  "description": ("infographic only: which bundled look to draw. "
                                  "sections (default, warm cards), editorial (huge "
                                  "numerals), poster (dark cover), swiss (strict red "
                                  "grid), magazine (cream serif), bento (rounded "
                                  "mosaic), blueprint (navy technical grid), terminal "
                                  "(mono on black), neon (glow), brutalist (hard "
                                  "black borders), retro (halftone), risograph "
                                  "(overprint), kraft (taped paper), chalkboard "
                                  "(slate board), dashboard / mission (KPI tiles).")},
    }, "required": ["kind"]},
}

NOTEBOOK_AUDIO = {
    "name": "notebook_audio",
    "description": (
        "Generate an AUDIO OVERVIEW — a two-host conversational podcast about the "
        "notebook's sources (the signature NotebookLM feature). Writes an mp3 + "
        "speaker-labeled transcript. Takes 1-4 minutes; warn the user it runs "
        "long. Use for 'make a podcast/audio overview about my notebook'."
    ),
    "parameters": {"type": "object", "properties": {
        "notebook": _NB,
        "length": {"type": "string", "enum": ["short", "medium", "long"],
                   "description": "short ≈5min, medium ≈10min (default), long ≈18min"},
        "format": {"type": "string",
                   "enum": ["deep_dive", "brief", "critique", "debate"],
                   "description": "deep_dive = two-host conversation (default); "
                                  "brief = single narrator, tight summary; "
                                  "critique = critical review of the sources; "
                                  "debate = two hosts argue pro/con grounded in sources"},
        "language": {"type": "string",
                     "description": "Optional language for the script (e.g. 'Spanish')"},
        "focus": {"type": "string", "description": "Optional episode focus"},
    }},
}

NOTEBOOK_VIDEO = {
    "name": "notebook_video",
    "description": (
        "Generate a VIDEO OVERVIEW — a cinematic narrated mp4 about the "
        "notebook's sources (NotebookLM's video feature): single-narrator "
        "documentary script, per-beat title cards in rotating color themes, "
        "edge-tts voice + ffmpeg assembly. Writes .mp4 + transcript + script. "
        "Takes 2-5 minutes; warn the user it runs long."
    ),
    "parameters": {"type": "object", "properties": {
        "notebook": _NB,
        "length": {"type": "string", "enum": ["short", "medium", "long"],
                   "description": "short ≈2min, medium ≈4min (default), long ≈7min"},
        "focus": {"type": "string", "description": "Optional video focus"},
        "style": {"type": "string", "enum": ["cinematic", "explainer"],
                  "description": "cinematic = documentary narration (default); explainer = punchy tech-explainer pacing + brighter cards"},
    }},
}

NOTEBOOK_SUGGEST = {
    "name": "notebook_suggest",
    "description": (
        "Get NotebookLM-style suggestions for a notebook: questions worth asking, "
        "artifacts worth generating, and gaps in the sources. Use when the user "
        "asks 'what can I do with this notebook' or seems unsure."
    ),
    "parameters": {"type": "object", "properties": {
        "notebook": _NB,
        "kinds": {"type": "array", "items": {"type": "string"},
                  "description": "Optional artifact kinds to consider (default all)"},
    }},
}

NOTEBOOK_SEARCH = {
    "name": "notebook_search",
    "description": (
        "Full-text SEARCH inside a notebook's sources — ranked hits with "
        "snippets and source titles (BM25, deterministic, no LLM). Use to find "
        "where something is discussed before asking a question, or to quote "
        "exact passages."
    ),
    "parameters": {"type": "object", "properties": {
        "notebook": _NB,
        "query": {"type": "string", "description": "Search query — keywords work best"},
        "top_k": {"type": "integer", "description": "Max hits (default 8)"},
    }, "required": ["query"]},
}

NOTEBOOK_NOTE = {
    "name": "notebook_note",
    "description": (
        "Add a USER NOTE to a notebook — your own words become a first-class "
        "source (kind 'note') that ask/search/generate/audio all see, exactly "
        "like NotebookLM's note-taking. Use for annotations, reminders, or "
        "context the sources lack."
    ),
    "parameters": {"type": "object", "properties": {
        "notebook": _NB,
        "text": {"type": "string", "description": "The note content"},
        "title": {"type": "string", "description": "Optional note title"},
    }, "required": ["text"]},
}

NOTEBOOK_REFRESH = {
    "name": "notebook_refresh",
    "description": (
        "Re-fetch a URL/file source in place — picks up page edits or file "
        "changes, updates text + labels + summary while keeping the source id "
        "(citations stay stable). Notes and pasted text can't be refreshed."
    ),
    "parameters": {"type": "object", "properties": {
        "notebook": _NB,
        "source_id": {"type": "string", "description": "Source id from notebook_list"},
    }, "required": ["source_id"]},
}

NOTEBOOK_DELETE_SOURCE = {
    "name": "notebook_delete_source",
    "description": (
        "Remove ONE source from a notebook (its text + index entry). Use when a "
        "source is wrong, duplicated, or no longer wanted — the rest of the "
        "notebook is untouched."
    ),
    "parameters": {"type": "object", "properties": {
        "notebook": _NB,
        "source_id": {"type": "string", "description": "Source id from notebook_list"},
    }, "required": ["source_id"]},
}

NOTEBOOK_UPDATE = {
    "name": "notebook_update",
    "description": (
        "Rename a notebook or change its description. Provide only the fields "
        "you want to change."
    ),
    "parameters": {"type": "object", "properties": {
        "notebook": _NB,
        "title": {"type": "string", "description": "New title"},
        "description": {"type": "string", "description": "New description"},
    }},
}

NOTEBOOK_EXPORT = {
    "name": "notebook_export",
    "description": (
        "Export a whole notebook — sources, artifacts, chat threads, metadata — "
        "as a single zip under the plugin data dir. Returns the zip path."
    ),
    "parameters": {"type": "object", "properties": {"notebook": _NB}},
}

NOTEBOOK_DISCOVER = {
    "name": "notebook_discover",
    "description": (
        "DISCOVER candidate web sources for a notebook — runs a web search on "
        "the notebook's topic and returns ranked titles/URLs/snippets the user "
        "can then add with notebook_add_source. Fills NotebookLM's 'discover "
        "sources' gap. Does NOT add anything itself."
    ),
    "parameters": {"type": "object", "properties": {
        "notebook": _NB,
        "query": {"type": "string",
                  "description": "Optional search query — defaults to notebook title + description"},
        "max_results": {"type": "integer", "description": "Default 6, max 10"},
    }},
}

NOTEBOOK_DELETE = {
    "name": "notebook_delete",
    "description": (
        "Permanently delete a notebook and all its sources/artifacts. Destructive — "
        "requires confirm=true after the user agrees."
    ),
    "parameters": {"type": "object", "properties": {
        "notebook": _NB,
        "confirm": {"type": "boolean", "description": "Must be true to actually delete"},
    }, "required": ["confirm"]},
}

ALL = [
    NOTEBOOK_LIST, NOTEBOOK_CREATE, NOTEBOOK_ADD_SOURCE, NOTEBOOK_ASK,
    NOTEBOOK_GENERATE, NOTEBOOK_AUDIO, NOTEBOOK_VIDEO, NOTEBOOK_SUGGEST,
    NOTEBOOK_SEARCH, NOTEBOOK_NOTE, NOTEBOOK_REFRESH, NOTEBOOK_DELETE_SOURCE,
    NOTEBOOK_UPDATE, NOTEBOOK_EXPORT, NOTEBOOK_DISCOVER, NOTEBOOK_DELETE,
]
