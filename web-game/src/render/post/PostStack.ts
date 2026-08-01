import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

export class PostStack {
  enabled: boolean;
  lastRenderMilliseconds = 0;
  private readonly composer: EffectComposer;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    enabled: boolean,
    private readonly pixelRatio: number,
  ) {
    this.enabled = enabled;
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.32, 0.52, 0.82);
    this.composer.addPass(bloom);
    this.composer.addPass(new OutputPass());
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    const startedAt = performance.now();
    if (this.enabled) this.composer.render();
    else this.renderer.render(scene, camera);
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

  dispose(): void {
    this.composer.dispose();
  }
}
