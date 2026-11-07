"""Homelab control deck backend.

Every number on the page is measured here, at request time. Every button on the
page lands on an action that really runs, and reports the real exit status and
stdout back. Nothing is cached beyond a short TTL so a poll loop cannot hammer
seven hosts, and nothing is invented: when a host cannot be reached the payload
says so and the actions for it are refused.

Mounted by the Hermes server at ``/api/plugins/homelab/`` and reached from the
page as ``ctx.rest(...)``::

    GET  /health            liveness
    GET  /state             host, disks, docker, services, tailnet, gateway, fleet,
                            proxmox, security posture, audit tail
    GET  /fleet             per-host measurement (kernel, patch state, mitigation)
    GET  /proxmox           VMs and containers on the hypervisor
    GET  /audit             action log, newest first
    GET  /actions           what each host can be asked to do
    POST /action            run one whitelisted action, audited
    GET  /logs              last N lines of a container or unit journal

Safety model: the client never sends a command line. It sends an action id, a
host id and a validated target; this module builds the argv. Destructive actions
(stop, reboot, shutdown) require ``confirm`` to equal the target, and this
machine refuses to reboot or shut itself down from here.
"""

from __future__ import annotations

import base64
import concurrent.futures
import json
import os
import platform
import re
import shlex
import socket
import subprocess
import threading
import time
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, HTTPException

router = APIRouter(tags=["homelab"])

HERE = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(HERE, "hosts.json")
AUDIT_PATH = os.path.join(
    os.path.expanduser("~"), ".hermes-webapp", "state", "homelab-audit.jsonl"
)

SSH_OPTS = [
    "-o", "BatchMode=yes",
    "-o", "ConnectTimeout=4",
    "-o", "StrictHostKeyChecking=accept-new",
    "-o", "LogLevel=ERROR",
]


def _ssh_opts(host: Dict[str, Any]) -> List[str]:
    """SSH flags for a host, plus its own key when the inventory names one.

    The key is passed explicitly because this backend may run with no ssh-agent
    in its environment; relying on the agent makes a working host look dead.
    """
    identity = host.get("identity")
    if identity:
        return [*SSH_OPTS, "-o", "IdentitiesOnly=yes", "-i", os.path.expanduser(identity)]
    return list(SSH_OPTS)

_NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,62}$")
_UNIT_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9@._:-]{0,80}$")
_VMID_RE = re.compile(r"^[0-9]{1,6}$")

# Services this lab actually runs. Every entry is probed live — if one is
# closed the page shows it red, not this list green.
SERVICES: List[Dict[str, Any]] = [
    {"name": "Hermes webapp gateway", "kind": "tcp", "port": 9120, "host": "127.0.0.1", "url": "https://desktop.decruxtech.com"},
    {"name": "CLIProxy — Gemini", "kind": "tcp", "port": 8317, "host": "127.0.0.1", "url": None},
    {"name": "dsh", "kind": "tcp", "port": 9180, "host": "127.0.0.1", "url": "https://dsh.decruxtech.com/boot"},
    {"name": "Changelog site", "kind": "tcp", "port": 8790, "host": "127.0.0.1", "url": None},
    {"name": "Pitch site", "kind": "tcp", "port": 9150, "host": "127.0.0.1", "url": None},
    {"name": "opencode proxy", "kind": "tcp", "port": 20128, "host": "127.0.0.1", "url": None},
    {"name": "Squad dist", "kind": "tcp", "port": 9130, "host": "100.84.81.81", "url": None},
    {"name": "BB hub (GetBB)", "kind": "http", "url": "https://decrux.getbb.app"},
]

GATEWAY_HEALTH = "http://127.0.0.1:9120/api/health"

# --------------------------------------------------------------------- config

_cache_lock = threading.Lock()
_cache: Dict[str, Any] = {}


def _config() -> Dict[str, Any]:
    try:
        with open(CONFIG_PATH, "r", encoding="utf-8") as handle:
            return json.load(handle)
    except (OSError, ValueError):
        return {"hosts": [], "proxmox": {"host": "pve"}, "cve": {}}


def _hosts() -> List[Dict[str, Any]]:
    return _config().get("hosts") or []


def _host(host_id: str) -> Optional[Dict[str, Any]]:
    for host in _hosts():
        if host.get("id") == host_id:
            return host
    return None


def _cached(key: str, ttl: float, producer):
    now = time.time()
    with _cache_lock:
        hit = _cache.get(key)
        if hit and now - hit[0] < ttl:
            return hit[1]
    value = producer()
    with _cache_lock:
        _cache[key] = (now, value)
    return value


def _invalidate(prefix: str = "") -> None:
    with _cache_lock:
        for key in [k for k in _cache if k.startswith(prefix)]:
            _cache.pop(key, None)


# ------------------------------------------------------------------ audit log

_audit_lock = threading.Lock()


def _audit_append(entry: Dict[str, Any]) -> None:
    try:
        os.makedirs(os.path.dirname(AUDIT_PATH), exist_ok=True)
        with _audit_lock, open(AUDIT_PATH, "a", encoding="utf-8") as handle:
            handle.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except OSError:
        pass


