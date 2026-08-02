"""Build the isolated Round006 Nyra + Stormcage contact package.

The build imports the frozen Round005 shipping GLBs, changes only Nyra's
Sword_Regular_A authored pose/material package and Stormcage's authored
geometry/material/marker package, and exports deterministic self-contained GLBs.

Run with Blender 5.2+:
  blender --factory-startup --disable-autoexec --background --python build_contact.py
"""

from __future__ import annotations

import binascii
import json
import math
from pathlib import Path
import struct
import sys
import zlib

import bpy
from mathutils import Matrix, Vector


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
ROUND005_TOOLS = ROOT / "WebAssetSource/P31/source_work/round005_alt"
sys.path.insert(0, str(ROUND005_TOOLS))

from blender_common import (  # noqa: E402
    activate,
    export_glb,
    mesh_summary,
    remove_object,
    sha256,
    write_json,
)


SOURCE_HERO = ROOT / "WebAssetSource/P31/processed/round005/characters/nyra.glb"
SOURCE_WEAPON = ROOT / "WebAssetSource/P31/processed/round005/weapons/stormcage.glb"
FROZEN_HOLLOW = ROOT / "WebAssetSource/P31/processed/round005/characters/hollow.glb"
HERO_GLB = HERE / "glb/nyra.glb"
WEAPON_GLB = HERE / "glb/stormcage.glb"
TEXTURE_DIR = HERE / "textures"
BLEND_DIR = HERE / "blends"
REPORT_DIR = HERE / "reports"

HERO_ACTIONS = {"Idle_Loop", "Walk_Loop", "Sprint_Loop", "Roll", "Sword_Regular_A"}
TEXTURE_SIZE = 256
SECONDARY_GRIP_Z = -0.120


def reset() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)


def png_chunk(kind: bytes, payload: bytes) -> bytes:
    checksum = binascii.crc32(kind)
    checksum = binascii.crc32(payload, checksum) & 0xFFFFFFFF
    return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", checksum)


def write_rgba_png(path: Path, width: int, height: int, pixels: list[tuple[int, int, int, int]]) -> None:
    if len(pixels) != width * height:
        raise ValueError(f"{path.name}: pixel count mismatch")
    rows = bytearray()
    for y in range(height):
        rows.append(0)
        for pixel in pixels[y * width : (y + 1) * width]:
            rows.extend(pixel)
    payload = bytearray(b"\x89PNG\r\n\x1a\n")
    payload.extend(png_chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)))
    payload.extend(png_chunk(b"IDAT", zlib.compress(bytes(rows), level=9)))
    payload.extend(png_chunk(b"IEND", b""))
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(payload)


def nyra_height(x: int, y: int) -> float:
    diagonal = ((x + y * 3) % 29) / 28.0
    weave = (1.0 if x % 8 < 2 else -0.35) + (0.75 if y % 7 < 2 else -0.25)
    crest = 1.7 if abs(((x - y) % 64) - 32) < 2 else 0.0
    return diagonal * 0.22 + weave * 0.20 + crest


def weapon_height(x: int, y: int) -> float:
    center = abs(x - (TEXTURE_SIZE - 1) * 0.5)
    fuller = max(0.0, 1.0 - center / 26.0) * 1.25
    rune = 1.65 if (abs(((x + y * 2) % 71) - 35) < 2 or abs(((x - y) % 83) - 41) < 2) else 0.0
    scratches = 0.5 if ((x * 13 + y * 7) % 97) < 3 else 0.0
    return fuller + rune + scratches


def normal_pixels(height_fn) -> list[tuple[int, int, int, int]]:
    pixels: list[tuple[int, int, int, int]] = []
    for y in range(TEXTURE_SIZE):
        for x in range(TEXTURE_SIZE):
            left = height_fn((x - 1) % TEXTURE_SIZE, y)
            right = height_fn((x + 1) % TEXTURE_SIZE, y)
            down = height_fn(x, (y - 1) % TEXTURE_SIZE)
            up = height_fn(x, (y + 1) % TEXTURE_SIZE)
            nx = (left - right) * 0.75
            ny = (down - up) * 0.75
            nz = 1.0
            length = math.sqrt(nx * nx + ny * ny + nz * nz)
            pixels.append(
                (
                    round((nx / length * 0.5 + 0.5) * 255),
                    round((ny / length * 0.5 + 0.5) * 255),
                    round((nz / length * 0.5 + 0.5) * 255),
                    255,
                )
            )
    return pixels


