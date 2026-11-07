// Hermes Web Harness UI — no build step, no framework, one module.
// Reads: /api/bootstrap, /api/threads/:id, /api/threads/:id/events
// Streams: /api/ws?thread_id=… (per thread) and /api/ws (global count refresh)

import { TerminalView } from "./terminal.js";

const state = {
  bootstrap: null,
  route: { name: "home", id: null },
  thread: null,
  events: [],
  live: null,          // { runId, text, node }
  threadSocket: null,
  globalSocket: null,
  lastSeq: 0,
  theme: localStorage.getItem("hwh-theme") || "auto",
  filter: "",
  computer: {
    tab: "files", path: "", entries: [], file: null, loaded: false,
    terminal: null, environment: null,
    diff: null, diffLoaded: false, diffLoading: false, diffMode: "split", diffFile: null,
    previewUrl: "http://127.0.0.1:9120", previewViewport: "desktop", previewNonce: 0,
  },
  cmdk: { open: false, query: "", index: 0, items: [] },
};

const main = document.getElementById("main");
const inspector = document.getElementById("inspector");
const rail = document.getElementById("rail");
const toastEl = document.getElementById("toast");

// ---------------------------------------------------------------- utilities
function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "dataset") Object.assign(node.dataset, value);
    else if (key === "html") node.innerHTML = value;
    else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === "text") node.textContent = value;
    else if (value === true) node.setAttribute(key, "");
    else node.setAttribute(key, value);
  }
  for (const child of children.flat(4)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

function setChildren(node, ...children) {
  node.replaceChildren(
    ...children.flat(4).filter((child) =>
      child !== null && child !== undefined && child !== false && child !== ""),
  );
}

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const escapeHtml = (text) => String(text ?? "").replace(/[&<>"']/g, (c) => ESCAPES[c]);

function inlineMarkup(text) {
  return text
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noreferrer noopener">$1</a>')
    .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g,
      '$1<a href="$2" target="_blank" rel="noreferrer noopener">$2</a>')
    .replace(/\n/g, "<br>");
}

function markdown(text) {
  const source = escapeHtml(text);
  const parts = source.split("```");
  return parts
    .map((part, index) => {
      if (index % 2 === 1) return `<pre><code>${part.replace(/^[a-z]*\n/i, "")}</code></pre>`;
      return part
        .split(/\n{2,}/)
        .filter((block) => block.trim())
        .map((block) => `<p>${inlineMarkup(block)}</p>`)
        .join("");
    })
    .join("");
}

function relTime(seconds) {
  if (!seconds) return "";
  const delta = Date.now() / 1000 - seconds;
  if (delta < 45) return "just now";
  if (delta < 3600) return `${Math.round(delta / 60)}m ago`;
  if (delta < 86400) return `${Math.round(delta / 3600)}h ago`;
  return `${Math.round(delta / 86400)}d ago`;
}

function toast(message, tone = "") {
  toastEl.textContent = message;
  toastEl.dataset.tone = tone;
  toastEl.hidden = false;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toastEl.hidden = true; }, 4200);
}

class ApiError extends Error {
  constructor(status, body) {
    super(body?.error?.message || `request failed (${status})`);
    this.status = status;
    this.code = body?.error?.code || "error";
    this.hint = body?.error?.hint || "";
  }
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: options.body ? { "content-type": "application/json" } : {},
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (response.status === 401) {
    window.location.href = "/login";
    throw new ApiError(401, { error: { message: "signed out" } });
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(response.status, body);
  return body;
}

// ------------------------------------------------------------------- theme
function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  localStorage.setItem("hwh-theme", state.theme);
}

