"""Deterministically author and export the original P10 hero, Astra Vale.

Run with Blender 5.2:

    blender --background --python Tools/Blender/P10_AstraValeHero.py

The script writes the editable source blend to ArtSource/P10 and the delivery
FBX to the Unity project.  No downloaded geometry, textures, or presets are
used.  Geometry is intentionally modular so silhouette and material breakup
survive the locked P10 gameplay camera.
"""

from __future__ import annotations

import math
import random
import datetime
import hashlib
from pathlib import Path

import bpy
from mathutils import Vector


SEED = 24007001
ROOT = Path(__file__).resolve().parents[2]
BLEND_PATH = ROOT / "ArtSource" / "P10" / "P10_AstraValeHero.blend"
FBX_PATH = (
    ROOT
    / "game"
    / "Assets"
    / "CodexOfWar"
    / "Heroes"
    / "P10"
    / "Models"
    / "P10_AstraValeHero.fbx"
)
TEXTURE_ROOT = (
    ROOT
    / "game"
    / "Assets"
    / "CodexOfWar"
    / "Heroes"
    / "P10"
    / "Textures"
)


PALETTE = {
    "P10_Skin": ((0.62, 0.25, 0.16, 1.0), 0.0, 0.49),
    "P10_SkinBlush": ((0.82, 0.30, 0.23, 1.0), 0.0, 0.46),
    "P10_HairSilver": ((0.63, 0.72, 0.76, 1.0), 0.08, 0.37),
    "P10_HairShadow": ((0.10, 0.16, 0.20, 1.0), 0.12, 0.31),
    "P10_ClothTeal": ((0.018, 0.19, 0.22, 1.0), 0.0, 0.40),
    "P10_ClothDark": ((0.012, 0.025, 0.040, 1.0), 0.0, 0.32),
    "P10_Ivory": ((0.70, 0.62, 0.45, 1.0), 0.0, 0.48),
    "P10_Leather": ((0.16, 0.050, 0.024, 1.0), 0.04, 0.36),
    "P10_ArmorGunmetal": ((0.055, 0.085, 0.11, 1.0), 0.82, 0.30),
    "P10_ArmorSilver": ((0.43, 0.52, 0.57, 1.0), 0.92, 0.22),
    "P10_Copper": ((0.55, 0.17, 0.045, 1.0), 0.88, 0.24),
    "P10_EyeDark": ((0.008, 0.012, 0.018, 1.0), 0.0, 0.28),
    "P10_EmissiveCyan": (
        (0.012, 0.34, 0.39, 1.0),
        0.12,
        0.20,
        (0.02, 2.8, 3.2, 1.0),
    ),
}

FAMILIES = {
    "P10_Skin": ["P10_Skin", "P10_SkinBlush"],
    "P10_Hair": ["P10_HairSilver", "P10_HairShadow", "P10_EyeDark"],
    "P10_ClothLeather": [
        "P10_ClothTeal",
        "P10_ClothDark",
        "P10_Ivory",
        "P10_Leather",
    ],
    "P10_Metal": [
        "P10_ArmorGunmetal",
        "P10_ArmorSilver",
        "P10_Copper",
    ],
    "P10_Glow": ["P10_EmissiveCyan"],
}


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.materials,
        bpy.data.cameras,
        bpy.data.lights,
    ):
        for item in list(block):
            if item.users == 0:
                block.remove(item)


def material(name: str):
    existing = bpy.data.materials.get(name)
    if existing:
        return existing
    values = PALETTE[name]
    mat = bpy.data.materials.new(name=name)
    mat.diffuse_color = values[0]
    mat.use_nodes = True
    mat.surface_render_method = "DITHERED"
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = values[0]
    bsdf.inputs["Metallic"].default_value = values[1]
    bsdf.inputs["Roughness"].default_value = values[2]
    if len(values) > 3:
        bsdf.inputs["Emission Color"].default_value = values[3]
        bsdf.inputs["Emission Strength"].default_value = 1.0
    return mat


def assign(obj, mat_name: str):
    obj.data.materials.clear()
    obj.data.materials.append(material(mat_name))
    return obj


def smooth(obj, angle_degrees: float = 52.0):
    if obj.type != "MESH":
        return obj
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    obj.data.set_sharp_from_angle(angle=math.radians(angle_degrees))
    return obj


def apply_transform(obj) -> None:
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.select_set(False)


def bevel(obj, width: float, segments: int = 3):
    apply_transform(obj)
    modifier = obj.modifiers.new(name="Authored edge bevel", type="BEVEL")
    modifier.width = width
    modifier.segments = max(segments, 5)
    modifier.limit_method = "ANGLE"
    modifier.angle_limit = math.radians(22.0)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.select_set(False)
    return smooth(obj)


def parent(obj, root):
    obj.parent = root
    return obj


def uv_sphere(
    name: str,
    location,
    scale,
    mat_name: str,
    root,
    segments: int = 40,
    rings: int = 28,
):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segments,
        ring_count=rings,
        location=location,
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    apply_transform(obj)
    smooth(obj)
    assign(obj, mat_name)
    return parent(obj, root)


