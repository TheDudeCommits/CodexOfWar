import type { BcjObject, BcjValue } from "./CanonicalStateDigest";
import { canonicalizeBcj, sha256Hex } from "./CanonicalStateDigest";
import { P30_SCENARIO_ID, P30_SCENARIO_SEED } from "./P30CriticProtocol";
import type { GameEvent, WorldState } from "../game/simulation/types";
import type {
  GameApp,
  ProductionFixedUpdateReceipt,
  ProductionRenderReceipt,
} from "../render/app/GameApp";

const QUANTIZATION_SCALE = 1_000_000 as const;

interface ResetOptions {
  seed: number;
  targetOffsetMicrometres: [number, number, number];
}

interface InputEdgeReceipt {
  eventID: string;
  action: "heavy-strike" | "light-strike";
  phase: "rising";
  device: "mouse" | "keyboard" | "unknown";
  button: "right" | "left" | null;
  code: "KeyK" | null;
  absoluteSimulationTick: number;
  heavyRelativeTick: number | null;
}

interface RuntimeEventReceipt {
  eventID: string;
  type: GameEvent["type"];
  absoluteSimulationTick: number;
  heavyRelativeTick: number | null;
  attackSerial?: number;
  damage?: number;
  healthBefore?: number;
  healthAfter?: number;
}

interface StateDigestReceipt {
  absoluteSimulationTick: number;
  heavyRelativeTick: number | null;
  quantizationScale: 1_000_000;
  quantizedState: BcjObject;
  bcjVersion: "BCJ-v1";
  bcj: string;
  sha256: string;
}

export interface P30CriticApi {
  readonly schema: "p30.r012a.runtime-hook.v1";
  whenReady: () => Promise<void>;
  resetAndPause: (options: ResetOptions) => Promise<void>;
  armCaptureTicks: (absoluteScenarioTicks: number[]) => void;
  resume: () => void;
  snapshot: () => Readonly<Record<string, unknown>>;
  runReceipt: () => Readonly<Record<string, unknown>>;
  resourceReceipt: () => Readonly<Record<string, unknown>>;
  geometrySource: () => Record<string, unknown>;
}

declare global {
  interface Window {
    __P30_CRITIC__?: P30CriticApi;
  }
}

function quantize(value: number): number {
  const result = Math.round(value * QUANTIZATION_SCALE);
  if (!Number.isSafeInteger(result)) throw new Error(`Unsafe quantized state value: ${value}`);
  return Object.is(result, -0) ? 0 : result;
}

function quantizedWorldState(state: WorldState): BcjObject {
  return {
    absoluteSimulationTick: state.tick,
    elapsedMicroseconds: quantize(state.elapsed),
    objectiveComplete: state.objectiveComplete,
    attacker: {
      position: [quantize(state.player.position.x), 0, quantize(state.player.position.z)],
      yaw: quantize(state.player.yaw),
      health: state.player.health,
      stamina: quantize(state.player.stamina),
      motion: state.player.motion,
      speed01: quantize(state.player.speed01),
      attackElapsed: quantize(state.player.attackElapsed),
      attackFrame: state.player.attackFrame,
      attackPhase: state.player.attackPhase,
      attackSerial: state.player.attackSerial,
      attackHasHit: state.player.attackHasHit,
      dodgeRemaining: quantize(state.player.dodgeRemaining),
      invulnerableRemaining: quantize(state.player.invulnerableRemaining),
    },
    target: {
      position: [quantize(state.enemy.position.x), 0, quantize(state.enemy.position.z)],
      yaw: quantize(state.enemy.yaw),
      health: state.enemy.health,
      motion: state.enemy.motion,
      hitStunRemaining: quantize(state.enemy.hitStunRemaining),
      idlePhase: quantize(state.enemy.idlePhase),
    },
  };
}

function cloneJson<T>(value: T): T {
  return structuredClone(value);
}

