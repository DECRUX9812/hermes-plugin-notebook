/* ------------------------------------------------------------------ shell */

/* Artifact generation used to be one `busy` object mutated in four places. Now a
 * lane per kind: starting a run while it is already running is refused (it used to
 * fire a second request), and the map the UI reads is derived, not stored. */
const JOBS = Machine('jobs', {
  initial: 'idle',
  context: { lanes: {} },
  states: {
    idle: {
      on: { RUN: { target: 'active', action: (c, p) => { c.lanes[p.kind] = p.at || Date.now() } } }
    },
    active: {
      tags: ['busy'],
      on: {
        RUN: { target: 'active',
               guard: (c, p) => !c.lanes[p.kind],
               action: (c, p) => { c.lanes[p.kind] = p.at || Date.now() } },
        FINISH: { target: 'active', action: (c, p) => {
          delete c.lanes[p.kind]
          if (!Object.keys(c.lanes).length) return undefined
        } },
        SETTLE: { target: 'idle', guard: (c) => !Object.keys(c.lanes).length }
      }
    }
  }
})

/* Modal surfaces used to be four independent booleans, so a search could open on
 * top of the settings dialog and Escape closed whichever effect ran last. One
 * machine owns "at most one modal", and the booleans are derived from it. */
const DIALOGS = Machine('dialogs', {
  initial: 'closed',
  context: { payload: null },
  states: {
    closed: {
      on: { OPEN: { target: 'open', guard: (c, p) => !!(p && p.surface),
                    action: (c, p) => ({ payload: { surface: p.surface, data: p.data || null } }) } }
    },
    open: {
      on: {
        // Search is a passive global shortcut (Ctrl+K). Opening it over a
        // half-typed add-source draft would silently discard the draft, so it is
        // only allowed when nothing is open — the same rule the view reducer's
        // author arrived at independently.
        OPEN: { target: 'open',
                guard: (c, p) => !!(p && p.surface) &&
                  (p.surface !== 'search' || !c.payload || c.payload.surface === 'search'),
                action: (c, p) => ({ payload: { surface: p.surface, data: p.data || null } }) },
        // a stale close must not dismiss the surface somebody just opened
        CLOSE: { target: 'closed', guard: (c, p) => !p || !p.surface || (c.payload && c.payload.surface === p.surface),
                 action: () => ({ payload: null }) }
      }
    }
  }
})

