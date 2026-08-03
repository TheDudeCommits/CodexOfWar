# Runtime asset contract

The playable build uses the enabled CC0 Round003 presentation set in `manifest.json`. Gameplay and render adapters still refer to the same 18 stable keys rather than filenames, and a procedural fallback is retained only for an observable load or validation failure.

- Ship GLB/glTF 2.0, authored in meters with +Y up and -Z forward.
- Ground character pivots at the feet. Apply transforms before export.
- Preserve stable node and animation names.
- Keep collision and deterministic simulation state outside the authored render hierarchy.
- The six Ashwake environment GLBs are ordinary, texture-free, one-mesh/one-material files selected and validated with Blender 5.2.0 LTS; no Draco, Meshopt, or KTX2 extension is required.
- The ground and fort-sector material triplets are ordinary 1024×1024 WebP. Diffuse is sRGB; normal and packed ORM are linear.
- Keep animation carriers loaded with their `AnimationClip` arrays; clone visible skinned scenes through `SkeletonUtils`.
- The P32 `enemy_attacks.glb` carrier is the meshless, one-clip Quaternius
  `Idle_Attack` source for Hollow's exact 50-joint schema; its receipt is
  `WebAssetSource/P31/source_work/p32_enemy_animation/receipt.json`.
- Load the snowy-forest HDR through `RGBELoader` and PMREM. Diffuse maps are sRGB; normal and ARM maps are linear.

The runtime payload is a selective copy from `WebAssetSource/P31/processed/`. Full publisher provenance and hashes remain in `WebAssetSource/P31/THIRD_PARTY_ASSETS.md` and `WebAssetSource/P31/ASSET_RECEIPT.json`; no raw archive or conversion cache is shipped here.

The active environment geometry comes from Poly Haven Modular Fort 01 and exactly one Gothic Statue. Mossy Cobblestone supplies the ground maps, Modular Fort supplies the shared sector maps, and Snowy Forest remains the PMREM HDR environment. The twelve byte-identical files under `environment/ashwake/` total 3,349,498 bytes; their exact lineage is in `WebAssetSource/P31/source_work/round003/runtime_publish_receipt.json`.

## Source/runtime duplication policy

The duplication between `WebAssetSource/P31/processed/` and this directory is intentional. The P31 tree is the curated, provenance-backed source set; this directory is the self-contained subset Vite must copy into the deployed public root. Runtime assets are kept as real files rather than symlinks so clean installs, CI builds, and static hosting do not depend on paths outside `web-game/`. When a source asset changes, update its runtime copy and manifest together, then verify the copied bytes against the P31 receipt. Never copy `WebAssetSource/P31/raw/` into the runtime.
