#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { constants as fsConstants, createReadStream } from 'node:fs';
import {
  lstat,
  open,
  readFile,
  readdir,
  realpath,
  stat,
  writeFile
} from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';

export const PROTOCOL_ID = 'P30-R012A-BLIND-v1';
export const TREE_DOMAIN = 'P30R012A/package-tree/v1';
export const NODE24_EXECUTABLE = '/opt/homebrew/opt/node@24/bin/node';
export const NPM24_EXECUTABLE = '/opt/homebrew/opt/node@24/bin/npm';

const execFileAsync = promisify(execFile);
const HEX40 = /^[0-9a-f]{40}$/u;
const HEX64 = /^[0-9a-f]{64}$/u;

export class BaselineCustodyError extends Error {
  constructor(code, detail = '') {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'BaselineCustodyError';
    this.code = code;
  }
}

export function fail(code, detail = '') {
  throw new BaselineCustodyError(code, detail);
}

export function compareUtf8(left, right) {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
}

function u32be(value) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xffff_ffff) fail('INVALID_U32');
  const result = Buffer.alloc(4);
  result.writeUInt32BE(value);
  return result;
}

function u64be(value) {
  const integer = typeof value === 'bigint' ? value : BigInt(value);
  if (integer < 0n || integer > 0xffff_ffff_ffff_ffffn) fail('INVALID_U64');
  const result = Buffer.alloc(8);
  result.writeBigUInt64BE(integer);
  return result;
}

function assertNfcString(value, code = 'NON_NFC_STRING') {
  if (typeof value !== 'string' || value.normalize('NFC') !== value || value.includes('\0')) {
    fail(code);
  }
}

function canonicalValue(value, seen) {
  if (value === null || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'string') {
    assertNfcString(value);
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) fail('BCJ_INVALID_NUMBER');
    return String(value);
  }
  if (typeof value !== 'object') fail('BCJ_INVALID_VALUE');
  if (seen.has(value)) fail('BCJ_CYCLE');
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      return `[${value.map((item) => canonicalValue(item, seen)).join(',')}]`;
    }
    if (Object.getPrototypeOf(value) !== Object.prototype) fail('BCJ_NON_PLAIN_OBJECT');
    const keys = Object.keys(value).sort(compareUtf8);
    const encoded = [];
    for (const key of keys) {
      assertNfcString(key, 'BCJ_NON_NFC_KEY');
      encoded.push(`${JSON.stringify(key)}:${canonicalValue(value[key], seen)}`);
    }
    return `{${encoded.join(',')}}`;
  } finally {
    seen.delete(value);
  }
}

export function canonicalize(value) {
  return canonicalValue(value, new Set());
}

export function canonicalBytes(value) {
  return Buffer.from(canonicalize(value), 'utf8');
}

export function sha256Bytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export async function fileSha256(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

function validateRelativePath(path) {
  assertNfcString(path, 'TREE_NON_NFC_PATH');
  if (
    path.length === 0 ||
    isAbsolute(path) ||
    path.includes('\\') ||
    path.includes('\0') ||
    path.split('/').some((component) => component === '' || component === '.' || component === '..')
  ) {
    fail('TREE_INVALID_PATH', path);
  }
  for (const character of path) {
    if (character.codePointAt(0) < 0x20 || character.codePointAt(0) === 0x7f) {
      fail('TREE_CONTROL_CHARACTER_PATH', path);
    }
  }
}

export function registerCaseFoldedPath(foldedPaths, relativePath) {
  const folded = relativePath.normalize('NFC').toLocaleLowerCase('en-US');
  const priorFolded = foldedPaths.get(folded);
  if (priorFolded && priorFolded !== relativePath) fail('TREE_CASE_COLLISION');
  foldedPaths.set(folded, relativePath);
}

async function hashOpenRegularFile(path, expected) {
  let handle;
  try {
    handle = await open(path, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0));
    const before = await handle.stat({ bigint: true });
    if (!before.isFile()) fail('TREE_NOT_REGULAR_FILE');
    if (before.dev !== expected.dev || before.ino !== expected.ino) fail('TREE_ENTRY_REPLACED');
    const hash = createHash('sha256');
    for await (const chunk of handle.createReadStream({ autoClose: false })) hash.update(chunk);
    const after = await handle.stat({ bigint: true });
    if (
      before.dev !== after.dev ||
      before.ino !== after.ino ||
      before.size !== after.size ||
      before.mtimeNs !== after.mtimeNs ||
      before.mode !== after.mode
    ) {
      fail('TREE_FILE_MUTATED');
    }
    return {
      bytes: before.size,
      mode: Number(before.mode & 0o777n),
      digest: hash.digest()
    };
  } finally {
    await handle?.close();
  }
}

