#!/usr/bin/env python3
"""P10 Round003 — deterministic Rain-based Astra Vale authoring pipeline.

This pipeline intentionally keeps Blender Studio Rain's high quality face,
hands, feet, fitted cloth, UVs, texture graphs, and CloudRig source. It adds
only repository-authored presentation work:

* a blue-black / cyan anime-warrior material treatment;
* conforming armor derived from duplicated fitted source surfaces;
* a compact Aether Greatblade;
* neutral and combat poses;
* static presentation FBXs, static LOD FBXs, and a deform-only rig proof;
* nine 1600 px diagnostic renders.

The CloudRig proof is not a four-weight playable delivery claim. The audit
records the source influence counts explicitly.
"""

from __future__ import annotations

import bmesh
import bpy
import datetime as _datetime
import hashlib
import json
import math
import random
import shutil
import sys
from pathlib import Path

from mathutils import Matrix, Vector


ROOT = Path(__file__).resolve().parents[2]
ROUND_ROOT = ROOT / "ArtSource" / "P10" / "Round003"
VENDOR_ROOT = ROUND_ROOT / "ThirdParty" / "BlenderStudioRain"
SOURCE_BLEND = VENDOR_ROOT / "rain_v3.2.blend"
SOURCE_TEXTURES = VENDOR_ROOT / "textures"
SOURCE_LICENSE = VENDOR_ROOT / "LICENSE-CC-BY-4.0.txt"
PREFLIGHT = ROUND_ROOT / "Preflight"
AUTHORED_BLEND = ROUND_ROOT / "P10_Round003_AstraVale_Rain.blend"
GAME_ROOT = ROOT / "game" / "Assets" / "CodexOfWar" / "Heroes" / "P10" / "Round003"
MODEL_OUT = GAME_ROOT / "Models"
TEXTURE_OUT = GAME_ROOT / "Textures"

FIXED_TIME = _datetime.datetime(2026, 7, 31, 12, 0, 0)
RANDOM_SEED = 1003
RENDER_SIZE = 1600
BLADE_SCALE = Vector((0.68, 0.86, 0.80))

EXPECTED_HASHES = {
    "rain_v3.2.blend": "831ab6d837c679040285862b15dc9ee5180b018442a88aeaf92aaa7509b80258",
    "LICENSE-CC-BY-4.0.txt": "9ba9550ad48438d0836ddab3da480b3b69ffa0aac7b7878b5a0039e7ab429411",
    "textures/TEX-rain_body_diffuse.1001.png": "79294db9cccc7c395b3c95c5692eae454554611e8cad89e898f8b325b504bad5",
    "textures/TEX-rain_body_diffuse.1002.png": "d4abb09a50d846f57179d61bb0a72431cc57d261b1646b6439de1724afce4afc",
    "textures/TEX-rain_body_diffuse.1003.png": "64e0f179a1a872758801ce433b2b5b20ba0e9a399e01574b5a0f9266868c86ca",
    "textures/TEX-rain_body_diffuse.png": "79294db9cccc7c395b3c95c5692eae454554611e8cad89e898f8b325b504bad5",
    "textures/TEX-rain_body_roughness.1001.png": "22becb2fe72f49931f3dd278c78ae94f182da956f0ba2c77e324f7d3fca2f179",
    "textures/TEX-rain_body_roughness.1002.png": "12a6d25dc64fa1b31fade64f64ca7568e3f11f691de1ffd1be59c9c92ffa2378",
    "textures/TEX-rain_body_roughness.1003.png": "ab8a673417a762a78a0db1ae1489b13016799da8c24bfe9fea57763dedff9962",
    "textures/TEX-rain_body_roughness.png": "22becb2fe72f49931f3dd278c78ae94f182da956f0ba2c77e324f7d3fca2f179",
    "textures/TEX-rain_eyes.png": "fb2d509abe4bfa3aa4093272e81a25ddd9bbc3e4d03248fe7f213f9cda38a005",
    "textures/TEX-rain_hair_diffuse.png": "01c35d3fc4b3e961acf3446fdc4a5de83937e09c1b05b074b27c87e511d50ad6",
    "textures/TEX-rain_hair_direction.png": "3b17c6caeb953c6931aa6ccbaf8a082f236e66f7df2fcc1d54376d928ba7af0f",
    "textures/TEX-rain_hair_direction_bw.png": "099063769a7e132e93e2d5d93d9af5548f0c1b9e56b6098d47ce8cae8cf7c1bc",
    "textures/TEX-rain_hands_diffuse.png": "d4abb09a50d846f57179d61bb0a72431cc57d261b1646b6439de1724afce4afc",
    "textures/TEX-rain_hands_roughness.png": "12a6d25dc64fa1b31fade64f64ca7568e3f11f691de1ffd1be59c9c92ffa2378",
    "textures/TEX-rain_jeans_diffuse.png": "863b131b700ba189808c66970ad3abfcfa63b3d017676cd7dc5646f20f23305b",
    "textures/TEX-rain_jeans_normal.png": "e09126c3f5283e772bfe04a08daa0fa20688878a755abd5e88b9e0bf471e1337",
    "textures/TEX-rain_jeans_roughness.png": "d509abb985ec1d1b6571955f8596bc629cf03938c385536c2f992bfcd57e3a74",
    "textures/TEX-rain_scarf_cavity.png": "203a77498f163116f697100effaf20f0fbbaed70fbaed2b68ab9d7cb7c398a8a",
    "textures/TEX-rain_socks_bump.png": "bf71806f0b9e3cef029f46b6cb24a90633498622244c4dc88747a2dbb168a049",
    "textures/TEX-rain_socks_roughness.png": "fe9f0876fa41391091e91d6aa7c9cf40681a7544128d71519ef6fff0413e2f1c",
    "textures/TEX-rain_top_bump.png": "61f8ffdbde13c9fada97e9c45906426c9d92f1b94cb75ce718f498b9dadb5d1c",
    "textures/TEX-rain_top_roughness.png": "fb00f4f18e808dcb7a20a1732298e7252fee4502f797fd4299ce2cc88f39c42b",
}

SOURCE_MESH_NAMES = (
    "GEO-rain-body",
    "GEO-rain-eye_cornea",
    "GEO-rain-eye_dots",
    "GEO-rain-eyebrows",
    "GEO-rain-eyelashes",
    "GEO-rain-eyes",
    "GEO-rain-gums_lower",
    "GEO-rain-gums_upper",
    "GEO-rain-hair_main",
    "GEO-rain-hair_ponytail",
    "GEO-rain-hair_strand",
    "GEO-rain-hairband",
    "GEO-rain-head",
    "GEO-rain-jeans",
    "GEO-rain-scarf",
    "GEO-rain-shoes",
    "GEO-rain-tongue",
    "GEO-rain-top",
)

