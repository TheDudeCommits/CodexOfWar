# Codex of War — Frozen Review Protocol

## Purpose

Every visual or gameplay claim must be backed by an actual Unity run. The
benchmark is the supplied God of War Ragnarök screenshot set, not the normal
expectation for a small independent project. “Good for a web game” is a fail.

## Canonical capture presets

All captures use a fixed seed, fixed state preset, 1600×900 output, identical
URP quality settings, and a manifest containing Git commit, Unity version,
render-pipeline hash, scene, seed, preset, timestamp, and machine profile.

| Shot | Purpose | Framing contract | Primary local benchmark |
| --- | --- | --- | --- |
| S01 Explore | World composition and locomotion | Low shoulder camera; hero is 24–32% of image height; foreground, playable stage, and distant silhouette are visible. | Reference 09 |
| S02 Duel | Core combat readability | Hero, primary zombie, weapon line, and navigable floor read immediately; neither face is hidden by the HUD. | Reference 17 |
| S03 Telegraph | Enemy intent | Zombie silhouette, attack limb, approach lane, and player escape route remain legible. | Reference 17 |
| S04 Contact | Impact quality | Weapon and target meet spatially; pose, reaction, hitstop frame, camera impulse, flash, sparks/dust, and trailing debris agree. | Reference 07 |
| S05 Crowd | Encounter direction | Hero, priority threat, supporting enemies, and arena lanes remain readable without a flat lineup. | Reference 17 |
| S06 Finisher | Close authored spectacle | Faces, hands, weapon, contact point, material response, and choreography survive close framing. | Reference 21 |

## Evidence bundle

Each review round provides:

1. Color stills for the piece's required canonical presets.
2. A deterministic replay or contact sheet whenever motion/timing matters.
3. Capture manifests and relevant gameplay telemetry.
4. Optional object-ID/depth evidence when occlusion or contact is disputed.
5. A round record with builder brief, anonymous comparison result, scores,
   primary gap, and next assignment.

The copyrighted benchmark images stay outside the repository and hosted
dashboard. Only shot IDs, derived measurements, and original game captures are
published.

## Blind comparison

1. Freeze the piece acceptance criteria, rubric, scene seed, and camera presets
   before the builder starts.
2. A fresh-context critic launches the actual game and creates the evidence
   bundle. It must not rely on a builder's beauty shot alone.
3. A/B labels are randomized. The critic sees the brief, rubric, anonymous
   captures, replay, masks when needed, and telemetry, but not which candidate
   is the new result.
4. The critic locks scores and preference before learning identity.
5. It reports one primary gap. Up to two secondary observations may be logged,
   but only the primary gap becomes the next round's builder brief.
6. Every third loop uses a held-out seed or camera variation to detect
   overfitting.

## Rubric

The 100-point total deliberately makes the visual bar dominant.

| Domain | Points | What is judged |
| --- | ---: | --- |
| Composition and camera | 12 | Subject scale, sightlines, depth staging, obstruction, camera continuity |
| Character and material quality | 13 | Silhouette, anatomy, hair/cloth/skin/metal response, authored variation |
| Environment and lighting | 13 | Density, depth, atmosphere, exposure, shadows, local reactive light |
| Animation and body mechanics | 12 | Posing, weight transfer, foot contact, transitions, reaction |
| VFX and image coherence | 10 | Motion anchoring, impact hierarchy, decay, restraint, grading |
| Input and combat timing | 12 | Responsiveness, buffering, windows, cancel rules, determinism |
| Contact and impact feel | 12 | Spatial contact, hitstop, displacement, camera impulse, reaction |
| Enemy and crowd behavior | 9 | Telegraphing, spacing, pressure, navigation, fairness |
| Audio and presentation | 7 | Timing, mix, spatial response, HUD clarity, dramatic arc |

## Acceptance

A piece passes only when:

- total score is at least 80/100;
- visual subtotal is at least 48/60;
- combat subtotal is at least 30/40 where combat criteria apply;
- no applicable criterion scores below 60%;
- the new result wins the anonymous A/B preference;
- no hard failure occurs.

Hard failures include a pink/blank/debug frame, camera clipping, missing or
duplicated hit contact, target occlusion above 5% of the required interval,
unlicensed redistributed content, capture mismatch, new console errors, or p95
frame time above 22 ms in a piece with a performance contract.

P00 is the one infrastructure exception: its screenshot is still captured,
anonymized, and compared to establish an honest visual baseline, but that
expected baseline loss does not block acceptance of the evidence machinery
itself. P00 passes only on reproducibility, manifest integrity, actual-Unity
provenance, dashboard accuracy, and validation. Its critic's primary visual gap
becomes a queued visual-piece brief; it is never relabeled as a P00 win. All
subsequent pieces with canonical visual evidence must satisfy the anonymous A/B
preference rule above.

## Critic response contract

```json
{
  "piece": "P00",
  "round": 1,
  "preference": "A",
  "identity_revealed_after_lock": true,
  "score": 0,
  "hard_failures": [],
  "primary_gap": "One concrete, observable deficiency.",
  "builder_assignment": "One bounded corrective change with its proof.",
  "secondary_observations": []
}
```