export async function enumerateTree(rootPath) {
  const root = resolve(rootPath);
  const rootInfo = await lstat(root, { bigint: true });
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) fail('TREE_ROOT_NOT_DIRECTORY');
  const files = [];
  const foldedPaths = new Map();
  const inodeOwners = new Map();

  async function walk(absoluteDirectory, relativeDirectory) {
    const names = await readdir(absoluteDirectory);
    names.sort(compareUtf8);
    for (const name of names) {
      assertNfcString(name, 'TREE_NON_NFC_PATH');
      const absolute = resolve(absoluteDirectory, name);
      const relativePath = relativeDirectory ? `${relativeDirectory}/${name}` : name;
      validateRelativePath(relativePath);
      const fromRoot = relative(root, absolute);
      if (!fromRoot || fromRoot.startsWith(`..${sep}`) || fromRoot === '..' || isAbsolute(fromRoot)) {
        fail('TREE_PATH_ESCAPE');
      }
      registerCaseFoldedPath(foldedPaths, relativePath);
      const info = await lstat(absolute, { bigint: true });
      if (info.isSymbolicLink()) fail('TREE_SYMLINK_FORBIDDEN', relativePath);
      if (info.isDirectory()) {
        await walk(absolute, relativePath);
        continue;
      }
      if (!info.isFile()) fail('TREE_SPECIAL_ENTRY_FORBIDDEN', relativePath);
      const inodeKey = `${info.dev}:${info.ino}`;
      const priorInode = inodeOwners.get(inodeKey);
      if (priorInode) fail('TREE_HARDLINK_ALIAS_FORBIDDEN', `${priorInode},${relativePath}`);
      inodeOwners.set(inodeKey, relativePath);
      files.push({ absolute, relative: relativePath, info });
    }
  }

  await walk(root, '');
  files.sort((left, right) => compareUtf8(left.relative, right.relative));
  return { root, files };
}

export async function hashTree(rootPath) {
  const selection = await enumerateTree(rootPath);
  const hash = createHash('sha256');
  hash.update(Buffer.from(TREE_DOMAIN, 'utf8'));
  hash.update(Buffer.from([0]));
  hash.update(u64be(selection.files.length));
  let totalBytes = 0n;
  const entries = [];
  for (const file of selection.files) {
    const pathBytes = Buffer.from(file.relative, 'utf8');
    const content = await hashOpenRegularFile(file.absolute, file.info);
    hash.update(u32be(pathBytes.length));
    hash.update(pathBytes);
    hash.update(u32be(content.mode));
    hash.update(u64be(content.bytes));
    hash.update(content.digest);
    totalBytes += content.bytes;
    entries.push({
      path: file.relative,
      mode: content.mode.toString(8).padStart(3, '0'),
      bytes: Number(content.bytes),
      sha256: content.digest.toString('hex')
    });
  }
  if (totalBytes > BigInt(Number.MAX_SAFE_INTEGER)) fail('TREE_TOTAL_BYTES_UNSAFE');
  return {
    schema: 'p30.r012a.bytewise-tree-digest.v1',
    domain: TREE_DOMAIN,
    fileCount: entries.length,
    totalBytes: Number(totalBytes),
    treeSha256: hash.digest('hex'),
    entries
  };
}

