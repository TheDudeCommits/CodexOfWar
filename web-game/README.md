# Gauntlet Loop — Three.js vertical slice

This directory is an isolated, judgeable browser-game foundation. It does not depend on or modify the existing Unity project.

## Run

```bash
npm ci
npm run dev
```

Open `http://localhost:4173`.

Controls:

- `WASD` / arrows — camera-relative movement
- `Shift` — sprint (drains vigor)
- `Space` — directional dodge
- left mouse / `J` — primary strike
- `Q` — lock/unlock the Hollow
- mouse — third-person camera while pointer-locked
- `Escape` — pause and release pointer lock
- `F3` — measurable diagnostics
- `P` — compare post-processing on/off
- `C` — download a canvas capture (`?captureBuffer=1` makes capture buffering explicit)

## Architecture

- `src/game/simulation/` owns deterministic rules, timers, attack windows, health, stamina, and serializable state. It imports no Three.js objects.
- `src/game/input/` maps physical input to named actions in one place.
- `src/physics/` is the explicit Rapier movement/collision bridge.
- `src/render/app/` owns the renderer, third-person camera, loop, resize, and WebGL lifecycle.
- `src/render/adapters/` projects simulation state into authored scene views without owning game rules.
- `src/render/loaders/` retains stable manifest-keyed GLB scenes, animation clips, textures, and HDR data through a Three.js `LoadingManager`.
- `src/render/post/` contains the optional, measured bloom pass.
- `src/ui/` is a low-chrome DOM HUD; combat text is not baked into WebGL.
- `src/diagnostics/` exposes performance and deterministic review/capture hooks.

The runtime uses a 60 Hz fixed simulation step. Render cadence, scene objects, and DOM updates cannot advance combat timers directly.

## Deterministic review mode

Open `/?review=1&post=0` for the frozen 1600×900, DPR 1, non-autonomous review surface. The API is installed as `window.__COW_REVIEW__`:

```js
const review = window.__COW_REVIEW__;
await review.ready; // cow.review.v1 receipt, after Rapier/assets/fonts/compile/two warm renders
review.reset({ piece: "P30", preset: "combat-tape-a", seed: 30001 });
review.queue([
  ...Array.from({ length: 20 }, (_, tick) => ({
    tick,
    action: "move.forward",
    phase: "value",
    value: 1,
  })),
  { tick: 24, action: "attack.primary", phase: "down" },
  { tick: 25, action: "attack.primary", phase: "up" },
  { tick: 28, action: "attack.primary", phase: "down" },
  { tick: 29, action: "attack.primary", phase: "up" },
]);
review.stepTicks(60);
console.table(review.telemetry().events);
```

The tape travels from `z=2.60` to `z=1.60` at 3 m/s, reports startup ticks 24–31, active 32–35, one 10-damage hit on tick 33, recovery 36–49, idle 50, and a busy rejection on tick 28. `telemetry()` includes every processed-tick snapshot, camera pose/projection/boom fields, renderer counters, context lifecycle, and errors.

`window.__GAUNTLET__` remains as a lightweight interactive/capture alias. Routes such as `/?capture=combat&post=0` produce a stable paused scenario for screenshots. The additive `telemetry().assetLoad` / `getAssetLoadReceipt()` receipt reports every enabled and loaded key, PMREM installation, authored-view selection, and any active fallback without changing the `cow.review.v1` contract.

## GLB asset contract

`public/assets/manifest.json` version 2 keeps the stable character/environment keys and adds the required weapon, animation carriers, ruin pieces, PBR maps, and HDR environment. The visible duel uses:

- Quaternius `female_ranger_outfit.glb`, `zombie_basic.glb`, and `claymore.glb`
- Quaternius `player_core.glb` and `combat_zombie.glb` animation carriers
- a bounded Kenney ruin sector
- Poly Haven Mossy Cobblestone / Castle Brick 1K PBR maps and Snowy Forest 1K HDR

All shipped manifest entries are enabled by default. Stable procedural hero, Hollow, and arena fallbacks remain available only for genuine load or required-rig/clip failure, and that state is observable through the asset receipt. Source provenance and publisher hashes live under `WebAssetSource/P31`; raw publisher archives are not part of the runtime.

## Verification

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium # first machine only
npm run smoke
```

The browser suite runs the exact P30 combat tape, the out-of-range tape, physical keyboard/pause/blur handling, and a 1600×900 capture.

## Known gap

Third-person boom obstruction/camera collision is not implemented in this slice. The camera API exposes desired/resolved boom telemetry and explicitly reports `cameraObstruction.status: "pending"`; it does not claim that the pending tape passes.
