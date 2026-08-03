import * as THREE from "three";
import { FIXED_TIMESTEP, HEAVY_ATTACK_RECOVERY_LAST_FRAME } from "../../game/simulation/constants";

export const HEAVY_STRIKE_CLIP_NAME = "P30_Heavy_Strike" as const;

export const HEAVY_STRIKE_TRACK_BONES = [
  "root",
  "pelvis",
  "spine_01",
  "spine_02",
  "spine_03",
  "neck_01",
  "clavicle_l",
  "upperarm_l",
  "lowerarm_l",
  "hand_l",
  "clavicle_r",
  "upperarm_r",
  "lowerarm_r",
  "hand_r",
  "weapon_socket",
  "thigh_l",
  "calf_l",
  "foot_l",
  "thigh_r",
  "calf_r",
  "foot_r",
] as const;

type HeavyBoneName = (typeof HEAVY_STRIKE_TRACK_BONES)[number];
type EulerTuple = readonly [number, number, number];

interface HeavyControlPose {
  tick: number;
  rootLocalZ: number;
  rotations: Partial<Record<HeavyBoneName, EulerTuple>>;
}

const N: EulerTuple = [0, 0, 0];

/**
 * Authored control poses for a committed diagonal cleave. The dense clip
 * generated from these controls is independent from the preserved light
 * animation: it has its own root travel, stance, torso coil, arm phrase,
 * weapon-socket arc, follow-through, and recovery.
 */
export const HEAVY_STRIKE_CONTROL_TICKS = Object.freeze([
  0, 8, 14, 19, 20, 21, 22, 24, 34, 42, 49, 56,
]);

