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

function Viewer({ artifact, notebook, onCite, onRegenerate, regenerating, onChanged, onPrevRun, onNextRun, runPos, onClose }) {
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
    body = jsx(AudioView, { src: primary.url, json: asJson.json, text: asTxt.text, notebook, onChanged })
  } else if (artifact.kind === 'mind_map') {
    body = jsx(MindMapView, { data: asJson.json, text: primary.text })
  } else if (artifact.kind === 'flashcards') {
    body = jsx(FlashcardsView, { data: asJson.json, text: primary.text, key: artifact.key, deckId: artifact.key })
  } else if (artifact.kind === 'quiz') {
    body = jsx(QuizView, { data: asJson.json, text: primary.text, deckId: artifact.key })
  } else if (artifact.kind === 'slides') {
    body = jsx(SlidesView, { data: asJson.json, text: primary.text, notebook, jsonName,
                             htmlUrl: primary.url && artifact.ext === 'html' ? primary.url : '' })
  } else if (artifact.kind === 'infographic' || artifact.kind === 'blueprint_evolution') {
    // The blueprint is an SVG poster like an infographic: same stage, same
    // zoom, same style chip. A separate viewer would be the same code twice.
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
    // ONE 44px toolbar: category badge, the artifact's name, a human-readable
    // provenance line, then the icon actions. There is no second sub-header and
    // no "<notebook> — <kind>" H1 anywhere below it: the tab above already names
    // the kind, and the file's size in bytes is not something a reader needs.
    el('div', { className: 'nb-view-head' },
      el('span', { className: 'nb-chip', 'data-tone': 'accent', children: artifact.label }),
      el('div', { style: { flex: '1 1 auto', minWidth: 0 } },
        el('div', { className: 'nb-view-title',
          title: artifact.title || (asJson.json && (asJson.json.title || asJson.json.topic)) || artifact.primary,
          children: artifact.title || (asJson.json && (asJson.json.title || asJson.json.topic)) || prettyFile(artifact.primary) }),
        el('div', { className: 'nb-view-sub',
          title: optsSummary(artifact.opts) || undefined,
          children: `Updated ${ago(artifact.modified) || 'just now'} · ${artifact.files.length} file${artifact.files.length === 1 ? '' : 's'}${runPos ? ` · version ${runPos}` : ''}${optsSummary(artifact.opts) ? ` · ${optsSummary(artifact.opts)}` : ''}` })),
      el('div', { className: 'nb-view-acts' },
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
        onPrevRun ? jsx(IconBtn, { icon: 'arrowLeft', label: 'Older version', onClick: onPrevRun }) : null,
        onNextRun ? jsx(IconBtn, { icon: 'arrowRight', label: 'Newer version', onClick: onNextRun }) : null,
        onRegenerate ? jsx(IconBtn, {
          icon: 'refresh', label: `Regenerate ${artifact.label}`,
          active: !!regenerating, disabled: !!regenerating,
          onClick: onRegenerate
        }) : null,
        jsx(IconBtn, {
          icon: 'pencil', label: 'Rename this artifact',
          onClick: () => { setRenVal(artifact.title || ''); setRenOpen(true) }
        }),
        onClose ? jsx(IconBtn, {
          icon: 'close', label: 'Close this tab — back to chat', onClick: onClose
        }) : null)
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
  const videoRef = useRef(null)
  const [t, setT] = useState(0)
  // timed segments (newer scripts) make chapters seekable + highlight the beat
  const timed = segs.length > 0 && segs.every((s) => s && typeof s.start === 'number')
  const activeSeg = timed
    ? segs.reduce((acc, s, i) => (s.start <= t ? i : acc), -1)
    : -1
  const seekSeg = (i) => {
    const v = videoRef.current
    const seg = segs[i]
    if (v && seg) { v.currentTime = seg.start; setT(seg.start) }
  }
  return el('div', { className: 'nb-view-body' },
    el('div', { className: 'nb-stage' },
      el('div', { className: 'nb-screen' },
        src
          ? el('video', {
              ref: videoRef, src, controls: true, playsInline: true, preload: 'metadata',
              onTimeUpdate: (e) => setT(e.currentTarget.currentTime)
            })
          : el('div', { className: 'nb-hint', children: 'the video file did not load' })),
      el('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
        el('span', { className: 'nb-chip', 'data-tone': 'ok', children: 'mp4 · h264' }),
        json && json.title ? el('span', { style: { fontSize: '15px', fontWeight: 600 }, children: json.title }) : null,
        el('span', { style: { flex: 1 } }),
        el('span', { className: 'nb-hint', children: segs.length ? `${segs.length} beats` : 'narrated slideshow' })),
      segs.length
        ? el('ol', { className: 'nb-timeline', 'aria-label': 'Video chapters' },
            segs.map((s, i) => el('li', {
              className: 'nb-tl', key: `s${i}`,
              role: timed ? 'button' : undefined,
              tabIndex: timed ? 0 : undefined,
              'aria-label': timed ? `Play from ${fmtTime(s.start)}` : undefined,
              onClick: timed ? () => seekSeg(i) : undefined,
              onKeyDown: timed ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); seekSeg(i) } } : undefined,
              style: timed ? { cursor: 'pointer' } : undefined,
              children: [
                el('span', { className: 'nb-tl-when',
                  style: timed && i === activeSeg ? { color: T.accent } : undefined,
                  children: timed ? fmtTime(s.start) : `BEAT ${i + 1}` }),
                el('span', { className: 'nb-tl-what',
                  style: timed && i === activeSeg ? { color: T.text } : undefined,
                  children: [
                    el('b', { children: s.headline || s.title || s.label || '' }),
                    s.sub || s.subline ? el('span', { style: { color: T.text3 }, children: ` — ${s.sub || s.subline}` }) : null,
                    s.text || s.narration
                      ? el('span', { style: { display: 'block', color: T.text3, marginTop: '3px', fontSize: '14px' }, children: s.text || s.narration })
                      : null] })
              ]
            })))
        : (text ? el('pre', { className: 'nb-mono', style: { whiteSpace: 'pre-wrap', color: T.text3, fontSize: '13px' }, children: text }) : null))
  )
}

