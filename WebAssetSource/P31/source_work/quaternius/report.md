# Quaternius CC0 first-playable acquisition report

## Outcome

Acquisition completed successfully on **2026-08-01** from Quaternius's official pack pages and the publisher-controlled download destinations linked by them. The curated output supplies a female universal base, long hair, fantasy ranger outfit, claymore, the requested player animation coverage, supplemental universal-rig zombie clips, and a separate animated zombie. All retained source material is CC0 1.0, all downloads worked without an account, and all seven curated GLBs passed direct glTF checks plus Blender 5.2.0 LTS re-import.

Source root (repository-relative): `WebAssetSource/P31`

- Raw publisher artifacts: `raw/quaternius/` — 17 files, **459,704,768 bytes** total (including preserved original documents).
- Curated output: `processed/quaternius/` — 17 files, **19,988,378 bytes** total (7 GLBs and 10 license/readme copies).
- Machine receipt: `source_work/quaternius/receipt.json`
- Validation detail: `source_work/quaternius/validation.json`

## Official sources and acquisition constraints

| Pack | Publisher release | Edition / publisher version | Official page | Download route | Selected content |
|---|---:|---|---|---|---|
| Universal Base Characters | August 2025 | Standard (free); no semantic version; itch upload 15861669, 2025-12-16 12:35 UTC | https://quaternius.com/packs/universalbasecharacters.html | Official page to https://quaternius.itch.io/universal-base-characters; anonymous zero-price signed mirror download | `Superhero_Female_FullBody.gltf`; head-bone-rigged `Hair_Long.gltf` |
| Modular Character Outfits - Fantasy | November 2025 | Standard (free); no semantic version; itch upload 16289385, 2026-01-29 14:52 UTC | https://quaternius.com/packs/modularcharacteroutfitsfantasy.html | Official page to https://quaternius.itch.io/modular-character-outfits-fantasy; anonymous zero-price signed mirror download | Complete `Female_Ranger.gltf` outfit |
| Universal Animation Library | March 2025 | Standard (free); no semantic version; itch upload 17958403, 2026-06-16 23:03 UTC | https://quaternius.com/packs/universalanimationlibrary.html | Official page to https://quaternius.itch.io/universal-animation-library; anonymous zero-price signed mirror download | Six clips from non-root-motion `UAL1_Standard.glb` |
| Universal Animation Library 2 | January 2026 | Standard (free); no semantic version; itch upload 17958478, 2026-06-16 23:10 UTC | https://quaternius.com/packs/universalanimationlibrary2.html | Official page to https://quaternius.itch.io/universal-animation-library-2; anonymous zero-price signed mirror download | Four clips from non-root-motion `UAL2_Standard.glb` |
| Modular Weapons Pack | September 2018 | No semantic version | https://quaternius.com/packs/medievalweapons.html | Official public Drive folder: https://drive.google.com/drive/folders/1Z6vYiQxY8W73FXuMWzaTQAg9rzbumnOr?usp=sharing | Selective `Claymore.fbx` and `License.txt` |
| Zombie Apocalypse Kit | March 2024 | No semantic version | https://quaternius.com/packs/zombieapocalypsekit.html | Official public Drive folder: https://drive.google.com/drive/folders/1mWP6sCHun7OUMHQeDNZLrXTteXlzWg_t?usp=sharing | Selective `Zombie_Basic.gltf`, `Zombie_Atlas.png`, and `License.txt` |

The four modern packs expose their free Standard editions only as coherent ZIP archives; individual assets/clips are not separate downloads. Those pack-level raw ZIPs were therefore unavoidable. No paid Source/Pro archive was downloaded. The two older public Drive packs support selective files, so only the required asset data and licenses were acquired. There was no remaining account, CAPTCHA, or manual-download barrier.

License: **CC0 1.0 Universal**, as stated by each official pack page and the retained publisher documents. Deed: https://creativecommons.org/publicdomain/zero/1.0/

## First-playable coverage

| Requirement | Curated file / clip |
|---|---|
| Female universal base | `processed/quaternius/models/universal_superhero_female.glb` |
| Long hair | `processed/quaternius/models/universal_hair_long.glb` |
| Fantasy outfit | `processed/quaternius/models/female_ranger_outfit.glb` |
| Greatsword | `processed/quaternius/models/claymore.glb` |
| Idle | `player_core.glb` → `Idle_Loop` |
| Walk | `player_core.glb` → `Walk_Loop` |
| Run | `player_core.glb` → `Sprint_Loop` |
| Dodge | `player_core.glb` → `Roll` |
| Light attack | `combat_zombie.glb` → `Sword_Regular_A` |
| Hit | `player_core.glb` → `Hit_Chest` |
| Death | `player_core.glb` → `Death01` |
| Zombie enemy | `processed/quaternius/models/zombie_basic.glb` with `Idle`, `Walk`, `Run`, `Idle_Attack`, `HitReact`, `Death` |
| Supplemental universal-rig zombie movement | `combat_zombie.glb` → `Zombie_Idle_Loop`, `Zombie_Walk_Fwd_Loop`, `Zombie_Scratch` |

## Curated GLBs

