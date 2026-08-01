"""Factory-startup Blender reimport validation for the isolated alternate GLBs."""

from __future__ import annotations

import json
from pathlib import Path

import bpy


HERE = Path(__file__).resolve().parent
TARGETS = {
    "hero": ("vespera_hero.glb", {"Idle_Loop", "Walk_Loop", "Sprint_Loop", "Roll", "Sword_Regular_A"}, {"weapon_socket"}, 65),
    "hollow": ("ossuary_hollow.glb", {"Idle", "HitReact", "Death"}, {"impact_socket"}, 50),
    "weapon": ("dawnbreak_claymore.glb", set(), {"ClaymoreRoot", "GripPrimary", "GripSecondary", "ContactMarker", "BladeTip"}, 0),
}


def main() -> None:
    assets: dict[str, object] = {}
    for asset_id, (filename, expected_actions, required_nodes, expected_bones) in TARGETS.items():
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(HERE / "glb" / filename))
        meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
        armatures = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
        action_names = {action.name for action in bpy.data.actions}
        node_names = {obj.name for obj in bpy.context.scene.objects}
        triangles = sum(
            sum(len(polygon.vertices) - 2 for polygon in obj.data.polygons)
            for obj in meshes
        )
        if action_names != expected_actions:
            raise RuntimeError(
                f"{asset_id}: actions {sorted(action_names)} != {sorted(expected_actions)}"
            )
        if not required_nodes.issubset(node_names):
            raise RuntimeError(
                f"{asset_id}: missing nodes {sorted(required_nodes - node_names)}"
            )
        bone_count = len(armatures[0].data.bones) if len(armatures) == 1 else 0
        if expected_bones:
            if len(armatures) != 1 or bone_count != expected_bones:
                raise RuntimeError(
                    f"{asset_id}: armatures/bones {len(armatures)}/{bone_count}"
                )
        elif armatures:
            raise RuntimeError(f"{asset_id}: static asset unexpectedly has an armature")
        assets[asset_id] = {
            "file": f"glb/{filename}",
            "meshes": len(meshes),
            "triangles": triangles,
            "armatures": len(armatures),
            "bones": bone_count,
            "actions": sorted(action_names),
            "required_nodes": sorted(required_nodes),
            "ok": True,
        }

    report = {
        "schema": "p31.round005.alt-duel-blender-reimport.v1",
        "status": "pass",
        "integrated": False,
        "acceptance_claimed": False,
        "blender": bpy.app.version_string,
        "assets": assets,
    }
    output = HERE / "reports" / "blender-reimport.json"
    output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print("ROUND005_ALT_BLENDER_REIMPORT=" + json.dumps(report, sort_keys=True))


if __name__ == "__main__":
    main()
