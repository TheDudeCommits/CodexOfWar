#!/usr/bin/env node

import { createHash, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import {
  access,
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rename,
  rm,
  stat,
  writeFile
} from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TextDecoder } from 'node:util';

import { hashExplicitFiles, hashTree } from '../../Critic/tools/protocol-tools.mjs';
import {
  MAP_COMMIT_DOMAIN,
  NODE24_EXECUTABLE,
  NPM24_EXECUTABLE,
  PACKAGE_ARCHIVE_EXTENSION,
  PRESENTATION_COMMIT,
  PROTOCOL_ID,
  PROTOCOL_PAYLOAD_SHA256,
  PackagingError,
  assertAlias,
  assertCommonInterfaces,
  assertDirectoryContainsOnly,
  assertHex40,
  assertHex64,
  assertNode24,
  buildPublicCommitment,
  compareUtf8,
  computeMapCommit,
  copyRegularTree,
  createDeterministicTar,
  extractDeterministicTar,
  fileSha256,
  hashAndValidatePublicArchive,
  packagingFail,
  parseCanonicalDocument,
  parseJsonStrict,
  readCanonicalDocument,
  readJsonStrict,
  replaceFileAtomically,
  scanRegularTree,
  validateCriticInterface,
  validatePackageTree,
  validateProductionOutput,
  validatePublicCommitment,
  validateTestTranscript,
  validateTextForClues,
  writeCanonicalExclusive
} from './packaging-core.mjs';

const TOOL_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const PACKAGING_DIRECTORY = resolve(TOOL_DIRECTORY, '..');
const CRITIC_DIRECTORY_FROM_TOOL = resolve(TOOL_DIRECTORY, '../../Critic');
const PRIVATE_DIRECTORY_FROM_TOOL = resolve(PACKAGING_DIRECTORY, '.private');
const PUBLIC_COMMITMENT_FROM_TOOL = resolve(PACKAGING_DIRECTORY, 'PACKAGE_MAP_COMMITMENT.json');
const WEB_GAME_PATH = 'web-game';

const CONFIG_KEYS = Object.freeze(['schema', 'authorityRepository', 'privateDirectory', 'candidates']);
const CANDIDATE_CONFIG_KEYS = Object.freeze([
  'alias',
  'builderIdentity',
  'sourceWorktree',
  'sourceBranch',
  'sourceCommit',
  'sourceGitTree',
  'forbiddenTokens'
]);

const MAP_DOCUMENT_KEYS = Object.freeze([
  'schema',
  'protocolID',
  'protocolPayloadSha256',
  'presentationCommit',
  'entries'
]);

const MAP_ENTRY_KEYS = Object.freeze([
  'alias',
  'builderIdentity',
  'sourceWorktreePath',
  'sourceBranch',
  'sourceCommit',
  'sourceGitTree',
  'sourceArchiveBytes',
  'sourceArchiveSha256',
  'sourceTreeSha256',
  'packageArchiveBytes',
  'packageArchiveSha256',
  'packageTreeSha256',
  'buildCommand',
  'productionOutputTreeSha256'
]);

// These eight known LFS-smudge checkout artifacts are outside web-game and are
// the sole permitted non-clean status records. Every candidate-scoped path and
// every other repository path must still be clean.
const HISTORICAL_OUT_OF_SCOPE_LFS_PATHS = new Set([
  'progress/public/captures/P00/round-001/S01_Explore.png',
  'progress/public/captures/P10/round-001/S01_Explore.png',
  'progress/public/captures/P10/round-001/Turntable_Back.png',
  'progress/public/captures/P10/round-001/Turntable_ContactSheet.png',
  'progress/public/captures/P10/round-001/Turntable_Front.png',
  'progress/public/captures/P10/round-001/Turntable_Profile.png',
  'progress/public/captures/P10/round-001/Turntable_ThreeQuarter.png',
  'progress/public/social-card.png'
]);

const MAX_CAPTURE_BYTES = 64 * 1024 * 1024;

function exactObjectKeys(value, expected, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    packagingFail(code);
  }
  const actual = Object.keys(value).sort(compareUtf8);
  const wanted = [...expected].sort(compareUtf8);
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) packagingFail(code);
}

function assertInside(parent, child, code) {
  const rel = relative(resolve(parent), resolve(child));
  if (!rel || rel.startsWith(`..${sep}`) || rel === '..' || isAbsolute(rel)) packagingFail(code);
}

async function pathExists(path) {
  try {
    await lstat(path);
    return true;
  } catch {
    return false;
  }
}

async function requireAbsent(path, code = 'OUTPUT_ALREADY_EXISTS_OR_UNWRITABLE') {
  if (await pathExists(path)) packagingFail(code);
}

function safeEnvironment(extra = {}) {
  return {
    PATH: `/opt/homebrew/opt/node@24/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin`,
    LANG: 'C.UTF-8',
    LC_ALL: 'C.UTF-8',
    CI: '1',
    NO_COLOR: '1',
    FORCE_COLOR: '0',
    npm_config_audit: 'false',
    npm_config_fund: 'false',
    npm_config_update_notifier: 'false',
    ...extra
  };
}

async function writePrivateLog(path, stdout, stderr) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const body = Buffer.concat([
    Buffer.from('----- stdout -----\n', 'utf8'),
    stdout,
    Buffer.from('\n----- stderr -----\n', 'utf8'),
    stderr,
    Buffer.from('\n', 'utf8')
  ]);
  await writeFile(path, body, { flag: 'wx', mode: 0o600 });
}

