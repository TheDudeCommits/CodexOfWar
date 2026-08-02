# P30 Round012-A blind critic protocol — distinct heavy branch, exact visible contact, and authoritative damage

Status: **LOCKED before any Round012 candidate package, source, identity, branch, commit, builder evidence, or evaluator-selected offset was available to the critic**

Protocol ID: `P30-R012A-BLIND-v1`

Scenario ID: `P30-heavy-strike-v1`

Seed: `30012`

Lock date: `2026-08-03` (`Asia/Bangkok`)

Supersedes: `PROTOCOL_DRAFT.md` for Round012-A only

The supplied real God of War Ragnarök gameplay screenshots remain the production bar. There is no browser, WebGL, prototype, indie, or “good for a web game” allowance.

This protocol locks the smallest independently judgeable Round012 piece:

1. a real Mouse2/`KeyK` heavy-attack branch beginning at absolute simulation tick 24;
2. a rendered heavy pose and weapon trajectory that are materially distinct from the preserved light strike;
3. evaluator-owned swept visible-blade/body contact whose first contact interval is exactly absolute tick 46; and
4. exactly one authoritative `100 -> 75` health mutation at the end of that same tick.

Hit-stop, new victim reaction, recoil, camera impulse, impact VFX, and attack audio are **not** part of Round012-A. They belong to Round012-B. Existing selected-baseline behavior in those systems is frozen and may not be changed to improve a Round012-A score.

## 1. Preconditions, selected baseline, and scope freeze

Round012-A does not begin until the public identity-aware Round011 verdict exists. A public `BASELINE_RECEIPT.json` must then be committed before either Round012 builder starts. It contains only:

- this protocol ID and raw-file SHA-256;
- the Round011 final-verdict file SHA-256;
- the verdict's deterministic `selectedCheckpoint` alias and revealed source commit;
- the exact Git tree, clean materialized source-tree, package-tree, production-output, lockfile, and baseline-evidence-manifest digests;
- the normal playable route and frozen camera/scenario IDs; and
- hashes for evaluator-created neutral and light-strike golden traces.

If Round011 has no identity-aware final verdict or no `selectedCheckpoint`, Round012-A cannot start. The selected checkpoint need not have been accepted; its rejected/accepted status must be copied honestly into the receipt. The receipt selects the one baseline named by the final verdict; a coordinator may not choose another candidate after learning a Round012 result.

The following selected-baseline behavior is frozen:

- hero, sword, zombie, rig scale, world units, target spawn, camera, lighting, materials, environment, HUD, health store, light strike, target locomotion/reaction, collision layer policy, effects, audio, asset tier, lifecycle behavior, and read-only critic adapter semantics;
- neutral and Mouse1 light-strike output on the normal production route; and
- all Round011 technical behavior not expressly changed by the heavy branch.

Permitted Round012-A changes are limited to heavy-input binding, heavy action state/timing, heavy rendered animation/pose data, heavy visible sword path, routing evaluator-confirmed heavy contact into the existing authoritative damage path, identity-neutral tests, and the strictly read-only fields required by this protocol. No camera, environment, lighting, material, target reaction/recoil, hit-stop, VFX, audio, HUD, health-store, light-strike, or lifecycle redesign is permitted.

A post-reveal source diff and data-flow audit enforces this scope. A technically necessary refactor is allowed only when the auditor proves its neutral and light behavior is byte/state/pixel equivalent under section 12.8. An unrelated improvement is deferred to another numbered piece.

`PROTOCOL_DRAFT.md` remains historical context and is non-normative. Where it differs from this file, this file controls. In particular, the exact visible contact capture is absolute tick **46**, not 47, and the production viewport is the selected Round011 viewport in section 4.

## 2. Acceptance is conjunctive

A candidate is accepted only when every condition below is true:

1. no round-level or candidate-level disqualifier occurred;
2. objective gates `O1` through `O5` all pass;
3. technical gates `T1` through `T10` all pass;
4. all three candidate-versus-reference ballots are wins: `3/3`;
5. the absolute heavy-branch visual score is at least `95/100`;
6. every one of the ten visual category scores is at least `9/10`; and
7. final post-reveal source/package identity and provenance verification passes.

```text
ACCEPT = noDisqualifier
  AND O1 AND O2 AND O3 AND O4 AND O5
  AND T1 AND T2 AND T3 AND T4 AND T5
  AND T6 AND T7 AND T8 AND T9 AND T10
  AND referenceWins == 3
  AND visualTotal >= 95
  AND min(categoryScores) >= 9
```

A tie, abstention, or unclear ballot is not a win. No score compensates for a failed gate. Before identity reveal, `T1.finalSourceParity` and `T10.postRevealAudit` are `"pending-reveal"`, so the alias-only result is only `provisionallyAccepted`. Final `accepted` can become true only in the separate identity-aware verdict; no observation, ballot, category score, or biggest-gap sentence may change after the alias-only score is sealed.

Both candidates may theoretically pass the absolute bar. The deterministic deployment recommendation in section 11 selects one without changing whether either candidate was accepted.

## 3. Roles, blindness, and immutable sequence

The protocol author, two builders, packaging authority, ballot compositor, and critic are separate contexts. The critic receives fresh context and is source- and identity-blind until its alias-only score is committed. It may inspect only the strict identity-free `CRITIC_INTERFACE.json`; it may execute packaged source without browsing it.

The sequence may not be reordered:

1. Commit this protocol.
2. Publish `BASELINE_RECEIPT.json` after the final Round011 verdict and before Round012 builder fan-out.
3. The critic creates fresh random 32-byte presentation and counterfactual seeds and withholds them.
4. Before candidate access, a reference curator fixes the three private reference selections/crops and its salted selection commitment described in section 10. The critic may be the curator only before candidate access.
5. Publish one `ROUND_COMMITMENT.json` binding the protocol/baseline, both seed commitments, reference commitment, and frozen evaluator helpers.
6. Two builders independently implement against the same baseline receipt and locked protocol.
7. Packaging authority creates two random opaque aliases, exact source archives, and a salted hidden identity/source map. It publishes archive/tree hashes and the map commitment before critic access.
8. Critic verifies public commitments and evaluates the two aliases once in seed-derived order. It does not inspect source, source maps, Git history, builder worktrees, builder messages, or builder evidence.
9. Ballot compositor generates identity-free, seed-ordered private boards. The critic casts every ballot once, then fixes all objective findings and visual scores.
10. Critic writes and validates `ALIAS_ONLY_SCORE.json`, generates a new random 32-byte score salt, writes `SCORE_SEAL.json`, and commits both. It sends only that commit SHA and score commitment to the authority.
11. Packaging authority reveals the already-committed identity/source map and map salt.
12. Critic verifies exact source/package/build parity and performs the post-reveal provenance audit. Alias-only judgments remain immutable.
13. Critic publishes `FINAL_VERDICT.json`, reveals the presentation/counterfactual seeds and reference/score salts for audit, and commits the final receipt.

