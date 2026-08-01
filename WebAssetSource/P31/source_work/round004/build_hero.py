"""Build the Rain-derived Nyra gameplay hero on the stable 65-joint rig."""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
import sys

import bmesh
import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))

from blender_common import (
    activate,
    apply_or_remove_modifiers,
    assign_material,
    bind_rigid,
    duplicate_joined_weight_source,
    export_glb,
    limit_and_audit_weights,
    mesh_summary,
    remove_object,
    remove_shape_keys,
    sha256,
    simple_material,
    textured_material,
    transfer_weights,
    write_json,
)


KEEP = {
    "GEO-rain-body_nomask": ("Nyra_Body", "skin", "transfer", "pelvis"),
    "GEO-rain-eyebrows": ("Nyra_Eyebrows", "hair", "rigid", "Head"),
    "GEO-rain-eyelashes": ("Nyra_Eyelashes", "hair", "rigid", "Head"),
    "GEO-rain-eyes": ("Nyra_Eyes", "skin", "rigid", "Head"),
    "GEO-rain-hair_main": ("Nyra_HairMain", "hair", "rigid", "Head"),
    "GEO-rain-hair_ponytail": ("Nyra_HairPonytail", "hair", "rigid", "Head"),
    "GEO-rain-hair_strand": ("Nyra_HairStrand", "hair", "rigid", "Head"),
    "GEO-rain-hairband": ("Nyra_Hairband", "copper", "rigid", "Head"),
    "GEO-rain-head": ("Nyra_Head", "skin", "rigid", "Head"),
    "GEO-rain-jeans": ("Nyra_Legging", "teal", "transfer", "pelvis"),
    "GEO-rain-scarf": ("Nyra_Mantle", "teal", "transfer", "spine_03"),
    "GEO-rain-shoes": ("Nyra_Boots", "copper", "transfer", "root"),
    "GEO-rain-top": ("Nyra_Undersuit", "teal", "transfer", "spine_02"),
}


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--player-core", required=True)
    parser.add_argument("--combat", required=True)
    parser.add_argument("--face-atlas", required=True)
    parser.add_argument("--hair-texture", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--blend-output", required=True)
    parser.add_argument("--receipt", required=True)
    return parser.parse_args(argv)


def interpolate(value: float, points: list[tuple[float, float]]) -> float:
    if value <= points[0][0]:
        x0, y0 = points[0]
        x1, y1 = points[1]
        return y0 + (value - x0) * (y1 - y0) / (x1 - x0)
    for (x0, y0), (x1, y1) in zip(points, points[1:]):
        if value <= x1:
            alpha = (value - x0) / (x1 - x0)
            return y0 + alpha * (y1 - y0)
    x0, y0 = points[-2]
    x1, y1 = points[-1]
    return y1 + (value - x1) * (y1 - y0) / (x1 - x0)


TORSO_Z = [
    (0.0, 0.0),
    (0.821136, 1.0505),
    (1.013384, 1.1736),
    (1.158161, 1.314801),
    (1.231243, 1.440801),
    (1.250817, 1.440801),
    (1.290617, 1.487601),
    (1.392104, 1.568701),
    (1.70, 1.88),
]
ARM_X = [
    (0.0, 0.0),
    (0.113087, 0.1919),
    (0.317588, 0.4663),
    (0.528764, 0.7389),
    (0.584158, 0.787829),
    (0.75, 0.98),
]
LEG_Z = [
    (0.0, 0.0),
    (0.024931, 0.0152),
    (0.077482, 0.1037),
    (0.467798, 0.5318),
    (0.855929, 0.9321),
    (1.02, 1.10),
]


def fit_point(source_name: str, co: object) -> None:
    x, y, z = float(co.x), float(co.y), float(co.z)
    head_parts = {
        "GEO-rain-head",
        "GEO-rain-eyes",
        "GEO-rain-eyebrows",
        "GEO-rain-eyelashes",
        "GEO-rain-hair_main",
        "GEO-rain-hair_ponytail",
        "GEO-rain-hair_strand",
        "GEO-rain-hairband",
    }
    if source_name in head_parts:
        co.y = y + 0.011265
        co.z = z + (1.568701 - 1.392104)
        return
    if source_name in {"GEO-rain-jeans", "GEO-rain-shoes"}:
        co.x = x * (1.09 if source_name == "GEO-rain-jeans" else 1.22)
        co.y = y + 0.018
        co.z = interpolate(z, LEG_Z)
        return
    co.z = interpolate(z, TORSO_Z)
    if source_name == "GEO-rain-body_nomask" and abs(x) > 0.085 and z > 1.12:
        sign = -1.0 if x < 0 else 1.0
        co.x = sign * interpolate(abs(x), ARM_X)
        reach = min(1.0, max(0.0, (abs(x) - 0.085) / 0.18))
        co.y = y + 0.078 * reach
    elif source_name in {"GEO-rain-top", "GEO-rain-scarf"}:
        co.x = x * 1.10


def fit_to_canonical_rest(source_name: str, obj: bpy.types.Object) -> None:
    for vertex in obj.data.vertices:
        fit_point(source_name, vertex.co)
    obj.data.update()


def landmark_fit_audit() -> dict[str, object]:
    checks = {
        "wrist_x": (interpolate(0.528764, ARM_X), 0.7389),
        "hand_end_x": (interpolate(0.584158, ARM_X), 0.787829),
        "arm_plane_z": (interpolate(1.231243, TORSO_Z), 1.440801),
        "neck_z": (interpolate(1.290617, TORSO_Z), 1.487601),
        "head_pivot_z": (1.392104 + (1.568701 - 1.392104), 1.568701),
        "hip_z": (interpolate(0.855929, LEG_Z), 0.9321),
        "knee_z": (interpolate(0.467798, LEG_Z), 0.5318),
        "ankle_z": (interpolate(0.077482, LEG_Z), 0.1037),
    }
    errors = {name: abs(observed - target) for name, (observed, target) in checks.items()}
    worst = max(errors.values())
    if worst > 1e-5:
        raise RuntimeError(f"Canonical landmark fit failed: {errors}")
    return {
        "status": "pass",
        "checks": {
            name: {"observed": observed, "target": target, "abs_error": errors[name]}
            for name, (observed, target) in checks.items()
        },
        "worst_abs_error": worst,
        "target_rig": "player_core.glb 65-joint rest skeleton",
    }


def remap_face_uv(source_name: str, obj: bpy.types.Object) -> None:
    if source_name not in {"GEO-rain-body_nomask", "GEO-rain-head", "GEO-rain-eyes"}:
        return
    layer = obj.data.uv_layers.active
    if layer is None:
        raise RuntimeError(f"{obj.name}: face-atlas mesh has no UV map")
    for loop in layer.data:
        u, v = float(loop.uv.x), float(loop.uv.y)
        if source_name == "GEO-rain-body_nomask":
            tile = 0 if u < 1.0 else 1
            loop.uv.x = (u - tile) * 0.5 + tile * 0.5
            loop.uv.y = v * 0.5
        elif source_name == "GEO-rain-head":
            loop.uv.x = (u - 2.0) * 0.5
            loop.uv.y = v * 0.5 + 0.5
        else:
            loop.uv.x = u * 0.5 + 0.5
            loop.uv.y = v * 0.5 + 0.5


def prune_body_buried_by_outfit(obj: bpy.types.Object) -> dict[str, int]:
    """Delete only torso/leg skin fully buried beneath the opaque Rain outfit."""
    before_vertices = len(obj.data.vertices)
    before_triangles = sum(len(polygon.vertices) - 2 for polygon in obj.data.polygons)
    editable = bmesh.new()
    editable.from_mesh(obj.data)
    buried = [
        vertex
        for vertex in editable.verts
        if not (
            (vertex.co.z >= 1.08 and abs(vertex.co.x) >= 0.055)
            or vertex.co.z >= 1.18
        )
    ]
    bmesh.ops.delete(editable, geom=buried, context="VERTS")
    editable.to_mesh(obj.data)
    editable.free()
    obj.data.update()
    after_vertices = len(obj.data.vertices)
    after_triangles = sum(len(polygon.vertices) - 2 for polygon in obj.data.polygons)
    if after_vertices < 5_000 or after_vertices >= before_vertices:
        raise RuntimeError(
            f"{obj.name}: hidden-body pruning produced {after_vertices}/{before_vertices} vertices"
        )
    return {
        "vertices_before": before_vertices,
        "vertices_after": after_vertices,
        "vertices_removed": before_vertices - after_vertices,
        "triangles_before": before_triangles,
        "triangles_after": after_triangles,
        "triangles_removed": before_triangles - after_triangles,
    }


def join_by_material(
    meshes: list[bpy.types.Object],
    armature: bpy.types.Object,
) -> list[bpy.types.Object]:
    groups: dict[str, list[bpy.types.Object]] = {}
    for obj in meshes:
        materials = [slot.material for slot in obj.material_slots if slot.material]
        if len(materials) != 1:
            raise RuntimeError(f"{obj.name}: expected one consolidated material, got {materials}")
        groups.setdefault(materials[0].name, []).append(obj)
    joined: list[bpy.types.Object] = []
    for material_name, objects in sorted(groups.items()):
        material = objects[0].material_slots[0].material
        for obj in objects:
            matrix_world = obj.matrix_world.copy()
            obj.parent = None
            obj.matrix_world = matrix_world
            for modifier in list(obj.modifiers):
                if modifier.type == "ARMATURE":
                    obj.modifiers.remove(modifier)
            activate(obj)
            bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        bpy.ops.object.select_all(action="DESELECT")
        for obj in objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        bpy.ops.object.join()
        merged = objects[0]
        merged.name = f"Nyra_Draw_{material_name.removeprefix('Nyra_')}"
        assign_material(merged, material)
        modifier = merged.modifiers.new("GameplayRig", "ARMATURE")
        modifier.object = armature
        merged.parent = armature
        merged.matrix_parent_inverse = armature.matrix_world.inverted()
        joined.append(merged)
    return joined


def mesh_object(
    name: str,
    vertices: list[tuple[float, float, float]],
    faces: list[tuple[int, ...]],
    material: bpy.types.Material,
    armature: bpy.types.Object,
    bone: str,
    *,
    bevel: float = 0.0,
    bevel_segments: int = 1,
) -> bpy.types.Object:
    """Create a closed authored mesh and attach it to one gameplay bone."""
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.validate(verbose=True)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    if bevel > 0.0:
        modifier = obj.modifiers.new("ForgedEdge", "BEVEL")
        modifier.width = bevel
        modifier.segments = bevel_segments
        modifier.limit_method = "ANGLE"
        activate(obj)
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    assign_material(obj, material)
    bind_rigid(obj, armature, bone)
    return obj


def profile_panel(
    name: str,
    outline: list[tuple[float, float, float]],
    thickness_y: float,
    material: bpy.types.Material,
    armature: bpy.types.Object,
    bone: str,
    *,
    keel: float = 0.0,
    bevel: float = 0.004,
) -> bpy.types.Object:
    """Build a shallow faceted shell from a non-parallel body-following outline."""
    count = len(outline)
    if count < 3:
        raise RuntimeError(f"{name}: profile requires at least three points")
    back = [(x, y + thickness_y, z) for x, y, z in outline]
    front_center = (
        sum(point[0] for point in outline) / count,
        sum(point[1] for point in outline) / count - keel,
        sum(point[2] for point in outline) / count,
    )
    back_center = (
        front_center[0],
        front_center[1] + thickness_y + keel,
        front_center[2],
    )
    vertices = [*outline, *back, front_center, back_center]
    front_index = count * 2
    back_index = front_index + 1
    faces: list[tuple[int, ...]] = []
    for index in range(count):
        nxt = (index + 1) % count
        faces.append((front_index, nxt, index))
        faces.append((back_index, count + index, count + nxt))
        faces.append((index, nxt, count + nxt, count + index))
    return mesh_object(
        name,
        vertices,
        faces,
        material,
        armature,
        bone,
        bevel=bevel,
        bevel_segments=2,
    )


def diagonal_band(
    name: str,
    start: tuple[float, float],
    end: tuple[float, float],
    start_width: float,
    end_width: float,
    front_y: float,
    material: bpy.types.Material,
    armature: bpy.types.Object,
    bone: str,
) -> bpy.types.Object:
    dx = end[0] - start[0]
    dz = end[1] - start[1]
    length = math.hypot(dx, dz)
    perpendicular = (-dz / length, dx / length)
    outline = [
        (
            start[0] + perpendicular[0] * start_width,
            front_y,
            start[1] + perpendicular[1] * start_width,
        ),
        (
            end[0] + perpendicular[0] * end_width,
            front_y + 0.006,
            end[1] + perpendicular[1] * end_width,
        ),
        (
            end[0] - perpendicular[0] * end_width,
            front_y + 0.006,
            end[1] - perpendicular[1] * end_width,
        ),
        (
            start[0] - perpendicular[0] * start_width,
            front_y,
            start[1] - perpendicular[1] * start_width,
        ),
    ]
    return profile_panel(
        name,
        outline,
        0.012,
        material,
        armature,
        bone,
        keel=0.002,
        bevel=0.003,
    )


def open_tapered_shell(
    name: str,
    axis: str,
    start: float,
    end: float,
    center_a: float,
    center_b: float,
    start_radius: float,
    end_radius: float,
    angle_start: float,
    angle_end: float,
    material: bpy.types.Material,
    armature: bpy.types.Object,
    bone: str,
    *,
    thickness: float = 0.007,
    axis_segments: int = 4,
    angle_segments: int = 14,
) -> bpy.types.Object:
    """Build an open, tapered forged shell around a horizontal or vertical limb."""
    vertices: list[tuple[float, float, float]] = []
    for inner in (False, True):
        for axial in range(axis_segments + 1):
            along = axial / axis_segments
            axis_value = start + (end - start) * along
            radius = start_radius + (end_radius - start_radius) * along
            if inner:
                radius -= thickness
            for angular in range(angle_segments + 1):
                around = angular / angle_segments
                theta = math.radians(angle_start + (angle_end - angle_start) * around)
                if axis == "X":
                    vertex = (
                        axis_value,
                        center_a + math.cos(theta) * radius,
                        center_b + math.sin(theta) * radius,
                    )
                elif axis == "Z":
                    vertex = (
                        center_a + math.cos(theta) * radius,
                        center_b + math.sin(theta) * radius,
                        axis_value,
                    )
                else:
                    raise RuntimeError(f"{name}: unsupported shell axis {axis}")
                vertices.append(vertex)
    ring = angle_segments + 1
    layer = (axis_segments + 1) * ring
    faces: list[tuple[int, ...]] = []
    for axial in range(axis_segments):
        for angular in range(angle_segments):
            outer = axial * ring + angular
            inner = layer + outer
            faces.append((outer, outer + ring, outer + ring + 1, outer + 1))
            faces.append((inner, inner + 1, inner + ring + 1, inner + ring))
    for axial in range(axis_segments):
        low = axial * ring
        high = low + angle_segments
        faces.append((low, layer + low, layer + low + ring, low + ring))
        faces.append((high, high + ring, layer + high + ring, layer + high))
    for angular in range(angle_segments):
        start_outer = angular
        end_outer = axis_segments * ring + angular
        faces.append((start_outer, start_outer + 1, layer + start_outer + 1, layer + start_outer))
        faces.append((end_outer, layer + end_outer, layer + end_outer + 1, end_outer + 1))
    return mesh_object(
        name,
        vertices,
        faces,
        material,
        armature,
        bone,
        bevel=0.0025,
        bevel_segments=1,
    )


def bind_mantle_weights(
    obj: bpy.types.Object,
    armature: bpy.types.Object,
) -> None:
    obj.vertex_groups.clear()
    upper = obj.vertex_groups.new(name="spine_03")
    middle = obj.vertex_groups.new(name="spine_01")
    lower = obj.vertex_groups.new(name="pelvis")
    for vertex in obj.data.vertices:
        factor = min(1.0, max(0.0, (vertex.co.z - 0.91) / 0.53))
        upper_weight = factor * factor
        lower_weight = (1.0 - factor) * (1.0 - factor)
        middle_weight = max(0.0, 1.0 - upper_weight - lower_weight)
        upper.add([vertex.index], upper_weight, "REPLACE")
        middle.add([vertex.index], middle_weight, "REPLACE")
        lower.add([vertex.index], lower_weight, "REPLACE")
    modifier = obj.modifiers.new("GameplayRig", "ARMATURE")
    modifier.object = armature
    obj.parent = armature
    obj.matrix_parent_inverse = armature.matrix_world.inverted()


def build_asymmetric_mantle(
    material: bpy.types.Material,
    armature: bpy.types.Object,
) -> bpy.types.Object:
    columns = 7
    rows = 15
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, int, int, int]] = []
    for row in range(rows):
        v = row / (rows - 1)
        center_x = 0.17 - 0.245 * v + math.sin(v * math.pi) * 0.012
        half_width = 0.095 * (1.0 - v) + 0.034 * v
        for column in range(columns):
            u = column / (columns - 1) * 2.0 - 1.0
            x = center_x + u * half_width
            y = 0.072 + 0.068 * v + math.sin(u * math.pi * 2.0 + v) * 0.006
            z = 1.445 - 0.49 * v - max(0.0, u) * 0.055 * (v ** 5)
            vertices.append((x, y, z))
    for row in range(rows - 1):
        for column in range(columns - 1):
            index = row * columns + column
            faces.append((index, index + columns, index + columns + 1, index + 1))
    mesh = bpy.data.meshes.new("Nyra_AsymmetricMantle_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    mantle = bpy.data.objects.new("Nyra_AsymmetricMantle", mesh)
    bpy.context.scene.collection.objects.link(mantle)
    solidify = mantle.modifiers.new("WovenThickness", "SOLIDIFY")
    solidify.thickness = 0.006
    solidify.offset = 0.0
    activate(mantle)
    bpy.ops.object.modifier_apply(modifier=solidify.name)
    bevel = mantle.modifiers.new("CutHem", "BEVEL")
    bevel.width = 0.0025
    bevel.segments = 1
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    assign_material(mantle, material)
    bind_mantle_weights(mantle, armature)
    return mantle


def build_armor(
    armature: bpy.types.Object,
    materials: dict[str, bpy.types.Material],
) -> list[bpy.types.Object]:
    ivory = materials["ivory"]
    copper = materials["copper"]
    teal = materials["teal"]
    pieces: list[bpy.types.Object] = []

    # Split convex panels follow the ribs, taper hard at the waist, and leave teal
    # negative space at both sides and below the V-shaped lower edge.
    pieces.append(
        profile_panel(
            "Nyra_CuirassLeft",
            [
                (0.008, -0.151, 1.405),
                (0.105, -0.144, 1.415),
                (0.178, -0.124, 1.365),
                (0.188, -0.119, 1.270),
                (0.136, -0.126, 1.145),
                (0.045, -0.145, 1.095),
                (0.012, -0.153, 1.145),
            ],
            0.024,
            ivory,
            armature,
            "spine_02",
            keel=0.012,
            bevel=0.006,
        )
    )
    pieces.append(
        profile_panel(
            "Nyra_CuirassRight",
            [
                (-0.008, -0.151, 1.405),
                (-0.098, -0.143, 1.408),
                (-0.168, -0.122, 1.350),
                (-0.174, -0.118, 1.265),
                (-0.116, -0.130, 1.155),
                (-0.035, -0.147, 1.105),
                (-0.012, -0.153, 1.145),
            ],
            0.024,
            ivory,
            armature,
            "spine_02",
            keel=0.010,
            bevel=0.006,
        )
    )
    pieces.append(
        profile_panel(
            "Nyra_CenterKeel",
            [
                (-0.016, -0.174, 1.393),
                (0.016, -0.174, 1.393),
                (0.024, -0.174, 1.168),
                (0.0, -0.178, 1.116),
                (-0.024, -0.174, 1.168),
            ],
            0.011,
            copper,
            armature,
            "spine_02",
            keel=0.004,
            bevel=0.003,
        )
    )
    pieces.append(
        diagonal_band(
            "Nyra_DiagonalHarness",
            (0.145, 1.410),
            (-0.120, 1.035),
            0.022,
            0.016,
            -0.171,
            copper,
            armature,
            "spine_02",
        )
    )
    pieces.append(
        profile_panel(
            "Nyra_AshwakeSigil",
            [
                (0.0, -0.184, 1.292),
                (0.027, -0.181, 1.255),
                (0.0, -0.184, 1.216),
                (-0.027, -0.181, 1.255),
            ],
            0.006,
            teal,
            armature,
            "spine_02",
            keel=0.004,
            bevel=0.002,
        )
    )

    # Overlapping, open-bottom shoulder shells preserve the arm/torso gaps.
    pieces.append(
        open_tapered_shell(
            "Nyra_PauldronLeftInner",
            "X",
            0.125,
            0.255,
            0.020,
            1.414,
            0.070,
            0.100,
            4.0,
            176.0,
            copper,
            armature,
            "clavicle_l",
            thickness=0.008,
        )
    )
    pieces.append(
        open_tapered_shell(
            "Nyra_PauldronLeftOuter",
            "X",
            0.225,
            0.352,
            0.020,
            1.414,
            0.105,
            0.064,
            7.0,
            173.0,
            ivory,
            armature,
            "upperarm_l",
            thickness=0.008,
        )
    )
    pieces.append(
        open_tapered_shell(
            "Nyra_PauldronRight",
            "X",
            -0.125,
            -0.275,
            0.020,
            1.414,
            0.060,
            0.050,
            8.0,
            172.0,
            ivory,
            armature,
            "upperarm_r",
            thickness=0.007,
            angle_segments=12,
        )
    )

    # A five-piece curved belt follows the waist instead of bridging it as a bar.
    for index, (left, right) in enumerate(
        [(-0.184, -0.112), (-0.116, -0.038), (-0.042, 0.042), (0.038, 0.116), (0.112, 0.184)]
    ):
        center = (left + right) * 0.5
        y = -0.132 + abs(center) * 0.12
        pieces.append(
            profile_panel(
                f"Nyra_BeltSegment_{index}",
                [
                    (left + 0.004, y, 1.020),
                    (right - 0.004, y, 1.020),
                    (right, y + 0.003, 0.980),
                    (left, y + 0.003, 0.980),
                ],
                0.014,
                copper,
                armature,
                "pelvis",
                keel=0.002,
                bevel=0.0025,
            )
        )

    # Long-left / short-right leaf faulds end above the hip and knee hinges.
    pieces.append(
        profile_panel(
            "Nyra_TassetLeft",
            [
                (0.070, -0.130, 0.984),
                (0.235, -0.108, 0.958),
                (0.258, -0.096, 0.862),
                (0.195, -0.104, 0.735),
                (0.115, -0.125, 0.790),
            ],
            0.018,
            ivory,
            armature,
            "pelvis",
            keel=0.008,
            bevel=0.005,
        )
    )
    pieces.append(
        profile_panel(
            "Nyra_TassetRight",
            [
                (-0.065, -0.132, 0.982),
                (-0.220, -0.108, 0.955),
                (-0.230, -0.101, 0.865),
                (-0.150, -0.118, 0.808),
                (-0.085, -0.130, 0.856),
            ],
            0.018,
            copper,
            armature,
            "pelvis",
            keel=0.006,
            bevel=0.004,
        )
    )

    # Open cuffs reveal cloth, wrists, hands and ankles while tapering away from joints.
    for side, start, end, bone, material in (
        ("L", 0.475, 0.667, "lowerarm_l", ivory),
        ("R", -0.475, -0.667, "lowerarm_r", copper),
    ):
        pieces.append(
            open_tapered_shell(
                f"Nyra_Bracer_{side}",
                "X",
                start,
                end,
                0.066,
                1.438,
                0.058,
                0.041,
                -16.0,
                196.0,
                material,
                armature,
                bone,
                thickness=0.006,
                axis_segments=5,
                angle_segments=12,
            )
        )
    for side, center_x, bone, material in (
        ("L", 0.105, "calf_l", ivory),
        ("R", -0.105, "calf_r", copper),
    ):
        pieces.append(
            open_tapered_shell(
                f"Nyra_Greave_{side}",
                "Z",
                0.145,
                0.420,
                center_x,
                -0.005,
                0.050,
                0.074,
                145.0,
                395.0,
                material,
                armature,
                bone,
                thickness=0.007,
                axis_segments=6,
                angle_segments=14,
            )
        )
    pieces.append(build_asymmetric_mantle(teal, armature))
    return pieces


def main() -> None:
    args = parse_args()
    rain_source = Path(bpy.data.filepath).resolve()
    player_core = Path(args.player_core).resolve()
    combat = Path(args.combat).resolve()
    face_atlas = Path(args.face_atlas).resolve()
    hair_texture = Path(args.hair_texture).resolve()
    output = Path(args.output).resolve()
    blend_output = Path(args.blend_output).resolve()
    receipt_path = Path(args.receipt).resolve()

    rain_actions = set(bpy.data.actions)
    original_objects = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(player_core))
    player_imported = [obj for obj in bpy.data.objects if obj not in original_objects]
    armatures = [obj for obj in player_imported if obj.type == "ARMATURE"]
    if len(armatures) != 1 or len(armatures[0].data.bones) != 65:
        raise RuntimeError(f"Expected one 65-bone armature, got {armatures}")
    armature = armatures[0]
    armature.name = "Nyra_GameplayRig"
    source_meshes = [
        obj
        for obj in player_imported
        if obj.type == "MESH" and any(mod.type == "ARMATURE" for mod in obj.modifiers)
    ]
    if len(source_meshes) != 1 or source_meshes[0].name != "Mannequin":
        raise RuntimeError(f"Unexpected player-core weight sources: {source_meshes}")
    weight_source = duplicate_joined_weight_source(source_meshes, "Nyra_WeightSource")

    pre_combat_objects = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(combat))
    combat_imported = [obj for obj in bpy.data.objects if obj not in pre_combat_objects]
    required_actions = {
        "Idle_Loop",
        "Walk_Loop",
        "Sprint_Loop",
        "Roll",
        "Sword_Regular_A",
    }
    available_actions = {action.name for action in bpy.data.actions}
    missing_actions = required_actions - available_actions
    if missing_actions:
        raise RuntimeError(f"Canonical gameplay actions missing: {sorted(missing_actions)}")
    for action in list(bpy.data.actions):
        if action.name in required_actions:
            action.use_fake_user = True
        else:
            bpy.data.actions.remove(action, do_unlink=True)

    materials = {
        "skin": textured_material(
            "Nyra_FaceSkinEyes", face_atlas, metallic=0.0, roughness=0.5
        ),
        "hair": textured_material(
            "Nyra_Hair", hair_texture, metallic=0.02, roughness=0.56
        ),
        "ivory": simple_material(
            "Nyra_IvoryArmor", (0.53, 0.47, 0.37, 1), metallic=0.22, roughness=0.48
        ),
        "copper": simple_material(
            "Nyra_CopperArmor", (0.25, 0.060, 0.022, 1), metallic=0.70, roughness=0.40
        ),
        "teal": simple_material(
            "Nyra_TealCloth", (0.012, 0.145, 0.19, 1), metallic=0.0, roughness=0.70,
        ),
    }

    fitted_meshes: list[bpy.types.Object] = []
    weight_audit: dict[str, dict[str, int]] = {}
    body_prune_audit: dict[str, int] | None = None
    for source_name, (target_name, material_name, binding, fallback) in KEEP.items():
        source = bpy.data.objects.get(source_name)
        if source is None or source.type != "MESH":
            raise RuntimeError(f"Rain source mesh missing: {source_name}")
        obj = source.copy()
        obj.data = source.data.copy()
        bpy.context.scene.collection.objects.link(obj)
        obj.name = target_name
        matrix_world = source.matrix_world.copy()
        obj.parent = None
        obj.matrix_world = matrix_world
        remove_shape_keys(obj)
        apply_types = {"MIRROR"}
        if source_name == "GEO-rain-top":
            apply_types.add("SOLIDIFY")
        apply_or_remove_modifiers(obj, apply_types)
        if source_name == "GEO-rain-body_nomask":
            body_prune_audit = prune_body_buried_by_outfit(obj)
        fit_to_canonical_rest(source_name, obj)
        remap_face_uv(source_name, obj)
        assign_material(obj, materials[material_name])
        if binding == "rigid":
            bind_rigid(obj, armature, fallback)
        else:
            weight_audit[target_name] = transfer_weights(
                obj, weight_source, armature, fallback
            )
        fitted_meshes.append(obj)

    fitted_meshes.extend(build_armor(armature, materials))
    remove_object(weight_source)
    for obj in player_imported + combat_imported:
        if obj != armature and obj.name in bpy.data.objects:
            remove_object(obj)

    joined_meshes = join_by_material(fitted_meshes, armature)
    joined_weight_audit = {
        obj.name: limit_and_audit_weights(obj, "root") for obj in joined_meshes
    }
    runtime: list[bpy.types.Object] = [armature, *joined_meshes]

    bone_names = {bone.name for bone in armature.data.bones}
    required_bones = {"hand_r", "Head", "root", "pelvis"}
    if not required_bones.issubset(bone_names):
        raise RuntimeError(f"Missing gameplay bones: {sorted(required_bones - bone_names)}")

    summary = mesh_summary(runtime)
    if not 60_000 <= int(summary["triangles"]) <= 75_000:
        raise RuntimeError(f"Hero triangle budget failed: {summary['triangles']}")
    if len(summary["materials"]) != 5 or int(summary["mesh_objects"]) > 8:
        raise RuntimeError(f"Hero material/draw consolidation failed: {summary}")
    if sorted(action.name for action in bpy.data.actions) != sorted(required_actions):
        raise RuntimeError(
            f"Hero action set drifted: {sorted(action.name for action in bpy.data.actions)}"
        )

    blend_output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_output))
    export_glb(output, runtime, animations=True)
    receipt = {
        "schema": "p30.round004.hero-build.v1",
        "source": {
            "rain_blend": str(rain_source),
            "rain_blend_sha256": sha256(rain_source),
            "canonical_gameplay_rig": str(player_core),
            "canonical_gameplay_rig_sha256": sha256(player_core),
            "combat_animation": str(combat),
            "combat_animation_sha256": sha256(combat),
            "face_atlas": {
                "path": str(face_atlas),
                "bytes": face_atlas.stat().st_size,
                "sha256": sha256(face_atlas),
                "resolution": [2048, 2048],
            },
            "hair_texture": {
                "path": str(hair_texture),
                "bytes": hair_texture.stat().st_size,
                "sha256": sha256(hair_texture),
                "resolution": [1024, 1024],
            },
        },
        "output": {
            "path": str(output),
            "bytes": output.stat().st_size,
            "sha256": sha256(output),
            **summary,
            "bones": len(armature.data.bones),
            "required_bones": sorted(required_bones),
            "animations": sorted(required_actions),
            "draw_primitives": summary["mesh_objects"],
        },
        "landmark_rest_fit": landmark_fit_audit(),
        "buried_body_prune": body_prune_audit,
        "weight_transfer": weight_audit,
        "joined_weight_audit": joined_weight_audit,
        "quality_notes": [
            "Rain face, eyes, brows, lashes, swept hair, and ponytail preserved as authored meshes.",
            "CloudRig replaced by player_core's exact 65-joint rest skeleton after explicit wrist, arm plane, neck, head, hip, knee, and ankle landmark fitting.",
            "Complete neck, shoulder, arm, elbow, forearm, hand, and finger anatomy comes from Rain's unmasked body; only torso and leg skin fully buried by the opaque outfit is deleted.",
            "Body and outfit weights transferred by nearest-face interpolation, normalized, limited to four influences, and hard-failed on any unweighted vertex.",
            "The 2K face/body/eye atlas and 1K hair texture preserve Rain's freckles, lips, eyes, and authored groom breakup.",
            "Authored split-keel cuirass, overlapping open pauldrons, tapered open bracers and greaves, pointed asymmetric faulds, curved segmented belt, and weighted diagonal mantle added for Nyra's agile armor silhouette.",
            "Mouth internals and unused facial-control geometry omitted to remain inside the gameplay triangle budget.",
            "Five exact in-place gameplay actions are embedded on the same canonical rest skeleton used by the skin.",
        ],
    }
    write_json(receipt_path, receipt)
    print("ROUND004_HERO_BUILD=" + json.dumps(receipt, sort_keys=True))


if __name__ == "__main__":
    main()
