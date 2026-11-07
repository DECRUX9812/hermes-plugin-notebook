#!/usr/bin/env python3
"""Build the demo notebook for the hermes-notebook plugin from cached, real pages.

Inputs (both committed next to this script):
  demo-sources.json  manifest: notebook meta + one entry per source {id,title,url,file}
  demo-raw/<file>    the unmodified text web_extract returned for that URL

Output (the plugin's on-disk format, see hermes_notebook/store.py):
  <plugin-data>/notebooks/<slug>/notebook.json
  <plugin-data>/notebooks/<slug>/sources/index.json
  <plugin-data>/notebooks/<slug>/sources/<id>.txt
  <plugin-data>/notebooks/<slug>/threads/default.json   (only if absent)

Idempotent: reruns rewrite the same bytes. `added_at` and `created_at` are
carried over from the existing notebook, and source text is only re-derived
from the cached raw file, so the content_hash stays stable. Chat threads are
user state, so they are never overwritten.

Usage:
  python3 tests/build_demo_notebook.py          # build / refresh
  python3 tests/build_demo_notebook.py --check  # build + verify, exit 1 on mismatch
"""

from __future__ import annotations

import argparse
import datetime
import hashlib
import json
import os
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
MANIFEST = HERE / "demo-sources.json"
RAW_DIR = HERE / "demo-raw"
MAX_CHARS = 60_000
MIN_TOTAL_CHARS = 40_000
STAMP_RE = re.compile(r"[a-z0-9][a-z0-9-]{0,80}")


# ------------------------------------------------------------------ helpers

def plugin_data() -> Path:
    """Mirror hermes_notebook.runtime.plugin_data() without importing the plugin."""
    env = os.environ.get("HERMES_NOTEBOOK_PLUGIN_DATA") or os.environ.get("HERMES_PLUGIN_DATA")
    if env:
        return Path(env).expanduser() / "hermes-notebook"
    return Path.home() / ".hermes" / "plugin-data" / "hermes-notebook"


def iso(ts: float | None = None) -> str:
    ts = datetime.datetime.now(datetime.timezone.utc).timestamp() if ts is None else ts
    return datetime.datetime.fromtimestamp(ts, datetime.timezone.utc).isoformat(timespec="seconds")


def store_content_hash(text: str) -> str:
    """Identical to hermes_notebook.store.content_hash (sha1 of normalized text).

    Note: the plugin hashes the whitespace-collapsed, lowercased text with
    sha1, not raw sha256. Verified against the live smoke-test notebook.
    """
    norm = re.sub(r"\s+", " ", (text or "").strip().lower())
    return hashlib.sha1(norm.encode("utf-8", errors="replace")).hexdigest()[:16]


def sha256_16(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]


def truncate(text: str, limit: int = MAX_CHARS) -> str:
    """Cut on a paragraph boundary; never split mid-sentence when avoidable."""
    text = text.replace("\r\n", "\n").replace("\r", "\n").strip()
    # congress.gov emits its server-side template directive as the first line of
    # the rendered page; it is code, not document text, so drop that one line.
    text = re.sub(r"\A<%@.*?%>\s*", "", text)
    if len(text) <= limit:
        return text + "\n"
    cut = text.rfind("\n\n", 0, limit)
    if cut < limit // 2:
        cut = text.rfind("\n", 0, limit)
    if cut < limit // 2:
        cut = limit
    return text[:cut].rstrip() + "\n"


