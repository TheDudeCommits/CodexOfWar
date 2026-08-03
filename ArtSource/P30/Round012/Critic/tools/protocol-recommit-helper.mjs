#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

import {
  BLADE_LENGTH_MAX_METRES,
  BLADE_LENGTH_MIN_METRES,
  BLADE_RADIAL_MAX_METRES,
  FROZEN_BASELINE_BLADE_ASSET_SHA256,
  PROTOCOL_ID,
  extractBladeCapsule,
  quantizeMicrometres
} from './evaluator-helper.mjs';
import { canonicalBytes, fileSha256, readCanonicalFile, sha256Hex } from './tree-helper.mjs';

export const FROZEN_BLADE_ASSET_PATH = 'web-game/public/assets/models/ashwake/stormcage.glb';
export const FROZEN_BLADE_ASSET_BYTES = 151264;
export const FROZEN_BLADE_UNIFORM_SCALE = 1.22;
export const FROZEN_BLADE_NODE_NAME = 'Dawnbreak_Blade';
export const FROZEN_BLADE_MESH_NAME = 'Dawnbreak_Blade_Mesh';
export const FROZEN_BLADE_MATERIAL_NAME = 'Dawnbreak_Steel';
export const PROTOCOL_RECOMMITMENT_HELPER_PATH = 'ArtSource/P30/Round012/Critic/tools/protocol-recommit-helper.mjs';

const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;
const TRIANGLES = 4;

export class ProtocolRecommitError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ProtocolRecommitError';
    this.code = code;
  }
}

function recommitFail(code) {
  throw new ProtocolRecommitError(code);
}

function assertSafeIndex(value, length, code) {
  if (!Number.isSafeInteger(value) || value < 0 || value >= length) recommitFail(code);
  return value;
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function parseFrozenBladeGlb(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 28) recommitFail('FROZEN_BLADE_GLB_INVALID');
  if (
    bytes.readUInt32LE(0) !== GLB_MAGIC || bytes.readUInt32LE(4) !== 2 ||
    bytes.readUInt32LE(8) !== bytes.length
  ) recommitFail('FROZEN_BLADE_GLB_INVALID');
  const chunks = [];
  let cursor = 12;
  while (cursor < bytes.length) {
    if (cursor + 8 > bytes.length) recommitFail('FROZEN_BLADE_GLB_INVALID');
    const length = bytes.readUInt32LE(cursor);
    const type = bytes.readUInt32LE(cursor + 4);
    cursor += 8;
    if (cursor + length > bytes.length) recommitFail('FROZEN_BLADE_GLB_INVALID');
    chunks.push({ type, bytes: bytes.subarray(cursor, cursor + length) });
    cursor += length;
  }
  if (
    cursor !== bytes.length || chunks.length !== 2 || chunks[0].type !== JSON_CHUNK ||
    chunks[1].type !== BIN_CHUNK
  ) recommitFail('FROZEN_BLADE_GLB_CHUNKS_INVALID');
  let document;
  try {
    const source = chunks[0].bytes.toString('utf8').replace(/[\u0000\u0020]+$/u, '');
    document = JSON.parse(source);
  } catch {
    recommitFail('FROZEN_BLADE_GLB_JSON_INVALID');
  }
  if (document?.asset?.version !== '2.0') recommitFail('FROZEN_BLADE_GLB_JSON_INVALID');
  if (!Array.isArray(document.buffers) || document.buffers.length !== 1) {
    recommitFail('FROZEN_BLADE_EXTERNAL_OR_MULTIPLE_BUFFER_INVALID');
  }
  if (document.buffers[0].uri !== undefined || document.buffers[0].byteLength !== chunks[1].bytes.length) {
    recommitFail('FROZEN_BLADE_BUFFER_BINDING_INVALID');
  }
  return { document, bin: chunks[1].bytes };
}

