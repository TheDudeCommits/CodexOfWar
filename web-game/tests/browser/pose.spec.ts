import { expect, test } from "@playwright/test";

test("Round009 pose beat binds to the authored rigs and remains render-idempotent", async ({
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
      samples.push({ ticks, pose: JSON.parse(after), renderIdempotent: before === after });
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
    expect(Object.values(pose.target.rigBindings).every(Boolean)).toBe(true);
    expect(pose.hero.weaponParent).toBe("weapon_socket");
    expect(pose.hero.supportHandToSecondaryGripMeters).toBeLessThanOrEqual(0.00001);
  }
  expect(result[1]!.pose.contact.bladeToTargetMeters).toBeLessThanOrEqual(0.3);
});
