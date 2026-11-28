#!/usr/bin/env python3
"""Geluid voor de hoofdfilm (store/video/promo-film.html): Engelse stem en geluidseffecten.

  python3 tools/promo-sound.py <map met kokoro-v1.0.onnx en voices-v1.0.bin> [stem, standaard af_heart]

De stem komt uit het gratis model Kokoro (zie tools/promo-voice.py); de effecten worden hier met code gemaakt:
een zachte zoef bij een camerabeweging, een tik bij het aanraken van het scherm, een doffe tik per tik van de Watch,
en een rustige klankbodem onder het begin en het slot. Geen muziek: die zet je er zelf onder.
Schrijft in store/video/:
  skipilot-promo-film-en-voice.wav     alleen de stem
  skipilot-promo-film-en-sound.wav     stem en effecten
  skipilot-promo-film-en-sound.mp4     de film met stem en effecten (de film zonder geluid moet er al staan)
"""
import os, subprocess, sys
import numpy as np, soundfile as sf
from kokoro_onnx import Kokoro

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
KDIR = sys.argv[1]; VOICE = sys.argv[2] if len(sys.argv) > 2 else "af_heart"
SR, DUR, SPEED = 48000, 30.0, 0.98
# (begin, uiterste einde, wat er gezegd wordt zoals het model het moet lezen)
LINES = [
    (0.70, 3.30, "Every mountain has a thousand ways down."),
    (3.55, 6.00, "Ski pilot finds yours. One tap,"),
    (6.10, 8.20, "and your whole ski day is planned."),
    (8.70, 12.80, "See it in three D, before you go."),
    (13.45, 15.20, "Then put your phone away."),
    (15.30, 16.85, "Your Watch taps your wrist."),
    (17.05, 17.95, "Left."),
    (18.20, 19.40, "Or right."),
    (19.85, 21.00, "Find your friends."),
    (21.15, 22.30, "Beat the last lift."),
    (22.45, 24.20, "Remember the day."),
    (25.40, 29.60, "Ski pilot. Your navigation on the slopes."),
]
# de momenten uit de film (promo-film.html)
WHOOSH = [(3.25, 1.0), (8.15, .7), (15.45, .9), (19.65, .6), (20.95, .5), (22.25, .5), (24.15, 1.0)]
SCREEN_TAP = [4.58]
WATCH_TAPS = [16.9, 17.06, 17.51, 17.67, 18.05, 18.21, 18.37]

rng = np.random.default_rng(7)
def env(n, a, r):                      # snel op, langzaam uit
    t = np.arange(n) / SR; return np.minimum(1, t / a) * np.exp(-np.maximum(0, t - a) / r)
def lowpass(x, fc):                    # eenvoudige eerste-orde filter, twee keer
    a = np.exp(-2 * np.pi * fc / SR); y = np.empty_like(x); z = 0.0
    for i in range(len(x)): z = (1 - a) * x[i] + a * z; y[i] = z
    return y
def whoosh(strength):
    n = int(.7 * SR); t = np.arange(n) / SR; noise = rng.standard_normal(n)
    lo, hi = lowpass(noise, 500), lowpass(noise, 3500)             # van dof naar helder en terug: een "zoef"
    mixv = np.sin(np.pi * t / .7) ** 2; x = lo * (1 - mixv) + (hi - lo) * mixv * .9
    return x * np.sin(np.pi * t / .7) ** 1.5 * .09 * strength
def tick():
    n = int(.09 * SR); t = np.arange(n) / SR
    return (np.sin(2 * np.pi * 1400 * t) * .5 + np.sin(2 * np.pi * 2100 * t) * .25) * np.exp(-t / .012) * .22
def thud():                            # de tik van de Watch: een korte, doffe klop met een klikje erin
    n = int(.14 * SR); t = np.arange(n) / SR
    body = np.sin(2 * np.pi * (150 - 500 * t).clip(70) * t) * np.exp(-t / .03)
    click = lowpass(rng.standard_normal(n), 2500) * np.exp(-t / .004) * .6
    return (body * .5 + click) * .34
