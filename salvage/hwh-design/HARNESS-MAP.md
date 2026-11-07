# Harness Map: all Hermes harness work on this workstation

**Date:** 2026-10-25 · **Scope:** every repo and plan doc on this machine that builds a
front end, harness or control layer around Hermes Agent.
**Method:** git state from each checkout, plus read-only audits of READMEs, status docs and
code. Status is from code and commit history, not from running anything, unless stated.

Legend: ✅ done · 🟡 partial · ⛔ not built · 📄 plan only

---

## 1. The one-paragraph answer

There are **five live lines of work**, and they overlap more than they differ:

1. **Hermes fork** (`deploy/fork-main`, 825 own commits) — the agent itself plus desktop UI,
   Bot Mode, and `tui_gateway` / profile fixes.
2. **Hermes Desktop Plus** — **shipped v0.1.0** (2026-10-19). Serves the desktop UI to any
   browser over stock Hermes. Has the tested adapter, auth front door, Docker, proof suite.
3. **Hermes Web Harness (this repo)** — v0.2.0. The only one with bb's shape: projects →
   worktrees → threads → tasks, and **server-owned durable runs**. Talks to Hermes one-shot only.
4. **Bot Mode convergence** — Bot Mode 2.0 done locally, **not upstreamed**.
5. **Plugins with harness pieces** — `hermes-day` (Needs-you, gate, durable approvals,
   orchestration, traces) is the most reusable.

Paused prototypes (`hermes-command-center`, `hermes-squad`) and plans (Jev harness,
cross-harness Mission) are idea sources, not code to merge.

**Consolidation thesis:** HWH keeps the orchestration (projects, worktrees, threads, tasks,
durable runs). It **stops reimplementing** what Desktop Plus and the fork already do: the
Hermes adapter, auth hardening, approvals semantics, Needs-you, multi-profile sessions.

---

## 2. Inventory

| Project | Path | Branch | Last commit | State | Role in the consolidated harness |
|---|---|---|---|---|---|
| Hermes Web Harness | `~/Desktop/GetBB x Hermes` | `main` (1 commit + 12 uncommitted) | 2026-10-25 | active | **the home**: orchestration + web UI |
| Hermes fork (newest) | `~/.hermes/hermes-agent` @ `deploy/fork-main` | 825 commits ahead of upstream | 2026-10-24 | active | runtime: `hermes serve`, profiles, approvals |
| Hermes installed | `~/.hermes/hermes-agent` (detached HEAD) | 143 ahead, **different line** | 2026-10-24 | running | what HWH talks to today |
| Hermes Desktop Plus | `~/Code/hermes-desktop-plus` (`.publish/` = main) | `perf/disable-browser-plugin-polling` (11 dirty, no upstream) | 2026-10-22 | shipped v0.1.0 | **source of the adapter, auth, deploy, proof** |
| Bot Mode convergence | `~/Code/hermes-product-convergence`, `~/Code/hermes-bot-mode-upstream` | `feat/bots-product-convergence`, `bot-mode-2-team-os` (uncommitted) | 2026-08-23 | done locally | multi-bot attention model, handoff envelope |
| hermes-day | `~/Code/hermes-day` | `feat/compact-day-cockpit` (2 dirty) | 2026-09-25 | recent | Needs-you IA, gate, durable approvals, traces |
| hermes-tauri | `~/Code/hermes-tauri` | `main` | 2026-10-19 | active | optional desktop shell around a harness URL |
| hermes-command-center | `~/Code/hermes-command-center` | `master` | 2026-08-20 | paused | UX rules, cockpit/board ideas |
| hermes-squad | `~/Code/hermes-squad` | `demo/contact-sheet` | 2026-08-31 | paused | acceptance checklist (`sprint/SWARM-FINDINGS.md`) |
| Cross-harness Mission | `~/Code/hermes-final-merge2` | `main` | 2026-08-17 | evidence only | Mission → Step → Attempt → Execution contract (ACP) |
| Jev native harness | `~/.hermes/plans/20260921_222449-jev-native-harness-vision.md` | — | 2026-09-21 | 📄 | typed-judgment gate, context scoring |
| Other fork checkouts | `~/devin-outpost/repos/hermes-agent-contrib`, `~/Code/upstream-prs-scratch/hermes-agent`, `~/.local/share/hermes-stock/hermes-agent` | various | ≤ 2026-10-23 | PR scratch | not audited |
| Upstream web UIs (not ours) | `~/Code/hermes-webui`, `~/Apps/hermes-webui` (nesquena) | `master` | 2026-08 | third party | reference only |

Plan docs: `~/Code/BB-PORT-PLAN.md`, `~/Code/hermes-ux-plan.md`, `~/Code/deepseek-harness-brief.md`,
`/data/work/bb-study/*.md`, `~/Code/hermes-product-convergence/HARNESS_WAR_BRIEF.md`.

---

## 3. Capability matrix: who already has what

