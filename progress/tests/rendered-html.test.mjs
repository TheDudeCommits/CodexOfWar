import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);
const publicRoot = new URL("../public/", import.meta.url);
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
    /href="\/captures\/P10\/round-016-two-segment-limb\/S01_FreshEngineGate_OldAstraVale\.png"/,
  );
  assert.match(
    html,
    /href="\/captures\/P10\/round-016-two-segment-limb\/Turntable_FreshEngineGate_OldAstraVale\.png"/,
  );
  assert.match(html, /href="\/data\/P10-round-016-two-segment-limb\.json"/);
  assert.match(
    html,
    /href="\/captures\/P10\/round-017-local-constraint-release\/NyraKestrel_LocalConstraintRelease_CRITIC_REJECTED\.png"/,
  );
  assert.match(
    html,
    /href="\/captures\/P10\/round-017-local-constraint-release\/P10_Round017_JudgePanel\.png"/,
  );
  assert.match(
    html,
    /href="\/data\/P10-round-017-local-constraint-release\.json"/,
  );
  assert.match(html, /href="\/data\/capture-manifest-latest\.json"/);
  assert.doesNotMatch(
    html,
    /\/captures\/P00\/round-001\/manifest\.json/,
  );
  assert.match(html, /Filed/);

  assert.match(html, /24–32%/);
  assert.match(html, /Private benchmark/);
  assert.match(html, /Astra Vale/);
  assert.match(html, /P30 · Round 008/);
  assert.match(html, /href="\/captures\/P30\/round-008\/S04\.png"/);
  assert.match(html, /href="\/data\/P30-round-008\.json"/);
  assert.match(html, /Proof filed\. Critic in progress\./);
  assert.match(html, /Selected Combat-FX Candidate · Independent Critic Running/);
  assert.match(html, /INDEPENDENT CRITIC RUNNING · NOT ACCEPTED/i);
  assert.match(html, /Verdict[\s\S]*PENDING · CRITIC RUNNING/i);
  assert.match(html, /Focused \/ overall[\s\S]*PENDING · PENDING/i);
  assert.match(html, /PENDING · REQUIRED 9\/10/i);
  assert.match(html, /9\.648 px · LIMIT 24 px/i);
  assert.match(html, /87 calls · 203,175 triangles · 32 textures · 41 geometries/i);
  assert.match(html, /quality remains pending and unaccepted/i);
  assert.match(html, /18\/18 authored assets · no fallback/i);
  assert.match(html, /Chrome 150/i);
  assert.match(html, /1600×900 · DPR 1/i);
  assert.match(html, /Three clean deterministic FX replays/i);
  assert.match(html, /Wall and clear boom obstruction gates pass/i);
  assert.match(html, /seal anonymous mapping and scores before reveal/i);
  assert.match(html, /Round008 fanned the same bounded FX assignment to two fresh isolated builders/i);
  assert.match(html, /S01–S06 fresh browser captures/i);
  assert.match(html, /Exact Tape A, Tape B, and Tape C replays/i);
  assert.match(html, /Camera, input, interaction, projection, reset, and obstruction hard gates/i);
  assert.match(html, /Cold-ready, warm-runtime, resource, payload, provenance, and blind-gate reports/i);
  assert.match(html, /Rejected foundation evidence · not AAA acceptance/i);
  assert.match(html, /Fresh headed production-browser critic complete/i);
  assert.match(html, /Chrome 151/i);
  assert.match(html, /ANGLE Metal/i);
  assert.match(html, /cohesive_aaa_combat_presentation/i);
  assert.match(html, /27\.3 MB/);
  assert.match(html, /80\/80 receipt files/i);
  assert.match(html, /16\/16 GLBs/i);
  assert.match(html, /475\.3 MB raw cache/i);
  assert.match(html, /fused colossal third leg or shield/i);
  assert.match(compactHtml, /95<span> \/ 100<\/span>/);
  assert.match(compactHtml, /100 minimum total/);
  assert.match(html, /Every visual category ≥ 9\/10/);
  assert.match(html, /Focused S03–S05 must win 3\/3/);
  assert.match(html, /Overall score ≥ 95\/100/);
  assert.match(html, /Overall ≥ 5\/6 blind wins/);
  assert.match(html, /All hard gates pass/);
  assert.match(html, /P00 exception/);
  assert.match(html, /visual loss does not block acceptance/i);

  assert.match(html, /Round history/);
  assert.match(html, /Infrastructure accepted/);
  assert.match(html, /28\.33/);
  assert.match(html, /Private benchmark \(B\) over current Unity \(A\)/);
  assert.match(html, /raw blockout/);
  assert.match(html, /Blind 9\/60 · critic 10\/60/);
  assert.match(
    html,
    /Private benchmark \(B\) over P10 round-001 \(A\)/,
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
  assert.match(html, /Source preflight 6\/13 · mandatory 4\/8/);
  assert.match(html, /NO-GO · rejected before Unity/i);
  assert.match(html, /Benchmark preferred 7\/7 blinded comparisons/);
  assert.match(html, /licensed Einar civilian mechanic in workwear/i);
  assert.match(html, /4\/4 static imports at 85,096 \/ 47,615 \/ 25,484/);
  assert.match(html, /no actual game capture was performed/i);
  assert.match(
    html,
    /href="\/captures\/P10\/round-005-preflight\/Front_Decisive\.png"/,
  );
  assert.match(
    html,
    /href="\/captures\/P10\/round-005-preflight\/Face_Diagnostic\.png"/,
  );
  assert.match(
    html,
    /href="\/captures\/P10\/round-005-preflight\/Grip_Diagnostic\.png"/,
  );
  assert.match(
    html,
    /href="\/captures\/P10\/round-005-preflight\/Combat_Decisive\.png"/,
  );
  assert.match(
    html,
    /href="\/data\/P10-round-005-preflight\.json"/,
  );
  assert.match(html, /release follow-up proved the validator byte-idempotent/i);
  assert.match(html, /Concept preflight 55\/100 · threshold 85 · critical floor failed/);
  assert.match(html, /Candidate met benchmark bar in 0\/6 blinded comparisons/);
  assert.match(html, /rejected before paid 3D and Unity/i);
  assert.match(html, /generic dark armored-anime swordswoman/i);
  assert.match(
    html,
    /href="\/captures\/P10\/round-006-concept\/NyraKestrel_Turnaround\.png"/,
  );
  assert.match(
    html,
    /href="\/captures\/P10\/round-006-concept\/StormglassOdachi\.png"/,
  );
  assert.match(
    html,
    /href="\/captures\/P10\/round-006-concept\/NyraKestrel_CombatGrip\.png"/,
  );
  assert.match(html, /href="\/data\/P10-round-006-concept\.json"/);
  assert.match(html, /Concept preflight 62\/100 · threshold 85 · category floor failed/);
  assert.match(html, /Candidate met benchmark bar in 2\/6 blinded comparisons · 5\/6 required/);
  assert.match(html, /DENY_PAID_3D_GENERATION · no accepted combat grip/);
  assert.match(
    html,
    /absence of one accepted identity-preserving combat image that unambiguously proves both complete hands closed on separated regions of the same hilt/i,
  );
  assert.match(
    html,
    /href="\/captures\/P10\/round-007-concept\/NyraKestrel_Turnaround_ACCEPTED\.png"/,
  );
  assert.match(
    html,
    /href="\/captures\/P10\/round-007-concept\/StormcageOdachi_ACCEPTED\.png"/,
  );
  assert.match(
    html,
    /href="\/captures\/P10\/round-007-concept\/NyraKestrel_CombatGrip_Revision02_REJECTED\.png"/,
  );
  assert.match(html, /href="\/data\/P10-round-007-concept\.json"/);
  assert.match(html, /CONTACT PASS · DENY_PAID_3D_GENERATION/);
  assert.match(html, /Composite concept preflight 68\/100 · threshold 85 · category floor 5\/10/);
  assert.match(html, /Candidate met benchmark bar in 3\/6 blinded comparisons · 5\/6 required/);
  assert.match(
    html,
    /href="\/captures\/P10\/round-008-contact\/NyraKestrel_CombatGrip_FRESH_CRITIC_ACCEPTED\.png"/,
  );
  assert.match(html, /href="\/data\/P10-round-008-contact\.json"/);
  assert.match(html, /MYTHIC FORCE FAIL · DENY_PAID_3D_GENERATION/);
  assert.match(html, /Composite concept preflight 71\/100 · threshold 85 · category floor 6\/10/);
  assert.match(html, /Candidate met benchmark bar in 2\/6 blinded comparisons · 5\/6 required/);
  assert.match(
    html,
    /href="\/captures\/P10\/round-009-mythic-force\/NyraKestrel_MythicForce_CRITIC_REJECTED\.png"/,
  );
  assert.match(html, /href="\/data\/P10-round-009-mythic-force\.json"/);
  assert.match(html, /GROUND-ARC FAIL · DENY_PAID_3D_GENERATION/);
  assert.match(html, /Composite concept preflight 68\/100 · threshold 85 · category floor 6\/10/);
  assert.match(html, /Candidate met benchmark bar in 2\/6 blinded comparisons · 5\/6 required/);
  assert.match(
    html,
    /href="\/captures\/P10\/round-010-ground-arc\/NyraKestrel_GroundArcArrest_CRITIC_REJECTED\.png"/,
  );
  assert.match(html, /href="\/data\/P10-round-010-ground-arc\.json"/);
  assert.match(html, /KINETIC CHAIN FAIL · DENY_PAID_3D_GENERATION/);
  assert.match(html, /Composite concept preflight 62\/100 · threshold 85 · category floor 5\/10/);
  assert.match(
    html,
    /href="\/captures\/P10\/round-011-kinetic-chain\/NyraKestrel_KineticChain_CRITIC_REJECTED\.png"/,
  );
  assert.match(html, /href="\/data\/P10-round-011-kinetic-chain\.json"/);
  assert.match(html, /SCAPULAR COUNTERFORCE FAIL · DENY_PAID_3D_GENERATION/);
  assert.match(html, /Composite concept preflight 56\/100 · threshold 85 · category floor 3\/10/);
  assert.match(html, /Candidate met benchmark bar in 1\/6 blinded comparisons · 5\/6 required/);
  assert.match(
    html,
    /href="\/captures\/P10\/round-012-scapular-counterforce\/NyraKestrel_ScapularCounterforce_CRITIC_REJECTED\.png"/,
  );
  assert.match(html, /href="\/data\/P10-round-012-scapular-counterforce\.json"/);
  assert.match(html, /ELBOW RETURN TRIANGLE FAIL · DENY_PAID_3D_GENERATION/);
  assert.match(html, /Composite concept preflight 41\/100 · threshold 85 · category floor 1\/10/);
  assert.match(html, /Candidate met benchmark bar in 2\/6 blinded comparisons · 5\/6 required/);
  assert.match(
    html,
    /href="\/captures\/P10\/round-013-elbow-return-triangle\/NyraKestrel_ElbowReturnTriangle_CRITIC_REJECTED\.png"/,
  );
  assert.match(html, /href="\/data\/P10-round-013-elbow-return-triangle\.json"/);
  assert.match(html, /TRAILING RETURN WEDGE FAIL · DENY_PAID_3D_GENERATION/);
  assert.match(html, /Composite concept preflight 41\/100 · threshold 85 · category floor 0\/10/);
  assert.match(
    html,
    /href="\/captures\/P10\/round-014-trailing-return-wedge\/NyraKestrel_TrailingReturnWedge_CRITIC_REJECTED\.png"/,
  );
  assert.match(html, /href="\/data\/P10-round-014-trailing-return-wedge\.json"/);
  assert.match(html, /INWARD RETURN MASK FAIL · DENY_PAID_3D_GENERATION/);
  assert.match(html, /Composite concept preflight 40\/100 · threshold 85 · category floor 0\/10/);
  assert.match(
    html,
    /href="\/captures\/P10\/round-015-inward-return-mask\/NyraKestrel_InwardReturnMask_CRITIC_REJECTED\.png"/,
  );
  assert.match(html, /href="\/data\/P10-round-015-inward-return-mask\.json"/);
  assert.match(html, /TWO-SEGMENT LIMB FAIL · TARGET-MATCHED ENGINE CAPTURE FAIL/);
  assert.match(html, /Fresh engine-backed gate 33\/100 · threshold 95 · category floor 0\/10/);
  assert.match(html, /Actual Unity evidence preferred in 0\/6 blinded comparisons · 5\/6 required/);
  assert.match(
    html,
    /href="\/captures\/P10\/round-016-two-segment-limb\/NyraKestrel_TwoSegmentLimb_CRITIC_REJECTED\.png"/,
  );
  assert.match(
    html,
    /href="\/captures\/P10\/round-016-two-segment-limb\/S01_FreshEngineGate_OldAstraVale\.png"/,
  );
  assert.match(
    html,
    /href="\/captures\/P10\/round-016-two-segment-limb\/Turntable_FreshEngineGate_OldAstraVale\.png"/,
  );
  assert.match(html, /href="\/data\/P10-round-016-two-segment-limb\.json"/);
  assert.match(html, /LOCAL CONSTRAINT RELEASE FAIL · TARGET-MATCHED ENGINE CAPTURE FAIL/);
  assert.match(html, /Fresh engine-backed gate 31\/100 · threshold 95 · category floor 0\/10/);
  assert.match(
    html,
    /href="\/captures\/P10\/round-017-local-constraint-release\/NyraKestrel_LocalConstraintRelease_CRITIC_REJECTED\.png"/,
  );
  assert.match(
    html,
    /href="\/captures\/P10\/round-017-local-constraint-release\/P10_Round017_JudgePanel\.png"/,
  );
  assert.match(html, /href="\/data\/P10-round-017-local-constraint-release\.json"/);
  assert.match(html, /Three\.js playable nucleus/i);
  assert.match(html, /Authored presentation integration/i);
  assert.match(html, /P10[\s\S]*Paused/i);
  assert.match(html, /replace only the hero, Hollow, and one camera-facing arena sector/i);
  assert.match(html, /mechanics, camera, input, HUD, and the review contract frozen/i);
  assert.match(html, /href="\/captures\/P30\/round-002\/S02\.png"/);
  assert.match(html, /href="\/captures\/P30\/round-002\/S04\.png"/);
  assert.match(html, /href="\/captures\/P30\/round-002\/S06\.png"/);
  assert.match(html, /href="\/data\/P30-round-002\.json"/);
  assert.match(html, /href="\/captures\/P30\/round-003\/S02\.png"/);
  assert.match(html, /href="\/captures\/P30\/round-003\/S04\.png"/);
  assert.match(html, /href="\/captures\/P30\/round-003\/S06\.png"/);
  assert.match(html, /href="\/data\/P30-round-003\.json"/);
  assert.match(html, /href="\/captures\/P30\/round-004\/S03\.png"/);
  assert.match(html, /href="\/captures\/P30\/round-004\/S04\.png"/);
  assert.match(html, /href="\/captures\/P30\/round-004\/S05\.png"/);
  assert.match(html, /href="\/data\/P30-round-004\.json"/);
  assert.match(html, /href="\/captures\/P30\/round-005\/S03\.png"/);
  assert.match(html, /href="\/captures\/P30\/round-005\/S04\.png"/);
  assert.match(html, /href="\/captures\/P30\/round-005\/S05\.png"/);
  assert.match(html, /href="\/data\/P30-round-005\.json"/);
  assert.doesNotMatch(
    html,
    /Reference\s+\d+|Reference\.zip|Reference\/[^"<]+\.(?:png|jpe?g|webp)|pairId|pairIdentifier|candidateSide|benchmarkSide|benchmarkFilename|benchmarkImage|lockedWinner|revealedWinner|reveal mapping|hidden key/i,
  );
  assert.doesNotMatch(html, /\bR\d{2}\b/);
  assert.doesNotMatch(
    html,
    /\/Users\/|\/home\/|[A-Za-z]:\\Users\\|\/tmp\/|\/private\/var\/folders\//i,
  );
  assert.doesNotMatch(html, /codex-preview|Building your site/i);
  assert.doesNotMatch(html, /react-loading-skeleton/);

  for (let index = 0; index <= 25; index += 1) {
    const id = `P${String(index).padStart(2, "0")}`;
    assert.match(html, new RegExp(`\\b${id}\\b`));
  }
  assert.match(html, /\bP30\b/);
  assert.match(html, /\bP31\b/);
});

