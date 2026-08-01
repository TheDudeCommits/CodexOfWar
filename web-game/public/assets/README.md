# Runtime asset contract

The playable build uses the enabled CC0 Round002 presentation set in `manifest.json`. Gameplay and render adapters still refer to stable keys rather than filenames, and a procedural fallback is retained only for an observable load or validation failure.

- Ship GLB/glTF 2.0, authored in meters with +Y up and -Z forward.
- Ground character pivots at the feet. Apply transforms before export.
- Preserve stable node and animation names.
- Keep collision and deterministic simulation state outside the authored render hierarchy.
- Run glTF Transform validation, prune/dedup, then choose Meshopt or Draco deliberately.
- Use KTX2 for production textures when the delivery pipeline is ready.
- Keep animation carriers loaded with their `AnimationClip` arrays; clone visible skinned scenes through `SkeletonUtils`.
- Load the snowy-forest HDR through `RGBELoader` and PMREM. Diffuse maps are sRGB; normal and ARM maps are linear.

The runtime payload is a selective copy from `WebAssetSource/P31/processed/`. Full publisher provenance and hashes remain in `WebAssetSource/P31/THIRD_PARTY_ASSETS.md` and `WebAssetSource/P31/ASSET_RECEIPT.json`; no raw archive or conversion cache is shipped here.

## Source/runtime duplication policy

The duplication between `WebAssetSource/P31/processed/` and this directory is intentional. The P31 tree is the curated, provenance-backed source set; this directory is the self-contained subset Vite must copy into the deployed public root. Runtime assets are kept as real files rather than symlinks so clean installs, CI builds, and static hosting do not depend on paths outside `web-game/`. When a source asset changes, update its runtime copy and manifest together, then verify the copied bytes against the P31 receipt. Never copy `WebAssetSource/P31/raw/` into the runtime.
