import { describe, expect, it } from "vitest";
import { sampleHordeWeaponPose } from "../../src/render/objects/CharacterViews";

function sample(activeWeapon: "katana" | "greatsword" | "twin-blades", special: boolean) {
  return sampleHordeWeaponPose({
    activeWeapon,
    specialCooldown01: 0,
    specialActive01: special ? 1 : 0,
    elapsed: 0.4,
    actionKind: special ? "special" : "normal",
    actionProgress01: 0.5,
  });
}

describe("Horde weapon pose layer", () => {
  it("keeps idle neutral and returns deterministic additive poses", () => {
    expect(sampleHordeWeaponPose()).toMatchObject({
      modelPosition: [0, 0, 0],
      modelRotation: [0, 0, 0],
    });
    expect(sample("katana", false)).toEqual(sample("katana", false));
  });

  it("makes normal and special silhouettes distinct for all three loadouts", () => {
    const signatures = new Set<string>();
    for (const weapon of ["katana", "greatsword", "twin-blades"] as const) {
      const normal = sample(weapon, false);
      const special = sample(weapon, true);
      expect(special).not.toEqual(normal);
      expect(special.supportLowerArmRotation).not.toEqual(normal.supportLowerArmRotation);
      signatures.add(JSON.stringify(normal));
      signatures.add(JSON.stringify(special));
    }
    expect(signatures.size).toBe(6);
  });
});