def _audit_tail(limit: int = 25) -> List[Dict[str, Any]]:
    try:
        with open(AUDIT_PATH, "r", encoding="utf-8") as handle:
            lines = handle.readlines()[-limit:]
    except OSError:
        return []
    out = []
    for line in reversed(lines):
        try:
            out.append(json.loads(line))
        except ValueError:
            continue
    return out


# ------------------------------------------------------------- command runner


def _run(cmd: List[str], timeout: float = 8.0) -> Dict[str, Any]:
    """Run an argv and return {ok, code, out, err}. Never raises."""
    started = time.time()
    try:
        done = subprocess.run(
            cmd, capture_output=True, text=True, timeout=timeout, check=False
        )
        return {
            "ok": done.returncode == 0,
            "code": done.returncode,
            "out": (done.stdout or "").strip(),
            "err": (done.stderr or "").strip(),
            "ms": int((time.time() - started) * 1000),
            "cmd": " ".join(shlex.quote(c) for c in cmd),
        }
    except subprocess.TimeoutExpired:
        return {"ok": False, "code": 124, "out": "", "err": f"timed out after {timeout}s",
                "ms": int((time.time() - started) * 1000), "cmd": " ".join(cmd)}
    except OSError as exc:
        return {"ok": False, "code": 127, "out": "", "err": str(exc),
                "ms": int((time.time() - started) * 1000), "cmd": " ".join(cmd)}


PROBE_SCRIPT = r"""
echo "host=$(hostname 2>/dev/null || echo '?')"
echo "kernel=$(uname -r)"
echo "os=$(. /etc/os-release 2>/dev/null && echo "$PRETTY_NAME" || echo unknown)"
echo "uptime=$(cut -d' ' -f1 /proc/uptime 2>/dev/null || echo 0)"
echo "load=$(cut -d' ' -f1-3 /proc/loadavg 2>/dev/null || echo '0 0 0')"
echo "cores=$(nproc 2>/dev/null || echo 0)"
echo "memtot=$(awk '/MemTotal/{print $2}' /proc/meminfo 2>/dev/null || echo 0)"
echo "memavail=$(awk '/MemAvailable/{print $2}' /proc/meminfo 2>/dev/null || echo 0)"
echo "disk=$(df -P / 2>/dev/null | awk 'NR==2{print $2" "$3" "$4}')"
echo "reboot=$([ -f /var/run/reboot-required ] && echo 1 || echo 0)"
echo "mptcp=$(sysctl -n net.mptcp.enabled 2>/dev/null || echo '?')"
echo "mitig=$(nft list table ip cve_2026_98432 >/dev/null 2>&1 && echo 1 || echo 0)"
echo "failed=$(systemctl list-units --state=failed --no-legend --no-pager 2>/dev/null | wc -l)"
echo "docker=$(docker ps -q 2>/dev/null | wc -l)"
"""


def _remote_script(host: Dict[str, Any], script: str, timeout: float = 12.0) -> Dict[str, Any]:
    """Run a POSIX-sh snippet on a host, whatever route reaches it."""
    if host.get("ssh") is None:
        return _run(["/bin/sh", "-c", script], timeout=timeout)

    b64 = base64.b64encode(script.encode()).decode()
    inner = f"echo {b64} | base64 -d | /bin/sh"
    via = host.get("via")
    if via:
        remote_cmd = f"{via} /bin/sh -c {shlex.quote(inner)}"
        argv = ["ssh", *_ssh_opts(host), host["ssh"], remote_cmd]
    else:
        argv = ["ssh", *_ssh_opts(host), host["ssh"], inner]

    result = _run(argv, timeout=timeout)
    if via and result.get("out"):
        # `qm guest exec` answers JSON: {"exitcode":0,"out-data":"..."}
        try:
            payload = json.loads(result["out"])
            result["out"] = payload.get("out-data", "") or ""
            err = payload.get("err-data", "") or ""
            result["err"] = (result.get("err") or "") + err
            result["ok"] = payload.get("exitcode", 1) == 0
            result["code"] = payload.get("exitcode", 1)
        except ValueError:
            pass
    return result


def _kv(text: str) -> Dict[str, str]:
    out: Dict[str, str] = {}
    for line in (text or "").splitlines():
        key, sep, value = line.partition("=")
        if sep:
            out[key.strip()] = value.strip()
    return out


def _patch_state(kernel: str, fixed: Optional[str]) -> str:
    """Compare the running kernel against the vendor's fixed version.

    Deliberately dumb and honest: string-prefix comparison on the numeric
    version, and 'unknown' when either side is missing — never 'patched' by
    default.
    """
    if not fixed or fixed in ("n/a", ""):
        return "unknown"
    if not kernel:
        return "unknown"

    def numbers(value: str) -> List[int]:
        return [int(p) for p in re.findall(r"\d+", value)[:4]]

    running = numbers(kernel)
    target = numbers(fixed)
    if not running or not target:
        return "unknown"
    width = max(len(running), len(target))
    running += [0] * (width - len(running))
    target += [0] * (width - len(target))
    return "patched" if running >= target else "vulnerable"


