"""Build the isolated P31 Round005 alternate hero / Hollow / claymore package.

Run with Blender 5.2+:
  blender --factory-startup --disable-autoexec --background --python build_alt.py

The script reads lawful repository sources but writes only beside itself.
"""

from __future__ import annotations

import json
import math
from pathlib import Path
import sys

import bmesh
import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
sys.path.insert(0, str(HERE))

from blender_common import (  # noqa: E402
    activate,
    assign_material,
    bind_rigid,
    export_glb,
    limit_weights,
    mesh_summary,
    remove_object,
    sha256,
    simple_material,
    write_json,
)


NYRA_SOURCE = ROOT / "WebAssetSource/P31/processed/round004/characters/nyra.glb"
ZOMBIE_SOURCE = ROOT / "WebAssetSource/P31/processed/quaternius/models/zombie_basic.glb"
SKULL_BLEND = (
    ROOT
    / "WebAssetSource/P31/source_work/round005/downloads/"
    "human-base-meshes-bundle-v1.0.0/human_base_meshes_bundle.blend"
)
SKULL_ZIP = (
    ROOT
    / "WebAssetSource/P31/source_work/round005/downloads/"
    "human-base-meshes-bundle-v1.0.0.zip"
)
RAIN_SOURCE = ROOT / "ArtSource/P10/Round004/ThirdParty/BlenderStudioRain/rain_v3.2.blend"
RAIN_LICENSE = (
    ROOT / "ArtSource/P10/Round004/ThirdParty/BlenderStudioRain/LICENSE-CC-BY-4.0.txt"
)

GLB_DIR = HERE / "glb"
BLEND_DIR = HERE / "blends"
RENDER_DIR = HERE / "renders"
REPORT_DIR = HERE / "reports"

HERO_GLB = GLB_DIR / "vespera_hero.glb"
HOLLOW_GLB = GLB_DIR / "ossuary_hollow.glb"
WEAPON_GLB = GLB_DIR / "dawnbreak_claymore.glb"

HERO_ACTIONS = {"Idle_Loop", "Walk_Loop", "Sprint_Loop", "Roll", "Sword_Regular_A"}
HOLLOW_ACTIONS = {"Idle", "HitReact", "Death"}

RUNTIME_LANE_M = 0.62
RUNTIME_TOE_RAD = 0.50
RUNTIME_WEAPON_ROLL_RAD = 0.60
RUNTIME_HERO_CENTER_Z = 1.6000008583068848
RUNTIME_HERO_SCALE = 1.22
RUNTIME_HOLLOW_SCALE = 1.16
RUNTIME_CAMERA_THREE = Vector((1.3751824359380218, 2.952513372539638, 8.633443361652942))
RUNTIME_CAMERA_FORWARD_THREE = Vector(
    (-0.16031367065429453, -0.21829066766426547, -0.9626259457401071)
)


def point_to_segment_distance(point: Vector, start: Vector, end: Vector) -> float:
    """Measure a grip marker against the palm's exported bone centerline.

    The source rig's hand bones span the palm.  A two-handed marker can sit at
    either end of that short segment as the wrist rolls, so pinning the audit to
    only the head or tail produces a false ~5 cm miss.  Distance to the complete
    segment is stable and intentionally does not credit any palm volume/radius.
    """

    segment = end - start
    length_squared = segment.length_squared
    if length_squared <= 1e-12:
        return (point - start).length
    factor = max(0.0, min(1.0, (point - start).dot(segment) / length_squared))
    closest = start + segment * factor
    return (point - closest).length


def palm_marker_distance(
    armature: bpy.types.Object,
    bone_name: str,
    marker_world: Vector,
) -> float:
    bone = armature.pose.bones[bone_name]
    start = armature.matrix_world @ bone.head
    end = armature.matrix_world @ bone.tail
    return point_to_segment_distance(marker_world, start, end)


def exported_render_meshes(objects: list[bpy.types.Object]) -> list[bpy.types.Object]:
    """Select only meshes that belong to the exported/rendered asset."""

    custom_shapes = {
        bone.custom_shape
        for obj in objects
        if obj.type == "ARMATURE"
        for bone in obj.pose.bones
        if bone.custom_shape is not None
    }
    return [
        source
        for source in objects
        if source.type == "MESH"
        and not source.hide_render
        and source not in custom_shapes
        and not any(
            collection.name == "glTF_not_exported" for collection in source.users_collection
        )
    ]


def nearest_mesh_surface_distance(
    point_world: Vector,
    objects: list[bpy.types.Object],
) -> tuple[float, str]:
    """Return distance to exported/rendered evaluated mesh surface.

    Blender's glTF importer creates non-exported custom bone display meshes in
    a ``glTF_not_exported`` collection.  Those helpers are visible to Python but
    are not part of the Hollow's rendered/exported body, so they must never earn
    a contact pass.
    """

    depsgraph = bpy.context.evaluated_depsgraph_get()
    best_distance = math.inf
    best_name = ""
    for source in exported_render_meshes(objects):
        evaluated = source.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        try:
            vertices = [evaluated.matrix_world @ vertex.co for vertex in mesh.vertices]
            polygons = [tuple(poly.vertices) for poly in mesh.polygons]
            if not vertices or not polygons:
                continue
            tree = BVHTree.FromPolygons(vertices, polygons, all_triangles=False)
            nearest = tree.find_nearest(point_world)
            if nearest is None:
                continue
            distance = float(nearest[3])
            if distance < best_distance:
                best_distance = distance
                best_name = source.name
        finally:
            evaluated.to_mesh_clear()
    if not math.isfinite(best_distance):
        raise RuntimeError("No evaluated Hollow mesh surface available for contact audit")
    return best_distance, best_name


def evaluated_mesh_world_bounds(
    objects: list[bpy.types.Object],
) -> tuple[Vector, Vector]:
    """Return world bounds of only exported/rendered evaluated geometry."""

    depsgraph = bpy.context.evaluated_depsgraph_get()
    minimum = Vector((math.inf, math.inf, math.inf))
    maximum = Vector((-math.inf, -math.inf, -math.inf))
    found = False
    for source in exported_render_meshes(objects):
        evaluated = source.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        try:
            for vertex in mesh.vertices:
                world = evaluated.matrix_world @ vertex.co
                for axis in range(3):
                    minimum[axis] = min(minimum[axis], world[axis])
                    maximum[axis] = max(maximum[axis], world[axis])
                found = True
        finally:
            evaluated.to_mesh_clear()
    if not found:
        raise RuntimeError("No exported/rendered evaluated mesh available for bounds audit")
    return minimum, maximum


def reset() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.engine = "BLENDER_EEVEE"
    bpy.context.scene.render.image_settings.file_format = "PNG"
    bpy.context.scene.render.resolution_percentage = 100
    bpy.context.scene.render.film_transparent = False


def apply_deterministic_triangulation(obj: bpy.types.Object) -> None:
    """Resolve DCC-side polygon splitting before glTF export.

    Blender's exporter may choose equivalent but byte-different pole diagonals
    for generated spheres between clean processes.  Applying a fixed-method
    triangulation while the mesh is still unskinned makes rebuilt GLBs stable.
    """

    modifier = obj.modifiers.new("DeterministicTriangulation", "TRIANGULATE")
    modifier.quad_method = "FIXED"
    modifier.ngon_method = "CLIP"
    activate(obj)
    bpy.ops.object.modifier_apply(modifier=modifier.name)


