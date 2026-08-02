import * as THREE from "three";
import { canonicalizeBcj, sha256Utf8 } from "../../diagnostics/bcj";
import { PerfDiagnostics, type RuntimeMetrics } from "../../diagnostics/PerfDiagnostics";
import { InputController } from "../../game/input/InputController";
import type { InputSnapshot } from "../../game/input/actions";
import { FIXED_TIMESTEP } from "../../game/simulation/constants";
import { P30_REVIEW_TUNING } from "../../game/simulation/constants";
import { FixedStepClock } from "../../game/simulation/FixedStepClock";
import { createInitialWorld, EMPTY_INPUT, GameSimulation } from "../../game/simulation/GameSimulation";
import { directionToYaw, normalized } from "../../game/simulation/math";
import type { GameEvent, InputFrame, WorldState } from "../../game/simulation/types";
import { PhysicsBridge } from "../../physics/PhysicsBridge";
import { Hud } from "../../ui/Hud";
import { RenderBridge, type PresentationAssetReceipt } from "../adapters/RenderBridge";
import { AssetRegistry, type RegistryLoadReceipt } from "../loaders/AssetRegistry";
import { PostStack } from "../post/PostStack";
import { applyRendererPresentationState, createRenderer } from "./createRenderer";
import { createScene, type SceneLighting } from "./createScene";
import {
  ThirdPersonCamera,
  type CameraFramingTelemetry,
  type CameraTelemetry,
} from "./ThirdPersonCamera";
import { ViewportController } from "./ViewportController";

interface PendingEdges {
  attack: boolean;
  dodge: boolean;
}

interface CriticEventReceipt {
  id: string;
  absoluteTick: number;
  sourceSimulationTick: number;
  postUpdateAbsoluteTick: number;
  attackRelativeTick: number | null;
  event: GameEvent;
}

interface CriticStateDigestReceipt {
  absoluteTick: number;
  attackRelativeTick: number | null;
  quantization: "1e-6";
  state: Record<string, unknown>;
  bcj: string;
  sha256: string;
  camera: CameraTelemetry;
}

const CRITIC_SCENARIO_ID = "P30-light-strike-v1";
const CRITIC_SEED = 30011;
const CRITIC_FIXED_DELTA = { numerator: 1, denominator: 60 } as const;

function quantize(value: number): number {
  return Math.round(value * 1_000_000);
}

function quantizedWorldState(state: WorldState): Record<string, unknown> {
  return {
    tick: state.tick,
    elapsedMicros: quantize(state.elapsed),
    objectiveComplete: state.objectiveComplete,
    player: {
      positionMicrounits: {
        x: quantize(state.player.position.x),
        z: quantize(state.player.position.z),
      },
      yawMicroradians: quantize(state.player.yaw),
      health: state.player.health,
      maxHealth: state.player.maxHealth,
      staminaMicrounits: quantize(state.player.stamina),
      maxStamina: state.player.maxStamina,
      motion: state.player.motion,
      speedMicrounits: quantize(state.player.speed01),
      attackElapsedMicros: quantize(state.player.attackElapsed),
      attackFrame: state.player.attackFrame,
      attackPhase: state.player.attackPhase,
      attackSerial: state.player.attackSerial,
      attackHasHit: state.player.attackHasHit,
      dodgeRemainingMicros: quantize(state.player.dodgeRemaining),
      invulnerableRemainingMicros: quantize(state.player.invulnerableRemaining),
    },
    target: {
      positionMicrounits: {
        x: quantize(state.enemy.position.x),
        z: quantize(state.enemy.position.z),
      },
      yawMicroradians: quantize(state.enemy.yaw),
      health: state.enemy.health,
      maxHealth: state.enemy.maxHealth,
      motion: state.enemy.motion,
      hitStunRemainingMicros: quantize(state.enemy.hitStunRemaining),
    },
  };
}

function transformReceipt(node: THREE.Object3D | null): {
  position: [number, number, number];
  quaternion: [number, number, number, number];
} | null {
  if (!node) return null;
  node.updateWorldMatrix(true, false);
  const position = node.getWorldPosition(new THREE.Vector3());
  const quaternion = node.getWorldQuaternion(new THREE.Quaternion());
  return {
    position: [position.x, position.y, position.z],
    quaternion: [quaternion.x, quaternion.y, quaternion.z, quaternion.w],
  };
}

function midpoint(
  left: readonly number[] | null,
  right: readonly number[] | null,
): [number, number, number] | null {
  if (!left || !right) return null;
  return [
    (left[0]! + right[0]!) * 0.5,
    (left[1]! + right[1]!) * 0.5,
    (left[2]! + right[2]!) * 0.5,
  ];
}

