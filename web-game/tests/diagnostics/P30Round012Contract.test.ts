import { describe, expect, it } from "vitest";
import interfaceText from "../../CRITIC_INTERFACE.json?raw";
import { isValidP30ResetPauseState } from "../../src/diagnostics/P30CriticHarness";
import {
  assertP30ResetOptions,
  P30_PROTOCOL_ID,
  P30_RUNTIME_HOOK_SCHEMA,
  P30_SCENARIO_ID,
  P30_SCENARIO_SEED,
} from "../../src/diagnostics/P30CriticProtocol";
import { FIXED_TIMESTEP, P30_REVIEW_TUNING } from "../../src/game/simulation/constants";
import {
  createInitialWorld,
  EMPTY_INPUT,
  GameSimulation,
} from "../../src/game/simulation/GameSimulation";
import type { GameEvent } from "../../src/game/simulation/types";
import {
  HEAVY_BLADE_RADIUS_METERS,
  HEAVY_CONTACT_EPSILON_METERS,
  HEAVY_SWEEP_SUBSTEPS,
} from "../../src/render/objects/HeavyContactResolver";

interface HeavyTapeReceipt {
  events: GameEvent[];
  health: Map<number, number>;
  contactApplied: boolean;
  finalMotion: string;
  finalHitStun: number;
}

function runHeavyTape(
  risingEdgeAbsoluteTick: number | null,
  contactAbsoluteTick: number | null,
  terminalTick: number,
): HeavyTapeReceipt {
  const initial = createInitialWorld({
    playerPosition: { x: 0, z: 2.6 },
    enemyPosition: { x: 0, z: 0 },
  });
  initial.tick = -1;
  const simulation = new GameSimulation(initial, P30_REVIEW_TUNING);
  simulation.reset(initial, P30_REVIEW_TUNING, 1);
  const events: GameEvent[] = [];
  const health = new Map<number, number>();
  let contactApplied = false;

  for (let absoluteTick = 0; absoluteTick <= terminalTick; absoluteTick += 1) {
    simulation.step({
      ...EMPTY_INPUT,
      heavyAttackPressed: absoluteTick === risingEdgeAbsoluteTick,
    }, FIXED_TIMESTEP);
    if (absoluteTick === contactAbsoluteTick) {
      contactApplied = simulation.applyHeavyGeometryContact(absoluteTick, -0.0005);
    }
    health.set(absoluteTick, simulation.state.enemy.health);
    events.push(...simulation.consumeEvents());
  }

  return {
    events,
    health,
    contactApplied,
    finalMotion: simulation.state.enemy.motion,
    finalHitStun: simulation.state.enemy.hitStunRemaining,
  };
}

describe("identity-neutral Round012-A runtime contract", () => {
  it("publishes the strict candidate interface without constraining its opaque alias", () => {
    const candidate = JSON.parse(interfaceText) as Record<string, unknown>;
    expect(Object.keys(candidate)).toEqual([
      "schema",
      "protocolID",
      "opaqueAlias",
      "baselineReceiptSha256",
      "nodeMajor",
      "packageManager",
      "normalPlayableRoute",
      "readyPath",
      "scenarioID",
      "seed",
      "fixedDeltaNumerator",
      "fixedDeltaDenominator",
      "captureTickSpace",
      "heavyRisingEdgeAbsoluteTick",
      "heavyInputs",
      "criticHookGlobal",
      "buildOutputDirectory",
    ]);
    expect(candidate).toMatchObject({
      schema: "p30.r012a.candidate-interface.v1",
      protocolID: P30_PROTOCOL_ID,
      baselineReceiptSha256:
        "9d3a1e3d6809ff18d445d0c6b69e16342e6f72d0e39c3ebb025c9d34535f7259",
      nodeMajor: 24,
      packageManager: "npm",
      normalPlayableRoute: "/?scenario=P30-heavy-strike-v1&seed=30012",
      readyPath: "/ready.json",
      scenarioID: P30_SCENARIO_ID,
      seed: P30_SCENARIO_SEED,
      fixedDeltaNumerator: 1,
      fixedDeltaDenominator: 60,
      captureTickSpace: "absolute-scenario",
      heavyRisingEdgeAbsoluteTick: 24,
      heavyInputs: [
        { device: "mouse", button: "right", buttonNumber: 2 },
        { device: "keyboard", code: "KeyK" },
      ],
      criticHookGlobal: "__P30_CRITIC__",
      buildOutputDirectory: "dist",
    });
    expect(candidate.opaqueAlias).toMatch(/^candidate-[0-9a-f]{16}$/);
    expect(P30_RUNTIME_HOOK_SCHEMA).toBe("p30.r012a.runtime-hook.v1");
  });

  it("accepts the strict capture-paused reset lifecycle and rejects malformed offsets", () => {
    expect(isValidP30ResetPauseState(true, true)).toBe(true);
    expect(isValidP30ResetPauseState(true, false)).toBe(false);
    expect(isValidP30ResetPauseState(false, true)).toBe(false);
    expect(() => assertP30ResetOptions({
      seed: P30_SCENARIO_SEED,
      targetOffsetMicrometres: [0, 0, 0],
    })).not.toThrow();
    expect(() => assertP30ResetOptions({
      seed: P30_SCENARIO_SEED,
      targetOffsetMicrometres: [0.5, 0, 0],
    })).toThrow(/signed safe integers/);
  });

  it("locks the actual render-geometry contact constants", () => {
    expect(HEAVY_SWEEP_SUBSTEPS).toBe(4096);
    expect(HEAVY_BLADE_RADIUS_METERS).toBe(0.02);
    expect(HEAVY_CONTACT_EPSILON_METERS).toBe(0.000001);
  });

  it("routes one canonical geometry contact to the sole 100-to-75 mutation", () => {
    const receipt = runHeavyTape(24, 46, 80);
    expect(receipt.contactApplied).toBe(true);
    for (let tick = 0; tick <= 45; tick += 1) expect(receipt.health.get(tick)).toBe(100);
    for (let tick = 46; tick <= 80; tick += 1) expect(receipt.health.get(tick)).toBe(75);
    expect(receipt.events.filter(({ type }) => type === "heavy-started")).toHaveLength(1);
    expect(receipt.events.filter(({ type }) => type === "heavy-contact")).toEqual([
      expect.objectContaining({ tick: 46, heavyRelativeTick: 22, attackSerial: 1 }),
    ]);
    expect(receipt.events.filter(({ type }) => type === "heavy-damage")).toEqual([
      expect.objectContaining({
        tick: 46,
        heavyRelativeTick: 22,
        damage: 25,
        remainingHealth: 75,
        attackSerial: 1,
      }),
    ]);
    expect(receipt.finalMotion).toBe("idle");
    expect(receipt.finalHitStun).toBe(0);
  });

  it("translates the same causal branch by seven ticks and leaves miss/no-heavy pure", () => {
    const shifted = runHeavyTape(31, 53, 87);
    expect(shifted.contactApplied).toBe(true);
    expect(shifted.events.filter(({ type }) => type === "heavy-damage")).toEqual([
      expect.objectContaining({ tick: 53, heavyRelativeTick: 22, remainingHealth: 75 }),
    ]);

    const miss = runHeavyTape(24, null, 80);
    expect(miss.contactApplied).toBe(false);
    expect(miss.health.get(80)).toBe(100);
    expect(miss.events.some(({ type }) => type === "heavy-contact" || type === "heavy-damage")).toBe(false);

    const neutral = runHeavyTape(null, null, 80);
    expect(neutral.health.get(80)).toBe(100);
    expect(neutral.events).toEqual([]);
  });
});
