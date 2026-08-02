import type { BcjObject, BcjValue } from "./CanonicalStateDigest";
import { canonicalizeBcj, sha256Hex } from "./CanonicalStateDigest";
import {
  P30_ATTACK_EDGE_ABSOLUTE_TICK,
  P30_FIXED_DELTA,
  P30_SCENARIO_ID,
  P30_SCENARIO_SEED,
} from "./P30CriticProtocol";
import type { GameEvent, WorldState } from "../game/simulation/types";
import type {
  GameApp,
  ProductionFixedUpdateReceipt,
  ProductionRenderReceipt,
} from "../render/app/GameApp";

type Vector3Receipt = [number, number, number];
type QuaternionReceipt = [number, number, number, number];

interface StateDigestReceipt {
  absoluteSimulationTick: number;
  attackRelativeTick: number | null;
  quantizationScale: 1_000_000;
  quantizedState: BcjObject;
  bcjVersion: "BCJ-v1";
  bcj: string;
  sha256: string;
}

interface InputEdgeReceipt {
  eventID: string;
  action: "light-strike";
  phase: "rising";
  device: "mouse" | "keyboard" | "unknown";
  button: "left" | null;
  absoluteSimulationTick: number;
  attackRelativeTick: 0;
}

interface RuntimeEventReceipt {
  eventID: string;
  type: GameEvent["type"];
  absoluteSimulationTick: number;
  attackRelativeTick: number | null;
  attackSerial?: number;
  damage?: number;
  healthBefore?: number;
  healthAfter?: number;
}

interface WeaponKinematics {
  angularVelocity: Vector3Receipt;
  angularSpeedRadiansPerSecond: number;
  velocityDirection: Vector3Receipt;
}

interface WeaponSample {
  absoluteSimulationTick: number;
  axis: Vector3Receipt;
  tip: Vector3Receipt;
}

interface ResponseImpulseReceipt {
  absoluteSimulationTick: number | null;
  attackRelativeTick: number | null;
  vector: Vector3Receipt;
  magnitude: number;
}

export interface P30CriticApi {
  readonly schema: "p30.r011.runtime-hook.v1";
  whenReady: () => Promise<void>;
  armCaptureTicks: (absoluteScenarioTicks: number[]) => void;
  resume: () => void;
  snapshot: () => Readonly<Record<string, unknown>>;
  runReceipt: () => Readonly<Record<string, unknown>>;
  resourceReceipt: () => Readonly<Record<string, unknown>>;
}

declare global {
  interface Window {
    __P30_CRITIC__?: P30CriticApi;
  }
}

const ZERO_VECTOR: Vector3Receipt = [0, 0, 0];
const QUANTIZATION_SCALE = 1_000_000 as const;

function round6(value: number): number {
  return Math.round(value * QUANTIZATION_SCALE) / QUANTIZATION_SCALE;
}

function quantize(value: number): number {
  const result = Math.round(value * QUANTIZATION_SCALE);
  if (!Number.isSafeInteger(result)) throw new Error(`Unsafe quantized state value: ${value}`);
  return Object.is(result, -0) ? 0 : result;
}

function vector3(value: readonly number[] | null | undefined): Vector3Receipt | null {
  if (!value || value.length < 3) return null;
  return [round6(value[0]!), round6(value[1]!), round6(value[2]!)];
}

function roundedVector(value: Vector3Receipt): Vector3Receipt {
  return [round6(value[0]), round6(value[1]), round6(value[2])];
}

function subtract(left: Vector3Receipt, right: Vector3Receipt): Vector3Receipt {
  return [left[0] - right[0], left[1] - right[1], left[2] - right[2]];
}

function cross(left: Vector3Receipt, right: Vector3Receipt): Vector3Receipt {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0],
  ];
}