test("checked-in data preserves P00–P25 and adds the honest P30/P31 browser lane", async () => {
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
    "Three.js playable nucleus",
    "Authored presentation integration",
  ];

  assert.equal(dashboard.pieces.length, 28);
  assert.deepEqual(
    dashboard.pieces.map((piece) => piece.id),
    [
      ...Array.from(
        { length: 26 },
        (_, index) => `P${String(index).padStart(2, "0")}`,
      ),
      "P30",
      "P31",
    ],
  );
  assert.deepEqual(
    dashboard.pieces.map((piece) => piece.name),
    expectedNames,
  );

  const p00 = dashboard.pieces[0];
  const p10 = dashboard.pieces[10];
  const p30 = dashboard.pieces.find((piece) => piece.id === "P30");
  const p31 = dashboard.pieces.find((piece) => piece.id === "P31");
  const queuedPieces = dashboard.pieces.filter(
    (piece) => !["P00", "P10", "P30", "P31"].includes(piece.id),
  );
  assert.equal(p00.status, "accepted");
  assert.equal(p10.status, "paused");
  assert.match(p10.outcome, /no longer the active implementation lane/i);
  assert.equal(p30.status, "review-ready");
  assert.equal(p31.status, "criticized");
  assert.equal(dashboard.activeBuild.pieceId, "P30");
  assert.equal(dashboard.activeBuild.round, 8);
  assert.equal(dashboard.activeBuild.roundLabel, "P30 · Round 008");
  assert.equal(
    dashboard.activeBuild.builder,
    "Selected Combat-FX Candidate · Independent Critic Running",
  );
  assert.equal(dashboard.activeBuild.status, p30.status);
  assert.match(dashboard.activeBuild.brief, /blade-bound cyan contour/i);
  assert.match(dashboard.activeBuild.brief, /frozen at exact commit 5359f91/i);
  assert.match(dashboard.activeBuild.brief, /pending candidate evidence, not acceptance/i);
  assert.match(dashboard.activeBuild.nextGate, /S03–S05 3\/3/i);
  assert.match(dashboard.activeBuild.nextGate, /at least 5\/6 overall/i);
  assert.match(dashboard.activeBuild.nextGate, /at least 95\/100/i);
  assert.match(p30.outcome, /Round007 is rejected at 34\/100/i);
  assert.match(p30.outcome, /Round008 selected Builder B/i);
  assert.match(p30.outcome, /quality remains pending and unaccepted/i);
  assert.deepEqual(p30.requiredEvidence, [
    "S01–S06 fresh browser captures",
    "Exact Tape A, Tape B, and Tape C replays",
    "Camera, input, interaction, projection, reset, and obstruction hard gates",
    "Cold-ready, warm-runtime, resource, payload, provenance, and blind-gate reports",
  ]);
  assert.match(p31.outcome, /18\/18 authored assets/i);
  assert.match(p31.outcome, /86-call \/ 204,155-triangle \/ 32-texture \/ 38-geometry envelope/i);
  assert.match(p31.outcome, /rejected at 23\/100/i);
  assert.match(p31.outcome, /frozen during the Round007 camera-only revision/i);
  assert.ok(queuedPieces.every((piece) => piece.status === "queued"));

  assert.equal(dashboard.canonicalCapture.shotId, "S04");
  assert.equal(dashboard.canonicalCapture.camera, "Adaptive 50-degree duel composer");
  assert.equal(
    dashboard.canonicalCapture.heroHeight,
    "360–540 px target",
  );
  assert.equal(
    dashboard.canonicalCapture.benchmarkId,
    "Fresh anonymous focused and six-pair gates",
  );
  assert.equal(
    dashboard.canonicalCapture.capturePath,
    "/captures/P30/round-008/S04.png",
  );
  assert.equal(
    dashboard.canonicalCapture.manifestPath,
    "/data/P30-round-008.json",
  );
  assert.equal(
    dashboard.canonicalCapture.latestManifestPath,
    "/data/capture-manifest-latest.json",
  );
  assert.equal(dashboard.canonicalCapture.captureAvailable, true);
  assert.equal(dashboard.canonicalCapture.manifestAvailable, true);
  assert.equal(dashboard.acceptance.threshold, 95);
  assert.equal(dashboard.acceptance.maximum, 100);
  assert.equal(
    dashboard.acceptance.visualMinimum,
    "Every visual category ≥ 9/10",
  );
  assert.equal(
    dashboard.acceptance.combatMinimum,
    "Focused S03–S05 must win 3/3",
  );
  assert.equal(dashboard.acceptance.criterionFloor, "Overall score ≥ 95/100");
  assert.equal(dashboard.acceptance.blindPreference, "Overall ≥ 5/6 blind wins");
  assert.equal(dashboard.acceptance.hardFailurePolicy, "All hard gates pass");
  assert.match(dashboard.acceptance.p00Exception, /visual loss does not block/i);

  assert.equal(dashboard.rounds.length, 26);
  assert.equal(dashboard.rounds[0].pieceId, "P00");
  assert.equal(
    dashboard.rounds[0].critic.status,
    "Infrastructure accepted · visual baseline lost",
  );
  assert.equal(dashboard.rounds[0].critic.score, 28.33);
  assert.equal(
    dashboard.rounds[0].critic.preference,
    "Private benchmark (B) over current Unity (A)",
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
    "Private benchmark (B) over P10 round-001 (A)",
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
  assert.equal(dashboard.rounds[5].status, "criticized");
  assert.equal(
    dashboard.rounds[5].critic.status,
    "NO-GO · rejected before Unity · fresh visual gate failed closed",
  );
  assert.equal(dashboard.rounds[5].critic.score, 6);
  assert.equal(
    dashboard.rounds[5].critic.scoreLabel,
    "Source preflight 6/13 · mandatory 4/8",
  );
  assert.equal(
    dashboard.rounds[5].critic.preference,
    "Benchmark preferred 7/7 blinded comparisons",
  );
  assert.match(
    dashboard.rounds[5].critic.primaryGap,
    /licensed Einar civilian mechanic in workwear/i,
  );
  assert.deepEqual(dashboard.rounds[5].evidenceLinks, [
    "/captures/P10/round-005-preflight/Front_Decisive.png",
    "/captures/P10/round-005-preflight/Face_Diagnostic.png",
    "/captures/P10/round-005-preflight/Grip_Diagnostic.png",
    "/captures/P10/round-005-preflight/Combat_Decisive.png",
    "/data/P10-round-005-preflight.json",
  ]);
  assert.equal(dashboard.rounds[6].pieceId, "P10");
  assert.equal(dashboard.rounds[6].round, 6);
  assert.equal(dashboard.rounds[6].status, "criticized");
  assert.equal(
    dashboard.rounds[6].critic.status,
    "NO-GO · rejected before paid 3D and Unity",
  );
  assert.equal(dashboard.rounds[6].critic.score, 55);
  assert.equal(
    dashboard.rounds[6].critic.scoreLabel,
    "Concept preflight 55/100 · threshold 85 · critical floor failed",
  );
  assert.equal(
    dashboard.rounds[6].critic.preference,
    "Candidate met benchmark bar in 0/6 blinded comparisons",
  );
  assert.match(
    dashboard.rounds[6].critic.primaryGap,
    /unique, function-led visual thesis/i,
  );
  assert.deepEqual(dashboard.rounds[6].evidenceLinks, [
    "/captures/P10/round-006-concept/NyraKestrel_Turnaround.png",
    "/captures/P10/round-006-concept/StormglassOdachi.png",
    "/captures/P10/round-006-concept/NyraKestrel_CombatGrip.png",
    "/data/P10-round-006-concept.json",
  ]);
  assert.equal(dashboard.rounds[7].pieceId, "P10");
  assert.equal(dashboard.rounds[7].round, 7);
  assert.equal(dashboard.rounds[7].status, "criticized");
  assert.equal(
    dashboard.rounds[7].critic.status,
    "DENY_PAID_3D_GENERATION · no accepted combat grip",
  );
  assert.equal(dashboard.rounds[7].critic.score, 62);
  assert.equal(
    dashboard.rounds[7].critic.scoreLabel,
    "Concept preflight 62/100 · threshold 85 · category floor failed",
  );
  assert.equal(
    dashboard.rounds[7].critic.preference,
    "Candidate met benchmark bar in 2/6 blinded comparisons · 5/6 required",
  );
  assert.match(
    dashboard.rounds[7].critic.primaryGap,
    /both complete hands closed on separated regions of the same hilt/i,
  );
  assert.deepEqual(dashboard.rounds[7].evidenceLinks, [
    "/captures/P10/round-007-concept/NyraKestrel_Turnaround_ACCEPTED.png",
    "/captures/P10/round-007-concept/StormcageOdachi_ACCEPTED.png",
    "/captures/P10/round-007-concept/NyraKestrel_CombatGrip_Revision02_REJECTED.png",
    "/data/P10-round-007-concept.json",
  ]);
  assert.equal(dashboard.rounds[8].pieceId, "P10");
  assert.equal(dashboard.rounds[8].round, 8);
  assert.equal(dashboard.rounds[8].status, "criticized");
  assert.equal(
    dashboard.rounds[8].critic.status,
    "CONTACT PASS · DENY_PAID_3D_GENERATION",
  );
  assert.equal(dashboard.rounds[8].critic.score, 68);
  assert.equal(
    dashboard.rounds[8].critic.scoreLabel,
    "Composite concept preflight 68/100 · threshold 85 · category floor 5/10",
  );
  assert.equal(
    dashboard.rounds[8].critic.preference,
    "Candidate met benchmark bar in 3/6 blinded comparisons · 5/6 required",
  );
  assert.match(
    dashboard.rounds[8].critic.primaryGap,
    /singular authored silhouette expressed through convincing full-body combat force/i,
  );
  assert.deepEqual(dashboard.rounds[8].evidenceLinks, [
    "/captures/P10/round-008-contact/NyraKestrel_CombatGrip_FRESH_CRITIC_ACCEPTED.png",
    "/data/P10-round-008-contact.json",
  ]);
  assert.equal(dashboard.rounds[9].pieceId, "P10");
  assert.equal(dashboard.rounds[9].round, 9);
  assert.equal(dashboard.rounds[9].status, "criticized");
  assert.equal(
    dashboard.rounds[9].critic.status,
    "MYTHIC FORCE FAIL · DENY_PAID_3D_GENERATION",
  );
  assert.equal(dashboard.rounds[9].critic.score, 71);
  assert.equal(
    dashboard.rounds[9].critic.scoreLabel,
    "Composite concept preflight 71/100 · threshold 85 · category floor 6/10",
  );
  assert.equal(
    dashboard.rounds[9].critic.preference,
    "Candidate met benchmark bar in 2/6 blinded comparisons · 5/6 required",
  );
  assert.match(
    dashboard.rounds[9].critic.primaryGap,
    /mechanics-driven storm-warden combat silhouette/i,
  );
  assert.deepEqual(dashboard.rounds[9].evidenceLinks, [
    "/captures/P10/round-009-mythic-force/NyraKestrel_MythicForce_CRITIC_REJECTED.png",
    "/data/P10-round-009-mythic-force.json",
  ]);
  assert.equal(dashboard.rounds[10].pieceId, "P10");
  assert.equal(dashboard.rounds[10].round, 10);
  assert.equal(dashboard.rounds[10].status, "criticized");
  assert.equal(
    dashboard.rounds[10].critic.status,
    "GROUND-ARC FAIL · DENY_PAID_3D_GENERATION",
  );
  assert.equal(dashboard.rounds[10].critic.score, 68);
  assert.equal(
    dashboard.rounds[10].critic.scoreLabel,
    "Composite concept preflight 68/100 · threshold 85 · category floor 6/10",
  );
  assert.equal(
    dashboard.rounds[10].critic.preference,
    "Candidate met benchmark bar in 2/6 blinded comparisons · 5/6 required",
  );
  assert.match(
    dashboard.rounds[10].critic.primaryGap,
    /mechanically unified force chain/i,
  );
  assert.deepEqual(dashboard.rounds[10].evidenceLinks, [
    "/captures/P10/round-010-ground-arc/NyraKestrel_GroundArcArrest_CRITIC_REJECTED.png",
    "/data/P10-round-010-ground-arc.json",
  ]);
  assert.equal(dashboard.rounds[11].pieceId, "P10");
  assert.equal(dashboard.rounds[11].round, 11);
  assert.equal(dashboard.rounds[11].status, "criticized");
  assert.equal(
    dashboard.rounds[11].critic.status,
    "KINETIC CHAIN FAIL · DENY_PAID_3D_GENERATION",
  );
  assert.equal(dashboard.rounds[11].critic.score, 62);
  assert.equal(
    dashboard.rounds[11].critic.scoreLabel,
    "Composite concept preflight 62/100 · threshold 85 · category floor 5/10",
  );
  assert.equal(
    dashboard.rounds[11].critic.preference,
    "Candidate met benchmark bar in 2/6 blinded comparisons · 5/6 required",
  );
  assert.match(
    dashboard.rounds[11].critic.primaryGap,
    /both scapulae and arms still advance as a quiet paired reach/i,
  );
  assert.deepEqual(dashboard.rounds[11].evidenceLinks, [
    "/captures/P10/round-011-kinetic-chain/NyraKestrel_KineticChain_CRITIC_REJECTED.png",
    "/data/P10-round-011-kinetic-chain.json",
  ]);
  assert.equal(dashboard.rounds[12].pieceId, "P10");
  assert.equal(dashboard.rounds[12].round, 12);
  assert.equal(dashboard.rounds[12].status, "criticized");
  assert.equal(
    dashboard.rounds[12].critic.status,
    "SCAPULAR COUNTERFORCE FAIL · DENY_PAID_3D_GENERATION",
  );
  assert.equal(dashboard.rounds[12].critic.score, 56);
  assert.equal(
    dashboard.rounds[12].critic.scoreLabel,
    "Composite concept preflight 56/100 · threshold 85 · category floor 3/10",
  );
  assert.equal(
    dashboard.rounds[12].critic.preference,
    "Candidate met benchmark bar in 1/6 blinded comparisons · 5/6 required",
  );
  assert.match(
    dashboard.rounds[12].critic.primaryGap,
    /unequal-elbow counterforce topology is absent/i,
  );
  assert.deepEqual(dashboard.rounds[12].evidenceLinks, [
    "/captures/P10/round-012-scapular-counterforce/NyraKestrel_ScapularCounterforce_CRITIC_REJECTED.png",
    "/data/P10-round-012-scapular-counterforce.json",
  ]);
  assert.equal(dashboard.rounds[13].pieceId, "P10");
  assert.equal(dashboard.rounds[13].round, 13);
  assert.equal(dashboard.rounds[13].status, "criticized");
  assert.equal(
    dashboard.rounds[13].critic.status,
    "ELBOW RETURN TRIANGLE FAIL · DENY_PAID_3D_GENERATION",
  );
  assert.equal(dashboard.rounds[13].critic.score, 41);
  assert.equal(
    dashboard.rounds[13].critic.scoreLabel,
    "Composite concept preflight 41/100 · threshold 85 · category floor 1/10",
  );
  assert.equal(
    dashboard.rounds[13].critic.preference,
    "Candidate met benchmark bar in 2/6 blinded comparisons · 5/6 required",
  );
  assert.match(
    dashboard.rounds[13].critic.primaryGap,
    /trailing-arm return topology is absent/i,
  );
  assert.deepEqual(dashboard.rounds[13].evidenceLinks, [
    "/captures/P10/round-013-elbow-return-triangle/NyraKestrel_ElbowReturnTriangle_CRITIC_REJECTED.png",
    "/data/P10-round-013-elbow-return-triangle.json",
  ]);
  assert.equal(dashboard.rounds[14].pieceId, "P10");
  assert.equal(dashboard.rounds[14].round, 14);
  assert.equal(dashboard.rounds[14].status, "criticized");
  assert.equal(
    dashboard.rounds[14].critic.status,
    "TRAILING RETURN WEDGE FAIL · DENY_PAID_3D_GENERATION",
  );
  assert.equal(dashboard.rounds[14].critic.score, 41);
  assert.equal(
    dashboard.rounds[14].critic.scoreLabel,
    "Composite concept preflight 41/100 · threshold 85 · category floor 0/10",
  );
  assert.equal(
    dashboard.rounds[14].critic.preference,
    "Candidate met benchmark bar in 2/6 blinded comparisons · 5/6 required",
  );
  assert.match(
    dashboard.rounds[14].critic.primaryGap,
    /arm-bounded return wedge is absent/i,
  );
  assert.deepEqual(dashboard.rounds[14].evidenceLinks, [
    "/captures/P10/round-014-trailing-return-wedge/NyraKestrel_TrailingReturnWedge_CRITIC_REJECTED.png",
    "/data/P10-round-014-trailing-return-wedge.json",
  ]);
  assert.equal(dashboard.rounds[15].pieceId, "P10");
  assert.equal(dashboard.rounds[15].round, 15);
  assert.equal(dashboard.rounds[15].status, "criticized");
  assert.equal(
    dashboard.rounds[15].critic.status,
    "INWARD RETURN MASK FAIL · DENY_PAID_3D_GENERATION",
  );
  assert.equal(dashboard.rounds[15].critic.score, 40);
  assert.equal(
    dashboard.rounds[15].critic.scoreLabel,
    "Composite concept preflight 40/100 · threshold 85 · category floor 0/10",
  );
  assert.equal(
    dashboard.rounds[15].critic.preference,
    "Candidate met benchmark bar in 2/6 blinded comparisons · 5/6 required",
  );
  assert.match(
    dashboard.rounds[15].critic.primaryGap,
    /two-segment trailing-arm topology is absent/i,
  );
  assert.deepEqual(dashboard.rounds[15].evidenceLinks, [
    "/captures/P10/round-015-inward-return-mask/NyraKestrel_InwardReturnMask_CRITIC_REJECTED.png",
    "/data/P10-round-015-inward-return-mask.json",
  ]);
  assert.equal(dashboard.rounds[16].pieceId, "P10");
  assert.equal(dashboard.rounds[16].round, 16);
  assert.equal(dashboard.rounds[16].status, "criticized");
  assert.equal(
    dashboard.rounds[16].critic.status,
    "TWO-SEGMENT LIMB FAIL · TARGET-MATCHED ENGINE CAPTURE FAIL",
  );
  assert.equal(dashboard.rounds[16].critic.score, 33);
  assert.equal(
    dashboard.rounds[16].critic.scoreLabel,
    "Fresh engine-backed gate 33/100 · threshold 95 · category floor 0/10",
  );
  assert.equal(
    dashboard.rounds[16].critic.preference,
    "Actual Unity evidence preferred in 0/6 blinded comparisons · 5/6 required",
  );
  assert.match(
    dashboard.rounds[16].critic.primaryGap,
    /no connected shoulder-to-elbow-to-grip arm/i,
  );
  assert.deepEqual(dashboard.rounds[16].evidenceLinks, [
    "/captures/P10/round-016-two-segment-limb/NyraKestrel_TwoSegmentLimb_CRITIC_REJECTED.png",
    "/captures/P10/round-016-two-segment-limb/S01_FreshEngineGate_OldAstraVale.png",
    "/captures/P10/round-016-two-segment-limb/Turntable_FreshEngineGate_OldAstraVale.png",
    "/data/P10-round-016-two-segment-limb.json",
  ]);
  assert.equal(dashboard.rounds[17].pieceId, "P10");
  assert.equal(dashboard.rounds[17].round, 17);
  assert.equal(dashboard.rounds[17].status, "criticized");
  assert.equal(dashboard.rounds[17].engineRun, true);
  assert.equal(dashboard.rounds[17].actualGameCapturePerformed, true);
  assert.equal(dashboard.rounds[17].targetMatchedGameCapturePerformed, false);
  assert.equal(dashboard.rounds[17].gateQualifyingCapture, false);
  assert.equal(
    dashboard.rounds[17].critic.status,
    "LOCAL CONSTRAINT RELEASE FAIL · TARGET-MATCHED ENGINE CAPTURE FAIL",
  );
  assert.equal(dashboard.rounds[17].critic.score, 31);
  assert.equal(dashboard.rounds[17].critic.categoryFloor, 0);
  assert.equal(dashboard.rounds[17].critic.candidatePreferredCount, 0);
  assert.equal(dashboard.rounds[17].critic.comparisonCount, 6);
  assert.equal(dashboard.rounds[17].critic.requiredCandidatePreferredCount, 5);
  assert.equal(
    dashboard.rounds[17].critic.scoreLabel,
    "Fresh engine-backed gate 31/100 · threshold 95 · category floor 0/10",
  );
  assert.equal(
    dashboard.rounds[17].critic.preference,
    "Actual Unity evidence preferred in 0/6 blinded comparisons · 5/6 required",
  );
  assert.equal(
    dashboard.rounds[17].critic.primaryGap,
    "The trailing limb is a fused, colossal third-leg/shield mass with a punched-through hand and no readable interior wedge, so it destroys anatomy, grip depth, the rear leg, and the gameplay silhouette in one dominant defect.",
  );
  assert.deepEqual(dashboard.rounds[17].evidenceLinks, [
    "/captures/P10/round-017-local-constraint-release/NyraKestrel_LocalConstraintRelease_CRITIC_REJECTED.png",
    "/captures/P10/round-017-local-constraint-release/P10_Round017_JudgePanel.png",
    "/data/P10-round-017-local-constraint-release.json",
  ]);
  const p30Round001 = dashboard.rounds[18];
  assert.equal(p30Round001.pieceId, "P30");
  assert.equal(p30Round001.round, 1);
  assert.equal(p30Round001.date, "2026-08-01");
  assert.equal(p30Round001.status, "criticized");
  assert.equal(p30Round001.engineRun, true);
  assert.equal(p30Round001.actualGameCapturePerformed, true);
  assert.equal(p30Round001.targetMatchedGameCapturePerformed, true);
  assert.equal(p30Round001.gateQualifyingCapture, false);
  assert.equal(p30Round001.critic.score, 28);
  assert.equal(p30Round001.critic.categoryFloor, 1);
  assert.equal(p30Round001.critic.candidatePreferredCount, 0);
  assert.equal(p30Round001.critic.comparisonCount, 6);
  assert.match(p30Round001.critic.status, /rejected foundation evidence/i);
  assert.match(p30Round001.critic.status, /not AAA acceptance/i);
  assert.match(
    p30Round001.critic.primaryGap,
    /^prototype_grade_presentation_layer:/,
  );
  assert.deepEqual(p30Round001.evidenceLinks, [
    "/captures/P30/round-001/S01.png",
    "/captures/P30/round-001/S02.png",
    "/captures/P30/round-001/S04.png",
    "/data/P30-round-001.json",
  ]);
  const p30Round002 = dashboard.rounds[19];
  assert.equal(p30Round002.pieceId, "P30");
  assert.equal(p30Round002.round, 2);
  assert.equal(p30Round002.status, "criticized");
  assert.equal(p30Round002.gateQualifyingCapture, false);
  assert.equal(p30Round002.critic.score, 25);
  assert.equal(p30Round002.critic.candidatePreferredCount, 0);
  assert.equal(p30Round002.critic.comparisonCount, 6);
  assert.match(p30Round002.critic.status, /reject/i);
  assert.match(p30Round002.critic.status, /not accepted/i);
  assert.match(
    p30Round002.critic.primaryGap,
    /^cohesive_aaa_combat_presentation:/,
  );
  assert.deepEqual(p30Round002.evidenceLinks, [
    "/captures/P30/round-002/S02.png",
    "/captures/P30/round-002/S04.png",
    "/captures/P30/round-002/S06.png",
    "/data/P30-round-002.json",
  ]);
  const p30Round003 = dashboard.rounds[20];
  assert.equal(p30Round003.pieceId, "P30");
  assert.equal(p30Round003.round, 3);
  assert.equal(p30Round003.date, "2026-08-02");
  assert.equal(p30Round003.status, "criticized");
  assert.equal(p30Round003.engineRun, true);
  assert.equal(p30Round003.actualGameCapturePerformed, true);
  assert.equal(p30Round003.targetMatchedGameCapturePerformed, true);
  assert.equal(p30Round003.gateQualifyingCapture, false);
  assert.match(p30Round003.builderBrief, /environment, materials, lighting, and staging/i);
  assert.match(p30Round003.builderBrief, /Poly Haven fort and statue/i);
  assert.match(p30Round003.builderBrief, /shared PBR/i);
  assert.match(p30Round003.builderBrief, /deterministic light rig/i);
  assert.match(p30Round003.builderBrief, /freeze the hero, Hollow, claymore, CharacterViews, and CombatFx/i);
  assert.equal(p30Round003.critic.score, 30);
  assert.equal(p30Round003.critic.candidatePreferredCount, 0);
  assert.equal(p30Round003.critic.comparisonCount, 6);
  assert.match(p30Round003.critic.status, /reject/i);
  assert.match(p30Round003.critic.status, /not accepted/i);
  assert.deepEqual(p30Round003.categoryScores, {
    compositionCamera: 3,
    characterAnimation: 2,
    environmentMaterialsLighting: 4,
    combatReadabilityImpact: 2,
    technical: 5,
    aaaFinish: 2,
  });
  assert.match(p30Round003.critic.preference, /0\/6 aggregate blind comparisons/i);
  assert.match(p30Round003.critic.preference, /all six outcomes overwhelming/i);
  assert.match(
    p30Round003.critic.primaryGap,
    /^character_combat_fidelity:/,
  );
  assert.deepEqual(p30Round003.evidenceLinks, [
    "/captures/P30/round-003/S02.png",
    "/captures/P30/round-003/S04.png",
    "/captures/P30/round-003/S06.png",
    "/data/P30-round-003.json",
  ]);
  const p30Round004 = dashboard.rounds[21];
  assert.equal(p30Round004.pieceId, "P30");
  assert.equal(p30Round004.round, 4);
  assert.equal(p30Round004.date, "2026-08-02");
  assert.equal(p30Round004.status, "criticized");
  assert.equal(p30Round004.engineRun, true);
  assert.equal(p30Round004.actualGameCapturePerformed, true);
  assert.equal(p30Round004.targetMatchedGameCapturePerformed, true);
  assert.equal(p30Round004.gateQualifyingCapture, false);
  assert.match(p30Round004.builderBrief, /authored Nyra, Hollow, and Stormcage assets/i);
  assert.match(p30Round004.builderBrief, /environment, camera, HUD, controls, simulation, physics, seed, telemetry, and review contracts/i);
  assert.equal(p30Round004.critic.score, 34);
  assert.equal(p30Round004.critic.focusedCandidatePreferredCount, 0);
  assert.equal(p30Round004.critic.focusedComparisonCount, 3);
  assert.equal(p30Round004.critic.candidatePreferredCount, 0);
  assert.equal(p30Round004.critic.comparisonCount, 6);
  assert.match(p30Round004.critic.status, /reject/i);
  assert.match(p30Round004.critic.status, /not accepted/i);
  assert.deepEqual(p30Round004.categoryScores, {
    characterAnatomySilhouette: 3,
    skinHairClothArmorMaterialFidelity: 2,
    enemyZombieThreatFidelity: 2,
    weaponQualityHandContactReadability: 3,
    animationPosingWeightContact: 2,
    combatVfxImpactPhysicsReadability: 3,
    cameraFramingComposition: 3,
    environmentLightingIntegration: 5,
    uiCinematicCoherence: 5,
    runtimePolishStabilityPerformance: 6,
  });
  assert.match(p30Round004.critic.preference, /0\/3 focused and 0\/6 aggregate blind comparisons/i);
  assert.match(p30Round004.critic.preference, /none was close/i);
  assert.match(
    p30Round004.critic.primaryGap,
    /^combat-character-contact-package:/,
  );
  assert.deepEqual(p30Round004.evidenceLinks, [
    "/captures/P30/round-004/S03.png",
    "/captures/P30/round-004/S04.png",
    "/captures/P30/round-004/S05.png",
    "/data/P30-round-004.json",
  ]);
  const p30Round005 = dashboard.rounds[22];
  assert.equal(p30Round005.pieceId, "P30");
  assert.equal(p30Round005.round, 5);
  assert.equal(p30Round005.status, "criticized");
  assert.equal(p30Round005.gateQualifyingCapture, false);
  assert.equal(p30Round005.critic.score, 23);
  assert.equal(p30Round005.critic.focusedCandidatePreferredCount, 0);
  assert.equal(p30Round005.critic.focusedComparisonCount, 3);
  assert.equal(p30Round005.critic.candidatePreferredCount, 0);
  assert.equal(p30Round005.critic.comparisonCount, 6);
  assert.match(
    p30Round005.critic.primaryGap,
    /^authored duel-contact pose-and-material coherence:/,
  );
  assert.deepEqual(p30Round005.evidenceLinks, [
    "/captures/P30/round-005/S03.png",
    "/captures/P30/round-005/S04.png",
    "/captures/P30/round-005/S05.png",
    "/data/P30-round-005.json",
  ]);
  const p30Round006 = dashboard.rounds[23];
  assert.equal(p30Round006.pieceId, "P30");
  assert.equal(p30Round006.round, 6);
  assert.equal(p30Round006.status, "criticized");
  assert.equal(p30Round006.gateQualifyingCapture, false);
  assert.equal(
    p30Round006.critic.status,
    "REJECT · FRESH INDEPENDENT CRITIC COMPLETE",
  );
  assert.equal(p30Round006.critic.score, 23);
  assert.equal(p30Round006.critic.focusedCandidatePreferredCount, 0);
  assert.equal(p30Round006.critic.focusedComparisonCount, 3);
  assert.equal(p30Round006.critic.candidatePreferredCount, 0);
  assert.equal(p30Round006.critic.comparisonCount, 6);
  assert.match(p30Round006.critic.scoreLabel, /23\/100 · focused 0\/3 · overall 0\/6/i);
  assert.match(p30Round006.critic.preference, /0\/3 focused and 0\/6 aggregate/i);
  assert.match(p30Round006.critic.primaryGap, /^combat camera presentation:/i);
  assert.deepEqual(p30Round006.evidenceLinks, [
    "/captures/P30/round-006/S03.png",
    "/captures/P30/round-006/S04.png",
    "/captures/P30/round-006/S05.png",
    "/data/P30-round-006.json",
  ]);
  const p30Round007 = dashboard.rounds[24];
  assert.equal(p30Round007.pieceId, "P30");
  assert.equal(p30Round007.round, 7);
  assert.equal(p30Round007.status, "criticized");
  assert.equal(p30Round007.gateQualifyingCapture, false);
  assert.equal(
    p30Round007.critic.status,
    "REJECT · FRESH INDEPENDENT CRITIC COMPLETE",
  );
  assert.equal(p30Round007.critic.score, 34);
  assert.equal(p30Round007.critic.focusedCandidatePreferredCount, 0);
  assert.equal(p30Round007.critic.focusedComparisonCount, 3);
  assert.equal(p30Round007.critic.candidatePreferredCount, 0);
  assert.equal(p30Round007.critic.comparisonCount, 6);
  assert.equal(p30Round007.critic.categoriesAtLeastNine, 0);
  assert.equal(p30Round007.critic.categoryCount, 10);
  assert.match(
    p30Round007.critic.scoreLabel,
    /34\/100 · focused 0\/3 · overall 0\/6/i,
  );
  assert.match(
    p30Round007.critic.preference,
    /0\/3 focused and 0\/6 aggregate/i,
  );
  assert.match(p30Round007.critic.primaryGap, /^combat FX language:/i);
  assert.deepEqual(p30Round007.evidenceLinks, [
    "/captures/P30/round-007/S03.png",
    "/captures/P30/round-007/S04.png",
    "/captures/P30/round-007/S05.png",
    "/data/P30-round-007.json",
  ]);
  const p30Round008 = dashboard.rounds[25];
  assert.equal(p30Round008.pieceId, "P30");
  assert.equal(p30Round008.round, 8);
  assert.equal(p30Round008.status, "review-ready");
  assert.equal(p30Round008.engineRun, true);
  assert.equal(p30Round008.actualGameCapturePerformed, true);
  assert.equal(p30Round008.gateQualifyingCapture, false);
  assert.equal(
    p30Round008.critic.status,
    "PENDING · FRESH INDEPENDENT CRITIC RUNNING",
  );
  assert.equal(p30Round008.critic.score, null);
  assert.equal(p30Round008.critic.focusedCandidatePreferredCount, null);
  assert.equal(p30Round008.critic.focusedComparisonCount, 3);
  assert.equal(p30Round008.critic.candidatePreferredCount, null);
  assert.equal(p30Round008.critic.comparisonCount, 6);
  assert.equal(p30Round008.critic.categoriesAtLeastNine, null);
  assert.equal(p30Round008.critic.categoryCount, 10);
  assert.equal(p30Round008.critic.primaryGap, null);
  assert.deepEqual(p30Round008.evidenceLinks, [
    "/captures/P30/round-008/S03.png",
    "/captures/P30/round-008/S04.png",
    "/captures/P30/round-008/S05.png",
    "/data/P30-round-008.json",
  ]);
});

