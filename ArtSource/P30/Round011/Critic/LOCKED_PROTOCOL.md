# P30 Round011 blind critic protocol

Status: **LOCKED before any Round011 candidate package, source, identity, branch, commit, or builder evidence was available to the critic**  
Protocol ID: `P30-R011-BLIND-v1`  
Baseline: `acfe2f63f59ca4e87d3ca20db9dff225008c3817`  
Lock date: `2026-08-02` (`Asia/Bangkok`)  
Presentation commitment: `5df2ec1607da073c492d94d7f1c47c23606d51b9fdbc267a3ada8d76e853b05f`  
Reference archive SHA-256: `4653a7a92d6f6bde910f39d3190df0adb112677851815443144505b8b420a6dd`

Protocol Amendment 01: **incorporated before package delivery/access**; it corrects capture tick space from attack-relative to absolute scenario time without changing any visual, objective, technical, blind, ballot, or acceptance threshold. See `PROTOCOL_AMENDMENT_01.md`.

The critic is source- and identity-blind. Before the alias-only score is sealed, the critic will not open candidate source, source maps, Git history, candidate commits, builder worktrees/branches, builder messages, builder evidence, or any mapping from an opaque alias to a person, slot, approach, or rank. The only candidate-authored file the critic may inspect is the strictly identity-free `CRITIC_INTERFACE.json` defined in `PACKAGE_INTERFACE.md`. Commands may execute source without the critic browsing it.

The supplied real God of War Ragnarok gameplay screenshots are the production bar. There is no browser, WebGL, prototype, indie, or “good for a web game” allowance.

## 1. Acceptance is conjunctive

A candidate is accepted only when **every** condition below is true:

1. No round-level or candidate-level disqualifier occurred.
2. Objective gates `O29`, `O34`, and `O41` all pass.
3. Technical gates `T1` through `T8` all pass.
4. The candidate wins all three focused blind ballots: `3/3`.
5. The candidate wins at least five of six game-wide blind ballots: `>=5/6`.
6. Absolute visual score is at least `95/100`.
7. Every one of the ten visual category scores is at least `9/10`.

The logical formula is:

```text
ACCEPT = noDisqualifier
  AND O29 AND O34 AND O41
  AND T1 AND T2 AND T3 AND T4 AND T5 AND T6 AND T7 AND T8
  AND focusedWins == 3
  AND overallWins >= 5
  AND visualTotal >= 95
  AND min(categoryScores) >= 9
```

A tie, abstention, or unclear ballot is not a win. One gate cannot compensate for another. At most one candidate can satisfy the pairwise preference gates. If neither clears the full conjunction, the outcome is `NO ACCEPTED CANDIDATE`.

T1 contains a deliberately delayed exact-source-identity subcheck. The alias-only score records immutable observations and a provisional acceptance result with T1 identity parity marked `pending-reveal`. Final acceptance can become true only after the already-committed map is revealed and T1 passes; no visual score, ballot, objective finding, or other technical result may change after reveal.

## 2. Blind sequence and custody

The sequence is mandatory and may not be reordered:

1. Commit this complete protocol, interface, receipts, hash helper, tests, and presentation commitment, including the public pre-access tick-semantics correction in Protocol Amendment 01.
2. Packaging authority creates two random opaque aliases and exact immutable source archives.
3. Before package access, authority commits the visible alias/archive/tree hashes plus a salted hidden identity/source map using section 3 and `PACKAGE_INTERFACE.md` section 5.
4. Critic verifies protocol hash, commitment shape, aliases, archive byte hashes, and bytewise extracted-tree hashes without source browsing.
5. Critic uses the precommitted secret presentation seed to derive candidate execution order and all nine ballot left/right orders. The seed remains undisclosed.
6. Critic performs T2–T8, captures evaluator-owned evidence, constructs anonymous ballots, judges O29/O34/O41, casts all ballots once, and assigns all category scores without identity knowledge.
7. Critic writes the complete alias-only score, generates a fresh random 32-byte score salt, computes the score commitment, validates it, and makes a new Git commit containing the score and score-seal receipt. The score salt stays undisclosed.
8. Only after the score commit SHA and score commitment exist may the authority reveal the identity/source map and map salt.
9. Critic verifies the map, exact commit/tree/LFS-materialized source parity, and reproducible production-output parity for T1. The alias-only score is not edited.
10. Critic publishes a separate identity-aware verification/verdict, reveals the presentation seed and score salt for audit, and commits that final receipt.