function dot(left: Vector3Receipt, right: Vector3Receipt): number {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

function magnitude(value: Vector3Receipt): number {
  return Math.hypot(value[0], value[1], value[2]);
}

function normalize(value: Vector3Receipt): Vector3Receipt {
  const length = magnitude(value);
  if (length <= 1e-9) return [...ZERO_VECTOR];
  return roundedVector([value[0] / length, value[1] / length, value[2] / length]);
}

function midpoint(
  first: Vector3Receipt | null,
  second: Vector3Receipt | null,
): Vector3Receipt | null {
  if (!first || !second) return first ?? second;
  return roundedVector([
    (first[0] + second[0]) * 0.5,
    (first[1] + second[1]) * 0.5,
    (first[2] + second[2]) * 0.5,
  ]);
}

function quaternionForRootYaw(yaw: number): QuaternionReceipt {
  const half = -yaw * 0.5;
  return [0, round6(Math.sin(half)), 0, round6(Math.cos(half))];
}

function transform(
  position: Vector3Receipt | null,
  quaternion: QuaternionReceipt | null = null,
): { position: Vector3Receipt | null; quaternion: QuaternionReceipt | null } {
  return { position, quaternion };
}

function multiplyMatrixVector(
  matrix: readonly number[],
  vector: readonly [number, number, number, number],
): [number, number, number, number] {
  return [
    matrix[0]! * vector[0] + matrix[4]! * vector[1] + matrix[8]! * vector[2] + matrix[12]! * vector[3],
    matrix[1]! * vector[0] + matrix[5]! * vector[1] + matrix[9]! * vector[2] + matrix[13]! * vector[3],
    matrix[2]! * vector[0] + matrix[6]! * vector[1] + matrix[10]! * vector[2] + matrix[14]! * vector[3],
    matrix[3]! * vector[0] + matrix[7]! * vector[1] + matrix[11]! * vector[2] + matrix[15]! * vector[3],
  ];
}

function screenY(
  point: Vector3Receipt,
  viewMatrix: readonly number[],
  projectionMatrix: readonly number[],
  viewportHeight: number,
): number | null {
  const viewPoint = multiplyMatrixVector(viewMatrix, [point[0], point[1], point[2], 1]);
  const clipPoint = multiplyMatrixVector(projectionMatrix, viewPoint);
  if (Math.abs(clipPoint[3]) <= 1e-9) return null;
  return round6((1 - clipPoint[1] / clipPoint[3]) * viewportHeight * 0.5);
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

function copyJson<T>(value: T): T {
  return structuredClone(value);
}

class P30CriticController {
  private readonly armedTicks = new Set<number>();
  private readonly inputEdgeLog: InputEdgeReceipt[] = [];
  private readonly eventLog: RuntimeEventReceipt[] = [];
  private readonly fixedInputHistory: Array<Record<string, BcjValue>> = [];
  private readonly stateDigestHistory: StateDigestReceipt[] = [];
  private readonly cameraHistory: Array<Record<string, unknown>> = [];
  private readonly errors: string[] = [];
  private attackEdgeSeen = false;
  private eventSerial = 0;
  private previousWeapon: WeaponSample | null = null;
  private weaponKinematics: WeaponKinematics = {
    angularVelocity: [...ZERO_VECTOR],
    angularSpeedRadiansPerSecond: 0,
    velocityDirection: [...ZERO_VECTOR],
  };
  private responseImpulse: ResponseImpulseReceipt = {
    absoluteSimulationTick: null,
    attackRelativeTick: null,
    vector: [...ZERO_VECTOR],
    magnitude: 0,
  };
  private pendingHit: { absoluteSimulationTick: number; damage: number } | null = null;
  private lastCameraTick: number | null = null;
  private readyResolved = false;
  private resolveReady!: () => void;
  private readonly ready = new Promise<void>((resolve) => {
    this.resolveReady = resolve;
  });

  readonly api: P30CriticApi;

  constructor(private readonly app: GameApp) {
    this.api = Object.freeze({
      schema: "p30.r011.runtime-hook.v1" as const,
      whenReady: () => this.ready,
      armCaptureTicks: (ticks: number[]) => this.armCaptureTicks(ticks),
      resume: () => this.app.resumeRuntimeCapture(),
      snapshot: () => this.snapshot(),
      runReceipt: () => this.runReceipt(),
      resourceReceipt: () => this.resourceReceipt(),
    });
    this.recordStateDigest(this.app.getSnapshot());
    this.app.setProductionRuntimeObserver({
      afterFixedUpdate: (receipt) => this.afterFixedUpdate(receipt),
      afterRender: (receipt) => this.afterRender(receipt),
    });
  }

  private attackRelativeTick(absoluteSimulationTick: number): number | null {
    if (!this.attackEdgeSeen || absoluteSimulationTick < P30_ATTACK_EDGE_ABSOLUTE_TICK) {
      return null;
    }
    return absoluteSimulationTick - P30_ATTACK_EDGE_ABSOLUTE_TICK;
  }

  private armCaptureTicks(ticks: number[]): void {
    const currentTick = this.app.getSnapshot().tick;
    for (const tick of ticks) {
      if (!Number.isSafeInteger(tick) || tick < 0) {
        throw new Error(`Capture tick must be a non-negative safe integer: ${tick}`);
      }
      if (tick <= currentTick) {
        throw new Error(`Capture tick ${tick} is not ahead of current absolute tick ${currentTick}`);
      }
      this.armedTicks.add(tick);
    }
  }

  private afterFixedUpdate(receipt: ProductionFixedUpdateReceipt): boolean {
    const absoluteSimulationTick = receipt.state.tick;
    if (receipt.input.attackPressed) this.recordAttackEdge(receipt);
    this.recordEvents(receipt);
    this.fixedInputHistory.push({
      absoluteSimulationTick,
      attackRelativeTick: this.attackRelativeTick(absoluteSimulationTick),
      sampledUpdateTick: absoluteSimulationTick - 1,
      moveX: quantize(receipt.input.moveX),
      moveZ: quantize(receipt.input.moveZ),
      sprint: receipt.input.sprint,
      dodgePressed: receipt.input.dodgePressed,
      attackPressed: receipt.input.attackPressed,
      faceYaw: receipt.input.faceYaw === undefined ? null : quantize(receipt.input.faceYaw),
    });
    this.recordStateDigest(receipt.state);
    if (!this.armedTicks.delete(absoluteSimulationTick)) return true;
    return false;
  }

  private recordAttackEdge(receipt: ProductionFixedUpdateReceipt): void {
    const absoluteSimulationTick = receipt.state.tick - 1;
    if (this.attackEdgeSeen) return;
    this.attackEdgeSeen = true;
    if (absoluteSimulationTick !== P30_ATTACK_EDGE_ABSOLUTE_TICK) {
      this.errors.push(
        `Light-strike rising edge sampled at absolute tick ${absoluteSimulationTick}; expected ${P30_ATTACK_EDGE_ABSOLUTE_TICK}`,
      );
    }
    const mouse = receipt.lightStrikeSource === "mouse-left";
    this.inputEdgeLog.push({
      eventID: `input-${String(this.inputEdgeLog.length + 1).padStart(4, "0")}`,
      action: "light-strike",
      phase: "rising",
      device: mouse
        ? "mouse"
        : receipt.lightStrikeSource === "keyboard"
          ? "keyboard"
          : "unknown",
      button: mouse ? "left" : null,
      absoluteSimulationTick,
      attackRelativeTick: 0,
    });
  }

  private recordEvents(receipt: ProductionFixedUpdateReceipt): void {
    for (const event of receipt.events) {
      this.eventSerial += 1;
      const attackStart = event.type === "attack-started" || event.type === "attack-rejected-busy";
      const absoluteSimulationTick = attackStart ? event.tick : receipt.state.tick;
      const mapped: RuntimeEventReceipt = {
        eventID: `event-${String(this.eventSerial).padStart(4, "0")}`,
        type: event.type,
        absoluteSimulationTick,
        attackRelativeTick: this.attackRelativeTick(absoluteSimulationTick),
      };
      if ("attackSerial" in event) mapped.attackSerial = event.attackSerial;
      if (event.type === "enemy-hit") {
        mapped.damage = event.damage;
        mapped.healthBefore = receipt.healthBefore;
        mapped.healthAfter = receipt.healthAfter;
        this.pendingHit = { absoluteSimulationTick, damage: event.damage };
      }
      this.eventLog.push(mapped);
    }
  }

  private recordStateDigest(state: WorldState): void {
    const quantizedState = quantizedWorldState(state);
    const bcj = canonicalizeBcj(quantizedState);
    this.stateDigestHistory.push({
      absoluteSimulationTick: state.tick,
      attackRelativeTick: this.attackRelativeTick(state.tick),
      quantizationScale: QUANTIZATION_SCALE,
      quantizedState,
      bcjVersion: "BCJ-v1",
      bcj,
      sha256: sha256Hex(bcj),
    });
  }

  private afterRender(receipt: ProductionRenderReceipt): void {
    this.updateWeaponKinematics(receipt.absoluteSimulationTick);
    if (this.pendingHit) {
      const direction = this.weaponKinematics.velocityDirection;
      this.responseImpulse = {
        absoluteSimulationTick: this.pendingHit.absoluteSimulationTick,
        attackRelativeTick: this.attackRelativeTick(this.pendingHit.absoluteSimulationTick),
        vector: roundedVector([
          direction[0] * this.pendingHit.damage,
          direction[1] * this.pendingHit.damage,
          direction[2] * this.pendingHit.damage,
        ]),
        magnitude: this.pendingHit.damage,
      };
      this.pendingHit = null;
    }
    if (this.lastCameraTick !== receipt.absoluteSimulationTick) {
      const camera = this.app.getCameraTelemetry();
      this.cameraHistory.push({
        absoluteSimulationTick: receipt.absoluteSimulationTick,
        attackRelativeTick: this.attackRelativeTick(receipt.absoluteSimulationTick),
        renderHeartbeat: receipt.heartbeat,
        position: [...camera.position],
        quaternion: [...camera.quaternion],
        viewMatrix: [...camera.viewMatrix],
        projectionMatrix: [...camera.projectionMatrix],
      });
      this.lastCameraTick = receipt.absoluteSimulationTick;
    }
    if (!this.readyResolved && receipt.absoluteSimulationTick === 0) {
      this.readyResolved = true;
      this.resolveReady();
    }
  }

  private updateWeaponKinematics(absoluteSimulationTick: number): void {
    const pose = this.app.getCombatPoseTelemetry();
    const axis = vector3(pose.hero.anchors.bladeAxisWorld);
    const tip = vector3(pose.hero.anchors.bladeTipWorld);
    if (!axis || !tip) return;
    const current: WeaponSample = { absoluteSimulationTick, axis: normalize(axis), tip };
    const previous = this.previousWeapon;
    if (previous && previous.absoluteSimulationTick !== absoluteSimulationTick) {
      const elapsedTicks = absoluteSimulationTick - previous.absoluteSimulationTick;
      const elapsed = Math.max(P30_FIXED_DELTA, elapsedTicks * P30_FIXED_DELTA);
      const axisCross = cross(previous.axis, current.axis);
      const axisCrossMagnitude = magnitude(axisCross);
      const angle = Math.acos(Math.max(-1, Math.min(1, dot(previous.axis, current.axis))));
      const rotationAxis = axisCrossMagnitude > 1e-9
        ? normalize(axisCross)
        : [...ZERO_VECTOR] as Vector3Receipt;
      const angularSpeed = angle / elapsed;
      this.weaponKinematics = {
        angularVelocity: roundedVector([
          rotationAxis[0] * angularSpeed,
          rotationAxis[1] * angularSpeed,
          rotationAxis[2] * angularSpeed,
        ]),
        angularSpeedRadiansPerSecond: round6(angularSpeed),
        velocityDirection: normalize(subtract(current.tip, previous.tip)),
      };
    }
    if (!previous || previous.absoluteSimulationTick !== absoluteSimulationTick) {
      this.previousWeapon = current;
    }
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
      attackRelativeTick: this.attackRelativeTick(state.tick),
      quantizationScale: QUANTIZATION_SCALE,
      quantizedState,
      bcjVersion: "BCJ-v1",
      bcj,
      sha256: sha256Hex(bcj),
    };
  }

  snapshot(): Readonly<Record<string, unknown>> {
    const state = this.app.getSnapshot();
    const pose = this.app.getCombatPoseTelemetry();
    const camera = this.app.getCameraTelemetry();
    const renderer = this.app.getRendererTelemetry();
    const mode = this.app.getProductionModeTelemetry();
    const hero = pose.hero.anchors;
    const target = pose.target.anchors;
    const leadHand = vector3(hero.leadHandWorld);
    const supportHand = vector3(hero.supportHandWorld);
    const leadFoot = vector3(hero.leadFootWorld);
    const supportFoot = vector3(hero.supportFootWorld);
    const bladeContact = vector3(hero.bladeContactWorld);
    const bladeTip = vector3(hero.bladeTipWorld);
    const measurement = pose.contact.measurement;
    const targetClosest = vector3(measurement?.targetClosestWorld);
    const bladeClosest = vector3(measurement?.bladeClosestWorld);
    const contactNormal = targetClosest && bladeClosest
      ? normalize(subtract(bladeClosest, targetClosest))
      : null;
    const attackerRootPosition: Vector3Receipt = [
      round6(state.player.position.x),
      0,
      round6(state.player.position.z),
    ];
    const targetRootPosition: Vector3Receipt = [
      round6(state.enemy.position.x),
      0,
      round6(state.enemy.position.z),
    ];
    const targetHead = vector3(target.headWorld);
    const targetHeadScreenY = targetHead
      ? screenY(targetHead, camera.viewMatrix, camera.projectionMatrix, renderer.size.height)
      : null;
    const targetGroundScreenY = screenY(
      targetRootPosition,
      camera.viewMatrix,
      camera.projectionMatrix,
      renderer.size.height,
    );

    return copyJson({
      schema: "p30.r011.snapshot.v1",
      scenarioID: P30_SCENARIO_ID,
      seed: P30_SCENARIO_SEED,
      absoluteSimulationTick: state.tick,
      attackRelativeTick: this.attackRelativeTick(state.tick),
      fixedDelta: { numerator: 1, denominator: 60 },
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
        root: transform(attackerRootPosition, quaternionForRootYaw(state.player.yaw)),
        hips: transform(vector3(hero.pelvisWorld)),
        torso: transform(vector3(hero.torsoWorld)),
        head: transform(vector3(hero.headWorld)),
        hands: {
          lead: transform(leadHand),
          support: transform(supportHand),
        },
        feet: {
          lead: { ...transform(leadFoot), groundContact: leadFoot !== null && leadFoot[1] <= 0.11 },
          support: {
            ...transform(supportFoot),
            groundContact: supportFoot !== null && supportFoot[1] <= 0.11,
          },
        },
      },
      weapon: {
        root: transform(vector3(hero.weaponRootWorld)),
        gripMidpoint: midpoint(leadHand, supportHand),
        activeEdgeSamplePoints: [bladeContact, bladeTip],
        tip: bladeTip,
        angularVelocity: this.weaponKinematics.angularVelocity,
        angularSpeedRadiansPerSecond: this.weaponKinematics.angularSpeedRadiansPerSecond,
        velocityDirection: this.weaponKinematics.velocityDirection,
      },
      target: {
        root: transform(targetRootPosition, quaternionForRootYaw(state.enemy.yaw)),
        head: transform(targetHead),
        torso: transform(vector3(target.torsoWorld)),
        contactSideShoulder: transform(vector3(target.contactShoulderWorld)),
        worldHeight: targetHead ? round6(targetHead[1] - targetRootPosition[1]) : null,
        screenHeightPixels:
          targetHeadScreenY === null || targetGroundScreenY === null
            ? null
            : round6(Math.abs(targetGroundScreenY - targetHeadScreenY)),
        health: state.enemy.health,
        collision: {
          surface: {
            type: "capsule",
            axisStart: vector3(target.proxyAxisStartWorld),
            axisEnd: vector3(target.proxyAxisEndWorld),
            radiusMeters: round6(target.proxyRadiusMeters),
          },
          contactPoint: targetClosest,
          bladeClosestPoint: bladeClosest,
          contactNormal,
          separationMeters: measurement?.separationMeters ?? null,
          standoffMeters: measurement?.standoffMeters ?? null,
          penetrationMeters: measurement?.penetrationMeters ?? null,
          exteriorContactPoints: measurement?.exteriorContactPoints ?? 0,
        },
        responseImpulse: this.responseImpulse,
      },
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

  runReceipt(): Readonly<Record<string, unknown>> {
    const state = this.app.getSnapshot();
    return copyJson({
      schema: "p30.r011.run-receipt.v1",
      scenarioID: P30_SCENARIO_ID,
      seed: P30_SCENARIO_SEED,
      fixedDelta: { numerator: 1, denominator: 60 },
      captureTickSpace: "absolute-scenario",
      attackRisingEdgeAbsoluteTick: P30_ATTACK_EDGE_ABSOLUTE_TICK,
      absoluteSimulationTick: state.tick,
      attackRelativeTick: this.attackRelativeTick(state.tick),
      uninterrupted: true,
      inputEdgeLog: this.inputEdgeLog,
      eventLog: this.eventLog,
      fixedInputHistory: this.fixedInputHistory,
      cameraHistory: this.cameraHistory,
      stateDigestHistory: this.stateDigestHistory,
      errors: [...this.errors],
    });
  }

  resourceReceipt(): Readonly<Record<string, unknown>> {
    const renderer = this.app.getRendererTelemetry();
    const mode = this.app.getProductionModeTelemetry();
    return copyJson({
      schema: "p30.r011.resource-receipt.v1",
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
