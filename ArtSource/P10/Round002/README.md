# P10 Round 002 Source Receipt

Round 002 attempted to replace the rejected modular mannequin with a
continuous authored hero shell. The anatomical topology and rig start from one
lawful CC0 foundation; the derived face, proportions, pose, hair, costume,
weapon, material maps, delivery meshes, and rejection evidence were generated
in this repository.

## Outcome — visual NO-GO

This round is preserved as failed-round provenance. It never reached Unity,
never produced a Unity capture manifest, and must not be treated as accepted
hero source.

- Mechanical export passed: 65 deform bones, at most four weights per vertex,
  exactly two render meshes, seven material families, and deterministic LODs at
  69,088 / 38,000 / 16,000 triangles. The static combat mesh is 62,668
  triangles.
- Independent visual preflight rejected the first revision at 2/13.
- The bounded run-3b revision self-scored 5/13, but its decisive combat frame
  exposes severed and elongated hand skin, divergent gauntlet/grip spaces, and
  no physically readable weapon enclosure.
- The reported 1.3 mm skeletal palm-to-grip proxy was a false pass: it did not
  represent the visible deformed surface.
- No `VisualPreflightReview.json` exists and no GO attestation may be inferred.
- Canonical rejected diagnostics are the nine `Preflight/run3b_*.png` files.
  The decisive frame is `Preflight/run3b_combat_full_front.png`, SHA-256
  `dbb1c89e5e78abf56514d0dae657bbe9d11bf48c028d3a6338aa3125cb7dd43e`.
- Canonical editable source SHA-256:
  `ac0851f7a01a08c8a81ffc79ed38019edafc31cf66b8055c5c0915dd1d1a97fb`.
- Generator SHA-256:
  `be622ec703de7f42840d239fb135fdcb08f2f97e95e6c18d5bda07bc86082e38`.

## Acquisition

- Source: Quaternius, *Universal Base Characters [Standard]*
- Official pages:
  - <https://quaternius.com/packs/universalbasecharacters.html>
  - <https://quaternius.itch.io/universal-base-characters>
- Standard archive filename: `Universal Base Characters[Standard].zip`
- Vendor-listed archive size: 122 MB
- Acquired: 2026-07-31
- Archive SHA-256:
  `fdbf1804c90dfc1ea03e992bff7da2dfd1a79318e13270a660180f9308455f40`
- License: CC0 1.0 Universal; the exact vendor license text is preserved at
  `ThirdParty/Quaternius/License_Standard.txt`.
- Vendor disclosure: the itch.io listing labels the pack “No generative AI was
  used.”
- Raw archive handling: the archive is quarantined outside the repository. Only
  the selected source files below enter Git LFS.

## Selected source files

| Path under `ThirdParty/Quaternius` | SHA-256 | Use |
| --- | --- | --- |
| `Superhero_Female_FullBody.fbx` | `0727e7b236eeea4115531e07aeb2bb7690c1a58155f743bbf54282944fb97ea9` | Contiguous anatomy topology, UVs, and humanoid weights |
| `Textures/T_Superhero_Female_Light_BaseColor.png` | `743f811857db0b950f3ad09a0733dfa4888801ead332313ca25becea14c54f8d` | Skin/face color foundation |
| `Textures/T_Superhero_Female_Normal.png` | `cf922460b43ccd31e983e34db05514c9d451dd2f9cdd01a843978e797719f859` | Skin/face normal foundation |
| `Textures/T_Superhero_Female_Roughness.png` | `4e00eb2d8196cebacd027e3360b9da6431d8915e27e1b5262c14f20eaaa6dced` | Skin/face roughness foundation |
| `Textures/T_Eye_Brown.png` | `d08e3356a83211bc6ca21fe3a8e39f4b5c1a3b8f85457fc2c0fb57be09935025` | Iris foundation |
| `Textures/T_Eye_Normal.png` | `9ed61f7726a54fe346a78b9e5a18905d8e2b88f86235d97f53cd207a26f3f8c7` | Eye normal foundation |
| `License_Standard.txt` | `0f4beaf0fe360a7732e58bbe3dbf60a2422367fbea60cb9ea4add968f383268e` | Exact vendor license snapshot |

## Required transformation record

The deterministic Blender source must:

1. verify a single contiguous anatomical mesh and the expected humanoid rig;
2. change the stock proportions to the locked 7.5-head Astra Vale target;
3. reshape the facial planes, eyelids, nose, mouth, jaw, ears, hands, feet,
   shoulder, hip, elbow, knee, wrist, and ankle transitions;
4. pose and bake an authored ready stance without joint gaps or collapsed
   volume;
5. build original thick hair masses, layered cloth/leather/metal costume, and
   an offset functional greatblade;
6. generate original URP-ready cloth, leather, hair, metal, eye, and emissive
   maps while retaining the selected skin source maps as attributed inputs;
7. export authored LOD0/LOD1/LOD2 meshes and deterministic delivery FBX files;
8. record all derived hashes in the P10 round-002 rejection ledger.

No benchmark pixel or mesh enters this source tree.
