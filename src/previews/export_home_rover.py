"""Export the high-detail Home LRV with full-polygon wheels and woven wire-mesh tires.

Run from the repository: blender --factory-startup -b \
  src/previews/terrain-rover-preview.blend --python src/previews/export_home_rover.py -- --replace
"""
import hashlib
import json
import math
import struct
import sys
import tempfile
import zlib
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / 'src/assets/lrv-home.glb'
BODY_TRIANGLE_BUDGET = 140_000
assert not OUTPUT.exists() or '--replace' in sys.argv, 'Use -- --replace for an intentional repeat export.'
source_path = Path(bpy.data.filepath)
source_sha256 = hashlib.file_digest(source_path.open('rb'), 'sha256').hexdigest()
source = sorted(bpy.data.collections['COL_PreviewCommunityRover'].all_objects, key=lambda obj: obj.name)
assert len(source) == 134, f'Expected the complete 134-object rover, got {len(source)}'
assert {obj.type for obj in source} <= {'MESH', 'CURVE'}


def triangles(mesh):
    return sum(len(poly.vertices) - 2 for poly in mesh.polygons)


def vertex_bounds(objects):
    points = [obj.matrix_world @ vertex.co for obj in objects for vertex in obj.data.vertices]
    return [[min(point[axis] for point in points) for axis in range(3)],
            [max(point[axis] for point in points) for axis in range(3)]]


def write_wire_mesh_png(path: Path, size: int = 256) -> None:
    """Write a tileable RGBA woven piano-wire mesh texture (CC0 procedural)."""
    rows = []
    # Fine diagonal criss-cross weave matching Apollo LRV spring-steel wire mesh.
    periods = 5.0
    half_width = 0.22
    for y in range(size):
        row = bytearray([0])
        v = y / size
        for x in range(size):
            u = x / size
            d1 = abs(((u + v) * periods) % 1.0 - 0.5)
            d2 = abs(((u - v) * periods) % 1.0 - 0.5)
            on_a = d1 < half_width
            on_b = d2 < half_width
            if on_a or on_b:
                # Subtle weave shade variation so intersecting strands read as 3D woven wire.
                highlight = 18 if (on_a and on_b) else 0
                shade_a = 1.0 - (d1 / half_width) * 0.25 if on_a else 0.0
                shade_b = 1.0 - (d2 / half_width) * 0.25 if on_b else 0.0
                shade = max(shade_a, shade_b)
                r = min(255, int(58 + 36 * shade + highlight))
                g = min(255, int(60 + 37 * shade + highlight))
                b = min(255, int(65 + 39 * shade + highlight))
                row.extend((r, g, b, 255))
            else:
                row.extend((32, 34, 38, 0))
        rows.append(bytes(row))
    raw = b''.join(rows)

    def chunk(kind: bytes, data: bytes) -> bytes:
        crc = zlib.crc32(kind + data) & 0xFFFFFFFF
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', crc)

    ihdr = struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')
    path.write_bytes(png)


scene = bpy.data.scenes.new('LRV Home Export')
bpy.context.window.scene = scene
unpark = Matrix.Rotation(math.radians(-23), 4, 'Z') @ Matrix.Translation((0, 3, 0))
export_objects = []
for original in source:
    obj = original.copy()
    obj.name = original.name.removeprefix('SM_PreviewRover_')
    obj.data = original.data.copy()
    scene.collection.objects.link(obj)
    obj.matrix_world = unpark @ original.matrix_world
    obj.select_set(False)
    if obj.type == 'CURVE' or obj.modifiers:
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.convert(target='MESH')
        obj = bpy.context.object
        obj.select_set(False)
    obj.data.transform(obj.matrix_world)
    obj.matrix_world = Matrix.Identity(4)
    mesh = bmesh.new()
    mesh.from_mesh(obj.data)
    bmesh.ops.remove_doubles(mesh, verts=list(mesh.verts), dist=.000001)
    mesh.to_mesh(obj.data)
    mesh.free()
    obj.data.validate(clean_customdata=False)
    export_objects.append(obj)

wheels = [obj for obj in export_objects if obj.name.startswith('Wheel -')]
assert len(wheels) == 4
static_parts = [obj for obj in export_objects if obj not in wheels]

# Decimate only static body parts to match gameplay body complexity; keep wheels at 100% polygons.
for pass_index in range(3):
    total = sum(triangles(obj.data) for obj in static_parts)
    if pass_index and total <= BODY_TRIANGLE_BUDGET:
        break
    floor_budget = sum(min(triangles(obj.data), 160) for obj in static_parts)
    ratio = (BODY_TRIANGLE_BUDGET - floor_budget) / total
    for obj in static_parts:
        count = triangles(obj.data)
        floor = 4500 if 'Dust Guard' in obj.name else 160
        target = min(count, floor + math.floor(count * ratio))
        if target < count:
            modifier = obj.modifiers.new('Home body triangle budget', 'DECIMATE')
            modifier.ratio = target / count
            modifier.use_collapse_triangulate = True
            bpy.context.view_layer.objects.active = obj
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        obj.data.validate(clean_customdata=False)
        assert obj.data.vertices and obj.data.polygons, obj.name

