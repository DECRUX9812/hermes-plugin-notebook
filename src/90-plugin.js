/* ------------------------------------------------------------------ surface
 * One route, one nav row, one status chip, three palette commands, a settings
 * page built from the app's own primitives, and a transcript directive so the
 * agent can hand the studio a notebook (`::notebook{name="…"}`).
 *
 * The registration is deliberately defensive: the SDK has shipped two
 * generations of this call. `ctx.register({id, area, data, render})` is the
 * current one; a host that only has `contribution(area, payload)` still gets
 * every area, and each area is isolated so one renamed hook cannot take the
 * page down with it.
 */
function contribute(ctx, id, area, payload) {
  try {
    if (typeof ctx.register === 'function') {
      const out = ctx.register({ id, area, data: payload, render: payload.render })
      return out
    }
    if (typeof ctx.contribution === 'function') return ctx.contribution(area, payload)
  } catch (e) {
    try { console.warn(`[${ID}] area ${area} failed:`, e && e.message ? e.message : e) } catch { /* noop */ }
  }
  return undefined
}

function StatusChip() {
  const [counts, setCounts] = useState(null)
  useEffect(() => {
    let live = true
    api('/state').then((d) => {
      if (!live) return
      const nb = d.notebook
      setCounts(nb ? { sources: nb.stats.sources, artifacts: nb.stats.artifacts } : null)
    }).catch(() => { if (live) setCounts(null) })
    return () => { live = false }
  }, [])
  return el('button', {
    type: 'button',
    title: counts ? `${counts.sources} sources · ${counts.artifacts} artifacts` : 'Hermes Notebook',
    'aria-label': 'Open Hermes Notebook',
    onClick: () => host.navigate(ROUTE),
    style: {
      display: 'inline-flex', alignItems: 'center', gap: '5px', minHeight: '24px',
      padding: '0 7px', border: 0, borderRadius: '7px', background: 'transparent', cursor: 'pointer',
      color: 'var(--ui-text-tertiary)', fontSize: '11.5px',
      fontFamily: 'var(--ui-font-mono, ui-monospace, monospace)'
    },
    children: [
      el('span', {
        style: {
          width: '6px', height: '6px', borderRadius: '99px',
          background: counts ? 'var(--ui-success, #3fb950)' : 'var(--ui-text-quaternary)'
        }
      }),
      counts ? `nb ${counts.sources}/${counts.artifacts}` : 'notebook'
    ]
  })
}

/** Settings → Plugins: the app's ListRow / ToggleRow / SegmentedControl, not
 *  hand-rolled chrome that reads foreign next to the rest of Settings. */
function SettingsPage() {
  const ListRow = SDK.ListRow
  const ToggleRow = SDK.ToggleRow
  const SegmentedControl = SDK.SegmentedControl
  const [surface, setSurface] = useState(() => persist.get('mode', 'studio'))
  const [chip, setChip] = useState(() => persist.get('statusChip', true))
  const [state, setState] = useState(null)

  useEffect(() => {
    api('/health').then(setState).catch(() => setState(null))
  }, [])

  const rows = []
  if (ListRow) {
    rows.push(jsx(ListRow, {
      key: 'surface',
      title: 'Default surface',
      description: 'Which half of the plugin opens first: the research studio, or the lab deck.',
      action: SegmentedControl
        ? jsx(SegmentedControl, {
            value: surface,
            onChange: (v) => { setSurface(v); persist.set('mode', v) },
            items: [{ value: 'studio', label: 'Studio' }, { value: 'ops', label: 'Lab Ops' }]
          })
        : null
    }))
  }
  if (ToggleRow) {
    rows.push(jsx(ToggleRow, {
      key: 'chip',
      label: 'Status-bar chip',
      description: 'Show the active notebook’s source and artifact counts in the status bar.',
      checked: chip,
      onChange: (on) => { setChip(on); persist.set('statusChip', on) }
    }))
  }
  if (ListRow) {
    rows.push(jsx(ListRow, {
      key: 'data',
      title: 'Notebook store',
      description: state && state.data_root
        ? el('span', { className: 'nb-mono', style: { fontSize: '12px' }, children: state.data_root })
        : 'backend not reachable from this window',
      hint: state && state.model_ready
        ? 'model bound — answers and artifacts run through your provider'
        : 'the agent half is not registered in this process (enable the plugin, restart the gateway)'
    }))
    rows.push(jsx(ListRow, {
      key: 'kinds',
      title: 'Studio outputs',
      description: (state && state.kinds ? state.kinds : KINDS_FALLBACK)
        .map((k) => String(k).replace(/_/g, ' ')).join(' · ')
    }))
  }
  return el('div', { style: { display: 'flex', flexDirection: 'column' } }, rows)
}

