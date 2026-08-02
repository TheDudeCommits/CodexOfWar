import assert from 'node:assert/strict';
import { mkdtemp, mkdir, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  canonicalize,
  deriveOrders,
  hashTree,
  presentationCommit,
  saltedDocumentCommit
} from './protocol-tools.mjs';

test('BCJ-v1 orders object keys by raw UTF-8 bytes and rejects decimals', () => {
  assert.equal(canonicalize({ z: 1, a: 'x', nested: [true, null] }), '{"a":"x","nested":[true,null],"z":1}');
  assert.throws(() => canonicalize({ value: 0.5 }), /safe signed integer/);
});

test('presentation commitment has a fixed vector', () => {
  const seed = Buffer.from('10ab9b1f69c7a013838bbbab5a6d284a9274c35978634017f213c9d596647744', 'hex');
  assert.equal(presentationCommit(seed), '5df2ec1607da073c492d94d7f1c47c23606d51b9fdbc267a3ada8d76e853b05f');
});

test('salted document commitment is stable across insertion order', () => {
  const salt = Buffer.alloc(32, 0xa5);
  const left = saltedDocumentCommit('P30R011/test/v1', { b: 2, a: 1 }, salt);
  const right = saltedDocumentCommit('P30R011/test/v1', { a: 1, b: 2 }, salt);
  assert.equal(left, right);
  assert.match(left, /^[0-9a-f]{64}$/);
});

test('tree digest is independent of creation order and rejects symlinks', async () => {
  const first = await mkdtemp(join(tmpdir(), 'p30-r011-tree-a-'));
  const second = await mkdtemp(join(tmpdir(), 'p30-r011-tree-b-'));
  await mkdir(join(first, 'nested'));
  await writeFile(join(first, 'z.txt'), 'last\n');
  await writeFile(join(first, 'nested', 'a.txt'), 'first\n');
  await mkdir(join(second, 'nested'));
  await writeFile(join(second, 'nested', 'a.txt'), 'first\n');
  await writeFile(join(second, 'z.txt'), 'last\n');
  const digestA = await hashTree(first);
  const digestB = await hashTree(second);
  assert.equal(digestA.treeSha256, digestB.treeSha256);
  await symlink(join(first, 'z.txt'), join(first, 'link.txt'));
  await assert.rejects(() => hashTree(first), /symbolic link forbidden/);
});

test('order derivation is deterministic and covers all nine ballots', () => {
  const seed = Buffer.alloc(32, 7);
  const aliases = ['candidate-1111111111111111', 'candidate-eeeeeeeeeeeeeeee'];
  const first = deriveOrders(seed, aliases);
  const second = deriveOrders(seed, [...aliases].reverse());
  assert.deepEqual(first, second);
  assert.equal(first.execution.length, 2);
  assert.deepEqual(Object.keys(first.ballots), ['F1', 'F2', 'F3', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6']);
  for (const ballot of Object.values(first.ballots)) {
    assert.deepEqual([ballot.left, ballot.right].sort(), [...aliases].sort());
  }
});

