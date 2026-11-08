---
name: notebook-infographics
description: "Pick and drive the 16 bundled infographic looks for hermes-notebook."
version: 1.0.0
author: Ritesh Patel
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [Infographic, Notebook, Visual, Poster, Design]
    related_skills: [notebook, baoyu-infographic]
---

# Notebook Infographics

The `hermes-notebook` plugin ships a graphics library: **18 looks × 9 templates ×
3 shapes × 3 detail levels**, emitted as SVG by `hermes_notebook.gfx`. This skill is
how to choose a look and a layout, how to call it, and — when the user wants
something painted rather than typeset — how to fall back to the image model.

## When to Use

- The user asks for an infographic, poster, one-pager, "visual summary", "信息图", or
  "make this notebook into something I can share".
- A notebook already holds the facts and the user wants them laid out, not written out.
- You are choosing between looks for a specific audience (a classroom, a launch, a
  dashboard review) and want the decision to be deliberate.

Don't use for: slide decks (`notebook_generate kind=slides`), mind maps, or plain
summaries — those are their own artifact kinds.

## The pack at a glance

| id | Look | Best for | Family |
|---|---|---|---|
| `sections` | warm paper, white stat cards, one accent per card | **the default** — any topic, any audience | cards |
| `editorial` | white page, oversized numerals, hairline rules | results, milestones, before/after numbers | rows |
| `swiss` | strict columns, black type, one red rule | comparisons, methodology, "unarguable" data | rows |
| `magazine` | cream stock, serif headlines, brown accents | culture, history, interviews, long-read feel | cards |
| `bento` | rounded mosaic on cool paper, blue-led | a roundup of 4–6 parallel facts | cards |
| `blueprint` | navy grid, white hairlines, monospace | engineering, specs, architecture, systems | cards |
| `terminal` | near-black, phosphor blue, monospace | dev tools, incidents, logs, throughput | rows |
| `dashboard` | grey-white KPI tiles, bar meters | metrics, benchmarks, status readouts | kpi |
| `mission` | dark console telemetry tiles | ops, infrastructure, a fleet under load | kpi |
| `poster` | dark gradient, single accent, fact strip | a launch, an announcement, a cover | poster |
| `neon` | black-violet field, glowing accents | AI, gaming, nightlife, loud launches | poster |
| `brutalist` | hard black borders, acid-yellow highlight | manifestos, takes, pricing pages | cards |
| `retro` | cream stock, halftone dots, 70s palette | history, music, sport, nostalgia | cards |
| `risograph` | two-ink overprint, deliberately off-register | zines, research roundups, print feel | cards |
| `kraft` | taped paper cards on kraft stock | field notes, workshops, handmade briefs | cards |
| `chalkboard` | slate board, chalk white, wobbly rules | teaching, lecture summaries, study posters | rows |
| `cartoon` | sky, sun, hills, outlined figures, offset shadows | explainers, kids, anything non-specialist | feature |
| `realistic` | studio light: key, rim, horizon, grain, vignette | reports, product paint, "photographed" feel | feature |

Full palettes, geometry and decoration rules: `references/style-pack.md`.
Contact sheet: `assets/infographic-styles.png` in the plugin repo.

## How to pick (in order)

1. **Read the content type, not the topic.** Metrics → `dashboard`/`mission`. Dates or
   magnitudes → `editorial`/`swiss`. Steps or specs → `blueprint`/`terminal`. Narrative →
   `sections`/`magazine`. A single claim → `poster`/`neon`.
2. **Match the room.** Classroom → `chalkboard`. Board review → `swiss`/`dashboard`.
   Launch page → `poster`/`neon`. Internal runbook → `terminal`/`blueprint`.
3. **Vary from the last one.** If the notebook already has a `sections` infographic, the
   second one earns more attention in a different family — not a different accent.
4. **Default when unsure:** `sections`. It never looks wrong, and it is what the page
   pre-selects.

Naming: the tool accepts aliases (`dark`→poster, `cyberpunk`→neon, `swiss-grid`→swiss,
`riso`→risograph, `tech`/`schematic`→blueprint, `mono`/`console`→terminal, `kpi`→dashboard,
`ops`→mission, `chalk`→chalkboard, `paper`/`craft`→kraft). An unknown name falls back to
the default instead of failing the run.

## Layouts (9)

| template | use when the material is… |
|---|---|
| `infographic` | the default: a title, 3–6 figures, key facts, a takeaway |
| `key_figure` | one number is the story — a capacity, a cost, a single result |
| `stat_grid` | a snapshot: six comparable figures, nothing to argue |
| `timeline` | dated events, releases, a project's history |
| `comparison` | two options against each other, with optional scores |
| `process` | a sequence of steps that must be followed in order |
| `quote_card` | one sentence worth the whole frame |
| `cover` | a title-led cover for a doc, deck or share card |
| `illustration` | the art treatment itself, with a caption |

