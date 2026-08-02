import { expect, test } from "@playwright/test";

test("opaque critic hook captures the frozen strike through normal mouse input", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("/?scenario=P30-light-strike-v1&seed=30011");
  await page.waitForFunction(() => window.__P30_CRITIC__?.schema === "p30.r011.runtime-hook.v1");
  await page.evaluate(() => window.__P30_CRITIC__?.whenReady());

  const initial = await page.evaluate(() => window.__P30_CRITIC__?.snapshot());
  expect(initial).toMatchObject({
    absoluteSimulationTick: 0,
    attackRelativeTick: null,
    paused: true,
    rendererMode: "WebGL2",
    assetTier: "production-authored",
    fallbackActive: false,
  });
  expect(await page.evaluate(() => "__COW_REVIEW__" in window)).toBe(false);
  expect(await page.evaluate(() => "__GAUNTLET__" in window)).toBe(false);

  await page.evaluate(() => window.__P30_CRITIC__?.armCaptureTicks([20, 24, 29, 34, 41]));
  const canvas = page.locator("canvas#game-canvas");
  await expect(canvas).toBeVisible();

  await page.keyboard.down("KeyW");
  await page.evaluate(() => window.__P30_CRITIC__?.resume());
  await page.waitForFunction(() => {
    const status = window.__P30_CRITIC__?.resourceReceipt();
    return status?.paused === true && status.absoluteSimulationTick === 20;
  });
  await page.keyboard.up("KeyW");
  await page.evaluate(() => window.__P30_CRITIC__?.resume());
  await page.waitForFunction(() => {
    const status = window.__P30_CRITIC__?.resourceReceipt();
    return status?.paused === true && status.absoluteSimulationTick === 24;
  });
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.click(
    bounds!.x + bounds!.width * 0.5,
    bounds!.y + bounds!.height * 0.5,
    { button: "left" },
  );
  await page.waitForTimeout(32);
  await page.evaluate(() => window.__P30_CRITIC__?.resume());

  const samples = [];
  for (const tick of [29, 34, 41]) {
    await page.waitForFunction((wanted) => {
      const status = window.__P30_CRITIC__?.resourceReceipt();
      return status?.paused === true && status.absoluteSimulationTick === wanted;
    }, tick);
    samples.push(await page.evaluate(() => window.__P30_CRITIC__?.snapshot()));
    await page.evaluate(() => window.__P30_CRITIC__?.resume());
  }

  expect(samples.map((sample) => sample?.absoluteSimulationTick)).toEqual([29, 34, 41]);
  expect(samples.map((sample) => sample?.attackRelativeTick)).toEqual([5, 10, 17]);
  expect(samples.map((sample) => (
    sample?.authoritativeState as { state: { player: { attackFrame: number } } }
  ).state.player.attackFrame)).toEqual([5, 10, 17]);
  expect((samples[1]?.target as {
    collisionSurface: {
      classification: string;
      edgeToSurfaceMeters: number;
      signedSeparationMeters: number;
    };
  }).collisionSurface).toMatchObject({
    classification: "contact",
    edgeToSurfaceMeters: 0,
    signedSeparationMeters: 0,
  });

  const receipt = await page.evaluate(() => window.__P30_CRITIC__?.runReceipt());
  expect(receipt?.inputEdgeLog).toEqual([
    expect.objectContaining({ absoluteTick: 24, device: "mouse", button: "left" }),
  ]);
  expect((receipt?.inputHistory as unknown[])).toHaveLength(41);
  expect((receipt?.stateDigestHistory as unknown[])).toHaveLength(42);
  expect(receipt?.eventLog).toContainEqual(
    expect.objectContaining({
      absoluteTick: 34,
      sourceSimulationTick: 33,
      postUpdateAbsoluteTick: 34,
      event: expect.objectContaining({ type: "enemy-hit", damage: 10 }),
    }),
  );
});
