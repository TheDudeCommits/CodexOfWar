"""Render Round005 alternate combat samples from the actual runtime camera geometry."""

from __future__ import annotations

import json
import math
import os
from pathlib import Path
import sys

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Matrix, Vector

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from build_alt import (
    HERO_GLB,
    HOLLOW_GLB,
    RENDER_DIR,
    WEAPON_GLB,
    evaluated_mesh_world_bounds,
    evaluate_pair,
    import_glb_collection,
    nearest_mesh_surface_distance,
    palm_marker_distance,
    reset,
    setup_preview_world,
)


LANE = 0.62
TOE = 0.50
WEAPON_ROLL = float(os.environ.get("REV_B_ROLL", "0.0"))
HERO_CENTER_Z = 1.6000008583068848
CAMERA_THREE = Vector((1.3751824359380218, 2.952513372539638, 8.633443361652942))
CAMERA_FORWARD_THREE = Vector((-0.16031367065429453, -0.21829066766426547, -0.9626259457401071))


def three_to_blender(vector: Vector) -> Vector:
    return Vector((vector.x, -vector.z, vector.y))


def main() -> None:
    reset()
    setup_preview_world()
    scene = bpy.context.scene
    hero_root, hero_objects = import_glb_collection(HERO_GLB, "REV_B_HeroRoot")
    hollow_root, hollow_objects = import_glb_collection(HOLLOW_GLB, "REV_B_HollowRoot")
    weapon_root, weapon_objects = import_glb_collection(WEAPON_GLB, "REV_B_WeaponRoot")

    hero_root.location = (-LANE, -HERO_CENTER_Z, 0.0)
    hero_root.rotation_euler.z = math.pi - TOE
    hero_root.scale = (1.22, 1.22, 1.22)
    hollow_root.location = (LANE, 0.0, 0.0)
    hollow_root.rotation_euler.z = -TOE
    hollow_root.scale = (1.16, 1.16, 1.16)

    socket = next(obj for obj in hero_objects if obj.name == "weapon_socket")
    weapon_root.parent = socket
    weapon_root.matrix_parent_inverse = Matrix.Identity(4)
    weapon_root.location = (0.0, 0.0, 0.0)
    weapon_root.rotation_euler = (0.0, 0.0, WEAPON_ROLL)
    weapon_root.scale = (1.0, 1.0, 1.0)

    hero_armature = next(obj for obj in hero_objects if obj.type == "ARMATURE")
    hollow_armature = next(obj for obj in hollow_objects if obj.type == "ARMATURE")
    primary_marker = next(obj for obj in weapon_objects if obj.name == "GripPrimary")
    secondary_marker = next(obj for obj in weapon_objects if obj.name == "GripSecondary")
    contact_marker = next(obj for obj in weapon_objects if obj.name == "ContactMarker")
    blade_tip = next(obj for obj in weapon_objects if obj.name == "BladeTip")
    impact_socket = next(obj for obj in hollow_objects if obj.name == "impact_socket")

    camera = scene.camera
    camera.location = three_to_blender(CAMERA_THREE)
    target = three_to_blender(CAMERA_THREE + CAMERA_FORWARD_THREE * 7.15)
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.lens = 16.23

    moments = [
        # Runtime drives clip seconds directly. At 24 fps the deterministic
        # capture samples 0.0833/0.1667/0.2833 s at hero frames 2/4/6.8.
        # HitReact begins at frame 0 on S04 and reaches frame 5.8 by S05.
        ("S03", "Idle", 2.0, 2.0),
        ("S04", "HitReact", 4.0, 0.0),
        ("S05", "HitReact", 6.8, 5.8),
    ]
    requested_moment = os.environ.get("REV_B_MOMENT")
    if requested_moment:
        moments = [moment for moment in moments if moment[0] == requested_moment]
    report: dict[str, object] = {
        "layout": {"lane": LANE, "toe": TOE, "weapon_roll": WEAPON_ROLL},
        "moments": {},
    }
    for name, hollow_action, hero_frame, hollow_frame in moments:
        hero_armature.animation_data_create()
        hollow_armature.animation_data_create()
        hero_armature.animation_data.action = None
        hollow_armature.animation_data.action = bpy.data.actions[hollow_action]
        whole_hollow = int(math.floor(hollow_frame))
        scene.frame_set(whole_hollow)
        scene.frame_subframe = hollow_frame - whole_hollow
        bpy.context.view_layer.update()
        hollow_basis = {
            bone.name: bone.matrix_basis.copy() for bone in hollow_armature.pose.bones
        }
        hollow_armature.animation_data.action = None
        hero_armature.animation_data.action = bpy.data.actions["Sword_Regular_A"]
        whole = int(math.floor(hero_frame))
        scene.frame_set(whole)
        scene.frame_subframe = hero_frame - whole
        bpy.context.view_layer.update()
        for bone in hollow_armature.pose.bones:
            bone.matrix_basis = hollow_basis[bone.name]
        bpy.context.view_layer.update()
        primary = primary_marker.matrix_world.translation
        secondary = secondary_marker.matrix_world.translation
        contact = contact_marker.matrix_world.translation
        tip = blade_tip.matrix_world.translation
        screen_primary = world_to_camera_view(scene, camera, primary)
        screen_contact = world_to_camera_view(scene, camera, contact)
        screen_tip = world_to_camera_view(scene, camera, tip)
        blade_mesh = next(obj for obj in weapon_objects if obj.name == "Dawnbreak_Blade")
        evaluated_blade = blade_mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
        blade_data = evaluated_blade.to_mesh()
        try:
            blade_pixels = []
            for vertex in blade_data.vertices:
                projected = world_to_camera_view(
                    scene, camera, evaluated_blade.matrix_world @ vertex.co
                )
                blade_pixels.append(
                    Vector(
                        (
                            projected.x * scene.render.resolution_x,
                            projected.y * scene.render.resolution_y,
                        )
                    )
                )
        finally:
            evaluated_blade.to_mesh_clear()
        line = Vector(
            (
                (screen_tip.x - screen_primary.x) * scene.render.resolution_x,
                (screen_tip.y - screen_primary.y) * scene.render.resolution_y,
            )
        )
        normal = Vector((-line.y, line.x)).normalized()
        perpendicular = [pixel.dot(normal) for pixel in blade_pixels]
        surface_distance, surface_object = nearest_mesh_surface_distance(contact, hollow_objects)
        impact = impact_socket.matrix_world.translation
        hero_torso = hero_armature.matrix_world @ hero_armature.pose.bones["spine_02"].head
        hollow_torso = hollow_armature.matrix_world @ hollow_armature.pose.bones["Torso"].head
        hero_bounds = evaluated_mesh_world_bounds(hero_objects)
        hollow_bounds = evaluated_mesh_world_bounds(hollow_objects)
        report["moments"][name] = {
            "hero_frame": hero_frame,
            "hollow_frame": hollow_frame,
            "primary_palm_m": palm_marker_distance(hero_armature, "hand_r", primary),
            "secondary_palm_m": palm_marker_distance(hero_armature, "hand_l", secondary),
            "contact_to_hollow_surface_m": surface_distance,
            "nearest_surface_object": surface_object,
            "primary_world": list(primary),
            "contact_world": list(contact),
            "tip_world": list(tip),
            "impact_socket_world": list(impact),
            "hero_torso_world": list(hero_torso),
            "hollow_torso_world": list(hollow_torso),
            "hero_visible_min_z_m": hero_bounds[0].z,
            "hollow_visible_min_z_m": hollow_bounds[0].z,
            "screen_primary": [screen_primary.x, screen_primary.y, screen_primary.z],
            "screen_contact": [screen_contact.x, screen_contact.y, screen_contact.z],
            "screen_tip": [screen_tip.x, screen_tip.y, screen_tip.z],
            "screen_grip_to_contact_px": math.hypot(
                (screen_contact.x - screen_primary.x) * scene.render.resolution_x,
                (screen_contact.y - screen_primary.y) * scene.render.resolution_y,
            ),
            "screen_grip_to_tip_px": math.hypot(
                (screen_tip.x - screen_primary.x) * scene.render.resolution_x,
                (screen_tip.y - screen_primary.y) * scene.render.resolution_y,
            ),
            "screen_blade_perpendicular_width_px": max(perpendicular) - min(perpendicular),
        }
        if os.environ.get("REV_B_NO_RENDER") != "1":
            label = os.environ.get("REV_B_LABEL", name)
            scene.render.filepath = str(RENDER_DIR / f"REV_B_probe_{label}.png")
            bpy.ops.render.render(write_still=True)
    print("REV_B_RUNTIME_PROBE=" + json.dumps(report, sort_keys=True))


if __name__ == "__main__":
    main()
