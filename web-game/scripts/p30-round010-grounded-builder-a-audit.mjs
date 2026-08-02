#!/usr/bin/env node

/* global Buffer, console, process */

import { createHash } from "node:crypto";
import { execFile as execFileCallback } from "node:child_process";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const BASE_COMMIT = "ed9cc22717cac6c7c1933e85fa01d1808a38137d";
const BRANCH = "codex/p30-r010-grounded-builder";
const REPO_ROOT = resolve(process.cwd(), "..");
const OUTPUT_ROOT = resolve(
  process.env.ROUND010_GROUNDED_OUTPUT_ROOT ?? "../ArtSource/P30/Round010/BuilderA",
);
const BASE_URL =
  process.env.ROUND010_GROUNDED_URL ??
  "http://127.0.0.1:4173/?review=1&post=0&framing=1";

process.env.ROUND009_POSE_OUTPUT_ROOT = OUTPUT_ROOT;
process.env.ROUND009_POSE_URL = BASE_URL;
process.env.ROUND009_POSE_STABILITY_MS =
  process.env.ROUND010_GROUNDED_STABILITY_MS ?? "30000";

await mkdir(OUTPUT_ROOT, { recursive: true });
await import("./p30-round009-pose-builder-b-audit.mjs");

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const readJson = async (name) =>
  JSON.parse(await readFile(resolve(OUTPUT_ROOT, name), "utf8"));
const writeJson = async (name, value) =>
  writeFile(resolve(OUTPUT_ROOT, name), `${JSON.stringify(value, null, 2)}\n`);
const distance = (a, b) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

const receipt = await readJson("capture-receipt.json");
const poseTelemetry = await readJson("pose-telemetry.json");
const runtimeTelemetry = await readJson("runtime-telemetry.json");
const byId = Object.fromEntries(receipt.captures.map((capture) => [capture.id, capture]));
const startup = byId.S03;
const impact = byId.S04;
const recovery = byId.S05;
const focused = [byId["F29-startup"], byId["F34-impact"], byId["F41-recovery"]];
const impactBlade = impact.pose.hero.anchors.bladeContactWorld;
const impactTip = impact.pose.hero.anchors.bladeTipWorld;
const impactTarget = impact.pose.target.anchors.impactWorld;
const recoveryBlade = recovery.pose.hero.anchors.bladeContactWorld;
const recoveryTarget = recovery.pose.target.anchors.impactWorld;
const leadFoot = recovery.pose.hero.anchors.leadFootWorld;
const supportFoot = recovery.pose.hero.anchors.supportFootWorld;

const groundedGates = {
  exactFrozenMechanics:
    startup.state.player.attackFrame === 5 &&
    impact.state.player.attackFrame === 10 &&
    recovery.state.player.attackFrame === 17 &&
    impact.events.some(
      (event) =>
        event.tick === 33 &&
        event.type === "enemy_hit" &&
        event.damage === 10 &&
        event.hpBefore === 100 &&
        event.hpAfter === 90,
    ),
  exteriorContact:
    impactTarget[0] - impactTip[0] > 0.45 &&
    impact.pose.target.sample.model.position[0] <= -0.8 &&
    distance(impactBlade, impact.fx.contact.contactWorld) < 0.27,
  edgePresentedAtContact:
    impact.pose.hero.weaponAxialRollRadians > 3.3 &&
    impact.pose.hero.sample.weaponAxialRollOffset > 2.5,
  sameDirectionLowOvershoot:
    impactBlade[0] - startup.pose.hero.anchors.bladeContactWorld[0] > 2.4 &&
    recoveryBlade[0] - impactBlade[0] > 0.4 &&
    recoveryBlade[1] < 1.2,
  authoredOverheadGuardBypassed:
    recovery.pose.hero.authoredTiming.mode === "contact-to-settle-blend" &&
    recovery.pose.hero.authoredTiming.blend01 === 0.291212,
  groundedFootBrake:
    Math.abs(leadFoot[0] - supportFoot[0]) > 0.8 &&
    leadFoot[1] < 0.11 &&
    supportFoot[1] < 0.06,
  targetRecoilContinuesFromContact:
    recoveryTarget[0] - impactTarget[0] > 0.4 &&
    recovery.pose.target.sample.model.position[2] >
      impact.pose.target.sample.model.position[2],
  twoHandConstraint:
    [startup, impact, recovery].every(
      (capture) =>
        capture.pose.hero.weaponParent === "weapon_socket" &&
        capture.pose.hero.supportHandToSecondaryGripMeters <= 0.00001,
    ),
  focusedSafeFraming:
    [startup, impact, recovery, ...focused].every(
      (capture) => capture.framing.gates.actorsAndBladeInside80,
    ),
  round008FxLifecyclePreserved:
    startup.fx.blade.phase === "absent" &&
    startup.fx.contact.phase === "absent" &&
    impact.fx.blade.phase === "peak" &&
    impact.fx.contact.phase === "peak" &&
    recovery.fx.blade.phase === "absent" &&
    recovery.fx.contact.phase === "dissipated" &&
    !recovery.fx.contact.active,
  coldReplayByteIdentical: poseTelemetry.replay.byteIdentical,
  repeatedRenderByteIdentical: poseTelemetry.renderIdempotence.every(
    (sample) => sample.byteIdentical,
  ),
  focusedWorldPoseCameraIdentical:
    receipt.gates.focusedWorldPoseCameraByteIdentical,
  actualHeadedCaptures1600x900Dpr1:
    receipt.captures.length === 9 &&
    receipt.captures.every(
      (capture) => capture.png.width === 1600 && capture.png.height === 900,
    ) &&
    runtimeTelemetry.freshActualGameRun.devicePixelRatio === 1,
  thirtySecondStable: runtimeTelemetry.gates.thirtySecondStable,
  contextLossRestore: runtimeTelemetry.gates.contextLossRestore,
  authoredAssetsNoFallback: runtimeTelemetry.gates.authoredAssets18Of18NoFallback,
  runtimeErrorsZero: runtimeTelemetry.gates.runtimeErrorsZero,
  resourceCaps: runtimeTelemetry.gates.resourceCaps,
};