const CONTROL_POSES: readonly HeavyControlPose[] = [
  { tick: 0, rootLocalZ: 0, rotations: {} },
  {
    tick: 8,
    rootLocalZ: 0.07,
    rotations: {
      pelvis: [0.04, -0.1, 0.03],
      spine_01: [-0.04, 0.08, -0.02],
      spine_02: [-0.06, 0.12, -0.03],
      spine_03: [-0.04, 0.1, -0.03],
      clavicle_l: [-0.08, 0.08, 0.1],
      upperarm_l: [-0.18, 0.2, 0.14],
      lowerarm_l: [-0.2, -0.05, 0.08],
      clavicle_r: [0.04, -0.18, -0.12],
      upperarm_r: [-0.22, -0.24, -0.2],
      lowerarm_r: [-0.16, 0.04, -0.06],
      weapon_socket: [0.18, -0.32, -0.16],
      thigh_l: [-0.06, 0.02, -0.02],
      calf_l: [0.1, 0, 0],
      thigh_r: [0.08, -0.02, 0.03],
      calf_r: [0.08, 0, 0],
    },
  },
  {
    tick: 14,
    rootLocalZ: 0.17,
    rotations: {
      pelvis: [0.1, -0.28, 0.07],
      spine_01: [-0.1, 0.2, -0.05],
      spine_02: [-0.15, 0.31, -0.08],
      spine_03: [-0.12, 0.27, -0.09],
      neck_01: [0.03, -0.1, 0.02],
      clavicle_l: [-0.16, 0.2, 0.18],
      upperarm_l: [-0.38, 0.42, 0.22],
      lowerarm_l: [-0.35, -0.08, 0.15],
      hand_l: [0.02, 0.08, 0.08],
      clavicle_r: [0.08, -0.36, -0.24],
      upperarm_r: [-0.48, -0.47, -0.34],
      lowerarm_r: [-0.28, 0.08, -0.12],
      hand_r: [0.04, -0.05, -0.12],
      weapon_socket: [0.48, -0.66, -0.34],
      thigh_l: [-0.14, 0.05, -0.04],
      calf_l: [0.24, 0, 0],
      foot_l: [-0.08, 0, 0],
      thigh_r: [0.18, -0.04, 0.06],
      calf_r: [0.18, 0, 0],
      foot_r: [-0.05, 0, 0],
    },
  },
  {
    tick: 19,
    rootLocalZ: 0.6,
    rotations: {
      pelvis: [0.16, -0.43, 0.1],
      spine_01: [-0.16, 0.3, -0.08],
      spine_02: [-0.24, 0.49, -0.13],
      spine_03: [-0.2, 0.43, -0.15],
      neck_01: [0.06, -0.17, 0.04],
      clavicle_l: [-0.25, 0.32, 0.27],
      upperarm_l: [-0.6, 0.64, 0.32],
      lowerarm_l: [-0.54, -0.12, 0.24],
      hand_l: [0.04, 0.13, 0.14],
      clavicle_r: [0.12, -0.54, -0.37],
      upperarm_r: [-0.7, -0.72, -0.48],
      lowerarm_r: [-0.43, 0.12, -0.2],
      hand_r: [0.06, -0.08, -0.2],
      weapon_socket: [0.82, -1.03, -0.5],
      thigh_l: [-0.23, 0.08, -0.07],
      calf_l: [0.38, 0, 0],
      foot_l: [-0.13, 0, 0],
      thigh_r: [0.29, -0.07, 0.1],
      calf_r: [0.31, 0, 0],
      foot_r: [-0.09, 0, 0],
    },
  },
  {
    tick: 20,
    rootLocalZ: 0.82,
    rotations: {
      pelvis: [0.17, -0.47, 0.1],
      spine_01: [-0.17, 0.33, -0.09],
      spine_02: [-0.26, 0.53, -0.14],
      spine_03: [-0.22, 0.47, -0.16],
      neck_01: [0.06, -0.18, 0.04],
      clavicle_l: [-0.27, 0.34, 0.29],
      upperarm_l: [-0.64, 0.68, 0.34],
      lowerarm_l: [-0.57, -0.13, 0.25],
      hand_l: [0.04, 0.14, 0.15],
      clavicle_r: [0.13, -0.58, -0.39],
      upperarm_r: [-0.75, -0.77, -0.51],
      lowerarm_r: [-0.46, 0.13, -0.21],
      hand_r: [0.07, -0.09, -0.22],
      weapon_socket: [0.9, -1.12, -0.54],
      thigh_l: [-0.25, 0.09, -0.08],
      calf_l: [0.41, 0, 0],
      foot_l: [-0.14, 0, 0],
      thigh_r: [0.31, -0.08, 0.11],
      calf_r: [0.34, 0, 0],
      foot_r: [-0.1, 0, 0],
    },
  },
  {
    tick: 21,
    rootLocalZ: 0.98,
    rotations: {
      pelvis: [0.12, -0.31, 0.08],
      spine_01: [-0.12, 0.22, -0.06],
      spine_02: [-0.18, 0.35, -0.1],
      spine_03: [-0.14, 0.3, -0.11],
      neck_01: [0.04, -0.12, 0.03],
      clavicle_l: [-0.2, 0.22, 0.2],
      upperarm_l: [-0.5, 0.42, 0.25],
      lowerarm_l: [-0.48, -0.08, 0.2],
      clavicle_r: [0.08, -0.38, -0.25],
      upperarm_r: [-0.57, -0.48, -0.33],
      lowerarm_r: [-0.38, 0.1, -0.15],
      weapon_socket: [0.34, -0.52, -0.23],
      thigh_l: [-0.2, 0.07, -0.06],
      calf_l: [0.34, 0, 0],
      thigh_r: [0.25, -0.06, 0.08],
      calf_r: [0.27, 0, 0],
    },
  },
  {
    tick: 22,
    rootLocalZ: 1.005,
    rotations: {
      pelvis: [-0.05, 0.26, -0.04],
      spine_01: [0.05, -0.19, 0.04],
      spine_02: [0.09, -0.34, 0.07],
      spine_03: [0.1, -0.38, 0.1],
      neck_01: [-0.03, 0.14, -0.02],
      clavicle_l: [0.1, -0.22, -0.13],
      upperarm_l: [0.28, -0.45, -0.18],
      lowerarm_l: [-0.16, 0.12, 0.1],
      hand_l: [0.02, -0.08, -0.08],
      clavicle_r: [-0.12, 0.35, 0.2],
      upperarm_r: [0.34, 0.54, 0.27],
      lowerarm_r: [-0.12, -0.12, -0.08],
      hand_r: [-0.03, 0.08, 0.11],
      weapon_socket: [-0.44, 0.65, 0.27],
      thigh_l: [0.18, -0.05, 0.04],
      calf_l: [0.12, 0, 0],
      foot_l: [-0.04, 0, 0],
      thigh_r: [-0.18, 0.04, -0.05],
      calf_r: [0.42, 0, 0],
      foot_r: [-0.14, 0, 0],
    },
  },
  {
    tick: 24,
    rootLocalZ: 1.04,
    rotations: {
      pelvis: [-0.1, 0.46, -0.08],
      spine_01: [0.08, -0.31, 0.06],
      spine_02: [0.15, -0.52, 0.11],
      spine_03: [0.17, -0.57, 0.15],
      neck_01: [-0.05, 0.2, -0.04],
      clavicle_l: [0.16, -0.33, -0.2],
      upperarm_l: [0.44, -0.62, -0.26],
      lowerarm_l: [-0.1, 0.18, 0.08],
      clavicle_r: [-0.18, 0.5, 0.28],
      upperarm_r: [0.49, 0.72, 0.38],
      lowerarm_r: [-0.08, -0.18, -0.06],
      weapon_socket: [-0.78, 0.98, 0.4],
      thigh_l: [0.24, -0.07, 0.06],
      calf_l: [0.08, 0, 0],
      thigh_r: [-0.24, 0.06, -0.08],
      calf_r: [0.5, 0, 0],
      foot_r: [-0.17, 0, 0],
    },
  },
  {
    tick: 34,
    rootLocalZ: 0.91,
    rotations: {
      pelvis: [-0.14, 0.6, -0.11],
      spine_01: [0.11, -0.4, 0.08],
      spine_02: [0.21, -0.67, 0.14],
      spine_03: [0.24, -0.72, 0.19],
      neck_01: [-0.07, 0.25, -0.05],
      clavicle_l: [0.22, -0.42, -0.25],
      upperarm_l: [0.58, -0.78, -0.33],
      lowerarm_l: [0.06, 0.24, 0.04],
      clavicle_r: [-0.24, 0.65, 0.36],
      upperarm_r: [0.64, 0.88, 0.47],
      lowerarm_r: [0.04, -0.24, -0.02],
      weapon_socket: [-1.02, 1.2, 0.51],
      thigh_l: [0.28, -0.08, 0.08],
      calf_l: [0.05, 0, 0],
      thigh_r: [-0.29, 0.08, -0.1],
      calf_r: [0.54, 0, 0],
      foot_r: [-0.19, 0, 0],
    },
  },
  {
    tick: 42,
    rootLocalZ: 0.47,
    rotations: {
      pelvis: [-0.07, 0.28, -0.05],
      spine_01: [0.06, -0.2, 0.04],
      spine_02: [0.11, -0.32, 0.07],
      spine_03: [0.12, -0.34, 0.09],
      neck_01: [-0.03, 0.12, -0.02],
      clavicle_l: [0.11, -0.2, -0.12],
      upperarm_l: [0.28, -0.36, -0.16],
      lowerarm_l: [0.03, 0.12, 0.02],
      clavicle_r: [-0.12, 0.3, 0.17],
      upperarm_r: [0.31, 0.42, 0.23],
      lowerarm_r: [0.02, -0.12, -0.01],
      weapon_socket: [-0.46, 0.55, 0.23],
      thigh_l: [0.13, -0.04, 0.04],
      calf_l: [0.02, 0, 0],
      thigh_r: [-0.14, 0.04, -0.05],
      calf_r: [0.26, 0, 0],
      foot_r: [-0.09, 0, 0],
    },
  },
  { tick: 49, rootLocalZ: 0, rotations: {} },
  { tick: 56, rootLocalZ: 0, rotations: {} },
];

