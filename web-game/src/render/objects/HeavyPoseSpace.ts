export type HeavyPoseVector = readonly [x: number, y: number, z: number];

export type HeavyJointName =
  | "pelvis"
  | "spine01"
  | "spine02"
  | "spine03"
  | "neck"
  | "clavicleL"
  | "upperArmL"
  | "lowerArmL"
  | "handL"
  | "clavicleR"
  | "upperArmR"
  | "lowerArmR"
  | "handR"
  | "thighL"
  | "calfL"
  | "thighR"
  | "calfR";

export interface HeavyPoseSample {
  schema: "p30.r012a.analytic-heavy-pose.v1";
  relativeTick: number;
  phase: "coil" | "anticipation" | "contact" | "follow-through" | "recovery" | "neutral";
  modelPosition: HeavyPoseVector;
  modelRotation: HeavyPoseVector;
  joints: Readonly<Record<HeavyJointName, HeavyPoseVector>>;
  bladeGuardRootLocal: HeavyPoseVector;
  bladeTipRootLocal: HeavyPoseVector;
  bladeRollRadians: number;
}

interface HeavyPoseKey extends Omit<HeavyPoseSample, "schema" | "phase" | "relativeTick"> {
  tick: number;
}

const ZERO: HeavyPoseVector = [0, 0, 0];

function joints(values: Partial<Record<HeavyJointName, HeavyPoseVector>>): Record<HeavyJointName, HeavyPoseVector> {
  return {
    pelvis: ZERO,
    spine01: ZERO,
    spine02: ZERO,
    spine03: ZERO,
    neck: ZERO,
    clavicleL: ZERO,
    upperArmL: ZERO,
    lowerArmL: ZERO,
    handL: ZERO,
    clavicleR: ZERO,
    upperArmR: ZERO,
    lowerArmR: ZERO,
    handR: ZERO,
    thighL: ZERO,
    calfL: ZERO,
    thighR: ZERO,
    calfR: ZERO,
    ...values,
  };
}

