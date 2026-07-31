#!/usr/bin/env python3
"""P10 Round005 — source-first Einar forge-warrior derivative.

This pipeline deliberately preserves Blender Studio Einar's production
anatomy, layered clothing, weathered hard-surface arm, texture stack, and rig.
Round005 adds only a restrained fighter identity treatment, an explicitly
re-materialed source wrench, a combat presentation pose, static game-art LODs,
and diagnostic renders.  It does not claim a production animation delivery.
"""

from __future__ import annotations

import argparse
import datetime as _datetime
import hashlib
import json
import math
import re
import shutil
import struct
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector


ROOT = Path(__file__).resolve().parents[2]
ROUND_ROOT = ROOT / "ArtSource" / "P10" / "Round005"
VENDOR_ROOT = ROUND_ROOT / "ThirdParty" / "BlenderStudioEinar"
SOURCE_BLEND = VENDOR_ROOT / "einar_release_v1.blend"
SOURCE_TEXTURES = VENDOR_ROOT / "textures"
SOURCE_LICENSE = VENDOR_ROOT / "LICENSE-CC-BY-4.0.txt"
PREFLIGHT = ROUND_ROOT / "Preflight"
AUTHORED_BLEND = ROUND_ROOT / "P10_Round005_EinarForgeWarrior.blend"
AUDIT_OUT = PREFLIGHT / "P10_Round005_Audit.json"
README_OUT = ROUND_ROOT / "README.md"
GAME_ROOT = (
    ROOT
    / "game"
    / "Assets"
    / "CodexOfWar"
    / "Heroes"
    / "P10"
    / "Round005"
)
MODEL_OUT = GAME_ROOT / "Models"
TEXTURE_OUT = GAME_ROOT / "Textures"

RENDER_SIZE = 1600
PROBE_SIZE = 512
LOD0_TARGET_TRIS = 85544
LOD0_MAX_TRIS = 89000
LOD0_MIN_TRIS = 75000
HAIR_CARD_TARGET_TRIS = 5538
LOD0_CATEGORY_TARGETS = {
    "head": 22500,
    # Six triangles move from the measured groom-card budget into clothing,
    # preserving the exact 85,544-triangle aggregate target.
    "clothing": 19006,
    "armor": 7000,
    "mech": 25000,
    "weapon": 5500,
    "strap": 1000,
}
FIXED_TIME = _datetime.datetime(2026, 7, 31, 16, 0, 0)

EXPECTED_SOURCE_BLEND_SHA256 = (
    "1c6663da0a2e9d6822978467c244e9186edc76083bae2414e02f9e695e711f7b"
)
EXPECTED_SOURCE_TREE_SHA256 = (
    "75c418c15b73cf61d961cb1f31d5b97ade4e520fe4e84555d232b3ddd35c4d17"
)
EXPECTED_LICENSE_SHA256 = (
    "9ba9550ad48438d0836ddab3da480b3b69ffa0aac7b7878b5a0039e7ab429411"
)
SOURCE_ARCHIVE_SHA256 = (
    "3cbb5a1dd9ffd3ca39edab420a83ea7f7db337b435a78ef27a0c87ff3e6977f7"
)
SOURCE_ARCHIVE_BYTES = 579834421
SOURCE_PAGE = "https://studio.blender.org/characters/einar/v1/"
SOURCE_DOWNLOAD = (
    "https://studio.blender.org/download-source/files/41/"
    "419e83fb75f30b989adf7920dec7a21c/"
    "419e83fb75f30b989adf7920dec7a21c.zip"
)
REQUIRED_CREDIT = (
    "Einar Rig (CC-BY) Blender Foundation | studio.blender.org"
)

WRENCH_SOURCE_OBJECTS = (
    "GEO-pipe_wrench_handle",
    "GEO-pipe_wrench_heel_jaw",
    "GEO-pipe_wrench_heel_jaw.pin",
    "GEO-pipe_wrench_hook_jaw",
    "GEO-pipe_wrench_nut",
)

STATIC_MESH_ALLOW_PATTERNS = (
    r"^GEO-einar_(head|teeth_(lower|upper)|tongue|fingers|glove|"
    r"boot_.*|jacket_.*|pants_.*|sweater|tire_.*)$",
    r"^GEO-eye.*$",
    r"^GEO-body_anchor_.*$",
    r"^GEO-(arm_guard.*|bolt_.*|cushion_.*|"
    r"elbow_joint(?:\.\d+)?|electrical_wires.*|"
    r"hand_wrist_connection|hyd_.*|index\.[123]|lower_arm_.*|"
    r"middle\.[123]|motor_wrist|palm_.*|pinkie\.[123]|plate_.*|"
    r"shoulder_.*|thumb\.[123]|upper_arm_.*|wires_motor_.*|"
    r"wrist(?:_.*)?|zip_tie\..*)$",
)
STATIC_MESH_ALLOW_RE = tuple(
    re.compile(pattern) for pattern in STATIC_MESH_ALLOW_PATTERNS
)
STATIC_MESH_EXACT_ALLOW = frozenset({"GEO-satchel_strap"})
STATIC_MESH_EXACT_DENY = frozenset(
    {
        "GEO-einar_tire_shoulder_boltf_surfacedeform",
        "GEO-einar_tire_shoulder_surfacedeform",
        "GEO-eye_anim.L",
        "GEO-eye_anim.R",
    }
)

PALETTE_MATERIALS = {
    "einar.jacket.canvas": ((0.22, 0.38, 0.55), 0.24),
    "einar.jacket.collar": ((0.22, 0.34, 0.50), 0.20),
    "einar.jacket.rim": ((0.18, 0.30, 0.45), 0.22),
    "einar.sweater": ((0.18, 0.33, 0.48), 0.18),
    "einar.fabric": ((0.16, 0.27, 0.42), 0.16),
    "einar.pants_fabric": ((0.17, 0.28, 0.43), 0.16),
    "einar.pants_tarp": ((0.15, 0.28, 0.39), 0.13),
    "satchel": ((0.30, 0.24, 0.18), 0.08),
}

PNG_OUTPUTS = {
    "front": PREFLIGHT / "P10_Round005_Front.png",
    "three_quarter": PREFLIGHT / "P10_Round005_ThreeQuarter.png",
    "back": PREFLIGHT / "P10_Round005_Back.png",
    "profile": PREFLIGHT / "P10_Round005_Profile.png",
    "face": PREFLIGHT / "P10_Round005_Face.png",
    "hands": PREFLIGHT / "P10_Round005_Hands.png",
    "feet": PREFLIGHT / "P10_Round005_Feet.png",
    "combat": PREFLIGHT / "P10_Round005_Combat.png",
    "grip": PREFLIGHT / "P10_Round005_Grip.png",
}

FBX_OUTPUTS = {
    "combat": MODEL_OUT / "P10_EinarForgeWarrior_Round005_Combat.fbx",
    "lod0": MODEL_OUT / "P10_EinarForgeWarrior_Round005_LOD0.fbx",
    "lod1": MODEL_OUT / "P10_EinarForgeWarrior_Round005_LOD1.fbx",
    "lod2": MODEL_OUT / "P10_EinarForgeWarrior_Round005_LOD2.fbx",
}

AUDIT: dict[str, object] = {
    "pipeline": "P10_Round005_EinarForgeWarrior",
    "scope": (
        "Source-first static fighter-identity visual proof and static LOD "
        "exports; no production animation, deform-rig, or Unity integration claim."
    ),
    "license": "CC BY 4.0",
    "required_credit": REQUIRED_CREDIT,
    "archive_sha256": SOURCE_ARCHIVE_SHA256,
    "archive_bytes": SOURCE_ARCHIVE_BYTES,
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--mode",
        choices=("probe", "stats", "build"),
        default="build",
        help="probe writes one 512px temporary render; build writes delivery.",
    )
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return parser.parse_args(argv)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def strip_png_private_metadata(path: Path) -> dict[str, object]:
    """Remove Blender's volatile/private PNG metadata without touching pixels."""
    payload = path.read_bytes()
    signature = b"\x89PNG\r\n\x1a\n"
    if not payload.startswith(signature):
        raise RuntimeError(f"Not a PNG: {path}")
    offset = len(signature)
    kept = bytearray(signature)
    removed: list[str] = []
    strip_types = {b"tEXt", b"zTXt", b"iTXt", b"eXIf", b"oFFs"}
    while offset < len(payload):
        if offset + 12 > len(payload):
            raise RuntimeError(f"Truncated PNG chunk header: {path}")
        length = struct.unpack(">I", payload[offset : offset + 4])[0]
        end = offset + 12 + length
        if end > len(payload):
            raise RuntimeError(f"Truncated PNG chunk payload: {path}")
        chunk_type = payload[offset + 4 : offset + 8]
        chunk = payload[offset:end]
        if chunk_type in strip_types:
            removed.append(chunk_type.decode("ascii"))
        else:
            kept.extend(chunk)
        offset = end
        if chunk_type == b"IEND":
            break
    if offset != len(payload):
        raise RuntimeError(f"Unexpected bytes after PNG IEND: {path}")
    path.write_bytes(bytes(kept))
    return {
        "path": path.relative_to(ROOT).as_posix(),
        "removed_chunk_types": removed,
        "sha256": sha256(path),
    }


