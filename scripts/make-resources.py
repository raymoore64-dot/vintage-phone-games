#!/usr/bin/env python3
"""
Draws the original app icon and splash for Vintage Phone Games with PIL
(no external assets). Output (for `npx @capacitor/assets generate --ios`):

  resources/icon.png          1024x1024, opaque (App Store rejects alpha)
  resources/splash.png        2732x2732
  resources/splash-dark.png   2732x2732

The art: a chunky retro candy-bar phone, green LCD with a pixel snake
chasing a dot, a little keypad, on a dark radial background.
Re-run any time:  python3 scripts/make-resources.py
"""
import re
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "resources"
OUT.mkdir(exist_ok=True)

LCD = (0, 255, 136)
LCD_DARK = (6, 26, 16)
LCD_MID = (0, 120, 66)
BODY_TOP = (66, 74, 90)
BODY_BOT = (21, 24, 30)
KEY = (78, 86, 102)


def font():
    """Reuse the game's own 5x7 pixel font (src/share/pixelFont.js)."""
    src = (ROOT / "src/share/pixelFont.js").read_text()
    glyphs = {}
    for m in re.finditer(r"^\s*'?([A-Z0-9])'?: \[([^\]]+)\]", src, re.M):
        rows = re.findall(r"'([.#]{5})'", m.group(2))
        if len(rows) == 7:
            glyphs[m.group(1)] = rows
    return glyphs


GLYPHS = font()


def pixel_text(d, text, cx, y, cell, color):
    w = len(text) * 6 * cell - cell
    x0 = cx - w // 2
    for i, ch in enumerate(text):
        rows = GLYPHS.get(ch)
        if not rows:
            continue
        for r, row in enumerate(rows):
            for c, px in enumerate(row):
                if px == "#":
                    x = x0 + (i * 6 + c) * cell
                    d.rectangle([x, y + r * cell, x + cell - 1, y + (r + 1) * cell - 1], fill=color)


def radial_bg(size, inner=(46, 52, 48), outer=(6, 8, 8)):
    w, h = size
    small = Image.new("RGB", (256, 256))
    px = small.load()
    for y in range(256):
        for x in range(256):
            dx, dy = (x - 128) / 128, (y - 110) / 128
            t = min(1.0, (dx * dx + dy * dy) ** 0.5)
            px[x, y] = tuple(int(inner[k] * (1 - t) + outer[k] * t) for k in range(3))
    return small.resize((w, h), Image.BICUBIC)


def vgrad(w, h, top, bot):
    g = Image.new("RGB", (1, h))
    for y in range(h):
        t = y / max(1, h - 1)
        g.putpixel((0, y), tuple(int(top[k] * (1 - t) + bot[k] * t) for k in range(3)))
    return g.resize((w, h))