Receiving identity, approach, branch, worktree, source commit, or stable candidate labels before step 7 voids the round. A request to alter a score after step 7 voids the round. A mapping or salt mismatch voids the round.

## 3. Byte-exact hashes and commitments

All SHA-256 values are lowercase hexadecimal. Raw digests inside framed hashes are 32 bytes, not hexadecimal text. All text is Unicode NFC UTF-8. Sorting is `Buffer.compare(UTF8(value))`; locale, shell glob, archive order, filesystem enumeration order, and JavaScript property insertion order never determine a hash.

### 3.1 Raw files and archives

Raw file/archive SHA-256 is computed over exact bytes from offset zero through EOF. Archive byte length and digest are recorded before extraction. Repacking changes the archive hash and is not allowed after commitment.

### 3.2 Bytewise tree digest

`tools/protocol-tools.mjs tree ROOT` rejects symlinks and special entries, ignores empty directories, and enumerates every regular file by normalized POSIX relative path sorted by raw UTF-8 bytes. For `N` files:

```text
SHA256(
  UTF8("P30R011/package-tree/v1") || 0x00 || UINT64_BE(N) ||
  for each sorted file:
    UINT32_BE(pathByteLength) || pathUTF8 ||
    UINT32_BE(posixModeAnd0777) ||
    UINT64_BE(fileByteLength) ||
    raw_SHA256(fileBytes)
)
```

The helper records every relative path, mode, byte count, and raw-file digest. A case collision, non-NFC path, traversal, backslash, mutation during hashing, symlink, or special entry fails.

### 3.3 Bytewise Canonical JSON v1 (`BCJ-v1`)

Commit documents use only null, booleans, NFC strings, safe signed integers, arrays, and plain objects. Decimal values are encoded as strings. Object keys are sorted by raw UTF-8 bytes. Output has no insignificant whitespace. Duplicate keys, non-NFC strings, floats, exponents, NaN, Infinity, negative zero, and non-JSON values are forbidden.

### 3.4 Presentation commitment and randomization

The critic generated a cryptographically random 32-byte presentation seed before candidate access and retained it only in the ignored critic-private path. The commitment is:

```text
SHA256(UTF8("P30R011/presentation-seed/v1") || 0x00 || raw_seed_32_bytes)
= 5df2ec1607da073c492d94d7f1c47c23606d51b9fdbc267a3ada8d76e853b05f
```

After exactly two committed aliases exist:

- Candidate execution priority for alias `A` is `SHA256(UTF8("P30R011/execution-order/v1") || 0x00 || seed || 0x00 || UTF8(A))`; lower raw digest runs first.
- For ballot ID `B`, calculate `SHA256(UTF8("P30R011/ballot-order/v1") || 0x00 || seed || 0x00 || UTF8(B))`. If the low bit of byte zero is 0, the UTF-8-lexicographically first alias is left; if 1, the second alias is left.
- Ballot IDs are fixed as `F1`, `F2`, `F3`, `G1`, `G2`, `G3`, `G4`, `G5`, `G6`.

The packaging authority sees only the presentation commitment before it fixes the salted map, so it cannot choose alias identity from the presentation order. The presentation seed is disclosed only after the alias-only score seal.

### 3.5 Salted package/source map commitment

The packaging authority uses a fresh cryptographically random 32-byte map salt and domain `P30R011/package-map/v1`. Exact schema and formula are in `PACKAGE_INTERFACE.md`. Salt and identity-bearing map document remain withheld through score seal. A public receipt binds each alias to archive bytes and tree digest before access.

### 3.6 Salted alias-only score commitment

