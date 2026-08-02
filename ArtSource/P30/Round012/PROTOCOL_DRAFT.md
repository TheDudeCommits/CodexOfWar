# P30 Round012 protocol draft — heavy attack, split into judgeable pieces

Status: draft only. This document is intentionally not a locked acceptance commitment. It records the fresh protocol-author proposal and its independent red-team correction while Round011 remains under blind evaluation.

## Scope split

Round012 is divided so each result can be built, run, and rejected on its own.

### Round012-A — distinct heavy branch, visible contact, and damage

Freeze the selected Round011 light-strike scene, camera, hero, zombie, world scale, health store, and read-only evaluator adapter. Add only:

- a Mouse2/`KeyK` heavy branch beginning at absolute tick 24;
- a genuinely distinct rendered heavy pose trajectory;
- evaluator-owned swept visible-blade contact at absolute tick 46;
- one authoritative health transition from `100` to `75` on that contact tick;
- deterministic recovery with no damage, contact, or reaction in miss controls.

Hit-stop, recoil, authored victim reaction, camera impulse, impact VFX, and audio are out of scope for 012-A. They are the separately judged 012-B piece.

### Round012-B — impact stop, reaction, recoil, and recovery weight

Starting only from an accepted 012-A baseline, add:

- exactly three combat-frozen ticks after contact while rendering, UI, and input continue;
- an effective `HitReact_Heavy` pose, not a zero-weight or renamed decoy;
- monotone 0.55 m outward recoil by the follow-through beat;
- hit-relative recovery timing, miss behavior with no freeze, and presentation-quality impact weight.

## Round012-A canonical trace

The harness owns a manual 60 Hz clock. A tick snapshot is sampled after queued input, one `1/60 s` update, collision/damage resolution, and render.

- Before tick 0: Mouse1 `pointerdown(button=0, buttons=1)` at canvas center.
- Before tick 1: matching Mouse1 `pointerup`.
- Ticks 2–23: no input.
- Before tick 24: Mouse2 `pointerdown(button=2, buttons=2)`.
- Before tick 25: matching Mouse2 `pointerup`; native context menu must remain suppressed.
- Ticks 26–76: no input or camera motion.

Run separate clean replays for `KeyK`, held Mouse2, no-heavy, a whole-sequence `+7` tick shift, evaluator-selected hit offsets, evaluator-selected miss offsets, two cold loads, and one in-page reset.

## Evaluator-owned truth

Candidate hitboxes, callbacks, labels, and event telemetry are never contact truth. The locked evaluator derives a swept blade capsule from guard/tip anchors on the actually rendered opaque sword mesh and intersects it against evaluator-owned zombie bone capsules. The final protocol must lock radii, anchor extraction, interpolation/substeps, units, and epsilon.

`H` is the smallest tick whose interval `[H-1,H]` first intersects. Round012-A hard-gates `H = 46`; ticks 45 or 47 are diagnostic failures, not tolerance passes. Tick 45 must retain at least 0.03 m visible clearance. Damage must be the sole authoritative health mutation `100 -> 75` at the end of tick 46 and remain 75 through the terminal tick.

The heavy action must materially affect the rendered skeleton and must not be the light pose curve under a new name. Clip labels alone do not prove distinctness. The evaluator compares joint trajectories, effective mixer weights, root motion, silhouette, and guard/tip paths. A zero-weight action or aliased light clip fails.

## Round012-A captures and acceptance

Capture raw 1280×720 DPR-1 gameplay frames at absolute ticks 44, 47, and 58 plus an uncut tick-0–80 video. No debug overlay, post-capture crop, rescale, or color adjustment.

- Tick 44: unmistakable heavy anticipation and readable sword silhouette.
- Tick 47: visible blade/body contact and full-body weight transfer.
- Tick 58: distinct follow-through with no idle snap.

Hard gates are conjunctive: exact input semantics, one rising-edge activation, context-menu suppression, KeyK parity, `+7` temporal-shift parity, evaluator-owned contact at 46, authoritative 25 damage, no-heavy purity, all hit/miss offsets, two cold loads plus reset determinism, no duplicate listeners, and zero console/page/unhandled errors.

Provisional 100-point scoring:

- Timing and causality: 35
- Contact geometry and authoritative damage: 25
- Distinct rendered motion and recovery: 25
- Blind reference readability: 15

Acceptance requires every hard gate, at least 90/100 total, category floors of 28/20/20/13, and no visual criterion below 2/3. The five named visual criteria are heavy distinctness, anticipation/silhouette, contact readability, impact weight, and recovery polish.

## Round012-B exact additions

At accepted contact tick `H = 46`:

- combat clock, player/enemy mixer times, combat timers, physics transforms, and relevant pose matrices at `H+1..H+3` equal their end-H values within locked epsilon;
- at `H+4` each advances by exactly one normal step;
- RAF, render count, UI clock, and input latch advance every tick, including a sentinel input injected during the frozen interval;
- camera shake and impact VFX are explicitly classified in the locked protocol rather than silently sharing the combat clock;
- with `p0` the rendered zombie root at H and `d` the horizontal unit vector away from the hero at H, tick 58 longitudinal displacement is 0.50–0.60 m, lateral error at most 0.06 m, and vertical error at most 0.03 m;
- the root is unchanged within `1e-4 m` during the three frozen ticks, never moves more than 0.12 m in one tick, moves monotonically outward, and does not snap back through tick 76;
- hit first returns to visually and motionally idle at tick 76; the miss control never freezes and first idles at tick 73.

The miss target must retain at least 0.20 m evaluator-measured clearance throughout the entire heavy sweep, health 100, no reaction, target drift at most 0.01 m, and no stopped combat tick.

## Known cheat probes

The final locked evaluator must reject global-tick scripting, fixture/query detection, camera/world motion masquerading as recoil, capture-frame-only mutation, fake telemetry, reported-clock-only freezes, heal-after-damage, zero-weight named clips, oversized invisible colliders, unconditional hit-stop, and evaluator-specific branches. Source/provenance review and counterfactual traces are acceptance gates, not optional diagnostics.

## Primary visual bar

With HUD and impact effects masked, the contact frame must still read as a high-commitment heavy sword impact. Whole-body silhouette, visible blade contact, and victim response must carry the weight without relying on particles, labels, or camera shake.
