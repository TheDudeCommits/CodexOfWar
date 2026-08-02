import assert from 'node:assert/strict';
import { chmod, link, mkdir, mkdtemp, open, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  Round012TreeError,
  TREE_DOMAIN,
  assertExactKeys,
  canonicalize,
  hashTree,
  parseCanonicalFile,
  parseJsonStrict,
  registerCaseFoldedPath,
  validateRelativePath
} from './tree-helper.mjs';

async function scratch(context, prefix = 'p30-r012-tree-') {
  const root = await mkdtemp(join(tmpdir(), prefix));
  context.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

function code(error, expected) {
  return error instanceof Round012TreeError && error.code === expected;
}

async function sparseFile(path, bytes = 32 * 1024 * 1024) {
  const handle = await open(path, 'w');
  try {
    await handle.truncate(bytes);
  } finally {
    await handle.close();
  }
}

async function mutateDuringFirstFileHash(root, mutate) {
  const probePath = join(root, 'a-large.bin');
  const probe = await open(probePath, 'r');
  const fileHandlePrototype = Object.getPrototypeOf(probe);
  await probe.close();

  const originalCreateReadStream = fileHandlePrototype.createReadStream;
  let signalStarted;
  const started = new Promise((resolveStarted) => {
    signalStarted = resolveStarted;
  });
  let didSignal = false;
  fileHandlePrototype.createReadStream = function (...args) {
    const stream = originalCreateReadStream.apply(this, args);
    if (!didSignal) {
      didSignal = true;
      signalStarted();
    }
    return stream;
  };

  const outcome = hashTree(root).then(
    (value) => ({ ok: true, value }),
    (error) => ({ ok: false, error })
  );
  try {
    const phase = await Promise.race([
      started.then(() => 'hashing'),
      outcome.then(() => 'settled')
    ]);
    assert.equal(phase, 'hashing', 'tree hash settled before the coordinated mutation point');
    await mutate();
    const result = await outcome;
    if (!result.ok) throw result.error;
    return result.value;
  } finally {
    fileHandlePrototype.createReadStream = originalCreateReadStream;
  }
}

test('BCJ-v1 is raw-UTF8 ordered and rejects ambiguous numeric values', () => {
  assert.equal(canonicalize({ z: 2, a: [true, null, 'NFC'] }), '{"a":[true,null,"NFC"],"z":2}');
  assert.throws(() => canonicalize({ value: 0.5 }), (error) => code(error, 'BCJ_INVALID_NUMBER'));
  assert.throws(() => canonicalize({ value: -0 }), (error) => code(error, 'BCJ_INVALID_NUMBER'));
  assert.throws(() => canonicalize({ value: 2 ** 53 }), (error) => code(error, 'BCJ_INVALID_NUMBER'));
});

test('strict JSON rejects duplicate keys and canonical files reject whitespace ambiguity', () => {
  assert.deepEqual(parseJsonStrict('{"a":1,"b":2}'), { a: 1, b: 2 });
  assert.throws(() => parseJsonStrict('{"a":1,"a":2}'), (error) => code(error, 'DUPLICATE_JSON_KEY'));
  assert.deepEqual(parseCanonicalFile('{"a":1,"b":2}\n'), { a: 1, b: 2 });
  assert.throws(() => parseCanonicalFile('{ "a": 1 }\n'), (error) => code(error, 'NON_CANONICAL_BCJ_FILE'));
  assert.throws(() => parseCanonicalFile('{"a":1}'), (error) => code(error, 'NON_CANONICAL_BCJ_FILE'));
  assert.throws(() => parseCanonicalFile('{"a":1}\n\n'), (error) => code(error, 'NON_CANONICAL_BCJ_FILE'));
});

test('exact-object validation rejects unknown and missing fields consistently', () => {
  assert.doesNotThrow(() => assertExactKeys({ a: 1, b: 2 }, ['a', 'b'], 'TEST_SHAPE'));
  assert.throws(() => assertExactKeys({ a: 1 }, ['a', 'b'], 'TEST_SHAPE'), (error) => code(error, 'TEST_SHAPE'));
  assert.throws(
    () => assertExactKeys({ a: 1, b: 2, hidden: 3 }, ['a', 'b'], 'TEST_SHAPE'),
    (error) => code(error, 'TEST_SHAPE')
  );
});

test('tree digest is reproducible, creation-order independent, and mode-sensitive', async (context) => {
  const first = await scratch(context, 'p30-r012-tree-a-');
  const second = await scratch(context, 'p30-r012-tree-b-');
  await mkdir(join(first, 'nested'));
  await writeFile(join(first, 'z.txt'), 'last\n');
  await writeFile(join(first, 'nested', 'a.txt'), 'first\n');
  await mkdir(join(second, 'nested'));
  await writeFile(join(second, 'nested', 'a.txt'), 'first\n');
  await writeFile(join(second, 'z.txt'), 'last\n');
  const digestA = await hashTree(first);
  const digestB = await hashTree(second);
  assert.equal(digestA.domain, TREE_DOMAIN);
  assert.equal(digestA.treeSha256, digestB.treeSha256);
  assert.equal(digestA.treeSha256, '7fce3e5afb086e01dd15af502c539ff252083e8a1713c38284099d6c5e68fbe2');
  await chmod(join(second, 'z.txt'), 0o755);
  assert.notEqual((await hashTree(second)).treeSha256, digestA.treeSha256);
});

test('tree digest rejects symlinks and hard links', async (context) => {
  const root = await scratch(context);
  await writeFile(join(root, 'payload.txt'), 'payload\n');
  await symlink('payload.txt', join(root, 'symlink.txt'));
  await assert.rejects(() => hashTree(root), (error) => code(error, 'TREE_SYMLINK_FORBIDDEN'));
  await rm(join(root, 'symlink.txt'));
  await link(join(root, 'payload.txt'), join(root, 'hardlink.txt'));
  await assert.rejects(() => hashTree(root), (error) => code(error, 'TREE_HARDLINK_FORBIDDEN'));
});

test('case-fold registry rejects cross-platform path ambiguity', () => {
  const paths = new Map();
  registerCaseFoldedPath(paths, 'Nested/Case.txt');
  assert.throws(
    () => registerCaseFoldedPath(paths, 'nested/case.txt'),
    (error) => code(error, 'TREE_CASE_COLLISION')
  );
});

test('relative-path validation rejects traversal, separators, absolute paths, and non-NFC names', () => {
  assert.equal(validateRelativePath('nested/file.txt'), 'nested/file.txt');
  for (const invalid of ['../escape', 'nested/../escape', 'nested//file', '/absolute', 'win\\path']) {
    assert.throws(() => validateRelativePath(invalid), (error) =>
      error instanceof Round012TreeError && ['TREE_INVALID_PATH', 'TREE_PATH_TRAVERSAL'].includes(error.code)
    );
  }
  assert.throws(
    () => validateRelativePath('Cafe\u0301/file.txt'),
    (error) => code(error, 'TREE_NON_NFC_PATH')
  );
});

test('tree hash rejects an ancestor directory swapped for a symlink after enumeration', async (context) => {
  const root = await scratch(context, 'p30-r012-tree-symlink-race-');
  await sparseFile(join(root, 'a-large.bin'));
  const ancestor = join(root, 'z-ancestor');
  const held = join(root, 'z-ancestor-held');
  await mkdir(ancestor);
  await writeFile(join(ancestor, 'payload.txt'), 'payload\n');

  await assert.rejects(
    () => mutateDuringFirstFileHash(root, async () => {
      await rename(ancestor, held);
      await symlink('z-ancestor-held', ancestor);
    }),
    (error) => code(error, 'TREE_SYMLINK_FORBIDDEN')
  );
});

test('tree hash rejects a multi-level nested ancestor symlink swap', async (context) => {
  const root = await scratch(context, 'p30-r012-tree-nested-race-');
  await sparseFile(join(root, 'a-large.bin'));
  const outer = join(root, 'z-outer');
  const middle = join(outer, 'middle');
  const held = join(outer, 'middle-held');
  await mkdir(join(middle, 'inner'), { recursive: true });
  await writeFile(join(middle, 'inner', 'payload.txt'), 'payload\n');

  await assert.rejects(
    () => mutateDuringFirstFileHash(root, async () => {
      await rename(middle, held);
      await symlink('middle-held', middle);
    }),
    (error) => code(error, 'TREE_SYMLINK_FORBIDDEN')
  );
});

test('tree hash rejects directory rename-and-replace even with matching names and bytes', async (context) => {
  const root = await scratch(context, 'p30-r012-tree-replace-race-');
  await sparseFile(join(root, 'a-large.bin'));
  const ancestor = join(root, 'z-ancestor');
  const held = join(root, 'z-ancestor-held');
  await mkdir(ancestor);
  await writeFile(join(ancestor, 'payload.txt'), 'payload\n');

  await assert.rejects(
    () => mutateDuringFirstFileHash(root, async () => {
      await rename(ancestor, held);
      await mkdir(ancestor);
      await writeFile(join(ancestor, 'payload.txt'), 'payload\n');
    }),
    (error) => code(error, 'TREE_ENTRY_REPLACED')
  );
});

test('tree hash rejects in-place file mutation while its frozen handle is hashing', async (context) => {
  const root = await scratch(context, 'p30-r012-tree-file-race-');
  const payload = join(root, 'a-large.bin');
  await sparseFile(payload);

  await assert.rejects(
    () => mutateDuringFirstFileHash(root, async () => {
      const mutator = await open(payload, 'r+');
      try {
        await mutator.write(Buffer.from([0x7f]), 0, 1, 0);
      } finally {
        await mutator.close();
      }
    }),
    (error) => code(error, 'TREE_FILE_MUTATED')
  );
});
