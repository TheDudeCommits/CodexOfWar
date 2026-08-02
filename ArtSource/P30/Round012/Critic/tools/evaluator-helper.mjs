#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { isAbsolute, relative, resolve, sep } from 'node:path';

import {
  Round012TreeError,
  assertExactKeys,
  canonicalBytes,
  compareUtf8,
  fileSha256,
  parseJsonStrict,
  readCanonicalFile,
  sha256Hex,
  u32be,
  u64be,
  utf8,
  validateRelativePath
} from './tree-helper.mjs';

export const PROTOCOL_ID = 'P30-R012A-BLIND-v1';
export const ROUND_COMMITMENT_SCHEMA = 'p30.r012a.round-commitment.v1';
export const PROTOCOL_PAYLOAD_SHA256 = '204678dff34363c4f408a750b662fc1ebf429b28ca13946283edde5180cc1577';
export const PROTOCOL_AMENDMENT_SHA256 = '140bfd83349860adc627b0359877e0c7d90d2823e35c414121dec0ab84221cf6';
export const BASELINE_RECEIPT_SHA256 = '9d3a1e3d6809ff18d445d0c6b69e16342e6f72d0e39c3ebb025c9d34535f7259';
export const REFERENCE_ARCHIVE_SHA256 = '4653a7a92d6f6bde910f39d3190df0adb112677851815443144505b8b420a6dd';

export const PROTOCOL_PATH = 'ArtSource/P30/Round012/LOCKED_PROTOCOL.md';
export const PROTOCOL_AMENDMENT_PATH = 'ArtSource/P30/Round012/PROTOCOL_AMENDMENT_01.md';
export const BASELINE_RECEIPT_PATH = 'ArtSource/P30/Round012/BASELINE_RECEIPT.json';
export const TREE_HELPER_PATH = 'ArtSource/P30/Round012/Critic/tools/tree-helper.mjs';
export const EVALUATOR_HELPER_PATH = 'ArtSource/P30/Round012/Critic/tools/evaluator-helper.mjs';

export const TREE_DOMAIN = 'P30R012A/package-tree/v1';
export const PRESENTATION_COMMIT_DOMAIN = 'P30R012A/presentation-seed/v1';
export const COUNTERFACTUAL_COMMIT_DOMAIN = 'P30R012A/counterfactual-seed/v1';
export const REFERENCE_COMMIT_DOMAIN = 'P30R012A/reference-selection/v1';
export const PRESENTATION_ORDER_DOMAIN = 'P30R012A/presentation-order/v1';
export const HIT_OFFSET_DOMAIN = 'P30R012A/hit-offset/v1';
export const MISS_OFFSET_PAD_DOMAIN = 'P30R012A/miss-offset-pad/v1';

export const EPS = 0.000001;
export const R_BLADE = 0.020000;
export const SUBSTEPS = 4096;
export const VIEWPORT_WIDTH = 1600;
export const VIEWPORT_HEIGHT = 900;
export const HEAVY_RISING_EDGE_ABSOLUTE_TICK = 24;
export const FOCUSED_CAPTURE_TICKS = Object.freeze([44, 46, 58]);

const HEX64 = /^[0-9a-f]{64}$/u;
const ALIAS = /^candidate-[0-9a-f]{16}$/u;
const PHASE_IDS = Object.freeze(['R1_ANTICIPATION', 'R2_CONTACT', 'R3_FOLLOW_THROUGH']);
const CAPSULE_SPECS = Object.freeze([
  ['head', 'neck', 'head', 0.080],
  ['torso', 'pelvis', 'neck', 0.115],
  ['left-upper-arm', 'leftShoulder', 'leftElbow', 0.050],
  ['left-forearm', 'leftElbow', 'leftWrist', 0.040],
  ['right-upper-arm', 'rightShoulder', 'rightElbow', 0.050],
  ['right-forearm', 'rightElbow', 'rightWrist', 0.040],
  ['left-thigh', 'leftHip', 'leftKnee', 0.060],
  ['left-shin', 'leftKnee', 'leftAnkle', 0.047],
  ['right-thigh', 'rightHip', 'rightKnee', 0.060],
  ['right-shin', 'rightKnee', 'rightAnkle', 0.047]
]);
const LANDMARK_KEYS = Object.freeze([
  'pelvis', 'neck', 'head',
  'leftShoulder', 'leftElbow', 'leftWrist',
  'rightShoulder', 'rightElbow', 'rightWrist',
  'leftHip', 'leftKnee', 'leftAnkle',
  'rightHip', 'rightKnee', 'rightAnkle'
]);

export const ROUND_COMMITMENT_KEYS = Object.freeze([
  'schema',
  'protocolID',
  'protocolPath',
  'protocolPayloadSha256',
  'protocolAmendmentPath',
  'protocolAmendmentSha256',
  'baselineReceiptPath',
  'baselineReceiptSha256',
  'presentationCommitDomain',
  'presentationCommit',
  'counterfactualCommitDomain',
  'counterfactualCommit',
  'referenceArchiveSha256',
  'referenceCommitDomain',
  'referenceCommit',
  'treeDomain',
  'treeHelperPath',
  'treeHelperSha256',
  'evaluatorHelperPath',
  'evaluatorHelperSha256',
  'criticCandidateAccess'
]);

export class Round012EvaluatorError extends Error {
  constructor(code) {
    super(code);
    this.name = 'Round012EvaluatorError';
    this.code = code;
  }
}

export function evaluatorFail(code) {
  throw new Round012EvaluatorError(code);
}

function assertHex64(value, code = 'INVALID_SHA256') {
  if (typeof value !== 'string' || !HEX64.test(value)) evaluatorFail(code);
}

function assertRaw32(value, code) {
  if (!Buffer.isBuffer(value) || value.length !== 32) evaluatorFail(code);
}

function framedHash(domain, parts) {
  const hash = createHash('sha256');
  hash.update(utf8(domain));
  hash.update(Buffer.from([0]));
  for (const part of parts) {
    if (!Buffer.isBuffer(part)) evaluatorFail('HASH_PART_NOT_BUFFER');
    hash.update(part);
  }
  return hash.digest();
}

export function presentationCommit(seed) {
  assertRaw32(seed, 'PRESENTATION_SEED_NOT_32_BYTES');
  return framedHash(PRESENTATION_COMMIT_DOMAIN, [seed]).toString('hex');
}

export function counterfactualCommit(seed) {
  assertRaw32(seed, 'COUNTERFACTUAL_SEED_NOT_32_BYTES');
  return framedHash(COUNTERFACTUAL_COMMIT_DOMAIN, [seed]).toString('hex');
}

export function saltedDocumentCommit(domain, document, salt) {
  assertRaw32(salt, 'DOCUMENT_SALT_NOT_32_BYTES');
  const body = canonicalBytes(document);
  return framedHash(domain, [u64be(body.length), body, Buffer.from([0]), salt]).toString('hex');
}

export function referenceCommit(selectionDocument, referenceSalt) {
  validateReferenceSelection(selectionDocument);
  return saltedDocumentCommit(REFERENCE_COMMIT_DOMAIN, selectionDocument, referenceSalt);
}

export function orderDigest(seed, itemID) {
  assertRaw32(seed, 'PRESENTATION_SEED_NOT_32_BYTES');
  if (typeof itemID !== 'string' || !itemID || itemID.normalize('NFC') !== itemID || itemID.includes('\0')) {
    evaluatorFail('INVALID_ORDER_ITEM_ID');
  }
  return framedHash(PRESENTATION_ORDER_DOMAIN, [seed, Buffer.from([0]), utf8(itemID)]);
}

function assertAlias(alias) {
  if (typeof alias !== 'string' || !ALIAS.test(alias)) evaluatorFail('INVALID_OPAQUE_ALIAS');
}

export function deriveExecutionOrder(seed, aliases) {
  assertRaw32(seed, 'PRESENTATION_SEED_NOT_32_BYTES');
  if (!Array.isArray(aliases) || aliases.length !== 2 || aliases[0] === aliases[1]) {
    evaluatorFail('EXACTLY_TWO_DISTINCT_ALIASES_REQUIRED');
  }
  aliases.forEach(assertAlias);
  return aliases.map((alias) => ({
    alias,
    orderDigest: orderDigest(seed, `execution/${alias}`).toString('hex')
  })).sort((left, right) => Buffer.compare(Buffer.from(left.orderDigest, 'hex'), Buffer.from(right.orderDigest, 'hex')));
}

export function deriveTwoSideOrder(seed, itemID, sideTokens) {
  if (!Array.isArray(sideTokens) || sideTokens.length !== 2 || sideTokens[0] === sideTokens[1]) {
    evaluatorFail('EXACTLY_TWO_DISTINCT_SIDE_TOKENS_REQUIRED');
  }
  for (const token of sideTokens) {
    if (typeof token !== 'string' || !token || token.normalize('NFC') !== token) evaluatorFail('INVALID_SIDE_TOKEN');
  }
  const lexical = [...sideTokens].sort(compareUtf8);
  const digest = orderDigest(seed, itemID);
  const flip = digest.at(-1) & 1;
  return {
    itemID,
    left: lexical[flip],
    right: lexical[1 - flip],
    orderDigest: digest.toString('hex')
  };
}