/* One media element plays at a time in this page, so playback is one machine:
 * idle → loading → playing → paused | ended, plus error. The element's own events
 * drive it, and `playing` is read from the state instead of mirrored in a boolean
 * that can disagree with what the audio is actually doing. */
const PLAYER = Machine('player', {
  initial: 'idle',
  context: { duration: 0, error: '' },
  states: {
    idle: { on: { LOAD: 'loading', RESET: 'idle' } },
    loading: {
      tags: ['busy'],
      on: {
        META: { target: 'paused', action: (c, p) => ({ duration: (p && p.duration) || 0 }) },
        PLAY: 'playing',
        ERROR: { target: 'error', action: (c, p) => ({ error: (p && p.message) || 'this file could not be played' }) },
        RESET: { target: 'idle', action: () => ({ duration: 0, error: '' }) }
      }
    },
    playing: {
      on: {
        PAUSE: 'paused',
        END: 'ended',
        PLAY: 'playing',
        ERROR: { target: 'error', action: (c, p) => ({ error: (p && p.message) || 'playback stopped' }) },
        RESET: { target: 'idle', action: () => ({ duration: 0, error: '' }) }
      }
    },
    paused: {
      on: {
        PLAY: 'playing',
        END: 'ended',
        ERROR: { target: 'error', action: (c, p) => ({ error: (p && p.message) || 'playback stopped' }) },
        RESET: { target: 'idle', action: () => ({ duration: 0, error: '' }) }
      }
    },
    ended: { on: { PLAY: 'playing', RESET: { target: 'idle', action: () => ({ duration: 0, error: '' }) } } },
    error: { on: { LOAD: 'loading', RESET: { target: 'idle', action: () => ({ error: '' }) } } }
  }
})

/* Re-voicing a script is its own machine: idle → rendering → done | failed, with
 * the script text kept so a failure does not lose the edit. */
const REVOICE = Machine('revoice', {
  initial: 'idle',
  context: { error: '' },
  states: {
    idle: { on: { RENDER: 'rendering', DISCARD: 'idle' } },
    rendering: {
      tags: ['busy'],
      on: {
        DONE: { target: 'idle', action: () => ({ error: '' }) },
        FAIL: { target: 'failed', action: (c, p) => ({ error: (p && p.message) || 'the voice render failed' }) },
        DISCARD: 'idle'
      }
    },
    failed: { on: { RENDER: 'rendering', DISCARD: { target: 'idle', action: () => ({ error: '' }) } } }
  }
})

/* --------------------------------------------------------------- audio */

