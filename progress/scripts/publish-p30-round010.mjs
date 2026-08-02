import { readFile, writeFile } from "node:fs/promises";

const dashboardPath = new URL("../public/data/codex-of-war.json", import.meta.url);
const roundPath = new URL("../public/data/P30-round-010.json", import.meta.url);

const dashboard = JSON.parse(await readFile(dashboardPath, "utf8"));
const round = JSON.parse(await readFile(roundPath, "utf8"));

dashboard.activeBuild = {
  pieceId: "P30",
  round: 10,
  roundLabel: "P30 · Round 010",
  status: "criticized",
  builder: "Builder A · Blind-selected rejected checkpoint",
  brief:
    "Two fresh isolated Three.js builders repaired only the frozen ticks 29, 34, and 41 light-strike presentation from exact baseline ed9cc22717cac6c7c1933e85fa01d1808a38137d. A fresh critic received opaque runtime packages, ran both actual games, sealed scores before reveal, and rejected both. Builder A won the anonymous comparison at 54–52 and is deployed only as an honest progress checkpoint.",
  facts: [
    "P00 remains accepted as infrastructure; its blind visual baseline remains an explicit 28.33–76.67 loss.",
    "P10 remains paused after the halted Unity Round 018 lane; Three.js P30 is the active implementation lane.",
    "Round009's anonymous selector chose Builder B by 57–56 while disqualifying both candidates; its later independent critic run did not complete and is superseded by Round010.",
    "Round010 fanned the same bounded pose assignment to two fresh isolated builders from exact baseline ed9cc22717cac6c7c1933e85fa01d1808a38137d.",
    "Only CharacterViews.ts and CombatPoseBeat.ts were authorized production differences; simulation mechanics, camera, assets, materials, arena, HUD, lighting, post, and Round008 FX remained frozen.",
    "The critic locked a conjunctive protocol, random presentation order, 95/100 floor, every-category 9/10 floor, focused 3/3, overall 5/6, and T1–T8 before opening either package.",
    "A hash-ordering mismatch was caught before runtime access, amended publicly, and the corrected package hashes and private map commitment were verified before evaluation continued.",
    "Both opaque packages ran as the actual Three.js game at 1600×900 DPR1 WebGL2 with 18/18 authored assets and no procedural fallback.",
    "Builder A scored 54/100, won 1/3 focused and 4/6 overall ballots, and had no category at the required 9/10 floor.",
    "Builder B scored 52/100, won 0/3 focused and 0/6 overall ballots, and had no category at the required 9/10 floor.",
    "Both pass anticipation O29 and grounded same-direction recovery O41; both fail precise exterior contact O34.",
    "Builder A's decisive remaining visual gap is a visible blade-to-target standoff at tick 34, which makes the impact read disconnected.",
    "Both fail T6 because the live-input soak recorded five unhandled pointer-lock WrongDocumentError rejections despite stable frame pacing.",
    "Both fail T7 because context restored and controls responded within one second but scene lighting remained about 39.3% dimmer after five seconds.",
    "The corrected map, presentation order, and score commitment all verified; the alias-only score document remained byte-exact after reveal.",
    "Root passed Node 24 clean install, typecheck, lint, 20 unit tests, production build, and four serial browser tests.",
    "Builder A is deployed at the stable play URL with no acceptance claim.",
    "The global latest capture manifest remains intentionally pinned to accepted P00."
  ],
  evidenceFingerprint: {
    auditContext: "Round010 fresh blind critic complete · rejected checkpoint deployed",
    browser: "Chromium 150",
    graphics: "WebGL2 · ANGLE Metal Renderer: Apple M2",
    headed: true,
    hardwareAccelerated: true,
    resolution: "1600×900",
    deviceScaleFactor: 1
  },
  evidenceBundle: {
    roundLabel: "P30 · Round 010 blind verdict",
    status: "REJECT · BUILDER A STRONGER · DEPLOYED CHECKPOINT",
    manifestPath: "/data/P30-round-010.json",
    s01: {
      label: "S03 tick 29 · stronger anticipation candidate",
      path: "/captures/P30/round-010/S03.png",
      sha256: "bb5e08dbe1c4b0f23d7b6acf7cef136488a1639da6b35f81c130254e67767243"
    },
    diagnostic: {
      label: "S04 tick 34 · rejected disconnected contact",
      path: "/captures/P30/round-010/S04.png",
      sha256: "aa0800259896ae66dc8bc91f852ea76b2be6b47609901bebe5abd9b49cbe4293"
    },
    metrics: [
      { label: "Critic", value: "REJECT · 54/100" },
      { label: "Blind ballots", value: "FOCUSED 1/3 · OVERALL 4/6" },
      { label: "Objective gates", value: "O29/O41 PASS · O34 FAIL" },
      { label: "Technical gates", value: "T1–T5/T8 PASS · T6/T7 FAIL" },
      { label: "Root validation", value: "20 UNIT · 4 BROWSER · PASS" },
      { label: "Deployment", value: "PRODUCTION · READY" }
    ],
    checks: [
      "Fresh locked blind protocol · identities hidden until score seal",
      "Corrected map, presentation, and score commitments verified",
      "Chromium 150 · actual headed WebGL2 game · 1600×900 · DPR1 · Apple M2 Metal",
      "Three cold profiles per candidate · exact state digests · pHash distance 0",
      "Minimum focused SSIM · Builder A 0.997805 · Builder B 0.997761",
      "18/18 authored assets · no fallback",
      "Tick 29 anticipation · pass",
      "Tick 41 low same-direction grounded braking · pass",
      "Node 24 clean install · typecheck · lint · 20 unit · build · 4 serial browser",
      "Stable Vercel alias updated to Builder A"
    ],
    limitations: [
      "AAA gate · REJECT · 54/100 versus required 95/100",
      "Focused comparison · 1/3 versus required 3/3",
      "Overall comparison · 4/6 versus required 5/6",
      "Category floor · minimum 3/10 versus required 9/10",
      "O34 · blade stops visibly short of precise exterior contact",
      "T6 · five pointer-lock WrongDocumentError rejections",
      "T7 · context-restored scene remains about 39.3% too dim",
      "Repository-wide LFS integrity · eight historical raw PNG blobs"
    ]
  },
  nextGate:
    "Round011 must preserve the passing tick 29 anticipation and tick 41 low grounded recovery while moving the active cutting edge into one precise exterior target-contour contact at tick 34. It must also eliminate pointer-lock unhandled rejections and restore full scene lighting after WebGL context recovery, then pass focused 3/3, overall at least 5/6, at least 95/100, every category at least 9/10, and all T1–T8 gates."
};

