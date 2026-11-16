"""Isolated local preview; run inside the already inspected Blender session."""
import bpy
import json
import math
import random
from pathlib import Path
from mathutils import Matrix, Vector, noise

OUT = Path('/home/hwan/Documents/NASA_HACKATHON/previews')
TEXTURES = OUT.parent / 'NASA Lunar Rover - Blender Model/NASA Lunar Rover for Blender/textures'
assert not (OUT / 'terrain-rover-preview.blend').exists(), 'Preserve existing preview; choose a new output name.'
rng = random.Random(20261116)
source = bpy.data.collections['Lunar Rover']
scene = bpy.data.scenes.new('Terrain and Rover Preview')
bpy.context.window.scene = scene
root = bpy.data.collections.new('COL_TerrainRoverPreview')
scene.collection.children.link(root)


def mesh(name, verts, faces, mat):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    obj = bpy.data.objects.new('SM_' + name, data)
    root.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def surface(name, low, high, scale, grain):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Roughness'].default_value = .94
    coord = nodes.new('ShaderNodeTexCoord')
    broad = nodes.new('ShaderNodeTexNoise')
    broad.inputs['Scale'].default_value = scale
    broad.inputs['Detail'].default_value = 5
    broad.inputs['Roughness'].default_value = .78
    links.new(coord.outputs['Generated'], broad.inputs['Vector'])
    ramp = nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = (*low, 1)
    ramp.color_ramp.elements[1].color = (*high, 1)
    links.new(broad.outputs['Fac'], ramp.inputs[0])
    links.new(ramp.outputs[0], bsdf.inputs['Base Color'])
    fine = nodes.new('ShaderNodeTexNoise')
    fine.inputs['Scale'].default_value = grain
    fine.inputs['Detail'].default_value = 3
    links.new(coord.outputs['Object'], fine.inputs['Vector'])
    bump = nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = .38
    bump.inputs['Distance'].default_value = .008
    links.new(fine.outputs['Fac'], bump.inputs['Height'])
    links.new(bump.outputs[0], bsdf.inputs['Normal'])
    return mat


regolith = surface('MAT_PreviewRegolith', (.115, .112, .108), (.23, .225, .215), 38, 210)
craters = [(-4, 5, 4.6, 1.7, .2), (7, 13, 6.8, 2.4, 1.4),
           (-11, 18, 5.4, 1.5, 2.6), (-3, 31, 10, 2.9, .9),
           (20, 31, 11, 3.8, 1.7), (-26, 39, 15, 4.3, 3.8),
           (-11, 8, 1.9, .48, 2.9), (4.5, 5.5, 1.4, .36, 4.2)]
for _ in range(32):
    x, y = rng.uniform(-34, 35), rng.uniform(-16, 68)
    if math.hypot(x, y + 3) > 6:
        radius = rng.uniform(.35, 1.65)
        craters.append((x, y, radius, radius * rng.uniform(.19, .3), rng.uniform(0, 6)))


def height(x, y):
    z = .17 * noise.fractal(Vector((x * .1, y * .1, 4.2)), 1, 2, 4)
    z += .025 * noise.noise_vector(Vector((x * 2.8, y * 2.8, 2.5)))[0]
    z += .006 * noise.noise_vector(Vector((x * 12, y * 12, 9)))[1]
    for cx, cy, radius, depth, phase in craters:
        dx, dy = x - cx, y - cy
        if abs(dx) > radius * 1.65 or abs(dy) > radius * 1.65:
            continue
        angle = math.atan2(dy, dx)
        warp = 1 + .055 * math.sin(angle * 5 + phase) + .028 * math.sin(angle * 11 - phase)
        r = math.hypot(dx, dy) / (radius * warp)
        if r < 1:
            z -= depth * (1 - r * r) ** 1.35
        rim = depth * (.23 + .055 * math.sin(angle * 7 + phase))
        z += rim * math.exp(-((r - 1.035) / .145) ** 2)
        # Broken ejecta shoulders; no regular parallel ripple pattern.
        shoulder = noise.fractal(Vector((dx / radius * 5, dy / radius * 5, phase)), 1, 2, 3)
        z += .12 * depth * shoulder * math.exp(-((r - 1.1) / .3) ** 2)
    z += 3.4 * math.exp(-((y - 79) / 12) ** 2) * (.62 + .18 * math.sin(x * .17) + .14 * math.sin(x * .37))
    # ponytail: level only the parked rover footprint; driving terrain needs collision validation later.
    flatten = max(0, min(1, (max(abs(x) / 2.7, abs(y + 3) / 3.6) - .76) / .35))
    return z * flatten