async function runCaptured(command, args, {
  cwd,
  env = process.env,
  logPath,
  timeoutMs = 10 * 60 * 1000,
  code = 'SUBPROCESS_FAILED',
  detached = false
} = {}) {
  const child = spawn(command, args, {
    cwd,
    env,
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached
  });
  const stdoutChunks = [];
  const stderrChunks = [];
  let capturedBytes = 0;
  let overflow = false;
  const collect = (chunks) => (chunk) => {
    capturedBytes += chunk.length;
    if (capturedBytes > MAX_CAPTURE_BYTES) {
      overflow = true;
      return;
    }
    chunks.push(Buffer.from(chunk));
  };
  child.stdout.on('data', collect(stdoutChunks));
  child.stderr.on('data', collect(stderrChunks));

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    try {
      if (detached && child.pid) process.kill(-child.pid, 'SIGTERM');
      else child.kill('SIGTERM');
    } catch {
      // The process may already have exited.
    }
  }, timeoutMs);

  let outcome;
  try {
    outcome = await new Promise((resolveOutcome, rejectOutcome) => {
      child.once('error', rejectOutcome);
      child.once('close', (exitCode, signal) => resolveOutcome({ exitCode, signal }));
    });
  } catch {
    clearTimeout(timer);
    packagingFail(code);
  }
  clearTimeout(timer);
  const stdout = Buffer.concat(stdoutChunks);
  const stderr = Buffer.concat(stderrChunks);
  if (logPath) await writePrivateLog(logPath, stdout, stderr);
  if (overflow) packagingFail('SUBPROCESS_OUTPUT_LIMIT_EXCEEDED');
  if (timedOut) packagingFail('SUBPROCESS_TIMEOUT');
  if (outcome.exitCode !== 0) packagingFail(code);
  return {
    stdout,
    stderr,
    stdoutText: stdout.toString('utf8'),
    stderrText: stderr.toString('utf8'),
    transcript: `${stdout.toString('utf8')}\n${stderr.toString('utf8')}`,
    exitCode: outcome.exitCode,
    signal: outcome.signal
  };
}

async function runGit(cwd, args, options = {}) {
  return runCaptured('git', ['-C', cwd, ...args], {
    cwd,
    env: process.env,
    timeoutMs: options.timeoutMs ?? 10 * 60 * 1000,
    logPath: options.logPath,
    code: options.code ?? 'GIT_COMMAND_FAILED'
  });
}

async function realpathMaybeRelative(cwd, value) {
  return realpath(isAbsolute(value) ? value : resolve(cwd, value));
}

function parsePorcelainV1Z(output) {
  if (!output) return [];
  const records = output.split('\0');
  if (records.at(-1) === '') records.pop();
  const parsed = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (record.length < 4 || record[2] !== ' ') packagingFail('UNPARSEABLE_GIT_STATUS');
    const statusCode = record.slice(0, 2);
    const path = record.slice(3);
    if (/[RC]/u.test(statusCode)) {
      index += 1;
      packagingFail('SOURCE_WORKTREE_DIRTY');
    }
    parsed.push({ statusCode, path });
  }
  return parsed;
}

async function assertHistoricalExceptionsAreLfs(sourceWorktree, paths) {
  if (paths.length === 0) return;
  const result = await runGit(sourceWorktree, ['check-attr', '-z', 'filter', '--', ...paths], {
    code: 'LFS_EXCEPTION_VERIFICATION_FAILED'
  });
  const fields = result.stdoutText.split('\0');
  if (fields.at(-1) === '') fields.pop();
  if (fields.length !== paths.length * 3) packagingFail('LFS_EXCEPTION_VERIFICATION_FAILED');
  for (let index = 0; index < fields.length; index += 3) {
    if (!paths.includes(fields[index]) || fields[index + 1] !== 'filter' || fields[index + 2] !== 'lfs') {
      packagingFail('LFS_EXCEPTION_VERIFICATION_FAILED');
    }
  }
}

async function assertSourceWorktreeClean(sourceWorktree) {
  const result = await runGit(sourceWorktree, ['status', '--porcelain=v1', '-z', '--untracked-files=all'], {
    code: 'SOURCE_STATUS_FAILED'
  });
  const records = parsePorcelainV1Z(result.stdoutText);
  const allowedPaths = [];
  for (const record of records) {
    if (record.statusCode !== ' M' || !HISTORICAL_OUT_OF_SCOPE_LFS_PATHS.has(record.path)) {
      packagingFail('SOURCE_WORKTREE_DIRTY');
    }
    allowedPaths.push(record.path);
  }
  await assertHistoricalExceptionsAreLfs(sourceWorktree, allowedPaths);
  const scoped = await runGit(sourceWorktree, ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--', WEB_GAME_PATH], {
    code: 'SOURCE_STATUS_FAILED'
  });
  if (scoped.stdout.length !== 0) packagingFail('CANDIDATE_SOURCE_DIRTY');
}

function parseGitTree(output) {
  const records = output.split('\0');
  if (records.at(-1) === '') records.pop();
  const files = [];
  for (const record of records) {
    const tab = record.indexOf('\t');
    if (tab < 0) packagingFail('UNPARSEABLE_GIT_TREE');
    const header = record.slice(0, tab).split(' ');
    const path = record.slice(tab + 1);
    if (header.length !== 3) packagingFail('UNPARSEABLE_GIT_TREE');
    const [mode, type, objectID] = header;
    if ((mode !== '100644' && mode !== '100755') || type !== 'blob' || !/^[0-9a-f]{40,64}$/u.test(objectID)) {
      packagingFail('GIT_TREE_ENTRY_FORBIDDEN');
    }
    if (!path.startsWith(`${WEB_GAME_PATH}/`)) packagingFail('UNPARSEABLE_GIT_TREE');
    files.push({
      mode: mode === '100755' ? 0o755 : 0o644,
      path: path.slice(`${WEB_GAME_PATH}/`.length),
      objectID
    });
  }
  files.sort((left, right) => compareUtf8(left.path, right.path));
  if (files.length === 0) packagingFail('EMPTY_CANDIDATE_GIT_TREE');
  return files;
}