// ------------------------------------------------------------------- router
function parseRoute() {
  const hash = window.location.hash.replace(/^#\/?/, "");
  const [name, id] = hash.split("/");
  return { name: name || "home", id: id || null };
}

async function navigate() {
  state.route = parseRoute();
  closeThreadSocket();
  resetComputer();
  for (const item of document.querySelectorAll(".nav-item")) {
    const target = state.route.name === "thread" ? "threads" : state.route.name;
    if (item.dataset.nav === target) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  }
  rail.dataset.open = "false";
  main.setAttribute("aria-busy", "true");
  try {
    if (state.route.name === "thread" && state.route.id) await renderThread(state.route.id);
    else if (state.route.name === "threads") renderThreadsPage();
    else if (state.route.name === "tasks") await renderTasks();
    else if (state.route.name === "settings") await renderSettings();
    else renderHome();
  } catch (error) {
    setChildren(main, h("div", { class: "card" },
      h("h2", {}, "That view did not load"),
      h("p", { class: "muted" }, error.message),
      h("p", { class: "faint mono" }, error.hint || ""),
      h("button", { class: "btn", onclick: navigate }, "Try again")));
  } finally {
    main.removeAttribute("aria-busy");
  }
  main.focus({ preventScroll: true });
}

// ----------------------------------------------------------------- bootstrap
async function refreshBootstrap() {
  state.bootstrap = await api("/api/bootstrap");
  paintChrome();
  return state.bootstrap;
}

function paintChrome() {
  const boot = state.bootstrap;
  if (!boot) return;
  const health = boot.health || {};
  const runtime = boot.runtime || {};
  const dot = document.querySelector("#health .dot");
  const label = document.querySelector("#health .health-text");
  const healthy = health.ok;
  dot.className = `dot ${healthy ? "ok" : "bad"}`;
  label.textContent = healthy ? "harness up" : "degraded";
  document.getElementById("health").title =
    `${runtime.name} runtime · db ${health.db?.ok ? "ok" : "down"} · auth ${boot.auth?.mode}`;

  const chip = document.getElementById("runtimeChip");
  if (runtime.is_mock) {
    chip.hidden = false;
    chip.className = "chip mock";
    chip.textContent = "MOCK RUNTIME";
    chip.title = "Replies are synthetic; set HWH_RUNTIME=hermes for a real agent";
  } else if (!runtime.ok) {
    chip.hidden = false;
    chip.className = "chip bad";
    chip.textContent = "RUNTIME DOWN";
    chip.title = runtime.detail;
  } else {
    chip.hidden = false;
    chip.className = "chip";
    chip.textContent = runtime.name.toUpperCase();
    chip.title = runtime.detail;
  }

  const needs = (boot.needs_you || []).length;
  const homeBadge = document.getElementById("badgeHome");
  homeBadge.hidden = needs === 0;
  homeBadge.textContent = needs;

  const running = boot.counts?.running || 0;
  const threadBadge = document.getElementById("badgeThreads");
  threadBadge.hidden = running === 0;
  threadBadge.textContent = running;

  const projects = boot.projects || [];
  document.getElementById("railProjects").replaceChildren(
    projects.length
      ? h("div", { class: "rail-title" }, "Projects")
      : h("span"),
    ...projects.slice(0, 8).map((project) =>
      h("a", { class: "rail-link", href: `#/threads` },
        h("span", { class: "dot ok" }),
        h("span", {}, project.name),
        h("span", { class: "faint" }, ` ${project.env_count || 0}`))),
  );
}

// ---------------------------------------------------------------------- home
function statusDot(status) {
  const tone = { running: "ok", waiting_approval: "warn", failed: "bad" }[status] || "";
  return h("span", { class: `dot ${tone}` });
}

function threadRow(thread) {
  const search = `${thread.title || ""} ${thread.project_name || ""} ${thread.branch || ""}`
    .toLowerCase();
  return h("a", { class: "row", href: `#/thread/${thread.id}`, dataset: { search } },
    statusDot(thread.status),
    h("span", { class: "row-main" },
      h("span", { class: "row-title" }, thread.title || "Untitled thread"),
      h("span", { class: "row-sub" },
        [thread.project_name, thread.branch, thread.status].filter(Boolean).join(" · "))),
    h("span", { class: "row-meta" }, relTime(thread.updated_at)));
}

function renderHome() {
  const boot = state.bootstrap;
  const counts = boot.counts || {};
  const needs = boot.needs_you || [];
  const running = (boot.threads || []).filter((t) => t.status === "running");
  const recent = (boot.threads || []).filter((t) => t.status !== "running").slice(0, 8);
  const hour = new Date().getHours();
  const greeting = hour < 5 ? "Still up" : hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";

  setChildren(main, 
    h("div", { class: "page-head" },
      h("div", { class: "grow" },
        h("div", { class: "eyebrow" }, "Overview"),
        h("h1", {}, `${greeting} — ${counts.threads} thread${counts.threads === 1 ? "" : "s"}`),
        h("p", { class: "lede" },
          `${counts.running} running · ${counts.queued} queued · ${counts.tasks_open} open tasks · `,
          `${boot.runtime?.is_mock ? "mock runtime" : boot.runtime?.name}`))),

    h("section", { class: "card" },
      h("div", { class: "card-title" },
        h("h3", {}, "Needs you"),
        h("span", { class: "count" }, needs.length ? `${needs.length} waiting` : "nothing")),
      needs.length
        ? h("div", { class: "list" }, ...needs.map((item) => h("div", { class: "row" },
          h("span", { class: `dot ${item.kind === "approval" ? "warn" : "bad"}` }),
          h("span", { class: "row-main" },
            h("span", { class: "row-title" }, item.title || "Thread"),
            h("span", { class: "row-sub" }, item.summary)),
          item.kind === "approval"
            ? h("button", { class: "btn btn-primary", onclick: () => decideApproval(item.id, "allowed-once") }, "Allow once")
            : h("a", { class: "btn", href: `#/thread/${item.thread_id}` }, "Open"),
          h("a", { class: "btn btn-ghost", href: `#/thread/${item.thread_id}` }, "Details"))))
        : h("div", { class: "empty" },
            h("strong", {}, "Nothing is blocked"),
            "Runs finish on their own or wait here for one decision.")),

    running.length
      ? h("section", { class: "card" },
          h("div", { class: "card-title" }, h("h3", {}, "Running now")),
          h("div", { class: "list" }, ...running.map(threadRow)))
      : null,

    h("section", { class: "card" },
      h("div", { class: "card-title" },
        h("h3", {}, "Recent threads"),
        h("a", { class: "btn btn-ghost", href: "#/threads" }, "All threads")),
      recent.length
        ? h("div", { class: "list" }, ...recent.map(threadRow))
        : h("div", { class: "empty" },
            h("strong", {}, "No threads yet"),
            "Pick a project, create an environment, and start one.")),

    h("section", { class: "card" },
      h("div", { class: "card-title" }, h("h3", {}, "Projects")),
      (boot.projects || []).length
        ? h("div", { class: "grid-2" }, ...boot.projects.map((project) =>
            h("div", { class: "card" },
              h("h3", {}, project.name),
              h("p", { class: "faint mono" }, project.local_path),
              h("div", { class: "cluster" },
                h("span", { class: "chip" },
                  `${project.env_count || 0} environment${project.env_count === 1 ? "" : "s"}`),
                project.running_count
                  ? h("span", { class: "chip ok" }, `${project.running_count} running`)
                  : null))))
        : h("div", { class: "empty" },
            h("strong", {}, "No projects yet"),
            "POST /api/projects with a local_path or repo_url, or run `hwh demo`.")),
  );
  inspector.hidden = true;
  document.querySelector(".shell").classList.add("no-inspector");
}

// ------------------------------------------------------------------- threads
function renderThreadsPage() {
  const threads = (state.bootstrap?.threads || []);
  const rows = h("div", { class: "list", id: "threadRows" }, ...threads.map(threadRow));
  const empty = h("div", { class: "empty", hidden: threads.length > 0 },
    h("strong", {}, threads.length ? "No thread matches" : "No threads yet"),
    threads.length ? "Clear the filter." : "Start one from a project environment.");

  const filter = h("input", {
    class: "btn", type: "search", placeholder: "Filter threads…", value: state.filter,
    style: "width:220px;height:34px",
    oninput: (event) => {
      const query = event.target.value.trim().toLowerCase();
      state.filter = event.target.value;
      let shown = 0;
      for (const row of rows.children) {
        const match = !query || row.dataset.search.includes(query);
        row.hidden = !match;
        if (match) shown += 1;
      }
      empty.hidden = shown > 0;
      const label = empty.querySelector("strong");
      if (label) label.textContent = query ? "No thread matches" : "No threads yet";
    },
  });

  setChildren(main,
    h("div", { class: "page-head" },
      h("div", { class: "grow" },
        h("div", { class: "eyebrow" }, "Threads"),
        h("h1", {}, "Every conversation, one list"),
        h("p", { class: "lede" }, "A thread is a durable conversation with its own event log.")),
      filter),
    h("section", { class: "card" }, rows, empty),
  );
  inspector.hidden = true;
  document.querySelector(".shell").classList.add("no-inspector");
}

// -------------------------------------------------------------------- thread
function closeThreadSocket() {
  if (state.threadSocket) {
    state.threadSocket.close();
    state.threadSocket = null;
  }
}

async function renderThread(threadId) {
  const [detail, events] = await Promise.all([
    api(`/api/threads/${threadId}`),
    api(`/api/threads/${threadId}/events?limit=5000`),
  ]);
  state.thread = detail;
  state.events = events.events;
  state.lastSeq = events.last_seq;
  state.live = null;

  const thread = detail.thread;
  const environment = detail.environment;
  const status = thread.status;

  const transcript = h("div", { class: "transcript", id: "transcript" });
  paintTranscript(transcript);

  const textarea = h("textarea", {
    rows: 1, placeholder: "Message this thread  —  Enter sends, Shift+Enter breaks the line",
    oninput: (event) => {
      event.target.style.height = "auto";
      event.target.style.height = `${Math.min(event.target.scrollHeight, 200)}px`;
    },
    onkeydown: (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendMessage(textarea);
      }
    },
  });

  setChildren(main, 
    h("div", { class: "thread-head" },
      h("div", { class: "grow" },
        h("div", { class: "eyebrow" },
          [detail.project?.name, environment?.branch].filter(Boolean).join(" · ") || "No environment"),
        h("h1", {}, thread.title || "Untitled thread"),
        h("div", { class: "cluster", style: "margin-top:8px" },
          h("span", { class: "status" }, statusDot(status), status.replace("_", " ")),
          environment?.preset ? h("span", { class: "chip" }, `${environment.preset}`) : null,
          thread.model ? h("span", { class: "chip" }, thread.model) : null,
          h("span", { class: "chip" }, `${detail.counts?.messages || 0} messages`),
          h("span", { class: "chip" }, `${detail.counts?.tools || 0} tools`))),
      h("div", { class: "actions" },
        status === "running" || status === "waiting_approval"
          ? h("button", { class: "btn btn-danger", onclick: () => interrupt(thread.id) }, "Interrupt")
          : null,
        status === "failed"
          ? h("button", { class: "btn btn-primary", onclick: () => retry(thread.id) }, "Retry")
          : null,
        h("button", { class: "btn btn-ghost", onclick: () => archiveThread(thread.id) }, "Archive"))),
    transcript,
    h("div", { class: "composer" }, h("div", { class: "composer-inner" },
      textarea,
      h("button", { class: "btn btn-primary", onclick: () => sendMessage(textarea) }, "Send"))),
  );

  paintInspector(detail);
  scrollTranscriptToEnd();
  textarea.focus({ preventScroll: true });
  connectThreadSocket(threadId, state.lastSeq);
}

