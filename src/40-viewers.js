/* ------------------------------------------------------------------ viewers
 * One file loader, one switch. Media goes through base64 → blob because a
 * renderer cannot attach the desktop grant to <video src>; the route it calls
 * is the same one that serves the bytes.
 */
function useFile(notebookId, name) {
  const [st, setSt] = useState({ loading: !!name, text: '', json: null, url: '', mime: '', error: '' })
  useEffect(() => {
    if (!name) { setSt({ loading: false, text: '', json: null, url: '', mime: '', error: '' }); return undefined }
    let live = true
    let made = ''
    setSt({ loading: true, text: '', json: null, url: '', mime: '', error: '' })
    api(`/artifact?${qs({ notebook: notebookId, name, b64: 1 })}`, { timeoutMs: 90000 })
      .then((out) => {
        if (!live) return
        const raw = atob(out.b64 || '')
        const bytes = new Uint8Array(raw.length)
        for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i)
        const isText = (out.mime || '').startsWith('text/') || /^(md|txt|json|csv)$/.test(out.ext)
        if (isText) {
          const text = new TextDecoder().decode(bytes)
          let json = null
          if (out.ext === 'json') { try { json = JSON.parse(text) } catch { json = null } }
          setSt({ loading: false, text, json, url: '', mime: out.mime, error: '' })
        } else {
          made = URL.createObjectURL(new Blob([bytes], { type: out.mime || 'application/octet-stream' }))
          setSt({ loading: false, text: '', json: null, url: made, mime: out.mime, bytes: out.bytes, error: '' })
        }
      })
      .catch((e) => { if (live) setSt({ loading: false, text: '', json: null, url: '', mime: '', error: e.message || String(e) }) })
    return () => { live = false; if (made) URL.revokeObjectURL(made) }
  }, [notebookId, name])
  return st
}

function Viewer({ artifact, notebook, onCite, onRegenerate, regenerating, onChanged }) {
  const [renOpen, setRenOpen] = useState(false)
  const [renVal, setRenVal] = useState('')
  const [renBusy, setRenBusy] = useState(false)
  const files = artifact.files || []
  const saveRename = async () => {
    setRenBusy(true)
    try {
      await api('/artifact/rename', {
        method: 'POST',
        body: { notebook: notebook.id, key: artifact.key, title: renVal.trim() },
        timeoutMs: 30000
      })
      setRenOpen(false)
      if (onChanged) onChanged()
    } catch { /* rename is best-effort */ } finally { setRenBusy(false) }
  }
  const jsonName = (files.find((f) => f.ext === 'json') || {}).name || ''
  const txtName = (files.find((f) => f.ext === 'txt') || {}).name || ''
  const primary = useFile(notebook.id, artifact.primary)
  const asJson = useFile(notebook.id, jsonName)
  const asTxt = useFile(notebook.id, txtName)

  const downloading = (url, name) => {
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = name || 'artifact'
    document.body.appendChild(a); a.click(); a.remove()
  }

  let body
  if (primary.error) body = el('div', { className: 'nb-view-body', style: { color: T.danger }, children: primary.error })
  else if (primary.loading) body = el('div', { className: 'nb-view-body' }, el('div', { className: 'nb-hint', children: 'loading artifact…' }))
  else if (artifact.kind === 'video_overview') {
    body = jsx(VideoView, { src: primary.url, json: asJson.json, text: asTxt.text })
  } else if (artifact.kind === 'audio_overview') {
    body = jsx(AudioView, { src: primary.url, json: asJson.json, text: asTxt.text })
  } else if (artifact.kind === 'mind_map') {
    body = jsx(MindMapView, { data: asJson.json, text: primary.text })
  } else if (artifact.kind === 'flashcards') {
    body = jsx(FlashcardsView, { data: asJson.json, text: primary.text, key: artifact.key })
  } else if (artifact.kind === 'quiz') {
    body = jsx(QuizView, { data: asJson.json, text: primary.text })
  } else if (artifact.kind === 'slides') {
    body = jsx(SlidesView, { data: asJson.json, text: primary.text, htmlUrl: primary.url && artifact.ext === 'html' ? primary.url : '' })
  } else if (artifact.kind === 'infographic') {
    body = jsx(InfographicView, { src: primary.url, data: asJson.json })
  } else if (artifact.kind === 'data_table') {
    body = jsx(DataTableView, { text: primary.text, name: artifact.primary })
  } else if (artifact.kind === 'timeline') {
    body = jsx(TimelineView, { text: primary.text, onCite })
  } else {
    body = el('div', { className: 'nb-view-body' },
      el('div', { className: 'nb-doc' }, jsx(Markdown, { text: primary.text, onCite })))
  }

  return el('div', { className: 'nb-view' },
    el('div', { className: 'nb-view-head' },
      el('span', { className: 'nb-chip', 'data-tone': 'accent', children: artifact.label }),
      el('div', { style: { flex: 1, minWidth: 0 } },
        el('div', { className: 'nb-view-title', children: artifact.title || (asJson.json && (asJson.json.title || asJson.json.topic)) || prettyFile(artifact.primary) }),
        el('div', { style: { fontSize: '12.5px', color: T.text4 },
          children: `${artifact.files.length} file${artifact.files.length === 1 ? '' : 's'} · ${Math.max(1, Math.round(artifact.bytes / 1024))} KB · ${ago(artifact.modified)}` })),
      primary.text
        ? jsx(IconBtn, {
            icon: 'copy', label: 'Copy artifact text',
            onClick: () => { try { navigator.clipboard.writeText(primary.text) } catch { /* clipboard may be unavailable */ } }
          })
        : null,
      jsx(IconBtn, {
        icon: 'download', label: `Download ${artifact.label}`,
        onClick: () => downloading(primary.url, artifact.primary)
      }),
      onRegenerate ? jsx(IconBtn, {
        icon: 'refresh', label: `Regenerate ${artifact.label}`,
        active: !!regenerating, disabled: !!regenerating,
        onClick: onRegenerate
      }) : null,
      jsx(IconBtn, {
        icon: 'pencil', label: 'Rename this artifact',
        onClick: () => { setRenVal(artifact.title || ''); setRenOpen(true) }
      })
    ),
    body,
    renOpen
      ? jsx(Dialog, {
          open: true, onClose: () => setRenOpen(false), title: 'Name this artifact', width: 420,
          children: el('div', { style: { display: 'grid', gap: '12px' } },
            el('input', {
              className: 'nb-genopt-text', type: 'text', autoFocus: true,
              placeholder: prettyFile(artifact.primary), value: renVal,
              onChange: (e) => setRenVal(e.target.value),
              onKeyDown: (e) => { if (e.key === 'Enter' && !renBusy) saveRename() }
            }),
            el('div', { className: 'nb-hint', children: 'A display name only — the files keep their generated names.' }),
            el('div', { style: { display: 'flex', gap: '8px', justifyContent: 'flex-end' } },
              jsx(Btn, { size: 'sm', onClick: () => setRenOpen(false), children: 'Cancel' }),
              jsx(Btn, {
                size: 'sm', variant: 'primary', disabled: renBusy,
                onClick: saveRename,
                children: renBusy ? 'Saving…' : 'Save'
              })))
        })
      : null
  )
}