def sanitize_fbx_native_file(path: Path) -> dict[str, object]:
    """Redact Blender's checkout-specific native-file field in-place."""
    payload = path.read_bytes()
    private_value = str(SOURCE_BLEND).encode("utf-8")
    occurrences = payload.count(private_value)
    if occurrences != 1:
        raise RuntimeError(
            f"Expected one native-file path in {path}, found {occurrences}"
        )
    safe_label = b"CodexOfWar/P10/Round005/EinarSource.blend"
    if len(safe_label) > len(private_value):
        raise RuntimeError("Sanitized FBX native-file label is too long")
    replacement = safe_label + (b" " * (len(private_value) - len(safe_label)))
    path.write_bytes(payload.replace(private_value, replacement))
    if b"/Users/" in path.read_bytes():
        raise RuntimeError(f"Private user path remains in FBX: {path}")
    return {
        "path": path.relative_to(ROOT).as_posix(),
        "native_file_label": safe_label.decode("ascii"),
        "sha256": sha256(path),
    }


def source_tree_digest() -> tuple[str, list[dict[str, object]]]:
    files = sorted(
        [SOURCE_BLEND, *(path for path in SOURCE_TEXTURES.rglob("*") if path.is_file())],
        key=lambda path: path.relative_to(VENDOR_ROOT).as_posix(),
    )
    digest = hashlib.sha256()
    records = []
    for path in files:
        relative = path.relative_to(VENDOR_ROOT).as_posix()
        file_hash = sha256(path)
        digest.update(f"{relative}\0{file_hash}\n".encode("utf-8"))
        records.append(
            {
                "path": relative,
                "sha256": file_hash,
                "bytes": path.stat().st_size,
            }
        )
    return digest.hexdigest(), records


def verify_source() -> None:
    required = (SOURCE_BLEND, SOURCE_LICENSE)
    missing = [str(path) for path in required if not path.is_file()]
    if missing:
        raise FileNotFoundError(f"Missing Round005 source files: {missing}")
    if sha256(SOURCE_BLEND) != EXPECTED_SOURCE_BLEND_SHA256:
        raise RuntimeError("Einar source blend hash mismatch")
    if sha256(SOURCE_LICENSE) != EXPECTED_LICENSE_SHA256:
        raise RuntimeError("CC BY 4.0 license receipt hash mismatch")
    tree_hash, records = source_tree_digest()
    if tree_hash != EXPECTED_SOURCE_TREE_SHA256:
        raise RuntimeError(
            f"Einar source tree mismatch: expected {EXPECTED_SOURCE_TREE_SHA256}, "
            f"got {tree_hash}"
        )
    AUDIT["verified_source_tree_sha256"] = tree_hash
    AUDIT["verified_source_files"] = records


def ensure_directories() -> None:
    for path in (PREFLIGHT, MODEL_OUT, TEXTURE_OUT):
        path.mkdir(parents=True, exist_ok=True)


def fixed_fbx_clock() -> None:
    import io_scene_fbx.export_fbx_bin as exporter

    class FixedDateTime(_datetime.datetime):
        @classmethod
        def now(cls, tz=None):
            return FIXED_TIME.replace(tzinfo=tz) if tz else FIXED_TIME

    exporter.datetime.datetime = FixedDateTime


def open_source() -> None:
    bpy.ops.wm.open_mainfile(
        filepath=str(SOURCE_BLEND),
        load_ui=False,
        use_scripts=False,
    )
    if "RIG-einar" not in bpy.data.objects:
        raise RuntimeError("Einar source is missing RIG-einar")
    bpy.context.scene.frame_set(0)


def authored_collection() -> bpy.types.Collection:
    collection = bpy.data.collections.get("P10_Round005_AUTHORED")
    if collection is None:
        collection = bpy.data.collections.new("P10_Round005_AUTHORED")
        bpy.context.scene.collection.children.link(collection)
    return collection


def add_object_to_collection(obj: bpy.types.Object, collection: bpy.types.Collection) -> None:
    for owner in list(obj.users_collection):
        owner.objects.unlink(obj)
    collection.objects.link(obj)


def is_explicit_render_mesh(obj: bpy.types.Object) -> bool:
    """Name allow/deny membership is authoritative; driven visibility is not."""
    if obj.type != "MESH":
        return False
    if obj.name.startswith("P10R5_RiftWrench_"):
        return True
    name = obj.name
    if name in STATIC_MESH_EXACT_DENY:
        return False
    if name == "GEO-einar_hat":
        return False
    if name.startswith("GEO-satchel_") and name not in STATIC_MESH_EXACT_ALLOW:
        return False
    if name.startswith(("GEO-dart_", "GEO-pipe_wrench_")):
        return False
    if any(token in name for token in (".proxy", "_preview", "surfdef")):
        return False
    if name.startswith("GEO-blood_") and "droplets" in name:
        return False
    if name in STATIC_MESH_EXACT_ALLOW:
        return True
    return any(pattern.fullmatch(name) for pattern in STATIC_MESH_ALLOW_RE)


def thin_true_hair() -> None:
    records = {}
    for obj in sorted(bpy.data.objects, key=lambda item: item.name):
        if obj.type != "CURVES" or not obj.name.startswith("GEO-einar_"):
            continue
        before_curves = len(obj.data.curves)
        before_points = len(obj.data.points)
        if before_curves:
            remove = [
                index
                for index in range(before_curves)
                if index % 4 != 0
            ]
            obj.data.remove_curves(indices=remove)
        records[obj.name] = {
            "curves_before": before_curves,
            "curves_after": len(obj.data.curves),
            "points_before": before_points,
            "points_after": len(obj.data.points),
            "deterministic_keep_rule": "curve_index % 4 == 0",
        }
    AUDIT["true_hair_reduction"] = records


def cap_render_subdivision() -> None:
    records = []
    for obj in bpy.data.objects:
        for modifier in obj.modifiers:
            if modifier.type != "SUBSURF":
                continue
            before_levels = modifier.levels
            before_render = modifier.render_levels
            modifier.levels = min(modifier.levels, 1)
            modifier.render_levels = min(modifier.render_levels, 1)
            records.append(
                {
                    "object": obj.name,
                    "modifier": modifier.name,
                    "levels_before": before_levels,
                    "levels_after": modifier.levels,
                    "render_levels_before": before_render,
                    "render_levels_after": modifier.render_levels,
                }
            )
    AUDIT["subdivision_caps"] = records


def principled_socket(node: bpy.types.Node, *names: str):
    for name in names:
        socket = node.inputs.get(name)
        if socket is not None:
            return socket
    return None


def inject_palette_tint(
    material: bpy.types.Material,
    color: tuple[float, float, float],
    strength: float,
) -> int:
    if not material.use_nodes:
        return 0
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    changed = 0
    for index, shader in enumerate(
        node for node in list(nodes) if node.type == "BSDF_PRINCIPLED"
    ):
        base = principled_socket(shader, "Base Color")
        if base is None:
            continue
        tint = nodes.new("ShaderNodeMixRGB")
        tint.name = f"P10R5_SourcePreservingTint_{index:02d}"
        tint.label = "P10 R5 restrained indigo fighter palette"
        tint.blend_type = "MULTIPLY"
        tint.inputs[0].default_value = strength
        tint.inputs[2].default_value = (*color, 1.0)
        if base.is_linked:
            original = base.links[0]
            source_socket = original.from_socket
            links.remove(original)
            links.new(source_socket, tint.inputs[1])
        else:
            tint.inputs[1].default_value = base.default_value
        links.new(tint.outputs["Color"], base)
        changed += 1
    return changed


