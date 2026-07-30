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
    /href="\/captures\/P00\/round-001\/S01_Explore\.png"/,
  );
  assert.match(html, /href="\/data\/P00-round-001-manifest\.json"/);
  assert.match(html, /href="\/data\/capture-manifest-latest\.json"/);
  assert.doesNotMatch(
    html,
    /\/captures\/P00\/round-001\/manifest\.json/,
  );
  assert.match(html, /Filed/);

  assert.match(html, /Low shoulder/);
  assert.match(html, /24–32%/);
  assert.match(html, /Reference 09/);
  assert.match(html, /80/);
  assert.match(compactHtml, /100 minimum total/);
  assert.match(html, /P00 exception/);
  assert.match(html, /visual loss does not block acceptance/i);

  assert.match(html, /Round history/);
  assert.match(html, /Infrastructure accepted/);
  assert.match(html, /28\.33/);
  assert.match(html, /Reference 09 \(B\) over current Unity \(A\)/);
  assert.match(html, /raw blockout/);
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

  const [p00, ...queuedPieces] = dashboard.pieces;
  assert.equal(p00.status, "accepted");
  assert.equal(dashboard.activeBuild.pieceId, "P00");
  assert.equal(dashboard.activeBuild.round, 1);
  assert.equal(dashboard.activeBuild.status, p00.status);
  assert.ok(queuedPieces.every((piece) => piece.status === "queued"));

  assert.equal(dashboard.canonicalCapture.camera, "Low shoulder");
  assert.equal(
    dashboard.canonicalCapture.heroHeight,
    "24–32% of image height",
  );
  assert.equal(dashboard.canonicalCapture.benchmarkId, "Reference 09");
  assert.equal(
    dashboard.canonicalCapture.capturePath,
    "/captures/P00/round-001/S01_Explore.png",
  );
  assert.equal(
    dashboard.canonicalCapture.manifestPath,
    "/data/P00-round-001-manifest.json",
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

  assert.equal(dashboard.rounds.length, 1);
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
});

test("ledger fingerprint matches the filed Unity evidence", async () => {
  const [dashboard, manifest, latestManifest, screenshot] = await Promise.all([
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
        "../public/captures/P00/round-001/S01_Explore.png",
        import.meta.url,
      ),
    ),
  ]);
  const fingerprint = dashboard.activeBuild.evidenceFingerprint;
  const screenshotHash = createHash("sha256").update(screenshot).digest("hex");

  assert.deepEqual(latestManifest, manifest);
  assert.equal(manifest.piece, "P00");
  assert.equal(manifest.round, 1);
  assert.equal(manifest.preset, "S01_Explore");
  assert.deepEqual(manifest.resolution, { width: 1600, height: 900 });
  assert.equal(manifest.screenshotRelativePath, dashboard.canonicalCapture.capturePath.slice(1));
  assert.equal(screenshotHash, manifest.screenshotSha256);
  assert.equal(fingerprint.screenshotSha256, manifest.screenshotSha256);
  assert.equal(fingerprint.captureContractSha256, manifest.captureContractSha256);
  assert.equal(fingerprint.renderSettingsSha256, manifest.renderSettingsSha256);
  assert.equal(fingerprint.gitRevision, manifest.gitRevision);
  assert.equal(fingerprint.gitState, manifest.gitState);
  assert.equal(fingerprint.seed, manifest.seed);
  assert.equal(fingerprint.preset, manifest.preset);
  assert.equal(fingerprint.capturedAtUtc, manifest.capturedAtUtc);
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