| Capability | HWH | Desktop Plus | Fork / `hermes serve` | hermes-day | Take it from |
|---|---|---|---|---|---|
| Projects → worktree per thread | ✅ | ⛔ | 🟡 `hermes -w`, `session.create{cwd}` | ⛔ | **HWH** |
| Server-owned durable runs + `seq` replay | ✅ | ⛔ proxies stock | 🟡 `session.events.since` | 🟡 durable approval queue | **HWH** (+ `events.since` underneath) |
| Task board + dispatch | ✅ | 🟡 delegates to kanban | ✅ kanban | ⛔ | **HWH**, decide vs kanban |
| Session continuity across turns | ⛔ one-shot `-z` | ✅ | ✅ | — | **fork via Desktop Plus adapter** |
| Hermes adapter (WS JSON-RPC, compat, probes) | ⛔ CLI only | ✅ `adapter/` + `compat/matrix.json` | — | — | **Desktop Plus** |
| Native approvals (server→client `approval`) | 🟡 mock only | ✅ `fork.approvals.*` | ✅ exact-request (`1392b6d5bb`) | ✅ gate + audit | **fork** semantics, **hermes-day** audit |
| Multi-profile on one server | ⛔ | 🟡 single `HERMES_HOME` | ✅ profile incarnation/fencing (`98b79d4560`, `ca7b0e5971`) | ✅ across profiles | **fork** (`deploy/fork-main` only) |
| Needs-you single surface | ✅ basic | ✅ | ✅ Bot Mode universal Needs-you | ✅ best IA + keyboard triage | **hermes-day** IA |
| Front-door auth | ✅ token/password/proxy | ✅ hardened (S40: 4 bypasses closed) | ✅ dashboard auth | — | **diff HWH against Desktop Plus S40** |
| Env-scoped PTY terminal | ✅ | ✅ host terminal | ✅ `/api/pty` | — | **HWH** (env-scoped is safer) |
| Files / Computer pane | ✅ | ✅ + Range, uploads, share | ✅ | — | HWH, borrow uploads/Range |
| Ticketed downloads / share links | ⛔ | ✅ `http/share.py` | 🟡 pairing | — | **Desktop Plus** |
| Docker one-command deploy | ✅ Caddy | ✅ tunnel profile | ✅ s6 image | — | merge: HWH + Desktop Plus tunnel profile |
| Contract tests vs real Hermes | ⛔ | ✅ `tests/contract/`, `proof/` | ✅ | — | **Desktop Plus** |
| Multi-bot / team mode | ⛔ | ✅ | ✅ Bot Mode 2.0 (local) | — | later; not core HWH |
| Plugin runtime | ⛔ | ✅ bridge plugin | ✅ | — | later |
| Cron / scheduled dispatch | ⛔ | ✅ adapter/cron | ✅ | ✅ Scheduled view | **reuse Hermes cron** |
| Fleet / Agent TV | ⛔ (spec only) | 🟡 | 🟡 Bot Mode presence | ✅ In-flight view | later |
| Trace span tree | ⛔ | ⛔ | ⛔ | ✅ `hday_trace.py` | hermes-day |
| ⌘K palette | ⛔ | ✅ desktop UI | ✅ | — | squad / command-center pattern |
| SSO / viewer role / remote runners | ⛔ | ⛔ | ⛔ | — | P4 |
| Desktop shell | — | — | Electron | — | hermes-tauri (optional) |

---

## 4. Where HWH itself stands (verified against code)

**Done (v0.2.0, 106 tests):** auth modes, run supervisor (queue, cap, timeout), append-only
event log + replay, WS fan-out, git worktree per thread, thread ops (send / interrupt /
retry / archive / rename / spawn), approvals (closed decision set), task board + dispatch,
four-destination UI + inspector, Needs-you route, Computer pane files, env-scoped PTY,
`hwh doctor`, crash recovery, Docker + Caddy.

**Partial:** approvals fire only from the mock runtime; permission presets recorded not
enforced (`enforcement: partial`); P1's "environment = worktree + profile" lacks the profile.

**Not built:** `hermes serve` runtime, per-environment profile, ⌘K, ticketed downloads,
plugins, cron, fleet, share links, SSO/roles, remote runners.

**Design-doc conflict inside this repo** (must resolve):

| Doc | Approach | Matches code? |
|---|---|---|
| `HWH-DESIGN.md` | standalone daemon, own SQLite, adapter to Hermes, vanilla UI | ✅ yes |
| `HERMES_WEB_HARNESS_SPEC.md` | React 19 + Vite + Tailwind, JSON-RPC gateway, Fleet engine, modules like `turn_manager.py` | ⛔ none of it exists |
| `docs/HERMES-WEB-HARNESS.md` | no new daemon: reshape Hermes's own dashboard, "do not fork the API" | ⛔ different product |

---

## 5. Version lines: which Hermes does HWH target?

| Line | Has | Lacks |
|---|---|---|
| Installed HEAD (143 own commits) | delegation routing, updater holds, Nous sign-in, ACP mcp cap patch | fork-main's `tui_gateway` profile fencing, approvals UX, run replay |
| `deploy/fork-main` (825 own commits) | profile incarnation/fencing, exact-request approvals, run replay, session cache | installed line's delegation + updater work |
| Desktop Plus compat matrix | known-good 0.22.0–0.22.2, tested main `607a0b0d` | 0.22.5 (installed) = **untested** |

