// Shoot the six documentation screenshots + the banner, from the real UI.
//
//   node tests/shots-docs.mjs
//
// Every capture scrolls/clicks the page into the state it is advertising, then
// scans the visible text for NaN / undefined / null so a broken state cannot
// become documentation.
import { copyFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { browser, serve, settle } from './lib.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const out = join(root, 'assets')
mkdirSync(out, { recursive: true })

const { port, close } = await serve(join(here, 'tmp'))
const b = await browser()
const problems = []

const shots = [
  {
    file: 'shot-01-studio.png',
    query: '',
    async setup(page) {
      // ask in the real composer so the capture shows the citation machinery,
      // not a stored thread that predates it
      await page.locator('.nb-askbox textarea').fill('Where does ITER assembly stand, and what is still unsolved?')
      await page.locator('.nb-askbox .nb-btn[data-variant=primary]').click()
      await page.waitForTimeout(2200)
      await page.locator('.nb-thread').evaluate((n) => { n.scrollTop = n.scrollHeight })
      await settle(page, 400)
    }
  },
  { file: 'shot-02-mindmap.png', query: '?open=mind_map' },
  {
    file: 'shot-03-audio.png',
    query: '?open=audio_overview',
    async setup(page) {
      // park the real <audio> element a third in, so played/unplayed is visible
      await page.evaluate(async () => {
        const a = document.querySelector('audio')
        if (!a) return
        await new Promise((res) => {
          if (a.readyState >= 1) return res()
          a.addEventListener('loadedmetadata', res, { once: true })
          setTimeout(res, 1500)
        })
        a.currentTime = Math.min((a.duration || 90) * 0.34, 120)
        a.dispatchEvent(new Event('timeupdate'))
      })
      await settle(page, 500)
    }
  },
  { file: 'shot-04-video.png', query: '?open=video_overview' },
  {
    file: 'shot-05-flashcards.png',
    query: '?open=flashcards',
    async setup(page) {
      const card = page.locator('.nb-flip')
      if (await card.count()) { await card.click(); await settle(page, 700) }
    }
  },
  {
    file: 'shot-06-lab-ops.png',
    query: '?mode=ops',
    async setup(page) {
      await page.locator('.nb-frow').nth(1).click()
      await settle(page, 700)
      await page.locator('.nb-tab', { hasText: 'Terminal' }).click()
      await settle(page, 400)
      const input = page.locator('.nb-term-in input')
      if (await input.count()) {
        await input.fill('uptime; df -h / | tail -1')
        await page.locator('.nb-term-in .nb-btn[data-variant=primary]').click()
        await settle(page, 1600)
      }
    }
  }
]

for (const shot of shots) {
  const page = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  const errs = []
  page.on('pageerror', (e) => errs.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)) })
  await page.goto(`http://127.0.0.1:${port}/preview.html${shot.query}`, { waitUntil: 'load' })
  await settle(page, 1300)
  if (shot.setup) await shot.setup(page)
  await settle(page, 500)

  const text = await page.evaluate(() => document.querySelector('.nb-root').innerText)
  const bad = text.match(/\b(NaN|undefined|null|Infinity)\b/g)
  if (bad) problems.push(`${shot.file}: ${[...new Set(bad)].join(',')}`)
  if (errs.length) problems.push(`${shot.file}: ${errs[0]}`)

  await page.screenshot({ path: join(out, shot.file) })
  console.log(`shot → assets/${shot.file}`)
  await page.close()
}

