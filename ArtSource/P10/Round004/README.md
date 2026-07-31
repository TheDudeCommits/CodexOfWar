# P10 Round 004 Derivative Receipt — Blender Studio Rain

Round 004 uses Blender Studio's **Rain v3** only as a lawful anatomical,
facial, hand, foot, UV, material, and rigging foundation. The visible
head-to-toe warrior costume, footwear, harness, weapon mount, palette,
presentation poses, LODs, and diagnostics are repository-authored Round004
derivative work. No Round001–003 derived costume mesh is used as an input.

## Exact upstream source

- Asset: **Rain v3**, Blender Studio character rig.
- Publisher: Blender Studio / Blender Foundation.
- Primary page: <https://studio.blender.org/characters/rain/v3/>
- Official direct payload:
  <https://studio.blender.org/download-source/files/ee/a7/eea73e55dba1cea31c09848df6a794b2-4.zip>
- Official archive SHA-256:
  `80217f163f6392dc829233d63c2cfb5e1376775bc34101ad14f39631fea70d24`
- Selected `.blend` SHA-256:
  `831ab6d837c679040285862b15dc9ee5180b018442a88aeaf92aaa7509b80258`
- Preserved CC BY 4.0 legal code SHA-256:
  `9ba9550ad48438d0836ddab3da480b3b69ffa0aac7b7878b5a0039e7ab429411`
- License:
  [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/)
- Required credit copied from the official primary page:
  `Rain Rig (CC) Blender Foundation | studio.blender.org`
- Official statement:
  “The rig is free to use, provided that you respect the CC-BY license and
  include the credit: Rain Rig (CC) Blender Foundation |
  studio.blender.org.”

The exact selected vendor `.blend`, its 22 companion texture files, and the
license text were copied byte-for-byte from the already verified Round003
quarantine into `ThirdParty/BlenderStudioRain`. The Round004 builder verifies
every hash before authoring and copies the texture payload byte-for-byte into
the Round004 game delivery tree.

## Texture payload hashes

| File under `ThirdParty/BlenderStudioRain/textures` | SHA-256 |
| --- | --- |
| `TEX-rain_body_diffuse.1001.png` | `79294db9cccc7c395b3c95c5692eae454554611e8cad89e898f8b325b504bad5` |
| `TEX-rain_body_diffuse.1002.png` | `d4abb09a50d846f57179d61bb0a72431cc57d261b1646b6439de1724afce4afc` |
| `TEX-rain_body_diffuse.1003.png` | `64e0f179a1a872758801ce433b2b5b20ba0e9a399e01574b5a0f9266868c86ca` |
| `TEX-rain_body_diffuse.png` | `79294db9cccc7c395b3c95c5692eae454554611e8cad89e898f8b325b504bad5` |
| `TEX-rain_body_roughness.1001.png` | `22becb2fe72f49931f3dd278c78ae94f182da956f0ba2c77e324f7d3fca2f179` |
| `TEX-rain_body_roughness.1002.png` | `12a6d25dc64fa1b31fade64f64ca7568e3f11f691de1ffd1be59c9c92ffa2378` |
| `TEX-rain_body_roughness.1003.png` | `ab8a673417a762a78a0db1ae1489b13016799da8c24bfe9fea57763dedff9962` |
| `TEX-rain_body_roughness.png` | `22becb2fe72f49931f3dd278c78ae94f182da956f0ba2c77e324f7d3fca2f179` |
| `TEX-rain_eyes.png` | `fb2d509abe4bfa3aa4093272e81a25ddd9bbc3e4d03248fe7f213f9cda38a005` |
| `TEX-rain_hair_diffuse.png` | `01c35d3fc4b3e961acf3446fdc4a5de83937e09c1b05b074b27c87e511d50ad6` |
| `TEX-rain_hair_direction.png` | `3b17c6caeb953c6931aa6ccbaf8a082f236e66f7df2fcc1d54376d928ba7af0f` |
| `TEX-rain_hair_direction_bw.png` | `099063769a7e132e93e2d5d93d9af5548f0c1b9e56b6098d47ce8cae8cf7c1bc` |
| `TEX-rain_hands_diffuse.png` | `d4abb09a50d846f57179d61bb0a72431cc57d261b1646b6439de1724afce4afc` |
| `TEX-rain_hands_roughness.png` | `12a6d25dc64fa1b31fade64f64ca7568e3f11f691de1ffd1be59c9c92ffa2378` |
| `TEX-rain_jeans_diffuse.png` | `863b131b700ba189808c66970ad3abfcfa63b3d017676cd7dc5646f20f23305b` |
| `TEX-rain_jeans_normal.png` | `e09126c3f5283e772bfe04a08daa0fa20688878a755abd5e88b9e0bf471e1337` |
| `TEX-rain_jeans_roughness.png` | `d509abb985ec1d1b6571955f8596bc629cf03938c385536c2f992bfcd57e3a74` |
| `TEX-rain_scarf_cavity.png` | `203a77498f163116f697100effaf20f0fbbaed70fbaed2b68ab9d7cb7c398a8a` |
| `TEX-rain_socks_bump.png` | `bf71806f0b9e3cef029f46b6cb24a90633498622244c4dc88747a2dbb168a049` |
| `TEX-rain_socks_roughness.png` | `fe9f0876fa41391091e91d6aa7c9cf40681a7544128d71519ef6fff0413e2f1c` |
| `TEX-rain_top_bump.png` | `61f8ffdbde13c9fada97e9c45906426c9d92f1b94cb75ce718f498b9dadb5d1c` |
| `TEX-rain_top_roughness.png` | `fb00f4f18e808dcb7a20a1732298e7252fee4502f797fd4299ce2cc88f39c42b` |

