import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  FROZEN_BLADE_ASSET_PATH,
  FROZEN_BLADE_UNIFORM_SCALE,
  PROTOCOL_RECOMMITMENT_HELPER_PATH,
  ProtocolRecommitError,
  measureFrozenBladeDocument,
  measureFrozenBladeGlb,
  parseFrozenBladeGlb,
  requireSingleConnectedTriangleComponent,
  triangleComponentSizes,
  verifyProtocolRecommitmentFiles
} from './protocol-recommit-helper.mjs';
import { fileSha256, readCanonicalFile } from './tree-helper.mjs';

const repositoryRoot = resolve(import.meta.dirname, '../../../../..');
const assetPath = resolve(repositoryRoot, FROZEN_BLADE_ASSET_PATH);
const receiptPath = resolve(repositoryRoot, 'ArtSource/P30/Round012/Critic/PROTOCOL_RECOMMITMENT_RECEIPT.json');

function code(error, expected) {
  return error instanceof ProtocolRecommitError && error.code === expected;
}

test('checked-in verifier deterministically reproduces exact frozen Dawnbreak_Blade measurements', async () => {
  const bytes = await readFile(assetPath);
  const first = measureFrozenBladeGlb(bytes);
  const second = measureFrozenBladeGlb(Buffer.from(bytes));
  assert.deepEqual(first, second);
  assert.deepEqual(first, {
    assetBytes: 151264,
    assetSha256: '29565b76739e2d0f5491c55c5c382c7e172c7bc99d04a2382044f782170b7c1d',
    frozenUniformScale: '1.220000',
    nodeName: 'Dawnbreak_Blade',
    meshName: 'Dawnbreak_Blade_Mesh',
    materialName: 'Dawnbreak_Steel',
    materialAlphaMode: 'OPAQUE-default',
    materialDoubleSided: true,
    primitiveMode: 'TRIANGLES',
    positionAccessorVertices: 364,
    uniqueReferencedVertices: 364,
    uniqueCoordinateSitesForConnectivityOnly: 78,
    indexCount: 456,
    triangleCount: 152,
    primitiveCount: 1,
    materialPartitionCount: 1,
    geometricTriangleComponentCount: 1,
    geometricTriangleComponentSizes: [152],
    eigenvalueRatio: '54.84111846316194',
    guardTipLengthMetres: '1.8721468021573855',
    guardTipLengthMicrometres: 1872147,
    maximumRadialDistanceMetres: '0.18472375173652655',
    maximumRadialDistanceMicrometres: 184724,
    legacyLengthPasses: false,
    legacyRadialPasses: false,
    recommittedLengthPasses: true,
    recommittedRadialPasses: true,
    honestDisconnectedBladeHiltPartitionExists: false
  });
});

test('recommitment receipt binds the exact asset, live verifier bytes, and recomputed results', async () => {
  const verification = await verifyProtocolRecommitmentFiles(repositoryRoot, receiptPath);
  assert.deepEqual(verification, {
    schema: 'p30.r012a.protocol-recommitment-verification.v1',
    protocolID: 'P30-R012A-BLIND-v1',
    receiptSha256: 'b23a42e22f5b0a06fb96d21b0fbc9fb40efe06932e99eebb8e8c09e834df71ff',
    measurementVerifierSha256: 'ecaad4fa91b44bdc4c818503f9d36adf65050a62de095c362b111c1a6fcd41b3',
    assetSha256: '29565b76739e2d0f5491c55c5c382c7e172c7bc99d04a2382044f782170b7c1d',
    uniqueReferencedVertices: 364,
    triangleCount: 152,
    geometricTriangleComponentCount: 1,
    guardTipLengthMetres: '1.8721468021573855',
    maximumRadialDistanceMetres: '0.18472375173652655',
    legacyBoundsReject: true,
    recommittedBoundsPass: true,
    criticCandidateAccess: false
  });
  const receipt = (await readCanonicalFile(receiptPath)).value;
  const verifier = await fileSha256(resolve(repositoryRoot, PROTOCOL_RECOMMITMENT_HELPER_PATH));
  assert.equal(receipt.baselineBlade.measurementVerifierSha256, verifier.sha256);
});

test('asset corruption fails before geometry can influence the receipt', async () => {
  const corrupted = Buffer.from(await readFile(assetPath));
  corrupted[corrupted.length - 1] ^= 0x01;
  assert.throws(
    () => measureFrozenBladeGlb(corrupted),
    (error) => code(error, 'FROZEN_BLADE_ASSET_HASH_MISMATCH')
  );
});

test('node and primitive substitutions fail the independent selector', async () => {
  const parsed = parseFrozenBladeGlb(await readFile(assetPath));
  const wrongNode = { document: structuredClone(parsed.document), bin: parsed.bin };
  wrongNode.document.nodes.find((node) => node.name === 'Dawnbreak_Blade').name = 'Replacement_Blade';
  assert.throws(
    () => measureFrozenBladeDocument(wrongNode),
    (error) => code(error, 'FROZEN_BLADE_NODE_SELECTION_INVALID')
  );

  const extraPrimitive = { document: structuredClone(parsed.document), bin: parsed.bin };
  const mesh = extraPrimitive.document.meshes.find((entry) => entry.name === 'Dawnbreak_Blade_Mesh');
  mesh.primitives.push(structuredClone(mesh.primitives[0]));
  assert.throws(
    () => measureFrozenBladeDocument(extraPrimitive),
    (error) => code(error, 'FROZEN_BLADE_PRIMITIVE_COUNT_INVALID')
  );
});

test('only the frozen 1.22 production scale is admissible', async () => {
  const parsed = parseFrozenBladeGlb(await readFile(assetPath));
  assert.equal(FROZEN_BLADE_UNIFORM_SCALE, 1.22);
  assert.throws(
    () => measureFrozenBladeDocument(parsed, { frozenUniformScale: 1.21 }),
    (error) => code(error, 'FROZEN_BLADE_SCALE_MISMATCH')
  );
});

test('connectivity audit rejects an apparent single primitive split into disconnected islands', () => {
  const indices = [0, 1, 2, 3, 4, 5];
  const coordinateKeys = ['a', 'b', 'c', 'd', 'e', 'f'];
  assert.deepEqual(triangleComponentSizes(indices, coordinateKeys), {
    componentSizes: [1, 1],
    uniqueCoordinateSites: 6
  });
  assert.throws(
    () => requireSingleConnectedTriangleComponent(indices, coordinateKeys),
    (error) => code(error, 'FROZEN_BLADE_DISCONNECTED_GEOMETRY')
  );
});
