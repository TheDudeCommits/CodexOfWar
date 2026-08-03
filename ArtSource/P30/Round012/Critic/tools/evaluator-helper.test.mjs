import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';

import {
  BASELINE_RECEIPT_PATH,
  BASELINE_RECEIPT_SHA256,
  ALIAS_SCORE_COMMIT_DOMAIN,
  BLADE_LENGTH_MAX_METRES,
  BLADE_RADIAL_MAX_METRES,
  CANONICAL_TERMINAL_ABSOLUTE_TICK,
  COUNTERFACTUAL_COMMIT_DOMAIN,
  EVALUATOR_HELPER_PATH,
  EPS,
  PRESENTATION_COMMIT_DOMAIN,
  PACKAGE_MAP_COMMIT_DOMAIN,
  PROTOCOL_AMENDMENT_PATH,
  PROTOCOL_AMENDMENT_SHA256,
  PROTOCOL_AMENDMENT_02_PATH,
  PROTOCOL_AMENDMENT_02_SHA256,
  PROTOCOL_ID,
  PROTOCOL_PATH,
  PROTOCOL_PAYLOAD_SHA256,
  PROTOCOL_RECOMMITMENT_HELPER_PATH,
  PROTOCOL_RECOMMITMENT_HELPER_SHA256,
  PROTOCOL_RECOMMITMENT_RECEIPT_PATH,
  PROTOCOL_RECOMMITMENT_RECEIPT_SHA256,
  PRIOR_ROUND_COMMITMENT_SHA256,
  REFERENCE_ARCHIVE_SHA256,
  REFERENCE_COMMIT_DOMAIN,
  ROUND_COMMITMENT_SCHEMA,
  Round012EvaluatorError,
  SEALED_PUBLIC_ROOT_COMMIT,
  SHIFTED_HEAVY_RISING_EDGE_ABSOLUTE_TICK,
  SHIFTED_TERMINAL_ABSOLUTE_TICK,
  TREE_DOMAIN,
  TREE_HELPER_PATH,
  analyzeMaskTopology,
  aliasScoreCommit,
  buildBlindOrderManifest,
  buildTargetCapsules,
  bladeEndpointSilhouetteChecks,
  canonicalContactChecks,
  canonicalContactFrame,
  closestSegmentSegment,
  collectGeometrySource,
  composeAnonymousEqualBoard,
  computeMissOffsetExtrema,
  counterfactualCommit,
  createEvidenceCustodyProof,
  cropScaleRgbaLanczos3,
  decodeReferenceImagePixels,
  deriveActionCrop,
  deriveContactRoi,
  deriveExecutionOrder,
  deriveHitOffsetPairs,
  deriveHitOffsets,
  deriveMissOffsets,
  deriveTwoSideOrder,
  evaluateSweptContact,
  evidenceArtifactClaimPath,
  extractBladeCapsule,
  packageMapCommit,
  parseReferenceZip,
  presentationCommit,
  privateBoardClaimPath,
  rasterizeObjectMask,
  referenceCommit,
  referenceImageDimensions,
  roundHalfAwayFromZero,
  shiftedContactChecks,
  validateAliasOnlyScore,
  validateBallotTokens,
  validateBlindOrderManifest,
  validateCounterfactualRuns,
  validateEvidenceManifest,
  validatePackageMap,
  validatePublicPackageReceipt,
  validateReferenceSelection,
  validateRoundCommitment,
  verifyEvidenceManifestFiles,
  verifyReferenceSelectionFiles,
  verifyPackageMapReveal,
  topologyContinuityChecks,
  transformCommittedReferencePixels,
  visibleTopologyChecks
} from './evaluator-helper.mjs';

function evaluatorCode(error, expected) {
  return error instanceof Round012EvaluatorError && error.code === expected;
}

function selectionFixture() {
  return {
    schema: 'p30.r012a.reference-selection.v1',
    protocolID: PROTOCOL_ID,
    referenceArchiveSha256: REFERENCE_ARCHIVE_SHA256,
    selections: ['R1_ANTICIPATION', 'R2_CONTACT', 'R3_FOLLOW_THROUGH'].map((phaseID, index) => ({
      phaseID,
      sourceArchiveEntry: `Reference/f${index}.jpeg`,
      sourceFileSha256: String(index + 1).repeat(64),
      originalDimensions: { width: 100, height: 50 },
      cropRectangle: { x: 0, y: 0, width: 100, height: 50 },
      uniformScaleAlgorithm: 'lanczos3-uniform-fit-no-upscale-v1',
      phaseRationale: 'A sufficiently concrete private phase rationale for deterministic fixture validation.'
    }))
  };
}

function commitmentFixture() {
  return {
    schema: ROUND_COMMITMENT_SCHEMA,
    protocolID: PROTOCOL_ID,
    protocolPath: PROTOCOL_PATH,
    protocolPayloadSha256: PROTOCOL_PAYLOAD_SHA256,
    protocolAmendmentPath: PROTOCOL_AMENDMENT_PATH,
    protocolAmendmentSha256: PROTOCOL_AMENDMENT_SHA256,
    protocolAmendment02Path: PROTOCOL_AMENDMENT_02_PATH,
    protocolAmendment02Sha256: PROTOCOL_AMENDMENT_02_SHA256,
    protocolRecommitmentReceiptPath: PROTOCOL_RECOMMITMENT_RECEIPT_PATH,
    protocolRecommitmentReceiptSha256: PROTOCOL_RECOMMITMENT_RECEIPT_SHA256,
    protocolRecommitmentHelperPath: PROTOCOL_RECOMMITMENT_HELPER_PATH,
    protocolRecommitmentHelperSha256: PROTOCOL_RECOMMITMENT_HELPER_SHA256,
    priorRoundCommitmentSha256: PRIOR_ROUND_COMMITMENT_SHA256,
    sealedPublicRootCommit: SEALED_PUBLIC_ROOT_COMMIT,
    baselineReceiptPath: BASELINE_RECEIPT_PATH,
    baselineReceiptSha256: BASELINE_RECEIPT_SHA256,
    presentationCommitDomain: PRESENTATION_COMMIT_DOMAIN,
    presentationCommit: '1'.repeat(64),
    counterfactualCommitDomain: COUNTERFACTUAL_COMMIT_DOMAIN,
    counterfactualCommit: '2'.repeat(64),
    referenceArchiveSha256: REFERENCE_ARCHIVE_SHA256,
    referenceCommitDomain: REFERENCE_COMMIT_DOMAIN,
    referenceCommit: '3'.repeat(64),
    treeDomain: TREE_DOMAIN,
    treeHelperPath: TREE_HELPER_PATH,
    treeHelperSha256: '4'.repeat(64),
    evaluatorHelperPath: EVALUATOR_HELPER_PATH,
    evaluatorHelperSha256: '5'.repeat(64),
    criticCandidateAccess: false
  };
}

test('seed and salted-reference commitments have frozen reproducibility vectors', () => {
  const presentationSeed = Buffer.alloc(32, 0x11);
  const counterfactualSeed = Buffer.alloc(32, 0x22);
  const salt = Buffer.alloc(32, 0x33);
  assert.equal(presentationCommit(presentationSeed), '354ddb3bbfc45e3fea59971370649f05c6f75dae2953fee1fd4fd724d88c408f');
  assert.equal(counterfactualCommit(counterfactualSeed), '76848082f62be435d43f2c8c7b407bd434454ada62d6fd567f8307089ea6aca2');
  assert.equal(referenceCommit(selectionFixture(), salt), '0b119b0d2004226d8709b1ef00072649932e9d910f502887a30d86df99b3094f');
});

test('reference selection rejects phase ambiguity, crop tampering, and extra metadata', () => {
  assert.doesNotThrow(() => validateReferenceSelection(selectionFixture()));
  const reordered = selectionFixture();
  [reordered.selections[0], reordered.selections[1]] = [reordered.selections[1], reordered.selections[0]];
  assert.throws(
    () => validateReferenceSelection(reordered),
    (error) => evaluatorCode(error, 'REFERENCE_PHASE_ORDER_MISMATCH')
  );
  const crop = selectionFixture();
  crop.selections[0].cropRectangle.width = 101;
  assert.throws(
    () => validateReferenceSelection(crop),
    (error) => evaluatorCode(error, 'REFERENCE_CROP_OUT_OF_BOUNDS')
  );
  const hidden = selectionFixture();
  hidden.selections[0].uncommittedAlternative = 'forbidden';
  assert.throws(
    () => validateReferenceSelection(hidden),
    (error) => evaluatorCode(error, 'REFERENCE_SELECTION_ENTRY_SHAPE_MISMATCH')
  );
});

test('presentation ordering is invariant to input order and uses the frozen item domain', () => {
  const seed = Buffer.alloc(32, 0x11);
  const aliases = ['candidate-1111111111111111', 'candidate-eeeeeeeeeeeeeeee'];
  assert.deepEqual(deriveExecutionOrder(seed, aliases), deriveExecutionOrder(seed, [...aliases].reverse()));
  assert.deepEqual(deriveExecutionOrder(seed, aliases), [
    {
      alias: 'candidate-1111111111111111',
      orderDigest: '3f3aeeb4359e9007a66b7ea85c9b61986a2a29ca331df5102d6fc2ed18e73452'
    },
    {
      alias: 'candidate-eeeeeeeeeeeeeeee',
      orderDigest: 'b2b780510d969b3121eec805095d021e4daf9e98d2d53b83d30fcf6f3fd3b0db'
    }
  ]);
  assert.deepEqual(deriveTwoSideOrder(seed, 'P1', aliases), {
    itemID: 'P1',
    left: 'candidate-1111111111111111',
    right: 'candidate-eeeeeeeeeeeeeeee',
    orderDigest: 'ac4b412225372b5e21b8724d36f6cb73c3440e69b2da3f93610df43c31673c70'
  });
});

test('round commitment rejects missing/unknown fields, mutable access, and identity leakage', () => {
  const fixture = commitmentFixture();
  assert.doesNotThrow(() => validateRoundCommitment(fixture, `${JSON.stringify(fixture)}\n`));
  const missing = { ...fixture };
  delete missing.referenceCommit;
  assert.throws(
    () => validateRoundCommitment(missing),
    (error) => evaluatorCode(error, 'ROUND_COMMITMENT_SHAPE_MISMATCH')
  );
  assert.throws(
    () => validateRoundCommitment({ ...fixture, candidateIdentity: 'hidden' }),
    (error) => evaluatorCode(error, 'ROUND_COMMITMENT_SHAPE_MISMATCH')
  );
  assert.throws(
    () => validateRoundCommitment({ ...fixture, criticCandidateAccess: true }),
    (error) => evaluatorCode(error, 'ROUND_COMMITMENT_CONSTANT_MISMATCH')
  );
  assert.throws(
    () => validateRoundCommitment(fixture, `${JSON.stringify(fixture)} candidate-deadbeefdeadbeef`),
    (error) => evaluatorCode(error, 'PUBLIC_COMMITMENT_PRIVATE_OR_IDENTITY_LEAK')
  );
});

test('counterfactual hit/miss derivation is unbiased-domain reproducible and basis-quantized', () => {
  const seed = Buffer.alloc(32, 0x22);
  assert.deepEqual(deriveHitOffsetPairs(seed).map(({ inwardMicrometres, tangentMicrometres, tangentSign }) => ({
    inwardMicrometres,
    tangentMicrometres,
    tangentSign
  })), [
    { inwardMicrometres: 3260, tangentMicrometres: 11400, tangentSign: -1 },
    { inwardMicrometres: 2605, tangentMicrometres: 13701, tangentSign: 0 },
    { inwardMicrometres: 2062, tangentMicrometres: 11008, tangentSign: 1 }
  ]);
  assert.deepEqual(
    deriveHitOffsets(seed, [1, 0, 0], { right: [1, 0, 0], up: [0, 1, 0], forward: [0, 0, 1] })
      .map((entry) => entry.canonicalMicrometres),
    [[3260, 0, 11400], [2605, 0, 0], [2062, 0, -11008]]
  );
  assert.deepEqual(
    deriveMissOffsets(seed, { Bmin: -1, Bmax: 1, Tmin: -0.5, Tmax: 0.5 })
      .map((entry) => entry.canonicalMicrometres),
    [[1754492, 0, 0], [-1758252, 0, 0]]
  );
  assert.equal(roundHalfAwayFromZero(1.5), 2);
  assert.equal(roundHalfAwayFromZero(-1.5), -2);
});

test('segment distance handles parallel and zero-length segments deterministically', () => {
  const parallel = closestSegmentSegment([0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0]);
  assert.equal(parallel.distance, 1);
  assert.deepEqual(parallel.point1, [0, 0, 0]);
  assert.deepEqual(parallel.point2, [0, 1, 0]);
  const points = closestSegmentSegment([0, 0, 0], [0, 0, 0], [3, 4, 0], [3, 4, 0]);
  assert.equal(points.distance, 5);
});

