"""Deterministic P10 round-002 Astra Vale authoring pipeline.

This script starts from the selected Quaternius CC0 topology/rig scaffold and
substantially authors an original game hero. The source scaffold is never used
as the final look: geometry, proportions, face, stress poses, costume, hair,
weapon, materials, LODs, and delivery exports are all generated here.

Run:
  Blender --background --factory-startup \
    --python Tools/Blender/P10_Round002_AstraValeHero.py -- --stage ingest
  Blender --background --factory-startup \
    --python Tools/Blender/P10_Round002_AstraValeHero.py -- --stage full
"""

from __future__ import annotations

import argparse
import datetime
import hashlib
import math
import random
import shutil
import struct
import sys
import zlib
from pathlib import Path
from typing import Iterable, Sequence

import bmesh
import bpy
from mathutils import Matrix, Quaternion, Vector


SEED = 24007002
EXPECTED_ARCHIVE_SHA256 = (
    "fdbf1804c90dfc1ea03e992bff7da2dfd1a79318e13270a660180f9308455f40"
)
EXPECTED_SOURCE_FBX_SHA256 = (
    "0727e7b236eeea4115531e07aeb2bb7690c1a58155f743bbf54282944fb97ea9"
)
EXPECTED_SOURCE_BODY_VERTICES = 6408
EXPECTED_SOURCE_BODY_POLYGONS = 6442
EXPECTED_DEFORM_BONES = 65
EXPECTED_BODY_COMPONENTS = 1
EXPECTED_BOUNDARY_EDGES = 0
EXPECTED_NON_MANIFOLD_EDGES = 0
EXPECTED_LOOSE_VERTICES = 0

TARGET_HEADS = 7.5
TARGET_HEADS_TOLERANCE = 0.22
SOURCE_NECK_PLANE_Z = 1.48
BODY_VERTICAL_SCALE = 1.08
HEAD_VERTICAL_SCALE = 0.86

SCRIPT_PATH = Path(__file__).resolve()
REPOSITORY_ROOT = SCRIPT_PATH.parents[2]
ROUND_ROOT = REPOSITORY_ROOT / "ArtSource" / "P10" / "Round002"
THIRD_PARTY_ROOT = ROUND_ROOT / "ThirdParty" / "Quaternius"
SOURCE_FBX = THIRD_PARTY_ROOT / "Superhero_Female_FullBody.fbx"
SOURCE_TEXTURE_ROOT = THIRD_PARTY_ROOT / "Textures"
BLEND_PATH = ROUND_ROOT / "P10_Round002_AstraValeHero.blend"
GAME_ROOT = (
    REPOSITORY_ROOT
    / "game"
    / "Assets"
    / "CodexOfWar"
    / "Heroes"
    / "P10"
    / "Round002"
)
MODEL_ROOT = GAME_ROOT / "Models"
TEXTURE_ROOT = GAME_ROOT / "Textures"

REQUIRED_BONES = {
    "root",
    "pelvis",
    "spine_01",
    "spine_02",
    "spine_03",
    "neck_01",
    "Head",
    "clavicle_l",
    "upperarm_l",
    "lowerarm_l",
    "hand_l",
    "clavicle_r",
    "upperarm_r",
    "lowerarm_r",
    "hand_r",
    "thigh_l",
    "calf_l",
    "foot_l",
    "ball_l",
    "thigh_r",
    "calf_r",
    "foot_r",
    "ball_r",
}

MATERIAL_NAMES = (
    "P10R2_Skin",
    "P10R2_Eyes",
    "P10R2_Hair",
    "P10R2_Cloth",
    "P10R2_Leather",
    "P10R2_Metal",
    "P10R2_Glow",
)

TEXTURE_SIZE = 1024
FAMILY_PALETTE = {
    "P10R2_Skin": {
        "base": (166, 91, 64),
        "accent": (212, 132, 96),
        "metallic": 0,
        "roughness": 126,
    },
    "P10R2_Eyes": {
        "base": (32, 39, 43),
        "accent": (38, 176, 182),
        "metallic": 18,
        "roughness": 58,
    },
    "P10R2_Hair": {
        "base": (19, 30, 39),
        "accent": (93, 132, 143),
        "metallic": 15,
        "roughness": 88,
    },
    "P10R2_Cloth": {
        "base": (12, 57, 65),
        "accent": (22, 112, 119),
        "metallic": 0,
        "roughness": 174,
    },
    "P10R2_Leather": {
        "base": (59, 24, 18),
        "accent": (127, 61, 39),
        "metallic": 4,
        "roughness": 151,
    },
    "P10R2_Metal": {
        "base": (38, 49, 56),
        "accent": (82, 94, 101),
        "metallic": 226,
        "roughness": 108,
    },
    "P10R2_Glow": {
        "base": (3, 42, 48),
        "accent": (18, 208, 218),
        "metallic": 31,
        "roughness": 48,
    },
}

NEUTRAL_FBX = MODEL_ROOT / "P10_AstraVale_Round002_Neutral.fbx"
COMBAT_FBX = MODEL_ROOT / "P10_AstraVale_Round002_Combat.fbx"
LOD_FBX = {
    0: MODEL_ROOT / "P10_AstraVale_Round002_Rigged_LOD0.fbx",
    1: MODEL_ROOT / "P10_AstraVale_Round002_Rigged_LOD1.fbx",
    2: MODEL_ROOT / "P10_AstraVale_Round002_Rigged_LOD2.fbx",
}


def parse_args() -> argparse.Namespace:
    values = sys.argv
    values = values[values.index("--") + 1 :] if "--" in values else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--stage", choices=("ingest", "full"), default="full")
    return parser.parse_args(values)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def reset_scene() -> None:
    bpy.ops.object.mode_set(mode="OBJECT") if bpy.context.object and bpy.context.object.mode != "OBJECT" else None
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.armatures,
        bpy.data.materials,
        bpy.data.images,
        bpy.data.cameras,
        bpy.data.lights,
    ):
        for datablock in list(datablocks):
            if datablock.users == 0:
                datablocks.remove(datablock)


def ensure_directories() -> None:
    ROUND_ROOT.mkdir(parents=True, exist_ok=True)
    MODEL_ROOT.mkdir(parents=True, exist_ok=True)
    TEXTURE_ROOT.mkdir(parents=True, exist_ok=True)


def png_chunk(chunk_type: bytes, payload: bytes) -> bytes:
    checksum = zlib.crc32(chunk_type)
    checksum = zlib.crc32(payload, checksum) & 0xFFFFFFFF
    return (
        struct.pack(">I", len(payload))
        + chunk_type
        + payload
        + struct.pack(">I", checksum)
    )


def write_png_rgba(
    path: Path,
    width: int,
    height: int,
    rows: Iterable[bytes],
) -> None:
    raw = bytearray()
    expected_row = width * 4
    row_count = 0
    for row in rows:
        require(
            len(row) == expected_row,
            f"PNG row width mismatch for {path.name}.",
        )
        raw.append(0)
        raw.extend(row)
        row_count += 1
    require(row_count == height, f"PNG row count mismatch for {path.name}.")
    header = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    payload = (
        b"\x89PNG\r\n\x1a\n"
        + png_chunk(b"IHDR", header)
        + png_chunk(b"IDAT", zlib.compress(bytes(raw), level=9))
        + png_chunk(b"IEND", b"")
    )
    path.write_bytes(payload)


def integer_noise(x: int, y: int, salt: int) -> int:
    value = (
        x * 0x1F123BB5
        ^ y * 0x05491333
        ^ salt * 0x9E3779B1
        ^ SEED
    ) & 0xFFFFFFFF
    value ^= value >> 16
    value = (value * 0x7FEB352D) & 0xFFFFFFFF
    value ^= value >> 15
    value = (value * 0x846CA68B) & 0xFFFFFFFF
    value ^= value >> 16
    return value & 0xFF


def blend_channel(a: int, b: int, factor: float) -> int:
    return max(0, min(255, int(round(a + (b - a) * factor))))


def procedural_rows(
    family: str,
    map_kind: str,
    width: int = TEXTURE_SIZE,
    height: int = TEXTURE_SIZE,
) -> Iterable[bytes]:
    palette = FAMILY_PALETTE[family]
    base = palette["base"]
    accent = palette["accent"]
    family_salt = MATERIAL_NAMES.index(family) + 1
    for y in range(height):
        row = bytearray(width * 4)
        v = y / max(1, height - 1)
        for x in range(width):
            u = x / max(1, width - 1)
            noise = integer_noise(x, y, family_salt)
            fine = (noise - 127.5) / 127.5
            if family == "P10R2_Hair":
                pattern = 0.16 + 0.26 * (
                    0.5 + 0.5 * math.sin(x * 0.155 + math.sin(y * 0.021) * 2.5)
                )
                pattern += fine * 0.055
            elif family == "P10R2_Cloth":
                warp = 0.5 + 0.5 * math.sin(x * 0.125)
                weft = 0.5 + 0.5 * math.sin(y * 0.133)
                pattern = 0.13 + warp * weft * 0.18 + fine * 0.025
            elif family == "P10R2_Leather":
                crease = abs(math.sin((x + y * 0.37) * 0.018))
                pattern = 0.12 + crease * 0.12 + fine * 0.045
            elif family == "P10R2_Metal":
                brushed = 0.5 + 0.5 * math.sin(y * 0.29 + x * 0.009)
                broad = 0.5 + 0.5 * math.sin((u + v) * math.pi * 4.0)
                pattern = 0.12 + brushed * 0.035 + broad * 0.025 + fine * 0.010
            elif family == "P10R2_Glow":
                vein = math.exp(-((u - 0.5 - math.sin(v * 18.0) * 0.09) / 0.13) ** 2)
                pattern = 0.10 + vein * 0.82 + fine * 0.018
            else:
                pattern = 0.10 + fine * 0.035
            pattern = max(0.0, min(1.0, pattern))
            offset = x * 4
            if map_kind == "BaseColor":
                for channel in range(3):
                    value = blend_channel(base[channel], accent[channel], pattern)
                    row[offset + channel] = value
                row[offset + 3] = 255
            elif map_kind == "Normal":
                if family == "P10R2_Hair":
                    dx = math.sin(x * 0.155 + y * 0.012) * 18.0
                    dy = math.cos(x * 0.041 + y * 0.083) * 6.0
                elif family == "P10R2_Cloth":
                    dx = math.sin(x * 0.125) * 8.0
                    dy = math.sin(y * 0.133) * 8.0
                elif family == "P10R2_Metal":
                    dx = math.sin(y * 0.29) * 1.5
                    dy = math.sin((x + y) * 0.017) * 0.8
                else:
                    dx = fine * 5.5
                    dy = (
                        (integer_noise(y, x, family_salt + 19) - 127.5)
                        / 127.5
                        * 5.5
                    )
                row[offset + 0] = max(0, min(255, int(round(128 + dx))))
                row[offset + 1] = max(0, min(255, int(round(128 + dy))))
                row[offset + 2] = 255
                row[offset + 3] = 255
            else:
                roughness = int(palette["roughness"])
                roughness += int(round(fine * 14.0))
                if family == "P10R2_Glow":
                    roughness -= int(round(pattern * 18.0))
                row[offset + 0] = int(palette["metallic"])
                row[offset + 1] = max(180, min(255, 234 + int(fine * 12.0)))
                row[offset + 2] = max(
                    0,
                    min(255, int(round(100 + pattern * 120.0))),
                )
                roughness = max(20, min(235, roughness))
                row[offset + 3] = 255 - roughness
        yield bytes(row)


def source_image_rows(
    source_path: Path,
    map_kind: str,
    tint: tuple[int, int, int] | None,
    width: int = TEXTURE_SIZE,
    height: int = TEXTURE_SIZE,
) -> Iterable[bytes]:
    image = bpy.data.images.load(str(source_path), check_existing=False)
    image.colorspace_settings.name = "Non-Color"
    if tuple(image.size) != (width, height):
        image.scale(width, height)
    pixels = list(image.pixels[:])
    for y in range(height):
        row = bytearray(width * 4)
        for x in range(width):
            source_offset = (y * width + x) * 4
            output_offset = x * 4
            source_rgb = [
                max(0, min(255, int(round(pixels[source_offset + channel] * 255))))
                for channel in range(3)
            ]
            if map_kind == "BaseColor":
                source_is_skin_atlas = source_path.name.startswith(
                    "T_Superhero_Female"
                )
                saturation = max(source_rgb) - min(source_rgb)
                brightness = sum(source_rgb) / 3.0
                for channel in range(3):
                    target = tint[channel] if tint else source_rgb[channel]
                    tint_factor = 0.12
                    # The source atlas contains pale superhero-mask bands. They
                    # become a glaring white facial strip after reshaping, so
                    # neutral bright pixels in the skin atlas are reconstructed
                    # into the authored warm skin range while preserving lips,
                    # freckles, eyelids, and other chromatic facial detail.
                    if (
                        source_is_skin_atlas
                        and saturation < 38
                        and brightness > 92
                    ):
                        tint_factor = 0.88
                    row[output_offset + channel] = blend_channel(
                        source_rgb[channel],
                        target,
                        tint_factor,
                    )
                row[output_offset + 3] = 255
            elif map_kind == "Normal":
                row[output_offset + 0] = source_rgb[0]
                row[output_offset + 1] = source_rgb[1]
                row[output_offset + 2] = source_rgb[2]
                row[output_offset + 3] = 255
            else:
                roughness = source_rgb[0]
                row[output_offset + 0] = 0
                row[output_offset + 1] = 238
                row[output_offset + 2] = 128
                row[output_offset + 3] = 255 - roughness
        yield bytes(row)
    bpy.data.images.remove(image)


