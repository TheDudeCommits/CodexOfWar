import type * as THREE from "three";
import type { BcjObject, BcjValue } from "./CanonicalStateDigest";
import { canonicalizeBcj, sha256Hex } from "./CanonicalStateDigest";
import {
  assertP30ResetOptions,
  P30_FIXED_DELTA_DENOMINATOR,
  P30_FIXED_DELTA_NUMERATOR,
  P30_HEAVY_RISING_EDGE_ABSOLUTE_TICK,
  P30_PROTOCOL_ID,
  P30_RESOURCE_RECEIPT_SCHEMA,
  P30_RUN_RECEIPT_SCHEMA,
  P30_RUNTIME_HOOK_SCHEMA,
  P30_SCENARIO_ID,
  P30_SCENARIO_SEED,
  P30_SNAPSHOT_SCHEMA,
  type P30ResetOptions,
} from "./P30CriticProtocol";
import type { GameEvent, WorldState } from "../game/simulation/types";
import type {
  GameApp,
  ProductionFixedUpdateReceipt,
  ProductionRenderReceipt,
} from "../render/app/GameApp";

type Vector3Receipt = [number, number, number];
type QuaternionReceipt = [number, number, number, number];

export interface P30TargetLandmarkBones {
  pelvis: THREE.Bone;
  neck: THREE.Bone;
  head: THREE.Bone;
  leftShoulder: THREE.Bone;
  leftElbow: THREE.Bone;
  leftWrist: THREE.Bone;
  rightShoulder: THREE.Bone;
  rightElbow: THREE.Bone;
  rightWrist: THREE.Bone;
  leftHip: THREE.Bone;
  leftKnee: THREE.Bone;
  leftAnkle: THREE.Bone;
  rightHip: THREE.Bone;
  rightKnee: THREE.Bone;
  rightAnkle: THREE.Bone;
}

export interface P30GeometrySource {
  scene: THREE.Scene;
  camera: THREE.Camera;
  heroRoot: THREE.Object3D;
  leftHandBone: THREE.Bone;
  rightHandBone: THREE.Bone;
  swordBladePrimitives: Array<{
    mesh: THREE.Mesh;
    materialGroupIndices: number[];
  }>;
  targetRoot: THREE.Object3D;
  targetSkinnedMeshes: THREE.SkinnedMesh[];
  targetLandmarkBones: P30TargetLandmarkBones;
  healthStore: object;
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

interface InputEdgeReceipt {
  eventID: string;
  action: "heavy-strike" | "light-strike";
  phase: "rising";
  device: "mouse" | "keyboard" | "unknown";
  button: "left" | "right" | null;
  absoluteSimulationTick: number;
  heavyRelativeTick: 0 | null;
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
  separationMicrometres?: number;
}

export interface P30CriticApi {
  readonly schema: typeof P30_RUNTIME_HOOK_SCHEMA;
  whenReady: () => Promise<void>;
  resetAndPause: (options: P30ResetOptions) => Promise<void>;
  armCaptureTicks: (absoluteScenarioTicks: number[]) => void;
  resume: () => void;
  snapshot: () => Readonly<Record<string, unknown>>;
  runReceipt: () => Readonly<Record<string, unknown>>;
  resourceReceipt: () => Readonly<Record<string, unknown>>;
  geometrySource: () => P30GeometrySource;
}

declare global {
  interface Window {
    __P30_CRITIC__?: P30CriticApi;
  }
}

const QUANTIZATION_SCALE = 1_000_000 as const;

function quantize(value: number): number {
  if (!Number.isFinite(value)) throw new Error(`Non-finite state value: ${String(value)}`);
  const scaled = Math.abs(value) * QUANTIZATION_SCALE;
  const result = Math.sign(value) * Math.floor(scaled + 0.5);
  if (!Number.isSafeInteger(result)) throw new Error(`Unsafe quantized state value: ${value}`);
  return Object.is(result, -0) ? 0 : result;
}

function round6(value: number): number {
  return quantize(value) / QUANTIZATION_SCALE;
}

function vector3(value: readonly number[]): Vector3Receipt {
  return [round6(value[0]!), round6(value[1]!), round6(value[2]!)];
}

function quaternionForRootYaw(yaw: number): QuaternionReceipt {
  const half = -yaw * 0.5;
  return [0, round6(Math.sin(half)), 0, round6(Math.cos(half))];
}

function transform(
  position: Vector3Receipt,
  quaternion: QuaternionReceipt,
): { position: Vector3Receipt; quaternion: QuaternionReceipt } {
  return { position, quaternion };
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
      attackKind: state.player.attackKind,
      heavyRelativeTick: state.player.heavyRelativeTick,
      attackSerial: state.player.attackSerial,
      attackHasHit: state.player.attackHasHit,
      dodgeRemaining: quantize(state.player.dodgeRemaining),
      invulnerableRemaining: quantize(state.player.invulnerableRemaining),
    },
    target: {
      position: [
        quantize(state.enemy.position.x),
        quantize(state.enemy.positionY),
        quantize(state.enemy.position.z),
      ],
      yaw: quantize(state.enemy.yaw),
      health: state.enemy.health,
      motion: state.enemy.motion,
      hitStunRemaining: quantize(state.enemy.hitStunRemaining),
      idlePhase: quantize(state.enemy.idlePhase),
    },
  };
}

