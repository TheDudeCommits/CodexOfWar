import { describe, expect, it } from "vitest";
import {
  HordeSimulation,
  type HordeGameEvent,
  type HordeInputFrame,
} from "../../src/game/run";
import { frame, freshSimulation, passiveEnemy, stepTicks } from "./helpers";

function authoredTape(tick: number): HordeInputFrame {
  const movementPhase = Math.floor(tick / 75) % 4;
  return frame({
    moveX: movementPhase === 0 ? 1 : movementPhase === 2 ? -1 : 0,
    moveZ: movementPhase === 1 ? -1 : movementPhase === 3 ? 1 : 0,
    sprint: tick % 120 < 32,
    dodgePressed: tick % 97 === 12,
    attackPressed: tick % 43 === 8,
    specialPressed: tick === 150 || tick === 510,
    weaponSlot1Pressed: tick === 420,
    weaponSlot2Pressed: tick === 105,
    weaponSlot3Pressed: tick === 330,
    faceYaw: ((tick % 180) / 180) * Math.PI * 2 - Math.PI,
  });
}

function runTape(simulation: HordeSimulation, startTick: number, count: number): HordeGameEvent[] {
  const events: HordeGameEvent[] = [];
  for (let offset = 0; offset < count; offset += 1) {
    simulation.step(authoredTape(startTick + offset));
    events.push(...simulation.consumeEvents());
  }
  return events;
}

describe("Horde Run deterministic state", () => {
  it("produces bit-for-bit identical state and event streams for the same seed and input tape", () => {
    const first = new HordeSimulation({ seed: 0x1234_abcd });
    const second = new HordeSimulation({ seed: 0x1234_abcd });
    const firstInitialEvents = first.consumeEvents();
    const secondInitialEvents = second.consumeEvents();
    const firstEvents = runTape(first, 0, 720);
    const secondEvents = runTape(second, 0, 720);

    expect(firstInitialEvents).toEqual(secondInitialEvents);
    expect(firstEvents).toEqual(secondEvents);
    expect(first.serialize()).toBe(second.serialize());
    expect(first.exportState()).toEqual(second.exportState());
  });

  it("uses the seed to vary spawn layouts while preserving the authored composition", () => {
    const first = freshSimulation(111);
    const second = freshSimulation(222);

    expect(first.state.enemies.map((enemy) => enemy.archetype)).toEqual(
      second.state.enemies.map((enemy) => enemy.archetype),
    );
    expect(first.state.enemies.map((enemy) => enemy.position)).not.toEqual(
      second.state.enemies.map((enemy) => enemy.position),
    );
  });

  it("restores a JSON-safe snapshot and continues with exactly the same outcome", () => {
    const original = new HordeSimulation({ seed: 91_827 });
    original.consumeEvents();
    runTape(original, 0, 180);
    const json = original.serialize();
    const parsed = JSON.parse(json) as ReturnType<HordeSimulation["exportState"]>;
    const restored = HordeSimulation.fromState(parsed);

    const originalEvents = runTape(original, 180, 360);
    const restoredEvents = runTape(restored, 180, 360);
    expect(restoredEvents).toEqual(originalEvents);
    expect(restored.exportState()).toEqual(original.exportState());
    expect(JSON.parse(restored.serialize())).toEqual(restored.exportState());
  });

  it("clears pending events when loading a snapshot", () => {
    const simulation = new HordeSimulation({ seed: 77 });
    const snapshot = simulation.exportState();
    simulation.step(frame({ dodgePressed: true }));
    expect(simulation.consumeEvents().length).toBeGreaterThan(0);
    simulation.step(frame({ attackPressed: true }));
    simulation.loadState(snapshot);

    expect(simulation.consumeEvents()).toEqual([]);
    expect(simulation.exportState()).toEqual(snapshot);
  });

  it("assigns event IDs monotonically and preserves tick causality", () => {
    const simulation = new HordeSimulation({ seed: 90 });
    simulation.step(frame({ weaponSlot2Pressed: true }));
    simulation.step(frame({ attackPressed: true }));
    const events = simulation.consumeEvents();

    expect(events.map((event) => event.id)).toEqual(events.map((_, index) => index + 1));
    expect(events.map((event) => event.tick)).toEqual([0, 0, 1]);
    expect(events.map((event) => event.type)).toEqual([
      "wave-started",
      "weapon-switched",
      "attack-started",
    ]);
  });
});

describe("Horde Run lock-target and causality helpers", () => {
  it("ranks live targets, locks the best, cycles deterministically, and excludes dead targets", () => {
    const simulation = freshSimulation();
    const front = passiveEnemy(10, "shambler", { x: 0, z: -3 });
    const right = passiveEnemy(11, "stalker", { x: 2, z: -2.5 });
    const behind = passiveEnemy(12, "brute", { x: 0, z: 2.5 });
    simulation.state.enemies = [behind, right, front];

    const candidates = simulation.getLockCandidates();
    expect(candidates[0]?.enemyId).toBe(10);
    expect(simulation.lockBestTarget()).toBe(10);
    expect(simulation.cycleLockTarget(1)).toBe(11);
    expect(simulation.cycleLockTarget(-1)).toBe(10);

    front.health = 0;
    front.phase = "dead";
    expect(simulation.getLockCandidates().map((candidate) => candidate.enemyId)).not.toContain(10);
    expect(simulation.lockBestTarget()).toBe(11);
  });

  it("honors an explicit lock request and clears an invalid lock", () => {
    const simulation = freshSimulation();
    simulation.state.enemies = [passiveEnemy(42, "shambler", { x: 2, z: 0 })];
    simulation.step(frame({ lockTargetId: 42 }));
    expect(simulation.state.player.lockedTargetId).toBe(42);
    expect(simulation.state.player.yaw).toBeGreaterThan(0);

    simulation.step(frame({ lockTargetId: 999 }));
    expect(simulation.state.player.lockedTargetId).toBeNull();
  });

  it("changes enemy health only when an authored attack reaches a valid target", () => {
    const control = freshSimulation();
    control.state.enemies = [passiveEnemy(1, "shambler", { x: 0, z: -1.5 })];
    stepTicks(control, 40);

    const treatment = freshSimulation();
    treatment.state.enemies = [passiveEnemy(1, "shambler", { x: 0, z: -1.5 })];
    treatment.step(frame({ attackPressed: true }));
    treatment.consumeEvents();
    const events = stepTicks(treatment, 40);

    expect(control.state.enemies[0]?.health).toBe(2000);
    expect(treatment.state.enemies[0]?.health).toBe(1972);
    expect(events.filter((event) => event.type === "enemy-hit")).toHaveLength(1);
  });
});
