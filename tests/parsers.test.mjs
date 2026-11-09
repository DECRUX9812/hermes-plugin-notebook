// Pure-node tests for the document and slide PARSERS.
//
// A viewer's failures are usually parse failures, not render failures: the
// summary page looked right in a screenshot while its KPI strip was empty
// because the table header did not match. These tests import the committed
// bundle (with the SDK stubbed, exactly as the gate does) and assert what the
// parsers return, so a change to a prompt skeleton or a parser is caught
// without launching a browser.
import { createRequire } from 'node:module'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const here = dirname(fileURLToPath(import.meta.url))
const NM = process.env.NB_NODE_MODULES || join(process.env.HOME, 'Code/rigforge-plugin/node_modules')
const require = createRequire(join(NM, 'index.js'))
const esbuild = require('esbuild')

let mod
async function load() {
  if (mod) return mod
  const dir = mkdtempSync(join(here, 'tmp', 'pv-'))
  writeFileSync(join(dir, 'sdk.mjs'), `
export const ROUTES_AREA = 'routes'
export const SIDEBAR_NAV_AREA = 'sidebar.nav'
export const PALETTE_AREA = 'palette'
export const STATUSBAR_AREAS = { left: 'statusBar.left', right: 'statusBar.right' }
export const ListRow = () => null
export const ToggleRow = () => null
export const SegmentedControl = () => null
export const host = { navigate: () => {}, request: async () => ({}), composer: {} }
`)
  writeFileSync(join(dir, 'entry.mjs'), readFileSync(join(here, '../desktop/plugin.js'), 'utf8'))
  const outfile = join(dir, 'bundle.mjs')
  await esbuild.build({
    entryPoints: [join(dir, 'entry.mjs')], bundle: true, format: 'esm', outfile,
    alias: {
      '@hermes/plugin-sdk': join(dir, 'sdk.mjs'),
      react: join(NM, 'react'),
      'react/jsx-runtime': join(NM, 'react/jsx-runtime')
    },
    nodePaths: [NM], logLevel: 'error'
  })
  mod = await import('file://' + outfile)
  return mod
}

const checks = []
const ok = (name, pass, detail = '') => checks.push({ name, pass, detail })

const SUMMARY = `# NB — Summary

> **Bottom line:** six sources, $4.48B raised, no net gain yet [S2][S6].

## Key metrics

| Metric | Value | Context | Source |
|---|---|---|---|
| Raised, 12 months | $4.48B | record annual | [S2] |
| Cumulative | $14.24B | since 2021 | [S2] |
| Modules installed | 6 of 9 | by July 2026 | [S4] |

## What the sources establish

**Roadmap targets the 2030s.** DOE published a roadmap with short, medium and long term milestones [S2].

**ITER runs ahead.** Six of nine modules in place, six months early [S4].

## Consensus and disagreement

- **Agreement:** S3 and S4 report the same ITER milestone.
- **Divergence:** S2 says 28 companies; S3 says around 30.
`

const BRIEFING = `# NB — Briefing

## Decision required

Fund the materials programme or accept a slip [S2].

## Options

| Option | Upside | Bottleneck or cost | Evidence |
|---|---|---|---|
| Blanket first | fuel security | tritium data thin | [S2] |

## Risks

- [CRITICAL] Tritium supply — no breeding data — mitigation: TBR test loop in 18 months, owner: materials lead, verified by dpa log.
- [MODERATE] Funding gap — appropriated $790M vs $805.7M enacted — mitigation: bridge round, owner: CFO.
- [LOW] Schedule drift — final module mid-2027 — mitigation: float absorbed, owner: assembly lead.

## Open tensions and blind spots

- [S2] vs [S3] on the company count.
`

const LEGACY_FAQ = `# NB — FAQ

**How much does the US spend?**
$790M for fusion energy sciences. [S1]

**How much has private fusion raised?**
$4.48B in twelve months. [S2]

**What is still unsolved?**
Materials and a breeding blanket. [S2]
`