function accessorLayout(document, accessorIndex, expected) {
  const accessor = document.accessors?.[assertSafeIndex(
    accessorIndex,
    document.accessors?.length ?? 0,
    'FROZEN_BLADE_ACCESSOR_INVALID'
  )];
  const view = document.bufferViews?.[assertSafeIndex(
    accessor?.bufferView,
    document.bufferViews?.length ?? 0,
    'FROZEN_BLADE_ACCESSOR_INVALID'
  )];
  if (
    accessor.sparse !== undefined || accessor.normalized === true || view.buffer !== 0 ||
    accessor.componentType !== expected.componentType || accessor.type !== expected.type ||
    !Number.isSafeInteger(accessor.count) || accessor.count <= 0
  ) recommitFail('FROZEN_BLADE_ACCESSOR_INVALID');
  const elementBytes = expected.components * expected.componentBytes;
  const stride = view.byteStride ?? elementBytes;
  const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const finalByte = start + (accessor.count - 1) * stride + elementBytes;
  if (
    !Number.isSafeInteger(start) || start < 0 || !Number.isSafeInteger(stride) || stride < elementBytes ||
    finalByte > (view.byteOffset ?? 0) + view.byteLength
  ) recommitFail('FROZEN_BLADE_ACCESSOR_RANGE_INVALID');
  return { accessor, view, start, stride, elementBytes };
}

function decodePositions(document, bin, accessorIndex) {
  const layout = accessorLayout(document, accessorIndex, {
    componentType: 5126,
    type: 'VEC3',
    components: 3,
    componentBytes: 4
  });
  const positions = [];
  const coordinateKeys = [];
  for (let index = 0; index < layout.accessor.count; index += 1) {
    const offset = layout.start + index * layout.stride;
    const position = [0, 1, 2].map((component) => bin.readFloatLE(offset + component * 4));
    if (position.some((value) => !Number.isFinite(value))) recommitFail('FROZEN_BLADE_POSITION_NONFINITE');
    positions.push(position);
    coordinateKeys.push(bin.subarray(offset, offset + 12).toString('hex'));
  }
  return { positions, coordinateKeys, accessor: layout.accessor };
}

function decodeIndices(document, bin, accessorIndex) {
  const layout = accessorLayout(document, accessorIndex, {
    componentType: 5123,
    type: 'SCALAR',
    components: 1,
    componentBytes: 2
  });
  const indices = Array.from({ length: layout.accessor.count }, (_, index) =>
    bin.readUInt16LE(layout.start + index * layout.stride)
  );
  return { indices, accessor: layout.accessor };
}

export function triangleComponentSizes(indices, coordinateKeys) {
  if (
    !Array.isArray(indices) || indices.length === 0 || indices.length % 3 !== 0 ||
    !Array.isArray(coordinateKeys) || coordinateKeys.length === 0
  ) recommitFail('FROZEN_BLADE_CONNECTIVITY_INPUT_INVALID');
  const weldedSiteByKey = new Map();
  const vertexToSite = coordinateKeys.map((key) => {
    if (typeof key !== 'string' || !key) recommitFail('FROZEN_BLADE_CONNECTIVITY_INPUT_INVALID');
    if (!weldedSiteByKey.has(key)) weldedSiteByKey.set(key, weldedSiteByKey.size);
    return weldedSiteByKey.get(key);
  });
  const triangleSites = Array.from({ length: indices.length / 3 }, (_, triangleIndex) =>
    indices.slice(triangleIndex * 3, triangleIndex * 3 + 3).map((vertexIndex) => {
      assertSafeIndex(vertexIndex, vertexToSite.length, 'FROZEN_BLADE_INDEX_OUT_OF_RANGE');
      return vertexToSite[vertexIndex];
    })
  );
  const ownersBySite = new Map();
  triangleSites.forEach((sites, triangleIndex) => sites.forEach((site) => {
    const owners = ownersBySite.get(site) ?? [];
    owners.push(triangleIndex);
    ownersBySite.set(site, owners);
  }));
  const adjacency = Array.from({ length: triangleSites.length }, () => new Set());
  for (const owners of ownersBySite.values()) {
    for (const left of owners) for (const right of owners) if (left !== right) adjacency[left].add(right);
  }
  const seen = new Set();
  const componentSizes = [];
  for (let start = 0; start < triangleSites.length; start += 1) {
    if (seen.has(start)) continue;
    const stack = [start];
    seen.add(start);
    let size = 0;
    while (stack.length > 0) {
      const triangle = stack.pop();
      size += 1;
      for (const neighbor of adjacency[triangle]) {
        if (!seen.has(neighbor)) {
          seen.add(neighbor);
          stack.push(neighbor);
        }
      }
    }
    componentSizes.push(size);
  }
  componentSizes.sort((left, right) => right - left);
  return { componentSizes, uniqueCoordinateSites: weldedSiteByKey.size };
}

export function requireSingleConnectedTriangleComponent(indices, coordinateKeys) {
  const result = triangleComponentSizes(indices, coordinateKeys);
  if (result.componentSizes.length !== 1) recommitFail('FROZEN_BLADE_DISCONNECTED_GEOMETRY');
  return result;
}

