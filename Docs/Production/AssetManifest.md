# Codex of War — Asset Manifest

This manifest starts at P00 and grows with every accepted art ingest. Software
dependencies remain governed by their package licenses; this file records
project media and source-art provenance.

| Repository path | Origin | Rights/provenance record | SHA-256 | Evidence use |
| --- | --- | --- | --- | --- |
| `progress/public/captures/P00/round-001/S01_Explore.png` | Rendered locally by Unity 6000.5.4f1 from the checked-in procedural P00 scene | Original project render; no external meshes, textures, or benchmark pixels | `a54a917a70b537ed34f57f9cdf13b877dc58b9d9579e2b2ec10f1e184a525aab` | Canonical P00 Unity evidence |
| `progress/public/social-card.png` | Generated for this project with the built-in OpenAI image-generation tool on 2026-07-30; no input images | Original symbolic share artwork; prompt prohibited people, logos, existing franchises, UI, and gameplay framing | `c9216e0bf62d6b05694947a318a152890af5c31b4e31ed059f5e3d0930dcf66f` | Metadata/share art only; never gameplay evidence |
| `game/Assets/TutorialInfo/Icons/URP.png` | Unity 3D URP project template | Unity template support asset; slated for removal when template tutorial content is pruned | `1d17a9ff3537859abe2c008603d29d90cf43191ae77aa386167cc65e53ba03d9` | None |

## Social-card generation prompt

```text
Use case: stylized-concept
Asset type: 16:9 social share card background for a game production evidence dashboard
Primary request: an original symbolic key-art composition for a dark action-game project: a weathered circular stone arena seen at a shallow oblique angle, split by one decisive diagonal blade-cut of warm copper-orange light, with a restrained cold teal echo in the fractured stone
Scene/backdrop: near-black void with subtle smoky mineral texture and sparse ember dust; no literal landscape
Subject: the fractured arena sigil and single luminous blade-cut only
Style/medium: premium cinematic 3D material study, editorial, severe, tactile stone and oxidized metal, high-end game key art without resembling a gameplay screenshot
Composition/framing: wide 16:9; centered symbolic form with generous safe margins; strong silhouette readable as a small thumbnail
Lighting/mood: controlled low-key lighting, warm copper against charcoal with a quiet teal undertone; dramatic but restrained
Color palette: near-black, graphite, bone-white highlights, burnt copper-orange, muted blue-green
Materials/textures: chipped basalt, fine scratches, oxidized bronze edge, subtle ash; physically plausible
Constraints: original design; no text, letters, numbers, logos, runes, people, humanoids, zombies, weapons shown literally, UI, HUD, frame border, watermark, or reference to any existing game franchise
Avoid: glossy generic esports art, neon cyberpunk, purple, excessive bloom, crowded particles, fake title typography, screenshot framing
```

## Excluded local material

The supplied `Reference.zip`, its 21 screenshots, derived contact sheets, and
temporary blind-comparison copies are local review inputs only. They must not
be committed, packaged, embedded in a player build, or deployed to the progress
site.