async function bindCandidateSource(authorityRepository, candidate) {
  const sourceWorktree = await realpath(candidate.sourceWorktree);
  const authorityCommon = await runGit(authorityRepository, ['rev-parse', '--git-common-dir'], {
    code: 'AUTHORITY_GIT_RESOLUTION_FAILED'
  });
  const sourceCommon = await runGit(sourceWorktree, ['rev-parse', '--git-common-dir'], {
    code: 'SOURCE_GIT_RESOLUTION_FAILED'
  });
  const authorityCommonPath = await realpathMaybeRelative(authorityRepository, authorityCommon.stdoutText.trim());
  const sourceCommonPath = await realpathMaybeRelative(sourceWorktree, sourceCommon.stdoutText.trim());
  if (authorityCommonPath !== sourceCommonPath) packagingFail('SOURCE_REPOSITORY_MISMATCH');

  const resolvedCommit = await runGit(authorityRepository, ['rev-parse', '--verify', `${candidate.sourceCommit}^{commit}`], {
    code: 'SOURCE_COMMIT_UNAVAILABLE'
  });
  if (resolvedCommit.stdoutText.trim() !== candidate.sourceCommit) packagingFail('SOURCE_COMMIT_MISMATCH');
  const resolvedTree = await runGit(authorityRepository, ['rev-parse', '--verify', `${candidate.sourceCommit}^{tree}`], {
    code: 'SOURCE_TREE_UNAVAILABLE'
  });
  if (resolvedTree.stdoutText.trim() !== candidate.sourceGitTree) packagingFail('SOURCE_GIT_TREE_MISMATCH');

  const head = await runGit(sourceWorktree, ['rev-parse', '--verify', 'HEAD'], { code: 'SOURCE_HEAD_UNAVAILABLE' });
  if (head.stdoutText.trim() !== candidate.sourceCommit) packagingFail('SOURCE_HEAD_COMMIT_MISMATCH');
  const branch = await runGit(sourceWorktree, ['symbolic-ref', '--quiet', '--short', 'HEAD'], {
    code: 'SOURCE_BRANCH_UNAVAILABLE'
  });
  if (branch.stdoutText.trim() !== candidate.sourceBranch) packagingFail('SOURCE_BRANCH_MISMATCH');
  await runGit(sourceWorktree, ['check-ref-format', '--branch', candidate.sourceBranch], {
    code: 'INVALID_SOURCE_BRANCH'
  });
  await assertSourceWorktreeClean(sourceWorktree);

  const gitTreeResult = await runGit(
    authorityRepository,
    ['ls-tree', '-r', '-z', '--full-tree', candidate.sourceCommit, '--', WEB_GAME_PATH],
    { code: 'SOURCE_TREE_ENUMERATION_FAILED' }
  );
  return {
    sourceWorktree,
    files: parseGitTree(gitTreeResult.stdoutText)
  };
}

async function validateCheckoutAgainstGitTree(checkoutWebGame, gitFiles) {
  const scan = await scanRegularTree(checkoutWebGame);
  if (scan.files.length !== gitFiles.length) packagingFail('CHECKOUT_FILESET_MISMATCH');
  for (let index = 0; index < gitFiles.length; index += 1) {
    const actual = scan.files[index];
    const expected = gitFiles[index];
    if (actual.relative !== expected.path || actual.mode !== expected.mode) packagingFail('CHECKOUT_FILESET_MISMATCH');
  }
}

async function validateLfsMaterialization(checkoutRoot) {
  const result = await runGit(
    checkoutRoot,
    ['lfs', 'ls-files', '--long', '--json', '--include=web-game/**', '--exclude='],
    { code: 'LFS_ENUMERATION_FAILED' }
  );
  let value;
  try {
    value = parseJsonStrict(result.stdoutText);
  } catch {
    packagingFail('LFS_ENUMERATION_FAILED');
  }
  if (!value || typeof value !== 'object' || !Array.isArray(value.files)) packagingFail('LFS_ENUMERATION_FAILED');
  for (const file of value.files) {
    if (
      !file ||
      typeof file.name !== 'string' ||
      !file.name.startsWith('web-game/') ||
      file.oid_type !== 'sha256' ||
      !/^[0-9a-f]{64}$/u.test(file.oid) ||
      file.checkout !== true ||
      file.downloaded !== true ||
      !Number.isSafeInteger(file.size) ||
      file.size < 0
    ) {
      packagingFail('LFS_PAYLOAD_NOT_MATERIALIZED');
    }
    const payload = await fileSha256(resolve(checkoutRoot, file.name));
    if (payload.bytes !== file.size || payload.sha256 !== file.oid) packagingFail('LFS_PAYLOAD_HASH_MISMATCH');
  }
  return value.files.length;
}

async function createDetachedMaterializedCheckout(authorityRepository, candidate, sessionRoot, gitFiles, logDirectory) {
  const checkoutRoot = resolve(sessionRoot, 'worktrees', candidate.alias);
  await mkdir(dirname(checkoutRoot), { recursive: true, mode: 0o700 });
  await runCaptured(
    'git',
    ['-c', 'core.autocrlf=false', '-C', authorityRepository, 'worktree', 'add', '--detach', '--no-checkout', checkoutRoot, candidate.sourceCommit],
    {
      cwd: authorityRepository,
      env: { ...process.env, GIT_LFS_SKIP_SMUDGE: '1' },
      logPath: resolve(logDirectory, candidate.alias, 'git-worktree-add.log'),
      code: 'DETACHED_CHECKOUT_CREATION_FAILED'
    }
  );
  let completed = false;
  try {
    await runGit(checkoutRoot, ['sparse-checkout', 'init', '--cone'], { code: 'SPARSE_CHECKOUT_FAILED' });
    await runGit(checkoutRoot, ['sparse-checkout', 'set', WEB_GAME_PATH], { code: 'SPARSE_CHECKOUT_FAILED' });
    await runGit(checkoutRoot, ['read-tree', '-mu', 'HEAD'], { code: 'SPARSE_CHECKOUT_MATERIALIZATION_FAILED' });
    await runGit(checkoutRoot, ['lfs', 'pull', '--include=web-game/**', '--exclude='], {
      timeoutMs: 30 * 60 * 1000,
      logPath: resolve(logDirectory, candidate.alias, 'git-lfs-pull.log'),
      code: 'LFS_PULL_FAILED'
    });
    await runGit(checkoutRoot, ['lfs', 'checkout', WEB_GAME_PATH], {
      timeoutMs: 30 * 60 * 1000,
      logPath: resolve(logDirectory, candidate.alias, 'git-lfs-checkout.log'),
      code: 'LFS_CHECKOUT_FAILED'
    });
    const statusResult = await runGit(checkoutRoot, ['status', '--porcelain=v1', '-z', '--untracked-files=all'], {
      code: 'DETACHED_CHECKOUT_STATUS_FAILED'
    });
    if (statusResult.stdout.length !== 0) packagingFail('DETACHED_CHECKOUT_NOT_CLEAN');
    await validateCheckoutAgainstGitTree(resolve(checkoutRoot, WEB_GAME_PATH), gitFiles);
    const lfsFiles = await validateLfsMaterialization(checkoutRoot);
    const treeDigest = await hashTree(resolve(checkoutRoot, WEB_GAME_PATH));
    completed = true;
    return { checkoutRoot, webGameRoot: resolve(checkoutRoot, WEB_GAME_PATH), treeDigest, lfsFiles };
  } finally {
    if (!completed && (await pathExists(checkoutRoot))) {
      try {
        await runGit(authorityRepository, ['worktree', 'remove', '--force', checkoutRoot], {
          code: 'DETACHED_CHECKOUT_CLEANUP_FAILED'
        });
      } catch {
        // Preserve the original packaging failure; the ignored private path is explicit.
      }
    }
  }
}

