"""Small deterministic Blender helpers for the isolated Round005 alternate."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
import struct

import bpy


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def activate(obj: bpy.types.Object) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    obj.hide_set(False)
    obj.hide_viewport = False
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def remove_object(obj: bpy.types.Object) -> None:
    bpy.data.objects.remove(obj, do_unlink=True)


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
        emission = node.inputs.get("Emission Color") or node.inputs.get("Emission")
        strength = node.inputs.get("Emission Strength")
        if emission is not None:
            emission.default_value = (*emissive, 1.0)
        if strength is not None:
            strength.default_value = emissive_strength
    return material


def assign_material(obj: bpy.types.Object, material: bpy.types.Material) -> None:
    obj.data.materials.clear()
    obj.data.materials.append(material)
    for polygon in obj.data.polygons:
        polygon.material_index = 0


def bind_rigid(obj: bpy.types.Object, armature: bpy.types.Object, bone_name: str) -> None:
    obj.vertex_groups.clear()
    group = obj.vertex_groups.new(name=bone_name)
    group.add(range(len(obj.data.vertices)), 1.0, "REPLACE")
    modifier = obj.modifiers.new("GameplayRig", "ARMATURE")
    modifier.object = armature
    obj.parent = armature
    obj.matrix_parent_inverse = armature.matrix_world.inverted()


def limit_weights(obj: bpy.types.Object, *, maximum: int = 4) -> dict[str, int]:
    group_names = [group.name for group in obj.vertex_groups]
    assignments: list[list[tuple[str, float]]] = []
    for vertex in obj.data.vertices:
        ranked = sorted(
            ((group_names[item.group], item.weight) for item in vertex.groups if item.weight > 1e-7),
            key=lambda item: item[1],
            reverse=True,
        )[:maximum]
        if not ranked:
            raise RuntimeError(f"{obj.name}: unweighted vertex {vertex.index}")
        total = sum(weight for _, weight in ranked)
        assignments.append([(name, weight / total) for name, weight in ranked])
    obj.vertex_groups.clear()
    groups = {name: obj.vertex_groups.new(name=name) for name in group_names}
    for vertex_index, ranked in enumerate(assignments):
        for name, weight in ranked:
            groups[name].add([vertex_index], weight, "REPLACE")
    return {"vertices": len(obj.data.vertices), "max_influences": maximum, "unweighted": 0}


def mesh_summary(objects: list[bpy.types.Object]) -> dict[str, object]:
    meshes = [obj for obj in objects if obj.type == "MESH" and not obj.hide_render]
    used_materials = {
        slot.material for obj in meshes for slot in obj.material_slots if slot.material
    }
    materials = {material.name for material in used_materials}
    textures = {
        node.image.name
        for material in used_materials
        if material.use_nodes and material.node_tree
        for node in material.node_tree.nodes
        if node.type == "TEX_IMAGE" and node.image
    }
    return {
        "mesh_objects": len(meshes),
        "vertices": sum(len(obj.data.vertices) for obj in meshes),
        "triangles": sum(sum(len(poly.vertices) - 2 for poly in obj.data.polygons) for obj in meshes),
        "materials": sorted(materials),
        "material_count": len(materials),
        "textures": sorted(textures),
        "texture_count": len(textures),
    }


def canonicalize_triangle_indices(path: Path) -> None:
    """Canonicalize equivalent triangle order emitted by Blender's exporter.

    Blender 5.2 can enumerate generated-sphere triangles in a different order
    across clean processes even when vertices and topology are identical.  The
    change is visually irrelevant but defeats byte-current asset receipts.  A
    cyclic rotation preserves winding; sorting the resulting triples produces
    one deterministic representation without touching vertex attributes.
    """

    payload = bytearray(path.read_bytes())
    if payload[:4] != b"glTF" or struct.unpack_from("<I", payload, 4)[0] != 2:
        raise ValueError(f"{path.name}: expected GLB 2.0")
    json_length, json_type = struct.unpack_from("<II", payload, 12)
    if json_type != 0x4E4F534A:
        raise ValueError(f"{path.name}: first GLB chunk is not JSON")
    json_start = 20
    gltf = json.loads(bytes(payload[json_start : json_start + json_length]).decode("utf-8"))
    bin_header = json_start + json_length
    bin_length, bin_type = struct.unpack_from("<II", payload, bin_header)
    if bin_type != 0x004E4942:
        raise ValueError(f"{path.name}: second GLB chunk is not BIN")
    bin_start = bin_header + 8
    formats = {5121: "B", 5123: "H", 5125: "I"}
    changed = False
    for mesh in gltf.get("meshes", []):
        for primitive in mesh.get("primitives", []):
            if primitive.get("mode", 4) != 4 or "indices" not in primitive:
                continue
            accessor = gltf["accessors"][primitive["indices"]]
            count = int(accessor["count"])
            if count % 3:
                raise ValueError(f"{path.name}: triangle index count {count} is invalid")
            component_type = int(accessor["componentType"])
            format_code = formats.get(component_type)
            if format_code is None:
                raise ValueError(
                    f"{path.name}: unsupported index component type {component_type}"
                )
            view = gltf["bufferViews"][accessor["bufferView"]]
            if "byteStride" in view:
                raise ValueError(f"{path.name}: strided index buffer is unsupported")
            offset = (
                bin_start
                + int(view.get("byteOffset", 0))
                + int(accessor.get("byteOffset", 0))
            )
            values = struct.unpack_from(f"<{count}{format_code}", payload, offset)
            triangles = []
            for index in range(0, count, 3):
                first, second, third = values[index : index + 3]
                triangles.append(
                    min(
                        (first, second, third),
                        (second, third, first),
                        (third, first, second),
                    )
                )
            canonical = tuple(value for triangle in sorted(triangles) for value in triangle)
            if canonical != values:
                struct.pack_into(f"<{count}{format_code}", payload, offset, *canonical)
                changed = True
    if bin_start + bin_length > len(payload):
        raise ValueError(f"{path.name}: truncated BIN chunk")
    if changed:
        path.write_bytes(payload)


def export_glb(
    path: Path,
    objects: list[bpy.types.Object],
    *,
    animations: bool,
    canonicalize_indices: bool = False,
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.hide_set(False)
        obj.hide_viewport = False
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        use_selection=True,
        export_animations=animations,
        export_frame_range=False,
        export_force_sampling=True,
        export_skins=True,
        export_morph=False,
        export_lights=False,
        export_cameras=False,
        export_yup=True,
    )
    if canonicalize_indices:
        canonicalize_triangle_indices(path)