dashboard.canonicalCapture = {
  shotId: "S04",
  name: "Round 010 impact · stronger rejected candidate",
  purpose: "P30 Round 010 fresh blind-critic evidence",
  camera: "Adaptive 50-degree duel composer",
  heroHeight: "360–540 px target",
  measuredHeroHeight: "Focused framing gate passes · visual contact gate fails",
  sceneRead:
    "Builder A improves low same-direction recovery and target displacement, but the blade visibly stops short of the target at tick 34. The impact therefore reads disconnected and remains far below the reference finish bar.",
  benchmarkId: "Fresh blind critic complete · Builder A stronger · no accepted candidate",
  benchmarkPolicy:
    "Actual-game captures, blind score, commitment verification, and rejection are public; supplied benchmark originals are not republished.",
  capturePath: "/captures/P30/round-010/S04.png",
  manifestPath: "/data/P30-round-010.json",
  latestManifestPath: "/data/capture-manifest-latest.json",
  captureAvailable: true,
  manifestAvailable: true
};

const round009 = dashboard.rounds.find(
  (entry) => entry.pieceId === "P30" && entry.round === 9
);
if (round009) {
  const supersededNote =
    "The independent Round009 critic did not complete a sealed verdict before the lane advanced; Round010 supersedes it without retroactively claiming acceptance.";
  round009.phase = "Superseded by completed Round010 blind loop";
  round009.status = "criticized";
  round009.evidence = `${round009.evidence.replaceAll(` ${supersededNote}`, "")} ${supersededNote}`;
  round009.critic = {
    ...round009.critic,
    status: "INCOMPLETE · SUPERSEDED BY ROUND010",
    primaryGap:
      "The Round009 selector still read tick 34 as penetration and tick 41 as an overhead re-windup; Round010 directly rebuilt those two readings."
  };
}

