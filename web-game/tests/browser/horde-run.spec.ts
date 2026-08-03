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

test("mouse look, camera-relative movement, facing, lock, and pause stay coherent", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1600, height: 900 });
  await waitForHorde(page);

  const canvas = page.locator("canvas#game-canvas");
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  if (!bounds) return;
  const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  const initial = await page.evaluate(() => ({
    camera: window.__GAUNTLET__.getCameraTelemetry(),
    player: window.__GAUNTLET__.getHordeSnapshot().player,
  }));

  await page.mouse.move(center.x, center.y);
  await page.mouse.down({ button: "left" });
  await page.mouse.move(center.x + 240, center.y - 120, { steps: 6 });
  await page.waitForFunction(
    (yaw) => window.__GAUNTLET__.getCameraTelemetry().yaw > yaw + 0.2,
    initial.camera.yaw,
  );
  const duringDrag = await page.evaluate(() => ({
    camera: window.__GAUNTLET__.getCameraTelemetry(),
    capture: window.__GAUNTLET__.getInputCaptureTelemetry(),
  }));
  expect(duringDrag.capture.mode).not.toBe("none");
  expect(duringDrag.camera.yaw).toBeGreaterThan(initial.camera.yaw + 0.2);
  expect(duringDrag.camera.pitch).toBeLessThan(initial.camera.pitch);
  await page.mouse.up({ button: "left" });

  await page.waitForFunction(
    () => window.__GAUNTLET__.getHordeSnapshot().player.action.kind === "none",
  );
  // Use the same canvas gesture a player uses after aiming. This also proves
  // that capture fallback and combat input continue to coexist after a drag.
  await page.mouse.down({ button: "left" });
  await page.mouse.up({ button: "left" });
  await page.waitForFunction(
    () => window.__GAUNTLET__.getHordeSnapshot().player.action.kind === "normal",
    undefined,
    { timeout: 10_000 },
  );
  const strike = await page.evaluate(() => ({
    camera: window.__GAUNTLET__.getCameraTelemetry(),
    player: window.__GAUNTLET__.getHordeSnapshot().player,
  }));
  const strikeFacingDelta = Math.atan2(
    Math.sin(strike.player.action.facingYaw - strike.camera.yaw),
    Math.cos(strike.player.action.facingYaw - strike.camera.yaw),
  );
  expect(Math.abs(strikeFacingDelta)).toBeLessThan(0.02);

  await page.waitForFunction(
    () => window.__GAUNTLET__.getHordeSnapshot().player.action.kind === "none",
  );
  const beforeMove = await page.evaluate(() => window.__GAUNTLET__.getHordeSnapshot().player.position);
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(320);
  await page.keyboard.up("KeyW");
  const afterMove = await page.evaluate(() => ({
    camera: window.__GAUNTLET__.getCameraTelemetry(),
    position: window.__GAUNTLET__.getHordeSnapshot().player.position,
  }));
  const move = {
    x: afterMove.position.x - beforeMove.x,
    z: afterMove.position.z - beforeMove.z,
  };
  const moveLength = Math.hypot(move.x, move.z);
  const forward = {
    x: Math.sin(afterMove.camera.yaw),
    z: -Math.cos(afterMove.camera.yaw),
  };
  expect(moveLength).toBeGreaterThan(0.25);
  expect((move.x * forward.x + move.z * forward.z) / moveLength).toBeGreaterThan(0.97);

  await page.keyboard.press("KeyQ");
  await page.waitForFunction(
    () => window.__GAUNTLET__.getHordeSnapshot().player.lockedTargetId !== null,
  );
  await page.waitForTimeout(450);
  const locked = await page.evaluate(() => {
    const state = window.__GAUNTLET__.getHordeSnapshot();
    const target = state.enemies.find((enemy) => enemy.id === state.player.lockedTargetId);
    return {
      camera: window.__GAUNTLET__.getCameraTelemetry(),
      player: state.player,
      target,
    };
  });
  expect(locked.target).toBeDefined();
  if (!locked.target) return;
  const targetYaw = Math.atan2(
    locked.target.position.x - locked.player.position.x,
    -(locked.target.position.z - locked.player.position.z),
  );
  const lockedYawDelta = Math.atan2(
    Math.sin(locked.camera.yaw - targetYaw),
    Math.cos(locked.camera.yaw - targetYaw),
  );
  expect(Math.abs(lockedYawDelta)).toBeLessThan(0.08);

  await page.keyboard.press("Escape");
  if ((await page.locator(".run-hud").getAttribute("data-mode")) !== "paused") {
    // Chromium consumes the first Escape when it releases pointer lock.
    await page.keyboard.press("Escape");
  }
  await expect(page.locator(".run-hud")).toHaveAttribute("data-mode", "paused");
  const paused = await page.evaluate(() => ({
    camera: window.__GAUNTLET__.getCameraTelemetry(),
    capture: window.__GAUNTLET__.getInputCaptureTelemetry(),
  }));
  expect(paused.capture.mode).toBe("none");
  await page.mouse.move(center.x - 300, center.y + 180);
  await page.waitForTimeout(180);
  expect((await page.evaluate(() => window.__GAUNTLET__.getCameraTelemetry().yaw))).toBe(
    paused.camera.yaw,
  );
  await page.keyboard.press("Escape");
  await expect(page.locator(".run-hud")).toHaveAttribute("data-mode", "playing");
  const resumedYaw = await page.evaluate(() => window.__GAUNTLET__.getCameraTelemetry().yaw);
  expect(resumedYaw).toBe(paused.camera.yaw);

  await testInfo.attach("camera-control-receipt.json", {
    body: JSON.stringify(
      {
        schema: "codex-of-war.camera-control-receipt.v1",
        viewport: { width: 1600, height: 900 },
        initial,
        duringDrag,
        strike,
        movement: {
          before: beforeMove,
          after: afterMove,
          directionDot: (move.x * forward.x + move.z * forward.z) / moveLength,
        },
        locked,
        pause: { paused, resumedYaw },
      },
      null,
      2,
    ),
    contentType: "application/json",
  });
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
