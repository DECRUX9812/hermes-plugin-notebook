# Generative infographics — when the look matters more than the type

The style pack in this plugin **typesets**: PIL draws exact text, so a number is never
misrendered and a label is never garbled. An image model instead **paints**, which buys
texture, illustration and hand-made character at the cost of typographic fidelity.

Use this path only when the user asks for something illustrated: "hand-drawn", "claymation",
"comic", "vintage science plate", "chalk doodles", "poster art". Use the deterministic pack
(`style=sections|editorial|...`) whenever the words and numbers must be exact.

Vocabulary below is condensed from **baoyu-infographic** by JimLiu
(https://github.com/JimLiu/baoyu-skills, MIT). Vendored here as vocabulary, not code.

## Two dimensions: layout × style

**Layout is the information structure.** Pick by the shape of the material:

| layout | use when the content is… |
|---|---|
| `linear-progression` | a timeline, process, or tutorial |
| `binary-comparison` | A vs B, before/after, pros/cons |
| `comparison-matrix` | several options × several factors |
| `hierarchical-layers` | a pyramid, priority stack, maturity level |
| `tree-branching` | categories and subcategories |
| `hub-spoke` | one central concept, related satellites |
| `structural-breakdown` | exploded view, cross-section, anatomy |
| `bento-grid` | 4–8 loosely related facts (safe default) |
| `iceberg` | visible vs hidden, surface vs cause |
| `bridge` | problem → solution |
| `funnel` | stages that filter (signup → paid) |
| `isometric-map` | a place, floor plan, spatial relation |
| `dashboard` | KPIs and gauges |
| `periodic-table` | a categorised collection of similar items |
| `comic-strip` | a sequence with beats |
| `story-mountain` | tension or plot arc |
| `jigsaw` | parts that only make sense together |
| `venn-diagram` | overlap of 2–3 sets |
| `winding-roadmap` | a journey with milestones |
| `circular-flow` | a cycle or recurring process |
| `dense-modules` | a high-density reference sheet |

**Style is the surface.** Pair it with the audience, not with the topic:

`craft-handmade`, `claymation`, `kawaii`, `storybook-watercolor`, `chalkboard`,
`cyberpunk-neon`, `bold-graphic`, `aged-academia`, `corporate-memphis`,
`technical-schematic`, `origami`, `pixel-art`, `ui-wireframe`, `subway-map`,
`ikea-manual`, `knolling`, `lego-brick`, `pop-laboratory`, `morandi-journal`,
`retro-pop-grid`, `hand-drawn-edu`.

## Mapping: this plugin's style → generative pair

| deterministic style | closest generative pair |
|---|---|
| `sections`, `bento` | `bento-grid` + `corporate-memphis` |
| `editorial`, `swiss` | `dashboard` + `ui-wireframe`, or `bento-grid` + `bold-graphic` |
| `magazine`, `kraft` | `dense-modules` + `morandi-journal` |
| `blueprint` | `structural-breakdown` + `technical-schematic` |
| `terminal` | `dashboard` + `pop-laboratory` |
| `poster`, `neon` | `hub-spoke` + `cyberpunk-neon` |
| `brutalist` | `bento-grid` + `retro-pop-grid` |
| `retro`, `risograph` | `periodic-table` + `bold-graphic` |
| `chalkboard` | `bento-grid` + `chalkboard` |
| `dashboard`, `mission` | `dashboard` + `corporate-memphis` |

## Prompt skeleton

```
An infographic poster, {ASPECT}, titled "{TITLE}".

LAYOUT — {layout id}: {one sentence describing the structure, in reading order}.
STYLE — {style id}: {one sentence on materials, palette, line quality, texture}.

CONTENT, set as legible type in the image:
- Headline: "{TITLE}"
- {N} stat blocks, each a big numeral with a short label:
  {VALUE} — {LABEL} (repeated per stat)
- Key facts ({K} short lines):
  {FACT} (repeated per fact)
- Takeaway band at the bottom: "{TAKEAWAY}"

RULES
- All numerals and percentages exactly as written above; do not round or restate.
- Text must be spelled correctly and fully inside the layout; no lorem, no gibberish.
- One concept per section; generous whitespace; no stock-photo collage.
- {palette constraint from the style sentence}
```

`{ASPECT}` maps to the image tool's own options: 16:9 → landscape, 9:16 → portrait,
1:1 → square.

## Verification (do not skip)

An image model will happily invent numbers. After generating:

1. Read the returned image and check **every numeral** against the source text.
2. Check the headline and the takeaway for dropped words or garbled glyphs.
3. If a numeral is wrong, regenerate with that number quoted at the start of the prompt —
   do not "accept and note it".
4. Tell the user which path produced the image: deterministic (exact type) or generative
   (painted, checked by eye).

## Combined workflow, when asked for both

Render the deterministic pack first — it fixes the content (stats, facts, takeaway, order).
Then feed that exact JSON into the generative prompt. That way the painted version inherits
verified numbers instead of inventing its own.
