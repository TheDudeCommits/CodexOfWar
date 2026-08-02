import { describe, expect, it } from "vitest";
import {
  FIXED_TIMESTEP,
  P30_REVIEW_TUNING,
} from "../../src/game/simulation/constants";
import {
  createInitialWorld,
  EMPTY_INPUT,
  GameSimulation,
} from "../../src/game/simulation/GameSimulation";
import type { InputFrame } from "../../src/game/simulation/types";
import {
  sampleHeroCombatPose,
  sampleTargetCombatPose,
} from "../../src/render/objects/CombatPoseBeat";

const FOCUSED_TICKS = new Set([29, 34, 41]);

function runPoseTape(): Array<{ tick: number; bytes: string }> {
  const simulation = new GameSimulation(
    createInitialWorld({
      playerPosition: { x: 0, z: 2.6 },
      enemyPosition: { x: 0, z: 0 },
    }),
    P30_REVIEW_TUNING,
  );
  const samples: Array<{ tick: number; bytes: string }> = [];

  for (let tick = 0; tick < 41; tick += 1) {
    const input: InputFrame = {
      ...EMPTY_INPUT,
      moveZ: tick <= 19 ? -1 : 0,
      attackPressed: tick === 24,
    };
    simulation.step(input, FIXED_TIMESTEP);
    simulation.consumeEvents();
    const processedTicks = tick + 1;
    if (FOCUSED_TICKS.has(processedTicks)) {
      samples.push({
        tick: processedTicks,
        bytes: JSON.stringify({
          hero: sampleHeroCombatPose(
            simulation.state.player.attackPhase,
            simulation.state.player.attackFrame,
          ),
          target: sampleTargetCombatPose(
            simulation.state.enemy.motion,
            simulation.state.enemy.hitStunRemaining,
          ),
        }),
      });
    }
  }
  return samples;
}

describe("Round009 deterministic sword-contact pose beat", () => {
  it("resolves the frozen ticks to anticipation, contact, and recoil", () => {
    const samples = Object.fromEntries(
      runPoseTape().map(({ tick, bytes }) => [tick, JSON.parse(bytes)]),
    );
    expect(samples[29]).toMatchObject({
      hero: { phase: "anticipation", attackFrame: 5 },
      target: { phase: "neutral" },
    });
    expect(samples[34]).toMatchObject({
      hero: { phase: "contact", attackFrame: 10 },
      target: { phase: "compression", reaction01: 0 },
    });
    expect(samples[41]).toMatchObject({
      hero: { phase: "recoil", attackFrame: 17 },
      target: { phase: "recoil", reaction01: 0.416667 },
    });
  });

  it("carries force through an opposed coil, strike, and weighted reset", () => {
    const coil = sampleHeroCombatPose("startup", 5);
    const contact = sampleHeroCombatPose("active", 10);
    const recoil = sampleHeroCombatPose("recovery", 17);
    const targetContact = sampleTargetCombatPose("hit", 0.28);
    const targetRecoil = sampleTargetCombatPose("hit", 0.28 - 7 / 60);

    expect(coil.model.position[1]).toBeLessThan(-0.05);
    expect(coil.model.rotation[1]).toBeGreaterThan(0.06);
    expect(contact.model.rotation[1]).toBe(0);
    expect(contact.model.position[2]).toBe(0);
    expect(recoil.model.position[0]).toBeLessThan(-0.02);
    expect(recoil.model.position[2]).toBe(0);
    expect(targetContact.model.position[2]).toBeGreaterThan(0);
    expect(targetRecoil.model.position[2]).toBeGreaterThanOrEqual(0.09);
    expect(targetRecoil.bones.torso[0]).toBeLessThan(-0.08);
  });

  it("returns an exact neutral additive layer outside the hit beat", () => {
    expect(sampleHeroCombatPose("idle", -1)).toMatchObject({
      phase: "neutral",
      model: { position: [0, 0, 0], rotation: [0, 0, 0] },
    });
    expect(sampleTargetCombatPose("idle", 0)).toMatchObject({
      phase: "neutral",
      animationLeadSeconds: 0,
      model: { position: [0, 0, 0], rotation: [0, 0, 0] },
    });
  });

  it("is byte-identical across clean deterministic replays", () => {
    const first = runPoseTape();
    expect(runPoseTape()).toEqual(first);
    expect(runPoseTape()).toEqual(first);
  });
});
