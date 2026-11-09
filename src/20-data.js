/* -------------------------------------------------------------- data layer
 * The page talks to its own backend namespace (`/api/plugins/hermes-notebook`)
 * through `ctx.rest`, which carries the desktop grant. Nothing here fabricates
 * state: a failed call surfaces the backend's own sentence, and the UI says so
 * instead of rendering plausible zeros.
 */
let CTX = null
const setCtx = (c) => { CTX = c }

const api = async (path, opts) => {
  if (!CTX || typeof CTX.rest !== 'function') {
    throw new Error('this page is not attached to the gateway yet — reload the window')
  }
  const out = await CTX.rest(path, opts)
  if (out && out.ok === false) throw new Error(out.error || 'the backend refused that')
  if (out && out.detail && out.ok === undefined) throw new Error(String(out.detail))
  return out
}

const qs = (obj) => Object.keys(obj)
  .filter((k) => obj[k] !== undefined && obj[k] !== null && obj[k] !== '')
  .map((k) => `${k}=${encodeURIComponent(obj[k])}`).join('&')

const persist = {
  get(key, dflt) {
    try { const v = CTX && CTX.storage && CTX.storage.get(key); return v === undefined || v === null ? dflt : v }
    catch { return dflt }
  },
  set(key, value) {
    try { CTX && CTX.storage && CTX.storage.set(key, value) } catch { /* storage is a nicety */ }
  }
}

/* One `/state` fetch is a machine, not three booleans: `loading`, `error` and
 * `data` could previously disagree (error set, loading true, data stale) and a
 * slow reply from a previous notebook could land on the current one. The machine
 * refuses both: refreshes carry a generation, and only the newest generation may
 * settle a load. */
const STUDIO = Machine('studio', {
  initial: 'loading',
  context: { data: null, error: '', gen: 0 },
  states: {
    loading: {
      tags: ['busy'],
      on: {
        LOADED: { target: 'ready', guard: (c, p) => !!p && p.gen === c.gen,
                  action: (c, p) => ({ data: p.data, error: '' }) },
        FAILED: { target: 'error', guard: (c, p) => !!p && p.gen === c.gen,
                  action: (c, p) => ({ error: p.message }) }
      }
    },
    ready: {
      on: {
        // a silent refresh keeps the current data on screen; a full one shows the
        // skeleton, because the caller asked for that
        REFRESH_SOFT: 'refreshing',
        REFRESH_FULL: 'loading',
        LOADED: { target: 'ready', guard: (c, p) => !!p && p.gen === c.gen,
                  action: (c, p) => ({ data: p.data, error: '' }) }
      }
    },
    refreshing: {
      tags: ['busy', 'stale'],
      on: {
        LOADED: { target: 'ready', guard: (c, p) => !!p && p.gen === c.gen,
                  action: (c, p) => ({ data: p.data, error: '' }) },
        FAILED: { target: 'ready', guard: (c, p) => !!p && p.gen === c.gen,
                  action: (c, p) => ({ error: p.message }) },
        REFRESH_FULL: 'loading'
      }
    },
    error: {
      on: {
        REFRESH_FULL: 'loading',
        REFRESH_SOFT: 'loading',
        LOADED: { target: 'ready', guard: (c, p) => !!p && p.gen === c.gen,
                  action: (c, p) => ({ data: p.data, error: '' }) }
      }
    }
  }
})

