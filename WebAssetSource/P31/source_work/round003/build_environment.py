#!/usr/bin/env python3
"""Build six geometry-only Ashwake sector GLBs with Blender 5.2.

The Poly Haven source scenes are presentation layouts.  This build keeps only
five camera-facing Modular Fort modules and one Gothic Statue, removes the
publisher layout transforms, grounds and centers every pivot, collapses each
asset to one shared placeholder material, and exports ordinary uncompressed
GLB.  Runtime assigns one manifest-backed sector PBR material to all six.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import bpy
from mathutils import Matrix


P31_ROOT = Path(__file__).resolve().parents[2]
RAW_ROOT = P31_ROOT / "raw" / "polyhaven" / "round003"
OUTPUT_ROOT = P31_ROOT / "processed" / "polyhaven" / "round003" / "geometry"
RECEIPT_PATH = Path(__file__).resolve().parent / "geometry_build_receipt.json"

FORT_SOURCE = RAW_ROOT / "modular_fort_01_1k" / "modular_fort_01_1k.gltf"
STATUE_SOURCE = RAW_ROOT / "gothic_statue_1k" / "gothic_statue_1k.gltf"

SELECTIONS = (
    {
        "manifest_key": "environment.ashwake-arena",
        "output": "fort_buttress.glb",
        "source": FORT_SOURCE,
        "object": "modular_fort_01_wall_thick_corner_01",
        "runtime_role": "near and midground fort corner mass",
    },
    {
        "manifest_key": "environment.ruin-doorway",
        "output": "fort_gate.glb",
        "source": FORT_SOURCE,
        "object": "modular_fort_01_wall_thin_gate_01",
        "runtime_role": "dark central arched gate",
    },
    {
        "manifest_key": "environment.ruin-wall",
        "output": "fort_wall.glb",
        "source": FORT_SOURCE,
        "object": "modular_fort_01_wall_thin_straight_03",
        "runtime_role": "camera-facing wall and distant silhouette",
    },
    {
        "manifest_key": "environment.ruin-pillar",
        "output": "fort_tower.glb",
        "source": FORT_SOURCE,
        "object": "modular_fort_01_tower_round",
        "runtime_role": "flanking round tower",
    },
    {
        "manifest_key": "environment.ruin-stairs",
        "output": "fort_stairs.glb",
        "source": FORT_SOURCE,
        "object": "modular_fort_01_wall_stairs_straight_01",
        "runtime_role": "gate approach and elevation transition",
    },
    {
        "manifest_key": "environment.ruin-rocks",
        "output": "gothic_statue.glb",
        "source": STATUE_SOURCE,
        "object": "gothic_statue",
        "runtime_role": "single authored Gothic Statue focal prop",
    },
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def mesh_bounds(obj: bpy.types.Object) -> tuple[list[float], list[float]]:
    coordinates = [vertex.co for vertex in obj.data.vertices]
    minimum = [min(co[index] for co in coordinates) for index in range(3)]
    maximum = [max(co[index] for co in coordinates) for index in range(3)]
    return minimum, maximum


def uv_bounds(obj: bpy.types.Object) -> tuple[list[float], list[float]] | None:
    if not obj.data.uv_layers:
        return None
    coordinates = [loop.uv for loop in obj.data.uv_layers.active.data]
    if not coordinates:
        return None
    return (
        [min(co[index] for co in coordinates) for index in range(2)],
        [max(co[index] for co in coordinates) for index in range(2)],
    )


def build_one(selection: dict[str, object]) -> dict[str, object]:
    source = Path(selection["source"])
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(source))
    candidate = bpy.data.objects.get(str(selection["object"]))
    if candidate is None or candidate.type != "MESH":
        available = sorted(obj.name for obj in bpy.context.scene.objects)
        raise RuntimeError(f"Missing mesh {selection['object']}; available={available}")

    source_materials = [slot.material.name if slot.material else None for slot in candidate.material_slots]
    source_uv = uv_bounds(candidate)

    for obj in list(bpy.context.scene.objects):
        if obj != candidate:
            bpy.data.objects.remove(obj, do_unlink=True)

    # Publisher translations arrange all modules as a contact sheet. Blender
    # imports glTF Y-up as native Z-up, so center X/Y and ground Z before the
    # exporter converts the result back to runtime Y-up.
    candidate.matrix_world = Matrix.Identity(4)
    minimum, maximum = mesh_bounds(candidate)
    center_x = (minimum[0] + maximum[0]) * 0.5
    center_y = (minimum[1] + maximum[1]) * 0.5
    candidate.data.transform(Matrix.Translation((-center_x, -center_y, -minimum[2])))
    candidate.data.validate(clean_customdata=True)
    candidate.data.update(calc_edges=True)
    candidate.location = (0.0, 0.0, 0.0)
    candidate.rotation_euler = (0.0, 0.0, 0.0)
    candidate.scale = (1.0, 1.0, 1.0)
    candidate.name = Path(str(selection["output"])).stem
    candidate.data.name = candidate.name + "_mesh"

    placeholder = bpy.data.materials.new("AshwakeSectorShared")
    placeholder.diffuse_color = (0.18, 0.20, 0.21, 1.0)
    placeholder.metallic = 0.0
    placeholder.roughness = 0.94
    candidate.data.materials.clear()
    candidate.data.materials.append(placeholder)
    for polygon in candidate.data.polygons:
        polygon.material_index = 0

    candidate["source_asset"] = source.stem.removesuffix("_1k")
    candidate["source_object"] = selection["object"]
    candidate["processing_round"] = "P30-Round003"
    candidate["runtime_material"] = "AshwakeSectorShared"
    candidate["units"] = "meters"

    bpy.context.view_layer.objects.active = candidate
    candidate.select_set(True)
    candidate.data.calc_loop_triangles()
    output = OUTPUT_ROOT / str(selection["output"])
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(output),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_texcoords=True,
        export_normals=True,
        export_tangents=False,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
        export_animations=False,
        export_apply=False,
        export_draco_mesh_compression_enable=False,
        export_meshopt_compression_enable=False,
    )

    grounded_minimum, grounded_maximum = mesh_bounds(candidate)
    runtime_minimum = [grounded_minimum[0], grounded_minimum[2], -grounded_maximum[1]]
    runtime_maximum = [grounded_maximum[0], grounded_maximum[2], -grounded_minimum[1]]
    return {
        "manifest_key": selection["manifest_key"],
        "runtime_role": selection["runtime_role"],
        "source_path": source.relative_to(P31_ROOT).as_posix(),
        "source_sha256": sha256(source),
        "source_object": selection["object"],
        "source_material_slots": source_materials,
        "source_uv_bounds": source_uv,
        "output_path": output.relative_to(P31_ROOT).as_posix(),
        "output_bytes": output.stat().st_size,
        "output_sha256": sha256(output),
        "vertices": len(candidate.data.vertices),
        "triangles": len(candidate.data.loop_triangles),
        "material_slots": len(candidate.material_slots),
        "runtime_bounds_min_xyz": [round(value, 6) for value in runtime_minimum],
        "runtime_bounds_max_xyz": [round(value, 6) for value in runtime_maximum],
        "runtime_dimensions_xyz": [
            round(runtime_maximum[index] - runtime_minimum[index], 6)
            for index in range(3)
        ],
    }


def main() -> None:
    missing = [str(selection["source"]) for selection in SELECTIONS if not Path(selection["source"]).is_file()]
    if missing:
        raise RuntimeError(f"Run acquire_polyhaven.py first; missing {sorted(set(missing))}")
    results = [build_one(selection) for selection in SELECTIONS]
    receipt = {
        "schema": "p31.round003.geometry-build.v1",
        "blender": bpy.app.version_string,
        "access_date": "2026-08-01",
        "source_scope": {
            "modular_fort_objects_available": 22,
            "modular_fort_objects_selected": 5,
            "modular_fort_objects_pruned": 17,
            "gothic_statues_selected": 1,
        },
        "transform": "publisher contact-sheet transforms removed; Blender-native metric geometry centered on X/Y and grounded at Z=0, then exported Y-up for runtime X/Z centering and Y=0 grounding; identity root transforms",
        "material_policy": "one texture-free AshwakeSectorShared placeholder per GLB; runtime assigns the single manifest-backed sector basecolor/normal/ORM set",
        "compression": "ordinary GLB; no Draco, Meshopt, or KTX2",
        "outputs": results,
        "totals": {
            "files": len(results),
            "bytes": sum(result["output_bytes"] for result in results),
            "vertices": sum(result["vertices"] for result in results),
            "triangles": sum(result["triangles"] for result in results),
        },
    }
    RECEIPT_PATH.write_text(json.dumps(receipt, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print("ROUND003_GEOMETRY=" + json.dumps(receipt["totals"], sort_keys=True))


if __name__ == "__main__":
    main()