test('Jacobi blade extraction identifies guard/tip and rejects ambiguous geometry', () => {
  const vertices = [];
  for (const x of [0, 0.25, 0.5, 0.75, 1]) {
    for (const y of [-0.01, 0.01]) {
      for (const z of [-0.01, 0.01]) vertices.push([x, y, z]);
    }
  }
  const capsule = extractBladeCapsule(vertices, [-0.1, 0, 0]);
  assert.ok(capsule.guard[0] < capsule.tip[0]);
  assert.ok(Math.abs(capsule.lengthMetres - 1) < 1e-12);
  assert.ok(capsule.maximumRadialDistance < 0.02);
  assert.throws(
    () => extractBladeCapsule([
      [-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [0.5, 0.5, 0.5]
    ], [0, 0, 0]),
    (error) => evaluatorCode(error, 'BLADE_AXIS_AMBIGUOUS')
  );
});

test('recommitted millimetre ceilings remain fail-closed for oversized and hilt-inclusive geometry', () => {
  assert.equal(BLADE_LENGTH_MAX_METRES, 1.873000);
  assert.equal(BLADE_RADIAL_MAX_METRES, 0.185000);
  const prism = (length, radial) => {
    const vertices = [];
    for (const x of [0, length * 0.25, length * 0.5, length * 0.75, length]) {
      for (const y of [-radial, radial]) for (const z of [-0.01, 0.01]) vertices.push([x, y, z]);
    }
    return vertices;
  };
  assert.throws(
    () => extractBladeCapsule(prism(1.874, 0.01), [-0.1, 0, 0]),
    (error) => evaluatorCode(error, 'BLADE_LENGTH_OUT_OF_BOUNDS')
  );
  assert.throws(
    () => extractBladeCapsule(prism(1.80, 0.186), [-0.1, 0, 0]),
    (error) => evaluatorCode(error, 'BLADE_RADIAL_BOUND_EXCEEDED')
  );
});

test('target capsules use the frozen ID order and height ratios', () => {
  const landmarks = Object.fromEntries([
    'pelvis', 'neck', 'head',
    'leftShoulder', 'leftElbow', 'leftWrist',
    'rightShoulder', 'rightElbow', 'rightWrist',
    'leftHip', 'leftKnee', 'leftAnkle',
    'rightHip', 'rightKnee', 'rightAnkle'
  ].map((key, index) => [key, [0, index * 0.1, 0]]));
  const capsules = buildTargetCapsules(2, landmarks);
  assert.deepEqual(capsules.map((capsule) => capsule.id), [
    'head', 'torso', 'left-upper-arm', 'left-forearm', 'right-upper-arm', 'right-forearm',
    'left-thigh', 'left-shin', 'right-thigh', 'right-shin'
  ]);
  assert.equal(capsules[0].radius, 0.16);
  assert.equal(capsules[1].radius, 0.23);
});

function geometryFixture() {
  class Vector3 {
    constructor(x = 0, y = 0, z = 0) { this.set(x, y, z); }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
    clone() { return new Vector3(this.x, this.y, this.z); }
    applyMatrix4(matrix) {
      const e = matrix.elements;
      return this.set(
        e[0] * this.x + e[4] * this.y + e[8] * this.z + e[12],
        e[1] * this.x + e[5] * this.y + e[9] * this.z + e[13],
        e[2] * this.x + e[6] * this.y + e[10] * this.z + e[14]
      );
    }
  }
  class Matrix4 {
    constructor(translation = [0, 0, 0]) {
      this.elements = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, translation[0], translation[1], translation[2], 1];
    }
    clone() { const clone = new Matrix4(); clone.elements = [...this.elements]; return clone; }
    multiply() { return this; }
  }
  const scene = { visible: true, parent: null, updateMatrixWorld() {} };
  const camera = {
    visible: true,
    parent: scene,
    layers: { test: () => true },
    projectionMatrix: new Matrix4(),
    matrixWorldInverse: new Matrix4(),
    updateMatrixWorld() {}
  };
  const heroRoot = { visible: true, parent: scene };
  const targetRoot = { visible: true, parent: scene };
  const attribute = (values, itemSize) => ({
    count: values.length,
    itemSize,
    getX: (index) => values[index][0],
    getY: (index) => values[index][1] ?? 0,
    getZ: (index) => values[index][2] ?? 0,
    getW: (index) => values[index][3] ?? 0
  });
  const makeMesh = (uuid, vertices, parent, { skinned = false, side = 0, skeleton = null } = {}) => ({
    isMesh: true,
    isSkinnedMesh: skinned,
    isInstancedMesh: false,
    uuid,
    visible: true,
    parent,
    layers: {},
    position: new Vector3(),
    matrixWorld: new Matrix4(),
    material: { visible: true, opacity: 1, side },
    skeleton,
    geometry: {
      attributes: { position: { count: vertices.length } },
      groups: [],
      drawRange: { start: 0, count: vertices.length }
    },
    getVertexPosition(index, target) { target.set(...vertices[index]); }
  });
  const bone = (translation, parent) => ({ isBone: true, parent, matrixWorld: new Matrix4(translation) });
  const targetBoneNames = [
    'pelvis', 'neck', 'head',
    'leftShoulder', 'leftElbow', 'leftWrist',
    'rightShoulder', 'rightElbow', 'rightWrist',
    'leftHip', 'leftKnee', 'leftAnkle',
    'rightHip', 'rightKnee', 'rightAnkle'
  ];
  const targetLandmarkBones = Object.fromEntries(targetBoneNames.map((name, index) => [name, bone([0.2, -0.8 + index * 0.1, 0], targetRoot)]));
  const targetBones = Object.values(targetLandmarkBones);
  const targetVertices = Array.from({ length: 18 }, (_, index) => [
    0.2 + (index % 3) * 0.01,
    index === 0 ? -0.9 : index === 17 ? 0.9 : -0.7 + (index % 15) * 0.1,
    0
  ]);
  const targetMesh = makeMesh('target', targetVertices, targetRoot, { skinned: true, skeleton: { bones: targetBones } });
  targetMesh.geometry.attributes.skinIndex = attribute(targetVertices.map((_, index) => [index % 15]), 1);
  targetMesh.geometry.attributes.skinWeight = attribute(targetVertices.map(() => [1]), 1);
  const bladeMesh = makeMesh('blade', [
    [0, 0, 0], [1, -0.01, 0], [1, 0.01, 0],
    [0, 0, 0], [1.8, 0.01, 0], [1.8, -0.01, 0]
  ], heroRoot);
  const source = {
    scene,
    camera,
    heroRoot,
    leftHandBone: bone([-0.1, -0.01, 0], heroRoot),
    rightHandBone: bone([-0.1, 0.01, 0], heroRoot),
    swordBladePrimitives: [{
      mesh: bladeMesh,
      materialGroupIndices: [0]
    }],
    targetRoot,
    targetSkinnedMeshes: [targetMesh],
    targetLandmarkBones,
    healthStore: {}
  };
  return { source, scene, camera, targetRoot, targetMesh, targetLandmarkBones };
}

test('live geometry collector proves render-driving landmarks, culls hidden blade triangles, and freezes tick-0 height', () => {
  const fixture = geometryFixture();
  const result = collectGeometrySource(fixture.source, { absoluteTick: 0 });
  assert.equal(result.scene, fixture.scene);
  assert.equal(result.camera, fixture.camera);
  assert.ok(Math.abs(result.targetHeight - 1.8) < 1e-12);
  assert.equal(result.bladeTriangles.length, 1);
  assert.ok(Math.abs(result.blade.lengthMetres - 1) < 1e-12);
  assert.equal(result.targetTriangles.length, 6);
  assert.equal(result.targetCapsules.length, 10);
  fixture.targetMesh.getVertexPosition = (index, target) => target.set(0.2, index === 0 ? -0.1 : 0.1, 0);
  const later = collectGeometrySource(fixture.source, { absoluteTick: 44, targetHeightReceipt: result.targetHeightReceipt });
  assert.equal(later.targetHeight, result.targetHeight);
  assert.throws(
    () => collectGeometrySource(fixture.source, { absoluteTick: 44 }),
    (error) => evaluatorCode(error, 'TARGET_HEIGHT_TICK_ZERO_RECEIPT_REQUIRED')
  );
  fixture.source.targetSkinnedMeshes = [{ ...fixture.targetMesh }];
  assert.throws(
    () => collectGeometrySource(fixture.source, { absoluteTick: 45, targetHeightReceipt: result.targetHeightReceipt }),
    (error) => evaluatorCode(error, 'TARGET_HEIGHT_MESH_IDENTITY_MUTATED')
  );
});

test('live geometry collection reaches shifted terminal 87 and rejects out-of-domain tick 88', () => {
  const fixture = geometryFixture();
  const tickZero = collectGeometrySource(fixture.source, { absoluteTick: 0 });
  assert.doesNotThrow(() => collectGeometrySource(fixture.source, {
    absoluteTick: SHIFTED_TERMINAL_ABSOLUTE_TICK,
    targetHeightReceipt: tickZero.targetHeightReceipt
  }));
  assert.throws(
    () => collectGeometrySource(fixture.source, {
      absoluteTick: SHIFTED_TERMINAL_ABSOLUTE_TICK + 1,
      targetHeightReceipt: tickZero.targetHeightReceipt
    }),
    (error) => evaluatorCode(error, 'GEOMETRY_ABSOLUTE_TICK_REQUIRED')
  );
});

test('geometry collector rejects duplicate, detached, and zero-weight landmark identities', () => {
  const duplicate = geometryFixture();
  duplicate.source.targetLandmarkBones.head = duplicate.source.targetLandmarkBones.neck;
  assert.throws(
    () => collectGeometrySource(duplicate.source, { absoluteTick: 0 }),
    (error) => evaluatorCode(error, 'TARGET_LANDMARK_DUPLICATE')
  );
  const detached = geometryFixture();
  detached.source.targetLandmarkBones.head.parent = detached.source.scene;
  assert.throws(
    () => collectGeometrySource(detached.source, { absoluteTick: 0 }),
    (error) => evaluatorCode(error, 'TARGET_LANDMARK_DETACHED')
  );
  const nonDriving = geometryFixture();
  const skinIndex = nonDriving.targetMesh.geometry.attributes.skinIndex;
  const originalGetX = skinIndex.getX;
  skinIndex.getX = (index) => originalGetX(index) === 2 ? 0 : originalGetX(index);
  assert.throws(
    () => collectGeometrySource(nonDriving.source, { absoluteTick: 0 }),
    (error) => evaluatorCode(error, 'TARGET_LANDMARK_NON_RENDER_DRIVING')
  );
});

const SWEEP_TEST_CAPSULE_IDS = [
  'head', 'torso', 'left-upper-arm', 'left-forearm', 'right-upper-arm', 'right-forearm',
  'left-thigh', 'left-shin', 'right-thigh', 'right-shin'
];

function sweepTestState(absoluteTick, {
  bladeGuard = [-1, 0, 0],
  bladeTip = [1, 0, 0],
  activeCapsules = {}
} = {}) {
  return {
    absoluteTick,
    blade: { guard: bladeGuard, tip: bladeTip },
    targetCapsules: SWEEP_TEST_CAPSULE_IDS.map((id, index) => {
      const active = activeCapsules[id];
      return active ? {
        id,
        a: active.a,
        b: active.b,
        radius: active.radius
      } : {
        id,
        a: [10 + index, 0, 0],
        b: [10 + index, 0.1, 0],
        radius: 0.1
      };
    })
  };
}

function sweepTestSeries(terminalTick, stateForTick) {
  return Array.from({ length: terminalTick + 2 }, (_, index) => stateForTick(index - 1));
}

function risingContactCoordinates(result) {
  return result.risingContacts.map(({ absoluteTick, substep, capsuleID }) => [absoluteTick, substep, capsuleID]);
}

function endpointSwapSeries(bladeAxisOffset = 0) {
  return sweepTestSeries(80, (absoluteTick) => {
    let endpoints = [[0, 0.3, 0], [0, 1.3, 0]];
    if (absoluteTick === 46) endpoints = [[0, 0.12, 0], [0, 1.12, 0]];
    if (absoluteTick === 47) endpoints = [[0, 1.12, 0], [0, 0.12, 0]];
    return sweepTestState(absoluteTick, {
      bladeGuard: [-1 + bladeAxisOffset, 0, 0],
      bladeTip: [1 + bladeAxisOffset, 0, 0],
      activeCapsules: {
        head: { a: endpoints[0], b: endpoints[1], radius: 0.1 }
      }
    });
  });
}

test('4096-substep sweep resolves exact tick-46 first contact without endpoint retries', () => {
  const capsuleIDs = [
    'head', 'torso', 'left-upper-arm', 'left-forearm', 'right-upper-arm', 'right-forearm',
    'left-thigh', 'left-shin', 'right-thigh', 'right-shin'
  ];
  const states = Array.from({ length: 82 }, (_, index) => {
    const absoluteTick = index - 1;
    const bladeX = absoluteTick === 46 ? 0.12 : 0.3;
    return {
      absoluteTick,
      blade: { guard: [bladeX, -0.5, 0], tip: [bladeX, 0.5, 0] },
      targetCapsules: capsuleIDs.map((id, capsuleIndex) => ({
        id,
        a: capsuleIndex === 0 ? [0, 0, 0] : [10 + capsuleIndex, 0, 0],
        b: capsuleIndex === 0 ? [0, 0, 0] : [10 + capsuleIndex, 0.1, 0],
        radius: 0.1
      }))
    };
  });
  const result = evaluateSweptContact(states);
  assert.equal(result.firstContactTick, 46);
  assert.equal(result.risingContactTicks.length, 1);
  assert.equal(result.risingContactTicks[0], 46);
  assert.deepEqual(risingContactCoordinates(result), [[46, 4096, 'head']]);
  assert.equal(canonicalContactChecks(result).pass, true);
  const frame = canonicalContactFrame(result, { right: [1, 0, 0], up: [0, 1, 0], forward: [0, 0, 1] });
  assert.deepEqual(frame.normal, [1, 0, 0]);
  assert.match(frame.receiptSha256, /^[0-9a-f]{64}$/u);
});

test('SHIFT_PLUS_7 is an exact edge-31/contact-53 translation through terminal 87', () => {
  assert.equal(CANONICAL_TERMINAL_ABSOLUTE_TICK, 80);
  assert.equal(SHIFTED_HEAVY_RISING_EDGE_ABSOLUTE_TICK, 31);
  assert.equal(SHIFTED_TERMINAL_ABSOLUTE_TICK, 87);
  const states = sweepTestSeries(SHIFTED_TERMINAL_ABSOLUTE_TICK, (absoluteTick) => {
    const bladeX = absoluteTick === 53 ? 0.12 : 0.3;
    return sweepTestState(absoluteTick, {
      bladeGuard: [bladeX, -0.5, 0],
      bladeTip: [bladeX, 0.5, 0],
      activeCapsules: { head: { a: [0, 0, 0], b: [0, 0, 0], radius: 0.1 } }
    });
  });
  const result = evaluateSweptContact(states, SHIFTED_TERMINAL_ABSOLUTE_TICK);
  assert.equal(result.intervals.length, 88);
  assert.equal(result.firstContactTick, 53);
  assert.deepEqual(risingContactCoordinates(result), [[53, 4096, 'head']]);
  assert.equal(shiftedContactChecks(result).pass, true);
  assert.equal(canonicalContactChecks(result).pass, false);
});

test('all geometry terminal APIs fail closed at out-of-domain tick 88', () => {
  const tick88 = SHIFTED_TERMINAL_ABSOLUTE_TICK + 1;
  assert.throws(
    () => evaluateSweptContact([], tick88),
    (error) => evaluatorCode(error, 'SWEEP_TERMINAL_TICK_INVALID')
  );
  assert.throws(
    () => computeMissOffsetExtrema(
      [],
      { right: [1, 0, 0], up: [0, 1, 0], forward: [0, 0, 1] },
      tick88
    ),
    (error) => evaluatorCode(error, 'SWEEP_TERMINAL_TICK_INVALID')
  );
});

test('sample-tape transitions reject endpoint-swap separation and recontact within interval 47', () => {
  const result = evaluateSweptContact(endpointSwapSeries());
  assert.equal(result.firstContactTick, 46);
  assert.deepEqual(risingContactCoordinates(result), [
    [46, 4096, 'head'],
    [47, 4096, 'head']
  ]);
  assert.deepEqual(result.risingContactTicks, [46, 47]);
  assert.equal(result.intervals[47].firstSample.substep, 4096);
  assert.ok(Math.abs(result.intervals[47].stateSeparation) <= EPS);
  const canonical = canonicalContactChecks(result);
  assert.equal(canonical.checks.noSecondRisingContact, false);
  assert.equal(canonical.pass, false);
  assert.equal(
    Object.entries(canonical.checks)
      .filter(([key]) => key !== 'noSecondRisingContact')
      .every(([, value]) => value),
    true
  );

  const hitOffsetResult = evaluateSweptContact(endpointSwapSeries(0.05));
  assert.deepEqual(risingContactCoordinates(hitOffsetResult), risingContactCoordinates(result));
  assert.equal(canonicalContactChecks(hitOffsetResult).checks.noSecondRisingContact, false);
});

