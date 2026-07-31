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
const benchmarkImageHashes = new Set([
  "05048268b96a7ea20e52ab4f0c01fbc312b37d7d4b3ae4fd40752ca4f497e71e",
  "06ac0710130fe19f7c844ecc453bca2d27bcc72b25fef3a2615f8877b53c9778",
  "a0161b955a1947fcabccc34c8e22ee0ebcb6ade357b51aa974c0057caf9294c9",
  "1e99a94f8efbbdd9d4811e2706f84616ea9cc379909caee873d212ecfb9a68b0",
  "1af9ad3cd30a4f90dd97d8fcdced94eee8afcc2828aff1013bf24f90721112b7",
  "d208c98d2ea91b654fb11070616887e0f8564fe3c5040ae854e3aab8645be98d",
  "41d924111330b7ead3bb85e85ee8d16d3a66f376939ede3fa3227d6cb591f76a",
  "d18f1a8f98bfaf720d4400cd3252688ff3200a5585c31d48112a003656c4d41a",
  "3c5ced3dea47f3197adbcd323e4f7fb1f6b46f56ef79c5575ede85b72f32eb7e",
  "0293135a1aa7dae0a92f73e018d5f046cd8aa45b9b0e1727e8538ae951276869",
  "1f7ee6c436dee9599e2ff1191fde973f20c864548881b1cf7f6d483e3e15c1aa",
  "a57bd1e7251e57eda6e246b45fce3ddc168a89e9b406db78ad261a9513f7df3f",
  "c4693a135a8f66b17759349dd81e126001989aac894db1714d2d2cad89ae8fe0",
  "21858656b7887cc37f92c2bab4ed56f6cb273f45fd75193c0cb1c1b37456bc33",
  "aab7f2b4d72b8d2ffc4faea302e7f8e51a799aaad8ea213351e1de72c2526c8b",
  "a96d9bf819821b0730be51f5ac4f916e55118b521280e737941b9be868fd0ad2",
  "c0e6f548000b49247e740c300db014be846c73f4cfdd6ac09246b49ca0c5eb5c",
  "be4dc9c541780492ad20d96d0afdf64f20478d2b6f52cabcb25b5edb3d2ee597",
  "3db321cbdd218f19f9834e7ba81432cc94bfd9fb5cf0933af2664d26d61f34f2",
  "e894db229df4c7bc0be9e01e16a668158a4ae900e1b3749d42f9e47662bb7a62",
]);

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
  assert.match(html, /P10 · Round 008/);
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
  assert.match(html, /Source preflight 6\/13 · mandatory 4\/8/);
  assert.match(html, /NO-GO · rejected before Unity/i);
  assert.match(html, /Benchmark preferred 7\/7 blinded comparisons/);
  assert.match(html, /licensed Einar civilian mechanic in workwear/i);
  assert.match(html, /4\/4 static imports at 85,096 \/ 47,615 \/ 25,484/);
  assert.match(html, /no actual game capture was performed/i);
  assert.match(html, /Einar Rig \(CC-BY\) Blender Foundation/);
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
  assert.match(html, /release-sanitization follow-up passed/i);
  assert.match(html, /reproduces the audit, clean-import report, and reimport diagnostic byte-for-byte/i);
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
  assert.match(html, /Identity-preserving two-hand contact proof/i);
  assert.match(html, /no result, capture, or history entry filed yet/i);
  assert.match(html, /complete concept pack must then earn at least 85\/100/i);
  assert.doesNotMatch(html, /Reference\.zip|Reference\/[^"<]+\.(?:png|jpe?g|webp)/i);
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
  assert.equal(dashboard.activeBuild.round, 8);
  assert.equal(dashboard.activeBuild.roundLabel, "P10 · Round 008");
  assert.equal(
    dashboard.activeBuild.builder,
    "Identity-preserving two-hand contact proof",
  );
  assert.equal(dashboard.activeBuild.status, p10.status);
  assert.match(dashboard.activeBuild.brief, /no result, capture, or history entry filed yet/i);
  assert.match(dashboard.activeBuild.brief, /paid 3D generation and Unity remain locked/i);
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

  assert.equal(dashboard.rounds.length, 8);
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
  assert.equal(
    dashboard.rounds.some(
      (round) => round.pieceId === "P10" && round.round === 8,
    ),
    false,
  );
});

test("P10 evidence is filed while the global latest manifest remains P00-pinned", async () => {
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

test("public artifacts exclude all supplied benchmark image bytes", async () => {
  const publicEntries = await readdir(publicRoot, { recursive: true });
  assert.ok(
    publicEntries.every((entry) => !entry.toLowerCase().endsWith(".zip")),
  );

  const publicImages = publicEntries.filter((entry) =>
    /\.(?:png|jpe?g|webp)$/i.test(entry),
  );
  for (const imagePath of publicImages) {
    const image = await readFile(new URL(imagePath, publicRoot));
    const imageHash = createHash("sha256").update(image).digest("hex");
    assert.equal(
      benchmarkImageHashes.has(imageHash),
      false,
      `${imagePath} must not contain a supplied benchmark image`,
    );
  }

  const publicDataFiles = publicEntries.filter((entry) =>
    /^data\/.*\.json$/i.test(entry),
  );
  for (const dataPath of publicDataFiles) {
    const data = await readFile(new URL(dataPath, publicRoot), "utf8");
    assert.doesNotMatch(
      data,
      /Reference\.zip|Reference\/[^"']+\.(?:png|jpe?g|webp)|\/Users\/|\/home\/|[A-Za-z]:\\Users\\|\/tmp\/|\/private\/var\/folders\//i,
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
