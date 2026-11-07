// Structural probe: numbers, not adjectives. Prints column geometry, the stat
// strip's real text, chat message roles/counts, studio card states, and any
// element with a clipped label.
//   node tests/probe.mjs [query] [width] [height]
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { browser, serve, settle } from './lib.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const query = process.argv[2] || ''
const width = Number(process.argv[3] || 1440)
const height = Number(process.argv[4] || 900)

const { port, close } = await serve(join(here, 'tmp'))
const b = await browser()
const page = await b.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
const errors = []
page.on('pageerror', (e) => errors.push(String(e.message)))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)) })
await page.goto(`http://127.0.0.1:${port}/preview.html${query}`, { waitUntil: 'load' })
await settle(page, 1200)

const out = await page.evaluate(() => {
  const box = (n) => { if (!n) return null; const r = n.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } }
  const txt = (n) => (n ? (n.innerText || '').replace(/\s+/g, ' ').trim() : '')
  const q = (s) => document.querySelector(s)
  const qa = (s) => Array.from(document.querySelectorAll(s))

  const strip = q('.nb-strip')
  const cells = qa('.nb-cell').map((c) => txt(c))
  const msgs = qa('.nb-msg').map((m) => ({
    role: m.getAttribute('data-role'),
    text: txt(m).slice(0, 90),
    h: Math.round(m.getBoundingClientRect().height)
  }))
  const cards = qa('.nb-card').map((c) => ({
    name: txt(c.querySelector('.nb-card-name')),
    state: txt(c.querySelector('.nb-card-state')),
    h: Math.round(c.getBoundingClientRect().height)
  }))
  const clipped = qa('.nb-root *').filter((n) => {
    const cs = getComputedStyle(n)
    return cs.overflow === 'hidden' && n.scrollWidth > n.clientWidth + 2 && n.clientHeight > 0 && txt(n)
      && !n.classList.contains('nb-src-title') && !n.classList.contains('nb-nbtitle')
  }).slice(0, 10).map((n) => ({ cls: n.className, text: txt(n).slice(0, 50), sw: n.scrollWidth, cw: n.clientWidth }))
  const rows = qa('.nb-src').map((n) => ({ t: txt(n).slice(0, 60), h: Math.round(n.getBoundingClientRect().height) }))
  return {
    cols: { rail: box(q('.nb-rail')), main: box(q('main')), studio: box(q('.nb-studio')) },
    body: box(q('.nb-body')),
    strip: { box: box(strip), cells },
    tabs: qa('.nb-tab').map(txt),
    msgs,
    cards,
    rows: rows.slice(0, 3),
    clipped,
    threadScroll: (() => { const t = q('.nb-thread'); return t ? { h: t.clientHeight, sh: t.scrollHeight } : null })(),
    docScroll: { w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight }
  }
})
console.log(JSON.stringify({ out, errors }, null, 1))
await b.close(); await close()