const prettyFile = (name) => {
  const stem = String(name || '').replace(/\.[a-z0-9]+$/i, '')
  return stem.replace(/^\d{8}-\d{6}-/, '').replace(/_/g, ' ')
}

/* --------------------------------------------------------------- video */

function VideoView({ src, json, text }) {
  const segs = (json && (json.segments || json.beats || json.scenes)) || []
  return el('div', { className: 'nb-view-body' },
    el('div', { className: 'nb-stage' },
      el('div', { className: 'nb-screen' },
        src
          ? el('video', { src, controls: true, playsInline: true, preload: 'metadata' })
          : el('div', { className: 'nb-hint', children: 'the video file did not load' })),
      el('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
        el('span', { className: 'nb-chip', 'data-tone': 'ok', children: 'mp4 · h264' }),
        json && json.title ? el('span', { style: { fontSize: '15px', fontWeight: 600 }, children: json.title }) : null,
        el('span', { style: { flex: 1 } }),
        el('span', { className: 'nb-hint', children: segs.length ? `${segs.length} beats` : 'narrated slideshow' })),
      segs.length
        ? el('ol', { className: 'nb-timeline', 'aria-label': 'Video chapters' },
            segs.map((s, i) => el('li', { className: 'nb-tl', key: `s${i}` },
              el('span', { className: 'nb-tl-when', children: `BEAT ${i + 1}` }),
              el('span', { className: 'nb-tl-what' },
                el('b', { children: s.headline || s.title || s.label || '' }),
                s.sub || s.subline ? el('span', { style: { color: T.text3 }, children: ` — ${s.sub || s.subline}` }) : null,
                s.text || s.narration
                  ? el('span', { style: { display: 'block', color: T.text3, marginTop: '3px', fontSize: '14px' }, children: s.text || s.narration })
                  : null))))
        : (text ? el('pre', { className: 'nb-mono', style: { whiteSpace: 'pre-wrap', color: T.text3, fontSize: '13.5px' }, children: text }) : null))
  )
}

/* --------------------------------------------------------------- audio */

