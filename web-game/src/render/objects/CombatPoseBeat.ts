import type { EnemyState, PlayerState } from "../../game/simulation/types";

export type PoseVector = readonly [x: number, y: number, z: number];

export interface PoseTransform {
  position: PoseVector;
  rotation: PoseVector;
}

export interface HeroCombatPoseSample {
  schema: "cow.hero-combat-pose.v1";
  phase: "neutral" | "anticipation" | "contact" | "recoil" | "recovery";
  attackFrame: number;
  model: PoseTransform;
  bones: {
    pelvis: PoseVector;
    spine01: PoseVector;
    spine02: PoseVector;
    spine03: PoseVector;
    neck: PoseVector;
  };
}

export interface TargetCombatPoseSample {
  schema: "cow.target-combat-pose.v1";
  phase: "neutral" | "compression" | "recoil" | "recovery";
  reaction01: number;
  animationLeadSeconds: number;
  model: PoseTransform;
  bones: {
    hips: PoseVector;
    abdomen: PoseVector;
    torso: PoseVector;
    neck: PoseVector;
  };
}

interface HeroPoseKey {
  frame: number;
  model: PoseTransform;
  bones: HeroCombatPoseSample["bones"];
}

interface TargetPoseKey {
  reaction01: number;
  model: PoseTransform;
  bones: TargetCombatPoseSample["bones"];
}

const ZERO: PoseVector = [0, 0, 0];
const NEUTRAL_TRANSFORM: PoseTransform = { position: ZERO, rotation: ZERO };

// These are deliberately additive presentation offsets. The authored clip
// continues to own the hands, feet, weapon socket, and timing; the keys add a
// compact whole-body force arc without changing any simulation state.
const HERO_KEYS: readonly HeroPoseKey[] = [
  {
    frame: -1,
    model: NEUTRAL_TRANSFORM,
    bones: { pelvis: ZERO, spine01: ZERO, spine02: ZERO, spine03: ZERO, neck: ZERO },
  },
  {
    frame: 0,
    model: { position: [0, -0.008, 0.006], rotation: [0.008, 0.018, -0.008] },
    bones: {
      pelvis: [0.008, -0.025, 0.012],
      spine01: [-0.008, 0.018, -0.01],
      spine02: [-0.01, 0.024, -0.012],
      spine03: [-0.008, 0.028, -0.01],
      neck: [0.006, -0.012, 0.006],
    },
  },
  {
    frame: 5,
    model: { position: [-0.026, -0.052, 0.026], rotation: [0.02, 0.07, -0.036] },
    bones: {
      pelvis: [0.032, -0.095, 0.058],
      spine01: [-0.034, 0.055, -0.044],
      spine02: [-0.044, 0.075, -0.054],
      spine03: [-0.032, 0.09, -0.044],
      neck: [0.024, -0.045, 0.026],
    },
  },
  {
    frame: 10,
    model: NEUTRAL_TRANSFORM,
    bones: { pelvis: ZERO, spine01: ZERO, spine02: ZERO, spine03: ZERO, neck: ZERO },
  },
  {
    frame: 17,
    model: { position: [-0.028, 0, 0], rotation: ZERO },
    bones: { pelvis: ZERO, spine01: ZERO, spine02: ZERO, spine03: ZERO, neck: ZERO },
  },
  {
    frame: 22,
    model: { position: [-0.012, -0.018, 0.035], rotation: [0.02, -0.025, -0.018] },
    bones: {
      pelvis: [0.018, -0.025, 0.026],
      spine01: [0.022, 0.03, -0.024],
      spine02: [0.026, 0.036, -0.028],
      spine03: [0.02, 0.03, -0.022],
      neck: [-0.012, -0.014, 0.012],
    },
  },
  {
    frame: 25,
    model: NEUTRAL_TRANSFORM,
    bones: { pelvis: ZERO, spine01: ZERO, spine02: ZERO, spine03: ZERO, neck: ZERO },
  },
];