After all alias-only judgments are final, the critic generates a fresh random 32-byte score salt. With `scoreDocument` parsed under the restricted BCJ model:

```text
scoreCommit = SHA256(
  UTF8("P30R011/alias-score/v1") || 0x00 ||
  UINT64_BE(length(BCJ(scoreDocument))) || BCJ(scoreDocument) ||
  0x00 || raw_score_salt_32_bytes
)
```

The score receipt also records the raw score-file SHA-256, BCJ byte count and SHA-256, protocol payload hash, presentation commitment, package/map commitment, evidence-manifest hashes, and Git commit SHA. The score document and receipt are committed before identity reveal. They are never amended.

## 4. Required production execution

Every visual and runtime judgment comes from actual execution of the candidate's clean production build and normal playable route.

- Browser: headed Google Chrome/Chromium, exact executable and version recorded.
- GPU: hardware acceleration on; WebGL2 via Apple/ANGLE Metal or another explicit physical renderer. SwiftShader, llvmpipe, software rasterization, WebGL1, Canvas2D playfield, pre-rendered video/screenshot, static composite, and fallback renderer are forbidden.
- Display: CSS viewport and screen `1600x900`; `deviceScaleFactor=1`; `devicePixelRatio=1`; zoom 100%; page PNG exactly `1600x900`.
- Profiles: three truly fresh persistent user-data directories and three separate headed browser processes per candidate. Each begins with empty cache, cookies, storage, IndexedDB, service workers, HTTP cache, and shader cache attributable to that profile.
- Build: the T2 production output, served over `http://127.0.0.1:<random-port>` by `serve:critic`. No `file:` URL, dev/HMR server, browser extension, screenshot route, alternate camera, or isolated render page.
- Input: real Playwright keyboard/pointer events through the normal game input path. Direct gameplay method calls are forbidden.
- Capture hook: may seed, fixed-step, pause, resume, and report state only as specified in `PACKAGE_INTERFACE.md`; it may not alter what is posed or rendered.
- Evidence: evaluator-created full-page PNG frames and lossless frame sequences from the live page. Builder evidence is ignored.

The scenario uses two explicit clocks. Deterministic reset/start defines absolute scenario simulation tick `0`. The normal mouse light-strike rising edge is sampled at absolute tick `24`, which is attack-relative tick `0`. `attackRelativeTick` is `null` before that edge and equals `absoluteSimulationTick - 24` from absolute tick 24 onward. Thus focused absolute ticks `29`, `34`, and `41` are attack-relative ticks `5`, `10`, and `17`. Unless the phrase “attack-relative” appears explicitly, every numbered tick and range in this protocol is an **absolute scenario simulation tick**. The capture hook accepts absolute ticks only, and every receipt records both clocks.

The actual run receipt must record Node/npm/browser/automation/CDP/OS/GPU/WebGL/GLSL/ffmpeg/helper versions and hashes. A missing or unverifiable version is a T8 failure.

## 5. Exact objective gates

The full unannotated production frames and continuous neighboring sequence control these gates. Telemetry corroborates; it never excuses a bad visual reading.

### O29 — exact absolute tick 29 / attack-relative tick 5 anticipation continuity

Pass only if all are true:

- Absolute tick 29 (attack-relative tick 5) is before impact: no contact, hit, damage, health change, or target reaction has occurred.
- The active blade edge is visibly separated from the target exterior by at least 3% of target screen height.
- Attacker has a grounded, compressed base; hips/torso/shoulders are visibly loaded; hands and blade show target-directed intent; silhouette reads immediately as anticipation for this light strike.
- Across absolute ticks 27–34, weapon edge, hands, torso, and camera move continuously into the same strike. The signed distance to the eventual exterior contact reduces without a reversal, teleport, camera cut, animation swap, already-complete pose, or one-frame discontinuity.
- Absolute tick 29 must read correctly without labels, telemetry, slow motion, or knowledge of absolute tick 34.

Ambiguous preload, generic idle, already-contacting pose, airborne base, or discontinuity is a hard failure.

### O34 — exact absolute tick 34 / attack-relative tick 10 exterior blade/target contact