def write_authored_textures() -> dict[tuple[str, str], Path]:
    outputs: dict[tuple[str, str], Path] = {}
    source_maps = {
        ("P10R2_Skin", "BaseColor"): (
            SOURCE_TEXTURE_ROOT / "T_Superhero_Female_Light_BaseColor.png",
            FAMILY_PALETTE["P10R2_Skin"]["base"],
        ),
        ("P10R2_Skin", "Normal"): (
            SOURCE_TEXTURE_ROOT / "T_Superhero_Female_Normal.png",
            None,
        ),
        ("P10R2_Skin", "Mask"): (
            SOURCE_TEXTURE_ROOT / "T_Superhero_Female_Roughness.png",
            None,
        ),
        ("P10R2_Eyes", "BaseColor"): (
            SOURCE_TEXTURE_ROOT / "T_Eye_Brown.png",
            FAMILY_PALETTE["P10R2_Eyes"]["accent"],
        ),
        ("P10R2_Eyes", "Normal"): (
            SOURCE_TEXTURE_ROOT / "T_Eye_Normal.png",
            None,
        ),
    }
    for family in MATERIAL_NAMES:
        for map_kind in ("BaseColor", "Normal", "Mask"):
            output_path = TEXTURE_ROOT / f"{family}_{map_kind}.png"
            source = source_maps.get((family, map_kind))
            if source:
                source_path, tint = source
                rows = source_image_rows(source_path, map_kind, tint)
            else:
                rows = procedural_rows(family, map_kind)
            write_png_rgba(
                output_path,
                TEXTURE_SIZE,
                TEXTURE_SIZE,
                rows,
            )
            outputs[(family, map_kind)] = output_path
            print(
                "P10R2_TEXTURE "
                f"path={output_path.relative_to(REPOSITORY_ROOT)} "
                f"sha256={sha256(output_path)}"
            )
    return outputs


def build_materials(
    texture_paths: dict[tuple[str, str], Path],
) -> dict[str, bpy.types.Material]:
    materials: dict[str, bpy.types.Material] = {}
    for family in MATERIAL_NAMES:
        existing = bpy.data.materials.get(family)
        if existing:
            bpy.data.materials.remove(existing)
        material = bpy.data.materials.new(family)
        material.use_nodes = True
        material.diffuse_color = (
            FAMILY_PALETTE[family]["base"][0] / 255.0,
            FAMILY_PALETTE[family]["base"][1] / 255.0,
            FAMILY_PALETTE[family]["base"][2] / 255.0,
            1.0,
        )
        node_tree = material.node_tree
        node_tree.nodes.clear()
        output = node_tree.nodes.new("ShaderNodeOutputMaterial")
        principled = node_tree.nodes.new("ShaderNodeBsdfPrincipled")
        principled.inputs["Metallic"].default_value = (
            FAMILY_PALETTE[family]["metallic"] / 255.0
        )
        principled.inputs["Roughness"].default_value = (
            FAMILY_PALETTE[family]["roughness"] / 255.0
        )
        if family == "P10R2_Glow":
            principled.inputs["Emission Color"].default_value = (
                0.02,
                2.4,
                2.7,
                1.0,
            )
            principled.inputs["Emission Strength"].default_value = 1.0
        base_texture = node_tree.nodes.new("ShaderNodeTexImage")
        base_texture.name = f"{family}_BaseColor"
        base_texture.image = bpy.data.images.load(
            str(texture_paths[(family, "BaseColor")]),
            check_existing=True,
        )
        base_texture.image.colorspace_settings.name = "sRGB"
        normal_texture = node_tree.nodes.new("ShaderNodeTexImage")
        normal_texture.name = f"{family}_Normal"
        normal_texture.image = bpy.data.images.load(
            str(texture_paths[(family, "Normal")]),
            check_existing=True,
        )
        normal_texture.image.colorspace_settings.name = "Non-Color"
        normal_map = node_tree.nodes.new("ShaderNodeNormalMap")
        normal_map.inputs["Strength"].default_value = {
            "P10R2_Skin": 0.85,
            "P10R2_Eyes": 0.85,
            "P10R2_Metal": 0.28,
        }.get(family, 0.65)
        mask_texture = node_tree.nodes.new("ShaderNodeTexImage")
        mask_texture.name = f"{family}_Mask"
        mask_texture.image = bpy.data.images.load(
            str(texture_paths[(family, "Mask")]),
            check_existing=True,
        )
        mask_texture.image.colorspace_settings.name = "Non-Color"
        separate = node_tree.nodes.new("ShaderNodeSeparateColor")
        invert_smoothness = node_tree.nodes.new("ShaderNodeMath")
        invert_smoothness.operation = "SUBTRACT"
        invert_smoothness.inputs[0].default_value = 1.0
        node_tree.links.new(base_texture.outputs["Color"], principled.inputs["Base Color"])
        node_tree.links.new(normal_texture.outputs["Color"], normal_map.inputs["Color"])
        node_tree.links.new(normal_map.outputs["Normal"], principled.inputs["Normal"])
        node_tree.links.new(mask_texture.outputs["Color"], separate.inputs["Color"])
        node_tree.links.new(separate.outputs["Red"], principled.inputs["Metallic"])
        node_tree.links.new(
            mask_texture.outputs["Alpha"],
            invert_smoothness.inputs[1],
        )
        node_tree.links.new(
            invert_smoothness.outputs[0],
            principled.inputs["Roughness"],
        )
        node_tree.links.new(principled.outputs["BSDF"], output.inputs["Surface"])
        materials[family] = material
    return materials


def verify_ingested_hashes() -> None:
    require(SOURCE_FBX.is_file(), f"Missing selected CC0 source: {SOURCE_FBX}")
    actual = sha256(SOURCE_FBX)
    require(
        actual == EXPECTED_SOURCE_FBX_SHA256,
        f"Selected source FBX hash drifted: {actual}",
    )
    required_sources = {
        "T_Superhero_Female_Light_BaseColor.png":
            "743f811857db0b950f3ad09a0733dfa4888801ead332313ca25becea14c54f8d",
        "T_Superhero_Female_Normal.png":
            "cf922460b43ccd31e983e34db05514c9d451dd2f9cdd01a843978e797719f859",
        "T_Superhero_Female_Roughness.png":
            "4e00eb2d8196cebacd027e3360b9da6431d8915e27e1b5262c14f20eaaa6dced",
        "T_Eye_Brown.png":
            "d08e3356a83211bc6ca21fe3a8e39f4b5c1a3b8f85457fc2c0fb57be09935025",
        "T_Eye_Normal.png":
            "9ed61f7726a54fe346a78b9e5a18905d8e2b88f86235d97f53cd207a26f3f8c7",
    }
    for filename, expected in required_sources.items():
        path = SOURCE_TEXTURE_ROOT / filename
        require(path.is_file(), f"Missing selected CC0 texture: {path}")
        actual = sha256(path)
        require(actual == expected, f"Selected source texture hash drifted: {path}")


def import_scaffold() -> tuple[bpy.types.Object, bpy.types.Object, bpy.types.Object, bpy.types.Object]:
    bpy.ops.import_scene.fbx(
        filepath=str(SOURCE_FBX),
        use_anim=False,
        ignore_leaf_bones=False,
        automatic_bone_orientation=False,
    )
    body = bpy.data.objects.get("Superhero_Female")
    eyes = bpy.data.objects.get("Eyes")
    eyebrows = bpy.data.objects.get("Eyebrows")
    armature = next(
        (item for item in bpy.context.scene.objects if item.type == "ARMATURE"),
        None,
    )
    require(body is not None and body.type == "MESH", "Source body mesh missing.")
    require(eyes is not None and eyes.type == "MESH", "Source eye mesh missing.")
    require(
        eyebrows is not None and eyebrows.type == "MESH",
        "Source eyebrow mesh missing.",
    )
    require(armature is not None, "Source humanoid armature missing.")

    for item in list(bpy.context.scene.objects):
        if item not in {body, eyes, eyebrows, armature}:
            bpy.data.objects.remove(item, do_unlink=True)
    require(bpy.data.objects.get("Cube") is None, "Imported default Cube leaked.")

    body.name = "P10R2_AnatomyShell"
    body.data.name = "P10R2_AnatomyShell_Mesh"
    eyes.name = "P10R2_Eyes"
    eyebrows.name = "P10R2_Eyebrows"
    armature.name = "P10R2_AstraRig"
    armature.data.name = "P10R2_AstraRig_Data"
    return body, eyes, eyebrows, armature


def topology_metrics(mesh: bpy.types.Mesh) -> dict[str, int]:
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bm.verts.ensure_lookup_table()
    bm.edges.ensure_lookup_table()
    bm.faces.ensure_lookup_table()

    loose = sum(1 for vertex in bm.verts if not vertex.link_edges)
    boundary = sum(1 for edge in bm.edges if len(edge.link_faces) == 1)
    non_manifold = sum(1 for edge in bm.edges if not edge.is_manifold)

    remaining = set(bm.verts)
    components = 0
    while remaining:
        components += 1
        seed = remaining.pop()
        stack = [seed]
        while stack:
            vertex = stack.pop()
            for edge in vertex.link_edges:
                other = edge.other_vert(vertex)
                if other in remaining:
                    remaining.remove(other)
                    stack.append(other)
    bm.free()
    return {
        "components": components,
        "boundary_edges": boundary,
        "non_manifold_edges": non_manifold,
        "loose_vertices": loose,
    }


def verify_scaffold(
    body: bpy.types.Object,
    armature: bpy.types.Object,
) -> None:
    require(
        len(body.data.vertices) == EXPECTED_SOURCE_BODY_VERTICES,
        f"Unexpected source body vertices: {len(body.data.vertices)}",
    )
    require(
        len(body.data.polygons) == EXPECTED_SOURCE_BODY_POLYGONS,
        f"Unexpected source body polygons: {len(body.data.polygons)}",
    )
    metrics = topology_metrics(body.data)
    expected = {
        "components": EXPECTED_BODY_COMPONENTS,
        "boundary_edges": EXPECTED_BOUNDARY_EDGES,
        "non_manifold_edges": EXPECTED_NON_MANIFOLD_EDGES,
        "loose_vertices": EXPECTED_LOOSE_VERTICES,
    }
    require(metrics == expected, f"Source topology premise failed: {metrics}")

    deform_bones = [bone for bone in armature.data.bones if bone.use_deform]
    require(
        len(deform_bones) == EXPECTED_DEFORM_BONES,
        f"Expected 65 deform bones, found {len(deform_bones)}.",
    )
    missing = sorted(REQUIRED_BONES - {bone.name for bone in deform_bones})
    require(not missing, f"Humanoid source bones missing: {missing}")
    maximum_source_influences = max(
        (len(vertex.groups) for vertex in body.data.vertices),
        default=0,
    )
    print(
        "P10R2_INGEST_ASSERTIONS "
        f"verts={len(body.data.vertices)} "
        f"polys={len(body.data.polygons)} "
        f"components={metrics['components']} "
        f"boundary={metrics['boundary_edges']} "
        f"nonManifold={metrics['non_manifold_edges']} "
        f"loose={metrics['loose_vertices']} "
        f"deformBones={len(deform_bones)} "
        f"sourceMaxInfluences={maximum_source_influences}"
    )


def prune_weights_to_four(mesh_object: bpy.types.Object) -> None:
    """Keep the four strongest deform weights and normalize every vertex."""
    for vertex in mesh_object.data.vertices:
        memberships = [
            (membership.group, membership.weight)
            for membership in vertex.groups
        ]
        weighted = sorted(
            ((group, weight) for group, weight in memberships if weight > 0.0),
            key=lambda item: (-item[1], item[0]),
        )
        require(weighted, f"Vertex {vertex.index} has no source skin weights.")
        kept = weighted[:4]
        total = sum(weight for _, weight in kept)
        require(total > 1.0e-8, f"Vertex {vertex.index} has zero skin weight.")
        for group_index, _ in memberships:
            mesh_object.vertex_groups[group_index].remove([vertex.index])
        for group_index, weight in kept:
            mesh_object.vertex_groups[group_index].add(
                [vertex.index],
                weight / total,
                "REPLACE",
            )
    maximum = max(
        (len(vertex.groups) for vertex in mesh_object.data.vertices),
        default=0,
    )
    require(maximum <= 4, f"Weight pruning failed: {maximum} influences.")
    print(f"P10R2_WEIGHT_GATE maxInfluences={maximum}")


def remap_z(value: float) -> float:
    if value <= SOURCE_NECK_PLANE_Z:
        return value * BODY_VERTICAL_SCALE
    neck = SOURCE_NECK_PLANE_Z * BODY_VERTICAL_SCALE
    return neck + (value - SOURCE_NECK_PLANE_Z) * HEAD_VERTICAL_SCALE


