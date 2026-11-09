/* ============================================================================
   Document surfaces — summary, briefing, FAQ, study guide.

   These four artifacts are generated as markdown, and until now they were
   rendered as markdown: a wall of headings that a reader has to re-scan to find
   the one sentence that matters. The generation prompts now emit a skeleton
   (BLUF banner, KPI table, RAG badges, tiered Q&A, concept cards, trap alerts)
   and this file renders that skeleton as a document, with a plain-markdown
   fallback for artifacts generated before the skeleton existed.

   Every [S#] in the parsed text is still a real citation: the parsers hand the
   raw string to `Markdown`, which owns the citation chips, so nothing here
   invents a second citation path.
   ========================================================================== */

const DOC_TOKEN = String.raw`(?:\*\*|[^|])*`

/** Split generated markdown into `{title, lede, bluf, kpis, sections}`, where a
 *  section is `{heading, blocks}` and blocks are the same shapes `parseBlocks`
 *  produces. Pure: no rendering, no model. */
function docOutline(text) {
  const blocks = parseBlocks(String(text || '').replace(/\r\n/g, '\n'))
  let title = ''
  let bluf = ''
  const lede = []
  const sections = []
  let cur = null
  const push = (b) => (cur ? cur.blocks : lede).push(b)

  for (const b of blocks) {
    if (b.t === 'h1') { if (!title) title = b.text; continue }
    if (b.t === 'h2') { cur = { heading: b.text, blocks: [] }; sections.push(cur); continue }
    // the BLUF banner is a blockquote or a paragraph that opens with a label
    if (!bluf && !cur && (b.t === 'quote' || b.t === 'p')) {
      const plain = String(b.text || '').replace(/\*\*/g, '').trim()
      const m = /^(?:bottom line(?: up front)?|bluf|verdict|the short answer)[:\s—-]+(.+)$/i.exec(plain)
      if (m) { bluf = m[1].trim(); continue }
      if (b.t === 'quote') { bluf = plain; continue }
    }
    push(b)
  }
  const kpis = docKpis(sections)
  return { title, lede, bluf, kpis, sections }
}

/** The KPI strip is the first table whose header names a value/metric column. */
function docKpis(sections) {
  for (const s of sections) {
    for (const b of s.blocks) {
      if (b.t !== 'table') continue
      const head = (b.rows[0] || []).map((h) => String(h).toLowerCase())
      const vi = head.findIndex((h) => /value|metric|number|figure/.test(h))
      const li = head.findIndex((h) => /metric|label|name|what/.test(h))
      if (vi < 0 && li < 0) continue
      const rows = b.rows[1] || []
      if (!rows.length) continue
      const valueCol = vi >= 0 ? vi : 1
      const labelCol = li >= 0 && li !== valueCol ? li : (valueCol === 0 ? 1 : 0)
      const ctxCol = head.findIndex((h) => /context|meaning|basis|vs|detail/.test(h))
      const srcCol = head.findIndex((h) => /source|cite|citation|ref/.test(h))
      return rows.slice(0, 4).map((r) => ({
        value: String(r[valueCol] || '').trim(),
        label: String(r[labelCol] || '').trim(),
        context: ctxCol >= 0 ? String(r[ctxCol] || '').trim() : '',
        source: srcCol >= 0 ? String(r[srcCol] || '').trim() : ''
      })).filter((k) => k.value || k.label)
    }
  }
  return []
}

/** A `[CRITICAL]` / `[MODERATE]` / `[LOW]` marker anywhere in a line. */
const RAG = /\[\s*(critical|high|moderate|medium|low|ready|pass|fail|amber|red|green)\s*\]/i
const RAG_TONE = {
  critical: 'danger', high: 'danger', red: 'danger', fail: 'danger',
  moderate: 'warn', medium: 'warn', amber: 'warn',
  low: 'ok', ready: 'ok', pass: 'ok', green: 'ok'
}

