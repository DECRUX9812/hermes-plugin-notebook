/* -------------------------------------------------------------------- main */

function Main({ notebook, kinds, tab, setTab, picked, setPicked, busy, generate, onAsk,
                askOpen, onSay, reload, modelReady, error, loading, onAddSource }) {
  const [peek, setPeek] = useState(null)
  const sources = (notebook && notebook.sources) || []

  if (loading && !notebook) {
    return el('main', { className: 'nb-col' },
      el('div', { className: 'nb-void' },
        el('div', null,
          el('h3', { children: 'Opening the notebook' }),
          el('p', { children: 'Reading sources and artifacts from the plugin store…' }))))
  }
  if (error && !notebook) {
    return el('main', { className: 'nb-col' },
      el('div', { className: 'nb-void' },
        el('div', null,
          el('h3', { children: 'The notebook backend did not answer' }),
          el('p', { children: error }),
          el('div', { style: { marginTop: '14px' } },
            jsx(Btn, { icon: 'refresh', onClick: () => reload(false), children: 'Try again' })
          )
        )
      )
    )
  }
  if (!notebook) {
    return el('main', { className: 'nb-col' },
      el('div', { className: 'nb-void' },
        el('div', null,
          el('h3', { children: 'Start a notebook' }),
          el('p', { children: 'A notebook is a set of sources. Everything the studio makes — answers, a podcast, a mind map, slides — is derived from those sources and cites them by number.' }),
          el('div', { style: { marginTop: '16px' } },
            jsx(Btn, { variant: 'primary', icon: 'plus', onClick: onAddSource, children: 'Add your first source' })
          )
        )
      )
    )
  }

  const viewName = picked ? picked.label : ''
  const art = picked
  const stats = notebook.stats || {}

  return el('main', { className: 'nb-col' },
    el('div', { className: 'nb-main-head' },
      el('h1', { className: 'nb-h1', children: notebook.title }),
      notebook.description ? el('p', { className: 'nb-sub', children: notebook.description })
        : el('p', { className: 'nb-sub', children: 'Answers are generated only from the sources on the left; each citation opens the source it came from.' }),
      el('div', { className: 'nb-strip', role: 'group', 'aria-label': 'Notebook totals' },
        el('div', { className: 'nb-cell' }, el('b', { children: stats.sources || 0 }), el('span', { children: 'sources' })),
        el('div', { className: 'nb-cell' }, el('b', { children: nfmt(stats.chars) }), el('span', { children: 'chars indexed' })),
        el('div', { className: 'nb-cell' }, el('b', { children: stats.labels || 0 }), el('span', { children: 'labels' })),
        el('div', { className: 'nb-cell' }, el('b', { children: stats.artifacts || 0 }), el('span', { children: 'artifacts' })),
        el('div', { className: 'nb-cell' },
          el('b', { style: { color: modelReady ? T.ok : T.warn }, children: modelReady ? 'ready' : 'offline' }),
          el('span', { children: 'model' }))
      ),
      el('div', { className: 'nb-tabs', role: 'tablist', 'aria-label': 'Notebook views' },
        el('button', {
          type: 'button', role: 'tab', className: 'nb-tab', 'aria-selected': tab === 'chat',
          onClick: () => setTab('chat'), children: [jsx(Glyph, { name: 'faq', size: 15 }), 'Chat']
        }),
        el('button', {
          type: 'button', role: 'tab', className: 'nb-tab', 'aria-selected': tab === 'view',
          onClick: () => setTab('view'), disabled: !picked,
          children: [jsx(Glyph, { name: picked ? (KIND_ICON[picked.kind] || 'doc') : 'doc', size: 15 }),
                     viewName || 'Viewer']
        }),
        peek ? el('button', {
          type: 'button', role: 'tab', className: 'nb-tab', 'aria-selected': tab === 'peek',
          onClick: () => setTab('peek'),
          children: [jsx(Glyph, { name: 'book', size: 15 }), `S${peek.n} · ${peek.title}`]
        }) : null
      )
    ),

    tab === 'peek' && peek
      ? jsx(SourcePeek, { source: peek, notebook, onClose: () => { setPeek(null); setTab('chat') } })
      : tab === 'view' && picked
        ? jsx(Viewer, { artifact: picked, notebook, onSearch: () => {}, onCite: (n) => {
            const src = sources.find((s) => s.n === n)
            if (src) { setPeek(src); setTab('peek') }
          } })
        : jsx(Chat, {
            notebook, askOpen, onSay, modelReady,
            onCite: (n) => {
              const src = sources.find((s) => s.n === n)
              if (src) { setPeek(src); setTab('peek') }
            },
            onOpenSource: (s) => { setPeek(s); setTab('peek') }
          })
  )
}

