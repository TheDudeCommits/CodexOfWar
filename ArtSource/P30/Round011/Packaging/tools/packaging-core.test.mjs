import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import {
  chmod,
  link,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { hashTree } from '../../Critic/tools/protocol-tools.mjs';
import {
  MAP_COMMIT_DOMAIN,
  NODE24_EXECUTABLE,
  PRESENTATION_COMMIT,
  PROTOCOL_ID,
  PROTOCOL_PAYLOAD_SHA256,
  PackagingError,
  assertCommonInterfaces,
  buildPublicCommitment,
  computeMapCommit,
  createDeterministicTar,
  extractDeterministicTar,
  fileSha256,
  parseCanonicalDocument,
  parseJsonStrict,
  scanRegularTree,
  validateCriticInterface,
  validatePackageManifest,
  validatePackageTree,
  validateProductionOutput,
  validatePublicCommitment,
  validateRelativePath,
  validateRelativePathSet,
  validateTestTranscript,
  validateTextForClues,
  writeCanonicalExclusive
} from './packaging-core.mjs';
import { verifyPublicDelivery } from './package-candidates.mjs';

const TOOL_PATH = resolve(dirname(fileURLToPath(import.meta.url)), 'package-candidates.mjs');

function validInterface(alias, overrides = {}) {
  return {
    schema: 'p30.r011.candidate-interface.v1',
    protocolID: PROTOCOL_ID,
    opaqueAlias: alias,
    nodeMajor: 24,
    packageManager: 'npm',
    normalPlayableRoute: '/game?p30=1&seed=30011',
    readyPath: '/ready',
    scenarioID: 'P30-light-strike-v1',
    seed: 30011,
    fixedDeltaNumerator: 1,
    fixedDeltaDenominator: 60,
    captureTickSpace: 'absolute-scenario',
    attackRisingEdgeAbsoluteTick: 24,
    lightStrikeInput: { device: 'mouse', button: 'left' },
    criticHookGlobal: '__P30_CRITIC__',
    buildOutputDirectory: 'dist',
    ...overrides
  };
}

function validPackageJson(overrides = {}) {
  return {
    name: 'p30-r011-production-game',
    private: true,
    version: '1.0.0',
    type: 'module',
    engines: { node: '24.x' },
    scripts: {
      'test:critic': 'node --test tests/core.test.mjs',
      'build:critic': 'node scripts/build-production.mjs',
      'serve:critic': 'node scripts/serve-production.mjs',
      ...overrides.scripts
    },
    dependencies: {},
    devDependencies: {},
    ...overrides,
    scripts: {
      'test:critic': 'node --test tests/core.test.mjs',
      'build:critic': 'node scripts/build-production.mjs',
      'serve:critic': 'node scripts/serve-production.mjs',
      ...overrides.scripts
    }
  };
}

function validPackageLock(packageJson) {
  return {
    name: packageJson.name,
    version: packageJson.version,
    lockfileVersion: 3,
    requires: true,
    packages: {
      '': {
        name: packageJson.name,
        version: packageJson.version,
        engines: { node: packageJson.engines.node }
      }
    }
  };
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function makePackage(root, alias, { source = 'export const ready = true;\n', packageJson } = {}) {
  const manifest = packageJson ?? validPackageJson();
  await mkdir(join(root, 'src'), { recursive: true });
  await mkdir(join(root, 'tests'), { recursive: true });
  await mkdir(join(root, 'scripts'), { recursive: true });
  await writeJson(join(root, 'CRITIC_INTERFACE.json'), validInterface(alias));
  await writeJson(join(root, 'package.json'), manifest);
  await writeJson(join(root, 'package-lock.json'), validPackageLock(manifest));
  await writeFile(join(root, 'src', 'main.mjs'), source);
  await writeFile(join(root, 'tests', 'core.test.mjs'), 'import test from "node:test"; test("ok", () => {});\n');
  await writeFile(join(root, 'scripts', 'build-production.mjs'), 'export {};\n');
  await writeFile(join(root, 'scripts', 'serve-production.mjs'), 'export {};\n');
  return root;
}

function rewriteTarChecksum(header) {
  header.fill(0x20, 148, 156);
  let checksum = 0;
  for (const byte of header) checksum += byte;
  const text = `${checksum.toString(8).padStart(6, '0')}\0 `;
  Buffer.from(text, 'ascii').copy(header, 148);
}

async function runCli(args) {
  const child = spawn(NODE24_EXECUTABLE, [TOOL_PATH, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
  const stdout = [];
  const stderr = [];
  child.stdout.on('data', (chunk) => stdout.push(Buffer.from(chunk)));
  child.stderr.on('data', (chunk) => stderr.push(Buffer.from(chunk)));
  const exitCode = await new Promise((resolveExit, rejectExit) => {
    child.once('error', rejectExit);
    child.once('close', resolveExit);
  });
  return {
    exitCode,
    stdout: Buffer.concat(stdout).toString('utf8'),
    stderr: Buffer.concat(stderr).toString('utf8')
  };
}

test('strict JSON rejects duplicate keys and canonical parser rejects whitespace', () => {
  assert.deepEqual(parseJsonStrict('{"a":1,"nested":{"b":true}}'), { a: 1, nested: { b: true } });
  assert.throws(() => parseJsonStrict('{"a":1,"a":2}'), (error) => error.code === 'DUPLICATE_JSON_KEY');
  assert.deepEqual(parseCanonicalDocument('{"a":1,"b":2}'), { a: 1, b: 2 });
  assert.throws(() => parseCanonicalDocument('{ "a": 1 }'), (error) => error.code === 'NON_CANONICAL_BCJ_DOCUMENT');
});

test('critic interface enforces the amended absolute scenario tick contract and exact shape', () => {
  const firstAlias = 'candidate-1111111111111111';
  const secondAlias = 'candidate-2222222222222222';
  const first = validateCriticInterface(validInterface(firstAlias), firstAlias);
  const second = validateCriticInterface(validInterface(secondAlias), secondAlias);
  assertCommonInterfaces([first, second]);
  assert.throws(
    () => validateCriticInterface(validInterface(firstAlias, { captureTickSpace: 'attack-relative' }), firstAlias),
    (error) => error.code === 'CRITIC_INTERFACE_ABSOLUTE_TICK_MISMATCH'
  );
  assert.throws(
    () => validateCriticInterface(validInterface(firstAlias, { attackRisingEdgeAbsoluteTick: 0 }), firstAlias),
    (error) => error.code === 'CRITIC_INTERFACE_ABSOLUTE_TICK_MISMATCH'
  );
  assert.throws(
    () => validateCriticInterface({ ...validInterface(firstAlias), freeFormNotes: 'no' }, firstAlias),
    (error) => error.code === 'CRITIC_INTERFACE_SHAPE_MISMATCH'
  );
  assert.throws(
    () => assertCommonInterfaces([first, validInterface(secondAlias, { normalPlayableRoute: '/special' })]),
    (error) => error.code === 'CRITIC_INTERFACE_COMMON_MISMATCH'
  );
});

test('relative paths reject traversal, backslashes, non-NFC values, and case collisions', () => {
  assert.equal(validateRelativePath('src/ok.ts'), 'src/ok.ts');
  assert.throws(() => validateRelativePath('../escape'), (error) => error.code === 'PACKAGE_PATH_TRAVERSAL');
  assert.throws(() => validateRelativePath('src\\escape'), (error) => error.code === 'INVALID_PACKAGE_PATH');
  assert.throws(() => validateRelativePath('src/e\u0301.ts'), (error) => error.code === 'NON_NFC_PACKAGE_PATH');
  assert.throws(
    () => validateRelativePathSet(['src/Thing.ts', 'src/thing.ts']),
    (error) => error.code === 'CASE_COLLIDING_PACKAGE_PATH'
  );
});

test('tree scan rejects symlinks and hard-link aliases', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'p30-r011-tree-policy-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'file.txt'), 'payload\n');
  await symlink('file.txt', join(root, 'link.txt'));
  await assert.rejects(() => scanRegularTree(root), (error) => error.code === 'SYMLINK_FORBIDDEN');
  await rm(join(root, 'link.txt'));
  await link(join(root, 'file.txt'), join(root, 'alias.txt'));
  await assert.rejects(() => scanRegularTree(root), (error) => error.code === 'HARDLINK_FORBIDDEN');
});

test('deterministic tar is creation-order independent and round-trips long PAX paths', async (context) => {
  const scratch = await mkdtemp(join(tmpdir(), 'p30-r011-tar-'));
  context.after(() => rm(scratch, { recursive: true, force: true }));
  const first = join(scratch, 'first');
  const second = join(scratch, 'second');
  const longPath = `${'a'.repeat(80)}/${'b'.repeat(80)}/${'c'.repeat(80)}/payload.txt`;
  for (const root of [first, second]) await mkdir(join(root, dirname(longPath)), { recursive: true });
  await writeFile(join(first, 'z.txt'), 'last\n');
  await writeFile(join(first, longPath), 'long\n');
  await writeFile(join(second, longPath), 'long\n');
  await writeFile(join(second, 'z.txt'), 'last\n');
  await chmod(join(first, 'z.txt'), 0o755);
  await chmod(join(second, 'z.txt'), 0o755);
  const archiveA = join(scratch, 'a.tar');
  const archiveB = join(scratch, 'b.tar');
  const hashA = await createDeterministicTar(first, archiveA);
  const hashB = await createDeterministicTar(second, archiveB);
  assert.deepEqual(hashA, hashB);
  assert.deepEqual(await readFile(archiveA), await readFile(archiveB));
  const extracted = join(scratch, 'extracted');
  await extractDeterministicTar(archiveA, extracted);
  assert.equal((await hashTree(extracted)).treeSha256, (await hashTree(first)).treeSha256);
});

test('tar extraction rejects traversal and link/special entry types', async (context) => {
  const scratch = await mkdtemp(join(tmpdir(), 'p30-r011-tar-reject-'));
  context.after(() => rm(scratch, { recursive: true, force: true }));
  const source = join(scratch, 'source');
  await mkdir(source);
  await writeFile(join(source, 'a.txt'), 'x');
  const canonical = join(scratch, 'canonical.tar');
  await createDeterministicTar(source, canonical);

  const traversalBytes = await readFile(canonical);
  traversalBytes.fill(0, 0, 100);
  Buffer.from('../x', 'ascii').copy(traversalBytes, 0);
  rewriteTarChecksum(traversalBytes.subarray(0, 512));
  const traversalArchive = join(scratch, 'traversal.tar');
  await writeFile(traversalArchive, traversalBytes);
  await assert.rejects(
    () => extractDeterministicTar(traversalArchive, join(scratch, 'traversal-out')),
    (error) => error.code === 'PACKAGE_PATH_TRAVERSAL'
  );

  const linkBytes = await readFile(canonical);
  linkBytes[156] = '2'.charCodeAt(0);
  rewriteTarChecksum(linkBytes.subarray(0, 512));
  const linkArchive = join(scratch, 'link.tar');
  await writeFile(linkArchive, linkBytes);
  await assert.rejects(
    () => extractDeterministicTar(linkArchive, join(scratch, 'link-out')),
    (error) => error.code === 'TAR_LINK_OR_SPECIAL_ENTRY_FORBIDDEN'
  );
});

test('package manifest rejects local dependencies, bypass scripts, lifecycle hooks, and lock mismatch', () => {
  const manifest = validPackageJson();
  const lockfile = validPackageLock(manifest);
  assert.equal(validatePackageManifest(manifest, lockfile).packageName, manifest.name);

  const local = validPackageJson({ dependencies: { sibling: 'file:../sibling' } });
  assert.throws(
    () => validatePackageManifest(local, validPackageLock(local)),
    (error) => error.code === 'LOCAL_DEPENDENCY_FORBIDDEN'
  );
  const bypass = validPackageJson({ scripts: { 'test:critic': 'vitest run --passWithNoTests' } });
  assert.throws(
    () => validatePackageManifest(bypass, validPackageLock(bypass)),
    (error) => error.code === 'FIXED_SCRIPT_BYPASS_FORBIDDEN'
  );
  const hook = validPackageJson({ scripts: { preinstall: 'node setup.mjs' } });
  assert.throws(
    () => validatePackageManifest(hook, validPackageLock(hook)),
    (error) => error.code === 'NPM_LIFECYCLE_HOOK_FORBIDDEN'
  );
  const mismatchedLock = validPackageLock(manifest);
  mismatchedLock.name = 'different';
  assert.throws(
    () => validatePackageManifest(manifest, mismatchedLock),
    (error) => error.code === 'PACKAGE_LOCK_ROOT_MISMATCH'
  );
});

test('package tree rejects private tokens, absolute paths, source maps, build output, and evidence paths', async (context) => {
  const scratch = await mkdtemp(join(tmpdir(), 'p30-r011-package-policy-'));
  context.after(() => rm(scratch, { recursive: true, force: true }));
  const alias = 'candidate-3333333333333333';
  const validRoot = join(scratch, 'valid');
  await makePackage(validRoot, alias);
  const validated = await validatePackageTree(validRoot, alias, ['private-person-token']);
  assert.equal(validated.criticInterface.captureTickSpace, 'absolute-scenario');

  const privateRoot = join(scratch, 'private');
  await makePackage(privateRoot, alias, { source: 'export const owner = "private-person-token";\n' });
  await assert.rejects(
    () => validatePackageTree(privateRoot, alias, ['private-person-token']),
    (error) => error.code === 'PRIVATE_IDENTITY_CLUE_FOUND'
  );

  const absoluteRoot = join(scratch, 'absolute');
  await makePackage(absoluteRoot, alias, { source: 'export const path = "/Users/example/work/file.ts";\n' });
  await assert.rejects(
    () => validatePackageTree(absoluteRoot, alias),
    (error) => error.code === 'ABSOLUTE_PATH_CLUE_FOUND'
  );

  const mapRoot = join(scratch, 'map');
  await makePackage(mapRoot, alias);
  await writeFile(join(mapRoot, 'src', 'main.mjs.map'), '{}');
  await assert.rejects(
    () => validatePackageTree(mapRoot, alias),
    (error) => error.code === 'FORBIDDEN_PACKAGE_FILE_TYPE'
  );

  const outputRoot = join(scratch, 'output');
  await makePackage(outputRoot, alias);
  await mkdir(join(outputRoot, 'dist'));
  await writeFile(join(outputRoot, 'dist', 'index.html'), '<!doctype html>');
  await assert.rejects(
    () => validatePackageTree(outputRoot, alias),
    (error) => error.code === 'PREEXISTING_BUILD_OUTPUT'
  );

  const evidenceRoot = join(scratch, 'evidence');
  await makePackage(evidenceRoot, alias);
  await writeFile(join(evidenceRoot, 'scripts', 'p30-round-audit-capture.mjs'), 'export {};\n');
  await assert.rejects(
    () => validatePackageTree(evidenceRoot, alias),
    (error) => error.code === 'BUILDER_EVIDENCE_PATH_FORBIDDEN'
  );

  const siblingRoot = join(scratch, 'sibling');
  await makePackage(siblingRoot, alias, { source: 'import secret from "../../sibling/secret.mjs";\n' });
  await assert.rejects(
    () => validatePackageTree(siblingRoot, alias),
    (error) => error.code === 'SIBLING_SOURCE_DEPENDENCY_FORBIDDEN'
  );

  const binaryRoot = join(scratch, 'binary');
  await makePackage(binaryRoot, alias);
  await writeFile(join(binaryRoot, 'src', 'asset.bin'), Buffer.concat([Buffer.from([0, 1, 2]), Buffer.from('private-person-token')]));
  await assert.rejects(
    () => validatePackageTree(binaryRoot, alias, ['private-person-token']),
    (error) => error.code === 'PRIVATE_IDENTITY_CLUE_FOUND'
  );
});

test('production output permits local assets and rejects remote runtime assets and source-map directives', async (context) => {
  const scratch = await mkdtemp(join(tmpdir(), 'p30-r011-output-policy-'));
  context.after(() => rm(scratch, { recursive: true, force: true }));
  const valid = join(scratch, 'valid');
  await mkdir(join(valid, 'assets'), { recursive: true });
  await writeFile(join(valid, 'index.html'), '<script type="module" src="/assets/app.js"></script>');
  await writeFile(join(valid, 'assets', 'app.js'), 'console.info("ready");\n');
  assert.match((await validateProductionOutput(valid)).treeSha256, /^[0-9a-f]{64}$/u);

  const external = join(scratch, 'external');
  await mkdir(external);
  await writeFile(external + '/index.html', '<script src="https://example.invalid/game.js"></script>');
  await assert.rejects(
    () => validateProductionOutput(external),
    (error) => error.code === 'EXTERNAL_RUNTIME_ASSET_REFERENCE'
  );

  const sourceMap = join(scratch, 'source-map');
  await mkdir(sourceMap);
  await writeFile(join(sourceMap, 'app.js'), 'console.info(1);\n//# sourceMappingURL=app.js.map\n');
  await assert.rejects(
    () => validateProductionOutput(sourceMap),
    (error) => error.code === 'SOURCE_MAP_REFERENCE_FORBIDDEN'
  );
});

test('test transcript requires collected passing tests and rejects failures or skips', () => {
  assert.doesNotThrow(() => validateTestTranscript('Test Files  2 passed (2)\nTests  17 passed (17)\n'));
  assert.doesNotThrow(() => validateTestTranscript('# tests 4\n# pass 4\n# fail 0\n# skipped 0\n'));
  assert.throws(() => validateTestTranscript('# tests 0\n# pass 0\n'), (error) => error.code === 'NO_TESTS_COLLECTED');
  assert.throws(
    () => validateTestTranscript('# tests 4\n# pass 3\n# skipped 1\n'),
    (error) => error.code === 'TEST_FAILURE_OR_SKIP_REPORTED'
  );
});

test('identity and absolute-path transcript scans return stable codes without echoing secrets', () => {
  assert.doesNotThrow(() => validateTextForClues('Tests 10 passed', ['private-token']));
  assert.throws(
    () => validateTextForClues('owner=private-token', ['private-token']),
    (error) => error instanceof PackagingError && error.code === 'PRIVATE_IDENTITY_CLUE_FOUND' && !error.message.includes('private-token')
  );
  assert.throws(
    () => validateTextForClues('loaded /home/person/project/file.ts'),
    (error) => error.code === 'ABSOLUTE_PATH_CLUE_FOUND'
  );
});

test('public commitment is sorted, canonical, and binds deterministic archives end to end', async (context) => {
  const scratch = await mkdtemp(join(tmpdir(), 'p30-r011-public-'));
  context.after(() => rm(scratch, { recursive: true, force: true }));
  const aliases = ['candidate-eeeeeeeeeeeeeeee', 'candidate-4444444444444444'];
  const delivery = join(scratch, 'delivery');
  await mkdir(delivery);
  const receipts = [];
  for (const alias of aliases) {
    const root = join(scratch, 'packages', alias);
    await makePackage(root, alias);
    const tree = await validatePackageTree(root, alias);
    const archivePath = join(delivery, `${alias}.tar`);
    const archive = await createDeterministicTar(root, archivePath);
    receipts.push({
      alias,
      archiveBytes: archive.bytes,
      archiveSha256: archive.sha256,
      treeSha256: tree.digest.treeSha256
    });
  }
  const mapDocument = {
    schema: 'test-map',
    entries: aliases.slice().sort().map((alias) => ({ alias }))
  };
  const salt = Buffer.alloc(32, 0xa5);
  const mapCommit = computeMapCommit(mapDocument, salt);
  const publicCommitment = buildPublicCommitment(receipts.reverse(), mapCommit);
  assert.deepEqual(publicCommitment.packages.map((entry) => entry.alias), aliases.slice().sort());
  assert.equal(publicCommitment.protocolPayloadSha256, PROTOCOL_PAYLOAD_SHA256);
  assert.equal(publicCommitment.presentationCommit, PRESENTATION_COMMIT);
  assert.equal(publicCommitment.mapCommitDomain, MAP_COMMIT_DOMAIN);
  validatePublicCommitment(publicCommitment);
  const publicPath = join(scratch, 'PACKAGE_MAP_COMMITMENT.json');
  await writeCanonicalExclusive(publicPath, publicCommitment, 0o644);
  const source = await readFile(publicPath, 'utf8');
  assert.deepEqual(parseCanonicalDocument(source), publicCommitment);
  const verified = await verifyPublicDelivery(publicPath, delivery);
  assert.equal(verified.packageCount, 2);
  assert.equal(verified.publicCommitmentSha256, (await fileSha256(publicPath)).sha256);
});

test('CLI emits only a sanitized stable error code on failure', async () => {
  const result = await runCli(['invalid-command', '/Users/private/identity']);
  assert.notEqual(result.exitCode, 0);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, 'PACKAGING_ERROR:INVALID_COMMAND\n');
  assert.equal(result.stderr.includes('/Users/private/identity'), false);
});

test('protocol check CLI verifies Amendment 01 payload under exact Node 24', async () => {
  const result = await runCli(['protocol-check']);
  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, '');
  const value = JSON.parse(result.stdout);
  assert.deepEqual(value, {
    status: 'ok',
    protocolID: PROTOCOL_ID,
    protocolPayloadSha256: PROTOCOL_PAYLOAD_SHA256,
    protocolFileCount: 8
  });
});
