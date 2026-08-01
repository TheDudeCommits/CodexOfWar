"""Build the asymmetrical Round004 Hollow on the stable zombie rig and clips."""

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
    assign_material,
    bind_rigid,
    export_glb,
    limit_and_audit_weights,
    mesh_summary,
    remove_object,
    sha256,
    simple_material,
    textured_material,
    write_json,
)


REQUIRED_ACTIONS = {"Idle", "HitReact", "Death"}


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--atlas", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--blend-output", required=True)
    parser.add_argument("--receipt", required=True)
    return parser.parse_args(argv)


def deformed_z(z: float) -> float:
    if z <= 0.55:
        return z * 1.12
    return 0.616 + (z - 0.55) * 1.07


def deform_hollow_mesh(obj: bpy.types.Object, *, eyelid: bool = False) -> None:
    for vertex in obj.data.vertices:
        x, y, z = float(vertex.co.x), float(vertex.co.y), float(vertex.co.z)
        if eyelid:
            vertex.co.x = x * 0.86 - 0.010
            vertex.co.y = -0.08 + (y + 0.08) * 0.84 - 0.045
            vertex.co.z = deformed_z(z)
            continue

        # Unequal long arms, a high left shoulder, and a dropped sword-side shoulder.
        if abs(x) > 0.21 and z > 0.68:
            if x > 0.0:
                x *= 1.11
                z += 0.026
            else:
                x *= 1.19
                z -= 0.034

        # Pull the waist inward while keeping the upper back broad enough to hunch.
        if abs(x) < 0.34 and 0.48 < z < 0.75:
            waist = 1.0 - math.sin((z - 0.48) / 0.27 * math.pi) * 0.16
            x *= waist

        # Reduce the chibi head width/depth, push it forward, and bias the broken jaw.
        is_head = (z > 0.88 and abs(x) < 0.40) or (
            z > 0.76 and abs(x) < 0.26 and y < -0.04
        )
        if is_head:
            x = x * 0.86 - 0.010
            y = -0.08 + (y + 0.08) * 0.84 - 0.045
            if x > 0.02 and z < 0.94:
                x += 0.018
                y -= 0.018

        vertex.co.x = x
        vertex.co.y = y
        vertex.co.z = deformed_z(z)
    obj.data.update()


def remove_source_sneaker(obj: bpy.types.Object) -> dict[str, int]:
    """Remove the connected shod-foot region before fitting the replacement boot."""
    before = len(obj.data.vertices)
    editable = bmesh.new()
    editable.from_mesh(obj.data)
    shod = [
        vertex
        for vertex in editable.verts
        if vertex.co.x > 0.050 and vertex.co.z < 0.235
    ]
    bmesh.ops.delete(editable, geom=shod, context="VERTS")
    editable.to_mesh(obj.data)
    editable.free()
    obj.data.update()
    removed = before - len(obj.data.vertices)
    if removed < 300:
        raise RuntimeError(f"Source sneaker removal was incomplete: {removed} vertices")
    return {"vertices_before": before, "vertices_removed": removed, "vertices_after": len(obj.data.vertices)}


def mesh_object(
    name: str,
    vertices: list[tuple[float, float, float]],
    faces: list[tuple[int, ...]],
    material: bpy.types.Material,
    armature: bpy.types.Object,
    bone: str,
    *,
    bevel: float = 0.0,
) -> bpy.types.Object:
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.validate(verbose=True)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    if bevel > 0.0:
        modifier = obj.modifiers.new("RotSoftEdge", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
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
    bevel: float = 0.003,
) -> bpy.types.Object:
    count = len(outline)
    back = [(x, y + thickness_y, z) for x, y, z in outline]
    vertices = [*outline, *back]
    faces: list[tuple[int, ...]] = [tuple(reversed(range(count))), tuple(range(count, count * 2))]
    for index in range(count):
        nxt = (index + 1) % count
        faces.append((index, nxt, count + nxt, count + index))
    return mesh_object(
        name, vertices, faces, material, armature, bone, bevel=bevel
    )