function assertHex(value, pattern, code) {
  if (typeof value !== 'string' || !pattern.test(value)) fail(code);
}

function assertInside(root, path, code) {
  const rel = relative(resolve(root), resolve(path));
  if (!rel || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) fail(code);
}

async function git(repository, args) {
  const result = await execFileAsync('git', ['-C', repository, ...args], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024
  });
  return result.stdout.trim();
}

async function gitBytes(repository, args) {
  const result = await execFileAsync('git', ['-C', repository, ...args], {
    encoding: null,
    maxBuffer: 64 * 1024 * 1024
  });
  return result.stdout;
}

export function validateVerdictBinding(receipt, verdict) {
  if (
    verdict?.schema !== receipt.round011FinalVerdict.schema ||
    verdict.roundVerdict !== receipt.round011FinalVerdict.roundVerdict ||
    verdict.roundVoid !== receipt.round011FinalVerdict.roundVoid
  ) fail('VERDICT_SUMMARY_MISMATCH');
  if (receipt.selectedCheckpoint.sourceVerdictJsonPath !== '$.selectedStrongerRejectedCheckpoint') {
    fail('VERDICT_SELECTED_PATH_MISMATCH');
  }
  const selected = verdict.selectedStrongerRejectedCheckpoint;
  if (
    !selected ||
    selected.alias !== receipt.selectedCheckpoint.alias ||
    selected.commit !== receipt.selectedCheckpoint.sourceCommit
  ) fail('VERDICT_SELECTED_IDENTITY_MISMATCH');
  const candidates = Array.isArray(verdict.candidates) ? verdict.candidates : [];
  const matching = candidates.filter((candidate) => candidate.alias === selected.alias);
  if (
    matching.length !== 1 ||
    matching[0].commit !== selected.commit ||
    typeof matching[0].finalAcceptance !== 'boolean'
  ) fail('VERDICT_SELECTED_CANDIDATE_MISMATCH');
  const expectedStatus = matching[0].finalAcceptance ? 'accepted' : 'rejected';
  if (receipt.selectedCheckpoint.status !== expectedStatus) fail('VERDICT_SELECTED_STATUS_MISMATCH');
  if (
    expectedStatus === 'rejected' &&
    (verdict.roundVerdict !== 'NO ACCEPTED CANDIDATE' || verdict.roundVoid !== false)
  ) fail('VERDICT_REJECTED_ROUND_MISMATCH');
}

function equalIntegerArrays(left, right) {
  return Array.isArray(left) && Array.isArray(right) &&
    left.length === right.length && left.every((value, index) => value === right[index]);
}

export function validateCompleteTickSeries(trace, firstTick = 0, lastTick = 80) {
  if (
    !Number.isSafeInteger(firstTick) ||
    !Number.isSafeInteger(lastTick) ||
    firstTick < 0 ||
    lastTick < firstTick
  ) fail('GOLDEN_TRACE_TICK_SERIES_INVALID_BOUNDS');
  const declaredTicks = Array.isArray(trace?.declaredAbsoluteTicks) ? trace.declaredAbsoluteTicks : [];
  const stateDigests = Array.isArray(trace?.stateDigests) ? trace.stateDigests : [];
  const cameraDigests = Array.isArray(trace?.cameraDigests) ? trace.cameraDigests : [];
  const expectedCount = lastTick - firstTick + 1;
  if (
    declaredTicks.length !== expectedCount ||
    stateDigests.length !== expectedCount ||
    cameraDigests.length !== expectedCount
  ) fail('GOLDEN_TRACE_TICK_SERIES_COUNT_MISMATCH');
  for (let index = 0; index < expectedCount; index += 1) {
    const expectedTick = firstTick + index;
    const state = stateDigests[index];
    const camera = cameraDigests[index];
    if (
      declaredTicks[index] !== expectedTick ||
      state?.absoluteSimulationTick !== expectedTick ||
      camera?.absoluteSimulationTick !== expectedTick ||
      typeof state?.sha256 !== 'string' ||
      !HEX64.test(state.sha256) ||
      typeof camera?.sha256 !== 'string' ||
      !HEX64.test(camera.sha256)
    ) fail('GOLDEN_TRACE_TICK_SERIES_MISSING_DUPLICATE_OR_INVALID');
  }
}