Identity, builder slot, branch, worktree, approach, commit, source, builder evidence, or the hidden alias map reaching the critic before step 10 voids the round. A score change after step 10 voids the round.

## 4. Required production execution

All gameplay, captures, and judgments use the candidate's clean production build and normal playable route.

- Node: exact `/opt/homebrew/opt/node@24/bin/node`, major 24; exact Node/npm versions recorded.
- Browser: headed Chrome/Chromium; exact executable/version and launch arguments recorded.
- GPU: hardware-accelerated WebGL2 through a named physical renderer. SwiftShader, llvmpipe, software rasterization, WebGL1, Canvas2D playfield, a static composite, screenshot, or pre-rendered video fails.
- Viewport/screen/page PNG: exactly `1600x900`, device scale factor 1, `devicePixelRatio=1`, zoom 100%, PNG `1600x900`.
- Route: the normal production route from `BASELINE_RECEIPT.json`; no screenshot, evaluator, alternate-camera, isolated-animation, or asset-tier route.
- Assets: highest declared production tier, entirely local after install; fallback geometry/material/animation is forbidden.
- Input: trusted Playwright pointer/keyboard events through the normal game input path. Calling an attack, animation, damage, or collision method directly is forbidden.
- Evidence: evaluator-created full-page frames and lossless frame sequences from the live page. Builder captures are ignored.

Each scored fixed tick is exactly `1/60 s`. There is no variable-step catch-up, render interpolation, or dropped simulation update in a deterministic trace. Rendering may continue while paused for capture, but it must render the exact post-update state with interpolation alpha 0.

## 5. Clock, reset, focus, and exact input semantics

### 5.1 Tick boundary

`resetAndPause` leaves the canonical scenario in a pre-update state labeled absolute simulation tick `-1`, with input queues/latches empty, health 100, no active action, fixed seed 30012, and the simulation paused. For each absolute tick `N >= 0`, the order is:

1. enqueue trusted browser input delivered after the previous capture and before update `N`;
2. sample input and rising edges for tick `N`;
3. advance exactly one `1/60 s` authoritative simulation/animation update;
4. update actual scene/bone world matrices;
5. perform collision and authoritative health mutation;
6. commit state/event receipts for tick `N`;
7. render that state once with interpolation alpha 0; and
8. if `N` is armed, pause before update `N+1`, then allow the evaluator to capture.

Absolute tick `N` evidence therefore means the production frame after all work above for update `N` and before update `N+1`. `heavyRelativeTick` is `null` before the heavy rising edge and is 0 on the update that samples it.

### 5.2 Focus acquisition

On each cold boot the evaluator reaches the first actionable frame, moves to the canvas center, and performs one trusted normal left click if the normal route needs focus/pointer lock. This is outside the scored tape. It waits for the pointer-lock promise/event to settle, then calls `resetAndPause`; the reset must clear every gameplay consequence of that click while preserving a valid focused input state. The evaluator never calls `canvas.focus()` or an attack method.

Focus and pointer-lock state, click count, and any promise rejection are recorded. A candidate-specific inability to establish the normal playable focus state is a failure, not a retry invitation.

### 5.3 Canonical Mouse2 trace

- Ticks 0–23: no gameplay input or camera motion.
- While paused after tick 23 and before update 24: trusted `pointerdown` at canvas center with `button=2`, `buttons=2`.
- Update 24 samples exactly one heavy rising edge. This is heavy-relative tick 0.
- While paused after tick 24 and before update 25: matching trusted `pointerup` with `button=2`, `buttons=0`.
- Ticks 25–80: no gameplay input or camera motion.

The normal browser `contextmenu` event caused by the right click must be observed exactly once, must finish dispatch with `defaultPrevented === true`, and must never open native chrome, change focus, pause, or generate a console/page/unhandled error. The evaluator records trusted DOM events independently of the candidate event log.

### 5.4 Required input/control traces

Every trace starts from a clean `resetAndPause` unless explicitly described otherwise.

1. `MOUSE2_TAP`: canonical trace above.
2. `KEYK_TAP`: trusted `keydown` (`code="KeyK"`, `repeat=false`) before update 24 and matching `keyup` before update 25.
3. `MOUSE2_HELD`: right button down before update 24, held continuously, released before update 61.
4. `NO_HEAVY`: no Mouse2, `KeyK`, Mouse1, movement, or camera input through tick 80.
5. `LIGHT_BASELINE`: preserved Mouse1 tap, with trusted left `pointerdown` before update 24 and matching `pointerup` before update 25, otherwise no input through tick 80.
6. `SHIFT_PLUS_7`: seven additional neutral updates, then the complete Mouse2 tape shifted so the rising edge is absolute tick 31; terminal tick is 87.
7. `CAPTURE_UNARMED`: canonical Mouse2 tape with no focused capture tick armed; only terminal tick 80 is armed so receipts and the final production frame can be collected.
8. counterfactual hit and miss traces from section 8.

Mouse2 and `KeyK` are one action binding. Tap/held/alternate traces must each produce exactly one heavy activation, one evaluator-owned contact interval, and one damage mutation; holding may not charge, repeat, or restart the action in Round012-A. Mouse2 and `KeyK` combat state/event digests must be bit-identical after normalizing only the recorded device-specific raw DOM event fields. The `+7` trace must be an exact seven-tick translation of combat-relative state/events and must contact/damage at absolute tick 53.

## 6. Strict candidate interface

The package root contains an identity-free `CRITIC_INTERFACE.json` with exactly this shape and no free-form prose:

```json
{
  "schema": "p30.r012a.candidate-interface.v1",
  "protocolID": "P30-R012A-BLIND-v1",
  "opaqueAlias": "candidate-0000000000000000",
  "baselineReceiptSha256": "<64 lowercase hex>",
  "nodeMajor": 24,
  "packageManager": "npm",
  "normalPlayableRoute": "/<normal-production-route>",
  "readyPath": "/<production-readiness-path>",
  "scenarioID": "P30-heavy-strike-v1",
  "seed": 30012,
  "fixedDeltaNumerator": 1,
  "fixedDeltaDenominator": 60,
  "captureTickSpace": "absolute-scenario",
  "heavyRisingEdgeAbsoluteTick": 24,
  "heavyInputs": [
    { "device": "mouse", "button": "right", "buttonNumber": 2 },
    { "device": "keyboard", "code": "KeyK" }
  ],
  "criticHookGlobal": "__P30_CRITIC__",
  "buildOutputDirectory": "<relative-production-directory>"
}
```