def ellipsoid(
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    rotation: tuple[float, float, float],
    material: bpy.types.Material,
    armature: bpy.types.Object,
    bone: str,
    *,
    segments: int = 16,
    rings: int = 10,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segments,
        ring_count=rings,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    activate(obj)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    assign_material(obj, material)
    bind_rigid(obj, armature, bone)
    return obj


def spike(
    name: str,
    location: tuple[float, float, float],
    radius: float,
    depth: float,
    rotation: tuple[float, float, float],
    material: bpy.types.Material,
    armature: bpy.types.Object,
    bone: str,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cone_add(
        vertices=9,
        radius1=radius,
        radius2=0.002,
        depth=depth,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    bevel = obj.modifiers.new("ChippedEdge", "BEVEL")
    bevel.width = 0.003
    bevel.segments = 1
    activate(obj)
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    assign_material(obj, material)
    bind_rigid(obj, armature, bone)
    return obj


def wound_ring(
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    rotation: tuple[float, float, float],
    wound: bpy.types.Material,
    rim: bpy.types.Material,
    armature: bpy.types.Object,
    bone: str,
) -> list[bpy.types.Object]:
    cavity = ellipsoid(
        f"{name}_Cavity",
        location,
        scale,
        rotation,
        wound,
        armature,
        bone,
        segments=14,
        rings=8,
    )
    bpy.ops.mesh.primitive_torus_add(
        major_radius=1.0,
        minor_radius=0.16,
        major_segments=16,
        minor_segments=6,
        location=(location[0], location[1] - 0.004, location[2]),
        rotation=rotation,
    )
    ring = bpy.context.object
    ring.name = f"{name}_RaggedRim"
    ring.scale = (scale[0] * 0.86, max(0.010, scale[1]), scale[2] * 0.86)
    activate(ring)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    assign_material(ring, rim)
    bind_rigid(ring, armature, bone)
    return [cavity, ring]


def spiral_wrap(
    material: bpy.types.Material,
    armature: bpy.types.Object,
) -> bpy.types.Object:
    segments = 34
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, int, int, int]] = []
    for index in range(segments + 1):
        factor = index / segments
        theta = -math.pi * 0.62 + factor * math.pi * 2.25
        center_z = 0.895 - factor * 0.225
        radius_x = 0.255 - factor * 0.028
        radius_y = 0.184 - factor * 0.012
        for edge in (-1.0, 1.0):
            vertices.append(
                (
                    math.cos(theta) * radius_x,
                    math.sin(theta) * radius_y + 0.025,
                    center_z + edge * 0.034,
                )
            )
    for index in range(segments):
        start = index * 2
        faces.append((start, start + 2, start + 3, start + 1))
    mesh = bpy.data.meshes.new("Hollow_DiagonalWrap_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    wrap = bpy.data.objects.new("Hollow_DiagonalWrap", mesh)
    bpy.context.scene.collection.objects.link(wrap)
    solidify = wrap.modifiers.new("FrayedThickness", "SOLIDIFY")
    solidify.thickness = 0.008
    solidify.offset = 0.0
    activate(wrap)
    bpy.ops.object.modifier_apply(modifier=solidify.name)
    bevel = wrap.modifiers.new("WornEdge", "BEVEL")
    bevel.width = 0.003
    bevel.segments = 1
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    assign_material(wrap, material)
    bind_rigid(wrap, armature, "Torso")
    return wrap


def ellipse_band(
    name: str,
    center_z: float,
    radius_x: float,
    radius_y: float,
    height: float,
    material: bpy.types.Material,
    armature: bpy.types.Object,
    bone: str,
) -> bpy.types.Object:
    segments = 24
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, int, int, int]] = []
    for index in range(segments):
        theta = index / segments * math.pi * 2.0
        for edge in (-1.0, 1.0):
            vertices.append(
                (
                    math.cos(theta) * radius_x,
                    math.sin(theta) * radius_y + 0.035,
                    center_z + edge * height * 0.5,
                )
            )
    for index in range(segments):
        nxt = (index + 1) % segments
        faces.append((index * 2, nxt * 2, nxt * 2 + 1, index * 2 + 1))
    return mesh_object(name, vertices, faces, material, armature, bone, bevel=0.003)