## How to call it

```python
notebook_generate(notebook="fusion-2026", kind="infographic", style="blueprint",
                  template="comparison", orientation="landscape",
                  detail="standard")
```

| argument | values |
|---|---|
| `style` | any look id or alias (`cartoon`, `realistic`, `swiss`, `cyberpunk`, `photo`, …) |
| `template` | the nine above |
| `orientation` | `landscape` (1200×900), `square` (1000×1000), `portrait` (900×1200) |
| `detail` | `concise` (3 figures/1 fact), `standard` (6/3), `detailed` (8/4) |

Programmatic use outside the tool call:

```python
from hermes_notebook import gfx
svg = gfx.render(graphic, template="key_figure", preset="realistic", detail="detailed")
html = gfx.render_html(graphic, preset="cartoon", template="cover")
gfx.to_png(graphic, "poster.png", preset="neon", scale=2)      # needs Chrome
gfx.to_png_pillow(graphic, "poster.png")                        # browser-free fallback
```
The SVG is 5–15 KB, editable, themed with `theme={"paper": …, "accent": …}`, and
carries `<title>`/`<desc>` for screen readers.

In the desktop page the Style picker sits behind the sliders icon on the Infographic
card; the choice is sent as `style`. To see what is bundled:

```bash
curl -s localhost:<gateway>/api/plugins/hermes-notebook/infographic_styles | jq '.styles[].id'
```

## Content rules (the renderer will not save you)

- **3–6 stats.** `value` is the number or short fact itself (`70%`, `£1.4bn`, `11 yrs`);
  `label` is ≤ 8 words; `detail` is optional and the layout drops it when space is tight.
- **2–4 facts.** Near-quotes from the sources with an attribution — never invented.
- **One takeaway.** One sentence; the band wraps to two lines and then shrinks type.
- Numbers must be **verbatim from the sources**. A poster that rounds "1.4bn" to "about
  1.5 billion" is a wrong poster, not a stylish one.
- Bars in the `dashboard`/`mission` families are drawn **only** when every value parses as
  a number in the same unit. If you mix houses with pounds, the bars are refused on
  purpose — do not "fix" that by rewording the unit.

## The two illustrated treatments, honestly

`cartoon` and `realistic` are **drawn**, not painted: flat shapes with 3px outlines
and a picture-book sky, or layered gradients with grain and a cyc-wall horizon. They
look illustrated; they contain no photographs. Say which you used and how it was made
— a "realistic" poster that implies photography is a claim you cannot support.

## When the user wants it illustrated

The pack typesets; it does not draw. If the ask is "make it look like a hand-drawn poster",
"claymation", "comic", "vintage science plate" — that is an image model job, not this
renderer. Load the `baoyu-infographic` skill when it is installed, or follow
`references/generative-prompts.md` here: it carries the layout × style vocabulary, the
prompt skeleton, and the rule that matters most (copy numbers verbatim into the prompt and
verify them in the returned image).

Use the deterministic pack when text fidelity matters; use the image model when the look
matters more than exact typography. Say which one you are doing and why.

## Adding a style

Styles are data, not code: add a `Style(...)` row to `hermes_notebook/igstyles.py`
(palette, `family`, `typeface`, `radius`, `decor`, `tone`), then

```bash
python3 tools/make_style_sheet.py --thumbs   # contact sheet + per-style PNGs
python3 -m pytest tests/test_igstyles.py -q  # catalog + render + tone gates
```

`family` picks the layout (`cards`, `rows`, `poster`, `kpi`); `decor` picks treatments
(`grid`, `ticks`, `hairline`, `halftone`, `tape`, `glow`, `scanlines`, `hard-border`,
`offset-shadow`, `wobble`, `overprint`). Nothing else needs editing — the page picker, the
tool enum and the API catalog all read the same list.

## Pitfalls

1. **Do not hand-tune colours for one image.** A look is a style, not a one-off; if the
   palette is wrong for the topic, pick another style.
2. **Dark families need short labels.** Contrast is enforced for numerals, not for every
   label — long muted text on a dark card is the first thing to look muddy.
3. **`rows` and `poster` show four stats; `cards` and `kpi` show six.** The meta line in
   the corner counts what is drawn, so extra stats are not silently promised.
4. **The JSON twin carries `_style`.** Read `<stamp>-infographic.json` to know which look
   produced a PNG instead of guessing from pixels.
5. **Re-render, do not patch the output.** The renderer is deterministic; a change is a
   code or preset-row change, then re-run (and `python3 tools/make_graphics_sheet.py
   --snapshots` if you changed layout on purpose).
6. **The artifact is SVG now.** If a consumer needs a raster, call `gfx.to_png` (Chrome)
   or `gfx.to_png_pillow` (fallback) — do not screenshot the page.