def read_json(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return default


def write_json(path: Path, data) -> None:
    """Same serialisation as store._write_json, atomic via tmp+replace."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, indent=1, ensure_ascii=False), encoding="utf-8")
    tmp.replace(path)


# ------------------------------------------------------------------- threads

# Two exchanges grounded in the sources above: every number below appears in
# the fetched text (ITER press release 29 Jul 2026; Reuters 25 Aug 2026).
THREAD = [
    {
        "role": "user",
        "content": "Where does ITER's machine assembly actually stand?",
    },
    {
        "role": "assistant",
        "content": (
            "As of 29 July 2026 the ITER Organization had installed the sixth of nine "
            "tokamak sector modules in the tokamak pit, putting roughly two-thirds of the "
            "torus-shaped core in place. The organisation says the milestone landed almost "
            "six months ahead of schedule, and the module involved weighed about 1,100 tonnes "
            "and was transferred from the Assembly Hall in a coordinated lifting operation. "
            "Sources: 'Two-thirds of ITER tokamak core now in place' (ITER, 29 Jul 2026) and "
            "ANS Nuclear Newswire's 9 Sep 2026 assembly report."
        ),
    },
    {
        "role": "user",
        "content": "Is the US roadmap to fusion deployment by the mid-2030s credible?",
    },
    {
        "role": "assistant",
        "content": (
            "Reuters (25 Aug 2026) reports the US government launched a strategy to catalyse "
            "early-stage fusion plants by the mid-2030s, and that success hinges on more "
            "federal funding. Developers point to unsolved engineering: neutron-resistant "
            "structural materials, tritium separation and reprocessing, and components that "
            "survive constant high-energy neutron flux. Robb Hughes of Realta Fusion framed it "
            "as \"The plan isn't the problem. We all agree on the plan. The X factor is the "
            "funding.\" The roadmap leans on existing DOE programmes such as Milestone-Based "
            "Fusion Development and INFUSE. Treat the timeline as policy intent, not a "
            "committed delivery date."
        ),
    },
]


def build_thread(path: Path) -> bool:
    if path.exists():
        return False
    now = iso()
    write_json(path, [dict(msg, ts=now) for msg in THREAD])
    return True


# --------------------------------------------------------------------- build

def build() -> dict:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    meta_in = manifest["notebook"]
    slug = meta_in["slug"]
    if not STAMP_RE.fullmatch(slug):
        raise SystemExit(f"invalid notebook slug {slug!r}")

    nb = plugin_data() / "notebooks" / slug
    src_dir = nb / "sources"
    art_dir = nb / "artifacts"
    src_dir.mkdir(parents=True, exist_ok=True)
    art_dir.mkdir(parents=True, exist_ok=True)

    # notebook.json — keep created_at on rebuild
    old_meta = read_json(nb / "notebook.json", {})
    created = old_meta.get("created_at") or iso()
    now = iso()
    meta = {
        "id": slug,
        "title": meta_in["title"],
        "description": meta_in.get("description", ""),
        "created_at": created,
        "updated_at": now,
    }
    # unchanged title/description => leave the file (and its updated_at) alone
    unchanged = all(old_meta.get(k) == meta[k] for k in ("id", "title", "description", "created_at"))
    if unchanged:
        meta = old_meta
    else:
        write_json(nb / "notebook.json", meta)

    old_index = {s.get("id"): s for s in read_json(src_dir / "index.json", [])}
    index: list[dict] = []

    for entry in manifest["sources"]:
        sid = entry["id"]
        raw_path = RAW_DIR / entry["file"]
        if not raw_path.is_file():
            raise SystemExit(f"missing cached raw source {raw_path} — refetch it first")
        text = truncate(raw_path.read_text(encoding="utf-8"))
        digest = store_content_hash(text)

        txt = src_dir / f"{sid}.txt"
        if not txt.exists() or txt.read_text(encoding="utf-8", errors="replace") != text:
            txt.write_text(text, encoding="utf-8")

        prev = old_index.get(sid, {})
        same = prev.get("content_hash") == digest and prev.get("chars") == len(text)
        index.append({
            "id": sid,
            "title": entry["title"],
            "kind": "url",
            "origin": entry["url"],
            "added_at": prev.get("added_at") if same else (prev.get("added_at") or now),
            "chars": len(text),
            "labels": [],
            "summary": "",
            "content_hash": digest,
            "locator": entry["url"],
        })

    # drop anything that is no longer in the manifest
    keep = {s["id"] for s in index}
    for stale in src_dir.glob("*.txt"):
        if stale.stem not in keep:
            stale.unlink()

    if index != read_json(src_dir / "index.json", []):
        write_json(src_dir / "index.json", index)

    thread_written = build_thread(nb / "threads" / "default.json")

    total = sum(s["chars"] for s in index)
    print(f"notebook : {slug} -> {nb}")
    print(f"sources  : {len(index)}  total chars: {total}  thread written: {thread_written}")
    for s in index:
        print(f"  {s['id']:<38} {s['chars']:>6}  {s['content_hash']}")
    if total < MIN_TOTAL_CHARS:
        raise SystemExit(f"total chars {total} < required {MIN_TOTAL_CHARS}")
    return {"dir": nb, "meta": meta, "index": index, "total": total}


def verify(nb: Path) -> bool:
    meta = read_json(nb / "notebook.json", {})
    index = read_json(nb / "sources" / "index.json", [])
    ok = True
    print(f"\nverifying {nb}  (id={meta.get('id')!r})")
    print(f"{'#':<3}{'id':<38}{'chars':>7}  {'recorded':<17}{'recomputed':<17}ok")
    total = 0
    for i, s in enumerate(index, 1):
        p = nb / "sources" / f"{s['id']}.txt"
        exists = p.is_file()
        text = p.read_text(encoding="utf-8", errors="replace") if exists else ""
        rec = s.get("content_hash", "")
        calc = store_content_hash(text)
        good = exists and rec == calc and s.get("chars") == len(text)
        ok &= good
        total += s.get("chars", 0)
        print(f"{i:<3}{s['id']:<38}{s.get('chars', 0):>7}  {rec:<17}{calc:<17}{'yes' if good else 'NO'}")
    print(f"\nentries={len(index)} total_chars={total} all_hash_ok={ok}")
    print(f"meta keys present: {sorted(meta)}")
    print(f"labels/summary clean: {all(s.get('labels') == [] and s.get('summary') == '' for s in index)}")
    ok &= len(index) == 6 and total > 40_000
    print(f"RESULT: {'PASS' if ok else 'FAIL'}")
    return ok


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="verify after building")
    args = ap.parse_args()
    out = build()
    if args.check:
        return 0 if verify(out["dir"]) else 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