export function validateReferenceSelection(document) {
  try {
    assertExactKeys(
      document,
      ['schema', 'protocolID', 'referenceArchiveSha256', 'selections'],
      'REFERENCE_SELECTION_SHAPE_MISMATCH'
    );
  } catch (error) {
    if (error instanceof Round012TreeError) evaluatorFail(error.code);
    throw error;
  }
  if (
    document.schema !== 'p30.r012a.reference-selection.v1' ||
    document.protocolID !== PROTOCOL_ID ||
    document.referenceArchiveSha256 !== REFERENCE_ARCHIVE_SHA256
  ) {
    evaluatorFail('REFERENCE_SELECTION_CONSTANT_MISMATCH');
  }
  if (!Array.isArray(document.selections) || document.selections.length !== 3) {
    evaluatorFail('REFERENCE_SELECTION_COUNT_MISMATCH');
  }
  const entries = new Set();
  document.selections.forEach((selection, index) => {
    try {
      assertExactKeys(
        selection,
        [
          'phaseID',
          'sourceArchiveEntry',
          'sourceFileSha256',
          'originalDimensions',
          'cropRectangle',
          'uniformScaleAlgorithm',
          'phaseRationale'
        ],
        'REFERENCE_SELECTION_ENTRY_SHAPE_MISMATCH'
      );
      assertExactKeys(selection.originalDimensions, ['width', 'height'], 'REFERENCE_DIMENSION_SHAPE_MISMATCH');
      assertExactKeys(selection.cropRectangle, ['x', 'y', 'width', 'height'], 'REFERENCE_CROP_SHAPE_MISMATCH');
    } catch (error) {
      if (error instanceof Round012TreeError) evaluatorFail(error.code);
      throw error;
    }
    if (selection.phaseID !== PHASE_IDS[index]) evaluatorFail('REFERENCE_PHASE_ORDER_MISMATCH');
    try {
      validateRelativePath(selection.sourceArchiveEntry);
    } catch (error) {
      if (error instanceof Round012TreeError) evaluatorFail('REFERENCE_ARCHIVE_ENTRY_INVALID');
      throw error;
    }
    if (!selection.sourceArchiveEntry.startsWith('Reference/')) evaluatorFail('REFERENCE_ARCHIVE_ENTRY_INVALID');
    if (entries.has(selection.sourceArchiveEntry)) evaluatorFail('REFERENCE_ARCHIVE_ENTRY_DUPLICATE');
    entries.add(selection.sourceArchiveEntry);
    assertHex64(selection.sourceFileSha256, 'REFERENCE_FILE_SHA256_INVALID');
    const { width, height } = selection.originalDimensions;
    const crop = selection.cropRectangle;
    if (
      !Number.isSafeInteger(width) || width <= 0 ||
      !Number.isSafeInteger(height) || height <= 0 ||
      !Number.isSafeInteger(crop.x) || crop.x < 0 ||
      !Number.isSafeInteger(crop.y) || crop.y < 0 ||
      !Number.isSafeInteger(crop.width) || crop.width <= 0 ||
      !Number.isSafeInteger(crop.height) || crop.height <= 0 ||
      crop.x + crop.width > width || crop.y + crop.height > height
    ) {
      evaluatorFail('REFERENCE_CROP_OUT_OF_BOUNDS');
    }
    if (selection.uniformScaleAlgorithm !== 'lanczos3-uniform-fit-no-upscale-v1') {
      evaluatorFail('REFERENCE_SCALE_ALGORITHM_MISMATCH');
    }
    if (
      typeof selection.phaseRationale !== 'string' ||
      selection.phaseRationale.normalize('NFC') !== selection.phaseRationale ||
      selection.phaseRationale.length < 24
    ) {
      evaluatorFail('REFERENCE_PHASE_RATIONALE_INVALID');
    }
  });
  return document;
}

function publicArtifactLeakCheck(source) {
  const forbidden = [
    /candidate-[0-9a-f]{16}/iu,
    /(?:builder|author)[-_. /]?(?:a|b|slot)/iu,
    /refs\/heads\//iu,
    /codex\/p30-r012-/iu,
    /\/(?:Users|home|private\/tmp|tmp)\//u,
    /R[123]_(?:ANTICIPATION|CONTACT|FOLLOW_THROUGH)/u,
    /sourceArchiveEntry/u,
    /cropRectangle/u,
    /phaseRationale/u
  ];
  if (forbidden.some((pattern) => pattern.test(source))) evaluatorFail('PUBLIC_COMMITMENT_PRIVATE_OR_IDENTITY_LEAK');
}

export function validateRoundCommitment(value, source = null) {
  try {
    assertExactKeys(value, ROUND_COMMITMENT_KEYS, 'ROUND_COMMITMENT_SHAPE_MISMATCH');
  } catch (error) {
    if (error instanceof Round012TreeError) evaluatorFail(error.code);
    throw error;
  }
  const expected = {
    schema: ROUND_COMMITMENT_SCHEMA,
    protocolID: PROTOCOL_ID,
    protocolPath: PROTOCOL_PATH,
    protocolPayloadSha256: PROTOCOL_PAYLOAD_SHA256,
    protocolAmendmentPath: PROTOCOL_AMENDMENT_PATH,
    protocolAmendmentSha256: PROTOCOL_AMENDMENT_SHA256,
    baselineReceiptPath: BASELINE_RECEIPT_PATH,
    baselineReceiptSha256: BASELINE_RECEIPT_SHA256,
    presentationCommitDomain: PRESENTATION_COMMIT_DOMAIN,
    counterfactualCommitDomain: COUNTERFACTUAL_COMMIT_DOMAIN,
    referenceArchiveSha256: REFERENCE_ARCHIVE_SHA256,
    referenceCommitDomain: REFERENCE_COMMIT_DOMAIN,
    treeDomain: TREE_DOMAIN,
    treeHelperPath: TREE_HELPER_PATH,
    evaluatorHelperPath: EVALUATOR_HELPER_PATH,
    criticCandidateAccess: false
  };
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (value[key] !== expectedValue) evaluatorFail('ROUND_COMMITMENT_CONSTANT_MISMATCH');
  }
  for (const key of [
    'presentationCommit',
    'counterfactualCommit',
    'referenceCommit',
    'treeHelperSha256',
    'evaluatorHelperSha256'
  ]) assertHex64(value[key], 'ROUND_COMMITMENT_SHA256_INVALID');
  if (source !== null) publicArtifactLeakCheck(source);
  return value;
}

function inside(root, relativePath) {
  validateRelativePath(relativePath);
  const absolute = resolve(root, relativePath);
  let rel = relative(root, absolute);
  if (sep !== '/') rel = rel.split(sep).join('/');
  if (!rel || rel === '..' || rel.startsWith('../') || isAbsolute(rel)) evaluatorFail('REPOSITORY_PATH_ESCAPE');
  return absolute;
}

export async function verifyRoundCommitmentFiles(repositoryRoot, commitmentPath) {
  const root = resolve(repositoryRoot);
  const commitmentAbsolute = resolve(commitmentPath);
  const expectedCommitmentPath = resolve(root, 'ArtSource/P30/Round012/Critic/ROUND_COMMITMENT.json');
  if (commitmentAbsolute !== expectedCommitmentPath) evaluatorFail('ROUND_COMMITMENT_PATH_MISMATCH');
  const record = await readCanonicalFile(commitmentAbsolute);
  const commitment = validateRoundCommitment(record.value, record.source);
  const bindings = [
    [commitment.protocolPath, commitment.protocolPayloadSha256, 'PROTOCOL_FILE_HASH_MISMATCH'],
    [commitment.protocolAmendmentPath, commitment.protocolAmendmentSha256, 'AMENDMENT_FILE_HASH_MISMATCH'],
    [commitment.baselineReceiptPath, commitment.baselineReceiptSha256, 'BASELINE_RECEIPT_HASH_MISMATCH'],
    [commitment.treeHelperPath, commitment.treeHelperSha256, 'TREE_HELPER_HASH_MISMATCH'],
    [commitment.evaluatorHelperPath, commitment.evaluatorHelperSha256, 'EVALUATOR_HELPER_HASH_MISMATCH']
  ];
  for (const [path, expectedSha256, code] of bindings) {
    const actual = await fileSha256(inside(root, path));
    if (actual.sha256 !== expectedSha256) evaluatorFail(code);
  }
  const baselineRecord = await readCanonicalFile(inside(root, commitment.baselineReceiptPath));
  const baseline = baselineRecord.value;
  if (
    baseline.schema !== 'p30.r012a.baseline-receipt.v1' ||
    baseline.protocolID !== PROTOCOL_ID ||
    baseline.protocol?.rawFileSha256 !== commitment.protocolPayloadSha256 ||
    baseline.protocol?.amendmentRawFileSha256 !== commitment.protocolAmendmentSha256
  ) {
    evaluatorFail('BASELINE_PROTOCOL_BINDING_MISMATCH');
  }
  return {
    schema: 'p30.r012a.round-commitment-verification.v1',
    protocolID: PROTOCOL_ID,
    roundCommitmentSha256: sha256Hex(record.bytes),
    protocolVerified: true,
    amendmentVerified: true,
    baselineReceiptVerified: true,
    helperBytesVerified: true,
    criticCandidateAccess: false
  };
}

