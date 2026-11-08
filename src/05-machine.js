/* ------------------------------------------------------------ state machines
 *
 * The page has always known what it is doing only by inference: five booleans
 * named `busy`, a `pending` object that carries its own clock, `ov`/`ovErr`/
 * `ovRetry` where one failure is expressed as three variables. That inference is
 * where the impossible states live — "searching but no query", "creating while
 * idle", a spinner that cannot be dismissed after the backend gives up.
 *
 * One machine per concern, declared as data:
 *
 *   const turn = Machine('turn', {
 *     initial: 'idle',
 *     states: {
 *       idle:    { on: { ASK: 'asking' } },
 *       asking:  { tags: ['busy'], on: { ANSWER: 'idle', FAIL: 'failed', CANCEL: 'idle' },
 *                  enter: (ctx) => { const t = setInterval(...); return () => clearInterval(t) } },
 *       failed:  { on: { ASK: 'asking', DISMISS: 'idle' } }
 *     }
 *   })
 *
 * Why this shape, and not a library:
 *
 * - **UX** — a component reads one state and a derived flag (`tags`), so it cannot
 *   render searching-with-no-query. `enter` returns its own cleanup, so timers and
 *   listeners cannot outlive the state that needed them.
 * - **DX** — the transition table *is* the documentation. An illegal event is
 *   refused and recorded (with the state it arrived in) instead of silently
 *   corrupting a boolean. `machine.can('ASK')` is the disabled predicate.
 * - **AX** — every machine registers itself, and the whole fleet is readable from
 *   the DOM (`data-machines`) and from `window.__nbMachines()`. An agent that wants
 *   to know why a button is disabled asks the page, instead of screenshotting it.
 */

const MACHINES = new Map()
const MACHINE_LOG_MAX = 24

const machineWarn = (msg, extra) => {
  try { console.warn(`[machine] ${msg}`, extra === undefined ? '' : extra) } catch (e) { /* no console */ }
}

/** Publish the fleet for agents: `{"turn":"asking","jobs":{"mind_map":"running"}}`. */
const publishMachines = () => {
  try {
    const out = {}
    MACHINES.forEach((m, name) => {
      const cut = name.indexOf(':')
      if (cut > 0) {
        const group = name.slice(0, cut)
        const leaf = name.slice(cut + 1)
        if (!out[group] || typeof out[group] !== 'object') out[group] = {}
        out[group][leaf] = m.state
      } else { out[name] = m.state }
    })
    if (typeof document !== 'undefined' && document.body) {
      document.body.setAttribute('data-machines', JSON.stringify(out))
    }
  } catch (e) { /* not attached yet */ }
}

/**
 * Create a machine. `spec.states[state]` may declare:
 *   on:    { EVENT: 'nextState' | { target, guard, action } }
 *   enter: (ctx, machine) => cleanup   — runs on entry, cleanup on exit
 *   tags:  ['busy']                    — derived booleans the UI may read
 *   final: true                        — nothing may leave it (END still allowed)
 */
