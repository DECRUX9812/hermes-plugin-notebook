# Hermes Web Harness (HWH) — Design

**Status:** design, for review · **Task:** HWH-1 · **Date:** 2026-10-25
**One line:** a self-hostable, web-first harness that runs Hermes agents server-side, organized the way bb organizes work (project → environment → thread → task), deployed with one command behind one URL.

---

## 0. Read this first

- **What you get:** open `https://hwh.example.com` → a thread list, a transcript, a task board, a terminal. Runs keep going when you close the tab.
- **What it costs to ship:** P0 (web chat + compose deploy) ≈ 1 week; P1 (projects/threads/runs) ≈ 2 weeks; see §11.
- **What we do *not* do:** rebuild Hermes's agent core, copy bb's front end (1,804 files, not portable), or invent a new plugin model before we need one.
- **What it takes from bb:** the *shape* (projects, environments, threads, tasks, plugins, one attention surface) — ideas, MIT-licensed code only where it is small and pure (see §10).
- **Prior art this synthesizes:** `BB-PORT-PLAN.md`, `deepseek-harness-brief.md`, `hermes-ux-plan.md`, `/data/work/bb-study/*`, and the `hermes-desktop-plus` sidecar.

---

## 1. The gap (why this exists)

Three pieces already exist. None of them is the harness.

| Piece | What it is | What it is missing |
|---|---|---|
| **Hermes Agent** (Nous) | Agent core: skills, memory, cron, subagents, 6 terminal backends, TUI + gateway | No workspace/branch model in the product surface; no durable run ownership; web surface is a chat app |
| **Hermes Desktop Plus** (sidecar) | Web delivery: front-door auth, WS multiplexer, adapter + compat matrix, Docker | Single-user, single `HERMES_HOME`, **no orchestration layer** — sessions, not projects/threads/tasks |
| **bb (GetBB)** | Orchestration: project → environment (worktree) → thread → task → plugin, machines, connect, workflows | Desktop-first Electron + local daemon; 1,800-file front end tied to its own server; not designed to be a deployed web service |

**HWH = bb's orchestration shape + Hermes's agent runtime + Desktop Plus's web delivery.** That is the entire product thesis.

---

## 2. Principles (each traced to a source)

1. **Server-owned runs.** A turn survives tab close, reload, laptop sleep, HMR. The harness process owns the run; the browser only subscribes. *(hermes-ux-plan §"Make runs server-owned and resumable")*
2. **The conversation is the product.** Messages first; questions, approvals, background work, failures are **inline cards**, never agent speech. Errors are system rows, not things Hermes "says". *(hermes-ux-plan problems 2–3)*
3. **Subtract.** Four destinations, one "needs you" surface, one health dot, two composer controls. If a screen fails the squint test, it is a bug. *(hermes-ux-plan problems 1–4)*
4. **One front door.** Exactly one process listens. Hermes stays on loopback; the harness is the only reachable surface, and every route/WS needs the session credential. *(desktop-plus `docs/security.md`)*
5. **Fail-closed approvals.** Route-typed requests, a closed outcome set (`allowed-once | rejected | cancelled | unavailable`), policy enforced inside the service before any answerer runs, audit pair appended. *(deepseek-harness-brief §3)*
6. **Enforcement is a reported fact.** Sandbox mode `read-only | workspace-write | danger-full-access` carries `full | partial`; code that needs the absolute promise rejects `partial` instead of assuming. *(deepseek-harness-brief §4)*
7. **One port, one volume, zero required external services.** Postgres/Redis/S3 are optional growth, never a prerequisite. *(this task: "easy to deploy on web")*

---

## 3. Architecture

### 3.1 Process topology

```
                    HTTPS (one port, one origin)
Browser ──────────────────────────────────────────────► hwh-server  ← THE harness
  │  REST /api/*                                          ├─ static web UI (hashed assets)
  │  WS   /api/ws   (multiplexed, seq-resume)             ├─ auth (token | password | proxy SSO)
  │                                                       ├─ orchestrator: projects · environments
  │                                                       │    · threads · tasks · plugins
  │                                                       ├─ run supervisor: durable queue + workers
  │                                                       ├─ hwh.db (SQLite WAL, one volume)
  │                                                       └─ adapter  ── loopback only ──► Hermes runtime
  │                                                                                  (gateway / tui_gateway,
  │                                                                                   tools, skills, cron,
  │                                                                                   subagents, PTYs)
  └─ everything the browser does is a command; everything the agent does is a run.
```