test('sample tape records two same-interval rises and deterministic multi-capsule ties', () => {
  const k = 4 / Math.sqrt(3);
  const sameInterval = sweepTestSeries(0, (absoluteTick) => sweepTestState(absoluteTick, {
    bladeGuard: [0, 0, 0],
    bladeTip: [0, 0, 0],
    activeCapsules: {
      head: absoluteTick === -1 ?
        { a: [1, 0, 0], b: [-k, -1, 0], radius: 0.001 } :
        { a: [1, k, 0], b: [0, -1, 0], radius: 0.001 }
    }
  }));
  const sameIntervalResult = evaluateSweptContact(sameInterval, 0);
  assert.deepEqual(risingContactCoordinates(sameIntervalResult), [
    [0, 927, 'head'],
    [0, 2966, 'head']
  ]);
  assert.deepEqual(sameIntervalResult.risingContactTicks, [0, 0]);

  const tieSeries = sweepTestSeries(0, (absoluteTick) => {
    const x = absoluteTick === -1 ? 0.3 : 0;
    const capsule = { a: [x, 0, 0], b: [x, 0, 0], radius: 0.1 };
    return sweepTestState(absoluteTick, {
      bladeGuard: [0, 0, 0],
      bladeTip: [0, 0, 0],
      activeCapsules: { torso: capsule, 'left-upper-arm': capsule }
    });
  });
  const tieResult = evaluateSweptContact(tieSeries, 0);
  assert.deepEqual(risingContactCoordinates(tieResult), [[0, 2458, 'left-upper-arm']]);
  assert.equal(tieResult.firstContact.capsuleID, 'left-upper-arm');
  assert.equal(tieResult.intervals[0].firstSample.capsuleID, 'left-upper-arm');
});

test('sample tape detects boundary recontact and treats only separation above EPS as clear', () => {
  const boundarySeries = sweepTestSeries(1, (absoluteTick) => {
    const x = absoluteTick === -1 || absoluteTick === 1 ? 0.3 : -0.3;
    return sweepTestState(absoluteTick, {
      bladeGuard: [0, 0, 0],
      bladeTip: [0, 0, 0],
      activeCapsules: { head: { a: [x, 0, 0], b: [x, 0, 0], radius: 0.1 } }
    });
  });
  const boundaryResult = evaluateSweptContact(boundarySeries, 1);
  assert.deepEqual(risingContactCoordinates(boundaryResult), [
    [0, 1229, 'head'],
    [1, 1229, 'head']
  ]);

  const nearEpsPositions = new Map([
    [-1, 0.3],
    [0, 0.12 + EPS * 0.5],
    [1, 0.12 + EPS * 0.9],
    [2, 0.12 - EPS * 0.5]
  ]);
  const nearEps = sweepTestSeries(2, (absoluteTick) => {
    const x = nearEpsPositions.get(absoluteTick);
    return sweepTestState(absoluteTick, {
      bladeGuard: [0, 0, 0],
      bladeTip: [0, 0, 0],
      activeCapsules: { head: { a: [x, 0, 0], b: [x, 0, 0], radius: 0.1 } }
    });
  });
  assert.deepEqual(risingContactCoordinates(evaluateSweptContact(nearEps, 2)), [[0, 4096, 'head']]);

  const aboveEpsPositions = new Map([[-1, 0.3], [0, 0.12], [1, 0.12 + EPS * 2], [2, 0.12]]);
  const aboveEps = sweepTestSeries(2, (absoluteTick) => {
    const x = aboveEpsPositions.get(absoluteTick);
    return sweepTestState(absoluteTick, {
      bladeGuard: [0, 0, 0],
      bladeTip: [0, 0, 0],
      activeCapsules: { head: { a: [x, 0, 0], b: [x, 0, 0], radius: 0.1 } }
    });
  });
  const aboveEpsResult = evaluateSweptContact(aboveEps, 2);
  assert.equal(aboveEpsResult.risingContacts.length, 2);
  assert.deepEqual(aboveEpsResult.risingContactTicks, [0, 2]);
});

test('initial and continuous tangent contact do not create false rising transitions', () => {
  const initialContact = sweepTestSeries(0, (absoluteTick) => sweepTestState(absoluteTick, {
    bladeGuard: [0, 0, 0],
    bladeTip: [0, 0, 0],
    activeCapsules: { head: { a: [0.12, 0, 0], b: [0.12, 0, 0], radius: 0.1 } }
  }));
  const initialResult = evaluateSweptContact(initialContact, 0);
  assert.equal(initialResult.firstContactTick, 0);
  assert.deepEqual(initialResult.risingContacts, []);
  assert.deepEqual(initialResult.risingContactTicks, []);

  const continuous = sweepTestSeries(80, (absoluteTick) => {
    const bladeX = absoluteTick === 46 || absoluteTick === 47 ? 0.12 : 0.3;
    return sweepTestState(absoluteTick, {
      bladeGuard: [bladeX, -0.45, 0],
      bladeTip: [bladeX, 0.55, 0],
      activeCapsules: { head: { a: [0, 0, 0], b: [0, 0, 0], radius: 0.1 } }
    });
  });
  const continuousResult = evaluateSweptContact(continuous);
  assert.deepEqual(risingContactCoordinates(continuousResult), [[46, 4096, 'head']]);
  assert.deepEqual(continuousResult.risingContactTicks, [46]);
  assert.equal(canonicalContactChecks(continuousResult).pass, true);
});

test('miss extrema include every 4096 substep and both expanded endpoint sets', () => {
  const capsuleIDs = [
    'head', 'torso', 'left-upper-arm', 'left-forearm', 'right-upper-arm', 'right-forearm',
    'left-thigh', 'left-shin', 'right-thigh', 'right-shin'
  ];
  const states = [-1, 0].map((absoluteTick) => ({
    absoluteTick,
    blade: { guard: [-1, 0, 0], tip: [1, 0, 0] },
    targetCapsules: capsuleIDs.map((id, index) => ({
      id,
      a: [index === 0 ? -2 : 10 + index, 0, 0],
      b: [index === 0 ? 2 : 10 + index, 1, 0],
      radius: index === 0 ? 0.5 : 0.1
    }))
  }));
  const extrema = computeMissOffsetExtrema(states, { right: [1, 0, 0], up: [0, 1, 0], forward: [0, 0, 1] }, 0);
  assert.equal(extrema.Bmin, -1.02);
  assert.equal(extrema.Bmax, 1.02);
  assert.equal(extrema.Tmin, -2.5);
  assert.equal(extrema.Tmax, 19.1);
  assert.equal(extrema.sampleCount, 4096);
});

test('native mask topology uses exact Euclidean distances and locked thresholds', () => {
  const width = 5;
  const height = 5;
  const target = new Uint8Array(width * height);
  for (let y = 1; y <= 3; y += 1) for (let x = 1; x <= 3; x += 1) target[y * width + x] = 1;
  const blade = new Uint8Array(width * height);
  blade[2 * width] = 1;
  blade[2 * width + 2] = 1;
  const topology = analyzeMaskTopology(blade, target, width, height);
  assert.equal(topology.targetPixels, 9);
  assert.equal(topology.overlapPixels, 1);
  assert.equal(topology.minimumBladeToTargetExteriorPixels, 1);
  assert.equal(topology.maximumOverlapInsidePixels, 2);
  assert.equal(visibleTopologyChecks(
    { minimumBladeToTargetExteriorPixels: 3 },
    { minimumBladeToTargetExteriorPixels: 2, overlapFraction: 0.0025, maximumOverlapInsidePixels: 3 }
  ).pass, true);
});

test('blade endpoints must match their corresponding axial silhouette extrema', () => {
  const mask = new Uint8Array(1600 * 900);
  for (let x = 400; x < 1200; x += 1) mask[449 * 1600 + x] = 1;
  const blade = { guard: [-0.5, 0, 0], tip: [0.5, 0, 0] };
  const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  assert.equal(bladeEndpointSilhouetteChecks(blade, identity, mask).pass, true);
  for (let x = 1000; x < 1200; x += 1) mask[449 * 1600 + x] = 0;
  const shortened = bladeEndpointSilhouetteChecks(blade, identity, mask);
  assert.equal(shortened.pass, false);
  assert.ok(shortened.tipDistancePixels > 100);
});

test('ticks 44-48 topology continuity binds camera, production frames, masks, endpoints, and landmarks', () => {
  const landmarkKeys = [
    'pelvis', 'neck', 'head', 'leftShoulder', 'leftElbow', 'leftWrist',
    'rightShoulder', 'rightElbow', 'rightWrist', 'leftHip', 'leftKnee', 'leftAnkle',
    'rightHip', 'rightKnee', 'rightAnkle'
  ];
  const targetMask = new Uint8Array(1600 * 900);
  for (let y = 400; y < 500; y += 1) for (let x = 800; x < 900; x += 1) targetMask[y * 1600 + x] = 1;
  const frames = Array.from({ length: 5 }, (_, index) => {
    const bladeMask = new Uint8Array(1600 * 900);
    const bladeX = index === 1 ? 797 : index === 2 ? 798 : 796 + index;
    bladeMask[450 * 1600 + bladeX] = 1;
    return {
      absoluteTick: 44 + index,
      bladeMask,
      targetMask,
      viewProjectionMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      cameraDigest: 'c'.repeat(64),
      blade: { guard: [index * 0.01, 0, 0], tip: [1 + index * 0.01, 0, 0] },
      landmarks: Object.fromEntries(landmarkKeys.map((key, landmarkIndex) => [key, [0, landmarkIndex * 0.01, 0]])),
      productionFrameSha256: String(index + 1).repeat(64),
      productionFrameUnannotated: true,
      baselineEffectsObscureTopology: false
    };
  });
  const continuity = topologyContinuityChecks(frames);
  assert.equal(continuity.pass, true);
  frames[3].cameraDigest = 'd'.repeat(64);
  assert.equal(topologyContinuityChecks(frames).pass, false);
});

test('software rasterizer clips and fills a current world triangle at native DPR1', () => {
  const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const result = rasterizeObjectMask({
    triangles: [{ a: [-0.5, -0.5, 0], b: [0.5, -0.5, 0], c: [0, 0.5, 0], side: 'front' }],
    viewProjectionMatrix: identity
  });
  assert.equal(result.width, 1600);
  assert.equal(result.height, 900);
  assert.ok(result.mask.some((value) => value === 1));
  assert.equal(result.mask[450 * 1600 + 800], 1);
});

test('ballot token domains and blind order manifest forbid aliases or references in the wrong ballot class', () => {
  const seed = Buffer.alloc(32, 0x11);
  const aliases = ['candidate-1111111111111111', 'candidate-eeeeeeeeeeeeeeee'];
  const manifest = buildBlindOrderManifest(seed, aliases);
  assert.equal(manifest.ballots.length, 9);
  assert.doesNotThrow(() => validateBlindOrderManifest(manifest, presentationCommit(seed), seed));
  assert.deepEqual(validateBallotTokens('R1/candidate-1111111111111111', [
    'candidate-1111111111111111', 'reference/R1'
  ]), { kind: 'reference', ballotID: 'R1', alias: 'candidate-1111111111111111' });
  assert.throws(
    () => validateBallotTokens('P1', [aliases[0], 'reference/R1']),
    (error) => evaluatorCode(error, 'INVALID_OPAQUE_ALIAS')
  );
  const tampered = structuredClone(manifest);
  tampered.ballots[0].right = aliases[1];
  assert.throws(
    () => validateBlindOrderManifest(tampered),
    (error) => evaluatorCode(error, 'BLIND_ORDER_MANIFEST_HASH_MISMATCH')
  );
});

test('action crop contains actors and HUD at exact 16:9, while contact ROI is unscaled and centered', () => {
  const crop = deriveActionCrop({
    heroBounds: { x: 500, y: 180, width: 250, height: 650 },
    weaponBounds: { x: 700, y: 240, width: 400, height: 300 },
    targetBounds: { x: 1020, y: 180, width: 260, height: 650 },
    hudBounds: [{ x: 32, y: 24, width: 300, height: 80 }]
  });
  assert.equal(crop.width / crop.height, 16 / 9);
  assert.ok(crop.x <= 32 && crop.y <= 24);
  assert.ok(crop.x + crop.width >= 1280 && crop.y + crop.height >= 830);
  const roi = deriveContactRoi({
    closestBladePoint: [0, 0, 0],
    closestTargetPoint: [0, 0, 0],
    viewProjectionMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
  });
  assert.deepEqual({ x: roi.x, y: roi.y, width: roi.width, height: roi.height }, { x: 640, y: 290, width: 320, height: 320 });
  assert.equal(roi.resampled, false);
});

test('JPEG and WebP dimensions plus Lanczos crop/scale and equal anonymous board pixels are deterministic', () => {
  const jpeg = Buffer.from('ffd8ffc00011080020004003011100021100031100ffd9', 'hex');
  assert.deepEqual(referenceImageDimensions(jpeg), { width: 64, height: 32 });
  const webp = Buffer.alloc(30);
  webp.write('RIFF', 0, 'ascii');
  webp.writeUInt32LE(22, 4);
  webp.write('WEBP', 8, 'ascii');
  webp.write('VP8X', 12, 'ascii');
  webp.writeUInt32LE(10, 16);
  webp[24] = 63;
  webp[27] = 31;
  assert.deepEqual(referenceImageDimensions(webp), { width: 64, height: 32 });
  const image = {
    width: 2,
    height: 2,
    rgba: Uint8Array.from([
      255, 0, 0, 255, 0, 255, 0, 255,
      0, 0, 255, 255, 255, 255, 255, 255
    ])
  };
  const exact = cropScaleRgbaLanczos3(image, { x: 0, y: 0, width: 2, height: 2 }, 10, 10);
  assert.deepEqual(exact.rgba, image.rgba);
  const reduced = cropScaleRgbaLanczos3(image, { x: 0, y: 0, width: 2, height: 2 }, 1, 1);
  assert.equal(reduced.width, 1);
  assert.equal(reduced.height, 1);
  const seed = Buffer.alloc(32, 0x11);
  const aliases = ['candidate-1111111111111111', 'candidate-eeeeeeeeeeeeeeee'];
  const order = deriveTwoSideOrder(seed, 'P1', aliases);
  const pixelSha256 = createHash('sha256').update(image.rgba).digest('hex');
  const boardA = composeAnonymousEqualBoard({
    presentationSeed: seed, expectedPresentationCommit: presentationCommit(seed), itemID: 'P1', order,
    leftImage: image, rightImage: image, leftPixelSha256: pixelSha256, rightPixelSha256: pixelSha256
  });
  const boardB = composeAnonymousEqualBoard({
    presentationSeed: seed, expectedPresentationCommit: presentationCommit(seed), itemID: 'P1', order,
    leftImage: image, rightImage: image, leftPixelSha256: pixelSha256, rightPixelSha256: pixelSha256
  });
  assert.equal(boardA.boardSha256, boardB.boardSha256);
  assert.deepEqual(boardA.publicLabels, ['LEFT', 'RIGHT']);
  assert.equal(boardA.cells[0].width, boardA.cells[1].width);
  assert.equal(Buffer.from(boardA.rgba).includes(Buffer.from('candidate-')), false);
});

