import { describe, expect, it } from "vitest";
import {
  EMPTY_HORDE_INPUT,
  HORDE_COMBO_BASE_DURATION_TICKS,
  HORDE_UPGRADES,
  HORDE_WAVES,
  type HordeGameEvent,
  type HordeSimulation,
  type HordeUpgradeId,
} from "../../src/game/run";
import { frame, freshSimulation, passiveEnemy, stepTicks } from "./helpers";

function markWaveDefeated(simulation: HordeSimulation): void {
  for (const enemy of simulation.state.enemies) {
    enemy.health = 0;
    enemy.phase = "dead";
  }
}

function clearCurrentWave(simulation: HordeSimulation): HordeGameEvent[] {
  markWaveDefeated(simulation);
  simulation.step(frame());
  return simulation.consumeEvents();
}

function attackThroughRecovery(simulation: HordeSimulation): HordeGameEvent[] {
  simulation.step(frame({ attackPressed: true }));
  const events = simulation.consumeEvents();
  events.push(...stepTicks(simulation, 24));
  return events;
}

describe("Horde Run scoring and combos", () => {
  it("awards score, kills, essence, and an increasing multiplier from causal kills", () => {
    const simulation = freshSimulation();
    simulation.state.enemies = [
      passiveEnemy(1, "shambler", { x: 0, z: -1.35 }, 1),
      passiveEnemy(2, "shambler", { x: 0.2, z: -1.55 }, 1),
    ];

    const firstEvents = attackThroughRecovery(simulation);
    expect(firstEvents).toContainEqual(
      expect.objectContaining({
        type: "enemy-defeated",
        enemyId: 1,
        scoreAwarded: 100,
        essenceAwarded: 10,
        comboMultiplier: 1,
      }),
    );
    expect(simulation.state).toMatchObject({ score: 100, kills: 1, essence: 10 });
    expect(simulation.state.combo.multiplier).toBe(1.25);

    const secondEvents = attackThroughRecovery(simulation);
    expect(secondEvents).toContainEqual(
      expect.objectContaining({
        type: "enemy-defeated",
        enemyId: 2,
        scoreAwarded: 125,
        comboMultiplier: 1.25,
      }),
    );
    expect(simulation.state).toMatchObject({ score: 225, kills: 2, essence: 20 });
    expect(simulation.state.combo).toMatchObject({ count: 2, multiplier: 1.5 });
    expect(simulation.state.phase).toBe("upgrade");
  });

  it("breaks a combo when its deterministic tick window expires", () => {
    const simulation = freshSimulation();
    simulation.state.enemies = [
      passiveEnemy(1, "shambler", { x: 0, z: -1.35 }, 1),
      passiveEnemy(2, "brute", { x: 0, z: -10 }, 2000),
    ];
    attackThroughRecovery(simulation);
    expect(simulation.state.combo.count).toBe(1);

    const events = stepTicks(simulation, HORDE_COMBO_BASE_DURATION_TICKS + 5);
    expect(simulation.state.combo).toMatchObject({
      count: 0,
      multiplier: 1,
      ticksRemaining: 0,
    });
    expect(events).toContainEqual(
      expect.objectContaining({ type: "combo-broken", previousCount: 1, reason: "timeout" }),
    );
  });

  it("caps the score multiplier at 4x", () => {
    const simulation = freshSimulation();
    simulation.state.combo.count = 40;
    simulation.state.combo.multiplier = 4;
    simulation.state.combo.ticksRemaining = 100;
    simulation.state.enemies = [passiveEnemy(1, "shambler", { x: 0, z: -1.35 }, 1)];
    attackThroughRecovery(simulation);

    expect(simulation.state.combo.multiplier).toBe(4);
    expect(simulation.state.score).toBe(400);
  });
});

