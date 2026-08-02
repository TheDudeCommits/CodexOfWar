"""Blender/BVH validation for the isolated Round006 contact package."""

from __future__ import annotations

import json
import math
from pathlib import Path
import sys

import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
ROUND005_TOOLS = ROOT / "WebAssetSource/P31/source_work/round005_alt"
sys.path.insert(0, str(ROUND005_TOOLS))

from blender_common import sha256, write_json  # noqa: E402
from build_alt import (  # noqa: E402
    evaluate_independent_pair,
    exported_render_meshes,
    import_glb_collection,
    nearest_mesh_surface_distance,
    palm_marker_distance,
    reset,
)


HERO_GLB = HERE / "glb/nyra.glb"
WEAPON_GLB = HERE / "glb/stormcage.glb"
HOLLOW_GLB = ROOT / "WebAssetSource/P31/processed/round005/characters/hollow.glb"
REPORT_PATH = HERE / "reports/contact-validation.json"

LANE_M = 0.62
TOE_RAD = 0.50
WEAPON_ROLL_RAD = 0.60
HERO_CENTER_Z = 1.6000008583068848
HERO_SCALE = 1.22
HOLLOW_SCALE = 1.16


def evaluated_world_bvh(obj: bpy.types.Object) -> BVHTree:
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    try:
        vertices = [evaluated.matrix_world @ vertex.co for vertex in mesh.vertices]
        polygons = [tuple(poly.vertices) for poly in mesh.polygons]
        if not vertices or not polygons:
            raise RuntimeError(f"{obj.name}: no evaluated geometry")
        return BVHTree.FromPolygons(vertices, polygons, all_triangles=True)
    finally:
        evaluated.to_mesh_clear()


def overlap_report(
    blade: bpy.types.Object,
    targets: list[bpy.types.Object],
) -> dict[str, object]:
    blade_tree = evaluated_world_bvh(blade)
    by_object: dict[str, dict[str, object]] = {}
    all_blade_triangles: set[int] = set()
    pair_count = 0
    for target in exported_render_meshes(targets):
        if target == blade:
            continue
        overlaps = blade_tree.overlap(evaluated_world_bvh(target))
        if not overlaps:
            continue
        blade_triangles = {int(pair[0]) for pair in overlaps}
        target_triangles = {int(pair[1]) for pair in overlaps}
        all_blade_triangles.update(blade_triangles)
        pair_count += len(overlaps)
        by_object[target.name] = {
            "triangle_pairs": len(overlaps),
            "blade_triangles": len(blade_triangles),
            "target_triangles": len(target_triangles),
        }
    return {
        "triangle_pairs": pair_count,
        "blade_triangles": len(all_blade_triangles),
        "objects": by_object,
        "intersects": pair_count > 0,
    }


def nearest_surface_point(
    point_world: Vector,
    targets: list[bpy.types.Object],
) -> tuple[float, str, Vector]:
    best = (math.inf, "", Vector())
    for target in exported_render_meshes(targets):
        nearest = evaluated_world_bvh(target).find_nearest(point_world)
        if nearest is None:
            continue
        location, _normal, _index, distance = nearest
        if float(distance) < best[0]:
            best = (float(distance), target.name, location.copy())
    if not math.isfinite(best[0]):
        raise RuntimeError("no nearest surface")
    return best


def marker_grid_probe(
    marker: bpy.types.Object,
    targets: list[bpy.types.Object],
) -> dict[str, object]:
    parent = marker.parent
    if parent is None:
        raise RuntimeError("contact marker has no parent")
    target_trees = [
        (target.name, evaluated_world_bvh(target))
        for target in exported_render_meshes(targets)
    ]
    best: tuple[float, Vector, str, Vector] | None = None
    for x_step in range(-15, 16):
        x = x_step / 100.0
        for y_step in range(-3, 4):
            y = y_step / 100.0
            for z_step in range(120, 173):
                z = z_step / 100.0
                local = Vector((x, y, z))
                world = parent.matrix_world @ local
                for target_name, tree in target_trees:
                    nearest_result = tree.find_nearest(world)
                    if nearest_result is None:
                        continue
                    nearest, _normal, _index, distance = nearest_result
                    if best is None or float(distance) < best[0]:
                        best = (float(distance), local.copy(), target_name, nearest.copy())
    assert best is not None
    return {
        "distance_m": best[0],
        "marker_parent_local": list(best[1]),
        "target_object": best[2],
        "nearest_target_world": list(best[3]),
    }


