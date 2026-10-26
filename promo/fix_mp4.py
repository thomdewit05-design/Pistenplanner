"""Zet de MP4 van Chrome (gefragmenteerd, met een verkeerde lengte in de kop) om naar een gewone MP4.

Beeld en geluid blijven ongewijzigd: alleen de verpakking wordt opnieuw gemaakt, met de index vooraan
en beeld en geluid per seconde om en om (zodat de video op social media en in elke speler goed start).
Gebruik: python promo/fix_mp4.py in.mp4 uit.mp4
"""
import struct, sys


def boxes(b, off, end):
    while off < end:
        size, typ = struct.unpack(">I4s", b[off:off + 8]); hdr = 8
        if size == 1: size = struct.unpack(">Q", b[off + 8:off + 16])[0]; hdr = 16
        if size == 0: size = end - off
        yield typ.decode("latin1"), off, size, hdr
        off += size


def find(b, off, end, typ):
    for t, o, s, h in boxes(b, off, end):
        if t == typ: return o, s, h
    raise KeyError(typ)


def box(typ, payload): return struct.pack(">I4s", 8 + len(payload), typ.encode()) + payload
def full(typ, ver, flags, payload): return box(typ, struct.pack(">I", (ver << 24) | flags) + payload)
u32 = lambda b, o: struct.unpack(">I", b[o:o + 4])[0]


