#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { verifyArtifactAuthorization } from "./artifact-authorization.mjs";

const require = createRequire(import.meta.url);
const gltfValidator = require("gltf-validator");

const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;
const GLB_MAGIC = 0x46546c67;
const TRIANGLES = 4;
const TRIANGLE_STRIP = 5;
const TRIANGLE_FAN = 6;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function readUint24LE(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

export function parseImageDimensions(bytes, declaredMimeType = null) {
  if (bytes.length >= 24 &&
      bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return {
      mimeType: "image/png",
      width: bytes.readUInt32BE(16),
      height: bytes.readUInt32BE(20)
    };
  }

  if (bytes.length >= 12 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 3 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      while (bytes[offset] === 0xff) offset += 1;
      const marker = bytes[offset++];
      if (marker === 0xd8 || marker === 0xd9) continue;
      if (offset + 1 >= bytes.length) break;
      const segmentLength = bytes.readUInt16BE(offset);
      const sof = (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf);
      if (sof && offset + 6 < bytes.length) {
        return {
          mimeType: "image/jpeg",
          width: bytes.readUInt16BE(offset + 5),
          height: bytes.readUInt16BE(offset + 3)
        };
      }
      if (segmentLength < 2) break;
      offset += segmentLength;
    }
  }

  if (bytes.length >= 30 && bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
      bytes.subarray(8, 12).toString("ascii") === "WEBP") {
    const kind = bytes.subarray(12, 16).toString("ascii");
    if (kind === "VP8X") {
      return {
        mimeType: "image/webp",
        width: 1 + readUint24LE(bytes, 24),
        height: 1 + readUint24LE(bytes, 27)
      };
    }
  }

  const ktx2Signature = Buffer.from([0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (bytes.length >= 28 && bytes.subarray(0, 12).equals(ktx2Signature)) {
    return {
      mimeType: "image/ktx2",
      width: bytes.readUInt32LE(20),
      height: bytes.readUInt32LE(24)
    };
  }

  return { mimeType: declaredMimeType, width: null, height: null };
}

export function parseGlb(bytes) {
  assert(Buffer.isBuffer(bytes), "GLB input must be a Buffer");
  assert(bytes.length >= 20, "GLB is shorter than the minimum header and JSON chunk");
  assert(bytes.readUInt32LE(0) === GLB_MAGIC, "GLB magic is invalid");
  assert(bytes.readUInt32LE(4) === 2, "Only GLB version 2 is accepted");
  assert(bytes.readUInt32LE(8) === bytes.length, "GLB declared length does not match file size");

  const chunks = [];
  let offset = 12;
  while (offset < bytes.length) {
    assert(offset + 8 <= bytes.length, "GLB chunk header is truncated");
    const length = bytes.readUInt32LE(offset);
    const type = bytes.readUInt32LE(offset + 4);
    offset += 8;
    assert(offset + length <= bytes.length, "GLB chunk payload is truncated");
    chunks.push({ type, bytes: bytes.subarray(offset, offset + length) });
    offset += length;
  }
  assert(offset === bytes.length, "GLB chunks do not consume the declared length");
  assert(chunks[0]?.type === JSON_CHUNK, "The first GLB chunk must be JSON");

  const jsonText = chunks[0].bytes.toString("utf8").replace(/[\u0000\u0020]+$/u, "");
  const document = JSON.parse(jsonText);
  const bin = chunks.find((chunk) => chunk.type === BIN_CHUNK)?.bytes ?? Buffer.alloc(0);
  return { document, bin, chunks };
}

function primitiveElementCount(document, primitive) {
  const accessorIndex = primitive.indices ?? primitive.attributes?.POSITION;
  const accessor = document.accessors?.[accessorIndex];
  return accessor?.count ?? 0;
}

function primitiveTriangleCount(document, primitive) {
  const count = primitiveElementCount(document, primitive);
  const mode = primitive.mode ?? TRIANGLES;
  if (mode === TRIANGLES) return Math.floor(count / 3);
  if (mode === TRIANGLE_STRIP || mode === TRIANGLE_FAN) return Math.max(0, count - 2);
  return 0;
}

function dataUriBytes(uri) {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/su.exec(uri);
  if (!match) return null;
  return match[2]
    ? Buffer.from(match[3], "base64")
    : Buffer.from(decodeURIComponent(match[3]), "utf8");
}

function imageBytes(document, bin, image) {
  if (image.bufferView !== undefined) {
    const view = document.bufferViews?.[image.bufferView];
    if (!view || (view.buffer ?? 0) !== 0) return null;
    const start = view.byteOffset ?? 0;
    return bin.subarray(start, start + view.byteLength);
  }
  if (typeof image.uri === "string" && image.uri.startsWith("data:")) {
    return dataUriBytes(image.uri);
  }
  return null;
}

export function measureGlb(bytes) {
  const { document, bin } = parseGlb(bytes);
  const primitives = (document.meshes ?? []).flatMap((mesh, meshIndex) =>
    (mesh.primitives ?? []).map((primitive, primitiveIndex) => ({ meshIndex, primitiveIndex, primitive })));
  const triangles = primitives.reduce((sum, entry) => sum + primitiveTriangleCount(document, entry.primitive), 0);
  const primitiveVertices = primitives.reduce((sum, entry) => {
    const accessorIndex = entry.primitive.attributes?.POSITION;
    return sum + (document.accessors?.[accessorIndex]?.count ?? 0);
  }, 0);

  const externalResources = [];
  for (const buffer of document.buffers ?? []) {
    if (buffer.uri && !buffer.uri.startsWith("data:")) externalResources.push(buffer.uri);
  }
  const images = (document.images ?? []).map((image, index) => {
    if (image.uri && !image.uri.startsWith("data:")) externalResources.push(image.uri);
    const payload = imageBytes(document, bin, image);
    const dimensions = payload
      ? parseImageDimensions(payload, image.mimeType ?? null)
      : { mimeType: image.mimeType ?? null, width: null, height: null };
    return {
      index,
      name: image.name ?? null,
      mimeType: dimensions.mimeType,
      width: dimensions.width,
      height: dimensions.height,
      embedded: Boolean(payload),
      byteLength: payload?.length ?? null
    };
  });

  const materialChannels = { baseColor: false, normal: false, metallicRoughness: false, occlusion: false, emissive: false };
  for (const material of document.materials ?? []) {
    if (material.pbrMetallicRoughness?.baseColorTexture) materialChannels.baseColor = true;
    if (material.normalTexture) materialChannels.normal = true;
    if (material.pbrMetallicRoughness?.metallicRoughnessTexture) materialChannels.metallicRoughness = true;
    if (material.occlusionTexture) materialChannels.occlusion = true;
    if (material.emissiveTexture) materialChannels.emissive = true;
  }

  const skinJointIndices = new Set();
  let skinsMissingInverseBindMatrices = 0;
  for (const skin of document.skins ?? []) {
    for (const joint of skin.joints ?? []) skinJointIndices.add(joint);
    if (skin.inverseBindMatrices === undefined) skinsMissingInverseBindMatrices += 1;
  }
  const jointNames = [...skinJointIndices].map((index) => document.nodes?.[index]?.name ?? null);

  return {
    format: "glb",
    version: document.asset?.version ?? null,
    generator: document.asset?.generator ?? null,
    sha256: sha256(bytes),
    fileSizeBytes: bytes.length,
    scenes: document.scenes?.length ?? 0,
    nodes: document.nodes?.length ?? 0,
    meshes: document.meshes?.length ?? 0,
    primitives: primitives.length,
    triangles,
    primitiveVertices,
    materials: document.materials?.length ?? 0,
    textures: document.textures?.length ?? 0,
    images,
    materialChannels,
    animations: {
      count: document.animations?.length ?? 0,
      names: (document.animations ?? []).map((animation) => animation.name ?? null),
      channels: (document.animations ?? []).reduce((sum, animation) => sum + (animation.channels?.length ?? 0), 0),
      samplers: (document.animations ?? []).reduce((sum, animation) => sum + (animation.samplers?.length ?? 0), 0)
    },
    rig: {
      skins: document.skins?.length ?? 0,
      uniqueJoints: skinJointIndices.size,
      namedJoints: jointNames.filter(Boolean).length,
      unnamedJoints: jointNames.filter((name) => !name).length,
      skinnedNodes: (document.nodes ?? []).filter((node) => node.skin !== undefined).length,
      skinsMissingInverseBindMatrices
    },
    externalResources: [...new Set(externalResources)].sort(),
    extensionsUsed: [...(document.extensionsUsed ?? [])].sort(),
    extensionsRequired: [...(document.extensionsRequired ?? [])].sort()
  };
}

function makeCheck(id, actual, requirement, passed) {
  return { id, actual, requirement, passed: Boolean(passed) };
}

export function evaluatePolicy(metrics, validation, transform, policy) {
  const largestDimensions = metrics.images
    .filter((image) => Number.isInteger(image.width) && Number.isInteger(image.height))
    .map((image) => Math.max(image.width, image.height));
  const largestTextureDimension = largestDimensions.length ? Math.max(...largestDimensions) : null;
  const checks = [
    makeCheck("format", metrics.format, "glb", metrics.format === policy.format),
    makeCheck("file-size", metrics.fileSizeBytes, `<=${policy.maxFileSizeBytes}`, metrics.fileSizeBytes <= policy.maxFileSizeBytes),
    makeCheck("triangles", metrics.triangles, `${policy.triangles.min}..${policy.triangles.max}`, metrics.triangles >= policy.triangles.min && metrics.triangles <= policy.triangles.max),
    makeCheck("materials", metrics.materials, `${policy.materials.min}..${policy.materials.max}`, metrics.materials >= policy.materials.min && metrics.materials <= policy.materials.max),
    makeCheck("image-count", metrics.images.length, `${policy.textures.minImages}..${policy.textures.maxImages}`, metrics.images.length >= policy.textures.minImages && metrics.images.length <= policy.textures.maxImages),
    makeCheck("texture-dimensions-known", metrics.images.map(({ width, height }) => ({ width, height })), "all embedded image dimensions known", metrics.images.length > 0 && metrics.images.every((image) => Number.isInteger(image.width) && Number.isInteger(image.height))),
    makeCheck("largest-texture-dimension", largestTextureDimension, `${policy.textures.minLargestDimension}..${policy.textures.maxLargestDimension}`, largestTextureDimension !== null && largestTextureDimension >= policy.textures.minLargestDimension && largestTextureDimension <= policy.textures.maxLargestDimension),
    makeCheck("external-resources", metrics.externalResources, "none", policy.textures.externalResourcesAllowed || metrics.externalResources.length === 0),
    makeCheck("material-channels", metrics.materialChannels, policy.textures.requiredMaterialChannels.join(","), policy.textures.requiredMaterialChannels.every((channel) => metrics.materialChannels[channel] === true)),
    makeCheck("skins", metrics.rig.skins, `>=${policy.rig.minSkins}`, !policy.rig.required || metrics.rig.skins >= policy.rig.minSkins),
    makeCheck("unique-joints", metrics.rig.uniqueJoints, `>=${policy.rig.minUniqueJoints}`, !policy.rig.required || metrics.rig.uniqueJoints >= policy.rig.minUniqueJoints),
    makeCheck("skinned-nodes", metrics.rig.skinnedNodes, `>=${policy.rig.minSkinnedNodes}`, !policy.rig.required || metrics.rig.skinnedNodes >= policy.rig.minSkinnedNodes),
    makeCheck("inverse-bind-matrices", metrics.rig.skinsMissingInverseBindMatrices, "0", !policy.rig.inverseBindMatricesRequired || metrics.rig.skinsMissingInverseBindMatrices === 0),
    makeCheck("animation-clips", metrics.animations.count, `>=${policy.animations.minClips}`, metrics.animations.count >= policy.animations.minClips),
    makeCheck("validator-version", validation.version, policy.validation.gltfValidatorVersion, validation.version === policy.validation.gltfValidatorVersion),
    makeCheck("validator-errors", validation.errors, `<=${policy.validation.maxErrors}`, validation.errors <= policy.validation.maxErrors),
    makeCheck("validator-warnings", validation.warnings, `<=${policy.validation.maxWarnings}`, validation.warnings <= policy.validation.maxWarnings),
    makeCheck("gltf-transform-version", transform.version, policy.validation.gltfTransformVersion, transform.version === policy.validation.gltfTransformVersion),
    makeCheck("gltf-transform-validate", transform.validateExitCode, "0", transform.validateExitCode === 0),
    makeCheck("gltf-transform-inspect", transform.inspectExitCode, "0", transform.inspectExitCode === 0)
  ];
  return { checks, passed: checks.every((check) => check.passed) };
}

async function runGltfTransform(bytes) {
  const directory = path.dirname(fileURLToPath(import.meta.url));
  const executable = path.resolve(directory, "../node_modules/.bin/gltf-transform");
  const snapshotDirectory = await mkdtemp(path.join(os.tmpdir(), "p30-r012-gltf-transform-"));
  const snapshotPath = path.join(snapshotDirectory, "authorized-artifact.glb");
  await writeFile(snapshotPath, bytes, { flag: "wx" });
  const normalize = (value) => (value ?? "").replaceAll(snapshotPath, "authorized-artifact.glb").replaceAll(snapshotDirectory, "<temporary-directory>");
  try {
    const version = spawnSync(executable, ["--version"], { encoding: "utf8" });
    const validate = spawnSync(executable, ["validate", snapshotPath, "--format", "csv"], { encoding: "utf8" });
    const inspect = spawnSync(executable, ["inspect", snapshotPath, "--format", "md"], { encoding: "utf8" });
    const validateStdout = normalize(validate.stdout);
    const inspectStdout = normalize(inspect.stdout);
    return {
      version: version.status === 0 ? version.stdout.trim() : null,
      validateExitCode: validate.status,
      validateOutputSha256: sha256(Buffer.from(validateStdout)),
      validateStderr: normalize(validate.stderr).trim() || null,
      inspectExitCode: inspect.status,
      inspectOutputSha256: sha256(Buffer.from(inspectStdout)),
      inspectStderr: normalize(inspect.stderr).trim() || null
    };
  } finally {
    await rm(snapshotDirectory, { recursive: true, force: true });
  }
}

export async function inspectArtifact(assetPath, policy, options = {}) {
  const bytes = await readFile(assetPath);
  const directory = path.dirname(fileURLToPath(import.meta.url));
  const policyDirectory = options.policyDirectory ?? path.resolve(directory, "..");
  const authorization = await verifyArtifactAuthorization({
    artifactBytes: bytes,
    policy,
    policyDirectory
  });
  if (!authorization.passed) {
    return {
      schema: "p30.r012.glb-intake-report.v2",
      fileName: path.basename(assetPath),
      decision: "reject",
      stage: "authorization",
      authorization,
      metrics: null,
      validation: null,
      gltfTransform: null,
      evaluation: {
        status: "not-run",
        reason: "Technical evaluation is forbidden until exact authorized artifact bytes are bound.",
        passed: false,
        checks: []
      }
    };
  }

  const metrics = measureGlb(bytes);
  const report = await gltfValidator.validateBytes(new Uint8Array(bytes), {
    uri: path.basename(assetPath),
    format: "glb",
    maxIssues: 0,
    writeTimestamp: false
  });
  const validation = {
    version: gltfValidator.version(),
    errors: report.issues.numErrors,
    warnings: report.issues.numWarnings,
    infos: report.issues.numInfos,
    hints: report.issues.numHints,
    messages: report.issues.messages
  };
  const transform = await runGltfTransform(bytes);
  const technicalEvaluation = evaluatePolicy(metrics, validation, transform, policy);
  const evaluation = { status: "evaluated", ...technicalEvaluation };
  return {
    schema: "p30.r012.glb-intake-report.v2",
    fileName: path.basename(assetPath),
    stage: "technical",
    authorization,
    decision: evaluation.passed ? "admit" : "reject",
    metrics,
    validation,
    gltfTransform: transform,
    evaluation
  };
}

async function main() {
  const assetPath = process.argv[2];
  if (!assetPath || assetPath === "--help" || assetPath === "-h") {
    process.stdout.write("Usage: npm run gate -- /absolute/path/to/candidate.glb\n");
    process.exitCode = assetPath ? 0 : 64;
    return;
  }
  const directory = path.dirname(fileURLToPath(import.meta.url));
  const policy = JSON.parse(await readFile(path.resolve(directory, "../INTAKE_POLICY.json"), "utf8"));
  const report = await inspectArtifact(path.resolve(assetPath), policy, {
    policyDirectory: path.resolve(directory, "..")
  });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = report.decision === "admit" ? 0 : 2;
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.stack ?? error}\n`);
    process.exitCode = 2;
  });
}
