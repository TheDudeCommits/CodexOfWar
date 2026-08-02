import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BASELINE_RECEIPT_PATH,
  BASELINE_RECEIPT_SHA256,
  COUNTERFACTUAL_COMMIT_DOMAIN,
  EVALUATOR_HELPER_PATH,
  PRESENTATION_COMMIT_DOMAIN,
  PROTOCOL_AMENDMENT_PATH,
  PROTOCOL_AMENDMENT_SHA256,
  PROTOCOL_ID,
  PROTOCOL_PATH,
  PROTOCOL_PAYLOAD_SHA256,
  REFERENCE_ARCHIVE_SHA256,
  REFERENCE_COMMIT_DOMAIN,
  ROUND_COMMITMENT_SCHEMA,
  Round012EvaluatorError,
  TREE_DOMAIN,
  TREE_HELPER_PATH,
  analyzeMaskTopology,
  buildTargetCapsules,
  canonicalContactChecks,
  closestSegmentSegment,
  collectGeometrySource,
  counterfactualCommit,
  deriveExecutionOrder,
  deriveHitOffsetPairs,
  deriveHitOffsets,
  deriveMissOffsets,
  deriveTwoSideOrder,
  evaluateSweptContact,
  extractBladeCapsule,
  presentationCommit,
  rasterizeObjectMask,
  referenceCommit,
  roundHalfAwayFromZero,
  validateReferenceSelection,
  validateRoundCommitment,
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

test('live geometry-source collector uses rendered groups, deformed vertices, bones, and production camera refs', () => {
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
  const makeMesh = (uuid, vertices, parent, skinned = false) => ({
    isMesh: true,
    isSkinnedMesh: skinned,
    isInstancedMesh: false,
    uuid,
    visible: true,
    parent,
    layers: {},
    position: new Vector3(),
    matrixWorld: new Matrix4(),
    material: { visible: true, opacity: 1, side: 0 },
    geometry: {
      attributes: { position: { count: vertices.length } },
      groups: [],
      drawRange: { start: 0, count: vertices.length }
    },
    getVertexPosition(index, target) { target.set(...vertices[index]); }
  });
  const bone = (translation) => ({ matrixWorld: new Matrix4(translation) });
  const targetBoneNames = [
    'pelvis', 'neck', 'head',
    'leftShoulder', 'leftElbow', 'leftWrist',
    'rightShoulder', 'rightElbow', 'rightWrist',
    'leftHip', 'leftKnee', 'leftAnkle',
    'rightHip', 'rightKnee', 'rightAnkle'
  ];
  const targetLandmarkBones = Object.fromEntries(targetBoneNames.map((name, index) => [name, bone([2, -0.8 + index * 0.1, 0])]));
  const result = collectGeometrySource({
    scene,
    camera,
    heroRoot,
    leftHandBone: bone([-0.1, 0, 0]),
    rightHandBone: bone([-0.1, 0, 0]),
    swordBladePrimitives: [{
      mesh: makeMesh('blade', [[0, 0, 0], [1, 0.01, 0], [1, -0.01, 0]], heroRoot),
      materialGroupIndices: [0]
    }],
    targetRoot,
    targetSkinnedMeshes: [makeMesh('target', [[2, -0.9, 0], [2, 0.9, 0], [2, 0.9, 0.1]], targetRoot, true)],
    targetLandmarkBones,
    healthStore: {}
  });
  assert.equal(result.scene, scene);
  assert.equal(result.camera, camera);
  assert.ok(Math.abs(result.targetHeight - 1.8) < 1e-12);
  assert.equal(result.bladeTriangles.length, 1);
  assert.equal(result.targetTriangles.length, 1);
  assert.equal(result.targetCapsules.length, 10);
});

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
  assert.equal(canonicalContactChecks(result).pass, true);
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
