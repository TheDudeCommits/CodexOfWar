import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

export class PostStack {
  enabled: boolean;
  lastRenderMilliseconds = 0;
  private composer: EffectComposer;
  private width = 1;
  private height = 1;

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

  private createComposer(): EffectComposer {
    const composer = new EffectComposer(this.renderer);
    composer.addPass(new RenderPass(this.scene, this.camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.32, 0.52, 0.82);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    return composer;
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    const startedAt = performance.now();
    if (this.enabled) this.composer.render();
    else this.renderer.render(scene, camera);
    this.lastRenderMilliseconds = performance.now() - startedAt;
  }

  setSize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.composer.setPixelRatio(this.pixelRatio);
    this.composer.setSize(width, height);
  }

  restoreAfterContextLoss(): void {
    this.composer.dispose();
    this.composer = this.createComposer();
    this.setSize(this.width, this.height);
  }

  toggle(): boolean {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  dispose(): void {
    this.composer.dispose();
  }
}
