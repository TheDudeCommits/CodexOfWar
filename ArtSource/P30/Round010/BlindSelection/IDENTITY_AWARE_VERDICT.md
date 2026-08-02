# P30 Round010 Identity-Aware Verdict

The corrected map commitment, presentation commitment/order, and score commitment all verify against the revealed salts. The sealed alias-only score document remains byte-for-byte unchanged at SHA-256 `ae8df258212e7ad7eb28b95d465f526e68c06aed389d5fbb6df5b5f8204f98d5`.

## Verdict

**NO ACCEPTED CANDIDATE.** BuilderA at commit `37ae9f0800fb6851e72b0b83b7cea8e9f0ec6a21` is the stronger entry, mapped from `candidate-ff5ef7c562581ce6`, but it does not satisfy the conjunctive acceptance contract. Its sealed result is 54/100, minimum category 3/10, one of three focused wins, and four of six overall wins. BuilderB at commit `a4c977c88ec495e136f3698e7d79620f586fd5c8`, mapped from `candidate-b42289432d4cc3cb`, records 52/100, minimum category 3/10, zero focused wins, and zero overall wins.

Both entries pass O29 and O41 but fail O34. Both also fail the same technical gates:

- **T6:** BuilderA's 31.023-second run and BuilderB's 31.729-second run remained responsive with no animation-heartbeat gap over 500 ms, but each recorded five unhandled `WrongDocumentError: The root document of this element is not valid for pointer lock.` rejections.
- **T7:** both restored WebGL2 and responsive control well inside the time limit, yet remained incorrectly lit after five seconds. BuilderA restored in 387 ms, responded in 398 ms, and retained a 39.3050% mean-luma deficit; BuilderB restored in 454 ms, responded in 472 ms, and retained a 39.3381% deficit.

BuilderA — Biggest remaining gap: the visible blade-to-target standoff at tick 34 makes the impact read disconnected rather than as localized exterior contact.

BuilderB — Biggest remaining gap: the blade's visible entry into the target torso at tick 34 prevents the strike from reading as localized exterior contact.

No builder identity, source, approach, branch, Git metadata, or builder-produced evidence was accessed before the anonymous score was sealed at commit `82f2a6f3bbf72d900ac71df56328fc00db5bf846`.
