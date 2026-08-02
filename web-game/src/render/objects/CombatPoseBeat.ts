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
  weaponAxialRollOffset: number;
  grip: {
    weaponMountRotation: PoseVector;
    supportLowerArmRotation: PoseVector;
  };
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
    shoulderL: PoseVector;
    upperArmL: PoseVector;
    lowerArmL: PoseVector;
    shoulderR: PoseVector;
    upperArmR: PoseVector;
    lowerArmR: PoseVector;
  };
}

export interface HeroAuthoredPoseTiming {
  mode: "direct" | "contact-to-settle-blend";
  primarySeconds: number;
  secondarySeconds: number;
  blend01: number;
}

interface HeroPoseKey {
  frame: number;
  weaponAxialRollOffset: number;
  grip: HeroCombatPoseSample["grip"];
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
const NEUTRAL_GRIP: HeroCombatPoseSample["grip"] = {
  weaponMountRotation: ZERO,
  supportLowerArmRotation: ZERO,
};
const NEUTRAL_TARGET_BONES: TargetCombatPoseSample["bones"] = {
  hips: ZERO,
  abdomen: ZERO,
  torso: ZERO,
  neck: ZERO,
  shoulderL: ZERO,
  upperArmL: ZERO,
  lowerArmL: ZERO,
  shoulderR: ZERO,
  upperArmR: ZERO,
  lowerArmR: ZERO,
};

// These are deliberately additive presentation offsets. The authored clip
// continues to own the hands, feet, weapon socket, and timing; the keys add a
// compact whole-body force arc without changing any simulation state.
const HERO_KEYS: readonly HeroPoseKey[] = [
  {
    frame: -1,
    weaponAxialRollOffset: 0,
    grip: NEUTRAL_GRIP,
    model: NEUTRAL_TRANSFORM,
    bones: { pelvis: ZERO, spine01: ZERO, spine02: ZERO, spine03: ZERO, neck: ZERO },
  },
  {
    frame: 0,
    weaponAxialRollOffset: 0,
    grip: NEUTRAL_GRIP,
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
    weaponAxialRollOffset: 0,
    grip: NEUTRAL_GRIP,
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
    weaponAxialRollOffset: 2.8,
    grip: {
      weaponMountRotation: [0, 0, -0.012],
      supportLowerArmRotation: [0.0045, -0.003, -0.0075],
    },
    model: { position: [-0.2, -0.014, 0.16], rotation: [0.012, -0.025, 0.02] },
    bones: {
      pelvis: [0.018, -0.04, 0.035],
      spine01: [-0.012, -0.02, 0.015],
      spine02: [-0.016, -0.03, 0.022],
      spine03: [-0.012, -0.025, 0.018],
      neck: [0.008, 0.015, -0.008],
    },
  },
  {
    frame: 12,
    weaponAxialRollOffset: 2.8,
    grip: NEUTRAL_GRIP,
    model: { position: [-0.14, -0.02, 0.18], rotation: [0.022, -0.025, 0.032] },
    bones: {
      pelvis: [0.026, -0.055, 0.042],
      spine01: [-0.018, -0.028, 0.022],
      spine02: [-0.022, -0.042, 0.03],
      spine03: [-0.018, -0.036, 0.026],
      neck: [0.012, 0.02, -0.012],
    },
  },
  {
    frame: 17,
    weaponAxialRollOffset: 2.8,
    grip: NEUTRAL_GRIP,
    model: { position: [-0.04, -0.02, 0.205], rotation: [0.048, -0.12, 0.075] },
    bones: {
      pelvis: [0.052, -0.105, 0.08],
      spine01: [-0.035, -0.07, 0.052],
      spine02: [-0.05, -0.095, 0.07],
      spine03: [-0.04, -0.08, 0.058],
      neck: [0.024, 0.045, -0.025],
    },
  },
  {
    frame: 22,
    weaponAxialRollOffset: 1.2,
    grip: NEUTRAL_GRIP,
    model: { position: [-0.015, -0.015, 0.13], rotation: [0.026, -0.055, 0.038] },
    bones: {
      pelvis: [0.03, -0.05, 0.04],
      spine01: [-0.018, -0.035, 0.026],
      spine02: [-0.026, -0.048, 0.034],
      spine03: [-0.02, -0.04, 0.03],
      neck: [0.012, 0.02, -0.012],
    },
  },
  {
    frame: 25,
    weaponAxialRollOffset: 0,
    grip: NEUTRAL_GRIP,
    model: NEUTRAL_TRANSFORM,
    bones: { pelvis: ZERO, spine01: ZERO, spine02: ZERO, spine03: ZERO, neck: ZERO },
  },
];

const TARGET_KEYS: readonly TargetPoseKey[] = [
  {
    reaction01: 0,
    model: { position: [-0.72, -0.024, -0.12], rotation: [-0.05, 0.055, 0.11] },
    bones: {
      hips: [-0.024, -0.035, -0.034],
      abdomen: [-0.062, -0.08, -0.07],
      torso: [-0.105, -0.125, -0.11],
      neck: [0.042, 0.055, 0.046],
      shoulderL: [0.08, -0.04, 0.14],
      upperArmL: [0.14, -0.08, 0.18],
      lowerArmL: [-0.12, 0.06, 0.08],
      shoulderR: [-0.16, 0.08, -0.22],
      upperArmR: [-0.18, 0.1, -0.25],
      lowerArmR: [0.18, -0.08, -0.1],
    },
  },
  {
    reaction01: 1 / 12,
    model: { position: [-0.76, -0.03, -0.04], rotation: [-0.06, 0.065, 0.125] },
    bones: {
      hips: [-0.028, -0.01, -0.012],
      abdomen: [-0.075, -0.025, -0.02],
      torso: [-0.12, -0.035, -0.028],
      neck: [0.052, 0.018, 0.014],
      shoulderL: [0.07, -0.03, 0.12],
      upperArmL: [0.12, -0.065, 0.15],
      lowerArmL: [-0.1, 0.05, 0.07],
      shoulderR: [-0.145, 0.07, -0.2],
      upperArmR: [-0.16, 0.085, -0.22],
      lowerArmR: [0.16, -0.07, -0.09],
    },
  },
  {
    reaction01: 5 / 12,
    model: { position: [-0.95, -0.052, 0.38], rotation: [-0.075, 0.075, 0.135] },
    bones: {
      hips: [-0.035, 0.05, 0.055],
      abdomen: [-0.095, 0.105, 0.1],
      torso: [-0.14, 0.145, 0.13],
      neck: [0.065, -0.08, -0.07],
      shoulderL: [0.04, -0.02, 0.08],
      upperArmL: [0.07, -0.04, 0.1],
      lowerArmL: [-0.055, 0.03, 0.04],
      shoulderR: [-0.08, 0.04, -0.12],
      upperArmR: [-0.09, 0.05, -0.13],
      lowerArmR: [0.085, -0.04, -0.05],
    },
  },
  {
    reaction01: 0.72,
    model: { position: [-0.5, -0.03, 0.22], rotation: [-0.04, 0.04, 0.075] },
    bones: {
      hips: [-0.018, 0.025, 0.028],
      abdomen: [-0.05, 0.055, 0.052],
      torso: [-0.072, 0.075, 0.07],
      neck: [0.032, -0.04, -0.035],
      shoulderL: [0.018, -0.008, 0.036],
      upperArmL: [0.03, -0.018, 0.045],
      lowerArmL: [-0.024, 0.014, 0.018],
      shoulderR: [-0.036, 0.018, -0.054],
      upperArmR: [-0.04, 0.022, -0.058],
      lowerArmR: [0.038, -0.018, -0.022],
    },
  },
  {
    reaction01: 1,
    model: NEUTRAL_TRANSFORM,
    bones: NEUTRAL_TARGET_BONES,
  },
];

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smootherstep(value: number): number {
  const t = clamp01(value);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

export function sampleHeroAuthoredPoseTiming(
  attackPhase: PlayerState["attackPhase"],
  attackFrame: number,
  attackElapsed: number,
  clipDuration: number,
): HeroAuthoredPoseTiming {
  const directSeconds = rounded(Math.max(0, Math.min(attackElapsed, clipDuration)));
  if (attackPhase !== "recovery" || attackFrame <= 12) {
    return {
      mode: "direct",
      primarySeconds: directSeconds,
      secondarySeconds: directSeconds,
      blend01: 0,
    };
  }

  // The source clip lifts the weapon into an unrelated overhead guard after
  // contact. Blend directly from the last contact pose to the clip's settled
  // endpoint so recovery continues through the strike direction without
  // visually starting another attack.
  const blend01 = rounded(smootherstep((attackFrame - 12) / 13));
  return {
    mode: "contact-to-settle-blend",
    primarySeconds: rounded(12 / 60),
    secondarySeconds: rounded(Math.max(0, clipDuration - 0.0001)),
    blend01,
  };
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

function mixHeroGrip(
  from: HeroCombatPoseSample["grip"],
  to: HeroCombatPoseSample["grip"],
  amount: number,
): HeroCombatPoseSample["grip"] {
  return {
    weaponMountRotation: mixVector(
      from.weaponMountRotation,
      to.weaponMountRotation,
      amount,
    ),
    supportLowerArmRotation: mixVector(
      from.supportLowerArmRotation,
      to.supportLowerArmRotation,
      amount,
    ),
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
    shoulderL: mixVector(from.shoulderL, to.shoulderL, amount),
    upperArmL: mixVector(from.upperArmL, to.upperArmL, amount),
    lowerArmL: mixVector(from.lowerArmL, to.lowerArmL, amount),
    shoulderR: mixVector(from.shoulderR, to.shoulderR, amount),
    upperArmR: mixVector(from.upperArmR, to.upperArmR, amount),
    lowerArmR: mixVector(from.lowerArmR, to.lowerArmR, amount),
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
      weaponAxialRollOffset: 0,
      grip: NEUTRAL_GRIP,
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
    weaponAxialRollOffset: rounded(
      from.weaponAxialRollOffset +
        (to.weaponAxialRollOffset - from.weaponAxialRollOffset) * amount,
    ),
    grip: mixHeroGrip(from.grip, to.grip, amount),
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
      bones: NEUTRAL_TARGET_BONES,
    };
  }

  const reaction01 = clamp01(1 - hitStunRemaining / 0.28);
  const [from, to, amount] = targetKeyPair(reaction01);
  return {
    schema: "cow.target-combat-pose.v1",
    phase: reaction01 < 0.12 ? "compression" : reaction01 < 0.68 ? "recoil" : "recovery",
    reaction01: rounded(reaction01),
    animationLeadSeconds: 0,
    model: mixTransform(from.model, to.model, amount),
    bones: mixTargetBones(from.bones, to.bones, amount),
  };
}