export async function readRaw32(path, code = 'SECRET_NOT_32_BYTES') {
  const bytes = await readFile(path);
  assertRaw32(bytes, code);
  return bytes;
}

function jpegDimensions(bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) evaluatorFail('REFERENCE_IMAGE_FORMAT_UNSUPPORTED');
  let cursor = 2;
  while (cursor + 4 <= bytes.length) {
    while (cursor < bytes.length && bytes[cursor] === 0xff) cursor += 1;
    if (cursor >= bytes.length) break;
    const marker = bytes[cursor];
    cursor += 1;
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (cursor + 2 > bytes.length) break;
    const length = bytes.readUInt16BE(cursor);
    if (length < 2 || cursor + length > bytes.length) evaluatorFail('REFERENCE_IMAGE_INVALID');
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      if (length < 7) evaluatorFail('REFERENCE_IMAGE_INVALID');
      return { height: bytes.readUInt16BE(cursor + 3), width: bytes.readUInt16BE(cursor + 5) };
    }
    cursor += length;
  }
  evaluatorFail('REFERENCE_IMAGE_DIMENSIONS_MISSING');
}

export async function verifyReferenceSelectionFiles(selectionDocument, extractedArchiveRoot) {
  validateReferenceSelection(selectionDocument);
  const root = resolve(extractedArchiveRoot);
  for (const selection of selectionDocument.selections) {
    const absolute = inside(root, selection.sourceArchiveEntry);
    const bytes = await readFile(absolute);
    if (sha256Hex(bytes) !== selection.sourceFileSha256) evaluatorFail('REFERENCE_FILE_HASH_MISMATCH');
    const dimensions = jpegDimensions(bytes);
    if (
      dimensions.width !== selection.originalDimensions.width ||
      dimensions.height !== selection.originalDimensions.height
    ) evaluatorFail('REFERENCE_IMAGE_DIMENSION_MISMATCH');
  }
  return { referenceSelectionFilesVerified: true, selectionCount: selectionDocument.selections.length };
}

export async function verifyPrivateCustody({
  commitment,
  presentationSeed,
  counterfactualSeed,
  selectionDocument,
  referenceSalt,
  referenceArchivePath,
  extractedArchiveRoot
}) {
  validateRoundCommitment(commitment);
  assertRaw32(presentationSeed, 'PRESENTATION_SEED_NOT_32_BYTES');
  assertRaw32(counterfactualSeed, 'COUNTERFACTUAL_SEED_NOT_32_BYTES');
  assertRaw32(referenceSalt, 'REFERENCE_SALT_NOT_32_BYTES');
  validateReferenceSelection(selectionDocument);
  if (presentationCommit(presentationSeed) !== commitment.presentationCommit) evaluatorFail('PRESENTATION_COMMIT_MISMATCH');
  if (counterfactualCommit(counterfactualSeed) !== commitment.counterfactualCommit) evaluatorFail('COUNTERFACTUAL_COMMIT_MISMATCH');
  if (referenceCommit(selectionDocument, referenceSalt) !== commitment.referenceCommit) {
    evaluatorFail('REFERENCE_COMMIT_MISMATCH');
  }
  const publicValues = new Set(Object.values(commitment));
  for (const secret of [presentationSeed, counterfactualSeed, referenceSalt]) {
    if (publicValues.has(secret.toString('hex'))) evaluatorFail('RAW_SECRET_LEAKED_IN_PUBLIC_COMMITMENT');
  }
  const archive = await fileSha256(referenceArchivePath);
  if (archive.sha256 !== commitment.referenceArchiveSha256) evaluatorFail('REFERENCE_ARCHIVE_HASH_MISMATCH');
  await verifyReferenceSelectionFiles(selectionDocument, extractedArchiveRoot);
  return {
    schema: 'p30.r012a.private-custody-verification.v1',
    presentationCommitVerified: true,
    counterfactualCommitVerified: true,
    referenceCommitVerified: true,
    referenceArchiveVerified: true,
    referenceSelectionFilesVerified: true,
    publicSecretLeakAbsent: true
  };
}

function assertFiniteNumber(value, code = 'NONFINITE_NUMBER') {
  if (typeof value !== 'number' || !Number.isFinite(value)) evaluatorFail(code);
  return value;
}

export function vec3(value, code = 'INVALID_VEC3') {
  if (!Array.isArray(value) || value.length !== 3) evaluatorFail(code);
  return value.map((component) => assertFiniteNumber(component, code));
}

function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function subtract(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function scale(a, factor) { return [a[0] * factor, a[1] * factor, a[2] * factor]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function lengthSquared(a) { return dot(a, a); }
function length(a) { return Math.sqrt(lengthSquared(a)); }
function lerp(a, b, t) { return add(a, scale(subtract(b, a), t)); }
function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, value)); }

