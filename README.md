# Codex of War

Codex of War is a Unity 6 URP combat vertical slice built as a sequence of
independently judgeable pieces. Every production claim is tied to a fixed
capture preset, a machine-readable manifest, and a builder/critic round record.

P00, the evidence spine, is **accepted as infrastructure**. A fresh critic ran
the Unity capture twice, confirmed identical screenshot and render-settings
hashes, passed the standalone validator, passed all 6 focused EditMode tests,
and passed all 4 dashboard tests. Its anonymous visual baseline comparison was
an honest loss: the current Unity frame scored `28.33/100` against Reference
09 at `76.67/100`. No visual win is claimed.

The critic assigned P10 next: replace the mannequin hero proxy with one authored
anime-style hero mesh and coherent material set while freezing the S01 seed,
camera, arena, and render settings. P01–P09 and P11–P25 remain queued.

## Requirements

- macOS on Apple Silicon for the canonical review target
- Unity `6000.5.4f1` at the path used below
- Universal Render Pipeline `17.5.0` from `game/Packages/manifest.json`
- Node.js `>=22.13.0`

## Bootstrap

From the repository root:

```bash
REPO_ROOT="/Users/amir/Documents/Gauntlet Loop"
UNITY_BIN="/Applications/Unity/Hub/Editor/6000.5.4f1/Unity.app/Contents/MacOS/Unity"

mkdir -p "$REPO_ROOT/Artifacts/P00/round-001"

"$UNITY_BIN" \
  -batchmode \
  -projectPath "$REPO_ROOT/game" \
  -quit \
  -logFile "$REPO_ROOT/Artifacts/P00/round-001/import-compile.log"

cd "$REPO_ROOT/progress"
npm ci
```

Unity-generated state stays under the ignored `game/Library`, `game/Temp`, and
`game/Logs` directories. Review logs and test XML stay in ignored `Artifacts/`.

## Rebuild the scene and capture S01

This command does not use `-nographics`. It rebuilds and saves
`Assets/CodexOfWar/Review/Scenes/P00_EvidenceSpine.unity` through checked-in
editor tooling, then renders with `Camera.Render` through URP at exactly
1600×900. The command exits `0` only after its own evidence validation passes.

```bash
"$UNITY_BIN" \
  -batchmode \
  -projectPath "$REPO_ROOT/game" \
  -executeMethod CodexOfWar.Editor.Review.P00CaptureCommand.CaptureS01FromCommandLine \
  -logFile "$REPO_ROOT/Artifacts/P00/round-001/capture.log"
```

The fixed contract is:

- piece `P00`, round `001`
- preset `S01_Explore`
- seed `24007001`
- scene `Assets/CodexOfWar/Review/Scenes/P00_EvidenceSpine.unity`
- resolution `1600×900`
- low shoulder camera with a 24–32% hero-height target
- benchmark identifier `Reference 09` only

The command writes:

- `progress/public/captures/P00/round-001/S01_Explore.png`
- `progress/public/data/P00-round-001-manifest.json`
- `progress/public/data/capture-manifest-latest.json`

The current PNG SHA-256 is
`a54a917a70b537ed34f57f9cdf13b877dc58b9d9579e2b2ec10f1e184a525aab`.

## Validate

Run the standalone evidence validator:

```bash
"$UNITY_BIN" \
  -batchmode \
  -projectPath "$REPO_ROOT/game" \
  -executeMethod CodexOfWar.Editor.Review.P00CaptureCommand.ValidateFromCommandLine \
  -logFile "$REPO_ROOT/Artifacts/P00/round-001/validate.log"
```

Run focused EditMode tests:

```bash
"$UNITY_BIN" \
  -batchmode \
  -projectPath "$REPO_ROOT/game" \
  -runTests \
  -testPlatform EditMode \
  -testResults "$REPO_ROOT/Artifacts/P00/round-001/editmode-results.xml" \
  -logFile "$REPO_ROOT/Artifacts/P00/round-001/editmode-tests.log"
```

Do not add `-quit` to the two commands above: both the checked-in command and
Unity Test Framework terminate batch mode after completion.

## Progress dashboard

```bash
cd "$REPO_ROOT/progress"
npm run dev
```

The local dashboard is available at
[http://localhost:3000](http://localhost:3000). Validate it with:

```bash
npm run lint
npm run build
npm test
```

The dashboard reads `progress/public/data/codex-of-war.json`, shows all P00–P25
piece states, the latest Unity evidence, the frozen S01 and acceptance
contracts, and round history. Its tests verify that the ledger fingerprint
matches the filed PNG and both manifests.

## Architecture boundaries

- `game/Assets/CodexOfWar/Runtime` owns the deterministic capture contract,
  manifest model and validation logic, plus the scene contract component. It
  does not reference `UnityEditor`.
- `game/Assets/CodexOfWar/Editor` owns scene/material/volume generation,
  `Camera.Render` capture, Git/machine/URP provenance, and batch validation.
- `game/Assets/CodexOfWar/Tests/EditMode` owns focused contract, path, seed,
  JSON round-trip, and SHA-256 checks.
- `game/Assets/CodexOfWar/Review` contains Unity-generated review assets. The
  checked-in editor builder is authoritative; do not hand-edit scene YAML.
- `progress` is a Vinext static progress surface driven by checked-in JSON and
  hosted evidence. It has no authority over gameplay state.

These assembly boundaries keep `UnityEditor` out of player/runtime code and
keep deterministic rules testable without scene traversal.

## Evidence and licensing rule

Only original material or assets whose licenses permit source redistribution
may be committed. Paid or restricted assets require a documented local import
step and license record; they are never silently republished. The local
benchmark archive and images are not copied into Unity, the dashboard, build
artifacts, or source control. Review records may mention only benchmark shot
IDs and derived measurements.

The frozen backlog and review contract live in
`Docs/Production/BuildPieces.md` and `Docs/Production/ReviewProtocol.md`.
