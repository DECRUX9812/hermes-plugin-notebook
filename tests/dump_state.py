"""Dump the REAL backend payloads the preview harness renders.

The harness must show what the live route returns, not a hand-written shim:
this imports the plugin's own router module, calls the same functions, and
copies the artifact bytes the page would fetch.

    python3 tests/dump_state.py [--refresh-ops] [--notebook <id>]
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "dashboard"))

import plugin_api  # noqa: E402
import ops_api  # noqa: E402
from hermes_notebook import store  # noqa: E402

TMP = HERE / "tmp"
ART = TMP / "artifacts"


def dump_state(notebook: str) -> dict:
    payload = plugin_api.state(notebook=notebook)
    if not isinstance(payload, dict):
        raise SystemExit("state() did not return a dict — the backend refused")
    return payload


def copy_artifacts(notebook_id: str) -> int:
    ART.mkdir(parents=True, exist_ok=True)
    src = store._nb_dir(notebook_id) / "artifacts"
    n = 0
    if src.is_dir():
        for p in src.iterdir():
            if p.is_file():
                shutil.copy2(p, ART / p.name)
                n += 1
    return n


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--notebook", default="")
    ap.add_argument("--refresh-ops", action="store_true")
    args = ap.parse_args()

    TMP.mkdir(parents=True, exist_ok=True)
    state = dump_state(args.notebook)
    (TMP / "state.json").write_text(json.dumps(state, indent=1), encoding="utf-8")
    nb = state.get("notebook") or {}
    print(f"state: {len(state.get('notebooks', []))} notebooks · active={nb.get('id')} "
          f"· {len(nb.get('sources', []))} sources · {len(nb.get('artifacts', []))} artifacts")

    if nb.get("id"):
        print(f"artifacts copied: {copy_artifacts(nb['id'])} → {ART}")

    # The style picker's thumbnails come from the same route the page calls, so the
    # harness renders real previews instead of a placeholder.
    styles = plugin_api.infographic_styles(previews=1, notebook=nb.get("id") or "")
    (TMP / "styles.json").write_text(json.dumps(styles), encoding="utf-8")
    print(f"styles: {styles.get('count')} looks · {len(styles.get('previews') or {})} previews")

    fleet_path = TMP / "ops-fleet.json"
    if args.refresh_ops or not fleet_path.exists():
        fleet = ops_api.fleet()
        fleet_path.write_text(json.dumps(fleet, indent=1), encoding="utf-8")
        print(f"fleet: {len(fleet.get('hosts', []))} hosts measured")
    else:
        print(f"fleet: cached ({fleet_path.name}) — pass --refresh-ops to re-measure")

    services_path = TMP / "ops-services.json"
    if args.refresh_ops or not services_path.exists():
        services = ops_api.services(host="local")
        services_path.write_text(json.dumps(services, indent=1), encoding="utf-8")
        print(f"services: {services.get('count')} units on local")

    audit_path = TMP / "ops-audit.json"
    if args.refresh_ops or not audit_path.exists():
        audit_path.write_text(json.dumps(ops_api.audit(limit=40), indent=1), encoding="utf-8")
        print("audit: dumped")


if __name__ == "__main__":
    main()
