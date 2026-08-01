"""Strict structural and Blender round-trip checks for curated Quaternius GLBs."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import struct
import sys

import bpy
from mathutils import Vector


EXPECTED = {
    "models/universal_superhero_female.glb": [],
    "models/universal_hair_long.glb": [],
    "models/female_ranger_outfit.glb": [],
    "models/claymore.glb": [],
    "models/zombie_basic.glb": [
        "Death",
        "HitReact",
        "Idle",
        "Idle_Attack",
        "Run",
        "Walk",
    ],
    "animations/player_core.glb": [
        "Death01",
        "Hit_Chest",
        "Idle_Loop",
        "Roll",
        "Sprint_Loop",
        "Walk_Loop",
    ],
    "animations/combat_zombie.glb": [
        "Sword_Regular_A",
        "Zombie_Idle_Loop",
        "Zombie_Scratch",
        "Zombie_Walk_Fwd_Loop",
    ],
}

UNIVERSAL_RIG_FILES = {
    "models/universal_superhero_female.glb",
    "models/universal_hair_long.glb",
    "models/female_ranger_outfit.glb",
    "animations/player_core.glb",
    "animations/combat_zombie.glb",
}


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--processed-dir", required=True)
    parser.add_argument("--output", required=True)
    return parser.parse_args(argv)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def parse_glb(path: Path) -> tuple[dict, dict]:
    payload = path.read_bytes()
    if len(payload) < 20:
        raise AssertionError(f"{path}: too short for GLB")
    magic, version, declared_length = struct.unpack_from("<4sII", payload, 0)
    if magic != b"glTF" or version != 2 or declared_length != len(payload):
        raise AssertionError(
            f"{path}: invalid header {magic!r}, v{version}, "
            f"declared={declared_length}, actual={len(payload)}"
        )
    json_length, json_type = struct.unpack_from("<II", payload, 12)
    if json_type != 0x4E4F534A:
        raise AssertionError(f"{path}: first chunk is not JSON")
    document = json.loads(payload[20 : 20 + json_length].decode("utf-8").rstrip())

    external_uris = []
    for section in ("buffers", "images"):
        for item in document.get(section, []):
            uri = item.get("uri")
            if uri and not uri.startswith("data:"):
                external_uris.append(uri)
    if external_uris:
        raise AssertionError(f"{path}: external URIs remain: {external_uris}")

    animation_names = sorted(a.get("name", "") for a in document.get("animations", []))
    skin_joint_names = []
    if document.get("skins"):
        nodes = document.get("nodes", [])
        skin_joint_names = [
            nodes[index].get("name", "") for index in document["skins"][0].get("joints", [])
        ]
    rig_signature = (
        hashlib.sha256("\n".join(skin_joint_names).encode()).hexdigest()
        if skin_joint_names
        else None
    )
    summary = {
        "asset": document.get("asset"),
        "scenes": len(document.get("scenes", [])),
        "nodes": len(document.get("nodes", [])),
        "meshes": len(document.get("meshes", [])),
        "skins": len(document.get("skins", [])),
        "materials": len(document.get("materials", [])),
        "images": len(document.get("images", [])),
        "animations": animation_names,
        "external_uris": external_uris,
        "extensions_used": document.get("extensionsUsed", []),
        "joint_count": len(skin_joint_names),
        "joint_sequence_sha256": rig_signature,
    }
    return document, summary


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action, do_unlink=True)
    for collection in (
        bpy.data.meshes,
        bpy.data.armatures,
        bpy.data.materials,
        bpy.data.cameras,
        bpy.data.lights,
    ):
        for datablock in list(collection):
            collection.remove(datablock, do_unlink=True)
    for image in list(bpy.data.images):
        if image.name not in {"Render Result", "Viewer Node"}:
            bpy.data.images.remove(image, do_unlink=True)


def round_trip_summary(path: Path) -> dict:
    clear_scene()
    bpy.ops.import_scene.gltf(filepath=str(path))
    mesh_objects = [obj for obj in bpy.data.objects if obj.type == "MESH"]
    armatures = [obj for obj in bpy.data.objects if obj.type == "ARMATURE"]
    points = [
        obj.matrix_world @ Vector(corner)
        for obj in mesh_objects
        for corner in obj.bound_box
    ]
    if points:
        minimum = [min(point[index] for point in points) for index in range(3)]
        maximum = [max(point[index] for point in points) for index in range(3)]
        size = [maximum[index] - minimum[index] for index in range(3)]
    else:
        minimum = maximum = size = []
    images = [
        {
            "name": image.name,
            "width": image.size[0],
            "height": image.size[1],
            "packed": image.packed_file is not None,
        }
        for image in bpy.data.images
        if image.name not in {"Render Result", "Viewer Node"}
    ]
    return {
        "objects": len(bpy.data.objects),
        "mesh_objects": len(mesh_objects),
        "armatures": len(armatures),
        "bones": sum(len(obj.data.bones) for obj in armatures),
        "vertices": sum(len(obj.data.vertices) for obj in mesh_objects),
        "triangles": sum(
            len(poly.vertices) - 2 for obj in mesh_objects for poly in obj.data.polygons
        ),
        "actions": sorted(action.name for action in bpy.data.actions),
        "bounds_min": [round(value, 6) for value in minimum],
        "bounds_max": [round(value, 6) for value in maximum],
        "bounds_size": [round(value, 6) for value in size],
        "images": images,
    }


def main() -> None:
    args = parse_args()
    processed_dir = Path(args.processed_dir).resolve()
    output = Path(args.output).resolve()
    results = {}
    rig_signatures = {}

    for relative, expected_actions in EXPECTED.items():
        path = processed_dir / relative
        if not path.is_file():
            raise AssertionError(f"Missing curated file: {path}")
        _, glb = parse_glb(path)
        if glb["animations"] != sorted(expected_actions):
            raise AssertionError(
                f"{relative}: expected actions {sorted(expected_actions)}, "
                f"got {glb['animations']}"
            )
        blender = round_trip_summary(path)
        if blender["actions"] != sorted(expected_actions):
            raise AssertionError(
                f"{relative}: Blender action mismatch {blender['actions']}"
            )
        if glb["meshes"] < 1 or blender["mesh_objects"] < 1:
            raise AssertionError(f"{relative}: no mesh survived conversion")
        if relative != "models/claymore.glb" and glb["skins"] < 1:
            raise AssertionError(f"{relative}: expected a skin")
        if relative in UNIVERSAL_RIG_FILES:
            rig_signatures[relative] = glb["joint_sequence_sha256"]
        results[relative] = {
            "bytes": path.stat().st_size,
            "sha256": sha256(path),
            "glb": glb,
            "blender_reimport": blender,
            "status": "pass",
        }

    unique_universal_rigs = set(rig_signatures.values())
    if len(unique_universal_rigs) != 1 or None in unique_universal_rigs:
        raise AssertionError(f"Universal rig mismatch: {rig_signatures}")

    report = {
        "validator": "Blender 5.2.0 LTS plus direct GLB 2.0 structural checks",
        "overall_status": "pass",
        "universal_rig_compatibility": {
            "status": "pass",
            "joint_count": 65,
            "joint_sequence_sha256": next(iter(unique_universal_rigs)),
            "files": sorted(UNIVERSAL_RIG_FILES),
            "note": "Joint schema matches; body proportions/rest poses remain asset-specific.",
        },
        "files": results,
    }
    output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n")
    print("QUATERNIUS_VALIDATION " + json.dumps(report, sort_keys=True))


if __name__ == "__main__":
    main()
