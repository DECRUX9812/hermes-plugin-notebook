/* ------------------------------------------------------------------ icons
 * Hand-drawn 24×24 stroke paths; one <svg> factory so every glyph shares the
 * same weight. No icon font, no remote sprite — a desktop plugin can only
 * import the SDK, react and react/jsx-runtime.
 */
const P = {
  notebook: 'M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2V4Zm0 0v16M9 8h6M9 12h6',
  book: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5V5.5ZM8 7h7M8 10h5',
  video: 'M3 7.5A2.5 2.5 0 0 1 5.5 5h7A2.5 2.5 0 0 1 15 7.5v9A2.5 2.5 0 0 1 12.5 19h-7A2.5 2.5 0 0 1 3 16.5v-9ZM15 10l5-3v10l-5-3',
  audio: 'M4 10v4M8 6v12M12 8v8M16 4v16M20 9v6',
  mindmap: 'M9 12a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM12 9V5M12 15v4M9.6 10.4 5 8M9.6 13.6 5 16M14.4 10.4 19 8M14.4 13.6 19 16',
  study: 'M3 8l9-4 9 4-9 4-9-4Zm3 4.2V16c0 1.4 2.7 2.6 6 2.6s6-1.2 6-2.6v-3.8',
  doc: 'M7 3h7l4 4v14H7V3Zm7 0v4h4M9.5 12h6M9.5 15.5h6M9.5 8.5h2',
  faq: 'M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm-2.2-9.8a2.2 2.2 0 1 1 3.1 2c-.6.3-.9.8-.9 1.4v.4M12 17h.01',
  timeline: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v5l3.2 2',
  cards: 'M8 7h11v11H8V7ZM5 17V4h11',
  slides: 'M3 4h18v11H3V4Zm9 11v5M8 20h8',
  chart: 'M4 20h16M7 16V9M12 16V5M17 16v-5',
  // a blueprint reads as a plan view, not a bar chart: three stacked
  // zones with a column split, which is what the poster actually is
  blueprint: 'M3 4h18v16H3V4Zm0 5h18M9 9v11M14 9v11M3 15h18',
  summary: 'M5 6h14M5 10h14M5 14h9M5 18h6',
  quiz: 'M4 5h16v14H4V5Zm3.5 7.2 2 2 3.5-3.5',
  search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Zm4.8.2L20 21',
  plus: 'M12 5v14M5 12h14',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  arrowLeft: 'M19 12H5M11 18l-6-6 6-6',
  play: 'M7 4.5v15l13-7.5-13-7.5Z',
  pause: 'M8 5v14M16 5v14',
  chevron: 'M6 9l6 6 6-6',
  close: 'M6 6l12 12M18 6L6 18',
  refresh: 'M20 12a8 8 0 1 1-2.4-5.7M20 4v4h-4',
  sparkle: 'M12 3l1.9 5.3L19 10l-5.1 1.7L12 17l-1.9-5.3L5 10l5.1-1.7L12 3Z',
  external: 'M14 4h6v6M20 4l-8 8M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  terminal: 'M4 5h16v14H4V5Zm3.5 5 2.5 2.5L7.5 15M13 15h4',
  server: 'M4 6h16v5H4V6Zm0 7h16v5H4v-5ZM7 8.5h.01M7 15.5h.01',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z',
  camera: 'M4 8h3l1.5-2h7L17 8h3v11H4V8Zm8 8.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
  shield: 'M12 3l8 3v6c0 4.5-3.2 7.6-8 9-4.8-1.4-8-4.5-8-9V6l8-3Zm-3 9 2 2 4-4',
  copy: 'M9 9h10v10H9V9Zm-4 6H4V4h11v1',
  sun: 'M12 4v2M12 18v2M4 12h2M18 12h2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M17.7 6.3l-1.4 1.4M7.7 16.3l-1.4 1.4M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M5 11h14v9H5v-9Zm7 3v3',
  moon: 'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z',
  check: 'M5 13l4.5 4.5L19 7',
  minus: 'M6 12h12',
  download: 'M12 4v10M8 11l4 4 4-4M5 19h14',
  bolt: 'M13 3L5 14h6l-1 7 8-11h-6l1-7Z',
  cpu: 'M8 8h8v8H8V8Zm-3 3h3m-3 3h3m13-6h-3m3 6h-3M11 5v3m3-3v3m-3 11v-3m3 3v-3',
  link: 'M10 14a4 4 0 0 0 5.7 0l2.6-2.6a4 4 0 0 0-5.7-5.7L11.4 7M14 10a4 4 0 0 0-5.7 0l-2.6 2.6a4 4 0 0 0 5.7 5.7L12.6 17',
  file: 'M7 3h7l4 4v14H7V3Zm7 0v4h4',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-18c3 3.4 3 14.6 0 18M3.5 9h17M3.5 15h17',
  image: 'M4 5h16v14H4V5Zm3 4.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM20 15l-5-5-8 9',
  note: 'M6 3h9l4 4v14H6V3Zm3 8h7m-7 4h5',
  trash: 'M5 7h14M9 7V4h6v3m-7 0 1 13h6l1-13',
  layers: 'M12 3 3 8l9 5 9-5-9-5ZM3 13l9 5 9-5M3 17.5 12 22l9-4.5',
  send: 'M4 12l16-8-6 16-3-6-7-2Z',
  keyboard: 'M3 6h18v12H3V6Zm3 3h.01M9 9h.01M12 9h.01M15 9h.01M18 9h.01M6.5 15h11',
  grid: 'M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z',
  stop: 'M7 7h10v10H7V7Z',
  tag: 'M4 4h6.6L20 13.4a2 2 0 0 1 0 2.8l-3.8 3.8a2 2 0 0 1-2.8 0L4 10.6V4Zm4.6 3.4a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6Z',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  pin: 'M9 4h6l-1 6 3 3v2H7v-2l3-3-1-6Z',
  sliders: 'M4 7h9m4 0h3M4 17h3m4 0h9M13 4v6m-6 4v6',
  pencil: 'M4 20h4L19.5 8.5a2.12 2.12 0 0 0-3-3L5 17v3Zm9.5-11.5 2 2',
  shuffle: 'M16 3h5v5M4 20l17-17M21 16v5h-5M15 15l6 6M4 4l5 5'
}

