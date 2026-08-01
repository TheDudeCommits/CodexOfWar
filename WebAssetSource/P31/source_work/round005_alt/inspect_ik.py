import math
from pathlib import Path

import bpy
from mathutils import Matrix

root = Path(__file__).resolve().parents[4]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(root / "WebAssetSource/P31/processed/round004/characters/nyra.glb"))
arm = next(obj for obj in bpy.data.objects if obj.type == "ARMATURE")
arm.animation_data_create()
arm.animation_data.action = bpy.data.actions["Sword_Regular_A"]
scene = bpy.context.scene
hand_bone = arm.data.bones["hand_r"]
socket = bpy.data.objects.new("socket", None)
scene.collection.objects.link(socket)
socket.parent = arm
socket.parent_type = "BONE"
socket.parent_bone = "hand_r"
socket.matrix_parent_inverse = Matrix.Identity(4)
socket.location = (0.0, -hand_bone.length * 0.52, 0.0)
socket.rotation_euler = (math.pi * 0.75, 0.0, 0.0)
target = bpy.data.objects.new("target", None)
scene.collection.objects.link(target)
target.parent = socket
target.matrix_parent_inverse = Matrix.Identity(4)
for frame in (2, 4, 7):
 for offset in (0.08, 0.10, 0.12, 0.14, 0.16):
  target.location = (0.0, 0.0, -offset)
  for chain in (2, 3, 4):
      hand = arm.pose.bones["hand_l"]
      con = hand.constraints.new("IK")
      con.target = target
      con.chain_count = chain
      con.use_tail = False
      scene.frame_set(frame)
      bpy.context.view_layer.update()
      target_world = target.matrix_world.translation
      head_world = arm.matrix_world @ hand.head
      tail_world = arm.matrix_world @ hand.tail
      print(
          "IK_RESULT",
          frame,
          offset,
          chain,
          "dh",
          round((target_world - head_world).length, 5),
          "dt",
          round((target_world - tail_world).length, 5),
      )
      hand.constraints.remove(con)