def torn_tabard(
    name: str,
    front_y: float,
    material: bpy.types.Material,
    armature: bpy.types.Object,
) -> bpy.types.Object:
    columns = 6
    rows = 9
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, int, int, int]] = []
    is_front = front_y < 0.0
    for row in range(rows):
        v = row / (rows - 1)
        half_width = (0.245 if is_front else 0.205) * (1.0 - v * 0.27)
        for column in range(columns):
            u = column / (columns - 1) * 2.0 - 1.0
            x = u * half_width - (0.025 if is_front else -0.015) * v
            y = front_y + (0.025 * v if is_front else -0.018 * v)
            torn = max(0.0, v - 0.78) * (
                0.050 + 0.050 * abs(math.sin((column + 1) * 2.17))
            )
            z = 0.635 - v * 0.365 + torn
            vertices.append((x, y, z))
    for row in range(rows - 1):
        for column in range(columns - 1):
            index = row * columns + column
            faces.append((index, index + columns, index + columns + 1, index + 1))
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    panel = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(panel)
    solidify = panel.modifiers.new("TornThickness", "SOLIDIFY")
    solidify.thickness = 0.008
    solidify.offset = 0.0
    activate(panel)
    bpy.ops.object.modifier_apply(modifier=solidify.name)
    assign_material(panel, material)
    bind_rigid(panel, armature, "Hips")
    return panel


def open_greave(
    material: bpy.types.Material,
    armature: bpy.types.Object,
) -> bpy.types.Object:
    axis_segments = 6
    angle_segments = 14
    vertices: list[tuple[float, float, float]] = []
    for inner in (False, True):
        for axial in range(axis_segments + 1):
            factor = axial / axis_segments
            z = 0.12 + factor * 0.31
            radius = 0.074 + factor * 0.024 - (0.008 if inner else 0.0)
            for angular in range(angle_segments + 1):
                theta = math.radians(145 + angular / angle_segments * 250)
                vertices.append(
                    (
                        0.145 + math.cos(theta) * radius,
                        0.08 + math.sin(theta) * radius,
                        z,
                    )
                )
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
        for angular in (0, angle_segments):
            first = axial * ring + angular
            faces.append((first, layer + first, layer + first + ring, first + ring))
    for angular in range(angle_segments):
        for axial in (0, axis_segments):
            first = axial * ring + angular
            if axial == 0:
                faces.append((first, first + 1, layer + first + 1, layer + first))
            else:
                faces.append((first, layer + first, layer + first + 1, first + 1))
    return mesh_object(
        "Hollow_CorrodedGreave",
        vertices,
        faces,
        material,
        armature,
        "LowerLeg.L",
        bevel=0.002,
    )


def foot_shroud(
    material: bpy.types.Material,
    armature: bpy.types.Object,
) -> bpy.types.Object:
    centers = [(0.13, 0.22, 0.115), (0.01, 0.19, 0.105), (-0.22, 0.14, 0.075), (-0.39, 0.10, 0.045)]
    vertices: list[tuple[float, float, float]] = []
    for y, width, top in centers:
        vertices.extend(
            [
                (-0.145 - width * 0.5, y, 0.006),
                (-0.145 + width * 0.5, y, 0.006),
                (-0.145 - width * 0.46, y, top),
                (-0.145 + width * 0.46, y, top),
            ]
        )
    faces: list[tuple[int, ...]] = []
    for section in range(len(centers) - 1):
        base = section * 4
        nxt = base + 4
        faces.extend(
            [
                (base, nxt, nxt + 1, base + 1),
                (base + 2, base + 3, nxt + 3, nxt + 2),
                (base, base + 2, nxt + 2, nxt),
                (base + 1, nxt + 1, nxt + 3, base + 3),
            ]
        )
    faces.extend([(0, 1, 3, 2), (12, 14, 15, 13)])
    return mesh_object(
        "Hollow_FootShroud",
        vertices,
        faces,
        material,
        armature,
        "Foot.R",
        bevel=0.009,
    )