export function validateDeclaredCounts(receipt, evidence) {
  const { sourceTree, outputTree, materializedGit, manifest, neutralTrace, lightTrace } = evidence;
  if (
    sourceTree.fileCount !== receipt.custody.materializedSourceFileCount ||
    sourceTree.totalBytes !== receipt.custody.materializedSourceBytes ||
    sourceTree.fileCount !== receipt.custody.packageFileCount ||
    sourceTree.totalBytes !== receipt.custody.packageBytes ||
    outputTree.fileCount !== receipt.custody.productionOutputFileCount ||
    outputTree.totalBytes !== receipt.custody.productionOutputBytes ||
    materializedGit.lfsFileCount !== receipt.custody.materializedLfsFileCount ||
    materializedGit.lfsBytes !== receipt.custody.materializedLfsBytes
  ) fail('CUSTODY_DECLARED_COUNT_OR_BYTES_MISMATCH');
  const artifacts = Array.isArray(manifest.artifacts) ? manifest.artifacts : [];
  const tools = Array.isArray(manifest.evaluatorTools) ? manifest.evaluatorTools : [];
  if (
    artifacts.length !== receipt.baselineEvidence.artifactCount ||
    artifacts.filter((artifact) => artifact.kind === 'production-frame').length !== receipt.baselineEvidence.productionFrameCount ||
    artifacts.filter((artifact) => artifact.kind === 'golden-trace').length !== receipt.baselineEvidence.goldenTraceCount ||
    tools.length !== receipt.baselineEvidence.evaluatorToolCount
  ) fail('EVIDENCE_DECLARED_COUNT_MISMATCH');
  for (const [key, trace] of [['neutral', neutralTrace], ['lightStrike', lightTrace]]) {
    validateCompleteTickSeries(trace);
    const declared = receipt.goldenTraces[key];
    const states = Array.isArray(trace.stateDigests) ? trace.stateDigests : [];
    const cameras = Array.isArray(trace.cameraDigests) ? trace.cameraDigests : [];
    const snapshots = Array.isArray(trace.focusedSnapshots) ? trace.focusedSnapshots : [];
    const captureTicks = snapshots.map((snapshot) => snapshot.absoluteSimulationTick);
    if (
      states.length !== declared.declaredStateTickCount ||
      states[0]?.absoluteSimulationTick !== declared.declaredStateTickFirst ||
      states.at(-1)?.absoluteSimulationTick !== declared.declaredStateTickLast ||
      cameras.length !== declared.declaredCameraTickCount ||
      !equalIntegerArrays(captureTicks, declared.captureTicks) ||
      snapshots[0]?.targetHealth !== declared.healthStart ||
      snapshots.at(-1)?.targetHealth !== declared.healthEnd ||
      trace.eventLog.filter((event) => event.type === 'enemy-hit').length !== declared.damageEventCount
    ) fail('GOLDEN_TRACE_DECLARED_SUMMARY_MISMATCH');
  }
}

