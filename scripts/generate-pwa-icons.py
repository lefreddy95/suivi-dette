"""Genere les icones PWA + favicon pour suivi-dette.

Produit les fichiers suivants :
- public/icons/icon-192.png (192x192, rounded square)
- public/icons/icon-512.png (512x512, rounded square)
- public/icons/maskable-512.png (512x512, cercle complet pour maskable PWA)
- public/icons/favicon-32.png (32x32, browser tab favicon)
- public/icons/apple-touch-icon.png (180x180, iOS home screen)
- public/favicon.svg (SVG vectoriel pour les navigateurs modernes)

Design : fond gradient orange->rouge, symbole € blanc au centre
(rebrand depuis l'ancien design "camion pizza" avec emoji 🍕).
"""

import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))
ICONSDIR = os.path.join(ROOT, "public", "icons")
PUBDIR = os.path.join(ROOT, "public")
os.makedirs(ICONSDIR, exist_ok=True)


def make_icon(size: int, out_path: str, maskable: bool = False) -> Image.Image:
    """Genere une icone PNG aux dimensions demandees. Retourne l'image."""
    # Image source plein pot
    src = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(src)
    # Gradient vertical orange -> rouge (f97544 -> ef4444)
    for y in range(size):
        t = y / size
        r = int(249 + (239 - 249) * t)
        g = int(117 + (68 - 117) * t)
        b = int(68 + (68 - 68) * t)
        draw.line([(0, y), (size, y)], fill=(r, g, b, 255))

    # Masque (cercle pour maskable, rounded square sinon)
    if maskable:
        mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, size, size), fill=255)
    else:
        radius = int(size * 0.22)
        mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(mask).rounded_rectangle(
            (0, 0, size, size), radius=radius, fill=255
        )
    rounded = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    rounded.paste(src, (0, 0), mask)

    # Symbole € blanc au centre (utilise une police bold systeme)
    draw = ImageDraw.Draw(rounded)
    font_size = int(size * 0.62)
    font = None
    for candidate in (
        "segoeuib.ttf",      # Windows Segoe UI Bold
        "arialbd.ttf",        # Windows Arial Bold
        "Arial Bold.ttf",     # macOS
        "LiberationSans-Bold.ttf",  # Linux
        "DejaVuSans-Bold.ttf",       # Linux
    ):
        try:
            font = ImageFont.truetype(candidate, font_size)
            break
        except Exception:
            continue
    if font is None:
        font = ImageFont.load_default()
    text = "\u20AC"  # euro sign
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    ox, oy = bbox[0], bbox[1]
    cx = (size - tw) // 2 - ox
    cy = (size - th) // 2 - oy
    # Ombre subtile pour le contraste
    draw.text((cx + 1, cy + 1), text, font=font, fill=(0, 0, 0, 60))
    draw.text((cx, cy), text, font=font, fill=(255, 255, 255, 255))

    rounded.save(out_path, "PNG", optimize=True)
    print(f"OK {out_path} ({size}x{size})")
    return rounded


def make_svg(out_path: str) -> None:
    """Genere un favicon SVG vectoriel avec symbole € blanc sur gradient."""
    svg = """<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f97544"/>
      <stop offset="100%" stop-color="#ef4444"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="64" height="64" rx="14" fill="url(#g)"/>
  <text x="32" y="48" font-size="44" font-weight="bold" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" fill="white">\u20AC</text>
</svg>
"""
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(svg)
    print(f"OK {out_path} (svg)")


if __name__ == "__main__":
    make_icon(192, os.path.join(ICONSDIR, "icon-192.png"), maskable=False)
    make_icon(512, os.path.join(ICONSDIR, "icon-512.png"), maskable=False)
    make_icon(512, os.path.join(ICONSDIR, "maskable-512.png"), maskable=True)
    make_icon(32, os.path.join(ICONSDIR, "favicon-32.png"), maskable=False)
    make_icon(180, os.path.join(ICONSDIR, "apple-touch-icon.png"), maskable=False)
    make_svg(os.path.join(PUBDIR, "favicon.svg"))
    print("DONE")

