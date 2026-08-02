import assert from 'node:assert/strict';
import { chmod, link, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  BaselineCustodyError,
  TREE_DOMAIN,
  canonicalize,
  hashTree,
  registerCaseFoldedPath,
  validateCompleteTickSeries,
  validateDeclaredCounts,
  validateVerdictBinding
} from './baseline-core.mjs';

async function fixture() {
  return mkdtemp(join(tmpdir(), 'p30-r012-baseline-core-'));
}

async function rejectsCode(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof BaselineCustodyError);
    assert.equal(error.code, code);
    return true;
  });
}

test('BCJ canonicalization sorts raw UTF-8 keys and rejects non-integers', () => {
  assert.equal(canonicalize({ z: 2, a: [true, null, 'NFC'] }), '{"a":[true,null,"NFC"],"z":2}');
  assert.throws(() => canonicalize({ value: 0.5 }), /BCJ_INVALID_NUMBER/u);
  assert.throws(() => canonicalize({ value: -0 }), /BCJ_INVALID_NUMBER/u);
});

test('tree digest is stable, mode-sensitive, and uses the locked domain', async (t) => {
  const root = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'nested'));
  await writeFile(join(root, 'a.txt'), 'alpha');
  await writeFile(join(root, 'nested', 'b.txt'), 'beta');
  const first = await hashTree(root);
  const second = await hashTree(root);
  assert.equal(first.domain, TREE_DOMAIN);
  assert.equal(first.treeSha256, second.treeSha256);
  assert.equal(first.fileCount, 2);
  await chmod(join(root, 'a.txt'), 0o755);
  const changed = await hashTree(root);
  assert.notEqual(changed.treeSha256, first.treeSha256);
});

test('tree digest rejects symlinks', async (t) => {
  const root = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'target'), 'bytes');
  await symlink('target', join(root, 'alias'));
  await rejectsCode(hashTree(root), 'TREE_SYMLINK_FORBIDDEN');
});

test('tree digest rejects hard-link aliases', async (t) => {
  const root = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'first'), 'bytes');
  await link(join(root, 'first'), join(root, 'second'));
  await rejectsCode(hashTree(root), 'TREE_HARDLINK_ALIAS_FORBIDDEN');
});

test('tree path registry rejects case collisions on every host filesystem', () => {
  const paths = new Map();
  registerCaseFoldedPath(paths, 'Nested/Case');
  assert.throws(
    () => registerCaseFoldedPath(paths, 'nested/case'),
    (error) => error instanceof BaselineCustodyError && error.code === 'TREE_CASE_COLLISION'
  );
});

function semanticFixture() {
  const receipt = {
    round011FinalVerdict: {
      schema: 'p30.r011.final-verdict.v1',
      roundVerdict: 'NO ACCEPTED CANDIDATE',
      roundVoid: false
    },
    selectedCheckpoint: {
      sourceVerdictJsonPath: '$.selectedStrongerRejectedCheckpoint',
      alias: 'candidate-9442539eea8abc4c',
      sourceCommit: 'ed207126794c9d637cbffe101816561deaeda57f',
      status: 'rejected'
    }
  };
  const verdict = {
    schema: 'p30.r011.final-verdict.v1',
    roundVerdict: 'NO ACCEPTED CANDIDATE',
    roundVoid: false,
    candidates: [{
      alias: 'candidate-9442539eea8abc4c',
      commit: 'ed207126794c9d637cbffe101816561deaeda57f',
      finalAcceptance: false
    }],
    selectedStrongerRejectedCheckpoint: {
      alias: 'candidate-9442539eea8abc4c',
      commit: 'ed207126794c9d637cbffe101816561deaeda57f'
    }
  };
  return { receipt, verdict };
}

test('verdict binding rejects a receipt redirected to another real-looking commit', () => {
  const { receipt, verdict } = semanticFixture();
  validateVerdictBinding(receipt, verdict);
  receipt.selectedCheckpoint.sourceCommit = '1111111111111111111111111111111111111111';
  assert.throws(
    () => validateVerdictBinding(receipt, verdict),
    (error) => error instanceof BaselineCustodyError && error.code === 'VERDICT_SELECTED_IDENTITY_MISMATCH'
  );
});

