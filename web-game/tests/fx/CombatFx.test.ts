import { describe, expect, it } from "vitest";
import * as THREE from "three";
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
import { sampleBladeTrailFx } from "../../src/render/objects/CharacterViews";
import { CombatFx } from "../../src/render/objects/CombatFx";

const SAMPLE_TICKS = new Set([29, 34, 41]);

function runFxTape(): Array<{ tick: number; bytes: string }> {
  const simulation = new GameSimulation(
    createInitialWorld({
      playerPosition: { x: 0, z: 2.6 },
      enemyPosition: { x: 0, z: 0 },
    }),
    P30_REVIEW_TUNING,
  );
  const fx = new CombatFx();
  const samples: Array<{ tick: number; bytes: string }> = [];

  for (let tick = 0; tick < 41; tick += 1) {
    const input: InputFrame = {
      ...EMPTY_INPUT,
      moveZ: tick <= 19 ? -1 : 0,
      attackPressed: tick === 24,
    };
    simulation.step(input, FIXED_TIMESTEP);
    for (const event of simulation.consumeEvents()) {
      if (event.type !== "enemy-hit") continue;
      const { player, enemy } = simulation.state;
      const dx = enemy.position.x - player.position.x;
      const dz = enemy.position.z - player.position.z;
      const length = Math.hypot(dx, dz);
      fx.burst(
        enemy.position.x,
        1.34,
        enemy.position.z,
        length > 0.0001 ? dx / length : 0,
        length > 0.0001 ? dz / length : -1,
        event.attackSerial,
        event.remainingHealth <= 0,
      );
    }

    // The review harness updates once for the fixed frame and once for its
    // deterministic render. The FX contract deliberately remains stable under
    // that established capture cadence.
    fx.update(FIXED_TIMESTEP, simulation.state.elapsed);
    fx.update(FIXED_TIMESTEP, simulation.state.elapsed);
    const processedTicks = tick + 1;
    if (SAMPLE_TICKS.has(processedTicks)) {
      samples.push({
        tick: processedTicks,
        bytes: JSON.stringify({
          blade: sampleBladeTrailFx(
            simulation.state.player.attackPhase,
            simulation.state.player.attackElapsed,
          ),
          contact: fx.getTelemetry(),
        }),
      });
    }
  }

  fx.dispose();
  return samples;
}

