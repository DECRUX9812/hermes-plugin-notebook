/* -------------------------------------------------------------------- ops
 * The lab deck. Same shell as the studio, different subject: eight machines
 * measured over the audited ssh transport, with a terminal, service control, a
 * file browser and VM snapshots. Every number is what the host reported at
 * `measured_at`; a host that cannot be reached says so and offers no controls.
 */
const OPS_TABS = [
  { id: 'services', label: 'Services', icon: 'server' },
  { id: 'terminal', label: 'Terminal', icon: 'terminal' },
  { id: 'files', label: 'Files', icon: 'folder' },
  { id: 'snapshots', label: 'Snapshots', icon: 'camera' },
  { id: 'audit', label: 'Audit', icon: 'shield' }
]

function OpsDeck({ onSay, onStats }) {
  const [state, setState] = useState({ loading: true, hosts: [], error: '', measured_at: '' })
  const [sel, setSel] = useState('local')
  const [tab, setTab] = useState('services')

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }))
    try {
      const out = await api('/ops/fleet', { timeoutMs: 120000 })
      setState({ loading: false, hosts: out.hosts || [], error: '', measured_at: out.measured_at || '' })
    } catch (e) {
      setState({ loading: false, hosts: [], error: e.message || String(e), measured_at: '' })
    }
  }, [])

  useEffect(() => { load() }, [load])

  const hosts = state.hosts
  useEffect(() => {
    if (onStats && hosts.length) {
      onStats({
        hosts: hosts.length,
        patched: hosts.filter((h) => h.patch_state === 'patched').length,
        exposed: hosts.filter((h) => h.patch_state === 'vulnerable').length,
        down: hosts.filter((h) => h.reachable === false).length,
        measured_at: state.measured_at
      })
    }
  }, [hosts, onStats, state.measured_at])
  const host = hosts.find((h) => h.id === sel) || hosts[0] || null
  useEffect(() => { if (hosts.length && !hosts.some((h) => h.id === sel)) setSel(hosts[0].id) }, [hosts, sel])

  const patched = hosts.filter((h) => h.patch_state === 'patched').length
  const vulnerable = hosts.filter((h) => h.patch_state === 'vulnerable').length
  const down = hosts.filter((h) => h.reachable === false).length

  return el('div', {
    className: 'nb-body', role: 'main', 'aria-label': 'Lab operations',
    style: {
      gridTemplateColumns: '330px minmax(0,1fr)',
      background: 'transparent'
    }
  },
  el('aside', { className: 'nb-col', style: { borderRight: `1px solid ${T.line}`, background: `color-mix(in srgb, ${T.text} 2%, transparent)` } },
    el('div', { className: 'nb-pane-head' },
      el('span', { className: 'nb-meta', children: `Fleet · ${hosts.length}` }),
      jsx(IconBtn, { icon: 'refresh', label: 'Re-measure the fleet', onClick: load })),
    el('div', { className: 'nb-pad', style: { paddingBottom: '8px' } },
      state.error
        ? el('div', { style: { color: T.danger, fontSize: '13.5px', lineHeight: 1.5 }, children: state.error })
        : el('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } },
            jsx(Chip, { tone: 'ok', children: `${patched} patched` }),
            vulnerable ? jsx(Chip, { tone: 'warn', children: `${vulnerable} fix available` }) : null,
            down ? jsx(Chip, { tone: 'danger', children: `${down} unreachable` }) : null,
            state.loading ? jsx(Chip, { children: 'measuring…' }) : null)),
    el('div', { className: 'nb-scroll' },
      el('div', { className: 'nb-fleet', role: 'list' },
        hosts.map((h) => el('button', {
          key: h.id,
          type: 'button', className: 'nb-frow', role: 'listitem',
          'aria-current': host && h.id === host.id ? 'true' : 'false',
          onClick: () => setSel(h.id), title: h.error || `${h.name} · ${h.dial || ''}`
        },
        jsx('span', {
          className: 'nb-sdot',
          style: {
            background: h.reachable ? (h.patch_state === 'patched' ? T.ok : T.warn) : T.danger,
            boxShadow: h.reachable ? `0 0 6px ${h.patch_state === 'patched' ? T.ok : T.warn}` : 'none',
            margin: 0
          }
        }),
        el('span', { style: { minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' } },
          el('span', { style: { display: 'flex', alignItems: 'baseline', gap: '7px', minWidth: 0 } },
            jsx('span', { className: 'nb-fname', children: h.name }),
            jsx('span', { className: 'nb-frole', children: h.role })),
          jsx('span', {
            className: 'nb-mono',
            style: { fontSize: '11.5px', color: T.text4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
            children: h.reachable
              ? `${(h.kernel || '').replace(/-generic$/, '')} · ${Math.round((h.mem || {}).pct || 0)}% mem`
              : (h.error || 'no route').replace(/^ssh: /, '')
          })),
        jsx('span', {
          className: 'nb-chip',
          'data-tone': h.reachable ? (h.patch_state === 'patched' ? 'ok' : 'warn') : 'danger',
          children: h.reachable ? (h.patch_state === 'patched' ? 'patched' : 'fix avail') : 'no route'
        })
        )),
        !hosts.length && !state.loading
          ? el('div', { className: 'nb-hint', style: { padding: '12px' }, children: 'no hosts in the inventory' })
          : null
      )),
    el('div', { style: { borderTop: `1px solid ${T.lineSoft}`, padding: '10px 14px' } },
      el('div', { className: 'nb-hint', style: { lineHeight: 1.5 },
        children: state.measured_at ? `measured ${clock(state.measured_at)} · ssh, audited` : 'ssh · audited transport' }))
  ),

  el('section', { className: 'nb-col', 'aria-label': 'Selected host' },
    host
      ? jsx(HostView, { host, tab, setTab, onSay, key: host.id })
      : el('div', { className: 'nb-void' },
        el('div', null,
          el('h3', { children: state.loading ? 'Measuring the fleet' : 'No host selected' }),
          el('p', { children: state.loading
            ? 'Probing eight hosts over ssh — kernel, memory, disk, failed units, patch posture.'
            : 'Pick a machine on the left. Controls appear only for hosts that answer.' })))
  )
  )
}

function HostView({ host, tab, setTab, onSay }) {
  const ok = host.reachable
  return el('div', { className: 'nb-col', style: { minHeight: 0 } },
    el('div', { className: 'nb-main-head' },
      el('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
        el('h1', { className: 'nb-h1', children: host.name }),
        el('span', { className: 'nb-chip', children: host.role }),
        ok
          ? el('span', { className: 'nb-chip', 'data-tone': host.patch_state === 'patched' ? 'ok' : 'warn',
              children: host.patch_state === 'patched' ? 'kernel patched' : `upgrade to ${host.kernel_fix || 'fix'}` })
          : el('span', { className: 'nb-chip', 'data-tone': 'danger', children: 'unreachable' }),
        el('span', { style: { flex: 1 } }),
        el('span', { className: 'nb-mono', style: { fontSize: '12px', color: T.text4 }, children: host.dial || '' })),
      ok
        ? el('p', { className: 'nb-sub', children: `${host.os || ''} · kernel ${host.kernel || '?'} · up ${fmtUptime(host.uptime_s)} · ${host.cores || '?'} cores · load ${(host.load || []).map((n) => Number(n).toFixed(2)).join(' / ')}` })
        : el('p', { className: 'nb-sub', style: { color: T.danger }, children: host.error || 'this host did not answer' }),
      ok
        ? el('div', { className: 'nb-strip', role: 'group', 'aria-label': 'Host measurements' },
            el('div', { className: 'nb-cell' }, el('b', { children: `${Math.round((host.mem || {}).pct || 0)}%` }), el('span', { children: 'memory' })),
            el('div', { className: 'nb-cell' }, el('b', { children: `${Math.round((host.disk || {}).pct || 0)}%` }), el('span', { children: 'disk' })),
            el('div', { className: 'nb-cell' }, el('b', { children: host.containers_up || 0 }), el('span', { children: 'containers' })),
            el('div', { className: 'nb-cell' }, el('b', { style: { color: host.failed_units ? T.danger : T.ok }, children: host.failed_units || 0 }), el('span', { children: 'failed units' })),
            el('div', { className: 'nb-cell' }, el('b', { children: `${host.measured_ms || 0}ms` }), el('span', { children: 'probe' })))
        : null,
      el('div', { className: 'nb-tabs', role: 'tablist', 'aria-label': 'Host tools' },
        OPS_TABS.map((t) => el('button', {
          key: t.id, type: 'button', role: 'tab', className: 'nb-tab',
          'aria-selected': tab === t.id, onClick: () => setTab(t.id),
          disabled: !ok,
          children: [jsx(Glyph, { name: t.icon, size: 15 }), t.label]
        }, t.id)))
    ),
    ok
      ? (tab === 'services' ? jsx(ServicesTab, { host, onSay })
        : tab === 'terminal' ? jsx(TerminalTab, { host, onSay })
          : tab === 'files' ? jsx(FilesTab, { host })
            : tab === 'snapshots' ? jsx(SnapshotsTab, { host, onSay })
              : jsx(AuditTab, { onSay }))
      : el('div', { className: 'nb-void' },
        el('div', null,
          el('h3', { children: 'No route to this machine' }),
          el('p', { children: 'The probe failed, so there is nothing honest to show and no action to offer. Fixing reachability is the only next step.' })))
  )
}

const fmtUptime = (s) => {
  const v = Number(s) || 0
  const d = Math.floor(v / 86400)
  const h = Math.floor((v % 86400) / 3600)
  if (d) return `${d}d ${h}h`
  return `${h}h ${Math.floor((v % 3600) / 60)}m`
}

/* --------------------------------------------------------------- services */

function ServicesTab({ host, onSay }) {
  const [state, setState] = useState({ loading: true, units: [], failed: 0, error: '' })
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState('')
  const [result, setResult] = useState(null)

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }))
    try {
      const out = await api(`/ops/services?${qs({ host: host.id })}`, { timeoutMs: 45000 })
      setState({ loading: false, units: out.units || [], failed: out.failed || 0, error: '' })
    } catch (e) {
      setState({ loading: false, units: [], failed: 0, error: e.message || String(e) })
    }
  }, [host.id])
  useEffect(() => { load() }, [load])

  const op = async (unit, verb) => {
    setBusy(unit)
    setResult(null)
    try {
      const out = await api('/ops/service', {
        method: 'POST',
        body: { host: host.id, unit, op: verb, confirm: verb === 'stop' || verb === 'mask' ? unit : '' },
        timeoutMs: 60000
      })
      setResult({ unit, verb, ...(out.result || {}) })
      await load()
    } catch (e) {
      setResult({ unit, verb, ok: false, err: e.message || String(e) })
      if (onSay) onSay(`${verb} ${unit}: ${e.message || e}`)
    } finally { setBusy('') }
  }

  const units = state.units.filter((u) => !q.trim() || u.unit.toLowerCase().includes(q.toLowerCase()))

  return el('div', { className: 'nb-view' },
    el('div', { className: 'nb-view-head' },
      el('span', { className: 'nb-meta', children: `${state.units.length} units` }),
      state.failed ? el('span', { className: 'nb-chip', 'data-tone': 'danger', children: `${state.failed} failed` }) : null,
      el('span', { style: { flex: 1 } }),
      el('div', { style: { width: '220px' } },
        jsx(SearchField, { value: q, onChange: setQ, placeholder: 'Filter units', label: 'Filter systemd units' })),
      jsx(IconBtn, { icon: 'refresh', label: 'Reload units', onClick: load })),
    result
      ? el('div', { className: 'nb-pad', style: { borderBottom: `1px solid ${T.lineSoft}` } },
          el('div', { className: 'nb-mono', style: { fontSize: '12.5px', color: result.ok ? T.ok : T.danger, whiteSpace: 'pre-wrap' },
            children: `${result.verb} ${result.unit} → ${result.ok ? 'ok' : 'failed'} (exit ${result.code ?? '?'})\n${(result.out || result.err || '').trim().slice(0, 400)}` }))
      : null,
    el('div', { className: 'nb-scroll' },
      state.error
        ? el('div', { className: 'nb-pad', style: { color: T.danger }, children: state.error })
        : state.loading
          ? el('div', { className: 'nb-pad', children: el('span', { className: 'nb-hint', children: 'asking systemd…' }) })
          : el('div', { className: 'nb-pad', style: { display: 'flex', flexDirection: 'column', gap: '2px' } },
              units.slice(0, 120).map((u) => el('div', {
                key: u.unit,
                style: {
                  display: 'grid', gridTemplateColumns: '10px 1fr 84px 96px', gap: '10px',
                  alignItems: 'center', padding: '7px 8px', borderRadius: '8px',
                  borderTop: `1px solid ${T.lineSoft}`
                }
              },
              el('span', { className: 'nb-sdot', style: { margin: 0, background: u.failed ? T.danger : u.active === 'active' ? T.ok : T.text4 } }),
              el('span', { style: { minWidth: 0 } },
                el('span', { style: { display: 'block', fontSize: '14px', fontWeight: 550, color: T.text }, children: u.unit }),
                el('span', { style: { display: 'block', fontSize: '12.5px', color: T.text4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }, children: u.description })),
              el('span', { className: 'nb-chip', 'data-tone': u.failed ? 'danger' : u.active === 'active' ? 'ok' : undefined,
                children: u.active }),
              jsx(Btn, {
                size: 'sm', variant: 'ghost', disabled: busy === u.unit,
                onClick: () => op(u.unit, 'restart'),
                children: busy === u.unit ? '…' : 'Restart'
              })))
            ))
  )
}

