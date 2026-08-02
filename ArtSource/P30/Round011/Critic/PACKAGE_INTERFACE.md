# P30 Round011 opaque candidate package interface

Status: **LOCKED before candidate access**  
Protocol: `P30-R011-BLIND-v1`

This interface is mandatory. A package that cannot satisfy it is not patched, wrapped, or repaired by the critic; it fails. The critic may read the identity-free interface file and execute commands, but may not browse candidate source, source maps, Git history, builder worktrees, or builder evidence before the alias-only score is sealed.

## 1. Delivery and opacity

Exactly two candidate source packages are delivered only after the protocol commit and the salted package/map commitment are fixed.

- Archive/directory names and every evaluator-facing label use `candidate-[0-9a-f]{16}`.
- Aliases are random, distinct, and have no `A`, `B`, author, branch, approach, timestamp, or rank semantics.
- Each package is a clean, self-contained snapshot of one exact source commit, excluding `.git` only. It contains everything needed for a clean Node 24 install, tests, production build, and production serve.
- No builder screenshots, videos, scores, notes, self-critiques, logs, source maps, absolute source paths, Git metadata, author fields, branch names, badges, or other identity/approach clues may be present or emitted.
- No symlink, hard-link alias, device, socket, FIFO, path traversal, Unicode non-NFC path, or case-colliding path is permitted.
- The package may not depend on a sibling worktree, global project checkout, dev server, uncommitted file, localhost service other than its own production server, or evaluator-installed shim.
- Runtime network access after `npm ci` is forbidden. All production assets must be inside the package/build. An essential request outside `127.0.0.1` fails T3.
- The critic does not fix commands, dependencies, assets, input, lifecycle hooks, or the render path. Failure is evidence.

Any identity leak before the score seal voids the round. Any package mutation, hash mismatch, or source substitution disqualifies the affected candidate and, if the map no longer verifies, voids the round.

## 2. Required root files and npm scripts

The package root must contain:

1. `package.json` with an identity-neutral package name and `engines.node` restricted to major 24.
2. `package-lock.json` generated for npm and sufficient for offline-repeatable `npm ci` once its registry artifacts are available.
3. `CRITIC_INTERFACE.json` matching section 3.
4. All production source, tests, and local assets needed by the declared commands.

The following commands are fixed and run with `PATH` beginning `/opt/homebrew/opt/node@24/bin`:

```text
npm ci --audit=false --fund=false
npm run test:critic
npm run build:critic
npm run serve:critic -- --host 127.0.0.1 --port <evaluator-port>
```

Requirements:

- `test:critic` must run real tests and fail when no tests are collected; `--passWithNoTests`, ignored failures, and equivalent bypasses are forbidden.
- `build:critic` must make a clean optimized production build. It may not copy a screenshot/video as the playfield, fetch a prebuilt candidate from elsewhere, or emit a dev build.
- `serve:critic` must serve only the completed production output and must honor the supplied host/port. It may not invoke Vite/Webpack/etc. development mode, hot reload, source transforms, or a screenshot-specific route.
- All commands must exit or become ready without prompts. Install, test, and build must exit zero. The server must expose a deterministic readiness response and shut down cleanly on `SIGTERM`.
- The original delivered tree is hashed before commands. Commands run in an evaluator-owned disposable copy. The delivered package never changes.

## 3. `CRITIC_INTERFACE.json`

This is the only candidate-authored file the critic may inspect before execution. It must contain no free-form prose and exactly this identity-free shape; strings shown as placeholders are replaced with values satisfying the stated constraints:

```json
{
  "schema": "p30.r011.candidate-interface.v1",
  "protocolID": "P30-R011-BLIND-v1",
  "opaqueAlias": "candidate-0000000000000000",
  "nodeMajor": 24,
  "packageManager": "npm",
  "normalPlayableRoute": "/<normal-production-route>",
  "readyPath": "/<production-readiness-path>",
  "scenarioID": "P30-light-strike-v1",
  "seed": 30011,
  "fixedDeltaNumerator": 1,
  "fixedDeltaDenominator": 60,
  "lightStrikeInput": {
    "device": "mouse",
    "button": "left"
  },
  "criticHookGlobal": "__P30_CRITIC__",
  "buildOutputDirectory": "<relative-production-directory>"
}
```

Rules:

- Both candidates must declare the same normal route, scenario ID, seed, fixed delta, and light-strike input. A package-specific route or input accommodation fails comparison integrity.
- `normalPlayableRoute` must be the real game route a player uses. Query parameters may select the normal P30 scenario, seed, and deterministic fixed step, but may not select another renderer, camera, scene, pose set, asset tier, screenshot page, or judging-only presentation.
- `readyPath` returns a small identity-free status response only after the same production build is ready to accept the playable route. It is not a second renderer.
- Paths are relative POSIX paths, contain no `..`, and disclose no identity.
- The file's `opaqueAlias` must equal the delivery alias and the precommitted alias.

## 4. Normal input and read-only capture hook

The light strike is initiated through Playwright's normal mouse input at the declared button while the production canvas has focus. Calling an attack method, changing animation state, or injecting a pose is forbidden.

The production page exposes `window.__P30_CRITIC__` only as deterministic instrumentation over the already-running real game. It must provide:

- `schema === "p30.r011.runtime-hook.v1"`.
- `whenReady(): Promise<void>` resolving at the first actionable production game frame.
- `armCaptureTicks(number[]): void`, callable before the strike, which can pause immediately after the authoritative fixed update for a requested attack-relative tick and before the next update.
- `resume(): void`, which only releases that pause.
- `snapshot(): object`, a read-only receipt of the current authoritative state.
- `runReceipt(): object`, returning seed/fixed-step/input/event/camera/state-digest history for the current uninterrupted run.
- `resourceReceipt(): object`, reporting engine-owned renderer/resource counts where the engine can do so; CDP/DOM measurements remain authoritative.

The hook may set the fixed seed and fixed step before gameplay begins and may pause/resume time. It may not seek, rewind, fast-forward, re-pose, swap animation clips, alter collision, change camera/HUD/assets/LOD/lighting/effects, issue gameplay actions, re-render through another scene/camera/canvas, or manufacture telemetry. The exact same production draw is shown whether a capture tick is armed or not. Removing or bypassing the hook must leave normal gameplay visually and mechanically identical.

Tick convention:

- Attack-relative tick `0` is the first authoritative 1/60-second fixed update that samples the normal light-strike input rising edge.
- Tick `N` evidence is captured after update `N`, with render interpolation alpha `0`, and before update `N+1`.
- Ticks 27 through 43 are captured from one uninterrupted strike in every cold profile. Focused ticks are exactly 29, 34, and 41.
- Pausing for a screenshot does not advance wall-clock soak time and is forbidden during the 30-second live-input soak.

`snapshot()` and `runReceipt()` must expose, at minimum:

- absolute simulation tick, attack-relative tick, seed, fixed delta, pause state, and a monotonically increasing render heartbeat;
- camera world transform, view matrix, projection matrix, and viewport;
- attacker root/hips/torso/head/hands/feet transforms and per-foot ground-contact booleans;
- weapon root, grip midpoint, active-edge sample points, tip, angular velocity, and velocity direction;
- target root/head/torso/contact-side shoulder transforms, screen/world height, health, collision surface/contact point, contact normal, and response impulse;
- input edge log and hit/damage/health event log with exact ticks and unique event IDs;
- a quantized authoritative state object using signed safe integers at `1e-6` world-unit/radian precision, serialized with BCJ-v1 and SHA-256 digested;
- explicit `rendererMode`, `assetTier`, `fallbackActive`, and context loss/restore counters.

Telemetry can confirm a visible success. It cannot rescue a pose, contact, response, or brake that is visually ambiguous or wrong.

## 5. Pre-access package/map commitment

Before the critic receives either package, the packaging authority supplies one canonical `PACKAGE_MAP_COMMITMENT.json` containing:

```json
{
  "schema": "p30.r011.package-map-commitment.v1",
  "protocolID": "P30-R011-BLIND-v1",
  "protocolPayloadSha256": "<64 lowercase hex>",
  "presentationCommit": "5df2ec1607da073c492d94d7f1c47c23606d51b9fdbc267a3ada8d76e853b05f",
  "packages": [
    {
      "alias": "candidate-0000000000000000",
      "archiveBytes": 0,
      "archiveSha256": "<64 lowercase hex>",
      "treeSha256": "<64 lowercase hex>"
    },
    {
      "alias": "candidate-1111111111111111",
      "archiveBytes": 0,
      "archiveSha256": "<64 lowercase hex>",
      "treeSha256": "<64 lowercase hex>"
    }
  ],
  "mapCommit": "<64 lowercase hex>",
  "mapCommitDomain": "P30R011/package-map/v1",
  "mapSaltDisclosure": "withheld-until-alias-score-seal"
}
```

`packages` is sorted by raw UTF-8 alias bytes. Archive SHA-256 is over the exact delivered archive bytes. Tree SHA-256 uses `tools/protocol-tools.mjs tree` and the byte framing in the locked protocol. The authority retains a fresh random 32-byte map salt and a BCJ-v1 map document containing, for each alias:

- exact candidate/builder identity;
- exact absolute source worktree path at packaging time;
- branch name;
- full 40-hex source commit;
- Git tree object ID;
- exact source archive SHA-256 and byte count;
- package archive SHA-256 and byte count;
- bytewise package tree SHA-256;
- bytewise digest of a detached, clean, LFS-materialized checkout of that commit;
- build command and expected production-output tree digest.

The map entries are sorted by raw UTF-8 alias bytes. The map commitment is:

```text
SHA256(
  UTF8("P30R011/package-map/v1") || 0x00 ||
  UINT64_BE(length(BCJ(mapDocument))) || BCJ(mapDocument) ||
  0x00 || raw_map_salt_32_bytes
)
```

The critic verifies only the public alias/package hashes before scoring. Identity fields, map document, and salt remain unavailable until the alias-only score and score commitment are committed.

## 6. Source parity after reveal

After the immutable score commit, the authority reveals the exact map document and salt. T1 passes only when all of the following are true:

1. The salted map commitment verifies byte-for-byte.
2. Each revealed alias maps to the exact already-tested archive and tree hashes.
3. The full source commit exists and its Git tree matches the revealed Git tree object ID.
4. A new detached clean checkout of that commit, with required LFS objects materialized and `.git` excluded, produces the revealed source-tree digest and byte-for-byte package tree digest.
5. A repeat clean Node 24 build from the revealed commit produces the precommitted production-output digest.
6. No file, commit, identity, branch, worktree, or approach differs from the committed map.

No explanatory substitution, equivalent commit, cherry-pick, patch, rebuilt archive, or “same output” claim is accepted. An unavailable object or LFS payload is a failed T1, not an invitation to weaken the gate.

