import { expect, test, type Page } from "@playwright/test";

async function canvasMeanLuma(page: Page): Promise<number> {
  return page.evaluate(() => {
    const source = document.querySelector("canvas#game-canvas");
    if (!(source instanceof HTMLCanvasElement)) throw new Error("game canvas missing");
    const sample = document.createElement("canvas");
    sample.width = 400;
    sample.height = 225;
    const context = sample.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("2D sample context missing");
    context.drawImage(source, 0, 0, sample.width, sample.height);
    const pixels = context.getImageData(0, 0, sample.width, sample.height).data;
    let sum = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      sum += pixels[index]! * 0.2126 + pixels[index + 1]! * 0.7152 + pixels[index + 2]! * 0.0722;
    }
    return sum / (pixels.length / 4);
  });
}

test("rejected pointer-lock requests never escape as unhandled promises", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  await page.goto("/?review=1&post=0");
  await page.evaluate(async () => window.__COW_REVIEW__.ready);

  const unhandled = await page.evaluate(async () => {
    const canvas = document.querySelector("canvas#game-canvas");
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error("game canvas missing");
    const rejections: string[] = [];
    const listener = (event: PromiseRejectionEvent): void => {
      rejections.push(String(event.reason));
    };
    window.addEventListener("unhandledrejection", listener);
    Object.defineProperty(canvas, "requestPointerLock", {
      configurable: true,
      value: () => Promise.reject(
        new DOMException(
          "The root document of this element is not valid for pointer lock.",
          "WrongDocumentError",
        ),
      ),
    });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      canvas.dispatchEvent(new PointerEvent("pointerdown", { button: 0, bubbles: true }));
      await new Promise((resolve) => window.setTimeout(resolve, 20));
    }
    await new Promise((resolve) => window.setTimeout(resolve, 100));
    window.removeEventListener("unhandledrejection", listener);
    return rejections;
  });

  expect(unhandled).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("WebGL restore rebuilds environment and post state before controls resume", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  await page.goto("/?review=1&captureBuffer=1");
  await page.evaluate(async () => window.__COW_REVIEW__.ready);
  await page.evaluate(() => {
    const review = window.__COW_REVIEW__;
    review.reset({ piece: "P30", preset: "context-restore", seed: 30001 });
    review.stepTicks(29);
    review.renderOnce();
  });
  const beforeLuma = await canvasMeanLuma(page);
  const beforeResources = await page.evaluate(() => window.__COW_REVIEW__.telemetry().renderer);
  const gpuRenderer = await page.evaluate(() => {
    const canvas = document.querySelector("canvas#game-canvas");
    if (!(canvas instanceof HTMLCanvasElement)) return "unknown";
    const context = canvas.getContext("webgl2");
    const debug = context?.getExtension("WEBGL_debug_renderer_info");
    return context && debug
      ? String(context.getParameter(debug.UNMASKED_RENDERER_WEBGL))
      : "unknown";
  });
  const softwareContext = /swiftshader|software/i.test(gpuRenderer);

  expect(await page.evaluate(() => window.__COW_REVIEW__.forceContextLoss())).toBe(true);
  await page.waitForFunction(() => window.__COW_REVIEW__.telemetry().renderer.context.lost);
  const restoreRequestedAt = Date.now();
  expect(await page.evaluate(() => window.__COW_REVIEW__.forceContextRestore())).toBe(true);
  await page.waitForFunction(() => {
    const context = window.__COW_REVIEW__.telemetry().renderer.context;
    return !context.lost && context.restores >= 1 && !context.recovering;
  });

  const positionBeforeControl = await page.evaluate(
    () => window.__COW_REVIEW__.snapshot().player.position.z,
  );
  await page.keyboard.down("KeyW");
  await page.evaluate(() => window.__COW_REVIEW__.stepTicks(3));
  await page.keyboard.up("KeyW");
  const positionAfterControl = await page.evaluate(
    () => window.__COW_REVIEW__.snapshot().player.position.z,
  );
  const controlsResponsiveMs = Date.now() - restoreRequestedAt;

  let afterLuma = 0;
  let lumaRecoveredMs = 0;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    await page.evaluate(() => window.__COW_REVIEW__.renderOnce());
    afterLuma = await canvasMeanLuma(page);
    lumaRecoveredMs = Date.now() - restoreRequestedAt;
    if (Math.abs(afterLuma - beforeLuma) / beforeLuma <= 0.05) break;
    await page.waitForTimeout(100);
  }

  const renderer = await page.evaluate(() => window.__COW_REVIEW__.telemetry().renderer);
  expect(positionAfterControl).toBeLessThan(positionBeforeControl);
  if (!softwareContext) {
    expect(controlsResponsiveMs).toBeLessThan(1000);
    expect(lumaRecoveredMs).toBeLessThanOrEqual(5000);
  }
  expect(Math.abs(afterLuma - beforeLuma) / beforeLuma).toBeLessThanOrEqual(0.05);
  expect(renderer.context).toMatchObject({
    lost: false,
    losses: 1,
    restores: 1,
    recovering: false,
  });
  expect(renderer.context.lastRestoreMilliseconds).toBeLessThan(1000);
  expect(renderer.geometries).toBe(beforeResources.geometries);
  expect(renderer.textures).toBe(beforeResources.textures);
  expect(renderer.errors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
