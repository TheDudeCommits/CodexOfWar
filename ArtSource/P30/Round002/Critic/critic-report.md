# P30 Round002 — fresh critic report

Verdict: **REJECT**. Score: **25/100**. Blind result: **0/6 candidate wins**. The candidate misses the required 95/100 total, every-category-at-least-9 threshold, 5/6 blind-win threshold, and multiple hard technical gates.

This was an independent critic pass against the frozen `receipt.json`. I did not edit runtime, source, progress, builder captures, or Git. The six files in this `Critic` directory were captured independently from the production bundle at seed 30001.

## Audit environment

- Production preview: Vite production `dist`, served on an isolated loopback port.
- Browser: headed Google Chrome 150.0.7871.187, controlled through Playwright.
- GPU: hardware WebGL 2 through ANGLE Metal on Apple M2. Unmasked renderer was `ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)`.
- Fixed review surface: 1600×900 CSS pixels, 1600×900 backing store, DPR 1, renderer pixel ratio 1.
- Review API: `cow.review.v1`; `ready` resolved with P30, preset P30, seed 30001, Rapier ready, assets ready, and renderer compiled/warm.
- Cold navigation-to-ready: **4109 ms**, over the 2500 ms ceiling. The review API became observable after 459 ms.

## Outcome and hard gates

| Gate | Result | Evidence |
|---|---:|---|
| Production bundle, headed hardware WebGL, exact surface | PASS | HTTP 200; Chrome/Metal renderer; 1600×900/DPR 1 confirmed in DOM, canvas, and renderer telemetry. |
| `cow.review.v1` contract | PASS | Schema and ready receipt matched. |
| Authored asset load | PASS | 18/18 enabled keys loaded; zero failures; `productionAuthored=true`; no procedural fallback; PMREM installed; hero, Hollow, and arena authored. |
| Visible animation/weapon/texture binding | PASS | S03–S06 show distinct startup, active, recovery, and dodge poses; the claymore follows the authored rig; trail/contact state appears; cobble/PBR surface detail is visible. The artistic result is still poor. |
| Tape A simulation replay | PASS | All 60 processed snapshots and all events were byte-for-byte equal across two resets. |
| Tape A required timing/damage | PASS | Startup 24–31, active 32–35, one 10-damage hit at 33, recovery 36–49, idle 50, and busy rejection at 28. |
| Tape A camera replay | **FAIL** | Camera differed on ticks 33–59; peak position delta 0.068249882 m and quaternion-component delta 0.003991048. |
| Tape B out-of-range | PASS | Hollow remained at 100 HP; zero `enemy_hit` events. |
| Tape C boom obstruction/collision | **FAIL** | `implemented=false`, `status=pending`, desired=resolved=7.15 m for every tick, and collision was never applied. S01 visibly contains the foreground obstruction. |
| Required 50° / 0.08 / 120 projection | **FAIL** | Observed 58° / 0.08 / 110. |
| Pointer lock and mouse look | **FAIL** | Trusted canvas click registered an attack, but pointer lock never acquired; focused, visible Chrome raised `WrongDocumentError`; yaw and pitch could not change. |
| Camera reset replay | **FAIL** | Reset after hit shake differed from a clean reset by 0.034034747 m and quaternion-component delta 0.001998314. |
| Physical keyboard/mouse mappings | PASS | Physical W moved 2.6→1.6 over 20 review ticks; trusted mouse click incremented attack serial to 1. |
| Held-key clearing across pause and blur | **FAIL** | Blur cleared W; pause did not. With W held, the first resumed tick moved z 2.500000→2.450000. |
| Resize/DPR perturbation and restoration | PASS | Perturbation to 1280×720/DPR 2 left the fixed renderer at 1600×900/DPR 1; restoration returned the window to 1600×900/DPR 1. |
| Forced WebGL loss, restore, and capture | PASS | One loss and one restore observed; post-restore capture returned 2,533,154 data-URL characters; final renderer/review error arrays were empty. |
| Ongoing runtime-error-free interaction | **FAIL** | Pointer interaction emitted a page-level `WrongDocumentError`. Asset loading and context recovery emitted no persistent renderer errors. |
| Frame-time/resource ceilings | PASS | All three 30-second samples passed median/p95/p99 and resource ceilings. |
| Cold ready ≤2500 ms | **FAIL** | 4109 ms. |
| Blind visual comparison ≥5/6 | **FAIL** | 0/6 candidate wins; every decision was overwhelming. |