function selectFrozenBladePrimitive(document) {
  const nodes = (document.nodes ?? []).filter((node) => node?.name === FROZEN_BLADE_NODE_NAME);
  if (nodes.length !== 1) recommitFail('FROZEN_BLADE_NODE_SELECTION_INVALID');
  const node = nodes[0];
  if (node.skin !== undefined || node.matrix !== undefined || node.scale !== undefined || node.rotation !== undefined || node.translation !== undefined) {
    recommitFail('FROZEN_BLADE_NODE_TRANSFORM_INVALID');
  }
  const mesh = document.meshes?.[assertSafeIndex(
    node.mesh,
    document.meshes?.length ?? 0,
    'FROZEN_BLADE_MESH_SELECTION_INVALID'
  )];
  if (mesh?.name !== FROZEN_BLADE_MESH_NAME) recommitFail('FROZEN_BLADE_MESH_SELECTION_INVALID');
  if (!Array.isArray(mesh.primitives) || mesh.primitives.length !== 1) {
    recommitFail('FROZEN_BLADE_PRIMITIVE_COUNT_INVALID');
  }
  const primitive = mesh.primitives[0];
  if (
    (primitive.mode ?? TRIANGLES) !== TRIANGLES || primitive.indices === undefined ||
    primitive.attributes?.POSITION === undefined || primitive.targets !== undefined
  ) recommitFail('FROZEN_BLADE_PRIMITIVE_INVALID');
  const material = document.materials?.[assertSafeIndex(
    primitive.material,
    document.materials?.length ?? 0,
    'FROZEN_BLADE_MATERIAL_INVALID'
  )];
  const alpha = material?.pbrMetallicRoughness?.baseColorFactor?.[3] ?? 1;
  if (
    material?.name !== FROZEN_BLADE_MATERIAL_NAME ||
    ![undefined, 'OPAQUE'].includes(material.alphaMode) || alpha !== 1 ||
    material.doubleSided !== true
  ) recommitFail('FROZEN_BLADE_MATERIAL_INVALID');
  return { node, mesh, primitive, material };
}

export function measureFrozenBladeDocument(parsed, { frozenUniformScale = FROZEN_BLADE_UNIFORM_SCALE } = {}) {
  if (frozenUniformScale !== FROZEN_BLADE_UNIFORM_SCALE) recommitFail('FROZEN_BLADE_SCALE_MISMATCH');
  const { document, bin } = parsed ?? {};
  if (!document || !Buffer.isBuffer(bin)) recommitFail('FROZEN_BLADE_GLB_INVALID');
  const { primitive, material } = selectFrozenBladePrimitive(document);
  const decodedPositions = decodePositions(document, bin, primitive.attributes.POSITION);
  const decodedIndices = decodeIndices(document, bin, primitive.indices);
  if (decodedPositions.accessor.count !== 364 || decodedIndices.accessor.count !== 456) {
    recommitFail('FROZEN_BLADE_FROZEN_COUNTS_MISMATCH');
  }
  const uniqueIndices = [...new Set(decodedIndices.indices)].sort((left, right) => left - right);
  if (uniqueIndices.length !== 364) recommitFail('FROZEN_BLADE_UNREFERENCED_OR_DUPLICATE_VERTEX_SET');
  uniqueIndices.forEach((index, expected) => {
    if (index !== expected) recommitFail('FROZEN_BLADE_UNREFERENCED_OR_DUPLICATE_VERTEX_SET');
  });
  const connectivity = requireSingleConnectedTriangleComponent(
    decodedIndices.indices,
    decodedPositions.coordinateKeys
  );
  const worldVertices = uniqueIndices.map((index) =>
    decodedPositions.positions[index].map((component) => component * frozenUniformScale)
  );
  const blade = extractBladeCapsule(worldVertices, [0, 0, 0]);
  return {
    frozenUniformScale: frozenUniformScale.toFixed(6),
    nodeName: FROZEN_BLADE_NODE_NAME,
    meshName: FROZEN_BLADE_MESH_NAME,
    materialName: material.name,
    materialAlphaMode: material.alphaMode ?? 'OPAQUE-default',
    materialDoubleSided: material.doubleSided,
    primitiveMode: 'TRIANGLES',
    positionAccessorVertices: decodedPositions.accessor.count,
    uniqueReferencedVertices: uniqueIndices.length,
    uniqueCoordinateSitesForConnectivityOnly: connectivity.uniqueCoordinateSites,
    indexCount: decodedIndices.accessor.count,
    triangleCount: decodedIndices.accessor.count / 3,
    primitiveCount: 1,
    materialPartitionCount: 1,
    geometricTriangleComponentCount: connectivity.componentSizes.length,
    geometricTriangleComponentSizes: connectivity.componentSizes,
    eigenvalueRatio: blade.eigenvalueRatio,
    guardTipLengthMetres: String(blade.lengthMetres),
    guardTipLengthMicrometres: quantizeMicrometres(blade.lengthMetres),
    maximumRadialDistanceMetres: String(blade.maximumRadialDistance),
    maximumRadialDistanceMicrometres: quantizeMicrometres(blade.maximumRadialDistance),
    legacyLengthPasses: blade.lengthMetres <= 1.800000,
    legacyRadialPasses: blade.maximumRadialDistance <= 0.140000,
    recommittedLengthPasses:
      blade.lengthMetres >= BLADE_LENGTH_MIN_METRES && blade.lengthMetres <= BLADE_LENGTH_MAX_METRES,
    recommittedRadialPasses: blade.maximumRadialDistance <= BLADE_RADIAL_MAX_METRES,
    honestDisconnectedBladeHiltPartitionExists: connectivity.componentSizes.length !== 1
  };
}

