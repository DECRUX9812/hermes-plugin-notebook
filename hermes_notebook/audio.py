"""Audio Overview — the NotebookLM signature: a two-host podcast about the
notebook's sources.

Pipeline: ctx.llm structured call writes a speaker-labeled script → edge-tts
synthesizes each segment with a distinct neural voice → ffmpeg concatenates the
clips into one mp3 + a speaker-labeled transcript.
"""

from __future__ import annotations

import asyncio
import json
import re
import shutil
import subprocess
from pathlib import Path
from typing import Any, Optional

from . import llmio, retrieve, runtime, store

LENGTHS = {
    "short": {"words": (550, 850), "label": "about 5 minutes"},
    "medium": {"words": (1300, 1800), "label": "about 10 minutes"},
    "long": {"words": (2400, 3400), "label": "about 18 minutes"},
}

_SCRIPT_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string", "description": "Catchy podcast episode title"},
        "segments": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "speaker": {"type": "string",
                                "description": "host_a or host_b"},
                    "text": {"type": "string",
                             "description": "What this host says (20-70 words, conversational)"},
                },
                "required": ["speaker", "text"],
            },
        },
    },
    "required": ["title", "segments"],
}


def _norm_speaker(raw: Any, index: int, last: str) -> str:
    s = str(raw or "").strip().lower()
    if "b" in s or "sam" in s or "second" in s or "host 2" in s:
        return "host_b"
    if "a" in s or "alex" in s or "first" in s or "host 1" in s or "narrator" in s:
        return "host_a"
    # unknown labels: alternate, preferring to switch speakers for listenability
    return "host_b" if last == "host_a" else "host_a"


def _write_script(notebook_id: str, script: dict) -> tuple[list[dict], str]:
    """Normalize model output into [{speaker,text}] with sane alternation."""
    segs = []
    last = ""
    for i, raw in enumerate(script.get("segments") or []):
        if not isinstance(raw, dict):
            continue
        text = re.sub(r"\s+", " ", str(raw.get("text") or "")).strip()
        if len(text) < 3:
            continue
        sp = _norm_speaker(raw.get("speaker"), i, last)
        # avoid 3+ consecutive turns by the same host: nudge label
        if len(segs) >= 2 and segs[-1]["speaker"] == sp == segs[-2]["speaker"]:
            sp = "host_b" if sp == "host_a" else "host_a"
        segs.append({"speaker": sp, "text": text})
        last = sp
    if not segs:
        raise RuntimeError("model returned an empty podcast script")
    return segs, str(script.get("title") or "Audio Overview").strip()


def _script_prompt(meta: dict, digest: str, length: str, focus: str) -> str:
    lo, hi = LENGTHS[length]["words"]
    focus_line = f"\nThe user specifically wants the episode to focus on: {focus.strip()}\n" if focus.strip() else ""
    return (
        "Write a two-host podcast script ABOUT the notebook sources below — "
        "this is the 'Audio Overview' feature. Two hosts (host_a and host_b) "
        "have a natural, warm, curious conversation that explains the material "
        "the way NotebookLM does: they introduce the topic, take turns "
        "explaining concepts in plain language, react to interesting details, "
        "connect ideas across sources, and land on practical takeaways.\n\n"
        f"TARGET LENGTH: {LENGTHS[length]['label']} — roughly {lo}-{hi} words "
        f"total across ~25-60 segments. Each segment is ONE speaker turn of "
        "20-70 words. Alternate speakers naturally; occasional short reactions "
        "('Wow, that's wild', 'Wait — so...') are good. NEVER break the fourth "
        "wall about being an AI; just talk about the material.\n"
        f"{focus_line}\n"
        "Open with host_a welcoming listeners and naming the topic in one "
        "sentence, host_b riffing on it. Close with a one-paragraph recap of "
        "the 3 biggest takeaways.\n\n"
        f"NOTEBOOK: {meta.get('title')}\nDESCRIPTION: {meta.get('description', '')}\n\n"
        f"SOURCES:\n{digest}"
    )


async def _synth_segment(text: str, voice: str, out: Path, sem: asyncio.Semaphore) -> None:
    import edge_tts
    async with sem:
        for attempt in range(3):
            try:
                await edge_tts.Communicate(text, voice=voice).save(str(out))
                return
            except Exception:
                if attempt == 2:
                    raise
                await asyncio.sleep(1.5 * (attempt + 1))


def _concat_mp3(parts: list[Path], out_path: Path) -> None:
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError(
            "ffmpeg not found — needed to join the audio segments. "
            "Install ffmpeg (it ships with most distros) and retry."
        )
    lst = out_path.parent / "_concat.txt"
    lst.write_text("".join(f"file '{p.resolve()}'\n" for p in parts), encoding="utf-8")
    try:
        r = subprocess.run(
            [ffmpeg, "-y", "-loglevel", "error", "-f", "concat", "-safe", "0",
             "-i", str(lst), "-c", "copy", str(out_path)],
            capture_output=True, text=True, timeout=300,
        )
        if r.returncode != 0 or not out_path.exists() or out_path.stat().st_size < 1000:
            # re-encode fallback (handles mismatched segment params)
            r = subprocess.run(
                [ffmpeg, "-y", "-loglevel", "error", "-f", "concat", "-safe", "0",
                 "-i", str(lst), "-c:a", "libmp3lame", "-q:a", "4", str(out_path)],
                capture_output=True, text=True, timeout=600,
            )
        if r.returncode != 0 or not out_path.exists():
            raise RuntimeError(f"ffmpeg concat failed: {(r.stderr or '')[-400:]}")
    finally:
        lst.unlink(missing_ok=True)