function AudioView({ src, json, text }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [t, setT] = useState(0)
  const [dur, setDur] = useState(0)
  const [rate, setRate] = useState(1)
  const speakers = new Set(((json && json.segments) || []).map((s) => s && s.speaker).filter(Boolean))
  const hostLabel = speakers.size > 1 ? 'TWO HOSTS' : speakers.size === 1 ? 'ONE NARRATOR' : 'AUDIO'

  const lines = useMemo(() => {
    const out = []
    for (const raw of String(text || '').split('\n')) {
      let l = raw.trim()
      if (!l) continue
      if (/^#\s/.test(l)) { out.push({ who: '', text: l.replace(/^#\s*/, ''), head: true }); continue }
      if (/^[_*]{1,2}[^_*].*[_*]{1,2}$/.test(l) && l.length < 160) {
        out.push({ who: '', text: l.replace(/^[_*]+|[_*]+$/g, ''), meta: true })
        continue
      }
      // "**Host A:** text" and "Host A: text" both appear in the transcript file
      l = l.replace(/\*\*/g, '')
      const m = /^\[?\s*(host\s*[ab]|speaker\s*\d+)\s*\]?\s*[:—-]\s*(.*)$/i.exec(l)
      if (m) {
        const who = /b|2/i.test(m[1]) ? 'B' : 'A'
        out.push({ who, text: m[2] })
        continue
      }
      if (out.length) out.push({ who: out[out.length - 1].who, text: l })
    }
    return out
  }, [text])

  const bars = useMemo(() => {
    const n = 64
    const seedText = (json && json.title) || String(text || '').slice(0, 80) || 'overview'
    let x = 0
    for (let i = 0; i < seedText.length; i += 1) x = (x * 31 + seedText.charCodeAt(i)) % 100000
    const out = []
    for (let i = 0; i < n; i += 1) {
      x = (x * 1103515245 + 12345) % 2147483648
      const base = 0.22 + Math.abs(Math.sin(i / 5)) * 0.5
      out.push(Math.max(0.14, Math.min(1, base + (x % 100) / 260)))
    }
    return out
  }, [text, json])

  const progress = dur ? t / dur : 0

  return el('div', { className: 'nb-view-body' },
    el('div', { className: 'nb-stage' },
      el('div', { className: 'nb-screen nb-screen-audio', style: { aspectRatio: 'auto' } },
        el('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
          el('span', { className: 'nb-chip', 'data-tone': 'accent', children: hostLabel }),
          el('span', { style: { fontSize: '16px', fontWeight: 620, color: '#eee' },
            children: (json && json.title) || 'Audio Overview' }),
          el('span', { style: { flex: 1 } }),
          el('span', { className: 'nb-mono', style: { fontSize: '12.5px', color: '#9aa0b5' },
            children: `${fmtTime(t)} / ${dur ? fmtTime(dur) : '—'}` })),
        el('div', {
          className: 'nb-wave', role: 'img',
          'aria-label': `waveform, ${Math.round(progress * 100)} percent played`,
          onClick: (e) => {
            const box = e.currentTarget.getBoundingClientRect()
            const frac = Math.min(1, Math.max(0, (e.clientX - box.left) / box.width))
            const el2 = audioRef.current
            if (el2 && dur) { el2.currentTime = frac * dur; setT(el2.currentTime) }
          },
          style: { cursor: 'pointer' }
        }, bars.map((h, i) => jsx('i', {
          key: `b${i}`,
          style: { height: `${Math.round(h * 100)}%` },
          'data-past': i / bars.length <= progress ? 'true' : 'false'
        }))),
        el('div', { className: 'nb-ctrl' },
          el('button', {
            type: 'button', className: 'nb-icon', 'aria-label': playing ? 'Pause' : 'Play',
            onClick: () => {
              const a = audioRef.current
              if (!a) return
              if (a.paused) { a.play(); setPlaying(true) } else { a.pause(); setPlaying(false) }
            },
            style: { background: 'rgba(255,255,255,.1)', width: '40px', height: '40px' },
            children: jsx(Glyph, { name: playing ? 'pause' : 'play', size: 16 })
          }),
          el('input', {
            type: 'range', min: 0, max: 100, value: Math.round(progress * 100),
            'aria-label': 'Scrub audio', style: { flex: 1, accentColor: T.accent },
            onChange: (e) => {
              const a = audioRef.current
              if (a && dur) { a.currentTime = (Number(e.target.value) / 100) * dur }
            }
          }),
          el('button', {
            type: 'button', className: 'nb-chip', 'data-click': 'true',
            'aria-label': 'Playback speed', title: 'Playback speed',
            style: { background: 'rgba(255,255,255,.12)', color: '#cfd3e0', borderColor: 'transparent', cursor: 'pointer' },
            onClick: () => {
              const rates = [0.75, 1, 1.25, 1.5, 2]
              const next = rates[(rates.indexOf(rate) + 1) % rates.length]
              const a = audioRef.current
              if (a) a.playbackRate = next
              setRate(next)
            },
            children: `${rate}×`
          })),
        el('audio', {
          ref: audioRef, src: src || undefined, preload: 'metadata',
          onTimeUpdate: (e) => setT(e.currentTarget.currentTime),
          onLoadedMetadata: (e) => setDur(e.currentTarget.duration || 0),
          onEnded: () => setPlaying(false),
          style: { display: 'none' }
        })),
      lines.length
        ? el('div', { className: 'nb-doc', style: { maxWidth: '100%' } },
            el('div', { className: 'nb-meta', style: { marginBottom: '10px' }, children: 'Transcript' }),
            lines.map((l, i) => jsx(TranscriptLine, { line: l, first: i === 0 }, `l${i}`)))
        : null)
  )
}

function TranscriptLine({ line, first }) {
  if (line.head) {
    return jsx('div', {
      style: { fontSize: '17px', fontWeight: 650, letterSpacing: '-.01em', margin: '0 0 6px' },
      children: line.text
    })
  }
  if (line.meta) {
    return jsx('div', {
      style: { fontSize: '12.5px', color: T.text4, marginBottom: '10px' },
      children: line.text
    })
  }
  return el('div', {
    style: {
      display: 'grid', gridTemplateColumns: '26px 1fr', gap: '10px',
      padding: '7px 0', borderTop: first ? 'none' : `1px solid ${T.lineSoft}`
    }
  },
  jsx('span', {
    style: {
      fontSize: '11.5px', fontWeight: 700, letterSpacing: '.04em',
      color: line.who === 'B' ? T.purple : T.accent,
      fontFamily: 'var(--ui-font-mono, ui-monospace, monospace)'
    },
    children: line.who || '·'
  }),
  jsx('span', { style: { fontSize: '15px', lineHeight: 1.55, color: T.text2 }, children: line.text }))
}

const fmtTime = (s) => {
  const v = Math.max(0, Math.round(Number(s) || 0))
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`
}

/* --------------------------------------------------------------- mind map */

function MindMapView({ data, text }) {
  const tree = useMemo(() => (data && data.children ? data : parseMindMapMd(text)), [data, text])
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const drag = useRef(null)
  const { nodes, width, height } = useMemo(() => layoutTree(tree), [tree])

  if (!nodes.length) {
    return el('div', { className: 'nb-view-body' },
      jsx('div', { className: 'nb-hint', children: 'no mind map structure in this artifact' }))
  }

  const nodeEls = nodes.map((n, i) => jsx('g', { key: `n${i}`, children: [
    n.parent >= 0
      ? jsx('path', {
          d: curve(nodes[n.parent], n),
          fill: 'none',
          stroke: `color-mix(in srgb, ${T.accent} ${n.depth === 1 ? 52 : 34}%, transparent)`,
          strokeWidth: n.depth === 1 ? 1.8 : 1.3
        })
      : null,
    jsx('rect', {
      x: n.x - n.w / 2, y: n.y - n.h / 2, width: n.w, height: n.h, rx: 9,
      fill: n.depth === 0
        ? `color-mix(in srgb, ${T.accent} 24%, transparent)`
        : n.depth === 1
          ? `color-mix(in srgb, ${T.accent} 9%, var(--ui-bg-primary, #101116))`
          : 'var(--ui-bg-primary, #101116)',
      stroke: `color-mix(in srgb, ${T.accent} ${n.depth === 0 ? 62 : n.depth === 1 ? 34 : 20}%, transparent)`
    }),
    jsx('text', {
      x: n.x, y: n.y + (n.depth === 0 ? 5 : 4), textAnchor: 'middle',
      fill: n.depth === 0 ? T.text : n.depth === 1 ? T.text : T.text2,
      fontSize: n.depth === 0 ? 18 : n.depth === 1 ? 16 : 14.5,
      fontWeight: n.depth <= 1 ? 660 : 500,
      children: n.label
    }),
    n.detail ? jsx('title', { children: `${n.label} — ${n.detail}` }) : null
  ].filter(Boolean) }))

  const canvas = jsx('svg', {
    className: 'nb-map', viewBox: `0 0 ${width} ${height}`, role: 'img',
    'aria-label': `Mind map: ${(tree && tree.label) || 'root'} with ${nodes.length} nodes`,
    preserveAspectRatio: 'xMidYMid meet',
    onWheel: (e) => {
      e.preventDefault()
      setZoom((z) => Math.min(2.4, Math.max(0.55, z - e.deltaY * 0.0012)))
    },
    onPointerDown: (e) => {
      drag.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
      if (e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId)
    },
    onPointerMove: (e) => {
      if (drag.current) setPan({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y })
    },
    onPointerUp: () => { drag.current = null },
    onPointerCancel: () => { drag.current = null },
    children: el('g', {
      transform: `translate(${pan.x} ${pan.y}) translate(${width / 2} ${height / 2}) scale(${zoom}) translate(${-width / 2} ${-height / 2})`
    }, nodeEls)
  })

  const toolbar = el('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' } },
    jsx('span', { className: 'nb-hint', children: `${nodes.length} nodes · drag to pan · scroll to zoom · hover a node for its detail` }),
    el('span', { style: { flex: 1 } }),
    jsx(Btn, {
      size: 'sm', icon: 'grid', children: 'Reset view',
      onClick: () => { setZoom(1); setPan({ x: 0, y: 0 }) }
    }))

  return el('div', { className: 'nb-view-body', style: { padding: '12px', display: 'flex', flexDirection: 'column' } },
    toolbar,
    el('div', { style: { flex: 1, minHeight: '340px' } }, canvas))
}