function Machine(name, spec) {
  const states = spec.states || {}
  const initial = spec.initial || Object.keys(states)[0]
  if (!states[initial]) throw new Error(`machine ${name}: initial state "${initial}" is not declared`)

  let state = initial
  let ctx = Object.assign({}, spec.context || {})
  let cleanup = null
  const subs = new Set()
  const log = []

  const record = (entry) => {
    log.push(entry)
    if (log.length > MACHINE_LOG_MAX) log.shift()
  }

  const transitionFor = (from, event) => {
    const node = states[from] || {}
    const raw = (node.on || {})[event]
    if (!raw) return null
    return typeof raw === 'string' ? { target: raw } : raw
  }

  const machine = {
    name,
    get state() { return state },
    get ctx() { return ctx },
    /** Derived booleans for the current state — what the UI is allowed to ask. */
    get tags() { return (states[state] || {}).tags || [] },
    tag(t) { return ((states[state] || {}).tags || []).indexOf(t) >= 0 },
    matches() { return Array.prototype.slice.call(arguments).indexOf(state) >= 0 },
    can(event) { return !!transitionFor(state, event) },
    /** Every event that would move the machine right now — the AX/DX surface. */
    available() {
      const node = states[state] || {}
      return Object.keys(node.on || {}).filter((ev) => {
        const t = transitionFor(state, ev)
        return !!t && (!t.guard || !!t.guard(ctx))
      })
    },
    send(event, payload) {
      const t = transitionFor(state, event)
      if (!t) {
        // refused, never thrown: a late response after CANCEL is normal, and a
        // page must not die for it. The refusal is recorded so a person can see it.
        record({ at: Date.now(), event, from: state, to: null, payload: undefined })
        machineWarn(`${name}: "${event}" not allowed in "${state}"`)
        return false
      }
      if (t.guard && !t.guard(ctx, payload)) {
        record({ at: Date.now(), event, from: state, to: null, refused: 'guard' })
        return false
      }
      const from = state
      if (cleanup) { try { cleanup() } catch (e) { machineWarn(`${name}: exit cleanup threw`, e) } cleanup = null }
      // state moves BEFORE the action runs: an action is allowed to send a
      // follow-up event (a lane finishing can drain the queue), and that nested
      // send must see the machine in its new state, not the old one
      state = t.target
      if (typeof t.action === 'function') {
        try { const patch = t.action(ctx, payload, machine); if (patch && typeof patch === 'object') Object.assign(ctx, patch) }
        catch (e) { machineWarn(`${name}: action for ${event} threw`, e) }
      }
      record({ at: Date.now(), event, from, to: state })
      const node = states[state] || {}
      if (typeof node.enter === 'function') {
        try { cleanup = node.enter(ctx, machine) || null }
        catch (e) { machineWarn(`${name}: enter ${state} threw`, e) }
      }
      publishMachines()
      subs.forEach((fn) => { try { fn(machine) } catch (e) { machineWarn(`${name}: subscriber threw`, e) } })
      return true
    },
    /** Replace context without a transition (a clock tick, a payload refresh). */
    set(patch) {
      if (!patch) return
      Object.assign(ctx, patch)
      subs.forEach((fn) => { try { fn(machine) } catch (e) { /* swallowed above */ } })
    },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn) },
    /** Drop a per-instance machine from the fleet (component unmount). */
    dispose() {
      if (cleanup) { try { cleanup() } catch (e) { /* already gone */ } cleanup = null }
      subs.clear()
      MACHINES.delete(name)
      publishMachines()
    },
    /** For people and agents: what happened, in order, without a debugger. */
    history() { return log.slice() },
    snapshot() {
      return {
        state,
        tags: machine.tags,
        available: machine.available(),
        ctx: JSON.parse(JSON.stringify(ctx, (k, v) => (typeof v === 'function' ? '[fn]' : v))),
        recent: log.slice(-6)
      }
    }
  }

  const node = states[initial] || {}
  if (typeof node.enter === 'function') {
    try { cleanup = node.enter(ctx, machine) || null } catch (e) { machineWarn(`${name}: enter ${initial} threw`, e) }
  }
  MACHINES.set(name, machine)
  publishMachines()
  return machine
}

/** The fleet, for `window.__nbMachines()` and the gates. */
const machineFleet = () => {
  const out = {}
  MACHINES.forEach((m, name) => { out[name] = m.snapshot() })
  return out
}

/** React binding: re-render on transition, return the machine itself. */
function useMachine(m) {
  const [, bump] = useState(0)
  useEffect(() => {
    const off = m.subscribe(() => bump((n) => n + 1))
    return () => { off() }
  }, [m])
  return m
}

if (typeof window !== 'undefined') {
  window.__nbMachines = machineFleet
  window.__nbMachine = (name) => (MACHINES.get(name) || null)
}

/* ---------------------------------------------------------------- the fleet
 * Small, single-purpose machines, declared where their concern lives. This map
 * only records what each one is for, so the docs and the gates agree.
 */
const MACHINE_DOCS = {
  studio: 'one /state fetch: loading → ready | error, and reload while ready',
  jobs: 'artifact generation, one lane per kind: idle → running → done | failed',
  turn: 'one chat question: idle → asking → (answered) idle | failed, cancellable',
  overview: 'the notebook opener text: idle → loading → ready | failed (retry)',
  search: 'passage search: closed → typing → searching → results | error',
  discover: 'source discovery: idle → searching → results | error, per-candidate add',
  player: 'audio/video playback: idle → loading → playing → paused | ended | error',
  dialogs: 'at most one modal surface: closed → newNotebook | settings | addSource | discover'
}