/* --------------------------------------------------------------- terminal */

function TerminalTab({ host, onSay }) {
  const [lines, setLines] = useState([])
  const [cmd, setCmd] = useState('')
  const [busy, setBusy] = useState(false)
  const boxRef = useRef(null)
  useEffect(() => {
    const n = boxRef.current
    if (n) n.scrollTop = n.scrollHeight
  }, [lines.length])

  const run = async () => {
    const c = cmd.trim()
    if (!c || busy) return
    setBusy(true)
    setCmd('')
    setLines((l) => [...l, { kind: 'cmd', text: c, at: Date.now() }])
    try {
      const out = await api('/ops/exec', {
        method: 'POST', body: { host: host.id, cmd: c }, timeoutMs: 90000
      })
      const r = out.result || {}
      setLines((l) => [...l, {
        kind: 'out', ok: !!r.ok, code: r.code, ms: r.ms,
        text: (r.out || '') + (r.err ? `\n${r.err}` : ''), at: Date.now()
      }])
    } catch (e) {
      setLines((l) => [...l, { kind: 'out', ok: false, text: e.message || String(e), at: Date.now() }])
      if (onSay) onSay(e.message || 'exec failed')
    } finally { setBusy(false) }
  }

  return el('div', { className: 'nb-view' },
    el('div', { className: 'nb-view-body', style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
      el('div', { className: 'nb-term', ref: boxRef, role: 'log', 'aria-live': 'polite', 'aria-label': 'Command output' },
        lines.length === 0
          ? el('span', { style: { color: '#6f7488' }, children: `# ${host.name} — commands run over ssh, every call lands in the audit log\n# try: uptime; df -h / ; docker ps --format '{{.Names}}\\t{{.Status}}'` })
          : lines.map((l, i) => l.kind === 'cmd'
            ? el('div', { key: `c${i}`, style: { marginTop: i ? '10px' : 0, color: '#8fd4a8' }, children: `❯ ${l.text}` })
            : el('div', { key: `o${i}`, style: { color: l.ok ? '#d6d8e6' : '#ff8b8b', whiteSpace: 'pre-wrap' } },
                l.text || '(no output)',
                el('span', { style: { color: '#6f7488' }, children: `\n[exit ${l.code === undefined ? '?' : l.code}${l.ms ? ` · ${l.ms}ms` : ''}]` }))))
      ,
      el('div', { className: 'nb-term-in' },
        el('span', { className: 'nb-mono', style: { color: T.accent, fontSize: '14px' }, children: '❯' }),
        el('input', {
          value: cmd, onChange: (e) => setCmd(e.target.value), spellCheck: false,
          onKeyDown: (e) => { if (e.key === 'Enter') run() },
          placeholder: `run a command on ${host.name}`, 'aria-label': 'Command to run'
        }),
        jsx(Btn, { variant: 'primary', icon: 'bolt', onClick: run, disabled: busy || !cmd.trim(),
          children: busy ? 'Running…' : 'Run' })),
      el('div', { className: 'nb-hint', style: { lineHeight: 1.5 },
        children: 'Every command runs over ssh on that host. The output and exit code above are the real ones, and each call is appended to the audit log.' }))
  )
}

/* ------------------------------------------------------------------ files */

function FilesTab({ host }) {
  const [path, setPath] = useState('/home')
  const [state, setState] = useState({ loading: true, entries: [], parent: '/', error: '' })
  const [open, setOpen] = useState(null)

  const load = useCallback(async (p) => {
    setState((s) => ({ ...s, loading: true, error: '' }))
    try {
      const out = await api(`/ops/files?${qs({ host: host.id, path: p })}`, { timeoutMs: 45000 })
      setState({ loading: false, entries: out.entries || [], parent: out.parent || '/', error: '' })
      setPath(out.path || p)
    } catch (e) {
      setState({ loading: false, entries: [], parent: '/', error: e.message || String(e) })
    }
  }, [host.id])
  useEffect(() => { load(path) }, [load])

  const readFile = async (name) => {
    const full = path.endsWith('/') ? path + name : `${path}/${name}`
    try {
      const out = await api(`/ops/file?${qs({ host: host.id, path: full, bytes: 60000 })}`, { timeoutMs: 45000 })
      setOpen({ name, text: out.text || '', size: out.size, truncated: out.truncated })
    } catch (e) { setOpen({ name, text: e.message || String(e), error: true }) }
  }

  return el('div', { className: 'nb-view' },
    el('div', { className: 'nb-view-head' },
      jsx(IconBtn, { icon: 'arrowLeft', label: 'Parent directory', onClick: () => load(state.parent) }),
      el('div', { className: 'nb-field', style: { flex: 1, height: '32px' } },
        jsx(Glyph, { name: 'folder', size: 13 }),
        el('input', {
          value: path, onChange: (e) => setPath(e.target.value),
          onKeyDown: (e) => { if (e.key === 'Enter') load(path) },
          'aria-label': 'Directory path', spellCheck: false
        })),
      jsx(IconBtn, { icon: 'refresh', label: 'Reload directory', onClick: () => load(path) })),
    el('div', { className: 'nb-scroll' },
      state.error
        ? el('div', { className: 'nb-pad', style: { color: T.danger }, children: state.error })
        : el('div', { className: 'nb-pad' },
            el('div', { style: { display: 'flex', flexDirection: 'column', gap: '1px' } },
              state.entries.map((e) => el('button', {
                type: 'button',
                onClick: () => (e.dir ? load(path.endsWith('/') ? path + e.name : `${path}/${e.name}`) : readFile(e.name)),
                style: {
                  display: 'grid', gridTemplateColumns: '18px 1fr 76px 96px', gap: '10px',
                  alignItems: 'center', minHeight: '30px', padding: '4px 8px', borderRadius: '7px',
                  border: 0, background: 'transparent', color: T.text, cursor: 'pointer', textAlign: 'left',
                  fontSize: '14px'
                },
                children: [
                  el('span', { style: { color: e.dir ? T.accent : T.text4, display: 'grid', placeItems: 'center' } },
                    jsx(Glyph, { name: e.dir ? 'folder' : 'file', size: 13 })),
                  el('span', { style: { color: e.dir ? T.text : T.text2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }, children: e.name }),
                  el('span', { className: 'nb-mono', style: { fontSize: '11.5px', color: T.text4, textAlign: 'right' },
                    children: e.dir ? 'dir' : nfmt(e.size) }),
                  el('span', { className: 'nb-mono', style: { fontSize: '11.5px', color: T.text4, textAlign: 'right' },
                    children: e.mtime ? ago(new Date(e.mtime * 1000).toISOString()) : '' })
                ]
              }, e.name))))
    ),
    open
      ? el('div', { style: { borderTop: `1px solid ${T.line}`, padding: '12px 16px', maxHeight: '38%', overflow: 'auto' } },
          el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' } },
            el('span', { className: 'nb-chip', 'data-tone': open.error ? 'danger' : undefined, children: open.name }),
            open.size ? el('span', { className: 'nb-hint', children: `${nfmt(open.size)} bytes${open.truncated ? ' · truncated' : ''}` }) : null,
            el('span', { style: { flex: 1 } }),
            jsx(IconBtn, { icon: 'close', label: 'Close file', onClick: () => setOpen(null) })),
          el('pre', { className: 'nb-mono', style: { whiteSpace: 'pre-wrap', fontSize: '13px', lineHeight: 1.55, color: T.text2, margin: 0 },
            children: open.text }))
      : null
  )
}