def apply_source_preserving_palette() -> None:
    treatments = {}
    for name, (color, strength) in PALETTE_MATERIALS.items():
        material = bpy.data.materials.get(name)
        if material is None:
            continue
        changed = inject_palette_tint(material, color, strength)
        treatments[name] = {
            "principled_inputs_treated": changed,
            "multiply_color": color,
            "factor": strength,
        }
    AUDIT["source_material_palette_treatments"] = treatments


def make_simple_material(
    name: str,
    base: tuple[float, float, float],
    *,
    metallic: float,
    roughness: float,
    emission: tuple[float, float, float] | None = None,
    emission_strength: float = 0.0,
) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    shader.inputs["Base Color"].default_value = (*base, 1.0)
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    if emission is not None:
        emission_socket = principled_socket(shader, "Emission Color", "Emission")
        if emission_socket is not None:
            emission_socket.default_value = (*emission, 1.0)
        strength = principled_socket(shader, "Emission Strength")
        if strength is not None:
            strength.default_value = emission_strength
    links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    material["p10_round005_authored"] = True
    return material


def reset_pose(rig: bpy.types.Object) -> None:
    bpy.context.scene.frame_set(0)
    if rig.animation_data is not None:
        rig.animation_data.action = None
    for bone in rig.pose.bones:
        bone.matrix_basis.identity()
    properties = rig.pose.bones.get("Properties")
    if properties is None:
        raise RuntimeError("Einar rig is missing the Properties control")
    for key in (
        "ik_left_upperarm",
        "ik_right_upperarm",
        "ik_left_thigh",
        "ik_right_thigh",
        "ik_spine",
    ):
        if key in properties:
            properties[key] = 1.0
    for key in (
        "ik_stretch_left_upperarm",
        "ik_stretch_right_upperarm",
        "ik_stretch_left_thigh",
        "ik_stretch_right_thigh",
    ):
        if key in properties:
            properties[key] = 0.12
    bpy.context.view_layer.update()


def iter_action_fcurves(action: bpy.types.Action):
    """Yield Blender 4+/5 layered-action curves without assigning the action."""
    for layer in action.layers:
        for strip in layer.strips:
            for channelbag in strip.channelbags:
                yield from channelbag.fcurves


def apply_action_pose_frame(
    rig: bpy.types.Object,
    action_name: str,
    frame: float,
    *,
    bone_name_filter=None,
) -> list[str]:
    """Evaluate authored pose channels into matrix-basis properties.

    Manual evaluation avoids leaving a broad source action assigned to the rig;
    this delivery is a single frozen combat pose, not an animation claim.
    """
    action = bpy.data.actions.get(action_name)
    if action is None:
        raise RuntimeError(f"Missing source action: {action_name}")
    pose_pattern = re.compile(
        r'^pose\.bones\["([^"]+)"\]\.([A-Za-z0-9_]+)$'
    )
    custom_pattern = re.compile(
        r'^pose\.bones\["([^"]+)"\]\["([^"]+)"\]$'
    )
    touched = set()
    for fcurve in iter_action_fcurves(action):
        pose_match = pose_pattern.match(fcurve.data_path)
        if pose_match:
            bone_name, property_name = pose_match.groups()
            if bone_name_filter is not None and not bone_name_filter(bone_name):
                continue
            bone = rig.pose.bones.get(bone_name)
            if bone is None or not hasattr(bone, property_name):
                continue
            target = getattr(bone, property_name)
            value = fcurve.evaluate(frame)
            try:
                target[fcurve.array_index] = value
            except (TypeError, IndexError):
                if fcurve.array_index == 0:
                    setattr(bone, property_name, value)
            touched.add(bone_name)
            continue
        custom_match = custom_pattern.match(fcurve.data_path)
        if custom_match:
            bone_name, key = custom_match.groups()
            if bone_name_filter is not None and not bone_name_filter(bone_name):
                continue
            bone = rig.pose.bones.get(bone_name)
            if bone is not None and key in bone:
                bone[key] = fcurve.evaluate(frame)
                touched.add(bone_name)
    bpy.context.view_layer.update()
    return sorted(touched)


def set_control_location(
    rig: bpy.types.Object,
    name: str,
    location: Vector,
) -> None:
    bone = rig.pose.bones.get(name)
    if bone is None:
        raise RuntimeError(f"Missing Einar control: {name}")
    rotation = bone.matrix.to_3x3().to_4x4()
    bone.matrix = Matrix.Translation(location) @ rotation
    bpy.context.view_layer.update()


def set_control_axes(
    rig: bpy.types.Object,
    name: str,
    location: Vector,
    y_axis: Vector,
    z_hint: Vector,
) -> None:
    bone = rig.pose.bones.get(name)
    if bone is None:
        raise RuntimeError(f"Missing Einar control: {name}")
    y_axis = y_axis.normalized()
    z_axis = z_hint - y_axis * z_hint.dot(y_axis)
    if z_axis.length < 0.0001:
        z_axis = Vector((0.0, 1.0, 0.0))
        z_axis -= y_axis * z_axis.dot(y_axis)
    z_axis.normalize()
    x_axis = y_axis.cross(z_axis).normalized()
    matrix = Matrix(
        (
            (x_axis.x, y_axis.x, z_axis.x, location.x),
            (x_axis.y, y_axis.y, z_axis.y, location.y),
            (x_axis.z, y_axis.z, z_axis.z, location.z),
            (0.0, 0.0, 0.0, 1.0),
        )
    )
    bone.matrix = matrix
    bpy.context.view_layer.update()


def set_control_segment(
    rig: bpy.types.Object,
    name: str,
    head: Vector,
    tail: Vector,
    z_hint: Vector,
) -> None:
    set_control_axes(rig, name, head, tail - head, z_hint)


def rotate_control_world(
    rig: bpy.types.Object,
    name: str,
    *,
    z_radians: float = 0.0,
    x_radians: float = 0.0,
    y_radians: float = 0.0,
) -> None:
    bone = rig.pose.bones[name]
    location = bone.matrix.translation.copy()
    rotation = bone.matrix.to_3x3().to_4x4()
    bone.matrix = (
        Matrix.Translation(location)
        @ Matrix.Rotation(z_radians, 4, "Z")
        @ Matrix.Rotation(x_radians, 4, "X")
        @ Matrix.Rotation(y_radians, 4, "Y")
        @ rotation
    )
    bpy.context.view_layer.update()


def curl_fingers(rig: bpy.types.Object, side: str, amount: float) -> None:
    digits = ("Index", "Middle", "Pinky")
    if side == "R":
        digits = (*digits, "Ring")
    for digit in digits:
        for segment, factor in ((1, 0.82), (2, 1.18), (3, 0.98)):
            name = f"FK-Finger_{digit}{segment}.{side}"
            bone = rig.pose.bones.get(name)
            if bone is not None:
                bone.rotation_mode = "XYZ"
                bone.rotation_euler.x = amount * factor
    for segment, factor in ((1, 0.36), (2, 0.78), (3, 0.62)):
        name = f"FK-Finger_Thumb{segment}.{side}"
        bone = rig.pose.bones.get(name)
        if bone is not None:
            bone.rotation_mode = "XYZ"
            bone.rotation_euler.x = amount * factor
            bone.rotation_euler.y = (
                (-1.0 if side == "R" else 1.0) * amount * factor * 0.28
            )
    bpy.context.view_layer.update()