/** `nb` scopes it to a notebook, `thread` to a conversation. */
function useStudio(nb, thread) {
  const m = useMachine(STUDIO)
  const scope = useRef({ nb, thread })
  scope.current = { nb, thread }
  const load = useCallback(async (silent) => {
    const { nb: n, thread: t } = scope.current
    const gen = STUDIO.ctx.gen + 1
    STUDIO.set({ gen })
    // the first load starts in `loading`; only later loads need a refresh event
    if (silent && STUDIO.can('REFRESH_SOFT')) STUDIO.send('REFRESH_SOFT')
    else if (STUDIO.can('REFRESH_FULL')) STUDIO.send('REFRESH_FULL')
    try {
      const next = await api(`/state${n ? `?${qs({ notebook: n, thread: t || '' })}` : ''}`)
      STUDIO.send('LOADED', { data: next, gen })
      return next
    } catch (e) {
      STUDIO.send('FAILED', { message: e.message || String(e), gen })
      return null
    }
  }, [nb, thread])
  useEffect(() => {
    // a scope change is a new load; the machine's generation guard drops the old one
    load(false)
  }, [load])
  return {
    data: m.ctx.data,
    error: m.ctx.error,
    loading: m.matches('loading'),
    refreshing: m.matches('refreshing'),
    reload: load,
    setData: (d) => STUDIO.set({ data: d })
  }
}

/* ------------------------------------------------------------------- kinds */
const KIND_ICON = {
  video_overview: 'video', audio_overview: 'audio', summary: 'summary',
  briefing_doc: 'doc', study_guide: 'study', faq: 'faq', timeline: 'timeline',
  mind_map: 'mindmap', flashcards: 'cards', quiz: 'quiz', slides: 'slides',
  infographic: 'chart', data_table: 'grid'
}

/* Studio groups — the workbench sorts outputs by what they make, so its group
 * headers need a glyph per family rather than one generic icon. */
const GROUP_ICON = { media: 'play', docs: 'doc', study: 'cards', visual: 'image', other: 'grid' }

const SRC_ICON = {
  url: 'globe', youtube: 'video', file: 'file', text: 'note', image: 'image',
  pdf: 'file', note: 'note', audio: 'audio',
  docx: 'doc', pptx: 'slides', xlsx: 'chart', epub: 'book', ipynb: 'notebook',
  code: 'terminal', markdown: 'doc', csv: 'chart'
}

/** What a person calls the source's type — NotebookLM shows "Website",
 *  "YouTube", "PDF"…; ours are the extractor's kind ids. */
const KIND_LABEL = {
  url: 'web', youtube: 'youtube', note: 'note', text: 'pasted text',
  pdf: 'pdf', docx: 'docx', pptx: 'slides', xlsx: 'sheet', epub: 'ebook',
  ipynb: 'notebook', image: 'image', file: 'file', audio: 'audio'
}
const kindLabel = (k) => KIND_LABEL[k] || k || 'file'

/** NotebookLM-style identity: a stable 3D-emoji per notebook id. */
const NB_EMOJI = ['📓', '🧠', '🔬', '📚', '🛰️', '⚛️', '🌱', '🏛️', '🎧', '🧪',
  '📈', '🗺️', '🧭', '💡', '🏥', '⚖️']
const hashStr = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h }
const emojiFor = (id, custom) => (custom && String(custom).trim()) || NB_EMOJI[hashStr(id || 'nb') % NB_EMOJI.length]
const dshort = (stamp) => {
  const d = stamp ? new Date(stamp) : null
  return d && !isNaN(d) ? d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : ''
}

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'docs', label: 'Docs' },
  { id: 'study', label: 'Study' },
  { id: 'media', label: 'Media' },
  { id: 'visual', label: 'Visual' }
]

/** Latest generation per kind — what "ready" means on a studio card. */
function latestByKind(artifacts) {
  const map = {}
  for (const a of artifacts || []) {
    if (!map[a.kind]) map[a.kind] = a
  }
  return map
}

const OPT_LABEL = { focus: 'focus', count_hint: 'amount', format: 'format', length: 'length', language: 'language', style: 'style' }
/** "focus: fusion economics · format: brief" — what a tailored run asked for. */
const optsSummary = (opts) => Object.keys(opts || {})
  .filter((k) => opts[k])
  .map((k) => `${OPT_LABEL[k] || k}: ${String(opts[k]).slice(0, 48)}`)
  .join(' · ')