def phone(scale=1.0):
    """Phone art on a transparent canvas, 640x1000 at scale 1."""
    W, H = int(640 * scale), int(1000 * scale)
    s = lambda v: int(round(v * scale))
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    # soft green glow behind
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(glow).rounded_rectangle([s(40), s(40), W - s(40), H - s(40)], radius=s(120), fill=(0, 255, 136, 70))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(s(40))))
    # body
    mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(mask).rounded_rectangle([s(70), s(40), W - s(70), H - s(40)], radius=s(110), fill=255)
    body = vgrad(W, H, BODY_TOP, BODY_BOT).convert("RGBA")
    img.paste(body, (0, 0), mask)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([s(70), s(40), W - s(70), H - s(40)], radius=s(110), outline=(110, 120, 138), width=s(6))
    # speaker
    for i in range(7):
        x = s(250 + i * 22)
        d.rounded_rectangle([x, s(92), x + s(12), s(104)], radius=s(6), fill=(12, 13, 16))
    # screen bezel + LCD
    d.rounded_rectangle([s(130), s(140), W - s(130), s(560)], radius=s(30), fill=(10, 11, 13))
    lx0, ly0, lx1, ly1 = s(160), s(170), W - s(160), s(530)
    d.rectangle([lx0, ly0, lx1, ly1], fill=LCD_DARK)
    # LCD pixel grid: 16 x 12 cells
    cols, rows = 16, 12
    cw = (lx1 - lx0) / cols
    ch = (ly1 - ly0) / rows

    def cell(cx, cy, color, inset=0.12):
        x = lx0 + cx * cw
        y = ly0 + cy * ch
        d.rectangle([int(x + cw * inset), int(y + ch * inset), int(x + cw * (1 - inset)), int(y + ch * (1 - inset))], fill=color)

    for cy in range(rows):
        for cx in range(cols):
            cell(cx, cy, (10, 40, 24), 0.2)
    snake = [(3, 8), (4, 8), (5, 8), (6, 8), (7, 8), (7, 7), (7, 6), (8, 6), (9, 6), (10, 6), (11, 6), (11, 5), (11, 4)]
    for i, (cx, cy) in enumerate(snake):
        cell(cx, cy, LCD if i > 1 else LCD_MID)
    hx, hy = snake[-1]
    # head eye
    ex = lx0 + hx * cw + cw * 0.55
    ey = ly0 + hy * ch + ch * 0.25
    d.rectangle([int(ex), int(ey), int(ex + cw * 0.18), int(ey + ch * 0.18)], fill=LCD_DARK)
    cell(11, 2, (255, 214, 90), 0.22)       # the dot it is chasing
    # top status line on the LCD
    for cx in range(0, 4):
        cell(cx, 0, LCD_MID, 0.35 - cx * 0.04)
    cell(14, 0, LCD_MID, 0.3); cell(15, 0, LCD_MID, 0.3)
    # scanlines
    for y in range(ly0, ly1, max(2, s(6))):
        d.line([lx0, y, lx1, y], fill=(0, 0, 0, 60), width=max(1, s(1.5)))
    # soft keys + d-pad
    d.rounded_rectangle([s(150), s(600), s(250), s(640)], radius=s(18), fill=KEY)
    d.rounded_rectangle([W - s(250), s(600), W - s(150), s(640)], radius=s(18), fill=KEY)
    d.ellipse([s(255), s(585), W - s(255), s(715)], fill=(56, 63, 76), outline=(30, 34, 42), width=s(4))
    d.ellipse([s(295), s(620), W - s(295), s(680)], fill=(96, 105, 122))
    d.rounded_rectangle([s(150), s(665), s(250), s(705)], radius=s(18), fill=(52, 128, 76))
    d.rounded_rectangle([W - s(250), s(665), W - s(150), s(705)], radius=s(18), fill=(150, 60, 56))
    # keypad 3 x 3
    for r in range(3):
        for c in range(3):
            x = s(170 + c * 105)
            y = s(745 + r * 62)
            d.rounded_rectangle([x, y, x + s(90), y + s(44)], radius=s(16), fill=KEY)
            d.rounded_rectangle([x + s(4), y + s(36), x + s(86), y + s(44)], radius=s(8), fill=(40, 45, 54))
    return img


def make_icon():
    size = 1024
    bg = radial_bg((size, size), inner=(40, 70, 56), outer=(8, 14, 12)).convert("RGBA")
    ph = phone(0.95)
    bg.alpha_composite(ph, ((size - ph.width) // 2, (size - ph.height) // 2 + 10))
    bg.convert("RGB").save(OUT / "icon.png", optimize=True)


def make_splash(name, inner, outer, title):
    size = 2732
    bg = radial_bg((size, size), inner=inner, outer=outer).convert("RGBA")
    ph = phone(1.1)
    bg.alpha_composite(ph, ((size - ph.width) // 2, 760))
    d = ImageDraw.Draw(bg)
    pixel_text(d, "VINTAGE PHONE GAMES", size // 2, 560, 14, title)
    pixel_text(d, "BY STUDIO LINICRO", size // 2, 1960, 8, (170, 176, 186))
    bg.convert("RGB").save(OUT / name, optimize=True)


if __name__ == "__main__":
    make_icon()
    make_splash("splash.png", (40, 46, 44), (8, 10, 10), LCD)
    make_splash("splash-dark.png", (22, 26, 26), (0, 0, 0), LCD)
    for f in ["icon.png", "splash.png", "splash-dark.png"]:
        im = Image.open(OUT / f)
        print(f, im.size, im.mode)
