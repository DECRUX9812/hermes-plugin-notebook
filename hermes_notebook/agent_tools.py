"""Grounded tool execution — the half of the notebook that *acts*.

Three tools, one rule: nothing here guesses. A number is produced by a query
that ran, a script's result is its real stdout and exit code, and a tool that
cannot run says so in a sentence instead of returning a plausible zero.

    query_table   SQL over the notebook's own tables (CSV, XLSX), in memory
    run_script    python/bash in a temp dir, bounded by timeout and output cap
    mcp_call      a connected MCP server, through the host's own gate
                  (ctx.call_mcp, which is default-deny by mcp_allowlist)

The SQL engine is DuckDB when the environment has it (it reads CSV headers and
types better) and the stdlib's sqlite3 otherwise — both are given the same
tables, so the queries the model writes work either way.
"""

from __future__ import annotations

import csv
import io
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from . import runtime, store

MAX_OUTPUT = 8000          # characters of stdout/stderr kept in a result
MAX_ROWS = 200             # rows returned to the page from one query
SCRIPT_TIMEOUT = 15.0      # seconds, hard
TABLE_SUFFIXES = {".csv"}
SHEET_SUFFIXES = {".xlsx", ".xlsm"}


# --------------------------------------------------------------------- engine

def engine_name() -> str:
    try:
        import duckdb  # noqa: F401
        return "duckdb"
    except Exception:
        return "sqlite"


def _numeric(values: List[str]) -> bool:
    seen = 0
    for v in values:
        v = (v or "").strip().replace(",", "").replace("$", "").replace("%", "")
        if not v:
            continue
        try:
            float(v)
        except ValueError:
            return False
        seen += 1
    return seen > 0


def _read_csv(path: Path) -> Tuple[List[str], List[List[str]]]:
    text = path.read_text(encoding="utf-8", errors="replace")
    rows = list(csv.reader(io.StringIO(text)))
    if not rows:
        return [], []
    head = [h.strip() or f"col{i + 1}" for i, h in enumerate(rows[0])]
    body = [r + [""] * (len(head) - len(r)) if len(r) < len(head) else r[:len(head)]
            for r in rows[1:] if any(c.strip() for c in r)]
    return head, body


def _read_xlsx(path: Path) -> List[Tuple[str, List[str], List[List[str]]]]:
    from hermes_notebook import xlsx_export  # noqa: F401  (declares the dependency)
    from openpyxl import load_workbook
    wb = load_workbook(path, read_only=True, data_only=True)
    out = []
    for ws in wb.worksheets:
        rows = [["" if c is None else str(c) for c in row] for row in ws.iter_rows(values_only=True)]
        rows = [r for r in rows if any(x.strip() for x in r)]
        if not rows:
            continue
        head = [h.strip() or f"col{i + 1}" for i, h in enumerate(rows[0])]
        out.append((ws.title, head, rows[1:]))
    return out


def tables(notebook_id: str) -> List[Dict[str, Any]]:
    """Every table this notebook can answer from, with its shape."""
    found: List[Dict[str, Any]] = []
    try:
        d = store.artifact_dir(notebook_id)
    except Exception:
        return found
    if not d.exists():
        return found
    for path in sorted(d.iterdir()):
        suffix = path.suffix.lower()
        name = path.name
        if suffix in TABLE_SUFFIXES:
            try:
                head, body = _read_csv(path)
            except Exception:
                continue
            if not head:
                continue
            found.append({"table": _sql_name(name), "source": name, "columns": head,
                          "rows": len(body), "kind": "csv"})
        elif suffix in SHEET_SUFFIXES:
            try:
                sheets = _read_xlsx(path)
            except Exception:
                continue
            for title, head, body in sheets:
                found.append({"table": _sql_name(f"{name}#{title}"), "source": name,
                              "sheet": title, "columns": head, "rows": len(body),
                              "kind": "xlsx"})
    return found


def _sql_name(raw: str) -> str:
    base = re.sub(r"^\d{8}-\d{6}-", "", raw)          # 20261109-173411-data_table.csv
    base = re.sub(r"\.(csv|xlsx|xlsm|json|md)$", "", base, flags=re.I)
    base = re.sub(r"[^A-Za-z0-9]+", "_", base).strip("_").lower()
    return base or "table"