async function removeDetachedCheckout(authorityRepository, checkoutRoot) {
  await runGit(authorityRepository, ['worktree', 'remove', '--force', checkoutRoot], {
    code: 'DETACHED_CHECKOUT_CLEANUP_FAILED'
  });
}

async function allocatePort() {
  const server = createServer();
  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : null;
  await new Promise((resolveClose) => server.close(resolveClose));
  if (!Number.isSafeInteger(port) || port <= 0) packagingFail('PORT_ALLOCATION_FAILED');
  return port;
}

function wait(milliseconds) {
  return new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));
}

async function waitForServerReadiness(port, readyPath, child, identityTokens) {
  const deadline = Date.now() + 30_000;
  let lastFailure = 'not-ready';
  while (Date.now() < deadline) {
    if (child.exitCode !== null) packagingFail('SERVE_PROCESS_EXITED_EARLY');
    try {
      const response = await fetch(`http://127.0.0.1:${port}${readyPath}`, {
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(2_000)
      });
      if (response.status === 200) {
        const bytes = Buffer.from(await response.arrayBuffer());
        if (bytes.length === 0 || bytes.length > 4096) packagingFail('READY_RESPONSE_NOT_SMALL');
        const text = bytes.toString('utf8');
        validateTextForClues(text, identityTokens);
        return { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
      }
      lastFailure = `status-${response.status}`;
    } catch (error) {
      if (error instanceof PackagingError) throw error;
      lastFailure = 'request-failed';
    }
    await wait(100);
  }
  packagingFail('SERVE_READINESS_TIMEOUT', lastFailure);
}

async function verifyPlayableRoute(port, route) {
  let response;
  try {
    response = await fetch(`http://127.0.0.1:${port}${route}`, {
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(10_000)
    });
  } catch {
    packagingFail('PLAYABLE_ROUTE_REQUEST_FAILED');
  }
  if (response.status !== 200) packagingFail('PLAYABLE_ROUTE_NOT_READY');
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('text/html')) packagingFail('PLAYABLE_ROUTE_NOT_HTML');
  await response.body?.cancel();
}

async function terminateServer(child) {
  if (child.exitCode !== null) return;
  try {
    if (child.pid) process.kill(-child.pid, 'SIGTERM');
  } catch {
    // The group may already be gone.
  }
  if (child.exitCode !== null) return;
  const graceful = await Promise.race([
    new Promise((resolveExit) => child.once('close', () => resolveExit(true))),
    wait(5_000).then(() => false)
  ]);
  if (!graceful) {
    try {
      if (child.pid) process.kill(-child.pid, 'SIGKILL');
    } catch {
      // Best-effort cleanup follows a failed clean shutdown.
    }
    packagingFail('SERVE_SIGTERM_SHUTDOWN_FAILED');
  }
}

async function verifyServe(packageRoot, criticInterface, environment, logPath, identityTokens) {
  const port = await allocatePort();
  const child = spawn(
    NPM24_EXECUTABLE,
    ['run', 'serve:critic', '--', '--host', '127.0.0.1', '--port', String(port)],
    {
      cwd: packageRoot,
      env: environment,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true
    }
  );
  const stdoutChunks = [];
  const stderrChunks = [];
  let capturedBytes = 0;
  let overflow = false;
  let spawnFailed = false;
  const collect = (chunks) => (chunk) => {
    capturedBytes += chunk.length;
    if (capturedBytes > MAX_CAPTURE_BYTES) {
      overflow = true;
      return;
    }
    chunks.push(Buffer.from(chunk));
  };
  child.stdout.on('data', collect(stdoutChunks));
  child.stderr.on('data', collect(stderrChunks));
  child.once('error', () => {
    spawnFailed = true;
  });
  let readiness;
  try {
    readiness = await waitForServerReadiness(port, criticInterface.readyPath, child, identityTokens);
    const repeatedReadiness = await waitForServerReadiness(port, criticInterface.readyPath, child, identityTokens);
    if (readiness.bytes !== repeatedReadiness.bytes || readiness.sha256 !== repeatedReadiness.sha256) {
      packagingFail('READY_RESPONSE_NOT_DETERMINISTIC');
    }
    if (spawnFailed) packagingFail('SERVE_PROCESS_SPAWN_FAILED');
    if (overflow) packagingFail('SUBPROCESS_OUTPUT_LIMIT_EXCEEDED');
    await verifyPlayableRoute(port, criticInterface.normalPlayableRoute);
    await terminateServer(child);
  } catch (error) {
    try {
      await terminateServer(child);
    } catch {
      // Report the earlier serve failure.
    }
    throw error;
  } finally {
    const stdout = Buffer.concat(stdoutChunks);
    const stderr = Buffer.concat(stderrChunks);
    await writePrivateLog(logPath, stdout, stderr);
  }
  const transcript = `${Buffer.concat(stdoutChunks).toString('utf8')}\n${Buffer.concat(stderrChunks).toString('utf8')}`;
  if (spawnFailed) packagingFail('SERVE_PROCESS_SPAWN_FAILED');
  if (overflow) packagingFail('SUBPROCESS_OUTPUT_LIMIT_EXCEEDED');
  validateTextForClues(transcript, identityTokens);
  return readiness;
}

async function verifyNodeExecutable() {
  assertNode24();
  const expected = await realpath(NODE24_EXECUTABLE);
  const actual = await realpath(process.execPath);
  if (actual !== expected) packagingFail('EXACT_NODE24_EXECUTABLE_REQUIRED');
  await access(NPM24_EXECUTABLE);
  return process.version;
}