Both candidates declare identical values except `opaqueAlias` and output directory where architecture requires it. Paths are normalized relative POSIX paths without `..`. The alias matches the package commitment.

The normal page exposes `window.__P30_CRITIC__` with:

- `schema === "p30.r012a.runtime-hook.v1"`;
- `whenReady(): Promise<void>`;
- `resetAndPause({ seed, targetOffsetMicrometres }): Promise<void>`;
- `armCaptureTicks(number[]): void`, accepting absolute ticks only;
- `resume(): void`, releasing only the current post-update pause;
- `snapshot(): object`;
- `runReceipt(): object`;
- `resourceReceipt(): object`; and
- `geometrySource(): object`, returning live page-realm references described below.

`targetOffsetMicrometres` is exactly three signed safe integers `[right, up, forward]`. It translates the complete target render rig, bone rig, authoritative collision body, and production health entity before tick 0; it does not alter animation, facing, scale, AI, camera, hero, or world. It is evaluator configuration, not a gameplay action. Calling it after tick `-1` fails.

The hook may seed, reset, fixed-step, pause/resume, and expose read-only production state. It may not seek, rewind, fast-forward, re-pose, issue gameplay input, choose collision results, change health, change camera/HUD/assets/LOD/lighting/effects, render through another scene/camera/canvas, or manufacture telemetry. Armed and unarmed rendering must be identical.

`geometrySource()` is consumed only inside the live page realm by the locked evaluator helper. It returns actual object references, not copied proxy geometry:

- the exact `scene` and `camera` instances passed to the production renderer for the scored frame;
- hero root and the actual left/right hand bones used by the rendered rig;
- all and only the opaque rendered sword-blade mesh primitives, including mesh reference and blade material-group indices, excluding hilt/guard;
- target root, all opaque rendered target skinned meshes, and actual rendered target landmark bones for pelvis, neck, head, left/right shoulder, elbow, wrist, hip, knee, and ankle; and
- a read-only reference to the authoritative production health store/entity used by normal HUD/gameplay.

The post-reveal audit proves reference identity and renderer/data-flow parity. A surrogate scene, invisible proxy blade, omitted visible blade primitive, duplicated body, critic-only health value, or geometry that is not the production rendered object fails `T10` and disqualifies.

## 7. Evaluator-owned contact geometry

Candidate hitboxes, collision callbacks, contact labels, event telemetry, and reported hit points are never contact truth. The locked evaluator helper computes contact from the actual rendered sword and target rig. Its exact file bytes and SHA-256 are committed before package access; changing it later voids the round.

### 7.1 Units, basis, and numeric policy

- World units are metres; Y is world up; all sampled positions are IEEE-754 binary64 world coordinates after current morph, skin, and `matrixWorld` transforms.
- The canonical pre-tick-0 basis is `up=(0,1,0)`, `forward=normalizeXZ(targetRoot-heroRoot)`, and `right=normalize(cross(up,forward))`. A horizontal root separation below `0.25 m` or degenerate basis fails.
- Geometry calculations use binary64 without intermediate decimal rounding. Reported positions/distances are quantized only for receipts to signed integer micrometres, using round-half-away-from-zero.
- Contact comparison epsilon is exactly `EPS = 0.000001 m`.
- Blade capsule radius is exactly `R_BLADE = 0.020000 m`.
- Per-tick sweep subdivision count is exactly `SUBSTEPS = 4096`.

### 7.2 Guard/tip extraction from the rendered blade

For every scored tick, the evaluator updates the actual scene matrices and collects each unique current deformed vertex referenced by an included opaque blade triangle exactly once per `(mesh UUID, vertex index)`. Active morphing, skinning, object transforms, draw range, geometry groups, material visibility, side/culling, and `visible/layers` state are honored. A blade material must be visible with effective opacity at least 0.95; an instanced, shader-displaced, or GPU-deformed blade that the helper cannot reproduce exactly fails instead of using a proxy.

From these world vertices:

1. Compute centroid and population covariance.
2. Compute the principal eigenvector with the evaluator helper's fixed binary64 symmetric-Jacobi routine: 64 sweeps in repeating pivot order `xy`, `xz`, `yz`, identity eigenvectors initially.
3. Require largest/second eigenvalue ratio at least 4.0; otherwise blade-axis extraction is ambiguous and fails.
4. Project all vertices on the principal axis. The two axial endpoints are `centroid + axis * minProjection` and `centroid + axis * maxProjection`.
5. Let grip be the midpoint of the actual rendered left/right hand-bone origins. The endpoint nearer grip is `guard`; the farther endpoint is `tip`. A distance tie within `EPS` fails.

The guard-tip length must be `0.65–1.80 m`; the maximum vertex distance from the axis must be at most `0.14 m`; both endpoints must project within 2 DPR1 pixels of the corresponding visible opaque blade silhouette endpoints. These bounds reject a hilt/body-inclusive or invisible oversized primitive. The evaluator's guard-tip segment, expanded only by `R_BLADE`, is the blade capsule.

### 7.3 Evaluator target capsules

Let `h` be the Y extent of the actual opaque target skinned-mesh union at canonical tick 0. Require `1.55 <= h <= 2.20 m`. Bone points are actual current world origins. The evaluator constructs this union, with IDs sorted exactly as listed:

| Capsule ID | Segment endpoints | Radius |
|---|---|---:|
| `head` | neck to head | `0.080 * h` |
| `torso` | pelvis to neck | `0.115 * h` |
| `left-upper-arm` | left shoulder to left elbow | `0.050 * h` |
| `left-forearm` | left elbow to left wrist | `0.040 * h` |
| `right-upper-arm` | right shoulder to right elbow | `0.050 * h` |
| `right-forearm` | right elbow to right wrist | `0.040 * h` |
| `left-thigh` | left hip to left knee | `0.060 * h` |
| `left-shin` | left knee to left ankle | `0.047 * h` |
| `right-thigh` | right hip to right knee | `0.060 * h` |
| `right-shin` | right knee to right ankle | `0.047 * h` |