def _probe_duration(path: Path) -> Optional[float]:
    ffprobe = shutil.which("ffprobe")
    if not ffprobe:
        return None
    try:
        r = subprocess.run(
            [ffprobe, "-v", "quiet", "-show_entries", "format=duration",
             "-of", "csv=p=0", str(path)],
            capture_output=True, text=True, timeout=30,
        )
        return float(r.stdout.strip())
    except Exception:
        return None


async def make_audio_overview(notebook: str, *, length: Optional[str] = None,
                              focus: str = "") -> dict:
    """Generate the two-host audio overview. Async — runs under an event loop."""
    nb_id = store.resolve_notebook(notebook)
    meta = store.get_meta(nb_id)
    sources = store.list_sources(nb_id)
    if not sources:
        raise ValueError(f"notebook {nb_id!r} has no sources — add some first")

    length = (length or str(runtime.config("podcast_length", default="medium")) or "medium").lower()
    if length not in LENGTHS:
        length = "medium"

    try:
        import edge_tts  # noqa: F401
    except ImportError as exc:
        raise RuntimeError(
            "audio overviews need the edge-tts package (a declared plugin "
            "dependency). Reinstall/re-enable the plugin so PM can fetch it."
        ) from exc

    digest = retrieve.notebook_digest(nb_id, max_chars=int(runtime.config("podcast_context_chars", default=42000)))
    parsed = llmio.structured(
        instructions="Write the full two-host podcast script as JSON.",
        input=[{"type": "text", "text": _script_prompt(meta, digest, length, focus)}],
        json_schema=_SCRIPT_SCHEMA,
        schema_name="notebook.podcast_script",
        system_prompt=(
            "You are a podcast scriptwriter. Output only the JSON script — "
            "no markdown fences, no commentary."
        ),
        purpose="hermes-notebook.audio_overview",
        max_tokens=16000,
        temperature=0.7,
        timeout=600.0,
    )
    if parsed is None:
        raise RuntimeError("model did not return a valid podcast script JSON")
    segs, ep_title = _write_script(nb_id, parsed)

    voice_a = str(runtime.config("audio_voice_host_a", default="en-US-AndrewNeural"))
    voice_b = str(runtime.config("audio_voice_host_b", default="en-US-EmmaNeural"))

    # artifacts dir + per-episode workdir
    nb_dir = store._nb_dir(nb_id)
    stamp = runtime.utc_stamp()
    work = nb_dir / "artifacts" / f"_audio_{stamp}"
    work.mkdir(parents=True, exist_ok=True)

    sem = asyncio.Semaphore(4)
    tasks = []
    for i, seg in enumerate(segs):
        voice = voice_a if seg["speaker"] == "host_a" else voice_b
        out = work / f"seg_{i:03d}.mp3"
        tasks.append(_synth_segment(seg["text"], voice, out, sem))
    results = await asyncio.gather(*tasks, return_exceptions=True)
    errors = [r for r in results if isinstance(r, BaseException)]
    if errors:
        raise RuntimeError(f"TTS failed for {len(errors)}/{len(segs)} segments: {errors[0]}")

    parts = [work / f"seg_{i:03d}.mp3" for i in range(len(segs))]
    mp3_path = nb_dir / "artifacts" / f"{stamp}-audio_overview.mp3"
    _concat_mp3(parts, mp3_path)

    speaker_name = {"host_a": "Host A", "host_b": "Host B"}
    transcript_lines = [f"# {ep_title}", "",
                        f"_Audio overview of “{meta.get('title')}” — {len(segs)} segments, "
                        f"voices: {voice_a} / {voice_b}_", ""]
    for seg in segs:
        transcript_lines += [f"**{speaker_name[seg['speaker']]}:** {seg['text']}", ""]
    txt_path = nb_dir / "artifacts" / f"{stamp}-audio_overview.txt"
    txt_path.write_text("\n".join(transcript_lines), encoding="utf-8")

    script_path = nb_dir / "artifacts" / f"{stamp}-audio_overview.json"
    script_path.write_text(json.dumps(
        {"title": ep_title, "notebook": meta.get("title"), "length": length,
         "voices": {"host_a": voice_a, "host_b": voice_b}, "segments": segs},
        indent=2, ensure_ascii=False), encoding="utf-8")

    # tidy: drop segment files, keep the episode artifacts
    for p in parts:
        p.unlink(missing_ok=True)
    try:
        work.rmdir()
    except OSError:
        pass

    store.touch(nb_id)
    duration = _probe_duration(mp3_path)
    words = sum(len(s["text"].split()) for s in segs)
    est_min = round(words / 150.0, 1) if words else None
    return {
        "ok": True,
        "notebook": nb_id,
        "title": meta.get("title"),
        "episode": ep_title,
        "audio": str(mp3_path),
        "transcript": str(txt_path),
        "script": str(script_path),
        "segments": len(segs),
        "words": words,
        "duration_seconds": duration,
        "estimated_minutes": est_min,
        "voices": {"host_a": voice_a, "host_b": voice_b},
        "length": length,
        "media": [str(mp3_path)],
    }