OUTPUT_FILES = {
    "neutral": MODEL_OUT / "P10_AstraVale_Round003_Neutral.fbx",
    "combat": MODEL_OUT / "P10_AstraVale_Round003_Combat.fbx",
    "lod0": MODEL_OUT / "P10_AstraVale_Round003_LOD0.fbx",
    "lod1": MODEL_OUT / "P10_AstraVale_Round003_LOD1.fbx",
    "lod2": MODEL_OUT / "P10_AstraVale_Round003_LOD2.fbx",
    "rig_proof": MODEL_OUT / "P10_AstraVale_Round003_CloudRig_DeformOnly_Proof.fbx",
}

DIAGNOSTICS = {
    "front": PREFLIGHT / "P10_Round003_Front.png",
    "three_quarter": PREFLIGHT / "P10_Round003_ThreeQuarter.png",
    "back": PREFLIGHT / "P10_Round003_Back.png",
    "profile": PREFLIGHT / "P10_Round003_Profile.png",
    "face": PREFLIGHT / "P10_Round003_Face.png",
    "hands": PREFLIGHT / "P10_Round003_Hands.png",
    "feet": PREFLIGHT / "P10_Round003_Feet.png",
    "combat": PREFLIGHT / "P10_Round003_Combat.png",
    "grip": PREFLIGHT / "P10_Round003_Grip.png",
}

AUDIT: dict[str, object] = {
    "pipeline": "P10_Round003_RainHero",
    "deterministic_seed": RANDOM_SEED,
    "source_credit": "Rain Rig (CC) Blender Foundation | studio.blender.org",
    "license": "CC BY 4.0",
    "runtime_boundary": (
        "The deform-only CloudRig export is an audit proof. It is not a "
        "playable four-weight character delivery."
    ),
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def ensure_directories() -> None:
    for path in (PREFLIGHT, MODEL_OUT, TEXTURE_OUT):
        path.mkdir(parents=True, exist_ok=True)


def verify_and_stage_sources() -> None:
    print("[P10:R3] Verifying exact Rain source payload")
    resolved: dict[str, str] = {}
    for relative, expected in EXPECTED_HASHES.items():
        path = VENDOR_ROOT / relative
        if not path.is_file():
            raise FileNotFoundError(f"Missing required source: {path}")
        actual = sha256(path)
        if actual != expected:
            raise RuntimeError(
                f"Source hash mismatch for {relative}: expected {expected}, got {actual}"
            )
        resolved[relative] = actual

    for source in sorted(SOURCE_TEXTURES.iterdir()):
        if not source.is_file():
            continue
        destination = TEXTURE_OUT / source.name
        shutil.copy2(source, destination)
        if sha256(destination) != sha256(source):
            raise RuntimeError(f"Texture staging verification failed: {source.name}")

    AUDIT["verified_source_hashes"] = resolved
    AUDIT["staged_texture_count"] = len(list(TEXTURE_OUT.glob("*")))


def fixed_fbx_clock() -> None:
    """Fix Blender FBX creation timestamps for byte-stable repeated exports."""
    import io_scene_fbx.export_fbx_bin as exporter

    class FixedDateTime(_datetime.datetime):
        @classmethod
        def now(cls, tz=None):
            fixed = FIXED_TIME
            return fixed.replace(tzinfo=tz) if tz else fixed

    exporter.datetime.datetime = FixedDateTime


def open_source() -> None:
    print(f"[P10:R3] Opening {SOURCE_BLEND}")
    bpy.ops.wm.open_mainfile(
        filepath=str(SOURCE_BLEND),
        load_ui=False,
        use_scripts=False,
    )
    bpy.context.scene.frame_set(1)
    random.seed(RANDOM_SEED)

    missing = [name for name in SOURCE_MESH_NAMES if name not in bpy.data.objects]
    if missing:
        raise RuntimeError(f"Rain source is missing expected meshes: {missing}")
    rig = bpy.data.objects.get("RIG-rain")
    if rig is None or rig.type != "ARMATURE":
        raise RuntimeError("Rain CloudRig armature RIG-rain is unavailable")

    for name in SOURCE_MESH_NAMES:
        obj = bpy.data.objects[name]
        obj.hide_render = False
        obj.hide_set(False)

    for obj in bpy.data.objects:
        if obj.name.startswith("WGT-") or obj.name.startswith("cloud_"):
            obj.hide_render = True
        if obj.type in {"LATTICE", "ARMATURE"}:
            obj.hide_render = True

    AUDIT["source_total_bones"] = len(rig.data.bones)
    AUDIT["source_deform_bones"] = sum(1 for bone in rig.data.bones if bone.use_deform)


def srgb(color: tuple[float, float, float]) -> tuple[float, float, float, float]:
    return (*color, 1.0)


def principled_socket(node, *names):
    for name in names:
        socket = node.inputs.get(name)
        if socket is not None:
            return socket
    return None


def tint_material(
    source,
    name: str,
    tint: tuple[float, float, float],
    amount: float,
    blend_type: str = "MULTIPLY",
    metallic: float | None = None,
    roughness: float | None = None,
    emission: tuple[float, float, float] | None = None,
    emission_strength: float = 0.0,
):
    material = source.copy()
    material.name = name
    material["p10_round003_authored"] = True
    material["p10_round003_source_material"] = source.name
    if not material.use_nodes:
        return material

    nodes = material.node_tree.nodes
    links = material.node_tree.links
    for index, node in enumerate([n for n in nodes if n.type == "BSDF_PRINCIPLED"]):
        base = principled_socket(node, "Base Color")
        if base is not None:
            if base.is_linked:
                original_link = base.links[0]
                mix = nodes.new("ShaderNodeMixRGB")
                mix.name = f"P10R3_Palette_{index:02d}"
                mix.label = "P10 R003 palette overlay; preserves source texture"
                mix.blend_type = blend_type
                mix.inputs[0].default_value = amount
                mix.inputs[2].default_value = srgb(tint)
                source_socket = original_link.from_socket
                links.remove(original_link)
                links.new(source_socket, mix.inputs[1])
                links.new(mix.outputs[0], base)
            else:
                current = tuple(base.default_value[:3])
                base.default_value = (
                    current[0] * (1.0 - amount) + tint[0] * amount,
                    current[1] * (1.0 - amount) + tint[1] * amount,
                    current[2] * (1.0 - amount) + tint[2] * amount,
                    1.0,
                )
        if metallic is not None:
            socket = principled_socket(node, "Metallic")
            if socket is not None and not socket.is_linked:
                socket.default_value = metallic
        if roughness is not None:
            socket = principled_socket(node, "Roughness")
            if socket is not None and not socket.is_linked:
                socket.default_value = roughness
        if emission is not None:
            socket = principled_socket(node, "Emission Color", "Emission")
            if socket is not None:
                socket.default_value = srgb(emission)
            strength = principled_socket(node, "Emission Strength")
            if strength is not None:
                strength.default_value = emission_strength
    return material


def apply_warrior_palette() -> dict[str, str]:
    recipes = {
        "MAT-rain.hair": ((0.055, 0.16, 0.28), 0.84, "MULTIPLY", 0.18),
        "MAT-rain.eyebrows": ((0.035, 0.12, 0.22), 0.86, "MULTIPLY", 0.34),
        "MAT-rain.eyelashes": ((0.01, 0.04, 0.07), 0.92, "MULTIPLY", 0.28),
        "MAT-rain.hairband": ((0.04, 0.56, 0.78), 0.70, "MULTIPLY", 0.21),
        "MAT-rain.top": ((0.04, 0.16, 0.23), 0.83, "MULTIPLY", 0.34),
        "MAT-rain.jeans": ((0.03, 0.075, 0.12), 0.76, "MULTIPLY", 0.42),
        "MAT-rain.scarf": ((0.03, 0.62, 0.86), 0.54, "MULTIPLY", 0.28),
        "MAT-rain.shoes": ((0.025, 0.065, 0.09), 0.82, "MULTIPLY", 0.26),
        "MAT-rain.laces": ((0.05, 0.45, 0.66), 0.58, "MULTIPLY", 0.32),
        "MAT-rain.socks": ((0.025, 0.08, 0.12), 0.78, "MULTIPLY", 0.46),
        "MAT-rain.metal": ((0.08, 0.29, 0.42), 0.44, "MULTIPLY", 0.19),
        "MAT-rain.eyes": ((0.18, 0.82, 1.0), 0.15, "SCREEN", 0.2),
    }
    replacements = {}
    for original_name, (tint, amount, mode, roughness) in recipes.items():
        source = bpy.data.materials.get(original_name)
        if source is None:
            continue
        authored = tint_material(
            source,
            f"P10R3_{original_name.removeprefix('MAT-rain.')}",
            tint,
            amount,
            blend_type=mode,
            roughness=roughness,
        )
        replacements[source.name] = authored

    changed: dict[str, str] = {}
    for name in SOURCE_MESH_NAMES:
        obj = bpy.data.objects[name]
        for index, slot in enumerate(obj.material_slots):
            if slot.material and slot.material.name in replacements:
                old = slot.material.name
                obj.material_slots[index].material = replacements[old]
                changed[old] = replacements[old].name
    AUDIT["palette_material_replacements"] = changed
    return changed


def material_principled(
    name: str,
    base: tuple[float, float, float],
    metallic: float,
    roughness: float,
    emission: tuple[float, float, float] | None = None,
    emission_strength: float = 0.0,
    noise_scale: float | None = None,
):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material["p10_round003_authored"] = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    shader.name = f"{name}_Principled"
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    coat = principled_socket(shader, "Coat Weight", "Coat")
    if coat is not None:
        coat.default_value = 0.32 if metallic > 0.4 else 0.1

    if noise_scale is not None:
        noise = nodes.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value = noise_scale
        noise.inputs["Detail"].default_value = 4.0
        noise.inputs["Roughness"].default_value = 0.55
        ramp = nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].position = 0.28
        ramp.color_ramp.elements[0].color = (
            base[0] * 0.64,
            base[1] * 0.64,
            base[2] * 0.64,
            1.0,
        )
        ramp.color_ramp.elements[1].position = 0.76
        ramp.color_ramp.elements[1].color = (
            min(base[0] * 1.18, 1.0),
            min(base[1] * 1.18, 1.0),
            min(base[2] * 1.18, 1.0),
            1.0,
        )
        bump = nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = 0.045
        bump.inputs["Distance"].default_value = 0.012
        links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
        links.new(ramp.outputs["Color"], shader.inputs["Base Color"])
        links.new(noise.outputs["Fac"], bump.inputs["Height"])
        links.new(bump.outputs["Normal"], shader.inputs["Normal"])
    else:
        shader.inputs["Base Color"].default_value = srgb(base)

    if emission is not None:
        emission_socket = principled_socket(shader, "Emission Color", "Emission")
        if emission_socket is not None:
            emission_socket.default_value = srgb(emission)
        strength = principled_socket(shader, "Emission Strength")
        if strength is not None:
            strength.default_value = emission_strength

    links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    return material