**Non-negotiable:** the browser never drives a turn directly. It posts a command (`POST /threads/:id/messages`); the supervisor picks it up, runs it, and streams `seq`-numbered events back. Reload → `GET /threads/:id/events?since=<seq>` replays.

### 3.2 Two runtime modes (same contract)

| | **Mode A — sidecar over stock Hermes** | **Mode B — embedded runtime (default image)** |
|---|---|---|
| How | harness starts stock `hermes` as a loopback child, talks through the adapter | Docker image layers the harness on `nousresearch/hermes-agent`, one process tree |
| Hermes upgrade | `hermes update`, never touches us (Desktop Plus rule) | image tag pin, `HERMES_TAG` env |
| Compat | version matrix + capability probes, features gated on missing methods | same code path, pinned pair |
| Use when | a machine already runs Hermes | fresh deploy, VPS, CI |

Both are the same binary. Mode A is the contract; Mode B is the packaging. **Recommendation: build A first, ship B as the compose default** — it forces the adapter to stay honest, which is exactly what kept Desktop Plus alive across 0.22.0 → 0.22.2.

### 3.3 Request paths

- **Read:** `GET /api/...` → harness DB (projects, threads, tasks) or adapter (transcript, session list). Static UI from disk.
- **Write (user intent):** `POST /api/...` → validated → written to `hwh.db` → enqueued as a run/command → WS event broadcast.
- **Agent activity:** adapter events → event log (`append`) → WS broadcast → UI renders.
- **Long-lived PTY:** dedicated WS channel per terminal, scoped to an environment, never the host shell by default (§8.5).

---

## 4. Domain model

### 4.1 bb → HWH → Hermes mapping

| bb concept | HWH | Backed by |
|---|---|---|
| Project | **Project** — a repo (local path or remote + deploy key) | `hwh.db` |
| Environment (checkout / worktree) | **Environment** — cwd + git worktree + Hermes profile/home shard | Hermes `-w` worktree (`hermes_cli/_parser.py:187`) + `hermes_cli/cli_commands_worktree.py` |
| Thread | **Thread** — one agent conversation, `hwh thread id ↔ hermes session id` | Hermes session |
| Parent/child threads | **Thread lineage** — spawn, wait, tell | Hermes subagents + harness lineage rows |
| Provider / model | **Profile** — per-thread provider, model, limits | Hermes profiles (`hermes_cli/profiles.py`) |
| Terminal | **Terminal** — PTY scoped to an environment | Hermes host-terminal WS pattern (Desktop Plus) |
| Task + dispatch preset | **Task** + **Dispatch** — board + one-click "run this with agent X" | `hwh.db` (own board; do not overload Hermes kanban) |
| Plugin | **Harness plugin** (server route + UI slot + skill) *and* Hermes plugin passthrough | harness plugin SDK (§9) |
| Machine | **Runner** — a host that owns paths/worktrees | `hwh.db`; v1 = local only |
| Connect / public URL | **Share** — tunnel profile + share links | reverse proxy, Cloudflare profile |
| Focus Board / Automations | **Focus view** + **Schedules** | attention surface (§7) + Hermes cron passthrough |
| Workflows | **Pipelines** — deterministic multi-agent runs | phase P4 |

### 4.2 Storage — one SQLite file

`/data/hwh.db`, WAL mode, one file on one volume. Tables (v1):

```
projects(id, name, repo_url, local_path, default_branch, created_at)
environments(id, project_id, kind[checkout|worktree], path, branch, profile,
             status[ready|busy|broken], created_at)
threads(id, environment_id, parent_id, title, profile, model,
        status[idle|running|waiting_approval|failed|archived],
        last_seq, created_at, updated_at)
events(seq, thread_id, ts, type, payload_json)          -- append-only, replay source
runs(id, thread_id, kind[prompt|dispatch|cron], status, attempt, queued_at,
     started_at, finished_at, error)
tasks(id, project_id, title, body, status, priority, labels, assignee_thread_id, updated_at)
dispatches(id, task_id, preset, thread_id, created_at)
plugins(id, name, source, enabled, config_json, installed_at)
approvals(id, thread_id, tool, call_id, route, status, asked_at, decided_at, decided_by)
audit(id, ts, actor, action, target, outcome)           -- approval asked/decided pairs
```

