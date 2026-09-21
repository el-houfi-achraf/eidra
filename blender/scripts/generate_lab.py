"""TODO_ART: original modular laboratory blockout. Run with Blender LTS in background."""
import bpy, math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
EXPORT=ROOT/'assets'/'environments'/'laboratory'
EXPORT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
stone=bpy.data.materials.new('dark_stone');stone.diffuse_color=(.08,.17,.17,1)

def box(name,location,scale,material=None):
    bpy.ops.mesh.primitive_cube_add(size=1,location=location)
    obj=bpy.context.object;obj.name=name;obj.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if material:obj.data.materials.append(material)
    return obj

for chunk in range(5):
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    box('laboratory_floor_lod0',(0,0,-1),(40,5,2),stone)
    proxy=box('COL_floor',(0,0,-1),(40,5,2));proxy['collision']='box';proxy.hide_render=True
    for i in range(5):
        x=-16+i*8
        box(f'laboratory_pillar_{i}_lod0',(x,6,5),(1.5,2,10),stone)
        for j in range(11):
            angle=j*math.pi/10
            arc=box(f'laboratory_arch_{i}_{j}_lod0',(x+4+3.4*math.cos(angle),6,9+3.4*math.sin(angle)),(.7,1.1,1.1),stone)
            arc.rotation_euler[1]=angle-math.pi/2
            bpy.context.view_layer.objects.active=arc;bpy.ops.object.transform_apply(location=False,rotation=True,scale=False)
    destination=EXPORT/f'laboratory_chunk_{chunk+1:02d}_lod0.glb'
    bpy.ops.export_scene.gltf(filepath=str(destination),export_format='GLB',export_yup=True,export_extras=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'blender'/'source'/f'laboratory_chunk_{chunk+1:02d}.blend'))
    print('Exported',destination)
