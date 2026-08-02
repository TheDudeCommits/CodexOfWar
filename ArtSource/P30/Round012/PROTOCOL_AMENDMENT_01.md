# P30 Round012-A Protocol Amendment 01 — selected-checkpoint field resolution

Status: **LOCKED before `BASELINE_RECEIPT.json`, Round012 builder fan-out, candidate source, candidate package, candidate identity, candidate evidence, or critic package access**

Amendment date: `2026-08-03` (`Asia/Bangkok`)

Applies to: `P30-R012A-BLIND-v1`, section 1 and sequence step 2 only

## Terminology resolution

The identity-aware Round011 verdict uses schema `p30.r011.final-verdict.v1`. Its deterministic selected checkpoint is stored at the exact JSON path:

```text
$.selectedStrongerRejectedCheckpoint
```

That object is the `selectedCheckpoint` meant by Round012-A section 1. Its required identity fields are `alias` and `commit`; its `builderIdentity`, `branch`, and `basis` fields are provenance. The word `Rejected` in the Round011 field name is status, not absence of a deterministic selection.

For the committed Round011 verdict, the resolved selection is:

```text
alias:  candidate-9442539eea8abc4c
commit: ed207126794c9d637cbffe101816561deaeda57f
status:  rejected
```

`BASELINE_RECEIPT.json` must record both the normalized name `selectedCheckpoint` and the source path `$.selectedStrongerRejectedCheckpoint`, bind the raw SHA-256 of this amendment as well as the locked protocol, and copy the rejected status honestly. If the exact verdict schema/path, alias, commit, or Git object does not verify, Round012-A cannot start.

## No other change

This amendment resolves only a cross-round field-name mismatch. It changes no scenario, route, seed, tick, input, contact algorithm, damage rule, threshold, gate, ballot, score, role, sequence ordering beyond committing this resolution before the baseline receipt, permitted source scope, or acceptance rule. Every other byte of `LOCKED_PROTOCOL.md` remains controlling.