function assertResetOptions(value: ResetOptions): asserts value is ResetOptions {
  if (!value || typeof value !== "object") throw new Error("resetAndPause options are required");
  const keys = Object.keys(value).sort();
  if (keys.join(",") !== "seed,targetOffsetMicrometres") {
    throw new Error("resetAndPause accepts exactly seed and targetOffsetMicrometres");
  }
  if (value.seed !== P30_SCENARIO_SEED) throw new Error(`Unsupported Round012 seed: ${value.seed}`);
  if (
    !Array.isArray(value.targetOffsetMicrometres) ||
    value.targetOffsetMicrometres.length !== 3 ||
    value.targetOffsetMicrometres.some((entry) => !Number.isSafeInteger(entry))
  ) {
    throw new Error("targetOffsetMicrometres must contain three signed safe integers");
  }
}

class P30CriticController {
  private readonly armedTicks = new Set<number>();
  private readonly inputEdgeLog: InputEdgeReceipt[] = [];
  private readonly eventLog: RuntimeEventReceipt[] = [];
  private readonly fixedInputHistory: Array<Record<string, BcjValue>> = [];
  private readonly stateDigestHistory: StateDigestReceipt[] = [];
  private readonly cameraHistory: Array<Record<string, BcjValue>> = [];
  private readonly healthSeries: Array<{ absoluteTick: number; health: number }> = [];
  private readonly errors: string[] = [];
  private heavyEdgeTick: number | null = null;
  private eventSerial = 0;
  private lastCameraTick: number | null = null;
  private targetOffsetMicrometres: [number, number, number] = [0, 0, 0];
  private resetCount = 0;

  readonly api: P30CriticApi;

  constructor(private readonly app: GameApp) {
    this.api = Object.freeze({
      schema: "p30.r012a.runtime-hook.v1" as const,
      whenReady: () => Promise.resolve(),
      resetAndPause: async (options: ResetOptions) => this.resetAndPause(options),
      armCaptureTicks: (ticks: number[]) => this.armCaptureTicks(ticks),
      resume: () => this.app.resumeRuntimeCapture(),
      snapshot: () => this.snapshot(),
      runReceipt: () => this.runReceipt(),
      resourceReceipt: () => this.resourceReceipt(),
      geometrySource: () => this.app.getRound012GeometrySource(),
    });
    this.app.setProductionRuntimeObserver({
      afterFixedUpdate: (receipt) => this.afterFixedUpdate(receipt),
      afterRender: (receipt) => this.afterRender(receipt),
    });
    this.resetLogs();
  }

  private heavyRelativeTick(absoluteTick: number): number | null {
    return this.heavyEdgeTick === null || absoluteTick < this.heavyEdgeTick
      ? null
      : absoluteTick - this.heavyEdgeTick;
  }

  private resetAndPause(options: ResetOptions): void {
    assertResetOptions(options);
    this.targetOffsetMicrometres = [...options.targetOffsetMicrometres];
    this.app.prepareP30HeavyStrikeScenario(this.targetOffsetMicrometres);
    this.resetCount += 1;
    this.resetLogs();
  }

  private resetLogs(): void {
    this.armedTicks.clear();
    this.inputEdgeLog.length = 0;
    this.eventLog.length = 0;
    this.fixedInputHistory.length = 0;
    this.stateDigestHistory.length = 0;
    this.cameraHistory.length = 0;
    this.healthSeries.length = 0;
    this.errors.length = 0;
    this.heavyEdgeTick = null;
    this.eventSerial = 0;
    this.lastCameraTick = null;
    const state = this.app.getSnapshot();
    this.recordStateDigest(state);
    this.healthSeries.push({ absoluteTick: state.tick, health: state.enemy.health });
  }

  private armCaptureTicks(ticks: number[]): void {
    if (!Array.isArray(ticks)) throw new Error("armCaptureTicks expects an array");
    const currentTick = this.app.getSnapshot().tick;
    for (const tick of ticks) {
      if (!Number.isSafeInteger(tick) || tick < 0) {
        throw new Error(`Capture tick must be a non-negative safe integer: ${tick}`);
      }
      if (tick <= currentTick) {
        throw new Error(`Capture tick ${tick} is not ahead of current absolute tick ${currentTick}`);
      }
      if (this.armedTicks.has(tick)) throw new Error(`Capture tick is duplicated: ${tick}`);
      this.armedTicks.add(tick);
    }
  }

