"""Local revision preview: Apollo-inspired LRV, lunar terrain, refined characters.

Visual reference, not survey-accurate NASA geometry or production game assets.
"""
import bpy
import math
import random
import json
from mathutils import Vector
from pathlib import Path

OUT = Path(__file__).parent
random.seed(42)
scene = bpy.data.scenes.new('Moon Refined Preview v2')
bpy.context.window.scene = scene
root = bpy.data.collections.new('COL_MoonRefined_v2')
scene.collection.children.link(root)
current = root


def collection(name):
    global current
    current = bpy.data.collections.new('COL_' + name)
    root.children.link(current)
    return current


def place(obj, name, mat=None):
    obj.name = 'SM_' + name
    for old in list(obj.users_collection):
        old.objects.unlink(obj)
    current.objects.link(obj)
    if mat:
        obj.data.materials.append(mat)
    return obj


def material(name, rgba, rough=.5, metallic=0):
    m = bpy.data.materials.new('MAT_v2_' + name)
    m.use_nodes = True
    m.diffuse_color = rgba
    bsdf = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = rgba
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metallic
    return m


def ball(name, p, scale, mat, smooth=True):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16, location=p)
    o = place(bpy.context.object, name, mat)
    o.scale = scale
    for poly in o.data.polygons:
        poly.use_smooth = smooth
    return o


def box(name, p, size, mat, bevel=.02):
    # Snippet dimensions are half extents.
    bpy.ops.mesh.primitive_cube_add(size=2, location=p)
    o = place(bpy.context.object, name, mat)
    o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = o.modifiers.new('Edge bevel', 'BEVEL')
        mod.width, mod.segments = bevel, 2
        o.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
    return o


def rod(name, a, b, radius, mat, r2=None, vertices=16):
    a, b = Vector(a), Vector(b)
    d = b-a
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius,
        radius2=radius if r2 is None else r2, depth=d.length, location=(a+b)/2)
    o = place(bpy.context.object, name, mat)
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = d.to_track_quat('Z', 'Y')
    for p in o.data.polygons:
        p.use_smooth = len(p.vertices) == 4
    return o


def line(name, points, radius, mat, cyclic=False):
    c = bpy.data.curves.new(name, 'CURVE')
    c.dimensions = '3D'
    c.bevel_depth, c.bevel_resolution = radius, 1
    s = c.splines.new('POLY')
    s.points.add(len(points)-1)
    for v, p in zip(s.points, points):
        v.co = (*p, 1)
    s.use_cyclic_u = cyclic
    o = bpy.data.objects.new('SM_' + name, c)
    current.objects.link(o)
    c.materials.append(mat)
    return o


def mesh(name, verts, faces, mat, smooth=False):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    obj = bpy.data.objects.new('SM_' + name, data)
    current.objects.link(obj)
    data.materials.append(mat)
    for poly in data.polygons:
        poly.use_smooth = smooth
    return obj


CRATERS = [(-5.5, 1.5, 2.1, .55), (5.8, 4.8, 3.2, .85),
           (-.3, 6.4, 1.5, .35), (3.6, -3.9, 1.3, .28),
           (-3.6, -3.2, .85, .18), (-8, 11, 4.6, 1.0), (12, 16, 6, 1.5)]


def ground(x, y):
    z = .06*math.sin(x*.7)*math.cos(y*.48) + .045*math.sin(x*1.9+y*.8)
    z += 1.8*math.exp(-((y-24)/8)**2)*(1+.3*math.sin(x*.22)+.16*math.cos(x*.54))
    for cx, cy, r, depth in CRATERS:
        a = math.atan2(y-cy, x-cx)
        d = math.hypot(x-cx, y-cy) / (r*(1+.045*math.sin(a*5)+.025*math.cos(a*9)))
        z += -depth*math.exp(-(d/.77)**4) + depth*.23*math.exp(-((d-1.02)/.2)**2)
    # Soft level patches preserve foot and wheel contact in this static preview.
    for cx, cy, rx, ry in ((1.8,.4,1.65,1.9), (-2.8,-.4,.65,.55), (-1,-.9,.52,.5)):
        d = math.sqrt(((x-cx)/rx)**2+((y-cy)/ry)**2)
        t = max(0., min(1., (d-.75)/.45))
        z *= t*t*(3-2*t)
    return z


