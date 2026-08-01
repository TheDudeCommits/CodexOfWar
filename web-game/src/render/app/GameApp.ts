import * as THREE from "three";
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
import { createRenderer } from "./createRenderer";
import { createScene, type SceneLighting } from "./createScene";
import { ThirdPersonCamera, type CameraTelemetry } from "./ThirdPersonCamera";
import { ViewportController } from "./ViewportController";

interface PendingEdges {
  attack: boolean;
  dodge: boolean;
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
  private readonly environmentInstalled: boolean;

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

  stepReviewFrame(input: InputFrame): GameEvent[] {
    if (this.simulationPaused) return [];
    const events = this.fixedTick(input, FIXED_TIMESTEP);
    this.renderBridge.update(this.simulation.state, FIXED_TIMESTEP);
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
    }
    this.renderOnce(true);
  }

  renderOnce(snapCamera = false): void {
    const state = this.simulation.state;
    this.cameraController.update(
      FIXED_TIMESTEP,
      state.player.position,
      this.lockedOn && state.enemy.health > 0 ? state.enemy.position : null,
      0,
      0,
      snapCamera,
    );
    this.lighting.rig.update(state.elapsed);
    this.renderBridge.update(state, FIXED_TIMESTEP);
    this.hud.update(state, this.cameraController.camera, this.lockedOn);
    this.post.render(this.lighting.scene, this.cameraController.camera);
  }

  capturePng(): string {
    this.renderOnce();
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
    this.renderOnce();
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
      this.fixedTick(fixedInput, dt);
      appliedEdges = true;
      fixedSteps += 1;
    });
    if (appliedEdges) {
      this.pendingEdges.attack = false;
      this.pendingEdges.dodge = false;
    }

    const state = this.simulation.state;
    if (state.enemy.health <= 0) this.lockedOn = false;
    this.cameraController.update(
      delta,
      state.player.position,
      this.lockedOn ? state.enemy.position : null,
      this.latestInput.lookX,
      this.latestInput.lookY,
    );
    this.renderBridge.update(state, delta);
    this.lighting.rig.update(state.elapsed);
    this.hud.update(state, this.cameraController.camera, this.lockedOn);
    this.post.render(this.lighting.scene, this.cameraController.camera);

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
      dodgePressed: false,
      ...(faceYaw === undefined ? {} : { faceYaw }),
    };
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
    this.contextLost = false;
    this.contextLifecycle.lost = false;
    this.contextLifecycle.restores += 1;
    this.lastTimestamp = performance.now();
    this.hud.showContextLost(false);
    this.hud.toast("Veil restored");
    this.renderOnce();
  };

  private async prepareRenderer(): Promise<void> {
    await document.fonts.ready;
    await this.renderer.compileAsync(this.lighting.scene, this.cameraController.camera);
    this.renderOnce(true);
    this.renderOnce(true);
  }
}
