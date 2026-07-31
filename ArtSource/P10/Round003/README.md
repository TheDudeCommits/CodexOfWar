# P10 Round 003 Source Receipt — Blender Studio Rain

Round 003 replaces the rejected low-detail hero foundation with Blender
Studio's professionally authored **Rain v3.3** character. Rain supplies the
continuous face, hands, feet, cloth fit, UVs, materials, and source rig. The
anime-warrior palette, tailored armor, weapon, presentation poses, delivery
meshes, and diagnostic renders are authored by a scripted pipeline in this
repository.

## Outcome — visual NO-GO

Round 003 is preserved as a rejected source-bound iteration. It never entered
Unity and must not be described as an accepted or playable hero delivery.

- A fresh-context critic inspected all nine 1600 px diagnostics and every
  image in the supplied God of War Ragnarök benchmark archive, then scored the
  asset **6/13** with only **4/8 mandatory checks** passing.
- The decisive failure is the full-body design transformation: the character
  still reads as stock Blender Studio Rain in a civilian tank, scarf, jeans,
  and sneakers with thin cyan overlays, rather than an unmistakable premium
  anime warrior.
- Mandatory hands/grip, costume, weapon, and material checks failed. LOD
  budget, combat line of action, and authored warrior identity also failed.
- The exact independent review is
  `Preflight/P10_Round003_FreshVisualPreflightReview.json`, SHA-256
  `b5261bb3d802ff096b10d6208fb49ebcbf708b51e7531c8bfd3aa4949b54cf4c`.
- The decisive frame is `Preflight/P10_Round003_Front.png`, SHA-256
  `df24d4d4ac40b66ce828f5aaef46ce833e933bf2529dae4e4ed63513e8e3839d`.
- Two isolated Blender 5.2 factory-startup reruns reproduced geometry,
  topology, transforms, materials, weights, bounds, and armature facts, but
  **0/16 artifact hashes** matched either the repository or the second rerun.
  The pipeline is semantically reproducible, not byte-deterministic.
- The physical Combat FBX exists, but the audit omits its record because the
  generator merges `combat` FBX and PNG entries under the same key. This
  manifest defect is intentionally retained as reviewed evidence.
- A separate reduced-rig prototype proved that an 80-bone, four-weight,
  76,544-triangle Rain export is mechanically feasible. Its shoulder/elbow and
  wrist/finger deformation remains below production quality and it is not part
  of this rejected static delivery.

## Acquisition and license

- Asset: **Rain v3**, Blender Studio character rig.
- Publisher: Blender Studio / Blender Foundation.
- Primary page: <https://studio.blender.org/characters/rain/v3/>
- Official direct payload:
  <https://studio.blender.org/download-source/files/ee/a7/eea73e55dba1cea31c09848df6a794b2-4.zip>
- Download filename: `rain-v33.zip`
- Vendor-listed size: 64.4 MB.
- Acquired: 2026-07-31.
- Archive SHA-256:
  `80217f163f6392dc829233d63c2cfb5e1376775bc34101ad14f39631fea70d24`