**Why SQLite:** one volume, one backup file, no daemon to babysit. Move to Postgres only when a second host exists.

### 4.3 IDs

`hwh_` prefixed ULIDs for harness entities; Hermes session ids stored verbatim in `threads.hermes_session`. Never expose raw paths or hostnames to the client — the UI gets `environment.id`, the server resolves the path.

---

## 5. The run model (the part that usually breaks)

### 5.1 Durable runs

```
POST /api/threads/:id/messages  →  {run_id} 202
   └─ runs row: queued → running → done|failed|interrupted
        └─ events appended with monotonic seq per thread
```

- Worker: **one concurrent run per environment** (worktrees are the parallelism unit), N environments in flight, global cap from settings.
- Supervisor is in-process at P0, restartable at P1 (reconcile `running` rows on boot: older than lease → `interrupted`, offer **Retry** as a first-class card).
- Interrupt is a *server* command: `POST /threads/:id/interrupt`. The UI never kills anything itself.

### 5.2 Event log and resume

- Every WS subscription carries `since: seq`. Server replays missed events then streams live. Reconnect is idempotent.
- Event types (v1): `message.appended`, `tool.started|updated|done`, `run.queued|started|progress|finished|failed|interrupted`, `approval.requested|answered`, `question.asked`, `terminal.output`, `env.status`, `task.updated`, `health.changed`.
- Payload rule: **failures are events, not assistant text.** Nothing from `INTERRUPT_WAITING_FOR_MODEL_PREFIX` may ever reach the transcript (hermes-ux-plan problem 3) — the adapter strips it on ingest.

### 5.3 What the browser owns

Nothing durable. Local UI state only: open thread, expanded tool cards, scroll position, theme. On boot: `GET /api/bootstrap` (health, needs-you count, recent threads) → render. If the WS is down, the UI shows the health dot, not a broken transcript.

---

## 6. API contract (v1)

REST for commands, one WS for events. All under `/api`, all authenticated (§8).

```
GET    /api/bootstrap                      health + needs-you + recents (one round trip)
GET    /api/projects                       list
POST   /api/projects                       {name, repo_url | local_path}
GET    /api/projects/:id/environments
POST   /api/environments                   {project_id, kind, ref?}  → worktree + profile
DELETE /api/environments/:id               (refuse if runs are live)

GET    /api/threads?env=&status=&q=
POST   /api/threads                        {environment_id, title?, parent_id?, model?}
GET    /api/threads/:id                    header + counts
GET    /api/threads/:id/events?since=      replay
POST   /api/threads/:id/messages           {text, attachments[]}  → {run_id}
POST   /api/threads/:id/interrupt | /retry | /archive
POST   /api/threads/:id/spawn              {prompt, model?}  → child thread

GET    /api/tasks?status=&label=
POST   /api/tasks | PATCH /api/tasks/:id
POST   /api/tasks/:id/dispatch             {preset} → creates thread + run

GET    /api/approvals                      pending across all threads
POST   /api/approvals/:id/decide           {decision: allowed-once|rejected}

GET    /api/terminals?env=                 list
POST   /api/terminals                      {environment_id} → {id}
WS     /api/ws                             subscribe {scope, since} → events
WS     /api/terminals/:id/ws               raw PTY stream (env-scoped)
GET    /healthz                            version, hermes compat, db status  (public)
```

Error shape mirrors bb: `{"ok": false, "error": {code, message, hint}}` with a `hint` that names the flag/command to fix it. Long text goes through `--file`-style inputs, never inline truncation.

---

## 7. UI / information architecture

### 7.1 Four destinations (everything else is ⌘K)