Missing, duplicate, non-finite, detached, or non-render-driving landmarks fail. Capsule dimensions are evaluator constants; candidate collision volumes do not affect them.

### 7.4 Swept-contact algorithm

For interval `[N-1,N]`, linearly interpolate guard, tip, and every target-capsule endpoint at `tau=j/4096` for every integer `j=1..4096`. For each sample and target capsule `k`, compute the standard clamped closest distance between its two finite line segments. Define:

```text
separation(N,j,k) = segmentDistance(bladeAxis, targetAxis[k])
                    - (R_BLADE + targetRadius[k])
```

The evaluator helper locks the parallel/zero-length segment implementation and its SHA-256; NaN, Infinity, or an unresolved numeric branch fails. A sample contacts when `separation <= EPS`. Tick `H` is the smallest `N` in `0..80` with any contact sample; ties use lowest `j`, then raw UTF-8 capsule ID. State separation at tick `N` is the minimum value at `j=4096`.

Canonical contact passes geometry only when all are true:

- no interval 0–45 contacts;
- state separation at tick 44 is at least `0.080000 m`;
- state separation at tick 45 is at least `0.030000 m`;
- `H === 46`;
- tick-46 state separation is in `[-0.005000 m, EPS]`;
- no substep penetrates deeper than `-0.010000 m`;
- tick-48 state separation is at least `0.030000 m`; and
- no second rising contact occurs through tick 80.

### 7.5 Native-resolution visible topology

World capsule contact is necessary but cannot establish visible contact by itself. At ticks 44–48 the evaluator software-rasterizes the actual current blade and target triangles through the actual production camera into separate `1600x900` DPR1 binary masks. It uses pixel-center sampling, the production projection/view matrices, near-plane clipping, material side/culling, current deformed vertices, and a per-object depth buffer. No candidate diagnostic render is used.

At exact tick 46:

- minimum blade-mask to target exterior distance is at most 2 pixels;
- blade/target mask overlap is at most 0.25% of target-mask area;
- every overlapping blade pixel is at most 3 pixels inside the target mask's Euclidean distance transform; and
- the unannotated production screenshot itself shows one localized near-exterior blade/body contact, with blade and target separately legible and no visible standoff, impalement, far-side emergence, or effect-hidden topology.

At tick 45 mask-to-mask distance is at least 3 pixels. Ticks 44–48 must show a continuous approach/contact/departure without a camera cut, pose swap, teleport, one-frame weapon appearance, or topology hidden by baseline effects. Software masks are supplemental evidence; they can expose a failure but cannot rescue an unconvincing production frame.

## 8. Evaluator-selected hit and miss offsets

Offsets are translations of the complete target entity in the canonical right/up/forward basis and are supplied as integer micrometres before tick 0. Candidate code may not branch on their values.

After the first canonical trace, obtain the canonical closest points at the first contact substep. Define `n` as the normalized vector from the closest target-axis point toward the closest blade-axis point. Define horizontal tangent `t=normalize(cross(up,n))`; if its norm is below `1e-6`, use canonical `right`.

The private counterfactual seed generates three pairs `(a_i,b_i)` using
`SHA256(UTF8("P30R012A/hit-offset/v1") || 0x00 || seed32 || UINT32_BE(i))`, decoded with unbiased rejection sampling:

- `a_i` is an integer inward displacement uniformly in `[2000,6000]` micrometres;
- `b_i` is an integer tangent magnitude uniformly in `[6000,14000]` micrometres; and
- tangent signs are `-1,0,+1` for `i=0,1,2` respectively (`b_1` is ignored).

Each hit offset is `a_i*n + sign_i*b_i*t`, converted into canonical-basis integer micrometres with round-half-away-from-zero. Each is run once with `MOUSE2_TAP`. All three must independently yield evaluator `H=46`, one damage mutation at 46, health 75, maximum penetration no deeper than `-0.012000 m`, and visible topology satisfying section 7.5. Failure to tolerate one selected hit offset fails `T6`; offsets are not regenerated.

For two miss traces, the evaluator derives guaranteed separating translations from the already captured canonical trajectories. Across every tick/substep, project both blade-axis endpoints expanded by `R_BLADE` and every target-capsule endpoint expanded by its radius onto canonical `right`. Let their union extrema be `Bmin`, `Bmax`, `Tmin`, and `Tmax`. The exact positive-direction magnitude is `ceilMicrometres(max(0, Bmax - Tmin + 0.250000))`; the negative-direction magnitude is `ceilMicrometres(max(0, Tmax - Bmin + 0.250000))`. Add an independently seed-derived integer pad uniformly in `[0,20000]` micrometres to each magnitude. A magnitude over `2000000` micrometres fails fixture geometry. Each resulting offset is run once and must retain at least `0.250000 m` evaluator clearance, health 100, zero hit/damage/contact event, no target reaction/recoil, and target drift relative to its translated baseline of at most `0.010000 m` through tick 80.

The counterfactual seed, generated before package access, is disclosed only after the alias-only score seal. A candidate-specific fixture/query branch, offset comparison, inflated collision proxy, unconditional damage, or collision result that disagrees with evaluator geometry fails `T6` and `T10`.

## 9. Exact objective gates

### O1 — real distinct heavy branch and input causality

Mouse2 and `KeyK` each produce exactly one trusted rising edge at tick 24, enter the same heavy action on that update, remain a heavy action through at least tick 58, and first return to visually/motionally neutral in the inclusive range 70–76. No Mouse1/light activation occurs. Held Mouse2 does not repeat, charge, or delay. `NO_HEAVY` produces no heavy action. Browser context-menu suppression passes section 5.3.

A label or state name is not proof. Actual rendered bone, silhouette, and weapon-path requirements in O4 control.

### O2 — evaluator-owned exact visible contact

Every canonical Mouse2/`KeyK`/held cold or reset replay has `H=46` and passes every world and native-resolution condition in section 7. Tick 46 is the exact unannotated visible contact frame. Contact at 45 or 47 is a failure, not a tolerance pass. Candidate hit telemetry may corroborate but cannot define or rescue contact.

### O3 — one authoritative 25-damage mutation at the same tick

The actual production health store is integer 100 at pre-state `-1` and every end-of-tick state 0–45. During update 46 it performs exactly one ordered mutation `100 -> 75`, amount 25, caused by this heavy action's evaluator-confirmed contact. End-of-tick health is 75 at 46 and remains 75 through tick 80 and a subsequent 10 seconds of normal rendering.