export function measureFrozenBladeGlb(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length !== FROZEN_BLADE_ASSET_BYTES) {
    recommitFail('FROZEN_BLADE_ASSET_BYTES_MISMATCH');
  }
  const digest = sha256(bytes);
  if (digest !== FROZEN_BASELINE_BLADE_ASSET_SHA256) recommitFail('FROZEN_BLADE_ASSET_HASH_MISMATCH');
  return {
    assetBytes: bytes.length,
    assetSha256: digest,
    ...measureFrozenBladeDocument(parseFrozenBladeGlb(bytes))
  };
}

function assertReceiptMeasurement(receipt, measurement, verifierSha256) {
  if (
    receipt?.schema !== 'p30.r012a.protocol-recommitment-receipt.v1' ||
    receipt.protocolID !== PROTOCOL_ID ||
    receipt.accessState?.criticCandidateAccess !== false ||
    receipt.accessState?.candidatePackagesAccessed !== false ||
    receipt.accessState?.candidateSourcesAccessed !== false ||
    receipt.accessState?.privateCustodyAccessed !== false ||
    receipt.accessState?.referenceArchiveAccessed !== false ||
    receipt.baselineBlade?.assetPath !== FROZEN_BLADE_ASSET_PATH ||
    receipt.baselineBlade?.assetBytes !== measurement.assetBytes ||
    receipt.baselineBlade?.assetSha256 !== measurement.assetSha256 ||
    receipt.baselineBlade?.frozenUniformScale !== measurement.frozenUniformScale ||
    receipt.baselineBlade?.nodeName !== measurement.nodeName ||
    receipt.baselineBlade?.meshName !== measurement.meshName ||
    receipt.baselineBlade?.materialName !== measurement.materialName ||
    receipt.baselineBlade?.materialAlphaMode !== measurement.materialAlphaMode ||
    receipt.baselineBlade?.materialDoubleSided !== measurement.materialDoubleSided ||
    receipt.baselineBlade?.primitiveMode !== measurement.primitiveMode ||
    receipt.baselineBlade?.measurementVerifierPath !== PROTOCOL_RECOMMITMENT_HELPER_PATH ||
    receipt.baselineBlade?.measurementVerifierSha256 !== verifierSha256
  ) recommitFail('RECOMMITMENT_RECEIPT_MEASUREMENT_BINDING_MISMATCH');
  const expectedResults = {
    eigenvalueRatio: measurement.eigenvalueRatio,
    geometricTriangleComponentCount: measurement.geometricTriangleComponentCount,
    geometricTriangleComponentSizes: measurement.geometricTriangleComponentSizes,
    guardTipLengthMetres: measurement.guardTipLengthMetres,
    guardTipLengthMicrometres: measurement.guardTipLengthMicrometres,
    honestDisconnectedBladeHiltPartitionExists: measurement.honestDisconnectedBladeHiltPartitionExists,
    indexCount: measurement.indexCount,
    materialPartitionCount: measurement.materialPartitionCount,
    maximumRadialDistanceMetres: measurement.maximumRadialDistanceMetres,
    maximumRadialDistanceMicrometres: measurement.maximumRadialDistanceMicrometres,
    positionAccessorVertices: measurement.positionAccessorVertices,
    primitiveCount: measurement.primitiveCount,
    triangleCount: measurement.triangleCount,
    uniqueCoordinateSitesForConnectivityOnly: measurement.uniqueCoordinateSitesForConnectivityOnly,
    uniqueReferencedVertices: measurement.uniqueReferencedVertices
  };
  if (canonicalBytes(receipt.baselineBlade.results).compare(canonicalBytes(expectedResults)) !== 0) {
    recommitFail('RECOMMITMENT_RECEIPT_MEASUREMENT_RESULT_MISMATCH');
  }
  if (
    receipt.baselineBlade.legacyBounds?.lengthPasses !== measurement.legacyLengthPasses ||
    receipt.baselineBlade.legacyBounds?.radialPasses !== measurement.legacyRadialPasses ||
    receipt.baselineBlade.recommittedBounds?.maximumLengthMetres !== BLADE_LENGTH_MAX_METRES.toFixed(6) ||
    receipt.baselineBlade.recommittedBounds?.maximumRadialDistanceMetres !== BLADE_RADIAL_MAX_METRES.toFixed(6) ||
    receipt.baselineBlade.recommittedBounds?.oversizedGeometryStillFails !== true ||
    receipt.baselineBlade.recommittedBounds?.hiltInclusiveGeometryStillFails !== true
  ) recommitFail('RECOMMITMENT_RECEIPT_BOUND_RESULT_MISMATCH');
}