def authored_materials() -> dict[str, object]:
    return {
        "armor": material_principled(
            "P10R3_Armor_Obsidian",
            (0.018, 0.07, 0.105),
            0.58,
            0.31,
            noise_scale=38.0,
        ),
        "accent": material_principled(
            "P10R3_Armor_AetherEnamel",
            (0.025, 0.44, 0.66),
            0.35,
            0.25,
            emission=(0.02, 0.30, 0.55),
            emission_strength=0.32,
            noise_scale=16.0,
        ),
        "steel": material_principled(
            "P10R3_Blade_TemperedSteel",
            (0.15, 0.24, 0.30),
            0.91,
            0.16,
            noise_scale=46.0,
        ),
        "blade_dark": material_principled(
            "P10R3_Blade_Obsidian",
            (0.008, 0.025, 0.045),
            0.72,
            0.19,
            noise_scale=30.0,
        ),
        "glow": material_principled(
            "P10R3_Blade_AetherChannel",
            (0.01, 0.38, 0.72),
            0.32,
            0.09,
            emission=(0.01, 0.72, 1.0),
            emission_strength=5.0,
        ),
        "leather": material_principled(
            "P10R3_Blade_Grip",
            (0.018, 0.032, 0.044),
            0.06,
            0.48,
            noise_scale=22.0,
        ),
    }


def get_authored_collection():
    collection = bpy.data.collections.get("P10_Round003_AUTHORED")
    if collection is None:
        collection = bpy.data.collections.new("P10_Round003_AUTHORED")
        bpy.context.scene.collection.children.link(collection)
    return collection


def mark_surface_mask(panel, predicate) -> str:
    """Mask a fitted source surface without reindexing its weighted vertices.

    Rebuilding or deleting weighted vertices can invalidate CloudRig vertex
    group indices. A dedicated mask group retains the exact source topology
    and weights while exposing only the tailored surface region.
    """
    selected_vertices: set[int] = set()
    selected_polygons = 0
    for polygon in panel.data.polygons:
        center = panel.matrix_world @ polygon.center
        if predicate(center):
            selected_polygons += 1
            selected_vertices.update(polygon.vertices)
    if not selected_vertices or not selected_polygons:
        raise RuntimeError(f"Surface predicate selected no faces on {panel.name}")
    group = panel.vertex_groups.new(name="P10R3_TailoredSurface")
    group.add(sorted(selected_vertices), 1.0, "REPLACE")
    panel["p10_round003_selected_source_polygons"] = selected_polygons
    panel["p10_round003_selected_source_vertices"] = len(selected_vertices)
    return group.name


