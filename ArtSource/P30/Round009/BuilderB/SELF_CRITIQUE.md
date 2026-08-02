# Round009 Builder B — Candidate Self-Critique

This is candidate-only evidence. It does not claim acceptance.

## What the pass improves

- Tick 29 now reads as anticipation: Nyra lowers into a compact coil while the pelvis-to-neck chain creates a broad, legible pre-strike silhouette.
- Tick 34 preserves the authored hero contact pose and weapon socket exactly, while the Hollow gains a small HitReact lead and a compressed torso chain so the strike reads as force transfer rather than overlap.
- Tick 41 adds opposing recoil: the Hollow carries weight back through hips, abdomen, torso, and neck, while Nyra receives a conservative lateral settle without disturbing the authored two-hand grip.
- The additive layer restores the authored bone state before every render, so reviewing the same frozen tick repeatedly cannot accumulate pose deltas.

## Evidence-backed strengths

- The focused images are deterministic duplicates of standard S03/S04/S05 at ticks 29/34/41.
- Both hero rig and target rig bindings are present at all focused ticks; the claymore remains parented to `weapon_socket`.
- Support-hand-to-secondary-grip error is at most 0.000001 m across the focused beat.
- At tick 34, authored blade contact is 0.252146 m from the target impact anchor and the contact FX projection error is 9.648 px against a 24 px limit.
- Three replay runs are byte-identical, repeated same-tick renders are byte-identical, all 18 authored assets load, and no procedural fallback is active.
- The unchanged renderer stays within the observed caps: 87 calls, 203,175 triangles, 32 textures, and 41 geometries at maximum.

## Biggest remaining weakness

The tick-41 hero recoil is intentionally conservative: most of Nyra's follow-through still comes from the authored clip, with only a small lateral settle added. Stronger upper-body recoil made the raised blade or planted foot cross the frozen 80 px safe-frame boundary, so this candidate puts most of the new recoil read on the Hollow. A future pose pass with permission to change framing or the authored animation would make the hero's deceleration more dramatic.

## Evidence limitation

The 30.052 s headed stability run averaged 57.598 FPS with 18.7 ms p99 RAF time and no resource growth, but it recorded one 1,101.97 ms RAF interval alongside four long tasks. The package records that transient stall rather than treating the otherwise stable run as an acceptance claim.
