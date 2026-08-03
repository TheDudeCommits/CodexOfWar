import { describe, expect, it } from "vitest";
import {
  HORDE_DODGE_COST,
  HORDE_DODGE_INVULNERABLE_TICKS,
  HORDE_WEAPONS,
  type HordeGameEvent,
  type HordeWeaponId,
  type HordeWeaponSlot,
} from "../../src/game/run";
import { frame, freshSimulation, passiveEnemy, stepTicks } from "./helpers";

function selectWeapon(slot: HordeWeaponSlot) {
  if (slot === 1) return frame({ weaponSlot1Pressed: true });
  if (slot === 2) return frame({ weaponSlot2Pressed: true });
  return frame({ weaponSlot3Pressed: true });
}

function runNormalAttack(weapon: HordeWeaponId, slot: HordeWeaponSlot, enemyZ = -2) {
  const simulation = freshSimulation();
  simulation.state.enemies = [passiveEnemy(1, "shambler", { x: 0, z: enemyZ })];
  if (slot !== 1) {
    simulation.step(selectWeapon(slot));
    simulation.consumeEvents();
  }
  const staminaBefore = simulation.state.player.stamina;
  simulation.step(frame({ attackPressed: true }));
  const staminaAfterStart = simulation.state.player.stamina;
  const events = simulation.consumeEvents();
  events.push(...stepTicks(simulation, 70));
  return {
    events,
    simulation,
    staminaSpent: staminaBefore - staminaAfterStart,
    hitEvents: events.filter(
      (event): event is Extract<HordeGameEvent, { type: "enemy-hit" }> =>
        event.type === "enemy-hit",
    ),
    weapon,
  };
}

describe("Horde Run player fundamentals", () => {
  it("moves at a fixed step, spends sprint stamina, and exposes adapter velocity", () => {
    const simulation = freshSimulation();
    const startZ = simulation.state.player.position.z;
    const startStamina = simulation.state.player.stamina;
    simulation.step(frame({ moveZ: -1, sprint: true }));

    expect(simulation.state.tick).toBe(1);
    expect(simulation.state.elapsedSeconds).toBeCloseTo(1 / 60, 12);
    expect(simulation.state.player.position.z).toBeLessThan(startZ);
    expect(simulation.state.player.velocity.z).toBeLessThan(0);
    expect(simulation.state.player.motion).toBe("sprint");
    expect(simulation.state.player.stamina).toBeLessThan(startStamina);
  });

  it("dodges in the requested direction with stamina cost and explicit invulnerability", () => {
    const simulation = freshSimulation();
    simulation.step(frame({ moveX: 1, dodgePressed: true }));
    const dodgeEvent = simulation.consumeEvents().find((event) => event.type === "dodge-started");

    expect(simulation.state.player.motion).toBe("dodge");
    expect(simulation.state.player.position.x).toBeGreaterThan(0);
    expect(simulation.state.player.stamina).toBe(100 - HORDE_DODGE_COST);
    expect(simulation.state.player.invulnerableTicksRemaining).toBe(
      HORDE_DODGE_INVULNERABLE_TICKS,
    );
    expect(dodgeEvent).toMatchObject({
      type: "dodge-started",
      staminaCost: HORDE_DODGE_COST,
      invulnerableTicks: HORDE_DODGE_INVULNERABLE_TICKS,
    });
  });

  it("clamps movement to the arena and never regenerates beyond maximum stamina", () => {
    const simulation = freshSimulation();
    simulation.state.player.position = { x: simulation.state.arenaRadius - 0.49, z: 0 };
    simulation.state.player.stamina = simulation.state.player.maxStamina - 0.1;
    stepTicks(simulation, 120, frame({ moveX: 1 }));

    expect(Math.hypot(simulation.state.player.position.x, simulation.state.player.position.z)).toBeLessThanOrEqual(
      simulation.state.arenaRadius - 0.48 + 1e-9,
    );
    expect(simulation.state.player.stamina).toBe(simulation.state.player.maxStamina);
  });
});