Exactly one unique damage event records absolute tick 46 and heavy-relative tick 22. No transient other health value, pre-damage, duplicate damage, heal-back, neighbor-tick event, HUD/store disagreement, target replacement, shadow critic health, or damage without evaluator contact is allowed. KeyK, held, shifted, and hit-offset traces follow the same rule at their geometry-derived contact tick. No-heavy and miss traces stay exactly 100 with zero contact/hit/damage event.

### O4 — rendered motion is materially distinct from light

Run the candidate heavy and preserved light tapes from identical reset state. Evaluator samples actual parent-relative bone quaternions for these 14 rendered joints:

`pelvis`, `spine`, `chest`, `neck`, left/right `upperArm`, `lowerArm`, `hand`, `upperLeg`, and `lowerLeg`.

Compare 35 uniformly spaced normalized phase samples: heavy ticks 24–58 against light ticks 24–41, using shortest-arc quaternion slerp and root-local positions. For each joint, angular difference is `2*acos(clamp(abs(dot(qHeavy,qLight)),0,1))`. Align weapon paths only by the hero's tick-24 root translation and yaw; do not scale or non-rigidly fit.

All must pass:

- at least 8 of 14 joints have phase RMS angular difference at least 12 degrees;
- median RMS angular difference across all 14 is at least 10 degrees;
- mean guard/tip path difference is at least `0.250000 m` and maximum is at least `0.450000 m`;
- at matched normalized phases 0.25, 0.55, and 0.85, software-rasterized attacker-plus-weapon silhouette IoU is at most 0.78 on at least two phases; and
- the critic, without labels or timing knowledge, reads the heavy as a higher-commitment whole-body attack rather than a slowed, delayed, renamed, zero-weight, or slightly perturbed light strike.

A retimed light clip, zero-effective-weight named heavy clip, root/camera-only difference, hidden animation, or capture-only pose fails.

### O5 — anticipation, follow-through, and continuous recovery

The full unannotated sequence controls this gate:

- tick 44: unmistakable loaded heavy anticipation, planted base, readable sword silhouette, at least `0.080000 m` evaluator clearance, and continuous target-directed intent;
- tick 46: visible exterior contact plus full-body attacker weight transfer, without relying on new Round012-A victim reaction, new VFX, camera impulse, labels, or audio;
- tick 58: clearly distinct same-action follow-through with no idle snap or new wind-up; and
- ticks 58–76: continuous recovery into neutral, with no per-tick joint rotation over 12 degrees, root displacement over `0.120000 m`, tip displacement over `0.250000 m`, pose teleport, foot skate over `0.080000 m` while planted, reverse swing, or action re-entry.

The first neutral match must occur from tick 70 through 76. A neutral match means root speed at most `0.05 m/s`, weapon-tip speed at most `0.10 m/s`, median major-joint angular difference from the candidate's frozen neutral pose at most 3 degrees, and attacker-plus-weapon silhouette IoU at least 0.97 for three consecutive ticks.

## 10. Captures, private reference matching, and blind ballots

### 10.1 Required evidence

For each canonical cold/reset replay, capture full unmodified `1600x900` frames at every absolute tick 20–80. Required focused frames are 44, 46, and 58. Also retain:

- full-frame strips 40–46, 44–48, and 46–76;
- a 1:1 no-resampling tick-46 contact ROI centered on the evaluator contact, while the full frame remains controlling;
- a frozen 16:9 action crop derived once from the tick-46 union of complete hero, weapon, and target projected bounds, expanded by 15% and enlarged as necessary so no foot, blade, target contour, HUD state, or camera defect is hidden;
- a lossless uncut tick-0–80 60 fps frame sequence/video; and
- equivalent state/event/geometry/frame evidence for KeyK, held, no-heavy, light, shifted, capture-unarmed, and all hit/miss traces.

No debug overlay, alternate render, post-capture crop beyond the locked boards, rescale beyond equal board placement, color adjustment, denoise, sharpening, frame interpolation, relight, masking of production defects, or selective replacement is allowed. Geometry/mask overlays are separate labeled diagnostics and never substitute for production frames.

Every PNG, frame, clip, board, receipt, log, and derived artifact records byte count and SHA-256 in `EVIDENCE_MANIFEST.json`, with alias, package/output digest, route, run/profile ID, absolute/heavy-relative tick, state digest, camera digest, input-trace digest, evaluator-helper digest, browser/GPU strings, and capture timestamp. Supplied reference pixels remain private and never enter Git or user-visible artifacts.

### 10.2 Reference selection commitment

Before candidate access, the curator selects exactly three supplied-reference views by phase:

- `R1_ANTICIPATION`: clearest high-commitment loaded sword anticipation;
- `R2_CONTACT`: clearest localized visible weapon/body contact and whole-body force transfer; and
- `R3_FOLLOW_THROUGH`: clearest same-action heavy follow-through/recovery silhouette.

Selection first prioritizes phase, then nearest camera yaw/pitch, actor screen-height ratio, contact-plane exposure, and environment depth to the frozen baseline camera. For each selection, the private BCJ-v1 document records source archive/file hash, original dimensions, crop rectangle in original integer pixels, uniform scale algorithm, and phase rationale. Only crop and uniform scale are allowed; no mirror, warp, relight, grade, blur, redraw, interpolation, or content removal.

With a fresh 32-byte reference salt:

```text
referenceCommit = SHA256(
  UTF8("P30R012A/reference-selection/v1") || 0x00 ||
  UINT64_BE(length(BCJ(selectionDocument))) || BCJ(selectionDocument) ||
  0x00 || raw_reference_salt_32_bytes
)
```

The public reference commitment and archive hash are fixed before package access. Selection document/salt stay private through score seal and are disclosed in the final audit without publishing pixels.

### 10.3 Three candidate-versus-reference ballots

For each candidate, ballot sides are anonymous `LEFT` and `RIGHT`; no alias, filename, metadata, stable ordering, art label, or source label is visible. Side order is independently derived from the pre-access presentation seed and ballot ID, using hidden tokens `<opaque-alias>` and `reference/<R-ID>`. Boards use identical dimensions, background, padding, crop/scale algorithm, labels, HUD policy, and pixel interpolation.

- `R1`: candidate tick-44 full frame/action crop versus `R1_ANTICIPATION`; choose the more convincing heavy anticipation, whole-body load, silhouette, and target-directed intent.
- `R2`: candidate tick-46 full frame/contact ROI versus `R2_CONTACT`; choose the more convincing visible exterior contact, weapon/body topology, attacker force transfer, and readability without relying on effects.
- `R3`: candidate tick-58 full frame/action crop versus `R3_FOLLOW_THROUGH`; choose the more convincing same-action momentum, anatomy, grounding, weapon path, and authored follow-through.

