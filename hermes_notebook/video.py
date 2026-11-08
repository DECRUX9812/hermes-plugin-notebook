"""Video Overview — NotebookLM's cinematic video: a narrated, slide-driven mp4
assembled from per-segment title cards + edge-tts narration + ffmpeg.

Pipeline: structured LLM call writes a single-narrator script where every
segment carries a slide headline and palette → PIL renders 1280x720 cards →
edge-tts narrates each segment → ffmpeg stitches cards (timed to audio) and
the mixed track into one mp4 + transcript.
"""

from __future__ import annotations

import asyncio
import json
import re
import shutil
import subprocess
from pathlib import Path
from typing import Any, Optional

from . import audio, llmio, retrieve, runtime, store, voices

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:  # pragma: no cover - dep declared in plugin.yaml
    Image = ImageDraw = ImageFont = None

VIDEO_LENGTHS = {
    "short": {"words": (220, 380), "label": "about 2 minutes"},
    "medium": {"words": (500, 800), "label": "about 4 minutes"},
    "long": {"words": (900, 1300), "label": "about 7 minutes"},
}

CARD_W, CARD_H = 1280, 720
PALETTES = ("indigo", "ember", "forest", "mono")

# (top color, bottom color, accent, text, dim) — NotebookLM-ish dark cards
_CARD_COLORS = {
    "indigo": ((26, 24, 54), (12, 11, 30), (139, 108, 255)),
    "ember":  ((52, 28, 18), (24, 12, 8),  (255, 148, 92)),
    "forest": ((16, 42, 30), (8, 20, 14),   (86, 204, 152)),
    "mono":   ((34, 34, 40), (14, 14, 18),  (214, 214, 228)),
}
_TEXT = (244, 244, 250)
_DIM = (168, 168, 196)

_VIDEO_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string", "description": "Catchy video title"},
        "segments": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "text": {"type": "string",
                             "description": "Narration for this beat (20-60 words, cinematic, second person ok)"},
                    "headline": {"type": "string",
                                 "description": "Slide headline, <= 8 words, punchy"},
                    "palette": {"type": "string", "enum": list(PALETTES),
                                "description": "Card color theme for this beat"},
                },
                "required": ["text", "headline"],
            },
        },
    },
    "required": ["title", "segments"],
}


STYLES = ("cinematic", "explainer")
_EXPLAINER_PALETTES = ("ember", "forest", "mono", "indigo")


def _video_script_prompt(meta: dict, digest: str, length: str, focus: str,
                         style: str = "cinematic", language: str = "") -> str:
    lo, hi = VIDEO_LENGTHS[length]["words"]
    focus_line = f"\nFocus requested by the user: {focus.strip()}\n" if focus.strip() else ""
    lang_line = (f"\nLANGUAGE: write the entire script in {language.strip()} — "
                 "natural, idiomatic, not translated-sounding.\n") if language.strip() else ""
    if style == "explainer":
        voice = (
            "QUICK EXPLAINER style — like a crisp 3-minute tech explainer: "
            "punchy, keyword-forward beats, one idea per segment, energetic "
            "but not breathless."
        )
    else:
        voice = (
            "CINEMATIC documentary style — a single narrator with a warm, "
            "contemplative tone walks the viewer through the material."
        )
    return (
        f"Write a VIDEO OVERVIEW script about the notebook sources below — "
        f"{voice}\n\n"
        f"TARGET LENGTH: {VIDEO_LENGTHS[length]['label']} — roughly {lo}-{hi} "
        f"words across ~15-35 segments. Each segment is one narrated beat of "
        "20-60 words with a matching slide headline (<= 8 words) and a palette "
        "choice (indigo/ember/forest/mono — vary them for visual rhythm).\n"
        "Structure: open with the big idea in one striking sentence; move "
        "through the material section by section; land on the 2-3 takeaways. "
        "Write for the EAR — it will be spoken, so use short sentences, "
        "concrete images, no bullet lists, no citations markers.\n"
        f"{lang_line}{focus_line}\n"
        f"NOTEBOOK: {meta.get('title')}\nDESCRIPTION: {meta.get('description', '')}\n\n"
        f"SOURCES:\n{digest}"
    )