/* -------------------------------------------------------------- snapshots */

function SnapshotsTab({ host, onSay }) {
  const [vmid, setVmid] = useState('100')
  const [state, setState] = useState({ loading: false, list: [], raw: '', error: '' })
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }))
    try {
      const out = await api(`/ops/snapshots?${qs({ host: host.id, vmid })}`, { timeoutMs: 60000 })
      setState({ loading: false, list: out.snapshots || [], raw: out.raw || '', error: out.ok ? '' : (out.raw || 'qm refused') })
    } catch (e) {
      setState({ loading: false, list: [], raw: '', error: e.message || String(e) })
    }
  }, [host.id, vmid])

  const create = async () => {
    setBusy(true)
    try {
      const out = await api('/ops/snapshot', { method: 'POST', body: { host: host.id, vmid, name }, timeoutMs: 200000 })
      if (onSay) onSay(`snapshot ${out.label} ${out.ok ? 'created' : 'failed'}`)
      await load()
    } catch (e) {
      if (onSay) onSay(e.message || 'snapshot failed')
      setState((s) => ({ ...s, error: e.message || String(e) }))
    } finally { setBusy(false) }
  }

  return el('div', { className: 'nb-view' },
    el('div', { className: 'nb-view-head' },
      el('span', { className: 'nb-meta', children: 'VMID' }),
      el('div', { className: 'nb-field', style: { width: '110px', height: '32px' } },
        el('input', { value: vmid, onChange: (e) => setVmid(e.target.value.replace(/\D/g, '')), 'aria-label': 'VM id' })),
      jsx(Btn, { size: 'sm', icon: 'refresh', onClick: load, children: 'List' }),
      el('div', { style: { flex: 1 } }),
      el('div', { className: 'nb-field', style: { width: '200px', height: '32px' } },
        el('input', { value: name, onChange: (e) => setName(e.target.value), placeholder: 'snapshot name', 'aria-label': 'Snapshot name' })),
      jsx(Btn, { size: 'sm', variant: 'primary', icon: 'camera', onClick: create, disabled: busy,
        children: busy ? 'Snapshotting…' : 'Create' })),
    el('div', { className: 'nb-scroll' },
      state.error
        ? el('div', { className: 'nb-pad', style: { color: T.danger, fontSize: '13.5px' }, children: state.error })
        : el('div', { className: 'nb-pad' },
            state.loading
              ? el('span', { className: 'nb-hint', children: 'asking qm…' })
              : state.list.length
                ? el('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
                    state.list.map((s) => el('div', {
                      key: s,
                      style: { display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', border: `1px solid ${T.lineSoft}`, borderRadius: '9px', background: T.card }
                    },
                    jsx(Glyph, { name: 'camera', size: 14 }),
                    el('span', { style: { fontSize: '14.5px', fontWeight: 560 }, children: s }),
                    el('span', { style: { flex: 1 } }),
                    el('span', { className: 'nb-chip', children: `vm ${vmid}` }))))
                : el('div', { className: 'nb-hint', children: 'no snapshots for this VM — name one above and create it' })),
            state.raw ? el('pre', { className: 'nb-mono', style: { marginTop: '12px', fontSize: '12px', color: T.text4, whiteSpace: 'pre-wrap' }, children: state.raw }) : null)
  )
}

