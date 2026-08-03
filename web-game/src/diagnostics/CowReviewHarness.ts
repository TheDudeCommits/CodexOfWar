import { EMPTY_INPUT } from "../game/simulation/GameSimulation";
import type { GameEvent, InputFrame, WorldState } from "../game/simulation/types";
import type { GameApp } from "../render/app/GameApp";
import type { CameraTelemetry } from "../render/app/ThirdPersonCamera";

export type ReviewActionPhase = "down" | "up" | "value";

export interface ReviewAction {
  tick: number;
  action: string;
  phase: ReviewActionPhase;
  value?: number;
}

export interface ReviewResetOptions {
  piece?: string;
  preset?: "P30" | string;
  seed?: number;
}

export interface ReadyReceipt {
  schema: "cow.review.v1";
  piece: string;
  preset: string;
  seed: 30001;
  viewport: { width: 1600; height: 900; dpr: 1 };
  rapier: "ready";
  assets: "ready";
  renderer: "compiled-and-warm";
}

export interface ReviewEvent {
  tick: number;
  type:
    | "attack_started"
    | "attack_rejected_busy"
    | "enemy_hit"
    | "enemy_defeated"
    | "dodge_started";
  damage?: number;
  hpBefore?: number;
  hpAfter?: number;
  attackSerial?: number;
}

export interface ReviewSnapshot {
  tick: number;
  seed: number;
  piece: string;
  preset: string;
  paused: boolean;
  pointerLocked: boolean;
  coordinates: "+Y up / +X right / -Z forward";
  player: {
    position: { x: number; y: 0; z: number };
    yaw: number;
    health: number;
    stamina: number;
    motion: string;
    attackPhase: string;
    attackFrame: number;
  };
  target: {
    position: { x: number; y: 0; z: number };
    health: number;
    motion: string;
  };
  state: WorldState;
}

export interface ReviewTelemetry {
  ready: true;
  tick: number;
  seed: number;
  piece: string;
  preset: string;
  paused: boolean;
  state: ReviewSnapshot;
  events: ReviewEvent[];
  history: ReviewSnapshot[];
  camera: CameraTelemetry;
  renderer: ReturnType<GameApp["getRendererTelemetry"]>;
  assetLoad: ReturnType<GameApp["getAssetLoadReceipt"]>;
  framing: ReturnType<GameApp["getCameraFramingTelemetry"]> | null;
  errors: string[];
  cameraObstruction: {
    implemented: true;
    status: CameraTelemetry["boom"]["status"];
    telemetryHook: true;
    desiredDistance: number;
    resolvedDistance: number;
    collisionApplied: boolean;
  };
}

export interface CowReviewApi {
  schema: "cow.review.v1";
  ready: Promise<ReadyReceipt>;
  piece: string;
  seed: 30001;
  viewport: { width: 1600; height: 900; dpr: 1 };
  reset: (options?: ReviewResetOptions) => ReviewSnapshot;
  queue: (actions: ReviewAction[]) => void;
  queueActions: (actions: ReviewAction[]) => void;
  stepTicks: (count: number) => ReviewSnapshot;
  renderOnce: () => ReviewSnapshot;
  snapshot: () => ReviewSnapshot;
  telemetry: () => ReviewTelemetry;
  forceContextLoss: () => boolean;
  forceContextRestore: () => boolean;
}

export interface CowReviewReadyGate {
  resolve: (receipt: ReadyReceipt) => void;
  reject: (reason: unknown) => void;
}

declare global {
  interface Window {
    __COW_REVIEW__: CowReviewApi;
  }
}

interface HeldActions {
  forward: number;
  backward: number;
  left: number;
  right: number;
  sprint: boolean;
}

export function installCowReviewReadyGate(): CowReviewReadyGate {
  let resolveReady!: (receipt: ReadyReceipt) => void;
  let rejectReady!: (reason: unknown) => void;
  const ready = new Promise<ReadyReceipt>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  const unavailable = (): never => {
    throw new Error("window.__COW_REVIEW__ is not ready; await its ready promise first");
  };
  window.__COW_REVIEW__ = {
    schema: "cow.review.v1",
    ready,
    piece: "P30",
    seed: 30001,
    viewport: { width: 1600, height: 900, dpr: 1 },
    reset: unavailable,
    queue: unavailable,
    queueActions: unavailable,
    stepTicks: unavailable,
    renderOnce: unavailable,
    snapshot: unavailable,
    telemetry: unavailable,
    forceContextLoss: unavailable,
    forceContextRestore: unavailable,
  };
  return { resolve: resolveReady, reject: rejectReady };
}