def _write_video_script(parsed: dict) -> tuple[list[dict], str]:
    """Normalize model output → [{text, headline, palette}] single-narrator beats."""
    segs = []
    for raw in parsed.get("segments") or []:
        if not isinstance(raw, dict):
            continue
        text = re.sub(r"\s+", " ", str(raw.get("text") or "")).strip()
        headline = re.sub(r"\s+", " ", str(raw.get("headline") or "")).strip()[:80]
        if len(text) < 10:
            continue
        pal = str(raw.get("palette") or "indigo").strip().lower()
        segs.append({"text": text, "headline": headline or "…",
                     "palette": pal if pal in PALETTES else "indigo"})
    if not segs:
        raise RuntimeError("model returned an empty video script")
    return segs, str(parsed.get("title") or "Video Overview").strip()


# ------------------------------------------------------------------- cards

_FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/Library/Fonts/Arial.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
    "C:/Windows/Fonts/arial.ttf",
    "C:/Windows/Fonts/segoeui.ttf",
]
_BOLD_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/Library/Fonts/Arial Bold.ttf",
    "C:/Windows/Fonts/arialbd.ttf",
    "C:/Windows/Fonts/segoeuib.ttf",
]

_FONT_CACHE: dict = {}


def _font(path_candidates: list[str], size: int, bold: bool = False):
    key = (tuple(path_candidates), size, bold)
    if key in _FONT_CACHE:
        return _FONT_CACHE[key]
    font = None
    for p in path_candidates:
        try:
            font = ImageFont.truetype(p, size)
            break
        except Exception:
            continue
    if font is None:
        try:
            font = ImageFont.load_default(size=size)
        except Exception:
            font = ImageFont.load_default()
    _FONT_CACHE[key] = font
    return font


def _wrap(text: str, font, max_w: int, draw: ImageDraw.ImageDraw) -> list[str]:
    words = (text or "").split()
    if not words:
        return [""]
    lines, cur = [], ""
    for w in words:
        trial = f"{cur} {w}".strip()
        if draw.textlength(trial, font=font) <= max_w or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


_GRADIENT_CACHE: dict = {}


def _gradient(palette: str) -> Image.Image:
    if palette in _GRADIENT_CACHE:
        return _GRADIENT_CACHE[palette].copy()
    top, bottom, _accent = _CARD_COLORS.get(palette, _CARD_COLORS["indigo"])
    grad = Image.new("RGB", (CARD_W, CARD_H))
    px = grad.load()
    for y in range(CARD_H):
        t = y / max(1, CARD_H - 1)
        r = int(top[0] + (bottom[0] - top[0]) * t)
        g = int(top[1] + (bottom[1] - top[1]) * t)
        b = int(top[2] + (bottom[2] - top[2]) * t)
        for x in range(CARD_W):
            px[x, y] = (r, g, b)
    _GRADIENT_CACHE[palette] = grad
    return grad.copy()


def _accent(palette: str):
    return _CARD_COLORS.get(palette, _CARD_COLORS["indigo"])[2]


