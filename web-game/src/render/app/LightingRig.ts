import * as THREE from "three";

/**
 * Deterministic dark-mythic light rig. Every animated value is a pure function
 * of simulation elapsed time, so live rendering and renderOnce sample the
 * exact same presentation state.
 */
export class LightingRig {
  private readonly lights = new THREE.Group();
  private readonly key = new THREE.DirectionalLight(0xffc58f, 3.4);
  private readonly rim = new THREE.DirectionalLight(0x7fa9c2, 1.2);
  private readonly brazierFill = new THREE.PointLight(0xe76f3f, 6.6, 10.5, 2);
  private readonly thresholdFill = new THREE.PointLight(0x6f9db9, 3.35, 9, 2);

  constructor(private readonly scene: THREE.Scene) {
    this.lights.name = "AshwakeLightingRig";

    const hemisphere = new THREE.HemisphereLight(0x91a6b0, 0x120b09, 0.48);
    hemisphere.name = "AshwakeCoolSkyDarkBounce";
    this.lights.add(hemisphere);

    this.key.name = "AshwakeWarmKey";
    this.key.position.set(-5.8, 10.5, 7.2);
    this.key.target.position.set(0, 1.15, -1.8);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    this.key.shadow.camera.left = -12;
    this.key.shadow.camera.right = 12;
    this.key.shadow.camera.top = 12;
    this.key.shadow.camera.bottom = -12;
    this.key.shadow.camera.near = 1;
    this.key.shadow.camera.far = 34;
    this.key.shadow.bias = -0.00018;
    this.key.shadow.normalBias = 0.045;
    this.lights.add(this.key, this.key.target);

    this.rim.name = "AshwakeCoolRim";
    this.rim.position.set(6.8, 5.6, -7.5);
    this.rim.target.position.set(0, 1.35, 0.2);
    this.lights.add(this.rim, this.rim.target);

    this.brazierFill.name = "AshwakeLocalizedWarmFill";
    this.brazierFill.position.set(-4.6, 1.25, -2.6);
    this.lights.add(this.brazierFill);

    this.thresholdFill.name = "AshwakeThresholdFill";
    this.thresholdFill.position.set(4.15, 2.35, -5.3);
    this.lights.add(this.thresholdFill);

    scene.add(this.lights);
    this.update(0);
  }

  update(elapsed: number): void {
    const fire = Math.sin(elapsed * 2.15) * 0.5 + Math.sin(elapsed * 5.35 + 0.7) * 0.18;
    const air = Math.sin(elapsed * 0.72 + 1.4);
    this.brazierFill.intensity = 6.5 + fire;
    this.thresholdFill.intensity = 3.35 + air * 0.16;
    this.rim.intensity = 1.2 + air * 0.045;
  }

  restoreGpuResources(): void {
    this.key.shadow.map?.dispose();
    this.key.shadow.map = null;
    this.key.shadow.needsUpdate = true;
    this.lights.updateMatrixWorld(true);
  }

  dispose(): void {
    this.scene.remove(this.lights);
    this.key.shadow.map?.dispose();
  }
}