/* ------------------------------------------------------------------ banner */
// The banner is a page too: it loads the real studio screenshot, so the artwork
// can never drift from the product.
const bannerHtml = `<!doctype html><html><head><meta charset="utf-8">
<style>
  @font-face{font-family:x;src:local(Inter)}
  html,body{margin:0;background:#08090d;font-family:Inter,ui-sans-serif,system-ui,"Segoe UI",sans-serif;
    -webkit-font-smoothing:antialiased;color:#ececf2}
  .wrap{width:1200px;height:600px;position:relative;overflow:hidden;
    background:radial-gradient(1100px 620px at 12% -10%, rgba(139,147,255,.22), transparent 62%),
               radial-gradient(900px 500px at 100% 110%, rgba(86,182,194,.16), transparent 60%), #08090d}
  .grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.045) 1px,transparent 1px),
    linear-gradient(90deg,rgba(255,255,255,.045) 1px,transparent 1px);background-size:44px 44px;
    mask-image:radial-gradient(circle at 30% 20%, black, transparent 78%)}
  .inner{position:relative;display:flex;gap:44px;padding:54px 56px;height:100%;box-sizing:border-box}
  .left{width:430px;display:flex;flex-direction:column;justify-content:center}
  .mark{display:flex;align-items:center;gap:12px;margin-bottom:26px}
  .tile{width:44px;height:44px;border-radius:13px;display:grid;place-items:center;
    background:linear-gradient(150deg,rgba(139,147,255,.35),rgba(139,147,255,.12));
    border:1px solid rgba(139,147,255,.45);color:#c9cdff}
  .name{font-size:19px;font-weight:640;letter-spacing:-.01em}
  .kicker{font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#8b8b99;font-weight:700}
  h1{margin:0 0 18px;font-size:47px;line-height:1.04;letter-spacing:-.03em;font-weight:700}
  h1 em{font-style:normal;color:#a9b0ff}
  p{margin:0 0 26px;font-size:16.5px;line-height:1.5;color:#c7cedb;max-width:39ch}
  .chips{display:flex;gap:8px;flex-wrap:wrap}
  .chip{font-size:13px;font-weight:600;height:32px;display:inline-flex;align-items:center;padding:0 12px;border-radius:8px;color:#c9cdff;
    background:rgba(139,147,255,.12);border:1px solid rgba(139,147,255,.28)}
  .chip.g{color:#b7f0c9;background:rgba(63,185,80,.16);border-color:rgba(63,185,80,.42)}
  .right{flex:1;position:relative;display:grid;place-items:center;padding-right:22px}
  .frame{position:relative;width:100%;border-radius:14px;overflow:hidden;border:1px solid rgba(255,255,255,.13);
    box-shadow:0 30px 80px rgba(0,0,0,.6), 0 0 0 1px rgba(0,0,0,.4);
    background:#0b0c11;transform:rotate(-1.1deg)}
  .frame img{display:block;width:100%}
  .frame::after{content:"";position:absolute;inset:0;
    background:linear-gradient(200deg,transparent 55%,rgba(8,9,13,.45))}
  .badge{position:absolute;bottom:-4px;right:8px;font-size:12px;color:#a5b0c2;
    font-family:ui-monospace,monospace}
</style></head>
<body><div class="wrap"><div class="grid"></div>
  <div class="inner">
    <div class="left">
      <div class="mark">
        <span class="tile"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2V4Zm0 0v16M9 8h6M9 12h6"/></svg></span>
        <div><div class="name">Hermes Notebook</div>
        <div class="kicker">a notebooklm-shaped studio</div></div>
      </div>
      <h1>Sources in.<br><em>Cited answers</em><br>and a podcast out.</h1>
      <p>Every answer is built from your sources and cites the one it came from.
         Twelve studio outputs, one lab deck, inside Hermes Desktop.</p>
      <div class="chips">
        <span class="chip">12 studio outputs</span>
        <span class="chip g">grounded Q&amp;A</span>
        <span class="chip">8-host fleet deck</span>
      </div>
    </div>
    <div class="right">
      <div class="frame"><img src="./shot-01-studio.png" alt="Hermes Notebook studio"></div>
      <div class="badge">hermes desktop · /notebook</div>
    </div>
  </div>
</div></body></html>`

// the frame loads the studio capture that was just taken, from the same dir
copyFileSync(join(out, 'shot-01-studio.png'), join(here, 'tmp', 'shot-01-studio.png'))
writeFileSync(join(here, 'tmp', 'banner.html'), bannerHtml)
const bp = await b.newPage({ viewport: { width: 1200, height: 600 }, deviceScaleFactor: 1 })
await bp.goto(`http://127.0.0.1:${port}/banner.html`, { waitUntil: 'load' })
await settle(bp, 700)
await bp.screenshot({ path: join(out, 'banner.png') })
console.log('banner → assets/banner.png')
await bp.close()

await b.close()
await close()

if (problems.length) {
  console.log('\nPROBLEMS')
  for (const p of problems) console.log(' -', p)
  process.exit(1)
}
console.log('\nno NaN/undefined in any capture; no console errors')
