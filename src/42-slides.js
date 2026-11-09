/* ============================================================================
   Slide archetypes — one layout per `archetype`, not one layout for the deck.

   The prompt asks the model for nine named layouts; until now the viewer drew
   every slide the same way (a title and a bullet list), so "problem_gap" and
   "tension_audit" arrived on screen as identical walls of text. Each function
   below is the visual the name promises, drawn on the dark slide canvas.

   Rules that hold for all of them:
   - the canvas is 16:9 and the type is set for a projector, so no body text
     below 15px and no more than ~35 words on the canvas;
   - a `[S#]` in a slide's text becomes a real citation chip (same path as
     everywhere else: `Markdown` owns citations);
   - an archetype whose payload is missing falls back to the bullet list rather
     than drawing an empty frame — an old deck still presents.
   ========================================================================== */

/** The accent line the deck's slides all share. */
const SLIDE_ON = {
  ink: '#f2f3f8',
  body: '#d6d8e6',
  dim: '#9aa0b5',
  faint: '#7d8398',
  card: 'rgba(255,255,255,.055)',
  hair: 'rgba(255,255,255,.14)',
  accent: T.accent
}

const slideText = (text, onCite, style) =>
  jsx(Markdown, { text: String(text || ''), onCite, className: 'nb-slide-md' })

/** A small uppercase label, used for kickers and column heads. */
const slideKicker = (text, tone) =>
  el('span', { className: 'nb-slide-kicker', 'data-tone': tone || 'dim', children: text })

const slideStat = (s, i) => el('div', { className: 'nb-slide-stat', key: `st${i}` },
  el('div', { className: 'nb-slide-stat-v', children: s.value }),
  el('div', { className: 'nb-slide-stat-l', children: s.label }))

/** title_hero — the thesis, a subtitle, and the deck's own metadata. */
function slideTitleHero(s, ctx) {
  return el('div', { className: 'nb-slide nb-slide-hero' },
    s.kicker ? slideKicker(s.kicker, 'accent') : null,
    el('div', { className: 'nb-slide-hero-t', children: s.title }),
    (s.bullets || []).length
      ? el('div', { className: 'nb-slide-hero-sub', children: slideText(s.bullets[0], ctx.onCite) })
      : null,
    el('div', { className: 'nb-slide-hero-meta' },
      ctx.deckTitle ? el('span', { className: 'nb-slide-badge', children: ctx.deckTitle }) : null,
      el('span', { className: 'nb-slide-badge', children: `${ctx.total} slides` }),
      (s.citations || []).length
        ? el('span', { className: 'nb-slide-badge', 'data-tone': 'accent',
            children: `cites ${s.citations.map((n) => `S${n}`).join(' · ')}` })
        : null))
}

/** executive_bluf — the numbers first, one sentence that decides. */
function slideExecutiveBluf(s, ctx) {
  const stats = (s.stats || []).slice(0, 4)
  const takeaway = (s.bullets || [])[0]
  return el('div', { className: 'nb-slide nb-slide-bluf' },
    slideKicker(s.kicker || 'Bottom line', 'accent'),
    el('div', { className: 'nb-slide-bluf-t', children: s.title }),
    stats.length
      ? el('div', { className: 'nb-slide-stats', 'data-count': String(stats.length) },
          stats.map(slideStat))
      : null,
    takeaway
      ? el('div', { className: 'nb-slide-banner' },
          jsx(Glyph, { name: 'bolt', size: 15 }),
          el('span', { children: slideText(takeaway, ctx.onCite) }))
      : null)
}

/** problem_gap — legacy on the left, target on the right, saturation split. */
function slideProblemGap(s, ctx) {
  const cols = s.columns || {}
  const left = cols.left || []
  const right = cols.right || []
  const half = (items, side, label) => el('div', { className: 'nb-slide-half', 'data-side': side },
    slideKicker(label, side === 'left' ? 'dim' : 'accent'),
    el('ul', { className: 'nb-slide-list' },
      (items.length ? items : (side === 'left' ? (s.bullets || []).slice(0, 2) : []))
        .map((b, i) => el('li', { key: `h${side}${i}`, children: slideText(b, ctx.onCite) }))))
  return el('div', { className: 'nb-slide nb-slide-gap' },
    el('div', { className: 'nb-slide-gap-head', children: s.title }),
    el('div', { className: 'nb-slide-split' },
      half(left, 'left', 'Current · legacy'),
      el('div', { className: 'nb-slide-arrow', 'aria-hidden': 'true', children: '→' }),
      half(right, 'right', 'Target · next-gen')))
}