describe("Horde Run weapon identities", () => {
  it("gives the katana, greatsword, and twin blades different timing, damage, and hit counts", () => {
    const katana = runNormalAttack("katana", 1);
    const greatsword = runNormalAttack("greatsword", 2);
    const twinBlades = runNormalAttack("twin-blades", 3);

    expect(katana.hitEvents.map((event) => event.damage)).toEqual([28]);
    expect(greatsword.hitEvents.map((event) => event.damage)).toEqual([53]);
    expect(twinBlades.hitEvents.map((event) => event.damage)).toEqual([16, 20]);
    expect(katana.hitEvents[0]?.tick).toBeLessThan(greatsword.hitEvents[0]?.tick ?? 0);
    expect(twinBlades.hitEvents).toHaveLength(2);
    expect(katana.staminaSpent).toBeCloseTo(HORDE_WEAPONS.katana.normal.staminaCost, 8);
    expect(greatsword.staminaSpent).toBeCloseTo(
      HORDE_WEAPONS.greatsword.normal.staminaCost,
      8,
    );
    expect(twinBlades.staminaSpent).toBeCloseTo(
      HORDE_WEAPONS["twin-blades"].normal.staminaCost,
      8,
    );
  });

  it("makes the greatsword materially wider and longer-ranged than the katana", () => {
    const angle = (65 * Math.PI) / 180;
    const distance = 3.55;
    const enemyPosition = {
      x: Math.sin(angle) * distance,
      z: -Math.cos(angle) * distance,
    };

    const katana = freshSimulation();
    katana.state.enemies = [passiveEnemy(1, "shambler", enemyPosition)];
    katana.step(frame({ attackPressed: true }));
    const katanaEvents = stepTicks(katana, 50);

    const greatsword = freshSimulation();
    greatsword.state.enemies = [passiveEnemy(1, "shambler", enemyPosition)];
    greatsword.step(frame({ weaponSlot2Pressed: true }));
    greatsword.consumeEvents();
    greatsword.step(frame({ attackPressed: true }));
    const greatswordEvents = stepTicks(greatsword, 60);

    expect(katanaEvents.some((event) => event.type === "enemy-hit")).toBe(false);
    expect(greatswordEvents.some((event) => event.type === "enemy-hit")).toBe(true);
  });

  it("switches all three slots and emits stable weapon events", () => {
    const simulation = freshSimulation();
    simulation.step(frame({ weaponSlot2Pressed: true }));
    simulation.step(frame({ weaponSlot3Pressed: true }));
    simulation.step(frame({ weaponSlot1Pressed: true }));
    const switches = simulation
      .consumeEvents()
      .filter((event) => event.type === "weapon-switched");

    expect(switches.map((event) => event.weapon)).toEqual([
      "greatsword",
      "twin-blades",
      "katana",
    ]);
    expect(simulation.state.player.selectedWeapon).toBe("katana");
  });

  it("rejects attacks without stamina and causes no damage without attack input", () => {
    const simulation = freshSimulation();
    simulation.state.enemies = [passiveEnemy(1, "shambler", { x: 0, z: -1.5 })];
    stepTicks(simulation, 40);
    expect(simulation.state.enemies[0]?.health).toBe(2000);

    simulation.state.player.stamina = 0;
    simulation.step(frame({ attackPressed: true }));
    expect(simulation.consumeEvents()).toContainEqual(
      expect.objectContaining({ type: "attack-rejected", reason: "stamina" }),
    );
    expect(simulation.state.player.action.kind).toBe("none");
  });
});

describe("Horde Run signature moves", () => {
  it("executes a forward Iaido dash and narrow single cut for the katana", () => {
    const simulation = freshSimulation();
    simulation.state.enemies = [passiveEnemy(1, "brute", { x: 0, z: -4 }, 2000)];
    simulation.step(frame({ specialPressed: true }));
    const cooldownAtStart = simulation.state.player.specialCooldowns.katana;
    expect(simulation.state.player.action).toMatchObject({ kind: "special", phase: "startup" });
    expect(cooldownAtStart).toBe(HORDE_WEAPONS.katana.special.cooldownTicks);

    const events = stepTicks(simulation, HORDE_WEAPONS.katana.special.totalTicks + 2);
    const hits = events.filter((event) => event.type === "enemy-hit");
    expect(simulation.state.player.position.z).toBeLessThan(-1.7);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ weapon: "katana", special: true, damage: 71 });
  });

  it("executes a stationary radial quake that cleaves enemies in front and behind", () => {
    const simulation = freshSimulation();
    simulation.state.enemies = [
      passiveEnemy(1, "brute", { x: 0, z: -3.5 }, 2000),
      passiveEnemy(2, "brute", { x: 0, z: 3.5 }, 2000),
    ];
    simulation.step(frame({ weaponSlot2Pressed: true }));
    simulation.consumeEvents();
    simulation.step(frame({ specialPressed: true }));
    const events = stepTicks(simulation, HORDE_WEAPONS.greatsword.special.totalTicks + 2);
    const hits = events.filter((event) => event.type === "enemy-hit");

    expect(simulation.state.player.position).toEqual({ x: 0, z: 0 });
    expect(hits).toHaveLength(2);
    expect(hits.every((event) => event.weapon === "greatsword" && event.damage === 88)).toBe(true);
  });

  it("executes a mobile six-pulse twin-blade whirlwind", () => {
    const simulation = freshSimulation();
    simulation.state.enemies = [
      passiveEnemy(1, "brute", { x: 1.6, z: -0.5 }, 2000),
      passiveEnemy(2, "brute", { x: -1.6, z: 0.5 }, 2000),
    ];
    simulation.step(frame({ weaponSlot3Pressed: true }));
    simulation.consumeEvents();
    simulation.step(frame({ specialPressed: true }));
    const events = stepTicks(
      simulation,
      HORDE_WEAPONS["twin-blades"].special.totalTicks + 2,
      frame({ moveX: 1 }),
    );
    const hits = events.filter((event) => event.type === "enemy-hit");

    expect(simulation.state.player.position.x).toBeGreaterThan(0.5);
    expect(hits).toHaveLength(12);
    expect(new Set(hits.map((event) => event.strikeIndex)).size).toBe(6);
    expect(hits.every((event) => event.weapon === "twin-blades" && event.special)).toBe(true);
  });

  it.each([
    ["katana", 1],
    ["greatsword", 2],
    ["twin-blades", 3],
  ] as const)("prevents %s special spam while its visible cooldown is active", (weapon, slot) => {
    const simulation = freshSimulation();
    simulation.state.enemies = [passiveEnemy(1, "brute", { x: 0, z: -8 }, 10_000)];
    if (slot !== 1) {
      simulation.step(selectWeapon(slot));
      simulation.consumeEvents();
    }
    simulation.step(frame({ specialPressed: true }));
    simulation.consumeEvents();
    stepTicks(simulation, HORDE_WEAPONS[weapon].special.totalTicks + 1);
    const remaining = simulation.state.player.specialCooldowns[weapon];
    expect(remaining).toBeGreaterThan(0);

    simulation.state.player.stamina = simulation.state.player.maxStamina;
    simulation.step(frame({ specialPressed: true }));
    expect(simulation.consumeEvents()).toContainEqual(
      expect.objectContaining({ type: "special-rejected", weapon, reason: "cooldown" }),
    );
    expect(simulation.state.player.action.kind).toBe("none");
  });
});