Each ballot is cast exactly once in ID order. `tie-or-unclear` has `winner:null` and is not a candidate win. Acceptance requires the candidate to win all three. A textual score cannot override a ballot loss.

### 10.4 Candidate-versus-candidate ballots

Three additional anonymous pairwise ballots `P1`, `P2`, and `P3` use the same candidate evidence and criteria as R1/R2/R3. Independently randomized side order is required per ballot. These ballots select the stronger checkpoint but are not an acceptance substitute; a candidate may beat the other candidate and still lose to the reference.

The ballot compositor discloses only board IDs and anonymous sides until all nine decisions (six candidate-versus-reference and three candidate-versus-candidate) are immutable. Its order manifest and all private boards are hashed and included in evidence custody.

## 11. Absolute visual rubric and deterministic selection

Each category is an integer `0–10`; no half-points.

- `10`: immediately convincing at the supplied production-game bar with no visible defect in this criterion.
- `9`: fully convincing, with exactly one minor non-semantic defect.
- `8`: clear visible shortfall from the reference bar.
- `7` or below: major or structural miss.

Categories:

1. `C1` tick-44 heavy anticipation: planted load, compression, intent, and instantly readable silhouette.
2. `C2` whole-body mass: hips/spine/shoulders/hands/feet cooperate rather than arms-only motion.
3. `C3` visible sword path: authored arc, spatial clarity, continuity, and no teleport/intersection.
4. `C4` tick-46 contact topology: localized exterior contact with neither standoff nor penetration.
5. `C5` attacker force transfer: exact-contact weight and anatomy without depending on new reaction/FX/camera/audio.
6. `C6` heavy-versus-light distinctness: unmistakably different motion language, trajectory, timing, and commitment.
7. `C7` pre-contact continuity: one coherent acceleration phrase from rising edge through exact contact.
8. `C8` tick-58 follow-through: same-direction momentum, grounded overshoot, and distinct pose craft.
9. `C9` recovery polish: continuous authored recovery with no snap, skate, re-cock, or dead interval.
10. `C10` reference-level branch cohesion: the heavy animation/contact reads as finished production work inside the frozen game presentation.

For each rejected alias, the score contains exactly one sentence:

> Biggest remaining gap: [one observable defect] at [one tick or transition], which [one reference-level consequence].

Do not join multiple defects, use a semicolon, mention implementation guesses, or list runners-up. Ties resolve in this order: disqualifier/T-gate, O2/C4, O3, O4/C6, O5/C1, C5, C3, C8, C9, C10.

The final verdict recommends one checkpoint using this immutable order:

1. accepted over rejected;
2. more passed objective/technical gates;
3. more reference wins;
4. higher visual total;
5. higher minimum category;
6. more P1–P3 wins;
7. raw UTF-8 lexicographically lower opaque alias.

The last tie-break uses a random alias and conveys no builder rank. Recommendation of a rejected checkpoint must say `NO ACCEPTED CANDIDATE` and never relabel it accepted.

## 12. Technical gates T1–T10

### T1 — immutable package and exact source identity

Before execution, archive byte count/SHA-256, extracted bytewise tree, interface shape, protocol/baseline hashes, alias, and production-output digest match the public package commitment. Package contents are immutable and identity-free.

After score seal/reveal, the salted map verifies; alias maps to the exact tested archive/tree; source commit and Git tree exist; a new clean detached LFS-materialized checkout matches the revealed source/package tree byte-for-byte; and a repeat clean Node 24 build matches the precommitted output tree. Before reveal, only `T1.preAccessPackage` can pass and `T1.finalSourceParity` is `pending-reveal`.

### T2 — clean install, real tests, optimized build

In an evaluator-owned fresh copy with no `node_modules`, output, or caches:

```text
npm ci --audit=false --fund=false
npm run test:critic
npm run build:critic
npm run serve:critic -- --host 127.0.0.1 --port <random-port>
```

Node major 24 is mandatory. Tests must collect real tests and report zero failures. Build is optimized production output. Serve honors host/port and serves only that output. Lockfile/source/interface remain unchanged. A dev/HMR build, missing/skipped test, network runtime dependency, repaired install, source map/identity clue, warning indicating fallback/correctness risk, or command workaround fails.

### T3 — normal production route and clean hardware WebGL2 boot

Both fresh profiles reach a playable first frame at section-4 dimensions with one intended canvas/HUD, hardware WebGL2, normal production assets, and no fallback. Record GL version, GLSL, vendor, unmasked renderer, browser, OS, and asset tier. Zero page errors, uncaught exceptions, unhandled rejections, console errors, failed essential requests, HTTP 4xx/5xx, shader errors, missing assets, blank/black/frozen frames, duplicate canvas/HUD, or unexpected context loss are allowed.

### T4 — two cold loads plus one reset are deterministic

Use two truly fresh persistent user-data directories and separate headed browser processes. Run one canonical armed Mouse2 trace in cold profile 1 and cold profile 2. In profile 2, then perform one in-page `resetAndPause` and repeat the canonical trace.

Across these three required executions:

- quantized authoritative/combat/geometry state digests at every tick 0–80 are bit-identical;
- input, action, contact, damage, health, camera, and transition logs are bit-identical;
- corresponding full frames 44/46/58 have SSIM at least 0.995 and perceptual-hash Hamming distance at most 2;
- no semantic pose, silhouette, topology, HUD, lighting, camera, or asset difference exists; and
- reset creates no listener, canvas, context, RAF, HUD, audio graph, worker, health entity, or input subscription growth.

There is one execution per required trace. No retry-until-favorable behavior is allowed. A helper/environment defect proven independent of candidate bytes before any candidate judgment invalidates the entire round and requires a new numbered round or pre-access recommit; a candidate-specific timeout/readiness/tick failure counts as failure.

### T5 — exact input parity and edge behavior

Mouse2 tap, KeyK tap, and Mouse2 held satisfy sections 5 and 9 with exactly one rising edge/action/contact/damage; no native context menu or pointer-lock rejection occurs. After normalizing raw device fields, Mouse2/KeyK combat state and rendered focused frames meet T4 equality thresholds. No-heavy is pure. Lost focus, stuck input, repeated held action, light fallback, direct method input, or a duplicated listener fails.

### T6 — evaluator counterfactual geometry and damage parity

All three hidden hit offsets and both derived miss offsets pass section 8. Candidate collision/damage agrees exactly with evaluator contact classification and tick. Oversized/invisible hitboxes, query-specific collision, unconditional damage, offset branching, or target drift fails.