test('committed reference transform obtains RGBA from the locked browser decoder path, never caller-supplied pixels', async (context) => {
  const originalCreateImageBitmap = globalThis.createImageBitmap;
  const originalOffscreenCanvas = globalThis.OffscreenCanvas;
  context.after(() => {
    if (originalCreateImageBitmap === undefined) delete globalThis.createImageBitmap;
    else globalThis.createImageBitmap = originalCreateImageBitmap;
    if (originalOffscreenCanvas === undefined) delete globalThis.OffscreenCanvas;
    else globalThis.OffscreenCanvas = originalOffscreenCanvas;
  });
  let closed = false;
  globalThis.createImageBitmap = async () => ({ width: 64, height: 32, close() { closed = true; } });
  globalThis.OffscreenCanvas = class {
    constructor(width, height) { this.width = width; this.height = height; }
    getContext() {
      return {
        globalCompositeOperation: 'source-over',
        imageSmoothingEnabled: true,
        clearRect() {},
        drawImage() {},
        getImageData: () => ({ data: new Uint8ClampedArray(this.width * this.height * 4).fill(127) })
      };
    }
  };
  const jpeg = Buffer.from('ffd8ffc00011080020004003011100021100031100ffd9', 'hex');
  const decoded = await decodeReferenceImagePixels(jpeg);
  assert.equal(decoded.decoder, 'browser-createImageBitmap-offscreenCanvas-srgb-rgba8-v1');
  assert.equal(decoded.rgba.length, 64 * 32 * 4);
  const transformed = await transformCommittedReferencePixels({
    encodedBytes: jpeg,
    selection: {
      sourceFileSha256: createHash('sha256').update(jpeg).digest('hex'),
      originalDimensions: { width: 64, height: 32 },
      cropRectangle: { x: 0, y: 0, width: 64, height: 32 },
      uniformScaleAlgorithm: 'lanczos3-uniform-fit-no-upscale-v1'
    },
    maximumWidth: 32,
    maximumHeight: 16
  });
  assert.equal(transformed.width, 32);
  assert.equal(transformed.height, 16);
  assert.equal(closed, true);
});

function fixtureCrc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function storedZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const bytes = Buffer.from(entry.bytes);
    const crc = fixtureCrc32(bytes);
    const local = Buffer.alloc(30 + name.length + bytes.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(bytes.length, 18);
    local.writeUInt32LE(bytes.length, 22);
    local.writeUInt16LE(name.length, 26);
    name.copy(local, 30);
    bytes.copy(local, 30 + name.length);
    locals.push(local);
    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE((3 << 8) | 20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(bytes.length, 20);
    central.writeUInt32LE(bytes.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(((entry.mode ?? 0o100644) << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);
    centrals.push(central);
    offset += local.length;
  }
  const centralBytes = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBytes.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBytes, eocd]);
}

test('reference custody proves selected bytes originate in the ZIP and rejects ZIP or extracted symlinks', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'p30-r012-reference-test-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const jpeg = Buffer.from('ffd8ffc00011080020004003011100021100031100ffd9', 'hex');
  const entries = [0, 1, 2].map((index) => ({ name: `Reference/f${index}.jpeg`, bytes: jpeg }));
  const archive = storedZip(entries);
  const archivePath = join(root, 'Reference.zip');
  const extracted = join(root, 'extracted');
  await mkdir(join(extracted, 'Reference'), { recursive: true });
  await writeFile(archivePath, archive);
  for (const entry of entries) await writeFile(join(extracted, entry.name), jpeg);
  const fileHash = createHash('sha256').update(jpeg).digest('hex');
  const selection = selectionFixture();
  selection.selections.forEach((entry) => {
    entry.sourceFileSha256 = fileHash;
    entry.originalDimensions = { width: 64, height: 32 };
    entry.cropRectangle = { x: 0, y: 0, width: 64, height: 32 };
  });
  assert.equal(parseReferenceZip(archive).size, 3);
  await assert.doesNotReject(() => verifyReferenceSelectionFiles(selection, extracted, archivePath));
  const outside = join(root, 'outside.jpeg');
  await writeFile(outside, jpeg);
  await rm(join(extracted, 'Reference/f0.jpeg'));
  await symlink(outside, join(extracted, 'Reference/f0.jpeg'));
  await assert.rejects(
    () => verifyReferenceSelectionFiles(selection, extracted, archivePath),
    (error) => evaluatorCode(error, 'REFERENCE_EXTRACTED_SYMLINK_FORBIDDEN')
  );
  const symlinkZip = storedZip([{ name: 'Reference/link.jpeg', bytes: Buffer.from('target'), mode: 0o120777 }]);
  assert.throws(
    () => parseReferenceZip(symlinkZip),
    (error) => evaluatorCode(error, 'REFERENCE_ZIP_SYMLINK_FORBIDDEN')
  );
});

test('counterfactual validation binds all three hit offsets and both miss results without regeneration', () => {
  const hitOffsets = [0, 1, 2].map((index) => ({ canonicalMicrometres: [index + 1, 0, 0] }));
  const missOffsets = [{ canonicalMicrometres: [300000, 0, 0] }, { canonicalMicrometres: [-300000, 0, 0] }];
  const health = (hit) => Array.from({ length: 82 }, (_, index) => ({
    absoluteTick: index - 1,
    health: hit && index - 1 >= 46 ? 75 : 100
  }));
  const hitRuns = hitOffsets.map((offset, index) => ({
    index,
    offsetCanonicalMicrometres: offset.canonicalMicrometres,
    evaluatorResult: {
      firstContactTick: 46,
      risingContacts: [{ absoluteTick: 46, substep: 4096, capsuleID: 'head' }],
      risingContactTicks: [46],
      maximumPenetration: -0.011
    },
    healthByTick: health(true),
    damageMutations: [{ absoluteTick: 46, before: 100, after: 75, amount: 25 }],
    events: [{ type: 'damage', absoluteTick: 46 }],
    visibleTopology: { pass: true }
  }));
  const missRuns = missOffsets.map((offset, index) => ({
    index,
    offsetCanonicalMicrometres: offset.canonicalMicrometres,
    evaluatorResult: { firstContactTick: null, risingContacts: [], risingContactTicks: [], maximumPenetration: 0.25 },
    healthByTick: health(false),
    events: [],
    reactionOrRecoil: false,
    maximumTargetDriftMetres: 0.01
  }));
  assert.deepEqual(validateCounterfactualRuns({ hitOffsets, missOffsets, hitRuns, missRuns }), {
    hitRunsVerified: 3, missRunsVerified: 2, pass: true
  });
  const secondRise = structuredClone(hitRuns);
  secondRise[1].evaluatorResult.risingContacts.push({ absoluteTick: 47, substep: 1, capsuleID: 'torso' });
  secondRise[1].evaluatorResult.risingContactTicks.push(47);
  assert.throws(
    () => validateCounterfactualRuns({ hitOffsets, missOffsets, hitRuns: secondRise, missRuns }),
    (error) => evaluatorCode(error, 'COUNTERFACTUAL_HIT_GEOMETRY_FAILED')
  );
  hitRuns[2].offsetCanonicalMicrometres = [99, 0, 0];
  assert.throws(
    () => validateCounterfactualRuns({ hitOffsets, missOffsets, hitRuns, missRuns }),
    (error) => evaluatorCode(error, 'COUNTERFACTUAL_HIT_OFFSET_MISMATCH')
  );
});

function packageMapFixture() {
  return {
    schema: 'p30.r012a.package-map.v1',
    protocolID: PROTOCOL_ID,
    packages: ['candidate-1111111111111111', 'candidate-eeeeeeeeeeeeeeee'].map((alias, index) => ({
      alias,
      builderIdentity: `builder-${index + 1}`,
      worktree: `/private/custody/worktree-${index + 1}`,
      branch: `codex/private-${index + 1}`,
      sourceCommit: String(index + 1).repeat(40),
      gitTree: String(index + 3).repeat(40),
      sourceArchiveSha256: String(index + 1).repeat(64),
      sourceArchiveBytes: 1000 + index,
      materializedSourceTreeSha256: String(index + 2).repeat(64),
      packageArchiveSha256: String(index + 3).repeat(64),
      packageArchiveBytes: 2000 + index,
      materializedPackageTreeSha256: String(index + 4).repeat(64),
      productionOutputTreeSha256: String(index + 5).repeat(64),
      lockfilePath: 'package-lock.json',
      lockfileSha256: String(index + 6).repeat(64),
      buildCommand: ['npm', 'run', 'build:critic']
    }))
  };
}

function publicPackageReceiptFixture(map = packageMapFixture()) {
  return {
    schema: 'p30.r012a.public-package-receipt.v1',
    protocolID: PROTOCOL_ID,
    packages: map.packages.map((entry) => ({
      alias: entry.alias,
      packageArchiveSha256: entry.packageArchiveSha256,
      packageArchiveBytes: entry.packageArchiveBytes,
      materializedPackageTreeSha256: entry.materializedPackageTreeSha256,
      productionOutputTreeSha256: entry.productionOutputTreeSha256,
      criticInterfaceSha256: 'f'.repeat(64)
    }))
  };
}

test('package-map domain binds exactly two fully specified custody entries', () => {
  const fixture = packageMapFixture();
  assert.doesNotThrow(() => validatePackageMap(fixture));
  const publicReceipt = publicPackageReceiptFixture(fixture);
  assert.doesNotThrow(() => validatePublicPackageReceipt(publicReceipt));
  assert.equal(PACKAGE_MAP_COMMIT_DOMAIN, 'P30R012A/package-map/v1');
  const salt = Buffer.alloc(32, 0x55);
  const commit = packageMapCommit(fixture, salt);
  assert.match(commit, /^[0-9a-f]{64}$/u);
  assert.deepEqual(verifyPackageMapReveal({
    mapDocument: fixture, mapSalt: salt, expectedMapCommit: commit, publicPackageReceipt: publicReceipt
  }), { packageMapCommitVerified: true, publicPackageBindingsVerified: 2 });
  assert.throws(
    () => validatePackageMap({ ...fixture, packages: fixture.packages.slice(0, 1) }),
    (error) => evaluatorCode(error, 'PACKAGE_MAP_EXACTLY_TWO_PACKAGES_REQUIRED')
  );
  const unknown = structuredClone(fixture);
  unknown.packages[0].builderNote = 'forbidden';
  assert.throws(
    () => validatePackageMap(unknown),
    (error) => evaluatorCode(error, 'PACKAGE_MAP_ENTRY_SHAPE_MISMATCH')
  );
});

let cachedAliasEvidenceCustodyProof = null;

function aliasEvidenceCustodyProofFixture() {
  if (cachedAliasEvidenceCustodyProof !== null) return cachedAliasEvidenceCustodyProof;
  const manifest = evidenceManifestFixture();
  manifest.privateBoardHashes.forEach((board, index) => {
    manifest.custodyBytesByPath.delete(board.path);
    const bytes = new Uint8Array(1600 * 900 * 4).fill(0x41 + index);
    board.byteCount = bytes.byteLength;
    board.sha256 = createHash('sha256').update(bytes).digest('hex');
    board.path = privateBoardClaimPath(board);
    manifest.custodyBytesByPath.set(board.path, bytes);
  });
  cachedAliasEvidenceCustodyProof = createEvidenceCustodyProof(
    manifest,
    manifest.custodyBytesByPath,
    manifest.blindOrderManifest,
    manifest.blindOrderManifest.presentationCommit,
    manifest.publicPackageReceipt
  );
  return cachedAliasEvidenceCustodyProof;
}

function aliasScoreFixture() {
  const seed = Buffer.alloc(32, 0x11);
  const aliases = ['candidate-1111111111111111', 'candidate-eeeeeeeeeeeeeeee'];
  const order = buildBlindOrderManifest(seed, aliases);
  const digest = 'b'.repeat(64);
  const evidenceCustodyProof = aliasEvidenceCustodyProofFixture();
  const boardsByID = new Map(evidenceCustodyProof.boardClaims.map((board) => [board.boardID, board]));
  const section = (name) => ({
    schema: `p30.r012a.${name}.v1`,
    receiptSha256: digest,
    evidenceSha256s: [digest],
    measurements: { complete: true }
  });
  const gates = Object.fromEntries([
    'O1', 'O2', 'O3', 'O4', 'O5', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10'
  ].map((id) => [id, {
    pass: ['T1', 'T10'].includes(id) ? 'pending-reveal' : true,
    evidenceSha256s: [digest],
    reason: `${id} has complete alias-only evidence.`
  }]));
  const candidates = aliases.map((alias) => {
    const referenceBallots = order.ballots.filter((ballot) => ballot.itemID.endsWith(`/${alias}`)).map((ballot) => ({
      ballotID: ballot.itemID.slice(0, 2),
      itemID: ballot.itemID,
      orderDigest: ballot.orderDigest,
      leftToken: ballot.left,
      rightToken: ballot.right,
      winner: ballot.left === alias ? 'LEFT' : 'RIGHT',
      castCount: 1,
      boardSha256: boardsByID.get(ballot.itemID).sha256
    }));
    return {
      alias,
      packageArchiveSha256: digest,
      packageTreeSha256: digest,
      productionOutputTreeSha256: digest,
      runProfiles: section('run-profiles'),
      inputMeasurements: section('input-measurements'),
      contactMeasurements: section('contact-measurements'),
      healthMeasurements: section('health-measurements'),
      counterfactualMeasurements: section('counterfactual-measurements'),
      distinctnessMeasurements: section('distinctness-measurements'),
      recoveryMeasurements: section('recovery-measurements'),
      baselineComparisons: section('baseline-comparisons'),
      gates: structuredClone(gates),
      referenceBallots,
      referenceWinCount: 3,
      visualScores: Object.fromEntries(Array.from({ length: 10 }, (_, index) => [`C${index + 1}`, {
        score: 10,
        reason: `C${index + 1} meets the frozen reference-level criterion.`
      }])),
      visualTotal: 100,
      visualMinimum: 10,
      disqualifiers: [],
      acceptanceChecks: {
        noDisqualifier: true,
        objectiveGates: true,
        technicalGatesCurrentlyDecidable: true,
        pendingRevealOnly: true,
        referenceWins: true,
        visualTotal: true,
        visualMinimum: true
      },
      provisionallyAccepted: true,
      biggestRemainingGap: null
    };
  });
  const document = {
    schema: 'p30.r012a.alias-score.v1',
    protocolID: PROTOCOL_ID,
    protocolPayloadSha256: PROTOCOL_PAYLOAD_SHA256,
    baselineReceiptSha256: BASELINE_RECEIPT_SHA256,
    roundCommitmentSha256: digest,
    referenceCommit: digest,
    packageMapCommit: digest,
    identityRevealReceived: false,
    runtime: {
      nodeExecutable: '/opt/homebrew/opt/node@24/bin/node',
      nodeVersion: 'v24.1.0',
      npmVersion: '11.0.0',
      browserExecutable: '/Applications/Chromium.app/Contents/MacOS/Chromium',
      browserVersion: 'Chromium 140.0.0.0',
      launchArguments: ['--headless=false'],
      gpuRenderer: 'Apple M-series',
      viewportWidth: 1600,
      viewportHeight: 900,
      deviceScaleFactor: 1,
      devicePixelRatio: 1,
      zoomPercent: 100,
      normalRoute: '/game',
      evaluatorHelperSha256: digest
    },
    executionOrder: order.executionOrder,
    candidates,
    pairwiseBallots: order.ballots.filter((ballot) => ballot.itemID.startsWith('P')).map((ballot) => ({
      ballotID: ballot.itemID,
      itemID: ballot.itemID,
      orderDigest: ballot.orderDigest,
      leftToken: ballot.left,
      rightToken: ballot.right,
      winner: null,
      castCount: 1,
      boardSha256: boardsByID.get(ballot.itemID).sha256
    })),
    strongerAlias: aliases[0],
    provisionalOutcome: 'PROVISIONAL_ACCEPTED_CANDIDATE_EXISTS',
    evidenceManifestSha256: evidenceCustodyProof.evidenceManifestSha256,
    blindOrderManifestSha256: order.manifestSha256,
    disqualifiers: []
  };
  const custodyBindings = {
    roundCommitmentSha256: digest,
    referenceCommit: digest,
    packageMapCommit: digest,
    evidenceManifestSha256: evidenceCustodyProof.evidenceManifestSha256,
    blindOrderManifestSha256: order.manifestSha256,
    evaluatorHelperSha256: digest,
    publicPackageReceipt: {
      schema: 'p30.r012a.public-package-receipt.v1',
      protocolID: PROTOCOL_ID,
      packages: aliases.map((alias) => ({
        alias,
        packageArchiveSha256: digest,
        packageArchiveBytes: 1,
        materializedPackageTreeSha256: digest,
        productionOutputTreeSha256: digest,
        criticInterfaceSha256: digest
      }))
    }
  };
  Object.defineProperty(document, 'blindOrderManifest', { value: order, enumerable: false });
  Object.defineProperty(document, 'custodyBindings', { value: custodyBindings, enumerable: false });
  Object.defineProperty(document, 'evidenceCustodyProof', { value: evidenceCustodyProof, enumerable: false });
  return document;
}