def mesh_object(
    name: str,
    vertices: list[tuple[float, float, float]],
    faces: list[tuple[int, ...]],
    material: bpy.types.Material,
    *,
    armature: bpy.types.Object | None = None,
    bone: str | None = None,
    bevel: float = 0.0,
) -> bpy.types.Object:
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.validate(verbose=False)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    if bevel > 0:
        modifier = obj.modifiers.new("ForgedEdge", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
        modifier.limit_method = "ANGLE"
        activate(obj)
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    apply_deterministic_triangulation(obj)
    assign_material(obj, material)
    if armature is not None and bone is not None:
        bind_rigid(obj, armature, bone)
    return obj


def profile_panel(
    name: str,
    outline: list[tuple[float, float, float]],
    thickness_y: float,
    material: bpy.types.Material,
    *,
    armature: bpy.types.Object | None = None,
    bone: str | None = None,
    bevel: float = 0.004,
) -> bpy.types.Object:
    count = len(outline)
    back = [(x, y + thickness_y, z) for x, y, z in outline]
    faces: list[tuple[int, ...]] = [tuple(reversed(range(count))), tuple(range(count, count * 2))]
    for index in range(count):
        nxt = (index + 1) % count
        faces.append((index, nxt, count + nxt, count + index))
    return mesh_object(
        name,
        [*outline, *back],
        faces,
        material,
        armature=armature,
        bone=bone,
        bevel=bevel,
    )


def ellipsoid(
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    material: bpy.types.Material,
    *,
    armature: bpy.types.Object,
    bone: str,
    segments: int = 20,
    rings: int = 12,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    activate(obj)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    apply_deterministic_triangulation(obj)
    assign_material(obj, material)
    bind_rigid(obj, armature, bone)
    return obj


def spike(
    name: str,
    location: tuple[float, float, float],
    radius: float,
    depth: float,
    rotation: tuple[float, float, float],
    material: bpy.types.Material,
    *,
    armature: bpy.types.Object,
    bone: str,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cone_add(
        vertices=10,
        radius1=radius,
        radius2=0.002,
        depth=depth,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    bevel = obj.modifiers.new("BrokenEdge", "BEVEL")
    bevel.width = 0.003
    bevel.segments = 1
    activate(obj)
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    apply_deterministic_triangulation(obj)
    assign_material(obj, material)
    bind_rigid(obj, armature, bone)
    return obj


def join_material_group(
    name: str,
    objects: list[bpy.types.Object],
    armature: bpy.types.Object,
) -> bpy.types.Object:
    if not objects:
        raise RuntimeError(f"{name}: no objects")
    material = objects[0].material_slots[0].material
    for obj in objects:
        matrix_world = obj.matrix_world.copy()
        obj.parent = None
        obj.matrix_world = matrix_world
        for modifier in list(obj.modifiers):
            if modifier.type == "ARMATURE":
                obj.modifiers.remove(modifier)
        activate(obj)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    joined = objects[0]
    joined.name = name
    assign_material(joined, material)
    modifier = joined.modifiers.new("GameplayRig", "ARMATURE")
    modifier.object = armature
    joined.parent = armature
    joined.matrix_parent_inverse = armature.matrix_world.inverted()
    limit_weights(joined)
    return joined


def create_bone_socket(
    armature: bpy.types.Object,
    bone_name: str,
    name: str,
    *,
    along_bone: float,
    rotation: tuple[float, float, float] = (math.pi, 0.0, 0.0),
) -> bpy.types.Object:
    socket = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(socket)
    socket.empty_display_type = "ARROWS"
    socket.empty_display_size = 0.12
    socket.parent = armature
    socket.parent_type = "BONE"
    socket.parent_bone = bone_name
    socket.matrix_parent_inverse = Matrix.Identity(4)
    socket.location = (0.0, along_bone, 0.0)
    socket.rotation_euler = rotation
    return socket


def key_pose_bone_transform(
    bone: bpy.types.PoseBone,
    *,
    frame: float,
) -> None:
    bone.keyframe_insert(data_path="location", frame=frame, group=bone.name)
    if bone.rotation_mode == "QUATERNION":
        bone.keyframe_insert(data_path="rotation_quaternion", frame=frame, group=bone.name)
    elif bone.rotation_mode == "AXIS_ANGLE":
        bone.keyframe_insert(data_path="rotation_axis_angle", frame=frame, group=bone.name)
    else:
        bone.keyframe_insert(data_path="rotation_euler", frame=frame, group=bone.name)
    bone.keyframe_insert(data_path="scale", frame=frame, group=bone.name)


def align_socket_axis(
    armature: bpy.types.Object,
    socket: bpy.types.Object,
    *,
    frame: float,
    desired_axis: Vector,
) -> float:
    """Rotate the right palm so the socket's +Z blade axis matches a target."""

    scene = bpy.context.scene
    scene.frame_set(int(frame))
    bpy.context.view_layer.update()
    current_axis = (socket.matrix_world.to_3x3() @ Vector((0.0, 0.0, 1.0))).normalized()
    desired = desired_axis.normalized()
    delta = current_axis.rotation_difference(desired)
    hand = armature.pose.bones["hand_r"]
    pose = hand.matrix.copy()
    hand.matrix = Matrix.LocRotScale(
        pose.to_translation(),
        delta @ pose.to_quaternion(),
        pose.to_scale(),
    )
    bpy.context.view_layer.update()
    key_pose_bone_transform(hand, frame=frame)
    achieved = (socket.matrix_world.to_3x3() @ Vector((0.0, 0.0, 1.0))).normalized()
    return math.degrees(achieved.angle(desired))


def author_camera_aware_strike(
    armature: bpy.types.Object,
    socket: bpy.types.Object,
) -> dict[str, object]:
    """Place the active strike across the frozen gameplay camera's screen plane.

    Runtime drives this 24 fps clip by elapsed seconds. S04 lands at roughly
    frames 4-5, so the source frame-5 lunge is held across both frames and its
    weapon axis is aimed toward the exterior far shoulder in the representative
    toe=.50/lane=.62 layout. S03 frame 2 and S05 frame ~6.8 remain source poses.
    """

    action = bpy.data.actions.get("Sword_Regular_A")
    if action is None:
        raise RuntimeError("Sword_Regular_A missing before camera-aware authoring")
    armature.animation_data_create()
    armature.animation_data.action = action
    scene = bpy.context.scene

    # Hold the complete source frame-5 lunge at frame 4. This advances both
    # hands from behind the hero center into a reachable contact position while
    # preserving the authored foot plant and whole-body weight transfer.
    scene.frame_set(5)
    bpy.context.view_layer.update()
    snapshot = {
        bone.name: (
            bone.location.copy(),
            bone.rotation_mode,
            bone.rotation_quaternion.copy(),
            bone.rotation_euler.copy(),
            tuple(bone.rotation_axis_angle),
            bone.scale.copy(),
        )
        for bone in armature.pose.bones
    }
    scene.frame_set(4)
    for bone in armature.pose.bones:
        location, rotation_mode, quaternion, euler, axis_angle, scale = snapshot[bone.name]
        bone.location = location
        bone.rotation_mode = rotation_mode
        if rotation_mode == "QUATERNION":
            bone.rotation_quaternion = quaternion
        elif rotation_mode == "AXIS_ANGLE":
            bone.rotation_axis_angle = axis_angle
        else:
            bone.rotation_euler = euler
        bone.scale = scale
        key_pose_bone_transform(bone, frame=4)
    bpy.context.view_layer.update()

    # Hero-local direction corresponding to world (.40, .88, .25) after the
    # representative PI-.50 yaw. It projects strongly screen-right from both
    # grips and terminates on the Hollow's exterior upper torso/shoulder.
    desired_axis = Vector((0.07097154049027377, -0.9655406195224052, 0.25038840327125267))
    angular_errors = {
        str(frame): align_socket_axis(
            armature,
            socket,
            frame=frame,
            desired_axis=desired_axis,
        )
        for frame in (4, 5)
    }
    return {
        "revision": "B",
        "contact_hold_frames": [4, 5],
        "runtime_contact_seconds": 1.0 / 6.0,
        "representative_layout": {
            "toe_rad": RUNTIME_TOE_RAD,
            "lane_m": RUNTIME_LANE_M,
            "weapon_roll_rad": RUNTIME_WEAPON_ROLL_RAD,
        },
        "desired_blade_axis_hero_local": list(desired_axis),
        "max_axis_error_degrees": max(angular_errors.values()),
        "axis_error_degrees_by_frame": angular_errors,
    }


def bake_two_handed_grip(
    armature: bpy.types.Object,
    socket: bpy.types.Object,
) -> dict[str, float]:
    action = bpy.data.actions.get("Sword_Regular_A")
    if action is None:
        raise RuntimeError("Sword_Regular_A missing before grip bake")
    armature.animation_data_create()
    armature.animation_data.action = action
    scene = bpy.context.scene
    start, end = (int(round(value)) for value in action.frame_range)
    scene.frame_start = start
    scene.frame_end = end

    target = bpy.data.objects.new("TwoHandGripBakeTarget", None)
    bpy.context.scene.collection.objects.link(target)
    target.parent = socket
    target.matrix_parent_inverse = Matrix.Identity(4)
    target.location = (0.0, 0.0, -0.120)

    hand = armature.pose.bones["hand_l"]
    ik = hand.constraints.new("IK")
    ik.name = "TwoHandHeavyGrip"
    ik.target = target
    ik.chain_count = 3
    ik.use_tail = False
    ik.iterations = 80

    activate(armature)
    bpy.ops.object.mode_set(mode="POSE")
    bpy.context.view_layer.objects.active = armature
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

    distances: list[float] = []
    for frame in range(start, end + 1):
        scene.frame_set(frame)
        bpy.context.view_layer.update()
        target_world = target.matrix_world.translation
        distances.append(palm_marker_distance(armature, "hand_l", target_world))
    maximum = max(distances)
    mean = sum(distances) / len(distances)
    remove_object(target)
    return {"max_secondary_palm_m": maximum, "mean_secondary_palm_m": mean}


def hero_overlays(
    armature: bpy.types.Object,
    materials: dict[str, bpy.types.Material],
) -> list[bpy.types.Object]:
    metal = materials["metal"]
    crimson = materials["crimson"]
    aether = materials["aether"]
    pieces: list[bpy.types.Object] = []

    # Broad shoulder fins and a high collar create a readable anime/fantasy crown.
    pieces.extend(
        [
            profile_panel(
                "Vespera_MoonPauldron",
                [
                    (0.15, -0.005, 1.48),
                    (0.29, -0.01, 1.53),
                    (0.42, 0.005, 1.48),
                    (0.33, 0.02, 1.42),
                    (0.21, 0.02, 1.42),
                ],
                0.08,
                metal,
                armature=armature,
                bone="clavicle_l",
                bevel=0.007,
            ),
            profile_panel(
                "Vespera_SunPauldron",
                [
                    (-0.15, -0.005, 1.47),
                    (-0.25, -0.015, 1.52),
                    (-0.34, 0.0, 1.47),
                    (-0.28, 0.025, 1.41),
                    (-0.18, 0.02, 1.42),
                ],
                0.07,
                metal,
                armature=armature,
                bone="clavicle_r",
                bevel=0.006,
            ),
            profile_panel(
                "Vespera_HighCollar",
                [
                    (-0.17, 0.075, 1.44),
                    (-0.13, 0.11, 1.62),
                    (0.0, 0.13, 1.69),
                    (0.13, 0.11, 1.62),
                    (0.17, 0.075, 1.44),
                    (0.0, 0.065, 1.48),
                ],
                0.018,
                crimson,
                armature=armature,
                bone="spine_03",
                bevel=0.004,
            ),
            profile_panel(
                "Vespera_AetherCrest",
                [
                    (-0.035, -0.19, 1.37),
                    (0.035, -0.19, 1.37),
                    (0.065, -0.185, 1.27),
                    (0.0, -0.195, 1.18),
                    (-0.065, -0.185, 1.27),
                ],
                0.012,
                aether,
                armature=armature,
                bone="spine_02",
                bevel=0.003,
            ),
        ]
    )

    # Split mantle / coat tails stay outside the legs and survive the S03-S05 silhouette.
    for side, center, bottom, bone in (
        ("L", 0.14, 0.48, "pelvis"),
        ("R", -0.13, 0.57, "pelvis"),
    ):
        pieces.append(
            profile_panel(
                f"Vespera_Mantle_{side}",
                [
                    (center - 0.075, 0.15, 1.12),
                    (center + 0.075, 0.15, 1.12),
                    (center + 0.09, 0.20, 0.72),
                    (center + 0.025, 0.25, bottom),
                    (center - 0.045, 0.23, bottom + 0.09),
                    (center - 0.09, 0.18, 0.78),
                ],
                0.016,
                crimson,
                armature=armature,
                bone=bone,
                bevel=0.005,
            )
        )
    for side, x, bone in (("L", 0.31, "upperarm_l"), ("R", -0.29, "upperarm_r")):
        pieces.append(
            spike(
                f"Vespera_ShoulderBlade_{side}",
                (x, 0.08, 1.52),
                0.035,
                0.22 if side == "L" else 0.16,
                (0.1, math.pi / 2.0, 0.15 if side == "L" else -0.15),
                aether,
                armature=armature,
                bone=bone,
            )
        )
    return pieces


def build_hero() -> dict[str, object]:
    reset()
    bpy.ops.import_scene.gltf(filepath=str(NYRA_SOURCE))
    armatures = [obj for obj in bpy.data.objects if obj.type == "ARMATURE"]
    if len(armatures) != 1:
        raise RuntimeError(f"hero armature count {len(armatures)}")
    armature = armatures[0]
    armature.name = "Vespera_GameplayRig"
    source_meshes = [
        obj
        for obj in bpy.data.objects
        if obj.type == "MESH" and obj.vertex_groups and obj.find_armature() == armature
    ]
    for obj in list(bpy.data.objects):
        if obj.type == "MESH" and obj not in source_meshes:
            remove_object(obj)

    ratios = {
        "Nyra_Draw_FaceSkinEyes": 0.56,
        "Nyra_Draw_Hair": 0.58,
        "Nyra_Draw_CopperArmor": 0.47,
        "Nyra_Draw_IvoryArmor": 0.72,
        "Nyra_Draw_TealCloth": 0.43,
    }
    weight_audit: dict[str, dict[str, int]] = {}
    for obj in source_meshes:
        ratio = ratios.get(obj.name, 0.5)
        modifier = obj.modifiers.new("AlternateWebLOD", "DECIMATE")
        modifier.decimate_type = "COLLAPSE"
        modifier.ratio = ratio
        modifier.use_collapse_triangulate = True
        activate(obj)
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        weight_audit[obj.name] = limit_weights(obj)

    # Re-art direct-color materials into a darker high-contrast fantasy palette.
    palette = {
        "Nyra_CopperArmor": ((0.12, 0.025, 0.018, 1.0), 0.72, 0.30),
        "Nyra_IvoryArmor": ((0.33, 0.29, 0.22, 1.0), 0.55, 0.34),
        "Nyra_TealCloth": ((0.018, 0.025, 0.052, 1.0), 0.02, 0.78),
    }
    for name, (color, metallic, roughness) in palette.items():
        material = bpy.data.materials.get(name)
        if material and material.use_nodes:
            node = material.node_tree.nodes.get("Principled BSDF")
            if node:
                node.inputs["Base Color"].default_value = color
                node.inputs["Metallic"].default_value = metallic
                node.inputs["Roughness"].default_value = roughness
            material.diffuse_color = color

    materials = {
        "metal": simple_material(
            "Vespera_Nightsteel", (0.055, 0.075, 0.11, 1.0), metallic=0.84, roughness=0.26
        ),
        "crimson": simple_material(
            "Vespera_CrimsonMantle", (0.19, 0.012, 0.025, 1.0), metallic=0.02, roughness=0.76
        ),
        "aether": simple_material(
            "Vespera_AetherInlay",
            (0.025, 0.38, 0.52, 1.0),
            metallic=0.12,
            roughness=0.24,
            emissive=(0.02, 0.28, 0.50),
            emissive_strength=1.8,
        ),
    }
    overlays = hero_overlays(armature, materials)
    overlay_groups = {
        material_key: [obj for obj in overlays if obj.material_slots[0].material == material]
        for material_key, material in materials.items()
    }
    grouped: list[bpy.types.Object] = []
    for material_key, members in overlay_groups.items():
        grouped.append(join_material_group(f"Vespera_Draw_{material_key}", members, armature))

    available = {action.name for action in bpy.data.actions}
    if not HERO_ACTIONS.issubset(available):
        raise RuntimeError(f"hero actions missing {sorted(HERO_ACTIONS - available)}")
    for action in list(bpy.data.actions):
        if action.name in HERO_ACTIONS:
            action.use_fake_user = True
        else:
            bpy.data.actions.remove(action, do_unlink=True)

    hand_bone = armature.data.bones["hand_r"]
    socket = create_bone_socket(
        armature,
        "hand_r",
        "weapon_socket",
        along_bone=-hand_bone.length * 0.52,
        # The -45 degree local pitch turns the source action's groundward sweep
        # into a shoulder-height cutting plane while preserving both grip targets.
        rotation=(math.pi * 0.75, 0.0, 0.0),
    )
    camera_aware_contact = author_camera_aware_strike(armature, socket)
    grip_audit = bake_two_handed_grip(armature, socket)

    runtime = [armature, socket, *source_meshes, *grouped]
    summary = mesh_summary(runtime)
    if not 34_000 <= int(summary["triangles"]) <= 46_000:
        raise RuntimeError(f"hero triangle target failed {summary}")
    if {action.name for action in bpy.data.actions} != HERO_ACTIONS:
        raise RuntimeError(f"hero action drift {[action.name for action in bpy.data.actions]}")
    BLEND_DIR.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_DIR / "vespera_hero.blend"))
    export_glb(HERO_GLB, runtime, animations=True)
    return {
        "source_sha256": sha256(NYRA_SOURCE),
        "output_sha256": sha256(HERO_GLB),
        "bytes": HERO_GLB.stat().st_size,
        "bones": len(armature.data.bones),
        "clips": sorted(HERO_ACTIONS),
        "socket": "weapon_socket",
        "camera_aware_contact": camera_aware_contact,
        "grip_bake": grip_audit,
        "weights": weight_audit,
        **summary,
    }


def scale_hollow_rest(armature: bpy.types.Object, body: bpy.types.Object) -> None:
    # Remove the source's oversized cartoon cranium; the CC0 skull/hood is a true replacement.
    editable = bmesh.new()
    editable.from_mesh(body.data)
    head_vertices = [vertex for vertex in editable.verts if vertex.co.z > 0.905]
    bmesh.ops.delete(editable, geom=head_vertices, context="VERTS")
    editable.to_mesh(body.data)
    editable.free()
    for vertex in body.data.vertices:
        vertex.co.x *= 0.84
        vertex.co.z = 0.012 + (vertex.co.z - 0.012) * 1.30
        if vertex.co.z > 0.72:
            vertex.co.y += 0.035 * ((vertex.co.z - 0.72) / 0.55)
    body.data.update()
    activate(armature)
    bpy.ops.object.mode_set(mode="EDIT")
    for bone in armature.data.edit_bones:
        for endpoint in (bone.head, bone.tail):
            endpoint.x *= 0.84
            endpoint.z = 0.012 + (endpoint.z - 0.012) * 1.30
            if endpoint.z > 0.72:
                endpoint.y += 0.035 * ((endpoint.z - 0.72) / 0.55)
    bpy.ops.object.mode_set(mode="OBJECT")


def append_realistic_skull() -> bpy.types.Object:
    with bpy.data.libraries.load(str(SKULL_BLEND), link=False) as (source, target):
        if "Skull - Realistic" not in source.objects:
            raise RuntimeError("CC0 realistic skull object missing")
        target.objects = ["Skull - Realistic"]
    skull = target.objects[0]
    bpy.context.scene.collection.objects.link(skull)
    for modifier in list(skull.modifiers):
        skull.modifiers.remove(modifier)
    skull.location = (0.0, -0.095, 1.285)
    skull.rotation_euler = (0.0, 0.0, 0.0)
    skull.scale = (1.36, 1.24, 1.34)
    activate(skull)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    modifier = skull.modifiers.new("SkullWebLOD", "DECIMATE")
    modifier.decimate_type = "COLLAPSE"
    modifier.ratio = 0.22
    modifier.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    skull.name = "Ossuary_ExposedSkull"
    return skull


def hollow_details(
    armature: bpy.types.Object,
    materials: dict[str, bpy.types.Material],
) -> list[bpy.types.Object]:
    bone = materials["bone"]
    iron = materials["iron"]
    shroud = materials["shroud"]
    rot = materials["rot"]
    pieces: list[bpy.types.Object] = []
    hood = ellipsoid(
        "Ossuary_Hood",
        (0.0, 0.055, 1.28),
        (0.19, 0.13, 0.235),
        shroud,
        armature=armature,
        bone="Head",
        segments=20,
        rings=12,
    )
    # Open the face side so the CC0 skull remains the dominant silhouette.
    hood_mesh = bmesh.new()
    hood_mesh.from_mesh(hood.data)
    open_face = [vertex for vertex in hood_mesh.verts if vertex.co.y < 0.015]
    bmesh.ops.delete(hood_mesh, geom=open_face, context="VERTS")
    hood_mesh.to_mesh(hood.data)
    hood_mesh.free()
    hood.data.update()
    pieces.extend(
        [
            hood,
            profile_panel(
                "Ossuary_RibCage",
                [
                    (-0.23, -0.19, 1.02),
                    (-0.15, -0.22, 1.17),
                    (0.12, -0.22, 1.18),
                    (0.23, -0.18, 1.02),
                    (0.18, -0.17, 0.78),
                    (0.0, -0.20, 0.71),
                    (-0.18, -0.17, 0.80),
                ],
                0.035,
                iron,
                armature=armature,
                bone="Torso",
                bevel=0.008,
            ),
            profile_panel(
                "Ossuary_BrokenPauldron",
                [
                    (0.10, -0.02, 1.14),
                    (0.27, -0.01, 1.25),
                    (0.46, 0.03, 1.18),
                    (0.37, 0.08, 1.08),
                    (0.18, 0.07, 1.07),
                ],
                0.10,
                bone,
                armature=armature,
                bone="Shoulder.L",
                bevel=0.009,
            ),
            profile_panel(
                "Ossuary_JawGuard",
                [
                    (-0.16, -0.205, 1.22),
                    (-0.10, -0.245, 1.13),
                    (0.09, -0.245, 1.12),
                    (0.17, -0.205, 1.21),
                    (0.11, -0.22, 1.04),
                    (-0.12, -0.22, 1.05),
                ],
                0.022,
                iron,
                armature=armature,
                bone="Head",
                bevel=0.005,
            ),
            profile_panel(
                "Ossuary_HeartRot",
                [
                    (-0.055, -0.235, 1.03),
                    (0.035, -0.24, 1.08),
                    (0.095, -0.235, 0.99),
                    (0.02, -0.245, 0.91),
                    (-0.075, -0.235, 0.95),
                ],
                0.012,
                rot,
                armature=armature,
                bone="Torso",
                bevel=0.003,
            ),
        ]
    )
    for side, x in (("L", -0.052), ("R", 0.052)):
        pieces.append(
            ellipsoid(
                f"Ossuary_GravefireEye_{side}",
                (x, -0.225, 1.315),
                (0.018, 0.010, 0.014),
                rot,
                armature=armature,
                bone="Head",
                segments=12,
                rings=7,
            )
        )
    # Long offset shroud panels create a broken, non-human lower silhouette.
    pieces.extend(
        [
            profile_panel(
                "Ossuary_ShroudLeft",
                [
                    (-0.29, 0.17, 0.83),
                    (0.03, 0.18, 0.86),
                    (0.08, 0.26, 0.21),
                    (-0.08, 0.31, 0.05),
                    (-0.31, 0.25, 0.29),
                ],
                0.018,
                shroud,
                armature=armature,
                bone="Hips",
                bevel=0.004,
            ),
            profile_panel(
                "Ossuary_ShroudRight",
                [
                    (0.02, 0.16, 0.83),
                    (0.27, 0.17, 0.79),
                    (0.32, 0.27, 0.39),
                    (0.18, 0.30, 0.20),
                    (0.07, 0.25, 0.33),
                ],
                0.018,
                shroud,
                armature=armature,
                bone="Hips",
                bevel=0.004,
            ),
        ]
    )
    for index, (location, rotation, depth) in enumerate(
        [
            ((0.20, 0.13, 1.24), (-1.1, 0.15, -0.25), 0.24),
            ((0.31, 0.13, 1.20), (-1.0, -0.10, 0.10), 0.19),
            ((-0.12, 0.10, 1.35), (-0.45, -0.15, -0.2), 0.18),
            ((0.10, 0.10, 1.39), (-0.55, 0.12, 0.22), 0.23),
        ]
    ):
        pieces.append(
            spike(
                f"Ossuary_CrownSpike_{index}",
                location,
                0.028 if index < 2 else 0.02,
                depth,
                rotation,
                bone,
                armature=armature,
                bone="Torso" if index < 2 else "Head",
            )
        )
    # One visibly skeletal forearm and two talons carry the undead read at distance.
    pieces.append(
        ellipsoid(
            "Ossuary_ExposedUlna",
            (-0.49, 0.08, 1.08),
            (0.25, 0.038, 0.045),
            bone,
            armature=armature,
            bone="LowerArm.R",
            segments=16,
            rings=9,
        )
    )
    for index, (x, z) in enumerate(((-0.78, 1.06), (-0.82, 1.02))):
        pieces.append(
            spike(
                f"Ossuary_Talon_{index}",
                (x, 0.05 + index * 0.04, z),
                0.018,
                0.16,
                (0.0, math.pi / 2.0, 0.0),
                bone,
                armature=armature,
                bone="Index3.R" if index == 0 else "Middle3.R",
            )
        )
    return pieces


def replace_hit_react(armature: bpy.types.Object) -> None:
    old = bpy.data.actions.get("HitReact")
    if old:
        bpy.data.actions.remove(old, do_unlink=True)
    action = bpy.data.actions.new("HitReact")
    action.use_fake_user = True
    armature.animation_data_create()
    armature.animation_data.action = action
    scene = bpy.context.scene
    scene.frame_start = 0
    scene.frame_end = 14
    keyed = [
        (0, {"Hips": (0, 0, 0), "Abdomen": (0, 0, 0), "Torso": (0, 0, 0), "Head": (0, 0, 0)}),
        (
            3,
            {
                "Hips": (math.radians(-8), math.radians(4), math.radians(-10)),
                "Abdomen": (math.radians(-18), math.radians(10), math.radians(-18)),
                "Torso": (math.radians(-24), math.radians(14), math.radians(-25)),
                "Head": (math.radians(-18), math.radians(-8), math.radians(18)),
                "UpperArm.L": (math.radians(35), 0, math.radians(-28)),
                "UpperArm.R": (math.radians(-25), 0, math.radians(34)),
            },
        ),
        (
            7,
            {
                "Hips": (math.radians(-12), math.radians(8), math.radians(-18)),
                "Abdomen": (math.radians(-30), math.radians(16), math.radians(-24)),
                "Torso": (math.radians(-34), math.radians(22), math.radians(-31)),
                "Head": (math.radians(-28), math.radians(-14), math.radians(25)),
                "UpperArm.L": (math.radians(58), math.radians(8), math.radians(-38)),
                "UpperArm.R": (math.radians(-42), math.radians(-6), math.radians(46)),
            },
        ),
        (
            14,
            {
                "Hips": (0, 0, math.radians(-4)),
                "Abdomen": (math.radians(-5), 0, math.radians(-5)),
                "Torso": (math.radians(-8), math.radians(2), math.radians(-7)),
                "Head": (math.radians(-5), 0, math.radians(4)),
                "UpperArm.L": (0, 0, 0),
                "UpperArm.R": (0, 0, 0),
            },
        ),
    ]
    all_names = sorted({name for _, pose in keyed for name in pose})
    for frame, pose in keyed:
        scene.frame_set(frame)
        for name in all_names:
            bone = armature.pose.bones[name]
            bone.rotation_mode = "XYZ"
            bone.rotation_euler = pose.get(name, (0.0, 0.0, 0.0))
            bone.keyframe_insert(data_path="rotation_euler", frame=frame, group=name)
    for fcurve in action.layers[0].strips[0].channelbags[0].fcurves:
        for point in fcurve.keyframe_points:
            point.interpolation = "BEZIER"


def build_hollow() -> dict[str, object]:
    reset()
    bpy.ops.import_scene.gltf(filepath=str(ZOMBIE_SOURCE))
    armatures = [obj for obj in bpy.data.objects if obj.type == "ARMATURE"]
    if len(armatures) != 1:
        raise RuntimeError(f"hollow armature count {len(armatures)}")
    armature = armatures[0]
    armature.name = "Ossuary_GameplayRig"
    body = bpy.data.objects.get("Zombie")
    if body is None:
        raise RuntimeError("Zombie body missing")
    for obj in list(bpy.data.objects):
        if obj.type == "MESH" and obj != body:
            remove_object(obj)
    scale_hollow_rest(armature, body)
    corpse = simple_material(
        "Ossuary_CharredCorpse", (0.022, 0.032, 0.028, 1.0), metallic=0.0, roughness=0.94
    )
    assign_material(body, corpse)
    modifier = body.modifiers.new("CorpseSurfaceLOD", "DECIMATE")
    modifier.ratio = 0.95
    modifier.use_collapse_triangulate = True
    activate(body)
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    body_weight_audit = limit_weights(body)

    materials = {
        "bone": simple_material(
            "Ossuary_ExposedBone", (0.42, 0.36, 0.24, 1.0), metallic=0.02, roughness=0.72
        ),
        "iron": simple_material(
            "Ossuary_BlackIron", (0.025, 0.032, 0.038, 1.0), metallic=0.78, roughness=0.38
        ),
        "shroud": simple_material(
            "Ossuary_RotShroud", (0.018, 0.028, 0.026, 1.0), metallic=0.0, roughness=0.94
        ),
        "rot": simple_material(
            "Ossuary_GravefireRot",
            (0.30, 0.025, 0.004, 1.0),
            metallic=0.0,
            roughness=0.30,
            emissive=(0.78, 0.035, 0.004),
            emissive_strength=2.4,
        ),
    }
    skull = append_realistic_skull()
    assign_material(skull, materials["bone"])
    bind_rigid(skull, armature, "Head")
    details = hollow_details(armature, materials)
    detail_groups = {
        material_key: [
            obj for obj in [skull, *details] if obj.material_slots[0].material == material
        ]
        for material_key, material in materials.items()
    }
    grouped: list[bpy.types.Object] = []
    for material_key, members in detail_groups.items():
        grouped.append(join_material_group(f"Ossuary_Draw_{material_key}", members, armature))

    available = {action.name for action in bpy.data.actions}
    if not HOLLOW_ACTIONS.issubset(available):
        raise RuntimeError(f"Hollow actions missing {sorted(HOLLOW_ACTIONS - available)}")
    for action in list(bpy.data.actions):
        if action.name not in HOLLOW_ACTIONS:
            bpy.data.actions.remove(action, do_unlink=True)
    replace_hit_react(armature)
    for action in bpy.data.actions:
        action.use_fake_user = True

    chest_socket = create_bone_socket(
        armature,
        "Torso",
        "impact_socket",
        along_bone=-armature.data.bones["Torso"].length * 0.35,
        rotation=(0.0, 0.0, 0.0),
    )
    runtime = [armature, chest_socket, body, *grouped]
    summary = mesh_summary(runtime)
    if not 11_000 <= int(summary["triangles"]) <= 21_000:
        raise RuntimeError(f"Hollow triangle target failed {summary}")
    if {action.name for action in bpy.data.actions} != HOLLOW_ACTIONS:
        raise RuntimeError(f"Hollow action drift {[action.name for action in bpy.data.actions]}")
    BLEND_DIR.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_DIR / "ossuary_hollow.blend"))
    export_glb(HOLLOW_GLB, runtime, animations=True, canonicalize_indices=True)
    return {
        "source_sha256": sha256(ZOMBIE_SOURCE),
        "skull_bundle_sha256": sha256(SKULL_ZIP),
        "output_sha256": sha256(HOLLOW_GLB),
        "bytes": HOLLOW_GLB.stat().st_size,
        "bones": len(armature.data.bones),
        "clips": sorted(HOLLOW_ACTIONS),
        "socket": "impact_socket",
        "body_weights": body_weight_audit,
        **summary,
    }


