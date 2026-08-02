#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { inflateRawSync } from 'node:zlib';

import {
  Round012TreeError,
  assertExactKeys,
  canonicalBytes,
  compareUtf8,
  fileSha256,
  hashTree,
  parseJsonStrict,
  readCanonicalFile,
  registerCaseFoldedPath,
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
export const PACKAGE_MAP_COMMIT_DOMAIN = 'P30R012A/package-map/v1';
export const ALIAS_SCORE_COMMIT_DOMAIN = 'P30R012A/alias-score/v1';

export const EPS = 0.000001;
export const R_BLADE = 0.020000;
export const SUBSTEPS = 4096;
export const VIEWPORT_WIDTH = 1600;
export const VIEWPORT_HEIGHT = 900;
export const HEAVY_RISING_EDGE_ABSOLUTE_TICK = 24;
export const FOCUSED_CAPTURE_TICKS = Object.freeze([44, 46, 58]);
export const ACTION_CROP_EXPANSION = 0.15;
export const CONTACT_ROI_SIZE = 320;
export const REFERENCE_SCALE_ALGORITHM = 'lanczos3-uniform-fit-no-upscale-v1';
export const PACKAGE_MAP_SCHEMA = 'p30.r012a.package-map.v1';
export const ALIAS_SCORE_SCHEMA = 'p30.r012a.alias-score.v1';

const HEX64 = /^[0-9a-f]{64}$/u;
const ALIAS = /^candidate-[0-9a-f]{16}$/u;
const PHASE_IDS = Object.freeze(['R1_ANTICIPATION', 'R2_CONTACT', 'R3_FOLLOW_THROUGH']);
const REFERENCE_BALLOT_IDS = Object.freeze(['R1', 'R2', 'R3']);
const PAIRWISE_BALLOT_IDS = Object.freeze(['P1', 'P2', 'P3']);
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
  validateBallotTokens(itemID, sideTokens);
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

export function validateBallotTokens(itemID, sideTokens) {
  if (!Array.isArray(sideTokens) || sideTokens.length !== 2 || sideTokens[0] === sideTokens[1]) {
    evaluatorFail('EXACTLY_TWO_DISTINCT_SIDE_TOKENS_REQUIRED');
  }
  if (PAIRWISE_BALLOT_IDS.includes(itemID)) {
    sideTokens.forEach(assertAlias);
    return { kind: 'pairwise', ballotID: itemID };
  }
  const match = /^(R[123])\/(candidate-[0-9a-f]{16})$/u.exec(itemID);
  if (!match) evaluatorFail('INVALID_BALLOT_ITEM_ID');
  const [, ballotID, alias] = match;
  const expected = new Set([alias, `reference/${ballotID}`]);
  if (sideTokens.some((token) => !expected.has(token))) evaluatorFail('INVALID_REFERENCE_BALLOT_TOKEN');
  return { kind: 'reference', ballotID, alias };
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
    if (marker === 0x01 || marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (cursor + 2 > bytes.length) break;
    const length = bytes.readUInt16BE(cursor);
    if (length < 2 || cursor + length > bytes.length) evaluatorFail('REFERENCE_IMAGE_INVALID');
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      if (length < 7) evaluatorFail('REFERENCE_IMAGE_INVALID');
      const dimensions = { height: bytes.readUInt16BE(cursor + 3), width: bytes.readUInt16BE(cursor + 5) };
      if (dimensions.width <= 0 || dimensions.height <= 0) evaluatorFail('REFERENCE_IMAGE_INVALID');
      return dimensions;
    }
    cursor += length;
  }
  evaluatorFail('REFERENCE_IMAGE_DIMENSIONS_MISSING');
}

function webpDimensions(bytes) {
  if (
    bytes.length < 30 || bytes.toString('ascii', 0, 4) !== 'RIFF' ||
    bytes.toString('ascii', 8, 12) !== 'WEBP'
  ) evaluatorFail('REFERENCE_IMAGE_FORMAT_UNSUPPORTED');
  const riffSize = bytes.readUInt32LE(4) + 8;
  if (riffSize > bytes.length || riffSize < 20) evaluatorFail('REFERENCE_IMAGE_INVALID');
  let cursor = 12;
  while (cursor + 8 <= riffSize) {
    const type = bytes.toString('ascii', cursor, cursor + 4);
    const size = bytes.readUInt32LE(cursor + 4);
    const data = cursor + 8;
    if (data + size > riffSize) evaluatorFail('REFERENCE_IMAGE_INVALID');
    if (type === 'VP8X') {
      if (size < 10) evaluatorFail('REFERENCE_IMAGE_INVALID');
      const width = 1 + bytes[data + 4] + (bytes[data + 5] << 8) + (bytes[data + 6] << 16);
      const height = 1 + bytes[data + 7] + (bytes[data + 8] << 8) + (bytes[data + 9] << 16);
      return { width, height };
    }
    if (type === 'VP8L') {
      if (size < 5 || bytes[data] !== 0x2f) evaluatorFail('REFERENCE_IMAGE_INVALID');
      const bits = bytes.readUInt32LE(data + 1);
      return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >>> 14) & 0x3fff) };
    }
    if (type === 'VP8 ') {
      if (size < 10 || bytes[data + 3] !== 0x9d || bytes[data + 4] !== 0x01 || bytes[data + 5] !== 0x2a) {
        evaluatorFail('REFERENCE_IMAGE_INVALID');
      }
      return {
        width: bytes.readUInt16LE(data + 6) & 0x3fff,
        height: bytes.readUInt16LE(data + 8) & 0x3fff
      };
    }
    cursor = data + size + (size & 1);
  }
  evaluatorFail('REFERENCE_IMAGE_DIMENSIONS_MISSING');
}

export function referenceImageDimensions(bytes) {
  if (!Buffer.isBuffer(bytes)) evaluatorFail('REFERENCE_IMAGE_INVALID');
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) return jpegDimensions(bytes);
  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF') return webpDimensions(bytes);
  evaluatorFail('REFERENCE_IMAGE_FORMAT_UNSUPPORTED');
}

let crcTable;
function crc32(bytes) {
  if (!crcTable) {
    crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
      let crc = value;
      for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
      return crc >>> 0;
    });
  }
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function decodeZipName(bytes, flags) {
  if ((flags & 0x0800) === 0 && bytes.some((byte) => byte > 0x7f)) evaluatorFail('REFERENCE_ZIP_NAME_ENCODING_UNSUPPORTED');
  const name = bytes.toString('utf8');
  if (Buffer.compare(Buffer.from(name, 'utf8'), bytes) !== 0 || name.normalize('NFC') !== name || name.includes('\0')) {
    evaluatorFail('REFERENCE_ZIP_ENTRY_PATH_INVALID');
  }
  return name;
}

export function parseReferenceZip(archiveBytes) {
  if (!Buffer.isBuffer(archiveBytes) || archiveBytes.length < 22) evaluatorFail('REFERENCE_ZIP_INVALID');
  let eocd = -1;
  const minimum = Math.max(0, archiveBytes.length - 65_557);
  for (let cursor = archiveBytes.length - 22; cursor >= minimum; cursor -= 1) {
    if (archiveBytes.readUInt32LE(cursor) === 0x06054b50) { eocd = cursor; break; }
  }
  if (eocd < 0 || eocd + 22 + archiveBytes.readUInt16LE(eocd + 20) !== archiveBytes.length) {
    evaluatorFail('REFERENCE_ZIP_EOCD_INVALID');
  }
  if (
    archiveBytes.readUInt16LE(eocd + 4) !== 0 || archiveBytes.readUInt16LE(eocd + 6) !== 0 ||
    archiveBytes.readUInt16LE(eocd + 8) !== archiveBytes.readUInt16LE(eocd + 10)
  ) evaluatorFail('REFERENCE_ZIP_MULTIDISK_UNSUPPORTED');
  const entryCount = archiveBytes.readUInt16LE(eocd + 10);
  const centralSize = archiveBytes.readUInt32LE(eocd + 12);
  const centralOffset = archiveBytes.readUInt32LE(eocd + 16);
  if (centralOffset + centralSize !== eocd || entryCount === 0 || entryCount > 10_000) evaluatorFail('REFERENCE_ZIP_CENTRAL_DIRECTORY_INVALID');
  const entries = new Map();
  const caseFold = new Set();
  let cursor = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > eocd || archiveBytes.readUInt32LE(cursor) !== 0x02014b50) evaluatorFail('REFERENCE_ZIP_CENTRAL_DIRECTORY_INVALID');
    const madeBy = archiveBytes.readUInt16LE(cursor + 4);
    const flags = archiveBytes.readUInt16LE(cursor + 8);
    const method = archiveBytes.readUInt16LE(cursor + 10);
    const expectedCrc32 = archiveBytes.readUInt32LE(cursor + 16);
    const compressedSize = archiveBytes.readUInt32LE(cursor + 20);
    const uncompressedSize = archiveBytes.readUInt32LE(cursor + 24);
    const nameLength = archiveBytes.readUInt16LE(cursor + 28);
    const extraLength = archiveBytes.readUInt16LE(cursor + 30);
    const commentLength = archiveBytes.readUInt16LE(cursor + 32);
    const externalAttributes = archiveBytes.readUInt32LE(cursor + 38);
    const localOffset = archiveBytes.readUInt32LE(cursor + 42);
    const end = cursor + 46 + nameLength + extraLength + commentLength;
    if (end > eocd || (flags & 1) !== 0 || ![0, 8].includes(method)) evaluatorFail('REFERENCE_ZIP_ENTRY_UNSUPPORTED');
    const name = decodeZipName(archiveBytes.subarray(cursor + 46, cursor + 46 + nameLength), flags);
    const directory = name.endsWith('/');
    const canonicalName = directory ? name.slice(0, -1) : name;
    try { validateRelativePath(canonicalName); } catch { evaluatorFail('REFERENCE_ZIP_ENTRY_PATH_INVALID'); }
    const unixMode = (madeBy >>> 8) === 3 ? (externalAttributes >>> 16) & 0xffff : 0;
    if ((unixMode & 0o170000) === 0o120000) evaluatorFail('REFERENCE_ZIP_SYMLINK_FORBIDDEN');
    if (!directory && unixMode && (unixMode & 0o170000) !== 0o100000) evaluatorFail('REFERENCE_ZIP_SPECIAL_ENTRY_FORBIDDEN');
    if (entries.has(name) || caseFold.has(name.toLocaleLowerCase('en-US'))) evaluatorFail('REFERENCE_ZIP_ENTRY_COLLISION');
    caseFold.add(name.toLocaleLowerCase('en-US'));
    if (uncompressedSize > 64 * 1024 * 1024 || compressedSize > archiveBytes.length) evaluatorFail('REFERENCE_ZIP_ENTRY_TOO_LARGE');
    if (localOffset + 30 > centralOffset || archiveBytes.readUInt32LE(localOffset) !== 0x04034b50) evaluatorFail('REFERENCE_ZIP_LOCAL_HEADER_INVALID');
    const localFlags = archiveBytes.readUInt16LE(localOffset + 6);
    const localMethod = archiveBytes.readUInt16LE(localOffset + 8);
    const localNameLength = archiveBytes.readUInt16LE(localOffset + 26);
    const localExtraLength = archiveBytes.readUInt16LE(localOffset + 28);
    const localName = decodeZipName(archiveBytes.subarray(localOffset + 30, localOffset + 30 + localNameLength), localFlags);
    if (localFlags !== flags || localMethod !== method || localName !== name) evaluatorFail('REFERENCE_ZIP_LOCAL_HEADER_MISMATCH');
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > centralOffset) evaluatorFail('REFERENCE_ZIP_ENTRY_TRUNCATED');
    let bytes = Buffer.alloc(0);
    if (!directory) {
      const compressed = archiveBytes.subarray(dataStart, dataEnd);
      try { bytes = method === 0 ? Buffer.from(compressed) : inflateRawSync(compressed); } catch { evaluatorFail('REFERENCE_ZIP_DEFLATE_INVALID'); }
      if (bytes.length !== uncompressedSize || crc32(bytes) !== expectedCrc32) evaluatorFail('REFERENCE_ZIP_ENTRY_INTEGRITY_MISMATCH');
    }
    entries.set(name, { name, bytes, sha256: sha256Hex(bytes), directory, method, unixMode });
    cursor = end;
  }
  if (cursor !== eocd) evaluatorFail('REFERENCE_ZIP_CENTRAL_DIRECTORY_INVALID');
  return entries;
}

async function assertExtractedRegularFile(root, relativePath) {
  const rootAbsolute = resolve(root);
  const rootStatus = await lstat(rootAbsolute);
  if (rootStatus.isSymbolicLink() || !rootStatus.isDirectory()) evaluatorFail('REFERENCE_EXTRACTED_ROOT_INVALID');
  const rootReal = await realpath(rootAbsolute);
  let current = rootAbsolute;
  for (const component of relativePath.split('/')) {
    current = resolve(current, component);
    const status = await lstat(current);
    if (status.isSymbolicLink()) evaluatorFail('REFERENCE_EXTRACTED_SYMLINK_FORBIDDEN');
  }
  const status = await lstat(current);
  if (!status.isFile()) evaluatorFail('REFERENCE_EXTRACTED_NOT_REGULAR_FILE');
  const actualReal = await realpath(current);
  let rel = relative(rootReal, actualReal);
  if (sep !== '/') rel = rel.split(sep).join('/');
  if (!rel || rel === '..' || rel.startsWith('../') || isAbsolute(rel)) evaluatorFail('REFERENCE_EXTRACTED_PATH_ESCAPE');
  return current;
}

export async function verifyReferenceSelectionFiles(selectionDocument, extractedArchiveRoot, referenceArchivePath) {
  validateReferenceSelection(selectionDocument);
  if (typeof referenceArchivePath !== 'string' || !referenceArchivePath) evaluatorFail('REFERENCE_ARCHIVE_PATH_REQUIRED');
  const archiveEntries = parseReferenceZip(await readFile(referenceArchivePath));
  const root = resolve(extractedArchiveRoot);
  for (const selection of selectionDocument.selections) {
    const archiveEntry = archiveEntries.get(selection.sourceArchiveEntry);
    if (!archiveEntry || archiveEntry.directory) evaluatorFail('REFERENCE_ARCHIVE_ENTRY_MISSING');
    if (archiveEntry.sha256 !== selection.sourceFileSha256) evaluatorFail('REFERENCE_ARCHIVE_ORIGIN_HASH_MISMATCH');
    const absolute = await assertExtractedRegularFile(root, selection.sourceArchiveEntry);
    const bytes = await readFile(absolute);
    if (await assertExtractedRegularFile(root, selection.sourceArchiveEntry) !== absolute) {
      evaluatorFail('REFERENCE_EXTRACTED_PATH_MUTATED');
    }
    if (sha256Hex(bytes) !== selection.sourceFileSha256) evaluatorFail('REFERENCE_FILE_HASH_MISMATCH');
    if (!bytes.equals(archiveEntry.bytes)) evaluatorFail('REFERENCE_EXTRACTED_BYTES_NOT_FROM_ARCHIVE');
    const dimensions = referenceImageDimensions(bytes);
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
  await verifyReferenceSelectionFiles(selectionDocument, extractedArchiveRoot, referenceArchivePath);
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

function triangleSurvivesProductionCulling(world, side, viewProjectionMatrix) {
  const clip = world.map((vertex) => multiplyMatrix4Vector4(
    viewProjectionMatrix,
    [vertex[0], vertex[1], vertex[2], 1]
  ));
  const polygon = clipTriangleToFrustum(clip);
  for (let index = 1; index + 1 < polygon.length; index += 1) {
    const fan = [polygon[0], polygon[index], polygon[index + 1]].map((vertex) => [
      vertex[0] / vertex[3], vertex[1] / vertex[3]
    ]);
    const area =
      (fan[1][0] - fan[0][0]) * (fan[2][1] - fan[0][1]) -
      (fan[1][1] - fan[0][1]) * (fan[2][0] - fan[0][0]);
    if (Math.abs(area) <= 1e-18) continue;
    const frontFacing = area > 0;
    if (side === 'double' || (side === 'front' && frontFacing) || (side === 'back' && !frontFacing)) return true;
  }
  return false;
}

function collectMeshTriangles(mesh, camera, selectedGroupIndices = null, excludeCulledTriangles = false) {
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
  const viewProjectionMatrix = cameraViewProjection(camera);
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
        return uniqueVertices.get(key) ?? deformedWorldVertex(mesh, index);
      });
      if (excludeCulledTriangles && !triangleSurvivesProductionCulling(world, side, viewProjectionMatrix)) continue;
      indices.forEach((vertexIndex, corner) => uniqueVertices.set(`${meshID}/${vertexIndex}`, world[corner]));
      triangles.push({ a: world[0], b: world[1], c: world[2], side });
    }
  }
  if (triangles.length === 0 || uniqueVertices.size < 3) evaluatorFail('RENDERED_GROUP_SELECTION_EMPTY');
  return {
    meshID,
    triangles,
    vertices: [...uniqueVertices.values()],
    vertexEntries: [...uniqueVertices.entries()],
    vertexIndices: [...uniqueVertices.keys()].map((key) => Number(key.slice(key.lastIndexOf('/') + 1)))
  };
}