function paintInspector(detail) {
  const environment = detail.environment;
  const thread = detail.thread;
  inspector.hidden = false;
  document.querySelector(".shell").classList.remove("no-inspector");
  if ((state.computer.environment?.id || null) !== (environment?.id || null)) {
    if (state.computer.terminal) state.computer.terminal.kill();
    Object.assign(state.computer, {
      path: "", entries: [], file: null, loaded: false,
      terminal: null, environment: environment || null,
      diff: null, diffLoaded: false, diffLoading: false, diffFile: null,
    });
  }
  setChildren(inspector, 
    h("h3", {}, "Environment"),
    environment
      ? h("dl", { class: "kv" },
          h("dt", {}, "branch"), h("dd", { class: "mono" }, environment.branch || "—"),
          h("dt", {}, "kind"), h("dd", {}, environment.kind),
          h("dt", {}, "preset"), h("dd", {}, environment.preset),
          h("dt", {}, "path"), h("dd", { class: "mono" }, environment.path))
      : h("p", { class: "faint" }, "This thread has no environment; runs are scoped to the daemon."),

    h("h3", {}, "Runs"),
    h("div", { class: "list" }, ...(detail.runs || []).slice(0, 6).map((run) =>
      h("div", { class: "row" },
        h("span", { class: `dot ${run.status === "failed" ? "bad" : run.status === "done" ? "ok" : "warn"}` }),
        h("span", { class: "row-main" },
          h("span", { class: "row-title mono" }, run.id.slice(-8)),
          h("span", { class: "row-sub" },
            [run.status, run.kind, run.error ? run.error.split("\n")[0] : null]
              .filter(Boolean).join(" · ")))))),

    (detail.approvals || []).length
      ? h("h3", {}, "Waiting on you")
      : h("span"),
    h("div", { class: "stack" }, ...(detail.approvals || []).map((approval) =>
      h("div", { class: "card" },
        h("h3", {}, approval.tool || "tool"),
        h("p", { class: "faint" }, approval.reason || ""),
        h("div", { class: "btn-row" },
          h("button", { class: "btn btn-primary",
            onclick: () => decideApproval(approval.id, "allowed-once") }, "Allow once"),
          h("button", { class: "btn btn-danger",
            onclick: () => decideApproval(approval.id, "rejected") }, "Reject"))))),

    h("h3", {}, "Thread"),
    h("dl", { class: "kv" },
      h("dt", {}, "id"), h("dd", { class: "mono" }, thread.id),
      h("dt", {}, "events"), h("dd", {}, String(thread.last_seq)),
      h("dt", {}, "created"), h("dd", {}, new Date(thread.created_at * 1000).toLocaleString()),
      h("dt", {}, "model"), h("dd", {}, thread.model || "default")),

    h("h3", {}, "Computer"),
    h("div", { id: "computer-slot" }, computerPane()),

    h("h3", {}, "Spawn"),
    h("div", { class: "btn-row" },
      h("button", { class: "btn", onclick: () => spawnChild(thread.id) }, "Child thread…")),
  );
}

// ---------------------------------------------------------------- computer
// The Computer pane is the environment's own surface: files read-only, and a
// PTY shell that lives in the worktree (design §8.5). It survives inspector
// repaints — the terminal element is re-appended, never rebuilt.
function resetComputer() {
  if (state.computer.terminal) state.computer.terminal.kill();
  state.computer = {
    tab: "files", path: "", entries: [], file: null, loaded: false,
    terminal: null, environment: null,
    diff: null, diffLoaded: false, diffLoading: false,
    diffMode: state.computer?.diffMode || "split", diffFile: null,
    previewUrl: state.computer?.previewUrl || "http://127.0.0.1:9120",
    previewViewport: state.computer?.previewViewport || "desktop",
    previewNonce: 0,
  };
  document.querySelector(".shell")?.classList.remove("inspector-wide");
}

async function apiText(path) {
  const response = await fetch(path, { credentials: "same-origin" });
  if (response.status === 401) {
    window.location.href = "/login";
    throw new Error("signed out");
  }
  const text = await response.text();
  if (!response.ok) {
    let message = text;
    try {
      message = JSON.parse(text).error?.message || text;
    } catch {
      /* plain-text error */
    }
    throw new Error(message.slice(0, 200));
  }
  return text;
}

function computerPane() {
  const environment = state.computer.environment;
  if (!environment) return h("p", { class: "faint" }, "This thread has no environment to open.");
  const pty = state.bootstrap?.pty || {};
  const tab = state.computer.tab === "terminal" && !pty.enabled ? "files" : state.computer.tab;
  const wide = document.querySelector(".shell")?.classList.contains("inspector-wide");
  const changedCount = state.computer.diff?.totals?.files_changed || 0;

  const selectTab = (nextTab, autoWide = false) => {
    state.computer.tab = nextTab;
    if (autoWide) document.querySelector(".shell")?.classList.add("inspector-wide");
    repaintComputer();
  };

  const tabs = h("div", { class: "segmented" },
    h("button", {
      class: tab === "files" ? "on" : "",
      onclick: () => selectTab("files"),
    }, "Files"),
    h("button", {
      class: tab === "diff" ? "on" : "",
      onclick: () => selectTab("diff", true),
    }, changedCount ? `Diff · ${changedCount}` : "Diff"),
    h("button", {
      class: tab === "preview" ? "on" : "",
      onclick: () => selectTab("preview", true),
    }, "Preview"),
    pty.enabled
      ? h("button", {
          class: tab === "terminal" ? "on" : "",
          onclick: () => selectTab("terminal"),
        }, "Terminal")
      : h("button", { class: "off", disabled: true, title: "HWH_PTY is off on this harness" },
          "Terminal off"),
    h("button", {
      class: wide ? "on" : "",
      title: wide ? "Narrow the inspector" : "Widen the inspector",
      onclick: () => {
        document.querySelector(".shell").classList.toggle("inspector-wide");
        repaintComputer();
      },
    }, wide ? "⇤" : "⇥"));

  let body;
  if (tab === "terminal") body = terminalPane(environment);
  else if (tab === "diff") body = diffPane(environment);
  else if (tab === "preview") body = previewPane(environment);
  else body = filesPane(environment);

  return h("div", { class: "computer" }, tabs, body);
}

function repaintComputer() {
  const slot = document.getElementById("computer-slot");
  if (slot) setChildren(slot, computerPane());
}

function terminalPane(environment) {
  const view = ensureTerminal(environment);
  const hadFocus = view.pre === document.activeElement;
  if (!view.actions.childElementCount) {
    view.actions.append(
      h("button", { class: "btn", onclick: () => view.send("\x03") }, "Ctrl-C"),
      h("button", { class: "btn", onclick: () => view.clear() }, "Clear"),
      h("button", { class: "btn", onclick: () => restartTerminal(environment) }, "Restart"),
      h("button", { class: "btn", onclick: () => closeTerminal() }, "Close"));
  }
  const host = h("div", { class: "term-host" }, view.node, view.statusEl);
  setTimeout(() => {
    if (hadFocus) view.pre.focus({ preventScroll: true });
    view.measure(); // not rAF: it is paused in a hidden page
  }, 0);
  return host;
}

function ensureTerminal(environment) {
  const existing = state.computer.terminal;
  if (existing && existing.environmentId === environment.id) return existing;
  if (existing) existing.kill();
  const view = new TerminalView({ environmentId: environment.id, api, toast });
  state.computer.terminal = view;
  view.open();
  return view;
}

function closeTerminal() {
  const view = state.computer.terminal;
  state.computer.terminal = null;
  if (view) view.kill();
  repaintComputer();
}

function restartTerminal(environment) {
  closeTerminal();
  state.computer.terminal = null;
  ensureTerminal(environment);
  repaintComputer();
}