def torn_leaf(
    name: str,
    center_x: float,
    half_width: float,
    bottom_z: float,
    front_y: float,
    material: bpy.types.Material,
    armature: bpy.types.Object,
) -> bpy.types.Object:
    columns = 4
    rows = 7
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, int, int, int]] = []
    for row in range(rows):
        factor = row / (rows - 1)
        width = half_width * (1.0 - factor * 0.42)
        for column in range(columns):
            across = column / (columns - 1) * 2.0 - 1.0
            x = center_x + across * width + factor * 0.018
            y = front_y + math.sin(factor * math.pi) * (-0.018 if front_y < 0 else 0.018)
            jagged = (0.030 + 0.020 * abs(math.sin((column + 1) * 2.31))) * (factor ** 7)
            z = 0.630 + (bottom_z - 0.630) * factor + jagged
            vertices.append((x, y, z))
    for row in range(rows - 1):
        for column in range(columns - 1):
            index = row * columns + column
            faces.append((index, index + columns, index + columns + 1, index + 1))
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    leaf = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(leaf)
    solidify = leaf.modifiers.new("FrayedThickness", "SOLIDIFY")
    solidify.thickness = 0.007
    solidify.offset = 0.0
    activate(leaf)
    bpy.ops.object.modifier_apply(modifier=solidify.name)
    assign_material(leaf, material)
    bind_rigid(leaf, armature, "Hips")
    return leaf


def flush_wound(
    name: str,
    center: tuple[float, float],
    radius: tuple[float, float],
    front_y: float,
    angle: float,
    rim: bpy.types.Material,
    core: bpy.types.Material,
    armature: bpy.types.Object,
    bone: str,
) -> list[bpy.types.Object]:
    def outline(scale: float, y: float) -> list[tuple[float, float, float]]:
        points: list[tuple[float, float, float]] = []
        for index in range(7):
            theta = index / 7.0 * math.pi * 2.0
            rough = (1.0, 0.82, 1.08, 0.88, 1.04, 0.79, 0.96)[index]
            local_x = math.cos(theta) * radius[0] * scale * rough
            local_z = math.sin(theta) * radius[1] * scale * rough
            rotated_x = local_x * math.cos(angle) - local_z * math.sin(angle)
            rotated_z = local_x * math.sin(angle) + local_z * math.cos(angle)
            points.append((center[0] + rotated_x, y, center[1] + rotated_z))
        return points

    return [
        profile_panel(
            f"{name}_FlushSlit",
            outline(0.54, front_y - 0.003),
            0.004,
            core,
            armature,
            bone,
            bevel=0.0005,
        )
    ]


def open_forearm_growth(
    material: bpy.types.Material,
    armature: bpy.types.Object,
) -> bpy.types.Object:
    axis_segments = 7
    angle_segments = 13
    vertices: list[tuple[float, float, float]] = []
    for inner in (False, True):
        for axial in range(axis_segments + 1):
            factor = axial / axis_segments
            x = 0.430 + factor * 0.335
            radius = 0.065 + factor * 0.035 - (0.008 if inner else 0.0)
            for angular in range(angle_segments + 1):
                theta = math.radians(-18 + angular / angle_segments * 218)
                vertices.append((x, 0.135 + math.cos(theta) * radius, 0.965 + math.sin(theta) * radius))
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
        for angular in (0, angle_segments):
            first = axial * ring + angular
            faces.append((first, layer + first, layer + first + ring, first + ring))
    for angular in range(angle_segments):
        for axial in (0, axis_segments):
            first = axial * ring + angular
            if axial == 0:
                faces.append((first, first + 1, layer + first + 1, layer + first))
            else:
                faces.append((first, layer + first, layer + first + 1, first + 1))
    return mesh_object(
        "Hollow_TaperedForearmGrowth",
        vertices,
        faces,
        material,
        armature,
        "LowerArm.L",
        bevel=0.002,
    )