def terrain():
    collection('Lunar terrain')
    dust = material('lunar regolith', (.24,.235,.225,1), .94)
    n = dust.node_tree.nodes
    bsdf = next(n for n in n if n.type == 'BSDF_PRINCIPLED')
    noise = n.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 135
    noise.inputs['Detail'].default_value = 3
    bump = n.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = .23
    bump.inputs['Distance'].default_value = .018
    dust.node_tree.links.new(noise.outputs['Fac'], bump.inputs['Height'])
    dust.node_tree.links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    ramp = n.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = (.16,.155,.15,1)
    ramp.color_ramp.elements[1].color = (.29,.285,.27,1)
    dust.node_tree.links.new(noise.outputs['Fac'], ramp.inputs[0])
    dust.node_tree.links.new(ramp.outputs[0], bsdf.inputs['Base Color'])
    count = 181
    verts = [(-25+50*i/(count-1), -25+70*j/(count-1), ground(-25+50*i/(count-1), -25+70*j/(count-1)))
             for j in range(count) for i in range(count)]
    faces = [(j*count+i,j*count+i+1,(j+1)*count+i+1,(j+1)*count+i)
             for j in range(count-1) for i in range(count-1)]
    mesh('Continuous lunar surface', verts, faces, dust, True)
    rock = material('angular basalt', (.18,.175,.17,1), .89)
    for i in range(95):
        x,y = random.uniform(-12,12),random.uniform(-9,15)
        if any(math.hypot(x-a,y-b)<r for a,b,r in ((1.8,.4,2.2),(-2.8,-.4,.8),(-1,-.9,.65))):
            continue
        r = random.uniform(.055,.19) if i<80 else random.uniform(.25,.55)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1, location=(x,y,ground(x,y)+r*.22))
        o = place(bpy.context.object, 'Lunar rock', rock)
        for v in o.data.vertices:
            v.co *= random.uniform(.79,1.16)
        o.scale = (r*1.25,r*.87,r*.65)
        o.rotation_euler = (random.random(),random.random(),random.random()*math.tau)


