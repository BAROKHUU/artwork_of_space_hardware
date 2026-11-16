"""Export the recovered LRV without changing its Blender source.

Run from the repository: blender --factory-startup -b \
  src/previews/terrain-rover-refined.blend --python src/previews/export_gameplay_assets.py
"""
import json
import hashlib
import math
import struct
import sys
import tempfile
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / 'public/assets/models/lrv.glb'
TRIANGLE_BUDGET = 145_000
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


scene = bpy.data.scenes.new('LRV Browser Export')
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

source_triangles = sum(triangles(obj.data) for obj in export_objects)
for pass_index in range(3):
    total = sum(triangles(obj.data) for obj in export_objects)
    if pass_index and total <= 150_000:
        break
    floor_budget = sum(min(triangles(obj.data), 160) for obj in export_objects)
    ratio = (TRIANGLE_BUDGET - floor_budget) / total
    for obj in export_objects:
        count = triangles(obj.data)
        target = min(count, 160 + math.floor(count * ratio))
        if target < count:
            modifier = obj.modifiers.new('Browser triangle budget', 'DECIMATE')
            modifier.ratio = target / count
            modifier.use_collapse_triangulate = True
            bpy.context.view_layer.objects.active = obj
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        obj.data.validate(clean_customdata=False)
        assert obj.data.vertices and obj.data.polygons, obj.name
    print('LRV_GEOMETRY', pass_index + 1, sum(triangles(obj.data) for obj in export_objects), flush=True)
assert sum(triangles(obj.data) for obj in export_objects) <= source_triangles
print('LRV_LARGEST_MESHES', sorted([(triangles(obj.data), obj.name) for obj in export_objects], reverse=True)[:12], flush=True)

wheels = [obj for obj in export_objects if obj.name.startswith('Wheel -')]
assert len(wheels) == 4
wheel_bounds = vertex_bounds(wheels)
origin = Vector(((wheel_bounds[0][0] + wheel_bounds[1][0]) / 2,
                 (wheel_bounds[0][1] + wheel_bounds[1][1]) / 2,
                 wheel_bounds[0][2]))
# Source front is Blender -Y. Turning it makes standard glTF front local -Z.
normalize = Matrix.Rotation(math.pi, 4, 'Z') @ Matrix.Translation(-origin)
for obj in export_objects:
    obj.data.transform(normalize)
    obj.data.update()

# ponytail: texture rights are unverified; use CC0 authored viewport colors and simple PBR.
def image_maps(tree, seen=None):
    seen = set() if seen is None else seen
    if tree in seen:
        return []
    seen.add(tree)
    result = []
    for node in tree.nodes:
        if node.type == 'TEX_IMAGE' and node.image:
            result.append({'image': node.image.name,
                           'direct_targets': sorted({link.to_node.name + ':' + link.to_socket.name
                                                     for socket in node.outputs for link in socket.links})})
        elif node.type == 'GROUP' and node.node_tree:
            result.extend(image_maps(node.node_tree, seen))
    return result


safe_materials = {}
material_report = []
for obj in export_objects:
    for slot in obj.material_slots:
        original = slot.material
        if original is None:
            continue
        if original not in safe_materials:
            name = original.name.removeprefix('MAT_PreviewRover_')
            material = bpy.data.materials.new('LRV ' + name)
            material.use_nodes = True
            shader = material.node_tree.nodes.get('Principled BSDF')
            source_shader = next((node for node in original.node_tree.nodes
                                  if node.type == 'BSDF_PRINCIPLED'), None) if original.use_nodes else None
            shader.inputs['Base Color'].default_value = original.diffuse_color
            for key, fallback in [('Metallic', .8 if any(word in name for word in ('Metal', 'Foil', 'Wheel_Mesh')) else 0.),
                                  ('Roughness', .75 if any(word in name for word in ('Cloth', 'Fabric', 'Leather')) else .45)]:
                socket = source_shader.inputs[key] if source_shader else None
                shader.inputs[key].default_value = socket.default_value if socket and not socket.is_linked else fallback
            safe_materials[original] = material
            material_report.append({'source_material': original.name, 'export_material': material.name,
                                    'base_color': list(original.diffuse_color),
                                    'metallic': shader.inputs['Metallic'].default_value,
                                    'roughness': shader.inputs['Roughness'].default_value,
                                    'omitted_image_maps': image_maps(original.node_tree) if original.use_nodes else []})
        slot.material = safe_materials[original]

# The static rover needs one draw per material, not one per source part.
static_parts = [obj for obj in export_objects if obj not in wheels]
for obj in static_parts:
    obj.select_set(True)
bpy.context.view_layer.objects.active = static_parts[0]
bpy.ops.object.join()
bpy.context.object.name = 'LRV Static'
export_objects = [bpy.context.object, *wheels]
for obj in scene.objects:
    obj.select_set(True)
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
staging = tempfile.TemporaryDirectory(prefix='lrv-export-', dir=OUTPUT.parent)
export_path = Path(staging.name) / OUTPUT.name
bpy.ops.export_scene.gltf(filepath=str(export_path), export_format='GLB', use_selection=True,
                          export_yup=True, export_apply=False, export_animations=False,
                          export_cameras=False, export_lights=False,
                          export_texcoords=False, export_colors=False,
                          export_extras=False, export_draco_mesh_compression_enable=False)

