"""Bouwt per Alpen-skigebied een routeerbaar netwerk uit OpenSkiMap-data.
Gebruik: python -I build.py <osm-dir> <out-dir>"""
import json, math, sys, os
from collections import defaultdict

SRC, OUT = ("\\\\?\\" + os.path.abspath(p) for p in sys.argv[1:3])  # lange Windows-paden
os.makedirs(os.path.join(OUT, "data"), exist_ok=True)

ALPS = [(5.0,43.65),(6.6,43.6),(7.7,43.85),(8.25,44.1),(7.95,44.45),(7.35,44.9),(7.45,45.35),(8.4,45.75),
        (9.4,45.8),(10.4,45.65),(11.2,45.72),(12.3,45.9),(13.3,46.05),(14.3,46.15),(15.0,46.25),(15.7,46.35),
        (16.25,47.0),(16.2,47.75),(15.4,47.95),(13.6,47.92),(12.4,47.82),(11.0,47.72),(10.0,47.62),(9.7,47.48),
        (9.0,47.3),(8.3,47.12),(7.7,46.92),(7.0,46.7),(6.75,46.45),(6.45,46.2),(6.0,45.95),(5.75,45.6),
        (5.35,45.1),(5.2,44.5)]
COUNTRIES = {"FR","CH","IT","AT","DE","SI","LI","MC"}

