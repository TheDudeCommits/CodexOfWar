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

The tape travels from `z=2.60` to `z=1.60` at 3 m/s, reports startup ticks 24–31, active 32–35, one 10-damage hit on tick 33, recovery 36–49, idle 50, and a busy rejection on tick 28. `telemetry()` includes every processed-tick snapshot, deterministic camera pose/projection/boom fields, renderer counters, context lifecycle, and errors. Capture validation adds `&framing=1` to include exact animated-vertex framing measurements without charging ordinary smoke telemetry for that audit. The Round007 camera resolves its boom against the authored arena meshes with 0.45 m clearance and clears all smoothing/shake accumulators on reset.

`window.__GAUNTLET__` remains as a lightweight interactive/capture alias. Routes such as `/?capture=combat&post=0` produce a stable paused scenario for screenshots. The additive `telemetry().assetLoad` / `getAssetLoadReceipt()` receipt reports every enabled and loaded key, PMREM installation, authored-view selection, and any active fallback without changing the `cow.review.v1` contract.

## GLB asset contract

`public/assets/manifest.json` version 2 preserves exactly 18 stable enabled keys for the required characters, weapon, animation carriers, environment pieces, PBR maps, and HDR environment. The visible duel uses:

- Quaternius `female_ranger_outfit.glb`, `zombie_basic.glb`, and `claymore.glb`
- Quaternius `player_core.glb` and `combat_zombie.glb` animation carriers
- a bounded Ashwake fort sector assembled from Poly Haven Modular Fort 01 plus exactly one Gothic Statue
- two shared 1K WebP PBR triplets: Poly Haven Mossy Cobblestone for the ground and Modular Fort wall maps for the sector
- Poly Haven Snowy Forest 1K HDR loaded through PMREM

All 18 shipped manifest entries are enabled by default. Stable procedural hero, Hollow, and arena fallbacks remain available only for genuine load or required-rig/clip failure, and that state is observable through the asset receipt. The Round003 environment payload under `public/assets/environment/ashwake/` is 3,349,498 bytes and uses ordinary GLB/WebP without Draco, Meshopt, or KTX2. Source provenance, publisher hashes, Blender 5.2 validation, `cwebp` commands, and byte-identical publish proof live under `WebAssetSource/P31`; raw publisher files are not part of the runtime.

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

## Camera evidence

`npm run test:camera` covers reset determinism, the four required replay sample ticks, adaptive distance, a wall-on-boom mesh, and exact clear-path distance. `npm run evidence:camera` writes the numeric obstruction receipt used by the headed Round007 capture script.
