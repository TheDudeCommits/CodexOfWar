# P30 Round006 — independent critic report

**Verdict: REJECT — 23/100.** The exact candidate at `01a4c652a5a30137ae0c82cc6cd6f063f2c91ca6` lost all six anonymous comparisons. The focused S03-S05 result is **0/3**, against a mandatory **3/3**. A single focused loss rejects; this candidate has three.

## Blind result

I captured S01-S06 from the actual runtime in headed Google Chrome 150 on hardware WebGL2/ANGLE Metal. Before pairing, all six files were proven to be 1600×900 8-bit RGB PNGs; browser inner size, canvas CSS size, canvas backing size, and viewport were all 1600×900 at DPR 1. Pair construction happened only after that proof.

The randomized mapping was sealed before scoring, and the anonymous scores were independently sealed before reveal. The public hashes are:

- Mapping lock: `422a29058860c6134b15d70ed6e4e1c581788631c949bcba7d4d07bcc1890040`
- Anonymous score lock: `aff4a9f4c9e31cfeeb8afbf8e2a197e8b1f2989540e792e444ec7a9d5fadab45`
- Reveal: `22361b19d41d99f00ba2a6b6f336476cbfc62637ab1a91c9e7699c57e9ca726c`

Anonymous winner counts were balanced at A: 3 and B: 3. Mean A/B scores were 50.67/51.83; the mean winning score was 79.83 and the mean losing score was 22.67. Reveal placed the candidate on the losing side six times: **0/6 overall and 0/3 for S03-S05**. No pair pixels, source identities, file names, hashes, randomization material, or side mapping are published.

The visual defeat is not subtle. The candidate remains a small stylized diorama: characters occupy too little of the frame, the flat tiled foreground consumes most of the image, actor silhouettes overlap, the Hollow has little threat presence, and impact is represented by a translucent fan plus square sparks. The corrected S03-S05 blade arc is more readable than Round005, but it still does not approach the anatomy, material response, motion weight, environment depth, or cinematic intent of the private AAA gameplay frames.

## Independent technical audit

Passes:

- Exact detached HEAD and all 106 frozen-manifest entries verified. `freeze-before.sha256` and `freeze-after.sha256` are byte-identical and each hashes to `89e0105edb27ad2db6c4543ed03c3f21018723b56db3537795ba1b478701db8d`.
- Node 24.18.0: clean install, typecheck, lint, 5/5 simulation tests, production build, and 3/3 browser smoke tests passed.
- The runtime loaded exactly 18/18 enabled assets with zero failures and no procedural fallback. Every enabled manifest file was independently identified as real GLB/HDR/WebP bytes, never an LFS pointer.
- Fresh Blender 5.2 BVH recomputation against the runtime GLBs passed the authored contact contract. Both palm errors are far below 2.5 cm at ticks 29/34/41. Blade↔Nyra has zero triangle pairs at all three moments. Blade↔target is 0/109/0 pairs at S03/S04/S05, and the S04 marker is 0.000005883 m from the target surface.
- Nyra and Stormcage contain embedded, non-placeholder base-color, normal, and ORM data with no external image URIs. This is structurally valid PBR content, though the 256×256 authored detail remains visibly modest.
- Maximum observed runtime cost was 86 calls, 204,155 triangles, 32 textures, and 38 geometries, within the 100/250,000/32/64 caps.
- Three clean headed production launches reached ready in 1,436.098, 1,445.895, and 1,791.223 ms, all below 4,109 ms.
- The 30.015-second headed Metal interval averaged 59.87 fps with 18.4 ms p95 rAF, unchanged renderer resources, and WebGL error 0. Forced context loss/restore completed at one loss and one restore with no renderer error.

Failures:

- Blind quality is **0/6 overall and 0/3 focused**.
- Repository-level `git lfs fsck HEAD` exits 1: eight historical PNG blobs match current LFS attributes but were committed as ordinary Git objects. Runtime bytes are present, but the commit does not have clean repository-wide LFS integrity.
- Simulation replay is exact, but camera replay is not. Identical clean resets diverged by up to 0.051763 m at tick 34 and 0.000617 m at tick 60. Projection matrices matched; camera position did not.
- Camera obstruction is not implemented. Runtime telemetry explicitly reports `implemented=false`, `status=pending`, `collisionApplied=false`, with desired and resolved boom both fixed at 7.15 m.
- Three recurring deprecation warnings and the large-bundle advisory are non-fatal, but they reinforce the prototype finish.

The valid contact geometry, embedded maps, resource budget, cold start, and resilience are real improvements. They do not override the mandatory perceptual gate, and the camera/LFS failures independently prevent a clean acceptance.

## The one biggest remaining visible gap

**Combat camera presentation.** The distant static viewpoint reduces the duel to small overlapping figures surrounded by dead floor, preventing corrected hands, blade contact, poses, and material work from reading with AAA force.

## Smallest isolated Round007 replacement

Replace only the third-person camera module and its telemetry/tests. Implement a deterministic close over-shoulder combat profile, clear all transient shake state on reset, and resolve the boom against scene geometry. Leave simulation, timing, assets, environment, HUD, and combat geometry unchanged.

Accept only if:

1. S03, S04, and S05 win **3/3** under the same sealed headed 1600×900 DPR1 blind protocol.
2. At S03-S05, Nyra projects to 360-540 pixels head-to-heel; both actors and the full blade stay at least 80 pixels inside frame; and the S04 contact marker lies inside the central 40% of the viewport.
3. Three clean replays produce byte-identical camera telemetry at ticks 29, 34, 41, and 60.
4. A wall-on-boom-path test reports obstruction applied, resolved distance below desired distance, and at least 0.45 m camera clearance; an unobstructed test resolves exactly to the desired boom.
5. Cold ready remains at most 4,109 ms and the existing 100 calls/250,000 triangles/32 textures/64 geometries caps still pass.

Only the six candidate captures and critic evidence are published. All extracted source material, pair composites, mappings, randomization material, and lock preimages were kept outside the repository and deleted after final hash verification.
