# P31 Round005 selected duel package

This directory is the reproducible source workspace for the Round005 hero /
Hollow / claymore package selected by the browser runtime. The source build
receipt intentionally remains marked `integrated: false` because it was frozen
before the separate integration pass; the byte-identical published files live
under `processed/round005/` and `web-game/public/assets/models/ashwake/`.
Build outputs, provenance, validation, contact measurements, and 1600x900
evidence renders are generated locally by `build_alt.py`.

The candidate is intentionally optimized around the frozen S03/S04/S05 combat
moments: readable separated silhouettes, a broad non-edge-on blade, two visible
palm contacts, and synchronized strike / HitReact choreography.

## Build and validate

From any directory:

```sh
blender --factory-startup --disable-autoexec --background --python WebAssetSource/P31/source_work/round005_alt/build_alt.py
python3 WebAssetSource/P31/source_work/round005_alt/validate_glbs.py
blender --factory-startup --disable-autoexec --background --python WebAssetSource/P31/source_work/round005_alt/validate_blender_reimport.py
node WebAssetSource/P31/source_work/round005_alt/validate_integration.mjs
```

The static validator checks GLB 2.0 self-containment, exact animation and socket
contracts, skin joint counts, byte-current build and render receipts, the 68k
visible-triangle package budget, the conservative frozen S04 renderer projection,
and the authored grip/contact thresholds. It writes `reports/validation.json`.
The second validator clean-imports each GLB in factory-startup Blender and writes
`reports/blender-reimport.json`.

## Runtime transform contract

- Import all three GLBs as Y-up, meter-scale glTF 2.0 assets.
- Parent the weapon scene to the hero's `weapon_socket` with identity local
  position `(0, 0, 0)`, identity quaternion, and local scale `(1, 1, 1)`.
- `ClaymoreRoot` is identity; its blade points along local `+Y`. `GripPrimary`
  is the origin, `GripSecondary` is local `(0, -0.12, 0)`, `ContactMarker` is
  local `(0, 1.52, 0)`, and `BladeTip` is local `(0, 1.72, 0)`.
- Runtime starting values for the frozen combat centers are hero scale `1.22`,
  Hollow scale `1.16`, visual toe-in yaw `0.50 rad`, weapon axial roll
  `+0.60 rad`, and local visual offset `x=-0.62 m` for each actor. These
  transforms stay below the simulation roots; with opposing root yaws they
  separate silhouettes laterally without mutating the fixed hero
  `z=1.6000008583068848` / enemy `z=0` centers.