def smooth_window(value: float, minimum: float, maximum: float) -> float:
    if value <= minimum or value >= maximum:
        return 0.0
    center = (minimum + maximum) * 0.5
    radius = (maximum - minimum) * 0.5
    return 0.5 + 0.5 * math.cos(math.pi * (value - center) / radius)


def centered_falloff(value: float, radius: float, power: float = 2.0) -> float:
    normalized = max(0.0, 1.0 - abs(value) / max(radius, 1.0e-6))
    return normalized**power


def reshape_body(body: bpy.types.Object) -> None:
    """Change proportions and facial/limb planes without breaking topology."""
    for vertex in body.data.vertices:
        point = vertex.co.copy()
        original = point.copy()

        # Adult 7.5-head proportion and a narrower authored cranium.
        if original.z > SOURCE_NECK_PLANE_Z:
            point.x *= 0.985
        point.z = remap_z(original.z)

        # Ribcage-to-waist-to-pelvis rhythm, preserving limbs.
        if abs(original.x) < 0.24:
            chest = smooth_window(original.z, 1.16, 1.47)
            waist = smooth_window(original.z, 0.98, 1.22)
            pelvis = smooth_window(original.z, 0.78, 1.02)
            point.x *= 1.0 + chest * 0.025 - waist * 0.045 + pelvis * 0.025

        # Non-stock facial structure. Forward is negative Y in the source.
        if original.z > 1.50 and original.y < -0.045:
            nose = centered_falloff(original.x, 0.037, 2.0) * smooth_window(
                original.z,
                1.585,
                1.665,
            )
            bridge = centered_falloff(original.x, 0.052, 2.2) * smooth_window(
                original.z,
                1.625,
                1.715,
            )
            cheek = (
                smooth_window(abs(original.x), 0.028, 0.086)
                * smooth_window(original.z, 1.565, 1.66)
            )
            brow = (
                smooth_window(abs(original.x), 0.018, 0.080)
                * smooth_window(original.z, 1.665, 1.715)
            )
            lips = centered_falloff(original.x, 0.056, 1.7) * smooth_window(
                original.z,
                1.550,
                1.610,
            )
            eye_socket = (
                smooth_window(abs(original.x), 0.012, 0.085)
                * smooth_window(original.z, 1.655, 1.715)
            )
            point.y -= (
                nose * 0.023
                + bridge * 0.007
                + cheek * 0.005
                + brow * 0.004
                + lips * 0.006
            )
            point.y += eye_socket * 0.0025

            # Defined jaw angle and chin rather than a flat anime mask.
            if original.z < 1.60:
                jaw_factor = max(0.0, min(1.0, (1.60 - original.z) / 0.11))
                point.x *= 1.0 - jaw_factor * 0.055
                if abs(original.x) < 0.035:
                    point.y -= jaw_factor * 0.006

        # Larger hand wedges and finger length for the close grip proof.
        for wrist_x in (-0.641, 0.641):
            if abs(original.x - wrist_x) < 0.18 and original.z > 1.32:
                anchor = Vector((wrist_x, 0.052, 1.418))
                delta = original - anchor
                point.x = anchor.x + delta.x * 1.055
                point.y = anchor.y + delta.y * 1.035
                point.z = remap_z(anchor.z + delta.z * 1.04)

        # Heel/instep/toe volume and a slightly longer adult foot.
        if original.z < 0.17:
            toe_anchor_y = 0.055
            point.y = toe_anchor_y + (original.y - toe_anchor_y) * 1.06
            if original.z < 0.07 and original.y < 0.02:
                point.z += smooth_window(original.y, -0.15, 0.04) * 0.006

        vertex.co = point
    body.data.update()


def reshape_auxiliary(
    objects: Iterable[bpy.types.Object],
) -> None:
    for item in objects:
        for vertex in item.data.vertices:
            original = vertex.co.copy()
            point = original.copy()
            point.z = remap_z(original.z)
            if original.z > SOURCE_NECK_PLANE_Z:
                point.x *= 0.985
            vertex.co = point
        item.data.update()


def reshape_armature(armature: bpy.types.Object) -> None:
    bpy.context.view_layer.objects.active = armature
    armature.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    for bone in armature.data.edit_bones:
        head = bone.head.copy()
        tail = bone.tail.copy()
        head.z = remap_z(head.z)
        tail.z = remap_z(tail.z)
        if head.z > remap_z(SOURCE_NECK_PLANE_Z):
            head.x *= 0.985
        if tail.z > remap_z(SOURCE_NECK_PLANE_Z):
            tail.x *= 0.985
        bone.head = head
        bone.tail = tail
    bpy.ops.object.mode_set(mode="OBJECT")
    armature.select_set(False)


def smooth_mesh(mesh_object: bpy.types.Object) -> bpy.types.Object:
    for polygon in mesh_object.data.polygons:
        polygon.use_smooth = True
    return mesh_object


def assign_projected_uv(mesh_object: bpy.types.Object) -> None:
    mesh = mesh_object.data
    if mesh.uv_layers:
        uv_layer = mesh.uv_layers.active
    else:
        uv_layer = mesh.uv_layers.new(name="P10R2_UV0")
    coordinates = [vertex.co for vertex in mesh.vertices]
    min_x = min((point.x for point in coordinates), default=0.0)
    max_x = max((point.x for point in coordinates), default=1.0)
    min_z = min((point.z for point in coordinates), default=0.0)
    max_z = max((point.z for point in coordinates), default=1.0)
    span_x = max(1.0e-5, max_x - min_x)
    span_z = max(1.0e-5, max_z - min_z)
    for loop in mesh.loops:
        point = mesh.vertices[loop.vertex_index].co
        uv_layer.data[loop.index].uv = (
            (point.x - min_x) / span_x,
            (point.z - min_z) / span_z,
        )


def bind_rigid(
    mesh_object: bpy.types.Object,
    armature: bpy.types.Object,
    bone_name: str,
) -> None:
    group = mesh_object.vertex_groups.get(bone_name)
    if group is None:
        group = mesh_object.vertex_groups.new(name=bone_name)
    group.add(
        [vertex.index for vertex in mesh_object.data.vertices],
        1.0,
        "REPLACE",
    )
    modifier = mesh_object.modifiers.new("P10R2_Rig", "ARMATURE")
    modifier.object = armature
    mesh_object.parent = armature


def make_mesh_object(
    name: str,
    vertices: Sequence[Sequence[float]],
    faces: Sequence[Sequence[int]],
    material: bpy.types.Material,
    armature: bpy.types.Object,
    bone_name: str,
    smooth: bool = True,
) -> bpy.types.Object:
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.validate(verbose=False)
    mesh.update()
    mesh_object = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(mesh_object)
    mesh.materials.append(material)
    assign_projected_uv(mesh_object)
    if smooth:
        smooth_mesh(mesh_object)
    bind_rigid(mesh_object, armature, bone_name)
    return mesh_object


def apply_modifier(
    mesh_object: bpy.types.Object,
    modifier: bpy.types.Modifier,
) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    mesh_object.select_set(True)
    bpy.context.view_layer.objects.active = mesh_object
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    mesh_object.select_set(False)


def bevel_geometry(
    mesh_object: bpy.types.Object,
    width: float,
    segments: int = 2,
) -> None:
    modifier = mesh_object.modifiers.new("P10R2_AuthoredBevel", "BEVEL")
    modifier.width = width
    modifier.segments = segments
    modifier.limit_method = "ANGLE"
    modifier.angle_limit = math.radians(24.0)
    # Apply before the armature so the new vertices inherit rigid weights.
    while mesh_object.modifiers.find(modifier.name) > 0:
        mesh_object.modifiers.move(
            mesh_object.modifiers.find(modifier.name),
            mesh_object.modifiers.find(modifier.name) - 1,
        )
    apply_modifier(mesh_object, modifier)


def plate_prism(
    name: str,
    outline_xz: Sequence[tuple[float, float]],
    center_y: float,
    thickness: float,
    material: bpy.types.Material,
    armature: bpy.types.Object,
    bone_name: str,
    bevel_width: float = 0.008,
) -> bpy.types.Object:
    require(len(outline_xz) >= 3, f"Plate {name} needs at least three points.")
    front_y = center_y - thickness * 0.5
    back_y = center_y + thickness * 0.5
    vertices = [(x, front_y, z) for x, z in outline_xz]
    vertices.extend((x, back_y, z) for x, z in outline_xz)
    count = len(outline_xz)
    faces: list[tuple[int, ...]] = [
        tuple(range(count - 1, -1, -1)),
        tuple(range(count, count * 2)),
    ]
    for index in range(count):
        following = (index + 1) % count
        faces.append(
            (
                index,
                following,
                count + following,
                count + index,
            )
        )
    result = make_mesh_object(
        name,
        vertices,
        faces,
        material,
        armature,
        bone_name,
        smooth=False,
    )
    if bevel_width > 0.0:
        bevel_geometry(result, bevel_width, 3)
    smooth_mesh(result)
    return result


def ring_shell(
    name: str,
    rings: Sequence[tuple[float, float, float, float, float]],
    thickness: float,
    segments: int,
    material: bpy.types.Material,
    armature: bpy.types.Object,
    bone_name: str,
) -> bpy.types.Object:
    """Create a closed, genuinely thick elliptical garment shell.

    Ring tuple: (z, center_x, center_y, radius_x, radius_y).
    """
    require(len(rings) >= 2, f"Ring shell {name} needs multiple rings.")
    require(segments >= 8, f"Ring shell {name} is under-resolved.")
    vertices: list[tuple[float, float, float]] = []
    for inner in (False, True):
        for z, center_x, center_y, radius_x, radius_y in rings:
            shrink = thickness if inner else 0.0
            inner_rx = max(0.002, radius_x - shrink)
            inner_ry = max(0.002, radius_y - shrink)
            for segment in range(segments):
                angle = math.tau * segment / segments
                vertices.append(
                    (
                        center_x + math.cos(angle) * inner_rx,
                        center_y + math.sin(angle) * inner_ry,
                        z,
                    )
                )
    ring_count = len(rings)
    outer_offset = 0
    inner_offset = ring_count * segments
    faces: list[tuple[int, int, int, int]] = []
    for ring_index in range(ring_count - 1):
        for segment in range(segments):
            following = (segment + 1) % segments
            a = outer_offset + ring_index * segments + segment
            b = outer_offset + ring_index * segments + following
            c = outer_offset + (ring_index + 1) * segments + following
            d = outer_offset + (ring_index + 1) * segments + segment
            faces.append((a, b, c, d))
            ia = inner_offset + ring_index * segments + segment
            ib = inner_offset + (ring_index + 1) * segments + segment
            ic = inner_offset + (ring_index + 1) * segments + following
            id_ = inner_offset + ring_index * segments + following
            faces.append((ia, ib, ic, id_))
    for ring_index in (0, ring_count - 1):
        for segment in range(segments):
            following = (segment + 1) % segments
            outer_a = outer_offset + ring_index * segments + segment
            outer_b = outer_offset + ring_index * segments + following
            inner_b = inner_offset + ring_index * segments + following
            inner_a = inner_offset + ring_index * segments + segment
            if ring_index == 0:
                faces.append((outer_a, inner_a, inner_b, outer_b))
            else:
                faces.append((outer_a, outer_b, inner_b, inner_a))
    return make_mesh_object(
        name,
        vertices,
        faces,
        material,
        armature,
        bone_name,
    )


def path_frames(
    points: Sequence[Vector],
) -> list[tuple[Vector, Vector]]:
    frames: list[tuple[Vector, Vector]] = []
    previous_u: Vector | None = None
    for index, point in enumerate(points):
        if index == 0:
            tangent = (points[1] - point).normalized()
        elif index == len(points) - 1:
            tangent = (point - points[index - 1]).normalized()
        else:
            tangent = (points[index + 1] - points[index - 1]).normalized()
        reference = Vector((0.0, 0.0, 1.0))
        if abs(tangent.dot(reference)) > 0.92:
            reference = Vector((0.0, 1.0, 0.0))
        u = tangent.cross(reference).normalized()
        if previous_u is not None and u.dot(previous_u) < 0.0:
            u.negate()
        v = tangent.cross(u).normalized()
        frames.append((u, v))
        previous_u = u
    return frames


def solid_tube(
    name: str,
    path: Sequence[Sequence[float]],
    radii: Sequence[tuple[float, float]],
    segments: int,
    material: bpy.types.Material,
    armature: bpy.types.Object,
    bone_name: str,
) -> bpy.types.Object:
    require(len(path) == len(radii), f"Tube {name} radius count mismatch.")
    require(len(path) >= 2, f"Tube {name} needs at least two path points.")
    points = [Vector(point) for point in path]
    frames = path_frames(points)
    vertices: list[tuple[float, float, float]] = []
    for point, frame, radius in zip(points, frames, radii):
        u_axis, v_axis = frame
        radius_u, radius_v = radius
        for segment in range(segments):
            angle = math.tau * segment / segments
            vertex = (
                point
                + u_axis * (math.cos(angle) * radius_u)
                + v_axis * (math.sin(angle) * radius_v)
            )
            vertices.append(tuple(vertex))
    faces: list[tuple[int, ...]] = []
    for ring_index in range(len(points) - 1):
        for segment in range(segments):
            following = (segment + 1) % segments
            faces.append(
                (
                    ring_index * segments + segment,
                    ring_index * segments + following,
                    (ring_index + 1) * segments + following,
                    (ring_index + 1) * segments + segment,
                )
            )
    faces.append(tuple(range(segments - 1, -1, -1)))
    last_start = (len(points) - 1) * segments
    faces.append(tuple(last_start + index for index in range(segments)))
    return make_mesh_object(
        name,
        vertices,
        faces,
        material,
        armature,
        bone_name,
    )