describe("Round008 authored combat FX contract", () => {
  it("is byte-identical across three clean replays at ticks 29, 34, and 41", () => {
    const runs = [runFxTape(), runFxTape(), runFxTape()];
    expect(runs.map((run) => run.map((sample) => sample.tick))).toEqual([
      [29, 34, 41],
      [29, 34, 41],
      [29, 34, 41],
    ]);
    for (const tick of SAMPLE_TICKS) {
      const bytes = runs.map(
        (run) => run.find((sample) => sample.tick === tick)?.bytes,
      );
      expect(bytes.every((value) => value === bytes[0])).toBe(true);
    }
  });

  it("is absent at S03, peaks at S04, and is dissipated by S05", () => {
    const samples = Object.fromEntries(
      runFxTape().map((sample) => [sample.tick, JSON.parse(sample.bytes)]),
    );
    expect(samples[29]).toMatchObject({
      blade: { phase: "absent", active: false, intensity: 0 },
      contact: { phase: "absent", active: false, lastBurstSerial: 0 },
    });
    expect(samples[34]).toMatchObject({
      blade: { phase: "peak", active: true },
      contact: {
        phase: "peak",
        active: true,
        lastBurstSerial: 1,
        flash: { active: true },
        streaks: { active: true, totalCount: 22, taperedCrossFins: true },
        materialContract: { additive: true, depthWrite: false, textures: 0 },
      },
    });
    expect(samples[34].contact.streaks.activeCount).toBeGreaterThan(0);
    expect(samples[41]).toMatchObject({
      blade: { phase: "absent", active: false, intensity: 0 },
      contact: {
        phase: "dissipated",
        active: false,
        flash: { active: false },
        streaks: { active: false, activeCount: 0 },
      },
    });
  });

  it("centers the S04 contact stack within 24 px of the frozen marker", () => {
    const sample = runFxTape().find((entry) => entry.tick === 34);
    const contact = JSON.parse(sample!.bytes).contact;
    const camera = new THREE.PerspectiveCamera();
    camera.position.fromArray([
      1.0980112021150472,
      2.5790077160988334,
      5.793545429842038,
    ]);
    camera.quaternion.fromArray([
      -0.0993567521706685,
      0.10627001663163128,
      0.010672807574153733,
      0.9893032955275619,
    ]);
    camera.projectionMatrix.fromArray([
      1.206285142786627, 0, 0, 0,
      0, 2.1445069205095586, 0, 0,
      0, 0, -1.00133422281521, -1,
      0, 0, -0.1601067378252168, 0,
    ]);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    camera.updateMatrixWorld(true);
    const projected = new THREE.Vector3(...contact.contactWorld).project(camera);
    const contactPixels = {
      x: (projected.x + 1) * 800,
      y: (1 - projected.y) * 450,
    };
    const frozenMarkerPixels = { x: 957.9162357168238, y: 513.339840973781 };
    const error = Math.hypot(
      contactPixels.x - frozenMarkerPixels.x,
      contactPixels.y - frozenMarkerPixels.y,
    );
    expect(error).toBeLessThanOrEqual(24);
  });

  it("uses fine procedural tapered meshes with no texture or opaque writer", () => {
    const fx = new CombatFx();
    fx.burst(0, 1.34, 0, 0, -1, 1, false);
    const meshNames: string[] = [];
    fx.root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      meshNames.push(object.name);
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      for (const material of materials) {
        expect(material.transparent).toBe(true);
        expect(material.depthWrite).toBe(false);
        expect(material.blending).toBe(THREE.AdditiveBlending);
      }
    });
    expect(meshNames).toEqual([
      "fx.directional-tapered-streaks",
      "fx.contact-local-flash",
      "fx.contact-hot-core",
    ]);
    expect(fx.root.getObjectByProperty("type", "Points")).toBeUndefined();
    expect(fx.getTelemetry().materialContract.textures).toBe(0);
    fx.dispose();
  });

  it("preserves the exact legacy contact stack when no Horde style is supplied", () => {
    for (const defeated of [false, true]) {
      const fx = new CombatFx();
      fx.burst(0, 1.34, 0, 0, -1, 5, defeated);
      const streaks = fx.root.getObjectByName(
        "fx.directional-tapered-streaks",
      ) as THREE.InstancedMesh;
      const flash = fx.root.getObjectByName("fx.contact-local-flash") as THREE.Mesh;
      const core = fx.root.getObjectByName("fx.contact-hot-core") as THREE.Mesh;
      const light = fx.root.children.find(
        (child): child is THREE.PointLight => child instanceof THREE.PointLight,
      )!;
      const streakMaterial = streaks.material as THREE.MeshBasicMaterial;
      const flashMaterial = flash.material as THREE.MeshBasicMaterial;
      const coreMaterial = core.material as THREE.MeshBasicMaterial;

      expect(fx.getTelemetry()).toMatchObject({
        flash: {
          opacity: 0.82,
          scale: defeated ? 0.23 : 0.19,
        },
        streaks: { opacity: 0.78 },
      });
      expect(streakMaterial.color.getHex()).toBe(0xffffff);
      expect(flashMaterial.color.getHex()).toBe(defeated ? 0xffd78c : 0xffa657);
      expect(coreMaterial.color.getHex()).toBe(defeated ? 0xffffe6 : 0xfff0c2);
      expect(light.color.getHex()).toBe(defeated ? 0xffb968 : 0xff8742);
      expect(coreMaterial.opacity).toBe(1);
      expect(core.scale.x).toBe(defeated ? 0.072 : 0.058);
      expect(light.intensity).toBe(defeated ? 2 : 1);
      expect(streakMaterial.toneMapped).toBe(false);
      expect(flashMaterial.toneMapped).toBe(false);
      expect(coreMaterial.toneMapped).toBe(false);

      const instanceColor = new THREE.Color();
      streaks.getColorAt(0, instanceColor);
      expect(instanceColor.getHex()).toBe(0xffdf9a);
      streaks.getColorAt(1, instanceColor);
      expect(instanceColor.getHex()).toBe(0xff9443);
      streaks.getColorAt(15, instanceColor);
      expect(instanceColor.getHex()).toBe(0xff5932);

      const dt = 0.01;
      fx.update(dt, dt);
      const life01 = 1 - dt / (defeated ? 0.15 : 0.125);
      expect(flashMaterial.opacity).toBeCloseTo(0.82 * Math.pow(life01, 0.68), 10);
      expect(coreMaterial.opacity).toBeCloseTo(Math.min(1, life01 * 1.65), 10);
      expect(flash.scale.x).toBeCloseTo(
        (defeated ? 0.23 : 0.19) + (1 - life01) * 0.08,
        10,
      );
      expect(core.scale.x).toBeCloseTo(
        (defeated ? 0.072 : 0.058) * (0.72 + life01 * 0.28),
        10,
      );
      expect(light.intensity).toBeCloseTo((defeated ? 2 : 1) * life01 * life01, 10);
      fx.dispose();
    }
  });

  it("retains each styled normal, special, and defeat streak peak", () => {
    const cases = [
      { defeated: false, special: false, expected: 0.46 },
      { defeated: false, special: true, expected: 0.46 * 1.12 },
      { defeated: true, special: false, expected: 0.58 },
      { defeated: true, special: true, expected: 0.58 * 1.12 },
    ] as const;

    for (const sample of cases) {
      const fx = new CombatFx();
      fx.burst(0, 1.34, 0, 0, -1, 8, sample.defeated, {
        weapon: "greatsword",
        special: sample.special,
      });
      expect(fx.getTelemetry().streaks.opacity).toBeCloseTo(sample.expected, 6);
      fx.update(0.001, 0.001);
      expect(fx.getTelemetry().streaks.opacity).toBeCloseTo(sample.expected, 6);
      fx.dispose();
    }
  });

  it("uses saturated weapon palettes without a white contact blowout", () => {
    const fx = new CombatFx();
    fx.burst(0, 1.34, 0, 0, -1, 3, false, {
      weapon: "katana",
      special: true,
    });
    const flash = fx.root.getObjectByName("fx.contact-local-flash") as THREE.Mesh;
    const core = fx.root.getObjectByName("fx.contact-hot-core") as THREE.Mesh;
    const flashMaterial = flash.material as THREE.MeshBasicMaterial;
    const coreMaterial = core.material as THREE.MeshBasicMaterial;
    expect(flashMaterial.color.getHex()).toBe(0x2385a8);
    expect(coreMaterial.color.getHex()).toBe(0x8ce9ff);
    expect(flashMaterial.color.getHex()).not.toBe(0xffffff);
    expect(coreMaterial.opacity).toBeLessThan(0.8);
    expect(flash.scale.x).toBeLessThan(0.2);
    expect(flashMaterial.toneMapped).toBe(true);
    expect(coreMaterial.toneMapped).toBe(true);
    fx.dispose();
  });
});