const round010 = {
  round: 10,
  label: "P30 · Round 010",
  pieceId: "P30",
  phase: "Fresh blind critic complete · stronger rejected checkpoint deployed",
  status: "criticized",
  date: "2026-08-02",
  engineRun: true,
  actualGameCapturePerformed: true,
  targetMatchedGameCapturePerformed: true,
  gateQualifyingCapture: false,
  builderBrief:
    "Repair only deterministic pose presentation for frozen ticks 29, 34, and 41 so impact reads as exterior contact and recovery remains a low same-direction grounded brake; freeze mechanics, timing, camera, assets, arena, HUD, lighting, post, and Round008 FX.",
  evidence:
    "Two fresh isolated builders completed the same assignment from exact baseline ed9cc22717cac6c7c1933e85fa01d1808a38137d. A fresh critic precommitted the protocol and order, ran both opaque actual-game packages, sealed anonymous scores before identity reveal, and rejected both. Builder A was stronger at 54/100 with focused 1/3 and overall 4/6; it passes O29/O41 but fails O34, T6, and T7. Root passed 20 unit and four serial browser tests and deployed Builder A only as a rejected progress checkpoint.",
  evidenceLinks: [
    "/captures/P30/round-010/S03.png",
    "/captures/P30/round-010/S04.png",
    "/captures/P30/round-010/S05.png",
    "/captures/P30/round-010/BlindTriptych.png",
    "/data/P30-round-010.json"
  ],
  critic: {
    status: "REJECT · FRESH BLIND CRITIC COMPLETE",
    score: 54,
    focusedCandidatePreferredCount: 1,
    focusedComparisonCount: 3,
    candidatePreferredCount: 4,
    comparisonCount: 6,
    categoriesAtLeastNine: 0,
    categoryCount: 10,
    scoreLabel: "Fresh blind headed WebGL2 gate 54/100 · focused 1/3 · overall 4/6",
    preference: "Builder A won four of six anonymous ballots but only one of three focused ballots",
    primaryGap:
      "the visible blade-to-target standoff at tick 34 makes the impact read disconnected rather than as localized exterior contact"
  }
};

const round010Index = dashboard.rounds.findIndex(
  (entry) => entry.pieceId === "P30" && entry.round === 10
);
if (round010Index >= 0) dashboard.rounds[round010Index] = round010;
else dashboard.rounds.push(round010);

const p30 = dashboard.pieces.find((piece) => piece.id === "P30");
if (p30) {
  p30.status = "criticized";
  p30.outcome =
    "Round008 was rejected at 39.3/100. Round009's selector chose Builder B by 57–56 while disqualifying both candidates, and its independent critic did not complete. Round010 completed a fully sealed two-candidate blind runtime comparison: Builder A was stronger at 54/100 with focused 1/3 and overall 4/6, but both candidates failed O34, T6, T7, the 95/100 floor, and every-category 9/10 floor. Builder A is deployed only as a rejected progress checkpoint.";
}

if (dashboard.activeBuild.status !== p30?.status) {
  throw new Error("P30 and active-build status diverged");
}
if (round.selection.strongerBuilder !== "BuilderA" || round.critic.qualityScore !== 54) {
  throw new Error("Round010 manifest does not match the sealed verdict");
}

await writeFile(dashboardPath, `${JSON.stringify(dashboard, null, 2)}\n`);