class ReviewController {
  private tick = 0;
  private seed = 30001;
  private piece = "P30";
  private preset = "P30";
  private readonly queueByTick = new Map<number, ReviewAction[]>();
  private readonly held: HeldActions = {
    forward: 0,
    backward: 0,
    left: 0,
    right: 0,
    sprint: false,
  };
  private readonly events: ReviewEvent[] = [];
  private readonly history: ReviewSnapshot[] = [];
  private readonly errors: string[] = [];
  private readonly includeFraming = new URLSearchParams(window.location.search).get("framing") === "1";

  constructor(private readonly app: GameApp) {}

  reset(options: ReviewResetOptions = {}): ReviewSnapshot {
    this.seed = options.seed ?? 30001;
    this.piece = options.piece ?? "P30";
    this.preset = options.preset ?? "P30";
    this.tick = 0;
    this.queueByTick.clear();
    this.events.length = 0;
    this.history.length = 0;
    this.errors.length = 0;
    this.held.forward = 0;
    this.held.backward = 0;
    this.held.left = 0;
    this.held.right = 0;
    this.held.sprint = false;
    this.app.resetForReview();
    return this.snapshot();
  }

  queue(actions: ReviewAction[]): void {
    for (const action of actions) {
      if (!Number.isInteger(action.tick) || action.tick < 0) {
        this.errors.push(`Invalid action tick: ${action.tick}`);
        continue;
      }
      const atTick = this.queueByTick.get(action.tick) ?? [];
      atTick.push({ ...action });
      this.queueByTick.set(action.tick, atTick);
    }
  }

  stepTicks(count: number): ReviewSnapshot {
    const safeCount = Math.max(0, Math.floor(count));
    for (let index = 0; index < safeCount; index += 1) this.stepOne();
    this.app.renderOnce(false, false);
    return this.snapshot();
  }

  renderOnce(): ReviewSnapshot {
    this.app.renderOnce(false, false);
    return this.snapshot();
  }

  snapshot(): ReviewSnapshot {
    const state = this.app.getSnapshot();
    return {
      tick: this.tick,
      seed: this.seed,
      piece: this.piece,
      preset: this.preset,
      paused: this.app.isSimulationPaused,
      pointerLocked: document.pointerLockElement !== null,
      coordinates: "+Y up / +X right / -Z forward",
      player: {
        position: { x: state.player.position.x, y: 0, z: state.player.position.z },
        yaw: state.player.yaw,
        health: state.player.health,
        stamina: state.player.stamina,
        motion: state.player.motion,
        attackPhase: state.player.attackPhase,
        attackFrame: state.player.attackFrame,
      },
      target: {
        position: { x: state.enemy.position.x, y: 0, z: state.enemy.position.z },
        health: state.enemy.health,
        motion: state.enemy.motion,
      },
      state,
    };
  }

  telemetry(): ReviewTelemetry {
    const camera = this.app.getCameraTelemetry();
    return {
      ready: true,
      tick: this.tick,
      seed: this.seed,
      piece: this.piece,
      preset: this.preset,
      paused: this.app.isSimulationPaused,
      state: this.snapshot(),
      events: this.events.map((event) => ({ ...event })),
      history: this.history.map((snapshot) => structuredClone(snapshot)),
      camera,
      renderer: this.app.getRendererTelemetry(),
      assetLoad: this.app.getAssetLoadReceipt(),
      framing: this.includeFraming ? this.app.getCameraFramingTelemetry() : null,
      errors: [...this.errors],
      cameraObstruction: {
        implemented: true,
        status: camera.boom.status,
        telemetryHook: true,
        desiredDistance: camera.boom.desiredDistance,
        resolvedDistance: camera.boom.resolvedDistance,
        collisionApplied: camera.boom.collisionApplied,
      },
    };
  }