export async function verifyMaterializedGitTree(repositoryPath, commit, treePath = 'web-game') {
  assertHex(commit, HEX40, 'MATERIALIZED_GIT_INVALID_COMMIT');
  if (!/^[A-Za-z0-9._/-]+$/u.test(treePath) || treePath.includes('..') || treePath.startsWith('/')) {
    fail('MATERIALIZED_GIT_INVALID_TREE_PATH');
  }
  const repository = await realpath(repositoryPath);
  const root = resolve(repository, treePath);
  assertInside(repository, root, 'MATERIALIZED_GIT_PATH_ESCAPE');
  const listing = await gitBytes(repository, ['ls-tree', '-r', '-z', commit, '--', treePath]);
  const records = listing.toString('utf8').split('\0').filter(Boolean);
  if (records.length === 0) fail('MATERIALIZED_GIT_EMPTY_TREE');
  const expectedPaths = new Set();
  let lfsFileCount = 0;
  let lfsBytes = 0;
  for (const record of records) {
    const tab = record.indexOf('\t');
    if (tab < 0) fail('MATERIALIZED_GIT_BAD_RECORD');
    const [mode, type, objectID] = record.slice(0, tab).split(' ');
    const repositoryRelative = record.slice(tab + 1);
    if ((mode !== '100644' && mode !== '100755') || type !== 'blob' || !/^[0-9a-f]{40,64}$/u.test(objectID)) {
      fail('MATERIALIZED_GIT_ENTRY_FORBIDDEN');
    }
    if (!repositoryRelative.startsWith(`${treePath}/`)) fail('MATERIALIZED_GIT_BAD_PATH');
    const packageRelative = repositoryRelative.slice(treePath.length + 1);
    validateRelativePath(packageRelative);
    expectedPaths.add(packageRelative);
    const absolute = resolve(repository, repositoryRelative);
    assertInside(repository, absolute, 'MATERIALIZED_GIT_ENTRY_ESCAPE');
    const info = await lstat(absolute);
    if (!info.isFile() || info.isSymbolicLink()) fail('MATERIALIZED_GIT_ENTRY_NOT_FILE');
    const expectedExecutable = mode === '100755';
    if (((info.mode & 0o111) !== 0) !== expectedExecutable) fail('MATERIALIZED_GIT_MODE_MISMATCH');
    const blob = await gitBytes(repository, ['cat-file', 'blob', objectID]);
    const pointer = /^version https:\/\/git-lfs\.github\.com\/spec\/v1\noid sha256:([0-9a-f]{64})\nsize ([0-9]+)\n$/u.exec(blob.toString('utf8'));
    if (pointer) {
      const expectedBytes = Number(pointer[2]);
      if (!Number.isSafeInteger(expectedBytes) || info.size !== expectedBytes) {
        fail('MATERIALIZED_LFS_SIZE_MISMATCH');
      }
      if (await fileSha256(absolute) !== pointer[1]) fail('MATERIALIZED_LFS_HASH_MISMATCH');
      lfsFileCount += 1;
      lfsBytes += expectedBytes;
    } else {
      const materialized = await readFile(absolute);
      if (!materialized.equals(blob)) fail('MATERIALIZED_GIT_BLOB_MISMATCH');
    }
  }
  const actual = await enumerateTree(root);
  const actualPaths = actual.files.map((entry) => entry.relative);
  if (actualPaths.length !== expectedPaths.size || actualPaths.some((path) => !expectedPaths.has(path))) {
    fail('MATERIALIZED_GIT_FILE_SET_MISMATCH');
  }
  return {
    schema: 'p30.r012a.materialized-git-tree-verification.v1',
    commit,
    treePath,
    fileCount: expectedPaths.size,
    lfsFileCount,
    lfsBytes,
    verified: true
  };
}