def _render_card(path: Path, *, kind: str, headline: str = "", sub: str = "",
                 palette: str = "indigo", notebook_title: str = "",
                 ep_title: str = "", index: int = 0, total: int = 0,
                 sources: Optional[list[str]] = None) -> None:
    """Draw one 1280x720 card PNG. kind: 'title' | 'beat' | 'end'."""
    if Image is None:
        raise RuntimeError("video cards need Pillow (declared plugin dependency)")
    img = _gradient(palette if kind != "title" else "indigo")
    draw = ImageDraw.Draw(img)
    acc = _accent(palette if kind != "title" else "indigo")

    if kind == "title":
        f_big = _font(_BOLD_CANDIDATES, 72)
        f_sub = _font(_FONT_CANDIDATES, 34)
        f_tag = _font(_BOLD_CANDIDATES, 26)
        f_head = _font(_BOLD_CANDIDATES, 40)
        tag = "VIDEO OVERVIEW"
        tw = draw.textlength(tag, font=f_tag)
        draw.text(((CARD_W - tw) / 2, 190), tag, font=f_tag, fill=acc)
        lines = _wrap(ep_title or notebook_title or "Notebook", f_big, CARD_W - 160, draw)[:3]
        y = 240
        for ln in lines:
            lw = draw.textlength(ln, font=f_big)
            draw.text(((CARD_W - lw) / 2, y), ln, font=f_big, fill=_TEXT)
            y += 84
        # the opening beat's headline rides the title card as a subtitle
        if headline:
            hl = _wrap(headline, f_head, CARD_W - 200, draw)[:2]
            hy = y + 10
            for ln in hl:
                lw = draw.textlength(ln, font=f_head)
                draw.text(((CARD_W - lw) / 2, hy), ln, font=f_head, fill=acc)
                hy += 50
            y = hy
        if notebook_title:
            nw = draw.textlength(notebook_title, font=f_sub)
            draw.text(((CARD_W - nw) / 2, y + 14), notebook_title, font=f_sub, fill=_DIM)
        draw.rectangle([CARD_W / 2 - 90, CARD_H - 150, CARD_W / 2 + 90, CARD_H - 146], fill=acc)
    elif kind == "end":
        f_big = _font(_BOLD_CANDIDATES, 56)
        f_item = _font(_FONT_CANDIDATES, 30)
        draw.text((90, 80), "Sources", font=f_big, fill=_TEXT)
        draw.rectangle([90, 160, 190, 166], fill=acc)
        y = 200
        for s in (sources or [])[:9]:
            draw.text((90, y), f"•  {s[:64]}", font=f_item, fill=_DIM)
            y += 46
        fw = _font(_FONT_CANDIDATES, 24)
        foot = "Generated by Hermes Notebook"
        fw_w = draw.textlength(foot, font=fw)
        draw.text((CARD_W - fw_w - 60, CARD_H - 60), foot, font=fw, fill=_DIM)
    else:  # beat
        f_head = _font(_BOLD_CANDIDATES, 58)
        f_sub = _font(_FONT_CANDIDATES, 30)
        f_foot = _font(_FONT_CANDIDATES, 24)
        draw.rectangle([0, 0, CARD_W, 10], fill=acc)
        draw.rectangle([0, CARD_H - 120, CARD_W, CARD_H], fill=(10, 10, 18))
        head_lines = _wrap(headline, f_head, CARD_W - 180, draw)[:3]
        y = 150
        for ln in head_lines:
            draw.text((90, y), ln, font=f_head, fill=_TEXT)
            y += 68
        sub_lines = _wrap(sub, f_sub, CARD_W - 180, draw)[:2]
        sy = y + 16
        for ln in sub_lines:
            draw.text((92, sy), ln, font=f_sub, fill=_DIM)
            sy += 40
        # footer: notebook title + progress
        draw.text((90, CARD_H - 84), (notebook_title or "")[:48], font=f_foot, fill=_DIM)
        prog = f"{index:02d} / {total:02d}"
        pw = draw.textlength(prog, font=f_foot)
        draw.text((CARD_W - pw - 90, CARD_H - 84), prog, font=f_foot, fill=_DIM)
        # progress hairline
        frac = (index / max(1, total))
        draw.rectangle([90, CARD_H - 34, 90 + (CARD_W - 180) * frac, CARD_H - 30], fill=acc)

    img.save(path, "PNG")


# ---------------------------------------------------------------- assembly

def _probe(path: Path) -> float:
    d = audio._probe_duration(path)
    return d if d and d > 0 else 3.0


def _real_duration(path: Path) -> float:
    """Decoded (ground-truth) duration in seconds.

    edge-tts mp3s carry unreliable container duration metadata — ffprobe's
    format=duration under-reports by ~2x on these files, which silently
    desynced card length vs narration. Decoding is the only trustworthy
    measure; segments are seconds long so this stays cheap."""
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        return _probe(path)
    try:
        r = subprocess.run(
            [ffmpeg, "-nostats", "-progress", "pipe:1", "-i", str(path),
             "-map", "0:a:0", "-f", "null", "-"],
            capture_output=True, text=True, timeout=180)
        marks = re.findall(r"out_time_us=(\d+)", r.stdout)
        if marks:
            return int(marks[-1]) / 1_000_000
    except Exception:
        pass
    return _probe(path)


def _plan_cards(work: Path, segs: list[dict], nb_title: str, ep_title: str,
                src_titles: list[str]) -> list[tuple[Path, int, str]]:
    """Render every card PNG; returns [(png, seg_index, kind)] aligned 1:1
    with narration — entry i's card covers segment i's audio (title card
    covers segment 0), plus a trailing 'end' card with kind='end'."""
    total = len(segs)
    entries: list[tuple[Path, int, str]] = []
    # segment 0 rides the title card (its headline becomes the card subtitle)
    p = work / "card_000.png"
    _render_card(p, kind="title", headline=segs[0]["headline"], ep_title=ep_title,
                 notebook_title=nb_title, palette="indigo")
    entries.append((p, 0, "title"))
    for i, seg in enumerate(segs[1:], start=1):
        p = work / f"card_{i:03d}.png"
        sub = seg["text"][:110].rsplit(" ", 1)[0] + "…" if len(seg["text"]) > 110 else seg["text"]
        _render_card(p, kind="beat", headline=seg["headline"], sub=sub,
                     palette=seg["palette"], notebook_title=nb_title,
                     index=i + 1, total=total)
        entries.append((p, i, "beat"))
    p = work / "card_end.png"
    _render_card(p, kind="end", sources=src_titles)
    entries.append((p, -1, "end"))
    return entries


