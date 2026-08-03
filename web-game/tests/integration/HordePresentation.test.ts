import { describe, expect, it } from "vitest";
import { createHordeEnemyState, HordeSimulation } from "../../src/game/run";
import {
  hordeEventToHudEvent,
  toEnemyFieldEntity,
  toLegacyPlayerState,
  toRunHudModel,
  toWeaponLoadoutPresentation,
} from "../../src/render/adapters/HordePresentation";

describe("Horde presentation adapters", () => {
  it("preserves authoritative enemy phases and hit ticks in the view model", () => {
    const cases = [
      ["shambler", 3 / 9],
      ["stalker", 6 / 13],
      ["brute", 5 / 12],
    ] as const;
    for (const [archetype, contactProgress01] of cases) {
      const enemy = createHordeEnemyState(7, archetype, { x: 0, z: 0 });
      enemy.phase = "attack";
      enemy.phaseProgress01 = contactProgress01;
      expect(toEnemyFieldEntity(enemy)).toMatchObject({
        attackPhase: "committed",
        attackProgress01: contactProgress01,
        contactProgress01,
      });
      enemy.phase = "recover";
      enemy.phaseProgress01 = 0.4;
      expect(toEnemyFieldEntity(enemy)).toMatchObject({
        attackPhase: "recovery",
        attackProgress01: 0.4,
      });
    }
  });

  it("derives renderer models without mutating simulation state", () => {
    const simulation = new HordeSimulation({ seed: 42, playerPosition: { x: 0, z: 4.5 } });
    simulation.consumeEvents();
    const before = simulation.serialize();
    const state = simulation.state;

    expect(toLegacyPlayerState(state).position).toEqual(state.player.position);
    expect(state.enemies.map(toEnemyFieldEntity)).toHaveLength(3);
    expect(toWeaponLoadoutPresentation(state)).toMatchObject({
      activeWeapon: "katana",
      actionKind: "none",
      actionProgress01: 0,
    });
    const hud = toRunHudModel(state, false, [], true);
    expect(hud.quickSlots.map((slot) => slot.id)).toEqual([
      "katana",
      "greatsword",
      "twin-blades",
    ]);
    expect(hud.objective).toContain("WASD follows the camera");
    expect(hud.firstUseControls?.[0]).toMatchObject({
      id: "camera",
      input: "MOUSE / DRAG",
      action: "AIM",
    });
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

  it("preserves player hit and death states for authored reactions", () => {
    const simulation = new HordeSimulation({ seed: 9 });
    simulation.state.player.motion = "hit";
    simulation.state.player.hitStunTicksRemaining = 7;
    expect(toLegacyPlayerState(simulation.state)).toMatchObject({
      motion: "hit",
      hitStunRemaining: 7 / 60,
    });
    simulation.state.player.motion = "dead";
    expect(toLegacyPlayerState(simulation.state).motion).toBe("dead");
  });
});
