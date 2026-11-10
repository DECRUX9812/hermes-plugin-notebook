// Design-system contract: the token cadence, the type scale and the readability
// floor are measured on the real rendered page — every surface, not just the
// studio — because the failures this guards against were surface-specific.
//
//   node tests/design.test.mjs
//
// 1 type      no text renders in a UA default font. A <button> does not inherit
//             the page font, so a <span> inside one silently became Arial
//             13.333px while its neighbours were Inter — measured, not asserted.
// 2 scale     every font size on screen is a step on the semantic scale; a
//             11px label next to an 11.5px label is a bug, not a nuance.
// 3 contrast  metadata and labels clear WCAG AA 4.5:1 on their REAL composited
//             background (the theme's quaternary measured 3.63:1).
// 4 radii     radii come from the semantic scale (8 / 12 / 16 / 24 / pill).
// 5 layout    Home lays its notebooks out in a grid, Studio groups its outputs
//             into families, and the surface switcher has one selection.
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { browser, serve, settle } from './lib.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const results = []
const check = (ok, label, detail) => {
  results.push({ ok, label, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
}

const { port, close } = await serve(join(here, 'tmp'))
const b = await browser()
const errors = []

/* The probe is injected as a string so it is written once and evaluated per
 * surface. It returns raw measurements; the assertions stay in node. */
const PROBE = () => {
  const parse = (s) => {
    const m = s.match(/rgba?\(([^)]+)\)/) || s.match(/color\(srgb ([^)]+?)\)/)
    if (!m) return null
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number)
    if (p.length < 3) return null
    const k = s.startsWith('color(') ? 255 : 1
    return { r: p[0] * k, g: p[1] * k, b: p[2] * k, a: p[3] === undefined ? 1 : p[3] }
  }
  const bgOf = (n) => {
    let x = n
    while (x && x !== document.body) {
      const c = parse(getComputedStyle(x).backgroundColor)
      if (c && c.a > 0.85) return c
      x = x.parentElement
    }
    return parse(getComputedStyle(document.body).backgroundColor) || { r: 11, g: 12, b: 17, a: 1 }
  }
  const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b)
  }
  const contrast = (fg, bg) => {
    const mix = (a, b2, t) => ({ r: a.r * t + b2.r * (1 - t), g: a.g * t + b2.g * (1 - t), b: a.b * t + b2.b * (1 - t) })
    const f = mix(fg, bg, fg.a)
    const L1 = lum(f), L2 = lum(bg)
    return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)
  }
  const ownText = (n) => Array.from(n.childNodes)
    .some((c) => c.nodeType === 3 && c.textContent.trim())
  const visible = (n) => {
    const r = n.getBoundingClientRect()
    return r.width > 3 && r.height > 3
  }

  const ALLOWED_RADII = ['0px', '8px', '12px', '16px', '24px', '50%', '99px']
  const allowedCombined = (r) => r.split(' ').every((p) => ALLOWED_RADII.includes(p))

  const uaFont = []
  const sizes = {}
  const lowContrast = []
  const radii = {}

  for (const n of document.querySelectorAll('.nb-root *')) {
    if (!visible(n)) continue
    const cs = getComputedStyle(n)
    const hasText = ownText(n) || ((n.tagName === 'INPUT' || n.tagName === 'TEXTAREA') && n.value !== '')
    if (hasText) {
      const fam = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim()
      if (/^(Arial|Helvetica|Times|Times New Roman|serif|sans-serif|monospace)$/.test(fam)) {
        uaFont.push({ tag: n.tagName, cls: String(n.className).slice(0, 34),
          text: n.textContent.trim().slice(0, 28), size: cs.fontSize, fam })
      }
      sizes[cs.fontSize] = (sizes[cs.fontSize] || 0) + 1
      const fg = parse(cs.color)
      if (fg) {
        const ratio = contrast(fg, bgOf(n))
        if (ratio < 4.5) lowContrast.push({ cls: String(n.className).slice(0, 30),
          text: n.textContent.trim().slice(0, 26), size: cs.fontSize, ratio: +ratio.toFixed(2) })
      }
    }
    if (n.matches('button,a[href],input,select,textarea,[role=tab],[role=button]')) {
      const first = cs.borderRadius.split(' ')[0]
      radii[first] = (radii[first] || 0) + 1
    }
  }

  const surface = [...document.querySelectorAll('.nb-seg')]
    .find((n) => (n.getAttribute('aria-label') || '').toLowerCase() === 'surface')
  const tabs = surface ? [...surface.querySelectorAll('button')] : []
  const homeGrid = document.querySelector('.nb-home-grid')
  const groups = [...document.querySelectorAll('.nb-group')]

  return {
    uaFont: uaFont.slice(0, 12), uaFontCount: uaFont.length,
    sizes, lowContrast: lowContrast.slice(0, 12), lowContrastCount: lowContrast.length,
    radii, offScale: Object.entries(radii).filter(([r]) => !allowedCombined(r)).map(([r]) => r),
    selected: tabs.filter((n) => n.getAttribute('aria-selected') === 'true').length,
    segTotal: tabs.length,
    homeCols: homeGrid ? getComputedStyle(homeGrid).gridTemplateColumns.split(' ').length : 0,
    homeCards: document.querySelectorAll('.nb-nbcard').length,
    groups: groups.map((g) => ({
      name: (g.querySelector('.nb-group-name') || {}).textContent,
      count: (g.querySelector('.nb-group-count') || {}).textContent,
      expanded: g.querySelector('.nb-group-head') &&
        g.querySelector('.nb-group-head').getAttribute('aria-expanded')
    }))
  }
}