_ZOOM_VF = ("scale=1280:720,"
            "zoompan=z='min(zoom+0.0006,1.12)':d=1:x='iw/2-(iw/zoom/2)':"
            "y='ih/2-(ih/zoom/2)':s=1280x720:fps=25,format=yuv420p")
_PLAIN_VF = "fps=25,format=yuv420p"


def _encode_clip(card: Path, audio_path: Optional[Path], dur: float,
                 out: Path) -> None:
    """One card + its narration segment → CFR mp4 clip (zoompan, plain fallback).

    The card loops indefinitely and the OUTPUT is capped at the segment's
    real decoded duration — sync is guaranteed by construction, no reliance
    on -shortest (unreliable with -loop image inputs)."""
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("ffmpeg not found — needed to assemble the video overview")
    ins = [ffmpeg, "-y", "-loglevel", "error",
           "-loop", "1", "-framerate", "25", "-i", str(card)]
    if audio_path is not None:
        ins += ["-i", str(audio_path)]
    else:
        ins += ["-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo"]
    last_err = ""
    for vf in (_ZOOM_VF, _PLAIN_VF):
        cmd = ins + ["-vf", vf, "-c:v", "libx264", "-preset", "veryfast",
                     "-crf", "21", "-r", "25", "-c:a", "aac", "-b:a", "128k",
                     "-ac", "2", "-ar", "44100",
                     "-t", f"{dur:.3f}", "-movflags", "+faststart", str(out)]
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
        if r.returncode == 0 and out.exists() and out.stat().st_size > 5000:
            return
        last_err = (r.stderr or "")[-400:]
    raise RuntimeError(f"ffmpeg clip encode failed: {last_err}")


def _assemble_video(clips: list[Path], out_path: Path) -> None:
    ffmpeg = shutil.which("ffmpeg")
    lst = clips[0].parent / "_clips.txt"
    lst.write_text("".join(f"file '{c.resolve()}'\n" for c in clips), encoding="utf-8")
    cmd = [ffmpeg, "-y", "-loglevel", "error", "-f", "concat", "-safe", "0",
           "-i", str(lst), "-c:v", "copy", "-c:a", "aac", "-b:a", "128k",
           "-ac", "2", "-ar", "44100", "-movflags", "+faststart", str(out_path)]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    if r.returncode != 0 or not out_path.exists() or out_path.stat().st_size < 10000:
        raise RuntimeError(f"ffmpeg video assembly failed: {(r.stderr or '')[-400:]}")


async def _video_script(nb_id: str, meta: dict, digest: str, length: str,
                        focus: str, style: str, language: str = "") -> tuple[list[dict], str]:
    """The LLM script stage only: parsed JSON → normalized beats + title."""
    parsed = llmio.structured(
        instructions="Write the full cinematic video-overview script as JSON.",
        input=[{"type": "text", "text": _video_script_prompt(meta, digest, length, focus, style, language)}],
        json_schema=_VIDEO_SCHEMA,
        schema_name="notebook.video_script",
        system_prompt=(
            "You are a documentary scriptwriter. Output only the JSON script — "
            "no markdown fences, no commentary."
        ),
        purpose="hermes-notebook.video_overview",
        max_tokens=12000,
        temperature=0.7,
        timeout=600.0,
    )
    if parsed is None:
        raise RuntimeError("model did not return a valid video script JSON")
    segs, ep_title = _write_video_script(parsed)
    if style == "explainer":
        # brighter, faster-cutting palette rhythm for the explainer style
        for i, seg in enumerate(segs):
            seg["palette"] = _EXPLAINER_PALETTES[i % len(_EXPLAINER_PALETTES)]
    return segs, ep_title