def axis_shell(
    name: str,
    path: Sequence[Sequence[float]],
    radii: Sequence[tuple[float, float]],
    thickness: float,
    segments: int,
    material: bpy.types.Material,
    armature: bpy.types.Object,
    bone_name: str,
) -> bpy.types.Object:
    require(len(path) == len(radii), f"Axis shell {name} radius mismatch.")
    points = [Vector(point) for point in path]
    frames = path_frames(points)
    vertices: list[tuple[float, float, float]] = []
    for inner in (False, True):
        for point, frame, radius in zip(points, frames, radii):
            u_axis, v_axis = frame
            radius_u = max(0.002, radius[0] - (thickness if inner else 0.0))
            radius_v = max(0.002, radius[1] - (thickness if inner else 0.0))
            for segment in range(segments):
                angle = math.tau * segment / segments
                vertex = (
                    point
                    + u_axis * (math.cos(angle) * radius_u)
                    + v_axis * (math.sin(angle) * radius_v)
                )
                vertices.append(tuple(vertex))
    ring_count = len(points)
    inner_offset = ring_count * segments
    faces: list[tuple[int, int, int, int]] = []
    for ring_index in range(ring_count - 1):
        for segment in range(segments):
            following = (segment + 1) % segments
            outer = ring_index * segments + segment
            outer_next = ring_index * segments + following
            outer_upper = (ring_index + 1) * segments + segment
            outer_upper_next = (ring_index + 1) * segments + following
            faces.append((outer, outer_next, outer_upper_next, outer_upper))
            inner = inner_offset + ring_index * segments + segment
            inner_next = inner_offset + ring_index * segments + following
            inner_upper = inner_offset + (ring_index + 1) * segments + segment
            inner_upper_next = (
                inner_offset + (ring_index + 1) * segments + following
            )
            faces.append((inner, inner_upper, inner_upper_next, inner_next))
    for ring_index in (0, ring_count - 1):
        for segment in range(segments):
            following = (segment + 1) % segments
            outer = ring_index * segments + segment
            outer_next = ring_index * segments + following
            inner = inner_offset + ring_index * segments + segment
            inner_next = inner_offset + ring_index * segments + following
            faces.append((outer, inner, inner_next, outer_next))
    return make_mesh_object(
        name,
        vertices,
        faces,
        material,
        armature,
        bone_name,
    )


def hair_cap(
    material: bpy.types.Material,
    armature: bpy.types.Object,
) -> bpy.types.Object:
    center = Vector((0.0, 0.005, 1.747))
    radius = Vector((0.116, 0.111, 0.126))
    theta_steps = 12
    phi_steps = 24
    theta_max = math.radians(132.0)
    phi_start = math.radians(-35.0)
    phi_end = math.radians(218.0)
    thickness = 0.009
    vertices: list[tuple[float, float, float]] = []
    for inner in (False, True):
        scale = 1.0 - (thickness / max(radius)) if inner else 1.0
        for theta_index in range(theta_steps + 1):
            theta = theta_max * theta_index / theta_steps
            for phi_index in range(phi_steps + 1):
                phi = phi_start + (phi_end - phi_start) * phi_index / phi_steps
                vertex = Vector(
                    (
                        radius.x * math.sin(theta) * math.cos(phi),
                        radius.y * math.sin(theta) * math.sin(phi),
                        radius.z * math.cos(theta),
                    )
                )
                vertices.append(tuple(center + vertex * scale))
    layer_stride = (theta_steps + 1) * (phi_steps + 1)
    row_stride = phi_steps + 1
    faces: list[tuple[int, int, int, int]] = []
    for inner in (False, True):
        offset = layer_stride if inner else 0
        for theta_index in range(theta_steps):
            for phi_index in range(phi_steps):
                a = offset + theta_index * row_stride + phi_index
                b = a + 1
                c = a + row_stride + 1
                d = a + row_stride
                faces.append((a, d, c, b) if inner else (a, b, c, d))
    for theta_index in range(theta_steps):
        for phi_index in (0, phi_steps):
            outer_a = theta_index * row_stride + phi_index
            outer_b = (theta_index + 1) * row_stride + phi_index
            inner_a = layer_stride + outer_a
            inner_b = layer_stride + outer_b
            faces.append((outer_a, inner_a, inner_b, outer_b))
    for phi_index in range(phi_steps):
        outer_a = theta_steps * row_stride + phi_index
        outer_b = outer_a + 1
        inner_a = layer_stride + outer_a
        inner_b = layer_stride + outer_b
        faces.append((outer_a, outer_b, inner_b, inner_a))
    return make_mesh_object(
        "P10R2_Hair_CrownShell",
        vertices,
        faces,
        material,
        armature,
        "Head",
    )


def configure_scaffold_materials(
    body: bpy.types.Object,
    eyes: bpy.types.Object,
    eyebrows: bpy.types.Object,
    materials: dict[str, bpy.types.Material],
) -> None:
    body.data.materials.clear()
    body.data.materials.append(materials["P10R2_Skin"])
    body.data.materials.append(materials["P10R2_Cloth"])
    body.data.materials.append(materials["P10R2_Leather"])
    for polygon in body.data.polygons:
        center = polygon.center
        if center.z >= 1.598:
            polygon.material_index = 0
        elif abs(center.x) >= 0.60 and center.z >= 1.42:
            # Exposed five-finger hands stay readable in the S06 proof.
            polygon.material_index = 0
        elif center.z <= 0.20:
            polygon.material_index = 2
        else:
            polygon.material_index = 1
        polygon.use_smooth = True
    eyes.data.materials.clear()
    eyes.data.materials.append(materials["P10R2_Eyes"])
    for polygon in eyes.data.polygons:
        polygon.material_index = 0
        polygon.use_smooth = True
    eyebrows.data.materials.clear()
    eyebrows.data.materials.append(materials["P10R2_Hair"])
    for polygon in eyebrows.data.polygons:
        polygon.material_index = 0
        polygon.use_smooth = True


def create_face_authorship(
    materials: dict[str, bpy.types.Material],
    armature: bpy.types.Object,
) -> list[bpy.types.Object]:
    pieces: list[bpy.types.Object] = []
    skin = materials["P10R2_Skin"]
    hair = materials["P10R2_Hair"]
    metal = materials["P10R2_Metal"]
    # Upper and lower lid rims frame the source eyeballs without masking the
    # existing facial topology.
    for sign, side in ((-1.0, "R"), (1.0, "L")):
        center_x = 0.026 * sign
        pieces.append(
            solid_tube(
                f"P10R2_EyelidUpper_{side}",
                (
                    (center_x - 0.022, -0.0875, 1.751),
                    (center_x, -0.0925, 1.758),
                    (center_x + 0.022, -0.0875, 1.751),
                ),
                ((0.0024, 0.0020), (0.0030, 0.0022), (0.0020, 0.0018)),
                8,
                skin,
                armature,
                "Head",
            )
        )
        pieces.append(
            solid_tube(
                f"P10R2_EyelidLower_{side}",
                (
                    (center_x - 0.020, -0.0865, 1.749),
                    (center_x, -0.0890, 1.744),
                    (center_x + 0.020, -0.0865, 1.749),
                ),
                ((0.0016, 0.0014), (0.0020, 0.0015), (0.0014, 0.0013)),
                8,
                skin,
                armature,
                "Head",
            )
        )
        # Asymmetric ear jewelry confirms the ears are modeled anatomy, not a
        # painted head mask.
        if sign > 0.0:
            pieces.append(
                solid_tube(
                    "P10R2_EarCuff_Left",
                    (
                        (0.101, -0.002, 1.710),
                        (0.107, 0.004, 1.697),
                        (0.103, 0.008, 1.683),
                    ),
                    ((0.0038, 0.0033), (0.0042, 0.0036), (0.0032, 0.0028)),
                    10,
                    metal,
                    armature,
                    "Head",
                )
            )
        # A shaped brow under-plane creates a facial plane in profile.
        pieces.append(
            solid_tube(
                f"P10R2_BrowPlane_{side}",
                (
                    (center_x - 0.025, -0.090, 1.775),
                    (center_x, -0.096, 1.781),
                    (center_x + 0.026, -0.088, 1.776),
                ),
                ((0.0028, 0.0021), (0.0037, 0.0024), (0.0020, 0.0018)),
                8,
                hair,
                armature,
                "Head",
            )
        )
    return pieces


def create_hair(
    materials: dict[str, bpy.types.Material],
    armature: bpy.types.Object,
) -> list[bpy.types.Object]:
    hair = materials["P10R2_Hair"]
    metal = materials["P10R2_Metal"]
    pieces: list[bpy.types.Object] = [hair_cap(hair, armature)]

    # Thick, tapered front locks overlap the cap and create an authored
    # asymmetrical hairline instead of flat alpha cards.
    fringe_paths = [
        ((-0.079, -0.060, 1.827), (-0.071, -0.090, 1.793), (-0.062, -0.097, 1.746)),
        ((-0.048, -0.087, 1.842), (-0.042, -0.106, 1.807), (-0.032, -0.104, 1.765)),
        ((-0.016, -0.101, 1.849), (-0.011, -0.117, 1.810), (0.003, -0.106, 1.775)),
        ((0.019, -0.100, 1.847), (0.027, -0.111, 1.815), (0.042, -0.099, 1.782)),
        ((0.050, -0.085, 1.836), (0.065, -0.095, 1.800), (0.079, -0.078, 1.762)),
    ]
    for index, path in enumerate(fringe_paths):
        pieces.append(
            solid_tube(
                f"P10R2_Hair_Fringe_{index:02d}",
                path,
                ((0.018, 0.011), (0.014, 0.009), (0.0035, 0.0025)),
                10,
                hair,
                armature,
                "Head",
            )
        )

    crown_roots = [
        (-0.085, 0.055, 1.829),
        (-0.052, 0.092, 1.837),
        (-0.016, 0.108, 1.842),
        (0.021, 0.109, 1.838),
        (0.055, 0.092, 1.827),
        (0.084, 0.058, 1.807),
    ]
    for index, root in enumerate(crown_roots):
        side_bias = (index - 2.5) * 0.012
        path = (
            root,
            (root[0] + side_bias * 0.35, 0.125, 1.764),
            (root[0] + side_bias, 0.130, 1.690),
            (root[0] + side_bias * 1.35, 0.112, 1.622),
        )
        pieces.append(
            solid_tube(
                f"P10R2_Hair_NapeLock_{index:02d}",
                path,
                ((0.024, 0.017), (0.027, 0.019), (0.019, 0.014), (0.004, 0.003)),
                10,
                hair,
                armature,
                "Head",
            )
        )

    # Offset clasp and layered side-tail deliberately break the centerline.
    pieces.append(
        axis_shell(
            "P10R2_Hair_TailClasp",
            ((-0.073, 0.114, 1.750), (-0.094, 0.143, 1.719)),
            ((0.032, 0.030), (0.029, 0.027)),
            0.009,
            14,
            metal,
            armature,
            "Head",
        )
    )
    tail_paths = [
        (
            (-0.087, 0.132, 1.725),
            (-0.145, 0.169, 1.646),
            (-0.205, 0.185, 1.535),
            (-0.236, 0.170, 1.403),
            (-0.214, 0.150, 1.285),
        ),
        (
            (-0.070, 0.142, 1.718),
            (-0.113, 0.188, 1.627),
            (-0.151, 0.205, 1.515),
            (-0.163, 0.187, 1.386),
            (-0.140, 0.163, 1.273),
        ),
        (
            (-0.100, 0.128, 1.714),
            (-0.171, 0.152, 1.633),
            (-0.239, 0.158, 1.529),
            (-0.275, 0.142, 1.414),
            (-0.269, 0.121, 1.317),
        ),
        (
            (-0.055, 0.145, 1.710),
            (-0.083, 0.199, 1.624),
            (-0.104, 0.219, 1.520),
            (-0.097, 0.207, 1.414),
            (-0.073, 0.184, 1.327),
        ),
    ]
    for index, path in enumerate(tail_paths):
        pieces.append(
            solid_tube(
                f"P10R2_Hair_SideTail_{index:02d}",
                path,
                (
                    (0.029, 0.021),
                    (0.033, 0.023),
                    (0.029, 0.020),
                    (0.020, 0.014),
                    (0.004, 0.003),
                ),
                12,
                hair,
                armature,
                "Head",
            )
        )
    return pieces


