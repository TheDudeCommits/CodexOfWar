"""Factory-startup validation for P10 Round004 static FBX deliverables."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
ROUND = ROOT / "ArtSource" / "P10" / "Round004"
MODEL_DIR = (
    ROOT
    / "game"
    / "Assets"
    / "CodexOfWar"
    / "Heroes"
    / "P10"
    / "Round004"
    / "Models"
)
REPORT = ROUND / "Preflight" / "P10_Round004_FBX_Reimport.json"
AUTHORED_BLEND = ROUND / "P10_Round004_AstraValeWarrior.blend"

FBX_FILES = (
    MODEL_DIR / "P10_AstraVale_Round004_Neutral.fbx",
    MODEL_DIR / "P10_AstraVale_Round004_Combat.fbx",
    MODEL_DIR / "P10_AstraVale_Round004_LOD0.fbx",
    MODEL_DIR / "P10_AstraVale_Round004_LOD1.fbx",
    MODEL_DIR / "P10_AstraVale_Round004_LOD2.fbx",
)

CIVILIAN_TOKENS = (
    "GEO-rain-top",
    "GEO-rain-scarf",
    "GEO-rain-jeans",
    "GEO-rain-shoes",
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def mesh_triangles(obj) -> int:
    mesh = obj.data
    mesh.calc_loop_triangles()
    return len(mesh.loop_triangles)


def imported_bounds(meshes) -> dict[str, list[float]]:
    points = [
        obj.matrix_world @ Vector(corner)
        for obj in meshes
        for corner in obj.bound_box
    ]
    minimum = Vector(
        (
            min(point.x for point in points),
            min(point.y for point in points),
            min(point.z for point in points),
        )
    )
    maximum = Vector(
        (
            max(point.x for point in points),
            max(point.y for point in points),
            max(point.z for point in points),
        )
    )
    dimensions = maximum - minimum
    return {
        "min": [round(value, 6) for value in minimum],
        "max": [round(value, 6) for value in maximum],
        "dimensions": [round(value, 6) for value in dimensions],
    }


def validate_fbx(path: Path) -> dict[str, object]:
    if not path.is_file():
        raise RuntimeError(f"Missing FBX: {path}")
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=str(path))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    armatures = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
    if not meshes:
        raise RuntimeError(f"No meshes after clean FBX import: {path.name}")
    triangles = sum(mesh_triangles(obj) for obj in meshes)
    if triangles <= 0:
        raise RuntimeError(f"No triangles after clean FBX import: {path.name}")
    civilian_hits = sorted(
        obj.name
        for obj in meshes
        if any(token in obj.name for token in CIVILIAN_TOKENS)
    )
    bounds = imported_bounds(meshes)
    if max(bounds["dimensions"]) < 1.0 or max(bounds["dimensions"]) > 3.0:
        raise RuntimeError(f"Implausible imported bounds for {path.name}: {bounds}")
    if armatures:
        raise RuntimeError(f"Unexpected armature in static FBX {path.name}")
    if civilian_hits:
        raise RuntimeError(
            f"Civilian source renderer leaked into {path.name}: {civilian_hits}"
        )
    return {
        "path": str(path.relative_to(ROOT)),
        "sha256": sha256(path),
        "bytes": path.stat().st_size,
        "mesh_objects": len(meshes),
        "armature_objects": len(armatures),
        "triangles": triangles,
        "bounds": bounds,
        "civilian_renderer_hits": civilian_hits,
        "status": "PASS",
    }


def validate_authored_blend() -> dict[str, object]:
    bpy.ops.wm.open_mainfile(
        filepath=str(AUTHORED_BLEND),
        load_ui=False,
        use_scripts=False,
    )
    texture_paths = []
    missing = []
    for image in bpy.data.images:
        if image.source not in {"FILE", "TILED"} or not image.filepath:
            continue
        absolute = Path(bpy.path.abspath(image.filepath))
        probe = Path(str(absolute).replace("<UDIM>", "1001"))
        record = {
            "image": image.name,
            "stored_path": image.filepath,
            "resolved_probe": str(probe),
            "exists": probe.is_file(),
        }
        texture_paths.append(record)
        if not probe.is_file():
            missing.append(record)
    excluded = {
        token: {
            "exists": token in bpy.data.objects,
            "hide_render": (
                bool(bpy.data.objects[token].hide_render)
                if token in bpy.data.objects
                else False
            ),
        }
        for token in CIVILIAN_TOKENS
    }
    if missing:
        raise RuntimeError(f"Authored blend has missing texture probes: {missing}")
    if not all(
        (not item["exists"]) or item["hide_render"] for item in excluded.values()
    ):
        raise RuntimeError(f"Civilian source exclusion state invalid: {excluded}")
    return {
        "path": str(AUTHORED_BLEND.relative_to(ROOT)),
        "sha256": sha256(AUTHORED_BLEND),
        "bytes": AUTHORED_BLEND.stat().st_size,
        "file_backed_images": len(texture_paths),
        "missing_texture_probes": missing,
        "texture_paths": texture_paths,
        "civilian_source_state": excluded,
        "status": "PASS",
    }


def main() -> None:
    report = {
        "pipeline": "P10_Round004_AstraValeWarrior",
        "validation_mode": "Blender factory-startup, one clean reimport per FBX",
        "blender_version": bpy.app.version_string,
        "fbx": [validate_fbx(path) for path in FBX_FILES],
        "authored_blend": validate_authored_blend(),
    }
    report["status"] = "PASS"
    REPORT.write_text(
        json.dumps(report, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(report, indent=2, sort_keys=True))
    print(f"[P10:R4] Wrote {REPORT}")


if __name__ == "__main__":
    main()