test('golden trace completeness rejects missing and duplicate camera ticks', () => {
  const trace = {
    declaredAbsoluteTicks: [0, 1, 2],
    stateDigests: [0, 1, 2].map((absoluteSimulationTick) => ({
      absoluteSimulationTick,
      sha256: '1'.repeat(64)
    })),
    cameraDigests: [0, 1, 2].map((absoluteSimulationTick) => ({
      absoluteSimulationTick,
      sha256: '2'.repeat(64)
    }))
  };
  validateCompleteTickSeries(trace, 0, 2);

  const missing = structuredClone(trace);
  missing.cameraDigests.pop();
  assert.throws(
    () => validateCompleteTickSeries(missing, 0, 2),
    (error) => error instanceof BaselineCustodyError &&
      error.code === 'GOLDEN_TRACE_TICK_SERIES_COUNT_MISMATCH'
  );

  const duplicate = structuredClone(trace);
  duplicate.cameraDigests[2].absoluteSimulationTick = 1;
  assert.throws(
    () => validateCompleteTickSeries(duplicate, 0, 2),
    (error) => error instanceof BaselineCustodyError &&
      error.code === 'GOLDEN_TRACE_TICK_SERIES_MISSING_DUPLICATE_OR_INVALID'
  );
});

test('declared count validation rejects custody metadata tampering', () => {
  const ticks = Array.from({ length: 81 }, (_, index) => index);
  const trace = {
    declaredAbsoluteTicks: ticks,
    stateDigests: ticks.map((absoluteSimulationTick) => ({
      absoluteSimulationTick,
      sha256: '1'.repeat(64)
    })),
    cameraDigests: ticks.map((absoluteSimulationTick) => ({
      absoluteSimulationTick,
      sha256: '2'.repeat(64)
    })),
    focusedSnapshots: [{ absoluteSimulationTick: 0, targetHealth: 100 }],
    eventLog: []
  };
  const receipt = {
    custody: {
      materializedSourceFileCount: 1,
      materializedSourceBytes: 5,
      packageFileCount: 1,
      packageBytes: 5,
      productionOutputFileCount: 1,
      productionOutputBytes: 7,
      materializedLfsFileCount: 0,
      materializedLfsBytes: 0
    },
    baselineEvidence: {
      artifactCount: 2,
      productionFrameCount: 0,
      goldenTraceCount: 2,
      evaluatorToolCount: 1
    },
    goldenTraces: {
      neutral: {
        declaredStateTickCount: 81,
        declaredStateTickFirst: 0,
        declaredStateTickLast: 80,
        declaredCameraTickCount: 81,
        captureTicks: [0],
        healthStart: 100,
        healthEnd: 100,
        damageEventCount: 0
      },
      lightStrike: {
        declaredStateTickCount: 81,
        declaredStateTickFirst: 0,
        declaredStateTickLast: 80,
        declaredCameraTickCount: 81,
        captureTicks: [0],
        healthStart: 100,
        healthEnd: 100,
        damageEventCount: 0
      }
    }
  };
  const evidence = {
    sourceTree: { fileCount: 1, totalBytes: 5 },
    outputTree: { fileCount: 1, totalBytes: 7 },
    materializedGit: { lfsFileCount: 0, lfsBytes: 0 },
    manifest: {
      artifacts: [
        { kind: 'golden-trace' },
        { kind: 'golden-trace' }
      ],
      evaluatorTools: [{}]
    },
    neutralTrace: trace,
    lightTrace: trace
  };
  validateDeclaredCounts(receipt, evidence);
  receipt.custody.productionOutputFileCount = 2;
  assert.throws(
    () => validateDeclaredCounts(receipt, evidence),
    (error) => error instanceof BaselineCustodyError && error.code === 'CUSTODY_DECLARED_COUNT_OR_BYTES_MISMATCH'
  );
});