export class GameApp {
  private readonly simulation = new GameSimulation();
  private readonly clock = new FixedStepClock();
  private readonly input = new InputController();
  private readonly cameraController = new ThirdPersonCamera();
  private readonly diagnostics = new PerfDiagnostics();
  private readonly assetRegistry: AssetRegistry;
  private readonly lighting: SceneLighting;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly contextLossExtension: WEBGL_lose_context | null;
  private readonly post: PostStack;
  private readonly viewport: ViewportController;
  private readonly renderBridge: RenderBridge;
  private readonly hud: Hud;
  private lastTimestamp = 0;
  private running = false;
  private contextLost = false;
  private lockedOn = false;
  private latestInput: InputSnapshot = {
    moveX: 0,
    moveZ: 0,
    sprint: false,
    dodgePressed: false,
    attackPressed: false,
    lockPressed: false,
    diagnosticsPressed: false,
    postPressed: false,
    capturePressed: false,
    pausePressed: false,
    lookX: 0,
    lookY: 0,
  };
  private readonly pendingEdges: PendingEdges = { attack: false, dodge: false };
  private manifestVersion: number | null = null;
  private readonly reviewMode: boolean;
  private simulationPaused = false;
  private readonly runtimeErrors: string[] = [];
  private readonly contextLifecycle = { lost: false, losses: 0, restores: 0 };
  private environmentInstalled: boolean;
  private criticMode = false;
  private readonly criticArmedTicks = new Set<number>();
  private criticCapturePaused = false;
  private criticAttackAbsoluteTick: number | null = null;
  private readonly criticInputEdges: Array<{
    absoluteTick: number;
    attackRelativeTick: 0;
    device: "mouse";
    button: "left";
    phase: "down";
  }> = [];
  private readonly criticInputHistory: Array<{
    absoluteTick: number;
    attackRelativeTick: number | null;
    input: InputFrame;
  }> = [];
  private readonly criticEvents: CriticEventReceipt[] = [];
  private readonly criticStateHistory: CriticStateDigestReceipt[] = [];
  private criticEventSequence = 0;
  private renderHeartbeat = 0;
  private criticPreviousWeaponQuaternion: THREE.Quaternion | null = null;
  private criticWeaponAngularVelocity = {
    radiansPerSecond: 0,
    direction: [0, 0, 0] as [number, number, number],
  };
  private criticResponseImpulse: [number, number, number] = [0, 0, 0];

  private constructor(
    host: HTMLElement,
    private readonly physics: PhysicsBridge,
    assetRegistry: AssetRegistry,
    assetFailures: string[],
  ) {
    this.assetRegistry = assetRegistry;
    this.hud = new Hud(host);
    this.lighting = createScene();
    const params = new URLSearchParams(window.location.search);
    this.reviewMode = params.get("review") === "1";
    if (this.reviewMode) host.classList.add("is-review-mode");
    const fixedReviewViewport = this.reviewMode
      ? { width: 1600, height: 900, pixelRatio: 1 }
      : undefined;
    const captureBuffer = params.has("capture") || params.get("captureBuffer") === "1";
    this.renderer = createRenderer(
      host,
      {
        onContextLost: this.onContextLost,
        onContextRestored: this.onContextRestored,
      },
      {
        preserveDrawingBuffer: captureBuffer || this.reviewMode,
        pixelRatio: fixedReviewViewport?.pixelRatio ?? Math.min(window.devicePixelRatio, 1.75),
        ...(fixedReviewViewport ? { fixedSize: fixedReviewViewport } : {}),
      },
    );
    this.contextLossExtension = this.renderer.getContext().getExtension("WEBGL_lose_context");
    const environment = assetRegistry.createEnvironmentMap(
      "environment.snowy-forest",
      this.renderer,
    );
    this.environmentInstalled = environment !== null;
    if (environment) this.lighting.scene.environment = environment;
    this.post = new PostStack(
      this.renderer,
      this.lighting.scene,
      this.cameraController.camera,
      params.get("post") !== "0",
      fixedReviewViewport?.pixelRatio ?? Math.min(window.devicePixelRatio, 1.75),
    );
    this.viewport = new ViewportController(
      host,
      this.renderer,
      this.cameraController.camera,
      this.post,
      fixedReviewViewport,
    );
    this.renderBridge = new RenderBridge(
      this.lighting.scene,
      this.cameraController,
      assetRegistry,
      this.renderer.capabilities.getMaxAnisotropy(),
    );
    this.cameraController.setObstructionObjects([this.renderBridge.arena.root]);
    this.input.attach(this.renderer.domElement);
    this.manifestVersion = assetRegistry.manifestVersion;
    if (assetFailures.length > 0) {
      console.warn("Enabled authored assets failed; fallbacks remain active.", assetFailures);
      this.hud.toast("Asset fallback active", "danger");
    }
    if (this.renderBridge.assetReceipt.proceduralFallbackActive) {
      console.warn("Authored presentation fallback active.", this.renderBridge.assetReceipt);
      this.hud.toast("Authored art fallback active", "danger");
    }
    if (params.get("debug") === "1") this.hud.toggleDiagnostics(true);
    this.renderOnce(true);
  }

