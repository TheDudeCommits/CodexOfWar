# P30 Round012 asset scout — production bridge for Three.js

Audited 2026-08-03 from the primary asset pages and their publishers' licensing documents. The result is deliberately conservative: **no single free hero download I found proves anime styling, a production humanoid rig, an included sword, strong textures, clean commercial rights, and AAA finish at once.** The safest quality jump is the ranked, composable stack below. It is a production bridge, not a claim that stock assets alone meet the God of War bar.

## Ranked acquisition plan

| Rank | Role | Recommended asset | Proven delivery/specification | License and obligations | Biggest integration risk |
|---:|---|---|---|---|---|
| 1 | Anime sword hero | [AvatarSample_B](https://hub.vroid.com/en/characters/7939147878897061040/models/2292219474373673889) + [Antique Katana 01](https://polyhaven.com/a/antique_katana_01) | Hero: VRM 0.0 humanoid avatar; page permits violence, alterations, corporate and individual commercial use. Sword: glTF/FBX/Blend/USD, 7K tris, 1 m, 1K–8K maps, AO/ARM/diffuse/metal/normal/roughness. | Hero is not CC0, but attribution is not required; use and alteration are allowed. Follow the [sample-model terms](https://vroid.pixiv.help/hc/en-us/articles/4402394424089-VRoidPreset-A-Z), especially the redistribution and no-implied-endorsement restrictions. Katana is [Poly Haven CC0](https://polyhaven.com/license), with no attribution required. | This is a two-asset assembly, not final authored character art, and VRoid Hub requires a pixiv sign-in to acquire it. Hero polycount and texture sizes are not published. A stock sample will read as a generic VRoid avatar until its outfit, hair, palette, face, and silhouette are substantially customized. |
| 2 | Combat motion | [Rokoko: 13 free fight animations](https://www.rokoko.com/resources/rokoko-mocap-13-free-fight-animations) plus [10 free fight and weapon animations](https://www.rokoko.com/resources/motion-library-10-free-fight-and-weapon-animations) | Core pack proves 13 full-body clips, FBX, Mixamo skeleton, 30 FPS, retarget-ready. Weapon add-on proves 10 fight/weapon-handling motions and explicitly describes sword use; its page does not publish skeleton or frame-rate details. | Rokoko says the 13-pack may be used in commercial game/VFX/3D projects. Its [free-resources page](https://www.rokoko.com/free-resources) also describes the free asset collection as commercially usable. Treat the displayed creator credit, Marco Mori and Jon Noorlander, as required unless the downloaded archive says otherwise; preserve that archive's license text. | Mocap is motion, not combat design. Expect hand-to-hilt correction, foot-lock cleanup, anticipation/recovery retiming, root-motion extraction, and authored contact poses. The weapon add-on's exact clip list and skeleton must be inspected after the email-gated download. |
| 3 | Zombie | **No approved candidate yet.** [Zombie 3D by @chuvit](https://sketchfab.com/3d-models/zombie-3d-31ca8d86b4074312a51170d8e7dbe07c) was rejected by the measured intake. | The first-party record proves 22.1K tris / 11.6K vertices, but the uploaded source is an unrigged OBJ/MTL with one 2K RGB texture, zero animations, no morphs, and no published PBR type. GLB is a generated conversion rather than the original upload. | The page is CC BY 4.0, but official acquisition still requires an authenticated Sketchfab download; license permission does not authorize bypassing access controls. No bytes entered the repository. | Find a source-verifiable rigged PBR zombie whose exact licensed bytes can be acquired and bound to the intake receipt. A paid Fab candidate also remains blocked until its publisher/Fab confirms that an extractable browser-served GLB is permitted. |
| 4 | Dark forest/ruin library | Poly Haven stack: [Modular Fort 01](https://polyhaven.com/a/modular_fort_01), [Pine Roots](https://polyhaven.com/a/pine_roots), [Mossy Sandstone](https://polyhaven.com/a/mossy_sandstone), and [Niederwihl Forest HDRI](https://polyhaven.com/a/niederwihl_forest) | Fort: modular glTF/FBX, 28K tris, 71.4 m, 1K–8K AO/ARM/diffuse/displacement/normal/roughness sets. Roots: glTF/FBX, 163K tris, 1.9 m, 1K–8K PBR sets. Sandstone: glTF/MaterialX source, 1K–8K AO/ARM/diffuse/displacement/normal/roughness. HDRI: unclipped EXR/HDR through 18K. | Every listed asset is covered by [Poly Haven's CC0 license](https://polyhaven.com/license): commercial use, modification, redistribution, and no attribution requirement. | This is a material/kit library, not a composed mythic level. The raw 8K fort download is 646.68 MB and roots are 163K tris; naïve import would wreck web load time and overdraw. Ruin damage, collision, LODs, occlusion, foliage wind, fog, and authored landmark composition remain game work. |

## Why these are the winners

### Hero kit

AvatarSample_B is the least ambiguous free anime base. Its live VRoid Hub record explicitly says `VRM 0.0`, violent acts allowed, corporate use allowed, individual commercial use allowed, alteration allowed, and attribution not required. The official [VRM documentation](https://vrm.dev/en/vrm/vrm_features/) states that VRM defines a humanoid and standardizes a T-pose so it can play motion-capture data. The official [`@pixiv/three-vrm`](https://github.com/pixiv/three-vrm) loader supports VRM directly in Three.js, including MToon and spring-bone behavior.

The katana is a separate, high-detail CC0 prop so weapon quality does not inherit the avatar's unknown texture budget. Parent it to the normalized right-hand weapon socket; keep a second world-space guard/tip pair for evaluator-owned contact. Ship a customized hero, not the recognizable stock sample.

Fallback only if VRM retargeting blocks the checkpoint: [3D Anime Character girl for Blender](https://sketchfab.com/3d-models/3d-anime-character-girl-for-blender-7f5659043b074c139b91cf0ece1b8069), 37.6K tris / 19.6K vertices, rigged, UV-unwrapped and textured, under CC Attribution. Its bone convention, texture resolution, facial rig, and included source format are not published, so it ranks below the VRM route. Its description says credit is optional, but the displayed CC Attribution license is controlling; credit is therefore required.

### Zombie

There is currently **no approved zombie replacement**. The first-party
Sketchfab detail record for `Zombie 3D` contradicts the creator-written listing:
it reports an OBJ source, `isRigged=false`, one texture, `pbrType=null`, and zero
animation/morph content. The deterministic receipt and reusable license-to-bytes
gate are filed under `AssetIntake/`; they reject the candidate before technical
admission and add no model bytes.

The strongest paid lead found so far is [Davlet's Zombie Pack 02](https://www.fab.com/listings/45fe68de-518b-434d-a7c4-de2f0129df20), whose listing claims two 49K/78K-triangle zombies, FBX/Blender delivery, skinning, UE5/basic rigs, face rig/morphs, and 2K/4K PBR maps. It is **not approved for this browser project**: Fab's Standard License permits incorporated project distribution and forbids standalone redistribution, but does not unambiguously classify a normally retrievable web GLB. Require written confirmation from the publisher, ideally supported by Fab/Epic, before purchase or browser delivery.

A visually denser historical lead is [Zombie “Egor” by David Glynch](https://sketchfab.com/3d-models/zombie-6ff73b06cf63405d9557720c78cf5e0c): 109.4K tris / 54.7K vertices, PBR, and listed as rigged. It still requires exact artifact, license, download, skeleton, texture, and web-distribution verification; it is not an approved fallback.

### Animation

The Rokoko core pack has the cleanest proven retargeting contract in the free shortlist: Mixamo skeleton, FBX, 30 FPS. Pair it with the weapon set, then retarget once in Blender to the chosen VRM humanoid and bake all accepted clips onto one canonical game skeleton before GLB export. Preserve original source clips separately from edited gameplay clips.

[MoCap Online's free T.C. Sword pack](https://mocaponline.com/products/tc-sword) is a quality fallback with FBX/Blender/Unity/Unreal formats and sword slashes, blocks, combos, idles, and heavy motions described on its [official pack article](https://mocaponline.com/blogs/mocap-news/tc-sword-animations). It is **not the first choice** because its product page says the Standard License covers commercial use up to 1M end users / $1M revenue while the [full license](https://mocaponline.com/pages/standard-license) contains different thresholds and works-for-hire restrictions. Obtain written clarification before production use.

### Environment

The Poly Haven stack wins on provenance and surface quality. Build the arena from selected fort modules, break silhouettes with roots and custom rubble, blend Mossy Sandstone into the walls, and use the forest HDRI only for PMREM lighting/background reference. “Dark mythic” must come from composition, selective moon/key lighting, local volumetrics, decals, wetness, and a controlled color script; lowering exposure on a stock fort is not enough.

## Concrete Three.js intake gate

Acquire nothing directly into runtime folders. For each chosen asset:

1. Save the untouched download, source URL, author, acquisition date, and a PDF/text snapshot of the applicable license in a private source archive.
2. Inspect the source in Blender: units, forward axis, bind pose, bone names, skin weights, morphs, material count, texture dimensions, alpha surfaces, and animation list. Reject on missing advertised contents.
3. Retarget one idle and one maximum-extension strike before batch processing. Require planted feet, stable pelvis, unbroken shoulders/wrists, and correct right-hand weapon alignment.
4. Export one canonical GLB per character. Use stable node names and explicit `weapon_socket_r`, `blade_guard`, `blade_tip`, and collision-proxy nodes.
5. Optimize with glTF Transform: prune, deduplicate, Meshopt-compress geometry, and convert textures to KTX2. Start at 2K for hero/zombie primary surfaces, 1K for secondary surfaces, 2K for arena materials, and a 2K PMREM environment; raise only from measured close-up failure.
6. Author LODs and cheap collision separately. In particular, do not ship the 163K-triangle roots asset as repeated raw geometry or the fort's 8K source maps as runtime textures.
7. Run an in-game capture at the locked combat camera before accepting the asset. Judge silhouette, deformation, contact readability, memory, network payload, shader compilation, and frame time—not the marketplace turntable.

## Attribution ledger entries to prepare

- `Zombie 3D` by `@chuvit`, via Sketchfab, CC BY 4.0, only if exact authorized bytes are ever admitted; the current intake rejected it and ships no attribution-triggering asset bytes.
- `3D Anime Character girl for Blender` by `CGBlender` only if the fallback is used; same CC BY treatment.
- Rokoko motion credits: preserve and reproduce the exact credit/license text included in the downloaded archives; until inspected, carry `Marco Mori, Jon Noorlander` from the source pages.
- AvatarSample_B and all Poly Haven assets require no attribution, but retain provenance internally.

The hero, motion, and Poly Haven environment leads clear only their stated published gates. The zombie slot remains unfilled. Nothing clears final art direction, deformation, animation quality, performance, web-distribution, or blind-reference acceptance until exact acquired bytes pass the provenance-bound intake gate above.