def set_combat_pose(rig: bpy.types.Object) -> dict[str, Vector]:
    reset_pose(rig)
    face_bones = apply_action_pose_frame(
        rig,
        "Face_angry2",
        120.0,
    )
    quality = rig.pose.bones.get("Properties_Character_Einar")
    if quality is not None and "Quality" in quality:
        quality["Quality"] = 3

    set_control_location(rig, "MSTR-Spine_Hips", Vector((0.0, -0.07, 0.95)))
    set_control_location(rig, "MSTR-Spine_Torso", Vector((0.0, -0.06, 0.89)))
    rotate_control_world(
        rig,
        "MSTR-Spine_Chest",
        z_radians=math.radians(18.0),
        x_radians=math.radians(10.0),
    )
    rotate_control_world(
        rig,
        "FK-Head",
        z_radians=math.radians(-13.0),
        x_radians=math.radians(-6.0),
    )

    set_control_location(
        rig, "IK-MSTR-Wrist.L", Vector((0.20, -0.52, 1.38))
    )
    set_control_location(
        rig, "IK-POLE-UpperArm.L", Vector((0.58, -0.38, 1.38))
    )
    set_control_location(
        rig, "IK-MSTR-Wrist.R", Vector((-0.12, -0.54, 1.15))
    )
    set_control_location(
        rig, "IK-POLE-UpperArm.R", Vector((-0.58, -0.36, 1.08))
    )
    set_control_location(
        rig, "IK-MSTR-Foot.L", Vector((0.31, 0.17, 0.087))
    )
    set_control_location(
        rig, "IK-POLE-Thigh.L", Vector((0.27, -0.93, 0.42))
    )
    set_control_location(
        rig, "IK-MSTR-Foot.R", Vector((-0.31, -0.18, 0.087))
    )
    set_control_location(
        rig, "IK-POLE-Thigh.R", Vector((-0.27, -0.96, 0.40))
    )
    bpy.context.view_layer.update()

    # Use the source-authored human-hand grip from its finger test, then apply
    # a stronger three-claw closure to the mechanical hand.
    human_grip_bones = apply_action_pose_frame(
        rig,
        "AnimTest_Fingers",
        54.0,
        bone_name_filter=lambda name: (
            name.startswith("FK-Finger_") and name.endswith(".R")
        ),
    )
    curl_fingers(rig, "L", math.radians(82.0))

    grab_l = rig.pose.bones["Grab.L"].matrix.translation.copy()
    grab_r = rig.pose.bones["Grab.R"].matrix.translation.copy()
    bpy.context.view_layer.update()
    AUDIT["source_pose_actions"] = {
        "face": {
            "action": "Face_angry2",
            "source_frame": 120.0,
            "bones_touched": face_bones,
        },
        "human_hand_grip": {
            "action": "AnimTest_Fingers",
            "source_frame": 54.0,
            "bones_touched": human_grip_bones,
        },
        "mechanical_claw": (
            "Round005 static pose edit on existing FK finger controls; "
            "no animation claim."
        ),
        "rig_quality_for_evidence": 3,
    }
    return {
        "mechanical_wrist": Vector((0.20, -0.52, 1.38)),
        "weapon_grip_left": grab_l,
        "weapon_grip_right": grab_r,
        "left_ankle": Vector((0.31, 0.17, 0.087)),
        "right_ankle": Vector((-0.31, -0.18, 0.087)),
    }


def build_war_wrench(
    materials: dict[str, bpy.types.Material],
    grip_left: Vector,
    grip_right: Vector,
) -> tuple[bpy.types.Object, list[bpy.types.Object]]:
    collection = authored_collection()
    root = bpy.data.objects.new("P10R5_RiftWrench_ROOT", None)
    collection.objects.link(root)
    parts = []
    for source_name in WRENCH_SOURCE_OBJECTS:
        source = bpy.data.objects[source_name]
        obj = bpy.data.objects.new(
            f"P10R5_RiftWrench_{source_name.removeprefix('GEO-pipe_wrench_')}",
            source.data.copy(),
        )
        collection.objects.link(obj)
        obj.parent = root
        obj.matrix_parent_inverse = Matrix.Identity(4)
        obj.matrix_local = Matrix.Identity(4)
        obj.data.materials.clear()
        if source_name == "GEO-pipe_wrench_handle":
            obj.data.materials.append(materials["wrench_grip"])
        elif source_name == "GEO-pipe_wrench_nut":
            obj.data.materials.append(materials["wrench_nut"])
        else:
            obj.data.materials.append(materials["wrench_metal"])
        for polygon in obj.data.polygons:
            polygon.material_index = 0
        obj.hide_render = False
        obj["p10_round005_derivation"] = (
            f"Geometry copied from {source_name}; all five absent vendor wrench "
            "maps intentionally replaced by exact resolved production materials "
            "already authored in the Einar source."
        )
        parts.append(obj)

    local_z = (grip_right - grip_left).normalized()
    local_y = Vector((0.0, -1.0, 0.0))
    local_y -= local_z * local_y.dot(local_z)
    local_y.normalize()
    local_x = local_y.cross(local_z).normalized()
    orientation = Matrix(
        (
            (local_x.x, local_y.x, local_z.x, 0.0),
            (local_x.y, local_y.y, local_z.y, 0.0),
            (local_x.z, local_y.z, local_z.z, 0.0),
            (0.0, 0.0, 0.0, 1.0),
        )
    )
    scale = 2.18
    root.matrix_world = (
        Matrix.Translation(grip_left)
        @ orientation
        @ Matrix.Diagonal((scale, scale, scale, 1.0))
    )
    root["p10_round005_weapon"] = "Rift Wrench"
    root["p10_round005_grip_left_world"] = [
        float(value) for value in grip_left
    ]
    root["p10_round005_grip_right_world"] = [
        float(value) for value in grip_right
    ]
    AUDIT["weapon"] = {
        "name": "Rift Wrench",
        "source_geometry_objects": list(WRENCH_SOURCE_OBJECTS),
        "source_geometry_triangles": 14410,
        "vendor_maps_intentionally_not_claimed": [
            "pipe_wrench.normal",
            "pipe_wrench.pointiness",
            "tool_props.color",
            "tool_props.metal_rough_spec",
            "tool_props.normal",
        ],
        "resolved_source_materials": {
            "metal": materials["wrench_metal"].name,
            "grip": materials["wrench_grip"].name,
            "nut": materials["wrench_nut"].name,
        },
        "material_strategy": (
            "Exact resolved production Einar materials replace the five absent "
            "pipe-wrench/tool-prop maps for this probe. No flat-value authored "
            "wear and no missing vendor map is claimed."
        ),
        "display_scale": scale,
    }
    return root, parts


def build_source_driven_warrior_adaptation() -> list[bpy.types.Object]:
    """Expose the strongest existing asymmetric source kit without mirroring."""
    hidden_civilian = []
    for obj in bpy.data.objects:
        hide = obj.name == "GEO-einar_hat"
        if obj.name.startswith("GEO-satchel_"):
            hide = obj.name != "GEO-satchel_strap"
        if hide:
            obj.hide_render = True
            hidden_civilian.append(obj.name)

    groom_layers = (
        "GEO-einar_hair",
        "GEO-einar_hair.messy",
        "GEO-einar_mustache",
        "GEO-einar_mustache.messy",
        "GEO-einar_beard",
        "GEO-einar_beard.messy",
    )
    shown_groom = []
    for name in groom_layers:
        obj = bpy.data.objects.get(name)
        if obj is not None:
            obj.hide_render = False
            obj.hide_set(False)
            shown_groom.append(name)

    pauldron_parts = (
        "GEO-einar_tire_shoulder",
        "GEO-einar_tire_shoulder_padding",
        "GEO-einar_tire_shoulder_bolt1",
        "GEO-einar_tire_shoulder_bolt2",
        "GEO-einar_tire_shoulder_bolt3",
        "GEO-einar_tire_shoulder_bolt4",
    )
    shown_pauldron = []
    for name in pauldron_parts:
        obj = bpy.data.objects.get(name)
        if obj is not None:
            obj.hide_render = False
            obj.hide_set(False)
            shown_pauldron.append(
                {
                    "object": name,
                    "materials": [
                        slot.material.name
                        for slot in obj.material_slots
                        if slot.material is not None
                    ],
                }
            )

    load_path_parts = (
        "GEO-satchel_strap",
        "GEO-body_anchor_straps",
        "GEO-einar_tire_knee",
        "GEO-einar_tire_knee_straps",
    )
    shown_load_path = []
    for name in load_path_parts:
        obj = bpy.data.objects.get(name)
        if obj is not None:
            obj.hide_render = False
            obj.hide_set(False)
            shown_load_path.append(name)

    blood_collection = bpy.data.collections.get("einar.shading.blood")
    if blood_collection is not None:
        for obj in blood_collection.all_objects:
            obj.hide_render = True
    shown_blood = []
    for name in ("GEO-blood_cheek_R.cut", "GEO-blood_brow_R.cut"):
        obj = bpy.data.objects.get(name)
        if obj is not None:
            obj.hide_render = False
            shown_blood.append(name)

    AUDIT["source_driven_warrior_adaptation"] = {
        "hidden_civilian_identifiers": hidden_civilian,
        "visible_clean_and_messy_groom_layers": shown_groom,
        "visible_human_right_tire_pauldron": shown_pauldron,
        "visible_load_path": shown_load_path,
        "visible_restrained_blood_cuts_only": shown_blood,
        "principle": (
            "Only existing asymmetric production Einar geometry is exposed. "
            "No mirrored armor and no primitive armor geometry is introduced."
        ),
    }
    return [
        bpy.data.objects[name]
        for name in (*pauldron_parts, *load_path_parts)
        if name in bpy.data.objects
    ]