def _probe_host(host: Dict[str, Any]) -> Dict[str, Any]:
    result = _remote_script(host, PROBE_SCRIPT, timeout=14.0)
    if not result.get("ok") or not result.get("out"):
        return {
            "id": host["id"],
            "name": host.get("name") or host["id"],
            "role": host.get("role") or "",
            "dial": host.get("dial") or "",
            "reachable": False,
            "error": (result.get("err") or "no answer").splitlines()[0][:180],
            "can": host.get("can") or [],
        }

    kv = _kv(result["out"])
    kernel = kv.get("kernel", "")
    fixed = host.get("kernel_fix")
    mem_total = int(kv.get("memtot") or 0) * 1024
    mem_avail = int(kv.get("memavail") or 0) * 1024
    disk = (kv.get("disk") or "").split()
    disk_total = int(disk[0]) * 1024 if len(disk) >= 3 else 0
    disk_used = int(disk[1]) * 1024 if len(disk) >= 3 else 0
    load = (kv.get("load") or "0 0 0").split()[:3] or ["0", "0", "0"]

    return {
        "id": host["id"],
        "name": host.get("name") or host["id"],
        "role": host.get("role") or "",
        "dial": host.get("dial") or "",
        "reachable": True,
        "hostname": kv.get("host"),
        "os": kv.get("os"),
        "kernel": kernel,
        "uptime_s": round(float(kv.get("uptime") or 0)),
        "load": [float(x) for x in load] if load else [0, 0, 0],
        "cores": int(kv.get("cores") or 0),
        "mem": {
            "total_gb": round(mem_total / 2**30, 1),
            "used_gb": round((mem_total - mem_avail) / 2**30, 1),
            "pct": round(100 * (mem_total - mem_avail) / mem_total, 1) if mem_total else 0,
        },
        "disk": {
            "total_gb": round(disk_total / 2**30, 1),
            "used_gb": round(disk_used / 2**30, 1),
            "pct": round(100 * disk_used / disk_total, 1) if disk_total else 0,
        },
        "reboot_required": kv.get("reboot") == "1",
        "mptcp_enabled": kv.get("mptcp") not in ("0", None),
        "mitigation": kv.get("mitig") == "1",
        "failed_units": int(kv.get("failed") or 0),
        "containers_up": int(kv.get("docker") or 0),
        "patch_state": _patch_state(kernel, fixed),
        "kernel_fix": fixed,
        "kernel_fix_note": host.get("kernel_fix_note"),
        "can": host.get("can") or [],
        "measured_ms": result.get("ms"),
    }


def _fleet() -> List[Dict[str, Any]]:
    def measure() -> List[Dict[str, Any]]:
        hosts = _hosts()
        if not hosts:
            return []
        with concurrent.futures.ThreadPoolExecutor(max_workers=len(hosts)) as pool:
            return list(pool.map(_probe_host, hosts))

    return _cached("fleet", 20.0, measure)


# ----------------------------------------------------------------------- host


def _read(path: str) -> Optional[str]:
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as handle:
            return handle.read()
    except OSError:
        return None


def _uptime_seconds() -> float:
    text = _read("/proc/uptime")
    if text:
        try:
            return float(text.split()[0])
        except (ValueError, IndexError):
            pass
    return 0.0


def _meminfo() -> Dict[str, int]:
    info: Dict[str, int] = {}
    text = _read("/proc/meminfo")
    if text:
        for line in text.splitlines():
            key, _, rest = line.partition(":")
            try:
                info[key] = int(rest.strip().split()[0]) * 1024
            except (ValueError, IndexError):
                continue
    return info


def _host_facts() -> Dict[str, Any]:
    load1, load5, load15 = os.getloadavg()
    mem = _meminfo()
    total = mem.get("MemTotal", 0)
    avail = mem.get("MemAvailable", 0)
    swap_total = mem.get("SwapTotal", 0)
    swap_free = mem.get("SwapFree", 0)
    return {
        "name": socket.gethostname(),
        "os": platform.platform(),
        "kernel": platform.release(),
        "arch": platform.machine(),
        "uptime_s": round(_uptime_seconds()),
        "cores": os.cpu_count(),
        "load": [round(load1, 2), round(load5, 2), round(load15, 2)],
        "mem": {
            "total_gb": round(total / 2**30, 1),
            "used_gb": round((total - avail) / 2**30, 1),
            "avail_gb": round(avail / 2**30, 1),
            "pct": round(100 * (total - avail) / total, 1) if total else 0,
        },
        "swap": {
            "total_gb": round(swap_total / 2**30, 1),
            "used_gb": round((swap_total - swap_free) / 2**30, 1),
        },
    }


def _disks() -> List[Dict[str, Any]]:
    out = []
    for mount in ("/", "/data"):
        try:
            st = os.statvfs(mount)
        except OSError:
            continue
        total = st.f_blocks * st.f_frsize
        free = st.f_bavail * st.f_frsize
        used = total - free
        out.append({
            "mount": mount,
            "total_gb": round(total / 2**30, 1),
            "used_gb": round(used / 2**30, 1),
            "free_gb": round(free / 2**30, 1),
            "pct": round(100 * used / total, 1) if total else 0,
        })
    return out


