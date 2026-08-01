# P10 Round017 — Local Constraint Release

Disposition: **strongest connected c04 split-transform promoted for critic; builder eligibility FAIL**.

This folder is the isolated Round017 builder proof only. It uses the sealed Round013 PNG as the authoritative base, the Round016 candidate04 baked-green V source, two independent similarity transforms split at the elbow, and the exact local protection release. No Unity work and no fresh criticism were performed.

## Exact scope and preservation

- Anchors remain shoulder `(604,472)`, elbow `(370,845)`, grip `(450,625)`.
- Revised editable mask: Round016 final mask union protected hilt/rear-leg pixels inside the inclusive closed target triangle dilated by Euclidean radius 62 px.
- Revised mask: `78,197` pixels, SHA-256 `6103d88ffc9bf9073bef39dc863522f9b7119e0cd7d87a04b8843fac3dc22c71`.
- Exact post-composite grip restore: inclusive radius-24 disk, `1,793` pixels.
- Effective composite mask: `76,404` pixels.
- Outside-mask changed pixels: `0`; grip-disk changed pixels: `0`.
- Accepted proof: `de3f1be07757f516c6a194a870cc59903f40a0623872bf7dfa6cf549c5fcbcae`, 1,531,662 bytes, 1536×1024 RGB.

## What passes

The final changed pixels form one 8-connected component of `75,513` pixels. The derived limb foreground is also one 8-connected component of `60,922` pixels and reaches all three anchor neighborhoods. The elbow-to-grip return is `(80,-220)`, length `234.094` px, visibly steep up-right. No green-key contamination survives.

The source is RGB with a baked chroma-green field; it has **no native transparency**. All alpha is deterministic key-derived. The source was split at the elbow and mapped by uniform similarities, so perpendicular thickness scales exactly with longitudinal scale; no global affine needle distortion was used.

## Why eligibility fails

The fixed triangle contains only `10,832` raster pixels. The exact geometry preflight proves:

- 124/106 px tubes leave `0` pale pixels.
- 70/64 px tubes leave only `104` pale pixels.
- Even near-needle 20/16 px tubes leave 5,479 pale pixels, still below the 5,525 px proxy and anatomically ineligible.

The strongest full-width composite's largest uninterrupted pale component is only `22` pixels (`0.3982%` of the proxy). The wedge gate therefore fails. Because this obstruction is fixed-anchor geometry, image generation cannot resolve it; image-generation attempts spent: `0/4`.

## Released local protection

Exactly `54,856` previously protected pixels enter the revised mask: `20,526` hilt-only, `25,295` rear-only, and `9,035` in both zones. The final changes `27,638` hilt-zone and `34,086` rear-zone pixels. These local pixels are intentionally no longer immutable; all other pixels remain sealed.

## Key files

- `ArtSource/P10/Round017/LocalConstraintRelease/P10_Round017_NyraKestrel_LocalConstraintRelease_v1.png` — strongest connected proof, not eligible.
- `ArtSource/P10/Round017/LocalConstraintRelease/P10_Round017_RevisedEditableMask_binary.png` and `ArtSource/P10/Round017/LocalConstraintRelease/P10_Round017_RevisedEditableMask_rendered.png` — exact mask evidence.
- `ArtSource/P10/Round017/LocalConstraintRelease/P10_Round017_OriginalLocalConstraintGuide.svg` and `ArtSource/P10/Round017/LocalConstraintRelease/P10_Round017_OriginalLocalConstraintGuide.png` — original public-safe geometry guide.
- `ArtSource/P10/Round017/LocalConstraintRelease/P10_Round017_DeterministicCompositor.py` — complete deterministic lineage.
- `ArtSource/P10/Round017/LocalConstraintRelease/P10_Round017_Validation.json` and `ArtSource/P10/Round017/LocalConstraintRelease/P10_Round017_Validation.txt` — machine and human validation.
- `ArtSource/P10/Round017/LocalConstraintRelease/Analysis/P10_Round017_JudgePanel.png` — judgeable crop/mask/foreground comparison.
- `ArtSource/P10/Round017/LocalConstraintRelease/Iterations/` — exact raw/keyed source copies and every used split/warp/join/composite intermediate.

See `ArtSource/P10/Round017/LocalConstraintRelease/P10_Round017_LocalConstraintReleaseReceipt.json` for the complete repository-relative manifest and hashes.