test("P10 history remains filed while the global latest manifest stays P00-pinned", async () => {
  const [
    dashboard,
    p00Manifest,
    p10Manifest,
    p10Round002Preflight,
    p10Round003Preflight,
    p10Round004Preflight,
    p10Round005Preflight,
    p10Round006Concept,
    p10Round007Concept,
    p10Round008Contact,
    p10Round009MythicForce,
    p10Round010GroundArc,
    p10Round011KineticChain,
    p10Round012ScapularCounterforce,
    p10Round013ElbowReturnTriangle,
    p10Round014TrailingReturnWedge,
    p10Round015InwardReturnMask,
    p10Round016TwoSegmentLimb,
    latestManifest,
    p10Screenshot,
    round002Neutral,
    round002CombatFailure,
    round003Front,
    round003GripFailure,
    round003Combat,
    round004Front,
    round004GripFailure,
    round004CombatFailure,
    round005Front,
    round005Face,
    round005Grip,
    round005Combat,
    round006Turnaround,
    round006Weapon,
    round006Grip,
    round007Turnaround,
    round007Weapon,
    round007RejectedGrip,
    round008AcceptedContact,
    round009RejectedMythicForce,
    round010RejectedGroundArc,
    round011RejectedKineticChain,
    round012RejectedScapularCounterforce,
    round013RejectedElbowReturnTriangle,
    round014RejectedTrailingReturnWedge,
    round015RejectedInwardReturnMask,
    round016RejectedTwoSegmentLimb,
    round016FreshEngineS01,
    round016FreshEngineTurntable,
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
      new URL("../public/data/P10-round-005-preflight.json", import.meta.url),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL("../public/data/P10-round-006-concept.json", import.meta.url),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL("../public/data/P10-round-007-concept.json", import.meta.url),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL("../public/data/P10-round-008-contact.json", import.meta.url),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL("../public/data/P10-round-009-mythic-force.json", import.meta.url),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL("../public/data/P10-round-010-ground-arc.json", import.meta.url),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL("../public/data/P10-round-011-kinetic-chain.json", import.meta.url),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL(
        "../public/data/P10-round-012-scapular-counterforce.json",
        import.meta.url,
      ),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL(
        "../public/data/P10-round-013-elbow-return-triangle.json",
        import.meta.url,
      ),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL(
        "../public/data/P10-round-014-trailing-return-wedge.json",
        import.meta.url,
      ),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL(
        "../public/data/P10-round-015-inward-return-mask.json",
        import.meta.url,
      ),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL(
        "../public/data/P10-round-016-two-segment-limb.json",
        import.meta.url,
      ),
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
    readFile(
      new URL(
        "../public/captures/P10/round-005-preflight/Front_Decisive.png",
        import.meta.url,
      ),
    ),
    readFile(
      new URL(
        "../public/captures/P10/round-005-preflight/Face_Diagnostic.png",
        import.meta.url,
      ),
    ),
    readFile(
      new URL(
        "../public/captures/P10/round-005-preflight/Grip_Diagnostic.png",
        import.meta.url,
      ),
    ),
    readFile(
      new URL(
        "../public/captures/P10/round-005-preflight/Combat_Decisive.png",
        import.meta.url,
      ),
    ),
    readFile(
      new URL(
        "../public/captures/P10/round-006-concept/NyraKestrel_Turnaround.png",
        import.meta.url,
      ),
    ),
    readFile(
      new URL(
        "../public/captures/P10/round-006-concept/StormglassOdachi.png",
        import.meta.url,
      ),
    ),
    readFile(
      new URL(
        "../public/captures/P10/round-006-concept/NyraKestrel_CombatGrip.png",
        import.meta.url,
      ),
    ),
    readFile(
      new URL(
        "../public/captures/P10/round-007-concept/NyraKestrel_Turnaround_ACCEPTED.png",
        import.meta.url,
      ),
    ),
    readFile(
      new URL(
        "../public/captures/P10/round-007-concept/StormcageOdachi_ACCEPTED.png",
        import.meta.url,
      ),
    ),
    readFile(
      new URL(
        "../public/captures/P10/round-007-concept/NyraKestrel_CombatGrip_Revision02_REJECTED.png",
        import.meta.url,
      ),
    ),
    readFile(
      new URL(
        "../public/captures/P10/round-008-contact/NyraKestrel_CombatGrip_FRESH_CRITIC_ACCEPTED.png",
        import.meta.url,
      ),
    ),
    readFile(
      new URL(
        "../public/captures/P10/round-009-mythic-force/NyraKestrel_MythicForce_CRITIC_REJECTED.png",
        import.meta.url,
      ),
    ),
    readFile(
      new URL(
        "../public/captures/P10/round-010-ground-arc/NyraKestrel_GroundArcArrest_CRITIC_REJECTED.png",
        import.meta.url,
      ),
    ),
    readFile(
      new URL(
        "../public/captures/P10/round-011-kinetic-chain/NyraKestrel_KineticChain_CRITIC_REJECTED.png",
        import.meta.url,
      ),
    ),
    readFile(
      new URL(
        "../public/captures/P10/round-012-scapular-counterforce/NyraKestrel_ScapularCounterforce_CRITIC_REJECTED.png",
        import.meta.url,
      ),
    ),
    readFile(
      new URL(
        "../public/captures/P10/round-013-elbow-return-triangle/NyraKestrel_ElbowReturnTriangle_CRITIC_REJECTED.png",
        import.meta.url,
      ),
    ),
    readFile(
      new URL(
        "../public/captures/P10/round-014-trailing-return-wedge/NyraKestrel_TrailingReturnWedge_CRITIC_REJECTED.png",
        import.meta.url,
      ),
    ),
    readFile(
      new URL(
        "../public/captures/P10/round-015-inward-return-mask/NyraKestrel_InwardReturnMask_CRITIC_REJECTED.png",
        import.meta.url,
      ),
    ),
    readFile(
      new URL(
        "../public/captures/P10/round-016-two-segment-limb/NyraKestrel_TwoSegmentLimb_CRITIC_REJECTED.png",
        import.meta.url,
      ),
    ),
    readFile(
      new URL(
        "../public/captures/P10/round-016-two-segment-limb/S01_FreshEngineGate_OldAstraVale.png",
        import.meta.url,
      ),
    ),
    readFile(
      new URL(
        "../public/captures/P10/round-016-two-segment-limb/Turntable_FreshEngineGate_OldAstraVale.png",
        import.meta.url,
      ),
    ),
  ]);
  const fingerprint = dashboard.activeBuild.evidenceFingerprint;
  const screenshotHash = createHash("sha256")
    .update(p10Screenshot)
    .digest("hex");
  const freshEngineTurntableHash = createHash("sha256")
    .update(round016FreshEngineTurntable)
    .digest("hex");

  assert.deepEqual(latestManifest, p00Manifest);
  assert.equal(latestManifest.piece, "P00");
  assert.equal(p10Manifest.piece, "P10");
  assert.equal(p10Manifest.round, 1);
  assert.equal(p10Manifest.preset, "S01_Explore");
  assert.deepEqual(p10Manifest.resolution, { width: 1600, height: 900 });
  assert.equal(
    p10Manifest.screenshotRelativePath,
    "captures/P10/round-001/S01_Explore.png",
  );
  assert.equal(screenshotHash, p10Manifest.screenshotSha256);
  assert.equal(
    freshEngineTurntableHash,
    "4e60630527970c3c628c8bd53d7fdaf7fbeb0f07ee33003b98f7f50a8c8d79e9",
  );
  assert.equal(
    dashboard.activeBuild.evidenceBundle.manifestPath,
    "/data/P30-round-008.json",
  );
  assert.equal(
    dashboard.activeBuild.evidenceBundle.s01.path,
    "/captures/P30/round-008/S03.png",
  );
  assert.equal(
    dashboard.activeBuild.evidenceBundle.diagnostic.path,
    "/captures/P30/round-008/S04.png",
  );
  assert.equal(
    "S03 startup · selected candidate · FX absent",
    dashboard.activeBuild.evidenceBundle.s01.label,
  );
  assert.equal(
    "S04 active hit · selected candidate · verdict pending",
    dashboard.activeBuild.evidenceBundle.diagnostic.label,
  );
  assert.equal(
    dashboard.activeBuild.evidenceBundle.status,
    "INDEPENDENT CRITIC RUNNING · NOT ACCEPTED",
  );
  assert.equal(
    dashboard.activeBuild.evidenceBundle.s01.sha256,
    "5c8398ae257f73e779d60c26d0e3c07399b9f82e77067f4bf4cd111544c598e1",
  );
  assert.equal(
    dashboard.activeBuild.evidenceBundle.diagnostic.sha256,
    "c8c2ba2df5296bf92e9b64a173e4f9c364c6e432bfec8250de05b5f2b8296ce5",
  );
  assert.equal(
    fingerprint.auditContext,
    "Root-selected Round008 candidate frozen · independent critic running",
  );
  assert.equal(fingerprint.browser, "Google Chrome 150");
  assert.match(fingerprint.graphics, /ANGLE Metal Renderer: Apple M2/);
  assert.equal(fingerprint.headed, true);
  assert.equal(fingerprint.hardwareAccelerated, true);
  assert.equal(fingerprint.resolution, "1600×900");
  assert.equal(fingerprint.deviceScaleFactor, 1);
  assert.equal("query" in fingerprint, false);
  assert.equal("seed" in fingerprint, false);
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
  assert.equal(p10Round005Preflight.piece, "P10");
  assert.equal(p10Round005Preflight.round, 5);
  assert.equal(p10Round005Preflight.status, "rejected-pre-unity");
  assert.equal(p10Round005Preflight.engineRun, false);
  assert.equal(p10Round005Preflight.actualGameCapturePerformed, false);
  assert.equal(p10Round005Preflight.unityCaptureFiled, false);
  assert.equal(p10Round005Preflight.goAttestationFiled, false);
  assert.equal(p10Round005Preflight.visualReview.score, 6);
  assert.equal(p10Round005Preflight.visualReview.maximum, 13);
  assert.equal(p10Round005Preflight.visualReview.mandatoryPasses, 4);
  assert.equal(p10Round005Preflight.visualReview.mandatoryMaximum, 8);
  assert.equal(p10Round005Preflight.visualReview.verdict, "NO-GO");
  assert.equal(p10Round005Preflight.visualReview.unityDisposition, "LOCKED");
  assert.equal(p10Round005Preflight.visualReview.candidatePreferredCount, 0);
  assert.equal(p10Round005Preflight.visualReview.benchmarkPreferredCount, 7);
  assert.equal(p10Round005Preflight.visualReview.blindComparisonCount, 7);
  assert.match(
    p10Round005Preflight.visualReview.singleBiggestGap,
    /licensed Einar civilian mechanic in workwear/i,
  );
  assert.equal(
    p10Round005Preflight.source.requiredCredit,
    "Einar Rig (CC-BY) Blender Foundation | studio.blender.org",
  );
  assert.equal(
    p10Round005Preflight.source.reviewSha256,
    "8908f058b99d4107d7996e22070cc886b898e473d0388fb4a77e2654ca8ebd06",
  );
  assert.equal(
    p10Round005Preflight.source.auditSha256,
    "51901339a376bea219512fc7c378e2c206243e70878e82cbdae3ac9131d2b0d9",
  );
  assert.equal(
    p10Round005Preflight.source.cleanImportReportSha256,
    "54c8716c7f91e932752d60c460921a8a6bda0838e770eab304adfefe5adb0a10",
  );
  assert.equal(
    p10Round005Preflight.source.reimportDiagnosticSha256,
    "708f105b3c02119b440d5139c7ae12279e50ff29acbe703a2815f3a050f76f07",
  );
  assert.equal(
    p10Round005Preflight.mechanicalValidation.result,
    "semantic-and-byte-idempotence-pass",
  );
  assert.equal(p10Round005Preflight.mechanicalValidation.cleanStaticImports, "4/4");
  assert.equal(
    p10Round005Preflight.mechanicalValidation.allCleanStaticImportsPass,
    true,
  );
  assert.deepEqual(p10Round005Preflight.mechanicalValidation.triangles, {
    combat: 85096,
    lod0: 85096,
    lod1: 47615,
    lod2: 25484,
  });
  assert.equal(
    p10Round005Preflight.mechanicalValidation.texturePortabilitySupported,
    false,
  );
  assert.equal(
    p10Round005Preflight.mechanicalValidation.freshReimportMaterialParity,
    false,
  );
  assert.equal(
    p10Round005Preflight.mechanicalValidation.byteIdempotent,
    true,
  );
  assert.equal(
    p10Round005Preflight.mechanicalValidation.byteIdempotenceStatus,
    "PASS",
  );
  assert.deepEqual(
    p10Round005Preflight.mechanicalValidation.postValidatorHashes,
    {
      auditSha256:
        "51901339a376bea219512fc7c378e2c206243e70878e82cbdae3ac9131d2b0d9",
      cleanImportReportSha256:
        "54c8716c7f91e932752d60c460921a8a6bda0838e770eab304adfefe5adb0a10",
      diagnosticRenderSha256:
        "708f105b3c02119b440d5139c7ae12279e50ff29acbe703a2815f3a050f76f07",
    },
  );
  assert.equal(p10Round005Preflight.integrityFindings.sourceFilesVerified, 64);
  assert.equal(p10Round005Preflight.integrityFindings.releaseSanitization, "PASS");
  assert.equal(p10Round005Preflight.integrityFindings.privacyAudit, "PASS");
  assert.equal(p10Round005Preflight.integrityFindings.visualPayloadPreserved, true);
  assert.equal(
    p10Round005Preflight.integrityFindings.validatorByteIdempotence,
    "PASS",
  );
  assert.equal(p10Round005Preflight.nextRound.round, 6);
  assert.equal(p10Round005Preflight.nextRound.status, "source-pipeline-triage");
  assert.doesNotMatch(
    JSON.stringify(p10Round005Preflight),
    /Reference\.zip|Reference\/[^"']+\.(?:png|jpe?g|webp)/i,
  );

  const round005Images = [
    round005Front,
    round005Face,
    round005Grip,
    round005Combat,
  ];
  assert.deepEqual(
    p10Round005Preflight.diagnostics.map((diagnostic) => diagnostic.publicPath),
    [
      "/captures/P10/round-005-preflight/Front_Decisive.png",
      "/captures/P10/round-005-preflight/Face_Diagnostic.png",
      "/captures/P10/round-005-preflight/Grip_Diagnostic.png",
      "/captures/P10/round-005-preflight/Combat_Decisive.png",
    ],
  );
  for (const [index, image] of round005Images.entries()) {
    assert.equal(
      createHash("sha256").update(image).digest("hex"),
      p10Round005Preflight.diagnostics[index].sha256,
    );
    assert.equal(image.subarray(1, 4).toString("ascii"), "PNG");
    assert.equal(image.readUInt32BE(16), 1600);
    assert.equal(image.readUInt32BE(20), 1600);
  }

  assert.equal(p10Round006Concept.piece, "P10");
  assert.equal(p10Round006Concept.round, 6);
  assert.equal(p10Round006Concept.status, "rejected-concept-preflight");
  assert.equal(p10Round006Concept.artifactClass, "original 2D concept art");
  assert.equal(p10Round006Concept.engineRun, false);
  assert.equal(p10Round006Concept.actualGameCapturePerformed, false);
  assert.equal(p10Round006Concept.unityCaptureFiled, false);
  assert.equal(p10Round006Concept.threeDimensionalAssetFiled, false);
  assert.equal(p10Round006Concept.gameReadyEvidenceFiled, false);
  assert.equal(p10Round006Concept.paid3DGenerationAuthorized, false);
  assert.equal(p10Round006Concept.source.referencePixelsSuppliedToGeneration, false);
  assert.equal(
    p10Round006Concept.source.receiptSha256,
    "0914db7e7dcf12a44a0fcf944b581a49370ef9b7a9c122555c2147779dac65a6",
  );
  assert.equal(
    p10Round006Concept.source.reviewSha256,
    "f80e5864495b50c312dd375b1ec9eb41e152d73386ec5e661e254c4bb94ed7a4",
  );
  assert.equal(p10Round006Concept.visualReview.score, 55);
  assert.equal(p10Round006Concept.visualReview.maximum, 100);
  assert.equal(p10Round006Concept.visualReview.passThreshold, 85);
  assert.equal(p10Round006Concept.visualReview.criticalFloorPerCategory, 7);
  assert.equal(p10Round006Concept.visualReview.thresholdResult, "FAIL");
  assert.equal(p10Round006Concept.visualReview.criticalFloorResult, "FAIL");
  assert.equal(p10Round006Concept.visualReview.verdict, "NO-GO");
  assert.equal(p10Round006Concept.visualReview.comparisonCount, 6);
  assert.equal(p10Round006Concept.visualReview.candidateMetBenchmarkBarCount, 0);
  assert.equal(p10Round006Concept.visualReview.candidateBelowBenchmarkBarCount, 6);
  assert.match(
    p10Round006Concept.visualReview.singleBiggestGap,
    /unique, function-led visual thesis/i,
  );
  assert.equal(p10Round006Concept.decision.paid3DGenerationAuthorized, false);
  assert.equal(p10Round006Concept.nextRound.round, 7);
  assert.equal(p10Round006Concept.nextRound.status, "identity-redesign");
  assert.deepEqual(p10Round006Concept.nextRound.gate, {
    minimumTotalScore: 85,
    minimumScorePerCategory: 7,
    blindComparisonCount: 6,
    minimumComparisonsMeetingBenchmarkBar: 5,
    paid3DGenerationRequiresFullPass: true,
  });
  assert.match(p10Round006Concept.nextRound.target, /at least 85\/100/i);
  assert.match(p10Round006Concept.nextRound.target, /at or above 7/i);
  assert.match(p10Round006Concept.nextRound.target, /at least 5 of 6/i);
  assert.deepEqual(
    p10Round006Concept.conceptArt.map((artifact) => artifact.publicPath),
    [
      "/captures/P10/round-006-concept/NyraKestrel_Turnaround.png",
      "/captures/P10/round-006-concept/StormglassOdachi.png",
      "/captures/P10/round-006-concept/NyraKestrel_CombatGrip.png",
    ],
  );
  assert.ok(
    p10Round006Concept.conceptArt.every(
      (artifact) =>
        artifact.evidenceType ===
          "2D concept art — not gameplay, 3D, or game-ready evidence" &&
        artifact.dimensions.width === 1536 &&
        artifact.dimensions.height === 1024 &&
        artifact.format === "PNG",
    ),
  );
  const round006Images = [
    round006Turnaround,
    round006Weapon,
    round006Grip,
  ];
  for (const [index, image] of round006Images.entries()) {
    assert.equal(
      createHash("sha256").update(image).digest("hex"),
      p10Round006Concept.conceptArt[index].sha256,
    );
    assert.equal(image.subarray(1, 4).toString("ascii"), "PNG");
    assert.equal(image.readUInt32BE(16), 1536);
    assert.equal(image.readUInt32BE(20), 1024);
  }
  assert.doesNotMatch(
    JSON.stringify(p10Round006Concept),
    /Reference\.zip|Reference\/[^"']+\.(?:png|jpe?g|webp)|\/Users\/|\/home\/|[A-Za-z]:\\Users\\|\/tmp\/|\/private\/var\/folders\//i,
  );

  assert.equal(p10Round007Concept.piece, "P10");
  assert.equal(p10Round007Concept.round, 7);
  assert.equal(p10Round007Concept.status, "rejected-concept-preflight");
  assert.equal(p10Round007Concept.artifactClass, "original 2D concept art");
  assert.equal(p10Round007Concept.engineRun, false);
  assert.equal(p10Round007Concept.actualGameCapturePerformed, false);
  assert.equal(p10Round007Concept.unityCaptureFiled, false);
  assert.equal(p10Round007Concept.threeDimensionalAssetFiled, false);
  assert.equal(p10Round007Concept.gameReadyEvidenceFiled, false);
  assert.equal(p10Round007Concept.acceptedCombatGripFiled, false);
  assert.equal(p10Round007Concept.paid3DGenerationAuthorized, false);
  assert.equal(p10Round007Concept.source.referencePixelsSuppliedToGeneration, false);
  assert.equal(
    p10Round007Concept.source.receiptSha256,
    "1ed2cf94707f977ec7486cda080adfc919ca61deaafc673599efbbb4dccb6fb0",
  );
  assert.equal(
    p10Round007Concept.source.readmeSha256,
    "967e748665fdb595232ba329f89bafc6dc643dcb2ddfc245f031dc3d1c7cc396",
  );
  assert.equal(
    p10Round007Concept.source.reviewSha256,
    "a765d3523d730caa99424f76cf4891068d71c4c35a154259407da16d2af4d24b",
  );
  assert.equal(p10Round007Concept.visualReview.score, 62);
  assert.equal(p10Round007Concept.visualReview.maximum, 100);
  assert.equal(p10Round007Concept.visualReview.passThreshold, 85);
  assert.equal(p10Round007Concept.visualReview.criticalFloorPerCategory, 7);
  assert.equal(p10Round007Concept.visualReview.observedMinimumCategoryScore, 2);
  assert.equal(p10Round007Concept.visualReview.thresholdResult, "FAIL");
  assert.equal(p10Round007Concept.visualReview.criticalFloorResult, "FAIL");
  assert.equal(
    p10Round007Concept.visualReview.verdict,
    "DENY_PAID_3D_GENERATION",
  );
  assert.equal(p10Round007Concept.visualReview.comparisonCount, 6);
  assert.equal(p10Round007Concept.visualReview.candidateMetBenchmarkBarCount, 2);
  assert.equal(p10Round007Concept.visualReview.candidateBelowBenchmarkBarCount, 4);
  assert.equal(
    p10Round007Concept.visualReview.requiredCandidateMetBenchmarkBarCount,
    5,
  );
  assert.equal(p10Round007Concept.visualReview.benchmarkGateResult, "FAIL");
  assert.match(
    p10Round007Concept.visualReview.singleBiggestGap,
    /both complete hands closed on separated regions of the same hilt/i,
  );
  assert.equal(
    p10Round007Concept.decision.result,
    "DENY_PAID_3D_GENERATION",
  );
  assert.equal(p10Round007Concept.decision.paid3DGenerationAuthorized, false);
  assert.equal(p10Round007Concept.nextRound.round, 8);
  assert.equal(
    p10Round007Concept.nextRound.status,
    "identity-preserving-two-hand-contact-proof",
  );
  assert.match(p10Round007Concept.nextRound.target, /induction yoke/i);
  assert.match(p10Round007Concept.nextRound.target, /both complete hands closed/i);
  assert.deepEqual(p10Round007Concept.nextRound.compositePackGate, {
    minimumTotalScore: 85,
    minimumScorePerCategory: 7,
    blindComparisonCount: 6,
    minimumComparisonsMeetingBenchmarkBar: 5,
    paid3DGenerationRequiresFullPass: true,
  });
  assert.deepEqual(
    p10Round007Concept.conceptArt.map((artifact) => artifact.publicPath),
    [
      "/captures/P10/round-007-concept/NyraKestrel_Turnaround_ACCEPTED.png",
      "/captures/P10/round-007-concept/StormcageOdachi_ACCEPTED.png",
      "/captures/P10/round-007-concept/NyraKestrel_CombatGrip_Revision02_REJECTED.png",
    ],
  );
  assert.deepEqual(
    p10Round007Concept.conceptArt.map((artifact) => artifact.disposition),
    [
      "accepted-round-asset",
      "accepted-round-asset",
      "rejected-failure-evidence-only",
    ],
  );
  assert.match(p10Round007Concept.conceptArt[2].label, /^REJECTED/);
  assert.match(
    p10Round007Concept.conceptArt[2].failure,
    /trailing hand grips a separate copper element/i,
  );
  assert.deepEqual(
    p10Round007Concept.rejectedGripIterations.map((iteration) => iteration.sha256),
    [
      "a21a9c24e713ebec62290cebfc75abe4088a80fe87f7e0c53cf5b4fc3b7710ae",
      "bfeaf5acadfff5fe960d5ce0d4abc24cc061448c763010c44a197eda62eceae4",
      "79535d7d7ec1d0959ad2c039d2594ad687e39ebeb52edf066a716dece21a0cc3",
    ],
  );
  const round007Images = [
    round007Turnaround,
    round007Weapon,
    round007RejectedGrip,
  ];
  for (const [index, image] of round007Images.entries()) {
    assert.equal(
      createHash("sha256").update(image).digest("hex"),
      p10Round007Concept.conceptArt[index].sha256,
    );
    assert.equal(image.subarray(1, 4).toString("ascii"), "PNG");
    assert.equal(image.readUInt32BE(16), 1536);
    assert.equal(image.readUInt32BE(20), 1024);
  }
  assert.doesNotMatch(
    JSON.stringify(p10Round007Concept),
    /Reference\.zip|Reference\/[^"']+\.(?:png|jpe?g|webp)|\/Users\/|\/home\/|[A-Za-z]:\\Users\\|\/tmp\/|\/private\/var\/folders\//i,
  );

  assert.equal(p10Round008Contact.piece, "P10");
  assert.equal(p10Round008Contact.round, 8);
  assert.equal(
    p10Round008Contact.status,
    "contact-passed-composite-rejected",
  );
  assert.equal(
    p10Round008Contact.artifactClass,
    "original 2D combat-contact concept art",
  );
  assert.equal(p10Round008Contact.engineRun, false);
  assert.equal(p10Round008Contact.actualGameCapturePerformed, false);
  assert.equal(p10Round008Contact.unityCaptureFiled, false);
  assert.equal(p10Round008Contact.threeDimensionalAssetFiled, false);
  assert.equal(p10Round008Contact.gameReadyEvidenceFiled, false);
  assert.equal(p10Round008Contact.acceptedContactProofFiled, true);
  assert.equal(p10Round008Contact.paid3DGenerationAuthorized, false);
  assert.equal(
    p10Round008Contact.source.referencePixelsSuppliedToGeneration,
    false,
  );
  assert.equal(
    p10Round008Contact.source.receiptSha256,
    "ccd7141fd24a51ee8d382100a6c8fe328363927cb47898addcc209ba5cea66dd",
  );
  assert.equal(
    p10Round008Contact.source.readmeSha256,
    "11fabf630ee0cd23c60ce7f6ba6a7dd8d866c535460962265c7caa18321fdede",
  );
  assert.equal(
    p10Round008Contact.source.reviewSha256,
    "8c2f60c255316ed2298967f553790e29eef62d4b7528fc788f5f9433529e0e53",
  );
  assert.equal(
    p10Round008Contact.source.promotionSha256,
    "e8313a59d01150113b44693977c2c6b1b2b951e449eb06a58375adbeed9177e9",
  );
  assert.equal(
    p10Round008Contact.contactDecision.verdict,
    "PASS_ISOLATED_CONTACT_PROOF",
  );
  assert.equal(
    p10Round008Contact.contactDecision.strongestCandidateId,
    "combat-contact-candidate-04",
  );
  assert.equal(
    p10Round008Contact.contactDecision.strongestCandidateSha256,
    "06249a9cf8fcc94c4d531ebb6ffa835c4b7be8cc77202836069dd42d9e27692d",
  );
  assert.equal(p10Round008Contact.contactDecision.identityPreserved, true);
  assert.equal(p10Round008Contact.contactDecision.oneCompleteWeapon, true);
  assert.equal(
    p10Round008Contact.contactDecision.twoSeparatedSameHiltClosures,
    true,
  );
  assert.equal(
    p10Round008Contact.contactDecision.contactAndObjectContinuityAuditable,
    true,
  );
  assert.equal(
    p10Round008Contact.contactDecision.hiltClothingOverlapFatal,
    false,
  );
  assert.equal(p10Round008Contact.visualReview.score, 68);
  assert.equal(p10Round008Contact.visualReview.maximum, 100);
  assert.equal(p10Round008Contact.visualReview.passThreshold, 85);
  assert.equal(p10Round008Contact.visualReview.criticalFloorPerCategory, 7);
  assert.equal(
    p10Round008Contact.visualReview.observedMinimumCategoryScore,
    5,
  );
  assert.equal(p10Round008Contact.visualReview.thresholdResult, "FAIL");
  assert.equal(p10Round008Contact.visualReview.criticalFloorResult, "FAIL");
  assert.equal(
    p10Round008Contact.visualReview.verdict,
    "DENY_PAID_3D_GENERATION",
  );
  assert.equal(p10Round008Contact.visualReview.comparisonCount, 6);
  assert.equal(
    p10Round008Contact.visualReview.candidateMetBenchmarkBarCount,
    3,
  );
  assert.equal(
    p10Round008Contact.visualReview.candidateBelowBenchmarkBarCount,
    3,
  );
  assert.equal(
    p10Round008Contact.visualReview.requiredCandidateMetBenchmarkBarCount,
    5,
  );
  assert.equal(p10Round008Contact.visualReview.benchmarkGateResult, "FAIL");
  assert.match(
    p10Round008Contact.visualReview.singleBiggestGap,
    /singular authored silhouette expressed through convincing full-body combat force/i,
  );
  assert.equal(
    p10Round008Contact.visualReview.categoryScores.functionalSameHiltTwoHandGrip,
    8,
  );
  assert.equal(
    p10Round008Contact.decision.result,
    "DENY_PAID_3D_GENERATION",
  );
  assert.equal(p10Round008Contact.decision.paid3DGenerationAuthorized, false);
  assert.equal(p10Round008Contact.builderAttempts.outputLimit, 4);
  assert.equal(p10Round008Contact.builderAttempts.outputsGenerated, 4);
  assert.equal(
    p10Round008Contact.builderAttempts.builderFreezeState,
    "fail-closed",
  );
  assert.equal(
    p10Round008Contact.builderAttempts.freshCriticPromotedCandidate,
    "combat-contact-candidate-04",
  );
  assert.equal(p10Round008Contact.builderAttempts.artRegeneratedForPromotion, false);
  assert.equal(p10Round008Contact.nextRound.round, 9);
  assert.equal(
    p10Round008Contact.nextRound.status,
    "mythic-silhouette-under-combat-load",
  );
  assert.match(p10Round008Contact.nextRound.target, /mythic storm-warden/i);
  assert.match(p10Round008Contact.nextRound.target, /full-body combat force/i);
  assert.deepEqual(p10Round008Contact.nextRound.compositePackGate, {
    minimumTotalScore: 85,
    minimumScorePerCategory: 7,
    blindComparisonCount: 6,
    minimumComparisonsMeetingBenchmarkBar: 5,
    paid3DGenerationRequiresFullPass: true,
  });
  assert.equal(p10Round008Contact.conceptArt.length, 1);
  assert.equal(
    p10Round008Contact.conceptArt[0].publicPath,
    "/captures/P10/round-008-contact/NyraKestrel_CombatGrip_FRESH_CRITIC_ACCEPTED.png",
  );
  assert.equal(
    p10Round008Contact.conceptArt[0].disposition,
    "accepted-isolated-contact-proof",
  );
  assert.equal(
    createHash("sha256").update(round008AcceptedContact).digest("hex"),
    p10Round008Contact.conceptArt[0].sha256,
  );
  assert.equal(round008AcceptedContact.subarray(1, 4).toString("ascii"), "PNG");
  assert.equal(round008AcceptedContact.readUInt32BE(16), 1536);
  assert.equal(round008AcceptedContact.readUInt32BE(20), 1024);
  assert.doesNotMatch(
    JSON.stringify(p10Round008Contact),
    /Reference\.zip|Reference\/[^"']+\.(?:png|jpe?g|webp)|\/Users\/|\/home\/|[A-Za-z]:\\Users\\|\/tmp\/|\/private\/var\/folders\//i,
  );

  assert.equal(p10Round009MythicForce.piece, "P10");
  assert.equal(p10Round009MythicForce.round, 9);
  assert.equal(
    p10Round009MythicForce.status,
    "rejected-mythic-force-preflight",
  );
  assert.equal(
    p10Round009MythicForce.artifactClass,
    "original 2D mythic-force concept art",
  );
  assert.equal(p10Round009MythicForce.engineRun, false);
  assert.equal(p10Round009MythicForce.actualGameCapturePerformed, false);
  assert.equal(p10Round009MythicForce.unityCaptureFiled, false);
  assert.equal(p10Round009MythicForce.threeDimensionalAssetFiled, false);
  assert.equal(p10Round009MythicForce.gameReadyEvidenceFiled, false);
  assert.equal(p10Round009MythicForce.builderAcceptedSheetFiled, true);
  assert.equal(p10Round009MythicForce.isolatedMythicForceTargetPassed, false);
  assert.equal(p10Round009MythicForce.paid3DGenerationAuthorized, false);
  assert.equal(
    p10Round009MythicForce.source.referencePixelsSuppliedToGeneration,
    false,
  );
  assert.equal(
    p10Round009MythicForce.source.receiptSha256,
    "f123442ffa6c4058cebb32e97eb757fca1c699c4b1ffba83733edd6020baf26c",
  );
  assert.equal(
    p10Round009MythicForce.source.readmeSha256,
    "27a374345c9dcfe3a86b78a4b2aec2fbdf224ba862615d29d4026775cca084b7",
  );
  assert.equal(
    p10Round009MythicForce.source.reviewSha256,
    "5ecf267e87a2d8c550b56539afc70128fde61dc2db215dd15792b4af2555d56d",
  );
  assert.equal(
    p10Round009MythicForce.isolatedDecision.verdict,
    "FAIL_ISOLATED_MYTHIC_FORCE_TARGET",
  );
  assert.equal(p10Round009MythicForce.isolatedDecision.identityPreserved, true);
  assert.equal(
    p10Round009MythicForce.isolatedDecision.engineeringPreserved,
    true,
  );
  assert.equal(
    p10Round009MythicForce.isolatedDecision.oneWeaponContinuityPreserved,
    true,
  );
  assert.equal(
    p10Round009MythicForce.isolatedDecision.twoHandSameHiltContactPreserved,
    true,
  );
  assert.equal(
    p10Round009MythicForce.isolatedDecision.singularOwnableMythicStormWardenSilhouetteAchieved,
    false,
  );
  assert.equal(
    p10Round009MythicForce.isolatedDecision.convincingFullBodyCombatForceAchieved,
    false,
  );
  assert.equal(p10Round009MythicForce.visualReview.score, 71);
  assert.equal(p10Round009MythicForce.visualReview.maximum, 100);
  assert.equal(p10Round009MythicForce.visualReview.passThreshold, 85);
  assert.equal(
    p10Round009MythicForce.visualReview.criticalFloorPerCategory,
    7,
  );
  assert.equal(
    p10Round009MythicForce.visualReview.observedMinimumCategoryScore,
    6,
  );
  assert.equal(p10Round009MythicForce.visualReview.thresholdResult, "FAIL");
  assert.equal(p10Round009MythicForce.visualReview.criticalFloorResult, "FAIL");
  assert.equal(
    p10Round009MythicForce.visualReview.verdict,
    "DENY_PAID_3D_GENERATION",
  );
  assert.equal(p10Round009MythicForce.visualReview.comparisonCount, 6);
  assert.equal(
    p10Round009MythicForce.visualReview.candidateMetBenchmarkBarCount,
    2,
  );
  assert.equal(
    p10Round009MythicForce.visualReview.candidateBelowBenchmarkBarCount,
    4,
  );
  assert.equal(
    p10Round009MythicForce.visualReview.requiredCandidateMetBenchmarkBarCount,
    5,
  );
  assert.equal(
    p10Round009MythicForce.visualReview.benchmarkGateResult,
    "FAIL",
  );
  assert.match(
    p10Round009MythicForce.visualReview.singleBiggestGap,
    /samurai-adjacent tassets, odachi language, and wide studio guard/i,
  );
  assert.equal(
    p10Round009MythicForce.visualReview.categoryScores.premiumLayeredCostumeAndMaterialSeparation,
    8,
  );
  assert.equal(
    p10Round009MythicForce.visualReview.categoryScores.avoidanceOfGenericCivilianPlasticFetishAndFranchiseCues,
    6,
  );
  assert.equal(
    p10Round009MythicForce.decision.result,
    "DENY_PAID_3D_GENERATION",
  );
  assert.equal(
    p10Round009MythicForce.decision.paid3DGenerationAuthorized,
    false,
  );
  assert.equal(p10Round009MythicForce.decision.unityLocked, true);
  assert.equal(p10Round009MythicForce.builderAttempts.length, 4);
  assert.deepEqual(
    p10Round009MythicForce.builderAttempts.map((attempt) => attempt.sha256),
    [
      "2b4b7d5931fe61e34e412345da3394a258d82193b7dde603f8fa977a0ed1a204",
      "45a6b89d22b34a84e2854dfe1556b0622da9807ed3cc51e96c4f3757e8b6ffe4",
      "694d7237f1260f98cd57af370f4280737709a6f53a443d879c68437202e6b2b8",
      "dcaf4e5464c05f51a75db3a5f3c07e898f9d9e778779f1f635bcfaedf70e1c7e",
    ],
  );
  assert.equal(p10Round009MythicForce.nextRound.round, 10);
  assert.equal(
    p10Round009MythicForce.nextRound.status,
    "ground-arc-arrest-signature-force-event",
  );
  assert.match(
    p10Round009MythicForce.nextRound.target,
    /redesigned non-historical storm-harvesting blade/i,
  );
  assert.match(p10Round009MythicForce.nextRound.target, /samurai-adjacent/i);
  assert.deepEqual(p10Round009MythicForce.nextRound.compositePackGate, {
    minimumTotalScore: 85,
    minimumScorePerCategory: 7,
    blindComparisonCount: 6,
    minimumComparisonsMeetingBenchmarkBar: 5,
    paid3DGenerationRequiresFullPass: true,
  });
  assert.equal(p10Round009MythicForce.conceptArt.length, 1);
  assert.equal(
    p10Round009MythicForce.conceptArt[0].publicPath,
    "/captures/P10/round-009-mythic-force/NyraKestrel_MythicForce_CRITIC_REJECTED.png",
  );
  assert.equal(
    p10Round009MythicForce.conceptArt[0].disposition,
    "builder-accepted-critic-rejected-evidence",
  );
  assert.equal(
    createHash("sha256").update(round009RejectedMythicForce).digest("hex"),
    p10Round009MythicForce.conceptArt[0].sha256,
  );
  assert.equal(
    round009RejectedMythicForce.subarray(1, 4).toString("ascii"),
    "PNG",
  );
  assert.equal(round009RejectedMythicForce.readUInt32BE(16), 1536);
  assert.equal(round009RejectedMythicForce.readUInt32BE(20), 1024);
  assert.doesNotMatch(
    JSON.stringify(p10Round009MythicForce),
    /Reference\.zip|Reference\/[^"']+\.(?:png|jpe?g|webp)|\/Users\/|\/home\/|[A-Za-z]:\\Users\\|\/tmp\/|\/private\/var\/folders\//i,
  );

  assert.equal(p10Round010GroundArc.piece, "P10");
  assert.equal(p10Round010GroundArc.round, 10);
  assert.equal(
    p10Round010GroundArc.status,
    "rejected-ground-arc-preflight",
  );
  assert.equal(
    p10Round010GroundArc.artifactClass,
    "original 2D signature-force concept art",
  );
  assert.equal(p10Round010GroundArc.engineRun, false);
  assert.equal(p10Round010GroundArc.actualGameCapturePerformed, false);
  assert.equal(p10Round010GroundArc.unityCaptureFiled, false);
  assert.equal(p10Round010GroundArc.threeDimensionalAssetFiled, false);
  assert.equal(p10Round010GroundArc.gameReadyEvidenceFiled, false);
  assert.equal(p10Round010GroundArc.builderAcceptedFrameFiled, true);
  assert.equal(p10Round010GroundArc.isolatedGroundArcTargetPassed, false);
  assert.equal(p10Round010GroundArc.paid3DGenerationAuthorized, false);
  assert.equal(
    p10Round010GroundArc.source.referencePixelsSuppliedToGeneration,
    false,
  );
  assert.equal(
    p10Round010GroundArc.source.receiptSha256,
    "232191e121e6804739db75f3cfd969caf9815c5ecaeccc0f04f39e7497d2a2e0",
  );
  assert.equal(
    p10Round010GroundArc.source.readmeSha256,
    "b037657d9e31fd778e7fe68b1d3e0cc8f4920357bd9f0c4c09dad93da759ed2e",
  );
  assert.equal(
    p10Round010GroundArc.source.reviewSha256,
    "fee67f1dbb37a4f3c40f3ba52e15421bfc1d1d9916d8c80cbff826570b27fa33",
  );
  assert.equal(
    p10Round010GroundArc.isolatedDecision.verdict,
    "FAIL_ISOLATED_GROUND_ARC_ARREST_TARGET",
  );
  assert.equal(
    p10Round010GroundArc.isolatedDecision.strongestCandidate,
    "ground-arc-arrest-candidate-03",
  );
  assert.equal(p10Round010GroundArc.isolatedDecision.identityPreserved, true);
  assert.equal(
    p10Round010GroundArc.isolatedDecision.oneWeaponContinuityPreserved,
    true,
  );
  assert.equal(
    p10Round010GroundArc.isolatedDecision.twoHandSameHiltContactPreserved,
    true,
  );
  assert.equal(
    p10Round010GroundArc.isolatedDecision.samuraiAdjacentTassetsRemoved,
    true,
  );
  assert.equal(
    p10Round010GroundArc.isolatedDecision.historicalOdachiCodingRemoved,
    true,
  );
  assert.equal(
    p10Round010GroundArc.isolatedDecision.nonHistoricalStormShearLanguageAchieved,
    true,
  );
  assert.equal(
    p10Round010GroundArc.isolatedDecision.singularOwnableStormShearSilhouetteAchieved,
    false,
  );
  assert.equal(
    p10Round010GroundArc.isolatedDecision.groundArcArrestFullBodyDecelerationAchieved,
    false,
  );
  assert.equal(
    p10Round010GroundArc.isolatedDecision.staticWidePoseRejected,
    true,
  );
  assert.equal(p10Round010GroundArc.visualReview.score, 68);
  assert.equal(p10Round010GroundArc.visualReview.maximum, 100);
  assert.equal(p10Round010GroundArc.visualReview.passThreshold, 85);
  assert.equal(
    p10Round010GroundArc.visualReview.criticalFloorPerCategory,
    7,
  );
  assert.equal(
    p10Round010GroundArc.visualReview.observedMinimumCategoryScore,
    6,
  );
  assert.equal(p10Round010GroundArc.visualReview.thresholdResult, "FAIL");
  assert.equal(p10Round010GroundArc.visualReview.criticalFloorResult, "FAIL");
  assert.equal(
    p10Round010GroundArc.visualReview.verdict,
    "DENY_PAID_3D_GENERATION",
  );
  assert.equal(p10Round010GroundArc.visualReview.comparisonCount, 6);
  assert.equal(
    p10Round010GroundArc.visualReview.candidateMetBenchmarkBarCount,
    2,
  );
  assert.equal(
    p10Round010GroundArc.visualReview.candidateBelowBenchmarkBarCount,
    4,
  );
  assert.equal(
    p10Round010GroundArc.visualReview.requiredCandidateMetBenchmarkBarCount,
    5,
  );
  assert.equal(p10Round010GroundArc.visualReview.benchmarkGateResult, "FAIL");
  assert.match(
    p10Round010GroundArc.visualReview.singleBiggestGap,
    /blade momentum does not visibly load the spine, scapulae, shoulders, elbows, wrists, pelvis, feet, cloth, plates, and conductor/i,
  );
  assert.equal(
    p10Round010GroundArc.visualReview.categoryScores.anatomy,
    6,
  );
  assert.equal(
    p10Round010GroundArc.visualReview.categoryScores.functionalSameHiltTwoHandGrip,
    8,
  );
  assert.equal(
    p10Round010GroundArc.decision.result,
    "DENY_PAID_3D_GENERATION",
  );
  assert.equal(
    p10Round010GroundArc.decision.paid3DGenerationAuthorized,
    false,
  );
  assert.equal(p10Round010GroundArc.decision.unityLocked, true);
  assert.equal(p10Round010GroundArc.builderAttempts.length, 4);
  assert.deepEqual(
    p10Round010GroundArc.builderAttempts.map((attempt) => attempt.sha256),
    [
      "834effbdc600b5d04ca4c439dcf6b997f98b1887aa98d8d492e2da8a06b78ada",
      "43ad3639f7daafd3306178d6bf64f998bad7bb2225a983f8e8df3095c6f9c635",
      "3cf1e4c8f798480d8f2c2e889943e2aba832e5a299337f0a800ffd1f68683df6",
      "539baf8871f65d62605e174e24f1cf96bcbc3dd23c3334a8d1e3be3ef5ba646f",
    ],
  );
  assert.equal(p10Round010GroundArc.nextRound.round, 11);
  assert.equal(
    p10Round010GroundArc.nextRound.status,
    "biomechanical-force-chain-keyframe",
  );
  assert.match(p10Round010GroundArc.nextRound.target, /pose guide/i);
  assert.match(p10Round010GroundArc.nextRound.target, /grip-to-ground/i);
  assert.deepEqual(p10Round010GroundArc.nextRound.compositePackGate, {
    minimumTotalScore: 85,
    minimumScorePerCategory: 7,
    blindComparisonCount: 6,
    minimumComparisonsMeetingBenchmarkBar: 5,
    paid3DGenerationRequiresFullPass: true,
  });
  assert.equal(p10Round010GroundArc.conceptArt.length, 1);
  assert.equal(
    p10Round010GroundArc.conceptArt[0].publicPath,
    "/captures/P10/round-010-ground-arc/NyraKestrel_GroundArcArrest_CRITIC_REJECTED.png",
  );
  assert.equal(
    p10Round010GroundArc.conceptArt[0].disposition,
    "builder-accepted-critic-rejected-evidence",
  );
  assert.equal(
    createHash("sha256").update(round010RejectedGroundArc).digest("hex"),
    p10Round010GroundArc.conceptArt[0].sha256,
  );
  assert.equal(
    round010RejectedGroundArc.subarray(1, 4).toString("ascii"),
    "PNG",
  );
  assert.equal(round010RejectedGroundArc.readUInt32BE(16), 1536);
  assert.equal(round010RejectedGroundArc.readUInt32BE(20), 1024);
  assert.doesNotMatch(
    JSON.stringify(p10Round010GroundArc),
    /Reference\.zip|Reference\/[^"']+\.(?:png|jpe?g|webp)|\/Users\/|\/home\/|[A-Za-z]:\\Users\\|\/tmp\/|\/private\/var\/folders\//i,
  );

  assert.equal(p10Round011KineticChain.piece, "P10");
  assert.equal(p10Round011KineticChain.round, 11);
  assert.equal(
    p10Round011KineticChain.status,
    "rejected-kinetic-chain-preflight",
  );
  assert.equal(
    p10Round011KineticChain.artifactClass,
    "original 2D pose-guide-driven signature-force concept art",
  );
  assert.equal(p10Round011KineticChain.engineRun, false);
  assert.equal(p10Round011KineticChain.actualGameCapturePerformed, false);
  assert.equal(p10Round011KineticChain.unityProjectShellPresent, true);
  assert.equal(p10Round011KineticChain.runnableReviewedGameplayDetected, false);
  assert.equal(p10Round011KineticChain.unityCaptureFiled, false);
  assert.equal(p10Round011KineticChain.threeDimensionalAssetFiled, false);
  assert.equal(p10Round011KineticChain.gameReadyEvidenceFiled, false);
  assert.equal(p10Round011KineticChain.builderAcceptedFrameFiled, true);
  assert.equal(p10Round011KineticChain.isolatedKineticChainTargetPassed, false);
  assert.equal(p10Round011KineticChain.paid3DGenerationAuthorized, false);
  assert.equal(
    p10Round011KineticChain.source.referencePixelsSuppliedToGeneration,
    false,
  );
  assert.equal(
    p10Round011KineticChain.source.receiptSha256,
    "bce5ccc57d27c5313f023c9cd3616bb7cecba54bfcffcd76e2e5554ffdcd4766",
  );
  assert.equal(
    p10Round011KineticChain.source.readmeSha256,
    "6d69f167c305333a5ad898ca676460bf93cdd5caeffef257427ee28e7a4019b0",
  );
  assert.equal(
    p10Round011KineticChain.source.reviewSha256,
    "fad0cd1851d4951d89d76591557304b678416628d513c83598d3bf0df82ff226",
  );
  assert.equal(
    p10Round011KineticChain.source.poseGuidePngSha256,
    "55a46c2e0161bd050d8094cb0d010d619ddb0226b172a95f6d6bdf2b9d0809aa",
  );
  assert.equal(
    p10Round011KineticChain.source.poseGuideSvgSha256,
    "a6d58bd4a749f21d97497a5675fdfd775a08d61bab89e0327e4875e0bee7d9b0",
  );
  assert.equal(
    p10Round011KineticChain.isolatedDecision.verdict,
    "FAIL_VISUAL_ONLY_KINETIC_CHAIN_GATE",
  );
  assert.equal(
    p10Round011KineticChain.isolatedDecision.strongestCandidate,
    "kinetic-chain-candidate-04",
  );
  assert.equal(
    p10Round011KineticChain.isolatedDecision.upperRightExternalBladeMassAchieved,
    true,
  );
  assert.equal(
    p10Round011KineticChain.isolatedDecision.chestHeightDisplacedHiltAchieved,
    true,
  );
  assert.equal(
    p10Round011KineticChain.isolatedDecision.rearHeelAirborneToeSkidAchieved,
    true,
  );
  assert.equal(
    p10Round011KineticChain.isolatedDecision.scapularPushPullAchieved,
    false,
  );
  assert.equal(
    p10Round011KineticChain.isolatedDecision.deepTorsoCCurveAchieved,
    false,
  );
  assert.equal(
    p10Round011KineticChain.isolatedDecision.oneViolentDecelerationEventAchieved,
    false,
  );
  assert.equal(p10Round011KineticChain.visualReview.score, 62);
  assert.equal(p10Round011KineticChain.visualReview.maximum, 100);
  assert.equal(p10Round011KineticChain.visualReview.passThreshold, 85);
  assert.equal(
    p10Round011KineticChain.visualReview.criticalFloorPerCategory,
    7,
  );
  assert.equal(
    p10Round011KineticChain.visualReview.observedMinimumCategoryScore,
    5,
  );
  assert.equal(p10Round011KineticChain.visualReview.thresholdResult, "FAIL");
  assert.equal(p10Round011KineticChain.visualReview.criticalFloorResult, "FAIL");
  assert.equal(p10Round011KineticChain.visualReview.comparisonCount, 6);
  assert.equal(
    p10Round011KineticChain.visualReview.candidateMetBenchmarkBarCount,
    2,
  );
  assert.equal(
    p10Round011KineticChain.visualReview.requiredCandidateMetBenchmarkBarCount,
    5,
  );
  assert.match(
    p10Round011KineticChain.visualReview.singleBiggestGap,
    /both scapulae and arms still advance as a quiet paired reach/i,
  );
  assert.equal(
    p10Round011KineticChain.visualReview.categoryScores.biomechanicsAndSingleEventDeceleration,
    5,
  );
  assert.equal(
    p10Round011KineticChain.decision.result,
    "DENY_PAID_3D_GENERATION",
  );
  assert.equal(p10Round011KineticChain.decision.unityLocked, true);
  assert.equal(p10Round011KineticChain.builderAttempts.length, 4);
  assert.deepEqual(
    p10Round011KineticChain.builderAttempts.map((attempt) => attempt.sha256),
    [
      "cf23f4343e748d14ed8702bdd469aed2a4ed74dc1724883a332e0c6ca596f760",
      "058be7fcede38052a0144b8726460f6aaece9f1404b282b0d63384229530e1b1",
      "fc394a2cbb77fbc207d65e1054ee4be7a9d2e71141822ab24f1afa67d506f372",
      "d148436582ac130ea6d867db7d7544aa7f1726143be4d9a8ce9206bf19fa7f62",
    ],
  );
  assert.equal(p10Round011KineticChain.nextRound.round, 12);
  assert.equal(
    p10Round011KineticChain.nextRound.status,
    "scapular-counterforce-lock",
  );
  assert.match(p10Round011KineticChain.nextRound.target, /one scapula drives forward\/down/i);
  assert.match(p10Round011KineticChain.nextRound.target, /deep C-curve/i);
  assert.deepEqual(p10Round011KineticChain.nextRound.compositePackGate, {
    minimumTotalScore: 85,
    minimumScorePerCategory: 7,
    blindComparisonCount: 6,
    minimumComparisonsMeetingBenchmarkBar: 5,
    paid3DGenerationRequiresFullPass: true,
  });
  assert.equal(p10Round011KineticChain.conceptArt.length, 1);
  assert.equal(
    p10Round011KineticChain.conceptArt[0].publicPath,
    "/captures/P10/round-011-kinetic-chain/NyraKestrel_KineticChain_CRITIC_REJECTED.png",
  );
  assert.equal(
    createHash("sha256").update(round011RejectedKineticChain).digest("hex"),
    p10Round011KineticChain.conceptArt[0].sha256,
  );
  assert.equal(
    round011RejectedKineticChain.subarray(1, 4).toString("ascii"),
    "PNG",
  );
  assert.equal(round011RejectedKineticChain.readUInt32BE(16), 1536);
  assert.equal(round011RejectedKineticChain.readUInt32BE(20), 1024);
  assert.doesNotMatch(
    JSON.stringify(p10Round011KineticChain),
    /Reference\.zip|Reference\/[^"']+\.(?:png|jpe?g|webp)|\/Users\/|\/home\/|[A-Za-z]:\\Users\\|\/tmp\/|\/private\/var\/folders\//i,
  );

  assert.equal(p10Round012ScapularCounterforce.piece, "P10");
  assert.equal(p10Round012ScapularCounterforce.round, 12);
  assert.equal(
    p10Round012ScapularCounterforce.status,
    "rejected-scapular-counterforce-preflight",
  );
  assert.equal(p10Round012ScapularCounterforce.engineRun, false);
  assert.equal(
    p10Round012ScapularCounterforce.actualGameCapturePerformed,
    false,
  );
  assert.equal(p10Round012ScapularCounterforce.unityProjectShellPresent, true);
  assert.equal(
    p10Round012ScapularCounterforce.runnableReviewedGameplayDetected,
    false,
  );
  assert.equal(
    p10Round012ScapularCounterforce.isolatedScapularCounterforceTargetPassed,
    false,
  );
  assert.equal(
    p10Round012ScapularCounterforce.source.receiptSha256,
    "6a9a22e40e7c9656548b744617022f6d6dc7bd9a3a59374988c98a7a7c40dc62",
  );
  assert.equal(
    p10Round012ScapularCounterforce.source.readmeSha256,
    "c270b3adc5aad1400e6c7e484f611643b64c83a02cb4435e54caf67f3d5d4e26",
  );
  assert.equal(
    p10Round012ScapularCounterforce.source.reviewSha256,
    "8b074b94bc4fdbf9f70c643bed155699486014825ae21b1f50c52520ea48e02e",
  );
  assert.equal(
    p10Round012ScapularCounterforce.source.guidePngSha256,
    "434cde6efa606f528b09f0596ed020fd7c1549f547bef100e355c4afc9d44da5",
  );
  assert.equal(
    p10Round012ScapularCounterforce.source.guideSvgSha256,
    "40e6646dce9607aedecb3a95393627e2de07d1c207cccbb5abbd8a6e64e23899",
  );
  assert.equal(
    p10Round012ScapularCounterforce.isolatedDecision.verdict,
    "FAIL_SCAPULAR_COUNTERFORCE_LOCK_VISUAL_ONLY_GATE",
  );
  assert.equal(
    p10Round012ScapularCounterforce.isolatedDecision.strongestCandidate,
    "scapular-counterforce-candidate-04",
  );
  assert.equal(
    p10Round012ScapularCounterforce.isolatedDecision.correctHighRightLowLeftShoulderOrderAchieved,
    true,
  );
  assert.equal(
    p10Round012ScapularCounterforce.isolatedDecision.completeSeparatedSameHiltGripAchieved,
    true,
  );
  assert.equal(
    p10Round012ScapularCounterforce.isolatedDecision.leadingFoldedElbowAchieved,
    false,
  );
  assert.equal(
    p10Round012ScapularCounterforce.isolatedDecision.trailingDownLeftReturnElbowAchieved,
    false,
  );
  assert.equal(
    p10Round012ScapularCounterforce.isolatedDecision.triangularNegativeSpaceAchieved,
    false,
  );
  assert.equal(p10Round012ScapularCounterforce.visualReview.score, 56);
  assert.equal(
    p10Round012ScapularCounterforce.visualReview.observedMinimumCategoryScore,
    3,
  );
  assert.equal(
    p10Round012ScapularCounterforce.visualReview.candidateMetBenchmarkBarCount,
    1,
  );
  assert.equal(
    p10Round012ScapularCounterforce.visualReview.requiredCandidateMetBenchmarkBarCount,
    5,
  );
  assert.match(
    p10Round012ScapularCounterforce.visualReview.singleBiggestGap,
    /unequal-elbow counterforce topology is absent/i,
  );
  assert.equal(
    p10Round012ScapularCounterforce.visualReview.categoryScores.leadingFoldedElbowMechanics,
    3,
  );
  assert.equal(
    p10Round012ScapularCounterforce.visualReview.categoryScores.trailingElbowReturnAndTriangularNegativeSpace,
    3,
  );
  assert.equal(
    p10Round012ScapularCounterforce.decision.result,
    "DENY_PAID_3D_GENERATION",
  );
  assert.equal(p10Round012ScapularCounterforce.decision.unityLocked, true);
  assert.equal(p10Round012ScapularCounterforce.builderAttempts.length, 4);
  assert.deepEqual(
    p10Round012ScapularCounterforce.builderAttempts.map(
      (attempt) => attempt.sha256,
    ),
    [
      "0103e396280a07e223ab3340b52c6f43eec5fd5644b481926835099968634ef7",
      "68f3581aff525aad917bb8a6b57d6c7e6b730598599e388d0a157a8fca4d151a",
      "17b75caa6840cef263f357271960fa00b3e2ab015e8ccc4aac86c7c9bfdd3843",
      "f64cfdad9fa0805d495d5c02db2ae8e0c697fa3b664b0402d8b717a8bd271411",
    ],
  );
  assert.equal(p10Round012ScapularCounterforce.nextRound.round, 13);
  assert.equal(
    p10Round012ScapularCounterforce.nextRound.status,
    "elbow-return-triangle",
  );
  assert.match(
    p10Round012ScapularCounterforce.nextRound.target,
    /trailing elbow far down-left below the hilt/i,
  );
  assert.equal(p10Round012ScapularCounterforce.conceptArt.length, 1);
  assert.equal(
    p10Round012ScapularCounterforce.conceptArt[0].publicPath,
    "/captures/P10/round-012-scapular-counterforce/NyraKestrel_ScapularCounterforce_CRITIC_REJECTED.png",
  );
  assert.equal(
    createHash("sha256")
      .update(round012RejectedScapularCounterforce)
      .digest("hex"),
    p10Round012ScapularCounterforce.conceptArt[0].sha256,
  );
  assert.equal(
    round012RejectedScapularCounterforce.subarray(1, 4).toString("ascii"),
    "PNG",
  );
  assert.equal(round012RejectedScapularCounterforce.readUInt32BE(16), 1536);
  assert.equal(round012RejectedScapularCounterforce.readUInt32BE(20), 1024);
  assert.doesNotMatch(
    JSON.stringify(p10Round012ScapularCounterforce),
    /Reference\.zip|Reference\/[^"']+\.(?:png|jpe?g|webp)|\/Users\/|\/home\/|[A-Za-z]:\\Users\\|\/tmp\/|\/private\/var\/folders\//i,
  );

  assert.equal(p10Round013ElbowReturnTriangle.piece, "P10");
  assert.equal(p10Round013ElbowReturnTriangle.round, 13);
  assert.equal(
    p10Round013ElbowReturnTriangle.status,
    "rejected-elbow-return-triangle-preflight",
  );
  assert.equal(p10Round013ElbowReturnTriangle.engineRun, false);
  assert.equal(
    p10Round013ElbowReturnTriangle.actualGameCapturePerformed,
    false,
  );
  assert.equal(p10Round013ElbowReturnTriangle.unityProjectShellPresent, true);
  assert.equal(
    p10Round013ElbowReturnTriangle.runnableReviewedGameplayDetected,
    false,
  );
  assert.equal(
    p10Round013ElbowReturnTriangle.isolatedElbowReturnTriangleTargetPassed,
    false,
  );
  assert.equal(
    p10Round013ElbowReturnTriangle.source.receiptSha256,
    "2ebff0f4c747e05a9054aa23a9f59d3ef2cdb19bd9b5afed6255a9437251b8cb",
  );
  assert.equal(
    p10Round013ElbowReturnTriangle.source.readmeSha256,
    "fda5d53b228fb91d0cc1b996b1be4cf5f8ae7173ebb2d4fce43eb2a2b7657a0e",
  );
  assert.equal(
    p10Round013ElbowReturnTriangle.source.reviewSha256,
    "344bbd027c6e92b134a7a0a868b83d01379a21fff8ea0aebcff1b9980433cfcf",
  );
  assert.equal(
    p10Round013ElbowReturnTriangle.source.guidePngSha256,
    "bedafd12ba61c48ec0a7fb4f18babfdb06f0a28b800d63ab04a2d61295042c70",
  );
  assert.equal(
    p10Round013ElbowReturnTriangle.source.guideSvgSha256,
    "cac19ee4abe9ecdaeb003cead6a62c4b635bc23678032f22a7ec5863d3dfeea7",
  );
  assert.equal(
    p10Round013ElbowReturnTriangle.isolatedDecision.verdict,
    "FAIL_ELBOW_RETURN_TRIANGLE_VISUAL_ONLY_GATE",
  );
  assert.equal(
    p10Round013ElbowReturnTriangle.isolatedDecision.strongestCandidate,
    "elbow-return-triangle-candidate-04",
  );
  assert.equal(
    p10Round013ElbowReturnTriangle.isolatedDecision.compactLeadingElbowAchieved,
    true,
  );
  assert.equal(
    p10Round013ElbowReturnTriangle.isolatedDecision
      .trailingElbowLowestExternalVertexAchieved,
    false,
  );
  assert.equal(
    p10Round013ElbowReturnTriangle.isolatedDecision
      .trailingForearmReturnUpRightAchieved,
    false,
  );
  assert.equal(
    p10Round013ElbowReturnTriangle.isolatedDecision
      .largePaleTriangularNegativeSpaceAchieved,
    false,
  );
  assert.equal(p10Round013ElbowReturnTriangle.visualReview.score, 41);
  assert.equal(
    p10Round013ElbowReturnTriangle.visualReview.observedMinimumCategoryScore,
    1,
  );
  assert.equal(
    p10Round013ElbowReturnTriangle.visualReview
      .candidateMetBenchmarkBarCount,
    2,
  );
  assert.equal(
    p10Round013ElbowReturnTriangle.visualReview
      .requiredCandidateMetBenchmarkBarCount,
    5,
  );
  assert.match(
    p10Round013ElbowReturnTriangle.visualReview.singleBiggestGap,
    /trailing-arm return topology is absent/i,
  );
  assert.equal(
    p10Round013ElbowReturnTriangle.visualReview.categoryScores
      .compactLeadingElbowFold,
    8,
  );
  assert.equal(
    p10Round013ElbowReturnTriangle.visualReview.categoryScores
      .forearmReturnUpRightToInwardHand,
    1,
  );
  assert.equal(
    p10Round013ElbowReturnTriangle.visualReview.categoryScores
      .largePaleTriangularNegativeSpace,
    1,
  );
  assert.equal(
    p10Round013ElbowReturnTriangle.decision.result,
    "DENY_PAID_3D_GENERATION",
  );
  assert.equal(p10Round013ElbowReturnTriangle.decision.unityLocked, true);
  assert.equal(p10Round013ElbowReturnTriangle.builderAttempts.length, 4);
  assert.deepEqual(
    p10Round013ElbowReturnTriangle.builderAttempts.map(
      (attempt) => attempt.sha256,
    ),
    [
      "c033ffe206dec0343894dd1a4742099a4b4e96224caa113173d14344c1063386",
      "9731b43baedace9e4e1d0b2dd1e7f9aa92b2e330113ae8a55754e07a09bec4e0",
      "779006f95836184d0206a85871dd17d70e3a60c6430c8044e3e193d0a8729422",
      "c88489f7af2c0a5d223f431fb322f72ac549283819c3c9b6281a20c1b39fbcd6",
    ],
  );
  assert.equal(p10Round013ElbowReturnTriangle.nextRound.round, 14);
  assert.equal(
    p10Round013ElbowReturnTriangle.nextRound.status,
    "trailing-return-wedge",
  );
  assert.match(
    p10Round013ElbowReturnTriangle.nextRound.target,
    /forearm returns sharply up-right/i,
  );
  assert.equal(p10Round013ElbowReturnTriangle.conceptArt.length, 1);
  assert.equal(
    p10Round013ElbowReturnTriangle.conceptArt[0].publicPath,
    "/captures/P10/round-013-elbow-return-triangle/NyraKestrel_ElbowReturnTriangle_CRITIC_REJECTED.png",
  );
  assert.equal(
    createHash("sha256")
      .update(round013RejectedElbowReturnTriangle)
      .digest("hex"),
    p10Round013ElbowReturnTriangle.conceptArt[0].sha256,
  );
  assert.equal(
    round013RejectedElbowReturnTriangle.subarray(1, 4).toString("ascii"),
    "PNG",
  );
  assert.equal(round013RejectedElbowReturnTriangle.readUInt32BE(16), 1536);
  assert.equal(round013RejectedElbowReturnTriangle.readUInt32BE(20), 1024);
  assert.doesNotMatch(
    JSON.stringify(p10Round013ElbowReturnTriangle),
    /Reference\.zip|Reference\/[^"']+\.(?:png|jpe?g|webp)|\/Users\/|\/home\/|[A-Za-z]:\\Users\\|\/tmp\/|\/private\/var\/folders\//i,
  );

  assert.equal(p10Round014TrailingReturnWedge.piece, "P10");
  assert.equal(p10Round014TrailingReturnWedge.round, 14);
  assert.equal(
    p10Round014TrailingReturnWedge.status,
    "rejected-trailing-return-wedge-preflight",
  );
  assert.equal(p10Round014TrailingReturnWedge.engineRun, false);
  assert.equal(
    p10Round014TrailingReturnWedge.actualGameCapturePerformed,
    false,
  );
  assert.equal(p10Round014TrailingReturnWedge.unityProjectShellPresent, true);
  assert.equal(
    p10Round014TrailingReturnWedge.runnableReviewedGameplayDetected,
    false,
  );
  assert.equal(
    p10Round014TrailingReturnWedge.isolatedTrailingReturnWedgeTargetPassed,
    false,
  );
  assert.equal(
    p10Round014TrailingReturnWedge.source.receiptSha256,
    "187df17af0a776c4736fe8c9fe7f87c7b77d603a618da03326249dfbc9363126",
  );
  assert.equal(
    p10Round014TrailingReturnWedge.source.readmeSha256,
    "6fdf781400a5fe9ba207a4444042d29e847a99269922dc9a2b7a9191bb6a4ac1",
  );
  assert.equal(
    p10Round014TrailingReturnWedge.source.reviewSha256,
    "4ebe93583384e483fb38bb7e1d694412821e0fab3d7abc0498c2977ba42af1cd",
  );
  assert.equal(
    p10Round014TrailingReturnWedge.source.guidePngSha256,
    "8b740824ba90fe9bb844054c6a1782451391022528bcd44295219d4ac2e693c0",
  );
  assert.equal(
    p10Round014TrailingReturnWedge.source.guideSvgSha256,
    "9adf2c0ab04f97566463129cdec69680f97b24d2bb6e3489a4620d25674031ce",
  );
  assert.equal(
    p10Round014TrailingReturnWedge.isolatedDecision.verdict,
    "FAIL_TRAILING_RETURN_WEDGE_VISUAL_ONLY_GATE",
  );
  assert.equal(
    p10Round014TrailingReturnWedge.isolatedDecision.strongestCandidate,
    "trailing-return-wedge-candidate-04",
  );
  assert.equal(
    p10Round014TrailingReturnWedge.isolatedDecision.leadingArmFrozen,
    true,
  );
  assert.equal(
    p10Round014TrailingReturnWedge.isolatedDecision
      .farDownLeftLowestExternalElbowAchieved,
    true,
  );
  assert.equal(
    p10Round014TrailingReturnWedge.isolatedDecision
      .sharpUpRightForearmReturnAchieved,
    false,
  );
  assert.equal(
    p10Round014TrailingReturnWedge.isolatedDecision
      .inwardHandOnExistingHiltAchieved,
    false,
  );
  assert.equal(
    p10Round014TrailingReturnWedge.isolatedDecision
      .cleanUntouchedHeadSizedPaleTriangleAchieved,
    false,
  );
  assert.equal(p10Round014TrailingReturnWedge.visualReview.score, 41);
  assert.equal(
    p10Round014TrailingReturnWedge.visualReview.observedMinimumCategoryScore,
    0,
  );
  assert.equal(
    p10Round014TrailingReturnWedge.visualReview.candidateMetBenchmarkBarCount,
    2,
  );
  assert.equal(
    p10Round014TrailingReturnWedge.visualReview
      .requiredCandidateMetBenchmarkBarCount,
    5,
  );
  assert.match(
    p10Round014TrailingReturnWedge.visualReview.singleBiggestGap,
    /arm-bounded return wedge is absent/i,
  );
  assert.equal(
    p10Round014TrailingReturnWedge.visualReview.categoryScores
      .farDownLeftLowestExternalElbow,
    8,
  );
  assert.equal(
    p10Round014TrailingReturnWedge.visualReview.categoryScores
      .sharpUpRightForearmReturn,
    3,
  );
  assert.equal(
    p10Round014TrailingReturnWedge.visualReview.categoryScores
      .inwardHandOnExistingHilt,
    2,
  );
  assert.equal(
    p10Round014TrailingReturnWedge.visualReview.categoryScores
      .cleanUntouchedHeadSizedPaleTriangle,
    0,
  );
  assert.equal(
    p10Round014TrailingReturnWedge.decision.result,
    "DENY_PAID_3D_GENERATION",
  );
  assert.equal(p10Round014TrailingReturnWedge.decision.unityLocked, true);
  assert.equal(p10Round014TrailingReturnWedge.builderAttempts.length, 4);
  assert.deepEqual(
    p10Round014TrailingReturnWedge.builderAttempts.map(
      (attempt) => attempt.sha256,
    ),
    [
      "ecc3402484fd64e9d1a0ee78173dc0b6091b5c61ad6823b676f649f25247704e",
      "f5589c3ca6c0f7316d794782a79e26acd651a29d006eb51caf4a19355f4e0cb0",
      "40cdc254f47601f2d5355927fa34110f48cbdb6f5c7be98dbc9899b318945fea",
      "3b4244040c27fc1d3410090c59eea52c5d6f369c38dc38aba88cad4a4353bd42",
    ],
  );
  assert.equal(p10Round014TrailingReturnWedge.nextRound.round, 15);
  assert.equal(
    p10Round014TrailingReturnWedge.nextRound.status,
    "inward-return-mask",
  );
  assert.match(
    p10Round014TrailingReturnWedge.nextRound.target,
    /authoritative Round013 candidate04 as the untouched base/i,
  );
  assert.equal(p10Round014TrailingReturnWedge.conceptArt.length, 1);
  assert.equal(
    p10Round014TrailingReturnWedge.conceptArt[0].publicPath,
    "/captures/P10/round-014-trailing-return-wedge/NyraKestrel_TrailingReturnWedge_CRITIC_REJECTED.png",
  );
  assert.equal(
    createHash("sha256")
      .update(round014RejectedTrailingReturnWedge)
      .digest("hex"),
    p10Round014TrailingReturnWedge.conceptArt[0].sha256,
  );
  assert.equal(
    round014RejectedTrailingReturnWedge.subarray(1, 4).toString("ascii"),
    "PNG",
  );
  assert.equal(round014RejectedTrailingReturnWedge.readUInt32BE(16), 1536);
  assert.equal(round014RejectedTrailingReturnWedge.readUInt32BE(20), 1024);
  assert.doesNotMatch(
    JSON.stringify(p10Round014TrailingReturnWedge),
    /Reference\.zip|Reference\/[^"']+\.(?:png|jpe?g|webp)|\/Users\/|\/home\/|[A-Za-z]:\\Users\\|\/tmp\/|\/private\/var\/folders\//i,
  );

  assert.equal(p10Round015InwardReturnMask.piece, "P10");
  assert.equal(p10Round015InwardReturnMask.round, 15);
  assert.equal(
    p10Round015InwardReturnMask.status,
    "rejected-inward-return-mask-preflight",
  );
  assert.equal(p10Round015InwardReturnMask.engineRun, false);
  assert.equal(
    p10Round015InwardReturnMask.actualGameCapturePerformed,
    false,
  );
  assert.equal(p10Round015InwardReturnMask.unityProjectShellPresent, true);
  assert.equal(
    p10Round015InwardReturnMask.runnableReviewedGameplayDetected,
    false,
  );
  assert.equal(
    p10Round015InwardReturnMask.isolatedInwardReturnMaskTargetPassed,
    false,
  );
  assert.equal(
    p10Round015InwardReturnMask.source.receiptSha256,
    "eda3a823aa510d2b96de8c77ace4ec0a580039c31c9bbb3747ad026dbbd204cf",
  );
  assert.equal(
    p10Round015InwardReturnMask.source.readmeSha256,
    "df03fb1f8a49c0983fcc80c371c8f2536fb6d7d59f145a71a1db65138c709400",
  );
  assert.equal(
    p10Round015InwardReturnMask.source.reviewSha256,
    "a69e0d2d28f2204681f7e0e4059ec3ab1dfef111aedce967b957f6ca64de9f2f",
  );
  assert.equal(
    p10Round015InwardReturnMask.source.guidePngSha256,
    "847f323f2c37a36870b54ae568a75f3482d859100b1b3b99e8963975cbe78cc7",
  );
  assert.equal(
    p10Round015InwardReturnMask.source.guideSvgSha256,
    "62f8bbdad3c74420eed2b4bfb3f233354732fb76044e6d95d0ad0565935a8d1a",
  );
  assert.equal(
    p10Round015InwardReturnMask.source.protectedMaskBinarySha256,
    "2077be0160dcb8cbe11c72e65c45bdeafa500f2f3606bfa7fd0646abdd0e45ac",
  );
  assert.equal(
    p10Round015InwardReturnMask.isolatedDecision.verdict,
    "FAIL_INWARD_RETURN_MASK_VISUAL_ONLY_GATE",
  );
  assert.equal(
    p10Round015InwardReturnMask.isolatedDecision.strongestCandidate,
    "inward-return-mask-candidate-04-protected",
  );
  assert.equal(
    p10Round015InwardReturnMask.isolatedDecision
      .authoritativeOutsideMaskPixelPreservationAchieved,
    true,
  );
  assert.equal(
    p10Round015InwardReturnMask.isolatedDecision
      .originalInwardGripAndHiltContinuityAchieved,
    true,
  );
  assert.equal(
    p10Round015InwardReturnMask.isolatedDecision
      .round014FarLowLeftElbowImportAchieved,
    false,
  );
  assert.equal(
    p10Round015InwardReturnMask.isolatedDecision
      .separateSteepUpRightForearmReturnAchieved,
    false,
  );
  assert.equal(
    p10Round015InwardReturnMask.isolatedDecision
      .uninterruptedHeadSizedPaleWedgeAchieved,
    false,
  );
  assert.equal(p10Round015InwardReturnMask.maskIntegrity.protectedPixelCount, 1544522);
  assert.equal(p10Round015InwardReturnMask.maskIntegrity.editablePixelCount, 28342);
  assert.equal(
    p10Round015InwardReturnMask.maskIntegrity.outsideMaskMismatchCountPerCandidate,
    0,
  );
  assert.equal(p10Round015InwardReturnMask.visualReview.score, 40);
  assert.equal(
    p10Round015InwardReturnMask.visualReview.observedMinimumCategoryScore,
    0,
  );
  assert.equal(
    p10Round015InwardReturnMask.visualReview.candidateMetBenchmarkBarCount,
    2,
  );
  assert.equal(
    p10Round015InwardReturnMask.visualReview
      .requiredCandidateMetBenchmarkBarCount,
    5,
  );
  assert.match(
    p10Round015InwardReturnMask.visualReview.singleBiggestGap,
    /two-segment trailing-arm topology is absent/i,
  );
  assert.equal(
    p10Round015InwardReturnMask.visualReview.categoryScores
      .authoritativeOutsideMaskPixelPreservation,
    10,
  );
  assert.equal(
    p10Round015InwardReturnMask.visualReview.categoryScores
      .round014FarLowLeftElbowImport,
    0,
  );
  assert.equal(
    p10Round015InwardReturnMask.visualReview.categoryScores
      .separateSteepUpRightForearmReturn,
    0,
  );
  assert.equal(
    p10Round015InwardReturnMask.visualReview.categoryScores
      .uninterruptedHeadSizedPaleWedge,
    0,
  );
  assert.equal(
    p10Round015InwardReturnMask.decision.result,
    "DENY_PAID_3D_GENERATION",
  );
  assert.equal(p10Round015InwardReturnMask.decision.unityLocked, true);
  assert.equal(p10Round015InwardReturnMask.builderAttempts.length, 4);
  assert.deepEqual(
    p10Round015InwardReturnMask.builderAttempts.map(
      (attempt) => attempt.protectedCompositeSha256,
    ),
    [
      "15f702ac1132825216f964775574890e71b83f85e1fdd3b6442c3b1e56cf5aa9",
      "1bb069121f44cea2358e5b2b3ea83e17787b26189a1ac3bf4991bd85d3c29fe0",
      "b57f69019e2cded1be648af8f22177705dac24ed3930fbf2f0a240c653edec73",
      "3c2abdbe4acbff9d36124e9236dc5c5e8ce352f3e044f454ca7f68e839535324",
    ],
  );
  assert.equal(p10Round015InwardReturnMask.nextRound.round, 16);
  assert.equal(
    p10Round015InwardReturnMask.nextRound.status,
    "two-segment-limb-silhouette",
  );
  assert.match(
    p10Round015InwardReturnMask.nextRound.target,
    /anatomical two-segment silhouette/i,
  );
  assert.equal(p10Round015InwardReturnMask.conceptArt.length, 1);
  assert.equal(
    p10Round015InwardReturnMask.conceptArt[0].publicPath,
    "/captures/P10/round-015-inward-return-mask/NyraKestrel_InwardReturnMask_CRITIC_REJECTED.png",
  );
  assert.equal(
    createHash("sha256")
      .update(round015RejectedInwardReturnMask)
      .digest("hex"),
    p10Round015InwardReturnMask.conceptArt[0].sha256,
  );
  assert.equal(
    round015RejectedInwardReturnMask.subarray(1, 4).toString("ascii"),
    "PNG",
  );
  assert.equal(round015RejectedInwardReturnMask.readUInt32BE(16), 1536);
  assert.equal(round015RejectedInwardReturnMask.readUInt32BE(20), 1024);
  assert.doesNotMatch(
    JSON.stringify(p10Round015InwardReturnMask),
    /Reference\.zip|Reference\/[^"']+\.(?:png|jpe?g|webp)|\/Users\/|\/home\/|[A-Za-z]:\\Users\\|\/tmp\/|\/private\/var\/folders\//i,
  );

  assert.equal(p10Round016TwoSegmentLimb.piece, "P10");
  assert.equal(p10Round016TwoSegmentLimb.round, 16);
  assert.equal(
    p10Round016TwoSegmentLimb.status,
    "rejected-two-segment-limb",
  );
  assert.equal(p10Round016TwoSegmentLimb.engineRun, true);
  assert.equal(
    p10Round016TwoSegmentLimb.actualGameCapturePerformed,
    true,
  );
  assert.equal(
    p10Round016TwoSegmentLimb.targetMatchedGameCapturePerformed,
    false,
  );
  assert.equal(p10Round016TwoSegmentLimb.gateQualifyingCapture, false);
  assert.equal(
    p10Round016TwoSegmentLimb.source.receiptSha256,
    "46023c8bf566def0efbcd24a19571733f6609342696e52bc56b60b6812cc7743",
  );
  assert.equal(
    p10Round016TwoSegmentLimb.source.readmeSha256,
    "8ba2121e35c1beaea9ce87c2fe594218a2b5b89d3f3eef9d8b9345c56304bc8e",
  );
  assert.equal(
    p10Round016TwoSegmentLimb.source.reviewSha256,
    "639816c57ed54f77a59eb5e0fa3817f7519a20e0e02e42ecc78447ce106cd60d",
  );
  assert.equal(
    p10Round016TwoSegmentLimb.source.deterministicEvidenceSha256,
    "29731c0577d33d4177388606f496df55842fa570f3f415a30bc24811446fbd9e",
  );
  assert.equal(
    p10Round016TwoSegmentLimb.source.guidePngSha256,
    "648fc25ecad74cb0eb5a72cadb3d9eed7e56ed8aeea1a0b44c15d487f63bc9aa",
  );
  assert.equal(
    p10Round016TwoSegmentLimb.source.guideSvgSha256,
    "d56161bc672ab9cd75cf059d645843cf6d057d7830129e3e7640ee076034b283",
  );
  assert.equal(
    p10Round016TwoSegmentLimb.source.finalMaskBinarySha256,
    "76e2aee7ddccfa8aaeee4f711e6740f36df5f49da773e5597a7c1ee024dd1199",
  );
  assert.equal(
    p10Round016TwoSegmentLimb.builderDecision.builderEligibility,
    "FAIL",
  );
  assert.equal(
    p10Round016TwoSegmentLimb.builderDecision.acceptedSha256,
    "b84864e8675c8919798a3d2fe8de2d46dc723efcdc3941df256f912b54ef96ce",
  );
  assert.deepEqual(p10Round016TwoSegmentLimb.anchorContract.shoulder, [604, 472]);
  assert.deepEqual(p10Round016TwoSegmentLimb.anchorContract.elbow, [370, 845]);
  assert.deepEqual(p10Round016TwoSegmentLimb.anchorContract.grip, [450, 625]);
  assert.equal(
    p10Round016TwoSegmentLimb.maskIntegrity.unprotectedCorridorPixels,
    77360,
  );
  assert.equal(
    p10Round016TwoSegmentLimb.maskIntegrity.finalEditablePixels,
    23341,
  );
  assert.equal(
    p10Round016TwoSegmentLimb.maskIntegrity.corridorPixelsRemovedByProtection,
    54019,
  );
  assert.equal(
    p10Round016TwoSegmentLimb.maskIntegrity.outsideMaskMismatchCountPerCandidate,
    0,
  );
  assert.equal(
    p10Round016TwoSegmentLimb.actualPixelAudit.singleConnectedLimbComponentPresent,
    false,
  );
  assert.equal(
    p10Round016TwoSegmentLimb.feasibilityFinding.constraintSet,
    "MUTUALLY_INCOMPATIBLE",
  );
  assert.equal(
    p10Round016TwoSegmentLimb.feasibilityFinding.elbowToGripProtectedFraction,
    1,
  );
  assert.equal(p10Round016TwoSegmentLimb.visualReview.score, 33);
  assert.equal(p10Round016TwoSegmentLimb.visualReview.passThreshold, 95);
  assert.equal(
    p10Round016TwoSegmentLimb.visualReview.observedMinimumCategoryScore,
    0,
  );
  assert.equal(
    p10Round016TwoSegmentLimb.visualReview.candidatePreferredCount,
    0,
  );
  assert.equal(
    p10Round016TwoSegmentLimb.visualReview.requiredCandidatePreferredCount,
    5,
  );
  assert.equal(
    p10Round016TwoSegmentLimb.visualReview.categoryScores
      .anatomicalTwoSegmentSilhouette,
    0,
  );
  assert.equal(
    p10Round016TwoSegmentLimb.visualReview.categoryScores
      .round016EngineIntegrationAndMatchedCaptureFidelity,
    0,
  );
  assert.match(
    p10Round016TwoSegmentLimb.visualReview.singleBiggestGap,
    /no connected shoulder-to-elbow-to-grip arm/i,
  );
  assert.equal(p10Round016TwoSegmentLimb.engineTruth.exitCode, 0);
  assert.equal(
    p10Round016TwoSegmentLimb.engineTruth.visibleAsset,
    "P10_AstraValeHero Round001",
  );
  assert.equal(p10Round016TwoSegmentLimb.engineTruth.round016NyraVisible, false);
  assert.equal(p10Round016TwoSegmentLimb.publicEvidence.length, 3);
  assert.deepEqual(
    p10Round016TwoSegmentLimb.publicEvidence.map((asset) => asset.sha256),
    [
      createHash("sha256").update(round016RejectedTwoSegmentLimb).digest("hex"),
      createHash("sha256").update(round016FreshEngineS01).digest("hex"),
      createHash("sha256").update(round016FreshEngineTurntable).digest("hex"),
    ],
  );
  assert.deepEqual(
    p10Round016TwoSegmentLimb.publicEvidence.map((asset) => asset.dimensions),
    [
      { width: 1536, height: 1024 },
      { width: 1600, height: 900 },
      { width: 1600, height: 900 },
    ],
  );
  assert.equal(p10Round016TwoSegmentLimb.builderAttempts.length, 4);
  assert.equal(
    p10Round016TwoSegmentLimb.builderAttempts[3].protectedSha256,
    "b84864e8675c8919798a3d2fe8de2d46dc723efcdc3941df256f912b54ef96ce",
  );
  assert.equal(p10Round016TwoSegmentLimb.nextRound.round, 17);
  assert.equal(
    p10Round016TwoSegmentLimb.nextRound.status,
    "local-constraint-release",
  );
  assert.match(
    p10Round016TwoSegmentLimb.nextRound.target,
    /closed anchor triangle dilated 62 pixels/i,
  );
  assert.equal(
    p10Round016TwoSegmentLimb.nextRound.gate.realTargetRelevantEngineCaptureRequired,
    true,
  );
  for (const image of [
    round016RejectedTwoSegmentLimb,
    round016FreshEngineS01,
    round016FreshEngineTurntable,
  ]) {
    assert.equal(image.subarray(1, 4).toString("ascii"), "PNG");
  }
  assert.doesNotMatch(
    JSON.stringify(p10Round016TwoSegmentLimb),
    /Reference\.zip|Reference\/[^"']+\.(?:png|jpe?g|webp)|\/Users\/|\/home\/|[A-Za-z]:\\Users\\|\/tmp\/|\/private\/var\/folders\//i,
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

test("Round017 local-constraint release is public-safe, hash-verified, and rejected", async () => {
  const [
    dashboard,
    p00Manifest,
    latestManifest,
    round017,
    rejectedProof,
    judgePanel,
    carriedForwardEngineContext,
  ] = await Promise.all([
    readFile(dataUrl, "utf8").then(JSON.parse),
    readFile(
      new URL("../public/data/P00-round-001-manifest.json", import.meta.url),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL("../public/data/capture-manifest-latest.json", import.meta.url),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL(
        "../public/data/P10-round-017-local-constraint-release.json",
        import.meta.url,
      ),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL(
        "../public/captures/P10/round-017-local-constraint-release/NyraKestrel_LocalConstraintRelease_CRITIC_REJECTED.png",
        import.meta.url,
      ),
    ),
    readFile(
      new URL(
        "../public/captures/P10/round-017-local-constraint-release/P10_Round017_JudgePanel.png",
        import.meta.url,
      ),
    ),
    readFile(
      new URL(
        "../public/captures/P10/round-016-two-segment-limb/S01_FreshEngineGate_OldAstraVale.png",
        import.meta.url,
      ),
    ),
  ]);

  assert.deepEqual(latestManifest, p00Manifest);
  assert.equal(latestManifest.piece, "P00");
  assert.equal(round017.schemaVersion, 1);
  assert.equal(round017.piece, "P10");
  assert.equal(round017.round, 17);
  assert.equal(round017.status, "rejected-local-constraint-release");
  assert.equal(round017.engineRun, true);
  assert.equal(round017.actualGameCapturePerformed, true);
  assert.equal(round017.targetMatchedGameCapturePerformed, false);
  assert.equal(round017.gateQualifyingCapture, false);

  assert.equal(
    round017.source.receiptSha256,
    "0279bbc4c551e0271b9fb19e771cd755ccd103eee4e5a61552104a416f349347",
  );
  assert.equal(
    round017.source.validationJsonSha256,
    "6ec63117ba70285a94b56a937b6056e31c69f1a92e9e277aa5ea0a3955f9c1e1",
  );
  assert.equal(
    round017.source.validationTextSha256,
    "213174d421a077efe89bf5beed90231ab15d702cbaa316a301150fe69bc638f5",
  );
  assert.equal(
    round017.source.readmeSha256,
    "0b8936a10f4cf2074327f7f5c9e4465316ef794d883f11b023794c42788c052d",
  );
  assert.equal(
    round017.source.reviewSha256,
    "982e6e5ebfd84d4929e57e994ad9809f373fafedebce974f9ad3e12b958d95fe",
  );
  assert.equal(round017.source.reviewByteSize, 31104);

  assert.deepEqual(
    round017.releaseSanitization.builderNonvisualOriginalToReleaseSha256,
    {
      receipt: {
        original:
          "124356a6012cec52035d712bb5ff553e252d279ceac90a26aadc273fea7a3deb",
        release:
          "0279bbc4c551e0271b9fb19e771cd755ccd103eee4e5a61552104a416f349347",
      },
      validationJson: {
        original:
          "13c9623f50aa6182ecf90a180540806ea4e8943934a36060fc98d1eaafbf2e8c",
        release:
          "6ec63117ba70285a94b56a937b6056e31c69f1a92e9e277aa5ea0a3955f9c1e1",
      },
      readme: {
        original:
          "45d4eed17ef408b5e3727fc0dce5af9c1e2b7f326ac694c88ff7f0474586feae",
        release:
          "0b8936a10f4cf2074327f7f5c9e4465316ef794d883f11b023794c42788c052d",
      },
      compositor: {
        original:
          "0ba7d9c840cd670b02923b06ff5447e7a265a00890d20db7832e9ac6e3992e41",
        release:
          "fcca2cdb74e076a5e84e6687ff0934e6adf2df2e2329269d80ff16290dedee8a",
      },
      sealScript: {
        original:
          "b38a56cd4fdb2fb1bb8c124197710551025c6baa144bebbdf2229facf4cb7bca",
        release:
          "d4c892cbca358951f965fdbb362570a97f5adc58b8dcf4d36b7adf83d1e00793",
      },
    },
  );
  assert.deepEqual(round017.releaseSanitization.criticReview, {
    originalSealedSha256:
      "bf77d067967b2b530362162a624d84e73ef3269a6a4c5a175820b0babcf2ca02",
    releaseSha256:
      "982e6e5ebfd84d4929e57e994ad9809f373fafedebce974f9ad3e12b958d95fe",
    releaseByteSize: 31104,
    sanitizedPrivateBenchmarkDerivedHashFieldCount: 16,
    sanitizedPrivateBlindSeedFieldCount: 1,
    protectedSemanticComparison: "PASS",
  });
  assert.deepEqual(round017.releaseSanitization.visualArtifacts, {
    pngCount: 23,
    allPngsByteIdentical: true,
    statement: "All 23 PNGs are unchanged.",
  });
  assert.equal(round017.releaseSanitization.verdictUnchanged, true);
  assert.equal(round017.releaseSanitization.scoresUnchanged, true);
  assert.equal(round017.releaseSanitization.engineFactsUnchanged, true);
  assert.equal(round017.releaseSanitization.decodedPixelFactsUnchanged, true);
  assert.equal(round017.releaseSanitization.singleBiggestGapUnchanged, true);
  assert.equal(round017.releaseSanitization.round018PrescriptionUnchanged, true);

  assert.equal(round017.builderDecision.builderEligibility, "FAIL");
  assert.equal(
    round017.builderDecision.acceptedSha256,
    "de3f1be07757f516c6a194a870cc59903f40a0623872bf7dfa6cf549c5fcbcae",
  );
  assert.deepEqual(round017.anchorContract.shoulder, [604, 472]);
  assert.deepEqual(round017.anchorContract.elbow, [370, 845]);
  assert.deepEqual(round017.anchorContract.grip, [450, 625]);
  assert.equal(round017.maskIntegrity.triangleDilated62Pixels, 78151);
  assert.equal(round017.maskIntegrity.gripRestoreDiskRadiusPixels, 24);
  assert.equal(round017.maskIntegrity.changedPixelsOutsideRevisedMask, 0);
  assert.equal(round017.maskIntegrity.changedPixelsInsideGripRestoreDisk, 0);
  assert.equal(
    round017.maskIntegrity.allChangedPixelsSingle8ConnectedComponent,
    true,
  );
  assert.equal(
    round017.geometryFinding.actualLargestUninterruptedPaleComponentPixels,
    22,
  );
  assert.equal(round017.geometryFinding.requiredPaleComponentPixels, 5525);
  assert.deepEqual(
    round017.geometryFinding.smallestAdmissibleElbowOnlyChange.from,
    [370, 845],
  );
  assert.deepEqual(
    round017.geometryFinding.smallestAdmissibleElbowOnlyChange.to,
    [484, 894],
  );

  assert.equal(round017.visualReview.score, 31);
  assert.equal(round017.visualReview.maximum, 100);
  assert.equal(round017.visualReview.observedMinimumCategoryScore, 0);
  assert.equal(round017.visualReview.candidatePreferredCount, 0);
  assert.equal(round017.visualReview.comparisonCount, 6);
  assert.equal(round017.visualReview.requiredCandidatePreferredCount, 5);
  assert.equal(round017.visualReview.benchmarkGateResult, "FAIL");
  assert.equal(
    round017.visualReview.singleBiggestGap,
    "The trailing limb is a fused, colossal third-leg/shield mass with a punched-through hand and no readable interior wedge, so it destroys anatomy, grip depth, the rear leg, and the gameplay silhouette in one dominant defect.",
  );

  assert.equal(round017.engineTruth.exitCode, 0);
  assert.equal(round017.engineTruth.captureResult, "PASS");
  assert.equal(round017.engineTruth.engineRun, true);
  assert.equal(round017.engineTruth.actualGameCapturePerformed, true);
  assert.equal(round017.engineTruth.targetMatchedGameCapturePerformed, false);
  assert.equal(round017.engineTruth.gateQualifyingCapture, false);
  assert.equal(round017.engineTruth.round017NyraVisible, false);
  assert.equal(round017.engineTruth.round017NyraAssetsFound, 0);
  assert.equal(
    round017.engineTruth.freshEngineManifestSha256,
    "af69f4b7825c556e5bf388186f9e0ad17b5545cc4122cdb4e5410cb3993d436c",
  );
  assert.equal(
    round017.engineTruth.freshEngineLogSha256,
    "7d0d697ded82c1095d728a797d494979db502262b26aaf3c7a075a393f2c8261",
  );
  assert.equal(
    round017.engineTruth.freshS01.sha256,
    "afff193d2efeff8d092df787ccb9af69f2b7dad93268806c0539cf3cd0436c81",
  );
  assert.equal(round017.engineTruth.freshS01.byteSize, 1634951);
  assert.deepEqual(round017.engineTruth.freshS01.dimensions, {
    width: 1600,
    height: 900,
  });
  assert.match(
    round017.engineTruth.freshS01.publicationStatus,
    /private-run evidence; moved to private Trash after review and not published/i,
  );
  assert.equal("publicPath" in round017.engineTruth.freshS01, false);

  const proofSha256 = createHash("sha256").update(rejectedProof).digest("hex");
  const judgeSha256 = createHash("sha256").update(judgePanel).digest("hex");
  const contextSha256 = createHash("sha256")
    .update(carriedForwardEngineContext)
    .digest("hex");
  assert.deepEqual(
    round017.publicEvidence.map((asset) => asset.sha256),
    [proofSha256, judgeSha256],
  );
  assert.deepEqual(
    round017.publicEvidence.map((asset) => asset.publicPath),
    [
      "/captures/P10/round-017-local-constraint-release/NyraKestrel_LocalConstraintRelease_CRITIC_REJECTED.png",
      "/captures/P10/round-017-local-constraint-release/P10_Round017_JudgePanel.png",
    ],
  );
  assert.deepEqual(
    round017.publicEvidence.map((asset) => asset.dimensions),
    [
      { width: 1536, height: 1024 },
      { width: 900, height: 1308 },
    ],
  );
  assert.equal(proofSha256, "de3f1be07757f516c6a194a870cc59903f40a0623872bf7dfa6cf549c5fcbcae");
  assert.equal(judgeSha256, "da5ad839b4a5d27bb255f062fa0a97aca8f36bbbf00a454bc033e130abe41a02");
  assert.equal(rejectedProof.length, 1531662);
  assert.equal(judgePanel.length, 772873);
  assert.equal(rejectedProof.subarray(1, 4).toString("ascii"), "PNG");
  assert.equal(rejectedProof.readUInt32BE(16), 1536);
  assert.equal(rejectedProof.readUInt32BE(20), 1024);
  assert.equal(judgePanel.subarray(1, 4).toString("ascii"), "PNG");
  assert.equal(judgePanel.readUInt32BE(16), 900);
  assert.equal(judgePanel.readUInt32BE(20), 1308);

  assert.equal(
    round017.carriedForwardPublicEngineContext.sha256,
    contextSha256,
  );
  assert.equal(
    round017.carriedForwardPublicEngineContext.publicPath,
    "/captures/P10/round-016-two-segment-limb/S01_FreshEngineGate_OldAstraVale.png",
  );
  assert.match(
    round017.carriedForwardPublicEngineContext.label,
    /carried-forward Round016 public Unity context/i,
  );
  assert.notEqual(contextSha256, round017.engineTruth.freshS01.sha256);

  assert.equal(round017.nextRound.round, 18);
  assert.equal(
    round017.nextRound.exactlyOneConstraintChange,
    "Move only elbow E from (370,845) to (484,894).",
  );
  assert.deepEqual(round017.nextRound.anchors.shoulderFixed, [604, 472]);
  assert.deepEqual(round017.nextRound.anchors.elbowFrom, [370, 845]);
  assert.deepEqual(round017.nextRound.anchors.elbowTo, [484, 894]);
  assert.deepEqual(round017.nextRound.anchors.gripFixed, [450, 625]);
  assert.equal(round017.nextRound.gripRestoreRadiusPixels, 24);
  assert.deepEqual(round017.nextRound.minimumSegmentWidthsPixels, {
    upper: 70,
    return: 64,
  });
  assert.equal(round017.nextRound.minimumUninterruptedPaleComponentPixels, 5525);
  assert.match(round017.nextRound.maskRule, /triangle dilated by 62 pixels/i);
  assert.deepEqual(round017.nextRound.prohibitions, [
    "no socket disk",
    "no halo",
    "no unauthorized overwrite",
  ]);
  assert.match(round017.nextRound.gameDelivery, /actual 3D Nyra game asset/i);
  assert.match(round017.nextRound.gameDelivery, /2D proof cannot qualify/i);
  assert.equal(
    round017.nextRound.gate.realTargetRelevantEngineCaptureRequired,
    true,
  );

  assert.equal(dashboard.activeBuild.pieceId, "P30");
  assert.equal(dashboard.activeBuild.round, 8);
  assert.equal(dashboard.rounds.at(-9).pieceId, "P10");
  assert.equal(dashboard.rounds.at(-9).round, 17);
  assert.equal(dashboard.rounds.at(-9).critic.score, 31);
  assert.equal(dashboard.rounds.at(-1).pieceId, "P30");
  assert.equal(dashboard.activeBuild.evidenceBundle.manifestPath, "/data/P30-round-008.json");

  const round017Json = JSON.stringify(round017);
  assert.doesNotMatch(
    round017Json,
    /Reference\.zip|Reference\/[^"']+\.(?:png|jpe?g|webp)|\/Users\/|\/home\/|[A-Za-z]:\\Users\\|\/tmp\/|\/private\/var\/folders\//i,
  );
  assert.doesNotMatch(
    round017Json,
    /benchmarkArchiveSha256|pairSha256|anonymousReferenceSha256|mappingTranscriptSha256|blindContactSheetSha256|blindPairs|mappingTranscript/i,
  );
  const publicEntries = await readdir(publicRoot, { recursive: true });
  for (const entry of publicEntries) {
    if (!entry.toLowerCase().endsWith(".png")) {
      continue;
    }
    const publicPng = await readFile(new URL(entry, publicRoot));
    assert.notEqual(
      createHash("sha256").update(publicPng).digest("hex"),
      round017.engineTruth.freshS01.sha256,
      `Nonpublished Round017 fresh S01 must not be fabricated at public/${entry}`,
    );
  }
});

test("P30 Round001 publishes only sanitized rejected candidate evidence", async () => {
  const [dashboard, p30, p00Manifest, latestManifest, captureNames] =
    await Promise.all([
      readFile(dataUrl, "utf8").then(JSON.parse),
      readFile(
        new URL("../public/data/P30-round-001.json", import.meta.url),
        "utf8",
      ).then(JSON.parse),
      readFile(
        new URL("../public/data/P00-round-001-manifest.json", import.meta.url),
        "utf8",
      ).then(JSON.parse),
      readFile(
        new URL("../public/data/capture-manifest-latest.json", import.meta.url),
        "utf8",
      ).then(JSON.parse),
      readdir(
        new URL("../public/captures/P30/round-001/", import.meta.url),
      ),
    ]);

  assert.deepEqual(latestManifest, p00Manifest);
  assert.equal(latestManifest.piece, "P00");
  assert.equal(dashboard.activeBuild.pieceId, "P30");
  assert.equal(dashboard.activeBuild.round, 8);
  assert.equal(
    dashboard.activeBuild.evidenceBundle.status,
    "INDEPENDENT CRITIC RUNNING · NOT ACCEPTED",
  );
  assert.deepEqual(captureNames.sort(), ["S01.png", "S02.png", "S04.png"]);

  assert.equal(p30.schema, "cow.public-browser-critic.v1");
  assert.equal(p30.piece, "P30");
  assert.equal(p30.round, 1);
  assert.equal(p30.date, "2026-08-01");
  assert.equal(p30.status, "rejected-foundation-evidence");
  assert.match(p30.acceptanceScope, /not AAA acceptance/i);
  assert.deepEqual(p30.verdict, {
    result: "FAIL",
    overallScore: 28,
    maximumScore: 100,
    categoryFloor: 1,
    categoryMaximum: 10,
    candidateWins: 0,
    comparisonCount: 6,
  });
  assert.equal(
    p30.auditEnvironment.browser,
    "Google Chrome for Testing 151.0.7922.34",
  );
  assert.equal(p30.auditEnvironment.headed, true);
  assert.equal(p30.auditEnvironment.hardwareAccelerated, true);
  assert.match(p30.auditEnvironment.renderer, /ANGLE Metal Renderer: Apple M2/);

  assert.equal(p30.deterministicReplays.tapeA.mechanicsPass, true);
  assert.equal(
    p30.deterministicReplays.tapeA.simulationSnapshotsExactAcrossTwoRuns,
    true,
  );
  assert.equal(
    p30.deterministicReplays.tapeA.eventsExactAcrossTwoRuns,
    true,
  );
  assert.equal(
    p30.deterministicReplays.tapeA.cameraPresentationExactAcrossTwoRuns,
    false,
  );
  assert.equal(p30.deterministicReplays.tapeB.pass, true);
  assert.equal(p30.deterministicReplays.tapeB.hitCount, 0);
  assert.equal(p30.validatedPasses.fixedSurface.pass, true);
  assert.equal(p30.validatedPasses.contextRecovery.pass, true);
  assert.equal(p30.validatedPasses.warmRuntime.pass, true);
  assert.equal(p30.validatedPasses.warmRuntime.medianMilliseconds, 16.7);
  assert.equal(p30.validatedPasses.warmRuntime.p95Milliseconds, 18.6);

  assert.equal(p30.hardFailures.length, 4);
  assert.match(p30.hardFailures[0], /camera obstruction is absent/i);
  assert.match(p30.hardFailures[1], /nondeterministic after reset/i);
  assert.match(p30.hardFailures[2], /pointer-lock and camera-look path failed/i);
  assert.match(p30.hardFailures[3], /28\/100/i);
  assert.equal(p30.additionalGateFailures.coldReady.observedSeconds, 2.94);
  assert.deepEqual(p30.additionalGateFailures.cameraProjection, {
    observed: { fovDegrees: 58, farMeters: 110 },
    required: { fovDegrees: 50, farMeters: 120 },
    pass: false,
  });
  assert.match(
    p30.additionalGateFailures.pauseInputRelease.observation,
    /held movement key survives pause/i,
  );

  assert.deepEqual(p30.assetReadiness, {
    status: "provenance-ready-not-integrated",
    curatedRuntimeSetMegabytes: 27.3,
    receiptFiles: { matched: 80, total: 80 },
    glbImports: { passed: 16, total: 16 },
    ignoredRawCacheMegabytes: 475.3,
    integrationState:
      "The curated set is validated and ready; neither it nor the ignored raw cache is integrated yet.",
  });
  assert.equal(p30.primaryGap.id, "prototype_grade_presentation_layer");
  assert.match(p30.primaryGap.prescription, /replace only the hero, Hollow/i);
  assert.equal(
    JSON.stringify(p30).match(/prototype_grade_presentation_layer/g)?.length,
    1,
  );
  assert.deepEqual(
    p30.captures.map((capture) => capture.path),
    [
      "/captures/P30/round-001/S01.png",
      "/captures/P30/round-001/S02.png",
      "/captures/P30/round-001/S04.png",
    ],
  );

  const p30Json = JSON.stringify(p30);
  assert.doesNotMatch(
    p30Json,
    /sha256|\bhash(?:es)?\b|blindPairs|lockedWinner|revealedWinner|\bR\d{2}\b|Reference(?:\.zip|\/)|\/Users\/|\/home\/|[A-Za-z]:\\Users\\|\/tmp\/|\/private\/var\/folders\/|archive|download|workspace_root|google drive|drive id|query|seed/i,
  );

  for (const captureName of captureNames) {
    const image = await readFile(
      new URL(`../public/captures/P30/round-001/${captureName}`, import.meta.url),
    );
    assert.equal(image.subarray(1, 4).toString("ascii"), "PNG");
    assert.equal(image.readUInt32BE(16), 1600);
    assert.equal(image.readUInt32BE(20), 900);

    const chunks = [];
    for (let offset = 8; offset < image.length; ) {
      const length = image.readUInt32BE(offset);
      chunks.push(image.subarray(offset + 4, offset + 8).toString("ascii"));
      offset += length + 12;
    }
    assert.ok(chunks.every((chunk) => ["IHDR", "IDAT", "IEND"].includes(chunk)));
  }
});

test("P30 Round002 publishes sanitized rejected candidate evidence while accepted latest stays P00-pinned", async () => {
  const [dashboard, p30, p00Manifest, latestManifest, captureNames] =
    await Promise.all([
      readFile(dataUrl, "utf8").then(JSON.parse),
      readFile(
        new URL("../public/data/P30-round-002.json", import.meta.url),
        "utf8",
      ).then(JSON.parse),
      readFile(
        new URL("../public/data/P00-round-001-manifest.json", import.meta.url),
        "utf8",
      ).then(JSON.parse),
      readFile(
        new URL("../public/data/capture-manifest-latest.json", import.meta.url),
        "utf8",
      ).then(JSON.parse),
      readdir(
        new URL("../public/captures/P30/round-002/", import.meta.url),
      ),
    ]);

  assert.deepEqual(latestManifest, p00Manifest);
  assert.equal(latestManifest.piece, "P00");
  assert.equal(dashboard.activeBuild.pieceId, "P30");
  assert.equal(dashboard.activeBuild.round, 8);
  assert.equal(dashboard.activeBuild.roundLabel, "P30 · Round 008");
  assert.equal(dashboard.canonicalCapture.manifestPath, "/data/P30-round-008.json");
  assert.deepEqual(captureNames.sort(), ["S02.png", "S04.png", "S06.png"]);

  assert.equal(p30.schema, "cow.public-browser-critic.v1");
  assert.equal(p30.piece, "P30");
  assert.equal(p30.round, 2);
  assert.equal(p30.status, "rejected-candidate-evidence");
  assert.match(p30.acceptanceScope, /not accepted evidence/i);
  assert.deepEqual(p30.verdict, {
    result: "REJECT",
    overallScore: 25,
    maximumScore: 100,
    candidateWins: 0,
    comparisonCount: 6,
  });
  assert.match(p30.auditEnvironment.context, /fresh independent headed/i);
  assert.equal(p30.auditEnvironment.browser, "Google Chrome");
  assert.equal(p30.auditEnvironment.headed, true);
  assert.equal(p30.auditEnvironment.hardwareAccelerated, true);
  assert.match(p30.auditEnvironment.renderer, /ANGLE Metal Renderer: Apple M2/);

  assert.deepEqual(p30.assetIntegration, {
    status: "integrated-provenance-ready",
    authoredAssetsLoaded: 18,
    authoredAssetsExpected: 18,
    proceduralFallbackActive: false,
    pmremInstalled: true,
  });
  assert.equal(
    p30.deterministicReplays.tapeA.simulationSnapshotsExactAcrossTwoRuns,
    true,
  );
  assert.equal(p30.deterministicReplays.tapeA.eventsExactAcrossTwoRuns, true);
  assert.equal(
    p30.deterministicReplays.tapeA.cameraPresentationExactAcrossTwoRuns,
    false,
  );
  assert.equal(p30.deterministicReplays.tapeB.pass, true);
  assert.equal(p30.deterministicReplays.tapeB.hitCount, 0);
  assert.equal(p30.validatedPasses.frameTimeAndResourceCeilings, true);
  assert.equal(p30.validatedPasses.warmRuntime.medianMilliseconds, 16.7);
  assert.equal(p30.validatedPasses.warmRuntime.worstP95Milliseconds, 18.5);
  assert.equal(p30.validatedPasses.warmRuntime.worstP99Milliseconds, 18.7);

  assert.equal(p30.hardFailures.length, 9);
  assert.ok(p30.hardFailures.some((failure) => /camera presentation/i.test(failure)));
  assert.ok(p30.hardFailures.some((failure) => /obstruction/i.test(failure)));
  assert.ok(p30.hardFailures.some((failure) => /58° \/ 110/i.test(failure)));
  assert.ok(p30.hardFailures.some((failure) => /pointer lock/i.test(failure)));
  assert.ok(p30.hardFailures.some((failure) => /hit shake/i.test(failure)));
  assert.ok(p30.hardFailures.some((failure) => /survives pause/i.test(failure)));
  assert.ok(p30.hardFailures.some((failure) => /runtime error/i.test(failure)));
  assert.ok(p30.hardFailures.some((failure) => /4\.109 s/i.test(failure)));
  assert.equal(p30.primaryGap.id, "cohesive_aaa_combat_presentation");
  assert.match(p30.primaryGap.prescription, /existing hero, Hollow, claymore/i);
  assert.match(p30.primaryGap.prescription, /mechanics, camera, input, HUD, and the review contract frozen/i);
  assert.equal(
    JSON.stringify(p30).match(/cohesive_aaa_combat_presentation/g)?.length,
    1,
  );
  assert.deepEqual(
    p30.captures.map((capture) => capture.path),
    [
      "/captures/P30/round-002/S02.png",
      "/captures/P30/round-002/S04.png",
      "/captures/P30/round-002/S06.png",
    ],
  );

  const p30Json = JSON.stringify(p30);
  assert.doesNotMatch(
    p30Json,
    /sha256|\bhash(?:es)?\b|pairId|lockedWinner|revealedWinner|\breason\b|P-[A-F0-9]{6}|\bR\d{2}\b|Reference(?:\.zip|\/)|reveal mapping|hidden key|\/Users\/|\/home\/|[A-Za-z]:\\Users\\|\/tmp\/|\/private\/var\/folders\/|archive|download|workspace_root|seed/i,
  );

  for (const captureName of captureNames) {
    const image = await readFile(
      new URL(`../public/captures/P30/round-002/${captureName}`, import.meta.url),
    );
    assert.equal(image.subarray(1, 4).toString("ascii"), "PNG");
    assert.equal(image.readUInt32BE(16), 1600);
    assert.equal(image.readUInt32BE(20), 900);

    const chunks = [];
    for (let offset = 8; offset < image.length; ) {
      const length = image.readUInt32BE(offset);
      chunks.push(image.subarray(offset + 4, offset + 8).toString("ascii"));
      offset += length + 12;
    }
    assert.ok(chunks.every((chunk) => ["IHDR", "IDAT", "IEND"].includes(chunk)));
  }
});

test("P30 Round003 remains published after the active build advances through Round004", async () => {
  const [
    dashboard,
    p30,
    p00ManifestBytes,
    latestManifestBytes,
    captureNames,
  ] = await Promise.all([
    readFile(dataUrl, "utf8").then(JSON.parse),
    readFile(
      new URL("../public/data/P30-round-003.json", import.meta.url),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL("../public/data/P00-round-001-manifest.json", import.meta.url),
    ),
    readFile(
      new URL("../public/data/capture-manifest-latest.json", import.meta.url),
    ),
    readdir(new URL("../public/captures/P30/round-003/", import.meta.url)),
  ]);

  assert.equal(latestManifestBytes.equals(p00ManifestBytes), true);
  assert.equal(dashboard.project.updated, "2026-08-02");
  assert.equal(dashboard.activeBuild.pieceId, "P30");
  assert.equal(dashboard.activeBuild.round, 8);
  assert.equal(dashboard.activeBuild.roundLabel, "P30 · Round 008");
  assert.equal(dashboard.activeBuild.status, "review-ready");
  assert.equal(
    dashboard.activeBuild.builder,
    "Selected Combat-FX Candidate · Independent Critic Running",
  );
  assert.equal(
    dashboard.activeBuild.evidenceBundle.manifestPath,
    "/data/P30-round-008.json",
  );
  assert.equal(
    dashboard.canonicalCapture.capturePath,
    "/captures/P30/round-008/S04.png",
  );
  assert.equal(
    dashboard.canonicalCapture.manifestPath,
    "/data/P30-round-008.json",
  );
  assert.deepEqual(captureNames.sort(), ["S02.png", "S04.png", "S06.png"]);

  assert.equal(p30.schema, "cow.public-browser-critic.v1");
  assert.equal(p30.piece, "P30");
  assert.equal(p30.round, 3);
  assert.equal(p30.date, "2026-08-02");
  assert.equal(p30.status, "rejected-candidate-evidence");
  assert.match(p30.acceptanceScope, /not accepted evidence/i);
  assert.deepEqual(p30.verdict, {
    result: "REJECT",
    overallScore: 30,
    maximumScore: 100,
    candidateWins: 0,
    comparisonCount: 6,
    comparisonStrength: "All six outcomes were overwhelming.",
  });
  assert.deepEqual(p30.blindReview, {
    privateChoicesLockedBeforeReveal: true,
    privateWorkspaceDeletedAndVerified: true,
    publishedScope: "Aggregate result and rejected candidate captures only.",
  });
  assert.deepEqual(p30.auditEnvironment, {
    context: "fresh independent headed production-browser audit",
    browser: "Google Chrome 150",
    headed: true,
    hardwareAccelerated: true,
    renderer: "WebGL2 · ANGLE Metal Renderer: Apple M2",
    viewport: "1600×900",
    deviceScaleFactor: 1,
  });
  assert.deepEqual(p30.categoryScores, {
    compositionCamera: 3,
    characterAnimation: 2,
    environmentMaterialsLighting: 4,
    combatReadabilityImpact: 2,
    technical: 5,
    aaaFinish: 2,
  });
  assert.deepEqual(p30.assetIntegration, {
    authoredAssetsLoaded: 18,
    authoredAssetsExpected: 18,
    proceduralFallbackActive: false,
    pmremInstalled: true,
  });
  assert.deepEqual(p30.deterministicReplays, {
    tapeA: {
      simulationPass: true,
      eventsPass: true,
      timingPass: true,
      cameraReplayPass: false,
    },
    tapeB: { pass: true },
    tapeC: { obstructionPass: false },
  });
  assert.equal(p30.validatedPasses.physicalBindings, true);
  assert.equal(p30.validatedPasses.blurHandling, true);
  assert.equal(p30.validatedPasses.resizeAndDevicePixelRatioHandling, true);
  assert.equal(p30.validatedPasses.webglRestore, true);
  assert.deepEqual(p30.validatedPasses.performanceAndResources, {
    pass: true,
    sampleCount: 3,
    secondsPerSample: 30,
    worst: {
      medianMilliseconds: 16.7,
      p95Milliseconds: 18.5,
      p99Milliseconds: 18.7,
      drawCalls: 75,
      triangles: 176017,
      textures: 30,
      geometries: 30,
    },
  });
  assert.equal(p30.hardFailures.length, 9);
  assert.ok(p30.hardFailures.some((failure) => /camera replay/i.test(failure)));
  assert.ok(p30.hardFailures.some((failure) => /Tape C obstruction/i.test(failure)));
  assert.ok(p30.hardFailures.some((failure) => /58° \/ 0\.08 \/ 110/i.test(failure)));
  assert.ok(p30.hardFailures.some((failure) => /50° \/ 0\.08 \/ 120/i.test(failure)));
  assert.ok(p30.hardFailures.some((failure) => /WrongDocumentError/i.test(failure)));
  assert.ok(p30.hardFailures.some((failure) => /reset replay/i.test(failure)));
  assert.ok(p30.hardFailures.some((failure) => /held key survives pause/i.test(failure)));
  assert.ok(p30.hardFailures.some((failure) => /runtime-error-free interaction/i.test(failure)));
  assert.ok(p30.hardFailures.some((failure) => /5\.817 s/i.test(failure)));
  assert.ok(p30.hardFailures.some((failure) => /blind gate/i.test(failure)));
  assert.deepEqual(p30.payloads, {
    environmentBytes: 3349498,
    enabledBytes: 15961504,
  });
  assert.deepEqual(p30.p31Provenance, {
    glbsReady: 22,
    glbsExpected: 22,
    webpsReady: 6,
    officialCc0Provenance: true,
    runtimeFilesByteIdentical: 12,
    frozenSubsystemHashesUnchanged: 11,
  });
  assert.equal(p30.primaryGap.id, "character_combat_fidelity");
  assert.match(p30.primaryGap.prescription, /hero, Hollow, and claymore render assets and materials/i);
  assert.match(p30.primaryGap.prescription, /rig, grip, and contact offsets/i);
  assert.match(p30.primaryGap.prescription, /existing attack and reaction presentation clips/i);
  assert.equal(p30.primaryGap.freeze, "Freeze every other domain.");
  assert.match(p30.primaryGap.successCriterion, /fresh independent S03–S05 result wins 3\/3 matched blind comparisons/i);

  const allowedRound003CapturePaths = [
    "/captures/P30/round-003/S02.png",
    "/captures/P30/round-003/S04.png",
    "/captures/P30/round-003/S06.png",
  ];
  assert.deepEqual(
    p30.captures.map((capture) => capture.path),
    allowedRound003CapturePaths,
  );
  const publishedRound003Paths = [
    ...new Set(
      JSON.stringify({ dashboard, p30 }).match(
        /\/captures\/P30\/round-003\/[^"\\]+/g,
      ) ?? [],
    ),
  ].sort();
  assert.deepEqual(publishedRound003Paths, allowedRound003CapturePaths);

  const publicRound003Json = JSON.stringify({
    activeBuild: dashboard.activeBuild,
    canonicalCapture: dashboard.canonicalCapture,
    roundHistory: dashboard.rounds.at(-1),
    evidence: p30,
  });
  assert.doesNotMatch(publicRound003Json, /Reference\s+\d+/i);
  assert.doesNotMatch(publicRound003Json, /\bR\d{2}\b/);
  assert.doesNotMatch(
    publicRound003Json,
    /"(?:pairId|pairIdentifier|candidateSide|referenceSide|benchmarkSide|benchmarkFilename|benchmarkFile|benchmarkImage|referenceFilename|lockedWinner|revealedWinner|hiddenKey)"\s*:/i,
  );
  assert.doesNotMatch(
    publicRound003Json,
    /Reference\.zip|Reference\/[^"']+\.(?:png|jpe?g|webp)|reveal mapping|hidden key|\/Users\/|\/home\/|[A-Za-z]:\\Users\\|\/tmp\/|\/private\/var\/folders\//i,
  );

  for (const captureName of captureNames) {
    const image = await readFile(
      new URL(`../public/captures/P30/round-003/${captureName}`, import.meta.url),
    );
    assert.equal(image.subarray(1, 4).toString("ascii"), "PNG");
    assert.equal(image.readUInt32BE(16), 1600);
    assert.equal(image.readUInt32BE(20), 900);

    const chunks = [];
    for (let offset = 8; offset < image.length; ) {
      const length = image.readUInt32BE(offset);
      chunks.push(image.subarray(offset + 4, offset + 8).toString("ascii"));
      offset += length + 12;
    }
    assert.ok(chunks.every((chunk) => ["IHDR", "IDAT", "IEND"].includes(chunk)));
  }
});

test("P30 Round004 publishes sanitized rejected evidence and advances the active build to Round005", async () => {
  const [
    dashboard,
    p30,
    p00ManifestBytes,
    latestManifestBytes,
    captureNames,
  ] = await Promise.all([
    readFile(dataUrl, "utf8").then(JSON.parse),
    readFile(
      new URL("../public/data/P30-round-004.json", import.meta.url),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL("../public/data/P00-round-001-manifest.json", import.meta.url),
    ),
    readFile(
      new URL("../public/data/capture-manifest-latest.json", import.meta.url),
    ),
    readdir(new URL("../public/captures/P30/round-004/", import.meta.url)),
  ]);

  assert.equal(latestManifestBytes.equals(p00ManifestBytes), true);
  assert.equal(dashboard.activeBuild.pieceId, "P30");
  assert.equal(dashboard.activeBuild.round, 8);
  assert.equal(dashboard.activeBuild.roundLabel, "P30 · Round 008");
  assert.equal(
    dashboard.activeBuild.builder,
    "Selected Combat-FX Candidate · Independent Critic Running",
  );
  assert.equal(
    dashboard.activeBuild.evidenceBundle.manifestPath,
    "/data/P30-round-008.json",
  );
  assert.equal(
    dashboard.canonicalCapture.capturePath,
    "/captures/P30/round-008/S04.png",
  );
  assert.deepEqual(captureNames.sort(), ["S03.png", "S04.png", "S05.png"]);

  assert.equal(p30.schema, "cow.public-browser-critic.v1");
  assert.equal(p30.piece, "P30");
  assert.equal(p30.round, 4);
  assert.equal(p30.status, "rejected-candidate-evidence");
  assert.match(p30.acceptanceScope, /not accepted evidence/i);
  assert.deepEqual(p30.verdict, {
    result: "REJECT",
    overallScore: 34,
    maximumScore: 100,
    candidateWins: 0,
    comparisonCount: 6,
    focusedCandidateWins: 0,
    focusedComparisonCount: 3,
    comparisonStrength: "The candidate lost every pair; none was close.",
  });
  assert.equal(p30.blindReview.privateChoicesLockedBeforeReveal, true);
  assert.equal(p30.blindReview.privateWorkspaceDeletedAndVerified, true);
  assert.equal(p30.auditEnvironment.browser, "Google Chrome 150");
  assert.equal(p30.auditEnvironment.headed, true);
  assert.equal(p30.auditEnvironment.hardwareAccelerated, true);
  assert.equal(p30.auditEnvironment.coldReadyMilliseconds, 2389.407625);
  assert.deepEqual(p30.categoryScores, {
    characterAnatomySilhouette: 3,
    skinHairClothArmorMaterialFidelity: 2,
    enemyZombieThreatFidelity: 2,
    weaponQualityHandContactReadability: 3,
    animationPosingWeightContact: 2,
    combatVfxImpactPhysicsReadability: 3,
    cameraFramingComposition: 3,
    environmentLightingIntegration: 5,
    uiCinematicCoherence: 5,
    runtimePolishStabilityPerformance: 6,
  });
  assert.equal(p30.assetIntegration.authoredAssetsLoaded, 18);
  assert.equal(p30.assetIntegration.proceduralFallbackActive, false);
  assert.equal(p30.assetIntegration.requiredHeroClipsExercised, 5);
  assert.equal(p30.assetIntegration.requiredHollowClipsExercised, 3);
  assert.equal(p30.deterministicReplays.simulationExact, true);
  assert.equal(p30.deterministicReplays.cameraReplayExact, false);
  assert.equal(p30.deterministicReplays.obstructionImplemented, false);
  assert.equal(p30.validatedPasses.pointerLockAndPhysicalLook, true);
  assert.equal(p30.validatedPasses.pauseBlurAndHeldKeyHandling, true);
  assert.equal(p30.validatedPasses.resizeAndDevicePixelRatioHandling, true);
  assert.equal(p30.validatedPasses.webglRestore, true);
  assert.equal(p30.validatedPasses.errorFreeRuntime, true);
  assert.equal(p30.validatedPasses.coldReady, true);
  assert.equal(p30.validatedPasses.performanceAndResources.pass, false);
  assert.equal(
    p30.validatedPasses.performanceAndResources.resourceCeilingPass,
    false,
  );
  assert.equal(
    p30.validatedPasses.performanceAndResources.worst.triangles,
    322809,
  );
  assert.equal(p30.hardFailures.length, 6);
  assert.ok(p30.hardFailures.some((failure) => /triangle/i.test(failure)));
  assert.ok(p30.hardFailures.some((failure) => /obstruction/i.test(failure)));
  assert.ok(p30.hardFailures.some((failure) => /camera replay/i.test(failure)));
  assert.ok(p30.hardFailures.some((failure) => /intersect/i.test(failure)));
  assert.ok(p30.hardFailures.some((failure) => /blade/i.test(failure)));
  assert.ok(p30.hardFailures.some((failure) => /blind gate/i.test(failure)));
  assert.equal(p30.p31Provenance.processedFiles, 68);
  assert.equal(p30.p31Provenance.integrationReadyFiles, 54);
  assert.equal(p30.p31Provenance.round004RuntimeFilesByteIdentical, 3);
  assert.equal(p30.p31Provenance.frozenFilesUnchanged, 80);
  assert.equal(p30.primaryGap.id, "combat-character-contact-package");
  assert.match(p30.primaryGap.prescription, /matched high-fidelity PBR pair/i);
  assert.match(p30.primaryGap.prescription, /two-handed heavy strike/i);
  assert.match(p30.primaryGap.prescription, /synchronized HitReact/i);
  assert.match(p30.primaryGap.successCriterion, /win 3\/3 new blind comparisons/i);
  assert.deepEqual(
    p30.captures.map((capture) => capture.path),
    [
      "/captures/P30/round-004/S03.png",
      "/captures/P30/round-004/S04.png",
      "/captures/P30/round-004/S05.png",
    ],
  );

  const publicRound004Json = JSON.stringify({
    activeBuild: dashboard.activeBuild,
    canonicalCapture: dashboard.canonicalCapture,
    roundHistory: dashboard.rounds.at(-1),
    evidence: p30,
  });
  assert.doesNotMatch(publicRound004Json, /Reference\s+\d+/i);
  assert.doesNotMatch(publicRound004Json, /\bR\d{2}\b/);
  assert.doesNotMatch(
    publicRound004Json,
    /"(?:pairId|pairIdentifier|candidateSide|referenceSide|benchmarkSide|benchmarkFilename|benchmarkFile|benchmarkImage|referenceFilename|lockedWinner|revealedWinner|hiddenKey)"\s*:/i,
  );
  assert.doesNotMatch(
    publicRound004Json,
    /Reference\.zip|Reference\/[^"']+\.(?:png|jpe?g|webp)|reveal mapping|hidden key|\/Users\/|\/home\/|[A-Za-z]:\\Users\\|\/tmp\/|\/private\/var\/folders\//i,
  );

  for (const captureName of captureNames) {
    const image = await readFile(
      new URL(`../public/captures/P30/round-004/${captureName}`, import.meta.url),
    );
    assert.equal(image.subarray(1, 4).toString("ascii"), "PNG");
    assert.equal(image.readUInt32BE(16), 1600);
    assert.equal(image.readUInt32BE(20), 900);

    const chunks = [];
    for (let offset = 8; offset < image.length; ) {
      const length = image.readUInt32BE(offset);
      chunks.push(image.subarray(offset + 4, offset + 8).toString("ascii"));
      offset += length + 12;
    }
    assert.ok(chunks.every((chunk) => ["IHDR", "IDAT", "IEND"].includes(chunk)));
  }
});

test("P30 Round005 publishes aggregate-only rejected evidence and advances the active build to Round006", async () => {
  const [
    dashboard,
    p30,
    p00ManifestBytes,
    latestManifestBytes,
    captureNames,
  ] = await Promise.all([
    readFile(dataUrl, "utf8").then(JSON.parse),
    readFile(
      new URL("../public/data/P30-round-005.json", import.meta.url),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL("../public/data/P00-round-001-manifest.json", import.meta.url),
    ),
    readFile(
      new URL("../public/data/capture-manifest-latest.json", import.meta.url),
    ),
    readdir(new URL("../public/captures/P30/round-005/", import.meta.url)),
  ]);

  assert.equal(latestManifestBytes.equals(p00ManifestBytes), true);
  assert.equal(dashboard.activeBuild.pieceId, "P30");
  assert.equal(dashboard.activeBuild.round, 8);
  assert.equal(dashboard.activeBuild.roundLabel, "P30 · Round 008");
  assert.equal(
    dashboard.activeBuild.builder,
    "Selected Combat-FX Candidate · Independent Critic Running",
  );
  assert.equal(
    dashboard.activeBuild.evidenceBundle.manifestPath,
    "/data/P30-round-008.json",
  );
  assert.equal(
    dashboard.canonicalCapture.capturePath,
    "/captures/P30/round-008/S04.png",
  );
  assert.deepEqual(captureNames.sort(), ["S03.png", "S04.png", "S05.png"]);

  assert.equal(p30.schema, "cow.public-browser-critic.v1");
  assert.equal(p30.piece, "P30");
  assert.equal(p30.round, 5);
  assert.equal(p30.status, "rejected-candidate-evidence");
  assert.deepEqual(p30.verdict, {
    result: "REJECT",
    overallScore: 23,
    maximumScore: 100,
    candidateWins: 0,
    comparisonCount: 6,
    focusedCandidateWins: 0,
    focusedComparisonCount: 3,
  });
  assert.deepEqual(p30.hardGateSummary, { passed: 10, failed: 8, total: 18 });
  assert.equal(p30.assetIntegration.authoredAssetsLoaded, 18);
  assert.equal(p30.assetIntegration.proceduralFallbackActive, false);
  assert.equal(p30.assetIntegration.requiredHeroClipsExercised, 5);
  assert.equal(p30.assetIntegration.requiredHollowClipsExercised, 3);
  assert.equal(p30.assetIntegration.replacementGlbsReimported, 3);
  assert.deepEqual(p30.resourceEnvelope, {
    drawCalls: 86,
    triangles: 204155,
    textures: 26,
    geometries: 38,
    withinCaps: true,
  });
  assert.equal(p30.hardFailures.length, 8);
  assert.equal(
    p30.primaryGap.id,
    "authored-duel-contact-pose-and-material-coherence",
  );
  assert.match(p30.primaryGap.round006Prescription, /constrained left palm/i);
  assert.match(p30.primaryGap.round006Prescription, /collision-clean blade arc/i);
  assert.match(p30.primaryGap.round006Prescription, /base-color, normal, and ORM maps/i);
  assert.equal(p30.primaryGap.acceptanceGates.length, 5);
  assert.deepEqual(
    p30.captures.map((capture) => capture.path),
    [
      "/captures/P30/round-005/S03.png",
      "/captures/P30/round-005/S04.png",
      "/captures/P30/round-005/S05.png",
    ],
  );

  const publicRound005Json = JSON.stringify({
    roundHistory: dashboard.rounds.find(
      (round) => round.pieceId === "P30" && round.round === 5,
    ),
    evidence: p30,
  });
  assert.doesNotMatch(
    publicRound005Json,
    /sha256|\bhash(?:es)?\b|pairId|pairIdentifier|candidateSide|referenceSide|benchmarkSide|mapping|lockedWinner|revealedWinner|hiddenKey|commit|Reference(?:\.zip|\/)|\/Users\/|\/home\/|[A-Za-z]:\\Users\\|\/tmp\/|\/private\/var\/folders\//i,
  );

  for (const captureName of captureNames) {
    const image = await readFile(
      new URL(`../public/captures/P30/round-005/${captureName}`, import.meta.url),
    );
    assert.equal(image.subarray(1, 4).toString("ascii"), "PNG");
    assert.equal(image.readUInt32BE(16), 1600);
    assert.equal(image.readUInt32BE(20), 900);
    const chunks = [];
    for (let offset = 8; offset < image.length; ) {
      const length = image.readUInt32BE(offset);
      chunks.push(image.subarray(offset + 4, offset + 8).toString("ascii"));
      offset += length + 12;
    }
    assert.ok(chunks.every((chunk) => ["IHDR", "IDAT", "IEND"].includes(chunk)));
  }
});

test("P30 Round006 remains aggregate rejected evidence while Round008 is under review and accepted latest stays P00-pinned", async () => {
  const [
    dashboard,
    p30,
    p00ManifestBytes,
    latestManifestBytes,
    captureNames,
  ] = await Promise.all([
    readFile(dataUrl, "utf8").then(JSON.parse),
    readFile(
      new URL("../public/data/P30-round-006.json", import.meta.url),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL("../public/data/P00-round-001-manifest.json", import.meta.url),
    ),
    readFile(
      new URL("../public/data/capture-manifest-latest.json", import.meta.url),
    ),
    readdir(new URL("../public/captures/P30/round-006/", import.meta.url)),
  ]);

  assert.equal(latestManifestBytes.equals(p00ManifestBytes), true);
  assert.equal(dashboard.activeBuild.pieceId, "P30");
  assert.equal(dashboard.activeBuild.round, 8);
  assert.equal(dashboard.activeBuild.status, "review-ready");
  assert.equal(
    dashboard.activeBuild.evidenceBundle.status,
    "INDEPENDENT CRITIC RUNNING · NOT ACCEPTED",
  );
  assert.equal(
    dashboard.activeBuild.evidenceBundle.manifestPath,
    "/data/P30-round-008.json",
  );
  assert.equal(
    dashboard.canonicalCapture.capturePath,
    "/captures/P30/round-008/S04.png",
  );
  assert.equal(
    dashboard.canonicalCapture.latestManifestPath,
    "/data/capture-manifest-latest.json",
  );
  assert.equal(
    dashboard.pieces.find((piece) => piece.id === "P30").status,
    "review-ready",
  );
  assert.equal(
    dashboard.pieces.find((piece) => piece.id === "P31").status,
    "criticized",
  );

  assert.equal(p30.schema, "cow.public-browser-critic.v1");
  assert.equal(p30.piece, "P30");
  assert.equal(p30.round, 6);
  assert.equal(p30.status, "rejected-candidate-evidence");
  assert.match(p30.acceptanceScope, /rejected the candidate at 23\/100/i);
  assert.equal(
    p30.frozenCommit,
    "01a4c652a5a30137ae0c82cc6cd6f063f2c91ca6",
  );
  assert.deepEqual(p30.builder, {
    integrated: true,
    status: "PASS",
    acceptanceClaimed: false,
    approvedPayloadCount: 2,
    node: "24.18.0",
    typecheckPassed: true,
    lintPassed: true,
    simulationTestFilesPassed: 2,
    simulationTestsPassed: 5,
    productionBuildPassed: true,
    deterministicCleanProcesses: 2,
  });
  assert.deepEqual(p30.captureContract.viewport, {
    width: 1600,
    height: 900,
    deviceScaleFactor: 1,
  });
  assert.equal(p30.captureContract.readyMilliseconds, 1971);
  assert.equal(p30.captureContract.readyLimitMilliseconds, 4109);
  assert.equal(p30.captureContract.runtimeErrors, 0);
  assert.equal(p30.assetIntegration.authoredAssetsLoaded, 18);
  assert.equal(p30.assetIntegration.proceduralFallbackActive, false);
  assert.equal(
    p30.assetIntegration.hero.sha256,
    "56e569e529cd0d281bd60ad483d5c52bf6c3eab29f1c52829eb3a85dc7610caf",
  );
  assert.equal(
    p30.assetIntegration.weapon.sha256,
    "29565b76739e2d0f5491c55c5c382c7e172c7bc99d04a2382044f782170b7c1d",
  );
  assert.deepEqual(p30.resourceEnvelope.observedMaximum, {
    drawCalls: 86,
    triangles: 204155,
    textures: 32,
    geometries: 38,
  });
  assert.deepEqual(p30.resourceEnvelope.limits, {
    drawCalls: 100,
    triangles: 250000,
    textures: 32,
    geometries: 64,
  });
  assert.equal(p30.resourceEnvelope.withinCaps, true);
  assert.equal(p30.geometryGates.bothPalmsWithinLimitAtS03S04S05, true);
  assert.equal(p30.geometryGates.bladeHeroIntersectionsZeroAtS03S04S05, true);
  assert.equal(p30.geometryGates.bladeTargetIntersectionOnlyAtS04, true);
  assert.equal(p30.geometryGates.s04ContactWithinTargetAndBladeLimits, true);
  assert.equal(p30.geometryGates.moments.S03.bladeTargetTrianglePairs, 0);
  assert.equal(p30.geometryGates.moments.S04.bladeTargetTrianglePairs, 109);
  assert.equal(p30.geometryGates.moments.S05.bladeTargetTrianglePairs, 0);
  assert.deepEqual(p30.materialMapGates.resolution, [256, 256]);
  assert.equal(p30.materialMapGates.nyra.nonPlaceholder, true);
  assert.equal(p30.materialMapGates.stormcage.nonPlaceholder, true);
  assert.equal(p30.critic.status, "REJECT");
  assert.equal(p30.critic.accepted, false);
  assert.equal(p30.critic.qualityScore, 23);
  assert.equal(p30.critic.focusedCandidateWins, 0);
  assert.equal(p30.critic.focusedComparisonCount, 3);
  assert.equal(p30.critic.overallCandidateWins, 0);
  assert.equal(p30.critic.overallComparisonCount, 6);
  assert.equal(
    p30.critic.publicHashes.mappingLockSha256,
    "422a29058860c6134b15d70ed6e4e1c581788631c949bcba7d4d07bcc1890040",
  );
  assert.equal(
    p30.critic.publicHashes.anonymousScoreLockSha256,
    "aff4a9f4c9e31cfeeb8afbf8e2a197e8b1f2989540e792e444ec7a9d5fadab45",
  );
  assert.equal(
    p30.critic.publicHashes.revealSha256,
    "22361b19d41d99f00ba2a6b6f336476cbfc62637ab1a91c9e7699c57e9ca726c",
  );
  assert.equal(
    p30.critic.publicHashes.resultSha256,
    "9f51f0e68a33b718d75300b067fe616920b8f6b8628c8693a88179ab681dc6fb",
  );
  assert.equal(
    p30.critic.publicHashes.reportSha256,
    "8984363103b1deecc64e39ae63dd4f7d68f99fd530ba2d5b7f081f66eb8e7661",
  );
  assert.equal(
    p30.critic.publicHashes.privacyProofSha256,
    "4c657d5557b9cbd37fb7c3212c4febf67c5faba4579bbdd773a56e3b7bf325db",
  );
  assert.equal(p30.activeGap.id, "combat-camera-presentation");
  assert.equal(p30.activeGap.status, "round007-building");
  assert.deepEqual(p30.round007Gate.heroProjectedHeightPixels, [360, 540]);
  assert.equal(p30.round007Gate.focusedWinsRequired, "3/3");
  assert.deepEqual(captureNames.sort(), ["S03.png", "S04.png", "S05.png"]);

  const expectedCaptures = {
    "S03.png": "b0319e0f6ec46619418ead2f18da79845dde580542323a9fe15ed3c6ca4d4e67",
    "S04.png": "bb51bf1e9ac505f0932518be7f82427ee6f830531cfb3ab092f4b0ce8436f9fc",
    "S05.png": "01351ea34c69df9a9ab292821c622681e141951cdb03aa363f6ac3841dcd44f5",
  };
  for (const captureName of captureNames) {
    const image = await readFile(
      new URL(`../public/captures/P30/round-006/${captureName}`, import.meta.url),
    );
    assert.equal(image.subarray(1, 4).toString("ascii"), "PNG");
    assert.equal(image.readUInt32BE(16), 1600);
    assert.equal(image.readUInt32BE(20), 900);
    assert.equal(
      createHash("sha256").update(image).digest("hex"),
      expectedCaptures[captureName],
    );
    const chunks = [];
    for (let offset = 8; offset < image.length; ) {
      const length = image.readUInt32BE(offset);
      chunks.push(image.subarray(offset + 4, offset + 8).toString("ascii"));
      offset += length + 12;
    }
    assert.ok(chunks.every((chunk) => ["IHDR", "IDAT", "IEND"].includes(chunk)));
  }

  const publicCriticJson = JSON.stringify(p30);
  assert.doesNotMatch(publicCriticJson, /Reference\s+\d+|referencePixels|benchmarkPixels/i);
  assert.doesNotMatch(
    publicCriticJson,
    /"(?:pairId|pairIdentifier|pairSha256|pairHash|candidateSide|referenceSide|benchmarkSide|mapping|seed|lockedWinner|revealedWinner|hiddenKey)"\s*:/i,
  );
  assert.doesNotMatch(
    publicCriticJson,
    /Reference\.zip|Reference\/[^"']+\.(?:png|jpe?g|webp)|\/Users\/|\/home\/|[A-Za-z]:\\Users\\|\/tmp\/|\/private\/var\/folders\//i,
  );
});

test("P30 Round007 publishes sanitized rejected critic evidence while accepted latest stays P00-pinned", async () => {
  const [
    dashboard,
    p30,
    p00ManifestBytes,
    latestManifestBytes,
    captureNames,
  ] = await Promise.all([
    readFile(dataUrl, "utf8").then(JSON.parse),
    readFile(
      new URL("../public/data/P30-round-007.json", import.meta.url),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL("../public/data/P00-round-001-manifest.json", import.meta.url),
    ),
    readFile(
      new URL("../public/data/capture-manifest-latest.json", import.meta.url),
    ),
    readdir(new URL("../public/captures/P30/round-007/", import.meta.url)),
  ]);

  assert.equal(latestManifestBytes.equals(p00ManifestBytes), true);
  assert.equal(dashboard.activeBuild.pieceId, "P30");
  assert.equal(dashboard.activeBuild.round, 8);
  assert.equal(dashboard.activeBuild.status, "review-ready");
  assert.equal(
    dashboard.activeBuild.evidenceBundle.status,
    "INDEPENDENT CRITIC RUNNING · NOT ACCEPTED",
  );
  assert.equal(
    dashboard.activeBuild.evidenceBundle.manifestPath,
    "/data/P30-round-008.json",
  );
  assert.equal(
    dashboard.canonicalCapture.capturePath,
    "/captures/P30/round-008/S04.png",
  );
  assert.equal(
    dashboard.canonicalCapture.latestManifestPath,
    "/data/capture-manifest-latest.json",
  );

  assert.equal(p30.schema, "cow.public-browser-critic.v1");
  assert.equal(p30.piece, "P30");
  assert.equal(p30.round, 7);
  assert.equal(p30.status, "rejected-candidate-evidence");
  assert.match(
    p30.acceptanceScope,
    /rejected.+34\/100.+0\/3 focused.+0\/6 overall/i,
  );
  assert.equal(
    p30.frozenCommit,
    "6b953f563c68a81f4635aaa081bfeb664f3aee57",
  );
  assert.equal(p30.selection.selectedBuilder, "B");
  assert.equal(
    p30.selection.selectedBuilderCommit,
    "2bfd0a4c86f57378f41107ea205c3ef014a17e22",
  );
  assert.equal(
    p30.selection.alternateBuilderCommit,
    "d7d5e4e1a9aea759967dc47e55258c058b8291e2",
  );
  assert.equal(
    p30.selection.selectionReceiptSha256,
    "0a9edb96c3c92cc5101fc487792566798aeec0ca8ea7b94c73db9ae041ab5718",
  );
  assert.deepEqual(p30.captureContract.viewport, {
    width: 1600,
    height: 900,
    deviceScaleFactor: 1,
  });
  assert.equal(p30.captureContract.pngColorType, "RGB");
  assert.equal(p30.camera.profile, "Deterministic adaptive 50-degree duel composer");
  assert.deepEqual(
    Object.values(p30.camera.framing.moments).map(
      (moment) => moment.heroHeightPixels,
    ),
    [406.892, 388.327, 397.305],
  );
  assert.equal(p30.camera.framing.moments.S04.contactInsideCentral40Percent, true);
  assert.equal(p30.camera.framing.passed, true);
  assert.equal(p30.camera.replay.cleanRuns, 3);
  assert.deepEqual(p30.camera.replay.sampleTicks, [29, 34, 41, 60]);
  assert.equal(p30.camera.replay.byteIdentical, true);
  assert.equal(
    p30.camera.obstruction.clearPath.resolvedDistanceMeters,
    p30.camera.obstruction.clearPath.desiredDistanceMeters,
  );
  assert.equal(p30.camera.obstruction.wallPath.collisionApplied, true);
  assert.ok(
    p30.camera.obstruction.wallPath.resolvedDistanceMeters <
      p30.camera.obstruction.wallPath.desiredDistanceMeters,
  );
  assert.ok(p30.camera.obstruction.wallPath.clearanceMeters >= 0.45);
  assert.deepEqual(p30.runtime.coldReadyLaunchesMilliseconds, [
    3623.909,
    2293.622,
    1552.142,
  ]);
  assert.equal(p30.runtime.coldReadyPassed, true);
  assert.equal(p30.runtime.authoredAssetsLoaded, 18);
  assert.equal(p30.runtime.proceduralFallbackActive, false);
  assert.deepEqual(p30.runtime.resourceMaximum, {
    drawCalls: 86,
    triangles: 204155,
    textures: 32,
    geometries: 38,
  });
  assert.equal(p30.runtime.resourceCapsPassed, true);
  assert.equal(p30.rootValidation.simulationTestsPassed, 5);
  assert.equal(p30.rootValidation.cameraTestsPassed, 5);
  assert.equal(p30.rootValidation.browserSmokeTestsPassed, 3);
  assert.equal(p30.freezeAudit.round006EntriesChecked, 106);
  assert.equal(p30.freezeAudit.unexpectedProductionDifferences, 0);
  assert.equal(p30.critic.status, "REJECT");
  assert.equal(p30.critic.accepted, false);
  assert.equal(p30.critic.qualityScore, 34);
  assert.equal(p30.critic.focusedCandidateWins, 0);
  assert.equal(p30.critic.focusedComparisonCount, 3);
  assert.equal(p30.critic.overallCandidateWins, 0);
  assert.equal(p30.critic.overallComparisonCount, 6);
  assert.equal(p30.critic.categoriesAtLeastNine, 0);
  assert.equal(p30.critic.categoryCount, 10);
  assert.equal(p30.critic.mappingSealedBeforeScoring, true);
  assert.equal(p30.critic.scoresSealedBeforeReveal, true);
  assert.equal(p30.critic.candidateRuntimeTechnicalStatus, "PASS");
  assert.equal(p30.critic.categoryMeans.motionFxAndReadability, 2);
  assert.equal(
    p30.critic.publicHashes.mappingLockSha256,
    "1d97a0a72da6672e43e822eba8433339cfff58300ebd00ea7a000f9a3ee2b4d1",
  );
  assert.equal(
    p30.critic.publicHashes.anonymousScoreLockSha256,
    "15a37e8e07bc72a98e2083132bc8b7c9a692540699f426550fd890e8d22272b4",
  );
  assert.equal(
    p30.critic.publicHashes.revealAttestationSha256,
    "c3a7b7fcef7ddba73448d3108601d62817d8027855bb3970dd474b077b1d1670",
  );
  assert.equal(p30.activeGap.id, "combat-fx-language");
  assert.equal(p30.activeGap.status, "round008-building");
  assert.match(p30.largestKnownResidualWeakness, /combat FX language/i);
  assert.match(
    p30.round008Gate.scope,
    /replace only the weapon-trail FX surface/i,
  );
  assert.match(p30.round008Gate.visualAcceptance, /focused 3\/3/i);
  assert.deepEqual(captureNames.sort(), ["S03.png", "S04.png", "S05.png"]);

  const expectedCaptures = {
    "S03.png": "5c8398ae257f73e779d60c26d0e3c07399b9f82e77067f4bf4cd111544c598e1",
    "S04.png": "abfcd5e7986a9703bfd17f91246f5b200fb9e54a52dc8f38749575df7d5260fd",
    "S05.png": "fbbaffd91498e4f01a12386dabe99dee6e27122426dbcec40692af74edcc7f60",
  };
  for (const captureName of captureNames) {
    const image = await readFile(
      new URL(`../public/captures/P30/round-007/${captureName}`, import.meta.url),
    );
    assert.equal(image.subarray(1, 4).toString("ascii"), "PNG");
    assert.equal(image.readUInt32BE(16), 1600);
    assert.equal(image.readUInt32BE(20), 900);
    assert.equal(
      createHash("sha256").update(image).digest("hex"),
      expectedCaptures[captureName],
    );
    const chunks = [];
    for (let offset = 8; offset < image.length; ) {
      const length = image.readUInt32BE(offset);
      chunks.push(image.subarray(offset + 4, offset + 8).toString("ascii"));
      offset += length + 12;
    }
    assert.ok(chunks.every((chunk) => ["IHDR", "IDAT", "IEND"].includes(chunk)));
  }

  const criticJson = JSON.stringify(p30);
  assert.equal("verdict" in p30, false);
  assert.doesNotMatch(criticJson, /Reference\s+\d+|referencePixels|benchmarkPixels/i);
  assert.doesNotMatch(
    criticJson,
    /"(?:pairId|pairIdentifier|pairSha256|pairHash|candidateSide|referenceSide|benchmarkSide|mapping|seed|lockedWinner|revealedWinner|hiddenKey)"\s*:/i,
  );
  assert.doesNotMatch(
    criticJson,
    /Reference\.zip|Reference\/[^"']+\.(?:png|jpe?g|webp)|\/Users\/|\/home\/|[A-Za-z]:\\Users\\|\/tmp\/|\/private\/var\/folders\//i,
  );
});

test("P30 Round008 publishes only the frozen pending candidate while accepted latest stays P00-pinned", async () => {
  const [
    dashboard,
    p30,
    p00ManifestBytes,
    latestManifestBytes,
    captureNames,
  ] = await Promise.all([
    readFile(dataUrl, "utf8").then(JSON.parse),
    readFile(
      new URL("../public/data/P30-round-008.json", import.meta.url),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL("../public/data/P00-round-001-manifest.json", import.meta.url),
    ),
    readFile(
      new URL("../public/data/capture-manifest-latest.json", import.meta.url),
    ),
    readdir(new URL("../public/captures/P30/round-008/", import.meta.url)),
  ]);

  assert.equal(latestManifestBytes.equals(p00ManifestBytes), true);
  assert.equal(dashboard.activeBuild.pieceId, "P30");
  assert.equal(dashboard.activeBuild.round, 8);
  assert.equal(dashboard.activeBuild.status, "review-ready");
  assert.equal(
    dashboard.activeBuild.evidenceBundle.status,
    "INDEPENDENT CRITIC RUNNING · NOT ACCEPTED",
  );
  assert.equal(
    dashboard.activeBuild.evidenceBundle.manifestPath,
    "/data/P30-round-008.json",
  );
  assert.equal(
    dashboard.canonicalCapture.capturePath,
    "/captures/P30/round-008/S04.png",
  );

  assert.equal(p30.schema, "cow.public-browser-candidate.v1");
  assert.equal(p30.piece, "P30");
  assert.equal(p30.round, 8);
  assert.equal(p30.status, "selected-candidate-under-independent-review");
  assert.match(p30.acceptanceScope, /No quality acceptance or critic verdict is claimed/i);
  assert.equal(
    p30.frozenCommit,
    "5359f91bad13fe83e70169231e519911a8fbebc4",
  );
  assert.equal(p30.selection.selectedBuilder, "B");
  assert.equal(
    p30.selection.selectedBuilderCommit,
    "74fdf9e4dc4de2384ea5e73289ef3ac8b7ae9ffc",
  );
  assert.equal(
    p30.selection.alternateBuilderCommit,
    "cdc61b43e15d4daf8232f4708583089f85c96b17",
  );
  assert.equal(p30.selection.acceptanceClaimed, false);
  assert.deepEqual(p30.captureContract.viewport, {
    width: 1600,
    height: 900,
    deviceScaleFactor: 1,
  });
  assert.deepEqual(p30.fxLifecycle.focusedTicks, [29, 34, 41]);
  assert.deepEqual(p30.fxLifecycle.focusedPhases, [
    "absent",
    "peak",
    "dissipated",
  ]);
  assert.ok(p30.fxLifecycle.contactProjectionErrorPixels <= 24);
  assert.equal(p30.fxLifecycle.newTextureSlots, 0);
  assert.equal(p30.fxLifecycle.replayRuns, 3);
  assert.equal(p30.fxLifecycle.replayByteIdentical, true);
  assert.equal(p30.runtime.authoredAssetsLoaded, 18);
  assert.equal(p30.runtime.proceduralFallbackActive, false);
  assert.equal(p30.runtime.resourceGrowth, false);
  assert.deepEqual(p30.runtime.resourceMaximum, {
    drawCalls: 87,
    triangles: 203175,
    textures: 32,
    geometries: 41,
  });
  assert.equal(p30.runtime.resourceCapsPassed, true);
  assert.equal(p30.runtime.webglLossRestorePassed, true);
  assert.equal(p30.rootValidation.technicalGatesPassed, 16);
  assert.equal(p30.rootValidation.technicalGateCount, 16);
  assert.equal(
    p30.rootValidation.allSixCapturesByteExactToSelectedBuilderEvidence,
    true,
  );
  assert.equal(p30.freezeAudit.trackedProductionSourceFiles, 27);
  assert.equal(p30.freezeAudit.unchangedTrackedProductionSourceFiles, 25);
  assert.equal(p30.freezeAudit.unexpectedProductionDifferences, 0);
  assert.equal(p30.critic.status, "RUNNING");
  assert.equal(p30.critic.accepted, null);
  assert.equal(p30.critic.qualityScore, null);
  assert.equal(p30.critic.focusedCandidateWins, null);
  assert.equal(p30.critic.overallCandidateWins, null);
  assert.equal(p30.critic.categoriesAtLeastNine, null);
  assert.equal(p30.critic.acceptanceClaimed, false);
  assert.equal(
    p30.qualityStatus,
    "pending-fresh-independent-blind-critic",
  );
  assert.deepEqual(captureNames.sort(), ["S03.png", "S04.png", "S05.png"]);

  const expectedCaptures = {
    "S03.png": "5c8398ae257f73e779d60c26d0e3c07399b9f82e77067f4bf4cd111544c598e1",
    "S04.png": "c8c2ba2df5296bf92e9b64a173e4f9c364c6e432bfec8250de05b5f2b8296ce5",
    "S05.png": "6bae9a8d3d7337c1a9292fd1edcd4c0db6598400f81166086b521a0dc042ea3b",
  };
  for (const captureName of captureNames) {
    const image = await readFile(
      new URL(`../public/captures/P30/round-008/${captureName}`, import.meta.url),
    );
    assert.equal(image.subarray(1, 4).toString("ascii"), "PNG");
    assert.equal(image.readUInt32BE(16), 1600);
    assert.equal(image.readUInt32BE(20), 900);
    assert.equal(
      createHash("sha256").update(image).digest("hex"),
      expectedCaptures[captureName],
    );
    const chunks = [];
    for (let offset = 8; offset < image.length; ) {
      const length = image.readUInt32BE(offset);
      chunks.push(image.subarray(offset + 4, offset + 8).toString("ascii"));
      offset += length + 12;
    }
    assert.ok(chunks.every((chunk) => ["IHDR", "IDAT", "IEND"].includes(chunk)));
  }

  const candidateJson = JSON.stringify(p30);
  assert.doesNotMatch(candidateJson, /Reference\s+\d+|referencePixels|benchmarkPixels/i);
  assert.doesNotMatch(
    candidateJson,
    /"(?:pairId|pairIdentifier|candidateSide|referenceSide|benchmarkSide|lockedWinner|revealedWinner|hiddenKey)"\s*:/i,
  );
  assert.doesNotMatch(
    candidateJson,
    /Reference\.zip|Reference\/[^"']+\.(?:png|jpe?g|webp)|\/Users\/|\/home\/|[A-Za-z]:\\Users\\|\/tmp\/|\/private\/var\/folders\//i,
  );
});

test("public data rejects benchmark identity leaks and private filesystem paths", async () => {
  const publicEntries = await readdir(publicRoot, { recursive: true });
  assert.ok(
    publicEntries.every((entry) => !entry.toLowerCase().endsWith(".zip")),
  );

  const publicDataFiles = publicEntries.filter((entry) =>
    /^data\/.*\.json$/i.test(entry),
  );
  for (const dataPath of publicDataFiles) {
    const data = await readFile(new URL(dataPath, publicRoot), "utf8");
    assert.doesNotMatch(
      data,
      /Reference\s+\d+|Reference\.zip|Reference\/[^"']+\.(?:png|jpe?g|webp)|\/Users\/|\/home\/|[A-Za-z]:\\Users\\|\/tmp\/|\/private\/var\/folders\//i,
    );
    assert.doesNotMatch(data, /\bR\d{2}\b/);
    assert.doesNotMatch(
      data,
      /"(?:pairId|pairIdentifier|candidateSide|referenceSide|benchmarkSide|benchmarkFilename|benchmarkFile|benchmarkImage|referenceFilename|lockedWinner|revealedWinner|hiddenKey)"\s*:/i,
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