function Glyph({ name, size = 16, stroke = 1.7 }) {
  const d = P[name] || P.doc
  return el('svg', {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: stroke, strokeLinecap: 'round',
    strokeLinejoin: 'round', 'aria-hidden': 'true', focusable: 'false',
    children: el('path', { d })
  })
}

/* Generative notebook sigil — abstract SVG seeded by the notebook id, so every
 * notebook gets a stable, unique piece of generative art instead of a literal
 * icon. Deterministic: same id, same sigil, forever. */
function _sigHash(str) {
  let h = 2166136261
  const s = String(str || 'notebook')
  for (let i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}
function _sigRnd(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function sigHue(seed) {
  return _sigHash(seed) % 360
}
function Sigil({ seed, size = 44, draw = false }) {
  const rnd = _sigRnd(_sigHash(seed))
  const hue = Math.floor(rnd() * 360)
  const out = []
  for (let i = 0; i < 3; i += 1) {
      const y1 = 10 + rnd() * 30
      const y2 = 10 + rnd() * 30
      const cx = 10 + rnd() * 28
      const h2 = (hue + i * 47 + Math.floor(rnd() * 36)) % 360
      out.push(el('path', {
        key: `r${i}`,
        pathLength: 1,
        d: `M -6 ${y1.toFixed(1)} C ${cx.toFixed(1)} ${(y1 - 16 - rnd() * 12).toFixed(1)}, ` +
           `${(54 - cx).toFixed(1)} ${(y2 + 16 + rnd() * 12).toFixed(1)}, 54 ${y2.toFixed(1)}`,
        fill: 'none',
        stroke: `hsl(${h2} 72% 66% / ${(0.45 + rnd() * 0.35).toFixed(2)})`,
        strokeWidth: (1.4 + rnd() * 2.4).toFixed(2),
        strokeLinecap: 'round'
      }))
    }
    for (let i = 0; i < 2; i += 1) {
      out.push(el('circle', {
        key: `n${i}`,
        cx: (8 + rnd() * 32).toFixed(1), cy: (8 + rnd() * 32).toFixed(1),
        r: (1.5 + rnd() * 2.6).toFixed(2),
        fill: `hsl(${(hue + 150 + i * 70) % 360} 70% 72% / 0.85)`
      }))
    }
    return el('svg', {
      width: size, height: size, viewBox: '-6 -6 60 60',
      'aria-hidden': 'true', focusable: 'false',
      className: draw ? 'nb-sigil-draw' : undefined,
      style: { display: 'block' },
      children: out
    })
}

/* -------------------------------------------------------------- primitives */

function Btn({ children, icon, variant, size, onClick, disabled, title, type = 'button', className, style, ...rest }) {
  return el('button', {
    type, className: cx('nb-btn', className), 'data-variant': variant, 'data-size': size,
    onClick, disabled, title, style, 'aria-label': rest['aria-label'],
    children: [icon ? jsx(Glyph, { name: icon, size: size === 'sm' ? 14 : 15 }) : null,
               children ? el('span', { children }) : null].filter(Boolean)
  })
}

function IconBtn({ icon, label, onClick, active, size = 16, disabled, className }) {
  return el('button', {
    type: 'button', className: cx('nb-icon', className), onClick, title: label, 'aria-label': label,
    disabled, 'data-active': active ? 'true' : 'false',
    children: jsx(Glyph, { name: icon, size })
  })
}

/** SegmentedControl: one tab stop, arrow keys move the selection (a tablist
 *  that swallows arrow keys is a promise the widget breaks). */
function Seg({ value, onChange, options, label, fill }) {
  const refs = useRef([])
  const onKey = (e) => {
    const i = options.findIndex((o) => o.id === value)
    let next = -1
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % options.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + options.length) % options.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = options.length - 1
    if (next < 0) return
    e.preventDefault()
    onChange(options[next].id)
    const node = refs.current[next]
    if (node) node.focus()
  }
  return el('div', {
    className: 'nb-seg', role: 'tablist', 'aria-label': label, onKeyDown: onKey,
    'data-fill': fill ? 'true' : 'false'
  }, options.map((o, i) => el('button', {
    type: 'button', role: 'tab', ref: (n) => { refs.current[i] = n },
    'aria-selected': o.id === value, tabIndex: o.id === value ? 0 : -1,
    onClick: () => onChange(o.id), title: o.title || o.label,
    children: [o.icon ? jsx(Glyph, { name: o.icon, size: 14 }) : null,
               el('span', { children: o.label })].filter(Boolean)
  }, o.id)))
}

function Chip({ children, tone, onClick, title, pressed }) {
  const clickable = typeof onClick === 'function'
  const props = {
    className: 'nb-chip', 'data-tone': tone, 'data-click': clickable ? 'true' : undefined,
    title, children
  }
  if (clickable) {
    props.onClick = onClick
    props.type = 'button'
    props['aria-pressed'] = pressed === undefined ? undefined : !!pressed
    return el('button', props)
  }
  return el('span', props)
}

function SearchField({ value, onChange, placeholder, label, autoFocus }) {
  return el('div', { className: 'nb-field' },
    jsx(Glyph, { name: 'search', size: 14 }),
    el('input', {
      value, placeholder, 'aria-label': label || placeholder,
      // Preact sets .autoFocus as a property; a data attribute is what the dialog
      // can reliably find, and it is also what an agent can look for
      'data-autofocus': autoFocus ? 'true' : undefined, autoFocus: !!autoFocus,
      onChange: (e) => onChange(e.target.value), spellCheck: false
    }),
    value ? jsx(IconBtn, { icon: 'close', label: 'Clear search', size: 13, onClick: () => onChange('') }) : null
  )
}

/** Minimal modal: focus moves in, Tab cycles, Escape closes, focus returns. */
function useDialogFocus(open, onClose) {
  useEffect(() => {
    if (!open) return undefined
    const prior = document.activeElement
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault(); e.stopPropagation(); onClose()
        return
      }
      if (e.key !== 'Tab') return
      const root = document.querySelector('[data-nb-dialog="true"]')
      if (!root) return
      const items = Array.from(root.querySelectorAll(
        'button,[href],input,textarea,select,[tabindex]:not([tabindex="-1"])'
      )).filter((n) => !n.disabled && n.offsetParent !== null)
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
    }
    document.addEventListener('keydown', onKey, true)
    const t = setTimeout(() => {
      const root = document.querySelector('[data-nb-dialog="true"]')
      const target = root && (root.querySelector('[data-autofocus="true"],[autofocus]')
        || root.querySelector('input,textarea,button'))
      if (target) target.focus()
    }, 30)
    return () => {
      clearTimeout(t)
      document.removeEventListener('keydown', onKey, true)
      if (prior && prior.focus) prior.focus()
    }
  }, [open, onClose])
}