function AudioView({ src, json, text, notebook, onChanged }) {
  const audioRef = useRef(null)
  const player = useMachine(PLAYER)
  const revoice = useMachine(REVOICE)
  const playing = player.matches('playing')
  const [t, setT] = useState(0)
  const dur = player.ctx.duration
  const [rate, setRate] = useState(1)
  // script stage: edit the generated dialogue, then re-voice it — a new run
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(null)
  const rendering = revoice.matches('rendering')
  const renderErr = revoice.ctx.error
  const speakers = new Set(((json && json.segments) || []).map((s) => s && s.speaker).filter(Boolean))
  const hostLabel = speakers.size > 1 ? 'TWO HOSTS' : speakers.size === 1 ? 'ONE NARRATOR' : 'AUDIO'
  // segments carry start/end once audio.py stamps them — old artifacts don't
  const segsTimed = useMemo(() => {
    const segs = (json && json.segments) || []
    return segs.length && segs.every((s) => s && typeof s.start === 'number') ? segs : null
  }, [json])

  const lines = useMemo(() => {
    const out = []
    let segN = -1
    for (const raw of String(text || '').split('\n')) {
      let l = raw.trim()
      if (!l) continue
      if (/^#\s/.test(l)) { out.push({ who: '', text: l.replace(/^#\s*/, ''), head: true, seg: -1 }); continue }
      if (/^[_*]{1,2}[^_*].*[_*]{1,2}$/.test(l) && l.length < 160) {
        out.push({ who: '', text: l.replace(/^[_*]+|[_*]+$/g, ''), meta: true, seg: -1 })
        continue
      }
      // "**Host A:** text" and "Host A: text" both appear in the transcript file
      l = l.replace(/\*\*/g, '')
      const m = /^\[?\s*(host\s*[ab]|speaker\s*\d+)\s*\]?\s*[:—-]\s*(.*)$/i.exec(l)
      if (m) {
        segN += 1
        const who = /b|2/i.test(m[1]) ? 'B' : 'A'
        out.push({ who, text: m[2], seg: segN })
        continue
      }
      if (out.length) out.push({ who: out[out.length - 1].who, text: l, seg: out[out.length - 1].seg })
    }
    return out
  }, [text])

  const activeSeg = useMemo(() => {
    if (!segsTimed) return -1
    let idx = -1
    for (let i = 0; i < segsTimed.length; i += 1) {
      if (segsTimed[i].start <= t) idx = i
      else break
    }
    return idx
  }, [segsTimed, t])

  const seekSeg = (i) => {
    const a = audioRef.current
    const seg = segsTimed && segsTimed[i]
    if (!a || !seg) return
    a.currentTime = seg.start
    setT(seg.start)
    if (a.paused) { a.play(); PLAYER.send('PLAY') }
  }

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

  const scriptSegs = (json && Array.isArray(json.segments)) ? json.segments : []
  const canEditScript = !!(notebook && notebook.id && scriptSegs.length && !editing)

  const startEdit = () => {
    const segs = scriptSegs
      .map(s => ({ speaker: s.speaker === 'host_b' ? 'host_b' : 'host_a', text: String(s.text || '') }))
      .filter(s => s.text.trim())
    if (!segs.length) return
    setDraft({ title: (json && json.title) || 'Audio Overview', segments: segs })
    setEditing(true)
    REVOICE.send('DISCARD')
  }
  const patchSeg = (i, patch) =>
    setDraft(d => ({ ...d, segments: d.segments.map((s, j) => (j === i ? { ...s, ...patch } : s)) }))
  const delSeg = (i) =>
    setDraft(d => ({ ...d, segments: d.segments.filter((_, j) => j !== i) }))
  const addSeg = () =>
    setDraft(d => {
      const last = d.segments[d.segments.length - 1]
      const speaker = last ? (last.speaker === 'host_a' ? 'host_b' : 'host_a') : 'host_a'
      return { ...d, segments: [...d.segments, { speaker, text: '' }] }
    })
  const renderScript = async () => {
    if (!notebook || !draft) return
    if (!REVOICE.can('RENDER')) return
    REVOICE.send('RENDER')
    try {
      await api('/audio_render', {
        method: 'POST', timeoutMs: 600000,
        body: { notebook: notebook.id, script: { ...draft, voices: (json && json.voices) || {} } }
      })
      setEditing(false)
      REVOICE.send('DONE')
      if (onChanged) onChanged()
    } catch (e) {
      REVOICE.send('FAIL', { message: String((e && e.message) || e) })
    }
  }

  const scriptEditor = editing && draft
    ? el('div', { className: 'nb-doc', style: { maxWidth: '100%' } },
        el('div', {
          className: 'nb-meta',
          style: { marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }
        },
          'Script — edit lines, then re-voice',
          el('span', { style: { flex: 1 } }),
          el('button', {
            type: 'button', className: 'nb-chip', 'data-click': 'true',
            disabled: rendering,
            onClick: () => setEditing(false),
            children: 'Cancel'
          }),
          el('button', {
            type: 'button', className: 'nb-btn', 'data-variant': 'primary',
            disabled: rendering || !draft.segments.some(s => s.text.trim()),
            onClick: renderScript,
            children: rendering ? 'Rendering…' : 'Render audio'
          })),
        el('input', {
          type: 'text', value: draft.title,
          'aria-label': 'Episode title',
          style: {
            width: '100%', boxSizing: 'border-box', marginBottom: '10px',
            background: 'rgba(255,255,255,.06)', border: `1px solid ${T.lineSoft}`,
            borderRadius: '10px', color: T.text, padding: '8px 12px', fontSize: '14px'
          },
          onChange: (e) => setDraft(d => ({ ...d, title: e.target.value }))
        }),
        draft.segments.map((s, i) => el('div', {
          key: `seg${i}`,
          style: {
            display: 'grid', gridTemplateColumns: '34px 1fr 30px', gap: '8px',
            alignItems: 'start', padding: '8px 0',
            borderTop: i === 0 ? 'none' : `1px solid ${T.lineSoft}`
          }
        },
          jsx('button', {
            type: 'button',
            'aria-label': `Speaker ${s.speaker === 'host_a' ? 'A' : 'B'} — click to switch`,
            title: `Speaker ${s.speaker === 'host_a' ? 'A' : 'B'} — click to switch`,
            onClick: () => patchSeg(i, { speaker: s.speaker === 'host_a' ? 'host_b' : 'host_a' }),
            style: {
              width: '30px', height: '30px', borderRadius: '8px', cursor: 'pointer',
              border: `1px solid ${T.lineSoft}`, fontSize: '12.5px', fontWeight: 700,
              background: s.speaker === 'host_a'
                ? `color-mix(in srgb, ${T.accent} 18%, transparent)` : `color-mix(in srgb, ${T.purple} 18%, transparent)`,
              color: s.speaker === 'host_a' ? T.accent : T.purple
            },
            children: s.speaker === 'host_a' ? 'A' : 'B'
          }),
          el('textarea', {
            value: s.text, rows: Math.min(4, Math.max(2, Math.ceil(s.text.length / 70))),
            'aria-label': `Segment ${i + 1} text`,
            onChange: (e) => patchSeg(i, { text: e.target.value }),
            style: {
              width: '100%', boxSizing: 'border-box', resize: 'vertical',
              background: 'rgba(255,255,255,.05)', border: `1px solid ${T.lineSoft}`,
              borderRadius: '10px', color: T.text, padding: '8px 10px',
              fontSize: '13px', lineHeight: 1.5, fontFamily: 'inherit'
            }
          }),
          el('button', {
            type: 'button', className: 'nb-icon', 'aria-label': `Delete segment ${i + 1}`,
            onClick: () => delSeg(i),
            children: jsx(Glyph, { name: 'trash', size: 13 })
          }))),
        el('button', {
          type: 'button', className: 'nb-chip', 'data-click': 'true',
          style: { marginTop: '10px' },
          onClick: addSeg,
          children: '+ Add segment'
        }),
        renderErr
          ? el('div', {
              style: {
                marginTop: '10px', fontSize: '13px', color: T.danger,
                background: `color-mix(in srgb, ${T.danger} 10%, transparent)`,
                borderRadius: '10px', padding: '8px 12px'
              },
              children: renderErr
            })
          : null)
    : null

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
              if (a.paused) { a.play(); PLAYER.send('PLAY') } else { a.pause(); PLAYER.send('PAUSE') }
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
          }),
          canEditScript
            ? el('button', {
                type: 'button', className: 'nb-chip', 'data-click': 'true',
                'aria-label': 'Edit script', title: 'Edit script, then re-voice',
                style: { background: 'rgba(255,255,255,.12)', color: '#cfd3e0', borderColor: 'transparent', cursor: 'pointer' },
                onClick: startEdit,
                children: 'edit script'
              })
            : null),
        el('audio', {
          ref: audioRef, src: src || undefined, preload: 'metadata',
          onTimeUpdate: (e) => setT(e.currentTarget.currentTime),
          onLoadedMetadata: (e) => PLAYER.send('META', { duration: e.currentTarget.duration || 0 }),
          onEnded: () => PLAYER.send('END'),
          onPause: () => PLAYER.send('PAUSE'),
          onPlay: () => PLAYER.send('PLAY'),
          onError: () => PLAYER.send('ERROR'),
          style: { display: 'none' }
        })),
      scriptEditor
        ? scriptEditor
        : lines.length
        ? el('div', { className: 'nb-doc', style: { maxWidth: '100%' } },
            el('div', { className: 'nb-meta', style: { marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' } },
              'Transcript',
              canEditScript
                ? el('button', {
                    type: 'button', className: 'nb-chip', 'data-click': 'true',
                    style: { marginLeft: 'auto', fontSize: '11.5px' },
                    onClick: startEdit,
                    children: 'edit script → re-voice'
                  })
                : null),
            lines.map((l, i) => jsx(TranscriptLine, {
              line: l, first: i === 0,
              active: segsTimed && l.seg === activeSeg,
              seekable: !!segsTimed && l.seg >= 0,
              segStart: segsTimed && l.seg >= 0 ? segsTimed[l.seg].start : 0,
              onSeek: () => seekSeg(l.seg)
            }, `l${i}`)))
        : null)
  )
}