def _register(con, kind: str, table: str, head: List[str], body: List[List[str]]) -> None:
    cols = []
    for i, h in enumerate(head):
        safe = re.sub(r"[^A-Za-z0-9_]+", "_", h).strip("_").lower() or f"col{i + 1}"
        values = [r[i] if i < len(r) else "" for r in body[:200]]
        cols.append((safe, "REAL" if _numeric(values) else "TEXT"))
    names = ", ".join(f'"{c}" {t}' for c, t in cols)
    if kind == "duckdb":
        con.execute(f'CREATE TABLE "{table}" ({names})')
        if body:
            placeholders = ", ".join("?" for _ in cols)
            con.executemany(f'INSERT INTO "{table}" VALUES ({placeholders})',
                            [[_num(r[i]) if cols[i][1] == "REAL" else (r[i] if i < len(r) else "")
                              for i in range(len(cols))] for r in body])
    else:
        con.execute(f'CREATE TABLE "{table}" ({names})')
        if body:
            placeholders = ", ".join("?" for _ in cols)
            con.executemany(f'INSERT INTO "{table}" VALUES ({placeholders})',
                            [[_num(r[i]) if cols[i][1] == "REAL" else (r[i] if i < len(r) else "")
                              for i in range(len(cols))] for r in body])


def _num(raw: str) -> Optional[float]:
    v = (raw or "").strip().replace(",", "").replace("$", "").replace("%", "")
    if not v:
        return None
    try:
        return float(v)
    except ValueError:
        return None


def _connect(notebook_id: str):
    kind = engine_name()
    if kind == "duckdb":
        import duckdb
        con = duckdb.connect(":memory:")
    else:
        import sqlite3
        con = sqlite3.connect(":memory:")
    loaded = 0
    try:
        d = store.artifact_dir(notebook_id)
    except Exception:
        return con, kind, 0
    if d.exists():
        used = set()
        for path in sorted(d.iterdir()):
            suffix = path.suffix.lower()
            if suffix in TABLE_SUFFIXES:
                head, body = _read_csv(path)
                if not head:
                    continue
                name = _unique(_sql_name(path.name), used)
                _register(con, kind, name, head, body)
                loaded += 1
            elif suffix in SHEET_SUFFIXES:
                for title, head, body in _read_xlsx(path):
                    name = _unique(_sql_name(f"{path.name}_{title}"), used)
                    _register(con, kind, name, head, body)
                    loaded += 1
    return con, kind, loaded


def _unique(name: str, used: set) -> str:
    out, n = name, 2
    while out in used:
        out = f"{name}_{n}"
        n += 1
    used.add(out)
    return out


# ----------------------------------------------------------------------- tools

def query_table(notebook_id: str, sql: str, limit: int = MAX_ROWS) -> Dict[str, Any]:
    """Run one read-only SQL statement over the notebook's tables."""
    started = time.time()
    statement = (sql or "").strip().rstrip(";")
    if not statement:
        return {"ok": False, "error": "empty query", "ms": 0}
    first = statement.split(None, 1)[0].lower()
    if first not in ("select", "with", "pragma", "describe", "show", "explain"):
        return {"ok": False, "error": "only read-only queries are allowed (select / with)",
                "ms": 0}
    banned = re.compile(r"\b(insert|update|delete|drop|create|alter|attach|copy)\b", re.I)
    if banned.search(statement):
        return {"ok": False, "error": "only read-only queries are allowed", "ms": 0}
    con, kind, loaded = _connect(notebook_id)
    try:
        cur = con.execute(statement)
        columns = [d[0] for d in (cur.description or [])]
        rows = [list(r) for r in cur.fetchmany(max(1, min(int(limit or MAX_ROWS), MAX_ROWS)))]
        total = len(rows)
        try:
            more = cur.fetchone()
        except Exception:
            more = None
        return {"ok": True, "engine": kind, "tables": loaded, "sql": statement,
                "columns": columns, "rows": rows, "returned": total,
                "truncated": bool(more), "ms": int((time.time() - started) * 1000)}
    except Exception as exc:
        return {"ok": False, "engine": kind, "tables": loaded, "sql": statement,
                "error": str(exc), "ms": int((time.time() - started) * 1000)}
    finally:
        try:
            con.close()
        except Exception:
            pass


