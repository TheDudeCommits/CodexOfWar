#!/usr/bin/env python3
"""Deterministic key, exact-anchor warp, composite, and protected restore for Round016."""

from pathlib import Path
import hashlib
import json

import numpy as np
from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parent
ITER = ROOT / "Iterations"
BASE_PATH = ROOT.parent.parent / "Round013" / "ElbowReturnTriangle" / "Iterations" / "P10_Round013_ElbowReturnTriangle_candidate04.png"
CORRIDOR_PATH = ROOT / "P10_Round016_UnprotectedLimbCorridor_binary.png"
FINAL_MASK_PATH = ROOT / "P10_Round016_TrailingLimbHardMask_binary.png"
HILT_ZONE_PATH = ROOT / "P10_Round016_HiltProtectionZone_binary.png"
REAR_ZONE_PATH = ROOT / "P10_Round016_RearLegProtectionZone_binary.png"

DEST_ANCHORS = np.array([[604.0, 472.0], [370.0, 845.0], [450.0, 625.0]])
SOURCE_ANCHORS = {
    1: np.array([[1002.0, 158.0], [724.0, 866.0], [433.0, 502.0]]),
    2: np.array([[1005.0, 145.0], [728.0, 535.0], [500.0, 872.0]]),
    3: np.array([[647.0, 160.0], [520.0, 847.0], [1020.0, 430.0]]),
    4: np.array([[1025.0, 235.0], [505.0, 940.0], [305.0, 575.0]]),
}


def digest(path: Path) -> dict:
    data = path.read_bytes()
    return {"sha256": hashlib.sha256(data).hexdigest(), "byte_size": len(data)}


def key_image(raw: Image.Image, candidate: int) -> Image.Image:
    rgb = np.asarray(raw.convert("RGB"), dtype=np.uint8)
    if candidate == 4:
        bg = (
            (rgb[:, :, 1].astype(np.int16) > rgb[:, :, 0].astype(np.int16) + 55)
            & (rgb[:, :, 1].astype(np.int16) > rgb[:, :, 2].astype(np.int16) + 55)
            & (rgb[:, :, 1] > 120)
        )
    else:
        low = rgb.min(axis=2)
        spread = rgb.max(axis=2).astype(np.int16) - low.astype(np.int16)
        bg = (low > 218) & (spread < 16)
    alpha = Image.fromarray(np.where(bg, 0, 255).astype(np.uint8), "L")
    # Close tiny neutral highlight holes without claiming native transparency.
    alpha = alpha.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
    rgba = np.dstack((rgb, np.asarray(alpha, dtype=np.uint8)))
    return Image.fromarray(rgba, "RGBA")


def inverse_similarity(source: np.ndarray, dest: np.ndarray) -> tuple[float, ...]:
    """PIL output/destination -> input/source similarity mapping for two anchors."""
    sv = source[1] - source[0]
    dv = dest[1] - dest[0]
    denom = float(dv @ dv)
    a = float((sv[0] * dv[0] + sv[1] * dv[1]) / denom)
    b = float((sv[1] * dv[0] - sv[0] * dv[1]) / denom)
    tx = float(source[0, 0] - (a * dest[0, 0] - b * dest[0, 1]))
    ty = float(source[0, 1] - (b * dest[0, 0] + a * dest[0, 1]))
    return (a, -b, tx, b, a, ty)


def squared_segment_distance(xx: np.ndarray, yy: np.ndarray, p0: np.ndarray, p1: np.ndarray) -> np.ndarray:
    vx, vy = p1 - p0
    denom = float(vx * vx + vy * vy)
    t = np.clip(((xx - p0[0]) * vx + (yy - p0[1]) * vy) / denom, 0.0, 1.0)
    dx = xx - (p0[0] + t * vx)
    dy = yy - (p0[1] + t * vy)
    return dx * dx + dy * dy


def piecewise_anchor(keyed: Image.Image, source: np.ndarray) -> tuple[Image.Image, list[tuple[float, ...]]]:
    """Split at the elbow and similarity-map each limb segment to its exact two anchors."""
    rgba = np.asarray(keyed, dtype=np.uint8)
    yy, xx = np.indices(rgba.shape[:2])
    d_upper = squared_segment_distance(xx, yy, source[0], source[1])
    d_return = squared_segment_distance(xx, yy, source[1], source[2])
    opaque = rgba[:, :, 3] > 0
    assignments = [(d_upper <= d_return) & opaque, (d_return < d_upper) & opaque]
    transforms = [
        inverse_similarity(source[[0, 1]], DEST_ANCHORS[[0, 1]]),
        inverse_similarity(source[[1, 2]], DEST_ANCHORS[[1, 2]]),
    ]
    layers = []
    for assigned, coeffs in zip(assignments, transforms):
        layer = rgba.copy()
        layer[:, :, 3] = np.where(assigned, rgba[:, :, 3], 0)
        warped = Image.fromarray(layer, "RGBA").transform(
            (1536, 1024), Image.Transform.AFFINE, coeffs,
            resample=Image.Resampling.BICUBIC, fillcolor=(0, 0, 0, 0)
        )
        layers.append(warped)
    anchored = Image.new("RGBA", (1536, 1024), (0, 0, 0, 0))
    anchored.alpha_composite(layers[0])
    anchored.alpha_composite(layers[1])
    return anchored, transforms