nx, ny = 441, 581
verts = [(-55 + i * .25, -45 + j * .25, height(-55 + i * .25, -45 + j * .25))
         for j in range(ny) for i in range(nx)]
faces = [(j * nx + i, j * nx + i + 1, (j + 1) * nx + i + 1, (j + 1) * nx + i)
         for j in range(ny - 1) for i in range(nx - 1)]
terrain = mesh('RegolithTerrain', verts, faces, regolith)
for poly in terrain.data.polygons:
    poly.use_smooth = True

# Shared irregular rock meshes; fine gravel clusters leave open dust patches.
rocks = []
for k in range(9):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1)
    template = bpy.context.object
    data = template.data.copy()
    bpy.data.objects.remove(template, do_unlink=True)
    for vertex in data.vertices:
        p = vertex.co
        p *= 1 + .22 * noise.noise_vector(p * 2.1 + Vector((k, 4, 2)))[0]
        p.z *= .64 + k * .028
    mat = surface('MAT_PreviewRock_%02d' % k, (.07 + k * .006,) * 3, (.19 + k * .008,) * 3, 5, 55)
    data.materials.clear()
    data.materials.append(mat)
    # Broad facets retain fractured shape; edge detail comes from the shader.
    for poly in data.polygons:
        poly.use_smooth = True
    rocks.append(data)

clusters = [(rng.uniform(-28, 28), rng.uniform(-19, 48)) for _ in range(42)]
placed = 0
for i in range(4400):
    if i % 4:
        cx, cy = rng.choice(clusters)
        x, y = rng.gauss(cx, 1.65), rng.gauss(cy, 1.65)
    else:
        x, y = rng.uniform(-36, 36), rng.uniform(-26, 65)
    if abs(x) < 1.4 and abs(y + 3) < 2.3:
        continue
    radius = rng.uniform(.016, .067) if i < 3900 else rng.uniform(.075, .21)
    if i > 4350:
        radius = rng.uniform(.24, .63)
    obj = bpy.data.objects.new('SM_RegolithRock_%04d' % i, rng.choice(rocks))
    root.objects.link(obj)
    obj.location = (x, y, height(x, y) + radius * .18)
    obj.scale = (radius * rng.uniform(.8, 1.3), radius * rng.uniform(.72, 1.2), radius)
    obj.rotation_euler = (rng.uniform(-.3, .3), rng.uniform(-.3, .3), rng.uniform(0, math.tau))
    placed += 1

# Copy objects and materials, preserve supplied geometry and source collection.
rover = bpy.data.collections.new('COL_PreviewCommunityRover')
root.children.link(rover)
transform = Matrix.Translation((0, -3, -.016405 * 3.2 + .003)) @ Matrix.Rotation(math.radians(23), 4, 'Z') @ Matrix.Scale(3.2, 4)
material_copies = {}
copied = []
for original in source.all_objects:
    obj = original.copy()
    obj.name = 'SM_PreviewRover_' + original.name
    rover.objects.link(obj)
    obj.matrix_world = transform @ original.matrix_world
    for slot in obj.material_slots:
        original_mat = slot.material
        if not original_mat:
            continue
        if original_mat not in material_copies:
            mat = original_mat.copy()
            mat.name = 'MAT_PreviewRover_' + original_mat.name
            if mat.use_nodes:
                for node in mat.node_tree.nodes:
                    if node.type == 'TEX_IMAGE' and node.image and node.image.name == 'dial_2basecolortexture.jpeg':
                        node.image = bpy.data.images.load(str(TEXTURES / 'Dial_2basecolortexture.jpeg'), check_existing=True)
            material_copies[original_mat] = mat
        slot.link = 'OBJECT'
        slot.material = material_copies[original_mat]
    copied.append(obj)

