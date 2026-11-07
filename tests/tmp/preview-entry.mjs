
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
                    json: 'application/json' })[name.split('.').pop().toLowerCase()] || 'application/octet-stream',
           b64: btoa(s) }
}

// The same rest surface the page sees, answering from the dumped payloads.
const rest = async (path, opts) => {
  const clean = String(path).replace(/^\/+/, '')
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
    return { ok: true, text: 'Preview harness: the source text lives in the plugin store.\n\n' + (src ? src.summary || src.title : '') }
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
        { n: 3, title: 'ITER reports “substantial progress” in assembly and installation work', kind: 'url', origin: 'https://www.ans.org/news/2026-09-09/article-8375/', id: 'ans-iter-assembly-progress' },
        { n: 4, title: 'Two-thirds of ITER tokamak core now in place - ITER Organization', kind: 'url', origin: 'https://www.iter.org/two-thirds-iter-tokamak-core-now-place', id: 'iter-two-thirds-tokamak-core' }
      ],
      chunks_used: 12, total_chunks: 96, seconds: 4.2
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
if (q.get('open')) store.set('__open', q.get('open'))
if (q.get('tab')) store.set('__tab', q.get('tab'))

// always the real App: ?mode=ops seeds the stored surface, which is how the
// app itself remembers the choice.
createRoot(document.getElementById('root')).render(React.createElement(App, {}))