def make_surface_panel(
    source_name: str,
    panel_name: str,
    predicate,
    rig,
    armor_material,
    accent_material,
    thickness: float,
    shrink_offset: float,
    accent_predicate,
):
    source = bpy.data.objects[source_name]
    panel = source.copy()
    panel.data = source.data.copy()
    panel.name = panel_name
    panel.data.name = f"{panel_name}_Mesh"
    panel.animation_data_clear()
    panel.parent = None
    for modifier in list(panel.modifiers):
        panel.modifiers.remove(modifier)
    get_authored_collection().objects.link(panel)

    mask_group = mark_surface_mask(panel, predicate)
    panel.data.materials.clear()
    panel.data.materials.append(armor_material)
    panel.data.materials.append(accent_material)
    for polygon in panel.data.polygons:
        center = panel.matrix_world @ polygon.center
        polygon.material_index = 1 if accent_predicate(center) else 0

    mask = panel.modifiers.new("P10R3_TailoredSurfaceMask", "MASK")
    mask.vertex_group = mask_group
    mask.threshold = 0.5
    armature = panel.modifiers.new("P10R3_Armature", "ARMATURE")
    armature.object = rig
    armature.use_deform_preserve_volume = True
    shrink = panel.modifiers.new("P10R3_SourceSurfaceConform", "SHRINKWRAP")
    shrink.target = source
    shrink.wrap_method = "NEAREST_SURFACEPOINT"
    shrink.wrap_mode = "OUTSIDE_SURFACE"
    shrink.offset = shrink_offset
    solid = panel.modifiers.new("P10R3_TailoredThickness", "SOLIDIFY")
    solid.thickness = thickness
    solid.offset = 0.62
    # The selected fitted surfaces are intentionally open and non-manifold at
    # their tailored boundaries. Even-offset mode can project those boundary
    # corners to infinity; regular normal extrusion keeps a stable shell.
    solid.use_even_offset = False
    bevel = panel.modifiers.new("P10R3_EdgeFinish", "BEVEL")
    bevel.width = min(thickness * 0.42, 0.0045)
    bevel.segments = 2
    bevel.limit_method = "ANGLE"

    panel["p10_round003_derivation"] = (
        f"Duplicated fitted surface from {source_name}; face-filtered, "
        "armature-deformed, shrinkwrapped, solidified, and beveled."
    )
    return panel


def build_conforming_armor(rig, materials) -> list[object]:
    print("[P10:R3] Deriving fitted armor panels from Rain surfaces")
    panels = [
        make_surface_panel(
            "GEO-rain-top",
            "P10R3_Armor_Cuirass",
            lambda c: 0.885 <= c.z <= 1.285 and abs(c.x) <= 0.17,
            rig,
            materials["armor"],
            materials["accent"],
            thickness=0.011,
            shrink_offset=0.007,
            accent_predicate=lambda c: abs(c.x) < 0.022
            or c.z < 0.925
            or c.z > 1.245,
        ),
        make_surface_panel(
            "GEO-rain-body",
            "P10R3_Armor_ShoulderMantle",
            lambda c: 1.155 <= c.z <= 1.305 and 0.14 <= abs(c.x) <= 0.315,
            rig,
            materials["armor"],
            materials["accent"],
            thickness=0.013,
            shrink_offset=0.010,
            accent_predicate=lambda c: abs(c.x) > 0.265 or c.z > 1.272,
        ),
        make_surface_panel(
            "GEO-rain-jeans",
            "P10R3_Armor_HipTassets",
            lambda c: 0.68 <= c.z <= 0.91 and abs(c.x) >= 0.105,
            rig,
            materials["armor"],
            materials["accent"],
            thickness=0.010,
            shrink_offset=0.009,
            accent_predicate=lambda c: abs(c.x) > 0.148 or c.z < 0.715,
        ),
    ]
    AUDIT["armor_panels"] = {
        panel.name: {
            "source": panel.get("p10_round003_derivation"),
            "base_vertices": len(panel.data.vertices),
            "base_polygons": len(panel.data.polygons),
        }
        for panel in panels
    }
    return panels


def make_prism(
    name: str,
    profile: list[tuple[float, float]],
    depth: float,
    material,
    collection,
    bevel: float = 0.003,
):
    count = len(profile)
    vertices = [(x, -depth * 0.5, z) for x, z in profile]
    vertices.extend((x, depth * 0.5, z) for x, z in profile)
    faces = [tuple(range(count - 1, -1, -1)), tuple(range(count, count * 2))]
    for i in range(count):
        j = (i + 1) % count
        faces.append((i, j, count + j, count + i))
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.validate()
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.data.materials.append(material)
    bevel_mod = obj.modifiers.new("P10R3_PrecisionBevel", "BEVEL")
    bevel_mod.width = bevel
    bevel_mod.segments = 3
    bevel_mod.limit_method = "ANGLE"
    weighted = obj.modifiers.new("P10R3_WeightedNormals", "WEIGHTED_NORMAL")
    weighted.keep_sharp = True
    return obj


def add_cylinder(
    name: str,
    radius: float,
    depth: float,
    z: float,
    material,
    collection,
    vertices: int = 32,
):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=(0.0, 0.0, z),
    )
    obj = bpy.context.object
    obj.name = name
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    collection.objects.link(obj)
    obj.data.materials.append(material)
    bevel = obj.modifiers.new("P10R3_PrecisionBevel", "BEVEL")
    bevel.width = min(radius * 0.18, 0.004)
    bevel.segments = 3
    return obj


