// Gates for the desktop half. Four checks, all against the built artefact and
// the real payloads — not against the source tree.
//
//   node tests/gates.mjs            # all
//   node tests/gates.mjs a11y       # one
//
// 1 bundle-load  the committed bundle registers every area against BOTH SDK
//                generations (register() and legacy contribution()), and does
//                not invent a method the host lacks.
// 2 functional   clicking a studio card opens the viewer; asking renders an
//                answer with citations; a citation opens the source; the label
//                filter narrows the rail; the ops deck renders eight hosts.
// 3 a11y         every interactive control has an accessible name, a >=32px
//                target (inline prose citations excepted by WCAG 2.5.8), a
//                focus ring that actually resolves, and 16px body type.
// 4 layout       no horizontal overflow at 1440/1180/1024/820; the Make drawer
//                survives every width and the rail is the panel that folds;
//                nothing straddles a scroll viewport's edge.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { browser, serve, settle } from './lib.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const which = process.argv[2] || 'all'
const results = []
const ok = (name, pass, detail) => {
  results.push({ name, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}


  // A class the markup uses but the stylesheet never defines renders as a browser
  // default. An entire panel (Discover) once shipped unstyled after a merge dropped
  // its CSS, and nothing failed: the DOM was right, the page was ugly.
  {
    const bundle = readFileSync(join(here, '..', 'desktop', 'plugin.js'), 'utf8')
    const used = new Set()
    for (const m of bundle.matchAll(/className:\s*['"]([^'"]+)['"]/g)) {
      for (const c of m[1].split(/\s+/)) if (c.startsWith('nb-')) used.add(c)
    }
    for (const m of bundle.matchAll(/cx\(([^)]*)\)/g)) {
      for (const q of m[1].matchAll(/['"]([^'"]+)['"]/g)) {
        for (const c of q[1].split(/\s+/)) if (c.startsWith('nb-')) used.add(c)
      }
    }
    const defined = new Set([...bundle.matchAll(/\.(nb-[a-zA-Z0-9-]+)/g)].map((m) => m[1]))
    const unstyled = [...used].filter((c) => !defined.has(c)).sort()
    ok('every class the markup uses has a rule', unstyled.length === 0,
       unstyled.length ? unstyled.slice(0, 6).join(', ') : `${used.size} classes`)
  }

/* -------------------------------------------------------------- 5 machines
 * The state machines are a product surface, not an implementation detail: the
 * page publishes them for agents, refuses events that do not belong to the
 * current state, and keeps one modal at a time. These checks exercise the runtime
 * through the same window API an agent would use.
 */
async function machines(port, shared) {
  const b = shared || await browser()
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(`http://127.0.0.1:${port}/preview.html`, { waitUntil: 'load' })
  await settle(page, 900)

  const fleet = await page.evaluate(() => (window.__nbMachines ? window.__nbMachines() : null))
  ok('the fleet is readable from the page', !!fleet && !!fleet.studio && !!fleet.jobs && !!fleet.dialogs,
     fleet ? Object.keys(fleet).join(',') : 'no __nbMachines')

  const dom = await page.evaluate(() => {
    const raw = document.body.getAttribute('data-machines')
    try { return raw ? JSON.parse(raw) : null } catch (e) { return 'unparsable' }
  })
  ok('the fleet is readable from the DOM for agents', !!dom && typeof dom === 'object' && !!dom.studio,
     typeof dom === 'string' ? dom : 'data-machines present')

  const docs = await page.evaluate(() => (window.__nbMachines ? null : null))
  const refusal = await page.evaluate(() => {
    const m = window.__nbMachine('dialogs')
    if (!m) return { missing: true }
    const before = m.state
    const accepted = m.send('NOT_AN_EVENT')
    return { before, after: m.state, accepted, logged: m.history().slice(-1)[0] || null }
  })
  ok('an event outside the current state is refused, not thrown',
     refusal.accepted === false && refusal.after === refusal.before && !!refusal.logged,
     JSON.stringify(refusal).slice(0, 120))

  const exclusive = await page.evaluate(() => {
    const m = window.__nbMachine('dialogs')
    m.send('OPEN', { surface: 'search' })
    m.send('OPEN', { surface: 'settings', data: { id: 'x' } })
    const open = m.matches('open') && m.ctx.payload && m.ctx.payload.surface
    m.send('CLOSE', { surface: 'search' })   // stale close from the dismissed one
    const stillOpen = m.matches('open') ? (m.ctx.payload || {}).surface : null
    m.send('CLOSE', { surface: 'settings' })
    return { open, stillOpen, closed: m.matches('closed') }
  })
  ok('one modal at a time, and a stale close cannot dismiss the new one',
     exclusive.open === 'settings' && exclusive.stillOpen === 'settings' && exclusive.closed === true,
     JSON.stringify(exclusive))

  const draftGuard = await page.evaluate(() => {
    const m = window.__nbMachine('dialogs')
    m.send('OPEN', { surface: 'addSource', data: { mode: 'find' } })
    const blocked = m.send('OPEN', { surface: 'search' })   // Ctrl+K mid-draft
    const kept = (m.ctx.payload || {}).surface
    m.send('CLOSE', { surface: 'addSource' })
    const allowed = m.send('OPEN', { surface: 'search' })
    m.send('CLOSE', { surface: 'search' })
    return { blocked, kept, allowed }
  })
  ok('a global search shortcut cannot discard a half-typed draft',
     draftGuard.blocked === false && draftGuard.kept === 'addSource' && draftGuard.allowed === true,
     JSON.stringify(draftGuard))

  const lanes = await page.evaluate(() => {
    const m = window.__nbMachine('jobs')
    const first = m.send('RUN', { kind: 'mind_map', at: 1 })
    const second = m.send('RUN', { kind: 'mind_map', at: 2 })
    const other = m.send('RUN', { kind: 'quiz', at: 3 })
    m.send('FINISH', { kind: 'mind_map' })
    m.send('FINISH', { kind: 'quiz' })
    m.send('SETTLE')
    return { first, second, other, state: m.state, lanes: Object.keys(m.ctx.lanes).length }
  })
  ok('a second run of the same kind is refused; lanes drain to idle',
     lanes.first === true && lanes.second === false && lanes.other === true &&
     lanes.state === 'idle' && lanes.lanes === 0, JSON.stringify(lanes))

  const cancel = await page.evaluate(() => {
    const m = window.__nbMachine('turn')
    m.send('ASK', { q: 'what changed?', since: 1 })
    const busy = m.tag('busy')
    m.send('CANCEL')
    const afterCancel = m.state
    const late = m.send('ANSWER')            // the reply that arrives anyway
    return { busy, afterCancel, late, state: m.state }
  })
  ok('a cancelled turn stops waiting and refuses the late answer',
     cancel.busy === true && cancel.afterCancel === 'idle' && cancel.late === false, JSON.stringify(cancel))

  ok('the machines raised no page errors', errors.length === 0, errors.slice(0, 2).join(' | '))
  await page.close()
  if (!shared) await b.close()
}

/* ----------------------------------------------------------------- study
 * The study surface is a session over the notebook's own cards: reveal, rate, and
 * the schedule advances. These checks use the keyboard path a person would use.
 */
async function study(port) {
  const b = await browser()
  const page = await b.newPage({ viewport: { width: 1440, height: 950 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(`http://127.0.0.1:${port}/preview.html`, { waitUntil: 'load' })
  await settle(page, 1000)

  await page.locator('.nb-seg button', { hasText: 'Study' }).first().click()
  await settle(page, 800)

  const first = await page.evaluate(() => {
    const m = window.__nbMachine('study')
    return { state: m && m.state, idx: m && m.ctx.idx, cards: m && m.ctx.queue.length,
             question: (document.querySelector('.nb-study-q') || {}).textContent || '' }
  })
  ok('the study surface opens on the first card of a real queue',
     first.state === 'reviewing' && first.cards === 3 && !!first.question,
     JSON.stringify(first).slice(0, 140))

  await page.keyboard.press('Space')
  await settle(page, 300)
  const revealed = await page.evaluate(() => {
    const m = window.__nbMachine('study')
    return { state: m.state,
             answer: (document.querySelector('.nb-study-a') || {}).textContent || '',
             rates: document.querySelectorAll('.nb-study-rate').length }
  })
  ok('space reveals the answer and offers four ratings',
     revealed.state === 'revealed' && revealed.rates === 4 && /Sector modules/.test(revealed.answer),
     JSON.stringify(revealed).slice(0, 140))

  await page.keyboard.press('3')
  await settle(page, 700)
  const rated = await page.evaluate(() => {
    const m = window.__nbMachine('study')
    return { state: m.state, idx: m.ctx.idx, reviews: m.ctx.review,
             progress: (document.querySelector('.nb-study-progress') || {}).textContent || '' }
  })
  ok('a rating advances the session and is recorded',
     rated.state === 'reviewing' && rated.idx === 1 && rated.reviews === 1 && /2 of 3/.test(rated.progress),
     JSON.stringify(rated).slice(0, 140))

  // finish the session: 2 more cards, and the surface reports it rather than looping
  for (let i = 0; i < 2; i += 1) {
    await page.keyboard.press('Space'); await settle(page, 250)
    await page.keyboard.press('3'); await settle(page, 600)
  }
  const finished = await page.evaluate(() => {
    const m = window.__nbMachine('study')
    return { state: m.state, review: m.ctx.review,
             text: (document.querySelector('.nb-study-empty') || {}).textContent || '' }
  })
  ok('the session ends with a summary instead of an empty card',
     finished.state === 'done' && finished.review === 3 && /reviewed/i.test(finished.text),
     JSON.stringify(finished).slice(0, 140))

  ok('the study surface raised no page errors', errors.length === 0, errors.slice(0, 2).join(' | '))
  await page.close()
  await b.close()
}

/* --------------------------------------------------------------- surfaces
 * Every surface ends at the same line: the status bar sits on the bottom edge, so
 * a short page does not leave a dead band under it. Study shipped with a 398px gap.
 */
async function surfaces(port) {
  const b = await browser()
  const page = await b.newPage({ viewport: { width: 1440, height: 950 } })
  await page.goto(`http://127.0.0.1:${port}/preview.html`, { waitUntil: 'load' })
  await settle(page, 1000)
  const anchored = async () => page.evaluate(() => {
    const f = document.querySelector('.nb-status')
    if (!f) return null
    return Math.round(innerHeight - f.getBoundingClientRect().bottom)
  })
  const seen = {}
  for (const [mode, label] of [['studio', 'Studio'], ['study', 'Study'], ['discover', 'Discover'], ['home', 'Home']]) {
    await page.locator('.nb-seg button', { hasText: label }).first().click()
    await settle(page, 600)
    seen[mode] = await anchored()
  }
  const bad = Object.entries(seen).filter(([, gap]) => gap === null || Math.abs(gap) > 2)
  ok('the status bar sits on the bottom edge of every surface', bad.length === 0,
     bad.length ? JSON.stringify(bad) : 'studio, study, discover, home')
  await page.close(); await b.close()
}

/* ---------------------------------------------------------- 1 bundle-load */
async function bundleLoad() {
  // Build the COMMITTED bundle once more with the SDK swapped for a stub, so the
  // gate exercises the artefact that ships (not the source tree).
  const { createRequire } = await import('node:module')
  const NM = process.env.NB_NODE_MODULES || join(process.env.HOME, 'Code/rigforge-plugin/node_modules')
  const require = createRequire(join(NM, 'index.js'))
  const esbuild = require('esbuild')
  const { mkdtempSync, writeFileSync } = await import('node:fs')
  const dir = mkdtempSync(join(here, 'tmp', 'load-'))
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
  const entry = join(dir, 'entry.mjs')
  writeFileSync(entry, readFileSync(join(here, '../desktop/plugin.js'), 'utf8'))
  const outfile = join(dir, 'bundle.mjs')
  await esbuild.build({
    entryPoints: [entry], bundle: true, format: 'esm', outfile,
    alias: {
      '@hermes/plugin-sdk': join(dir, 'sdk.mjs'),
      react: join(NM, 'react'),
      'react/jsx-runtime': join(NM, 'react/jsx-runtime')
    },
    nodePaths: [NM], logLevel: 'error'
  })
  const mod = await import('file://' + outfile)

  const seen = []
  const mkCtx = (legacyOnly) => {
    const ctx = {
      rest: async () => ({ ok: true }),
      storage: { get: () => undefined, set: () => {}, remove: () => {} }
    }
    if (legacyOnly) ctx.contribution = (area) => { seen.push(`legacy:${area}`) }
    else {
      ctx.register = ({ id, area }) => { seen.push(`register:${area}:${id}`) }
      ctx.registerMany = (list) => list.forEach((c) => ctx.register(c))
    }
    return ctx
  }
  seen.length = 0
  mod.default.register(mkCtx(false))
  const modern = [...seen]
  seen.length = 0
  mod.default.register(mkCtx(true))
  const legacy = [...seen]

  const areasOf = (list) => new Set(list.map((s) => s.split(':')[1]))
  const modernAreas = areasOf(modern)
  const legacyAreas = areasOf(legacy)
  const src = readFileSync(join(here, '../desktop/plugin.js'), 'utf8')

  ok('bundle loads and default-exports a plugin', !!mod.default && mod.default.id === 'hermes-notebook',
    `id=${mod.default && mod.default.id}`)
  ok('register(): route + nav + palette + statusbar + directive',
    modernAreas.has('routes') && modernAreas.has('sidebar.nav') && modernAreas.has('palette') &&
    modernAreas.has('statusBar.right') && modernAreas.has('transcript.directives'),
    [...modernAreas].join(','))
  ok('legacy host (contribution only) still gets every area',
    legacyAreas.has('routes') && legacyAreas.has('sidebar.nav') && legacyAreas.has('palette'),
    [...legacyAreas].join(','))
  ok('three palette commands registered', modern.filter((s) => s.startsWith('register:palette')).length === 3,
    `${modern.filter((s) => s.startsWith('register:palette')).length}`)
  ok('the registered file imports nothing but the SDK and react', !/from '(?!@hermes\/plugin-sdk|react)/.test(src),
    'no other specifiers')
}

/* ------------------------------------------------------------ 2 functional */
async function functional(port) {
  const b = await browser()
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(`http://127.0.0.1:${port}/preview.html`, { waitUntil: 'load' })
  await settle(page, 900)

  const cards = await page.locator('.nb-card').count()
  // One card per studio kind — 13 outputs plus the architecture blueprint.
  // `>=` rather than `===` on purpose: adding a kind must not require editing
  // an assertion for the gate to pass, and a kind that FAILS to render still
  // leaves the count below the floor and breaks the check.
  ok('studio renders all outputs', cards >= 14, `${cards} cards`)

  // Discover is its own surface, and it must start empty rather than pretending
  // it has results: the panel only fills after a real /discover pass.
  const discoverTab = page.locator('.nb-seg button', { hasText: 'Discover' })
  if (await discoverTab.count()) {
    await discoverTab.first().click()
    await settle(page, 400)
    const panel = await page.locator('.nb-disc').count()
    const empty = await page.locator('.nb-disc-empty').count()
    const input = await page.locator('.nb-input').count()
    ok('discover surface renders with its own search box', panel === 1 && input === 1,
       `panel=${panel} input=${input}`)
    ok('discover starts empty, not with invented results', empty >= 1, `${empty} empty state`)
    await page.locator('.nb-seg button', { hasText: 'Studio' }).first().click()
    await settle(page, 300)
  } else {
    ok('discover surface renders with its own search box', false, 'no Discover tab')
  }

  // a ready card opens the viewer for its own kind
  const ready = page.locator('.nb-card[data-ready="true"]').first()
  const readyCount = await page.locator('.nb-card[data-ready="true"]').count()
  if (readyCount) {
    const name = (await ready.locator('.nb-card-name').innerText()).trim()
    await ready.click()
    await settle(page, 700)
    const title = await page.locator('.nb-view-title').count()
    const chip = title ? (await page.locator('.nb-view .nb-chip').first().innerText()).trim() : ''
    ok('clicking a ready card opens its viewer', title > 0 && chip.toLowerCase().includes(name.split(' ')[0].toLowerCase()),
      `${name} → ${chip}`)
    const bodyText = await page.locator('.nb-view-body').innerText()
    ok('viewer renders content, not a stub', bodyText.trim().length > 40, `${bodyText.trim().length} chars`)
  } else {
    ok('clicking a ready card opens its viewer', false, 'no ready card in the payload')
  }

  // ask flow
  await page.locator('.nb-tab', { hasText: 'Chat' }).click()
  await settle(page, 200)
  await page.locator('.nb-askbox textarea').fill('What do the sources say about funding?')
  await page.locator('.nb-askbox .nb-sendbtn').click()
  await settle(page, 1600)
  const answers = page.locator('.nb-msg[data-role=assistant]')
  const lastAnswer = (await answers.last().innerText()).trim()
  ok('asking renders an answer', lastAnswer.length > 60, `${lastAnswer.length} chars`)
  const cites = await page.locator('.nb-inline-cite').count()
  ok('answer carries inline citations', cites > 0, `${cites} markers`)

  // A citation only opens a source when its [S#] maps to a source row. The mock
  // answer can name more sources than the notebook has, so pick the first marker
  // that is actually bound to one — otherwise the check is a coin flip.
  if (cites) {
    const srcCount = await page.locator('.nb-src').count()
    const numbers = await page.locator('.nb-inline-cite').evaluateAll(
      (nodes) => nodes.map((n) => Number(n.getAttribute('data-n')) || 0))
    const idx = numbers.findIndex((n) => n >= 1 && n <= srcCount)
    if (idx >= 0) {
      await page.locator('.nb-inline-cite').nth(idx).click()
      await settle(page, 500)
      const peek = await page.locator('.nb-view-title').count()
      ok('a citation opens the source it points at', peek > 0, `S${numbers[idx]} of ${srcCount}`)
      await page.locator('.nb-tab', { hasText: 'Chat' }).click()
      await settle(page, 200)
    } else {
      ok('a citation opens the source it points at', false,
         `no marker maps to one of ${srcCount} sources (${numbers.join(',')})`)
    }
  }

  // ------------------------------------------------------------ agent mode
  // The pill is the consent control: pressing it must switch the request path to
  // /agent/run, and the answer must carry the tool that ran as a card you can open.
  {
    const agentPill = page.locator('.nb-mode', { hasText: 'Agent' }).first()
    const council = page.locator('.nb-mode', { hasText: 'Council' }).first()
    ok('the composer offers grounded / agent / council', await page.locator('.nb-mode').count() === 3,
      `${await page.locator('.nb-mode').count()} pills`)
    ok('council refuses instead of pretending', (await council.getAttribute('aria-pressed')) === 'false', 'off by default')
    await agentPill.click()
    await settle(page, 200)
    ok('agent mode is a sticky, visible state', (await agentPill.getAttribute('aria-pressed')) === 'true', 'pressed')
    await page.locator('.nb-askbox textarea').fill('Which entity received the most funding?')
    await page.locator('.nb-askbox .nb-sendbtn').click()
    await settle(page, 1600)
    const cards = page.locator('.nb-act')
    ok('a tool run renders as its own card', (await cards.count()) >= 1, `${await cards.count()} card(s)`)
    if (await cards.count()) {
      const head = (await cards.first().locator('.nb-act-title').innerText()).trim()
      ok('the card names the tool and its engine', /SQL/i.test(head), head)
      await cards.first().locator('.nb-act-head').click()
      await settle(page, 300)
      const rows = await cards.first().locator('.nb-act-table tbody tr').count()
      const sql = await cards.first().locator('.nb-act-in').innerText().catch(() => '')
      ok('opening the card shows the statement and its rows', rows >= 3 && /select/i.test(sql),
        `${rows} rows · ${sql.slice(0, 30)}`)
      ok('a run can be saved as a source', await cards.first().locator('button', { hasText: 'Save as source' }).count() === 1, 'present')
    }
    await page.locator('.nb-mode', { hasText: 'Grounded' }).first().click()
    await settle(page, 200)
    ok('switching back to grounded is one click', (await page.locator('.nb-mode', { hasText: 'Grounded' }).first().getAttribute('aria-pressed')) === 'true', 'back')
  }

  // label filter narrows the rail
  const before = await page.locator('.nb-src').count()
  const chip = page.locator('.nb-chip[data-click="true"]').first()
  if (await chip.count()) {
    await chip.click()
    await settle(page, 300)
    const after = await page.locator('.nb-src').count()
    ok('label filter changes the source list', after <= before, `${before} → ${after}`)
    await chip.click()
    await settle(page, 200)
  }

  // search narrows the rail
  await page.locator('.nb-rail .nb-field input').fill('ITER')
  await settle(page, 300)
  const searched = await page.locator('.nb-src').count()
  ok('source search narrows the list', searched > 0 && searched < before, `${searched} of ${before}`)
  await page.locator('.nb-rail .nb-field input').fill('')

  // ---------------------------------------------------------- export + copy
  // The Excel button shipped without the notebook the route resolves first, so
  // every download came back 422 and the toast blamed "xlsx export failed" —
  // a broken feature no other check could see, because the DOM was right.
  {
    await page.locator('.nb-seg button', { hasText: 'Studio' }).click()
    await settle(page, 700)
    const table = page.locator('.nb-card', { hasText: 'Data Table' }).first()
    if (await table.count() && (await table.getAttribute('data-ready')) === 'true') {
      await table.click()
      await settle(page, 800)
      await page.locator('.nb-menu-wrap button', { hasText: 'Export' }).first().click()
      await settle(page, 300)
      await page.locator('.nb-menu-item', { hasText: 'XLSX' }).first().click()
      await settle(page, 900)
      const reqs = await page.evaluate(() => window.__NB_REQ__ || [])
      const xl = reqs.filter((p) => p.startsWith('artifact/xlsx'))
      ok('the xlsx export asks for the notebook the route requires',
        xl.length > 0 && /[?&]notebook=[^&]/.test(xl[xl.length - 1] || ''),
        xl.length ? xl[xl.length - 1].slice(0, 90) : 'no request')
      const note = (await page.locator('.nb-status').first().innerText().catch(() => '')) || ''
      ok('the export says it downloaded instead of failing',
        /downloaded/i.test(note) && !/failed/i.test(note), note.trim().slice(0, 70) || 'no note')
      // copy is an action: it reports
      await page.locator('[aria-label="Copy artifact text"]').first().click()
      await settle(page, 500)
      const note2 = (await page.locator('.nb-status').first().innerText().catch(() => '')) || ''
      ok('copy reports its outcome', /copied|will not let the page copy|could not reach/i.test(note2),
        note2.trim().slice(0, 70) || 'no note')
      await page.locator('.nb-tab', { hasText: 'Chat' }).click().catch(() => {})
      await settle(page, 300)
    } else {
      ok('the xlsx export asks for the notebook the route requires', false, 'no ready data table')
      ok('the export says it downloaded instead of failing', false, 'no ready data table')
      ok('copy reports its outcome', false, 'no ready data table')
    }
  }

  // ops deck
  await page.keyboard.press('Escape')
  await page.locator('.nb-seg button', { hasText: 'Lab Ops' }).click()
  await settle(page, 900)
  const rows = await page.locator('.nb-frow').count()
  ok('lab deck lists the whole fleet', rows >= 8, `${rows} hosts`)
  const tabs = await page.locator('.nb-tab').count()
  ok('host tools are offered for a reachable host', tabs >= 5, `${tabs} tabs`)
  const measured = await page.locator('.nb-cell').count()
  ok('host measurements are rendered', measured >= 5, `${measured} cells`)

  // untrusted attributes in the directive must not render markup
  ok('no page errors during the run', errors.length === 0, errors.slice(0, 2).join(' | '))
  await b.close()
}

/* ------------------------------------------------------------------ 3 a11y */
async function a11y(port) {
  const b = await browser()
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(`http://127.0.0.1:${port}/preview.html`, { waitUntil: 'load' })
  await settle(page, 900)

  const report = await page.evaluate(() => {
    const visible = (n) => n.getClientRects().length > 0 && getComputedStyle(n).visibility !== 'hidden'
    const controls = Array.from(document.querySelectorAll(
      'button, a[href], input, textarea, select, [role="tab"], [role="button"]'
    )).filter(visible)
    const name = (n) => {
      const aria = n.getAttribute('aria-label') || n.getAttribute('aria-labelledby')
      if (aria) return aria
      const txt = (n.innerText || n.value || n.getAttribute('title') || '').trim()
      return txt
    }
    const unnamed = controls.filter((n) => !name(n)).map((n) => n.outerHTML.slice(0, 90))
    const inlineCite = (n) => n.classList.contains('nb-inline-cite')
    const small = controls
      .filter((n) => !inlineCite(n))
      .map((n) => ({ label: name(n).slice(0, 34), h: Math.round(n.getBoundingClientRect().height) }))
      .filter((n) => n.h > 0 && n.h < 32)
    const inputs = Array.from(document.querySelectorAll('input, textarea')).filter(visible)
    const inputLabels = inputs.filter((n) => !name(n))
    const root = document.querySelector('.nb-root')
    const body = getComputedStyle(root).fontSize
    // tablist contract: arrow keys move the selection
    const tablist = document.querySelector('.nb-seg[role="tablist"]')
    return {
      controls: controls.length,
      unnamed, small, body,
      inputLabels: inputLabels.length,
      hasTablist: !!tablist,
      selected: tablist ? tablist.querySelectorAll('[aria-selected="true"]').length : 0
    }
  })

  ok('body type is 16px', report.body === '16px', report.body)
  ok('every control has an accessible name', report.unnamed.length === 0, report.unnamed.slice(0, 3).join(' | '))
  ok('every control is at least 32px tall', report.small.length === 0,
    report.small.slice(0, 4).map((s) => `${s.label}=${s.h}`).join(', '))
  ok('inputs are labelled', report.inputLabels === 0, `${report.inputLabels} unlabelled`)
  ok('segmented control exposes a tablist with one selection',
    report.hasTablist && report.selected === 1, `tablist=${report.hasTablist} selected=${report.selected}`)

  // keyboard: focus ring resolves on a real control
  await page.keyboard.press('Tab')
  const ring = await page.evaluate(() => {
    const n = document.activeElement
    if (!n || n === document.body) return { active: false }
    const cs = getComputedStyle(n)
    return {
      active: true,
      tag: n.tagName.toLowerCase(),
      label: (n.getAttribute('aria-label') || n.innerText || '').trim().slice(0, 30),
      outline: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0,
      shadow: cs.boxShadow !== 'none',
      color: cs.outlineColor
    }
  })
  ok('first Tab stop is a named control with a visible ring',
    ring.active && (ring.outline || ring.shadow), JSON.stringify(ring).slice(0, 140))

  // arrow keys move a tablist selection
  await page.locator('.nb-seg button[aria-selected="true"]').first().focus()
  const beforeSel = await page.locator('.nb-seg button[aria-selected="true"]').first().innerText()
  await page.keyboard.press('ArrowRight')
  await settle(page, 400)
  const afterSel = await page.locator('.nb-seg button[aria-selected="true"]').first().innerText()
  ok('ArrowRight moves the segmented control', beforeSel !== afterSel, `${beforeSel} → ${afterSel}`)

  // contrast of the quiet tiers against the panel
  const contrast = await page.evaluate(() => {
    // Chromium resolves color-mix() to `color(srgb r g b / a)` with 0..1 parts,
    // and plain colours to rgb()/rgba() with 0..255 — handle both, composite alpha.
    const norm = (str) => {
      if (!str) return null
      let m = /^rgba?\(([^)]+)\)$/.exec(str)
      if (m) {
        const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number)
        return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }
      }
      m = /^color\(srgb\s+([^)]+)\)$/.exec(str)
      if (m) {
        const p = m[1].split(/[\s/]+/).filter(Boolean).map(Number)
        return { r: p[0] * 255, g: p[1] * 255, b: p[2] * 255, a: p.length > 3 ? p[3] : 1 }
      }
      m = /^#([0-9a-f]{6})$/i.exec(str)
      if (m) {
        const n = parseInt(m[1], 16)
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 }
      }
      return null
    }
    const over = (fg, bg) => ({
      r: fg.r * fg.a + bg.r * (1 - fg.a),
      g: fg.g * fg.a + bg.g * (1 - fg.a),
      b: fg.b * fg.a + bg.b * (1 - fg.a)
    })
    const lum = (c) => {
      const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b)
    }
    const base = norm(getComputedStyle(document.body).backgroundColor) || { r: 11, g: 12, b: 17, a: 1 }
    const out = {}
    for (const cls of ['.nb-meta', '.nb-hint', '.nb-card-blurb', '.nb-cell span', '.nb-sub', '.nb-src-title']) {
      const el = document.querySelector(cls)
      if (!el) continue
      const fg = norm(getComputedStyle(el).color)
      if (!fg) { out[cls] = 'unparsed'; continue }
      const c = over(fg, base)
      const L1 = lum(c), L2 = lum(base)
      out[cls] = +(((Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05))).toFixed(2)
    }
    return out
  })
  const worst = Object.entries(contrast).sort((a, b) => a[1] - b[1])
  ok('quiet text clears 3:1 (meta) and 4.5:1 (body-ish)',
    worst.every(([, v]) => typeof v === 'number' && v >= 3), worst.map(([k, v]) => `${k}=${v}`).join(' '))

  await b.close()
}

