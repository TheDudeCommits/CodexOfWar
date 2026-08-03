import { describe, expect, it } from "vitest";
import {
  createHordeEnemyState,
  HORDE_ENEMIES,
  HORDE_FORT_FRONT_Z,
  HORDE_PLAYER_RADIUS,
  type HordeEnemyArchetype,
  type HordeEnemyState,
  type HordeGameEvent,
} from "../../src/game/run";
import { frame, freshSimulation, stepTicks, stepUntil } from "./helpers";

function singleEnemy(archetype: HordeEnemyArchetype, z: number): HordeEnemyState {
  return createHordeEnemyState(1, archetype, { x: 0, z });
}

function armedAttack(archetype: HordeEnemyArchetype, z = -1.25): HordeEnemyState {
  const definition = HORDE_ENEMIES[archetype];
  const enemy = singleEnemy(archetype, z);
  enemy.phase = "attack";
  enemy.intent = definition.intent;
  enemy.phaseElapsedTicks = definition.hitTick - 1;
  enemy.phaseDurationTicks = definition.attackTicks;
  enemy.phaseProgress01 = enemy.phaseElapsedTicks / enemy.phaseDurationTicks;
  enemy.attackSerial = 7;
  enemy.attackHasResolved = false;
  enemy.yaw = Math.PI;
  return enemy;
}

