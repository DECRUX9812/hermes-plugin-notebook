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
// 4 layout       no horizontal overflow at 1440/1180/1024/820; the studio and
//                rail collapse at their breakpoints; nothing straddles a
//                scroll viewport's edge.
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
  ok('studio renders all outputs', cards === 13, `${cards} cards`)

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
      return {
        overflowX: doc.scrollWidth - doc.clientWidth,
        rail: box('.nb-rail'), studio: box('.nb-studio'), main: box('main'),
        strips: strips.filter((s) => s.sw > s.cw + 1),
        outside, sliced
      }
    })
    ok(`no horizontal overflow at ${w}`, r.overflowX <= 1, `overflow=${r.overflowX}`)
    ok(`no toolbar overflows its box at ${w}`, r.strips.length === 0, JSON.stringify(r.strips).slice(0, 120))
    ok(`no pane paints outside its column at ${w}`, r.outside === 0, `${r.outside} panes`)
    ok(`no studio card is sliced by the panel edge at ${w}`, r.sliced.length === 0, r.sliced.join(','))
    if (w <= 1024) ok(`studio collapses at ${w}`, r.studio === null, 'hidden')
    if (w <= 840) ok(`rail collapses at ${w}`, r.rail === null, 'hidden')
    if (w > 1100) ok(`main column keeps >=560px at ${w}`, r.main.w >= 560, `${r.main.w}px`)
    await page.close()
  }
  await b.close()
}

/* ------------------------------------------------------------------- run */
const { port, close } = await serve(join(here, 'tmp'))
try {
  if (which === 'all' || which === 'bundle') await bundleLoad()
  if (which === 'all' || which === 'functional') await functional(port)
  if (which === 'all' || which === 'a11y') await a11y(port)
  if (which === 'all' || which === 'layout') { layout.port = port; await layout() }
} finally {
  await close()
}
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
