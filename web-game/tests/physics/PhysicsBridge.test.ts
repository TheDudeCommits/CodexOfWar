import { describe, expect, it } from "vitest";
import { PhysicsBridge } from "../../src/physics/PhysicsBridge";

describe("PhysicsBridge fort collision", () => {
  it("keeps the player in front of the authored fort wall", async () => {
    const physics = await PhysicsBridge.create();
    try {
      physics.enableHordeFortCollider();
      let position = { x: 0, z: 0 };
      physics.reset(position, []);
      for (let frame = 0; frame < 120; frame += 1) {
        const desired = { x: position.x, z: position.z - 0.1 };
        position = physics.resolvePlayerMovement(position, desired, [], 1 / 60);
      }
      expect(position.z).toBeGreaterThan(-4.65);
      expect(position.z).toBeLessThan(-4.3);
    } finally {
      physics.dispose();
    }
  });
});