  private afterFixedUpdate(receipt: ProductionFixedUpdateReceipt): boolean {
    const absoluteTick = receipt.state.tick;
    if (receipt.input.heavyAttackPressed) this.recordHeavyEdge(receipt);
    if (receipt.input.attackPressed) this.recordLightEdge(receipt);
    this.recordEvents(receipt);
    this.fixedInputHistory.push({
      absoluteSimulationTick: absoluteTick,
      heavyRelativeTick: this.heavyRelativeTick(absoluteTick),
      moveX: quantize(receipt.input.moveX),
      moveZ: quantize(receipt.input.moveZ),
      sprint: receipt.input.sprint,
      dodgePressed: receipt.input.dodgePressed,
      attackPressed: receipt.input.attackPressed,
      heavyAttackPressed: receipt.input.heavyAttackPressed ?? false,
      faceYaw: receipt.input.faceYaw === undefined ? null : quantize(receipt.input.faceYaw),
    });
    this.recordStateDigest(receipt.state);
    this.healthSeries.push({ absoluteTick, health: receipt.state.enemy.health });
    return !this.armedTicks.delete(absoluteTick);
  }

  private recordHeavyEdge(receipt: ProductionFixedUpdateReceipt): void {
    const tick = receipt.state.tick;
    if (this.heavyEdgeTick !== null) {
      this.errors.push(`Duplicate heavy rising edge at absolute tick ${tick}`);
      return;
    }
    this.heavyEdgeTick = tick;
    const mouse = receipt.heavyStrikeSource === "mouse-right";
    const keyboard = receipt.heavyStrikeSource === "keyboard";
    this.inputEdgeLog.push({
      eventID: `input-${String(this.inputEdgeLog.length + 1).padStart(4, "0")}`,
      action: "heavy-strike",
      phase: "rising",
      device: mouse ? "mouse" : keyboard ? "keyboard" : "unknown",
      button: mouse ? "right" : null,
      code: keyboard ? "KeyK" : null,
      absoluteSimulationTick: tick,
      heavyRelativeTick: 0,
    });
  }

  private recordLightEdge(receipt: ProductionFixedUpdateReceipt): void {
    const mouse = receipt.lightStrikeSource === "mouse-left";
    this.inputEdgeLog.push({
      eventID: `input-${String(this.inputEdgeLog.length + 1).padStart(4, "0")}`,
      action: "light-strike",
      phase: "rising",
      device: mouse ? "mouse" : receipt.lightStrikeSource === "keyboard" ? "keyboard" : "unknown",
      button: mouse ? "left" : null,
      code: null,
      absoluteSimulationTick: receipt.state.tick,
      heavyRelativeTick: this.heavyRelativeTick(receipt.state.tick),
    });
  }

  private recordEvents(receipt: ProductionFixedUpdateReceipt): void {
    for (const event of receipt.events) {
      this.eventSerial += 1;
      const mapped: RuntimeEventReceipt = {
        eventID: `event-${String(this.eventSerial).padStart(4, "0")}`,
        type: event.type,
        absoluteSimulationTick: event.tick,
        heavyRelativeTick: this.heavyRelativeTick(event.tick),
      };
      if ("attackSerial" in event) mapped.attackSerial = event.attackSerial;
      if (event.type === "enemy-hit" || event.type === "heavy-damage") {
        mapped.damage = event.damage;
        mapped.healthBefore = receipt.healthBefore;
        mapped.healthAfter = receipt.healthAfter;
      }
      this.eventLog.push(mapped);
    }
  }

  private recordStateDigest(state: WorldState): void {
    const quantizedState = quantizedWorldState(state);
    const bcj = canonicalizeBcj(quantizedState);
    this.stateDigestHistory.push({
      absoluteSimulationTick: state.tick,
      heavyRelativeTick: this.heavyRelativeTick(state.tick),
      quantizationScale: QUANTIZATION_SCALE,
      quantizedState,
      bcjVersion: "BCJ-v1",
      bcj,
      sha256: sha256Hex(bcj),
    });
  }