export async function verifyReceipt(receiptPath, repositoryPath, outputPath = null) {
  const repository = await realpath(repositoryPath);
  const receiptAbsolute = resolve(receiptPath);
  assertInside(repository, receiptAbsolute, 'RECEIPT_OUTSIDE_REPOSITORY');
  const raw = await readFile(receiptAbsolute, 'utf8');
  const receipt = JSON.parse(raw);
  if (raw !== `${canonicalize(receipt)}\n`) fail('RECEIPT_NOT_CANONICAL_BCJ');
  if (receipt.schema !== 'p30.r012a.baseline-receipt.v1' || receipt.protocolID !== PROTOCOL_ID) {
    fail('RECEIPT_SCHEMA_OR_PROTOCOL_MISMATCH');
  }
  for (const digest of [
    receipt.protocol.rawFileSha256,
    receipt.protocol.amendmentRawFileSha256,
    receipt.round011FinalVerdict.rawFileSha256,
    receipt.selectedCheckpoint.sourceGitTree,
    receipt.custody.materializedSourceTreeSha256,
    receipt.custody.packageTreeSha256,
    receipt.custody.productionOutputTreeSha256,
    receipt.custody.lockfileSha256,
    receipt.custody.baselineEvidenceManifestSha256,
    receipt.goldenTraces.neutral.sha256,
    receipt.goldenTraces.lightStrike.sha256
  ]) assertHex(digest, digest.length === 40 ? HEX40 : HEX64, 'RECEIPT_INVALID_DIGEST');
  if (receipt.selectedCheckpoint.sourceVerdictJsonPath !== '$.selectedStrongerRejectedCheckpoint') {
    fail('RECEIPT_SELECTED_PATH_MISMATCH');
  }
  assertHex(receipt.selectedCheckpoint.sourceCommit, HEX40, 'RECEIPT_INVALID_SOURCE_COMMIT');
  assertHex(receipt.protocol.amendmentCommit, HEX40, 'RECEIPT_INVALID_AMENDMENT_COMMIT');
  assertHex(receipt.custody.receiptParentCommit, HEX40, 'RECEIPT_INVALID_PARENT_COMMIT');
  assertHex(receipt.custody.receiptParentGitTree, HEX40, 'RECEIPT_INVALID_PARENT_TREE');
  if (!outputPath) fail('PRODUCTION_OUTPUT_REQUIRED');

  const verifyFile = async (relativePath, expectedSha256, code) => {
    const absolute = resolve(repository, relativePath);
    assertInside(repository, absolute, `${code}_PATH_ESCAPE`);
    if (await fileSha256(absolute) !== expectedSha256) fail(code);
  };
  await verifyFile(receipt.protocol.path, receipt.protocol.rawFileSha256, 'PROTOCOL_HASH_MISMATCH');
  await verifyFile(receipt.protocol.amendmentPath, receipt.protocol.amendmentRawFileSha256, 'AMENDMENT_HASH_MISMATCH');
  await verifyFile(receipt.round011FinalVerdict.path, receipt.round011FinalVerdict.rawFileSha256, 'VERDICT_HASH_MISMATCH');
  await verifyFile(receipt.packageInputs.lockfile.path, receipt.packageInputs.lockfile.sha256, 'LOCKFILE_HASH_MISMATCH');
  for (const input of receipt.packageInputs.files) {
    await verifyFile(input.path, input.sha256, 'PACKAGE_INPUT_HASH_MISMATCH');
  }
  await verifyFile(receipt.goldenTraces.neutral.path, receipt.goldenTraces.neutral.sha256, 'NEUTRAL_TRACE_HASH_MISMATCH');
  await verifyFile(receipt.goldenTraces.lightStrike.path, receipt.goldenTraces.lightStrike.sha256, 'LIGHT_TRACE_HASH_MISMATCH');
  await verifyFile(
    receipt.baselineEvidence.manifestPath,
    receipt.custody.baselineEvidenceManifestSha256,
    'EVIDENCE_MANIFEST_HASH_MISMATCH'
  );

  const verdict = JSON.parse(await readFile(resolve(repository, receipt.round011FinalVerdict.path), 'utf8'));
  validateVerdictBinding(receipt, verdict);

  if (receipt.protocol.amendmentCommit !== receipt.custody.receiptParentCommit) {
    fail('RECEIPT_PARENT_AMENDMENT_COMMIT_MISMATCH');
  }
  const parentType = await git(repository, ['cat-file', '-t', receipt.custody.receiptParentCommit]);
  if (parentType !== 'commit') fail('RECEIPT_PARENT_NOT_COMMIT');
  const parentTree = await git(repository, ['rev-parse', `${receipt.custody.receiptParentCommit}^{tree}`]);
  if (parentTree !== receipt.custody.receiptParentGitTree) fail('RECEIPT_PARENT_TREE_MISMATCH');
  const parentAmendment = await gitBytes(repository, [
    'show',
    `${receipt.custody.receiptParentCommit}:${receipt.protocol.amendmentPath}`
  ]);
  if (sha256Bytes(parentAmendment) !== receipt.protocol.amendmentRawFileSha256) {
    fail('RECEIPT_PARENT_AMENDMENT_BYTES_MISMATCH');
  }
  const parentVerdict = await gitBytes(repository, [
    'show',
    `${receipt.custody.receiptParentCommit}:${receipt.round011FinalVerdict.path}`
  ]);
  if (sha256Bytes(parentVerdict) !== receipt.round011FinalVerdict.rawFileSha256) {
    fail('RECEIPT_PARENT_VERDICT_BYTES_MISMATCH');
  }
  const parentWebGameTree = await git(repository, [
    'rev-parse',
    `${receipt.custody.receiptParentCommit}:web-game`
  ]);
  if (parentWebGameTree !== receipt.custody.webGameGitTree) fail('RECEIPT_PARENT_WEB_GAME_TREE_MISMATCH');
  try {
    await execFileAsync('git', [
      '-C', repository,
      'merge-base', '--is-ancestor',
      receipt.selectedCheckpoint.sourceCommit,
      receipt.custody.receiptParentCommit
    ]);
  } catch {
    fail('SELECTED_COMMIT_NOT_ANCESTOR_OF_RECEIPT_PARENT');
  }

  const commitTree = await git(repository, ['rev-parse', `${receipt.selectedCheckpoint.sourceCommit}^{tree}`]);
  if (commitTree !== receipt.selectedCheckpoint.sourceGitTree) fail('SOURCE_GIT_TREE_MISMATCH');
  const webGameGitTree = await git(repository, ['rev-parse', `${receipt.selectedCheckpoint.sourceCommit}:web-game`]);
  if (webGameGitTree !== receipt.custody.webGameGitTree) fail('WEB_GAME_GIT_TREE_MISMATCH');
  const materializedGit = await verifyMaterializedGitTree(
    repository,
    receipt.selectedCheckpoint.sourceCommit,
    'web-game'
  );
  if (
    materializedGit.fileCount !== receipt.custody.materializedSourceFileCount ||
    materializedGit.lfsFileCount !== receipt.custody.materializedLfsFileCount
  ) fail('MATERIALIZED_GIT_COUNTS_MISMATCH');
  const sourceTree = await hashTree(resolve(repository, 'web-game'));
  if (sourceTree.treeSha256 !== receipt.custody.materializedSourceTreeSha256) {
    fail('MATERIALIZED_SOURCE_TREE_MISMATCH');
  }
  if (sourceTree.treeSha256 !== receipt.custody.packageTreeSha256) fail('PACKAGE_TREE_MISMATCH');

  const manifestPath = resolve(repository, receipt.baselineEvidence.manifestPath);
  const manifestRaw = await readFile(manifestPath, 'utf8');
  const manifest = JSON.parse(manifestRaw);
  if (manifestRaw !== `${canonicalize(manifest)}\n`) fail('EVIDENCE_MANIFEST_NOT_CANONICAL_BCJ');
  for (const artifact of manifest.artifacts) {
    const artifactPath = resolve(repository, artifact.path);
    assertInside(repository, artifactPath, 'EVIDENCE_ARTIFACT_PATH_ESCAPE');
    const artifactStat = await stat(artifactPath);
    if (!artifactStat.isFile() || artifactStat.size !== artifact.bytes) fail('EVIDENCE_ARTIFACT_SIZE_MISMATCH');
    if (await fileSha256(artifactPath) !== artifact.sha256) fail('EVIDENCE_ARTIFACT_HASH_MISMATCH');
  }
  for (const tool of manifest.evaluatorTools) {
    const toolPath = resolve(repository, tool.path);
    assertInside(repository, toolPath, 'EVALUATOR_TOOL_PATH_ESCAPE');
    const toolStat = await stat(toolPath);
    if (!toolStat.isFile() || toolStat.size !== tool.bytes) fail('EVALUATOR_TOOL_SIZE_MISMATCH');
    if (await fileSha256(toolPath) !== tool.sha256) fail('EVALUATOR_TOOL_HASH_MISMATCH');
  }

  const outputTree = await hashTree(outputPath);
  if (outputTree.treeSha256 !== receipt.custody.productionOutputTreeSha256) {
    fail('PRODUCTION_OUTPUT_TREE_MISMATCH');
  }
  const readCanonicalTrace = async (path, code) => {
    const rawTrace = await readFile(resolve(repository, path), 'utf8');
    const trace = JSON.parse(rawTrace);
    if (rawTrace !== `${canonicalize(trace)}\n`) fail(code);
    return trace;
  };
  const neutralTrace = await readCanonicalTrace(
    receipt.goldenTraces.neutral.path,
    'NEUTRAL_TRACE_NOT_CANONICAL_BCJ'
  );
  const lightTrace = await readCanonicalTrace(
    receipt.goldenTraces.lightStrike.path,
    'LIGHT_TRACE_NOT_CANONICAL_BCJ'
  );
  if (
    manifest.selectedCheckpoint !== receipt.selectedCheckpoint.alias ||
    manifest.sourceCommit !== receipt.selectedCheckpoint.sourceCommit ||
    manifest.materializedSourceTreeSha256 !== receipt.custody.materializedSourceTreeSha256 ||
    manifest.productionOutputTreeSha256 !== receipt.custody.productionOutputTreeSha256
  ) fail('EVIDENCE_MANIFEST_CUSTODY_MISMATCH');
  validateDeclaredCounts(receipt, {
    sourceTree,
    outputTree,
    materializedGit,
    manifest,
    neutralTrace,
    lightTrace
  });
  return {
    schema: 'p30.r012a.baseline-verification.v1',
    protocolID: PROTOCOL_ID,
    selectedCheckpoint: receipt.selectedCheckpoint.alias,
    sourceCommit: receipt.selectedCheckpoint.sourceCommit,
    materializedSourceTreeSha256: sourceTree.treeSha256,
    productionOutputVerified: true,
    receiptSha256: await fileSha256(receiptAbsolute),
    verified: true
  };
}

