/* ------------------------------------------------------------------- study
 *
 * Flashcards and quizzes were already generated; nothing remembered whether a card
 * had been answered, so "study" meant re-reading a deck you already knew. This
 * surface is a session: the notebook's own cards, ordered by what is about to be
 * forgotten, with the schedule kept on the server so the page, the CLI and an agent
 * see the same memory (see `hermes_notebook/study.py` and `notebook_study`).
 */

const STUDY = Machine('study', {
  initial: 'idle',
  context: { queue: [], stats: null, idx: 0, error: '', review: 0, limit: 12 },
  states: {
    idle: { on: { OPEN: { target: 'loading', action: (c, p) => ({ idx: 0, error: '', limit: (p && p.limit) || c.limit }) } } },
    loading: {
      tags: ['busy'],
      enter: (c, m) => {
        let live = true
        api(`/study?${qs({ notebook: c.notebook, limit: c.limit })}`)
          .then((out) => {
            if (!live) return
            const queue = (out && out.queue) || []
            m.set({ queue, stats: (out && out.stats) || null })
            m.send(queue.length ? 'LOADED' : 'EMPTY')
          })
          .catch((e) => { if (live) m.send('FAIL', { message: e.message || String(e) }) })
        return () => { live = false }
      },
      on: {
        LOADED: { target: 'reviewing', action: () => ({ error: '' }) },
        EMPTY: { target: 'done', action: () => ({ idx: 0 }) },
        FAIL: { target: 'error', action: (c, p) => ({ error: (p && p.message) || 'could not load the deck' }) },
        CLOSE: 'idle'
      }
    },
    reviewing: {
      on: {
        REVEAL: 'revealed',
        OPEN: { target: 'loading', action: (c, p) => ({ idx: 0, error: '', limit: (p && p.limit) || c.limit }) },
        CLOSE: 'idle'
      }
    },
    revealed: {
      enter: () => null,
      on: {
        RATE: { target: 'saving', guard: (c, p) => !!(p && p.rating), action: (c, p) => ({ rating: p.rating }) },
        OPEN: { target: 'loading', action: (c, p) => ({ idx: 0, error: '', limit: (p && p.limit) || c.limit }) },
        CLOSE: 'idle'
      }
    },
    saving: {
      tags: ['busy'],
      enter: (c, m) => {
        let live = true
        const card = c.queue[c.idx]
        const rating = c.rating
        api('/study/review', {
          method: 'POST', timeoutMs: 20000,
          body: { notebook: c.notebook, card: card && card.id, rating }
        })
          .then((out) => {
            if (!live) return
            m.set({ stats: (out && out.stats) || c.stats, review: c.review + 1 })
            m.send('RATED')
          })
          .catch((e) => { if (live) m.send('FAIL', { message: e.message || String(e) }) })
        return () => { live = false }
      },
      on: { RATED: 'advance', FAIL: { target: 'error', action: (c, p) => ({ error: (p && p.message) || 'could not save that review' }) } }
    },
    advance: {
      enter: (c, m) => {
        const next = c.idx + 1
        m.set({ idx: next })
        m.send(next < c.queue.length ? 'NEXT' : 'FINISHED')
        return null
      },
      on: { NEXT: 'reviewing', FINISHED: 'done' }
    },
    done: {
      on: {
        OPEN: { target: 'loading', action: (c, p) => ({ idx: 0, error: '', limit: (p && p.limit) || c.limit }) },
        CLOSE: 'idle'
      }
    },
    error: {
      on: {
        OPEN: { target: 'loading', action: (c, p) => ({ idx: 0, error: '', limit: (p && p.limit) || c.limit }) },
        CLOSE: 'idle'
      }
    }
  }
})

const RATING_HINT = {
  again: 'in a minute', hard: 'a bit sooner', good: 'as scheduled', easy: 'much later'
}