## Round004 authorship and boundary

The final builder copies Rain's top and jeans only as continuous fitted
under-layer topology, then removes Rain's top, scarf, jeans, and shoes objects
from the derivative scene. Removal is deliberate: Rain's scarf has a source
visibility driver that can override `hide_render`. Clean FBX reimport found
zero civilian renderer names in all five exports.

The authored costume includes a continuous flank-closed leather cuirass,
split shallow chest plates, bound high gorget, front-to-back shoulder saddles,
fitted sleeves, diagonal and back harnesses, closures and stitching, an
asymmetrical coat/tabard/sash, bracers, thigh and knee protection, full
greaves and boots, and a rigid back weapon mount. The blade is supporting
silhouette only.

## Final build receipt

- Builder:
  `Tools/Blender/P10_Round004_AstraValeWarrior.py`
  — SHA-256
  `b2ea48ee89de0808d487dcf1f22ecca1b8689ea64001d4e62ab67ae36bc7cb90`
- Clean reimport validator:
  `Tools/Blender/P10_Round004_ValidateExports.py`
  — SHA-256
  `8d9de441e0cbc5a1719276c904163818c8b846248f0f851ac65b53e53b876daf`
- Authored derivative:
  `P10_Round004_AstraValeWarrior.blend`
  — SHA-256
  `8a38c2b63c6c4d534fd174a5058de89a88dfc47c031da31d1234a624250a8d4d`
- Audit:
  `Preflight/P10_Round004_Audit.json`
  — SHA-256
  `cd2746d1eb26fb7eb0dba28951b47799db84c2e4614f2a340ef9ec7dd8eeaf16`
- Factory-startup reimport report:
  `Preflight/P10_Round004_FBX_Reimport.json`
  — SHA-256
  `ecc8aa38c11147242b7f15a23936f7af4fdd3e56135982753b33c6c91df1579d`

The final factory-startup build used Blender 5.2.0 LTS with auto-execution
disabled. The authored blend resolves all 17 file-backed image datablocks
through derivative-relative paths; none are missing.

## Static delivery facts

| Delivery | Clean-import triangles | Armatures | Civilian renderer hits |
| --- | ---: | ---: | ---: |
| Neutral | 92,324 | 0 | 0 |
| Combat | 92,324 | 0 | 0 |
| LOD0 | 88,036 | 0 | 0 |
| LOD1 | 61,951 | 0 | 0 |
| LOD2 | 41,158 | 0 | 0 |

All five FBXs reimported independently from factory startup with 96 mesh
objects and plausible 1.65–1.80 m presentation bounds. LOD0 is below the
90,000-triangle cap and the three LODs are strictly monotonic.

Nine diagnostics—front, three-quarter, back, profile, face, hands, feet,
combat, and grip—are each 1600 × 1600 px. The final grip proof shows both
palms and curled fingers on the two hilt stations. `combat_fbx` and
`combat_png` are distinct audit keys and files.

No paid or account-gated asset was ingested. The procedural Round004 costume
was built from the verified Rain foundation and repository-authored geometry.

## Known limits

- This is a static visual proof. The FBXs intentionally contain no armature,
  animation clips, runtime controller, Unity prefab, or playable deformation
  claim.
- Costume surfaces use procedural response rather than a baked unique 4K
  costume atlas.
- LOD1 and LOD2 exceed the aspirational 48–55k and 22–28k bands because the
  Rain face, hands, hair, and eyes were protected from aggressive collapse.
- Extreme-pose collision, cloth simulation, draw/sheath gameplay, and
  production skin-weight cleanup remain outside this round.
- Blender logged only forward-looking Blender 6.0 `use_nodes` deprecations;
  vendor startup scripts were deliberately disabled and no validation error
  remains.

Round004 is a static visual proof. It does not claim a production playable
rig, animation set, Unity integration, or four-weight skinning. No benchmark
pixel, mesh, or material enters this derivative source tree.

## Independent fresh-context verdict

The fresh source-bound critic rejected this delivery at **7/13**, with only
**4/8 mandatory checks**. Unity remained locked and no GO attestation was
filed. The canonical review is
`Preflight/P10_Round004_FreshVisualPreflightReview.json`, SHA-256
`94b43c10b68b77edec16f27f01c79b04ad358fbd3364f22df9a53e100f05a9a3`.

The single biggest remaining gap is:

> The delivered costume's construction language is still a toy-like
> procedural slab-and-tube assembly rather than believable, layered, worn,
> functional AAA warrior gear.

The critic also found that the grip render does not unambiguously prove a
complete lower-hand enclosure. Two isolated factory-startup rebuilds matched
canonical geometry, topology, UVs, materials, assignments, transforms, bounds,
and near-pixel imagery, but not generated artifact bytes. Only the 22 copied
textures matched among 39 physical outputs. All five FBXs also contain one
broken absolute texture reference and serialize the source `.blend` path; the
supplied validator did not inspect FBX image resolution and therefore missed
that portability defect.
