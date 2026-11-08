// Build a browser preview of the plugin page without the app.
//
// The SDK is stubbed (no app), React is real, and the *data* is real too: the
// JSON payloads come from `tests/dump_state.py` — the plugin's own router — and
// the artifact bytes are copied out of the notebook store, so the video, the
// podcast and the mind map in a screenshot are the files the product makes.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const here = dirname(fileURLToPath(import.meta.url))
const tmp = join(here, 'tmp')
mkdirSync(tmp, { recursive: true })

const NM = process.env.NB_NODE_MODULES || join(process.env.HOME, 'Code/rigforge-plugin/node_modules')
const require = createRequire(join(NM, 'index.js'))
const esbuild = require('esbuild')

/* ------------------------------------------------------------------ stub */
writeFileSync(join(tmp, 'sdk-stub.mjs'), `
export const ROUTES_AREA = 'routes'
export const SIDEBAR_NAV_AREA = 'sidebar.nav'
export const PALETTE_AREA = 'palette'
export const TRANSCRIPT_DIRECTIVE_AREA = 'transcript.directives'
export const STATUSBAR_AREAS = { left: 'statusBar.left', right: 'statusBar.right' }
export const ListRow = (p) => {
  const h = window.React && window.React.createElement
  return h('div', { style: { padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.07)' } },
    h('div', { style: { fontSize: 14, fontWeight: 600, color: 'var(--ui-text-primary)' } }, p.title || p.label),
    p.description ? h('div', { style: { fontSize: 13, color: 'var(--ui-text-tertiary)', marginTop: 2 } }, p.description) : null,
    p.action ? h('div', { style: { marginTop: 6 } }, p.action) : null)
}
export const ToggleRow = ListRow
export const SegmentedControl = (p) => {
  const h = window.React && window.React.createElement
  return h('div', { style: { display: 'flex', gap: 6 } },
    (p.items || []).map((it) => h('button', {
      key: it.value, type: 'button',
      onClick: () => p.onChange && p.onChange(it.value),
      style: { minHeight: 30, padding: '0 10px', borderRadius: 8, cursor: 'pointer',
               border: '1px solid rgba(255,255,255,.12)',
               background: p.value === it.value ? 'rgba(255,255,255,.14)' : 'transparent',
               color: 'var(--ui-text-primary)', fontSize: 13 }
    }, it.label)))
}
export const host = {
  notify: (n) => console.log('[notify]', n && n.message),
  navigate: (p) => console.log('[navigate]', p),
  openLink: (u) => console.log('[open]', u),
  request: async () => ({}),
  composer: { setDraft: async () => true, focus: () => {} }
}
`)

/* ---------------------------------------------------------------- bundle */
const files = readdirSync(join(here, '../src')).filter((f) => f.endsWith('.js')).sort()
let code = files.map((f) => readFileSync(join(here, '../src', f), 'utf8').trimEnd()).join('\n\n')
code += `\nexport { App, StudioPanel, Viewer, OpsDeck, Rail, Markdown, KIND_ICON, CSS, plugin }\n`
writeFileSync(join(tmp, 'preview.mjs'), code)

/* --------------------------------------------------------------- payloads */
const state = JSON.parse(readFileSync(join(tmp, 'state.json'), 'utf8'))
// chat threads postdate the dump — give the preview a realistic list
if (state.notebook) {
  state.notebook.threads = [
    { name: 'default', title: 'What do the sources say about funding?', count: 4, updated: '2025-11-02T10:00:00Z' },
    { name: 'chat-abc123', title: 'Compare the two architectures', count: 6, updated: '2025-11-03T09:30:00Z' }
  ]
}
const fleet = existsSync(join(tmp, 'ops-fleet.json')) ? readFileSync(join(tmp, 'ops-fleet.json'), 'utf8') : '{"hosts":[]}'
const services = existsSync(join(tmp, 'ops-services.json')) ? readFileSync(join(tmp, 'ops-services.json'), 'utf8') : '{"units":[]}'
const audit = existsSync(join(tmp, 'ops-audit.json')) ? readFileSync(join(tmp, 'ops-audit.json'), 'utf8') : '{"entries":[]}'
const exec = existsSync(join(tmp, 'ops-exec.json')) ? readFileSync(join(tmp, 'ops-exec.json'), 'utf8') : '{"ok":false,"result":{"ok":false,"out":"","err":"no captured run"}}'
writeFileSync(join(tmp, 'payloads.mjs'), `
export const STATE = ${JSON.stringify(state)}
export const FLEET = ${fleet}
export const SERVICES = ${services}
export const AUDIT = ${audit}
export const EXEC = ${exec}
`)