function boneWorldOrigin(bone) {
  if (!bone?.isBone || !bone.matrixWorld?.elements || bone.matrixWorld.elements.length !== 16) {
    evaluatorFail('RENDER_DRIVING_BONE_INVALID');
  }
  const elements = bone.matrixWorld.elements;
  return vec3([elements[12], elements[13], elements[14]], 'RENDER_DRIVING_BONE_INVALID');
}

function isDescendantOrSelf(object, expectedAncestor) {
  const seen = new Set();
  let current = object;
  while (current) {
    if (current === expectedAncestor) return true;
    if (seen.has(current)) evaluatorFail('RENDER_OBJECT_ANCESTRY_CYCLE');
    seen.add(current);
    current = current.parent;
  }
  return false;
}

function attributeComponent(attribute, vertexIndex, component, code) {
  const getter = ['getX', 'getY', 'getZ', 'getW'][component];
  if (!attribute || typeof attribute[getter] !== 'function' || vertexIndex >= attribute.count) evaluatorFail(code);
  return attribute[getter](vertexIndex);
}

function renderedSkinInfluences(mesh, vertexIndices) {
  const skinIndex = mesh.geometry?.attributes?.skinIndex;
  const skinWeight = mesh.geometry?.attributes?.skinWeight;
  if (
    !skinIndex || !skinWeight || skinIndex.count !== skinWeight.count ||
    !Number.isSafeInteger(skinIndex.itemSize) || !Number.isSafeInteger(skinWeight.itemSize) ||
    skinIndex.itemSize < 1 || skinIndex.itemSize !== skinWeight.itemSize || skinIndex.itemSize > 4
  ) evaluatorFail('TARGET_SKIN_ATTRIBUTES_INVALID');
  const drivenBones = new Set();
  for (const vertexIndex of vertexIndices) {
    let totalWeight = 0;
    for (let component = 0; component < skinIndex.itemSize; component += 1) {
      const index = attributeComponent(skinIndex, vertexIndex, component, 'TARGET_SKIN_ATTRIBUTES_INVALID');
      const weight = attributeComponent(skinWeight, vertexIndex, component, 'TARGET_SKIN_ATTRIBUTES_INVALID');
      if (
        !Number.isSafeInteger(index) || index < 0 || index >= mesh.skeleton.bones.length ||
        !Number.isFinite(weight) || weight < 0
      ) {
        evaluatorFail('TARGET_SKIN_ATTRIBUTES_INVALID');
      }
      totalWeight += weight;
      if (weight > 0) drivenBones.add(index);
    }
    if (!Number.isFinite(totalWeight) || totalWeight <= 0) evaluatorFail('TARGET_SKIN_VERTEX_HAS_NO_INFLUENCE');
  }
  return drivenBones;
}

function numberToFloat64Hex(value) {
  const bytes = Buffer.allocUnsafe(8);
  bytes.writeDoubleBE(assertFiniteNumber(value, 'TARGET_HEIGHT_INVALID'));
  return bytes.toString('hex');
}

function float64HexToNumber(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{16}$/u.test(value)) evaluatorFail('TARGET_HEIGHT_RECEIPT_INVALID');
  const number = Buffer.from(value, 'hex').readDoubleBE();
  return assertFiniteNumber(number, 'TARGET_HEIGHT_RECEIPT_INVALID');
}

function makeTargetHeightReceipt(height, minimumY, maximumY, targetMeshRecords) {
  const targetMeshUUIDs = targetMeshRecords.map(({ collected }) => collected.meshID);
  const body = {
    schema: 'p30.r012a.target-height.v1',
    absoluteTick: 0,
    heightBinary64: numberToFloat64Hex(height),
    minimumYBinary64: numberToFloat64Hex(minimumY),
    maximumYBinary64: numberToFloat64Hex(maximumY),
    targetMeshUUIDs: [...targetMeshUUIDs].sort(compareUtf8)
  };
  const receipt = { ...body, receiptSha256: sha256Hex(canonicalBytes(body)) };
  Object.defineProperty(receipt, 'targetMeshReferences', {
    value: targetMeshRecords.map(({ mesh }) => mesh),
    enumerable: false,
    writable: false,
    configurable: false
  });
  return receipt;
}

