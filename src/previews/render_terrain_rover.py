"""Render the two preview cameras from the isolated saved scene."""
import bpy
from pathlib import Path

out = Path(__file__).parent
cameras = [('CAM_TerrainOverview', 'terrain-rover-overview.png'),
           ('CAM_GroundLevel', 'terrain-rover-ground.png')]
assert all(not (out / filename).exists() for _, filename in cameras), 'Preserve existing renders'
scene = bpy.data.scenes['Terrain and Rover Preview']
bpy.context.window.scene = scene
textures = out.parent / 'NASA Lunar Rover - Blender Model' / 'NASA Lunar Rover for Blender' / 'textures'
files = {p.name.casefold(): p for p in textures.iterdir() if p.is_file()}
images = set()
for obj in scene.objects:
    for slot in obj.material_slots:
        mat = slot.material
        if mat and mat.use_nodes:
            images.update(node.image for node in mat.node_tree.nodes
                          if node.type == 'TEX_IMAGE' and node.image)
missing = []
for img in images:
    if img.source != 'FILE' or img.packed_file:
        continue
    name = img.filepath.replace('\\', '/').rsplit('/', 1)[-1]
    path = Path(bpy.path.abspath(img.filepath))
    if not path.is_file():
        path = files.get(name.casefold())
    if path and path.is_file():
        img.filepath = str(path)
        img.reload()
    else:
        missing.append(img.filepath)
assert not missing, f'Missing preview images: {missing}'
print(f'PREVIEW_IMAGES_VERIFIED {len(images)}', flush=True)
saved = out / 'terrain-rover-preview-ready.blend'
assert not saved.exists(), f'Preserve existing preview: {saved}'
bpy.ops.wm.save_as_mainfile(filepath=str(saved))
for camera, filename in cameras:
    scene.camera = bpy.data.objects[camera]
    scene.render.filepath = str(out / filename)
    bpy.ops.render.render(write_still=True, scene=scene.name)
    assert (out / filename).is_file()
print('TERRAIN_ROVER_RENDERS_COMPLETE', flush=True)
