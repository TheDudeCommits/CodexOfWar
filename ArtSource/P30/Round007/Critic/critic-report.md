# P30 Round007 — independent blind critic report

**Verdict: REJECT — 34/100.** The exact candidate at `6b953f563c68a81f4635aaa081bfeb664f3aee57` lost all six sealed anonymous comparisons. Focused S03-S05 is **0/3**, against the mandatory **3/3**; overall is **0/6**, against **at least 5/6**. No acceptance is claimed.

## Blind result

The six candidate frames were freshly captured from the production build in headed Google Chrome 150 on hardware WebGL2/ANGLE Metal. Before pairing, all six were proven to be 1600×900, DPR 1, 8-bit RGB PNGs, with browser CSS size, canvas CSS size, and canvas backing size all exactly 1600×900. All 18 authored assets loaded and no procedural fallback was active.

An independent custodian privately matched the six camera/action framings, created a cryptographically randomized balanced A/B mapping, and sealed the salted mapping preimage before the scorer opened a pair. The public mapping lock was committed at `9121d6ddc37cd323b0ca7801e62078cdb29ab077`. The scorer then applied the predeclared ten-category rubric without the side mapping. The complete anonymous score preimage was validated, hashed, and committed as a public lock at `e07a4e61b62d82c4c7b91ed595e740852ae384da` before reveal.

- Mapping lock: `1d97a0a72da6672e43e822eba8433339cfff58300ebd00ea7a000f9a3ee2b4d1`
- Anonymous score lock: `15a37e8e07bc72a98e2083132bc8b7c9a692540699f426550fd890e8d22272b4`
- Reveal attestation: `c3a7b7fcef7ddba73448d3108601d62817d8027855bb3970dd474b077b1d1670`

Anonymous winners split A: 3 and B: 3. The mean winning-side score was 83.5; the mean losing-side score was 34.0. Reveal put the candidate on the losing side every time:

| State | Candidate | Matched reference | Outcome |
| --- | ---: | ---: | --- |
| S01 | 34 | 75 | Loss |
| S02 | 36 | 75 | Loss |
| S03 | 36 | 89 | Loss |
| S04 | 37 | 83 | Loss |
| S05 | 38 | 90 | Loss |
| S06 | 23 | 89 | Loss |

The new camera is a measurable improvement: S03-S05 actor scale is useful, both actors and the blade remain safe, and S04 contact is central. That does not make the images competitive. The candidate still reads as a posed low-detail arena test. Bodies are stiff and toy-like, surface response is flat, the opponent has little performance or menace, the same empty courtyard dominates every state, and impact is represented by translucent geometry and block-shaped particles. In comparison, the matched side consistently integrates body mechanics, material response, layered terrain, atmospheric depth, and effects into a single action read.

Every scored category fails the required 9/10 floor:

| Visual category | Candidate mean |
| --- | ---: |
| Camera and composition | 4.50 |
| Character scale and silhouette | 5.33 |
| Anatomy and pose credibility | 3.00 |
| Materials and surface detail | 3.00 |
| Lighting and tonal separation | 3.83 |
| Environment depth and world density | 3.83 |
| Combat contact and impact | 2.83 |
| Motion FX and readability | 2.00 |
| Cinematic cohesion and atmosphere | 2.83 |
| Overall finish and artifact control | 2.83 |

## Independent technical audit

Candidate-runtime checks pass:

- Exact frozen commit verified.
- Node 24.18.0/npm 11.16.0 clean install, typecheck, lint, 5/5 simulation tests, 5/5 camera tests, production build, and 3/3 browser smoke passed. A separate headed smoke repeat also passed 3/3.
- Manifest v2 exposes exactly 18 enabled assets. All 18 are real bytes with correct magic, zero worktree pointers, matching HEAD LFS oids, 18/18 runtime loads, zero failures, and no procedural fallback.
- The 106-entry Round006 freeze audit found 103 exact files and exactly three authorized camera/diagnostic changes: `CowReviewHarness.ts`, `GameApp.ts`, and `ThirdPersonCamera.ts`. Simulation, timing, assets, characters, combat, environment, HUD, lighting, FX, post, and manifest remain exact.
- Chrome reported WebGL2 on ANGLE Metal/Apple M2. CSS viewport, canvas CSS, canvas backing, and DPR were exact. There were no console, page, request, HTTP, review, or renderer errors during capture.
- Three fresh launches reached ready in 1763.630, 2599.002, and 1877.481 ms; the 2599.002 ms maximum is below 4109 ms.
- Maximum observed cost was 86 calls, 204,155 triangles, 32 textures, and 38 geometries, within all caps.
- The 30.126-second headed interval averaged 59.468 fps with 18.6 ms p95 rAF, no resource growth, and WebGL error 0.
- Forced WebGL loss/restore completed at one loss and one restore, with no final loss or renderer error.
- Three clean camera replays were byte-identical at ticks 29, 34, 41, and 60.
- S03/S04/S05 Nyra heights were 406.892/388.327/397.305 px. Minimum actor-or-blade margins were 127.692/102.771/80.098 px. S04 contact was `(957.916, 513.340)`, inside the central 40%.
- Wall obstruction resolved 5.26 m desired to 2.443428040081452 m with collision applied and 0.4500000000000002 m clearance. The clear case resolved exactly 5.26 m desired to 5.26 m.

Repository-wide `git lfs fsck HEAD` still fails. It reports eight historical PNGs stored as direct Git blobs although current attributes require LFS pointers. Object-only fsck passes, those worktree bytes are present and exact to HEAD, and the 18 enabled runtime assets independently pass bytes, magic, and HEAD-oid verification. This is an unrelated pointer-policy history defect; history was not rewritten or disguised.

## The one biggest remaining visible gap

**Combat FX language.** This is the lowest category at 2/10. The screen-sized translucent sweep fan, grid-like trail, block-shaped sparks, and detached hit feedback look like debug overlays, not blade-bound energy or contact-local force. They actively flatten the otherwise improved S03-S05 framing.

## Smallest isolated Round008 replacement

Replace only the weapon-trail FX surface inside `CharacterViews.ts` and the implementation in `CombatFx.ts`; add focused deterministic FX tests and telemetry. Keep camera, simulation, timing, input, character meshes and clips, weapon mesh, materials, environment, lighting, HUD, post, manifest, and every non-FX line byte-exact.

The replacement must:

1. Use a narrow procedural blade-edge ribbon derived from deterministic blade poses; remove the screen-sized translucent fan and grid.
2. At S04, emit one contact-local flash and directional spark/ember burst centered within 24 px of the contact marker; remove block-shaped debris.
3. Be absent at S03, peak at S04, and dissipate by S05 without obscuring either actor or the full blade.
4. Add no texture slot because the current frame already reaches the 32-texture cap, and remain inside the existing call/triangle/geometry caps.
5. Produce byte-identical FX telemetry across three clean replays at ticks 29, 34, and 41.

Round008 still must pass the same full blind gate: focused 3/3, overall at least 5/6, total at least 95/100, every category at least 9/10, plus all current technical gates.

## Privacy and cleanup

No private source pixels, filenames or identities, hashes, crops, pair pixels or hashes, side mapping, salts, randomization material, lock preimages, or private paths are published. Only candidate captures and sanitized public evidence are committed. The custodian verified and deleted the private extraction, crops, pairs, mapping, and randomization material after reveal; the scorer revalidated and deleted the private score preimage. The local server was stopped.
