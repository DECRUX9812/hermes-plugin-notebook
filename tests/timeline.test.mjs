// The timeline artifact is the one viewer whose output shape is decided here
// rather than in CSS: markdown rows go in, a spine of dated/phase nodes comes
// out, and the model's own commentary is dropped. These assertions run the real
// parser out of src/40-viewers.js — no rendering, no browser, no fixtures.
//
//   node tests/timeline.test.mjs
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(join(here, '..', 'src', '40-viewers.js'), 'utf8')
const start = src.indexOf('/* ------------------------------------------------------------- timeline')
const end = src.indexOf('function TimelineView(')
if (start < 0 || end < start) throw new Error('the timeline section moved — update this test')
const section = src.slice(start, end)

// the parser half of the section needs no React: evaluate it and pull the
// declarations out of the resulting scope.
const exported = new Function(`${section}
  return { tlParse, tlCiteFix, tlIsMeta, tlWhenKey, tlSRefs, TL_ROW, TL_CATS }`)
const { tlParse, tlCiteFix, tlIsMeta, tlWhenKey, tlSRefs } = exported()

const results = []
const ok = (name, pass, detail) => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

/* A dated document: one row per line, the sample the artifact prompt asks for. */
const dated = `# Sample — Timeline

_Six sources._

---

- **1971** — US fusion funding peaks in the early programme. [S1][S6]
- **April 2025** — ITER begins installing tokamak sector modules. [S4]
- **January 2025** — DOE announces $107M for six FIRE Collaboratives. [S1]
- **February 27, 2026** — CRS publishes R48866. [S1]
`
{
  const d = tlParse(dated)
  ok('dated rows become one node each', d.nodes.length === 4, `${d.nodes.length} nodes`)
  ok('the markdown title is lifted out of the body', !/Sample — Timeline/.test(d.nodes.map((n) => n.body.join(' ')).join(' ')),
     d.title)
  ok('rows are reordered chronologically', d.reordered === true &&
     d.nodes.map((n) => n.when).join(' < ') === '1971 < January 2025 < April 2025 < February 27, 2026',
     d.nodes.map((n) => n.when).join(' < '))
  ok('a dated document is not called a phase sequence', d.kind === 'dates', d.kind)
  ok('citations survive as [S#] markers',
     d.nodes.every((n) => tlSRefs(n.body.join(' ')).length > 0),
     d.nodes.map((n) => tlSRefs(n.body.join(' ')).join('')).join(' '))
}

/* The canonical pipe row: the shape artifact_prompts.py asks for. */
const piped = `# Fusion Timeline

- **2026-07-28** | Milestone | Sixth sector module lowered | Two-thirds of the torus is now in the pit [S4] | Density limit tests can start
- **2026-06-15** | Bottleneck | Tritium blanket unproven | No plant-scale breeding has been demonstrated [S2] | Nothing, this is the open problem
`
{
  const d = tlParse(piped)
  ok('pipe rows parse into five cells', d.nodes.length === 2 && !!d.nodes[0].row,
     d.nodes.map((n) => n.when).join(', '))
  const r = d.nodes[1].row
  ok('the category column lands on the node', r.category === 'Bottleneck', r.category)
  ok('the headline column is its own field', r.headline === 'Tritium blanket unproven', r.headline)
  ok('the consequence column is kept apart', /open problem/.test(r.consequence), r.consequence)
  ok('the why-it-matters column keeps its citation',
     tlSRefs(r.what).includes(2), tlSRefs(r.what).join(''))
  ok('pipe rows keep chronological order', d.nodes[0].when === '2026-07-28', d.nodes[0].when)
}

/* Meta commentary and "(Source 1)" are the two things the old viewer printed. */
{
  ok('"(Source 1)" is rewritten to a citation', tlCiteFix('x (Source 1)') === 'x [S1]', tlCiteFix('x (Source 1)'))
  ok('a source list is rewritten to several', tlCiteFix('y (Sources 1 and 4)') === 'y [S1][S4]',
     tlCiteFix('y (Sources 1 and 4)'))
  ok('the model apologising about the material is detected',
     tlIsMeta('Note: The provided source is thematic rather than chronological, so this timeline is organised as a logical progression.'),
     'thematic note')
  ok('a real content line is not mistaken for commentary',
     !tlIsMeta('April 2025 — ITER begins installing tokamak sector modules.'), 'content line')
  const d = tlParse(`# X\n\nNote: The provided source is thematic rather than chronological.\n\n- Pre-interview phase — research the company. [S1]\n- Interview phase — describe a past conflict. [S2]\n- Follow-up phase — send the note. [S1]\n`)
  ok('meta commentary is stripped from the body',
     !d.nodes.some((n) => /thematic/.test(n.body.join(' '))), `${d.sawMeta ? 'saw' : 'no'} meta`)
  ok('phase-labelled material renders as phases', d.kind === 'phases', d.kind)
}

/* Sorting keys: year-only rows summarize their year, so they sort after it. */
{
  ok('a year sorts before a month in that year', tlWhenKey('2025') > tlWhenKey('January 2025'),
     `${tlWhenKey('2025')} vs ${tlWhenKey('January 2025')}`)
  ok('a month sorts before a later month', tlWhenKey('January 2025') < tlWhenKey('April 2025'), 'jan < apr')
  ok('a phase label has no date key', tlWhenKey('Phase 2') === null, 'null')
}

/* Nothing structured enough to draw falls back to the document, not to nothing. */
{
  const d = tlParse('Just two sentences about fusion. No dates, no rows.')
  ok('unstructured input produces no nodes', d.nodes.length === 0, `${d.nodes.length}`)
}

const failed = results.filter((r) => !r.pass).length
console.log(`\n${results.length - failed}/${results.length} timeline checks passed`)
process.exit(failed ? 1 : 0)