def main(src, dst):
    f = open(src, "rb").read()
    mo, ms, mh = find(f, 0, len(f), "moov")
    if not any(t == "moof" for t, *_ in boxes(f, 0, len(f))):
        raise SystemExit("Dit bestand is al een gewone MP4.")
    tracks, trex = {}, {}
    for t, o, s, h in boxes(f, mo + mh, mo + ms):
        if t == "mvex":
            for t2, o2, s2, h2 in boxes(f, o + h, o + s):
                if t2 == "trex":
                    tid, _, dd, ds, df = struct.unpack(">IIIII", f[o2 + 12:o2 + 32]); trex[tid] = (dd, ds, df)
        if t != "trak": continue
        tk_o, _, _ = find(f, o + h, o + s, "tkhd")
        tid = u32(f, tk_o + 12 + (8 if f[tk_o + 8] == 0 else 16))
        md_o, md_s, md_h = find(f, o + h, o + s, "mdia")
        mdhd_o, _, _ = find(f, md_o + md_h, md_o + md_s, "mdhd")
        ts = u32(f, mdhd_o + 20) if f[mdhd_o + 8] == 0 else u32(f, mdhd_o + 28)
        hd_o, hd_s, _ = find(f, md_o + md_h, md_o + md_s, "hdlr")
        kind = f[hd_o + 16:hd_o + 20].decode()
        mi_o, mi_s, mi_h = find(f, md_o + md_h, md_o + md_s, "minf")
        head = b"".join(f[o2:o2 + s2] for t2, o2, s2, h2 in boxes(f, mi_o + mi_h, mi_o + mi_s) if t2 in ("vmhd", "smhd", "dinf"))
        st_o, st_s, st_h = find(f, mi_o + mi_h, mi_o + mi_s, "stbl")
        sd_o, sd_s, _ = find(f, st_o + st_h, st_o + st_s, "stsd")
        tracks[tid] = {"kind":kind, "ts":ts, "hdlr":f[hd_o:hd_o + hd_s], "head":head, "stsd":f[sd_o:sd_o + sd_s], "samples":[]}

    for t, o, s, h in boxes(f, 0, len(f)):
        if t != "moof": continue
        for t1, o1, s1, h1 in boxes(f, o + h, o + s):
            if t1 != "traf": continue
            fo, _, _ = find(f, o1 + h1, o1 + s1, "tfhd")
            tflags = u32(f, fo + 8) & 0xFFFFFF; tid = u32(f, fo + 12); p = fo + 16; base = o
            dd, ds, df = trex.get(tid, (0, 0, 0))
            if tflags & 0x1: base = struct.unpack(">Q", f[p:p + 8])[0]; p += 8
            if tflags & 0x2: p += 4
            if tflags & 0x8: dd = u32(f, p); p += 4
            if tflags & 0x10: ds = u32(f, p); p += 4
            if tflags & 0x20: df = u32(f, p); p += 4
            for t3, o3, s3, h3 in boxes(f, o1 + h1, o1 + s1):
                if t3 != "trun": continue
                rflags = u32(f, o3 + 8) & 0xFFFFFF; n = u32(f, o3 + 12); p = o3 + 16
                data_off, first = 0, None
                if rflags & 0x1: data_off = struct.unpack(">i", f[p:p + 4])[0]; p += 4
                if rflags & 0x4: first = u32(f, p); p += 4
                if rflags & 0x800: raise SystemExit("B-frames (composition offsets) worden niet ondersteund")
                pos = base + data_off
                for i in range(n):
                    dur, size, fl = dd, ds, df
                    if rflags & 0x100: dur = u32(f, p); p += 4
                    if rflags & 0x200: size = u32(f, p); p += 4
                    if rflags & 0x400: fl = u32(f, p); p += 4
                    if i == 0 and first is not None: fl = first
                    tracks[tid]["samples"].append((pos, size, dur, not (fl & 0x10000)))
                    pos += size

    # om en om per seconde: lijst van (tijd, track, [samples])
    chunks = []
    for tid, tr in tracks.items():
        t = 0; cur = []; start = 0
        for smp in tr["samples"]:
            if cur and t - start >= tr["ts"]:
                chunks.append((start / tr["ts"], tid, cur)); cur = []; start = t
            cur.append(smp); t += smp[2]
        if cur: chunks.append((start / tr["ts"], tid, cur))
        tr["dur"] = t
    chunks.sort(key=lambda c: (c[0], c[1]))
    movie_ms = max(round(tr["dur"] * 1000 / tr["ts"]) for tr in tracks.values())
    matrix = struct.pack(">9I", 0x10000, 0, 0, 0, 0x10000, 0, 0, 0, 0x40000000)

    def build(data_start):
        off = data_start; offs = {tid: [] for tid in tracks}
        for _, tid, smps in chunks:
            offs[tid].append((off, len(smps))); off += sum(s[1] for s in smps)
        traks = b""
        for tid, tr in tracks.items():
            sm = tr["samples"]; stts_e = []
            for s in sm:
                if stts_e and stts_e[-1][1] == s[2]: stts_e[-1][0] += 1
                else: stts_e.append([1, s[2]])
            stts = full("stts", 0, 0, struct.pack(">I", len(stts_e)) + b"".join(struct.pack(">II", c, d) for c, d in stts_e))
            stsz = full("stsz", 0, 0, struct.pack(">II", 0, len(sm)) + b"".join(struct.pack(">I", s[1]) for s in sm))
            sc = []
            for i, (_, n) in enumerate(offs[tid]):
                if not sc or sc[-1][1] != n: sc.append((i + 1, n))
            stsc = full("stsc", 0, 0, struct.pack(">I", len(sc)) + b"".join(struct.pack(">III", a, n, 1) for a, n in sc))
            stco = full("stco", 0, 0, struct.pack(">I", len(offs[tid])) + b"".join(struct.pack(">I", o) for o, _ in offs[tid]))
            stss = b""
            if tr["kind"] == "vide":
                sync = [i + 1 for i, s in enumerate(sm) if s[3]]
                stss = full("stss", 0, 0, struct.pack(">I", len(sync)) + b"".join(struct.pack(">I", i) for i in sync))
            stbl = box("stbl", tr["stsd"] + stts + stss + stsc + stsz + stco)
            mdhd = full("mdhd", 0, 0, struct.pack(">IIIIHH", 0, 0, tr["ts"], tr["dur"], 0x55C4, 0))
            mdia = box("mdia", mdhd + tr["hdlr"] + box("minf", tr["head"] + stbl))
            ms_ = round(tr["dur"] * 1000 / tr["ts"])
            if tr["kind"] == "vide":
                w, h = struct.unpack(">HH", tr["stsd"][16 + 32:16 + 36]); vol = 0
            else:
                w = h = 0; vol = 0x100
            tkhd = full("tkhd", 0, 3, struct.pack(">IIIII", 0, 0, tid, 0, ms_) + b"\0" * 8 + struct.pack(">hhHH", 0, 0, vol, 0) + matrix + struct.pack(">II", w << 16, h << 16))
            traks += box("trak", tkhd + mdia)
        mvhd = full("mvhd", 0, 0, struct.pack(">IIII", 0, 0, 1000, movie_ms) + struct.pack(">IH", 0x10000, 0x100) + b"\0" * 10 + matrix + b"\0" * 24 + struct.pack(">I", max(tracks) + 1))
        return box("moov", mvhd + traks)

    ftyp = box("ftyp", b"isom" + struct.pack(">I", 0x200) + b"isomiso2avc1mp41")
    data = b"".join(f[s[0]:s[0] + s[1]] for _, _, smps in chunks for s in smps)
    mdat_hdr = struct.pack(">I4s", 8 + len(data), b"mdat")
    moov = build(0); moov = build(len(ftyp) + len(moov) + len(mdat_hdr))
    open(dst, "wb").write(ftyp + moov + mdat_hdr + data)
    for tid, tr in tracks.items():
        print(f"spoor {tid} ({'beeld' if tr['kind'] == 'vide' else 'geluid'}): {len(tr['samples'])} stukjes, {tr['dur'] / tr['ts']:.2f} s")
    print(f"-> {dst} ({(len(ftyp) + len(moov) + len(mdat_hdr) + len(data)) / 1e6:.1f} MB)")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
