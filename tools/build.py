"""Bouwt per skigebied een routeerbaar netwerk uit OpenSkiMap-data, plus hutten en restaurants uit OpenStreetMap.
Gebruik: python tools/build.py <osm-dir> <out-dir>   (eerst tools/fetch_huts.py voor de hutten)"""
import json, math, sys, os
from collections import defaultdict
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from regions import region_of

SRC, OUT = ("\\\\?\\" + os.path.abspath(p) for p in sys.argv[1:3])  # lange Windows-paden
os.makedirs(os.path.join(OUT, "data"), exist_ok=True)

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
    pl = (p.get("places") or [{}])[0] or {}
    cc = pl.get("iso3166_1Alpha2")
    reg = region_of(x, y, cc)
    if not reg: continue
    loc = (pl.get("localized") or {}).get("en") or {}
    areas[p["id"]] = dict(id=p["id"], name=p["name"], cc=cc, region=loc.get("region") or "",
                          locality=loc.get("locality") or "", x=x, y=y, runs=[], lifts=[],
                          website=(p.get("websites") or [""])[0], reg=reg,
                          conv=p.get("runConvention") or ("north_america" if reg == "noord-amerika" else "europe"))
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
                   oneway=p.get("oneway"), grooming=p.get("grooming"),
                   cc=((p.get("places") or [{}])[0] or {}).get("iso3166_1Alpha2") or "")
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
DIFF_NA = {"novice":"g","easy":"g","intermediate":"B","advanced":"s","expert":"x","freeride":"f","extreme":"f"}

# ---- hutten en restaurants (uit fetch_huts.py) ----
HUTS = defaultdict(list)   # (lon*20, lat*20) -> [lon, lat, soort, naam, hoogte]
hp = os.path.join(SRC, "amenities.json")
if os.path.exists(hp):
    seen = set()
    for tile in json.load(open(hp, encoding="utf-8")).values():
        for h in tile:
            k = (h[0], h[1])
            if k in seen: continue
            seen.add(k); HUTS[(int(h[0]*20), int(h[1]*20))].append(h)
print("hutten/restaurants", sum(len(v) for v in HUTS.values()))

def huts_for(nodes, edges, lon0, lat0):
    """Plekken op hooguit 120 m van een piste of lift, gekoppeld aan het dichtstbijzijnde knooppunt."""
    kx = 111320 * math.cos(math.radians(lat0)); ky = 110540
    lons = [n[3] for n in nodes]; lats = [n[4] for n in nodes]
    out = []
    for gx in range(int(min(lons)*20)-1, int(max(lons)*20)+2):
        for gy in range(int(min(lats)*20)-1, int(max(lats)*20)+2):
            for h in HUTS.get((gx, gy), []):
                x, y = (h[0]-lon0)*kx, (h[1]-lat0)*ky
                best = 1e9
                for e in edges:
                    sg = e["seg"]
                    for i in range(len(sg)-1):
                        p, q = sg[i], sg[i+1]
                        dx, dy = q[0]-p[0], q[1]-p[1]; d2 = dx*dx+dy*dy
                        t = 0 if d2 == 0 else max(0, min(1, ((x-p[0])*dx + (y-p[1])*dy)/d2))
                        d = math.hypot(x-p[0]-t*dx, y-p[1]-t*dy)
                        if d < best: best = d
                    if best < 30: break
                if best > 120: continue
                ni = min(range(len(nodes)), key=lambda i: (nodes[i][0]-x)**2 + (nodes[i][1]-y)**2)
                if math.hypot(nodes[ni][0]-x, nodes[ni][1]-y) > 400: continue
                out.append((h, ni))
    return out

index = []; shard = []; shard_size = 0; shard_no = 0
def flush():
    global shard, shard_size, shard_no
    if not shard: return
    with open(os.path.join(OUT, "data", f"s{shard_no:03d}.json"), "w", encoding="utf-8") as f:
        json.dump({a["id"]: a for a in shard}, f, separators=(",",":"), ensure_ascii=False)
    shard_no += 1; shard = []; shard_size = 0

for a in sorted(areas.values(), key=lambda a: (a["reg"], a["cc"], a["y"], a["x"])):
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
            dmap = DIFF_NA if a["conv"] == "north_america" else DIFF
            out_e.append(["r", e["a"], e["b"], nm(r["name"]), r["ref"] or "", dmap.get(r["diff"], "u"), round(e["len"]), drop, g,
                          r["cc"] if r["cc"] != a["cc"] else ""])
        else:
            dur = r["dur"]
            if not dur: dur = e["len"] / LIFT_SPEED.get(r["lt"], 3.5)
            out_e.append(["l", e["a"], e["b"], nm(r["name"]), r["ref"] or "", r["lt"] or "lift", round(e["len"]), round(dur), g,
                          1 if r["lt"] in RIDE_DOWN else 0, r["cc"] if r["cc"] != a["cc"] else ""])
    out_w = [[i, j, round(d)] for i, j, d in walk]
    out_n = [[round(n[3]*1e5), round(n[4]*1e5), round(n[2]) if n[2] is not None else None] for n in nodes]
    nr = sum(1 for e in edges if e["k"]=="r"); nl = len({id(e["rec"]) for e in edges if e["k"]=="l"})
    out_h = [[round(h[0]*1e5), round(h[1]*1e5), h[2], nm(h[3]), ni] for h, ni in huts_for(nodes, edges, lon0, lat0)][:150]
    rec = dict(id=a["id"], name=a["name"], n=out_n, e=out_e, w=out_w, t=names, h=out_h)
    s = len(json.dumps(rec, separators=(",",":")))
    if shard_size + s > 1_000_000: flush()
    shard.append(rec); shard_size += s
    km = sum(e["len"] for e in edges if e["k"]=="r")/1000
    eles = [n[2] for n in nodes if n[2] is not None]
    index.append([a["id"], a["name"], a["cc"], a["region"], round(a["x"],4), round(a["y"],4),
                  round(km), nl, shard_no, round(min(eles)) if eles else None, round(max(eles)) if eles else None, a["website"], a["reg"]])
flush()
with open(os.path.join(OUT, "data", "index.json"), "w", encoding="utf-8") as f:
    json.dump(index, f, separators=(",",":"), ensure_ascii=False)
print("index", len(index), "shards", shard_no)