```
Home        · one health dot, one "Needs you" list (approvals + questions + failed runs + dispatch results)
Threads     · grouped list (pinned / by project / custom sections) → thread view
Tasks       · board: backlog → todo → in progress → in review → done, with Dispatch buttons
Library     · files, artifacts, skills
[Settings]  · bottom of the rail: providers, models, plugins, appearance, danger zone
```

No status bar. Developer telemetry (versions, cache hit rate, tokens/s, "N behind upstream") lives in Settings → Diagnostics, behind a disclosure. *(hermes-ux-plan problem 4)*

### 7.2 Thread view

```
┌ thread header: title · env/branch chip · model chip · health dot · ⋯ ┐
├ transcript ────────────────────────────────────────────────────────┤
│  user message (right, compact)                                     │
│  assistant message (left, short)                                   │
│  ▸ tool card  (collapsed by default, shared chrome, expand → diff)  │
│  ▸ approval card (route, tool, Allow once / Reject)                 │
│  ▸ failure card (what failed, why, [Retry])          ← never speech │
│  ▸ run card (running 2m 14s · [Open computer])                      │
├ optional right pane: "Computer" = terminal + files for the env ─────┤
└ composer: [text] [attach] [model] [send]            ← two controls  ┘
```

- **Inline cards, one attention surface.** The same approval exists in exactly one place: Home → Needs you *and* inline in its thread (same row id, same decision).
- **Activity summaries** instead of raw tool spam: "Explored 14 files · searched 3 times · edited 2" (bb `timeline-view`, portable idea — §10).
- **Responsive:** ≤640px the rail becomes a drawer, the right pane becomes a sheet, one overlay primitive for every popover (bb `responsive-overlay` idea). Verified at 390px and 1280px on every screen before merge.

### 7.3 Visual system

Two-anchor theme tokens (`--canvas`, `--ink` → derived palette), light/dark/system, synchronous theme bootstrap after `<body>` (no FOUC), semantic aliases only — **no literal hex, no `text-[0.xxrem]`, no per-feature component library**. This is the one bb piece worth taking wholesale in spirit: 1,079 lines of theme.css that make a product look designed rather than accumulated.

---

## 8. Security model

### 8.1 Threat model

The product puts a shell in a browser tab. Assume: the credential leaks, the origin is on the public internet, a share link gets pasted somewhere.

### 8.2 Front door (inherit Desktop Plus rules verbatim)

- One listening process; Hermes on loopback as a child.
- Auth: `token` (default, one-time URL → HttpOnly `SameSite=Lax` cookie, `Secure` over https) | `password` (form, key at `/data/session.key` 0600, bound to password) | `none` **refused off-loopback** | proxy SSO with `--trust-proxy-headers`.
- **Origin check** on every unsafe method and every WS upgrade (host+port must match `Host`, honoring `X-Forwarded-Host`).
- Headers: `X-Frame-Options: DENY`, `CSP frame-ancestors 'none'`, `nosniff`, downloads `Content-Disposition: attachment`.
- Public-by-design paths only: `/healthz`, `/login`, share view (256-bit token, read-only, TTL, revocable), pairing code.
- Logs never carry a capability; access log off; sensitive query values redacted.

### 8.3 Approvals (route-typed, fail-closed)

```
ApprovalRequest { route: {agent, tool, call_id}, reason, ask_policy }
Outcome ∈ { allowed-once, rejected, cancelled, unavailable }   // closed set
```
- Missing/throwing answerer ⇒ `unavailable`, never an open gate.
- `never` policy is enforced **inside the service**, before any answerer chain.
- Every ask appends `approval/asked` + `approval/decided` to `audit` (log-only, never in the model transcript).

### 8.4 Permission presets (bundled knobs)

| Preset | Sandbox | Approval policy | Default for |
|---|---|---|---|
| `read-only` | read-only | ask | browsing/analysis threads |
| `balanced` | workspace-write | ask | **default** |
| `unrestricted` | danger-full-access | never | explicit opt-in, per-environment, warned |

Preset is stored on the environment, resolved **per call** from the run's canonical cwd, and the enforcement fact (`full|partial`) is surfaced in the thread header when `partial`.

### 8.5 Sharpest edges, default-off