/* ------------------------------------------------------------------- chat */

const SUGGEST = [
  'Summarise the strongest claim in the sources, with citations.',
  'Where do the sources disagree?',
  'What is missing that I should go and find?'
]

function Chat({ notebook, askOpen, onSay, modelReady, onCite, onOpenSource }) {
  const [msgs, setMsgs] = useState(() => (notebook.thread || []).map((m, i) => ({ ...m, k: `t${i}` })))
  const [text, setText] = useState('')
  const [pending, setPending] = useState(null)
  const threadRef = useRef(null)
  const boxRef = useRef(null)

  useEffect(() => {
    const stored = (notebook.thread || []).map((m, i) => ({ ...m, k: `t${i}` }))
    setMsgs(stored)
  }, [notebook.id, notebook.thread && notebook.thread.length])

  useEffect(() => { if (askOpen) { const n = boxRef.current; if (n) n.focus() } }, [askOpen])

  useEffect(() => {
    const node = threadRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [msgs.length, pending && pending.since])

  const send = async (question) => {
    const q = (question || text).trim()
    if (!q || pending) return
    setText('')
    setMsgs((m) => [...m, { role: 'user', content: q, k: `u${Date.now()}` }])
    const started = Date.now()
    setPending({ since: started, q })
    const tick = setInterval(() => setPending((p) => (p ? { ...p, now: Date.now() } : p)), 500)
    try {
      const out = await api('/ask', {
        method: 'POST',
        body: { notebook: notebook.id, question: q, thread: 'default' },
        timeoutMs: 180000
      })
      setMsgs((m) => [...m, {
        role: 'assistant', content: out.answer, k: `a${Date.now()}`,
        citations: out.citations || [], seconds: out.seconds,
        meta: `${out.chunks_used || 0} of ${out.total_chunks || 0} passages`
      }])
    } catch (e) {
      setMsgs((m) => [...m, {
        role: 'assistant', content: `**That question did not get an answer.**\n\n${e.message || e}`,
        k: `e${Date.now()}`, error: true
      }])
      if (onSay) onSay(e.message || 'ask failed')
    } finally {
      clearInterval(tick)
      setPending(null)
    }
  }

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const elapsed = pending ? Math.round(((pending.now || Date.now()) - pending.since) / 1000) : 0

  return el('div', { className: 'nb-chat' },
    el('div', { className: 'nb-thread', ref: threadRef, role: 'log', 'aria-live': 'polite', 'aria-label': 'Conversation' },
      msgs.length === 0 && !pending
        ? el('div', { style: { margin: 'auto', textAlign: 'center', maxWidth: '54ch' } },
            el('div', { style: { display: 'grid', placeItems: 'center', gap: '10px' } },
              el('span', { className: 'nb-mark', style: { width: '40px', height: '40px', borderRadius: '12px' } },
                jsx(Glyph, { name: 'sparkle', size: 19 })),
              el('div', { style: { fontSize: '20px', fontWeight: 650, letterSpacing: '-.015em' }, children: 'Ask the sources' }),
              el('div', {
                style: { color: T.text3, fontSize: '14.5px', lineHeight: 1.6 },
                children: 'Every answer is built from this notebook and cites the source it came from. If the sources do not cover it, the answer says so.'
              })))
        : null,
      msgs.map((m) => jsx(Msg, { msg: m, onCite, onOpenSource }, m.k)),
      pending
        ? el('div', { className: 'nb-msg', 'data-role': 'assistant' },
            el('span', { className: 'nb-avatar', children: 'HK' }),
            el('div', { className: 'nb-msg-body' },
              el('div', { className: 'nb-who', children: 'Reading sources' }),
              el('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', color: T.text3, fontSize: '14.5px' } },
                el('span', { className: 'nb-dot', style: { background: T.accent, boxShadow: `0 0 8px ${T.accent}` } }),
                `retrieving passages · ${elapsed}s`)))
        : null
    ),

    el('div', { className: 'nb-composer' },
      msgs.length === 0 && !pending
        ? el('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' } },
            SUGGEST.map((s) => jsx(Chip, {
              key: s, onClick: () => { setText(s); const n = boxRef.current; if (n) n.focus() },
              title: 'Use this question', children: s
            })))
        : null,
      el('div', { className: 'nb-askbox' },
        el('textarea', {
          ref: boxRef, value: text, onChange: (e) => setText(e.target.value), onKeyDown: onKey,
          placeholder: 'Ask anything — the answer cites the source it came from',
          'aria-label': 'Ask the notebook',
          rows: 2
        }),
        el('div', { className: 'nb-askfoot' },
          el('span', { className: 'nb-hint' },
            modelReady ? '⏎ send · ⇧⏎ newline' : 'model offline — enable the plugin and restart the gateway'),
          el('span', { style: { flex: 1 } }),
          jsx(Btn, {
            variant: 'primary', icon: 'send', onClick: () => send(), disabled: !text.trim() || !!pending,
            children: pending ? 'Asking…' : 'Send'
          }))
      )
    )
  )
}

