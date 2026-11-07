# GetBB x Hermes — uncommitted work salvage report

**Source:** `/home/decrux/Desktop/GetBB x Hermes` (branch `main`, HEAD `8cf3a86`, 309 untracked files, 377 MB on disk)
**Target:** `hermes-notebook` (this repo) — NotebookLM-style Hermes Desktop plugin
**Method:** read-only. `git status --porcelain -uall` inventory + `du` sizes; docs read in full; HWH test suite run in an **isolated copy** (`~/.hermes-webapp/cache/scratch/hwh-probe`) so nothing was written to the source repo.
**Date:** 2026-11-07

---

## 1. Inventory (untracked files only)

| Path | Files | Size | Verdict |
|---|---|---|---|
| `videos/hermes-notebook-demo/` | 174 total → **56 real** + 118 vendored `node_modules/playwright-core` | 57 MB (14 MB of it playwright) | **reusable** (demo media + video build scripts); node_modules dead |
| `bot-context-ui/` | 69 | 1.4 MB source+`dist` (plus 223 MB `node_modules`, gitignored, not in git status) | **reusable** (bot chat + activity rail reference UI) |
| `hwh/` | 37 | 0.30 MB | **archive** — working code, wrong product |
| `hwh/ui/` (subset of above) | 4 | 0.10 MB | **reusable** (no-build UI kit: tokens + hyperscript + markdown) |
| `tests/` | 16 | 0.08 MB | **reusable** (offline ASGI/WS/PTY/git harness) |
| `docs/HARNESS-MAP.md` | 1 | 13 KB | **reusable** (map of every harness/UI line on this machine) |
| `HERMES-NOTEBOOK-PLUGIN-MASTER-PROMPT.md` | 1 | 12 KB | **reusable** (the original notebook plugin spec) |
| `README.md`, `HWH-DESIGN.md`, `HWH-DEPLOY.md`, `Caddyfile`, `Dockerfile`, `docker-compose.yml`, `pyproject.toml`, `uv.lock`, `.env.example`, `.dockerignore`, `.gitignore` | 11 | 0.22 MB | **archive** |
| `videos/.../node_modules/playwright-core/` | 118 | 13.3 MB | **dead** (vendored dependency) |

**Verdict counts (309 files):** reusable 147 · archive 44 · dead 118.
Copied to `salvage/`: **43 files, 5.7 MB** (limit was ~20 MB).

Tracked-but-not-in-scope docs (committed in `8cf3a86`, read anyway):
`HERMES_WEB_HARNESS_SPEC.md` — **dead**: describes a React 19 + Vite + Tailwind + JSON-RPC gateway product (`turn_manager.py`, Fleet engine) of which **0 modules exist** in the repo; conflicted with `HWH-DESIGN.md` and `docs/HERMES-WEB-HARNESS.md` per `HARNESS-MAP.md` §4.
`docs/HERMES-WEB-HARNESS.md` — **dead** (a third, different product: "reshape Hermes's own dashboard, do not fork the API").

**Secrets:** no `.env`, no key/secret files anywhere in the tree. `.env.example` only (18 keys, names only, no values) — not copied.

---

## 2. What HWH actually is (5 bullets)

- **A standalone web harness daemon for Hermes agents**, not a plugin: FastAPI + asyncio + SQLite (WAL), one port, one volume, vanilla-JS UI with no build step (`hwh serve` → prints a one-time login URL).
- **Its organising shape is bb/GetBB's**: `project → environment (a real `git worktree` per thread, branch `hwh/<project>-<id>`) → thread → task`, plus a task board that dispatches task→thread→run.
- **The core idea is server-owned durable runs**: the browser POSTs a message, the server owns the run, appends `seq`-numbered events, and replays by `since` — so reload/reconnect/restart do not lose a turn. Interrupt is cooperative and the worker owns its terminal state.
- **Two runtime modes behind one contract**: `mock` (deterministic, free, used by demo/doctor/tests) and `hermes` — `hermes_cli.py` is one-shot `hermes -z` with a bounded transcript prefix; `hermes_serve.py` (543 lines, written *after* the docs) adds Gateway JSON-RPC session continuity, tool lifecycle events and approval bridging.
- **Extra surfaces that do work**: env-scoped PTY over WS (`pty.fork`, never a host shell, idle-reaped), Computer pane (per-env file browser/download/diff), route-typed approvals with a closed decision set, auth (token/password/proxy/none, HMAC HttpOnly cookie, origin check, CSP), `hwh doctor`, Docker + Caddy.

