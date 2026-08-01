#!/usr/bin/env python3
"""Re-import and validate every processed Round003 environment GLB."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
import struct

import bpy


P31_ROOT = Path(__file__).resolve().parents[2]
GEOMETRY_ROOT = P31_ROOT / "processed/polyhaven/round003/geometry"
RECEIPT_PATH = Path(__file__).resolve().parent / "validation.json"
EXPECTED = (
    "fort_buttress.glb",
    "fort_gate.glb",
    "fort_wall.glb",
    "fort_tower.glb",
    "fort_stairs.glb",
    "gothic_statue.glb",
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def glb_json(path: Path) -> dict[str, object]:
    data = path.read_bytes()
    if len(data) < 20 or data[:4] != b"glTF":
        raise RuntimeError(f"Not a binary glTF: {path}")
    version, total_length = struct.unpack_from("<II", data, 4)
    if version != 2 or total_length != len(data):
        raise RuntimeError(f"Invalid GLB header: {path}")
    json_length, chunk_type = struct.unpack_from("<II", data, 12)
    if chunk_type != 0x4E4F534A:
        raise RuntimeError(f"Missing GLB JSON chunk: {path}")
    return json.loads(data[20:20 + json_length].decode("utf-8"))


def validate_one(path: Path) -> dict[str, object]:
    document = glb_json(path)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    materials = {slot.material.name for obj in meshes for slot in obj.material_slots if slot.material}
    images = [image.name for image in bpy.data.images if image.name not in {"Render Result", "Viewer Node"}]
    triangles = 0
    vertices = 0
    grounded = True
    identity = True
    has_uv = True
    bounds = []
    for obj in meshes:
        obj.data.calc_loop_triangles()
        triangles += len(obj.data.loop_triangles)
        vertices += len(obj.data.vertices)
        corners = [obj.matrix_world @ vertex.co for vertex in obj.data.vertices]
        minimum = [min(co[index] for co in corners) for index in range(3)]
        maximum = [max(co[index] for co in corners) for index in range(3)]
        # Blender imports the runtime's glTF Y-up as native Z-up.
        grounded = grounded and abs(minimum[2]) <= 0.0001
        identity = identity and all(abs(value) <= 0.0001 for value in obj.location)
        identity = identity and all(abs(value) <= 0.0001 for value in obj.rotation_euler)
        identity = identity and all(abs(value - 1.0) <= 0.0001 for value in obj.scale)
        has_uv = has_uv and bool(obj.data.uv_layers)
        runtime_minimum = [minimum[0], minimum[2], -maximum[1]]
        runtime_maximum = [maximum[0], maximum[2], -minimum[1]]
        bounds.append({
            "runtime_min_xyz": [round(value, 6) for value in runtime_minimum],
            "runtime_max_xyz": [round(value, 6) for value in runtime_maximum],
        })

    external_uris = []
    for category in ("buffers", "images"):
        for item in document.get(category, []):
            uri = item.get("uri")
            if uri:
                external_uris.append(uri)
    ok = (
        len(meshes) == 1
        and len(materials) == 1
        and not images
        and not external_uris
        and triangles > 0
        and vertices > 0
        and grounded
        and identity
        and has_uv
        and not document.get("animations")
        and not document.get("extensionsRequired")
    )
    return {
        "path": path.relative_to(P31_ROOT).as_posix(),
        "ok": ok,
        "sha256": sha256(path),
        "bytes": path.stat().st_size,
        "meshes": len(meshes),
        "materials": sorted(materials),
        "embedded_or_loaded_images": images,
        "external_uris": external_uris,
        "vertices": vertices,
        "triangles": triangles,
        "grounded": grounded,
        "identity_transforms": identity,
        "has_uv": has_uv,
        "animations": len(document.get("animations", [])),
        "extensions_required": document.get("extensionsRequired", []),
        "bounds": bounds,
    }


def main() -> None:
    paths = [GEOMETRY_ROOT / filename for filename in EXPECTED]
    missing = [str(path) for path in paths if not path.is_file()]
    if missing:
        raise RuntimeError(f"Missing processed GLBs: {missing}")
    results = [validate_one(path) for path in paths]
    receipt = {
        "schema": "p31.round003.environment-validation.v1",
        "blender": bpy.app.version_string,
        "status": "pass" if all(result["ok"] for result in results) else "fail",
        "ordinary_glb_only": True,
        "results": results,
        "totals": {
            "files": len(results),
            "bytes": sum(result["bytes"] for result in results),
            "vertices": sum(result["vertices"] for result in results),
            "triangles": sum(result["triangles"] for result in results),
        },
    }
    RECEIPT_PATH.write_text(json.dumps(receipt, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print("ROUND003_VALIDATION=" + json.dumps({"status": receipt["status"], **receipt["totals"]}, sort_keys=True))
    if receipt["status"] != "pass":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
