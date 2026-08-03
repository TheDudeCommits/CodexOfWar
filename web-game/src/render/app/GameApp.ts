import * as THREE from "three";
import { PerfDiagnostics, type RuntimeMetrics } from "../../diagnostics/PerfDiagnostics";
import { getCombatPoseBeatTelemetry } from "../objects/CharacterViews";
import { InputController } from "../../game/input/InputController";
import type { InputSnapshot } from "../../game/input/actions";
import { HeavyContactResolver, type HeavyContactTelemetry } from "../../game/combat/HeavyContactResolver";
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
import { createRenderer, restoreRendererState } from "./createRenderer";
import { createScene, type SceneLighting } from "./createScene";
import {
  ThirdPersonCamera,
  type CameraFramingTelemetry,
  type CameraTelemetry,
} from "./ThirdPersonCamera";
import { ViewportController } from "./ViewportController";

interface PendingEdges {
  attack: boolean;
  attackSource: InputSnapshot["attackSource"];
  heavyAttack: boolean;
  heavyAttackSource: InputSnapshot["heavyAttackSource"];
  dodge: boolean;
}

export interface ProductionFixedUpdateReceipt {
  input: InputFrame;
  lightStrikeSource: InputSnapshot["attackSource"];
  heavyStrikeSource: InputSnapshot["heavyAttackSource"];
  state: WorldState;
  events: GameEvent[];
  healthBefore: number;
  healthAfter: number;
}

export interface ProductionRenderReceipt {
  heartbeat: number;
  absoluteSimulationTick: number;
}

