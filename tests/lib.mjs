// Minimal static server + Playwright browser shared by the gates and the shots.
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { createRequire } from 'node:module'

const NM = process.env.NB_NODE_MODULES || join(process.env.HOME, 'Code/rigforge-plugin/node_modules')
const require = createRequire(join(NM, 'index.js'))

export const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
}

export async function serve(root, port = 0) {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://x')
      const rel = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '') || 'preview.html'
      const file = join(root, rel)
      if (!file.startsWith(root)) { res.writeHead(403).end('no'); return }
      const info = await stat(file).catch(() => null)
      if (!info || !info.isFile()) { res.writeHead(404).end('missing ' + rel); return }
      const body = await readFile(file)
      res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream', 'content-length': body.length })
      res.end(body)
    } catch (e) {
      res.writeHead(500).end(String(e))
    }
  })
  await new Promise((r) => server.listen(port, '127.0.0.1', r))
  return { server, port: server.address().port, close: () => new Promise((r) => server.close(r)) }
}

export async function browser() {
  const { chromium } = require('playwright')
  const b = await chromium.launch({ args: ['--no-sandbox', '--hide-scrollbars'] })
  return b
}

export const settle = (page, ms = 500) => page.waitForTimeout(ms)