poseTelemetry.schema = "p30.round010.builder-a.grounded-pose-telemetry.v1";
poseTelemetry.baseCommit = BASE_COMMIT;
poseTelemetry.gates = groundedGates;
runtimeTelemetry.schema = "p30.round010.builder-a.runtime-telemetry.v1";
runtimeTelemetry.baseCommit = BASE_COMMIT;
receipt.schema = "p30.round010.builder-a.capture-receipt.v1";
receipt.baseCommit = BASE_COMMIT;
receipt.branch = BRANCH;
receipt.runtimeTelemetryFile = "ArtSource/P30/Round010/BuilderA/runtime-telemetry.json";
receipt.poseTelemetryFile = "ArtSource/P30/Round010/BuilderA/pose-telemetry.json";
receipt.gates = groundedGates;

await writeJson("pose-telemetry.json", poseTelemetry);
await writeJson("runtime-telemetry.json", runtimeTelemetry);
await writeJson("capture-receipt.json", receipt);

async function git(args) {
  const result = await execFile("git", args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return result.stdout;
}

const authorizedProduction = new Set([
  "web-game/src/render/objects/CharacterViews.ts",
  "web-game/src/render/objects/CombatPoseBeat.ts",
]);
const baselineTree = await git([
  "ls-tree",
  "-r",
  BASE_COMMIT,
  "--",
  "web-game/src",
  "web-game/public",
  "web-game/index.html",
  "web-game/package.json",
  "web-game/package-lock.json",
  "web-game/tsconfig.json",
  "web-game/vite.config.ts",
]);
const baselineEntries = baselineTree
  .trim()
  .split("\n")
  .filter(Boolean)
  .map((line) => {
    const match = /^(\d+)\s+(\w+)\s+([0-9a-f]+)\t(.+)$/.exec(line);
    if (!match) throw new Error(`Unparseable ls-tree line: ${line}`);
    return { mode: match[1], type: match[2], baselineBlob: match[3], path: match[4] };
  });
const mismatches = [];
for (const entry of baselineEntries) {
  if (authorizedProduction.has(entry.path)) continue;
  const currentBlob = (await git(["hash-object", "--", entry.path])).trim();
  if (currentBlob !== entry.baselineBlob) {
    mismatches.push({ path: entry.path, baselineBlob: entry.baselineBlob, currentBlob });
  }
}
const productionUntracked = (await git(["ls-files", "--others", "--exclude-standard"]))
  .trim()
  .split("\n")
  .filter(
    (path) =>
      path.startsWith("web-game/src/") ||
      path.startsWith("web-game/public/") ||
      [
        "web-game/index.html",
        "web-game/package.json",
        "web-game/package-lock.json",
        "web-game/tsconfig.json",
        "web-game/vite.config.ts",
      ].includes(path),
  );
const freezeAudit = {
  schema: "p30.round010.builder-a.source-freeze-audit.v1",
  baseCommit: BASE_COMMIT,
  authorizedProduction: [...authorizedProduction].sort().map((path) => ({
    path,
    currentBlob: null,
  })),
  authorizedTests: [
    "web-game/tests/browser/pose.spec.ts",
    "web-game/tests/pose/CombatPoseBeat.test.ts",
  ],
  authorizedEvidenceTooling: [
    "web-game/scripts/p30-round010-grounded-builder-a-audit.mjs",
  ],
  checkedUnrelatedProductionFiles: baselineEntries.length - authorizedProduction.size,
  unrelatedProductionMismatches: mismatches,
  unauthorizedNewProductionFiles: productionUntracked,
  gates: {
    exactBaseline: (await git(["rev-parse", `${BASE_COMMIT}^{commit}`])).trim() === BASE_COMMIT,
    unrelatedProductionByteExact: mismatches.length === 0,
    noUnauthorizedNewProductionFiles: productionUntracked.length === 0,
  },
};
for (const entry of freezeAudit.authorizedProduction) {
  entry.currentBlob = (await git(["hash-object", "--", entry.path])).trim();
}
freezeAudit.passed = Object.values(freezeAudit.gates).every(Boolean);
await writeJson("freeze-audit.json", freezeAudit);

const validation = {
  schema: "p30.round010.builder-a.validation.v1",
  baseCommit: BASE_COMMIT,
  branch: BRANCH,
  candidateOnly: true,
  acceptanceClaimed: false,
  gates: groundedGates,
  passed:
    Object.values(groundedGates).every(Boolean) &&
    freezeAudit.passed,
  stability: runtimeTelemetry.stability,
  contextLossRestore: runtimeTelemetry.contextLossRestore,
  captureHashes: Object.fromEntries(
    receipt.captures.map((capture) => [capture.id, capture.sha256]),
  ),
};
await writeJson("validation.json", validation);

await writeFile(
  resolve(OUTPUT_ROOT, "SELF_CRITIQUE.md"),
  `# Round010 Builder A — Candidate self-critique\n\n` +
    `This is candidate-only evidence and does not claim acceptance.\n\n` +
    `The impact now places the Hollow beyond the blade tip, rolls the unchanged blade/FX stack around its authored axis, and starts target displacement on the hit tick. Recovery bypasses the authored overhead guard by blending directly from the contact pose to the settled endpoint, while the additive pelvis/spine chain carries the blade farther in the original lateral direction. Both feet remain low and widely opposed, and the target continues away from contact.\n\n` +
    `The biggest remaining visual weakness is the intentionally large visual-only lateral target displacement required to clear the oversized authored claymore silhouette; the pose reads cleanly at the frozen ticks, but the Hollow's first recoil step is broader than a subtler asset-level contact revision would need.\n`,
);

const names = (await readdir(OUTPUT_ROOT)).sort();
const files = [];
const forbiddenPrivatePathHits = [];
const referenceOriginalFiles = [];
for (const name of names) {
  if (name === "evidence-index.json") continue;
  const path = resolve(OUTPUT_ROOT, name);
  const info = await stat(path);
  if (!info.isFile()) continue;
  const bytes = await readFile(path);
  const repoPath = relative(REPO_ROOT, path);
  files.push({ path: repoPath, bytes: bytes.length, sha256: sha256(bytes) });
  if (/\.(?:json|md|txt)$/i.test(name)) {
    const value = bytes.toString("utf8");
    for (const pattern of ["/private/tmp", "/Users/", "Reference.zip"]) {
      if (value.includes(pattern)) forbiddenPrivatePathHits.push({ path: repoPath, pattern });
    }
  }
  if (/reference|original/i.test(name)) referenceOriginalFiles.push(repoPath);
}
const evidenceIndex = {
  schema: "p30.round010.builder-a.evidence-index.v1",
  baseCommit: BASE_COMMIT,
  candidateOnly: true,
  acceptanceClaimed: false,
  files,
  aggregateSha256: sha256(Buffer.from(JSON.stringify(files))),
  gates: {
    expectedNinePngs: files.filter((file) => file.path.endsWith(".png")).length === 9,
    noPrivatePaths: forbiddenPrivatePathHits.length === 0,
    noReferenceOriginals: referenceOriginalFiles.length === 0,
    receiptPresent: files.some((file) => file.path.endsWith("/capture-receipt.json")),
    freezeAuditPresent: files.some((file) => file.path.endsWith("/freeze-audit.json")),
    validationPresent: files.some((file) => file.path.endsWith("/validation.json")),
    selfCritiquePresent: files.some((file) => file.path.endsWith("/SELF_CRITIQUE.md")),
  },
  forbiddenPrivatePathHits,
  referenceOriginalFiles,
};
evidenceIndex.passed = Object.values(evidenceIndex.gates).every(Boolean);
await writeJson("evidence-index.json", evidenceIndex);

const failedGates = Object.entries(groundedGates)
  .filter(([, passed]) => !passed)
  .map(([gate]) => gate);
console.log(
  JSON.stringify(
    {
      output: relative(REPO_ROOT, OUTPUT_ROOT),
      captureHashes: validation.captureHashes,
      failedGates,
      freezeAuditPassed: freezeAudit.passed,
      evidenceIndexPassed: evidenceIndex.passed,
    },
    null,
    2,
  ),
);
process.exitCode =
  failedGates.length === 0 && freezeAudit.passed && evidenceIndex.passed ? 0 : 1;