function App() {
  const [mode, setMode] = useState(() => persist.get('mode', 'home'))
  const [nb, setNb] = useState(() => persist.get('notebook', ''))
  // Which conversation is open, remembered per notebook so a reload lands people
  // back in the thread they were reading.
  const [threadName, setThreadName] = useState(() => persist.get('thread', ''))
  const studio = useStudio(nb, threadName)
  useEffect(() => {
    if (!nb) return
    const saved = persist.get(`thread.${nb}`, '')
    setThreadName(saved || '')
  }, [nb])
  // M1 — the center view (tab × artifact × peeked source) is a pure transition
  // table (src/25-machine.js). An illegal combination cannot be represented, and
  // clearing a selection under its own tab self-heals to chat instead of stranding
  // an empty pane behind a tab that claims content.
  const [view, viewSend] = useReducer(VIEW_FSM.step, VIEW_FSM.initial)
  const { tab, artifact: picked, source: peek } = view
  // setter-shaped adapters: every downstream prop keeps its old name and shape
  const setTab = useCallback((t) => viewSend({
    type: t === 'view' ? 'TAB_VIEW' : t === 'peek' ? 'TAB_PEEK' : 'TAB_CHAT'
  }), [])
  const setPicked = useCallback((a) => viewSend({ type: 'STEP_ARTIFACT', artifact: a }), [])
  const setPeek = useCallback((src) => viewSend({ type: 'STEP_SOURCE', source: src }), [])
  const jobs = useMachine(JOBS)
  const busy = jobs.ctx.lanes                      // kind -> startedAt (ms)
  const [note, setNote] = useState('')
  const [askOpen, setAskOpen] = useState(0)        // bump to focus the composer
  const dialogs = useMachine(DIALOGS)
  const surface = dialogs.matches('open') && dialogs.ctx.payload ? dialogs.ctx.payload.surface : ''
  const openSurface = useCallback((name, data) => DIALOGS.send('OPEN', { surface: name, data }), [])
  const closeSurface = useCallback((name) => DIALOGS.send('CLOSE', { surface: name }), [])
  const setSrcDialog = useCallback((v) => (v ? openSurface('addSource', v) : closeSurface('addSource')), [openSurface, closeSurface])
  const setNewNb = useCallback((v) => (v ? openSurface('newNotebook') : closeSurface('newNotebook')), [openSurface, closeSurface])
  const setRenNb = useCallback((v) => (v ? openSurface('settings', v) : closeSurface('settings')), [openSurface, closeSurface])
  const srcDialog = surface === 'addSource' ? (dialogs.ctx.payload.data || {}) : null
  const newNb = surface === 'newNotebook'
  const renNb = surface === 'settings' ? (dialogs.ctx.payload.data || null) : null
  const [filter, setFilter] = useState('all')
  const [railOpen, setRailOpen] = useState(() => persist.get('rail', '1') !== '0')
  const [studioOpen, setStudioOpen] = useState(() => persist.get('studio', '1') !== '0')
  const [opsStats, setOpsStats] = useState(null)
  const setSearchOpen = useCallback((v) => (v ? openSurface('search') : closeSurface('search')), [openSurface, closeSurface])
  const searchOpen = surface === 'search' 

  // palette/deep links can ask for a surface: ?surface=ops opens the lab deck
  useEffect(() => {
    try {
      const want = new URLSearchParams(window.location.search).get('surface')
      if (want === 'ops' || want === 'studio' || want === 'home') setMode(want)
    } catch { /* no location in this host */ }
  }, [])

  const say = useCallback((msg) => {
    setNote(msg)
    const t = setTimeout(() => setNote(''), 6000)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => { persist.set('mode', mode) }, [mode])
  useEffect(() => { persist.set('notebook', nb) }, [nb])
  useEffect(() => { persist.set('rail', railOpen ? '1' : '0') }, [railOpen])
  useEffect(() => { persist.set('studio', studioOpen ? '1' : '0') }, [studioOpen])

  const data = studio.data
  const notebook = data && data.notebook
  const kinds = (data && data.kinds) || []

  // Ctrl/Cmd+K → notebook search (NotebookLM's global find)
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && String(e.key).toLowerCase() === 'k') {
        if (mode === 'studio' && notebook) { e.preventDefault(); setSearchOpen(true) }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mode, notebook])

  // the first notebook in the list is the default when nothing is stored
  useEffect(() => {
    if (!nb && data && data.notebooks && data.notebooks.length) setNb(data.notebooks[0].id)
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

  const generate = useCallback(async (kind, opts) => {
    if (!notebook) return
    if (!JOBS.can('RUN')) { say(`${kind.replace(/_/g, ' ')} is already running`); return }
    if (!JOBS.send('RUN', { kind })) { say(`${kind.replace(/_/g, ' ')} is already running`); return }
    try {
      await api('/generate', {
        method: 'POST',
        body: { notebook: notebook.id, kind, length: 'short', ...(opts || {}) },
        timeoutMs: 240000
      })
      const fresh = await studio.reload(true)
      const target = fresh && fresh.notebook && fresh.notebook.artifacts
        ? fresh.notebook.artifacts.find((a) => a.kind === kind) : null
      if (target) { setPicked(target); setTab('view') }
      say(`${kind.replace(/_/g, ' ')} ready`)
    } catch (e) {
      say(`${kind.replace(/_/g, ' ')} failed: ${e.message || e}`)
    } finally {
      JOBS.send('FINISH', { kind })
      JOBS.send('SETTLE')
    }
  }, [notebook, studio, say])

  // NotebookLM-style tagging: one click re-runs the model's auto-label pass
  // over anything that arrived without labels (the /label route).
  const labelSources = useCallback(async () => {
    if (!nb) return
    try {
      await api('/label', { method: 'POST', body: { notebook: nb }, timeoutMs: 180000 })
      await studio.reload(true)
      say('sources labelled')
    } catch (e) {
      say(`labelling failed: ${e.message || e}`)
    }
  }, [nb, studio, say])

  const openSource = useCallback((s) => { setPeek(s); setTab('peek') }, [])
  const openAddSource = useCallback((opts) => setSrcDialog(opts || { mode: 'find' }), [])

  // drag files onto the sources rail → same ingest path as the upload picker
  const dropSources = useCallback(async (files) => {
    if (!nb || !files || !files.length) return
    let added = 0, skipped = 0
    for (const f of files) {
      try {
        let body = null
        if (f.path) body = { notebook: nb, path: f.path, title: f.name }
        else if (f.size && f.size <= 1500000) body = { notebook: nb, text: await f.text(), title: f.name }
        if (!body) { skipped += 1; continue }
        await api('/source', { method: 'POST', body, timeoutMs: 120000 })
        added += 1
      } catch { skipped += 1 }
    }
    if (added) await studio.reload(true)
    if (added && !skipped) say(`added ${added} source${added === 1 ? '' : 's'} from dropped files`)
    else if (added) say(`added ${added} source${added === 1 ? '' : 's'} — ${skipped} file${skipped === 1 ? '' : 's'} skipped (too large or unreadable)`)
    else say('dropped files could not be read — use Add source for paths or large files')
  }, [nb, studio, say])

  // NotebookLM's per-source checkbox: the /source_state reply carries the fresh
  // notebook payload — merge it over the current state instead of a full reload.
  const toggleSource = useCallback(async (s) => {
    if (!nb || !s || !s.id) return
    try {
      const out = await api('/source_state', {
        method: 'POST',
        body: { notebook: nb, source_id: s.id, enabled: s.active === false },
        timeoutMs: 30000
      })
      if (out && out.state && studio.data) {
        studio.setData({ ...studio.data, notebook: out.state })
      } else {
        await studio.reload(true)
      }
    } catch (e) { say(`could not update source: ${e.message || e}`) }
  }, [nb, studio, say])

  // one /source_state call for a whole set — folder checkboxes and select-all
  // share it (the reply carries the fresh notebook payload like toggleSource)
  const applySourceStates = useCallback(async (list, enabled) => {
    if (!nb || !list || !list.length) return
    try {
      const out = await api('/source_state', {
        method: 'POST',
        body: { notebook: nb, source_ids: list.map((s) => s.id), enabled },
        timeoutMs: 30000
      })
      if (out && out.state && studio.data) {
        studio.setData({ ...studio.data, notebook: out.state })
      } else {
        await studio.reload(true)
      }
    } catch (e) { say(`could not update sources: ${e.message || e}`) }
  }, [nb, studio, say])

  const toggleAllSources = useCallback(async () => {
    const sources = (notebook && notebook.sources) || []
    if (!sources.length) return
    const allOn = sources.every((s) => s.active !== false)
    await applySourceStates(sources, !allOn)
  }, [notebook, applySourceStates])

  // folder checkbox: all-on turns the folder off; anything else turns it on
  const toggleGroupSources = useCallback(async (list) => {
    if (!list || !list.length) return
    const allOn = list.every((s) => s.active !== false)
    await applySourceStates(list, !allOn)
  }, [applySourceStates])

  // removing a source/artifact returns the fresh notebook payload — merge it
  // like toggleSource does, and close any viewer pointed at the deleted thing.
  const deleteSource = useCallback(async (s) => {
    if (!nb || !s || !s.id) return
    try {
      const out = await api('/source/delete', {
        method: 'POST',
        body: { notebook: nb, source_id: s.id }, timeoutMs: 30000
      })
      if (out && out.state && studio.data) {
        studio.setData({ ...studio.data, notebook: out.state })
      } else {
        await studio.reload(true)
      }
      if (peek && peek.id === s.id) setPeek(null)
      say(`removed “${s.title || s.id}”`)
    } catch (e) { say(`could not remove source: ${e.message || e}`) }
  }, [nb, studio, say, peek])

  const deleteArtifact = useCallback(async (a) => {
    if (!nb || !a || !a.key) return
    try {
      const out = await api('/artifact/delete', {
        method: 'POST',
        body: { notebook: nb, key: a.key }, timeoutMs: 30000
      })
      if (out && out.state && studio.data) {
        studio.setData({ ...studio.data, notebook: out.state })
      } else {
        await studio.reload(true)
      }
      if (picked && picked.key === a.key) setPicked(null)
      say('artifact deleted')
    } catch (e) { say(`could not delete artifact: ${e.message || e}`) }
  }, [nb, studio, say, picked])

  // viewer-side edits (rename) change the run row — re-resolve `picked` from
  // fresh state so the open artifact doesn't keep showing stale metadata
  const refreshArtifact = useCallback(async () => {
    const fresh = await studio.reload(true)
    const arts = fresh && fresh.notebook && fresh.notebook.artifacts
    if (!arts) return
    if (picked) {
      const hit = arts.find((a) => a.key === picked.key)
      setPicked(hit || null)
    }
  }, [studio, picked])

  const refreshSource = useCallback(async (s) => {
    if (!nb || !s || !s.id) return
    try {
      const out = await api('/source/refresh', {
        method: 'POST',
        body: { notebook: nb, source_id: s.id }, timeoutMs: 180000
      })
      if (out && out.state && studio.data) {
        studio.setData({ ...studio.data, notebook: out.state })
      } else {
        await studio.reload(true)
      }
      if (out && out.source && peek && peek.id === s.id) {
        setPeek({ ...peek, ...out.source })
      }
      say(`“${s.title || s.id}” refreshed`)
    } catch (e) { say(`refresh failed: ${e.message || e}`) }
  }, [nb, studio, say, peek])

  // ---------------------------------------------------------------- threads
  const openThread = useCallback((name) => {
    setThreadName(name)
    if (nb) persist.set(`thread.${nb}`, name)
  }, [nb])

  const newThread = useCallback(async (title) => {
    if (!nb) return
    try {
      const out = await api('/thread/new', {
        method: 'POST',
        body: { notebook: nb, title: title || '' },
        timeoutMs: 30000
      })
      const name = out && out.thread ? out.thread.name : ''
      if (name) openThread(name)
      await studio.reload(true)
      say('new conversation started')
    } catch (e) { say(`could not start a conversation: ${e.message || e}`) }
  }, [nb, openThread, studio, say])

  const renameThread = useCallback(async (name, title) => {
    if (!nb) return
    try {
      await api('/thread/rename', {
        method: 'POST', body: { notebook: nb, thread: name, title }, timeoutMs: 30000
      })
      await studio.reload(true)
    } catch (e) { say(`could not rename: ${e.message || e}`) }
  }, [nb, studio, say])

  const deleteThread = useCallback(async (name) => {
    if (!nb) return
    try {
      const out = await api('/thread/delete', {
        method: 'POST', body: { notebook: nb, thread: name, confirm: true }, timeoutMs: 30000
      })
      if (out && out.next) openThread(out.next)
      await studio.reload(true)
      say('conversation deleted')
    } catch (e) { say(`could not delete: ${e.message || e}`) }
  }, [nb, openThread, studio, say])

  const threads = {
    name: threadName || (notebook && notebook.thread_name) || 'default',
    title: (notebook && notebook.thread_title) || 'Conversation',
    list: (notebook && notebook.threads) || [],
    onOpen: openThread, onNew: newThread, onRename: renameThread, onDelete: deleteThread
  }

  const deleteNotebook = useCallback(async (id) => {
    try {
      await api('/notebook/delete', {
        method: 'POST', body: { notebook: id, confirm: true }, timeoutMs: 30000
      })
      if (nb === id) setNb('')
      await studio.reload(true)
      say('notebook deleted')
    } catch (e) { say(`delete failed: ${e.message || e}`) }
  }, [nb, studio, say])

  const exportNotebook = useCallback(async () => {
    if (!notebook) return
    try {
      const out = await api(`/export?${qs({ notebook: notebook.id, b64: 1 })}`, { timeoutMs: 120000 })
      const raw = atob(out.b64 || '')
      const bytes = new Uint8Array(raw.length)
      for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i)
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }))
      const a = document.createElement('a')
      a.href = url; a.download = out.name || 'notebook.zip'
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
      say('notebook exported')
    } catch (e) { say(`export failed: ${e.message || e}`) }
  }, [notebook, say])

  const renameNotebook = useCallback(async (id, title, desc, emoji) => {
    try {
      await api('/notebook/update', {
        method: 'POST',
        body: { notebook: id, title, description: desc, emoji },
        timeoutMs: 30000
      })
      await studio.reload(true)
      say('notebook updated')
    } catch (e) { say(`rename failed: ${e.message || e}`) }
  }, [studio, say])

  const duplicateNotebook = useCallback(async (id, openIt = true) => {
    try {
      const out = await api('/notebook/duplicate', {
        method: 'POST', body: { notebook: id }, timeoutMs: 120000
      })
      await studio.reload(true)
      say(`copied as “${(out.notebook && out.notebook.title) || 'new notebook'}”`)
      if (openIt && out.notebook && out.notebook.id) {
        setNb(out.notebook.id); setPicked(null); setPeek(null); setTab('chat'); setMode('studio')
      }
      return out.notebook
    } catch (e) { say(`copy failed: ${e.message || e}`); return null }
  }, [studio, say])

  const openNotebook = useCallback((id) => {
    // one event instead of the copy-pasted three-setter ritual
    setNb(id); viewSend({ type: 'RESET_VIEW' }); setMode('studio')
  }, [])

  const ops = mode === 'ops'
  const home = mode === 'home'
  const discoverMode = mode === 'discover'
  const studyMode = mode === 'study'

  return el('div', {
    className: 'nb-root', 'data-mode': mode, 'data-plugin': ID,
    // the room takes on the notebook's colour: its sigil hue becomes the ambient
    // field behind every panel, and home keeps a fixed violet
    style: { '--nb-hue': sigHue(notebook ? notebook.id : 'hermes-home') }
  },
    el('style', { dangerouslySetInnerHTML: { __html: CSS } }),
    el('div', { className: 'nb-aurora', 'aria-hidden': 'true' },
      el('i', { className: 'nb-blob' }),
      el('i', { className: 'nb-blob' }),
      el('i', { className: 'nb-blob' })),
    el('header', { className: 'nb-bar' },
      el('div', { className: 'nb-brand' },
        el('span', { className: 'nb-mark' }, jsx(Glyph, { name: 'notebook', size: 15 })),
        el('span', { className: 'nb-brandname', children: 'Notebook' }),
        el('span', { className: 'nb-crumb' },
          ops
            ? el('b', { children: 'Lab Ops' })
            : home
              ? el('b', { children: 'All notebooks' })
              : discoverMode
                ? el('b', { children: 'Discover' })
                : studyMode
                  ? el('b', { children: 'Study' })
                : el('span', null, jsx(Glyph, { name: 'chevron', size: 12 }), ' ', notebook
                    ? el('button', {
                        type: 'button', className: 'nb-crumbedit',
                        onClick: () => setRenNb(notebook),
                        title: 'Notebook settings — rename, describe, pick an icon',
                        children: notebook.title
                      })
                    : el('b', { children: 'no notebook' })))
      ),
      el('div', { className: 'nb-spacer' }),
      jsx(Seg, {
        label: 'Surface', value: mode, onChange: (v) => setMode(v),
        options: [
          { id: 'home', label: 'Home', icon: 'grid' },
          { id: 'discover', label: 'Discover', icon: 'search' },
          { id: 'study', label: 'Study', icon: 'cards' },
          { id: 'studio', label: 'Studio', icon: 'notebook' },
          { id: 'ops', label: 'Lab Ops', icon: 'server' }
        ]
      }),
      el('div', { className: 'nb-actions' },
        mode === 'studio' ? jsx(Btn, {
          icon: 'plus', variant: 'primary', onClick: () => openAddSource(),
          disabled: !notebook, children: 'Add source'
        }) : null,
        mode === 'studio' && notebook ? jsx(IconBtn, {
          icon: 'search', label: 'Search notebook (Ctrl+K)', onClick: () => setSearchOpen(true)
        }) : null,
        mode === 'studio' && notebook ? jsx(IconBtn, {
          icon: 'download', label: 'Export notebook (.zip)', onClick: exportNotebook
        }) : null)
    ),

    ops
      ? jsx(OpsDeck, { onSay: say, onStats: setOpsStats })
      : home
        ? jsx(HomeDashboard, {
            data, onOpen: openNotebook, onNew: () => setNewNb(true),
            onDelete: deleteNotebook, onRename: renameNotebook,
            onDuplicate: (id) => duplicateNotebook(id, false)
          })
        : discoverMode
          ? jsx(DiscoverPanel, {
              notebook, onSay: say,
              reload: () => studio.reload(true)
            })
          : studyMode
            ? jsx(StudyPanel, {
                notebook, onSay: say,
                onOpenSource: (title) => {
                  const s = ((notebook && notebook.sources) || []).find(
                    (x) => (x.title || '').trim().toLowerCase() === String(title).trim().toLowerCase())
                  if (s) { setPeek({ ...s, citeSnippet: '' }); setTab('peek') }
                }
              })
          : el('div', { className: 'nb-body' },
            railOpen
              ? jsx(Rail, {
                  data, notebook,
                  onAddSource: () => openAddSource(), onOpenSource: openSource,
                  onToggleSource: toggleSource, onToggleAll: toggleAllSources,
                  onToggleGroup: toggleGroupSources,
                  onDeleteSource: deleteSource,
                  onLabel: labelSources, onCollapse: () => setRailOpen(false),
                  onGoHome: () => setMode('home'), onSay: say, onDropFiles: dropSources,
                  loading: studio.loading, error: studio.error, reload: studio.reload
                })
              : jsx(PanelToggles, { side: 'left', onShow: () => setRailOpen(true) }),
            jsx(Main, {
              notebook, kinds, tab, setTab, picked, setPicked, busy, generate,
              onAsk: () => setAskOpen((n) => n + 1), askOpen, onSay: say,
              reload: studio.reload, modelReady: data && data.model_ready,
              error: studio.error, loading: studio.loading,
              peek, setPeek, onOpenSource: openSource, onRefreshSource: refreshSource,
              refreshArtifact,
              onAddSource: openAddSource, onNewNotebook: () => setNewNb(true),
              onFindSources: (seed) => openAddSource({ mode: 'find', seed: seed || '' }),
              threads
            }),
            studioOpen
              ? jsx(StudioPanel, {
                  kinds, notebook, busy, generate, filter, setFilter,
                  onOpen: (art) => { setPicked(art); setTab('view') },
                  onDelete: deleteArtifact,
                  onCollapse: () => setStudioOpen(false),
                  onAddNote: () => openAddSource({ mode: 'note' })
                })
              : jsx(PanelToggles, { side: 'right', onShow: () => setStudioOpen(true) })
          ),

    jsx(StatusBar, { mode, notebook, data, note, opsStats }),

    jsx(AddSourceDialog, {
      open: !!srcDialog, onClose: () => setSrcDialog(null), notebook,
      initialMode: srcDialog && srcDialog.mode,
      seedQuery: srcDialog && srcDialog.seed,
      noteOnly: !!(srcDialog && srcDialog.mode === 'note'),
      onDone: async (msg) => { setSrcDialog(null); await studio.reload(true); if (msg) say(msg) }
    }),
    jsx(SearchDialog, {
      open: searchOpen, onClose: () => setSearchOpen(false), notebook,
      onPick: (hit) => {
        const src = ((notebook && notebook.sources) || []).find((s) => s.id === hit.source_id)
        // carry the matched passage so the peek highlights it, like a citation
        if (src) { setPeek({ ...src, citeSnippet: hit.snippet || '' }); setTab('peek') }
        else say('that source is no longer in the notebook')
      }
    }),
    jsx(NewNotebookDialog, {
      open: newNb, onClose: () => setNewNb(false),
      onDone: async (id) => { setNewNb(false); if (id) { setNb(id); setPicked(null) } }
    }),
    renNb ? jsx(RenameDialog, {
      notebook: renNb, onClose: () => setRenNb(null),
      onDone: async (title, desc, emoji) => { setRenNb(null); await renameNotebook(renNb.id, title, desc, emoji) },
      onDuplicate: async () => { const id = renNb.id; setRenNb(null); await duplicateNotebook(id, true) }
    }) : null
  )
}