### T7 — `+7` causality and capture invariance

In `SHIFT_PLUS_7`, relative combat state/event/geometry digests from heavy-relative tick 0 through 56 equal canonical after substituting absolute tick `N+7`; contact/damage occur at absolute 53 and nowhere else. Ambient absolute-time fields are excluded only if enumerated in the baseline receipt and proven not to affect combat/rendered actors.

`CAPTURE_UNARMED` arms only terminal tick 80, never ticks 44/46/58. It must have the same per-tick state/event/geometry/framebuffer-digest history and terminal production screenshot as the focused-armed canonical trace. The framebuffer digest is evaluator code reading the actual completed production framebuffer after each render; it does not pause or ask candidate code to report pixels. Arming may only pause after a completed render; it may not select a pose, collision, health result, camera, LOD, effect, or screenshot-only branch. Any absolute-global-tick scripting or armed-state difference fails.

### T8 — baseline regression and scope fidelity

Candidate `NO_HEAVY` and `LIGHT_BASELINE` receipts match the baseline golden state/event/camera digests at every declared tick. Neutral and light focused frames meet SSIM `>=0.995`, pHash distance `<=2`, and no semantic difference. Camera, target behavior, health outside heavy damage, environment, materials, lighting, HUD, effects, audio, asset tier, and lifecycle remain frozen. Source diff is confined to the allowed section-1 scope.

### T9 — evidence, reference, and score-chain integrity

All required evaluator-created evidence exists, is byte/hash manifested, comes from the actual production route, and has complete tick/input/state/camera/runtime/helper provenance. Candidate and reference boards use committed selections and seed orders with no identity clue or supplied pixels in public artifacts. Ballots are cast once. Package/output hashes remain unchanged after capture. BCJ score bytes, score salt, commitment, and Git score commit exist before reveal. Any missing artifact, post-capture manipulation, reference-selection change, identity leak, hash mismatch, or score mutation fails and disqualifies.

### T10 — post-reveal source/provenance and cheat audit

After the alias-only seal, inspect the exact revealed source and production data flow. All must pass:

- geometry refs are the actual visible objects passed through the exact scene/camera rendered on scored frames;
- blade groups are all and only the opaque visible blade, with no hidden/oversized proxy;
- target landmarks drive the actual rendered skin and configured offsets move render/collision/health entity together;
- health reads/mutations use the one production store consumed by gameplay and HUD;
- heavy input uses normal trusted event handling and collision/damage does not query critic hook, capture state, route/query, alias, profile, screenshot timing, absolute global tick, offset values, or evaluator secrets;
- no capture-frame-only pose, reported-clock-only event, heal-after-damage, zero-weight clip, renamed/retimed light, camera/world motion masquerading as weapon/body motion, pre-rendered content, evaluator-specific branch, or fake telemetry exists;
- disabling only the read-only hook leaves ordinary player Mouse2/KeyK behavior mechanically and visually identical; and
- the source diff obeys the section-1 scope and reproducibly builds the exact scored output.

Before reveal this gate is `pending-reveal`. A source/provenance failure cannot change the frozen visual score; it changes final acceptance to false and is the highest-priority biggest remaining gap only if its observable consequence was already recorded alias-blind.

## 13. Hashes, commitments, and package custody

All SHA-256 values are lowercase hexadecimal. Raw digests in framed hashes are 32 bytes, not hex text. Text is NFC UTF-8; sorting uses raw UTF-8 byte order. `UINT32_BE` and `UINT64_BE` are unsigned big-endian integers.

BCJ-v1 permits only null, booleans, NFC strings, safe signed integers, arrays, and plain objects. Decimal measurements are strings. Object keys sort by raw UTF-8 bytes. No floats, exponents, duplicate keys, insignificant whitespace, negative zero, NaN, or Infinity are allowed.

Package/source/output trees use domain `P30R012A/package-tree/v1`. Enumerate every regular file by normalized POSIX relative path sorted by raw UTF-8 bytes; ignore empty directories; reject symlinks, hard-link aliases, traversal, special entries, non-NFC paths, backslashes, case collisions, and mutation during hashing. For `N` files:

```text
SHA256(
  UTF8("P30R012A/package-tree/v1") || 0x00 || UINT64_BE(N) ||
  for each sorted file:
    UINT32_BE(pathByteLength) || pathUTF8 ||
    UINT32_BE(posixModeAnd0777) ||
    UINT64_BE(fileByteLength) ||
    raw_SHA256(fileBytes)
)
```

The exact tree/evaluator helper bytes and SHA-256 are included in the public round commitment.

The pre-access seed commitments are:

```text
presentationCommit = SHA256(
  UTF8("P30R012A/presentation-seed/v1") || 0x00 ||
  raw_presentation_seed_32_bytes
)

counterfactualCommit = SHA256(
  UTF8("P30R012A/counterfactual-seed/v1") || 0x00 ||
  raw_counterfactual_seed_32_bytes
)
```

`ROUND_COMMITMENT.json` records schema `p30.r012a.round-commitment.v1`, protocol ID/raw-file hash, baseline-receipt hash, presentation/counterfactual commitments, reference commitment, tree-helper hash, evaluator-helper hash, and `criticCandidateAccess=false`. It is committed before critic package access; a missing value prevents access.

Presentation order for item ID `B` is:

```text
orderDigest = SHA256(
  UTF8("P30R012A/presentation-order/v1") || 0x00 ||
  raw_presentation_seed_32_bytes || 0x00 || UTF8(B)
)
```

For a two-side ballot, low bit 0 places the UTF-8-lower opaque side token left; bit 1 places it right. Candidate execution priority uses the same domain with item ID `execution/<alias>` and ascending raw digest. Ballot IDs are `R1/<alias>`, `R2/<alias>`, `R3/<alias>`, `P1`, `P2`, `P3`.

Packaging authority's hidden BCJ map binds each alias to builder identity, worktree, branch, full source commit, Git tree, source/package archive hash and bytes, materialized source/package/output tree digests, lockfile, and build command. Its commitment is:

```text
mapCommit = SHA256(
  UTF8("P30R012A/package-map/v1") || 0x00 ||
  UINT64_BE(length(BCJ(mapDocument))) || BCJ(mapDocument) ||
  0x00 || raw_map_salt_32_bytes
)
```

After alias-only judgments are final, score commitment is:

```text
scoreCommit = SHA256(
  UTF8("P30R012A/alias-score/v1") || 0x00 ||
  UINT64_BE(length(BCJ(scoreDocument))) || BCJ(scoreDocument) ||
  0x00 || raw_score_salt_32_bytes
)
```

Exactly two packages are delivered as `candidate-[0-9a-f]{16}`. They contain no `.git`, source maps, builder evidence, author/branch/path/approach labels, logs, screenshots, badges, or identity clue. The package is self-contained after `npm ci`, does not depend on a sibling checkout/service, and is never patched by the critic. Public receipts bind exact archives/trees before access; the private map/salt remains withheld through score seal.

## 14. Machine-readable score and final verdict

`ALIAS_ONLY_SCORE.json` is restricted BCJ-v1 JSON and contains exactly these top-level keys:

```json
{
  "schema": "p30.r012a.alias-score.v1",
  "protocolID": "P30-R012A-BLIND-v1",
  "protocolPayloadSha256": "<hex>",
  "baselineReceiptSha256": "<hex>",
  "roundCommitmentSha256": "<hex>",
  "referenceCommit": "<hex>",
  "packageMapCommit": "<hex>",
  "identityRevealReceived": false,
  "runtime": {},
  "executionOrder": [],
  "candidates": [],
  "pairwiseBallots": [],
  "strongerAlias": "candidate-0000000000000000",
  "provisionalOutcome": "NO_ACCEPTED_CANDIDATE",
  "evidenceManifestSha256": "<hex>",
  "blindOrderManifestSha256": "<hex>",
  "disqualifiers": []
}
```

`runtime` records every actual version/path/hash/launch argument required by sections 4 and 10. `candidates` is sorted by raw UTF-8 alias bytes. Each candidate object contains, in this order:

- alias and verified archive/tree/output hashes;
- per-run/profile IDs and input/state/event/camera/geometry/frame manifest hashes;
- exact world/pixel contact measurements, H, health series/mutations, input edges, context-menu evidence, offset values/results, distinctness metrics, recovery metrics, and baseline comparisons;
- `O1..O5` and `T1..T10`, each with `pass` (`true`, `false`, or `"pending-reveal"` where allowed), evidence hashes, and one concrete reason;
- three reference ballots with anonymous side order, one-cast outcome, and candidate win count;
- integer `C1..C10` scores/reasons, total, and minimum;
- every conjunctive acceptance check and `provisionallyAccepted` boolean; and
- exactly one `biggestRemainingGap` sentence when rejected, otherwise null.

Unknown, unavailable, omitted, malformed, or non-finite required evidence is a failed gate, never null-as-pass. `provisionalOutcome` is `PROVISIONAL_ACCEPTED_CANDIDATE_EXISTS` only if at least one alias satisfies every currently decidable condition with T1-final/T10 pending; otherwise it is exactly `NO_ACCEPTED_CANDIDATE`.

After reveal, `FINAL_VERDICT.json` is a separate immutable BCJ-v1 file with exactly these top-level keys:

```json
{
  "schema": "p30.r012a.final-verdict.v1",
  "protocolID": "P30-R012A-BLIND-v1",
  "aliasScoreFileSha256": "<hex>",
  "aliasScoreCommit": "<hex>",
  "aliasScoreGitCommit": "<40 hex>",
  "mapVerified": true,
  "referenceSelectionVerified": true,
  "presentationSeedVerified": true,
  "counterfactualSeedVerified": true,
  "scoreSaltVerified": true,
  "candidates": [],
  "acceptedAliases": [],
  "selectedCheckpoint": "candidate-0000000000000000",
  "outcome": "NO_ACCEPTED_CANDIDATE",
  "finalEvidenceManifestSha256": "<hex>",
  "disqualifiers": []
}
```

Each final candidate entry adds revealed identity/branch/source commit/tree, exact parity results, T1-final, T10, final `accepted`, and repeats the immutable alias-only acceptance inputs by hash rather than editing them. `outcome` is exactly `ACCEPTED_CANDIDATE_EXISTS`, `NO_ACCEPTED_CANDIDATE`, or `ROUND_VOID`. `selectedCheckpoint` follows section 11 and remains populated for a non-void rejected round; it is null only for `ROUND_VOID`.

## 15. Disqualifiers and no-amendment rule

Candidate-level disqualifiers include procedural/static/screenshot/video fallback; non-production or alternate route; software/WebGL1/2D fallback; missing/fallback assets; broken/direct input; package/source/output mismatch; surrogate geometry or health; invisible/oversized contact proxy; capture-only mutation; reference/evaluator/offset/global-tick branch; evidence manipulation; or any T-gate condition explicitly marked disqualifying.

Round-level disqualifiers include identity/source/approach leak before score seal; alias carrying identity; map/package/reference/presentation/counterfactual commitment mismatch; critic source inspection before reveal; reference-pixel republication; seed/salt disclosure before seal; helper/protocol/reference change after candidate access; ballot/score mutation; reveal before score Git commit; or unequal candidate treatment.

After this file is committed, no substantive amendment is permitted. Missing baseline values are filled only through the predeclared `BASELINE_RECEIPT.json`; that receipt may not alter a threshold, tick, algorithm, trace, ballot, schema, or acceptance rule. The evaluator-helper implementation and commitments are fixed before package access. If a contradiction or material ambiguity is later discovered, Round012-A is void and a new numbered protocol is required. Candidate inconvenience, unsupported counters, likely failure, or poor scores never justify relaxation.

## 16. Frozen constants summary

| Item | Locked value |
|---|---:|
| Fixed simulation delta | `1/60 s` |
| Reset pre-state tick | `-1` |
| Heavy rising edge | absolute `24` |
| Exact first contact/damage | absolute `46`, heavy-relative `22` |
| Shifted rising edge/contact | absolute `31` / `53` |
| Focused captures | absolute `44`, `46`, `58` |
| Terminal deterministic tick | `80` (shifted `87`) |
| Viewport / DPR | `1600x900` / `1` |
| World units / up | metres / `+Y` |
| Blade radius | `0.020000 m` |
| Contact epsilon | `0.000001 m` |
| Sweep substeps per tick | `4096` |
| Tick-45 clearance | `>=0.030000 m` and `>=3 px` |
| Tick-46 state penetration | no deeper than `0.005000 m` |
| Any substep penetration | no deeper than `0.010000 m` |
| Authoritative health | `100 -> 75` once at tick 46 |
| Cold/reset canonical executions | `2 cold + 1 in-page reset` |
| Reference wins | `3/3` |
| Visual acceptance | `>=95/100`, every category `>=9/10` |