def join_by_material(
    meshes: list[bpy.types.Object],
    armature: bpy.types.Object,
) -> list[bpy.types.Object]:
    groups: dict[str, list[bpy.types.Object]] = {}
    for obj in meshes:
        materials = [slot.material for slot in obj.material_slots if slot.material]
        if len(materials) != 1:
            raise RuntimeError(f"{obj.name}: expected one material, got {materials}")
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
        merged.name = f"Hollow_Draw_{material_name.removeprefix('Hollow_')}"
        assign_material(merged, material)
        modifier = merged.modifiers.new("GameplayRig", "ARMATURE")
        modifier.object = armature
        merged.parent = armature
        merged.matrix_parent_inverse = armature.matrix_world.inverted()
        joined.append(merged)
    return joined


def build_details(
    armature: bpy.types.Object,
    materials: dict[str, bpy.types.Material],
) -> list[bpy.types.Object]:
    cloth = materials["cloth"]
    bone = materials["bone"]
    wound = materials["wound"]
    eye = materials["eye"]
    pieces: list[bpy.types.Object] = []

    pieces.extend(
        [
            spiral_wrap(cloth, armature),
            ellipse_band("Hollow_WaistWrap", 0.635, 0.235, 0.170, 0.064, cloth, armature, "Hips"),
            ellipse_band("Hollow_Cowl", 0.925, 0.215, 0.155, 0.070, cloth, armature, "Torso"),
            torn_leaf("Hollow_TabardFrontLeft", -0.055, 0.058, 0.355, -0.202, cloth, armature),
            torn_leaf("Hollow_TabardFrontRight", 0.065, 0.054, 0.405, -0.198, cloth, armature),
            torn_leaf("Hollow_TabardBack", -0.010, 0.060, 0.370, 0.202, cloth, armature),
            open_greave(bone, armature),
            ellipsoid(
                "Hollow_WrappedBoot",
                (0.145, -0.080, 0.070),
                (0.115, 0.205, 0.070),
                (0.0, 0.0, 0.0),
                cloth,
                armature,
                "Foot.L",
                segments=16,
                rings=9,
            ),
            ellipsoid(
                "Hollow_SkullHood",
                (0.0, 0.045, 1.145),
                (0.215, 0.075, 0.235),
                (0.0, 0.0, 0.0),
                cloth,
                armature,
                "Head",
                segments=18,
                rings=11,
            ),
        ]
    )

    # High left scapula and unequal armored forearm destroy the cute symmetric read.
    pieces.append(
        ellipsoid(
            "Hollow_HighScapula",
            (0.185, 0.190, 0.985),
            (0.125, 0.038, 0.085),
            (0.22, -0.16, -0.22),
            bone,
            armature,
            "Torso",
            segments=18,
            rings=11,
        )
    )
    pieces.append(open_forearm_growth(bone, armature))
    for index, (location, rotation) in enumerate(
        [
            ((0.145, 0.260, 1.045), (-1.28, 0.12, -0.18)),
            ((0.205, 0.270, 1.010), (-1.20, -0.10, 0.08)),
            ((0.260, 0.250, 0.970), (-1.14, 0.16, 0.18)),
        ]
    ):
        pieces.append(
            spike(
                f"Hollow_ScapulaSpike_{index}",
                location,
                0.022 - index * 0.003,
                0.125 - index * 0.012,
                rotation,
                bone,
                armature,
                "Torso",
            )
        )
    for index, (bone_name, y, z) in enumerate(
        [
            ("Index3.L", 0.060, 1.005),
            ("Middle3.L", 0.135, 0.995),
            ("Pinky3.L", 0.205, 0.970),
        ]
    ):
        pieces.append(
            spike(
                f"Hollow_Claw_{index}",
                (0.982, y, z),
                0.020,
                0.145,
                (0.0, math.pi / 2.0, 0.0),
                bone,
                armature,
                bone_name,
            )
        )

    # Flush, irregular dark rims with small wet cores avoid the attached-saucer read.
    pieces.extend(
        flush_wound(
            "Hollow_ShoulderCavity",
            (0.245, 0.970),
            (0.048, 0.022),
            -0.154,
            -0.24,
            cloth,
            wound,
            armature,
            "Shoulder.L",
        )
    )
    pieces.extend(
        flush_wound(
            "Hollow_RibSlit",
            (-0.170, 0.760),
            (0.050, 0.012),
            -0.194,
            0.52,
            cloth,
            wound,
            armature,
            "Abdomen",
        )
    )
    pieces.extend(
        flush_wound(
            "Hollow_ThighWound",
            (0.175, 0.430),
            (0.026, 0.034),
            -0.104,
            -0.18,
            cloth,
            wound,
            armature,
            "UpperLeg.L",
        )
    )
    pieces.append(
        ellipsoid(
            "Hollow_HotEye",
            (-0.118, -0.316, 1.105),
            (0.014, 0.006, 0.017),
            (0.0, 0.0, -0.14),
            eye,
            armature,
            "Head",
            segments=16,
            rings=9,
        )
    )
    for index, x in enumerate((0.080, 0.128)):
        pieces.append(
            spike(
                f"Hollow_JawTooth_{index}",
                (x, -0.398, 0.882 + index * 0.008),
                0.009,
                0.044,
                (0.12, 0.0, math.pi),
                bone,
                armature,
                "Head",
            )
        )
    return pieces