function TranscriptLine({ line, first, active, seekable, segStart, onSeek }) {
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
    role: seekable ? 'button' : undefined,
    tabIndex: seekable ? 0 : undefined,
    'aria-label': seekable ? `Play from ${fmtTime(segStart)}` : undefined,
    onClick: seekable ? onSeek : undefined,
    onKeyDown: seekable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSeek() } } : undefined,
    style: {
      display: 'grid', gridTemplateColumns: seekable ? '26px 1fr 44px' : '26px 1fr', gap: '10px',
      padding: '7px 10px', margin: '0 -10px', borderRadius: '8px',
      borderTop: first ? 'none' : `1px solid ${T.lineSoft}`,
      cursor: seekable ? 'pointer' : undefined,
      background: active ? `color-mix(in srgb, ${T.accent} 12%, transparent)` : undefined
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
  jsx('span', { style: { fontSize: '15px', lineHeight: 1.55, color: T.text2 }, children: line.text }),
  seekable
    ? jsx('span', {
        style: {
          fontSize: '11.5px', color: T.text4, textAlign: 'right',
          fontFamily: 'var(--ui-font-mono, ui-monospace, monospace)',
          paddingTop: '3px', fontVariantNumeric: 'tabular-nums'
        },
        children: fmtTime(segStart)
      })
    : null)
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

function FlashcardsView({ data, text, deckId }) {
  const cards = (data && data.cards) || []
  const [i, setI] = useState(0)
  const [flipped, setFlipped] = useState(false)
  // keyed per artifact — a second deck must not inherit the first's marks
  const storeKey = `known:cards:${deckId || 'default'}`
  const [known, setKnown] = useState(() => persist.get(storeKey, {}) || {})
  // order holds original card indices when shuffled — `known` keys stay stable
  const [order, setOrder] = useState(null)
  const seq = order || cards.map((_, ci) => ci)

  useEffect(() => { setI(0); setFlipped(false); setOrder(null) }, [cards.length])
  if (!cards.length) {
    return el('div', { className: 'nb-view-body' }, el('div', { className: 'nb-doc' }, jsx(Markdown, { text })))
  }
  const cardKey = seq[Math.min(i, seq.length - 1)]
  const card = cards[cardKey]
  const mark = (val) => {
    const next = { ...known, [cardKey]: val }
    setKnown(next); persist.set(storeKey, next)
    setFlipped(false)
    setI((n) => Math.min(seq.length - 1, n + 1))
  }
  const knownCount = Object.values(known).filter(Boolean).length
  const reshuffle = () => {
    const idx = cards.map((_, ci) => ci)
    for (let k = idx.length - 1; k > 0; k -= 1) {
      const j = Math.floor(Math.random() * (k + 1))
      ;[idx[k], idx[j]] = [idx[j], idx[k]]
    }
    setOrder(idx); setI(0); setFlipped(false)
  }

  return el('div', { className: 'nb-view-body' },
    el('div', { className: 'nb-deck' },
      el('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
        jsx('span', { className: 'nb-chip', 'data-tone': Object.keys(known).length ? 'ok' : undefined,
          children: `${knownCount} known` }),
        jsx('span', { className: 'nb-hint', children: `card ${i + 1} of ${cards.length}` }),
        el('span', { style: { flex: 1 } }),
        jsx(Btn, {
          size: 'sm', icon: 'shuffle', children: 'Shuffle',
          onClick: reshuffle, disabled: cards.length < 2
        }),
        jsx(Btn, {
          size: 'sm', icon: 'refresh', children: 'Restart',
          onClick: () => { setI(0); setFlipped(false); setOrder(null); setKnown({}); persist.set(storeKey, {}) }
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
          icon: 'arrowRight', disabled: i === seq.length - 1, children: 'Next',
          onClick: () => { setFlipped(false); setI((n) => Math.min(seq.length - 1, n + 1)) }
        })),
      el('div', { className: 'nb-bar-track', style: { maxWidth: '100%' } },
        el('div', { className: 'nb-bar-fill', style: { width: `${((i + 1) / seq.length) * 100}%` } })))
  )
}

