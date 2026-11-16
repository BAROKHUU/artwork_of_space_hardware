"""Replace the LRV high-gain antenna's wire mesh with a smooth umbrella surface.

The Blender export keeps the antenna as a decimated wire mesh ("LRV Metal - Mesh"): about 137k tiny
triangles with scattered normals, more than half of the whole model. In WebGL it renders as black and
white speckle and costs most of the file size. This script fits the same umbrella (paraboloid depth,
centre, axis and scalloped 12-rib rim) and swaps in a ~2k-triangle surface, then repacks the buffer.

Run after `export_gameplay_assets.py` (needs only Python 3 and numpy, no Blender):

    python3 src/previews/fix_lrv_dish.py public/assets/models/lrv.glb
"""
import json
import struct
import sys

import numpy as np

MATERIAL = 'LRV Metal - Mesh'
RINGS = 16      # radial subdivisions
SEGMENTS = 144  # angular subdivisions, a multiple of the 12 ribs
RIM_BINS = 360
PROFILE_STEP = 0.0125  # metres per radial band when measuring the dish depth

CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}


def read_glb(path):
    data = open(path, 'rb').read()
    json_len = struct.unpack('<I', data[12:16])[0]
    doc = json.loads(data[20:20 + json_len])
    o = 20 + json_len
    bin_len = struct.unpack('<I', data[o:o + 4])[0]
    return doc, data[o + 8:o + 8 + bin_len]


def accessor(doc, buf, index):
    a = doc['accessors'][index]
    view = doc['bufferViews'][a['bufferView']]
    n, dt = NC[a['type']], CT[a['componentType']]
    size = n * np.dtype(dt).itemsize
    off = view.get('byteOffset', 0) + a.get('byteOffset', 0)
    stride = view.get('byteStride') or size
    raw = np.frombuffer(buf, np.uint8, count=stride * (a['count'] - 1) + size, offset=off)
    rows = np.lib.stride_tricks.as_strided(raw, (a['count'], size), (stride, 1)).copy()
    return rows.view(dt).reshape(a['count'], n) if n > 1 else rows.view(dt).reshape(-1)


def fit_umbrella(points):
    centre = points.mean(0)
    rel = points - centre
    _, vecs = np.linalg.eigh(np.cov(rel.T))
    axis, u = vecs[:, 0], vecs[:, 2]
    v = np.cross(axis, u)
    height = rel @ axis
    pu, pv = rel @ u, rel @ v
    rho = np.hypot(pu, pv)
    # Measured depth profile (mean height per radial band), so the hub and feed still sit on the surface.
    edges = np.arange(0, rho.max() + PROFILE_STEP, PROFILE_STEP)
    band = np.digitize(rho, edges) - 1
    filled = [i for i in range(len(edges) - 1) if (band == i).any()]
    radii = np.array([rho[band == i].mean() for i in filled])
    heights = np.array([height[band == i].mean() for i in filled])
    theta = np.arctan2(pv, pu)
    bins = ((theta + np.pi) / (2 * np.pi) * RIM_BINS).astype(int) % RIM_BINS
    rim = np.zeros(RIM_BINS)
    np.maximum.at(rim, bins, rho)
    rim = np.where(rim > 0, rim, rho.max())
    return centre, axis, u, v, (radii, heights), rim


def build_surface(centre, axis, u, v, profile, rim):
    depth = lambda r: np.interp(r, *profile)
    angles = -np.pi + (np.arange(SEGMENTS) + 0.5) * 2 * np.pi / SEGMENTS
    rim_at = rim[((angles + np.pi) / (2 * np.pi) * RIM_BINS).astype(int) % RIM_BINS]
    positions = [centre + axis * depth(0.0)]
    for ring in range(1, RINGS + 1):
        r = rim_at * ring / RINGS
        for s, a in enumerate(angles):
            positions.append(centre + axis * depth(r[s]) + r[s] * (np.cos(a) * u + np.sin(a) * v))
    positions = np.array(positions, np.float32)
    ring_start = lambda ring: 1 + (ring - 1) * SEGMENTS
    tris = []
    for s in range(SEGMENTS):
        tris.append((0, ring_start(1) + s, ring_start(1) + (s + 1) % SEGMENTS))
    for ring in range(1, RINGS):
        a0, b0 = ring_start(ring), ring_start(ring + 1)
        for s in range(SEGMENTS):
            s1 = (s + 1) % SEGMENTS
            tris += [(a0 + s, b0 + s, b0 + s1), (a0 + s, b0 + s1, a0 + s1)]
    tris = np.array(tris, np.uint16)
    face = np.cross(positions[tris[:, 1]] - positions[tris[:, 0]], positions[tris[:, 2]] - positions[tris[:, 0]])
    normals = np.zeros_like(positions)
    for k in range(3):
        np.add.at(normals, tris[:, k], face)
    normals /= np.linalg.norm(normals, axis=1, keepdims=True)
    return positions, normals.astype(np.float32), tris