Status honesty: README says v0.2.0, "P0/P1 done, P3's Computer pane shipped"; **plugin runtime, cron, fleet, per-env profiles are not built.**

---

## 3. Component verdicts, entry points, tests

| Component | What it is | Entry point | Tests | Verdict |
|---|---|---|---|---|
| `hwh/` | 8.0 kLOC Python across 33 modules + 2.1 kLOC UI | `hwh/cli.py:main` (`serve`/`doctor`/`demo`/`init`/`token`), `hwh/server/app.py:create_app` | **110 passed** (`pytest -q`, 18 s, offline, mock runtime) in a fresh venv | **archive**: real, complete, and irrelevant to a notebook plugin |
| `tests/` | 16 files, 2,045 lines: store, gate, runs, approvals, worktrees, WS replay, PTY, Hermes adapter against a stand-in binary | `tests/conftest.py` | green (above) | **reusable** as a harness pattern |
| `bot-context-ui/` | Vite + React 19 + BoardUI prototype: bot chat pane + right rail of bot activity/tasks/status; `dist/` is built | `src/App.tsx`, `src/rail/Rail.tsx` | none (prototype; only playwright screenshot scripts `record-beats.mjs`, `probe-*.mjs`) | **reusable** as UI reference; not buildable into this plugin (no React toolchain here) |
| `videos/hermes-notebook-demo/` | A **complete 144 s explainer + 88 s demo for THIS plugin**, built from real plugin outputs: VO wavs, storyboard, title/closing cards, ffmpeg assembly script, HyperFrames HTML scenes, Playwright capture | `assemble.sh`, `record.mjs`, `index.html` | renders exist and probe clean (`demo-final.mp4` 88.0 s / 1.35 MB, `explainer.mp4` 144.0 s / 4.9 MB) | **reusable** — best find in the repo |
| `HERMES-NOTEBOOK-PLUGIN-MASTER-PROMPT.md` | The original self-contained spec/plan for `hermes-notebook` (7 tools, storage layout, ingest matrix, BM25 retrieval, artifact kinds, two-host audio, manifest sketch, catalog rules, 7 open questions) | — | — | **reusable** as parity checklist |

Header claim vs reality: README/doc say 106 tests; the tree now has **110**. `HARNESS-MAP.md` says `hermes serve` runtime "not built" — `hermes_serve.py` + `tests/test_hermes_serve.py` (293 lines) exist and pass, i.e. the map is one commit stale.

**Environment gotcha:** the repo's own `.venv` is broken (`ImportError: cannot import name 'ArgsKwargs' from pydantic_core` — pydantic/pydantic_core mismatch). Tests only run after building a clean venv; `PYTHONPATH` from the host must be unset or the venv picks up the wrong site-packages. One test (`test_gitops_basics`) asserts `cwd` is a git repo, so it fails in a bare copy — 109/110 outside a git dir, 110/110 inside one.

---

## 4. What was copied, and why

| Copied to `salvage/` | From | Why |
|---|---|---|
| `notebook-spec/HERMES-NOTEBOOK-PLUGIN-MASTER-PROMPT.md` | repo root | (a) The only notebook/NotebookLM artefact in the repo besides the demo videos. Written as a spec for **this** plugin; useful as a gap checklist against the shipped 16 tools (video overview, slides, infographic, discover, notes, suggest are all beyond it). |
| `hwh-design/{HWH-DESIGN.md,HWH-DEPLOY.md,README.md,docs/HARNESS-MAP.md}` | root + `docs/` | (b)(c) `HWH-DESIGN.md` §9 defines a **plugin slot contract** (`hwh.plugin.json`, per-slot crash isolation, replace-with-fallback) that maps onto a desktop plugin pane; §7.3 is a visual system. `HARNESS-MAP.md` is the only inventory of the 5 parallel harness lines + who owns which capability — stops us re-solving solved problems. |
| `hwh-ui-reference/ui/{index.html,app.js,theme.css,terminal.js}` | `hwh/ui/` | (b) A 1.7 kLOC **no-build** UI: 50-line hyperscript `h()`, an escaping markdown renderer, WS transcript painter with tool/approval/failure cards, inspector, diff view — and `theme.css`, a two-anchor Oklab token system with automatic dark mode. Directly liftable into a plugin pane that cannot ship a bundler. |
| `hwh-test-harness/tests/{conftest.py,test_ws.py,test_hwh_core.py,test_terminals.py}` | `tests/` | (d) Offline fixtures: temp `git` repo + worktree, ASGI transport, WS replay assertions with `since`, PTY over WS with offsets. The WS-replay test is the template for testing streamed notebook answers. |
| `boardui-rail/{AGENTS.md,src/App.tsx,src/fixtures.ts,src/rail/*.tsx,components/application/{agent-log,agent-thinking}.tsx}` | `bot-context-ui/` | (b)(c) Reference for a **right-rail activity model** (bot rows, status dots, task rows, expandable activity detail) and two ready-made agent components (streaming log, thinking indicator) — plus the BoardUI token/typography rules that make dark mode and RTL work without literals. |
| `media/hermes-notebook-demo/{renders/demo-final.mp4, vo/*.wav, cards/*.png, STORYBOARD.md, assemble.sh, record.mjs, record2.mjs, index.html, index2.html, make_cards.py, dev_brief.json, dev-frame.md}` | `videos/hermes-notebook-demo/` | (e) Finished demo content for this exact plugin: an 88 s narrated cut, seven VO stems (title/sources/ask/artifacts/media/extras/close), title+closing cards, and the ffmpeg assembly recipe. Re-cuttable for a submission/demo without re-recording. |

