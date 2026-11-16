"""Refine the existing terrain preview. Run with terrain-rover-preview-ready.blend open."""
import math
import random
from pathlib import Path

import bpy
from mathutils import Vector, noise

OUT = Path(__file__).resolve().parent
blend = OUT / 'terrain-rover-refined.blend'
overview = OUT / 'terrain-rover-refined-overview.png'
ground = OUT / 'terrain-rover-refined-ground.png'
for path in (blend, overview, ground):
    if path.exists():
        raise FileExistsError(f'Refusing to overwrite {path}')

scene = bpy.data.scenes['Terrain and Rover Preview']
bpy.context.window.scene = scene
rover = list(bpy.data.collections['COL_PreviewCommunityRover'].all_objects)
assert len(rover) == 134, len(rover)
rover_state = {obj.name: (obj.matrix_world.copy(), obj.data, tuple(slot.material for slot in obj.material_slots)) for obj in rover}
assert not any('Cuoi' in obj.name or 'Rabbit' in obj.name for obj in scene.objects)
images = {node.image for obj in scene.objects for slot in obj.material_slots
          if slot.material and slot.material.use_nodes
          for node in slot.material.node_tree.nodes if node.type == 'TEX_IMAGE' and node.image}
missing = [im.name for im in images if not im.packed_file and not Path(bpy.path.abspath(im.filepath)).is_file()]
assert not missing, missing

rng = random.Random(20261116)
craters = [(-4, 5, 4.6, 1.7, .2), (7, 13, 6.8, 2.4, 1.4),
           (-11, 18, 5.4, 1.5, 2.6), (-3, 31, 10, 2.9, .9),
           (20, 31, 11, 3.8, 1.7), (-26, 39, 15, 4.3, 3.8),
           (-11, 8, 1.9, .48, 2.9), (4.5, 5.5, 1.4, .36, 4.2)]
for _ in range(32):
    x, y = rng.uniform(-34, 35), rng.uniform(-16, 68)
    if math.hypot(x, y + 3) > 6:
        radius = rng.uniform(.35, 1.65)
        craters.append((x, y, radius, radius * rng.uniform(.19, .3), rng.uniform(0, 6)))


def height_delta(x, y):
    delta = 0.0
    for cx, cy, radius, depth, phase in craters:
        dx, dy = x - cx, y - cy
        if abs(dx) > radius * 1.65 or abs(dy) > radius * 1.65:
            continue
        angle = math.atan2(dy, dx)
        warp = 1 + .055 * math.sin(angle * 5 + phase) + .028 * math.sin(angle * 11 - phase)
        r = math.hypot(dx, dy) / (radius * warp)
        variation = .055 * math.sin(angle * 7 + phase)
        old_rim = (.23 + variation) * math.exp(-((r - 1.035) / .145) ** 2)
        new_rim = (.14 + variation) * math.exp(-((r - 1.035) / .11) ** 2)
        shoulder = noise.fractal(Vector((dx / radius * 5, dy / radius * 5, phase)), 1, 2, 3)
        delta += depth * (new_rim - old_rim + .06 * shoulder * math.exp(-((r - 1.1) / .3) ** 2))
    flatten = max(0, min(1, (max(abs(x) / 2.7, abs(y + 3) / 3.6) - .76) / .35))
    return delta * flatten


terrain = bpy.data.objects['SM_RegolithTerrain']
for vertex in terrain.data.vertices:
    vertex.co.z += height_delta(vertex.co.x, vertex.co.y)
terrain.data.update()
rocks = [obj for obj in scene.objects if obj.name.startswith('SM_RegolithRock_')]
for obj in rocks:
    obj.location.z += height_delta(obj.location.x, obj.location.y)
for index, data in enumerate(sorted({obj.data for obj in rocks}, key=lambda mesh: mesh.name)):
    for vertex in data.vertices:
        vertex.co *= 1 + .08 * noise.noise_vector(vertex.co * 4.3 + Vector((index, 7, 3)))[0]
    for poly in data.polygons:
        poly.use_smooth = False
    data.update()

for mat in [bpy.data.materials['MAT_PreviewRegolith']] + [bpy.data.materials[f'MAT_PreviewRock_{i:02d}'] for i in range(9)]:
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
    fine_bump = bsdf.inputs['Normal'].links[0].from_node
    coord = next(n for n in nodes if n.type == 'TEX_COORD')
    medium = nodes.new('ShaderNodeTexNoise')
    medium.inputs['Scale'].default_value = 14
    links.new(coord.outputs['Object'], medium.inputs['Vector'])
    bump = nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = .45
    bump.inputs['Distance'].default_value = .025
    links.new(medium.outputs['Fac'], bump.inputs['Height'])
    links.new(bump.outputs['Normal'], fine_bump.inputs['Normal'])

bpy.data.objects['LIGHT_Sun'].rotation_euler = Vector((-1, 1.4, -.45)).to_track_quat('-Z', 'Y').to_euler()
scene.eevee.taa_render_samples = 48
scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = 1440, 900, 100
assert all((obj.matrix_world == rover_state[obj.name][0] and obj.data == rover_state[obj.name][1]
            and tuple(slot.material for slot in obj.material_slots) == rover_state[obj.name][2]) for obj in rover)
scene.camera = bpy.data.objects['CAM_TerrainOverview']
scene.render.filepath = str(overview)
bpy.ops.wm.save_as_mainfile(filepath=str(blend))
bpy.ops.render.render(write_still=True)
scene.camera = bpy.data.objects['CAM_GroundLevel']
scene.render.filepath = str(ground)
bpy.ops.render.render(write_still=True)
