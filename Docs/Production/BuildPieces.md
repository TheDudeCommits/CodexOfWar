# Codex of War — Judgeable Build Pieces

This backlog deliberately decomposes the game into units that can be built,
captured, criticized, and accepted independently. A piece is not `done` because
its code exists. It is `accepted` only after its builder/critic loop passes the
frozen evidence contract in `ReviewProtocol.md`.

## State model

`queued → building → review-ready → criticized → revising → accepted`

A failed blind comparison always returns the piece to `revising` with exactly
one primary gap. Secondary observations stay in the review record but do not
expand that round's assignment.

## Current round

P10 round 001 passed its mechanical gates but failed its visual gate on
2026-07-31. Two fresh critic captures reproduced all six PNG hashes; standalone
validation passed, focused EditMode passed 8/8, the full suite passed 14/14,
and P00 stayed byte-identical. The randomized blind judge scored ours `9/60`
and Reference 09 `49/60`; the critic scored ours `10/60` and the reference
`51/60`. Both preferred the reference.

P10 is therefore `revising` in round 002 with one assignment only: replace the
disconnected plastic-mannequin hero with one continuous, anatomically credible
authored shell whose face, hands, feet, joints, layered costume, weapon, and
distinct skin, hair, cloth, and metal responses survive the frozen S01 and
four-view cameras without clipped highlights. Round 002 must also file S02 and
S06, and the next fresh blind review must score character/material quality at
least `8/13`. No `/100` score or visual win is claimed from round 001.

## Vertical-slice pieces

| ID | Piece | Independently judgeable outcome | Required evidence |
| --- | --- | --- | --- |
| P00 | Evidence spine | A deterministic review scene, fixed-seed capture command, manifest, round ledger, and live progress surface work end to end. | One reproducible 1600×900 capture, manifest, hash, dashboard entry, clean import |
| P01 | Shoulder camera | Exploration and combat framings preserve subject scale, sightline, collision, target legibility, and authored camera presets. | S01, S02, camera telemetry, obstruction replay |
| P02 | Ground locomotion | Walk, run, pivot, stop, strafe, slope handling, and camera-relative control have grounded acceleration and readable weight. | S01 plus 12-second orbit/movement clip |
| P03 | Hero animation foundation | Idle, locomotion, pivots, combat stance, weapon handling, additive aim, and transitions share coherent body mechanics. | S01, S02, transition contact sheet |
| P04 | Light combo | Buffered three-hit chain has authored startup/active/recovery/cancel windows and one-hit-per-target resolution. | S04 for each strike, telemetry, slow-motion replay |
| P05 | Heavy attack | Heavy strike communicates commitment, displacement, contact, hitstop, camera impulse, and enemy reaction. | S04, 240 fps equivalent stepped replay |
| P06 | Dodge and evasion | Directional dodge, invulnerability window, recovery, and camera continuity are predictable and readable. | Telegraph-to-dodge replay and frame ledger |
| P07 | Hit reaction and death | Zombies react by hit direction/severity, preserve contact, stagger, collapse, and settle without foot sliding or explosive ragdolls. | S04, S06, reaction matrix |
| P08 | Zombie navigation | One zombie can acquire, approach, flank, telegraph, attack, recover, lose/reacquire, and die without navigation jitter. | S03 plus 20-second deterministic replay |
| P09 | Crowd combat director | Four-to-six zombies surround without dog-piling; attack tokens, spacing, off-screen pressure, and threat cues create readable crowd combat. | S05, occupancy plot, attack-token log |
| P10 | Hero look development | The first anime-style fighter reads as a premium authored character at gameplay and finisher distance, with coherent skin, hair, cloth, metal, and weapon materials. | S01, S02, S06, neutral turntable |
| P11 | Zombie look development | The zombie archetype and variants have layered anatomy, clothing history, damage language, silhouette variation, and material response. | S02, S03, S06, neutral turntable |
| P12 | Arena composition | A compact arena has foreground framing, combat stage, silhouette depth, traversal logic, landmarks, and no empty “test level” reads. | S01, S05, overhead plan |
| P13 | Lighting and atmosphere | Key/fill/rim, exposure, fog, shadows, grading, and local reactive light keep faces and contact readable while creating depth. | All canonical stills, luminance scopes |
| P14 | Combat VFX | Weapon trails, contact flash, sparks, debris, blood/dust, and lingering particles form a restrained macro/impact/decay stack anchored to motion. | S04, S06, frame-stepped replay, overdraw check |
| P15 | Combat audio | Foley, effort, weapon movement, contact, zombie vocals, ambience, music, ducking, and spatial mix support timing and impact. | Capture with stems and loudness report |
| P16 | HUD and threat language | Minimal health/ability/lock-on/threat information remains legible without weakening the cinematic frame. | S02, S05, accessibility contrast checks |
| P17 | Finisher vignette | A contextual finisher has reliable setup, three-character blocking when relevant, facial/contact framing, camera choreography, and clean return to play. | S06 plus full finisher replay |
| P18 | Integrated encounter | A polished 45–90 second encounter combines the accepted systems into one authored dramatic arc. | All canonical stills, full replay, telemetry |
| P19 | Performance and delivery | The native macOS target runs reliably, captures deterministically, meets frame budgets, and ships with reproducible build instructions. | Player build, profiler summary, license manifest, release checklist |

## Roster expansion pieces

The first fighter proves the shared combat contract. Roster work begins only
after P18 prevents multiplying weak foundations.

| ID | Piece | Independently judgeable outcome |
| --- | --- | --- |
| P20 | Fighter contract | Data-driven fighter/weapon/ability definitions support selection without branching the shared combat core. |
| P21 | Fighter two | A distinct weapon silhouette, rhythm, traversal/combat ability, animation set, VFX identity, and finisher. |
| P22 | Fighter three | A distinct weapon silhouette, rhythm, traversal/combat ability, animation set, VFX identity, and finisher. |
| P23 | Fighter four | A distinct weapon silhouette, rhythm, traversal/combat ability, animation set, VFX identity, and finisher. |
| P24 | Roster select and persistence | Selection, preview, input, save/load, and per-fighter progression work coherently. |
| P25 | Roster encounter balance | All fighters can complete the benchmark encounter while remaining mechanically and audiovisually distinct. |

## Machine-aware production constraints

- Authoring and the primary quality target are native Apple Silicon/macOS.
- Unity 6 URP is the renderer. HDRP is not used on the current 8 GB machine.
- Fixed gameplay simulation is 60 Hz; visual capture is 1600×900 unless a
  piece explicitly requires another resolution.
- The performance target is median frame time at or below 16.7 ms and p95 at
  or below 22 ms in the integrated encounter on the benchmark machine.
- Original or redistributable assets may enter the public repository. Paid or
  restricted source assets require a documented local import step and license
  manifest; they are never silently republished.
- The supplied benchmark screenshots remain local and are identified in review
  records by shot number only.