export async function verifyProtocolRecommitmentFiles(repositoryRoot, receiptPath) {
  const root = resolve(repositoryRoot);
  const expectedReceiptPath = resolve(root, 'ArtSource/P30/Round012/Critic/PROTOCOL_RECOMMITMENT_RECEIPT.json');
  if (resolve(receiptPath) !== expectedReceiptPath) recommitFail('RECOMMITMENT_RECEIPT_PATH_MISMATCH');
  const [receiptRecord, assetBytes, verifier] = await Promise.all([
    readCanonicalFile(expectedReceiptPath),
    readFile(resolve(root, FROZEN_BLADE_ASSET_PATH)),
    fileSha256(fileURLToPath(import.meta.url))
  ]);
  const measurement = measureFrozenBladeGlb(assetBytes);
  assertReceiptMeasurement(receiptRecord.value, measurement, verifier.sha256);
  return {
    schema: 'p30.r012a.protocol-recommitment-verification.v1',
    protocolID: PROTOCOL_ID,
    receiptSha256: sha256Hex(receiptRecord.bytes),
    measurementVerifierSha256: verifier.sha256,
    assetSha256: measurement.assetSha256,
    uniqueReferencedVertices: measurement.uniqueReferencedVertices,
    triangleCount: measurement.triangleCount,
    geometricTriangleComponentCount: measurement.geometricTriangleComponentCount,
    guardTipLengthMetres: measurement.guardTipLengthMetres,
    maximumRadialDistanceMetres: measurement.maximumRadialDistanceMetres,
    legacyBoundsReject: !measurement.legacyLengthPasses && !measurement.legacyRadialPasses,
    recommittedBoundsPass: measurement.recommittedLengthPasses && measurement.recommittedRadialPasses,
    criticCandidateAccess: false
  };
}

function usage() {
  return [
    'Usage:',
    '  protocol-recommit-helper.mjs measure FROZEN_BLADE_GLB',
    '  protocol-recommit-helper.mjs verify REPOSITORY_ROOT PROTOCOL_RECOMMITMENT_RECEIPT_JSON'
  ].join('\n');
}

export async function main(argv) {
  const [command, ...args] = argv;
  if (command === 'measure' && args.length === 1) {
    process.stdout.write(`${JSON.stringify(measureFrozenBladeGlb(await readFile(args[0])))}\n`);
    return;
  }
  if (command === 'verify' && args.length === 2) {
    process.stdout.write(`${JSON.stringify(await verifyProtocolRecommitmentFiles(args[0], args[1]))}\n`);
    return;
  }
  recommitFail(usage());
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath && fileURLToPath(import.meta.url) === invokedPath) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`P30_R012_RECOMMIT_ERROR:${error.code ?? 'UNEXPECTED'}\n`);
    process.exitCode = 1;
  });
}
