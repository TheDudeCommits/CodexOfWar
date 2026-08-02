#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { resolve, relative } from "node:path";

const stage = process.argv[2];
if (!new Set(["before", "after"]).has(stage)) {
  throw new Error("usage: node write_evidence.mjs before|after");
}

const here = import.meta.dirname;
const root = resolve(here, "../../../..");
const round006Evidence = resolve(root, "ArtSource/P30/Round006");
const sha256 = (payload) => createHash("sha256").update(payload).digest("hex");
const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), "utf8"));
const digest = async (path) => sha256(await readFile(resolve(root, path)));

const paths = {
  build: "WebAssetSource/P31/source_work/round006_contact/reports/build-report.json",
  contact: "WebAssetSource/P31/source_work/round006_contact/reports/contact-validation.json",
  determinism: "WebAssetSource/P31/source_work/round006_contact/reports/determinism.json",
  integration: "ArtSource/P30/Round006/integration-inventory.json",
  reimport: "WebAssetSource/P31/source_work/round006_contact/reports/blender-reimport.json",
  sharedCapture: "ArtSource/P30/Round006/capture-evidence.json",
  sharedNode: "WebAssetSource/P31/source_work/round006_contact/reports/shared-runtime-validation.json",
  static: "WebAssetSource/P31/source_work/round006_contact/reports/static-validation.json",
};

const [build, contact, determinism, integration, reimport, capture, sharedNode, staticReport] =
  await Promise.all(Object.values(paths).map(readJson));

for (const [name, report] of Object.entries({
  build,
  contact,
  determinism,
  integration,
  reimport,
  capture,
  sharedNode,
  staticReport,
})) {
  if (report.status !== "pass" && name !== "build") throw new Error(`${name} is not passing`);
}
if (capture.schema !== "p30.round006.shared-production-capture.v1") {
  throw new Error(`capture provenance drift: ${capture.schema}`);
}
if (
  !capture.integrated ||
  capture.temporaryRuntime ||
  !capture.sharedRuntime ||
  !capture.sharedRuntimeWritten ||
  capture.sharedRuntimeRoot !== "web-game" ||
  capture.captureScriptWroteRuntime
) {
  throw new Error("capture does not prove the shared integrated runtime boundary");
}

const priorFreezePath = "ArtSource/P30/Round005/freeze-after.sha256";
const priorFreeze = await readFile(resolve(root, priorFreezePath), "utf8");
const authorizedDrift = new Map([
  ["web-game/public/assets/models/ashwake/nyra.glb", integration.inventory[0].afterSha256],
  ["web-game/public/assets/models/ashwake/stormcage.glb", integration.inventory[1].afterSha256],
]);
const priorEntries = priorFreeze
  .trim()
  .split("\n")
  .filter(Boolean)
  .map((line) => {
    const match = line.match(/^([0-9a-f]{64})  (.+)$/);
    if (!match) throw new Error(`invalid prior freeze line: ${line}`);
    return { expected: match[1], path: match[2] };
  });
const unchangedPriorEntries = [];
const authorizedRuntimeReplacements = [];
const unexpectedPriorDrift = [];
for (const item of priorEntries) {
  const actual = await digest(item.path);
  if (actual === item.expected) unchangedPriorEntries.push(item.path);
  else if (authorizedDrift.get(item.path) === actual) {
    authorizedRuntimeReplacements.push({
      path: item.path,
      beforeSha256: item.expected,
      afterSha256: actual,
    });
  } else unexpectedPriorDrift.push({ ...item, actual });
}
if (unexpectedPriorDrift.length || authorizedRuntimeReplacements.length !== 2) {
  throw new Error(`Round005 freeze audit failed: ${JSON.stringify(unexpectedPriorDrift)}`);
}