function filesPane(environment) {
  const path = state.computer.path;
  const pane = h("div", { class: "files-pane" });

  pane.append(h("div", { class: "crumb" },
    h("button", {
      class: "btn btn-ghost",
      title: "Up one directory",
      onclick: () => loadFiles(environment.id, path.split("/").slice(0, -1).join("/")),
    }, "↑"),
    h("span", { class: "mono" }, `/${path}`)));

  if (!state.computer.loaded) {
    state.computer.loaded = true;
    loadFiles(environment.id, path);
  }

  const entries = state.computer.entries || [];
  pane.append(entries.length
    ? h("div", { class: "file-list" }, ...entries.map((entry) => h("button", {
        class: "file-row",
        onclick: () => entry.type === "dir"
          ? loadFiles(environment.id, entry.path)
          : openFile(environment.id, entry.path),
      },
      h("span", { class: entry.type === "dir" ? "file-name dir" : "file-name" },
        entry.type === "dir" ? `▸ ${entry.name}/` : entry.name),
      entry.type === "dir" ? null : h("span", { class: "faint mono" }, `${entry.size} B`))))
    : h("p", { class: "faint" }, "This directory is empty."));

  if (state.computer.file) {
    const file = state.computer.file;
    const href = `/api/environments/${environment.id}/file`
      + `?path=${encodeURIComponent(file.path)}&download=1`;
    pane.append(h("div", { class: "file-preview" },
      h("div", { class: "file-preview-head" },
        h("span", { class: "mono" }, file.path),
        h("a", { class: "btn btn-ghost", href, download: "" }, "Download")),
      h("pre", { class: "file-text" }, file.text)));
  }
  return pane;
}

async function loadFiles(environmentId, path) {
  try {
    const data = await api(`/api/environments/${environmentId}/files?path=${encodeURIComponent(path)}`);
    state.computer.path = data.path;
    state.computer.entries = data.entries;
    state.computer.file = null;
  } catch (error) {
    toast(error.message, "bad");
  }
  repaintComputer();
}

async function openFile(environmentId, path) {
  try {
    const text = await apiText(`/api/environments/${environmentId}/file?path=${encodeURIComponent(path)}`);
    state.computer.file = { path, text: text.slice(0, 40000) };
  } catch (error) {
    toast(error.message, "bad");
  }
  repaintComputer();
}

async function loadDiff(environmentId) {
  if (state.computer.diffLoading) return;
  state.computer.diffLoading = true;
  try {
    const data = await api(`/api/environments/${environmentId}/diff`);
    state.computer.diff = data;
    state.computer.diffLoaded = true;
    if (state.computer.diffFile && !(data.files || []).some((f) => f.path === state.computer.diffFile)) {
      state.computer.diffFile = null;
    }
  } catch (error) {
    toast(`Diff failed: ${error.message}`, "bad");
  } finally {
    state.computer.diffLoading = false;
    repaintComputer();
  }
}

function diffPane(environment) {
  if (!state.computer.diffLoaded && !state.computer.diffLoading) {
    loadDiff(environment.id);
  }
  const diff = state.computer.diff;
  const mode = state.computer.diffMode || "split";
  const selectedFile = state.computer.diffFile;
  const files = diff?.files || [];
  const totals = diff?.totals || { files_changed: 0, additions: 0, deletions: 0 };

  const toolbar = h("div", { class: "diff-toolbar" },
    h("div", { class: "cluster" },
      h("span", { class: `dot ${diff?.dirty ? "warn" : "ok"}` }),
      h("span", { class: "mono" }, diff?.branch || environment.branch || "HEAD"),
      h("span", { class: "diff-stat-add mono" }, `+${totals.additions}`),
      h("span", { class: "diff-stat-del mono" }, `-${totals.deletions}`),
      h("span", { class: "faint" }, `${totals.files_changed} file${totals.files_changed === 1 ? "" : "s"}`)),
    h("div", { class: "cluster" },
      h("button", {
        class: `btn btn-xs ${mode === "split" ? "btn-primary" : "btn-ghost"}`,
        onclick: () => { state.computer.diffMode = "split"; repaintComputer(); },
      }, "Split"),
      h("button", {
        class: `btn btn-xs ${mode === "unified" ? "btn-primary" : "btn-ghost"}`,
        onclick: () => { state.computer.diffMode = "unified"; repaintComputer(); },
      }, "Unified"),
      h("button", {
        class: "btn btn-xs btn-ghost",
        onclick: () => loadDiff(environment.id),
      }, state.computer.diffLoading ? "…" : "↻")));

  if (!diff && state.computer.diffLoading) {
    return h("div", { class: "diff-pane" }, toolbar, h("p", { class: "faint" }, "Loading git diff…"));
  }

  if (!files.length) {
    return h("div", { class: "diff-pane" }, toolbar,
      h("div", { class: "empty", style: "margin-top:8px" },
        h("strong", {}, "Working tree is clean"),
        "Edits and untracked files in this worktree appear here automatically."));
  }

  const pills = h("div", { class: "diff-pills" },
    h("button", {
      class: `diff-pill ${!selectedFile ? "on" : ""}`,
      onclick: () => { state.computer.diffFile = null; repaintComputer(); },
    }, `All (${files.length})`),
    ...files.map((file) => h("button", {
      class: `diff-pill ${selectedFile === file.path ? "on" : ""}`,
      onclick: () => { state.computer.diffFile = file.path; repaintComputer(); },
      title: file.path,
    },
    h("span", { class: `diff-badge status-${(file.status || "M").toLowerCase()}` }, file.status || "M"),
    h("span", { class: "mono" }, file.path.split("/").pop()),
    h("span", { class: "diff-stat-add mono" }, `+${file.additions}`),
    file.deletions ? h("span", { class: "diff-stat-del mono" }, `-${file.deletions}`) : null)));

  const visibleFiles = selectedFile ? files.filter((f) => f.path === selectedFile) : files;
  const cards = visibleFiles.map((file) => renderDiffFileCard(environment, file, mode));

  return h("div", { class: "diff-pane" }, toolbar, pills, h("div", { class: "diff-files" }, ...cards));
}

function renderDiffFileCard(environment, file, mode) {
  const head = h("div", { class: "diff-file-head" },
    h("div", { class: "cluster" },
      h("span", { class: `diff-badge status-${(file.status || "M").toLowerCase()}` }, file.status || "M"),
      h("span", { class: "mono diff-file-path" }, file.path)),
    h("div", { class: "cluster" },
      h("span", { class: "diff-stat-add mono" }, `+${file.additions}`),
      h("span", { class: "diff-stat-del mono" }, `-${file.deletions}`),
      file.status !== "D"
        ? h("button", {
            class: "btn btn-xs btn-ghost",
            onclick: () => {
              state.computer.tab = "files";
              openFile(environment.id, file.path);
            },
          }, "Open file")
        : null));

  const hunks = file.hunks || [];
  if (!hunks.length) {
    return h("div", { class: "diff-file-card" }, head,
      h("div", { class: "faint", style: "padding:8px 10px;font-size:11.5px" },
        "Binary or mode-only change."));
  }

  const hunkNodes = hunks.map((hunk) => {
    const hunkHeader = h("div", { class: "diff-hunk-head mono" }, hunk.header);
    if (mode === "split") {
      const rows = (hunk.rows || []).map((row) => h("tr", { class: "diff-split-row" },
        h("td", { class: `diff-ln kind-${row.left_kind}` }, row.left_no ?? ""),
        h("td", { class: `diff-code kind-${row.left_kind}` }, row.left_text || ""),
        h("td", { class: `diff-ln kind-${row.right_kind}` }, row.right_no ?? ""),
        h("td", { class: `diff-code kind-${row.right_kind}` }, row.right_text || "")));
      return h("div", { class: "diff-hunk" }, hunkHeader,
        h("div", { class: "diff-table-wrap" }, h("table", { class: "diff-table split" }, h("tbody", {}, ...rows))));
    }
    const rows = (hunk.lines || []).map((line) => h("tr", { class: `diff-unified-row kind-${line.kind}` },
      h("td", { class: `diff-ln kind-${line.kind}` }, line.old_no ?? ""),
      h("td", { class: `diff-ln kind-${line.kind}` }, line.new_no ?? ""),
      h("td", { class: `diff-marker kind-${line.kind}` },
        line.kind === "add" ? "+" : line.kind === "del" ? "-" : " "),
      h("td", { class: `diff-code kind-${line.kind}` }, line.text || "")));
    return h("div", { class: "diff-hunk" }, hunkHeader,
      h("div", { class: "diff-table-wrap" }, h("table", { class: "diff-table unified" }, h("tbody", {}, ...rows))));
  });

  return h("div", { class: "diff-file-card" }, head, ...hunkNodes);
}