async function verifyCandidateCommands(packageRoot, candidate, criticInterface, sessionRoot, logDirectory, identityTokens) {
  const verificationRoot = resolve(sessionRoot, 'verification', candidate.alias);
  await copyRegularTree(packageRoot, verificationRoot);
  const before = await hashTree(verificationRoot);
  const lockBefore = await fileSha256(resolve(verificationRoot, 'package-lock.json'));
  const npmCache = resolve(sessionRoot, 'npm-cache', candidate.alias);
  const temporary = resolve(sessionRoot, 'tmp', candidate.alias);
  await mkdir(npmCache, { recursive: true, mode: 0o700 });
  await mkdir(temporary, { recursive: true, mode: 0o700 });
  const commandTokens = [...identityTokens, verificationRoot, sessionRoot];
  const environment = safeEnvironment({
    TMPDIR: temporary,
    npm_config_cache: npmCache,
    npm_config_userconfig: '/dev/null'
  });

  const install = await runCaptured(
    NPM24_EXECUTABLE,
    ['ci', '--audit=false', '--fund=false'],
    {
      cwd: verificationRoot,
      env: environment,
      timeoutMs: 30 * 60 * 1000,
      logPath: resolve(logDirectory, candidate.alias, 'npm-ci.log'),
      code: 'NPM_CI_FAILED'
    }
  );
  validateTextForClues(install.transcript, commandTokens);
  const lockAfterInstall = await fileSha256(resolve(verificationRoot, 'package-lock.json'));
  if (lockAfterInstall.bytes !== lockBefore.bytes || lockAfterInstall.sha256 !== lockBefore.sha256) {
    packagingFail('PACKAGE_LOCK_MUTATED_BY_INSTALL');
  }

  const testResult = await runCaptured(NPM24_EXECUTABLE, ['run', 'test:critic'], {
    cwd: verificationRoot,
    env: environment,
    timeoutMs: 15 * 60 * 1000,
    logPath: resolve(logDirectory, candidate.alias, 'test-critic.log'),
    code: 'TEST_CRITIC_FAILED'
  });
  validateTextForClues(testResult.transcript, commandTokens);
  validateTestTranscript(testResult.transcript);

  const buildResult = await runCaptured(NPM24_EXECUTABLE, ['run', 'build:critic'], {
    cwd: verificationRoot,
    env: environment,
    timeoutMs: 20 * 60 * 1000,
    logPath: resolve(logDirectory, candidate.alias, 'build-critic.log'),
    code: 'BUILD_CRITIC_FAILED'
  });
  validateTextForClues(buildResult.transcript, commandTokens);
  const outputRoot = resolve(verificationRoot, criticInterface.buildOutputDirectory);
  const outputDigest = await validateProductionOutput(outputRoot, commandTokens);
  const readiness = await verifyServe(
    verificationRoot,
    criticInterface,
    environment,
    resolve(logDirectory, candidate.alias, 'serve-critic.log'),
    commandTokens
  );

  await rm(resolve(verificationRoot, 'node_modules'), { recursive: true, force: true });
  await rm(outputRoot, { recursive: true, force: true });
  const after = await hashTree(verificationRoot);
  if (after.treeSha256 !== before.treeSha256) packagingFail('COMMAND_MUTATED_SOURCE_TREE');
  return { outputDigest, readiness };
}

async function verifyProtocolPayload(protocolDirectory) {
  const commitmentRecord = await readJsonStrict(resolve(protocolDirectory, 'COMMITMENT.json'));
  const commitment = commitmentRecord.value;
  if (
    commitment.schema !== 'p30.r011.protocol-commitment.v1' ||
    commitment.protocolID !== PROTOCOL_ID ||
    commitment.protocolPayload?.treeSha256 !== PROTOCOL_PAYLOAD_SHA256 ||
    commitment.presentation?.commit !== PRESENTATION_COMMIT ||
    commitment.amendment?.number !== 1 ||
    commitment.amendment?.status !== 'incorporated-before-candidate-delivery-or-access'
  ) {
    packagingFail('PROTOCOL_COMMITMENT_MISMATCH');
  }
  const listed = commitment.protocolPayload.files;
  if (!Array.isArray(listed) || listed.length !== commitment.protocolPayload.fileCount) {
    packagingFail('PROTOCOL_COMMITMENT_MISMATCH');
  }
  const digest = await hashExplicitFiles(protocolDirectory, listed.map((entry) => entry.path));
  if (
    digest.treeSha256 !== PROTOCOL_PAYLOAD_SHA256 ||
    digest.fileCount !== commitment.protocolPayload.fileCount ||
    BigInt(digest.totalBytes) !== BigInt(commitment.protocolPayload.totalBytes)
  ) {
    packagingFail('PROTOCOL_PAYLOAD_HASH_MISMATCH');
  }
  for (let index = 0; index < listed.length; index += 1) {
    const expected = listed[index];
    const actual = digest.entries[index];
    if (
      expected.path !== actual.path ||
      expected.mode !== actual.mode ||
      BigInt(expected.bytes) !== BigInt(actual.bytes) ||
      expected.sha256 !== actual.sha256
    ) {
      packagingFail('PROTOCOL_PAYLOAD_FILE_MISMATCH');
    }
  }
  return digest;
}

function validatePrivateConfig(config) {
  exactObjectKeys(config, CONFIG_KEYS, 'PRIVATE_CONFIG_SHAPE_MISMATCH');
  if (config.schema !== 'p30.r011.packaging-input.v1') packagingFail('PRIVATE_CONFIG_SCHEMA_MISMATCH');
  if (!isAbsolute(config.authorityRepository) || !isAbsolute(config.privateDirectory)) {
    packagingFail('PRIVATE_CONFIG_PATH_NOT_ABSOLUTE');
  }
  if (resolve(config.privateDirectory) !== PRIVATE_DIRECTORY_FROM_TOOL) packagingFail('PRIVATE_DIRECTORY_MISMATCH');
  if (!Array.isArray(config.candidates) || config.candidates.length !== 2) packagingFail('EXACTLY_TWO_CANDIDATES_REQUIRED');
  const aliases = new Set();
  for (const candidate of config.candidates) {
    exactObjectKeys(candidate, CANDIDATE_CONFIG_KEYS, 'CANDIDATE_CONFIG_SHAPE_MISMATCH');
    assertAlias(candidate.alias);
    if (aliases.has(candidate.alias)) packagingFail('DUPLICATE_OPAQUE_ALIAS');
    aliases.add(candidate.alias);
    if (
      typeof candidate.builderIdentity !== 'string' ||
      !candidate.builderIdentity.trim() ||
      candidate.builderIdentity.normalize('NFC') !== candidate.builderIdentity
    ) {
      packagingFail('INVALID_BUILDER_IDENTITY');
    }
    if (!isAbsolute(candidate.sourceWorktree)) packagingFail('SOURCE_WORKTREE_NOT_ABSOLUTE');
    if (
      typeof candidate.sourceBranch !== 'string' ||
      !candidate.sourceBranch ||
      candidate.sourceBranch.normalize('NFC') !== candidate.sourceBranch
    ) {
      packagingFail('INVALID_SOURCE_BRANCH');
    }
    assertHex40(candidate.sourceCommit, 'INVALID_FULL_SOURCE_COMMIT');
    assertHex40(candidate.sourceGitTree, 'INVALID_FULL_SOURCE_TREE');
    if (!Array.isArray(candidate.forbiddenTokens)) packagingFail('INVALID_PRIVATE_IDENTITY_TOKENS');
    for (const token of candidate.forbiddenTokens) {
      if (typeof token !== 'string' || token.length < 4 || token.normalize('NFC') !== token) {
        packagingFail('INVALID_PRIVATE_IDENTITY_TOKENS');
      }
    }
  }
  return config;
}