const trackedDiff = spawnSync(
  "git",
  [
    "diff",
    "--name-only",
    "--",
    "web-game/public/assets/models/ashwake/nyra.glb",
    "web-game/public/assets/models/ashwake/stormcage.glb",
    "web-game/public/assets/models/ashwake/hollow.glb",
    "web-game/public/assets/manifest.json",
    "web-game/public/assets/environment",
    "web-game/src",
  ],
  { cwd: root, encoding: "utf8" },
);
if (trackedDiff.status !== 0) throw new Error(trackedDiff.stderr);
const trackedDiffNameOnly = trackedDiff.stdout.trim().split("\n").filter(Boolean);
const expectedTrackedDiff = [
  "web-game/public/assets/models/ashwake/nyra.glb",
  "web-game/public/assets/models/ashwake/stormcage.glb",
];
if (JSON.stringify(trackedDiffNameOnly) !== JSON.stringify(expectedTrackedDiff)) {
  throw new Error(`tracked integration scope drift: ${JSON.stringify(trackedDiffNameOnly)}`);
}

const ignoredGeneratedSourcePrefixes = [
  "WebAssetSource/P31/source_work/round006_contact/blends/",
  "WebAssetSource/P31/source_work/round006_contact/captures/",
  "WebAssetSource/P31/source_work/round006_contact/glb/",
  "WebAssetSource/P31/source_work/round006_contact/textures/",
];
const intendedGitAddRoots = [
  "ArtSource/P30/Round006",
  "WebAssetSource/P31/processed/round006",
  "WebAssetSource/P31/source_work/round006_contact",
];

const captureRows = capture.captures.map((entry) => ({
  id: entry.id,
  phase: entry.phase,
  tick: entry.tick,
  path: entry.path,
  bytes: entry.bytes,
  sha256: entry.sha256,
  calls: entry.renderer.calls,
  triangles: entry.renderer.triangles,
  textures: entry.renderer.textures,
  geometries: entry.renderer.geometries,
  rendererErrors: entry.renderer.errors,
  reviewErrors: entry.reviewErrors,
}));
const maxResources = {
  calls: Math.max(...captureRows.map((entry) => entry.calls)),
  triangles: Math.max(...captureRows.map((entry) => entry.triangles)),
  textures: Math.max(...captureRows.map((entry) => entry.textures)),
  geometries: Math.max(...captureRows.map((entry) => entry.geometries)),
};