function previewPane() {
  const url = state.computer.previewUrl || "http://127.0.0.1:9120";
  const viewport = state.computer.previewViewport || "desktop";
  const urlInput = h("input", {
    class: "btn preview-url-input mono",
    type: "url",
    value: url,
    placeholder: "http://127.0.0.1:3000",
    onkeydown: (event) => {
      if (event.key === "Enter") {
        state.computer.previewUrl = event.target.value.trim() || "http://127.0.0.1:9120";
        state.computer.previewNonce += 1;
        repaintComputer();
      }
    },
  });

  const presets = [
    { label: ":9120 Desktop", url: "http://127.0.0.1:9120" },
    { label: ":9230 HWH", url: `${window.location.origin}/#/home` },
    { label: ":3000", url: "http://127.0.0.1:3000" },
    { label: ":5173", url: "http://127.0.0.1:5173" },
    { label: ":8000", url: "http://127.0.0.1:8000" },
  ];

  const sep = url.includes("?") ? "&" : "?";
  const iframeSrc = state.computer.previewNonce
    ? `${url}${sep}_hwh=${state.computer.previewNonce}`
    : url;

  return h("div", { class: "preview-pane" },
    h("div", { class: "preview-toolbar" },
      urlInput,
      h("button", {
        class: "btn btn-xs btn-primary",
        onclick: () => {
          state.computer.previewUrl = urlInput.value.trim() || url;
          state.computer.previewNonce += 1;
          repaintComputer();
        },
      }, "Go"),
      h("button", {
        class: "btn btn-xs btn-ghost",
        title: "Reload preview",
        onclick: () => {
          state.computer.previewNonce += 1;
          repaintComputer();
        },
      }, "↻"),
      h("a", {
        class: "btn btn-xs btn-ghost",
        href: url,
        target: "_blank",
        rel: "noreferrer noopener",
        title: "Open in new tab",
      }, "↗")),
    h("div", { class: "preview-subbar" },
      h("div", { class: "cluster" },
        ...presets.map((preset) => h("button", {
          class: `diff-pill ${url === preset.url ? "on" : ""}`,
          onclick: () => {
            state.computer.previewUrl = preset.url;
            state.computer.previewNonce += 1;
            repaintComputer();
          },
        }, preset.label))),
      h("div", { class: "cluster" },
        ...[
          { id: "desktop", label: "100%" },
          { id: "tablet", label: "768px" },
          { id: "mobile", label: "390px" },
        ].map((vp) => h("button", {
          class: `btn btn-xs ${viewport === vp.id ? "btn-primary" : "btn-ghost"}`,
          onclick: () => {
            state.computer.previewViewport = vp.id;
            repaintComputer();
          },
        }, vp.label)))),
    h("div", { class: `preview-stage viewport-${viewport}` },
      h("iframe", {
        class: "preview-frame",
        src: iframeSrc,
        title: "Live app preview",
      })));
}

function paintTranscript(container) {
  const nodes = [];
  const renderedTools = new Set();
  const finalTool = new Map();
  const answered = new Map();

  for (const event of state.events) {
    if (event.type === "tool.done" || event.type === "tool.updated") {
      finalTool.set(event.payload.id, event);
    }
    if (event.type === "approval.answered") {
      answered.set(event.payload.approval_id, event.payload.decision);
    }
  }

  for (const event of state.events) {
    const payload = event.payload || {};
    switch (event.type) {
      case "message.appended":
        if (payload.role === "user") nodes.push(userBubble(payload.text));
        else nodes.push(assistantBubble(payload));
        break;
      case "tool.started": {
        const final = finalTool.get(payload.id) || event;
        renderedTools.add(payload.id);
        nodes.push(toolCard({ ...payload, status: final.payload.status || "done",
          detail: final.payload.detail || payload.detail }));
        break;
      }
      case "tool.done":
      case "tool.updated":
        if (!renderedTools.has(payload.id)) {
          renderedTools.add(payload.id);
          nodes.push(toolCard(payload));
        }
        break;
      case "run.queued":
        nodes.push(h("div", { class: "divider" }, "queued"));
        break;
      case "run.started":
        nodes.push(h("div", { class: "divider" }, "running"));
        break;
      case "run.finished":
        nodes.push(h("div", { class: "divider" },
          `finished in ${payload.duration_seconds ?? "?"}s`));
        break;
      case "run.failed":
        nodes.push(failureCard(payload));
        break;
      case "run.interrupted":
        nodes.push(h("div", { class: "failure" },
          h("h4", {}, "Run interrupted"),
          h("p", { class: "reason" }, payload.reason || "stopped"),
          h("div", { class: "btn-row", style: "margin-top:8px" },
            h("button", { class: "btn", onclick: () => retry(state.thread.thread.id) }, "Retry"))));
        break;
      case "approval.requested":
        nodes.push(approvalCard(payload, answered.get(payload.approval_id)));
        break;
      case "approval.answered":
        break;
      default:
        break;
    }
  }

  if (state.live) {
    nodes.push(h("div", { class: "msg msg-assistant live" },
      h("div", { class: "body" }, state.live.text)));
  }
  if (!nodes.length) {
    nodes.push(h("div", { class: "empty" },
      h("strong", {}, "Nothing here yet"),
      "Send a message; the transcript streams in and survives a reload."));
  }
  container.replaceChildren(...nodes);
}

function userBubble(text) {
  return h("div", { class: "msg msg-user" }, h("div", { class: "body" }, text));
}

function assistantBubble(payload) {
  return h("div", { class: "msg msg-assistant" },
    h("div", { class: "body", html: markdown(payload.text || "") }),
    h("div", { class: "meta" },
      [payload.mock ? "mock runtime" : null,
       payload.usage?.completion_tokens ? `${payload.usage.completion_tokens} tokens` : null]
        .filter(Boolean).join(" · ")));
}

function toolEmoji(name) {
  const n = (name || "").toLowerCase();
  if (n.includes("bash") || n.includes("shell") || n.includes("terminal")) return "💻";
  if (n.includes("read") || n.includes("cat") || n.includes("view")) return "📖";
  if (n.includes("edit") || n.includes("write") || n.includes("patch")) return "✏️";
  if (n.includes("search") || n.includes("grep") || n.includes("find")) return "🔍";
  if (n.includes("git")) return "🌿";
  if (n.includes("test")) return "🧪";
  if (n.includes("http") || n.includes("fetch") || n.includes("request")) return "🌐";
  if (n.includes("file") || n.includes("ls")) return "📁";
  if (n.includes("approval") || n.includes("ask")) return "🤔";
  return "🧰";
}

function statusEmoji(status) {
  const s = (status || "").toLowerCase();
  if (s === "running" || s === "started") return "⚡";
  if (s === "done" || s === "ok" || s === "success") return "✅";
  if (s === "failed" || s === "error") return "🚨";
  if (s === "queued") return "⏳";
  return "✨";
}

