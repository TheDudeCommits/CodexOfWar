import * as THREE from "three";
import { GameAudio } from "../../audio/GameAudio";
import {
  collectHordeAudioCues,
  collectLegacyAudioCues,
} from "../../audio/GameplayAudioCues";
import { PerfDiagnostics, type RuntimeMetrics } from "../../diagnostics/PerfDiagnostics";
import { isP30CriticScenarioRoute } from "../../diagnostics/P30CriticProtocol";
import { getCombatPoseBeatTelemetry } from "../objects/CharacterViews";
import {
  InputController,
  type LookCaptureTelemetry,
} from "../../game/input/InputController";
import type { InputSnapshot } from "../../game/input/actions";
import { RunRecordStore } from "../../game/persistence/RunRecordStore";
import {
  EMPTY_HORDE_INPUT,
  HordeSimulation,
  type HordeGameEvent,
  type HordeInputFrame,
  type HordeRunState,
} from "../../game/run";
import { FIXED_TIMESTEP } from "../../game/simulation/constants";
import { P30_REVIEW_TUNING } from "../../game/simulation/constants";
import { FixedStepClock } from "../../game/simulation/FixedStepClock";
import { createInitialWorld, EMPTY_INPUT, GameSimulation } from "../../game/simulation/GameSimulation";
import { directionToYaw, normalized } from "../../game/simulation/math";
import type { GameEvent, InputFrame, WorldState } from "../../game/simulation/types";
import { PhysicsBridge } from "../../physics/PhysicsBridge";
import { Hud } from "../../ui/Hud";
import { AudioSettings } from "../../ui/AudioSettings";
import { RunHud, type RunHudEvent } from "../../ui/RunHud";
import type { EnemyFieldSnapshot } from "../objects/EnemyFieldView";
import { RenderBridge, type PresentationAssetReceipt } from "../adapters/RenderBridge";
import {
  hordeEventToHudEvent,
  toEnemyFieldEntity,
  toLegacyPlayerState,
  toRunHudModel,
  toWeaponLoadoutPresentation,
} from "../adapters/HordePresentation";
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
  dodge: boolean;
}

interface PendingHordeEdges {
  attack: boolean;
  special: boolean;
  dodge: boolean;
  weaponSlot: 1 | 2 | 3 | null;
  upgradeChoice: 0 | 1 | 2 | undefined;
  restart: boolean;
  lockToggle: boolean;
}

