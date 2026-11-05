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
    }, "required": ["question"]},
}

NOTEBOOK_GENERATE = {
    "name": "notebook_generate",
    "description": (
        "Generate a study artifact from ALL the notebook's sources and save it as "
        "a file: summary, briefing_doc, study_guide, faq, timeline (markdown), or "
        "mind_map, flashcards, quiz (structured → markdown + JSON). Returns the "
        "file path."
    ),
    "parameters": {"type": "object", "properties": {
        "notebook": _NB,
        "kind": {"type": "string",
                 "enum": ["summary", "briefing_doc", "study_guide", "faq", "timeline",
                          "mind_map", "flashcards", "quiz"]},
        "focus": {"type": "string",
                  "description": "Optional focus/topic for the artifact (e.g. 'only the pricing sections')"},
        "count_hint": {"type": "string",
                       "description": "Optional amount hint, e.g. '10 cards', 'short'"},
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
        "focus": {"type": "string", "description": "Optional episode focus"},
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
    NOTEBOOK_GENERATE, NOTEBOOK_AUDIO, NOTEBOOK_SUGGEST, NOTEBOOK_DELETE,
]
