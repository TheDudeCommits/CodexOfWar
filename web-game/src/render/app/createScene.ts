import * as THREE from "three";
import { LightingRig } from "./LightingRig";

export interface SceneLighting {
  scene: THREE.Scene;
  rig: LightingRig;
}

function createMythicSky(): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(70, 32, 18);
  const position = geometry.getAttribute("position");
  const colors = new Float32Array(position.count * 3);
  const zenith = new THREE.Color(0x071116);
  const upper = new THREE.Color(0x14262d);
  const horizon = new THREE.Color(0x564137);
  const nadir = new THREE.Color(0x11191c);
  const sample = new THREE.Color();
  for (let index = 0; index < position.count; index += 1) {
    const y = THREE.MathUtils.clamp(position.getY(index) / 70, -1, 1);
    if (y < -0.08) {
      sample.copy(nadir).lerp(horizon, THREE.MathUtils.smoothstep(y, -0.72, -0.08));
    } else if (y < 0.28) {
      sample.copy(horizon).lerp(upper, THREE.MathUtils.smoothstep(y, -0.08, 0.28));
    } else {
      sample.copy(upper).lerp(zenith, THREE.MathUtils.smoothstep(y, 0.28, 0.96));
    }
    colors[index * 3] = sample.r;
    colors[index * 3 + 1] = sample.g;
    colors[index * 3 + 2] = sample.b;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  });
  const sky = new THREE.Mesh(geometry, material);
  sky.name = "AshwakeMythicGradientSky";
  sky.frustumCulled = false;
  sky.renderOrder = -1000;
  return sky;
}

export function createScene(): SceneLighting {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x101b20);
  scene.fog = new THREE.FogExp2(0x18262c, 0.046);
  scene.add(createMythicSky());
  return { scene, rig: new LightingRig(scene) };
}