function copyJson<T>(value: T): T {
  return structuredClone(value);
}

function eventTick(event: GameEvent, fallbackTick: number): number {
  return "tick" in event && Number.isSafeInteger(event.tick) ? event.tick : fallbackTick;
}

export function isValidP30ResetPauseState(
  simulationPaused: boolean,
  capturePaused: boolean,
): boolean {
  return simulationPaused && capturePaused;
}

class P30CriticController {
  private readonly armedTicks = new Set<number>();
  private readonly inputEdgeLog: InputEdgeReceipt[] = [];
  private readonly eventLog: RuntimeEventReceipt[] = [];
  private readonly fixedInputHistory: Array<Record<string, BcjValue>> = [];
  private readonly stateDigestHistory: StateDigestReceipt[] = [];
  private readonly cameraHistory: Array<Record<string, unknown>> = [];
  private readonly errors: string[] = [];
  private heavyEdgeAbsoluteTick: number | null = null;
  private targetOffsetMicrometres: Vector3Receipt = [0, 0, 0];
  private eventSerial = 0;
  private lastCameraTick: number | null = null;

  readonly api: P30CriticApi;

  constructor(private readonly app: GameApp) {
    this.api = Object.freeze({
      schema: P30_RUNTIME_HOOK_SCHEMA,
      whenReady: async () => Promise.resolve(),
      resetAndPause: (options: P30ResetOptions) => this.resetAndPause(options),
      armCaptureTicks: (ticks: number[]) => this.armCaptureTicks(ticks),
      resume: () => this.app.resumeRuntimeCapture(),
      snapshot: () => this.snapshot(),
      runReceipt: () => this.runReceipt(),
      resourceReceipt: () => this.resourceReceipt(),
      geometrySource: () => this.app.getP30GeometrySource() as P30GeometrySource,
    });
    this.app.setProductionRuntimeObserver({
      afterFixedUpdate: (receipt) => this.afterFixedUpdate(receipt),
      afterRender: (receipt) => this.afterRender(receipt),
    });
    this.recordStateDigest(this.app.getSnapshot());
  }

  private heavyRelativeTick(absoluteSimulationTick: number): number | null {
    if (
      this.heavyEdgeAbsoluteTick === null ||
      absoluteSimulationTick < this.heavyEdgeAbsoluteTick
    ) return null;
    return absoluteSimulationTick - this.heavyEdgeAbsoluteTick;
  }