def cube(
    name: str,
    location,
    scale,
    mat_name: str,
    root,
    rotation=(0.0, 0.0, 0.0),
    bevel_width=0.035,
):
    bpy.ops.mesh.primitive_cube_add(
        location=location,
        rotation=tuple(math.radians(v) for v in rotation),
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = tuple(value * 0.5 for value in scale)
    if bevel_width > 0.0:
        bevel(obj, bevel_width, 3)
    else:
        apply_transform(obj)
    assign(obj, mat_name)
    return parent(obj, root)


def cylinder(
    name: str,
    location,
    radius: float,
    depth: float,
    mat_name: str,
    root,
    vertices=24,
    rotation=(0.0, 0.0, 0.0),
    bevel_width=0.0,
):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=location,
        rotation=tuple(math.radians(v) for v in rotation),
    )
    obj = bpy.context.object
    obj.name = name
    if bevel_width:
        bevel(obj, bevel_width, 2)
    else:
        smooth(obj)
    assign(obj, mat_name)
    return parent(obj, root)


def cone(
    name: str,
    location,
    radius1: float,
    radius2: float,
    depth: float,
    mat_name: str,
    root,
    vertices=20,
    rotation=(0.0, 0.0, 0.0),
):
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices,
        radius1=radius1,
        radius2=radius2,
        depth=depth,
        location=location,
        rotation=tuple(math.radians(v) for v in rotation),
    )
    obj = bpy.context.object
    obj.name = name
    smooth(obj)
    assign(obj, mat_name)
    return parent(obj, root)


def between(
    name: str,
    start,
    end,
    radius: float,
    mat_name: str,
    root,
    vertices=24,
    taper=1.0,
):
    a = Vector(start)
    b = Vector(end)
    delta = b - a
    midpoint = (a + b) * 0.5
    if taper == 1.0:
        obj = cylinder(
            name,
            midpoint,
            radius,
            delta.length,
            mat_name,
            root,
            vertices=vertices,
        )
    else:
        obj = cone(
            name,
            midpoint,
            radius,
            radius * taper,
            delta.length,
            mat_name,
            root,
            vertices=vertices,
        )
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = delta.to_track_quat("Z", "Y")
    return obj


def curve_tube(
    name: str,
    points,
    radius: float,
    mat_name: str,
    root,
    resolution=2,
):
    curve_data = bpy.data.curves.new(name=name + "_Curve", type="CURVE")
    curve_data.dimensions = "3D"
    curve_data.resolution_u = resolution
    curve_data.bevel_depth = radius
    curve_data.bevel_resolution = 5
    curve_data.resolution_u = 4
    spline = curve_data.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for point, coordinate in zip(spline.bezier_points, points):
        point.co = coordinate
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, curve_data)
    bpy.context.collection.objects.link(obj)
    assign(obj, mat_name)
    parent(obj, root)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj.select_set(False)
    return smooth(obj)