  static async create(host: HTMLElement): Promise<GameApp> {
    const physicsPromise = PhysicsBridge.create();
    const assetRegistry = new AssetRegistry();
    const assetPromise = assetRegistry.preloadEnabled().catch((error: unknown) => [
      `manifest: ${error instanceof Error ? error.message : String(error)}`,
    ]);
    const [physics, assetFailures] = await Promise.all([physicsPromise, assetPromise]);
    const app = new GameApp(host, physics, assetRegistry, assetFailures);
    await app.prepareRenderer();
    return app;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTimestamp = performance.now();
    this.renderer.setAnimationLoop(this.frame);
  }

  pause(): void {
    this.running = false;
    this.renderer.setAnimationLoop(null);
  }

  reset(): void {
    this.simulation.reset();
    this.physics.reset(this.simulation.state.player.position, this.simulation.state.enemy.position);
    this.clock.reset();
    this.cameraController.reset();
    this.lockedOn = false;
    this.pendingEdges.attack = false;
    this.pendingEdges.dodge = false;
    this.renderOnce(true);
  }

  resetForReview(): void {
    this.pause();
    this.simulation.reset(
      createInitialWorld({
        playerPosition: { x: 0, z: 2.6 },
        enemyPosition: { x: 0, z: 0 },
      }),
      P30_REVIEW_TUNING,
    );
    this.physics.reset(this.simulation.state.player.position, this.simulation.state.enemy.position);
    this.clock.reset();
    this.cameraController.reset();
    this.lockedOn = false;
    this.simulationPaused = false;
    this.pendingEdges.attack = false;
    this.pendingEdges.dodge = false;
    this.renderOnce(true);
  }

  prepareP30CriticScenario(): void {
    this.pause();
    this.criticMode = false;
    this.simulation.reset(
      createInitialWorld({
        playerPosition: { x: 0, z: 2.6 },
        enemyPosition: { x: 0, z: 0 },
      }),
      P30_REVIEW_TUNING,
    );
    this.physics.reset(this.simulation.state.player.position, this.simulation.state.enemy.position);
    this.clock.reset();
    this.cameraController.reset();
    this.lockedOn = false;
    this.simulationPaused = false;
    this.pendingEdges.attack = false;
    this.pendingEdges.dodge = false;
    this.renderOnce(true);

    this.criticArmedTicks.clear();
    this.criticCapturePaused = false;
    this.criticAttackAbsoluteTick = null;
    this.criticInputEdges.length = 0;
    this.criticInputHistory.length = 0;
    this.criticEvents.length = 0;
    this.criticStateHistory.length = 0;
    this.criticEventSequence = 0;
    this.criticPreviousWeaponQuaternion = null;
    this.criticWeaponAngularVelocity = { radiansPerSecond: 0, direction: [0, 0, 0] };
    this.criticResponseImpulse = [0, 0, 0];
    this.criticMode = true;
    this.simulationPaused = true;
    this.recordCriticState();
  }

  armP30CriticCaptureTicks(ticks: number[]): void {
    if (!this.criticMode) throw new Error("P30 critic scenario is not active");
    for (const tick of ticks) {
      if (!Number.isSafeInteger(tick) || tick < this.simulation.state.tick) {
        throw new Error(`invalid or elapsed absolute capture tick: ${tick}`);
      }
      this.criticArmedTicks.add(tick);
    }
  }

  resumeP30CriticCapture(): void {
    if (!this.criticMode) return;
    this.criticCapturePaused = false;
    this.simulationPaused = false;
    this.clock.reset();
    this.lastTimestamp = performance.now();
  }