  private stepOne(): void {
    const physical = this.app.samplePhysicalInput();
    if (physical.pausePressed) this.app.setReviewPaused(!this.app.isSimulationPaused);

    const ephemeral: HeldActions = {
      forward: 0,
      backward: 0,
      left: 0,
      right: 0,
      sprint: false,
    };
    let attackPressed = physical.attackPressed;
    let dodgePressed = physical.dodgePressed;
    const actions = this.queueByTick.get(this.tick) ?? [];
    for (const action of actions) {
      const value = action.value ?? 1;
      if (action.action === "camera.reset" && action.phase !== "up") {
        this.app.resetCamera();
      } else if (action.action === "attack.primary") {
        if (action.phase === "down") attackPressed = true;
      } else if (action.action === "dodge") {
        if (action.phase === "down") dodgePressed = true;
      } else if (action.action === "move.forward") {
        this.applyAxisAction("forward", action.phase, value, ephemeral);
      } else if (action.action === "move.backward") {
        this.applyAxisAction("backward", action.phase, value, ephemeral);
      } else if (action.action === "move.left") {
        this.applyAxisAction("left", action.phase, value, ephemeral);
      } else if (action.action === "move.right") {
        this.applyAxisAction("right", action.phase, value, ephemeral);
      } else if (action.action === "move.sprint") {
        if (action.phase === "down") this.held.sprint = true;
        else if (action.phase === "up") this.held.sprint = false;
        else ephemeral.sprint = value > 0;
      } else {
        this.errors.push(`Unknown action '${action.action}' at tick ${this.tick}`);
      }
    }

    const input: InputFrame = {
      ...EMPTY_INPUT,
      moveX:
        this.held.right -
        this.held.left +
        ephemeral.right -
        ephemeral.left +
        physical.moveX,
      moveZ:
        -this.held.forward +
        this.held.backward -
        ephemeral.forward +
        ephemeral.backward -
        physical.moveZ,
      sprint: this.held.sprint || ephemeral.sprint || physical.sprint,
      attackPressed,
      dodgePressed,
    };
    const hpBefore = this.app.getSnapshot().enemy.health;
    const simulationEvents = this.app.stepReviewFrame(input);
    const hpAfter = this.app.getSnapshot().enemy.health;
    for (const event of simulationEvents) this.events.push(this.mapEvent(event, hpBefore, hpAfter));
    this.history.push(this.snapshotAtProcessedTick(this.tick));
    this.tick += 1;
  }

  private applyAxisAction(
    axis: "forward" | "backward" | "left" | "right",
    phase: ReviewActionPhase,
    value: number,
    ephemeral: HeldActions,
  ): void {
    if (phase === "down") this.held[axis] = value;
    else if (phase === "up") this.held[axis] = 0;
    else ephemeral[axis] = value;
  }

  private mapEvent(event: GameEvent, hpBefore: number, hpAfter: number): ReviewEvent {
    switch (event.type) {
      case "attack-started":
        return { tick: this.tick, type: "attack_started", attackSerial: event.attackSerial };
      case "heavy-started":
        return { tick: this.tick, type: "attack_started", attackSerial: event.attackSerial };
      case "attack-rejected-busy":
        return { tick: this.tick, type: "attack_rejected_busy", attackSerial: event.attackSerial };
      case "enemy-hit":
        return {
          tick: this.tick,
          type: "enemy_hit",
          damage: event.damage,
          hpBefore,
          hpAfter,
          attackSerial: event.attackSerial,
        };
      case "heavy-damage":
        return {
          tick: this.tick,
          type: "enemy_hit",
          damage: event.damage,
          hpBefore,
          hpAfter,
          attackSerial: event.attackSerial,
        };
      case "heavy-contact":
        return { tick: this.tick, type: "attack_started", attackSerial: event.attackSerial };
      case "enemy-defeated":
        return { tick: this.tick, type: "enemy_defeated", attackSerial: event.attackSerial };
      case "dodge-started":
        return { tick: this.tick, type: "dodge_started" };
    }
  }

  private snapshotAtProcessedTick(processedTick: number): ReviewSnapshot {
    const snapshot = this.snapshot();
    snapshot.tick = processedTick;
    return snapshot;
  }
}

export function installCowReviewHarness(app: GameApp, initializeP30: boolean): CowReviewApi {
  const controller = new ReviewController(app);
  if (initializeP30) controller.reset({ preset: "P30", seed: 30001 });
  const queue = (actions: ReviewAction[]): void => controller.queue(actions);
  const api: CowReviewApi = {
    schema: "cow.review.v1",
    ready: Promise.resolve({
      schema: "cow.review.v1",
      piece: "P30",
      preset: "P30",
      seed: 30001,
      viewport: { width: 1600, height: 900, dpr: 1 },
      rapier: "ready",
      assets: "ready",
      renderer: "compiled-and-warm",
    }),
    piece: "P30",
    seed: 30001,
    viewport: { width: 1600, height: 900, dpr: 1 },
    reset: (options) => controller.reset(options),
    queue,
    queueActions: queue,
    stepTicks: (count) => controller.stepTicks(count),
    renderOnce: () => controller.renderOnce(),
    snapshot: () => controller.snapshot(),
    telemetry: () => controller.telemetry(),
    forceContextLoss: () => app.forceContextLoss(),
    forceContextRestore: () => app.forceContextRestore(),
  };
  window.__COW_REVIEW__ = api;
  return api;
}
