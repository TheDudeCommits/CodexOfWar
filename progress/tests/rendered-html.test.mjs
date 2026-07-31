import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);
const dataUrl = new URL(
  "../public/data/codex-of-war.json",
  import.meta.url,
);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the production evidence ledger", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  const compactHtml = html.replaceAll("<!-- -->", "");

  assert.match(
    html,
    /<title>Codex of War — Production Evidence Ledger<\/title>/i,
  );
  assert.match(html, /<main[^>]*id="main-content"/i);
  assert.match(html, /Build what the camera can judge\./);
  assert.match(html, /live production surface/i);
  assert.doesNotMatch(html, /public production surface/i);

  assert.match(
    html,
    /href="\/captures\/P10\/round-001\/S01_Explore\.png"/,
  );
  assert.match(
    html,
    /href="\/captures\/P10\/round-001\/Turntable_ContactSheet\.png"/,
  );
  assert.match(html, /href="\/data\/P10-round-001-manifest\.json"/);
  assert.match(html, /href="\/data\/capture-manifest-latest\.json"/);
  assert.doesNotMatch(
    html,
    /\/captures\/P00\/round-001\/manifest\.json/,
  );
  assert.match(html, /Filed/);

  assert.match(html, /Low shoulder/);
  assert.match(html, /24–32%/);
  assert.match(html, /Reference 09/);
  assert.match(html, /29\.82%/);
  assert.match(html, /82,906/);
  assert.match(html, /P10 · Round 005/);
  assert.match(html, /Round rejected\. Rebuild in progress\./);
  assert.match(html, /Round 001 rejected · mechanically reproducible/);
  assert.match(
    html,
    /5c7317c59b610f2d6ae4c2c6e89cf6828a964f336a20176592100435eb180dcf/,
  );
  assert.match(
    html,
    /c4acdf3d6a3e206d4181735831c59a9d05e7a9f3247692fd146e38cb3f1378b9/,
  );
  assert.match(html, /all six image hashes/i);
  assert.match(html, /Focused EditMode 8\/8 · full suite 14\/14/);
  assert.match(html, /Blind visual subtotal: ours 9\/60 · Reference 09 49\/60/);
  assert.match(html, /Critic visual subtotal: ours 10\/60 · Reference 09 51\/60/);
  assert.match(html, /Character\/material: 2\/13 · required floor 8\/13/);
  assert.match(html, /Static lookdev only; no rig, S02, or S06/);
  assert.match(html, /80/);
  assert.match(compactHtml, /100 minimum total/);
  assert.match(html, /P00 exception/);
  assert.match(html, /visual loss does not block acceptance/i);

  assert.match(html, /Round history/);
  assert.match(html, /Infrastructure accepted/);
  assert.match(html, /28\.33/);
  assert.match(html, /Reference 09 \(B\) over current Unity \(A\)/);
  assert.match(html, /raw blockout/);
  assert.match(html, /Blind 9\/60 · critic 10\/60/);
  assert.match(
    html,
    /Reference 09 \(B\) over P10 round-001 \(A\)/,
  );
  assert.match(html, /continuous, anatomically credible authored shell/i);
  assert.match(html, /Source preflight 5\/13/);
  assert.match(html, /Rejected before Unity · visual gate failed closed/);
  assert.match(
    html,
    /href="\/captures\/P10\/round-002-preflight\/Combat_Failure\.png"/,
  );
  assert.match(
    html,
    /href="\/data\/P10-round-002-preflight\.json"/,
  );
  assert.match(html, /Source preflight 6\/13 · mandatory 4\/8/);
  assert.match(
    html,
    /Rejected before Unity · fresh visual gate failed closed/,
  );
  assert.match(
    html,
    /href="\/captures\/P10\/round-003-preflight\/Front_Decisive\.png"/,
  );
  assert.match(
    html,
    /href="\/captures\/P10\/round-003-preflight\/Grip_Failure\.png"/,
  );
  assert.match(
    html,
    /href="\/captures\/P10\/round-003-preflight\/Combat\.png"/,
  );
  assert.match(
    html,
    /href="\/data\/P10-round-003-preflight\.json"/,
  );
  assert.match(html, /civilian tank, scarf, jeans, and sneakers/i);
  assert.match(html, /Source preflight 7\/13 · mandatory 4\/8/);
  assert.match(
    html,
    /Rejected before Unity · fresh visual gate failed closed/,
  );
  assert.match(
    html,
    /href="\/captures\/P10\/round-004-preflight\/Front_Decisive\.png"/,
  );
  assert.match(
    html,
    /href="\/captures\/P10\/round-004-preflight\/Grip_Failure\.png"/,
  );
  assert.match(
    html,
    /href="\/captures\/P10\/round-004-preflight\/Combat_Failure\.png"/,
  );
  assert.match(
    html,
    /href="\/data\/P10-round-004-preflight\.json"/,
  );
  assert.match(html, /toy-like procedural slab-and-tube assembly/i);
  assert.match(html, /professional-source pipeline pivot active/i);
  assert.match(html, /all 8 mandatory source checks/i);
  assert.doesNotMatch(html, /codex-preview|Building your site/i);
  assert.doesNotMatch(html, /react-loading-skeleton/);

  for (let index = 0; index <= 25; index += 1) {
    const id = `P${String(index).padStart(2, "0")}`;
    assert.match(html, new RegExp(`\\b${id}\\b`));
  }
});