function toolCard(payload) {
  const summary = h("summary", {},
    h("span", { class: "tool-name" }, `${toolEmoji(payload.name)} ${payload.name || "tool"}`),
    h("span", {}, payload.summary || ""),
    h("span", { class: "faint", style: "margin-left:auto" }, `${statusEmoji(payload.status)} ${payload.status || ""}`));
  const details = [];
  if (payload.detail) details.push(h("div", { class: "tool-detail" }, payload.detail));
  if (payload.route) details.push(h("div", { class: "tool-detail" }, JSON.stringify(payload.route, null, 2)));
  return h("details", { class: "tool", dataset: { status: payload.status || "done" } },
    summary, ...details);
}

function approvalCard(payload, decision) {
  return h("div", { class: "approval" },
    h("h4", {}, `🤔 Approval needed — ${payload.tool || "tool"}`),
    h("div", { class: "reason", html: markdown(payload.reason || "The agent wants to do something irreversible.") }),
    h("div", { class: "route" }, JSON.stringify(payload.route || {}, null, 2)),
    decision
      ? h("div", { class: "muted" }, `Decision: ${decision}`)
      : h("div", { class: "btn-row" },
          h("button", { class: "btn btn-primary",
            onclick: () => decideApproval(payload.approval_id, "allowed-once") }, "Allow once"),
          h("button", { class: "btn btn-danger",
            onclick: () => decideApproval(payload.approval_id, "rejected") }, "Reject"),
          h("button", { class: "btn btn-ghost",
            onclick: () => decideApproval(payload.approval_id, "unavailable") }, "Not available")));
}

function failureCard(payload) {
  return h("div", { class: "failure" },
    h("h4", {}, "Run failed"),
    h("p", { class: "reason" }, payload.error || "unknown error"),
    payload.hint ? h("div", { class: "hint" }, payload.hint) : null,
    h("div", { class: "btn-row", style: "margin-top:8px" },
      payload.retryable !== false
        ? h("button", { class: "btn", onclick: () => retry(state.thread?.thread?.id) }, "Retry")
        : null));
}

function scrollTranscriptToEnd() {
  requestAnimationFrame(() => {
    main.scrollTop = main.scrollHeight;
  });
}

// ------------------------------------------------------------------- actions
async function sendMessage(textarea) {
  const text = textarea.value.trim();
  if (!text || !state.thread) return;
  textarea.value = "";
  textarea.style.height = "auto";
  try {
    await api(`/api/threads/${state.thread.thread.id}/messages`, {
      method: "POST", body: { text },
    });
  } catch (error) {
    toast(`Send failed: ${error.message}`, "bad");
    textarea.value = text;
  }
}

async function interrupt(threadId) {
  try {
    await api(`/api/threads/${threadId}/interrupt`, { method: "POST" });
    toast("Interrupt sent", "ok");
  } catch (error) {
    toast(error.message, "bad");
  }
}

async function retry(threadId) {
  if (!threadId) return;
  try {
    await api(`/api/threads/${threadId}/retry`, { method: "POST" });
    toast("Retrying", "ok");
  } catch (error) {
    toast(error.message, "bad");
  }
}

async function archiveThread(threadId) {
  try {
    await api(`/api/threads/${threadId}/archive`, { method: "POST" });
    toast("Thread archived", "ok");
    await refreshBootstrap();
    window.location.hash = "#/threads";
  } catch (error) {
    toast(error.message, "bad");
  }
}

async function decideApproval(approvalId, decision) {
  try {
    await api(`/api/approvals/${approvalId}/decide`, { method: "POST", body: { decision } });
    toast(`Decision: ${decision}`, "ok");
    if (state.route.name === "thread" && state.route.id) await refreshThread();
    else { await refreshBootstrap(); renderHome(); }
  } catch (error) {
    toast(error.message, "bad");
  }
}

async function spawnChild(threadId) {
  const prompt = window.prompt("What should the child thread do?");
  if (!prompt) return;
  try {
    const result = await api(`/api/threads/${threadId}/spawn`, {
      method: "POST", body: { prompt },
    });
    toast("Child thread started", "ok");
    await refreshBootstrap();
    window.location.hash = `#/thread/${result.thread.id}`;
  } catch (error) {
    toast(error.message, "bad");
  }
}

async function refreshThread() {
  const threadId = state.thread?.thread?.id;
  if (!threadId) return;
  const [detail, events] = await Promise.all([
    api(`/api/threads/${threadId}`),
    api(`/api/threads/${threadId}/events?limit=5000`),
  ]);
  state.thread = detail;
  state.events = events.events;
  state.lastSeq = events.last_seq;
  state.live = null;
  const transcript = document.getElementById("transcript");
  if (transcript) {
    paintTranscript(transcript);
    paintInspector(detail);
    scrollTranscriptToEnd();
  }
}

// ---------------------------------------------------------------------- tasks
const COLUMNS = ["backlog", "todo", "in_progress", "review", "done"];

async function renderTasks() {
  const { tasks } = await api("/api/tasks");
  const input = h("input", {
    class: "btn", style: "height:34px;min-width:220px",
    placeholder: "New task title…",
    onkeydown: async (event) => {
      if (event.key !== "Enter") return;
      const title = event.target.value.trim();
      if (!title) return;
      try {
        await api("/api/tasks", { method: "POST", body: { title } });
        event.target.value = "";
        await renderTasks();
      } catch (error) {
        toast(error.message, "bad");
      }
    },
  });

  setChildren(main, 
    h("div", { class: "page-head" },
      h("div", { class: "grow" },
        h("div", { class: "eyebrow" }, "Tasks"),
        h("h1", {}, "Work that outlives a chat"),
        h("p", { class: "lede" }, "Dispatch a task into an environment to get a thread and a run.")),
      input),
    h("div", { class: "kanban" }, ...COLUMNS.map((column) => {
      const items = tasks.filter((task) => task.status === column);
      return h("div", { class: "column" },
        h("h4", {}, `${column.replace("_", " ")} · ${items.length}`),
        items.length
          ? items.map((task) => h("div", { class: "task" },
              h("span", { class: "task-title" }, task.title),
              h("span", { class: "task-meta" },
                [task.priority !== "normal" ? task.priority : null,
                 task.assignee_thread_id ? "dispatched" : null]
                  .filter(Boolean).join(" · ") || "unassigned"),
              task.assignee_thread_id
                ? h("a", { class: "btn btn-ghost",
                    href: `#/thread/${task.assignee_thread_id}` }, "Open thread")
                : h("button", { class: "btn",
                    onclick: () => dispatchTask(task.id) }, "Dispatch")))
          : h("div", { class: "faint", style: "padding:6px 8px" }, "empty"));
    })),
  );
  inspector.hidden = true;
  document.querySelector(".shell").classList.add("no-inspector");
}

async function dispatchTask(taskId) {
  try {
    const result = await api(`/api/tasks/${taskId}/dispatch`, { method: "POST" });
    toast("Dispatched", "ok");
    await refreshBootstrap();
    window.location.hash = `#/thread/${result.thread.id}`;
  } catch (error) {
    toast(`${error.message}${error.hint ? ` — ${error.hint}` : ""}`, "bad");
  }
}