  private async resetAndPause(options: P30ResetOptions): Promise<void> {
    assertP30ResetOptions(options);
    this.clearRunState();
    const targetOffsetMicrometres: Vector3Receipt = [
      options.targetOffsetMicrometres[0],
      options.targetOffsetMicrometres[1],
      options.targetOffsetMicrometres[2],
    ];
    await this.app.resetAndPauseP30Scenario({
      seed: P30_SCENARIO_SEED,
      targetOffsetMicrometres,
    });
    this.targetOffsetMicrometres = targetOffsetMicrometres;
    const state = this.app.getSnapshot();
    if (state.tick !== -1) {
      this.errors.push(`resetAndPause ended at tick ${state.tick}; expected -1`);
    }
    if (!isValidP30ResetPauseState(
      this.app.isSimulationPaused,
      this.app.isRuntimeCapturePaused,
    )) {
      this.errors.push("resetAndPause did not leave the pre-update scenario capture-paused");
    }
    this.recordStateDigest(state);
  }

  private clearRunState(): void {
    this.armedTicks.clear();
    this.inputEdgeLog.length = 0;
    this.eventLog.length = 0;
    this.fixedInputHistory.length = 0;
    this.stateDigestHistory.length = 0;
    this.cameraHistory.length = 0;
    this.errors.length = 0;
    this.heavyEdgeAbsoluteTick = null;
    this.eventSerial = 0;
    this.lastCameraTick = null;
  }

  private armCaptureTicks(ticks: number[]): void {
    if (!Array.isArray(ticks)) throw new Error("Capture ticks must be an array");
    const currentTick = this.app.getSnapshot().tick;
    const validated = new Set<number>();
    for (const tick of ticks) {
      if (!Number.isSafeInteger(tick) || tick < 0) {
        throw new Error(`Capture tick must be a non-negative safe integer: ${String(tick)}`);
      }
      if (tick <= currentTick) {
        throw new Error(`Capture tick ${tick} is not ahead of current absolute tick ${currentTick}`);
      }
      if (validated.has(tick) || this.armedTicks.has(tick)) {
        throw new Error(`Capture tick ${tick} is already armed`);
      }
      validated.add(tick);
    }
    for (const tick of validated) this.armedTicks.add(tick);
  }

  private afterFixedUpdate(receipt: ProductionFixedUpdateReceipt): boolean {
    const absoluteSimulationTick = receipt.state.tick;
    if (receipt.input.heavyAttackPressed) this.recordHeavyEdge(receipt);
    if (receipt.input.attackPressed) this.recordLightEdge(receipt);
    this.recordEvents(receipt);
    this.fixedInputHistory.push({
      absoluteSimulationTick,
      heavyRelativeTick: this.heavyRelativeTick(absoluteSimulationTick),
      moveX: quantize(receipt.input.moveX),
      moveZ: quantize(receipt.input.moveZ),
      sprint: receipt.input.sprint,
      dodgePressed: receipt.input.dodgePressed,
      attackPressed: receipt.input.attackPressed,
      heavyAttackPressed: receipt.input.heavyAttackPressed,
      faceYaw: receipt.input.faceYaw === undefined ? null : quantize(receipt.input.faceYaw),
    });
    this.recordStateDigest(receipt.state);
    return !this.armedTicks.delete(absoluteSimulationTick);
  }

  private recordHeavyEdge(receipt: ProductionFixedUpdateReceipt): void {
    const absoluteSimulationTick = receipt.state.tick;
    if (this.heavyEdgeAbsoluteTick !== null) {
      this.errors.push(`Additional heavy rising edge sampled at tick ${absoluteSimulationTick}`);
      return;
    }
    this.heavyEdgeAbsoluteTick = absoluteSimulationTick;
    // The canonical trace rises at 24, while the locked +7 causality trace
    // intentionally rises at 31. Record the trusted edge and let the
    // evaluator compare it to the selected tape instead of treating the
    // shifted trace as a runtime error.
    const source = receipt.heavyStrikeSource;
    this.inputEdgeLog.push({
      eventID: `input-${String(this.inputEdgeLog.length + 1).padStart(4, "0")}`,
      action: "heavy-strike",
      phase: "rising",
      device: source === "mouse-right" ? "mouse" : source === "keyboard" ? "keyboard" : "unknown",
      button: source === "mouse-right" ? "right" : null,
      absoluteSimulationTick,
      heavyRelativeTick: 0,
    });
  }