def create_marker(name: str, parent: bpy.types.Object, location: tuple[float, float, float]) -> bpy.types.Object:
    marker = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(marker)
    marker.parent = parent
    marker.location = location
    marker.empty_display_type = "SPHERE"
    marker.empty_display_size = 0.045
    return marker


def build_weapon() -> dict[str, object]:
    reset()
    root = bpy.data.objects.new("ClaymoreRoot", None)
    bpy.context.scene.collection.objects.link(root)
    root.empty_display_type = "ARROWS"
    root.empty_display_size = 0.12
    steel = simple_material(
        "Dawnbreak_Steel", (0.46, 0.57, 0.69, 1.0), metallic=0.94, roughness=0.16
    )
    dark = simple_material(
        "Dawnbreak_DarkHilt", (0.035, 0.025, 0.035, 1.0), metallic=0.68, roughness=0.42
    )
    rune = simple_material(
        "Dawnbreak_Rune",
        (0.035, 0.48, 0.72, 1.0),
        metallic=0.12,
        roughness=0.18,
        emissive=(0.02, 0.55, 1.0),
        emissive_strength=3.0,
    )
    blade = profile_panel(
        "Dawnbreak_Blade",
        [
            (-0.085, -0.025, 0.18),
            (-0.15, -0.025, 0.31),
            (-0.145, -0.025, 1.38),
            (-0.075, -0.025, 1.61),
            (0.0, -0.025, 1.72),
            (0.075, -0.025, 1.61),
            (0.145, -0.025, 1.38),
            (0.15, -0.025, 0.31),
            (0.085, -0.025, 0.18),
        ],
        0.05,
        steel,
        bevel=0.012,
    )
    blade.parent = root

    # Forward-swept guard wings keep the weapon broad in S05 recovery.
    guard_left = profile_panel(
        "Dawnbreak_GuardLeft",
        [
            (-0.48, -0.045, 0.13),
            (-0.12, -0.045, 0.10),
            (-0.08, -0.045, 0.20),
            (-0.34, -0.045, 0.26),
        ],
        0.09,
        dark,
        bevel=0.018,
    )
    guard_right = profile_panel(
        "Dawnbreak_GuardRight",
        [
            (0.48, -0.045, 0.13),
            (0.12, -0.045, 0.10),
            (0.08, -0.045, 0.20),
            (0.34, -0.045, 0.26),
        ],
        0.09,
        dark,
        bevel=0.018,
    )
    guard_left.parent = root
    guard_right.parent = root
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.042, depth=0.46, location=(0, 0, -0.09))
    grip = bpy.context.object
    grip.name = "Dawnbreak_TwoHandGrip"
    apply_deterministic_triangulation(grip)
    assign_material(grip, dark)
    grip.parent = root
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, location=(0, 0, -0.35))
    pommel = bpy.context.object
    pommel.name = "Dawnbreak_Pommel"
    pommel.scale = (0.085, 0.055, 0.095)
    activate(pommel)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    apply_deterministic_triangulation(pommel)
    assign_material(pommel, dark)
    pommel.parent = root

    runes: list[bpy.types.Object] = []
    for index, z in enumerate((0.48, 0.78, 1.08, 1.36)):
        rune_obj = profile_panel(
            f"Dawnbreak_Rune_{index}",
            [
                (-0.018, -0.053, z - 0.09),
                (0.018, -0.053, z - 0.06),
                (-0.004, -0.053, z),
                (0.022, -0.053, z + 0.07),
                (-0.016, -0.053, z + 0.10),
                (0.0, -0.053, z + 0.02),
            ],
            0.006,
            rune,
            bevel=0.002,
        )
        rune_obj.parent = root
        runes.append(rune_obj)

    markers = [
        create_marker("GripPrimary", root, (0.0, 0.0, 0.0)),
        create_marker("GripSecondary", root, (0.0, 0.0, -0.120)),
        create_marker("ContactMarker", root, (0.0, 0.0, 1.52)),
        create_marker("BladeTip", root, (0.0, 0.0, 1.72)),
    ]
    runtime = [root, *markers, blade, guard_left, guard_right, grip, pommel, *runes]
    summary = mesh_summary(runtime)
    if int(summary["triangles"]) > 5_000:
        raise RuntimeError(f"weapon budget failed {summary}")
    BLEND_DIR.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_DIR / "dawnbreak_claymore.blend"))
    export_glb(WEAPON_GLB, runtime, animations=False, canonicalize_indices=True)
    return {
        "output_sha256": sha256(WEAPON_GLB),
        "bytes": WEAPON_GLB.stat().st_size,
        "nodes": [marker.name for marker in markers],
        "primary_to_secondary_grip_m": 0.120,
        "primary_to_contact_m": 1.52,
        "primary_to_tip_m": 1.72,
        **summary,
    }