  getP30CriticSnapshot(): Record<string, unknown> {
    const state = this.getSnapshot();
    const pose = window.__COW_COMBAT_POSE__?.telemetry() ?? null;
    const framing = this.getCameraFramingTelemetry();
    const heroRoot = this.renderBridge.hero.root;
    const targetRoot = this.renderBridge.zombie.root;
    const weaponRoot = heroRoot.getObjectByName("stormcage-two-hand-socket") ?? null;
    const heroAnchors = pose?.hero.anchors ?? null;
    const targetAnchors = pose?.target.anchors ?? null;
    const targetCenter = targetAnchors?.hipsWorld ?? null;
    const contact = targetAnchors?.contourWorld ?? null;
    let contactNormal: [number, number, number] | null = null;
    if (targetCenter && contact) {
      const normal = new THREE.Vector3(
        contact[0] - targetCenter[0],
        contact[1] - targetCenter[1],
        contact[2] - targetCenter[2],
      ).normalize();
      contactNormal = [normal.x, normal.y, normal.z];
    }
    const quantizedState = quantizedWorldState(state);
    const bcj = canonicalizeBcj(quantizedState);
    const renderer = this.getRendererTelemetry();
    const assets = this.getAssetLoadReceipt();
    const leadFoot = heroAnchors?.leadFootWorld ?? null;
    const supportFoot = heroAnchors?.supportFootWorld ?? null;
    const camera = this.getCameraTelemetry();
    return {
      schema: "p30.r011.runtime-snapshot.v1",
      scenarioID: CRITIC_SCENARIO_ID,
      captureTickSpace: "absolute-scenario",
      attackRisingEdgeAbsoluteTick: 24,
      absoluteSimulationTick: state.tick,
      attackRelativeTick:
        this.criticAttackAbsoluteTick === null
          ? null
          : state.tick - this.criticAttackAbsoluteTick,
      seed: CRITIC_SEED,
      fixedDelta: CRITIC_FIXED_DELTA,
      paused: this.simulationPaused,
      renderHeartbeat: this.renderHeartbeat,
      camera: {
        ...camera,
        worldTransform: {
          position: camera.position,
          quaternion: camera.quaternion,
        },
        viewMatrix: this.cameraController.camera.matrixWorldInverse.toArray(),
        viewport: {
          width: renderer.size.width,
          height: renderer.size.height,
          devicePixelRatio: this.renderer.getPixelRatio(),
        },
      },
      attacker: {
        root: transformReceipt(heroRoot),
        hips: transformReceipt(heroRoot.getObjectByName("pelvis") ?? null),
        torso: transformReceipt(heroRoot.getObjectByName("spine_03") ?? null),
        head: transformReceipt(heroRoot.getObjectByName("head") ?? heroRoot.getObjectByName("neck_01") ?? null),
        hands: {
          lead: transformReceipt(heroRoot.getObjectByName("hand_r") ?? null),
          support: transformReceipt(heroRoot.getObjectByName("hand_l") ?? null),
        },
        feet: {
          lead: {
            transform: transformReceipt(heroRoot.getObjectByName("foot_l") ?? null),
            grounded: leadFoot !== null && leadFoot[1] <= 0.18,
          },
          support: {
            transform: transformReceipt(heroRoot.getObjectByName("foot_r") ?? null),
            grounded: supportFoot !== null && supportFoot[1] <= 0.18,
          },
        },
      },
      weapon: {
        root: transformReceipt(weaponRoot),
        gripMidpoint: midpoint(heroAnchors?.leadHandWorld ?? null, heroAnchors?.supportHandWorld ?? null),
        activeEdgeSamplePoints: [
          heroAnchors?.bladeEdgeWorld ?? null,
          heroAnchors?.bladeContactWorld ?? null,
        ].filter((point) => point !== null),
        tip: heroAnchors?.bladeTipWorld ?? null,
        angularVelocityRadiansPerSecond: this.criticWeaponAngularVelocity.radiansPerSecond,
        velocityDirection: this.criticWeaponAngularVelocity.direction,
      },
      target: {
        root: transformReceipt(targetRoot),
        head: transformReceipt(targetRoot.getObjectByName("Head") ?? null),
        torso: transformReceipt(targetRoot.getObjectByName("Torso") ?? null),
        contactSideShoulder: transformReceipt(
          targetRoot.getObjectByName("LeftShoulder") ??
          targetRoot.getObjectByName("Shoulder_L") ??
          targetRoot.getObjectByName("UpperArm_L") ??
          null,
        ),
        screenHeightPixels: framing.target?.height ?? null,
        worldHeightMeters:
          targetAnchors?.headWorld && targetAnchors.hipsWorld
            ? Math.abs(targetAnchors.headWorld[1] - targetAnchors.hipsWorld[1])
            : null,
        health: state.enemy.health,
        collisionSurface: {
          method: pose?.contact.method ?? null,
          point: contact,
          normal: contactNormal,
          classification: pose?.contact.classification ?? null,
          edgeToSurfaceMeters: pose?.contact.bladeEdgeToTargetContourMeters ?? null,
          signedSeparationMeters: pose?.contact.signedSeparationMeters ?? null,
        },
        responseImpulse: this.criticResponseImpulse,
      },
      inputEdgeLog: structuredClone(this.criticInputEdges),
      inputHistory: structuredClone(this.criticInputHistory),
      eventLog: structuredClone(this.criticEvents),
      authoritativeState: {
        quantization: "1e-6",
        state: quantizedState,
        bcj,
        sha256: sha256Utf8(bcj),
      },
      rendererMode: this.renderer.getContext() instanceof WebGL2RenderingContext ? "WebGL2" : "unsupported",
      assetTier: assets.productionAuthored ? "production-authored" : "fallback",
      fallbackActive: !assets.productionAuthored,
      context: renderer.context,
    };
  }