# A runnable structural check catches missing objects, images, and decoder requirements.
payload = export_path.read_bytes()
magic, version, length = struct.unpack_from('<4sII', payload)
assert (magic, version, length) == (b'glTF', 2, len(payload))
json_length, json_kind = struct.unpack_from('<II', payload, 12)
assert json_kind == 0x4E4F534A
document = json.loads(payload[20:20 + json_length])
assert len(document['nodes']) == len(export_objects), len(document['nodes'])
assert all('mesh' in node for node in document['nodes'])
assert {node['name'] for node in document['nodes']} == {obj.name for obj in export_objects}
assert not document.get('extensionsRequired'), document.get('extensionsRequired')
assert not any(document.get(key) for key in ('images', 'textures', 'samplers'))
assert all('uri' not in buffer for buffer in document['buffers'])
export_triangles = sum(document['accessors'][primitive['indices']]['count'] // 3
                       for mesh in document['meshes'] for primitive in mesh['primitives'])
assert export_triangles <= source_triangles, export_triangles
bounds = vertex_bounds(export_objects)
wheel_bottoms = {obj.name: vertex_bounds([obj])[0][2] for obj in wheels}
assert max(abs(value) for value in wheel_bottoms.values()) < .02, wheel_bottoms
wheel_centres = {}
wheel_radii = {}
for obj in wheels:
    lower, upper = vertex_bounds([obj])
    wheel_centres[obj.name] = [(lower[0] + upper[0]) / 2,
                               (lower[2] + upper[2]) / 2,
                               -(lower[1] + upper[1]) / 2]
    wheel_radii[obj.name] = (upper[2] - lower[2]) / 2
report = {
    'source': 'src/previews/terrain-rover-refined.blend',
    'asset': str(OUTPUT.relative_to(ROOT)),
    'source_objects': len(source), 'source_triangles': source_triangles,
    'triangle_target': 150_000, 'triangle_target_met': export_triangles <= 150_000,
    'nodes': len(document['nodes']), 'meshes': len(document['meshes']),
    'primitives': sum(len(mesh['primitives']) for mesh in document['meshes']),
    'triangles': export_triangles, 'materials': len(document.get('materials', [])),
    'embedded_images': len(document.get('images', [])),
    'bytes': len(payload), 'units': 'metres', 'up': '+Y', 'forward': '-Z',
    'origin': 'centre between four wheel bounds, lowest wheel contact at Y=0',
    'bounds_xyz': [[bounds[0][0], bounds[0][2], -bounds[1][1]],
                   [bounds[1][0], bounds[1][2], -bounds[0][1]]],
    'dimensions_xyz': [bounds[1][0] - bounds[0][0], bounds[1][2] - bounds[0][2],
                       bounds[1][1] - bounds[0][1]],
    'wheel_bottom_y': wheel_bottoms,
    'wheel_centres_xyz': wheel_centres, 'wheel_radius': wheel_radii,
    'source_sha256': source_sha256,
    'texture_policy': 'No source image textures exported; rights unverified. CC0 viewport base colors retained.',
    'material_replacements': material_report,
    'caveats': ['Static model; wheels and suspension are not rigged.',
                'All source image textures omitted: flags, dial labels and fine surface detail are absent.',
                'Authored viewport colors and simple scalar PBR approximate the source material appearance.',
                'All source geometry retained; dense meshes simplified and static parts joined by material for the browser.'],
}
report['static_batching'] = {'source_parts': len(static_parts), 'export_meshes': 1, 'separate_wheels': 4}
report['runtime_span_2_7_scale'] = 2.7 / max(report['dimensions_xyz'])
report['runtime_span_2_7_wheel_centres_xyz'] = {
    name: [value * report['runtime_span_2_7_scale'] for value in centre]
    for name, centre in wheel_centres.items()}
report['runtime_span_2_7_wheel_radius'] = {
    name: value * report['runtime_span_2_7_scale'] for name, value in wheel_radii.items()}
loader_origin = [(report['bounds_xyz'][0][0] + report['bounds_xyz'][1][0]) / 2,
                 report['bounds_xyz'][0][1],
                 (report['bounds_xyz'][0][2] + report['bounds_xyz'][1][2]) / 2]
report['runtime_span_2_7_loader_wheel_centres_xyz'] = {
    name: [(value - loader_origin[axis]) * report['runtime_span_2_7_scale']
           for axis, value in enumerate(centre)] for name, centre in wheel_centres.items()}
bpy.context.window.scene = bpy.data.scenes.new('LRV GLB roundtrip check')
bpy.ops.import_scene.gltf(filepath=str(export_path), import_pack_images=True)
imported = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
assert len(imported) == len(export_objects), len(imported)
assert sum(triangles(obj.data) for obj in imported) == export_triangles
report['roundtrip_meshes'] = len(imported)
assert hashlib.file_digest(source_path.open('rb'), 'sha256').hexdigest() == source_sha256
export_path.with_suffix('.stats.json').write_text(json.dumps(report, indent=2) + '\n')
export_path.replace(OUTPUT)
export_path.with_suffix('.stats.json').replace(OUTPUT.with_suffix('.stats.json'))
staging.cleanup()
print('LRV_EXPORT', json.dumps(report), flush=True)
