import { expect, test } from "@playwright/test";
import * as THREE from "three";

const WIDTH = 1600;
const HEIGHT = 900;

function projectWorld(
  world: readonly [number, number, number],
  telemetry: {
    position: [number, number, number];
    quaternion: [number, number, number, number];
    projectionMatrix: number[];
  },
): THREE.Vector2 {
  const camera = new THREE.PerspectiveCamera();
  camera.position.fromArray(telemetry.position);
  camera.quaternion.fromArray(telemetry.quaternion);
  camera.projectionMatrix.fromArray(telemetry.projectionMatrix);
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  camera.updateMatrixWorld(true);
  const projected = new THREE.Vector3(...world).project(camera);
  return new THREE.Vector2(
    (projected.x + 1) * WIDTH * 0.5,
    (1 - projected.y) * HEIGHT * 0.5,
  );
}

test("Round010 contact plane and braking arc remain causal and render-idempotent", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("/?review=1&post=0&framing=1");
  await page.evaluate(async () => window.__COW_REVIEW__.ready);

  const result = await page.evaluate(() => {
    const review = window.__COW_REVIEW__;
    const actions = [
      ...Array.from({ length: 20 }, (_, tick) => ({
        tick,
        action: "move.forward",
        phase: "value" as const,
        value: 1,
      })),
      { tick: 24, action: "attack.primary", phase: "down" as const },
      { tick: 25, action: "attack.primary", phase: "up" as const },
    ];
    const samples = [];
    review.reset({ piece: "P30", preset: "pose-browser", seed: 30001 });
    review.queue(actions);
    let processedTicks = 0;
    for (const ticks of [29, 34, 41]) {
      review.stepTicks(ticks - processedTicks);
      processedTicks = ticks;
      review.renderOnce();
      const before = JSON.stringify(window.__COW_COMBAT_POSE__?.telemetry());
      if (ticks !== 29) review.renderOnce();
      const after = JSON.stringify(window.__COW_COMBAT_POSE__?.telemetry());
      samples.push({
        ticks,
        pose: JSON.parse(after),
        bladeFx: window.__COW_BLADE_FX__?.telemetry(),
        contactFx: window.__COW_COMBAT_FX__?.telemetry(),
        camera: review.telemetry().camera,
        renderIdempotent: ticks === 29 ? null : before === after,
      });
    }
    return samples;
  });

  expect(result.map(({ ticks }) => ticks)).toEqual([29, 34, 41]);
  expect(
    result
      .filter(({ ticks }) => ticks !== 29)
      .every(({ renderIdempotent }) => renderIdempotent),
  ).toBe(true);
  expect(result.map(({ pose }) => pose.hero.sample.phase)).toEqual([
    "anticipation",
    "contact",
    "recoil",
  ]);
  expect(result.map(({ pose }) => pose.target.sample.phase)).toEqual([
    "neutral",
    "compression",
    "recoil",
  ]);

  for (const { pose } of result) {
    expect(Object.values(pose.hero.rigBindings).every(Boolean)).toBe(true);
    expect(Object.values(pose.target.rigBindings).every(Boolean)).toBe(true);
    expect(pose.hero.weaponParent).toBe("weapon_socket");
    expect(pose.hero.supportHandToSecondaryGripMeters).toBeLessThanOrEqual(0.00001);
  }
  const startup = result[0]!;
  const impact = result[1]!;
  const recovery = result[2]!;
  if (!impact.contactFx || !impact.bladeFx || !recovery.bladeFx) {
    throw new Error("Round010 combat telemetry hooks are unavailable");
  }
  const impactBlade = new THREE.Vector3(...impact.pose.hero.anchors.bladeContactWorld);
  const impactTarget = new THREE.Vector3(...impact.pose.target.anchors.impactWorld);
  const impactFx = new THREE.Vector3(...impact.contactFx.contactWorld);

  expect(impact.pose.hero.sample.presentation).toMatchObject({
    weaponAxialRoll: -0.43,
    sameDirection01: 0.56,
  });
  expect(impactBlade.distanceTo(impactFx)).toBeLessThanOrEqual(0.065);
  expect(impactBlade.z - impactTarget.z).toBeGreaterThan(0.3);
  expect(impact.bladeFx.active).toBe(true);

  const cameraToContact = new THREE.Vector3(...impact.camera.position)
    .sub(impactBlade)
    .normalize();
  const bladeFaceNormal = new THREE.Vector3(
    ...impact.pose.hero.anchors.bladeFaceNormalWorld,
  );
  expect(Math.abs(cameraToContact.dot(bladeFaceNormal))).toBeLessThan(0.25);

  const startupContact = projectWorld(
    startup.pose.hero.anchors.bladeContactWorld,
    startup.camera,
  );
  const impactContact = projectWorld(
    impact.pose.hero.anchors.bladeContactWorld,
    impact.camera,
  );
  const recoveryContact = projectWorld(
    recovery.pose.hero.anchors.bladeContactWorld,
    recovery.camera,
  );
  const approach = impactContact.clone().sub(startupContact);
  const overshoot = recoveryContact.clone().sub(impactContact);
  expect(overshoot.length()).toBeGreaterThan(75);
  expect(approach.dot(overshoot) / (approach.length() * overshoot.length())).toBeGreaterThan(0.7);

  const targetRecoil = projectWorld(
    recovery.pose.target.anchors.impactWorld,
    recovery.camera,
  ).sub(projectWorld(impact.pose.target.anchors.impactWorld, impact.camera));
  expect(targetRecoil.dot(overshoot)).toBeGreaterThan(0);
  expect(recovery.pose.hero.sample.presentation).toMatchObject({
    authoredAnimationSeconds: 0.2,
    sameDirection01: 1,
  });
  expect(recovery.pose.hero.anchors.bladeTipWorld[1]).toBeLessThan(
    recovery.pose.target.anchors.headWorld[1] - 0.2,
  );
  expect(recovery.bladeFx.active).toBe(false);

  for (const foot of ["leftFootWorld", "rightFootWorld"] as const) {
    const atImpact = new THREE.Vector3(...impact.pose.hero.anchors[foot]);
    const atRecovery = new THREE.Vector3(...recovery.pose.hero.anchors[foot]);
    expect(Math.abs(atRecovery.y - atImpact.y)).toBeLessThan(0.025);
    atRecovery.y = atImpact.y;
    expect(atRecovery.distanceTo(atImpact)).toBeLessThan(0.12);
  }
});