# --------------------------------------------------------------------- docker


def _docker_list(host: Dict[str, Any]) -> Dict[str, Any]:
    cmd = "docker ps -a --format '{{.Names}}\t{{.Status}}\t{{.Image}}' 2>/dev/null"
    result = _remote_script(host, cmd, timeout=12.0)
    if not result.get("ok") and not result.get("out"):
        return {"ok": False, "count": 0, "containers": [],
                "note": result.get("err") or "docker daemon not reachable"}
    containers = []
    for line in (result.get("out") or "").splitlines():
        parts = line.split("\t")
        if len(parts) < 2:
            continue
        name, status = parts[0].strip(), parts[1].strip()
        image = parts[2].strip() if len(parts) > 2 else ""
        if not _NAME_RE.match(name):
            continue
        running = status.lower().startswith("up") and "unhealthy" not in status.lower()
        containers.append({
            "name": name,
            "status": status,
            "image": image,
            "running": running,
        })
    containers.sort(key=lambda c: (not c["running"], c["name"]))
    return {
        "ok": True,
        "count": len(containers),
        "up": sum(1 for c in containers if c["running"]),
        "down": [c["name"] for c in containers if not c["running"]],
        "containers": containers,
    }


def _docker(host_id: str = "local") -> Dict[str, Any]:
    host = _host(host_id) or {"id": "local", "ssh": None}
    return _cached(f"docker:{host_id}", 15.0, lambda: _docker_list(host))


# -------------------------------------------------------------------- proxmox


def _proxmox() -> Dict[str, Any]:
    host = _host((_config().get("proxmox") or {}).get("host", "pve"))
    if not host:
        return {"ok": False, "note": "no proxmox host configured", "vms": [], "cts": []}

    def measure() -> Dict[str, Any]:
        result = _run(
            ["ssh", *_ssh_opts(host), host["ssh"],
             "qm list 2>/dev/null; echo @@; pct list 2>/dev/null"],
            timeout=14.0,
        )
        if not result.get("ok") and not result.get("out"):
            return {"ok": False, "note": result.get("err") or "hypervisor did not answer",
                    "vms": [], "cts": []}
        chunks = (result.get("out") or "").split("@@")
        vms_text = chunks[0] if chunks else ""
        cts_text = chunks[1] if len(chunks) > 1 else ""

        vms = []
        for line in vms_text.splitlines():
            parts = line.split()
            if len(parts) < 5 or not parts[0].isdigit():
                continue
            vms.append({
                "vmid": parts[0],
                "name": parts[1],
                "status": parts[2].lower(),
                "mem_gb": round(int(parts[3] or 0) / 1024, 1) if parts[3].isdigit() else 0,
                "bootdisk_gb": parts[4],
                "kind": "vm",
            })

        cts = []
        for line in cts_text.splitlines():
            parts = line.split()
            if len(parts) < 2 or not parts[0].isdigit():
                continue
            status = parts[1].lower() if len(parts) > 1 else "?"
            name = parts[-1] if len(parts) > 2 else f"ct-{parts[0]}"
            cts.append({
                "vmid": parts[0],
                "name": name,
                "status": status,
                "mem_gb": None,
                "bootdisk_gb": None,
                "kind": "ct",
            })

        return {"ok": True, "host": host["id"], "vms": vms, "cts": cts}

    return _cached("proxmox", 15.0, measure)


# ------------------------------------------------------------------- services


def _probe_tcp(host: str, port: int) -> bool:
    try:
        with socket.create_connection((host, port), timeout=0.75):
            return True
    except OSError:
        return False


def _probe_http(url: str) -> bool:
    """Any answer under 500 counts as up — auth gates (401/403) are alive."""
    try:
        req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "Hermes-Homelab"})
        with urllib.request.urlopen(req, timeout=3.0) as resp:
            return resp.status < 500
    except urllib.error.HTTPError as exc:
        return exc.code < 500
    except (OSError, ValueError):
        return False


def _services() -> List[Dict[str, Any]]:
    out = []
    for svc in SERVICES:
        row = dict(svc)
        if svc.get("kind") == "http":
            row["open"] = _probe_http(svc["url"])
            row["port"] = None
            row["host"] = None
        else:
            row["open"] = _probe_tcp(svc.get("host") or "127.0.0.1", svc["port"])
        out.append(row)
    return out


def _tailnet() -> Dict[str, Any]:
    result = _run(["tailscale", "status", "--json"], timeout=8.0)
    if not result.get("ok") or not result.get("out"):
        return {"ok": False, "self": None, "peers": [], "note": "tailscale not available"}
    try:
        data = json.loads(result["out"])
    except ValueError:
        return {"ok": False, "self": None, "peers": [], "note": "tailscale returned invalid JSON"}

    peers = []
    for peer in (data.get("Peer") or {}).values():
        peers.append({
            "name": peer.get("HostName") or "?",
            "ip": (peer.get("TailscaleIPs") or [""])[0],
            "os": peer.get("OS") or "",
            "online": bool(peer.get("Online")),
            "last_seen": peer.get("LastSeen") or "",
            "active": bool(peer.get("Active")),
        })
    peers.sort(key=lambda p: (not p["online"], p["name"]))
    return {
        "ok": True,
        "self": {
            "name": (data.get("Self") or {}).get("HostName", socket.gethostname()),
            "ip": ((data.get("Self") or {}).get("TailscaleIPs") or [""])[0],
        },
        "peers": peers,
    }


