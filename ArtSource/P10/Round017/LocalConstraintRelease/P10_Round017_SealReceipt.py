#!/usr/bin/env python3
"""Seal the Round017 local-constraint builder proof and complete artifact manifest."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json

from PIL import Image


ROOT = Path(__file__).resolve().parent


def find_workspace_root(start: Path) -> Path:
    """Locate the repository root from this script, independent of the caller's cwd."""
    for candidate in (start, *start.parents):
        if (candidate / ".git").exists() and (candidate / "ArtSource").is_dir():
            return candidate
    raise RuntimeError(f"Could not locate workspace root above {start}")


WORKSPACE_ROOT = find_workspace_root(ROOT)
VALIDATION_PATH = ROOT / "P10_Round017_Validation.json"
ACCEPTED_PATH = ROOT / "P10_Round017_NyraKestrel_LocalConstraintRelease_v1.png"
MASK_PATH = ROOT / "P10_Round017_RevisedEditableMask_binary.png"
README_PATH = ROOT / "README.md"
VALIDATION_TEXT_PATH = ROOT / "P10_Round017_Validation.txt"
RECEIPT_PATH = ROOT / "P10_Round017_LocalConstraintReleaseReceipt.json"
CRITIC_REVIEW_NAME = "P10_Round017_FreshLocalConstraintReleaseReview.json"


PRESCRIPTION = (
    "Keep the three anchors fixed at shoulder (604,472), elbow (370,845), and grip (450,625), "
    "but change exactly one constraint: inside only the existing target triangle and limb corridors, "
    "stop treating overlapping hilt/rear-leg protection pixels as immutable. Define the Round017 "
    "editable mask as the current final mask union the currently protected pixels inside the closed "
    "triangle [(604,472),(370,845),(450,625)] dilated by 62 px, then restore only a 24 px-radius disk "
    "centered on grip (450,625) after compositing; freeze every pixel outside that revised mask. "
    "Composite one connected arm whose changed pixels form one 8-connected component from shoulder "
    "to elbow to the restored grip disk and whose two segments bound a clear pale head-sized wedge."
)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def repo_path(path: Path) -> str:
    """Return portable POSIX provenance rooted at the repository workspace."""
    resolved = path.resolve()
    try:
        relative = resolved.relative_to(WORKSPACE_ROOT)
    except ValueError as exc:
        raise ValueError(f"Provenance path escapes workspace: {resolved}") from exc
    return relative.as_posix()


def record(path: Path) -> dict:
    rec = {
        "path": repo_path(path),
        "sha256": sha256(path),
        "byte_size": path.stat().st_size,
    }
    try:
        with Image.open(path) as image:
            rec.update({
                "dimensions_px": [image.width, image.height],
                "mode": image.mode,
                "format": (image.format or path.suffix.lstrip(".")).lower(),
            })
    except Exception:
        rec.update({
            "dimensions_px": None,
            "mode": None,
            "format": path.suffix.lstrip(".").lower(),
        })
    return rec