test("checked-in data contains the complete, honest P00–P25 ledger", async () => {
  const dashboard = JSON.parse(await readFile(dataUrl, "utf8"));
  const expectedNames = [
    "Evidence spine",
    "Shoulder camera",
    "Ground locomotion",
    "Hero animation foundation",
    "Light combo",
    "Heavy attack",
    "Dodge and evasion",
    "Hit reaction and death",
    "Zombie navigation",
    "Crowd combat director",
    "Hero look development",
    "Zombie look development",
    "Arena composition",
    "Lighting and atmosphere",
    "Combat VFX",
    "Combat audio",
    "HUD and threat language",
    "Finisher vignette",
    "Integrated encounter",
    "Performance and delivery",
    "Fighter contract",
    "Fighter two",
    "Fighter three",
    "Fighter four",
    "Roster select and persistence",
    "Roster encounter balance",
  ];

  assert.equal(dashboard.pieces.length, 26);
  assert.deepEqual(
    dashboard.pieces.map((piece) => piece.id),
    Array.from(
      { length: 26 },
      (_, index) => `P${String(index).padStart(2, "0")}`,
    ),
  );
  assert.deepEqual(
    dashboard.pieces.map((piece) => piece.name),
    expectedNames,
  );

  const p00 = dashboard.pieces[0];
  const p10 = dashboard.pieces[10];
  const queuedPieces = dashboard.pieces.filter(
    (piece) => piece.id !== "P00" && piece.id !== "P10",
  );
  assert.equal(p00.status, "accepted");
  assert.equal(p10.status, "revising");
  assert.equal(dashboard.activeBuild.pieceId, "P10");
  assert.equal(dashboard.activeBuild.round, 5);
  assert.equal(dashboard.activeBuild.status, p10.status);
  assert.ok(queuedPieces.every((piece) => piece.status === "queued"));

  assert.equal(dashboard.canonicalCapture.camera, "Low shoulder");
  assert.equal(
    dashboard.canonicalCapture.heroHeight,
    "24–32% of image height",
  );
  assert.equal(dashboard.canonicalCapture.benchmarkId, "Reference 09");
  assert.equal(
    dashboard.canonicalCapture.capturePath,
    "/captures/P10/round-001/S01_Explore.png",
  );
  assert.equal(
    dashboard.canonicalCapture.manifestPath,
    "/data/P10-round-001-manifest.json",
  );
  assert.equal(
    dashboard.canonicalCapture.latestManifestPath,
    "/data/capture-manifest-latest.json",
  );
  assert.equal(dashboard.canonicalCapture.captureAvailable, true);
  assert.equal(dashboard.canonicalCapture.manifestAvailable, true);
  assert.equal(dashboard.acceptance.threshold, 80);
  assert.equal(dashboard.acceptance.maximum, 100);
  assert.match(dashboard.acceptance.p00Exception, /visual loss does not block/i);

  assert.equal(dashboard.rounds.length, 6);
  assert.equal(dashboard.rounds[0].pieceId, "P00");
  assert.equal(
    dashboard.rounds[0].critic.status,
    "Infrastructure accepted · visual baseline lost",
  );
  assert.equal(dashboard.rounds[0].critic.score, 28.33);
  assert.equal(
    dashboard.rounds[0].critic.preference,
    "Reference 09 (B) over current Unity (A)",
  );
  assert.match(dashboard.rounds[0].critic.primaryGap, /raw blockout/i);
  assert.equal(dashboard.rounds[1].pieceId, "P10");
  assert.equal(dashboard.rounds[1].status, "criticized");
  assert.equal(
    dashboard.rounds[1].critic.status,
    "Rejected · fresh blind judge and critic agree",
  );
  assert.equal(dashboard.rounds[1].critic.score, 9);
  assert.equal(
    dashboard.rounds[1].critic.scoreLabel,
    "Blind 9/60 · critic 10/60",
  );
  assert.equal(
    dashboard.rounds[1].critic.preference,
    "Reference 09 (B) over P10 round-001 (A)",
  );
  assert.match(
    dashboard.rounds[1].critic.primaryGap,
    /continuous, anatomically credible authored shell/i,
  );
  assert.equal(dashboard.rounds[2].pieceId, "P10");
  assert.equal(dashboard.rounds[2].round, 2);
  assert.equal(dashboard.rounds[2].status, "criticized");
  assert.equal(
    dashboard.rounds[2].critic.status,
    "Rejected before Unity · visual gate failed closed",
  );
  assert.equal(dashboard.rounds[2].critic.score, 5);
  assert.equal(dashboard.rounds[2].critic.scoreLabel, "Source preflight 5/13");
  assert.match(
    dashboard.rounds[2].critic.primaryGap,
    /combat hands tear, detach/i,
  );
  assert.equal(dashboard.rounds[3].pieceId, "P10");
  assert.equal(dashboard.rounds[3].round, 3);
  assert.equal(dashboard.rounds[3].status, "criticized");
  assert.equal(
    dashboard.rounds[3].critic.status,
    "Rejected before Unity · fresh visual gate failed closed",
  );
  assert.equal(dashboard.rounds[3].critic.score, 6);
  assert.equal(
    dashboard.rounds[3].critic.scoreLabel,
    "Source preflight 6/13 · mandatory 4/8",
  );
  assert.equal(
    dashboard.rounds[3].critic.preference,
    "Do not advance round 003 to Unity",
  );
  assert.match(
    dashboard.rounds[3].critic.primaryGap,
    /civilian tank, scarf, jeans, and sneakers/i,
  );
  assert.equal(dashboard.rounds[4].pieceId, "P10");
  assert.equal(dashboard.rounds[4].round, 4);
  assert.equal(dashboard.rounds[4].status, "criticized");
  assert.equal(
    dashboard.rounds[4].critic.status,
    "Rejected before Unity · fresh visual gate failed closed",
  );
  assert.equal(dashboard.rounds[4].critic.score, 7);
  assert.equal(
    dashboard.rounds[4].critic.scoreLabel,
    "Source preflight 7/13 · mandatory 4/8",
  );
  assert.equal(
    dashboard.rounds[4].critic.preference,
    "Do not advance round 004 to Unity",
  );
  assert.match(
    dashboard.rounds[4].critic.primaryGap,
    /toy-like procedural slab-and-tube assembly/i,
  );
  assert.equal(dashboard.rounds[5].pieceId, "P10");
  assert.equal(dashboard.rounds[5].round, 5);
  assert.equal(dashboard.rounds[5].status, "building");
  assert.equal(
    dashboard.rounds[5].critic.status,
    "Not started · source derivative build active",
  );
  assert.equal(dashboard.rounds[5].critic.score, null);
  assert.equal(dashboard.rounds[5].critic.scoreLabel, null);
  assert.equal(dashboard.rounds[5].critic.preference, null);
  assert.equal(dashboard.rounds[5].critic.primaryGap, null);
});