Pass only if all are true:

- At absolute tick 34 (attack-relative tick 10), the active cutting edge meets one localized point/band on the target's near exterior contour. The blade body remains outside, separately legible, and does not emerge on the far side.
- There is neither standoff nor penetration. In the original DPR1 pixels, the edge-to-exterior distance at the declared contact is at most 2 pixels, no blade sample is deeper than a 3-pixel antialias/contour tolerance, total blade/target silhouette overlap is at most 0.25% of target silhouette area, and world-space penetration is at most 0.5% of target height.
- Absolute ticks 32, 33, 34, 35, and 36 show one continuous exterior approach/contact/departure. A one-frame snap into or out of the target, pre-contact hit, post-contact embedded blade, standoff hidden by sparks, or tunneling fails.
- Impact effect core, if present, is localized within 6 DPR1 pixels of the geometric contact and does not conceal topology. The unannotated production frame must pass with effects visible; an effects-off diagnostic may expose a failure but cannot rescue the production frame.
- Exactly one hit/damage event fires at absolute tick 34; health decrements exactly once; no hit event fires at a neighboring absolute tick.
- A visible causal target response begins at absolute tick 34, away from the transmitted impulse, with head/upper torso/contact-side shoulder rotation or displacement. A static, pre-posed, symmetric, unrelated, or into-the-blade response fails.

Visible standoff, penetration, impalement, broad body overlap, far-side emergence, FX-masked topology, wrong-tick damage, or non-causal response is a hard failure.

### O41 — exact absolute tick 41 / attack-relative tick 17 low same-direction grounded braking

Define swing sign from the continuous active-edge path from absolute tick 29 to absolute tick 34. Pass only if all are true:

- Every sample from absolute ticks 34–41 retains the same swing sign; no reverse step greater than 2 degrees or attack-state re-entry occurs.
- At absolute tick 41 (attack-relative tick 17) the active edge has passed the contact plane by at least 5% of target height and is separated from the target by at least 3% of target height.
- Weapon angular speed at absolute tick 41 is at most 60% of its pre-contact peak and the shrinking step distances visibly read as braking.
- At least one attacker foot remains in valid ground contact at every absolute tick 34–41. Hips, torso, shoulders, and arms visibly absorb/counter-brace the remaining momentum.
- Grip midpoint is at or below the attacker's shoulder line; blade centroid is at or below crown height; the weapon reads low/sideways rather than lifting into a new overhead-ready pose.
- The unannotated absolute-tick-41 frame and absolute-tick-34–43 clip read as the same strike continuing and being arrested.

Reverse motion, airborne reset, vertical lift, overhead re-cock, hands-over-head silhouette, new wind-up, or ungrounded slide is a hard failure.

## 6. Private reference matching and evaluator boards

The reference archive is used privately under `REFERENCE_RECEIPT.json`; no supplied pixels are republished.

For each candidate, evaluator captures full unmodified `1600x900` frames at every absolute scenario tick 27–43 in all three cold profiles. Focused evaluation uses:

1. Full-frame chronological strips for absolute ticks 27–34, 32–36, and 34–43.
2. A 1:1, no-resampling absolute-tick-34 O34 topology crop centered on the telemetry-declared contact, while retaining the full frame as controlling evidence.
3. A fixed 16:9 action crop derived once from the absolute-tick-34 union of complete attacker, weapon, and target projected bounds, expanded 15% and then enlarged as needed to include every complete silhouette. That crop is frozen for absolute ticks 27–43 and may never hide a foot, blade, target contour, HUD state, or camera defect.
4. A private reference-matched board for O29, O34, and O41. Reference frames are selected by combat phase and nearest camera yaw/pitch, actor screen-height ratio, contact-plane exposure, and environment depth. Only crop and uniform scale are allowed—no mirror, warp, relight, color grade, blur, redraw, interpolation, or content removal.

All candidates use equal board dimensions, padding, scaling algorithm, background, chronology, and labels. Full-frame evidence prevents crop normalization from hiding camera/staging weakness. Private reference boards remain outside Git and user-visible reports; only their hashes and textual conclusions enter receipts.