def main() -> None:
    validation = json.loads(VALIDATION_PATH.read_text(encoding="utf-8"))
    counts = validation["mask_definition"]["counts"]
    connection = validation["connectivity_and_thickness"]
    wedge = validation["wedge_metrics"]
    checks = validation["hard_checks"]
    accepted = validation["outputs"]["accepted"]
    revised = validation["outputs"]["masks"]["revised"]
    release_root = repo_path(ROOT)

    validation_text = f"""P10 ROUND017 LOCAL CONSTRAINT RELEASE — BUILDER VALIDATION

DISPOSITION: PROMOTE STRONGEST CONNECTED C04 SPLIT-TRANSFORM FOR CRITIC
BUILDER ELIGIBILITY: FAIL
IMAGE-GENERATION ATTEMPTS: 0 / 4
UNITY WORK: NONE

ACCEPTED PNG
path: {accepted['path']}
sha256: {accepted['sha256']}
bytes: {accepted['byte_size']}
dimensions/mode: {accepted['dimensions_px'][0]}x{accepted['dimensions_px'][1]} {accepted['mode']}

REVISED MASK
path: {revised['path']}
sha256: {revised['sha256']}
pixels: {counts['revised_editable_mask_pixels']}
effective after exact r24 grip restore: {counts['effective_composite_mask_pixels']}
grip disk pixels: {counts['grip_restore_disk_pixels']}

LOCAL PROTECTION RELEASE
released total: {counts['locally_released_protected_pixels']}
hilt only: {counts['released_hilt_only_pixels']}
rear leg only: {counts['released_rear_only_pixels']}
hilt+rear overlap: {counts['released_hilt_and_rear_overlap_pixels']}
released outside prior corridor but inside dilated triangle: {counts['released_outside_prior_corridor_but_inside_dilated_triangle_pixels']}
final changed hilt-zone pixels: {counts['final_changed_hilt_zone_pixels']}
final changed rear-zone pixels: {counts['final_changed_rear_zone_pixels']}

HARD PRESERVATION / CONNECTIVITY
outside revised mask changed pixels: {counts['final_changed_outside_revised_mask_pixels']}
grip disk changed pixels: {counts['final_changed_inside_grip_disk_pixels']}
all changed components: {connection['all_changed_pixels_8_connected_component_count']} ({connection['all_changed_pixels_component_sizes']})
limb foreground components: {connection['foreground_8_connected_component_count']} ({connection['foreground_component_sizes']})
foreground shoulder/elbow/grip-annulus pixels: {connection['foreground_pixels_in_shoulder_radius32']} / {connection['foreground_pixels_in_elbow_radius32']} / {connection['foreground_pixels_in_grip_annulus_r24_to_r36']}
steep return vector/length/angle: {connection['elbow_to_grip_vector_px']} / {connection['elbow_to_grip_length_px']:.6f}px / {connection['up_right_return_angle_degrees_from_positive_x_with_screen_y_inverted']:.6f}deg
green contamination pixels: {counts['green_key_contamination_pixels_among_changes']}

WEDGE GATE — FAIL
closed triangle pixels: {wedge['triangle_pixels']}
largest uninterrupted pale component: {wedge['largest_uninterrupted_pale_component_pixels']}
head-sized r42 proxy pixels: {wedge['head_sized_area_proxy_pixels']}
ratio: {wedge['largest_wedge_to_head_proxy_ratio']:.9f}
theoretical 124/106px tubes leave: {wedge['theoretical_fixed_anchor_width_tradeoff'][0]['pale_triangle_pixels_remaining']} pale pixels
theoretical 70/64px tubes leave: {wedge['theoretical_fixed_anchor_width_tradeoff'][1]['pale_triangle_pixels_remaining']} pale pixels
theoretical 20/16px needle tubes leave: {wedge['theoretical_fixed_anchor_width_tradeoff'][2]['pale_triangle_pixels_remaining']} pale pixels

FAIL-CLOSED REASON
The fixed-anchor triangle is only 10,832 raster pixels. Anatomical full-width tubes consume it,
and even 70/64px widths leave only 104 pale pixels. Near-needle 20/16px tubes leave 5,479 pale
pixels, which approaches but does not reach the 5,525px proxy. Generation cannot change this geometry,
so no image-generation call was spent. The strongest connected material-matched proof is preserved,
but it is not builder-eligible because the head-sized pale wedge fails.

HARD CHECKS
{json.dumps(checks, indent=2)}
"""
    VALIDATION_TEXT_PATH.write_text(validation_text, encoding="utf-8")

    readme = f"""# P10 Round017 — Local Constraint Release

Disposition: **strongest connected c04 split-transform promoted for critic; builder eligibility FAIL**.

This folder is the isolated Round017 builder proof only. It uses the sealed Round013 PNG as the authoritative base, the Round016 candidate04 baked-green V source, two independent similarity transforms split at the elbow, and the exact local protection release. No Unity work and no fresh criticism were performed.

## Exact scope and preservation

- Anchors remain shoulder `(604,472)`, elbow `(370,845)`, grip `(450,625)`.
- Revised editable mask: Round016 final mask union protected hilt/rear-leg pixels inside the inclusive closed target triangle dilated by Euclidean radius 62 px.
- Revised mask: `{counts['revised_editable_mask_pixels']:,}` pixels, SHA-256 `{revised['sha256']}`.
- Exact post-composite grip restore: inclusive radius-24 disk, `{counts['grip_restore_disk_pixels']:,}` pixels.
- Effective composite mask: `{counts['effective_composite_mask_pixels']:,}` pixels.
- Outside-mask changed pixels: `0`; grip-disk changed pixels: `0`.
- Accepted proof: `{accepted['sha256']}`, {accepted['byte_size']:,} bytes, 1536×1024 RGB.

## What passes

The final changed pixels form one 8-connected component of `{connection['all_changed_pixels_component_sizes'][0]:,}` pixels. The derived limb foreground is also one 8-connected component of `{connection['foreground_component_sizes'][0]:,}` pixels and reaches all three anchor neighborhoods. The elbow-to-grip return is `(80,-220)`, length `{connection['elbow_to_grip_length_px']:.3f}` px, visibly steep up-right. No green-key contamination survives.

The source is RGB with a baked chroma-green field; it has **no native transparency**. All alpha is deterministic key-derived. The source was split at the elbow and mapped by uniform similarities, so perpendicular thickness scales exactly with longitudinal scale; no global affine needle distortion was used.

## Why eligibility fails

The fixed triangle contains only `{wedge['triangle_pixels']:,}` raster pixels. The exact geometry preflight proves:

- 124/106 px tubes leave `0` pale pixels.
- 70/64 px tubes leave only `104` pale pixels.
- Even near-needle 20/16 px tubes leave 5,479 pale pixels, still below the 5,525 px proxy and anatomically ineligible.

The strongest full-width composite's largest uninterrupted pale component is only `{wedge['largest_uninterrupted_pale_component_pixels']}` pixels (`{wedge['largest_wedge_to_head_proxy_ratio']:.4%}` of the proxy). The wedge gate therefore fails. Because this obstruction is fixed-anchor geometry, image generation cannot resolve it; image-generation attempts spent: `0/4`.

## Released local protection

Exactly `{counts['locally_released_protected_pixels']:,}` previously protected pixels enter the revised mask: `{counts['released_hilt_only_pixels']:,}` hilt-only, `{counts['released_rear_only_pixels']:,}` rear-only, and `{counts['released_hilt_and_rear_overlap_pixels']:,}` in both zones. The final changes `{counts['final_changed_hilt_zone_pixels']:,}` hilt-zone and `{counts['final_changed_rear_zone_pixels']:,}` rear-zone pixels. These local pixels are intentionally no longer immutable; all other pixels remain sealed.

## Key files

- `{release_root}/P10_Round017_NyraKestrel_LocalConstraintRelease_v1.png` — strongest connected proof, not eligible.
- `{release_root}/P10_Round017_RevisedEditableMask_binary.png` and `{release_root}/P10_Round017_RevisedEditableMask_rendered.png` — exact mask evidence.
- `{release_root}/P10_Round017_OriginalLocalConstraintGuide.svg` and `{release_root}/P10_Round017_OriginalLocalConstraintGuide.png` — original public-safe geometry guide.
- `{release_root}/P10_Round017_DeterministicCompositor.py` — complete deterministic lineage.
- `{release_root}/P10_Round017_Validation.json` and `{release_root}/P10_Round017_Validation.txt` — machine and human validation.
- `{release_root}/Analysis/P10_Round017_JudgePanel.png` — judgeable crop/mask/foreground comparison.
- `{release_root}/Iterations/` — exact raw/keyed source copies and every used split/warp/join/composite intermediate.

See `{release_root}/P10_Round017_LocalConstraintReleaseReceipt.json` for the complete repository-relative manifest and hashes.
"""
    README_PATH.write_text(readme, encoding="utf-8")

    artifacts = []
    for path in sorted(ROOT.rglob("*")):
        if not path.is_file() or path == RECEIPT_PATH or path.name == CRITIC_REVIEW_NAME:
            continue
        artifacts.append(record(path))

    receipt = {
        "schema": "codexofwar.original-2d-local-constraint-release-receipt",
        "version": "1.0.0",
        "receipt_id": "P10-Round017-LocalConstraintReleaseReceipt",
        "generated_utc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "scope": {
            "project_asset": "P10 Nyra Kestrel",
            "round": "Round017",
            "judged_unit": "isolated local-constraint trailing-limb proof only",
            "builder_eligibility": "FAIL",
            "disposition": "PROMOTE_STRONGEST_CONNECTED_C04_SPLIT_TRANSFORM_FOR_CRITIC_WITH_FAIL_CLOSED",
            "fresh_criticism_performed": False,
            "unity_entered": False,
            "files_staged": False,
        },
        "exact_critic_prescription": PRESCRIPTION,
        "attempt_accounting": validation["attempts"],
        "authorities": validation["authorities"],
        "mask": {
            **validation["mask_definition"],
            "revised_mask": record(MASK_PATH),
            "rendered_mask": record(ROOT / "P10_Round017_RevisedEditableMask_rendered.png"),
            "grip_disk": record(ROOT / "P10_Round017_GripRestoreDisk24_binary.png"),
        },
        "lineage": {
            "base": validation["authorities"]["round013_base"]["path"],
            "raw_source": validation["authorities"]["round016_c04_raw"]["path"],
            "keying": validation["keying"],
            "transform": validation["split_transform"],
            "ordered_operations": [
                "copy exact Round016 c04 RGB baked-green raw and keyed source into Round017 Iterations",
                "derive deterministic green key; retain largest source component; despill green; never claim native alpha",
                "close three socket inner disks using equal-size texture copies from the same connected c04 limb",
                "split source into upper-arm and return pieces at the elbow with local elbow overlap only",
                "map each piece by its own uniform similarity to shoulder->elbow and elbow->grip",
                "alpha-composite the pieces only at the elbow and retain their one 8-connected foreground component",
                "clear only the effective local mask to a fitted pale background plane",
                "composite the joined cutout inside the revised mask",
                "restore the exact inclusive radius-24 grip disk from Round013",
                "hard-restore every pixel outside the revised mask from Round013",
                "restore six isolated resampling change speckles so all final changed pixels are one 8-connected component",
                "seal byte-identical accepted and candidate composite PNGs",
            ],
            "accepted": record(ACCEPTED_PATH),
        },
        "validation": {
            "machine": record(VALIDATION_PATH),
            "human": record(VALIDATION_TEXT_PATH),
            "counts": counts,
            "connectivity": connection,
            "wedge": wedge,
            "hard_checks": checks,
            "hard_check_pass_count": validation["hard_check_pass_count"],
            "hard_check_total": validation["hard_check_total"],
        },
        "fail_closed_reason": (
            "The fixed 10,832-pixel triangle cannot simultaneously contain anatomical-width 124/106 "
            "or even 70/64 pixel tubes and a roughly 5,525-pixel pale wedge. The strongest connected "
            "full-width proof leaves only 22 pixels in its largest pale component. Generation cannot "
            "alter the authorized anchors or this geometry, so zero generation attempts were spent."
        ),
        "claim_boundaries": {
            "native_transparency_claimed": False,
            "source_background": "baked chroma-green RGB field",
            "original_public_safe_guide": "original SVG/PNG geometry only; no embedded supplied raster or third-party pixels",
            "identity_lighting_framing_unrelated_pixels": "all pixels outside the exact revised mask are pixel-identical to sealed Round013",
            "local_hilt_rear_pixels": "previously protected overlaps inside the revised mask are intentionally mutable and quantified",
            "builder_eligibility": "FAIL; accepted PNG is strongest evidence for critic, not eligible final art",
        },
        "artifact_manifest": {
            "root": repo_path(ROOT),
            "artifact_count_excluding_self_referential_receipt_and_critic_review": len(artifacts),
            "self_receipt_path": repo_path(RECEIPT_PATH),
            "excluded_critic_review_path": f"{repo_path(ROOT)}/{CRITIC_REVIEW_NAME}",
            "self_hash_note": "The receipt cannot contain its own stable hash; report its SHA-256 externally after sealing.",
            "artifacts": artifacts,
        },
    }
    RECEIPT_PATH.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "disposition": receipt["scope"]["disposition"],
        "builder_eligibility": receipt["scope"]["builder_eligibility"],
        "accepted": record(ACCEPTED_PATH),
        "revised_mask": record(MASK_PATH),
        "validation": record(VALIDATION_PATH),
        "receipt": record(RECEIPT_PATH),
        "artifact_count_excluding_receipt_and_critic_review": len(artifacts),
    }, indent=2))


if __name__ == "__main__":
    main()