function curve(a, b) {
  const mx = (a.x + b.x) / 2
  return `M${a.x},${a.y} C${mx},${a.y} ${mx},${b.y} ${b.x},${b.y}`
}

function layoutTree(tree) {
  const nodes = []
  if (!tree) return { nodes, width: 900, height: 560 }

  const labelOf = (n) => String(n.label || n.title || 'node')
  const measure = (label, depth) => {
    const fs = depth === 0 ? 18 : depth === 1 ? 16 : 14.5
    const w = Math.min(232, 26 + label.length * fs * 0.58)
    return { w, h: depth === 0 ? 44 : 34 }
  }

  // depth-first with a leaf cursor: leaves get one slot each, parents centre on
  // their children — the layout a mind map is actually read with.
  let cursor = 0
  const rowH = 38
  const walk = (node, depth, parent) => {
    const kids = (node.children || []).filter((c) => c && typeof c === 'object').slice(0, 8)
    const index = nodes.length
    nodes.push({ label: '', detail: node.detail || '', depth, parent, x: 0, y: 0, w: 0, h: 0 })
    let y
    if (!kids.length) {
      y = cursor * rowH
      cursor += 1
    } else {
      const ys = kids.map((c) => walk(c, depth + 1, index))
      y = (ys[0] + ys[ys.length - 1]) / 2
    }
    const label = labelOf(node)
    const { w, h } = measure(label, depth)
    nodes[index] = { ...nodes[index], label, x: 0, y, w, h }
    return y
  }
  walk(tree, 0, -1)

  // x per depth = running maximum width of the previous column + a gap
  const byDepth = []
  for (const n of nodes) {
    byDepth[n.depth] = Math.max(byDepth[n.depth] || 0, n.w)
  }
  const gap = 58
  const pad = 34
  const xs = []
  let x = pad
  for (let d = 0; d < byDepth.length; d += 1) {
    xs[d] = x + byDepth[d] / 2
    x += byDepth[d] + gap
  }
  for (const n of nodes) n.x = xs[n.depth]

  const width = Math.max(420, x - gap + pad)
  const height = Math.max(240, (Math.max(cursor, 1) - 1) * rowH + 64)
  for (const n of nodes) n.y += 30
  return { nodes, width, height }
}

