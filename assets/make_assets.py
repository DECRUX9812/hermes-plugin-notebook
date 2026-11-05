#!/usr/bin/env python3
"""Generate the catalog landing assets: banner.png (1200x600) + screenshots.

Screenshots are rendered from REAL plugin outputs (generated mp4 frames,
podcast waveform, live ask JSON, on-disk source labels and artifact files) —
nothing mocked. Run from the plugin repo root:

    python3 assets/make_assets.py [--nb-dir PATH] [--ask-json PATH]

Paths default to the smoke-test notebook under $HERMES_HOME/plugin-data.
Requires Pillow; ffmpeg for waveform/frame extraction.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets"
SCRATCH = Path(os.environ.get("HERMES_ASSETS_SCRATCH",
                              Path.home() / ".cache" / "devin" / "scratch" / "nb-assets"))

W, H = 1200, 630          # banner-ish 2:1-ish canvas for shots
BW, BH = 1200, 600         # catalog banner

INDIGO = ((26, 24, 54), (12, 11, 30), (139, 108, 255))
EMBER = ((52, 28, 18), (24, 12, 8), (255, 148, 92))
FOREST = ((16, 42, 30), (8, 20, 14), (86, 204, 152))
MONO = ((34, 34, 40), (14, 14, 18), (214, 214, 228))
TEXT = (244, 244, 250)
DIM = (168, 168, 196)
PANEL = (22, 22, 34)

FONT_DIRS = [
    "/usr/share/fonts/truetype/dejavu",
    "/usr/share/fonts/truetype/liberation",
    "/Library/Fonts",
    "C:/Windows/Fonts",
]
_font_cache = {}


def font(name: str, size: int):
    key = (name, size)
    if key in _font_cache:
        return _font_cache[key]
    f = None
    for d in FONT_DIRS:
        for cand in (f"{name}.ttf", f"{name}-Bold.ttf", f"{name}bd.ttf"):
            p = Path(d) / cand
            if p.exists():
                try:
                    f = ImageFont.truetype(str(p), size)
                    break
                except Exception:
                    pass
        if f:
            break
    if f is None:
        f = ImageFont.load_default(size=size)
    _font_cache[key] = f
    return f


def wrap(text: str, f, max_w: int, draw: ImageDraw.ImageDraw) -> list[str]:
    words, lines, cur = (text or "").split(), [], ""
    for w in words:
        t = f"{cur} {w}".strip()
        if draw.textlength(t, font=f) <= max_w or not cur:
            cur = t
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines or [""]


def gradient(size, colors):
    top, bottom, _ = colors
    img = Image.new("RGB", size)
    px = img.load()
    for y in range(size[1]):
        t = y / max(1, size[1] - 1)
        row = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
        for x in range(size[0]):
            px[x, y] = row
    return img


def card_bg(colors=INDIGO, size=(W, H)) -> Image.Image:
    img = gradient(size, colors)
    # faint diagonal sheen
    ov = Image.new("RGBA", size, (255, 255, 255, 0))
    d = ImageDraw.Draw(ov)
    d.polygon([(0, size[1]), (size[0] * 0.45, 0), (size[0] * 0.75, 0), (size[0] * 0.3, size[1])],
              fill=(255, 255, 255, 8))
    return Image.alpha_composite(img.convert("RGBA"), ov).convert("RGB")


def rrect(d: ImageDraw.ImageDraw, box, radius, fill, outline=None, width=1):
    d.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def chip(d: ImageDraw.ImageDraw, x, y, text, f, fg=TEXT, bg=(255, 255, 255, 18), accent=None):
    tw = d.textlength(text, font=f)
    pad = 14
    w_box, h_box = tw + pad * 2, f.size + 18
    rrect(d, [x, y, x + w_box, y + h_box], h_box / 2, bg, outline=accent, width=2 if accent else 1)
    d.text((x + pad, y + 9), text, font=f, fill=fg)
    return w_box


def header(d: ImageDraw.ImageDraw, title: str, tag: str, colors=INDIGO):
    _, _, acc = colors
    d.text((48, 40), tag.upper(), font=font("DejaVuSans", 22), fill=acc)
    d.text((48, 76), title, font=font("DejaVuSans", 52), fill=TEXT)
    d.rectangle([48, 152, 132, 158], fill=acc)


def save(img: Image.Image, name: str):
    p = OUT / name
    img.save(p, "PNG")
    print(f"  wrote {p.relative_to(ROOT)}")


# ------------------------------------------------------------------ banner

def banner():
    img = card_bg(INDIGO, (BW, BH))
    d = ImageDraw.Draw(img)
    _, _, acc = INDIGO

    # wordmark
    d.text((72, 120), "HERMES", font=font("DejaVuSans", 30), fill=DIM)
    d.text((72, 160), "Notebook", font=font("DejaVuSans", 76), fill=TEXT)
    d.rectangle([70, 268, 320, 274], fill=acc)
    d.text((72, 292), "NotebookLM-style grounded research notebooks,",
           font=font("DejaVuSans", 30), fill=DIM)
    d.text((72, 336), "native to Hermes.", font=font("DejaVuSans", 30), fill=DIM)

    # feature chips
    y = 430
    for label, col in [("9 tools", acc), ("grounded Q&A + citations", acc),
                       ("auto-labeled sources", (86, 204, 152)),
                       ("mind maps · quizzes · flashcards", (255, 148, 92)),
                       ("two-host podcast + video overview", acc)]:
        chip(d, 72, y, label, font("DejaVuSans", 24), accent=col)
        y += 58

    # mock notebook card (right side)
    mx, my, mw, mh = 700, 110, 430, 380
    rrect(d, [mx, my, mx + mw, my + mh], 18, (16, 16, 28), outline=(255, 255, 255, 40), width=2)
    d.text((mx + 26, my + 22), "◈  smoke-test-notebook", font=font("DejaVuSans", 26), fill=TEXT)
    d.text((mx + 26, my + 62), "2 sources · 8 artifacts", font=font("DejaVuSans", 20), fill=DIM)
    sy = my + 110
    for title, tags, summ in [
        ("Cell Bio 101", "cell · bio", "Organelles, membranes, energy."),
        ("French Revolution", "1789 · bastille · politics",
         "Financial crisis → storming of the Bastille."),
    ]:
        rrect(d, [mx + 22, sy, mx + mw - 22, sy + 92], 10, (24, 24, 40))
        d.text((mx + 38, sy + 14), title, font=font("DejaVuSans", 24), fill=TEXT)
        d.text((mx + 38, sy + 46), tags, font=font("DejaVuSans", 18), fill=acc)
        d.text((mx + 38, sy + 68), summ, font=font("DejaVuSans", 18), fill=DIM)
        sy += 106
    # citation line
    d.text((mx + 26, my + mh - 52),
           "Answer cites [S1] · [S2] — grounded, never guessed.",
           font=font("DejaVuSans", 19), fill=DIM)
    save(img, "banner.png")


# -------------------------------------------------------------- screenshots

def shot_ask(ask_json: Path):
    data = json.loads(ask_json.read_text())
    ans = data.get("answer") or data.get("result", {}).get("answer", "")
    sources = data.get("sources_used") or data.get("result", {}).get("sources_used", [])
    img = card_bg(FOREST)
    d = ImageDraw.Draw(img)
    header(d, "Grounded Q&A with citations", "notebook_ask", FOREST)
    f_q = font("DejaVuSans", 30)
    f_a = font("DejaVuSans", 26)
    q = data.get("question") or ""
    if q:
        d.text((48, 190), f"Q: {q[:110]}", font=f_q, fill=TEXT)
    y = 250
    for ln in wrap(ans, f_a, W - 96, d)[:14]:
        d.text((48, y), ln, font=f_a, fill=(226, 240, 232))
        y += 38
    # citation chips
    cy = H - 150
    d.text((48, cy - 34), "sources used:", font=font("DejaVuSans", 20), fill=DIM)
    x = 48
    for s in sources[:6]:
        title = s.get("title", s) if isinstance(s, dict) else str(s)
        x += chip(d, x, cy, f"[{s.get('id','?') if isinstance(s,dict) else 'S'}] {title[:34]}",
                  font("DejaVuSans", 20), accent=(86, 204, 152)) + 12
    save(img, "shot-04-ask.png")


def shot_sources(index_json: Path):
    sources = json.loads(index_json.read_text())
    img = card_bg(MONO)
    d = ImageDraw.Draw(img)
    header(d, "Every source auto-labeled & summarized", "notebook_add_source", MONO)
    f_t = font("DejaVuSans", 30)
    f_m = font("DejaVuSans", 22)
    y = 200
    for i, s in enumerate(sources[:5], 1):
        rrect(d, [48, y, W - 48, y + 120], 12, (30, 30, 42), outline=(255, 255, 255, 30))
        d.text((72, y + 16), f"{i}.  {s.get('title','?')}", font=f_t, fill=TEXT)
        tags = " · ".join(s.get("labels") or []) or s.get("kind", "")
        d.text((72, y + 58), tags, font=f_m, fill=(214, 214, 228))
        summ = s.get("summary") or ""
        if summ:
            for j, ln in enumerate(wrap(summ, f_m, W - 220, d)[:1]):
                d.text((72, y + 86), ln, font=f_m, fill=DIM)
        y += 136
    save(img, "shot-05-sources.png")


def shot_waveform(mp3: Path):
    SCRATCH.mkdir(parents=True, exist_ok=True)
    wave = SCRATCH / "waveform.png"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(mp3),
                    "-filter_complex", "showwavespic=s=1200x360:colors=8ecbff|8a6cff",
                    "-frames:v", "1", str(wave)], check=True)
    img = card_bg(INDIGO)
    d = ImageDraw.Draw(img)
    header(d, "Audio overview — two-host podcast", "notebook_audio", INDIGO)
    w = Image.open(wave).convert("RGB")
    img.paste(w, (48, 230))
    d.text((48, H - 90), "edge-tts neural voices · ffmpeg assembly · transcript included",
           font=font("DejaVuSans", 22), fill=DIM)
    save(img, "shot-03-audio.png")


def shot_artifacts(art_dir: Path):
    files = sorted(p.name for p in art_dir.iterdir() if not p.name.startswith("_"))
    kinds = {}
    for f in files:
        kind = f.split("-", 1)[-1].rsplit(".", 1)[0]
        kinds.setdefault(kind, []).append(f)
    img = card_bg(EMBER)
    d = ImageDraw.Draw(img)
    header(d, "Generated artifacts, on disk", "notebook_generate", EMBER)
    y = 210
    f_k = font("DejaVuSans", 30)
    f_f = font("DejaVuSans", 20)
    for kind, fs in list(kinds.items())[:5]:
        d.text((48, y), f"{kind}  ×{len(fs)}", font=f_k, fill=TEXT)
        y += 44
        shown = fs[:3]
        line = ", ".join(s.split("-", 1)[-1].rsplit(".", 1)[0] + "." + s.rsplit(".", 1)[-1] for s in shown)
        for ln in wrap(line, f_f, W - 96, d)[:2]:
            d.text((72, y), ln, font=f_f, fill=DIM)
            y += 30
        y += 22
    save(img, "shot-06-artifacts.png")


def shot_video_frame(mp4: Path, t: float, name: str):
    SCRATCH.mkdir(parents=True, exist_ok=True)
    png = SCRATCH / f"frame_{name}.png"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", str(t),
                    "-i", str(mp4), "-frames:v", "1", str(png)], check=True)
    # add a slim caption bar so it reads as a product shot in the gallery
    frame = Image.open(png).convert("RGB")
    canvas = Image.new("RGB", (frame.width, frame.height + 56), (10, 10, 16))
    canvas.paste(frame, (0, 0))
    d = ImageDraw.Draw(canvas)
    d.text((24, frame.height + 14), "notebook_video → cinematic mp4 overview",
           font=font("DejaVuSans", 26), fill=DIM)
    save(canvas, name)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--nb-dir", default=str(
        Path.home() / ".hermes/plugin-data/hermes-notebook/notebooks/smoke-test-notebook"))
    ap.add_argument("--ask-json", default=str(SCRATCH / "ask.json"))
    args = ap.parse_args()
    nb = Path(args.nb_dir)
    OUT.mkdir(exist_ok=True)

    banner()
    idx = nb / "sources" / "index.json"
    if idx.exists():
        shot_sources(idx)
    arts = nb / "artifacts"
    mp3s = sorted(arts.glob("*-audio_overview.mp3"))
    if mp3s:
        shot_waveform(mp3s[-1])
    if Path(args.ask_json).exists():
        shot_ask(Path(args.ask_json))
    if arts.exists():
        shot_artifacts(arts)
    mp4s = sorted(arts.glob("*-video_overview.mp4"))
    if mp4s:
        probe = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
                                "format=duration", "-of", "csv=p=0", str(mp4s[-1])],
                               capture_output=True, text=True)
        dur = float(probe.stdout.strip() or 60)
        shot_video_frame(mp4s[-1], min(2.0, dur * 0.1), "shot-01-video-title.png")
        shot_video_frame(mp4s[-1], dur * 0.45, "shot-02-video-beat.png")
    print("done →", OUT)


if __name__ == "__main__":
    sys.exit(main())
