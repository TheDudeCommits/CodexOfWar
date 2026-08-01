# P30 Round005 — Fresh Critic Report

**Verdict: REJECT — 23/100.** The frozen candidate at `2c180e356040fcafa80f074c905799f01c600efb` lost all six blinded comparisons and all three focused combat comparisons. The focused requirement was 3/3.

## Locked blind result

Six candidate captures were produced in headed Chrome at exactly 1600×900 CSS pixels, DPR 1, with hardware WebGL2/Metal. For each scenario I independently selected the closest private God of War action/composition reference, randomized the A/B side, scored the anonymous pair, and locked hashes before revealing identity. No builder evidence was used before lock.

| Scenario | Candidate side after reveal | Candidate score | Result |
|---|---:|---:|---:|
| S01 | B | 22 | Loss |
| S02 | B | 20 | Loss |
| S03, startup tick 29 | B | 24 | Loss |
| S04, active tick 34 | A | 28 | Loss |
| S05, recovery tick 41 | B | 25 | Loss |
| S06 | A | 18 | Loss |

Overall: **0/6**. Focused S03–S05: **0/3**. Mean candidate score: **22.83**. Lock SHA-256: `47a85ad07b9b14de2ba285d3aa499b6e1d820bf781086abbe1a3c166d6b8bacd`.

The reference frames consistently won on readable anatomy, deliberate two-handed weapon handling, silhouette separation, convincing material response, and contact staging. The candidate's arena context remained legible, but it did not rescue a combat replacement that reads as posed, flat, and mechanically disconnected.

## Hard gates

Passes: exact frozen commit/LFS; Node 24 typecheck, lint, 5/5 unit tests and production build; headed hardware capture contract; 18/18 asset load with no procedural fallback; required hero 5/5 and Hollow 3/3 clips; resource caps; exact HP contact; Blender 5.2 GLB reimport; 30-second performance; WebGL context loss/restore; zero runtime/request/WebGL errors.

Failures that independently reject the candidate:

- Blind quality: 0/6 overall and 0/3 focused, versus required S03–S05 3/3.
- Two-palm integrity: runtime attaches Stormcage only to the right-hand socket with no left-hand constraint; S05 left-palm error is 3.276 cm.
- Blade/contact integrity: S05 contains **458 blade↔Nyra triangle intersections across 14 blade triangles**. S04 physical target contact occurs, but the authored contact marker is 3.677 cm from the target surface.
- Focused PBR fidelity: Stormcage and Hollow carry no texture images and read substantially flatter than the private references.
- Cold start: 4924, 6973, and 5921 ms, all over the 4109 ms ceiling.
- Full replay determinism: simulation state matched exactly, but camera hashes did not.
- Camera obstruction: telemetry reports `implemented=false`, `status=pending`.

Three non-fatal console warnings were observed; they were not counted as errors. The supplemental free-roam smoke matrix was **not run** because mandatory failures already overdetermined rejection.

## The one dominant gap

**Authored duel-contact pose-and-material coherence.** Across the critical startup/contact/recovery sequence, the hero, hands, blade, target, and surface treatment do not read as one authored physical event. The S05 self-intersection is the clearest measurable manifestation and the 0/3 focused blind result is the perceptual result.

## One narrow Round006 prescription

Replace only the Nyra+Stormcage authored `Sword_Regular_A` contact package: bind Stormcage to the right-hand socket, constrain the left palm to an explicit secondary grip, correct the three fixed-tick poses and collision-clean blade arc, author the S04 target-contact marker, and add non-placeholder base-color/normal/ORM maps. Leave environment, HUD, simulation timing, and camera presentation unchanged.

Accept only if the same headed 1600×900 DPR1 blind test wins S03/S04/S05 **3/3**; both palms remain within **2.5 cm** of their grips at ticks 29/34/41; blade↔hero intersections are **zero** at those ticks; blade↔target contact occurs only at tick 34 with marker distance **≤3.0 cm**; and the package stays within current resource caps and the **4109 ms** cold-start ceiling.

Only the six candidate screenshots accompany this report. No private reference pixels, pair composites, mappings, or extraction artifacts are published.