export interface ProductionFixedUpdateReceipt {
  input: InputFrame;
  lightStrikeSource: InputSnapshot["attackSource"];
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
  private readonly hordeSimulation = new HordeSimulation({
    playerPosition: { x: 0, z: 4.5 },
    arenaRadius: 11,
  });
  private readonly runRecordStore = new RunRecordStore();
  private readonly clock = new FixedStepClock();
  private readonly input = new InputController();
  private readonly cameraController = new ThirdPersonCamera();
  private readonly diagnostics = new PerfDiagnostics();
  private readonly audio: GameAudio;
  private readonly audioSettings: AudioSettings;
  private readonly assetRegistry: AssetRegistry;
  private readonly lighting: SceneLighting;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly contextLossExtension: WEBGL_lose_context | null;
  private readonly post: PostStack;
  private readonly viewport: ViewportController;
  private readonly renderBridge: RenderBridge;
  private readonly hud: Hud;
  private readonly runHud: RunHud | null;
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
    specialAttackPressed: false,
    weaponSlotPressed: null,
    restartPressed: false,
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
    dodge: false,
  };
  private readonly pendingHordeEdges: PendingHordeEdges = {
    attack: false,
    special: false,
    dodge: false,
    weaponSlot: null,
    upgradeChoice: undefined,
    restart: false,
    lockToggle: false,
  };
  private manifestVersion: number | null = null;
  private readonly reviewMode: boolean;
  private readonly hordeMode: boolean;
  private hordePaused = false;
  private hordeAwaitingEngagement = true;
  private hordeRunRecorded = false;
  private hordeHudEvents: RunHudEvent[] = [];
  private simulationPaused = false;
  private p30AwaitingInput = false;
  private p30ScenarioActive = false;
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
    this.hordeMode =
      !this.reviewMode &&
      !isP30CriticScenarioRoute() &&
      !params.has("capture") &&
      params.get("mode") !== "legacy";
    if (this.reviewMode) host.classList.add("is-review-mode");
    if (this.hordeMode) host.classList.add("is-horde-mode");
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
    this.audio = new GameAudio();
    this.audio.attachGestureUnlock(window);
    this.audioSettings = new AudioSettings(host, this.audio);
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
    if (this.hordeMode) {
      this.physics.enableHordeFortCollider();
      this.renderBridge.arena.extendGroundForHorde();
      this.renderBridge.setEnemyFieldEnabled(true);
      this.renderBridge.enemyField.reserve(18);
      this.physics.reset(
        this.hordeSimulation.state.player.position,
        this.toHordePhysicsEnemies(),
      );
      this.runHud = new RunHud(
        host,
        {
          onUpgradeSelected: (_choice, index) => {
            this.pendingHordeEdges.upgradeChoice = index as 0 | 1 | 2;
          },
          onQuickSlotSelected: (_slot, index) => {
            this.pendingHordeEdges.weaponSlot = (index + 1) as 1 | 2 | 3;
          },
          onPauseRequested: () => this.setHordePaused(true),
          onResumeRequested: () => this.setHordePaused(false),
          onRestartRequested: () => {
            this.pendingHordeEdges.restart = true;
          },
          onInputGateChange: (gated) => {
            if (gated) {
              this.clearPendingHordeEdges();
              this.input.suspendLookCapture();
            }
          },
        },
        { listenForKeyboard: false },
      );
      this.consumeHordeEvents(this.hordeSimulation.consumeEvents());
    } else {
      this.runHud = null;
    }
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
    this.audio.setPaused(this.hordeMode ? this.hordePaused : this.simulationPaused);
    this.lastTimestamp = performance.now();
    this.renderer.setAnimationLoop(this.frame);
  }

  pause(): void {
    this.running = false;
    this.audio.setPaused(true);
    this.renderer.setAnimationLoop(null);
  }

  reset(): void {
    if (this.hordeMode) {
      this.resetHordeRun();
      return;
    }
    this.simulation.reset();
    this.physics.reset(this.simulation.state.player.position, this.simulation.state.enemy.position);
    this.clock.reset();
    this.cameraController.reset();
    this.lockedOn = false;
    this.p30AwaitingInput = false;
    this.p30ScenarioActive = false;
    this.runtimeCapturePaused = false;
    this.audio.setPaused(!this.running || this.simulationPaused);
    this.pendingEdges.attack = false;
    this.pendingEdges.attackSource = null;
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
    this.p30AwaitingInput = false;
    this.p30ScenarioActive = false;
    this.runtimeCapturePaused = false;
    this.simulationPaused = false;
    this.pendingEdges.attack = false;
    this.pendingEdges.attackSource = null;
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
    this.pendingEdges.dodge = false;
    this.runtimeCapturePaused = false;
    this.p30ScenarioActive = true;
    // Tick 0 remains visible and stable until the first real player input.
    // The evaluator then drives the shared W/idle/mouse tape through the
    // production input controller; no scenario action is injected here.
    this.p30AwaitingInput = true;
    this.simulationPaused = true;
    this.audio.setPaused(true);
    this.renderOnce(true);
  }

  setProductionRuntimeObserver(observer: ProductionRuntimeObserver | null): void {
    this.runtimeObserver = observer;
  }

  resumeRuntimeCapture(): void {
    if (!this.runtimeCapturePaused) return;
    this.runtimeCapturePaused = false;
    this.simulationPaused = false;
    this.audio.setPaused(false);
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
    this.audio.setPaused(paused);
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
    if (this.hordeMode) {
      this.renderHordeOnce(snapCamera, advanceCamera);
      return;
    }
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
    anchor.download = this.hordeMode
      ? `codex-of-war-horde-${this.hordeSimulation.state.tick}.png`
      : `gauntlet-loop-${this.simulation.state.tick}.png`;
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

  getHordeSnapshot(): HordeRunState {
    return this.hordeSimulation.exportState();
  }

  getEnemyFieldSnapshot(): EnemyFieldSnapshot {
    return this.renderBridge.enemyField.snapshot;
  }

  get isHordeRunMode(): boolean {
    return this.hordeMode;
  }

  getMetrics(): RuntimeMetrics {
    return this.diagnostics.current;
  }

  getCameraTelemetry(): CameraTelemetry {
    return this.cameraController.getTelemetry();
  }

  getInputCaptureTelemetry(): LookCaptureTelemetry {
    return this.input.getLookCaptureTelemetry();
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
    this.runHud?.dispose();
    this.audioSettings.dispose();
    this.audio.dispose();
    this.hud.dispose();
  }

  private readonly frame = (timestamp: number): void => {
    if (!this.running || this.contextLost) return;
    const frameStartedAt = performance.now();
    const delta = Math.min((timestamp - this.lastTimestamp) / 1000, 0.1);
    this.lastTimestamp = timestamp;
    this.latestInput = this.input.sample();
    if (this.hordeMode) {
      this.frameHorde(timestamp, delta, frameStartedAt, this.latestInput);
      return;
    }
    this.processPresentationActions(this.latestInput);

    this.pendingEdges.attack ||= this.latestInput.attackPressed;
    if (this.latestInput.attackPressed) {
      this.pendingEdges.attackSource = this.latestInput.attackSource;
    }
    this.pendingEdges.dodge ||= this.latestInput.dodgePressed;
    if (
      this.p30AwaitingInput &&
      (Math.abs(this.latestInput.moveX) + Math.abs(this.latestInput.moveZ) > 0 ||
        this.latestInput.attackPressed ||
        this.latestInput.dodgePressed)
    ) {
      this.p30AwaitingInput = false;
      this.simulationPaused = false;
      this.audio.setPaused(false);
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
        dodgePressed: !appliedEdges && this.pendingEdges.dodge,
      };
      this.haltAfterLiveTick = false;
      this.fixedTick(fixedInput, dt, true, this.pendingEdges.attackSource);
      appliedEdges = true;
      fixedSteps += 1;
      return !this.haltAfterLiveTick;
    });
    if (appliedEdges) {
      this.pendingEdges.attack = false;
      this.pendingEdges.attackSource = null;
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

  private frameHorde(
    _timestamp: number,
    delta: number,
    frameStartedAt: number,
    input: InputSnapshot,
  ): void {
    this.processHordePresentationActions(input);

    if (this.hordePaused) {
      this.clearPendingHordeEdges();
      this.clock.reset();
      this.presentHorde(0, 0, 0);
      this.updateHordeDiagnostics(delta, 0, frameStartedAt);
      return;
    }

    if (
      this.hordeSimulation.state.phase === "combat" &&
      this.hordeSimulation.state.player.lockedTargetId === null
    ) {
      // Apply look before mapping camera-relative movement and attack facing so
      // a mouse turn and an input edge in the same frame share one orientation.
      this.cameraController.applyLook(input.lookX, input.lookY);
    }

    this.queueHordeEdges(input);
    if (this.hordeAwaitingEngagement) {
      if (this.isHordeEngagementInput(input)) {
        this.hordeAwaitingEngagement = false;
        this.clock.reset();
        this.hud.markEngaged();
      } else {
        this.clock.reset();
        this.presentHorde(0, 0, 0);
        this.updateHordeDiagnostics(delta, 0, frameStartedAt);
        return;
      }
    }

    let fixedSteps = 0;
    const state = this.hordeSimulation.state;
    if (state.phase !== "combat") {
      this.clock.reset();
      if (this.hasPendingHordeModalAction()) {
        const events = this.fixedHordeTick(this.createHordeFixedInput(input, true));
        fixedSteps = 1;
        this.clearPendingHordeEdges();
        if (events.some((event) => event.type === "run-restarted")) this.clock.reset();
      }
    } else {
      let appliedEdges = false;
      this.clock.consume(delta, () => {
        if (!appliedEdges && this.pendingHordeEdges.lockToggle) {
          this.applyPendingHordeLockToggle();
        }
        const events = this.fixedHordeTick({
          ...this.mapHordeInput(input),
          attackPressed: !appliedEdges && this.pendingHordeEdges.attack,
          specialPressed: !appliedEdges && this.pendingHordeEdges.special,
          dodgePressed: !appliedEdges && this.pendingHordeEdges.dodge,
          weaponSlot1Pressed: !appliedEdges && this.pendingHordeEdges.weaponSlot === 1,
          weaponSlot2Pressed: !appliedEdges && this.pendingHordeEdges.weaponSlot === 2,
          weaponSlot3Pressed: !appliedEdges && this.pendingHordeEdges.weaponSlot === 3,
          restartPressed: !appliedEdges && this.pendingHordeEdges.restart,
        });
        appliedEdges = true;
        fixedSteps += 1;
        return !events.some((event) => event.type === "run-restarted");
      });
      if (appliedEdges) this.clearPendingHordeEdges();
    }

    const presentationDelta = fixedSteps * FIXED_TIMESTEP;
    this.presentHorde(presentationDelta, 0, 0);
    this.updateHordeDiagnostics(delta, fixedSteps, frameStartedAt);
  }

  private updateHordeDiagnostics(delta: number, fixedSteps: number, frameStartedAt: number): void {
    const metrics = this.diagnostics.sample(
      delta,
      fixedSteps,
      performance.now() - frameStartedAt,
      this.renderer,
      this.post,
    );
    this.hud.updateDiagnostics(metrics);
  }

  private queueHordeEdges(input: InputSnapshot): void {
    const phase = this.hordeSimulation.state.phase;
    if (phase === "combat") {
      this.pendingHordeEdges.attack ||= input.attackPressed;
      this.pendingHordeEdges.special ||= input.specialAttackPressed;
      this.pendingHordeEdges.dodge ||= input.dodgePressed;
      this.pendingHordeEdges.lockToggle ||= input.lockPressed;
      if (input.weaponSlotPressed !== null) {
        this.pendingHordeEdges.weaponSlot = input.weaponSlotPressed;
      }
      return;
    }
    if (phase === "upgrade" && input.weaponSlotPressed !== null) {
      this.pendingHordeEdges.upgradeChoice = (input.weaponSlotPressed - 1) as 0 | 1 | 2;
    }
    if ((phase === "defeat" || phase === "victory") && input.restartPressed) {
      this.pendingHordeEdges.restart = true;
    }
  }

  private hasPendingHordeModalAction(): boolean {
    const phase = this.hordeSimulation.state.phase;
    return phase === "upgrade"
      ? this.pendingHordeEdges.upgradeChoice !== undefined
      : (phase === "defeat" || phase === "victory") && this.pendingHordeEdges.restart;
  }

  private createHordeFixedInput(input: InputSnapshot, includeEdges: boolean): HordeInputFrame {
    return {
      ...this.mapHordeInput(input),
      attackPressed: includeEdges && this.pendingHordeEdges.attack,
      specialPressed: includeEdges && this.pendingHordeEdges.special,
      dodgePressed: includeEdges && this.pendingHordeEdges.dodge,
      weaponSlot1Pressed: includeEdges && this.pendingHordeEdges.weaponSlot === 1,
      weaponSlot2Pressed: includeEdges && this.pendingHordeEdges.weaponSlot === 2,
      weaponSlot3Pressed: includeEdges && this.pendingHordeEdges.weaponSlot === 3,
      upgradeChoice: includeEdges ? this.pendingHordeEdges.upgradeChoice : undefined,
      restartPressed: includeEdges && this.pendingHordeEdges.restart,
    };
  }

  private mapHordeInput(input: InputSnapshot): HordeInputFrame {
    const basis = this.cameraController.getPlanarBasis();
    const worldMove = {
      x: basis.right.x * input.moveX + basis.forward.x * input.moveZ,
      z: basis.right.z * input.moveX + basis.forward.z * input.moveZ,
    };
    const magnitude = Math.min(1, Math.hypot(input.moveX, input.moveZ));
    const direction = normalized(worldMove, { x: 0, z: -1 });
    const lockedId = this.hordeSimulation.state.player.lockedTargetId;
    const locked = lockedId === null ? undefined : this.hordeSimulation.getEnemyById(lockedId);
    const faceYaw = locked && locked.health > 0
      ? directionToYaw({
          x: locked.position.x - this.hordeSimulation.state.player.position.x,
          z: locked.position.z - this.hordeSimulation.state.player.position.z,
        })
      : directionToYaw({ x: basis.forward.x, z: basis.forward.z });
    return {
      ...EMPTY_HORDE_INPUT,
      moveX: direction.x * magnitude,
      moveZ: direction.z * magnitude,
      sprint: input.sprint,
      faceYaw,
      lockTargetId: lockedId,
    };
  }

  private fixedHordeTick(input: HordeInputFrame): HordeGameEvent[] {
    const previous = { ...this.hordeSimulation.state.player.position };
    this.hordeSimulation.step(input);
    const events = this.hordeSimulation.consumeEvents();
    const state = this.hordeSimulation.state;
    const resetPresentation = events.some(
      (event) => event.type === "run-restarted" || (event.type === "wave-started" && event.wave > 1),
    );
    if (resetPresentation) {
      this.physics.reset(state.player.position, this.toHordePhysicsEnemies());
      this.cameraController.reset();
    } else {
      const desired = { ...state.player.position };
      state.player.position = this.physics.resolvePlayerMovement(
        previous,
        desired,
        this.toHordePhysicsEnemies(),
        FIXED_TIMESTEP,
      );
    }
    this.renderBridge.handleHordeEvents(events, state);
    this.consumeHordeEvents(events);
    return events;
  }

  private toHordePhysicsEnemies(): Array<{
    id: number;
    position: { x: number; z: number };
    radius: number;
    halfHeight: number;
  }> {
    return this.hordeSimulation.state.enemies
      .filter((enemy) => enemy.phase !== "dead" && enemy.health > 0)
      .map((enemy) => ({
        id: enemy.id,
        position: enemy.position,
        radius: enemy.radius,
        halfHeight: enemy.archetype === "brute" ? 0.82 : enemy.archetype === "stalker" ? 0.62 : 0.58,
      }));
  }

  private consumeHordeEvents(events: readonly HordeGameEvent[]): void {
    this.audio.playCues(collectHordeAudioCues(events));
    if (events.some((event) => event.type === "run-restarted")) {
      this.hordeHudEvents = [];
      this.hordeRunRecorded = false;
      this.hordeAwaitingEngagement = true;
      this.hordePaused = false;
      this.clearPendingHordeEdges();
      this.input.suspendLookCapture();
      this.clock.reset();
    }
    for (const event of events) {
      const hudEvent = hordeEventToHudEvent(event);
      if (hudEvent) this.hordeHudEvents.push(hudEvent);
    }
    this.hordeHudEvents = this.hordeHudEvents.slice(-12);

    const terminal = this.hordeSimulation.state.phase === "defeat" ||
      this.hordeSimulation.state.phase === "victory";
    if (terminal && !this.hordeRunRecorded) {
      const state = this.hordeSimulation.state;
      const records = this.runRecordStore.record({
        score: state.score,
        wave: state.wave,
        kills: state.kills,
        victory: state.phase === "victory",
      });
      this.hordeRunRecorded = true;
      this.hordeHudEvents.push({
        id: `record-${state.tick}`,
        text: `Best score · ${records.bestScore.toLocaleString("en-US")}`,
        tone: "reward",
      });
      this.hordeHudEvents = this.hordeHudEvents.slice(-12);
    }
  }

  private processHordePresentationActions(input: InputSnapshot): void {
    if (input.diagnosticsPressed) {
      const visible = this.hud.toggleDiagnostics();
      this.hud.toast(visible ? "Diagnostics open" : "Diagnostics closed");
    }
    if (input.postPressed) {
      const enabled = this.post.toggle();
      this.hud.toast(`Post FX ${enabled ? "on" : "off"}`);
    }
    if (input.capturePressed) this.downloadCapture();
    if (input.pausePressed && this.hordeSimulation.state.phase === "combat") {
      this.setHordePaused(!this.hordePaused);
    }
  }

  private applyPendingHordeLockToggle(): void {
    const player = this.hordeSimulation.state.player;
    if (player.lockedTargetId === null) {
      const target = this.hordeSimulation.lockBestTarget();
      this.hud.toast(target === null ? "No target in range" : "Target marked");
    } else {
      player.lockedTargetId = null;
      this.hud.toast("Lock released");
    }
  }

  private isHordeEngagementInput(input: InputSnapshot): boolean {
    return (
      Math.abs(input.moveX) + Math.abs(input.moveZ) > 0 ||
      input.attackPressed ||
      input.specialAttackPressed ||
      input.dodgePressed ||
      input.weaponSlotPressed !== null ||
      input.lockPressed ||
      this.pendingHordeEdges.weaponSlot !== null ||
      this.pendingHordeEdges.attack ||
      this.pendingHordeEdges.special ||
      this.pendingHordeEdges.dodge ||
      this.pendingHordeEdges.lockToggle
    );
  }

  private setHordePaused(paused: boolean): void {
    if (paused === this.hordePaused || this.hordeSimulation.state.phase !== "combat") return;
    this.hordePaused = paused;
    this.audio.setPaused(paused);
    this.clearPendingHordeEdges();
    this.input.suspendLookCapture();
    this.clock.reset();
    this.lastTimestamp = performance.now();
    this.hud.toast(paused ? "Horde Run paused" : "Horde Run resumed");
  }

  private clearPendingHordeEdges(): void {
    this.pendingHordeEdges.attack = false;
    this.pendingHordeEdges.special = false;
    this.pendingHordeEdges.dodge = false;
    this.pendingHordeEdges.weaponSlot = null;
    this.pendingHordeEdges.upgradeChoice = undefined;
    this.pendingHordeEdges.restart = false;
    this.pendingHordeEdges.lockToggle = false;
  }

  private updateHordeCamera(dt: number, lookX: number, lookY: number, snap = false): void {
    const state = this.hordeSimulation.state;
    const locked = state.player.lockedTargetId === null
      ? undefined
      : state.enemies.find(
          (enemy) => enemy.id === state.player.lockedTargetId && enemy.health > 0,
        );
    this.cameraController.update(
      dt,
      state.player.position,
      locked?.position ?? null,
      lookX,
      lookY,
      snap,
    );
  }

  private presentHorde(dt: number, lookX: number, lookY: number, snap = false): void {
    const state = this.hordeSimulation.state;
    this.updateHordeCamera(dt, lookX, lookY, snap);
    this.renderBridge.updateHorde(
      toLegacyPlayerState(state),
      state.enemies.map(toEnemyFieldEntity),
      toWeaponLoadoutPresentation(state),
      state.elapsedSeconds,
      dt,
    );
    this.lighting.rig.update(state.elapsedSeconds);
    this.runHud?.update(
      toRunHudModel(state, this.hordePaused, this.hordeHudEvents, this.hordeAwaitingEngagement),
    );
    this.post.render(this.lighting.scene, this.cameraController.camera);
    this.recordProductionRender();
  }

  private renderHordeOnce(snapCamera: boolean, advanceCamera: boolean): void {
    if (advanceCamera) this.updateHordeCamera(FIXED_TIMESTEP, 0, 0, snapCamera);
    const state = this.hordeSimulation.state;
    this.renderBridge.updateHorde(
      toLegacyPlayerState(state),
      state.enemies.map(toEnemyFieldEntity),
      toWeaponLoadoutPresentation(state),
      state.elapsedSeconds,
      advanceCamera ? FIXED_TIMESTEP : 0,
    );
    this.lighting.rig.update(state.elapsedSeconds);
    this.runHud?.update(
      toRunHudModel(state, this.hordePaused, this.hordeHudEvents, this.hordeAwaitingEngagement),
    );
    this.post.render(this.lighting.scene, this.cameraController.camera);
    this.recordProductionRender();
  }

  private resetHordeRun(): void {
    this.hordeSimulation.restart();
    const events = this.hordeSimulation.consumeEvents();
    this.consumeHordeEvents(events);
    this.physics.reset(
      this.hordeSimulation.state.player.position,
      this.toHordePhysicsEnemies(),
    );
    this.cameraController.reset();
    this.clearPendingHordeEdges();
    this.renderOnce(true);
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

  private fixedTick(
    input: InputFrame,
    dt: number,
    notifyRuntimeObserver = false,
    lightStrikeSource: InputSnapshot["attackSource"] = null,
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
    const events = this.simulation.consumeEvents();
    this.audio.playCues(collectLegacyAudioCues(events));
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
        state: structuredClone(this.simulation.state),
        events: events.map((event) => ({ ...event })),
        healthBefore,
        healthAfter: this.simulation.state.enemy.health,
      });
      if (shouldContinue === false) {
        this.runtimeCapturePaused = true;
        this.simulationPaused = true;
        this.audio.setPaused(true);
        this.haltAfterLiveTick = true;
      }
    }
    return events;
  }

  private recordProductionRender(): void {
    this.renderHeartbeat += 1;
    this.runtimeObserver?.afterRender?.({
      heartbeat: this.renderHeartbeat,
      absoluteSimulationTick: this.hordeMode
        ? this.hordeSimulation.state.tick
        : this.simulation.state.tick,
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
      this.audio.setPaused(this.simulationPaused);
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