## Harsh AAA score

| Category | Score /10 | Rationale |
|---|---:|---|
| Composition / camera | 2 | Camera is high, wide, and distant; the ritual ring and empty floor dominate; combat silhouettes overlap; Tape C is obstructed; projection is wrong. |
| Character / animation | 3 | Authored clips visibly bind, but the low-detail ranger and comic Hollow do not share a convincing AAA art direction; poses clip and lack weight. |
| Environment / materials / lighting | 2 | Cobble detail and PMREM exist, but the repeated flat disk, blocky ruin façade, black void, crude palette, and clipped highlights read as a prototype. |
| Combat readability / impact | 2 | Damage timing is correct, yet the hit is mostly an orange flash, a faint arc, tiny square particles, interpenetrating bodies, and a toast over the focal point. |
| Technical correctness / performance | 5 | Simulation, authored loading, resize restoration, context recovery, and sustained frame/resource metrics pass; camera, input, replay, and cold-ready gates do not. |
| AAA finish | 1 | No frame approaches a shippable AAA bar in modeling, staging, lighting, effects, polish, or cohesion. |

Category sum: 15/60, normalized total: **25/100**.

## Visual findings

1. **The entire visible package reads as a bright low-poly prototype.** Character shape language, the oversized cartoon Hollow, flat ruin pieces, cobble disk, and near-black backdrop have neither realistic fidelity nor a deliberately premium stylized finish.
2. **Combat is staged too far away.** The subjects occupy a small central area while empty ground and the arena ring consume most of the frame. The camera never produces a powerful over-shoulder action line or a readable combat triangle.
3. **Animation binding is present but presentation is not credible.** Startup, active, recovery, and dodge poses change as commanded, but the sword and bodies intersect, the Hollow does not sell force, and the active pose is difficult to parse.
4. **Impact treatment is insufficient.** The hit flash blows the Hollow toward flat orange, the weapon trail is faint, particles are sparse and square, and there is no convincing directional recoil, material response, or grounded debris plume.
5. **Lighting destroys hierarchy.** Foreground ground texture and characters are broadly overlit while the background falls into a void. Surfaces do not separate through plausible roughness, bounce, atmospheric perspective, or localized contrast.
6. **The HUD is clean but competes with action.** `10 · REND` appears directly above the overlapping characters, further obscuring the weakest focal moment.

## Blind comparison

The six candidate captures were matched by broad scenario, shuffled, assigned random opaque IDs, and independently randomized left/right. Decisions and reasons were written before opening the reveal map. No reference image, filename, path, hash, or other private identity is present in this report.

| Opaque pair | Candidate won | Confidence | Locked rationale |
|---|---:|---|---|
| P-8E4294 | No | Overwhelming | The winning image had a close, legible combat triangle, forceful silhouettes, dense spatial context, differentiated surfaces, and contact particles; the candidate left tiny overlapping actors in a flat, mostly empty stage. |
| P-D54D68 | No | Overwhelming | The winning image used a commanding foreground silhouette, believable anatomy and gear, textured depth, and readable adversary response; the candidate was obstructed and toy-like. |
| P-FAF0C0 | No | Overwhelming | The winning image established scale hierarchy, cinematic opposition, atmosphere, and clear imminent action; the candidate reduced the beat to tiny low-detail figures on an undifferentiated floor. |
| P-5E3B41 | No | Overwhelming | The winning image showed decisive contact, directional force, layered debris/sparks, grounded proximity, and material detail; the candidate was overexposed, overlapping, and weak at impact. |
| P-D06BA0 | No | Overwhelming | The winning image created a sweeping action line, strong depth, readable threats, and coherent spatial drama; the candidate presented a small central scuffle. |
| P-33A88C | No | Overwhelming | The winning image combined over-shoulder composition, atmospheric separation, luminous weapon trajectory, and reactive depth; the candidate was static, flatly lit, and dominated by empty floor and sky. |

