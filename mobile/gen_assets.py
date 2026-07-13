#!/usr/bin/env python3
"""Generate Monk.ai app icons and splash screen."""
from PIL import Image, ImageDraw, ImageFilter, ImageFont
import math, os

OUT   = os.path.dirname(os.path.abspath(__file__))
GREEN = (184, 240, 88)
BG    = (10, 10, 10)


def make_bg(w, h, glow_r_factor=0.38, blur_factor=0.22, glow_strength=0.7, cy_offset=0):
    base = Image.new('RGB', (w, h), BG)
    glow = Image.new('RGB', (w, h), BG)
    gd   = ImageDraw.Draw(glow)
    r    = int(min(w, h) * glow_r_factor)
    gcx, gcy = w // 2, h // 2 + cy_offset
    gd.ellipse([gcx - r, gcy - r, gcx + r, gcy + r], fill=(22, 34, 8))
    glow = glow.filter(ImageFilter.GaussianBlur(int(min(w, h) * blur_factor)))
    return Image.blend(base, glow, glow_strength)


def apply_m(bg, cx, cy, size, sw, color=GREEN):
    """
    Render a clean geometric M mark over `bg`.

    Strategy
    --------
    1. Draw four strokes (legs + diagonal arms) on a transparent RGBA layer.
    2. Add a miter-fill triangle that closes any pixel gap between the two arm
       endpoint edges directly above notch_y.
    3. Erase everything below notch_y in the inter-leg channel — arm polygons
       extend ~sw/2 past the notch tip (their perpendicular end-cuts protrude
       into negative space), which is what creates the "W" bump artifact.
    4. Clip any arm overflow above/below the M bounding box via alpha channel.
    5. Alpha-composite the M layer over the background.
    """
    w, h = bg.size
    hs   = size // 2
    left, right = cx - hs, cx + hs
    top,  bot   = cy - hs, cy + hs
    notch_y     = top + int(size * 0.53)

    rgba = color + (255,)

    # ── 1. Draw M strokes on transparent RGBA layer ──────────────────────────
    ml = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d  = ImageDraw.Draw(ml)

    def thick(x1, y1, x2, y2):
        dx, dy = x2 - x1, y2 - y1
        ln = math.hypot(dx, dy)
        if ln < 1:
            return
        px, py = -dy / ln * sw / 2, dx / ln * sw / 2
        d.polygon([(x1+px,y1+py),(x1-px,y1-py),(x2-px,y2-py),(x2+px,y2+py)], fill=rgba)

    d.rectangle([left,       top, left  + sw, bot], fill=rgba)
    d.rectangle([right - sw, top, right,      bot], fill=rgba)
    thick(left  + sw, top, cx, notch_y)
    thick(right - sw, top, cx, notch_y)

    # ── 2. Miter-fill: close the gap between arm endpoint edges ──────────────
    # Both arm polygons taper to (cx, notch_y) on their centerlines, but their
    # perpendicular end-cuts leave a small dark triangle just above the notch.
    # Fill it with a matching downward triangle (base above notch, apex at notch).
    dx_a = cx - (left + sw)
    dy_a = notch_y - top
    ln_a = math.hypot(dx_a, dy_a)
    if ln_a > 0:
        apx = dy_a / ln_a * sw / 2   # horizontal half-width of gap at base
        apy = dx_a / ln_a * sw / 2   # vertical depth of gap
        d.polygon([
            (cx + apx, notch_y - apy),
            (cx - apx, notch_y - apy),
            (cx,       notch_y),
        ], fill=rgba)

    # ── 3. Erase arm protrusions below notch (inter-leg channel only) ─────────
    # The arm end-edge runs from ~(cx±apx, notch_y∓apy) — one corner is
    # notch_y + apy below the notch, creating green bumps in negative space.
    erase_bottom = int(notch_y + apy + sw * 0.1) if ln_a > 0 else int(notch_y + sw // 2)
    clear  = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    eraser = Image.new('L',    (w, h), 0)
    ImageDraw.Draw(eraser).rectangle(
        [int(left + sw), int(notch_y + 1), int(right - sw), erase_bottom],
        fill=255,
    )
    ml = Image.composite(clear, ml, eraser)

    # ── 4. Clip overflow above/below M bounding box via alpha ─────────────────
    alpha = ml.getchannel('A')
    ac    = ImageDraw.Draw(alpha)
    ac.rectangle([0, 0,     w, top - 1], fill=0)
    ac.rectangle([0, bot+1, w, h],       fill=0)
    ml.putalpha(alpha)

    # ── 5. Composite M over background ────────────────────────────────────────
    return Image.alpha_composite(bg.convert('RGBA'), ml).convert('RGB')


# ── Icon 1024×1024 ───────────────────────────────────────────────────────────

def make_icon():
    DS   = 4096
    bg   = make_bg(DS, DS)
    size = int(DS * 0.625)
    sw   = int(size * 0.138)
    img  = apply_m(bg, DS // 2, DS // 2, size, sw)
    img.resize((1024, 1024), Image.LANCZOS).save(f'{OUT}/icon.png')
    print('✓ icon.png  1024×1024')


# ── Adaptive icon (Android, smaller for safe zone) ────────────────────────────

def make_adaptive():
    DS   = 4096
    bg   = make_bg(DS, DS)
    size = int(DS * 0.50)
    sw   = int(size * 0.138)
    img  = apply_m(bg, DS // 2, DS // 2, size, sw)
    img.resize((1024, 1024), Image.LANCZOS).save(f'{OUT}/adaptive-icon.png')
    print('✓ adaptive-icon.png  1024×1024')


# ── Notification icon (Android, white on dark, 96px) ─────────────────────────

def make_notification_icon():
    DS   = 384
    bg   = Image.new('RGB', (DS, DS), BG)
    size = int(DS * 0.74)
    sw   = int(size * 0.138)
    img  = apply_m(bg, DS // 2, DS // 2, size, sw, color=(255, 255, 255))
    img.resize((96, 96), Image.LANCZOS).save(f'{OUT}/notification-icon.png')
    print('✓ notification-icon.png  96×96')


# ── Splash 1242×2688 ──────────────────────────────────────────────────────────

def make_splash():
    W, H      = 1242, 2688
    bg        = make_bg(W, H, glow_r_factor=0.34, blur_factor=0.22,
                        glow_strength=0.85, cy_offset=-80)
    mark_size = 520
    mark_sw   = int(mark_size * 0.138)
    mark_cy   = H // 2 - 100
    splash    = apply_m(bg, W // 2, mark_cy, mark_size, mark_sw)

    d = ImageDraw.Draw(splash)
    font_big = font_small = None
    for fp in ['/System/Library/Fonts/Supplemental/Arial Bold.ttf',
               '/Library/Fonts/Arial Bold.ttf',
               '/System/Library/Fonts/HelveticaNeue.ttc',
               '/System/Library/Fonts/Helvetica.ttc']:
        if os.path.exists(fp):
            try:
                font_big   = ImageFont.truetype(fp, 84)
                font_small = ImageFont.truetype(fp, 28)
                break
            except Exception:
                pass

    ty = mark_cy + mark_size // 2 + 52
    if font_big:
        lbl  = 'MONK.AI'
        bb   = d.textbbox((0, 0), lbl, font=font_big)
        d.text(((W - (bb[2]-bb[0])) // 2, ty), lbl, font=font_big, fill=GREEN)
        ty  += (bb[3] - bb[1]) + 18
    if font_small:
        tag  = 'YOUR AI ACCOUNTABILITY COACH'
        bb2  = d.textbbox((0, 0), tag, font=font_small)
        d.text(((W - (bb2[2]-bb2[0])) // 2, ty), tag, font=font_small, fill=(72, 72, 72))

    splash.save(f'{OUT}/splash.png')
    print('✓ splash.png  1242×2688')


if __name__ == '__main__':
    make_icon()
    make_adaptive()
    make_notification_icon()
    make_splash()
    print('\nDone.')
