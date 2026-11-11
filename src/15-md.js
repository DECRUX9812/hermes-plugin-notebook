/* ----------------------------------------------------------------- markdown
 * A small, honest renderer: headings, lists, tables, fenced code, quotes, and
 * bold/italic/code/inline-citation spans. Generated artifacts are markdown, and
 * shipping them as raw text in a "polished" viewer is the difference between a
 * product and a debug pane — but a full markdown library is not importable here.
 */
const INLINE = /(\*\*[^*]+\*\*|__[^_\n]+__|~~[^~\n]+~~|`[^`]+`|\*[^*\n]+\*|_[^_\n]+_|\[S\d+\]|\[[^\]]+\]\([^)]+\))/g

/* The one citation control, everywhere citations appear: a compact numbered
 * pill — no brackets — that opens its source on click. Hover/focus previews
 * are delegated: surfaces attach handlers that look for .nb-inline-cite. */
function citeBtn(n, onCite, key) {
  if (onCite) {
    return el('button', {
      type: 'button', className: 'nb-inline-cite', 'data-n': n,
      title: `Source S${n}`, 'aria-label': `Citation ${n} — open the source`,
      onClick: (e) => { e.stopPropagation(); onCite(n) },
      children: String(n)
    }, key)
  }
  return el('span', { className: 'nb-inline-cite', 'data-n': n, children: String(n) }, key)
}

function inlineNodes(text, keyBase, onCite) {
  const out = []
  let last = 0
  const s = esc(text)
  let m
  INLINE.lastIndex = 0
  while ((m = INLINE.exec(s)) !== null) {
    if (m.index > last) out.push(s.slice(last, m.index))
    const tok = m[0]
    const k = `${keyBase}-${m.index}`
    // A zero-width emphasis ("**" or "__") escapes the pattern rarely, but when
    // it does React renders an empty span and the line collapses. Skip it.
    if (!tok || tok.length <= 2 || !tok.slice(1, -1).trim()) { last = m.index + tok.length; continue }
    if (tok.startsWith('**') || tok.startsWith('__')) {
      out.push(el('strong', { children: tok.slice(2, -2) }, k))
    } else if (tok.startsWith('`')) {
      out.push(el('code', { children: tok.slice(1, -1) }, k))
    } else if (tok.startsWith('~~')) {
      out.push(el('del', { children: tok.slice(2, -2) }, k))
    } else if (tok.startsWith('*') || tok.startsWith('_')) {
      out.push(el('em', { children: tok.slice(1, -1) }, k))
    } else if (/^\[S\d+\]$/.test(tok)) {
      out.push(citeBtn(Number(tok.slice(2, -1)), onCite, k))
    } else {
      const mm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok)
      // a URL containing ")" breaks the match; the text is still worth showing,
      // so fall back to it instead of throwing and blanking the whole answer
      if (!mm) out.push(tok)
      else out.push(el('a', {
        href: mm[2], target: '_blank', rel: 'noreferrer', style: { color: T.accent },
        children: mm[1]
      }, k))
    }
    last = m.index + tok.length
  }
  if (last < s.length) out.push(s.slice(last))
  return out
}

function messageText(text) {
  // The answer arrives as a string; older threads and a few artifact fields
  // carry objects. Stringing those renders "[object Object]" in the bubble,
  // which reads as leaked internals — take the one field that is text, or
  // nothing at all.
  if (text === null || text === undefined) return ''
  if (typeof text === 'string') return text
  if (typeof text === 'number' || typeof text === 'boolean') return String(text)
  if (typeof text === 'object') {
    for (const key of ['text', 'answer', 'content', 'markdown', 'value', 'summary']) {
      if (typeof text[key] === 'string') return text[key]
    }
    return ''          // no renderable text key: drop it rather than print debris
  }
  return ''
}

function Markdown({ text, onCite, className }) {
  const blocks = useMemo(() => parseBlocks(messageText(text)), [text])
  return el('div', {
    className: cx('nb-md', className),
    children: blocks.map((b, i) => renderBlock(b, i, onCite))
  })
}

function parseBlocks(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const blocks = []
  let i = 0
  const flushList = (ordered, items) => {
    blocks.push({ t: ordered ? 'ol' : 'ul', items })
  }
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) { i += 1; continue }
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim()
      const buf = []
      i += 1
      while (i < lines.length && !lines[i].startsWith('```')) { buf.push(lines[i]); i += 1 }
      i += 1
      blocks.push({ t: 'code', lang, text: buf.join('\n') })
      continue
    }
    if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)) { blocks.push({ t: 'hr' }); i += 1; continue }
    const h = /^(#{1,4})\s+(.*)$/.exec(line)
    if (h) { blocks.push({ t: 'h' + h[1].length, text: h[2] }); i += 1; continue }
    if (/^>\s?/.test(line)) {
      const buf = []
      while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, '')); i += 1 }
      blocks.push({ t: 'quote', text: buf.join(' ') })
      continue
    }
    if (/^\s*\|.*\|\s*$/.test(line)) {
      const rows = []
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        rows.push(lines[i].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()))
        i += 1
      }
      const body = rows.filter((r) => !r.every((c) => /^:?-{2,}:?$/.test(c) || !c))
      if (body.length) blocks.push({ t: 'table', rows: [body[0], body.slice(1)] })
      continue
    }
    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line)
      const items = []
      while (i < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*+]|\d+\.)\s+/, ''))
        i += 1
      }
      flushList(ordered, items)
      continue
    }
    const buf = [line]
    i += 1
    while (i < lines.length && lines[i].trim() &&
           !/^(#{1,4}\s|>|\s*\||\s*([-*+]|\d+\.)\s|```)/.test(lines[i])) {
      buf.push(lines[i]); i += 1
    }
    blocks.push({ t: 'p', text: buf.join(' ') })
  }
  return blocks
}

function renderBlock(b, i, onCite) {
  const key = `b${i}`
  if (b.t === 'ul' || b.t === 'ol') {
    return el(b.t, { key }, b.items.map((it, j) =>
      el('li', { children: inlineNodes(it, key + j, onCite) }, `${key}-${j}`)))
  }
  if (b.t === 'table') {
    const [head, rows] = b.rows
    return el('table', { key },
      el('thead', { children: el('tr', { children: head.map((c, j) =>
        el('th', { children: inlineNodes(c, `${key}t${j}`, onCite) }, `${key}-th-${j}`)) }) }),
      el('tbody', { children: rows.map((r, j) =>
        el('tr', { children: r.map((c, k2) =>
          el('td', { children: inlineNodes(c, `${key}r${j}c${k2}`, onCite) }, `${key}-${j}-${k2}`)) }, `${key}-r-${j}`)) }))
  }
  if (b.t === 'hr') return el('hr', { key })
  if (b.t === 'code') {
    return el('pre', { key }, el('code', { children: b.text }))
  }
  const tag = b.t === 'quote' ? 'blockquote' : (b.t.length === 2 ? b.t : 'p')
  return jsx(tag, { key, children: inlineNodes(b.text, key, onCite) })
}