function parseMindMapMd(text) {
  // the .md render writes "- label — detail" with 2-space depth
  const lines = String(text || '').split('\n')
  const root = { label: 'Mind map', children: [] }
  const stack = [{ node: root, depth: -1 }]
  for (const line of lines) {
    const m = /^(\s*)-\s+(.*)$/.exec(line)
    if (!m) continue
    const depth = Math.floor(m[1].length / 2)
    const [label, detail] = m[2].split(' — ')
    const node = { label: label.trim(), detail: (detail || '').trim(), children: [] }
    while (stack.length && stack[stack.length - 1].depth >= depth) stack.pop()
    const parent = stack.length ? stack[stack.length - 1].node : root
    parent.children.push(node)
    stack.push({ node, depth })
  }
  return root.children.length ? root : null
}

/* ------------------------------------------------------------ flashcards */

function FlashcardsView({ data, text }) {
  const cards = (data && data.cards) || []
  const [i, setI] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [known, setKnown] = useState(() => persist.get('known:cards', {}) || {})

  useEffect(() => { setI(0); setFlipped(false) }, [cards.length])
  if (!cards.length) {
    return el('div', { className: 'nb-view-body' }, el('div', { className: 'nb-doc' }, jsx(Markdown, { text })))
  }
  const card = cards[Math.min(i, cards.length - 1)]
  const mark = (val) => {
    const next = { ...known, [i]: val }
    setKnown(next); persist.set('known:cards', next)
    setFlipped(false)
    setI((n) => Math.min(cards.length - 1, n + 1))
  }
  const knownCount = Object.values(known).filter(Boolean).length

  return el('div', { className: 'nb-view-body' },
    el('div', { className: 'nb-deck' },
      el('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
        jsx('span', { className: 'nb-chip', 'data-tone': Object.keys(known).length ? 'ok' : undefined,
          children: `${knownCount} known` }),
        jsx('span', { className: 'nb-hint', children: `card ${i + 1} of ${cards.length}` }),
        el('span', { style: { flex: 1 } }),
        jsx(Btn, {
          size: 'sm', icon: 'refresh', children: 'Restart',
          onClick: () => { setI(0); setFlipped(false); setKnown({}); persist.set('known:cards', {}) }
        })),
      jsx('button', {
        type: 'button', className: 'nb-flip', 'data-flipped': flipped ? 'true' : 'false',
        onClick: () => setFlipped((f) => !f),
        'aria-label': flipped ? 'Show the question again' : 'Show the answer',
        children: el('div', { className: 'nb-flip-inner' },
          el('div', { className: 'nb-face', 'data-side': 'front' },
            jsx('span', { className: 'nb-meta', children: 'question' }),
            jsx('span', { children: card.front }),
            jsx('span', { className: 'nb-face-hint', children: 'click the card — or press “Show answer” — to flip' })),
          el('div', { className: 'nb-face', 'data-side': 'back' },
            jsx('span', { className: 'nb-meta', children: 'answer' }),
            jsx('span', { children: card.back }),
            card.source ? jsx('span', { style: { fontSize: '13px', color: T.text3, marginTop: 'auto' }, children: card.source }) : null))
      }),
      el('div', { style: { display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' } },
        jsx(Btn, {
          icon: 'arrowLeft', disabled: i === 0, children: 'Prev',
          onClick: () => { setFlipped(false); setI((n) => Math.max(0, n - 1)) }
        }),
        flipped
          ? jsx(Btn, { icon: 'close', onClick: () => mark(false), children: 'Again' })
          : jsx(Btn, {
              variant: 'primary', icon: 'refresh', children: 'Show answer',
              onClick: () => setFlipped(true)
            }),
        flipped
          ? jsx(Btn, { variant: 'primary', icon: 'check', onClick: () => mark(true), children: 'Got it' })
          : null,
        jsx(Btn, {
          icon: 'arrowRight', disabled: i === cards.length - 1, children: 'Next',
          onClick: () => { setFlipped(false); setI((n) => Math.min(cards.length - 1, n + 1)) }
        })),
      el('div', { className: 'nb-bar-track', style: { maxWidth: '100%' } },
        el('div', { className: 'nb-bar-fill', style: { width: `${((i + 1) / cards.length) * 100}%` } })))
  )
}

/* ------------------------------------------------------------------ quiz */

function QuizView({ data, text }) {
  const questions = (data && (data.questions || data.items)) || []
  const [picked, setPicked] = useState({})
  if (!questions.length) {
    return el('div', { className: 'nb-view-body' }, el('div', { className: 'nb-doc' }, jsx(Markdown, { text })))
  }
  const score = questions.reduce((acc, q, i) => {
    const chosen = picked[i]
    if (chosen === undefined) return acc
    return acc + (normAnswer(chosen) === normAnswer(q.answer) ? 1 : 0)
  }, 0)
  const answered = Object.keys(picked).length
  return el('div', { className: 'nb-view-body' },
    el('div', { style: { maxWidth: '76ch' } },
      el('div', { style: { display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '14px' } },
        el('span', { className: 'nb-chip', 'data-tone': answered === questions.length ? 'ok' : 'accent',
          children: `${answered}/${questions.length} answered` }),
        answered ? el('span', { className: 'nb-chip', children: `${score} correct` }) : null,
        el('span', { style: { flex: 1 } }),
        answered ? jsx(Btn, { size: 'sm', icon: 'refresh', onClick: () => setPicked({}), children: 'Reset' }) : null),
      questions.map((q, qi) => {
        const chosen = picked[qi]
        const done = chosen !== undefined
        const right = done && normAnswer(chosen) === normAnswer(q.answer)
        return el('div', {
          key: `q${qi}`,
          style: { border: `1px solid ${T.line}`, borderRadius: '12px', padding: '14px', marginBottom: '10px', background: T.card }
        },
        el('div', { style: { display: 'flex', gap: '10px', alignItems: 'baseline' } },
          el('span', { className: 'nb-mono', style: { color: T.text4, fontSize: '12.5px' }, children: String(qi + 1).padStart(2, '0') }),
          el('span', { style: { fontSize: '15.5px', fontWeight: 600, lineHeight: 1.45 }, children: q.question })),
        el('div', { style: { display: 'grid', gap: '6px', marginTop: '10px' }, role: 'group', 'aria-label': `Choices for question ${qi + 1}` },
          (q.choices && q.choices.length ? q.choices : [q.answer]).map((c, ci) => {
            const isChosen = chosen === c
            const isRight = normAnswer(c) === normAnswer(q.answer)
            const tone = !done ? T.card : isRight ? `color-mix(in srgb, ${T.ok} 16%, transparent)` : isChosen ? `color-mix(in srgb, ${T.danger} 14%, transparent)` : T.card
            return el('button', {
              type: 'button', disabled: done, onClick: () => setPicked((p) => ({ ...p, [qi]: c })),
              'aria-pressed': isChosen,
              style: {
                minHeight: '38px', textAlign: 'left', padding: '8px 12px', borderRadius: '9px',
                border: `1px solid ${isChosen || (done && isRight) ? T.line : T.lineSoft}`,
                background: tone, color: T.text, fontSize: '14.5px', cursor: done ? 'default' : 'pointer'
              },
              children: c
            }, `c${ci}`)
          })),
        done
          ? el('div', { style: { marginTop: '10px', fontSize: '14px', color: right ? T.ok : T.warn } },
              el('b', { children: right ? 'Correct. ' : `Not quite — ${q.answer}. ` }),
              q.explanation ? el('span', { style: { color: T.text2 }, children: q.explanation }) : null)
          : null)
      }))
  )
}

const normAnswer = (s) => String(s == null ? '' : s).trim().toLowerCase()
  .replace(/^[a-d][).]\s*/, '').replace(/[^a-z0-9 ]/g, '').trim()

/* ---------------------------------------------------------------- slides */

function SlidesView({ data, htmlUrl }) {
  const deck = data || {}
  const slides = deck.slides || []
  const [i, setI] = useState(0)
  const go = useCallback((d) => setI((n) => Math.min(slides.length - 1, Math.max(0, n + d))), [slides.length])
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') { go(1); }
      else if (e.key === 'ArrowLeft') { go(-1) }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [go])

  if (!slides.length) {
    return el('div', { className: 'nb-view-body' }, el('div', { className: 'nb-hint', children: 'this deck has no slides in its json — open the html file' }))
  }
  const s = slides[i]
  return el('div', { className: 'nb-view-body' },
    el('div', { className: 'nb-stage' },
      el('div', {
        className: 'nb-screen', role: 'group', 'aria-label': `Slide ${i + 1} of ${slides.length}`,
        style: { aspectRatio: '16/9', padding: '34px 40px', placeItems: 'stretch',
          background: `linear-gradient(150deg, color-mix(in srgb, ${T.accent} 18%, #0a0b10), #08090d)`,
          cursor: 'pointer', display: 'flex', flexDirection: 'column' },
        onClick: (e) => {
          const box = e.currentTarget.getBoundingClientRect()
          go((e.clientX - box.left) / box.width > 0.5 ? 1 : -1)
        }
      },
      el('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
        el('span', { style: { fontSize: '11.5px', letterSpacing: '.14em', textTransform: 'uppercase', color: '#9aa0b5', fontWeight: 700 },
          children: deck.title || 'Deck' }),
        el('span', { style: { flex: 1 } }),
        el('span', { className: 'nb-mono', style: { fontSize: '12px', color: '#9aa0b5' }, children: `${i + 1}/${slides.length}` })),
      el('div', { style: { fontSize: '30px', fontWeight: 680, letterSpacing: '-.02em', color: '#f2f3f8', margin: '18px 0 14px', lineHeight: 1.15 }, children: s.title }),
      el('ul', { style: { margin: 0, paddingLeft: '20px', color: '#d6d8e6', fontSize: '17px', lineHeight: 1.6, display: 'grid', gap: '9px' } },
        (s.bullets || []).map((b, bi) => el('li', { children: b }, `b${bi}`))),
      s.note ? el('div', { style: { marginTop: 'auto', fontSize: '13px', color: '#8b90a3', fontStyle: 'italic' }, children: s.note }) : null),
      el('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
        jsx(Btn, { icon: 'arrowLeft', onClick: () => go(-1), disabled: i === 0, children: 'Back' }),
        jsx(Btn, { icon: 'arrowRight', onClick: () => go(1), disabled: i === slides.length - 1, children: 'Next' }),
        el('span', { style: { flex: 1 } }),
        el('div', { style: { display: 'flex', gap: '4px' }, role: 'tablist', 'aria-label': 'Slides' },
          slides.map((_, si) => el('button', {
            key: `d${si}`, type: 'button', role: 'tab', 'aria-selected': si === i,
            'aria-label': `Slide ${si + 1}`, onClick: () => setI(si),
            style: {
              width: '22px', height: '22px', border: 0, background: 'transparent', cursor: 'pointer',
              padding: 0, display: 'grid', placeItems: 'center'
            },
            children: el('span', {
              style: {
                width: '8px', height: '8px', borderRadius: '99px',
                background: si === i ? T.accent : `color-mix(in srgb, ${T.text} 22%, transparent)`
              }
            })
          }, `dot${si}`))))
  ))
}