/* --------------------------------------------------------- home dashboard */

/* A notebook is a set of sources; the card has to say what is in it without
 * writing a sentence. Counts carry the shape (sources, outputs, chats), the
 * description carries the subject, and one action carries the intent. */
function CountChip({ icon, n, noun }) {
  return el('span', { className: 'nb-count', title: `${n} ${noun}${n === 1 ? '' : 's'}` },
    jsx(Glyph, { name: icon, size: 12 }),
    el('b', { children: String(n) }),
    el('span', { children: noun + (n === 1 ? '' : 's') }))
}

function NotebookDescription(n) {
  const desc = String(n.description || '').trim()
  if (!desc) {
    return el('span', { className: 'nb-nbcard-desc', 'data-empty': 'true',
      children: n.sources ? 'No description — open it to see what is on the desk.' : 'Empty notebook — add sources to begin.' })
  }
  return el('span', { className: 'nb-nbcard-desc', children: desc })
}

function HomeDashboard({ data, onOpen, onNew, onDelete, onRename, onDuplicate }) {
  const [query, setQuery] = useState('')
  const [del, setDel] = useState(null)
  const [ren, setRen] = useState(null)
  const notebooks = (data && data.notebooks) || []
  const needle = query.trim().toLowerCase()
  const shown = notebooks.filter((n) =>
    !needle || `${n.title} ${n.description || ''}`.toLowerCase().includes(needle))
  const featured = [...notebooks]
    .filter((n) => (n.sources || 0) > 0)
    .sort((a, b) => (b.sources || 0) - (a.sources || 0) || (b.artifacts || 0) - (a.artifacts || 0))
    .slice(0, 3)
  const hues = ['#81c995', '#a8c7fa', '#f28b82', '#c58af9', '#fde293']
  const totalSources = notebooks.reduce((s, n) => s + (n.sources || 0), 0)
  const totalArtifacts = notebooks.reduce((s, n) => s + (n.artifacts || 0), 0)
  const empty = notebooks.filter((n) => !n.sources).length

  return el('div', { className: 'nb-home' },
    el('div', { className: 'nb-home-scroll' },
      el('div', { className: 'nb-home-head' },
        el('div', null,
          el('h1', { className: 'nb-home-title', children: 'Notebooks' }),
          el('p', { className: 'nb-home-sub', children: [
            el('b', { children: String(notebooks.length) }), ' notebook' + (notebooks.length === 1 ? '' : 's'),
            ' · ', el('b', { children: String(totalSources) }), ' sources',
            ' · ', el('b', { children: String(totalArtifacts) }), ' outputs',
            empty ? ` · ${empty} still empty` : ''
          ] })),
        el('div', { className: 'nb-home-search' },
          jsx(SearchField, { value: query, onChange: setQuery,
            placeholder: 'Search notebooks', label: 'Search notebooks' }))
      ),

      featured.length
        ? el('div', { className: 'nb-feature-sec' },
            // the row is ordered by how much is in the notebook, and it says so:
            // a "featured" strip whose rule is hidden is just decoration
            el('div', { className: 'nb-home-sec' },
              el('span', { className: 'nb-meta', children: 'Most in the drawer' }),
              el('span', { className: 'nb-hint', children: 'by sources' }),
              el('span', { style: { flex: 1 } })),
            el('div', { className: 'nb-feature-row', role: 'list', 'aria-label': 'Notebooks with the most sources' },
              featured.map((n, i) => el('button', {
                key: n.id, type: 'button', role: 'listitem', className: 'nb-feature',
                style: { '--kc': hues[i % hues.length] },
                onClick: () => onOpen(n.id),
                'aria-label': `Open notebook ${n.title}`,
                children: [
                  el('span', { className: 'nb-feature-top' },
                    el('span', { className: 'nb-feature-emoji', 'aria-hidden': 'true',
                      children: (n.emoji && String(n.emoji).trim())
                        ? emojiFor(n.id, n.emoji)
                        : jsx(Sigil, { seed: n.id, size: 40 }) }),
                    el('span', { className: 'nb-feature-title', children: n.title })),
                  el('span', { className: 'nb-feature-meta', children: [
                    jsx(CountChip, { icon: 'layers', n: n.sources || 0, noun: 'source' }),
                    jsx(CountChip, { icon: 'sparkle', n: n.artifacts || 0, noun: 'output' }),
                    n.updated_at
                      ? el('span', { className: 'nb-count', children: dshort(n.updated_at) })
                      : null
                  ] })
                ]
              }, n.id))))
        : null,

      el('div', { className: 'nb-home-sec' },
        el('span', { className: 'nb-meta', children: shown.length === notebooks.length
          ? 'All notebooks' : `${shown.length} of ${notebooks.length} notebooks` }),
        el('span', { style: { flex: 1 } }),
        jsx(Btn, { icon: 'plus', variant: 'primary', onClick: onNew, children: 'New notebook' })
      ),

      shown.length === 0
        ? el('div', { className: 'nb-void', style: { height: 'auto', padding: '30px 8px' } },
            el('div', null,
              el('h3', { children: notebooks.length ? 'Nothing matches' : 'No notebooks yet' }),
              el('p', { children: notebooks.length
                ? 'Try a different search.'
                : 'A notebook is a set of sources. Create one, then describe what you need — Hermes finds, labels and grounds everything in them.' }),
              !notebooks.length
                ? el('div', { style: { marginTop: '14px' } },
                    jsx(Btn, { variant: 'primary', icon: 'plus', onClick: onNew, children: 'New notebook' }))
                : null))
        : el('div', { className: 'nb-home-grid', role: 'list' },
            shown.map((n) => el('div', { key: n.id, className: 'nb-nbcard-wrap', role: 'listitem' },
              el('button', {
                type: 'button', className: 'nb-nbcard',
                onClick: () => onOpen(n.id),
                'aria-label': `Open notebook ${n.title}`,
                children: [
                  el('div', { className: 'nb-nbcard-top' },
                    el('span', { className: 'nb-nbcard-emoji', 'aria-hidden': 'true',
                      children: (n.emoji && String(n.emoji).trim())
                        ? emojiFor(n.id, n.emoji)
                        : jsx(Sigil, { seed: n.id, size: 34 }) }),
                    el('div', { className: 'nb-nbcard-head' },
                      el('span', { className: 'nb-nbcard-title', children: n.title }),
                      el('span', { className: 'nb-nbcard-when',
                        children: n.updated_at ? `Touched ${dshort(n.updated_at)}` : 'Never touched' }))),
                  jsx(NotebookDescription, { description: n.description, sources: n.sources }),
                  el('div', { className: 'nb-nbcard-foot' },
                    jsx(CountChip, { icon: 'layers', n: n.sources || 0, noun: 'source' }),
                    jsx(CountChip, { icon: 'sparkle', n: n.artifacts || 0, noun: 'output' }),
                    n.threads ? jsx(CountChip, { icon: 'note', n: n.threads, noun: 'chat' }) : null,
                    el('span', { className: 'nb-nbcard-open', 'aria-hidden': 'true' },
                      'Open', jsx(Glyph, { name: 'arrowRight', size: 13 })))
                ]
              }, n.id),
              jsx(IconBtn, {
                icon: 'note', label: `Rename notebook ${n.title}`, size: 14,
                className: 'nb-nbcard-ren',
                onClick: (e) => { e.stopPropagation(); setRen(n) }
              }),
              jsx(IconBtn, {
                icon: 'trash', label: `Delete notebook ${n.title}`, size: 14,
                className: 'nb-nbcard-del',
                onClick: (e) => { e.stopPropagation(); setDel(n) }
              })
            )))
    ),

    del ? jsx(Dialog, {
      open: true, onClose: () => setDel(null), title: 'Delete notebook', width: 420,
      children: el('div', null,
        el('p', { style: { margin: '0 0 16px', color: T.text2, fontSize: '14px', lineHeight: 1.55 },
          children: `“${del.title}” and its sources, thread and artifacts will be removed. This cannot be undone.` }),
        el('div', { style: { display: 'flex', gap: '8px', justifyContent: 'flex-end' } },
          jsx(Btn, { onClick: () => setDel(null), children: 'Cancel' }),
          jsx(Btn, {
            variant: 'primary', icon: 'trash',
            onClick: () => { const id = del.id; setDel(null); onDelete(id) },
            children: 'Delete'
          })))
    }) : null,

    ren ? jsx(RenameDialog, {
      notebook: ren, onClose: () => setRen(null),
      onDone: async (title, desc, emoji) => { setRen(null); await onRename(ren.id, title, desc, emoji) },
      onDuplicate: onDuplicate ? async () => { const n = ren; setRen(null); await onDuplicate(n.id) } : null
    }) : null
  )
}

