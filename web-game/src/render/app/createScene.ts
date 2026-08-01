import * as THREE from "three";
import { LightingRig } from "./LightingRig";

export interface SceneLighting {
  scene: THREE.Scene;
  rig: LightingRig;
}

export function createScene(): SceneLighting {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a272d);
  scene.fog = new THREE.FogExp2(0x1b292f, 0.035);
  return { scene, rig: new LightingRig(scene) };
}
