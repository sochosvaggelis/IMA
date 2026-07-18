"""
FBX -> GLB for the blueprint hero.

The source is a 1.63M-tri, 652-object model with no materials (the FBX carries
no usable material mapping, which suits us: the hero renders linework, not
texture, so ~100MB of texture maps are simply dropped).

Order matters here. Orientation is decided on the FULL-RESOLUTION mesh, before
decimation, because collapsing the flat parallel midbody strips the vertices
that a beam measurement depends on and makes the hull read narrower amidships
than at the ends.

  JOIN      652 objects is 652 draw calls; one mesh is one call.
  ORIENT    bow to +X, measured not guessed (see beam_profile).
  DECIMATE  1.63M tris is past what a web hero should ship, and dense
            triangulation also makes EdgesGeometry noisy -- the blueprint look
            wants structural edges, not facet spam.
  NORMALISE recentre, scale to a known length, waterline on z=0.
"""

import bpy
import sys
import math
import mathutils

argv = sys.argv[sys.argv.index("--") + 1:]
FBX_IN, GLB_OUT, TARGET_TRIS = argv[0], argv[1], int(argv[2])

TARGET_LENGTH = 100.0

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=FBX_IN)

for o in [o for o in bpy.data.objects if o.type != "MESH"]:
    bpy.data.objects.remove(o, do_unlink=True)

meshes = [o for o in bpy.data.objects if o.type == "MESH"]
print(f"[1] imported {len(meshes)} mesh objects", flush=True)

# ------------------------------------------------------------------- join ---
bpy.ops.object.select_all(action="DESELECT")
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.join()

ship = bpy.context.view_layer.objects.active
ship.name = "Vessel"
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
ship.data.materials.clear()

tris_before = sum(max(len(p.vertices) - 2, 0) for p in ship.data.polygons)
print(f"[2] joined -> {tris_before:,} tris", flush=True)


def world_verts(obj):
    return [obj.matrix_world @ v.co for v in obj.data.vertices]


def bbox(obj):
    ws = world_verts(obj)
    mn = mathutils.Vector((min(w.x for w in ws), min(w.y for w in ws), min(w.z for w in ws)))
    mx = mathutils.Vector((max(w.x for w in ws), max(w.y for w in ws), max(w.z for w in ws)))
    return mn, mx


# ------------------------------------------------------------- orientation ---
mn, mx = bbox(ship)
dims = mx - mn
long_axis = max(range(3), key=lambda i: dims[i])
print(f"[3] dims {tuple(round(d,3) for d in dims)}, long axis = {'XYZ'[long_axis]}", flush=True)

centre = (mn + mx) / 2.0
ship.location -= centre
bpy.ops.object.transform_apply(location=True)

if long_axis == 1:
    ship.rotation_euler[2] = math.radians(90)
elif long_axis == 2:
    ship.rotation_euler[1] = math.radians(90)
bpy.ops.object.transform_apply(rotation=True)


def beam_profile(obj, bins=40):
    """Hull beam in slices along X.

    A bow narrows to a stem; a transom stays blunt, so the end whose beam
    collapses is the bow. Only the lower hull is sampled -- cranes, masts and
    the accommodation block would otherwise widen the slices they sit in.
    """
    ws = world_verts(obj)
    zlo, zhi = min(w.z for w in ws), max(w.z for w in ws)
    hull = [w for w in ws if w.z < zlo + (zhi - zlo) * 0.30]
    x0, x1 = min(w.x for w in ws), max(w.x for w in ws)
    step = (x1 - x0) / bins
    out = []
    for i in range(bins):
        lo, hi = x0 + step * i, x0 + step * (i + 1)
        ys = [w.y for w in hull if lo <= w.x < hi]
        out.append((lo, hi, (max(ys) - min(ys)) if ys else 0.0))
    return out


prof = beam_profile(ship)
widest = max(b for _, _, b in prof) or 1.0
print("[4] beam profile along X, full resolution (hull below 30% height):", flush=True)
for lo, hi, beam in prof:
    print(f"      {lo:8.2f}..{hi:8.2f}  {beam:7.3f}  {'#' * int(beam / widest * 40)}", flush=True)

# Compare the outermost tenth at each end.
edge = max(bins_n := len(prof) // 10, 1)
neg_end = sum(b for _, _, b in prof[:edge]) / edge
pos_end = sum(b for _, _, b in prof[-edge:]) / edge
print(f"[4] mean beam over outer tenth:  -X={neg_end:.3f}   +X={pos_end:.3f}", flush=True)

if pos_end > neg_end:
    print("[4] bow is on -X -> rotating 180 so the bow faces +X", flush=True)
    ship.rotation_euler[2] = math.radians(180)
    bpy.ops.object.transform_apply(rotation=True)
else:
    print("[4] bow already faces +X", flush=True)

# --------------------------------------------------------------- decimate ---
if tris_before > TARGET_TRIS:
    ratio = TARGET_TRIS / tris_before
    mod = ship.modifiers.new(name="Decimate", type="DECIMATE")
    mod.decimate_type = "COLLAPSE"
    mod.ratio = ratio
    mod.use_collapse_triangulate = True
    print(f"[5] decimating at ratio {ratio:.4f} ...", flush=True)
    bpy.ops.object.modifier_apply(modifier=mod.name)

tris_after = sum(max(len(p.vertices) - 2, 0) for p in ship.data.polygons)
print(f"[5] decimated -> {tris_after:,} tris", flush=True)

# -------------------------------------------------------------- normalise ---
mn, mx = bbox(ship)
s = TARGET_LENGTH / (mx.x - mn.x)
ship.scale = (s, s, s)
bpy.ops.object.transform_apply(scale=True)

mn, mx = bbox(ship)
ship.location.z -= mn.z          # waterline rests on z = 0
ship.location.x -= (mn.x + mx.x) / 2.0
ship.location.y -= (mn.y + mx.y) / 2.0
bpy.ops.object.transform_apply(location=True)

mn, mx = bbox(ship)
print(f"[6] final bbox min={tuple(round(v,2) for v in mn)} "
      f"max={tuple(round(v,2) for v in mx)}", flush=True)
print(f"[6] LOA={mx.x-mn.x:.1f}  beam={mx.y-mn.y:.1f}  airdraft={mx.z-mn.z:.1f}", flush=True)

# ----------------------------------------------------------------- export ---
bpy.ops.export_scene.gltf(
    filepath=GLB_OUT,
    export_format="GLB",
    export_apply=True,
    export_materials="NONE",
    export_normals=True,
    export_texcoords=False,
    export_animations=False,
    export_yup=True,
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=6,
)
print(f"[7] wrote {GLB_OUT}", flush=True)
