# P30 Round012-A Protocol Amendment 02 — frozen-blade compatibility and shifted geometry domain

Status: **PUBLIC, CANDIDATE-INDEPENDENT, PRE-ACCESS RECOMMIT**

Amendment date: `2026-08-03` (`Asia/Bangkok`)

Applies to: `P30-R012A-BLIND-v1`, sections 5.3, 5.4, 7.2, 7.4, 12.4, 12.7, 13, 15, and 16 only where this amendment expressly says so

Authority: `LOCKED_PROTOCOL.md` line 497 permits a pre-access recommit when a helper/environment defect is proven independent of candidate bytes before any candidate judgment. The sealed public root is commit `e5f36b53b2d7cc297a4b360923f6d8ca8211cdcd`. At proof and recommit time, `criticCandidateAccess` remained `false`; no Round012 candidate package, source, branch, identity, evidence, message, score, ballot, or judgment had been accessed or created. No private seed, salt, reference selection, reference pixel, private custody file, or `Reference.zip` was accessed.

The public Round011 Amendment 01 is the authority-chain precedent for correcting a candidate-independent, pre-access protocol/helper contradiction while preserving independent private commitments and every unrelated gate. This amendment does not authorize a post-access relaxation.

## 1. Proven frozen-production blade contradiction

The selected baseline freezes the production sword and rig scale. The sealed root asset is:

```text
path:   web-game/public/assets/models/ashwake/stormcage.glb
bytes:  151264
sha256: 29565b76739e2d0f5491c55c5c382c7e172c7bc99d04a2382044f782170b7c1d
scale:  1.220000 uniformly in production
```

An independent GLB decoder selected node `Dawnbreak_Blade`, mesh `Dawnbreak_Blade_Mesh`, and its sole triangle primitive using the default-opaque, double-sided `Dawnbreak_Steel` material. It decoded all indices and current position values, applied the frozen uniform scale, deduplicated exactly by `(mesh, vertex index)` as section 7.2 requires, and ran the locked evaluator helper's 64-sweep symmetric-Jacobi extraction without intermediate decimal rounding.

The deterministic result is:

| Measurement | Frozen result |
|---|---:|
| Unique referenced vertices | `364` |
| Indices / triangles | `456` / `152` |
| Primitive/material partitions | `1` / `1` |
| Geometric triangle components after exact-position welding | `1` (`152` triangles) |
| Principal/second eigenvalue ratio | `54.84111846316194` |
| Guard-tip length | `1.8721468021573855 m` (`1872147 µm` receipt quantization) |
| Maximum radial distance | `0.18472375173652655 m` (`184724 µm` receipt quantization) |

The original maximum length `1.80 m` rejects this frozen production blade. The original maximum radial distance `0.14 m` independently rejects it. Because the blade is one opaque steel primitive and all 152 triangles form one geometric component after exact-position welding, there is no honest material-, primitive-, or disconnected-component blade/hilt partition that could satisfy the old limits. Requiring one would force a prohibited proxy or arbitrary connected-surface cut.

## 2. Narrow replacement maxima

Section 7.2's minimum guard-tip length remains exactly `0.650000 m`. Its two maximum bounds are replaced only as follows:

| Constant | Superseded maximum | Recommitted maximum | Frozen margin |
|---|---:|---:|---:|
| Guard-tip length | `1.800000 m` | `1.873000 m` | `0.0008531978426145 m` |
| Maximum radial distance | `0.140000 m` | `0.185000 m` | `0.00027624826347345 m` |

These are the smallest whole-millimetre ceilings above the measured frozen geometry. Their positive margins are respectively about 853 and 276 times the `0.000001 m` contact epsilon, leaving deterministic binary64 headroom without admitting another millimetre of geometry. They retain the anti-proxy rule: geometry over either new maximum still fails; every opaque rendered blade primitive must still be included; hilt/guard primitives remain excluded; endpoint-to-silhouette checks remain mandatory; and surrogate, invisible, oversized, hilt/body-inclusive, or arbitrarily partitioned geometry still fails T10. Executable negative tests bind both an axially oversized primitive and a radially hilt-inclusive primitive.

## 3. Exact shifted tick domain

The locked `SHIFT_PLUS_7` trace has heavy edge `31`, exact contact/damage `53`, and terminal tick `87`. The sealed helper nevertheless rejected `collectGeometrySource` calls after tick `80`. It therefore could not collect the geometry needed to prove relative-tick parity through shifted terminal tick 87.

The geometry-helper domain is recommitted as the closed absolute range `-1..87`. Specifically:

- `collectGeometrySource` accepts `-1..87` and rejects tick `88` or any non-safe-integer tick;
- `evaluateSweptContact` accepts terminal ticks `0..87` and rejects `88` or any invalid terminal;
- `computeMissOffsetExtrema` uses the same validated terminal domain;
- canonical traces remain terminal tick `80`, with edge/contact `24`/`46` unchanged;
- `SHIFT_PLUS_7` remains terminal tick `87`, with edge/contact `31`/`53` unchanged; and
- shifted contact checks are the exact `+7` translation of canonical ticks 44/45/46/48 to 51/52/53/55 with identical clearances, penetration bounds, substeps, capsule tie-breaking, and one-rise rule.

Section 7.4's `0..80` search domain remains controlling for canonical and counterfactual traces. For `SHIFT_PLUS_7` only, its translated search domain is `0..87`, exact first contact is `53`, and no second rising contact is permitted through `87`. Tick `88` remains out of scope and fails closed.

The audit also found that swept contact previously had no upper terminal bound and miss-extrema did not validate its terminal argument. Closing both at 87 is a fail-closed domain repair, not an acceptance relaxation. The evidence-manifest helper already required terminal 87 and heavy-relative mapping from edge 31 for `SHIFT_PLUS_7`; those correct commitments are unchanged.

## 4. Recommitment and preserved invariants

`PROTOCOL_RECOMMITMENT_RECEIPT.json` binds the sealed root, authority chain, prior public commitment, exact asset/hash/measurement method/results, contradiction audit, replacement margins, and no-candidate-access state. `ROUND_COMMITMENT.json` advances only to schema `p30.r012a.round-commitment.v2` so it can bind this amendment, that receipt, and the replacement evaluator-helper bytes.

The presentation commitment, counterfactual commitment, reference archive hash, reference-selection commitment, protocol ID/hash, Amendment 01 hash, baseline-receipt hash, tree domain/helper hash, and `criticCandidateAccess=false` remain byte-identical to the prior round commitment. No raw private seed, salt, selection, crop, rationale, or reference pixel is added to a public artifact.

## 5. No other change

Every unrelated scenario, route, seed, clock boundary, input tape, viewport, production execution rule, target capsule, contact epsilon, blade capsule radius, 4096-substep algorithm, canonical contact/damage tick, damage amount, hit/miss derivation, topology threshold, distinctness threshold, recovery rule, baseline freeze, O1–O5 gate, T1–T10 gate, ballot, score, blindness role, custody rule, disqualifier, and acceptance conjunct remains exactly as locked by `LOCKED_PROTOCOL.md` and Amendment 01.

Candidate inconvenience, candidate-specific behavior, or a later score cannot invoke this amendment. Any other substantive contradiction still requires the authority path in line 497; any post-access helper/protocol change voids the round.