Blind result: **0/6**. Required: at least 5/6.

## Asset and runtime receipt inspection

- Registry: manifest version 2, 18 enabled, 18 loaded, zero failures, complete.
- Presentation: `proceduralFallbackActive=false`; hero, Hollow, and arena sector all report authored with no fallback reason.
- Hero clips include idle, walk, sprint, roll, sword attack, hit, and death-capable carriers. Hollow clips include idle, hit reaction, and death.
- Weapon asset and all six declared environment material textures loaded.
- Snowy-forest environment PMREM installed; `productionAuthored=true`.
- Initial renderer: 63 calls, 77,710 triangles, 31 textures, 31 geometries, zero WebGL error.
- Console contained only the carried Rapier initialization deprecation, RGBELoader deprecation, and expected context-lost/context-restored logs. No network request failed. Pointer-lock attempts produced the page error documented above.

## Deterministic Tape A

Both runs used the exact README tape and stepped one processed tick at a time so camera telemetry could be captured separately. Simulation histories and events matched exactly; camera telemetry did not.

Events:

- tick 24: `attack_started`, serial 1
- tick 28: `attack_rejected_busy`, serial 1
- tick 33: `enemy_hit`, damage 10, HP 100→90, serial 1

Camera replay divergence began on the hit tick and persisted through tick 59. Peak position delta was 0.068249882 m at tick 34; peak quaternion-component delta was 0.003991048. This is not concealed by the passing simulation replay.