**Deliberately not copied:** all of `hwh/` orchestration code (server, supervisor, SQLite store, gitops, PTY) — genuinely good, wrong product, 0.3 MB but would re-introduce a second daemon into this repo; `bot-context-ui/node_modules` + `dist` (223 MB / built bundle); `videos/.../node_modules`; the other three renders (`demo.mp4` 1.0 MB dupe, `explainer.mp4` 4.9 MB, `seg/*`, `v/*`, `raw*/` webm) and `v/music.wav` (12.8 MB) — noted here instead of copied; `HERMES_WEB_HARNESS_SPEC.md` (dead spec, 0 matching modules); `uv.lock`, `Dockerfile`, `Caddyfile`, `.env.example`.

---

## 5. What we should re-apply (concrete)

1. **Ship the 88 s demo** — copy `salvage/media/hermes-notebook-demo/renders/demo-final.mp4` to `assets/` and link it from README "See it in action"; the repo already claims "explainer + 88s demo videos rendered" in `f4dfcf0` but carries no video. Re-cut the submission cut from `vo/*.wav` + `assemble.sh` rather than re-recording.
2. **Replace the JSON-only dashboard with a no-build pane** — `salvage/hwh-ui-reference/ui/theme.css` + the `h()`/`markdown()`/`ESC` block from `app.js` (lines 33–113) give a dependency-free renderer for cited answers; `web/index.html` + `web/app.js` + `plugin_api.py`'s `ctx.rest` routes are the wiring. No bundler, no CSP `'self'` fight.
3. **Adopt the rail IA for sources/artifacts** — `salvage/boardui-rail/src/rail/Rail.tsx` + `TaskRow.tsx` is the closest thing to a NotebookLM source list with status dots; re-implement as plain DOM (or port the BoardUI tokens) instead of pulling React in.
4. **Port the WS-replay test pattern** — `test_ws.py`'s `since`-based assertions are the right shape for `notebook_ask` streaming + reconnect; run the same test in CI without network.
5. **Run the master prompt as a gap audit, not a build plan** — its §"GAP" questions (embedding vs BM25, 7-tool surface, `ctx.dispatch_tool` gating) are still open; the shipped plugin answers most by existing. Diff its 7-tool list against the current 16 and only close gaps judges can see (source "notes" is done; chat history is done via `thread=`).
6. **Fix the two doc lies in HWH before anyone reads it** — `HARNESS-MAP.md` §4 says `hermes serve` is not built while `hwh/runtimes/hermes_serve.py` + 293 test lines exist and pass; README says 106 tests, tree has 110. If HWH is ever resumed, correct both first.

---

## 6. Not salvageable

- `HERMES_WEB_HARNESS_SPEC.md` (React/Vite/Tailwind/Fleet engine — nothing implemented; superseded by `HWH-DESIGN.md`).
- `docs/HERMES-WEB-HARNESS.md` (a third contradicting design: "don't build a daemon").
- `bot-context-ui/dist/` (510 KB built bundle, source present), `probe-*.mjs`/`shot16.mjs` (throwaway screenshot probes).
- `videos/.../raw/`, `raw2/` webm captures, `seg/*`, `v/*` intermediate encodes — reproducible from `assemble.sh` + `record.mjs`.
- `.venv` (broken pydantic_core), `.pytest_cache`, `.ruff_cache`.