// ------------------------------------------------------------------- settings
async function renderSettings() {
  const [doctor, audit] = await Promise.all([
    api("/api/doctor").catch((error) => ({ ok: false, checks: [], error: error.message })),
    api("/api/audit?limit=20").catch(() => ({ entries: [] })),
  ]);
  const boot = state.bootstrap;

  setChildren(main, 
    h("div", { class: "page-head" },
      h("div", { class: "grow" },
        h("div", { class: "eyebrow" }, "Settings"),
        h("h1", {}, "How this harness is wired"),
        h("p", { class: "lede" }, "Read-only facts from the daemon; change them in hwh.yaml or HWH_* env."))),

    h("section", { class: "card" },
      h("div", { class: "card-title" },
        h("h3", {}, "Doctor"),
        h("span", { class: `chip ${doctor.ok ? "ok" : "bad"}` }, doctor.ok ? "ready" : "not ready")),
      h("div", { class: "list" }, ...(doctor.checks || []).map((check) =>
        h("div", { class: "row" },
          h("span", { class: `dot ${check.ok ? "ok" : "bad"}` }),
          h("span", { class: "row-main" },
            h("span", { class: "row-title" }, check.name),
            h("span", { class: "row-sub" }, check.detail || "")),
          check.fix ? h("span", { class: "row-meta mono" }, check.fix) : null)))),

    h("section", { class: "card" },
      h("div", { class: "card-title" }, h("h3", {}, "Runtime")),
      h("dl", { class: "kv" },
        h("dt", {}, "name"), h("dd", {}, boot.runtime?.name || "—"),
        h("dt", {}, "mode"), h("dd", {}, boot.runtime?.is_mock
          ? "synthetic (no model calls)"
          : boot.runtime?.enforcement === "full"
            ? "Hermes Gateway JSON-RPC (persistent session + live tool & approval bridge)"
            : "hermes CLI, one-shot per turn"),
        h("dt", {}, "enforcement"), h("dd", {}, boot.runtime?.enforcement === "full"
          ? "full — presets (read-only, balanced, unrestricted) enforced in real time"
          : `${boot.runtime?.enforcement || "partial"} — preset is recorded, not enforced by the CLI`),
        h("dt", {}, "version"), h("dd", { class: "mono" }, boot.runtime?.version || "—"),
        h("dt", {}, "auth"), h("dd", {}, boot.auth?.mode || "—"),
        h("dt", {}, "health"), h("dd", {}, boot.health?.ok ? "ok" : "degraded"))),

    h("section", { class: "card" },
      h("div", { class: "card-title" }, h("h3", {}, "Appearance")),
      h("div", { class: "btn-row" },
        ...["auto", "light", "dark"].map((theme) =>
          h("button", {
            class: `btn ${state.theme === theme ? "btn-primary" : ""}`,
            onclick: () => { state.theme = theme; applyTheme(); renderSettings(); },
          }, theme)))),

    h("section", { class: "card" },
      h("div", { class: "card-title" }, h("h3", {}, "Audit trail")),
      (audit.entries || []).length
        ? h("div", { class: "list" }, ...audit.entries.map((entry) =>
            h("div", { class: "row" },
              h("span", { class: "row-main" },
                h("span", { class: "row-title mono" }, entry.action),
                h("span", { class: "row-sub" }, `${entry.actor || "system"} · ${entry.target || ""}`)),
              h("span", { class: "row-meta" }, relTime(entry.ts)))))
        : h("div", { class: "empty" }, h("strong", {}, "No audited actions yet"),
            "Approvals and decisions land here.")),
  );
  inspector.hidden = true;
  document.querySelector(".shell").classList.add("no-inspector");
}

// ----------------------------------------------------------------- websocket
function connectThreadSocket(threadId, since) {
  closeThreadSocket();
  const scheme = window.location.protocol === "https:" ? "wss" : "ws";
  const socket = new WebSocket(
    `${scheme}://${window.location.host}/api/ws?thread_id=${encodeURIComponent(threadId)}&since=${since}`);
  state.threadSocket = socket;

  socket.onmessage = (message) => {
    let frame;
    try { frame = JSON.parse(message.data); } catch { return; }
    if (frame.type === "hello" || frame.type === "replayed" || frame.type === "ping") return;
    if (frame.type !== "event") return;
    const event = frame.event;
    if (state.route.name !== "thread" || state.route.id !== threadId) return;

    if (event.type === "message.delta") {
      if (!state.live) state.live = { runId: event.payload.run_id, text: "" };
      state.live.text += event.payload.text || "";
      const live = document.querySelector(".msg.live .body");
      if (live) {
        live.textContent = state.live.text;
        scrollTranscriptToEnd();
      } else {
        const container = document.getElementById("transcript");
        if (container) paintTranscript(container);
      }
      return;
    }

    if (event.durable && event.seq) {
      if (event.seq <= state.lastSeq) return;
      state.events.push(event);
      state.lastSeq = event.seq;
      if (event.type === "message.appended" && event.payload.role === "assistant") {
        state.live = null;
      }
      if (["run.finished", "run.failed", "run.interrupted", "approval.requested",
           "approval.answered", "thread.updated", "tool.done"].includes(event.type)) {
        refreshThread().catch(() => {});
        if (state.computer.tab === "diff" && state.computer.environment?.id) {
          loadDiff(state.computer.environment.id);
        }
      } else {
        const container = document.getElementById("transcript");
        if (container) {
          paintTranscript(container);
          scrollTranscriptToEnd();
        }
      }
    }
  };

  socket.onclose = () => {
    if (state.threadSocket === socket && state.route.name === "thread") {
      setTimeout(() => {
        if (state.route.name === "thread" && state.route.id === threadId) {
          connectThreadSocket(threadId, state.lastSeq);
        }
      }, 1500);
    }
  };
}

function connectGlobalSocket() {
  const scheme = window.location.protocol === "https:" ? "wss" : "ws";
  const socket = new WebSocket(`${scheme}://${window.location.host}/api/ws?scope=all`);
  state.globalSocket = socket;
  let pending = null;
  socket.onmessage = (message) => {
    let frame;
    try { frame = JSON.parse(message.data); } catch { return; }
    if (frame.type !== "event") return;
    clearTimeout(pending);
    pending = setTimeout(async () => {
      try {
        await refreshBootstrap();
        if (state.route.name === "home") renderHome();
        if (state.route.name === "threads") renderThreadsPage();
      } catch { /* the socket will retry */ }
    }, 700);
  };
  socket.onclose = () => setTimeout(connectGlobalSocket, 3000);
}

