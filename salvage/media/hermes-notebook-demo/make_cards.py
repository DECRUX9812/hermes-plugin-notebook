#!/usr/bin/env python3
"""1920x1080 title + closing cards for the explainer."""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import math, os

OUT = os.path.join(os.path.dirname(__file__), "cards")
os.makedirs(OUT, exist_ok=True)
W, H = 1920, 1080
BG = (11, 12, 16)
INDIGO = (139, 108, 255)
MAGENTA = (187, 154, 247)
CYAN = (125, 207, 255)
GREEN = (158, 206, 106)
TEXT = (232, 236, 255)
DIM = (150, 156, 190)

FD = "/usr/share/fonts/truetype/dejavu"
def font(name, size):
    return ImageFont.truetype(os.path.join(FD, name), size)

def bg_gradient():
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    # soft radial glows (precomputed blends, cheap approximation)
    for cx, cy, col, rad in [(W*0.25, H*0.3, INDIGO, 700), (W*0.8, H*0.75, (60,50,140), 800), (W*0.6, H*0.15, (30,60,90), 600)]:
        glow = Image.new("RGB", (W, H), BG)
        gd = ImageDraw.Draw(glow)
        gd.ellipse([cx-rad, cy-rad, cx+rad, cy+rad], fill=col)
        glow = glow.filter(ImageFilter.GaussianBlur(120))
        img = Image.blend(img, glow, 0.16)
    # grid dots
    for y in range(80, H, 90):
        for x in range(80, W, 90):
            d.ellipse([x, y, x+2, y+2], fill=(30,32,48))
    return img

def wrap(text, f, maxw, d):
    words, lines, cur = text.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if d.textlength(t, font=f) <= maxw: cur = t
        else: lines.append(cur); cur = w
    if cur: lines.append(cur)
    return lines

def title():
    img = bg_gradient(); d = ImageDraw.Draw(img, "RGBA")
    # floating notebook card mock
    d.rounded_rectangle([W//2-330, 300, W//2+330, 560], 26, fill=(22,23,38,235), outline=(255,255,255,40), width=2)
    d.text((W//2-290, 340), "notebooks", font=font("DejaVuSans-Bold", 40), fill=TEXT)
    for i,(t,c) in enumerate([("French Revolution",GREEN),("Cell Bio 101",CYAN),("Stanford CS229 notes",MAGENTA)]):
        y = 420 + i*44
        d.rounded_rectangle([W//2-290, y, W//2+270, y+34], 17, fill=(255,255,255,14))
        d.ellipse([W//2-272, y+11, W//2-250, y+33], fill=c)
        d.text((W//2-236, y+6), t, font=font("DejaVuSans", 26), fill=(210,214,235))
    # hero text
    d.text((W//2, 640), "hermes", font=font("DejaVuSans-Bold", 120), fill=TEXT, anchor="mm")
    tw = d.textlength("hermes", font=font("DejaVuSans-Bold", 120))
    d.text((W//2 - tw/2 - 30, 640), "note", font=font("DejaVuSans-Bold", 120), fill=MAGENTA, anchor="lm")
    # simpler: draw "hermes notebook" with notebook in magenta
    d.text((W//2, 640), "hermes notebook", font=font("DejaVuSans-Bold", 110), fill=TEXT, anchor="mm")
    nw = d.textlength("hermes ", font=font("DejaVuSans-Bold", 110))
    d.text((W//2 - d.textlength("hermes notebook", font=font("DejaVuSans-Bold",110))/2 + nw, 640), "notebook", font=font("DejaVuSans-Bold", 110), fill=MAGENTA, anchor="lm")
    d.text((W//2, 740), "NotebookLM inside your agent — sources in, cited answers and media out.",
           font=font("DejaVuSans", 34), fill=DIM, anchor="mm")
    chips = ["16 tools","citations","auto-labels","mind maps","audio","video","search","export"]
    cw = 0
    for c in chips:
        f = font("DejaVuSans-Bold", 24)
        w = d.textlength(c, font=f) + 44
        cw += w + 16
    x = W//2 - cw/2 + 8
    for c in chips:
        f = font("DejaVuSans-Bold", 24)
        w = d.textlength(c, font=f) + 44
        d.rounded_rectangle([x, 810, x+w, 866], 28, fill=(122,162,247,26), outline=(122,162,247,70))
        d.text((x+w/2, 838), c, font=f, fill=(200,212,255), anchor="mm")
        x += w + 16
    img.save(f"{OUT}/title.png")

def closing():
    img = bg_gradient(); d = ImageDraw.Draw(img, "RGBA")
    d.text((W//2, 330), "One command away", font=font("DejaVuSans-Bold", 88), fill=TEXT, anchor="mm")
    cmd = "hermes plugins install DECRUX9812/hermes-plugin-notebook"
    f = font("DejaVuSans-Bold", 38)
    w = d.textlength(cmd, font=f) + 80
    d.rounded_rectangle([W//2-w/2, 430, W//2+w/2, 520], 24, fill=(16,42,30,240), outline=(158,206,106,120), width=2)
    d.text((W//2, 475), cmd, font=f, fill=GREEN, anchor="mm")
    d.text((W//2, 590), "github.com/DECRUX9812/hermes-plugin-notebook", font=font("DejaVuSans", 32), fill=DIM, anchor="mm")
    d.text((W//2, 660), "16 tools · grounded Q&A · artifacts · audio & video overviews · search · notes · export",
           font=font("DejaVuSans", 28), fill=(170,176,205), anchor="mm")
    img.save(f"{OUT}/closing.png")

title(); closing()
print("cards written")
