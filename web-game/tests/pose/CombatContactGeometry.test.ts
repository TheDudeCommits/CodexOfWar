import { describe, expect, it } from "vitest";
import { measureBladeEdgeToCapsule } from "../../src/render/objects/CombatContactGeometry";

const verticalTarget = {
  axis: {
    start: [0, -1, 0] as const,
    end: [0, 1, 0] as const,
  },
  radiusMeters: 0.5,
};

describe("blade-edge to visible target contour measurement", () => {
  it("identifies exactly one exterior endpoint at tangency", () => {
    const result = measureBladeEdgeToCapsule(
      {
        start: [-1.2, 0, 0],
        end: [-0.5, 0, 0],
      },
      verticalTarget,
    );

    expect(result).toMatchObject({
      blade01: 1,
      separationMeters: 0,
      standoffMeters: 0,
      penetrationMeters: 0,
      exteriorContactPoints: 1,
      closestFeature: "blade-end",
    });
    expect(result.bladeClosestWorld).toEqual(result.targetClosestWorld);
  });

  it("distinguishes visible standoff from torso entry", () => {
    const standoff = measureBladeEdgeToCapsule(
      { start: [-1.2, 0, 0], end: [-0.58, 0, 0] },
      verticalTarget,
    );
    const penetration = measureBladeEdgeToCapsule(
      { start: [-1.2, 0, 0], end: [-0.42, 0, 0] },
      verticalTarget,
    );

    expect(standoff.standoffMeters).toBe(0.08);
    expect(standoff.penetrationMeters).toBe(0);
    expect(standoff.exteriorContactPoints).toBe(0);
    expect(penetration.standoffMeters).toBe(0);
    expect(penetration.penetrationMeters).toBe(0.08);
    expect(penetration.exteriorContactPoints).toBe(0);
  });
});
