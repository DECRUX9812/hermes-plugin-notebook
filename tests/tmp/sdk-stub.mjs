
export const ROUTES_AREA = 'routes'
export const SIDEBAR_NAV_AREA = 'sidebar.nav'
export const PALETTE_AREA = 'palette'
export const TRANSCRIPT_DIRECTIVE_AREA = 'transcript.directives'
export const STATUSBAR_AREAS = { left: 'statusBar.left', right: 'statusBar.right' }
export const ListRow = (p) => {
  const h = window.React && window.React.createElement
  return h('div', { style: { padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.07)' } },
    h('div', { style: { fontSize: 14, fontWeight: 600, color: 'var(--ui-text-primary)' } }, p.title || p.label),
    p.description ? h('div', { style: { fontSize: 13, color: 'var(--ui-text-tertiary)', marginTop: 2 } }, p.description) : null,
    p.action ? h('div', { style: { marginTop: 6 } }, p.action) : null)
}
export const ToggleRow = ListRow
export const SegmentedControl = (p) => {
  const h = window.React && window.React.createElement
  return h('div', { style: { display: 'flex', gap: 6 } },
    (p.items || []).map((it) => h('button', {
      key: it.value, type: 'button',
      onClick: () => p.onChange && p.onChange(it.value),
      style: { minHeight: 30, padding: '0 10px', borderRadius: 8, cursor: 'pointer',
               border: '1px solid rgba(255,255,255,.12)',
               background: p.value === it.value ? 'rgba(255,255,255,.14)' : 'transparent',
               color: 'var(--ui-text-primary)', fontSize: 13 }
    }, it.label)))
}
export const host = {
  notify: (n) => console.log('[notify]', n && n.message),
  navigate: (p) => console.log('[navigate]', p),
  openLink: (u) => console.log('[open]', u),
  request: async () => ({}),
  composer: { setDraft: async () => true, focus: () => {} }
}
