#!/usr/bin/env python3
"""P10 Round004 — premium warrior costume rebuild over Blender Studio Rain.

The exact CC-BY Rain source is retained as the anatomical, face, hand, foot,
UV, material, and rig foundation. Rain's civilian top, scarf, jeans, and
sneakers are excluded from every Round004 render and export. This script
authors a new head-to-toe costume using fitted source underlayers plus clean
continuous lofts, curved panels, trim, stitching, hardware, boots, greaves,
bracers, thigh armor, coat tails, and a functional back harness.

Round004 is deliberately a static presentation delivery. It does not claim a
playable production rig or Unity integration.
"""

from __future__ import annotations

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
ROUND_ROOT = ROOT / "ArtSource" / "P10" / "Round004"
VENDOR_ROOT = ROUND_ROOT / "ThirdParty" / "BlenderStudioRain"
SOURCE_BLEND = VENDOR_ROOT / "rain_v3.2.blend"
SOURCE_TEXTURES = VENDOR_ROOT / "textures"
SOURCE_LICENSE = VENDOR_ROOT / "LICENSE-CC-BY-4.0.txt"
PREFLIGHT = ROUND_ROOT / "Preflight"
AUTHORED_BLEND = ROUND_ROOT / "P10_Round004_AstraValeWarrior.blend"
GAME_ROOT = ROOT / "game" / "Assets" / "CodexOfWar" / "Heroes" / "P10" / "Round004"
MODEL_OUT = GAME_ROOT / "Models"
TEXTURE_OUT = GAME_ROOT / "Textures"

RANDOM_SEED = 1004
RENDER_SIZE = 1600
FIXED_TIME = _datetime.datetime(2026, 7, 31, 14, 0, 0)
LOD0_MAX_TRIS = 90000
LOD0_TARGET_TRIS = 88000

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

VISIBLE_SOURCE = (
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
    "GEO-rain-tongue",
)

CIVILIAN_SOURCE = (
    "GEO-rain-top",
    "GEO-rain-scarf",
    "GEO-rain-jeans",
    "GEO-rain-shoes",
)

FBX_OUTPUTS = {
    "neutral_fbx": MODEL_OUT / "P10_AstraVale_Round004_Neutral.fbx",
    "combat_fbx": MODEL_OUT / "P10_AstraVale_Round004_Combat.fbx",
    "lod0_fbx": MODEL_OUT / "P10_AstraVale_Round004_LOD0.fbx",
    "lod1_fbx": MODEL_OUT / "P10_AstraVale_Round004_LOD1.fbx",
    "lod2_fbx": MODEL_OUT / "P10_AstraVale_Round004_LOD2.fbx",
}

PNG_OUTPUTS = {
    "front_png": PREFLIGHT / "P10_Round004_Front.png",
    "three_quarter_png": PREFLIGHT / "P10_Round004_ThreeQuarter.png",
    "back_png": PREFLIGHT / "P10_Round004_Back.png",
    "profile_png": PREFLIGHT / "P10_Round004_Profile.png",
    "face_png": PREFLIGHT / "P10_Round004_Face.png",
    "hands_png": PREFLIGHT / "P10_Round004_Hands.png",
    "feet_png": PREFLIGHT / "P10_Round004_Feet.png",
    "combat_png": PREFLIGHT / "P10_Round004_Combat.png",
    "grip_png": PREFLIGHT / "P10_Round004_Grip.png",
}

