import math
from pathlib import Path

import bpy
from mathutils import Matrix

root = Path(__file__).resolve().parents[4]
alt = root / "WebAssetSource/P31/source_work/round005_alt"
bpy.ops.wm.read_factory_settings(use_empty=True)
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=str(alt / "glb/vespera_hero.glb"))
hero_objects = [obj for obj in bpy.data.objects if obj not in before]
hero_top = bpy.data.objects.new("HeroRoot", None)
bpy.context.scene.collection.objects.link(hero_top)
for obj in hero_objects:
    if obj.parent is None:
        obj.parent = hero_top
hero_top.rotation_euler.z = math.pi / 2
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=str(alt / "glb/dawnbreak_claymore.glb"))
weapon_objects = [obj for obj in bpy.data.objects if obj not in before]
weapon_top = bpy.data.objects.new("WeaponRoot", None)
bpy.context.scene.collection.objects.link(weapon_top)
for obj in weapon_objects:
    if obj.parent is None:
        obj.parent = weapon_top
socket = next(obj for obj in hero_objects if obj.name == "weapon_socket")
weapon_top.parent = socket
weapon_top.matrix_parent_inverse = Matrix.Identity(4)
arm = next(obj for obj in hero_objects if obj.type == "ARMATURE")
arm.animation_data_create()
arm.animation_data.action = bpy.data.actions["Sword_Regular_A"]
bpy.context.scene.frame_set(4)
primary = next(obj for obj in weapon_objects if obj.name == "GripPrimary")
contact = next(obj for obj in weapon_objects if obj.name == "ContactMarker")
for degrees in (-90, -60, -45, -30, 0, 30, 45, 60, 90):
    for axis in ("X", "Y", "Z"):
        rotation = [0.0, 0.0, 0.0]
        rotation["XYZ".index(axis)] = math.radians(degrees)
        weapon_top.rotation_euler = rotation
        bpy.context.view_layer.update()
        p = primary.matrix_world.translation
        c = contact.matrix_world.translation
        v = c - p
        print("AXIS", axis, degrees, "vector", tuple(round(x, 3) for x in v), "contact", tuple(round(x, 3) for x in c))