function RenameDialog({ notebook, onClose, onDone, onDuplicate }) {
  const [title, setTitle] = useState(notebook.title || '')
  const [desc, setDesc] = useState(notebook.description || '')
  const [emoji, setEmoji] = useState(notebook.emoji || '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  return jsx(Dialog, {
    open: true, onClose, title: 'Notebook settings', width: 480,
    children: el('div', null,
      el('div', { className: 'nb-emgrid', role: 'radiogroup', 'aria-label': 'Notebook icon' },
        el('button', {
          type: 'button', className: 'nb-em' + (emoji ? '' : ' is-on'),
          onClick: () => setEmoji(''), title: 'Auto icon', 'aria-pressed': !emoji,
          children: jsx(Sigil, { seed: notebook.id, size: 30 })
        }),
        NB_EMOJI.map((e) => el('button', {
          key: e, type: 'button',
          className: 'nb-em' + (emoji === e ? ' is-on' : ''),
          onClick: () => setEmoji(e), title: `Icon ${e}`, 'aria-pressed': emoji === e,
          children: e
        }))),
      el('div', { className: 'nb-field', style: { height: '40px', marginTop: '12px', marginBottom: '10px' } },
        jsx(Glyph, { name: 'notebook', size: 14 }),
        el('input', {
          value: title, onChange: (e) => setTitle(e.target.value), autoFocus: true,
          placeholder: 'Notebook title', 'aria-label': 'Notebook title'
        })),
      el('div', { className: 'nb-field', style: { height: '40px' } },
        jsx(Glyph, { name: 'doc', size: 14 }),
        el('input', {
          value: desc, onChange: (e) => setDesc(e.target.value),
          placeholder: 'Description (optional)', 'aria-label': 'Notebook description'
        })),
      err ? el('div', { style: { marginTop: '10px', color: T.danger, fontSize: '13px' }, children: err }) : null,
      el('div', { style: { display: 'flex', gap: '8px', justifyContent: 'space-between', marginTop: '16px' } },
        onDuplicate
          ? jsx(Btn, { icon: 'copy', onClick: onDuplicate, children: 'Make a copy' })
          : el('span'),
        el('span', { style: { display: 'flex', gap: '8px' } },
          jsx(Btn, { onClick: onClose, children: 'Cancel' }),
        jsx(Btn, {
          variant: 'primary', disabled: busy || !title.trim(),
          onClick: async () => {
            setBusy(true); setErr('')
            try { await onDone(title.trim(), desc.trim(), emoji) }
            catch (e) { setErr(e.message || String(e)); setBusy(false) }
          },
          children: busy ? 'Saving…' : 'Save'
        }))))
  })
}

