/* ============================================================================
   Discover — a source scout, not a search box.

   The difference from Google is the input: this panel already has the notebook.
   It asks the model what the notebook is *missing*, turns those gaps into
   queries, fans them out across the search providers, ranks the union (with a
   per-domain cap so six results are six sources, not one blog), and explains
   every card. Picking one ingests it through the same path as an uploaded file.
   ============================================================================ */

function DiscoverCard({ c, on, onToggle }) {
  return el('label', { className: 'nb-disc-card', 'data-on': on ? 'true' : 'false' },
    el('input', {
      type: 'checkbox', checked: !!on, onChange: onToggle,
      'aria-label': `Select ${c.title}`
    }),
    el('div', { className: 'nb-disc-main' },
      el('div', { className: 'nb-disc-top' },
        el('span', { className: 'nb-disc-dom', children: c.domain }),
        c.provider && c.provider !== 'web'
          ? el('span', { className: 'nb-chip', 'data-tone': 'accent', children: c.provider })
          : null,
        el('span', {
          className: 'nb-meta', style: { marginLeft: 'auto' },
          children: `${Math.round((c.score || 0) * 100)}% fit`
        })),
      el('div', { className: 'nb-disc-title', children: c.title }),
      c.snippet ? el('div', { className: 'nb-disc-snip', children: c.snippet }) : null,
      el('div', { className: 'nb-disc-why' },
        jsx(Glyph, { name: 'sparkle', size: 12 }),
        el('span', { children: c.why || 'new material' }))))
}

/* Discovery was five variables describing two operations at once (`busy` covered
 * both scouting and adding, so the button said "searching" while it was ingesting).
 * Two machines: `scout` (idle → searching → results | error) and `ingest`
 * (idle → adding → done | failed). One cannot be mistaken for the other. */
const SCOUT = Machine('discover', {
  initial: 'idle',
  context: { result: null, error: '', queries: 0 },
  states: {
    idle: { on: { RUN: 'searching', RESET: { target: 'idle', action: () => ({ result: null, error: '' }) } } },
    searching: {
      tags: ['busy'],
      on: {
        RESULTS: { target: 'results', action: (c, p) => ({ result: (p && p.result) || null, error: '' }) },
        FAIL: { target: 'error', action: (c, p) => ({ error: (p && p.message) || 'discovery failed' }) },
        CANCEL: 'idle'
      }
    },
    results: { on: { RUN: 'searching', RESET: { target: 'idle', action: () => ({ result: null, error: '' }) } } },
    error: { on: { RUN: 'searching', RESET: { target: 'idle', action: () => ({ result: null, error: '' }) } } }
  }
})

const INGEST = Machine('ingest', {
  initial: 'idle',
  context: { error: '', added: 0, asked: 0 },
  states: {
    idle: { on: { ADD: 'adding' } },
    adding: {
      tags: ['busy'],
      on: {
        DONE: { target: 'idle', action: (c, p) => ({ added: (p && p.landed) || 0, asked: (p && p.asked) || 0, error: '' }) },
        FAIL: { target: 'failed', action: (c, p) => ({ error: (p && p.message) || 'adding failed' }) }
      }
    },
    failed: { on: { ADD: 'adding', DISMISS: { target: 'idle', action: () => ({ error: '' }) } } }
  }
})