def look_at(obj: bpy.types.Object, target: Vector) -> None:
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def setup_preview_world() -> None:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1600
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.look = "AgX - Medium High Contrast"
    if scene.world is None:
        scene.world = bpy.data.worlds.new("Preview_World")
    scene.world.color = (0.006, 0.008, 0.014)
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.008, 0.012, 0.022, 1.0)
    background.inputs["Strength"].default_value = 0.20

    ground_material = simple_material(
        "Preview_ObsidianFloor", (0.028, 0.035, 0.047, 1.0), metallic=0.12, roughness=0.72
    )
    bpy.ops.mesh.primitive_plane_add(size=18, location=(0, 0, 0))
    ground = bpy.context.object
    ground.name = "Preview_Ground"
    assign_material(ground, ground_material)

    bpy.ops.object.light_add(type="AREA", location=(-3.8, -4.5, 6.2))
    key = bpy.context.object
    key.name = "Preview_Key"
    key.data.energy = 1450
    key.data.shape = "DISK"
    key.data.size = 5.0
    key.data.color = (0.72, 0.86, 1.0)
    look_at(key, Vector((0.0, 0.0, 1.1)))
    bpy.ops.object.light_add(type="AREA", location=(4.0, 1.5, 4.0))
    rim = bpy.context.object
    rim.name = "Preview_Rim"
    rim.data.energy = 1250
    rim.data.size = 4.0
    rim.data.color = (1.0, 0.23, 0.07)
    look_at(rim, Vector((0.3, 0.1, 1.15)))
    bpy.ops.object.light_add(type="AREA", location=(0.0, -0.8, 6.5))
    top = bpy.context.object
    top.name = "Preview_Top"
    top.data.energy = 850
    top.data.size = 3.5
    top.data.color = (0.18, 0.55, 1.0)
    look_at(top, Vector((0.0, 0.0, 0.8)))

    bpy.ops.object.camera_add(location=(4.6, -7.3, 3.15))
    camera = bpy.context.object
    camera.name = "Preview_Camera"
    camera.data.lens = 56
    look_at(camera, Vector((0.0, 0.05, 1.15)))
    scene.camera = camera