function validateAliasScoreFixture(document, fixture) {
  return validateAliasOnlyScore(
    document,
    fixture.blindOrderManifest,
    fixture.blindOrderManifest.presentationCommit,
    fixture.custodyBindings,
    fixture.evidenceCustodyProof
  );
}

function aliasScoreBallots(document) {
  return [
    ...document.candidates.flatMap((candidate) => candidate.referenceBallots),
    ...document.pairwiseBallots
  ];
}

function resummarizeAliasCandidate(candidate) {
  const winnerToken = (ballot) => ballot.winner === 'LEFT' ? ballot.leftToken :
    ballot.winner === 'RIGHT' ? ballot.rightToken : null;
  const referenceWins = candidate.referenceBallots.filter((ballot) => winnerToken(ballot) === candidate.alias).length;
  const scores = Object.values(candidate.visualScores).map((category) => category.score);
  candidate.referenceWinCount = referenceWins;
  candidate.visualTotal = scores.reduce((sum, score) => sum + score, 0);
  candidate.visualMinimum = Math.min(...scores);
  candidate.acceptanceChecks = {
    noDisqualifier: candidate.disqualifiers.length === 0,
    objectiveGates: ['O1', 'O2', 'O3', 'O4', 'O5'].every((id) => candidate.gates[id].pass === true),
    technicalGatesCurrentlyDecidable: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9']
      .every((id) => candidate.gates[id].pass === true),
    pendingRevealOnly: candidate.gates.T1.pass === 'pending-reveal' && candidate.gates.T10.pass === 'pending-reveal',
    referenceWins: referenceWins === 3,
    visualTotal: candidate.visualTotal >= 95,
    visualMinimum: candidate.visualMinimum >= 9
  };
  candidate.provisionallyAccepted = Object.values(candidate.acceptanceChecks).every(Boolean);
  candidate.biggestRemainingGap = candidate.provisionallyAccepted ? null :
    'Biggest remaining gap: frozen criterion shortfall at the controlling transition, which misses the reference-level bar.';
}

function resummarizeAliasScore(document) {
  document.candidates.forEach(resummarizeAliasCandidate);
  document.provisionalOutcome = document.candidates.some((candidate) => candidate.provisionallyAccepted) ?
    'PROVISIONAL_ACCEPTED_CANDIDATE_EXISTS' : 'NO_ACCEPTED_CANDIDATE';
}

function setAliasVisualScores(candidate, scores) {
  assert.equal(scores.length, 10);
  scores.forEach((score, index) => { candidate.visualScores[`C${index + 1}`].score = score; });
}

function setAliasReferenceWins(candidate, winCount) {
  candidate.referenceBallots.forEach((ballot, index) => {
    ballot.winner = index >= winCount ? null : ballot.leftToken === candidate.alias ? 'LEFT' : 'RIGHT';
  });
}

function setPairwiseWinners(document, winnerAliases) {
  document.pairwiseBallots.forEach((ballot, index) => {
    const alias = winnerAliases[index] ?? null;
    if (alias === null) {
      ballot.winner = null;
    } else if (ballot.leftToken === alias) {
      ballot.winner = 'LEFT';
    } else if (ballot.rightToken === alias) {
      ballot.winner = 'RIGHT';
    } else {
      assert.fail('Pairwise winner alias is not on the ballot.');
    }
  });
}

function assertStrengthScenario(document, fixture, expectedAlias) {
  resummarizeAliasScore(document);
  document.strongerAlias = expectedAlias;
  assert.doesNotThrow(() => validateAliasScoreFixture(document, fixture));
  const wrong = structuredClone(document);
  wrong.strongerAlias = document.candidates.find((candidate) => candidate.alias !== expectedAlias).alias;
  assert.throws(
    () => validateAliasScoreFixture(wrong, fixture),
    (error) => evaluatorCode(error, 'ALIAS_SCORE_STRONGER_ALIAS_MISMATCH')
  );
}

test('alias-only score is exact, two-candidate, alias-only, one-cast, and domain committed', () => {
  const fixture = aliasScoreFixture();
  assert.doesNotThrow(() => validateAliasOnlyScore(
    fixture, fixture.blindOrderManifest, fixture.blindOrderManifest.presentationCommit,
    fixture.custodyBindings, fixture.evidenceCustodyProof
  ));
  assert.equal(ALIAS_SCORE_COMMIT_DOMAIN, 'P30R012A/alias-score/v1');
  assert.match(aliasScoreCommit(
    fixture, Buffer.alloc(32, 0x66), fixture.blindOrderManifest,
    fixture.blindOrderManifest.presentationCommit, fixture.custodyBindings, fixture.evidenceCustodyProof
  ), /^[0-9a-f]{64}$/u);
  const hidden = structuredClone(fixture);
  hidden.candidates[0].identity = 'forbidden';
  assert.throws(
    () => validateAliasOnlyScore(
      hidden, fixture.blindOrderManifest, fixture.blindOrderManifest.presentationCommit,
      fixture.custodyBindings, fixture.evidenceCustodyProof
    ),
    (error) => evaluatorCode(error, 'ALIAS_SCORE_CANDIDATE_SHAPE_MISMATCH')
  );
  const wrongToken = structuredClone(fixture);
  wrongToken.candidates[0].referenceBallots[0].rightToken = fixture.candidates[1].alias;
  assert.throws(
    () => validateAliasOnlyScore(
      wrongToken, fixture.blindOrderManifest, fixture.blindOrderManifest.presentationCommit,
      fixture.custodyBindings, fixture.evidenceCustodyProof
    ),
    (error) => evaluatorCode(error, 'INVALID_REFERENCE_BALLOT_TOKEN')
  );
});

test('alias score binds all six reference and three pairwise ballots to exact custody board claims', () => {
  const fixture = aliasScoreFixture();
  const rejects = (mutate, code = 'ALIAS_SCORE_EVIDENCE_CUSTODY_BOARD_BINDING_MISMATCH') => {
    const document = structuredClone(fixture);
    mutate(document);
    assert.throws(
      () => validateAliasScoreFixture(document, fixture),
      (error) => evaluatorCode(error, code)
    );
  };
  assert.equal(aliasScoreBallots(fixture).length, 9);
  assert.deepEqual(
    aliasScoreBallots(fixture).map((ballot) => ballot.itemID),
    fixture.evidenceCustodyProof.boardClaims.map((board) => board.boardID)
  );

  rejects((document) => {
    aliasScoreBallots(document).forEach((ballot) => { ballot.boardSha256 = 'c'.repeat(64); });
  });
  rejects((document) => {
    document.candidates[0].referenceBallots[0].boardSha256 =
      fixture.evidenceCustodyProof.boardClaims[1].sha256;
  });
  rejects((document) => {
    document.candidates[0].referenceBallots[1].boardSha256 =
      document.candidates[0].referenceBallots[0].boardSha256;
  });
  rejects((document) => {
    document.pairwiseBallots[0].boardSha256 = document.candidates[0].referenceBallots[0].boardSha256;
  });
  rejects((document) => {
    document.candidates[1].referenceBallots[0].boardSha256 =
      document.candidates[0].referenceBallots[0].boardSha256;
  });
  rejects((document) => {
    document.candidates[0].referenceBallots[1] = structuredClone(document.candidates[0].referenceBallots[0]);
  }, 'ALIAS_SCORE_BALLOT_ID_MISMATCH');
  rejects((document) => {
    document.pairwiseBallots[0].itemID = document.candidates[0].referenceBallots[0].itemID;
  }, 'ALIAS_SCORE_BALLOT_ID_MISMATCH');
});

test('alias score rejects missing, cloned, proxied, accessor, typed-array, and caller-map custody proofs', () => {
  const fixture = aliasScoreFixture();
  const validateWith = (proof) => validateAliasOnlyScore(
    fixture,
    fixture.blindOrderManifest,
    fixture.blindOrderManifest.presentationCommit,
    fixture.custodyBindings,
    proof
  );
  assert.throws(
    () => validateAliasOnlyScore(
      fixture,
      fixture.blindOrderManifest,
      fixture.blindOrderManifest.presentationCommit,
      fixture.custodyBindings
    ),
    (error) => evaluatorCode(error, 'ALIAS_SCORE_EVIDENCE_CUSTODY_PROOF_REQUIRED')
  );
  const cloned = structuredClone(fixture.evidenceCustodyProof);
  cloned.boardClaims[0].path = 'evidence/private/boards/forged.rgba';
  assert.throws(
    () => validateWith(cloned),
    (error) => evaluatorCode(error, 'ALIAS_SCORE_EVIDENCE_CUSTODY_PROOF_INVALID')
  );
  assert.throws(
    () => validateWith(new Proxy(fixture.evidenceCustodyProof, {})),
    (error) => evaluatorCode(error, 'ALIAS_SCORE_EVIDENCE_CUSTODY_PROOF_INVALID')
  );
  let accessorReads = 0;
  const accessorProof = {};
  Object.defineProperty(accessorProof, 'boardClaims', {
    enumerable: true,
    get() {
      accessorReads += 1;
      return fixture.evidenceCustodyProof.boardClaims;
    }
  });
  assert.throws(
    () => validateWith(accessorProof),
    (error) => evaluatorCode(error, 'ALIAS_SCORE_EVIDENCE_CUSTODY_PROOF_INVALID')
  );
  assert.equal(accessorReads, 0);
  const typedArrayProof = new Uint8Array(0);
  typedArrayProof.boardClaims = fixture.evidenceCustodyProof.boardClaims;
  assert.throws(
    () => validateWith(typedArrayProof),
    (error) => evaluatorCode(error, 'ALIAS_SCORE_EVIDENCE_CUSTODY_PROOF_INVALID')
  );
  assert.throws(
    () => validateWith(new Map(fixture.evidenceCustodyProof.boardClaims.map((board) => [board.boardID, board]))),
    (error) => evaluatorCode(error, 'ALIAS_SCORE_EVIDENCE_CUSTODY_PROOF_INVALID')
  );

  const originalWeakSetHas = WeakSet.prototype.has;
  const originalWeakMapGet = WeakMap.prototype.get;
  let poisonedWeakSetHasCalls = 0;
  let poisonedWeakMapGetCalls = 0;
  let poisonedError = null;
  try {
    WeakSet.prototype.has = () => {
      poisonedWeakSetHasCalls += 1;
      return true;
    };
    WeakMap.prototype.get = () => {
      poisonedWeakMapGetCalls += 1;
      return {
        evidenceManifestSha256: cloned.evidenceManifestSha256,
        blindOrderManifestSha256: cloned.blindOrderManifestSha256,
        boardClaims: cloned.boardClaims
      };
    };
    try { validateWith(cloned); } catch (error) { poisonedError = error; }
  } finally {
    WeakSet.prototype.has = originalWeakSetHas;
    WeakMap.prototype.get = originalWeakMapGet;
  }
  assert.ok(evaluatorCode(poisonedError, 'ALIAS_SCORE_EVIDENCE_CUSTODY_PROOF_INVALID'));
  assert.equal(poisonedWeakSetHasCalls, 0);
  assert.equal(poisonedWeakMapGetCalls, 0);
});

test('custody-proof minting resists post-import WeakSet, WeakMap, and freeze poisoning', () => {
  const source = evidenceManifestFixture();
  const originalWeakSetAdd = WeakSet.prototype.add;
  const originalWeakSetHas = WeakSet.prototype.has;
  const originalWeakMapSet = WeakMap.prototype.set;
  const originalWeakMapGet = WeakMap.prototype.get;
  const originalFreeze = Object.freeze;
  let leakedWeakSet = null;
  let leakedWeakMap = null;
  let proof = null;
  let mintError = null;
  try {
    WeakSet.prototype.add = function poisonedWeakSetAdd(value) {
      leakedWeakSet = this;
      return Reflect.apply(originalWeakSetAdd, this, [value]);
    };
    WeakSet.prototype.has = () => true;
    WeakMap.prototype.set = function poisonedWeakMapSet(key, value) {
      leakedWeakMap = this;
      return Reflect.apply(originalWeakMapSet, this, [key, value]);
    };
    WeakMap.prototype.get = () => ({ forged: true });
    Object.freeze = (value) => value;
    try {
      proof = createEvidenceCustodyProof(
        source,
        source.custodyBytesByPath,
        source.blindOrderManifest,
        source.blindOrderManifest.presentationCommit,
        source.publicPackageReceipt
      );
    } catch (error) {
      mintError = error;
    }
  } finally {
    WeakSet.prototype.add = originalWeakSetAdd;
    WeakSet.prototype.has = originalWeakSetHas;
    WeakMap.prototype.set = originalWeakMapSet;
    WeakMap.prototype.get = originalWeakMapGet;
    Object.freeze = originalFreeze;
  }
  assert.ifError(mintError);
  assert.equal(leakedWeakSet, null);
  assert.equal(leakedWeakMap, null);
  assert.ok(Object.isFrozen(proof));
  assert.ok(Object.isFrozen(proof.boardClaims));
  assert.ok(proof.boardClaims.every(Object.isFrozen));
  assert.throws(() => { proof.boardClaims[0].sha256 = 'd'.repeat(64); }, TypeError);

  const fakeCustody = new Map();
  for (const [path, bytes] of source.custodyBytesByPath) {
    fakeCustody.set(path, {
      byteCount: bytes.byteLength,
      sha256: createHash('sha256').update(bytes).digest('hex')
    });
  }
  let fakeCustodyError = null;
  try {
    WeakSet.prototype.has = () => true;
    try {
      createEvidenceCustodyProof(
        source,
        fakeCustody,
        source.blindOrderManifest,
        source.blindOrderManifest.presentationCommit,
        source.publicPackageReceipt
      );
    } catch (error) {
      fakeCustodyError = error;
    }
  } finally {
    WeakSet.prototype.has = originalWeakSetHas;
  }
  assert.ok(evaluatorCode(fakeCustodyError, 'EVIDENCE_CUSTODY_BYTES_INVALID'));
});

