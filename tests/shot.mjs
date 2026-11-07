// Quick look: render the preview at a given size and save a PNG, printing every
// console error so a blank page is never mistaken for a design.
//   node tests/shot.mjs out.png [query] [width] [height] [waitMs]
import { join } from 'node:path'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { browser, serve, settle } from './lib.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const out = process.argv[2] || join(here, 'tmp', 'shot.png')
const query = process.argv[3] || ''
const width = Number(process.argv[4] || 1440)
const height = Number(process.argv[5] || 900)
const wait = Number(process.argv[6] || 900)

const { port, close } = await serve(join(here, 'tmp'))
const b = await browser()
const page = await b.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}
${(e.stack || '').split('\n').slice(0, 6).join('\n')}`))
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`) })

await page.goto(`http://127.0.0.1:${port}/preview.html${query}`, { waitUntil: 'load' })
await settle(page, wait)

const info = await page.evaluate(() => {
  const root = document.querySelector('.nb-root')
  const body = document.body
  const clickable = Array.from(document.querySelectorAll('button,a[href],input,textarea'))
  const small = clickable
    .map((n) => ({ label: (n.getAttribute('aria-label') || n.textContent || '').trim().slice(0, 40), h: Math.round(n.getBoundingClientRect().height) }))
    .filter((n) => n.h > 0 && n.h < 32)
  return {
    mounted: !!root,
    mode: root && root.getAttribute('data-mode'),
    text: (root ? root.innerText : body.innerText || '').slice(0, 220),
    fontSize: root && getComputedStyle(root).fontSize,
    controls: clickable.length,
    under32: small.slice(0, 8),
    scroll: { w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight }
  }
})

await page.screenshot({ path: out })
console.log(JSON.stringify({ info, errors }, null, 1))
await b.close()
await close()
