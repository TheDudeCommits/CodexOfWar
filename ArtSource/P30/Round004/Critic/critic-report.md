# P30 Round004 — independent critic report

Verdict: **REJECT**. Score: **34/100**. Focused blind result: **0/3 candidate wins on S03-S05**. Overall blind result: **0/6 candidate wins**.

I independently built the frozen `web-game` from a fresh external copy, served its production bundle on a fresh port, and ran headed Google Chrome at 1600×900/DPR 1 on ANGLE Metal/Apple M2. These S01-S06 images are my own production captures. The six private comparisons were randomized and judged anonymously before reveal; no private identity, filename, hash, pixel, or A/B layout is present here.

## Production and runtime result

- Node 24.18.1 / npm 11.7.0; `npm ci`, typecheck, lint, 5/5 simulation tests, production build, and 3/3 browser smoke tests passed. The main production JavaScript chunk is 2,974,510 bytes.
- Headed Chrome 150.0.7871.187; WebGL 2; HTTP 200; cold ready **2,389 ms**, passing the 4,109 ms limit.
- Assets pass: exactly **18 enabled / 18 loaded**, zero failures, no procedural fallback, authored arena/hero/Hollow active, and PMREM installed.
- Required clips were present and exercised: hero `Idle_Loop`, `Walk_Loop`, `Sprint_Loop`, `Roll`, `Sword_Regular_A`; Hollow `Idle`, `HitReact`, `Death`.
- Pointer lock acquired and released; physical mouse movement changed yaw from 0 to -0.552. Pause, blur clearing, no held-key resume, resize to 1280×720 and restoration to 1600×900 all passed.
- Forced WebGL loss/restore passed at one loss and one restore. There were zero page errors, failed requests, HTTP errors, renderer errors, or final WebGL errors. Three unique deprecation warnings recurred.
- Three representative intervals lasted 31.50 s, 31.25 s, and 32.15 s. Mean rates were 59.98, 60.01, and 59.85 fps; rAF p95 was 18.5, 18.5, and 18.6 ms; no long tasks, texture growth, context growth, or sustained frame-time failure occurred.

## Hard failures

- Every capture exceeds the hard 250,000-triangle limit: **321,705-322,809 triangles** at 63-68 calls.
- Camera boom obstruction is explicitly unimplemented and reports `pending`.
- Tape simulation snapshots/events replay exactly, but the full camera replay does not: the two camera hashes differ, with a measured position delta up to 0.000595 m after reset.
- S02-S05 visibly merge/intersect the hero and Hollow. S04 drives the contact pose through both bodies.
- The blade becomes edge-on/obscured in S05, and grip/weapon contact is not stably readable across S03-S06; S06 crosses the blade through the body/ground.

Those failures alone force rejection regardless of score or blind preference.

## Blind and visual judgment

The candidate lost to private reference S01, S02, S03, S04, S05, and S06. Ties would have counted as losses; none was close. The focused Round004 gate therefore fails **0/3**, and the overall gate fails **0/6**.

| Category | Score | Evidence for deductions |
|---|---:|---|
| Character anatomy/silhouette | 3/10 | Toy-like anatomy and small gameplay scale; merged silhouettes in S02-S05; S06 resembles a toppled ragdoll. |
| Skin/hair/cloth/armor fidelity | 2/10 | Flat plastic color blocks, chunky hair, and little material micro-detail or separation. |
| Enemy zombie threat/fidelity | 2/10 | Simplified cartoon skull form; the Hollow never attacks and player health remained 100 during combat. |
| Weapon/hand contact/readability | 3/10 | Blade readable early, edge-on/obscured in S05, crossing body/ground in S06; unstable visible grip. |
| Animation/posing/weight/contact | 2/10 | Clips run, but startup/active/recovery lack weight and spacing; contact intersects actors and roll is ungrounded. |
| Combat VFX/impact/physics | 3/10 | Health, hit reaction, sparks, and toast work; the flat cyan fan and body overlap do not read as physical impact. |
| Camera/framing/composition | 3/10 | Tiny centered actors, excessive empty ground, overlapping combat silhouettes, pending obstruction, replay mismatch. |
| Environment/lighting integration | 5/10 | Fort and cobbles are coherent PBR work, but the arena is an empty plane against a void and actors integrate weakly. |
| UI/cinematic coherence | 5/10 | Legible sparse HUD; persistent controls and floating `REND` toast remain prototype-level. |
| Runtime polish/stability/performance | 6/10 | Good ready time, 60 fps, input, resize, and context recovery; triangle, camera, and warning failures remain. |

## Single biggest remaining gap

The single biggest gap is the **combat-character contact package**. All focused S03-S05 pairs lost because low-detail toy-like actors merge into one silhouette, poses lack grounded weight/contact, and S05 loses the weapon silhouette.

Smallest next-round prescription: replace only the hero/Hollow/weapon duel package with a matched high-fidelity PBR pair and one authored two-handed heavy strike plus synchronized `HitReact`; enforce visible grip constraints and non-intersecting contact spacing while leaving environment and HUD unchanged.

Acceptance test: fresh frozen S03, S04, and S05 must each show separated readable silhouettes, a fully visible blade with stable palm contact, a clear contact point, and grounded paired motion, then win **3/3** new blind comparisons against private reference S03-S05.