## 7. Visual rubric — 100 points

Each category is an integer `0–10`; no half-points.

- `10`: immediately convincing at the supplied production-game bar, with no visible defect.
- `9`: fully convincing, with exactly one minor non-semantic defect.
- `8`: a clear visible shortfall from the reference bar.
- `7` or below: a major or structural miss.

The `>=95` threshold permits at most five categories at 9 and all remaining categories at 10. Any category below 9 rejects the candidate regardless of total.

1. **C1 Absolute-tick-29 anticipation:** loaded intent, planted weight, separation, readable silhouette, and continuity toward the exact strike.
2. **C2 Absolute-tick-34 contact topology:** localized exterior edge contact, exposed contour/occlusion, zero standoff/penetration reading, and neighboring-frame continuity.
3. **C3 Absolute-tick-34 causal response:** exact hit/damage timing, directional onset, asymmetry, force transfer, and target reaction.
4. **C4 Absolute-tick-41 follow-through/braking:** low same-direction continuation, grounded arrest, credible deceleration, and no overhead re-cock.
5. **C5 Motion continuity and weight:** one uninterrupted absolute-tick 29→34→41 kinetic phrase with credible path, acceleration, hit-stop, overshoot, and braking.
6. **C6 Pose craft/anatomy/silhouette:** grips, shoulders, spine, limbs, balance, foot plants, target anatomy, and intersection-free combat readability.
7. **C7 Camera/staging/depth:** stable production camera, exposed contact plane, scale, composition, negative space, parallax, environment depth, and no defect-hiding crop.
8. **C8 FX/material/lighting hierarchy:** localized directional effects, trails/sparks that support contact, stable shading, strong material response, and separation of weapon/actors/environment.
9. **C9 Reference-level art finish/cohesion:** character/weapon/target/environment detail, textures, geometry, materials, shadows, anti-aliasing, asset integration, density, and authored polish against the supplied screenshots.
10. **C10 Game-wide production presentation:** coherent HUD, controls, traversal/combat transitions, environment life, capture cleanliness, absence of debug/placeholder chrome, and the unmistakable reading of a finished actual game.

## 8. Nine anonymous pairwise ballots

Ballots show only `LEFT` and `RIGHT`; no alias, filename, path, package hash, UI label, color code, metadata, audio tag, or stable ordering may disclose identity. Side order is independently derived from the committed seed for every ballot. Both sides use identical full-frame/crop treatment, duration, tick range, playback speed, loop count, frame rate, audio policy, HUD mode, scenario, seed, input, and encoding. Ballots are cast once, in ballot-ID order, before aliases are associated with winners in the score document.

### Focused ballots — all `3/3` required

- **F1:** unannotated absolute-tick-29 full frame plus equal absolute-tick-27–34 chronological strip; prefer clearer, more physical anticipation continuity.
- **F2:** unannotated absolute-tick-34 full frame plus 1:1 contact ROI and absolute-tick-32–36 chronological strip; prefer exact exterior contact with neither standoff nor penetration and clearer causal response.
- **F3:** unannotated absolute-tick-41 full frame plus absolute-tick-34–43 chronological strip; prefer low same-direction grounded braking with no re-cock.

### Game-wide ballots — at least `5/6` required

- **G1 still:** three unmodified full gameplay frames at fixed neutral/traversal/combat-approach checkpoints; judge environment, camera, staging, HUD, and authored density.
- **G2 still:** equal full-frame absolute-tick 24/29/34/41/48 combat board; judge holistic animation phrase, silhouettes, effects, and art finish.
- **G3 still:** equal full-frame production frames before loss and five seconds after restore plus a normal post-recovery frame; judge lighting/material/HUD cohesion and presentation integrity, not merely lifecycle pass/fail.
- **G4 clip:** one uncut 10-second live-input approach→movement/camera→light-strike→recovery clip at real time; judge overall gameplay presentation and responsiveness.
- **G5 clip:** exact absolute ticks 24–48 at real time followed once by the same frames at 0.25x; judge continuity, weight, contact clarity, target response, and finish.
- **G6 clip:** one fixed 12-second excerpt from the committed 30-second live-input soak containing traversal, camera input, at least one light strike, and recovery; judge game-wide consistency, environmental life, HUD restraint, and production polish.