def fit_background_plane(base: np.ndarray) -> np.ndarray:
    yy, xx = np.indices(base.shape[:2])
    region = (xx >= 260) & (xx <= 720) & (yy >= 340) & (yy <= 930)
    bright = base.min(axis=2) > 225
    sample = region & bright
    design = np.column_stack((xx[sample], yy[sample], np.ones(sample.sum())))
    full_design = np.column_stack((xx.ravel(), yy.ravel(), np.ones(xx.size)))
    plane = np.empty_like(base)
    for channel in range(3):
        coef, *_ = np.linalg.lstsq(design, base[:, :, channel][sample], rcond=None)
        plane[:, :, channel] = np.clip(full_design @ coef, 0, 255).reshape(base.shape[:2]).astype(np.uint8)
    return plane


def main() -> None:
    base = np.asarray(Image.open(BASE_PATH).convert("RGB"), dtype=np.uint8)
    corridor = np.asarray(Image.open(CORRIDOR_PATH).convert("L"), dtype=np.uint8) == 255
    final_mask = np.asarray(Image.open(FINAL_MASK_PATH).convert("L"), dtype=np.uint8) == 255
    hilt_zone = np.asarray(Image.open(HILT_ZONE_PATH).convert("L"), dtype=np.uint8) == 255
    rear_zone = np.asarray(Image.open(REAR_ZONE_PATH).convert("L"), dtype=np.uint8) == 255
    background = fit_background_plane(base)

    report = {
        "base": {**digest(BASE_PATH), "dimensions_px": [1536, 1024]},
        "destination_anchors": DEST_ANCHORS.astype(int).tolist(),
        "candidates": [],
        "mask_counts": {
            "canvas_pixels": int(final_mask.size),
            "unprotected_corridor_pixels": int(corridor.sum()),
            "final_editable_pixels": int(final_mask.sum()),
            "corridor_pixels_removed_total": int((corridor & ~final_mask).sum()),
            "corridor_pixels_occluded_by_hilt_zone": int((corridor & hilt_zone).sum()),
            "corridor_pixels_occluded_by_rear_leg_zone": int((corridor & rear_zone).sum()),
            "corridor_pixels_occluded_by_both_zones": int((corridor & hilt_zone & rear_zone).sum()),
        },
    }

    for candidate in range(1, 5):
        stem = f"P10_Round016_TwoSegmentLimb_candidate{candidate:02d}"
        raw_path = ITER / f"{stem}_raw.png"
        keyed_path = ITER / f"{stem}_keyed.png"
        anchored_path = ITER / f"{stem}_anchored.png"
        composite_path = ITER / f"{stem}_composite.png"
        protected_path = ITER / f"{stem}_protected.png"

        keyed = key_image(Image.open(raw_path), candidate)
        keyed.save(keyed_path, optimize=True)
        anchored, transforms = piecewise_anchor(keyed, SOURCE_ANCHORS[candidate])
        anchored.save(anchored_path, optimize=True)

        # First preserve the full unprotected composite for lineage inspection.
        cleared = base.copy()
        cleared[corridor] = background[corridor]
        cut = np.asarray(anchored, dtype=np.uint8)
        alpha = (cut[:, :, 3].astype(np.float32) / 255.0) * corridor.astype(np.float32)
        composite = np.rint(cut[:, :, :3] * alpha[:, :, None] + cleared * (1.0 - alpha[:, :, None])).astype(np.uint8)
        Image.fromarray(composite, "RGB").save(composite_path, optimize=True)

        # Authoritative protection: only final-mask pixels may differ from Round013.
        protected = base.copy()
        protected[final_mask] = composite[final_mask]
        Image.fromarray(protected, "RGB").save(protected_path, optimize=True)

        outside_equal = bool(np.array_equal(protected[~final_mask], base[~final_mask]))
        hilt_equal = bool(np.array_equal(protected[hilt_zone], base[hilt_zone]))
        rear_equal = bool(np.array_equal(protected[rear_zone], base[rear_zone]))
        report["candidates"].append({
            "candidate": candidate,
            "source_anchors": SOURCE_ANCHORS[candidate].astype(int).tolist(),
            "piecewise_similarity_output_to_input": [list(t) for t in transforms],
            "raw": {"path": str(raw_path.relative_to(ROOT)), **digest(raw_path)},
            "keyed": {"path": str(keyed_path.relative_to(ROOT)), **digest(keyed_path)},
            "anchored": {"path": str(anchored_path.relative_to(ROOT)), **digest(anchored_path)},
            "composite": {"path": str(composite_path.relative_to(ROOT)), **digest(composite_path)},
            "protected": {"path": str(protected_path.relative_to(ROOT)), **digest(protected_path)},
            "pixel_equality": {
                "all_pixels_outside_final_mask_equal_base": outside_equal,
                "all_hilt_protection_zone_pixels_equal_base": hilt_equal,
                "all_rear_leg_protection_zone_pixels_equal_base": rear_equal,
            },
        })

    report_path = ROOT / "P10_Round016_DeterministicCompositeEvidence.json"
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