/* ----------------------------------------------------------- infographic */

function InfographicView({ src, data }) {
  const [zoom, setZoom] = useState(1)
  return el('div', { className: 'nb-view-body' },
    el('div', { className: 'nb-stage' },
      el('div', {
        style: {
          border: `1px solid ${T.line}`, borderRadius: '18px', overflow: 'auto',
          background: '#0d1017', maxHeight: '62vh'
        }
      },
      src
        ? el('img', {
            src, alt: (data && data.title) || 'infographic',
            style: { display: 'block', width: `${Math.round(zoom * 100)}%`, height: 'auto' }
          })
        : el('div', { className: 'nb-hint', style: { padding: '20px' }, children: 'the image did not load' })),
      el('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
        jsx(Btn, { size: 'sm', onClick: () => setZoom((z) => Math.max(0.5, z - 0.15)), children: '−' }),
        jsx(Btn, { size: 'sm', onClick: () => setZoom((z) => Math.min(2, z + 0.15)), children: '+' }),
        el('span', { className: 'nb-hint', children: `${Math.round(zoom * 100)}%` }),
        el('span', { style: { flex: 1 } }),
        data && data.takeaway ? el('span', { className: 'nb-chip', 'data-tone': 'accent', children: data.takeaway }) : null))
  )
}

