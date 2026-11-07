# Design system: "Filed" — the editorial-technical restyle

This page was restyled against **OpenDesign** (open-design.ai, `nexu-io/open-design`,
Apache-2.0), cloned to `/home/decrux/open-design` at `87a4f91` (v0.25.1). Its
`design-systems/` catalog holds 152 portable packages, each a `manifest.json` +
`DESIGN.md` + `tokens.css`.

Two packages were adopted, and nothing else:

| Package | What was taken | What was left behind |
| --- | --- | --- |
| `design-systems/tom-modern` | The **structure**: 0-radius geometry, hairline rules as the only dividers, mono uppercase eyebrows at `0.14–0.2em`, one accent doing all interactive work, a technical label/body split (mono for numbers and labels, sans for prose), graph-paper ground, hard offset elevation on hover | Its near-white canvas, vermillion accent, Geist font stack, and marketing compositions (hero, feature 3-card, nav bar) |
| `design-systems/atelier-zero` | The **editorial metadata**: plate numbers (`01…12`) as an index, a *filed-under* stamp line above the headline, Roman numerals for the notebook index, one accent period after the title, section rules with a right-aligned count | Its warm-paper palette, Playfair/Inter Tight pairing, collage imagery, noise overlay — all impossible to honour while the page must follow the app's own light/dark theme |

## What was deliberately not copied

- **Hex values.** Every colour resolves through the app's tokens
  (`var(--ui-text-*)`, `var(--ui-accent)`) or a `color-mix()` of them, so the page
  follows the user's theme and accent. `#0b0c11` appears exactly once, as the label
  colour on an accent-filled primary button.
- **Webfonts.** A desktop plugin can import only the SDK and React; the mono tier uses
  `var(--ui-font-mono)` and the sans tier inherits the app's font.
- **Marketing layouts.** This is a *Configure + Monitor* surface (sources in, grounded
  answers out, artifacts derived), not a landing page. No hero, no feature cards.

## The rules this page now follows

1. **Sharp geometry.** `border-radius: 0` on every panel, row, chip, tab and dialog;
   the page reads as a document/instrument, not a set of floating cards.
2. **Hairlines, not boxes.** Sections are separated by 1px rules derived from the text
   colour (19% and 11%), never by filled panels. The only filled surfaces are the
   accent primary button and the transient busy state.
3. **Mono is for numbers and labels; sans is for reading.** Plate numbers, source ids
   (`S1`), counts, timestamps, section labels and eyebrows are mono, uppercase,
   letter-spaced. Prose stays in the app's sans at 16px / 1.66.
4. **One accent, three jobs.** Interactive (primary button, active tab underline,
   focus ring), provenance (inline `[S3]` citation markers, the `S1` on a source),
   and the editorial period after the headline. Verdict colours (green/amber/red) are
   reserved for verdicts — `ready`, `model offline`, `FAIL`.
5. **An index, not a card grid.** The twelve studio outputs are grouped
   (Documents / Study / Media / Visual), numbered, and laid out as
   plate · name+blurb · status. A count per section replaces twelve identical cards,
   which was the weakest region of the previous design.
6. **The reading path carries provenance.** Inline citations are accent superscripts
   in mono; the row under an answer is labelled `CITED` and lists the sources it
   actually used, each one clickable into the source peek.

## Rebuilding / extending

- The whole stylesheet lives in `src/00-head.js` as one template literal (the bundle is
  a concatenation, not a compiled app). Add tokens to the `.nb-root` block, never hex
  values inside rules.
- `node build.mjs && node tests/make-preview.mjs` then serve `tests/tmp` — the preview
  uses the real payloads and the real artifact bytes.
- `node tests/gates.mjs` must stay green: bundle-load (both SDK generations),
  functional, a11y (32px targets, 16px body, focus rings, contrast) and layout
  (1440/1280/1180/1024/820 — no overflow, no sliced rows, breakpoints).
