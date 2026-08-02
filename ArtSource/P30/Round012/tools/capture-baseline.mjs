#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  stat,
  writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PROTOCOL_ID,
  canonicalBytes,
  canonicalize,
  compareUtf8,
  fileSha256,
  sha256Bytes
} from './baseline-core.mjs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ROUTE = '/?scenario=P30-light-strike-v1&seed=30011';
const VIEWPORT = { width: 1600, height: 900 };
const CAPTURE_TICKS = Object.freeze({
  neutral: [0, 24, 46, 58, 80],
  lightStrike: [0, 24, 34, 41, 58, 80]
});

function fail(code, detail = '') {
  const error = new Error(detail ? `${code}: ${detail}` : code);
  error.code = code;
  throw error;
}

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value === undefined) fail('INVALID_ARGUMENTS');
    values[key.slice(2)] = value;
  }
  for (const required of ['url-origin', 'runtime-root', 'repository', 'out', 'source-commit', 'source-tree', 'output-tree']) {
    if (!values[required]) fail('MISSING_ARGUMENT', required);
  }
  if (!/^http:\/\/127\.0\.0\.1:\d+$/u.test(values['url-origin'])) fail('INVALID_URL_ORIGIN');
  if (!/^[0-9a-f]{40}$/u.test(values['source-commit'])) fail('INVALID_SOURCE_COMMIT');
  for (const field of ['source-tree', 'output-tree']) {
    if (!/^[0-9a-f]{64}$/u.test(values[field])) fail('INVALID_TREE_DIGEST');
  }
  return values;
}

function assertInside(root, child, code) {
  const path = relative(resolve(root), resolve(child));
  if (!path || path === '..' || path.startsWith(`..${sep}`) || isAbsolute(path)) fail(code);
}

async function pathExists(path) {
  try {
    await lstat(path);
    return true;
  } catch {
    return false;
  }
}

function quantize(value) {
  const quantized = Math.round(value * 1_000_000);
  if (!Number.isSafeInteger(quantized)) fail('UNSAFE_QUANTIZED_VALUE');
  return Object.is(quantized, -0) ? 0 : quantized;
}

function quantizeCamera(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return value;
  if (typeof value === 'number') return quantize(value);
  if (Array.isArray(value)) return value.map(quantizeCamera);
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) {
    fail('INVALID_CAMERA_VALUE');
  }
  return Object.fromEntries(Object.keys(value).map((key) => [key, quantizeCamera(value[key])]));
}

function cameraDigest(entry) {
  const quantized = {
    absoluteSimulationTick: entry.absoluteSimulationTick,
    positionMicrometres: entry.position.map(quantize),
    quaternionMillionths: entry.quaternion.map(quantize),
    projectionMatrixMillionths: entry.projectionMatrix.map(quantize),
    viewMatrixMillionths: entry.viewMatrix.map(quantize)
  };
  return sha256Bytes(canonicalBytes(quantized));
}

function assertCompleteTickSequence(entries, label, firstTick = 0, lastTick = 80) {
  const expectedCount = lastTick - firstTick + 1;
  if (!Array.isArray(entries) || entries.length !== expectedCount) {
    fail('BASELINE_TICK_SEQUENCE_COUNT_MISMATCH', `${label}:${entries?.length ?? 'not-an-array'}`);
  }
  const seen = new Set();
  for (let index = 0; index < expectedCount; index += 1) {
    const tick = entries[index]?.absoluteSimulationTick;
    const expectedTick = firstTick + index;
    if (!Number.isSafeInteger(tick) || tick !== expectedTick || seen.has(tick)) {
      fail(
        'BASELINE_TICK_SEQUENCE_MISSING_DUPLICATE_OR_INVALID',
        JSON.stringify({ label, index, expectedTick, actualTick: tick })
      );
    }
    seen.add(tick);
  }
}