function Dialog({ open, onClose, title, children, width = 520 }) {
  useDialogFocus(open, onClose)
  if (!open) return null
  return el('div', {
    style: {
      position: 'fixed', inset: 0, zIndex: 90, display: 'grid', placeItems: 'center',
      background: 'color-mix(in srgb, #000 55%, transparent)', padding: '24px'
    },
    onClick: (e) => { if (e.target === e.currentTarget) onClose() }
  },
  el('div', {
    'data-nb-dialog': 'true', role: 'dialog', 'aria-modal': 'true',
    'aria-label': title, tabIndex: -1,
    style: {
      width: `min(${width}px, 100%)`, maxHeight: '84vh', overflow: 'auto',
      background: 'var(--ui-bg-elevated, var(--ui-bg-primary, #14151b))',
      border: `1px solid ${T.line}`, borderRadius: '18px', padding: '22px',
      boxShadow: '0 24px 70px rgba(0,0,0,.45), 0 4px 14px rgba(0,0,0,.25)'
    }
  },
  el('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' } },
    el('div', { style: { flex: 1 } },
      el('div', { style: { fontSize: '17px', fontWeight: 650, letterSpacing: '-.01em' }, children: title })),
    jsx(IconBtn, { icon: 'close', label: 'Close dialog', onClick: onClose })
  ),
  children))
}

