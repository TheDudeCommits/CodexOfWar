# P31 third-party asset ledger

This directory is the acquisition and preparation workspace for the browser-game playable through P30 Round005. The original CC0 stack was accessed on **2026-08-01**; Blender Studio Rain was accessed on **2026-08-02** under CC BY 4.0. Raw downloads are retained for reproducibility but are not the preferred runtime payload; use `processed/` plus the preserved license/provenance files for integration.

No file was obtained from an unofficial mirror, account-gated page, or paid tier. The modern Quaternius ZIPs were delivered anonymously by the publisher's official Itch distribution through Itch's signed CDN. The Round003 Poly Haven models and dependencies came directly from the public official files API/CDN. Acquisition and processing did not touch the Git index, branch, Unity project, or progress records.

## Runtime payload at a glance

- Integration-ready payload now includes the three Round005 shipping GLBs. The
  complete `processed/` tree is **71 files, 45,496,621 bytes (43.389 MiB)**;
  earlier round packages remain as reproducible inputs and rollback evidence.
- Raw provenance: **49 files, 490,031,235 bytes (467.330 MiB)** under ignored `raw/`; these archives/direct sources and API snapshots are not runtime payloads.
- Active Round005 actors: `processed/round005/characters/nyra.glb`,
  `processed/round005/characters/hollow.glb`, and project-original
  `processed/round005/weapons/stormcage.glb`.
- Earlier hero/reference models remain at `processed/quaternius/models/universal_superhero_female.glb`, `universal_hair_long.glb`, `female_ranger_outfit.glb`, and `claymore.glb`.
- Animation libraries: `processed/quaternius/animations/player_core.glb` and `combat_zombie.glb`; exact gameplay mapping is below.
- Enemy: `processed/quaternius/models/zombie_basic.glb`, self-contained with six first-playable actions.
- Environment: the active Round003 set is `processed/polyhaven/round003/` plus `processed/polyhaven/hdri/`; the earlier Kenney ruins and original Poly Haven JPG material copies remain as provenance-backed legacy candidates.
- Effects/audio: `processed/kenney/vfx/`, `processed/opengameart/vfx/`, and `processed/opengameart/audio/`.
- Machine receipt: `ASSET_RECEIPT.json`; reproducible generator and QA details are under `source_work/`.

## Source registry