test("P10 evidence is filed while the global latest manifest remains P00-pinned", async () => {
  const [
    dashboard,
    p00Manifest,
    p10Manifest,
    p10Round002Preflight,
    p10Round003Preflight,
    p10Round004Preflight,
    latestManifest,
    p10Screenshot,
    turntableContact,
    round002Neutral,
    round002CombatFailure,
    round003Front,
    round003GripFailure,
    round003Combat,
    round004Front,
    round004GripFailure,
    round004CombatFailure,
  ] = await Promise.all([
    readFile(dataUrl, "utf8").then(JSON.parse),
    readFile(
      new URL("../public/data/P00-round-001-manifest.json", import.meta.url),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL("../public/data/P10-round-001-manifest.json", import.meta.url),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL("../public/data/P10-round-002-preflight.json", import.meta.url),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL("../public/data/P10-round-003-preflight.json", import.meta.url),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL("../public/data/P10-round-004-preflight.json", import.meta.url),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL("../public/data/capture-manifest-latest.json", import.meta.url),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL(
        "../public/captures/P10/round-001/S01_Explore.png",
        import.meta.url,
      ),
    ),
    readFile(
      new URL(
        "../public/captures/P10/round-001/Turntable_ContactSheet.png",
        import.meta.url,
      ),
    ),
    readFile(
      new URL(
        "../public/captures/P10/round-002-preflight/Neutral_Front.png",
        import.meta.url,
      ),
    ),
    readFile(
      new URL(
        "../public/captures/P10/round-002-preflight/Combat_Failure.png",
        import.meta.url,
      ),
    ),
    readFile(
      new URL(
        "../public/captures/P10/round-003-preflight/Front_Decisive.png",
        import.meta.url,
      ),
    ),
    readFile(
      new URL(
        "../public/captures/P10/round-003-preflight/Grip_Failure.png",
        import.meta.url,
      ),
    ),
    readFile(
      new URL(
        "../public/captures/P10/round-003-preflight/Combat.png",
        import.meta.url,
      ),
    ),
    readFile(
      new URL(
        "../public/captures/P10/round-004-preflight/Front_Decisive.png",
        import.meta.url,
      ),
    ),
    readFile(
      new URL(
        "../public/captures/P10/round-004-preflight/Grip_Failure.png",
        import.meta.url,
      ),
    ),
    readFile(
      new URL(
        "../public/captures/P10/round-004-preflight/Combat_Failure.png",
        import.meta.url,
      ),
    ),
  ]);
  const fingerprint = dashboard.activeBuild.evidenceFingerprint;
  const screenshotHash = createHash("sha256")
    .update(p10Screenshot)
    .digest("hex");
  const turntableHash = createHash("sha256")
    .update(turntableContact)
    .digest("hex");

  assert.deepEqual(latestManifest, p00Manifest);
  assert.equal(latestManifest.piece, "P00");
  assert.equal(p10Manifest.piece, "P10");
  assert.equal(p10Manifest.round, 1);
  assert.equal(p10Manifest.preset, "S01_Explore");
  assert.deepEqual(p10Manifest.resolution, { width: 1600, height: 900 });
  assert.equal(
    p10Manifest.screenshotRelativePath,
    dashboard.canonicalCapture.capturePath.slice(1),
  );
  assert.equal(screenshotHash, p10Manifest.screenshotSha256);
  assert.equal(
    turntableHash,
    dashboard.activeBuild.evidenceBundle.turntable.sha256,
  );
  assert.equal(fingerprint.screenshotSha256, p10Manifest.screenshotSha256);
  assert.equal(
    fingerprint.captureContractSha256,
    p10Manifest.captureContractSha256,
  );
  assert.equal(
    fingerprint.renderSettingsSha256,
    p10Manifest.renderSettingsSha256,
  );
  assert.equal(fingerprint.gitRevision, p10Manifest.gitRevision);
  assert.equal(fingerprint.gitState, p10Manifest.gitState);
  assert.equal(fingerprint.seed, p10Manifest.seed);
  assert.equal(fingerprint.preset, p10Manifest.preset);
  assert.equal(fingerprint.capturedAtUtc, p10Manifest.capturedAtUtc);
  assert.equal(p10Manifest.heroScreenHeightFraction, 0.29820388555526736);
  assert.equal(p10Manifest.heroMeshCount, 2);
  assert.equal(p10Manifest.heroRendererCount, 2);
  assert.equal(p10Manifest.heroTriangleCount, 82906);
  assert.equal(p10Manifest.heroMaterialCount, 5);
  assert.equal(p10Round002Preflight.piece, "P10");
  assert.equal(p10Round002Preflight.round, 2);
  assert.equal(p10Round002Preflight.status, "rejected-pre-unity");
  assert.equal(p10Round002Preflight.engineRun, false);
  assert.equal(p10Round002Preflight.goAttestationFiled, false);
  assert.equal(p10Round002Preflight.visualReview.score, 5);
  assert.equal(p10Round002Preflight.visualReview.maximum, 13);
  assert.equal(p10Round002Preflight.visualReview.verdict, "NO-GO");
  assert.equal(
    createHash("sha256").update(round002Neutral).digest("hex"),
    p10Round002Preflight.diagnostics[0].sha256,
  );
  assert.equal(
    createHash("sha256").update(round002CombatFailure).digest("hex"),
    p10Round002Preflight.diagnostics[1].sha256,
  );
  assert.equal(p10Round003Preflight.piece, "P10");
  assert.equal(p10Round003Preflight.round, 3);
  assert.equal(p10Round003Preflight.status, "rejected-pre-unity");
  assert.equal(p10Round003Preflight.engineRun, false);
  assert.equal(p10Round003Preflight.unityCaptureFiled, false);
  assert.equal(p10Round003Preflight.goAttestationFiled, false);
  assert.equal(p10Round003Preflight.visualReview.score, 6);
  assert.equal(p10Round003Preflight.visualReview.maximum, 13);
  assert.equal(p10Round003Preflight.visualReview.mandatoryPasses, 4);
  assert.equal(p10Round003Preflight.visualReview.mandatoryMaximum, 8);
  assert.equal(p10Round003Preflight.visualReview.verdict, "NO-GO");
  assert.equal(
    p10Round003Preflight.reproducibility.result,
    "semantic-pass-exact-hash-fail",
  );
  assert.equal(
    p10Round003Preflight.reproducibility.repositoryToFirstRunHashMatches,
    0,
  );
  assert.equal(
    p10Round003Preflight.reproducibility.firstToSecondRunHashMatches,
    0,
  );
  assert.equal(p10Round003Preflight.integrityFindings.sourceHashMismatches, 0);
  assert.equal(p10Round003Preflight.integrityFindings.auditOutputRecords, 15);
  assert.equal(
    p10Round003Preflight.integrityFindings.physicalGeneratedArtifacts,
    16,
  );
  assert.equal(
    createHash("sha256").update(round003Front).digest("hex"),
    p10Round003Preflight.diagnostics[0].sha256,
  );
  assert.equal(
    createHash("sha256").update(round003GripFailure).digest("hex"),
    p10Round003Preflight.diagnostics[1].sha256,
  );
  assert.equal(
    createHash("sha256").update(round003Combat).digest("hex"),
    p10Round003Preflight.diagnostics[2].sha256,
  );
  assert.equal(p10Round004Preflight.piece, "P10");
  assert.equal(p10Round004Preflight.round, 4);
  assert.equal(p10Round004Preflight.status, "rejected-pre-unity");
  assert.equal(p10Round004Preflight.engineRun, false);
  assert.equal(p10Round004Preflight.unityCaptureFiled, false);
  assert.equal(p10Round004Preflight.goAttestationFiled, false);
  assert.equal(p10Round004Preflight.visualReview.score, 7);
  assert.equal(p10Round004Preflight.visualReview.maximum, 13);
  assert.equal(p10Round004Preflight.visualReview.mandatoryPasses, 4);
  assert.equal(p10Round004Preflight.visualReview.mandatoryMaximum, 8);
  assert.equal(p10Round004Preflight.visualReview.verdict, "NO-GO");
  assert.equal(p10Round004Preflight.visualReview.unityDisposition, "LOCKED");
  assert.equal(
    p10Round004Preflight.reproducibility.result,
    "semantic-pass-exact-hash-fail",
  );
  assert.equal(
    p10Round004Preflight.reproducibility.frozenInputMatches,
    "26/26",
  );
  assert.equal(
    p10Round004Preflight.reproducibility.physicalOutputMatches,
    "22/39",
  );
  assert.equal(
    p10Round004Preflight.integrityFindings.fbxBrokenTextureReferences,
    "5/5",
  );
  assert.equal(
    p10Round004Preflight.source.reviewSha256,
    "94b43c10b68b77edec16f27f01c79b04ad358fbd3364f22df9a53e100f05a9a3",
  );
  assert.equal(
    createHash("sha256").update(round004Front).digest("hex"),
    p10Round004Preflight.diagnostics[0].sha256,
  );
  assert.equal(
    createHash("sha256").update(round004GripFailure).digest("hex"),
    p10Round004Preflight.diagnostics[1].sha256,
  );
  assert.equal(
    createHash("sha256").update(round004CombatFailure).digest("hex"),
    p10Round004Preflight.diagnostics[2].sha256,
  );

  for (const turntableImage of p10Manifest.turntableImages) {
    const image = await readFile(
      new URL(`../public/${turntableImage.relativePath}`, import.meta.url),
    );
    assert.equal(
      createHash("sha256").update(image).digest("hex"),
      turntableImage.sha256,
    );
  }
});

test("starter-only preview code and dependency are gone", async () => {
  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(page, /_sites-preview|codex-preview|SkeletonPreview/);
  assert.doesNotMatch(layout, /codex-preview|Starter Project/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.match(packageJson, /"name": "codex-of-war-progress"/);

  await assert.rejects(
    access(new URL("app/_sites-preview/SkeletonPreview.tsx", projectRoot)),
  );
  await assert.rejects(
    access(new URL("app/_sites-preview/preview.css", projectRoot)),
  );
});
