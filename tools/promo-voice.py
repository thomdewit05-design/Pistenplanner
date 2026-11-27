#!/usr/bin/env python3
"""Voice-overs voor de promovideo's in store/video (Engels).

  python3 tools/promo-voice.py <map met kokoro-v1.0.onnx en voices-v1.0.bin> [video ...] [--voice af_heart]
  video: tiktok, tips, resort, wrapped, types; zonder naam alle.

Maakt per zin een fragment met het gratis stemmodel Kokoro (pip install kokoro-onnx soundfile; het model staat bij de
releases van github.com/thewh1teagle/kokoro-onnx), zet elke zin op het begin van zijn scène en schrijft per video:
  store/video/skipilot-promo-<video>-en-voice.wav/.mp3    alleen de stem
  store/video/skipilot-promo-<video>-en-voiced.mp4        de video met de stem eronder
Het model zelf hoort niet in het project.
"""
import os, subprocess, sys
import numpy as np, soundfile as sf
from kokoro_onnx import Kokoro

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
args = [a for a in sys.argv[1:] if not a.startswith("--")]
KDIR = args[0]; VOICE = sys.argv[sys.argv.index("--voice") + 1] if "--voice" in sys.argv else "af_heart"
GAP, MAXSPEED = 0.10, 1.25
# Per video: de lengte en de zinnen als (begin van de scène, einde van de scène, wat er gezegd wordt).
# Sommige woorden zijn voor het model anders geschreven, anders spreekt het ze verkeerd uit:
# "Ski pilot" (Skipilot), "P O V", "three D", "Lay twah valay" (Les Trois Vallées), "ah-pray" (après).
SCRIPTS = {
  "tiktok": (22.0, [
    (0.10, 1.75, "P O V: you never get lost on the mountain again."),
    (1.85, 3.30, "One tap."),
    (3.35, 5.30, "And your whole ski day is planned."),
    (5.40, 7.00, "Phone stays in your pocket."),
    (7.05, 9.70, "Your Watch taps your wrist. Left, or right."),
    (9.80, 12.10, "Check the whole mountain in three D."),
    (12.20, 14.40, "Find your friends."),
    (14.45, 16.10, "Weather, snow, lifts. All there."),
    (16.20, 19.00, "Then flex your numbers."),
    (19.30, 22.00, "Ski pilot. Free on the App Store.")]),
  "tips": (17.0, [
    (0.25, 2.20, "Three Apple Watch settings for skiers."),
    (2.40, 6.20, "One. Fall detection, always on. Fall hard, and it calls for help."),
    (6.40, 10.20, "Two. Set haptics to prominent, so you feel it through your jacket."),
    (10.40, 14.10, "Three. Let Ski pilot tap you the way. Left, or right."),
    (14.40, 17.00, "Save this for your next ski trip.")]),
  "resort": (14.0, [
    (0.50, 2.90, "Lay twah valay. Today's best day route."),
    (3.10, 6.60, "Twenty-four runs. Twenty-three lifts. Fifty-four kilometers."),
    (6.80, 9.80, "And ten thousand meters of descent."),
    (11.30, 14.00, "Any resort. One tap. Ski pilot.")]),
  "wrapped": (15.0, [
    (0.20, 1.75, "Your ski day, wrapped."),
    (1.95, 4.05, "You skied thirty-one kilometers."),
    (4.25, 6.35, "You dropped six thousand two hundred meters."),
    (6.55, 8.65, "Seventeen runs."),
    (8.85, 10.95, "Top speed, seventy-one. Easy."),
    (11.15, 12.85, "You're a speed hunter."),
    (13.05, 15.00, "Track yours with Ski pilot.")]),
  "types": (18.0, [
    (0.20, 1.95, "Which skier are you?"),
    (2.10, 4.20, "The map reader. Stops everywhere."),
    (4.35, 6.45, "The first-lift fanatic. Up at five."),
    (6.60, 8.70, "The ah-pray pro. Two runs. Done."),
    (8.85, 10.95, "The speed demon. What slow sign?"),
    (11.10, 13.20, "The one who gets lost. Which lift?"),
    (13.35, 15.45, "The photographer. So many photos."),
    (15.65, 18.00, "Tag yours.")]),
  # quiz: de tijden horen bij promo-quiz.html (T0 = 2.6, elke ronde 4 s: 3 s aftellen, dan het antwoord)
  "quiz": (26.0, [
    (0.15, 2.45, "Guess the ski resort. Ready?"),
    (2.65, 3.55, "Number one."), (5.65, 6.55, "Lay twah valay!"),
    (6.65, 7.55, "Number two."), (9.65, 10.55, "Arlberg!"),
    (10.65, 11.55, "Number three."), (13.65, 14.55, "Zermatt!"),
    (14.65, 15.55, "Number four."), (17.65, 18.55, "Whistler!"),
    (18.65, 19.55, "Last one."), (21.65, 22.55, "Port doo so-lay!"),
    (22.75, 26.00, "How many did you get? Comment your score.")]),
}
# Geluidseffecten per video: (soort, tijdstip). Met code gemaakt, geen bestanden.
SFX = {"quiz": [("tick", 2.6 + i * 4 + k) for i in range(5) for k in range(3)] + [("ding", 2.6 + i * 4 + 3) for i in range(5)] + [("ding", 22.7)]}
WANT = args[1:] or list(SCRIPTS)
k = Kokoro(os.path.join(KDIR, "kokoro-v1.0.onnx"), os.path.join(KDIR, "voices-v1.0.bin"))

