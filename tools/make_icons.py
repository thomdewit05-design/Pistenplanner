"""Tekent de app-iconen. Gebruik: python tools/make_icons.py (vanuit de projectmap)."""
import os
from PIL import Image, ImageDraw

NAVY, SNOW, ROCK, YELLOW = (15, 27, 42), (244, 248, 251), (122, 142, 164), (255, 196, 0)

def icon(size, pad=0.0):
    s = 4 * size                                   # supersampling voor gladde randen
    im = Image.new("RGB", (s, s), NAVY); d = ImageDraw.Draw(im)
    p = lambda x, y: (s * (pad + (1 - 2 * pad) * x), s * (pad + (1 - 2 * pad) * y))
    d.polygon([p(.02, .86), p(.36, .30), p(.52, .52), p(.66, .22), p(.98, .86)], fill=ROCK)
    d.polygon([p(.36, .30), p(.29, .42), p(.36, .39), p(.42, .44), p(.45, .41)], fill=SNOW)
    d.polygon([p(.66, .22), p(.57, .37), p(.64, .34), p(.70, .40), p(.75, .35)], fill=SNOW)
    w = int(s * (1 - 2 * pad) * .055)
    pts = [p(.66, .24), p(.58, .46), p(.70, .58), p(.46, .70), p(.40, .86)]
    d.line(pts, fill=YELLOW, width=w, joint="curve")
    for q in (pts[0], pts[-1]):
        r = w * .95; d.ellipse([q[0]-r, q[1]-r, q[0]+r, q[1]+r], fill=YELLOW)
    return im.resize((size, size), Image.LANCZOS)

os.makedirs("icons", exist_ok=True)
icon(192).save("icons/icon-192.png")
icon(512).save("icons/icon-512.png")
icon(512, pad=.12).save("icons/icon-maskable-512.png")
icon(180, pad=.06).save("icons/apple-touch-icon.png")
print("ok")