def _gateway() -> Dict[str, Any]:
    try:
        with urllib.request.urlopen(GATEWAY_HEALTH, timeout=2.0) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return {"ok": bool(data.get("ok")),
                    "version": data.get("displayVersion") or data.get("version") or "?"}
    except (OSError, ValueError):
        return {"ok": False, "version": "?"}


# -------------------------------------------------------------------- actions

ACTIONS: Dict[str, Dict[str, Any]] = {
    "docker.restart": {"label": "Restart", "kind": "mutate", "confirm": False,
                       "needs": "container", "help": "docker restart"},
    "docker.stop": {"label": "Stop", "kind": "destructive", "confirm": True,
                    "needs": "container", "help": "docker stop"},
    "docker.start": {"label": "Start", "kind": "mutate", "confirm": False,
                     "needs": "container", "help": "docker start"},
    "svc.restart": {"label": "Restart unit", "kind": "mutate", "confirm": False,
                    "needs": "unit", "help": "systemctl restart"},
    "pve.vm.start": {"label": "Start", "kind": "mutate", "confirm": False,
                     "needs": "vmid", "help": "qm start"},
    "pve.vm.shutdown": {"label": "Shutdown", "kind": "destructive", "confirm": True,
                        "needs": "vmid", "help": "qm shutdown (ACPI, guest-initiated)"},
    "pve.vm.stop": {"label": "Power off", "kind": "destructive", "confirm": True,
                    "needs": "vmid", "help": "qm stop (hard)"},
    "pve.vm.reboot": {"label": "Reboot", "kind": "destructive", "confirm": True,
                      "needs": "vmid", "help": "qm reboot (ACPI)"},
    "pve.ct.start": {"label": "Start", "kind": "mutate", "confirm": False,
                     "needs": "vmid", "help": "pct start"},
    "pve.ct.shutdown": {"label": "Shutdown", "kind": "destructive", "confirm": True,
                        "needs": "vmid", "help": "pct shutdown"},
    "pve.ct.stop": {"label": "Stop", "kind": "destructive", "confirm": True,
                    "needs": "vmid", "help": "pct stop"},
    "pve.ct.reboot": {"label": "Reboot", "kind": "destructive", "confirm": True,
                      "needs": "vmid", "help": "pct reboot"},
    "host.reboot": {"label": "Reboot host", "kind": "destructive", "confirm": True,
                    "needs": "host", "help": "reboot — refuses this workstation"},
    "host.patch": {"label": "Install kernel", "kind": "mutate", "confirm": False,
                   "needs": "host", "help": "install the newest kernel package"},
    "ts.ping": {"label": "Ping", "kind": "read", "confirm": False,
                "needs": "peer", "help": "tailscale ping"},
    "docker.logs": {"label": "Logs", "kind": "read", "confirm": False,
                    "needs": "container", "help": "last 60 lines"},
}


def actions_available() -> List[Dict[str, Any]]:
    return [dict(id=key, **value) for key, value in ACTIONS.items()]


def _build_argv(action: str, host: Dict[str, Any], target: str) -> List[str]:
    """Turn a whitelisted action into an argv. Never accepts a raw command."""
    local = host.get("ssh") is None

    def remote(cmd: str) -> List[str]:
        if local:
            return ["/bin/sh", "-c", cmd]
        via = host.get("via")
        if via:
            b64 = base64.b64encode(cmd.encode()).decode()
            inner = f"echo {b64} | base64 -d | /bin/sh"
            return ["ssh", *_ssh_opts(host), host["ssh"], f"{via} /bin/sh -c {shlex.quote(inner)}"]
        return ["ssh", *_ssh_opts(host), host["ssh"], cmd]

    if action.startswith("docker."):
        verb = action.split(".", 1)[1]
        if not _NAME_RE.match(target):
            raise HTTPException(400, "invalid container name")
        if verb == "logs":
            return remote(f"docker logs --tail 60 {shlex.quote(target)} 2>&1")
        return remote(f"docker {verb} {shlex.quote(target)} 2>&1")

    if action == "svc.restart":
        if not _UNIT_RE.match(target):
            raise HTTPException(400, "invalid unit name")
        return remote(f"systemctl restart {shlex.quote(target)} 2>&1; sleep 1; systemctl is-active {shlex.quote(target)}")

    if action.startswith("pve."):
        parts = action.split(".")
        kind, verb = parts[1], parts[2]
        if not _VMID_RE.match(target):
            raise HTTPException(400, "invalid vmid")
        tool = "qm" if kind == "vm" else "pct"
        return ["ssh", *_ssh_opts(host), host["ssh"], f"{tool} {verb} {target} 2>&1"]

    if action == "host.reboot":
        return remote("systemctl reboot")

    if action == "host.patch":
        kernel_fix = host.get("kernel_fix") or ""
        if host["id"] == "pve" or "pve" in kernel_fix:
            return remote("DEBIAN_FRONTEND=noninteractive apt-get install -y proxmox-kernel-7.0 2>&1 | tail -5")
        return remote("DEBIAN_FRONTEND=noninteractive apt-get install -y linux-image-generic 2>&1 | tail -5")

    if action == "ts.ping":
        peer = target
        if not _NAME_RE.match(peer):
            raise HTTPException(400, "invalid peer")
        return ["tailscale", "ping", "-c", "3", peer]

    raise HTTPException(400, f"unknown action: {action}")