| Tick | Player z | Motion | Attack phase | Frame | Hollow HP | Events |
|---:|---:|---|---|---:|---:|---|
| 0 | 2.55 | move | idle | -1 | 100 |  |
| 1 | 2.5 | move | idle | -1 | 100 |  |
| 2 | 2.45 | move | idle | -1 | 100 |  |
| 3 | 2.4 | move | idle | -1 | 100 |  |
| 4 | 2.35 | move | idle | -1 | 100 |  |
| 5 | 2.3 | move | idle | -1 | 100 |  |
| 6 | 2.25 | move | idle | -1 | 100 |  |
| 7 | 2.2 | move | idle | -1 | 100 |  |
| 8 | 2.15 | move | idle | -1 | 100 |  |
| 9 | 2.1 | move | idle | -1 | 100 |  |
| 10 | 2.05 | move | idle | -1 | 100 |  |
| 11 | 2 | move | idle | -1 | 100 |  |
| 12 | 1.950001 | move | idle | -1 | 100 |  |
| 13 | 1.900001 | move | idle | -1 | 100 |  |
| 14 | 1.850001 | move | idle | -1 | 100 |  |
| 15 | 1.800001 | move | idle | -1 | 100 |  |
| 16 | 1.750001 | move | idle | -1 | 100 |  |
| 17 | 1.700001 | move | idle | -1 | 100 |  |
| 18 | 1.650001 | move | idle | -1 | 100 |  |
| 19 | 1.600001 | move | idle | -1 | 100 |  |
| 20 | 1.600001 | idle | idle | -1 | 100 |  |
| 21 | 1.600001 | idle | idle | -1 | 100 |  |
| 22 | 1.600001 | idle | idle | -1 | 100 |  |
| 23 | 1.600001 | idle | idle | -1 | 100 |  |
| 24 | 1.600001 | attack | startup | 1 | 100 | attack_started |
| 25 | 1.600001 | attack | startup | 2 | 100 |  |
| 26 | 1.600001 | attack | startup | 3 | 100 |  |
| 27 | 1.600001 | attack | startup | 4 | 100 |  |
| 28 | 1.600001 | attack | startup | 5 | 100 | attack_rejected_busy |
| 29 | 1.600001 | attack | startup | 6 | 100 |  |
| 30 | 1.600001 | attack | startup | 7 | 100 |  |
| 31 | 1.600001 | attack | startup | 8 | 100 |  |
| 32 | 1.600001 | attack | active | 9 | 100 |  |
| 33 | 1.600001 | attack | active | 10 | 90 | enemy_hit |
| 34 | 1.600001 | attack | active | 11 | 90 |  |
| 35 | 1.600001 | attack | active | 12 | 90 |  |
| 36 | 1.600001 | attack | recovery | 13 | 90 |  |
| 37 | 1.600001 | attack | recovery | 14 | 90 |  |
| 38 | 1.600001 | attack | recovery | 15 | 90 |  |
| 39 | 1.600001 | attack | recovery | 16 | 90 |  |
| 40 | 1.600001 | attack | recovery | 17 | 90 |  |
| 41 | 1.600001 | attack | recovery | 18 | 90 |  |
| 42 | 1.600001 | attack | recovery | 19 | 90 |  |
| 43 | 1.600001 | attack | recovery | 20 | 90 |  |
| 44 | 1.600001 | attack | recovery | 21 | 90 |  |
| 45 | 1.600001 | attack | recovery | 22 | 90 |  |
| 46 | 1.600001 | attack | recovery | 23 | 90 |  |
| 47 | 1.600001 | attack | recovery | 24 | 90 |  |
| 48 | 1.600001 | attack | recovery | 25 | 90 |  |
| 49 | 1.600001 | attack | recovery | -1 | 90 |  |
| 50 | 1.600001 | idle | idle | -1 | 90 |  |
| 51 | 1.600001 | idle | idle | -1 | 90 |  |
| 52 | 1.600001 | idle | idle | -1 | 90 |  |
| 53 | 1.600001 | idle | idle | -1 | 90 |  |
| 54 | 1.600001 | idle | idle | -1 | 90 |  |
| 55 | 1.600001 | idle | idle | -1 | 90 |  |
| 56 | 1.600001 | idle | idle | -1 | 90 |  |
| 57 | 1.600001 | idle | idle | -1 | 90 |  |
| 58 | 1.600001 | idle | idle | -1 | 90 |  |
| 59 | 1.600001 | idle | idle | -1 | 90 |  |

## Tape B, Tape C, camera, and input

- Tape B: final player z 2.5999999; Hollow HP 100; zero hits.
- Tape C: final player z 5.6000047. Final camera position `[1.3493244, 2.9711010, 12.6062258]`, yaw 0, pitch 0.2. Boom desired and resolved distances were both 7.15 m; collision was never applied; the obstruction API remained pending.
- Projection decoded from the matrix as 58° FOV, 0.08 near, 110 far. Required values are 50°, 0.08, 120.
- Camera reset after an active hit did not reproduce a clean reset because shake state survives reset.
- Physical W movement and physical mouse attack binding worked.
- Pointer lock and mouse look did not work even after foregrounding a focused, visible headed Chrome window.
- Pause stopped movement while paused, but did not clear W; movement resumed immediately with the held key. Blur did clear W.
- Review renderer stayed fixed at 1600×900/DPR 1 through a 1280×720/DPR 2 perturbation and returned to an exact 1600×900/DPR 1 window afterward.
- Forced context loss/restore completed once each; capture recovered; final renderer and review error arrays were empty.

## Performance

Each sample used the live production loop at 1600×900/DPR 1 with post-processing off, a fresh page, 120 rAF warmup frames, and a 30-second measurement. Frame time is consecutive headed-browser rAF interval; renderer CPU snapshot was 0.5–1.0 ms.