/* --------------------------------------------------------------- panel tog */

function PanelToggles({ side, onShow }) {
  return el('div', { className: 'nb-paneltog' },
    jsx(IconBtn, {
      icon: side === 'left' ? 'arrowRight' : 'arrowLeft',
      label: side === 'left' ? 'Show sources panel' : 'Show studio panel',
      onClick: onShow
    })
  )
}

/* -------------------------------------------------------------------- rail */

function Rail({ data, notebook, onAddSource, onOpenSource, onToggleSource,
               onToggleAll, onToggleGroup, onDeleteSource, onLabel, onCollapse, onGoHome, onSay, onDropFiles, loading, error, reload }) {
  const sources = (notebook && notebook.sources) || []
  const labels = (notebook && notebook.labels) || []
  const [q, setQ] = useState('')
  const [srcFilter, setSrcFilter] = useState('all')
  const [dragOver, setDragOver] = useState(false)
  const [closed, setClosed] = useState({})

  const shown = useMemo(() => {
    const needle = (q || '').trim().toLowerCase()
    return sources.filter((s) => {
      if (srcFilter !== 'all' && !(s.labels || []).some((l) => l.toLowerCase() === srcFilter)) return false
      if (!needle) return true
      return (s.title + ' ' + (s.origin || '') + ' ' + (s.labels || []).join(' '))
        .toLowerCase().includes(needle)
    })
  }, [sources, q, srcFilter])

  // NotebookLM groups the list by topic; the first auto-label is the topic.
  const groups = useMemo(() => {
    const map = new Map()
    for (const s of shown) {
      const g = (((s.labels || [])[0]) || kindLabel(s.kind) || 'other').toLowerCase()
      if (!map.has(g)) map.set(g, [])
      map.get(g).push(s)
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
  }, [shown])

  const allOn = sources.length > 0 && sources.every((s) => s.active !== false)
  const activeCount = sources.filter((s) => s.active !== false).length

  const srcRow = (s) => {
    const on = s.active !== false
    return el('div', {
      className: 'nb-src', key: s.id,
      'data-on': pickedCite === s.n ? 'true' : 'false',
      'data-off': on ? 'false' : 'true'
    },
      el('button', {
        type: 'button', className: 'nb-src-open',
        onClick: () => onOpenSource(s),
        'aria-label': `Open source ${s.n} — ${s.title}`,
        title: s.summary || s.origin || s.title,
        children: [
          el('span', { className: 'nb-src-ico' },
            jsx(Glyph, { name: SRC_ICON[s.kind] || 'file', size: 15 }),
            el('b', { className: 'nb-cite', children: `S${s.n}` })),
          el('span', { style: { minWidth: 0, flex: 1 } },
            el('span', { className: 'nb-src-title', children: s.title }),
            el('span', { className: 'nb-src-meta' },
              el('span', { className: 'nb-chip', children: `${kindLabel(s.kind)} · ${nfmt(s.chars)}` }),
              (s.labels || []).slice(0, 2).map((l) => el('span', { className: 'nb-chip', children: l }, l)),
              (s.labels || []).length > 2
                ? el('span', {
                    className: 'nb-chip',
                    title: `Also tagged: ${s.labels.slice(2).join(', ')}`,
                    children: `+${s.labels.length - 2}`
                  })
                : null))
        ]
      }),
      el('button', {
        type: 'button', className: 'nb-srccheck', role: 'checkbox',
        'aria-checked': on,
        'aria-label': `${on ? 'Exclude' : 'Include'} “${s.title}” ${on ? 'from' : 'in'} answers`,
        title: on ? 'Included in answers — click to exclude' : 'Excluded from answers — click to include',
        onClick: () => onToggleSource(s),
        children: on ? jsx(Glyph, { name: 'check', size: 14 }) : null
      }),
      onDeleteSource ? jsx(IconBtn, {
        icon: 'trash', size: 13, className: 'nb-src-del',
        label: `Remove source “${s.title}”`,
        onClick: () => onDeleteSource(s)
      }) : null
    )
  }

  return el('aside', {
    className: 'nb-col nb-rail', 'aria-label': 'Sources',
    'data-drop': dragOver ? 'true' : 'false',
    onDragOver: (e) => {
      const types = e.dataTransfer && e.dataTransfer.types
      if (types && Array.prototype.indexOf.call(types, 'Files') >= 0) {
        e.preventDefault(); setDragOver(true)
      }
    },
    onDragLeave: () => setDragOver(false),
    onDrop: (e) => {
      e.preventDefault(); setDragOver(false)
      const files = e.dataTransfer && e.dataTransfer.files
      if (files && files.length && onDropFiles) onDropFiles(Array.from(files))
    }
  },
    el('div', { className: 'nb-pane-head' },
      el('span', { className: 'nb-pane-title', children: 'Sources' }),
      el('span', { className: 'nb-meta', children: `${activeCount}/${sources.length}` }),
      jsx(IconBtn, {
        icon: 'sparkle', label: 'Auto-label unlabelled sources', onClick: onLabel,
        disabled: !(notebook && notebook.stats && notebook.stats.unlabeled)
      }),
      jsx(IconBtn, { icon: 'refresh', label: 'Refresh sources', onClick: () => reload(true) }),
      jsx(IconBtn, { icon: 'arrowLeft', label: 'Hide sources panel', onClick: onCollapse })
    ),

    el('div', { className: 'nb-pad', style: { paddingTop: '10px', paddingBottom: '8px' } },
      notebook
        ? el('button', {
            type: 'button', className: 'nb-nbrow', 'aria-current': 'true',
            onClick: onGoHome, title: 'Back to all notebooks',
            children: [
              el('span', { className: 'nb-avatar', 'aria-hidden': 'true' },
                jsx(Glyph, { name: 'notebook', size: 15 })),
              el('span', { style: { minWidth: 0, flex: 1 } },
                el('span', { className: 'nb-nbtitle', children: notebook.title }),
                el('span', { className: 'nb-nbsub',
                  children: `${sources.length} source${sources.length === 1 ? '' : 's'} · ${(notebook.artifacts || []).length} artifact${(notebook.artifacts || []).length === 1 ? '' : 's'}` })),
              jsx(Glyph, { name: 'arrowLeft', size: 14 })
            ]
          })
        : el('div', { className: 'nb-hint', style: { padding: '6px 4px', lineHeight: 1.5 } },
            'Pick a notebook on Home first — sources belong to one.')),

    el('div', { className: 'nb-pad', style: { paddingBottom: '8px' } },
      jsx(Btn, {
        icon: 'plus', onClick: onAddSource, disabled: !notebook,
        className: 'nb-addsrc', children: 'Add sources'
      })),

    notebook ? jsx(WebFinder, { notebook, onAdded: () => reload(true), onSay: onSay }) : null,

    el('div', { className: 'nb-pad', style: { paddingBottom: '8px' } },
      jsx(SearchField, { value: q || '', onChange: setQ, placeholder: 'Search sources', label: 'Search sources' })
    ),

    labels.length
      ? el('div', {
          className: 'nb-pad',
          style: { display: 'flex', gap: '6px', flexWrap: 'wrap', paddingTop: 0, paddingBottom: '10px' },
          role: 'group', 'aria-label': 'Filter sources by label'
        },
          labels.slice(0, 6).map((l) =>
            jsx(Chip, {
              key: l.label, tone: srcFilter === l.label.toLowerCase() ? 'accent' : undefined,
              pressed: srcFilter === l.label.toLowerCase(),
              onClick: () => setSrcFilter(srcFilter === l.label.toLowerCase() ? 'all' : l.label.toLowerCase()),
              title: `${l.count} source${l.count === 1 ? '' : 's'} labelled ${l.label}`,
              children: `${l.label} ${l.count}`
            }))
        )
      : null,

    el('div', { className: 'nb-scroll', 'aria-label': 'Source list' },
      el('div', { className: 'nb-pad', style: { paddingTop: 0, paddingBottom: '12px' } },
        sources.length
          ? el('div', { className: 'nb-selall' },
              el('button', {
                type: 'button', className: 'nb-srccheck', role: 'checkbox',
                'aria-checked': allOn,
                'aria-label': allOn ? 'Exclude all sources from answers' : 'Include all sources in answers',
                title: allOn ? 'Exclude every source' : 'Include every source',
                onClick: onToggleAll,
                children: allOn ? jsx(Glyph, { name: 'check', size: 12 }) : null
              }),
              el('span', { className: 'nb-src-title', style: { fontSize: '12.5px' },
                children: 'All sources' }),
              el('span', { className: 'nb-hint', style: { marginLeft: 'auto' },
                children: `${activeCount} of ${sources.length}` }))
          : null,
        error
          ? el('div', { className: 'nb-hint', style: { padding: '10px', color: T.danger }, children: error })
          : !notebook
            ? null
            : shown.length === 0
              ? el('div', { className: 'nb-void', style: { height: 'auto', padding: '24px 8px' } },
                  el('div', null,
                    el('h3', { style: { fontSize: '15px' }, children: sources.length ? 'Nothing matches' : 'No sources yet' }),
                    el('p', { style: { fontSize: '13px' }, children: sources.length
                      ? 'Clear the filter or the search to see every source.'
                      : 'Add a file, a URL or pasted text — or describe the topic and let Hermes find sources for you.' })))
              : el('div', { style: { display: 'flex', flexDirection: 'column', gap: '2px' } },
                  groups.map(([g, list]) => {
                    const isClosed = !!closed[g]
                    const gAllOn = list.every((s) => s.active !== false)
                    const gSomeOn = list.some((s) => s.active !== false)
                    return el('div', { key: g },
                      el('div', {
                        style: { display: 'flex', alignItems: 'center', gap: '2px' }
                      },
                        el('button', {
                          type: 'button', className: 'nb-srccheck', role: 'checkbox',
                          'aria-checked': gAllOn ? 'true' : (gSomeOn ? 'mixed' : 'false'),
                          'data-mixed': gSomeOn && !gAllOn ? 'true' : 'false',
                          'aria-label': `${gAllOn ? 'Exclude' : 'Include'} all sources in “${g}”`,
                          title: gAllOn
                            ? `Exclude all ${list.length} sources in “${g}”`
                            : `Include all ${list.length} sources in “${g}”`,
                          onClick: () => onToggleGroup && onToggleGroup(list),
                          children: gAllOn
                            ? jsx(Glyph, { name: 'check', size: 12 })
                            : (gSomeOn ? el('span', { 'aria-hidden': 'true',
                                style: { fontSize: '11.5px', fontWeight: 700, lineHeight: 1 },
                                children: '–' }) : null)
                        }),
                        el('button', {
                          type: 'button', className: 'nb-srcgroup',
                          'data-closed': isClosed ? 'true' : 'false',
                          'aria-expanded': !isClosed,
                          onClick: () => setClosed((c) => ({ ...c, [g]: !c[g] })),
                          style: { flex: 1 },
                          children: [
                            jsx(Glyph, { name: 'chevron', size: 13 }),
                            el('span', { style: { textTransform: 'capitalize' }, children: g }),
                            el('em', { children: `${list.filter((s) => s.active !== false).length}/${list.length}` })
                          ]
                        })),
                      isClosed ? null : el('div', { className: 'nb-srcgroup-list' }, list.map(srcRow))
                    )
                  }))
      ),
    el('div', { className: 'nb-pad', style: { paddingTop: 0, paddingBottom: '12px' } },
      el('span', {
        className: 'nb-chip',
        title: 'Sources live on this machine with no per-notebook cap — grounding scales from full-context injection to hybrid retrieval as the corpus grows.',
        style: { fontSize: '11.5px', opacity: 0.85 },
        children: '♾️ Unlimited sources · 🛡️ Local-first ready'
      }))
    ),
    dragOver
      ? el('div', {
          style: {
            position: 'absolute', inset: '12px', zIndex: 5, borderRadius: '18px',
            border: `2px dashed ${T.accent}`, background: 'color-mix(in srgb, #0a0b10 78%, transparent)',
            display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', justifyContent: 'center',
            color: T.text, fontSize: '14px', fontWeight: 600, pointerEvents: 'none'
          },
          children: [
            jsx(Glyph, { name: 'plus', size: 22 }),
            'Drop files to add them as sources'
          ]
        })
      : null
  )
}

/* ------------------------------------------------------------- web finder */

/** The "describe it" box: live web search inside the sources panel. Candidates
 *  come from the real /discover route; each adds through /sources one at a
 *  time so failures are reported per url, never hidden. */
function WebFinder({ notebook, onAdded, onSay }) {
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [cands, setCands] = useState(null)
  const [err, setErr] = useState('')
  const [added, setAdded] = useState({})
  const [adding, setAdding] = useState('')

  const search = async () => {
    const query = q.trim()
    if (!query || busy || !notebook) return
    setBusy(true); setErr(''); setCands(null); setAdded({})
    try {
      const out = await api('/discover', {
        method: 'POST',
        body: { notebook: notebook.id, query, max_results: 6 },
        timeoutMs: 90000
      })
      const list = out.candidates || []
      setCands(list)
      if (!list.length) setErr('Nothing found — try different words.')
    } catch (e) {
      setErr(e.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  const addOne = async (c) => {
    if (adding || added[c.url] || !notebook) return
    setAdding(c.url); setErr('')
    try {
      await api('/sources', {
        method: 'POST', body: { notebook: notebook.id, urls: [c.url] }, timeoutMs: 120000
      })
      setAdded((a) => ({ ...a, [c.url]: true }))
      if (onAdded) onAdded()
    } catch (e) {
      setErr(e.message || String(e))
      if (onSay) onSay(e.message || 'could not add source')
    } finally {
      setAdding('')
    }
  }

  return el('div', { className: 'nb-finder' },
    el('div', { className: 'nb-finder-row' },
      jsx(Glyph, { name: 'search', size: 14 }),
      el('input', {
        value: q, placeholder: 'Search the web for new sources',
        'aria-label': 'Search the web for new sources',
        onChange: (e) => setQ(e.target.value),
        onKeyDown: (e) => { if (e.key === 'Enter') search() },
        disabled: !notebook || busy, spellCheck: false
      }),
      el('button', {
        type: 'button', className: 'nb-finder-go',
        'aria-label': 'Find sources', title: 'Find sources',
        disabled: !q.trim() || busy || !notebook, onClick: search,
        children: jsx(Glyph, { name: 'arrowRight', size: 15 })
      })
    ),
    busy ? el('div', { className: 'nb-hint', style: { fontSize: '11.5px', padding: '7px 4px 0' },
      children: 'searching the web…' }) : null,
    err ? el('div', { className: 'nb-hint', style: { fontSize: '11.5px', padding: '7px 4px 0', color: T.danger },
      children: err }) : null,
    cands && cands.length
      ? el('div', { style: { marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '2px' } },
          cands.map((c) => {
            const host = hostOf(c.url)
            const isAdded = !!added[c.url]
            return el('button', {
              key: c.url, type: 'button', className: 'nb-fcand',
              onClick: () => addOne(c),
              disabled: isAdded || !!adding,
              'aria-label': `${isAdded ? 'Added' : 'Add'} source: ${c.title || c.url}`,
              title: c.snippet || c.url,
              children: [
                el('span', { className: 'nb-fcand-main' },
                  el('span', { className: 'nb-fcand-title', children: c.title || c.url }),
                  el('span', { className: 'nb-fcand-sub',
                    children: `${host}${c.snippet ? ` · ${String(c.snippet).slice(0, 90)}` : ''}` })),
                el('span', { className: 'nb-fcand-add', 'data-added': isAdded ? 'true' : 'false', 'aria-hidden': 'true' },
                  jsx(Glyph, { name: isAdded ? 'check' : adding === c.url ? 'refresh' : 'plus', size: 13 }))
              ]
            }, c.url)
          }))
      : null
  )
}

// citation focus is shared state: a [S3] click in the answer highlights S3 here
let pickedCite = 0
const setPickedCite = (n) => { pickedCite = n }
