"""Tekent het logo: een besneeuwde bergtop met een gele route die zigzaggend naar beneden loopt,
van een stip op de top naar een locatiestip in het dal. Eén ontwerp, uitgevoerd als SVG en als PNG-iconen.
Gebruik: python tools/make_icons.py (vanuit de projectmap)."""
import os
from PIL import Image, ImageDraw

NAVY_TOP, NAVY_BOT = (34, 57, 90), (15, 27, 42)
BACK, LIT, SHADE, ROUTE, INK = (94, 127, 163), (244, 248, 251), (186, 204, 222), (255, 196, 0), (15, 27, 42)

# geometrie in een vlak van 100 x 100
BACK_PEAK = [(-2, 101), (-2, 74), (21, 51), (30, 59), (42, 44), (63, 66), (102, 79), (102, 101)]
LIT_FACE = [(4, 101), (41, 48), (47, 52), (60, 20), (55, 101)]
SHADE_FACE = [(55, 101), (60, 20), (102, 84), (102, 101)]
SNOW_CAP = [(60, 20), (51, 36), (55, 35), (58, 40)]
SNOW_SHADE = [(60, 20), (58, 40), (62, 35), (68, 38)]
ICE = (214, 228, 240)
ROUTE_PATH = [((60, 27), (72, 37), (70, 46), (58, 51)), ((58, 51), (45, 57), (43, 64), (53, 70)), ((53, 70), (63, 75), (61, 82), (51, 86))]
START, END = (60, 26), (51, 85)
W = 6.0   # breedte van de route

def svg():
    pts = lambda ps: " ".join(f"{x},{y}" for x, y in ps)
    d = f"M{ROUTE_PATH[0][0][0]},{ROUTE_PATH[0][0][1]} " + " ".join(f"C{a[0]},{a[1]} {b[0]},{b[1]} {c[0]},{c[1]}" for _, a, b, c in ROUTE_PATH)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="Skipilot">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="rgb{NAVY_TOP}"/><stop offset="1" stop-color="rgb{NAVY_BOT}"/></linearGradient>
    <clipPath id="r"><rect width="100" height="100" rx="22"/></clipPath>
  </defs>
  <g clip-path="url(#r)">
    <rect width="100" height="100" fill="url(#bg)"/>
    <polygon points="{pts(BACK_PEAK)}" fill="rgb{BACK}"/>
    <polygon points="{pts(LIT_FACE)}" fill="rgb{LIT}"/>
    <polygon points="{pts(SHADE_FACE)}" fill="rgb{SHADE}"/>
    <polygon points="{pts(SNOW_CAP)}" fill="rgb{LIT}"/>
    <polygon points="{pts(SNOW_SHADE)}" fill="rgb{ICE}"/>
    <path d="{d}" fill="none" stroke="rgb{INK}" stroke-width="{W + 3}" stroke-linecap="round" stroke-linejoin="round" opacity=".16"/>
    <path d="{d}" fill="none" stroke="rgb{ROUTE}" stroke-width="{W}" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="{START[0]}" cy="{START[1]}" r="3.8" fill="rgb{ROUTE}" stroke="rgb{INK}" stroke-width="1.5"/>
    <circle cx="{END[0]}" cy="{END[1]}" r="6.4" fill="rgb{ROUTE}" stroke="rgb{INK}" stroke-width="1.8"/>
    <circle cx="{END[0]}" cy="{END[1]}" r="2.3" fill="rgb{INK}"/>
  </g>
</svg>
'''

def bez(p0, p1, p2, p3, n=40):
    out = []
    for i in range(n + 1):
        t = i / n; u = 1 - t
        out.append((u**3*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t**3*p3[0], u**3*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t**3*p3[1]))
    return out

def png(size, inset=0.0, rounded=True):
    S = size * 4
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    # achtergrond met verloop
    bg = Image.new("RGB", (S, S))
    px = bg.load()
    for y in range(S):
        for x in range(0, S, 4):
            t = (x + y) / (2 * S)
            c = tuple(round(NAVY_TOP[i] + (NAVY_BOT[i] - NAVY_TOP[i]) * t) for i in range(3))
            for k in range(4):
                if x + k < S: px[x + k, y] = c
    art = bg.convert("RGBA"); d = ImageDraw.Draw(art)
    k = (1 - 2 * inset) * S / 100; o = inset * S
    P = lambda ps: [(o + x * k, o + y * k) for x, y in ps]
    d.polygon(P(BACK_PEAK), fill=BACK); d.polygon(P(LIT_FACE), fill=LIT); d.polygon(P(SHADE_FACE), fill=SHADE)
    d.polygon(P(SNOW_CAP), fill=LIT); d.polygon(P(SNOW_SHADE), fill=ICE)
    line = []
    for seg in ROUTE_PATH: line += bez(*seg, n=240)
    # dikke lijn als rij rondjes: gladde randen en ronde bochten
    def stroke(dr, w, fill):
        r = w * k / 2
        for cx, cy in P(line): dr.ellipse([cx - r, cy - r, cx + r, cy + r], fill=fill)
    shadow = Image.new("RGBA", (S, S), (0, 0, 0, 0)); stroke(ImageDraw.Draw(shadow), W + 3, INK + (41,))
    art = Image.alpha_composite(art, shadow); d = ImageDraw.Draw(art)
    stroke(d, W, ROUTE)
    for c, r, w in ((START, 3.8, 1.5), (END, 6.4, 1.8)):
        cx, cy = P([c])[0]; R = r * k; d.ellipse([cx - R, cy - R, cx + R, cy + R], fill=ROUTE, outline=INK, width=round(w * k))
    cx, cy = P([END])[0]; R = 2.3 * k; d.ellipse([cx - R, cy - R, cx + R, cy + R], fill=INK)
    if rounded:
        mask = Image.new("L", (S, S), 0); ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=round(S * .22), fill=255)
        im.paste(art, (0, 0), mask)
    else:
        im = art
    return im.resize((size, size), Image.LANCZOS)

os.makedirs("icons", exist_ok=True)
open("icons/logo.svg", "w", encoding="utf-8").write(svg())
png(192).save("icons/icon-192.png")
png(512).save("icons/icon-512.png")
png(512, inset=.1, rounded=False).save("icons/icon-maskable-512.png")   # Android knipt zelf de vorm
png(180, rounded=False).save("icons/apple-touch-icon.png")             # iOS rondt zelf af
png(64).save("icons/favicon-64.png")
# iOS-app: icoon zonder doorzichtigheid (Apple weigert een alfakanaal) en het opstartscherm
IOS = "ios/App/App/Assets.xcassets"
if os.path.isdir(IOS):
    png(1024, rounded=False).convert("RGB").save(f"{IOS}/AppIcon.appiconset/AppIcon-512@2x.png")
    splash = Image.new("RGB", (2732, 2732), NAVY_BOT)
    logo = png(560); splash.paste(logo, ((2732 - 560) // 2, (2732 - 560) // 2), logo)
    for n in ("splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"): splash.save(f"{IOS}/Splash.imageset/{n}")
print("ok")