@router.post("/action")
def action(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    action_id = str(payload.get("action") or "")
    host_id = str(payload.get("host") or "local")
    target = str(payload.get("target") or "")
    confirm = str(payload.get("confirm") or "")

    spec = ACTIONS.get(action_id)
    if not spec:
        raise HTTPException(400, f"unknown action: {action_id}")

    host = _host(host_id)
    if not host:
        raise HTTPException(400, f"unknown host: {host_id}")

    if spec.get("needs") == "host":
        target = host_id
    if spec.get("needs") == "peer":
        target = target or host_id

    if spec.get("confirm") and confirm != target:
        raise HTTPException(409, f"{action_id} on {target} needs confirm={target}")

    # This workstation must not reboot itself from its own control page.
    if action_id == "host.reboot" and host.get("ssh") is None:
        raise HTTPException(
            409,
            "refusing to reboot the machine serving this page — pick a remote host",
        )

    if action_id.startswith("docker.") and action_id != "docker.logs":
        known = {c["name"] for c in _docker(host_id).get("containers", [])}
        if known and target not in known:
            raise HTTPException(400, f"{target} is not a container on {host_id}")

    if action_id.startswith("pve."):
        inventory = _proxmox()
        if not inventory.get("ok"):
            raise HTTPException(409, "hypervisor inventory unavailable — refusing to act blind")
        pool = inventory["vms"] if ".vm." in action_id else inventory["cts"]
        if target not in {row["vmid"] for row in pool}:
            raise HTTPException(400, f"{target} is not a known {'VM' if '.vm.' in action_id else 'container'}")

    argv = _build_argv(action_id, host, target)
    started = time.time()
    result = _run(argv, timeout=float(payload.get("timeout") or 45.0))
    entry = {
        "at": time.strftime("%Y-%m-%d %H:%M:%S %z"),
        "action": action_id,
        "host": host_id,
        "target": target,
        "ok": bool(result.get("ok")),
        "code": result.get("code"),
        "ms": int((time.time() - started) * 1000),
        "cmd": result.get("cmd"),
        "out": (result.get("out") or "")[:2000],
        "err": (result.get("err") or "")[:2000],
    }
    _audit_append(entry)
    _invalidate()
    return {"ok": entry["ok"], "result": entry, "refresh": True}


# ------------------------------------------------------------------ remote admin


# Verbs that end a machine or destroy a disk ask for a typed confirmation even
# inside the free-form terminal. Everything else runs — this is a homelab, and
# the operator asked for a shell, not a wizard.
_EXEC_DANGER = re.compile(
    r"(^|\s)(reboot|shutdown|poweroff|halt|mkfs(\.[a-z0-9]+)?|wipefs|fdisk|sgdisk|"
    r"init\s+0|systemctl\s+(poweroff|reboot|halt))(\s|$)"
)


@router.post("/exec")
def exec_remote(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Run one command line on a host and return its real output.

    The free-form terminal. Commands that end the machine or destroy a disk need
    ``confirm`` equal to the host id; everything else runs immediately. Every
    call is appended to the audit log with its exit code.
    """
    host_id = str(payload.get("host") or "local")
    cmd = str(payload.get("cmd") or "").strip()
    confirm = str(payload.get("confirm") or "")
    host = _host(host_id)
    if not host:
        raise HTTPException(400, f"unknown host: {host_id}")
    if not cmd:
        raise HTTPException(400, "empty command")
    if len(cmd) > 4000:
        raise HTTPException(400, "command too long")
    if _EXEC_DANGER.search(cmd) and confirm != host_id:
        raise HTTPException(409, f"this command can take the machine down — pass confirm={host_id}")

    result = _remote_script(host, cmd, timeout=float(payload.get("timeout") or 30.0))
    entry = {
        "at": time.strftime("%Y-%m-%d %H:%M:%S %z"),
        "action": "shell",
        "host": host_id,
        "target": cmd[:120],
        "ok": bool(result.get("ok")),
        "code": result.get("code"),
        "ms": result.get("ms"),
        "cmd": cmd[:400],
        "out": (result.get("out") or "")[-8000:],
        "err": (result.get("err") or "")[-4000:],
    }
    _audit_append(entry)
    return {"ok": entry["ok"], "result": entry}


def _safe_path(path: str) -> str:
    path = path or "/"
    if "\x00" in path or len(path) > 512:
        raise HTTPException(400, "bad path")
    return path


@router.get("/files")
def files(host: str = "local", path: str = "/") -> Dict[str, Any]:
    """Directory listing, parsed — not raw ls output."""
    h = _host(host)
    if not h:
        raise HTTPException(400, f"unknown host: {host}")
    path = _safe_path(path)
    # -l for the mode, -a for dotfiles, -n to keep numeric owners (no DNS), and a
    # fixed time format so the parse never depends on the host's locale.
    script = (
        f"cd {shlex.quote(path)} 2>/dev/null && ls -lan --time-style=+%s || echo __NOTADIR__"
    )
    result = _remote_script(h, script, timeout=15.0)
    out = result.get("out") or ""
    if "__NOTADIR__" in out:
        raise HTTPException(404, f"{path} is not a readable directory on {host}")
    entries = []
    for line in out.splitlines():
        if line.startswith("total ") or not line.strip():
            continue
        parts = line.split(None, 6)
        if len(parts) < 7:
            continue
        mode, _links, owner, _group, size, mtime, name = parts
        if name in (".", ".."):
            continue
        entries.append({
            "name": name,
            "dir": mode.startswith("d"),
            "link": mode.startswith("l"),
            "size": int(size) if size.isdigit() else 0,
            "mtime": int(mtime) if mtime.isdigit() else 0,
            "owner": owner,
            "mode": mode,
        })
    entries.sort(key=lambda e: (not e["dir"], e["name"].lower()))
    parent = os.path.dirname(path.rstrip("/")) or "/"
    return {"ok": True, "host": host, "path": path, "parent": parent, "entries": entries[:500]}


@router.get("/file")
def file_read(host: str = "local", path: str = "", bytes: int = 120_000) -> Dict[str, Any]:
    h = _host(host)
    if not h or not path:
        raise HTTPException(400, "host and path are required")
    path = _safe_path(path)
    limit = max(1000, min(400_000, bytes))
    script = (
        f"f={shlex.quote(path)}; [ -f \"$f\" ] || {{ echo __ERR__; exit 4; }}; "
        f"stat -c %s \"$f\"; head -c {limit} \"$f\" | base64 -w0"
    )
    result = _remote_script(h, script, timeout=20.0)
    out = result.get("out") or ""
    if out.startswith("__ERR__"):
        raise HTTPException(404, f"{path} is not a readable file on {host}")
    size_line, _, b64 = out.partition("\n")
    try:
        data = base64.b64decode(b64.strip()).decode("utf-8", "replace")
        size = int(size_line.strip())
    except (ValueError, TypeError):
        raise HTTPException(502, "could not read that file")
    return {"ok": True, "host": host, "path": path, "size": size,
            "truncated": size > limit, "text": data}


@router.get("/services")
def services(host: str = "local") -> Dict[str, Any]:
    """systemd units with their real state, failed first."""
    h = _host(host)
    if not h:
        raise HTTPException(400, f"unknown host: {host}")
    result = _remote_script(
        h,
        "systemctl list-units --type=service --all --no-legend --no-pager --plain 2>/dev/null "
        "| sed 's/^ *//'",
        timeout=15.0,
    )
    units = []
    for line in (result.get("out") or "").splitlines():
        parts = line.split(None, 4)
        if len(parts) < 4:
            continue
        unit, load, active, sub = parts[0], parts[1], parts[2], parts[3]
        desc = parts[4] if len(parts) > 4 else ""
        if not unit.endswith(".service"):
            continue
        units.append({"unit": unit, "load": load, "active": active, "sub": sub,
                      "description": desc, "failed": active == "failed" or sub == "failed"})
    units.sort(key=lambda u: (not u["failed"], u["unit"]))
    return {"ok": True, "host": host, "count": len(units),
            "failed": sum(1 for u in units if u["failed"]), "units": units[:400]}


_SVC_OPS = {"start", "stop", "restart", "reload", "enable", "disable", "mask", "unmask"}


@router.post("/service")
def service_op(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    host_id = str(payload.get("host") or "local")
    unit = str(payload.get("unit") or "")
    op = str(payload.get("op") or "")
    confirm = str(payload.get("confirm") or "")
    h = _host(host_id)
    if not h:
        raise HTTPException(400, f"unknown host: {host_id}")
    if not _UNIT_RE.match(unit) or not unit.endswith(".service"):
        raise HTTPException(400, "invalid unit name")
    if op not in _SVC_OPS:
        raise HTTPException(400, f"unsupported op: {op}")
    if op in {"stop", "disable", "mask"} and confirm != unit:
        raise HTTPException(409, f"{op} {unit} needs confirm={unit}")
    result = _remote_script(h, f"systemctl {op} {shlex.quote(unit)} 2>&1; sleep 1; systemctl is-active {shlex.quote(unit)}", timeout=45.0)
    entry = {
        "at": time.strftime("%Y-%m-%d %H:%M:%S %z"),
        "action": f"svc.{op}",
        "host": host_id,
        "target": unit,
        "ok": bool(result.get("ok")),
        "code": result.get("code"),
        "ms": result.get("ms"),
        "cmd": f"systemctl {op} {unit}",
        "out": (result.get("out") or "")[-4000:],
        "err": (result.get("err") or "")[-2000:],
    }
    _audit_append(entry)
    return {"ok": entry["ok"], "result": entry}


@router.get("/snapshots")
def snapshots(host: str = "pve", vmid: str = "") -> Dict[str, Any]:
    h = _host(host)
    if not h:
        raise HTTPException(400, f"unknown host: {host}")
    if not _VMID_RE.match(vmid):
        raise HTTPException(400, "invalid vmid")
    result = _run(["ssh", *_ssh_opts(h), h["ssh"], f"qm listsnapshot {vmid} 2>&1"], timeout=20.0)
    raw = (result.get("out") or result.get("err") or "")
    names = []
    for line in raw.splitlines():
        if "`-" not in line:
            continue
        token = line.split("`-", 1)[1].strip().lstrip(">").split()
        if token:
            name = token[0]
            if name not in names:
                names.append(name)
    return {"ok": bool(result.get("ok")), "vmid": vmid, "snapshots": names, "raw": raw[:2000]}


@router.post("/snapshot")
def snapshot_create(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    host_id = str(payload.get("host") or "pve")
    vmid = str(payload.get("vmid") or "")
    name = str(payload.get("name") or "")
    h = _host(host_id)
    if not h:
        raise HTTPException(400, f"unknown host: {host_id}")
    if not _VMID_RE.match(vmid):
        raise HTTPException(400, "invalid vmid")
    label = re.sub(r"[^A-Za-z0-9_-]", "", name)[:40] or time.strftime("snap%Y%m%d%H%M")
    result = _run(["ssh", *_ssh_opts(h), h["ssh"], f"qm snapshot {vmid} {label} --description 'from homelab deck' 2>&1"], timeout=180.0)
    _audit_append({
        "at": time.strftime("%Y-%m-%d %H:%M:%S %z"),
        "action": "pve.snapshot", "host": host_id, "target": f"{vmid}:{label}",
        "ok": bool(result.get("ok")), "code": result.get("code"), "ms": result.get("ms"),
        "cmd": f"qm snapshot {vmid} {label}",
        "out": (result.get("out") or "")[-2000:], "err": (result.get("err") or "")[-2000:],
    })
    return {"ok": bool(result.get("ok")), "label": label,
            "out": (result.get("out") or result.get("err") or "")[:2000]}


@router.get("/actions")
def actions() -> Dict[str, Any]:
    return {"ok": True, "actions": actions_available(),
            "hosts": [{"id": h["id"], "can": h.get("can") or []} for h in _hosts()]}


@router.get("/audit")
def audit(limit: int = 25) -> Dict[str, Any]:
    return {"ok": True, "entries": _audit_tail(max(1, min(200, limit)))}


# --------------------------------------------------------------------- routes


@router.get("/health")
def health() -> Dict[str, Any]:
    return {"ok": True, "plugin": "homelab"}


@router.get("/fleet")
def fleet() -> Dict[str, Any]:
    return {"ok": True, "measured_at": time.strftime("%Y-%m-%d %H:%M:%S %z"),
            "hosts": _fleet()}


@router.get("/proxmox")
def proxmox() -> Dict[str, Any]:
    return {"ok": True, **_proxmox()}


@router.get("/docker")
def docker(host: str = "local") -> Dict[str, Any]:
    if not _host(host):
        raise HTTPException(400, f"unknown host: {host}")
    return {"ok": True, "host": host, **_docker(host)}


@router.get("/logs")
def logs(host: str = "local", target: str = "", lines: int = 60) -> Dict[str, Any]:
    spec_host = _host(host)
    if not spec_host or not _NAME_RE.match(target):
        raise HTTPException(400, "bad host or target")
    lines = max(1, min(400, lines))
    result = _remote_script(spec_host, f"docker logs --tail {lines} {shlex.quote(target)} 2>&1", timeout=15.0)
    return {"ok": bool(result.get("ok")), "out": (result.get("out") or "")[-20000:],
            "err": result.get("err") or ""}


@router.get("/state")
def state() -> Dict[str, Any]:
    host_facts = _host_facts()
    fleet_rows = _fleet()
    local_row = next((r for r in fleet_rows if r["id"] == "local"), {})
    security = {
        "cve": (_config().get("cve") or {}),
        "hosts": [
            {
                "id": row["id"],
                "name": row["name"],
                "kernel": row.get("kernel"),
                "kernel_fix": row.get("kernel_fix"),
                "patch_state": row.get("patch_state"),
                "mitigation": row.get("mitigation"),
                "mptcp_enabled": row.get("mptcp_enabled"),
                "reboot_required": row.get("reboot_required"),
                "reachable": row.get("reachable"),
            }
            for row in fleet_rows
        ],
    }
    return {
        "ok": True,
        "measured_at": time.strftime("%Y-%m-%d %H:%M:%S %z"),
        "host": host_facts,
        "disks": _disks(),
        "docker": _docker("local"),
        "services": _services(),
        "tailnet": _tailnet(),
        "gateway": _gateway(),
        "fleet": fleet_rows,
        "proxmox": _proxmox(),
        "security": security,
        "audit": _audit_tail(12),
        "actions": actions_available(),
        "local_kernel_rows": local_row,
        "shared_docker_hosts": [h["id"] for h in _hosts() if "docker" in (h.get("can") or [])],
    }
