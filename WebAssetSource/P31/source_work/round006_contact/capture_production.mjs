#!/usr/bin/env node

/* global console, process, window */

import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { performance } from "node:perf_hooks";

const here = import.meta.dirname;
const root = resolve(here, "../../../..");
const requireFromWebGame = createRequire(resolve(root, "web-game/package.json"));
const { chromium } = requireFromWebGame("@playwright/test");

const width = 1600;
const height = 900;
const baseUrl = process.env.ROUND006_URL ?? "http://127.0.0.1:4273/?review=1&post=0";
const runtimeRoot = process.env.ROUND006_RUNTIME_ROOT ?? null;
const outputRoot = process.env.ROUND006_OUTPUT_ROOT
  ? resolve(process.env.ROUND006_OUTPUT_ROOT)
  : resolve(here, "captures");
const reportPath = process.env.ROUND006_REPORT_PATH
  ? resolve(process.env.ROUND006_REPORT_PATH)
  : resolve(here, "reports/production-capture.json");
const temporaryRuntime = process.env.ROUND006_TEMPORARY_RUNTIME !== "0";
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const forward = Array.from({ length: 20 }, (_, tick) => ({
  tick, action: "move.forward", phase: "value", value: 1,
}));
const attack = [
  { tick: 24, action: "attack.primary", phase: "down" },
  { tick: 25, action: "attack.primary", phase: "up" },
];
const scenarios = [
  { id: "S03", preset: "combat-startup", ticks: 29, phase: "startup", actions: [...forward, ...attack] },
  { id: "S04", preset: "combat-active-hit", ticks: 34, phase: "active", actions: [...forward, ...attack] },
  { id: "S05", preset: "combat-recovery", ticks: 41, phase: "recovery", actions: [...forward, ...attack] },
];

await mkdir(outputRoot, { recursive: true });
const browser = await chromium.launch({
  executablePath: chrome,
  headless: false,
  args: [
    "--use-angle=metal",
    "--enable-gpu",
    "--disable-software-rasterizer",
    "--force-device-scale-factor=1",
    `--window-size=${width},${height}`,
    "--window-position=0,0",
    "--disable-background-timer-throttling",
  ],
});
const browserVersion = browser.version();
const context = await browser.newContext({
  viewport: { width, height },
  deviceScaleFactor: 1,
  colorScheme: "dark",
  reducedMotion: "reduce",
});
const page = await context.newPage();
const errors = { console: [], page: [], requests: [], http: [] };
page.on("console", (message) => {
  if (["warning", "error"].includes(message.type())) {
    errors.console.push({ type: message.type(), text: message.text() });
  }
});
page.on("pageerror", (error) => errors.page.push(String(error)));
page.on("requestfailed", (request) => {
  errors.requests.push({ url: request.url(), error: request.failure()?.errorText ?? null });
});
page.on("response", (response) => {
  if (response.status() >= 400) errors.http.push({ url: response.url(), status: response.status() });
});

const started = performance.now();
const response = await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => Boolean(window.__COW_REVIEW__?.ready));
await page.evaluate(async () => window.__COW_REVIEW__.ready);
const readyMs = Math.round(performance.now() - started);
await page.bringToFront();

const servedAssets = {};
for (const [id, url, candidatePath] of [
  ["hero", "/assets/models/ashwake/nyra.glb", resolve(here, "glb/nyra.glb")],
  ["weapon", "/assets/models/ashwake/stormcage.glb", resolve(here, "glb/stormcage.glb")],
]) {
  const local = await readFile(candidatePath);
  const servedResponse = await fetch(new URL(url, baseUrl));
  const served = Buffer.from(await servedResponse.arrayBuffer());
  if (!servedResponse.ok || !served.equals(local)) {
    throw new Error(`${id}: temporary runtime bytes do not match isolated candidate`);
  }
  servedAssets[id] = {
    url,
    bytes: served.length,
    sha256: sha256(served),
    candidateByteIdentical: true,
  };
}

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
    phase: scenario.phase,
    tick: scenario.ticks,
    path: relative(root, path).split("\\").join("/"),
    bytes: bytes.length,
    sha256: sha256(bytes),
    state: telemetry.state,
    events: telemetry.events,
    renderer: telemetry.renderer,
    assetLoad: telemetry.assetLoad,
    camera: telemetry.camera,
    reviewErrors: telemetry.errors,
  });
}

await browser.close();

const limits = { readyMs: 4109, calls: 100, triangles: 250000, textures: 32, geometries: 64 };
const failures = [];
if (readyMs > limits.readyMs) failures.push(`cold ready ${readyMs}ms > ${limits.readyMs}ms`);
if (response?.status() !== 200) failures.push(`HTTP status ${response?.status() ?? "null"}`);
if (errors.page.length || errors.requests.length || errors.http.length) failures.push("browser/request/HTTP errors");
for (const capture of captures) {
  const renderer = capture.renderer;
  if (renderer.calls > limits.calls) failures.push(`${capture.id}: calls ${renderer.calls}`);
  if (renderer.triangles > limits.triangles) failures.push(`${capture.id}: triangles ${renderer.triangles}`);
  if (renderer.textures > limits.textures) failures.push(`${capture.id}: textures ${renderer.textures}`);
  if (renderer.geometries > limits.geometries) failures.push(`${capture.id}: geometries ${renderer.geometries}`);
  if (capture.reviewErrors.length) failures.push(`${capture.id}: review errors`);
  const registry = capture.assetLoad?.registry;
  if (!registry?.complete || registry.failures?.length || registry.enabled?.length !== registry.loaded?.length) {
    failures.push(`${capture.id}: asset registry incomplete`);
  }
  if (capture.assetLoad?.presentation?.proceduralFallbackActive) {
    failures.push(`${capture.id}: procedural fallback active`);
  }
}

const report = {
  schema: temporaryRuntime
    ? "p30.round006.isolated-production-capture.v1"
    : "p30.round006.shared-production-capture.v1",
  status: failures.length ? "fail" : "pass",
  integrated: !temporaryRuntime,
  acceptanceClaimed: false,
  temporaryRuntime,
  ...(temporaryRuntime
    ? { temporaryRuntimeRoot: runtimeRoot }
    : {
        sharedRuntimeRoot: relative(
          root,
          runtimeRoot ? resolve(runtimeRoot) : resolve(root, "web-game"),
        ).split("\\").join("/"),
      }),
  sharedRuntime: !temporaryRuntime,
  sharedRuntimeWritten: !temporaryRuntime,
  captureScriptWroteRuntime: false,
  headed: true,
  hardwareArgs: ["--use-angle=metal", "--enable-gpu", "--disable-software-rasterizer"],
  browser: browserVersion,
  url: baseUrl,
  httpStatus: response?.status() ?? null,
  readyMs,
  viewport: { width, height, dpr: 1 },
  servedAssets,
  captures,
  limits,
  errors,
  failures,
};
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({
  status: report.status,
  headed: report.headed,
  readyMs,
  captures: captures.map(({ id, tick, sha256: hash, renderer }) => ({ id, tick, sha256: hash, renderer })),
  failures,
  errors,
}, null, 2));
if (failures.length) process.exitCode = 1;