def build_greatblade(materials) -> tuple[object, list[object]]:
    print("[P10:R3] Authoring compact Aether Greatblade")
    collection = get_authored_collection()
    root = bpy.data.objects.new("P10R3_AetherGreatblade_ROOT", None)
    root.empty_display_type = "ARROWS"
    root.empty_display_size = 0.16
    collection.objects.link(root)

    blade_profile = [
        (-0.060, -0.255),
        (-0.103, -0.190),
        (-0.142, -0.025),
        (-0.164, 0.225),
        (-0.147, 0.475),
        (-0.102, 0.685),
        (0.000, 0.885),
        (0.092, 0.682),
        (0.148, 0.470),
        (0.169, 0.220),
        (0.146, -0.025),
        (0.102, -0.190),
        (0.060, -0.255),
    ]
    dark_inset_profile = [
        (-0.036, -0.205),
        (-0.079, -0.020),
        (-0.096, 0.225),
        (-0.078, 0.455),
        (-0.040, 0.640),
        (0.000, 0.755),
        (0.038, 0.635),
        (0.077, 0.450),
        (0.097, 0.220),
        (0.078, -0.015),
        (0.035, -0.205),
    ]
    core_profile = [
        (-0.014, -0.175),
        (-0.023, 0.040),
        (-0.020, 0.360),
        (0.000, 0.680),
        (0.020, 0.360),
        (0.023, 0.040),
        (0.014, -0.175),
    ]
    guard_profile = [
        (-0.220, -0.288),
        (-0.180, -0.257),
        (-0.076, -0.240),
        (-0.046, -0.278),
        (0.046, -0.278),
        (0.076, -0.240),
        (0.180, -0.257),
        (0.220, -0.288),
        (0.176, -0.316),
        (0.066, -0.309),
        (0.038, -0.286),
        (-0.038, -0.286),
        (-0.066, -0.309),
        (-0.176, -0.316),
    ]
    pommel_profile = [
        (-0.055, -0.585),
        (-0.075, -0.548),
        (-0.045, -0.515),
        (0.045, -0.515),
        (0.075, -0.548),
        (0.055, -0.585),
        (0.000, -0.628),
    ]

    objects = [
        make_prism(
            "P10R3_Greatblade_Blade",
            blade_profile,
            0.034,
            materials["steel"],
            collection,
            bevel=0.0042,
        ),
        make_prism(
            "P10R3_Greatblade_ObsidianInset",
            dark_inset_profile,
            0.042,
            materials["blade_dark"],
            collection,
            bevel=0.0026,
        ),
        make_prism(
            "P10R3_Greatblade_AetherChannel",
            core_profile,
            0.047,
            materials["glow"],
            collection,
            bevel=0.0018,
        ),
        make_prism(
            "P10R3_Greatblade_Guard",
            guard_profile,
            0.065,
            materials["armor"],
            collection,
            bevel=0.005,
        ),
        make_prism(
            "P10R3_Greatblade_Pommel",
            pommel_profile,
            0.060,
            materials["accent"],
            collection,
            bevel=0.004,
        ),
        add_cylinder(
            "P10R3_Greatblade_Grip",
            0.028,
            0.225,
            -0.4075,
            materials["leather"],
            collection,
            vertices=32,
        ),
    ]

    for z, radius in ((-0.325, 0.038), (-0.490, 0.035)):
        ring = add_cylinder(
            f"P10R3_Greatblade_GripRing_{abs(int(z * 1000))}",
            radius,
            0.018,
            z,
            materials["accent"],
            collection,
            vertices=32,
        )
        objects.append(ring)

    # The cylinder primitive is Z-aligned, matching the authored blade axis.
    for obj in objects:
        obj.parent = root
        obj.matrix_parent_inverse = Matrix.Identity(4)
        obj["p10_round003_authored"] = True

    root["p10_round003_total_length_m"] = 1.210
    root["p10_round003_grip_local_z_min"] = -0.502
    root["p10_round003_grip_local_z_max"] = -0.313
    AUDIT["greatblade"] = {
        "authored_geometry_length_m": 1.513,
        "delivered_total_length_m": 1.210,
        "delivered_grip_length_m": 0.151,
        "authored_mesh_count": len(objects),
        "primitive_torso_parts": 0,
    }
    return root, objects


def reset_pose(rig) -> None:
    bpy.context.scene.frame_set(1)
    for bone in rig.pose.bones:
        bone.matrix_basis.identity()
    properties = rig.pose.bones.get("Properties_IKFK")
    if properties:
        for key, value in (
            ("ik_spine", 1.0),
            ("ik_arm_left", 1.0),
            ("ik_arm_right", 1.0),
            ("ik_leg_left", 1.0),
            ("ik_leg_right", 1.0),
            ("ik_fingers_left", 0.0),
            ("ik_fingers_right", 0.0),
        ):
            if key in properties:
                properties[key] = value
    bpy.context.view_layer.update()


def set_control_location(rig, name: str, location: Vector) -> None:
    bone = rig.pose.bones.get(name)
    if bone is None:
        raise RuntimeError(f"Missing CloudRig control: {name}")
    rotation = bone.matrix.to_3x3().to_4x4()
    bone.matrix = Matrix.Translation(location) @ rotation
    bpy.context.view_layer.update()


def set_control_axes(
    rig,
    name: str,
    location: Vector,
    y_axis: Vector,
    z_axis: Vector,
) -> None:
    """Place a hand control with explicit orthonormal palm axes."""
    y_axis = y_axis.normalized()
    z_axis = (z_axis - y_axis * z_axis.dot(y_axis)).normalized()
    x_axis = y_axis.cross(z_axis).normalized()
    matrix = Matrix(
        (
            (x_axis.x, y_axis.x, z_axis.x, location.x),
            (x_axis.y, y_axis.y, z_axis.y, location.y),
            (x_axis.z, y_axis.z, z_axis.z, location.z),
            (0.0, 0.0, 0.0, 1.0),
        )
    )
    bone = rig.pose.bones.get(name)
    if bone is None:
        raise RuntimeError(f"Missing CloudRig control: {name}")
    bone.matrix = matrix
    bpy.context.view_layer.update()


def rotate_control_local(rig, name: str, radians_value: float, axis: str = "X") -> None:
    bone = rig.pose.bones.get(name)
    if bone is None:
        return
    bone.matrix_basis = bone.matrix_basis @ Matrix.Rotation(radians_value, 4, axis)


def rotate_control_world(
    rig,
    name: str,
    z_radians: float = 0.0,
    x_radians: float = 0.0,
) -> None:
    bone = rig.pose.bones.get(name)
    if bone is None:
        raise RuntimeError(f"Missing CloudRig control: {name}")
    location = bone.matrix.translation.copy()
    rotation = bone.matrix.to_3x3().to_4x4()
    bone.matrix = (
        Matrix.Translation(location)
        @ Matrix.Rotation(z_radians, 4, "Z")
        @ Matrix.Rotation(x_radians, 4, "X")
        @ rotation
    )
    bpy.context.view_layer.update()


def curl_fingers(rig, side: str, amount: float) -> None:
    suffix = ".L" if side == "L" else ".R"
    sign = -1.0 if side == "L" else 1.0
    for digit in ("Index", "Middle", "Ring", "Pinky"):
        for segment, factor in ((1, 0.72), (2, 1.0), (3, 0.88)):
            rotate_control_local(
                rig,
                f"FK-{digit}{segment}{suffix}",
                sign * amount * factor,
                "X",
            )
    for segment, factor in ((1, 0.35), (2, 0.48), (3, 0.42)):
        rotate_control_local(
            rig,
            f"FK-Thumb{segment}{suffix}",
            -sign * amount * factor,
            "Y",
        )
    bpy.context.view_layer.update()