def main() -> None:
    reset()
    hero_root, hero_objects = import_glb_collection(HERO_GLB, "Round006_HeroRoot")
    hollow_root, hollow_objects = import_glb_collection(HOLLOW_GLB, "Round006_HollowRoot")
    weapon_root, weapon_objects = import_glb_collection(WEAPON_GLB, "Round006_WeaponRoot")

    hero_root.location = (-LANE_M, -HERO_CENTER_Z, 0.0)
    hero_root.rotation_euler.z = math.pi - TOE_RAD
    hero_root.scale = (HERO_SCALE,) * 3
    hollow_root.location = (LANE_M, 0.0, 0.0)
    hollow_root.rotation_euler.z = -TOE_RAD
    hollow_root.scale = (HOLLOW_SCALE,) * 3

    socket = next(obj for obj in hero_objects if obj.name == "weapon_socket")
    weapon_root.parent = socket
    weapon_root.matrix_parent_inverse = Matrix.Identity(4)
    weapon_root.location = (0.0, 0.0, 0.0)
    weapon_root.rotation_euler = (0.0, 0.0, WEAPON_ROLL_RAD)
    weapon_root.scale = (1.0, 1.0, 1.0)

    hero_armature = next(obj for obj in hero_objects if obj.type == "ARMATURE")
    hollow_armature = next(obj for obj in hollow_objects if obj.type == "ARMATURE")
    primary_marker = next(obj for obj in weapon_objects if obj.name == "GripPrimary")
    secondary_marker = next(obj for obj in weapon_objects if obj.name == "GripSecondary")
    explicit_secondary = next(obj for obj in weapon_objects if obj.name == "secondary_grip")
    contact_marker = next(obj for obj in weapon_objects if obj.name == "ContactMarker")
    blade = next(obj for obj in weapon_objects if obj.name == "Dawnbreak_Blade")

    if (explicit_secondary.matrix_world.translation - secondary_marker.matrix_world.translation).length > 1e-6:
        raise RuntimeError("secondary_grip and GripSecondary do not coincide")

    moments = (
        ("S03", 2.0, "Idle", 11.6),
        ("S04", 4.0, "HitReact", 0.0),
        ("S05", 6.8, "HitReact", 5.833333333333333),
    )
    measurements: dict[str, object] = {}
    for name, hero_frame, hollow_action, hollow_frame in moments:
        evaluate_independent_pair(
            hero_armature,
            "Sword_Regular_A",
            hero_frame,
            hollow_armature,
            hollow_action,
            hollow_frame,
        )
        primary = primary_marker.matrix_world.translation
        secondary = secondary_marker.matrix_world.translation
        contact = contact_marker.matrix_world.translation
        marker_distance, nearest_object = nearest_mesh_surface_distance(contact, hollow_objects)
        marker_to_blade, _nearest_blade = nearest_mesh_surface_distance(contact, [blade])
        hero_overlap = overlap_report(blade, hero_objects)
        target_overlap = overlap_report(blade, hollow_objects)
        measurements[name] = {
            "hero_frame": hero_frame,
            "hollow_action": hollow_action,
            "hollow_frame": hollow_frame,
            "primary_palm_to_grip_m": palm_marker_distance(hero_armature, "hand_r", primary),
            "secondary_palm_to_grip_m": palm_marker_distance(hero_armature, "hand_l", secondary),
            "contact_marker_to_target_surface_m": marker_distance,
            "contact_marker_nearest_target_object": nearest_object,
            "contact_marker_to_blade_surface_m": marker_to_blade,
            "blade_hero": hero_overlap,
            "blade_target": target_overlap,
        }
        if name == "S04":
            measurements[name]["contact_marker_grid_probe"] = marker_grid_probe(
                contact_marker, hollow_objects
            )

    failures: list[str] = []
    for name, measurement in measurements.items():
        for key in ("primary_palm_to_grip_m", "secondary_palm_to_grip_m"):
            if float(measurement[key]) > 0.025:
                failures.append(f"{name}: {key} {measurement[key]} > 0.025")
        if measurement["blade_hero"]["intersects"]:
            failures.append(f"{name}: blade intersects hero: {measurement['blade_hero']}")
    if not measurements["S04"]["blade_target"]["intersects"]:
        failures.append("S04: blade does not intersect target")
    for name in ("S03", "S05"):
        if measurements[name]["blade_target"]["intersects"]:
            failures.append(f"{name}: blade intersects target")
    if float(measurements["S04"]["contact_marker_to_target_surface_m"]) > 0.03:
        failures.append(
            "S04: contact marker distance "
            f"{measurements['S04']['contact_marker_to_target_surface_m']} > 0.03"
        )
    if float(measurements["S04"]["contact_marker_to_blade_surface_m"]) > 0.01:
        failures.append(
            "S04: contact marker is not on the blade surface: "
            f"{measurements['S04']['contact_marker_to_blade_surface_m']} > 0.01"
        )

    report = {
        "schema": "p31.round006.contact-bvh-validation.v1",
        "status": "pass" if not failures else "fail",
        "integrated": False,
        "acceptance_claimed": False,
        "assets": {
            "hero": {"sha256": sha256(HERO_GLB), "file": "glb/nyra.glb"},
            "weapon": {"sha256": sha256(WEAPON_GLB), "file": "glb/stormcage.glb"},
            "frozen_hollow": {
                "sha256": sha256(HOLLOW_GLB),
                "file": str(HOLLOW_GLB.relative_to(ROOT)),
            },
        },
        "runtime_transform": {
            "lane_m": LANE_M,
            "toe_rad": TOE_RAD,
            "weapon_roll_rad": WEAPON_ROLL_RAD,
            "hero_center_z": HERO_CENTER_Z,
            "hero_scale": HERO_SCALE,
            "hollow_scale": HOLLOW_SCALE,
        },
        "limits": {
            "palm_to_grip_m": 0.025,
            "s04_contact_marker_to_target_surface_m": 0.03,
            "contact_marker_to_blade_surface_m": 0.01,
            "blade_hero_triangle_pairs": 0,
            "blade_target_intersection_moments": ["S04"],
        },
        "measurements": measurements,
        "failures": failures,
    }
    write_json(REPORT_PATH, report)
    bpy.ops.wm.save_as_mainfile(filepath=str(HERE / "blends/contact_validation.blend"))
    print("ROUND006_CONTACT_BVH=" + json.dumps(report, sort_keys=True))
    if failures:
        raise RuntimeError("; ".join(failures))


if __name__ == "__main__":
    main()