Clips are built from evaluator-captured frame sequences. Editing is limited to synchronized side-by-side layout, lossless trim to the predeclared interval, fixed labels, and the specified one-time slow replay. No reframing, selective loop, retiming, stabilization, post effect, or defect concealment is allowed.

## 9. Technical gates T1–T8

Every applicable subcheck must pass in every one of the three cold profiles. One profile failure fails the gate.

### T1 — exact immutable package and source identity

Before execution: archive byte hash/count and extracted bytewise tree digest exactly match the pre-access public receipt; aliases/interface match; no forbidden entry or identity clue exists; delivered package remains unchanged.

After score seal and map reveal: salted map verifies; alias maps to the exact tested archive/tree; full source commit and Git tree exist; a new detached clean LFS-materialized checkout matches the committed source/package tree byte-for-byte; a repeat Node 24 build matches the committed production-output tree; branch/worktree/identity/approach are exactly the revealed committed values.

Until reveal, T1 identity parity is `pending-reveal`, never assumed pass. Any mismatch, substitution, unavailable object, source leak, or premature identity disclosure fails T1 and disqualifies.

### T2 — clean Node 24 install, tests, and production build

In an evaluator-owned fresh copy with no `node_modules`, output, cache, or prior install:

- exact Node `/opt/homebrew/opt/node@24/bin/node` major 24 and npm version are recorded;
- fixed `npm ci --audit=false --fund=false` completes cleanly without lockfile mutation;
- `npm run test:critic` collects real tests, reports zero failures/errors, and exits zero;
- `npm run build:critic` performs an optimized production build and exits zero;
- no missing asset, unresolved import, TypeScript error, shader error, fallback build, network-fetched runtime asset, skipped test, or warning treated by the project as an error occurs;
- source/interface/lockfile hashes stay unchanged and production-output tree digest is recorded.

Any command bypass, repair, retry with changed dependencies, alternate Node, dev build, or evaluator patch fails T2.

### T3 — production serve, assets, headed hardware WebGL2, and clean cold boots

Serve the T2 output via `serve:critic`. In each of three separate fresh persistent Chrome profiles/processes:

- normal playable production route reaches the first actionable game frame;
- `innerWidth=1600`, `innerHeight=900`, `devicePixelRatio=1`, screen/viewport `1600x900`, zoom 100%, and PNG `1600x900`;
- playfield context is a live `WebGL2RenderingContext`; GL VERSION/GLSL/vendor/unmasked renderer are recorded; renderer is physical hardware and not SwiftShader/software/WebGL1/Canvas2D;
- normal production assets and highest declared production asset tier load completely from the local production server; no procedural/geometric/material/animation fallback activates;
- exactly one intended game canvas/HUD exists and a real player can move/camera/strike through normal input;
- zero page errors, uncaught exceptions, unhandled rejections, console errors, failed essential requests, HTTP 4xx/5xx, missing assets, CORS errors, shader compile/link errors, blank/black/frozen frames, unexpected context loss, or fallback messages occur.

Warnings are recorded and fail if they indicate missing/deprecated runtime behavior, fallback, lifecycle, asset, shader, input, or correctness risk. A dashboard, screenshot page, separate render scene, builder capture, or procedural surrogate fails T3.

### T4 — exact tick provenance and three-profile replay determinism

In every cold profile, use seed `30011`, fixed `1/60`, the same normal input trace, and the same production route. Deterministic reset/start defines absolute scenario tick `0`. The normal mouse rising edge is sampled at absolute tick `24`, which defines attack-relative tick `0`. Capture full frames at absolute ticks 27–43 from that one uninterrupted scenario/light-strike run; focused absolute ticks 29/34/41 must be reported simultaneously as attack-relative ticks 5/10/17. Record both clocks in every exact state/event/camera/input receipt and PNG provenance record.