def build_round005_materials() -> dict[str, bpy.types.Material]:
    required = {
        key: bpy.data.materials.get(name)
        for key, name in {
            "wrench_metal": "einar.metal_rust2.generic",
            "wrench_grip": "einar.rubber_tires",
            "wrench_nut": "einar.metal_rust3.generic",
        }.items()
    }
    missing = [key for key, material in required.items() if material is None]
    if missing:
        raise RuntimeError(f"Missing resolved Einar production materials: {missing}")
    return {
        **required,
        "floor": make_simple_material(
            "P10R5_StageFloor",
            (0.012, 0.017, 0.022),
            metallic=0.12,
            roughness=0.36,
        ),
    }


def look_at(obj: bpy.types.Object, target: Vector | tuple[float, float, float]) -> None:
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def setup_stage(materials: dict[str, bpy.types.Material]) -> bpy.types.Object:
    for obj in list(bpy.data.objects):
        if obj.type in {"LIGHT", "CAMERA"}:
            bpy.data.objects.remove(obj, do_unlink=True)
    collection = bpy.data.collections.new("P10_Round005_STAGE")
    bpy.context.scene.collection.children.link(collection)

    bpy.ops.mesh.primitive_plane_add(size=20.0, location=(0.0, 0.0, -0.004))
    floor = bpy.context.object
    floor.name = "P10R5_STAGE_Floor"
    add_object_to_collection(floor, collection)
    floor.data.materials.append(materials["floor"])

    def add_area(
        name: str,
        location: tuple[float, float, float],
        energy: float,
        color: tuple[float, float, float],
        size: float,
        target: tuple[float, float, float] = (0.0, -0.02, 1.0),
    ) -> None:
        light = bpy.data.lights.new(name, "AREA")
        light.energy = energy
        light.color = color
        light.shape = "DISK"
        light.size = size
        obj = bpy.data.objects.new(name, light)
        collection.objects.link(obj)
        obj.location = location
        look_at(obj, target)

    add_area(
        "P10R5_STAGE_Key",
        (2.7, -3.3, 3.7),
        720.0,
        (1.0, 0.79, 0.61),
        2.3,
    )
    add_area(
        "P10R5_STAGE_Fill",
        (-2.3, -2.5, 2.0),
        360.0,
        (0.34, 0.52, 0.72),
        2.6,
    )
    add_area(
        "P10R5_STAGE_Rim",
        (-2.8, 1.9, 3.0),
        960.0,
        (0.08, 0.52, 0.64),
        2.0,
    )
    add_area(
        "P10R5_STAGE_RobotRim",
        (2.6, 1.2, 2.0),
        580.0,
        (0.18, 0.47, 0.58),
        1.5,
    )
    add_area(
        "P10R5_STAGE_Top",
        (0.0, 0.1, 4.4),
        420.0,
        (0.72, 0.77, 0.82),
        1.8,
    )

    camera_data = bpy.data.cameras.new("P10R5_STAGE_Camera")
    camera = bpy.data.objects.new("P10R5_STAGE_Camera", camera_data)
    collection.objects.link(camera)
    bpy.context.scene.camera = camera

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.film_transparent = False
    scene.render.fps = 30
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    if background is not None:
        background.inputs["Color"].default_value = (0.004, 0.007, 0.012, 1.0)
        background.inputs["Strength"].default_value = 0.10
    scene.view_settings.look = "Medium High Contrast"
    scene.view_settings.exposure = -0.10
    scene.view_settings.gamma = 1.0
    return camera


def place_camera(
    camera: bpy.types.Object,
    location: tuple[float, float, float],
    target: tuple[float, float, float],
    lens: float,
) -> None:
    camera.location = Vector(location)
    camera.data.lens = lens
    camera.data.sensor_width = 36.0
    look_at(camera, target)
    bpy.context.view_layer.update()


def render_to(
    camera: bpy.types.Object,
    output: Path,
    *,
    location: tuple[float, float, float],
    target: tuple[float, float, float],
    lens: float,
    size: int,
) -> None:
    place_camera(camera, location, target, lens)
    scene = bpy.context.scene
    scene.render.resolution_x = size
    scene.render.resolution_y = size
    scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)
    if not output.is_file() or output.stat().st_size < 1024:
        raise RuntimeError(f"Render failed: {output}")
    strip_png_private_metadata(output)


def prepare_character(
    *,
    full_topology_freeze: bool = False,
) -> tuple[
    bpy.types.Object,
    bpy.types.Object,
    list[bpy.types.Object],
    dict[str, bpy.types.Material],
    dict[str, Vector],
]:
    thin_true_hair()
    if not full_topology_freeze:
        cap_render_subdivision()
    else:
        AUDIT["pre_freeze_subdivision_mutation"] = False
    apply_source_preserving_palette()
    rig = bpy.data.objects["RIG-einar"]
    pose = set_combat_pose(rig)
    materials = build_round005_materials()
    wrench_root, wrench_parts = build_war_wrench(
        materials,
        pose["weapon_grip_left"],
        pose["weapon_grip_right"],
    )
    adaptation = build_source_driven_warrior_adaptation()
    AUDIT["combat_pose_targets"] = {
        key: [round(float(value), 6) for value in vector]
        for key, vector in pose.items()
    }
    return rig, wrench_root, [*wrench_parts, *adaptation], materials, pose


def source_category(obj: bpy.types.Object) -> str:
    if obj.name.startswith("P10R5_RiftWrench_"):
        return "weapon"
    name = obj.name
    if name == "GEO-satchel_strap":
        return "strap"
    if name.startswith("GEO-einar_tire_") or name.startswith(
        "GEO-body_anchor_"
    ):
        return "armor"
    if (
        name == "GEO-einar_head"
        or name.startswith("GEO-eye")
        or name.startswith("GEO-einar_teeth_")
        or name
        in {
            "GEO-einar_tongue",
            "GEO-einar_fingers",
            "GEO-einar_glove",
        }
    ):
        return "head"
    if not name.startswith("GEO-einar_"):
        return "mech"
    return "clothing"


def triangle_count(obj: bpy.types.Object) -> int:
    obj.data.calc_loop_triangles()
    return len(obj.data.loop_triangles)


def bounds_record(objects: list[bpy.types.Object]) -> dict[str, list[float]]:
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
        "min": [round(float(value), 6) for value in minimum],
        "max": [round(float(value), 6) for value in maximum],
        "dimensions": [
            round(float(value), 6) for value in (maximum - minimum)
        ],
    }


def new_lod_collection(name: str) -> bpy.types.Collection:
    old = bpy.data.collections.get(name)
    if old is not None:
        bpy.data.collections.remove(old)
    collection = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(collection)
    return collection


def freeze_render_object(
    source: bpy.types.Object,
    collection: bpy.types.Collection,
    depsgraph: bpy.types.Depsgraph,
) -> bpy.types.Object | None:
    evaluated = source.evaluated_get(depsgraph)
    mesh = bpy.data.meshes.new_from_object(
        evaluated,
        preserve_all_data_layers=True,
        depsgraph=depsgraph,
    )
    mesh.calc_loop_triangles()
    if not mesh.loop_triangles:
        bpy.data.meshes.remove(mesh)
        return None
    obj = bpy.data.objects.new(
        f"P10R5_FREEZE_{source_category(source).upper()}_{source.name}",
        mesh,
    )
    collection.objects.link(obj)
    obj.matrix_world = evaluated.matrix_world.copy()
    obj["p10_round005_frozen_source_object"] = source.name
    obj["p10_round005_static_only"] = True
    return obj


def join_meshes(
    objects: list[bpy.types.Object],
    name: str,
) -> bpy.types.Object:
    if not objects:
        raise RuntimeError(f"No meshes available for {name}")
    if bpy.context.object is not None and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.hide_set(False)
        obj.select_set(True)
    active = objects[0]
    bpy.context.view_layer.objects.active = active
    bpy.ops.object.join()
    active.name = name
    active.data.name = f"{name}_MESH"
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    try:
        bpy.ops.object.material_slot_remove_unused()
    except RuntimeError:
        pass
    active["p10_round005_static_only"] = True
    return active


