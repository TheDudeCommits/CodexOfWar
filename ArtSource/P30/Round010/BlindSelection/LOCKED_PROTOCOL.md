# P30 Round010 Blind Evaluation Protocol

Status: **LOCKED before candidate access**  
Protocol ID: `P30-R010-BLIND-v1`  
Lock date: `2026-08-02` (`Asia/Bangkok`)  
Map commitment received: `05e35ae720209fceb8a2f9926828f40530dc31f0ad4987ae96fc40ac01268106`  
Presentation commitment: `5ea0ad1d52d8dc8f44042af157c8a9a0e6450a3c2e3d033dcb34367eb123b0eb`  
Presentation commitment formula: `SHA256("P30R010-presentation-v1\\0" || lowercase_hex(seed32))`  
Seed disclosure: withheld until alias-only scoring is sealed.

The critic had not opened, served, hashed, or run either Round010 candidate when this protocol was written. The critic will not inspect candidate source, Git metadata, builder identities, builder branches/worktrees, sibling temporary directories, or builder-produced evidence. Only opaque runtime packages and critic-created evidence are in scope.

## Acceptance is conjunctive

A candidate is accepted only if all conditions pass:

1. Hard objective gates O29, O34, and O41.
2. Technical/runtime gates T1 through T8.
3. All three focused anonymous ballots B1 through B3: `3/3` wins.
4. At least five of all six anonymous ballots B1 through B6: `>=5/6` wins.
5. Absolute visual quality: `>=95/100`.
6. Every visual category: `>=9/10`.

A tie or unclear result is not a win. No gate, ballot, or category can compensate for another failure. If neither candidate clears the conjunction, the result is `NO ACCEPTED CANDIDATE`. There is no "good for WebGL," "good for browser," prototype, or platform allowance. The supplied God of War Ragnarok imagery is the readability and finish bar.

## Hard objective gates

Perceptual reading controls. Telemetry can confirm a success but cannot excuse an image that reads as penetrating, ambiguous, discontinuous, or re-cocked.

### O29 — anticipation continuity at exact tick 29

- Tick 29 is pre-hit: no damage, hit, or target-reaction event has fired.
- The attacker visibly loads the impending strike with grounded base, compressed/torqued hips and shoulders, target-directed intent, and weapon separation from the target of at least 3% of target screen height.
- The signed weapon path from tick 29 through tick 34 moves continuously toward contact: no teleport, pose swap, camera cut, reversal, or already-finished/contact pose.
- Without labels or telemetry, the pose must read as anticipation about to become this strike. Ambiguous preload is a hard failure.

### O34 — narrow exterior contact and causal opponent response at exact tick 34

- The active cutting edge meets one localized point or band on the target's near exterior contour. The weapon body remains visually outside and separately readable.
- An FX-off, depth-valid diagnostic from the identical tick and camera must show all of the following:
  - no blade pixels deeper than a 3-device-pixel inward band of the target ID-mask contour;
  - total blade/target mask overlap no greater than 0.25% of target mask area;
  - physical penetration depth no greater than 0.5% of target height;
  - no blade portion emerging on the target's far side.
- The production frame must itself read as exterior contact.
- Impact-FX core centroid must lie within 6 DPR1 pixels of the geometric contact. FX cannot be the sole evidence of contact or conceal contact topology.
- The same hit event fires exactly once at tick 34, decrements target health exactly once, and initiates a visible target response at that tick. Head, upper torso, or contact-side shoulder must begin displacement/rotation away from the contact along transmitted impulse, with at least 8 degrees of response or at least 1.5% target-height screen displacement relative to tick 29.
- Broad weapon/body overlap, apparent impalement, hidden topology, FX-masked intersection, a static response, a pre-posed response, motion into the blade, or an unrelated response is a hard failure regardless of damage UI.

### O41 — same-direction overshoot and grounded braking at exact tick 41