/** One line of the risk register: badge, bold title, root cause, mitigation. */
function riskRow(line, i, onCite) {
  const m = RAG.exec(line)
  const tone = m ? (RAG_TONE[m[1].toLowerCase()] || 'accent') : null
  const clean = line.replace(RAG, '').trim()
  const parts = clean.split(/\s+—\s+|\s+-\s+/)
  const head = parts.shift() || clean
  const rest = parts
  return el('div', { className: 'nb-risk', key: `r${i}` },
    m ? el('span', { className: 'nb-rag', 'data-tone': tone, children: m[1].toLowerCase() }) : null,
    el('div', { className: 'nb-risk-body' },
      el('div', { className: 'nb-risk-head', children: jsx(Markdown, { text: head, onCite }) }),
      rest.length
        ? el('div', { className: 'nb-risk-rest' },
            jsx(Markdown, { text: rest.join(' — '), onCite }))
        : null))
}

function KpiStrip({ kpis, onCite }) {
  if (!kpis.length) return null
  return el('div', { className: 'nb-kpis', role: 'list', 'aria-label': 'Key metrics' },
    kpis.map((k, i) => el('div', { className: 'nb-kpi', role: 'listitem', key: `k${i}` },
      el('div', { className: 'nb-kpi-value', children: jsx(Markdown, { text: k.value, onCite }) }),
      el('div', { className: 'nb-kpi-label', children: k.label }),
      k.context ? el('div', { className: 'nb-kpi-ctx', children: k.context }) : null,
      k.source ? el('div', { className: 'nb-kpi-src', children: jsx(Markdown, { text: k.source, onCite }) }) : null)))
}

function Bluf({ text, onCite }) {
  if (!text) return null
  return el('div', { className: 'nb-bluf' },
    jsx(Glyph, { name: 'bolt', size: 15 }),
    el('div', { className: 'nb-bluf-body' },
      el('span', { className: 'nb-bluf-tag', children: 'Bottom line' }),
      el('div', { className: 'nb-bluf-text', children: jsx(Markdown, { text, onCite }) })))
}

/** The document surface shared by Summary and Briefing Doc. Both are read the
 *  same way — banner, numbers, then sections — and differ only in whether a
 *  section renders its bullets as a risk register. */
function DocView({ text, kind, onCite }) {
  const doc = useMemo(() => docOutline(text), [text])
  // pre-skeleton artifacts have one long section and no KPI table: say so and
  // render them whole rather than inventing structure that is not there
  const structured = !!doc.bluf || doc.kpis.length > 0 || doc.sections.length > 1
  if (!structured) {
    return el('div', { className: 'nb-view-body' }, el('div', { className: 'nb-doc' }, jsx(Markdown, { text, onCite })))
  }
  const isRisk = (s) => /risk/i.test(s.heading)
  return el('div', { className: 'nb-view-body' },
    el('div', { className: 'nb-docdoc' },
      jsx(Bluf, { text: doc.bluf, onCite }),
      jsx(KpiStrip, { kpis: doc.kpis, onCite }),
      doc.lede.length
        ? el('div', { className: 'nb-doc-lede' }, el('div', { className: 'nb-doc' }, jsx(Markdown, { text: doc.lede.map((b) => b.text || '').join('\n\n'), onCite })))
        : null,
      doc.sections.map((s, si) => {
        // the KPI table has already been lifted into the strip
        const blocks = s.blocks.filter((b) => b.t !== 'table' || b.rows[0].join().toLowerCase().indexOf('value') < 0)
        if (!blocks.length) return null
        return el('section', { className: 'nb-doc-sec', key: `s${si}` },
          el('h2', { className: 'nb-doc-h2', children: s.heading }),
          isRisk(s) && kind === 'briefing_doc'
            ? el('div', { className: 'nb-risks' },
                blocks.filter((b) => b.t === 'ul' || b.t === 'ol')
                  .flatMap((b) => b.items || [])
                  .map((line, li) => riskRow(line, li, onCite)))
            : el('div', { className: 'nb-doc' },
                blocks.map((b, bi) => renderBlockNamed(b, `${si}-${bi}`, onCite))))
      }))
  )
}