| ID | Publisher / author | Asset and publisher version | Official landing / download | License proof |
| --- | --- | --- | --- | --- |
| BS-RAIN | Blender Studio / Blender Foundation | Rain Rig v3.3; archive contains `rain_v3.2.blend` | [official character page](https://studio.blender.org/characters/rain/v3/), [stable source ZIP](https://studio.blender.org/download-source/files/ee/a7/eea73e55dba1cea31c09848df6a794b2-4.zip) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); required credit: “Rain Rig (CC) Blender Foundation \| studio.blender.org” |
| PH-SNOW | Poly Haven / Adrian Kubasa | Snowy Forest; publisher API state accessed 2026-08-01; 1K HDR variant | [asset](https://polyhaven.com/a/snowy_forest), [files API](https://api.polyhaven.com/files/snowy_forest) | [Poly Haven asset license](https://polyhaven.com/license), [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| PH-BRICK | Poly Haven / Rob Tuytel | Castle Brick 01; publisher API state accessed 2026-08-01; 1K JPG variants | [asset](https://polyhaven.com/a/castle_brick_01), [files API](https://api.polyhaven.com/files/castle_brick_01) | [Poly Haven asset license](https://polyhaven.com/license), [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| PH-COBBLE | Poly Haven / Sơn Nguyễn | Mossy Cobblestone; publisher API state accessed 2026-08-01; 1K JPG variants | [asset](https://polyhaven.com/a/mossy_cobblestone), [files API](https://api.polyhaven.com/files/mossy_cobblestone) | [Poly Haven asset license](https://polyhaven.com/license), [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| PH-FORT | Poly Haven / Rico Cilliers | Modular Fort 01; files hash `5ccbf62aeee96ea99cf0c2e29e4c8ed843ee7c44`; 1K glTF | [asset](https://polyhaven.com/a/modular_fort_01), [files API](https://api.polyhaven.com/files/modular_fort_01) | [Poly Haven asset license](https://polyhaven.com/license), [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| PH-STATUE | Poly Haven / Benny Weimer | Gothic Statue; files hash `180fe034aec7158f2550b133e0ba2be9e9c1c241`; 1K glTF | [asset](https://polyhaven.com/a/gothic_statue), [files API](https://api.polyhaven.com/files/gothic_statue) | [Poly Haven asset license](https://polyhaven.com/license), [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| KEN-CASTLE | Kenney | Castle Kit 2.0, complete remake, 2024-03-27 | [asset](https://kenney.nl/assets/castle-kit), [publisher ZIP](https://kenney.nl/media/pages/assets/castle-kit/a395102d20-1711543616/kenney_castle-kit.zip) | [asset page](https://kenney.nl/assets/castle-kit), bundled `License.txt`, [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| KEN-SMOKE | Kenney Vleugels | Smoke Particles 1.0 | [asset](https://kenney.nl/assets/smoke-particles), [publisher ZIP](https://kenney.nl/media/pages/assets/smoke-particles/23249a0d35-1677695171/kenney_smoke-particles.zip) | [asset page](https://kenney.nl/assets/smoke-particles), bundled `license.txt`, [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| OGA-SLASH | Cethiel, published through OpenGameArt | Weapon Slash - Effect, Classic subset, submission 2019-04-08 | [submission](https://opengameart.org/content/weapon-slash-effect), [publisher-hosted Classic.zip](https://opengameart.org/sites/default/files/Classic.zip) | [submission license field](https://opengameart.org/content/weapon-slash-effect), [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| OGA-SWORD | StarNinjas, published through OpenGameArt | 20 Sword Sound Effects (Attacks and Clashes), updated 2021-03-06 | [submission](https://opengameart.org/content/20-sword-sound-effects-attacks-and-clashes) | [submission license field](https://opengameart.org/content/20-sword-sound-effects-attacks-and-clashes), [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| Q-BASE | Quaternius | Universal Base Characters, August 2025, free Standard tier | [publisher page](https://quaternius.com/packs/universalbasecharacters.html), [publisher Itch distribution](https://quaternius.itch.io/universal-base-characters) | [publisher page](https://quaternius.com/packs/universalbasecharacters.html), bundled `License_Standard.txt`, [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| Q-OUTFIT | Quaternius | Modular Character Outfits - Fantasy, November 2025, free Standard tier | [publisher page](https://quaternius.com/packs/modularcharacteroutfitsfantasy.html), [publisher Itch distribution](https://quaternius.itch.io/modular-character-outfits-fantasy) | [publisher page](https://quaternius.com/packs/modularcharacteroutfitsfantasy.html), bundled `License_Standard.txt`, [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| Q-UAL1 | Quaternius | Universal Animation Library, March 2025, free Standard tier | [publisher page](https://quaternius.com/packs/universalanimationlibrary.html), [publisher Itch distribution](https://quaternius.itch.io/universal-animation-library) | [publisher page](https://quaternius.com/packs/universalanimationlibrary.html), bundled `License.txt`, [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| Q-UAL2 | Quaternius | Universal Animation Library 2, January 2026, free Standard tier | [publisher page](https://quaternius.com/packs/universalanimationlibrary2.html), [publisher Itch distribution](https://quaternius.itch.io/universal-animation-library-2) | [publisher page](https://quaternius.com/packs/universalanimationlibrary2.html), bundled `License.txt`, [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| Q-WEAPON | Quaternius | Modular Weapons Pack, September 2018 | [publisher page](https://quaternius.com/packs/medievalweapons.html), [publisher Drive folder](https://drive.google.com/drive/folders/1Z6vYiQxY8W73FXuMWzaTQAg9rzbumnOr?usp=sharing) | [publisher page](https://quaternius.com/packs/medievalweapons.html), publisher `License.txt`, [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| Q-ZOMBIE | Quaternius | Zombie Apocalypse Kit, March 2024 | [publisher page](https://quaternius.com/packs/zombieapocalypsekit.html), [publisher Drive folder](https://drive.google.com/drive/folders/1mWP6sCHun7OUMHQeDNZLrXTteXlzWg_t?usp=sharing) | [publisher page](https://quaternius.com/packs/zombieapocalypsekit.html), publisher `License.txt`, [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |

## Round004 character and weapon supplement

- **Nyra** derives from BS-RAIN (CC BY 4.0) plus the existing Q-UAL1/Q-UAL2 CC0 animation libraries. Modification notice: Rain geometry was altered and buried surfaces pruned; the canonical 65-bone gameplay rig was substituted; weights were transferred; textures were atlased/resized; armor and mantle were added; five gameplay actions were embedded. Preserve the credit **“Rain Rig (CC) Blender Foundation | studio.blender.org”** with distributed credits.
- **Hollow** derives from the existing Q-ZOMBIE CC0 payload. The source sneaker region was removed before a wrapped boot/greave replacement; the original 50-bone rig and exact `Idle`, `HitReact`, and `Death` clips remain.
- **Stormcage** is a project-original procedural mesh authored from deterministic Blender primitives and profiles. The former Quaternius claymore was inspected only as an orientation reference; no third-party geometry or texture was copied into Stormcage.
- The three source/runtime GLB pairs are byte-identical and total **7,588,976 bytes**: Nyra `f3e93e…d7101`, Hollow `626a71…8881`, Stormcage `a25554…a11`.
- Rain acquisition proof, official-page snapshot, CC BY legalcode, extracted blend and selected exact texture inputs are under `source_work/round004/originals/blender-studio-rain/`. Build and clean-reimport receipts are under `source_work/round004/`; exact texture recipes are in `texture_build_receipt.json`.

## Round005 combat-contact supplement

- **Vespera/Nyra** retains the BS-RAIN CC BY 4.0 lineage and credit while adding
  project-original nightsteel armor, aether inlay, crimson mantle elements, and
  camera-authored two-hand heavy-strike choreography on the existing 65-bone
  gameplay rig.
- **Ossuary Hollow** derives from Q-ZOMBIE (CC0) and the Blender Human Base
  Meshes bundle's `Skull - Realistic` by Paul Kotelevets and Tonatiuh de San
  Julián (CC0). The selected derivative adds project-original corpse, bone,
  black-iron, rot, crown, talon, and shroud treatments plus synchronized
  `HitReact`.
- **Dawnbreak/Stormcage** is project-original geometry with explicit primary
  grip, secondary grip, contact, and blade-tip nodes.
- The selected GLBs total **5,936,396 bytes** and **50,150 visible triangles**:
  hero `6f67a3…a30d`, Hollow `f53a48…e689d`, and weapon `098c83…4206`.
  Source, processed, and runtime validation records are under
  `source_work/round005_alt/`; the three processed/runtime pairs are
  byte-identical.

## Raw acquisition ledger

`Bytes` and `SHA-256` describe the exact retained file. Poly Haven's publisher MD5 is included as an additional transport check. “Selected” describes why this byte set was acquired and what is used from it.

| Source | Retained path / original filename | Bytes | SHA-256 | Publisher MD5 | Selected contents / acquisition transform |
| --- | --- | ---: | --- | --- | --- |
| PH-SNOW | `raw/polyhaven/hdri/snowy_forest_1k/snowy_forest_1k.hdr` | 1,894,914 | `0c3bd168c04dacc5c15002cabf0fb3c682500eb49befa53627c0f8eb52aa4baf` | `7a8909355fa53a99a5a67df22176a64c` | Direct 1K Radiance HDR from the publisher CDN; complete file selected for environment lighting. |
| PH-BRICK | `raw/polyhaven/textures/castle_brick_01_1k/castle_brick_01_diff_1k.jpg` | 693,571 | `3823fdc4bcb37cc7b26fd7e3b2a80e82f5a23354d22d84eb0ca277909f923b2c` | `d3d6194b814cbda8a17dc5ebe407a41e` | Direct 1K sRGB diffuse JPG. |
| PH-BRICK | `raw/polyhaven/textures/castle_brick_01_1k/castle_brick_01_nor_gl_1k.jpg` | 1,069,379 | `f3c4c0538fd5c3f9e1aabcb0169fbbc3ac2883ed5544f05d9008d2736a2899de` | `6e187b440caae18cd2edf5925edf6b7b` | Direct 1K OpenGL normal JPG; use as linear data. |
| PH-BRICK | `raw/polyhaven/textures/castle_brick_01_1k/castle_brick_01_arm_1k.jpg` | 209,005 | `61039af9cead766f482877f6a7d605a1935c6a2d2923d789d71c418a4b447b6e` | `bdba186503e5a9314f2fb60edc59e513` | Direct 1K packed AO/roughness/metalness JPG; channels R/G/B, linear data. |
| PH-COBBLE | `raw/polyhaven/textures/mossy_cobblestone_1k/mossy_cobblestone_diff_1k.jpg` | 1,089,617 | `105d6209ff99952ca316e814eebf06c1c3cb244da62184137a97e29aee74b7d7` | `e400e051cac040e67d759dbd9a51ca3d` | Direct 1K sRGB diffuse JPG. |
| PH-COBBLE | `raw/polyhaven/textures/mossy_cobblestone_1k/mossy_cobblestone_nor_gl_1k.jpg` | 980,112 | `32a128c921cf0311798ebb6c6a766db900a10419233c87cc52f8d226b2aa4cc0` | `3bcd336a29c8eb273b8d54e8953eb5f3` | Direct 1K OpenGL normal JPG; use as linear data. |
| PH-COBBLE | `raw/polyhaven/textures/mossy_cobblestone_1k/mossy_cobblestone_arm_1k.jpg` | 715,595 | `8d737b10700257d179dc0413f278477c1bdc79d346f2bf6e8b504e850bde7c82` | `8db2351fa887ec044b696c98436ab9a1` | Direct 1K packed AO/roughness/metalness JPG; channels R/G/B, linear data. |
| KEN-CASTLE | `raw/kenney/castle-kit-2.0/kenney_castle-kit.zip` | 2,232,589 | `921f3f73927bb23106cae34bc21d5ab4b033a9fc120475e96f714a406e3169df` | — | Publisher exposes one pack ZIP, not individual model downloads. Selected nine GLBs, their shared `Textures/colormap.png`, and the bundled license; all other formats/models remain raw-only. |
| KEN-SMOKE | `raw/kenney/smoke-particles-1.0/kenney_smoke-particles.zip` | 6,019,666 | `97a1d09c66e4fd6c247c8ea87f84c0cc59caaeceae19414c995afb1616a1e1c9` | — | Publisher exposes one pack ZIP. Selected four PNG puffs and the bundled license; the remaining particles remain raw-only. |
| OGA-SLASH | `raw/opengameart/weapon-slash-effect/Classic.zip` | 397,872 | `605dff92b8a405a4810aa88b7f8544c6eb7b08b0668816f958abb44cc70cb620` | — | Smallest official color subset. Selected the six frames in `Classic/1/`; no re-encoding. |
| OGA-SWORD | `raw/opengameart/sword-sounds-starninjas/sword_-_starninjas_1.zip` | 149,512 | `87a1fe1cfeee5f282fe06a7a9c25ab9ebf24b7674fe19171b7f2762dffb628c1` | — | Official attack archive. Selected `sword.1.ogg` through `sword.3.ogg`; no audio transform. |
| OGA-SWORD | `raw/opengameart/sword-sounds-starninjas/sword_clash_-_starninjas_0.zip` | 144,575 | `f363c80ea1627548d336370750651b0d2d092978148ecfb3642717c2efb54b6b` | — | Official clash archive. Selected `sword_clash.1.ogg` and `.2.ogg`; no audio transform. |
| Q-BASE | `raw/quaternius/Universal Base Characters[Standard].zip` | 128,968,391 | `fdbf1804c90dfc1ea03e992bff7da2dfd1a79318e13270a660180f9308455f40` | — | Exact free Standard archive from the publisher's Itch download. The publisher offers the Standard selection only as a pack archive. Selected `Superhero_Female_FullBody`, rigged `Hair_Long`, their required 1K/256px textures, and license. |
| Q-OUTFIT | `raw/quaternius/Modular Character Outfits - Fantasy[Standard].zip` | 294,347,394 | `c3468b18871cc8c8f05ab14df7712baf22cb9f389cbd870babf130e595187f70` | — | Exact free Standard archive from the publisher's Itch download. Archive-only distribution; selected the complete `Female_Ranger` outfit and its required 1K textures plus license/readme. |
| Q-UAL1 | `raw/quaternius/Universal Animation Library[Standard].zip` | 15,904,933 | `cc73fc4e495b82958207316596317a3f40b9fa38065bde1027937452da537724` | — | Exact free Standard archive from the publisher's Itch download. Selected six actions from its GLB: `Idle_Loop`, `Walk_Loop`, `Sprint_Loop`, `Roll`, `Hit_Chest`, `Death01`. |
| Q-UAL2 | `raw/quaternius/Universal Animation Library 2[Standard].zip` | 18,735,003 | `4008ea208a604773a2b2177d965f0f5d3195498b5bf838c3f5785d68e95f2a68` | — | Exact free Standard archive from the publisher's Itch download. Selected `Sword_Regular_A`, `Zombie_Idle_Loop`, `Zombie_Walk_Fwd_Loop`, and `Zombie_Scratch`. |
| Q-WEAPON | `raw/quaternius/modular-weapons-pack/Claymore.fbx` | 34,668 | `0bc24e1f7a52d78bb3deac765c1f2bab71184a92b107f6c094998f4cf6280447` | — | Selective publisher-Drive file; the only weapon geometry acquired. |
| Q-WEAPON | `raw/quaternius/modular-weapons-pack/License.txt` | 528 | `d32abf5eb61a5d20c582525c2ee9d8d42d86401d6b3ea0a2d5283fcaecaa35b9` | — | Selective publisher-Drive license file, retained verbatim. |
| Q-ZOMBIE | `raw/quaternius/zombie-apocalypse-kit/Zombie_Basic.gltf` | 1,703,033 | `c6eab64ef87f89cbd6862b59964b20024ca7e329d3d44f72c76fced6c24861c8` | — | Selective publisher-Drive glTF; geometry and its source image are embedded. Selected one zombie and six of its sixteen actions. |
| Q-ZOMBIE | `raw/quaternius/zombie-apocalypse-kit/Zombie_Atlas.png` | 6,256 | `8803e5543d5e6b6f66aa41a5ef93e6c2ffb77b5476d0202296d2f4c8f4eb9e8d` | — | Selective publisher-Drive atlas retained as supplied; the glTF also embeds the image bytes. |
| Q-ZOMBIE | `raw/quaternius/zombie-apocalypse-kit/License.txt` | 374 | `de990ef6fc68cffd7fd1ae342c4d0c823b541b8848d8f76bca5d3339f4de6f6e` | — | Selective publisher-Drive license retained verbatim; its incorrect pack-title line is flagged below. |
| Q-BASE | `raw/quaternius/original-docs/universal-base-characters/License_Standard.txt` | 806 | `0f4beaf0fe360a7732e58bbe3dbf60a2422367fbea60cb9ea4add968f383268e` | — | Bundled archive license extracted verbatim for preservation. |
| Q-OUTFIT | `raw/quaternius/original-docs/modular-character-outfits-fantasy/License_Standard.txt` | 728 | `2202cc2f608c4210790b112e5f121bc2e7f8dced7b5b1c7f4be6203461bdebbb` | — | Bundled archive license extracted verbatim for preservation. |
| Q-OUTFIT | `raw/quaternius/original-docs/modular-character-outfits-fantasy/Readme.txt` | 311 | `2f87579c277cde1e1ddbd4b8d823bed618728781cb6597b4dee3978c589ff5c4` | — | Bundled archive readme extracted verbatim for preservation. |
| Q-UAL1 | `raw/quaternius/original-docs/universal-animation-library/License.txt` | 332 | `6d01f55c6e4c49a2c9963e147e561945ae2c83958c8ca667d90a6bffdbfac061` | — | Bundled archive license extracted verbatim for preservation. |
| Q-UAL1 | `raw/quaternius/original-docs/universal-animation-library/README.txt` | 702 | `ccd02718886b5a57f10f0a8911a38cfe10c36880e1d6dfa3445923fba32d2a72` | — | Bundled archive readme extracted verbatim for preservation. |
| Q-UAL2 | `raw/quaternius/original-docs/universal-animation-library-2/License.txt` | 332 | `6d01f55c6e4c49a2c9963e147e561945ae2c83958c8ca667d90a6bffdbfac061` | — | Bundled archive license extracted verbatim for preservation. |
| Q-UAL2 | `raw/quaternius/original-docs/universal-animation-library-2/README.txt` | 702 | `ccd02718886b5a57f10f0a8911a38cfe10c36880e1d6dfa3445923fba32d2a72` | — | Bundled archive readme extracted verbatim for preservation. |
| Q-UAL2 | `raw/quaternius/original-docs/universal-animation-library-2/female-mannequin/README.txt` | 275 | `3447416d55d5cf3a82311c4941578068d544cc4cfa1d49a6a26a28c98b96c393` | — | Bundled mannequin readme extracted verbatim for preservation. |

## Curated runtime and preserved-license ledger

All paths are relative to this P31 directory. “Verbatim” means the payload bytes were extracted or copied without transcoding; hashes therefore match the corresponding bytes inside the source archive/direct download. Files under `processed/` are the integration candidates.

| Source | Path | Bytes | SHA-256 | Selection / transform |
| --- | --- | ---: | --- | --- |
| PH-SNOW | `processed/polyhaven/hdri/snowy_forest_1k.hdr` | 1,894,914 | `0c3bd168c04dacc5c15002cabf0fb3c682500eb49befa53627c0f8eb52aa4baf` | Verbatim runtime copy; load with `RGBELoader`, then PMREM. |
| PH-BRICK | `processed/polyhaven/materials/castle_brick_01/castle_brick_01_diff_1k.jpg` | 693,571 | `3823fdc4bcb37cc7b26fd7e3b2a80e82f5a23354d22d84eb0ca277909f923b2c` | Verbatim runtime copy; sRGB. |
| PH-BRICK | `processed/polyhaven/materials/castle_brick_01/castle_brick_01_nor_gl_1k.jpg` | 1,069,379 | `f3c4c0538fd5c3f9e1aabcb0169fbbc3ac2883ed5544f05d9008d2736a2899de` | Verbatim runtime copy; linear/OpenGL normal. |
| PH-BRICK | `processed/polyhaven/materials/castle_brick_01/castle_brick_01_arm_1k.jpg` | 209,005 | `61039af9cead766f482877f6a7d605a1935c6a2d2923d789d71c418a4b447b6e` | Verbatim runtime copy; R=AO, G=roughness, B=metalness. |
| PH-COBBLE | `processed/polyhaven/materials/mossy_cobblestone/mossy_cobblestone_diff_1k.jpg` | 1,089,617 | `105d6209ff99952ca316e814eebf06c1c3cb244da62184137a97e29aee74b7d7` | Verbatim runtime copy; sRGB. |
| PH-COBBLE | `processed/polyhaven/materials/mossy_cobblestone/mossy_cobblestone_nor_gl_1k.jpg` | 980,112 | `32a128c921cf0311798ebb6c6a766db900a10419233c87cc52f8d226b2aa4cc0` | Verbatim runtime copy; linear/OpenGL normal. |
| PH-COBBLE | `processed/polyhaven/materials/mossy_cobblestone/mossy_cobblestone_arm_1k.jpg` | 715,595 | `8d737b10700257d179dc0413f278477c1bdc79d346f2bf6e8b504e850bde7c82` | Verbatim runtime copy; R=AO, G=roughness, B=metalness. |
| KEN-CASTLE | `processed/kenney/ruins/Textures/colormap.png` | 7,529 | `66fd49be148f32e88f6c8cace67120250d1943a7856601158ad0ff24651db0b0` | Verbatim shared 512×512 palette; directory case/path must stay unchanged. |
| KEN-CASTLE | `processed/kenney/ruins/rocks-large.glb` | 16,204 | `7ea1ee769eb063b192c3c3744cd32a11616320f7ca491fbe23289552f6655595` | Verbatim publisher GLB; ruin scatter. |
| KEN-CASTLE | `processed/kenney/ruins/siege-catapult-demolished.glb` | 71,252 | `e0663eb42a97c5d992b1864ba3459e8246de11cf29fd72f10ef5ffd271f3029a` | Verbatim publisher GLB; hero rubble/set dressing. |
| KEN-CASTLE | `processed/kenney/ruins/stairs-stone.glb` | 9,836 | `ec21b1d65c04ba6384734c31ac542bb4015541e652c411796fd7bcf292e6413c` | Verbatim publisher GLB. |
| KEN-CASTLE | `processed/kenney/ruins/tower-base.glb` | 41,724 | `575e6463b9bc58b8294690b2c1a15409b0624e0253af1a215bf67ea5e9cbaaba` | Verbatim publisher GLB. |
| KEN-CASTLE | `processed/kenney/ruins/wall-corner.glb` | 15,264 | `82d27b869162b6a9ee19b0d7480913f56928b6620708f3b3899131495803cc9a` | Verbatim publisher GLB. |
| KEN-CASTLE | `processed/kenney/ruins/wall-doorway.glb` | 37,560 | `8daf5cccceace888d51d74b0e0254e192004faf926e07f1b28e94191879af3a6` | Verbatim publisher GLB. |
| KEN-CASTLE | `processed/kenney/ruins/wall-half.glb` | 12,132 | `4f0baca90eb52d96717aaabf36db98f1f2b554876f44da533b57dd92b6f67965` | Verbatim publisher GLB. |
| KEN-CASTLE | `processed/kenney/ruins/wall-pillar.glb` | 18,156 | `22d359abfaa3cf3dc5a2fece09a108024a07a4e263b21a4a0689da0e630699ed` | Verbatim publisher GLB. |
| KEN-CASTLE | `processed/kenney/ruins/wall.glb` | 16,552 | `b2ea00acbf4ba91ff0d4b8b942edf9fa12d821abd0b2c945c57a2b9b3153cfe3` | Verbatim publisher GLB. |
| KEN-SMOKE | `processed/kenney/vfx/smoke/blackSmoke00.png` | 52,454 | `5d9f2b522beaa41511ef0ad1ccf2457d90b9aba8f5cac7154e3a86f8be7cc05b` | Verbatim 362×336 transparent smoke sprite. |
| KEN-SMOKE | `processed/kenney/vfx/smoke/blackSmoke08.png` | 60,263 | `1ed936faff42d2801240b83bc500f11bdf2a1b49a5f3915796ef2e7cc86af2d7` | Verbatim 378×415 transparent smoke sprite. |
| KEN-SMOKE | `processed/kenney/vfx/smoke/blackSmoke16.png` | 61,123 | `52c12880719018e571ea80abe6d338c8ba3ffaae1189032851d081a6cb48c723` | Verbatim 360×371 transparent smoke sprite. |
| KEN-SMOKE | `processed/kenney/vfx/smoke/whitePuff00.png` | 57,599 | `33f894c2279bee9f77874dbfa3c0e9f071a0ee5e1a7065dcc40196029d699f58` | Verbatim 381×346 transparent light puff sprite. |
| OGA-SLASH | `processed/opengameart/vfx/slash_classic/Classic_01.png` | 8,759 | `16189b2070151b9cdcbd07e15989a9fb0dce89e894134f67692ec9f4eefe631d` | Verbatim animation frame 1/6. |
| OGA-SLASH | `processed/opengameart/vfx/slash_classic/Classic_02.png` | 10,839 | `a3d2c6cd354cfab75d1ab964d2b580c1f3144061d3c2361a2c46a504df6b7db9` | Verbatim animation frame 2/6. |
| OGA-SLASH | `processed/opengameart/vfx/slash_classic/Classic_03.png` | 9,958 | `2ce1c82da724c9ddb679d12e115315efb20439d86b64bb71d458b2b1d0e29c83` | Verbatim animation frame 3/6. |
| OGA-SLASH | `processed/opengameart/vfx/slash_classic/Classic_04.png` | 12,598 | `5152df40de39bc8747655e4b2c5fbd8fde73d238e206dc3724ab01ffeb1c9dc6` | Verbatim animation frame 4/6. |
| OGA-SLASH | `processed/opengameart/vfx/slash_classic/Classic_05.png` | 12,521 | `8cefc4715621b0428e5a02797007b783aad793bb7c0892f3f785ae369cefcec8` | Verbatim animation frame 5/6. |
| OGA-SLASH | `processed/opengameart/vfx/slash_classic/Classic_06.png` | 8,469 | `4778452da88178c77984ed07b6fbe3bf7df7036c5ffd8c9effafc6b9da05ae74` | Verbatim animation frame 6/6. |
| OGA-SWORD | `processed/opengameart/audio/sword/sword.1.ogg` | 17,794 | `4a3e80705619cbd7500682ab51004011ddf67e14ccf1818ceb9e5b539fe42b75` | Verbatim attack; 0.966916 s, stereo Vorbis 44.1 kHz. |
| OGA-SWORD | `processed/opengameart/audio/sword/sword.2.ogg` | 19,102 | `e74221f6cec0acaa7c19095618c683c3cdc1741f02193b61cb28a2ec56cbfce2` | Verbatim attack; 1.078481 s, stereo Vorbis 44.1 kHz. |
| OGA-SWORD | `processed/opengameart/audio/sword/sword.3.ogg` | 13,071 | `ce09eb2987531d1323415065d7811a9cf0ea8639766d9fa77655d602e7e14989` | Verbatim attack; 0.622902 s, stereo Vorbis 44.1 kHz. |
| OGA-SWORD | `processed/opengameart/audio/sword/sword_clash.1.ogg` | 16,491 | `5c5e78e466ba78fe2414f2b7a2a6eb674822ccfc8a8bc9fda32be22f5dde5e69` | Verbatim clash; 1.033288 s, stereo Vorbis 44.1 kHz. |
| OGA-SWORD | `processed/opengameart/audio/sword/sword_clash.2.ogg` | 13,951 | `e09f222b70d53f2967514d076e2ae50c21526ac640fe4919965f964af043da1a` | Verbatim clash; 0.801088 s, stereo Vorbis 44.1 kHz. |
| KEN-CASTLE | `licenses/Kenney_Castle_Kit_License.txt` | 713 | `aac944f18106b3a3e29c6fdeec02523d4cab4c735abc01f5a8fa88a79ae173ef` | Bundled `License.txt`, extracted verbatim and renamed for collision-free preservation. |
| KEN-SMOKE | `licenses/Kenney_Smoke_Particles_license.txt` | 486 | `16dffa20429eccd9a6ddbffffe7870191974975d192d3934e53da5d486ed2e4f` | Bundled `license.txt`, extracted verbatim and renamed for collision-free preservation. |
| Q-BASE | `processed/quaternius/models/universal_superhero_female.glb` | 6,446,636 | `fc150c32d9592a812ca981a5375ece8118a1af665fe583e1ed06009bdda88684` | Blender 5.2.0 import/export to self-contained Y-up GLB. Selected the Standard tier's only female full body; downscaled referenced 2K body/hair maps to 1K, retained 256px eye maps, and repaired the publisher glTF's missing `T_Eye_Normal_png.png` reference by aliasing the supplied `T_Eye_Normal.png`. |
| Q-BASE | `processed/quaternius/models/universal_hair_long.glb` | 2,819,560 | `3cd401a782200a144dfb670caa8ff3c0efdd6ca03f3736888063e38ea6c06fee` | Blender 5.2.0 self-contained Y-up GLB from `Hair_Long.gltf`; long-hair mesh and Universal rig retained; referenced 2K maps downscaled to 1K. |
| Q-OUTFIT | `processed/quaternius/models/female_ranger_outfit.glb` | 8,199,776 | `600029a31ecda96d4ee19d67640cfbe3a3fd9de57e9b08cac47ea079340ee945` | Blender 5.2.0 self-contained Y-up GLB from `Female_Ranger.gltf`; one complete ranger outfit, nine selected meshes, and two materials; referenced Ranger 4K and Regular Female 2K maps downscaled to 1K. |
| Q-WEAPON | `processed/quaternius/models/claymore.glb` | 47,272 | `ec545aa46464893348dbeec42adb87b203643f9c7d6b4c39c2074721f9a73866` | Blender 5.2.0 FBX→GLB. Original 6.5946-unit weapon was uniformly normalized to 1.8 units; scale applied, Y-up exported, and grip-adjacent origin retained. |
| Q-ZOMBIE | `processed/quaternius/models/zombie_basic.glb` | 582,868 | `f199c9bdea193312fae5e13e045d4677e6b68bced027178252e8de61c33d5ac4` | Blender 5.2.0 self-contained Y-up GLB. Embedded 512px atlas retained; actions filtered to `Idle`, `Walk`, `Run`, `Idle_Attack`, `HitReact`, `Death`. |
| Q-UAL1 | `processed/quaternius/animations/player_core.glb` | 1,010,988 | `261156c05d74ea8cded6da1b6853feb7e9c89721e782536d0813a0c15f47fdc6` | Blender 5.2.0 selection/export from the Standard GLB; non-skinned preview objects and all unselected actions removed. Exact actions: `Idle_Loop`, `Walk_Loop`, `Sprint_Loop`, `Roll`, `Hit_Chest`, `Death01`. |
| Q-UAL2 | `processed/quaternius/animations/combat_zombie.glb` | 876,188 | `66bd8332a4c58d94114cf23444dfc8de3a399234e2cd62012efdb5d78f6c5f9e` | Blender 5.2.0 selection/export from the Standard GLB; non-skinned preview objects and all unselected actions removed. Exact actions: `Sword_Regular_A`, `Zombie_Idle_Loop`, `Zombie_Walk_Fwd_Loop`, `Zombie_Scratch`. |
| Q-OUTFIT | `processed/quaternius/licenses/modular-character-outfits-fantasy-License_Standard.txt` | 728 | `2202cc2f608c4210790b112e5f121bc2e7f8dced7b5b1c7f4be6203461bdebbb` | Bundled license extracted verbatim and collision-safely renamed. |
| Q-OUTFIT | `processed/quaternius/licenses/modular-character-outfits-fantasy-Readme.txt` | 311 | `2f87579c277cde1e1ddbd4b8d823bed618728781cb6597b4dee3978c589ff5c4` | Bundled readme extracted verbatim and collision-safely renamed. |
| Q-WEAPON | `processed/quaternius/licenses/modular-weapons-pack-License.txt` | 528 | `d32abf5eb61a5d20c582525c2ee9d8d42d86401d6b3ea0a2d5283fcaecaa35b9` | Publisher license copied verbatim and collision-safely renamed. |
| Q-UAL1 | `processed/quaternius/licenses/universal-animation-library-License.txt` | 332 | `6d01f55c6e4c49a2c9963e147e561945ae2c83958c8ca667d90a6bffdbfac061` | Bundled license extracted verbatim and collision-safely renamed. |
| Q-UAL1 | `processed/quaternius/licenses/universal-animation-library-README.txt` | 702 | `ccd02718886b5a57f10f0a8911a38cfe10c36880e1d6dfa3445923fba32d2a72` | Bundled readme extracted verbatim and collision-safely renamed. |
| Q-UAL2 | `processed/quaternius/licenses/universal-animation-library-2-License.txt` | 332 | `6d01f55c6e4c49a2c9963e147e561945ae2c83958c8ca667d90a6bffdbfac061` | Bundled license extracted verbatim and collision-safely renamed. |
| Q-UAL2 | `processed/quaternius/licenses/universal-animation-library-2-README.txt` | 702 | `ccd02718886b5a57f10f0a8911a38cfe10c36880e1d6dfa3445923fba32d2a72` | Bundled readme extracted verbatim and collision-safely renamed. |
| Q-UAL2 | `processed/quaternius/licenses/universal-animation-library-2-female-mannequin-README.txt` | 275 | `3447416d55d5cf3a82311c4941578068d544cc4cfa1d49a6a26a28c98b96c393` | Bundled mannequin readme extracted verbatim and collision-safely renamed. |
| Q-BASE | `processed/quaternius/licenses/universal-base-characters-License_Standard.txt` | 806 | `0f4beaf0fe360a7732e58bbe3dbf60a2422367fbea60cb9ea4add968f383268e` | Bundled license extracted verbatim and collision-safely renamed. |
| Q-ZOMBIE | `processed/quaternius/licenses/zombie-apocalypse-kit-License.txt` | 374 | `de990ef6fc68cffd7fd1ae342c4d0c823b541b8848d8f76bca5d3339f4de6f6e` | Publisher license copied verbatim and collision-safely renamed; source-title defect retained. |

## Round003 Ashwake environment lineage

The active environment slice uses only official Poly Haven CC0 sources: Modular Fort 01 supplies five modular fort pieces and the shared sector maps, Gothic Statue supplies exactly one statue mesh, and the already-receipted Mossy Cobblestone maps supply the ground. `source_work/round003/acquire_polyhaven.py` resolves the official public API/CDN URLs and validates publisher byte counts and MD5 values before retaining SHA-256 hashes. The ignored raw root is `raw/polyhaven/round003/`; it contains 16 publisher glTF/dependency files plus four exact API snapshots (20 files, 14,730,060 bytes). The authoritative per-file acquisition ledger is `source_work/round003/acquisition_receipt.json`.

Blender 5.2.0 LTS selected individual source nodes, removed publisher contact-sheet placement, centered each mesh on runtime X/Z, grounded it at Y=0, applied transforms, collapsed it to one texture-free `AshwakeSectorShared` placeholder material, exported ordinary GLB, and re-imported every output for validation. No Draco, Meshopt, KTX2, animation, embedded image, or external URI is present. The six meshes total 36,297 triangles and 1,323,612 bytes.

| Source | Processed geometry | Original node | Triangles | Bytes | SHA-256 |
| --- | --- | --- | ---: | ---: | --- |
| PH-FORT | `processed/polyhaven/round003/geometry/fort_buttress.glb` | `modular_fort_01_wall_thick_corner_01` | 816 | 41,956 | `a029b852e57bb2ba954ec69a729c738cf8a8bbc7a507605d49e6f4415b598a97` |
| PH-FORT | `processed/polyhaven/round003/geometry/fort_gate.glb` | `modular_fort_01_wall_thin_gate_01` | 1,368 | 64,624 | `205bddd127ec4c8e87e13108003c4c1343092a213c77473d3056e7b105ad111f` |
| PH-FORT | `processed/polyhaven/round003/geometry/fort_wall.glb` | `modular_fort_01_wall_thin_straight_03` | 406 | 19,244 | `e60605cf7f632c9e193cab5e91415a0b0a62556d2121ea569750eaa7f3e3caaf` |
| PH-FORT | `processed/polyhaven/round003/geometry/fort_tower.glb` | `modular_fort_01_tower_round` | 4,772 | 219,772 | `f3c9d8a491d02e62424bc104eb5fd50fa7e2516c9860e8e8f0cb7ef842725c44` |
| PH-FORT | `processed/polyhaven/round003/geometry/fort_stairs.glb` | `modular_fort_01_wall_stairs_straight_01` | 1,196 | 55,192 | `48a9af555add02a70362df01323abf050c3e36492c8ee860bd0b5799ca13d98a` |
| PH-STATUE | `processed/polyhaven/round003/geometry/gothic_statue.glb` | `gothic_statue` | 27,739 | 922,824 | `e0327cf7fda9d308d5f96ca28f86b5851d5501b511f5356db43fca9a90ab380f` |

The two shared PBR triplets are ordinary 1024×1024 WebP files produced with `cwebp 1.6.0`, metadata stripped. Diffuse maps use quality 84, OpenGL normal maps quality 92, and packed AO/roughness/metalness maps quality 90; every invocation uses `-sharp_yuv -m 6 -mt -metadata none`. Exact source/output hashes and full commands are in `source_work/round003/texture_build_receipt.json`.

| Source | Processed texture | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| PH-COBBLE | `processed/polyhaven/round003/materials/ground/ashwake_ground_basecolor.webp` | 349,700 | `6f603e8df23bd5032024c1c38f12bdf69ce5ce151405a3056a6c0ad92ba71371` |
| PH-COBBLE | `processed/polyhaven/round003/materials/ground/ashwake_ground_normal.webp` | 394,730 | `3903a0a795c1584283b5983f1fdbd32435f13b9a7656bf940023054da2769c67` |
| PH-COBBLE | `processed/polyhaven/round003/materials/ground/ashwake_ground_orm.webp` | 161,986 | `98558a0b83e34439512b0c6315d687990457a3f3d20234c8564080365fdb3842` |
| PH-FORT | `processed/polyhaven/round003/materials/sector/ashwake_sector_basecolor.webp` | 295,418 | `98ffd6f778300a99c4a5c7ae43fa6726c1881621599b99c4143d6f4a6f31a064` |
| PH-FORT | `processed/polyhaven/round003/materials/sector/ashwake_sector_normal.webp` | 517,172 | `b8fa399819f39545500fa1d818fe3cd10d70808ed344542bacca11ccbfcbc97a` |
| PH-FORT | `processed/polyhaven/round003/materials/sector/ashwake_sector_orm.webp` | 306,880 | `511ee8f569e261b2217ec7362f4194f9edabfb5b43ac6ccc708528010a2da9f5` |

`source_work/round003/runtime_publish_receipt.json` proves all twelve files were copied byte-identically into `web-game/public/assets/environment/ashwake/`; that bounded environment payload is 3,349,498 bytes. `source_work/round003/geometry_build_receipt.json` and `validation.json` retain dimensions, UV bounds, mesh/material counts, and Blender re-import results. The Gothic Statue source textures are retained for provenance but not shipped in this bounded slice; the statue intentionally receives the shared fort-sector material at runtime.

## Validation completed

- Poly Haven: all seven earlier direct downloads plus all 16 Round003 publisher glTF/dependency files match the exact MD5 values returned by the publisher API. Exact `info` and `files` API snapshots are retained with SHA-256 hashes.
- Round003 environment: all six GLBs pass Blender 5.2.0 LTS re-import and structural validation as ordinary, grounded, identity-root, one-mesh/one-material GLBs with UV0 and no images, external URIs, animation, required extensions, Draco, or Meshopt. All six WebP maps decode at 1024×1024 and their `cwebp 1.6.0` source/output hashes match the texture receipt.
- Kenney raw ZIPs: `unzip -t` passes for every member. All nine selected GLBs have glTF 2.0 headers, one scene, one mesh, identity root transforms, ground-aligned pivots, stable node names, and a relative `Textures/colormap.png` reference. They use `KHR_texture_transform`, supported by Three.js `GLTFLoader`. Blender 5.2.0 LTS imported every GLB successfully.
- OpenGameArt raw ZIPs: `unzip -t` passes. Selected slash PNGs decode as RGBA; selected OGGs decode with `ffprobe` as stereo Vorbis at 44.1 kHz.
- Quaternius: all four Standard ZIPs pass `unzip -t`. Direct GLB 2.0 structural inspection and Blender 5.2.0 LTS re-import pass for all seven converted outputs. `player_core.glb`, `combat_zombie.glb`, `universal_superhero_female.glb`, `universal_hair_long.glb`, and `female_ranger_outfit.glb` have the same ordered 65-joint schema (`SHA-256 32702abb0d4c46cf76d2b7d846603c56fd27bbb2c2e65aa6af1e155725615722`). The zombie uses its own validated 50-joint rig. Every converted GLB is self-contained with no external URI.
- No standalone `gltf-transform` executable was locally installed, so no Draco, Meshopt, KTX2, pruning, or re-encoding was applied. The selected publisher GLBs are already small (the nine-model ruin payload plus palette is 246,209 bytes).

## Integration notes

- The Round003 manifest remaps the six stable environment keys to the six Ashwake GLBs and its six stable material keys to the two shared WebP triplets. It retains exactly 18 enabled keys; the earlier Kenney/JPG payload remains available as provenance-backed legacy data but is not selected by the active manifest.
- Keep `processed/kenney/ruins/Textures/colormap.png` beside the legacy ruin GLBs at that exact relative path and casing.
- Treat Poly Haven diffuse maps as sRGB and normal/ARM maps as linear. The packed ARM texture is suitable for AO/roughness/metalness channel use; meshes need a second UV set for Three.js `aoMap` behavior.
- Use the 1K HDR through `RGBELoader` and PMREM, not as an ordinary sRGB texture.
- Slash frames are six separate, variably sized transparent PNGs; preserve aspect ratio on billboards rather than assuming a fixed atlas cell.
- The five OGG files are an intentionally small CC0 combat subset. No OpenGameArt audio with a non-CC0 license entered the runtime set.
- Map gameplay names to exact Universal actions: idle=`Idle_Loop`, walk=`Walk_Loop`, run=`Sprint_Loop`, dodge=`Roll`, light attack=`Sword_Regular_A`, hit=`Hit_Chest`, death=`Death01`.
- For the actual `zombie_basic.glb`, use its embedded `Idle`, `Walk`, `Run`, `Idle_Attack`, `HitReact`, and `Death` actions. The three `Zombie_*` actions in `combat_zombie.glb` use the 65-joint Universal rig and are optional future clips; they are not directly compatible with the zombie model's 50-joint rig without retargeting.
- The five Universal-rig GLBs have identical ordered joints, so name-based clip transfer is viable. They remain separate skinned assets; sharing one live skeleton instance or combining modular meshes still requires normal Three.js `SkeletonUtils`/rebinding work.

## Publisher barriers and known issues

- Kenney's donation prompt was not a download barrier: the official page's “Continue without donating” route exposed the same publisher CDN ZIP. No donation or account flow was bypassed.
- OpenGameArt downloads were direct and account-free. The two selected submissions explicitly mark the attached archives CC0.
- Poly Haven files were selected individually through its public API/CDN, so no texture/HDRI bundle or library was downloaded.
- The four modern Quaternius Standard products are distributed as whole free ZIPs; selective model/clip HTTP files were not exposed. Their large raw archives were therefore unavoidable, are provenance-only, and are excluded by this directory's `.gitignore`. The older Drive packs did expose individual files, so only the Claymore, Zombie Basic, atlas, and their licenses were acquired.
- The free Universal Base Standard archive exposes only Superhero Female/Male full bodies. The selected `Female_Ranger` outfit uses Regular Female proportions; both have the same 65-joint schema but are shipped as separate playable alternatives, not claimed as a seamless mesh assembly. The paid Source tier was not accessed.
- `Superhero_Female_FullBody.gltf` references missing `T_Eye_Normal_png.png` even though `T_Eye_Normal.png` is supplied. A byte-identical alias was used only in conversion scratch space; raw archive bytes were not changed.
- The publisher-supplied Zombie Apocalypse `License.txt` incorrectly names “Ultimate Platformer Pack.” Its CC0 declaration and URL are intact, and the correct Zombie Apocalypse publisher page independently marks the kit CC0. The original license byte sequence is preserved and the mismatch is not silently corrected.
- Itch's account-free Standard downloads and the public Google Drive folders were sufficient. No manual, login, quota, or confirmation barrier was bypassed; no blocked required item remains.