  private recordLightEdge(receipt: ProductionFixedUpdateReceipt): void {
    const source = receipt.lightStrikeSource;
    this.inputEdgeLog.push({
      eventID: `input-${String(this.inputEdgeLog.length + 1).padStart(4, "0")}`,
      action: "light-strike",
      phase: "rising",
      device: source === "mouse-left" ? "mouse" : source === "keyboard" ? "keyboard" : "unknown",
      button: source === "mouse-left" ? "left" : null,
      absoluteSimulationTick: receipt.state.tick,
      heavyRelativeTick: null,
    });
  }

  private recordEvents(receipt: ProductionFixedUpdateReceipt): void {
    for (const event of receipt.events) {
      this.eventSerial += 1;
      const absoluteSimulationTick = eventTick(event, receipt.state.tick);
      const mapped: RuntimeEventReceipt = {
        eventID: `event-${String(this.eventSerial).padStart(4, "0")}`,
        type: event.type,
        absoluteSimulationTick,
        heavyRelativeTick:
          "heavyRelativeTick" in event
            ? event.heavyRelativeTick
            : this.heavyRelativeTick(absoluteSimulationTick),
      };
      if ("attackSerial" in event) mapped.attackSerial = event.attackSerial;
      if (event.type === "enemy-hit" || event.type === "heavy-damage") {
        mapped.damage = event.damage;
        mapped.healthBefore = receipt.healthBefore;
        mapped.healthAfter = receipt.healthAfter;
      }
      if (event.type === "heavy-contact") {
        mapped.separationMicrometres = event.separationMicrometres;
      }
      this.eventLog.push(mapped);
    }
  }

  private recordStateDigest(state: WorldState): void {
    if (
      this.stateDigestHistory.at(-1)?.absoluteSimulationTick === state.tick
    ) return;
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
    if (this.lastCameraTick === receipt.absoluteSimulationTick) return;
    const camera = this.app.getCameraTelemetry();
    this.cameraHistory.push({
      absoluteSimulationTick: receipt.absoluteSimulationTick,
      heavyRelativeTick: this.heavyRelativeTick(receipt.absoluteSimulationTick),
      position: vector3(camera.position),
      quaternion: camera.quaternion.map(round6) as QuaternionReceipt,
      viewMatrix: camera.viewMatrix.map(round6),
      projectionMatrix: camera.projectionMatrix.map(round6),
    });
    this.lastCameraTick = receipt.absoluteSimulationTick;
  }

  private currentDigest(state: WorldState): StateDigestReceipt {
    for (let index = this.stateDigestHistory.length - 1; index >= 0; index -= 1) {
      const existing = this.stateDigestHistory[index]!;
      if (existing.absoluteSimulationTick === state.tick) return existing;
    }
    const quantizedState = quantizedWorldState(state);
    const bcj = canonicalizeBcj(quantizedState);
    return {
      absoluteSimulationTick: state.tick,
      heavyRelativeTick: this.heavyRelativeTick(state.tick),
      quantizationScale: QUANTIZATION_SCALE,
      quantizedState,
      bcjVersion: "BCJ-v1",
      bcj,
      sha256: sha256Hex(bcj),
    };
  }