/** `renderBlock` keys by index; inside a section the index is local, so pass a
 *  namespaced key to keep React from recycling children across sections. */
function renderBlockNamed(b, keyName, onCite) {
  const out = renderBlock(b, keyName, onCite)
  return out
}

/* --------------------------------------------------------------------- faq */

const FAQ_TIER = [
  { id: 'foundational', test: /foundational|mechanics|basics/i, label: 'Foundational mechanics', icon: 'study' },
  { id: 'edge', test: /edge|bottleneck|limit|failure/i, label: 'Edge cases and bottlenecks', icon: 'shield' },
  { id: 'tension', test: /contradict|unresolved|disagree|tension/i, label: 'Contradictions and unresolved questions', icon: 'link' }
]

/** Split an FAQ document into tiers of `{q, verdict, body, caveat}`.
 *
 *  Two shapes are accepted, because both exist in real notebooks:
 *   - the tiered skeleton (`## Foundational mechanics` + `### question`)
 *   - the older flat form (`**question?**` then its answer), which has no
 *     headings at all and used to fall through to a wall of Markdown
 */
function faqParse(text) {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n')
  const tiers = []
  let cur = null
  let q = null
  const flushQ = () => {
    if (q && cur && (q.q || q.body.some(Boolean))) cur.items.push(q)
    q = null
  }
  const newQ = (label) => ({ q: label, body: [], verdict: '', caveat: '' })

  for (const raw of lines) {
    const t = raw.trim()
    if (!t) { if (q) q.body.push(''); continue }
    if (/^---$/.test(t)) continue
    const h1 = /^#\s+(.*)$/.exec(t)
    if (h1) { flushQ(); continue }
    const h2 = /^##\s+(.*)$/.exec(t)
    if (h2) {
      flushQ()
      const label = h2[1].replace(/\*\*/g, '').trim()
      cur = { id: label.toLowerCase(), label, items: [] }
      tiers.push(cur)
      continue
    }
    const h3 = /^#{3,4}\s+(.*)$/.exec(t)
    if (h3) { flushQ(); if (!cur) { cur = { id: 'faq', label: 'Questions', items: [] }; tiers.push(cur) } q = newQ(h3[1].replace(/\*\*/g, '').trim()); continue }
    // a bold question in the older flat form starts a question of its own — but
    // only when nothing is being answered yet, and only when it reads as a
    // question. A bold VERDICT at the head of an answer is not a new question.
    const boldQ = /^\*\*([^*]{6,})\*\*\s*(.*)$/.exec(t)
    const looksLikeQuestion = boldQ && (/\?$/.test(boldQ[1].trim()) || !q)
    if (boldQ && !cur) {
      cur = { id: 'faq', label: 'Questions', items: [] }
      tiers.push(cur)
    }
    if (looksLikeQuestion && cur) {
      flushQ()
      q = newQ(boldQ[1].trim())
      if (boldQ[2]) q.body.push(boldQ[2].trim())
      continue
    }
    if (q) {
      // the verdict sentence is bolded at the front of the answer
      const v = /^\*\*([^*]+)\*\*/.exec(t)
      if (v && !q.verdict) {
        q.verdict = v[1].trim()
        if (t.slice(v[0].length).trim()) q.body.push(t.slice(v[0].length).trim())
      } else if (/^caveat[:\s]/i.test(t.replace(/\*\*/g, ''))) {
        q.caveat = t.replace(/\*\*caveat[:\s—-]*/i, '').replace(/^\*\*/, '').trim()
      } else {
        q.body.push(t)
      }
    }
  }
  flushQ()
  const mapped = tiers
    .map((tier) => ({
      ...tier,
      meta: FAQ_TIER.find((x) => x.test.test(tier.label)) || { id: 'other', label: tier.label, icon: 'faq' }
    }))
    .filter((tier) => tier.items.length)
  return { tiers: mapped, total: mapped.reduce((n, t) => n + t.items.length, 0) }
}

