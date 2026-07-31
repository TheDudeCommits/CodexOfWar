#!/usr/bin/env python3
"""Factory-startup clean-import validation for P10 Round005 static FBXs."""

from __future__ import annotations

import hashlib
import json
import math
import struct
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
ROUND_ROOT = ROOT / "ArtSource" / "P10" / "Round005"
GAME_ROOT = (
    ROOT
    / "game"
    / "Assets"
    / "CodexOfWar"
    / "Heroes"
    / "P10"
    / "Round005"
)
MODEL_ROOT = GAME_ROOT / "Models"
AUDIT_PATH = ROUND_ROOT / "Preflight" / "P10_Round005_Audit.json"
REPORT_PATH = (
    ROUND_ROOT / "Preflight" / "P10_Round005_FBXCleanImport.json"
)
RENDER_PATH = (
    ROUND_ROOT / "Preflight" / "P10_Round005_FBX_Reimport.png"
)

FBX_PATHS = {
    "combat": MODEL_ROOT / "P10_EinarForgeWarrior_Round005_Combat.fbx",
    "lod0": MODEL_ROOT / "P10_EinarForgeWarrior_Round005_LOD0.fbx",
    "lod1": MODEL_ROOT / "P10_EinarForgeWarrior_Round005_LOD1.fbx",
    "lod2": MODEL_ROOT / "P10_EinarForgeWarrior_Round005_LOD2.fbx",
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def repository_path(path: Path) -> str:
    try:
        return path.resolve().relative_to(ROOT).as_posix()
    except ValueError:
        return f"<external>/{path.name}"


def strip_png_private_metadata(path: Path) -> None:
    """Remove Blender's volatile/private PNG metadata without touching pixels."""
    payload = path.read_bytes()
    signature = b"\x89PNG\r\n\x1a\n"
    if not payload.startswith(signature):
        raise RuntimeError(f"Not a PNG: {path}")
    offset = len(signature)
    kept = bytearray(signature)
    strip_types = {b"tEXt", b"zTXt", b"iTXt", b"eXIf", b"oFFs"}
    while offset < len(payload):
        if offset + 12 > len(payload):
            raise RuntimeError(f"Truncated PNG chunk header: {path}")
        length = struct.unpack(">I", payload[offset : offset + 4])[0]
        end = offset + 12 + length
        if end > len(payload):
            raise RuntimeError(f"Truncated PNG chunk payload: {path}")
        chunk_type = payload[offset + 4 : offset + 8]
        if chunk_type not in strip_types:
            kept.extend(payload[offset:end])
        offset = end
        if chunk_type == b"IEND":
            break
    if offset != len(payload):
        raise RuntimeError(f"Unexpected bytes after PNG IEND: {path}")
    path.write_bytes(bytes(kept))


def rounded(values) -> list[float]:
    return [round(float(value), 6) for value in values]


def world_bounds(objects: list[bpy.types.Object]) -> dict[str, list[float]]:
    points = [
        obj.matrix_world @ Vector(corner)
        for obj in objects
        for corner in obj.bound_box
    ]
    minimum = Vector(
        tuple(min(point[index] for point in points) for index in range(3))
    )
    maximum = Vector(
        tuple(max(point[index] for point in points) for index in range(3))
    )
    return {
        "min": rounded(minimum),
        "max": rounded(maximum),
        "center": rounded((minimum + maximum) * 0.5),
        "dimensions": rounded(maximum - minimum),
    }


def bound_max_delta(
    expected: dict[str, list[float]],
    imported: dict[str, list[float]],
) -> float:
    values = []
    for key in ("min", "max", "dimensions"):
        values.extend(
            abs(float(left) - float(right))
            for left, right in zip(expected[key], imported[key], strict=True)
        )
    return max(values, default=0.0)


def material_has_image(material: bpy.types.Material) -> bool:
    return bool(
        material.use_nodes
        and any(
            node.type == "TEX_IMAGE" and node.image is not None
            for node in material.node_tree.nodes
        )
    )


def inspect_mesh(obj: bpy.types.Object) -> dict[str, object]:
    mesh = obj.data
    mesh.calc_loop_triangles()
    finite_vertices = all(
        all(math.isfinite(float(value)) for value in vertex.co)
        for vertex in mesh.vertices
    )
    finite_normals = all(
        all(math.isfinite(float(value)) for value in vertex.normal)
        for vertex in mesh.vertices
    )
    finite_uvs = all(
        all(math.isfinite(float(value)) for value in element.uv)
        for layer in mesh.uv_layers
        for element in layer.data
    )
    zero_area = 0
    for triangle in mesh.loop_triangles:
        first, second, third = (
            mesh.vertices[index].co for index in triangle.vertices
        )
        if (second - first).cross(third - first).length_squared <= 1e-18:
            zero_area += 1
    material_indices_valid = all(
        polygon.material_index < max(1, len(mesh.materials))
        for polygon in mesh.polygons
    )
    textured = any(
        material is not None and material_has_image(material)
        for material in mesh.materials
    )
    return {
        "name": obj.name,
        "triangles": len(mesh.loop_triangles),
        "vertices": len(mesh.vertices),
        "materials": [
            material.name for material in mesh.materials if material is not None
        ],
        "uv_layers": [layer.name for layer in mesh.uv_layers],
        "textured_mesh_has_uv0": bool(mesh.uv_layers) if textured else None,
        "modifiers": [modifier.name for modifier in obj.modifiers],
        "shape_keys": (
            [block.name for block in mesh.shape_keys.key_blocks]
            if mesh.shape_keys is not None
            else []
        ),
        "vertex_groups": [group.name for group in obj.vertex_groups],
        "parent": obj.parent.name if obj.parent is not None else None,
        "matrix_determinant": float(obj.matrix_world.to_3x3().determinant()),
        "finite_vertices": finite_vertices,
        "finite_normals": finite_normals,
        "finite_uvs": finite_uvs,
        "zero_area_triangles": zero_area,
        "material_indices_valid": material_indices_valid,
    }


def import_and_inspect(
    key: str,
    path: Path,
    expected: dict[str, object],
) -> dict[str, object]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=str(path), use_anim=False)
    meshes = sorted(
        (obj for obj in bpy.context.scene.objects if obj.type == "MESH"),
        key=lambda item: item.name,
    )
    mesh_records = [inspect_mesh(obj) for obj in meshes]
    imported_bounds = world_bounds(meshes)
    imported_names = [obj.name for obj in meshes]
    expected_names = sorted(expected["objects"])
    expected_triangles = int(expected["triangles"])
    texture_refs = []
    for image in sorted(bpy.data.images, key=lambda item: item.name):
        stored = image.filepath
        resolved = Path(bpy.path.abspath(stored)).resolve() if stored else None
        inside_round = False
        if resolved is not None:
            try:
                resolved.relative_to(ROUND_ROOT)
                inside_round = True
            except ValueError:
                pass
        texture_refs.append(
            {
                "image": image.name,
                "stored_path": (
                    f"<absolute>/{Path(stored).name}"
                    if stored and Path(stored).is_absolute()
                    else stored
                ),
                "resolved_path": (
                    repository_path(resolved) if resolved is not None else None
                ),
                "exists": bool(resolved is not None and resolved.is_file()),
                "packed": image.packed_file is not None,
                "inside_round005": inside_round,
            }
        )
    imported_triangles = sum(record["triangles"] for record in mesh_records)
    static_checks = {
        "exact_triangle_count": imported_triangles == expected_triangles,
        "exact_object_names": imported_names == expected_names,
        "no_armatures": not any(
            obj.type == "ARMATURE" for obj in bpy.context.scene.objects
        ),
        "no_actions": len(bpy.data.actions) == 0,
        "no_cameras": not any(
            obj.type == "CAMERA" for obj in bpy.context.scene.objects
        ),
        "no_lights": not any(
            obj.type == "LIGHT" for obj in bpy.context.scene.objects
        ),
        "no_modifiers": all(not record["modifiers"] for record in mesh_records),
        "no_shape_keys": all(
            not record["shape_keys"] for record in mesh_records
        ),
        "no_vertex_groups": all(
            not record["vertex_groups"] for record in mesh_records
        ),
        "no_parents": all(record["parent"] is None for record in mesh_records),
        "positive_determinants": all(
            record["matrix_determinant"] > 0.0 for record in mesh_records
        ),
        "finite_geometry": all(
            record["finite_vertices"]
            and record["finite_normals"]
            and record["finite_uvs"]
            for record in mesh_records
        ),
        "no_zero_area_triangles": all(
            record["zero_area_triangles"] == 0 for record in mesh_records
        ),
        "valid_material_indices": all(
            record["material_indices_valid"] for record in mesh_records
        ),
        "textured_meshes_have_uv0": all(
            record["textured_mesh_has_uv0"] is not False
            for record in mesh_records
        ),
        "bounds_max_delta_le_1e-4m": (
            bound_max_delta(expected["bounds"], imported_bounds) <= 1e-4
        ),
    }
    return {
        "key": key,
        "fbx": repository_path(path),
        "fbx_bytes": path.stat().st_size,
        "fbx_sha256": sha256(path),
        "expected_triangles": expected_triangles,
        "imported_triangles": imported_triangles,
        "expected_object_names": expected_names,
        "imported_object_names": imported_names,
        "expected_bounds": expected["bounds"],
        "imported_bounds": imported_bounds,
        "bounds_max_delta_m": bound_max_delta(
            expected["bounds"],
            imported_bounds,
        ),
        "meshes": mesh_records,
        "materials": sorted(material.name for material in bpy.data.materials),
        "texture_references": texture_refs,
        "missing_or_external_texture_references": [
            record
            for record in texture_refs
            if not record["packed"]
            and (not record["exists"] or not record["inside_round005"])
        ],
        "static_checks": static_checks,
        "clean_static_import_pass": all(static_checks.values()),
        "texture_portability_supported": False,
    }


