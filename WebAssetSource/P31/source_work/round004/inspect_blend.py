"""Emit a read-only structural summary of the currently opened Blender file."""

from __future__ import annotations

import json
from pathlib import Path
import sys

import bpy


argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
output: Path | None = None
file_label: str | None = None
if len(argv) == 3:
    source = Path(argv[0]).resolve()
    file_label = argv[1]
    output = Path(argv[2]).resolve()
    if not source.is_file():
        raise FileNotFoundError(source)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    result = bpy.ops.import_scene.gltf(filepath=str(source))
    if "FINISHED" not in result:
        raise RuntimeError(f"glTF import failed for {source}: {sorted(result)}")
    # Blender's glTF importer may create a transient Icosphere helper in this
    # reserved collection even though it is not a node in the source GLB.
    helper_collection = bpy.data.collections.get("glTF_not_exported")
    if helper_collection is not None:
        for helper in list(helper_collection.objects):
            bpy.data.objects.remove(helper, do_unlink=True)
        bpy.data.collections.remove(helper_collection)
elif len(argv) == 1:
    output = Path(argv[0]).resolve()
elif argv:
    raise ValueError("expected either OUTPUT or INPUT_GLTF FILE_LABEL OUTPUT")


def rounded(values: object) -> list[float]:
    return [round(float(value), 6) for value in values]


objects: list[dict[str, object]] = []
for obj in sorted(bpy.data.objects, key=lambda item: item.name):
    entry: dict[str, object] = {
        "name": obj.name,
        "type": obj.type,
        "parent": obj.parent.name if obj.parent else None,
        "location": rounded(obj.location),
        "rotation_euler": rounded(obj.rotation_euler),
        "scale": rounded(obj.scale),
        "dimensions": rounded(obj.dimensions),
        "collections": sorted(collection.name for collection in obj.users_collection),
        "modifiers": [modifier.type for modifier in obj.modifiers],
    }
    if obj.type == "MESH":
        entry.update(
            {
                "vertices": len(obj.data.vertices),
                "polygons": len(obj.data.polygons),
                "triangles_base": sum(len(poly.vertices) - 2 for poly in obj.data.polygons),
                "materials": [slot.material.name if slot.material else None for slot in obj.material_slots],
                "vertex_groups": len(obj.vertex_groups),
                "shape_keys": (
                    len(obj.data.shape_keys.key_blocks) if obj.data.shape_keys else 0
                ),
                "uv_ranges": [
                    {
                        "name": layer.name,
                        "min": [
                            round(min(loop.uv[index] for loop in layer.data), 6)
                            for index in range(2)
                        ] if layer.data else [],
                        "max": [
                            round(max(loop.uv[index] for loop in layer.data), 6)
                            for index in range(2)
                        ] if layer.data else [],
                    }
                    for layer in obj.data.uv_layers
                ],
            }
        )
    elif obj.type == "ARMATURE":
        entry.update(
            {
                "bones": len(obj.data.bones),
                "deform_bones": sum(1 for bone in obj.data.bones if bone.use_deform),
                "bone_names": [bone.name for bone in obj.data.bones],
                "bone_details": [
                    {
                        "name": bone.name,
                        "parent": bone.parent.name if bone.parent else None,
                        "head": rounded(bone.head_local),
                        "tail": rounded(bone.tail_local),
                        "deform": bone.use_deform,
                    }
                    for bone in obj.data.bones
                ],
            }
        )
    objects.append(entry)

summary = {
    "file": file_label if file_label is not None else bpy.data.filepath,
    "blender": bpy.app.version_string,
    "objects": objects,
    "collections": sorted(collection.name for collection in bpy.data.collections),
    "materials": sorted(material.name for material in bpy.data.materials),
    "images": sorted(
        ({
            "name": image.name,
            "size": [int(image.size[0]), int(image.size[1])],
            "filepath": image.filepath,
            "packed": image.packed_file is not None,
        }
        for image in bpy.data.images
        if image.name not in {"Render Result", "Viewer Node"}),
        key=lambda item: item["name"],
    ),
    "actions": sorted(action.name for action in bpy.data.actions),
}
payload = json.dumps(summary, indent=2, sort_keys=True) + "\n"
if output is not None:
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(payload)
print("ROUND004_BLEND_INSPECT=" + json.dumps(summary, sort_keys=True))