function FaqView({ text, onCite }) {
  const doc = useMemo(() => faqParse(text), [text])
  const [open, setOpen] = useState(() => {
    const first = doc.tiers.find((t) => t.items.length)
    return first ? `${first.id}:0` : ''
  })
  if (!doc.total) {
    return el('div', { className: 'nb-view-body' }, el('div', { className: 'nb-doc' }, jsx(Markdown, { text, onCite })))
  }
  const tone = (verdict) => {
    const v = String(verdict || '').toLowerCase()
    if (/^(yes|cannot|no)/.test(v) && /^no /.test(v)) return 'danger'
    if (/^yes/.test(v)) return 'ok'
    if (/^no/.test(v)) return 'danger'
    return 'accent'
  }
  return el('div', { className: 'nb-view-body' },
    el('div', { className: 'nb-faq' },
      el('div', { className: 'nb-faq-bar' },
        el('span', { className: 'nb-meta', children: `${doc.total} questions` }),
        el('span', { style: { flex: 1 } }),
        doc.tiers.map((t) => el('span', { className: 'nb-chip', key: `c-${t.id}`, children: `${t.label.split(' ')[0].toLowerCase()} ${t.items.length}` }))),
      doc.tiers.filter((t) => t.items.length).map((tier) => el('div', { className: 'nb-faq-tier', key: tier.id },
        el('div', { className: 'nb-faq-tierhead' },
          jsx(Glyph, { name: tier.meta.icon || 'faq', size: 14 }),
          el('span', { children: tier.label }),
          el('span', { className: 'nb-meta', children: `${tier.items.length}` })),
        tier.items.map((item, qi) => {
          const id = `${tier.id}:${qi}`
          const isOpen = open === id
          return el('div', { className: 'nb-faq-item', 'data-open': isOpen ? 'true' : 'false', key: id },
            el('button', {
              type: 'button', className: 'nb-faq-q', 'aria-expanded': isOpen,
              'aria-controls': `faq-${id}`, onClick: () => setOpen(isOpen ? '' : id),
              children: [
                el('span', { className: 'nb-faq-marker', children: isOpen ? '−' : '+' }),
                el('span', { className: 'nb-faq-qt', children: item.q })
              ]
            }),
            isOpen
              ? el('div', { className: 'nb-faq-a', id: `faq-${id}` },
                  item.verdict
                    ? el('span', { className: 'nb-verdict', 'data-tone': tone(item.verdict), children: item.verdict })
                    : null,
                  el('div', { className: 'nb-doc', children: jsx(Markdown, { text: item.body.join('\n').trim(), onCite }) }),
                  item.caveat
                    ? el('div', { className: 'nb-caveat' },
                        jsx(Glyph, { name: 'shield', size: 12 }),
                        el('span', { children: jsx(Markdown, { text: item.caveat, onCite }) }))
                    : null)
              : null)
        }))))
  )
}

/* ------------------------------------------------------------- study guide */

/** Concept cards: `### term` + four labelled lines. Trap alerts: the
 *  `**Novice assumption:** … / **What the sources show:** …` pairs. */