/** architecture_bento — cards with a micro-spec each. */
function slideBento(s, ctx) {
  const items = (s.bullets || []).slice(0, 5)
  const card = (b, i) => {
    const [head, ...rest] = String(b).split(/\s+—\s+|\s+-\s+/)
    const kids = [el('div', { className: 'nb-slide-card-h', children: slideText(head, ctx.onCite) })]
    if (rest.length) {
      kids.push(el('div', { className: 'nb-slide-card-s', children: slideText(rest.join(' — '), ctx.onCite) }))
    }
    return el('div', { className: 'nb-slide-card', key: `b${i}` }, kids)
  }
  return el('div', { className: 'nb-slide nb-slide-bento' },
    el('div', { className: 'nb-slide-gap-head', children: s.title }),
    el('div', { className: 'nb-slide-cards', 'data-count': String(Math.min(items.length, 5) || 1) },
      items.map(card)))
}

/** process_pipeline — ordered stages with a transformation each. */
function slidePipeline(s, ctx) {
  const stages = (s.stages || []).slice(0, 5)
  const items = stages.length
    ? stages.map((st) => ({ label: st.label, detail: st.detail }))
    : (s.bullets || []).slice(0, 5).map((b) => {
        const [label, ...rest] = String(b).split(/\s+—\s+|\s+-\s+/)
        return { label, detail: rest.join(' — ') }
      })
  const chev = el('span', { className: 'nb-slide-chev', 'aria-hidden': 'true' })
  const row = (st, i) => {
    const kids = [
      el('span', { className: 'nb-slide-stage-n', children: String(i + 1) }),
      el('div', { className: 'nb-slide-stage-h', children: st.label })
    ]
    if (st.detail) {
      kids.push(el('div', { className: 'nb-slide-stage-s', children: slideText(st.detail, ctx.onCite) }))
    }
    if (i < items.length - 1) kids.push(chev)
    return el('div', { className: 'nb-slide-stage', key: `p${i}` }, kids)
  }
  return el('div', { className: 'nb-slide nb-slide-pipe' },
    el('div', { className: 'nb-slide-gap-head', children: s.title }),
    el('div', { className: 'nb-slide-stages', 'data-count': String(items.length || 1) },
      items.map(row)))
}

/** deep_dive_comparison — a dense table read off `columns` or `bullets`. */
function slideComparison(s, ctx) {
  const cols = s.columns || {}
  const left = cols.left || []
  const right = cols.right || []
  const rows = Math.max(left.length, right.length)
  if (rows >= 2) {
    const headCells = [
      el('th', { key: 'h0', children: slideKicker('left', 'dim') }),
      el('th', { key: 'h1', children: slideKicker('right', 'accent') })
    ]
    const cell = (value, key) => el('td', { key, children: value ? slideText(value, ctx.onCite) : '' })
    const bodyRows = Array.from({ length: rows }).map((_, i) => el('tr', { key: `r${i}` },
      cell(left[i], 'l'), cell(right[i], 'r')))
    const table = el('table', { className: 'nb-slide-table' },
      el('thead', null, el('tr', null, headCells)),
      el('tbody', null, bodyRows))
    return el('div', { className: 'nb-slide nb-slide-cmp' },
      el('div', { className: 'nb-slide-gap-head', children: s.title }),
      table)
  }
  // no paired columns: the bullets become labelled rows rather than a wall
  return el('div', { className: 'nb-slide nb-slide-cmp' },
    el('div', { className: 'nb-slide-gap-head', children: s.title }),
    el('div', { className: 'nb-slide-rows' },
      (s.bullets || []).map((b, i) => {
        const [head, ...rest] = String(b).split(/\s+—\s+|\s+-\s+/)
        return el('div', { className: 'nb-slide-row', key: `br${i}` },
          el('div', { className: 'nb-slide-row-h', children: slideText(head, ctx.onCite) }),
          el('div', { className: 'nb-slide-row-s', children: slideText(rest.join(' — '), ctx.onCite) }))
      })))
}

