import { expect, test } from "@playwright/test";

test("Round010 contact stays exterior and recovery preserves grounded swing momentum", async ({
  page,
}) => {
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
    for (const ticks of [29, 34, 41]) {
      review.reset({ piece: "P30", preset: "pose-browser", seed: 30001 });
      review.queue(actions);
      review.stepTicks(ticks);
      review.renderOnce();
      const before = JSON.stringify(window.__COW_COMBAT_POSE__?.telemetry());
      review.renderOnce();
      const after = JSON.stringify(window.__COW_COMBAT_POSE__?.telemetry());
      samples.push({
        ticks,
        pose: JSON.parse(after),
        fx: window.__COW_COMBAT_FX__?.telemetry() ?? null,
        framing: review.telemetry().framing,
        renderIdempotent: before === after,
      });
    }
    return samples;
  });

  expect(result.map(({ ticks }) => ticks)).toEqual([29, 34, 41]);
  expect(result.every(({ renderIdempotent }) => renderIdempotent)).toBe(true);
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
    expect(Object.values(pose.hero.gripBindings).every(Boolean)).toBe(true);
    expect(Object.values(pose.target.rigBindings).every(Boolean)).toBe(true);
    expect(Object.values(pose.target.limbBindings).every(Boolean)).toBe(true);
    expect(pose.hero.weaponParent).toBe("weapon_socket");
    expect(pose.hero.supportHandToSecondaryGripMeters).toBeLessThanOrEqual(0.00001);
  }
  const startup = result[0]!;
  const impact = result[1]!;
  const recovery = result[2]!;
  const impactBlade = impact.pose.hero.anchors.bladeContactWorld;
  const impactTip = impact.pose.hero.anchors.bladeTipWorld;
  const recoveryBlade = recovery.pose.hero.anchors.bladeContactWorld;
  const impactTarget = impact.pose.target.anchors.impactWorld;
  const recoveryTarget = recovery.pose.target.anchors.impactWorld;
  const impactFx = impact.fx!.contactWorld;

  expect(impact.pose.hero.weaponAxialRollRadians).toBeGreaterThan(3.3);
  expect(impact.pose.hero.sample.grip.weaponMountRotation[2]).toBe(-0.012);
  expect(Math.hypot(
    impactBlade[0] - impactFx[0],
    impactBlade[1] - impactFx[1],
    impactBlade[2] - impactFx[2],
  )).toBeLessThan(0.27);
  expect(impactTarget[0] - impactTip[0]).toBeGreaterThan(0.45);
  expect(impact.pose.target.sample.model.position[0]).toBeLessThanOrEqual(-0.71);
  expect(impact.pose.contact.measurement).toMatchObject({
    closestFeature: "blade-end",
    exteriorContactPoints: 1,
    penetrationMeters: 0,
  });
  expect(Math.abs(impact.pose.contact.measurement.separationMeters)).toBeLessThanOrEqual(0.001);

  expect(impactBlade[0] - startup.pose.hero.anchors.bladeContactWorld[0]).toBeGreaterThan(2.4);
  expect(recoveryBlade[0] - impactBlade[0]).toBeGreaterThan(0.4);
  expect(recoveryBlade[1]).toBeLessThan(1.2);
  expect(recovery.pose.hero.authoredTiming).toMatchObject({
    mode: "contact-to-settle-blend",
    blend01: 0.291212,
  });
  expect(recoveryTarget[0] - impactTarget[0]).toBeGreaterThan(0.4);

  const leadFoot = recovery.pose.hero.anchors.leadFootWorld;
  const supportFoot = recovery.pose.hero.anchors.supportFootWorld;
  expect(Math.abs(leadFoot[0] - supportFoot[0])).toBeGreaterThan(0.8);
  expect(leadFoot[1]).toBeLessThan(0.11);
  expect(supportFoot[1]).toBeLessThan(0.06);
  const recoveryFraming = recovery.framing;
  expect(recoveryFraming).not.toBeNull();
  expect(recoveryFraming?.player?.insideSafeFrame).toBe(true);
  expect(recoveryFraming?.blade?.insideSafeFrame).toBe(true);

  const adjacent = await page.evaluate(() => {
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
    return [33, 34, 35].map((ticks) => {
      review.reset({ piece: "P30", preset: "contact-adjacent", seed: 30001 });
      review.queue(actions);
      review.stepTicks(ticks);
      review.renderOnce();
      return {
        ticks,
        measurement: window.__COW_COMBAT_POSE__?.telemetry().contact.measurement,
      };
    });
  });
  expect(adjacent.map(({ measurement }) => measurement?.exteriorContactPoints)).toEqual([
    0,
    1,
    0,
  ]);
  expect(adjacent[0]?.measurement?.separationMeters).toBeGreaterThan(0.1);
  expect(adjacent[2]?.measurement?.separationMeters).toBeGreaterThan(0.05);
  expect(adjacent.every(({ measurement }) => measurement?.penetrationMeters === 0)).toBe(true);
});