def characters():
    skin = material('Cuoi warm skin', (0.76, 0.43, 0.27, 1))
    blush = material('Cuoi cheeks', (0.83, 0.39, 0.31, 1))
    hair = material('Cuoi dark chestnut hair', (0.105, 0.055, 0.04, 1))
    hairlight = material('Hair highlights', (0.20, 0.105, 0.065, 1))
    tunic = material('Brown linen', (0.39, 0.22, 0.15, 1))
    hem = material('Linen edging', (0.58, 0.37, 0.25, 1))
    pants = material('Indigo cloth', (0.17, 0.18, 0.27, 1))
    rust = material('Burnt orange cloth', (0.69, 0.27, 0.12, 1))
    wicker = material('Basket reed', (0.60, 0.39, 0.19, 1))
    darkreed = material('Basket shadow', (0.40, 0.24, 0.10, 1))
    wood = material('Wood', (0.31, 0.17, 0.08, 1))
    iron = material('Axe iron', (0.40, 0.43, 0.45, 1), .35, .4)
    white = material('Eye ivory', (0.98, 0.92, 0.78, 1), .35)
    dark = material('Eye dark brown', (0.09, 0.045, 0.027, 1), .18)
    cream = material('Rabbit cream', (0.94, 0.87, 0.73, 1), .7)
    pink = material('Rabbit ear rose', (0.83, 0.49, 0.43, 1), .65)
    glint = material('Eye glint', (1, 1, .94, 1), .15)

    def rings(name, sections, mat, n=32):
        verts = [(cx + rx * math.cos(2*math.pi*i/n), cy + ry * math.sin(2*math.pi*i/n), zz)
                 for cx, cy, zz, rx, ry in sections for i in range(n)]
        faces = [(j*n+i, j*n+(i+1)%n, (j+1)*n+(i+1)%n, (j+1)*n+i)
                 for j in range(len(sections)-1) for i in range(n)]
        faces += [tuple(reversed(tuple(range(n)))), tuple((len(sections)-1)*n+i for i in range(n))]
        return mesh(name, verts, faces, mat, True)

    collection('Cuoi')
    x, y = -2.8, -.4
    z = ground(x, y)
    def p(a,b,c): return (x+a,y+b,z+c)
    def sec(rows): return [(x+a,y+b,z+c,rx,ry) for a,b,c,rx,ry in rows]
    for s in (-1,1):
        ball('Sandal sole', p(s*.14,-.055,.055), (.13,.22,.055), wood)
        ball('Foot', p(s*.14,-.06,.105), (.105,.17,.075), skin)
        line('Sandal straps', [p(s*.14-.09,-.13,.12),p(s*.14,-.07,.17),p(s*.14+.09,-.13,.12)], .018, wicker)
        rod('Ankle',p(s*.14,0,.13),p(s*.14,0,.36),.058,skin,.065)
        rings('Cropped trousers',sec([(s*.14,0,.32,.105,.105),(s*.14,0,.38,.13,.12),(s*.14,0,.64,.15,.13),(s*.13,0,.79,.14,.12)]),pants)
        rod('Trouser rolled cuff',p(s*.14,0,.33),p(s*.14,0,.38),.115,hem)
    rings('Loose tunic',sec([(0,0,.68,.32,.19),(0,0,.75,.32,.19),(0,0,1.10,.27,.18),(0,0,1.34,.31,.18),(0,0,1.39,.19,.14)]),tunic)
    line('Tunic hem',[p(.315*math.cos(a),.19*math.sin(a),.72) for a in [i*math.tau/48 for i in range(48)]],.012,hem,True)
    line('Tunic overlap',[p(-.20,-.17,1.30),p(-.06,-.19,1.15),p(.12,-.19,.75)],.012,hem)
    line('Sash',[p(.29*math.cos(a),.19*math.sin(a),.91) for a in [i*math.tau/48 for i in range(48)]],.025,rust,True)
    line('Sash ends',[p(-.23,-.15,.91),p(-.30,-.18,.79),p(-.35,-.16,.71)],.026,rust)
    rod('Neck',p(0,0,1.32),p(0,0,1.48),.085,skin)
    ball('Head',p(0,-.02,1.65),(.245,.205,.275),skin)
    for s in (-1,1):
        ball('Ear',p(s*.24,-.005,1.64),(.055,.045,.08),skin)
        ball('Eye white',p(s*.095,-.205,1.68),(.052,.022,.067),white)
        ball('Pupil',p(s*.095,-.225,1.68),(.028,.014,.047),dark)
        ball('Eye glint',p(s*.095-.009,-.237,1.70),(.010,.008,.013),glint)
        line('Upper eyelid',[p(s*.095-.05,-.214,1.71),p(s*.095,-.227,1.742),p(s*.095+.05,-.214,1.71)],.009,hair)
        line('Eyebrow',[p(s*.095-.046,-.19,1.77),p(s*.095,-.208,1.79),p(s*.095+.046,-.19,1.77)],.012,hair)
        ball('Cheek',p(s*.155,-.196,1.59),(.047,.012,.025),blush)
    ball('Nose',p(0,-.227,1.605),(.032,.026,.035),skin)
    line('Smile',[p(-.07,-.204,1.56),p(-.035,-.223,1.545),p(.035,-.223,1.545),p(.07,-.204,1.56)],.008,hair)
    # Sculpted cap and tapered swept strands, avoiding separate spherical locks.
    rings('Swept hair cap',sec([(0,.015,1.73,.235,.20),(0,.015,1.84,.25,.20),(-.025,.02,1.94,.19,.16),(-.065,.025,1.99,.035,.04)]),hair)
    for i in range(5):
        a=-.21+i*.085
        line('Swept hair ridge',[p(a,.08,1.91),p(a+.03,-.04,1.94),p(a+.07,-.16,1.88),p(a+.09,-.19,1.83)],.015,hairlight)
    line('Headband',[p(.244*math.cos(a),.205*math.sin(a),1.83+.025*math.cos(a)) for a in [i*math.tau/48 for i in range(48)]],.023,rust,True)
    line('Headband ribbon',[p(-.23,.06,1.84),p(-.32,.10,1.89),p(-.40,.12,1.85)],.027,rust)
    line('Headband ribbon',[p(-.23,.06,1.84),p(-.32,.11,1.80),p(-.38,.13,1.73)],.022,rust)
    line('Scarf collar',[p(-.22,.04,1.38),p(-.17,-.16,1.31),p(0,-.21,1.28),p(.18,-.15,1.33),p(.22,.04,1.38)],.047,rust)
    line('Scarf end',[p(.10,-.20,1.30),p(.15,-.21,1.14),p(.16,-.20,1.03)],.035,rust)
    for s in (-1,1):
        rod('Loose sleeve',p(s*.26,0,1.29),p(s*.37,-.01,1.09),.105,tunic,.085)
        rod('Sleeve cuff',p(s*.36,-.01,1.10),p(s*.38,-.01,1.06),.088,hem)
        rod('Forearm',p(s*.38,-.01,1.06),p(s*.46,-.09,.88),.052,skin,.045)
        ball('Hand',p(s*.46,-.09,.87),(.06,.05,.075),skin)
    rod('Axe handle',p(.46,-.10,.23),p(.46,-.10,1.02),.025,wood)
    mesh('Axe head',[p(.45,-.13,.25),p(.70,-.13,.19),p(.71,-.13,.40),p(.45,-.13,.37),p(.45,-.07,.25),p(.70,-.07,.19),p(.71,-.07,.40),p(.45,-.07,.37)],[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],iron)
    rings('Basket body',sec([(0,.25,.85,.19,.13),(0,.27,.90,.23,.15),(0,.29,1.25,.27,.18),(0,.29,1.30,.27,.18)]),darkreed)
    for j in range(7):
        h=.90+j*.06; w=.23+j*.006; d=.15+j*.004
        line('Basket horizontal weave',[p(w*math.cos(a),.28+d*math.sin(a),h) for a in [i*math.tau/40 for i in range(40)]],.012,wicker,True)
    for i in range(16):
        a=i*math.tau/16
        line('Basket vertical weave',[p((.23+j*.006)*math.cos(a),.28+(.15+j*.004)*math.sin(a),.90+j*.06) for j in range(7)],.010,wicker)
    for s in (-1,1):
        line('Basket shoulder strap',[p(s*.18,.30,1.25),p(s*.23,-.14,1.32),p(s*.24,-.18,1.03)],.021,wicker)
        rod('Firewood',p(s*.11,.30,1.15),p(s*.13,.31,1.46),.035,wood)

    collection('ThoNgoc')
    x,y = -1.0,-.9
    z = ground(x,y)
    ball('Rabbit body',p(0,.02,.36),(.25,.20,.32),cream)
    ball('Rabbit head',p(0,-.055,.77),(.29,.235,.25),cream)
    for s in (-1,1):
        ball('Rabbit foot',p(s*.15,-.12,.075),(.12,.18,.075),cream)
        ball('Rabbit paw',p(s*.20,-.14,.40),(.09,.09,.15),cream)
        ball('Rabbit eye',p(s*.115,-.265,.79),(.055,.027,.071),dark)
        ball('Rabbit eye glint',p(s*.115-.016,-.289,.82),(.016,.009,.019),glint)
        ball('Rabbit blush',p(s*.205,-.246,.69),(.055,.012,.028),pink)
        line('Rabbit smile',[p(0,-.294,.68),p(s*.035,-.291,.65),p(s*.075,-.274,.67)],.007,wood)
        for j in range(2):
            line('Whisker',[p(s*.12,-.27,.69+j*.03),p(s*.29,-.27,.68+j*.05)],.004,hem)
    ball('Rabbit nose',p(0,-.293,.705),(.035,.018,.024),pink)
    # Tapered ring surfaces form a tall ear and a curved, drooping ear.
    def ear(name, path, mat, front=0):
        verts=[]; n=16
        for a,b,c,w,d in path:
            verts += [p(a+w*math.cos(i*math.tau/n),b+front+d*math.sin(i*math.tau/n),c) for i in range(n)]
        faces=[(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for j in range(len(path)-1) for i in range(n)]
        faces += [tuple(reversed(tuple(range(n)))),tuple((len(path)-1)*n+i for i in range(n))]
        mesh(name,verts,faces,mat,True)
    ear('Upright ear',[(-.13,0,.92,.07,.055),(-.17,0,1.09,.10,.055),(-.20,0,1.25,.08,.04),(-.21,0,1.32,.008,.01)],cream)
    ear('Upright inner ear',[(-.14,-.052,.98,.035,.009),(-.17,-.052,1.10,.057,.009),(-.20,-.038,1.24,.035,.008),(-.21,-.012,1.29,.002,.004)],pink)
    ear('Drooping ear',[(.16,.01,.92,.07,.055),(.25,.01,.94,.10,.06),(.34,0,.85,.10,.055),(.40,-.01,.72,.07,.04),(.41,-.01,.66,.008,.008)],cream)
    ear('Drooping inner ear',[(.22,-.045,.91,.025,.008),(.28,-.049,.90,.05,.009),(.35,-.052,.83,.055,.009),(.39,-.05,.73,.03,.008),(.40,-.025,.69,.002,.004)],pink)
    ball('Rabbit tail',p(.22,.19,.31),(.13,.12,.13),cream)
    for a in range(6):
        t=a*math.tau/6
        ball('Tail tuft',p(.22+.075*math.cos(t),.20,.31+.075*math.sin(t)),(.055,.07,.055),cream)


def rover():
    """Approximate Apollo Lunar Roving Vehicle for the local lunar preview."""
    collection('Apollo lunar rover')
    aluminum = material('LRV brushed aluminum', (0.53, 0.55, 0.54, 1), .48, .65)
    dark = material('LRV dark wire mesh', (0.18, 0.19, 0.18, 1), .75, .35)
    tread = material('LRV titanium chevron tread', (0.37, 0.38, 0.36, 1), .62, .45)
    gold = material('LRV fender gold foil', (0.53, 0.32, 0.13, 1), .5, .55)
    foil = material('LRV thermal insulation', (0.68, 0.52, 0.26, 1), .62, .4)
    cloth = material('LRV seat webbing', (0.40, 0.38, 0.29, 1), .95)
    black = material('LRV equipment black', (0.10, 0.11, 0.10, 1), .8)
    white = material('LRV equipment white', (0.73, 0.72, 0.64, 1), .8)
    cx, cy = 1.8, .4
    base = ground(cx, cy)
    def P(x, y, z):
        return (cx + x, cy + y, base + z)
    def tube(name, a, b, r=.018, mat=aluminum):
        rod(name, P(*a), P(*b), r, mat, vertices=8)
    def panel(name, verts, mat):
        mesh(name, [P(*v) for v in verts], [(0, 1, 2, 3)], mat)

    # Four independent wire-mesh wheels, supported by hubs and suspension arms.
    radius, half_width, wheel_z = .41, .115, .419
    for side in (-1, 1):
        for y in (-.90, .90):
            x = side * .91
            label = ('left' if side < 0 else 'right') + (' front' if y < 0 else ' rear')
            for offset in (-half_width, half_width):
                ring = [P(x + offset, y + radius * math.sin(2*math.pi*i/40), wheel_z + radius * math.cos(2*math.pi*i/40)) for i in range(40)]
                line('wheel rim ' + label, ring, .009, aluminum, cyclic=True)
            rod('wheel hub ' + label, P(x-half_width-.025,y,wheel_z), P(x+half_width+.025,y,wheel_z), .07, aluminum, vertices=12)
            # Crossed diagonal wires describe the open wire-mesh tire casing.
            for i in range(32):
                angle = 2*math.pi*i/32
                for twist in (-.20, .20):
                    a = (x-half_width, y+radius*math.sin(angle), wheel_z+radius*math.cos(angle))
                    b = (x+half_width, y+radius*math.sin(angle+twist), wheel_z+radius*math.cos(angle+twist))
                    tube('wheel mesh ' + label, a, b, .004, dark)
            # Wide, shallow chevron strips follow the tire circumference.
            for i in range(16):
                a = 2*math.pi*i/16
                for side_tread in (-1, 1):
                    angles = (a, a + .105)
                    xa, xb = x, x + side_tread*half_width
                    p1 = (xa, y+(radius+.006)*math.sin(angles[0]), wheel_z+(radius+.006)*math.cos(angles[0]))
                    p2 = (xb, y+(radius+.006)*math.sin(angles[1]), wheel_z+(radius+.006)*math.cos(angles[1]))
                    p3 = (xb, y+(radius+.006)*math.sin(angles[1]+.055), wheel_z+(radius+.006)*math.cos(angles[1]+.055))
                    p4 = (xa, y+(radius+.006)*math.sin(angles[0]+.055), wheel_z+(radius+.006)*math.cos(angles[0]+.055))
                    panel('chevron tread ' + label, (p1,p2,p3,p4), tread)
            # Curved narrow sheet above and behind each tire.
            verts = []
            for i in range(17):
                a = -.98 + 2.05*i/16
                for offset in (-.145,.145):
                    verts.append(P(x+offset, y+.48*math.sin(a), wheel_z+.48*math.cos(a)))
            mesh('curved dust fender ' + label, verts, [(2*i,2*i+1,2*i+3,2*i+2) for i in range(16)], gold)
            for dy in (-.18,.18):
                tube('suspension arm ' + label, (side*.57,y+dy,.67), (x,y,wheel_z), .024)
            tube('suspension damper ' + label, (side*.60,y-.20,.78), (x,y,wheel_z), .018, dark)

    # Open tubular chassis and floor lattice.
    for x in (-.63,.63):
        tube('main chassis rail', (x,-1.12,.57), (x,1.16,.57), .035)
        tube('upper chassis rail', (x,-.72,.76), (x,.83,.76), .025)
        for y in (-.70,.80):
            tube('frame upright', (x,y,.57), (x,y,.76), .022)
    for y in (-1.10,-.70,0,.80,1.12):
        tube('chassis cross member', (-.63,y,.57), (.63,y,.57), .025)
    for x in (-.40,-.20,0,.20,.40):
        tube('open floor rail', (x,-.62,.62), (x,.70,.62), .012)
    for y in (-.50,-.25,0,.25,.50):
        tube('open floor crossbar', (-.56,y,.62), (.56,y,.62), .010)

    # Two lightweight woven seats with separate back and cushion webbing.
    for sx in (-.34,.34):
        for dx in (-.25,.25):
            tube('seat side', (sx+dx,-.08,.76), (sx+dx,.52,.76), .018)
            tube('seat back side', (sx+dx,.52,.76), (sx+dx,.64,1.35), .018)
            tube('seat leg', (sx+dx,.36,.58), (sx+dx,.47,.76), .014)
        for z, y in ((.76,-.08),(.76,.52),(1.35,.64)):
            tube('seat crossbar', (sx-.25,y,z), (sx+.25,y,z), .016)
        for i in range(8):
            x = sx-.22+i*.063
            tube('seat cushion webbing', (x,-.06,.775), (x,.50,.775), .009, cloth)
            tube('seat back webbing', (x,.525,.79), (x,.635,1.33), .009, cloth)
        for i in range(6):
            y = -.03+i*.10
            tube('seat cushion cross weave', (sx-.23,y,.78), (sx+.23,y,.78), .006, cloth)
            t = i/5
            tube('seat back cross weave', (sx-.23,.525+.105*t,.80+.51*t), (sx+.23,.525+.105*t,.80+.51*t), .006, cloth)

    # Forward battery boxes and thermal covers; central controls remain visible.
    for x in (-.37,.37):
        box('front battery electronics', P(x,-1.02,.79), (.27,.28,.16), foil, bevel=.015)
        box('battery top thermal panel', P(x,-1.02,.96), (.255,.265,.012), white, bevel=.005)
        tube('battery hold-down strap', (x-.20,-1.28,.98), (x-.20,-.76,.98), .009, dark)
        tube('battery hold-down strap', (x+.20,-1.28,.98), (x+.20,-.76,.98), .009, dark)
    box('instrument console', P(0,-.64,1.03), (.24,.13,.045), black, bevel=.012)
    for x in (-.14, -.07, 0, .07, .14):
        ball('instrument dial', P(x,-.64,1.08), (.017,.017,.008), white)
    tube('T controller stem', (0,-.35,.72), (0,-.37,1.02), .018, aluminum)
    tube('T controller grip', (-.10,-.37,1.02), (.10,-.37,1.02), .024, black)

    # Front TV camera, high-gain parabolic mesh antenna and low-gain mast.
    tube('camera support', (.55,-1.14,.83), (.55,-1.14,1.17), .020)
    box('TV camera', P(.55,-1.16,1.22), (.12,.14,.09), white, bevel=.012)
    rod('camera lens', P(.55,-1.31,1.22), P(.55,-1.36,1.22), .045, black, vertices=12)
    tube('high gain antenna mast', (-.57,-1.02,.82), (-.57,-1.02,1.48), .022)
    # Dish faces upward and slightly forward; an open radial lattice suggests mesh.
    hub = (-.57,-1.06,1.49)
    for i in range(16):
        a = 2*math.pi*i/16
        rim = (-.57+.31*math.cos(a), -1.15+.26*math.sin(a), 1.64+.10*math.sin(a))
        line('high gain antenna rib', [P(-.57+.31*t*math.cos(a), -1.06-.09*t+.26*t*math.sin(a), 1.49+.15*t*t+.10*t*math.sin(a)) for t in (0,.25,.5,.75,1)], .006, aluminum)
    for k in (1,2,3):
        t = k/3
        ring = []
        for i in range(32):
            a = 2*math.pi*i/32
            ring.append(P(-.57+.31*t*math.cos(a), -1.06-.09*t+.26*t*math.sin(a), 1.49+.15*t*t+.10*t*math.sin(a)))
        line('high gain antenna mesh ring', ring, .004, aluminum, cyclic=True)
    tube('low gain antenna mast', (.61,-.84,.82), (.61,-.84,1.75), .010)
    tube('low gain antenna tip', (.61,-.84,1.75), (.61,-.84,1.91), .005, aluminum)

    # Rear equipment pallet and stowed tools.
    for x in (-.55,.55):
        tube('rear stowage side', (x,.72,.76), (x,1.28,.76), .022)
        tube('rear stowage upright', (x,1.28,.76), (x,1.28,1.14), .020)
    for z in (.76,1.14):
        tube('rear rack crossbar', (-.55,1.28,z), (.55,1.28,z), .020)
    box('rear stowed equipment', P(0,1.02,.86), (.42,.22,.11), foil, bevel=.025)
    for x in (-.38,-.24,.24,.38):
        tube('rear stowed tool', (x,.77,.99), (x,1.22,1.05), .014, dark)



def surface_finish():
    for m in bpy.data.materials:
        if not m.name.startswith('MAT_v2_'):
            continue
        bsdf = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if not bsdf:
            continue
        if any(s in m.name for s in ('linen','cloth','Linen')):
            bsdf.inputs['Roughness'].default_value = .82
            bsdf.inputs['Sheen Weight'].default_value = .25
        elif 'hair' in m.name.lower() or 'Hair' in m.name:
            bsdf.inputs['Roughness'].default_value = .38
        elif 'skin' in m.name or 'cheeks' in m.name:
            bsdf.inputs['Roughness'].default_value = .48
            bsdf.inputs['Subsurface Weight'].default_value = .06
        elif 'Rabbit cream' in m.name:
            bsdf.inputs['Sheen Weight'].default_value = .32
            bsdf.inputs['Roughness'].default_value = .78


def point_at(obj, target):
    obj.rotation_euler = (Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()


def setup():
    collection('Preview lights and camera')
    world = bpy.data.worlds.new('Moon black sky v2')
    scene.world = world
    world.use_nodes = True
    bg = next(n for n in world.node_tree.nodes if n.type == 'BACKGROUND')
    bg.inputs['Color'].default_value = (.02,.02,.02,1)
    bg.inputs['Strength'].default_value = .1
    sun_data = bpy.data.lights.new('Lunar sunlight', 'SUN')
    sun_data.energy, sun_data.angle = 3, .0093
    sun = bpy.data.objects.new('LGT_Lunar sun', sun_data)
    current.objects.link(sun)
    sun.location = (-5,-8,12)
    point_at(sun, (0,0,0))
    fill_data = bpy.data.lights.new('Character face bounce', 'AREA')
    fill_data.energy, fill_data.size = 160, 6
    fill = bpy.data.objects.new('LGT_Preview face fill', fill_data)
    current.objects.link(fill)
    fill.location = (0,-6,4)
    point_at(fill, (-1,0,1))
    camera = bpy.data.objects.new('CAM_Refined overview', bpy.data.cameras.new('Refined overview'))
    current.objects.link(camera)
    camera.location = (8,-13,7)
    point_at(camera, (-.1,.7,.8))
    camera.data.lens = 48
    camera.data.clip_end = 200
    scene.camera = camera
    scene.render.engine = 'BLENDER_EEVEE'
    scene.eevee.use_gtao = True
    scene.eevee.gtao_distance = 3
    scene.eevee.gtao_factor = 1.12
    scene.eevee.taa_render_samples = 96
    scene.render.resolution_x, scene.render.resolution_y = 1440,900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.film_transparent = False
    return camera


def report():
    depsgraph = bpy.context.evaluated_depsgraph_get()
    result = {}
    for col in root.children:
        tris = 0
        for obj in col.objects:
            if obj.type not in {'MESH','CURVE'}:
                continue
            evaluated = obj.evaluated_get(depsgraph)
            data = evaluated.to_mesh()
            data.calc_loop_triangles()
            tris += len(data.loop_triangles)
            evaluated.to_mesh_clear()
        result[col.name] = {'objects':len(col.objects),'triangles':tris}
    (OUT/'moon-refined-v2-stats.json').write_text(json.dumps(result,indent=2))
    print(json.dumps(result))


terrain()
characters()
rover()
surface_finish()
camera = setup()
report()
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'moon-refined-v2.blend'))
scene.render.filepath = str(OUT/'moon-refined-v2.png')
bpy.ops.render.render(write_still=True)
