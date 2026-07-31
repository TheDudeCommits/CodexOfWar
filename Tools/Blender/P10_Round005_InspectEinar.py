#!/usr/bin/env python3
"""Read-only structural audit for the quarantined Blender Studio Einar source."""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def cli_report_path() -> Path:
    argv = sys.argv
    if "--" not in argv:
        return Path("/tmp/P10_Round005_EinarInspection.json")
    args = argv[argv.index("--") + 1 :]
    if len(args) != 1:
        raise SystemExit("Usage: blender ... --python script.py -- REPORT.json")
    return Path(args[0]).resolve()


def rounded(values) -> list[float]:
    return [round(float(value), 6) for value in values]


def mesh_stats(obj: bpy.types.Object) -> dict[str, object]:
    mesh = obj.data
    mesh.calc_loop_triangles()
    bounds = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    minimum = Vector(
        (
            min(point.x for point in bounds),
            min(point.y for point in bounds),
            min(point.z for point in bounds),
        )
    )
    maximum = Vector(
        (
            max(point.x for point in bounds),
            max(point.y for point in bounds),
            max(point.z for point in bounds),
        )
    )
    material_slots = [
        slot.material.name if slot.material is not None else None
        for slot in obj.material_slots
    ]
    return {
        "name": obj.name,
        "vertices": len(mesh.vertices),
        "edges": len(mesh.edges),
        "polygons": len(mesh.polygons),
        "triangles": len(mesh.loop_triangles),
        "shape_keys": (
            len(mesh.shape_keys.key_blocks)
            if mesh.shape_keys is not None
            else 0
        ),
        "material_slots": material_slots,
        "vertex_groups": len(obj.vertex_groups),
        "parent": obj.parent.name if obj.parent is not None else None,
        "modifiers": [
            {
                "name": modifier.name,
                "type": modifier.type,
                "show_viewport": bool(modifier.show_viewport),
                "show_render": bool(modifier.show_render),
                "levels": getattr(modifier, "levels", None),
                "render_levels": getattr(modifier, "render_levels", None),
            }
            for modifier in obj.modifiers
        ],
        "hide_render": bool(obj.hide_render),
        "bounds": {
            "min": rounded(minimum),
            "max": rounded(maximum),
            "dimensions": rounded(maximum - minimum),
        },
    }


def image_stats(image: bpy.types.Image) -> dict[str, object]:
    stored = image.filepath
    resolved = Path(bpy.path.abspath(stored)) if stored else None
    probe = (
        Path(str(resolved).replace("<UDIM>", "1001"))
        if resolved is not None
        else None
    )
    return {
        "name": image.name,
        "source": image.source,
        "stored_path": stored,
        "resolved_probe": str(probe) if probe is not None else None,
        "exists": bool(probe is not None and probe.is_file()),
        "size": [int(image.size[0]), int(image.size[1])],
        "colorspace": image.colorspace_settings.name,
        "packed": image.packed_file is not None,
    }


def material_stats(material: bpy.types.Material) -> dict[str, object]:
    nodes = list(material.node_tree.nodes) if material.use_nodes else []
    image_nodes = [
        {
            "node": node.name,
            "image": node.image.name if node.image is not None else None,
            "interpolation": getattr(node, "interpolation", None),
            "projection": getattr(node, "projection", None),
        }
        for node in nodes
        if node.type == "TEX_IMAGE"
    ]
    return {
        "name": material.name,
        "use_nodes": bool(material.use_nodes),
        "node_count": len(nodes),
        "node_types": sorted({node.type for node in nodes}),
        "image_nodes": image_nodes,
    }


def main() -> None:
    source_path = Path(bpy.data.filepath).resolve()
    meshes = sorted(
        (obj for obj in bpy.data.objects if obj.type == "MESH"),
        key=lambda item: item.name,
    )
    armatures = sorted(
        (obj for obj in bpy.data.objects if obj.type == "ARMATURE"),
        key=lambda item: item.name,
    )
    mesh_records = [mesh_stats(obj) for obj in meshes]
    totals = {
        field: sum(int(record[field]) for record in mesh_records)
        for field in ("vertices", "edges", "polygons", "triangles")
    }
    all_points = [
        obj.matrix_world @ Vector(corner)
        for obj in meshes
        if not obj.hide_render
        for corner in obj.bound_box
    ]
    if all_points:
        minimum = Vector(
            (
                min(point.x for point in all_points),
                min(point.y for point in all_points),
                min(point.z for point in all_points),
            )
        )
        maximum = Vector(
            (
                max(point.x for point in all_points),
                max(point.y for point in all_points),
                max(point.z for point in all_points),
            )
        )
        visible_bounds = {
            "min": rounded(minimum),
            "max": rounded(maximum),
            "dimensions": rounded(maximum - minimum),
        }
    else:
        visible_bounds = None
    report = {
        "pipeline": "P10_Round005_EinarSourceInspection",
        "mode": "read-only, scripts disabled, source datablocks only",
        "blender_version": bpy.app.version_string,
        "source_path": str(source_path),
        "source_sha256": sha256(source_path),
        "scene": bpy.context.scene.name,
        "frame": int(bpy.context.scene.frame_current),
        "collections": sorted(collection.name for collection in bpy.data.collections),
        "objects_by_type": {
            object_type: sum(
                1 for obj in bpy.data.objects if obj.type == object_type
            )
            for object_type in sorted({obj.type for obj in bpy.data.objects})
        },
        "mesh_totals_base_cage": totals,
        "visible_object_bounds": visible_bounds,
        "meshes": mesh_records,
        "armatures": [
            {
                "name": obj.name,
                "bones": len(obj.data.bones),
                "deform_bones": sum(
                    1 for bone in obj.data.bones if bone.use_deform
                ),
                "pose_bones": len(obj.pose.bones),
                "animation_action": (
                    obj.animation_data.action.name
                    if obj.animation_data is not None
                    and obj.animation_data.action is not None
                    else None
                ),
            }
            for obj in armatures
        ],
        "actions": [
            {
                "name": action.name,
                "frame_range": rounded(action.frame_range),
                "slots": len(getattr(action, "slots", ())),
            }
            for action in sorted(bpy.data.actions, key=lambda item: item.name)
        ],
        "materials": [
            material_stats(material)
            for material in sorted(bpy.data.materials, key=lambda item: item.name)
        ],
        "images": [
            image_stats(image)
            for image in sorted(bpy.data.images, key=lambda item: item.name)
        ],
    }
    output_path = cli_report_path()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(report, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(report, indent=2, sort_keys=True))
    print(f"[P10:R5] Wrote {output_path}")


if __name__ == "__main__":
    main()