- Swing sign is defined by the continuous weapon-tip/edge path from tick 29 to tick 34. Every sample from tick 34 through tick 41 retains that sign; no reverse step greater than 2 degrees is allowed.
- By tick 41 the weapon has passed the contact plane by at least 5% of target height and is separated from the target by at least 3% of target height.
- Weapon angular speed at tick 41 is at most 60% of its pre-contact peak. This must read as deceleration/braking, not a new wind-up.
- At least one attacker foot remains in valid ground contact at every tick from 34 through 41. No airborne reset is allowed. Hips, torso, and arms visibly absorb and counter-brace remaining momentum.
- Grip midpoint is at or below the attacker's shoulder line and blade centroid is at or below crown height at tick 41.
- Attack-state re-entry, direction reversal, hands-over-head silhouette, vertical weapon lift, or a new overhead-ready pose is forbidden.
- The unannotated image and tick 34-to-41 clip must read as the same strike continuing and being arrested. Any overhead re-cock reading is a hard failure even if a numeric path barely passes.

## Visual quality rubric — 100 points

Each category is an integer from 0 to 10. No half points.

- `10`: reference-level, immediately convincing, with no visible defect.
- `9`: fully convincing with exactly one minor, non-semantic defect.
- `8`: clear visible shortfall.
- `7` or lower: major or structural miss.

The `>=95` threshold permits at most five categories at 9, with all others at 10, and never permits a category below 9.

1. **C1 Tick 29 anticipation (10):** preload, intent, planted weight, weapon/target separation, and unmistakable continuity toward tick 34.
2. **C2 Tick 34 contact topology (10):** localized exterior edge contact, clean silhouette/occlusion, and zero penetration reading.
3. **C3 Tick 34 causal target response (10):** direction, onset, asymmetry, force transfer, and hit/damage/pose synchronization.
4. **C4 Tick 41 overshoot/braking (10):** same signed continuation, low/side follow-through, grounded deceleration, and no overhead reset.
5. **C5 Tick 29→34→41 continuity/weight (10):** one uninterrupted kinetic phrase, credible arcs, spacing, acceleration, hit-stop, and deceleration; no snap or teleport.
6. **C6 Pose craft/anatomy/silhouette (10):** grips, shoulders, spine, limbs, balance, foot plants, and attacker/target readability without intersections.
7. **C7 Camera/staging/depth (10):** exposed contact plane, stable gameplay camera, readable scale and negative space, no crop or perspective trick hiding defects.
8. **C8 FX/material/lighting hierarchy (10):** localized directional impact cue; trails/sparks support rather than obscure contact; strong weapon/target/environment separation and stable shading.
9. **C9 Reference-level art finish/cohesion (10):** character, weapon, target, environment, scale, texture/material detail, shadows, anti-aliasing, and asset integration judged against supplied reference imagery.
10. **C10 Gameplay presentation/capture integrity (10):** clean 1600x900 frame, coherent HUD/damage state, no debug chrome, placeholders, or capture artifacts, and an authored actual-game reading.

## Six anonymous pairwise ballots

1. **B1 focused:** tick 29 still — clearer, more physically credible anticipation continuity.
2. **B2 focused:** tick 34 still plus identical-tick FX-off diagnostic — clearer narrow exterior contact and causal target response.
3. **B3 focused:** tick 41 still — clearer same-direction grounded braking continuation with no overhead re-cock.
4. **B4:** uncut tick 24-to-34 production clip — stronger startup-to-contact continuity and acceleration.
5. **B5:** uncut tick 34-to-46 production clip — stronger impact-to-overshoot/brake continuity.
6. **B6:** uncut tick 24-to-48 production clip at real time, followed by one fixed 0.25x replay and an equal-scale 29/34/41 triptych — higher overall reference-level combat readability and finish.

Both candidates receive identical crop, scale, playback rate, loop count, audio treatment, camera, HUD mode, seed, input, and timing. Side/order changes per ballot from the precommitted presentation seed. The stronger candidate must win B1 through B3 and at least five of B1 through B6. Ballots do not replace absolute scoring.

## Actual-game capture and technical/runtime gates

### T1 — actual runtime only

The evaluator launches each opaque candidate's normal playable route over HTTP in Chromium and triggers the strike through normal player input. Capture is the live game canvas plus normal HUD. Screenshot pages, separate render scenes or cameras, static composites, post-capture edits, rescaling, and builder-supplied evidence are forbidden. A capture hook may pause an already-running simulation at an exact tick; it may not re-pose or separately re-render the scene.

### T2 — exact browser/display/WebGL2

