import { expect, test, type Page } from "@playwright/test";

test.use({ trace: "off" });
test.setTimeout(180_000);

interface CriticSnapshot {
  absoluteSimulationTick: number;
  attackRelativeTick: number | null;
  paused: boolean;
  capturePaused: boolean;
  renderHeartbeat: number;
  target: {
    health: number;
    collision: {
      separationMeters: number | null;
      penetrationMeters: number | null;
      exteriorContactPoints: number;
    };
  };
  authoritativeState: { sha256: string; bcjVersion: string };
  rendererMode: string;
  assetTier: string;
  fallbackActive: boolean;
  errors: string[];
}

async function snapshot(page: Page): Promise<CriticSnapshot> {
  return page.evaluate(() => window.__P30_CRITIC__!.snapshot() as unknown as CriticSnapshot);
}

async function waitForCapture(page: Page, absoluteTick: number): Promise<CriticSnapshot> {
  await page.waitForFunction(
    (tick) => {
      const current = window.__P30_CRITIC__?.snapshot() as unknown as CriticSnapshot | undefined;
      return current?.capturePaused && current.absoluteSimulationTick === tick;
    },
    absoluteTick,
  );
  return snapshot(page);
}

test("absolute-tick critic hook observes one normal-input strike without posing gameplay", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("/?scenario=P30-light-strike-v1&seed=30011");
  await page.waitForFunction(() => window.__P30_CRITIC__ !== undefined);
  await page.evaluate(async () => window.__P30_CRITIC__!.whenReady());

  const initial = await snapshot(page);
  expect(initial).toMatchObject({
    absoluteSimulationTick: 0,
    attackRelativeTick: null,
    paused: true,
    capturePaused: false,
    rendererMode: "webgl2",
    assetTier: "production-authored",
    fallbackActive: false,
    errors: [],
  });
  expect(initial.authoritativeState.sha256).toMatch(/^[0-9a-f]{64}$/);
  expect(initial.authoritativeState.bcjVersion).toBe("BCJ-v1");
  expect(await page.evaluate(() => ({
    gauntlet: "__GAUNTLET__" in window,
    review: "__COW_REVIEW__" in window,
    pose: "__COW_COMBAT_POSE__" in window,
    bladeFx: "__COW_BLADE_FX__" in window,
    combatFx: "__COW_COMBAT_FX__" in window,
  }))).toEqual({
    gauntlet: false,
    review: false,
    pose: false,
    bladeFx: false,
    combatFx: false,
  });

  const captureTicks = [20, 24, 29, 34, 41];
  await page.evaluate((ticks) => window.__P30_CRITIC__!.armCaptureTicks(ticks), captureTicks);

  await page.keyboard.down("KeyW");
  await waitForCapture(page, 20);
  await page.keyboard.up("KeyW");
  await page.evaluate(() => window.__P30_CRITIC__!.resume());
  await waitForCapture(page, 24);

  await page.mouse.click(800, 450, { button: "left" });
  await page.evaluate(() => window.__P30_CRITIC__!.resume());

  const focused = new Map<number, CriticSnapshot>();
  let priorHeartbeat = initial.renderHeartbeat;
  for (const tick of [29, 34, 41]) {
    const current = await waitForCapture(page, tick);
    expect(current.attackRelativeTick).toBe(tick - 24);
    expect(current.renderHeartbeat).toBeGreaterThan(priorHeartbeat);
    expect(current.authoritativeState.sha256).toMatch(/^[0-9a-f]{64}$/);
    priorHeartbeat = current.renderHeartbeat;
    focused.set(tick, current);
    if (tick < 41) await page.evaluate(() => window.__P30_CRITIC__!.resume());
  }

  expect(focused.get(29)?.attackRelativeTick).toBe(5);
  expect(focused.get(34)?.attackRelativeTick).toBe(10);
  expect(focused.get(41)?.attackRelativeTick).toBe(17);
  expect(focused.get(34)?.target.health).toBe(90);
  expect(focused.get(34)?.target.collision).toMatchObject({
    separationMeters: 0,
    penetrationMeters: 0,
    exteriorContactPoints: 1,
  });

  const run = await page.evaluate(() => window.__P30_CRITIC__!.runReceipt() as {
    inputEdgeLog: Array<Record<string, unknown>>;
    eventLog: Array<Record<string, unknown>>;
    fixedInputHistory: Array<Record<string, unknown>>;
    stateDigestHistory: Array<Record<string, unknown>>;
    errors: string[];
  });
  expect(run.inputEdgeLog).toContainEqual(expect.objectContaining({
    eventID: "input-0001",
    device: "mouse",
    button: "left",
    absoluteSimulationTick: 24,
    attackRelativeTick: 0,
  }));
  expect(run.eventLog).toContainEqual(expect.objectContaining({
    type: "enemy-hit",
    absoluteSimulationTick: 34,
    attackRelativeTick: 10,
    damage: 10,
    healthBefore: 100,
    healthAfter: 90,
  }));
  expect(run.fixedInputHistory).toHaveLength(41);
  expect(run.stateDigestHistory).toHaveLength(42);
  expect(run.errors).toEqual([]);
});
