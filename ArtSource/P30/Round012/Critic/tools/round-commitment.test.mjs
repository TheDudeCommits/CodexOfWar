import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  EVALUATOR_HELPER_PATH,
  TREE_HELPER_PATH,
  validateRoundCommitment,
  verifyRoundCommitmentFiles
} from './evaluator-helper.mjs';
import { fileSha256, readCanonicalFile } from './tree-helper.mjs';

const toolsDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(toolsDirectory, '../../../../..');
const commitmentPath = resolve(repositoryRoot, 'ArtSource/P30/Round012/Critic/ROUND_COMMITMENT.json');

test('committed public artifact verifies exact protocol, amendment, baseline, and frozen helper bytes', async () => {
  const verification = await verifyRoundCommitmentFiles(repositoryRoot, commitmentPath);
  assert.deepEqual(verification, {
    schema: 'p30.r012a.round-commitment-verification.v1',
    protocolID: 'P30-R012A-BLIND-v1',
    roundCommitmentSha256: '24728a6bd4e6543d3b24c5e4d026692437cb9f1e44eff58d52ad7eaa3441a17e',
    protocolVerified: true,
    amendmentVerified: true,
    baselineReceiptVerified: true,
    helperBytesVerified: true,
    criticCandidateAccess: false
  });
});

test('public artifact has no secret-bearing or candidate-identity fields', async () => {
  const record = await readCanonicalFile(commitmentPath);
  validateRoundCommitment(record.value, record.source);
  const keys = Object.keys(record.value);
  assert.equal(keys.some((key) => /(?:Seed|Salt|Selection|Crop|Phase|Alias|Builder|Branch|CommitSha)/u.test(key)), false);
  assert.equal(record.source.includes('candidate-'), false);
  assert.equal(record.source.includes('/Users/'), false);
  assert.equal(record.source.includes('/private/tmp/'), false);
  assert.equal(record.value.criticCandidateAccess, false);
});

test('public helper identities are byte hashes, not mutable path assertions', async () => {
  const commitment = (await readCanonicalFile(commitmentPath)).value;
  assert.equal((await fileSha256(resolve(repositoryRoot, TREE_HELPER_PATH))).sha256, commitment.treeHelperSha256);
  assert.equal((await fileSha256(resolve(repositoryRoot, EVALUATOR_HELPER_PATH))).sha256, commitment.evaluatorHelperSha256);
});