def look_at(obj: bpy.types.Object, target: Vector) -> None:
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def render_reimport_diagnostic() -> None:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 800
    scene.render.resolution_y = 800
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(RENDER_PATH)
    if scene.world is None:
        scene.world = bpy.data.worlds.new("P10R5_REIMPORT_World")
    scene.world.color = (0.004, 0.006, 0.010)

    camera_data = bpy.data.cameras.new("P10R5_REIMPORT_Camera")
    camera = bpy.data.objects.new("P10R5_REIMPORT_Camera", camera_data)
    scene.collection.objects.link(camera)
    camera.location = Vector((1.82, -3.34, 1.26))
    camera.data.lens = 58.0
    look_at(camera, Vector((0.02, -0.11, 0.96)))
    scene.camera = camera

    for name, location, energy, color, size in (
        ("Key", (2.7, -3.3, 3.7), 720.0, (1.0, 0.79, 0.61), 2.3),
        ("Fill", (-2.3, -2.5, 2.0), 360.0, (0.34, 0.52, 0.72), 2.6),
        ("Rim", (-2.8, 1.9, 3.0), 760.0, (0.08, 0.52, 0.64), 2.0),
    ):
        data = bpy.data.lights.new(f"P10R5_REIMPORT_{name}", "AREA")
        data.energy = energy
        data.color = color
        data.shape = "DISK"
        data.size = size
        light = bpy.data.objects.new(f"P10R5_REIMPORT_{name}", data)
        scene.collection.objects.link(light)
        light.location = location
        look_at(light, Vector((0.0, -0.08, 1.0)))
    bpy.ops.render.render(write_still=True)
    strip_png_private_metadata(RENDER_PATH)


