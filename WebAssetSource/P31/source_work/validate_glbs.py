"""Import every processed GLB in isolation and print a compact JSON QA report."""

from __future__ import annotations

import json
from pathlib import Path

import bpy


SOURCE_ROOT = Path(__file__).resolve().parents[1]
PROCESSED_ROOT = SOURCE_ROOT / "processed"
results: list[dict[str, object]] = []

for path in sorted(PROCESSED_ROOT.rglob("*.glb")):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    entry: dict[str, object] = {"path": path.relative_to(PROCESSED_ROOT).as_posix()}
    try:
        bpy.ops.import_scene.gltf(filepath=str(path))
        meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
        armatures = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
        actions = list(bpy.data.actions)
        entry.update(
            {
                "ok": bool(meshes),
                "objects": len(bpy.context.scene.objects),
                "meshes": len(meshes),
                "armatures": len(armatures),
                "actions": [action.name for action in actions],
            }
        )
    except Exception as exc:  # Blender should report per-file failures, then continue.
        entry.update({"ok": False, "error": f"{type(exc).__name__}: {exc}"})
    results.append(entry)

print("P31_GLTF_QA=" + json.dumps(results, sort_keys=True))
if not results or not all(bool(entry.get("ok")) for entry in results):
    raise SystemExit(1)