interface WeaponAimControl {
  tick: number;
  point: readonly [number, number, number];
  weight: number;
  roll: number;
}

// Points are authored in the hero outer-root space. At contact the blade is
// aimed at the frozen Hollow's near torso edge; adjacent controls describe a
// high right-side load and a low same-direction exit, producing a real arc.
const WEAPON_AIM_CONTROLS: readonly WeaponAimControl[] = [
  { tick: 0, point: [-0.3, 2.1, -0.2], weight: 0, roll: 0 },
  { tick: 8, point: [-1.0, 2.45, 0.1], weight: 0.45, roll: -0.1 },
  { tick: 14, point: [-1.35, 2.7, 0.3], weight: 0.82, roll: -0.18 },
  { tick: 19, point: [-0.2, 2.1, -0.8], weight: 1, roll: -0.16 },
  { tick: 20, point: [0.4, 1.7, -1.9], weight: 1, roll: -0.08 },
  { tick: 21, point: [0.95, 1.15, -2.6], weight: 1, roll: -0.02 },
  { tick: 22, point: [1.115, 1.05, -2.65], weight: 1, roll: 0.08 },
  { tick: 24, point: [1.55, 0.62, -3.0], weight: 1, roll: 0.18 },
  { tick: 34, point: [1.8, 0.38, -2.45], weight: 1, roll: 0.28 },
  { tick: 42, point: [0.65, 0.9, -0.8], weight: 0.72, roll: 0.12 },
  { tick: 49, point: [-0.3, 2.1, -0.2], weight: 0, roll: 0 },
  { tick: 56, point: [-0.3, 2.1, -0.2], weight: 0, roll: 0 },
];

