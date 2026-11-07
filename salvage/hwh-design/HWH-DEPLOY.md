# Hermes Web Harness — Deployment

Companion to [HWH-DESIGN.md](./HWH-DESIGN.md). Goal: **zero → working thread in under
5 minutes, one command, one port, one volume.** This file describes what v0.2.0 actually
ships; anything still on the drawing board is marked **design only**.

---

## 1. Targets

| # | Target | Command | State |
|---|---|---|---|
| 1 | **Local (loopback)** | `. .venv/bin/activate && hwh serve` | ✅ shipped; prints a one-time token URL |
| 2 | **Docker Compose** | `cp .env.example .env && docker compose up -d --build` | ✅ shipped (verified below) |
| 3 | **TLS in front** | `docker compose --profile tls up -d` | ✅ shipped (Caddy, automatic HTTPS) |
| 4 | **Behind SSO proxy** | `HWH_AUTH=proxy HWH_TRUST_PROXY_HEADERS=1 …` | ✅ shipped (`X-Forwarded-User`) |
| 5 | **VPS one-liner / `hwh update`** | — | ⛔ design only |

Postgres, Redis, S3 and a message broker are **not** part of any target. SQLite on the
volume is the whole state layer.

---

## 2. Ports, volumes, environment

| | Value | Why |
|---|---|---|
| Port | `9230` (host `127.0.0.1` by default) | one origin; no second listener |
| Volume | named volume `hwh-data` → `/data` | `hwh.db`, `worktrees/`, `session.key`, `token.txt` |
| Repos | `${HWH_REPOS_DIR}:/repos` | the checkouts the harness may branch from |
| Health | `GET /healthz` | public: db, runtime, auth mode, uptime — nothing sensitive |
| Auth | `HWH_AUTH` = `token` \| `password` \| `proxy` \| `none` | `none` is refused off-loopback |
| Terminal | `HWH_PTY` = `on` \| `off`, `HWH_SHELL`, `HWH_PTY_IDLE` (s) | env-scoped PTY in the Computer pane; `off` removes the surface |

```sh
# .env (copy of .env.example)
HWH_PORT=9230
HWH_AUTH=password          # anything reachable beyond loopback
HWH_PASSWORD=              # required when HWH_AUTH=password
HWH_RUNTIME=mock           # mock (no spend) | hermes (stock CLI)
HWH_BASE_URL=https://harness.example.com
HWH_TRUST_PROXY_HEADERS=false
HWH_REPOS_DIR=/srv/code
HWH_PTY=on                 # env-scoped shell in the Computer pane; off = no PTY surface
HWH_SHELL=/bin/bash        # default: $SHELL, then /bin/sh
HWH_PTY_IDLE=900           # seconds before an unwatched shell is reaped
```

**Volume ownership matters.** The image runs as uid `10001`. A named volume inherits
the image's ownership and just works; a **bind mount does not**. Either:

```bash
sudo chown -R 10001:10001 /srv/hwh-data     # bind mount to a host directory
# or
docker run -v hwh-data:/data …              # named volume (nothing to fix)
```

If the data directory is not writable, `hwh serve` exits `3` with that exact `chown`
line instead of a traceback.

---

## 3. Topology

```
internet ──► [Caddy :443 (profile tls) or your proxy] ──► hwh :9230
                                                           ├─ /data (sqlite, worktrees)
                                                           ├─ /repos (your checkouts)
                                                           └─ child process: hermes -z …
```

`/api/ws` upgrades pass straight through the proxy; the harness authenticates the
upgrade with the same cookie as the rest of the app.

---

## 4. Security checklist (ship-blocking)