def set_neutral_pose(rig, blade_root) -> None:
    reset_pose(rig)
    set_control_location(rig, "IK-Hand.L", Vector((0.220, -0.035, 0.840)))
    set_control_location(rig, "IK-Hand.R", Vector((-0.220, -0.035, 0.840)))
    set_control_location(rig, "IK-Pole-Forearm.L", Vector((0.38, 0.30, 1.00)))
    set_control_location(rig, "IK-Pole-Forearm.R", Vector((-0.38, 0.30, 1.00)))
    set_control_location(rig, "IK-Foot.L", Vector((0.082, -0.025, 0.077)))
    set_control_location(rig, "IK-Foot.R", Vector((-0.082, 0.018, 0.077)))
    curl_fingers(rig, "L", math.radians(16.0))
    curl_fingers(rig, "R", math.radians(16.0))
    blade_root.matrix_world = (
        Matrix.Translation(Vector((-0.180, 0.135, 0.700)))
        @ Matrix.Rotation(math.radians(-8.0), 4, "Y")
        @ Matrix.Rotation(math.radians(2.5), 4, "X")
        @ Matrix.Diagonal((*BLADE_SCALE, 1.0))
    )
    bpy.context.view_layer.update()


def set_combat_pose(rig, blade_root) -> dict[str, Vector]:
    reset_pose(rig)
    blade_root.matrix_world = (
        Matrix.Translation(Vector((-0.280, -0.170, 1.250)))
        @ Matrix.Rotation(math.radians(-34.0), 4, "Y")
        @ Matrix.Rotation(math.radians(-3.0), 4, "X")
        @ Matrix.Diagonal((*BLADE_SCALE, 1.0))
    )
    upper_grip = blade_root.matrix_world @ Vector((0.0, 0.0, -0.340))
    lower_grip = blade_root.matrix_world @ Vector((0.0, 0.0, -0.485))
    blade_axis = (
        blade_root.matrix_world.to_3x3() @ Vector((0.0, 0.0, 1.0))
    ).normalized()
    grip_side = Vector((blade_axis.z, 0.0, -blade_axis.x)).normalized()
    set_control_axes(
        rig,
        "IK-Hand.L",
        upper_grip + grip_side * 0.072 + Vector((0.0, -0.004, 0.0)),
        -grip_side,
        Vector((0.0, -1.0, 0.0)),
    )
    set_control_axes(
        rig,
        "IK-Hand.R",
        lower_grip - grip_side * 0.072 + Vector((0.0, -0.004, 0.0)),
        grip_side,
        Vector((0.0, -1.0, 0.0)),
    )
    set_control_location(rig, "IK-Pole-Forearm.L", Vector((0.47, 0.13, 1.18)))
    set_control_location(rig, "IK-Pole-Forearm.R", Vector((-0.45, 0.17, 1.04)))
    set_control_location(rig, "MSTR-Pelvis", Vector((0.0, -0.050, 0.820)))
    rotate_control_world(
        rig,
        "MSTR-Pelvis",
        z_radians=math.radians(-7.0),
        x_radians=math.radians(2.0),
    )
    rotate_control_world(
        rig,
        "MSTR-Chest",
        z_radians=math.radians(10.0),
        x_radians=math.radians(5.0),
    )
    set_control_location(rig, "IK-Foot.L", Vector((0.190, -0.120, 0.077)))
    set_control_location(rig, "IK-Foot.R", Vector((-0.180, 0.160, 0.077)))
    set_control_location(rig, "IK-Pole-Shin.L", Vector((0.15, -0.52, 0.43)))
    set_control_location(rig, "IK-Pole-Shin.R", Vector((-0.13, -0.37, 0.43)))
    curl_fingers(rig, "L", math.radians(100.0))
    curl_fingers(rig, "R", math.radians(100.0))
    bpy.context.view_layer.update()
    return {"upper_grip": upper_grip, "lower_grip": lower_grip}


def evaluated_tri_count(obj) -> int:
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    mesh.calc_loop_triangles()
    count = len(mesh.loop_triangles)
    evaluated.to_mesh_clear()
    return count


def snapshot_objects(objects: list[object], label: str) -> list[object]:
    depsgraph = bpy.context.evaluated_depsgraph_get()
    collection = bpy.data.collections.new(f"P10R3_EXPORT_{label}")
    bpy.context.scene.collection.children.link(collection)
    collection.hide_render = True
    copies = []
    for source in sorted(objects, key=lambda obj: obj.name):
        if source.type != "MESH":
            continue
        evaluated = source.evaluated_get(depsgraph)
        mesh = bpy.data.meshes.new_from_object(
            evaluated,
            preserve_all_data_layers=True,
            depsgraph=depsgraph,
        )
        copy = bpy.data.objects.new(f"{label}_{source.name}", mesh)
        copy.matrix_world = source.matrix_world.copy()
        copy.hide_render = True
        copy["p10_round003_static_snapshot_of"] = source.name
        collection.objects.link(copy)
        copies.append(copy)
    return copies


def clone_lod(source_objects: list[object], label: str, ratio: float) -> list[object]:
    collection = bpy.data.collections.new(f"P10R3_EXPORT_{label}")
    bpy.context.scene.collection.children.link(collection)
    collection.hide_render = True
    copies = []
    for source in source_objects:
        copy = source.copy()
        copy.data = source.data.copy()
        copy.name = source.name.replace("NEUTRAL", label)
        for owner in list(copy.users_collection):
            owner.objects.unlink(copy)
        collection.objects.link(copy)
        if ratio < 0.999 and len(copy.data.polygons) > 80:
            decimate = copy.modifiers.new(f"P10R3_{label}_Decimate", "DECIMATE")
            decimate.decimate_type = "COLLAPSE"
            decimate.ratio = ratio
            decimate.use_collapse_triangulate = True
        copies.append(copy)
    return copies


def select_only(objects: list[object]) -> None:
    # FBX's armature path may leave the headless context reporting POSE mode.
    # Direct RNA selection is context-independent and therefore deterministic.
    for scene_object in bpy.context.scene.objects:
        try:
            scene_object.select_set(False)
        except RuntimeError:
            pass
    for obj in objects:
        obj.hide_set(False)
        obj.select_set(True)
    if objects:
        bpy.context.view_layer.objects.active = objects[0]