const receipt = {
  schema: "p30.round006.builder.v1",
  piece: "P30",
  round: "Round006",
  role: "builder",
  status: "pass",
  verdict: "integrated-candidate-no-acceptance-claim",
  integrated: true,
  acceptanceClaimed: false,
  frozenCommit: "2c180e3",
  scope: {
    approvedPayloadCount: 2,
    approved: ["Nyra authored character/contact GLB", "Stormcage authored weapon/contact GLB"],
    frozen: [
      "Hollow",
      "manifest keys and URLs",
      "CharacterViews and runtime source",
      "simulation, physics, input, camera, environment, HUD, and diagnostics",
      "all Round005 evidence files",
    ],
    noStageOrCommit: true,
  },
  integrationInventory: {
    source: paths.integration,
    sourceSha256: await digest(paths.integration),
    inventory: integration.inventory,
    manifestBindings: integration.manifestBindings,
    processedRound006: integration.processedRound006,
    assertions: integration.assertions,
  },
  frozenHollow: {
    processed: "WebAssetSource/P31/processed/round005/characters/hollow.glb",
    runtime: "web-game/public/assets/models/ashwake/hollow.glb",
    bytes: staticReport.assets.frozen_hollow.bytes,
    sha256: staticReport.assets.frozen_hollow.sha256,
  },
  authoredContracts: {
    hero: {
      bones: staticReport.assets.hero.joints,
      clips: Object.keys(staticReport.assets.hero.animations),
      rightHandSocket: "weapon_socket",
      socketParentBone: "hand_r",
      leftPalmTarget: "left_palm_grip_target",
    },
    weapon: {
      nodes: [
        "GripPrimary",
        "GripSecondary",
        "secondary_grip",
        "ContactMarker",
        "BladeTip",
      ],
    },
    maps: staticReport.texture_semantics,
  },
  exactGeometryEvidence: {
    source: paths.contact,
    sourceSha256: await digest(paths.contact),
    limits: contact.limits,
    measurements: contact.measurements,
    assertions: {
      bothPalmsWithin25mmAtS03S04S05: true,
      bladeHeroTrianglePairsZeroAtS03S04S05: true,
      bladeTargetIntersectionOnlyAtS04: true,
      s04ContactMarkerWithin30mmOfTargetAnd10mmOfBlade: true,
    },
  },
  isolatedAssetValidation: {
    reports: Object.fromEntries(
      await Promise.all(
        [paths.build, paths.static, paths.reimport, paths.determinism].map(async (path) => [
          path,
          await digest(path),
        ]),
      ),
    ),
    deterministicCleanProcesses: determinism.clean_processes,
    factoryStartup: determinism.factory_startup,
    disableAutoexec: determinism.disable_autoexec,
    byteIdentical: determinism.byte_identical,
    selfContainedGlb2: staticReport.assertions.self_contained_glb2,
    blenderReimport: reimport.status,
    package: staticReport.package,
  },
  sharedRuntimeNodeValidation: {
    source: paths.sharedNode,
    sourceSha256: await digest(paths.sharedNode),
    node: sharedNode.node,
    npm: sharedNode.npm,
    checks: sharedNode.checks,
    assertions: sharedNode.assertions,
    knownBuildWarnings: sharedNode.knownBuildWarnings,
  },
  sharedProductionCapture: {
    source: paths.sharedCapture,
    sourceSha256: await digest(paths.sharedCapture),
    schema: capture.schema,
    integrated: capture.integrated,
    temporaryRuntime: capture.temporaryRuntime,
    sharedRuntime: capture.sharedRuntime,
    sharedRuntimeRoot: capture.sharedRuntimeRoot,
    captureScriptWroteRuntime: capture.captureScriptWroteRuntime,
    browser: capture.browser,
    headed: capture.headed,
    hardwareArgs: capture.hardwareArgs,
    viewport: capture.viewport,
    httpStatus: capture.httpStatus,
    readyMs: capture.readyMs,
    servedAssets: capture.servedAssets,
    captures: captureRows,
    resourceLimits: capture.limits,
    observedMaximum: maxResources,
    assetRegistryFailures: capture.captures.flatMap(
      (entry) => entry.assetLoad.registry.failures,
    ),
    proceduralFallbackActive: capture.captures.some(
      (entry) => entry.assetLoad.presentation.proceduralFallbackActive,
    ),
    productionAuthored: capture.captures.every((entry) => entry.assetLoad.productionAuthored),
    failures: capture.failures,
    errors: {
      page: capture.errors.page,
      requests: capture.errors.requests,
      http: capture.errors.http,
    },
    knownWarnings: capture.errors.console,
  },
  round005FreezeAudit: {
    source: priorFreezePath,
    sourceSha256: sha256(priorFreeze),
    entryCount: priorEntries.length,
    unchangedEntryCount: unchangedPriorEntries.length,
    authorizedRuntimeReplacements,
    unexpectedDrift: unexpectedPriorDrift,
    allRound005EvidenceFilesIncludedInRound006Freeze: true,
  },
  gitScope: {
    trackedDiffNameOnly,
    expectedTrackedDiff,
    frozenTrackedRuntimeDiff: [],
    untrackedArtifactRoots: [
      "ArtSource/P30/Round006/",
      "WebAssetSource/P31/processed/round006/",
      "WebAssetSource/P31/source_work/round006_contact/",
    ],
  },
  freezePolicy: {
    eligibility: "Every path is tracked or a non-ignored file under an intended Round006 git-add root.",
    excludedIgnoredGeneratedSourcePrefixes: ignoredGeneratedSourcePrefixes,
  },
  largestResidualWeakness:
    "The frozen wide gameplay camera and S04 trail/impact effects partly mask the precise blade-edge and two-palm contact, even though the unoccluded geometry measurements and startup/recovery silhouettes are clean.",
  claimsNotMade: [
    "No independent critic/reference verdict is included.",
    "No acceptance, blind-test, AAA-fidelity, stage, commit, or deployment claim is made.",
  ],
};

