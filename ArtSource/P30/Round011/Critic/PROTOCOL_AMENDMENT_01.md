# P30 Round011 Protocol Amendment 01 — absolute scenario tick correction

Status: **PUBLIC, PRE-CANDIDATE, INCORPORATED**  
Protocol: `P30-R011-BLIND-v1`  
Recorded: `2026-08-02T14:42:45Z` (`2026-08-02T21:42:45+07:00`)  
Superseded protocol commit: `41efb38843601566c577e758eea7aad6a0e04ac6`  
Superseded protocol payload SHA-256: `73039f0e07247db6546e157821daadbec61a1acae1a3a04d964c45ea353af38b`

## Finding

A protocol audit found a material clock-space contradiction before any Round011 package delivery or access. The frozen scenario/reset tape samples the normal mouse light-strike rising edge at **absolute scenario simulation tick 24**. Long-standing focused evidence is captured at **absolute ticks 29, 34, and 41**.

The superseded `PACKAGE_INTERFACE.md` incorrectly defined capture values 27–43 and focused values 29/34/41 as attack-relative ticks. Under the frozen tape, those mistaken relative values would address absolute ticks 51–67, after the light attack has recovered. Producing the required anticipation/contact/braking poses there would require prohibited retiming, seeking, or re-posing.

That contradiction made exact tick provenance impossible even though all visual thresholds themselves were correct.

## Corrected clock contract

Deterministic reset/start establishes an absolute scenario clock that begins at 0 and does not reset during the run. The normal mouse rising edge is sampled at absolute tick 24. Attack-relative time is undefined (`null`) before that edge, is 0 at absolute tick 24, and thereafter equals:

```text
attackRelativeTick = absoluteSimulationTick - 24
```

The frozen mappings are:

| Event/evidence | Absolute scenario tick | Attack-relative tick |
|---|---:|---:|
| Normal mouse rising edge | 24 | 0 |
| Capture range begins | 27 | 3 |
| O29 anticipation | 29 | 5 |
| O34 exterior contact | 34 | 10 |
| O41 grounded braking | 41 | 17 |
| Capture range ends | 43 | 19 |
| G2/G5 recovery endpoint | 48 | 24 |

Consequently:

- `armCaptureTicks(number[])` accepts absolute scenario ticks only.
- Every frame from 27 through 43 is addressed on the absolute scenario clock.
- Focused 29/34/41 evidence is absolute and must simultaneously report honest attack-relative 5/10/17.
- Snapshots, run receipts, event logs, capture manifests, and PNG provenance expose both `absoluteSimulationTick` and `attackRelativeTick`.
- No capture, pause, replay, or scoring code may interpret 27–43 as attack-relative.

The corrected mapping is also executable and regression-tested in `tools/protocol-tools.mjs tick-map`.

## Invariants preserved

This amendment changes clock labeling/addressing only. It does **not** change or weaken:

- O29 anticipation-continuity requirements;
- O34 exact exterior contact, neighboring-frame, hit, or target-response requirements;
- O41 low same-direction grounded-braking requirements;
- any C1–C10 definition or score threshold;
- headed hardware-accelerated Chromium/WebGL2, 1600x900 DPR1, or three-cold-profile execution;
- T1–T8, including Node 24, determinism, soak, context recovery, luminance, resource, evidence, and identity gates;
- the three focused or six game-wide ballots;
- focused `3/3`, game-wide `>=5/6`, total `>=95/100`, or per-category `>=9/10` acceptance;
- any source/identity blindness, hash, commitment, reference privacy, disqualifier, or immutable-score rule.

The presentation seed bytes and their mathematics are independent of simulation clocks. The presentation commitment therefore remains unchanged:

```text
5df2ec1607da073c492d94d7f1c47c23606d51b9fdbc267a3ada8d76e853b05f
```

## Pre-access custody attestation

At discovery and correction:

- no Round011 candidate archive or directory had been delivered or accessed;
- no Round011 candidate source, source map, branch, commit, worktree, builder message, or builder evidence had been inspected;
- no opaque alias or package hash had been received;
- no package/source map commitment had been received;
- no presentation order had been derived for a real alias;
- no runtime capture, ballot, score, or candidate judgment existed.

The original commit and payload hash remain in Git as an audit record. The amendment commit plus its updated `COMMITMENT.json` become the only valid pre-candidate protocol state. After that commit, the no-further-amendment rule applies.