  private afterRender(receipt: ProductionRenderReceipt): void {
    if (receipt.absoluteSimulationTick === this.lastCameraTick) return;
    const camera = this.app.getCameraTelemetry();
    const quantized: BcjObject = {
      absoluteSimulationTick: receipt.absoluteSimulationTick,
      heavyRelativeTick: this.heavyRelativeTick(receipt.absoluteSimulationTick),
      position: camera.position.map(quantize),
      quaternion: camera.quaternion.map(quantize),
      viewMatrix: camera.viewMatrix.map(quantize),
      projectionMatrix: camera.projectionMatrix.map(quantize),
    };
    const bcj = canonicalizeBcj(quantized);
    this.cameraHistory.push({
      ...quantized,
      sha256: sha256Hex(bcj),
    });
    this.lastCameraTick = receipt.absoluteSimulationTick;
  }

  snapshot(): Readonly<Record<string, unknown>> {
    const state = this.app.getSnapshot();
    const mode = this.app.getProductionModeTelemetry();
    const renderer = this.app.getRendererTelemetry();
    const contact = this.app.getHeavyContactTelemetry();
    const currentDigest = this.stateDigestHistory[this.stateDigestHistory.length - 1]!;
    return cloneJson({
      schema: "p30.r012a.snapshot.v1",
      scenarioID: P30_SCENARIO_ID,
      seed: P30_SCENARIO_SEED,
      absoluteSimulationTick: state.tick,
      heavyRelativeTick: this.heavyRelativeTick(state.tick),
      fixedDelta: { numerator: 1, denominator: 60 },
      paused: this.app.isSimulationPaused,
      capturePaused: this.app.isRuntimeCapturePaused,
      renderHeartbeat: this.app.currentRenderHeartbeat,
      attacker: {
        action: state.player.attackKind,
        motion: state.player.motion,
        attackFrame: state.player.attackFrame,
        attackPhase: state.player.attackPhase,
        attackSerial: state.player.attackSerial,
        attackHasHit: state.player.attackHasHit,
      },
      target: {
        health: state.enemy.health,
        motion: state.enemy.motion,
        hitStunRemaining: state.enemy.hitStunRemaining,
      },
      contact,
      inputEdgeLog: this.inputEdgeLog,
      eventLog: this.eventLog,
      authoritativeState: currentDigest,
      rendererMode: mode.rendererMode,
      assetTier: mode.assetTier,
      fallbackActive: mode.fallbackActive,
      context: renderer.context,
      errors: [...this.errors, ...renderer.errors],
    });
  }

  runReceipt(): Readonly<Record<string, unknown>> {
    const state = this.app.getSnapshot();
    return cloneJson({
      schema: "p30.r012a.run-receipt.v1",
      scenarioID: P30_SCENARIO_ID,
      seed: P30_SCENARIO_SEED,
      fixedDelta: { numerator: 1, denominator: 60 },
      captureTickSpace: "absolute-scenario",
      absoluteSimulationTick: state.tick,
      heavyRisingEdgeAbsoluteTick: this.heavyEdgeTick,
      heavyRelativeTick: this.heavyRelativeTick(state.tick),
      targetOffsetMicrometres: this.targetOffsetMicrometres,
      resetCount: this.resetCount,
      uninterrupted: true,
      inputEdgeLog: this.inputEdgeLog,
      eventLog: this.eventLog,
      fixedInputHistory: this.fixedInputHistory,
      cameraHistory: this.cameraHistory,
      stateDigestHistory: this.stateDigestHistory,
      healthByTick: this.healthSeries,
      contact: this.app.getHeavyContactTelemetry(),
      errors: this.errors,
    });
  }

  resourceReceipt(): Readonly<Record<string, unknown>> {
    const renderer = this.app.getRendererTelemetry();
    const mode = this.app.getProductionModeTelemetry();
    return cloneJson({
      schema: "p30.r012a.resource-receipt.v1",
      rendererMode: mode.rendererMode,
      assetTier: mode.assetTier,
      fallbackActive: mode.fallbackActive,
      renderer: {
        calls: renderer.calls,
        triangles: renderer.triangles,
        points: renderer.points,
        lines: renderer.lines,
        textures: renderer.textures,
        geometries: renderer.geometries,
        pixelRatio: renderer.pixelRatio,
        size: renderer.size,
      },
      context: renderer.context,
      assets: this.app.getAssetLoadReceipt(),
      canvasCount: document.querySelectorAll("canvas").length,
    });
  }
}

export function installP30CriticHarness(app: GameApp): P30CriticApi {
  const controller = new P30CriticController(app);
  window.__P30_CRITIC__ = controller.api;
  return controller.api;
}