def wedge(
    name: str,
    center,
    width_top: float,
    width_bottom: float,
    height: float,
    depth_top: float,
    depth_bottom: float,
    mat_name: str,
    root,
    rotation=(0.0, 0.0, 0.0),
    bevel_width=0.025,
):
    z0 = -height * 0.5
    z1 = height * 0.5
    vertices = [
        (-width_bottom * 0.5, -depth_bottom * 0.5, z0),
        (width_bottom * 0.5, -depth_bottom * 0.5, z0),
        (width_bottom * 0.5, depth_bottom * 0.5, z0),
        (-width_bottom * 0.5, depth_bottom * 0.5, z0),
        (-width_top * 0.5, -depth_top * 0.5, z1),
        (width_top * 0.5, -depth_top * 0.5, z1),
        (width_top * 0.5, depth_top * 0.5, z1),
        (-width_top * 0.5, depth_top * 0.5, z1),
    ]
    faces = [
        (0, 1, 2, 3),
        (4, 7, 6, 5),
        (0, 4, 5, 1),
        (1, 5, 6, 2),
        (2, 6, 7, 3),
        (4, 0, 3, 7),
    ]
    mesh = bpy.data.meshes.new(name + "_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = center
    obj.rotation_euler = tuple(math.radians(v) for v in rotation)
    if bevel_width:
        bevel(obj, bevel_width, 3)
    assign(obj, mat_name)
    return parent(obj, root)


def blade_mesh(name: str, root, mat_name: str):
    # Blade lies along local +Z and is slightly scimitar-like in profile.
    verts = [
        (-0.12, -0.035, 0.00),
        (0.12, -0.035, 0.00),
        (0.18, -0.030, 1.15),
        (0.10, -0.025, 1.95),
        (0.00, -0.015, 2.25),
        (-0.15, -0.025, 1.92),
        (-0.27, -0.030, 1.05),
        (-0.12, 0.035, 0.00),
        (0.12, 0.035, 0.00),
        (0.18, 0.030, 1.15),
        (0.10, 0.025, 1.95),
        (0.00, 0.015, 2.25),
        (-0.15, 0.025, 1.92),
        (-0.27, 0.030, 1.05),
    ]
    faces = [
        (0, 1, 2, 3, 4, 5, 6),
        (7, 13, 12, 11, 10, 9, 8),
        (0, 7, 8, 1),
        (1, 8, 9, 2),
        (2, 9, 10, 3),
        (3, 10, 11, 4),
        (4, 11, 12, 5),
        (5, 12, 13, 6),
        (6, 13, 7, 0),
    ]
    mesh = bpy.data.meshes.new(name + "_Mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bevel(obj, 0.025, 3)
    assign(obj, mat_name)
    return parent(obj, root)


def create_face(root):
    uv_sphere(
        "Face_AnimeProportions",
        (0.0, -0.045, 3.13),
        (0.285, 0.245, 0.35),
        "P10_Skin",
        root,
        40,
        24,
    )
    # Pointed chin and ears establish a deliberately stylized anime head.
    wedge(
        "Face_JawAndChin",
        (0.0, -0.105, 2.96),
        0.42,
        0.13,
        0.30,
        0.33,
        0.23,
        "P10_Skin",
        root,
        rotation=(0.0, 0.0, 180.0),
        bevel_width=0.055,
    )
    for sign, side in ((-1, "L"), (1, "R")):
        uv_sphere(
            f"Face_Ear_{side}",
            (0.275 * sign, -0.015, 3.12),
            (0.052, 0.030, 0.090),
            "P10_Skin",
            root,
            20,
            12,
        )
        uv_sphere(
            f"Eye_Sclera_{side}",
            (0.105 * sign, -0.270, 3.18),
            (0.105, 0.024, 0.052),
            "P10_Ivory",
            root,
            24,
            12,
        )
        uv_sphere(
            f"Eye_Iris_{side}",
            (0.105 * sign, -0.292, 3.18),
            (0.044, 0.014, 0.045),
            "P10_EmissiveCyan",
            root,
            20,
            12,
        )
        uv_sphere(
            f"Eye_Pupil_{side}",
            (0.105 * sign, -0.302, 3.18),
            (0.017, 0.009, 0.029),
            "P10_EyeDark",
            root,
            16,
            10,
        )
        between(
            f"Brow_{side}",
            (0.035 * sign, -0.292, 3.265),
            (0.175 * sign, -0.275, 3.285),
            0.014,
            "P10_HairShadow",
            root,
            12,
            taper=0.55,
        )
    wedge(
        "Face_Nose",
        (0.0, -0.296, 3.105),
        0.035,
        0.010,
        0.11,
        0.045,
        0.018,
        "P10_SkinBlush",
        root,
        rotation=(90.0, 0.0, 0.0),
        bevel_width=0.010,
    )
    between(
        "Face_Mouth",
        (-0.055, -0.293, 3.035),
        (0.055, -0.293, 3.035),
        0.010,
        "P10_SkinBlush",
        root,
        12,
        taper=0.70,
    )


def create_hair(root):
    uv_sphere(
        "Hair_SkullCap",
        (0.0, 0.020, 3.24),
        (0.315, 0.286, 0.325),
        "P10_HairShadow",
        root,
        40,
        24,
    )
    # Large overlapping locks make the back silhouette readable at gameplay size.
    locks = [
        (-0.24, 0.07, 3.26, -16, -20, 12, 0.16, 0.56),
        (-0.12, 0.17, 3.28, -6, -10, 5, 0.18, 0.70),
        (0.02, 0.20, 3.30, 2, 0, -4, 0.19, 0.76),
        (0.16, 0.15, 3.27, 8, 12, -9, 0.17, 0.68),
        (0.27, 0.05, 3.23, 18, 23, -14, 0.14, 0.52),
        (-0.17, -0.06, 3.42, -18, -10, 26, 0.15, 0.47),
        (-0.02, -0.09, 3.47, -5, 0, 10, 0.16, 0.52),
        (0.14, -0.05, 3.43, 15, 12, -18, 0.15, 0.46),
    ]
    for index, values in enumerate(locks):
        x, y, z, rx, ry, rz, radius, depth = values
        cone(
            f"Hair_LayeredLock_{index:02d}",
            (x, y, z - depth * 0.36),
            radius,
            0.018,
            depth,
            "P10_HairSilver",
            root,
            20,
            (rx, ry, rz),
        )
    # High ponytail with a dark underlayer and silver articulated outer locks.
    cylinder(
        "Hair_PonytailClasp",
        (0.07, 0.275, 3.34),
        0.105,
        0.18,
        "P10_Copper",
        root,
        24,
        (78.0, 0.0, -12.0),
        0.012,
    )
    curve_tube(
        "Hair_PonytailShadowMass",
        [
            (0.08, 0.30, 3.34),
            (0.20, 0.44, 3.16),
            (0.31, 0.52, 2.88),
            (0.18, 0.60, 2.60),
            (-0.02, 0.66, 2.42),
        ],
        0.115,
        "P10_HairShadow",
        root,
    )
    ponytail_paths = [
        [(0.03, 0.29, 3.35), (0.13, 0.48, 3.08), (0.28, 0.55, 2.79), (0.11, 0.67, 2.47)],
        [(0.08, 0.30, 3.36), (0.23, 0.43, 3.12), (0.35, 0.52, 2.83), (0.25, 0.62, 2.54)],
        [(0.13, 0.29, 3.34), (0.29, 0.39, 3.10), (0.39, 0.49, 2.86), (0.42, 0.60, 2.62)],
        [(0.02, 0.31, 3.32), (0.05, 0.48, 3.05), (0.10, 0.60, 2.73), (-0.07, 0.71, 2.48)],
    ]
    for index, points in enumerate(ponytail_paths):
        curve_tube(
            f"Hair_PonytailSilverLock_{index:02d}",
            points,
            0.055 - index * 0.004,
            "P10_HairSilver",
            root,
        )
        cone(
            f"Hair_PonytailTip_{index:02d}",
            points[-1],
            0.07,
            0.005,
            0.30,
            "P10_HairSilver",
            root,
            16,
            (10.0 + index * 5.0, -18.0 + index * 12.0, -12.0 + index * 8.0),
        )


def create_torso(root):
    cylinder(
        "Body_Neck",
        (0.0, 0.0, 2.79),
        0.105,
        0.30,
        "P10_Skin",
        root,
        24,
    )
    wedge(
        "Body_FittedTorso",
        (0.0, 0.025, 2.15),
        0.85,
        0.55,
        1.12,
        0.40,
        0.31,
        "P10_ClothTeal",
        root,
        bevel_width=0.065,
    )
    wedge(
        "Armor_Backplate",
        (0.0, 0.242, 2.22),
        0.69,
        0.48,
        0.74,
        0.10,
        0.08,
        "P10_ArmorGunmetal",
        root,
        rotation=(1.5, 0.0, 0.0),
        bevel_width=0.045,
    )
    wedge(
        "Armor_Breastplate",
        (0.0, -0.225, 2.26),
        0.76,
        0.49,
        0.68,
        0.10,
        0.07,
        "P10_ArmorSilver",
        root,
        rotation=(-2.0, 0.0, 0.0),
        bevel_width=0.055,
    )
    # Layered teal enamel insets and a readable back-spine accent.
    wedge(
        "Armor_BackTealInset",
        (0.0, 0.302, 2.28),
        0.31,
        0.22,
        0.48,
        0.028,
        0.025,
        "P10_ClothTeal",
        root,
        bevel_width=0.018,
    )
    between(
        "Armor_BackEmissiveSpine",
        (0.0, 0.325, 2.02),
        (0.0, 0.325, 2.50),
        0.022,
        "P10_EmissiveCyan",
        root,
        12,
        taper=0.65,
    )
    for z in (2.08, 2.28, 2.47):
        cylinder(
            f"Armor_BackCopperFastener_{z:.2f}",
            (0.0, 0.341, z),
            0.035,
            0.026,
            "P10_Copper",
            root,
            16,
            (90.0, 0.0, 0.0),
        )
    wedge(
        "Body_HipUnderlayer",
        (0.0, 0.03, 1.48),
        0.55,
        0.72,
        0.55,
        0.34,
        0.40,
        "P10_ClothDark",
        root,
        bevel_width=0.055,
    )
    cube(
        "Leather_WaistBelt",
        (0.0, 0.015, 1.68),
        (0.74, 0.43, 0.14),
        "P10_Leather",
        root,
        bevel_width=0.035,
    )
    cube(
        "Leather_WaistBuckle",
        (0.0, -0.235, 1.69),
        (0.20, 0.055, 0.18),
        "P10_Copper",
        root,
        bevel_width=0.025,
    )
    cube(
        "Leather_BackBuckle",
        (0.0, 0.242, 1.69),
        (0.18, 0.055, 0.16),
        "P10_Copper",
        root,
        bevel_width=0.025,
    )
    curve_tube(
        "Leather_BackStrap_DiagonalL",
        [(-0.34, 0.30, 2.52), (-0.10, 0.34, 2.20), (0.26, 0.30, 1.82)],
        0.035,
        "P10_Leather",
        root,
    )
    curve_tube(
        "Leather_BackStrap_DiagonalR",
        [(0.34, 0.30, 2.52), (0.10, 0.34, 2.20), (-0.26, 0.30, 1.82)],
        0.035,
        "P10_Leather",
        root,
    )
    # Split ivory mantle/scarf gives a bright, asymmetric rear silhouette.
    wedge(
        "Cloth_IvoryMantle",
        (-0.08, 0.33, 2.61),
        0.82,
        0.56,
        0.24,
        0.10,
        0.08,
        "P10_Ivory",
        root,
        rotation=(-6.0, 0.0, -5.0),
        bevel_width=0.045,
    )
    wedge(
        "Cloth_SplitScarf_Left",
        (-0.23, 0.38, 2.05),
        0.28,
        0.42,
        1.05,
        0.06,
        0.075,
        "P10_Ivory",
        root,
        rotation=(7.0, -4.0, 7.0),
        bevel_width=0.035,
    )
    wedge(
        "Cloth_SplitScarf_Right",
        (0.27, 0.39, 1.98),
        0.25,
        0.36,
        1.18,
        0.06,
        0.075,
        "P10_ClothTeal",
        root,
        rotation=(10.0, 5.0, -9.0),
        bevel_width=0.035,
    )


def create_arm(root, side: str, sign: float):
    if sign < 0:
        shoulder = (-0.48, 0.005, 2.48)
        elbow = (-0.66, -0.035, 1.98)
        wrist = (-0.60, -0.18, 1.54)
    else:
        shoulder = (0.48, 0.005, 2.47)
        elbow = (0.67, 0.11, 1.99)
        wrist = (0.79, 0.05, 1.57)
    uv_sphere(
        f"Armor_Pauldron_{side}",
        shoulder,
        (0.30 if sign < 0 else 0.25, 0.27, 0.25),
        "P10_ArmorSilver" if sign < 0 else "P10_ArmorGunmetal",
        root,
        28,
        18,
    )
    wedge(
        f"Armor_PauldronPlate_{side}",
        (shoulder[0], shoulder[1] + 0.06, shoulder[2] + 0.05),
        0.30,
        0.48 if sign < 0 else 0.40,
        0.26,
        0.14,
        0.18,
        "P10_Copper" if sign < 0 else "P10_ArmorSilver",
        root,
        rotation=(0.0, sign * 8.0, -sign * 8.0),
        bevel_width=0.035,
    )
    between(
        f"Body_UpperArm_{side}",
        shoulder,
        elbow,
        0.145,
        "P10_ClothTeal",
        root,
        24,
        taper=0.86,
    )
    uv_sphere(
        f"Body_Elbow_{side}",
        elbow,
        (0.17, 0.15, 0.16),
        "P10_ClothDark",
        root,
        24,
        14,
    )
    between(
        f"Body_Forearm_{side}",
        elbow,
        wrist,
        0.125,
        "P10_Skin",
        root,
        24,
        taper=0.78,
    )
    between(
        f"Armor_Bracer_{side}",
        tuple(Vector(elbow).lerp(Vector(wrist), 0.42)),
        tuple(Vector(elbow).lerp(Vector(wrist), 0.91)),
        0.155,
        "P10_ArmorGunmetal",
        root,
        24,
        taper=0.72,
    )
    cylinder(
        f"Armor_BracerCopperRing_{side}",
        tuple(Vector(elbow).lerp(Vector(wrist), 0.50)),
        0.17,
        0.055,
        "P10_Copper",
        root,
        24,
    ).rotation_quaternion = (
        Vector(wrist) - Vector(elbow)
    ).to_track_quat("Z", "Y")
    uv_sphere(
        f"Body_Glove_{side}",
        wrist,
        (0.145, 0.12, 0.17),
        "P10_Leather",
        root,
        24,
        16,
    )
    for finger in range(4):
        between(
            f"Body_GloveFinger_{side}_{finger}",
            (
                wrist[0] + sign * (finger - 1.5) * 0.025,
                wrist[1] - 0.02,
                wrist[2] - 0.03,
            ),
            (
                wrist[0] + sign * (finger - 1.5) * 0.030,
                wrist[1] - 0.06,
                wrist[2] - 0.15,
            ),
            0.026,
            "P10_Leather",
            root,
            12,
            taper=0.65,
        )


def create_leg(root, side: str, sign: float):
    if sign < 0:
        hip = (-0.23, 0.02, 1.43)
        knee = (-0.27, -0.05, 0.83)
        ankle = (-0.31, 0.02, 0.23)
    else:
        hip = (0.23, 0.05, 1.43)
        knee = (0.32, 0.13, 0.86)
        ankle = (0.38, 0.23, 0.24)
    between(
        f"Body_Thigh_{side}",
        hip,
        knee,
        0.205,
        "P10_ClothDark",
        root,
        28,
        taper=0.82,
    )
    wedge(
        f"Armor_ThighPlate_{side}",
        tuple(Vector(hip).lerp(Vector(knee), 0.46) + Vector((0.0, -0.15, 0.0))),
        0.28,
        0.23,
        0.40,
        0.10,
        0.06,
        "P10_ArmorGunmetal",
        root,
        rotation=(-5.0, sign * 3.0, -sign * 4.0),
        bevel_width=0.035,
    )
    uv_sphere(
        f"Armor_Knee_{side}",
        knee,
        (0.20, 0.18, 0.16),
        "P10_ArmorSilver",
        root,
        26,
        16,
    )
    between(
        f"Body_Shin_{side}",
        knee,
        ankle,
        0.16,
        "P10_ClothDark",
        root,
        26,
        taper=0.72,
    )
    between(
        f"Armor_Greave_{side}",
        tuple(Vector(knee).lerp(Vector(ankle), 0.20)),
        tuple(Vector(knee).lerp(Vector(ankle), 0.89)),
        0.19,
        "P10_ArmorGunmetal",
        root,
        26,
        taper=0.66,
    )
    between(
        f"Armor_GreaveEmissive_{side}",
        tuple(Vector(knee).lerp(Vector(ankle), 0.33) + Vector((0.0, -0.195, 0.0))),
        tuple(Vector(knee).lerp(Vector(ankle), 0.75) + Vector((0.0, -0.17, 0.0))),
        0.018,
        "P10_EmissiveCyan",
        root,
        10,
        taper=0.65,
    )
    cube(
        f"Body_Boot_{side}",
        (ankle[0], ankle[1] - 0.10, 0.12),
        (0.34, 0.58, 0.24),
        "P10_Leather",
        root,
        rotation=(0.0, 0.0, -sign * 2.0),
        bevel_width=0.065,
    )
    cube(
        f"Armor_BootToe_{side}",
        (ankle[0], ankle[1] - 0.36, 0.10),
        (0.35, 0.24, 0.18),
        "P10_ArmorSilver",
        root,
        bevel_width=0.050,
    )
    cylinder(
        f"Armor_BootBuckle_{side}",
        (ankle[0], ankle[1] + 0.16, 0.29),
        0.055,
        0.036,
        "P10_Copper",
        root,
        18,
        (90.0, 0.0, 0.0),
    )


def create_hip_armor(root):
    for sign, side in ((-1, "L"), (1, "R")):
        wedge(
            f"Armor_HipGuard_{side}",
            (0.40 * sign, 0.03, 1.34),
            0.25,
            0.42,
            0.66,
            0.18,
            0.24,
            "P10_ArmorSilver" if sign < 0 else "P10_ArmorGunmetal",
            root,
            rotation=(2.0, sign * 4.0, sign * -8.0),
            bevel_width=0.045,
        )
        for rivet in range(3):
            cylinder(
                f"Armor_HipRivet_{side}_{rivet}",
                (0.40 * sign, -0.12, 1.50 - rivet * 0.17),
                0.032,
                0.028,
                "P10_Copper",
                root,
                16,
                (90.0, 0.0, 0.0),
            )


def create_weapon(root):
    weapon_root = bpy.data.objects.new("WEAPON_AetherGreatblade", None)
    bpy.context.collection.objects.link(weapon_root)
    parent(weapon_root, root)
    weapon_root.location = (0.80, 0.05, 1.48)
    weapon_root.rotation_euler = tuple(
        math.radians(value) for value in (-12.0, 18.0, -20.0)
    )
    cylinder(
        "Weapon_Grip",
        (0.0, 0.0, 0.10),
        0.075,
        0.64,
        "P10_Leather",
        weapon_root,
        24,
    )
    for z in (-0.16, 0.0, 0.16):
        cylinder(
            f"Weapon_GripCopperWrap_{z}",
            (0.0, 0.0, z),
            0.082,
            0.035,
            "P10_Copper",
            weapon_root,
            20,
        )
    cube(
        "Weapon_Guard",
        (0.0, 0.0, 0.48),
        (0.88, 0.16, 0.12),
        "P10_Copper",
        weapon_root,
        bevel_width=0.045,
    )
    cube(
        "Weapon_GuardInset",
        (0.0, -0.09, 0.48),
        (0.52, 0.035, 0.05),
        "P10_EmissiveCyan",
        weapon_root,
        bevel_width=0.015,
    )
    blade = blade_mesh("Weapon_Blade", weapon_root, "P10_ArmorSilver")
    blade.location = (0.0, 0.0, 0.52)
    inner = blade_mesh("Weapon_BladeDarkInset", weapon_root, "P10_ArmorGunmetal")
    inner.location = (0.0, -0.045, 0.58)
    inner.scale = (0.56, 0.55, 0.88)
    core = blade_mesh("Weapon_EmissiveCore", weapon_root, "P10_EmissiveCyan")
    core.location = (0.0, -0.065, 0.72)
    core.scale = (0.18, 0.30, 0.76)
    cylinder(
        "Weapon_Pommel",
        (0.0, 0.0, -0.28),
        0.13,
        0.17,
        "P10_Copper",
        weapon_root,
        24,
        bevel_width=0.025,
    )
    cone(
        "Weapon_PommelSpike",
        (0.0, 0.0, -0.46),
        0.10,
        0.015,
        0.24,
        "P10_ArmorSilver",
        weapon_root,
        20,
    )


def create_root():
    root = bpy.data.objects.new("P10_HERO_ASTRA_VALE", None)
    bpy.context.collection.objects.link(root)
    root["asset_id"] = "P10_ASTRA_VALE_ORIGINAL"
    root["source_seed"] = SEED
    root["authorship"] = "Original procedural Blender geometry; no external assets"
    return root


def add_authored_seams(root):
    # Small repeatable fasteners and seam lines provide close-view material proof.
    for sign, side in ((-1, "L"), (1, "R")):
        curve_tube(
            f"Cloth_TorsoSeam_{side}",
            [
                (0.22 * sign, -0.222, 2.51),
                (0.26 * sign, -0.245, 2.20),
                (0.20 * sign, -0.218, 1.84),
            ],
            0.012,
            "P10_Copper",
            root,
        )
        for row in range(3):
            cylinder(
                f"Armor_PauldronRivet_{side}_{row}",
                (
                    (0.43 + row * 0.055) * sign,
                    -0.23,
                    2.58 - row * 0.08,
                ),
                0.027,
                0.026,
                "P10_Copper",
                root,
                14,
                (90.0, 0.0, 0.0),
            )


def build_hero():
    reset_scene()
    random.seed(SEED)
    for name in PALETTE:
        material(name)
    root = create_root()
    create_torso(root)
    create_face(root)
    create_hair(root)
    create_arm(root, "L", -1.0)
    create_arm(root, "R", 1.0)
    create_leg(root, "L", -1.0)
    create_leg(root, "R", 1.0)
    create_hip_armor(root)
    add_authored_seams(root)
    create_weapon(root)

    # Convert all remaining curves and guarantee deterministic authored normals.
    for obj in list(bpy.context.scene.objects):
        if obj.type == "CURVE":
            bpy.context.view_layer.objects.active = obj
            obj.select_set(True)
            bpy.ops.object.convert(target="MESH")
            obj.select_set(False)
        if obj.type == "MESH":
            for polygon in obj.data.polygons:
                polygon.use_smooth = True
            if obj.name.startswith(
                (
                    "Face_",
                    "Hair_",
                    "Cloth_",
                    "Armor_Pauldron",
                    "Armor_Back",
                    "Armor_Breast",
                    "Armor_HipGuard",
                    "Weapon_Blade",
                )
            ):
                modifier = obj.modifiers.new(
                    name="LOD0 organic surface density",
                    type="SUBSURF",
                )
                modifier.subdivision_type = "SIMPLE"
                modifier.levels = 1
                modifier.render_levels = 1
                bpy.context.view_layer.objects.active = obj
                obj.select_set(True)
                bpy.ops.object.modifier_apply(modifier=modifier.name)
                obj.select_set(False)

    # Unit markers are custom properties only and do not enter the render.
    root["height_m"] = 3.55
    root["forward_axis_blender"] = "-Y"
    root["unity_scale"] = 1.0
    return root


def family_for_material(material_name: str):
    for family_name, source_names in FAMILIES.items():
        if material_name in source_names:
            return family_name, source_names.index(material_name), len(source_names)
    raise ValueError(f"Material has no delivery family: {material_name}")


def make_family_material(family_name: str):
    existing = bpy.data.materials.get(family_name)
    if existing:
        return existing
    first_source = FAMILIES[family_name][0]
    source_values = PALETTE[first_source]
    mat = bpy.data.materials.new(name=family_name)
    mat.diffuse_color = source_values[0]
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (1.0, 1.0, 1.0, 1.0)
    if family_name == "P10_Metal":
        bsdf.inputs["Metallic"].default_value = 0.92
        bsdf.inputs["Roughness"].default_value = 0.24
    elif family_name == "P10_Hair":
        bsdf.inputs["Metallic"].default_value = 0.05
        bsdf.inputs["Roughness"].default_value = 0.36
    elif family_name == "P10_Skin":
        bsdf.inputs["Metallic"].default_value = 0.0
        bsdf.inputs["Roughness"].default_value = 0.50
    elif family_name == "P10_Glow":
        bsdf.inputs["Metallic"].default_value = 0.10
        bsdf.inputs["Roughness"].default_value = 0.20
        bsdf.inputs["Emission Color"].default_value = (0.02, 2.8, 3.2, 1.0)
        bsdf.inputs["Emission Strength"].default_value = 1.0
    else:
        bsdf.inputs["Metallic"].default_value = 0.0
        bsdf.inputs["Roughness"].default_value = 0.64
    return mat


def write_family_atlas(family_name: str) -> Path:
    """Write a tiny original swatch atlas with family-specific micro-variation."""

    width = 512
    height = 256
    source_names = FAMILIES[family_name]
    swatch_width = width / len(source_names)
    pixels = [0.0] * (width * height * 4)
    for y in range(height):
        v = y / max(1, height - 1)
        for x in range(width):
            swatch_index = min(len(source_names) - 1, int(x / swatch_width))
            source_name = source_names[swatch_index]
            base = PALETTE[source_name][0]
            local_u = (x - swatch_index * swatch_width) / swatch_width
            grain = math.sin(local_u * 93.0 + v * 41.0) * 0.018
            grain += math.sin(local_u * 17.0 - v * 79.0) * 0.010
            if family_name == "P10_Hair":
                grain += math.sin(local_u * 155.0) * 0.028
            elif family_name == "P10_ClothLeather":
                weave = math.sin(local_u * 125.0) * math.sin(v * 117.0)
                grain += weave * 0.020
            elif family_name == "P10_Metal":
                grain += math.sin((local_u + v) * 61.0) * 0.014
            elif family_name == "P10_Skin":
                grain *= 0.45
            else:
                grain = math.sin(v * math.pi) * 0.08
            pixel_index = (y * width + x) * 4
            pixels[pixel_index + 0] = max(0.0, min(1.0, base[0] + grain))
            pixels[pixel_index + 1] = max(0.0, min(1.0, base[1] + grain))
            pixels[pixel_index + 2] = max(0.0, min(1.0, base[2] + grain))
            pixels[pixel_index + 3] = 1.0

    image_name = family_name + "_Atlas"
    old_image = bpy.data.images.get(image_name)
    if old_image:
        bpy.data.images.remove(old_image)
    image = bpy.data.images.new(image_name, width=width, height=height, alpha=True)
    image.colorspace_settings.name = "sRGB"
    image.pixels.foreach_set(pixels)
    TEXTURE_ROOT.mkdir(parents=True, exist_ok=True)
    output_path = TEXTURE_ROOT / f"{image_name}.png"
    image.filepath_raw = str(output_path)
    image.file_format = "PNG"
    image.save()
    return output_path


def remap_object_to_family(obj) -> None:
    if obj.type != "MESH" or not obj.data.materials:
        return
    source_name = obj.data.materials[0].name
    family_name, swatch_index, swatch_count = family_for_material(source_name)
    uv_layer = obj.data.uv_layers.active
    if uv_layer is None:
        uv_layer = obj.data.uv_layers.new(name="P10_AtlasUV")
        coordinates = [vertex.co for vertex in obj.data.vertices]
        minimum_x = min((value.x for value in coordinates), default=0.0)
        maximum_x = max((value.x for value in coordinates), default=1.0)
        minimum_z = min((value.z for value in coordinates), default=0.0)
        maximum_z = max((value.z for value in coordinates), default=1.0)
        span_x = max(0.0001, maximum_x - minimum_x)
        span_z = max(0.0001, maximum_z - minimum_z)
        for loop in obj.data.loops:
            coordinate = obj.data.vertices[loop.vertex_index].co
            uv_layer.data[loop.index].uv = (
                (coordinate.x - minimum_x) / span_x,
                (coordinate.z - minimum_z) / span_z,
            )
    for uv in uv_layer.data:
        source_u = uv.uv.x % 1.0
        source_v = uv.uv.y % 1.0
        uv.uv.x = (swatch_index + 0.06 + source_u * 0.88) / swatch_count
        uv.uv.y = 0.06 + source_v * 0.88
    obj.data.materials.clear()
    obj.data.materials.append(make_family_material(family_name))


def join_delivery_group(objects, name: str, root):
    if not objects:
        raise RuntimeError(f"No meshes found for delivery group {name}")
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    active = objects[0]
    bpy.context.view_layer.objects.active = active
    bpy.ops.object.join()
    active.name = name
    active.parent = root

    old_materials = list(active.data.materials)
    unique_materials = []
    unique_indices = {}
    polygon_targets = []
    for polygon in active.data.polygons:
        current = old_materials[polygon.material_index]
        if current.name not in unique_indices:
            unique_indices[current.name] = len(unique_materials)
            unique_materials.append(current)
        polygon_targets.append(unique_indices[current.name])
    active.data.materials.clear()
    for mat in unique_materials:
        active.data.materials.append(mat)
    for polygon, target_index in zip(active.data.polygons, polygon_targets):
        polygon.material_index = target_index
    active.data.update()
    smooth(active)
    return active


def prepare_delivery_meshes(root):
    for family_name in FAMILIES:
        write_family_atlas(family_name)
    meshes = [obj for obj in root.children_recursive if obj.type == "MESH"]
    for obj in meshes:
        remap_object_to_family(obj)
    weapon_meshes = [obj for obj in meshes if obj.name.startswith("Weapon_")]
    body_meshes = [obj for obj in meshes if obj not in weapon_meshes]
    body = join_delivery_group(body_meshes, "P10_AstraVale_Body", root)
    weapon = join_delivery_group(weapon_meshes, "P10_AetherGreatblade", root)
    for delivery_mesh in (body, weapon):
        bpy.ops.object.select_all(action="DESELECT")
        delivery_mesh.select_set(True)
        bpy.context.view_layer.objects.active = delivery_mesh
        bpy.ops.object.transform_apply(
            location=True,
            rotation=True,
            scale=True,
        )
        delivery_mesh.rotation_euler.x = math.radians(-90.0)
        bpy.ops.object.transform_apply(
            location=False,
            rotation=True,
            scale=False,
        )
        delivery_mesh.select_set(False)
    for obj in list(root.children_recursive):
        if obj.type == "EMPTY" and obj != root:
            bpy.data.objects.remove(obj, do_unlink=True)
    body.parent = root
    weapon.parent = root
    return body, weapon


def save_and_export(root) -> None:
    BLEND_PATH.parent.mkdir(parents=True, exist_ok=True)
    FBX_PATH.parent.mkdir(parents=True, exist_ok=True)
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.unit_settings.scale_length = 1.0
    bpy.context.scene.render.engine = "BLENDER_EEVEE"
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))

    prepare_delivery_meshes(root)
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for child in root.children_recursive:
        child.select_set(True)
    bpy.context.view_layer.objects.active = root
    install_deterministic_fbx_patch()
    bpy.ops.export_scene.fbx(
        filepath=str(FBX_PATH),
        check_existing=False,
        use_selection=True,
        apply_unit_scale=True,
        apply_scale_options="FBX_SCALE_UNITS",
        use_space_transform=True,
        bake_space_transform=False,
        object_types={"EMPTY", "MESH"},
        use_mesh_modifiers=True,
        mesh_smooth_type="FACE",
        use_subsurf=False,
        add_leaf_bones=False,
        primary_bone_axis="Y",
        secondary_bone_axis="X",
        axis_forward="-Z",
        axis_up="Y",
        path_mode="AUTO",
        embed_textures=False,
        use_metadata=False,
    )


