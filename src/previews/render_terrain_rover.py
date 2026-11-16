"""Render the two preview cameras from the isolated saved scene."""
import bpy
from pathlib import Path

out = Path(__file__).parent
scene = bpy.data.scenes['Terrain and Rover Preview']
for camera, filename in [('CAM_TerrainOverview', 'terrain-rover-overview.png'),
                         ('CAM_GroundLevel', 'terrain-rover-ground.png')]:
    scene.camera = bpy.data.objects[camera]
    scene.render.filepath = str(out / filename)
    bpy.ops.render.render(write_still=True, scene=scene.name)
    assert (out / filename).is_file()
print('TERRAIN_ROVER_RENDERS_COMPLETE', flush=True)
