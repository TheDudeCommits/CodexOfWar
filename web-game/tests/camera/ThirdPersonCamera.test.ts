import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { ThirdPersonCamera } from "../../src/render/app/ThirdPersonCamera";

const DT = 1 / 60;
const SAMPLE_TICKS = new Set([29, 34, 41, 60]);

function runReplay(camera: ThirdPersonCamera): string[] {
  camera.reset();
  const samples: string[] = [];
  for (let processedTicks = 1; processedTicks <= 60; processedTicks += 1) {
    const playerZ = processedTicks <= 20 ? 2.6 - processedTicks * 0.05 : 1.6;
    if (processedTicks === 34) camera.kickShake(1);
    camera.update(DT, { x: 0, z: playerZ }, { x: 0, z: 0 }, 0, 0);
    if (SAMPLE_TICKS.has(processedTicks)) samples.push(JSON.stringify(camera.getTelemetry()));
  }
  return samples;
}

describe("ThirdPersonCamera", () => {
  it("produces byte-identical telemetry at ticks 29, 34, 41, and 60 across clean replays", () => {
    const camera = new ThirdPersonCamera();
    const first = runReplay(camera);
    const second = runReplay(camera);
    const third = runReplay(camera);

    expect(first).toHaveLength(4);
    expect(second).toEqual(first);
    expect(third).toEqual(first);
  });

  it("reset clears shake and every smoothing accumulator", () => {
    const disturbed = new ThirdPersonCamera();
    disturbed.update(DT, { x: 2.1, z: 5.4 }, { x: -1.2, z: -2.6 }, 0, 0);
    disturbed.kickShake(1.55);
    disturbed.update(DT, { x: 2.1, z: 5.4 }, { x: -1.2, z: -2.6 }, 0, 0);
    disturbed.reset();
    const resetReplay = runReplay(disturbed);

    const fresh = new ThirdPersonCamera();
    const freshReplay = runReplay(fresh);
    expect(resetReplay).toEqual(freshReplay);
  });

  it("resolves an actual wall mesh on the boom with 0.45 m clearance", () => {
    const camera = new ThirdPersonCamera();
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(10, 10, 0.2),
      new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
    );
    wall.position.set(0, 2, 3);
    wall.updateMatrixWorld(true);
    camera.setObstructionObjects([wall]);
    camera.reset();
    camera.update(DT, { x: 0, z: 1.6 }, { x: 0, z: 0 }, 0, 0, true);

    const boom = camera.getTelemetry().boom;
    expect(boom.status).toBe("obstructed");
    expect(boom.collisionApplied).toBe(true);
    expect(boom.resolvedDistance).toBeLessThan(boom.desiredDistance);
    expect(boom.clearance).not.toBeNull();
    expect(boom.clearance!).toBeGreaterThanOrEqual(0.45 - 1e-12);
  });

  it("keeps resolved and desired boom distances exactly equal when clear", () => {
    const camera = new ThirdPersonCamera();
    camera.setObstructionObjects([]);
    camera.reset();
    camera.update(DT, { x: 0, z: 1.6 }, { x: 0, z: 0 }, 0, 0, true);

    const boom = camera.getTelemetry().boom;
    expect(boom.status).toBe("clear");
    expect(boom.collisionApplied).toBe(false);
    expect(boom.resolvedDistance).toBe(boom.desiredDistance);
  });

  it("widens deterministically as actor separation increases", () => {
    const near = new ThirdPersonCamera();
    near.update(DT, { x: 0, z: 1.6 }, { x: 0, z: 0 }, 0, 0, true);
    const nearBoom = near.getTelemetry().boom.desiredDistance;

    const far = new ThirdPersonCamera();
    far.update(DT, { x: 0, z: 6 }, { x: 0, z: 0 }, 0, 0, true);
    const farBoom = far.getTelemetry().boom.desiredDistance;

    expect(nearBoom).toBeGreaterThanOrEqual(5.18);
    expect(farBoom).toBeGreaterThan(nearBoom);
    expect(farBoom).toBeLessThanOrEqual(6.45 + 1e-12);
  });
});