def decimate_to_target(
    obj: bpy.types.Object,
    target: int,
) -> dict[str, object]:
    before = triangle_count(obj)
    if before > target:
        modifier = obj.modifiers.new("P10R5_AuditedDecimate", "DECIMATE")
        modifier.decimate_type = "COLLAPSE"
        modifier.ratio = max(0.01, min(1.0, target / before))
        modifier.use_collapse_triangulate = True
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    after = triangle_count(obj)
    return {
        "object": obj.name,
        "target_triangles": target,
        "triangles_before": before,
        "triangles_after": after,
        "ratio_applied": round(after / before, 8) if before else 1.0,
    }


def triangulate_static_mesh(obj: bpy.types.Object) -> None:
    modifier = obj.modifiers.new("P10R5_FrozenTriangulation", "TRIANGULATE")
    modifier.quad_method = "BEAUTY"
    modifier.ngon_method = "BEAUTY"
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.data.calc_loop_triangles()


def remove_degenerate_triangles(obj: bpy.types.Object) -> dict[str, object]:
    """Delete zero-area and duplicate triangles before audit/export."""
    mesh = obj.data
    mesh.calc_loop_triangles()
    before = len(mesh.loop_triangles)
    degenerate_polygon_indices = {
        triangle.polygon_index
        for triangle in mesh.loop_triangles
        if (
            (
                mesh.vertices[triangle.vertices[1]].co
                - mesh.vertices[triangle.vertices[0]].co
            ).cross(
                mesh.vertices[triangle.vertices[2]].co
                - mesh.vertices[triangle.vertices[0]].co
            ).length_squared
            <= 1e-18
        )
    }
    seen_triangle_vertices: set[tuple[int, int, int]] = set()
    duplicate_polygon_indices = set()
    for polygon in mesh.polygons:
        if len(polygon.vertices) != 3:
            continue
        canonical = tuple(sorted(int(index) for index in polygon.vertices))
        if canonical in seen_triangle_vertices:
            duplicate_polygon_indices.add(polygon.index)
        else:
            seen_triangle_vertices.add(canonical)
    removal_indices = (
        degenerate_polygon_indices | duplicate_polygon_indices
    )
    if removal_indices:
        editable = bmesh.new()
        editable.from_mesh(mesh)
        editable.faces.ensure_lookup_table()
        bmesh.ops.delete(
            editable,
            geom=[
                editable.faces[index]
                for index in sorted(removal_indices)
            ],
            context="FACES",
        )
        editable.to_mesh(mesh)
        editable.free()
        mesh.update()
    mesh.calc_loop_triangles()
    after = len(mesh.loop_triangles)
    return {
        "object": obj.name,
        "triangles_before": before,
        "zero_area_triangles_removed": len(degenerate_polygon_indices),
        "duplicate_triangles_removed": len(
            duplicate_polygon_indices - degenerate_polygon_indices
        ),
        "triangles_after": after,
    }


def hair_card_material(
    name: str,
    color: tuple[float, float, float],
) -> bpy.types.Material:
    material = make_simple_material(
        name,
        color,
        metallic=0.0,
        roughness=0.48,
    )
    shader = next(
        node
        for node in material.node_tree.nodes
        if node.type == "BSDF_PRINCIPLED"
    )
    anisotropic = principled_socket(
        shader,
        "Anisotropic IOR Level",
        "Anisotropic",
    )
    if anisotropic is not None:
        anisotropic.default_value = 0.42
    material.use_backface_culling = False
    material["p10_round005_opaque_two_sided_ribbon_fallback"] = True
    return material


def build_hair_cards(
    collection: bpy.types.Collection,
) -> tuple[bpy.types.Object, dict[str, object]]:
    """Build exactly 5,538 deterministic two-sided ribbon triangles."""
    # source name: (post-thin stride, quads per guide, card width, silver share)
    guide_specs = {
        "GEO-einar_beard": (24, 5, 0.0032, 0.72),
        "GEO-einar_beard.messy": (16, 5, 0.0030, 0.70),
        "GEO-einar_hair": (16, 3, 0.0032, 0.45),
        "GEO-einar_hair.messy": (8, 3, 0.0030, 0.42),
        "GEO-einar_mustache": (16, 3, 0.0018, 0.60),
        "GEO-einar_mustache.messy": (8, 3, 0.0018, 0.58),
        "GEO-einar_eyebrows": (6, 2, 0.0017, 0.34),
        "GEO-einar_eyelashes": (3, 1, 0.0008, 0.08),
        "GEO-einar_hair_ears": (5, 2, 0.0016, 0.38),
        "GEO-einar_hair_nose": (5, 1, 0.0014, 0.45),
    }
    head = bpy.data.objects["GEO-einar_head"]
    head_points = [head.matrix_world @ Vector(corner) for corner in head.bound_box]
    head_center = sum(head_points, Vector()) / len(head_points)
    depsgraph = bpy.context.evaluated_depsgraph_get()
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, int, int, int]] = []
    uv_by_vertex: list[tuple[float, float]] = []
    face_material_indices: list[int] = []
    records = []

    for source_name, (
        stride,
        quads_per_guide,
        width,
        silver_probability,
    ) in guide_specs.items():
        source = bpy.data.objects.get(source_name)
        if source is None or source.type != "CURVES":
            continue
        evaluated = source.evaluated_get(depsgraph)
        curves = evaluated.data.curves
        count = len(curves)
        if not count:
            continue
        guide_indices = list(range(0, count, stride))
        curves_built = 0
        for guide_index in guide_indices:
            curve = curves[guide_index]
            points = [
                evaluated.matrix_world @ point.position
                for point in curve.points
            ]
            if len(points) < 2:
                continue
            sample_count = min(quads_per_guide + 1, len(points))
            sample_indices = sorted(
                {
                    round(index * (len(points) - 1) / max(1, sample_count - 1))
                    for index in range(sample_count)
                }
            )
            points = [points[index] for index in sample_indices]
            material_index = int(
                ((guide_index * 2654435761) & 0xFFFFFFFF) / 0xFFFFFFFF
                < silver_probability
            )
            ribbon_base = len(vertices)
            transported_width = None
            for point_index, point in enumerate(points):
                previous = points[max(0, point_index - 1)]
                following = points[min(len(points) - 1, point_index + 1)]
                tangent = following - previous
                if tangent.length < 1e-6:
                    tangent = Vector((0.0, 0.0, 1.0))
                tangent.normalize()
                radial = point - head_center
                width_direction = tangent.cross(radial)
                if width_direction.length < 1e-6:
                    width_direction = tangent.cross(Vector((0.0, -1.0, 0.0)))
                width_direction.normalize()
                if (
                    transported_width is not None
                    and width_direction.dot(transported_width) < 0.0
                ):
                    width_direction.negate()
                transported_width = width_direction.copy()
                taper = 1.0 - 0.88 * (
                    point_index / max(1, len(points) - 1)
                )
                half_width = width * taper * 0.5
                left = point - width_direction * half_width
                right = point + width_direction * half_width
                vertices.extend((tuple(left), tuple(right)))
                v = point_index / max(1, len(points) - 1)
                uv_by_vertex.extend(((0.0, v), (1.0, v)))
            for segment in range(len(points) - 1):
                start = ribbon_base + segment * 2
                faces.append((start, start + 1, start + 3, start + 2))
                face_material_indices.append(material_index)
            curves_built += 1
        records.append(
            {
                "source": source_name,
                "available_curves_after_25pct_source_thinning": count,
                "deterministic_stride": stride,
                "guides_built": curves_built,
                "quads_per_guide": quads_per_guide,
                "ribbons_per_guide": 1,
                "width_m": width,
            }
        )

    if not faces:
        raise RuntimeError("Hair-card construction produced no faces")
    mesh = bpy.data.meshes.new("P10R5_LOD0_HAIR_CARDS_MESH")
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(
        hair_card_material("P10R5_HairCards_Dark", (0.020, 0.014, 0.010))
    )
    mesh.materials.append(
        hair_card_material("P10R5_HairCards_Silver", (0.30, 0.27, 0.23))
    )
    for polygon, material_index in zip(
        mesh.polygons,
        face_material_indices,
        strict=True,
    ):
        polygon.material_index = material_index
    uv_layer = mesh.uv_layers.new(name="UVMap")
    for loop in mesh.loops:
        uv_layer.data[loop.index].uv = uv_by_vertex[loop.vertex_index]
    mesh.update()
    obj = bpy.data.objects.new("P10R5_LOD0_HAIR_CARDS", mesh)
    collection.objects.link(obj)
    obj["p10_round005_static_only"] = True
    obj["p10_round005_hair_card_source"] = (
        "Deterministic sampled ribbons from evaluated Blender Studio Einar "
        "groom curves after the disclosed 25% source reduction."
    )
    hair_triangles = triangle_count(obj)
    if hair_triangles != HAIR_CARD_TARGET_TRIS:
        raise RuntimeError(
            f"Deterministic hair-card budget changed: {hair_triangles}, "
            f"expected exactly {HAIR_CARD_TARGET_TRIS}"
        )
    return obj, {
        "objects": records,
        "vertices": len(mesh.vertices),
        "triangles": hair_triangles,
        "material_strategy": (
            "Two opaque, solid, two-sided Principled ribbon materials; exact "
            "triangle/material disclosure is required. This is not alpha-card "
            "parity with the full Curves groom and not an animation claim."
        ),
    }


