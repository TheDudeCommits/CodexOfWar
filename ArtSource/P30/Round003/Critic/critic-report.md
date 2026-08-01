# P30 Round003 — independent critic report

Verdict: **REJECT**. Score: **30/100**. Blind result: **0/6 candidate wins**. The candidate misses the required 95/100 total, every-category-at-least-9 requirement, 5/6 blind-win requirement, and multiple hard technical gates.

This was an independent pass against the frozen Round003 candidate. I changed no implementation, builder evidence, progress record, or Git state. S01–S06 in this directory were freshly captured from the production bundle at seed 30001.

## Audit environment

- Typecheck, lint, and isolated production build passed. The production bundle served HTTP 200.
- Headed Google Chrome 150.0.7871.187; hardware WebGL 2 through ANGLE Metal on Apple M2. Unmasked renderer: `ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)`.
- Fixed surface: 1600×900 CSS and backing pixels, DPR 1, renderer pixel ratio 1.
- Review receipt: `cow.review.v1`, P30/P30, seed 30001, Rapier ready, assets ready, renderer compiled/warm.
- Fresh cold navigation-to-ready: **5817 ms**, above the 2500 ms ceiling and slower than Round002's 4109 ms. The review API first appeared at 1225 ms.

## Hard gates

| Gate | Result | Evidence |
|---|---:|---|
| Production bundle, headed hardware WebGL, exact surface | PASS | HTTP 200; Chrome/Metal; 1600×900/DPR 1; `gl.getError()=0`. |
| `cow.review.v1` contract | PASS | Exact piece, preset, seed, viewport, Rapier/assets/compiled-warm receipt. |
| Authored assets | PASS | 18/18 loaded, zero failures, complete, `productionAuthored=true`, no procedural fallback, PMREM installed. |
| Visible animation, weapon, and texture binding | PASS | S03–S06 visibly change startup/active/recovery/dodge pose; claymore, fortress, and PBR textures render. |
| Tape A simulation/event replay | PASS | Two 60-tick runs had exact simulation histories and events. |
| Tape A timing/damage | PASS | Startup 24–31, active 32–35, one 10-damage hit at 33, recovery 36–49, idle 50, busy rejection at 28. |
| Tape A camera replay | **FAIL** | Mismatch on ticks 33–59; peak position delta 0.068249882 m; quaternion-component delta 0.003991048. |
| Tape B out-of-range | PASS | Hollow stayed at 100 HP; zero hit events. |
| Tape C obstruction/collision | **FAIL** | Obstruction remained `implemented=false`, `status=pending`; desired=resolved=7.15 m; collision never applied. |
| Required projection | **FAIL** | Observed 58° / 0.08 / 110; required 50° / 0.08 / 120. |
| Pointer lock and mouse look | **FAIL** | Lock not acquired; yaw/pitch unchanged; focused visible Chrome emitted `WrongDocumentError`. |
| Camera reset replay | **FAIL** | Reset-after-hit differed by 0.038100791 m and quaternion-component delta 0.002215995. |
| Physical keyboard/mouse mappings | PASS | Physical W movement and trusted mouse attack path registered. |
| Held-key clearing | **FAIL** | Blur cleared W; pause did not. First resumed tick moved z 2.500000→2.450000. |
| Resize/DPR restoration | PASS | 1280×720/DPR 2 perturbation preserved the fixed renderer; exact 1600×900/DPR 1 restored. |
| WebGL loss/restore/capture recovery | PASS | One loss and restore; post-restore capture returned 2,920,166 data-URL characters; final renderer/review errors empty. |
| Ongoing runtime-error-free interaction | **FAIL** | Pointer-lock interaction produced the page-level `WrongDocumentError`. |
| Three 30-second frame/resource samples | PASS | All medians, p95s, p99s, and renderer-resource maxima passed. |
| Cold ready ≤2500 ms | **FAIL** | 5817 ms. |
| Blind candidate wins ≥5/6 | **FAIL** | 0/6; every decision was overwhelming. |

Tape A ended at player z 1.600000858, Hollow HP 90, with one hit. Tape B ended at z 2.599999905 and HP 100. Tape C ended at z 5.600004673 with no obstruction resolution. Asset/runtime auditing found no failed request; console output was limited to carried Rapier, RGBELoader, and Three.js shadow-map deprecation warnings outside the pointer-lock page error.

## Harsh AAA score

| Category | Score /10 | Rationale |
|---|---:|---|
| Composition / camera | 3 | The fortress creates a clearer backdrop, but the high, wide camera leaves half the frame as empty tiled ground and collapses the duel into a tiny central overlap. |
| Character / animation | 2 | The small ranger and giant comic Hollow have incompatible fidelity, anatomy, proportions, and material language; poses bind but bodies, sword, and target intersect. |
| Environment / materials / lighting | 4 | Textured masonry, cobble, statue, and PMREM are a real improvement, but the scene remains a symmetric façade on an exposed plane, with obvious repetition, black void, and weak depth. |
| Combat readability / impact | 2 | Contact is hidden inside merged silhouettes; the teal fan, orange target flash, sparse square particles, and floating damage toast do not convey force or material response. |
| Technical correctness / performance | 5 | Authored loading, simulation replay, resize, context recovery, and sustained performance pass; camera, input, replay, and cold-ready gates still fail. |
| AAA finish | 2 | Environment work raises the prototype, but character cohesion, staging, impact treatment, atmospheric depth, and polish remain far below a current AAA frame. |