Across all three profiles:

- BCJ quantized authoritative-state digests at every absolute tick 27–43 are bit-identical;
- input, hit/damage/health, context, and state-transition event logs are bit-identical;
- camera matrices/transforms, actor/weapon/target transforms, contact samples, ground contacts, health, and resource mode are bit-identical at the declared precision;
- corresponding full frames at absolute ticks 29/34/41 have SSIM `>=0.995` and perceptual-hash Hamming distance `<=2`;
- no semantic silhouette, contact, response, HUD, lighting, asset, or camera difference exists.

The critic may pause only after an exact update. Seeking, resampling, interpolation, direct pose control, stitched ticks from different runs, or replay divergence fails T4.

### T5 — 30-second continuous live-input soak with zero unhandled rejections

After normal cold boot in each profile, run exactly the same 30.000-second wall-clock active-play trace using normal keyboard/pointer input. The trace includes sustained traversal, direction changes, camera movement, focus/canvas reacquisition through normal interaction, repeated light strikes, and recovery. There is no evaluator pause during the timed interval.

Pass requires:

- zero unhandled promise rejections, page errors, uncaught exceptions, console errors, essential request failures, NaN/Infinity transforms, duplicated event, or unexpected context loss;
- no lost/stuck/broken input, pointer-lock rejection, focus dead state, black/blank/frozen frame, duplicate HUD/canvas/listener behavior, or simulation/render heartbeat gap over 500 ms;
- controls remain responsive throughout and another exact light strike can begin normally within one second after the soak.

One unhandled rejection—including a rejected pointer-lock promise—fails T5. Recovery by ignoring an error does not pass.

### T6 — WebGL loss/restore, control by 1 second, luminance within 5% by 5 seconds

In each profile after T5, at a stable normal gameplay state:

1. Record a full-frame pre-loss PNG, state receipt, mean luminance, canvas/context counts, and renderer strings.
2. Invoke `WEBGL_lose_context.loseContext()` on the actual production playfield; extension absence fails.
3. After the `webglcontextlost` event, wait 250 ms and invoke `restoreContext()`; no reload/navigation is allowed.
4. From `webglcontextrestored`, require the first nonblank correctly oriented WebGL2 frame and an acknowledged normal control input with visible/authoritative state response in `<=1000 ms`.
5. At `5000 ms ±50 ms` after `webglcontextrestored`, capture the full frame and renderer/state receipt.

Mean luminance uses every pixel of the exact `1600x900` sRGB page PNG: `Y = 0.2126R + 0.7152G + 0.0722B`, averaged before rounding. Require `abs(Y5s - Ypre) / Ypre <= 0.05`. The baseline must be nonblack (`Ypre >= 8` on 0–255 scale). Renderer is again hardware WebGL2 with the same production asset tier, camera/HUD/health are coherent, and scene lighting/materials are visibly restored.

No duplicate canvas/context/listener, fallback, manual refresh, scene reset, lost state, error, or later darkening is allowed. Missed control deadline, luminance delta above 5%, or a visually wrong frame fails even if context events fired.

### T7 — bounded resource stability

In every profile, measure with CDP and candidate engine receipts after a 10-second warm-up and again after T5, T6, and ten additional normally triggered light-strike/recovery cycles. Invoke CDP garbage collection before three samples and compare medians.

Pass requires all of:

- document count has zero net growth;
- canvas count and live WebGL context count remain exactly one intended instance;
- DOM nodes grow by no more than `max(20, 2% of baseline)`;
- JavaScript event listeners grow by no more than `max(5, 2% of baseline)`;
- used JS heap grows by no more than `max(16 MiB, 10% of baseline)` after collection;
- engine texture, geometry, program, render-target, audio-node, and physics-body counts return to warm steady state within `+2` each and show no monotonic per-strike/loss growth;
- no duplicate requestAnimationFrame loop, input subscription, HUD root, worker, audio graph, or renderer exists;
- final 10-second p95 frame time is no worse than `max(initial p95 + 2 ms, initial p95 * 1.20)`, with no non-paused heartbeat gap over 500 ms.