  getP30CriticRunReceipt(): Record<string, unknown> {
    return {
      schema: "p30.r011.runtime-run-receipt.v1",
      scenarioID: CRITIC_SCENARIO_ID,
      captureTickSpace: "absolute-scenario",
      attackRisingEdgeAbsoluteTick: 24,
      seed: CRITIC_SEED,
      fixedDelta: CRITIC_FIXED_DELTA,
      lightStrikeInput: { device: "mouse", button: "left" },
      inputEdgeLog: structuredClone(this.criticInputEdges),
      inputHistory: structuredClone(this.criticInputHistory),
      eventLog: structuredClone(this.criticEvents),
      stateDigestHistory: structuredClone(this.criticStateHistory),
      current: this.getP30CriticSnapshot(),
    };
  }

  getP30CriticResourceReceipt(): Record<string, unknown> {
    const renderer = this.getRendererTelemetry();
    return {
      schema: "p30.r011.runtime-resource-receipt.v1",
      absoluteSimulationTick: this.simulation.state.tick,
      attackRelativeTick:
        this.criticAttackAbsoluteTick === null
          ? null
          : this.simulation.state.tick - this.criticAttackAbsoluteTick,
      paused: this.simulationPaused,
      renderHeartbeat: this.renderHeartbeat,
      renderer: {
        calls: renderer.calls,
        triangles: renderer.triangles,
        points: renderer.points,
        lines: renderer.lines,
        textures: renderer.textures,
        geometries: renderer.geometries,
        pixelRatio: renderer.pixelRatio,
        size: renderer.size,
        context: renderer.context,
        errors: renderer.errors,
      },
      assets: this.getAssetLoadReceipt(),
      canvasCount: document.querySelectorAll("canvas#game-canvas").length,
      hudCount: document.querySelectorAll(".hud").length,
    };
  }

  stepReviewFrame(input: InputFrame): GameEvent[] {
    if (this.simulationPaused) return [];
    const events = this.fixedTick(input, FIXED_TIMESTEP);
    this.renderBridge.update(this.simulation.state, FIXED_TIMESTEP);
    this.updateCamera(FIXED_TIMESTEP, 0, 0);
    return events;
  }

  samplePhysicalInput(): InputSnapshot {
    return this.input.sample();
  }

  setReviewPaused(paused: boolean): void {
    this.simulationPaused = paused;
    if (paused && document.pointerLockElement) void document.exitPointerLock();
  }

  get isSimulationPaused(): boolean {
    return this.simulationPaused;
  }

  resetCamera(): void {
    this.cameraController.reset();
  }

  runCaptureScenario(name: string): void {
    this.pause();
    this.reset();
    if (name === "combat" || name === "judge") {
      this.stepDeterministic(19, { moveZ: -1 });
      this.stepDeterministic(1, { attackPressed: true });
      this.stepDeterministic(8);
      this.lockedOn = true;
    } else if (name === "victory") {
      this.stepDeterministic(19, { moveZ: -1 });
      for (let strike = 0; strike < 3; strike += 1) {
        this.stepDeterministic(1, { attackPressed: true });
        this.stepDeterministic(31);
      }
    } else {
      this.lockedOn = false;
    }
    this.renderOnce(true);
  }

  stepDeterministic(frames: number, overrides: Partial<InputFrame> = {}): void {
    this.pause();
    for (let frame = 0; frame < frames; frame += 1) {
      const input: InputFrame = {
        ...EMPTY_INPUT,
        ...overrides,
        attackPressed: frame === 0 && (overrides.attackPressed ?? false),
        dodgePressed: frame === 0 && (overrides.dodgePressed ?? false),
      };
      this.fixedTick(input, FIXED_TIMESTEP);
      this.renderBridge.update(this.simulation.state, FIXED_TIMESTEP);
      this.updateCamera(FIXED_TIMESTEP, 0, 0);
    }
    this.renderOnce(false, false);
  }

  renderOnce(snapCamera = false, advanceCamera = true): void {
    const state = this.simulation.state;
    if (advanceCamera) this.updateCamera(FIXED_TIMESTEP, 0, 0, snapCamera);
    this.lighting.rig.update(state.elapsed);
    this.renderBridge.update(state, FIXED_TIMESTEP);
    this.hud.update(state, this.cameraController.camera, this.lockedOn);
    this.post.render(this.lighting.scene, this.cameraController.camera);
    this.renderHeartbeat += 1;
  }

  capturePng(): string {
    this.renderOnce(false, false);
    return this.renderer.domElement.toDataURL("image/png");
  }

  downloadCapture(): void {
    const anchor = document.createElement("a");
    anchor.href = this.capturePng();
    anchor.download = `gauntlet-loop-${this.simulation.state.tick}.png`;
    anchor.click();
    this.hud.toast("Capture sealed");
  }

