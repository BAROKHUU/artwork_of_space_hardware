"""Local Blender concept. No gameplay assets or original scenes are changed."""
import bpy
import math
import random
from mathutils import Vector
from pathlib import Path

OUT = Path(__file__).parent
random.seed(42)
scene = bpy.data.scenes.new('Moon Concept Preview')
bpy.context.window.scene = scene
root = bpy.data.collections.new('COL_MoonConcept')
scene.collection.children.link(root)
current = root

def collection(name):
    global current
    current = bpy.data.collections.new('COL_' + name)
    root.children.link(current)

def place(obj, name, mat=None):
    obj.name = 'SM_' + name
    for old in list(obj.users_collection):
        old.objects.unlink(obj)
    current.objects.link(obj)
    if mat:
        obj.data.materials.append(mat)
    return obj

def material(name, color, mottled=True, metallic=0):
    m = bpy.data.materials.new('MAT_' + name)
    m.use_nodes = True
    m.diffuse_color = (*color, 1)
    nodes = m.node_tree.nodes
    bsdf = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = .83
    bsdf.inputs['Metallic'].default_value = metallic
    if mottled:
        noise = nodes.new('ShaderNodeTexNoise')
        noise.inputs['Scale'].default_value = 7
        noise.inputs['Detail'].default_value = 2
        ramp = nodes.new('ShaderNodeValToRGB')
        ramp.color_ramp.elements[0].color = (*[v*.75 for v in color], 1)
        ramp.color_ramp.elements[1].color = (*[min(1,v*1.14+.03) for v in color], 1)
        m.node_tree.links.new(noise.outputs['Fac'], ramp.inputs[0])
        m.node_tree.links.new(ramp.outputs[0], bsdf.inputs['Base Color'])
    return m

def ball(name, p, scale, mat, smooth=True):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, location=p)
    o = place(bpy.context.object, name, mat)
    o.scale = scale
    if smooth:
        for poly in o.data.polygons:
            poly.use_smooth = True
    return o

def box(name, p, scale, mat, bevel=.06):
    bpy.ops.mesh.primitive_cube_add(size=1, location=p)
    o = place(bpy.context.object, name, mat)
    o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = o.modifiers.new('Soft edges', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
        o.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
    return o

def rod(name, a, b, radius, mat, r2=None, vertices=12):
    a,b = Vector(a),Vector(b)
    d = b-a
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius, radius2=radius if r2 is None else r2, depth=d.length, location=(a+b)/2)
    o = place(bpy.context.object, name, mat)
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = d.to_track_quat('Z','Y')
    return o

def line(name, points, radius, mat, cyclic=False):
    c = bpy.data.curves.new(name, 'CURVE')
    c.dimensions = '3D'
    c.bevel_depth = radius
    c.bevel_resolution = 2
    s = c.splines.new('POLY')
    s.points.add(len(points)-1)
    for v,p in zip(s.points,points):
        v.co = (*p,1)
    s.use_cyclic_u = cyclic
    o=bpy.data.objects.new('SM_'+name,c)
    current.objects.link(o)
    c.materials.append(mat)
    return o

def mesh(name, verts, faces, mat):
    data=bpy.data.meshes.new(name)
    data.from_pydata(verts,[],faces)
    data.update()
    o=bpy.data.objects.new('SM_'+name,data)
    current.objects.link(o)
    data.materials.append(mat)
    return o

def ground(x,y):
    return .13 + .08*math.sin(x*.7)*math.cos(y*.65)