def trim(x, sr, thr=0.012):
    """Stilte aan begin en eind weghalen, met een heel korte in- en uitloop tegen tikken."""
    idx = np.where(np.abs(x) > thr)[0]
    if not len(idx): return x
    a, b = max(0, idx[0] - int(.01 * sr)), min(len(x), idx[-1] + int(.04 * sr)); x = x[a:b].copy()
    n = int(.008 * sr); x[:n] *= np.linspace(0, 1, n); x[-n:] *= np.linspace(1, 0, n); return x

def say(text, speed):
    x, sr = k.create(text, voice=VOICE, speed=speed, lang="en-us"); return trim(np.asarray(x, dtype=np.float32), sr), sr

run = lambda *a: subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *a], check=True)
bad = 0
for name in WANT:
    DUR, LINES = SCRIPTS[name]
    # Elke zin begint bij zijn scène (of direct na de vorige zin als die uitloopt). Past een zin niet voor de volgende scène,
    # dan gaat alleen die zin iets vlotter, tot hooguit MAXSPEED.
    clips, at, plan = [], 0.0, []
    for a, b, text in LINES:
        start = max(a, at); sp = 1.05; x, sr = say(text, sp)
        while start + len(x) / sr > b and sp < MAXSPEED: sp = round(sp + .05, 2); x, sr = say(text, sp)
        end = start + len(x) / sr; plan.append((start, end, a, b, sp, text)); clips.append((start, x)); at = end + GAP
    out = np.zeros(int(DUR * sr), dtype=np.float32)
    for start, x in clips:
        i = int(start * sr); x = x[:max(0, len(out) - i)]; out[i:i + len(x)] += x
    out = out / (float(np.max(np.abs(out))) or 1.0) * 0.82
    for kind, t0 in SFX.get(name, []):                                       # effecten onder de stem
        n = int((.12 if kind == "tick" else .9) * sr); tt = np.arange(n) / sr
        if kind == "tick": fx = (np.sin(2 * np.pi * 1500 * tt) * .6 + np.sin(2 * np.pi * 2300 * tt) * .3) * np.exp(-tt / .015) * .32
        else: fx = sum(np.sin(2 * np.pi * f * tt) * w for f, w in [(1318.5, .5), (1975.5, .3), (2637, .15)]) * np.exp(-tt / .28) * .34   # een heldere "ding" (E6, B6)
        i = int(t0 * sr); fx = fx[:max(0, len(out) - i)].astype(np.float32); out[i:i + len(fx)] += fx
    out = out / max(1.0, float(np.max(np.abs(out))) / 0.92)                 # luid maar zonder vervorming
    print(f"{name}: stem {VOICE}, {DUR:.0f} s")
    for start, end, a, b, sp, text in plan:
        late = end > b + .15 or end > DUR; bad += late
        print(f"  {start:5.2f}–{end:5.2f} s  (scène {a:5.2f}–{b:5.2f}, tempo {sp})  {text}" + ("   << LOOPT UIT" if late else ""))
    base = os.path.join(ROOT, "store/video", f"skipilot-promo-{name}-en")
    sf.write(base + "-voice.wav", out, sr)
    run("-i", base + "-voice.wav", "-ar", "44100", "-b:a", "192k", base + "-voice.mp3")
    if os.path.exists(base + ".mp4"):
        run("-i", base + ".mp4", "-i", base + "-voice.wav", "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-shortest", "-movflags", "+faststart", base + "-voiced.mp4")
print(f"{bad} zinnen lopen uit hun scène" if bad else "alle zinnen passen in hun scène")