def build_texture_sources() -> dict[str, Path]:
    TEXTURE_DIR.mkdir(parents=True, exist_ok=True)
    paths = {
        "nyra_base": TEXTURE_DIR / "nyra_round006_basecolor.png",
        "nyra_normal": TEXTURE_DIR / "nyra_round006_normal.png",
        "nyra_orm": TEXTURE_DIR / "nyra_round006_orm.png",
        "weapon_base": TEXTURE_DIR / "stormcage_round006_basecolor.png",
        "weapon_normal": TEXTURE_DIR / "stormcage_round006_normal.png",
        "weapon_orm": TEXTURE_DIR / "stormcage_round006_orm.png",
    }
    nyra_base: list[tuple[int, int, int, int]] = []
    nyra_orm: list[tuple[int, int, int, int]] = []
    weapon_base: list[tuple[int, int, int, int]] = []
    weapon_orm: list[tuple[int, int, int, int]] = []
    for y in range(TEXTURE_SIZE):
        for x in range(TEXTURE_SIZE):
            weave = ((x % 12) < 2) + ((y % 10) < 2)
            sigil = abs(((x - y * 2) % 79) - 39) < 3
            noise = (x * 37 + y * 19 + x * y * 3) % 23
            if sigil:
                nyra_base.append((38 + noise, 102 + noise * 2, 126 + noise * 2, 255))
            elif ((x + y) // 32) % 5 == 0:
                nyra_base.append((80 + noise, 12 + noise // 2, 26 + noise, 255))
            else:
                nyra_base.append((12 + noise // 3, 25 + noise, 39 + noise, 255))
            nyra_orm.append((218 - weave * 18, 164 + weave * 20 + noise // 2, 28 + (70 if sigil else 0), 255))

            center = abs(x - (TEXTURE_SIZE - 1) * 0.5)
            rune = abs(((x + y * 2) % 71) - 35) < 2 or abs(((x - y) % 83) - 41) < 2
            edge = center > TEXTURE_SIZE * 0.39
            scratch = ((x * 13 + y * 7) % 97) < 3
            if rune:
                weapon_base.append((18, 136 + noise * 3, 188 + noise * 2, 255))
            else:
                value = 76 + noise * 3 + (18 if center < 25 else 0) - (24 if edge else 0) + (14 if scratch else 0)
                weapon_base.append((value, value + 9, value + 18, 255))
            weapon_orm.append((196 - (22 if edge else 0), 54 + noise * 3 + (44 if scratch else 0), 238 - (38 if rune else 0), 255))

    write_rgba_png(paths["nyra_base"], TEXTURE_SIZE, TEXTURE_SIZE, nyra_base)
    write_rgba_png(paths["nyra_normal"], TEXTURE_SIZE, TEXTURE_SIZE, normal_pixels(nyra_height))
    write_rgba_png(paths["nyra_orm"], TEXTURE_SIZE, TEXTURE_SIZE, nyra_orm)
    write_rgba_png(paths["weapon_base"], TEXTURE_SIZE, TEXTURE_SIZE, weapon_base)
    write_rgba_png(paths["weapon_normal"], TEXTURE_SIZE, TEXTURE_SIZE, normal_pixels(weapon_height))
    write_rgba_png(paths["weapon_orm"], TEXTURE_SIZE, TEXTURE_SIZE, weapon_orm)
    return paths


def load_image(path: Path, name: str, *, non_color: bool) -> bpy.types.Image:
    image = bpy.data.images.load(str(path), check_existing=False)
    image.name = name
    if non_color:
        image.colorspace_settings.name = "Non-Color"
    image.pack()
    return image


def gltf_occlusion_group() -> bpy.types.NodeTree:
    group = bpy.data.node_groups.get("glTF Material Output")
    if group is not None:
        return group
    group = bpy.data.node_groups.new("glTF Material Output", "ShaderNodeTree")
    group.interface.new_socket(name="Occlusion", in_out="INPUT", socket_type="NodeSocketFloat")
    return group


def attach_pbr_maps(
    material: bpy.types.Material,
    *,
    base_path: Path,
    normal_path: Path,
    orm_path: Path,
    prefix: str,
) -> dict[str, str]:
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    if bsdf is None:
        raise RuntimeError(f"{material.name}: Principled BSDF missing")
    for node in list(nodes):
        if node.label.startswith("ROUND006_") or node.name.startswith("ROUND006_"):
            nodes.remove(node)

    base = load_image(base_path, f"{prefix}_BaseColor", non_color=False)
    normal = load_image(normal_path, f"{prefix}_Normal", non_color=True)
    orm = load_image(orm_path, f"{prefix}_ORM", non_color=True)

    base_node = nodes.new("ShaderNodeTexImage")
    base_node.name = base_node.label = "ROUND006_BASE_COLOR"
    base_node.image = base
    normal_node = nodes.new("ShaderNodeTexImage")
    normal_node.name = normal_node.label = "ROUND006_NORMAL"
    normal_node.image = normal
    normal_map = nodes.new("ShaderNodeNormalMap")
    normal_map.name = normal_map.label = "ROUND006_NORMAL_MAP"
    normal_map.inputs["Strength"].default_value = 0.72
    orm_node = nodes.new("ShaderNodeTexImage")
    orm_node.name = orm_node.label = "ROUND006_ORM"
    orm_node.image = orm
    separate = nodes.new("ShaderNodeSeparateColor")
    separate.name = separate.label = "ROUND006_ORM_CHANNELS"
    occlusion = nodes.new("ShaderNodeGroup")
    occlusion.name = occlusion.label = "ROUND006_GLTF_OCCLUSION"
    occlusion.node_tree = gltf_occlusion_group()

    links.new(base_node.outputs["Color"], bsdf.inputs["Base Color"])
    links.new(normal_node.outputs["Color"], normal_map.inputs["Color"])
    links.new(normal_map.outputs["Normal"], bsdf.inputs["Normal"])
    links.new(orm_node.outputs["Color"], separate.inputs["Color"])
    links.new(separate.outputs["Green"], bsdf.inputs["Roughness"])
    links.new(separate.outputs["Blue"], bsdf.inputs["Metallic"])
    links.new(separate.outputs["Red"], occlusion.inputs["Occlusion"])
    material["round006_texture_contract"] = "base-color+normal+orm"
    return {
        "base_color": base.name,
        "normal": normal.name,
        "orm": orm.name,
        "material": material.name,
    }


def runtime_objects() -> list[bpy.types.Object]:
    hidden_helpers = {
        obj
        for collection in bpy.data.collections
        if collection.name == "glTF_not_exported"
        for obj in collection.objects
    }
    return [obj for obj in bpy.context.scene.objects if obj not in hidden_helpers]


def key_pose_bone(bone: bpy.types.PoseBone, frame: float) -> None:
    bone.keyframe_insert(data_path="location", frame=frame, group=bone.name)
    if bone.rotation_mode == "QUATERNION":
        bone.keyframe_insert(data_path="rotation_quaternion", frame=frame, group=bone.name)
    elif bone.rotation_mode == "AXIS_ANGLE":
        bone.keyframe_insert(data_path="rotation_axis_angle", frame=frame, group=bone.name)
    else:
        bone.keyframe_insert(data_path="rotation_euler", frame=frame, group=bone.name)
    bone.keyframe_insert(data_path="scale", frame=frame, group=bone.name)


def pose_snapshot(armature: bpy.types.Object, frame: float) -> dict[str, Matrix]:
    whole = int(math.floor(frame))
    bpy.context.scene.frame_set(whole, subframe=frame - whole)
    bpy.context.view_layer.update()
    return {bone.name: bone.matrix_basis.copy() for bone in armature.pose.bones}


def apply_pose_snapshot(armature: bpy.types.Object, snapshot: dict[str, Matrix], frame: float) -> None:
    whole = int(math.floor(frame))
    bpy.context.scene.frame_set(whole, subframe=frame - whole)
    for bone in armature.pose.bones:
        bone.matrix_basis = snapshot[bone.name]
        key_pose_bone(bone, frame)
    bpy.context.view_layer.update()


def align_socket_axis(
    armature: bpy.types.Object,
    socket: bpy.types.Object,
    *,
    frame: float,
    desired_axis: Vector,
) -> float:
    whole = int(math.floor(frame))
    bpy.context.scene.frame_set(whole, subframe=frame - whole)
    bpy.context.view_layer.update()
    current = (socket.matrix_world.to_3x3() @ Vector((0.0, 0.0, 1.0))).normalized()
    desired = desired_axis.normalized()
    delta = current.rotation_difference(desired)
    hand = armature.pose.bones["hand_r"]
    pose = hand.matrix.copy()
    hand.matrix = Matrix.LocRotScale(
        pose.to_translation(),
        delta @ pose.to_quaternion(),
        pose.to_scale(),
    )
    key_pose_bone(hand, frame)
    bpy.context.view_layer.update()
    achieved = (socket.matrix_world.to_3x3() @ Vector((0.0, 0.0, 1.0))).normalized()
    return math.degrees(achieved.angle(desired))


def palm_segment_distance(
    armature: bpy.types.Object,
    bone_name: str,
    point: Vector,
) -> float:
    bone = armature.pose.bones[bone_name]
    start = armature.matrix_world @ bone.head
    end = armature.matrix_world @ bone.tail
    segment = end - start
    if segment.length_squared <= 1e-12:
        return (point - start).length
    factor = max(0.0, min(1.0, (point - start).dot(segment) / segment.length_squared))
    return (point - (start + segment * factor)).length


def bake_secondary_grip(
    armature: bpy.types.Object,
    socket: bpy.types.Object,
) -> dict[str, object]:
    action = bpy.data.actions.get("Sword_Regular_A")
    if action is None:
        raise RuntimeError("Sword_Regular_A missing")
    armature.animation_data_create()
    armature.animation_data.action = action
    start, end = (int(round(value)) for value in action.frame_range)
    target = bpy.data.objects.new("left_palm_grip_target", None)
    bpy.context.scene.collection.objects.link(target)
    target.parent = socket
    target.matrix_parent_inverse = Matrix.Identity(4)
    target.location = (0.0, 0.0, SECONDARY_GRIP_Z)
    target.empty_display_type = "SPHERE"
    target.empty_display_size = 0.025

    hand = armature.pose.bones["hand_l"]
    constraint = hand.constraints.new("IK")
    constraint.name = "Round006_SecondaryGrip"
    constraint.target = target
    constraint.chain_count = 3
    constraint.use_tail = False
    constraint.iterations = 96
    activate(armature)
    bpy.ops.object.mode_set(mode="POSE")
    bpy.ops.nla.bake(
        frame_start=start,
        frame_end=end,
        step=1,
        only_selected=False,
        visual_keying=True,
        clear_constraints=True,
        clear_parents=False,
        use_current_action=True,
        clean_curves=False,
        bake_types={"POSE"},
    )
    bpy.ops.object.mode_set(mode="OBJECT")

    samples: dict[str, float] = {}
    for name, frame in (("S03", 2.0), ("S04", 4.0), ("S05", 6.8)):
        whole = int(math.floor(frame))
        bpy.context.scene.frame_set(whole, subframe=frame - whole)
        bpy.context.view_layer.update()
        samples[name] = palm_segment_distance(
            armature, "hand_l", target.matrix_world.translation
        )
    target.parent = socket
    return {
        "constraint": "Round006_SecondaryGrip",
        "target_node": target.name,
        "chain_count": 3,
        "baked_integer_frames": [start, end],
        "critical_sample_m": samples,
        "max_critical_sample_m": max(samples.values()),
    }


def author_contact_clip(armature: bpy.types.Object, socket: bpy.types.Object) -> dict[str, object]:
    action = bpy.data.actions.get("Sword_Regular_A")
    if action is None:
        raise RuntimeError("Sword_Regular_A missing")
    armature.animation_data_create()
    armature.animation_data.action = action

    startup = pose_snapshot(armature, 2.0)
    contact = pose_snapshot(armature, 4.0)
    recovery = pose_snapshot(armature, 7.0)
    apply_pose_snapshot(armature, startup, 2.0)
    for frame in (4.0, 5.0):
        apply_pose_snapshot(armature, contact, frame)
    for frame in (6.0, 7.0, 8.0):
        apply_pose_snapshot(armature, recovery, frame)

    # Startup keeps a guarded diagonal outside the torso; contact preserves the
    # frozen target-reaching line; recovery rises away from Nyra instead of
    # dropping the broad blade through her chest/leg silhouette.
    desired = {
        "S04": Vector((0.07097154049027377, -0.9655406195224052, 0.25038840327125267)),
        "S05": Vector((-0.18, -0.52, 0.835)),
    }
    errors: dict[str, dict[str, float]] = {name: {} for name in desired}
    for frame in (4.0, 5.0):
        errors["S04"][str(int(frame))] = align_socket_axis(
            armature, socket, frame=frame, desired_axis=desired["S04"]
        )
    for frame in (6.0, 7.0, 8.0):
        errors["S05"][str(int(frame))] = align_socket_axis(
            armature, socket, frame=frame, desired_axis=desired["S05"]
        )
    grip = bake_secondary_grip(armature, socket)
    return {
        "runtime_samples": {"S03": 2.0, "S04": 4.0, "S05": 6.8},
        "contact_hold_frames": [4, 5],
        "recovery_hold_frames": [6, 8],
        "desired_blade_axes_hero_local": {
            name: list(axis.normalized()) for name, axis in desired.items()
        },
        "startup_axis": "preserved Round005 source frame 2 orientation",
        "axis_error_degrees": errors,
        "secondary_grip_bake": grip,
    }


def ensure_planar_uv(obj: bpy.types.Object) -> None:
    mesh = obj.data
    if mesh.uv_layers:
        return
    layer = mesh.uv_layers.new(name="Round006UV")
    xs = [vertex.co.x for vertex in mesh.vertices]
    zs = [vertex.co.z for vertex in mesh.vertices]
    minimum_x, maximum_x = min(xs), max(xs)
    minimum_z, maximum_z = min(zs), max(zs)
    span_x = max(maximum_x - minimum_x, 1e-6)
    span_z = max(maximum_z - minimum_z, 1e-6)
    for loop in mesh.loops:
        vertex = mesh.vertices[loop.vertex_index]
        layer.data[loop.index].uv = (
            (vertex.co.x - minimum_x) / span_x,
            (vertex.co.z - minimum_z) / span_z,
        )


def build_hero(textures: dict[str, Path]) -> dict[str, object]:
    reset()
    bpy.ops.import_scene.gltf(filepath=str(SOURCE_HERO))
    armatures = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
    if len(armatures) != 1:
        raise RuntimeError(f"hero armature count {len(armatures)}")
    armature = armatures[0]
    socket = next((obj for obj in bpy.context.scene.objects if obj.name == "weapon_socket"), None)
    if socket is None or socket.parent != armature or socket.parent_bone != "hand_r":
        raise RuntimeError("weapon_socket is not parented to hand_r")
    available = {action.name for action in bpy.data.actions}
    if available != HERO_ACTIONS:
        raise RuntimeError(f"hero action drift: {sorted(available)}")
    material = bpy.data.materials.get("Nyra_TealCloth")
    if material is None:
        raise RuntimeError("Nyra_TealCloth missing")
    map_contract = attach_pbr_maps(
        material,
        base_path=textures["nyra_base"],
        normal_path=textures["nyra_normal"],
        orm_path=textures["nyra_orm"],
        prefix="Nyra_Round006",
    )
    clip_contract = author_contact_clip(armature, socket)
    objects = runtime_objects()
    summary = mesh_summary(objects)
    BLEND_DIR.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_DIR / "nyra_round006.blend"))
    export_glb(HERO_GLB, objects, animations=True, canonicalize_indices=True)
    return {
        "source": str(SOURCE_HERO.relative_to(ROOT)),
        "source_sha256": sha256(SOURCE_HERO),
        "output_sha256": sha256(HERO_GLB),
        "bytes": HERO_GLB.stat().st_size,
        "bones": len(armature.data.bones),
        "clips": sorted(HERO_ACTIONS),
        "right_hand_socket": "weapon_socket",
        "socket_parent_bone": "hand_r",
        "maps": map_contract,
        "contact_clip": clip_contract,
        **summary,
    }


def build_weapon(textures: dict[str, Path]) -> dict[str, object]:
    reset()
    bpy.ops.import_scene.gltf(filepath=str(SOURCE_WEAPON))
    root = next((obj for obj in bpy.context.scene.objects if obj.name == "ClaymoreRoot"), None)
    if root is None:
        raise RuntimeError("ClaymoreRoot missing")
    secondary = next((obj for obj in bpy.context.scene.objects if obj.name == "GripSecondary"), None)
    if secondary is None:
        raise RuntimeError("GripSecondary missing")
    explicit = bpy.data.objects.new("secondary_grip", None)
    bpy.context.scene.collection.objects.link(explicit)
    explicit.parent = root
    explicit.location = secondary.location.copy()
    explicit.rotation_euler = secondary.rotation_euler.copy()
    explicit.empty_display_type = "SPHERE"
    explicit.empty_display_size = 0.035

    contact = next((obj for obj in bpy.context.scene.objects if obj.name == "ContactMarker"), None)
    if contact is None:
        raise RuntimeError("ContactMarker missing")
    # The frozen S04 pose reaches the Hollow slightly beyond the Round005
    # marker. This stays on the blade face and brings the authored marker onto
    # the actual target-contact patch.
    contact.location = (0.030, -0.030, 1.400)

    blade = next((obj for obj in bpy.context.scene.objects if obj.name == "Dawnbreak_Blade"), None)
    if blade is None:
        raise RuntimeError("Dawnbreak_Blade missing")
    ensure_planar_uv(blade)
    material = bpy.data.materials.get("Dawnbreak_Steel")
    if material is None:
        raise RuntimeError("Dawnbreak_Steel missing")
    map_contract = attach_pbr_maps(
        material,
        base_path=textures["weapon_base"],
        normal_path=textures["weapon_normal"],
        orm_path=textures["weapon_orm"],
        prefix="Stormcage_Round006",
    )
    objects = runtime_objects()
    summary = mesh_summary(objects)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_DIR / "stormcage_round006.blend"))
    export_glb(WEAPON_GLB, objects, animations=False, canonicalize_indices=True)
    return {
        "source": str(SOURCE_WEAPON.relative_to(ROOT)),
        "source_sha256": sha256(SOURCE_WEAPON),
        "output_sha256": sha256(WEAPON_GLB),
        "bytes": WEAPON_GLB.stat().st_size,
        "animations": [],
        "primary_grip": "GripPrimary",
        "secondary_grip": "secondary_grip",
        "legacy_secondary_grip": "GripSecondary",
        "contact_marker": "ContactMarker",
        "maps": map_contract,
        **summary,
    }


def main() -> None:
    for directory in (HERO_GLB.parent, WEAPON_GLB.parent, TEXTURE_DIR, BLEND_DIR, REPORT_DIR):
        directory.mkdir(parents=True, exist_ok=True)
    textures = build_texture_sources()
    texture_report = {
        name: {
            "file": str(path.relative_to(HERE)),
            "bytes": path.stat().st_size,
            "sha256": sha256(path),
            "resolution": [TEXTURE_SIZE, TEXTURE_SIZE],
        }
        for name, path in sorted(textures.items())
    }
    hero = build_hero(textures)
    weapon = build_weapon(textures)
    report = {
        "schema": "p31.round006.nyra-stormcage-build.v1",
        "integrated": False,
        "acceptance_claimed": False,
        "frozen_commit": "2c180e3",
        "blender": bpy.app.version_string,
        "scope": ["Nyra Sword_Regular_A contact package", "Stormcage authored package"],
        "hero": hero,
        "weapon": weapon,
        "frozen_hollow": {
            "file": str(FROZEN_HOLLOW.relative_to(ROOT)),
            "sha256": sha256(FROZEN_HOLLOW),
            "bytes": FROZEN_HOLLOW.stat().st_size,
        },
        "textures": texture_report,
        "largest_residual_weakness": (
            "The frozen wide gameplay camera and S04 trail/impact effects partly mask the precise "
            "blade-edge and two-palm contact, even though the unoccluded geometry measurements and "
            "startup/recovery silhouettes are clean."
        ),
    }
    write_json(REPORT_DIR / "build-report.json", report)
    print("ROUND006_CONTACT_BUILD=" + json.dumps(report, sort_keys=True))


if __name__ == "__main__":
    main()
