# Bepaalt per skigebied of het een deel is van een groter aaneengesloten gebied, en welk.
# Gebruik: python3 tools/parents.py <map met runs.geojson van OpenSkiMap> <map van deze app> <uitvoer.json>
# De uitkomst staat als PARENT_AREA in app.js (plus Les Arcs en La Plagne, die officieel bij Paradiski horen).
# Bron: de pistes die in OpenSkiMap bij meer dan één gebied horen (runs.geojson), en de al gebouwde netwerken in data/.
import json, collections, math, sys
SRC, REPO = sys.argv[1], sys.argv[2]
def feats(path):
    with open(path,encoding='utf-8') as f:
        for line in f:
            line=line.strip().rstrip(',')
            if not (line.startswith('{"type":"Feature"') or line.startswith('{"properties"')): continue
            try: yield json.loads(line)
            except Exception: continue
def length(cs):
    d=0
    for a,b in zip(cs,cs[1:]):
        kx=111320*math.cos(math.radians(a[1])); d+=math.hypot((b[0]-a[0])*kx,(b[1]-a[1])*110540)
    return d/1000
rows=json.load(open(REPO+'/data/index.json')); app={r[0]:r for r in rows}
km=collections.Counter(); pair=collections.Counter()
for ft in feats(SRC+'/runs.geojson'):
    p=ft['properties']; g=ft['geometry']
    if g['type']!='LineString' or 'downhill' not in (p.get('uses') or []) or p.get('status') not in ('operating',None): continue
    ids=[s['properties']['id'] for s in (p.get('skiAreas') or []) if s['properties']['id'] in app]; L=length(g['coordinates'])
    for i in ids: km[i]+=L
    for a in ids:
        for b in ids:
            if a!=b: pair[(a,b)]+=L
cache={}
def area(i):
    n=app[i][8]
    if n not in cache:
        if len(cache)>30: cache.pop(next(iter(cache)))
        cache[n]=json.load(open(f'{REPO}/data/s{n:03d}.json'))
    return cache[n][i]
def comp_km(pid, lat, lon):
    """km piste in het aaneengesloten deel van gebied pid dat het dichtst bij (lat, lon) ligt"""
    rec=area(pid); N=len(rec['n']); par=list(range(N))
    def find(x):
        while par[x]!=x: par[x]=par[par[x]]; x=par[x]
        return x
    for e in rec['e']: par[find(e[1])]=find(e[2])
    for w in rec['w']: par[find(w[0])]=find(w[1])
    best=None
    for i,n in enumerate(rec['n']):
        d=((n[1]/1e5-lat)*110540)**2+((n[0]/1e5-lon)*111320*math.cos(math.radians(lat)))**2
        if best is None or d<best[0]: best=(d,i)
    root=find(best[1]); return sum(e[6] for e in rec['e'] if e[0]=='r' and find(e[1])==root)/1000
out={}
for a in app:
    if not km[a]: continue
    cands=[b for (x,b),L in pair.items() if x==a and L/km[a]>0.8 and km[b]>km[a]*1.3]
    if not cands: continue
    r=app[a]; sc=[]
    for b in cands:
        c=comp_km(b, r[5], r[4])
        if c>km[a]*1.25 and c>=0.6*app[b][6]: sc.append((round(c), -km[b], b))
    if not sc: continue
    top=max(s[0] for s in sc); sc=[s for s in sc if s[0]>=top*0.97]; sc.sort(key=lambda s:s[1], reverse=True)   # grootste aaneengesloten deel; bij gelijk het kleinste gebied (kleinere download)
    out[a]=(sc[0][2], sc[0][0])
print(len(out),'deelgebieden met een groter aaneengesloten gebied')
for a,(b,c) in sorted(out.items(), key=lambda x:-x[1][1])[:60]: print(f'  {app[a][1][:34]:34} {round(km[a]):4} km -> {app[b][1][:34]:34} (aaneengesloten {c} km van {app[b][6]})')
json.dump({a[:8]:b[:8] for a,(b,c) in out.items()}, open(sys.argv[3],'w'))