def create_costume(
    materials: dict[str, bpy.types.Material],
    armature: bpy.types.Object,
) -> list[bpy.types.Object]:
    cloth = materials["P10R2_Cloth"]
    leather = materials["P10R2_Leather"]
    metal = materials["P10R2_Metal"]
    glow = materials["P10R2_Glow"]
    pieces: list[bpy.types.Object] = []

    pieces.append(
        ring_shell(
            "P10R2_Tunic_ThickShell",
            (
                (1.045, 0.0, 0.008, 0.225, 0.145),
                (1.155, 0.0, 0.000, 0.205, 0.140),
                (1.300, 0.0, -0.004, 0.180, 0.142),
                (1.445, 0.0, -0.008, 0.225, 0.160),
                (1.550, 0.0, 0.000, 0.205, 0.145),
            ),
            0.018,
            32,
            cloth,
            armature,
            "spine_02",
        )
    )
    pieces.append(
        ring_shell(
            "P10R2_Leather_WaistBelt",
            (
                (1.045, 0.0, 0.004, 0.225, 0.148),
                (1.086, 0.0, 0.004, 0.227, 0.149),
            ),
            0.012,
            32,
            leather,
            armature,
            "pelvis",
        )
    )
    pieces.append(
        ring_shell(
            "P10R2_Metal_Collar",
            (
                (1.535, 0.0, 0.002, 0.205, 0.145),
                (1.586, 0.0, 0.012, 0.145, 0.116),
            ),
            0.013,
            28,
            metal,
            armature,
            "spine_03",
        )
    )

    # Fitted tunic remains the primary torso read. Small clasp and articulated
    # back rail supply armor language without hiding ribcage/waist anatomy
    # behind a torso-sized floating slab.
    pieces.append(
        plate_prism(
            "P10R2_Metal_SternumClasp",
            (
                (-0.050, 1.452),
                (0.0, 1.505),
                (0.050, 1.452),
                (0.038, 1.372),
                (0.0, 1.338),
                (-0.038, 1.372),
            ),
            -0.166,
            0.014,
            metal,
            armature,
            "spine_03",
            0.005,
        )
    )
    pieces.append(
        solid_tube(
            "P10R2_Glow_BackArticulation",
            (
                (0.0, 0.166, 1.485),
                (0.0, 0.178, 1.405),
                (0.0, 0.176, 1.315),
                (0.0, 0.160, 1.230),
            ),
            (
                (0.010, 0.006),
                (0.011, 0.006),
                (0.010, 0.006),
                (0.006, 0.004),
            ),
            10,
            glow,
            armature,
            "spine_02",
        )
    )

    # Front and rear harnesses are solid leather cords, not painted lines.
    harness_paths = [
        ((-0.180, -0.188, 1.514), (-0.080, -0.202, 1.338), (0.115, -0.184, 1.096)),
        ((0.180, -0.188, 1.514), (0.080, -0.202, 1.338), (-0.115, -0.184, 1.096)),
        ((-0.174, 0.190, 1.508), (-0.058, 0.205, 1.355), (0.135, 0.183, 1.100)),
        ((0.174, 0.190, 1.508), (0.060, 0.205, 1.355), (-0.135, 0.183, 1.100)),
    ]
    for index, path in enumerate(harness_paths):
        pieces.append(
            solid_tube(
                f"P10R2_Leather_Harness_{index:02d}",
                path,
                ((0.011, 0.006), (0.012, 0.006), (0.010, 0.005)),
                10,
                leather,
                armature,
                "spine_02",
            )
        )

    # Articulated shoulder seam cords preserve the asymmetric design while
    # leaving the organic shoulder cap and elbow transition fully visible.
    shoulder_seams = (
        (
            "P10R2_Leather_ShoulderSeam_R",
            (
                (-0.090, -0.132, 1.542),
                (-0.170, -0.118, 1.562),
                (-0.250, -0.072, 1.548),
                (-0.305, -0.018, 1.510),
            ),
            "clavicle_r",
        ),
        (
            "P10R2_Leather_ShoulderSeam_L",
            (
                (0.090, -0.132, 1.542),
                (0.165, -0.118, 1.559),
                (0.235, -0.075, 1.546),
                (0.278, -0.025, 1.512),
            ),
            "clavicle_l",
        ),
    )
    for seam_name, path, bone_name in shoulder_seams:
        pieces.append(
            solid_tube(
                seam_name,
                path,
                (
                    (0.009, 0.006),
                    (0.010, 0.006),
                    (0.009, 0.006),
                    (0.005, 0.004),
                ),
                10,
                leather,
                armature,
                bone_name,
            )
        )

    for sign, side, lowerarm, calf, foot in (
        (1.0, "L", "lowerarm_l", "calf_l", "foot_l"),
        (-1.0, "R", "lowerarm_r", "calf_r", "foot_r"),
    ):
        arm_points = (
            (0.445 * sign, 0.055, 1.531),
            (0.525 * sign, 0.055, 1.531),
            (0.600 * sign, 0.052, 1.531),
        )
        pieces.append(
            axis_shell(
                f"P10R2_Metal_Bracer_{side}",
                arm_points,
                ((0.071, 0.066), (0.067, 0.061), (0.060, 0.054)),
                0.010,
                20,
                metal,
                armature,
                lowerarm,
            )
        )
        pieces.append(
            solid_tube(
                f"P10R2_Glow_BracerRail_{side}",
                (
                    (0.458 * sign, -0.018, 1.540),
                    (0.522 * sign, -0.025, 1.541),
                    (0.590 * sign, -0.010, 1.537),
                ),
                ((0.007, 0.005), (0.007, 0.005), (0.004, 0.003)),
                8,
                glow,
                armature,
                lowerarm,
            )
        )
        leg_x = 0.1114 * sign
        pieces.append(
            axis_shell(
                f"P10R2_Metal_Greave_{side}",
                (
                    (leg_x, 0.048, 0.525),
                    (leg_x, 0.064, 0.400),
                    (leg_x, 0.076, 0.235),
                ),
                ((0.085, 0.078), (0.078, 0.071), (0.063, 0.058)),
                0.010,
                20,
                metal,
                armature,
                calf,
            )
        )
        pieces.append(
            solid_tube(
                f"P10R2_Glow_GreaveRail_{side}",
                (
                    (leg_x, -0.040, 0.500),
                    (leg_x, -0.046, 0.405),
                    (leg_x, -0.018, 0.255),
                ),
                ((0.007, 0.005), (0.007, 0.005), (0.004, 0.003)),
                8,
                glow,
                armature,
                calf,
            )
        )
        pieces.append(
            axis_shell(
                f"P10R2_Leather_AnkleCuff_{side}",
                (
                    (leg_x, 0.072, 0.220),
                    (leg_x, 0.070, 0.160),
                ),
                ((0.071, 0.065), (0.068, 0.062)),
                0.010,
                18,
                leather,
                armature,
                foot,
            )
        )
        pieces.append(
            axis_shell(
                f"P10R2_Leather_ArmoredFoot_{side}",
                (
                    (leg_x, 0.055, 0.115),
                    (leg_x, -0.035, 0.070),
                    (leg_x, -0.145, 0.042),
                ),
                (
                    (0.074, 0.060),
                    (0.080, 0.045),
                    (0.069, 0.030),
                ),
                0.009,
                20,
                leather,
                armature,
                foot,
            )
        )

    pieces.extend(
        [
            plate_prism(
                "P10R2_CoatTail_Left",
                (
                    (-0.155, 1.025),
                    (-0.262, 0.985),
                    (-0.286, 0.522),
                    (-0.220, 0.408),
                    (-0.132, 0.570),
                    (-0.090, 0.962),
                ),
                0.150,
                0.008,
                cloth,
                armature,
                "pelvis",
                0.003,
            ),
            plate_prism(
                "P10R2_CoatTail_Right",
                (
                    (0.045, 1.020),
                    (0.166, 0.990),
                    (0.224, 0.570),
                    (0.165, 0.438),
                    (0.078, 0.586),
                    (0.008, 0.965),
                ),
                0.165,
                0.008,
                leather,
                armature,
                "pelvis",
                0.003,
            ),
            plate_prism(
                "P10R2_CoatTail_CenterSplit",
                (
                    (-0.060, 1.018),
                    (0.045, 1.016),
                    (0.067, 0.676),
                    (0.010, 0.546),
                    (-0.072, 0.688),
                ),
                0.184,
                0.007,
                cloth,
                armature,
                "pelvis",
                0.003,
            ),
        ]
    )
    return pieces


def transform_point(
    matrix: Matrix,
    point: Sequence[float],
) -> tuple[float, float, float]:
    return tuple(matrix @ Vector(point))


def transformed_plate_prism(
    name: str,
    outline_xz: Sequence[tuple[float, float]],
    canonical_y: float,
    thickness: float,
    transform: Matrix,
    material: bpy.types.Material,
    armature: bpy.types.Object,
    bone_name: str,
    bevel_width: float,
) -> bpy.types.Object:
    local_vertices = [
        (x, canonical_y - thickness * 0.5, z) for x, z in outline_xz
    ]
    local_vertices.extend(
        (x, canonical_y + thickness * 0.5, z) for x, z in outline_xz
    )
    vertices = [transform_point(transform, point) for point in local_vertices]
    count = len(outline_xz)
    faces: list[tuple[int, ...]] = [
        tuple(range(count - 1, -1, -1)),
        tuple(range(count, count * 2)),
    ]
    for index in range(count):
        following = (index + 1) % count
        faces.append((index, following, count + following, count + index))
    result = make_mesh_object(
        name,
        vertices,
        faces,
        material,
        armature,
        bone_name,
        smooth=False,
    )
    bevel_geometry(result, bevel_width, 3)
    smooth_mesh(result)
    return result


def create_weapon(
    materials: dict[str, bpy.types.Material],
    armature: bpy.types.Object,
) -> tuple[bpy.types.Object, Matrix]:
    metal = materials["P10R2_Metal"]
    leather = materials["P10R2_Leather"]
    glow = materials["P10R2_Glow"]
    transform = (
        Matrix.Translation(Vector((0.08, 0.205, 0.720)))
        @ Matrix.Rotation(math.radians(20.0), 4, "Y")
        @ Matrix.Rotation(math.radians(-4.0), 4, "Z")
        @ Matrix.Diagonal((0.48, 0.54, 0.54, 1.0))
    )
    pieces: list[bpy.types.Object] = []
    blade_outline = (
        (-0.105, 0.310),
        (-0.205, 0.770),
        (-0.190, 1.180),
        (-0.145, 1.470),
        (-0.030, 1.700),
        (0.060, 1.594),
        (0.130, 1.390),
        (0.178, 0.830),
        (0.105, 0.310),
    )
    pieces.append(
        transformed_plate_prism(
            "P10R2_Weapon_BladeOuter",
            blade_outline,
            0.0,
            0.062,
            transform,
            metal,
            armature,
            "spine_03",
            0.014,
        )
    )
    inset_outline = (
        (-0.065, 0.390),
        (-0.130, 0.805),
        (-0.108, 1.220),
        (-0.050, 1.470),
        (0.012, 1.544),
        (0.070, 1.330),
        (0.102, 0.835),
        (0.060, 0.390),
    )
    pieces.append(
        transformed_plate_prism(
            "P10R2_Weapon_DarkInset",
            inset_outline,
            -0.039,
            0.018,
            transform,
            leather,
            armature,
            "spine_03",
            0.007,
        )
    )
    core_outline = (
        (-0.019, 0.470),
        (-0.032, 0.850),
        (-0.022, 1.270),
        (0.0, 1.430),
        (0.026, 1.265),
        (0.035, 0.850),
        (0.020, 0.470),
    )
    pieces.append(
        transformed_plate_prism(
            "P10R2_Weapon_EmissiveCore",
            core_outline,
            -0.052,
            0.012,
            transform,
            glow,
            armature,
            "spine_03",
            0.004,
        )
    )
    guard_outline = (
        (-0.335, 0.258),
        (-0.220, 0.205),
        (0.0, 0.224),
        (0.220, 0.205),
        (0.335, 0.258),
        (0.220, 0.328),
        (0.0, 0.345),
        (-0.220, 0.328),
    )
    pieces.append(
        transformed_plate_prism(
            "P10R2_Weapon_FunctionalGuard",
            guard_outline,
            0.0,
            0.092,
            transform,
            metal,
            armature,
            "spine_03",
            0.016,
        )
    )
    grip_points = (
        transform_point(transform, (0.0, 0.0, -0.360)),
        transform_point(transform, (0.0, 0.0, -0.070)),
        transform_point(transform, (0.0, 0.0, 0.220)),
    )
    pieces.append(
        solid_tube(
            "P10R2_Weapon_Grip",
            grip_points,
            ((0.039, 0.034), (0.041, 0.035), (0.038, 0.033)),
            16,
            leather,
            armature,
            "spine_03",
        )
    )
    for index, z in enumerate((-0.300, -0.200, -0.100, 0.0, 0.100)):
        band_start = transform_point(transform, (0.0, 0.0, z - 0.010))
        band_end = transform_point(transform, (0.0, 0.0, z + 0.010))
        pieces.append(
            solid_tube(
                f"P10R2_Weapon_GripBand_{index:02d}",
                (band_start, band_end),
                ((0.044, 0.038), (0.044, 0.038)),
                14,
                metal,
                armature,
                "spine_03",
            )
        )
    pommel_outline = (
        (-0.095, -0.365),
        (0.0, -0.485),
        (0.095, -0.365),
        (0.070, -0.305),
        (0.0, -0.280),
        (-0.070, -0.305),
    )
    pieces.append(
        transformed_plate_prism(
            "P10R2_Weapon_Pommel",
            pommel_outline,
            0.0,
            0.085,
            transform,
            metal,
            armature,
            "spine_03",
            0.012,
        )
    )
    weapon = join_meshes(
        pieces,
        "P10R2_AetherGreatblade",
        preferred_active=pieces[0],
    )
    weapon["p10r2_weapon_stow_transform"] = [
        value for row in transform for value in row
    ]
    return weapon, transform


