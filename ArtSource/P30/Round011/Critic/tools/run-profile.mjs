#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
import process from 'node:process';

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value === undefined) fail(`invalid arguments near ${key ?? '<end>'}`);
    values[key.slice(2)] = value;
  }
  for (const required of ['alias', 'runtime', 'url', 'profile', 'out']) {
    if (!values[required]) fail(`missing --${required}`);
  }
  if (!/^candidate-[0-9a-f]{16}$/.test(values.alias)) fail('invalid opaque alias');
  if (!/^https?:\/\/127\.0\.0\.1:\d+\//.test(values.url)) fail('URL must use 127.0.0.1');
  return values;
}

async function sha256(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

async function jsonFile(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

function sleep(milliseconds) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds));
}

async function meanLuminance(path) {
  const child = spawn('/opt/homebrew/bin/ffmpeg', [
    '-v', 'error', '-i', path, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  const stdout = [];
  const stderr = [];
  child.stdout.on('data', (chunk) => stdout.push(chunk));
  child.stderr.on('data', (chunk) => stderr.push(chunk));
  const exitCode = await new Promise((resolveExit) => child.on('close', resolveExit));
  if (exitCode !== 0) fail(`ffmpeg luminance decode failed: ${Buffer.concat(stderr).toString('utf8')}`);
  const pixels = Buffer.concat(stdout);
  if (pixels.length !== 1600 * 900 * 3) fail(`unexpected decoded screenshot bytes: ${pixels.length}`);
  let weighted = 0;
  for (let offset = 0; offset < pixels.length; offset += 3) {
    weighted += 0.2126 * pixels[offset] + 0.7152 * pixels[offset + 1] + 0.0722 * pixels[offset + 2];
  }
  return weighted / (pixels.length / 3);
}

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] ?? null;
}