export function cross(a, b) {
  vec3(a);
  vec3(b);
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

export function normalize(value, code = 'DEGENERATE_VECTOR') {
  const vector = vec3(value);
  const magnitude = length(vector);
  if (!Number.isFinite(magnitude) || magnitude < 1e-12) evaluatorFail(code);
  return scale(vector, 1 / magnitude);
}

export function roundHalfAwayFromZero(value) {
  assertFiniteNumber(value);
  const rounded = value >= 0 ? Math.floor(value + 0.5) : Math.ceil(value - 0.5);
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function quantizeMicrometres(value) {
  if (Array.isArray(value)) return vec3(value).map((component) => roundHalfAwayFromZero(component * 1_000_000));
  return roundHalfAwayFromZero(assertFiniteNumber(value) * 1_000_000);
}

export function ceilMicrometres(valueMetres) {
  const value = assertFiniteNumber(valueMetres);
  if (value < 0) evaluatorFail('NEGATIVE_CLEARANCE_MAGNITUDE');
  return Math.ceil(value * 1_000_000);
}

function unbiasedUint32(digest, cursorState, minimum, maximum) {
  if (!Buffer.isBuffer(digest) || digest.length !== 32) evaluatorFail('OFFSET_DIGEST_INVALID');
  if (!Number.isSafeInteger(minimum) || !Number.isSafeInteger(maximum) || minimum > maximum) {
    evaluatorFail('OFFSET_RANGE_INVALID');
  }
  const span = maximum - minimum + 1;
  const modulus = 0x1_0000_0000;
  const limit = Math.floor(modulus / span) * span;
  while (cursorState.offset + 4 <= digest.length) {
    const sample = digest.readUInt32BE(cursorState.offset);
    cursorState.offset += 4;
    if (sample < limit) return minimum + (sample % span);
  }
  evaluatorFail('OFFSET_REJECTION_EXHAUSTED');
}

export function deriveHitOffsetPairs(counterfactualSeed) {
  assertRaw32(counterfactualSeed, 'COUNTERFACTUAL_SEED_NOT_32_BYTES');
  return [0, 1, 2].map((index) => {
    const digest = framedHash(HIT_OFFSET_DOMAIN, [counterfactualSeed, u32be(index)]);
    const cursorState = { offset: 0 };
    return {
      index,
      inwardMicrometres: unbiasedUint32(digest, cursorState, 2000, 6000),
      tangentMicrometres: unbiasedUint32(digest, cursorState, 6000, 14000),
      tangentSign: index - 1,
      derivationDigest: digest.toString('hex')
    };
  });
}

export function canonicalBasis(heroRoot, targetRoot) {
  const hero = vec3(heroRoot);
  const target = vec3(targetRoot);
  const delta = subtract(target, hero);
  const horizontal = [delta[0], 0, delta[2]];
  if (length(horizontal) < 0.25) evaluatorFail('CANONICAL_BASIS_SEPARATION_TOO_SMALL');
  const up = [0, 1, 0];
  const forward = normalize(horizontal, 'CANONICAL_FORWARD_DEGENERATE');
  const right = normalize(cross(up, forward), 'CANONICAL_RIGHT_DEGENERATE');
  return { up, forward, right };
}

export function horizontalTangent(normal, canonicalRight) {
  const n = normalize(normal, 'CONTACT_NORMAL_DEGENERATE');
  const tangent = cross([0, 1, 0], n);
  if (length(tangent) < 1e-6) return normalize(canonicalRight, 'CANONICAL_RIGHT_DEGENERATE');
  return normalize(tangent, 'CONTACT_TANGENT_DEGENERATE');
}

function validateBasis(basis) {
  if (!basis || typeof basis !== 'object') evaluatorFail('INVALID_CANONICAL_BASIS');
  const right = normalize(basis.right, 'INVALID_CANONICAL_BASIS');
  const up = normalize(basis.up, 'INVALID_CANONICAL_BASIS');
  const forward = normalize(basis.forward, 'INVALID_CANONICAL_BASIS');
  if (Math.abs(dot(right, up)) > 1e-9 || Math.abs(dot(right, forward)) > 1e-9 || Math.abs(dot(up, forward)) > 1e-9) {
    evaluatorFail('NON_ORTHOGONAL_CANONICAL_BASIS');
  }
  return { right, up, forward };
}

export function deriveHitOffsets(counterfactualSeed, contactNormal, basis) {
  const canonical = validateBasis(basis);
  const normal = normalize(contactNormal, 'CONTACT_NORMAL_DEGENERATE');
  const tangent = horizontalTangent(normal, canonical.right);
  return deriveHitOffsetPairs(counterfactualSeed).map((pair) => {
    const worldMicrometres = add(
      scale(normal, pair.inwardMicrometres),
      scale(tangent, pair.tangentSign * pair.tangentMicrometres)
    );
    const canonicalMicrometres = [
      roundHalfAwayFromZero(dot(worldMicrometres, canonical.right)),
      roundHalfAwayFromZero(dot(worldMicrometres, canonical.up)),
      roundHalfAwayFromZero(dot(worldMicrometres, canonical.forward))
    ];
    return { ...pair, canonicalMicrometres };
  });
}

function missPad(counterfactualSeed, index) {
  const digest = framedHash(MISS_OFFSET_PAD_DOMAIN, [counterfactualSeed, u32be(index)]);
  return {
    padMicrometres: unbiasedUint32(digest, { offset: 0 }, 0, 20000),
    derivationDigest: digest.toString('hex')
  };
}

export function deriveMissOffsets(counterfactualSeed, extrema) {
  assertRaw32(counterfactualSeed, 'COUNTERFACTUAL_SEED_NOT_32_BYTES');
  for (const key of ['Bmin', 'Bmax', 'Tmin', 'Tmax']) assertFiniteNumber(extrema?.[key], 'MISS_EXTREMA_INVALID');
  if (extrema.Bmin > extrema.Bmax || extrema.Tmin > extrema.Tmax) evaluatorFail('MISS_EXTREMA_INVALID');
  const positiveBase = ceilMicrometres(Math.max(0, extrema.Bmax - extrema.Tmin + 0.250000));
  const negativeBase = ceilMicrometres(Math.max(0, extrema.Tmax - extrema.Bmin + 0.250000));
  const positivePad = missPad(counterfactualSeed, 0);
  const negativePad = missPad(counterfactualSeed, 1);
  const positive = positiveBase + positivePad.padMicrometres;
  const negative = negativeBase + negativePad.padMicrometres;
  if (positive > 2_000_000 || negative > 2_000_000) evaluatorFail('MISS_OFFSET_EXCEEDS_FIXTURE_BOUND');
  return [
    {
      direction: 'positive-right',
      canonicalMicrometres: [positive, 0, 0],
      baseMicrometres: positiveBase,
      ...positivePad
    },
    {
      direction: 'negative-right',
      canonicalMicrometres: [-negative, 0, 0],
      baseMicrometres: negativeBase,
      ...negativePad
    }
  ];
}

export function closestSegmentSegment(p1Value, q1Value, p2Value, q2Value) {
  const p1 = vec3(p1Value);
  const q1 = vec3(q1Value);
  const p2 = vec3(p2Value);
  const q2 = vec3(q2Value);
  const d1 = subtract(q1, p1);
  const d2 = subtract(q2, p2);
  const r = subtract(p1, p2);
  const a = dot(d1, d1);
  const e = dot(d2, d2);
  const f = dot(d2, r);
  const zero = 1e-24;
  let s;
  let t;
  if (a <= zero && e <= zero) {
    s = 0;
    t = 0;
  } else if (a <= zero) {
    s = 0;
    t = clamp(f / e, 0, 1);
  } else {
    const c = dot(d1, r);
    if (e <= zero) {
      t = 0;
      s = clamp(-c / a, 0, 1);
    } else {
      const b = dot(d1, d2);
      const denominator = a * e - b * b;
      s = Math.abs(denominator) > zero ? clamp((b * f - c * e) / denominator, 0, 1) : 0;
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = clamp(-c / a, 0, 1);
      } else if (t > 1) {
        t = 1;
        s = clamp((b - c) / a, 0, 1);
      }
    }
  }
  const point1 = add(p1, scale(d1, s));
  const point2 = add(p2, scale(d2, t));
  const distanceSquared = lengthSquared(subtract(point1, point2));
  if (!Number.isFinite(distanceSquared) || distanceSquared < 0) evaluatorFail('SEGMENT_DISTANCE_NUMERIC_FAILURE');
  return { s, t, point1, point2, distance: Math.sqrt(distanceSquared) };
}

function jacobiEigenSymmetric3(covariance) {
  const matrix = covariance.map((row) => [...row]);
  const eigenvectors = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const pivots = [[0, 1], [0, 2], [1, 2]];
  for (let sweep = 0; sweep < 64; sweep += 1) {
    for (const [p, q] of pivots) {
      const apq = matrix[p][q];
      if (apq === 0) continue;
      const tau = (matrix[q][q] - matrix[p][p]) / (2 * apq);
      const sign = tau < 0 ? -1 : 1;
      const tangent = sign / (Math.abs(tau) + Math.sqrt(1 + tau * tau));
      const cosine = 1 / Math.sqrt(1 + tangent * tangent);
      const sine = tangent * cosine;
      const app = matrix[p][p];
      const aqq = matrix[q][q];
      matrix[p][p] = app - tangent * apq;
      matrix[q][q] = aqq + tangent * apq;
      matrix[p][q] = 0;
      matrix[q][p] = 0;
      for (let k = 0; k < 3; k += 1) {
        if (k === p || k === q) continue;
        const akp = matrix[k][p];
        const akq = matrix[k][q];
        matrix[k][p] = cosine * akp - sine * akq;
        matrix[p][k] = matrix[k][p];
        matrix[k][q] = sine * akp + cosine * akq;
        matrix[q][k] = matrix[k][q];
      }
      for (let k = 0; k < 3; k += 1) {
        const vkp = eigenvectors[k][p];
        const vkq = eigenvectors[k][q];
        eigenvectors[k][p] = cosine * vkp - sine * vkq;
        eigenvectors[k][q] = sine * vkp + cosine * vkq;
      }
    }
  }
  const values = [matrix[0][0], matrix[1][1], matrix[2][2]];
  if (values.some((value) => !Number.isFinite(value))) evaluatorFail('BLADE_EIGEN_NUMERIC_FAILURE');
  const order = [0, 1, 2].sort((left, right) => values[right] - values[left] || left - right);
  const index = order[0];
  let axis = normalize([eigenvectors[0][index], eigenvectors[1][index], eigenvectors[2][index]], 'BLADE_AXIS_DEGENERATE');
  const dominant = [0, 1, 2].sort((left, right) => Math.abs(axis[right]) - Math.abs(axis[left]) || left - right)[0];
  if (axis[dominant] < 0) axis = scale(axis, -1);
  return { values, order, axis };
}

export function extractBladeCapsule(verticesValue, gripValue) {
  if (!Array.isArray(verticesValue) || verticesValue.length < 3) evaluatorFail('BLADE_VERTEX_SET_TOO_SMALL');
  const vertices = verticesValue.map((value) => vec3(value, 'BLADE_VERTEX_INVALID'));
  const grip = vec3(gripValue, 'BLADE_GRIP_INVALID');
  let centroid = [0, 0, 0];
  for (const vertex of vertices) centroid = add(centroid, vertex);
  centroid = scale(centroid, 1 / vertices.length);
  const covariance = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const vertex of vertices) {
    const delta = subtract(vertex, centroid);
    for (let row = 0; row < 3; row += 1) {
      for (let column = row; column < 3; column += 1) covariance[row][column] += delta[row] * delta[column];
    }
  }
  for (let row = 0; row < 3; row += 1) {
    for (let column = row; column < 3; column += 1) {
      covariance[row][column] /= vertices.length;
      covariance[column][row] = covariance[row][column];
    }
  }
  const eigen = jacobiEigenSymmetric3(covariance);
  const largest = eigen.values[eigen.order[0]];
  const second = eigen.values[eigen.order[1]];
  if (!(largest > 0) || second < 0 || (second === 0 ? Infinity : largest / second) < 4.0) {
    evaluatorFail('BLADE_AXIS_AMBIGUOUS');
  }
  let minimumProjection = Infinity;
  let maximumProjection = -Infinity;
  let maximumRadialDistance = 0;
  for (const vertex of vertices) {
    const delta = subtract(vertex, centroid);
    const projection = dot(delta, eigen.axis);
    minimumProjection = Math.min(minimumProjection, projection);
    maximumProjection = Math.max(maximumProjection, projection);
    maximumRadialDistance = Math.max(maximumRadialDistance, length(subtract(delta, scale(eigen.axis, projection))));
  }
  const endpointA = add(centroid, scale(eigen.axis, minimumProjection));
  const endpointB = add(centroid, scale(eigen.axis, maximumProjection));
  const lengthMetres = length(subtract(endpointB, endpointA));
  if (lengthMetres < 0.65 || lengthMetres > 1.80) evaluatorFail('BLADE_LENGTH_OUT_OF_BOUNDS');
  if (maximumRadialDistance > 0.14) evaluatorFail('BLADE_RADIAL_BOUND_EXCEEDED');
  const distanceA = length(subtract(endpointA, grip));
  const distanceB = length(subtract(endpointB, grip));
  if (Math.abs(distanceA - distanceB) <= EPS) evaluatorFail('BLADE_GUARD_TIP_GRIP_TIE');
  const guard = distanceA < distanceB ? endpointA : endpointB;
  const tip = distanceA < distanceB ? endpointB : endpointA;
  return {
    centroid,
    principalAxis: eigen.axis,
    eigenvaluesDescending: eigen.order.map((index) => eigen.values[index]),
    eigenvalueRatio: second === 0 ? 'Infinity' : String(largest / second),
    guard,
    tip,
    lengthMetres,
    maximumRadialDistance
  };
}

