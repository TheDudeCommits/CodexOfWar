import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

export class PostStack {
  enabled: boolean;
  lastRenderMilliseconds = 0;
  private composer: EffectComposer;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.Camera,
    enabled: boolean,
    private readonly pixelRatio: number,
  ) {
    this.enabled = enabled;
    this.composer = this.createComposer();
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    const startedAt = performance.now();
    const previousAutoReset = this.renderer.info.autoReset;
    this.renderer.info.autoReset = false;
    this.renderer.info.reset();
    try {
      if (this.enabled) this.composer.render();
      else this.renderer.render(scene, camera);
    } finally {
      this.renderer.info.autoReset = previousAutoReset;
    }
    this.lastRenderMilliseconds = performance.now() - startedAt;
  }

  setSize(width: number, height: number): void {
    this.composer.setPixelRatio(this.pixelRatio);
    this.composer.setSize(width, height);
  }

  toggle(): boolean {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  restoreGpuResources(width: number, height: number): void {
    this.disposeComposer();
    this.composer = this.createComposer();
    this.setSize(width, height);
  }

  dispose(): void {
    this.disposeComposer();
  }

  private createComposer(): EffectComposer {
    const composer = new EffectComposer(this.renderer);
    composer.addPass(new RenderPass(this.scene, this.camera));
    composer.addPass(
      new UnrealBloomPass(new THREE.Vector2(1, 1), 0.32, 0.52, 0.82),
    );
    composer.addPass(new OutputPass());
    return composer;
  }

  private disposeComposer(): void {
    for (const pass of this.composer.passes) pass.dispose();
    this.composer.dispose();
  }
}