function privateTokensForAllCandidates(candidates, resolvedBindings) {
  const tokens = [];
  for (const candidate of candidates) {
    const binding = resolvedBindings.get(candidate.alias);
    tokens.push(
      candidate.builderIdentity,
      candidate.sourceBranch,
      candidate.sourceCommit,
      candidate.sourceGitTree,
      candidate.sourceWorktree,
      binding.sourceWorktree,
      basename(binding.sourceWorktree),
      ...candidate.forbiddenTokens
    );
  }
  return [...new Set(tokens)].sort(compareUtf8);
}

async function ensureOutputTargetsAbsent(privateDirectory) {
  const targets = [
    resolve(privateDirectory, 'delivery'),
    resolve(privateDirectory, 'source-archives'),
    resolve(privateDirectory, 'audit-logs'),
    resolve(privateDirectory, 'IDENTITY_SOURCE_MAP.json'),
    resolve(privateDirectory, 'MAP_SALT.hex'),
    PUBLIC_COMMITMENT_FROM_TOOL
  ];
  for (const target of targets) await requireAbsent(target);
}

async function createGitSourceArchive(authorityRepository, candidate, target, logDirectory) {
  await mkdir(dirname(target), { recursive: true, mode: 0o700 });
  await runGit(
    authorityRepository,
    ['archive', '--format=tar', `--output=${target}`, candidate.sourceCommit, WEB_GAME_PATH],
    {
      timeoutMs: 10 * 60 * 1000,
      logPath: resolve(logDirectory, candidate.alias, 'git-source-archive.log'),
      code: 'GIT_SOURCE_ARCHIVE_FAILED'
    }
  );
  await chmod(target, 0o600);
  return fileSha256(target);
}

function buildMapDocument(entries) {
  return {
    schema: 'p30.r011.identity-source-map.v1',
    protocolID: PROTOCOL_ID,
    protocolPayloadSha256: PROTOCOL_PAYLOAD_SHA256,
    presentationCommit: PRESENTATION_COMMIT,
    entries: [...entries].sort((left, right) => compareUtf8(left.alias, right.alias))
  };
}

function validateMapDocument(value) {
  exactObjectKeys(value, MAP_DOCUMENT_KEYS, 'MAP_DOCUMENT_SHAPE_MISMATCH');
  if (
    value.schema !== 'p30.r011.identity-source-map.v1' ||
    value.protocolID !== PROTOCOL_ID ||
    value.protocolPayloadSha256 !== PROTOCOL_PAYLOAD_SHA256 ||
    value.presentationCommit !== PRESENTATION_COMMIT ||
    !Array.isArray(value.entries) ||
    value.entries.length !== 2
  ) {
    packagingFail('MAP_DOCUMENT_CONSTANT_MISMATCH');
  }
  const aliases = [];
  for (const entry of value.entries) {
    exactObjectKeys(entry, MAP_ENTRY_KEYS, 'MAP_ENTRY_SHAPE_MISMATCH');
    assertAlias(entry.alias);
    aliases.push(entry.alias);
    if (typeof entry.builderIdentity !== 'string' || !entry.builderIdentity) packagingFail('MAP_ENTRY_IDENTITY_MISSING');
    if (!isAbsolute(entry.sourceWorktreePath) || typeof entry.sourceBranch !== 'string' || !entry.sourceBranch) {
      packagingFail('MAP_ENTRY_SOURCE_BINDING_INVALID');
    }
    assertHex40(entry.sourceCommit, 'MAP_ENTRY_COMMIT_INVALID');
    assertHex40(entry.sourceGitTree, 'MAP_ENTRY_TREE_INVALID');
    for (const field of ['sourceArchiveSha256', 'sourceTreeSha256', 'packageArchiveSha256', 'packageTreeSha256', 'productionOutputTreeSha256']) {
      assertHex64(entry[field], 'MAP_ENTRY_SHA256_INVALID');
    }
    for (const field of ['sourceArchiveBytes', 'packageArchiveBytes']) {
      if (!Number.isSafeInteger(entry[field]) || entry[field] <= 0) packagingFail('MAP_ENTRY_BYTE_COUNT_INVALID');
    }
    if (entry.buildCommand !== 'npm run build:critic') packagingFail('MAP_ENTRY_BUILD_COMMAND_INVALID');
    if (entry.sourceTreeSha256 !== entry.packageTreeSha256) packagingFail('MAP_ENTRY_SOURCE_PACKAGE_PARITY_INVALID');
  }
  const sorted = [...aliases].sort(compareUtf8);
  if (aliases.some((alias, index) => alias !== sorted[index]) || aliases[0] === aliases[1]) {
    packagingFail('MAP_ENTRIES_NOT_SORTED_UNIQUE');
  }
  return value;
}

