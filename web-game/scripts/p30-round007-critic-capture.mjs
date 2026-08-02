#!/usr/bin/env node

/* global Buffer, HTMLCanvasElement, PerformanceObserver, console, document, navigator, process, window */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { chromium } from "@playwright/test";

const WIDTH = 1600;
const HEIGHT = 900;
const REPO_ROOT = resolve(process.cwd(), "..");
const OUTPUT_ROOT = resolve(
  process.env.ROUND007_CRITIC_OUTPUT_ROOT ?? "../ArtSource/P30/Round007/Critic",
);
const BASE_URL =
  process.env.ROUND007_CRITIC_URL ??
  "http://127.0.0.1:4173/?review=1&post=0&framing=1";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const STABILITY_MS = Number(process.env.ROUND007_STABILITY_MS ?? 30_000);

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
    description: "backward traversal ticks 0-59 with camera reset at tick 72",
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
    phase: "startup",
    description: "attack startup at processed tick 29",
    actions: [...forward, ...attack],
  },
  {
    id: "S04",
    preset: "combat-active-hit",
    ticks: 34,
    phase: "active contact",
    description: "active contact after the tick-33 enemy hit",
    actions: [...forward, ...attack],
  },
  {
    id: "S05",
    preset: "combat-recovery",
    ticks: 41,
    phase: "recovery",
    description: "recovery and target reaction aftermath",
    actions: [...forward, ...attack],
  },
  {
    id: "S06",
    preset: "combat-dodge-side-offset",
    ticks: 37,
    description: "right side-offset ticks 20-28 with dodge at tick 28",
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

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function parsePng(bytes) {
  if (bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
    throw new Error("capture is not a PNG");
  }
  let offset = 8;
  const chunks = [];
  let width = null;
  let height = null;
  let bitDepth = null;
  let colorType = null;
  let interlace = null;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString("ascii");
    chunks.push(type);
    if (type === "IHDR") {
      width = bytes.readUInt32BE(offset + 8);
      height = bytes.readUInt32BE(offset + 12);
      bitDepth = bytes[offset + 16];
      colorType = bytes[offset + 17];
      interlace = bytes[offset + 20];
    }
    offset += length + 12;
    if (type === "IEND") break;
  }
  return {
    width,
    height,
    bitDepth,
    colorType,
    colorModel: colorType === 2 ? "RGB" : colorType === 6 ? "RGBA" : "other",
    interlace,
    chunks,
    forbiddenMetadata: chunks.filter((chunk) =>
      ["tEXt", "zTXt", "iTXt", "eXIf"].includes(chunk),
    ),
  };
}

function percentile(sorted, fraction) {
  if (sorted.length === 0) return null;
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1);
  return Math.round(sorted[index] * 1000) / 1000;
}

async function launchChrome() {
  return chromium.launch({
    executablePath: CHROME,
    headless: false,
    args: [
      "--use-angle=metal",
      "--enable-gpu",
      "--disable-software-rasterizer",
      "--force-device-scale-factor=1",
      `--window-size=${WIDTH},${HEIGHT}`,
      "--window-position=0,0",
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
    ],
  });
}