  setPostProcessing(enabled: boolean): void {
    this.post.enabled = enabled;
    this.renderOnce(false, false);
  }

  getSnapshot(): WorldState {
    return structuredClone(this.simulation.state);
  }

  getMetrics(): RuntimeMetrics {
    return this.diagnostics.current;
  }

  getCameraTelemetry(): CameraTelemetry {
    return this.cameraController.getTelemetry();
  }

  getCameraFramingTelemetry(): CameraFramingTelemetry {
    this.lighting.scene.updateMatrixWorld(true);
    const player =
      this.renderBridge.hero.root.getObjectByName("nyra-visible-model") ??
      this.renderBridge.hero.root;
    const target =
      this.renderBridge.zombie.root.getObjectByName("hollow-visible-model") ??
      this.renderBridge.zombie.root;
    const blade = player.getObjectByName("stormcage-two-hand-socket") ?? null;
    const contact = blade?.getObjectByName("ContactMarker") ?? null;
    const size = this.renderer.getSize(new THREE.Vector2());
    return this.cameraController.measureFraming(
      { player, target, blade, contact },
      size.x,
      size.y,
    );
  }

  getRendererTelemetry(): {
    calls: number;
    triangles: number;
    points: number;
    lines: number;
    textures: number;
    geometries: number;
    pixelRatio: number;
    size: { width: number; height: number };
    errors: string[];
    context: { lost: boolean; losses: number; restores: number };
  } {
    const size = this.renderer.getSize(new THREE.Vector2());
    return {
      calls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      points: this.renderer.info.render.points,
      lines: this.renderer.info.render.lines,
      textures: this.renderer.info.memory.textures,
      geometries: this.renderer.info.memory.geometries,
      pixelRatio: this.renderer.getPixelRatio(),
      size: { width: size.x, height: size.y },
      errors: [...this.runtimeErrors],
      context: { ...this.contextLifecycle },
    };
  }

  forceContextLoss(): boolean {
    if (!this.contextLossExtension) return false;
    this.contextLossExtension.loseContext();
    return true;
  }

  forceContextRestore(): boolean {
    if (!this.contextLossExtension) return false;
    this.contextLossExtension.restoreContext();
    return true;
  }

  get assetManifestVersion(): number | null {
    return this.manifestVersion;
  }

  getAssetLoadReceipt(): {
    schema: "gauntlet.asset-load.v1";
    registry: RegistryLoadReceipt;
    presentation: PresentationAssetReceipt;
    environment: { key: "environment.snowy-forest"; pmremInstalled: boolean };
    productionAuthored: boolean;
  } {
    const registry = this.assetRegistry.loadReceipt;
    const presentation = this.renderBridge.assetReceipt;
    return {
      schema: "gauntlet.asset-load.v1",
      registry,
      presentation,
      environment: {
        key: "environment.snowy-forest",
        pmremInstalled: this.environmentInstalled,
      },
      productionAuthored:
        registry.complete &&
        !presentation.proceduralFallbackActive &&
        this.environmentInstalled,
    };
  }

  get postProcessingEnabled(): boolean {
    return this.post.enabled;
  }

  dispose(): void {
    this.pause();
    this.input.detach();
    this.viewport.dispose();
    this.post.dispose();
    this.renderBridge.dispose();
    this.lighting.rig.dispose();
    this.assetRegistry.dispose();
    this.physics.dispose();
    this.renderer.dispose();
    this.hud.dispose();
  }

  private readonly frame = (timestamp: number): void => {
    if (!this.running || this.contextLost) return;
    const frameStartedAt = performance.now();
    const delta = Math.min((timestamp - this.lastTimestamp) / 1000, 0.1);
    this.lastTimestamp = timestamp;
    this.latestInput = this.input.sample();
    this.processPresentationActions(this.latestInput);

    this.pendingEdges.attack ||= this.latestInput.attackPressed;
    this.pendingEdges.dodge ||= this.latestInput.dodgePressed;
    const simulationInput = this.mapSimulationInput(this.latestInput);
    let appliedEdges = false;
    let fixedSteps = 0;
    if (this.simulationPaused) this.clock.reset();
    else this.clock.consume(delta, (dt) => {
      const fixedInput = {
        ...simulationInput,
        attackPressed: !appliedEdges && this.pendingEdges.attack,
        dodgePressed: !appliedEdges && this.pendingEdges.dodge,
      };
      const events = this.fixedTick(fixedInput, dt);
      if (this.criticMode) {
        this.renderBridge.update(this.simulation.state, dt);
        this.updateCamera(dt, this.latestInput.lookX, this.latestInput.lookY);
        this.afterCriticFixedUpdate(fixedInput, events);
      }
      appliedEdges = true;
      fixedSteps += 1;
      return !this.criticCapturePaused;
    });
    if (appliedEdges) {
      this.pendingEdges.attack = false;
      this.pendingEdges.dodge = false;
    }

    const state = this.simulation.state;
    if (state.enemy.health <= 0) this.lockedOn = false;
    if (!this.criticMode) {
      this.updateCamera(delta, this.latestInput.lookX, this.latestInput.lookY);
      this.renderBridge.update(state, delta);
    }
    this.lighting.rig.update(state.elapsed);
    this.hud.update(state, this.cameraController.camera, this.lockedOn);
    this.post.render(this.lighting.scene, this.cameraController.camera);
    this.renderHeartbeat += 1;

    const metrics = this.diagnostics.sample(
      delta,
      fixedSteps,
      performance.now() - frameStartedAt,
      this.renderer,
      this.post,
    );
    this.hud.updateDiagnostics(metrics);
  };