- License: [Creative Commons Attribution 4.0
  International](https://creativecommons.org/licenses/by/4.0/).
- Required credit, copied from the primary page:
  `Rain Rig (CC) Blender Foundation | studio.blender.org`
- Primary-page license statement:
  “The rig is free to use, provided that you respect the CC-BY license and
  include the credit: Rain Rig (CC) Blender Foundation |
  studio.blender.org.”
- The exact CC BY 4.0 legal code downloaded on the acquisition date is
  preserved at
  `ThirdParty/BlenderStudioRain/LICENSE-CC-BY-4.0.txt`.

The downloaded archive is quarantined outside the repository. The exact
selected source `.blend`, its complete companion texture directory, this
receipt, and the license text are the only vendor inputs admitted to the
Round003 source tree.

## Selected source hashes

| Repository path under `ThirdParty/BlenderStudioRain` | SHA-256 |
| --- | --- |
| `rain_v3.2.blend` | `831ab6d837c679040285862b15dc9ee5180b018442a88aeaf92aaa7509b80258` |
| `LICENSE-CC-BY-4.0.txt` | `9ba9550ad48438d0836ddab3da480b3b69ffa0aac7b7878b5a0039e7ab429411` |
| `textures/TEX-rain_body_diffuse.1001.png` | `79294db9cccc7c395b3c95c5692eae454554611e8cad89e898f8b325b504bad5` |
| `textures/TEX-rain_body_diffuse.1002.png` | `d4abb09a50d846f57179d61bb0a72431cc57d261b1646b6439de1724afce4afc` |
| `textures/TEX-rain_body_diffuse.1003.png` | `64e0f179a1a872758801ce433b2b5b20ba0e9a399e01574b5a0f9266868c86ca` |
| `textures/TEX-rain_body_diffuse.png` | `79294db9cccc7c395b3c95c5692eae454554611e8cad89e898f8b325b504bad5` |
| `textures/TEX-rain_body_roughness.1001.png` | `22becb2fe72f49931f3dd278c78ae94f182da956f0ba2c77e324f7d3fca2f179` |
| `textures/TEX-rain_body_roughness.1002.png` | `12a6d25dc64fa1b31fade64f64ca7568e3f11f691de1ffd1be59c9c92ffa2378` |
| `textures/TEX-rain_body_roughness.1003.png` | `ab8a673417a762a78a0db1ae1489b13016799da8c24bfe9fea57763dedff9962` |
| `textures/TEX-rain_body_roughness.png` | `22becb2fe72f49931f3dd278c78ae94f182da956f0ba2c77e324f7d3fca2f179` |
| `textures/TEX-rain_eyes.png` | `fb2d509abe4bfa3aa4093272e81a25ddd9bbc3e4d03248fe7f213f9cda38a005` |
| `textures/TEX-rain_hair_diffuse.png` | `01c35d3fc4b3e961acf3446fdc4a5de83937e09c1b05b074b27c87e511d50ad6` |
| `textures/TEX-rain_hair_direction.png` | `3b17c6caeb953c6931aa6ccbaf8a082f236e66f7df2fcc1d54376d928ba7af0f` |
| `textures/TEX-rain_hair_direction_bw.png` | `099063769a7e132e93e2d5d93d9af5548f0c1b9e56b6098d47ce8cae8cf7c1bc` |
| `textures/TEX-rain_hands_diffuse.png` | `d4abb09a50d846f57179d61bb0a72431cc57d261b1646b6439de1724afce4afc` |
| `textures/TEX-rain_hands_roughness.png` | `12a6d25dc64fa1b31fade64f64ca7568e3f11f691de1ffd1be59c9c92ffa2378` |
| `textures/TEX-rain_jeans_diffuse.png` | `863b131b700ba189808c66970ad3abfcfa63b3d017676cd7dc5646f20f23305b` |
| `textures/TEX-rain_jeans_normal.png` | `e09126c3f5283e772bfe04a08daa0fa20688878a755abd5e88b9e0bf471e1337` |
| `textures/TEX-rain_jeans_roughness.png` | `d509abb985ec1d1b6571955f8596bc629cf03938c385536c2f992bfcd57e3a74` |
| `textures/TEX-rain_scarf_cavity.png` | `203a77498f163116f697100effaf20f0fbbaed70fbaed2b68ab9d7cb7c398a8a` |
| `textures/TEX-rain_socks_bump.png` | `bf71806f0b9e3cef029f46b6cb24a90633498622244c4dc88747a2dbb168a049` |
| `textures/TEX-rain_socks_roughness.png` | `fe9f0876fa41391091e91d6aa7c9cf40681a7544128d71519ef6fff0413e2f1c` |
| `textures/TEX-rain_top_bump.png` | `61f8ffdbde13c9fada97e9c45906426c9d92f1b94cb75ce718f498b9dadb5d1c` |
| `textures/TEX-rain_top_roughness.png` | `fb00f4f18e808dcb7a20a1732298e7252fee4502f797fd4299ce2cc88f39c42b` |

## Authorship and runtime boundary

The Round003 builder must:

1. verify the source and texture hashes before authoring;
2. preserve Rain's continuous face, hands, feet, cloth fit, UVs, and supplied
   PBR texture work;
3. recolor and surface the eyes, hair, cloth, and accents into the locked
   Astra Vale anime-warrior palette;
4. derive armor from duplicated fitted source surfaces, then use shrinkwrap
   and solidify for continuous tailored panels—never floating torso primitives;
5. author a smaller, functional Aether Greatblade with a readable guard,
   handle, emissive channel, and valid hand contact;
6. emit static neutral/combat presentation FBXs, three audited LOD FBXs, and a
   deform-only CloudRig proof export;
7. label the CloudRig proof honestly: the source uses 392 deform bones and
   thousands of vertices with more than four deform influences, so it is not a
   playable four-weight delivery claim;
8. render the required native 1600 px diagnostic views from the authored
   source and record output hashes.

No benchmark pixel, mesh, or material enters this source tree.