def install_deterministic_fbx_patch() -> None:
    """Pin Blender 5.2's private FBX UUID/timestamp sources.

    Blender's stock binary FBX writer includes Python-hash-derived UUIDs and a
    live CreationTimeStamp.  Pinning both makes independent exports of this
    source byte-identical on Blender build fbe6228777e7.
    """

    from io_scene_fbx import export_fbx_bin, fbx_utils

    class FixedFBXDateTime(datetime.datetime):
        @classmethod
        def now(cls, tz=None):
            return cls(1970, 1, 1, 10, 0, 0, 0, tzinfo=tz)

    def stable_key_to_uuid(used_uuids, key):
        if isinstance(key, int) and 0 <= key < 2**63:
            candidate = key
        else:
            payload = f"{type(key).__name__}:{key!r}".encode("utf-8")
            candidate = int.from_bytes(
                hashlib.sha256(payload).digest()[:8],
                "big",
            ) & ((1 << 63) - 1)
        if candidate == 0:
            candidate = 1
        while candidate in used_uuids:
            candidate = ((candidate + 1) & ((1 << 63) - 1)) or 1
        return fbx_utils.UUID(candidate)

    fbx_utils._keys_to_uuids.clear()
    fbx_utils._uuids_to_keys.clear()
    fbx_utils._key_to_uuid = stable_key_to_uuid
    export_fbx_bin.datetime.datetime = FixedFBXDateTime


if __name__ == "__main__":
    hero_root = build_hero()
    save_and_export(hero_root)
    mesh_count = sum(1 for obj in bpy.context.scene.objects if obj.type == "MESH")
    triangle_count = 0
    for mesh_object in bpy.context.scene.objects:
        if mesh_object.type != "MESH":
            continue
        mesh_object.data.calc_loop_triangles()
        triangle_count += len(mesh_object.data.loop_triangles)
    print(
        f"P10 Astra Vale exported: meshes={mesh_count} "
        f"approx_triangles={triangle_count} fbx={FBX_PATH}"
    )
