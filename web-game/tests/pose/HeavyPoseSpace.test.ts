import { describe, expect, it } from "vitest";
import { sampleAnalyticHeavyPose, type HeavyPoseVector } from "../../src/render/objects/HeavyPoseSpace";

function subtract(first: HeavyPoseVector, second: HeavyPoseVector): HeavyPoseVector {
  return [first[0] - second[0], first[1] - second[1], first[2] - second[2]];
}

function length(value: HeavyPoseVector): number {
  return Math.hypot(...value);
}

function bladeAxis(tick: number): HeavyPoseVector {
  const sample = sampleAnalyticHeavyPose(tick);
  const axis = subtract(sample.bladeTipRootLocal, sample.bladeGuardRootLocal);
  const magnitude = length(axis);
  return [axis[0] / magnitude, axis[1] / magnitude, axis[2] / magnitude];
}

describe("Round012 analytic heavy pose", () => {
  it("locks the exterior contact, same-side departure, and frozen idle mount", () => {
    expect(sampleAnalyticHeavyPose(22)).toMatchObject({
      relativeTick: 22,
      phase: "contact",
      bladeGuardRootLocal: [-0.613587, 0.629286, -1.715497],
      bladeTipRootLocal: [0.283436, 0.629286, -2.61252],
    });
    expect(sampleAnalyticHeavyPose(24)).toMatchObject({
      relativeTick: 24,
      phase: "follow-through",
      bladeGuardRootLocal: [-0.910383, 0.668444, -1.696044],
      bladeTipRootLocal: [-0.013361, 0.668444, -2.593067],
    });
    expect(sampleAnalyticHeavyPose(50)).toMatchObject({
      relativeTick: 50,
      phase: "neutral",
      modelPosition: [0, 0, 0],
      modelRotation: [0, 0, 0],
      bladeGuardRootLocal: [-0.709604, 1.224219, 0.826696],
      bladeTipRootLocal: [-1.630188, 1.657276, 2.311616],
      bladeRollRadians: 0.188441,
    });
  });

  it("keeps every authored blade axis finite and advances it at a bounded angular rate", () => {
    let previous = bladeAxis(0);
    for (let tick = 1; tick <= 50; tick += 1) {
      const current = bladeAxis(tick);
      const cosine = Math.max(-1, Math.min(1,
        previous[0] * current[0] + previous[1] * current[1] + previous[2] * current[2],
      ));
      expect(Math.acos(cosine)).toBeLessThan(0.5);
      expect(length(subtract(
        sampleAnalyticHeavyPose(tick).bladeGuardRootLocal,
        sampleAnalyticHeavyPose(tick - 1).bladeGuardRootLocal,
      ))).toBeLessThan(0.55);
      previous = current;
    }
  });

  it("uses steady recovery spacing without a late body re-cock", () => {
    for (let tick = 35; tick <= 50; tick += 1) {
      const before = sampleAnalyticHeavyPose(tick - 1);
      const after = sampleAnalyticHeavyPose(tick);
      expect(length(subtract(after.modelPosition, before.modelPosition))).toBeLessThan(0.03);
      for (const name of Object.keys(after.joints) as Array<keyof typeof after.joints>) {
        expect(length(subtract(after.joints[name], before.joints[name]))).toBeLessThan(0.12);
      }
    }
  });
});
