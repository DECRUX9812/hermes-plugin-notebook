// Line-model terminal for the Computer pane. No build step, no xterm: a small
// VT parser that keeps a shell readable (CR redraws, erase-in-line, cursor
// moves, delete/insert) and ignores what it cannot show (colour, alt screen).

const ESC = "\x1b";
const MAX_LINES = 4000;
const PAD = 8;

function controlCode(event) {
  if (!event.ctrlKey || event.metaKey || event.altKey) return null;
  if (event.key.length !== 1) return null;
  const code = event.key.toUpperCase().charCodeAt(0) - 64;
  return code >= 1 && code <= 26 ? String.fromCharCode(code) : null;
}

export class TerminalView {
  constructor({ environmentId, api, toast = () => {} }) {
    this.environmentId = environmentId;
    this.api = api;
    this.toast = toast;
    this.terminal = null;
    this.socket = null;
    this.offset = 0;
    this.lines = [""];
    this.row = 0;
    this.col = 0;
    this.partial = "";
    this.cols = 80;
    this.rows = 24;
    this.sizeKey = "";
    this.frame = null;
    this.disposed = false;

    this.pre = document.createElement("pre");
    this.pre.className = "term";
    this.pre.tabIndex = 0;
    this.pre.setAttribute("role", "log");
    this.pre.setAttribute("aria-live", "polite");
    this.pre.setAttribute("aria-label", "environment terminal");
    this.pre.addEventListener("keydown", (event) => this.onKey(event));
    this.pre.addEventListener("click", () => this.pre.focus({ preventScroll: true }));
    this.pre.addEventListener("paste", (event) => {
      const text = event.clipboardData?.getData("text");
      if (text) {
        event.preventDefault();
        this.send(text);
      }
    });

    this.statusEl = document.createElement("span");
    this.statusEl.className = "term-status";

    this.actions = document.createElement("div");
    this.actions.className = "btn-row term-actions";

    this.node = document.createElement("div");
    this.node.className = "term-pane";
    this.node.append(this.pre, this.actions);

    this.observer = new ResizeObserver(() => this.measure());
    this.observer.observe(this.pre);
  }

  // -- public --------------------------------------------------------------
  async open() {
    this.status("starting…");
    try {
      const created = await this.api("/api/terminals", {
        method: "POST",
        body: { environment_id: this.environmentId, cols: this.cols, rows: this.rows },
      });
      this.terminal = created.terminal;
      this.connect(created.ws);
      this.status(`shell ${created.terminal.id.slice(-6)}`);
    } catch (error) {
      this.status(error.message || "could not open a shell");
      this.toast?.(error.message || "could not open a shell", "bad");
    }
  }

  connect(path) {
    const scheme = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${scheme}//${window.location.host}${path}?offset=${this.offset}`);
    this.socket = socket;
    socket.addEventListener("message", (event) => {
      let frame;
      try {
        frame = JSON.parse(event.data);
      } catch {
        return;
      }
      if (frame.type === "terminal.output") {
        this.offset = frame.offset;
        this.feed(frame.chunk);
      } else if (frame.type === "terminal.exit") {
        this.status(`exited ${frame.code ?? "?"}`);
      } else if (frame.type === "terminal.error") {
        this.status(frame.message || frame.code);
      } else if (frame.type === "ping") {
        socket.send(JSON.stringify({ type: "ping" }));
      }
    });
    socket.addEventListener("open", () => {
      this.sizeKey = "";
      this.measure();
      this.pre.focus({ preventScroll: true });
    });
    socket.addEventListener("close", () => {
      if (!this.disposed) this.status("disconnected");
    });
  }