def main() -> None:
    args = parse_args()
    source = Path(args.source).resolve()
    atlas = Path(args.atlas).resolve()
    output = Path(args.output).resolve()
    blend_output = Path(args.blend_output).resolve()
    receipt_path = Path(args.receipt).resolve()

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(source))
    armatures = [obj for obj in bpy.data.objects if obj.type == "ARMATURE"]
    if len(armatures) != 1 or len(armatures[0].data.bones) != 50:
        raise RuntimeError(f"Expected source 50-bone Hollow rig, got {armatures}")
    armature = armatures[0]
    armature.name = "Hollow_GameplayRig"
    bone_names = {bone.name for bone in armature.data.bones}
    required_bones = {
        "Root",
        "Hips",
        "Torso",
        "Head",
        "Shoulder.L",
        "LowerArm.L",
        "UpperLeg.L",
        "LowerLeg.L",
        "Foot.L",
    }
    if not required_bones.issubset(bone_names):
        raise RuntimeError(f"Hollow bones missing: {sorted(required_bones - bone_names)}")

    available_actions = {action.name for action in bpy.data.actions}
    if not REQUIRED_ACTIONS.issubset(available_actions):
        raise RuntimeError(f"Hollow actions missing: {sorted(REQUIRED_ACTIONS - available_actions)}")
    for action in list(bpy.data.actions):
        if action.name in REQUIRED_ACTIONS:
            action.use_fake_user = True
        else:
            bpy.data.actions.remove(action, do_unlink=True)

    materials = {
        "atlas": textured_material(
            "Hollow_CorpseAtlas", atlas, metallic=0.0, roughness=0.88
        ),
        "cloth": simple_material(
            "Hollow_CharcoalWraps", (0.012, 0.016, 0.016, 1.0), metallic=0.01, roughness=0.96
        ),
        "bone": simple_material(
            "Hollow_BoneCorrosion", (0.065, 0.070, 0.046, 1.0), metallic=0.04, roughness=0.90
        ),
        "wound": simple_material(
            "Hollow_WetWounds",
            (0.055, 0.002, 0.001, 1.0),
            metallic=0.0,
            roughness=0.36,
            emissive=(0.06, 0.001, 0.0),
            emissive_strength=0.08,
        ),
        "eye": simple_material(
            "Hollow_HotEye",
            (0.38, 0.050, 0.008, 1.0),
            metallic=0.0,
            roughness=0.28,
            emissive=(1.0, 0.055, 0.006),
            emissive_strength=1.55,
        ),
    }

    source_meshes: list[bpy.types.Object] = []
    source_weight_audit: dict[str, dict[str, int]] = {}
    sneaker_removal: dict[str, int] | None = None
    for name, eyelid in (("Zombie", False), ("Eyelid", True)):
        obj = bpy.data.objects.get(name)
        if obj is None or obj.type != "MESH":
            raise RuntimeError(f"Hollow source mesh missing: {name}")
        if name == "Zombie":
            sneaker_removal = remove_source_sneaker(obj)
        deform_hollow_mesh(obj, eyelid=eyelid)
        assign_material(obj, materials["atlas"])
        modifier = obj.modifiers.new("ControlledSurfaceRefine", "SUBSURF")
        modifier.subdivision_type = "CATMULL_CLARK"
        modifier.levels = 1
        modifier.render_levels = 1
        obj.modifiers.move(obj.modifiers.find(modifier.name), 0)
        activate(obj)
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        decimate = obj.modifiers.new("GameplaySurfaceBudget", "DECIMATE")
        decimate.decimate_type = "COLLAPSE"
        decimate.ratio = 0.62
        decimate.use_collapse_triangulate = True
        obj.modifiers.move(obj.modifiers.find(decimate.name), 0)
        bpy.ops.object.modifier_apply(modifier=decimate.name)
        source_weight_audit[name] = limit_and_audit_weights(obj, "Root")
        source_meshes.append(obj)

    custom = build_details(armature, materials)
    for obj in list(bpy.data.objects):
        if obj not in {armature, *source_meshes, *custom}:
            remove_object(obj)

    joined_meshes = join_by_material([*source_meshes, *custom], armature)
    joined_weight_audit = {
        obj.name: limit_and_audit_weights(obj, "Root") for obj in joined_meshes
    }
    runtime: list[bpy.types.Object] = [armature, *joined_meshes]
    summary = mesh_summary(runtime)
    if not 25_000 <= int(summary["triangles"]) <= 40_000:
        raise RuntimeError(f"Hollow triangle budget failed: {summary['triangles']}")
    if len(summary["materials"]) != 5 or int(summary["mesh_objects"]) > 5:
        raise RuntimeError(f"Hollow material/draw budget failed: {summary}")
    if {action.name for action in bpy.data.actions} != REQUIRED_ACTIONS:
        raise RuntimeError(f"Hollow action set drifted: {[a.name for a in bpy.data.actions]}")

    blend_output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_output))
    export_glb(output, runtime, animations=True)
    receipt = {
        "schema": "p30.round004.hollow-build.v1",
        "source": {
            "zombie_glb": str(source),
            "zombie_glb_sha256": sha256(source),
            "palette_atlas": str(atlas),
            "palette_atlas_sha256": sha256(atlas),
        },
        "output": {
            "path": str(output),
            "bytes": output.stat().st_size,
            "sha256": sha256(output),
            **summary,
            "bones": len(armature.data.bones),
            "animations": sorted(REQUIRED_ACTIONS),
            "required_bones": sorted(required_bones),
            "draw_primitives": summary["mesh_objects"],
        },
        "source_weight_audit": source_weight_audit,
        "source_sneaker_removal": sneaker_removal,
        "joined_weight_audit": joined_weight_audit,
        "quality_notes": [
            "Exact source Idle, HitReact, and Death clips remain on the original 50-bone rest skeleton.",
            "The base body is proportion-deformed into a narrow waist, forward head, high left shoulder, dropped right shoulder, and unequal long arms.",
            "High scapular growth, enlarged claw forearm, three talons, broken jaw, one hot eye, rib slit, shoulder cavity, and thigh wound are authored geometry rather than a tint.",
            "The actual shod-foot source vertices are deleted before refinement; charcoal diagonal wraps, torn tabard leaves, a corroded greave, and an organic wrapped boot replace the shorts-and-sneaker gameplay read.",
            "All meshes are consolidated to five exact draws and hard-fail any unweighted vertex or influence count above four.",
        ],
    }
    write_json(receipt_path, receipt)
    print("ROUND004_HOLLOW_BUILD=" + json.dumps(receipt, sort_keys=True))


if __name__ == "__main__":
    main()