test('evidence custody proof snapshots the exact manifest and binds its manifest and order hashes', () => {
  const fixture = aliasScoreFixture();
  const source = evidenceManifestFixture();
  const proof = createEvidenceCustodyProof(
    source,
    source.custodyBytesByPath,
    source.blindOrderManifest,
    source.blindOrderManifest.presentationCommit,
    source.publicPackageReceipt
  );
  assert.equal(
    proof.evidenceManifestSha256,
    createHash('sha256').update(Buffer.from(proof.evidenceManifestCanonicalJson, 'utf8')).digest('hex')
  );
  assert.equal(proof.evidenceManifestByteCount, Buffer.byteLength(proof.evidenceManifestCanonicalJson, 'utf8'));
  assert.ok(Object.isFrozen(proof));
  assert.ok(Object.isFrozen(proof.boardClaims));
  assert.ok(proof.boardClaims.every(Object.isFrozen));
  assert.deepEqual(
    proof.boardClaims,
    source.privateBoardHashes.map((board) => ({
      boardID: board.boardID,
      path: board.path,
      byteCount: board.byteCount,
      sha256: board.sha256,
      orderDigest: board.orderDigest,
      leftToken: board.leftToken,
      rightToken: board.rightToken
    }))
  );
  const originalBoard = { ...proof.boardClaims[0] };
  source.privateBoardHashes[0].sha256 = 'c'.repeat(64);
  source.privateBoardHashes[0].path = 'evidence/private/boards/post-proof-mutation.rgba';
  assert.deepEqual(proof.boardClaims[0], originalBoard);
  assert.throws(() => { proof.boardClaims[0].sha256 = 'd'.repeat(64); }, TypeError);

  const localScore = structuredClone(fixture);
  const localBindings = structuredClone(fixture.custodyBindings);
  localScore.evidenceManifestSha256 = proof.evidenceManifestSha256;
  localBindings.evidenceManifestSha256 = proof.evidenceManifestSha256;
  const boardsByID = new Map(proof.boardClaims.map((board) => [board.boardID, board]));
  aliasScoreBallots(localScore).forEach((ballot) => {
    ballot.boardSha256 = boardsByID.get(ballot.itemID).sha256;
  });
  assert.doesNotThrow(() => validateAliasOnlyScore(
    localScore,
    fixture.blindOrderManifest,
    fixture.blindOrderManifest.presentationCommit,
    localBindings,
    proof
  ));
  localScore.candidates[0].referenceBallots[0].boardSha256 = source.privateBoardHashes[0].sha256;
  assert.throws(
    () => validateAliasOnlyScore(
      localScore,
      fixture.blindOrderManifest,
      fixture.blindOrderManifest.presentationCommit,
      localBindings,
      proof
    ),
    (error) => evaluatorCode(error, 'ALIAS_SCORE_EVIDENCE_CUSTODY_BOARD_BINDING_MISMATCH')
  );
  assert.throws(
    () => validateAliasOnlyScore(
      fixture,
      fixture.blindOrderManifest,
      fixture.blindOrderManifest.presentationCommit,
      fixture.custodyBindings,
      proof
    ),
    (error) => evaluatorCode(error, 'ALIAS_SCORE_EVIDENCE_CUSTODY_MANIFEST_MISMATCH')
  );

  const otherOrderSource = evidenceManifestFixture();
  const otherOrder = buildBlindOrderManifest(Buffer.alloc(32, 0x22), otherOrderSource.aliases);
  otherOrderSource.privateBoardHashes.forEach((board, index) => {
    const bytes = otherOrderSource.custodyBytesByPath.get(board.path);
    otherOrderSource.custodyBytesByPath.delete(board.path);
    const order = otherOrder.ballots[index];
    board.boardID = order.itemID;
    board.orderDigest = order.orderDigest;
    board.leftToken = order.left;
    board.rightToken = order.right;
    board.path = privateBoardClaimPath(board);
    otherOrderSource.custodyBytesByPath.set(board.path, bytes);
  });
  otherOrderSource.blindOrderManifestSha256 = otherOrder.manifestSha256;
  const otherOrderProof = createEvidenceCustodyProof(
    otherOrderSource,
    otherOrderSource.custodyBytesByPath,
    otherOrder,
    otherOrder.presentationCommit,
    otherOrderSource.publicPackageReceipt
  );
  const otherOrderScore = structuredClone(fixture);
  const otherOrderBindings = structuredClone(fixture.custodyBindings);
  otherOrderScore.evidenceManifestSha256 = otherOrderProof.evidenceManifestSha256;
  otherOrderBindings.evidenceManifestSha256 = otherOrderProof.evidenceManifestSha256;
  assert.throws(
    () => validateAliasOnlyScore(
      otherOrderScore,
      fixture.blindOrderManifest,
      fixture.blindOrderManifest.presentationCommit,
      otherOrderBindings,
      otherOrderProof
    ),
    (error) => evaluatorCode(error, 'ALIAS_SCORE_EVIDENCE_CUSTODY_ORDER_MANIFEST_MISMATCH')
  );
});

test('section-11 exact tie selects the raw UTF-8 lower alias and rejects the critic reproducer', () => {
  const fixture = aliasScoreFixture();
  const tiedTamper = structuredClone(fixture);
  tiedTamper.strongerAlias = tiedTamper.candidates[1].alias;
  assert.throws(
    () => validateAliasScoreFixture(tiedTamper, fixture),
    (error) => evaluatorCode(error, 'ALIAS_SCORE_STRONGER_ALIAS_MISMATCH')
  );

  const allRejectedTie = structuredClone(fixture);
  allRejectedTie.candidates.forEach((candidate) => setAliasReferenceWins(candidate, 2));
  assertStrengthScenario(allRejectedTie, fixture, allRejectedTie.candidates[0].alias);

  const stateful = structuredClone(fixture);
  let reads = 0;
  Object.defineProperty(stateful, 'strongerAlias', {
    enumerable: true,
    configurable: true,
    get() {
      reads += 1;
      return reads === 1 ? stateful.candidates[0].alias : stateful.candidates[1].alias;
    }
  });
  const salt = Buffer.alloc(32, 0x67);
  assert.equal(
    aliasScoreCommit(
      stateful, salt, fixture.blindOrderManifest,
      fixture.blindOrderManifest.presentationCommit, fixture.custodyBindings, fixture.evidenceCustodyProof
    ),
    aliasScoreCommit(
      fixture, salt, fixture.blindOrderManifest,
      fixture.blindOrderManifest.presentationCommit, fixture.custodyBindings, fixture.evidenceCustodyProof
    )
  );
});

test('section-11 stronger checkpoint follows every immutable precedence tier', () => {
  const fixture = aliasScoreFixture();

  const accepted = structuredClone(fixture);
  const [acceptedLower, acceptedHigher] = accepted.candidates;
  acceptedLower.disqualifiers = ['Observable disqualifying failure.'];
  setAliasVisualScores(acceptedHigher, [10, 10, 10, 10, 10, 9, 9, 9, 9, 9]);
  setPairwiseWinners(accepted, [acceptedLower.alias, acceptedLower.alias, acceptedLower.alias]);
  assertStrengthScenario(accepted, fixture, acceptedHigher.alias);

  const gates = structuredClone(fixture);
  const [gatesLower, gatesHigher] = gates.candidates;
  gatesLower.gates.T8.pass = false;
  gatesLower.gates.T9.pass = false;
  gatesHigher.gates.T9.pass = false;
  setAliasReferenceWins(gatesHigher, 0);
  setAliasVisualScores(gatesHigher, Array(10).fill(0));
  setPairwiseWinners(gates, [gatesLower.alias, gatesLower.alias, gatesLower.alias]);
  assertStrengthScenario(gates, fixture, gatesHigher.alias);

  const reference = structuredClone(fixture);
  const [referenceLower, referenceHigher] = reference.candidates;
  setAliasReferenceWins(referenceLower, 1);
  setAliasReferenceWins(referenceHigher, 2);
  setAliasVisualScores(referenceHigher, Array(10).fill(0));
  setPairwiseWinners(reference, [referenceLower.alias, referenceLower.alias, referenceLower.alias]);
  assertStrengthScenario(reference, fixture, referenceHigher.alias);

  const visualTotal = structuredClone(fixture);
  const [totalLower, totalHigher] = visualTotal.candidates;
  setAliasVisualScores(totalLower, [10, 10, 10, 9, 9, 9, 9, 9, 9, 9]);
  setAliasVisualScores(totalHigher, [8, 10, 10, 10, 10, 10, 9, 9, 9, 9]);
  setPairwiseWinners(visualTotal, [totalLower.alias, totalLower.alias, totalLower.alias]);
  assertStrengthScenario(visualTotal, fixture, totalHigher.alias);

  const visualMinimum = structuredClone(fixture);
  const [minimumLower, minimumHigher] = visualMinimum.candidates;
  setAliasVisualScores(minimumLower, [8, 10, 10, 10, 10, 10, 9, 9, 9, 9]);
  setAliasVisualScores(minimumHigher, [10, 10, 10, 10, 9, 9, 9, 9, 9, 9]);
  setPairwiseWinners(visualMinimum, [minimumLower.alias, minimumLower.alias, minimumLower.alias]);
  assertStrengthScenario(visualMinimum, fixture, minimumHigher.alias);

  const pairwise = structuredClone(fixture);
  const [pairwiseLower, pairwiseHigher] = pairwise.candidates;
  pairwise.candidates.forEach((candidate) => setAliasReferenceWins(candidate, 2));
  setPairwiseWinners(pairwise, [pairwiseHigher.alias, pairwiseHigher.alias, pairwiseLower.alias]);
  assertStrengthScenario(pairwise, fixture, pairwiseHigher.alias);

  const bothAccepted = structuredClone(fixture);
  const [bothAcceptedLower, bothAcceptedHigher] = bothAccepted.candidates;
  setAliasVisualScores(bothAcceptedLower, [10, 10, 10, 10, 10, 9, 9, 9, 9, 9]);
  setPairwiseWinners(bothAccepted, [bothAcceptedLower.alias, bothAcceptedLower.alias, bothAcceptedLower.alias]);
  assertStrengthScenario(bothAccepted, fixture, bothAcceptedHigher.alias);
});

test('alias score rejects self-asserted summaries, invalid pending states, and ballot ambiguity', () => {
  const fixture = aliasScoreFixture();
  const rejects = (mutate, code) => {
    const document = structuredClone(fixture);
    mutate(document);
    assert.throws(
      () => validateAliasScoreFixture(document, fixture),
      (error) => evaluatorCode(error, code)
    );
  };

  rejects((document) => { document.candidates.reverse(); }, 'ALIAS_SCORE_CANDIDATE_ORDER_INVALID');
  rejects((document) => { document.pairwiseBallots.pop(); }, 'ALIAS_SCORE_PAIRWISE_BALLOT_COUNT_INVALID');
  rejects((document) => { document.pairwiseBallots[0].winner = 'TIE'; }, 'ALIAS_SCORE_BALLOT_OUTCOME_INVALID');
  rejects((document) => { document.pairwiseBallots[0].castCount = 2; }, 'ALIAS_SCORE_BALLOT_OUTCOME_INVALID');
  rejects((document) => {
    document.pairwiseBallots[1] = structuredClone(document.pairwiseBallots[0]);
  }, 'ALIAS_SCORE_BALLOT_ID_MISMATCH');
  rejects((document) => {
    document.candidates[0].referenceBallots[0].winner = null;
  }, 'ALIAS_SCORE_REFERENCE_WIN_COUNT_MISMATCH');
  rejects((document) => { document.candidates[0].referenceWinCount = 2; }, 'ALIAS_SCORE_REFERENCE_WIN_COUNT_MISMATCH');
  rejects((document) => { document.candidates[0].visualTotal = 99; }, 'ALIAS_SCORE_VISUAL_AGGREGATE_MISMATCH');
  rejects((document) => {
    document.candidates[0].acceptanceChecks.objectiveGates = false;
  }, 'ALIAS_SCORE_ACCEPTANCE_CHECK_MISMATCH');
  rejects((document) => { document.candidates[0].provisionallyAccepted = false; }, 'ALIAS_SCORE_PROVISIONAL_ACCEPTANCE_MISMATCH');
  rejects((document) => { document.provisionalOutcome = 'NO_ACCEPTED_CANDIDATE'; }, 'ALIAS_SCORE_OUTCOME_MISMATCH');
  rejects((document) => {
    document.candidates[0].gates.T1.pass = true;
  }, 'ALIAS_SCORE_PENDING_REVEAL_STATE_INVALID');
  rejects((document) => {
    document.candidates[0].gates.T10.pass = false;
  }, 'ALIAS_SCORE_PENDING_REVEAL_STATE_INVALID');
  rejects((document) => {
    document.candidates[0].gates.T11 = structuredClone(document.candidates[0].gates.T9);
  }, 'ALIAS_SCORE_GATE_SET_SHAPE_MISMATCH');
  rejects((document) => {
    document.pairwiseBallots[0].leftToken = 'candidate-2222222222222222';
    document.pairwiseBallots[0].winner = 'LEFT';
  }, 'ALIAS_SCORE_PAIRWISE_WINNER_ALIAS_INVALID');
  rejects((document) => {
    document.candidates[0].disqualifiers = ['Repeated failure.', 'Repeated failure.'];
    resummarizeAliasScore(document);
  }, 'ALIAS_SCORE_CANDIDATE_DISQUALIFIERS_DUPLICATE');
  rejects((document) => {
    document.disqualifiers = ['Repeated round failure.', 'Repeated round failure.'];
  }, 'ALIAS_SCORE_DISQUALIFIERS_DUPLICATE');
});

