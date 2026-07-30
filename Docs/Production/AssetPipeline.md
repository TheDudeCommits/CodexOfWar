# Codex of War — Asset Pipeline

Last reviewed: 2026-07-30

## Decision

The public repository must remain legally buildable. P10–P12 therefore use
authored or explicitly redistributable source assets:

- P10 hero: an original VRoid/Blender foundation or a commissioned source-rights
  character, substantially authored into the final silhouette and materials.
- P11 zombie: a Quaternius CC0 rig/animation foundation, substantially
  resculpted and retextured in Blender.
- P12 arena: hand-authored composition using selected Quaternius/Kenney geometry
  and Poly Haven/ambientCG CC0 materials and models.
- Meshy may provide a small number of base meshes or landmark props only after
  an original/CC0 input and license review. No Meshy credential is configured
  today.
- TRELLIS is excluded from the local pipeline. The official TRELLIS.2
  requirements—Linux, NVIDIA, at least 24 GB VRAM, and roughly 16.2 GB of
  weights—do not fit the 8 GB M2 development machine.

Unity Asset Store and Mixamo source files must never be committed to this
public repository. If either is used later, it must live in an ignored local
import location, appear in the license manifest, and be distributed only in an
allowed compiled end product.

## Preferred sources

| Source | License posture | Intended use | Quality caveat |
| --- | --- | --- | --- |
| Original/commissioned work | Contract must grant editable source redistribution | Final hero, bespoke weapons, hero props | Commission contract must disclose and license every dependency |
| [VRoid Studio](https://vroid.com/en/studio/guidelines) | Creator-made exports using defaults without special clauses may be edited and sold; audit every preset | Anime hero foundation | Not CC0; third-party VRoid Hub/BOOTH items require separate rights |
| [Quaternius Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html) | CC0 | Rig/retopo foundation | Insufficient final detail without major authorship |
| [Quaternius Zombie Apocalypse Kit](https://quaternius.com/packs/zombieapocalypsekit.html) | CC0 | Zombie foundation and supporting props | Must be rebuilt beyond recognizable pack quality |
| [Quaternius Universal Animation Library 2](https://quaternius.com/packs/universalanimationlibrary2.html) | CC0 | Zombie locomotion and melee motion base | Contacts, roots, anticipation, weapon arcs, and transitions require hand polish |
| [MakeHuman](https://static.makehumancommunity.org/makehuman/faq/can_i_sell_models_created_with_makehuman.html) | Core exported mesh is CC0; add-ons vary | Anatomical foundation | Generic realism needs extensive anime or undead stylization |
| [Poly Haven](https://polyhaven.com/license) | CC0 | PBR materials, HDRIs, scans, selected models | Use 1K/2K sources and restyle rather than importing 8K/16K |
| [ambientCG](https://ambientcg.com/) | CC0 | PBR surfaces, HDRIs, selected models | Normalize texel density and art direction |
| [Kenney](https://kenney.nl/support) | CC0 | Blockout and distant supporting props | Usually below foreground hero-asset quality |
| [Blender Studio characters](https://studio.blender.org/characters/jay/v1/) | Per-asset CC BY | Rigging and source-quality reference | Attribution, compatibility, and style mismatch must be handled |

## Generated-asset rules

Meshy exports Unity-friendly FBX/GLB, but it is a base-mesh tool rather than a
final-quality shortcut:

- Paid API/output rights depend on clean input rights.
- Free-plan output is CC BY 4.0 and needs attribution, license linkage, and a
  modification record.
- Community-released output is CC0.
- Non-Enterprise output may be used for service training and carries no
  non-infringement or uniqueness warranty.
- Generated work still requires similarity review, retopology, UV/material
  cleanup, authored LODs, and Unity validation.

Sources: [Meshy export formats](https://docs.meshy.ai/en/webapp/guides/platform/export-formats),
[rigging API](https://docs.meshy.ai/en/api/rigging),
[remeshing](https://docs.meshy.ai/en/webapp/guides/3d-model/remesh),
[pricing](https://docs.meshy.ai/en/api/pricing), and
[terms](https://www.meshy.ai/terms-of-use).

TRELLIS code/model availability does not establish clean provenance for every
generated output. Do not install its weights locally. Any later hosted trial
must use only original/CC0 inputs and retain the input, seed, service/model
version, output hash, and human modifications.

Sources: [TRELLIS.2 repository](https://github.com/microsoft/TRELLIS.2) and
[model card](https://huggingface.co/microsoft/TRELLIS.2-4B).

## License manifest requirements

Every non-original source asset records:

1. Source URL, author, asset/version name, and acquisition date.
2. Exact license and redistribution status.
3. Original file hash and imported/output hashes.
4. Required attribution.
5. All material modifications.
6. Whether raw source may enter the public repository.
7. Any third-party presets, textures, animations, fonts, or marks.

Reject NC, ND, unknown-license, franchise-derived, logo-bearing, or unclear
third-party source. A repository-wide software license must explicitly exclude
third-party assets governed by their own terms.

## Blender-to-Unity contract

1. Work on one major asset at a time with Unity closed. Keep high-poly active
   scenes below roughly 2–3 million vertices and bake at 2K.
2. Normalize to meters, apply transforms, remove helpers, fix non-manifold
   geometry, retopologize, UV, bake, and author explicit LODs.
3. Export deterministic FBX instead of importing `.blend` directly. Keep mesh
   and animation FBXs separate; use one universal humanoid skeleton; export
   deform bones only; disable leaf bones; bake clips at 30 fps.
4. Pack URP maps explicitly: base color in sRGB; normals and masks linear;
   metallic in R; smoothness (`1 - roughness`) in A; occlusion in G or a
   separate map. Create external Unity materials.
5. Unity import defaults: one meter equals one unit, Bake Axis Conversion,
   Read/Write off, Optimize Mesh Everything, authored normals, automatic index
   format, and only visually validated mesh compression.
6. Use mipmaps for 3D art and environment texture streaming. Budget the roughly
   33% mip overhead.

References: [Blender FBX manual](https://docs.blender.org/manual/en/latest/addons/import_export/scene_fbx.html),
[Unity model importer](https://docs.unity3d.com/6000.0/Documentation/Manual/FBXImporter-Model.html),
[Unity LODGroup](https://docs.unity3d.com/6000.0/Documentation/Manual/class-LODGroup.html),
and [Unity mipmaps](https://docs.unity3d.com/6000.0/Documentation/Manual/texture-mipmaps-introduction.html).

## Target budgets

| Area | Authored target | Source/import footprint | Approximate resident art memory |
| --- | --- | ---: | ---: |
| Hero | LOD0 60–90k triangles; LOD1 30–45k; LOD2 12–20k; 3–5 materials; at most two 2K atlases | 400 MB–1.0 GB including source/import/LFS duplication | 60–110 MiB |
| Zombies | Shared rig; LOD0 25–40k, LOD1 10–18k, LOD2 4–8k; shared 1K PBR plus masks | 450 MB–1.2 GB | 50–100 MiB for six shared instances |
| Arena | 0.5–1.0M visible triangles; 100–250 visible renderers/draws after instancing/batching | 1.8–5.0 GB | 180–350 MiB |

The full recommended low/mid pipeline adds roughly 4–8 GiB locally after Unity
imports and Git LFS duplication. Disk space must be checked before every large
source ingest.