function Msg({ msg, onCite }) {
  const isUser = msg.role === 'user'
  return el('div', { className: 'nb-msg', 'data-role': isUser ? 'user' : 'assistant' },
    isUser ? null : el('span', { className: 'nb-avatar', children: 'HK' }),
    el('div', { className: 'nb-msg-body' },
      isUser
        ? el('div', { className: 'nb-bubble', children: msg.content })
        : el('div', null,
            el('div', { className: 'nb-who' },
              'Hermes Notebook',
              msg.meta ? el('span', { style: { marginLeft: '8px', color: T.text4, fontWeight: 500, textTransform: 'none', letterSpacing: 0 }, children: `· ${msg.meta}` }) : null),
            el('div', { className: 'nb-bubble' },
              jsx(Markdown, { text: msg.content, onCite })),
            (msg.citations || []).length
              ? el('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }, role: 'list', 'aria-label': 'Citations' },
                  msg.citations.map((c) => jsx(Chip, {
                    tone: 'accent', onClick: () => onCite && onCite(c.n),
                    title: c.origin || c.title, children: `S${c.n} · ${c.title}`
                  }, `${c.n}-${c.title}`)))
              : null))
  )
}

/* ---------------------------------------------------------------- peek */

function SourcePeek({ source, notebook, onClose }) {
  const [text, setText] = useState('')
  const [err, setErr] = useState('')
  useEffect(() => {
    let live = true
    setText('')
    api(`/source_text?${qs({ notebook: notebook.id, id: source.id, chars: 24000 })}`)
      .then((out) => { if (live) setText(out.text || '') })
      .catch((e) => { if (live) setErr(e.message || String(e)) })
    return () => { live = false }
  }, [source.id, notebook.id])
  return el('div', { className: 'nb-view' },
    el('div', { className: 'nb-view-head' },
      el('span', { className: 'nb-chip', 'data-tone': 'accent', children: `S${source.n}` }),
      el('div', { style: { flex: 1, minWidth: 0 } },
        el('div', { className: 'nb-view-title', children: source.title }),
        el('div', { style: { fontSize: '12.5px', color: T.text4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
          children: `${source.kind} · ${nfmt(source.chars)} chars · ${source.origin || 'stored text'}` })),
      source.origin && source.origin.startsWith('http')
        ? jsx(IconBtn, { icon: 'external', label: 'Open the original', onClick: () => host.openLink ? host.openLink(source.origin) : window.open(source.origin, '_blank') })
        : null,
      jsx(IconBtn, { icon: 'close', label: 'Close source', onClick: onClose })
    ),
    el('div', { className: 'nb-view-body' },
      err
        ? el('div', { style: { color: T.danger }, children: err })
        : text
          ? el('pre', {
              className: 'nb-mono',
              style: { whiteSpace: 'pre-wrap', fontSize: '14.5px', lineHeight: 1.7, color: T.text2, margin: 0 },
              children: text
            })
          : el('div', { className: 'nb-hint', children: 'reading…' }))
  )
}

/* --------------------------------------------------------------- studio panel */

function StudioPanel({ kinds, notebook, busy, generate, filter, setFilter, picked, onOpen }) {
  const ready = latestByKind(notebook ? notebook.artifacts : [])
  const shown = kinds.filter((k) => filter === 'all' || k.group === filter)
  const scrollRef = useRef(null)
  const [canScroll, setCanScroll] = useState(false)

  // A grid taller than the panel is fine, but a row sliced at the panel edge
  // with no affordance reads as broken: measure, then show the fade.
  useEffect(() => {
    const node = scrollRef.current
    if (!node) return undefined
    const check = () => setCanScroll(node.scrollHeight > node.clientHeight + 2)
    check()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(check) : null
    if (ro) ro.observe(node)
    node.addEventListener('scroll', check, { passive: true })
    return () => { if (ro) ro.disconnect(); node.removeEventListener('scroll', check) }
  }, [shown.length])
  return el('aside', { className: 'nb-col nb-studio', 'aria-label': 'Studio outputs' },
    el('div', { className: 'nb-pane-head' },
      el('span', { className: 'nb-meta', children: 'Studio' }),
      el('span', {
        className: 'nb-chip',
        'data-tone': Object.keys(ready).length ? 'ok' : undefined,
        children: `${Object.keys(ready).length} of ${kinds.length} ready`
      })
    ),
    el('div', { className: 'nb-pad', style: { paddingBottom: 0 } },
      jsx(Seg, {
        label: 'Filter studio outputs', value: filter, onChange: setFilter, fill: true,
        options: FILTERS.map((f) => ({
          id: f.id,
          label: f.id === 'all' ? 'All' : f.label,
          title: `${f.label} outputs`
        }))
      })
    ),
    el('div', { className: 'nb-scroll', ref: scrollRef, 'data-scrollable': canScroll ? 'true' : 'false' },
      el('div', { className: 'nb-grid' },
        shown.map((k) => jsx(StudioCard, {
          key: k.id, kind: k, art: ready[k.id], started: busy[k.id],
          onOpen: () => { const a = ready[k.id]; if (a) onOpen(a); else generate(k.id) },
          onRegenerate: () => generate(k.id)
        }))
      )
    ),
    canScroll ? jsx('div', { className: 'nb-fade', 'aria-hidden': 'true' }) : null
  )
}

function StudioCard({ kind, art, started, onOpen, onRegenerate }) {
  const [, force] = useState(0)
  useEffect(() => {
    if (!started) return undefined
    const t = setInterval(() => force((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [started])
  const secs = started ? Math.max(0, Math.round((Date.now() - started) / 1000)) : 0
  const state = started ? `writing · ${secs}s` : art ? `ready · ${ago(art.modified)}` : `Generate`
  return el('button', {
    type: 'button', className: 'nb-card',
    'data-ready': art ? 'true' : 'false', 'data-busy': started ? 'true' : 'false',
    onClick: started ? undefined : onOpen,
    'aria-label': `${kind.label} — ${state}. ${art ? 'Open it' : 'Generate it'}`,
    title: art ? `${kind.label} · ${art.primary}` : `Generate ${kind.label}`,
    children: [
      el('div', { className: 'nb-card-top' },
        el('span', { className: 'nb-card-ic' }, jsx(Glyph, { name: KIND_ICON[kind.id] || 'doc', size: 14 })),
        el('span', { className: 'nb-card-name', children: kind.label })),
      el('span', { className: 'nb-card-blurb', children: kind.blurb }),
      started
        ? el('div', { className: 'nb-bar-track' },
            el('div', {
              className: 'nb-bar-fill',
              style: { width: `${Math.min(96, 12 + secs * 2.2)}%`, opacity: 0.85 }
            }))
        : null,
      el('div', { className: 'nb-card-state' },
        el('span', {
          className: 'nb-dot',
          style: {
            background: started ? T.accent : art ? T.ok : T.text4,
            boxShadow: started ? `0 0 8px ${T.accent}` : art ? `0 0 6px ${T.ok}` : 'none'
          }
        }),
        state)
    ]
  })
}

/* -------------------------------------------------------------- status bar */

function StatusBar({ mode, notebook, data, note, opsStats }) {
  const ready = data && data.model_ready
  const ops = mode === 'ops'
  return el('footer', { className: 'nb-status', role: 'contentinfo' },
    ops
      ? el('span', null,
          jsx('span', {
            className: 'nb-sdot',
            style: { background: opsStats && opsStats.down ? T.warn : T.ok }
          }),
          opsStats
            ? `${opsStats.hosts} hosts · ${opsStats.patched} patched · ${opsStats.exposed} fix available · ${opsStats.down} unreachable`
            : 'measuring the fleet…')
      : el('span', null,
          jsx('span', { className: 'nb-sdot', style: { background: ready ? T.ok : T.warn } }),
          ready ? 'grounded · model ready' : 'model offline — enable the plugin'),
    !ops && notebook
      ? el('span', null, jsx('b', { children: notebook.stats.sources }), ' sources · ',
          jsx('b', { children: nfmt(notebook.stats.chars) }), ' chars · ',
          jsx('b', { children: notebook.stats.labels }), ' labels')
      : null,
    !ops && notebook && notebook.stats.unlabeled
      ? jsx('span', {
          style: { color: T.warn },
          children: `${notebook.stats.unlabeled} source${notebook.stats.unlabeled === 1 ? '' : 's'} unlabeled — press “label” on the rail`
        })
      : null,
    note ? jsx('span', { style: { color: T.accent }, children: note }) : null,
    el('span', { style: { flex: 1 } }),
    jsx('span', { className: 'nb-mono', style: { fontSize: '11.5px' },
      children: ops ? 'ssh · audited transport' : (notebook ? notebook.id : 'no notebook') }),
    data && !ops ? jsx('span', { className: 'nb-mono', style: { fontSize: '11.5px' },
      children: `synced ${clock(data.generated_at)}` }) : null
  )
}

/* ---------------------------------------------------------------- dialogs */

const SOURCE_MODES = [
  { id: 'url', label: 'Web URL', icon: 'link' },
  { id: 'path', label: 'File path', icon: 'file' },
  { id: 'text', label: 'Paste text', icon: 'note' }
]

function AddSourceDialog({ open, onClose, notebook, onDone }) {
  const [mode, setMode] = useState('url')
  const [value, setValue] = useState('')
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const submit = async () => {
    if (!value.trim() || busy) return
    setBusy(true); setErr('')
    try {
      const body = { notebook: notebook.id, [mode]: value.trim() }
      if (title.trim()) body.title = title.trim()
      const out = await api('/source', { method: 'POST', body, timeoutMs: 120000 })
      setValue(''); setTitle('')
      await onDone(out.source && out.source.title ? `added ${out.source.title}` : 'source added')
    } catch (e) {
      setErr(e.message || String(e))
    } finally {
      setBusy(false)
    }
  }
  return jsx(Dialog, {
    open, onClose, title: 'Add a source',
    children: el('div', null,
      el('p', { style: { margin: '0 0 14px', color: T.text3, fontSize: '14.5px', lineHeight: 1.55 },
        children: 'A source is anything the notebook can cite: a URL, a file on this machine, or text you paste. It is extracted, labelled and indexed on the way in.' }),
      jsx(Seg, { label: 'Source kind', value: mode, onChange: setMode, options: SOURCE_MODES }),
      el('div', { style: { marginTop: '14px', display: 'grid', gap: '10px' } },
        mode === 'text'
          ? el('textarea', {
              className: 'nb-mono', value, onChange: (e) => setValue(e.target.value), autoFocus: true,
              placeholder: 'Paste notes, a transcript, a spec…', 'aria-label': 'Pasted source text',
              style: {
                minHeight: '160px', borderRadius: '10px', border: `1px solid ${T.line}`,
                background: T.cardDeep, color: T.text, padding: '12px', fontSize: '14px',
                lineHeight: 1.55, resize: 'vertical', outline: 'none'
              }
            })
          : el('div', { className: 'nb-field', style: { height: '40px' } },
              jsx(Glyph, { name: mode === 'url' ? 'link' : 'file', size: 14 }),
              el('input', {
                value, onChange: (e) => setValue(e.target.value), autoFocus: true,
                onKeyDown: (e) => { if (e.key === 'Enter') submit() },
                placeholder: mode === 'url' ? 'https://… or a YouTube link' : '/home/you/doc.pdf',
                'aria-label': mode === 'url' ? 'Source URL' : 'File path'
              })),
        el('div', { className: 'nb-field', style: { height: '40px' } },
          jsx(Glyph, { name: 'note', size: 14 }),
          el('input', {
            value: title, onChange: (e) => setTitle(e.target.value),
            placeholder: 'Title (optional — derived when left blank)',
            'aria-label': 'Source title'
          }))
      ),
      err ? el('div', { style: { marginTop: '12px', color: T.danger, fontSize: '14px' }, children: err }) : null,
      el('div', { style: { display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' } },
        jsx(Btn, { onClick: onClose, children: 'Cancel' }),
        jsx(Btn, {
          variant: 'primary', icon: 'plus', onClick: submit, disabled: busy || !value.trim(),
          children: busy ? 'Ingesting…' : 'Add source'
        }))
    )
  })
}

function NewNotebookDialog({ open, onClose, onDone }) {
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const submit = async () => {
    if (!title.trim() || busy) return
    setBusy(true); setErr('')
    try {
      const out = await api('/notebook', { method: 'POST', body: { title: title.trim(), description: desc.trim() } })
      setTitle(''); setDesc('')
      await onDone(out.id)
    } catch (e) {
      setErr(e.message || String(e))
    } finally { setBusy(false) }
  }
  return jsx(Dialog, {
    open, onClose, title: 'New notebook',
    children: el('div', null,
      el('div', { style: { display: 'grid', gap: '10px' } },
        el('div', { className: 'nb-field', style: { height: '40px' } },
          jsx(Glyph, { name: 'book', size: 14 }),
          el('input', {
            value: title, onChange: (e) => setTitle(e.target.value), autoFocus: true,
            placeholder: 'What is this notebook about?', 'aria-label': 'Notebook title',
            onKeyDown: (e) => { if (e.key === 'Enter') submit() }
          })),
        el('textarea', {
          value: desc, onChange: (e) => setDesc(e.target.value),
          placeholder: 'One line of context (optional) — it steers the labels and the studio copy.',
          'aria-label': 'Notebook description',
          style: {
            minHeight: '80px', borderRadius: '10px', border: `1px solid ${T.line}`,
            background: T.cardDeep, color: T.text, padding: '12px', fontSize: '14.5px',
            lineHeight: 1.5, resize: 'vertical', outline: 'none'
          }
        })),
      err ? el('div', { style: { marginTop: '12px', color: T.danger, fontSize: '14px' }, children: err }) : null,
      el('div', { style: { display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' } },
        jsx(Btn, { onClick: onClose, children: 'Cancel' }),
        jsx(Btn, { variant: 'primary', icon: 'check', onClick: submit, disabled: busy || !title.trim(),
          children: busy ? 'Creating…' : 'Create notebook' }))
    )
  })
}