- **Host terminal** (whole-home PTY): off whenever not loopback; env-scoped PTY is the default instead — shipped in v0.2.0 as `POST /api/terminals` + `WS /api/terminals/:id/ws`, never a host shell, `read-only` presets refused, opens/closes audited, unwatched shells reaped (`HWH_PTY_IDLE`).
- **Share links:** treat as public; read-only projection (text + tool *names*, never arguments/results).
- **Repo credentials:** deploy keys in `/data/secrets`, never in the DB dump, never in events.
- **Egress:** server-side `fetch` off by default; model-visible web tool uses search-only (deepseek-harness §2).

### 8.6 Roles (v1, deliberately small)

`operator` (everything) and `viewer` (read transcripts + boards, no commands, no terminals). One credential = operator, as today. Multi-tenancy is **out of scope** for v1 — say so in the README rather than pretending.

---

## 9. Plugins

Two layers, kept separate:

1. **Hermes plugins** — pass through untouched (skills, memory, cron providers, MCP). The harness does not fork this.
2. **Harness plugins** — extend the web product: a server route bundle, a UI slot, a skill, a CLI verb.

Contract (v1, small on purpose):

```jsonc
// hwh.plugin.json
{ "id": "focus-board", "name": "Focus Board", "version": "1.0.0",
  "slots": { "navPanel": "app.js", "attention": "attention.js" },
  "routes": "routes.py", "skills": ["skills/"], "commands": ["focus"] }
```

- **Per-slot crash isolation** and **replace-with-fallback**: a throwing plugin renders its fallback, never a white screen (bb plugin-surface idea, design only).
- Plugins are **full-trust** and say so at install (same honesty as bb). No in-process sandbox theatre.
- Install from a path/git/npm, one at a time as a background job with a visible progress row.

---

## 10. Build vs reuse

| | Verdict | Notes |
|---|---|---|
| Hermes agent core, skills, memory, cron, subagents, terminal backends | **reuse** | never fork |
| Desktop Plus patterns: auth, WS multiplexer, adapter + compat matrix, Docker layering, security doc | **reuse as design** | the deploy/security spine of HWH |
| bb **ideas**: project→env→thread→task shape, dispatch presets, thread grouping, command palette, activity summaries, two-anchor theme, plugin slot isolation | **reuse as ideas** | documented in `/data/work/bb-study/` |
| bb **code** (small, pure only): thread grouping model (~1,150 lines), onboarding model (207 lines), theme token generator, responsive drawer | **copy with MIT notice** in `NOTICE` | bb is MIT; keep per-file headers |
| bb **front end** (1,804 files, jotai + TanStack Query, `ThreadDetailView` 2,868 lines, thread-list plugin ~16k lines) | **do not copy** | different state stack; BB-PORT-PLAN §1 measured this |
| bb's in-process unsandboxed plugin loader, onboarding telemetry, brand assets | **do not copy** | |
| Harness DB, run supervisor, event log/resume, task board, worktree environments, deploy packaging | **build** | the actual product |

---

## 11. Roadmap

Each phase ends working and demoable. Estimates assume one agent + review.

| Phase | Deliverable | Gate (visible win) | Est. |
|---|---|---|---|
| **P0 — "it deploys"** | `hwh serve` = front-door auth + web chat over stock Hermes + `/healthz` + `docker compose up -d` | `curl` one-liner → chat streaming in a browser on a fresh VPS; 1 command, 1 port, 1 volume | ~1 wk |
| **P1 — "it orchestrates"** | Projects, environments (worktree + profile), threads list w/ grouping, **run supervisor + seq replay**, interrupt/retry | kill the browser mid-run → reopen → run finished and transcript intact | ~2 wk |
| **P2 — "it triages"** | Task board + dispatch presets, single **Needs you** surface, ⌘K palette, Home health dot | one approval, one place; dispatch a task → thread appears running | ~1 wk |
| **P3 — "it shows its work"** | ✅ Computer pane (env PTY + files), ⛔ ticketed downloads, tool cards w/ summaries, approval/sandbox presets in UI, plugin SDK v1 + 2 sample plugins | open Computer, watch a run edit files; install a plugin from a path | ~2 wk |
| **P4 — "it scales"** | Remote runners, SSO (OIDC), `viewer` role, pipelines (bb workflows analogue), share links + tunnel profile | second host runs environments; read-only guest link works | ~2 wk |

