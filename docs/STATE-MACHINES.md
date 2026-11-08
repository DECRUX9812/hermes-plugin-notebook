# State machines

The page used to know what it was doing only by inference. Twelve state machines now
say it outright, because "which booleans are true" is a question nobody can answer
at 2am — not the person using the app, not the person maintaining it, and not an
agent driving it.

## The runtime (`src/05-machine.js`, 260 lines, no dependencies)

```js
const TURN = Machine('turn', {
  initial: 'idle',
  context: { q: '', since: 0 },
  states: {
    idle:   { on: { ASK: { target: 'asking', guard: (c, p) => !!p.q,
                           action: (c, p) => ({ q: p.q, since: Date.now() }) } } },
    asking: { tags: ['busy'],
              enter: () => { const t = setInterval(tick, 500); return () => clearInterval(t) },
              on: { ANSWER: 'idle', FAIL: 'failed', CANCEL: 'idle' } },
    failed: { on: { ASK: 'asking', DISMISS: 'idle' } }
  }
})
```

| concept | why it exists |
|---|---|
| `state` | one string. A component reads it, it cannot disagree with itself. |
| `tags` | derived booleans (`busy`, `stale`) attached to a state, so the UI never invents `if (a && !b)`. |
| `guard` | a transition that must not happen (a late answer after CANCEL, a second run of a job already running). |
| `action` | context patch applied *after* the state moves, so an action may `send()` a follow-up event. |
| `enter` | runs on entry and returns its own cleanup. Timers and in-flight requests cannot outlive the state that needed them. |
| `can(event)` | the disabled predicate. |
| `available()` | every event that would move the machine right now. |
| `history()` | the last 24 transitions, including the refused ones. |
| `dispose()` | per-instance machines leave the fleet on unmount. |

An event that does not belong to the current state is **refused, not thrown** — a late
reply after CANCEL is normal traffic, not a crash. The refusal is recorded with the
state it arrived in, so the reason a click did nothing is on the record.

## The fleet

| machine | replaces | states |
|---|---|---|
| `studio` | `data` + `error` + `loading` (three variables that could disagree) | `loading → ready \| error`, `refreshing` for a silent reload |
| `jobs` | the `busy` map mutated in four places | `idle → active` (one lane per artifact kind) |
| `turn` | `pending` object carrying its own clock | `idle → asking → idle \| failed`, cancellable |
| `overview` | `ov` + `ovErr` | `idle → loading → ready \| empty \| failed` |
| `suggest` | `sugg` + `suggErr` | `idle → loading → ready \| failed` |
| `search` | `busy` + `hits` + `err` + a debounce effect | `closed → idle → typing → searching → results \| error` |
| `discover` | `busy` covering both scouting and ingesting | `idle → searching → results \| error` |
| `ingest` | (same `busy`) | `idle → adding → idle \| failed` |
| `player` | `playing` boolean mirrored from the media element | `idle → loading → playing ⇄ paused → ended \| error` |
| `revoice` | `rendering` + `renderErr` | `idle → rendering → idle \| failed` |
| `dialogs` | four independent modal booleans | `closed ⇄ open` (payload names the surface) |
| `study` | a `busy` + `revealed` + `idx` trio around a study session | `idle → loading → reviewing ⇄ revealed → saving → reviewing \| done` |

### Bugs these removals actually fixed

- **Two modals could be open at once** (search over settings), and Escape closed
  whichever effect ran last. `dialogs` owns the surface; a *stale* close from the
  dismissed modal cannot dismiss the one just opened — that case has a gate.
- **A second click on a studio card while its run was in flight** fired a second
  `/generate`. `jobs` refuses a lane that is already running.
- **A slow `/state` reply for the previous notebook** could land on the new one.
  Refreshes carry a generation; only the newest generation may settle a load.
- **A stuck chat spinner** could not be dismissed. `turn` has CANCEL, and the late
  answer is refused instead of appending to a conversation the person walked away from.
- **"searching…" showed while a query was too short to search.** The machine has no
  state for that; it returns to `idle` on `SHORT`.
- **Discovery's button said "searching" while it was ingesting.** Two machines now,
  `discover` and `ingest`.

## Agent experience (AX)

The fleet is a product surface, readable without a screenshot:

```js
window.__nbMachines()      // { studio: { state, tags, available, ctx, recent }, … }
window.__nbMachine('turn') // one machine: state, can(), available(), history()
document.body.dataset.machines  // {"turn":"idle","jobs":"idle","dialogs":"closed",…}
```

`available` is the list of events that would actually work — an agent that wants to
know why a control is disabled reads it instead of guessing at the DOM. The gates
(`node tests/gates.mjs machines`) exercise the fleet through that same window API,
so the agent surface cannot rot separately from the app.

## Deliberately not migrated (and why)

| candidate | why it stays as it is |
|---|---|
| `picked` / `tab` (viewer selection) | a routing concern, not a lifecycle: it is a value, and putting it behind a machine would add a layer without removing a race. |
| add-source dialog form fields | plain form state; a machine would only rename `useState`. |
| per-message streaming | the backend answers in one piece (`/ask` returns when the answer is complete); there is no stream to model. If streaming lands, it becomes `turn: asking → streaming → done`, and the machine is already the place for it. |

## Rules for the next one

1. If two writes to the same concern can race, it is a machine — not a boolean.
2. If two variables must agree (`error` + `loading`), it is a machine.
3. If a spinner can outlive its request, `enter` must return the cleanup.
4. If the page shows a control as disabled, `can()` must be the reason.
5. Do not add a machine for a value. Add one for a lifecycle.
