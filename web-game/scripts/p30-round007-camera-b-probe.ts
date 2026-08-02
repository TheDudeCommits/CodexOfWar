import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import * as THREE from "three";
import { ThirdPersonCamera } from "../src/render/app/ThirdPersonCamera";

const outputRoot = resolve(
  process.env.ROUND007_OUTPUT_ROOT ?? "../ArtSource/P30/Round007/BuilderB",
);

function createCamera(): ThirdPersonCamera {
  const camera = new ThirdPersonCamera();
  camera.reset();
  return camera;
}

const unobstructedCamera = createCamera();
unobstructedCamera.setObstructionObjects([]);
unobstructedCamera.update(
  1 / 60,
  { x: 0, z: 1.6 },
  { x: 0, z: 0 },
  0,
  0,
  true,
);
const unobstructed = unobstructedCamera.getTelemetry();

const focus = new THREE.Vector3(...unobstructed.composition.focus);
const desired = new THREE.Vector3(...unobstructed.position);
const midpoint = focus.clone().lerp(desired, 0.56);
const wall = new THREE.Mesh(
  new THREE.BoxGeometry(10, 10, 0.1),
  new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
);
wall.name = "round007-wall-on-boom-path";
wall.position.copy(midpoint);
wall.updateMatrixWorld(true);

const obstructedCamera = createCamera();
obstructedCamera.setObstructionObjects([wall]);
obstructedCamera.update(
  1 / 60,
  { x: 0, z: 1.6 },
  { x: 0, z: 0 },
  0,
  0,
  true,
);
const obstructed = obstructedCamera.getTelemetry();

const evidence = {
  schema: "p30.round007.camera-obstruction-evidence.v1",
  testGeometry: {
    kind: "THREE.Mesh",
    geometry: "BoxGeometry",
    name: wall.name,
    position: wall.position.toArray(),
  },
  requiredClearanceMeters: 0.45,
  wallOnBoom: {
    ...obstructed.boom,
    passed:
      obstructed.boom.collisionApplied &&
      obstructed.boom.status === "obstructed" &&
      obstructed.boom.resolvedDistance < obstructed.boom.desiredDistance &&
      obstructed.boom.clearance !== null &&
      obstructed.boom.clearance >= 0.45 - 1e-12,
  },
  unobstructed: {
    ...unobstructed.boom,
    exactDistanceEquality:
      unobstructed.boom.resolvedDistance === unobstructed.boom.desiredDistance,
    passed:
      !unobstructed.boom.collisionApplied &&
      unobstructed.boom.status === "clear" &&
      unobstructed.boom.resolvedDistance === unobstructed.boom.desiredDistance,
  },
};

await mkdir(outputRoot, { recursive: true });
await writeFile(
  resolve(outputRoot, "obstruction-evidence.json"),
  `${JSON.stringify(evidence, null, 2)}\n`,
);
console.log(JSON.stringify(evidence, null, 2));
