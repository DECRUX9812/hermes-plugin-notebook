/* ------------------------------------------------------------------ shell */

function App() {
  const [mode, setMode] = useState(() => persist.get('mode', 'studio'))
  const [nb, setNb] = useState(() => persist.get('notebook', ''))
  const studio = useStudio(nb)
  const [picked, setPicked] = useState(null)       // artifact run selected in the viewer
  const [tab, setTab] = useState('chat')
  const [busy, setBusy] = useState({})             // kind -> startedAt (ms)
  const [toast, setToast] = useState('')
  const [askOpen, setAskOpen] = useState(0)        // bump to focus the composer
  const [addSource, setAddSource] = useState(false)
  const [newNb, setNewNb] = useState(false)
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')
  const [note, setNote] = useState('')
  const [opsStats, setOpsStats] = useState(null)

  const say = useCallback((msg) => {
    setNote(msg)
    const t = setTimeout(() => setNote(''), 6000)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => { persist.set('mode', mode) }, [mode])
  useEffect(() => { persist.set('notebook', nb) }, [nb])

  const data = studio.data
  const notebook = data && data.notebook
  const kinds = (data && data.kinds) || []

  // the first notebook in the list is the default when nothing is stored, and a
  // stored id the backend no longer has must not stay marked as current — the
  // rail would show one notebook selected and another notebook's sources.
  useEffect(() => {
    if (!data || !data.notebooks || !data.notebooks.length) return
    const ids = data.notebooks.map((n) => n.id)
    if (!nb || !ids.includes(nb)) setNb(data.notebook ? data.notebook.id : ids[0])
  }, [data, nb])

  // A studio card can be opened by name from outside the page (palette command,
  // or `?open=mind_map` in the preview harness) — consumed once.
  useEffect(() => {
    if (!notebook) return
    const want = persist.get('__open', '')
    if (!want) return
    const hit = (notebook.artifacts || []).find((a) => a.kind === want)
    if (hit) { setPicked(hit); setTab('view') }
    persist.set('__open', '')
  }, [notebook])

  const generate = useCallback(async (kind) => {
    if (!notebook) return
    setBusy((b) => ({ ...b, [kind]: Date.now() }))
    try {
      await api('/generate', {
        method: 'POST',
        body: { notebook: notebook.id, kind, length: 'short' },
        timeoutMs: 240000
      })
      await studio.reload(true)
      const fresh = await studio.reload(true)
      const target = fresh && fresh.notebook && fresh.notebook.artifacts
        ? fresh.notebook.artifacts.find((a) => a.kind === kind) : null
      if (target) { setPicked(target); setTab('view') }
      say(`${kind.replace(/_/g, ' ')} ready`)
    } catch (e) {
      say(`${kind.replace(/_/g, ' ')} failed: ${e.message || e}`)
    } finally {
      setBusy((b) => { const n = { ...b }; delete n[kind]; return n })
    }
  }, [notebook, studio, say])

  const ops = mode === 'ops'

  return el('div', { className: 'nb-root', 'data-mode': mode, 'data-plugin': ID },
    el('style', { dangerouslySetInnerHTML: { __html: CSS } }),
    el('header', { className: 'nb-bar' },
      el('div', { className: 'nb-brand' },
        el('span', { className: 'nb-mark' }, jsx(Glyph, { name: 'notebook', size: 15 })),
        el('span', { className: 'nb-brandname', children: 'Notebook' }),
        el('span', { className: 'nb-crumb' },
          ops
            ? el('b', { children: 'Lab Ops' })
            : el('span', null, '/ ', el('b', { children: notebook ? notebook.title : 'no notebook' })))
      ),
      el('div', { className: 'nb-spacer' }),
      jsx(Seg, {
        label: 'Surface', value: mode, onChange: (v) => setMode(v),
        options: [
          { id: 'studio', label: 'Studio', icon: 'notebook' },
          { id: 'ops', label: 'Lab Ops', icon: 'server' }
        ]
      }),
      el('div', { className: 'nb-actions' },
        ops ? null : jsx(Btn, {
          icon: 'plus', variant: 'primary', onClick: () => setAddSource(true),
          disabled: !notebook, children: 'Add source'
        }))
    ),

    ops
      ? jsx(OpsDeck, { onSay: say, onStats: setOpsStats })
      : el('div', { className: 'nb-body' },
          jsx(Rail, {
            data, nb, setNb, q, setQ, filter, setFilter,
            onNewNotebook: () => setNewNb(true), onAddSource: () => setAddSource(true),
            loading: studio.loading, error: studio.error, reload: studio.reload
          }),
          jsx(Main, {
            notebook, kinds, tab, setTab, picked, setPicked, busy, generate,
            onAsk: () => setAskOpen((n) => n + 1), askOpen, onSay: say,
            reload: studio.reload, modelReady: data && data.model_ready,
            error: studio.error, loading: studio.loading, onAddSource: () => setAddSource(true)
          }),
          jsx(StudioPanel, {
            kinds, notebook, busy, generate, filter, setFilter, picked, setPicked,
            onOpen: (art) => { setPicked(art); setTab('view') }
          })
        ),

    jsx(StatusBar, { mode, notebook, data, note, opsStats }),

    jsx(AddSourceDialog, {
      open: addSource, onClose: () => setAddSource(false), notebook,
      onDone: async (msg) => { setAddSource(false); await studio.reload(true); if (msg) say(msg) }
    }),
    jsx(NewNotebookDialog, {
      open: newNb, onClose: () => setNewNb(false),
      onDone: async (id) => { setNewNb(false); if (id) { setNb(id); setPicked(null) } }
    })
  )
}

/* -------------------------------------------------------------------- rail */

function Rail({ data, nb, setNb, q, setQ, filter, setFilter, onNewNotebook, onAddSource, loading, error, reload }) {
  const notebooks = (data && data.notebooks) || []
  const notebook = data && data.notebook
  const sources = (notebook && notebook.sources) || []
  const labels = (notebook && notebook.labels) || []

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return sources.filter((s) => {
      if (filter !== 'all' && !(s.labels || []).some((l) => l.toLowerCase().includes(filter))) return false
      if (!needle) return true
      return (s.title + ' ' + (s.origin || '') + ' ' + (s.labels || []).join(' '))
        .toLowerCase().includes(needle)
    })
  }, [sources, q, filter])

  return el('aside', { className: 'nb-col nb-rail', 'aria-label': 'Notebooks and sources' },
    el('div', { className: 'nb-pane-head' },
      el('span', { className: 'nb-meta', children: `Notebooks · ${notebooks.length}` }),
      jsx(IconBtn, { icon: 'plus', label: 'New notebook', onClick: onNewNotebook })
    ),
    el('div', { className: 'nb-scroll', style: { flex: '0 1 auto', maxHeight: '38%' } },
      el('div', { className: 'nb-pad', style: { paddingTop: '8px' } },
        loading && !notebooks.length
          ? el('div', { className: 'nb-hint', style: { padding: '8px' }, children: 'reading notebooks…' })
          : notebooks.length === 0
            ? el('div', { className: 'nb-hint', style: { padding: '8px', lineHeight: 1.5 } },
                'No notebooks yet. Create one, then add sources — every answer and artifact is derived from them.')
            : notebooks.map((item, i) =>
                el('button', {
                  type: 'button', className: 'nb-nbrow', 'aria-current': item.id === nb ? 'true' : 'false',
                  onClick: () => setNb(item.id), title: item.description || item.title,
                  children: [
                    el('span', { className: 'nb-avatar', children: roman(i + 1) }),
                    el('span', { style: { minWidth: 0, flex: 1 } },
                      el('span', { className: 'nb-nbtitle', children: item.title }),
                      el('span', { className: 'nb-nbsub' },
                        `${item.sources} source${item.sources === 1 ? '' : 's'} · ${item.artifacts} artifact${item.artifacts === 1 ? '' : 's'}`))
                  ]
                }, item.id))
      )
    ),

    el('div', { className: 'nb-pane-head', style: { borderTop: `1px solid ${T.lineSoft}` } },
      el('span', { className: 'nb-meta', children: `Sources · ${sources.length}` }),
      jsx(IconBtn, { icon: 'refresh', label: 'Refresh sources', onClick: () => reload(true) })
    ),
    el('div', { className: 'nb-pad', style: { paddingBottom: '6px' } },
      jsx(SearchField, { value: q, onChange: setQ, placeholder: 'Search sources', label: 'Search sources' })
    ),
    el('div', {
      className: 'nb-pad',
      style: { display: 'flex', gap: '6px', flexWrap: 'wrap', paddingTop: 0, paddingBottom: '10px' },
      role: 'group', 'aria-label': 'Filter sources by label'
    },
    labels.slice(0, 6).map((l) =>
      jsx(Chip, {
        key: l.label, tone: filter === l.label.toLowerCase() ? 'accent' : undefined,
        pressed: filter === l.label.toLowerCase(),
        onClick: () => setFilter(filter === l.label.toLowerCase() ? 'all' : l.label.toLowerCase()),
        title: `${l.count} source${l.count === 1 ? '' : 's'} labelled ${l.label}`,
        children: `${l.label} ${l.count}`
      }))
    ),

    el('div', { className: 'nb-scroll', 'aria-label': 'Source list' },
      el('div', { className: 'nb-pad', style: { paddingTop: 0, display: 'flex', flexDirection: 'column', gap: '2px' } },
        error
          ? el('div', { className: 'nb-hint', style: { padding: '10px', color: T.danger }, children: error })
          : shown.length === 0
            ? el('div', { className: 'nb-void', style: { height: 'auto', padding: '24px 8px' } },
                el('div', null,
                  el('h3', { style: { fontSize: '15px' }, children: sources.length ? 'Nothing matches' : 'No sources yet' }),
                  el('p', { style: { fontSize: '13.5px' }, children: sources.length
                    ? 'Clear the filter or the search to see every source.'
                    : 'Add a file, a URL or pasted text and it becomes citable.' })))
            : shown.map((s) =>
                el('button', {
                  type: 'button', className: 'nb-src', 'data-on': pickedCite === s.n ? 'true' : 'false',
                  onClick: () => setPickedCite(s.n),
                  title: s.summary || s.origin || s.title,
                  children: [
                    el('span', { className: 'nb-cite', children: `S${s.n}` }),
                    el('span', { style: { minWidth: 0, flex: 1 } },
                      el('span', { className: 'nb-src-title', children: s.title }),
                      el('span', { className: 'nb-src-meta' },
                        el('span', { className: 'nb-chip', children: `${s.kind} · ${nfmt(s.chars)} chars` }),
                        (s.labels || []).slice(0, 2).map((l) => el('span', { className: 'nb-chip', children: l }, l))
                      ))
                  ]
                }, s.id))
      )
    ),
    el('div', { style: { borderTop: `1px solid ${T.lineSoft}`, padding: '10px' } },
      jsx(Btn, { icon: 'plus', variant: 'ghost', onClick: onAddSource, disabled: !notebook, children: 'Add source' })
    )
  )
}

/* An index, not an avatar row: I, II, III … (atelier-zero's Roman-numeral walk). */
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']
const roman = (n) => ROMAN[n - 1] || String(n)

// citation focus is shared state: a [S3] click in the answer highlights S3 here
let pickedCite = 0
const setPickedCite = (n) => { pickedCite = n }