- [x] Every path needs a session except `/healthz`, `/login`, `/ui/*`.
- [x] `HWH_AUTH=none` refuses any bind that is not `127.0.0.1`/`localhost`/`::1`.
- [x] Cookie is `HttpOnly`, `SameSite=Lax`, and `Secure` when `HWH_BASE_URL` is https.
- [x] `Origin` is compared to `Host` on unsafe methods and WebSocket upgrades.
- [x] CSP `default-src 'self'`, `frame-ancestors 'none'`, `nosniff`, `no-referrer`.
- [x] Approvals have a closed decision set; ask and answer both land in `audit`.
- [x] `session.key` and `token.txt` are written 0600.
- [x] Shell surface — **environment-scoped PTY, never a host shell**: `cwd` pinned to the
      worktree, `HWH_*` stripped from the child env, the `read-only` preset refuses one,
      opens/exits are audited, the live count is capped, `HWH_PTY=off` removes it, and an
      unwatched shell is reaped after `HWH_PTY_IDLE`.
- [ ] Share links (read-only projection, TTL) — **not built**.
- [ ] `HWH_ALLOWED_ORIGINS` for native webviews — partial: `server.cors_origins` in
      `hwh.yaml` is honoured by the origin check; there is no env var for it yet.

---

## 5. Operations

| | |
|---|---|
| **Status** | `hwh doctor` — 9 checks: auth, data dir, db, git, worktrees, runtime, disk, terminal, bind |
| **Logs** | `docker compose logs -f hwh`; access log is off by default |
| **Backup** | stop → `tar` the volume. Restore = untar → `hwh doctor` |
| **Upgrade** | rebuild/pull, recreate; migrations are forward-only and run on boot |
| **Recovery** | any run caught by a restart is marked `interrupted` with a **Retry** card |
| **Uninstall** | `docker compose down -v`; the volume is the only thing to delete |

---

## 6. Acceptance test — what was actually run for v0.1.0

| Step | Result |
|---|---|
| `hwh doctor` on a clean data dir | 8 checks at v0.1.0, all ok, exit 0 (9 now — the terminal check arrived with v0.2.0) |
| `hwh demo` (scratch repo → worktree → thread → 3 runs) | runs `done`, transcript replays, approval asked and answered |
| `hwh serve` + token login + `GET /api/bootstrap` | 200 after login, 401 before |
| UI in headless Chrome at 1440×1000 and 390×844 | renders live data; composer pinned; no horizontal clipping |
| Message → stream → `run.finished` | tool cards, deltas, durable assistant message, `finished in 0.24s` |
| `docker build` + `docker run` (named volume) | healthy healthcheck, UI served, full project → worktree → thread → run via HTTP inside the container |
| Container with a **root-owned bind mount** | fails fast with the `chown 10001:10001` instruction (expected) |
| `python -m pytest -q` | 106 passed |
| `ruff check hwh tests` | clean |

### v0.2.0 additions (Computer pane)

| Step | Result |
|---|---|
| `hwh demo --data-dir …` + `hwh serve --port 9311` | login URL, UI served, `/ui/terminal.js` 200 |
| Thread → inspector → Computer → **Terminal** | shell opens with `cwd` = the environment worktree, prompt rendered (ANSI stripped, wrapped at pane width) |
| Type `echo HWH-UI-OK` + Enter | echoed and printed; `^C` interrupts a `sleep 20`; the next command runs |
| Widen the inspector (`⇥`) | PTY sees `72×19` (`GET /api/terminals`), output keeps wrapping correctly |
| Computer → **Files** → `app.py` → Download link | preview rendered, href points at `/api/environments/:id/file?…&download=1` |
| Leave the thread | its shell is closed server-side (3 → 2 open terminals) |
| `pytest tests/test_terminals.py -q` | 14 passed (policy, offsets, exit codes, resize via `stty size`, idle reaping, HTTP round trip, unauthenticated 401, live uvicorn WS) |
| `docker build -t hermes-web-harness:0.2.0 .` + run with a volume | `healthz` 200; project → worktree → **PTY inside the container** (`/data/worktrees/demo-…`), `echo CONTAINER-PTY-OK` streamed over the WS, `DELETE` closed it |

Not yet demonstrated: a real model turn through `HWH_RUNTIME=hermes` in the container
(it needs the host's `~/.hermes` mounted writable), and TLS through the Caddy profile.
