import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  EVALUATOR_HELPER_PATH,
  PROTOCOL_RECOMMITMENT_HELPER_PATH,
  ROUND_COMMITMENT_SCHEMA,
  TREE_HELPER_PATH,
  validateRoundCommitment,
  verifyRoundCommitmentFiles
} from './evaluator-helper.mjs';
import { canonicalBytes, fileSha256, readCanonicalFile, sha256Hex } from './tree-helper.mjs';

const toolsDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(toolsDirectory, '../../../../..');
const commitmentPath = resolve(repositoryRoot, 'ArtSource/P30/Round012/Critic/ROUND_COMMITMENT.json');

test('committed public artifact verifies exact protocol, amendment, baseline, and frozen helper bytes', async () => {
  const verification = await verifyRoundCommitmentFiles(repositoryRoot, commitmentPath);
  assert.deepEqual(verification, {
    schema: 'p30.r012a.round-commitment-verification.v1',
    protocolID: 'P30-R012A-BLIND-v1',
    roundCommitmentSha256: '196566d0387d2aeec9993fbbbc62cbea1208fe8f86cd17bfd760128c873e1af1',
    protocolVerified: true,
    amendmentVerified: true,
    amendment02Verified: true,
    recommitmentReceiptVerified: true,
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
  assert.equal(
    (await fileSha256(resolve(repositoryRoot, PROTOCOL_RECOMMITMENT_HELPER_PATH))).sha256,
    commitment.protocolRecommitmentHelperSha256
  );
});

test('v2 recommitment preserves every sealed private commitment byte-for-byte', async () => {
  const commitment = (await readCanonicalFile(commitmentPath)).value;
  const frozenPrivateCommitments = {
    counterfactualCommit: '36f451aa96391cb618cd220715a72722896ee8045e72f26b9abb216700443649',
    presentationCommit: '19e959900edd7c41803201078f7d98dd68199b75dafcb75d1859cec0a396d1b8',
    referenceArchiveSha256: '4653a7a92d6f6bde910f39d3190df0adb112677851815443144505b8b420a6dd',
    referenceCommit: 'f2fb7ddeaaf32447f1cd2c1167cb058fd47524a86807c67e4f01d900a8a157fc'
  };
  assert.equal(commitment.schema, ROUND_COMMITMENT_SCHEMA);
  for (const [key, expected] of Object.entries(frozenPrivateCommitments)) {
    assert.equal(commitment[key], expected);
  }
  assert.equal(
    sha256Hex(canonicalBytes(frozenPrivateCommitments)),
    '81f0aa3c25ce99b737001a240a35518045259a441963f9d1cb7187815060b667'
  );
});