Unavailable required counters, evidence of monotonic leak, lifecycle duplication, or a threshold miss fails T7.

### T8 — evidence, replay, runtime, and blind-chain integrity

Pass requires:

- every judgment uses the actual production route and evaluator-created full-page PNG/frame-sequence evidence;
- all focused/overall masters, receipts, logs, resource tables, derived candidate-only boards, and ballot artifacts are SHA-256 manifested with byte counts and provenance;
- package archive/tree/output hashes are rechecked unchanged after capture;
- camera, HUD, seed, input, fixed step, viewport, crop policy, timing, playback, and encoding are equal between candidates;
- exact tool/runtime/helper/browser/GPU/WebGL versions and launch arguments are recorded;
- ballot media contains no identity clue and no supplied reference pixel;
- private reference-board hashes exist without publishing their pixels;
- score file, BCJ bytes, score salt, commitment, and Git score commit follow section 3.6 before reveal;
- no post-capture image edit beyond locked layout/trim/encoding, no scoring mutation, no missing manifest item, and no hash mismatch exists.

Any evidence gap, source/identity leak, procedural capture fallback, hash mismatch, or score mutation fails T8 and disqualifies.

## 10. Alias-only score record

Before identity reveal, `ALIAS_ONLY_SCORE.json` must contain:

- protocol ID/payload hash, presentation commitment, public package/map receipt hash, and `identityRevealReceived=false`;
- exact runtime/capture configuration and actual tool versions;
- verified opaque aliases and package archive/tree/output hashes;
- per-profile T1-pre through T8 results with concrete evidence/reasons;
- O29/O34/O41 pass/fail with concrete visual and telemetry reasons;
- all ten integer category scores/reasons, total, and minimum;
- all nine one-cast ballot outcomes, focused/overall win counts, and blind order-manifest hash;
- each conjunctive check and provisional result;
- exactly one biggest remaining gap sentence for each rejected alias;
- evidence-manifest paths/hashes and all disqualifier checks.

Ties are represented as `winner: null, outcome: "tie-or-unclear"`. Reasons describe visible evidence, not implementation guesses. The stronger alias may be named, but identity/approach may not.

## 11. Exactly one biggest remaining gap when rejected

For each rejected alias, include exactly one sentence in this form:

> Biggest remaining gap: [one observable defect] at [one tick or transition], which [one reference-level consequence].

It names the single highest acceptance-risk defect. Do not list runners-up, join defects with “and,” use a semicolon, or hide multiple gaps in subordinate clauses. Ties resolve in this order: disqualifier/T1–T8 failure, `O34/C2`, `O41/C4`, `O29/C1`, `C3`, `C5`, `C6`, `C7`, `C8`, `C9`, `C10`. An accepted candidate receives no rejection gap.

## 12. Disqualifiers and no-amendment rule

Candidate-level disqualifiers: procedural/screenshot/static fallback; non-production or separate render route; broken/alternate input; lifecycle failure; software/WebGL1/2D fallback; missing assets; package mutation; candidate hash mismatch; capture manipulation; any T-gate condition explicitly marked disqualifying.

Round-level disqualifiers: identity/source/approach leak before score seal; alias carrying identity; side-by-side ballot identity clue; map/package commitment mismatch; presentation commitment mismatch; critic source inspection before reveal; reference-pixel republication; score salt disclosure before reveal; score or ballot mutation after sealing; identity reveal before score Git commit; any post-access protocol change.

Protocol Amendment 01 is the sole exception: a pre-candidate audit found that the original text incorrectly labeled the frozen absolute capture ticks as attack-relative, which would have sampled post-recovery frames. The amendment was authorized, documented, and committed before any package delivery/access or package/map commitment; it changes only clock semantics, preserves the existing presentation seed commitment, and weakens no gate or threshold. After the Amendment 01 commit, this protocol has no further amendment path. Any later substantive change requires a new numbered round and a new pre-access protocol/seed/map commitment. Discovery that a gate is inconvenient, unsupported, ambiguous in a candidate, or likely to fail does not permit relaxation.
