import { describe, expect, it } from "vitest";
import { FIXED_TIMESTEP, P30_REVIEW_TUNING } from "../../src/game/simulation/constants";
import { createInitialWorld, EMPTY_INPUT, GameSimulation } from "../../src/game/simulation/GameSimulation";
import type { GameEvent, InputFrame } from "../../src/game/simulation/types";

function createP30Simulation(): GameSimulation {
  return new GameSimulation(
    createInitialWorld({
      playerPosition: { x: 0, z: 2.6 },
      enemyPosition: { x: 0, z: 0 },
    }),
    P30_REVIEW_TUNING,
  );
}

describe("P30 deterministic combat contract", () => {
  it("moves at 3 m/s and resolves the exact attack phase tape", () => {
    const simulation = createP30Simulation();
    const events: GameEvent[] = [];
    const phases = new Map<number, string>();
    const health = new Map<number, number>();

    for (let tick = 0; tick <= 60; tick += 1) {
      const input: InputFrame = {
        ...EMPTY_INPUT,
        moveZ: tick <= 19 ? -1 : 0,
        attackPressed: tick === 24 || tick === 28,
      };
      simulation.step(input, FIXED_TIMESTEP);
      phases.set(tick, simulation.state.player.attackPhase);
      health.set(tick, simulation.state.enemy.health);
      events.push(...simulation.consumeEvents());
    }

    expect(simulation.state.player.position.x).toBeCloseTo(0, 10);
    expect(simulation.state.player.position.z).toBeCloseTo(1.6, 10);
    for (let tick = 24; tick <= 31; tick += 1) expect(phases.get(tick)).toBe("startup");
    for (let tick = 32; tick <= 35; tick += 1) expect(phases.get(tick)).toBe("active");
    for (let tick = 36; tick <= 49; tick += 1) expect(phases.get(tick)).toBe("recovery");
    expect(phases.get(50)).toBe("idle");
    expect(health.get(32)).toBe(100);
    expect(health.get(33)).toBe(90);

    expect(events.filter((event) => event.type === "attack-started")).toEqual([
      expect.objectContaining({ tick: 24, attackSerial: 1 }),
    ]);
    expect(events.filter((event) => event.type === "attack-rejected-busy")).toEqual([
      expect.objectContaining({ tick: 28, attackSerial: 1 }),
    ]);
    expect(events.filter((event) => event.type === "enemy-hit")).toEqual([
      expect.objectContaining({ tick: 33, damage: 10, remainingHealth: 90 }),
    ]);
  });

  it("does not hit a target outside attack range", () => {
    const simulation = createP30Simulation();
    const events: GameEvent[] = [];
    for (let tick = 0; tick < 60; tick += 1) {
      simulation.step({ ...EMPTY_INPUT, attackPressed: tick === 0 }, FIXED_TIMESTEP);
      events.push(...simulation.consumeEvents());
    }
    expect(simulation.state.enemy.health).toBe(100);
    expect(events.some((event) => event.type === "enemy-hit")).toBe(false);
  });

  it("emits no duplicate hit during one active window", () => {
    const simulation = createP30Simulation();
    simulation.state.player.position.z = 1.6;
    const events: GameEvent[] = [];
    for (let tick = 0; tick < 50; tick += 1) {
      simulation.step({ ...EMPTY_INPUT, attackPressed: tick === 0 }, FIXED_TIMESTEP);
      events.push(...simulation.consumeEvents());
    }
    expect(events.filter((event) => event.type === "enemy-hit")).toHaveLength(1);
    expect(simulation.state.enemy.health).toBe(90);
  });
});