def import_glb_collection(path: Path, prefix: str) -> tuple[bpy.types.Object, list[bpy.types.Object]]:
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    imported = [obj for obj in bpy.data.objects if obj not in before]
    root = bpy.data.objects.new(prefix, None)
    bpy.context.scene.collection.objects.link(root)
    top_level = [obj for obj in imported if obj.parent is None]
    for obj in top_level:
        obj.parent = root
    return root, imported


def evaluate_pair(
    hero_armature: bpy.types.Object,
    hero_action_name: str,
    hollow_armature: bpy.types.Object,
    hollow_action_name: str,
    frame: float,
) -> None:
    hero_armature.animation_data_create()
    hollow_armature.animation_data_create()
    hero_armature.animation_data.action = bpy.data.actions[hero_action_name]
    hollow_armature.animation_data.action = bpy.data.actions[hollow_action_name]
    whole = int(math.floor(frame))
    bpy.context.scene.frame_set(whole)
    bpy.context.scene.frame_subframe = frame - whole
    bpy.context.view_layer.update()


def evaluate_independent_pair(
    hero_armature: bpy.types.Object,
    hero_action_name: str,
    hero_frame: float,
    hollow_armature: bpy.types.Object,
    hollow_action_name: str,
    hollow_frame: float,
) -> None:
    """Evaluate actor clips at independent clocks, matching the runtime."""

    scene = bpy.context.scene
    hero_armature.animation_data_create()
    hollow_armature.animation_data_create()
    hero_armature.animation_data.action = None
    hollow_armature.animation_data.action = bpy.data.actions[hollow_action_name]
    whole_hollow = int(math.floor(hollow_frame))
    scene.frame_set(whole_hollow, subframe=hollow_frame - whole_hollow)
    bpy.context.view_layer.update()
    hollow_basis = {
        bone.name: bone.matrix_basis.copy() for bone in hollow_armature.pose.bones
    }

    hollow_armature.animation_data.action = None
    hero_armature.animation_data.action = bpy.data.actions[hero_action_name]
    whole_hero = int(math.floor(hero_frame))
    scene.frame_set(whole_hero, subframe=hero_frame - whole_hero)
    bpy.context.view_layer.update()
    for bone in hollow_armature.pose.bones:
        bone.matrix_basis = hollow_basis[bone.name]
    bpy.context.view_layer.update()