world = bpy.data.worlds.new('WORLD_LunarBlack')
world.use_nodes = True
next(n for n in world.node_tree.nodes if n.type == 'BACKGROUND').inputs['Color'].default_value = (0, 0, 0, 1)
scene.world = world
light = bpy.data.lights.new('LIGHT_Sun', 'SUN')
light.energy = 4.5
light.angle = math.radians(.53)
light.use_shadow = True
if hasattr(light, 'use_contact_shadow'):
    light.use_contact_shadow = True
sun = bpy.data.objects.new('LIGHT_Sun', light)
root.objects.link(sun)
sun.rotation_euler = Vector((-1, 1.4, -1.0)).to_track_quat('-Z', 'Y').to_euler()


def camera(name, location, target, lens):
    data = bpy.data.cameras.new(name)
    obj = bpy.data.objects.new(name, data)
    root.objects.link(obj)
    obj.location = location
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()
    data.lens = lens
    data.clip_end = 500
    return obj


overview = camera('CAM_TerrainOverview', (17, -23, 16), (-1, 9, -.2), 37)
ground = camera('CAM_GroundLevel', (6.4, -11.5, 1.85), (-1, 7, .65), 33)
scene.camera = overview
scene.render.engine = bpy.data.scenes['Community Rover Inspection'].render.engine
scene.eevee.taa_render_samples = 96
scene.eevee.use_gtao = True
scene.eevee.gtao_distance = 3
scene.eevee.gtao_factor = 1.1
scene.eevee.use_soft_shadows = True
scene.render.resolution_x = 1440
scene.render.resolution_y = 900
scene.render.resolution_percentage = 100
scene.view_settings.view_transform = bpy.data.scenes['Community Rover Inspection'].view_settings.view_transform
scene.view_settings.exposure = -.15
scene.render.image_settings.file_format = next(i.identifier for i in scene.render.image_settings.bl_rna.properties['file_format'].enum_items if i.identifier == 'PNG')
scene.render.film_transparent = False
scene.unit_settings.system = bpy.data.scenes['Community Rover Inspection'].unit_settings.system
scene.render.filepath = str(OUT / 'terrain-rover-overview.png')
scene['preview_only'] = True
scene['source_rover'] = 'Supplied NASA Lunar Rover community Blender model; geometry retained.'
scene['terrain_reference'] = 'User images 4, 5, 7; artistic terrain, not surveyed topography.'

# One runnable acceptance check; image availability is checked only for this scene.
used_images = {node.image for mat in material_copies.values() if mat.use_nodes
               for node in mat.node_tree.nodes if node.type == 'TEX_IMAGE' and node.image}
missing = [im.name for im in used_images if not im.packed_file and not Path(bpy.path.abspath(im.filepath)).is_file()]
assert len(copied) == len(source.all_objects) and not missing, missing
wheel_minima = [min((obj.matrix_world @ Vector(v)).z for v in obj.bound_box)
                for obj in copied if obj.name.startswith('SM_PreviewRover_Wheel -')]
assert len(wheel_minima) == 4 and all(abs(z - .003) < .002 for z in wheel_minima), wheel_minima
assert not any('Cuoi' in obj.name or 'Rabbit' in obj.name for obj in scene.objects)
stats = {'scene': scene.name, 'source_rover_objects': len(copied), 'source_rover_polygons': 3101689,
         'terrain_vertices': len(verts), 'rocks': placed, 'wheel_minima_m': wheel_minima,
         'missing_rover_images': missing, 'renderer': scene.render.engine,
         'cameras': [overview.name, ground.name], 'preview_only': True}
(OUT / 'terrain-rover-preview-stats.json').write_text(json.dumps(stats, indent=2))
bpy.data.libraries.write(str(OUT / 'terrain-rover-preview.blend'), {scene}, path_remap='ABSOLUTE', fake_user=True, compress=True)
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type == 'VIEW_3D':
            area.spaces.active.region_3d.view_perspective = 'CAMERA'
print(json.dumps(stats))