async def video_notes(notebook: str, *, length: Optional[str] = None,
                      focus: str = "", style: Optional[str] = None,
                      language: str = "") -> dict:
    """Producer notes only — the title + per-beat headline/narration/palette the
    render WOULD use, before any frame or audio exists. The page shows these for
    review; generate() accepts them back and skips the rewrite."""
    nb_id = store.resolve_notebook(notebook)
    meta = store.get_meta(nb_id)
    if not store.list_sources(nb_id):
        raise ValueError(f"notebook {nb_id!r} has no sources — add some first")
    length = (length or str(runtime.config("video_length", default="medium")) or "medium").lower()
    if length not in VIDEO_LENGTHS:
        length = "medium"
    style = (style or str(runtime.config("video_style", default="cinematic")) or "cinematic").lower()
    if style not in STYLES:
        style = "cinematic"
    digest = retrieve.notebook_digest(nb_id, max_chars=int(runtime.config("podcast_context_chars", default=42000)))
    segs, ep_title = await _video_script(nb_id, meta, digest, length, focus, style, language)
    return {"title": ep_title, "length": length, "style": style, "language": language,
            "beats": [{"headline": s.get("headline", ""), "text": s.get("text", ""),
                       "palette": s.get("palette", "")} for s in segs]}


async def make_video_overview(notebook: str, *, length: Optional[str] = None,
                              focus: str = "", style: Optional[str] = None,
                              notes: Optional[dict] = None,
                              language: str = "") -> dict:
    """Generate the cinematic video overview. Async — runs under an event loop.
    notes: approved producer notes from video_notes() — skips the script rewrite."""
    if Image is None:
        raise RuntimeError(
            "video overviews need Pillow (a declared plugin dependency). "
            "Reinstall/re-enable the plugin so PM can fetch it."
        )
    nb_id = store.resolve_notebook(notebook)
    meta = store.get_meta(nb_id)
    sources = store.list_sources(nb_id)
    if not sources:
        raise ValueError(f"notebook {nb_id!r} has no sources — add some first")

    length = (length or str(runtime.config("video_length", default="medium")) or "medium").lower()
    if length not in VIDEO_LENGTHS:
        length = "medium"
    style = (style or str(runtime.config("video_style", default="cinematic")) or "cinematic").lower()
    if style not in STYLES:
        style = "cinematic"

    try:
        import edge_tts  # noqa: F401
    except ImportError as exc:
        raise RuntimeError(
            "video overviews need the edge-tts package (a declared plugin "
            "dependency). Reinstall/re-enable the plugin so PM can fetch it."
        ) from exc

    digest = retrieve.notebook_digest(nb_id, max_chars=int(runtime.config("podcast_context_chars", default=42000)))
    if notes and isinstance(notes.get("beats"), list) and notes["beats"]:
        # reviewed producer notes come back verbatim — no second model pass
        segs = [{"text": str(b.get("text") or "").strip(),
                 "headline": str(b.get("headline") or "").strip()[:80],
                 "palette": str(b.get("palette") or "")}
                for b in notes["beats"] if isinstance(b, dict)]
        segs = [s for s in segs if len(s["text"]) >= 3]
        if not segs:
            raise ValueError("the reviewed notes had no usable narration beats")
        ep_title = str(notes.get("title") or meta.get("title") or "Video Overview").strip()
        if style == "explainer":
            for i, seg in enumerate(segs):
                seg["palette"] = _EXPLAINER_PALETTES[i % len(_EXPLAINER_PALETTES)]
    else:
        segs, ep_title = await _video_script(nb_id, meta, digest, length, focus, style, language)

    voice = str(runtime.config("video_voice", default="en-US-AndrewNeural"))
    # requested language picks a matching neural voice unless the operator
    # pinned video_voice in config (same rule as the podcast hosts)
    lang_voice = voices.single_for(language)
    if lang_voice and voice == "en-US-AndrewNeural":
        voice = lang_voice
    rate = str(runtime.config("video_voice_rate", default="-4%"))

    nb_dir = store._nb_dir(nb_id)
    stamp = runtime.utc_stamp()
    work = nb_dir / "artifacts" / f"_video_{stamp}"
    work.mkdir(parents=True, exist_ok=True)

    # narration: single voice, slightly slower cinematic pace. edge-tts
    # intermittently returns NoAudioReceived (throttle or a text it can't
    # voice) — retry with a ladder: same voice w/o rate → fallback voice.
    fallback_voice = str(runtime.config("audio_voice_host_b", default="en-US-EmmaNeural"))
    lang_pair = voices.pair_for(language)
    if lang_pair and fallback_voice == "en-US-EmmaNeural":
        fallback_voice = lang_pair[1]

    def _clean(text: str) -> str:
        # strip characters known to break edge-tts synthesis (emoji, controls,
        # SSML-significant brackets) while keeping normal punctuation
        text = re.sub(r"[\x00-\x1f\x7f<>\[\]{}|\\^`~]", " ", text)
        text = re.sub(r"[\U0001F000-\U0001FAFF☀-➿]", "", text)
        return re.sub(r"\s+", " ", text).strip()

    async def _narrate(text: str, out: Path):
        import edge_tts
        attempts = [
            {"voice": voice, "rate": rate},
            {"voice": voice},
            {"voice": fallback_voice},
        ]
        last: Optional[Exception] = None
        for kw in attempts:
            for a in range(2):
                try:
                    await edge_tts.Communicate(_clean(text), **kw).save(str(out))
                    return
                except Exception as exc:  # noqa: BLE001 - service is flaky
                    last = exc
                    await asyncio.sleep(1.5 * (a + 1))
        raise last or RuntimeError("TTS failed")

    sem = asyncio.Semaphore(int(runtime.config("audio_tts_concurrency", default=4)))

    async def _seg(i: int, seg: dict):
        out = work / f"seg_{i:03d}.mp3"
        async with sem:
            await _narrate(seg["text"], out)

    results = await asyncio.gather(*[_seg(i, s) for i, s in enumerate(segs)],
                                   return_exceptions=True)
    errors = [(i, r) for i, r in enumerate(results) if isinstance(r, BaseException)]
    if errors:
        detail = "; ".join(f"seg {i} ({segs[i]['headline'][:30]!r}): {str(r)[:90]}"
                           for i, r in errors[:3])
        raise RuntimeError(f"TTS failed for {len(errors)}/{len(segs)} segments — {detail}")

    parts = [work / f"seg_{i:03d}.mp3" for i in range(len(segs))]
    durs = [_real_duration(p) for p in parts]
    # stamp each segment's timeline position — the viewer seeks chapters by it
    t = 0.0
    for seg, d in zip(segs, durs):
        seg["start"] = round(t, 2)
        t += d
        seg["end"] = round(t, 2)

    src_titles = [s.get("title", "source") for s in sources][:12]
    cards = _plan_cards(work, segs, meta.get("title", ""), ep_title, src_titles)

    clips = []
    for j, (card, seg_i, kind) in enumerate(cards):
        clip = work / f"clip_{j:03d}.mp4"
        if kind == "end":
            _encode_clip(card, None, 4.0, clip)
        else:
            _encode_clip(card, parts[seg_i], durs[seg_i], clip)
        clips.append(clip)

    mp4_path = nb_dir / "artifacts" / f"{stamp}-video_overview.mp4"
    _assemble_video(clips, mp4_path)

    # transcript (reuse the podcast transcript shape, single narrator)
    txt_path = nb_dir / "artifacts" / f"{stamp}-video_overview.txt"
    tlines = [f"# {ep_title}", "",
              f"_Video overview of “{meta.get('title')}” — {len(segs)} segments, "
              f"voice: {voice} @ {rate}_", ""]
    for seg in segs:
        tlines += [f"**Narrator:** {seg['text']}", ""]
    txt_path.write_text("\n".join(tlines), encoding="utf-8")

    script_path = nb_dir / "artifacts" / f"{stamp}-video_overview.json"
    script_path.write_text(json.dumps(
        {"title": ep_title, "notebook": meta.get("title"), "length": length,
         "voice": voice, "rate": rate, "segments": segs},
        indent=2, ensure_ascii=False), encoding="utf-8")

    import shutil as _sh
    _sh.rmtree(work, ignore_errors=True)

    store.touch(nb_id)
    duration = _probe(mp4_path)
    words = sum(len(s["text"].split()) for s in segs)
    return {
        "ok": True,
        "notebook": nb_id,
        "title": meta.get("title"),
        "episode": ep_title,
        "video": str(mp4_path),
        "transcript": str(txt_path),
        "script": str(script_path),
        "segments": len(segs),
        "words": words,
        "duration_seconds": duration,
        "estimated_minutes": round(words / 140.0, 1) if words else None,
        "voice": voice,
        "length": length,
        "style": style,
        "media": [str(mp4_path)],
    }