| File | Bytes | SHA-256 | Tris | Joints | Retained clips / key transform |
|---|---:|---|---:|---:|---|
| `models/universal_superhero_female.glb` | 6,446,636 | `fc150c32d9592a812ca981a5375ece8118a1af665fe583e1ed06009bdda88684` | 15,140 | 65 | 2K body/hair textures reduced to 1K; 256px eye maps retained; self-contained GLB |
| `models/universal_hair_long.glb` | 2,819,560 | `3cd401a782200a144dfb670caa8ff3c0efdd6ca03f3736888063e38ea6c06fee` | 2,986 | 65 | Head-bone-rigged variant; 2K maps reduced to 1K |
| `models/female_ranger_outfit.glb` | 8,199,776 | `600029a31ecda96d4ee19d67640cfbe3a3fd9de57e9b08cac47ea079340ee945` | 27,046 | 65 | Complete outfit; referenced 4K/2K maps reduced to 1K |
| `models/claymore.glb` | 47,272 | `ec545aa46464893348dbeec42adb87b203643f9c7d6b4c39c2074721f9a73866` | 1,032 | 0 | Longest axis normalized from 6.594609737 to 1.8 units (factor 0.272950192912); grip-adjacent origin preserved |
| `models/zombie_basic.glb` | 582,868 | `f199c9bdea193312fae5e13e045d4677e6b68bced027178252e8de61c33d5ac4` | 7,902 | 50 | `Death`, `HitReact`, `Idle`, `Idle_Attack`, `Run`, `Walk`; original 512px atlas embedded |
| `animations/player_core.glb` | 1,010,988 | `261156c05d74ea8cded6da1b6853feb7e9c89721e782536d0813a0c15f47fdc6` | 13,823 | 65 | `Death01`, `Hit_Chest`, `Idle_Loop`, `Roll`, `Sprint_Loop`, `Walk_Loop`; filtered from 43 non-root-motion clips |
| `animations/combat_zombie.glb` | 876,188 | `66bd8332a4c58d94114cf23444dfc8de3a399234e2cd62012efdb5d78f6c5f9e` | 13,823 | 65 | `Sword_Regular_A`, `Zombie_Idle_Loop`, `Zombie_Scratch`, `Zombie_Walk_Fwd_Loop`; filtered from 43 non-root-motion clips |

All paths in this table are relative to `processed/quaternius/`. The animation GLBs retain the publisher's skinned mannequin because that makes their rig and clips independently inspectable and directly reusable.

## Raw primary artifacts

| File | Bytes | SHA-256 |
|---|---:|---|
| `Universal Base Characters[Standard].zip` | 128,968,391 | `fdbf1804c90dfc1ea03e992bff7da2dfd1a79318e13270a660180f9308455f40` |
| `Modular Character Outfits - Fantasy[Standard].zip` | 294,347,394 | `c3468b18871cc8c8f05ab14df7712baf22cb9f389cbd870babf130e595187f70` |
| `Universal Animation Library[Standard].zip` | 15,904,933 | `cc73fc4e495b82958207316596317a3f40b9fa38065bde1027937452da537724` |
| `Universal Animation Library 2[Standard].zip` | 18,735,003 | `4008ea208a604773a2b2177d965f0f5d3195498b5bf838c3f5785d68e95f2a68` |
| `modular-weapons-pack/Claymore.fbx` | 34,668 | `0bc24e1f7a52d78bb3deac765c1f2bab71184a92b107f6c094998f4cf6280447` |
| `modular-weapons-pack/License.txt` | 528 | `d32abf5eb61a5d20c582525c2ee9d8d42d86401d6b3ea0a2d5283fcaecaa35b9` |
| `zombie-apocalypse-kit/Zombie_Basic.gltf` | 1,703,033 | `c6eab64ef87f89cbd6862b59964b20024ca7e329d3d44f72c76fced6c24861c8` |
| `zombie-apocalypse-kit/Zombie_Atlas.png` | 6,256 | `8803e5543d5e6b6f66aa41a5ef93e6c2ffb77b5476d0202296d2f4c8f4eb9e8d` |
| `zombie-apocalypse-kit/License.txt` | 374 | `de990ef6fc68cffd7fd1ae342c4d0c823b541b8848d8f76bca5d3339f4de6f6e` |

Paths are relative to `raw/quaternius/`. Original license/readme files extracted from the four ZIPs are preserved unmodified under `raw/quaternius/original-docs/`; byte-identical, clearly named copies are in `processed/quaternius/licenses/`. The complete document path, byte count, hash, and source mapping inventory is in `receipt.json`.

## Validation

Status: **PASS**.

- Verified the GLB magic, glTF 2.0 version, declared byte length, and JSON chunk for every curated asset.
- Verified every curated GLB is self-contained: zero external URIs.
- Re-imported all seven files with Blender 5.2.0 LTS and verified meshes, skins where expected, triangle counts, and exact animation sets.
- Base, long hair, ranger outfit, and both animation files share the exact ordered 65-joint schema: SHA-256 `32702abb0d4c46cf76d2b7d846603c56fd27bbb2c2e65aa6af1e155725615722`.
- Zombie uses its own 50-joint rig.
- No Draco or Meshopt extension was added, favoring ordinary self-contained glTF 2.0 for broad Three.js compatibility.

The detailed validator output is `source_work/quaternius/validation.json`; conversion and repeatable validation scripts are `source_work/quaternius/convert_assets.py` and `source_work/quaternius/validate_assets.py`.

## Known limitations and source defects

1. The free Universal Base Characters Standard archive contains Superhero bases only, while `Female_Ranger` is authored for Regular Female proportions. The ordered 65-joint schema is identical, but these are delivered as separate assets and direct mesh layering is not claimed.
2. The publisher's base glTF references a missing `T_Eye_Normal_png.png` although byte content is present as `T_Eye_Normal.png`. Conversion used a byte-identical temporary alias; the raw archive was not changed.
3. The Zombie Apocalypse Kit's bundled `License.txt` mistakenly names “Ultimate Platformer Pack.” It is preserved verbatim. The document and the official Zombie Apocalypse page both state CC0.
4. The temporary extracted conversion tree was removed after validation (39 scratch files); raw publisher originals remain untouched.

`receipt.json` is the authoritative machine-readable provenance record, including every URL, publisher file ID/upload ID, selection decision, original-document copy, digest, transform, validation result, and limitation.