function smootherstep(value: number): number {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function poseAtTick(tick: number): {
  rootLocalZ: number;
  rotations: Record<HeavyBoneName, EulerTuple>;
} {
  let from = CONTROL_POSES[0]!;
  let to = CONTROL_POSES[CONTROL_POSES.length - 1]!;
  for (let index = 0; index < CONTROL_POSES.length - 1; index += 1) {
    const candidate = CONTROL_POSES[index + 1]!;
    if (tick <= candidate.tick) {
      from = CONTROL_POSES[index]!;
      to = candidate;
      break;
    }
  }
  const amount = from.tick === to.tick ? 0 : smootherstep((tick - from.tick) / (to.tick - from.tick));
  const rotations = {} as Record<HeavyBoneName, EulerTuple>;
  for (const name of HEAVY_STRIKE_TRACK_BONES) {
    const a = from.rotations[name] ?? N;
    const b = to.rotations[name] ?? N;
    rotations[name] = [
      THREE.MathUtils.lerp(a[0], b[0], amount),
      THREE.MathUtils.lerp(a[1], b[1], amount),
      THREE.MathUtils.lerp(a[2], b[2], amount),
    ];
  }
  return {
    rootLocalZ: THREE.MathUtils.lerp(from.rootLocalZ, to.rootLocalZ, amount),
    rotations,
  };
}

function weaponAimAtTick(tick: number): WeaponAimControl {
  let from = WEAPON_AIM_CONTROLS[0]!;
  let to = WEAPON_AIM_CONTROLS[WEAPON_AIM_CONTROLS.length - 1]!;
  for (let index = 0; index < WEAPON_AIM_CONTROLS.length - 1; index += 1) {
    const candidate = WEAPON_AIM_CONTROLS[index + 1]!;
    if (tick <= candidate.tick) {
      from = WEAPON_AIM_CONTROLS[index]!;
      to = candidate;
      break;
    }
  }
  const amount = from.tick === to.tick ? 0 : smootherstep((tick - from.tick) / (to.tick - from.tick));
  return {
    tick,
    point: [
      THREE.MathUtils.lerp(from.point[0], to.point[0], amount),
      THREE.MathUtils.lerp(from.point[1], to.point[1], amount),
      THREE.MathUtils.lerp(from.point[2], to.point[2], amount),
    ],
    weight: THREE.MathUtils.lerp(from.weight, to.weight, amount),
    roll: THREE.MathUtils.lerp(from.roll, to.roll, amount),
  };
}

function sampleNeutralPose(
  root: THREE.Object3D,
  idleClip: THREE.AnimationClip,
): Map<HeavyBoneName, { position: THREE.Vector3; quaternion: THREE.Quaternion }> {
  const original = new Map<THREE.Object3D, {
    position: THREE.Vector3;
    quaternion: THREE.Quaternion;
    scale: THREE.Vector3;
  }>();
  root.traverse((node) => original.set(node, {
    position: node.position.clone(),
    quaternion: node.quaternion.clone(),
    scale: node.scale.clone(),
  }));

  const mixer = new THREE.AnimationMixer(root);
  const action = mixer.clipAction(idleClip);
  action.reset().setLoop(THREE.LoopOnce, 1).play();
  action.time = 0;
  mixer.update(0);
  const sampled = new Map<HeavyBoneName, { position: THREE.Vector3; quaternion: THREE.Quaternion }>();
  for (const name of HEAVY_STRIKE_TRACK_BONES) {
    const bone = root.getObjectByName(name);
    if (!bone) throw new Error(`Heavy strike rig binding missing: ${name}`);
    sampled.set(name, { position: bone.position.clone(), quaternion: bone.quaternion.clone() });
  }
  mixer.stopAllAction();
  mixer.uncacheRoot(root);
  root.traverse((node) => {
    const transform = original.get(node);
    if (!transform) return;
    node.position.copy(transform.position);
    node.quaternion.copy(transform.quaternion);
    node.scale.copy(transform.scale);
  });
  return sampled;
}

/** Creates a dense, deterministic animation-only clip bound to Nyra's live rig. */
export function createHeavyStrikeClip(
  root: THREE.Object3D,
  idleClip: THREE.AnimationClip,
): THREE.AnimationClip {
  const neutral = sampleNeutralPose(root, idleClip);
  const times = Array.from(
    { length: HEAVY_ATTACK_RECOVERY_LAST_FRAME + 1 },
    (_, tick) => tick * FIXED_TIMESTEP,
  );
  const tracks: THREE.KeyframeTrack[] = [];

  for (const name of HEAVY_STRIKE_TRACK_BONES) {
    if (name === "root" || name === "weapon_socket") continue;
    const base = neutral.get(name)!;
    const values: number[] = [];
    for (let tick = 0; tick <= HEAVY_ATTACK_RECOVERY_LAST_FRAME; tick += 1) {
      const delta = poseAtTick(tick).rotations[name];
      const quaternion = base.quaternion.clone().multiply(
        new THREE.Quaternion().setFromEuler(new THREE.Euler(...delta, "YXZ")),
      ).normalize();
      values.push(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
    }
    tracks.push(new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, times, values));
  }

  const rootBase = neutral.get("root")!;
  const rootPositions: number[] = [];
  const rootQuaternions: number[] = [];
  for (let tick = 0; tick <= HEAVY_ATTACK_RECOVERY_LAST_FRAME; tick += 1) {
    const pose = poseAtTick(tick);
    rootPositions.push(
      rootBase.position.x,
      rootBase.position.y,
      rootBase.position.z + pose.rootLocalZ,
    );
    const delta = pose.rotations.root;
    const quaternion = rootBase.quaternion.clone().multiply(
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...delta, "YXZ")),
    ).normalize();
    rootQuaternions.push(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
  }
  tracks.push(
    new THREE.VectorKeyframeTrack("root.position", times, rootPositions),
    new THREE.QuaternionKeyframeTrack("root.quaternion", times, rootQuaternions),
  );

  const provisional = new THREE.AnimationClip(
    `${HEAVY_STRIKE_CLIP_NAME}_BODY`,
    HEAVY_ATTACK_RECOVERY_LAST_FRAME * FIXED_TIMESTEP,
    tracks,
  );
  const socket = root.getObjectByName("weapon_socket");
  const socketParent = socket?.parent ?? null;
  if (!socket || !socketParent) throw new Error("Heavy strike weapon socket binding is unavailable");
  const socketBase = neutral.get("weapon_socket")!.quaternion;
  const original = new Map<THREE.Object3D, {
    position: THREE.Vector3;
    quaternion: THREE.Quaternion;
    scale: THREE.Vector3;
  }>();
  root.traverse((node) => original.set(node, {
    position: node.position.clone(),
    quaternion: node.quaternion.clone(),
    scale: node.scale.clone(),
  }));
  const mixer = new THREE.AnimationMixer(root);
  const action = mixer.clipAction(provisional).reset().setLoop(THREE.LoopOnce, 1).play();
  const socketValues: number[] = [];
  let previousSocket = socketBase.clone();
  for (let tick = 0; tick <= HEAVY_ATTACK_RECOVERY_LAST_FRAME; tick += 1) {
    action.time = tick * FIXED_TIMESTEP;
    mixer.update(0);
    root.updateMatrixWorld(true);
    const aim = weaponAimAtTick(tick);
    const socketWorld = socket.getWorldPosition(new THREE.Vector3());
    const desiredWorld = new THREE.Vector3(...aim.point).sub(socketWorld).normalize();
    const parentWorld = socketParent.getWorldQuaternion(new THREE.Quaternion());
    const desiredParent = desiredWorld.applyQuaternion(parentWorld.invert()).normalize();
    const aimed = new THREE.Quaternion()
      .setFromUnitVectors(new THREE.Vector3(0, 1, 0), desiredParent)
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), aim.roll))
      .normalize();
    const value = socketBase.clone().slerp(aimed, aim.weight).normalize();
    if (previousSocket.dot(value) < 0) value.set(-value.x, -value.y, -value.z, -value.w);
    previousSocket = value.clone();
    socketValues.push(value.x, value.y, value.z, value.w);
  }
  mixer.stopAllAction();
  mixer.uncacheRoot(root);
  root.traverse((node) => {
    const transform = original.get(node);
    if (!transform) return;
    node.position.copy(transform.position);
    node.quaternion.copy(transform.quaternion);
    node.scale.copy(transform.scale);
  });
  tracks.push(new THREE.QuaternionKeyframeTrack("weapon_socket.quaternion", times, socketValues));

  const clip = new THREE.AnimationClip(
    HEAVY_STRIKE_CLIP_NAME,
    HEAVY_ATTACK_RECOVERY_LAST_FRAME * FIXED_TIMESTEP,
    tracks,
  );
  clip.optimize();
  return clip;
}
