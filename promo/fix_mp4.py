"""Zet de MP4 van Chrome (gefragmenteerd, met een verkeerde lengte in de kop) om naar een gewone MP4.

De beelden zelf blijven ongewijzigd: alleen de verpakking wordt opnieuw gemaakt, met de index vooraan
(zodat de video op social media en in elke speler meteen goed start).
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


def main(src, dst):
    f = open(src, "rb").read()
    mo, ms, mh = find(f, 0, len(f), "moov")
    to, ts_, th = find(f, mo + mh, mo + ms, "trak")
    mdo, mds, mdh = find(f, to + th, to + ts_, "mdia")
    mdhd_o, _, _ = find(f, mdo + mdh, mdo + mds, "mdhd")
    v = f[mdhd_o + 8]
    timescale = struct.unpack(">I", f[mdhd_o + 20:mdhd_o + 24] if v == 0 else f[mdhd_o + 28:mdhd_o + 32])[0]
    hdlr_o, hdlr_s, _ = find(f, mdo + mdh, mdo + mds, "hdlr")
    mi_o, mi_s, mi_h = find(f, mdo + mdh, mdo + mds, "minf")
    vmhd_o, vmhd_s, _ = find(f, mi_o + mi_h, mi_o + mi_s, "vmhd")
    dinf_o, dinf_s, _ = find(f, mi_o + mi_h, mi_o + mi_s, "dinf")
    st_o, st_s, st_h = find(f, mi_o + mi_h, mi_o + mi_s, "stbl")
    stsd_o, stsd_s, _ = find(f, st_o + st_h, st_o + st_s, "stsd")
    # standaardwaarden uit trex
    trex_dur = trex_size = trex_flags = 0
    try:
        mv_o, mv_s, mv_h = find(f, mo + mh, mo + ms, "mvex")
        tr_o, _, _ = find(f, mv_o + mv_h, mv_o + mv_s, "trex")
        _, _, trex_dur, trex_size, trex_flags = struct.unpack(">IIIII", f[tr_o + 12:tr_o + 32])
    except KeyError: pass

    samples = []   # (data, duur, sync)
    for t, o, s, h in boxes(f, 0, len(f)):
        if t != "moof": continue
        tf_o, tf_s, tf_h = find(f, o + h, o + s, "traf")
        fo, fs, fh = find(f, tf_o + tf_h, tf_o + tf_s, "tfhd")
        tflags = struct.unpack(">I", f[fo + 8:fo + 12])[0] & 0xFFFFFF
        p = fo + 16; base = o
        d_dur, d_size, d_flags = trex_dur, trex_size, trex_flags
        if tflags & 0x1: base = struct.unpack(">Q", f[p:p + 8])[0]; p += 8
        if tflags & 0x2: p += 4
        if tflags & 0x8: d_dur = struct.unpack(">I", f[p:p + 4])[0]; p += 4
        if tflags & 0x10: d_size = struct.unpack(">I", f[p:p + 4])[0]; p += 4
        if tflags & 0x20: d_flags = struct.unpack(">I", f[p:p + 4])[0]; p += 4
        for t3, o3, s3, h3 in boxes(f, tf_o + tf_h, tf_o + tf_s):
            if t3 != "trun": continue
            vf = struct.unpack(">I", f[o3 + 8:o3 + 12])[0]; rflags = vf & 0xFFFFFF
            n = struct.unpack(">I", f[o3 + 12:o3 + 16])[0]; p = o3 + 16
            data_off = 0; first_flags = None
            if rflags & 0x1: data_off = struct.unpack(">i", f[p:p + 4])[0]; p += 4
            if rflags & 0x4: first_flags = struct.unpack(">I", f[p:p + 4])[0]; p += 4
            if rflags & 0x800: raise SystemExit("B-frames (composition offsets) worden niet ondersteund")
            pos = base + data_off
            for i in range(n):
                dur, size, fl = d_dur, d_size, d_flags
                if rflags & 0x100: dur = struct.unpack(">I", f[p:p + 4])[0]; p += 4
                if rflags & 0x200: size = struct.unpack(">I", f[p:p + 4])[0]; p += 4
                if rflags & 0x400: fl = struct.unpack(">I", f[p:p + 4])[0]; p += 4
                if i == 0 and first_flags is not None: fl = first_flags
                samples.append((f[pos:pos + size], dur, not (fl & 0x10000)))
                pos += size

    total = sum(s[1] for s in samples); ms_dur = round(total * 1000 / timescale)
    stsd = f[stsd_o:stsd_o + stsd_s]
    avc = stsd[16:]   # eerste sample entry: breedte en hoogte staan op vaste plekken
    width, height = struct.unpack(">HH", avc[8 + 24:8 + 28])

    stts_e = []
    for _, d, _ in samples:
        if stts_e and stts_e[-1][1] == d: stts_e[-1][0] += 1
        else: stts_e.append([1, d])
    stts = full("stts", 0, 0, struct.pack(">I", len(stts_e)) + b"".join(struct.pack(">II", c, d) for c, d in stts_e))
    sync = [i + 1 for i, s in enumerate(samples) if s[2]]
    stss = full("stss", 0, 0, struct.pack(">I", len(sync)) + b"".join(struct.pack(">I", i) for i in sync))
    stsz = full("stsz", 0, 0, struct.pack(">II", 0, len(samples)) + b"".join(struct.pack(">I", len(s[0])) for s in samples))
    stsc = full("stsc", 0, 0, struct.pack(">IIII", 1, 1, len(samples), 1))
    matrix = struct.pack(">9I", 0x10000, 0, 0, 0, 0x10000, 0, 0, 0, 0x40000000)

    def build(chunk_off):
        stco = full("stco", 0, 0, struct.pack(">II", 1, chunk_off))
        stbl = box("stbl", stsd + stts + stss + stsc + stsz + stco)
        minf = box("minf", f[vmhd_o:vmhd_o + vmhd_s] + f[dinf_o:dinf_o + dinf_s] + stbl)
        mdhd = full("mdhd", 0, 0, struct.pack(">IIIIHH", 0, 0, timescale, total, 0x55C4, 0))
        mdia = box("mdia", mdhd + f[hdlr_o:hdlr_o + hdlr_s] + minf)
        tkhd = full("tkhd", 0, 3, struct.pack(">IIIII", 0, 0, 1, 0, ms_dur) + b"\0" * 8 + struct.pack(">hhhH", 0, 0, 0, 0) + matrix + struct.pack(">II", width << 16, height << 16))
        trak = box("trak", tkhd + mdia)
        mvhd = full("mvhd", 0, 0, struct.pack(">IIII", 0, 0, 1000, ms_dur) + struct.pack(">IH", 0x10000, 0x100) + b"\0" * 10 + matrix + b"\0" * 24 + struct.pack(">I", 2))
        return box("moov", mvhd + trak)

    ftyp = box("ftyp", b"isom" + struct.pack(">I", 0x200) + b"isomiso2avc1mp41")
    moov = build(0)
    data = b"".join(s[0] for s in samples)
    mdat_hdr = struct.pack(">I4s", 8 + len(data), b"mdat")
    moov = build(len(ftyp) + len(moov) + len(mdat_hdr))
    open(dst, "wb").write(ftyp + moov + mdat_hdr + data)
    print(f"{len(samples)} beelden, {total / timescale:.2f} s, {width}x{height}, {len(sync)} sleutelbeelden -> {dst}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