  private snapshot(): Readonly<Record<string, unknown>> {
    const state = this.app.getSnapshot();
    const camera = this.app.getCameraTelemetry();
    const renderer = this.app.getRendererTelemetry();
    const mode = this.app.getProductionModeTelemetry();
    return copyJson({
      schema: P30_SNAPSHOT_SCHEMA,
      protocolID: P30_PROTOCOL_ID,
      scenarioID: P30_SCENARIO_ID,
      seed: P30_SCENARIO_SEED,
      fixedDelta: {
        numerator: P30_FIXED_DELTA_NUMERATOR,
        denominator: P30_FIXED_DELTA_DENOMINATOR,
      },
      captureTickSpace: "absolute-scenario",
      targetOffsetMicrometres: [...this.targetOffsetMicrometres],
      absoluteSimulationTick: state.tick,
      heavyRelativeTick: this.heavyRelativeTick(state.tick),
      paused: this.app.isSimulationPaused,
      capturePaused: this.app.isRuntimeCapturePaused,
      renderHeartbeat: this.app.currentRenderHeartbeat,
      camera: {
        worldTransform: transform(
          vector3(camera.position),
          camera.quaternion.map(round6) as QuaternionReceipt,
        ),
        viewMatrix: camera.viewMatrix.map(round6),
        projectionMatrix: camera.projectionMatrix.map(round6),
        viewport: { ...renderer.size, pixelRatio: renderer.pixelRatio },
      },
      attacker: {
        root: transform(
          [round6(state.player.position.x), 0, round6(state.player.position.z)],
          quaternionForRootYaw(state.player.yaw),
        ),
        attackKind: state.player.attackKind,
        attackPhase: state.player.attackPhase,
        attackSerial: state.player.attackSerial,
        attackHasHit: state.player.attackHasHit,
      },
      target: {
        root: transform(
          [
            round6(state.enemy.position.x),
            round6(state.enemy.positionY),
            round6(state.enemy.position.z),
          ],
          quaternionForRootYaw(state.enemy.yaw),
        ),
        health: state.enemy.health,
      },
      candidateGeometryContact: this.app.getHeavyContactReceipt(),
      inputEdgeLog: this.inputEdgeLog,
      eventLog: this.eventLog,
      authoritativeState: this.currentDigest(state),
      rendererMode: mode.rendererMode,
      assetTier: mode.assetTier,
      fallbackActive: mode.fallbackActive,
      context: { ...renderer.context },
      errors: [...this.errors, ...renderer.errors],
    });
  }

  private runReceipt(): Readonly<Record<string, unknown>> {
    const state = this.app.getSnapshot();
    return copyJson({
      schema: P30_RUN_RECEIPT_SCHEMA,
      protocolID: P30_PROTOCOL_ID,
      scenarioID: P30_SCENARIO_ID,
      seed: P30_SCENARIO_SEED,
      fixedDelta: {
        numerator: P30_FIXED_DELTA_NUMERATOR,
        denominator: P30_FIXED_DELTA_DENOMINATOR,
      },
      captureTickSpace: "absolute-scenario",
      targetOffsetMicrometres: [...this.targetOffsetMicrometres],
      heavyRisingEdgeAbsoluteTick: this.heavyEdgeAbsoluteTick,
      expectedHeavyRisingEdgeAbsoluteTick: P30_HEAVY_RISING_EDGE_ABSOLUTE_TICK,
      absoluteSimulationTick: state.tick,
      heavyRelativeTick: this.heavyRelativeTick(state.tick),
      inputEdgeLog: this.inputEdgeLog,
      eventLog: this.eventLog,
      fixedInputHistory: this.fixedInputHistory,
      cameraHistory: this.cameraHistory,
      stateDigestHistory: this.stateDigestHistory,
      errors: [...this.errors],
    });
  }

  private resourceReceipt(): Readonly<Record<string, unknown>> {
    const renderer = this.app.getRendererTelemetry();
    const mode = this.app.getProductionModeTelemetry();
    return copyJson({
      schema: P30_RESOURCE_RECEIPT_SCHEMA,
      protocolID: P30_PROTOCOL_ID,
      scenarioID: P30_SCENARIO_ID,
      seed: P30_SCENARIO_SEED,
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
  if (window.__P30_CRITIC__) throw new Error("P30 critic hook is already installed");
  const controller = new P30CriticController(app);
  window.__P30_CRITIC__ = controller.api;
  return controller.api;
}
