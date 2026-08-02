import assert from 'node:assert/strict';
import { chmod, link, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
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
  registerCaseFoldedPath
} from './tree-helper.mjs';

async function scratch(context, prefix = 'p30-r012-tree-') {
  const root = await mkdtemp(join(tmpdir(), prefix));
  context.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

function code(error, expected) {
  return error instanceof Round012TreeError && error.code === expected;
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
