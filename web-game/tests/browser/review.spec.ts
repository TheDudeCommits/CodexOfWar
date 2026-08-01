import { expect, test } from "@playwright/test";

test("P30 deterministic review tape and judge capture", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("/?review=1&post=0");
  const receipt = await page.evaluate(async () => window.__COW_REVIEW__.ready);
  expect(receipt.schema).toBe("cow.review.v1");

  const result = await page.evaluate(() => {
    const review = window.__COW_REVIEW__;
    review.reset({ piece: "P30", preset: "combat-tape-a", seed: 30001 });
    const movement = Array.from({ length: 20 }, (_, tick) => ({
      tick,
      action: "move.forward",
      phase: "value" as const,
      value: 1,
    }));
    review.queue([
      ...movement,
      { tick: 24, action: "attack.primary", phase: "down" },
      { tick: 25, action: "attack.primary", phase: "up" },
      { tick: 28, action: "attack.primary", phase: "down" },
      { tick: 29, action: "attack.primary", phase: "up" },
    ]);
    review.stepTicks(60);
    return review.telemetry();
  });

  expect(result.state.player.position.z).toBeCloseTo(1.6, 4);
  expect(result.state.target.health).toBe(90);
  expect(result.events.filter((event) => event.type === "enemy_hit")).toEqual([
    expect.objectContaining({ tick: 33, damage: 10, hpBefore: 100, hpAfter: 90 }),
  ]);
  expect(result.events).toContainEqual(expect.objectContaining({ tick: 28, type: "attack_rejected_busy" }));
  expect(result.history.find((snapshot) => snapshot.tick === 24)?.player.attackPhase).toBe("startup");
  expect(result.history.find((snapshot) => snapshot.tick === 32)?.player.attackPhase).toBe("active");
  expect(result.history.find((snapshot) => snapshot.tick === 36)?.player.attackPhase).toBe("recovery");
  expect(result.history.find((snapshot) => snapshot.tick === 50)?.player.attackPhase).toBe("idle");
  expect(result.renderer.pixelRatio).toBe(1);
  expect(result.renderer.size).toEqual({ width: 1600, height: 900 });
  expect(result.renderer.errors).toEqual([]);
  expect(result.cameraObstruction.status).toBe("pending");
  expect(result.assetLoad.registry.complete).toBe(true);
  expect(result.assetLoad.registry.enabled).toHaveLength(18);
  expect(result.assetLoad.registry.loaded).toHaveLength(18);
  expect(result.assetLoad.registry.loaded).toEqual(result.assetLoad.registry.enabled);
  expect(result.assetLoad.registry.failures).toEqual([]);
  expect(result.assetLoad.productionAuthored).toBe(true);
  expect(result.assetLoad.presentation.proceduralFallbackActive).toBe(false);
  expect(result.assetLoad.environment.pmremInstalled).toBe(true);
  await expect(page.locator("canvas#game-canvas")).toBeVisible();
  await page.evaluate(() => {
    const review = window.__COW_REVIEW__;
    review.reset({ piece: "P30", preset: "combat-capture", seed: 30001 });
    review.queue([
      ...Array.from({ length: 20 }, (_, tick) => ({
        tick,
        action: "move.forward",
        phase: "value" as const,
        value: 1,
      })),
      { tick: 24, action: "attack.primary", phase: "down" },
      { tick: 25, action: "attack.primary", phase: "up" },
    ]);
    review.stepTicks(34);
    review.renderOnce();
  });
  await page.screenshot({ path: "test-results/p30-combat.png" });
});

test("out-of-range and physical input pause/blur smoke", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("/?review=1&post=0");
  await page.evaluate(async () => window.__COW_REVIEW__.ready);

  const outOfRange = await page.evaluate(() => {
    const review = window.__COW_REVIEW__;
    review.reset({ piece: "P30", preset: "combat-tape-b", seed: 30001 });
    review.queue([
      { tick: 0, action: "attack.primary", phase: "down" },
      { tick: 1, action: "attack.primary", phase: "up" },
    ]);
    review.stepTicks(60);
    return review.telemetry();
  });
  expect(outOfRange.state.target.health).toBe(100);
  expect(outOfRange.events.some((event) => event.type === "enemy_hit")).toBe(false);

  await page.evaluate(() => window.__COW_REVIEW__.reset({ piece: "P30", seed: 30001 }));
  await page.keyboard.down("KeyW");
  await page.evaluate(() => window.__COW_REVIEW__.stepTicks(20));
  await page.keyboard.up("KeyW");
  await page.evaluate(() => window.__COW_REVIEW__.stepTicks(4));
  const moved = await page.evaluate(() => window.__COW_REVIEW__.snapshot().player.position.z);
  expect(moved).toBeCloseTo(1.6, 4);

  await page.keyboard.press("Escape");
  await page.evaluate(() => window.__COW_REVIEW__.stepTicks(1));
  const pausedAt = await page.evaluate(() => window.__COW_REVIEW__.snapshot());
  expect(pausedAt.paused).toBe(true);
  expect(pausedAt.pointerLocked).toBe(false);
  await page.keyboard.down("KeyW");
  await page.evaluate(() => window.__COW_REVIEW__.stepTicks(10));
  await page.keyboard.up("KeyW");
  const whilePaused = await page.evaluate(() => window.__COW_REVIEW__.snapshot().player.position.z);
  expect(whilePaused).toBeCloseTo(pausedAt.player.position.z, 6);

  await page.keyboard.press("Escape");
  await page.evaluate(() => window.__COW_REVIEW__.stepTicks(1));
  expect(await page.evaluate(() => window.__COW_REVIEW__.snapshot().paused)).toBe(false);

  await page.keyboard.down("KeyW");
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  const beforeBlurTicks = await page.evaluate(() => window.__COW_REVIEW__.snapshot().player.position.z);
  await page.evaluate(() => window.__COW_REVIEW__.stepTicks(10));
  const afterBlurTicks = await page.evaluate(() => window.__COW_REVIEW__.snapshot().player.position.z);
  expect(afterBlurTicks).toBeCloseTo(beforeBlurTicks, 6);
});

test("forced WebGL context loss restores without a generic error", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("/?review=1&post=0");
  await page.evaluate(async () => window.__COW_REVIEW__.ready);
  const supported = await page.evaluate(() => window.__COW_REVIEW__.forceContextLoss());
  test.skip(!supported, "WEBGL_lose_context is unavailable on this browser");
  await page.waitForFunction(() => window.__COW_REVIEW__.telemetry().renderer.context.lost);
  expect(await page.evaluate(() => window.__COW_REVIEW__.forceContextRestore())).toBe(true);
  await page.waitForFunction(() => {
    const context = window.__COW_REVIEW__.telemetry().renderer.context;
    return !context.lost && context.restores >= 1;
  });
  const renderer = await page.evaluate(() => window.__COW_REVIEW__.telemetry().renderer);
  expect(renderer.context.losses).toBe(1);
  expect(renderer.context.restores).toBe(1);
  expect(renderer.errors).toEqual([]);
});