/* Copying is an ACTION, so it reports.
 *
 * Every call site used to wrap `navigator.clipboard.writeText(...)` in
 * try/catch. writeText returns a PROMISE, so a denied permission sailed past
 * the catch as an unhandled rejection, and the button said nothing either
 * way — the click looked broken in exactly the window where copying matters
 * most (the app's renderer, where the async clipboard can be refused).
 *
 * One helper, three outcomes with a sentence for each, and a selection-copy
 * fallback that works where the async API is refused. */
async function copyText(text, say) {
  const value = String(text == null ? '' : text)
  if (!value.trim()) { if (say) say('there is nothing to copy here'); return false }
  let told = false
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(value)
      if (say) say('copied to the clipboard')
      return true
    }
  } catch { told = true /* refused — fall through to the legacy path */ }
  try {
    const ta = document.createElement('textarea')
    ta.value = value
    ta.setAttribute('readonly', 'true')
    ta.style.cssText = 'position:fixed;top:-1000px;left:-1000px;opacity:0'
    document.body.appendChild(ta)
    ta.select()
    const done = document.execCommand ? document.execCommand('copy') : false
    ta.remove()
    if (say) say(done ? 'copied to the clipboard'
      : 'this window will not let the page copy — select the text and press Ctrl+C')
    return !!done
  } catch {
    if (say) say(told ? 'this window will not let the page copy — select the text and press Ctrl+C'
      : 'could not reach the clipboard')
    return false
  }
}