writeFileSync(join(tmp, 'preview-entry.mjs'), `
import React from 'react'
import { createRoot } from 'react-dom/client'
import { App, OpsDeck, plugin } from './preview.mjs'
import { STATE, FLEET, SERVICES, AUDIT, EXEC } from './payloads.mjs'

window.React = React

const store = new Map()
const b64 = async (name) => {
  const res = await fetch('/artifacts/' + encodeURIComponent(name))
  if (!res.ok) throw new Error('artifact ' + name + ' is not in the preview copy')
  const buf = new Uint8Array(await res.arrayBuffer())
  let s = ''
  for (let i = 0; i < buf.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000))
  }
  return { ok: true, name, ext: name.split('.').pop().toLowerCase(),
           mime: ({ mp4: 'video/mp4', mp3: 'audio/mpeg', png: 'image/png',
                    html: 'text/html', md: 'text/markdown', txt: 'text/plain',
                    csv: 'text/csv',
                    json: 'application/json' })[name.split('.').pop().toLowerCase()] || 'application/octet-stream',
           b64: btoa(s) }
}

// The same rest surface the page sees, answering from the dumped payloads.
const rest = async (path, opts) => {
  const clean = String(path).replace(/^\\/+/, '')
  const [route, query] = clean.split('?')
  const params = new URLSearchParams(query || '')
  // the harness renders the page as it appears with the agent half registered;
  // the dumped payload comes from a process where it is not.
  if (route === 'state') return { ...STATE, model_ready: true }
  if (route === 'health') return { ok: true, model_ready: true, data_root: STATE.notebook ? '/home/decrux/.hermes/plugin-data/hermes-notebook' : '', kinds: (STATE.kinds || []).map((k) => k.id) }
  if (route === 'artifact') {
    const name = params.get('name')
    if (params.get('b64') === '1') return b64(name)
    return (await fetch('/artifacts/' + encodeURIComponent(name))).text()
  }
  if (route === 'source_text') {
    const src = (STATE.notebook?.sources || []).find((s) => s.id === params.get('id'))
    return { ok: true, text: 'Preview harness: the source text lives in the plugin store.\\n\\n' + (src ? src.summary || src.title : '') }
  }
  if (route === 'ops/fleet') return { ...FLEET, ok: true }
  if (route === 'ops/services') return { ...SERVICES, ok: true }
  if (route === 'ops/audit') return { ...AUDIT, ok: true }
  // one captured run, replayed verbatim — real exit code, real stdout
  if (route === 'ops/exec') return { ...EXEC, ok: true }
  if (route === 'ask') {
    await new Promise((r) => setTimeout(r, 900))
    return {
      ok: true,
      answer: [
        'Two answers, and they are not the same kind of claim.',
        '',
        '**Where the machine is.** ITER lowered its sixth of nine tokamak sector modules into the pit on 28 July 2026 — a ~1,100-tonne module, a 30-hour lift, roughly six months ahead of plan, with two-thirds of the torus now in place and the ninth module scheduled for 2027 [S3] [S4].',
        '',
        '**What is still unsolved.** Three things, and none of them is a scheduling problem: neutron-resistant structural materials, a tritium breeding blanket that works at plant flux, and a supply chain qualified to build either [S2]. The CRS briefing adds the policy side: no defensible levelised cost figure exists yet, so any price per megawatt-hour you see quoted is a projection [S1].',
        '',
        'What these sources do **not** settle is first plasma. None of them dates it, and the assembly milestone is not the same event.'
      ].join(String.fromCharCode(10)),
      citations: [
        { n: 1, title: 'Toward Commercial Fusion Energy: Considerations for Congress (CRS R48866)', kind: 'url', origin: 'https://www.congress.gov/crs_external_products/R/HTML/R48866.html', id: 'crs-toward-commercial-fusion-energy' },
        { n: 2, title: 'US roadmap targets fusion deployment by mid 2030s - Reuters', kind: 'url', origin: 'https://www.reuters.com/business/energy/us-roadmap-targets-fusion-deployment-by-mid-2030s--reeii-2026-08-25/', id: 'reuters-us-fusion-roadmap-mid-2030s' },
        { n: 3, title: 'ITER reports \u201csubstantial progress\u201d in assembly and installation work', kind: 'url', origin: 'https://www.ans.org/news/2026-09-09/article-8375/', id: 'ans-iter-assembly-progress' },
        { n: 4, title: 'Two-thirds of ITER tokamak core now in place - ITER Organization', kind: 'url', origin: 'https://www.iter.org/two-thirds-iter-tokamak-core-now-place', id: 'iter-two-thirds-tokamak-core' }
      ],
      chunks_used: 12, total_chunks: 96, seconds: 4.2
    }
  }
  if (route === 'discover') {
    await new Promise((r) => setTimeout(r, 700))
    return {
      ok: true, query: 'commercial fusion',
      candidates: [
        { title: 'Fusion power — Wikipedia', url: 'https://en.wikipedia.org/wiki/Fusion_power',
          snippet: 'Fusion power is the power generated by nuclear fusion reactions, in which two light atomic nuclei fuse to form a heavier nucleus and release energy.' },
        { title: 'ITER — the world\u2019s largest tokamak', url: 'https://www.iter.org/',
          snippet: 'ITER is a large-scale scientific experiment aiming to demonstrate fusion as a large-scale, safe, clean and sustainable energy source.' },
        { title: 'The race to commercial fusion — Nature', url: 'https://www.nature.com/articles/d41586-026-00123-4',
          snippet: 'Startups and national labs are converging on high-field tokamaks and stellarators as private capital crowds into fusion.' },
        { title: 'Nuclear fusion explained — TED', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          snippet: 'A walkthrough of how a tokamak confines plasma and why net energy gain took seventy years.' },
        { title: 'FIA reports record private fusion investment', url: 'https://www.fusionindustryassociation.org/2026-report',
          snippet: 'Private fusion companies raised a record round in 2026, led by Commonwealth and TAE Systems.' }
      ]
    }
  }
  if (route === 'sources') {
    await new Promise((r) => setTimeout(r, 1400))
    const urls = ((opts && opts.body && opts.body.urls) || []).slice(0, 10)
    return {
      ok: true, added: urls.length, duplicates: 0,
      results: urls.map((u) => ({ url: u, ok: true, duplicate: false, title: u, kind: 'url', labels: ['fusion', 'energy'] })),
      state: STATE
    }
  }
  if (route === 'suggest') {
    await new Promise((r) => setTimeout(r, 800))
    return {
      ok: true, title: STATE.notebook && STATE.notebook.title,
      suggestions: {
        questions: [
          'What does the evidence say about first plasma timing?',
          'Which sources disagree on cost projections?',
          'What materials risk remains unresolved?'
        ],
        artifacts: ['summary: quick brief', 'timeline: program milestones'],
        gaps: ['No primary source on tritium breeding', 'Missing recent regulatory filings']
      }
    }
  }
  if (route === 'overview') {
    await new Promise((r) => setTimeout(r, 1100))
    return {
      ok: true, seconds: 2.1,
      overview: '**Fusion is closer than the headlines suggest.** Assembly is ahead of schedule — two-thirds of the tokamak core is in place and the module count is tracking well [S3]. The real blockers are materials and tritium breeding, not engineering [S2]. Cost figures remain projections; no defensible levelised cost exists yet [S1].'
    }
  }
  if (route === 'source_state') {
    const sid = (opts && opts.body && opts.body.source_id) || ''
    const enabled = !!(opts && opts.body && opts.body.enabled)
    for (const s of (STATE.notebook && STATE.notebook.sources) || []) {
      if (s.id === sid) s.active = enabled
    }
    return { ok: true, source_id: sid, active: enabled, state: STATE.notebook }
  }
  if (route === 'note') {
    await new Promise((r) => setTimeout(r, 500))
    return { ok: true, source: { id: 'note-mock', kind: 'note' } }
  }
  if (route === 'notebook/update') {
    const body = (opts && opts.body) || {}
    if (STATE.notebook) {
      if (body.title) STATE.notebook.title = body.title
      if (body.description !== undefined) STATE.notebook.description = body.description
    }
    return { ok: true, notebook: STATE.notebook }
  }
  if (route === 'thread') {
    const name = params.get('name') || 'default'
    const messages = name === 'chat-abc123'
      ? [
          { role: 'user', content: 'Compare the two architectures described in the sources.', ts: '2025-11-03T09:00:00Z' },
          { role: 'assistant', content: 'The sources describe two approaches [S1]. The first favors simplicity; the second trades it for throughput [S2].', ts: '2025-11-03T09:00:30Z' }
        ]
      : ((STATE.notebook && STATE.notebook.thread) || [])
    return { ok: true, thread: name, messages }
  }
  if (route === 'thread/clear') return { ok: true, thread: { cleared: 'default' } }
  if (route === 'export') {
    // stub payload — the page only base64-decodes + blob-downloads it
    return { ok: true, name: 'preview-notebook.zip', bytes: 22, files: 1,
             b64: Buffer.from('PK\x03\x04 preview export stub').toString('base64') }
  }
  if (route === 'notebook/delete') return { ok: true, deleted: (opts && opts.body && opts.body.notebook) || '' }
  if (route === 'options') {
    const body = (opts && opts.body) || {}
    if (STATE.notebook) STATE.notebook.options = { ...(STATE.notebook.options || {}), ...(body.options || {}) }
    return { ok: true, options: STATE.notebook ? STATE.notebook.options : {}, state: STATE.notebook }
  }
  if (route === 'label') {
    await new Promise((r) => setTimeout(r, 900))
    return { ok: true, labeled: [], failed: [], state: STATE }
  }
  if (route === 'video_notes') {
    await new Promise((r) => setTimeout(r, 1200))
    return {
      ok: true, title: 'Fusion, honestly', length: 'short', style: 'cinematic',
      beats: [
        { headline: 'The bet', text: 'Seventy years of plasma physics just produced a module heavier than a jumbo jet — and it slid into place ahead of schedule.', palette: 'indigo' },
        { headline: 'The math', text: 'Two-thirds of the tokamak core is assembled. The remaining sectors are the easy part; the blanket is not.', palette: 'crimson' },
        { headline: 'The catch', text: 'No defensible cost figure exists yet. Anyone quoting a price per megawatt-hour is guessing.', palette: 'amber' }
      ]
    }
  }
  if (route === 'generate') {
    await new Promise((r) => setTimeout(r, 1500))
    return { ok: true, kind: JSON.parse(opts?.body ? JSON.stringify(opts.body) : '{}').kind, artifacts: STATE.notebook?.artifacts || [] }
  }
  return { ok: true }
}

plugin.register({
  register: () => () => {},
  registerMany: () => () => {},
  registerSettingsPage: () => () => {},
  onDispose: () => () => {},
  onEvent: () => () => {},
  storage: { get: (k, d) => (store.has(k) ? store.get(k) : d), set: (k, v) => store.set(k, v), remove: (k) => store.delete(k) },
  rest,
  os: {}, i18n: {}
})
// the module-level ctx is bound by register(); expose the same door to the page
window.__nbRest = rest

const q = new URLSearchParams(location.search)
const mode = q.get('mode') || 'studio'
for (const key of ['notebook', 'mode', 'statusChip', '__open']) {
  const v = q.get(key)
  if (v) store.set(key, v)
}
store.set('mode', mode)
if (q.get('open')) store.set('__open', q.get('open'))
if (q.get('tab')) store.set('__tab', q.get('tab'))

// always the real App: ?mode=ops seeds the stored surface, which is how the
// app itself remembers the choice.
createRoot(document.getElementById('root')).render(React.createElement(App, {}))
`)