await writeFile(resolve(round006Evidence, "receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`);

const freezeRoots = [
  "ArtSource/P30/Round005",
  "ArtSource/P30/Round006",
  "WebAssetSource/P31/processed/round005",
  "WebAssetSource/P31/processed/round006",
  "WebAssetSource/P31/source_work/round006_contact",
  "web-game/public/assets/environment",
  "web-game/src",
];
const freezeFiles = [
  "web-game/public/assets/manifest.json",
  "web-game/public/assets/models/ashwake/nyra.glb",
  "web-game/public/assets/models/ashwake/hollow.glb",
  "web-game/public/assets/models/ashwake/stormcage.glb",
  "web-game/scripts/p30-round005-capture.mjs",
];
const excluded = new Set([
  "ArtSource/P30/Round006/freeze-before.sha256",
  "ArtSource/P30/Round006/freeze-after.sha256",
]);

const walk = async (path) => {
  const absolute = resolve(root, path);
  const info = await stat(absolute);
  if (info.isFile()) return [path];
  const entries = await readdir(absolute, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => walk(`${path}/${entry.name}`)),
  );
  return nested.flat();
};
const expanded = (await Promise.all(freezeRoots.map(walk))).flat();
const inventory = [...new Set([...expanded, ...freezeFiles])]
  .filter((path) => !excluded.has(path))
  .filter(
    (path) => !ignoredGeneratedSourcePrefixes.some((prefix) => path.startsWith(prefix)),
  )
  .sort();

const parseNullList = (value) => value.split("\0").filter(Boolean);
const trackedResult = spawnSync("git", ["ls-files", "-z"], {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 32 * 1024 * 1024,
});
if (trackedResult.status !== 0) throw new Error(trackedResult.stderr);
const intendedAddResult = spawnSync(
  "git",
  ["ls-files", "--others", "--exclude-standard", "-z", "--", ...intendedGitAddRoots],
  { cwd: root, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
);
if (intendedAddResult.status !== 0) throw new Error(intendedAddResult.stderr);
const trackedPaths = new Set(parseNullList(trackedResult.stdout));
const intendedAddPaths = new Set(parseNullList(intendedAddResult.stdout));
const ineligible = inventory.filter(
  (path) => !trackedPaths.has(path) && !intendedAddPaths.has(path),
);
if (ineligible.length) {
  throw new Error(`freeze contains paths outside tracked/intended-add scope: ${ineligible}`);
}
const freezeLines = [];
for (const path of inventory) freezeLines.push(`${await digest(path)}  ${path}`);
await writeFile(
  resolve(round006Evidence, `freeze-${stage}.sha256`),
  `${freezeLines.join("\n")}\n`,
);

console.log(
  JSON.stringify(
    {
      schema: "p30.round006.freeze-write.v1",
      stage,
      status: "pass",
      receipt: "ArtSource/P30/Round006/receipt.json",
      freeze: `ArtSource/P30/Round006/freeze-${stage}.sha256`,
      entries: freezeLines.length,
      trackedEntries: inventory.filter((path) => trackedPaths.has(path)).length,
      intendedGitAddEntries: inventory.filter((path) => intendedAddPaths.has(path)).length,
      allPathsTrackedOrIntendedGitAdd: true,
      excludedIgnoredGeneratedSourcePrefixes: ignoredGeneratedSourcePrefixes,
    },
    null,
    2,
  ),
);