def pad(dur, freqs, level):
    n = int(dur * SR); t = np.arange(n) / SR; x = np.zeros(n)
    for i, f in enumerate(freqs): x += np.sin(2 * np.pi * f * t + i) * (1 + .25 * np.sin(2 * np.pi * (.11 + .03 * i) * t + i * 2)) / len(freqs)
    return x * level

def add(buf, x, at):
    i = int(at * SR)
    if i >= len(buf): return
    x = x[:len(buf) - i]; buf[i:i + len(x)] += x

# ---------- stem ----------
k = Kokoro(os.path.join(KDIR, "kokoro-v1.0.onnx"), os.path.join(KDIR, "voices-v1.0.bin"))
def say(text, speed):
    x, sr = k.create(text, voice=VOICE, speed=speed, lang="en-us"); x = np.asarray(x, dtype=np.float64)
    idx = np.where(np.abs(x) > .012)[0]; x = x[max(0, idx[0] - int(.01 * sr)):min(len(x), idx[-1] + int(.05 * sr))].copy()
    m = int(.008 * sr); x[:m] *= np.linspace(0, 1, m); x[-m:] *= np.linspace(1, 0, m)
    return np.interp(np.arange(int(len(x) * SR / sr)) * sr / SR, np.arange(len(x)), x)      # naar 48 kHz
voice = np.zeros(int(DUR * SR)); report = []
for a, b, text in LINES:
    sp = SPEED; x = say(text, sp)
    while len(x) / SR > b - a and sp < 1.3: sp = round(sp + .05, 2); x = say(text, sp)   # past de zin niet in zijn scène, dan iets vlotter
    add(voice, x, a); report.append((a, a + len(x) / SR, b, sp, text))
voice *= .9 / (np.max(np.abs(voice)) or 1)

# ---------- effecten ----------
fx = np.zeros(int(DUR * SR))
for t0, s in WHOOSH: add(fx, whoosh(s), t0 - .25)
for t0 in SCREEN_TAP: add(fx, tick(), t0)
for t0 in WATCH_TAPS: add(fx, thud(), t0)
# klankbodem: laag en rustig onder de opening, warm en open onder het slot
n = len(fx); t = np.arange(n) / SR
intro = pad(DUR, [55, 82.4, 110, 164.8], .05) * np.clip(t / 1.2, 0, 1) * np.clip((4.2 - t) / 1.2, 0, 1)
outro = pad(DUR, [130.8, 196, 261.6, 329.6, 392, 587.3], .06) * np.clip((t - 24.0) / 1.5, 0, 1) * np.clip((DUR - t) / 1.8, 0, 1)
fx += intro + outro

mixd = voice + fx; peak = np.max(np.abs(mixd)); mixd = mixd * (.92 / peak) if peak > .92 else mixd
print(f"stem {VOICE}")
for a, e, b, sp, text in report: print(f"  {a:5.2f}–{e:5.2f} s (ruimte tot {b:5.2f}, tempo {sp})  {text}" + ("   << TE LANG" if e > b + .05 else ""))
print(f"  piek stem {np.max(np.abs(voice)):.2f}, piek effecten {np.max(np.abs(fx)):.2f}, piek samen {np.max(np.abs(mixd)):.2f}")

V = os.path.join(ROOT, "store/video"); base = os.path.join(V, "skipilot-promo-film-en")
st = lambda x: np.stack([x, x], axis=1).astype(np.float32)
sf.write(base + "-voice.wav", st(voice), SR); sf.write(base + "-sound.wav", st(mixd), SR)
if os.path.exists(base + ".mp4"):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", base + ".mp4", "-i", base + "-sound.wav", "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", base + "-sound.mp4"], check=True)
    print(base + "-sound.mp4")
else: print("de film zonder geluid staat er nog niet; alleen het geluid is geschreven")