async function writeCanonical(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${canonicalize(value)}\n`, { flag: 'wx', mode: 0o644 });
}

function pngDimensions(bytes) {
  const signature = '89504e470d0a1a0a';
  if (bytes.length < 24 || bytes.subarray(0, 8).toString('hex') !== signature) fail('INVALID_PNG');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

async function screenshotArtifact(page, path) {
  await page.screenshot({ path, fullPage: true, type: 'png' });
  const bytes = await readFile(path);
  const dimensions = pngDimensions(bytes);
  if (dimensions.width !== 1600 || dimensions.height !== 900) fail('SCREENSHOT_DIMENSIONS_MISMATCH');
  return { bytes: bytes.length, sha256: sha256Bytes(bytes), ...dimensions };
}

async function runtimeFacts(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const gl = canvas?.getContext('webgl2');
    const debug = gl?.getExtension('WEBGL_debug_renderer_info');
    return {
      route: location.pathname + location.search,
      viewport: { width: innerWidth, height: innerHeight },
      devicePixelRatio,
      documentHasFocus: document.hasFocus(),
      activeElement: document.activeElement?.tagName ?? null,
      canvasCount: document.querySelectorAll('canvas').length,
      webgl2: typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext,
      vendor: gl?.getParameter(gl.VENDOR) ?? null,
      renderer: gl?.getParameter(gl.RENDERER) ?? null,
      unmaskedVendor: debug ? gl?.getParameter(debug.UNMASKED_VENDOR_WEBGL) ?? null : null,
      unmaskedRenderer: debug ? gl?.getParameter(debug.UNMASKED_RENDERER_WEBGL) ?? null : null
    };
  });
}

async function waitForPausedRenderedTick(page, tick, priorHeartbeat) {
  try {
    await page.waitForFunction(
      ({ expected, heartbeat }) => {
        const state = window.__P30_CRITIC__?.snapshot();
        return state?.absoluteSimulationTick === expected &&
          state.capturePaused === true &&
          state.paused === true &&
          state.renderHeartbeat > heartbeat;
      },
      { expected: tick, heartbeat: priorHeartbeat },
      { timeout: 15_000, polling: 5 }
    );
  } catch {
    const current = await page.evaluate(() => window.__P30_CRITIC__?.snapshot() ?? null);
    fail('CAPTURE_TICK_TIMEOUT', JSON.stringify({ expected: tick, priorHeartbeat, current }));
  }
  return page.evaluate(() => window.__P30_CRITIC__.snapshot());
}

function summarizeTrace(kind, run, snapshots, runtime, browserVersion, playwrightVersion) {
  assertCompleteTickSequence(run.stateDigestHistory, `${kind}:state`);
  assertCompleteTickSequence(run.cameraHistory, `${kind}:camera`);
  const stateDigests = run.stateDigestHistory.map((entry) => ({
    absoluteSimulationTick: entry.absoluteSimulationTick,
    sha256: entry.sha256
  }));
  const cameraDigests = run.cameraHistory
    .map((entry) => ({ absoluteSimulationTick: entry.absoluteSimulationTick, sha256: cameraDigest(entry) }));
  const normalizedInputs = run.fixedInputHistory.map((entry) => ({
    absoluteSimulationTick: entry.absoluteSimulationTick,
    sampledUpdateTick: entry.sampledUpdateTick,
    moveX: entry.moveX,
    moveZ: entry.moveZ,
    sprint: entry.sprint,
    dodgePressed: entry.dodgePressed,
    attackPressed: entry.attackPressed,
    faceYaw: entry.faceYaw
  }));
  const eventBytes = canonicalBytes(run.eventLog);
  const inputBytes = canonicalBytes(normalizedInputs);
  return {
    schema: 'p30.r012a.baseline-golden-trace.v1',
    protocolID: PROTOCOL_ID,
    kind,
    selectedBaselineScenarioID: 'P30-light-strike-v1',
    selectedBaselineSeed: 30011,
    normalPlayableRoute: ROUTE,
    fixedDeltaNumerator: 1,
    fixedDeltaDenominator: 60,
    declaredAbsoluteTicks: stateDigests.map((entry) => entry.absoluteSimulationTick),
    stateDigests,
    cameraDigests,
    eventLog: run.eventLog,
    eventLogSha256: sha256Bytes(eventBytes),
    normalizedInputHistorySha256: sha256Bytes(inputBytes),
    focusedSnapshots: snapshots.map((snapshot) => ({
      absoluteSimulationTick: snapshot.absoluteSimulationTick,
      attackRelativeTick: snapshot.attackRelativeTick,
      authoritativeStateSha256: snapshot.authoritativeState.sha256,
      targetHealth: snapshot.target.health,
      rendererMode: snapshot.rendererMode,
      assetTier: snapshot.assetTier,
      fallbackActive: snapshot.fallbackActive
    })),
    evaluatorReleaseControl: {
      device: 'keyboard',
      code: 'Escape',
      purpose: 'release the selected Round011 baseline from its initial evaluator pause only',
      excludedFromCombatInputDigest: true
    },
    playerCombatInput: kind === 'lightStrike'
      ? [{ device: 'mouse', button: 'left', absoluteSimulationTick: 24 }]
      : [],
    runtime: {
      node: process.version,
      browser: browserVersion,
      playwright: playwrightVersion,
      headed: true,
      chromeExecutable: CHROME,
      route: runtime.route,
      viewportWidth: runtime.viewport.width,
      viewportHeight: runtime.viewport.height,
      devicePixelRatio: runtime.devicePixelRatio,
      webgl2: runtime.webgl2,
      vendor: runtime.vendor,
      renderer: runtime.renderer,
      unmaskedVendor: runtime.unmaskedVendor,
      unmaskedRenderer: runtime.unmaskedRenderer,
      canvasCount: runtime.canvasCount
    }
  };
}

async function runTrace({ chromium, browserVersion, playwrightVersion, urlOrigin, runtimeRoot, out, kind }) {
  const profile = await mkdtemp(join(tmpdir(), `p30-r012-${kind}-profile-`));
  const launchArguments = [
    '--window-size=1600,900',
    '--force-device-scale-factor=1',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows'
  ];
  const context = await chromium.launchPersistentContext(profile, {
    headless: false,
    executablePath: CHROME,
    viewport: VIEWPORT,
    screen: VIEWPORT,
    deviceScaleFactor: 1,
    args: launchArguments
  });
  const page = context.pages()[0] ?? await context.newPage();
  const errors = { console: [], page: [], request: [], responses: [], unhandled: [] };
  page.on('console', (message) => {
    if (message.type() === 'error') errors.console.push(message.text());
  });
  page.on('pageerror', (error) => errors.page.push(String(error.stack ?? error)));
  page.on('requestfailed', (request) => errors.request.push(request.url()));
  page.on('response', (response) => {
    if (response.status() >= 400) errors.responses.push(`${response.status()} ${response.url()}`);
  });
  await page.addInitScript(() => {
    window.__P30_BASELINE_UNHANDLED__ = [];
    window.addEventListener('unhandledrejection', (event) => {
      window.__P30_BASELINE_UNHANDLED__.push(String(event.reason?.stack ?? event.reason));
    });
  });
  const artifacts = [];
  try {
    await page.goto(`${urlOrigin}${ROUTE}`, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.waitForFunction(() => window.__P30_CRITIC__?.schema === 'p30.r011.runtime-hook.v1');
    await page.evaluate(async () => window.__P30_CRITIC__.whenReady());
    await page.bringToFront();
    await page.mouse.move(800, 450);
    const initial = await page.evaluate(() => window.__P30_CRITIC__.snapshot());
    if (
      initial.absoluteSimulationTick !== 0 ||
      initial.paused !== true ||
      initial.capturePaused !== false ||
      initial.rendererMode !== 'webgl2' ||
      initial.assetTier !== 'production-authored' ||
      initial.fallbackActive !== false
    ) fail('BASELINE_BOOT_INVARIANT_FAILED');
    const runtime = await runtimeFacts(page);
    if (
      runtime.route !== ROUTE ||
      runtime.viewport.width !== 1600 ||
      runtime.viewport.height !== 900 ||
      runtime.devicePixelRatio !== 1 ||
      runtime.canvasCount !== 1 ||
      runtime.webgl2 !== true ||
      /swiftshader|llvmpipe|software/iu.test(runtime.unmaskedRenderer ?? runtime.renderer ?? '')
    ) fail('BASELINE_RUNTIME_INVARIANT_FAILED');

    const captures = new Map();
    const captureInitialPath = join(out, 'captures', `${kind}-tick-000.png`);
    if (CAPTURE_TICKS[kind].includes(0)) {
      await mkdir(dirname(captureInitialPath), { recursive: true });
      captures.set(0, await screenshotArtifact(page, captureInitialPath));
    }
    await page.evaluate(() => window.__P30_CRITIC__.armCaptureTicks([1]));
    let heartbeat = initial.renderHeartbeat;
    await page.keyboard.press('Escape');
    const focusedSnapshots = [initial];
    const releaseSnapshot = await waitForPausedRenderedTick(page, 1, heartbeat);
    heartbeat = releaseSnapshot.renderHeartbeat;
    await page.waitForTimeout(2_200);
    const releaseSettled = await page.evaluate(() => ({
      tick: window.__P30_CRITIC__.snapshot().absoluteSimulationTick,
      visibleToasts: document.querySelectorAll('.hud-toast.is-visible').length
    }));
    if (releaseSettled.tick !== 1 || releaseSettled.visibleToasts !== 0) {
      fail('EVALUATOR_RELEASE_DID_NOT_SETTLE');
    }
    for (let currentTick = 1; currentTick < 80; currentTick += 1) {
      const nextTick = currentTick + 1;
      await page.evaluate(
        (tick) => window.__P30_CRITIC__.armCaptureTicks([tick]),
        nextTick
      );
      if (kind === 'lightStrike' && currentTick === 24) {
        await page.mouse.down({ button: 'left' });
        await page.mouse.up({ button: 'left' });
      } else {
        await page.evaluate(() => window.__P30_CRITIC__.resume());
      }
      const snapshot = await waitForPausedRenderedTick(page, nextTick, heartbeat);
      heartbeat = snapshot.renderHeartbeat;
      if (CAPTURE_TICKS[kind].includes(nextTick)) {
        focusedSnapshots.push(snapshot);
        const capturePath = join(
          out,
          'captures',
          `${kind}-tick-${String(nextTick).padStart(3, '0')}.png`
        );
        await mkdir(dirname(capturePath), { recursive: true });
        captures.set(nextTick, await screenshotArtifact(page, capturePath));
      }
    }
    errors.unhandled = await page.evaluate(() => window.__P30_BASELINE_UNHANDLED__ ?? []);
    if (Object.values(errors).some((values) => values.length > 0)) fail('BASELINE_RUNTIME_ERRORS');
    const run = await page.evaluate(() => window.__P30_CRITIC__.runReceipt());
    if (run.errors.length !== 0 || run.stateDigestHistory.length !== 81 || run.fixedInputHistory.length !== 80) {
      fail('BASELINE_TRACE_INCOMPLETE');
    }
    assertCompleteTickSequence(run.stateDigestHistory, `${kind}:state`);
    assertCompleteTickSequence(run.cameraHistory, `${kind}:camera`);
    if (kind === 'neutral') {
      if (run.inputEdgeLog.length !== 0 || run.eventLog.length !== 0) fail('NEUTRAL_TRACE_NOT_PURE');
      if (focusedSnapshots.some((snapshot) => snapshot.target.health !== 100)) fail('NEUTRAL_HEALTH_MUTATED');
    } else {
      if (
        run.inputEdgeLog.length !== 1 ||
        run.inputEdgeLog[0].absoluteSimulationTick !== 24 ||
        run.inputEdgeLog[0].device !== 'mouse' ||
        run.inputEdgeLog[0].button !== 'left'
      ) fail('LIGHT_INPUT_EDGE_MISMATCH');
      const starts = run.eventLog.filter((event) => event.type === 'attack-started');
      const hits = run.eventLog.filter((event) => event.type === 'enemy-hit');
      if (starts.length !== 1 || starts[0].absoluteSimulationTick !== 24 || hits.length !== 0) {
        fail('LIGHT_EVENT_MISMATCH');
      }
      if (focusedSnapshots.some((snapshot) => snapshot.target.health !== 100)) {
        fail('LIGHT_BASELINE_HEALTH_MUTATED');
      }
    }
    const trace = summarizeTrace(kind, run, focusedSnapshots, runtime, browserVersion, playwrightVersion);
    const traceName = kind === 'neutral' ? 'neutral-golden-trace.json' : 'light-strike-golden-trace.json';
    const tracePath = join(out, traceName);
    await writeCanonical(tracePath, trace);
    artifacts.push({ kind: 'golden-trace', trace: kind, tick: null, path: tracePath });
    for (const [tick, receipt] of captures) {
      artifacts.push({
        kind: 'production-frame',
        trace: kind,
        tick,
        path: join(out, 'captures', `${kind}-tick-${String(tick).padStart(3, '0')}.png`),
        ...receipt
      });
    }
    return { runtime, artifacts, tracePath };
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const repository = await realpath(args.repository);
  const runtimeRoot = await realpath(args['runtime-root']);
  const out = resolve(args.out);
  assertInside(repository, out, 'OUTPUT_OUTSIDE_REPOSITORY');
  if (await pathExists(out)) fail('OUTPUT_ALREADY_EXISTS');
  await mkdir(out, { recursive: true, mode: 0o755 });
  const requireFromRuntime = createRequire(resolve(runtimeRoot, 'package.json'));
  const { chromium } = requireFromRuntime('playwright');
  const playwrightVersion = requireFromRuntime('playwright/package.json').version;
  const browserVersion = (await import('node:child_process')).execFileSync(CHROME, ['--version'], {
    encoding: 'utf8'
  }).trim();
  const results = [];
  for (const kind of ['neutral', 'lightStrike']) {
    results.push(await runTrace({
      chromium,
      browserVersion,
      playwrightVersion,
      urlOrigin: args['url-origin'],
      runtimeRoot,
      out,
      kind
    }));
  }

  const allArtifacts = results.flatMap((result) => result.artifacts);
  const manifested = [];
  for (const artifact of allArtifacts) {
    const info = await stat(artifact.path);
    const path = relative(repository, artifact.path).split(sep).join('/');
    manifested.push({
      path,
      kind: artifact.kind,
      trace: artifact.trace,
      tick: artifact.tick,
      bytes: info.size,
      sha256: await fileSha256(artifact.path),
      ...(artifact.width ? { width: artifact.width, height: artifact.height } : {})
    });
  }
  manifested.sort((left, right) => compareUtf8(left.path, right.path));
  const toolPaths = [
    fileURLToPath(import.meta.url),
    resolve(dirname(fileURLToPath(import.meta.url)), 'baseline-core.mjs')
  ];
  const evaluatorTools = [];
  for (const toolPath of toolPaths) {
    const info = await stat(toolPath);
    evaluatorTools.push({
      path: relative(repository, toolPath).split(sep).join('/'),
      bytes: info.size,
      sha256: await fileSha256(toolPath)
    });
  }
  evaluatorTools.sort((left, right) => compareUtf8(left.path, right.path));
  const manifest = {
    schema: 'p30.r012a.baseline-evidence-manifest.v1',
    protocolID: PROTOCOL_ID,
    selectedCheckpoint: 'candidate-9442539eea8abc4c',
    sourceCommit: args['source-commit'],
    materializedSourceTreeSha256: args['source-tree'],
    productionOutputTreeSha256: args['output-tree'],
    normalPlayableRoute: ROUTE,
    cameraID: 'P30-R011-SELECTED-CAMERA-v1',
    scenarioID: 'P30-light-strike-v1',
    viewportWidth: 1600,
    viewportHeight: 900,
    devicePixelRatio: 1,
    browser: browserVersion,
    playwright: playwrightVersion,
    node: process.version,
    gpu: {
      vendor: results[0].runtime.unmaskedVendor ?? results[0].runtime.vendor,
      renderer: results[0].runtime.unmaskedRenderer ?? results[0].runtime.renderer,
      webgl2: results.every((result) => result.runtime.webgl2)
    },
    evaluatorTools,
    artifacts: manifested
  };
  const manifestPath = join(out, 'EVIDENCE_MANIFEST.json');
  await writeCanonical(manifestPath, manifest);
  process.stdout.write(`${JSON.stringify({
    schema: manifest.schema,
    artifactCount: manifested.length,
    manifestSha256: await fileSha256(manifestPath),
    neutralTraceSha256: await fileSha256(results[0].tracePath),
    lightStrikeTraceSha256: await fileSha256(results[1].tracePath)
  })}\n`);
}

main().catch((error) => {
  process.stderr.write(`BASELINE_CAPTURE_ERROR:${error.code ?? 'UNEXPECTED'}\n`);
  if (process.env.P30_BASELINE_DEBUG === '1') {
    process.stderr.write(`${error.stack ?? error.message}\n`);
  }
  process.exitCode = 1;
});
