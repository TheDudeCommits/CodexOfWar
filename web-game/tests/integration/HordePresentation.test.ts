import { describe, expect, it } from "vitest";
import { HordeSimulation } from "../../src/game/run";
import {
  hordeEventToHudEvent,
  toEnemyFieldEntity,
  toLegacyPlayerState,
  toRunHudModel,
  toWeaponLoadoutPresentation,
} from "../../src/render/adapters/HordePresentation";

describe("Horde presentation adapters", () => {
  it("derives renderer models without mutating simulation state", () => {
    const simulation = new HordeSimulation({ seed: 42, playerPosition: { x: 0, z: 4.5 } });
    simulation.consumeEvents();
    const before = simulation.serialize();
    const state = simulation.state;

    expect(toLegacyPlayerState(state).position).toEqual(state.player.position);
    expect(state.enemies.map(toEnemyFieldEntity)).toHaveLength(3);
    expect(toWeaponLoadoutPresentation(state).activeWeapon).toBe("katana");
    const hud = toRunHudModel(state, false, [], true);
    expect(hud.quickSlots.map((slot) => slot.id)).toEqual([
      "katana",
      "greatsword",
      "twin-blades",
    ]);
    expect(hud.objective).toContain("begin the horde");
    expect(simulation.serialize()).toBe(before);
  });

  it("maps wave events into a readable HUD feed entry", () => {
    const simulation = new HordeSimulation({ seed: 7 });
    const event = simulation.consumeEvents().find((candidate) => candidate.type === "wave-started");
    expect(event).toBeDefined();
    expect(event && hordeEventToHudEvent(event)).toMatchObject({
      text: "Wave 1 · 3 hostiles",
      tone: "danger",
    });
  });
});