const TARGET_KEYS: readonly TargetPoseKey[] = [
  {
    reaction01: 0,
    model: { position: [-0.015, -0.012, 0.02], rotation: [-0.02, 0.008, 0.025] },
    bones: {
      hips: [-0.01, -0.015, -0.015],
      abdomen: [-0.025, -0.035, -0.028],
      torso: [-0.04, -0.05, -0.04],
      neck: [0.02, 0.025, 0.02],
    },
  },
  {
    reaction01: 5 / 12,
    model: { position: [-0.04, -0.03, 0.09], rotation: [-0.04, 0.016, 0.035] },
    bones: {
      hips: [-0.02, 0.02, 0.025],
      abdomen: [-0.06, 0.05, 0.05],
      torso: [-0.085, 0.07, 0.065],
      neck: [0.035, -0.04, -0.035],
    },
  },
  {
    reaction01: 0.72,
    model: { position: [-0.022, -0.018, 0.05], rotation: [-0.024, 0.008, 0.02] },
    bones: {
      hips: [-0.01, 0.01, 0.012],
      abdomen: [-0.03, 0.024, 0.025],
      torso: [-0.042, 0.034, 0.032],
      neck: [0.018, -0.02, -0.017],
    },
  },
  {
    reaction01: 1,
    model: NEUTRAL_TRANSFORM,
    bones: { hips: ZERO, abdomen: ZERO, torso: ZERO, neck: ZERO },
  },
];

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smootherstep(value: number): number {
  const t = clamp01(value);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function rounded(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function mixVector(from: PoseVector, to: PoseVector, amount: number): PoseVector {
  return [
    rounded(from[0] + (to[0] - from[0]) * amount),
    rounded(from[1] + (to[1] - from[1]) * amount),
    rounded(from[2] + (to[2] - from[2]) * amount),
  ];
}

function mixTransform(from: PoseTransform, to: PoseTransform, amount: number): PoseTransform {
  return {
    position: mixVector(from.position, to.position, amount),
    rotation: mixVector(from.rotation, to.rotation, amount),
  };
}

function heroKeyPair(frame: number): readonly [HeroPoseKey, HeroPoseKey, number] {
  for (let index = 0; index < HERO_KEYS.length - 1; index += 1) {
    const from = HERO_KEYS[index]!;
    const to = HERO_KEYS[index + 1]!;
    if (frame <= to.frame) {
      return [from, to, smootherstep((frame - from.frame) / (to.frame - from.frame))];
    }
  }
  const last = HERO_KEYS[HERO_KEYS.length - 1]!;
  return [last, last, 0];
}

function targetKeyPair(reaction01: number): readonly [TargetPoseKey, TargetPoseKey, number] {
  for (let index = 0; index < TARGET_KEYS.length - 1; index += 1) {
    const from = TARGET_KEYS[index]!;
    const to = TARGET_KEYS[index + 1]!;
    if (reaction01 <= to.reaction01) {
      return [
        from,
        to,
        smootherstep(
          (reaction01 - from.reaction01) / (to.reaction01 - from.reaction01),
        ),
      ];
    }
  }
  const last = TARGET_KEYS[TARGET_KEYS.length - 1]!;
  return [last, last, 0];
}

function mixHeroBones(
  from: HeroCombatPoseSample["bones"],
  to: HeroCombatPoseSample["bones"],
  amount: number,
): HeroCombatPoseSample["bones"] {
  return {
    pelvis: mixVector(from.pelvis, to.pelvis, amount),
    spine01: mixVector(from.spine01, to.spine01, amount),
    spine02: mixVector(from.spine02, to.spine02, amount),
    spine03: mixVector(from.spine03, to.spine03, amount),
    neck: mixVector(from.neck, to.neck, amount),
  };
}

function mixTargetBones(
  from: TargetCombatPoseSample["bones"],
  to: TargetCombatPoseSample["bones"],
  amount: number,
): TargetCombatPoseSample["bones"] {
  return {
    hips: mixVector(from.hips, to.hips, amount),
    abdomen: mixVector(from.abdomen, to.abdomen, amount),
    torso: mixVector(from.torso, to.torso, amount),
    neck: mixVector(from.neck, to.neck, amount),
  };
}

export function sampleHeroCombatPose(
  attackPhase: PlayerState["attackPhase"],
  attackFrame: number,
): HeroCombatPoseSample {
  if (attackPhase === "idle" || attackFrame < 0) {
    return {
      schema: "cow.hero-combat-pose.v1",
      phase: "neutral",
      attackFrame: -1,
      model: NEUTRAL_TRANSFORM,
      bones: { pelvis: ZERO, spine01: ZERO, spine02: ZERO, spine03: ZERO, neck: ZERO },
    };
  }

  const frame = Math.min(25, Math.max(0, Math.floor(attackFrame)));
  const [from, to, amount] = heroKeyPair(frame);
  return {
    schema: "cow.hero-combat-pose.v1",
    phase:
      frame <= 7
        ? "anticipation"
        : frame <= 11
          ? "contact"
          : frame <= 20
            ? "recoil"
            : "recovery",
    attackFrame: frame,
    model: mixTransform(from.model, to.model, amount),
    bones: mixHeroBones(from.bones, to.bones, amount),
  };
}

export function sampleTargetCombatPose(
  motion: EnemyState["motion"],
  hitStunRemaining: number,
): TargetCombatPoseSample {
  if (motion !== "hit" || hitStunRemaining <= 0) {
    return {
      schema: "cow.target-combat-pose.v1",
      phase: "neutral",
      reaction01: 1,
      animationLeadSeconds: 0,
      model: NEUTRAL_TRANSFORM,
      bones: { hips: ZERO, abdomen: ZERO, torso: ZERO, neck: ZERO },
    };
  }

  const reaction01 = clamp01(1 - hitStunRemaining / 0.28);
  const [from, to, amount] = targetKeyPair(reaction01);
  return {
    schema: "cow.target-combat-pose.v1",
    phase: reaction01 < 0.12 ? "compression" : reaction01 < 0.68 ? "recoil" : "recovery",
    reaction01: rounded(reaction01),
    animationLeadSeconds: rounded((1 - reaction01) / 24),
    model: mixTransform(from.model, to.model, amount),
    bones: mixTargetBones(from.bones, to.bones, amount),
  };
}