**Out of scope for v1 (say no now):** multi-tenant isolation, a marketplace, mobile apps, Electron/Tauri shells (Desktop Plus already serves the same UI to browsers), re-implementing Hermes kanban.

---

## 12. Risks & open decisions

| Risk | Impact | Mitigation |
|---|---|---|
| Fork/stock divergence (844 vs 1,175 commits; `BB-PORT-PLAN` §2) | web build broken before any new UI lands | build on **stock + adapter**; edit only `overlay/`; phase gate = screens render at both widths |
| `HERMES_HOME` is per-home, environments are per-worktree | state leaks between parallel threads | **spike in P1**: profile-per-environment (Hermes profiles already exist) vs home sharding — decide with a 2-day experiment |
| One container = shell + PTY + agent | broad attack surface | presets (§8.4), host terminal off off-loopback, `workspace-write` default, `/healthz` minimal |
| bb UI not portable | slower UI than expected | thin new front end; take only the pure pieces (§10); 4 destinations keep the surface small |
| Hermes upstream moves ~2,100 commits/week | adapter rot | compat matrix + capability probes + nightly contract test (Desktop Plus proved this works) |
| "Harness" name collides with other projects | confusion | name the product **Hermes Web Harness**, credit bb in `NOTICE`, never imply affiliation |

**Decisions needed from you (blockers for P1 start):**

1. **Mode default:** ship the compose image as Mode B (bundled Hermes) with Mode A as the documented alternative? *(recommended: yes)*
2. **Board source of truth:** HWH's own `tasks` table (recommended — bb-shaped, dispatch-aware) or a projection of Hermes kanban?
3. **Identity:** single operator + viewer, or wait for OIDC before exposing beyond a tunnel? *(recommended: single operator + viewer now, OIDC in P4)*
4. **First target UI:** reuse Desktop Plus's `packages/ui` as the starting shell (fastest, carries its divergence debt) or start a thin new app (clean, ~1 week slower)? *(recommended: new thin app — the IA in §7 is not what Desktop Plus has)*

---

## Appendix A — P0 file tree (so implementation can start cold)

```
hwh/
├── pyproject.toml                 # uv tool install hwh  →  `hwh` entrypoint
├── hwh/
│   ├── cli.py                     # hwh serve | doctor | update | plugin
│   ├── server/
│   │   ├── app.py                 # Starlette app: static + /api + /healthz
│   │   ├── auth.py                # token | password | proxy (port of plus auth)
│   │   ├── ws.py                  # multiplexer + seq replay
│   │   └── routes/{threads,projects,environments,tasks,approvals,terminals}.py
│   ├── orchestrator/
│   │   ├── db.py                  # SQLite schema + migrations (WAL)
│   │   ├── supervisor.py          # queue, leases, reconcile-on-boot
│   │   └── events.py              # append + broadcast
│   ├── hermes/
│   │   ├── adapter.py             # loopback client, capability probes
│   │   └── compat.py              # version matrix (min / known-good / tested-main)
│   └── plugins/                   # SDK + bundled
├── ui/                            # Vite + React, semantic tokens only
│   └── src/{app,threads,tasks,home,library,settings}/
├── docker/Dockerfile              # FROM nousresearch/hermes-agent
├── docker/compose.yaml            # + optional `tunnel` profile
└── docs/{DESIGN.md,SECURITY.md}
```

## Appendix B — Compose sketch (the "easy to deploy" acceptance test)

```yaml
services:
  hwh:
    build: .
    image: hwh:latest
    restart: unless-stopped
    ports: ["127.0.0.1:9230:9230"]
    environment:
      - HWH_AUTH=password
      - HWH_PASSWORD=${HWH_PASSWORD:?set it}
      - HERMES_TAG=v0.22.2
    volumes:
      - ./data:/data            # hwh.db, HERMES_HOME, repos, worktrees, secrets
    healthcheck:
      test: ["CMD", "curl", "-fsS", "http://127.0.0.1:9230/healthz"]
      interval: 30s
  # tunnel:                     # profile: cloudflared → public https URL
  #   image: cloudflare/cloudflared
  #   command: tunnel --url http://hwh:9230
```