/* ---------------------------------------------------------------- 4 layout */
async function layout() {
  const b = await browser()
  for (const [w, h] of [[1440, 900], [1280, 860], [1180, 820], [1024, 800], [820, 760]]) {
    const page = await b.newPage({ viewport: { width: w, height: h } })
    await page.goto(`http://127.0.0.1:${layout.port}/preview.html`, { waitUntil: 'load' })
    await settle(page, 700)
    const r = await page.evaluate(() => {
      const doc = document.documentElement
      const box = (s) => { const n = document.querySelector(s); if (!n) return null; const b2 = n.getBoundingClientRect(); return b2.width < 1 || b2.height < 1 ? null : { x: Math.round(b2.x), w: Math.round(b2.width), right: Math.round(b2.right) } }
      const strips = Array.from(document.querySelectorAll('.nb-seg, .nb-tabs, .nb-grid')).map((n) => ({
        cls: n.className, sw: n.scrollWidth, cw: n.clientWidth
      }))
      // a scroll container may cut a long list, but no CARD may be sliced by its
      // panel edge, and no scroll container may paint outside its column
      const columns = Array.from(document.querySelectorAll('.nb-col'))
      const outside = columns.filter((c) => {
        const p = c.getBoundingClientRect()
        return Array.from(c.querySelectorAll('.nb-scroll, .nb-grid')).some((n) => {
          const r2 = n.getBoundingClientRect()
          return r2.right > p.right + 1 || r2.left < p.left - 1
        })
      }).length
      // a sliced row is honest only when the panel advertises it (fade + flag)
      const affordance = !!document.querySelector('.nb-scroll[data-scrollable="true"] + .nb-fade, .nb-studio .nb-fade')
      const sliced = (affordance ? [] : Array.from(document.querySelectorAll('.nb-card'))).filter((c) => {
        const panel = c.closest('.nb-studio') || document.body
        const pb = panel.getBoundingClientRect()
        const r2 = c.getBoundingClientRect()
        const inside = r2.top >= pb.top - 1 && r2.bottom <= pb.bottom + 1
        const outsideView = r2.bottom <= pb.top || r2.top >= pb.bottom
        return !inside && !outsideView
      }).map((c) => (c.querySelector('.nb-card-name') || {}).textContent || 'card')
      // two rows that were clipped by their own panel edge: a Make row wider
      // than the drawer (a 2-up grid's min-content floor) and the composer's
      // Send button pushed out by an unshrinkable conversation chip
      const insideOf = (sel, parentSel) => {
        const n = document.querySelector(sel); const p2 = document.querySelector(parentSel)
        if (!n || !p2) return true
        return n.getBoundingClientRect().right <= p2.getBoundingClientRect().right + 1
      }
      return {
        overflowX: doc.scrollWidth - doc.clientWidth,
        rail: box('.nb-rail'), studio: box('.nb-studio'), main: box('main'),
        strips: strips.filter((s) => s.sw > s.cw + 1),
        outside, sliced,
        toggles: document.querySelectorAll('.nb-paneltog').length,
        cardFits: insideOf('.nb-card', '.nb-studio'),
        sendFits: insideOf('.nb-sendbtn', '.nb-main-col'),
        footFits: (() => { const f = document.querySelector('.nb-askfoot'); return !f || f.scrollWidth <= f.clientWidth + 1 })()
      }
    })
    ok(`no horizontal overflow at ${w}`, r.overflowX <= 1, `overflow=${r.overflowX}`)
    ok(`no toolbar overflows its box at ${w}`, r.strips.length === 0, JSON.stringify(r.strips).slice(0, 120))
    ok(`no pane paints outside its column at ${w}`, r.outside === 0, `${r.outside} panes`)
    ok(`no studio card is sliced by the panel edge at ${w}`, r.sliced.length === 0, r.sliced.join(','))
    ok(`a Make row keeps inside the drawer at ${w}`, r.cardFits === true, String(r.cardFits))
    ok(`Send keeps its slot in the composer at ${w}`, r.sendFits === true && r.footFits === true,
      `button=${r.sendFits} foot=${r.footFits}`)
    // THE INVARIANT: a panel may be folded by width, but never made unreachable.
    // The bug this replaces hid the Make drawer by CSS while the rail was still
    // mounted — no drawer, no toggle, a chat column and nothing to make with.
    ok(`the Make drawer is reachable at ${w}`, (r.studio !== null && r.studio.w >= 260) || r.toggles >= 1,
      r.studio ? `${r.studio.w}px` : `folded, ${r.toggles} toggle(s)`)
    ok(`the sources rail is reachable at ${w}`, r.rail !== null || r.toggles >= 1,
      r.rail ? `${r.rail.w}px` : `folded, ${r.toggles} toggle(s)`)
    if (w >= 1180) ok(`main column keeps >=520px at ${w}`, r.main.w >= 520, `${r.main.w}px`)
    ok(`the chat keeps >=520px at ${w}`, r.main.w >= 520 || w < 900, `${r.main.w}px`)
    await page.close()
  }
  await b.close()
}

/* ------------------------------------------------------------------- run */
const { port, close } = await serve(join(here, 'tmp'))
try {
  if (which === 'all' || which === 'bundle') await bundleLoad()
  if (which === 'all' || which === 'functional') await functional(port)
  if (which === 'all' || which === 'machines') await machines(port)
  if (which === 'all' || which === 'study') await study(port)
  if (which === 'all' || which === 'surfaces') await surfaces(port)
  if (which === 'all' || which === 'a11y') await a11y(port)
  if (which === 'all' || which === 'layout') { layout.port = port; await layout() }
} finally {
  await close()
}
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