export function buildTargetCapsules(heightValue, landmarksValue) {
  const height = assertFiniteNumber(heightValue, 'TARGET_HEIGHT_INVALID');
  if (height < 1.55 || height > 2.20) evaluatorFail('TARGET_HEIGHT_OUT_OF_BOUNDS');
  try {
    assertExactKeys(landmarksValue, LANDMARK_KEYS, 'TARGET_LANDMARK_SHAPE_MISMATCH');
  } catch (error) {
    if (error instanceof Round012TreeError) evaluatorFail(error.code);
    throw error;
  }
  const landmarks = {};
  for (const key of LANDMARK_KEYS) landmarks[key] = vec3(landmarksValue[key], 'TARGET_LANDMARK_INVALID');
  return CAPSULE_SPECS.map(([id, a, b, ratio]) => ({
    id,
    a: landmarks[a],
    b: landmarks[b],
    radius: ratio * height
  }));
}

function requiredReference(value, key, code = 'GEOMETRY_SOURCE_REFERENCE_MISSING') {
  if (!value || !Object.hasOwn(value, key) || !value[key] || typeof value[key] !== 'object') evaluatorFail(code);
  return value[key];
}

function objectVisibleToCamera(object, camera) {
  let current = object;
  while (current) {
    if (current.visible === false) return false;
    current = current.parent;
  }
  if (camera?.layers?.test && object.layers && !camera.layers.test(object.layers)) return false;
  return true;
}

function materialFor(mesh, materialIndex) {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const material = materials[materialIndex];
  if (!material || material.visible === false) evaluatorFail('RENDERED_MATERIAL_MISSING_OR_HIDDEN');
  const opacity = material.opacity ?? 1;
  if (!Number.isFinite(opacity) || opacity < 0.95) evaluatorFail('RENDERED_MATERIAL_NOT_OPAQUE');
  if (material.alphaMap || (material.alphaTest ?? 0) > 0) evaluatorFail('ALPHA_MASKED_GEOMETRY_UNSUPPORTED');
  if (
    material.displacementMap ||
    material.isShaderMaterial ||
    material.isRawShaderMaterial ||
    material.userData?.gpuVertexDisplacement === true
  ) evaluatorFail('GPU_DEFORMED_GEOMETRY_UNSUPPORTED');
  let side;
  if (material.side === undefined || material.side === 0 || material.side === 'front') side = 'front';
  else if (material.side === 1 || material.side === 'back') side = 'back';
  else if (material.side === 2 || material.side === 'double') side = 'double';
  else evaluatorFail('RENDERED_MATERIAL_SIDE_UNSUPPORTED');
  return { material, side };
}

function deformedWorldVertex(mesh, vertexIndex) {
  const position = mesh.geometry?.attributes?.position;
  if (!position || !Number.isSafeInteger(vertexIndex) || vertexIndex < 0 || vertexIndex >= position.count) {
    evaluatorFail('RENDERED_VERTEX_INDEX_INVALID');
  }
  let target;
  if (mesh.position?.clone) target = mesh.position.clone();
  else evaluatorFail('THREE_VECTOR_FACTORY_MISSING');
  if (typeof target.set === 'function') target.set(0, 0, 0);
  if (typeof mesh.getVertexPosition === 'function') mesh.getVertexPosition(vertexIndex, target);
  else if (typeof target.fromBufferAttribute === 'function') target.fromBufferAttribute(position, vertexIndex);
  else evaluatorFail('CPU_VERTEX_DEFORMATION_UNAVAILABLE');
  if (typeof target.applyMatrix4 !== 'function' || !mesh.matrixWorld) evaluatorFail('WORLD_VERTEX_TRANSFORM_UNAVAILABLE');
  target.applyMatrix4(mesh.matrixWorld);
  return vec3([target.x, target.y, target.z], 'RENDERED_VERTEX_NONFINITE');
}

function normalizedGroups(geometry) {
  const position = geometry?.attributes?.position;
  if (!position || !Number.isSafeInteger(position.count) || position.count < 3) evaluatorFail('RENDERED_GEOMETRY_POSITION_MISSING');
  const elementCount = geometry.index?.count ?? position.count;
  if (!Number.isSafeInteger(elementCount) || elementCount < 3) evaluatorFail('RENDERED_GEOMETRY_EMPTY');
  if (!Array.isArray(geometry.groups) || geometry.groups.length === 0) {
    return [{ start: 0, count: elementCount, materialIndex: 0 }];
  }
  return geometry.groups.map((group) => {
    if (
      !Number.isSafeInteger(group.start) || group.start < 0 ||
      !Number.isSafeInteger(group.count) || group.count < 0 ||
      !Number.isSafeInteger(group.materialIndex) || group.materialIndex < 0
    ) evaluatorFail('RENDERED_GEOMETRY_GROUP_INVALID');
    return { start: group.start, count: group.count, materialIndex: group.materialIndex };
  });
}

function collectMeshTriangles(mesh, camera, selectedGroupIndices = null) {
  if (!mesh?.isMesh || !mesh.geometry) evaluatorFail('RENDERED_MESH_REFERENCE_INVALID');
  if (mesh.isInstancedMesh) evaluatorFail('INSTANCED_GEOMETRY_UNSUPPORTED');
  if (!objectVisibleToCamera(mesh, camera)) evaluatorFail('RENDERED_MESH_NOT_VISIBLE_TO_CAMERA');
  const geometry = mesh.geometry;
  const groups = normalizedGroups(geometry);
  const groupIndices = selectedGroupIndices === null
    ? groups.map((_, index) => index)
    : selectedGroupIndices;
  if (
    !Array.isArray(groupIndices) ||
    groupIndices.length === 0 ||
    groupIndices.some((index) => !Number.isSafeInteger(index) || index < 0 || index >= groups.length) ||
    new Set(groupIndices).size !== groupIndices.length
  ) evaluatorFail('RENDERED_GROUP_SELECTION_INVALID');
  const drawStart = geometry.drawRange?.start ?? 0;
  const drawCount = geometry.drawRange?.count ?? Infinity;
  if (!Number.isSafeInteger(drawStart) || drawStart < 0 || !(drawCount === Infinity || (Number.isSafeInteger(drawCount) && drawCount >= 0))) {
    evaluatorFail('RENDERED_DRAW_RANGE_INVALID');
  }
  const totalCount = geometry.index?.count ?? geometry.attributes.position.count;
  const drawEnd = Math.min(totalCount, drawCount === Infinity ? totalCount : drawStart + drawCount);
  const triangles = [];
  const uniqueVertices = new Map();
  const triangleKeys = new Set();
  const meshID = typeof mesh.uuid === 'string' && mesh.uuid ? mesh.uuid : null;
  if (!meshID) evaluatorFail('RENDERED_MESH_UUID_INVALID');
  for (const groupIndex of groupIndices) {
    const group = groups[groupIndex];
    const { side } = materialFor(mesh, group.materialIndex);
    const start = Math.max(group.start, drawStart);
    const end = Math.min(group.start + group.count, drawEnd);
    if (start >= end) continue;
    if (start % 3 !== 0 || (end - start) % 3 !== 0) evaluatorFail('RENDERED_TRIANGLE_RANGE_UNALIGNED');
    for (let offset = start; offset < end; offset += 3) {
      const indices = [0, 1, 2].map((corner) => {
        const elementIndex = offset + corner;
        const index = geometry.index ? geometry.index.getX(elementIndex) : elementIndex;
        if (!Number.isSafeInteger(index)) evaluatorFail('RENDERED_VERTEX_INDEX_INVALID');
        return index;
      });
      const triangleKey = `${indices[0]},${indices[1]},${indices[2]}`;
      if (triangleKeys.has(triangleKey)) evaluatorFail('RENDERED_TRIANGLE_GROUP_OVERLAP');
      triangleKeys.add(triangleKey);
      const world = indices.map((index) => {
        const key = `${meshID}/${index}`;
        if (!uniqueVertices.has(key)) uniqueVertices.set(key, deformedWorldVertex(mesh, index));
        return uniqueVertices.get(key);
      });
      triangles.push({ a: world[0], b: world[1], c: world[2], side });
    }
  }
  if (triangles.length === 0 || uniqueVertices.size < 3) evaluatorFail('RENDERED_GROUP_SELECTION_EMPTY');
  return { meshID, triangles, vertices: [...uniqueVertices.values()], vertexEntries: [...uniqueVertices.entries()] };
}

function boneWorldOrigin(bone) {
  if (!bone?.matrixWorld?.elements || bone.matrixWorld.elements.length !== 16) evaluatorFail('RENDER_DRIVING_BONE_INVALID');
  const elements = bone.matrixWorld.elements;
  return vec3([elements[12], elements[13], elements[14]], 'RENDER_DRIVING_BONE_INVALID');
}

