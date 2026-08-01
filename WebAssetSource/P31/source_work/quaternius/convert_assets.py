"""Convert selected Quaternius assets to compact, self-contained GLB files.

Run with Blender in background mode, for example:
  blender --background --factory-startup --python convert_assets.py -- \
    --input model.gltf --output model.glb

For animation libraries, pass a comma-separated allow-list with --keep-actions.
Only those clips and the skinned mannequin/armature are retained.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

import bpy


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--keep-actions", default="")
    parser.add_argument("--strip-animation-preview-objects", action="store_true")
    parser.add_argument("--target-longest-dimension", type=float)
    return parser.parse_args(argv)


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def import_asset(path: Path) -> None:
    suffix = path.suffix.lower()
    if suffix in {".gltf", ".glb"}:
        bpy.ops.import_scene.gltf(filepath=str(path))
    elif suffix == ".fbx":
        bpy.ops.import_scene.fbx(filepath=str(path), use_anim=False)
    else:
        raise ValueError(f"Unsupported input format: {suffix}")


def remove_cameras_and_lights() -> None:
    for obj in list(bpy.data.objects):
        if obj.type in {"CAMERA", "LIGHT"}:
            bpy.data.objects.remove(obj, do_unlink=True)


def strip_animation_preview_objects() -> None:
    """Keep armatures and meshes actually deformed by an armature."""
    for obj in list(bpy.data.objects):
        if obj.type == "ARMATURE":
            continue
        if obj.type == "MESH":
            is_skinned = any(mod.type == "ARMATURE" for mod in obj.modifiers)
            if is_skinned:
                continue
        bpy.data.objects.remove(obj, do_unlink=True)


def normalize_longest_dimension(target: float) -> None:
    mesh_objects = [obj for obj in bpy.data.objects if obj.type == "MESH"]
    if not mesh_objects:
        raise RuntimeError("Cannot normalize an asset with no meshes")
    bpy.context.view_layer.update()
    current = max(max(obj.dimensions) for obj in mesh_objects)
    if current <= 0:
        raise RuntimeError(f"Invalid source dimension: {current}")
    factor = target / current
    roots = [obj for obj in bpy.data.objects if obj.parent is None]
    bpy.ops.object.select_all(action="DESELECT")
    for obj in roots:
        obj.scale = tuple(component * factor for component in obj.scale)
        obj.select_set(True)
    bpy.context.view_layer.objects.active = roots[0]
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bpy.context.view_layer.update()


def filter_actions(keep: set[str]) -> None:
    available = {action.name for action in bpy.data.actions}
    missing = sorted(keep - available)
    if missing:
        raise RuntimeError(f"Requested actions missing from source: {missing}")

    for obj in bpy.data.objects:
        animation_data = obj.animation_data
        if animation_data is None:
            continue
        if animation_data.action and animation_data.action.name not in keep:
            animation_data.action = None
        for track in list(animation_data.nla_tracks):
            strip_actions = {
                strip.action.name for strip in track.strips if strip.action is not None
            }
            if not strip_actions or not strip_actions.issubset(keep):
                animation_data.nla_tracks.remove(track)

    for action in list(bpy.data.actions):
        if action.name not in keep:
            action.use_fake_user = False
            bpy.data.actions.remove(action, do_unlink=True)

    remaining = {action.name for action in bpy.data.actions}
    if remaining != keep:
        raise RuntimeError(
            f"Action filter mismatch: wanted {sorted(keep)}, got {sorted(remaining)}"
        )


def scene_summary(source: Path, output: Path) -> dict:
    mesh_objects = [obj for obj in bpy.data.objects if obj.type == "MESH"]
    armatures = [obj for obj in bpy.data.objects if obj.type == "ARMATURE"]
    return {
        "source": str(source),
        "output": str(output),
        "objects": len(bpy.data.objects),
        "mesh_objects": len(mesh_objects),
        "armatures": len(armatures),
        "vertices": sum(len(obj.data.vertices) for obj in mesh_objects),
        "triangles": sum(
            len(poly.vertices) - 2 for obj in mesh_objects for poly in obj.data.polygons
        ),
        "materials": len(bpy.data.materials),
        "images": sorted(image.name for image in bpy.data.images),
        "actions": sorted(action.name for action in bpy.data.actions),
    }


def main() -> None:
    args = parse_args()
    source = Path(args.input).resolve()
    output = Path(args.output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)

    clear_scene()
    import_asset(source)
    remove_cameras_and_lights()

    keep = {name for name in args.keep_actions.split(",") if name}
    if keep:
        filter_actions(keep)
    if args.strip_animation_preview_objects:
        strip_animation_preview_objects()
    if args.target_longest_dimension is not None:
        normalize_longest_dimension(args.target_longest_dimension)

    has_actions = bool(bpy.data.actions)
    summary = scene_summary(source, output)
    bpy.ops.export_scene.gltf(
        filepath=str(output),
        check_existing=False,
        export_format="GLB",
        export_yup=True,
        export_apply=False,
        export_cameras=False,
        export_lights=False,
        export_animations=has_actions,
        export_animation_mode="ACTIONS",
        export_skins=True,
        export_morph=True,
        export_materials="EXPORT",
    )
    summary["bytes"] = output.stat().st_size
    print("QUATERNIUS_CONVERSION " + json.dumps(summary, sort_keys=True))


if __name__ == "__main__":
    main()