const TIERED_FAQ = `# NB — FAQ

## Foundational mechanics

### What confines the plasma?
**Yes — a magnetic field.** The tokamak holds the plasma with toroidal field coils [S3].

**Caveat:** the plasma edge is still an active research subject.

## Edge cases and bottlenecks

### What limits the frame budget?
**16 ms at 1440p.** The deferred path is GPU-bound [S2].

## Contradictions and unresolved questions

### Do the sources agree on the company count?
**No.** S2 says 28, S3 says around 30 [S2][S3].
`

const STUDY_GUIDE = `# NB — Study Guide

## Concept cards

### Magnetic confinement
**Definition:** holding fusion fuel as a plasma [S1].
**Mechanism:** toroidal field coils and a vacuum vessel [S3].
**Failure mode:** edge instabilities [S6].
**Source:** [S1][S3][S6]

### Burning plasma
**Definition:** a plasma where fusion heating dominates.
**Mechanism:** alpha particle self-heating.
**Failure mode:** disruption.

## Trap alerts

- **Novice assumption:** fusion is free energy / **What the sources show:** it is capital-intensive [S2]
`

const SLIDES = {
  title: 'Deck',
  slides: [
    { archetype: 'title_hero', title: 'Fusion is funded, not proven', bullets: ['A thesis'], citations: [2] },
    { archetype: 'executive_bluf', title: 'Three numbers decide it', stats: [{ value: '$4.48B', label: 'raised' }, { value: '6 of 9', label: 'modules' }], bullets: ['Funding is not the bottleneck'] },
    { archetype: 'problem_gap', title: 'Sliders to solvers', columns: { left: ['manual'], right: ['solver'] } },
    { archetype: 'architecture_bento', title: 'Five pillars', bullets: ['Physics — 240 Hz', 'Graph — DAG', 'Render — 16 ms'] },
    { archetype: 'process_pipeline', title: 'The chain', stages: [{ label: 'Input', detail: 'tritium' }, { label: 'Burn', detail: 'plasma' }] },
    { archetype: 'deep_dive_comparison', title: 'Options', columns: { left: ['blanket first'], right: ['materials first'] } },
    { archetype: 'tension_audit', title: 'Sources disagree', columns: { left: ['same ITER numbers'], right: ['28 vs 30 companies [S2]'] } },
    { archetype: 'roadmap', title: 'Next steps', stages: [{ label: '30 days', detail: 'TBR loop' }] },
    { archetype: 'closing', title: 'Qualification is the gate' }
  ]
}

const GRAPH = {
  title: 'Graph',
  root: 'thesis',
  nodes: [
    { id: 'thesis', label: 'Fusion is funded, not proven', node_type: 'core_thesis', key_stat: '$4.48B', summary: 'capital arrived, physics did not', citations: [2] },
    { id: 'mat', label: 'Materials', node_type: 'risk_bottleneck', citations: [2] },
    { id: 'tri', label: 'Tritium', node_type: 'tension_conflict', key_stat: '12.3 yr', citations: [6] },
    { id: 'money', label: 'Funding', node_type: 'metric_proof', key_stat: '$790M', citations: [2] }
  ],
  edges: [
    { source: 'thesis', target: 'mat', relation: 'depends on', style: 'thick_flow' },
    { source: 'thesis', target: 'money', relation: 'measures', style: 'solid' },
    { source: 'money', target: 'tri', relation: 'contradicts', style: 'dashed_tension' }
  ]
}

