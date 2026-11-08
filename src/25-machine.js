/* ------------------------------------------------------------- state machines
 *
 * The app's de-facto state machines, made explicit. Before this module the
 * same invariants were enforced by convention across scattered useState
 * setters — legal-looking calls could produce impossible screens (a "view"
 * tab with no artifact, two modal dialogs stacked, a peek tab with no
 * source). Each machine below is a pure transition table: state + event →
 * next state (return null/undefined to reject the event). React binds them
 * with useReducer in 30-shell.js; nothing here touches the DOM, so the
 * tables are unit-testable in plain node (tests/machine.test.mjs).
 *
 * ATLAS — every implicit machine found in the app, and its disposition:
 *
 *   M1  center view      tab{chat,view,peek} × picked artifact × peeked
 *                        source — three useStates that had to agree.
 *                        → VIEW_FSM (migrated; was the spine, most drift risk)
 *   M2  overlays         srcDialog / newNb / renNb / searchOpen — four
 *                        independent dialog flags, no exclusivity.
 *                        → OVERLAY_FSM (migrated; fixes latent stacked modals)
 *   M3  chat thread      thread/msgs/pending + overview{idle,loading,ready,
 *                        error} + suggestions lifecycle — component-local,
 *                        consistent today; migrate if it grows transitions.
 *   M4  generation       busy{kind→startedAt} per studio card + reload
 *                        polling — implicit but single-direction.
 *   M5  add-source dlg   mode{url,text,find,note} × cands/sel/adding/added —
 *                        nested machine inside one dialog; self-contained.
 *   M6  audio player     playing/t/dur/rate × editing/draft/rendering —
 *                        viewer-local, orthogonal substates.
 *   M7  ops panels       per-panel state{idle,busy,done,error} — repeated
 *                        shape, already honest about failures.
 *   M8  viewer chrome    zoom/pan, slide index, quiz index, table sort —
 *                        pure UI state, no cross-component invariants.
 *
 * Decision: migrate only the spine (M1+M2) where illegal combinations were
 * representable and transitions were copy-pasted. The rest are local,
 * consistent, and cheap — the pattern is here when they need it.
 */

/* createMachine(spec) → { initial, step(state, event) }
 * spec.transitions[event.type] is (state, event) => nextState | null.
 * Returning null/undefined rejects the event: state passes through
 * unchanged, so guards live inside the table where they can be read. */
export function createMachine(spec) {
  return {
    initial: spec.initial,
    step(state, event) {
      const fn = spec.transitions[event && event.type]
      if (!fn) return state
      const next = fn(state, event)
      return next == null ? state : next
    }
  }
}

/* M1 — center view. `tab` is the visible pane; `artifact` and `source` are
 * per-room selections that persist while another tab is showing (switching
 * Chat → Viewer → Chat must not lose the open artifact). Illegal combos
 * self-heal: clearing the selection under its own tab falls back to chat,
 * and tab switches are guarded by the selection they require. */
export const VIEW_FSM = createMachine({
  initial: { tab: 'chat', artifact: null, source: null },
  transitions: {
    TAB_CHAT: (s) => ({ ...s, tab: 'chat' }),
    TAB_VIEW: (s) => (s.artifact ? { ...s, tab: 'view' } : s),
    TAB_PEEK: (s) => (s.source ? { ...s, tab: 'peek' } : s),
    OPEN_ARTIFACT: (s, e) => ({ tab: 'view', artifact: e.artifact, source: s.source }),
    OPEN_SOURCE: (s, e) => ({ tab: 'peek', artifact: s.artifact, source: e.source }),
    STEP_ARTIFACT: (s, e) => ({
      ...s, artifact: e.artifact,
      tab: s.tab === 'view' && !e.artifact ? 'chat' : s.tab
    }),
    STEP_SOURCE: (s, e) => ({
      ...s, source: e.source,
      tab: s.tab === 'peek' && !e.source ? 'chat' : s.tab
    }),
    RESET_VIEW: () => ({ tab: 'chat', artifact: null, source: null })
  }
})

/* M2 — modal overlays. Exactly one dialog may exist at a time, enforced by
 * construction: every OPEN_* replaces the whole overlay state. OPEN_SEARCH
 * is the exception — it is a passive global shortcut (Ctrl+K), so it is
 * guarded to 'none' rather than allowed to silently discard a half-typed
 * add-source draft. CLOSE always wins. */
export const OVERLAY_FSM = createMachine({
  initial: { name: 'none' },
  transitions: {
    OPEN_ADDSRC: (s, e) => ({ name: 'addsrc', mode: e.mode, seed: e.seed }),
    OPEN_NEWNB: () => ({ name: 'newnb' }),
    OPEN_RENAME: (s, e) => ({ name: 'rename', notebook: e.notebook }),
    OPEN_SEARCH: (s) => (s.name === 'none' ? { name: 'search' } : s),
    CLOSE: () => ({ name: 'none' })
  }
})