def repack(doc, buf, extra):
    """Rebuilds the binary chunk with only the views that accessors and images still use, plus `extra` arrays."""
    if any('sparse' in a for a in doc['accessors']) or doc.get('extensionsUsed'):
        sys.exit('sparse accessors or glTF extensions may reference buffer views; repack them with gltf-transform instead')
    images = [im for im in doc.get('images', []) if 'bufferView' in im]
    used = sorted({doc['accessors'][i]['bufferView'] for i in live_accessors(doc)} | {im['bufferView'] for im in images})
    out, views, remap_view = bytearray(), [], {}
    for old in used:
        view = dict(doc['bufferViews'][old])
        chunk = buf[view.get('byteOffset', 0):view.get('byteOffset', 0) + view['byteLength']]
        view['byteOffset'] = len(out)
        out += chunk + b'\0' * (-len(chunk) % 4)
        remap_view[old] = len(views)
        views.append(view)
    # Embedded textures (the home rover's wheel wire mesh) point at views too; without this they decode garbage.
    for im in images:
        im['bufferView'] = remap_view[im['bufferView']]
    live = live_accessors(doc)
    remap_acc = {old: new for new, old in enumerate(live)}
    accessors = []
    for old in live:
        a = dict(doc['accessors'][old])
        a['bufferView'] = remap_view[a['bufferView']]
        accessors.append(a)
    for key, (array, meta) in extra.items():
        raw = array.tobytes()
        views.append({'buffer': 0, 'byteOffset': len(out), 'byteLength': len(raw), **({'target': meta.pop('target')} if 'target' in meta else {})})
        out += raw + b'\0' * (-len(raw) % 4)
        accessors.append({'bufferView': len(views) - 1, **meta})
        remap_acc[key] = len(accessors) - 1
    for mesh in doc['meshes']:
        for prim in mesh['primitives']:
            prim['attributes'] = {k: remap_acc[i] for k, i in prim['attributes'].items()}
            prim['indices'] = remap_acc[prim['indices']]
    doc['accessors'], doc['bufferViews'] = accessors, views
    doc['buffers'] = [{'byteLength': len(out)}]
    return bytes(out)


def live_accessors(doc):
    seen = []
    for mesh in doc['meshes']:
        for prim in mesh['primitives']:
            for i in [*prim['attributes'].values(), prim['indices']]:
                if isinstance(i, int) and i not in seen:
                    seen.append(i)
    return sorted(seen)


def write_glb(path, doc, buf):
    text = json.dumps(doc, separators=(',', ':')).encode()
    text += b' ' * (-len(text) % 4)
    total = 12 + 8 + len(text) + 8 + len(buf)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, total))
        f.write(struct.pack('<II', len(text), 0x4E4F534A) + text)
        f.write(struct.pack('<II', len(buf), 0x004E4942) + buf)


def main(path):
    doc, buf = read_glb(path)
    material = next(i for i, m in enumerate(doc['materials']) if m.get('name') == MATERIAL)
    prims = [p for mesh in doc['meshes'] for p in mesh['primitives'] if p.get('material') == material]
    if len(prims) != 1:
        sys.exit(f'expected one "{MATERIAL}" primitive, found {len(prims)}')
    prim = prims[0]
    before = doc['accessors'][prim['indices']]['count'] // 3
    positions, normals, tris = build_surface(*fit_umbrella(accessor(doc, buf, prim['attributes']['POSITION']).astype(float)))
    prim['attributes'] = {'POSITION': 'dish:pos', 'NORMAL': 'dish:nrm'}
    prim['indices'] = 'dish:idx'
    prim.pop('mode', None)
    extra = {
        'dish:pos': (positions, {'componentType': 5126, 'count': len(positions), 'type': 'VEC3', 'min': positions.min(0).tolist(), 'max': positions.max(0).tolist(), 'target': 34962}),
        'dish:nrm': (normals, {'componentType': 5126, 'count': len(normals), 'type': 'VEC3', 'target': 34962}),
        'dish:idx': (tris.reshape(-1), {'componentType': 5123, 'count': tris.size, 'type': 'SCALAR', 'target': 34963}),
    }
    # The live accessors are collected before the dish placeholders resolve, so skip the string keys there.
    packed = repack(doc, buf, extra)
    # A smooth, matte off-white reads as the antenna's fine mesh; at 0.8 metalness it went near black without an env map.
    pbr = doc['materials'][material].setdefault('pbrMetallicRoughness', {})
    pbr.update({'baseColorFactor': [0.86, 0.86, 0.84, 1], 'metallicFactor': 0.3, 'roughnessFactor': 0.6})
    doc['materials'][material]['doubleSided'] = True
    write_glb(path, doc, packed)
    print(f'{MATERIAL}: {before} -> {len(tris)} triangles; binary {len(buf)} -> {len(packed)} bytes')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'public/assets/models/lrv.glb')