- Fresh Chromium context.
- CSS viewport and screen: 1600x900.
- `deviceScaleFactor` and `devicePixelRatio`: 1.
- Browser zoom: 100%.
- Final page PNG: exactly 1600x900.
- Runtime assertions: `innerWidth=1600`, `innerHeight=900`, `devicePixelRatio=1`.
- A live `WebGL2RenderingContext`; VERSION reports WebGL 2.0.
- Debug renderer is not SwiftShader/software, WebGL1, or 2D fallback.

### T3 — clean cold boot

Three fully fresh profiles/contexts with cache, cookies, IndexedDB, local/session storage, and service workers cleared. Each reaches the first actionable game state with all required assets loaded. Zero page errors, uncaught exceptions, unhandled rejections, console errors, failed essential requests, HTTP 4xx/5xx, missing assets, shader compile/link errors, or uninduced context loss.

### T4 — exact tick provenance

Attack-input rising edge defines sequence tick 0. Fixed-step simulation captures exact ticks 29, 34, and 41 from one uninterrupted run. Receipt records opaque package SHA-256, build/runtime digest, seed, fixed delta, input trace, tick, camera transform, attacker/weapon/target transforms, hit/damage event log, viewport/DPR/WebGL facts, and PNG SHA-256. No interpolation or resampling.

### T5 — cold determinism

Repeat identical seed and input trace in all three cold contexts. Quantized authoritative state digests at ticks 29, 34, and 41 must be bit-identical; event logs and camera transforms identical; corresponding frames have SSIM at least 0.995 and perceptual-hash Hamming distance at most 2. Any semantic pose/contact divergence fails.

### T6 — 30-second stability

After normal boot, interact continuously for 30 seconds. There must be no black/blank/frozen frame, NaN/Infinity transform, lost input, duplicated HUD/canvas, uncaught error, or animation-heartbeat gap over 500 ms outside an evaluator pause. Gameplay remains controllable and the strike repeatable afterward.

### T7 — forced context recovery

After the 30-second pass, invoke `WEBGL_lose_context`, wait one second, restore, and require a nonblank, correctly lit WebGL2 gameplay frame within five seconds and responsive control within seven seconds. Scene/HUD/health state remains coherent; no duplicate canvas/listener or new error occurs; the objective can be replayed and recaptured. Extension absence, fallback renderer, or manual reload fails.

### T8 — evidence integrity

Only evaluator-created lossless page screenshots/video are accepted. Candidate package hash remains constant; no post-capture modification occurs; each capture and receipt is SHA-256 manifested. Camera, HUD mode, seed, input, and timing are identical between candidates. Any gate failure prevents acceptance, although diagnostic visual scores may still be recorded.

## Opaque candidates and claimed package hashes

- `candidate-ff5ef7c562581ce6`: `935fd54301e890602265e7bec1cd900550c35f1edf7f9b0aa78cebf06833a371`
- `candidate-b42289432d4cc3cb`: `a092b2ddaf419483bb838e61460006be94c751f65308a495967bf60276eb04fe`

Hash algorithm: recursively sort relative file paths; stream `relativePath + NUL + lowercase SHA256(file bytes) + NUL` for every file; SHA-256 the complete stream.

## Blind commit/reveal

The critic receives opaque aliases, package hashes, and the map commitment only. Builder identities and approaches remain unavailable. Ballot order is derived from `SHA256(seed32_bytes || uint32be(ballot_number))`; low bit 0 means the lexicographically first alias appears first, and low bit 1 means the lexicographically second alias appears first.

After testing, the complete alias-only score document includes protocol ID, aliases, verified package hashes, technical gates, objective gates, categories, totals, ballots, capture hashes, pass/fail, stronger alias, and exactly one biggest remaining gap per candidate. A fresh random 32-byte score salt seals it as `SHA256("P30R010-score-v1\\0" || JCS(scoreDoc) || "\\0" || lowercase_hex(scoreSalt))`. The score document and score commitment are committed before identity reveal. Mapping reveal or a commitment mismatch before that point voids the evaluation.

## Exactly one biggest remaining gap

For each candidate, before identity reveal, output exactly one sentence:

> Biggest remaining gap: [single observable defect] at [tick/transition], which [single reference-level consequence].

Choose the defect with the greatest acceptance risk. Ties break in category order `C2 > C4 > C3 > C1 > C5 > C6 > C7 > C8 > C9 > C10`. Do not list runners-up or use compound wording to smuggle in multiple gaps. A passing candidate still names the smallest visible delta from the reference bar.