function StudyPanel({ notebook, onSay, onOpenSource }) {
  const m = useMachine(STUDY)
  const nbId = notebook && notebook.id
  const card = m.ctx.queue[m.ctx.idx] || null
  const stats = m.ctx.stats || {}
  const total = m.ctx.queue.length
  const done = m.matches('done')
  const revealed = m.matches('revealed')

  useEffect(() => {
    if (!nbId) return undefined
    STUDY.set({ notebook: nbId })
    if (STUDY.matches('idle', 'done', 'error')) STUDY.send('OPEN', { limit: 12 })
    return () => { if (STUDY.can('CLOSE')) STUDY.send('CLOSE') }
  }, [nbId])

  const rate = (rating) => { if (STUDY.can('RATE')) STUDY.send('RATE', { rating }) }

  useEffect(() => {
    const onKey = (e) => {
      if (!nbId || m.matches('idle', 'loading', 'saving', 'error')) return
      if (e.target && /input|textarea/i.test(e.target.tagName || '')) return
      if ((e.code === 'Space' || e.key === 'Enter') && STUDY.can('REVEAL')) {
        e.preventDefault(); STUDY.send('REVEAL')
      } else if (/^[1-4]$/.test(e.key) && STUDY.can('RATE')) {
        e.preventDefault(); STUDY.send('RATE', { rating: ['again', 'hard', 'good', 'easy'][Number(e.key) - 1] })
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [nbId, m.state])

  const counts = stats.counts || {}
  const chip = (label, value, tone) => el('span', {
    className: 'nb-chip', 'data-tone': tone || undefined,
    children: `${value} ${label}`
  })

  const header = el('div', { className: 'nb-study-head' },
    el('div', null,
      el('div', { className: 'nb-study-title', children: 'Study' }),
      el('div', { className: 'nb-hint', children: stats.cards
        ? `${stats.cards} cards in this notebook · ${stats.due || 0} due · ${stats.mastered_pct || 0}% mastered`
        : 'No flashcards or quiz in this notebook yet — generate one, then come back.' }),
      el('div', { className: 'nb-study-chips' },
        chip('due', stats.due || 0, stats.due ? 'accent' : undefined),
        chip('new', counts.new || 0),
        chip('learning', counts.learning || 0),
        chip('mastered', counts.mastered || 0, 'ok'),
        stats.streak ? chip('day streak', stats.streak) : null,
        stats.reviews_today ? chip('today', stats.reviews_today) : null)),
    el('div', { className: 'nb-spacer' }),
    el('div', { className: 'nb-study-actions' },
      jsx(Btn, { size: 'sm', icon: 'refresh', onClick: () => STUDY.send('OPEN', { limit: 12 }),
        children: m.matches('loading') ? 'Loading…' : 'Reload deck' }),
      jsx(Btn, { size: 'sm', icon: 'plus', onClick: () => STUDY.send('OPEN', { limit: 30 }),
        children: 'Study 30' })))

  if (!nbId) {
    return el('div', { className: 'nb-study' }, header,
      el('div', { className: 'nb-study-empty', children: 'Pick a notebook first.' }))
  }

  if (m.matches('loading') || m.matches('idle')) {
    return el('div', { className: 'nb-study', 'data-study-state': m.state }, header,
      el('div', { className: 'nb-study-empty' },
        el('span', { className: 'nb-dot', style: { background: T.accent } }),
        el('div', { children: 'Building today’s queue…' })))
  }

  if (m.matches('error')) {
    return el('div', { className: 'nb-study', 'data-study-state': m.state }, header,
      el('div', { className: 'nb-study-empty' },
        el('div', { style: { color: T.danger }, children: m.ctx.error }),
        jsx(Btn, { size: 'sm', icon: 'refresh', onClick: () => STUDY.send('OPEN'), children: 'Try again' })))
  }

  if (done && !total) {
    return el('div', { className: 'nb-study', 'data-study-state': m.state }, header,
      el('div', { className: 'nb-study-empty' },
        jsx(Glyph, { name: 'check', size: 26 }),
        el('div', { children: stats.cards
          ? 'Nothing is due right now.'
          : 'Generate flashcards or a quiz for this notebook, then come back to study.' }),
        el('div', { className: 'nb-hint', children: stats.cards
          ? `${counts.mastered || 0} mastered · ${counts.young || 0} scheduled ahead · reinforces itself as you review.`
          : 'Studio → Flashcards, or Studio → Quiz.' })))
  }

  if (done && total) {
    return el('div', { className: 'nb-study', 'data-study-state': m.state }, header,
      el('div', { className: 'nb-study-empty' },
        jsx(Glyph, { name: 'check', size: 26 }),
        el('div', { children: `Session done — ${total} cards reviewed.` }),
        el('div', { className: 'nb-hint', children: 'The queue reorders itself by when each card is due; nothing to keep track of by hand.' }),
        jsx(Btn, { size: 'sm', icon: 'refresh', variant: 'primary', onClick: () => STUDY.send('OPEN'), children: 'Check for due cards' })))
  }

  return el('div', { className: 'nb-study', 'data-study-state': m.state, 'data-study-card': card && card.id },
    header,
    el('div', { className: 'nb-study-progress' },
      el('div', { className: 'nb-study-bar' },
        el('i', { style: { width: `${total ? Math.round((m.ctx.idx / total) * 100) : 0}%` } })),
      el('span', { className: 'nb-hint', children: `${m.ctx.idx + 1} of ${total} · ${card && card.kind === 'quiz' ? 'quiz' : 'flashcard'}` })),
    el('div', { className: 'nb-study-card', 'data-phase': card && card.phase, 'aria-live': 'polite' },
      el('div', { className: 'nb-study-q', children: card && card.front }),
      card && card.kind === 'quiz' && card.choices && card.choices.length
        ? el('div', { className: 'nb-study-choices' },
            card.choices.map((c, i) => el('div', {
              key: `ch${i}`,
              className: 'nb-study-choice',
              'data-right': revealed && normAnswer(c) === normAnswer(card.back) ? 'true' : undefined,
              children: c
            })))
        : null,
      revealed
        ? el('div', { className: 'nb-study-a' },
            el('div', { className: 'nb-study-a-label', children: 'Answer' }),
            el('div', { children: card && card.back }),
            card && card.explanation ? el('div', { className: 'nb-hint', children: card.explanation }) : null,
            card && card.source
              ? el('button', {
                  type: 'button', className: 'nb-study-src', onClick: () => onOpenSource && onOpenSource(card.source),
                  children: [`Source: ${card.source}`]
                })
              : null)
        : el('div', { className: 'nb-study-reveal' },
            jsx(Btn, { variant: 'primary', icon: 'eye', onClick: () => STUDY.send('REVEAL'), children: 'Show answer' }),
            el('span', { className: 'nb-hint', children: 'space' }))),
    el('div', { className: 'nb-study-ratings' },
      revealed
        ? [
            ['again', 'Again', '1', T.danger],
            ['hard', 'Hard', '2', T.warn],
            ['good', 'Good', '3', T.ok],
            ['easy', 'Easy', '4', T.accent]
          ].map(([id, label, key, tone]) => el('button', {
            key: id, type: 'button', className: 'nb-study-rate', 'data-tone': id,
            style: { borderColor: tone },
            onClick: () => rate(id),
            children: [el('b', { children: label }), el('span', { children: `${key} · ${RATING_HINT[id]}` })]
          }))
        : el('span', { className: 'nb-hint', children: 'Rate the card after you see the answer — that is what schedules it.' }))
  )
}