// ---------------------------------------------------------- command palette
function buildCommandItems(query = "") {
  const q = query.trim().toLowerCase();
  const boot = state.bootstrap || {};
  const items = [];

  for (const need of (boot.needs_you || [])) {
    if (need.kind === "approval") {
      items.push({
        group: "Needs you",
        title: `Allow once: ${need.title || "Approval"}`,
        sub: need.summary || "",
        shortcut: "Alt+A",
        run: () => decideApproval(need.id, "allowed-once"),
      });
      items.push({
        group: "Needs you",
        title: `Reject: ${need.title || "Approval"}`,
        sub: need.summary || "",
        shortcut: "Alt+R",
        run: () => decideApproval(need.id, "rejected"),
      });
    }
  }

  items.push(
    {
      group: "Actions",
      title: "New thread in active environment…",
      sub: "Create a fresh thread and open it",
      run: async () => {
        const title = window.prompt("Thread title (optional):", "New thread");
        if (title === null) return;
        const envId = state.computer?.environment?.id || boot.threads?.[0]?.environment_id || null;
        const created = await api("/api/threads", {
          method: "POST",
          body: { title: title.trim() || "Untitled thread", environment_id: envId },
        });
        await refreshBootstrap();
        window.location.hash = `#/thread/${created.thread.id}`;
      },
    },
    {
      group: "Navigation",
      title: "Go to Home · Triage & Needs You",
      sub: "#/home",
      run: () => { window.location.hash = "#/home"; },
    },
    {
      group: "Navigation",
      title: "Go to All Threads",
      sub: "#/threads",
      shortcut: "/",
      run: () => { window.location.hash = "#/threads"; },
    },
    {
      group: "Navigation",
      title: "Go to Tasks Board",
      sub: "#/tasks",
      run: () => { window.location.hash = "#/tasks"; },
    },
    {
      group: "Navigation",
      title: "Go to Settings & Doctor",
      sub: "#/settings",
      run: () => { window.location.hash = "#/settings"; },
    },
  );

  if (state.route.name === "thread" && state.computer.environment) {
    items.push(
      {
        group: "Computer Drawer",
        title: "Open Split Git Diff Explorer",
        sub: state.computer.environment.branch || "worktree diff",
        run: () => {
          state.computer.tab = "diff";
          document.querySelector(".shell")?.classList.add("inspector-wide");
          repaintComputer();
        },
      },
      {
        group: "Computer Drawer",
        title: "Open Live App Preview",
        sub: state.computer.previewUrl,
        run: () => {
          state.computer.tab = "preview";
          document.querySelector(".shell")?.classList.add("inspector-wide");
          repaintComputer();
        },
      },
      {
        group: "Computer Drawer",
        title: "Open Interactive Worktree Terminal",
        sub: state.computer.environment.path,
        run: () => {
          state.computer.tab = "terminal";
          repaintComputer();
        },
      },
      {
        group: "Computer Drawer",
        title: "Open Worktree Files Browser",
        sub: state.computer.environment.path,
        run: () => {
          state.computer.tab = "files";
          repaintComputer();
        },
      },
    );
  }

  items.push({
    group: "Appearance",
    title: `Switch theme (current: ${state.theme})`,
    sub: "Cycle dark / light / auto",
    run: () => {
      state.theme = state.theme === "dark" ? "light" : state.theme === "light" ? "auto" : "dark";
      applyTheme();
      toast(`Theme: ${state.theme}`);
    },
  });

  for (const thread of (boot.threads || []).slice(0, 25)) {
    items.push({
      group: "Threads",
      title: thread.title || "Untitled thread",
      sub: [thread.project_name, thread.branch, thread.status].filter(Boolean).join(" · "),
      run: () => { window.location.hash = `#/thread/${thread.id}`; },
    });
  }

  if (!q) return items;
  return items.filter((item) =>
    `${item.group} ${item.title} ${item.sub || ""}`.toLowerCase().includes(q));
}

function openCommandPalette() {
  state.cmdk.open = true;
  state.cmdk.query = "";
  state.cmdk.index = 0;
  renderCommandPalette();
}

function closeCommandPalette() {
  state.cmdk.open = false;
  const modal = document.getElementById("cmdkModal");
  if (modal) modal.hidden = true;
}

function renderCommandPalette() {
  const modal = document.getElementById("cmdkModal");
  if (!modal) return;
  if (!state.cmdk.open) {
    modal.hidden = true;
    return;
  }
  modal.hidden = false;
  const items = buildCommandItems(state.cmdk.query);
  state.cmdk.items = items;
  if (state.cmdk.index >= items.length) state.cmdk.index = Math.max(0, items.length - 1);

  const listNode = h("div", { class: "cmdk-list", id: "cmdkList" });
  const paintList = () => {
    const filtered = buildCommandItems(state.cmdk.query);
    state.cmdk.items = filtered;
    if (state.cmdk.index >= filtered.length) state.cmdk.index = Math.max(0, filtered.length - 1);
    if (!filtered.length) {
      setChildren(listNode, h("div", { class: "empty" }, "No matching commands or threads."));
      return;
    }
    setChildren(listNode, ...filtered.map((item, idx) => h("button", {
      class: `cmdk-item ${idx === state.cmdk.index ? "active" : ""}`,
      onclick: async () => {
        closeCommandPalette();
        await item.run();
      },
      onmouseenter: () => {
        state.cmdk.index = idx;
      },
    },
    h("div", { class: "cmdk-item-main" },
      h("span", { class: "cmdk-group" }, item.group),
      h("span", { class: "cmdk-title" }, item.title),
      item.sub ? h("span", { class: "cmdk-sub" }, item.sub) : null),
    item.shortcut ? h("kbd", { class: "cmdk-kbd" }, item.shortcut) : null)));
  };

  const input = h("input", {
    class: "cmdk-input",
    type: "search",
    placeholder: "Type a command, thread, approval, or view…",
    value: state.cmdk.query,
    oninput: (event) => {
      state.cmdk.query = event.target.value;
      state.cmdk.index = 0;
      paintList();
    },
    onkeydown: async (event) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (state.cmdk.items.length) {
          state.cmdk.index = (state.cmdk.index + 1) % state.cmdk.items.length;
          paintList();
        }
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        if (state.cmdk.items.length) {
          state.cmdk.index = (state.cmdk.index - 1 + state.cmdk.items.length) % state.cmdk.items.length;
          paintList();
        }
      } else if (event.key === "Enter") {
        event.preventDefault();
        const chosen = state.cmdk.items[state.cmdk.index];
        if (chosen) {
          closeCommandPalette();
          await chosen.run();
        }
      } else if (event.key === "Escape") {
        event.preventDefault();
        closeCommandPalette();
      }
    },
  });

  paintList();
  setChildren(modal,
    h("div", {
      class: "cmdk-dialog",
      onclick: (event) => event.stopPropagation(),
    },
    h("div", { class: "cmdk-head" },
      input,
      h("kbd", { class: "cmdk-kbd" }, "ESC")),
    listNode,
    h("div", { class: "cmdk-foot" },
      h("span", {}, "↑↓ navigate · ↵ run · Alt+A allow approval · Alt+R reject approval"))));

  modal.onclick = () => closeCommandPalette();
  setTimeout(() => input.focus(), 10);
}

// --------------------------------------------------------------------- boot
async function boot() {
  applyTheme();
  document.getElementById("themeToggle").addEventListener("click", () => {
    state.theme = state.theme === "dark" ? "light" : state.theme === "light" ? "auto" : "dark";
    applyTheme();
    toast(`Theme: ${state.theme}`);
  });
  document.getElementById("cmdkTrigger")?.addEventListener("click", () => {
    if (state.cmdk.open) closeCommandPalette();
    else openCommandPalette();
  });
  document.getElementById("navToggle").addEventListener("click", (event) => {
    const open = rail.dataset.open === "true";
    rail.dataset.open = String(!open);
    event.currentTarget.setAttribute("aria-expanded", String(!open));
  });
  window.addEventListener("hashchange", navigate);
  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      if (state.cmdk.open) closeCommandPalette();
      else openCommandPalette();
      return;
    }
    if (event.key === "Escape" && state.cmdk.open) {
      event.preventDefault();
      closeCommandPalette();
      return;
    }
    if (event.altKey && (event.key.toLowerCase() === "a" || event.key.toLowerCase() === "r")) {
      const pendingApproval = state.thread?.approvals?.[0]
        || (state.bootstrap?.needs_you || []).find((n) => n.kind === "approval");
      if (pendingApproval) {
        event.preventDefault();
        const decision = event.key.toLowerCase() === "a" ? "allowed-once" : "rejected";
        decideApproval(pendingApproval.id, decision);
        return;
      }
    }
    const active = document.activeElement;
    const typing = ["INPUT", "TEXTAREA"].includes(active?.tagName || "")
      || active?.isContentEditable === true
      || active?.classList?.contains("term");
    if (event.key === "/" && !typing) {
      event.preventDefault();
      window.location.hash = "#/threads";
      setTimeout(() => document.querySelector(".page-head input")?.focus(), 60);
    }
  });

  try {
    await refreshBootstrap();
  } catch (error) {
    setChildren(main, h("div", { class: "card" },
      h("h2", {}, "The daemon did not answer"),
      h("p", { class: "muted" }, error.message),
      h("button", { class: "btn", onclick: () => location.reload() }, "Reload")));
    return;
  }
  await navigate();
  connectGlobalSocket();
}

boot();
