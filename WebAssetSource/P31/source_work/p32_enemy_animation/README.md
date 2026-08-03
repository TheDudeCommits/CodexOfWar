# P32 enemy attack animation carrier

This bounded P32 pass reuses the already-acquired Quaternius **Zombie
Apocalypse Kit** source documented by P31. No publisher asset was reacquired.
The publisher and retained license identify the pack as CC0 1.0.

## Curated output

`processed/quaternius/animations/enemy_attacks.glb` is a compact, ordinary
glTF 2.0 animation carrier. Blender 5.2.0 LTS imported the previously curated
`processed/quaternius/models/zombie_basic.glb`, retained only the publisher's
`Idle_Attack` action and 50-joint hierarchy, then removed preview geometry,
materials, and images before GLB export. The runtime copy is byte-identical at
`web-game/public/assets/animations/quaternius/enemy_attacks.glb`.

The source `zombie_basic.glb` and the production Hollow have the same ordered
50-joint schema. This supports direct Three.js clip binding by node name. P32
does **not** claim that the publisher authored separate bite, pounce, and slam
clips: those three identities are deterministic view-only timing and root-pose
curations layered over the one compatible authored full-body attack.

## Rebuild

```sh
blender --background --factory-startup \
  --python WebAssetSource/P31/source_work/quaternius/convert_assets.py -- \
  --input WebAssetSource/P31/processed/quaternius/models/zombie_basic.glb \
  --output WebAssetSource/P31/processed/quaternius/animations/enemy_attacks.glb \
  --keep-actions Idle_Attack \
  --animation-carrier
```

See `receipt.json` for exact hashes, structure, and validation results.
