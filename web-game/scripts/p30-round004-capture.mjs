#!/usr/bin/env node

/* global HTMLCanvasElement, console, document, navigator, process, window */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { chromium } from "@playwright/test";

const WIDTH = 1600;
const HEIGHT = 900;
const BASE_URL = process.env.ROUND004_URL ?? "http://127.0.0.1:4173/?review=1&post=0";
const OUTPUT_ROOT = resolve(process.cwd(), "../ArtSource/P30/Round004");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const headless = process.env.ROUND004_HEADLESS === "1";

const forward = Array.from({ length: 20 }, (_, tick) => ({
  tick,
  action: "move.forward",
  phase: "value",
  value: 1,
}));
const attack = [
  { tick: 24, action: "attack.primary", phase: "down" },
  { tick: 25, action: "attack.primary", phase: "up" },
];

const scenarios = [
  {
    id: "S01",
    preset: "combat-tape-c",
    ticks: 120,
    description: "obstruction contract: backward ticks 0-59 and camera reset at 72",
    actions: [
      ...Array.from({ length: 60 }, (_, tick) => ({
        tick,
        action: "move.backward",
        phase: "value",
        value: 1,
      })),
      { tick: 72, action: "camera.reset", phase: "down" },
    ],
  },
  {
    id: "S02",
    preset: "combat-idle",
    ticks: 23,
    description: "close idle after forward ticks 0-19",
    actions: forward,
  },
  {
    id: "S03",
    preset: "combat-startup",
    ticks: 29,
    description: "attack startup at processed tick 29",
    actions: [...forward, ...attack],
  },
  {
    id: "S04",
    preset: "combat-active-hit",
    ticks: 34,
    description: "active contact after the tick-33 enemy hit",
    actions: [...forward, ...attack],
  },
  {
    id: "S05",
    preset: "combat-recovery",
    ticks: 41,
    description: "recovery and Hollow reaction aftermath",
    actions: [...forward, ...attack],
  },
  {
    id: "S06",
    preset: "combat-dodge-side-offset",
    ticks: 37,
    description: "right side-offset ticks 20-28 with dodge down at 28",
    actions: [
      ...forward,
      ...Array.from({ length: 9 }, (_, index) => ({
        tick: 20 + index,
        action: "move.right",
        phase: "value",
        value: 1,
      })),
      { tick: 28, action: "dodge", phase: "down" },
      { tick: 29, action: "dodge", phase: "up" },
    ],
  },
];

function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}

function parsePng(data) {
  if (data.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
    throw new Error("Capture is not a PNG");
  }
  let offset = 8;
  let width = null;
  let height = null;
  let colorType = null;
  const chunks = [];
  while (offset + 12 <= data.length) {
    const length = data.readUInt32BE(offset);
    const type = data.subarray(offset + 4, offset + 8).toString("ascii");
    chunks.push(type);
    if (type === "IHDR") {
      width = data.readUInt32BE(offset + 8);
      height = data.readUInt32BE(offset + 12);
      colorType = data[offset + 17];
    }
    offset += length + 12;
    if (type === "IEND") break;
  }
  return {
    width,
    height,
    colorType,
    hasAlpha: colorType === 4 || colorType === 6,
    chunks,
    forbiddenMetadata: chunks.filter((type) =>
      ["tEXt", "zTXt", "iTXt", "eXIf"].includes(type),
    ),
  };
}

async function advanceScenario(page, scenario) {
  return page.evaluate(({ preset, ticks, actions }) => {
    const review = window.__COW_REVIEW__;
    review.reset({ piece: "P30", preset, seed: 30001 });
    review.queue(actions);
    for (let tick = 0; tick < ticks; tick += 1) review.stepTicks(1);
    review.renderOnce();
    return review.telemetry();
  }, scenario);
}

async function runTape(page, kind) {
  return page.evaluate((tapeKind) => {
    const review = window.__COW_REVIEW__;
    review.reset({ piece: "P30", preset: tapeKind, seed: 30001 });
    if (tapeKind === "combat-tape-a") {
      review.queue([
        ...Array.from({ length: 20 }, (_, tick) => ({
          tick,
          action: "move.forward",
          phase: "value",
          value: 1,
        })),
        { tick: 24, action: "attack.primary", phase: "down" },
        { tick: 25, action: "attack.primary", phase: "up" },
        { tick: 28, action: "attack.primary", phase: "down" },
        { tick: 29, action: "attack.primary", phase: "up" },
      ]);
    } else {
      review.queue([
        { tick: 0, action: "attack.primary", phase: "down" },
        { tick: 1, action: "attack.primary", phase: "up" },
      ]);
    }
    for (let tick = 0; tick < 60; tick += 1) review.stepTicks(1);
    const telemetry = review.telemetry();
    return {
      history: telemetry.history.map((entry) => entry.state),
      events: telemetry.events,
      final: telemetry.state.state,
      camera: telemetry.camera,
      assetLoad: telemetry.assetLoad,
      renderer: telemetry.renderer,
      errors: telemetry.errors,
    };
  }, kind);
}

await mkdir(OUTPUT_ROOT, { recursive: true });
const browser = await chromium.launch({
  executablePath: CHROME,
  headless,
  args: [
    "--use-angle=metal",
    "--enable-gpu",
    "--disable-software-rasterizer",
    "--force-device-scale-factor=1",
    `--window-size=${WIDTH},${HEIGHT}`,
    "--window-position=0,0",
    "--disable-background-timer-throttling",
  ],
});
const context = await browser.newContext({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: 1,
  colorScheme: "dark",
  reducedMotion: "reduce",
});
const page = await context.newPage();
const consoleMessages = [];
const pageErrors = [];
const requestFailures = [];
const httpErrors = [];
page.on("console", (message) => {
  if (["warning", "error"].includes(message.type())) {
    consoleMessages.push({ type: message.type(), text: message.text() });
  }
});
page.on("pageerror", (error) => pageErrors.push(String(error)));
page.on("requestfailed", (request) => {
  requestFailures.push({ url: request.url(), failure: request.failure()?.errorText ?? "unknown" });
});
page.on("response", (response) => {
  if (response.status() >= 400) httpErrors.push({ url: response.url(), status: response.status() });
});

