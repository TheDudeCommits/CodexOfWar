#!/usr/bin/env node

/* global console, process, window */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { chromium } from "@playwright/test";

const width = 1600;
const height = 900;
const baseUrl = process.env.ROUND005_URL ?? "http://127.0.0.1:4173/?review=1&post=0";
const outputRoot = resolve(process.cwd(), "../ArtSource/P30/Round005");
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const headless = process.env.ROUND005_HEADLESS === "1";

const forward = Array.from({ length: 20 }, (_, tick) => ({
  tick, action: "move.forward", phase: "value", value: 1,
}));
const attack = [
  { tick: 24, action: "attack.primary", phase: "down" },
  { tick: 25, action: "attack.primary", phase: "up" },
];
const scenarios = [
  { id: "S01", preset: "combat-tape-c", ticks: 120, actions: [
    ...Array.from({ length: 60 }, (_, tick) => ({ tick, action: "move.backward", phase: "value", value: 1 })),
    { tick: 72, action: "camera.reset", phase: "down" },
  ] },
  { id: "S02", preset: "combat-idle", ticks: 23, actions: forward },
  { id: "S03", preset: "combat-startup", ticks: 29, actions: [...forward, ...attack] },
  { id: "S04", preset: "combat-active-hit", ticks: 34, actions: [...forward, ...attack] },
  { id: "S05", preset: "combat-recovery", ticks: 41, actions: [...forward, ...attack] },
  { id: "S06", preset: "combat-dodge-side-offset", ticks: 37, actions: [
    ...forward,
    ...Array.from({ length: 9 }, (_, index) => ({
      tick: 20 + index, action: "move.right", phase: "value", value: 1,
    })),
    { tick: 28, action: "dodge", phase: "down" },
    { tick: 29, action: "dodge", phase: "up" },
  ] },
];

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

await mkdir(outputRoot, { recursive: true });
const browser = await chromium.launch({
  executablePath: chrome,
  headless,
  args: [
    "--use-angle=metal", "--enable-gpu", "--disable-software-rasterizer",
    "--force-device-scale-factor=1", `--window-size=${width},${height}`,
    "--window-position=0,0", "--disable-background-timer-throttling",
  ],
});
const context = await browser.newContext({
  viewport: { width, height }, deviceScaleFactor: 1, colorScheme: "dark", reducedMotion: "reduce",
});
const page = await context.newPage();
const errors = { console: [], page: [], requests: [], http: [] };
page.on("console", (message) => {
  if (["warning", "error"].includes(message.type())) errors.console.push({ type: message.type(), text: message.text() });
});
page.on("pageerror", (error) => errors.page.push(String(error)));
page.on("requestfailed", (request) => errors.requests.push({ url: request.url(), error: request.failure()?.errorText }));
page.on("response", (response) => {
  if (response.status() >= 400) errors.http.push({ url: response.url(), status: response.status() });
});

const started = performance.now();
const response = await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => Boolean(window.__COW_REVIEW__?.ready));
await page.evaluate(async () => window.__COW_REVIEW__.ready);
const readyMs = Math.round(performance.now() - started);
await page.bringToFront();

const captures = [];
for (const scenario of scenarios) {
  const telemetry = await page.evaluate(({ preset, ticks, actions }) => {
    const review = window.__COW_REVIEW__;
    review.reset({ piece: "P30", preset, seed: 30001 });
    review.queue(actions);
    for (let tick = 0; tick < ticks; tick += 1) review.stepTicks(1);
    review.renderOnce();
    return review.telemetry();
  }, scenario);
  const path = resolve(outputRoot, `${scenario.id}.png`);
  await page.screenshot({ path, type: "png", animations: "disabled" });
  const bytes = await readFile(path);
  captures.push({
    id: scenario.id,
    path: `ArtSource/P30/Round005/${scenario.id}.png`,
    bytes: bytes.length,
    sha256: sha256(bytes),
    processedTicks: scenario.ticks,
    state: telemetry.state,
    events: telemetry.events,
    camera: telemetry.camera,
    renderer: telemetry.renderer,
    assetLoad: telemetry.assetLoad,
    reviewErrors: telemetry.errors,
  });
}

const receipt = {
  schema: "p30.round005.production-capture-evidence.v1",
  candidateOnly: true,
  acceptanceClaimed: false,
  headed: !headless,
  url: baseUrl,
  httpStatus: response?.status() ?? null,
  browser: browser.version(),
  readyMs,
  coldReadyLimitMs: 4109,
  viewport: { width, height, dpr: 1 },
  runtimeBinding: {
    heroScale: 1.22,
    hollowScale: 1.16,
    weaponScale: 1,
    weaponAxialRoll: 0.6,
    weaponSocket: "weapon_socket",
    visualToeInYaw: 0.5,
    visualLateralOffset: 0.62,
  },
  captures,
  errors,
};
await writeFile(resolve(outputRoot, "capture-evidence.json"), `${JSON.stringify(receipt, null, 2)}\n`);
await browser.close();
console.log(JSON.stringify({
  headed: receipt.headed,
  readyMs,
  captures: captures.map(({ id, sha256: hash, renderer }) => ({ id, sha256: hash, renderer })),
  errors,
}, null, 2));
