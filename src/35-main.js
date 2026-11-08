/* -------------------------------------------------------------------- main */

function Main({ notebook, kinds, tab, setTab, picked, setPicked, busy, generate, onAsk,
                askOpen, onSay, reload, modelReady, error, loading,
                peek, setPeek, onOpenSource, onRefreshSource, onAddSource, onNewNotebook, onFindSources }) {
  const sources = (notebook && notebook.sources) || []
  const [askScope, setAskScope] = useState(null)   // chat scoped to one source

  if (loading && !notebook) {
    return el('main', { className: 'nb-col nb-main-col' },
      el('div', { className: 'nb-void' },
        el('div', null,
          el('h3', { children: 'Opening the notebook' }),
          el('p', { children: 'Reading sources and artifacts from the plugin store…' }))))
  }
  if (error && !notebook) {
    return el('main', { className: 'nb-col nb-main-col' },
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
    return el('main', { className: 'nb-col nb-main-col' },
      el('div', { className: 'nb-void' },
        el('div', null,
          el('h3', { children: 'Start a notebook' }),
          el('p', { children: 'A notebook is a set of sources. Everything the studio makes — answers, a podcast, a mind map, slides — is derived from those sources and cites them by number.' }),
          el('div', { style: { marginTop: '16px', display: 'flex', gap: '8px', justifyContent: 'center' } },
            jsx(Btn, { variant: 'primary', icon: 'plus', onClick: onNewNotebook, children: 'New notebook' }),
            jsx(Btn, { icon: 'sparkle', onClick: () => onAddSource && onAddSource(), disabled: true,
              title: 'Create a notebook first', children: 'Add sources' })
          )
        )
      )
    )
  }

  const viewName = picked ? picked.label : ''
  const stats = notebook.stats || {}
  const activeCount = stats.active !== undefined ? stats.active : sources.length
  const hasArts = (notebook.artifacts || []).length > 0

  // a notebook with nothing in it gets a guided empty state, not dead panels
  if (!sources.length && !hasArts) {
    return el('main', { className: 'nb-col nb-main-col' },
      el('div', { className: 'nb-void' },
        el('div', null,
          el('h3', { children: `“${notebook.title}” has no sources yet` }),
          el('p', { children: 'Everything here is grounded in your sources — answers cite them, and every studio output is built from them. Add the material first.' }),
          el('div', { style: { marginTop: '16px', display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' } },
            jsx(Btn, { variant: 'primary', icon: 'sparkle', onClick: () => onAddSource && onAddSource({ mode: 'find' }), children: 'Find sources' }),
            jsx(Btn, { icon: 'link', onClick: () => onAddSource && onAddSource({ mode: 'url' }), children: 'Add a link' }),
            jsx(Btn, { icon: 'note', onClick: () => onAddSource && onAddSource({ mode: 'note' }), children: 'Paste notes' })
          )
        )
      )
    )
  }

  return el('main', { className: 'nb-col nb-main-col' },
    el('div', { className: 'nb-main-head' },
      el('div', { className: 'nb-hero' },
        el('span', { className: 'nb-hero-emoji', 'aria-hidden': 'true', children: emojiFor(notebook.id, notebook.emoji) }),
        el('div', { className: 'nb-hero-main' },
          el('h1', { className: 'nb-h1', children: notebook.title }),
          el('p', { className: 'nb-sub', children:
            `${sources.length} source${sources.length === 1 ? '' : 's'} · ${activeCount} active · ${stats.labels || 0} topics · updated ${ago(notebook.updated_at) || 'recently'}` })),
        el('div', { className: 'nb-hero-side' },
          el('span', {
            className: 'nb-chip', 'data-tone': modelReady ? 'ok' : 'warn',
            children: modelReady ? 'grounded' : 'model offline'
          }))
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
      ? jsx(SourcePeek, {
          source: peek, notebook,
          onClose: () => { setPeek(null); setTab('chat') },
          onAskAbout: (s) => { setAskScope({ ids: [s.id], title: s.title }); setTab('chat') },
          onRefresh: onRefreshSource ? () => onRefreshSource(peek) : null
        })
      : tab === 'view' && picked
        ? jsx(Viewer, {
            artifact: picked, notebook, onSearch: () => {},
            regenerating: !!(busy && busy[picked.kind]),
            onRegenerate: () => generate(picked.kind),
            onCite: (n) => {
              const src = sources.find((s) => s.n === n)
              if (src) { setPeek(src); setTab('peek') }
            }
          })
        : jsx(Chat, {
            notebook, kinds, askOpen, onSay, modelReady, reload, askScope, setAskScope,
            generate,
            onCite: (n) => {
              const src = sources.find((s) => s.n === n)
              if (src) { setPeek(src); setTab('peek') }
            },
            onOpenSource,
            onFindSources
          })
  )
}

/* ------------------------------------------------------------------- chat */

const SUGGEST = [
  'Summarise the strongest claim in the sources, with citations.',
  'Where do the sources disagree?',
  'What is missing that I should go and find?'
]

/* overview + suggestions are fetched once per notebook-content version and
   cached for the session — tab switches must not re-bill the model. */
const ovCache = new Map()
/* conversations survive Chat unmounts (peek/viewer tabs swap it out) — the
   module-level cache is the source of truth once a thread has been opened. */
const threadCache = new Map()

function Chat({ notebook, kinds, askOpen, onSay, modelReady, onCite, onOpenSource, onFindSources, reload, askScope, setAskScope, generate }) {
  const nbKey = `${notebook.id}:default`
  const [thread, setThread] = useState('default')
  const [threads, setThreads] = useState(() => notebook.threads || [])
  const [thrOpen, setThrOpen] = useState(false)
  const curThread = useRef('default')
  curThread.current = thread
  const [msgs, setMsgs] = useState(() =>
    threadCache.get(nbKey) || (notebook.thread || []).map((m, i) => ({ ...m, k: `t${i}` })))
  const [text, setText] = useState('')
  const [pending, setPending] = useState(null)
  const [ov, setOv] = useState('')
  const [sugg, setSugg] = useState(null)
  const [cfgOpen, setCfgOpen] = useState(false)
  const [scopeOpen, setScopeOpen] = useState(false)
  const [cfg, setCfg] = useState({})
  const [cfgBusy, setCfgBusy] = useState(false)
  const threadRef = useRef(null)
  const boxRef = useRef(null)
  const stats = notebook.stats || {}
  const activeCount = stats.active !== undefined ? stats.active : (notebook.sources || []).length
  const cacheKey = `${notebook.id}:${stats.sources || 0}:${activeCount}`

  const cacheMsgs = (key, list) => { threadCache.set(key, list); return list }

  // a different notebook → back to its default conversation
  useEffect(() => {
    setThread('default')
    if (setAskScope) setAskScope(null)
    setThreads(notebook.threads || [])
    const key = `${notebook.id}:default`
    const cached = threadCache.get(key)
    const mapped = cached || (notebook.thread || []).map((m, i) => ({ ...m, k: `t${i}` }))
    cacheMsgs(key, mapped)
    setMsgs(mapped)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notebook.id])

  // /state refreshes the thread list (a first message creates the file)
  useEffect(() => { setThreads(notebook.threads || []) }, [notebook.threads])

  // switching conversations: cache hit is instant, otherwise fetch the thread
  useEffect(() => {
    const key = `${notebook.id}:${thread}`
    const cached = threadCache.get(key)
    if (cached) { setMsgs(cached); return undefined }
    if (thread === 'default') {
      const mapped = (notebook.thread || []).map((m, i) => ({ ...m, k: `t${i}` }))
      cacheMsgs(key, mapped)
      setMsgs(mapped)
      return undefined
    }
    let live = true
    setMsgs([])
    api(`/thread?${qs({ notebook: notebook.id, name: thread })}`, { timeoutMs: 30000 })
      .then((out) => {
        if (!live) return
        const mapped = (out.messages || []).map((m, i) => ({ ...m, k: `t${i}` }))
        cacheMsgs(key, mapped)
        setMsgs(mapped)
      })
      .catch(() => {})
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notebook.id, thread])

  useEffect(() => {
    const cached = ovCache.get(notebook.id)
    if (cached && cached.key === cacheKey) { setOv(cached.ov || ''); setSugg(cached.sugg || null); return undefined }
    let live = true
    setOv(''); setSugg(null)
    api('/overview', { method: 'POST', body: { notebook: notebook.id }, timeoutMs: 120000 })
      .then((o) => {
        if (!live) return
        const text = o.overview || ''
        setOv(text)
        const c = ovCache.get(notebook.id) || { key: cacheKey }
        ovCache.set(notebook.id, { key: cacheKey, ov: text, sugg: c.sugg || null })
      })
      .catch(() => {})
    api('/suggest', { method: 'POST', body: { notebook: notebook.id }, timeoutMs: 120000 })
      .then((o) => {
        if (!live) return
        const s = o.suggestions || null
        setSugg(s)
        const c = ovCache.get(notebook.id) || { key: cacheKey }
        ovCache.set(notebook.id, { key: cacheKey, ov: c.ov || '', sugg: s })
      })
      .catch(() => {})
    return () => { live = false }
  }, [notebook.id, cacheKey])

  const saveNote = async () => {
    if (!ov.trim()) return
    try {
      await api('/note', {
        method: 'POST',
        body: { notebook: notebook.id, text: ov, title: `Overview — ${notebook.title}` },
        timeoutMs: 60000
      })
      if (onSay) onSay('overview saved as a note — it is searchable now')
      if (reload) await reload(true)
    } catch (e) { if (onSay) onSay(`could not save note: ${e.message || e}`) }
  }

  const copyOv = () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(ov)
        if (onSay) onSay('overview copied')
      }
    } catch { /* clipboard is a nicety */ }
  }

  useEffect(() => { if (askOpen) { const n = boxRef.current; if (n) n.focus() } }, [askOpen])

  useEffect(() => {
    const node = threadRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [msgs.length, pending && pending.since])

  const send = async (question, opts) => {
    if (pending) return
    const retry = !!(opts && opts.retry)
    const t = thread
    const key = `${notebook.id}:${t}`
    let q
    if (retry) {
      // regenerate the last exchange: keep through the last user message,
      // drop the answer(s) after it — the backend pops the stored pair too
      const cur = threadCache.get(key) || msgs
      let lastUser = -1
      for (let i = cur.length - 1; i >= 0; i--) { if (cur[i].role === 'user') { lastUser = i; break } }
      if (lastUser < 0) return
      q = String(cur[lastUser].content || '').trim()
      if (!q) return
      const cut = cur.slice(0, lastUser + 1)
      cacheMsgs(key, cut)
      setMsgs(cut)
    } else {
      q = (question || text).trim()
      if (!q) return
      setText('')
      setMsgs((m) => cacheMsgs(key, [...m, { role: 'user', content: q, k: `u${Date.now()}` }]))
    }
    const started = Date.now()
    setPending({ since: started, q })
    const tick = setInterval(() => setPending((p) => (p ? { ...p, now: Date.now() } : p)), 500)
    try {
      const out = await api('/ask', {
        method: 'POST',
        body: {
          notebook: notebook.id, question: q, thread: t,
          ...(retry ? { retry: true } : {}),
          ...(askScope && (askScope.ids || askScope.id)
            ? { source_ids: askScope.ids || [askScope.id] }
            : {})
        },
        timeoutMs: 180000
      })
      const answer = {
        role: 'assistant', content: out.answer, k: `a${Date.now()}`,
        citations: out.citations || [], seconds: out.seconds,
        meta: `${out.chunks_used || 0} of ${out.total_chunks || 0} passages`
      }
      const prev = threadCache.get(key) || []
      const next = cacheMsgs(key, [...prev, answer])
      if (curThread.current === t) setMsgs(next)
      // refresh /state so the thread list + default thread stay truthful
      if (reload) reload(true)
    } catch (e) {
      const errMsg = {
        role: 'assistant', content: `**That question did not get an answer.**\n\n${e.message || e}`,
        k: `e${Date.now()}`, error: true
      }
      const prev = threadCache.get(key) || []
      const next = cacheMsgs(key, [...prev, errMsg])
      if (curThread.current === t) setMsgs(next)
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
  const thrMeta = (threads || []).find((x) => x.name === thread)
  const thrLabel = (thrMeta && thrMeta.title) || (thread === 'default' ? 'Chat' : 'New chat')

  return el('div', { className: 'nb-chat' },
    el('div', { className: 'nb-thread', ref: threadRef, role: 'log', 'aria-live': 'polite', 'aria-label': 'Conversation' },
      ov
        ? el('div', { className: 'nb-overview' },
            el('div', { className: 'nb-overview-head' },
              jsx(Glyph, { name: 'sparkle', size: 14 }),
              el('span', { className: 'nb-meta', children: 'Overview' }),
              el('span', { style: { flex: 1 } }),
              jsx(Btn, { size: 'sm', icon: 'copy', onClick: copyOv, children: 'Copy' }),
              jsx(Btn, { size: 'sm', icon: 'pin', onClick: saveNote, children: 'Save to note' })
            ),
            el('div', { className: 'nb-overview-body' },
              jsx(Markdown, { text: ov, onCite })))
        : null,
      msgs.length === 0 && !pending
        ? el('div', { style: { margin: msgs.length || ov ? '0' : 'auto', textAlign: 'center', maxWidth: '54ch' } },
            el('div', { style: { display: 'grid', placeItems: 'center', gap: '10px' } },
              el('span', { className: 'nb-mark', style: { width: '38px', height: '38px' } },
                jsx(Glyph, { name: 'sparkle', size: 19 })),
              el('div', { style: { fontSize: '20px', fontWeight: 650, letterSpacing: '-.015em' }, children: 'Ask the sources' }),
              el('div', {
                style: { color: T.text3, fontSize: '14.5px', lineHeight: 1.6 },
                children: 'Every answer is built from this notebook and cites the source it came from. If the sources do not cover it, the answer says so.'
              })))
        : null,
      msgs.length === 0 && !pending && sugg && (sugg.questions || []).length
        ? el('div', { style: { marginTop: ov ? '18px' : '0' } },
            el('div', { className: 'nb-meta', style: { marginBottom: '10px' }, children: 'Suggested questions' }),
            el('div', { className: 'nb-suggest-grid' },
              sugg.questions.slice(0, 3).map((question) => el('button', {
                key: question, type: 'button', className: 'nb-suggest',
                onClick: () => send(question),
                'aria-label': `Ask: ${question}`,
                children: [
                  el('span', { className: 'nb-suggest-q', children: question }),
                  el('span', { className: 'nb-suggest-go', 'aria-hidden': 'true' },
                    jsx(Glyph, { name: 'arrowRight', size: 14 }))
                ]
              }, question))),
            (sugg.gaps || []).length
              ? el('div', { className: 'nb-gaprow', style: { marginTop: '14px' } },
                  el('span', { className: 'nb-meta', children: 'Source gaps' }),
                  sugg.gaps.slice(0, 3).map((g) => jsx(Chip, {
                    key: g, onClick: () => onFindSources && onFindSources(g),
                    title: 'Find sources for this gap', children: g
                  })))
              : null,
            (sugg.artifacts || []).length
              ? el('div', { className: 'nb-gaprow', style: { marginTop: '14px' } },
                  el('span', { className: 'nb-meta', children: 'Worth making' }),
                  sugg.artifacts.slice(0, 4).map((a) => {
                    const [kid, ...rest] = String(a).split(':')
                    const kindId = (kid || '').trim()
                    const known = (kinds || []).some((k) => k.id === kindId)
                    const reason = rest.join(':').trim() || kindId
                    return jsx(Chip, {
                      key: a,
                      onClick: known && generate ? () => generate(kindId) : undefined,
                      title: known ? `Generate ${kindLabel(kindId)}` : 'unknown output kind',
                      children: reason
                    })
                  }))
              : null)
        : null,
      msgs.map((m, i) => jsx(Msg, {
        msg: m, onCite, onOpenSource, notebook,
        canRetry: !pending && m.role === 'assistant' && i === msgs.length - 1 &&
                  msgs.slice(0, i).some((x) => x.role === 'user'),
        onRetry: () => send(null, { retry: true })
      }, m.k)),
      pending
        ? el('div', { className: 'nb-msg', 'data-role': 'assistant' },
            el('span', { className: 'nb-avatar', children: 'HN' }),
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
          placeholder: 'Ask a question or create something',
          'aria-label': 'Ask the notebook',
          rows: 2
        }),
        el('div', { className: 'nb-askfoot' },
          jsx(Chip, {
            title: 'Conversations — switch or start a new chat',
            onClick: () => setThrOpen(true),
            children: `💬 ${thrLabel}`
          }),
          jsx(Chip, {
            title: `${activeCount} of ${stats.sources || 0} sources are in context`,
            children: `${activeCount} source${activeCount === 1 ? '' : 's'}`
          }),
          askScope
            ? jsx(Chip, {
                tone: 'accent',
                title: `Answering from ${askScope.title} only — click to clear`,
                onClick: () => setAskScope && setAskScope(null),
                children: `only: ${String(askScope.title || 'sources').slice(0, 28)}`
              })
            : null,
          jsx(IconBtn, {
            icon: 'layers', label: 'Choose which sources to answer from',
            onClick: () => setScopeOpen(true)
          }),
          jsx(IconBtn, {
            icon: 'sliders', label: 'Configure chat',
            onClick: () => {
              const o = notebook.options || {}
              setCfg({
                chat_style: o.chat_style || 'default',
                chat_length: o.chat_length || 'medium',
                chat_custom: o.chat_custom || ''
              })
              setCfgOpen(true)
            }
          }),
          el('span', { className: 'nb-hint', style: { marginLeft: 'auto' },
            children: modelReady ? '⏎ send · ⇧⏎ newline' : 'model offline — enable the plugin and restart the gateway' }),
          el('button', {
            type: 'button', className: 'nb-sendbtn',
            onClick: () => send(), disabled: !text.trim() || !!pending,
            'aria-label': pending ? 'Asking…' : 'Send question',
            title: pending ? 'Asking…' : 'Send',
            children: jsx(Glyph, { name: 'send', size: 15 })
          }))
      ),
      el('div', { className: 'nb-disclaimer',
        children: 'Hermes Notebook can make mistakes — double-check it.' }),
      cfgOpen
        ? jsx(Dialog, {
            open: true,
            title: 'Configure chat',
            onClose: () => setCfgOpen(false),
            children: el('div', { style: { display: 'grid', gap: '16px' } },
              el('div', null,
                el('div', { className: 'nb-meta', style: { marginBottom: '8px' }, children: 'Response style' }),
                jsx(Seg, {
                  label: 'Response style', fill: true,
                  value: cfg.chat_style || 'default',
                  onChange: (v) => setCfg((c) => ({ ...c, chat_style: v })),
                  options: [
                    { id: 'default', label: 'Default' },
                    { id: 'learning_guide', label: 'Learning guide' },
                    { id: 'custom', label: 'Custom' }
                  ]
                }),
                cfg.chat_style === 'custom'
                  ? el('input', {
                      className: 'nb-genopt-text', type: 'text',
                      placeholder: 'e.g. always end with a checklist',
                      value: cfg.chat_custom || '',
                      onChange: (e) => setCfg((c) => ({ ...c, chat_custom: e.target.value })),
                      style: { marginTop: '8px', width: '100%' }
                    })
                  : null),
              el('div', null,
                el('div', { className: 'nb-meta', style: { marginBottom: '8px' }, children: 'Response length' }),
                jsx(Seg, {
                  label: 'Response length', fill: true,
                  value: cfg.chat_length || 'medium',
                  onChange: (v) => setCfg((c) => ({ ...c, chat_length: v })),
                  options: [
                    { id: 'short', label: 'Short' },
                    { id: 'medium', label: 'Medium' },
                    { id: 'long', label: 'Long' }
                  ]
                })),
              el('div', { style: { display: 'flex', gap: '8px', justifyContent: 'flex-end' } },
                jsx(Btn, { onClick: () => setCfgOpen(false), children: 'Cancel' }),
                jsx(Btn, {
                  variant: 'primary', disabled: cfgBusy,
                  onClick: async () => {
                    setCfgBusy(true)
                    try {
                      await api('/options', {
                        method: 'POST',
                        body: {
                          notebook: notebook.id,
                          options: {
                            chat_style: cfg.chat_style === 'custom' ? 'custom' : cfg.chat_style,
                            chat_length: cfg.chat_length,
                            chat_custom: cfg.chat_style === 'custom' ? cfg.chat_custom : ''
                          }
                        },
                        timeoutMs: 30000
                      })
                      setCfgOpen(false)
                      if (reload) reload()
                    } catch (e) {
                      onSay && onSay(`could not save chat options: ${e.message || e}`)
                    } finally {
                      setCfgBusy(false)
                    }
                  },
                  children: 'Save'
                })))
            })
        : null,
      scopeOpen
        ? jsx(ScopeDialog, {
            notebook, current: askScope,
            onClose: () => setScopeOpen(false),
            onPick: (scope) => { if (setAskScope) setAskScope(scope); setScopeOpen(false) }
          })
        : null,
      thrOpen
        ? jsx(ThreadDialog, {
            notebook, threads, current: thread,
            onClose: () => setThrOpen(false),
            onPick: (name) => { setThread(name); setThrOpen(false) },
            onNew: () => {
              const name = `chat-${Date.now().toString(36)}`
              threadCache.set(`${notebook.id}:${name}`, [])
              setThread(name); setThrOpen(false)
            },
            onClear: async () => {
              try {
                await api('/thread/clear', {
                  method: 'POST',
                  body: { notebook: notebook.id, thread },
                  timeoutMs: 30000
                })
                const key = `${notebook.id}:${thread}`
                cacheMsgs(key, [])
                setMsgs([])
                setThreads((ts) => ts.filter((t) => t.name !== thread))
                if (reload) reload(true)
                setThrOpen(false)
              } catch (e) { onSay && onSay(`could not clear chat: ${e.message || e}`) }
            }
          })
        : null
    )
  )
}

/* pick which sources the next answers draw from — NotebookLM's per-chat
   source selection. Scope rides /ask's source_ids (max 12 server-side). */
function ScopeDialog({ notebook, current, onClose, onPick }) {
  const sources = (notebook && notebook.sources) || []
  const curIds = new Set((current && (current.ids || (current.id ? [current.id] : []))) || [])
  const [sel, setSel] = useState(() => new Set(curIds))
  const toggle = (id) => setSel((s) => {
    const n = new Set(s)
    if (n.has(id)) n.delete(id); else n.add(id)
    return n
  })
  const ids = [...sel]
  const title = ids.length === 1
    ? (sources.find((s) => s.id === ids[0]) || {}).title || '1 source'
    : `${ids.length} sources`
  return jsx(Dialog, {
    open: true, onClose, title: 'Answer from', width: 480,
    children: el('div', { style: { display: 'grid', gap: '8px' } },
      sources.length > 12
        ? el('div', { className: 'nb-hint', style: { marginBottom: '4px' },
            children: 'At most 12 sources can scope one answer — pick the most relevant.' })
        : null,
      sources.map((s) => el('button', {
        key: s.id, type: 'button', className: 'nb-thrrow',
        onClick: () => toggle(s.id),
        'aria-pressed': sel.has(s.id) ? 'true' : 'false'
      },
        el('span', {
          className: 'nb-scope-check' + (sel.has(s.id) ? ' on' : ''),
          'aria-hidden': 'true',
          children: sel.has(s.id) ? '✓' : ''
        }),
        el('span', { className: 'nb-chip', 'data-tone': 'accent', children: `S${s.n}` }),
        el('span', { style: { flex: 1, minWidth: 0, textAlign: 'left' } },
          el('div', { style: { fontSize: '13.5px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
            children: s.title }),
          el('div', { className: 'nb-meta', children: kindLabel(s.kind) })))),
      el('div', { style: { display: 'flex', gap: '8px', justifyContent: 'space-between', marginTop: '10px' } },
        jsx(Btn, {
          size: 'sm', onClick: () => onPick(null),
          children: 'All sources'
        }),
        jsx(Btn, {
          size: 'sm', variant: 'primary', disabled: !ids.length,
          onClick: () => onPick({ ids: ids.slice(0, 12), title }),
          children: ids.length ? `Use ${ids.length} source${ids.length === 1 ? '' : 's'}` : 'Pick sources'
        })))
  })
}

function ThreadDialog({ notebook, threads, current, onClose, onPick, onNew, onClear }) {
  const list = threads && threads.length ? threads : [{ name: 'default', title: 'Chat', count: 0 }]
  return jsx(Dialog, {
    open: true, onClose, title: 'Conversations', width: 460,
    children: el('div', { style: { display: 'grid', gap: '8px' } },
      list.map((t) => el('button', {
        key: t.name, type: 'button',
        className: 'nb-thrrow' + (t.name === current ? ' is-current' : ''),
        onClick: () => onPick(t.name),
        'aria-current': t.name === current ? 'true' : undefined
      },
        el('div', { style: { flex: 1, minWidth: 0 } },
          el('div', { style: { fontSize: '14px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
            children: t.title || t.name }),
          el('div', { className: 'nb-meta', children: `${t.count || 0} messages` })),
        t.name === current ? jsx(Glyph, { name: 'check', size: 15 }) : null)),
      el('div', { style: { display: 'flex', gap: '8px', justifyContent: 'space-between', marginTop: '10px' } },
        jsx(Btn, { size: 'sm', icon: 'trash', onClick: onClear, children: 'Clear this chat' }),
        jsx(Btn, { size: 'sm', variant: 'primary', icon: 'plus', onClick: onNew, children: 'New chat' })))
  })
}

const CITE_TEXT_CACHE = new Map()

function Msg({ msg, onCite, notebook, canRetry, onRetry }) {
  const isUser = msg.role === 'user'
  const [citePop, setCitePop] = useState(null)

  const citeFor = (n) => (msg.citations || []).find((c) => c.n === n)

  const onMouseOver = (e) => {
    const b = e.target && e.target.closest ? e.target.closest('.nb-inline-cite') : null
    if (!b || !notebook) return
    const n = Number(b.getAttribute('data-n'))
    const c = citeFor(n)
    if (!c) return
    const r = b.getBoundingClientRect()
    setCitePop({ n, x: r.left, y: r.bottom + 8, title: c.title, kind: c.kind, id: c.id, text: null, loading: true })
    const key = `${notebook.id}:${c.id || n}`
    if (CITE_TEXT_CACHE.has(key)) {
      setCitePop((p) => (p && p.n === n ? { ...p, text: CITE_TEXT_CACHE.get(key), loading: false } : p))
      return
    }
    if (!c.id) { setCitePop((p) => (p && p.n === n ? { ...p, loading: false } : p)); return }
    api(`/source_text?${qs({ notebook: notebook.id, id: c.id, chars: 700 })}`, { timeoutMs: 20000 })
      .then((out) => {
        const passage = String(out.text || out.source_text || '').replace(/\s+/g, ' ').trim().slice(0, 420)
        CITE_TEXT_CACHE.set(key, passage)
        setCitePop((p) => (p && p.n === n ? { ...p, text: passage, loading: false } : p))
      })
      .catch(() => {
        CITE_TEXT_CACHE.set(key, '')
        setCitePop((p) => (p && p.n === n ? { ...p, text: '', loading: false } : p))
      })
  }
  const onMouseOut = (e) => {
    const b = e.target && e.target.closest ? e.target.closest('.nb-inline-cite') : null
    if (b) setCitePop(null)
  }

  return el('div', { className: 'nb-msg', 'data-role': isUser ? 'user' : 'assistant' },
    isUser ? null : el('span', { className: 'nb-avatar', children: 'HN' }),
    el('div', { className: 'nb-msg-body', onMouseOver: isUser ? undefined : onMouseOver, onMouseOut: isUser ? undefined : onMouseOut },
      isUser
        ? el('div', { className: 'nb-bubble' },
            el('div', { className: 'nb-who', children: 'You' }),
            el('div', { children: msg.content }))
        : el('div', null,
            el('div', { className: 'nb-who' },
              'Hermes Notebook',
              msg.meta ? el('span', { style: { marginLeft: '8px', color: T.text4, fontWeight: 500, textTransform: 'none', letterSpacing: 0 }, children: `· ${msg.meta}` }) : null,
              jsx(IconBtn, {
                icon: 'copy', size: 13, label: 'Copy answer',
                onClick: () => {
                  try { if (navigator.clipboard) navigator.clipboard.writeText(msg.content) } catch { /* clipboard unavailable */ }
                }
              }),
              canRetry
                ? jsx(IconBtn, { icon: 'refresh', size: 13, label: 'Regenerate this answer', onClick: onRetry })
                : null,
              notebook ? jsx(IconBtn, {
                icon: 'pin', size: 13, label: 'Save this answer as a note',
                onClick: async () => {
                  try {
                    const first = String(msg.content || '').split('\n').find((l) => l.trim()) || 'Notebook answer'
                    await api('/note', {
                      method: 'POST',
                      body: { notebook: notebook.id, text: msg.content, title: first.slice(0, 90) },
                      timeoutMs: 30000
                    })
                  } catch { /* note save is best-effort */ }
                }
              }) : null),
            el('div', { className: 'nb-bubble' },
              jsx(Markdown, { text: msg.content, onCite })),
            (msg.citations || []).length
              ? el('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }, role: 'list', 'aria-label': 'Citations' },
                  msg.citations.map((c) => el('button', {
                    key: `${c.n}-${c.title}`, type: 'button', className: 'nb-chip nb-citechip',
                    onClick: () => onCite && onCite(c.n),
                    title: c.origin || c.title,
                    'aria-label': `Citation ${c.n} — ${c.title}`,
                    children: [el('b', { children: `S${c.n}` }), el('span', { children: c.title })]
                  })))
              : null)),
    citePop
      ? el('div', {
          className: 'nb-citepop', role: 'tooltip',
          style: { left: `${Math.min(citePop.x, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 340)}px`, top: `${citePop.y}px` },
          children: [
            el('div', { className: 'nb-citepop-head' },
              el('b', { children: `S${citePop.n}` }),
              el('span', { children: citePop.title || 'source' }),
              citePop.kind ? el('span', { className: 'nb-meta', children: citePop.kind }) : null),
            el('div', { className: 'nb-citepop-body',
              children: citePop.loading
                ? 'reading the passage…'
                : citePop.text
                  ? `“${citePop.text}${citePop.text.length >= 420 ? '…' : ''}”`
                  : 'passage unavailable — click the citation to open the source' })
          ]
        })
      : null
  )
}

/* ---------------------------------------------------------------- peek */

function SourcePeek({ source, notebook, onClose, onAskAbout, onRefresh }) {
  const [text, setText] = useState('')
  const [err, setErr] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  useEffect(() => {
    let live = true
    setText('')
    api(`/source_text?${qs({ notebook: notebook.id, id: source.id, chars: 24000 })}`)
      .then((out) => { if (live) setText(out.text || '') })
      .catch((e) => { if (live) setErr(e.message || String(e)) })
    return () => { live = false }
  }, [source.id, notebook.id, source.chars, source.refreshed_at])
  return el('div', { className: 'nb-view' },
    el('div', { className: 'nb-view-head' },
      el('span', { className: 'nb-chip', 'data-tone': 'accent', children: `S${source.n}` }),
      el('div', { style: { flex: 1, minWidth: 0 } },
        el('div', { className: 'nb-view-title', children: source.title }),
        el('div', { style: { fontSize: '12.5px', color: T.text4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
          children: `${kindLabel(source.kind)} · ${nfmt(source.chars)} chars · ${source.origin || 'stored text'}` })),
      source.origin && source.origin.startsWith('http')
        ? jsx(IconBtn, { icon: 'external', label: 'Open the original', onClick: () => host.openLink ? host.openLink(source.origin) : window.open(source.origin, '_blank') })
        : null,
      onRefresh && !['note', 'text'].includes(source.kind)
        ? jsx(IconBtn, {
            icon: 'refresh', label: 'Refresh source — re-fetch it from its origin',
            active: refreshing, disabled: refreshing,
            onClick: async () => {
              setRefreshing(true)
              try { await onRefresh() } finally { setRefreshing(false) }
            }
          })
        : null,
      jsx(IconBtn, { icon: 'close', label: 'Close source', onClick: onClose })
    ),
    el('div', { className: 'nb-view-body' },
      onAskAbout
        ? el('div', { style: { marginBottom: '14px' } },
            jsx(Btn, {
              size: 'sm', icon: 'faq',
              onClick: () => onAskAbout(source),
              children: 'Ask about this source'
            }))
        : null,
      (source.labels || []).length || source.summary
        ? el('div', { style: { marginBottom: '14px', display: 'grid', gap: '8px' } },
            source.summary
              ? el('div', { style: { fontSize: '14px', color: T.text2, lineHeight: 1.55 }, children: source.summary })
              : null,
            (source.labels || []).length
              ? el('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' } },
                  jsx(Glyph, { name: 'tag', size: 13 }),
                  source.labels.map((l) => jsx(Chip, { key: l, children: l })))
              : null)
        : null,
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

function StudioPanel({ kinds, notebook, busy, generate, filter, setFilter, onOpen, onDelete, onCollapse, onAddNote }) {
  const ready = latestByKind(notebook ? notebook.artifacts : [])
  const arts = (notebook && notebook.artifacts) || []
  const kindGroup = {}
  for (const k of kinds) kindGroup[k.id] = k.group || 'other'
  const shownArts = arts.filter((a) => filter === 'all' || kindGroup[a.kind] === filter)
  const scrollRef = useRef(null)
  const [canScroll, setCanScroll] = useState(false)

  // A list taller than the panel is fine, but a row sliced at the panel edge
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
  }, [shownArts.length, filter])

  return el('aside', { className: 'nb-col nb-studio', 'aria-label': 'Studio' },
    el('div', { className: 'nb-pane-head' },
      el('span', { className: 'nb-pane-title', children: 'Studio' }),
      el('span', {
        className: 'nb-chip',
        'data-tone': Object.keys(ready).length ? 'ok' : undefined,
        children: `${Object.keys(ready).length}/${kinds.length}`
      }),
      jsx(IconBtn, { icon: 'arrowRight', label: 'Hide studio panel', onClick: onCollapse })
    ),
    el('div', { className: 'nb-pad', style: { paddingBottom: '8px' } },
      el('div', { className: 'nb-gen-grid' },
        kinds.map((k) => jsx(GenPill, {
          key: k.id, kind: k, art: ready[k.id], started: busy[k.id],
          nbId: notebook && notebook.id,
          onOpen: () => { const a = ready[k.id]; if (a) onOpen(a); else generate(k.id) },
          onGenerate: (opts) => generate(k.id, opts)
        })))),
    el('div', { className: 'nb-pad', style: { paddingTop: '10px', paddingBottom: '4px', borderTop: `1px solid ${T.lineSoft}` } },
      el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } },
        el('span', { className: 'nb-meta', children: 'Artifacts' }),
        el('span', { style: { flex: 1 } }),
        FILTERS.map((f) => jsx(Chip, {
          key: f.id, tone: filter === f.id ? 'accent' : undefined,
          pressed: filter === f.id,
          onClick: () => setFilter(f.id),
          title: `${f.label} artifacts`, children: f.label
        })))),
    el('div', { className: 'nb-scroll', ref: scrollRef, 'data-scrollable': canScroll ? 'true' : 'false' },
      el('div', { className: 'nb-artlist', style: { padding: '4px 8px 18px' } },
        shownArts.length === 0
          ? el('div', { className: 'nb-hint', style: { padding: '14px 8px', lineHeight: 1.5 } },
              notebook && notebook.sources && notebook.sources.length
                ? 'Nothing generated yet — pick an output above.'
                : 'Add sources first — every artifact is built from them.')
          : shownArts.map((a, i) => el('div', { key: a.key || a.primary || i, className: 'nb-artrow' },
              el('button', {
                type: 'button', className: 'nb-art',
                'data-kind': a.kind,
                onClick: () => onOpen(a),
                'aria-label': `Open ${a.label || a.kind}`,
                title: a.primary || a.label,
                children: [
                  el('span', { className: 'nb-art-ico', 'aria-hidden': 'true' },
                    i < 12 ? jsx(ArtThumb, { run: a, nbId: notebook && notebook.id })
                      : jsx(Glyph, { name: KIND_ICON[a.kind] || 'doc', size: 17 })),
                  el('span', { className: 'nb-art-main' },
                    el('span', { className: 'nb-art-title', children: a.label || a.kind }),
                    el('span', { className: 'nb-art-sub',
                      children: `${nfmt(a.bytes)} · ${ago(a.modified)}` }))
                ]
              }, a.key || a.primary || i),
              onDelete ? jsx(IconBtn, {
                icon: 'trash', size: 13, className: 'nb-art-del',
                label: `Delete ${a.label || a.kind} artifact`,
                onClick: () => onDelete(a)
              }) : null)))),
    canScroll ? jsx('div', { className: 'nb-fade', 'aria-hidden': 'true' }) : null,
    el('div', { className: 'nb-pad', style: { borderTop: `1px solid ${T.lineSoft}`, display: 'flex', justifyContent: 'center', paddingTop: '10px', paddingBottom: '12px' } },
      jsx(Btn, { icon: 'note', onClick: onAddNote, disabled: !notebook, children: 'Add note' }))
  )
}

function GenPill({ kind, art, started, nbId, onOpen, onGenerate }) {
  const [, force] = useState(0)
  const [opts, setOpts] = useState({})
  const [cfgOpen, setCfgOpen] = useState(false)
  const [notes, setNotes] = useState(null)
  const [notesBusy, setNotesBusy] = useState(false)
  const optSpecs = kind.options || []
  useEffect(() => {
    if (!started) return undefined
    const t = setInterval(() => force((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [started])
  const secs = started ? Math.max(0, Math.round((Date.now() - started) / 1000)) : 0
  const state = started ? `writing · ${secs}s` : art ? `ready · ${ago(art.modified)}` : 'Generate'
  const pick = (id, v) => setOpts((o) => ({ ...o, [id]: v }))
  return el('div', { className: 'nb-gen', 'data-kind': kind.id },
    el('button', {
      type: 'button', className: 'nb-card',
      'data-kind': kind.id,
      'data-ready': art ? 'true' : 'false', 'data-busy': started ? 'true' : 'false',
      onClick: started ? undefined : (art ? onOpen : () => onGenerate(opts)),
      'aria-label': `${kind.label} — ${state}. ${art ? 'Open it' : 'Generate it'}`,
      title: art ? `${kind.label} · ${art.primary}` : `Generate ${kind.label}`,
      children: [
        el('span', { className: 'nb-card-ico', 'aria-hidden': 'true' },
          jsx(Glyph, { name: KIND_ICON[kind.id] || 'doc', size: 15 })),
        el('span', { className: 'nb-card-main' },
          el('span', { className: 'nb-card-name', children: kind.label }),
          el('span', { className: 'nb-card-state' },
            el('span', {
              className: 'nb-dot',
              style: { background: started ? 'var(--kc)' : art ? T.ok : undefined }
            }),
            started ? `${secs}s` : art ? ago(art.modified) : 'generate'),
          started
            ? el('span', { className: 'nb-bar-track', style: { marginTop: '2px' } },
                el('span', {
                  className: 'nb-bar-fill',
                  style: { width: `${Math.min(96, 12 + secs * 2.2)}%`, opacity: 0.9 }
                }))
            : null)
      ]
    }),
    optSpecs.length
      ? jsx(IconBtn, {
          icon: 'sliders', label: `${kind.label} options`,
          className: 'nb-gen-cfg', active: cfgOpen,
          onClick: () => setCfgOpen((o) => !o)
        })
      : null,
    cfgOpen && optSpecs.length
      ? el('div', { className: 'nb-genpop', role: 'dialog', 'aria-label': `${kind.label} options` },
          optSpecs.map((spec) => el('div', { key: spec.id, className: 'nb-genopt' },
            el('div', { className: 'nb-genopt-label', children: spec.label }),
            spec.kind === 'text'
              ? el('input', {
                  className: 'nb-genopt-text', type: 'text',
                  placeholder: spec.placeholder || '',
                  value: opts[spec.id] || '',
                  onChange: (e) => pick(spec.id, e.target.value)
                })
              : el(Seg, {
                  value: opts[spec.id] || spec.choices[0],
                  onChange: (v) => pick(spec.id, v),
                  options: spec.choices.map((c) => ({
                    id: c, label: c.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase())
                  }))
                }))),
          kind.id === 'video_overview' && nbId
            ? el('div', { style: { borderTop: `1px solid ${T.lineSoft}`, paddingTop: '10px', display: 'grid', gap: '8px' } },
                jsx(Btn, {
                  size: 'sm', icon: 'doc', disabled: notesBusy || started,
                  onClick: async () => {
                    setNotesBusy(true)
                    try {
                      const out = await api('/video_notes', {
                        method: 'POST',
                        body: { notebook: nbId, style: opts.style || 'cinematic', length: opts.length || 'short', language: opts.language || '', focus: opts.focus || '' },
                        timeoutMs: 180000
                      })
                      setNotes(out)
                    } catch (e) {
                      setNotes({ error: e.message || String(e) })
                    } finally {
                      setNotesBusy(false)
                    }
                  },
                  children: notesBusy ? 'Writing script…' : 'Review script first'
                }),
                notes && !notes.error
                  ? jsx(Btn, {
                      size: 'sm', variant: 'primary', disabled: started,
                      onClick: () => { setCfgOpen(false); onGenerate({ ...opts, notes }) },
                      children: `Render with these notes (${(notes.beats || []).length} beats)`
                    })
                  : null)
            : null)
      : null,
    notes
      ? jsx(Dialog, {
          open: true, title: notes.title || 'Video producer notes',
          onClose: () => setNotes(null), width: 640,
          children: notes.error
            ? el('div', { style: { color: T.danger }, children: notes.error })
            : el('div', { style: { display: 'grid', gap: '10px' } },
                el('div', { className: 'nb-meta', children: `${(notes.beats || []).length} beats · ${notes.style} · ${notes.length}` }),
                (notes.beats || []).map((b, i) => el('div', {
                  key: i, style: {
                    border: `1px solid ${T.lineSoft}`, borderRadius: '12px', padding: '10px 12px'
                  }
                },
                  el('div', { style: { fontSize: '12px', fontWeight: 650, color: T.accent, marginBottom: '4px' },
                    children: `${String(i + 1).padStart(2, '0')} · ${b.headline || 'beat'}` }),
                  el('div', { style: { fontSize: '13px', color: T.text2, lineHeight: 1.5 }, children: b.text }))))
        })
      : null
  )
}

/* ------------------------------------------------------------- art thumbs
 * Cheap previews inside the 40px artifact tile: infographic fetches its png
 * once, audio gets a seeded waveform (no bytes), everything else is the kind
 * glyph on its colour wash. Nothing here fabricates content.
 */
function ArtThumb({ run, nbId }) {
  const ext = String(run.ext || (run.primary || '').split('.').pop() || '').toLowerCase()
  if (ext === 'png') return jsx(ThumbImg, { nbId, name: run.primary, alt: run.label || '' })
  if (ext === 'mp3') return jsx(WaveThumb, { seed: `${run.kind}:${run.key || run.primary}` })
  return jsx(Glyph, { name: KIND_ICON[run.kind] || 'doc', size: 17 })
}

function ThumbImg({ nbId, name, alt }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    if (!nbId || !name) return undefined
    let live = true
    let made = ''
    api(`/artifact?${qs({ notebook: nbId, name, b64: 1 })}`, { timeoutMs: 30000 })
      .then((out) => {
        if (!live) return
        const raw = atob(out.b64 || '')
        const bytes = new Uint8Array(raw.length)
        for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i)
        made = URL.createObjectURL(new Blob([bytes], { type: out.mime || 'image/png' }))
        setUrl(made)
      })
      .catch(() => {})
    return () => { live = false; if (made) URL.revokeObjectURL(made) }
  }, [nbId, name])
  return url ? el('img', { className: 'nb-thumb-img', src: url, alt: alt || '' }) : null
}

function WaveThumb({ seed }) {
  const bars = useMemo(() => {
    const n = 22
    let x = 0
    for (let i = 0; i < seed.length; i += 1) x = (x * 31 + seed.charCodeAt(i)) % 100000
    const out = []
    for (let i = 0; i < n; i += 1) {
      x = (x * 1103515245 + 12345) % 2147483648
      out.push(0.25 + ((x % 100) / 100) * 0.75)
    }
    return out
  }, [seed])
  return el('span', { className: 'nb-thumb-wave' },
    bars.map((h, i) => jsx('i', { key: `w${i}`, style: { height: `${Math.round(h * 100)}%` } })))
}

/* -------------------------------------------------------------- status bar */

function StatusBar({ mode, notebook, data, note, opsStats }) {
  const ready = data && data.model_ready
  const ops = mode === 'ops'
  const home = mode === 'home'
  const notebooks = (data && data.notebooks) || []
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
      : home
        ? el('span', null,
            jsx('span', { className: 'nb-sdot', style: { background: ready ? T.ok : T.warn } }),
            `${notebooks.length} notebook${notebooks.length === 1 ? '' : 's'} · `,
            ready ? 'model ready' : 'model offline')
        : el('span', null,
            jsx('span', { className: 'nb-sdot', style: { background: ready ? T.ok : T.warn } }),
            ready ? 'grounded · model ready' : 'model offline — enable the plugin'),
    !ops && !home && notebook
      ? el('span', null, jsx('b', { children: notebook.stats.sources }), ' sources · ',
          jsx('b', { children: nfmt(notebook.stats.chars) }), ' chars · ',
          jsx('b', { children: notebook.stats.labels }), ' labels')
      : null,
    !ops && !home && notebook && notebook.stats.unlabeled
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
  { id: 'find', label: 'Find for me', icon: 'sparkle' },
  { id: 'url', label: 'Web URL', icon: 'link' },
  { id: 'path', label: 'File path', icon: 'file' },
  { id: 'text', label: 'Paste text', icon: 'note' }
]

const hostOf = (url) => {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}

/* notebook-wide passage search — deterministic BM25 over every source,
   results open the owning source in the peek pane. */
function SearchDialog({ open, onClose, notebook, onPick }) {
  const [q, setQ] = useState('')
  const [hits, setHits] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const nbId = notebook && notebook.id

  useEffect(() => {
    if (!open) { setQ(''); setHits(null); setErr(''); setBusy(false); return undefined }
    const query = q.trim()
    if (query.length < 2 || !nbId) { setHits(null); setBusy(false); return undefined }
    let live = true
    setBusy(true)
    const t = setTimeout(() => {
      api('/search', { method: 'POST', body: { notebook: nbId, query, limit: 12 }, timeoutMs: 30000 })
        .then((out) => {
          if (!live) return
          setHits((((out || {}).result || {}).hits) || [])
          setErr('')
        })
        .catch((e) => { if (live) { setHits([]); setErr(e.message || String(e)) } })
        .finally(() => { if (live) setBusy(false) })
    }, 260)
    return () => { live = false; clearTimeout(t) }
  }, [q, open, nbId])

  const query = q.trim()
  const mark = (text) => {
    if (!query) return text
    const parts = String(text || '').split(
      new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'))
    return parts.map((p, i) => (i % 2 ? el('mark', { key: i, children: p }) : p))
  }

  return jsx(Dialog, {
    open, onClose, title: 'Search this notebook', width: 640,
    children: [
      jsx(SearchField, {
        value: q, onChange: setQ,
        placeholder: 'Search across every source…', label: 'Search this notebook'
      }),
      el('div', { style: { marginTop: '14px', display: 'grid', gap: '8px' } },
        err ? el('div', { style: { color: T.danger, fontSize: '13px' }, children: err }) : null,
        query.length < 2
          ? el('div', { className: 'nb-hint', children: 'Type at least two characters — results are ranked passages from your sources.' })
          : null,
        query.length >= 2 && !busy && hits && hits.length === 0
          ? el('div', { className: 'nb-hint', children: `No passages match “${query}”.` })
          : null,
        busy ? el('div', { className: 'nb-hint', children: 'searching…' }) : null,
        (hits || []).map((h) => el('button', {
          key: `${h.source_id}-${h.chunk_index}`, type: 'button', className: 'nb-search-hit',
          onClick: () => { if (onPick) onPick(h); onClose() },
          children: [
            el('div', { className: 'nb-search-hit-head' },
              el('b', { children: h.title || h.source_id }),
              h.kind ? el('span', { className: 'nb-meta', children: kindLabel(h.kind) }) : null),
            el('div', { className: 'nb-search-hit-snip', children: mark(h.snippet) })
          ]
        })))
    ]
  })
}

function AddSourceDialog({ open, onClose, notebook, onDone, initialMode, seedQuery, noteOnly }) {
  const [mode, setMode] = useState(noteOnly ? 'note' : (initialMode || 'find'))
  const [value, setValue] = useState('')
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  // the find flow: describe -> candidates -> pick -> batch ingest -> summary
  const [cands, setCands] = useState(null)
  const [sel, setSel] = useState({})
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(null)
  const wasOpen = useRef(false)
  const fileRef = useRef(null)

  // real file pick: Electron exposes .path (ingest the file itself); anywhere
  // else small text-ish files are read and sent as pasted text
  const onFile = async (e) => {
    const f = e.target.files && e.target.files[0]
    e.target.value = ''
    if (!f || !notebook || busy) return
    setBusy(true); setErr('')
    try {
      let body
      if (f.path) {
        body = { notebook: notebook.id, path: f.path, title: f.name }
      } else if (f.size <= 1500000) {
        body = { notebook: notebook.id, text: await f.text(), title: f.name }
      } else {
        setErr('That file is too large to read here — switch to File path and give its location.')
        return
      }
      const out = await api('/source', { method: 'POST', body, timeoutMs: 120000 })
      await onDone(out.source && out.source.title ? `added ${out.source.title}` : 'file added')
    } catch (err2) {
      setErr(err2.message || String(err2))
    } finally {
      setBusy(false)
    }
  }

  // fresh state on every open; the find box starts from the caller's seed (a
  // source gap, a describe prompt) or the notebook's own topic
  useEffect(() => {
    if (open && !wasOpen.current) {
      setMode(noteOnly ? 'note' : (initialMode || 'find')); setValue(''); setTitle(''); setErr('')
      setCands(null); setSel({}); setAdded(null)
      setBusy(false); setAdding(false)
      const seed = (seedQuery || '').trim()
      if (seed) { setValue(seed); return }
      if (notebook && !noteOnly) {
        const t = `${notebook.title || ''}${notebook.description ? ` — ${notebook.description}` : ''}`.trim()
        if (t) setValue(t)
      }
    }
    wasOpen.current = open
  }, [open, notebook, initialMode, seedQuery, noteOnly])

  const pickMode = (m) => {
    setMode(m)
    if (m !== 'find') { setCands(null); setAdded(null); setErr('') }
  }

  const find = async () => {
    const q = value.trim()
    if (!q || busy || !notebook) return
    setBusy(true); setErr(''); setAdded(null)
    try {
      const out = await api('/discover', {
        method: 'POST',
        body: { notebook: notebook.id, query: q, max_results: 8 },
        timeoutMs: 90000
      })
      const list = out.candidates || []
      setCands(list)
      const all = {}
      for (const c of list) all[c.url] = true
      setSel(all)
      if (!list.length) setErr('The search came back empty — try a broader description.')
    } catch (e) {
      setCands(null)
      setErr(e.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  const addPicked = async () => {
    const urls = (cands || []).filter((c) => sel[c.url]).map((c) => c.url)
    if (!urls.length || adding || !notebook) return
    setAdding(true); setErr('')
    try {
      const out = await api('/sources', {
        method: 'POST', body: { notebook: notebook.id, urls }, timeoutMs: 300000
      })
      setAdded(out)
    } catch (e) {
      setErr(e.message || String(e))
    } finally {
      setAdding(false)
    }
  }

  const submit = async () => {
    if (!value.trim() || busy || !notebook) return
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

  const pickedCount = (cands || []).filter((c) => sel[c.url]).length
  const finish = () => onDone(added && added.added
    ? `added ${added.added} source${added.added === 1 ? '' : 's'}${added.duplicates ? ` · ${added.duplicates} already here` : ''}`
    : null)

  const findBody = () => {
    if (added) {
      const failed = (added.results || []).filter((r) => !r.ok)
      return el('div', { style: { display: 'grid', gap: '12px' } },
        el('div', { style: { display: 'flex', alignItems: 'center', gap: '11px' } },
          el('span', { className: 'nb-avatar', 'aria-hidden': 'true',
            style: { background: 'color-mix(in srgb, var(--ui-success, #3fb950) 16%, transparent)', color: 'var(--ui-success, #3fb950)' },
            children: jsx(Glyph, { name: 'check', size: 16 }) }),
          el('div', null,
            el('div', { style: { fontWeight: 650, fontSize: '15px' },
              children: `${added.added} source${added.added === 1 ? '' : 's'} added` }),
            el('div', { className: 'nb-hint', children: added.duplicates
              ? `${added.duplicates} candidate${added.duplicates === 1 ? '' : 's'} turned out to be already here — nothing was duplicated.`
              : 'They are extracted, labelled and indexed — ask or generate away.' }))),
        failed.length
          ? el('div', { style: { display: 'grid', gap: '6px' } },
              el('div', { className: 'nb-meta', children: 'Did not make it' }),
              failed.map((r) => el('div', {
                key: r.url, className: 'nb-hint',
                style: { color: 'var(--ui-danger, #f85149)' },
                children: `${hostOf(r.url) || r.url} — ${r.error || 'failed'}`
              })))
          : null,
        el('div', { style: { display: 'flex', justifyContent: 'flex-end', marginTop: '6px' } },
          jsx(Btn, { variant: 'primary', icon: 'check', onClick: finish, children: 'Done' }))
      )
    }
    if (cands) {
      return el('div', { style: { display: 'grid', gap: '10px' } },
        el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
          el('span', { className: 'nb-meta', children: `Candidates · ${pickedCount} of ${cands.length} picked` }),
          el('span', { style: { flex: 1 } }),
          jsx(Btn, { size: 'sm', icon: 'refresh', onClick: () => { setCands(null); setErr('') },
            children: 'Refine search' })),
        el('div', { className: 'nb-cand-list', role: 'group', 'aria-label': 'Candidate sources' },
          cands.map((c) => {
            const on = !!sel[c.url]
            const host = hostOf(c.url)
            return el('button', {
              type: 'button', className: 'nb-cand', 'data-on': on ? 'true' : 'false',
              role: 'checkbox', 'aria-checked': on,
              'aria-label': `${on ? 'Remove' : 'Add'} source: ${c.title || c.url}`,
              onClick: () => setSel((s) => ({ ...s, [c.url]: !s[c.url] })),
              children: [
                el('span', { className: 'nb-cand-check', 'aria-hidden': 'true' },
                  on ? jsx(Glyph, { name: 'check', size: 12 }) : null),
                el('span', { style: { minWidth: 0, flex: 1 } },
                  el('span', { className: 'nb-cand-title', children: c.title || c.url }),
                  el('span', { className: 'nb-cand-sub' },
                    host ? el('span', { className: 'nb-chip', children: host }) : null,
                    el('span', { children: (c.snippet || '').slice(0, 200) })))
              ]
            }, c.url)
          })),
        el('div', { style: { display: 'flex', gap: '8px', justifyContent: 'flex-end' } },
          jsx(Btn, { onClick: onClose, children: 'Cancel' }),
          jsx(Btn, {
            variant: 'primary', icon: 'plus', onClick: addPicked,
            disabled: adding || !pickedCount,
            children: adding ? 'Adding…' : `Add ${pickedCount} source${pickedCount === 1 ? '' : 's'}`
          }))
      )
    }
    return el('div', { style: { display: 'grid', gap: '10px' } },
      el('div', { className: 'nb-field', style: { height: '42px' } },
        jsx(Glyph, { name: 'sparkle', size: 15 }),
        el('input', {
          value, onChange: (e) => setValue(e.target.value), autoFocus: true,
          onKeyDown: (e) => { if (e.key === 'Enter') find() },
          placeholder: 'Describe what this notebook should know…',
          'aria-label': 'Describe the sources to find'
        })),
      el('div', { className: 'nb-hint', style: { padding: '0 2px' },
        children: 'Hermes searches the web and offers candidate sources — nothing joins the notebook until you pick it. Already-covered urls are skipped automatically.' }),
      err ? el('div', { style: { color: T.danger, fontSize: '14px' }, children: err }) : null,
      el('div', { style: { display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' } },
        jsx(Btn, { onClick: onClose, children: 'Cancel' }),
        jsx(Btn, {
          variant: 'primary', icon: 'search', onClick: find,
          disabled: busy || !value.trim() || !notebook,
          children: busy ? 'Searching…' : 'Find sources'
        }))
    )
  }

  const submitNote = async () => {
    if (!value.trim() || busy || !notebook) return
    setBusy(true); setErr('')
    try {
      const body = { notebook: notebook.id, text: value.trim() }
      if (title.trim()) body.title = title.trim()
      await api('/note', { method: 'POST', body, timeoutMs: 60000 })
      setValue(''); setTitle('')
      await onDone('note saved — it is searchable now')
    } catch (e) {
      setErr(e.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  const noteBody = () => el('div', null,
    el('p', { style: { margin: '0 0 14px', color: T.text3, fontSize: '14.5px', lineHeight: 1.55 },
      children: 'A note becomes a first-class source — searchable, citable, and included in every answer and artifact.' }),
    el('div', { style: { display: 'grid', gap: '10px' } },
      el('textarea', {
        value, onChange: (e) => setValue(e.target.value), autoFocus: true,
        placeholder: 'Jot down the key points, a quote, a decision…',
        'aria-label': 'Note text',
        style: {
          minHeight: '150px', borderRadius: '12px', border: `1px solid ${T.line}`,
          background: T.cardDeep, color: T.text, padding: '12px', fontSize: '14.5px',
          lineHeight: 1.55, resize: 'vertical', outline: 'none'
        }
      }),
      el('div', { className: 'nb-field', style: { height: '40px' } },
        jsx(Glyph, { name: 'note', size: 14 }),
        el('input', {
          value: title, onChange: (e) => setTitle(e.target.value),
          placeholder: 'Title (optional)',
          'aria-label': 'Note title'
        }))),
    err ? el('div', { style: { marginTop: '12px', color: T.danger, fontSize: '14px' }, children: err }) : null,
    el('div', { style: { display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' } },
      jsx(Btn, { onClick: onClose, children: 'Cancel' }),
      jsx(Btn, {
        variant: 'primary', icon: 'check', onClick: submitNote,
        disabled: busy || !value.trim() || !notebook,
        children: busy ? 'Saving…' : 'Save note'
      }))
  )

  return jsx(Dialog, {
    open, onClose, title: noteOnly ? 'Add a note' : 'Add a source',
    width: mode === 'find' && !noteOnly ? 620 : 520,
    children: noteOnly
      ? noteBody()
      : el('div', null,
      el('p', { style: { margin: '0 0 14px', color: T.text3, fontSize: '14.5px', lineHeight: 1.55 },
        children: mode === 'find'
          ? 'Describe what this notebook should know — Hermes searches the web and offers candidates. Nothing joins until you pick it.'
          : 'A source is anything the notebook can cite: a URL, a file on this machine, or text you paste. It is extracted, labelled and indexed on the way in.' }),
      jsx(Seg, { label: 'Source kind', value: mode, onChange: pickMode, options: SOURCE_MODES }),
      el('div', { style: { marginTop: '14px' } },
        mode === 'find'
          ? findBody()
          : el('div', null,
              el('div', { style: { display: 'grid', gap: '10px' } },
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
              el('div', { style: { display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px', alignItems: 'center' } },
                el('input', {
                  ref: fileRef, type: 'file', hidden: true,
                  onChange: onFile,
                  accept: '.pdf,.docx,.pptx,.xlsx,.epub,.ipynb,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.webp,.mp3,.wav,.m4a'
                }),
                jsx(Btn, {
                  icon: 'folder', disabled: busy || !notebook,
                  onClick: () => fileRef.current && fileRef.current.click(),
                  children: 'Upload file'
                }),
                el('span', { style: { flex: 1 } }),
                jsx(Btn, { onClick: onClose, children: 'Cancel' }),
                jsx(Btn, {
                  variant: 'primary', icon: 'plus', onClick: submit,
                  disabled: busy || !value.trim() || !notebook,
                  children: busy ? 'Ingesting…' : 'Add source'
                })))
      )
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