const navigationStarted = performance.now();
const response = await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => Boolean(window.__COW_REVIEW__?.ready));
const apiObservedMs = performance.now() - navigationStarted;
const readyReceipt = await page.evaluate(async () => window.__COW_REVIEW__.ready);
const navigationToReadyMs = performance.now() - navigationStarted;
await page.bringToFront();

const platform = await page.evaluate(() => {
  const canvas = document.querySelector("canvas#game-canvas");
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Game canvas missing");
  const gl = canvas.getContext("webgl2");
  if (!gl) throw new Error("WebGL2 context missing");
  const debug = gl.getExtension("WEBGL_debug_renderer_info");
  const rect = canvas.getBoundingClientRect();
  return {
    userAgent: navigator.userAgent,
    webglVersion: gl.getParameter(gl.VERSION),
    vendor: gl.getParameter(gl.VENDOR),
    renderer: gl.getParameter(gl.RENDERER),
    unmaskedVendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : null,
    unmaskedRenderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null,
    devicePixelRatio: window.devicePixelRatio,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    canvasCss: { width: rect.width, height: rect.height },
    canvasBacking: { width: canvas.width, height: canvas.height },
  };
});

const captures = [];
for (const scenario of scenarios) {
  const telemetry = await advanceScenario(page, scenario);
  const file = resolve(OUTPUT_ROOT, `${scenario.id}.png`);
  await page.screenshot({ path: file, type: "png", animations: "disabled" });
  const bytes = await readFile(file);
  captures.push({
    id: scenario.id,
    file: file.replace(resolve(process.cwd(), "..") + "/", ""),
    sha256: sha256(bytes),
    bytes: bytes.length,
    png: parsePng(bytes),
    scenario: {
      preset: scenario.preset,
      description: scenario.description,
      processedTicks: scenario.ticks,
      actions: scenario.actions,
      captureAdvance: "one fixed tick and render per step",
    },
    state: {
      tick: telemetry.tick,
      player: telemetry.state.player,
      target: telemetry.state.target,
      events: telemetry.events,
    },
    camera: telemetry.camera,
    renderer: telemetry.renderer,
    assetLoad: telemetry.assetLoad,
    reviewErrors: telemetry.errors,
  });
}

const tapeAFirst = await runTape(page, "combat-tape-a");
const tapeASecond = await runTape(page, "combat-tape-a");
const firstSimulation = JSON.stringify({ history: tapeAFirst.history, events: tapeAFirst.events });
const secondSimulation = JSON.stringify({ history: tapeASecond.history, events: tapeASecond.events });
const tapeB = await runTape(page, "combat-tape-b");
const finalWebglError = await page.evaluate(() => {
  const canvas = document.querySelector("canvas#game-canvas");
  const gl = canvas instanceof HTMLCanvasElement ? canvas.getContext("webgl2") : null;
  return gl?.getError() ?? null;
});

const evidence = {
  schema: "p30.round004.production-capture-evidence.v1",
  candidateOnly: true,
  acceptanceClaimed: false,
  productionUrl: BASE_URL,
  headed: !headless,
  browserVersion: browser.version(),
  httpStatus: response?.status() ?? null,
  timingMs: {
    apiObserved: Math.round(apiObservedMs),
    navigationToReady: Math.round(navigationToReadyMs),
    round002DoNotRegressBeyond: 4109,
  },
  runtimeTuning: {
    heroScale: 1.36,
    hollowScale: 1.74,
    stormcageScale: 0.87,
    stormcagePosition: [0.004, -0.209, 0.018],
    stormcageRotation: [-Math.PI / 2, 0.05, Math.PI],
  },
  readyReceipt,
  platform,
  captures,
  deterministicTapeA: {
    runs: 2,
    processedTicksPerRun: 60,
    simulationSnapshotsAndEventsExact: firstSimulation === secondSimulation,
    run1Sha256: sha256(firstSimulation),
    run2Sha256: sha256(secondSimulation),
    final: tapeAFirst.final,
    events: tapeAFirst.events,
    cameraRun1: tapeAFirst.camera,
    cameraRun2: tapeASecond.camera,
  },
  tapeB: {
    processedTicks: 60,
    final: tapeB.final,
    events: tapeB.events,
    pass: tapeB.final.enemy.health === 100 && !tapeB.events.some((event) => event.type === "enemy_hit"),
  },
  finalAssetLoad: tapeB.assetLoad,
  finalRenderer: tapeB.renderer,
  errors: {
    consoleMessages,
    pageErrors,
    requestFailures,
    httpErrors,
    reviewErrors: tapeB.errors,
    webglGetError: finalWebglError,
  },
};
const output = resolve(OUTPUT_ROOT, "capture-evidence.json");
await writeFile(output, JSON.stringify(evidence, null, 2) + "\n", "utf8");
await browser.close();
console.log(JSON.stringify({
  output,
  headed: !headless,
  readyMs: evidence.timingMs.navigationToReady,
  gpu: platform.unmaskedRenderer,
  captures: captures.map(({ id, sha256: hash }) => ({ id, sha256: hash })),
}, null, 2));