function evidenceManifestFixture() {
  const aliases = ['candidate-1111111111111111', 'candidate-eeeeeeeeeeeeeeee'];
  const traceIDs = [
    'MOUSE2_TAP_COLD_1', 'MOUSE2_TAP_COLD_2', 'MOUSE2_TAP_RESET', 'KEYK_TAP',
    'MOUSE2_HELD', 'NO_HEAVY', 'LIGHT_BASELINE', 'SHIFT_PLUS_7', 'CAPTURE_UNARMED',
    'HIT_OFFSET_0', 'HIT_OFFSET_1', 'HIT_OFFSET_2', 'MISS_OFFSET_POSITIVE', 'MISS_OFFSET_NEGATIVE'
  ];
  const digest = 'b'.repeat(64);
  const captureRuns = aliases.flatMap((alias) => traceIDs.map((traceID) => ({
    alias,
    runProfileID: `${alias}-${traceID}`,
    traceID,
    inputTraceDigest: digest,
    terminalTick: traceID === 'SHIFT_PLUS_7' ? 87 : 80
  })));
  const artifacts = [];
  const custodyBytesByPath = new Map();
  let serial = 0;
  const add = (run, kind, ticks) => {
    const heavyEdge = run.traceID === 'SHIFT_PLUS_7' ? 31 : ['NO_HEAVY', 'LIGHT_BASELINE'].includes(run.traceID) ? null : 24;
    serial += 1;
    const bytes = Uint8Array.of(serial & 0xff);
    const artifact = {
      kind,
      byteCount: bytes.byteLength,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      alias: run.alias,
      packageArchiveSha256: digest,
      productionOutputTreeSha256: digest,
      route: '/game',
      runProfileID: run.runProfileID,
      absoluteTicks: ticks,
      heavyRelativeTicks: ticks.map((tick) => heavyEdge === null || tick < heavyEdge ? null : tick - heavyEdge),
      stateDigest: digest,
      cameraDigest: digest,
      inputTraceDigest: digest,
      evaluatorHelperDigest: digest,
      browser: 'Chromium 140',
      gpu: 'Apple M-series',
      captureTimestamp: '2026-08-03T00:00:00.000Z',
      sourceArtifactSha256s: [],
      derivation: 'Evaluator-owned exact production evidence.',
      custody: 'public'
    };
    artifact.path = evidenceArtifactClaimPath(artifact, run.traceID);
    artifacts.push(artifact);
    custodyBytesByPath.set(artifact.path, bytes);
  };
  for (const run of captureRuns) {
    for (const kind of ['state-log', 'event-log', 'geometry-log', 'frame-evidence', 'run-receipt']) add(run, kind, [0]);
    if (['MOUSE2_TAP_COLD_1', 'MOUSE2_TAP_COLD_2', 'MOUSE2_TAP_RESET'].includes(run.traceID)) {
      for (let tick = 20; tick <= 80; tick += 1) add(run, 'production-frame', [tick]);
      for (const tick of [44, 46, 58]) add(run, 'focused-frame', [tick]);
      for (const [first, last] of [[40, 46], [44, 48], [46, 76]]) {
        add(run, 'full-frame-strip', Array.from({ length: last - first + 1 }, (_, index) => first + index));
      }
      add(run, 'contact-roi', [46]);
      for (const tick of [44, 46, 58]) add(run, 'action-crop', [tick]);
      add(run, 'lossless-frame-sequence', Array.from({ length: 81 }, (_, tick) => tick));
    }
  }
  const order = buildBlindOrderManifest(Buffer.alloc(32, 0x11), aliases);
  const boardBytes = new Uint8Array(1600 * 900 * 4).fill(0x42);
  const boardSha256 = createHash('sha256').update(boardBytes).digest('hex');
  const privateBoardHashes = order.ballots.map((ballot) => {
    const board = {
      boardID: ballot.itemID,
      byteCount: boardBytes.byteLength,
      sha256: boardSha256,
      orderDigest: ballot.orderDigest,
      leftToken: ballot.left,
      rightToken: ballot.right,
      leftSourceSha256: digest,
      rightSourceSha256: digest,
      compositorHelperSha256: digest
    };
    board.path = privateBoardClaimPath(board);
    custodyBytesByPath.set(board.path, boardBytes);
    return board;
  });
  const document = {
    schema: 'p30.r012a.evidence-manifest.v1',
    protocolID: PROTOCOL_ID,
    aliases,
    evaluatorHelperSha256: digest,
    blindOrderManifestSha256: order.manifestSha256,
    captureRuns,
    artifacts,
    privateBoardHashes
  };
  Object.defineProperty(document, 'blindOrderManifest', { value: order, enumerable: false });
  Object.defineProperty(document, 'publicPackageReceipt', {
    value: {
      schema: 'p30.r012a.public-package-receipt.v1',
      protocolID: PROTOCOL_ID,
      packages: aliases.map((alias) => ({
        alias,
        packageArchiveSha256: digest,
        packageArchiveBytes: 1,
        materializedPackageTreeSha256: digest,
        productionOutputTreeSha256: digest,
        criticInterfaceSha256: digest
      }))
    },
    enumerable: false
  });
  Object.defineProperty(document, 'custodyBytesByPath', { value: custodyBytesByPath, enumerable: false });
  return document;
}

test('evidence custody requires every trace, canonical tick 20-80 frames, strips, crops, ROI, sequence, and nine private board hashes', () => {
  const fixture = evidenceManifestFixture();
  assert.doesNotThrow(() => validateEvidenceManifest(
    fixture, fixture.custodyBytesByPath, fixture.blindOrderManifest, fixture.blindOrderManifest.presentationCommit,
    fixture.publicPackageReceipt
  ));
  const missing = structuredClone(fixture);
  const index = missing.artifacts.findIndex((artifact) => artifact.kind === 'contact-roi');
  missing.artifacts.splice(index, 1);
  assert.throws(
    () => validateEvidenceManifest(
      missing, fixture.custodyBytesByPath, fixture.blindOrderManifest, fixture.blindOrderManifest.presentationCommit,
      fixture.publicPackageReceipt
    ),
    (error) => evaluatorCode(error, 'EVIDENCE_ARTIFACT_SET_CARDINALITY_INVALID')
  );
  const publicBoard = structuredClone(fixture);
  publicBoard.artifacts.push({ ...publicBoard.artifacts[0], path: 'public/board.bin', kind: 'blind-board' });
  assert.throws(
    () => validateEvidenceManifest(
      publicBoard, fixture.custodyBytesByPath, fixture.blindOrderManifest, fixture.blindOrderManifest.presentationCommit,
      fixture.publicPackageReceipt
    ),
    (error) => evaluatorCode(error, 'EVIDENCE_ARTIFACT_KIND_INVALID')
  );
});

function validateEvidenceFixture(document, custodyBytesByPath, fixture) {
  return validateEvidenceManifest(
    document,
    custodyBytesByPath,
    fixture.blindOrderManifest,
    fixture.blindOrderManifest.presentationCommit,
    fixture.publicPackageReceipt
  );
}

function assertEvidenceRejects(document, custodyBytesByPath, fixture, code) {
  assert.throws(
    () => validateEvidenceFixture(document, custodyBytesByPath, fixture),
    (error) => evaluatorCode(error, code)
  );
}

function replaceEvidenceArtifactClaim(document, custodyBytesByPath, artifactIndex, changes, bytes) {
  const artifact = document.artifacts[artifactIndex];
  custodyBytesByPath.delete(artifact.path);
  Object.assign(artifact, changes);
  artifact.byteCount = bytes.byteLength;
  artifact.sha256 = createHash('sha256').update(bytes).digest('hex');
  const run = document.captureRuns.find((entry) =>
    entry.alias === artifact.alias && entry.runProfileID === artifact.runProfileID
  );
  const heavyEdge = run.traceID === 'SHIFT_PLUS_7' ? 31 :
    ['NO_HEAVY', 'LIGHT_BASELINE'].includes(run.traceID) ? null : 24;
  artifact.heavyRelativeTicks = artifact.absoluteTicks.map((tick) =>
    heavyEdge === null || tick < heavyEdge ? null : tick - heavyEdge
  );
  artifact.path = evidenceArtifactClaimPath(artifact, run.traceID);
  custodyBytesByPath.set(artifact.path, bytes);
  return artifact;
}

function appendEvidenceArtifactClaim(document, custodyBytesByPath, templateIndex, changes, bytes) {
  const artifact = structuredClone(document.artifacts[templateIndex]);
  artifact.path = 'pending-artifact.bin';
  document.artifacts.push(artifact);
  return replaceEvidenceArtifactClaim(
    document,
    custodyBytesByPath,
    document.artifacts.length - 1,
    changes,
    bytes
  );
}

test('evidence custody rejects the one-byte-for-everything critic reproducer', () => {
  const fixture = evidenceManifestFixture();
  assert.equal(fixture.artifacts.length, 572);
  const shared = structuredClone(fixture);
  const sharedBytes = Uint8Array.of(0x41);
  const sharedSha256 = createHash('sha256').update(sharedBytes).digest('hex');
  for (const artifact of shared.artifacts) {
    artifact.path = 'one-byte-for-everything.bin';
    artifact.byteCount = sharedBytes.byteLength;
    artifact.sha256 = sharedSha256;
  }
  shared.privateBoardHashes = [];
  assertEvidenceRejects(
    shared,
    new Map([['one-byte-for-everything.bin', sharedBytes]]),
    fixture,
    'EVIDENCE_ARTIFACT_PATH_DUPLICATE'
  );
});

test('evidence custody rejects a fully declared and backed 582nd diagnostic artifact', () => {
  const fixture = evidenceManifestFixture();
  const expanded = structuredClone(fixture);
  const expandedBytes = new Map(fixture.custodyBytesByPath);
  appendEvidenceArtifactClaim(
    expanded,
    expandedBytes,
    0,
    { kind: 'diagnostic-mask', absoluteTicks: [1] },
    Uint8Array.of(0xde, 0xad, 0xbe, 0xef)
  );
  assert.equal(expanded.artifacts.length, 573);
  assert.equal(expandedBytes.size, 582);
  assertEvidenceRejects(
    expanded,
    expandedBytes,
    fixture,
    'EVIDENCE_ARTIFACT_CLAIM_UNEXPECTED'
  );
});

test('exact evidence matrix rejects per-run extras, reclassification, and alternative-slot duplication', () => {
  const fixture = evidenceManifestFixture();

  const perRunExtra = structuredClone(fixture);
  const perRunExtraBytes = new Map(fixture.custodyBytesByPath);
  const noncanonicalIndex = perRunExtra.artifacts.findIndex((artifact) =>
    artifact.runProfileID.endsWith('KEYK_TAP') && artifact.kind === 'event-log'
  );
  appendEvidenceArtifactClaim(
    perRunExtra,
    perRunExtraBytes,
    noncanonicalIndex,
    { absoluteTicks: [1] },
    Uint8Array.of(0x10, 0x11)
  );
  assertEvidenceRejects(
    perRunExtra,
    perRunExtraBytes,
    fixture,
    'EVIDENCE_ARTIFACT_CLAIM_UNEXPECTED'
  );

  const reclassified = structuredClone(fixture);
  const reclassifiedBytes = new Map(fixture.custodyBytesByPath);
  replaceEvidenceArtifactClaim(
    reclassified,
    reclassifiedBytes,
    0,
    { kind: 'diagnostic-mask' },
    Uint8Array.of(0x20, 0x21)
  );
  assert.equal(reclassified.artifacts.length, 572);
  assert.equal(reclassifiedBytes.size, 581);
  assertEvidenceRejects(
    reclassified,
    reclassifiedBytes,
    fixture,
    'EVIDENCE_ARTIFACT_CLAIM_UNEXPECTED'
  );

  const alternateOnly = structuredClone(fixture);
  const alternateOnlyBytes = new Map(fixture.custodyBytesByPath);
  const alternateOnlyIndex = alternateOnly.artifacts.findIndex((artifact) =>
    artifact.kind === 'lossless-frame-sequence'
  );
  replaceEvidenceArtifactClaim(
    alternateOnly,
    alternateOnlyBytes,
    alternateOnlyIndex,
    { kind: 'lossless-video' },
    Uint8Array.of(0x2a, 0x2b)
  );
  assert.doesNotThrow(() => validateEvidenceFixture(alternateOnly, alternateOnlyBytes, fixture));

  const alternateDuplicate = structuredClone(fixture);
  const alternateDuplicateBytes = new Map(fixture.custodyBytesByPath);
  const sequenceIndex = alternateDuplicate.artifacts.findIndex((artifact) =>
    artifact.kind === 'lossless-frame-sequence'
  );
  appendEvidenceArtifactClaim(
    alternateDuplicate,
    alternateDuplicateBytes,
    sequenceIndex,
    { kind: 'lossless-video' },
    Uint8Array.of(0x30, 0x31)
  );
  assertEvidenceRejects(
    alternateDuplicate,
    alternateDuplicateBytes,
    fixture,
    'EVIDENCE_ARTIFACT_SLOT_DUPLICATE'
  );
});

test('exact evidence matrix rejects missing-plus-extra substitution and cardinality-preserving swaps', () => {
  const fixture = evidenceManifestFixture();

  const substituted = structuredClone(fixture);
  const substitutedBytes = new Map(fixture.custodyBytesByPath);
  const missingIndex = substituted.artifacts.findIndex((artifact) => artifact.kind === 'contact-roi');
  substitutedBytes.delete(substituted.artifacts[missingIndex].path);
  substituted.artifacts.splice(missingIndex, 1);
  appendEvidenceArtifactClaim(
    substituted,
    substitutedBytes,
    0,
    { kind: 'diagnostic-mask', absoluteTicks: [2] },
    Uint8Array.of(0x40, 0x41)
  );
  assert.equal(substituted.artifacts.length, 572);
  assert.equal(substitutedBytes.size, 581);
  assertEvidenceRejects(
    substituted,
    substitutedBytes,
    fixture,
    'EVIDENCE_ARTIFACT_CLAIM_UNEXPECTED'
  );

  const swapped = structuredClone(fixture);
  const swappedBytes = new Map(fixture.custodyBytesByPath);
  const frameIndex = swapped.artifacts.findIndex((artifact) =>
    artifact.kind === 'production-frame' && artifact.absoluteTicks[0] === 20
  );
  replaceEvidenceArtifactClaim(
    swapped,
    swappedBytes,
    frameIndex,
    { absoluteTicks: [19] },
    Uint8Array.of(0x50, 0x51)
  );
  assert.equal(swapped.artifacts.length, 572);
  assert.equal(swappedBytes.size, 581);
  assertEvidenceRejects(
    swapped,
    swappedBytes,
    fixture,
    'EVIDENCE_ARTIFACT_CLAIM_UNEXPECTED'
  );
});

test('evidence custody requires unique normalized paths while allowing equal bytes in separately declared files', () => {
  const fixture = evidenceManifestFixture();
  const artifactPaths = fixture.artifacts.map((artifact) => artifact.path);
  const artifactHashes = fixture.artifacts.map((artifact) => artifact.sha256);
  assert.equal(new Set(artifactPaths).size, 572);
  assert.ok(new Set(artifactHashes).size < artifactHashes.length);
  assert.equal(fixture.custodyBytesByPath.size, 581);
  assert.doesNotThrow(() => validateEvidenceFixture(fixture, fixture.custodyBytesByPath, fixture));

  const claimCaseCollision = structuredClone(fixture);
  claimCaseCollision.artifacts[1].path = claimCaseCollision.artifacts[0].path.toUpperCase();
  assertEvidenceRejects(
    claimCaseCollision,
    fixture.custodyBytesByPath,
    fixture,
    'EVIDENCE_ARTIFACT_PATH_COLLISION'
  );

  const suppliedCaseCollision = new Map(fixture.custodyBytesByPath);
  const [firstPath, firstBytes] = suppliedCaseCollision.entries().next().value;
  suppliedCaseCollision.set(firstPath.toUpperCase(), firstBytes);
  assertEvidenceRejects(
    fixture,
    suppliedCaseCollision,
    fixture,
    'EVIDENCE_CUSTODY_PATH_COLLISION'
  );
});

