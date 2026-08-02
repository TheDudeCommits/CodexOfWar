# Codex of War

Codex of War is now a **Three.js/WebGL2 third-person combat vertical slice**.
The browser runtime in [`web-game/`](web-game/) is authoritative; the earlier
Unity project remains in the repository only as preserved production and
evidence history.

The game is built as a sequence of independently judgeable pieces. Every
production claim is tied to a deterministic gameplay tape, a machine-readable
asset and renderer receipt, fixed 1600×900 capture framings, and a separate
builder/critic round.

The current active loop is P30 Round 010. Round 009 froze a technically valid
combat-beat candidate, but the anonymous selector scored it only `57/100` and
disqualified it for broad impact penetration and an overhead recovery
re-windup. Two fresh isolated builders are repairing exactly those defects
before another blind critic pass. No AAA-quality or visual-win claim is made.

## Play the current Three.js checkpoint

The stable browser build is deployed at
[web-game-teal-one.vercel.app](https://web-game-teal-one.vercel.app/). This URL
is refreshed after major judged checkpoints so testers can keep one bookmark.

## Run the Three.js game

Requirements:

- Node.js `24.x`
- npm `>=11 <12`
- a WebGL2-capable browser
- macOS on Apple Silicon with headed Chrome for the canonical critic capture

From the repository root:

```bash
REPO_ROOT="/Users/amir/Documents/Gauntlet Loop"
cd "$REPO_ROOT/web-game"
npm ci
npm run dev
```

Open [http://localhost:4173](http://localhost:4173). Controls, deterministic
review API, renderer/asset telemetry, and the complete validation commands are
documented in [`web-game/README.md`](web-game/README.md).

Validate the authoritative runtime with:

```bash
cd "$REPO_ROOT/web-game"
npm run typecheck
npm run lint
npm test
npm run build
npm run smoke
```

## Three.js production boundaries

- `web-game/src/game/` owns deterministic 60 Hz simulation and physical input.
- `web-game/src/physics/` owns the Rapier collision bridge.
- `web-game/src/render/` owns Three.js rendering, animation, camera, VFX,
  post-processing, lifecycle recovery, and asset integration.
- `web-game/public/assets/manifest.json` is the stable 18-key authored asset
  contract. Fallback use is observable and disqualifying in critic captures.
- `WebAssetSource/P31/` preserves lawful source provenance, transformations,
  validation, hashes, and byte-identical runtime publication records.
- `ArtSource/P30/` preserves builder and critic receipts. Private benchmark
  originals and blind-comparison workspaces are never published.
- `progress/` is the evidence ledger and has no authority over gameplay state.

## Live production ledger

The owner-only production ledger is deployed at
[codex-of-war-progress.thedude6.chatgpt.site](https://codex-of-war-progress.thedude6.chatgpt.site).
It shows every piece, its current state, rejected round history, sanitized
critic evidence, and the latest candidate captures. The accepted global
manifest remains pinned to P00 until a later round actually clears its gate.

## Archived Unity lane

The following commands document the preserved Unity evidence lane. Unity is no
longer the active runtime and these commands are not required to run the
Three.js game.

Legacy requirements:

- Unity `6000.5.4f1`
- Universal Render Pipeline `17.5.0`

```bash
REPO_ROOT="/Users/amir/Documents/Gauntlet Loop"
UNITY_BIN="/Applications/Unity/Hub/Editor/6000.5.4f1/Unity.app/Contents/MacOS/Unity"
mkdir -p "$REPO_ROOT/Artifacts/P00/round-001"
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
Its filed manifest anchors the source invocation to clean revision
`7fe9b937249a053f9c0d986e02d556eada33f733`; generated scene YAML may receive
fresh Unity local file IDs without changing the rendered bytes.

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

## Local progress dashboard

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
piece states, preserved Unity history, the active Three.js evidence lane,
frozen capture and acceptance contracts, and round history. Its tests verify
the filed evidence identities and public-safety boundary.

## Legacy Unity architecture boundaries

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
benchmark archive and images are not copied into either runtime, the dashboard,
build artifacts, or source control. Review records may mention only benchmark
shot IDs and derived measurements.

The frozen backlog and review contract live in
`Docs/Production/BuildPieces.md` and `Docs/Production/ReviewProtocol.md`.
