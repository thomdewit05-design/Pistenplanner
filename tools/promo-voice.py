#!/usr/bin/env python3
"""Voice-over voor de TikTok-promovideo (store/video/promo-tiktok.html), Engels.

  python3 tools/promo-voice.py <map met kokoro-v1.0.onnx en voices-v1.0.bin> [stem, standaard af_heart]

Maakt per zin een fragment met het gratis stemmodel Kokoro (pip install kokoro-onnx soundfile; het model staat bij de
releases van github.com/thewh1teagle/kokoro-onnx), zet elke zin op het begin van zijn scène en schrijft:
  store/video/skipilot-promo-tiktok-en-voice.wav/.mp3    alleen de stem, 22 s
  store/video/skipilot-promo-tiktok-en-voiced.mp4        de video met de stem eronder
Het model zelf hoort niet in het project.
"""
import os, subprocess, sys
import numpy as np, soundfile as sf
from kokoro_onnx import Kokoro

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
KDIR = sys.argv[1]; VOICE = sys.argv[2] if len(sys.argv) > 2 else "af_heart"
DUR, GAP, MAXSPEED = 22.0, 0.10, 1.25
# (begin van de scène, einde van de scène, wat er gezegd wordt, hoe het geschreven moet worden om goed uitgesproken te worden)
LINES = [
    (0.10, 1.75, "POV: you never get lost on the mountain again.", "P O V: you never get lost on the mountain again."),
    (1.85, 3.30, "One tap.", "One tap."),
    (3.35, 5.30, "And your whole ski day is planned.", "And your whole ski day is planned."),
    (5.40, 7.00, "Phone stays in your pocket.", "Phone stays in your pocket."),
    (7.05, 9.70, "Your Watch taps your wrist. Left, or right.", "Your Watch taps your wrist. Left, or right."),
    (9.80, 12.10, "Check the whole mountain in 3D.", "Check the whole mountain in three D."),
    (12.20, 14.40, "Find your friends.", "Find your friends."),
    (14.45, 16.10, "Weather, snow, lifts. All there.", "Weather, snow, lifts. All there."),
    (16.20, 19.00, "Then flex your numbers.", "Then flex your numbers."),
    (19.30, 22.00, "Skipilot. Free on the App Store.", "Ski pilot. Free on the App Store."),
]
k = Kokoro(os.path.join(KDIR, "kokoro-v1.0.onnx"), os.path.join(KDIR, "voices-v1.0.bin"))

def trim(x, sr, thr=0.012):
    """Stilte aan begin en eind weghalen, met een heel korte in- en uitloop tegen tikken."""
    idx = np.where(np.abs(x) > thr)[0]
    if not len(idx): return x
    a, b = max(0, idx[0] - int(.01 * sr)), min(len(x), idx[-1] + int(.04 * sr)); x = x[a:b].copy()
    n = int(.008 * sr); x[:n] *= np.linspace(0, 1, n); x[-n:] *= np.linspace(1, 0, n); return x

def say(text, speed):
    x, sr = k.create(text, voice=VOICE, speed=speed, lang="en-us"); return trim(np.asarray(x, dtype=np.float32), sr), sr

# De zinnen moeten samen in 22 s passen en elk zo dicht mogelijk bij hun scène beginnen. De openingszin is langer dan zijn
# scène en schuift de volgende op; daarna haalt de stem het beeld weer in. Lukt dat niet, dan gaat het tempo iets omhoog.
speed = 1.08
while True:
    clips, at, plan, late = [], 0.0, [], 0.0
    for a, b, txt, spoken in LINES:
        x, sr = say(spoken, speed); start = max(a, at); end = start + len(x) / sr
        plan.append((start, end, a, b, txt)); clips.append((start, x)); at = end + GAP; late = max(late, start - a)
    over = plan[-1][1] - (DUR - 0.15)
    if (over <= 0 and late <= 1.3) or speed >= MAXSPEED: break
    speed = round(speed + 0.04, 2)

out = np.zeros(int(DUR * sr), dtype=np.float32)
for start, x in clips:
    i = int(start * sr); x = x[:max(0, len(out) - i)]; out[i:i + len(x)] += x
peak = float(np.max(np.abs(out))) or 1.0; out = out / peak * 0.89      # luid maar zonder vervorming
print(f"stem {VOICE}, tempo {speed}, {sr} Hz")
for start, end, a, b, txt in plan:
    print(f"  {start:5.2f}–{end:5.2f} s  (scène {a:5.2f}–{b:5.2f}, {start - a:+.2f} s)  {txt}")
print(f"  laatste woord op {plan[-1][1]:.2f} s van {DUR:.0f}; grootste vertraging {late:.2f} s; piek {np.max(np.abs(out)):.2f}, gemiddeld {np.sqrt(np.mean(out ** 2)):.3f}")

V = os.path.join(ROOT, "store/video"); base = os.path.join(V, "skipilot-promo-tiktok-en")
sf.write(base + "-voice.wav", out, sr)
run = lambda *a: subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *a], check=True)
run("-i", base + "-voice.wav", "-ar", "44100", "-b:a", "192k", base + "-voice.mp3")
run("-i", base + ".mp4", "-i", base + "-voice.wav", "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-shortest", "-movflags", "+faststart", base + "-voiced.mp4")
print(base + "-voiced.mp4")