The two fork lines share **0 of 143** commit subjects. They need a merge before HWH can
target one Hermes with both profile fencing and delegation routing.

---

## 6. Open loops across all projects

- **HWH:** 12 uncommitted files including the whole `hwh/` package and `tests/`.
- **Desktop Plus:** 11 dirty files on a branch with no upstream (plugin-polling perf).
- **Bot Mode 2.0:** uncommitted on `bot-mode-2-team-os`; nothing pushed, no PRs. Known
  limits: autonomy advisory, no SLA watchdog, legacy NeedsYouStrip, jury mostly 429'd.
- **hermes-day:** 2 dirty files on `feat/compact-day-cockpit`.
- **hermes-tauri:** Starlette CVE blocked by the `hermes_plus` pin.
- **hermes-squad findings still unsolved anywhere:** Stop must stop the remote run; one
  Needs-you surface; persisted threads + URL routing. (HWH solves the last two.)

---

## 7. Decisions needed

1. **Which design is HWH?** Recommended: `HWH-DESIGN.md` (it matches the code). Move the
   other two docs to `docs/alternatives/` with a note.
2. **Which Hermes line?** Recommended: merge installed HEAD into `deploy/fork-main` in a
   separate worktree, run Desktop Plus contract tests on the result, pin that SHA.
3. **Adapter source:** port Desktop Plus `adapter/` (gateway, compat, capabilities) into
   `hwh/runtimes/`, keeping attribution. Recommended over writing new.
4. **Task source of truth:** HWH `tasks` table (design §12.2) vs Hermes kanban.
5. **Profile model:** worktree via `session.create{cwd}`, profile = identity only, unless
   the spike shows shared-profile leaks.

### Decided

- **Design docs:** keep all three; `HWH-DESIGN.md` is the one the code follows.
- **Hermes line:** merge installed HEAD with `deploy/fork-main` in `~/Code/hermes-hwh-merge`
  (branch `hwh/merge-installed-forkmain`). Paused with 36 conflicted files.
- **Task source of truth:** HWH `tasks` table.
- **desktop.decruxtech.com:** moved to the Nous main webapp (upstream `710fa8a073`,
  worktree `~/Code/hermes-nous-main`, `127.0.0.1:9120`). `hermes-plus-on-9129` stopped and
  disabled, so dev.decruxtech.com's backend is down. Backup:
  `~/.local/state/hermes-backups/hermes-webapp-pre-nous-main-20261025T124934/`.
  Rollback: tunnel back to `100.84.81.81:9129`, re-enable `hermes-plus-on-9129`, restart
  `hermes-web-tunnel`. Sign-in not yet confirmed by the user.
- **Fork strategy (2026-10-25):** overlay, not merge. Nous main stays clean and pull-only (no
  pushes, PRs or comments there). All work lives on `DECRUX9812/hermes-agent-contrib`; the overlay
  is `~/Code/hermes-plus-overlay` (branch `overlay/main`, remote origin = contrib; see its
  `FEATURES.md`). The merge scratch `~/Code/hermes-hwh-merge` is **paused/archived**: 5 Python/docs
  conflicts resolved and staged, 31 desktop files still conflicted, nothing committed.
- **Webapp desktop plugins:** Nous main's webapp does not load `$HERMES_HOME/desktop-plugins/`
  (its browser bridge has no `desktopPluginsRoot`). The fork's `1ff5dcf331` loader is patch P1.
- **Git safety:** shared repo `~/.hermes/hermes-agent/.git` has `origin`/`upstream` push URLs
  set to `DISABLED-no-push-to-nous`, `remote.pushDefault=fork`, `push.default=current`.
---

## 8. Path to one harness (ordered)

| # | Step | Est. | Depends on |
|---|---|---|---|
| 1 | Commit HWH v0.2.0; archive the two alternative design docs | 15 min | — |
| 2 | Merge installed HEAD ↔ `deploy/fork-main` in a scratch worktree; pin one SHA | 0.5–1 day | — |
| 3 | Profile spike on that SHA: two threads, one profile, two `cwd`s; check memory, sessions DB, terminal policy | 0.5 day | 2 |
| 4 | Port Desktop Plus adapter → `hwh/runtimes/hermes_serve.py` (session.create/resume, prompt.submit, deltas, interrupt, approval requests) | 3–5 days | 2 |
| 5 | Contract tests from Desktop Plus `tests/contract/` against the pinned SHA | 1 day | 4 |
| 6 | Align HWH auth with Desktop Plus S40 fixes; add ticketed downloads from `http/share.py` | 1 day | — |
| 7 | Needs-you upgrade using hermes-day IA + keyboard triage | 2 days | 4 |
| 8 | Cron via Hermes cron (no second scheduler) | 1–2 days | 4 |
| 9 | ⌘K, fleet view, plugins, SSO, remote runners | P3/P4 | — |

Rough position: HWH has finished orchestration (its P0–P1 core) and has **not started its
integration with the real Hermes runtime**, which is steps 2–5. Those steps are mostly
porting existing tested code, not new invention.