def three_to_blender(vector: Vector) -> Vector:
    """Map Three.js (X right, Y up, Z depth) to Blender coordinates."""

    return Vector((vector.x, -vector.z, vector.y))


def screen_point(scene: bpy.types.Scene, camera: bpy.types.Object, point: Vector) -> list[float]:
    projected = world_to_camera_view(scene, camera, point)
    return [float(projected.x), float(projected.y), float(projected.z)]


def screen_distance_px(first: list[float], second: list[float]) -> float:
    scene = bpy.context.scene
    return math.hypot(
        (second[0] - first[0]) * scene.render.resolution_x,
        (second[1] - first[1]) * scene.render.resolution_y,
    )


def projected_mesh_perpendicular_width_px(
    mesh_object: bpy.types.Object,
    camera: bpy.types.Object,
    line_start: list[float],
    line_end: list[float],
) -> float:
    """Measure projected blade-face thickness perpendicular to its long axis."""

    scene = bpy.context.scene
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = mesh_object.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    try:
        pixels: list[Vector] = []
        for vertex in mesh.vertices:
            point = world_to_camera_view(scene, camera, evaluated.matrix_world @ vertex.co)
            pixels.append(
                Vector(
                    (
                        point.x * scene.render.resolution_x,
                        point.y * scene.render.resolution_y,
                    )
                )
            )
    finally:
        evaluated.to_mesh_clear()
    line = Vector(
        (
            (line_end[0] - line_start[0]) * scene.render.resolution_x,
            (line_end[1] - line_start[1]) * scene.render.resolution_y,
        )
    )
    if line.length <= 1e-6 or not pixels:
        return 0.0
    normal = Vector((-line.y, line.x)).normalized()
    offsets = [pixel.dot(normal) for pixel in pixels]
    return float(max(offsets) - min(offsets))