export async function buildCandidates(configPath) {
  await verifyNodeExecutable();
  const absoluteConfig = resolve(configPath);
  const configInfo = await lstat(absoluteConfig);
  if (!configInfo.isFile() || configInfo.isSymbolicLink()) packagingFail('PRIVATE_CONFIG_NOT_REGULAR_FILE');
  const canonicalConfig = await realpath(absoluteConfig);
  assertInside(PRIVATE_DIRECTORY_FROM_TOOL, canonicalConfig, 'PRIVATE_CONFIG_OUTSIDE_IGNORED_DIRECTORY');
  const configRecord = await readJsonStrict(canonicalConfig);
  const config = validatePrivateConfig(configRecord.value);
  const canonicalPrivateDirectory = await realpath(config.privateDirectory);
  if (canonicalPrivateDirectory !== PRIVATE_DIRECTORY_FROM_TOOL) packagingFail('PRIVATE_DIRECTORY_MISMATCH');
  const authorityRepository = await realpath(config.authorityRepository);
  if (authorityRepository !== resolve(config.authorityRepository)) packagingFail('AUTHORITY_REPOSITORY_PATH_NOT_CANONICAL');
  if (authorityRepository !== resolve(TOOL_DIRECTORY, '../../../../..')) packagingFail('AUTHORITY_REPOSITORY_MISMATCH');
  const protocolDirectory = CRITIC_DIRECTORY_FROM_TOOL;
  await verifyProtocolPayload(protocolDirectory);
  await ensureOutputTargetsAbsent(config.privateDirectory);

  const sessionRoot = await mkdtemp(resolve(config.privateDirectory, '.session-'));
  const logDirectory = resolve(sessionRoot, 'audit-logs');
  const bindings = new Map();
  try {
    for (const candidate of config.candidates) {
      bindings.set(candidate.alias, await bindCandidateSource(authorityRepository, candidate));
    }
    const identityTokens = privateTokensForAllCandidates(config.candidates, bindings);
    const staged = [];

    for (const candidate of config.candidates) {
      const binding = bindings.get(candidate.alias);
      const detached = await createDetachedMaterializedCheckout(
        authorityRepository,
        candidate,
        sessionRoot,
        binding.files,
        logDirectory
      );
      try {
        const packageRoot = resolve(sessionRoot, 'packages', candidate.alias);
        await copyRegularTree(detached.webGameRoot, packageRoot);
        const sourceDigest = detached.treeDigest;
        const packageValidation = await validatePackageTree(packageRoot, candidate.alias, identityTokens);
        if (packageValidation.digest.treeSha256 !== sourceDigest.treeSha256) {
          packagingFail('SOURCE_PACKAGE_TREE_PARITY_MISMATCH');
        }

        const sourceArchivePath = resolve(sessionRoot, 'source-archives', `${candidate.alias}${PACKAGE_ARCHIVE_EXTENSION}`);
        const sourceArchive = await createGitSourceArchive(
          authorityRepository,
          candidate,
          sourceArchivePath,
          logDirectory
        );
        const packageArchivePath = resolve(sessionRoot, 'delivery', `${candidate.alias}${PACKAGE_ARCHIVE_EXTENSION}`);
        const packageArchive = await createDeterministicTar(packageRoot, packageArchivePath);
        const independentExtraction = resolve(sessionRoot, 'archive-check', candidate.alias);
        await extractDeterministicTar(packageArchivePath, independentExtraction);
        const archiveValidation = await validatePackageTree(independentExtraction, candidate.alias, identityTokens);
        if (archiveValidation.digest.treeSha256 !== packageValidation.digest.treeSha256) {
          packagingFail('ARCHIVE_EXTRACTION_TREE_MISMATCH');
        }
        await rm(independentExtraction, { recursive: true, force: true });
        staged.push({
          candidate,
          binding,
          packageRoot,
          packageValidation,
          sourceDigest,
          sourceArchive,
          packageArchive,
          lfsFiles: detached.lfsFiles
        });
      } finally {
        await removeDetachedCheckout(authorityRepository, detached.checkoutRoot);
      }
    }

    assertCommonInterfaces(staged.map((entry) => entry.packageValidation.criticInterface));
    if (staged[0].packageValidation.manifest.packageName !== staged[1].packageValidation.manifest.packageName) {
      packagingFail('PACKAGE_NAME_COMMON_MISMATCH');
    }
    for (const scriptName of ['test:critic', 'build:critic', 'serve:critic']) {
      if (
        staged[0].packageValidation.manifest.scripts[scriptName] !==
        staged[1].packageValidation.manifest.scripts[scriptName]
      ) {
        packagingFail('FIXED_SCRIPT_COMMON_MISMATCH');
      }
    }

    const mapEntries = [];
    const publicPackages = [];
    const readinessHashes = [];
    for (const entry of staged) {
      const commandVerification = await verifyCandidateCommands(
        entry.packageRoot,
        entry.candidate,
        entry.packageValidation.criticInterface,
        sessionRoot,
        logDirectory,
        identityTokens
      );
      readinessHashes.push(commandVerification.readiness.sha256);
      publicPackages.push({
        alias: entry.candidate.alias,
        archiveBytes: entry.packageArchive.bytes,
        archiveSha256: entry.packageArchive.sha256,
        treeSha256: entry.packageValidation.digest.treeSha256
      });
      mapEntries.push({
        alias: entry.candidate.alias,
        builderIdentity: entry.candidate.builderIdentity,
        sourceWorktreePath: entry.binding.sourceWorktree,
        sourceBranch: entry.candidate.sourceBranch,
        sourceCommit: entry.candidate.sourceCommit,
        sourceGitTree: entry.candidate.sourceGitTree,
        sourceArchiveBytes: entry.sourceArchive.bytes,
        sourceArchiveSha256: entry.sourceArchive.sha256,
        sourceTreeSha256: entry.sourceDigest.treeSha256,
        packageArchiveBytes: entry.packageArchive.bytes,
        packageArchiveSha256: entry.packageArchive.sha256,
        packageTreeSha256: entry.packageValidation.digest.treeSha256,
        buildCommand: 'npm run build:critic',
        productionOutputTreeSha256: commandVerification.outputDigest.treeSha256
      });
    }
    if (readinessHashes[0] !== readinessHashes[1]) packagingFail('READY_RESPONSE_COMMON_MISMATCH');

    const mapDocument = validateMapDocument(buildMapDocument(mapEntries));
    const salt = randomBytes(32);
    const mapCommit = computeMapCommit(mapDocument, salt);
    const publicCommitment = buildPublicCommitment(publicPackages, mapCommit);

    await rename(resolve(sessionRoot, 'delivery'), resolve(config.privateDirectory, 'delivery'));
    await rename(resolve(sessionRoot, 'source-archives'), resolve(config.privateDirectory, 'source-archives'));
    await rename(logDirectory, resolve(config.privateDirectory, 'audit-logs'));
    await writeCanonicalExclusive(resolve(config.privateDirectory, 'IDENTITY_SOURCE_MAP.json'), mapDocument, 0o600);
    await writeFile(resolve(config.privateDirectory, 'MAP_SALT.hex'), salt.toString('hex'), { flag: 'wx', mode: 0o600 });
    const publicReceipt = await writeCanonicalExclusive(PUBLIC_COMMITMENT_FROM_TOOL, publicCommitment, 0o644);
    await rm(sessionRoot, { recursive: true, force: true });

    return {
      status: 'ok',
      protocolID: PROTOCOL_ID,
      protocolPayloadSha256: PROTOCOL_PAYLOAD_SHA256,
      packageCount: 2,
      publicCommitmentSha256: publicReceipt.sha256
    };
  } catch (error) {
    const code = error instanceof PackagingError ? error.code : 'UNEXPECTED_PACKAGING_FAILURE';
    try {
      const privateFailure = {
        schema: 'p30.r011.packaging-private-failure.v1',
        code,
        detail: error instanceof PackagingError ? error.privateDetail : String(error?.stack ?? error)
      };
      await writeCanonicalExclusive(resolve(sessionRoot, 'PRIVATE_FAILURE.json'), privateFailure, 0o600);
    } catch {
      // Never replace the original failure or expose private detail on stdout/stderr.
    }
    throw error;
  }
}