function studyParse(text) {
  const blocks = parseBlocks(String(text || '').replace(/\r\n/g, '\n'))
  const sections = []
  let cur = null
  for (const b of blocks) {
    if (b.t === 'h2') { cur = { heading: b.text, blocks: [] }; sections.push(cur); continue }
    if (!cur) continue
    cur.blocks.push(b)
  }
  const concepts = []
  const traps = []
  let prompts = []
  for (const s of sections) {
    if (/concept/i.test(s.heading)) {
      // h3 blocks introduce a card; the following paragraph holds the labels
      let card = null
      for (const b of s.blocks) {
        if (b.t === 'h3') { card = { term: b.text, lines: [] }; concepts.push(card); continue }
        if (card && b.text) card.lines.push(b.text)
      }
    }
    if (/trap|misconception/i.test(s.heading)) {
      for (const b of s.blocks) {
        const items = b.items || (b.text ? [b.text] : [])
        for (const it of items) {
          const nov = /\*\*novice assumption:?\*\*\s*([^/]+)/i.exec(it)
          const act = /(?:\*\*what the sources show:?\*\*|what the sources show:?)\s*(.+)/i.exec(it)
          if (nov) traps.push({ novice: nov[1].trim(), actual: act ? act[1].trim() : '' })
        }
      }
    }
    if (/socratic|prompt|rubric/i.test(s.heading)) prompts = s.blocks
  }
  const card = (c) => {
    const lab = (name) => {
      const re = new RegExp(`\\*\\*${name}:?\\*\\*\\s*(.*)`, 'i')
      for (const line of c.lines) { const m = re.exec(line); if (m) return m[1].trim() }
      return ''
    }
    return {
      term: c.term,
      definition: lab('Definition') || lab('Formal definition'),
      mechanism: lab('Mechanism') || lab('Under-the-hood mechanism'),
      failure: lab('Failure mode') || lab('Real-world failure mode'),
      source: lab('Source') || lab('Sources')
    }
  }
  return { sections, concepts: concepts.map(card), traps, prompts }
}

function StudyGuideView({ text, onCite }) {
  const doc = useMemo(() => studyParse(text), [text])
  const hasCards = doc.concepts.some((c) => c.definition || c.mechanism || c.failure)
  if (!hasCards && !doc.traps.length) {
    // an artifact generated before the skeleton existed is still a study guide:
    // render it as the markdown it is rather than invent structure it lacks
    return el('div', { className: 'nb-view-body' },
      el('div', { className: 'nb-doc' }, jsx(Markdown, { text, onCite })))
  }
  const other = doc.sections.filter((s) => !/concept|trap|misconception/i.test(s.heading))

  const conceptRows = (c) => {
    const row = (label, value) => (value
      ? el('div', { className: 'nb-concept-row' },
          el('span', { className: 'nb-concept-lab', children: label }),
          el('div', { className: 'nb-concept-val' },
            jsx(Markdown, { text: value, onCite })))
      : null)
    return el('div', { className: 'nb-concept', key: c.term },
      el('div', { className: 'nb-concept-term', children: c.term }),
      row('Definition', c.definition),
      row('Mechanism', c.mechanism),
      row('Failure mode', c.failure),
      c.source
        ? el('div', { className: 'nb-concept-src' },
            jsx(Markdown, { text: c.source, onCite }))
        : null)
  }

  const concepts = hasCards
    ? el('section', { className: 'nb-doc-sec' },
        el('h2', { className: 'nb-doc-h2', children: 'Concept cards' }),
        el('div', { className: 'nb-concepts' }, doc.concepts.map(conceptRows)))
    : null

  const half = (side, label, value) => el('div', { className: 'nb-trap-half', 'data-side': side },
    el('span', { className: 'nb-trap-tag', children: label }),
    el('div', { children: jsx(Markdown, { text: value || '', onCite }) }))

  const traps = doc.traps.length
    ? el('section', { className: 'nb-doc-sec' },
        el('h2', { className: 'nb-doc-h2', children: 'Trap alerts' }),
        doc.traps.map((t, i) => el('div', { className: 'nb-trap', key: `t${i}` },
          half('novice', 'Novice assumption', t.novice),
          half('actual', 'What the sources show', t.actual))))
    : null

  const rest = other.map((s, si) => el('section', { className: 'nb-doc-sec', key: `o${si}` },
    el('h2', { className: 'nb-doc-h2', children: s.heading }),
    el('div', { className: 'nb-doc' },
      s.blocks.map((b, bi) => renderBlock(b, `${si}-${bi}`, onCite)))))

  return el('div', { className: 'nb-view-body' },
    el('div', { className: 'nb-studyguide' },
      concepts,
      traps,
      rest))
}