async function main() {
  const m = await load()

  // ------------------------------------------------------------- doc outline
  const doc = m.docOutline(SUMMARY)
  ok('summary: BLUF banner parsed', !!doc.bluf, doc.bluf.slice(0, 40))
  ok('summary: KPI strip parsed from the table', doc.kpis.length === 3, `${doc.kpis.length} rows`)
  ok('summary: KPI carries value, label and source', !!doc.kpis[0].value && !!doc.kpis[0].label && !!doc.kpis[0].source, JSON.stringify(doc.kpis[0]))
  ok('summary: sections survive', doc.sections.length >= 2, `${doc.sections.length} sections`)

  const brief = m.docOutline(BRIEFING)
  ok('briefing: no BLUF, but sections parse', brief.sections.length >= 4, `${brief.sections.length}`)

  // ---------------------------------------------------------------- risk RAG
  const risk = m.riskRow('- [CRITICAL] Tritium supply — no breeding data — mitigation: test loop.', 0, null)
  ok('briefing: a CRITICAL row renders a badge', !!risk)

  // --------------------------------------------------------------------- faq
  const legacy = m.faqParse(LEGACY_FAQ)
  ok('faq: the OLD flat form still becomes an accordion', legacy.total === 3, `${legacy.total} questions`)
  ok('faq: each flat question keeps its answer', !!legacy.tiers[0].items[0].body.join('').trim(), 'body present')

  const tiered = m.faqParse(TIERED_FAQ)
  ok('faq: the tiered skeleton becomes three tiers', tiered.tiers.length === 3, `${tiered.tiers.length} tiers`)
  ok('faq: a bolded verdict is lifted out of the body',
     !!tiered.tiers[0].items[0].verdict, JSON.stringify(tiered.tiers[0].items[0].verdict))
  ok('faq: a caveat line is recognised', !!tiered.tiers[0].items[0].caveat, tiered.tiers[0].items[0].caveat.slice(0, 30))

  // ------------------------------------------------------------- study guide
  const sg = m.studyParse(STUDY_GUIDE)
  ok('study: concept cards parsed', sg.concepts.length === 2, `${sg.concepts.length}`)
  ok('study: a card carries definition, mechanism and failure',
     !!sg.concepts[0].definition && !!sg.concepts[0].mechanism && !!sg.concepts[0].failure, JSON.stringify(sg.concepts[0]).slice(0, 120))
  ok('study: trap alerts parsed', sg.traps.length === 1, JSON.stringify(sg.traps[0]).slice(0, 60))

  // ------------------------------------------------------------------ slides
  const layouts = Object.keys(m.SLIDE_LAYOUTS)
  ok('slides: every archetype has a layout', layouts.length === 9, layouts.join(','))
  ok('slides: a title label exists for each', Object.keys(m.SLIDE_LABEL).length === 9, '')
  // each layout must survive being called with its slide
  let drew = 0
  for (const s of SLIDES.slides) {
    const fn = m.SLIDE_LAYOUTS[s.archetype]
    try {
      const out = fn(s, { onCite: null, deckTitle: 'Deck', total: SLIDES.slides.length })
      if (out) drew += 1
    } catch (e) {
      ok(`slides: ${s.archetype} throws`, false, e.message)
    }
  }
  ok('slides: all nine layouts draw without throwing', drew === 9, `${drew}/9`)

  // ---------------------------------------------------------------- mind map
  const laid = m.layoutGraph(GRAPH)
  ok('map: graph layout returns nodes and edges', laid.nodes.length === 4 && laid.edges.length === 3, `${laid.nodes.length}n/${laid.edges.length}e`)
  ok('map: node types and metric badges survive the layout',
     laid.nodes.some((n) => n.nodeType === 'risk_bottleneck') && laid.nodes.some((n) => n.stat), '')
  ok('map: a contradicting edge keeps its dashed style',
     laid.edges.some((e) => e.style === 'dashed_tension'), '')
  ok('map: layout is deterministic', m.layoutGraph(GRAPH).nodes[0].x === laid.nodes[0].x, 'same coordinates')
  // every PAIR of distinct nodes must be clear of each other, measured on their
  // own rectangles rather than on the centre points
  const overlaps = []
  for (let i = 0; i < laid.nodes.length; i += 1) {
    for (let j = i + 1; j < laid.nodes.length; j += 1) {
      const a = laid.nodes[i]
      const b = laid.nodes[j]
      const dx = Math.abs(a.x - b.x) - (a.w + b.w) / 2
      const dy = Math.abs(a.y - b.y) - (a.h + b.h) / 2
      if (dx < 12 && dy < 12) overlaps.push(`${a.id}/${b.id}`)
    }
  }
  ok('map: no two nodes overlap', overlaps.length === 0, overlaps.join(',') || 'clear')

  // ------------------------------------------------------------------ report
  let failed = 0
  for (const c of checks) {
    if (!c.pass) failed += 1
    console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? ` — ${c.detail}` : ''}`)
  }
  console.log(`\n${checks.length - failed}/${checks.length} parser checks passed`)
  if (failed) execSync('exit 1', { shell: '/bin/sh' })
}

await main()
