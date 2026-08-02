"""Factory-startup Blender reimport validation for Round006 candidate GLBs."""

from __future__ import annotations

import json
from pathlib import Path

import bpy


HERE = Path(__file__).resolve().parent
TARGETS = {
    "hero": {
        "file": "nyra.glb",
        "actions": {"Idle_Loop", "Walk_Loop", "Sprint_Loop", "Roll", "Sword_Regular_A"},
        "nodes": {"weapon_socket", "left_palm_grip_target"},
        "bones": 65,
        # Blender recreates the glTF armature display helper (80 triangles) in
        # glTF_not_exported; the static GLB validator separately records 37,428
        # shipped/rendered triangles.
        "triangles": 37508,
        "images": {"nyra_round006_basecolor", "nyra_round006_normal", "nyra_round006_orm"},
    },
    "weapon": {
        "file": "stormcage.glb",
        "actions": set(),
        "nodes": {"ClaymoreRoot", "GripPrimary", "GripSecondary", "secondary_grip", "ContactMarker", "BladeTip"},
        "bones": 0,
        "triangles": 1244,
        "images": {"stormcage_round006_basecolor", "stormcage_round006_normal", "stormcage_round006_orm"},
    },
}


def main() -> None:
    assets: dict[str, object] = {}
    for asset_id, target in TARGETS.items():
        bpy.ops.wm.read_factory_settings(use_empty=True)
        result = bpy.ops.import_scene.gltf(filepath=str(HERE / "glb" / target["file"]))
        if result != {"FINISHED"}:
            raise RuntimeError(f"{asset_id}: import result {result}")
        meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
        armatures = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
        actions = {action.name for action in bpy.data.actions}
        nodes = {obj.name for obj in bpy.context.scene.objects}
        triangles = sum(
            sum(len(polygon.vertices) - 2 for polygon in obj.data.polygons)
            for obj in meshes
        )
        images = {image.name for image in bpy.data.images}
        bones = len(armatures[0].data.bones) if len(armatures) == 1 else 0
        if actions != target["actions"]:
            raise RuntimeError(f"{asset_id}: action drift {sorted(actions)}")
        if not target["nodes"].issubset(nodes):
            raise RuntimeError(f"{asset_id}: missing nodes {sorted(target['nodes'] - nodes)}")
        if bones != target["bones"]:
            raise RuntimeError(f"{asset_id}: bones {bones} != {target['bones']}")
        if triangles != target["triangles"]:
            raise RuntimeError(f"{asset_id}: triangles {triangles} != {target['triangles']}")
        if not target["images"].issubset(images):
            raise RuntimeError(f"{asset_id}: missing images {sorted(target['images'] - images)}")
        assets[asset_id] = {
            "file": f"glb/{target['file']}",
            "import_operator": "FINISHED",
            "meshes": len(meshes),
            "triangles": triangles,
            "armatures": len(armatures),
            "bones": bones,
            "actions": sorted(actions),
            "required_nodes": sorted(target["nodes"]),
            "embedded_images": sorted(target["images"]),
        }

    report = {
        "schema": "p31.round006.blender-reimport.v1",
        "status": "pass",
        "integrated": False,
        "acceptance_claimed": False,
        "blender": bpy.app.version_string,
        "assets": assets,
    }
    output = HERE / "reports/blender-reimport.json"
    output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print("ROUND006_BLENDER_REIMPORT=" + json.dumps(report, sort_keys=True))


if __name__ == "__main__":
    main()
