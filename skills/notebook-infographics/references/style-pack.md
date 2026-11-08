# Style pack reference

Every row here is a `Style(...)` in `hermes_notebook/igstyles.py`. The renderer reads
these fields and knows nothing else, so this table *is* the behaviour.

| id | label | family | tone | typeface | radius | paper | card | ink | accents | decor |
|---|---|---|---|---|---|---|---|---|---|---|
| `sections` | Sections | cards | light | sans | 16 | #faf9f6 | #ffffff | #1f1f1f | #1a73e8 #e8710b #12877b #c5185b #7c4dff | — |
| `editorial` | Editorial | rows | light | sans | 0 | #ffffff | #ffffff | #1f1f1f | #1a73e8 | hairline |
| `poster` | Poster | poster | dark | sans | 14 | #1b1b3a | #121220 | #f4f4fa | #8b7cff | — |
| `swiss` | Swiss Grid | rows | light | sans | 0 | #ffffff | #f6f6f6 | #0b0b0b | #c1121f | hairline, ticks |
| `magazine` | Magazine | cards | light | serif | 2 | #fbf6ee | #fffdf8 | #201914 | #9b5b32 #1f3a5f | hairline |
| `bento` | Bento | cards | light | sans | 20 | #f5f8ff | #ffffff | #101828 | #2563eb #7c3aed #0891b2 #db2777 | — |
| `blueprint` | Blueprint | cards | dark | mono | 0 | #0b2545 | #102e52 | #eaf2ff | #7fb2ff #ffd166 | grid, ticks |
| `terminal` | Terminal | rows | dark | mono | 4 | #070b12 | #101826 | #e6edf6 | #38bdf8 #22c55e | scanlines |
| `neon` | Neon | poster | dark | sans | 18 | #070711 | #111126 | #f8f7ff | #c084fc #22d3ee #f472b6 | glow |
| `brutalist` | Brutalist | cards | light | sans | 0 | #f5f1e8 | #ffffff | #000000 | #ffef5a #ff8c00 | hard-border, offset-shadow |
| `retro` | Retro Print | cards | light | sans | 12 | #fff4cf | #fffaf0 | #2a1810 | #d24b1f #1f6f5c #2a4b8d | halftone, offset-shadow |
| `risograph` | Risograph | cards | light | sans | 0 | #f6f1e7 | #fbf7ef | #16223b | #1b3a8f #ff4f2e #f2c230 | overprint |
| `kraft` | Kraft | cards | light | serif | 6 | #faf3df | #fffaf0 | #211b12 | #8f5d24 #6b7a4f | tape |
| `chalkboard` | Chalkboard | rows | dark | sans | 0 | #22302a | #22302a | #eef2ea | #f2e9a0 #a9d8c0 #f0b4b4 | wobble |
| `dashboard` | Dashboard | kpi | light | sans | 14 | #f4f7fb | #ffffff | #111827 | #0ea5e9 #22c55e #f59e0b #ef4444 | — |
| `mission` | Mission Control | kpi | dark | mono | 12 | #090b12 | #121722 | #f8fafc | #60a5fa #fbbf24 #34d399 | grid, ticks |

## Where each palette came from

| id | base |
|---|---|
| `sections` | notebooklm |
| `editorial` | editorial |
| `poster` | notebooklm-dark |
| `swiss` | publication |
| `magazine` | warm-editorial |
| `bento` | bento |
| `blueprint` | technical-schematic |
| `terminal` | trading-terminal |
| `neon` | neon |
| `brutalist` | brutalism |
| `retro` | retro |
| `risograph` | riso |
| `kraft` | paper |
| `chalkboard` | chalkboard |
| `dashboard` | dashboard |
| `mission` | mission-control |

## Geometry budget (1200x900)

- margins 64px; gutter 18px; content ends 22px above the takeaway band.
- **takeaway band** is measured first: 44px padding plus up to two lines, type stepped
  down 24→18px until the sentence fits; its height is then subtracted from the content
  band, so it can never clip.
- **facts block**: 2–3 rows of up to two lines plus an optional attribution line. The
  cards family drops fact rows (3→0) rather than overlapping tiles.
- **tiles**: floor height 118px (two rows) or 150px (one row); the numeral shrinks
  62→26px until value, label and optional detail fit inside the tile.
- **rows family**: fixed label column at x=494 so every row's text starts on the same
  line; numerals up to 74px, vertically centred against the label block.
- **poster family**: up to four tiles, 200px tall, fixed 58px numeral box so labels share
  a baseline.
- **kpi family**: 2–3 columns, tiles up to 212px, bars at the tile floor.

## Decorations

| name | what it draws |
|---|---|
| `grid` | 30px graph paper across the sheet, 10–13% of paper |
| `ticks` | registration ticks in the four corners, first accent on the long arm |
| `hairline` | double rule under the title (ink + muted) |
| `halftone` | dot screen in the lower-right dead space, 60/255 alpha |
| `tape` | two translucent tape strips, rotated ±10°, over header and foot |
| `glow` | two blurred accent blooms (120px gaussian) composited at 30% |
| `scanlines` | 1-in-4px white lines at 9/255 alpha |
| `hard-border` | 8px black sheet border, 4px tile borders, black kicker slab |
| `offset-shadow` | solid ink rectangle offset (7,7) behind each tile |
| `wobble` | two-pass jittered rule for row separators |
| `overprint` | translucent second-ink blocks, off-register from the grid |

## Legibility rules the renderer enforces

- Accent ink is nudged away from the page until it clears **4.5:1** contrast
  (`_readable`), so a signature riso yellow stays in the bars but not in the numerals.
- The closing `TAKEAWAY` kicker clears **3.0:1** on the tinted band.
- KPI bars are drawn only when every value parses to a number in the **same unit**
  (`_magnitude`); a mixed set of units gets a plain rule instead of a meaningless chart.
- Typeface is per style (sans / serif / mono); the sans stack is Inter when installed,
  DejaVu otherwise, so renders are identical on a bare box.

## Families

| family | shape |
|---|---|
| `cards` | title block, 1–2 rows of 1–3 stat tiles, key-facts list, takeaway band |
| `rows` | 3–4 full-width rows: oversized numeral, label + detail, hairline separator |
| `poster` | dark gradient, one row of up to four tiles, quotable facts with dashes |
| `kpi` | 2–3 column metric grid with optional proportional bars |
