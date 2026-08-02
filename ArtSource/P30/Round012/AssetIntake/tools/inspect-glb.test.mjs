import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { inspectArtifact, measureGlb, parseGlb } from "./inspect-glb.mjs";

function pad4(buffer, byte = 0) {
  const padding = (4 - (buffer.length % 4)) % 4;
  return padding ? Buffer.concat([buffer, Buffer.alloc(padding, byte)]) : buffer;
}

function fixtureGlb() {
  const positions = Buffer.alloc(36);
  [0, 0, 0, 1, 0, 0, 0, 1, 0].forEach((value, index) => positions.writeFloatLE(value, index * 4));
  const texcoords = Buffer.alloc(24);
  [0, 0, 1, 0, 0, 1].forEach((value, index) => texcoords.writeFloatLE(value, index * 4));
  const indices = Buffer.alloc(6);
  [0, 1, 2].forEach((value, index) => indices.writeUInt16LE(value, index * 2));
  const geometry = Buffer.concat([positions, texcoords, indices, Buffer.alloc(2)]);
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
  const bin = pad4(Buffer.concat([geometry, png]));
  const document = {
    asset: { version: "2.0", generator: "Round012 deterministic fixture" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, TEXCOORD_0: 1 }, indices: 2, material: 0 }] }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: "VEC3", min: [0, 0, 0], max: [1, 1, 0] },
      { bufferView: 1, componentType: 5126, count: 3, type: "VEC2", min: [0, 0], max: [1, 1] },
      { bufferView: 2, componentType: 5123, count: 3, type: "SCALAR", min: [0], max: [2] }
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36, target: 34962 },
      { buffer: 0, byteOffset: 36, byteLength: 24, target: 34962 },
      { buffer: 0, byteOffset: 60, byteLength: 6, target: 34963 },
      { buffer: 0, byteOffset: 68, byteLength: png.length }
    ],
    buffers: [{ byteLength: 68 + png.length }],
    images: [{ bufferView: 3, mimeType: "image/png" }],
    textures: [{ source: 0 }],
    materials: [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }]
  };
  const json = pad4(Buffer.from(JSON.stringify(document), "utf8"), 0x20);
  const totalLength = 12 + 8 + json.length + 8 + bin.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(json.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(bin.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jsonHeader, json, binHeader, bin]);
}

test("measures GLB triangles, materials, textures, animation, rig, and size", () => {
  const bytes = fixtureGlb();
  const metrics = measureGlb(bytes);
  assert.equal(metrics.triangles, 1);
  assert.equal(metrics.materials, 1);
  assert.equal(metrics.textures, 1);
  assert.deepEqual(metrics.images.map(({ width, height }) => [width, height]), [[1, 1]]);
  assert.equal(metrics.animations.count, 0);
  assert.equal(metrics.rig.skins, 0);
  assert.equal(metrics.rig.uniqueJoints, 0);
  assert.equal(metrics.fileSizeBytes, bytes.length);
  assert.match(metrics.sha256, /^[0-9a-f]{64}$/u);
});

test("rejects malformed GLB bytes before measuring", () => {
  assert.throws(() => parseGlb(Buffer.alloc(20)), /magic/u);
});

test("runs official glTF validation and glTF Transform deterministically", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "p30-r012-glb-"));
  const assetPath = path.join(directory, "fixture.glb");
  await writeFile(assetPath, fixtureGlb());
  const policy = {
    format: "glb",
    maxFileSizeBytes: 1048576,
    triangles: { min: 1, max: 1 },
    materials: { min: 1, max: 1 },
    textures: {
      minImages: 1,
      maxImages: 1,
      minLargestDimension: 1,
      maxLargestDimension: 1,
      requiredMaterialChannels: ["baseColor"],
      externalResourcesAllowed: false
    },
    rig: {
      required: false,
      minSkins: 0,
      minUniqueJoints: 0,
      minSkinnedNodes: 0,
      inverseBindMatricesRequired: false
    },
    animations: { minClips: 0 },
    validation: {
      maxErrors: 0,
      maxWarnings: 10,
      gltfValidatorVersion: "2.0.0-dev.3.10",
      gltfTransformVersion: "4.4.2"
    }
  };
  const report = await inspectArtifact(assetPath, policy);
  assert.equal(report.validation.errors, 0, JSON.stringify(report.validation.messages));
  assert.equal(report.gltfTransform.validateExitCode, 0);
  assert.equal(report.gltfTransform.inspectExitCode, 0);
  assert.equal(report.decision, "admit");
});