def run_script(language: str, code: str, timeout: float = SCRIPT_TIMEOUT) -> Dict[str, Any]:
    """Run a snippet in a throwaway directory and report what really happened.

    The point is the exit code and the real output, not a green tick: a script
    that fails returns its stderr, and the UI shows it.
    """
    started = time.time()
    lang = (language or "python").lower()
    body = code or ""
    if not body.strip():
        return {"ok": False, "error": "empty script", "ms": 0, "exit": None}
    work = tempfile.mkdtemp(prefix="nb-agent-")
    env = {"PATH": os.environ.get("PATH", "/usr/local/bin:/usr/bin:/bin"),
           "HOME": work, "LANG": os.environ.get("LANG", "C.UTF-8"),
           "PYTHONIOENCODING": "utf-8", "MPLBACKEND": "Agg"}
    if lang in ("bash", "sh", "shell"):
        cmd = ["/bin/bash", "-lc", body]
    else:
        # no -I: the sandbox may legitimately want numpy/openpyxl, and the
        # env above already strips PYTHONPATH and HOME
        cmd = [sys.executable, "-"]
    try:
        proc = subprocess.run(
            cmd, input=body if lang not in ("bash", "sh", "shell") else None,
            cwd=work, env=env, capture_output=True, text=True,
            timeout=max(1.0, min(float(timeout or SCRIPT_TIMEOUT), 60.0)))
        out = (proc.stdout or "")[:MAX_OUTPUT]
        err = (proc.stderr or "")[:MAX_OUTPUT]
        return {"ok": proc.returncode == 0, "language": lang, "code": body,
                "exit": proc.returncode, "out": out, "err": err,
                "ms": int((time.time() - started) * 1000),
                "truncated": len(proc.stdout or "") > MAX_OUTPUT or len(proc.stderr or "") > MAX_OUTPUT}
    except subprocess.TimeoutExpired as exc:
        return {"ok": False, "language": lang, "code": body, "exit": None,
                "out": (exc.stdout or "")[:MAX_OUTPUT] if isinstance(exc.stdout, str) else "",
                "err": f"timed out after {timeout:g}s", "ms": int((time.time() - started) * 1000)}
    except Exception as exc:
        return {"ok": False, "language": lang, "code": body, "exit": None,
                "out": "", "err": str(exc), "ms": int((time.time() - started) * 1000)}
    finally:
        shutil.rmtree(work, ignore_errors=True)


def mcp_servers() -> List[Dict[str, Any]]:
    """MCP servers this plugin is actually allowed to call (default-deny)."""
    try:
        ctx = runtime.ctx()
    except Exception:
        return []
    out = []
    for attr in ("mcp_servers", "list_mcp_servers"):
        fn = getattr(ctx, attr, None)
        if callable(fn):
            try:
                for s in (fn() or []):
                    name = s.get("name") if isinstance(s, dict) else getattr(s, "name", None)
                    if name:
                        out.append({"server": name,
                                    "tools": s.get("tools") if isinstance(s, dict) else []})
            except Exception:
                pass
            break
    return out


def mcp_call(server: str, tool: str, arguments: Optional[Dict[str, Any]] = None,
             timeout: float = 30) -> Dict[str, Any]:
    started = time.time()
    if not server or not tool:
        return {"ok": False, "error": "mcp_call needs a server and a tool", "ms": 0}
    try:
        ctx = runtime.ctx()
    except Exception as exc:
        return {"ok": False, "error": f"the agent half is not registered: {exc}", "ms": 0}
    fn = getattr(ctx, "call_mcp", None)
    if not callable(fn):
        return {"ok": False, "ms": 0,
                "error": "this host build does not expose MCP calls to plugins"}
    try:
        out = fn(server, tool, dict(arguments or {}), timeout=timeout)
        text = out if isinstance(out, str) else json.dumps(out, ensure_ascii=False, default=str)
        return {"ok": True, "server": server, "tool": tool, "arguments": arguments or {},
                "out": str(text)[:MAX_OUTPUT], "ms": int((time.time() - started) * 1000)}
    except Exception as exc:
        return {"ok": False, "server": server, "tool": tool, "ms": int((time.time() - started) * 1000),
                "error": str(exc)}


TOOLS = [
    {"id": "query_table", "title": "SQL over the notebook's tables",
     "blurb": "Run one read-only SQL statement over the notebook's CSV/XLSX tables.",
     "args": {"sql": "string"}},
    {"id": "run_script", "title": "Python or Bash sandbox",
     "blurb": "Run a short script in a throwaway directory; returns its real exit code and output.",
     "args": {"language": "python|bash", "code": "string"}},
    {"id": "mcp_call", "title": "Connected MCP server",
     "blurb": "Call a tool on an MCP server this plugin is allowed to use.",
     "args": {"server": "string", "tool": "string", "arguments": "object"}},
]


def catalog(notebook_id: str) -> Dict[str, Any]:
    return {"ok": True, "engine": engine_name(), "tools": TOOLS,
            "tables": tables(notebook_id), "mcp": mcp_servers()}