describe("Horde Run wave and upgrade progression", () => {
  it("offers three unique deterministic choices after clearing a wave", () => {
    const first = freshSimulation(7788);
    const second = freshSimulation(7788);
    const firstEvents = clearCurrentWave(first);
    clearCurrentWave(second);

    expect(first.state.phase).toBe("upgrade");
    expect(first.state.upgradeChoices).toHaveLength(3);
    expect(new Set(first.state.upgradeChoices).size).toBe(3);
    expect(first.state.upgradeChoices).toEqual(second.state.upgradeChoices);
    expect(first.state.upgradeChoices.every((choice) => HORDE_UPGRADES[choice] !== undefined)).toBe(
      true,
    );
    expect(firstEvents).toContainEqual(
      expect.objectContaining({ type: "wave-cleared", wave: 1 }),
    );
    expect(firstEvents).toContainEqual(
      expect.objectContaining({
        type: "upgrade-offered",
        wave: 1,
        choices: first.state.upgradeChoices,
      }),
    );
  });

  it("applies a selected real upgrade, advances the wave, and spawns its full roster", () => {
    const simulation = freshSimulation(8822);
    clearCurrentWave(simulation);
    const selected = simulation.state.upgradeChoices[1];
    expect(selected).toBeDefined();
    simulation.step(frame({ upgradeChoice: 1 }));
    const events = simulation.consumeEvents();

    expect(simulation.state.phase).toBe("combat");
    expect(simulation.state.wave).toBe(2);
    expect(simulation.state.enemies).toHaveLength(HORDE_WAVES[1]?.length ?? 0);
    expect(simulation.state.appliedUpgrades).toEqual([selected]);
    expect(simulation.state.upgradeChoices).toEqual([]);
    expect(events).toContainEqual(
      expect.objectContaining({ type: "upgrade-selected", upgrade: selected, choiceIndex: 1 }),
    );
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "wave-started",
        wave: 2,
        enemyCount: HORDE_WAVES[1]?.length,
      }),
    );
  });

  it("recenters the player before the next wave begins", () => {
    const simulation = freshSimulation(8823);
    const initialPosition = { ...simulation.state.initialPlayerPosition };
    clearCurrentWave(simulation);
    simulation.state.player.position = { x: 3.4, z: 2.7 };
    simulation.state.player.velocity = { x: 4, z: -2 };
    simulation.state.player.yaw = 1.4;
    simulation.state.player.lockedTargetId = 99;

    simulation.step(frame({ upgradeChoice: 0 }));

    expect(simulation.state.player).toMatchObject({
      position: initialPosition,
      velocity: { x: 0, z: 0 },
      yaw: 0,
      lockedTargetId: null,
    });
  });

  const upgradeCases: readonly {
    upgrade: HordeUpgradeId;
    read: (simulation: HordeSimulation) => number;
    expected: number;
  }[] = [
    {
      upgrade: "tempered-edge",
      read: (simulation) => simulation.state.player.stats.damageMultiplier,
      expected: 1.2,
    },
    {
      upgrade: "vitality-surge",
      read: (simulation) => simulation.state.player.maxHealth,
      expected: 130,
    },
    {
      upgrade: "deep-reserves",
      read: (simulation) => simulation.state.player.maxStamina,
      expected: 125,
    },
    {
      upgrade: "wind-runner",
      read: (simulation) => simulation.state.player.stats.movementMultiplier,
      expected: 1.15,
    },
    {
      upgrade: "second-wind",
      read: (simulation) => simulation.state.player.stats.staminaRegenMultiplier,
      expected: 1.35,
    },
    {
      upgrade: "combo-keeper",
      read: (simulation) => simulation.state.combo.durationTicks,
      expected: HORDE_COMBO_BASE_DURATION_TICKS + 90,
    },
    {
      upgrade: "executioner",
      read: (simulation) => simulation.state.player.stats.executionDamageMultiplier,
      expected: 1.5,
    },
    {
      upgrade: "soul-magnet",
      read: (simulation) => simulation.state.player.stats.essenceMultiplier,
      expected: 1.3,
    },
    {
      upgrade: "battle-trance",
      read: (simulation) => simulation.state.player.stats.healOnKill,
      expected: 6,
    },
  ];

  it.each(upgradeCases)("applies the $upgrade stat effect", ({ upgrade, read, expected }) => {
    const simulation = freshSimulation();
    simulation.state.phase = "upgrade";
    simulation.state.upgradeChoices = [upgrade, "tempered-edge", "vitality-surge"];
    simulation.step(frame({ upgradeChoice: 0 }));

    expect(read(simulation)).toBeCloseTo(expected, 10);
    expect(simulation.state.appliedUpgrades).toContain(upgrade);
  });

  it("increases enemy durability each wave", () => {
    const simulation = freshSimulation();
    clearCurrentWave(simulation);
    simulation.step(frame({ upgradeChoice: 0 }));
    const waveTwoShambler = simulation.state.enemies.find(
      (enemy) => enemy.archetype === "shambler",
    );

    expect(waveTwoShambler?.spawnWave).toBe(2);
    expect(waveTwoShambler?.maxHealth).toBe(Math.round(72 * 1.12));
  });

  it("reaches victory only after all five authored waves", () => {
    const simulation = freshSimulation(9988);
    for (let wave = 1; wave <= 5; wave += 1) {
      expect(simulation.state.wave).toBe(wave);
      expect(simulation.state.enemies).toHaveLength(HORDE_WAVES[wave - 1]?.length ?? 0);
      clearCurrentWave(simulation);
      if (wave < 5) {
        expect(simulation.state.phase).toBe("upgrade");
        simulation.step(frame({ upgradeChoice: 0 }));
        simulation.consumeEvents();
      }
    }

    expect(simulation.state.phase).toBe("victory");
    expect(simulation.state.player.motion).toBe("victory");
    expect(simulation.state.appliedUpgrades).toHaveLength(4);
  });

  it("restarts a terminal run from the same seed with a clean score and roster", () => {
    const simulation = freshSimulation(424_242);
    const initialRoster = simulation.state.enemies.map((enemy) => ({
      archetype: enemy.archetype,
      position: { ...enemy.position },
    }));
    simulation.state.phase = "defeat";
    simulation.state.player.health = 0;
    simulation.state.player.motion = "dead";
    simulation.state.score = 9999;
    simulation.state.kills = 22;
    simulation.state.essence = 123;

    simulation.step({ ...EMPTY_HORDE_INPUT, restartPressed: true });
    const events = simulation.consumeEvents();

    expect(simulation.state).toMatchObject({
      tick: 0,
      phase: "combat",
      wave: 1,
      score: 0,
      kills: 0,
      essence: 0,
    });
    expect(simulation.state.player).toMatchObject({ health: 100, stamina: 100, motion: "idle" });
    expect(
      simulation.state.enemies.map((enemy) => ({
        archetype: enemy.archetype,
        position: enemy.position,
      })),
    ).toEqual(initialRoster);
    expect(events.map((event) => event.type)).toEqual(["wave-started", "run-restarted"]);
  });
});