function usage() {
  return [
    'Usage:',
    '  baseline-core.mjs tree ROOT',
    '  baseline-core.mjs file-sha256 FILE',
    '  baseline-core.mjs canonical JSON_FILE',
    '  baseline-core.mjs canonicalize-file JSON_FILE',
    '  baseline-core.mjs materialized-git-tree REPOSITORY COMMIT [TREE_PATH]',
    '  baseline-core.mjs verify-receipt RECEIPT REPOSITORY OUTPUT_ROOT'
  ].join('\n');
}

export async function main(argv) {
  const [command, ...args] = argv;
  let output;
  if (command === 'tree' && args.length === 1) output = JSON.stringify(await hashTree(args[0]), null, 2);
  else if (command === 'file-sha256' && args.length === 1) output = await fileSha256(args[0]);
  else if (command === 'canonical' && args.length === 1) {
    output = canonicalize(JSON.parse(await readFile(args[0], 'utf8')));
  } else if (command === 'canonicalize-file' && args.length === 1) {
    const path = resolve(args[0]);
    const canonical = `${canonicalize(JSON.parse(await readFile(path, 'utf8')))}\n`;
    await writeFile(path, canonical, { flag: 'w', mode: 0o644 });
    output = await fileSha256(path);
  } else if (command === 'materialized-git-tree' && (args.length === 2 || args.length === 3)) {
    output = JSON.stringify(await verifyMaterializedGitTree(args[0], args[1], args[2] ?? 'web-game'), null, 2);
  } else if (command === 'verify-receipt' && args.length === 3) {
    output = JSON.stringify(await verifyReceipt(args[0], args[1], args[2]), null, 2);
  } else fail('INVALID_ARGUMENTS', usage());
  process.stdout.write(`${output}\n`);
}

const invoked = process.argv[1] ? resolve(process.argv[1]) : '';
if (invoked && fileURLToPath(import.meta.url) === invoked) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`BASELINE_CUSTODY_ERROR:${error.code ?? 'UNEXPECTED'}\n`);
    process.exitCode = 1;
  });
}