/* ------------------------------------------------------------------ audit */

function AuditTab({ onSay }) {
  const [state, setState] = useState({ loading: true, entries: [], error: '' })
  const load = useCallback(async () => {
    try {
      const out = await api('/ops/audit?limit=40', { timeoutMs: 30000 })
      setState({ loading: false, entries: out.entries || [], error: '' })
    } catch (e) { setState({ loading: false, entries: [], error: e.message || String(e) }) }
  }, [])
  useEffect(() => { load() }, [load])
  return el('div', { className: 'nb-view' },
    el('div', { className: 'nb-view-head' },
      el('span', { className: 'nb-meta', children: 'Action log' }),
      el('span', { className: 'nb-chip', children: `${state.entries.length} entries` }),
      el('span', { style: { flex: 1 } }),
      jsx(IconBtn, { icon: 'refresh', label: 'Reload the audit log', onClick: load })),
    el('div', { className: 'nb-scroll' },
      state.error ? el('div', { className: 'nb-pad', style: { color: T.danger }, children: state.error })
        : el('div', { className: 'nb-pad', style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
            state.entries.map((e, i) => el('div', {
              key: `e${i}`,
              style: { border: `1px solid ${T.lineSoft}`, borderRadius: '9px', padding: '9px 11px', background: T.card }
            },
            el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } },
              el('span', { className: 'nb-chip', 'data-tone': e.ok ? 'ok' : 'danger', children: e.ok ? 'ok' : 'failed' }),
              el('span', { className: 'nb-chip', children: e.action }),
              el('span', { className: 'nb-chip', children: e.host }),
              el('span', { className: 'nb-mono', style: { fontSize: '11.5px', color: T.text4 }, children: e.at }),
              el('span', { style: { flex: 1 } }),
              el('span', { className: 'nb-mono', style: { fontSize: '11.5px', color: T.text4 }, children: `exit ${e.code ?? '?'} · ${e.ms || 0}ms` })),
            el('div', { className: 'nb-mono', style: { marginTop: '6px', fontSize: '12.5px', color: T.text2, whiteSpace: 'pre-wrap', maxHeight: '90px', overflow: 'hidden' },
              children: `$ ${e.cmd || e.target}\n${(e.out || e.err || '').slice(0, 500)}` })))))
  )
}
