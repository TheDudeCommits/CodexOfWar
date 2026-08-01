import * as THREE from "three";

export interface SceneLighting {
  scene: THREE.Scene;
  pulseLight: THREE.PointLight;
  rimLight: THREE.PointLight;
}

export function createScene(): SceneLighting {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x11181d);
  scene.fog = new THREE.FogExp2(0x10171b, 0.026);

  const hemisphere = new THREE.HemisphereLight(0xb7ced5, 0x241510, 1.85);
  scene.add(hemisphere);

  const key = new THREE.DirectionalLight(0xffddb0, 4.15);
  key.position.set(-5.5, 10, 6.5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -13;
  key.shadow.camera.right = 13;
  key.shadow.camera.top = 13;
  key.shadow.camera.bottom = -13;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 32;
  key.shadow.bias = -0.00025;
  key.shadow.normalBias = 0.035;
  scene.add(key);

  const pulseLight = new THREE.PointLight(0xe94a32, 18, 10, 2);
  pulseLight.position.set(-4.2, 1.2, -2.7);
  scene.add(pulseLight);

  const rimLight = new THREE.PointLight(0x39b8d0, 15, 11, 2);
  rimLight.position.set(4.6, 2.1, 2.8);
  scene.add(rimLight);

  return { scene, pulseLight, rimLight };
}