def build_static_lods() -> dict[str, list[bpy.types.Object]]:
    freeze_collection = new_lod_collection("P10_Round005_LOD0")
    # Full posed source topology is evaluated before any reduction. Mutating
    # subdivision first corrupts the tire-shoulder Surface Deform binding.
    detail_records: list[dict[str, object]] = []
    depsgraph = bpy.context.evaluated_depsgraph_get()
    category_parts: dict[str, list[bpy.types.Object]] = {
        category: [] for category in LOD0_CATEGORY_TARGETS
    }
    source_records = []
    for source in sorted(bpy.data.objects, key=lambda item: item.name):
        if not is_explicit_render_mesh(source):
            continue
        frozen = freeze_render_object(source, freeze_collection, depsgraph)
        if frozen is None:
            continue
        category = source_category(source)
        category_parts[category].append(frozen)
        source_records.append(
            {
                "source_object": source.name,
                "source_type": source.type,
                "category": category,
                "frozen_object": frozen.name,
                "frozen_triangles": triangle_count(frozen),
                "collections": sorted(
                    collection.name for collection in source.users_collection
                ),
            }
        )

    category_objects = {}
    decimation_records = []
    for category, parts in category_parts.items():
        combined = join_meshes(parts, f"P10R5_LOD0_{category.upper()}")
        category_objects[category] = combined
        decimation_records.append(
            decimate_to_target(combined, LOD0_CATEGORY_TARGETS[category])
        )
    hair, hair_record = build_hair_cards(freeze_collection)
    lod0 = [*category_objects.values(), hair]
    total = sum(triangle_count(obj) for obj in lod0)
    if total > LOD0_MAX_TRIS:
        excess_target = max(
            1000,
            triangle_count(category_objects["clothing"])
            - (total - LOD0_TARGET_TRIS),
        )
        decimation_records.append(
            decimate_to_target(category_objects["clothing"], excess_target)
        )
        total = sum(triangle_count(obj) for obj in lod0)
    degenerate_cleanup_records = []
    for obj in lod0:
        triangulate_static_mesh(obj)
        degenerate_cleanup_records.append(remove_degenerate_triangles(obj))
    total = sum(triangle_count(obj) for obj in lod0)
    if not (LOD0_MIN_TRIS <= total <= LOD0_MAX_TRIS):
        raise RuntimeError(
            f"LOD0 triangle budget failed: {total}, expected "
            f"{LOD0_MIN_TRIS}..{LOD0_MAX_TRIS}"
        )

    # Source high geometry and true curves are not allowed to mask LOD quality.
    for obj in bpy.data.objects:
        if is_explicit_render_mesh(obj) or obj.type == "CURVES":
            if obj not in lod0:
                obj.hide_render = True
    for obj in lod0:
        obj.hide_render = False
        obj.hide_set(False)

    def make_lower_lod(
        name: str,
        ratio: float,
    ) -> list[bpy.types.Object]:
        collection = new_lod_collection(name)
        results = []
        for source in lod0:
            duplicate = bpy.data.objects.new(
                source.name.replace("LOD0", name.rsplit("_", 1)[-1]),
                source.data.copy(),
            )
            collection.objects.link(duplicate)
            duplicate.matrix_world = source.matrix_world.copy()
            duplicate["p10_round005_static_only"] = True
            duplicate["p10_round005_derived_from"] = source.name
            if triangle_count(duplicate) > 200:
                decimate_to_target(
                    duplicate,
                    max(100, round(triangle_count(duplicate) * ratio)),
                )
            triangulate_static_mesh(duplicate)
            degenerate_cleanup_records.append(
                remove_degenerate_triangles(duplicate)
            )
            duplicate.hide_render = True
            results.append(duplicate)
        return results

    lod1 = make_lower_lod("P10_Round005_LOD1", 0.56)
    lod2 = make_lower_lod("P10_Round005_LOD2", 0.30)
    AUDIT["static_lod_build"] = {
        "selection": {
            "explicit_mesh_allow_patterns": list(STATIC_MESH_ALLOW_PATTERNS),
            "explicit_mesh_exact_allow": sorted(STATIC_MESH_EXACT_ALLOW),
            "driven_hide_render_used_for_membership": False,
            "uses_viewport_visibility": False,
            "excluded_by_construction": [
                "all GEO-satchel_* except exact GEO-satchel_strap",
                "GEO-dart_*",
                "original GEO-pipe_wrench_*",
                "GEO-einar_hat",
                "*.proxy",
                "*_preview*",
                "*surfdef*",
                "GEO-blood_*droplets*",
            ],
        },
        "freeze_order": (
            "Full authored topology posed/evaluated first; explicit meshes "
            "frozen from depsgraph; category decimation only after freeze."
        ),
        "disabled_dense_detail_modifiers": detail_records,
        "degenerate_triangle_cleanup": degenerate_cleanup_records,
        "frozen_sources": source_records,
        "category_decimation": decimation_records,
        "hair_cards": hair_record,
        "lod0": {
            "triangles": total,
            "objects": [
                {
                    "name": obj.name,
                    "triangles": triangle_count(obj),
                    "materials": [
                        slot.material.name
                        for slot in obj.material_slots
                        if slot.material is not None
                    ],
                }
                for obj in lod0
            ],
            "bounds": bounds_record(lod0),
        },
        "lod1": {
            "triangles": sum(triangle_count(obj) for obj in lod1),
            "objects": [obj.name for obj in lod1],
            "bounds": bounds_record(lod1),
        },
        "lod2": {
            "triangles": sum(triangle_count(obj) for obj in lod2),
            "objects": [obj.name for obj in lod2],
            "bounds": bounds_record(lod2),
        },
        "limitations": [
            "Static frozen mesh only; no deform rig or animation delivery.",
            "Portable high-to-low texture atlases are not claimed unless a "
            "separate validated bake receipt is present.",
            "Hair is deterministic ribbon-card fallback, not full source groom.",
        ],
    }
    return {"lod0": lod0, "lod1": lod1, "lod2": lod2}


def set_only_lod_visible(
    lods: dict[str, list[bpy.types.Object]],
    visible_key: str,
) -> None:
    for key, objects in lods.items():
        for obj in objects:
            obj.hide_render = key != visible_key
            obj.hide_set(key != visible_key)
    bpy.context.view_layer.update()


def export_static_fbx(
    path: Path,
    objects: list[bpy.types.Object],
) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.hide_set(False)
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.export_scene.fbx(
        filepath=str(path),
        use_selection=True,
        object_types={"MESH"},
        apply_unit_scale=True,
        apply_scale_options="FBX_SCALE_ALL",
        bake_space_transform=True,
        use_mesh_modifiers=True,
        mesh_smooth_type="FACE",
        use_triangles=True,
        add_leaf_bones=False,
        bake_anim=False,
        path_mode="COPY",
        embed_textures=True,
    )
    if not path.is_file() or path.stat().st_size < 4096:
        raise RuntimeError(f"FBX export failed: {path}")
    sanitizer_record = sanitize_fbx_native_file(path)
    AUDIT.setdefault("release_sanitization", {}).setdefault(
        "fbx_native_file_fields",
        [],
    ).append(sanitizer_record)


def make_vendor_images_relative() -> list[dict[str, str]]:
    records = []
    for image in bpy.data.images:
        if not image.filepath:
            continue
        resolved = Path(bpy.path.abspath(image.filepath)).resolve()
        try:
            relative = resolved.relative_to(VENDOR_ROOT)
        except ValueError:
            continue
        stored = (
            "//ThirdParty/BlenderStudioEinar/"
            + relative.as_posix()
        )
        image.filepath = stored
        records.append({"image": image.name, "stored_path": stored})
    return records


