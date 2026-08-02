# Round011 revealed final verdict

**NO ACCEPTED CANDIDATE.** The reveal binds `candidate-8202fa2c3374062a` to BuilderA / `codex/p30-r011-contact-builder` / `855da599f2308ebf920312f743da9164a7778b4a`, and `candidate-9442539eea8abc4c` to BuilderB / `codex/p30-r011-contact-calibration` / `ed207126794c9d637cbffe101816561deaeda57f`.

The map, public archives, presentation commitment, and sealed score commitment verify. However, the immutable alias-only score labels evaluator evidence-tree digests as `packageTreeSha256`; those differ from the public committed package-tree hashes. The sealed file is not changed. This evidence-integrity gap makes final T1 and T8 fail closed for both aliases, in addition to their sealed objective, visual, and technical failures. It is not a score mutation and does not trigger a listed round-level void.

The deterministic stronger rejected checkpoint is BuilderB's `ed207126794c9d637cbffe101816561deaeda57f`: its sealed ballots were 3 focused wins and 1 game-wide win, versus 0 and 0, with 41/100 versus 34/100.