await esbuild.build({
  entryPoints: [join(tmp, 'preview-entry.mjs')],
  bundle: true,
  format: 'esm',
  outfile: join(tmp, 'preview.bundle.js'),
  jsx: 'automatic',
  loader: { '.mjs': 'js' },
  define: { 'process.env.NODE_ENV': '"production"' },
  nodePaths: [NM],
  alias: {
    '@hermes/plugin-sdk': join(tmp, 'sdk-stub.mjs'),
    react: join(NM, 'react'),
    'react/jsx-runtime': join(NM, 'react/jsx-runtime'),
    'react-dom/client': join(NM, 'react-dom/client')
  },
  logLevel: 'warning'
})

/* ------------------------------------------------------------------- page */
writeFileSync(join(tmp, 'preview.html'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Hermes Notebook — preview</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Ctext y='13' font-size='13'%3E%F0%9F%93%93%3C/text%3E%3C/svg%3E">
<style>
  /* The app injects this ramp from the theme; the harness pins the dark skin so
     a screenshot is stable, and the page itself never sets a background. */
  :root{
    --ui-base:#ececf2; --ui-accent:#8b93ff;
    --theme-mix-text-tertiary:58%; --theme-mix-text-quaternary:42%;
    --ui-text-primary:color-mix(in srgb,var(--ui-base) 94%,transparent);
    --ui-text-secondary:color-mix(in srgb,var(--ui-base) 74%,transparent);
    --ui-text-tertiary:color-mix(in srgb,var(--ui-base) 58%,transparent);
    --ui-text-quaternary:color-mix(in srgb,var(--ui-base) 42%,transparent);
    --ui-stroke-primary:color-mix(in srgb,var(--ui-accent) 24%,color-mix(in srgb,var(--ui-base) 10%,transparent));
    --ui-stroke-secondary:color-mix(in srgb,var(--ui-accent) 16%,color-mix(in srgb,var(--ui-base) 7%,transparent));
    --ui-stroke-tertiary:color-mix(in srgb,var(--ui-accent) 10%,color-mix(in srgb,var(--ui-base) 5%,transparent));
    --ui-bg-primary:color-mix(in srgb,var(--ui-accent) 4%,color-mix(in srgb,var(--ui-base) 10%,transparent));
    --ui-bg-secondary:color-mix(in srgb,var(--ui-accent) 3%,color-mix(in srgb,var(--ui-base) 7%,transparent));
    --ui-bg-tertiary:color-mix(in srgb,var(--ui-accent) 2%,color-mix(in srgb,var(--ui-base) 5%,transparent));
    --ui-bg-elevated:#15161d;
    --ui-success:#3fb950; --ui-warning:#d29922; --ui-danger:#f85149;
    --ui-cyan:#56b6c2; --ui-purple:#9e94d5;
    --ui-font-mono:ui-monospace,SFMono-Regular,Menlo,monospace;
    color-scheme:dark;
  }
  html,body{margin:0;height:100%;background:#0b0c11;overflow:hidden;
    font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
    -webkit-font-smoothing:antialiased}
  #root{height:100%}
  *{box-sizing:border-box}
</style></head>
<body><div id="root"></div>
<script type="module" src="./preview.bundle.js"></script>
</body></html>`)

console.log('preview →', join(tmp, 'preview.html'))