function cameraViewProjection(camera) {
  if (!camera?.projectionMatrix?.clone || !camera.matrixWorldInverse) evaluatorFail('PRODUCTION_CAMERA_MATRIX_INVALID');
  const matrix = camera.projectionMatrix.clone();
  if (typeof matrix.multiply !== 'function') evaluatorFail('PRODUCTION_CAMERA_MATRIX_INVALID');
  matrix.multiply(camera.matrixWorldInverse);
  const elements = Array.from(matrix.elements ?? []);
  if (elements.length !== 16 || elements.some((value) => !Number.isFinite(value))) {
    evaluatorFail('PRODUCTION_CAMERA_MATRIX_INVALID');
  }
  return elements;
}

/**
 * Consumes live page-realm references from geometrySource(). The helper fixes
 * the previously unspecified property names while permitting additional
 * read-only references needed for later O4/T10 audits.
 */
export function collectGeometrySource(source) {
  const scene = requiredReference(source, 'scene');
  const camera = requiredReference(source, 'camera');
  const heroRoot = requiredReference(source, 'heroRoot');
  const leftHandBone = requiredReference(source, 'leftHandBone');
  const rightHandBone = requiredReference(source, 'rightHandBone');
  const targetRoot = requiredReference(source, 'targetRoot');
  requiredReference(source, 'healthStore');
  if (typeof scene.updateMatrixWorld !== 'function' || typeof camera.updateMatrixWorld !== 'function') {
    evaluatorFail('PRODUCTION_SCENE_MATRIX_UPDATE_UNAVAILABLE');
  }
  scene.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);
  if (!objectVisibleToCamera(heroRoot, camera) || !objectVisibleToCamera(targetRoot, camera)) {
    evaluatorFail('RENDERED_ROOT_NOT_VISIBLE_TO_CAMERA');
  }
  if (!Array.isArray(source.swordBladePrimitives) || source.swordBladePrimitives.length === 0) {
    evaluatorFail('BLADE_PRIMITIVES_MISSING');
  }
  const bladeVertices = [];
  const bladeTriangles = [];
  const bladeVertexKeys = new Set();
  for (const primitive of source.swordBladePrimitives) {
    try {
      assertExactKeys(primitive, ['mesh', 'materialGroupIndices'], 'BLADE_PRIMITIVE_SHAPE_MISMATCH');
    } catch (error) {
      if (error instanceof Round012TreeError) evaluatorFail(error.code);
      throw error;
    }
    const collected = collectMeshTriangles(primitive.mesh, camera, primitive.materialGroupIndices);
    bladeTriangles.push(...collected.triangles);
    collected.vertexEntries.forEach(([key, vertex]) => {
      if (!bladeVertexKeys.has(key)) {
        bladeVertexKeys.add(key);
        bladeVertices.push(vertex);
      }
    });
  }
  if (!Array.isArray(source.targetSkinnedMeshes) || source.targetSkinnedMeshes.length === 0) {
    evaluatorFail('TARGET_SKINNED_MESHES_MISSING');
  }
  const targetVertices = [];
  const targetTriangles = [];
  for (const mesh of source.targetSkinnedMeshes) {
    if (!mesh?.isSkinnedMesh) evaluatorFail('TARGET_MESH_NOT_SKINNED');
    const collected = collectMeshTriangles(mesh, camera);
    targetVertices.push(...collected.vertices);
    targetTriangles.push(...collected.triangles);
  }
  if (!source.targetLandmarkBones || typeof source.targetLandmarkBones !== 'object') {
    evaluatorFail('TARGET_LANDMARKS_MISSING');
  }
  try {
    assertExactKeys(source.targetLandmarkBones, LANDMARK_KEYS, 'TARGET_LANDMARK_SHAPE_MISMATCH');
  } catch (error) {
    if (error instanceof Round012TreeError) evaluatorFail(error.code);
    throw error;
  }
  const landmarks = Object.fromEntries(LANDMARK_KEYS.map((key) => [key, boneWorldOrigin(source.targetLandmarkBones[key])]));
  const yValues = targetVertices.map((vertex) => vertex[1]);
  const targetHeight = Math.max(...yValues) - Math.min(...yValues);
  const grip = scale(add(boneWorldOrigin(leftHandBone), boneWorldOrigin(rightHandBone)), 0.5);
  const blade = extractBladeCapsule(bladeVertices, grip);
  return {
    scene,
    camera,
    heroRoot,
    targetRoot,
    healthStore: source.healthStore,
    viewProjectionMatrix: cameraViewProjection(camera),
    blade,
    bladeTriangles,
    targetTriangles,
    targetHeight,
    targetCapsules: buildTargetCapsules(targetHeight, landmarks),
    landmarks
  };
}

export function projectWorldToPixel(worldPoint, viewProjectionMatrix) {
  const point = vec3(worldPoint);
  const clip = multiplyMatrix4Vector4(viewProjectionMatrix, [point[0], point[1], point[2], 1]);
  if (!Number.isFinite(clip[3]) || clip[3] <= 0) evaluatorFail('PROJECTED_POINT_BEHIND_CAMERA');
  const ndc = [clip[0] / clip[3], clip[1] / clip[3], clip[2] / clip[3]];
  if (ndc.some((component) => !Number.isFinite(component))) evaluatorFail('PROJECTED_POINT_NONFINITE');
  return [(ndc[0] * 0.5 + 0.5) * VIEWPORT_WIDTH, (1 - (ndc[1] * 0.5 + 0.5)) * VIEWPORT_HEIGHT];
}

export function bladeEndpointSilhouetteChecks(blade, viewProjectionMatrix, bladeMask) {
  if (!(bladeMask instanceof Uint8Array) || bladeMask.length !== VIEWPORT_WIDTH * VIEWPORT_HEIGHT) {
    evaluatorFail('BLADE_MASK_INVALID');
  }
  const boundary = boundaryMask(bladeMask, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
  const distance = squaredEuclideanDistanceTransform(boundary, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
  const evaluate = (point) => {
    const pixel = projectWorldToPixel(point, viewProjectionMatrix);
    const x = clamp(Math.round(pixel[0] - 0.5), 0, VIEWPORT_WIDTH - 1);
    const y = clamp(Math.round(pixel[1] - 0.5), 0, VIEWPORT_HEIGHT - 1);
    return Math.sqrt(distance[y * VIEWPORT_WIDTH + x]);
  };
  const guardDistancePixels = evaluate(blade.guard);
  const tipDistancePixels = evaluate(blade.tip);
  return {
    guardDistancePixels,
    tipDistancePixels,
    pass: guardDistancePixels <= 2 && tipDistancePixels <= 2
  };
}

function validateSweepState(state, expectedTick) {
  if (!state || state.absoluteTick !== expectedTick) evaluatorFail('SWEEP_TICK_SERIES_INVALID');
  const guard = vec3(state.blade?.guard, 'SWEEP_BLADE_INVALID');
  const tip = vec3(state.blade?.tip, 'SWEEP_BLADE_INVALID');
  if (!Array.isArray(state.targetCapsules) || state.targetCapsules.length !== CAPSULE_SPECS.length) {
    evaluatorFail('SWEEP_TARGET_CAPSULES_INVALID');
  }
  const targetCapsules = state.targetCapsules.map((capsule, index) => {
    const expectedID = CAPSULE_SPECS[index][0];
    if (capsule?.id !== expectedID) evaluatorFail('SWEEP_TARGET_CAPSULE_ORDER_INVALID');
    const radius = assertFiniteNumber(capsule.radius, 'SWEEP_TARGET_RADIUS_INVALID');
    if (radius <= 0) evaluatorFail('SWEEP_TARGET_RADIUS_INVALID');
    return { id: capsule.id, a: vec3(capsule.a), b: vec3(capsule.b), radius };
  });
  return { absoluteTick: expectedTick, blade: { guard, tip }, targetCapsules };
}

export function evaluateSweptContact(stateSeries, terminalTick = 80) {
  if (!Number.isSafeInteger(terminalTick) || terminalTick < 0) evaluatorFail('SWEEP_TERMINAL_TICK_INVALID');
  if (!Array.isArray(stateSeries) || stateSeries.length !== terminalTick + 2) evaluatorFail('SWEEP_TICK_SERIES_INVALID');
  const states = stateSeries.map((state, index) => validateSweepState(state, index - 1));
  const intervals = [];
  let firstContact = null;
  let maximumPenetration = Infinity;
  let priorIntervalContact = false;
  const risingContactTicks = [];
  for (let tick = 0; tick <= terminalTick; tick += 1) {
    const previous = states[tick];
    const current = states[tick + 1];
    let intervalContact = false;
    let firstSample = null;
    let stateSeparation = Infinity;
    let intervalMinimumSeparation = Infinity;
    for (let substep = 1; substep <= SUBSTEPS; substep += 1) {
      const tau = substep / SUBSTEPS;
      const guard = lerp(previous.blade.guard, current.blade.guard, tau);
      const tip = lerp(previous.blade.tip, current.blade.tip, tau);
      for (let capsuleIndex = 0; capsuleIndex < current.targetCapsules.length; capsuleIndex += 1) {
        const beforeCapsule = previous.targetCapsules[capsuleIndex];
        const afterCapsule = current.targetCapsules[capsuleIndex];
        if (beforeCapsule.id !== afterCapsule.id || Math.abs(beforeCapsule.radius - afterCapsule.radius) > EPS) {
          evaluatorFail('SWEEP_TARGET_CAPSULE_MUTATED');
        }
        const targetA = lerp(beforeCapsule.a, afterCapsule.a, tau);
        const targetB = lerp(beforeCapsule.b, afterCapsule.b, tau);
        const closest = closestSegmentSegment(guard, tip, targetA, targetB);
        const separation = closest.distance - (R_BLADE + afterCapsule.radius);
        if (!Number.isFinite(separation)) evaluatorFail('SWEEP_SEPARATION_NONFINITE');
        intervalMinimumSeparation = Math.min(intervalMinimumSeparation, separation);
        maximumPenetration = Math.min(maximumPenetration, separation);
        if (substep === SUBSTEPS) stateSeparation = Math.min(stateSeparation, separation);
        if (separation <= EPS && firstSample === null) {
          intervalContact = true;
          firstSample = {
            absoluteTick: tick,
            substep,
            capsuleID: afterCapsule.id,
            separation,
            closestBladePoint: closest.point1,
            closestTargetPoint: closest.point2
          };
          if (firstContact === null) firstContact = firstSample;
        }
      }
    }
    if (intervalContact && !priorIntervalContact) risingContactTicks.push(tick);
    priorIntervalContact = intervalContact;
    intervals.push({
      absoluteTick: tick,
      contact: intervalContact,
      firstSample,
      stateSeparation,
      minimumSeparation: intervalMinimumSeparation
    });
  }
  return {
    firstContact,
    firstContactTick: firstContact?.absoluteTick ?? null,
    risingContactTicks,
    maximumPenetration,
    intervals
  };
}

export function canonicalContactChecks(result) {
  if (!result || !Array.isArray(result.intervals)) evaluatorFail('SWEEP_RESULT_INVALID');
  const byTick = new Map(result.intervals.map((entry) => [entry.absoluteTick, entry]));
  const noContactThrough45 = result.intervals.filter((entry) => entry.absoluteTick <= 45).every((entry) => !entry.contact);
  const checks = {
    noContactThrough45,
    tick44Clearance: byTick.get(44)?.stateSeparation >= 0.080000,
    tick45Clearance: byTick.get(45)?.stateSeparation >= 0.030000,
    firstContactTick46: result.firstContactTick === 46,
    tick46StateTopology:
      byTick.get(46)?.stateSeparation >= -0.005000 && byTick.get(46)?.stateSeparation <= EPS,
    penetrationBound: result.maximumPenetration >= -0.010000,
    tick48Departure: byTick.get(48)?.stateSeparation >= 0.030000,
    noSecondRisingContact: result.risingContactTicks.length === 1 && result.risingContactTicks[0] === 46
  };
  return { checks, pass: Object.values(checks).every(Boolean) };
}

function multiplyMatrix4Vector4(matrix, vector) {
  if (!Array.isArray(matrix) || matrix.length !== 16 || matrix.some((value) => !Number.isFinite(value))) {
    evaluatorFail('VIEW_PROJECTION_MATRIX_INVALID');
  }
  const [x, y, z, w] = vector;
  return [
    matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12] * w,
    matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13] * w,
    matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14] * w,
    matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15] * w
  ];
}