Acceptance for "easy": a stranger goes from zero to a working thread on a public HTTPS URL in **under 5 minutes**, with one command, one port, one password, and one volume — and `hwh doctor` explains anything that goes wrong.

---

## Appendix C — Implementation status (v0.2.0)

The design above is the target. This is what exists, what changed, and what is still open.

### Decisions taken (were open in §12.4)

| Question | Decision | Why |
|---|---|---|
| Shell: reuse Desktop Plus `packages/ui` vs thin new app | **Thin new app, no build step** (vanilla ES modules + token CSS) | The deploy promise is "one command, one port"; a Vite build adds Node to the image and a second artifact to keep in sync. It is still a *thin* app: four destinations, one transcript renderer, ~1.1k lines. |
| Task source of truth | **HWH's own `tasks` table** | bb import is a later adapter; a local table keeps dispatch transactional today. |
| Identity model | **Single operator + a shared viewer credential** | Matches a self-hosted harness; the schema is ready for `viewer` scopes. |
| Mode A vs Mode B runtime | **Mode A shipped** (`hermes -z` child, one-shot per turn) | Zero changes to Hermes; Mode B (`hermes serve` JSON-RPC) stays a P1.x upgrade. |

### Where each design section lives

| Design | Code | Verified by |
|---|---|---|
| §4.2 state layer, WAL, migrations | `hwh/orchestrator/db.py` | `tests/test_events.py` |
| §5 runs, queue, recovery | `hwh/orchestrator/supervisor.py` | `tests/test_supervisor.py` |
| §5.2 event log + sentinel filter | `hwh/orchestrator/events.py` | `tests/test_events.py` |
| §5.3 WS multiplex + replay | `hwh/server/routes/ws.py` | `tests/test_ws.py` |
| §4.1 worktree environments | `hwh/gitops.py`, `routes/projects.py` | `tests/test_projects.py` |
| §6 API + error contract | `hwh/server/routes/*`, `errors.py` | `tests/test_threads.py`, `test_tasks.py` |
| §8.2 front-door auth | `hwh/server/auth.py`, `gate.py` | `tests/test_auth.py` |
| §8.3 approvals | `supervisor._ask_approval`, `routes/approvals.py` | `tests/test_approvals.py` |
| §8.5 env-scoped PTY (default-off sharp edge) | `hwh/orchestrator/terminals.py`, `routes/terminals.py`, `ui/terminal.js` | `tests/test_terminals.py` |
| §7 four-rail UI | `hwh/ui/{index.html,app.js,terminal.js,theme.css}` | headless-Chrome screenshots at 1440 and 390 px |

### Deviations worth knowing

1. **`seq` is durable-only.** Deltas are ephemeral broadcasts; the finished message is
   the durable record. Replay is therefore small and a dropped delta costs nothing.
2. **Interrupt is cooperative.** The supervisor sets a cancel flag the runtime polls
   (200 ms in the CLI adapter); no `task.cancel()` side effects mid-transaction.
3. **Presets are recorded, not enforced** (`enforcement: partial`). One-shot mode
   bypasses Hermes' own gates, and the harness does not pretend otherwise: `doctor`,
   `/healthz` and the Settings page all say `partial`.
4. **No per-environment profile, no plugin runtime** in v0.1.0; `profile` columns exist
   but stay null. v0.2.0 adds the env-scoped PTY (§8.5) with its own error codes, audit
   rows and idle reaper.

### Next three things (in order)

1. `hermes serve` adapter → real session continuity and native approvals (Mode B).
2. ~~Environment-scoped PTY over the existing WS, with the same audit rows.~~ **Shipped
   in v0.2.0** (`orchestrator/terminals.py`, `routes/terminals.py`, `ui/terminal.js`;
   `HWH_PTY=off` turns it off, `HWH_PTY_IDLE` reaps unwatched shells).
3. Cron/cronjob parity: scheduled dispatch of a saved prompt against an environment.
4. Ticketed downloads for the file endpoints (today they are session-guarded only).
