import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

const ASHWAKE_GRADE = {
  uniforms: {
    tDiffuse: { value: null },
    contrast: { value: 1.075 },
    saturation: { value: 1.08 },
    vignetteStrength: { value: 0.22 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float contrast;
    uniform float saturation;
    uniform float vignetteStrength;
    varying vec2 vUv;

    void main() {
      vec4 source = texture2D(tDiffuse, vUv);
      vec3 color = (source.rgb - 0.5) * contrast + 0.5;
      float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
      color = mix(vec3(luminance), color, saturation);
      color *= vec3(1.025, 1.0, 0.965);
      float edge = smoothstep(0.32, 0.78, distance(vUv, vec2(0.5)));
      color *= 1.0 - edge * vignetteStrength;
      gl_FragColor = vec4(max(color, vec3(0.0)), source.a);
    }
  `,
};

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
      new UnrealBloomPass(new THREE.Vector2(1, 1), 0.28, 0.48, 0.86),
    );
    composer.addPass(new ShaderPass(ASHWAKE_GRADE));
    composer.addPass(new OutputPass());
    return composer;
  }

  private disposeComposer(): void {
    for (const pass of this.composer.passes) pass.dispose();
    this.composer.dispose();
  }
}
