"""Cooperative progress + cancellation for the long endpoints.

The dashboard routes are ordinary sync/async handlers — there is no job
queue to attach to — so a "job" here is a record this module keeps: the
handler reports human-readable steps into it, long loops check
`check()` between units of work, and the page polls `snapshot()` while it
works and can `cancel()` a run. Cancel is cooperative: it is honoured at
the same points progress is reported, never mid-write.

Files a run creates are tracked with `track_file()` so a cancelled run can
delete its own partial output instead of leaving half an artifact behind.
"""

import threading
import time
import uuid
from pathlib import Path
from typing import Any, Dict, Optional

_lock = threading.Lock()
_jobs: Dict[str, Dict[str, Any]] = {}
_by_key: Dict[tuple, str] = {}
_KEEP = 60
_TTL = 600.0  # seconds a finished record stays visible to the poller


class JobCancelled(Exception):
    """Raised inside a job when its cancel flag is set — handlers turn it
    into a normal `{ok: false, cancelled: true}` reply, not a 500."""


def begin(scope: str, key: str, label: str = "") -> str:
    """Start (or replace) the job for (scope, key); returns its id."""
    jid = uuid.uuid4().hex[:12]
    rec = {
        "id": jid, "scope": scope, "key": key, "label": label or key,
        "step": "starting", "detail": "", "state": "running",
        "started": time.time(), "ended": None, "error": "",
        "cancel": threading.Event(), "files": [],
    }
    with _lock:
        _jobs[jid] = rec
        _by_key[(scope, key)] = jid
        now = time.time()
        for old, r in list(_jobs.items()):
            if r["state"] != "running" and r["ended"] and now - r["ended"] > _TTL:
                _jobs.pop(old, None)
        while len(_jobs) > _KEEP:
            done = [j for j, r in _jobs.items() if r["state"] != "running"]
            if not done:
                break
            _jobs.pop(done[0], None)
    return jid


def _rec(jid: str) -> Optional[Dict[str, Any]]:
    return _jobs.get(jid)


def report(jid: str, step: str, detail: str = "") -> None:
    with _lock:
        rec = _rec(jid)
        if rec is not None and rec["state"] == "running":
            rec["step"], rec["detail"] = step, detail


def track_file(jid: str, path) -> None:
    """Remember a file the run wrote so cancel can remove it."""
    if not jid:
        return
    with _lock:
        rec = _rec(jid)
        if rec is not None:
            rec["files"].append(str(path))


def check(jid: str) -> None:
    """Between-step cancel gate — raises JobCancelled when flagged."""
    rec = _rec(jid)
    if rec is not None and rec["cancel"].is_set():
        raise JobCancelled()


def cancel(scope: str, key: str) -> bool:
    """Flag the live job for (scope, key). Returns False when nothing runs."""
    with _lock:
        jid = _by_key.get((scope, key))
        rec = _jobs.get(jid) if jid else None
        if rec is None or rec["state"] != "running":
            return False
        rec["cancel"].set()
        rec["step"], rec["detail"] = "stopping", ""
        return True


def finish(jid: str, state: str = "done", error: str = "") -> None:
    with _lock:
        rec = _rec(jid)
        if rec is None:
            return
        rec["state"], rec["ended"] = state, time.time()
        if error:
            rec["error"] = error


def cleanup(jid: str) -> list:
    """Delete every file the run tracked; returns the paths removed."""
    with _lock:
        rec = _rec(jid)
        files = list(rec["files"]) if rec else []
    removed = []
    for raw in files:
        p = Path(raw)
        try:
            if p.is_dir():
                import shutil
                shutil.rmtree(p, ignore_errors=True)
            elif p.exists():
                p.unlink()
            removed.append(raw)
        except OSError:
            continue
    return removed


def snapshot(scope: str) -> Dict[str, Any]:
    """What the page polls: every job this notebook has touched lately,
    keyed by the job key the UI knows ('gen:slides', 'ingest', 'discover')."""
    now = time.time()
    out: Dict[str, Any] = {}
    with _lock:
        for rec in _jobs.values():
            if rec["scope"] != scope:
                continue
            if rec["state"] == "running" or (rec["ended"] and now - rec["ended"] < _TTL):
                out[rec["key"]] = {
                    "state": rec["state"], "step": rec["step"],
                    "detail": rec["detail"], "label": rec["label"],
                    "elapsed": round((rec["ended"] or now) - rec["started"], 1),
                    "error": rec["error"],
                }
    return {"ok": True, "jobs": out}
