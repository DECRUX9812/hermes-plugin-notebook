/* ============================================================================
   Tensions — the audit nobody else runs.

   Every grounded-answer tool stops at "here is what the sources say". This
   screen answers the question that decides whether to believe that: *do they
   agree, and are they actually different sources?*

   Two halves, deliberately separate:
   - Independence is MEASURED here, not asked of a model: sources that repeat
     one another's opening text are grouped, so "6 sources" can honestly read
     "4 independent". It answers with no model bound.
   - Conflict is the model's job: each position must cite a real S<n> and quote
     the wording. A position with no valid source is dropped by the backend, not
     repaired here — this screen renders only what survived that check.
   ============================================================================ */

/* Two operations that used to share one `busy` flag (so the panel said "auditing"
 * while it was really re-measuring): the audit (model) and the measurement
 * (deterministic). Separate machines, so a model failure still shows the counts. */
const TENSION_AUDIT = Machine('tensions:audit', {
  initial: 'idle',
  context: { report: null, error: '' },
  states: {
    idle: { on: { RUN: 'running' } },
    running: {
      tags: ['busy'],
      on: {
        DONE: { target: 'done', action: (c, p) => ({ report: (p && p.report) || null, error: '' }) },
        FAIL: { target: 'failed', action: (c, p) => ({ error: (p && p.message) || 'audit failed' }) }
      }
    },
    done: { on: { RUN: 'running' } },
    failed: { on: { RUN: 'running' } }
  }
})

function SidePill({ side }) {
  return el('div', { className: 'nb-tension-side' },
    el('div', { className: 'nb-tension-claim', children: side.claim }),
    side.quote
      ? el('blockquote', { className: 'nb-tension-quote', children: side.quote })
      : null,
    el('div', { className: 'nb-tension-src' },
      (side.sources || []).map((n, i) => jsx(Chip, {
        key: `s${n}`,
        tone: 'accent',
        title: (side.titles || [])[i] || `Source ${n}`,
        children: `S${n}`
      })))
  )
}