function validateTargetHeightReceipt(receipt, targetMeshRecords) {
  const targetMeshUUIDs = targetMeshRecords.map(({ collected }) => collected.meshID);
  try {
    assertExactKeys(receipt, [
      'schema', 'absoluteTick', 'heightBinary64', 'minimumYBinary64', 'maximumYBinary64',
      'targetMeshUUIDs', 'receiptSha256'
    ], 'TARGET_HEIGHT_RECEIPT_INVALID');
  } catch (error) {
    if (error instanceof Round012TreeError) evaluatorFail(error.code);
    throw error;
  }
  if (receipt.schema !== 'p30.r012a.target-height.v1' || receipt.absoluteTick !== 0) evaluatorFail('TARGET_HEIGHT_RECEIPT_INVALID');
  assertHex64(receipt.receiptSha256, 'TARGET_HEIGHT_RECEIPT_INVALID');
  const { receiptSha256, ...body } = receipt;
  if (sha256Hex(canonicalBytes(body)) !== receiptSha256) evaluatorFail('TARGET_HEIGHT_RECEIPT_HASH_MISMATCH');
  const expectedIDs = [...targetMeshUUIDs].sort(compareUtf8);
  if (!Array.isArray(receipt.targetMeshUUIDs) || canonicalBytes(receipt.targetMeshUUIDs).compare(canonicalBytes(expectedIDs)) !== 0) {
    evaluatorFail('TARGET_HEIGHT_MESH_SET_MUTATED');
  }
  if (
    !Array.isArray(receipt.targetMeshReferences) || receipt.targetMeshReferences.length !== targetMeshRecords.length ||
    receipt.targetMeshReferences.some((mesh, index) => mesh !== targetMeshRecords[index].mesh)
  ) evaluatorFail('TARGET_HEIGHT_MESH_IDENTITY_MUTATED');
  const minimumY = float64HexToNumber(receipt.minimumYBinary64);
  const maximumY = float64HexToNumber(receipt.maximumYBinary64);
  const height = float64HexToNumber(receipt.heightBinary64);
  if (maximumY - minimumY !== height) evaluatorFail('TARGET_HEIGHT_RECEIPT_INVALID');
  return height;
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
export function collectGeometrySource(source, { absoluteTick, targetHeightReceipt = null } = {}) {
  if (!Number.isSafeInteger(absoluteTick) || absoluteTick < -1 || absoluteTick > 80) {
    evaluatorFail('GEOMETRY_ABSOLUTE_TICK_REQUIRED');
  }
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
  if (
    leftHandBone === rightHandBone || !leftHandBone.isBone || !rightHandBone.isBone ||
    !isDescendantOrSelf(leftHandBone, heroRoot) || !isDescendantOrSelf(rightHandBone, heroRoot)
  ) evaluatorFail('RENDERED_HAND_BONE_INVALID');
  if (!Array.isArray(source.swordBladePrimitives) || source.swordBladePrimitives.length === 0) {
    evaluatorFail('BLADE_PRIMITIVES_MISSING');
  }
  const bladeVertices = [];
  const bladeTriangles = [];
  const bladeVertexKeys = new Set();
  const selectedBladeGroups = new Map();
  for (const primitive of source.swordBladePrimitives) {
    try {
      assertExactKeys(primitive, ['mesh', 'materialGroupIndices'], 'BLADE_PRIMITIVE_SHAPE_MISMATCH');
    } catch (error) {
      if (error instanceof Round012TreeError) evaluatorFail(error.code);
      throw error;
    }
    if (!isDescendantOrSelf(primitive.mesh, heroRoot)) evaluatorFail('BLADE_MESH_DETACHED_FROM_HERO');
    const collected = collectMeshTriangles(primitive.mesh, camera, primitive.materialGroupIndices, true);
    const priorGroups = selectedBladeGroups.get(primitive.mesh) ?? new Set();
    if (primitive.materialGroupIndices.some((groupIndex) => priorGroups.has(groupIndex))) {
      evaluatorFail('BLADE_PRIMITIVE_GROUP_DUPLICATE');
    }
    primitive.materialGroupIndices.forEach((groupIndex) => priorGroups.add(groupIndex));
    selectedBladeGroups.set(primitive.mesh, priorGroups);
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
  const targetMeshRecords = [];
  const targetMeshIdentities = new Set();
  const targetMeshUUIDsSeen = new Set();
  for (const mesh of source.targetSkinnedMeshes) {
    if (!mesh?.isSkinnedMesh) evaluatorFail('TARGET_MESH_NOT_SKINNED');
    if (targetMeshIdentities.has(mesh)) evaluatorFail('TARGET_MESH_DUPLICATE');
    targetMeshIdentities.add(mesh);
    if (!isDescendantOrSelf(mesh, targetRoot)) evaluatorFail('TARGET_MESH_DETACHED_FROM_ROOT');
    if (!mesh.skeleton || !Array.isArray(mesh.skeleton.bones) || mesh.skeleton.bones.length === 0) {
      evaluatorFail('TARGET_SKELETON_INVALID');
    }
    if (new Set(mesh.skeleton.bones).size !== mesh.skeleton.bones.length || mesh.skeleton.bones.some((bone) => !bone?.isBone)) {
      evaluatorFail('TARGET_SKELETON_INVALID');
    }
    const collected = collectMeshTriangles(mesh, camera);
    if (targetMeshUUIDsSeen.has(collected.meshID)) evaluatorFail('TARGET_MESH_UUID_DUPLICATE');
    targetMeshUUIDsSeen.add(collected.meshID);
    targetVertices.push(...collected.vertices);
    targetTriangles.push(...collected.triangles);
    targetMeshRecords.push({ mesh, collected, drivenBoneIndices: renderedSkinInfluences(mesh, collected.vertexIndices) });
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
  const landmarkBones = LANDMARK_KEYS.map((key) => source.targetLandmarkBones[key]);
  if (new Set(landmarkBones).size !== LANDMARK_KEYS.length) evaluatorFail('TARGET_LANDMARK_DUPLICATE');
  const landmarks = {};
  LANDMARK_KEYS.forEach((key) => {
    const bone = source.targetLandmarkBones[key];
    if (!bone?.isBone) evaluatorFail('RENDER_DRIVING_BONE_INVALID');
    if (!isDescendantOrSelf(bone, targetRoot)) evaluatorFail('TARGET_LANDMARK_DETACHED');
    let skeletonMember = false;
    let renderDriving = false;
    for (const { mesh, drivenBoneIndices } of targetMeshRecords) {
      const boneIndex = mesh.skeleton.bones.indexOf(bone);
      if (boneIndex < 0) continue;
      skeletonMember = true;
      if (drivenBoneIndices.has(boneIndex)) renderDriving = true;
    }
    if (!skeletonMember) evaluatorFail('TARGET_LANDMARK_NOT_IN_RENDERED_SKELETON');
    if (!renderDriving) evaluatorFail('TARGET_LANDMARK_NON_RENDER_DRIVING');
    landmarks[key] = boneWorldOrigin(bone);
  });
  const yValues = targetVertices.map((vertex) => vertex[1]);
  const minimumY = Math.min(...yValues);
  const maximumY = Math.max(...yValues);
  const measuredTargetHeight = maximumY - minimumY;
  let frozenHeightReceipt;
  let targetHeight;
  if (absoluteTick === 0) {
    if (targetHeightReceipt !== null) evaluatorFail('TARGET_HEIGHT_RECEIPT_PREEXISTS_TICK_ZERO');
    targetHeight = measuredTargetHeight;
    frozenHeightReceipt = makeTargetHeightReceipt(targetHeight, minimumY, maximumY, targetMeshRecords);
  } else {
    if (targetHeightReceipt === null) evaluatorFail('TARGET_HEIGHT_TICK_ZERO_RECEIPT_REQUIRED');
    targetHeight = validateTargetHeightReceipt(targetHeightReceipt, targetMeshRecords);
    frozenHeightReceipt = targetHeightReceipt;
  }
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
    targetHeightReceipt: frozenHeightReceipt,
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
  const guardPixel = projectWorldToPixel(blade.guard, viewProjectionMatrix);
  const tipPixel = projectWorldToPixel(blade.tip, viewProjectionMatrix);
  const axisDelta = [tipPixel[0] - guardPixel[0], tipPixel[1] - guardPixel[1]];
  const axisLength = Math.hypot(axisDelta[0], axisDelta[1]);
  if (axisLength < 4) evaluatorFail('BLADE_PROJECTED_AXIS_DEGENERATE');
  const axis = [axisDelta[0] / axisLength, axisDelta[1] / axisLength];
  const points = [];
  let minimumProjection = Infinity;
  let maximumProjection = -Infinity;
  for (let y = 0; y < VIEWPORT_HEIGHT; y += 1) {
    for (let x = 0; x < VIEWPORT_WIDTH; x += 1) {
      if (!boundary[y * VIEWPORT_WIDTH + x]) continue;
      const point = [x + 0.5, y + 0.5];
      const projection = point[0] * axis[0] + point[1] * axis[1];
      minimumProjection = Math.min(minimumProjection, projection);
      maximumProjection = Math.max(maximumProjection, projection);
      points.push({ point, projection });
    }
  }
  if (points.length === 0) evaluatorFail('BLADE_MASK_EMPTY');
  const extremeDistance = (expectedPoint, useMinimum) => {
    const extreme = useMinimum ? minimumProjection : maximumProjection;
    let result = Infinity;
    for (const entry of points) {
      if ((useMinimum ? entry.projection - extreme : extreme - entry.projection) > 0.75) continue;
      result = Math.min(result, Math.hypot(entry.point[0] - expectedPoint[0], entry.point[1] - expectedPoint[1]));
    }
    return result;
  };
  const guardDistancePixels = extremeDistance(guardPixel, true);
  const tipDistancePixels = extremeDistance(tipPixel, false);
  return {
    guardPixel,
    tipPixel,
    silhouetteMinimumAxialProjection: minimumProjection,
    silhouetteMaximumAxialProjection: maximumProjection,
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
      const contactsAtSubstep = [];
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
        if (separation <= EPS) {
          intervalContact = true;
          contactsAtSubstep.push({
            absoluteTick: tick,
            substep,
            capsuleID: afterCapsule.id,
            separation,
            closestBladePoint: closest.point1,
            closestTargetPoint: closest.point2
          });
        }
      }
      if (firstSample === null && contactsAtSubstep.length > 0) {
        contactsAtSubstep.sort((left, right) => compareUtf8(left.capsuleID, right.capsuleID));
        [firstSample] = contactsAtSubstep;
        if (firstContact === null) firstContact = firstSample;
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

export function canonicalContactFrame(result, basis) {
  const canonical = validateBasis(basis);
  if (!canonicalContactChecks(result).pass || !result.firstContact) evaluatorFail('CANONICAL_CONTACT_RESULT_FAILED');
  const first = result.firstContact;
  const normal = normalize(
    subtract(vec3(first.closestBladePoint), vec3(first.closestTargetPoint)),
    'CONTACT_NORMAL_DEGENERATE'
  );
  const tangent = horizontalTangent(normal, canonical.right);
  const body = {
    schema: 'p30.r012a.canonical-contact-frame.v1',
    absoluteTick: first.absoluteTick,
    substep: first.substep,
    capsuleID: first.capsuleID,
    closestBladePointMicrometres: quantizeMicrometres(first.closestBladePoint),
    closestTargetPointMicrometres: quantizeMicrometres(first.closestTargetPoint),
    normalMicrounits: normal.map((component) => roundHalfAwayFromZero(component * 1_000_000_000_000)),
    tangentMicrounits: tangent.map((component) => roundHalfAwayFromZero(component * 1_000_000_000_000))
  };
  return { ...body, normal, tangent, receiptSha256: sha256Hex(canonicalBytes(body)) };
}

export function computeMissOffsetExtrema(stateSeries, basis, terminalTick = 80) {
  const canonical = validateBasis(basis);
  if (!Array.isArray(stateSeries) || stateSeries.length !== terminalTick + 2) evaluatorFail('SWEEP_TICK_SERIES_INVALID');
  const states = stateSeries.map((state, index) => validateSweepState(state, index - 1));
  const extrema = { Bmin: Infinity, Bmax: -Infinity, Tmin: Infinity, Tmax: -Infinity };
  const includeBlade = (point) => {
    const projection = dot(point, canonical.right);
    extrema.Bmin = Math.min(extrema.Bmin, projection - R_BLADE);
    extrema.Bmax = Math.max(extrema.Bmax, projection + R_BLADE);
  };
  const includeTarget = (point, radius) => {
    const projection = dot(point, canonical.right);
    extrema.Tmin = Math.min(extrema.Tmin, projection - radius);
    extrema.Tmax = Math.max(extrema.Tmax, projection + radius);
  };
  for (let tick = 0; tick <= terminalTick; tick += 1) {
    const previous = states[tick];
    const current = states[tick + 1];
    for (let substep = 1; substep <= SUBSTEPS; substep += 1) {
      const tau = substep / SUBSTEPS;
      includeBlade(lerp(previous.blade.guard, current.blade.guard, tau));
      includeBlade(lerp(previous.blade.tip, current.blade.tip, tau));
      for (let capsuleIndex = 0; capsuleIndex < current.targetCapsules.length; capsuleIndex += 1) {
        const beforeCapsule = previous.targetCapsules[capsuleIndex];
        const afterCapsule = current.targetCapsules[capsuleIndex];
        if (beforeCapsule.id !== afterCapsule.id || Math.abs(beforeCapsule.radius - afterCapsule.radius) > EPS) {
          evaluatorFail('SWEEP_TARGET_CAPSULE_MUTATED');
        }
        includeTarget(lerp(beforeCapsule.a, afterCapsule.a, tau), afterCapsule.radius);
        includeTarget(lerp(beforeCapsule.b, afterCapsule.b, tau), afterCapsule.radius);
      }
    }
  }
  if (Object.values(extrema).some((value) => !Number.isFinite(value))) evaluatorFail('MISS_EXTREMA_INVALID');
  return {
    ...extrema,
    receiptMicrometres: Object.fromEntries(Object.entries(extrema).map(([key, value]) => [key, quantizeMicrometres(value)])),
    sampledIntervals: terminalTick + 1,
    substepsPerInterval: SUBSTEPS,
    sampleCount: (terminalTick + 1) * SUBSTEPS
  };
}

function validateHealthSeries(healthByTick, hit) {
  if (!Array.isArray(healthByTick) || healthByTick.length !== 82) evaluatorFail('COUNTERFACTUAL_HEALTH_SERIES_INVALID');
  for (let index = 0; index < healthByTick.length; index += 1) {
    const entry = healthByTick[index];
    try { assertExactKeys(entry, ['absoluteTick', 'health'], 'COUNTERFACTUAL_HEALTH_SERIES_INVALID'); }
    catch (error) { if (error instanceof Round012TreeError) evaluatorFail(error.code); throw error; }
    const tick = index - 1;
    const expectedHealth = hit && tick >= 46 ? 75 : 100;
    if (entry.absoluteTick !== tick || entry.health !== expectedHealth) evaluatorFail('COUNTERFACTUAL_HEALTH_SERIES_INVALID');
  }
}

function sameIntegerVector(left, right) {
  return Array.isArray(left) && Array.isArray(right) && left.length === 3 &&
    left.every((value, index) => Number.isSafeInteger(value) && value === right[index]);
}

export function validateCounterfactualRuns({ hitOffsets, missOffsets, hitRuns, missRuns }) {
  if (!Array.isArray(hitOffsets) || hitOffsets.length !== 3 || !Array.isArray(hitRuns) || hitRuns.length !== 3) {
    evaluatorFail('COUNTERFACTUAL_HIT_RUN_COUNT_INVALID');
  }
  if (!Array.isArray(missOffsets) || missOffsets.length !== 2 || !Array.isArray(missRuns) || missRuns.length !== 2) {
    evaluatorFail('COUNTERFACTUAL_MISS_RUN_COUNT_INVALID');
  }
  hitRuns.forEach((run, index) => {
    try {
      assertExactKeys(run, [
        'index', 'offsetCanonicalMicrometres', 'evaluatorResult', 'healthByTick',
        'damageMutations', 'events', 'visibleTopology'
      ], 'COUNTERFACTUAL_HIT_RUN_SHAPE_INVALID');
    } catch (error) { if (error instanceof Round012TreeError) evaluatorFail(error.code); throw error; }
    if (run.index !== index || !sameIntegerVector(run.offsetCanonicalMicrometres, hitOffsets[index]?.canonicalMicrometres)) {
      evaluatorFail('COUNTERFACTUAL_HIT_OFFSET_MISMATCH');
    }
    if (
      run.evaluatorResult?.firstContactTick !== 46 ||
      !Array.isArray(run.evaluatorResult.risingContactTicks) ||
      run.evaluatorResult.risingContactTicks.length !== 1 || run.evaluatorResult.risingContactTicks[0] !== 46 ||
      !Number.isFinite(run.evaluatorResult.maximumPenetration) || run.evaluatorResult.maximumPenetration < -0.012000
    ) evaluatorFail('COUNTERFACTUAL_HIT_GEOMETRY_FAILED');
    validateHealthSeries(run.healthByTick, true);
    if (!Array.isArray(run.damageMutations) || run.damageMutations.length !== 1) evaluatorFail('COUNTERFACTUAL_HIT_DAMAGE_INVALID');
    const mutation = run.damageMutations[0];
    try { assertExactKeys(mutation, ['absoluteTick', 'before', 'after', 'amount'], 'COUNTERFACTUAL_HIT_DAMAGE_INVALID'); }
    catch (error) { if (error instanceof Round012TreeError) evaluatorFail(error.code); throw error; }
    if (mutation.absoluteTick !== 46 || mutation.before !== 100 || mutation.after !== 75 || mutation.amount !== 25) {
      evaluatorFail('COUNTERFACTUAL_HIT_DAMAGE_INVALID');
    }
    if (
      !Array.isArray(run.events) ||
      run.events.filter((event) => event?.type === 'damage' && event.absoluteTick === 46).length !== 1
    ) {
      evaluatorFail('COUNTERFACTUAL_HIT_EVENT_INVALID');
    }
    if (run.events.some((event) => !['contact', 'hit', 'damage'].includes(event?.type) || event.absoluteTick !== 46)) {
      evaluatorFail('COUNTERFACTUAL_HIT_EVENT_INVALID');
    }
    if (run.visibleTopology?.pass !== true) evaluatorFail('COUNTERFACTUAL_HIT_TOPOLOGY_FAILED');
  });
  missRuns.forEach((run, index) => {
    try {
      assertExactKeys(run, [
        'index', 'offsetCanonicalMicrometres', 'evaluatorResult', 'healthByTick',
        'events', 'reactionOrRecoil', 'maximumTargetDriftMetres'
      ], 'COUNTERFACTUAL_MISS_RUN_SHAPE_INVALID');
    } catch (error) { if (error instanceof Round012TreeError) evaluatorFail(error.code); throw error; }
    if (run.index !== index || !sameIntegerVector(run.offsetCanonicalMicrometres, missOffsets[index]?.canonicalMicrometres)) {
      evaluatorFail('COUNTERFACTUAL_MISS_OFFSET_MISMATCH');
    }
    if (
      run.evaluatorResult?.firstContactTick !== null ||
      !Array.isArray(run.evaluatorResult.risingContactTicks) || run.evaluatorResult.risingContactTicks.length !== 0 ||
      !Number.isFinite(run.evaluatorResult.maximumPenetration) || run.evaluatorResult.maximumPenetration < 0.250000
    ) evaluatorFail('COUNTERFACTUAL_MISS_CLEARANCE_FAILED');
    validateHealthSeries(run.healthByTick, false);
    if (!Array.isArray(run.events) || run.events.length !== 0) evaluatorFail('COUNTERFACTUAL_MISS_EVENT_INVALID');
    if (run.reactionOrRecoil !== false) evaluatorFail('COUNTERFACTUAL_MISS_REACTION_INVALID');
    if (!Number.isFinite(run.maximumTargetDriftMetres) || run.maximumTargetDriftMetres < 0 || run.maximumTargetDriftMetres > 0.010000) {
      evaluatorFail('COUNTERFACTUAL_MISS_DRIFT_FAILED');
    }
  });
  return { hitRunsVerified: 3, missRunsVerified: 2, pass: true };
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

function maskCentroid(mask) {
  let count = 0;
  let xSum = 0;
  let ySum = 0;
  for (let y = 0; y < VIEWPORT_HEIGHT; y += 1) {
    for (let x = 0; x < VIEWPORT_WIDTH; x += 1) {
      if (!mask[y * VIEWPORT_WIDTH + x]) continue;
      count += 1;
      xSum += x + 0.5;
      ySum += y + 0.5;
    }
  }
  if (count === 0) evaluatorFail('TOPOLOGY_MASK_EMPTY');
  return { x: xSum / count, y: ySum / count, pixels: count };
}

export function topologyContinuityChecks(frames) {
  if (!Array.isArray(frames) || frames.length !== 5) evaluatorFail('TOPOLOGY_CONTINUITY_FRAME_COUNT_INVALID');
  const prepared = frames.map((frame, index) => {
    try {
      assertExactKeys(frame, [
        'absoluteTick', 'bladeMask', 'targetMask', 'viewProjectionMatrix', 'cameraDigest',
        'blade', 'landmarks', 'productionFrameSha256', 'productionFrameUnannotated',
        'baselineEffectsObscureTopology'
      ], 'TOPOLOGY_CONTINUITY_FRAME_SHAPE_INVALID');
    } catch (error) { if (error instanceof Round012TreeError) evaluatorFail(error.code); throw error; }
    if (frame.absoluteTick !== 44 + index) evaluatorFail('TOPOLOGY_CONTINUITY_TICK_ORDER_INVALID');
    if (!(frame.bladeMask instanceof Uint8Array) || frame.bladeMask.length !== VIEWPORT_WIDTH * VIEWPORT_HEIGHT) {
      evaluatorFail('TOPOLOGY_MASK_INVALID');
    }
    if (!(frame.targetMask instanceof Uint8Array) || frame.targetMask.length !== VIEWPORT_WIDTH * VIEWPORT_HEIGHT) {
      evaluatorFail('TOPOLOGY_MASK_INVALID');
    }
    assertHex64(frame.cameraDigest, 'TOPOLOGY_CAMERA_DIGEST_INVALID');
    assertHex64(frame.productionFrameSha256, 'TOPOLOGY_PRODUCTION_FRAME_HASH_INVALID');
    if (frame.productionFrameUnannotated !== true || frame.baselineEffectsObscureTopology !== false) {
      evaluatorFail('TOPOLOGY_PRODUCTION_FRAME_INVALID');
    }
    const guard = vec3(frame.blade?.guard, 'TOPOLOGY_BLADE_INVALID');
    const tip = vec3(frame.blade?.tip, 'TOPOLOGY_BLADE_INVALID');
    const viewProjectionMatrix = [...frame.viewProjectionMatrix];
    multiplyMatrix4Vector4(viewProjectionMatrix, [0, 0, 0, 1]);
    try { assertExactKeys(frame.landmarks, LANDMARK_KEYS, 'TOPOLOGY_LANDMARK_SHAPE_INVALID'); }
    catch (error) { if (error instanceof Round012TreeError) evaluatorFail(error.code); throw error; }
    const landmarks = Object.fromEntries(LANDMARK_KEYS.map((key) => [key, vec3(frame.landmarks[key])]));
    return {
      ...frame,
      blade: { guard, tip },
      landmarks,
      viewProjectionMatrix,
      bladeCentroid: maskCentroid(frame.bladeMask),
      targetCentroid: maskCentroid(frame.targetMask),
      topology: analyzeMaskTopology(frame.bladeMask, frame.targetMask)
    };
  });
  const checks = {
    cameraContinuous: prepared.every((frame) =>
      frame.cameraDigest === prepared[0].cameraDigest &&
      frame.viewProjectionMatrix.every((value, index) => Object.is(value, prepared[0].viewProjectionMatrix[index]))
    ),
    distinctProductionFrames: new Set(prepared.map((frame) => frame.productionFrameSha256)).size === 5,
    weaponVisibleEveryTick: prepared.every((frame) => frame.bladeCentroid.pixels > 0),
    targetVisibleEveryTick: prepared.every((frame) => frame.targetCentroid.pixels > 0),
    endpointContinuity: true,
    silhouetteContinuity: true,
    landmarkContinuity: true,
    tick45And46Topology: visibleTopologyChecks(prepared[1].topology, prepared[2].topology).pass
  };
  for (let index = 1; index < prepared.length; index += 1) {
    const before = prepared[index - 1];
    const after = prepared[index];
    if (
      length(subtract(after.blade.guard, before.blade.guard)) > 0.500000 ||
      length(subtract(after.blade.tip, before.blade.tip)) > 0.500000 ||
      Math.abs(length(subtract(after.blade.tip, after.blade.guard)) - length(subtract(before.blade.tip, before.blade.guard))) > 0.050000
    ) checks.endpointContinuity = false;
    if (
      Math.hypot(after.bladeCentroid.x - before.bladeCentroid.x, after.bladeCentroid.y - before.bladeCentroid.y) > 400 ||
      Math.hypot(after.targetCentroid.x - before.targetCentroid.x, after.targetCentroid.y - before.targetCentroid.y) > 200
    ) checks.silhouetteContinuity = false;
    if (LANDMARK_KEYS.some((key) => length(subtract(after.landmarks[key], before.landmarks[key])) > 0.300000)) {
      checks.landmarkContinuity = false;
    }
  }
  return { checks, perTick: prepared.map((frame) => ({ absoluteTick: frame.absoluteTick, topology: frame.topology })), pass: Object.values(checks).every(Boolean) };
}

function validatedPixelRect(rectangle, code = 'PIXEL_RECTANGLE_INVALID') {
  try { assertExactKeys(rectangle, ['x', 'y', 'width', 'height'], code); }
  catch (error) { if (error instanceof Round012TreeError) evaluatorFail(error.code); throw error; }
  for (const key of ['x', 'y', 'width', 'height']) assertFiniteNumber(rectangle[key], code);
  if (rectangle.width <= 0 || rectangle.height <= 0) evaluatorFail(code);
  return rectangle;
}

function unionRectangles(rectangles) {
  return {
    x: Math.min(...rectangles.map((rect) => rect.x)),
    y: Math.min(...rectangles.map((rect) => rect.y)),
    width: Math.max(...rectangles.map((rect) => rect.x + rect.width)) - Math.min(...rectangles.map((rect) => rect.x)),
    height: Math.max(...rectangles.map((rect) => rect.y + rect.height)) - Math.min(...rectangles.map((rect) => rect.y))
  };
}

export function deriveActionCrop({ heroBounds, weaponBounds, targetBounds, hudBounds }) {
  const actorBounds = [heroBounds, weaponBounds, targetBounds].map((rect) => validatedPixelRect(rect, 'ACTION_CROP_ACTOR_BOUNDS_INVALID'));
  if (!Array.isArray(hudBounds) || hudBounds.length === 0) evaluatorFail('ACTION_CROP_HUD_BOUNDS_REQUIRED');
  const hud = hudBounds.map((rect) => validatedPixelRect(rect, 'ACTION_CROP_HUD_BOUNDS_INVALID'));
  for (const rectangle of [...actorBounds, ...hud]) {
    if (
      rectangle.x < 0 || rectangle.y < 0 ||
      rectangle.x + rectangle.width > VIEWPORT_WIDTH || rectangle.y + rectangle.height > VIEWPORT_HEIGHT
    ) evaluatorFail('ACTION_CROP_BOUNDS_OUTSIDE_FRAME');
  }
  const actors = unionRectangles(actorBounds);
  const expanded = {
    x: Math.max(0, actors.x - actors.width * ACTION_CROP_EXPANSION),
    y: Math.max(0, actors.y - actors.height * ACTION_CROP_EXPANSION),
    width: 0,
    height: 0
  };
  const expandedMaximumX = Math.min(VIEWPORT_WIDTH, actors.x + actors.width * (1 + ACTION_CROP_EXPANSION));
  const expandedMaximumY = Math.min(VIEWPORT_HEIGHT, actors.y + actors.height * (1 + ACTION_CROP_EXPANSION));
  expanded.width = expandedMaximumX - expanded.x;
  expanded.height = expandedMaximumY - expanded.y;
  const required = unionRectangles([expanded, ...hud]);
  const widthNeeded = Math.ceil(required.width);
  const heightNeeded = Math.ceil(required.height);
  const aspectUnit = Math.max(Math.ceil(widthNeeded / 16), Math.ceil(heightNeeded / 9));
  if (aspectUnit > 100) return { x: 0, y: 0, width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT };
  const width = aspectUnit * 16;
  const height = aspectUnit * 9;
  const centreX = required.x + required.width / 2;
  const centreY = required.y + required.height / 2;
  let x = clamp(Math.floor(centreX - width / 2), 0, VIEWPORT_WIDTH - width);
  let y = clamp(Math.floor(centreY - height / 2), 0, VIEWPORT_HEIGHT - height);
  if (x > required.x) x = Math.max(0, Math.floor(required.x));
  if (x + width < required.x + required.width) x = Math.min(VIEWPORT_WIDTH - width, Math.ceil(required.x + required.width - width));
  if (y > required.y) y = Math.max(0, Math.floor(required.y));
  if (y + height < required.y + required.height) y = Math.min(VIEWPORT_HEIGHT - height, Math.ceil(required.y + required.height - height));
  if (
    x > required.x + EPS || y > required.y + EPS ||
    x + width + EPS < required.x + required.width || y + height + EPS < required.y + required.height
  ) evaluatorFail('ACTION_CROP_CONTAINMENT_FAILED');
  return { x, y, width, height };
}

export function deriveContactRoi({ closestBladePoint, closestTargetPoint, viewProjectionMatrix }) {
  const centreWorld = scale(add(vec3(closestBladePoint), vec3(closestTargetPoint)), 0.5);
  const centrePixel = projectWorldToPixel(centreWorld, viewProjectionMatrix);
  const x = clamp(Math.floor(centrePixel[0] - CONTACT_ROI_SIZE / 2), 0, VIEWPORT_WIDTH - CONTACT_ROI_SIZE);
  const y = clamp(Math.floor(centrePixel[1] - CONTACT_ROI_SIZE / 2), 0, VIEWPORT_HEIGHT - CONTACT_ROI_SIZE);
  return {
    x,
    y,
    width: CONTACT_ROI_SIZE,
    height: CONTACT_ROI_SIZE,
    centrePixel,
    interpolation: 'none',
    resampled: false
  };
}

function assertRgbaImage(image, code = 'RGBA_IMAGE_INVALID') {
  try { assertExactKeys(image, ['width', 'height', 'rgba'], code); }
  catch (error) { if (error instanceof Round012TreeError) evaluatorFail(error.code); throw error; }
  if (
    !Number.isSafeInteger(image.width) || image.width <= 0 ||
    !Number.isSafeInteger(image.height) || image.height <= 0 ||
    !(image.rgba instanceof Uint8Array) || image.rgba.length !== image.width * image.height * 4
  ) evaluatorFail(code);
  return image;
}

function lanczos3(value) {
  const x = Math.abs(value);
  if (x < 1e-15) return 1;
  if (x >= 3) return 0;
  return (Math.sin(Math.PI * x) / (Math.PI * x)) * (Math.sin(Math.PI * x / 3) / (Math.PI * x / 3));
}

function resamplingContributions(inputStart, inputLength, outputLength) {
  const scaleFactor = outputLength / inputLength;
  const supportScale = Math.min(1, scaleFactor);
  const radius = 3 / supportScale;
  return Array.from({ length: outputLength }, (_, outputIndex) => {
    const centre = inputStart + (outputIndex + 0.5) / scaleFactor - 0.5;
    const first = Math.ceil(centre - radius);
    const last = Math.floor(centre + radius);
    const byInput = new Map();
    let total = 0;
    for (let inputIndex = first; inputIndex <= last; inputIndex += 1) {
      const clamped = clamp(inputIndex, inputStart, inputStart + inputLength - 1);
      const weight = lanczos3((centre - inputIndex) * supportScale) * supportScale;
      byInput.set(clamped, (byInput.get(clamped) ?? 0) + weight);
      total += weight;
    }
    if (!Number.isFinite(total) || Math.abs(total) < 1e-15) evaluatorFail('REFERENCE_RESAMPLE_NUMERIC_FAILURE');
    return [...byInput].map(([inputIndex, weight]) => [inputIndex, weight / total]);
  });
}

export function cropScaleRgbaLanczos3(imageValue, cropValue, maximumWidth, maximumHeight) {
  const image = assertRgbaImage(imageValue);
  const crop = validatedPixelRect(cropValue, 'REFERENCE_PIXEL_CROP_INVALID');
  if (
    !Number.isSafeInteger(crop.x) || !Number.isSafeInteger(crop.y) ||
    !Number.isSafeInteger(crop.width) || !Number.isSafeInteger(crop.height) ||
    crop.x < 0 || crop.y < 0 || crop.x + crop.width > image.width || crop.y + crop.height > image.height
  ) evaluatorFail('REFERENCE_PIXEL_CROP_INVALID');
  if (!Number.isSafeInteger(maximumWidth) || maximumWidth <= 0 || !Number.isSafeInteger(maximumHeight) || maximumHeight <= 0) {
    evaluatorFail('REFERENCE_DESTINATION_INVALID');
  }
  const scaleFactor = Math.min(1, maximumWidth / crop.width, maximumHeight / crop.height);
  const width = Math.max(1, Math.floor(crop.width * scaleFactor + 1e-12));
  const height = Math.max(1, Math.floor(crop.height * scaleFactor + 1e-12));
  if (width === crop.width && height === crop.height) {
    const rgba = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      const sourceStart = ((crop.y + y) * image.width + crop.x) * 4;
      rgba.set(image.rgba.subarray(sourceStart, sourceStart + width * 4), y * width * 4);
    }
    return { width, height, rgba, scaleFactorBinary64: numberToFloat64Hex(scaleFactor), algorithm: REFERENCE_SCALE_ALGORITHM };
  }
  const horizontal = resamplingContributions(crop.x, crop.width, width);
  const vertical = resamplingContributions(crop.y, crop.height, height);
  const rgba = new Uint8Array(width * height * 4);
  for (let outputY = 0; outputY < height; outputY += 1) {
    for (let outputX = 0; outputX < width; outputX += 1) {
      for (let channel = 0; channel < 4; channel += 1) {
        let value = 0;
        for (const [sourceY, yWeight] of vertical[outputY]) {
          for (const [sourceX, xWeight] of horizontal[outputX]) {
            value += image.rgba[(sourceY * image.width + sourceX) * 4 + channel] * xWeight * yWeight;
          }
        }
        rgba[(outputY * width + outputX) * 4 + channel] = clamp(roundHalfAwayFromZero(value), 0, 255);
      }
    }
  }
  return { width, height, rgba, scaleFactorBinary64: numberToFloat64Hex(scaleFactor), algorithm: REFERENCE_SCALE_ALGORITHM };
}

export async function decodeReferenceImagePixels(encodedBytes) {
  if (!Buffer.isBuffer(encodedBytes)) evaluatorFail('REFERENCE_IMAGE_INVALID');
  const dimensions = referenceImageDimensions(encodedBytes);
  if (
    typeof globalThis.Blob !== 'function' || typeof globalThis.createImageBitmap !== 'function' ||
    typeof globalThis.OffscreenCanvas !== 'function'
  ) evaluatorFail('REFERENCE_BROWSER_DECODER_UNAVAILABLE');
  const mimeType = encodedBytes[0] === 0xff ? 'image/jpeg' : 'image/webp';
  let bitmap;
  try {
    bitmap = await globalThis.createImageBitmap(
      new globalThis.Blob([encodedBytes], { type: mimeType }),
      { colorSpaceConversion: 'none', imageOrientation: 'none', premultiplyAlpha: 'none' }
    );
  } catch {
    evaluatorFail('REFERENCE_BROWSER_DECODE_FAILED');
  }
  try {
    if (bitmap.width !== dimensions.width || bitmap.height !== dimensions.height) {
      evaluatorFail('REFERENCE_BROWSER_DECODE_DIMENSION_MISMATCH');
    }
    const canvas = new globalThis.OffscreenCanvas(dimensions.width, dimensions.height);
    const context = canvas.getContext('2d', {
      alpha: true,
      colorSpace: 'srgb',
      desynchronized: false,
      willReadFrequently: true
    });
    if (!context) evaluatorFail('REFERENCE_BROWSER_CANVAS_UNAVAILABLE');
    context.globalCompositeOperation = 'copy';
    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, dimensions.width, dimensions.height);
    context.drawImage(bitmap, 0, 0);
    const pixels = context.getImageData(0, 0, dimensions.width, dimensions.height, { colorSpace: 'srgb' }).data;
    const rgba = Uint8Array.from(pixels);
    if (rgba.length !== dimensions.width * dimensions.height * 4) evaluatorFail('REFERENCE_BROWSER_DECODE_PIXELS_INVALID');
    return {
      width: dimensions.width,
      height: dimensions.height,
      rgba,
      encodedSha256: sha256Hex(encodedBytes),
      decodedRgbaSha256: sha256Hex(rgba),
      decoder: 'browser-createImageBitmap-offscreenCanvas-srgb-rgba8-v1'
    };
  } finally {
    if (typeof bitmap?.close === 'function') bitmap.close();
  }
}

export async function transformCommittedReferencePixels({ encodedBytes, selection, maximumWidth, maximumHeight }) {
  if (!Buffer.isBuffer(encodedBytes)) evaluatorFail('REFERENCE_IMAGE_INVALID');
  const dimensions = referenceImageDimensions(encodedBytes);
  if (
    sha256Hex(encodedBytes) !== selection?.sourceFileSha256 ||
    dimensions.width !== selection?.originalDimensions?.width || dimensions.height !== selection?.originalDimensions?.height ||
    selection.uniformScaleAlgorithm !== REFERENCE_SCALE_ALGORITHM
  ) evaluatorFail('REFERENCE_PIXEL_SOURCE_BINDING_FAILED');
  const decoded = await decodeReferenceImagePixels(encodedBytes);
  const image = { width: decoded.width, height: decoded.height, rgba: decoded.rgba };
  return cropScaleRgbaLanczos3(image, selection.cropRectangle, maximumWidth, maximumHeight);
}

const GLYPHS_5X7 = Object.freeze({
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01110'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001']
});

function drawLabel(board, textValue, centreX, topY) {
  const pixelScale = 3;
  const glyphWidth = 5 * pixelScale;
  const gap = 2 * pixelScale;
  const textWidth = textValue.length * glyphWidth + (textValue.length - 1) * gap;
  const startX = Math.floor(centreX - textWidth / 2);
  [...textValue].forEach((letter, letterIndex) => {
    const glyph = GLYPHS_5X7[letter];
    if (!glyph) evaluatorFail('BOARD_LABEL_GLYPH_MISSING');
    glyph.forEach((row, y) => [...row].forEach((bit, x) => {
      if (bit !== '1') return;
      for (let dy = 0; dy < pixelScale; dy += 1) for (let dx = 0; dx < pixelScale; dx += 1) {
        const pixelX = startX + letterIndex * (glyphWidth + gap) + x * pixelScale + dx;
        const pixelY = topY + y * pixelScale + dy;
        const offset = (pixelY * VIEWPORT_WIDTH + pixelX) * 4;
        board.set([238, 238, 238, 255], offset);
      }
    }));
  });
}

function placeRgba(board, image, x, y) {
  for (let row = 0; row < image.height; row += 1) {
    const sourceStart = row * image.width * 4;
    const destinationStart = ((y + row) * VIEWPORT_WIDTH + x) * 4;
    board.set(image.rgba.subarray(sourceStart, sourceStart + image.width * 4), destinationStart);
  }
}

export function composeAnonymousEqualBoard({
  presentationSeed,
  expectedPresentationCommit,
  itemID,
  order,
  leftImage,
  rightImage,
  leftPixelSha256,
  rightPixelSha256
}) {
  assertRaw32(presentationSeed, 'PRESENTATION_SEED_NOT_32_BYTES');
  if (presentationCommit(presentationSeed) !== expectedPresentationCommit) evaluatorFail('BOARD_PRESENTATION_COMMIT_MISMATCH');
  validateBallotTokens(itemID, [order?.left, order?.right]);
  const expectedOrder = deriveTwoSideOrder(presentationSeed, itemID, [order.left, order.right]);
  if (
    order.itemID !== itemID || order.left !== expectedOrder.left || order.right !== expectedOrder.right ||
    order.orderDigest !== expectedOrder.orderDigest
  ) evaluatorFail('BOARD_ORDER_BINDING_INVALID');
  const left = assertRgbaImage(leftImage, 'BOARD_SIDE_IMAGE_INVALID');
  const right = assertRgbaImage(rightImage, 'BOARD_SIDE_IMAGE_INVALID');
  if (sha256Hex(left.rgba) !== leftPixelSha256 || sha256Hex(right.rgba) !== rightPixelSha256) {
    evaluatorFail('BOARD_SOURCE_PIXEL_HASH_MISMATCH');
  }
  const board = new Uint8Array(VIEWPORT_WIDTH * VIEWPORT_HEIGHT * 4);
  for (let offset = 0; offset < board.length; offset += 4) board.set([24, 24, 24, 255], offset);
  const cellWidth = 744;
  const cellHeight = 788;
  const cellY = 72;
  const cellX = [40, 816];
  const sides = [
    cropScaleRgbaLanczos3(left, { x: 0, y: 0, width: left.width, height: left.height }, cellWidth, cellHeight),
    cropScaleRgbaLanczos3(right, { x: 0, y: 0, width: right.width, height: right.height }, cellWidth, cellHeight)
  ];
  drawLabel(board, 'LEFT', cellX[0] + cellWidth / 2, 22);
  drawLabel(board, 'RIGHT', cellX[1] + cellWidth / 2, 22);
  sides.forEach((side, index) => placeRgba(
    board,
    side,
    cellX[index] + Math.floor((cellWidth - side.width) / 2),
    cellY + Math.floor((cellHeight - side.height) / 2)
  ));
  return {
    width: VIEWPORT_WIDTH,
    height: VIEWPORT_HEIGHT,
    rgba: board,
    boardSha256: sha256Hex(board),
    publicLabels: ['LEFT', 'RIGHT'],
    backgroundRgba: [24, 24, 24, 255],
    cells: [{ x: cellX[0], y: cellY, width: cellWidth, height: cellHeight }, { x: cellX[1], y: cellY, width: cellWidth, height: cellHeight }],
    scaleAlgorithm: REFERENCE_SCALE_ALGORITHM,
    sourcePixelSha256s: [leftPixelSha256, rightPixelSha256]
  };
}

function assertNfcNonempty(value, code) {
  if (typeof value !== 'string' || !value || value.normalize('NFC') !== value || value.includes('\0')) evaluatorFail(code);
  return value;
}

function assertPositiveSafeInteger(value, code) {
  if (!Number.isSafeInteger(value) || value <= 0) evaluatorFail(code);
  return value;
}

export const PACKAGE_MAP_KEYS = Object.freeze(['schema', 'protocolID', 'packages']);
export const PACKAGE_MAP_ENTRY_KEYS = Object.freeze([
  'alias', 'builderIdentity', 'worktree', 'branch', 'sourceCommit', 'gitTree',
  'sourceArchiveSha256', 'sourceArchiveBytes', 'materializedSourceTreeSha256',
  'packageArchiveSha256', 'packageArchiveBytes', 'materializedPackageTreeSha256',
  'productionOutputTreeSha256', 'lockfilePath', 'lockfileSha256', 'buildCommand'
]);

export function validatePackageMap(document) {
  try { assertExactKeys(document, PACKAGE_MAP_KEYS, 'PACKAGE_MAP_SHAPE_MISMATCH'); }
  catch (error) { if (error instanceof Round012TreeError) evaluatorFail(error.code); throw error; }
  if (document.schema !== PACKAGE_MAP_SCHEMA || document.protocolID !== PROTOCOL_ID) evaluatorFail('PACKAGE_MAP_CONSTANT_MISMATCH');
  if (!Array.isArray(document.packages) || document.packages.length !== 2) evaluatorFail('PACKAGE_MAP_EXACTLY_TWO_PACKAGES_REQUIRED');
  const aliases = [];
  document.packages.forEach((entry) => {
    try { assertExactKeys(entry, PACKAGE_MAP_ENTRY_KEYS, 'PACKAGE_MAP_ENTRY_SHAPE_MISMATCH'); }
    catch (error) { if (error instanceof Round012TreeError) evaluatorFail(error.code); throw error; }
    assertAlias(entry.alias);
    aliases.push(entry.alias);
    for (const key of ['builderIdentity', 'worktree', 'branch']) assertNfcNonempty(entry[key], 'PACKAGE_MAP_IDENTITY_FIELD_INVALID');
    for (const key of ['sourceCommit', 'gitTree']) {
      if (typeof entry[key] !== 'string' || !/^[0-9a-f]{40}$/u.test(entry[key])) evaluatorFail('PACKAGE_MAP_GIT_ID_INVALID');
    }
    for (const key of [
      'sourceArchiveSha256', 'materializedSourceTreeSha256', 'packageArchiveSha256',
      'materializedPackageTreeSha256', 'productionOutputTreeSha256', 'lockfileSha256'
    ]) assertHex64(entry[key], 'PACKAGE_MAP_SHA256_INVALID');
    assertPositiveSafeInteger(entry.sourceArchiveBytes, 'PACKAGE_MAP_ARCHIVE_BYTES_INVALID');
    assertPositiveSafeInteger(entry.packageArchiveBytes, 'PACKAGE_MAP_ARCHIVE_BYTES_INVALID');
    try { validateRelativePath(entry.lockfilePath); } catch { evaluatorFail('PACKAGE_MAP_LOCKFILE_PATH_INVALID'); }
    if (entry.lockfilePath !== 'package-lock.json') evaluatorFail('PACKAGE_MAP_LOCKFILE_PATH_INVALID');
    if (
      !Array.isArray(entry.buildCommand) || entry.buildCommand.length !== 3 ||
      entry.buildCommand.some((part) => typeof part !== 'string' || part.normalize('NFC') !== part) ||
      entry.buildCommand[0] !== 'npm' || entry.buildCommand[1] !== 'run' || entry.buildCommand[2] !== 'build:critic'
    ) evaluatorFail('PACKAGE_MAP_BUILD_COMMAND_INVALID');
  });
  const sorted = [...aliases].sort(compareUtf8);
  if (aliases[0] !== sorted[0] || aliases[1] !== sorted[1] || aliases[0] === aliases[1]) {
    evaluatorFail('PACKAGE_MAP_ALIAS_ORDER_INVALID');
  }
  canonicalBytes(document);
  return document;
}

export function packageMapCommit(document, salt) {
  validatePackageMap(document);
  return saltedDocumentCommit(PACKAGE_MAP_COMMIT_DOMAIN, document, salt);
}

const PUBLIC_PACKAGE_RECEIPT_KEYS = Object.freeze(['schema', 'protocolID', 'packages']);
const PUBLIC_PACKAGE_ENTRY_KEYS = Object.freeze([
  'alias', 'packageArchiveSha256', 'packageArchiveBytes', 'materializedPackageTreeSha256',
  'productionOutputTreeSha256', 'criticInterfaceSha256'
]);

export function validatePublicPackageReceipt(document) {
  try { assertExactKeys(document, PUBLIC_PACKAGE_RECEIPT_KEYS, 'PUBLIC_PACKAGE_RECEIPT_SHAPE_MISMATCH'); }
  catch (error) { if (error instanceof Round012TreeError) evaluatorFail(error.code); throw error; }
  if (document.schema !== 'p30.r012a.public-package-receipt.v1' || document.protocolID !== PROTOCOL_ID) {
    evaluatorFail('PUBLIC_PACKAGE_RECEIPT_CONSTANT_MISMATCH');
  }
  if (!Array.isArray(document.packages) || document.packages.length !== 2) {
    evaluatorFail('PUBLIC_PACKAGE_RECEIPT_EXACTLY_TWO_REQUIRED');
  }
  const aliases = [];
  document.packages.forEach((entry) => {
    try { assertExactKeys(entry, PUBLIC_PACKAGE_ENTRY_KEYS, 'PUBLIC_PACKAGE_RECEIPT_ENTRY_SHAPE_MISMATCH'); }
    catch (error) { if (error instanceof Round012TreeError) evaluatorFail(error.code); throw error; }
    assertAlias(entry.alias);
    aliases.push(entry.alias);
    assertPositiveSafeInteger(entry.packageArchiveBytes, 'PUBLIC_PACKAGE_RECEIPT_BYTES_INVALID');
    for (const key of [
      'packageArchiveSha256', 'materializedPackageTreeSha256',
      'productionOutputTreeSha256', 'criticInterfaceSha256'
    ]) assertHex64(entry[key], 'PUBLIC_PACKAGE_RECEIPT_SHA256_INVALID');
  });
  const sorted = [...aliases].sort(compareUtf8);
  if (aliases[0] !== sorted[0] || aliases[1] !== sorted[1] || aliases[0] === aliases[1]) {
    evaluatorFail('PUBLIC_PACKAGE_RECEIPT_ALIAS_ORDER_INVALID');
  }
  canonicalBytes(document);
  return document;
}

export function verifyPackageMapReveal({ mapDocument, mapSalt, expectedMapCommit, publicPackageReceipt }) {
  validatePackageMap(mapDocument);
  validatePublicPackageReceipt(publicPackageReceipt);
  assertHex64(expectedMapCommit, 'PACKAGE_MAP_EXPECTED_COMMIT_INVALID');
  if (packageMapCommit(mapDocument, mapSalt) !== expectedMapCommit) evaluatorFail('PACKAGE_MAP_COMMIT_MISMATCH');
  mapDocument.packages.forEach((privateEntry, index) => {
    const publicEntry = publicPackageReceipt.packages[index];
    if (
      privateEntry.alias !== publicEntry.alias ||
      privateEntry.packageArchiveSha256 !== publicEntry.packageArchiveSha256 ||
      privateEntry.packageArchiveBytes !== publicEntry.packageArchiveBytes ||
      privateEntry.materializedPackageTreeSha256 !== publicEntry.materializedPackageTreeSha256 ||
      privateEntry.productionOutputTreeSha256 !== publicEntry.productionOutputTreeSha256
    ) evaluatorFail('PACKAGE_MAP_PUBLIC_RECEIPT_MISMATCH');
  });
  return { packageMapCommitVerified: true, publicPackageBindingsVerified: 2 };
}

const ALIAS_SCORE_KEYS = Object.freeze([
  'schema', 'protocolID', 'protocolPayloadSha256', 'baselineReceiptSha256',
  'roundCommitmentSha256', 'referenceCommit', 'packageMapCommit', 'identityRevealReceived',
  'runtime', 'executionOrder', 'candidates', 'pairwiseBallots', 'strongerAlias',
  'provisionalOutcome', 'evidenceManifestSha256', 'blindOrderManifestSha256', 'disqualifiers'
]);
const RUNTIME_KEYS = Object.freeze([
  'nodeExecutable', 'nodeVersion', 'npmVersion', 'browserExecutable', 'browserVersion',
  'launchArguments', 'gpuRenderer', 'viewportWidth', 'viewportHeight', 'deviceScaleFactor',
  'devicePixelRatio', 'zoomPercent', 'normalRoute', 'evaluatorHelperSha256'
]);
const CANDIDATE_SCORE_KEYS = Object.freeze([
  'alias', 'packageArchiveSha256', 'packageTreeSha256', 'productionOutputTreeSha256',
  'runProfiles', 'inputMeasurements', 'contactMeasurements', 'healthMeasurements',
  'counterfactualMeasurements', 'distinctnessMeasurements', 'recoveryMeasurements',
  'baselineComparisons', 'gates', 'referenceBallots', 'referenceWinCount',
  'visualScores', 'visualTotal', 'visualMinimum', 'disqualifiers', 'acceptanceChecks',
  'provisionallyAccepted', 'biggestRemainingGap'
]);
const GATE_IDS = Object.freeze([
  'O1', 'O2', 'O3', 'O4', 'O5',
  'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10'
]);
const CATEGORY_IDS = Object.freeze(['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'C10']);
const MEASUREMENT_SECTION_KEYS = Object.freeze(['schema', 'receiptSha256', 'evidenceSha256s', 'measurements']);
const ACCEPTANCE_CHECK_KEYS = Object.freeze([
  'noDisqualifier', 'objectiveGates', 'technicalGatesCurrentlyDecidable', 'pendingRevealOnly',
  'referenceWins', 'visualTotal', 'visualMinimum'
]);

function validateRuntime(runtime) {
  try { assertExactKeys(runtime, RUNTIME_KEYS, 'ALIAS_SCORE_RUNTIME_SHAPE_MISMATCH'); }
  catch (error) { if (error instanceof Round012TreeError) evaluatorFail(error.code); throw error; }
  for (const key of [
    'nodeExecutable', 'nodeVersion', 'npmVersion', 'browserExecutable', 'browserVersion',
    'gpuRenderer', 'normalRoute'
  ]) assertNfcNonempty(runtime[key], 'ALIAS_SCORE_RUNTIME_VALUE_INVALID');
  if (!runtime.nodeVersion.startsWith('v24.')) evaluatorFail('ALIAS_SCORE_NODE_VERSION_INVALID');
  if (!Array.isArray(runtime.launchArguments) || runtime.launchArguments.some((arg) => typeof arg !== 'string' || arg.normalize('NFC') !== arg)) {
    evaluatorFail('ALIAS_SCORE_LAUNCH_ARGUMENTS_INVALID');
  }
  if (
    runtime.viewportWidth !== VIEWPORT_WIDTH || runtime.viewportHeight !== VIEWPORT_HEIGHT ||
    runtime.deviceScaleFactor !== 1 || runtime.devicePixelRatio !== 1 || runtime.zoomPercent !== 100
  ) evaluatorFail('ALIAS_SCORE_RUNTIME_VIEWPORT_INVALID');
  assertHex64(runtime.evaluatorHelperSha256, 'ALIAS_SCORE_RUNTIME_HELPER_HASH_INVALID');
}

function validateMeasurementSection(section, expectedSchema) {
  try { assertExactKeys(section, MEASUREMENT_SECTION_KEYS, 'ALIAS_SCORE_MEASUREMENT_SECTION_SHAPE_MISMATCH'); }
  catch (error) { if (error instanceof Round012TreeError) evaluatorFail(error.code); throw error; }
  if (section.schema !== expectedSchema) evaluatorFail('ALIAS_SCORE_MEASUREMENT_SCHEMA_MISMATCH');
  assertHex64(section.receiptSha256, 'ALIAS_SCORE_MEASUREMENT_HASH_INVALID');
  if (!Array.isArray(section.evidenceSha256s) || section.evidenceSha256s.length === 0) evaluatorFail('ALIAS_SCORE_MEASUREMENT_EVIDENCE_INVALID');
  section.evidenceSha256s.forEach((digest) => assertHex64(digest, 'ALIAS_SCORE_MEASUREMENT_EVIDENCE_INVALID'));
  if (
    !section.measurements || Object.getPrototypeOf(section.measurements) !== Object.prototype ||
    Object.keys(section.measurements).length === 0
  ) evaluatorFail('ALIAS_SCORE_MEASUREMENTS_INVALID');
}

function validateGateSet(gates) {
  try { assertExactKeys(gates, GATE_IDS, 'ALIAS_SCORE_GATE_SET_SHAPE_MISMATCH'); }
  catch (error) { if (error instanceof Round012TreeError) evaluatorFail(error.code); throw error; }
  GATE_IDS.forEach((gateID) => {
    const gate = gates[gateID];
    try { assertExactKeys(gate, ['pass', 'evidenceSha256s', 'reason'], 'ALIAS_SCORE_GATE_SHAPE_MISMATCH'); }
    catch (error) { if (error instanceof Round012TreeError) evaluatorFail(error.code); throw error; }
    const pendingAllowed = gateID === 'T1' || gateID === 'T10';
    if (typeof gate.pass !== 'boolean' && !(pendingAllowed && gate.pass === 'pending-reveal')) evaluatorFail('ALIAS_SCORE_GATE_PASS_INVALID');
    if (!Array.isArray(gate.evidenceSha256s) || gate.evidenceSha256s.length === 0) evaluatorFail('ALIAS_SCORE_GATE_EVIDENCE_INVALID');
    gate.evidenceSha256s.forEach((digest) => assertHex64(digest, 'ALIAS_SCORE_GATE_EVIDENCE_INVALID'));
    assertNfcNonempty(gate.reason, 'ALIAS_SCORE_GATE_REASON_INVALID');
  });
}

function validateBallotRecord(ballot, expectedItemID, candidateAlias = null) {
  try {
    assertExactKeys(ballot, [
      'ballotID', 'itemID', 'orderDigest', 'leftToken', 'rightToken',
      'winner', 'castCount', 'boardSha256'
    ], 'ALIAS_SCORE_BALLOT_SHAPE_MISMATCH');
  } catch (error) { if (error instanceof Round012TreeError) evaluatorFail(error.code); throw error; }
  if (ballot.itemID !== expectedItemID || ballot.ballotID !== expectedItemID.split('/')[0]) evaluatorFail('ALIAS_SCORE_BALLOT_ID_MISMATCH');
  validateBallotTokens(ballot.itemID, [ballot.leftToken, ballot.rightToken]);
  assertHex64(ballot.orderDigest, 'ALIAS_SCORE_BALLOT_ORDER_HASH_INVALID');
  assertHex64(ballot.boardSha256, 'ALIAS_SCORE_BALLOT_BOARD_HASH_INVALID');
  if (![null, 'LEFT', 'RIGHT'].includes(ballot.winner) || ballot.castCount !== 1) evaluatorFail('ALIAS_SCORE_BALLOT_OUTCOME_INVALID');
  if (candidateAlias === null) return null;
  const winnerToken = ballot.winner === 'LEFT' ? ballot.leftToken : ballot.winner === 'RIGHT' ? ballot.rightToken : null;
  return winnerToken === candidateAlias;
}

function validateVisualScores(candidate) {
  try { assertExactKeys(candidate.visualScores, CATEGORY_IDS, 'ALIAS_SCORE_VISUAL_CATEGORY_SET_MISMATCH'); }
  catch (error) { if (error instanceof Round012TreeError) evaluatorFail(error.code); throw error; }
  const scores = CATEGORY_IDS.map((categoryID) => {
    const category = candidate.visualScores[categoryID];
    try { assertExactKeys(category, ['score', 'reason'], 'ALIAS_SCORE_VISUAL_CATEGORY_SHAPE_MISMATCH'); }
    catch (error) { if (error instanceof Round012TreeError) evaluatorFail(error.code); throw error; }
    if (!Number.isSafeInteger(category.score) || category.score < 0 || category.score > 10) evaluatorFail('ALIAS_SCORE_VISUAL_VALUE_INVALID');
    assertNfcNonempty(category.reason, 'ALIAS_SCORE_VISUAL_REASON_INVALID');
    return category.score;
  });
  const total = scores.reduce((sum, value) => sum + value, 0);
  const minimum = Math.min(...scores);
  if (candidate.visualTotal !== total || candidate.visualMinimum !== minimum) evaluatorFail('ALIAS_SCORE_VISUAL_AGGREGATE_MISMATCH');
  return { total, minimum };
}

function validateCandidateScore(candidate) {
  try { assertExactKeys(candidate, CANDIDATE_SCORE_KEYS, 'ALIAS_SCORE_CANDIDATE_SHAPE_MISMATCH'); }
  catch (error) { if (error instanceof Round012TreeError) evaluatorFail(error.code); throw error; }
  assertAlias(candidate.alias);
  for (const key of ['packageArchiveSha256', 'packageTreeSha256', 'productionOutputTreeSha256']) {
    assertHex64(candidate[key], 'ALIAS_SCORE_CANDIDATE_PACKAGE_HASH_INVALID');
  }
  const sections = [
    ['runProfiles', 'p30.r012a.run-profiles.v1'],
    ['inputMeasurements', 'p30.r012a.input-measurements.v1'],
    ['contactMeasurements', 'p30.r012a.contact-measurements.v1'],
    ['healthMeasurements', 'p30.r012a.health-measurements.v1'],
    ['counterfactualMeasurements', 'p30.r012a.counterfactual-measurements.v1'],
    ['distinctnessMeasurements', 'p30.r012a.distinctness-measurements.v1'],
    ['recoveryMeasurements', 'p30.r012a.recovery-measurements.v1'],
    ['baselineComparisons', 'p30.r012a.baseline-comparisons.v1']
  ];
  sections.forEach(([key, schema]) => validateMeasurementSection(candidate[key], schema));
  validateGateSet(candidate.gates);
  if (!Array.isArray(candidate.referenceBallots) || candidate.referenceBallots.length !== 3) {
    evaluatorFail('ALIAS_SCORE_REFERENCE_BALLOT_COUNT_INVALID');
  }
  const wins = candidate.referenceBallots.reduce((count, ballot, index) =>
    count + (validateBallotRecord(ballot, `R${index + 1}/${candidate.alias}`, candidate.alias) ? 1 : 0), 0);
  if (candidate.referenceWinCount !== wins) evaluatorFail('ALIAS_SCORE_REFERENCE_WIN_COUNT_MISMATCH');
  const visual = validateVisualScores(candidate);
  if (!Array.isArray(candidate.disqualifiers) || candidate.disqualifiers.some((value) => typeof value !== 'string' || !value)) {
    evaluatorFail('ALIAS_SCORE_CANDIDATE_DISQUALIFIERS_INVALID');
  }
  try { assertExactKeys(candidate.acceptanceChecks, ACCEPTANCE_CHECK_KEYS, 'ALIAS_SCORE_ACCEPTANCE_CHECK_SHAPE_MISMATCH'); }
  catch (error) { if (error instanceof Round012TreeError) evaluatorFail(error.code); throw error; }
  if (Object.values(candidate.acceptanceChecks).some((value) => typeof value !== 'boolean')) evaluatorFail('ALIAS_SCORE_ACCEPTANCE_CHECK_VALUE_INVALID');
  const objectives = ['O1', 'O2', 'O3', 'O4', 'O5'].every((id) => candidate.gates[id].pass === true);
  const technical = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9'].every((id) => candidate.gates[id].pass === true);
  const pendingOnly = candidate.gates.T1.pass === 'pending-reveal' && candidate.gates.T10.pass === 'pending-reveal';
  const expectedChecks = {
    noDisqualifier: candidate.disqualifiers.length === 0,
    objectiveGates: objectives,
    technicalGatesCurrentlyDecidable: technical,
    pendingRevealOnly: pendingOnly,
    referenceWins: wins === 3,
    visualTotal: visual.total >= 95,
    visualMinimum: visual.minimum >= 9
  };
  if (Object.entries(expectedChecks).some(([key, value]) => candidate.acceptanceChecks[key] !== value)) {
    evaluatorFail('ALIAS_SCORE_ACCEPTANCE_CHECK_MISMATCH');
  }
  const expectedProvisional = Object.values(expectedChecks).every(Boolean);
  if (candidate.provisionallyAccepted !== expectedProvisional) evaluatorFail('ALIAS_SCORE_PROVISIONAL_ACCEPTANCE_MISMATCH');
  if (expectedProvisional) {
    if (candidate.biggestRemainingGap !== null) evaluatorFail('ALIAS_SCORE_ACCEPTED_GAP_MUST_BE_NULL');
  } else if (
    typeof candidate.biggestRemainingGap !== 'string' ||
    !/^Biggest remaining gap: [^;\n]+ at [^;\n]+, which [^;\n]+\.$/u.test(candidate.biggestRemainingGap)
  ) evaluatorFail('ALIAS_SCORE_BIGGEST_GAP_INVALID');
  return candidate;
}

export function validateAliasOnlyScore(document, blindOrderManifest, expectedPresentationCommit, custodyBindings) {
  try { assertExactKeys(document, ALIAS_SCORE_KEYS, 'ALIAS_SCORE_SHAPE_MISMATCH'); }
  catch (error) { if (error instanceof Round012TreeError) evaluatorFail(error.code); throw error; }
  if (
    document.schema !== ALIAS_SCORE_SCHEMA || document.protocolID !== PROTOCOL_ID ||
    document.protocolPayloadSha256 !== PROTOCOL_PAYLOAD_SHA256 || document.baselineReceiptSha256 !== BASELINE_RECEIPT_SHA256 ||
    document.identityRevealReceived !== false
  ) evaluatorFail('ALIAS_SCORE_CONSTANT_MISMATCH');
  try {
    assertExactKeys(custodyBindings, [
      'roundCommitmentSha256', 'referenceCommit', 'packageMapCommit', 'evidenceManifestSha256',
      'blindOrderManifestSha256', 'evaluatorHelperSha256', 'publicPackageReceipt'
    ], 'ALIAS_SCORE_CUSTODY_BINDINGS_SHAPE_MISMATCH');
  } catch (error) { if (error instanceof Round012TreeError) evaluatorFail(error.code); throw error; }
  validatePublicPackageReceipt(custodyBindings.publicPackageReceipt);
  for (const key of [
    'roundCommitmentSha256', 'referenceCommit', 'packageMapCommit', 'evidenceManifestSha256',
    'blindOrderManifestSha256', 'evaluatorHelperSha256'
  ]) assertHex64(custodyBindings[key], 'ALIAS_SCORE_CUSTODY_BINDING_HASH_INVALID');
  for (const key of [
    'roundCommitmentSha256', 'referenceCommit', 'packageMapCommit',
    'evidenceManifestSha256', 'blindOrderManifestSha256'
  ]) assertHex64(document[key], 'ALIAS_SCORE_SHA256_INVALID');
  validateRuntime(document.runtime);
  const directBindings = [
    ['roundCommitmentSha256', 'roundCommitmentSha256'],
    ['referenceCommit', 'referenceCommit'],
    ['packageMapCommit', 'packageMapCommit'],
    ['evidenceManifestSha256', 'evidenceManifestSha256'],
    ['blindOrderManifestSha256', 'blindOrderManifestSha256']
  ];
  if (
    directBindings.some(([documentKey, bindingKey]) => document[documentKey] !== custodyBindings[bindingKey]) ||
    document.runtime.evaluatorHelperSha256 !== custodyBindings.evaluatorHelperSha256
  ) evaluatorFail('ALIAS_SCORE_CUSTODY_BINDING_MISMATCH');
  if (!Array.isArray(document.candidates) || document.candidates.length !== 2) evaluatorFail('ALIAS_SCORE_EXACTLY_TWO_CANDIDATES_REQUIRED');
  document.candidates.forEach(validateCandidateScore);
  const aliases = document.candidates.map((candidate) => candidate.alias);
  const sorted = [...aliases].sort(compareUtf8);
  if (aliases[0] !== sorted[0] || aliases[1] !== sorted[1] || aliases[0] === aliases[1]) evaluatorFail('ALIAS_SCORE_CANDIDATE_ORDER_INVALID');
  document.candidates.forEach((candidate, index) => {
    const receipt = custodyBindings.publicPackageReceipt.packages[index];
    if (
      candidate.alias !== receipt.alias ||
      candidate.packageArchiveSha256 !== receipt.packageArchiveSha256 ||
      candidate.packageTreeSha256 !== receipt.materializedPackageTreeSha256 ||
      candidate.productionOutputTreeSha256 !== receipt.productionOutputTreeSha256
    ) evaluatorFail('ALIAS_SCORE_PUBLIC_PACKAGE_BINDING_MISMATCH');
  });
  if (!Array.isArray(document.executionOrder) || document.executionOrder.length !== 2) evaluatorFail('ALIAS_SCORE_EXECUTION_ORDER_INVALID');
  const executionAliases = new Set();
  document.executionOrder.forEach((entry) => {
    try { assertExactKeys(entry, ['alias', 'orderDigest'], 'ALIAS_SCORE_EXECUTION_ORDER_SHAPE_MISMATCH'); }
    catch (error) { if (error instanceof Round012TreeError) evaluatorFail(error.code); throw error; }
    assertAlias(entry.alias);
    assertHex64(entry.orderDigest, 'ALIAS_SCORE_EXECUTION_ORDER_HASH_INVALID');
    executionAliases.add(entry.alias);
  });
  if (executionAliases.size !== 2 || aliases.some((alias) => !executionAliases.has(alias))) evaluatorFail('ALIAS_SCORE_EXECUTION_ORDER_INVALID');
  if (!Array.isArray(document.pairwiseBallots) || document.pairwiseBallots.length !== 3) evaluatorFail('ALIAS_SCORE_PAIRWISE_BALLOT_COUNT_INVALID');
  document.pairwiseBallots.forEach((ballot, index) => validateBallotRecord(ballot, `P${index + 1}`));
  if (!aliases.includes(document.strongerAlias)) evaluatorFail('ALIAS_SCORE_STRONGER_ALIAS_INVALID');
  const anyAccepted = document.candidates.some((candidate) => candidate.provisionallyAccepted);
  const expectedOutcome = anyAccepted ? 'PROVISIONAL_ACCEPTED_CANDIDATE_EXISTS' : 'NO_ACCEPTED_CANDIDATE';
  if (document.provisionalOutcome !== expectedOutcome) evaluatorFail('ALIAS_SCORE_OUTCOME_MISMATCH');
  if (!Array.isArray(document.disqualifiers) || document.disqualifiers.some((value) => typeof value !== 'string' || !value)) {
    evaluatorFail('ALIAS_SCORE_DISQUALIFIERS_INVALID');
  }
  if (document.disqualifiers.length > 0 && anyAccepted) evaluatorFail('ALIAS_SCORE_DISQUALIFIER_ACCEPTANCE_CONFLICT');
  if (!blindOrderManifest) evaluatorFail('ALIAS_SCORE_BLIND_ORDER_MANIFEST_REQUIRED');
  if (typeof expectedPresentationCommit !== 'string') evaluatorFail('ALIAS_SCORE_PRESENTATION_COMMIT_REQUIRED');
  validateBlindOrderManifest(blindOrderManifest, expectedPresentationCommit);
  if (blindOrderManifest.manifestSha256 !== document.blindOrderManifestSha256) {
    evaluatorFail('ALIAS_SCORE_BLIND_ORDER_MANIFEST_HASH_MISMATCH');
  }
  if (canonicalBytes(document.executionOrder).compare(canonicalBytes(blindOrderManifest.executionOrder)) !== 0) {
    evaluatorFail('ALIAS_SCORE_EXECUTION_ORDER_BINDING_MISMATCH');
  }
  const scoreOrders = [
    ...document.candidates.flatMap((candidate) => candidate.referenceBallots.map((ballot) => ({
      itemID: ballot.itemID,
      left: ballot.leftToken,
      right: ballot.rightToken,
      orderDigest: ballot.orderDigest
    }))),
    ...document.pairwiseBallots.map((ballot) => ({
      itemID: ballot.itemID,
      left: ballot.leftToken,
      right: ballot.rightToken,
      orderDigest: ballot.orderDigest
    }))
  ];
  if (canonicalBytes(scoreOrders).compare(canonicalBytes(blindOrderManifest.ballots)) !== 0) {
    evaluatorFail('ALIAS_SCORE_BALLOT_ORDER_BINDING_MISMATCH');
  }
  canonicalBytes(document);
  return document;
}

export function aliasScoreCommit(document, salt, blindOrderManifest, expectedPresentationCommit, custodyBindings) {
  validateAliasOnlyScore(document, blindOrderManifest, expectedPresentationCommit, custodyBindings);
  return saltedDocumentCommit(ALIAS_SCORE_COMMIT_DOMAIN, document, salt);
}

const REQUIRED_TRACE_IDS = Object.freeze([
  'MOUSE2_TAP_COLD_1', 'MOUSE2_TAP_COLD_2', 'MOUSE2_TAP_RESET', 'KEYK_TAP',
  'MOUSE2_HELD', 'NO_HEAVY', 'LIGHT_BASELINE', 'SHIFT_PLUS_7', 'CAPTURE_UNARMED',
  'HIT_OFFSET_0', 'HIT_OFFSET_1', 'HIT_OFFSET_2', 'MISS_OFFSET_POSITIVE', 'MISS_OFFSET_NEGATIVE'
]);
const CANONICAL_CAPTURE_TRACES = new Set(['MOUSE2_TAP_COLD_1', 'MOUSE2_TAP_COLD_2', 'MOUSE2_TAP_RESET']);
const EVIDENCE_ARTIFACT_KEYS = Object.freeze([
  'path', 'kind', 'byteCount', 'sha256', 'alias', 'packageArchiveSha256',
  'productionOutputTreeSha256', 'route', 'runProfileID', 'absoluteTicks',
  'heavyRelativeTicks', 'stateDigest', 'cameraDigest', 'inputTraceDigest',
  'evaluatorHelperDigest', 'browser', 'gpu', 'captureTimestamp',
  'sourceArtifactSha256s', 'derivation', 'custody'
]);
const EVIDENCE_KINDS = new Set([
  'production-frame', 'focused-frame', 'full-frame-strip', 'contact-roi', 'action-crop',
  'lossless-frame-sequence', 'lossless-video', 'state-log', 'event-log', 'geometry-log',
  'frame-evidence', 'run-receipt', 'diagnostic-mask'
]);
const REQUIRED_PER_RUN_KINDS = Object.freeze(['state-log', 'event-log', 'geometry-log', 'frame-evidence', 'run-receipt']);
const EVIDENCE_FILE_PROOFS = new WeakSet();
const TYPED_ARRAY_BYTE_LENGTH = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array.prototype),
  'byteLength'
).get;

function sameIntegerArray(actual, expected) {
  return Array.isArray(actual) && actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

function assertPathComponent(value, code) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(value)) evaluatorFail(code);
  return value;
}

export function evidenceArtifactClaimPath(artifact, traceID) {
  assertAlias(artifact?.alias);
  assertPathComponent(artifact?.runProfileID, 'EVIDENCE_ARTIFACT_RUN_PROFILE_INVALID');
  if (!REQUIRED_TRACE_IDS.includes(traceID)) evaluatorFail('EVIDENCE_MANIFEST_TRACE_ID_INVALID');
  if (!EVIDENCE_KINDS.has(artifact?.kind)) evaluatorFail('EVIDENCE_ARTIFACT_KIND_INVALID');
  if (artifact?.custody !== 'public') evaluatorFail('EVIDENCE_ARTIFACT_CUSTODY_INVALID');
  const claim = {
    alias: artifact.alias,
    runProfileID: artifact.runProfileID,
    traceID,
    kind: artifact.kind,
    absoluteTicks: artifact.absoluteTicks,
    heavyRelativeTicks: artifact.heavyRelativeTicks,
    byteCount: artifact.byteCount,
    sha256: artifact.sha256,
    packageArchiveSha256: artifact.packageArchiveSha256,
    productionOutputTreeSha256: artifact.productionOutputTreeSha256,
    route: artifact.route,
    stateDigest: artifact.stateDigest,
    cameraDigest: artifact.cameraDigest,
    inputTraceDigest: artifact.inputTraceDigest,
    evaluatorHelperDigest: artifact.evaluatorHelperDigest,
    browser: artifact.browser,
    gpu: artifact.gpu,
    captureTimestamp: artifact.captureTimestamp,
    sourceArtifactSha256s: artifact.sourceArtifactSha256s,
    derivation: artifact.derivation,
    custody: artifact.custody
  };
  const claimDigest = sha256Hex(canonicalBytes(claim));
  return `evidence/public/${artifact.alias}/${artifact.runProfileID}/${traceID}/${artifact.kind}/${claimDigest}-${artifact.sha256}.bin`;
}

function boardPathSlug(boardID) {
  if (PAIRWISE_BALLOT_IDS.includes(boardID)) return boardID;
  const match = /^(R[123])\/(candidate-[0-9a-f]{16})$/u.exec(boardID);
  if (!match) evaluatorFail('EVIDENCE_PRIVATE_BOARD_ID_INVALID');
  return `${match[1]}--${match[2]}`;
}

export function privateBoardClaimPath(board) {
  const claim = {
    boardID: board?.boardID,
    orderDigest: board?.orderDigest,
    leftToken: board?.leftToken,
    rightToken: board?.rightToken,
    byteCount: board?.byteCount,
    sha256: board?.sha256,
    leftSourceSha256: board?.leftSourceSha256,
    rightSourceSha256: board?.rightSourceSha256,
    compositorHelperSha256: board?.compositorHelperSha256
  };
  const claimDigest = sha256Hex(canonicalBytes(claim));
  return `evidence/private/boards/${boardPathSlug(board?.boardID)}/${claimDigest}-${board?.sha256}.rgba`;
}

function validateCustodyBytes(custodyBytesByPath, claimsByPath) {
  if (!(custodyBytesByPath instanceof Map)) evaluatorFail('EVIDENCE_CUSTODY_BYTES_REQUIRED');
  const providedCaseRegistry = new Map();
  for (const [path, bytes] of Map.prototype.entries.call(custodyBytesByPath)) {
    try { validateRelativePath(path); } catch { evaluatorFail('EVIDENCE_CUSTODY_PATH_INVALID'); }
    try { registerCaseFoldedPath(providedCaseRegistry, path); } catch (error) {
      if (error instanceof Round012TreeError) evaluatorFail('EVIDENCE_CUSTODY_PATH_COLLISION');
      throw error;
    }
    if (!claimsByPath.has(path)) evaluatorFail('EVIDENCE_UNDECLARED_BYTES');
    if (!(bytes instanceof Uint8Array) && (!bytes || typeof bytes !== 'object' || !EVIDENCE_FILE_PROOFS.has(bytes))) {
      evaluatorFail('EVIDENCE_CUSTODY_BYTES_INVALID');
    }
  }
  for (const [path, claim] of claimsByPath) {
    if (!Map.prototype.has.call(custodyBytesByPath, path)) {
      evaluatorFail(claim.type === 'private-board' ? 'EVIDENCE_PRIVATE_BOARD_BYTES_MISSING' : 'EVIDENCE_ARTIFACT_BYTES_MISSING');
    }
    const bytes = Map.prototype.get.call(custodyBytesByPath, path);
    let byteCount;
    let digest;
    if (bytes instanceof Uint8Array) {
      try {
        byteCount = TYPED_ARRAY_BYTE_LENGTH.call(bytes);
        digest = sha256Hex(bytes);
      } catch {
        evaluatorFail('EVIDENCE_CUSTODY_BYTES_INVALID');
      }
    } else {
      byteCount = bytes.byteCount;
      digest = bytes.sha256;
    }
    if (byteCount !== claim.byteCount || digest !== claim.sha256) {
      evaluatorFail(claim.type === 'private-board' ? 'EVIDENCE_PRIVATE_BOARD_BYTES_MISMATCH' : 'EVIDENCE_ARTIFACT_BYTES_MISMATCH');
    }
  }
  const suppliedCount = Object.getOwnPropertyDescriptor(Map.prototype, 'size').get.call(custodyBytesByPath);
  if (suppliedCount !== claimsByPath.size) evaluatorFail('EVIDENCE_CUSTODY_FILE_SET_MISMATCH');
}

function evidenceCanonicalSnapshot(value, code) {
  try {
    return parseJsonStrict(canonicalBytes(value).toString('utf8'));
  } catch {
    evaluatorFail(code);
  }
}

export function validateEvidenceManifest(
  document,
  custodyBytesByPath = null,
  blindOrderManifest = null,
  expectedPresentationCommit = null,
  publicPackageReceipt = null
) {
  document = evidenceCanonicalSnapshot(document, 'EVIDENCE_MANIFEST_SNAPSHOT_INVALID');
  if (blindOrderManifest !== null) {
    blindOrderManifest = evidenceCanonicalSnapshot(blindOrderManifest, 'EVIDENCE_BLIND_ORDER_SNAPSHOT_INVALID');
  }
  if (publicPackageReceipt !== null) {
    publicPackageReceipt = evidenceCanonicalSnapshot(publicPackageReceipt, 'EVIDENCE_PUBLIC_RECEIPT_SNAPSHOT_INVALID');
  }
  try {
    assertExactKeys(document, [
      'schema', 'protocolID', 'aliases', 'evaluatorHelperSha256', 'blindOrderManifestSha256',
      'captureRuns', 'artifacts', 'privateBoardHashes'
    ], 'EVIDENCE_MANIFEST_SHAPE_MISMATCH');
  } catch (error) { if (error instanceof Round012TreeError) evaluatorFail(error.code); throw error; }
  if (document.schema !== 'p30.r012a.evidence-manifest.v1' || document.protocolID !== PROTOCOL_ID) {
    evaluatorFail('EVIDENCE_MANIFEST_CONSTANT_MISMATCH');
  }
  assertHex64(document.evaluatorHelperSha256, 'EVIDENCE_MANIFEST_HELPER_HASH_INVALID');
  assertHex64(document.blindOrderManifestSha256, 'EVIDENCE_BLIND_ORDER_HASH_INVALID');
  if (!Array.isArray(document.aliases) || document.aliases.length !== 2) evaluatorFail('EVIDENCE_MANIFEST_EXACTLY_TWO_ALIASES_REQUIRED');
  if (!publicPackageReceipt) evaluatorFail('EVIDENCE_PUBLIC_PACKAGE_RECEIPT_REQUIRED');
  validatePublicPackageReceipt(publicPackageReceipt);
  document.aliases.forEach(assertAlias);
  const sortedAliases = [...document.aliases].sort(compareUtf8);
  if (!sameIntegerArray(document.aliases, sortedAliases) || document.aliases[0] === document.aliases[1]) {
    evaluatorFail('EVIDENCE_MANIFEST_ALIAS_ORDER_INVALID');
  }
  if (!Array.isArray(document.captureRuns) || document.captureRuns.length !== 2 * REQUIRED_TRACE_IDS.length) {
    evaluatorFail('EVIDENCE_MANIFEST_RUN_COUNT_INVALID');
  }
  const runByID = new Map();
  document.captureRuns.forEach((run) => {
    try {
      assertExactKeys(run, [
        'alias', 'runProfileID', 'traceID', 'inputTraceDigest', 'terminalTick'
      ], 'EVIDENCE_MANIFEST_RUN_SHAPE_MISMATCH');
    } catch (error) { if (error instanceof Round012TreeError) evaluatorFail(error.code); throw error; }
    if (!document.aliases.includes(run.alias)) evaluatorFail('EVIDENCE_MANIFEST_RUN_ALIAS_INVALID');
    assertPathComponent(run.runProfileID, 'EVIDENCE_MANIFEST_RUN_PROFILE_INVALID');
    if (!REQUIRED_TRACE_IDS.includes(run.traceID)) evaluatorFail('EVIDENCE_MANIFEST_TRACE_ID_INVALID');
    assertHex64(run.inputTraceDigest, 'EVIDENCE_MANIFEST_INPUT_HASH_INVALID');
    const expectedTerminal = run.traceID === 'SHIFT_PLUS_7' ? 87 : 80;
    if (run.terminalTick !== expectedTerminal) evaluatorFail('EVIDENCE_MANIFEST_TERMINAL_TICK_INVALID');
    const key = `${run.alias}\0${run.runProfileID}`;
    if (runByID.has(key)) evaluatorFail('EVIDENCE_MANIFEST_RUN_DUPLICATE');
    runByID.set(key, run);
  });
  for (const alias of document.aliases) {
    const traceIDs = document.captureRuns.filter((run) => run.alias === alias).map((run) => run.traceID).sort(compareUtf8);
    if (canonicalBytes(traceIDs).compare(canonicalBytes([...REQUIRED_TRACE_IDS].sort(compareUtf8))) !== 0) {
      evaluatorFail('EVIDENCE_MANIFEST_TRACE_COVERAGE_INVALID');
    }
  }
  if (!Array.isArray(document.artifacts) || document.artifacts.length === 0) evaluatorFail('EVIDENCE_MANIFEST_ARTIFACTS_EMPTY');
  const pathRegistry = new Map();
  const exactPaths = new Set();
  const claimsByPath = new Map();
  const semanticClaims = new Set();
  const artifactsByRun = new Map();
  for (const artifact of document.artifacts) {
    try { validateRelativePath(artifact?.path); } catch { evaluatorFail('EVIDENCE_ARTIFACT_PATH_INVALID'); }
    if (exactPaths.has(artifact.path)) evaluatorFail('EVIDENCE_ARTIFACT_PATH_DUPLICATE');
    exactPaths.add(artifact.path);
    try { registerCaseFoldedPath(pathRegistry, artifact.path); } catch (error) {
      if (error instanceof Round012TreeError) evaluatorFail('EVIDENCE_ARTIFACT_PATH_COLLISION');
      throw error;
    }
  }
  document.artifacts.forEach((artifact) => {
    try { assertExactKeys(artifact, EVIDENCE_ARTIFACT_KEYS, 'EVIDENCE_ARTIFACT_SHAPE_MISMATCH'); }
    catch (error) { if (error instanceof Round012TreeError) evaluatorFail(error.code); throw error; }
    if (!EVIDENCE_KINDS.has(artifact.kind)) evaluatorFail('EVIDENCE_ARTIFACT_KIND_INVALID');
    assertPositiveSafeInteger(artifact.byteCount, 'EVIDENCE_ARTIFACT_BYTE_COUNT_INVALID');
    assertHex64(artifact.sha256, 'EVIDENCE_ARTIFACT_SHA256_INVALID');
    if (!document.aliases.includes(artifact.alias)) evaluatorFail('EVIDENCE_ARTIFACT_ALIAS_INVALID');
    for (const key of [
      'packageArchiveSha256', 'productionOutputTreeSha256', 'stateDigest', 'cameraDigest',
      'inputTraceDigest', 'evaluatorHelperDigest'
    ]) assertHex64(artifact[key], 'EVIDENCE_ARTIFACT_PROVENANCE_HASH_INVALID');
    if (artifact.evaluatorHelperDigest !== document.evaluatorHelperSha256) evaluatorFail('EVIDENCE_ARTIFACT_HELPER_HASH_MISMATCH');
    assertNfcNonempty(artifact.route, 'EVIDENCE_ARTIFACT_ROUTE_INVALID');
    if (!artifact.route.startsWith('/')) evaluatorFail('EVIDENCE_ARTIFACT_ROUTE_INVALID');
    assertPathComponent(artifact.runProfileID, 'EVIDENCE_ARTIFACT_RUN_PROFILE_INVALID');
    const run = runByID.get(`${artifact.alias}\0${artifact.runProfileID}`);
    if (!run || run.inputTraceDigest !== artifact.inputTraceDigest) evaluatorFail('EVIDENCE_ARTIFACT_RUN_BINDING_INVALID');
    const semanticClaim = sha256Hex(canonicalBytes({
      alias: artifact.alias,
      runProfileID: artifact.runProfileID,
      traceID: run.traceID,
      kind: artifact.kind,
      absoluteTicks: artifact.absoluteTicks,
      heavyRelativeTicks: artifact.heavyRelativeTicks
    }));
    if (semanticClaims.has(semanticClaim)) evaluatorFail('EVIDENCE_ARTIFACT_CLAIM_DUPLICATE');
    semanticClaims.add(semanticClaim);
    if (artifact.path !== evidenceArtifactClaimPath(artifact, run.traceID)) {
      evaluatorFail('EVIDENCE_ARTIFACT_PATH_METADATA_MISMATCH');
    }
    const packageEntry = publicPackageReceipt.packages.find((entry) => entry.alias === artifact.alias);
    if (
      !packageEntry || artifact.packageArchiveSha256 !== packageEntry.packageArchiveSha256 ||
      artifact.productionOutputTreeSha256 !== packageEntry.productionOutputTreeSha256
    ) evaluatorFail('EVIDENCE_ARTIFACT_PUBLIC_PACKAGE_BINDING_MISMATCH');
    if (
      !Array.isArray(artifact.absoluteTicks) || artifact.absoluteTicks.length === 0 ||
      artifact.absoluteTicks.some((tick, index) => !Number.isSafeInteger(tick) || tick < 0 || tick > run.terminalTick || (index && tick <= artifact.absoluteTicks[index - 1]))
    ) evaluatorFail('EVIDENCE_ARTIFACT_TICKS_INVALID');
    if (!Array.isArray(artifact.heavyRelativeTicks) || artifact.heavyRelativeTicks.length !== artifact.absoluteTicks.length) {
      evaluatorFail('EVIDENCE_ARTIFACT_HEAVY_TICKS_INVALID');
    }
    const heavyEdge = run.traceID === 'SHIFT_PLUS_7' ? 31 : ['NO_HEAVY', 'LIGHT_BASELINE'].includes(run.traceID) ? null : 24;
    artifact.absoluteTicks.forEach((tick, index) => {
      const expected = heavyEdge === null || tick < heavyEdge ? null : tick - heavyEdge;
      if (artifact.heavyRelativeTicks[index] !== expected) evaluatorFail('EVIDENCE_ARTIFACT_HEAVY_TICKS_INVALID');
    });
    for (const key of ['browser', 'gpu', 'derivation']) assertNfcNonempty(artifact[key], 'EVIDENCE_ARTIFACT_TEXT_PROVENANCE_INVALID');
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(artifact.captureTimestamp)) {
      evaluatorFail('EVIDENCE_ARTIFACT_TIMESTAMP_INVALID');
    }
    if (!Array.isArray(artifact.sourceArtifactSha256s)) evaluatorFail('EVIDENCE_ARTIFACT_SOURCE_HASHES_INVALID');
    artifact.sourceArtifactSha256s.forEach((digest) => assertHex64(digest, 'EVIDENCE_ARTIFACT_SOURCE_HASHES_INVALID'));
    if (artifact.custody !== 'public') evaluatorFail('EVIDENCE_ARTIFACT_CUSTODY_INVALID');
    const collection = artifactsByRun.get(`${artifact.alias}\0${artifact.runProfileID}`) ?? [];
    collection.push(artifact);
    artifactsByRun.set(`${artifact.alias}\0${artifact.runProfileID}`, collection);
    claimsByPath.set(artifact.path, {
      type: 'artifact',
      byteCount: artifact.byteCount,
      sha256: artifact.sha256
    });
  });
  for (const run of document.captureRuns) {
    const artifacts = artifactsByRun.get(`${run.alias}\0${run.runProfileID}`) ?? [];
    for (const kind of REQUIRED_PER_RUN_KINDS) if (artifacts.filter((artifact) => artifact.kind === kind).length !== 1) {
      evaluatorFail('EVIDENCE_RUN_CORE_ARTIFACT_MISSING');
    }
    if (CANONICAL_CAPTURE_TRACES.has(run.traceID)) {
      const frames = artifacts.filter((artifact) => artifact.kind === 'production-frame' && artifact.absoluteTicks.length === 1)
        .map((artifact) => artifact.absoluteTicks[0]);
      for (let tick = 20; tick <= 80; tick += 1) if (frames.filter((value) => value === tick).length !== 1) evaluatorFail('EVIDENCE_CANONICAL_FRAME_MISSING');
      for (const tick of FOCUSED_CAPTURE_TICKS) if (artifacts.filter((artifact) => artifact.kind === 'focused-frame' && sameIntegerArray(artifact.absoluteTicks, [tick])).length !== 1) {
        evaluatorFail('EVIDENCE_FOCUSED_FRAME_MISSING');
      }
      const requiredStrips = [[40, 46], [44, 48], [46, 76]].map(([first, last]) => Array.from({ length: last - first + 1 }, (_, index) => first + index));
      for (const ticks of requiredStrips) if (artifacts.filter((artifact) => artifact.kind === 'full-frame-strip' && sameIntegerArray(artifact.absoluteTicks, ticks)).length !== 1) {
        evaluatorFail('EVIDENCE_FRAME_STRIP_MISSING');
      }
      if (artifacts.filter((artifact) => artifact.kind === 'contact-roi' && sameIntegerArray(artifact.absoluteTicks, [46])).length !== 1) {
        evaluatorFail('EVIDENCE_CONTACT_ROI_MISSING');
      }
      for (const tick of FOCUSED_CAPTURE_TICKS) if (artifacts.filter((artifact) => artifact.kind === 'action-crop' && sameIntegerArray(artifact.absoluteTicks, [tick])).length !== 1) {
        evaluatorFail('EVIDENCE_ACTION_CROP_MISSING');
      }
      const fullTicks = Array.from({ length: 81 }, (_, tick) => tick);
      if (artifacts.filter((artifact) => ['lossless-frame-sequence', 'lossless-video'].includes(artifact.kind) && sameIntegerArray(artifact.absoluteTicks, fullTicks)).length !== 1) {
        evaluatorFail('EVIDENCE_LOSSLESS_SEQUENCE_MISSING');
      }
    }
  }
  if (!Array.isArray(document.privateBoardHashes) || document.privateBoardHashes.length !== 9) {
    evaluatorFail('EVIDENCE_PRIVATE_BOARD_COUNT_INVALID');
  }
  const expectedBoardIDs = [
    ...document.aliases.flatMap((alias) => REFERENCE_BALLOT_IDS.map((id) => `${id}/${alias}`)),
    ...PAIRWISE_BALLOT_IDS
  ].sort(compareUtf8);
  const boardIDs = [];
  for (const board of document.privateBoardHashes) {
    try { validateRelativePath(board?.path); } catch { evaluatorFail('EVIDENCE_PRIVATE_BOARD_PATH_INVALID'); }
    if (exactPaths.has(board.path)) evaluatorFail('EVIDENCE_PRIVATE_BOARD_PATH_DUPLICATE');
    exactPaths.add(board.path);
    try { registerCaseFoldedPath(pathRegistry, board.path); } catch (error) {
      if (error instanceof Round012TreeError) evaluatorFail('EVIDENCE_PRIVATE_BOARD_PATH_COLLISION');
      throw error;
    }
  }
  document.privateBoardHashes.forEach((board) => {
    try {
      assertExactKeys(board, [
        'boardID', 'path', 'byteCount', 'sha256', 'orderDigest', 'leftToken', 'rightToken',
        'leftSourceSha256', 'rightSourceSha256', 'compositorHelperSha256'
      ], 'EVIDENCE_PRIVATE_BOARD_SHAPE_MISMATCH');
    }
    catch (error) { if (error instanceof Round012TreeError) evaluatorFail(error.code); throw error; }
    validateBallotTokens(board.boardID, [board.leftToken, board.rightToken]);
    assertPositiveSafeInteger(board.byteCount, 'EVIDENCE_PRIVATE_BOARD_BYTES_INVALID');
    if (board.byteCount !== VIEWPORT_WIDTH * VIEWPORT_HEIGHT * 4) evaluatorFail('EVIDENCE_PRIVATE_BOARD_BYTES_INVALID');
    assertHex64(board.sha256, 'EVIDENCE_PRIVATE_BOARD_HASH_INVALID');
    assertHex64(board.orderDigest, 'EVIDENCE_PRIVATE_BOARD_HASH_INVALID');
    assertHex64(board.leftSourceSha256, 'EVIDENCE_PRIVATE_BOARD_SOURCE_HASH_INVALID');
    assertHex64(board.rightSourceSha256, 'EVIDENCE_PRIVATE_BOARD_SOURCE_HASH_INVALID');
    if (board.compositorHelperSha256 !== document.evaluatorHelperSha256) evaluatorFail('EVIDENCE_PRIVATE_BOARD_HELPER_HASH_MISMATCH');
    if (board.path !== privateBoardClaimPath(board)) evaluatorFail('EVIDENCE_PRIVATE_BOARD_PATH_METADATA_MISMATCH');
    claimsByPath.set(board.path, {
      type: 'private-board',
      byteCount: board.byteCount,
      sha256: board.sha256
    });
    boardIDs.push(board.boardID);
  });
  if (canonicalBytes(boardIDs.sort(compareUtf8)).compare(canonicalBytes(expectedBoardIDs)) !== 0) {
    evaluatorFail('EVIDENCE_PRIVATE_BOARD_IDS_INVALID');
  }
  if (!blindOrderManifest) evaluatorFail('EVIDENCE_BLIND_ORDER_MANIFEST_REQUIRED');
  if (typeof expectedPresentationCommit !== 'string') evaluatorFail('EVIDENCE_PRESENTATION_COMMIT_REQUIRED');
  validateBlindOrderManifest(blindOrderManifest, expectedPresentationCommit);
  if (blindOrderManifest.manifestSha256 !== document.blindOrderManifestSha256) {
    evaluatorFail('EVIDENCE_BLIND_ORDER_MANIFEST_HASH_MISMATCH');
  }
  document.privateBoardHashes.forEach((board, index) => {
    const order = blindOrderManifest.ballots[index];
    if (
      !order || order.itemID !== board.boardID || order.orderDigest !== board.orderDigest ||
      order.left !== board.leftToken || order.right !== board.rightToken
    ) evaluatorFail('EVIDENCE_PRIVATE_BOARD_ORDER_MISMATCH');
  });
  validateCustodyBytes(custodyBytesByPath, claimsByPath);
  canonicalBytes(document);
  return document;
}

export async function verifyEvidenceManifestFiles(
  document,
  evidenceRoot,
  blindOrderManifest,
  expectedPresentationCommit,
  publicPackageReceipt
) {
  const tree = await hashTree(resolve(evidenceRoot));
  const proofsByPath = new Map();
  for (const entry of tree.entries) {
    const byteCount = Number(entry.bytes);
    if (!Number.isSafeInteger(byteCount)) evaluatorFail('EVIDENCE_FILE_BYTES_UNSAFE');
    const proof = {
      byteCount,
      sha256: entry.sha256
    };
    EVIDENCE_FILE_PROOFS.add(proof);
    proofsByPath.set(entry.path, proof);
  }
  validateEvidenceManifest(
    document,
    proofsByPath,
    blindOrderManifest,
    expectedPresentationCommit,
    publicPackageReceipt
  );
  return {
    evidenceFilesVerified: tree.fileCount,
    evidenceTreeSha256: tree.treeSha256,
    privateBoardFilesVerified: 9
  };
}

export function buildBlindOrderManifest(presentationSeed, aliasesValue) {
  assertRaw32(presentationSeed, 'PRESENTATION_SEED_NOT_32_BYTES');
  if (!Array.isArray(aliasesValue) || aliasesValue.length !== 2) evaluatorFail('EXACTLY_TWO_DISTINCT_ALIASES_REQUIRED');
  const aliases = [...aliasesValue].sort(compareUtf8);
  aliases.forEach(assertAlias);
  if (aliases[0] === aliases[1]) evaluatorFail('EXACTLY_TWO_DISTINCT_ALIASES_REQUIRED');
  const ballots = [
    ...aliases.flatMap((alias) => REFERENCE_BALLOT_IDS.map((id) =>
      deriveTwoSideOrder(presentationSeed, `${id}/${alias}`, [alias, `reference/${id}`])
    )),
    ...PAIRWISE_BALLOT_IDS.map((id) => deriveTwoSideOrder(presentationSeed, id, aliases))
  ];
  const body = {
    schema: 'p30.r012a.blind-order-manifest.v1',
    protocolID: PROTOCOL_ID,
    presentationCommit: presentationCommit(presentationSeed),
    executionOrder: deriveExecutionOrder(presentationSeed, aliases),
    ballots
  };
  return { ...body, manifestSha256: sha256Hex(canonicalBytes(body)) };
}

export function validateBlindOrderManifest(document, expectedPresentationCommit = null, presentationSeed = null) {
  try {
    assertExactKeys(document, [
      'schema', 'protocolID', 'presentationCommit', 'executionOrder', 'ballots', 'manifestSha256'
    ], 'BLIND_ORDER_MANIFEST_SHAPE_MISMATCH');
  } catch (error) { if (error instanceof Round012TreeError) evaluatorFail(error.code); throw error; }
  if (document.schema !== 'p30.r012a.blind-order-manifest.v1' || document.protocolID !== PROTOCOL_ID) {
    evaluatorFail('BLIND_ORDER_MANIFEST_CONSTANT_MISMATCH');
  }
  assertHex64(document.presentationCommit, 'BLIND_ORDER_MANIFEST_HASH_INVALID');
  if (expectedPresentationCommit !== null && document.presentationCommit !== expectedPresentationCommit) {
    evaluatorFail('BLIND_ORDER_PRESENTATION_COMMIT_MISMATCH');
  }
  assertHex64(document.manifestSha256, 'BLIND_ORDER_MANIFEST_HASH_INVALID');
  const { manifestSha256, ...body } = document;
  if (sha256Hex(canonicalBytes(body)) !== manifestSha256) evaluatorFail('BLIND_ORDER_MANIFEST_HASH_MISMATCH');
  if (!Array.isArray(document.executionOrder) || document.executionOrder.length !== 2) evaluatorFail('BLIND_ORDER_EXECUTION_COUNT_INVALID');
  const aliases = document.executionOrder.map((entry) => {
    try { assertExactKeys(entry, ['alias', 'orderDigest'], 'BLIND_ORDER_EXECUTION_SHAPE_MISMATCH'); }
    catch (error) { if (error instanceof Round012TreeError) evaluatorFail(error.code); throw error; }
    assertAlias(entry.alias);
    assertHex64(entry.orderDigest, 'BLIND_ORDER_EXECUTION_HASH_INVALID');
    return entry.alias;
  });
  if (new Set(aliases).size !== 2) evaluatorFail('BLIND_ORDER_EXECUTION_ALIASES_INVALID');
  if (!Array.isArray(document.ballots) || document.ballots.length !== 9) evaluatorFail('BLIND_ORDER_BALLOT_COUNT_INVALID');
  const expectedIDs = [
    ...[...aliases].sort(compareUtf8).flatMap((alias) => REFERENCE_BALLOT_IDS.map((id) => `${id}/${alias}`)),
    ...PAIRWISE_BALLOT_IDS
  ];
  document.ballots.forEach((order, index) => {
    try { assertExactKeys(order, ['itemID', 'left', 'right', 'orderDigest'], 'BLIND_ORDER_BALLOT_SHAPE_MISMATCH'); }
    catch (error) { if (error instanceof Round012TreeError) evaluatorFail(error.code); throw error; }
    if (order.itemID !== expectedIDs[index]) evaluatorFail('BLIND_ORDER_BALLOT_ORDER_INVALID');
    validateBallotTokens(order.itemID, [order.left, order.right]);
    assertHex64(order.orderDigest, 'BLIND_ORDER_BALLOT_HASH_INVALID');
  });
  if (presentationSeed !== null) {
    assertRaw32(presentationSeed, 'PRESENTATION_SEED_NOT_32_BYTES');
    const expected = buildBlindOrderManifest(presentationSeed, aliases);
    if (canonicalBytes(expected).compare(canonicalBytes(document)) !== 0) evaluatorFail('BLIND_ORDER_SEED_DERIVATION_MISMATCH');
  }
  return document;
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