AUDIT: dict[str, object] = {
    "pipeline": "P10_Round004_AstraValeWarrior",
    "seed": RANDOM_SEED,
    "license": "CC BY 4.0",
    "required_credit": "Rain Rig (CC) Blender Foundation | studio.blender.org",
    "scope": (
        "Static premium-costume visual proof; no playable rig, animation-set, "
        "Unity, or four-weight delivery claim."
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
    resolved = {}
    for relative, expected in EXPECTED_HASHES.items():
        path = VENDOR_ROOT / relative
        if not path.is_file():
            raise FileNotFoundError(f"Missing exact Round004 input: {path}")
        actual = sha256(path)
        if actual != expected:
            raise RuntimeError(
                f"Hash mismatch for {relative}: expected {expected}, got {actual}"
            )
        resolved[relative] = actual
    for source in sorted(SOURCE_TEXTURES.iterdir()):
        if source.is_file():
            destination = TEXTURE_OUT / source.name
            shutil.copy2(source, destination)
            if sha256(source) != sha256(destination):
                raise RuntimeError(f"Texture staging mismatch: {source.name}")
    AUDIT["verified_source_hashes"] = resolved
    AUDIT["staged_texture_count"] = len(list(TEXTURE_OUT.glob("*")))


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
    random.seed(RANDOM_SEED)
    bpy.context.scene.frame_set(1)
    required = [*VISIBLE_SOURCE, *CIVILIAN_SOURCE, "RIG-rain"]
    missing = [name for name in required if name not in bpy.data.objects]
    if missing:
        raise RuntimeError(f"Rain source missing required objects: {missing}")
    for name in VISIBLE_SOURCE:
        obj = bpy.data.objects[name]
        obj.hide_render = False
        obj.hide_set(False)
    for name in CIVILIAN_SOURCE:
        obj = bpy.data.objects[name]
        obj.hide_render = True
        obj.hide_set(True)
        obj["p10_round004_excluded_civilian_source"] = True
    for obj in bpy.data.objects:
        if obj.name.startswith("WGT-") or obj.name.startswith("cloud_"):
            obj.hide_render = True
        if obj.type in {"ARMATURE", "LATTICE"}:
            obj.hide_render = True
    rig = bpy.data.objects["RIG-rain"]
    AUDIT["source_total_bones"] = len(rig.data.bones)
    AUDIT["source_deform_bones"] = sum(
        1 for bone in rig.data.bones if bone.use_deform
    )
    AUDIT["excluded_civilian_objects"] = list(CIVILIAN_SOURCE)


def authored_collection():
    collection = bpy.data.collections.get("P10_Round004_AUTHORED")
    if collection is None:
        collection = bpy.data.collections.new("P10_Round004_AUTHORED")
        bpy.context.scene.collection.children.link(collection)
    return collection


def principled_socket(node, *names):
    for name in names:
        socket = node.inputs.get(name)
        if socket is not None:
            return socket
    return None


def color4(rgb):
    return (*rgb, 1.0)


def make_surface_material(
    name: str,
    base: tuple[float, float, float],
    metallic: float,
    roughness: float,
    *,
    noise_scale: float = 0.0,
    noise_strength: float = 0.08,
    bump_strength: float = 0.0,
    emission: tuple[float, float, float] | None = None,
    emission_strength: float = 0.0,
):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material["p10_round004_authored"] = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    coat = principled_socket(shader, "Coat Weight", "Coat")
    if coat is not None:
        coat.default_value = 0.12 if metallic < 0.5 else 0.22

    if noise_scale > 0.0:
        noise = nodes.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value = noise_scale
        noise.inputs["Detail"].default_value = 3.0
        noise.inputs["Roughness"].default_value = 0.55
        ramp = nodes.new("ShaderNodeValToRGB")
        lo = max(0.0, 1.0 - noise_strength)
        hi = 1.0 + noise_strength
        ramp.color_ramp.elements[0].position = 0.25
        ramp.color_ramp.elements[0].color = color4(
            tuple(component * lo for component in base)
        )
        ramp.color_ramp.elements[1].position = 0.78
        ramp.color_ramp.elements[1].color = color4(
            tuple(min(component * hi, 1.0) for component in base)
        )
        links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
        links.new(ramp.outputs["Color"], shader.inputs["Base Color"])
        if bump_strength > 0.0:
            bump = nodes.new("ShaderNodeBump")
            bump.inputs["Strength"].default_value = bump_strength
            bump.inputs["Distance"].default_value = 0.006
            links.new(noise.outputs["Fac"], bump.inputs["Height"])
            links.new(bump.outputs["Normal"], shader.inputs["Normal"])
    else:
        shader.inputs["Base Color"].default_value = color4(base)

    if emission is not None:
        emission_socket = principled_socket(shader, "Emission Color", "Emission")
        if emission_socket is not None:
            emission_socket.default_value = color4(emission)
        strength = principled_socket(shader, "Emission Strength")
        if strength is not None:
            strength.default_value = emission_strength
    links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    return material


def build_materials() -> dict[str, object]:
    materials = {
        "ivory_cloth": make_surface_material(
            "P10R4_Cloth_WarmIvory",
            (0.26, 0.20, 0.13),
            0.0,
            0.72,
            noise_scale=120.0,
            noise_strength=0.055,
            bump_strength=0.10,
        ),
        "charcoal_cloth": make_surface_material(
            "P10R4_Cloth_Charcoal",
            (0.022, 0.028, 0.032),
            0.0,
            0.68,
            noise_scale=105.0,
            noise_strength=0.09,
            bump_strength=0.11,
        ),
        "obsidian_leather": make_surface_material(
            "P10R4_Leather_Obsidian",
            (0.022, 0.018, 0.015),
            0.02,
            0.43,
            noise_scale=22.0,
            noise_strength=0.13,
            bump_strength=0.10,
        ),
        "brown_leather": make_surface_material(
            "P10R4_Leather_Oxblood",
            (0.040, 0.012, 0.007),
            0.01,
            0.48,
            noise_scale=18.0,
            noise_strength=0.15,
            bump_strength=0.11,
        ),
        "muted_steel": make_surface_material(
            "P10R4_Metal_MutedSteel",
            (0.070, 0.082, 0.088),
            0.72,
            0.48,
            noise_scale=42.0,
            noise_strength=0.12,
            bump_strength=0.035,
        ),
        "dark_steel": make_surface_material(
            "P10R4_Metal_BlackenedSteel",
            (0.018, 0.026, 0.030),
            0.66,
            0.51,
            noise_scale=38.0,
            noise_strength=0.12,
            bump_strength=0.04,
        ),
        "aged_bronze": make_surface_material(
            "P10R4_Metal_AgedBronze",
            (0.19, 0.095, 0.035),
            0.70,
            0.38,
            noise_scale=31.0,
            noise_strength=0.13,
            bump_strength=0.04,
        ),
        "teal_enamel": make_surface_material(
            "P10R4_Enamel_MutedAether",
            (0.012, 0.075, 0.082),
            0.16,
            0.44,
            noise_scale=28.0,
            noise_strength=0.055,
            bump_strength=0.025,
        ),
        "aether": make_surface_material(
            "P10R4_Emission_Aether",
            (0.01, 0.22, 0.24),
            0.12,
            0.34,
            emission=(0.008, 0.25, 0.28),
            emission_strength=1.25,
        ),
        "thread": make_surface_material(
            "P10R4_Thread_Ivory",
            (0.42, 0.31, 0.20),
            0.0,
            0.76,
        ),
        "sole": make_surface_material(
            "P10R4_Boot_Sole",
            (0.008, 0.010, 0.011),
            0.0,
            0.58,
            noise_scale=35.0,
            noise_strength=0.12,
            bump_strength=0.09,
        ),
    }
    AUDIT["authored_materials"] = sorted(material.name for material in materials.values())
    return materials


def tint_source_material(source_name, result_name, tint, amount, blend_type):
    source = bpy.data.materials.get(source_name)
    if source is None:
        return None
    material = source.copy()
    material.name = result_name
    material["p10_round004_source_material"] = source_name
    if not material.use_nodes:
        return material
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    for index, shader in enumerate(
        node for node in nodes if node.type == "BSDF_PRINCIPLED"
    ):
        base = principled_socket(shader, "Base Color")
        if base is None:
            continue
        if base.is_linked:
            original = base.links[0]
            mix = nodes.new("ShaderNodeMixRGB")
            mix.name = f"P10R4_Tint_{index:02d}"
            mix.blend_type = blend_type
            mix.inputs[0].default_value = amount
            mix.inputs[2].default_value = color4(tint)
            from_socket = original.from_socket
            links.remove(original)
            links.new(from_socket, mix.inputs[1])
            links.new(mix.outputs[0], base)
        else:
            current = tuple(base.default_value[:3])
            base.default_value = color4(
                tuple(
                    current[i] * (1.0 - amount) + tint[i] * amount
                    for i in range(3)
                )
            )
    return material


def apply_face_hair_palette() -> None:
    replacements = {}
    recipes = (
        ("MAT-rain.hair", "P10R4_Hair_BlueBlack", (0.035, 0.08, 0.12), 0.82, "MULTIPLY"),
        ("MAT-rain.eyebrows", "P10R4_Brows_BlueBlack", (0.025, 0.06, 0.09), 0.82, "MULTIPLY"),
        ("MAT-rain.eyelashes", "P10R4_Lashes", (0.01, 0.02, 0.025), 0.9, "MULTIPLY"),
        ("MAT-rain.hairband", "P10R4_Hairband_Bronze", (0.18, 0.08, 0.025), 0.72, "MULTIPLY"),
        ("MAT-rain.eyes", "P10R4_Eyes_Aether", (0.08, 0.48, 0.52), 0.10, "SCREEN"),
    )
    for original, result, tint, amount, mode in recipes:
        authored = tint_source_material(original, result, tint, amount, mode)
        if authored:
            replacements[original] = authored
    for name in VISIBLE_SOURCE:
        obj = bpy.data.objects[name]
        for index, slot in enumerate(obj.material_slots):
            if slot.material and slot.material.name in replacements:
                obj.material_slots[index].material = replacements[slot.material.name]
    AUDIT["source_material_treatments"] = {
        key: value.name for key, value in replacements.items()
    }


def replace_all_materials(obj, material) -> None:
    obj.data.materials.clear()
    obj.data.materials.append(material)
    for polygon in obj.data.polygons:
        polygon.material_index = 0


def duplicate_underlayer(source_name: str, result_name: str, material):
    source = bpy.data.objects[source_name]
    obj = source.copy()
    obj.data = source.data.copy()
    obj.name = result_name
    obj.data.name = f"{result_name}_Mesh"
    obj.hide_render = False
    obj.hide_set(False)
    authored_collection().objects.link(obj)
    replace_all_materials(obj, material)
    obj["p10_round004_derivation"] = (
        f"Continuous fitted underlayer derived from {source_name}; source "
        "civilian renderer excluded."
    )
    return obj


def mesh_from_pydata(name, vertices, faces, material):
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.validate()
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    authored_collection().objects.link(obj)
    obj.data.materials.append(material)
    obj["p10_round004_authored"] = True
    return obj


def bind_rigid(obj, rig, bone_name: str) -> None:
    obj.parent = None
    obj.vertex_groups.clear()
    group = obj.vertex_groups.new(name=bone_name)
    if len(obj.data.vertices):
        group.add(list(range(len(obj.data.vertices))), 1.0, "REPLACE")
    modifier = obj.modifiers.new("P10R4_RigidBoneBind", "ARMATURE")
    modifier.object = rig
    modifier.use_deform_preserve_volume = True
    obj["p10_round004_rigid_bone"] = bone_name


def add_bevel(obj, width=0.0025, segments=2) -> None:
    modifier = obj.modifiers.new("P10R4_EdgeFinish", "BEVEL")
    modifier.width = width
    modifier.segments = segments
    modifier.limit_method = "ANGLE"


def add_solidify(obj, thickness=0.004, offset=0.0) -> None:
    modifier = obj.modifiers.new("P10R4_PanelThickness", "SOLIDIFY")
    modifier.thickness = thickness
    modifier.offset = offset
    modifier.use_even_offset = False


def make_loft_tube(
    name: str,
    centers: list[Vector],
    radii: list[tuple[float, float]],
    material,
    rig,
    bone_name: str,
    *,
    segments: int = 20,
    cap: bool = True,
    rotation_offset: float = 0.0,
):
    if len(centers) != len(radii) or len(centers) < 2:
        raise ValueError(f"Invalid loft specification for {name}")
    axis = (centers[-1] - centers[0]).normalized()
    reference = Vector((0.0, 0.0, 1.0))
    if abs(axis.dot(reference)) > 0.91:
        reference = Vector((0.0, 1.0, 0.0))
    u = axis.cross(reference).normalized()
    v = axis.cross(u).normalized()
    vertices = []
    for center, (radius_u, radius_v) in zip(centers, radii):
        for index in range(segments):
            angle = rotation_offset + math.tau * index / segments
            vertices.append(
                center
                + u * (math.cos(angle) * radius_u)
                + v * (math.sin(angle) * radius_v)
            )
    faces = []
    rings = len(centers)
    for ring in range(rings - 1):
        for index in range(segments):
            nxt = (index + 1) % segments
            a = ring * segments + index
            b = ring * segments + nxt
            c = (ring + 1) * segments + nxt
            d = (ring + 1) * segments + index
            faces.append((a, b, c, d))
    if cap:
        faces.append(tuple(range(segments - 1, -1, -1)))
        last = (rings - 1) * segments
        faces.append(tuple(last + index for index in range(segments)))
    obj = mesh_from_pydata(name, vertices, faces, material)
    add_bevel(obj, width=0.0018, segments=2)
    bind_rigid(obj, rig, bone_name)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj


def make_panel_from_rows(
    name: str,
    rows: list[list[Vector]],
    material,
    rig,
    bone_name: str,
    *,
    thickness: float = 0.004,
    bevel: float = 0.002,
    subdiv: int = 0,
):
    columns = len(rows[0])
    if columns < 2 or len(rows) < 2 or any(len(row) != columns for row in rows):
        raise ValueError(f"Rows must be rectangular for {name}")
    vertices = [point for row in rows for point in row]
    faces = []
    for row in range(len(rows) - 1):
        for column in range(columns - 1):
            a = row * columns + column
            b = a + 1
            c = a + columns + 1
            d = a + columns
            faces.append((a, b, c, d))
    obj = mesh_from_pydata(name, vertices, faces, material)
    if subdiv:
        modifier = obj.modifiers.new("P10R4_PanelSubdivision", "SUBSURF")
        modifier.subdivision_type = "CATMULL_CLARK"
        modifier.levels = subdiv
        modifier.render_levels = subdiv
    add_solidify(obj, thickness=thickness, offset=0.0)
    add_bevel(obj, width=bevel, segments=2)
    bind_rigid(obj, rig, bone_name)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj


def torso_rows(
    profiles: list[tuple[float, float, float, float]],
    columns: int = 7,
):
    rows = []
    for z, center_x, width, front_y in profiles:
        row = []
        for index in range(columns):
            normalized = -1.0 + 2.0 * index / (columns - 1)
            x = center_x + normalized * width
            y = front_y + 0.032 * abs(normalized) ** 1.7
            row.append(Vector((x, y, z)))
        rows.append(row)
    return rows


def make_curve_mesh(
    name: str,
    paths: list[list[Vector]],
    material,
    rig,
    bone_name: str,
    *,
    bevel_depth: float,
    cyclic: bool = False,
    bevel_resolution: int = 1,
):
    curve_data = bpy.data.curves.new(f"{name}_Curve", "CURVE")
    curve_data.dimensions = "3D"
    curve_data.resolution_u = 1
    curve_data.bevel_depth = bevel_depth
    curve_data.bevel_resolution = bevel_resolution
    curve_data.resolution_u = 1
    curve_data.materials.append(material)
    for path in paths:
        spline = curve_data.splines.new("POLY")
        spline.points.add(len(path) - 1)
        for point, coordinate in zip(spline.points, path):
            point.co = (*coordinate, 1.0)
        spline.use_cyclic_u = cyclic
    curve_obj = bpy.data.objects.new(name, curve_data)
    authored_collection().objects.link(curve_obj)
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = curve_obj.evaluated_get(depsgraph)
    mesh = bpy.data.meshes.new_from_object(evaluated, depsgraph=depsgraph)
    obj = bpy.data.objects.new(name, mesh)
    obj.matrix_world = curve_obj.matrix_world.copy()
    authored_collection().objects.link(obj)
    bpy.data.objects.remove(curve_obj, do_unlink=True)
    obj.name = name
    obj.data.name = f"{name}_Mesh"
    obj["p10_round004_authored_curve"] = True
    bind_rigid(obj, rig, bone_name)
    return obj


def ellipse_path(
    center: Vector,
    radius_x: float,
    radius_y: float,
    z: float,
    segments: int = 40,
):
    return [
        Vector(
            (
                center.x + math.cos(math.tau * i / segments) * radius_x,
                center.y + math.sin(math.tau * i / segments) * radius_y,
                z,
            )
        )
        for i in range(segments)
    ]


def rect_frame_path(
    center: Vector,
    width: float,
    height: float,
    y: float,
    corner_steps: int = 3,
):
    radius = min(width, height) * 0.18
    points = []
    corners = (
        (center.x + width * 0.5 - radius, center.z + height * 0.5 - radius, 0.0),
        (center.x - width * 0.5 + radius, center.z + height * 0.5 - radius, 90.0),
        (center.x - width * 0.5 + radius, center.z - height * 0.5 + radius, 180.0),
        (center.x + width * 0.5 - radius, center.z - height * 0.5 + radius, 270.0),
    )
    for cx, cz, start in corners:
        for index in range(corner_steps + 1):
            angle = math.radians(start + index * 90.0 / corner_steps)
            points.append(Vector((cx + math.cos(angle) * radius, y, cz + math.sin(angle) * radius)))
    return points


def make_ellipsoid_patch(
    name: str,
    center: Vector,
    x_span: tuple[float, float],
    radius_y: float,
    radius_z: float,
    material,
    rig,
    bone_name: str,
    *,
    x_steps: int = 6,
    angle_steps: int = 12,
    angle_min: float = 18.0,
    angle_max: float = 162.0,
):
    rows = []
    for x_index in range(x_steps):
        t = x_index / (x_steps - 1)
        x = x_span[0] * (1.0 - t) + x_span[1] * t
        taper = math.sin(math.pi * max(0.02, min(0.98, t))) ** 0.45
        row = []
        for angle_index in range(angle_steps):
            phi = math.radians(
                angle_min
                + (angle_max - angle_min) * angle_index / (angle_steps - 1)
            )
            row.append(
                Vector(
                    (
                        x,
                        center.y + math.cos(phi) * radius_y * taper,
                        center.z + math.sin(phi) * radius_z * taper,
                    )
                )
            )
        rows.append(row)
    return make_panel_from_rows(
        name,
        rows,
        material,
        rig,
        bone_name,
        thickness=0.0055,
        bevel=0.002,
        subdiv=1,
    )


def make_rivet(name, location, radius, material, rig, bone_name):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=12,
        ring_count=6,
        radius=radius,
        location=location,
    )
    obj = bpy.context.object
    obj.name = name
    for collection in list(obj.users_collection):
        collection.objects.unlink(obj)
    authored_collection().objects.link(obj)
    obj.data.materials.append(material)
    bind_rigid(obj, rig, bone_name)
    return obj


def boundary_paths(rows: list[list[Vector]]):
    return [
        rows[0],
        rows[-1],
        [row[0] for row in rows],
        [row[-1] for row in rows],
    ]


def stitch_dashes_along(
    start: Vector,
    end: Vector,
    count: int,
    dash_length: float,
):
    direction = (end - start).normalized()
    total = (end - start).length
    paths = []
    for index in range(count):
        t = (index + 0.5) / count
        center = start.lerp(end, t)
        half = min(dash_length * 0.5, total / count * 0.35)
        paths.append([center - direction * half, center + direction * half])
    return paths


def build_underlayers(rig, materials):
    under_tunic = duplicate_underlayer(
        "GEO-rain-top",
        "P10R4_UnderTunic_Fitted",
        materials["charcoal_cloth"],
    )
    body_suit = duplicate_underlayer(
        "GEO-rain-jeans",
        "P10R4_BodySuit_Fitted",
        materials["charcoal_cloth"],
    )
    return [under_tunic, body_suit]


def remove_civilian_source_renderers() -> None:
    """Remove driver-controlled civilian renderers after fit donors are copied."""
    removed = []
    for name in CIVILIAN_SOURCE:
        obj = bpy.data.objects.get(name)
        if obj is None:
            continue
        bpy.data.objects.remove(obj, do_unlink=True)
        removed.append(name)
    if sorted(removed) != sorted(CIVILIAN_SOURCE):
        raise RuntimeError(
            "Round004 did not remove every civilian source renderer: "
            f"removed={removed}"
        )
    AUDIT["civilian_source_action"] = {
        "stage": "after continuous fitted top/jeans donor copies",
        "action": "removed from derivative scene to defeat source visibility drivers",
        "objects": removed,
    }


def build_torso_costume(rig, materials) -> list[object]:
    objects = []
    # A single closed-circumference foundation replaces the earlier floating
    # front/back sheets.  It gives the breastplate fitted flank closure in
    # profile and lets the smaller hard plates sit as true layers.
    cuirass = make_loft_tube(
        "P10R4_Cuirass_LeatherFoundation",
        [
            Vector((0.0, -0.012, 0.895)),
            Vector((0.0, -0.012, 0.975)),
            Vector((0.0, -0.010, 1.075)),
            Vector((0.0, -0.008, 1.175)),
            Vector((0.0, -0.006, 1.235)),
        ],
        [
            (0.143, 0.122),
            (0.154, 0.136),
            (0.159, 0.142),
            (0.143, 0.132),
            (0.098, 0.100),
        ],
        materials["obsidian_leather"],
        rig,
        "DEF-Spine2",
        segments=32,
        cap=False,
    )
    objects.append(cuirass)
    edge = make_curve_mesh(
        "P10R4_Cuirass_EdgeBinding",
        [
            ellipse_path(Vector((0.0, -0.012, 0.0)), 0.145, 0.124, 0.895, 40),
            ellipse_path(Vector((0.0, -0.006, 0.0)), 0.100, 0.102, 1.235, 40),
        ],
        materials["brown_leather"],
        rig,
        "DEF-Spine2",
        bevel_depth=0.0032,
        cyclic=True,
    )
    objects.append(edge)

    # Tailored high-neck yokes cover the Rain tank/scarf silhouette while
    # retaining the unmodified source topology only as a hidden fit donor.
    collar = make_loft_tube(
        "P10R4_Tunic_HighCollar",
        [
            Vector((0.0, -0.008, 1.245)),
            Vector((0.0, -0.006, 1.280)),
            Vector((0.0, -0.004, 1.315)),
        ],
        [(0.086, 0.078), (0.079, 0.069), (0.073, 0.061)],
        materials["obsidian_leather"],
        rig,
        "DEF-Spine3",
        segments=30,
        cap=False,
    )
    objects.append(collar)
    objects.append(
        make_curve_mesh(
            "P10R4_Tunic_HighCollarBinding",
            [
                ellipse_path(Vector((0.0, -0.008, 0.0)), 0.087, 0.079, 1.245, 36),
                ellipse_path(Vector((0.0, -0.004, 0.0)), 0.074, 0.062, 1.315, 36),
            ],
            materials["aged_bronze"],
            rig,
            "DEF-Spine3",
            bevel_depth=0.0013,
            cyclic=True,
        )
    )
    # Continuous front-to-back leather saddles replace disconnected petal-like
    # yoke sheets and visibly attach the high collar to each upper-arm layer.
    for side, sign in (("L", 1.0), ("R", -1.0)):
        yoke_rows = []
        for y, z, inner, outer in (
            (-0.118, 1.220, 0.082, 0.145),
            (-0.066, 1.264, 0.057, 0.132),
            (0.000, 1.292, 0.050, 0.124),
            (0.058, 1.264, 0.057, 0.132),
            (0.102, 1.220, 0.082, 0.145),
        ):
            row = []
            for index in range(3):
                n = index / 2
                row.append(
                    Vector(
                        (
                            sign * (inner + (outer - inner) * n),
                            y - 0.004 * n,
                            z - 0.004 * n,
                        )
                    )
                )
            yoke_rows.append(row)
        objects.append(
            make_panel_from_rows(
                f"P10R4_Tunic_ShoulderSaddle_{side}",
                yoke_rows,
                materials["brown_leather"],
                rig,
                "DEF-Spine3",
                thickness=0.0038,
                bevel=0.0016,
                subdiv=1,
            )
        )
        objects.append(
            make_curve_mesh(
                f"P10R4_Tunic_ShoulderSaddleBinding_{side}",
                boundary_paths(yoke_rows),
                materials["aged_bronze"],
                rig,
                "DEF-Spine3",
                bevel_depth=0.0014,
            )
        )

    # Split, shallow, faceted chest plates replace the oversized convex silver
    # shield.  The center seam and exposed leather foundation do most of the
    # constructional reading.
    for side, sign in (("L", 1.0), ("R", -1.0)):
        steel_rows = []
        for z, inner, outer, front_y in (
            (1.205, 0.012, 0.086, -0.124),
            (1.158, 0.008, 0.117, -0.143),
            (1.098, 0.010, 0.124, -0.151),
            (1.038, 0.023, 0.102, -0.147),
        ):
            row = []
            for index in range(4):
                n = index / 3
                row.append(
                    Vector(
                        (
                            sign * (inner + (outer - inner) * n),
                            front_y + 0.010 * n**1.7,
                            z - 0.005 * abs(n - 0.45),
                        )
                    )
                )
            steel_rows.append(row)
        objects.append(
            make_panel_from_rows(
                f"P10R4_Cuirass_PlanarChest_{side}",
                steel_rows,
                materials["dark_steel"],
                rig,
                "DEF-Spine3",
                thickness=0.0045,
                bevel=0.0018,
                subdiv=0,
            )
        )
        objects.append(
            make_curve_mesh(
                f"P10R4_Cuirass_PlanarChestBinding_{side}",
                boundary_paths(steel_rows),
                materials["aged_bronze"],
                rig,
                "DEF-Spine3",
                bevel_depth=0.0018,
            )
        )

    abdomen_paths = []
    for z, width in ((1.005, 0.110), (0.965, 0.125), (0.925, 0.132)):
        abdomen_paths.append(
            [
                Vector((-width, -0.158, z)),
                Vector((-width * 0.45, -0.169, z - 0.010)),
                Vector((0.0, -0.173, z - 0.014)),
                Vector((width * 0.45, -0.169, z - 0.010)),
                Vector((width, -0.158, z)),
            ]
        )
    objects.append(
        make_curve_mesh(
            "P10R4_Cuirass_ArticulatedRibs",
            abdomen_paths,
            materials["dark_steel"],
            rig,
            "DEF-Spine2",
            bevel_depth=0.006,
        )
    )

    waist_path = ellipse_path(Vector((0.0, -0.010, 0.0)), 0.181, 0.126, 0.875)
    objects.append(
        make_curve_mesh(
            "P10R4_Waist_WarBelt",
            [waist_path],
            materials["brown_leather"],
            rig,
            "DEF-Pelvis",
            bevel_depth=0.018,
            cyclic=True,
            bevel_resolution=2,
        )
    )
    objects.append(
        make_curve_mesh(
            "P10R4_Waist_BeltEdgeUpper",
            [ellipse_path(Vector((0.0, -0.010, 0.0)), 0.183, 0.128, 0.889)],
            materials["aged_bronze"],
            rig,
            "DEF-Pelvis",
            bevel_depth=0.0023,
            cyclic=True,
        )
    )
    buckle_path = rect_frame_path(Vector((0.0, 0.0, 0.875)), 0.072, 0.052, -0.146)
    objects.append(
        make_curve_mesh(
            "P10R4_Waist_MainBuckle",
            [buckle_path],
            materials["aged_bronze"],
            rig,
            "DEF-Pelvis",
            bevel_depth=0.004,
            cyclic=True,
            bevel_resolution=2,
        )
    )

    diagonal_front = [
        Vector((-0.100, -0.148, 1.230)),
        Vector((-0.052, -0.166, 1.155)),
        Vector((0.020, -0.172, 1.070)),
        Vector((0.085, -0.158, 0.980)),
        Vector((0.128, -0.142, 0.900)),
    ]
    diagonal_back = [
        Vector((0.128, 0.096, 0.900)),
        Vector((0.060, 0.112, 1.020)),
        Vector((-0.012, 0.115, 1.135)),
        Vector((-0.100, 0.088, 1.230)),
    ]
    objects.append(
        make_curve_mesh(
            "P10R4_Harness_DiagonalLeather",
            [diagonal_front, diagonal_back],
            materials["brown_leather"],
            rig,
            "DEF-Spine2",
            bevel_depth=0.014,
            bevel_resolution=2,
        )
    )
    stitch_paths = []
    for path in (diagonal_front, diagonal_back):
        for a, b in zip(path[:-1], path[1:]):
            stitch_paths.extend(stitch_dashes_along(a, b, 3, 0.012))
    objects.append(
        make_curve_mesh(
            "P10R4_Harness_ContrastStitching",
            stitch_paths,
            materials["thread"],
            rig,
            "DEF-Spine2",
            bevel_depth=0.00125,
        )
    )

    closure = rect_frame_path(Vector((0.035, 0.0, 1.075)), 0.052, 0.036, -0.179)
    objects.append(
        make_curve_mesh(
            "P10R4_Harness_ChestClosure",
            [closure],
            materials["aged_bronze"],
            rig,
            "DEF-Spine3",
            bevel_depth=0.003,
            cyclic=True,
        )
    )
    for index, location in enumerate(
        (
            Vector((-0.098, -0.161, 1.205)),
            Vector((-0.018, -0.178, 1.105)),
            Vector((0.090, -0.158, 0.962)),
        )
    ):
        objects.append(
            make_rivet(
                f"P10R4_Harness_Rivet_{index:02d}",
                location,
                0.006,
                materials["aged_bronze"],
                rig,
                "DEF-Spine2",
            )
        )
    return objects


def build_coat_and_tabard(rig, materials) -> list[object]:
    objects = []
    tabard_rows = [
        [
            Vector((-0.145, -0.134, 0.875)),
            Vector((-0.088, -0.151, 0.882)),
            Vector((-0.025, -0.158, 0.878)),
            Vector((0.035, -0.151, 0.868)),
            Vector((0.082, -0.137, 0.856)),
        ],
        [
            Vector((-0.160, -0.140, 0.750)),
            Vector((-0.100, -0.151, 0.756)),
            Vector((-0.032, -0.157, 0.748)),
            Vector((0.028, -0.149, 0.733)),
            Vector((0.070, -0.136, 0.710)),
        ],
        [
            Vector((-0.172, -0.128, 0.585)),
            Vector((-0.112, -0.142, 0.596)),
            Vector((-0.045, -0.150, 0.580)),
            Vector((0.012, -0.143, 0.548)),
            Vector((0.052, -0.126, 0.510)),
        ],
        [
            Vector((-0.160, -0.112, 0.395)),
            Vector((-0.105, -0.125, 0.420)),
            Vector((-0.050, -0.132, 0.400)),
            Vector((-0.002, -0.122, 0.355)),
            Vector((0.030, -0.105, 0.315)),
        ],
    ]
    objects.append(
        make_panel_from_rows(
            "P10R4_Coat_AsymmetricFrontTabard",
            tabard_rows,
            materials["ivory_cloth"],
            rig,
            "DEF-Pelvis",
            thickness=0.0045,
            bevel=0.002,
            subdiv=1,
        )
    )
    objects.append(
        make_curve_mesh(
            "P10R4_Coat_TabardLeatherBinding",
            boundary_paths(tabard_rows),
            materials["brown_leather"],
            rig,
            "DEF-Pelvis",
            bevel_depth=0.004,
        )
    )
    teal_line = [
        row[2] + Vector((0.0, -0.004, 0.0))
        for row in tabard_rows
    ]
    objects.append(
        make_curve_mesh(
            "P10R4_Coat_TabardEngraving",
            [teal_line],
            materials["teal_enamel"],
            rig,
            "DEF-Pelvis",
            bevel_depth=0.0028,
        )
    )

    left_tail_rows = [
        [
            Vector((-0.165, 0.060, 0.875)),
            Vector((-0.095, 0.105, 0.885)),
            Vector((-0.030, 0.120, 0.875)),
        ],
        [
            Vector((-0.190, 0.075, 0.710)),
            Vector((-0.115, 0.115, 0.700)),
            Vector((-0.045, 0.125, 0.685)),
        ],
        [
            Vector((-0.210, 0.070, 0.495)),
            Vector((-0.135, 0.110, 0.470)),
            Vector((-0.060, 0.118, 0.425)),
        ],
        [
            Vector((-0.195, 0.050, 0.285)),
            Vector((-0.135, 0.095, 0.255)),
            Vector((-0.075, 0.102, 0.205)),
        ],
    ]
    right_tail_rows = [
        [
            Vector((0.015, 0.120, 0.875)),
            Vector((0.085, 0.108, 0.885)),
            Vector((0.165, 0.060, 0.875)),
        ],
        [
            Vector((0.035, 0.125, 0.700)),
            Vector((0.110, 0.115, 0.715)),
            Vector((0.190, 0.075, 0.710)),
        ],
        [
            Vector((0.050, 0.118, 0.475)),
            Vector((0.130, 0.105, 0.505)),
            Vector((0.205, 0.065, 0.520)),
        ],
        [
            Vector((0.070, 0.105, 0.325)),
            Vector((0.135, 0.090, 0.345)),
            Vector((0.185, 0.045, 0.365)),
        ],
    ]
    for label, rows, material in (
        ("LongLeft", left_tail_rows, materials["charcoal_cloth"]),
        ("ShortRight", right_tail_rows, materials["brown_leather"]),
    ):
        objects.append(
            make_panel_from_rows(
                f"P10R4_Coat_{label}Tail",
                rows,
                material,
                rig,
                "DEF-Pelvis",
                thickness=0.0048,
                bevel=0.002,
                subdiv=1,
            )
        )
        objects.append(
            make_curve_mesh(
                f"P10R4_Coat_{label}Binding",
                boundary_paths(rows),
                materials["obsidian_leather"],
                rig,
                "DEF-Pelvis",
                bevel_depth=0.0035,
            )
        )

    sash_path = [
        Vector((-0.175, -0.020, 0.865)),
        Vector((-0.135, -0.125, 0.852)),
        Vector((-0.020, -0.155, 0.842)),
        Vector((0.100, -0.135, 0.845)),
        Vector((0.180, -0.040, 0.860)),
        Vector((0.130, 0.090, 0.872)),
        Vector((0.010, 0.125, 0.875)),
        Vector((-0.120, 0.095, 0.872)),
    ]
    objects.append(
        make_curve_mesh(
            "P10R4_Coat_MutedTealSash",
            [sash_path],
            materials["teal_enamel"],
            rig,
            "DEF-Pelvis",
            bevel_depth=0.012,
            cyclic=True,
            bevel_resolution=2,
        )
    )
    return objects


def build_arm_protection(rig, materials) -> list[object]:
    objects = []
    for side, sign in (("L", 1.0), ("R", -1.0)):
        upper_centers = [
            Vector((sign * 0.100, 0.002, 1.252)),
            Vector((sign * 0.168, 0.006, 1.249)),
            Vector((sign * 0.238, 0.010, 1.245)),
            Vector((sign * 0.302, 0.013, 1.242)),
        ]
        objects.append(
            make_loft_tube(
                f"P10R4_Sleeve_{side}",
                upper_centers,
                [(0.063, 0.060), (0.059, 0.056), (0.053, 0.050), (0.047, 0.045)],
                materials["charcoal_cloth"],
                rig,
                f"DEF-Upperarm1.{side}",
                segments=20,
                cap=False,
            )
        )
        forearm_a = [
            Vector((sign * 0.320, 0.014, 1.241)),
            Vector((sign * 0.372, 0.008, 1.239)),
            Vector((sign * 0.425, 0.001, 1.236)),
        ]
        forearm_b = [
            Vector((sign * 0.412, 0.003, 1.237)),
            Vector((sign * 0.468, -0.005, 1.234)),
            Vector((sign * 0.523, -0.012, 1.231)),
        ]
        bracer_material = (
            materials["dark_steel"] if side == "L" else materials["obsidian_leather"]
        )
        objects.append(
            make_loft_tube(
                f"P10R4_BracerUpper_{side}",
                forearm_a,
                [(0.060, 0.057), (0.056, 0.053), (0.052, 0.049)],
                bracer_material,
                rig,
                f"DEF-Forearm1.{side}",
                segments=20,
            )
        )
        objects.append(
            make_loft_tube(
                f"P10R4_BracerLower_{side}",
                forearm_b,
                [(0.053, 0.050), (0.049, 0.046), (0.045, 0.043)],
                bracer_material,
                rig,
                f"DEF-Forearm2.{side}",
                segments=20,
            )
        )
        cuff_path = []
        x = sign * 0.515
        for index in range(32):
            angle = math.tau * index / 32
            cuff_path.append(
                Vector(
                    (
                        x,
                        -0.012 + math.cos(angle) * 0.048,
                        1.231 + math.sin(angle) * 0.050,
                    )
                )
            )
        objects.append(
            make_curve_mesh(
                f"P10R4_GauntletCuff_{side}",
                [cuff_path],
                materials["aged_bronze"],
                rig,
                f"DEF-Forearm2.{side}",
                bevel_depth=0.004,
                cyclic=True,
            )
        )
        dorsal_path = [
            Vector((sign * 0.338, -0.061, 1.255)),
            Vector((sign * 0.390, -0.058, 1.253)),
            Vector((sign * 0.445, -0.053, 1.248)),
            Vector((sign * 0.498, -0.046, 1.242)),
        ]
        objects.append(
            make_curve_mesh(
                f"P10R4_BracerRidge_{side}",
                [dorsal_path],
                materials["teal_enamel"] if side == "L" else materials["aged_bronze"],
                rig,
                f"DEF-Forearm1.{side}",
                bevel_depth=0.004,
            )
        )

    objects.append(
        make_ellipsoid_patch(
            "P10R4_Pauldron_LeftSteel",
            Vector((0.0, 0.004, 1.235)),
            (0.108, 0.270),
            0.056,
            0.061,
            materials["dark_steel"],
            rig,
            "DEF-Upperarm1.L",
            x_steps=6,
            angle_steps=12,
            angle_min=34.0,
            angle_max=146.0,
        )
    )
    objects.append(
        make_ellipsoid_patch(
            "P10R4_Pauldron_RightLeather",
            Vector((0.0, 0.004, 1.235)),
            (-0.230, -0.110),
            0.050,
            0.054,
            materials["brown_leather"],
            rig,
            "DEF-Upperarm1.R",
            x_steps=5,
            angle_steps=10,
            angle_min=36.0,
            angle_max=144.0,
        )
    )
    return objects


def make_boot_foot(
    name: str,
    side_sign: float,
    material,
    rig,
    bone_name: str,
    *,
    scale_x: float = 1.0,
    z_offset: float = 0.0,
):
    center_x = side_sign * 0.068
    sections = [
        (-0.205, 0.029 + z_offset, 0.032 * scale_x, 0.016),
        (-0.168, 0.036 + z_offset, 0.043 * scale_x, 0.022),
        (-0.105, 0.047 + z_offset, 0.052 * scale_x, 0.029),
        (-0.035, 0.057 + z_offset, 0.054 * scale_x, 0.033),
        (0.035, 0.064 + z_offset, 0.050 * scale_x, 0.031),
        (0.086, 0.066 + z_offset, 0.043 * scale_x, 0.026),
    ]
    segments = 20
    vertices = []
    for y, z, rx, rz in sections:
        for index in range(segments):
            angle = math.tau * index / segments
            vertices.append(
                (
                    center_x + math.cos(angle) * rx,
                    y,
                    z + math.sin(angle) * rz,
                )
            )
    faces = []
    for ring in range(len(sections) - 1):
        for index in range(segments):
            nxt = (index + 1) % segments
            a = ring * segments + index
            b = ring * segments + nxt
            c = (ring + 1) * segments + nxt
            d = (ring + 1) * segments + index
            faces.append((a, b, c, d))
    faces.append(tuple(range(segments - 1, -1, -1)))
    start = (len(sections) - 1) * segments
    faces.append(tuple(start + index for index in range(segments)))
    obj = mesh_from_pydata(name, vertices, faces, material)
    add_bevel(obj, width=0.0025, segments=2)
    bind_rigid(obj, rig, bone_name)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj


def front_plate_rows(center_x: float, z_values, widths, y_values, columns=5):
    rows = []
    for z, width, y in zip(z_values, widths, y_values):
        row = []
        for index in range(columns):
            n = -1.0 + 2.0 * index / (columns - 1)
            row.append(
                Vector(
                    (
                        center_x + n * width,
                        y + 0.016 * abs(n) ** 1.8,
                        z,
                    )
                )
            )
        rows.append(row)
    return rows


def build_leg_protection(rig, materials) -> list[object]:
    objects = []
    for side, sign in (("L", 1.0), ("R", -1.0)):
        center_x = sign * 0.070
        objects.append(
            make_boot_foot(
                f"P10R4_BootFoot_{side}",
                sign,
                materials["obsidian_leather"],
                rig,
                f"DEF-Foot.{side}",
            )
        )
        objects.append(
            make_boot_foot(
                f"P10R4_BootSole_{side}",
                sign,
                materials["sole"],
                rig,
                f"DEF-Foot.{side}",
                scale_x=1.06,
                z_offset=-0.015,
            )
        )
        shaft_centers = [
            Vector((center_x, -0.002, 0.075)),
            Vector((center_x, 0.001, 0.160)),
            Vector((center_x, 0.004, 0.270)),
            Vector((center_x, -0.002, 0.400)),
            Vector((center_x, -0.012, 0.455)),
        ]
        shaft_radii = [
            (0.060, 0.053),
            (0.064, 0.056),
            (0.063, 0.055),
            (0.059, 0.052),
            (0.062, 0.054),
        ]
        objects.append(
            make_loft_tube(
                f"P10R4_BootShaft_{side}",
                shaft_centers,
                shaft_radii,
                materials["brown_leather"],
                rig,
                f"DEF-Shin2.{side}",
                segments=22,
            )
        )
        greave_rows = front_plate_rows(
            center_x,
            (0.435, 0.345, 0.245, 0.135),
            (0.060, 0.058, 0.055, 0.050),
            (-0.077, -0.078, -0.076, -0.070),
            columns=7,
        )
        objects.append(
            make_panel_from_rows(
                f"P10R4_Greave_{side}",
                greave_rows,
                materials["muted_steel"] if side == "L" else materials["dark_steel"],
                rig,
                f"DEF-Shin2.{side}",
                thickness=0.0055,
                bevel=0.002,
                subdiv=1,
            )
        )
        objects.append(
            make_curve_mesh(
                f"P10R4_GreaveBinding_{side}",
                boundary_paths(greave_rows),
                materials["aged_bronze"],
                rig,
                f"DEF-Shin2.{side}",
                bevel_depth=0.0026,
            )
        )
        engraving = [
            Vector((center_x - 0.025, -0.084, 0.365)),
            Vector((center_x, -0.090, 0.320)),
            Vector((center_x + 0.025, -0.084, 0.365)),
            Vector((center_x, -0.090, 0.250)),
        ]
        objects.append(
            make_curve_mesh(
                f"P10R4_GreaveEngraving_{side}",
                [engraving],
                materials["teal_enamel"],
                rig,
                f"DEF-Shin2.{side}",
                bevel_depth=0.0022,
            )
        )
        for band_index, z in enumerate((0.185, 0.335)):
            objects.append(
                make_curve_mesh(
                    f"P10R4_BootStrap_{side}_{band_index}",
                    [ellipse_path(Vector((center_x, 0.0, 0.0)), 0.079, 0.070, z, 32)],
                    materials["obsidian_leather"],
                    rig,
                    f"DEF-Shin2.{side}",
                    bevel_depth=0.007,
                    cyclic=True,
                )
            )
            buckle = rect_frame_path(
                Vector((center_x + sign * 0.048, 0.0, z)),
                0.030,
                0.025,
                -0.077,
            )
            objects.append(
                make_curve_mesh(
                    f"P10R4_BootBuckle_{side}_{band_index}",
                    [buckle],
                    materials["aged_bronze"],
                    rig,
                    f"DEF-Shin2.{side}",
                    bevel_depth=0.0022,
                    cyclic=True,
                )
            )
        knee_rows = front_plate_rows(
            center_x,
            (0.515, 0.475, 0.440),
            (0.042, 0.070, 0.055),
            (-0.052, -0.087, -0.075),
            columns=7,
        )
        objects.append(
            make_panel_from_rows(
                f"P10R4_KneeGuard_{side}",
                knee_rows,
                materials["dark_steel"],
                rig,
                f"DEF-Shin1.{side}",
                thickness=0.006,
                bevel=0.0025,
                subdiv=1,
            )
        )

        thigh_rows = front_plate_rows(
            sign * 0.081,
            (0.805, 0.720, 0.625, 0.555),
            (0.058, 0.068, 0.065, 0.052),
            (-0.104, -0.118, -0.120, -0.108),
            columns=7,
        )
        objects.append(
            make_panel_from_rows(
                f"P10R4_ThighGuard_{side}",
                thigh_rows,
                materials["brown_leather"] if side == "R" else materials["dark_steel"],
                rig,
                f"DEF-Thigh2.{side}",
                thickness=0.0055,
                bevel=0.0023,
                subdiv=1,
            )
        )
        for band_index, z in enumerate((0.600, 0.755)):
            objects.append(
                make_curve_mesh(
                    f"P10R4_ThighStrap_{side}_{band_index}",
                    [ellipse_path(Vector((sign * 0.079, -0.020, 0.0)), 0.083, 0.112, z, 34)],
                    materials["obsidian_leather"],
                    rig,
                    f"DEF-Thigh2.{side}",
                    bevel_depth=0.007,
                    cyclic=True,
                )
            )
    return objects


def make_box_beveled(name, location, scale, material, rig, bone_name, bevel=0.005):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    for collection in list(obj.users_collection):
        collection.objects.unlink(obj)
    authored_collection().objects.link(obj)
    obj.data.materials.append(material)
    add_bevel(obj, width=bevel, segments=3)
    bind_rigid(obj, rig, bone_name)
    return obj


def build_weapon_harness(rig, materials) -> list[object]:
    objects = []
    back_left = [
        Vector((-0.110, 0.102, 1.225)),
        Vector((-0.070, 0.128, 1.115)),
        Vector((-0.015, 0.142, 1.010)),
        Vector((0.070, 0.125, 0.910)),
    ]
    back_right = [
        Vector((0.105, 0.102, 1.225)),
        Vector((0.065, 0.130, 1.120)),
        Vector((0.010, 0.143, 1.010)),
        Vector((-0.075, 0.123, 0.910)),
    ]
    objects.append(
        make_curve_mesh(
            "P10R4_BackHarness_CrossStraps",
            [back_left, back_right],
            materials["brown_leather"],
            rig,
            "DEF-Spine2",
            bevel_depth=0.014,
            bevel_resolution=2,
        )
    )
    mount_rows = [
        [
            Vector((-0.080, 0.132, 1.080)),
            Vector((-0.025, 0.150, 1.090)),
            Vector((0.030, 0.150, 1.080)),
            Vector((0.085, 0.132, 1.060)),
        ],
        [
            Vector((-0.090, 0.134, 1.000)),
            Vector((-0.030, 0.155, 1.005)),
            Vector((0.030, 0.155, 0.995)),
            Vector((0.090, 0.132, 0.980)),
        ],
        [
            Vector((-0.075, 0.128, 0.930)),
            Vector((-0.025, 0.148, 0.925)),
            Vector((0.025, 0.148, 0.915)),
            Vector((0.075, 0.128, 0.905)),
        ],
    ]
    objects.append(
        make_panel_from_rows(
            "P10R4_BackHarness_MountPlate",
            mount_rows,
            materials["dark_steel"],
            rig,
            "DEF-Spine2",
            thickness=0.007,
            bevel=0.003,
            subdiv=1,
        )
    )
    for index, (z, radius) in enumerate(((1.065, 0.060), (0.945, 0.055))):
        loop = ellipse_path(Vector((-0.010, 0.0, 0.0)), radius, 0.040, z, 34)
        loop = [Vector((p.x, 0.175 + (p.y * 0.25), p.z)) for p in loop]
        objects.append(
            make_curve_mesh(
                f"P10R4_BackHarness_WeaponLoop_{index}",
                [loop],
                materials["brown_leather"],
                rig,
                "DEF-Spine2",
                bevel_depth=0.008,
                cyclic=True,
            )
        )
    objects.append(
        make_box_beveled(
            "P10R4_BackHarness_LockingBracket",
            (0.065, 0.154, 1.002),
            (0.035, 0.012, 0.045),
            materials["aged_bronze"],
            rig,
            "DEF-Spine2",
            bevel=0.004,
        )
    )
    return objects


def make_prism(name, profile, depth, material):
    count = len(profile)
    vertices = [(x, -depth * 0.5, z) for x, z in profile]
    vertices.extend((x, depth * 0.5, z) for x, z in profile)
    faces = [tuple(range(count - 1, -1, -1)), tuple(range(count, count * 2))]
    for index in range(count):
        nxt = (index + 1) % count
        faces.append((index, nxt, count + nxt, count + index))
    obj = mesh_from_pydata(name, vertices, faces, material)
    add_bevel(obj, width=0.003, segments=3)
    return obj


def build_supporting_blade(materials):
    root = bpy.data.objects.new("P10R4_AetherBlade_ROOT", None)
    root.empty_display_type = "ARROWS"
    root.empty_display_size = 0.13
    authored_collection().objects.link(root)
    blade_profile = [
        (-0.045, -0.205),
        (-0.080, -0.145),
        (-0.105, 0.040),
        (-0.110, 0.325),
        (-0.078, 0.545),
        (0.000, 0.745),
        (0.070, 0.540),
        (0.105, 0.320),
        (0.103, 0.040),
        (0.075, -0.145),
        (0.044, -0.205),
    ]
    core_profile = [
        (-0.012, -0.145),
        (-0.018, 0.050),
        (-0.015, 0.370),
        (0.000, 0.615),
        (0.015, 0.370),
        (0.018, 0.050),
        (0.012, -0.145),
    ]
    guard_profile = [
        (-0.175, -0.252),
        (-0.130, -0.218),
        (-0.045, -0.215),
        (-0.030, -0.250),
        (0.030, -0.250),
        (0.045, -0.215),
        (0.130, -0.218),
        (0.175, -0.252),
        (0.130, -0.280),
        (0.040, -0.270),
        (-0.040, -0.270),
        (-0.130, -0.280),
    ]
    objects = [
        make_prism("P10R4_Blade_Steel", blade_profile, 0.030, materials["muted_steel"]),
        make_prism("P10R4_Blade_AetherInlay", core_profile, 0.038, materials["aether"]),
        make_prism("P10R4_Blade_Guard", guard_profile, 0.052, materials["dark_steel"]),
    ]
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=24,
        radius=0.023,
        depth=0.200,
        location=(0.0, 0.0, -0.365),
    )
    grip = bpy.context.object
    grip.name = "P10R4_Blade_Grip"
    for collection in list(grip.users_collection):
        collection.objects.unlink(grip)
    authored_collection().objects.link(grip)
    grip.data.materials.append(materials["brown_leather"])
    add_bevel(grip, width=0.003, segments=2)
    objects.append(grip)
    pommel_profile = [
        (-0.045, -0.490),
        (-0.060, -0.460),
        (-0.038, -0.438),
        (0.038, -0.438),
        (0.060, -0.460),
        (0.045, -0.490),
        (0.0, -0.520),
    ]
    objects.append(
        make_prism(
            "P10R4_Blade_Pommel",
            pommel_profile,
            0.052,
            materials["aged_bronze"],
        )
    )
    for obj in objects:
        obj.parent = root
        obj.matrix_parent_inverse = Matrix.Identity(4)
        obj["p10_round004_supporting_weapon"] = True
    AUDIT["supporting_weapon"] = {
        "authored_length_m": 1.265,
        "delivered_scale": [0.76, 0.88, 0.86],
        "purpose": "Supporting silhouette; costume/identity remains formal target.",
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


def set_control_location(rig, name, location: Vector) -> None:
    bone = rig.pose.bones.get(name)
    if bone is None:
        raise RuntimeError(f"Missing Rain control: {name}")
    rotation = bone.matrix.to_3x3().to_4x4()
    bone.matrix = Matrix.Translation(location) @ rotation
    bpy.context.view_layer.update()


def set_control_axes(rig, name, location, y_axis, z_axis) -> None:
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
    bone = rig.pose.bones[name]
    bone.matrix = matrix
    bpy.context.view_layer.update()


def rotate_control_local(rig, name, value, axis="X") -> None:
    bone = rig.pose.bones.get(name)
    if bone:
        bone.matrix_basis = bone.matrix_basis @ Matrix.Rotation(value, 4, axis)


def rotate_control_world(rig, name, z_radians=0.0, x_radians=0.0) -> None:
    bone = rig.pose.bones[name]
    location = bone.matrix.translation.copy()
    rotation = bone.matrix.to_3x3().to_4x4()
    bone.matrix = (
        Matrix.Translation(location)
        @ Matrix.Rotation(z_radians, 4, "Z")
        @ Matrix.Rotation(x_radians, 4, "X")
        @ rotation
    )
    bpy.context.view_layer.update()


def curl_fingers(rig, side, amount) -> None:
    suffix = f".{side}"
    sign = -1.0 if side == "L" else 1.0
    for digit in ("Index", "Middle", "Ring", "Pinky"):
        for segment, factor in ((1, 0.72), (2, 1.0), (3, 0.9)):
            rotate_control_local(
                rig,
                f"FK-{digit}{segment}{suffix}",
                sign * amount * factor,
                "X",
            )
    for segment, factor in ((1, 0.33), (2, 0.46), (3, 0.40)):
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
    set_control_location(rig, "IK-Foot.L", Vector((0.085, -0.025, 0.077)))
    set_control_location(rig, "IK-Foot.R", Vector((-0.085, 0.020, 0.077)))
    curl_fingers(rig, "L", math.radians(16.0))
    curl_fingers(rig, "R", math.radians(16.0))
    blade_root.matrix_world = (
        Matrix.Translation(Vector((-0.040, 0.178, 0.705)))
        @ Matrix.Rotation(math.radians(-12.0), 4, "Y")
        @ Matrix.Rotation(math.radians(2.0), 4, "X")
        @ Matrix.Diagonal((0.76, 0.88, 0.86, 1.0))
    )
    bpy.context.view_layer.update()


def set_combat_pose(rig, blade_root):
    reset_pose(rig)
    blade_root.matrix_world = (
        Matrix.Translation(Vector((-0.235, -0.175, 1.235)))
        @ Matrix.Rotation(math.radians(-38.0), 4, "Y")
        @ Matrix.Rotation(math.radians(-3.0), 4, "X")
        @ Matrix.Diagonal((0.76, 0.88, 0.86, 1.0))
    )
    upper = blade_root.matrix_world @ Vector((0.0, 0.0, -0.305))
    lower = blade_root.matrix_world @ Vector((0.0, 0.0, -0.430))
    axis = (
        blade_root.matrix_world.to_3x3() @ Vector((0.0, 0.0, 1.0))
    ).normalized()
    side = Vector((axis.z, 0.0, -axis.x)).normalized()
    set_control_axes(
        rig,
        "IK-Hand.L",
        upper + side * 0.070 + Vector((0.0, -0.004, 0.0)),
        -side,
        axis,
    )
    set_control_axes(
        rig,
        "IK-Hand.R",
        lower - side * 0.070 + Vector((0.0, -0.004, 0.0)),
        side,
        axis,
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
        z_radians=math.radians(11.0),
        x_radians=math.radians(5.0),
    )
    set_control_location(rig, "IK-Foot.L", Vector((0.195, -0.135, 0.077)))
    set_control_location(rig, "IK-Foot.R", Vector((-0.185, 0.170, 0.077)))
    set_control_location(rig, "IK-Pole-Shin.L", Vector((0.15, -0.52, 0.43)))
    set_control_location(rig, "IK-Pole-Shin.R", Vector((-0.13, -0.37, 0.43)))
    curl_fingers(rig, "L", math.radians(100.0))
    curl_fingers(rig, "R", math.radians(100.0))
    bpy.context.view_layer.update()
    return {"upper_grip": upper, "lower_grip": lower}


def evaluated_tri_count(obj) -> int:
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    mesh.calc_loop_triangles()
    count = len(mesh.loop_triangles)
    evaluated.to_mesh_clear()
    return count


def snapshot_objects(objects, label):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    collection = bpy.data.collections.new(f"P10R4_EXPORT_{label}")
    bpy.context.scene.collection.children.link(collection)
    collection.hide_render = True
    copies = []
    for source in sorted(objects, key=lambda value: value.name):
        if source.type not in {"MESH", "CURVE"}:
            continue
        evaluated = source.evaluated_get(depsgraph)
        mesh = bpy.data.meshes.new_from_object(
            evaluated,
            preserve_all_data_layers=True,
            depsgraph=depsgraph,
        )
        obj = bpy.data.objects.new(f"{label}_{source.name}", mesh)
        obj.matrix_world = source.matrix_world.copy()
        obj.hide_render = True
        obj["p10_round004_snapshot_of"] = source.name
        collection.objects.link(obj)
        copies.append(obj)
    return copies


def clone_lod(source_objects, label, target_tris):
    current = sum(evaluated_tri_count(obj) for obj in source_objects)
    ratio = min(1.0, target_tris / max(current, 1))
    collection = bpy.data.collections.new(f"P10R4_EXPORT_{label}")
    bpy.context.scene.collection.children.link(collection)
    collection.hide_render = True
    copies = []
    protected_tokens = (
        "GEO-rain-head",
        "GEO-rain-eyes",
        "GEO-rain-eye_",
        "GEO-rain-eyebrows",
        "GEO-rain-eyelashes",
        "GEO-rain-gums",
    )
    for source in source_objects:
        obj = source.copy()
        obj.data = source.data.copy()
        obj.name = source.name.replace("NEUTRAL", label)
        collection.objects.link(obj)
        source_name = source.get("p10_round004_snapshot_of", source.name)
        local_ratio = ratio
        if any(token in source_name for token in protected_tokens):
            local_ratio = max(local_ratio, 0.72 if label == "LOD2" else 0.88)
        if local_ratio < 0.995 and len(obj.data.polygons) > 80:
            modifier = obj.modifiers.new(f"P10R4_{label}_Decimate", "DECIMATE")
            modifier.decimate_type = "COLLAPSE"
            modifier.ratio = local_ratio
            modifier.use_collapse_triangulate = True
        copies.append(obj)
    return copies, ratio


def select_only(objects) -> None:
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


def export_static_fbx(path, objects) -> None:
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
        raise RuntimeError(f"FBX export failed: {path}")


def delete_objects(objects) -> None:
    for obj in objects:
        mesh = obj.data if obj.type == "MESH" else None
        bpy.data.objects.remove(obj, do_unlink=True)
        if mesh and mesh.users == 0:
            bpy.data.meshes.remove(mesh)


def look_at(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def setup_stage(materials):
    for obj in list(bpy.data.objects):
        if obj.type in {"LIGHT", "CAMERA"}:
            bpy.data.objects.remove(obj, do_unlink=True)
    collection = bpy.data.collections.new("P10_Round004_STAGE")
    bpy.context.scene.collection.children.link(collection)
    stage_material = make_surface_material(
        "P10R4_StageFloor",
        (0.012, 0.016, 0.019),
        0.08,
        0.42,
        noise_scale=10.0,
        noise_strength=0.05,
        bump_strength=0.02,
    )
    bpy.ops.mesh.primitive_plane_add(size=20.0, location=(0.0, 0.0, -0.002))
    floor = bpy.context.object
    floor.name = "P10R4_STAGE_Floor"
    for owner in list(floor.users_collection):
        owner.objects.unlink(floor)
    collection.objects.link(floor)
    floor.data.materials.append(stage_material)

    def add_area(name, location, energy, color, size):
        light = bpy.data.lights.new(name, "AREA")
        light.energy = energy
        light.color = color
        light.shape = "DISK"
        light.size = size
        obj = bpy.data.objects.new(name, light)
        collection.objects.link(obj)
        obj.location = location
        look_at(obj, (0.0, 0.0, 1.0))
        return obj

    add_area("P10R4_STAGE_Key", (2.8, -3.4, 3.7), 800.0, (1.0, 0.84, 0.68), 2.5)
    add_area("P10R4_STAGE_Fill", (-2.1, -2.6, 1.8), 350.0, (0.42, 0.58, 0.72), 2.3)
    add_area("P10R4_STAGE_Rim", (-2.6, 1.8, 3.1), 720.0, (0.12, 0.40, 0.43), 2.0)
    add_area("P10R4_STAGE_Top", (0.0, 0.2, 4.3), 500.0, (0.68, 0.73, 0.76), 1.8)

    camera_data = bpy.data.cameras.new("P10R4_STAGE_Camera")
    camera = bpy.data.objects.new("P10R4_STAGE_Camera", camera_data)
    collection.objects.link(camera)
    bpy.context.scene.camera = camera

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = RENDER_SIZE
    scene.render.resolution_y = RENDER_SIZE
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.film_transparent = False
    scene.render.fps = 30
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    if background:
        background.inputs["Color"].default_value = (0.004, 0.006, 0.008, 1.0)
        background.inputs["Strength"].default_value = 0.13
    scene.view_settings.look = "Medium High Contrast"
    scene.view_settings.exposure = -0.12
    scene.view_settings.gamma = 1.0
    return camera


def place_camera(camera, location, target, lens):
    camera.location = Vector(location)
    camera.data.lens = lens
    camera.data.sensor_width = 36.0
    look_at(camera, target)
    bpy.context.view_layer.update()


def render_view(key, camera, location, target, lens):
    output = PNG_OUTPUTS[key]
    place_camera(camera, location, target, lens)
    bpy.context.scene.render.filepath = str(output)
    print(f"[P10:R4] Rendering {key}: {output.name}")
    bpy.ops.render.render(write_still=True)
    if not output.is_file() or output.stat().st_size < 1024:
        raise RuntimeError(f"Render failed: {output}")


def relink_authored_blend_textures(*, relative: bool) -> None:
    source_names = {path.name for path in SOURCE_TEXTURES.iterdir() if path.is_file()}
    for image in bpy.data.images:
        filename = Path(image.filepath).name
        probe = filename.replace("<UDIM>", "1001")
        if filename in source_names or probe in source_names:
            image.filepath = (
                f"//ThirdParty/BlenderStudioRain/textures/{filename}"
                if relative
                else str(SOURCE_TEXTURES / filename)
            )


def write_audit() -> None:
    output_hashes = {}
    for key, path in {**FBX_OUTPUTS, **PNG_OUTPUTS}.items():
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
    path = PREFLIGHT / "P10_Round004_Audit.json"
    path.write_text(json.dumps(AUDIT, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"[P10:R4] Wrote {path}")


def run() -> None:
    ensure_directories()
    verify_and_stage_sources()
    open_source()
    fixed_fbx_clock()
    rig = bpy.data.objects["RIG-rain"]
    apply_face_hair_palette()
    materials = build_materials()

    costume = []
    costume.extend(build_underlayers(rig, materials))
    remove_civilian_source_renderers()
    costume.extend(build_torso_costume(rig, materials))
    costume.extend(build_coat_and_tabard(rig, materials))
    costume.extend(build_arm_protection(rig, materials))
    costume.extend(build_leg_protection(rig, materials))
    costume.extend(build_weapon_harness(rig, materials))
    blade_root, blade_meshes = build_supporting_blade(materials)
    camera = setup_stage(materials)

    source_meshes = [bpy.data.objects[name] for name in VISIBLE_SOURCE]
    presentation = [*source_meshes, *costume, *blade_meshes]
    AUDIT["costume_objects"] = sorted(obj.name for obj in costume)
    AUDIT["source_visible_triangles"] = sum(
        evaluated_tri_count(obj) for obj in source_meshes
    )
    AUDIT["authored_costume_triangles_neutral_rest"] = sum(
        evaluated_tri_count(obj) for obj in costume
    )
    AUDIT["supporting_weapon_triangles"] = sum(
        evaluated_tri_count(obj) for obj in blade_meshes
    )

    set_neutral_pose(rig, blade_root)
    render_view("front_png", camera, (0.0, -3.65, 1.02), (0.0, 0.0, 0.86), 68.0)
    render_view(
        "three_quarter_png",
        camera,
        (2.62, -3.05, 1.25),
        (0.0, 0.0, 0.88),
        68.0,
    )
    render_view("back_png", camera, (0.0, 3.72, 1.05), (0.0, 0.0, 0.86), 67.0)
    render_view("profile_png", camera, (3.68, 0.0, 1.04), (0.0, 0.0, 0.86), 67.0)
    render_view("face_png", camera, (0.0, -1.22, 1.49), (0.0, -0.02, 1.48), 92.0)
    render_view("hands_png", camera, (0.0, -2.40, 0.80), (0.0, -0.02, 0.80), 88.0)
    render_view("feet_png", camera, (0.0, -1.38, 0.19), (0.0, -0.02, 0.18), 90.0)

    neutral = snapshot_objects(presentation, "NEUTRAL")
    native_neutral_tris = sum(evaluated_tri_count(obj) for obj in neutral)
    export_static_fbx(FBX_OUTPUTS["neutral_fbx"], neutral)

    lod0_target = min(native_neutral_tris, LOD0_TARGET_TRIS)
    lod0, lod0_ratio = clone_lod(neutral, "LOD0", lod0_target)
    lod0_tris = sum(evaluated_tri_count(obj) for obj in lod0)
    if lod0_tris > LOD0_MAX_TRIS:
        raise RuntimeError(
            f"LOD0 budget missed: {lod0_tris} triangles > {LOD0_MAX_TRIS}"
        )
    lod1, lod1_ratio = clone_lod(neutral, "LOD1", int(lod0_tris * 0.58))
    lod2, lod2_ratio = clone_lod(neutral, "LOD2", int(lod0_tris * 0.30))
    lod1_tris = sum(evaluated_tri_count(obj) for obj in lod1)
    lod2_tris = sum(evaluated_tri_count(obj) for obj in lod2)
    if not lod0_tris > lod1_tris > lod2_tris:
        raise RuntimeError(
            f"LOD triangle order invalid: {lod0_tris}, {lod1_tris}, {lod2_tris}"
        )
    export_static_fbx(FBX_OUTPUTS["lod0_fbx"], lod0)
    export_static_fbx(FBX_OUTPUTS["lod1_fbx"], lod1)
    export_static_fbx(FBX_OUTPUTS["lod2_fbx"], lod2)

    grip = set_combat_pose(rig, blade_root)
    render_view(
        "combat_png",
        camera,
        (2.20, -2.82, 1.11),
        (-0.08, -0.04, 0.95),
        55.0,
    )
    grip_center = (grip["upper_grip"] + grip["lower_grip"]) * 0.5
    render_view(
        "grip_png",
        camera,
        (grip_center.x + 0.18, grip_center.y - 1.04, grip_center.z + 0.06),
        grip_center,
        96.0,
    )
    combat = snapshot_objects(presentation, "COMBAT")
    combat_tris = sum(evaluated_tri_count(obj) for obj in combat)
    export_static_fbx(FBX_OUTPUTS["combat_fbx"], combat)

    left_hand = rig.pose.bones["DEF-Hand.L"].matrix.translation
    right_hand = rig.pose.bones["DEF-Hand.R"].matrix.translation
    AUDIT["combat_grip"] = {
        "upper_grip": [round(value, 6) for value in grip["upper_grip"]],
        "lower_grip": [round(value, 6) for value in grip["lower_grip"]],
        "left_hand_proxy": [round(value, 6) for value in left_hand],
        "right_hand_proxy": [round(value, 6) for value in right_hand],
        "left_proxy_distance_m": round((left_hand - grip["upper_grip"]).length, 6),
        "right_proxy_distance_m": round((right_hand - grip["lower_grip"]).length, 6),
    }
    AUDIT["triangle_budgets"] = {
        "neutral_native": native_neutral_tris,
        "combat_native": combat_tris,
        "lod0": lod0_tris,
        "lod1": lod1_tris,
        "lod2": lod2_tris,
        "lod0_limit": LOD0_MAX_TRIS,
        "lod0_decimation_ratio": round(lod0_ratio, 6),
        "lod1_decimation_ratio": round(lod1_ratio, 6),
        "lod2_decimation_ratio": round(lod2_ratio, 6),
        "tradeoff": (
            "Rain face/hands/hair are protected at higher ratios; costume "
            "surfaces absorb most simplification."
        ),
    }

    delete_objects([*combat, *lod2, *lod1, *lod0, *neutral])
    set_neutral_pose(rig, blade_root)
    bpy.context.preferences.filepaths.save_version = 0
    # Save once from absolute source paths so Blender cannot resolve the
    # intended authored-relative location against the third-party source blend.
    relink_authored_blend_textures(relative=False)
    bpy.ops.wm.save_as_mainfile(
        filepath=str(AUTHORED_BLEND),
        check_existing=False,
        relative_remap=False,
    )
    # The current .blend now lives at the derivative root, so the exact same
    # authored-relative paths resolve correctly.  Save again without backups.
    relink_authored_blend_textures(relative=True)
    bpy.ops.wm.save_as_mainfile(
        filepath=str(AUTHORED_BLEND),
        check_existing=False,
        relative_remap=False,
    )
    write_audit()
    print("[P10:R4] Round004 costume pipeline complete")


if __name__ == "__main__":
    try:
        run()
    except Exception as exc:
        print(f"[P10:R4] FATAL: {exc}", file=sys.stderr)
        raise