async function measureFrameTimes(page, milliseconds) {
  return page.evaluate((duration) => new Promise((resolveMeasure) => {
    const samples = [];
    let start = null;
    let previous = null;
    function frame(now) {
      if (start === null) start = now;
      if (previous !== null) samples.push(now - previous);
      previous = now;
      if (now - start >= duration) resolveMeasure(samples);
      else requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }), milliseconds);
}

async function resourceMedian(cdp, page, label) {
  const samples = [];
  for (let index = 0; index < 3; index += 1) {
    await cdp.send('HeapProfiler.collectGarbage');
    await sleep(100);
    const metricsResponse = await cdp.send('Performance.getMetrics');
    const metrics = Object.fromEntries(metricsResponse.metrics.map((metric) => [metric.name, metric.value]));
    const dom = await page.evaluate(() => ({
      canvases: document.querySelectorAll('canvas').length,
      hudRoots: document.querySelectorAll('#game-root').length,
      pointerLockElement: document.pointerLockElement?.tagName ?? null,
      snapshot: window.__P30_CRITIC__.snapshot(),
      engine: window.__P30_CRITIC__.resourceReceipt()
    }));
    samples.push({ index: index + 1, metrics, dom });
  }
  const median = {};
  for (const key of ['Documents', 'Nodes', 'JSEventListeners', 'JSHeapUsedSize']) {
    const values = samples.map((sample) => sample.metrics[key]).filter(Number.isFinite).sort((a, b) => a - b);
    median[key] = values[1] ?? null;
  }
  return { label, samples, median };
}

async function runSoak(page, out, captureFrames) {
  const start = performance.now();
  const actions = [];
  let direction = '';
  let nextMouse = 0;
  let nextStrike = 2_000;
  let nextFrame = 0;
  let frameIndex = 0;
  const setDirection = async (next) => {
    if (next === direction) return;
    for (const key of direction) await page.keyboard.up(`Key${key}`);
    for (const key of next) await page.keyboard.down(`Key${key}`);
    direction = next;
    actions.push({ milliseconds: Math.round(performance.now() - start), type: 'direction', value: next });
  };
  await page.bringToFront();
  await page.locator('canvas').focus();
  const focusBefore = await page.evaluate(() => ({
    documentHasFocus: document.hasFocus(),
    activeElement: document.activeElement?.tagName ?? null,
    visibilityState: document.visibilityState
  }));
  await setDirection('W');
  while (true) {
    const elapsed = performance.now() - start;
    if (elapsed >= 30_000) break;
    const phase = Math.min(4, Math.floor(elapsed / 6_000));
    await setDirection(['W', 'WD', 'S', 'SA', 'W'][phase]);
    if (elapsed >= nextMouse) {
      const x = Math.round(800 + 230 * Math.sin(elapsed / 710));
      const y = Math.round(450 + 90 * Math.cos(elapsed / 930));
      await page.mouse.move(x, y, { steps: 2 });
      actions.push({ milliseconds: Math.round(performance.now() - start), type: 'pointer-move', x, y });
      nextMouse += 500;
    }
    if (elapsed >= nextStrike) {
      await page.mouse.click(800, 450, { button: 'left' });
      actions.push({ milliseconds: Math.round(performance.now() - start), type: 'light-strike' });
      nextStrike += 4_000;
    }
    if (captureFrames && elapsed >= nextFrame && elapsed < 12_000) {
      await page.screenshot({
        path: join(out, 'soak-frames', `frame-${String(frameIndex).padStart(3, '0')}.png`),
        fullPage: true
      });
      frameIndex += 1;
      nextFrame += 250;
    }
    await sleep(10);
  }
  await setDirection('');
  const durationMilliseconds = performance.now() - start;
  const postStrikeStart = performance.now();
  const attacksBefore = await page.evaluate(() => window.__P30_CRITIC__.runReceipt().eventLog
    .filter((event) => (event.type ?? event.event?.type) === 'attack-started').length);
  await page.mouse.click(800, 450, { button: 'left' });
  let postSoakStrikeAcknowledged = false;
  try {
    await page.waitForFunction(
      (count) => window.__P30_CRITIC__.runReceipt().eventLog
        .filter((event) => (event.type ?? event.event?.type) === 'attack-started').length > count,
      attacksBefore,
      { timeout: 1_000, polling: 10 }
    );
    postSoakStrikeAcknowledged = true;
  } catch {
    postSoakStrikeAcknowledged = false;
  }
  return {
    requestedDurationMilliseconds: 30_000,
    actualDurationMilliseconds: durationMilliseconds,
    durationErrorMilliseconds: durationMilliseconds - 30_000,
    actions,
    capturedFrameCount: frameIndex,
    focusBefore,
    focusAfter: await page.evaluate(() => ({
      documentHasFocus: document.hasFocus(),
      activeElement: document.activeElement?.tagName ?? null,
      visibilityState: document.visibilityState
    })),
    postSoakStrikeAcknowledged,
    postSoakStrikeAcknowledgedMilliseconds: performance.now() - postStrikeStart,
    pointerLock: await page.evaluate(() => ({
      element: document.pointerLockElement?.tagName ?? null,
      errors: window.__P30_POINTER_LOCK_ERRORS__ ?? [],
      unhandledRejections: window.__P30_EVALUATOR_REJECTIONS__ ?? []
    }))
  };
}

async function runContextRecovery(page, out) {
  const prePath = join(out, 'context', 'pre-loss.png');
  const firstPath = join(out, 'context', 'first-restored.png');
  const fivePath = join(out, 'context', 'five-seconds.png');
  const postPath = join(out, 'context', 'post-control.png');
  await page.screenshot({ path: prePath, fullPage: true });
  const preState = await page.evaluate(() => ({
    now: performance.now(),
    snapshot: window.__P30_CRITIC__.snapshot(),
    resources: window.__P30_CRITIC__.resourceReceipt()
  }));
  await page.evaluate(() => {
    window.__P30_CONTEXT_EVENTS__ = [];
    const canvas = document.querySelector('canvas');
    canvas.addEventListener('webglcontextlost', () => {
      window.__P30_CONTEXT_EVENTS__.push({ type: 'lost', milliseconds: performance.now() });
    });
    canvas.addEventListener('webglcontextrestored', () => {
      window.__P30_CONTEXT_EVENTS__.push({ type: 'restored', milliseconds: performance.now() });
    });
    const extension = canvas.getContext('webgl2').getExtension('WEBGL_lose_context');
    if (!extension) throw new Error('WEBGL_lose_context unavailable');
    window.__P30_LOSE_CONTEXT_EXTENSION__ = extension;
    extension.loseContext();
  });
  await page.waitForFunction(() => window.__P30_CONTEXT_EVENTS__?.some((event) => event.type === 'lost'), null, { timeout: 2_000 });
  await sleep(250);
  await page.evaluate(() => window.__P30_LOSE_CONTEXT_EXTENSION__.restoreContext());
  await page.waitForFunction(() => window.__P30_CONTEXT_EVENTS__?.some((event) => event.type === 'restored'), null, { timeout: 5_000 });
  const restoredAt = await page.evaluate(() => window.__P30_CONTEXT_EVENTS__.find((event) => event.type === 'restored').milliseconds);
  await page.screenshot({ path: firstPath, fullPage: true });
  const firstCapturedAt = await page.evaluate(() => performance.now());
  const controlBefore = await page.evaluate(() => window.__P30_CRITIC__.snapshot());
  await page.keyboard.down('KeyW');
  await sleep(120);
  await page.keyboard.up('KeyW');
  await page.waitForFunction((before) => {
    const current = window.__P30_CRITIC__.snapshot();
    return current.renderHeartbeat > before.renderHeartbeat
      && current.attacker.root.position.some((value, index) => Math.abs(value - before.attacker.root.position[index]) > 0.000001);
  }, controlBefore, { timeout: 1_000, polling: 10 });
  const controlAt = await page.evaluate(() => performance.now());
  const now = await page.evaluate(() => performance.now());
  await sleep(Math.max(0, restoredAt + 5_000 - now - 15));
  const fiveCaptureStartedAt = await page.evaluate(() => performance.now());
  await page.screenshot({ path: fivePath, fullPage: true });
  const fiveCapturedAt = await page.evaluate(() => performance.now());
  await sleep(750);
  await page.screenshot({ path: postPath, fullPage: true });
  const postState = await runtimeFacts(page);
  const preLuminance = await meanLuminance(prePath);
  const firstLuminance = await meanLuminance(firstPath);
  const fiveLuminance = await meanLuminance(fivePath);
  return {
    preState,
    postState,
    events: await page.evaluate(() => window.__P30_CONTEXT_EVENTS__),
    preLuminance,
    firstLuminance,
    fiveLuminance,
    luminanceRelativeDeltaAtFiveSeconds: Math.abs(fiveLuminance - preLuminance) / preLuminance,
    firstNonblankCorrectlyOrientedFrameMilliseconds: firstCapturedAt - restoredAt,
    controlAcknowledgedMilliseconds: controlAt - restoredAt,
    fiveSecondCaptureStartedDeltaMilliseconds: fiveCaptureStartedAt - restoredAt,
    fiveSecondCaptureCompletedDeltaMilliseconds: fiveCapturedAt - restoredAt
  };
}

async function waitForPausedTick(page, tick, timeout = 10_000) {
  await page.waitForFunction(
    ({ expected }) => {
      const hook = window.__P30_CRITIC__;
      if (!hook) return false;
      const state = hook.snapshot();
      return state.absoluteSimulationTick === expected && state.paused === true;
    },
    { expected: tick },
    { timeout, polling: 5 }
  );
  return page.evaluate(() => window.__P30_CRITIC__.snapshot());
}

async function runtimeFacts(page) {
  return page.evaluate(() => {
    const canvases = [...document.querySelectorAll('canvas')];
    const canvas = canvases[0];
    const gl = canvas?.getContext('webgl2');
    const debug = gl?.getExtension('WEBGL_debug_renderer_info');
    return {
      location: location.pathname + location.search,
      innerWidth,
      innerHeight,
      devicePixelRatio,
      screen: { width: screen.width, height: screen.height },
      canvasCount: canvases.length,
      canvasSizes: canvases.map((item) => ({
        width: item.width,
        height: item.height,
        clientWidth: item.clientWidth,
        clientHeight: item.clientHeight
      })),
      hookSchema: window.__P30_CRITIC__?.schema ?? null,
      webgl2: gl instanceof WebGL2RenderingContext,
      renderer: gl ? {
        version: gl.getParameter(gl.VERSION),
        shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
        vendor: gl.getParameter(gl.VENDOR),
        renderer: gl.getParameter(gl.RENDERER),
        unmaskedVendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : null,
        unmaskedRenderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null
      } : null,
      extensionLoseContext: Boolean(gl?.getExtension('WEBGL_lose_context')),
      snapshot: window.__P30_CRITIC__?.snapshot?.() ?? null,
      resourceReceipt: window.__P30_CRITIC__?.resourceReceipt?.() ?? null
    };
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const runtime = resolve(args.runtime);
  const out = resolve(args.out);
  const profileDirectory = join(out, 'chrome-profile');
  await rm(out, { recursive: true, force: true });
  await mkdir(profileDirectory, { recursive: true });
  await mkdir(join(out, 'frames'), { recursive: true });
  await mkdir(join(out, 'checkpoints'), { recursive: true });
  await mkdir(join(out, 'context'), { recursive: true });
  await mkdir(join(out, 'soak-frames'), { recursive: true });

  const requireFromRuntime = createRequire(join(runtime, 'package.json'));
  const { chromium } = requireFromRuntime('playwright');
  const chromeExecutable = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const launchArguments = [
    '--window-size=1600,900',
    '--force-device-scale-factor=1',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows'
  ];
  const context = await chromium.launchPersistentContext(profileDirectory, {
    headless: false,
    executablePath: chromeExecutable,
    viewport: { width: 1600, height: 900 },
    screen: { width: 1600, height: 900 },
    deviceScaleFactor: 1,
    args: launchArguments
  });

  const page = context.pages()[0] ?? await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');
  await cdp.send('HeapProfiler.enable');
  const events = { console: [], pageErrors: [], requestFailures: [], responses: [], unhandledRejections: [], lifecycle: [] };
  const lifecycleStarted = performance.now();
  page.on('close', () => events.lifecycle.push({ type: 'page-closed', milliseconds: performance.now() - lifecycleStarted }));
  context.on('close', () => events.lifecycle.push({ type: 'context-closed', milliseconds: performance.now() - lifecycleStarted }));
  page.on('console', (message) => events.console.push({ type: message.type(), text: message.text() }));
  page.on('pageerror', (error) => events.pageErrors.push(String(error.stack ?? error)));
  page.on('requestfailed', (request) => events.requestFailures.push({ url: request.url(), error: request.failure()?.errorText ?? null }));
  page.on('response', (response) => {
    if (response.status() >= 400) events.responses.push({ url: response.url(), status: response.status() });
  });
  await page.addInitScript(() => {
    window.__P30_POINTER_LOCK_ERRORS__ = [];
    document.addEventListener('pointerlockerror', (event) => {
      window.__P30_POINTER_LOCK_ERRORS__.push({
        milliseconds: performance.now(),
        type: event.type,
        message: String(event.message ?? ''),
        documentHasFocus: document.hasFocus(),
        activeElement: document.activeElement?.tagName ?? null,
        visibilityState: document.visibilityState
      });
    });
    window.addEventListener('unhandledrejection', (event) => {
      window.__P30_EVALUATOR_REJECTIONS__ ??= [];
      window.__P30_EVALUATOR_REJECTIONS__.push(String(event.reason?.stack ?? event.reason));
    });
  });

  try {
    await page.goto(args.url, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.waitForFunction(() => window.__P30_CRITIC__?.schema === 'p30.r011.runtime-hook.v1', null, { timeout: 30_000 });
    await page.bringToFront();
    const boot = await runtimeFacts(page);
    await page.locator('canvas').focus();
    await page.mouse.move(800, 450);
    await page.keyboard.down('KeyW');
    const currentTick = await page.evaluate(() => {
      const hook = window.__P30_CRITIC__;
      const tick = hook.snapshot().absoluteSimulationTick;
      if (!Number.isSafeInteger(tick)) throw new Error('runtime hook omitted absoluteSimulationTick');
      if (tick > 0) throw new Error(`hook became ready after absolute tick ${tick}; cannot apply exact tick-0 input`);
      hook.armCaptureTicks(Array.from({ length: 48 - tick }, (_, index) => tick + index + 1));
      return tick;
    });
    await page.evaluate(() => window.__P30_CRITIC__.whenReady());
    await page.evaluate(() => {
      const hook = window.__P30_CRITIC__;
      const state = hook.snapshot();
      if (state.absoluteSimulationTick === 0 && state.paused === true) hook.resume();
    });
    if (!Number.isSafeInteger(currentTick)) fail('runtime hook omitted absoluteSimulationTick');
    if (currentTick > 0) fail(`hook became ready after absolute tick ${currentTick}; cannot apply exact tick-0 input`);

    for (let tick = currentTick + 1; tick <= 48; tick += 1) {
      const state = await waitForPausedTick(page, tick);
      if (tick === 1) {
        await jsonFile(join(out, 'boot.json'), boot);
        await page.screenshot({ path: join(out, 'boot.png'), fullPage: true });
      }
      if (tick === 20) await page.keyboard.up('KeyW');
      if (tick === 24) {
        await page.mouse.down({ button: 'left' });
        await page.mouse.up({ button: 'left' });
      }
      if ([20, 24, 48].includes(tick)) {
        await page.screenshot({ path: join(out, 'checkpoints', `absolute-${String(tick).padStart(2, '0')}.png`), fullPage: true });
        await jsonFile(
          join(out, 'checkpoints', `absolute-${String(tick).padStart(2, '0')}.json`),
          await page.evaluate(() => window.__P30_CRITIC__.snapshot())
        );
      }
      if (tick >= 27 && tick <= 43) {
        await page.screenshot({ path: join(out, 'frames', `absolute-${String(tick).padStart(2, '0')}.png`), fullPage: true });
        await jsonFile(join(out, 'states', `absolute-${String(tick).padStart(2, '0')}.json`), state);
      }
      await page.evaluate(() => window.__P30_CRITIC__.resume());
    }

    const captureFacts = await runtimeFacts(page);
    const runReceipt = await page.evaluate(() => window.__P30_CRITIC__.runReceipt());
    const fixedInputHistory = Array.isArray(runReceipt.fixedInputHistory)
      ? runReceipt.fixedInputHistory.map((item) => ({
        tick: item.sampledUpdateTick,
        moveX: item.moveX,
        moveZ: item.moveZ
      }))
      : Array.isArray(runReceipt.inputHistory)
        ? runReceipt.inputHistory.map((item) => ({
          tick: item.absoluteTick,
          moveX: item.input?.moveX,
          moveZ: item.input?.moveZ
        }))
        : [];
    const inputEdgeLog = Array.isArray(runReceipt.inputEdgeLog) ? runReceipt.inputEdgeLog : [];
    const updateInputs = new Map(fixedInputHistory.map((item) => [item.tick, item]));
    const traceValidation = {
      wTicks0Through19: Array.from({ length: 20 }, (_, tick) => [-1, -1_000_000].includes(updateInputs.get(tick)?.moveZ)).every(Boolean),
      idleTicks20Through23: [20, 21, 22, 23].every((tick) => {
        const input = updateInputs.get(tick);
        return input?.moveX === 0 && input?.moveZ === 0;
      }),
      exactlyOneMouseRisingEdgeAtAbsolute24: inputEdgeLog.length === 1
        && inputEdgeLog[0].action === 'light-strike'
        && ['rising', 'down'].includes(inputEdgeLog[0].phase)
        && inputEdgeLog[0].device === 'mouse'
        && inputEdgeLog[0].button === 'left'
        && (inputEdgeLog[0].absoluteSimulationTick ?? inputEdgeLog[0].absoluteTick) === 24
        && inputEdgeLog[0].attackRelativeTick === 0,
      requiredInputHistoryAvailable: Array.isArray(runReceipt.fixedInputHistory) || Array.isArray(runReceipt.inputHistory)
    };
    await jsonFile(join(out, 'run-receipt.json'), runReceipt);
    await jsonFile(join(out, 'trace-validation.json'), traceValidation);
    await jsonFile(join(out, 'runtime-facts.json'), captureFacts);

    await sleep(10_000);
    const initialFrameTimes = await measureFrameTimes(page, 10_000);
    const warmResources = await resourceMedian(cdp, page, 'warm-steady-state');
    const soak = await runSoak(page, out, Number(args.profile) === 1);
    await jsonFile(join(out, 'soak.json'), soak);
    const afterSoakResources = await resourceMedian(cdp, page, 'after-soak');
    const contextRecovery = await runContextRecovery(page, out);
    await jsonFile(join(out, 'context-recovery.json'), contextRecovery);
    const afterContextResources = await resourceMedian(cdp, page, 'after-context-restore');
    await jsonFile(join(out, 'browser-events-after-context.json'), events);

    await page.bringToFront();
    await page.locator('canvas').focus();
    const missSetupBefore = await page.evaluate(() => window.__P30_CRITIC__.snapshot());
    await page.keyboard.down('KeyS');
    await sleep(4_000);
    await page.keyboard.up('KeyS');
    const missSetupAfter = await page.evaluate(() => window.__P30_CRITIC__.snapshot());
    const distance = (state) => {
      const player = state.attacker.root.position;
      const target = state.target.torso.position;
      return Math.hypot(...player.map((value, index) => value - target[index]));
    };
    const missSetup = {
      input: 'normal KeyS traversal for 4000ms',
      before: missSetupBefore,
      after: missSetupAfter,
      distanceBeforeMeters: distance(missSetupBefore),
      distanceAfterMeters: distance(missSetupAfter),
      documentFocus: await page.evaluate(() => ({
        documentHasFocus: document.hasFocus(),
        activeElement: document.activeElement?.tagName ?? null,
        visibilityState: document.visibilityState
      }))
    };
    await jsonFile(join(out, 'miss-setup.json'), missSetup);

    const extraCycles = [];
    for (let cycle = 1; cycle <= 10; cycle += 1) {
      const before = await page.evaluate(() => window.__P30_CRITIC__.runReceipt().eventLog
        .filter((event) => (event.type ?? event.event?.type) === 'attack-started').length);
      const started = performance.now();
      await page.mouse.click(800, 450, { button: 'left' });
      let acknowledged = false;
      try {
        await page.waitForFunction(
          (count) => window.__P30_CRITIC__.runReceipt().eventLog
            .filter((event) => (event.type ?? event.event?.type) === 'attack-started').length > count,
          before,
          { timeout: 1_000, polling: 10 }
        );
        acknowledged = true;
      } catch {
        acknowledged = false;
      }
      extraCycles.push({ cycle, acknowledged, acknowledgeMilliseconds: performance.now() - started });
      await sleep(1_200);
    }
    const finalFrameTimes = await measureFrameTimes(page, 10_000);
    let finalResources;
    try {
      finalResources = await resourceMedian(cdp, page, 'after-ten-extra-cycles');
    } catch (error) {
      finalResources = {
        label: 'after-ten-extra-cycles',
        unavailable: true,
        error: String(error.stack ?? error),
        pageClosed: page.isClosed()
      };
    }
    const resourceAnalysis = {
      warm: warmResources,
      afterSoak: afterSoakResources,
      afterContext: afterContextResources,
      final: finalResources,
      missSetup,
      extraCycles,
      frameTimes: {
        initialSampleCount: initialFrameTimes.length,
        initialP95Milliseconds: percentile(initialFrameTimes, 0.95),
        initialMaximumMilliseconds: Math.max(...initialFrameTimes),
        finalSampleCount: finalFrameTimes.length,
        finalP95Milliseconds: percentile(finalFrameTimes, 0.95),
        finalMaximumMilliseconds: Math.max(...finalFrameTimes)
      },
      unavailableRequiredEngineCounters: ['programs', 'renderTargets', 'audioNodes', 'physicsBodies']
        .filter((key) => warmResources.samples[1]?.dom.engine?.renderer?.[key] === undefined)
    };
    await jsonFile(join(out, 'resource-analysis.json'), resourceAnalysis);
    if (!page.isClosed()) {
      await jsonFile(join(out, 'final-run-receipt.json'), await page.evaluate(() => window.__P30_CRITIC__.runReceipt()));
      await jsonFile(join(out, 'final-runtime-facts.json'), await runtimeFacts(page));
      events.unhandledRejections = await page.evaluate(() => window.__P30_EVALUATOR_REJECTIONS__ ?? []);
    } else {
      await jsonFile(join(out, 'final-run-receipt.json'), { unavailable: true, reason: 'production page closed before final receipt' });
      await jsonFile(join(out, 'final-runtime-facts.json'), { unavailable: true, reason: 'production page closed before final facts' });
      events.unhandledRejections = soak.pointerLock.unhandledRejections;
    }
    await jsonFile(join(out, 'browser-events.json'), events);
    await jsonFile(join(out, 'evaluator.json'), {
      schema: 'p30.r011.evaluator-profile.v1',
      alias: args.alias,
      profile: Number(args.profile),
      url: args.url,
      chromeExecutable,
      launchArguments,
      playwrightVersion: requireFromRuntime('playwright/package.json').version,
      node: process.version,
      evaluatorSha256: await sha256(new URL(import.meta.url))
    });
  } finally {
    await context.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error.message}\n`);
  process.exitCode = 1;
});