// The heavy is authored entirely in deterministic pose space. The blade
// control points describe its visible guard/tip path in the hero-root frame;
// the body keys counter-rotate hips and shoulders so the weapon never reads
// as an arm-only or retimed light strike.
const KEYS: readonly HeavyPoseKey[] = [
  {
    tick: 0,
    modelPosition: [0, -0.012, -0.015],
    modelRotation: [0.015, 0.025, -0.012],
    joints: joints({
      pelvis: [0.04, -0.08, 0.05], spine01: [-0.05, 0.08, -0.06],
      spine02: [-0.07, 0.13, -0.09], spine03: [-0.06, 0.16, -0.08],
      clavicleL: [0.08, 0.08, 0.12], upperArmL: [-0.22, -0.18, 0.18],
      lowerArmL: [-0.3, 0.1, 0.08], clavicleR: [-0.04, -0.1, -0.08],
      upperArmR: [0.2, 0.28, -0.2], lowerArmR: [-0.22, -0.08, -0.12],
      thighL: [-0.08, 0.04, 0.06], calfL: [0.12, 0, 0],
      thighR: [0.06, -0.03, -0.04], calfR: [0.08, 0, 0],
    }),
    bladeGuardRootLocal: [-0.55, 1.28, -0.82],
    bladeTipRootLocal: [-1.0, 2.2, -1.48],
    bladeRollRadians: 0.35,
  },
  {
    tick: 10,
    modelPosition: [-0.045, -0.075, 0.035],
    modelRotation: [0.05, 0.2, -0.075],
    joints: joints({
      pelvis: [0.16, -0.34, 0.16], spine01: [-0.16, 0.26, -0.16],
      spine02: [-0.22, 0.42, -0.24], spine03: [-0.18, 0.5, -0.2],
      neck: [0.08, -0.15, 0.08], clavicleL: [0.18, 0.2, 0.28],
      upperArmL: [-0.5, -0.38, 0.42], lowerArmL: [-0.68, 0.24, 0.16],
      handL: [0.1, -0.1, 0.08], clavicleR: [-0.12, -0.28, -0.18],
      upperArmR: [0.38, 0.62, -0.45], lowerArmR: [-0.48, -0.12, -0.2],
      handR: [0.08, 0.06, -0.12], thighL: [-0.24, 0.08, 0.12],
      calfL: [0.38, 0, 0], thighR: [0.16, -0.08, -0.08], calfR: [0.18, 0, 0],
    }),
    bladeGuardRootLocal: [-0.72, 1.42, -0.72],
    bladeTipRootLocal: [-1.12, 2.34, -1.36],
    bladeRollRadians: 0.48,
  },
  {
    tick: 18,
    modelPosition: [-0.07, -0.11, 0.055],
    modelRotation: [0.075, 0.31, -0.105],
    joints: joints({
      pelvis: [0.23, -0.48, 0.22], spine01: [-0.22, 0.34, -0.22],
      spine02: [-0.3, 0.54, -0.3], spine03: [-0.25, 0.64, -0.26],
      neck: [0.12, -0.2, 0.11], clavicleL: [0.24, 0.26, 0.36],
      upperArmL: [-0.62, -0.48, 0.54], lowerArmL: [-0.82, 0.31, 0.22],
      handL: [0.14, -0.16, 0.1], clavicleR: [-0.17, -0.38, -0.24],
      upperArmR: [0.48, 0.78, -0.58], lowerArmR: [-0.6, -0.16, -0.25],
      handR: [0.12, 0.1, -0.16], thighL: [-0.31, 0.1, 0.16],
      calfL: [0.48, 0, 0], thighR: [0.22, -0.1, -0.1], calfR: [0.24, 0, 0],
    }),
    bladeGuardRootLocal: [-0.58, 1.48, -0.88],
    bladeTipRootLocal: [-0.82, 2.3, -1.77],
    bladeRollRadians: 0.62,
  },
  {
    tick: 20,
    modelPosition: [-0.055, -0.1, 0.01],
    modelRotation: [0.065, 0.22, -0.08],
    joints: joints({
      pelvis: [0.2, -0.4, 0.2], spine01: [-0.18, 0.28, -0.18],
      spine02: [-0.24, 0.42, -0.25], spine03: [-0.2, 0.5, -0.21],
      neck: [0.1, -0.15, 0.08], clavicleL: [0.2, 0.2, 0.3],
      upperArmL: [-0.5, -0.34, 0.46], lowerArmL: [-0.7, 0.24, 0.18],
      clavicleR: [-0.13, -0.3, -0.2], upperArmR: [0.42, 0.62, -0.48],
      lowerArmR: [-0.52, -0.12, -0.22], thighL: [-0.27, 0.08, 0.14],
      calfL: [0.42, 0, 0], thighR: [0.18, -0.08, -0.08], calfR: [0.2, 0, 0],
    }),
    bladeGuardRootLocal: [-0.4, 1.4, -1.02],
    bladeTipRootLocal: [0.12, 1.76, -2.1],
    bladeRollRadians: 0.72,
  },
  {
    tick: 21,
    modelPosition: [-0.025, -0.075, -0.08],
    modelRotation: [0.045, 0.08, -0.035],
    joints: joints({
      pelvis: [0.14, -0.22, 0.16], spine01: [-0.1, 0.12, -0.1],
      spine02: [-0.13, 0.18, -0.14], spine03: [-0.1, 0.2, -0.12],
      clavicleL: [0.12, 0.08, 0.2], upperArmL: [-0.34, -0.16, 0.34],
      lowerArmL: [-0.5, 0.16, 0.13], clavicleR: [-0.06, -0.12, -0.1],
      upperArmR: [0.3, 0.34, -0.32], lowerArmR: [-0.36, -0.07, -0.16],
      thighL: [-0.2, 0.05, 0.1], calfL: [0.32, 0, 0],
      thighR: [0.12, -0.05, -0.06], calfR: [0.14, 0, 0],
    }),
    bladeGuardRootLocal: [-0.22, 1.32, -1.2],
    bladeTipRootLocal: [0.27, 1.55, -2.42],
    bladeRollRadians: 0.84,
  },
  {
    tick: 22,
    modelPosition: [0.035, -0.035, -0.19],
    modelRotation: [0.02, -0.14, 0.045],
    joints: joints({
      pelvis: [0.08, 0.18, 0.12], spine01: [-0.04, -0.2, 0.08],
      spine02: [-0.06, -0.32, 0.14], spine03: [-0.04, -0.38, 0.16],
      neck: [0.04, 0.12, -0.04], clavicleL: [0.02, -0.2, 0.08],
      upperArmL: [-0.16, 0.16, 0.2], lowerArmL: [-0.3, 0.08, 0.08],
      clavicleR: [0.08, 0.22, 0.08], upperArmR: [0.12, -0.22, -0.12],
      lowerArmR: [-0.18, 0.04, -0.08], thighL: [-0.1, 0.02, 0.06],
      calfL: [0.22, 0, 0], thighR: [0.06, -0.02, -0.04], calfR: [0.1, 0, 0],
    }),
    bladeGuardRootLocal: [-0.08, 1.22, -1.4],
    bladeTipRootLocal: [0.37, 1.34, -2.58],
    bladeRollRadians: 1.02,
  },
  {
    tick: 24,
    modelPosition: [0.12, -0.025, -0.18],
    modelRotation: [0.035, -0.32, 0.09],
    joints: joints({
      pelvis: [0.12, 0.36, 0.16], spine01: [-0.08, -0.3, 0.12],
      spine02: [-0.1, -0.48, 0.2], spine03: [-0.08, -0.56, 0.22],
      neck: [0.05, 0.18, -0.05], clavicleL: [-0.04, -0.28, 0.04],
      upperArmL: [-0.04, 0.3, 0.1], lowerArmL: [-0.16, 0.04, 0.04],
      clavicleR: [0.14, 0.34, 0.14], upperArmR: [-0.06, -0.42, 0.08],
      lowerArmR: [-0.08, 0.08, -0.02], thighL: [-0.06, 0.02, 0.04],
      calfL: [0.16, 0, 0], thighR: [0.03, -0.02, -0.02], calfR: [0.08, 0, 0],
    }),
    bladeGuardRootLocal: [0.12, 1.12, -1.6],
    bladeTipRootLocal: [0.92, 1.03, -2.55],
    bladeRollRadians: 1.18,
  },
  {
    tick: 34,
    modelPosition: [0.16, -0.065, -0.03],
    modelRotation: [0.085, -0.52, 0.13],
    joints: joints({
      pelvis: [0.2, 0.46, 0.22], spine01: [-0.13, -0.38, 0.16],
      spine02: [-0.18, -0.58, 0.25], spine03: [-0.14, -0.66, 0.27],
      neck: [0.08, 0.22, -0.08], clavicleL: [-0.08, -0.34, 0.02],
      upperArmL: [0.08, 0.42, -0.02], lowerArmL: [-0.06, 0.04, 0.01],
      clavicleR: [0.2, 0.42, 0.18], upperArmR: [-0.2, -0.55, 0.2],
      lowerArmR: [0.05, 0.1, 0.05], thighL: [-0.12, 0.04, 0.08],
      calfL: [0.26, 0, 0], thighR: [0.08, -0.04, -0.04], calfR: [0.12, 0, 0],
    }),
    bladeGuardRootLocal: [0.42, 1.02, -1.58],
    bladeTipRootLocal: [1.18, 0.72, -0.68],
    bladeRollRadians: 1.34,
  },
  {
    tick: 42,
    modelPosition: [0.07, -0.045, 0.015],
    modelRotation: [0.04, -0.22, 0.06],
    joints: joints({
      pelvis: [0.1, 0.18, 0.1], spine01: [-0.07, -0.14, 0.08],
      spine02: [-0.09, -0.22, 0.11], spine03: [-0.07, -0.25, 0.12],
      neck: [0.04, 0.08, -0.04], clavicleL: [-0.02, -0.12, 0.02],
      upperArmL: [0.02, 0.16, 0], lowerArmL: [-0.04, 0.02, 0],
      clavicleR: [0.08, 0.16, 0.08], upperArmR: [-0.08, -0.2, 0.08],
      lowerArmR: [0.02, 0.04, 0.02], thighL: [-0.06, 0.02, 0.04],
      calfL: [0.12, 0, 0], thighR: [0.04, -0.02, -0.02], calfR: [0.06, 0, 0],
    }),
    bladeGuardRootLocal: [0.18, 1.1, -1.18],
    bladeTipRootLocal: [0.52, 1.78, -0.22],
    bladeRollRadians: 0.82,
  },
  {
    tick: 50,
    modelPosition: ZERO,
    modelRotation: ZERO,
    joints: joints({}),
    bladeGuardRootLocal: [-0.18, 1.08, -0.88],
    bladeTipRootLocal: [-0.46, 2.02, -1.6],
    bladeRollRadians: 0.6,
  },
];

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smooth(value: number): number {
  const t = clamp01(value);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function rounded(value: number): number {
  const result = Math.round(value * 1_000_000) / 1_000_000;
  return Object.is(result, -0) ? 0 : result;
}

function mixVector(from: HeavyPoseVector, to: HeavyPoseVector, amount: number): HeavyPoseVector {
  return [
    rounded(from[0] + (to[0] - from[0]) * amount),
    rounded(from[1] + (to[1] - from[1]) * amount),
    rounded(from[2] + (to[2] - from[2]) * amount),
  ];
}

function phase(relativeTick: number): HeavyPoseSample["phase"] {
  if (relativeTick >= 50) return "neutral";
  if (relativeTick < 12) return "coil";
  if (relativeTick < 22) return "anticipation";
  if (relativeTick < 24) return "contact";
  if (relativeTick < 38) return "follow-through";
  return "recovery";
}

export function sampleAnalyticHeavyPose(relativeTickValue: number): HeavyPoseSample {
  const relativeTick = Math.max(0, Math.min(50, Math.floor(relativeTickValue)));
  let from = KEYS[0]!;
  let to = KEYS[KEYS.length - 1]!;
  for (let index = 0; index < KEYS.length - 1; index += 1) {
    if (relativeTick <= KEYS[index + 1]!.tick) {
      from = KEYS[index]!;
      to = KEYS[index + 1]!;
      break;
    }
  }
  const amount = from.tick === to.tick ? 0 : smooth((relativeTick - from.tick) / (to.tick - from.tick));
  const mixedJoints = Object.fromEntries(
    (Object.keys(from.joints) as HeavyJointName[]).map((name) => [
      name,
      mixVector(from.joints[name], to.joints[name], amount),
    ]),
  ) as Record<HeavyJointName, HeavyPoseVector>;
  return {
    schema: "p30.r012a.analytic-heavy-pose.v1",
    relativeTick,
    phase: phase(relativeTick),
    modelPosition: mixVector(from.modelPosition, to.modelPosition, amount),
    modelRotation: mixVector(from.modelRotation, to.modelRotation, amount),
    joints: mixedJoints,
    bladeGuardRootLocal: mixVector(from.bladeGuardRootLocal, to.bladeGuardRootLocal, amount),
    bladeTipRootLocal: mixVector(from.bladeTipRootLocal, to.bladeTipRootLocal, amount),
    bladeRollRadians: rounded(from.bladeRollRadians + (to.bladeRollRadians - from.bladeRollRadians) * amount),
  };
}
