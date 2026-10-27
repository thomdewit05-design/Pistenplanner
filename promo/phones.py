"""Knipt de telefoons uit de winkelafbeeldingen (store/<taal>/screenshot-*.jpg) voor de social-video.
Gebruik: python promo/phones.py   ->  promo/phones/<taal>/1.png ... 6.png (met doorzichtige achtergrond)"""
import os
from PIL import Image, ImageDraw

# plek van de telefoon in de winkelafbeelding (1080 x 1920); de onderkant loopt van het beeld af
X0, Y0, X1, Y1, R = 174, 392, 906, 1920, 90
FADE = 160   # onderkant zacht laten verlopen

for lang in ("nl", "en"):
    out = os.path.join("promo", "phones", lang)
    os.makedirs(out, exist_ok=True)
    for i in range(1, 7):
        im = Image.open(os.path.join("store", lang, f"screenshot-{i}.jpg")).convert("RGBA").crop((X0, Y0, X1, Y1))
        w, h = im.size
        mask = Image.new("L", (w, h), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, w - 1, h + R], radius=R, fill=255)
        px = mask.load()
        for y in range(h - FADE, h):
            a = (h - y) / FADE
            for x in range(w):
                px[x, y] = int(px[x, y] * a)
        im.putalpha(mask)
        im.save(os.path.join(out, f"{i}.png"))
print("ok")