def main() -> None:
    if not AUDIT_PATH.is_file():
        raise FileNotFoundError(f"Missing build audit: {AUDIT_PATH}")
    audit = json.loads(AUDIT_PATH.read_text(encoding="utf-8"))
    lod_audit = audit["static_lod_build"]
    expected = {
        "combat": {
            "triangles": lod_audit["lod0"]["triangles"],
            "objects": [item["name"] for item in lod_audit["lod0"]["objects"]],
            "bounds": lod_audit["lod0"]["bounds"],
        },
        "lod0": {
            "triangles": lod_audit["lod0"]["triangles"],
            "objects": [item["name"] for item in lod_audit["lod0"]["objects"]],
            "bounds": lod_audit["lod0"]["bounds"],
        },
        "lod1": lod_audit["lod1"],
        "lod2": lod_audit["lod2"],
    }
    results = []
    for key, path in FBX_PATHS.items():
        if not path.is_file():
            raise FileNotFoundError(f"Missing FBX: {path}")
        results.append(import_and_inspect(key, path, expected[key]))

    # A separate fresh import is used for the visible diagnostic.
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=str(FBX_PATHS["lod0"]), use_anim=False)
    render_reimport_diagnostic()
    report = {
        "pipeline": "P10_Round005_FBXCleanImport",
        "factory_startup": True,
        "scripts_disabled_required_by_invocation": True,
        "blender_version": bpy.app.version_string,
        "results": results,
        "all_clean_static_imports_pass": all(
            result["clean_static_import_pass"] for result in results
        ),
        "texture_portability_supported": False,
        "diagnostic_render": {
            "path": repository_path(RENDER_PATH),
            "bytes": RENDER_PATH.stat().st_size,
            "sha256": sha256(RENDER_PATH),
            "source": "fresh factory import of LOD0 FBX",
        },
    }
    REPORT_PATH.write_text(
        json.dumps(report, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    audit["fbx_clean_import_validation"] = {
        "report": REPORT_PATH.relative_to(ROOT).as_posix(),
        "report_sha256": sha256(REPORT_PATH),
        "diagnostic_render": RENDER_PATH.relative_to(ROOT).as_posix(),
        "diagnostic_render_sha256": sha256(RENDER_PATH),
        "all_clean_static_imports_pass": report[
            "all_clean_static_imports_pass"
        ],
        "texture_portability_supported": False,
    }
    report_relative_path = REPORT_PATH.relative_to(ROOT).as_posix()
    for record in (
        audit.get("release_sanitization", {}).get("json_path_receipts", [])
    ):
        if record.get("path") == report_relative_path:
            record["bytes"] = REPORT_PATH.stat().st_size
            record["sha256"] = sha256(REPORT_PATH)
    AUDIT_PATH.write_text(
        json.dumps(audit, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(f"[P10:R5] Clean import report: {REPORT_PATH}")
    print(f"[P10:R5] All static imports pass: {report['all_clean_static_imports_pass']}")


if __name__ == "__main__":
    main()