/* The semantic type scale, as the CSS declares it. Every rendered size must be
 * one of these or a heading step — nothing in between. */
const SCALE = ['11.5px', '12.5px', '13px', '14px', '15px', '16px', '17px', '19px', '22px', '26px', '30px']
/* sizes that legitimately sit off the chrome scale: the citation tag (a
 * superscript-like marker, always paired with a full-size label) */
const OFF_SCALE_ALLOWED = ['10.5px']

const surfaces = [
  ['studio', ''],
  ['home', '?mode=home'],
  ['discover', '?mode=discover'],
  ['ops', '?mode=ops']
]

const seen = {}
for (const [name, query] of surfaces) {
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } })
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${name}: ${m.text()}`) })
  await page.goto(`http://127.0.0.1:${port}/preview.html${query}`, { waitUntil: 'load' })
  await page.waitForSelector('.nb-root', { timeout: 15000 }).catch(() => {})
  await settle(page, 1100)
  // open a card's options so the popover's labels are measured too
  if (name === 'studio') {
    const cfg = page.locator('.nb-gen[data-kind="summary"] .nb-gen-cfg').first()
    if (await cfg.count()) { await cfg.click(); await settle(page, 400) }
  }
  seen[name] = await page.evaluate(`(${PROBE.toString()})()`)
  await page.close()
}

/* 1 type — no UA font anywhere */
const uaTotal = Object.values(seen).reduce((s, r) => s + r.uaFontCount, 0)
check(uaTotal === 0, 'no text renders in a UA default font (Arial/Times)', `${uaTotal} nodes across ${surfaces.length} surfaces`)
if (uaTotal) {
  for (const [name, r] of Object.entries(seen)) {
    for (const n of r.uaFont) console.log(`      ${name}: ${n.tag}.${n.cls} "${n.text}" ${n.size} ${n.fam}`)
  }
}

/* 2 scale — every rendered size is a declared step */
const offScaleSizes = []
for (const [name, r] of Object.entries(seen)) {
  for (const size of Object.keys(r.sizes)) {
    if (!SCALE.includes(size) && !OFF_SCALE_ALLOWED.includes(size)) offScaleSizes.push(`${name}:${size}`)
  }
}
check(offScaleSizes.length === 0, 'every rendered font size is a declared scale step',
  offScaleSizes.length ? offScaleSizes.join(', ') : `${Object.keys(seen.studio.sizes).length} steps in use`)

/* 3 contrast — AA on every surface */
const contrastTotal = Object.values(seen).reduce((s, r) => s + r.lowContrastCount, 0)
check(contrastTotal === 0, 'all text clears AA 4.5:1 on its real background', `${contrastTotal} nodes below`)
if (contrastTotal) {
  for (const [name, r] of Object.entries(seen)) {
    for (const n of r.lowContrast) console.log(`      ${name}: ${n.ratio}:1 ${n.size} .${n.cls} "${n.text}"`)
  }
}

/* 4 radii — one semantic scale */
const offRadii = Object.entries(seen)
  .flatMap(([name, r]) => r.offScale.map((v) => `${name}:${v}`))
