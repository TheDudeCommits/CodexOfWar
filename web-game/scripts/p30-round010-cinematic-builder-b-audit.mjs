#!/usr/bin/env node

/* global Buffer, HTMLCanvasElement, PerformanceObserver, URL, console, document, navigator, performance, process, window */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { performance as nodePerformance } from "node:perf_hooks";
import { chromium } from "@playwright/test";
import * as THREE from "three";

const WIDTH = 1600;
const HEIGHT = 900;
const BASE_COMMIT = "ed9cc22717cac6c7c1933e85fa01d1808a38137d";
const REPO_ROOT = resolve(process.cwd(), "..");
const OUTPUT_ROOT = resolve(
  process.env.ROUND010_CINEMATIC_OUTPUT_ROOT ?? "../ArtSource/P30/Round010/BuilderB",
);
const BASE_URL =
  process.env.ROUND010_CINEMATIC_URL ??
  "http://127.0.0.1:4173/?review=1&post=0&framing=1";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const STABILITY_MS = Number(process.env.ROUND010_CINEMATIC_STABILITY_MS ?? 30_000);

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
const combatActions = [...forward, ...attack];

const standardScenarios = [
  {
    id: "S01",
    role: "standard",
    preset: "combat-tape-c",
    ticks: 120,
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
  { id: "S02", role: "standard", preset: "combat-idle", ticks: 23, actions: forward },
  {
    id: "S03",
    role: "standard",
    preset: "combat-startup",
    ticks: 29,
    actions: combatActions,
  },
  {
    id: "S04",
    role: "standard",
    preset: "combat-active-hit",
    ticks: 34,
    actions: combatActions,
  },
  {
    id: "S05",
    role: "standard",
    preset: "combat-recovery",
    ticks: 41,
    actions: combatActions,
  },
  {
    id: "S06",
    role: "standard",
    preset: "combat-dodge-side-offset",
    ticks: 37,
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

const focusedScenarios = [
  {
    id: "F29-startup",
    role: "focused",
    preset: "focused-startup",
    ticks: 29,
    actions: combatActions,
  },
  {
    id: "F34-impact",
    role: "focused",
    preset: "focused-impact",
    ticks: 34,
    actions: combatActions,
  },
  {
    id: "F41-recovery",
    role: "focused",
    preset: "focused-recovery",
    ticks: 41,
    actions: combatActions,
  },
];

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

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

function projectWorld(world, cameraTelemetry) {
  const camera = new THREE.PerspectiveCamera();
  camera.position.fromArray(cameraTelemetry.position);
  camera.quaternion.fromArray(cameraTelemetry.quaternion);
  camera.projectionMatrix.fromArray(cameraTelemetry.projectionMatrix);
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  camera.updateMatrixWorld(true);
  const projected = new THREE.Vector3(...world).project(camera);
  return {
    x: (projected.x + 1) * WIDTH * 0.5,
    y: (1 - projected.y) * HEIGHT * 0.5,
  };
}

function launchChrome() {
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

const runtimeMessages = {
  consoleErrors: [],
  consoleWarnings: [],
  pageErrors: [],
  requestFailures: [],
  httpErrors: [],
};
const observedAssetPaths = new Set();

function attachRuntimeObservers(page) {
  page.on("console", (message) => {
    if (message.type() === "error") runtimeMessages.consoleErrors.push(message.text());
    if (message.type() === "warning") runtimeMessages.consoleWarnings.push(message.text());
  });
  page.on("pageerror", (error) => runtimeMessages.pageErrors.push(String(error)));
  page.on("requestfailed", (request) => {
    runtimeMessages.requestFailures.push({
      path: new URL(request.url()).pathname,
      error: request.failure()?.errorText ?? null,
    });
  });
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.pathname.startsWith("/assets/")) observedAssetPaths.add(url.pathname);
    if (response.status() >= 400) {
      runtimeMessages.httpErrors.push({ path: url.pathname, status: response.status() });
    }
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
  attachRuntimeObservers(page);
  const started = nodePerformance.now();
  const response = await page.goto(`${BASE_URL}${suffix}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.__COW_REVIEW__?.ready));
  const readyReceipt = await page.evaluate(async () => window.__COW_REVIEW__.ready);
  const readyMs = Math.round((nodePerformance.now() - started) * 1000) / 1000;
  return { context, page, response, readyReceipt, readyMs };
}

async function captureScenario(page, scenario) {
  const telemetry = await page.evaluate(({ preset, ticks, actions }) => {
    const review = window.__COW_REVIEW__;
    review.reset({ piece: "P30", preset, seed: 30001 });
    review.queue(actions);
    for (let tick = 0; tick < ticks; tick += 1) review.stepTicks(1);
    review.renderOnce();
    return {
      review: review.telemetry(),
      pose: window.__COW_COMBAT_POSE__?.telemetry() ?? null,
      fx: {
        blade: window.__COW_BLADE_FX__?.telemetry() ?? null,
        contact: window.__COW_COMBAT_FX__?.telemetry() ?? null,
      },
    };
  }, scenario);
  const path = resolve(OUTPUT_ROOT, `${scenario.id}.png`);
  await page.screenshot({ path, type: "png", animations: "disabled" });
  const bytes = await readFile(path);
  return {
    id: scenario.id,
    role: scenario.role,
    processedTicks: scenario.ticks,
    file: relative(REPO_ROOT, path),
    bytes: bytes.length,
    sha256: sha256(bytes),
    png: parsePng(bytes),
    state: telemetry.review.state,
    events: telemetry.review.events,
    camera: telemetry.review.camera,
    framing: telemetry.review.framing,
    renderer: telemetry.review.renderer,
    assetLoad: telemetry.review.assetLoad,
    reviewErrors: telemetry.review.errors,
    pose: telemetry.pose,
    fx: telemetry.fx,
  };
}

await mkdir(OUTPUT_ROOT, { recursive: true });
const browser = await launchChrome();
const browserVersion = browser.version();
const main = await createReviewPage(browser, "&freshRun=main");
await main.page.bringToFront();

const runtimeProof = await main.page.evaluate(() => {
  const canvas = document.querySelector("canvas#game-canvas");
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error("game canvas missing");
  const gl = canvas.getContext("webgl2");
  if (!gl) throw new Error("WebGL2 context missing");
  const debug = gl.getExtension("WEBGL_debug_renderer_info");
  const rect = canvas.getBoundingClientRect();
  const navigation = performance.getEntriesByType("navigation")[0];
  return {
    location: { origin: window.location.origin, pathname: window.location.pathname },
    documentReadyState: document.readyState,
    performanceTimeOrigin: performance.timeOrigin,
    navigationType: navigation?.entryType ?? null,
    userAgent: navigator.userAgent,
    inner: { width: window.innerWidth, height: window.innerHeight },
    devicePixelRatio: window.devicePixelRatio,
    canvas: {
      connected: canvas.isConnected,
      css: { width: rect.width, height: rect.height },
      backing: { width: canvas.width, height: canvas.height },
    },
    webgl: {
      version: gl.getParameter(gl.VERSION),
      shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
      unmaskedVendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : null,
      unmaskedRenderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null,
    },
    auditApis: {
      review: Boolean(window.__COW_REVIEW__),
      pose: Boolean(window.__COW_COMBAT_POSE__),
      bladeFx: Boolean(window.__COW_BLADE_FX__),
      contactFx: Boolean(window.__COW_COMBAT_FX__),
    },
    scriptSources: [...document.scripts].map((script) => new URL(script.src).pathname),
  };
});

const standardCaptures = [];
for (const scenario of standardScenarios) {
  standardCaptures.push(await captureScenario(main.page, scenario));
}

const focusedCaptures = [];
const focusedReadyMs = [];
for (let index = 0; index < focusedScenarios.length; index += 1) {
  const focused = await createReviewPage(browser, `&freshRun=focus${index + 1}`);
  focusedReadyMs.push(focused.readyMs);
  focusedCaptures.push(await captureScenario(focused.page, focusedScenarios[index]));
  await focused.context.close();
}

const replayRuns = await main.page.evaluate(({ actions }) => {
  const sampleTicks = new Set([29, 34, 41]);
  const runs = [];
  for (let run = 0; run < 3; run += 1) {
    const review = window.__COW_REVIEW__;
    review.reset({ piece: "P30", preset: "pose-replay", seed: 30001 });
    review.queue(actions);
    const samples = [];
    for (let processedTicks = 1; processedTicks <= 41; processedTicks += 1) {
      review.stepTicks(1);
      if (!sampleTicks.has(processedTicks)) continue;
      samples.push({
        tick: processedTicks,
        bytes: JSON.stringify({
          state: review.snapshot(),
          camera: review.telemetry().camera,
          pose: window.__COW_COMBAT_POSE__?.telemetry() ?? null,
          bladeFx: window.__COW_BLADE_FX__?.telemetry() ?? null,
          contactFx: window.__COW_COMBAT_FX__?.telemetry() ?? null,
        }),
      });
    }
    runs.push(samples);
  }
  return runs;
}, { actions: combatActions });

const replay = {
  cleanResetRuns: 3,
  sampleTicks: [29, 34, 41],
  byteIdentical: [29, 34, 41].every((tick) => {
    const values = replayRuns.map(
      (run) => run.find((sample) => sample.tick === tick)?.bytes,
    );
    return values.every((value) => value === values[0]);
  }),
  hashesByRun: replayRuns.map((run, index) => ({
    run: index + 1,
    ticks: Object.fromEntries(
      run.map((sample) => [sample.tick, sha256(Buffer.from(sample.bytes))]),
    ),
  })),
};

const renderIdempotence = await main.page.evaluate(({ actions }) => {
  const results = [];
  for (const ticks of [29, 34, 41]) {
    const review = window.__COW_REVIEW__;
    review.reset({ piece: "P30", preset: "pose-idempotence", seed: 30001 });
    review.queue(actions);
    review.stepTicks(ticks);
    review.renderOnce();
    const before = JSON.stringify(window.__COW_COMBAT_POSE__?.telemetry() ?? null);
    review.renderOnce();
    review.renderOnce();
    const after = JSON.stringify(window.__COW_COMBAT_POSE__?.telemetry() ?? null);
    results.push({ tick: ticks, byteIdentical: before === after, sha256: sha256Text(after) });
  }
  return results;

  function sha256Text(value) {
    // A compact deterministic non-cryptographic browser digest; the Node-side
    // receipt records the cryptographic replay hashes above.
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }
}, { actions: combatActions });

const stabilityRaw = await main.page.evaluate(async (durationMs) => {
  const review = window.__COW_REVIEW__;
  review.reset({ piece: "P30", preset: "pose-stability", seed: 30001 });
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
  meanFps: Math.round(
    (1000 /
      (stabilityRaw.intervals.reduce((sum, value) => sum + value, 0) /
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

const contextLossRestore = await main.page.evaluate(async () => {
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

await main.context.close();
await browser.close();

const allCaptures = [...standardCaptures, ...focusedCaptures];
const byId = Object.fromEntries(allCaptures.map((capture) => [capture.id, capture]));
const s03 = byId.S03;
const s04 = byId.S04;
const s05 = byId.S05;
const f29 = byId["F29-startup"];
const f34 = byId["F34-impact"];
const f41 = byId["F41-recovery"];
const contactFxPixels = projectWorld(s04.fx.contact.contactWorld, s04.camera);
const contactProjection = {
  fx: contactFxPixels,
  authoredBladeMarker: { x: s04.framing.contact.x, y: s04.framing.contact.y },
  errorPx: Math.hypot(
    contactFxPixels.x - s04.framing.contact.x,
    contactFxPixels.y - s04.framing.contact.y,
  ),
  limitPx: 24,
};
const impactBlade = new THREE.Vector3(...s04.pose.hero.anchors.bladeContactWorld);
const impactTarget = new THREE.Vector3(...s04.pose.target.anchors.impactWorld);
const impactFx = new THREE.Vector3(...s04.fx.contact.contactWorld);
const cameraToImpact = new THREE.Vector3(...s04.camera.position)
  .sub(impactBlade)
  .normalize();
const impactFaceNormal = new THREE.Vector3(
  ...s04.pose.hero.anchors.bladeFaceNormalWorld,
);
const exteriorContact = {
  bladeMarkerToFxMeters: impactBlade.distanceTo(impactFx),
  bladeMarkerAheadOfTargetCenterMeters: impactBlade.z - impactTarget.z,
  bladeFaceToViewAbsoluteDot: Math.abs(cameraToImpact.dot(impactFaceNormal)),
  weaponAxialRoll: s04.pose.hero.sample.presentation.weaponAxialRoll,
  limits: {
    bladeMarkerToFxMeters: 0.065,
    bladeMarkerAheadOfTargetCenterMeters: 0.3,
    bladeFaceToViewAbsoluteDot: 0.25,
  },
};
const startupBladePixels = projectWorld(
  s03.pose.hero.anchors.bladeContactWorld,
  s03.camera,
);
const impactBladePixels = projectWorld(
  s04.pose.hero.anchors.bladeContactWorld,
  s04.camera,
);
const recoveryBladePixels = projectWorld(
  s05.pose.hero.anchors.bladeContactWorld,
  s05.camera,
);
const impactTargetPixels = projectWorld(
  s04.pose.target.anchors.impactWorld,
  s04.camera,
);
const recoveryTargetPixels = projectWorld(
  s05.pose.target.anchors.impactWorld,
  s05.camera,
);
const approachPixels = {
  x: impactBladePixels.x - startupBladePixels.x,
  y: impactBladePixels.y - startupBladePixels.y,
};
const overshootPixels = {
  x: recoveryBladePixels.x - impactBladePixels.x,
  y: recoveryBladePixels.y - impactBladePixels.y,
};
const targetRecoilPixels = {
  x: recoveryTargetPixels.x - impactTargetPixels.x,
  y: recoveryTargetPixels.y - impactTargetPixels.y,
};
const approachLength = Math.hypot(approachPixels.x, approachPixels.y);
const overshootLength = Math.hypot(overshootPixels.x, overshootPixels.y);
const overshootCosine =
  (approachPixels.x * overshootPixels.x + approachPixels.y * overshootPixels.y) /
  (approachLength * overshootLength);
const feet = ["leftFootWorld", "rightFootWorld"].map((anchor) => {
  const impact = new THREE.Vector3(...s04.pose.hero.anchors[anchor]);
  const recovery = new THREE.Vector3(...s05.pose.hero.anchors[anchor]);
  return {
    anchor,
    verticalDriftMeters: Math.abs(recovery.y - impact.y),
    planarDriftMeters: Math.hypot(recovery.x - impact.x, recovery.z - impact.z),
  };
});
const brakingRecovery = {
  approachPixels,
  overshootPixels,
  targetRecoilPixels,
  overshootLengthPixels: overshootLength,
  approachToOvershootCosine: overshootCosine,
  targetRecoilDotOvershoot:
    targetRecoilPixels.x * overshootPixels.x +
    targetRecoilPixels.y * overshootPixels.y,
  recoveryBladeTipY: s05.pose.hero.anchors.bladeTipWorld[1],
  recoveryTargetHeadY: s05.pose.target.anchors.headWorld[1],
  playbackSeconds: s05.pose.hero.sample.presentation.authoredAnimationSeconds,
  sameDirection01: s05.pose.hero.sample.presentation.sameDirection01,
  feet,
  limits: {
    overshootLengthPixels: 75,
    approachToOvershootCosine: 0.7,
    bladeTipBelowTargetHeadMeters: 0.2,
    footVerticalDriftMeters: 0.025,
    footPlanarDriftMeters: 0.12,
  },
};

const maximumObserved = allCaptures.reduce(
  (maximum, capture) => ({
    calls: Math.max(maximum.calls, capture.renderer.calls),
    triangles: Math.max(maximum.triangles, capture.renderer.triangles),
    textures: Math.max(maximum.textures, capture.renderer.textures),
    geometries: Math.max(maximum.geometries, capture.renderer.geometries),
  }),
  { calls: 0, triangles: 0, textures: 0, geometries: 0 },
);
const limits = { calls: 100, triangles: 250000, textures: 32, geometries: 64 };
const resourceCapsPassed = Object.entries(limits).every(
  ([key, limit]) => maximumObserved[key] <= limit,
);
const expectedWarningPattern =
  /context (lost|restored)|deprecated parameters|RGBELoader has been deprecated|PCFSoftShadowMap has been deprecated/i;
const expectedKnownWarnings = runtimeMessages.consoleWarnings.filter((message) =>
  expectedWarningPattern.test(message),
);
const unexpectedWarnings = runtimeMessages.consoleWarnings.filter(
  (message) => !expectedWarningPattern.test(message),
);
const runtimeErrorsZero =
  runtimeMessages.consoleErrors.length === 0 &&
  runtimeMessages.pageErrors.length === 0 &&
  runtimeMessages.requestFailures.length === 0 &&
  runtimeMessages.httpErrors.length === 0 &&
  allCaptures.every(
    (capture) => capture.reviewErrors.length === 0 && capture.renderer.errors.length === 0,
  );

const pngContract = allCaptures.every(
  (capture) =>
    capture.png.width === WIDTH &&
    capture.png.height === HEIGHT &&
    capture.png.bitDepth === 8 &&
    capture.png.colorType === 2 &&
    capture.png.interlace === 0 &&
    capture.png.forbiddenMetadata.length === 0,
);
const authoredAssets = allCaptures.every(
  (capture) =>
    capture.assetLoad.registry.enabled.length === 18 &&
    capture.assetLoad.registry.loaded.length === 18 &&
    capture.assetLoad.registry.failures.length === 0 &&
    capture.assetLoad.productionAuthored &&
    !capture.assetLoad.presentation.proceduralFallbackActive,
);
const focusedFraming = [s03, s04, s05, f29, f34, f41].every(
  (capture) =>
    capture.framing.gates.playerHeight360To540 &&
    capture.framing.gates.actorsAndBladeInside80,
);
const lifecyclePreserved =
  s03.fx.blade.phase === "absent" &&
  s03.fx.contact.phase === "absent" &&
  s04.fx.blade.phase === "peak" &&
  s04.fx.contact.phase === "peak" &&
  s05.fx.blade.phase === "absent" &&
  s05.fx.contact.phase === "dissipated" &&
  !s05.fx.contact.active;
const exactMechanics =
  s03.state.player.attackFrame === 5 &&
  s04.state.player.attackFrame === 10 &&
  s05.state.player.attackFrame === 17 &&
  s04.events.some(
    (event) =>
      event.tick === 33 &&
      event.type === "enemy_hit" &&
      event.damage === 10 &&
      event.hpBefore === 100 &&
      event.hpAfter === 90,
  );
const poseContract =
  s03.pose.hero.sample.phase === "anticipation" &&
  s04.pose.hero.sample.phase === "contact" &&
  s05.pose.hero.sample.phase === "recoil" &&
  s04.pose.target.sample.phase === "compression" &&
  s05.pose.target.sample.phase === "recoil" &&
  [s03, s04, s05].every(
    (capture) =>
      Object.values(capture.pose.hero.rigBindings).every(Boolean) &&
      Object.values(capture.pose.target.rigBindings).every(Boolean) &&
      capture.pose.hero.weaponParent === "weapon_socket" &&
      capture.pose.hero.supportHandToSecondaryGripMeters <= 0.00001,
  ) &&
  s03.pose.hero.sample.model.position[1] <= -0.05 &&
  s05.pose.target.sample.model.position[2] >= 0.09;
const exteriorContactPassed =
  exteriorContact.bladeMarkerToFxMeters <=
    exteriorContact.limits.bladeMarkerToFxMeters &&
  exteriorContact.bladeMarkerAheadOfTargetCenterMeters >=
    exteriorContact.limits.bladeMarkerAheadOfTargetCenterMeters &&
  exteriorContact.bladeFaceToViewAbsoluteDot <=
    exteriorContact.limits.bladeFaceToViewAbsoluteDot &&
  exteriorContact.weaponAxialRoll === -0.43;
const brakingRecoveryPassed =
  brakingRecovery.overshootLengthPixels >=
    brakingRecovery.limits.overshootLengthPixels &&
  brakingRecovery.approachToOvershootCosine >=
    brakingRecovery.limits.approachToOvershootCosine &&
  brakingRecovery.targetRecoilDotOvershoot > 0 &&
  brakingRecovery.recoveryBladeTipY <=
    brakingRecovery.recoveryTargetHeadY -
      brakingRecovery.limits.bladeTipBelowTargetHeadMeters &&
  brakingRecovery.playbackSeconds <= 0.2 &&
  brakingRecovery.sameDirection01 === 1 &&
  brakingRecovery.feet.every(
    (foot) =>
      foot.verticalDriftMeters <=
        brakingRecovery.limits.footVerticalDriftMeters &&
      foot.planarDriftMeters <= brakingRecovery.limits.footPlanarDriftMeters,
  );
const focusedDuplicateHashes =
  s03.sha256 === f29.sha256 && s04.sha256 === f34.sha256 && s05.sha256 === f41.sha256;
const focusedCameraIdentical =
  JSON.stringify(s03.camera) === JSON.stringify(f29.camera) &&
  JSON.stringify(s04.camera) === JSON.stringify(f34.camera) &&
  JSON.stringify(s05.camera) === JSON.stringify(f41.camera);
const focusedWorldPoseIdentical =
  JSON.stringify({ world: s03.state.state, pose: s03.pose }) ===
    JSON.stringify({ world: f29.state.state, pose: f29.pose }) &&
  JSON.stringify({ world: s04.state.state, pose: s04.pose }) ===
    JSON.stringify({ world: f34.state.state, pose: f34.pose }) &&
  JSON.stringify({ world: s05.state.state, pose: s05.pose }) ===
    JSON.stringify({ world: f41.state.state, pose: f41.pose });

const poseTelemetry = {
  schema: "p30.round010.builder-b.pose-telemetry.v1",
  baseCommit: BASE_COMMIT,
  candidateOnly: true,
  acceptanceClaimed: false,
  focused: [s03, s04, s05].map((capture) => ({
    tick: capture.processedTicks,
    state: capture.state,
    events: capture.events,
    pose: capture.pose,
    framing: capture.framing,
    fx: capture.fx,
  })),
  replay,
  renderIdempotence,
  contactProjection,
  exteriorContact,
  brakingRecovery,
  focusedImageComparison: {
    byteIdentical: focusedDuplicateHashes,
    standard: { tick29: s03.sha256, tick34: s04.sha256, tick41: s05.sha256 },
    cleanFocused: { tick29: f29.sha256, tick34: f34.sha256, tick41: f41.sha256 },
    note: "Focused captures use fresh pages; HUD engagement history may differ while world, pose, and camera remain exact.",
  },
  gates: {
    exactMechanics,
    anticipationContactRecoil: poseContract,
    narrowExteriorContact: exteriorContactPassed,
    sameDirectionBrakingRecovery: brakingRecoveryPassed,
    repeatedRenderByteIdentical: renderIdempotence.every((sample) => sample.byteIdentical),
    cleanReplayByteIdentical: replay.byteIdentical,
    focusedCameraIdentical,
    focusedWorldPoseIdentical,
    authoredBladeContactWithin24Px: contactProjection.errorPx <= 24,
  },
};

const runtimeTelemetry = {
  schema: "p30.round010.builder-b.runtime-telemetry.v1",
  baseCommit: BASE_COMMIT,
  candidateOnly: true,
  acceptanceClaimed: false,
  node: process.version,
  headed: true,
  browserVersion,
  httpStatus: main.response?.status() ?? null,
  ready: { mainMs: main.readyMs, focusedMs: focusedReadyMs, receipt: main.readyReceipt },
  freshActualGameRun: runtimeProof,
  observedAssetPaths: [...observedAssetPaths].sort(),
  resourceCaps: { maximumObserved, limits, passed: resourceCapsPassed },
  stability,
  contextLossRestore,
  runtimeMessages: {
    ...runtimeMessages,
    expectedKnownWarnings,
    unexpectedWarnings,
  },
  gates: {
    headedChromeWebGL2Metal:
      String(runtimeProof.webgl.version).includes("WebGL 2") &&
      String(runtimeProof.webgl.unmaskedRenderer).toLowerCase().includes("metal"),
    cssBackingViewportDpr1:
      runtimeProof.inner.width === WIDTH &&
      runtimeProof.inner.height === HEIGHT &&
      runtimeProof.devicePixelRatio === 1 &&
      runtimeProof.canvas.css.width === WIDTH &&
      runtimeProof.canvas.css.height === HEIGHT &&
      runtimeProof.canvas.backing.width === WIDTH &&
      runtimeProof.canvas.backing.height === HEIGHT,
    auditApisReady: Object.values(runtimeProof.auditApis).every(Boolean),
    authoredAssets18Of18NoFallback: authoredAssets,
    runtimeErrorsZero,
    unexpectedWarningsZero: unexpectedWarnings.length === 0,
    resourceCaps: resourceCapsPassed,
    thirtySecondStable:
      stability.durationMs >= STABILITY_MS &&
      !stability.resourceGrowth &&
      stability.webglError === 0,
    contextLossRestore: contextLossRestore.passed,
  },
};

const receipt = {
  schema: "p30.round010.builder-b.capture-receipt.v1",
  baseCommit: BASE_COMMIT,
  branch: "codex/p30-r010-cinematic-builder",
  candidateOnly: true,
  acceptanceClaimed: false,
  headed: true,
  viewport: { width: WIDTH, height: HEIGHT, dpr: 1 },
  captures: allCaptures,
  runtimeTelemetryFile: "ArtSource/P30/Round010/BuilderB/runtime-telemetry.json",
  poseTelemetryFile: "ArtSource/P30/Round010/BuilderB/pose-telemetry.json",
  gates: {
    nineActualGameCaptures: allCaptures.length === 9,
    exactRgbPng1600x900: pngContract,
    standardSix: standardCaptures.length === 6,
    focusedTicks29_34_41:
      focusedCaptures.map((capture) => capture.processedTicks).join(",") === "29,34,41",
    focusedFraming,
    focusedWorldPoseCameraByteIdentical:
      focusedWorldPoseIdentical && focusedCameraIdentical,
    exactMechanics,
    cameraSourceAndTelemetryFrozen: focusedCameraIdentical,
    round008FxLifecyclePreserved: lifecyclePreserved,
    poseContract,
    narrowExteriorContact: exteriorContactPassed,
    sameDirectionBrakingRecovery: brakingRecoveryPassed,
    replayByteIdentical: replay.byteIdentical,
    repeatedRenderByteIdentical: renderIdempotence.every((sample) => sample.byteIdentical),
    authoredBladeContactWithin24Px: contactProjection.errorPx <= 24,
    authoredAssets18Of18NoFallback: authoredAssets,
    runtimeErrorsZero,
    resourceCaps: resourceCapsPassed,
    thirtySecondStable: runtimeTelemetry.gates.thirtySecondStable,
    contextLossRestore: contextLossRestore.passed,
  },
};

await writeFile(
  resolve(OUTPUT_ROOT, "pose-telemetry.json"),
  `${JSON.stringify(poseTelemetry, null, 2)}\n`,
);
await writeFile(
  resolve(OUTPUT_ROOT, "runtime-telemetry.json"),
  `${JSON.stringify(runtimeTelemetry, null, 2)}\n`,
);
await writeFile(
  resolve(OUTPUT_ROOT, "capture-receipt.json"),
  `${JSON.stringify(receipt, null, 2)}\n`,
);

const failedGates = Object.entries(receipt.gates)
  .filter(([, passed]) => !passed)
  .map(([gate]) => gate);
console.log(
  JSON.stringify(
    {
      output: relative(REPO_ROOT, resolve(OUTPUT_ROOT, "capture-receipt.json")),
      captures: allCaptures.map(({ id, sha256: hash }) => ({ id, sha256: hash })),
      failedGates,
    },
    null,
    2,
  ),
);
if (failedGates.length > 0) process.exitCode = 1;