const KINDS_FALLBACK = ['video_overview', 'audio_overview', 'summary', 'briefing_doc',
  'study_guide', 'faq', 'timeline', 'mind_map', 'flashcards', 'quiz', 'slides', 'infographic']

/** The agent can write `::notebook{name="Fusion 2026"}` in a reply. */
function NotebookDirective({ attrs }) {
  const name = String((attrs && (attrs.name || attrs.notebook)) || '').slice(0, 120)
  if (!name) return null
  return el('div', {
    style: {
      display: 'flex', alignItems: 'center', gap: '10px', margin: '8px 0',
      padding: '12px 14px', borderRadius: '14px',
      border: `1px solid ${T.line}`, background: T.card
    }
  },
  el('span', { className: 'nb-mark', style: { width: '24px', height: '24px' } }, jsx(Glyph, { name: 'notebook', size: 13 })),
  el('div', { style: { minWidth: 0, flex: 1 } },
    el('div', { style: { fontSize: '14px', fontWeight: 600 }, children: name }),
    el('div', { style: { fontSize: '12.5px', color: T.text3 }, children: 'notebook · open the studio' })),
  el('button', {
    type: 'button', className: 'nb-btn', 'data-size': 'sm',
    onClick: () => host.navigate(ROUTE),
    children: 'Open'
  }))
}

const plugin = {
  id: ID,
  name: 'Notebook',
  description: 'Ground sources into cited answers and study artifacts, and drive the lab fleet from the same window.',
  // On by default: the page is the product. A user's explicit toggle still wins.
  defaultEnabled: true,
  register(ctx) {
    setCtx(ctx)

    const shells = [
      ['route', ROUTES_AREA, { path: ROUTE }, () => jsx(App, {})],
      ['nav', SIDEBAR_NAV_AREA, { path: ROUTE, label: 'Notebook', codicon: 'notebook' }, undefined],
      ['status', STATUSBAR_AREAS ? STATUSBAR_AREAS.right : 'statusBar.right',
        { order: 118 }, () => jsx(StatusChip, {})],
      ['palette-studio', PALETTE_AREA, {
        id: 'notebook.open', label: 'Notebook: open the studio', keywords: ['notebook', 'studio', 'sources', 'research'],
        run: () => host.navigate(ROUTE)
      }, undefined],
      ['palette-ops', PALETTE_AREA, {
        id: 'notebook.ops', label: 'Notebook: open the lab deck', keywords: ['lab', 'fleet', 'ops', 'homelab', 'servers'],
        run: () => host.navigate(`${ROUTE}?surface=ops`)
      }, undefined],
      ['palette-ask', PALETTE_AREA, {
        id: 'notebook.ask', label: 'Notebook: ask the active notebook', keywords: ['ask', 'notebook', 'citation', 'grounded'],
        run: () => {
          host.navigate(ROUTE)
          if (host.composer && host.composer.setDraft) {
            host.composer.setDraft(null, 'Ask my active Hermes notebook a question grounded in its sources')
          }
        }
      }, undefined]
    ]

    for (const [id, area, data, render] of shells) {
      contribute(ctx, id, area, render ? { ...data, render } : data)
    }

    // transcript directive: the agent hands the studio a notebook
    contribute(ctx, 'directive', TRANSCRIPT_DIRECTIVE_AREA, {
      name: 'notebook',
      render: ({ attrs }) => jsx(NotebookDirective, { attrs })
    })

    // settings page (optional API — never let it take the page down)
    try {
      if (typeof ctx.registerSettingsPage === 'function') {
        ctx.registerSettingsPage({
          id: 'notebook.settings',
          title: 'Notebook',
          description: 'Sources, studio outputs and the lab deck.',
          render: () => jsx(SettingsPage, {})
        })
      }
    } catch (e) {
      try { console.warn('[hermes-notebook] settings page not registered:', e) } catch { /* noop */ }
    }
  }
}

export default plugin