def render_duel(hero_report: dict[str, object], hollow_report: dict[str, object]) -> dict[str, object]:
    reset()
    setup_preview_world()
    scene = bpy.context.scene
    hero_root, hero_objects = import_glb_collection(HERO_GLB, "Vespera_PreviewRoot")
    hollow_root, hollow_objects = import_glb_collection(HOLLOW_GLB, "Ossuary_PreviewRoot")
    weapon_root, weapon_objects = import_glb_collection(WEAPON_GLB, "Dawnbreak_PreviewRoot")
    # Exact representative roots selected from the 45-transform runtime sweep.
    # Three.js local X offsets become Blender X; Three.js world Z becomes -Y.
    hero_root.location = (-RUNTIME_LANE_M, -RUNTIME_HERO_CENTER_Z, 0.0)
    hero_root.rotation_euler.z = math.pi - RUNTIME_TOE_RAD
    hero_root.scale = (RUNTIME_HERO_SCALE,) * 3
    hollow_root.location = (RUNTIME_LANE_M, 0.0, 0.0)
    hollow_root.rotation_euler.z = -RUNTIME_TOE_RAD
    hollow_root.scale = (RUNTIME_HOLLOW_SCALE,) * 3
    weapon_socket = next(obj for obj in hero_objects if obj.name == "weapon_socket")
    weapon_root.parent = weapon_socket
    weapon_root.matrix_parent_inverse = Matrix.Identity(4)
    weapon_root.location = (0.0, 0.0, 0.0)
    # Blender local Z maps to the weapon's Three.js local +Y blade axis.
    weapon_root.rotation_euler = (0.0, 0.0, RUNTIME_WEAPON_ROLL_RAD)
    weapon_root.scale = (1.0, 1.0, 1.0)
    hero_armature = next(obj for obj in hero_objects if obj.type == "ARMATURE")
    hollow_armature = next(obj for obj in hollow_objects if obj.type == "ARMATURE")
    contact_marker = next(obj for obj in weapon_objects if obj.name == "ContactMarker")
    primary_marker = next(obj for obj in weapon_objects if obj.name == "GripPrimary")
    secondary_marker = next(obj for obj in weapon_objects if obj.name == "GripSecondary")
    impact_socket = next(obj for obj in hollow_objects if obj.name == "impact_socket")
    blade_tip = next(obj for obj in weapon_objects if obj.name == "BladeTip")
    blade_mesh = next(obj for obj in weapon_objects if obj.name == "Dawnbreak_Blade")

    # Captured gameplay camera, mapped from Three.js without changing its view.
    camera = scene.camera
    camera.location = three_to_blender(RUNTIME_CAMERA_THREE)
    camera_target = three_to_blender(
        RUNTIME_CAMERA_THREE + RUNTIME_CAMERA_FORWARD_THREE * 7.15
    )
    look_at(camera, camera_target)
    camera.data.lens = 16.23
    camera.data.clip_start = 0.01
    runtime_camera_matrix = camera.matrix_world.copy()

    moments = [
        ("neutral", "Idle_Loop", 6.0, "Idle", 6.0),
        # Runtime animation is driven directly by attackElapsed at 24 fps.
        ("S03_startup", "Sword_Regular_A", 2.0, "Idle", 2.0),
        ("S04_contact", "Sword_Regular_A", 4.0, "HitReact", 0.0),
        ("S05_recovery", "Sword_Regular_A", 6.8, "HitReact", 5.8),
    ]
    measurements: dict[str, object] = {}
    RENDER_DIR.mkdir(parents=True, exist_ok=True)
    render_paths: list[Path] = []
    for name, hero_action, hero_frame, hollow_action, hollow_frame in moments:
        evaluate_independent_pair(
            hero_armature,
            hero_action,
            hero_frame,
            hollow_armature,
            hollow_action,
            hollow_frame,
        )
        primary = primary_marker.matrix_world.translation
        secondary = secondary_marker.matrix_world.translation
        contact = contact_marker.matrix_world.translation
        tip = blade_tip.matrix_world.translation
        impact = impact_socket.matrix_world.translation
        hero_torso = hero_armature.matrix_world @ hero_armature.pose.bones["spine_02"].head
        hollow_torso = hollow_armature.matrix_world @ hollow_armature.pose.bones["Torso"].head
        actual_surface_distance, actual_surface_object = nearest_mesh_surface_distance(
            contact, hollow_objects
        )
        hero_minimum, hero_maximum = evaluated_mesh_world_bounds(hero_objects)
        hollow_minimum, hollow_maximum = evaluated_mesh_world_bounds(hollow_objects)
        primary_screen = screen_point(scene, camera, primary)
        secondary_screen = screen_point(scene, camera, secondary)
        contact_screen = screen_point(scene, camera, contact)
        tip_screen = screen_point(scene, camera, tip)
        hero_torso_screen = screen_point(scene, camera, hero_torso)
        hollow_torso_screen = screen_point(scene, camera, hollow_torso)
        torso_distance = (hero_torso - hollow_torso).length
        torso_clearance = torso_distance - 0.80
        measurements[name] = {
            "primary_palm_m": palm_marker_distance(hero_armature, "hand_r", primary),
            "secondary_palm_m": palm_marker_distance(hero_armature, "hand_l", secondary),
            "blade_to_impact_socket_m": (contact - impact).length,
            "blade_to_actual_hollow_surface_m": actual_surface_distance,
            "nearest_hollow_surface_object": actual_surface_object,
            "contact_vertical_offset_from_hollow_torso_m": contact.z - hollow_torso.z,
            "torso_center_distance_m": torso_distance,
            "torso_collision_radius_sum_m": 0.80,
            "torso_clearance_estimate_m": torso_clearance,
            "actor_root_planar_separation_m": math.hypot(
                hero_root.location.x - hollow_root.location.x,
                hero_root.location.y - hollow_root.location.y,
            ),
            "hero_visible_world_bounds": [list(hero_minimum), list(hero_maximum)],
            "hollow_visible_world_bounds": [list(hollow_minimum), list(hollow_maximum)],
            "hero_floor_offset_m": hero_minimum.z,
            "hollow_floor_offset_m": hollow_minimum.z,
            "grounded_within_0_10m": (
                -0.10 <= hero_minimum.z <= 0.05
                and -0.10 <= hollow_minimum.z <= 0.05
            ),
            "primary_screen": primary_screen,
            "secondary_screen": secondary_screen,
            "contact_screen": contact_screen,
            "tip_screen": tip_screen,
            "hero_torso_screen": hero_torso_screen,
            "hollow_torso_screen": hollow_torso_screen,
            "screen_grip_to_contact_px": screen_distance_px(primary_screen, contact_screen),
            "screen_grip_to_tip_px": screen_distance_px(primary_screen, tip_screen),
            "screen_torso_separation_px": screen_distance_px(
                hero_torso_screen, hollow_torso_screen
            ),
            "screen_blade_perpendicular_width_px": projected_mesh_perpendicular_width_px(
                blade_mesh, camera, primary_screen, tip_screen
            ),
            "hero_frame": hero_frame,
            "hollow_frame": hollow_frame,
        }
        render_path = RENDER_DIR / f"{name}.png"
        render_paths.append(render_path)
        scene.render.filepath = str(render_path)
        bpy.ops.render.render(write_still=True)

    # A close neutral is supplementary; the three combat renders above retain
    # the exact gameplay camera and actor transform contract.
    camera.location = three_to_blender(
        RUNTIME_CAMERA_THREE + RUNTIME_CAMERA_FORWARD_THREE * 1.65
    )
    look_at(camera, camera_target)
    evaluate_independent_pair(hero_armature, "Idle_Loop", 6.0, hollow_armature, "Idle", 6.0)
    neutral_close = RENDER_DIR / "neutral_close.png"
    render_paths.append(neutral_close)
    scene.render.filepath = str(neutral_close)
    bpy.ops.render.render(write_still=True)
    camera.matrix_world = runtime_camera_matrix
    bpy.context.view_layer.update()

    for moment in ("S03_startup", "S04_contact", "S05_recovery"):
        if float(measurements[moment]["primary_palm_m"]) > 0.04:
            raise RuntimeError(f"{moment}: primary palm exceeds 0.04 m")
        if float(measurements[moment]["secondary_palm_m"]) > 0.04:
            raise RuntimeError(f"{moment}: secondary palm exceeds 0.04 m")
        if not measurements[moment]["grounded_within_0_10m"]:
            raise RuntimeError(f"{moment}: actor grounding gate failed")
        if float(measurements[moment]["torso_clearance_estimate_m"]) <= 0:
            raise RuntimeError(f"{moment}: actor torso overlap gate failed")
    contact_measurement = measurements["S04_contact"]
    if float(contact_measurement["blade_to_actual_hollow_surface_m"]) > 0.08:
        raise RuntimeError("S04: rendered Hollow surface contact exceeds 0.08 m")
    if float(contact_measurement["screen_grip_to_contact_px"]) < 100:
        raise RuntimeError("S04: projected grip-to-contact blade span is below 100 px")
    if float(contact_measurement["screen_blade_perpendicular_width_px"]) < 20:
        raise RuntimeError("S04: projected blade face is below 20 px")
    for moment in ("S03_startup", "S05_recovery"):
        if float(measurements[moment]["screen_torso_separation_px"]) < 100:
            raise RuntimeError(f"{moment}: actor screen separation is below 100 px")

    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_DIR / "duel_evidence.blend"))
    return {
        "renders": {
            path.name: {"bytes": path.stat().st_size, "sha256": sha256(path), "resolution": [1600, 900]}
            for path in sorted(render_paths)
        },
        "runtime_camera_evidence": {
            "source_capture_frames": [
                "ArtSource/P30/Round005/S03.png",
                "ArtSource/P30/Round005/S04.png",
                "ArtSource/P30/Round005/S05.png",
            ],
            "three_position": list(RUNTIME_CAMERA_THREE),
            "three_forward": list(RUNTIME_CAMERA_FORWARD_THREE),
            "blender_position": list(three_to_blender(RUNTIME_CAMERA_THREE)),
            "blender_forward": list(three_to_blender(RUNTIME_CAMERA_FORWARD_THREE)),
            "blender_lens_mm": 16.23,
            "resolution": [1600, 900],
            "coordinate_mapping": "Three (x,y,z) -> Blender (x,-z,y)",
        },
        "representative_runtime_transform": {
            "toe_rad": RUNTIME_TOE_RAD,
            "lane_m": RUNTIME_LANE_M,
            "weapon_roll_rad": RUNTIME_WEAPON_ROLL_RAD,
            "hero_scale": RUNTIME_HERO_SCALE,
            "hollow_scale": RUNTIME_HOLLOW_SCALE,
            "hero_three_center": [0.0, 0.0, RUNTIME_HERO_CENTER_Z],
            "hollow_three_center": [0.0, 0.0, 0.0],
        },
        "runtime_timing": {
            "fixed_timestep_seconds": 1.0 / 60.0,
            "attack_duration_seconds": 26.0 / 60.0,
            "s04_simulation_attack_frame": 10,
            "s04_discrete_phase_11_of_26": 11.0 / 26.0,
            "s04_attack_elapsed_seconds": 10.0 / 60.0,
            "s04_hero_clip_frame_at_24fps": 4.0,
            "contact_pose_hold_frames": [4, 5],
            "moments": {
                "S03_startup": {"hero_frame": 2.0, "hollow_frame": 2.0},
                "S04_contact": {"hero_frame": 4.0, "hollow_frame": 0.0},
                "S05_recovery": {"hero_frame": 6.8, "hollow_frame": 5.8},
            },
        },
        "contact_measurements": measurements,
        "package_visible_triangles": int(hero_report["triangles"])
        + int(hollow_report["triangles"]),
    }