/* ----------------------------------------------------------- data table */

function parseCsv(text) {
  const rows = []
  let row = [], cell = '', inQ = false
  const s = String(text || '')
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i]
    if (inQ) {
      if (ch === '"') {
        if (s[i + 1] === '"') { cell += '"'; i += 1 } else inQ = false
      } else cell += ch
    } else if (ch === '"') inQ = true
    else if (ch === ',') { row.push(cell); cell = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i += 1
      row.push(cell); cell = ''
      if (row.some((c) => c !== '')) rows.push(row)
      row = []
    } else cell += ch
  }
  if (cell !== '' || row.length) { row.push(cell); if (row.some((c) => c !== '')) rows.push(row) }
  return rows
}

function DataTableView({ text, name }) {
  const rows = useMemo(() => parseCsv(text), [text])
  const [sort, setSort] = useState({ col: -1, dir: 1 })
  const head = rows[0] || []
  const body = rows.slice(1)
  const shown = useMemo(() => {
    if (sort.col < 0) return body
    const i = sort.col
    return [...body].sort((a, b) => {
      const x = String(a[i] || ''), y = String(b[i] || '')
      const nx = Number(x.replace(/[^0-9.\-]/g, '')), ny = Number(y.replace(/[^0-9.\-]/g, ''))
      const c = (!Number.isNaN(nx) && !Number.isNaN(ny) && x !== '' && y !== '')
        ? nx - ny : x.localeCompare(y)
      return c * sort.dir
    })
  }, [body, sort])
  const exportCsv = () => {
    const blob = new Blob([text || ''], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = name || 'table.csv'
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
  }
  if (!head.length) {
    return el('div', { className: 'nb-view-body' }, el('div', { className: 'nb-hint', children: 'empty table' }))
  }
  return el('div', { className: 'nb-view-body' },
    el('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' } },
      el('span', { className: 'nb-meta', children: `${body.length} rows × ${head.length} columns` }),
      el('span', { style: { flex: 1 } }),
      jsx(Btn, { size: 'sm', icon: 'download', onClick: exportCsv, children: 'Export CSV' })),
    el('div', { className: 'nb-dt-wrap' },
      el('table', { className: 'nb-dt' },
        el('thead', null, el('tr', null,
          head.map((h, i) => el('th', {
            key: i, onClick: () => setSort((s) => ({ col: i, dir: s.col === i ? -s.dir : 1 })),
            'aria-sort': sort.col === i ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none',
            children: [h, sort.col === i ? el('span', { className: 'nb-dt-arrow', children: sort.dir > 0 ? '↑' : '↓' }) : null]
          }, `h${i}`)))),
        el('tbody', null,
          shown.map((r, ri) => el('tr', { key: `r${ri}` },
            head.map((_, ci) => el('td', { key: `c${ci}`, children: String(r[ci] || '') }, `c${ci}`))))))))
}

