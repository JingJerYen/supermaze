"""Procedural ghost placeholder. Usage: python3 scripts/ghost_gen.py apps/client/public/models/ghost.glb preview.svg"""
import json, math, struct, sys

def norm(v):
    l = math.sqrt(sum(c * c for c in v)) or 1.0
    return [c / l for c in v]

class Mesh:
    def __init__(self): self.pos = []; self.nrm = []; self.idx = []
    def add_tri(self, a, b, c): self.idx += [a, b, c]

def body(seg=40, rows=26):
    m = Mesh()
    top_y, cap_r, cap_cy = 1.0, 0.40, 0.60
    hem_y, waves, wave_amp = 0.06, 6, 0.045
    # rows 0..rows-1 from apex to hem; the apex is a ring of coincident points (fine for lighting).
    for i in range(rows):
        t = i / (rows - 1)
        if t <= 0.42:
            a = (t / 0.42) * math.pi / 2
            y = cap_cy + cap_r * math.cos(a); r = cap_r * math.sin(a)
        else:
            u = (t - 0.42) / 0.58
            y = cap_cy - (cap_cy - hem_y) * u
            r = cap_r - 0.05 * u + 0.03 * u * u  # slight taper, small flare at the hem
        wave_s = max(0.0, (t - 0.7) / 0.3) ** 2
        for j in range(seg):
            th = j / seg * math.pi * 2
            yy = y + wave_s * wave_amp * math.sin(waves * th)
            m.pos.append([r * math.sin(th), yy, r * math.cos(th)])
    # normals by averaging face normals later
    for i in range(rows - 1):
        for j in range(seg):
            a = i * seg + j; b = i * seg + (j + 1) % seg
            c = (i + 1) * seg + j; d = (i + 1) * seg + (j + 1) % seg
            m.add_tri(a, c, b); m.add_tri(b, c, d)
    smooth_normals(m)
    # fix the apex normals (degenerate ring) to straight up
    for j in range(seg): m.nrm[j] = [0.0, 1.0, 0.0]
    return m

def smooth_normals(m):
    acc = [[0.0, 0.0, 0.0] for _ in m.pos]
    for k in range(0, len(m.idx), 3):
        a, b, c = (m.pos[m.idx[k + i]] for i in range(3))
        u = [b[i] - a[i] for i in range(3)]; v = [c[i] - a[i] for i in range(3)]
        n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
        for i in range(3):
            for q in range(3): acc[m.idx[k + i]][q] += n[q]
    m.nrm = [norm(n) for n in acc]

def ellipsoid(cx, cy, cz, rx, ry, rz, seg=18, rings=12, tilt=0.0):
    m = Mesh()
    ct, st = math.cos(tilt), math.sin(tilt)
    for i in range(rings + 1):
        ph = i / rings * math.pi
        for j in range(seg):
            th = j / seg * math.pi * 2
            x, y, z = math.sin(ph) * math.cos(th), math.cos(ph), math.sin(ph) * math.sin(th)
            px, py, pz = rx * x, ry * y, rz * z
            nx, ny, nz = norm([x / rx, y / ry, z / rz])
            # tilt about z axis (raise the outer end of an arm)
            px, py = px * ct - py * st, px * st + py * ct
            nx, ny = nx * ct - ny * st, nx * st + ny * ct
            m.pos.append([cx + px, cy + py, cz + pz]); m.nrm.append([nx, ny, nz])
    for i in range(rings):
        for j in range(seg):
            a = i * seg + j; b = i * seg + (j + 1) % seg
            c = (i + 1) * seg + j; d = (i + 1) * seg + (j + 1) % seg
            m.add_tri(a, b, c); m.add_tri(b, d, c)
    return m

def merge(*ms):
    out = Mesh()
    for m in ms:
        off = len(out.pos)
        out.pos += m.pos; out.nrm += m.nrm; out.idx += [i + off for i in m.idx]
    return out

BODY = merge(body(), ellipsoid(-0.40, 0.44, 0.04, 0.15, 0.085, 0.085, tilt=0.35), ellipsoid(0.40, 0.44, 0.04, 0.15, 0.085, 0.085, tilt=-0.35))
face_z = 0.385
EYES = merge(ellipsoid(-0.13, 0.70, face_z, 0.075, 0.095, 0.05), ellipsoid(0.13, 0.70, face_z, 0.075, 0.095, 0.05),
             ellipsoid(0.0, 0.535, face_z + 0.012, 0.05, 0.06, 0.035))
GLINT = merge(ellipsoid(-0.105, 0.725, face_z + 0.035, 0.022, 0.022, 0.015), ellipsoid(0.155, 0.725, face_z + 0.035, 0.022, 0.022, 0.015))

materials = [
    {"name": "ghostBody", "pbrMetallicRoughness": {"baseColorFactor": [0.90, 0.95, 1.0, 1.0], "metallicFactor": 0.0, "roughnessFactor": 0.85},
     "emissiveFactor": [0.10, 0.13, 0.20], "doubleSided": True},
    {"name": "ghostEyes", "pbrMetallicRoughness": {"baseColorFactor": [0.08, 0.09, 0.13, 1.0], "metallicFactor": 0.0, "roughnessFactor": 0.5}},
    {"name": "ghostGlint", "pbrMetallicRoughness": {"baseColorFactor": [1.0, 1.0, 1.0, 1.0], "metallicFactor": 0.0, "roughnessFactor": 0.3}, "emissiveFactor": [0.6, 0.6, 0.6]},
]
parts = [("body", BODY, 0), ("eyes", EYES, 1), ("glint", GLINT, 2)]