| Sample | Frames | Median | p95 | p99 | Max | Calls | Triangles | Textures | Geometries |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 1801 | 16.7 ms | 18.5 ms | 18.6 ms | 19.8 ms | 63 | 77,710 | 31 | 31 |
| 2 | 1801 | 16.7 ms | 18.5 ms | 18.7 ms | 18.8 ms | 63 | 77,710 | 31 | 31 |
| 3 | 1800 | 16.7 ms | 18.4 ms | 18.6 ms | 33.0 ms | 63 | 77,710 | 31 | 31 |

Summary against ceilings: median 16.7≤16.7 pass; worst p95 18.5≤20 pass; worst p99 18.7≤25 pass; calls 63≤120 pass; triangles 77,710≤1.5M pass; textures 31≤32 pass; geometries 31≤120 pass. Cold ready 4109≤2500 **fails**.

## Candidate capture manifest and privacy check

| Capture | State | Size | PNG metadata |
|---|---|---:|---|
| S01.png | Tape C, 120 ticks, obstruction framing | 1,727,202 bytes | 1600×900, opaque; IHDR/IDAT/IEND only |
| S02.png | Close idle after forward tape, 23 ticks | 1,727,960 bytes | 1600×900, opaque; IHDR/IDAT/IEND only |
| S03.png | Startup, 29 ticks | 1,725,619 bytes | 1600×900, opaque; IHDR/IDAT/IEND only |
| S04.png | Active hit, 34 ticks | 1,726,981 bytes | 1600×900, opaque; IHDR/IDAT/IEND only |
| S05.png | Recovery/aftermath, 41 ticks | 1,727,112 bytes | 1600×900, opaque; IHDR/IDAT/IEND only |
| S06.png | Dodge/side-offset framing, 37 ticks | 1,724,157 bytes | 1600×900, opaque; IHDR/IDAT/IEND only |

All six files are candidate-only. No textual, compressed-text, international-text, or EXIF chunk exists, so no private benchmark data is embedded.

## Exactly one biggest remaining gap

Gap ID: `cohesive_aaa_combat_presentation`

The dominant gap is the visible duel's lack of a coherent AAA presentation package. It caused all six overwhelming blind losses and depresses character, environment, combat-impact, and finish scores simultaneously.

Bounded next-builder prescription: **replace and tune only the visible presentation package for the existing hero, Hollow, claymore, single camera-facing arena sector, their materials/lighting, and the existing contact FX.** Keep the current one-hero/one-Hollow/one-weapon/one-sector scope. Do not change simulation, physics, hit timing/damage, camera behavior, input, HUD, review API/telemetry, seed, tapes, viewport, or post default.

Measurable success criteria:

1. Fresh S01–S06 captures at 1600×900/DPR 1 and seed 30001 win at least 5/6 in a new blind comparison.
2. Character/animation, environment/materials/lighting, combat readability/impact, and AAA finish each score at least 9/10.
3. S03–S06 show zero hero/weapon/Hollow mesh interpenetrations at the frozen capture ticks; the active strike has a readable directional trail, contact point, target reaction, and debris silhouette without relying on the damage toast.
4. Hero, Hollow, weapon, and visible sector share one deliberate fidelity/style target with consistent texel density and physically coherent material response; no clipped central-combat highlights.
5. Preserve 18/18 loading, no fallback, PMREM, exact Tape A/B simulation behavior, and all current passing performance/resource ceilings; cold ready must not regress beyond the present measured value.

Non-primary hard failures outside this selected gap remain: boom obstruction, projection, pointer lock/mouse look, hit-shake camera reset, held-key clearing on pause, runtime pointer error, and cold ready. They still block acceptance, but they are not additional primary prescriptions in this report.

## Private cleanup

The dedicated private workspace containing extracted benchmark material, randomized pair composites, pair-source reveal data, and the private working record was deleted after reveal. Absence was explicitly verified. No private benchmark material was copied into the repository.
