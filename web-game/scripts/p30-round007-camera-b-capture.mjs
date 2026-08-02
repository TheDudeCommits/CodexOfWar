#!/usr/bin/env node

/* global Buffer, console, document, navigator, process, window */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { chromium } from "@playwright/test";

const width = 1600;
const height = 900;
const repoRoot = resolve(process.cwd(), "..");
const baseUrl = process.env.ROUND007_URL ?? "http://127.0.0.1:4173/?review=1&post=0&framing=1";
const outputRoot = resolve(
  process.env.ROUND007_OUTPUT_ROOT ?? "../ArtSource/P30/Round007/BuilderB",
);
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const headless = process.env.ROUND007_HEADLESS === "1";
const requestedColdRuns = Math.max(1, Math.min(3, Number(process.env.ROUND007_COLD_RUNS ?? 3)));

const forward = Array.from({ length: 20 }, (_, tick) => ({
  tick, action: "move.forward", phase: "value", value: 1,
}));
const attack = [
  { tick: 24, action: "attack.primary", phase: "down" },
  { tick: 25, action: "attack.primary", phase: "up" },
];
const scenarios = [
  { id: "S03", preset: "combat-startup", ticks: 29, phase: "startup" },
  { id: "S04", preset: "combat-active-hit", ticks: 34, phase: "active contact" },
  { id: "S05", preset: "combat-recovery", ticks: 41, phase: "recovery" },
];

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function pngMetadata(bytes) {
  if (bytes.toString("ascii", 1, 4) !== "PNG") throw new Error("capture is not a PNG");
  const colorTypes = { 0: "grayscale", 2: "RGB", 3: "indexed", 4: "gray-alpha", 6: "RGBA" };
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    bitDepth: bytes[24],
    colorType: bytes[25],
    colorModel: colorTypes[bytes[25]] ?? "unknown",
  };
}

async function launchChrome() {
  return chromium.launch({
    executablePath: chrome,
    headless,
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
}

await mkdir(outputRoot, { recursive: true });
const browser = await launchChrome();
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
  errors.requests.push({ url: request.url(), error: request.failure()?.errorText });
});
page.on("response", (response) => {
  if (response.status() >= 400) errors.http.push({ url: response.url(), status: response.status() });
});

const started = performance.now();
const response = await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => Boolean(window.__COW_REVIEW__?.ready));
await page.evaluate(async () => window.__COW_REVIEW__.ready);
const readyMs = Math.round((performance.now() - started) * 1000) / 1000;
await page.bringToFront();

const runtime = await page.evaluate(() => {
  const canvas = document.querySelector("canvas#game-canvas");
  const gl = canvas?.getContext("webgl2");
  const debug = gl?.getExtension("WEBGL_debug_renderer_info");
  return {
    userAgent: navigator.userAgent,
    inner: { width: window.innerWidth, height: window.innerHeight },
    dpr: window.devicePixelRatio,
    canvasCss: canvas
      ? { width: canvas.getBoundingClientRect().width, height: canvas.getBoundingClientRect().height }
      : null,
    canvasBacking: canvas ? { width: canvas.width, height: canvas.height } : null,
    webglVersion: gl?.getParameter(gl.VERSION) ?? null,
    webglRenderer: gl && debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null,
    webglVendor: gl && debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : null,
  };
});

const captures = [];
for (const scenario of scenarios) {
  const telemetry = await page.evaluate(({ preset, ticks, actions }) => {
    const review = window.__COW_REVIEW__;
    review.reset({ piece: "P30", preset, seed: 30001 });
    review.queue(actions);
    review.stepTicks(ticks);
    review.renderOnce();
    return review.telemetry();
  }, { ...scenario, actions: [...forward, ...attack] });
  const path = resolve(outputRoot, `${scenario.id}.png`);
  await page.screenshot({ path, type: "png", animations: "disabled" });
  const bytes = await readFile(path);
  captures.push({
    id: scenario.id,
    phase: scenario.phase,
    processedTicks: scenario.ticks,
    path: relative(repoRoot, path),
    bytes: bytes.length,
    sha256: sha256(bytes),
    png: pngMetadata(bytes),
    state: telemetry.state,
    events: telemetry.events,
    camera: telemetry.camera,
    cameraObstruction: telemetry.cameraObstruction,
    framing: telemetry.framing,
    renderer: telemetry.renderer,
    assetLoad: telemetry.assetLoad,
    reviewErrors: telemetry.errors,
  });
}

const replaySamples = await page.evaluate(({ actions }) => {
  const ticks = [29, 34, 41, 60];
  const runs = [];
  for (let replay = 0; replay < 3; replay += 1) {
    const review = window.__COW_REVIEW__;
    review.reset({ piece: "P30", preset: "camera-replay", seed: 30001 });
    review.queue(actions);
    const samples = [];
    for (let processedTicks = 1; processedTicks <= 60; processedTicks += 1) {
      review.stepTicks(1);
      if (ticks.includes(processedTicks)) {
        samples.push({
          tick: processedTicks,
          bytes: JSON.stringify(review.telemetry().camera),
        });
      }
    }
    runs.push(samples);
  }
  return runs;
}, { actions: [...forward, ...attack] });

const replayEvidence = {
  cleanReplays: 3,
  sampleTicks: [29, 34, 41, 60],
  byteIdentical: [29, 34, 41, 60].every((tick) => {
    const values = replaySamples.map((run) => run.find((sample) => sample.tick === tick)?.bytes);
    return values.every((value) => value === values[0]);
  }),
  hashesByReplay: replaySamples.map((run, replay) => ({
    replay: replay + 1,
    ticks: Object.fromEntries(run.map((sample) => [sample.tick, sha256(Buffer.from(sample.bytes))])),
  })),
};