def write_glb(path):
    bin_data = bytearray(); views = []; accessors = []; meshes = []; nodes = []
    def add_view(data, target):
        while len(bin_data) % 4: bin_data.append(0)
        views.append({"buffer": 0, "byteOffset": len(bin_data), "byteLength": len(data), "target": target})
        bin_data.extend(data); return len(views) - 1
    for name, m, mat in parts:
        pos = struct.pack(f"<{len(m.pos)*3}f", *[c for p in m.pos for c in p])
        nrm = struct.pack(f"<{len(m.nrm)*3}f", *[c for n in m.nrm for c in n])
        idx = struct.pack(f"<{len(m.idx)}H", *m.idx)
        pv, nv, iv = add_view(pos, 34962), add_view(nrm, 34962), add_view(idx, 34963)
        mins = [min(p[i] for p in m.pos) for i in range(3)]; maxs = [max(p[i] for p in m.pos) for i in range(3)]
        accessors.append({"bufferView": pv, "componentType": 5126, "count": len(m.pos), "type": "VEC3", "min": mins, "max": maxs})
        accessors.append({"bufferView": nv, "componentType": 5126, "count": len(m.nrm), "type": "VEC3"})
        accessors.append({"bufferView": iv, "componentType": 5123, "count": len(m.idx), "type": "SCALAR"})
        a = len(accessors) - 3
        meshes.append({"name": name, "primitives": [{"attributes": {"POSITION": a, "NORMAL": a + 1}, "indices": a + 2, "material": mat}]})
        nodes.append({"name": name, "mesh": len(meshes) - 1})
    gltf = {"asset": {"version": "2.0", "generator": "supermaze ghost_gen.py"}, "scene": 0,
            "scenes": [{"name": "ghost", "nodes": list(range(len(nodes)))}], "nodes": nodes, "meshes": meshes,
            "materials": materials, "accessors": accessors, "bufferViews": views, "buffers": [{"byteLength": len(bin_data)}]}
    js = json.dumps(gltf, separators=(",", ":")).encode()
    while len(js) % 4: js += b" "
    while len(bin_data) % 4: bin_data.append(0)
    total = 12 + 8 + len(js) + 8 + len(bin_data)
    with open(path, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, total))
        f.write(struct.pack("<II", len(js), 0x4E4F534A)); f.write(js)
        f.write(struct.pack("<II", len(bin_data), 0x004E4942)); f.write(bin_data)
    print("wrote", path, total, "bytes;", sum(len(m.idx) // 3 for _, m, _ in parts), "triangles")

def preview(path, yaw=0.6, pitch=0.35, size=420):
    """Painter's-algorithm render to SVG: orthographic view, Lambert shading."""
    cy, sy, cp, sp = math.cos(yaw), math.sin(yaw), math.cos(pitch), math.sin(pitch)
    light = norm([0.4, 0.8, 0.5])
    cols = [(0.90, 0.95, 1.0), (0.08, 0.09, 0.13), (1, 1, 1)]
    tris = []
    for _, m, mat in parts:
        for k in range(0, len(m.idx), 3):
            ps = [m.pos[m.idx[k + i]] for i in range(3)]
            ns = [m.nrm[m.idx[k + i]] for i in range(3)]
            proj = []
            for x, y, z in ps:
                xr, zr = x * cy - z * sy, x * sy + z * cy
                yr, zr2 = y * cp - zr * sp, y * sp + zr * cp
                proj.append((xr, yr, zr2))
            n = [sum(nn[i] for nn in ns) / 3 for i in range(3)]
            nx, nz = n[0] * cy - n[2] * sy, n[0] * sy + n[2] * cy
            ny, nz2 = n[1] * cp - nz * sp, n[1] * sp + nz * cp
            if nz2 < -0.2 and mat == 0 and False: continue
            lam = max(0.0, sum(a * b for a, b in zip(norm([nx, ny, nz2]), light)))
            shade = 0.35 + 0.65 * lam
            base = cols[mat]
            c = "#%02x%02x%02x" % tuple(int(255 * min(1, base[i] * shade + (0.1 if mat == 0 else 0))) for i in range(3))
            depth = sum(p[2] for p in proj) / 3
            tris.append((depth, proj, c))
    tris.sort(key=lambda t: t[0])
    sc = size * 0.75
    def X(p): return size / 2 + p[0] * sc
    def Y(p): return size * 0.92 - p[1] * sc
    polys = "".join(f'<polygon points="{X(a):.1f},{Y(a):.1f} {X(b):.1f},{Y(b):.1f} {X(c):.1f},{Y(c):.1f}" fill="{col}" stroke="{col}" stroke-width="0.4"/>' for _, (a, b, c), col in tris)
    with open(path, "w") as f:
        f.write(f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}"><rect width="{size}" height="{size}" fill="#1a2436"/>{polys}</svg>')

write_glb(sys.argv[1]); preview(sys.argv[2])