/* ------------------------------------------------------------- timeline */

function TimelineView({ text, onCite }) {
  const rows = useMemo(() => {
    const out = []
    for (const line of String(text || '').split('\n')) {
      const m = /^\s*[-*]\s*(?:\*\*)?([0-9]{3,4}[^—\-:\*]*|[A-Z][a-z]{2,8}\.?\s+[0-9]{1,2},?\s+[0-9]{4})(?:\*\*)?\s*[—\-:]\s*(.+)$/.exec(line)
      if (m) out.push({ when: m[1].trim().replace(/\*\*/g, ''), what: m[2].trim() })
    }
    return out
  }, [text])
  if (rows.length < 3) {
    return el('div', { className: 'nb-view-body' }, el('div', { className: 'nb-doc' }, jsx(Markdown, { text, onCite })))
  }
  return el('div', { className: 'nb-view-body' },
    el('div', { style: { maxWidth: '72ch' } },
      el('ol', { className: 'nb-timeline', 'aria-label': 'Timeline' },
        rows.map((r, i) => el('li', { className: 'nb-tl', key: `t${i}` },
          el('span', { className: 'nb-tl-when', children: r.when }),
          el('span', { className: 'nb-tl-what', children: jsx(Markdown, { text: r.what, onCite }) })))))
  )
}
