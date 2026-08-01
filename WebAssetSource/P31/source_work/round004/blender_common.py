"""Shared deterministic helpers for the P30 Round004 Blender asset build."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import bpy


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def activate(obj: bpy.types.Object) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    obj.hide_set(False)
    obj.hide_viewport = False
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def remove_object(obj: bpy.types.Object) -> None:
    bpy.data.objects.remove(obj, do_unlink=True)


def remove_shape_keys(obj: bpy.types.Object) -> None:
    if obj.type != "MESH" or obj.data.shape_keys is None:
        return
    while obj.data.shape_keys is not None:
        obj.shape_key_remove(obj.data.shape_keys.key_blocks[-1])
    if obj.data.shape_keys is not None:
        raise RuntimeError(f"Failed to delete shape keys from {obj.name}")


def apply_or_remove_modifiers(
    obj: bpy.types.Object,
    apply_types: set[str],
) -> None:
    activate(obj)
    for modifier in list(obj.modifiers):
        if modifier.type in apply_types:
            try:
                bpy.ops.object.modifier_apply(modifier=modifier.name)
            except RuntimeError as exc:
                raise RuntimeError(
                    f"Required {modifier.type} modifier failed on {obj.name}: {exc}"
                ) from exc
        else:
            obj.modifiers.remove(modifier)


def simple_material(
    name: str,
    color: tuple[float, float, float, float],
    *,
    metallic: float,
    roughness: float,
    emissive: tuple[float, float, float] | None = None,
    emissive_strength: float = 0.0,
) -> bpy.types.Material:
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = color
    node = material.node_tree.nodes.get("Principled BSDF")
    if node is None:
        raise RuntimeError(f"Principled BSDF missing from {name}")
    node.inputs["Base Color"].default_value = color
    node.inputs["Metallic"].default_value = metallic
    node.inputs["Roughness"].default_value = roughness
    if emissive is not None:
        emission_input = node.inputs.get("Emission Color") or node.inputs.get("Emission")
        strength_input = node.inputs.get("Emission Strength")
        if emission_input is not None:
            emission_input.default_value = (*emissive, 1.0)
        if strength_input is not None:
            strength_input.default_value = emissive_strength
    return material


def textured_material(
    name: str,
    image_path: Path,
    *,
    metallic: float,
    roughness: float,
) -> bpy.types.Material:
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = (1.0, 1.0, 1.0, 1.0)
    nodes = material.node_tree.nodes
    principled = nodes.get("Principled BSDF")
    if principled is None:
        raise RuntimeError(f"Principled BSDF missing from {name}")
    for node in list(nodes):
        if node.type == "TEX_IMAGE":
            nodes.remove(node)
    texture = nodes.new("ShaderNodeTexImage")
    texture.name = f"{name}_BaseColor"
    texture.image = bpy.data.images.load(str(image_path.resolve()), check_existing=True)
    texture.image.colorspace_settings.name = "sRGB"
    material.node_tree.links.new(texture.outputs["Color"], principled.inputs["Base Color"])
    principled.inputs["Metallic"].default_value = metallic
    principled.inputs["Roughness"].default_value = roughness
    return material


def assign_material(obj: bpy.types.Object, material: bpy.types.Material) -> None:
    obj.data.materials.clear()
    obj.data.materials.append(material)
    for polygon in obj.data.polygons:
        polygon.material_index = 0


def bind_rigid(
    obj: bpy.types.Object,
    armature: bpy.types.Object,
    bone_name: str,
) -> None:
    obj.vertex_groups.clear()
    group = obj.vertex_groups.new(name=bone_name)
    group.add(range(len(obj.data.vertices)), 1.0, "REPLACE")
    modifier = obj.modifiers.new("GameplayRig", "ARMATURE")
    modifier.object = armature
    obj.parent = armature
    obj.matrix_parent_inverse = armature.matrix_world.inverted()


def limit_and_audit_weights(
    obj: bpy.types.Object,
    fallback_group: str,
    *,
    limit: int = 4,
) -> dict[str, int]:
    unweighted: list[int] = []
    for vertex in obj.data.vertices:
        positive = [item for item in vertex.groups if item.weight > 1e-6]
        if not positive:
            unweighted.append(vertex.index)
    if unweighted:
        raise RuntimeError(
            f"{obj.name}: {len(unweighted)} unweighted vertices after transfer; "
            f"fallback {fallback_group} is forbidden"
        )
    # Blender's operators skip source-hidden vertices. Rain's unmasked body carries
    # hidden-edit flags, so rebuild the gameplay groups deterministically instead.
    source_group_names = [group.name for group in obj.vertex_groups]
    assignments: list[list[tuple[str, float]]] = []
    for vertex in obj.data.vertices:
        ranked = sorted(
            (
                (source_group_names[item.group], item.weight)
                for item in vertex.groups
                if item.weight > 1e-6
            ),
            key=lambda item: item[1],
            reverse=True,
        )[:limit]
        total = sum(weight for _, weight in ranked)
        if total <= 1e-8:
            raise RuntimeError(f"{obj.name}: vertex {vertex.index} lost all weights")
        assignments.append([(name, weight / total) for name, weight in ranked])
    obj.vertex_groups.clear()
    rebuilt_groups = {
        name: obj.vertex_groups.new(name=name) for name in source_group_names
    }
    for vertex_index, ranked in enumerate(assignments):
        for name, weight in ranked:
            rebuilt_groups[name].add([vertex_index], weight, "REPLACE")
    invalid_sums = 0
    excessive = 0
    for vertex in obj.data.vertices:
        positive = [item for item in vertex.groups if item.weight > 1e-6]
        if len(positive) > limit:
            excessive += 1
        if abs(sum(item.weight for item in positive) - 1.0) > 1e-3:
            invalid_sums += 1
    known = {bone.name for bone in obj.parent.data.bones} if obj.parent else set()
    unknown_groups = sorted(group.name for group in obj.vertex_groups if group.name not in known)
    if excessive or invalid_sums or unknown_groups:
        raise RuntimeError(
            f"{obj.name}: weight audit failed excessive={excessive}, "
            f"invalid_sums={invalid_sums}, unknown_groups={unknown_groups}"
        )
    return {
        "vertices": len(obj.data.vertices),
        "unweighted": 0,
        "max_influences": limit,
        "invalid_sums": 0,
    }


def transfer_weights(
    obj: bpy.types.Object,
    source: bpy.types.Object,
    armature: bpy.types.Object,
    fallback_group: str,
) -> dict[str, int]:
    obj.vertex_groups.clear()
    for group in source.vertex_groups:
        obj.vertex_groups.new(name=group.name)
    modifier = obj.modifiers.new("GameplayWeightTransfer", "DATA_TRANSFER")
    modifier.object = source
    modifier.use_vert_data = True
    modifier.data_types_verts = {"VGROUP_WEIGHTS"}
    modifier.vert_mapping = "POLYINTERP_NEAREST"
    modifier.layers_vgroup_select_src = "ALL"
    modifier.layers_vgroup_select_dst = "NAME"
    modifier.mix_mode = "REPLACE"
    modifier.mix_factor = 1.0
    activate(obj)
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    rig = obj.modifiers.new("GameplayRig", "ARMATURE")
    rig.object = armature
    obj.parent = armature
    obj.matrix_parent_inverse = armature.matrix_world.inverted()
    audit = limit_and_audit_weights(obj, fallback_group)
    return audit


def duplicate_joined_weight_source(
    meshes: list[bpy.types.Object],
    name: str,
) -> bpy.types.Object:
    copies: list[bpy.types.Object] = []
    for source in meshes:
        copy = source.copy()
        copy.data = source.data.copy()
        bpy.context.scene.collection.objects.link(copy)
        matrix_world = source.matrix_world.copy()
        copy.parent = None
        copy.matrix_world = matrix_world
        for modifier in list(copy.modifiers):
            copy.modifiers.remove(modifier)
        copies.append(copy)
    if not copies:
        raise RuntimeError("No meshes supplied for weight source")
    if len(copies) > 1:
        bpy.ops.object.select_all(action="DESELECT")
        for copy in copies:
            copy.select_set(True)
        bpy.context.view_layer.objects.active = copies[0]
        bpy.ops.object.join()
    joined = copies[0]
    joined.name = name
    return joined


def mesh_summary(objects: list[bpy.types.Object]) -> dict[str, object]:
    meshes = [obj for obj in objects if obj.type == "MESH"]
    return {
        "mesh_objects": len(meshes),
        "vertices": sum(len(obj.data.vertices) for obj in meshes),
        "triangles": sum(
            len(polygon.vertices) - 2
            for obj in meshes
            for polygon in obj.data.polygons
        ),
        "materials": sorted(
            {
                slot.material.name
                for obj in meshes
                for slot in obj.material_slots
                if slot.material is not None
            }
        ),
    }


def export_glb(
    output: Path,
    objects: list[bpy.types.Object],
    *,
    animations: bool,
) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.hide_set(False)
        obj.hide_viewport = False
        obj.hide_render = False
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.export_scene.gltf(
        filepath=str(output),
        check_existing=False,
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=False,
        export_cameras=False,
        export_lights=False,
        export_animations=animations,
        export_animation_mode="ACTIONS",
        export_skins=True,
        export_morph=False,
        export_materials="EXPORT",
        export_image_format="AUTO",
    )


def write_json(path: Path, payload: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n")