async function createReviewPage(browser, suffix = "") {
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
    colorScheme: "dark",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const started = performance.now();
  const response = await page.goto(`${BASE_URL}${suffix}`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(() => Boolean(window.__COW_REVIEW__?.ready));
  const readyReceipt = await page.evaluate(async () => window.__COW_REVIEW__.ready);
  const readyMs = Math.round((performance.now() - started) * 1000) / 1000;
  return { context, page, response, readyReceipt, readyMs };
}

async function captureScenario(page, scenario) {
  const telemetry = await page.evaluate(({ preset, ticks, actions }) => {
    const review = window.__COW_REVIEW__;
    review.reset({ piece: "P30", preset, seed: 30001 });
    review.queue(actions);
    for (let tick = 0; tick < ticks; tick += 1) review.stepTicks(1);
    review.renderOnce();
    return review.telemetry();
  }, scenario);
  const path = resolve(OUTPUT_ROOT, `${scenario.id}.png`);
  await page.screenshot({ path, type: "png", animations: "disabled" });
  const bytes = await readFile(path);
  return {
    id: scenario.id,
    file: relative(REPO_ROOT, path),
    phase: scenario.phase ?? null,
    description: scenario.description,
    processedTicks: scenario.ticks,
    bytes: bytes.length,
    sha256: sha256(bytes),
    png: parsePng(bytes),
    state: telemetry.state,
    events: telemetry.events,
    camera: telemetry.camera,
    cameraObstruction: telemetry.cameraObstruction,
    framing: telemetry.framing,
    renderer: telemetry.renderer,
    assetLoad: telemetry.assetLoad,
    reviewErrors: telemetry.errors,
  };
}

await mkdir(OUTPUT_ROOT, { recursive: true });

const browser = await launchChrome();
const { context, page, response, readyReceipt, readyMs } = await createReviewPage(browser);
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
page.on("response", (browserResponse) => {
  if (browserResponse.status() >= 400) {
    errors.http.push({ url: browserResponse.url(), status: browserResponse.status() });
  }
});
await page.bringToFront();

const platform = await page.evaluate(() => {
  const canvas = document.querySelector("canvas#game-canvas");
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error("game canvas missing");
  const gl = canvas.getContext("webgl2");
  if (!gl) throw new Error("WebGL2 context missing");
  const debug = gl.getExtension("WEBGL_debug_renderer_info");
  const rect = canvas.getBoundingClientRect();
  return {
    userAgent: navigator.userAgent,
    inner: { width: window.innerWidth, height: window.innerHeight },
    devicePixelRatio: window.devicePixelRatio,
    canvasCss: { width: rect.width, height: rect.height },
    canvasBacking: { width: canvas.width, height: canvas.height },
    webglVersion: gl.getParameter(gl.VERSION),
    webglVendor: gl.getParameter(gl.VENDOR),
    webglRenderer: gl.getParameter(gl.RENDERER),
    unmaskedVendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : null,
    unmaskedRenderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null,
  };
});

const captures = [];
for (const scenario of scenarios) captures.push(await captureScenario(page, scenario));

const replaySamples = await page.evaluate(({ actions }) => {
  const sampleTicks = new Set([29, 34, 41, 60]);
  const runs = [];
  for (let run = 0; run < 3; run += 1) {
    const review = window.__COW_REVIEW__;
    review.reset({ piece: "P30", preset: "camera-replay", seed: 30001 });
    review.queue(actions);
    const samples = [];
    for (let processedTicks = 1; processedTicks <= 60; processedTicks += 1) {
      review.stepTicks(1);
      if (sampleTicks.has(processedTicks)) {
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

const replay = {
  cleanResetRuns: replaySamples.length,
  sampleTicks: [29, 34, 41, 60],
  byteIdentical: [29, 34, 41, 60].every((tick) => {
    const values = replaySamples.map(
      (run) => run.find((sample) => sample.tick === tick)?.bytes,
    );
    return values.every((value) => value === values[0]);
  }),
  hashesByRun: replaySamples.map((run, index) => ({
    run: index + 1,
    ticks: Object.fromEntries(
      run.map((sample) => [sample.tick, sha256(Buffer.from(sample.bytes))]),
    ),
  })),
};

const stabilityRaw = await page.evaluate(async (durationMs) => {
  const review = window.__COW_REVIEW__;
  review.reset({ piece: "P30", preset: "stability", seed: 30001 });
  const before = review.telemetry().renderer;
  const intervals = [];
  const longTasks = [];
  let observer = null;
  if (typeof PerformanceObserver !== "undefined") {
    observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) longTasks.push(entry.duration);
    });
    try {
      observer.observe({ type: "longtask", buffered: true });
    } catch {
      observer = null;
    }
  }
  const started = performance.now();
  let previous = null;
  await new Promise((resolvePromise) => {
    const frame = (now) => {
      if (previous !== null) intervals.push(now - previous);
      previous = now;
      review.renderOnce();
      if (now - started >= durationMs) resolvePromise();
      else window.requestAnimationFrame(frame);
    };
    window.requestAnimationFrame(frame);
  });
  observer?.disconnect();
  const after = review.telemetry().renderer;
  const canvas = document.querySelector("canvas#game-canvas");
  const gl = canvas instanceof HTMLCanvasElement ? canvas.getContext("webgl2") : null;
  return {
    durationMs: performance.now() - started,
    intervals,
    longTasks,
    before,
    after,
    webglError: gl?.getError() ?? null,
  };
}, STABILITY_MS);
const sortedIntervals = [...stabilityRaw.intervals].sort((a, b) => a - b);
const sortedLongTasks = [...stabilityRaw.longTasks].sort((a, b) => a - b);
const stability = {
  durationMs: Math.round(stabilityRaw.durationMs * 1000) / 1000,
  frameCount: stabilityRaw.intervals.length,
  meanFps:
    Math.round(
      (1000 / (stabilityRaw.intervals.reduce((sum, value) => sum + value, 0) /
        stabilityRaw.intervals.length)) *
        1000,
    ) / 1000,
  p95RafMs: percentile(sortedIntervals, 0.95),
  p99RafMs: percentile(sortedIntervals, 0.99),
  maxRafMs: percentile(sortedIntervals, 1),
  framesOver25Ms: stabilityRaw.intervals.filter((value) => value > 25).length,
  longTaskCount: sortedLongTasks.length,
  longTaskMaxMs: percentile(sortedLongTasks, 1),
  rendererBefore: stabilityRaw.before,
  rendererAfter: stabilityRaw.after,
  resourceGrowth:
    stabilityRaw.after.geometries !== stabilityRaw.before.geometries ||
    stabilityRaw.after.textures !== stabilityRaw.before.textures,
  webglError: stabilityRaw.webglError,
};

const contextLossRestore = await page.evaluate(async () => {
  const review = window.__COW_REVIEW__;
  const supported = review.forceContextLoss();
  if (!supported) return { supported: false, passed: false, renderer: review.telemetry().renderer };
  const waitUntil = async (predicate, timeoutMs = 5000) => {
    const started = performance.now();
    while (!predicate()) {
      if (performance.now() - started > timeoutMs) throw new Error("context lifecycle timeout");
      await new Promise((resolvePromise) => window.setTimeout(resolvePromise, 20));
    }
  };
  await waitUntil(() => review.telemetry().renderer.context.lost);
  const restoreRequested = review.forceContextRestore();
  await waitUntil(() => {
    const lifecycle = review.telemetry().renderer.context;
    return !lifecycle.lost && lifecycle.restores >= 1;
  });
  const renderer = review.telemetry().renderer;
  return {
    supported,
    restoreRequested,
    passed:
      renderer.context.losses === 1 &&
      renderer.context.restores === 1 &&
      !renderer.context.lost &&
      renderer.errors.length === 0,
    renderer,
  };
});

await context.close();
await browser.close();

const coldLaunchesMs = [readyMs];
for (let run = 2; run <= 3; run += 1) {
  const coldBrowser = await launchChrome();
  const cold = await createReviewPage(coldBrowser, `&coldRun=${run}`);
  coldLaunchesMs.push(cold.readyMs);
  await cold.context.close();
  await coldBrowser.close();
}

let obstructionEvidence = null;
try {
  obstructionEvidence = JSON.parse(
    await readFile(resolve(OUTPUT_ROOT, "obstruction-evidence.json"), "utf8"),
  );
} catch {
  // The separate deterministic probe is mandatory in the final audit.
}

const maximumObserved = captures.reduce(
  (maximum, capture) => ({
    calls: Math.max(maximum.calls, capture.renderer.calls),
    triangles: Math.max(maximum.triangles, capture.renderer.triangles),
    textures: Math.max(maximum.textures, capture.renderer.textures),
    geometries: Math.max(maximum.geometries, capture.renderer.geometries),
  }),
  { calls: 0, triangles: 0, textures: 0, geometries: 0 },
);
const limits = { calls: 100, triangles: 250000, textures: 32, geometries: 64 };
const pngContract = captures.every(
  (capture) =>
    capture.png.width === WIDTH &&
    capture.png.height === HEIGHT &&
    capture.png.bitDepth === 8 &&
    capture.png.colorType === 2 &&
    capture.png.interlace === 0 &&
    capture.png.forbiddenMetadata.length === 0,
);
const surfaceContract =
  platform.inner.width === WIDTH &&
  platform.inner.height === HEIGHT &&
  platform.devicePixelRatio === 1 &&
  platform.canvasCss.width === WIDTH &&
  platform.canvasCss.height === HEIGHT &&
  platform.canvasBacking.width === WIDTH &&
  platform.canvasBacking.height === HEIGHT;
const framingContract =
  captures
    .filter((capture) => ["S03", "S04", "S05"].includes(capture.id))
    .every(
      (capture) =>
        capture.framing?.gates?.playerHeight360To540 === true &&
        capture.framing?.gates?.actorsAndBladeInside80 === true,
    ) &&
  captures.find((capture) => capture.id === "S04")?.framing?.gates
    ?.contactInsideCentral40Percent === true;
const resourceContract = Object.entries(limits).every(
  ([key, limit]) => maximumObserved[key] <= limit,
);
const assetContract = captures.every(
  (capture) =>
    capture.assetLoad?.registry?.enabled?.length === 18 &&
    capture.assetLoad?.registry?.loaded?.length === 18 &&
    capture.assetLoad?.registry?.failures?.length === 0 &&
    capture.assetLoad?.productionAuthored === true &&
    capture.assetLoad?.presentation?.proceduralFallbackActive === false,
);
const coldReady = {
  launchesMs: coldLaunchesMs,
  maximumMs: Math.max(...coldLaunchesMs),
  limitMs: 4109,
  passed: coldLaunchesMs.every((value) => value <= 4109),
};

const receipt = {
  schema: "p30.round007.independent-critic-technical-receipt.v1",
  candidateCommit: "6b953f563c68a81f4635aaa081bfeb664f3aee57",
  candidateOnly: true,
  acceptanceClaimed: false,
  node: process.version,
  headed: true,
  productionUrl: "http://127.0.0.1:4173/?review=1&post=0&framing=1",
  httpStatus: response?.status() ?? null,
  browserVersion: browser.version(),
  readyReceipt,
  coldReady,
  platform,
  captures,
  replay,
  obstructionEvidence,
  stability,
  contextLossRestore,
  resourceCaps: { maximumObserved, limits, passed: resourceContract },
  gates: {
    exactRgbPng1600x900: pngContract,
    cssBackingViewportDpr1: surfaceContract,
    webgl2Metal:
      String(platform.webglVersion).includes("WebGL 2") &&
      String(platform.unmaskedRenderer).toLowerCase().includes("metal"),
    authoredAssetsNoFallback: assetContract,
    focusedFraming: framingContract,
    replayByteIdentical: replay.byteIdentical,
    obstruction:
      obstructionEvidence?.wallOnBoom?.passed === true &&
      obstructionEvidence?.unobstructed?.passed === true,
    coldReady: coldReady.passed,
    resourceCaps: resourceContract,
    thirtySecondResourceStable:
      stability.durationMs >= STABILITY_MS &&
      !stability.resourceGrowth &&
      stability.webglError === 0,
    webglLossRestore: contextLossRestore.passed,
  },
  errors,
};

const output = resolve(OUTPUT_ROOT, "technical-receipt.json");
await writeFile(output, `${JSON.stringify(receipt, null, 2)}\n`);
console.log(
  JSON.stringify(
    {
      output: relative(REPO_ROOT, output),
      browserVersion: receipt.browserVersion,
      platform,
      coldReady,
      captures: captures.map(({ id, sha256: hash, png, framing, renderer }) => ({
        id,
        sha256: hash,
        png,
        framing,
        renderer,
      })),
      replay,
      stability,
      contextLossRestore,
      gates: receipt.gates,
      errors,
    },
    null,
    2,
  ),
);