  private afterCriticFixedUpdate(input: InputFrame, events: readonly GameEvent[]): void {
    const absoluteTick = this.simulation.state.tick;
    const started = events.find((event) => event.type === "attack-started");
    if (started?.type === "attack-started") this.criticAttackAbsoluteTick = started.tick;
    if (input.attackPressed) {
      this.criticInputEdges.push({
        absoluteTick: absoluteTick - 1,
        attackRelativeTick: 0,
        device: "mouse",
        button: "left",
        phase: "down",
      });
    }
    this.criticInputHistory.push({
      absoluteTick: absoluteTick - 1,
      attackRelativeTick:
        this.criticAttackAbsoluteTick === null
          ? null
          : absoluteTick - 1 - this.criticAttackAbsoluteTick,
      input: structuredClone(input),
    });
    for (const event of events) {
      this.criticEventSequence += 1;
      const absoluteEventTick =
        event.type === "enemy-hit" || event.type === "enemy-defeated"
          ? event.tick + 1
          : event.tick;
      this.criticEvents.push({
        id: `event-${this.criticEventSequence}`,
        absoluteTick: absoluteEventTick,
        sourceSimulationTick: event.tick,
        postUpdateAbsoluteTick: event.tick + 1,
        attackRelativeTick:
          this.criticAttackAbsoluteTick === null
            ? null
            : absoluteEventTick - this.criticAttackAbsoluteTick,
        event: structuredClone(event),
      });
      if (event.type === "enemy-hit") {
        const dx = this.simulation.state.enemy.position.x - this.simulation.state.player.position.x;
        const dz = this.simulation.state.enemy.position.z - this.simulation.state.player.position.z;
        const length = Math.hypot(dx, dz);
        this.criticResponseImpulse = length > 0.000001
          ? [dx / length, 0, dz / length]
          : [0, 0, -1];
      }
    }

    const weapon = this.renderBridge.hero.root.getObjectByName("stormcage-two-hand-socket");
    if (weapon) {
      const current = weapon.getWorldQuaternion(new THREE.Quaternion());
      const previous = this.criticPreviousWeaponQuaternion;
      if (previous) {
        const delta = previous.clone().invert().multiply(current);
        if (delta.w < 0) delta.set(-delta.x, -delta.y, -delta.z, -delta.w);
        const angle = 2 * Math.acos(THREE.MathUtils.clamp(delta.w, -1, 1));
        const scale = Math.sqrt(Math.max(0, 1 - delta.w * delta.w));
        this.criticWeaponAngularVelocity = {
          radiansPerSecond: angle / FIXED_TIMESTEP,
          direction: scale > 0.000001
            ? [delta.x / scale, delta.y / scale, delta.z / scale]
            : [0, 0, 0],
        };
      }
      this.criticPreviousWeaponQuaternion = current;
    }

    this.recordCriticState();

    if (this.criticArmedTicks.delete(absoluteTick)) {
      this.criticCapturePaused = true;
      this.simulationPaused = true;
    }
  }

  private recordCriticState(): void {
    const state = quantizedWorldState(this.simulation.state);
    const bcj = canonicalizeBcj(state);
    this.criticStateHistory.push({
      absoluteTick: this.simulation.state.tick,
      attackRelativeTick:
        this.criticAttackAbsoluteTick === null
          ? null
          : this.simulation.state.tick - this.criticAttackAbsoluteTick,
      quantization: "1e-6",
      state,
      bcj,
      sha256: sha256Utf8(bcj),
      camera: this.getCameraTelemetry(),
    });
  }