export interface ProductionRuntimeObserver {
  afterFixedUpdate: (receipt: ProductionFixedUpdateReceipt) => boolean | void;
  afterRender?: (receipt: ProductionRenderReceipt) => void;
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
  private readonly heavyContactResolver: HeavyContactResolver;
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
    attackSource: null,
    heavyAttackPressed: false,
    heavyAttackSource: null,
    lockPressed: false,
    diagnosticsPressed: false,
    postPressed: false,
    capturePressed: false,
    pausePressed: false,
    lookX: 0,
    lookY: 0,
  };
  private readonly pendingEdges: PendingEdges = {
    attack: false,
    attackSource: null,
    heavyAttack: false,
    heavyAttackSource: null,
    dodge: false,
  };
  private manifestVersion: number | null = null;
  private readonly reviewMode: boolean;
  private simulationPaused = false;
  private p30AwaitingInput = false;
  private p30ScenarioActive = false;
  private p30HeavyScenarioActive = false;
  private runtimeCapturePaused = false;
  private haltAfterLiveTick = false;
  private renderHeartbeat = 0;
  private lastP30RenderTimestamp = 0;
  private runtimeObserver: ProductionRuntimeObserver | null = null;
  private readonly runtimeErrors: string[] = [];
  private readonly contextLifecycle: {
    lost: boolean;
    losses: number;
    restores: number;
    recovering: boolean;
    lastRestoreMilliseconds: number | null;
  } = {
    lost: false,
    losses: 0,
    restores: 0,
    recovering: false,
    lastRestoreMilliseconds: null,
  };
  private environmentInstalled: boolean;

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
    const heroGeometry = this.renderBridge.hero.getRound012GeometryBindings();
    const targetGeometry = this.renderBridge.zombie.getRound012GeometryBindings();
    this.heavyContactResolver = new HeavyContactResolver({
      scene: this.lighting.scene,
      ...heroGeometry,
      ...targetGeometry,
    });
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
    this.renderBridge.zombie.setVerticalOffset(0);
    this.heavyContactResolver.reset();
    this.physics.reset(this.simulation.state.player.position, this.simulation.state.enemy.position);
    this.clock.reset();
    this.cameraController.reset();
    this.lockedOn = false;
    this.p30AwaitingInput = false;
    this.p30ScenarioActive = false;
    this.p30HeavyScenarioActive = false;
    this.runtimeCapturePaused = false;
    this.pendingEdges.attack = false;
    this.pendingEdges.attackSource = null;
    this.pendingEdges.heavyAttack = false;
    this.pendingEdges.heavyAttackSource = null;
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
    this.renderBridge.zombie.setVerticalOffset(0);
    this.heavyContactResolver.reset();
    this.physics.reset(this.simulation.state.player.position, this.simulation.state.enemy.position);
    this.clock.reset();
    this.cameraController.reset();
    this.lockedOn = false;
    this.p30AwaitingInput = false;
    this.p30ScenarioActive = false;
    this.p30HeavyScenarioActive = false;
    this.runtimeCapturePaused = false;
    this.simulationPaused = false;
    this.pendingEdges.attack = false;
    this.pendingEdges.attackSource = null;
    this.pendingEdges.heavyAttack = false;
    this.pendingEdges.heavyAttackSource = null;
    this.pendingEdges.dodge = false;
    this.renderOnce(true);
  }

  /** Selects the normal deterministic P30 scenario before gameplay begins. */
  prepareP30LightStrikeScenario(): void {
    const initial = createInitialWorld({
      playerPosition: { x: 0, z: 2.6 },
      enemyPosition: { x: 0, z: 0 },
    });
    this.simulation.reset(initial, P30_REVIEW_TUNING);
    this.physics.reset(initial.player.position, initial.enemy.position);
    this.clock.reset();
    this.cameraController.reset();
    this.lockedOn = false;
    this.pendingEdges.attack = false;
    this.pendingEdges.attackSource = null;
    this.pendingEdges.heavyAttack = false;
    this.pendingEdges.heavyAttackSource = null;
    this.pendingEdges.dodge = false;
    this.runtimeCapturePaused = false;
    this.p30ScenarioActive = true;
    this.p30HeavyScenarioActive = false;
    // Tick 0 remains visible and stable until the first real player input.
    // The evaluator then drives the shared W/idle/mouse tape through the
    // production input controller; no scenario action is injected here.
    this.p30AwaitingInput = true;
    this.simulationPaused = true;
    this.renderOnce(true);
  }

  /** Resets the locked Round012 scenario to the pre-update absolute tick -1. */
  prepareP30HeavyStrikeScenario(
    targetOffsetMicrometres: readonly [number, number, number] = [0, 0, 0],
  ): void {
    const [right, up, forward] = targetOffsetMicrometres;
    const initial = createInitialWorld({
      playerPosition: { x: 0, z: 2.6 },
      enemyPosition: {
        // Canonical forward is -Z and right is -X for the frozen spawn.
        x: -right / 1_000_000,
        z: -forward / 1_000_000,
      },
      enemyVerticalOffset: up / 1_000_000,
    });
    initial.tick = -1;
    initial.elapsed = -FIXED_TIMESTEP;
    initial.enemy.idlePhase = -FIXED_TIMESTEP;
    this.simulation.reset(initial, P30_REVIEW_TUNING, 1, true);
    this.physics.reset(initial.player.position, initial.enemy.position, initial.enemy.verticalOffset);
    this.clock.reset();
    this.cameraController.reset();
    this.input.resetGameplayState();
    this.lockedOn = false;
    this.pendingEdges.attack = false;
    this.pendingEdges.attackSource = null;
    this.pendingEdges.heavyAttack = false;
    this.pendingEdges.heavyAttackSource = null;
    this.pendingEdges.dodge = false;
    this.heavyContactResolver.reset();
    this.runtimeCapturePaused = true;
    this.p30ScenarioActive = true;
    this.p30HeavyScenarioActive = true;
    this.p30AwaitingInput = false;
    this.simulationPaused = true;
    this.renderOnce(true);
  }

  setProductionRuntimeObserver(observer: ProductionRuntimeObserver | null): void {
    this.runtimeObserver = observer;
  }

  resumeRuntimeCapture(): void {
    if (!this.runtimeCapturePaused && !this.simulationPaused) return;
    this.runtimeCapturePaused = false;
    this.simulationPaused = false;
    this.clock.reset();
    this.lastTimestamp = performance.now();
  }

  get isRuntimeCapturePaused(): boolean {
    return this.runtimeCapturePaused;
  }

  get currentRenderHeartbeat(): number {
    return this.renderHeartbeat;
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
    this.recordProductionRender();
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

  getCombatPoseTelemetry(): ReturnType<typeof getCombatPoseBeatTelemetry> {
    return getCombatPoseBeatTelemetry();
  }

  getHeavyContactTelemetry(): HeavyContactTelemetry {
    return this.heavyContactResolver.telemetry();
  }

  getRound012GeometrySource(): Record<string, unknown> {
    const hero = this.renderBridge.hero.getRound012GeometryBindings();
    const target = this.renderBridge.zombie.getRound012GeometryBindings();
    return {
      scene: this.lighting.scene,
      camera: this.cameraController.camera,
      heroRoot: this.renderBridge.hero.root,
      leftHandBone: hero.leftHandBone,
      rightHandBone: hero.rightHandBone,
      swordBladePrimitives: hero.swordBladePrimitives,
      targetRoot: this.renderBridge.zombie.root,
      targetSkinnedMeshes: target.targetSkinnedMeshes,
      targetLandmarkBones: target.targetLandmarkBones,
      healthStore: this.simulation.state.enemy,
    };
  }

  getActorWorldHeights(): { attacker: number; target: number } {
    this.lighting.scene.updateMatrixWorld(true);
    const attacker =
      this.renderBridge.hero.root.getObjectByName("nyra-visible-model") ??
      this.renderBridge.hero.root;
    const target =
      this.renderBridge.zombie.root.getObjectByName("hollow-visible-model") ??
      this.renderBridge.zombie.root;
    return {
      attacker: new THREE.Box3().setFromObject(attacker).getSize(new THREE.Vector3()).y,
      target: new THREE.Box3().setFromObject(target).getSize(new THREE.Vector3()).y,
    };
  }

  getProductionModeTelemetry(): {
    rendererMode: "webgl2" | "webgl1";
    assetTier: "production-authored" | "fallback";
    fallbackActive: boolean;
  } {
    const fallbackActive = this.renderBridge.assetReceipt.proceduralFallbackActive ||
      !this.environmentInstalled;
    const context = this.renderer.getContext();
    return {
      rendererMode:
        typeof WebGL2RenderingContext !== "undefined" &&
        context instanceof WebGL2RenderingContext
          ? "webgl2"
          : "webgl1",
      assetTier: fallbackActive ? "fallback" : "production-authored",
      fallbackActive,
    };
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
    context: {
      lost: boolean;
      losses: number;
      restores: number;
      recovering: boolean;
      lastRestoreMilliseconds: number | null;
    };
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
    if (this.latestInput.attackPressed) {
      this.pendingEdges.attackSource = this.latestInput.attackSource;
    }
    this.pendingEdges.heavyAttack ||= this.latestInput.heavyAttackPressed;
    if (this.latestInput.heavyAttackPressed) {
      this.pendingEdges.heavyAttackSource = this.latestInput.heavyAttackSource;
    }
    this.pendingEdges.dodge ||= this.latestInput.dodgePressed;
    if (
      this.p30AwaitingInput &&
      (Math.abs(this.latestInput.moveX) + Math.abs(this.latestInput.moveZ) > 0 ||
        this.latestInput.attackPressed ||
        this.latestInput.heavyAttackPressed ||
        this.latestInput.dodgePressed)
    ) {
      this.p30AwaitingInput = false;
      this.simulationPaused = false;
      this.clock.reset();
    }
    const simulationInput = this.mapSimulationInput(this.latestInput);
    let appliedEdges = false;
    let fixedSteps = 0;
    if (this.simulationPaused) this.clock.reset();
    else this.clock.consume(delta, (dt) => {
      const fixedInput = {
        ...simulationInput,
        attackPressed: !appliedEdges && this.pendingEdges.attack,
        heavyAttackPressed: !appliedEdges && this.pendingEdges.heavyAttack,
        dodgePressed: !appliedEdges && this.pendingEdges.dodge,
      };
      this.haltAfterLiveTick = false;
      this.fixedTick(
        fixedInput,
        dt,
        true,
        this.pendingEdges.attackSource,
        this.pendingEdges.heavyAttackSource,
      );
      appliedEdges = true;
      fixedSteps += 1;
      return !this.haltAfterLiveTick;
    }, this.p30ScenarioActive ? 1 : undefined);
    if (appliedEdges) {
      this.pendingEdges.attack = false;
      this.pendingEdges.attackSource = null;
      this.pendingEdges.heavyAttack = false;
      this.pendingEdges.heavyAttackSource = null;
      this.pendingEdges.dodge = false;
    }

    const state = this.simulation.state;
    if (state.enemy.health <= 0) this.lockedOn = false;
    const shouldPresent =
      !this.p30ScenarioActive ||
      !this.simulationPaused ||
      fixedSteps > 0 ||
      timestamp - this.lastP30RenderTimestamp >= 250;
    if (shouldPresent) {
      const presentationDelta = this.p30ScenarioActive
        ? fixedSteps * FIXED_TIMESTEP
        : delta;
      this.updateCamera(presentationDelta, this.latestInput.lookX, this.latestInput.lookY);
      this.renderBridge.update(state, presentationDelta);
      this.lighting.rig.update(state.elapsed);
      this.hud.update(state, this.cameraController.camera, this.lockedOn);
      this.post.render(this.lighting.scene, this.cameraController.camera);
      this.lastP30RenderTimestamp = performance.now();
      this.recordProductionRender();
    }

    const metrics = this.diagnostics.sample(
      delta,
      fixedSteps,
      performance.now() - frameStartedAt,
      this.renderer,
      this.post,
    );
    this.hud.updateDiagnostics(metrics);
  };

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
      heavyAttackPressed: false,
      dodgePressed: false,
      ...(faceYaw === undefined ? {} : { faceYaw }),
    };
  }

  private updateCamera(dt: number, lookX: number, lookY: number, snap = false): void {
    const state = this.simulation.state;
    const cameraTarget = this.p30HeavyScenarioActive && state.enemy.health > 0
      ? { x: 0, z: 0 }
      : state.enemy.health > 0
        ? state.enemy.position
        : null;
    this.cameraController.update(
      dt,
      state.player.position,
      cameraTarget,
      lookX,
      lookY,
      snap,
    );
  }

  private fixedTick(
    input: InputFrame,
    dt: number,
    notifyRuntimeObserver = false,
    lightStrikeSource: InputSnapshot["attackSource"] = null,
    heavyStrikeSource: InputSnapshot["heavyAttackSource"] = null,
  ): GameEvent[] {
    const previous = { ...this.simulation.state.player.position };
    const healthBefore = this.simulation.state.enemy.health;
    this.simulation.step(input, dt);
    const desired = { ...this.simulation.state.player.position };
    const resolved = this.physics.resolvePlayerMovement(
      previous,
      desired,
      this.simulation.state.enemy.position,
      dt,
    );
    this.simulation.reconcilePlayerPosition(resolved);
    if (this.p30HeavyScenarioActive) {
      this.renderBridge.update(this.simulation.state, dt);
      const player = this.simulation.state.player;
      const contact = this.heavyContactResolver.resolve(
        this.simulation.state.tick,
        player.attackKind === "heavy" ? player.attackSerial : null,
      );
      if (contact) this.simulation.applyHeavyContactDamage(contact.absoluteTick);
    }
    const events = this.simulation.consumeEvents();
    this.renderBridge.handleEvents(events, this.simulation.state);
    const hitEvent = events.find((event) => event.type === "enemy-hit");
    if (hitEvent?.type === "enemy-hit") this.hud.toast(`${hitEvent.damage} · REND`);
    if (events.some((event) => event.type === "enemy-defeated")) {
      this.hud.toast("TRIAL COMPLETE");
    }
    if (notifyRuntimeObserver && this.runtimeObserver) {
      const shouldContinue = this.runtimeObserver.afterFixedUpdate({
        input: { ...input },
        lightStrikeSource: input.attackPressed ? lightStrikeSource : null,
        heavyStrikeSource: input.heavyAttackPressed ? heavyStrikeSource : null,
        state: structuredClone(this.simulation.state),
        events: events.map((event) => ({ ...event })),
        healthBefore,
        healthAfter: this.simulation.state.enemy.health,
      });
      if (shouldContinue === false) {
        this.runtimeCapturePaused = true;
        this.simulationPaused = true;
        this.haltAfterLiveTick = true;
      }
    }
    return events;
  }

  private recordProductionRender(): void {
    this.renderHeartbeat += 1;
    this.runtimeObserver?.afterRender?.({
      heartbeat: this.renderHeartbeat,
      absoluteSimulationTick: this.simulation.state.tick,
    });
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
      input.heavyAttackPressed ||
      input.dodgePressed ||
      input.lockPressed
    ) {
      this.hud.markEngaged();
    }
  }

  private readonly onContextLost = (): void => {
    this.contextLost = true;
    this.contextLifecycle.lost = true;
    this.contextLifecycle.recovering = false;
    this.contextLifecycle.losses += 1;
    this.hud.showContextLost(true);
  };

  private readonly onContextRestored = (): void => {
    const startedAt = performance.now();
    this.contextLost = false;
    this.contextLifecycle.lost = false;
    this.contextLifecycle.restores += 1;
    this.contextLifecycle.recovering = true;
    this.lastTimestamp = performance.now();
    this.hud.showContextLost(false);
    try {
      this.renderer.resetState();
      restoreRendererState(this.renderer);
      this.assetRegistry.restoreGpuResources();
      this.renderBridge.restoreGpuResources();
      this.lighting.rig.restoreGpuResources();

      const restoredEnvironment = this.assetRegistry.createEnvironmentMap(
        "environment.snowy-forest",
        this.renderer,
      );
      this.environmentInstalled = restoredEnvironment !== null;
      this.lighting.scene.environment = restoredEnvironment;

      const size = this.renderer.getSize(new THREE.Vector2());
      this.post.restoreGpuResources(size.x, size.y);
      this.renderOnce(false, false);
      this.contextLifecycle.lastRestoreMilliseconds =
        Math.round((performance.now() - startedAt) * 1000) / 1000;
      this.contextLifecycle.recovering = false;
      this.hud.toast("Veil restored");

      void this.renderer
        .compileAsync(this.lighting.scene, this.cameraController.camera)
        .then(() => this.renderOnce(false, false))
        .catch((error: unknown) => {
          this.runtimeErrors.push(
            `context recompile: ${error instanceof Error ? error.message : String(error)}`,
          );
        });
    } catch (error) {
      this.contextLifecycle.recovering = false;
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