export async function verifyPublicDelivery(publicCommitmentPath, deliveryDirectory) {
  await verifyNodeExecutable();
  const publicBefore = await fileSha256(publicCommitmentPath);
  const publicRecord = await readCanonicalDocument(publicCommitmentPath);
  const publicCommitment = validatePublicCommitment(publicRecord.value);
  await assertDirectoryContainsOnly(
    deliveryDirectory,
    publicCommitment.packages.map((entry) => `${entry.alias}${PACKAGE_ARCHIVE_EXTENSION}`)
  );
  const verificationRoot = await mkdtemp(resolve(PACKAGING_DIRECTORY, '.verify-public-'));
  try {
    const interfaces = [];
    const manifests = [];
    for (const receipt of publicCommitment.packages) {
      const validated = await hashAndValidatePublicArchive(
        resolve(deliveryDirectory, `${receipt.alias}${PACKAGE_ARCHIVE_EXTENSION}`),
        receipt,
        resolve(verificationRoot, receipt.alias)
      );
      interfaces.push(validated.criticInterface);
      manifests.push(validated.manifest);
    }
    assertCommonInterfaces(interfaces);
    if (manifests[0].packageName !== manifests[1].packageName) packagingFail('PACKAGE_NAME_COMMON_MISMATCH');
    for (const scriptName of ['test:critic', 'build:critic', 'serve:critic']) {
      if (manifests[0].scripts[scriptName] !== manifests[1].scripts[scriptName]) {
        packagingFail('FIXED_SCRIPT_COMMON_MISMATCH');
      }
    }
  } finally {
    await rm(verificationRoot, { recursive: true, force: true });
  }
  const receiptHash = await fileSha256(publicCommitmentPath);
  if (receiptHash.bytes !== publicBefore.bytes || receiptHash.sha256 !== publicBefore.sha256) {
    packagingFail('PUBLIC_COMMITMENT_MUTATED_DURING_VERIFICATION');
  }
  return {
    status: 'ok',
    protocolID: PROTOCOL_ID,
    packageCount: 2,
    publicCommitmentSha256: receiptHash.sha256
  };
}

export async function verifyRevealedMap(publicCommitmentPath, mapDocumentPath, saltPath) {
  await verifyNodeExecutable();
  const publicCommitment = validatePublicCommitment((await readCanonicalDocument(publicCommitmentPath)).value);
  const mapDocument = validateMapDocument((await readCanonicalDocument(mapDocumentPath)).value);
  const saltBytes = await readFile(saltPath);
  let saltHex;
  try {
    saltHex = new TextDecoder('utf-8', { fatal: true }).decode(saltBytes);
  } catch {
    packagingFail('INVALID_MAP_SALT_FILE');
  }
  if (!/^[0-9a-f]{64}$/u.test(saltHex)) packagingFail('INVALID_MAP_SALT_FILE');
  const salt = Buffer.from(saltHex, 'hex');
  if (computeMapCommit(mapDocument, salt) !== publicCommitment.mapCommit) packagingFail('REVEALED_MAP_COMMIT_MISMATCH');
  for (let index = 0; index < publicCommitment.packages.length; index += 1) {
    const publicEntry = publicCommitment.packages[index];
    const privateEntry = mapDocument.entries[index];
    if (
      publicEntry.alias !== privateEntry.alias ||
      publicEntry.archiveBytes !== privateEntry.packageArchiveBytes ||
      publicEntry.archiveSha256 !== privateEntry.packageArchiveSha256 ||
      publicEntry.treeSha256 !== privateEntry.packageTreeSha256
    ) {
      packagingFail('REVEALED_MAP_PUBLIC_BINDING_MISMATCH');
    }
  }
  return { status: 'ok', protocolID: PROTOCOL_ID, packageCount: 2, mapCommitVerified: true };
}

export async function verifyProtocolOnly() {
  await verifyNodeExecutable();
  const digest = await verifyProtocolPayload(CRITIC_DIRECTORY_FROM_TOOL);
  return {
    status: 'ok',
    protocolID: PROTOCOL_ID,
    protocolPayloadSha256: digest.treeSha256,
    protocolFileCount: digest.fileCount
  };
}

function usage() {
  return [
    'Usage:',
    '  package-candidates.mjs protocol-check',
    '  package-candidates.mjs build PRIVATE_CONFIG_JSON',
    '  package-candidates.mjs verify-public PACKAGE_MAP_COMMITMENT_JSON DELIVERY_DIRECTORY',
    '  package-candidates.mjs verify-reveal PACKAGE_MAP_COMMITMENT_JSON MAP_DOCUMENT_JSON MAP_SALT_HEX'
  ].join('\n');
}

export async function main(argv) {
  const [command, ...args] = argv;
  let result;
  if (command === 'protocol-check' && args.length === 0) {
    result = await verifyProtocolOnly();
  } else if (command === 'build' && args.length === 1) {
    result = await buildCandidates(args[0]);
  } else if (command === 'verify-public' && args.length === 2) {
    result = await verifyPublicDelivery(args[0], args[1]);
  } else if (command === 'verify-reveal' && args.length === 3) {
    result = await verifyRevealedMap(args[0], args[1], args[2]);
  } else {
    packagingFail('INVALID_COMMAND', usage());
  }
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath && fileURLToPath(import.meta.url) === invokedPath) {
  main(process.argv.slice(2)).catch((error) => {
    const code = error instanceof PackagingError ? error.code : 'UNEXPECTED_PACKAGING_FAILURE';
    process.stderr.write(`PACKAGING_ERROR:${code}\n`);
    process.exitCode = 1;
  });
}
