# Hermes Web Harness (HWH)

**One command, one port, one volume.** A web-first harness that runs Hermes agents
server-side with bb's orchestration shape: **project → environment (git worktree) →
thread → task**. The browser posts a message; the server owns the run, writes a
`seq`-numbered event log, and survives reloads, reconnects and restarts.

- Design: **[HWH-DESIGN.md](./HWH-DESIGN.md)** · Deploy: **[HWH-DEPLOY.md](./HWH-DEPLOY.md)**
- Status: **v0.2.0 — P0/P1 done, P3's Computer pane shipped** (per-environment files +
  an env-scoped PTY over the same WS). P2/P4 remainder and the plugin runtime are still
  not built; see [Limits](#limits).

```bash
# local
uv venv -p 3.11 .venv && . .venv/bin/activate
uv pip install -e ".[dev]"
hwh doctor          # honest checklist: auth, db, git, runtime, disk
hwh demo            # scratch repo + worktree + thread + real runs (mock runtime)
hwh serve           # prints the one-time login URL

# container
cp .env.example .env
docker compose up -d --build
docker compose logs hwh | head -8     # prints the login URL
```

`hwh demo` is free: it uses the **mock runtime**, which is clearly labelled in the UI
and in every assistant message it writes. Point `HWH_RUNTIME=hermes` at a real CLI
when you want actual agent turns.

## What works today

| Area | State |
|---|---|
| Daemon: FastAPI + asyncio, SQLite (WAL) state, append-only events | ✅ |
| Runs owned by the server: queue per thread, global concurrency cap, turn timeout | ✅ |
| Streaming: WebSocket fan-out + `since` replay (deltas ephemeral, messages durable) | ✅ |
| Environments: real `git worktree add` per thread, branch `hwh/<project>-<id>` | ✅ |
| Threads: send, interrupt, retry, archive, rename, spawn child, transcript replay | ✅ |
| Approvals: route-typed, closed decision set, blocks the run, audited both sides | ✅ |
| Tasks: board + dispatch (task → thread → run), assignment recorded | ✅ |
| Auth: token / password / proxy / none, HttpOnly cookie, origin check, CSP | ✅ |
| UI: four destinations, inline cards, 320px inspector, mobile single column | ✅ |
| Computer pane: per-env file browser + download, widened inspector | ✅ |
| Terminal: env-scoped PTY over WS, resize, exit codes, replay by `offset`, idle reaping | ✅ |
| `hwh doctor`, crash recovery (orphaned runs → retry card), audit trail | ✅ |
| Plugin runtime, desktop bridge, cron, fleet | ⛔ not built |
| Per-environment Hermes profiles (the §10.1 spike) | ⛔ not built |
| `hermes serve` JSON-RPC session continuity | ⛔ CLI mode is one-shot per turn |

## Layout

```
hwh/
  cli.py             serve · doctor · demo · init · token
  config.py          one YAML file, HWH_* env wins, unsafe combos refuse to boot
  gitops.py          clone, worktree add/remove, branches, commits
  orchestrator/
    db.py            schema v1, forward-only migrations, one serialized writer
    events.py        append (durable) · publish_ephemeral (deltas) · replay
    hub.py           in-process fan-out, per-thread + global subscribers
    supervisor.py    run queue, approvals, restart recovery, failure cards
    terminals.py     env-scoped PTYs: registry, output ring, offsets, idle reaper
  runtimes/
    base.py          Runtime contract, RunContext, RuntimeFailure
    mock.py          deterministic runtime (tests, demo, doctor) — no model spend
    hermes_cli.py    Mode A: `hermes -z`, line deltas, stderr → failure hint
  server/
    app.py           app factory, static shell, error contract
    gate.py          security headers, origin check, session auth (HTTP + WS)
    auth.py          token/password/proxy modes, HMAC cookie, login page
    routes/          system · projects · threads · tasks · approvals · terminals · ws
  ui/                index.html + app.js + terminal.js + theme.css (no build step)
tests/               106 tests: store, gate, runs, approvals, worktrees, WS, PTY, adapter
```

## API sketch

```text
GET  /healthz                          public, honest (db, runtime, uptime)
GET  /api/bootstrap                    home, counts, needs-you inbox
GET  /api/threads/:id/events?since=    durable replay, any seq
WS   /api/ws?thread_id=&since=         backlog + live stream
POST /api/threads/:id/messages         → 202 {run_id}  (queued, never interrupts)
POST /api/threads/:id/interrupt          → {interrupted:[…], cancel_requested:[…]}
POST /api/approvals/:id/decide         allowed-once | rejected | cancelled | unavailable
POST /api/environments                 kind=worktree|checkout, preset, ref
GET  /api/environments/:id/files|file|tree
POST /api/terminals                    {environment_id, cols, rows} → 201 {terminal, ws}
GET  /api/terminals?environment_id=     list (enabled, shell, terminals)
GET  /api/terminals/:id?offset=         snapshot + output since an offset
WS   /api/terminals/:id/ws?offset=      live PTY: output frames, exit frame, input/resize
POST /api/tasks/:id/dispatch           task → thread → run
```

Errors are always `{"ok": false, "error": {code, message, hint}}` — the `hint` names
the next call or the fix, never a stack trace.

Interrupt is cooperative: a queued run transitions immediately, a running run gets a
cancel request and **the worker owns its terminal state**, so a thread never reports
`idle` while a run is still in flight (regression-tested).

## Tests

```bash
. .venv/bin/activate
python -m pytest -q          # 106 passed
ruff check hwh tests         # clean
```

The suite runs offline: mock runtime, temp git repos, ASGI transport. The Hermes
adapter is tested against a stand-in `hermes` binary that speaks the same contract
(streams stdout, exits non-zero with stderr), so no model spend is required.

## Security posture

- Closed by default: every path needs a session except `/healthz`, `/login`, `/ui/*`.
- `HWH_AUTH=none` is refused when the bind is not loopback.
- Cookie: `HttpOnly`, `SameSite=Lax`, `Secure` when the public URL is https.
- Unsafe methods and WebSocket upgrades check `Origin` against `Host`.
- CSP `default-src 'self'`, `frame-ancestors 'none'`, plus nosniff / no-referrer.
- Approvals are paths with a fixed decision set; both the ask and the answer are audited.
- The daemon never shells out with a model-supplied string: it runs one command
  (`hermes -z …`) with a fixed argv.
- Terminals are **never a host shell**: `cwd` is pinned to the environment, `HWH_*` is
  stripped from the child env, the `read-only` preset refuses one, opens and closes are
  audited, the count is capped, and an unwatched shell is reaped after `HWH_PTY_IDLE`.

## Limits

- **Mode A is one-shot per turn.** `hermes -z` starts a fresh session each message, so
  the adapter supplies a bounded transcript prefix (12 messages / 12k chars by default)
  instead of native session continuity. That is a documented trade, not a bug.
- **Presets are recorded, not enforced** (`enforcement: partial`). One-shot mode
  bypasses Hermes' own approval gates; HWH's approval surface therefore only fires for
  runtimes that ask (the mock does, to prove the path).
- **The terminal is deliberately small.** It is a real PTY (`pty.fork`, so Ctrl-C, job
  control and `stty size` behave), rendered by a line-model VT in `ui/terminal.js`:
  cursor moves, erase/insert/delete and wraps are honoured; colour, alt-screen and mouse
  reporting are dropped. Good for `git`, `ls`, builds, `pytest`; not a pixel-exact
  xterm — the UI only loads assets from its own origin (CSP `default-src 'self'`).
- **No whole-home shell.** Terminals are environment-scoped by construction; there is no
  host terminal, and `HWH_PTY=off` removes the surface entirely.
- Carried from the design: don't over-promise plugin compatibility.

## License

MIT.