cream=material('Ivory',(.91,.77,.52))
white=material('Warm fur',(.97,.89,.72))
pink=material('Rose',(.8,.34,.31))
rust=material('Terracotta scarf',(.64,.20,.08))
shirt=material('Cuoi tunic',(.40,.22,.13))
pants=material('Indigo trousers',(.16,.12,.18))
skin=material('Warm skin',(.85,.48,.25))
hair=material('Dark hair',(.09,.045,.035))
dark=material('Charcoal',(.065,.052,.085),False)
brown=material('Wood',(.28,.13,.065))
wicker=material('Woven basket',(.61,.37,.13))
gold=material('Luna gold',(.9,.47,.10),True,.2)
lavender=material('Moon lavender',(.40,.35,.56))
moon=material('Moon dust',(.63,.59,.73))
trail=material('Warm path',(.83,.70,.50))
leaf=material('Banyan gold',(.52,.48,.16))
mint=material('Earth continents',(.30,.55,.46))
blue=material('Earth oceans',(.19,.39,.68))
glow=material('Cyan display',(.30,.87,1),False)
bsdf=next(n for n in glow.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
bsdf.inputs['Emission Color'].default_value=(.18,.75,1,1)
bsdf.inputs['Emission Strength'].default_value=1.6

def setup():
    try:
        scene.render.engine='BLENDER_EEVEE'
    except TypeError:
        print('Keeping renderer',scene.render.engine)
    scene.render.resolution_x=1440
    scene.render.resolution_y=900
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG'
    scene.render.filepath=str(OUT/'moon-concept.png')
    scene.eevee.use_gtao=True
    scene.eevee.gtao_distance=3
    scene.eevee.gtao_factor=1.3
    scene.eevee.taa_render_samples=64
    scene.world=bpy.data.worlds.new('Moon Concept World')
    scene.world.use_nodes=True
    bg=next(n for n in scene.world.node_tree.nodes if n.type=='BACKGROUND')
    bg.inputs[0].default_value=(.09,.065,.16,1)
    bg.inputs[1].default_value=.65
    collection('PreviewLighting')
    for name,p,power,size,color in [('Key',(-5,-8,12),1900,8,(1,.78,.55)),('Fill',(7,-2,8),1200,7,(.65,.72,1)),('Rim',(1,6,11),2300,6,(1,.65,.32))]:
        data=bpy.data.lights.new(name,'AREA')
        data.energy=power
        data.shape='DISK'
        data.size=size
        data.color=color
        o=bpy.data.objects.new('LGT_'+name,data)
        current.objects.link(o)
        o.location=p
        o.rotation_euler=(Vector((0,0,0))-o.location).to_track_quat('-Z','Y').to_euler()
    data=bpy.data.cameras.new('Preview camera')
    data.type='ORTHO'
    data.ortho_scale=19.2
    camera=bpy.data.objects.new('CAM_MoonConcept',data)
    current.objects.link(camera)
    camera.location=(9,-18,12)
    camera.rotation_euler=(Vector((0,.5,1.4))-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.camera=camera
    for area in bpy.context.screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_perspective='CAMERA'

def environment():
    collection('MoonMap')
    n=96
    verts=[(0,0,ground(0,0))]
    for r in [1.4,2.8,4.2,5.6,7.4]:
        for i in range(n):
            a=i*math.tau/n
            x,y=r*math.cos(a),r*.76*math.sin(a)
            verts.append((x,y,ground(x,y)+random.uniform(-.07,.07)))
    faces=[]
    for i in range(n):
        faces.append((0,1+i,1+(i+1)%n))
    for j in range(4):
        for i in range(n):
            a=1+j*n+i;b=1+j*n+(i+1)%n
            faces.append((a,a+n,b+n,b))
    for i in range(n):
        a=i*math.tau/n
        verts.append((7.05*math.cos(a),7.05*.76*math.sin(a),-.75+random.uniform(-.08,.08)))
        p=1+4*n+i;q=1+4*n+(i+1)%n
        faces.append((p,q,1+5*n+(i+1)%n,1+5*n+i))
    mesh('Moon island',verts,faces,moon)
    # Broad curving route remains open between the three hero silhouettes.
    pts=[(-6,1.6),(-4.8,.5),(-3.5,.1),(-1.4,.4),(.2,1.1),(2.2,1.1),(4.2,.0),(6.4,-.8)]
    for i in range(len(pts)-1):
        a,b=Vector(pts[i]),Vector(pts[i+1]);d=b-a
        for k in range(10):
            p=a+d*(k/10)
            ball('Dust trail',(p.x,p.y,ground(*p)+.015),(.45,.43,.035),trail)
    for x,y,r in [(-5.4,-2.9,.7),(5.2,2.5,1.0),(.2,3.4,.65),(-.3,-.8,.48)]:
        z=ground(x,y)
        ball('Crater bowl',(x,y,z+.015),(r,r,.035),lavender)
        line('Crater rim',[(x+r*math.cos(a),y+r*math.sin(a),z+.08+.03*math.sin(a*5)) for a in [i*math.tau/40 for i in range(40)]],.075,moon,True)
    for i in range(45):
        x,y=random.uniform(-6.7,6.7),random.uniform(-4.2,4.4)
        if x*x/46+y*y/24>1 or (y<-.9 and -4.5<x<4.8):
            continue
        r=random.uniform(.11,.37)
        o=ball('Moon rock',(x,y,ground(x,y)+r*.35),(r,r*.78,r*.57),lavender,False)
        o.rotation_euler.z=random.random()*6
    # Banyan landmark: forked trunk, hanging roots, clustered crown.
    collection('BanyanLandmark')
    tx,ty=-3.5,2.9
    for dx,dy in [(-1,-.2),(.85,.15),(.2,.7),(-.2,-.8)]:
        rod('Banyan root',(tx,ty,.7),(tx+dx,ty+dy,.18),.20,brown,.055)
    rod('Banyan trunk',(tx,ty,.14),(tx+.12,ty,3.3),.36,brown,.19)
    for i in range(7):
        a=i*2.4
        x,y=tx+1.45*math.cos(a),ty+1.05*math.sin(a)
        z=3.15+random.uniform(-.15,.6)
        rod('Banyan branch',(tx,ty,1.8),(x,y,z),.15,brown,.045)
        ball('Banyan crown',(x,y,z+.35),(1.03,.78,.58),leaf)
        if i%2==0:
            rod('Hanging root',(x,y,z-.1),(x+.07,y,.35),.025,wicker,.016)
    ball('Banyan top',(tx,ty,4.05),(1.3,.95,.63),leaf)
    collection('SkyDetails')
    earth=(3.8,5.2,4.5)
    ball('Earth',earth,(1.22,1.22,1.22),blue)
    # Raised continent shapes on the visible hemisphere.
    for dx,dy,dz,s in [(-.45,-.96,.3,.35),(-.28,-1.03,-.16,.25),(.4,-.99,.35,.36),(.55,-.94,-.25,.20),(-.05,-1.05,.65,.18)]:
        ball('Earth land',(earth[0]+dx,earth[1]+dy,earth[2]+dz),(s,.065,s*.8),mint)
    line('Earth clouds',[(3.0+i*.12,4.16,4.93+.05*math.sin(i)) for i in range(12)],.045,white)
    for i in range(33):
        x,y,z=random.uniform(-10,10),random.uniform(6,9),random.uniform(2.7,8)
        ball('Star',(x,y,z),(.025,.025,.025),cream)

def characters():
    collection('ChuCuoi')
    x,y=-3.25,-2.05
    z=ground(x,y)
    def p(a,b,c):return(x+a,y+b,z+c)
    for side in [-1,1]:
        ball('Sandal',p(side*.24,-.12,.10),(.23,.33,.10),brown)
        rod('Shin',p(side*.24,0,.18),p(side*.23,0,.63),.105,skin)
        ball('Trouser leg',p(side*.24,.04,.90),(.23,.23,.45),pants)
        rod('Sandal strap',p(side*.24-.15,-.17,.16),p(side*.24+.15,-.17,.16),.035,wicker)
        rod('Trouser cuff',p(side*.24,0,.54),p(side*.24,0,.66),.205,shirt)
    ball('Tunic',p(0,0,1.45),(.52,.30,.65),shirt)
    line('Tunic seam',[p(0,-.29,1.05),p(.02,-.32,1.8)],.018,wicker)
    rod('Neck',p(0,0,1.86),p(0,0,2.12),.17,skin)
    ball('Cuoi head',p(0,-.02,2.38),(.43,.36,.49),skin)
    for side in [-1,1]:
        ball('Ear',p(side*.43,-.01,2.34),(.105,.085,.15),skin)
        ball('Eye',p(side*.17,-.345,2.43),(.065,.031,.085),hair)
        ball('Eye sparkle',p(side*.17-.016,-.376,2.46),(.019,.012,.023),white)
        ball('Cheek',p(side*.26,-.32,2.24),(.082,.023,.042),pink)
        line('Brow',[p(side*.17-.07,-.34,2.56),p(side*.17,-.36,2.58),p(side*.17+.06,-.34,2.56)],.021,hair)
    ball('Nose',p(0,-.38,2.29),(.065,.065,.075),skin)
    line('Cuoi smile',[p(-.13,-.347,2.18),p(-.07,-.375,2.14),p(.02,-.38,2.13),p(.12,-.35,2.18)],.017,brown)
    ball('Hair cap',p(0,.03,2.7),(.46,.37,.27),hair)
    for i in range(10):
        a=i*2.4
        o=ball('Tumbled hair',p(.33*math.cos(a),.19*math.sin(a),2.73+random.uniform(-.05,.13)),(.16,.13,.19),hair)
        o.rotation_euler.y=random.uniform(-.9,.9)
    line('Headband',[p(.43*math.cos(a),.365*math.sin(a),2.64+.025*math.cos(a)) for a in [i*math.tau/48 for i in range(48)]],.055,rust,True)
    for a,b in [((-.35,.12,2.64),(-.67,.19,2.44)),((-.35,.13,2.64),(-.73,.21,2.73))]:
        rod('Headband tail',p(*a),p(*b),.065,rust,.03)
    line('Scarf collar',[p(-.38,-.09,1.99),p(-.17,-.33,1.85),p(.05,-.35,1.84),p(.38,-.1,1.99)],.095,rust)
    box('Scarf tail',p(.19,-.33,1.57),(.16,.065,.50),rust,.025)
    line('Belt',[p(.50*math.cos(a),.31*math.sin(a),1.16) for a in [i*math.tau/40 for i in range(40)]],.045,rust,True)
    rod('Left sleeve',p(-.39,0,1.75),p(-.65,-.05,1.47),.18,shirt,.14)
    rod('Left forearm',p(-.65,-.05,1.47),p(-.59,-.24,1.15),.10,skin,.08)
    ball('Left hand',p(-.59,-.24,1.12),(.11,.10,.15),skin)
    rod('Right sleeve',p(.39,0,1.75),p(.64,-.04,1.48),.18,shirt,.14)
    rod('Right forearm',p(.64,-.04,1.48),p(.81,-.22,1.25),.1,skin,.08)
    ball('Axe hand',p(.81,-.22,1.25),(.12,.11,.14),skin)
    rod('Axe handle',p(.86,-.24,.25),p(.81,-.22,1.46),.047,brown)
    mesh('Axe blade',[p(.86,-.28,.28),p(1.26,-.28,.18),p(1.28,-.28,.62),p(.86,-.28,.54),p(.86,-.19,.28),p(1.26,-.19,.18),p(1.28,-.19,.62),p(.86,-.19,.54)],[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],lavender)
    ball('Basket',p(0,.40,1.53),(.43,.30,.56),wicker)
    for j in range(8):
        h=1.09+j*.12
        line('Basket weave',[p(.43*math.cos(a),.4+.30*math.sin(a),h) for a in [i*math.tau/36 for i in range(36)]],.018,cream,True)
    for i in [-1,0,1]:
        rod('Firewood',p(i*.18,.44,1.6),p(i*.18-.06,.46,2.32+abs(i)*.1),.075,brown,.06)
    for side in [-1,1]:
        line('Basket strap',[p(side*.28,.42,1.14),p(side*.39,-.22,1.38),p(side*.33,-.22,1.92),p(side*.23,.40,2.0)],.035,wicker)
    collection('ThoNgoc')
    x,y=-.68,-2.74
    z=ground(x,y)
    def p(a,b,c):return(x+a,y+b,z+c)
    ball('Rabbit body',p(0,0,.65),(.43,.35,.55),white)
    ball('Rabbit belly',p(0,-.24,.62),(.31,.13,.34),cream)
    ball('Rabbit head',p(0,-.08,1.29),(.47,.37,.42),white)
    for side in [-1,1]:
        ball('Rabbit foot',p(side*.25,-.19,.16),(.20,.32,.13),white)
        ball('Rabbit paw',p(side*.32,-.22,.65),(.14,.14,.26),white)
        ear=ball('Long rabbit ear',p(side*.26,.02,1.98),(.155,.12,.60),white)
        ear.rotation_euler.y=side*.20
        ear=ball('Pink inner ear',p(side*.26,-.095,1.99),(.095,.025,.46),pink)
        ear.rotation_euler.y=side*.20
        ball('Amber eye',p(side*.17,-.403,1.35),(.09,.042,.115),brown)
        ball('Amber iris',p(side*.17,-.431,1.33),(.063,.025,.071),gold)
        ball('Eye pupil',p(side*.17,-.454,1.36),(.043,.012,.065),hair)
        ball('Eye glint',p(side*.17-.02,-.466,1.39),(.024,.012,.031),white)
        ball('Rabbit blush',p(side*.30,-.36,1.18),(.10,.024,.05),pink)
        for i in range(2):
            line('Whisker',[p(side*.27,-.36,1.18+i*.08),p(side*.57,-.37,1.17+i*.13)],.009,cream)
        line('Rabbit mouth',[p(0,-.459,1.17),p(side*.05,-.454,1.11),p(side*.12,-.431,1.14)],.012,brown)
    ball('Rabbit nose',p(0,-.46,1.21),(.06,.035,.043),pink)
    for i in range(7):
        a=i*math.tau/7
        ball('Fluffy tail',p(.36+.1*math.cos(a),.26+.09*math.sin(a),.57+(i%2)*.08),(.15,.14,.15),white)

def rover():
    collection('LunaRover')
    x,y=2.65,-1.6
    z=ground(x,y)
    def p(a,b,c):return(x+a,y+b,z+c)
    box('Open rover chassis',p(0,0,.65),(2.55,1.6,.20),cream)
    for side in [-1,1]:
        for end in [-1,1]:
            wx,wy=end*.91,side*.91
            rod('Wheel tire',p(wx,wy-.18,.51),p(wx,wy+.18,.51),.49,dark,vertices=32)
            rod('Wheel rim',p(wx,wy+side*.16,.51),p(wx,wy+side*.20,.51),.29,wicker,vertices=24)
            rod('Wheel hub',p(wx,wy+side*.20,.51),p(wx,wy+side*.23,.51),.12,cream,vertices=16)
            for i in range(20):
                a=i*math.tau/20
                tread=box('Tire tread',p(wx+.485*math.sin(a),wy,.51+.485*math.cos(a)),(.14,.38,.052),lavender,.012)
                tread.rotation_euler.y=a
            # Thin amber wheel arch.
            points=[p(wx+.55*math.cos(a),wy,.51+.55*math.sin(a)) for a in [i*math.pi/20 for i in range(21)]]
            line('Gold fender',points,.065,gold)
    for side in [-1,1]:
        box('Seat cushion',p(-.45,side*.39,.85),(.67,.58,.14),white)
        back=box('Seat back',p(-.77,side*.39,1.22),(.14,.60,.76),cream)
        back.rotation_euler.y=-.13
        for h in [1.0,1.22,1.44]:
            box('Seat webbing',p(-.67,side*.39,h),(.032,.63,.06),wicker,.015)
        rod('Safety rail',p(-1.10,side*.70,.81),p(.20,side*.70,.81),.035,gold)
    box('Front instrument deck',p(.79,0,.87),(.8,1.4,.28),gold)
    for side in [-1,1]:
        box('Headlamp',p(1.22,side*.48,.91),(.07,.29,.19),white)
    rod('Monitor mast',p(.18,-.1,.8),p(.18,-.1,1.65),.055,gold)
    monitor=box('Friendly monitor',p(.18,-.1,1.80),(.56,.17,.49),cream)
    box('Monitor screen',p(.18,-.199,1.80),(.43,.025,.36),dark,.04)
    for side in [-1,1]:
        line('Happy monitor eye',[p(.18+side*.10+dx,-.22,1.84+.045*math.sin(i*math.pi/8)) for i,dx in enumerate([-.047+j*.094/8 for j in range(9)])],.014,glow)
    line('Monitor smile',[p(.08+i*.025,-.222,1.73-.038*math.sin(i*math.pi/8)) for i in range(9)],.012,glow)
    rod('Dish mast',p(.78,.52,1.0),p(.78,.52,2.45),.045,cream)
    # Parabolic fan dish, tilted toward the viewer.
    center=Vector(p(.78,.52,2.55))
    normal=Vector((.0,-.75,.66)).normalized()
    u=Vector((1,0,0));v=normal.cross(u).normalized()
    verts=[tuple(center)]
    n=32
    for r in [.35,.7,.95]:
        for i in range(n):
            a=i*math.tau/n
            verts.append(tuple(center+u*(r*math.cos(a))+v*(r*math.sin(a))+normal*(r*r*.27)))
    faces=[(0,1+i,1+(i+1)%n) for i in range(n)]
    for j in range(2):
        for i in range(n):
            a=1+j*n+i;b=1+j*n+(i+1)%n
            faces.append((a,b,b+n,a+n))
    mesh('Gold dish',verts,faces,gold)
    for i in range(12):
        a=i*math.tau/12
        edge=center+u*(.95*math.cos(a))+v*(.95*math.sin(a))+normal*.244
        line('Dish rib',[tuple(center),tuple((center+edge)/2-normal*.06),tuple(edge)],.015,cream)
    line('Dish rim',[tuple(center+u*(.95*math.cos(a))+v*(.95*math.sin(a))+normal*.244) for a in [i*math.tau/48 for i in range(48)]],.025,cream,True)
    rod('Dish feed',tuple(center),tuple(center+normal*.65),.035,dark)

def finish():
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.update()
    print('PREVIEW',len(scene.objects),'objects; original Scene preserved')
    OUT.mkdir(exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'moon-concept.blend'),copy=True)
    bpy.ops.render.render(write_still=True)

setup()