function interpolateVector4(left, right, t) {
  return [
    left[0] + (right[0] - left[0]) * t,
    left[1] + (right[1] - left[1]) * t,
    left[2] + (right[2] - left[2]) * t,
    left[3] + (right[3] - left[3]) * t
  ];
}

function clipPolygonAgainstPlane(polygon, plane) {
  const output = [];
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const previous = polygon[(index + polygon.length - 1) % polygon.length];
    const currentDistance = plane(current);
    const previousDistance = plane(previous);
    const currentInside = currentDistance >= 0;
    const previousInside = previousDistance >= 0;
    if (currentInside !== previousInside) {
      const denominator = previousDistance - currentDistance;
      if (denominator === 0 || !Number.isFinite(denominator)) evaluatorFail('RASTER_CLIP_NUMERIC_FAILURE');
      const t = previousDistance / denominator;
      output.push(interpolateVector4(previous, current, t));
    }
    if (currentInside) output.push(current);
  }
  return output;
}

function clipTriangleToFrustum(vertices) {
  const planes = [
    (v) => v[0] + v[3],
    (v) => v[3] - v[0],
    (v) => v[1] + v[3],
    (v) => v[3] - v[1],
    (v) => v[2] + v[3],
    (v) => v[3] - v[2],
    (v) => v[3] - 1e-15
  ];
  let polygon = vertices;
  for (const plane of planes) {
    polygon = clipPolygonAgainstPlane(polygon, plane);
    if (polygon.length < 3) return [];
  }
  return polygon;
}

function edge2(a, b, point) {
  return (point[0] - a[0]) * (b[1] - a[1]) - (point[1] - a[1]) * (b[0] - a[0]);
}

function validateTriangle(triangle) {
  try {
    assertExactKeys(triangle, ['a', 'b', 'c', 'side'], 'RASTER_TRIANGLE_SHAPE_MISMATCH');
  } catch (error) {
    if (error instanceof Round012TreeError) evaluatorFail(error.code);
    throw error;
  }
  if (!['front', 'back', 'double'].includes(triangle.side)) evaluatorFail('RASTER_TRIANGLE_SIDE_INVALID');
  return { a: vec3(triangle.a), b: vec3(triangle.b), c: vec3(triangle.c), side: triangle.side };
}

/**
 * Software-rasterizes one production object into a native DPR1 mask. Input
 * triangles must already be the current CPU-deformed world triangles selected
 * from the live rendered material groups. Matrix layout matches three.js
 * Matrix4.elements (column-major).
 */
export function rasterizeObjectMask({
  triangles,
  viewProjectionMatrix,
  width = VIEWPORT_WIDTH,
  height = VIEWPORT_HEIGHT
}) {
  if (!Array.isArray(triangles) || triangles.length === 0) evaluatorFail('RASTER_TRIANGLES_EMPTY');
  if (!Number.isSafeInteger(width) || width <= 0 || !Number.isSafeInteger(height) || height <= 0) {
    evaluatorFail('RASTER_DIMENSIONS_INVALID');
  }
  if (width !== VIEWPORT_WIDTH || height !== VIEWPORT_HEIGHT) evaluatorFail('RASTER_NATIVE_RESOLUTION_REQUIRED');
  const mask = new Uint8Array(width * height);
  const depth = new Float64Array(width * height);
  depth.fill(Infinity);

  function rasterizeProjected(projected, side) {
    const ndc = projected.map((vertex) => {
      if (!Number.isFinite(vertex[3]) || vertex[3] <= 0) evaluatorFail('RASTER_CLIP_W_INVALID');
      return [vertex[0] / vertex[3], vertex[1] / vertex[3], vertex[2] / vertex[3]];
    });
    const ndcArea =
      (ndc[1][0] - ndc[0][0]) * (ndc[2][1] - ndc[0][1]) -
      (ndc[1][1] - ndc[0][1]) * (ndc[2][0] - ndc[0][0]);
    if (Math.abs(ndcArea) <= 1e-18) return;
    const frontFacing = ndcArea > 0;
    if ((side === 'front' && !frontFacing) || (side === 'back' && frontFacing)) return;
    let screen = ndc.map((vertex) => [
      (vertex[0] * 0.5 + 0.5) * width,
      (1 - (vertex[1] * 0.5 + 0.5)) * height,
      vertex[2]
    ]);
    let area = edge2(screen[0], screen[1], screen[2]);
    if (Math.abs(area) <= 1e-18) return;
    if (area < 0) {
      [screen[1], screen[2]] = [screen[2], screen[1]];
      area = -area;
    }
    const minimumX = Math.max(0, Math.ceil(Math.min(...screen.map((vertex) => vertex[0])) - 0.5));
    const maximumX = Math.min(width - 1, Math.floor(Math.max(...screen.map((vertex) => vertex[0])) - 0.5));
    const minimumY = Math.max(0, Math.ceil(Math.min(...screen.map((vertex) => vertex[1])) - 0.5));
    const maximumY = Math.min(height - 1, Math.floor(Math.max(...screen.map((vertex) => vertex[1])) - 0.5));
    for (let y = minimumY; y <= maximumY; y += 1) {
      for (let x = minimumX; x <= maximumX; x += 1) {
        const point = [x + 0.5, y + 0.5];
        const weight0 = edge2(screen[1], screen[2], point);
        const weight1 = edge2(screen[2], screen[0], point);
        const weight2 = edge2(screen[0], screen[1], point);
        if (weight0 < 0 || weight1 < 0 || weight2 < 0) continue;
        const fragmentDepth =
          (weight0 * screen[0][2] + weight1 * screen[1][2] + weight2 * screen[2][2]) / area;
        if (!Number.isFinite(fragmentDepth) || fragmentDepth < -1 - EPS || fragmentDepth > 1 + EPS) continue;
        const pixel = y * width + x;
        if (fragmentDepth < depth[pixel]) {
          depth[pixel] = fragmentDepth;
          mask[pixel] = 1;
        }
      }
    }
  }

  for (const triangleValue of triangles) {
    const triangle = validateTriangle(triangleValue);
    const clip = [triangle.a, triangle.b, triangle.c].map((vertex) =>
      multiplyMatrix4Vector4(viewProjectionMatrix, [vertex[0], vertex[1], vertex[2], 1])
    );
    const polygon = clipTriangleToFrustum(clip);
    for (let index = 1; index + 1 < polygon.length; index += 1) {
      rasterizeProjected([polygon[0], polygon[index], polygon[index + 1]], triangle.side);
    }
  }
  if (!mask.some((value) => value === 1)) evaluatorFail('RASTER_MASK_EMPTY');
  return { width, height, mask, depth };
}