/** tension_audit — agreement on one side, contradiction on the other. */
function slideTension(s, ctx) {
  const left = (s.columns || {}).left || []
  const right = (s.columns || {}).right || []
  const bullets = s.bullets || []
  const agree = left.length ? left : bullets.filter((b) => !/S\d/.test(String(b)))
  const conflict = right.length ? right : bullets.filter((b) => /S\d/.test(String(b)))
  const col = (side, tone, label, list, emptyText) => el('div',
    { className: 'nb-slide-tcol', 'data-side': side },
    slideKicker(label, tone),
    el('ul', { className: 'nb-slide-list' },
      list.map((b, i) => el('li', { key: `${side}${i}`, children: slideText(b, ctx.onCite) })))
    , list.length ? null : el('div', { className: 'nb-slide-empty', children: emptyText }))
  return el('div', { className: 'nb-slide nb-slide-tension' },
    el('div', { className: 'nb-slide-gap-head', children: s.title }),
    el('div', { className: 'nb-slide-tension-body' },
      col('agree', 'ok', 'Stable ground', agree,
          'no shared ground found in the sources'),
      col('conflict', 'warn', 'Unresolved', conflict,
          'the sources do not contradict each other')))
}

/** roadmap — swimlanes with an owner per line. */
function slideRoadmap(s, ctx) {
  const lanes = (s.stages || []).slice(0, 4)
  const items = lanes.length
    ? lanes.map((st) => ({ label: st.label, detail: st.detail }))
    : (s.bullets || []).slice(0, 4).map((b) => {
        const [label, ...rest] = String(b).split(/\s+—\s+|\s+-\s+/)
        return { label, detail: rest.join(' — ') }
      })
  const lane = (it, i) => {
    const kids = [el('div', { className: 'nb-slide-lane-head' },
      el('span', { className: 'nb-slide-lane-n', children: it.label }),
      el('span', { className: 'nb-slide-lane-rule' }))]
    if (it.detail) kids.push(el('div', { className: 'nb-slide-lane-body', children: slideText(it.detail, ctx.onCite) }))
    return el('div', { className: 'nb-slide-lane', key: `l${i}` }, kids)
  }
  return el('div', { className: 'nb-slide nb-slide-roadmap' },
    el('div', { className: 'nb-slide-gap-head', children: s.title }),
    el('div', { className: 'nb-slide-lanes' }, items.map(lane)))
}

/** closing — the one line the deck wants remembered. */
function slideClosing(s, ctx) {
  return el('div', { className: 'nb-slide nb-slide-close' },
    el('div', { className: 'nb-slide-close-t', children: s.title }),
    (s.bullets || []).length
      ? el('div', { className: 'nb-slide-close-s', children: slideText(s.bullets[0], ctx.onCite) })
      : null,
    el('div', { className: 'nb-slide-hero-meta' },
      (s.citations || []).length
        ? el('span', { className: 'nb-slide-badge', 'data-tone': 'accent',
            children: `grounded in ${s.citations.map((n) => `S${n}`).join(' · ')}` })
        : null))
}

const SLIDE_LAYOUTS = {
  title_hero: slideTitleHero,
  executive_bluf: slideExecutiveBluf,
  problem_gap: slideProblemGap,
  architecture_bento: slideBento,
  process_pipeline: slidePipeline,
  deep_dive_comparison: slideComparison,
  tension_audit: slideTension,
  roadmap: slideRoadmap,
  closing: slideClosing
}

/** Draw one slide. An unknown or missing archetype falls back to the bullet
 *  list, which is what every deck rendered as before — so an older artifact
 *  still presents, it just looks like an older artifact. */
function SlideBody({ slide: s, ctx }) {
  const fn = SLIDE_LAYOUTS[s && s.archetype]
  if (fn) return fn(s, ctx)
  return el('div', { className: 'nb-slide' },
    el('div', { className: 'nb-slide-gap-head', children: s.title }),
    el('ul', { className: 'nb-slide-list' },
      (s.bullets || []).map((b, i) => el('li', { key: `fb${i}`, children: slideText(b, ctx.onCite) }))))
}

/** Human names for the archetype chip, so "problem_gap" never reaches a reader. */
const SLIDE_LABEL = {
  title_hero: 'Title',
  executive_bluf: 'Bottom line',
  problem_gap: 'Gap',
  architecture_bento: 'Architecture',
  process_pipeline: 'Pipeline',
  deep_dive_comparison: 'Comparison',
  tension_audit: 'Tensions',
  roadmap: 'Roadmap',
  closing: 'Close'
}
