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

/** One poll of `/state`; `nb` scopes it to a notebook. */
function useStudio(nb) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const alive = useRef(true)
  const load = useCallback(async (silent) => {
    if (!silent) setLoading(true)
    try {
      const next = await api(`/state${nb ? `?${qs({ notebook: nb })}` : ''}`)
      if (!alive.current) return next
      setData(next)
      setError('')
      return next
    } catch (e) {
      if (alive.current) setError(e.message || String(e))
      return null
    } finally {
      if (alive.current) setLoading(false)
    }
  }, [nb])
  useEffect(() => {
    alive.current = true
    load(false)
    return () => { alive.current = false }
  }, [load])
  return { data, error, loading, reload: load, setData }
}

/* ------------------------------------------------------------------- kinds */
const KIND_ICON = {
  video_overview: 'video', audio_overview: 'audio', summary: 'summary',
  briefing_doc: 'doc', study_guide: 'study', faq: 'faq', timeline: 'timeline',
  mind_map: 'mindmap', flashcards: 'cards', quiz: 'quiz', slides: 'slides',
  infographic: 'chart', data_table: 'grid'
}

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