Category sum: 18/60, normalized total: **30/100**.

## Visual and blind findings

The environment upgrade is visible, but it exposes the remaining character package more sharply: a semi-real masonry backdrop surrounds toy-like actors. S02–S05 repeatedly merge hero, claymore, and Hollow into one unreadable silhouette. S04 overexposes the Hollow, places a flat translucent arc over the contact, and lets `10 · REND` compete with the focal point. S05 has little directional recoil, debris, or aftermath. Across the set, the fortress reads as a front-facing stage rather than a spatially layered place; the floor and dark sky consume attention without adding narrative depth.

The private comparison used six scenario-matched, randomly ordered, independently left/right-randomized pairs. Decisions were locked before reveal. Aggregate result: **0/6 candidate wins, all overwhelming**. Generalized losing reasons were distant combat staging, weak action lines, overlapping anatomy, low character fidelity, thin particles/debris, repetitive materials, and insufficient atmospheric hierarchy. No benchmark filename, path, pair identifier, side map, hash, or image is present here.

## Performance

Each valid sample used a fresh page at the canonical production review URL with post-processing off, headed Chrome, visible/focused hardware rendering, 1600×900/DPR 1, a 120-rAF warmup, and a full 30,000 ms measurement.

| Sample | Frames | Median | p95 | p99 | Max | Calls | Triangles | Textures | Geometries |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 1801 | 16.7 ms | 18.5 ms | 18.7 ms | 18.7 ms | 75 | 176,017 | 30 | 30 |
| 2 | 1801 | 16.7 ms | 18.5 ms | 18.7 ms | 18.8 ms | 75 | 176,017 | 30 | 30 |
| 3 | 1801 | 16.7 ms | 18.5 ms | 18.7 ms | 32.1 ms | 75 | 176,017 | 30 | 30 |

Worst values pass the required ceilings: median 16.7≤16.7, p95 18.5≤20, p99 18.7≤25, calls 75≤120, triangles 176,017≤1.5M, textures 30≤32, geometries 30≤120. All three pages reported WebGL2/Metal, `glError=0`, 18/18 assets, and zero page, request, console-error, or review-error entries.

## Capture manifest

| Capture | Frozen state | Bytes | SHA-256 |
|---|---|---:|---|
| S01.png | Tape C / reset framing, tick 120 | 1,856,423 | `2778f4977419ae5359112269c7bc5bea85853b8694981d7a481f13c78bb4f5ea` |
| S02.png | Close idle, tick 23 | 1,938,739 | `d5a5e81646c8e4700d7bb7d627d86ffa7e4cd9b840714d9debae035d24b58481` |
| S03.png | Attack startup, tick 29 | 1,939,232 | `5069db9126757f1e20354571472ae528c512a4879f399a6b8940fab5967076b7` |
| S04.png | Active hit, tick 34 | 1,944,994 | `abfeded25dc817036833fd3193f08fd137eb8f0ad3673e72a8186295494d3ebe` |
| S05.png | Recovery/aftermath, tick 41 | 1,940,413 | `c872f69aa24676c0dcbadbb3c837785fa3957506292c53c2979a41de1c323ccf` |
| S06.png | Dodge/side offset, tick 37 | 1,933,207 | `74b6f4bd9ed7a31ec388339a8487e3511d1ba5ad580a9ea1a59c538f9809b5e6` |

All are opaque 1600×900 RGB PNGs containing only IHDR, IDAT, and IEND chunk types.

## Exactly one biggest remaining gap

Gap ID: `character_combat_fidelity`

The dominant gap is the visible hero/Hollow/claymore package: incompatible fidelity and proportions, weak attack/reaction posing, and mesh interpenetration prevent a coherent, forceful contact beat even against the improved environment.

Smallest bounded next-builder prescription: **replace and tune only the hero, Hollow, and claymore render assets, their materials, rig/grip/contact offsets, and the existing attack/reaction presentation clips.** Freeze environment geometry/materials/lighting, camera, HUD, simulation, physics, timing/damage, input, review API, seed, tapes, viewport, and performance contract.

One measurable success criterion: **fresh independent S03–S05 captures must win 3/3 scenario-matched blind comparisons.**

The other failed hard gates still block acceptance; they are recorded above and are not additional visual prescriptions.

## Private cleanup

The dedicated private comparison workspace, including extracted benchmark material, composites, reveal mapping, and working decisions, was permanently deleted after aggregation; absence was verified. No private benchmark material or identity was copied into the repository.
