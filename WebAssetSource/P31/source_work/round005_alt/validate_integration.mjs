#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../../../..");
const targets = [
  {
    id: "hero",
    processed: "WebAssetSource/P31/processed/round005/characters/nyra.glb",
    runtime: "web-game/public/assets/models/ashwake/nyra.glb",
    clips: ["Idle_Loop", "Walk_Loop", "Sprint_Loop", "Roll", "Sword_Regular_A"],
    socket: "weapon_socket",
    maxTriangles: 42000,
  },
  {
    id: "hollow",
    processed: "WebAssetSource/P31/processed/round005/characters/hollow.glb",
    runtime: "web-game/public/assets/models/ashwake/hollow.glb",
    clips: ["Idle", "HitReact", "Death"],
    socket: null,
    maxTriangles: 16000,
  },
  {
    id: "weapon",
    processed: "WebAssetSource/P31/processed/round005/weapons/stormcage.glb",
    runtime: "web-game/public/assets/models/ashwake/stormcage.glb",
    clips: [],
    socket: null,
    maxTriangles: 3000,
  },
];

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function parseGlb(buffer) {
  if (buffer.toString("ascii", 0, 4) !== "glTF") throw new Error("Not a GLB");
  if (buffer.readUInt32LE(4) !== 2) throw new Error("Unsupported GLB version");
  if (buffer.readUInt32LE(8) !== buffer.length) throw new Error("GLB length mismatch");
  const jsonLength = buffer.readUInt32LE(12);
  const jsonType = buffer.toString("ascii", 16, 20);
  if (jsonType !== "JSON") throw new Error("First GLB chunk is not JSON");
  return JSON.parse(buffer.toString("utf8", 20, 20 + jsonLength).trim());
}

function trianglesForPrimitive(gltf, primitive) {
  const mode = primitive.mode ?? 4;
  const count = primitive.indices !== undefined
    ? gltf.accessors[primitive.indices].count
    : gltf.accessors[primitive.attributes.POSITION].count;
  if (mode === 4) return Math.floor(count / 3);
  if (mode === 5 || mode === 6) return Math.max(0, count - 2);
  return 0;
}

function animationDuration(gltf, animation) {
  let duration = 0;
  for (const sampler of animation.samplers ?? []) {
    const accessor = gltf.accessors[sampler.input];
    if (Array.isArray(accessor?.max)) duration = Math.max(duration, accessor.max[0] ?? 0);
  }
  return duration;
}

async function inspect(target) {
  const processedPath = resolve(root, target.processed);
  const runtimePath = resolve(root, target.runtime);
  const [processed, runtime] = await Promise.all([readFile(processedPath), readFile(runtimePath)]);
  if (!processed.equals(runtime)) throw new Error(`${target.id}: processed/runtime bytes differ`);
  const gltf = parseGlb(processed);
  const primitives = (gltf.meshes ?? []).flatMap((mesh) => mesh.primitives ?? []);
  const triangles = primitives.reduce((sum, primitive) => sum + trianglesForPrimitive(gltf, primitive), 0);
  const animations = Object.fromEntries(
    (gltf.animations ?? []).map((animation) => [animation.name, animationDuration(gltf, animation)]),
  );
  const clipNames = Object.keys(animations).sort();
  const expected = [...target.clips].sort();
  if (JSON.stringify(clipNames) !== JSON.stringify(expected)) {
    throw new Error(`${target.id}: clips ${clipNames.join(",")} != ${expected.join(",")}`);
  }
  if (target.socket && !(gltf.nodes ?? []).some((node) => node.name === target.socket)) {
    throw new Error(`${target.id}: missing ${target.socket}`);
  }
  if (triangles > target.maxTriangles) {
    throw new Error(`${target.id}: ${triangles} triangles exceeds ${target.maxTriangles}`);
  }
  const skinnedPrimitives = primitives.filter((primitive) => primitive.attributes?.JOINTS_0 !== undefined).length;
  if (target.id !== "weapon" && (gltf.skins?.length ?? 0) !== 1) {
    throw new Error(`${target.id}: expected one skin`);
  }
  if (target.id !== "weapon" && skinnedPrimitives !== primitives.length) {
    throw new Error(`${target.id}: not every primitive is skinned`);
  }
  return {
    id: target.id,
    path: target.processed,
    runtimePath: target.runtime,
    bytes: processed.length,
    sha256: sha256(processed),
    triangles,
    primitives: primitives.length,
    geometries: gltf.meshes?.length ?? 0,
    materials: gltf.materials?.map((material) => material.name) ?? [],
    textures: gltf.textures?.length ?? 0,
    images: gltf.images?.length ?? 0,
    skins: gltf.skins?.length ?? 0,
    nodes: gltf.nodes?.length ?? 0,
    animations,
    socketPresent: target.socket ? true : null,
    byteIdentical: true,
  };
}

const assets = [];
for (const target of targets) assets.push(await inspect(target));
const visibleTriangles = assets.reduce((sum, asset) => sum + asset.triangles, 0);
const packagePrimitives = assets.reduce((sum, asset) => sum + asset.primitives, 0);
const packageTextures = assets.reduce((sum, asset) => sum + asset.textures, 0);
if (visibleTriangles > 73072) {
  throw new Error(`Package visible triangles ${visibleTriangles} exceed hard pre-shadow ceiling 73072`);
}
const report = {
  schema: "gauntlet.p31.round005.duel-validation.v1",
  status: "pass",
  assets,
  package: {
    visibleTriangles,
    projectedRenderedTrianglesS04: 103855 + visibleTriangles * 2,
    projectedCallsS04: 42 + packagePrimitives * 2,
    projectedTexturesS04: 21 + packageTextures,
    hardLimits: { renderedTrianglesS04: 250000, callsS04: 100, textures: 32 },
  },
  assertions: {
    processedRuntimeByteIdentity: true,
    exactClipSets: true,
    heroWeaponSocket: true,
    actorSkins: true,
    visibleTriangleCeiling: true,
  },
};
await writeFile(
  resolve(import.meta.dirname, "reports/integration-validation.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(JSON.stringify(report, null, 2));