check(offRadii.length === 0, 'radii stay on the semantic scale', offRadii.join(', ') || 'none off-scale')

/* 5 layout — the two surfaces this pass redesigned */
check(seen.studio.selected === 1, 'one surface tab selected',
  `${seen.studio.selected} of ${seen.studio.segTotal}`)

check(seen.studio.groups.length >= 4, 'studio groups its outputs into families',
  seen.studio.groups.map((g) => `${g.name} ${g.count}`).join(', '))
check(seen.studio.groups.every((g) => g.expanded === 'true'),
  'every output family starts expanded', seen.studio.groups.map((g) => g.expanded).join(','))

check(seen.home.homeCards > 0 && seen.home.homeCols >= 2,
  'home lays notebooks out in a grid', `${seen.home.homeCards} cards · ${seen.home.homeCols} columns`)

/* 6 light skin — the contrast rules above were tuned against the dark ramp
 * (the harness pins it), and a light theme inverts every assumption: the ink
 * is dark, the canvas is near-white, and the host's accent family is a mid
 * hue. The rules under test must hold in BOTH, so this re-points the token
 * ramp at the host's real light theme and measures again. */
const LIGHT_RAMP = `
:root{
  --ui-base:#1A1610;
  --ui-accent:#B8860B;
  color-scheme:light;
  --ui-text-primary:color-mix(in srgb,var(--ui-base) 94%,transparent);
  --ui-text-secondary:color-mix(in srgb,var(--ui-base) 74%,transparent);
  --ui-text-tertiary:color-mix(in srgb,var(--ui-base) 58%,transparent);
  --ui-text-quaternary:color-mix(in srgb,var(--ui-base) 42%,transparent);
  --ui-stroke-secondary:rgba(26,22,16,.16);
  --ui-stroke-tertiary:rgba(26,22,16,.10);
  /* the host's own light surfaces, from static/style.css: --bg / --sidebar /
     --surface (#FEFCF7 / #FAF7F0 / #F3EEE3) */
  --ui-bg-primary:#FEFCF7;
  --ui-bg-secondary:#FAF7F0;
  --ui-bg-tertiary:#F3EEE3;
  --ui-bg-elevated:#FEFCF7;
  --ui-success:#3D8B40; --ui-warning:#E68A00; --ui-danger:#C62828;
}
html,body{background:#FEFCF7}
/* Colours are a resting property: a palette flip animates every surface and
   text colour, so a probe that samples mid-transition reports ghost ratios
   (light ink over a light canvas at 1.02:1). Freeze motion for the pass. */
*,*::before,*::after{transition:none!important;animation:none!important}`

const lightFails = []
for (const [name, query] of surfaces) {
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } })
  page.on('pageerror', (e) => errors.push(`light/${name}: ${e.message}`))
  await page.goto(`http://127.0.0.1:${port}/preview.html${query}`, { waitUntil: 'load' })
  await page.waitForSelector('.nb-root', { timeout: 15000 }).catch(() => {})
  await settle(page, 900)
  await page.addStyleTag({ content: LIGHT_RAMP })
  // The page decides its skin by MEASURING the host's canvas (the host sets no
  // color-scheme, so CSS alone cannot know). Wait for that decision instead of
  // assuming it lands inside a fixed sleep — a race here read as a contrast bug.
  await page.waitForSelector('.nb-root[data-skin="light"]', { timeout: 6000 }).catch(() => {})
  await settle(page, 250)
  const r = await page.evaluate(`(${PROBE.toString()})()`)
  for (const n of r.lowContrast) {
    lightFails.push(`${name}: ${n.ratio}:1 ${n.size} .${n.cls} "${n.text}"`)
  }
  await page.close()
}
check(lightFails.length === 0, 'all text clears AA 4.5:1 in the light skin too',
  lightFails.length ? `${lightFails.length} nodes below` : 'both skins clean')
for (const line of lightFails.slice(0, 10)) console.log(`      light ${line}`)

/* 7 no page errors anywhere */
check(errors.length === 0, 'no page errors', errors.slice(0, 2).join(' | ') || 'none')

await b.close()
await close()

const failed = results.filter((r) => !r.ok).length
console.log(`\n${results.length - failed}/${results.length} design checks passed`)
process.exit(failed ? 1 : 0)
