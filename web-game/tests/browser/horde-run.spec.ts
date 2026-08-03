import { expect, test, type Page } from "@playwright/test";

async function waitForHorde(page: Page): Promise<void> {
  await page.goto("/?post=0");
  await page.waitForFunction(() => document.documentElement.dataset.gameReady === "true");
  await page.waitForFunction(() => window.__GAUNTLET__?.mode === "horde");
}

test("Horde Run start gate, loadout, pause gating, and public harness are truthful", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1600, height: 900 });
  await waitForHorde(page);

  const initial = await page.evaluate(() => window.__GAUNTLET__.getHordeSnapshot());
  expect(await page.evaluate(() => "__COW_REVIEW__" in window)).toBe(false);
  expect(initial.tick).toBe(0);
  expect(initial.player.health).toBe(100);
  expect(initial.enemies).toHaveLength(3);
  await page.waitForTimeout(850);
  expect((await page.evaluate(() => window.__GAUNTLET__.getHordeSnapshot())).tick).toBe(0);

  const guardedHarness = await page.evaluate(() => {
    const before = window.__GAUNTLET__.getHordeSnapshot();
    let message = "";
    try {
      window.__GAUNTLET__.stepFrames(10, { attackPressed: true });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    const after = window.__GAUNTLET__.getHordeSnapshot();
    return { before, after, message, mode: window.__GAUNTLET__.mode };
  });
  expect(guardedHarness.mode).toBe("horde");
  expect(guardedHarness.message).toContain("unavailable in Horde mode");
  expect(guardedHarness.after).toEqual(guardedHarness.before);

  await page.keyboard.press("KeyQ");
  await page.waitForFunction(() => window.__GAUNTLET__.getHordeSnapshot().tick > 0);
  await page.waitForFunction(
    () => window.__GAUNTLET__.getHordeSnapshot().player.lockedTargetId !== null,
  );

  await page.keyboard.press("Digit2");
  await page.waitForFunction(
    () => window.__GAUNTLET__.getHordeSnapshot().player.selectedWeapon === "greatsword",
  );
  await page.keyboard.press("KeyK");
  await page.waitForFunction(
    () => window.__GAUNTLET__.getHordeSnapshot().player.action.kind === "special",
  );
  await page.waitForFunction(
    () => window.__GAUNTLET__.getHordeSnapshot().player.action.kind === "none",
    undefined,
    { timeout: 15_000 },
  );
  await page.keyboard.press("Digit3");
  await page.waitForFunction(
    () => window.__GAUNTLET__.getHordeSnapshot().player.selectedWeapon === "twin-blades",
  );

  const beforePause = await page.evaluate(() => window.__GAUNTLET__.getHordeSnapshot());
  await page.keyboard.press("Escape");
  await expect(page.locator(".run-hud")).toHaveAttribute("data-mode", "paused");
  const pausedTick = (await page.evaluate(() => window.__GAUNTLET__.getHordeSnapshot())).tick;
  await page.keyboard.press("KeyJ");
  await page.keyboard.press("Digit1");
  await page.keyboard.press("KeyQ");
  await page.waitForTimeout(350);
  const stillPaused = await page.evaluate(() => window.__GAUNTLET__.getHordeSnapshot());
  expect(stillPaused.tick).toBe(pausedTick);
  expect(stillPaused.player.action.serial).toBe(beforePause.player.action.serial);
  expect(stillPaused.player.selectedWeapon).toBe("twin-blades");
  expect(stillPaused.player.lockedTargetId).toBe(beforePause.player.lockedTargetId);

  await page.keyboard.press("Escape");
  await expect(page.locator(".run-hud")).toHaveAttribute("data-mode", "playing");
  await page.waitForTimeout(250);
  const resumed = await page.evaluate(() => window.__GAUNTLET__.getHordeSnapshot());
  expect(resumed.player.action.serial).toBe(beforePause.player.action.serial);
  expect(resumed.player.selectedWeapon).toBe("twin-blades");
});

test("actual keyboard play clears wave one, scores kills, and applies an upgrade", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1600, height: 900 });
  await waitForHorde(page);
  await page.keyboard.press("KeyQ");

  const deadline = Date.now() + 70_000;
  let maximumCommittedAttackers = 0;
  while (Date.now() < deadline) {
    const state = await page.evaluate(() => window.__GAUNTLET__.getHordeSnapshot());
    if (state.phase !== "combat" || state.wave !== 1) break;
    maximumCommittedAttackers = Math.max(
      maximumCommittedAttackers,
      state.enemies.filter((enemy) => enemy.phase === "windup" || enemy.phase === "attack").length,
    );
    if (state.player.lockedTargetId === null) await page.keyboard.press("KeyQ");
    const locked = state.enemies.find((enemy) => enemy.id === state.player.lockedTargetId);
    if (locked) {
      const distance = Math.hypot(
        locked.position.x - state.player.position.x,
        locked.position.z - state.player.position.z,
      );
      if (distance > 2.35) {
        await page.keyboard.down("KeyW");
        await page.waitForTimeout(420);
        await page.keyboard.up("KeyW");
      }
    }
    const imminent = state.enemies.some((enemy) => {
      const distance = Math.hypot(
        enemy.position.x - state.player.position.x,
        enemy.position.z - state.player.position.z,
      );
      return enemy.phase === "windup" && enemy.phaseProgress01 > 0.76 && distance < 2.8;
    });
    if (imminent) {
      await page.keyboard.press("Space");
    } else if (state.player.specialCooldowns.katana === 0 && state.player.stamina >= 28) {
      await page.keyboard.press("KeyK");
    } else {
      await page.keyboard.press("KeyJ");
    }
    await page.waitForTimeout(300);
  }

  await page.waitForFunction(
    () => window.__GAUNTLET__.getHordeSnapshot().phase === "upgrade",
    undefined,
    { timeout: 12_000 },
  );
  const cleared = await page.evaluate(() => window.__GAUNTLET__.getHordeSnapshot());
  expect(cleared.kills).toBe(3);
  expect(cleared.score).toBeGreaterThan(0);
  expect(cleared.essence).toBeGreaterThan(0);
  expect(maximumCommittedAttackers).toBeLessThanOrEqual(1);
  await expect(page.locator(".run-hud")).toHaveAttribute("data-mode", "upgrade");

  await page.keyboard.press("Digit1");
  await page.waitForFunction(
    () => {
      const state = window.__GAUNTLET__.getHordeSnapshot();
      return state.phase === "combat" && state.wave === 2 && state.appliedUpgrades.length === 1;
    },
  );
  const waveTwo = await page.evaluate(() => window.__GAUNTLET__.getHordeSnapshot());
  expect(waveTwo.enemies).toHaveLength(5);
  expect(waveTwo.player.position).toEqual(waveTwo.initialPlayerPosition);
});