function TensionsPanel({ notebook, onSay, onOpenSource, modelReady, onCite }) {
  const audit = useMachine(TENSION_AUDIT)
  const [reported, setReported] = useState(null)
  const nbId = notebook && notebook.id
  const busy = audit.matches('running')
  const report = audit.ctx.report || reported
  const err = audit.ctx.error
  const indep = report && report.independence
  const items = (report && report.items) || []

  const run = async () => {
    if (!nbId || !TENSION_AUDIT.can('RUN')) return
    TENSION_AUDIT.send('RUN')
    try {
      const out = await api('/tensions', {
        method: 'POST',
        body: { notebook: nbId, max_items: 6 },
        timeoutMs: 240000
      })
      setReported(out)
      TENSION_AUDIT.send('DONE', { report: out })
      if (out && out.degraded && onSay) onSay(`audit limited: ${out.degraded}`)
    } catch (e) {
      TENSION_AUDIT.send('FAIL', { message: String(e.message || e) })
      if (onSay) onSay(`tension audit failed: ${e.message || e}`)
    }
  }

  /* The measured verdict is a sentence, not a chart: it has to be readable in
   * one glance and quotable in a summary. */
  const verdict = (() => {
    if (!indep) return null
    const total = indep.sources || 0
    const independent = indep.independent || 0
    if (!total) return null
    const dupes = (indep.clusters || [])
    if (independent === total) {
      return { tone: 'ok', text: `${total} sources, all independent — agreement between them is real corroboration.` }
    }
    const syn = dupes.map((c) => `${c.members.map((m) => `S${m}`).join(' + ')}`).join(', ')
    return {
      tone: 'warn',
      text: `${total} sources, ${independent} independent${syn ? ` — ${syn} repeat the same text` : ''}. Treat agreement among the copies as one voice.`
    }
  })()

  const emptyState = () => {
    if (busy) {
      return el('div', { className: 'nb-disc-empty' },
        el('span', { className: 'nb-dot', style: { background: T.accent } }),
        el('div', { children: 'reading every source and comparing claims…' }))
    }
    if (!modelReady) {
      return el('div', { className: 'nb-disc-empty' },
        jsx(Glyph, { name: 'shield', size: 26 }),
        el('div', { children: 'The model is offline, so disagreements cannot be read.' }),
        el('div', { className: 'nb-hint', children: 'The independence count is measured from text and still runs.' }))
    }
    return el('div', { className: 'nb-disc-empty' },
      jsx(Glyph, { name: 'shield', size: 26 }),
      el('div', { children: 'No audit yet.' }),
      el('div', { className: 'nb-hint',
        children: 'It compares every source against every other: where they conflict, what they agree on, and how many of them are actually independent.' }))
  }

  /* The stable ground: claims the sources state the same way. Kept as its own
   * variable so the return stays flat enough to read (deep nesting is where
   * this file's bracket bugs came from). */
  const agreeList = (report && report.agreements) || []
  const agreeBlock = agreeList.length
    ? el('div', { className: 'nb-tension-agree' },
        el('div', { className: 'nb-home-sec' },
          el('span', { className: 'nb-meta', children: 'Stable ground' }),
          el('span', { className: 'nb-hint', children: 'claims two or more sources state the same way' }),
          el('span', { style: { flex: 1 } })),
        agreeList.map((a, i) => el('div', { key: `a${i}`, className: 'nb-tension-agree-row' },
          jsx(Glyph, { name: 'check', size: 13 }),
          el('span', { className: 'nb-tension-agree-claim', children: a.claim }),
          el('span', {
            className: 'nb-tension-agree-src',
            children: (a.sources || []).map((n) => `S${n}`).join(' · ')
          })))
      )
    : null

  return el('div', { className: 'nb-tensions' },
    el('div', { className: 'nb-disc-head' },
      el('h1', { className: 'nb-h1', children: 'Where the sources disagree' }),
      el('p', { className: 'nb-disc-sub',
        children: 'A grounded answer is only as trustworthy as the agreement behind it. This reads all the sources and reports the conflicts, the consensus, and the duplicated ones.' })),
    el('div', { className: 'nb-tension-bar' },
      jsx(Btn, {
        variant: 'primary', icon: 'shield', onClick: run, disabled: busy || !nbId,
        children: busy ? 'Auditing…' : (report ? 'Audit again' : 'Audit the sources')
      }),
      indep
        ? el('span', { className: 'nb-tension-counts' },
            el('span', { className: 'nb-count' }, el('b', { children: String(indep.sources || 0) }), el('span', { children: 'active sources' })),
            el('span', { className: 'nb-count' }, el('b', { children: String(indep.independent || 0) }), el('span', { children: 'independent' })),
            el('span', { className: 'nb-count' }, el('b', { children: String(items.length) }), el('span', { children: 'tensions' })))
        : null),

    verdict
      ? el('div', { className: 'nb-tension-verdict', 'data-tone': verdict.tone, children: verdict.text })
      : null,

    (report && report.degraded)
      ? el('div', { className: 'nb-disc-err', children: `Audit limited: ${report.degraded}` })
      : null,
    err ? el('div', { className: 'nb-disc-err', children: err }) : null,

    emptyState(),

    items.length
      ? el('div', { className: 'nb-tension-list' },
          items.map((it, i) => el('article', { key: `t${i}`, className: 'nb-tension' },
            el('header', { className: 'nb-tension-head' },
              el('span', { className: 'nb-tension-n', children: String(i + 1) }),
              el('h3', { className: 'nb-tension-topic', children: it.topic || 'disagreement' })),
            el('div', { className: 'nb-tension-sides' },
              it.sides.map((side, j) => jsx(SidePill, { key: `t${i}s${j}`, side }, `t${i}s${j}`))),
            it.why ? el('div', { className: 'nb-tension-why', children: it.why }) : null,
            it.resolution
              ? el('div', { className: 'nb-tension-res', children: [
                  el('b', { children: /^unresolved/i.test(it.resolution) ? 'Unresolved · ' : 'Weighs to · ' }),
                  it.resolution.replace(/^unresolved[:\s—-]*/i, '')
                ] })
              : null)))
      : (report ? el('div', { className: 'nb-disc-empty' },
          jsx(Glyph, { name: 'check', size: 26 }),
          el('div', { children: 'No cross-source conflicts found.' }),
          el('div', { className: 'nb-hint',
            children: 'That is a result, not a failure — the sources make different points rather than opposing ones.' }))
        : null),

    agreeBlock
  )
}
