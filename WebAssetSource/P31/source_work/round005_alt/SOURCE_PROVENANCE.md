# Source provenance — Round005 selected duel package

This package is published through the manifest's stable `character.hero`,
`character.hollow`, and `weapon.claymore` URLs. The source and runtime GLBs are
byte-identical; the manifest itself did not need a key or URL change.

## Blender Studio Rain v3.2 (hero visual foundation)

- Creator: Blender Studio / Blender Foundation.
- Official page: https://studio.blender.org/characters/rain/v3/
- License: Creative Commons Attribution 4.0 International.
- Repository source: `ArtSource/P10/Round004/ThirdParty/BlenderStudioRain/rain_v3.2.blend`
- Source SHA-256: `831ab6d837c679040285862b15dc9ee5180b018442a88aeaf92aaa7509b80258`
- License proof SHA-256: `9ba9550ad48438d0836ddab3da480b3b69ffa0aac7b7878b5a0039e7ab429411`
- Immediate lawful derivative input: `WebAssetSource/P31/processed/round004/characters/nyra.glb`
- Immediate input SHA-256: `f3e93e577a7419b29734646488166ce3b52f52bb8982e2a5041d2237222d7101`
- Alternate modifications: deterministic web LOD; dark fantasy palette; new high collar,
  broad asymmetric pauldrons, shoulder blades, aether crest, and split mantle; preserved
  65-bone canonical gameplay rig; baked two-hand secondary grip into the exact
  `Sword_Regular_A` clip; explicit `weapon_socket` node.

## Blender Human Base Meshes bundle v1.0.0 (Hollow skull)

- Publisher: Blender Foundation / Blender Studio and Blender community.
- Official index: https://download.blender.org/demo/bundles/bundles-3.6/
- Official download: https://download.blender.org/demo/bundles/bundles-3.6/human-base-meshes-bundle-v1.0.0.zip
- License: CC0 1.0 Universal (bundle README declares the assets public domain).
- Bundle SHA-256: `46a912c0524072ac3b78c35d5d2471df7b8df102394a050ca8cd7184e3393648`
- Used object: `Skull - Realistic`; authors credited by the bundle: Paul Kotelevets
  and Tonatiuh de San Julián.
- Alternate modifications: base topology only; modifiers stripped; deterministic
  web decimation; resized and rigid-bound as an exposed skull under a broken hood.

## Quaternius Zombie Basic (Hollow rig/body/Idle/Death foundation)

- Creator: Quaternius.
- Official page: https://quaternius.com/packs/zombieapocalypsekit.html
- License: CC0 1.0 Universal.
- Repository source: `WebAssetSource/P31/processed/quaternius/models/zombie_basic.glb`
- Source SHA-256: `f199c9bdea193312fae5e13e045d4677e6b68bced027178252e8de61c33d5ac4`
- Alternate modifications: cartoon cranium deleted; body/rest skeleton elongated;
  charred corpse surface; exposed skull/bone, black-iron rib cage, broken pauldron,
  gravefire rot, crown spikes, skeletal forearm/talons, and split burial shroud added;
  exact `Idle` and `Death` retained; synchronized `HitReact` replaced with original
  Round005 alternate choreography; explicit `impact_socket` node.

## Original alternate work

`Dawnbreak` claymore geometry, rune inlay, named grip/contact nodes, hero armor
overlays, Hollow armor/shroud additions, grip bake, contact choreography, validators,
measurements, preview lighting, and evidence layout are original repository work.

## Rejected scout

Blender Studio Einar v1 (CC BY 4.0) was inspected through the repository's lawful
25,484-triangle LOD2.  That portable LOD is frozen in an industrial civilian/mechanic
pose, has no portable deform rig or texture package, and its dominant mechanical arm
and workwear silhouette could not be transformed into the requested fantasy/anime
hero without discarding the source's main visual identity and runtime clip compatibility.
It is therefore not included in this candidate.