/* ------------------------------------------------------------------ quiz */

function QuizView({ data, text, deckId }) {
  const questions = (data && (data.questions || data.items)) || []
  // answers persist per artifact — revisiting the deck keeps your score
  const storeKey = `quiz:picked:${deckId || 'default'}`
  const [picked, setPicked] = useState(() => persist.get(storeKey, {}) || {})
  const setAns = (qi, c) => setPicked((p) => {
    const next = { ...p, [qi]: c }
    persist.set(storeKey, next)
    return next
  })
  const reset = () => { setPicked({}); persist.set(storeKey, {}) }
  if (!questions.length) {
    return el('div', { className: 'nb-view-body' }, el('div', { className: 'nb-doc' }, jsx(Markdown, { text })))
  }
  const score = questions.reduce((acc, q, i) => {
    const chosen = picked[i]
    if (chosen === undefined) return acc
    return acc + (normAnswer(chosen) === normAnswer(q.answer) ? 1 : 0)
  }, 0)
  const answered = questions.reduce((n, _q, qi) => n + (picked[qi] !== undefined ? 1 : 0), 0)
  return el('div', { className: 'nb-view-body' },
    el('div', { style: { maxWidth: '76ch' } },
      el('div', { style: { display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '14px' } },
        el('span', { className: 'nb-chip', 'data-tone': answered === questions.length ? 'ok' : 'accent',
          children: `${answered}/${questions.length} answered` }),
        answered ? el('span', { className: 'nb-chip', children: `${score} correct` }) : null,
        el('span', { style: { flex: 1 } }),
        answered ? jsx(Btn, { size: 'sm', icon: 'refresh', onClick: reset, children: 'Reset' }) : null),
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
          el('span', { style: { fontSize: '15px', fontWeight: 600, lineHeight: 1.45 }, children: q.question })),
        el('div', { style: { display: 'grid', gap: '6px', marginTop: '10px' }, role: 'group', 'aria-label': `Choices for question ${qi + 1}` },
          (q.choices && q.choices.length ? q.choices : [q.answer]).map((c, ci) => {
            const isChosen = chosen === c
            const isRight = normAnswer(c) === normAnswer(q.answer)
            const tone = !done ? T.card : isRight ? `color-mix(in srgb, ${T.ok} 16%, transparent)` : isChosen ? `color-mix(in srgb, ${T.danger} 14%, transparent)` : T.card
            return el('button', {
              type: 'button', disabled: done, onClick: () => setAns(qi, c),
              'aria-pressed': isChosen,
              style: {
                minHeight: '38px', textAlign: 'left', padding: '8px 12px', borderRadius: '9px',
                border: `1px solid ${isChosen || (done && isRight) ? T.line : T.lineSoft}`,
                background: tone, color: T.text, fontSize: '14px', cursor: done ? 'default' : 'pointer'
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

function SlidesView({ data, htmlUrl, notebook, jsonName }) {
  const deck = data || {}
  const slides = deck.slides || []
  const [i, setI] = useState(0)
  const [fs, setFs] = useState(false)
  const [pptxBusy, setPptxBusy] = useState(false)
  const screenRef = useRef(null)
  const go = useCallback((d) => setI((n) => Math.min(slides.length - 1, Math.max(0, n + d))), [slides.length])
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') { go(1); }
      else if (e.key === 'ArrowLeft') { go(-1) }
      else if (e.key === 'Escape' && document.fullscreenElement) document.exitFullscreen()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [go])
  useEffect(() => {
    const onFs = () => setFs(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])
  const toggleFs = () => {
    const el = screenRef.current
    if (!el || !el.requestFullscreen) return
    if (document.fullscreenElement) document.exitFullscreen()
    else el.requestFullscreen()
  }

  const openDeck = htmlUrl
    ? () => (host.openLink ? host.openLink(htmlUrl) : window.open(htmlUrl, '_blank'))
    : null

  // NotebookLM exports decks to PPTX; this writes the same file from the stored
  // deck JSON, so the download can never disagree with what is on screen.
  const savePptx = async () => {
    if (!notebook || !jsonName || pptxBusy) return
    setPptxBusy(true)
    try {
      const out = await api(`/artifact/pptx?${qs({ notebook: notebook.id, name: jsonName, b64: 1 })}`, {
        timeoutMs: 120000
      })
      const bytes = Uint8Array.from(atob(out.b64), (ch) => ch.charCodeAt(0))
      const url = URL.createObjectURL(new Blob([bytes], { type: out.mime }))
      const a = document.createElement('a')
      a.href = url
      a.download = out.name || 'deck.pptx'
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    } catch (e) {
      if (host.say) host.say(`pptx export failed: ${e.message || e}`)
    } finally {
      setPptxBusy(false)
    }
  }

  if (!slides.length) {
    return el('div', { className: 'nb-view-body' },
      el('div', { className: 'nb-hint', children: 'this deck has no slides in its json' }),
      openDeck ? jsx(Btn, { size: 'sm', icon: 'external', onClick: openDeck, children: 'Open the interactive deck' }) : null)
  }
  const s = slides[i]
  return el('div', { className: 'nb-view-body' },
    el('div', { className: 'nb-stage' },
      el('div', {
        ref: screenRef,
        className: 'nb-screen', role: 'group', 'aria-label': `Slide ${i + 1} of ${slides.length}`,
        style: { aspectRatio: fs ? 'auto' : '16/9', width: fs ? '100%' : undefined, height: fs ? '100%' : undefined, padding: '34px 40px', placeItems: 'stretch',
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
        el('span', { className: 'nb-mono', style: { fontSize: '12.5px', color: '#9aa0b5' }, children: `${i + 1}/${slides.length}` }),
        el('button', {
          type: 'button', className: 'nb-chip', 'data-click': 'true',
          'aria-label': fs ? 'Exit fullscreen' : 'Present fullscreen', title: fs ? 'Exit fullscreen' : 'Present fullscreen',
          style: { background: 'rgba(255,255,255,.1)', color: '#cfd3e0', borderColor: 'transparent', cursor: 'pointer' },
          onClick: (e) => { e.stopPropagation(); toggleFs() },
          children: fs ? 'exit' : 'present'
        }),
        openDeck
          ? el('button', {
              type: 'button', className: 'nb-chip', 'data-click': 'true',
              'aria-label': 'Open the interactive HTML deck', title: 'Open the interactive HTML deck',
              style: { background: 'rgba(255,255,255,.1)', color: '#cfd3e0', borderColor: 'transparent', cursor: 'pointer' },
              onClick: (e) => { e.stopPropagation(); openDeck() },
              children: 'open deck ↗'
            })
          : null,
        jsonName
          ? el('button', {
              type: 'button', className: 'nb-chip', 'data-click': 'true',
              disabled: pptxBusy,
              'aria-label': 'Download this deck as PowerPoint (.pptx)',
              title: 'Download this deck as PowerPoint (.pptx)',
              style: { background: 'rgba(255,255,255,.1)', color: '#cfd3e0', borderColor: 'transparent', cursor: pptxBusy ? 'progress' : 'pointer' },
              onClick: (e) => { e.stopPropagation(); savePptx() },
              children: pptxBusy ? 'exporting…' : 'pptx ↓'
            })
          : null),
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
              width: '30px', height: '30px', border: 0, background: 'transparent', cursor: 'pointer', borderRadius: '99px',
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
        data && data._style
          ? el('span', { className: 'nb-chip', title: 'Infographic style',
                         children: data._style.label }) : null,
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
  const [q, setQ] = useState('')
  const head = rows[0] || []
  const body = useMemo(() => rows.slice(1), [rows])
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return body
    return body.filter((r) => r.some((c) => String(c).toLowerCase().includes(needle)))
  }, [body, q])
  const shown = useMemo(() => {
    if (sort.col < 0) return filtered
    const i = sort.col
    return [...filtered].sort((a, b) => {
      const x = String(a[i] || ''), y = String(b[i] || '')
      const nx = Number(x.replace(/[^0-9.\-]/g, '')), ny = Number(y.replace(/[^0-9.\-]/g, ''))
      const c = (!Number.isNaN(nx) && !Number.isNaN(ny) && x !== '' && y !== '')
        ? nx - ny : x.localeCompare(y)
      return c * sort.dir
    })
  }, [filtered, sort])
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
      el('span', { className: 'nb-meta', children: q.trim() ? `${filtered.length} of ${body.length} rows × ${head.length} columns` : `${body.length} rows × ${head.length} columns` }),
      el('span', { style: { flex: 1 } }),
      body.length > 8 ? jsx(SearchField, { value: q, onChange: setQ, placeholder: 'Filter rows', label: 'Filter table rows' }) : null,
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

/* ------------------------------------------------------------- timeline
 *
 * A timeline artifact is markdown, and for a year it was drawn as plain
 * paragraphs with literal "(Source 1)" strings — which is a dump, not a
 * timeline. It is now parsed into nodes and drawn on a spine:
 *
 *   - `## <date|period|phase>` starts a node; the bullets under it are its body
 *   - `- **1971** — …` is a node of its own
 *   - "(Source 2)" and "(Sources 1 and 4)" become real [S2] citation chips
 *   - the model's meta-commentary ("Note: the provided source is thematic…")
 *     is stripped: if the material is a process rather than a chronology, the
 *     surface says "sequenced phases" once and draws phase badges, instead of
 *     printing the apology as body text.
 */
const TL_MONTHS = 'january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec'
const TL_DATED = new RegExp(`\\b(1[0-9]{3}|20[0-9]{2}|2100)\\b|\\b(${TL_MONTHS})\\b`, 'i')
const TL_META = /^(?:note[:—-]|nb[:]|disclaimer[:])?\s*(?:the (?:provided |given )?(?:source|sources|material|document|text)\s+(?:is|are|does|do|was|were)|i (?:cannot|can not|can’t|don’t|do not)|as an ai|keep in mind that|please note that|there (?:is|are) no (?:explicit|specific) (?:dates|timeline|dates or timeline)|this (?:timeline|document) (?:is|was) (?:compiled|based|created) (?:from|using))/i
const TL_NOISE = /^(?:note[:—-]\s*)?(?:nb[:]|caution[:]|caveat[:])\s*/i
/** "- <when> — body": the marker a one-line milestone starts with. Accepts
 *  years, year ranges, "April 2025", "Apr 12, 2025", "12 April 2025". */
const TL_NODE_PREFIX = new RegExp('^(?:\\*\\*)?(' + [
  // procedural labels: "Phase 2", "T+90 days", "Pre-interview phase", "Step 3"
  '(?:Phase|Stage|Step|Wave|Round)\\s*[0-9A-Za-z+.-]*',
  '(?:Pre|Post|During|After|Before)[- ]?[A-Za-z]+\\s+phase',
  '[A-Za-z]+(?:-[A-Za-z]+)?\\s+phase',
  'T\\s*\\u00b1?\\+\\s*[0-9]+(?:\\s*[A-Za-z]+)?',
  '[0-9]{3,4}(?:\\s*[\\u2013-]\\s*[0-9]{2,4})?',
  '(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\\s+[0-9]{1,2}(?:,\\s*[0-9]{4})?',
  '[A-Z][a-z]+\\s+[0-9]{1,2}(?:,\\s*|[\\s]+)[0-9]{4}',
  '[A-Z][a-z]+\\s+[0-9]{4}',
  '[0-9]{1,2}\\s+[A-Z][a-z]+\\s+[0-9]{4}'
].join('|') + ')(?:\\*\\*)?\\s*[\\u2014\\u2013:-]\\s*(.+)$')

/** "(Source 2)" / "(Sources 1 and 4)" → "[S2]" / "[S1][S4]". */
function tlCiteFix(line) {
  return String(line)
    .replace(/\(\s*(?:see\s+)?(?:sources?|ref(?:erence)?s?\.?)\s*(?:no\.?\s*)?([0-9]+(?:\s*(?:,|and|&(?:amp;)?)\s*[0-9]+)*)\s*\)/gi,
      (m, list) => list.split(/[,\s]+|and|&amp;|&/).filter((n) => n && /^[0-9]+$/.test(n))
        .map((n) => `[S${n}]`).join(''))
    .replace(/\s*\(\s*si\s*\)/gi, '')
}

/** Strip the model talking about itself: a timeline that apologises for its
 *  shape instead of being shaped is the failure this viewer exists to hide. */
const tlIsMeta = (line) => {
  const t = String(line).trim()
  if (!t) return false
  if (TL_META.test(t)) return true
  return TL_NOISE.test(t) && /(thematic|not (?:strictly )?chronolog|no (?:explicit )?dates|rather than chronological)/i.test(t)
}

function tlParse(text) {
  const lines = tlCiteFix(String(text || '').replace(/\r\n/g, '\n')).split('\n')
  const nodes = []
  const lede = []
  let title = ''
  let pending = null     // the heading a bullet list belongs to
  let sawMeta = false
  const openNode = (when) => {
    const n = { when: String(when || '').trim(), body: [], tags: [] }
    nodes.push(n)
    return n
  }
  const pushBody = (n, line) => { if (n) n.body.push(line.trim()) }
  for (const raw of lines) {
    const line = raw.trimEnd()
    const t = line.trim()
    if (!t) { if (pending) pushBody(pending.obj, ''); continue }
    if (tlIsMeta(t)) { sawMeta = true; continue }
    const h1 = /^#\s+(.*)$/.exec(t)
    if (h1) { title = h1[1].trim(); continue }
    const h = /^#{2,4}\s+(.*)$/.exec(t)
    if (h) {
      const when = h[1].replace(/\*\*/g, '').replace(/^[\d.]+\s+/, '').trim()
      pending = { when, obj: openNode(when) }
      continue
    }
    const item = /^(?:[-*+]|\d+\.)\s+(.*)$/.exec(t)
    if (item) {
      const body = item[1].trim()
      // The canonical row is pipe-delimited (the artifact prompt asks for
      // `- **<when>** | <category> | <headline> | <what changed> [S#] | <unblocked>`).
      // Parse it here so the renderer can draw the category as a badge and the
      // consequence as its own line, instead of printing one run-on sentence.
      if (TL_ROW.test(body)) {
        const cells = body.split(/\s*\|\s*/).map((c) => c.trim())
        const when = (cells[0] || '').replace(/\*\*/g, '').trim()
        const n = openNode(when)
        n.row = {
          category: (cells[1] || '').replace(/\*\*/g, '').trim(),
          headline: (cells[2] || '').replace(/\*\*/g, '').trim(),
          what: (cells[3] || '').trim(),
          consequence: (cells[4] || '').replace(/\*\*/g, '').trim()
        }
        pending = null
        continue
      }
      // "- **1971** — text" / "- 1971: text" is a node by itself
      const own = TL_NODE_PREFIX.exec(body)
      if (own) {
        const n = openNode(own[1].replace(/\*\*/g, '').trim())
        pushBody(n, own[2])
        pending = null
      } else if (pending) {
        pushBody(pending.obj, body)
      } else {
        // a bullet without a date and without a heading: keep it as its own
        // numbered step so nothing is silently dropped
        const n = openNode('')
        pushBody(n, body)
        pending = null
      }
      continue
    }
    if (/^(?:[-*_]){3,}$/.test(t)) continue
    if (pending) pushBody(pending.obj, t)
    else lede.push(t)
  }
  // dates only when the document is actually dated; a sequence of phases is a
  // sequence even if half its labels are words
  const datedCount = nodes.filter((n) => n.when && TL_DATED.test(n.when)).length
  const kind = nodes.length && datedCount <= nodes.length / 2 ? 'phases' : 'dates'
  // a fully dated timeline is a chronology: order it as one. If any node is a
  // phase label (or undated), the document order is the sequence the model meant.
  const keys = nodes.map((n) => tlWhenKey(n.when))
  if (nodes.length && keys.every((k) => k !== null)) {
    const ordered = nodes.slice().sort((a, b) => tlWhenKey(a.when) - tlWhenKey(b.when))
    return { title, lede, nodes: ordered, sawMeta, kind, reordered: ordered.some((n, i) => n !== nodes[i]) }
  }
  return { title, lede, nodes, sawMeta, kind, reordered: false }
}

/** The canonical timeline row: at least four pipe-separated cells. */
const TL_ROW = /\|/
/** Categories the artifact prompt allows, and the tone each is drawn in. */
const TL_CATS = {
  'milestone': 'ok',
  'architecture shift': 'accent',
  'external event': 'accent',
  'bottleneck': 'warn',
  'target deadline': 'warn'
}

/** A sortable key for a node's date, or null when it is a phase label.
 *  The artifact prompt asks the model for chronological order; models drift
 *  (the December 2025 sample listed April before January), so a timeline that
 *  is fully dated is sorted here — the reader is looking at a chronology, not
 *  at the model's draft. */
const TL_MONTH_INDEX = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
}
function tlWhenKey(when) {
  const t = String(when || '').trim()
  const year = /(1[0-9]{3}|20[0-9]{2})/.exec(t)
  if (!year) return null
  const y = Number(year[1])
  const month = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b/i.exec(t)
  const day = new RegExp(`\\b${month ? month[1] : '(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)'}\\w*\\s+([0-9]{1,2})`, 'i').exec(t)
    || /([0-9]{1,2})\s+[A-Z][a-z]+/.exec(t)
  // a year-only entry summarizes that year, so it sorts after the year's dated
  // events rather than ahead of January (which read as "2025, then January 2025")
  const mo = month ? TL_MONTH_INDEX[month[1].slice(0, 3).toLowerCase()] || 12 : 12
  const d = month ? (day ? Number(day[1]) : 1) : 31
  return y * 10000 + mo * 100 + d
}

/** The S# markers a node cites, in order. */
const tlSRefs = (body) => {
  const out = []
  for (const m of String(body || '').matchAll(/\[S([0-9]+)\]/g)) {
    const n = Number(m[1])
    if (!out.includes(n)) out.push(n)
  }
  return out
}

function TimelineView({ text, onCite }) {
  const doc = useMemo(() => tlParse(text), [text])
  if (doc.nodes.length < 2) {
    // not enough structure to draw: render the document honestly, minus the
    // meta commentary the parser already identified
    const fallback = doc.nodes.length
      ? `${[doc.title && `# ${doc.title}`, ...doc.lede, ...doc.nodes.map((n) => `- ${n.when ? `${n.when} — ` : ''}${n.body.filter(Boolean).join(' ')}`)].filter(Boolean).join('\n\n')}`
      : text
    return el('div', { className: 'nb-view-body' }, el('div', { className: 'nb-doc' }, jsx(Markdown, { text: fallback, onCite })))
  }
  const bodyOf = (n) => (n.row
    ? `${n.row.headline} ${n.row.what} ${n.row.consequence}`
    : n.body.filter(Boolean).join('\n\n'))
  const cited = new Set()
  for (const n of doc.nodes) for (const r of tlSRefs(bodyOf(n))) cited.add(r)
  return el('div', { className: 'nb-view-body' },
    el('div', { style: { display: 'flex', flexDirection: 'column' } },
      el('div', { className: 'nb-spine-lede' },
        jsx(Glyph, { name: 'timeline', size: 14 }),
        el('span', { children: [
          el('b', { children: String(doc.nodes.length) }),
          doc.kind === 'dates' ? ' milestones' : ' phases',
          cited.size ? ` · cites ${[...cited].sort((a, b) => a - b).map((n) => `S${n}`).join(', ')}` : '',
          doc.reordered ? ' · reordered chronologically' : ''
        ] }),
        doc.kind === 'phases'
          ? el('span', { className: 'nb-chip', title: 'The sources describe a sequence of steps rather than dated events.',
              children: 'sequenced phases' })
          : null),
      el('ol', { className: 'nb-spine', 'aria-label': doc.title ? `Timeline — ${doc.title}` : 'Timeline' },
        doc.nodes.map((n, i) => {
          const refs = tlSRefs(bodyOf(n))
          const phase = doc.kind === 'phases'
          const when = n.when || (phase ? `Phase ${i + 1}` : `Entry ${i + 1}`)
          const chips = el('div', { className: 'nb-node-src' },
            refs.map((r) => (onCite
              ? el('button', {
                  type: 'button', className: 'nb-srcchip',
                  title: `Open source S${r}`,
                  'aria-label': `Citation S${r} — open the source`,
                  onClick: (e) => { e.stopPropagation(); onCite(r) },
                  children: `S${r}`
                }, `s${i}-${r}`)
              : el('span', { className: 'nb-srcchip', children: `S${r}` }, `s${i}-${r}`))))
          // a canonical row carries its own structure: category, headline, what
          // changed, and what it unblocked. Drawing it as one paragraph is what
          // made the old viewer read like a text dump.
          const card = n.row
            ? el('div', { className: 'nb-node-card' },
                n.row.category
                  ? el('span', { className: 'nb-node-cat', 'data-tone': TL_CATS[n.row.category.toLowerCase()] || undefined,
                      children: n.row.category })
                  : null,
                n.row.headline
                  ? el('div', { className: 'nb-node-headline', children: n.row.headline })
                  : null,
                n.row.what
                  ? el('div', { className: 'nb-node-what', children: jsx(Markdown, { text: n.row.what, onCite }) })
                  : null,
                n.row.consequence
                  ? el('div', { className: 'nb-node-cons' }, [
                      jsx(Glyph, { name: 'bolt', size: 12 }),
                      el('span', { children: n.row.consequence })
                    ])
                  : null)
            : el('div', { className: 'nb-node-card' },
                jsx(Markdown, { text: n.body.filter(Boolean).join('\n\n'), onCite }))
          const kids = [
            el('span', { className: 'nb-node-dot', 'aria-hidden': 'true' }),
            el('span', { className: 'nb-node-when', 'data-phase': phase ? 'true' : 'false', children: when }),
            card,
            refs.length ? chips : null
          ].filter(Boolean)
          return el('li', { className: 'nb-node', key: `n${i}` }, kids)
        }))
  ))
}
