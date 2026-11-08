# Hermes Notebook — Design Lore

*The story the UI tells. Feed this to any model asked to design, extend, or
generate interface for this plugin — the components should read as scenes in
this story, not as generic dashboard widgets.*

## The myth

A notebook is not a folder of files. It is a **desk in a reading room** —
a quiet, well-lit surface where a researcher has spread out everything they
know about one subject. The room has three pieces of furniture:

- **The sources rail (left)** — the *research table*. Everything the researcher
  has gathered: papers, clips, pasted notes, discovered web pages. Each item
  wears a small brass citation tag (`S1`, `S2`…) like a specimen label in a
  museum drawer. Items can be set aside (unchecked) without being thrown away.
- **The chat panel (center)** — the *conversation across the desk*. A grounded
  interlocutor who may only speak from what is on the table. Every claim it
  makes carries a tag back to the exact specimen it came from — hover the tag
  and the passage itself appears; click it and the drawer opens to that
  paragraph, highlighted.
- **The studio panel (right)** — the *workbench*. From the same sources, the
  room can produce artifacts: documents, flashcard decks, slide decks, a
  podcast episode, a mind map, a data table. Each artifact is a finished
  object that can be picked up, renamed, re-versioned, or set aside.

The room is **dark by default** because research happens at night — the outer
canvas is near-black (`#0b0c0e`) so the three floating panels (`#16171a`,
24px corners, hairline white border, soft shadow) feel like lit surfaces
hovering in the dark, separated by generous gaps rather than ruled lines.

## The voice

The UI speaks in **sentence case and plain language**. It never shouts:
no monospace telemetry counters, no "12/12 READY", no uppercase chrome.
Metadata is quiet — `text-[#9aa0a6]` on `text-[#f1f3f4]` — and earns its place
by being *true*: counts that exist, states that happened, failures that are
shown with a retry rather than swallowed.

Interactive things are **pills and cards** (`#202124`, hover `#28292c`,
2xl radius, 150ms transitions) — they invite touch, not inspection. Destructive
or rare actions are icons that reveal themselves on hover, never billboarded.

## The laws

1. **Grounding is the physics of the room.** Nothing in chat or the studio may
   assert what the sources do not say. Unchecked sources are literally not in
   the room — retrieval, answers, digests, and every generator respect the
   same active set.
2. **Provenance is visible.** Citations resolve to exact passages; generation
   options are stored, displayed, prefilled, and reused. A user can always ask
   "where did this come from?" and get an answer that is a place, not a vibe.
3. **Honesty over polish.** Every failure path renders an honest error with a
   retry. Host labels say what actually spoke. If a feature can't be real
   (a provider the plugin can't reach, a model it can't pick), the UI doesn't
   pretend it can.
4. **Density without clutter.** The three panels are the whole world — no
   dashboards-of-dashboards. Depth lives behind disclosure: peek drawers,
   popovers, collapsible groups, version flip arrows.
5. **Hermes, not Gemini.** The aesthetic borrows the spatial calm of modern
   research tools, but the soul is agentic: sources can be discovered by
   describing them, artifacts can be edited and re-voiced, and the plugin
   lives inside a larger agent rather than imitating a web app.

## Tokens (the palette of the room)

| Role | Value |
|---|---|
| Canvas | `#0b0c0e` |
| Panel | `#16171a` · `rounded-24` · `border-white/6` · `shadow-2xl` |
| Card / pill | `#202124` → hover `#28292c` · `rounded-2xl` |
| Primary text | `#f1f3f4` |
| Secondary | `#9aa0a6` |
| Accent | `T.accent` (theme) — used sparingly for the one primary action |
| Danger | `T.danger` — errors and destructive confirms only |

Type: geometric sans (Plus Jakarta Sans / Inter register). Mono is allowed
*only* inside citation tags and code — never for chrome or counters.

## How to use this document

- **Designing a new surface?** Ask: which piece of furniture does it belong
  to — table, conversation, or workbench? If none, it probably doesn't belong.
- **Generating UI?** Describe the *scene* ("a drawer that opens to the exact
  cited passage"), not the widget ("a modal with text"). The lore is the spec;
  the component is its shadow.
- **Reviewing a change?** Run the five laws above. A change that breaks
  grounding, hides provenance, fakes capability, adds clutter, or drifts
  toward generic-dashboard aesthetics is wrong even if it ships.