def join_meshes(
    objects: Sequence[bpy.types.Object],
    name: str,
    preferred_active: bpy.types.Object | None = None,
) -> bpy.types.Object:
    meshes = [
        mesh_object
        for mesh_object in objects
        if mesh_object is not None and mesh_object.type == "MESH"
    ]
    require(meshes, f"No meshes supplied for join: {name}")
    bpy.ops.object.select_all(action="DESELECT")
    for mesh_object in meshes:
        mesh_object.select_set(True)
    active = preferred_active or meshes[0]
    bpy.context.view_layer.objects.active = active
    bpy.ops.object.join()
    active.name = name
    active.data.name = f"{name}_Mesh"
    smooth_mesh(active)
    return active


def add_body_subdivision(body: bpy.types.Object) -> None:
    modifier = body.modifiers.new("P10R2_AuthoredSurface", "SUBSURF")
    modifier.subdivision_type = "CATMULL_CLARK"
    modifier.levels = 1
    modifier.render_levels = 1
    modifier.show_only_control_edges = True
    while body.modifiers.find(modifier.name) > 0:
        body.modifiers.move(
            body.modifiers.find(modifier.name),
            body.modifiers.find(modifier.name) - 1,
        )
    for polygon in body.data.polygons:
        polygon.use_smooth = True


def add_and_apply_subdivision(
    mesh_object: bpy.types.Object,
    name: str,
    level: int = 1,
) -> None:
    modifier = mesh_object.modifiers.new(name, "SUBSURF")
    modifier.subdivision_type = "CATMULL_CLARK"
    modifier.levels = level
    modifier.render_levels = level
    modifier.show_only_control_edges = True
    while mesh_object.modifiers.find(modifier.name) > 0:
        mesh_object.modifiers.move(
            mesh_object.modifiers.find(modifier.name),
            mesh_object.modifiers.find(modifier.name) - 1,
        )
    apply_modifier(mesh_object, modifier)


def validate_authored_proportions(body: bpy.types.Object) -> None:
    coordinates = [vertex.co for vertex in body.data.vertices]
    minimum_z = min(point.z for point in coordinates)
    maximum_z = max(point.z for point in coordinates)
    neck_z = remap_z(SOURCE_NECK_PLANE_Z)
    head_height = maximum_z - neck_z
    total_height = maximum_z - minimum_z
    heads = total_height / head_height
    require(
        abs(heads - TARGET_HEADS) <= TARGET_HEADS_TOLERANCE,
        f"Authored proportion drift: {heads:.3f} heads.",
    )
    print(
        "P10R2_PROPORTIONS "
        f"height={total_height:.4f} "
        f"headHeight={head_height:.4f} "
        f"heads={heads:.4f}"
    )


def triangle_count(mesh_object: bpy.types.Object) -> int:
    mesh_object.data.calc_loop_triangles()
    return len(mesh_object.data.loop_triangles)


def canonical_material_name(name: str) -> str:
    for family in MATERIAL_NAMES:
        if name == family or name.startswith(f"{family}."):
            return family
    raise RuntimeError(f"Unexpected material family on delivery mesh: {name}")


def consolidate_material_slots(
    mesh_object: bpy.types.Object,
    material_order: Sequence[bpy.types.Material],
) -> None:
    old_materials = list(mesh_object.data.materials)
    polygon_names = [
        canonical_material_name(
            old_materials[polygon.material_index].name
        )
        for polygon in mesh_object.data.polygons
    ]
    mesh_object.data.materials.clear()
    index_by_name: dict[str, int] = {}
    for material in material_order:
        index_by_name[material.name] = len(mesh_object.data.materials)
        mesh_object.data.materials.append(material)
    for polygon, family_name in zip(mesh_object.data.polygons, polygon_names):
        require(
            family_name in index_by_name,
            f"{mesh_object.name} omitted material {family_name}.",
        )
        polygon.material_index = index_by_name[family_name]
    mesh_object.data.update()


def clear_pose(armature: bpy.types.Object) -> None:
    for pose_bone in armature.pose.bones:
        for constraint in list(pose_bone.constraints):
            if constraint.name.startswith("P10R2_CombatIK"):
                pose_bone.constraints.remove(constraint)
    for candidate in list(bpy.data.objects):
        if candidate.name.startswith("P10R2_CombatIK_"):
            bpy.data.objects.remove(candidate, do_unlink=True)
    armature.data.pose_position = "POSE"
    for pose_bone in armature.pose.bones:
        pose_bone.matrix_basis = Matrix.Identity(4)
        pose_bone.rotation_mode = "QUATERNION"
        pose_bone.rotation_quaternion = Quaternion((1.0, 0.0, 0.0, 0.0))
        pose_bone.location = Vector((0.0, 0.0, 0.0))
        pose_bone.scale = Vector((1.0, 1.0, 1.0))
    bpy.context.view_layer.update()


def add_combat_ik(
    armature: bpy.types.Object,
    lower_bone_name: str,
    target_local: Sequence[float],
    pole_local: Sequence[float],
    suffix: str,
) -> None:
    target = bpy.data.objects.new(f"P10R2_CombatIK_Target_{suffix}", None)
    pole = bpy.data.objects.new(f"P10R2_CombatIK_Pole_{suffix}", None)
    bpy.context.collection.objects.link(target)
    bpy.context.collection.objects.link(pole)
    target.hide_render = True
    pole.hide_render = True
    target.matrix_world = (
        armature.matrix_world @ Matrix.Translation(Vector(target_local))
    )
    pole.matrix_world = (
        armature.matrix_world @ Matrix.Translation(Vector(pole_local))
    )
    lower = armature.pose.bones[lower_bone_name]
    constraint = lower.constraints.new("IK")
    constraint.name = f"P10R2_CombatIK_{suffix}"
    constraint.target = target
    constraint.pole_target = pole
    constraint.chain_count = 2
    constraint.use_stretch = False
    constraint.pole_angle = 0.0
    bpy.context.view_layer.update()


def set_bone_rotation(
    armature: bpy.types.Object,
    bone_name: str,
    rotations: Sequence[tuple[Sequence[float], float]],
) -> None:
    pose_bone = armature.pose.bones.get(bone_name)
    require(pose_bone is not None, f"Pose bone missing: {bone_name}")
    rest_rotation = pose_bone.bone.matrix_local.to_3x3()
    result = Quaternion((1.0, 0.0, 0.0, 0.0))
    for armature_axis, angle_degrees in rotations:
        local_axis = rest_rotation.inverted() @ Vector(armature_axis)
        local_axis.normalize()
        result = Quaternion(
            local_axis,
            math.radians(angle_degrees),
        ) @ result
    pose_bone.rotation_mode = "QUATERNION"
    pose_bone.rotation_quaternion = result


def rotate_pose_bone_global(
    armature: bpy.types.Object,
    bone_name: str,
    axis: Sequence[float],
    angle_degrees: float,
) -> None:
    """Rotate the current posed bone about its own head in armature space."""
    bpy.context.view_layer.update()
    pose_bone = armature.pose.bones.get(bone_name)
    require(pose_bone is not None, f"Pose bone missing: {bone_name}")
    head = pose_bone.head.copy()
    rotation = Matrix.Rotation(
        math.radians(angle_degrees),
        4,
        Vector(axis).normalized(),
    )
    pose_bone.matrix = (
        Matrix.Translation(head)
        @ rotation
        @ Matrix.Translation(-head)
        @ pose_bone.matrix
    )
    bpy.context.view_layer.update()


def aim_pose_bone(
    armature: bpy.types.Object,
    bone_name: str,
    head: Vector,
    tail: Vector,
) -> None:
    pose_bone = armature.pose.bones[bone_name]
    direction = (tail - head).normalized()
    orientation = direction.to_track_quat("Y", "Z").to_matrix().to_4x4()
    pose_bone.matrix = Matrix.Translation(head) @ orientation
    bpy.context.view_layer.update()


def pose_two_bone_chain(
    armature: bpy.types.Object,
    upper_name: str,
    lower_name: str,
    target: Sequence[float],
    pole: Sequence[float],
) -> None:
    upper = armature.pose.bones[upper_name]
    lower = armature.pose.bones[lower_name]
    shoulder = upper.head.copy()
    target_point = Vector(target)
    first_length = upper.bone.length
    second_length = lower.bone.length
    delta = target_point - shoulder
    distance = max(
        abs(first_length - second_length) + 1.0e-4,
        min(delta.length, first_length + second_length - 1.0e-4),
    )
    direction = delta.normalized()
    along = (
        first_length * first_length
        - second_length * second_length
        + distance * distance
    ) / (2.0 * distance)
    height = math.sqrt(max(0.0, first_length * first_length - along * along))
    circle_center = shoulder + direction * along
    pole_vector = Vector(pole) - circle_center
    pole_vector -= direction * pole_vector.dot(direction)
    if pole_vector.length < 1.0e-5:
        pole_vector = direction.cross(Vector((0.0, 0.0, 1.0)))
    pole_vector.normalize()
    elbow = circle_center + pole_vector * height
    aim_pose_bone(armature, upper_name, shoulder, elbow)
    aim_pose_bone(armature, lower_name, elbow, target_point)


def pose_neutral_ready(armature: bpy.types.Object) -> None:
    clear_pose(armature)
    set_bone_rotation(armature, "upperarm_l", (((0, 1, 0), 64), ((0, 0, 1), -7)))
    set_bone_rotation(armature, "upperarm_r", (((0, 1, 0), -60), ((0, 0, 1), 10)))
    set_bone_rotation(armature, "lowerarm_l", (((0, 1, 0), 10), ((0, 0, 1), -12)))
    set_bone_rotation(armature, "lowerarm_r", (((0, 1, 0), -15), ((0, 0, 1), 16)))
    set_bone_rotation(armature, "hand_l", (((0, 0, 1), -5),))
    set_bone_rotation(armature, "hand_r", (((0, 0, 1), 7),))
    set_bone_rotation(armature, "thigh_l", (((0, 1, 0), -5), ((1, 0, 0), 2)))
    set_bone_rotation(armature, "thigh_r", (((0, 1, 0), 6), ((1, 0, 0), -3)))
    set_bone_rotation(armature, "calf_l", (((1, 0, 0), -4),))
    set_bone_rotation(armature, "calf_r", (((1, 0, 0), 6),))
    set_bone_rotation(armature, "spine_02", (((0, 0, 1), -2),))
    set_bone_rotation(armature, "spine_03", (((0, 0, 1), 3),))
    set_bone_rotation(armature, "Head", (((0, 0, 1), -2), ((1, 0, 0), -2)))
    bpy.context.view_layer.update()


def combat_held_transform() -> Matrix:
    """World transform shared by combat weapon placement and grip solving."""
    return (
        Matrix.Translation(Vector((-0.230, -0.270, 1.180)))
        @ Matrix.Rotation(math.radians(-35.0), 4, "Y")
        @ Matrix.Rotation(math.radians(-5.0), 4, "X")
        @ Matrix.Diagonal((0.54, 0.56, 0.56, 1.0))
    )


def point_segment_distance(
    point: Vector,
    start: Vector,
    end: Vector,
) -> float:
    return (point - closest_point_on_segment(point, start, end)).length


def closest_point_on_segment(
    point: Vector,
    start: Vector,
    end: Vector,
) -> Vector:
    segment = end - start
    parameter = max(
        0.0,
        min(1.0, (point - start).dot(segment) / segment.length_squared),
    )
    return start + segment * parameter


def orient_hand_to_grip(
    armature: bpy.types.Object,
    bone_name: str,
    grip_point: Vector,
) -> None:
    """Aim the palm from the solved wrist toward its grip-space contact."""
    bpy.context.view_layer.update()
    hand = armature.pose.bones[bone_name]
    direction = (grip_point - hand.head).normalized()
    current_up = hand.matrix.to_3x3() @ Vector((0.0, 0.0, 1.0))
    if abs(direction.dot(current_up.normalized())) > 0.94:
        current_up = Vector((0.0, 0.0, 1.0))
    rotation = direction.to_track_quat("Y", "Z").to_matrix().to_4x4()
    hand.matrix = Matrix.Translation(hand.head) @ rotation
    bpy.context.view_layer.update()


def orient_pose_bone_to_point(
    armature: bpy.types.Object,
    bone_name: str,
    target: Vector,
) -> None:
    bpy.context.view_layer.update()
    pose_bone = armature.pose.bones[bone_name]
    direction = (target - pose_bone.head).normalized()
    rotation = direction.to_track_quat("Y", "Z").to_matrix().to_4x4()
    pose_bone.matrix = Matrix.Translation(pose_bone.head) @ rotation
    bpy.context.view_layer.update()