def write_provenance() -> None:
    text = f"""# Source provenance — Round005 alternate duel package

This isolated candidate is not integrated into the runtime manifest.

## Blender Studio Rain v3.2 (hero visual foundation)

- Creator: Blender Studio / Blender Foundation.
- Official page: https://studio.blender.org/characters/rain/v3/
- License: Creative Commons Attribution 4.0 International.
- Repository source: `ArtSource/P10/Round004/ThirdParty/BlenderStudioRain/rain_v3.2.blend`
- Source SHA-256: `{sha256(RAIN_SOURCE)}`
- License proof SHA-256: `{sha256(RAIN_LICENSE)}`
- Immediate lawful derivative input: `WebAssetSource/P31/processed/round004/characters/nyra.glb`
- Immediate input SHA-256: `{sha256(NYRA_SOURCE)}`
- Alternate modifications: deterministic web LOD; dark fantasy palette; new high collar,
  broad asymmetric pauldrons, shoulder blades, aether crest, and split mantle; preserved
  65-bone canonical gameplay rig; baked two-hand secondary grip into the exact
  `Sword_Regular_A` clip; explicit `weapon_socket` node.

## Blender Human Base Meshes bundle v1.0.0 (Hollow skull)

- Publisher: Blender Foundation / Blender Studio and Blender community.
- Official index: https://download.blender.org/demo/bundles/bundles-3.6/
- Official download: https://download.blender.org/demo/bundles/bundles-3.6/human-base-meshes-bundle-v1.0.0.zip
- License: CC0 1.0 Universal (bundle README declares the assets public domain).
- Bundle SHA-256: `{sha256(SKULL_ZIP)}`
- Used object: `Skull - Realistic`; authors credited by the bundle: Paul Kotelevets
  and Tonatiuh de San Julián.
- Alternate modifications: base topology only; modifiers stripped; deterministic
  web decimation; resized and rigid-bound as an exposed skull under a broken hood.

## Quaternius Zombie Basic (Hollow rig/body/Idle/Death foundation)

- Creator: Quaternius.
- Official page: https://quaternius.com/packs/zombieapocalypsekit.html
- License: CC0 1.0 Universal.
- Repository source: `WebAssetSource/P31/processed/quaternius/models/zombie_basic.glb`
- Source SHA-256: `{sha256(ZOMBIE_SOURCE)}`
- Alternate modifications: cartoon cranium deleted; body/rest skeleton elongated;
  charred corpse surface; exposed skull/bone, black-iron rib cage, broken pauldron,
  gravefire rot, crown spikes, skeletal forearm/talons, and split burial shroud added;
  exact `Idle` and `Death` retained; synchronized `HitReact` replaced with original
  Round005 alternate choreography; explicit `impact_socket` node.

## Original alternate work

`Dawnbreak` claymore geometry, rune inlay, named grip/contact nodes, hero armor
overlays, Hollow armor/shroud additions, grip bake, contact choreography, validators,
measurements, preview lighting, and evidence layout are original repository work.

## Rejected scout

Blender Studio Einar v1 (CC BY 4.0) was inspected through the repository's lawful
25,484-triangle LOD2.  That portable LOD is frozen in an industrial civilian/mechanic
pose, has no portable deform rig or texture package, and its dominant mechanical arm
and workwear silhouette could not be transformed into the requested fantasy/anime
hero without discarding the source's main visual identity and runtime clip compatibility.
It is therefore not included in this candidate.
"""
    (HERE / "SOURCE_PROVENANCE.md").write_text(text, encoding="utf-8")


def main() -> None:
    for directory in (GLB_DIR, BLEND_DIR, RENDER_DIR, REPORT_DIR):
        directory.mkdir(parents=True, exist_ok=True)
    hero = build_hero()
    hollow = build_hollow()
    weapon = build_weapon()
    visible = int(hero["triangles"]) + int(hollow["triangles"]) + int(weapon["triangles"])
    if visible > 68_000:
        raise RuntimeError(f"visible package budget exceeded: {visible}")
    preview = render_duel(hero, hollow)
    preview["package_visible_triangles"] = visible
    preview["shadowed_package_triangles_conservative"] = visible * 2
    preview["frozen_non_package_s04_triangles"] = 103_855
    preview["projected_s04_renderer_triangles"] = 103_855 + visible * 2
    preview["projected_s04_limit"] = 250_000
    preview["projected_s04_headroom"] = 250_000 - int(preview["projected_s04_renderer_triangles"])
    report = {
        "schema": "p31.round005.alt-duel-build.v1",
        "integrated": False,
        "acceptance_claimed": False,
        "blender": bpy.app.version_string,
        "hero": hero,
        "hollow": hollow,
        "weapon": weapon,
        "package": {
            "visible_triangles": visible,
            "materials": int(hero["material_count"])
            + int(hollow["material_count"])
            + int(weapon["material_count"]),
            "textures": int(hero["texture_count"])
            + int(hollow["texture_count"])
            + int(weapon["texture_count"]),
            "visible_primitives": int(hero["mesh_objects"])
            + int(hollow["mesh_objects"])
            + int(weapon["mesh_objects"]),
            "target_visible_triangles": 68_000,
        },
        "preview": preview,
        "largest_visual_weakness": (
            "Rain's intentionally stylized facial proportions and the source palette atlas remain less "
            "micro-detailed than the new armor/weapon; at extreme close range the face is the package's "
            "least premium surface."
        ),
    }
    write_json(REPORT_DIR / "build-report.json", report)
    write_provenance()
    print("ROUND005_ALT_BUILD=" + json.dumps(report, sort_keys=True))


if __name__ == "__main__":
    main()