await browser.close();
const coldLaunchesMs = [readyMs];
for (let run = 1; run < requestedColdRuns; run += 1) {
  const coldBrowser = await launchChrome();
  const coldContext = await coldBrowser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    colorScheme: "dark",
    reducedMotion: "reduce",
  });
  const coldPage = await coldContext.newPage();
  const coldStarted = performance.now();
  await coldPage.goto(`${baseUrl}&coldRun=${run + 1}`, { waitUntil: "domcontentloaded" });
  await coldPage.waitForFunction(() => Boolean(window.__COW_REVIEW__?.ready));
  await coldPage.evaluate(async () => window.__COW_REVIEW__.ready);
  coldLaunchesMs.push(Math.round((performance.now() - coldStarted) * 1000) / 1000);
  await coldBrowser.close();
}

let obstructionEvidence = null;
try {
  obstructionEvidence = JSON.parse(
    await readFile(resolve(outputRoot, "obstruction-evidence.json"), "utf8"),
  );
} catch {
  // The capture remains usable on its own; final validation runs the probe first.
}

const maximumObserved = captures.reduce((maximum, capture) => ({
  calls: Math.max(maximum.calls, capture.renderer.calls),
  triangles: Math.max(maximum.triangles, capture.renderer.triangles),
  textures: Math.max(maximum.textures, capture.renderer.textures),
  geometries: Math.max(maximum.geometries, capture.renderer.geometries),
}), { calls: 0, triangles: 0, textures: 0, geometries: 0 });
const limits = { calls: 100, triangles: 250000, textures: 32, geometries: 64 };
const framingGate =
  captures.every((capture) =>
    capture.framing.gates.playerHeight360To540 &&
    capture.framing.gates.actorsAndBladeInside80) &&
  captures.find((capture) => capture.id === "S04")?.framing.gates
    .contactInsideCentral40Percent === true;
const pngGate = captures.every((capture) =>
  capture.png.width === width &&
  capture.png.height === height &&
  capture.png.bitDepth === 8 &&
  capture.png.colorModel === "RGB");
const resourceGate = Object.entries(limits).every(
  ([key, limit]) => maximumObserved[key] <= limit,
);
const coldReady = {
  launchesMs: coldLaunchesMs,
  maximumMs: Math.max(...coldLaunchesMs),
  limitMs: 4109,
  passed: coldLaunchesMs.every((value) => value <= 4109),
};
const obstructionGate =
  obstructionEvidence?.wallOnBoom?.passed === true &&
  obstructionEvidence?.unobstructed?.passed === true;
const authoredAssetGate = captures.every((capture) =>
  capture.assetLoad.productionAuthored &&
  !capture.assetLoad.presentation.proceduralFallbackActive);

const receipt = {
  schema: "p30.round007.builder-b-camera-capture.v1",
  candidateOnly: true,
  acceptanceClaimed: false,
  headed: !headless,
  url: baseUrl,
  httpStatus: response?.status() ?? null,
  browser: browser.version(),
  node: process.version,
  readyMs,
  coldReadyLimitMs: 4109,
  coldReady,
  viewport: { width, height, dpr: 1 },
  runtime,
  captures,
  replayEvidence,
  obstructionEvidence,
  resourceCaps: { maximumObserved, limits, passed: resourceGate },
  gates: {
    rgb1600x900Dpr1: pngGate && runtime.dpr === 1,
    framing: framingGate,
    deterministicReplay: replayEvidence.byteIdentical,
    obstruction: obstructionGate,
    coldReady: coldReady.passed,
    resourceCaps: resourceGate,
    authoredAssetsNoFallback: authoredAssetGate,
  },
  errors,
};
const captureEvidenceText = `${JSON.stringify(receipt, null, 2)}\n`;
await writeFile(resolve(outputRoot, "capture-evidence.json"), captureEvidenceText);
const receiptSummary = {
  schema: "p30.round007.builder-b-camera-receipt.v1",
  candidateOnly: true,
  acceptanceClaimed: false,
  branch: "codex/r007-camera-builder-b",
  exactBaseline: "d95a0904151de6217838fcf6b69d3aba81e125ca",
  evidence: {
    capture: {
      path: relative(repoRoot, resolve(outputRoot, "capture-evidence.json")),
      sha256: sha256(Buffer.from(captureEvidenceText)),
    },
    obstruction: obstructionEvidence
      ? {
          path: relative(repoRoot, resolve(outputRoot, "obstruction-evidence.json")),
          sha256: sha256(await readFile(resolve(outputRoot, "obstruction-evidence.json"))),
        }
      : null,
  },
  gates: receipt.gates,
  allAutomatedCaptureGatesPassed: Object.values(receipt.gates).every(Boolean),
  visualAcceptanceClaimed: false,
};
await writeFile(
  resolve(outputRoot, "receipt.json"),
  `${JSON.stringify(receiptSummary, null, 2)}\n`,
);
console.log(JSON.stringify({
  headed: receipt.headed,
  readyMs,
  runtime,
  captures: captures.map(({ id, sha256: hash, png, framing, renderer }) => ({
    id, sha256: hash, png, framing, renderer,
  })),
  replayEvidence,
  coldReady,
  resourceCaps: receipt.resourceCaps,
  gates: receipt.gates,
  errors,
}, null, 2));