def close_digits_around_grip(
    armature: bpy.types.Object,
    side: str,
    held_transform: Matrix,
) -> None:
    """Curl digits with local joint rotations that preserve skinned continuity."""
    del held_transform
    direction = 1.0 if side == "r" else -1.0
    for finger in ("index", "middle", "ring", "pinky"):
        for phalanx, angle in ((1, 76), (2, 72), (3, 62)):
            set_bone_rotation(
                armature,
                f"{finger}_0{phalanx}_{side}",
                (((0, 1, 0), direction * angle),),
            )
    set_bone_rotation(
        armature,
        f"thumb_01_{side}",
        (
            ((0, 0, 1), direction * -32),
            ((0, 1, 0), direction * 38),
        ),
    )
    set_bone_rotation(
        armature,
        f"thumb_02_{side}",
        (((0, 1, 0), direction * 52),),
    )
    set_bone_rotation(
        armature,
        f"thumb_03_{side}",
        (((0, 1, 0), direction * 44),),
    )


def validate_combat_grip(
    armature: bpy.types.Object,
    held_transform: Matrix,
) -> None:
    """Fail closed when the posed palms do not physically reach the handle."""
    grip_start = held_transform @ Vector((0.0, 0.0, -0.360))
    grip_end = held_transform @ Vector((0.0, 0.0, 0.220))
    distances: dict[str, float] = {}
    for side in ("r", "l"):
        hand = armature.pose.bones[f"hand_{side}"]
        # The hand tail lies in the palm at the metacarpal transition and is a
        # stable skeletal proxy for actual skinned-surface grip contact.
        distances[side] = point_segment_distance(
            hand.tail.copy(),
            grip_start,
            grip_end,
        )
    require(
        max(distances.values()) <= 0.040,
        "Combat grip missed the authored handle: "
        f"right={distances['r']:.4f}m left={distances['l']:.4f}m.",
    )
    print(
        "P10R2_GRIP_CONTACT "
        f"right={distances['r']:.4f}m left={distances['l']:.4f}m"
    )


def pose_combat_ready(
    armature: bpy.types.Object,
    held_transform: Matrix | None = None,
) -> None:
    held = held_transform or combat_held_transform()
    clear_pose(armature)
    set_bone_rotation(armature, "spine_01", (((0, 0, 1), 5),))
    set_bone_rotation(armature, "spine_02", (((0, 0, 1), 8), ((1, 0, 0), -3)))
    set_bone_rotation(armature, "spine_03", (((0, 0, 1), -5), ((1, 0, 0), 4)))
    # Both wrist targets are authored in weapon grip space and transformed to
    # armature space. This keeps hand placement causally tied to the handle.
    # 0.26 canonical metres maps to roughly the 0.14 m wrist-to-palm length
    # after the authored 0.54 weapon scale.
    right_wrist = held @ Vector((0.260, 0.018, -0.210))
    left_wrist = held @ Vector((0.260, 0.018, 0.045))
    right_palm = held @ Vector((0.010, 0.0, -0.210))
    left_palm = held @ Vector((0.010, 0.0, 0.045))
    add_combat_ik(
        armature,
        "lowerarm_r",
        right_wrist,
        right_wrist + Vector((-0.42, -0.18, 0.22)),
        "R",
    )
    add_combat_ik(
        armature,
        "lowerarm_l",
        left_wrist,
        left_wrist + Vector((0.42, -0.18, 0.22)),
        "L",
    )
    orient_hand_to_grip(armature, "hand_r", right_palm)
    orient_hand_to_grip(armature, "hand_l", left_palm)
    set_bone_rotation(armature, "thigh_l", (((0, 1, 0), -10), ((1, 0, 0), 5)))
    set_bone_rotation(armature, "thigh_r", (((0, 1, 0), 11), ((1, 0, 0), -7)))
    set_bone_rotation(armature, "calf_l", (((1, 0, 0), -10),))
    set_bone_rotation(armature, "calf_r", (((1, 0, 0), 12),))
    set_bone_rotation(armature, "Head", (((0, 0, 1), 7), ((1, 0, 0), -5)))
    close_digits_around_grip(armature, "r", held)
    close_digits_around_grip(armature, "l", held)
    bpy.context.view_layer.update()
    validate_combat_grip(armature, held)


def duplicate_mesh_object(
    source: bpy.types.Object,
    name: str,
) -> bpy.types.Object:
    duplicate = source.copy()
    duplicate.data = source.data.copy()
    duplicate.name = name
    duplicate.data.name = f"{name}_Mesh"
    bpy.context.collection.objects.link(duplicate)
    return duplicate


def strip_modifiers(mesh_object: bpy.types.Object) -> None:
    for modifier in list(mesh_object.modifiers):
        mesh_object.modifiers.remove(modifier)


def add_armature_modifier(
    mesh_object: bpy.types.Object,
    armature: bpy.types.Object,
) -> None:
    modifier = mesh_object.modifiers.new("P10R2_Rig", "ARMATURE")
    modifier.object = armature
    mesh_object.parent = armature


def retarget_mesh_triangles(
    mesh_object: bpy.types.Object,
    target_triangles: int,
    armature: bpy.types.Object,
) -> None:
    strip_modifiers(mesh_object)
    current = triangle_count(mesh_object)
    if current < target_triangles:
        subdivision = mesh_object.modifiers.new("P10R2_LOD_Density", "SUBSURF")
        subdivision.subdivision_type = "SIMPLE"
        subdivision.levels = 1
        subdivision.render_levels = 1
        apply_modifier(mesh_object, subdivision)
        current = triangle_count(mesh_object)
    if current > target_triangles:
        decimate = mesh_object.modifiers.new("P10R2_LOD_Reduction", "DECIMATE")
        decimate.decimate_type = "COLLAPSE"
        decimate.ratio = max(0.02, min(1.0, target_triangles / current))
        decimate.use_collapse_triangulate = True
        apply_modifier(mesh_object, decimate)
    prune_weights_to_four(mesh_object)
    add_armature_modifier(mesh_object, armature)


def evaluated_snapshot(
    source: bpy.types.Object,
    name: str,
) -> bpy.types.Object:
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = source.evaluated_get(depsgraph)
    mesh = bpy.data.meshes.new_from_object(
        evaluated,
        preserve_all_data_layers=True,
        depsgraph=depsgraph,
    )
    snapshot = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(snapshot)
    snapshot.matrix_world = source.matrix_world.copy()
    return snapshot


def make_combat_weapon(
    source_weapon: bpy.types.Object,
    stow_transform: Matrix,
    armature: bpy.types.Object,
) -> bpy.types.Object:
    combat_weapon = duplicate_mesh_object(
        source_weapon,
        "P10R2_AetherGreatblade_CombatSource",
    )
    strip_modifiers(combat_weapon)
    held_transform = combat_held_transform()
    delta = held_transform @ stow_transform.inverted()
    for vertex in combat_weapon.data.vertices:
        vertex.co = delta @ vertex.co
    for group in list(combat_weapon.vertex_groups):
        combat_weapon.vertex_groups.remove(group)
    # Combat snapshots are static presentation meshes. Keeping the weapon
    # unskinned prevents a second hand transform from pulling it away from the
    # grip-space IK targets used by both wrists.
    combat_weapon.data.update()
    return combat_weapon


def remove_combat_hand_skin(
    source_character: bpy.types.Object,
    combat_snapshot: bpy.types.Object,
) -> None:
    """Remove the scaffold hand skin hidden beneath authored combat gauntlets."""
    require(
        len(source_character.data.vertices) == len(combat_snapshot.data.vertices),
        "Combat hand-mask topology did not preserve source vertex indices.",
    )
    hand_group_indices = {
        group.index
        for group in source_character.vertex_groups
        if group.name.startswith(
            (
                "hand_",
                "index_",
                "middle_",
                "ring_",
                "pinky_",
                "thumb_",
            )
        )
    }
    remove_indices = {
        vertex.index
        for vertex in source_character.data.vertices
        if sum(
            assignment.weight
            for assignment in vertex.groups
            if assignment.group in hand_group_indices
        )
        >= 0.35
    }
    require(
        len(remove_indices) >= 300,
        f"Combat hand-mask selected too few vertices: {len(remove_indices)}.",
    )
    bm = bmesh.new()
    bm.from_mesh(combat_snapshot.data)
    bm.verts.ensure_lookup_table()
    bmesh.ops.delete(
        bm,
        geom=[bm.verts[index] for index in sorted(remove_indices)],
        context="VERTS",
    )
    bm.to_mesh(combat_snapshot.data)
    bm.free()
    combat_snapshot.data.update()
    print(f"P10R2_COMBAT_HAND_MASK vertices={len(remove_indices)}")


def make_static_combat_tube(
    name: str,
    path: Sequence[Vector],
    radii: Sequence[tuple[float, float]],
    segments: int,
    material: bpy.types.Material,
    armature: bpy.types.Object,
) -> bpy.types.Object:
    tube = solid_tube(
        name,
        [tuple(point) for point in path],
        radii,
        segments,
        material,
        armature,
        "root",
    )
    world_matrix = tube.matrix_world.copy()
    strip_modifiers(tube)
    tube.parent = None
    tube.matrix_world = world_matrix
    for group in list(tube.vertex_groups):
        tube.vertex_groups.remove(group)
    return tube


def create_combat_gauntlets(
    materials: dict[str, bpy.types.Material],
    armature: bpy.types.Object,
    held_transform: Matrix,
) -> list[bpy.types.Object]:
    """Create fitted palm shells and visibly enclosed armored grip digits."""
    leather = materials["P10R2_Leather"]
    metal = materials["P10R2_Metal"]
    axis = (held_transform.to_3x3() @ Vector((0, 0, 1))).normalized()
    radial_x = (held_transform.to_3x3() @ Vector((1, 0, 0))).normalized()
    radial_y = (held_transform.to_3x3() @ Vector((0, 1, 0))).normalized()
    pieces: list[bpy.types.Object] = []
    for side, grip_z in (("R", -0.210), ("L", 0.045)):
        wrist = held_transform @ Vector((0.260, 0.018, grip_z))
        palm = held_transform @ Vector((0.052, 0.0, grip_z))
        pieces.append(
            make_static_combat_tube(
                f"P10R2_CombatGauntlet_Palm_{side}",
                (wrist, (wrist + palm) * 0.5, palm),
                ((0.058, 0.042), (0.061, 0.045), (0.050, 0.038)),
                16,
                leather,
                armature,
            )
        )
        cuff_center = wrist + (wrist - palm).normalized() * 0.010
        pieces.append(
            make_static_combat_tube(
                f"P10R2_CombatGauntlet_Cuff_{side}",
                (
                    cuff_center - (wrist - palm).normalized() * 0.026,
                    cuff_center + (wrist - palm).normalized() * 0.026,
                ),
                ((0.071, 0.055), (0.069, 0.053)),
                16,
                metal,
                armature,
            )
        )
        # Four separated U-shaped digits wrap 220 degrees around the actual
        # 21 mm handle. Axial offsets keep all contacts individually readable.
        for finger_index, axial_offset in enumerate(
            (-0.033, -0.011, 0.011, 0.033)
        ):
            center = (
                held_transform @ Vector((0.0, 0.0, grip_z))
                + axis * axial_offset
            )
            path: list[Vector] = []
            for step in range(7):
                angle = math.radians(-110.0 + step * (220.0 / 6.0))
                path.append(
                    center
                    + radial_x * (math.cos(angle) * 0.030)
                    + radial_y * (math.sin(angle) * 0.030)
                )
            pieces.append(
                make_static_combat_tube(
                    f"P10R2_CombatGauntlet_Finger_{side}_{finger_index:02d}",
                    path,
                    tuple((0.0105, 0.0090) for _ in path),
                    10,
                    leather,
                    armature,
                )
            )
        thumb_center = (
            held_transform @ Vector((0.0, 0.0, grip_z))
            + axis * (0.048 if side == "R" else -0.048)
        )
        thumb_path: list[Vector] = []
        for step in range(5):
            angle = math.radians(80.0 - step * 40.0)
            thumb_path.append(
                thumb_center
                + radial_x * (math.cos(angle) * 0.032)
                + radial_y * (math.sin(angle) * 0.032)
            )
        pieces.append(
            make_static_combat_tube(
                f"P10R2_CombatGauntlet_Thumb_{side}",
                thumb_path,
                tuple((0.012, 0.010) for _ in thumb_path),
                10,
                metal,
                armature,
            )
        )
    for piece in pieces:
        add_and_apply_subdivision(
            piece,
            "P10R2_CombatGauntletSurface",
            1,
        )
    return pieces


def install_deterministic_fbx_patch() -> None:
    from io_scene_fbx import export_fbx_bin, fbx_utils

    class FixedFBXDateTime(datetime.datetime):
        @classmethod
        def now(cls, tz=None):
            return cls(1970, 1, 1, 10, 0, 0, 0, tzinfo=tz)

    def stable_key_to_uuid(used_uuids, key):
        if isinstance(key, int) and 0 <= key < 2**63:
            candidate = key
        else:
            payload = f"{type(key).__name__}:{key!r}".encode("utf-8")
            candidate = int.from_bytes(
                hashlib.sha256(payload).digest()[:8],
                "big",
            ) & ((1 << 63) - 1)
        candidate = candidate or 1
        while candidate in used_uuids:
            candidate = ((candidate + 1) & ((1 << 63) - 1)) or 1
        return fbx_utils.UUID(candidate)

    fbx_utils._keys_to_uuids.clear()
    fbx_utils._uuids_to_keys.clear()
    fbx_utils._key_to_uuid = stable_key_to_uuid
    export_fbx_bin.datetime.datetime = FixedFBXDateTime