test('evidence custody snapshots stateful path accessors before validation', () => {
  const fixture = evidenceManifestFixture();
  const stateful = structuredClone(fixture);
  stateful.artifacts.forEach((artifact) => {
    const declaredPath = artifact.path;
    let reads = 0;
    Object.defineProperty(artifact, 'path', {
      enumerable: true,
      configurable: true,
      get() {
        reads += 1;
        return reads <= 5 ? declaredPath : 'collapsed.bin';
      }
    });
  });
  const collapsedBytes = new Map([[
    'collapsed.bin',
    fixture.custodyBytesByPath.get(fixture.artifacts.at(-1).path)
  ]]);
  for (const board of fixture.privateBoardHashes) {
    collapsedBytes.set(board.path, fixture.custodyBytesByPath.get(board.path));
  }
  assertEvidenceRejects(
    stateful,
    collapsedBytes,
    fixture,
    'EVIDENCE_UNDECLARED_BYTES'
  );
});

test('evidence custody rejects missing and undeclared artifact or private-board bytes', () => {
  const fixture = evidenceManifestFixture();

  const noCustody = null;
  assertEvidenceRejects(fixture, noCustody, fixture, 'EVIDENCE_CUSTODY_BYTES_REQUIRED');

  const missingArtifact = new Map(fixture.custodyBytesByPath);
  missingArtifact.delete(fixture.artifacts[0].path);
  assertEvidenceRejects(fixture, missingArtifact, fixture, 'EVIDENCE_ARTIFACT_BYTES_MISSING');

  const missingBoard = new Map(fixture.custodyBytesByPath);
  missingBoard.delete(fixture.privateBoardHashes[0].path);
  assertEvidenceRejects(fixture, missingBoard, fixture, 'EVIDENCE_PRIVATE_BOARD_BYTES_MISSING');

  const undeclared = new Map(fixture.custodyBytesByPath);
  undeclared.set('evidence/private/boards/UNDECLARED/payload.rgba', Uint8Array.of(0x7f));
  assertEvidenceRejects(fixture, undeclared, fixture, 'EVIDENCE_UNDECLARED_BYTES');

  const extraBoardLikeFile = new Map(fixture.custodyBytesByPath);
  extraBoardLikeFile.set(
    `evidence/private/boards/P1/${'a'.repeat(64)}-${'b'.repeat(64)}.rgba`,
    Uint8Array.of(0x6f)
  );
  assertEvidenceRejects(fixture, extraBoardLikeFile, fixture, 'EVIDENCE_UNDECLARED_BYTES');

  const forgedProof = new Map(fixture.custodyBytesByPath);
  forgedProof.set(fixture.artifacts[0].path, new Proxy({}, {
    get: (_target, key) => typeof key === 'symbol' ? true :
      key === 'byteCount' ? fixture.artifacts[0].byteCount :
      key === 'sha256' ? fixture.artifacts[0].sha256 : undefined
  }));
  assertEvidenceRejects(fixture, forgedProof, fixture, 'EVIDENCE_CUSTODY_BYTES_INVALID');

  const missingBoardRecord = structuredClone(fixture);
  missingBoardRecord.privateBoardHashes.pop();
  assertEvidenceRejects(
    missingBoardRecord,
    fixture.custodyBytesByPath,
    fixture,
    'EVIDENCE_PRIVATE_BOARD_COUNT_INVALID'
  );

  const extraBoardRecord = structuredClone(fixture);
  extraBoardRecord.privateBoardHashes.push(structuredClone(extraBoardRecord.privateBoardHashes[0]));
  assertEvidenceRejects(
    extraBoardRecord,
    fixture.custodyBytesByPath,
    fixture,
    'EVIDENCE_PRIVATE_BOARD_COUNT_INVALID'
  );
});

test('evidence custody binds every private board ID, path, hash, token order, and exact bytes', () => {
  const fixture = evidenceManifestFixture();

  const swappedPaths = structuredClone(fixture);
  [swappedPaths.privateBoardHashes[0].path, swappedPaths.privateBoardHashes[1].path] =
    [swappedPaths.privateBoardHashes[1].path, swappedPaths.privateBoardHashes[0].path];
  assertEvidenceRejects(
    swappedPaths,
    fixture.custodyBytesByPath,
    fixture,
    'EVIDENCE_PRIVATE_BOARD_PATH_METADATA_MISMATCH'
  );

  const pairwiseIDSwap = structuredClone(fixture);
  const firstPairwise = pairwiseIDSwap.privateBoardHashes.findIndex((board) => board.boardID === 'P1');
  const secondPairwise = pairwiseIDSwap.privateBoardHashes.findIndex((board) => board.boardID === 'P2');
  [pairwiseIDSwap.privateBoardHashes[firstPairwise].boardID, pairwiseIDSwap.privateBoardHashes[secondPairwise].boardID] =
    [pairwiseIDSwap.privateBoardHashes[secondPairwise].boardID, pairwiseIDSwap.privateBoardHashes[firstPairwise].boardID];
  assertEvidenceRejects(
    pairwiseIDSwap,
    fixture.custodyBytesByPath,
    fixture,
    'EVIDENCE_PRIVATE_BOARD_PATH_METADATA_MISMATCH'
  );

  const changedHash = structuredClone(fixture);
  changedHash.privateBoardHashes[0].sha256 = 'a'.repeat(64);
  assertEvidenceRejects(
    changedHash,
    fixture.custodyBytesByPath,
    fixture,
    'EVIDENCE_PRIVATE_BOARD_PATH_METADATA_MISMATCH'
  );

  const changedSource = structuredClone(fixture);
  changedSource.privateBoardHashes[0].leftSourceSha256 = 'c'.repeat(64);
  assertEvidenceRejects(
    changedSource,
    fixture.custodyBytesByPath,
    fixture,
    'EVIDENCE_PRIVATE_BOARD_PATH_METADATA_MISMATCH'
  );

  const swappedOrder = structuredClone(fixture);
  [swappedOrder.privateBoardHashes[0], swappedOrder.privateBoardHashes[1]] =
    [swappedOrder.privateBoardHashes[1], swappedOrder.privateBoardHashes[0]];
  assertEvidenceRejects(
    swappedOrder,
    fixture.custodyBytesByPath,
    fixture,
    'EVIDENCE_PRIVATE_BOARD_ORDER_MISMATCH'
  );

  const wrongBoardBytes = new Map(fixture.custodyBytesByPath);
  wrongBoardBytes.set(fixture.privateBoardHashes[0].path, new Uint8Array(1600 * 900 * 4).fill(0x43));
  assertEvidenceRejects(
    fixture,
    wrongBoardBytes,
    fixture,
    'EVIDENCE_PRIVATE_BOARD_BYTES_MISMATCH'
  );

  class LyingByteLength extends Uint8Array {
    get byteLength() { return 1600 * 900 * 4; }
  }
  const zeroByteBoard = structuredClone(fixture);
  const zeroByteCustody = new Map(fixture.custodyBytesByPath);
  const zeroBoard = zeroByteBoard.privateBoardHashes[0];
  const oldPath = zeroBoard.path;
  const emptyBytes = new LyingByteLength(0);
  zeroBoard.sha256 = createHash('sha256').update(emptyBytes).digest('hex');
  zeroBoard.path = privateBoardClaimPath(zeroBoard);
  zeroByteCustody.delete(oldPath);
  zeroByteCustody.set(zeroBoard.path, emptyBytes);
  assertEvidenceRejects(
    zeroByteBoard,
    zeroByteCustody,
    fixture,
    'EVIDENCE_PRIVATE_BOARD_BYTES_MISMATCH'
  );
});

test('evidence custody binds alias, run, trace, tick, and kind metadata to each artifact path', () => {
  const fixture = evidenceManifestFixture();
  const sourceIndex = 0;
  const source = fixture.artifacts[sourceIndex];
  const sourceRun = fixture.captureRuns.find((run) =>
    run.alias === source.alias && run.runProfileID === source.runProfileID
  );
  const otherAlias = fixture.aliases.find((alias) => alias !== source.alias);
  const otherAliasRun = fixture.captureRuns.find((run) =>
    run.alias === otherAlias && run.traceID === sourceRun.traceID
  );

  const aliasCrossing = structuredClone(fixture);
  const counterpartIndex = aliasCrossing.artifacts.findIndex((artifact) =>
    artifact.alias === otherAlias && artifact.runProfileID === otherAliasRun.runProfileID &&
    artifact.kind === source.kind && artifact.absoluteTicks.length === 1 && artifact.absoluteTicks[0] === 0
  );
  aliasCrossing.artifacts.splice(counterpartIndex, 1);
  aliasCrossing.artifacts[sourceIndex].alias = otherAlias;
  aliasCrossing.artifacts[sourceIndex].runProfileID = otherAliasRun.runProfileID;
  assertEvidenceRejects(
    aliasCrossing,
    fixture.custodyBytesByPath,
    fixture,
    'EVIDENCE_ARTIFACT_PATH_METADATA_MISMATCH'
  );

  const otherRun = fixture.captureRuns.find((run) =>
    run.alias === source.alias && run.traceID !== sourceRun.traceID
  );
  const runCrossing = structuredClone(fixture);
  const otherRunCounterpart = runCrossing.artifacts.findIndex((artifact) =>
    artifact.alias === source.alias && artifact.runProfileID === otherRun.runProfileID &&
    artifact.kind === source.kind && artifact.absoluteTicks.length === 1 && artifact.absoluteTicks[0] === 0
  );
  runCrossing.artifacts.splice(otherRunCounterpart, 1);
  runCrossing.artifacts[sourceIndex].runProfileID = otherRun.runProfileID;
  assertEvidenceRejects(
    runCrossing,
    fixture.custodyBytesByPath,
    fixture,
    'EVIDENCE_ARTIFACT_PATH_METADATA_MISMATCH'
  );

  const tickCrossing = structuredClone(fixture);
  tickCrossing.artifacts[sourceIndex].absoluteTicks = [1];
  tickCrossing.artifacts[sourceIndex].heavyRelativeTicks = [null];
  assertEvidenceRejects(
    tickCrossing,
    fixture.custodyBytesByPath,
    fixture,
    'EVIDENCE_ARTIFACT_PATH_METADATA_MISMATCH'
  );

  const kindCrossing = structuredClone(fixture);
  kindCrossing.artifacts[sourceIndex].kind = 'diagnostic-mask';
  assertEvidenceRejects(
    kindCrossing,
    fixture.custodyBytesByPath,
    fixture,
    'EVIDENCE_ARTIFACT_PATH_METADATA_MISMATCH'
  );

  const duplicateClaim = structuredClone(fixture);
  const duplicate = structuredClone(duplicateClaim.artifacts[sourceIndex]);
  const duplicateBytes = Uint8Array.of(0x99, 0x98);
  duplicate.byteCount = duplicateBytes.byteLength;
  duplicate.sha256 = createHash('sha256').update(duplicateBytes).digest('hex');
  duplicate.path = evidenceArtifactClaimPath(duplicate, sourceRun.traceID);
  duplicateClaim.artifacts.push(duplicate);
  const duplicateClaimBytes = new Map(fixture.custodyBytesByPath);
  duplicateClaimBytes.set(duplicate.path, duplicateBytes);
  assertEvidenceRejects(
    duplicateClaim,
    duplicateClaimBytes,
    fixture,
    'EVIDENCE_ARTIFACT_CLAIM_DUPLICATE'
  );
});

test('filesystem evidence verification requires the exact declared file set', async (context) => {
  const fixture = evidenceManifestFixture();
  const evidenceRoot = await mkdtemp(join(tmpdir(), 'p30-r012-evidence-'));
  context.after(() => rm(evidenceRoot, { recursive: true, force: true }));
  for (const [path, bytes] of fixture.custodyBytesByPath) {
    const absolute = join(evidenceRoot, path);
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, bytes);
  }
  const originalWeakSetAdd = WeakSet.prototype.add;
  let poisonedWeakSetAddCalls = 0;
  let verified;
  try {
    WeakSet.prototype.add = function poisonedWeakSetAdd(value) {
      poisonedWeakSetAddCalls += 1;
      return Reflect.apply(originalWeakSetAdd, this, [value]);
    };
    verified = await verifyEvidenceManifestFiles(
      fixture,
      evidenceRoot,
      fixture.blindOrderManifest,
      fixture.blindOrderManifest.presentationCommit,
      fixture.publicPackageReceipt
    );
  } finally {
    WeakSet.prototype.add = originalWeakSetAdd;
  }
  assert.equal(poisonedWeakSetAddCalls, 0);
  assert.equal(verified.evidenceFilesVerified, 581);
  assert.equal(verified.privateBoardFilesVerified, 9);
  assert.match(verified.evidenceTreeSha256, /^[0-9a-f]{64}$/u);
  assert.equal(verified.evidenceCustodyProof.boardClaims.length, 9);
  assert.equal(
    verified.evidenceCustodyProof.evidenceManifestSha256,
    createHash('sha256')
      .update(Buffer.from(verified.evidenceCustodyProof.evidenceManifestCanonicalJson, 'utf8'))
      .digest('hex')
  );

  const expanded = structuredClone(fixture);
  const expandedBytes = new Map(fixture.custodyBytesByPath);
  const extraBytes = Uint8Array.of(0xde, 0xad, 0xbe, 0xef);
  const extraArtifact = appendEvidenceArtifactClaim(
    expanded,
    expandedBytes,
    0,
    { kind: 'diagnostic-mask', absoluteTicks: [1] },
    extraBytes
  );
  const extraAbsolute = join(evidenceRoot, extraArtifact.path);
  await mkdir(dirname(extraAbsolute), { recursive: true });
  await writeFile(extraAbsolute, extraBytes);
  assert.equal(expanded.artifacts.length + expanded.privateBoardHashes.length, 582);
  await assert.rejects(
    () => verifyEvidenceManifestFiles(
      expanded,
      evidenceRoot,
      fixture.blindOrderManifest,
      fixture.blindOrderManifest.presentationCommit,
      fixture.publicPackageReceipt
    ),
    (error) => evaluatorCode(error, 'EVIDENCE_ARTIFACT_CLAIM_UNEXPECTED')
  );
  await rm(extraAbsolute);

  await writeFile(join(evidenceRoot, 'undeclared.bin'), Uint8Array.of(0x01));
  await assert.rejects(
    () => verifyEvidenceManifestFiles(
      fixture,
      evidenceRoot,
      fixture.blindOrderManifest,
      fixture.blindOrderManifest.presentationCommit,
      fixture.publicPackageReceipt
    ),
    (error) => evaluatorCode(error, 'EVIDENCE_UNDECLARED_BYTES')
  );
});