def in_poly(x, y, poly=ALPS):
    inside = False; j = len(poly) - 1
    for i in range(len(poly)):
        xi, yi = poly[i]; xj, yj = poly[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi: inside = not inside
        j = i
    return inside

def features(path):
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip().rstrip(",")
            if not (line.startswith('{"type":"Feature"') or line.startswith('{"properties"')): continue
            try: yield json.loads(line)
            except Exception: continue

# ---- skigebieden ----
areas = {}
for ft in features(os.path.join(SRC, "ski_areas.geojson")):
    p = ft["properties"]
    if "downhill" not in (p.get("activities") or []) or p.get("status") not in ("operating", None): continue
    if not p.get("name"): continue
    g = ft["geometry"]
    if g["type"] == "Point": x, y = g["coordinates"][:2]
    else:
        c = (p.get("viewportHint") or {}).get("center")
        if not c: continue
        x, y = c
    if not in_poly(x, y): continue
    pl = (p.get("places") or [{}])[0]
    cc = pl.get("iso3166_1Alpha2")
    if cc not in COUNTRIES: continue
    loc = (pl.get("localized") or {}).get("en") or {}
    areas[p["id"]] = dict(id=p["id"], name=p["name"], cc=cc, region=loc.get("region") or "",
                          locality=loc.get("locality") or "", x=x, y=y, runs=[], lifts=[])
print("areas", len(areas))

def collect(path, kind):
    n = 0
    for ft in features(path):
        p = ft["properties"]
        if ft["geometry"]["type"] != "LineString": continue
        if p.get("status") not in ("operating", None): continue
        if kind == "run" and "downhill" not in (p.get("uses") or []): continue
        ids = [s["properties"]["id"] for s in (p.get("skiAreas") or [])]
        hit = [i for i in ids if i in areas]
        if not hit: continue
        rec = dict(coords=ft["geometry"]["coordinates"], name=p.get("name"), ref=p.get("ref"),
                   diff=p.get("difficulty"), lt=p.get("liftType"), dur=p.get("duration"),
                   oneway=p.get("oneway"), grooming=p.get("grooming"))
        for i in hit: areas[i]["runs" if kind == "run" else "lifts"].append(rec)
        n += 1
    print(kind, n)

collect(os.path.join(SRC, "lifts.geojson"), "lift")
collect(os.path.join(SRC, "runs.geojson"), "run")

# ---- graaf per gebied ----
LIFT_OK = {"chair_lift","gondola","cable_car","t-bar","j-bar","platter","drag_lift","rope_tow","magic_carpet",
           "mixed_lift","funicular","zip_line" , "station", None}
LIFT_SPEED = {"gondola":5.0,"cable_car":8.0,"funicular":7.0,"chair_lift":3.5,"mixed_lift":4.5,"t-bar":3.0,
              "j-bar":3.0,"platter":3.0,"drag_lift":3.0,"rope_tow":2.0,"magic_carpet":0.6}
RIDE_DOWN = {"gondola","cable_car","funicular","mixed_lift"}

def build(a):
    lon0, lat0 = a["x"], a["y"]
    kx = 111320 * math.cos(math.radians(lat0)); ky = 110540
    P = lambda c: ((c[0]-lon0)*kx, (c[1]-lat0)*ky)
    lines = []
    for r in a["runs"]:
        if r["diff"] in ("freeride","extreme") and r["grooming"] == "backcountry": pass
        cs = r["coords"]
        if len(cs) < 2: continue
        if len(cs[0]) > 2 and len(cs[-1]) > 2 and cs[0][2] is not None and cs[-1][2] is not None and cs[-1][2] - cs[0][2] > 40:
            cs = cs[::-1]
        lines.append(dict(kind="r", rec=r, pts=[list(P(c)) + [c[2] if len(c)>2 else None, c[0], c[1]] for c in cs]))
    for l in a["lifts"]:
        if l["lt"] not in LIFT_OK or l["lt"] in ("zip_line","station"): continue
        cs = l["coords"]
        if len(cs) < 2: continue
        lines.append(dict(kind="l", rec=l, pts=[list(P(c)) + [c[2] if len(c)>2 else None, c[0], c[1]] for c in cs]))
    if not any(L["kind"]=="l" for L in lines) or sum(L["kind"]=="r" for L in lines) < 2: return None

    # gedeelde hoekpunten -> splitsen
    vkey = lambda p: (round(p[3]*1e6), round(p[4]*1e6))
    vcount = defaultdict(set)
    for li, L in enumerate(lines):
        for p in L["pts"]: vcount[vkey(p)].add(li)
    # eindpunten die op een ander lijnstuk vallen -> invoegen
    CELL = 60
    grid = defaultdict(list)
    for li, L in enumerate(lines):
        for si in range(len(L["pts"])-1):
            p, q = L["pts"][si], L["pts"][si+1]
            for gx in range(int(min(p[0],q[0])//CELL)-1, int(max(p[0],q[0])//CELL)+2):
                for gy in range(int(min(p[1],q[1])//CELL)-1, int(max(p[1],q[1])//CELL)+2):
                    grid[(gx,gy)].append((li, si))
    inserts = defaultdict(list)  # li -> [(si, t, point)]
    for li, L in enumerate(lines):
        tol = 60 if L["kind"] == "l" else 25
        for end in (L["pts"][0], L["pts"][-1]):
            best = None
            for (lj, sj) in grid[(int(end[0]//CELL), int(end[1]//CELL))]:
                if lj == li: continue
                M = lines[lj]; p, q = M["pts"][sj], M["pts"][sj+1]
                dx, dy = q[0]-p[0], q[1]-p[1]; d2 = dx*dx+dy*dy
                t = 0 if d2 == 0 else max(0, min(1, ((end[0]-p[0])*dx + (end[1]-p[1])*dy)/d2))
                cx, cy = p[0]+t*dx, p[1]+t*dy
                d = math.hypot(end[0]-cx, end[1]-cy)
                if d < tol and (best is None or d < best[0]): best = (d, lj, sj, t)
            if best:
                _, lj, sj, t = best
                if 0 < t < 1: inserts[lj].append((sj, t))
    # punten invoegen
    for lj, ins in inserts.items():
        pts = lines[lj]["pts"]; new = []; split_idx = set()
        bys = defaultdict(list)
        for sj, t in ins: bys[sj].append(t)
        for si in range(len(pts)):
            new.append(pts[si])
            if si in bys and si < len(pts)-1:
                p, q = pts[si], pts[si+1]
                for t in sorted(set(bys[si])):
                    e = None if p[2] is None or q[2] is None else p[2]+t*(q[2]-p[2])
                    np_ = [p[0]+t*(q[0]-p[0]), p[1]+t*(q[1]-p[1]), e, p[3]+t*(q[3]-p[3]), p[4]+t*(q[4]-p[4])]
                    np_.append("split"); new.append(np_)
        lines[lj]["pts"] = new

    # knooppunten: eindpunten, splitpunten, gedeelde hoekpunten; clusteren
    nodes = []  # [x,y,ele,lon,lat]
    ngrid = defaultdict(list)
    def node_for(p, tol):
        gx, gy = int(p[0]//CELL), int(p[1]//CELL)
        best = None
        for dx in (-1,0,1):
            for dy in (-1,0,1):
                for ni in ngrid[(gx+dx, gy+dy)]:
                    n = nodes[ni]; d = math.hypot(n[0]-p[0], n[1]-p[1])
                    if d < tol and (best is None or d < best[0]): best = (d, ni)
        if best: return best[1]
        nodes.append([p[0], p[1], p[2], p[3], p[4]]); ngrid[(gx,gy)].append(len(nodes)-1)
        return len(nodes)-1

    edges = []
    for L in lines:
        pts = L["pts"]
        cut = [0]
        for i in range(1, len(pts)-1):
            if len(pts[i]) > 5 or len(vcount[vkey(pts[i])]) > 1: cut.append(i)
        cut.append(len(pts)-1)
        if L["kind"] == "l": cut = [0, len(pts)-1]   # liften niet onderweg splitsen
        for a_, b_ in zip(cut, cut[1:]):
            seg = pts[a_:b_+1]
            ln = sum(math.hypot(seg[i+1][0]-seg[i][0], seg[i+1][1]-seg[i][1]) for i in range(len(seg)-1))
            if ln < 3: continue
            tol = 45 if L["kind"] == "l" else 15
            na, nb = node_for(seg[0], tol), node_for(seg[-1], tol)
            if na == nb: continue
            edges.append(dict(k=L["kind"], a=na, b=nb, rec=L["rec"], seg=seg, len=ln))

    # loopverbindingen tussen dichtbij gelegen, niet verbonden knooppunten
    adj = defaultdict(set)
    for e in edges: adj[e["a"]].add(e["b"]); adj[e["b"]].add(e["a"])
    walk = []
    for i, n in enumerate(nodes):
        gx, gy = int(n[0]//CELL), int(n[1]//CELL)
        for dx in (-1,0,1):
            for dy in (-1,0,1):
                for j in ngrid[(gx+dx, gy+dy)]:
                    if j <= i or j in adj[i]: continue
                    d = math.hypot(nodes[j][0]-n[0], nodes[j][1]-n[1])
                    if d < 70: walk.append((i, j, d))
    return nodes, edges, walk, (lon0, lat0)

def simplify(pts, eps=6):
    if len(pts) < 3: return pts
    a, b = pts[0], pts[-1]; dx, dy = b[0]-a[0], b[1]-a[1]; L = math.hypot(dx, dy) or 1e-9
    i_max, d_max = 0, 0
    for i in range(1, len(pts)-1):
        d = abs(dy*(pts[i][0]-a[0]) - dx*(pts[i][1]-a[1])) / L
        if d > d_max: i_max, d_max = i, d
    if d_max <= eps: return [a, b]
    return simplify(pts[:i_max+1], eps)[:-1] + simplify(pts[i_max:], eps)

DIFF = {"novice":"g","easy":"b","intermediate":"r","advanced":"s","expert":"s","freeride":"f","extreme":"f"}
index = []; shard = []; shard_size = 0; shard_no = 0
def flush():
    global shard, shard_size, shard_no
    if not shard: return
    with open(os.path.join(OUT, "data", f"s{shard_no:03d}.json"), "w", encoding="utf-8") as f:
        json.dump({a["id"]: a for a in shard}, f, separators=(",",":"), ensure_ascii=False)
    shard_no += 1; shard = []; shard_size = 0

for a in sorted(areas.values(), key=lambda a: (a["cc"], a["y"], a["x"])):
    res = build(a)
    if not res: continue
    nodes, edges, walk, (lon0, lat0) = res
    if len(edges) < 3: continue
    names = []; nidx = {}
    def nm(s):
        if not s: return -1
        if s not in nidx: nidx[s] = len(names); names.append(s)
        return nidx[s]
    out_e = []
    for e in edges:
        r = e["rec"]; seg = simplify(e["seg"])
        g = []; px = py = 0
        for p in seg:
            x, y = round(p[3]*1e5), round(p[4]*1e5); g += [x-px, y-py]; px, py = x, y
        ea, eb = nodes[e["a"]][2], nodes[e["b"]][2]
        drop = round(ea - eb) if ea is not None and eb is not None else 0
        if e["k"] == "r":
            out_e.append(["r", e["a"], e["b"], nm(r["name"]), r["ref"] or "", DIFF.get(r["diff"], "u"), round(e["len"]), drop, g])
        else:
            dur = r["dur"]
            if not dur: dur = e["len"] / LIFT_SPEED.get(r["lt"], 3.5)
            out_e.append(["l", e["a"], e["b"], nm(r["name"]), r["ref"] or "", r["lt"] or "lift", round(e["len"]), round(dur), g,
                          1 if r["lt"] in RIDE_DOWN else 0])
    out_w = [[i, j, round(d)] for i, j, d in walk]
    out_n = [[round(n[3]*1e5), round(n[4]*1e5), round(n[2]) if n[2] is not None else None] for n in nodes]
    nr = sum(1 for e in edges if e["k"]=="r"); nl = len({id(e["rec"]) for e in edges if e["k"]=="l"})
    rec = dict(id=a["id"], name=a["name"], n=out_n, e=out_e, w=out_w, t=names)
    s = len(json.dumps(rec, separators=(",",":")))
    if shard_size + s > 1_000_000: flush()
    shard.append(rec); shard_size += s
    km = sum(e["len"] for e in edges if e["k"]=="r")/1000
    eles = [n[2] for n in nodes if n[2] is not None]
    index.append([a["id"], a["name"], a["cc"], a["region"], round(a["x"],4), round(a["y"],4),
                  round(km), nl, shard_no, round(min(eles)) if eles else None, round(max(eles)) if eles else None])
flush()
with open(os.path.join(OUT, "data", "index.json"), "w", encoding="utf-8") as f:
    json.dump(index, f, separators=(",",":"), ensure_ascii=False)
print("index", len(index), "shards", shard_no)