def export_static_fbx(path: Path, objects: list[object]) -> None:
    select_only(objects)
    bpy.ops.export_scene.fbx(
        filepath=str(path),
        use_selection=True,
        object_types={"MESH"},
        global_scale=1.0,
        apply_unit_scale=True,
        apply_scale_options="FBX_SCALE_NONE",
        use_space_transform=True,
        bake_space_transform=False,
        use_mesh_modifiers=True,
        mesh_smooth_type="FACE",
        use_subsurf=False,
        use_mesh_edges=False,
        use_tspace=True,
        use_triangles=True,
        add_leaf_bones=False,
        bake_anim=False,
        path_mode="AUTO",
        embed_textures=False,
        axis_forward="-Z",
        axis_up="Y",
    )
    if not path.is_file() or path.stat().st_size < 1024:
        raise RuntimeError(f"FBX export failed or is empty: {path}")


def source_influence_audit(rig, meshes: list[object]) -> dict[str, object]:
    deform_names = {bone.name for bone in rig.data.bones if bone.use_deform}
    per_mesh = {}
    total_over_four = 0
    global_max = 0
    for obj in meshes:
        group_names = {group.index: group.name for group in obj.vertex_groups}
        over_four = 0
        local_max = 0
        for vertex in obj.data.vertices:
            influences = sum(
                1
                for group in vertex.groups
                if group.weight > 0.0001
                and group_names.get(group.group) in deform_names
            )
            local_max = max(local_max, influences)
            if influences > 4:
                over_four += 1
        if over_four or local_max:
            per_mesh[obj.name] = {
                "vertices": len(obj.data.vertices),
                "max_deform_influences": local_max,
                "vertices_over_four": over_four,
            }
        total_over_four += over_four
        global_max = max(global_max, local_max)
    return {
        "deform_bones": len(deform_names),
        "max_deform_influences": global_max,
        "vertices_over_four": total_over_four,
        "per_mesh": per_mesh,
        "playable_four_weight_claim": False,
    }


def export_rig_proof(path: Path, rig, meshes: list[object]) -> None:
    selection = [rig, *meshes]
    select_only(selection)
    bpy.ops.export_scene.fbx(
        filepath=str(path),
        use_selection=True,
        object_types={"ARMATURE", "MESH"},
        global_scale=1.0,
        apply_unit_scale=True,
        apply_scale_options="FBX_SCALE_NONE",
        use_space_transform=True,
        bake_space_transform=False,
        use_mesh_modifiers=True,
        mesh_smooth_type="FACE",
        use_subsurf=False,
        use_mesh_edges=False,
        use_tspace=True,
        use_triangles=True,
        add_leaf_bones=False,
        use_armature_deform_only=True,
        bake_anim=False,
        path_mode="AUTO",
        embed_textures=False,
        axis_forward="-Z",
        axis_up="Y",
    )
    if not path.is_file() or path.stat().st_size < 1024:
        raise RuntimeError(f"Rig proof export failed or is empty: {path}")


def delete_objects(objects: list[object]) -> None:
    for obj in objects:
        mesh = obj.data if obj.type == "MESH" else None
        bpy.data.objects.remove(obj, do_unlink=True)
        if mesh and mesh.users == 0:
            bpy.data.meshes.remove(mesh)


def setup_stage(materials):
    print("[P10:R3] Building neutral diagnostic stage")
    for obj in list(bpy.data.objects):
        if obj.type in {"LIGHT", "CAMERA"}:
            bpy.data.objects.remove(obj, do_unlink=True)

    stage_collection = bpy.data.collections.new("P10_Round003_STAGE")
    bpy.context.scene.collection.children.link(stage_collection)

    floor_material = material_principled(
        "P10R3_Stage_Floor",
        (0.012, 0.022, 0.032),
        0.18,
        0.31,
        noise_scale=9.0,
    )
    bpy.ops.mesh.primitive_plane_add(size=20.0, location=(0.0, 0.0, -0.001))
    floor = bpy.context.object
    floor.name = "P10R3_STAGE_Floor"
    for collection in list(floor.users_collection):
        collection.objects.unlink(floor)
    stage_collection.objects.link(floor)
    floor.data.materials.append(floor_material)

    def add_area(name, location, energy, color, size):
        data = bpy.data.lights.new(name, "AREA")
        data.energy = energy
        data.color = color
        data.shape = "DISK"
        data.size = size
        obj = bpy.data.objects.new(name, data)
        stage_collection.objects.link(obj)
        obj.location = location
        look_at(obj, Vector((0.0, 0.0, 1.0)))
        return obj

    add_area(
        "P10R3_STAGE_Key",
        Vector((2.7, -3.3, 3.5)),
        720.0,
        (0.86, 0.94, 1.0),
        2.5,
    )
    add_area(
        "P10R3_STAGE_Rim",
        Vector((-2.5, 1.65, 3.15)),
        860.0,
        (0.08, 0.52, 1.0),
        2.0,
    )
    add_area(
        "P10R3_STAGE_Fill",
        Vector((-1.8, -2.6, 1.55)),
        330.0,
        (0.36, 0.55, 0.76),
        2.2,
    )
    add_area(
        "P10R3_STAGE_Top",
        Vector((0.0, 0.2, 4.4)),
        520.0,
        (0.60, 0.78, 1.0),
        1.8,
    )

    camera_data = bpy.data.cameras.new("P10R3_STAGE_Camera")
    camera = bpy.data.objects.new("P10R3_STAGE_Camera", camera_data)
    stage_collection.objects.link(camera)
    bpy.context.scene.camera = camera

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = RENDER_SIZE
    scene.render.resolution_y = RENDER_SIZE
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = False
    scene.render.use_file_extension = True
    scene.render.image_settings.color_depth = "8"
    scene.render.fps = 30
    scene.render.resolution_percentage = 100

    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    if background:
        background.inputs["Color"].default_value = (0.004, 0.009, 0.018, 1.0)
        background.inputs["Strength"].default_value = 0.16

    scene.view_settings.look = "Medium High Contrast"
    scene.view_settings.exposure = -0.18
    scene.view_settings.gamma = 1.0
    return camera


def look_at(obj, target: Vector) -> None:
    direction = target - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def place_camera(camera, location, target, lens):
    camera.location = Vector(location)
    camera.data.lens = lens
    camera.data.sensor_width = 36.0
    look_at(camera, Vector(target))
    bpy.context.view_layer.update()


def render_view(key: str, camera, location, target, lens) -> None:
    output = DIAGNOSTICS[key]
    place_camera(camera, location, target, lens)
    bpy.context.scene.render.filepath = str(output)
    print(f"[P10:R3] Rendering {key}: {output.name}")
    bpy.ops.render.render(write_still=True)
    if not output.is_file() or output.stat().st_size < 1024:
        raise RuntimeError(f"Diagnostic render failed: {output}")


