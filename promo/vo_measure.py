"""Meet per zin waar de stem begint en ophoudt (zonder stilte) en zet dat in vo-<taal>.json."""
import json, struct, sys, wave, os
HERE = os.path.dirname(os.path.abspath(__file__))
lang = sys.argv[1] if len(sys.argv) > 1 else "en"
p = os.path.join(HERE, f"vo-{lang}.json")
d = json.load(open(p, encoding="utf-8-sig"))
if isinstance(d, dict): d = [d]
for x in d:
    w = wave.open(os.path.join(HERE, x["file"]), "rb"); n = w.getnframes(); s = struct.unpack("<%dh" % n, w.readframes(n))
    loud = [i for i, v in enumerate(s) if abs(v) > 400]
    x["lead"] = round(loud[0] / 44100, 2); x["speech"] = round((loud[-1] - loud[0]) / 44100, 2)
for i, x in enumerate(d):
    end = x["at"] + x["lead"] + x["speech"]; nxt = d[i + 1]["at"] if i + 1 < len(d) else None
    print(f"{x['at']:5}  spreekt {x['speech']:4}s  tot {end:5.2f}{'  << overlapt' if nxt and end > nxt else ''}  {x['text']}")
json.dump(d, open(p, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