# Strip unused UV maps from non-wheel parts and non-Wheel_Mesh polygons to keep GLB compact,
# while scaling Wheel_Mesh UVs by (8, 19) to match the preview mapping density.
for obj in static_parts:
    while obj.data.uv_layers:
        obj.data.uv_layers.remove(obj.data.uv_layers[0])
for obj in wheels:
    wm_indices = {i for i, slot in enumerate(obj.material_slots) if slot.material and 'Wheel_Mesh' in slot.material.name}
    assert wm_indices, obj.name
    uv_layer = obj.data.uv_layers.active
    assert uv_layer is not None, obj.name
    for poly in obj.data.polygons:
        if poly.material_index in wm_indices:
            for li in poly.loop_indices:
                uv = uv_layer.data[li].uv
                uv.x *= 8.0
                uv.y *= 19.0

wheel_bounds = vertex_bounds(wheels)
origin = Vector(((wheel_bounds[0][0] + wheel_bounds[1][0]) / 2,
                 (wheel_bounds[0][1] + wheel_bounds[1][1]) / 2,
                 wheel_bounds[0][2]))
normalize = Matrix.Rotation(math.pi, 4, 'Z') @ Matrix.Translation(-origin)
for obj in export_objects:
    obj.data.transform(normalize)
    obj.data.update()

staging = tempfile.TemporaryDirectory(prefix='lrv-home-export-', dir=OUTPUT.parent)
wire_tex_path = Path(staging.name) / 'wheel_wire_mesh.png'
write_wire_mesh_png(wire_tex_path, size=256)
wire_image = bpy.data.images.load(str(wire_tex_path))
wire_image.pack()

safe_materials = {}
for obj in export_objects:
    for slot in obj.material_slots:
        original = slot.material
        if original is None:
            continue
        if original not in safe_materials:
            name = original.name.removeprefix('MAT_PreviewRover_')
            material = bpy.data.materials.new('LRV ' + name)
            material.use_nodes = True
            nodes = material.node_tree.nodes
            links = material.node_tree.links
            shader = nodes.get('Principled BSDF')
            if 'Wheel_Mesh' in name:
                tex = nodes.new('ShaderNodeTexImage')
                tex.image = wire_image
                tex.extension = 'REPEAT'
                links.new(tex.outputs['Color'], shader.inputs['Base Color'])
                links.new(tex.outputs['Alpha'], shader.inputs['Alpha'])
                shader.inputs['Metallic'].default_value = 0.72
                shader.inputs['Roughness'].default_value = 0.42
                material.blend_method = 'CLIP'
                material.alpha_threshold = 0.5
                material.use_backface_culling = False
            else:
                source_shader = next((node for node in original.node_tree.nodes
                                      if node.type == 'BSDF_PRINCIPLED'), None) if original.use_nodes else None
                shader.inputs['Base Color'].default_value = original.diffuse_color
                for key, fallback in [('Metallic', .8 if any(word in name for word in ('Metal', 'Foil')) else 0.),
                                      ('Roughness', .75 if any(word in name for word in ('Cloth', 'Fabric', 'Leather')) else .45)]:
                    socket = source_shader.inputs[key] if source_shader else None
                    shader.inputs[key].default_value = socket.default_value if socket and not socket.is_linked else fallback
            safe_materials[original] = material
        slot.material = safe_materials[original]

for obj in static_parts:
    obj.select_set(True)
bpy.context.view_layer.objects.active = static_parts[0]
bpy.ops.object.join()
bpy.context.object.name = 'LRV Static'
export_objects = [bpy.context.object, *wheels]
for obj in scene.objects:
    obj.select_set(True)

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
export_path = Path(staging.name) / OUTPUT.name
bpy.ops.export_scene.gltf(filepath=str(export_path), export_format='GLB', use_selection=True,
                          export_yup=True, export_apply=False, export_animations=False,
                          export_cameras=False, export_lights=False,
                          export_texcoords=True, export_colors=False,
                          export_extras=False, export_draco_mesh_compression_enable=False)

payload = export_path.read_bytes()
magic, version, length = struct.unpack_from('<4sII', payload)
assert (magic, version, length) == (b'glTF', 2, len(payload))
json_length, json_kind = struct.unpack_from('<II', payload, 12)
assert json_kind == 0x4E4F534A
document = json.loads(payload[20:20 + json_length])
assert len(document['nodes']) == len(export_objects), len(document['nodes'])
export_triangles = sum(document['accessors'][primitive['indices']]['count'] // 3
                       for mesh in document['meshes'] for primitive in mesh['primitives'])
wheel_tris = {obj.name: triangles(obj.data) for obj in wheels}
report = {
    'source': str(source_path.name),
    'asset': str(OUTPUT.relative_to(ROOT)),
    'triangles': export_triangles,
    'wheel_triangles': wheel_tris,
    'bytes': len(payload),
    'embedded_images': len(document.get('images', [])),
    'source_sha256': source_sha256,
}
export_path.replace(OUTPUT)
staging.cleanup()
print('LRV_HOME_EXPORT', json.dumps(report), flush=True)