function distanceTransform1d(values) {
  const length = values.length;
  const sites = [];
  for (let index = 0; index < length; index += 1) {
    if (Number.isFinite(values[index])) sites.push(index);
  }
  const output = new Float64Array(length);
  if (sites.length === 0) {
    output.fill(Infinity);
    return output;
  }
  const envelope = new Int32Array(sites.length);
  const boundaries = new Float64Array(sites.length + 1);
  let k = 0;
  envelope[0] = sites[0];
  boundaries[0] = -Infinity;
  boundaries[1] = Infinity;
  for (let siteIndex = 1; siteIndex < sites.length; siteIndex += 1) {
    const q = sites[siteIndex];
    let intersection;
    while (true) {
      const p = envelope[k];
      intersection = ((values[q] + q * q) - (values[p] + p * p)) / (2 * (q - p));
      if (intersection > boundaries[k] || k === 0) break;
      k -= 1;
    }
    if (intersection <= boundaries[k] && k === 0) {
      envelope[0] = q;
      boundaries[0] = -Infinity;
      boundaries[1] = Infinity;
      continue;
    }
    k += 1;
    envelope[k] = q;
    boundaries[k] = intersection;
    boundaries[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < length; q += 1) {
    while (boundaries[k + 1] < q) k += 1;
    const p = envelope[k];
    const delta = q - p;
    output[q] = delta * delta + values[p];
  }
  return output;
}

export function squaredEuclideanDistanceTransform(seedMask, width, height) {
  if (!(seedMask instanceof Uint8Array) || seedMask.length !== width * height) {
    evaluatorFail('DISTANCE_MASK_INVALID');
  }
  const rowPass = new Float64Array(width * height);
  for (let y = 0; y < height; y += 1) {
    const values = new Float64Array(width);
    for (let x = 0; x < width; x += 1) values[x] = seedMask[y * width + x] ? 0 : Infinity;
    rowPass.set(distanceTransform1d(values), y * width);
  }
  const result = new Float64Array(width * height);
  for (let x = 0; x < width; x += 1) {
    const values = new Float64Array(height);
    for (let y = 0; y < height; y += 1) values[y] = rowPass[y * width + x];
    const transformed = distanceTransform1d(values);
    for (let y = 0; y < height; y += 1) result[y * width + x] = transformed[y];
  }
  return result;
}

function boundaryMask(mask, width, height) {
  const boundary = new Uint8Array(mask.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (!mask[index]) continue;
      if (
        x === 0 || x === width - 1 || y === 0 || y === height - 1 ||
        !mask[index - 1] || !mask[index + 1] || !mask[index - width] || !mask[index + width]
      ) boundary[index] = 1;
    }
  }
  return boundary;
}

export function analyzeMaskTopology(bladeMask, targetMask, width = VIEWPORT_WIDTH, height = VIEWPORT_HEIGHT) {
  if (
    !(bladeMask instanceof Uint8Array) ||
    !(targetMask instanceof Uint8Array) ||
    bladeMask.length !== width * height ||
    targetMask.length !== width * height
  ) evaluatorFail('TOPOLOGY_MASK_INVALID');
  let bladePixels = 0;
  let targetPixels = 0;
  let overlapPixels = 0;
  const targetBackground = new Uint8Array(targetMask.length);
  for (let index = 0; index < targetMask.length; index += 1) {
    bladePixels += bladeMask[index] ? 1 : 0;
    targetPixels += targetMask[index] ? 1 : 0;
    overlapPixels += bladeMask[index] && targetMask[index] ? 1 : 0;
    targetBackground[index] = targetMask[index] ? 0 : 1;
  }
  if (bladePixels === 0 || targetPixels === 0) evaluatorFail('TOPOLOGY_MASK_EMPTY');
  const targetBoundary = boundaryMask(targetMask, width, height);
  const exteriorDistanceSquared = squaredEuclideanDistanceTransform(targetBoundary, width, height);
  const insideDistanceSquared = squaredEuclideanDistanceTransform(targetBackground, width, height);
  let minimumBladeToTargetExteriorPixels = Infinity;
  let maximumOverlapInsidePixels = 0;
  for (let index = 0; index < bladeMask.length; index += 1) {
    if (!bladeMask[index]) continue;
    minimumBladeToTargetExteriorPixels = Math.min(
      minimumBladeToTargetExteriorPixels,
      Math.sqrt(exteriorDistanceSquared[index])
    );
    if (targetMask[index]) {
      maximumOverlapInsidePixels = Math.max(maximumOverlapInsidePixels, Math.sqrt(insideDistanceSquared[index]));
    }
  }
  const overlapFraction = overlapPixels / targetPixels;
  return {
    bladePixels,
    targetPixels,
    overlapPixels,
    overlapFraction,
    minimumBladeToTargetExteriorPixels,
    maximumOverlapInsidePixels
  };
}

export function visibleTopologyChecks(tick45, tick46) {
  const checks = {
    tick45MaskDistance: tick45.minimumBladeToTargetExteriorPixels >= 3,
    tick46ExteriorDistance: tick46.minimumBladeToTargetExteriorPixels <= 2,
    tick46OverlapFraction: tick46.overlapFraction <= 0.0025,
    tick46OverlapDepth: tick46.maximumOverlapInsidePixels <= 3
  };
  return { checks, pass: Object.values(checks).every(Boolean) };
}

function usage() {
  return [
    'Usage:',
    '  evaluator-helper.mjs presentation-commit PRESENTATION_SEED_BIN',
    '  evaluator-helper.mjs counterfactual-commit COUNTERFACTUAL_SEED_BIN',
    '  evaluator-helper.mjs reference-commit SELECTION_JSON REFERENCE_SALT_BIN',
    '  evaluator-helper.mjs verify-round-commitment REPOSITORY_ROOT ROUND_COMMITMENT_JSON',
    '  evaluator-helper.mjs verify-private-custody REPOSITORY_ROOT ROUND_COMMITMENT_JSON PRESENTATION_SEED_BIN COUNTERFACTUAL_SEED_BIN SELECTION_JSON REFERENCE_SALT_BIN REFERENCE_ARCHIVE EXTRACTED_ARCHIVE_ROOT'
  ].join('\n');
}

export async function main(argv) {
  const [command, ...args] = argv;
  let output;
  if (command === 'presentation-commit' && args.length === 1) {
    output = presentationCommit(await readRaw32(args[0], 'PRESENTATION_SEED_NOT_32_BYTES'));
  } else if (command === 'counterfactual-commit' && args.length === 1) {
    output = counterfactualCommit(await readRaw32(args[0], 'COUNTERFACTUAL_SEED_NOT_32_BYTES'));
  } else if (command === 'reference-commit' && args.length === 2) {
    const selection = (await readCanonicalFile(args[0])).value;
    const salt = await readRaw32(args[1], 'REFERENCE_SALT_NOT_32_BYTES');
    output = referenceCommit(selection, salt);
  } else if (command === 'verify-round-commitment' && args.length === 2) {
    output = JSON.stringify(await verifyRoundCommitmentFiles(args[0], args[1]));
  } else if (command === 'verify-private-custody' && args.length === 8) {
    const commitmentRecord = await readCanonicalFile(args[1]);
    const privateVerification = await verifyPrivateCustody({
      commitment: commitmentRecord.value,
      presentationSeed: await readRaw32(args[2], 'PRESENTATION_SEED_NOT_32_BYTES'),
      counterfactualSeed: await readRaw32(args[3], 'COUNTERFACTUAL_SEED_NOT_32_BYTES'),
      selectionDocument: (await readCanonicalFile(args[4])).value,
      referenceSalt: await readRaw32(args[5], 'REFERENCE_SALT_NOT_32_BYTES'),
      referenceArchivePath: args[6],
      extractedArchiveRoot: args[7]
    });
    const publicVerification = await verifyRoundCommitmentFiles(args[0], args[1]);
    output = JSON.stringify({ ...publicVerification, ...privateVerification });
  } else {
    evaluatorFail(usage());
  }
  process.stdout.write(`${output}\n`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath && fileURLToPath(import.meta.url) === invokedPath) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`P30_R012_EVALUATOR_ERROR:${error.code ?? 'UNEXPECTED'}\n`);
    process.exitCode = 1;
  });
}