def render_lod_evidence(
    camera: bpy.types.Object,
) -> None:
    shots = {
        "front": ((0.0, -3.35, 1.20), (0.0, -0.10, 0.92), 58.0),
        "three_quarter": (
            (1.82, -3.34, 1.26),
            (0.02, -0.11, 0.96),
            58.0,
        ),
        "back": ((0.0, 3.35, 1.22), (0.0, -0.03, 0.93), 58.0),
        "profile": ((3.38, -0.02, 1.20), (0.0, -0.10, 0.92), 62.0),
        "face": ((0.95, -2.08, 1.73), (0.0, -0.11, 1.51), 92.0),
        "hands": ((1.08, -2.26, 1.36), (0.05, -0.47, 1.25), 92.0),
        "feet": ((1.05, -2.62, 0.48), (0.0, -0.02, 0.26), 78.0),
        "combat": ((1.82, -3.34, 1.26), (0.02, -0.11, 0.96), 58.0),
        "grip": ((0.78, -1.92, 1.42), (0.06, -0.48, 1.27), 110.0),
    }
    for key, (location, target, lens) in shots.items():
        render_to(
            camera,
            PNG_OUTPUTS[key],
            location=location,
            target=target,
            lens=lens,
            size=RENDER_SIZE,
        )


def write_round005_readme(lods: dict[str, list[bpy.types.Object]]) -> None:
    lod0_tris = sum(triangle_count(obj) for obj in lods["lod0"])
    text = f"""# P10 Round005 — Einar source-quality pivot

This round uses the redistribution-safe Blender Studio Einar v1 source as an
honest source-quality ceiling test. It does **not** claim a God of War-quality
anime-warrior identity, a deform rig, animation delivery, Unity integration, or
portable baked PBR atlases.

Required credit: `{REQUIRED_CREDIT}`

This delivery is a modified adaptation of Einar. Changes include the combat
pose and presentation, visible-source selection, restrained palette treatment,
source-wrench presentation, static topology freeze, LOD reduction, and a
disclosed ribbon-card hair fallback. Blender Foundation does not endorse this
adaptation.

- Source page: {SOURCE_PAGE}
- Anonymous source archive: {SOURCE_DOWNLOAD}
- License: CC BY 4.0 (receipt: `ThirdParty/BlenderStudioEinar/LICENSE-CC-BY-4.0.txt`)
- Canonical license: https://creativecommons.org/licenses/by/4.0/
- Archive SHA256: `{SOURCE_ARCHIVE_SHA256}`
- Source blend SHA256: `{EXPECTED_SOURCE_BLEND_SHA256}`
- Deterministic source tree SHA256: `{EXPECTED_SOURCE_TREE_SHA256}`
- LOD0 post-freeze triangles: `{lod0_tris}`
- Delivery type: static FBX meshes only

The strongest source-preflight frame is preserved under
`Preflight/Iterations/Probe02_AcceptedForFreeze.*`; it is explicitly not a gate
pass. The dominant remaining gap is authored premium anime-warrior identity:
Einar remains an elderly mechanic in civilian workwear even after the strongest
source-driven fighter presentation.

See `Preflight/P10_Round005_Audit.json` and the clean-import validation receipt
for exact selection, counts, bounds, materials, limitations, and file hashes.
"""
    README_OUT.write_text(text, encoding="utf-8")


def run_probe() -> None:
    camera = setup_stage(prepare_character()[3])
    output = Path("/tmp/P10_Round005_EinarForgeWarrior_Probe.png")
    render_to(
        camera,
        output,
        location=(1.82, -3.34, 1.26),
        target=(0.02, -0.11, 0.96),
        lens=58.0,
        size=PROBE_SIZE,
    )
    print(f"[P10:R5] Probe render: {output}")


def run_stats() -> None:
    prepare_character(full_topology_freeze=True)
    depsgraph = bpy.context.evaluated_depsgraph_get()
    records = []
    for obj in sorted(bpy.context.scene.objects, key=lambda item: item.name):
        if not is_explicit_render_mesh(obj):
            continue
        obj.data.calc_loop_triangles()
        evaluated = obj.evaluated_get(depsgraph)
        mesh = bpy.data.meshes.new_from_object(
            evaluated,
            preserve_all_data_layers=True,
            depsgraph=depsgraph,
        )
        mesh.calc_loop_triangles()
        records.append(
            {
                "object": obj.name,
                "base_triangles": len(obj.data.loop_triangles),
                "evaluated_triangles": len(mesh.loop_triangles),
                "materials": [
                    slot.material.name
                    for slot in obj.material_slots
                    if slot.material is not None
                ],
                "modifiers": [
                    {
                        "name": modifier.name,
                        "type": modifier.type,
                        "show_render": modifier.show_render,
                    }
                    for modifier in obj.modifiers
                ],
            }
        )
        bpy.data.meshes.remove(mesh)
    payload = {
        "selection_rule": {
            "explicit_mesh_allow_patterns": list(STATIC_MESH_ALLOW_PATTERNS),
            "explicit_mesh_exact_allow": sorted(STATIC_MESH_EXACT_ALLOW),
            "driven_hide_render_used_for_membership": False,
            "viewport_visibility_used": False,
            "authored_wrench_prefix": "P10R5_RiftWrench_",
        },
        "visible_mesh_count": len(records),
        "base_triangles": sum(item["base_triangles"] for item in records),
        "evaluated_triangles": sum(
            item["evaluated_triangles"] for item in records
        ),
        "objects": records,
    }
    output = Path("/tmp/P10_Round005_VisibleMeshStats.json")
    output.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"[P10:R5] Visible mesh stats: {output}")


def run_build() -> None:
    _, _, _, materials, _ = prepare_character(full_topology_freeze=True)
    lods = build_static_lods()
    AUDIT["evidence_pose"] = {
        "all_nine_images": "same frozen combat pose",
        "front_back_profile_labels": (
            "view direction only; not neutral-pose evidence"
        ),
        "neutral_modeling_coverage_check_11": "unsupported",
    }
    AUDIT["static_freeze_unsupported"] = [
        "Requested blood cut CURVE objects evaluate to zero mesh geometry with "
        "scripts disabled and are not claimed in the static FBX.",
        "FBX texture/material portability is unsupported; vendor image paths "
        "are made relative only for the authored .blend after FBX export.",
        "Opaque solid ribbon cards are a disclosed 5,538-triangle fallback, "
        "not visual parity with the source Curves groom.",
    ]
    set_only_lod_visible(lods, "lod0")
    camera = setup_stage(materials)
    render_lod_evidence(camera)

    export_static_fbx(FBX_OUTPUTS["combat"], lods["lod0"])
    export_static_fbx(FBX_OUTPUTS["lod0"], lods["lod0"])
    export_static_fbx(FBX_OUTPUTS["lod1"], lods["lod1"])
    export_static_fbx(FBX_OUTPUTS["lod2"], lods["lod2"])
    set_only_lod_visible(lods, "lod0")

    AUDIT["relative_vendor_image_paths"] = make_vendor_images_relative()
    bpy.ops.wm.save_as_mainfile(filepath=str(AUTHORED_BLEND), check_existing=False)
    write_round005_readme(lods)
    delivery_paths = [
        AUTHORED_BLEND,
        README_OUT,
        *PNG_OUTPUTS.values(),
        *FBX_OUTPUTS.values(),
    ]
    AUDIT["delivery"] = {
        "type": "static source-preflight and audited static mesh LOD proof",
        "files": [
            {
                "path": path.relative_to(ROOT).as_posix(),
                "bytes": path.stat().st_size,
                "sha256": sha256(path),
            }
            for path in delivery_paths
            if path.is_file()
        ],
        "claims_explicitly_not_made": [
            "God of War-quality gate pass",
            "premium anime-warrior identity",
            "production deform rig",
            "animation-ready FBX",
            "portable baked PBR atlas",
            "Unity integration",
            "runtime performance",
        ],
        "dominant_remaining_gap": (
            "The lawful professional source is an elderly mechanic in civilian "
            "workwear, not a coherently authored premium anime warrior."
        ),
    }
    AUDIT_OUT.write_text(
        json.dumps(AUDIT, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(f"[P10:R5] Authored blend: {AUTHORED_BLEND}")
    print(f"[P10:R5] Audit: {AUDIT_OUT}")


def main() -> None:
    args = parse_args()
    ensure_directories()
    verify_source()
    open_source()
    fixed_fbx_clock()
    if args.mode == "probe":
        run_probe()
    elif args.mode == "stats":
        run_stats()
    else:
        run_build()


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"[P10:R5] FATAL: {exc}", file=sys.stderr)
        raise