def export_selected_fbx(
    path: Path,
    character: bpy.types.Object,
    weapon: bpy.types.Object,
    armature: bpy.types.Object | None,
) -> None:
    target_names = {
        character: "P10R2_CharacterShell",
        weapon: "P10R2_AetherGreatblade",
    }
    conflicts: dict[bpy.types.Object, str] = {}
    selected = set(target_names)
    for candidate in bpy.data.objects:
        if candidate in selected:
            continue
        if candidate.name in target_names.values():
            conflicts[candidate] = candidate.name
            candidate.name = f"__P10R2_CONFLICT_{candidate.name}_{id(candidate)}"
    original_names = {item: item.name for item in target_names}
    for item, target_name in target_names.items():
        item.name = target_name
        item.data.name = f"{target_name}_Mesh"
    bpy.ops.object.select_all(action="DESELECT")
    character.select_set(True)
    weapon.select_set(True)
    if armature is not None:
        armature.select_set(True)
        bpy.context.view_layer.objects.active = armature
    else:
        bpy.context.view_layer.objects.active = character
    install_deterministic_fbx_patch()
    bpy.ops.export_scene.fbx(
        filepath=str(path),
        check_existing=False,
        use_selection=True,
        apply_unit_scale=True,
        apply_scale_options="FBX_SCALE_UNITS",
        use_space_transform=True,
        bake_space_transform=False,
        object_types={"MESH", "ARMATURE"} if armature else {"MESH"},
        use_mesh_modifiers=True,
        mesh_smooth_type="FACE",
        use_subsurf=False,
        add_leaf_bones=False,
        primary_bone_axis="Y",
        secondary_bone_axis="X",
        axis_forward="-Z",
        axis_up="Y",
        path_mode="RELATIVE",
        embed_textures=False,
        use_metadata=False,
        use_armature_deform_only=True,
        bake_anim=False,
    )
    for item, original_name in original_names.items():
        item.name = original_name
        item.data.name = f"{original_name}_Mesh"
    for conflict, original_name in conflicts.items():
        conflict.name = original_name
    require(path.is_file(), f"FBX export did not write {path}")
    print(
        "P10R2_EXPORT "
        f"path={path.relative_to(REPOSITORY_ROOT)} "
        f"sha256={sha256(path)} "
        f"tris={triangle_count(character) + triangle_count(weapon)}"
    )


def validate_delivery_mesh(
    character: bpy.types.Object,
    weapon: bpy.types.Object,
    minimum_triangles: int,
    maximum_triangles: int,
) -> int:
    total = triangle_count(character) + triangle_count(weapon)
    require(
        minimum_triangles <= total <= maximum_triangles,
        f"Delivery triangle gate failed: {total} not in "
        f"[{minimum_triangles}, {maximum_triangles}]",
    )
    for mesh_object in (character, weapon):
        maximum_influences = max(
            (len(vertex.groups) for vertex in mesh_object.data.vertices),
            default=0,
        )
        require(
            maximum_influences <= 4,
            f"{mesh_object.name} has {maximum_influences} influences.",
        )
    return total


def audit_exported_fbx(
    path: Path,
    rigged: bool,
    minimum_triangles: int,
    maximum_triangles: int,
) -> None:
    reset_scene()
    bpy.ops.import_scene.fbx(
        filepath=str(path),
        use_anim=False,
        ignore_leaf_bones=False,
        automatic_bone_orientation=False,
    )
    meshes = sorted(
        (item for item in bpy.context.scene.objects if item.type == "MESH"),
        key=lambda item: item.name,
    )
    require(
        [item.name for item in meshes]
        == ["P10R2_AetherGreatblade", "P10R2_CharacterShell"],
        f"FBX renderer contract failed for {path.name}: "
        f"{[item.name for item in meshes]}",
    )
    total = sum(triangle_count(item) for item in meshes)
    require(
        minimum_triangles <= total <= maximum_triangles,
        f"Imported FBX triangle gate failed for {path.name}: {total}",
    )
    armatures = [
        item for item in bpy.context.scene.objects if item.type == "ARMATURE"
    ]
    require(
        len(armatures) == (1 if rigged else 0),
        f"FBX rig contract failed for {path.name}: {len(armatures)} armatures.",
    )
    if rigged:
        deform_bones = [
            bone for bone in armatures[0].data.bones if bone.use_deform
        ]
        require(
            len(deform_bones) == EXPECTED_DEFORM_BONES,
            f"FBX {path.name} has {len(deform_bones)} deform bones.",
        )
        for mesh_object in meshes:
            maximum = max(
                (len(vertex.groups) for vertex in mesh_object.data.vertices),
                default=0,
            )
            require(maximum <= 4, f"FBX {path.name} imports with {maximum} weights.")
    print(
        "P10R2_FBX_AUDIT "
        f"path={path.name} renderers=2 rigged={str(rigged).lower()} "
        f"tris={total}"
    )


def build_full_stage() -> None:
    random.seed(SEED)
    ensure_directories()
    verify_ingested_hashes()
    reset_scene()
    body, eyes, eyebrows, armature = import_scaffold()
    verify_scaffold(body, armature)
    prune_weights_to_four(body)
    reshape_body(body)
    reshape_auxiliary((eyes, eyebrows))
    reshape_armature(armature)
    validate_authored_proportions(body)

    texture_paths = write_authored_textures()
    materials = build_materials(texture_paths)
    configure_scaffold_materials(body, eyes, eyebrows, materials)
    add_body_subdivision(body)
    apply_modifier(body, body.modifiers["P10R2_AuthoredSurface"])
    add_and_apply_subdivision(eyes, "P10R2_EyeSurface", 1)
    add_and_apply_subdivision(eyebrows, "P10R2_BrowSurface", 1)

    authored_pieces: list[bpy.types.Object] = []
    authored_pieces.extend(create_hair(materials, armature))
    authored_pieces.extend(create_costume(materials, armature))
    character = join_meshes(
        [body, eyes, eyebrows, *authored_pieces],
        "P10R2_CharacterShell",
        preferred_active=body,
    )
    consolidate_material_slots(
        character,
        [materials[name] for name in MATERIAL_NAMES],
    )
    prune_weights_to_four(character)
    weapon, stow_transform = create_weapon(materials, armature)
    consolidate_material_slots(
        weapon,
        [
            materials["P10R2_Leather"],
            materials["P10R2_Metal"],
            materials["P10R2_Glow"],
        ],
    )
    prune_weights_to_four(weapon)

    lod0_total = triangle_count(character) + triangle_count(weapon)
    if not 60000 <= lod0_total <= 90000:
        retarget_mesh_triangles(
            character,
            max(1000, 79000 - triangle_count(weapon)),
            armature,
        )
    lod0_total = validate_delivery_mesh(character, weapon, 60000, 90000)
    character["p10r2_lod"] = 0
    character["p10r2_anatomy_components"] = 1
    character["p10r2_target_heads"] = TARGET_HEADS
    character["p10r2_visible_triangles"] = lod0_total
    weapon["p10r2_lod"] = 0

    lod1_character = duplicate_mesh_object(character, "P10R2_CharacterShell_LOD1")
    lod1_weapon = duplicate_mesh_object(weapon, "P10R2_AetherGreatblade_LOD1")
    retarget_mesh_triangles(lod1_weapon, 2200, armature)
    retarget_mesh_triangles(lod1_character, 35800, armature)
    lod1_total = validate_delivery_mesh(
        lod1_character,
        lod1_weapon,
        30000,
        45000,
    )
    lod1_character["p10r2_lod"] = 1
    lod1_character["p10r2_visible_triangles"] = lod1_total
    lod1_weapon["p10r2_lod"] = 1

    lod2_character = duplicate_mesh_object(character, "P10R2_CharacterShell_LOD2")
    lod2_weapon = duplicate_mesh_object(weapon, "P10R2_AetherGreatblade_LOD2")
    retarget_mesh_triangles(lod2_weapon, 1100, armature)
    retarget_mesh_triangles(lod2_character, 14900, armature)
    lod2_total = validate_delivery_mesh(
        lod2_character,
        lod2_weapon,
        12000,
        20000,
    )
    lod2_character["p10r2_lod"] = 2
    lod2_character["p10r2_visible_triangles"] = lod2_total
    lod2_weapon["p10r2_lod"] = 2

    clear_pose(armature)
    export_selected_fbx(LOD_FBX[0], character, weapon, armature)
    export_selected_fbx(
        LOD_FBX[1],
        lod1_character,
        lod1_weapon,
        armature,
    )
    export_selected_fbx(
        LOD_FBX[2],
        lod2_character,
        lod2_weapon,
        armature,
    )

    pose_neutral_ready(armature)
    neutral_character = evaluated_snapshot(
        character,
        "P10R2_CharacterShell_NeutralSnapshot",
    )
    neutral_weapon = evaluated_snapshot(
        weapon,
        "P10R2_AetherGreatblade_NeutralSnapshot",
    )
    export_selected_fbx(
        NEUTRAL_FBX,
        neutral_character,
        neutral_weapon,
        None,
    )

    combat_weapon_source = make_combat_weapon(
        weapon,
        stow_transform,
        armature,
    )
    pose_combat_ready(armature)
    combat_character = evaluated_snapshot(
        character,
        "P10R2_CharacterShell_CombatSnapshot",
    )
    remove_combat_hand_skin(character, combat_character)
    combat_gauntlets = create_combat_gauntlets(
        materials,
        armature,
        combat_held_transform(),
    )
    combat_character = join_meshes(
        [combat_character, *combat_gauntlets],
        "P10R2_CharacterShell_CombatSnapshot",
        preferred_active=combat_character,
    )
    consolidate_material_slots(
        combat_character,
        [materials[name] for name in MATERIAL_NAMES],
    )
    combat_weapon = evaluated_snapshot(
        combat_weapon_source,
        "P10R2_AetherGreatblade_CombatSnapshot",
    )
    export_selected_fbx(
        COMBAT_FBX,
        combat_character,
        combat_weapon,
        None,
    )

    pose_neutral_ready(armature)
    configure_scene_metadata("full")
    scene = bpy.context.scene
    scene["p10_lod0_triangles"] = lod0_total
    scene["p10_lod1_triangles"] = lod1_total
    scene["p10_lod2_triangles"] = lod2_total
    scene["p10_delivery_renderers"] = 2
    scene["p10_delivery_material_families"] = len(MATERIAL_NAMES)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH), compress=False)
    print(f"P10R2_SOURCE_SAVED {BLEND_PATH}")

    audits = (
        (NEUTRAL_FBX, False, 60000, 90000),
        (COMBAT_FBX, False, 60000, 90000),
        (LOD_FBX[0], True, 60000, 90000),
        (LOD_FBX[1], True, 30000, 45000),
        (LOD_FBX[2], True, 12000, 20000),
    )
    for path, rigged, minimum, maximum in audits:
        audit_exported_fbx(path, rigged, minimum, maximum)
    print(
        "P10R2_FULL_COMPLETE "
        f"blendSha256={sha256(BLEND_PATH)} "
        f"lod0={lod0_total} lod1={lod1_total} lod2={lod2_total}"
    )


def configure_scene_metadata(stage: str) -> None:
    scene = bpy.context.scene
    scene["p10_piece"] = "P10"
    scene["p10_round"] = 2
    scene["p10_seed"] = SEED
    scene["p10_stage"] = stage
    scene["p10_source"] = "Quaternius Universal Base Characters Standard"
    scene["p10_source_license"] = "CC0 1.0 Universal"
    scene["p10_source_archive_sha256"] = EXPECTED_ARCHIVE_SHA256
    scene["p10_source_fbx_sha256"] = EXPECTED_SOURCE_FBX_SHA256
    scene["p10_body_components"] = EXPECTED_BODY_COMPONENTS
    scene["p10_body_boundary_edges"] = EXPECTED_BOUNDARY_EDGES
    scene["p10_body_non_manifold_edges"] = EXPECTED_NON_MANIFOLD_EDGES
    scene["p10_body_loose_vertices"] = EXPECTED_LOOSE_VERTICES
    scene["p10_target_heads"] = TARGET_HEADS


def save_source(stage: str) -> None:
    configure_scene_metadata(stage)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH), compress=False)
    print(f"P10R2_SOURCE_SAVED {BLEND_PATH}")


def build_ingest_stage() -> None:
    random.seed(SEED)
    ensure_directories()
    verify_ingested_hashes()
    reset_scene()
    body, eyes, eyebrows, armature = import_scaffold()
    verify_scaffold(body, armature)
    prune_weights_to_four(body)
    reshape_body(body)
    reshape_auxiliary((eyes, eyebrows))
    reshape_armature(armature)
    add_body_subdivision(body)
    validate_authored_proportions(body)
    save_source("ingest")


def main() -> None:
    args = parse_args()
    if args.stage == "ingest":
        build_ingest_stage()
    else:
        build_full_stage()


if __name__ == "__main__":
    main()