describe("Horde Run enemy archetype AI", () => {
  it("makes shamblers pursue directly, stalkers flank laterally, and brutes advance slowly", () => {
    const shambler = freshSimulation();
    shambler.state.enemies = [singleEnemy("shambler", -6)];
    shambler.step(frame());

    const stalker = freshSimulation();
    stalker.state.enemies = [singleEnemy("stalker", -6)];
    stalker.step(frame());

    const brute = freshSimulation();
    brute.state.enemies = [singleEnemy("brute", -6)];
    brute.step(frame());

    const shamblerState = shambler.state.enemies[0];
    const stalkerState = stalker.state.enemies[0];
    const bruteState = brute.state.enemies[0];
    expect(shamblerState?.phase).toBe("pursue");
    expect(shamblerState?.velocity.x).toBeCloseTo(0, 10);
    expect(shamblerState?.velocity.z).toBeCloseTo(HORDE_ENEMIES.shambler.speed, 10);
    expect(stalkerState?.phase).toBe("flank");
    expect(Math.abs(stalkerState?.velocity.x ?? 0)).toBeGreaterThan(1);
    expect(Math.hypot(stalkerState?.velocity.x ?? 0, stalkerState?.velocity.z ?? 0)).toBeCloseTo(
      HORDE_ENEMIES.stalker.speed,
      10,
    );
    expect(bruteState?.velocity.z).toBeCloseTo(HORDE_ENEMIES.brute.speed, 10);
    expect(bruteState?.velocity.z ?? 0).toBeLessThan(shamblerState?.velocity.z ?? 0);
  });

  it.each([
    ["shambler", -1.45, "bite"],
    ["stalker", -2.1, "pounce"],
    ["brute", -2.35, "slam"],
  ] as const)("telegraphs the %s %s before damage", (archetype, z, intent) => {
    const simulation = freshSimulation();
    simulation.state.enemies = [singleEnemy(archetype, z)];
    simulation.step(frame());
    const telegraph = simulation
      .consumeEvents()
      .find(
        (event): event is Extract<HordeGameEvent, { type: "enemy-telegraph" }> =>
          event.type === "enemy-telegraph",
      );

    expect(simulation.state.enemies[0]).toMatchObject({ phase: "windup", intent });
    expect(telegraph).toMatchObject({
      archetype,
      intent,
      resolveInTicks:
        HORDE_ENEMIES[archetype].windupTicks + HORDE_ENEMIES[archetype].hitTick,
    });
    expect(simulation.state.player.health).toBe(100);
  });

  it("resolves damage only after the advertised telegraph duration", () => {
    const simulation = freshSimulation();
    simulation.state.enemies = [singleEnemy("shambler", -1.45)];
    simulation.step(frame());
    const telegraph = simulation
      .consumeEvents()
      .find(
        (event): event is Extract<HordeGameEvent, { type: "enemy-telegraph" }> =>
          event.type === "enemy-telegraph",
      );
    expect(telegraph).toBeDefined();

    const hit = stepUntil(simulation, (event) => event.type === "enemy-attack-hit", 100);
    expect(hit.tick - (telegraph?.tick ?? 0)).toBe(telegraph?.resolveInTicks);
    expect(simulation.state.player.health).toBe(88);
  });

  it.each([
    ["shambler", 12],
    ["stalker", 10],
    ["brute", 28],
  ] as const)("applies the distinct %s attack damage", (archetype, damage) => {
    const simulation = freshSimulation();
    simulation.state.enemies = [armedAttack(archetype)];
    simulation.step(frame());

    expect(simulation.state.player.health).toBe(100 - damage);
    expect(simulation.consumeEvents()).toContainEqual(
      expect.objectContaining({
        type: "enemy-attack-hit",
        archetype,
        damage,
        attackSerial: 7,
      }),
    );
  });

  it("turns an otherwise causal enemy hit into an evasion during dodge i-frames", () => {
    const hitSimulation = freshSimulation();
    hitSimulation.state.enemies = [armedAttack("brute")];
    hitSimulation.step(frame());
    expect(hitSimulation.state.player.health).toBe(72);

    const dodgeSimulation = freshSimulation();
    dodgeSimulation.state.enemies = [armedAttack("brute")];
    dodgeSimulation.step(frame({ moveX: 1, dodgePressed: true }));
    const events = dodgeSimulation.consumeEvents();

    expect(dodgeSimulation.state.player.health).toBe(100);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "enemy-attack-evaded",
        archetype: "brute",
        attackSerial: 7,
      }),
    );
    expect(events.some((event) => event.type === "enemy-attack-hit")).toBe(false);
  });

  it("makes the stalker pounce translate during its committed attack", () => {
    const simulation = freshSimulation();
    const stalker = armedAttack("stalker", -3.2);
    stalker.phaseElapsedTicks = 0;
    stalker.yaw = Math.PI;
    simulation.state.enemies = [stalker];
    const before = stalker.position.z;
    stepTicks(simulation, 5);

    expect(simulation.state.enemies[0]?.position.z).toBeGreaterThan(before + 0.3);
    expect(simulation.state.enemies[0]?.velocity.z).toBeGreaterThan(5);
  });

  it("separates coincident enemies deterministically without changing their roster", () => {
    const makeSimulation = () => {
      const simulation = freshSimulation(9191);
      const left = singleEnemy("shambler", 0);
      const right = createHordeEnemyState(2, "brute", { x: 0, z: 0 });
      left.phase = "recover";
      right.phase = "recover";
      left.phaseDurationTicks = 1000;
      right.phaseDurationTicks = 1000;
      simulation.state.enemies = [left, right];
      return simulation;
    };
    const first = makeSimulation();
    const second = makeSimulation();
    first.step(frame());
    second.step(frame());

    const firstLeft = first.state.enemies[0];
    const firstRight = first.state.enemies[1];
    expect(firstLeft).toBeDefined();
    expect(firstRight).toBeDefined();
    expect(
      Math.hypot(
        (firstLeft?.position.x ?? 0) - (firstRight?.position.x ?? 0),
        (firstLeft?.position.z ?? 0) - (firstRight?.position.z ?? 0),
      ),
    ).toBeGreaterThanOrEqual((firstLeft?.radius ?? 0) + (firstRight?.radius ?? 0) + 0.079);
    expect(first.exportState()).toEqual(second.exportState());
  });

  it("admits only one early-wave telegraph at a time and rotates the next turn fairly", () => {
    const simulation = freshSimulation(6401);
    const first = createHordeEnemyState(1, "shambler", { x: -0.18, z: -1.38 });
    const second = createHordeEnemyState(2, "shambler", { x: 0.18, z: -1.38 });
    simulation.state.wave = 3;
    simulation.state.player.invulnerableTicksRemaining = 2_000;
    // Reverse storage order to prove selection is driven by attack history and id,
    // rather than whichever enemy happens to update first.
    simulation.state.enemies = [second, first];

    simulation.step(frame());
    const firstEvents = simulation.consumeEvents();
    expect(
      firstEvents.filter((event) => event.type === "enemy-telegraph"),
    ).toEqual([expect.objectContaining({ enemyId: 1, attackSerial: 1 })]);
    expect(
      simulation.state.enemies.filter(
        (enemy) => enemy.phase === "windup" || enemy.phase === "attack",
      ),
    ).toHaveLength(1);
    expect(simulation.state.enemies.find((enemy) => enemy.id === 2)?.phase).toBe("pursue");
    expect(
      Math.abs(simulation.state.enemies.find((enemy) => enemy.id === 2)?.velocity.x ?? 0),
    ).toBeGreaterThan(0);

    const telegraphOrder = [1];
    for (let tick = 0; tick < 360 && telegraphOrder.length < 2; tick += 1) {
      simulation.step(frame());
      const activeAttackers = simulation.state.enemies.filter(
        (enemy) => enemy.phase === "windup" || enemy.phase === "attack",
      );
      expect(activeAttackers.length).toBeLessThanOrEqual(1);
      for (const event of simulation.consumeEvents()) {
        if (event.type === "enemy-telegraph") telegraphOrder.push(event.enemyId);
      }
    }

    expect(telegraphOrder.slice(0, 2)).toEqual([1, 2]);
  });

  it("allows two coordinated attackers in late waves while holding the rest", () => {
    const simulation = freshSimulation(6402);
    simulation.state.wave = 4;
    simulation.state.enemies = [
      createHordeEnemyState(3, "shambler", { x: 0.3, z: -1.35 }),
      createHordeEnemyState(2, "shambler", { x: 0, z: -1.35 }),
      createHordeEnemyState(1, "shambler", { x: -0.3, z: -1.35 }),
    ];

    simulation.step(frame());
    const telegraphs = simulation
      .consumeEvents()
      .filter((event) => event.type === "enemy-telegraph");

    expect(telegraphs).toEqual([
      expect.objectContaining({ enemyId: 2 }),
      expect.objectContaining({ enemyId: 1 }),
    ]);
    expect(
      simulation.state.enemies.filter(
        (enemy) => enemy.phase === "windup" || enemy.phase === "attack",
      ),
    ).toHaveLength(2);
    expect(simulation.state.enemies.find((enemy) => enemy.id === 3)?.phase).toBe("pursue");
  });

  it("keeps the player and every enemy in front of the fort boundary", () => {
    const simulation = freshSimulation(6403);
    simulation.state.player.position = { x: 0, z: -100 };
    simulation.state.enemies = [
      createHordeEnemyState(1, "shambler", { x: 0, z: -100 }),
      createHordeEnemyState(2, "stalker", { x: 1, z: -100 }),
      createHordeEnemyState(3, "brute", { x: -1, z: -100 }),
    ];

    simulation.step(frame({ moveZ: -1 }));

    expect(simulation.state.player.position.z).toBeGreaterThanOrEqual(
      HORDE_FORT_FRONT_Z + HORDE_PLAYER_RADIUS,
    );
    for (const enemy of simulation.state.enemies) {
      expect(enemy.position.z).toBeGreaterThanOrEqual(HORDE_FORT_FRONT_Z + enemy.radius);
    }
  });

  it("enters defeat, cancels player action, and emits terminal causality", () => {
    const simulation = freshSimulation();
    simulation.state.player.health = 20;
    simulation.state.enemies = [armedAttack("brute")];
    simulation.step(frame());
    const events = simulation.consumeEvents();

    expect(simulation.state.phase).toBe("defeat");
    expect(simulation.state.player).toMatchObject({ health: 0, motion: "dead" });
    expect(simulation.state.player.action.kind).toBe("none");
    expect(events.map((event) => event.type)).toEqual([
      "enemy-attack-hit",
      "player-defeated",
    ]);
  });
});