def relink_authored_blend_textures() -> None:
    source_names = {path.name for path in SOURCE_TEXTURES.iterdir() if path.is_file()}
    for image in bpy.data.images:
        filename = Path(image.filepath).name
        probe = filename.replace("<UDIM>", "1001")
        if filename in source_names or probe in source_names:
            image.filepath = f"//ThirdParty/BlenderStudioRain/textures/{filename}"


def write_audit() -> None:
    output_hashes = {}
    for key, path in {**OUTPUT_FILES, **DIAGNOSTICS}.items():
        if path.is_file():
            output_hashes[key] = {
                "path": str(path.relative_to(ROOT)),
                "sha256": sha256(path),
                "bytes": path.stat().st_size,
            }
    if AUTHORED_BLEND.is_file():
        output_hashes["authored_blend"] = {
            "path": str(AUTHORED_BLEND.relative_to(ROOT)),
            "sha256": sha256(AUTHORED_BLEND),
            "bytes": AUTHORED_BLEND.stat().st_size,
        }
    AUDIT["outputs"] = output_hashes
    audit_path = PREFLIGHT / "P10_Round003_Audit.json"
    audit_path.write_text(
        json.dumps(AUDIT, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(f"[P10:R3] Wrote {audit_path}")


def run() -> None:
    ensure_directories()
    verify_and_stage_sources()
    open_source()
    fixed_fbx_clock()

    rig = bpy.data.objects["RIG-rain"]
    apply_warrior_palette()
    materials = authored_materials()
    armor = build_conforming_armor(rig, materials)
    blade_root, blade_meshes = build_greatblade(materials)
    camera = setup_stage(materials)
    live_meshes = [bpy.data.objects[name] for name in SOURCE_MESH_NAMES]
    presentation_meshes = [*live_meshes, *armor, *blade_meshes]

    AUDIT["native_visible_triangles_before_authorship"] = sum(
        evaluated_tri_count(obj) for obj in live_meshes
    )
    AUDIT["authored_armor_triangles"] = sum(
        evaluated_tri_count(obj) for obj in armor
    )
    AUDIT["authored_weapon_triangles"] = sum(
        evaluated_tri_count(obj) for obj in blade_meshes
    )

    set_neutral_pose(rig, blade_root)
    render_view(
        "front",
        camera,
        (0.0, -3.65, 1.03),
        (0.0, 0.0, 0.88),
        68.0,
    )
    render_view(
        "three_quarter",
        camera,
        (2.75, -3.20, 1.28),
        (0.0, 0.0, 0.90),
        72.0,
    )
    render_view(
        "back",
        camera,
        (0.0, 3.72, 1.08),
        (0.0, 0.0, 0.88),
        68.0,
    )
    render_view(
        "profile",
        camera,
        (3.72, 0.0, 1.08),
        (0.0, 0.0, 0.88),
        68.0,
    )
    render_view(
        "face",
        camera,
        (0.0, -1.23, 1.49),
        (0.0, -0.020, 1.48),
        92.0,
    )
    render_view(
        "hands",
        camera,
        (0.0, -2.45, 0.95),
        (0.0, -0.015, 0.80),
        90.0,
    )
    render_view(
        "feet",
        camera,
        (0.0, -1.40, 0.15),
        (0.0, 0.0, 0.12),
        96.0,
    )

    neutral_snapshot = snapshot_objects(presentation_meshes, "NEUTRAL")
    neutral_tris = sum(evaluated_tri_count(obj) for obj in neutral_snapshot)
    export_static_fbx(OUTPUT_FILES["neutral"], neutral_snapshot)
    export_static_fbx(OUTPUT_FILES["lod0"], neutral_snapshot)
    lod1 = clone_lod(neutral_snapshot, "LOD1", 0.52)
    lod2 = clone_lod(neutral_snapshot, "LOD2", 0.245)
    lod1_tris = sum(evaluated_tri_count(obj) for obj in lod1)
    lod2_tris = sum(evaluated_tri_count(obj) for obj in lod2)
    export_static_fbx(OUTPUT_FILES["lod1"], lod1)
    export_static_fbx(OUTPUT_FILES["lod2"], lod2)

    rig_audit = source_influence_audit(rig, [*live_meshes, *armor])
    AUDIT["cloudrig_deform_only_proof"] = rig_audit
    export_rig_proof(OUTPUT_FILES["rig_proof"], rig, [*live_meshes, *armor])

    grip = set_combat_pose(rig, blade_root)
    render_view(
        "combat",
        camera,
        (2.25, -2.85, 1.12),
        (-0.08, -0.04, 0.96),
        55.0,
    )
    grip_center = (grip["upper_grip"] + grip["lower_grip"]) * 0.5
    render_view(
        "grip",
        camera,
        (grip_center.x + 0.18, grip_center.y - 1.04, grip_center.z + 0.06),
        grip_center,
        100.0,
    )
    combat_snapshot = snapshot_objects(presentation_meshes, "COMBAT")
    combat_tris = sum(evaluated_tri_count(obj) for obj in combat_snapshot)
    export_static_fbx(OUTPUT_FILES["combat"], combat_snapshot)

    hand_l = rig.pose.bones["DEF-Hand.L"].matrix.translation
    hand_r = rig.pose.bones["DEF-Hand.R"].matrix.translation
    AUDIT["combat_grip"] = {
        "upper_grip": [round(value, 6) for value in grip["upper_grip"]],
        "lower_grip": [round(value, 6) for value in grip["lower_grip"]],
        "def_hand_left": [round(value, 6) for value in hand_l],
        "def_hand_right": [round(value, 6) for value in hand_r],
        "left_distance_to_upper_m": round((hand_l - grip["upper_grip"]).length, 6),
        "right_distance_to_lower_m": round((hand_r - grip["lower_grip"]).length, 6),
    }
    AUDIT["presentation_triangles"] = {
        "neutral": neutral_tris,
        "combat": combat_tris,
        "lod0": neutral_tris,
        "lod1": lod1_tris,
        "lod2": lod2_tris,
    }

    delete_objects([*combat_snapshot, *lod2, *lod1, *neutral_snapshot])
    set_neutral_pose(rig, blade_root)
    relink_authored_blend_textures()
    bpy.ops.wm.save_as_mainfile(
        filepath=str(AUTHORED_BLEND),
        check_existing=False,
        relative_remap=False,
    )
    write_audit()
    print("[P10:R3] Round003 pipeline complete")


if __name__ == "__main__":
    try:
        run()
    except Exception as exc:
        print(f"[P10:R3] FATAL: {exc}", file=sys.stderr)
        raise
