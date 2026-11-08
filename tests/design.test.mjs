// Design-system contract: the token cadence and the readability floor are
// measured on the real rendered page, not asserted in prose.
//
//  - radii come from the semantic scale (8 / 12 / 16 / 24 / pill), never ad-hoc px
//  - small metadata text clears WCAG AA (4.5:1) on its real composited background
//  - exactly one surface tab is selected at a time
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const NM = process.env.NB_NODE_MODULES || join(process.env.HOME, 'Code/hermes-webapp/node_modules')
const require = createRequire(join(NM, 'index.js'))
const { chromium } = require('playwright')

const PORT = 18744
const server = spawn('/usr/bin/python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'],
  { cwd: join(here, 'tmp'), stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 900))

const results = []
const check = (ok, label, detail) => { results.push({ ok, label, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`) }

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
await page.goto(`http://127.0.0.1:${PORT}/preview.html`)
await page.waitForTimeout(2400)
// open one card's options so the popover's own labels and radius are measured too
const cfg = page.locator('.nb-gen[data-kind="summary"] .nb-gen-cfg').first()
if (await cfg.count()) { await cfg.click(); await page.waitForTimeout(500) }

const probe = await page.evaluate(() => {
  const ALLOWED = ['8px', '12px', '16px', '24px', '99px']
  const radii = {}
  for (const n of document.querySelectorAll('.nb-card,.nb-art,.nb-chip,.nb-btn,.nb-input,.nb-icon,.nb-art-ico,.nb-seg')) {
    const r = getComputedStyle(n).borderRadius
    radii[r] = (radii[r] || 0) + 1
  }
  const offScale = Object.keys(radii).filter((r) => !ALLOWED.includes(r))

  // composite a (possibly translucent) text colour over the first opaque-ish
  // ancestor surface, then run the WCAG contrast formula
  const parse = (s) => {
    const m = s.match(/rgba?\(([^)]+)\)/) || s.match(/color\(srgb ([^)]+?)\)/)
    if (!m) return null
    const parts = m[1].split(/[\s,/]+/).filter(Boolean).map(Number)
    if (parts.length >= 3) return { r: parts[0] * (m[0].startsWith('color') ? 255 : 1), g: parts[1] * (m[0].startsWith('color') ? 255 : 1), b: parts[2] * (m[0].startsWith('color') ? 255 : 1), a: parts[3] === undefined ? 1 : parts[3] }
    return null
  }
  const backgroundOf = (node) => {
    let n = node
    while (n && n !== document.body) {
      const c = parse(getComputedStyle(n).backgroundColor)
      if (c && c.a > 0.85) return c
      n = n.parentElement
    }
    const c = parse(getComputedStyle(document.body).backgroundColor)
    return c || { r: 18, g: 20, b: 27, a: 1 }
  }
  const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b)
  }
  const contrast = (fg, bg) => {
    const mix = (a, b, t) => ({ r: a.r * t + b.r * (1 - t), g: a.g * t + b.g * (1 - t), b: a.b * t + b.b * (1 - t) })
    const fgc = mix(fg, bg, fg.a)
    const L1 = lum(fgc), L2 = lum(bg)
    return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)
  }
  const sample = (selector, limit = 8) => {
    const out = []
    for (const n of [...document.querySelectorAll(selector)].slice(0, limit)) {
      const fg = parse(getComputedStyle(n).color)
      if (!fg) continue
      const bg = backgroundOf(n)
      out.push(Number(contrast(fg, bg).toFixed(2)))
    }
    return out
  }

  // the surface switcher only: card popovers have their own segmented control
  const surface = [...document.querySelectorAll('.nb-seg')]
    .find((n) => (n.getAttribute('aria-label') || '').toLowerCase() === 'surface')
  const segs = surface ? [...surface.querySelectorAll('button')] : []
  const selected = segs.filter((n) => n.getAttribute('aria-selected') === 'true').length
  return {
    radii, offScale,
    meta: sample('.nb-meta'), state: sample('.nb-card-state'), sub: sample('.nb-art-sub'),
    labels: sample('.nb-genopt-label'), selected, segTotal: segs.length
  }
})

check(probe.offScale.length === 0, 'radii stay on the semantic scale',
  `${Object.keys(probe.radii).length} values · ${probe.offScale.join(', ') || 'none off-scale'}`)
const worst = (arr) => (arr.length ? Math.min(...arr) : null)
for (const [name, vals] of [['metadata', probe.meta], ['card state', probe.state], ['file sub-label', probe.sub], ['option label', probe.labels]]) {
  const w = worst(vals)
  check(w !== null && w >= 4.5, `${name} clears AA 4.5:1`, w === null ? 'no samples' : `${w}:1 over ${vals.length} nodes`)
}
check(probe.selected === 1, 'one surface tab selected', `${probe.selected} of ${probe.segTotal}`)
check(errors.length === 0, 'no page errors', errors.slice(0, 2).join(' | ') || 'none')

await browser.close()
server.kill()
const failed = results.filter((r) => !r.ok).length
console.log(`\n${results.length - failed}/${results.length} design checks passed`)
process.exit(failed ? 1 : 0)