  send(data) {
    if (!data) return;
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: "input", data }));
    }
  }

  clear() {
    this.lines = [""];
    this.row = 0;
    this.col = 0;
    this.render();
  }

  measure() {
    if (!this.pre.isConnected) return;
    const style = getComputedStyle(this.pre);
    const width = this.pre.clientWidth - parseFloat(style.paddingLeft || 0) - parseFloat(style.paddingRight || 0);
    const height = this.pre.clientHeight - parseFloat(style.paddingTop || 0) - parseFloat(style.paddingBottom || 0);
    const charWidth = this.charWidth(style);
    const lineHeight = parseFloat(style.lineHeight) || 18;
    const cols = Math.max(20, Math.floor(width / charWidth));
    const rows = Math.max(5, Math.floor(height / lineHeight) - 1);
    const key = `${cols}x${rows}`;
    if (key === this.sizeKey) return;
    this.sizeKey = key;
    this.cols = cols;
    this.rows = rows;
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: "resize", cols, rows }));
    }
  }

  charWidth(style) {
    if (this._charWidth) return this._charWidth;
    const probe = document.createElement("span");
    probe.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font:${style.font};`;
    probe.textContent = "0".repeat(50);
    document.body.append(probe);
    this._charWidth = probe.getBoundingClientRect().width / 50 || 8;
    probe.remove();
    return this._charWidth;
  }

  async kill() {
    this.disposed = true;
    if (this.frame) {
      clearTimeout(this.frame);
      this.frame = null;
    }
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.socket) {
      try {
        this.socket.close();
      } catch {
        /* already gone */
      }
      this.socket = null;
    }
    if (this.terminal) {
      const id = this.terminal.id;
      this.terminal = null;
      try {
        await this.api(`/api/terminals/${id}`, { method: "DELETE" });
      } catch {
        /* the shell may already be gone */
      }
    }
    this.status("closed");
  }

  status(text) {
    this.statusEl.textContent = text;
  }

  // -- input ---------------------------------------------------------------
  onKey(event) {
    const control = controlCode(event);
    if (control) {
      event.preventDefault();
      this.send(control);
      return;
    }
    if (event.metaKey) return; // leave copy/paste shortcuts to the browser
    const map = {
      Enter: "\r",
      Backspace: "\x7f",
      Tab: "\t",
      Escape: ESC,
      ArrowUp: `${ESC}[A`,
      ArrowDown: `${ESC}[B`,
      ArrowRight: `${ESC}[C`,
      ArrowLeft: `${ESC}[D`,
      Home: `${ESC}[H`,
      End: `${ESC}[F`,
      Delete: `${ESC}[3~`,
      PageUp: `${ESC}[5~`,
      PageDown: `${ESC}[6~`,
    };
    if (map[event.key]) {
      event.preventDefault();
      this.send(map[event.key]);
      return;
    }
    if (event.key.length === 1 && !event.altKey) {
      event.preventDefault();
      this.send(event.key);
    }
  }

  // -- rendering -----------------------------------------------------------
  feed(text) {
    let data = this.partial + text;
    this.partial = "";
    let index = 0;
    while (index < data.length) {
      if (data[index] === ESC) {
        const next = this.escape(data, index);
        if (next < 0) {
          this.partial = data.slice(index);
          break;
        }
        index = next;
        continue;
      }
      this.plain(data[index]);
      index += 1;
    }
    this.trim();
    this.render();
  }

  plain(char) {
    const code = char.charCodeAt(0);
    if (char === "\n") return this.newline();
    if (char === "\r") {
      this.col = 0;
      return;
    }
    if (char === "\b") {
      this.col = Math.max(0, this.col - 1);
      return;
    }
    if (char === "\t") {
      const stop = (Math.floor(this.col / PAD) + 1) * PAD;
      if (stop >= this.cols) this.wrap();
      else this.col = stop;
      return;
    }
    if (code < 0x20 || code === 0x7f) return; // BEL, NUL, DEL
    this.put(char);
  }

  put(char) {
    if (this.col >= this.cols) this.wrap();
    const line = this.lines[this.row] ?? "";
    const padded = line.length < this.col ? line + " ".repeat(this.col - line.length) : line;
    this.lines[this.row] = padded.slice(0, this.col) + char + padded.slice(this.col + 1);
    this.col += 1;
  }

  wrap() {
    // The shell's own wrap moves the cursor to a fresh visual row; mirroring it
    // is what makes readline's "up one row then newline" redraw land correctly.
    this.row += 1;
    if (this.row >= this.lines.length) this.lines.push("");
    this.col = 0;
  }

  newline() {
    this.row += 1;
    if (this.row >= this.lines.length) this.lines.push("");
    this.col = 0;
  }

  escape(data, index) {
    const kind = data[index + 1];
    if (kind === undefined) return -1;
    if (kind === "[") {
      for (let cursor = index + 2; cursor < data.length; cursor += 1) {
        const code = data.charCodeAt(cursor);
        if (code >= 0x40 && code <= 0x7e) {
          this.csi(data.slice(index + 2, cursor), data[cursor]);
          return cursor + 1;
        }
      }
      return -1;
    }
    if ("]PX^_".includes(kind)) {
      for (let cursor = index + 2; cursor < data.length; cursor += 1) {
        if (data[cursor] === "\x07") return cursor + 1;
        if (data[cursor] === ESC && data[cursor + 1] === "\\") return cursor + 2;
      }
      return -1;
    }
    if ("()#%*+".includes(kind)) return index + 3 <= data.length ? index + 3 : -1;
    return index + 2;
  }

  csi(raw, final) {
    const params = raw.replace(/[?<>=!]/g, "").split(";");
    const count = (index, fallback = 1) => {
      const value = parseInt(params[index] ?? "", 10);
      return Number.isFinite(value) && value > 0 ? value : fallback;
    };
    switch (final) {
      case "A":
        this.row = Math.max(0, this.row - count(0));
        break;
      case "B":
        this.row = Math.min(this.lines.length - 1, this.row + count(0));
        break;
      case "C":
        this.col = Math.min(this.cols - 1, this.col + count(0));
        break;
      case "D":
        this.col = Math.max(0, this.col - count(0));
        break;
      case "G":
        this.col = Math.min(this.cols - 1, Math.max(0, count(0) - 1));
        break;
      case "H":
      case "f":
        this.row = Math.min(this.lines.length - 1, Math.max(0, count(0) - 1));
        this.col = Math.max(0, count(1) - 1);
        break;
      case "J":
        this.eraseDisplay(params[0] === "2" ? 2 : 0);
        break;
      case "K":
        this.eraseLine(params[0] === "2" ? 2 : params[0] === "1" ? 1 : 0);
        break;
      case "P":
        this.spliceLine(this.col, count(0), () => "");
        break;
      case "@":
        this.spliceLine(this.col, 0, () => " ".repeat(count(0)));
        break;
      case "X":
        this.spliceLine(this.col, count(0), () => " ".repeat(count(0)));
        break;
      default:
        break; // colour, modes, scroll regions: nothing to draw here
    }
  }

  spliceLine(at, remove, insert) {
    const line = this.lines[this.row] ?? "";
    const head = line.slice(0, at);
    const tail = line.slice(at + remove);
    this.lines[this.row] = (head + insert() + tail).replace(/\s+$/, "");
  }

  eraseLine(mode) {
    const line = this.lines[this.row] ?? "";
    if (mode === 2) this.lines[this.row] = "";
    else if (mode === 1) this.lines[this.row] = " ".repeat(Math.min(this.col, line.length)) + line.slice(this.col);
    else this.lines[this.row] = line.slice(0, this.col);
  }

  eraseDisplay(mode) {
    if (mode === 2) {
      this.lines = [""];
      this.row = 0;
      this.col = 0;
      return;
    }
    this.lines[this.row] = (this.lines[this.row] ?? "").slice(0, this.col);
    this.lines.length = this.row + 1;
  }

  trim() {
    if (this.lines.length <= MAX_LINES) return;
    const drop = this.lines.length - MAX_LINES;
    this.lines.splice(0, drop);
    this.row = Math.max(0, this.row - drop);
  }

  render() {
    // rAF is paused in a hidden page (headless capture, background tab), so a
    // buffered text update must not depend on it: write straight through then.
    if (document.visibilityState === "hidden") {
      this.flush();
      return;
    }
    if (this.frame) return;
    this.frame = setTimeout(() => {
      this.frame = null;
      this.flush();
    }, 16);
  }

  flush() {
    const { scrollTop, clientHeight, scrollHeight } = this.pre;
    const atBottom = scrollTop + clientHeight >= scrollHeight - 32;
    this.pre.textContent = this.lines.join("\n");
    if (atBottom) this.pre.scrollTop = this.pre.scrollHeight;
  }
}
