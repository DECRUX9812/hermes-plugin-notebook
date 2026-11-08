// Build desktop/plugin.js + web/plugin.js by concatenating src/*.js in lexical
// order. A disk plugin is one uncompiled ESM file: no JSX, no bundler, no
// minifier — so the build is a concat plus a named-export footer for the tests.
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const srcDir = join(here, 'src')
const files = readdirSync(srcDir).filter((f) => f.endsWith('.js')).sort()
if (!files.length) throw new Error('no sources in src/')

const body = files.map((f) => readFileSync(join(srcDir, f), 'utf8').trimEnd()).join('\n\n')

const footer = `
// Named exports are for the preview harness and the gates; the app only reads
// the default export.
export { App, StudioPanel, Viewer, OpsDeck, Rail, Markdown, KIND_ICON, CSS,
         Machine, MACHINES, machineFleet, MACHINE_DOCS }
`

const out = `${body}\n${footer}`
for (const dir of ['desktop', 'web']) {
  mkdirSync(join(here, dir), { recursive: true })
  writeFileSync(join(here, dir, 'plugin.js'), out)
}
console.log(`built desktop/plugin.js + web/plugin.js from ${files.length} files — ${out.split('\n').length} lines, ${(out.length / 1024).toFixed(1)} KB`)
