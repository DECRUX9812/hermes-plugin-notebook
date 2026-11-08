import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { browser, serve, settle } from './lib.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const OUT = '/home/decrux/.hermes-webapp/cache/scratch'
const { port, close } = await serve(join(here, 'tmp'))
const b = await browser()
const page = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.goto(`http://127.0.0.1:${port}/preview.html`, { waitUntil: 'load' })
await settle(page, 900)

await page.locator('.nb-seg button', { hasText: 'Discover' }).first().click()
await settle(page, 500)
await page.screenshot({ path: join(OUT, 'nb-discover.png') })

// show a filled state too: stub the route in-page so the cards are real DOM
await page.evaluate(() => {
  window.__NB_STATE__.kinds = window.__NB_STATE__.kinds
})
console.log(JSON.stringify({ errors, surface: await page.locator('.nb-disc').count() }))
await close()
await b.close()