  private mapSimulationInput(input: InputSnapshot): InputFrame {
    const basis = this.cameraController.getPlanarBasis();
    const move = {
      x: basis.right.x * input.moveX + basis.forward.x * input.moveZ,
      z: basis.right.z * input.moveX + basis.forward.z * input.moveZ,
    };
    const magnitude = Math.min(1, Math.hypot(input.moveX, input.moveZ));
    const direction = normalized(move, { x: 0, z: -1 });
    const faceYaw = this.lockedOn
      ? directionToYaw({
          x: this.simulation.state.enemy.position.x - this.simulation.state.player.position.x,
          z: this.simulation.state.enemy.position.z - this.simulation.state.player.position.z,
        })
      : undefined;
    return {
      moveX: direction.x * magnitude,
      moveZ: direction.z * magnitude,
      sprint: input.sprint,
      attackPressed: false,
      dodgePressed: false,
      ...(faceYaw === undefined ? {} : { faceYaw }),
    };
  }

  private updateCamera(dt: number, lookX: number, lookY: number, snap = false): void {
    const state = this.simulation.state;
    this.cameraController.update(
      dt,
      state.player.position,
      state.enemy.health > 0 ? state.enemy.position : null,
      lookX,
      lookY,
      snap,
    );
  }

  private fixedTick(input: InputFrame, dt: number): GameEvent[] {
    const previous = { ...this.simulation.state.player.position };
    this.simulation.step(input, dt);
    const desired = { ...this.simulation.state.player.position };
    const resolved = this.physics.resolvePlayerMovement(
      previous,
      desired,
      this.simulation.state.enemy.position,
      dt,
    );
    this.simulation.reconcilePlayerPosition(resolved);
    const events = this.simulation.consumeEvents();
    this.renderBridge.handleEvents(events, this.simulation.state);
    const hitEvent = events.find((event) => event.type === "enemy-hit");
    if (hitEvent?.type === "enemy-hit") this.hud.toast(`${hitEvent.damage} · REND`);
    if (events.some((event) => event.type === "enemy-defeated")) {
      this.hud.toast("TRIAL COMPLETE");
    }
    return events;
  }

  private processPresentationActions(input: InputSnapshot): void {
    if (input.lockPressed && this.simulation.state.enemy.health > 0) {
      this.lockedOn = !this.lockedOn;
      this.hud.toast(this.lockedOn ? "Hollow marked" : "Lock released");
    }
    if (input.diagnosticsPressed) {
      const visible = this.hud.toggleDiagnostics();
      this.hud.toast(visible ? "Diagnostics open" : "Diagnostics closed");
    }
    if (input.postPressed) {
      const enabled = this.post.toggle();
      this.hud.toast(`Post FX ${enabled ? "on" : "off"}`);
    }
    if (input.capturePressed) this.downloadCapture();
    if (input.pausePressed) {
      this.simulationPaused = !this.simulationPaused;
      if (this.simulationPaused && document.pointerLockElement) void document.exitPointerLock();
      this.hud.toast(this.simulationPaused ? "Trial paused" : "Trial resumed");
    }
    if (
      Math.abs(input.moveX) + Math.abs(input.moveZ) > 0 ||
      input.attackPressed ||
      input.dodgePressed ||
      input.lockPressed
    ) {
      this.hud.markEngaged();
    }
  }

  private readonly onContextLost = (): void => {
    this.contextLost = true;
    this.contextLifecycle.lost = true;
    this.contextLifecycle.losses += 1;
    this.hud.showContextLost(true);
  };

  private readonly onContextRestored = (): void => {
    try {
      // Three rebuilds its low-level GL state first. Reapply the presentation
      // contract and recreate GPU-owned render targets whose CPU descriptors
      // alone do not restore their pre-loss contents (notably PMREM).
      applyRendererPresentationState(this.renderer);
      this.renderer.resetState();
      this.post.restoreAfterContextLoss();
      this.viewport.refresh();
      const environment = this.assetRegistry.createEnvironmentMap(
        "environment.snowy-forest",
        this.renderer,
      );
      this.environmentInstalled = environment !== null;
      this.lighting.scene.environment = environment;
      this.lighting.scene.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return;
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        for (const material of materials) material.needsUpdate = true;
      });

      this.contextLost = false;
      this.contextLifecycle.lost = false;
      this.contextLifecycle.restores += 1;
      this.lastTimestamp = performance.now();
      this.hud.showContextLost(false);
      this.hud.toast("Veil restored");
      this.renderOnce(false, false);
      void this.renderer.compileAsync(this.lighting.scene, this.cameraController.camera)
        .then(() => this.renderOnce(false, false))
        .catch((error: unknown) => {
          this.runtimeErrors.push(
            `context restore compile: ${error instanceof Error ? error.message : String(error)}`,
          );
        });
    } catch (error) {
      this.runtimeErrors.push(
        `context restore: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  private async prepareRenderer(): Promise<void> {
    await document.fonts.ready;
    await this.renderer.compileAsync(this.lighting.scene, this.cameraController.camera);
    this.renderOnce(true);
    this.renderOnce(true);
  }
}