function DiscoverPanel({ notebook, onSay, reload }) {
  const scout = useMachine(SCOUT)
  const ingest = useMachine(INGEST)
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState({})
  const res = scout.ctx.result
  const busy = scout.matches('searching')
  const adding = ingest.matches('adding')
  const err = scout.ctx.error

  const nbId = notebook && notebook.id
  const candidates = (res && res.candidates) || []
  const chosen = candidates.filter((c) => picked[c.canonical || c.url])

  const toggle = (c) => {
    const key = c.canonical || c.url
    setPicked((p) => ({ ...p, [key]: !p[key] }))
  }

  const run = async (query) => {
    if (!nbId || !SCOUT.can('RUN')) return
    SCOUT.send('RUN')
    setPicked({})
    try {
      const out = await api('/discover', {
        method: 'POST',
        body: { notebook: nbId, query: (query != null ? query : q) || '', max_results: 12 },
        timeoutMs: 180000
      })
      SCOUT.send('RESULTS', { result: out })
    } catch (e) {
      SCOUT.send('FAIL', { message: String(e.message || e) })
      if (onSay) onSay(`discover failed: ${e.message || e}`)
    }
  }

  const addChosen = async () => {
    if (!chosen.length || !INGEST.can('ADD')) return
    INGEST.send('ADD')
    try {
      const out = await api('/sources', {
        method: 'POST',
        body: { notebook: nbId, urls: chosen.map((c) => c.url) },
        timeoutMs: 300000
      })
      const landed = ((out && out.results) || []).filter((r) => r.ok).length
      if (onSay) onSay(`${landed} of ${chosen.length} sources added`)
      setPicked({})
      INGEST.send('DONE', { landed, asked: chosen.length })
      if (reload) await reload()
      await run(res && res.query)
    } catch (e) {
      INGEST.send('FAIL', { message: String(e.message || e) })
      if (onSay) onSay(`adding failed: ${e.message || e}`)
    }
  }

  const emptyState = () => {
    if (busy && !candidates.length) {
      return el('div', { className: 'nb-disc-empty' },
        el('span', { className: 'nb-dot', style: { background: T.accent } }),
        el('div', { children: 'planning queries and searching…' }))
    }
    if (res && !candidates.length) {
      return el('div', { className: 'nb-disc-empty' },
        el('div', { children: 'No new sources came back.' }),
        el('div', {
          className: 'nb-hint',
          children: `${res.searched || 0} results seen — already here, noise, or over the per-domain cap.`
        }))
    }
    if (res) return null
    return el('div', { className: 'nb-disc-empty' },
      jsx(Glyph, { name: 'globe', size: 26 }),
      el('div', { children: 'Nothing scouted yet.' }),
      el('div', {
        className: 'nb-hint',
        children: 'Press Search — it asks the model what this notebook lacks, then looks for it.'
      }))
  }

  return el('div', { className: 'nb-disc' },
    el('div', { className: 'nb-disc-head' },
      el('h1', { className: 'nb-h1', children: 'Discover sources' }),
      el('p', {
        className: 'nb-sub',
        children: 'It reads this notebook first, then looks for what is missing — not just what matches your words.'
      })),

    el('div', { className: 'nb-disc-search' },
      el('input', {
        className: 'nb-input', value: q, onChange: (e) => setQ(e.target.value),
        placeholder: 'Describe what you want — or leave it blank and it will hunt the gaps',
        'aria-label': 'Discovery query',
        onKeyDown: (e) => { if (e.key === 'Enter') run() }
      }),
      jsx(Btn, {
        variant: 'primary', icon: 'search', onClick: () => run(), disabled: busy || !nbId,
        children: busy ? 'Scouting…' : 'Search'
      })),

    ((res && res.gaps) || []).length
      ? el('div', { className: 'nb-disc-gaps' },
          el('span', { className: 'nb-meta', children: 'Gaps it found' }),
          (res.gaps || []).map((g) => jsx(Chip, {
            key: g, onClick: () => { setQ(g); run(g) },
            title: 'Search for this gap', children: g
          })))
      : null,

    err ? el('div', { className: 'nb-disc-err', children: err }) : null,

    el('div', { className: 'nb-disc-body' },
      emptyState(),
      candidates.map((c) => {
        const key = c.canonical || c.url
        return jsx(DiscoverCard, { key, c, on: !!picked[key], onToggle: () => toggle(c) }, key)
      })),

    chosen.length
      ? el('div', { className: 'nb-disc-foot' },
          jsx(Btn, {
            variant: 'primary', icon: 'plus', onClick: addChosen, disabled: adding,
            children: adding ? 'Adding…' : `Add ${chosen.length} source${chosen.length === 1 ? '' : 's'}`
          }),
          el('span', { className: 'nb-hint', children: 'each one is extracted, deduped and labelled' }))
      : null,

    res
      ? el('div', { className: 'nb-disc-meta' },
          el('span', { children: `${res.searched || 0} results → ${candidates.length} kept` }),
          el('span', { children: `providers: ${(res.providers || ['web']).join(' · ')}` }),
          ((res.queries) || []).length
            ? el('span', { children: `queries: ${res.queries.slice(0, 3).join(' | ')}` })
            : null)
      : null)
}
