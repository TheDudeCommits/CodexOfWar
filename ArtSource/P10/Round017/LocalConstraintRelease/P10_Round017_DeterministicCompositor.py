#!/usr/bin/env python3
"""Deterministic Round017 local-release mask, split transform, composite, and validation.

This script deliberately spends no image-generation calls. It uses the useful Round016
candidate04 baked-green source, derives a keyed/despilled RGBA cutout, splits it at the
elbow, applies two independent similarities, joins only at the elbow, composites only
inside the exact revised mask, restores the exact 24 px grip disk, and hard-restores all
pixels outside the revised mask from the sealed Round013 authority.
"""

from __future__ import annotations

from collections import deque
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import math
import shutil

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parent


def find_workspace_root(start: Path) -> Path:
    """Locate the repository root from this script, independent of the caller's cwd."""
    for candidate in (start, *start.parents):
        if (candidate / ".git").exists() and (candidate / "ArtSource").is_dir():
            return candidate
    raise RuntimeError(f"Could not locate workspace root above {start}")


WORKSPACE_ROOT = find_workspace_root(ROOT)
ITER = ROOT / "Iterations"
ANALYSIS = ROOT / "Analysis"

BASE_PATH = ROOT.parent.parent / "Round013" / "ElbowReturnTriangle" / "P10_Round013_NyraKestrel_ElbowReturnTriangle_v1.png"
ROUND016_ROOT = ROOT.parent.parent / "Round016" / "TwoSegmentLimb"
CURRENT_FINAL_MASK_PATH = ROUND016_ROOT / "P10_Round016_TrailingLimbHardMask_binary.png"
CORRIDOR_PATH = ROUND016_ROOT / "P10_Round016_UnprotectedLimbCorridor_binary.png"
HILT_PATH = ROUND016_ROOT / "P10_Round016_HiltProtectionZone_binary.png"
REAR_PATH = ROUND016_ROOT / "P10_Round016_RearLegProtectionZone_binary.png"
C04_RAW_PATH = ROUND016_ROOT / "Iterations" / "P10_Round016_TwoSegmentLimb_candidate04_raw.png"
C04_KEYED_PATH = ROUND016_ROOT / "Iterations" / "P10_Round016_TwoSegmentLimb_candidate04_keyed.png"

WIDTH, HEIGHT = 1536, 1024
SHOULDER = np.array([604.0, 472.0])
ELBOW = np.array([370.0, 845.0])
GRIP = np.array([450.0, 625.0])
DEST_ANCHORS = np.stack([SHOULDER, ELBOW, GRIP])

SOURCE_SHOULDER = np.array([1025.0, 235.0])
SOURCE_ELBOW = np.array([505.0, 940.0])
SOURCE_GRIP = np.array([305.0, 575.0])
SOURCE_ANCHORS = np.stack([SOURCE_SHOULDER, SOURCE_ELBOW, SOURCE_GRIP])

# Map internal cross-sections to the shoulder and grip but retain the terminal material
# beyond them. This supplies overlap into the body and restored hand instead of leaving
# a geometric gap. Each piece is independently similarity-mapped, so longitudinal and
# perpendicular dimensions receive the same scale (no affine needle distortion).
UPPER_MAP_T = 0.18
RETURN_MAP_T = 0.88
ELBOW_OVERLAP_SOURCE_RADIUS = 82.0


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


def file_record(path: Path) -> dict:
    rec = {
        "path": repo_path(path),
        "sha256": sha256(path),
        "byte_size": path.stat().st_size,
    }
    try:
        with Image.open(path) as im:
            rec.update({
                "dimensions_px": [im.width, im.height],
                "mode": im.mode,
                "format": (im.format or path.suffix.lstrip(".")).lower(),
            })
    except Exception:
        rec.update({"dimensions_px": None, "mode": None, "format": path.suffix.lstrip(".").lower()})
    return rec


def save_png(image: Image.Image, path: Path) -> None:
    image.save(path, format="PNG", compress_level=9, optimize=False)


def cross2(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    return a[..., 0] * b[..., 1] - a[..., 1] * b[..., 0]


def squared_segment_distance(xx: np.ndarray, yy: np.ndarray, p0: np.ndarray, p1: np.ndarray) -> np.ndarray:
    vx, vy = p1 - p0
    denom = float(vx * vx + vy * vy)
    t = np.clip(((xx - p0[0]) * vx + (yy - p0[1]) * vy) / denom, 0.0, 1.0)
    dx = xx - (p0[0] + t * vx)
    dy = yy - (p0[1] + t * vy)
    return dx * dx + dy * dy


def closed_triangle_and_dilation() -> tuple[np.ndarray, np.ndarray]:
    yy, xx = np.indices((HEIGHT, WIDTH), dtype=np.float64)
    p = np.stack((xx, yy), axis=-1)
    a, b, c = DEST_ANCHORS
    c1 = cross2(b - a, p - a)
    c2 = cross2(c - b, p - b)
    c3 = cross2(a - c, p - c)
    triangle = ((c1 >= 0) & (c2 >= 0) & (c3 >= 0)) | ((c1 <= 0) & (c2 <= 0) & (c3 <= 0))
    distance2 = np.minimum.reduce([
        squared_segment_distance(xx, yy, a, b),
        squared_segment_distance(xx, yy, b, c),
        squared_segment_distance(xx, yy, c, a),
    ])
    dilated = triangle | (distance2 <= 62.0 ** 2)
    return triangle, dilated


def circle_mask(center: np.ndarray, radius: float) -> np.ndarray:
    yy, xx = np.indices((HEIGHT, WIDTH), dtype=np.float64)
    return (xx - center[0]) ** 2 + (yy - center[1]) ** 2 <= radius ** 2


def largest_component(mask: np.ndarray) -> tuple[np.ndarray, list[int]]:
    """Return largest 8-connected component and all component sizes."""
    mask = np.asarray(mask, dtype=bool)
    ys, xs = np.where(mask)
    if len(xs) == 0:
        return np.zeros_like(mask), []
    x0, x1 = int(xs.min()), int(xs.max())
    y0, y1 = int(ys.min()), int(ys.max())
    local = mask[y0:y1 + 1, x0:x1 + 1]
    seen = np.zeros(local.shape, dtype=bool)
    sizes: list[int] = []
    best: list[tuple[int, int]] = []
    height, width = local.shape
    for sy, sx in zip(*np.where(local & ~seen)):
        if seen[sy, sx]:
            continue
        queue = deque([(int(sy), int(sx))])
        seen[sy, sx] = True
        points: list[tuple[int, int]] = []
        while queue:
            cy, cx = queue.popleft()
            points.append((cy, cx))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    if dx == 0 and dy == 0:
                        continue
                    ny, nx = cy + dy, cx + dx
                    if 0 <= ny < height and 0 <= nx < width and local[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        queue.append((ny, nx))
        sizes.append(len(points))
        if len(points) > len(best):
            best = points
    result = np.zeros_like(mask)
    if best:
        by = np.fromiter((p[0] for p in best), dtype=np.int32)
        bx = np.fromiter((p[1] for p in best), dtype=np.int32)
        result[by + y0, bx + x0] = True
    return result, sorted(sizes, reverse=True)


def key_and_despill(raw: Image.Image) -> tuple[Image.Image, dict]:
    rgb = np.asarray(raw.convert("RGB"), dtype=np.uint8)
    background = (
        (rgb[:, :, 1].astype(np.int16) > rgb[:, :, 0].astype(np.int16) + 55)
        & (rgb[:, :, 1].astype(np.int16) > rgb[:, :, 2].astype(np.int16) + 55)
        & (rgb[:, :, 1] > 120)
    )
    alpha = Image.fromarray(np.where(background, 0, 255).astype(np.uint8))
    alpha = alpha.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
    alpha_array = np.asarray(alpha, dtype=np.uint8)
    kept, component_sizes = largest_component(alpha_array > 0)
    alpha_array = np.where(kept, alpha_array, 0).astype(np.uint8)

    clean = rgb.copy()
    max_rb = np.maximum(clean[:, :, 0], clean[:, :, 2])
    spill = kept & (clean[:, :, 1].astype(np.int16) > max_rb.astype(np.int16) + 12)
    clean[:, :, 1][spill] = max_rb[spill]
    clean[~kept] = 0
    rgba = np.dstack((clean, alpha_array))
    return Image.fromarray(rgba, "RGBA"), {
        "background_rule": "G > R+55 and G > B+55 and G > 120",
        "alpha_close": "3x3 MaxFilter then 3x3 MinFilter",
        "native_transparency_claimed": False,
        "raw_background": "baked chroma-green key field",
        "source_component_sizes_before_retention": component_sizes,
        "retained_opaque_pixels": int(kept.sum()),
        "despilled_foreground_pixels": int(spill.sum()),
    }


def close_socket_holes(keyed: Image.Image) -> tuple[Image.Image, list[dict]]:
    """Close the three source's open black socket centers with nearby native plate texels.

    The copper rings remain untouched. Each small inner disk copies an equal-size patch
    from the same connected limb toward its adjacent segment; no synthesized material or
    external pixels are introduced.
    """
    rgba = np.asarray(keyed, dtype=np.uint8).copy()
    yy, xx = np.indices((HEIGHT, WIDTH), dtype=np.int32)
    operations = [
        (SOURCE_SHOULDER, 27, np.array([-89, 121])),
        (SOURCE_ELBOW, 29, np.array([70, -100])),
        (SOURCE_GRIP, 22, np.array([34, 62])),
    ]
    report = []
    for center, radius, offset in operations:
        mask = (xx - int(center[0])) ** 2 + (yy - int(center[1])) ** 2 <= radius ** 2
        target_y, target_x = np.where(mask)
        source_x = np.clip(target_x + int(offset[0]), 0, WIDTH - 1)
        source_y = np.clip(target_y + int(offset[1]), 0, HEIGHT - 1)
        valid = rgba[source_y, source_x, 3] > 0
        rgba[target_y[valid], target_x[valid], :3] = rgba[source_y[valid], source_x[valid], :3]
        rgba[target_y[valid], target_x[valid], 3] = 255
        report.append({
            "center": center.astype(int).tolist(),
            "inner_disk_radius_px": radius,
            "same_limb_texture_copy_offset_xy": offset.astype(int).tolist(),
            "pixels_replaced": int(valid.sum()),
        })
    return Image.fromarray(rgba, "RGBA"), report


def source_projection(xx: np.ndarray, yy: np.ndarray, p0: np.ndarray, p1: np.ndarray) -> np.ndarray:
    v = p1 - p0
    return ((xx - p0[0]) * v[0] + (yy - p0[1]) * v[1]) / float(v @ v)


def inverse_similarity(source: np.ndarray, dest: np.ndarray) -> tuple[float, ...]:
    """PIL destination/output to source/input similarity for two exact anchors."""
    sv = source[1] - source[0]
    dv = dest[1] - dest[0]
    denom = float(dv @ dv)
    a = float((sv[0] * dv[0] + sv[1] * dv[1]) / denom)
    b = float((sv[1] * dv[0] - sv[0] * dv[1]) / denom)
    tx = float(source[0, 0] - (a * dest[0, 0] - b * dest[0, 1]))
    ty = float(source[0, 1] - (b * dest[0, 0] + a * dest[0, 1]))
    return (a, -b, tx, b, a, ty)


def split_and_transform(keyed: Image.Image) -> tuple[Image.Image, Image.Image, Image.Image, Image.Image, dict]:
    rgba = np.asarray(keyed, dtype=np.uint8)
    yy, xx = np.indices((HEIGHT, WIDTH), dtype=np.float64)
    opaque = rgba[:, :, 3] > 0
    upper_distance = squared_segment_distance(xx, yy, SOURCE_SHOULDER, SOURCE_ELBOW)
    return_distance = squared_segment_distance(xx, yy, SOURCE_ELBOW, SOURCE_GRIP)
    elbow_distance = (xx - SOURCE_ELBOW[0]) ** 2 + (yy - SOURCE_ELBOW[1]) ** 2
    upper_t = source_projection(xx, yy, SOURCE_SHOULDER, SOURCE_ELBOW)
    return_t = source_projection(xx, yy, SOURCE_ELBOW, SOURCE_GRIP)

    source_upper_anchor = SOURCE_SHOULDER + UPPER_MAP_T * (SOURCE_ELBOW - SOURCE_SHOULDER)
    source_grip_anchor = SOURCE_ELBOW + RETURN_MAP_T * (SOURCE_GRIP - SOURCE_ELBOW)
    upper_mask = opaque & (upper_t >= 0.0) & (
        (upper_distance <= return_distance) | (elbow_distance <= ELBOW_OVERLAP_SOURCE_RADIUS ** 2)
    )
    return_mask = opaque & (return_t <= 1.0) & (
        (return_distance < upper_distance) | (elbow_distance <= ELBOW_OVERLAP_SOURCE_RADIUS ** 2)
    )

    source_pairs = [
        np.stack((source_upper_anchor, SOURCE_ELBOW)),
        np.stack((SOURCE_ELBOW, source_grip_anchor)),
    ]
    dest_pairs = [np.stack((SHOULDER, ELBOW)), np.stack((ELBOW, GRIP))]
    masks = [upper_mask, return_mask]
    pieces: list[Image.Image] = []
    transformed: list[Image.Image] = []
    transforms: list[tuple[float, ...]] = []
    scales: list[float] = []
    for mask, source_pair, dest_pair in zip(masks, source_pairs, dest_pairs):
        layer = rgba.copy()
        layer[:, :, 3] = np.where(mask, rgba[:, :, 3], 0)
        layer[layer[:, :, 3] == 0, :3] = 0
        piece = Image.fromarray(layer, "RGBA")
        coeffs = inverse_similarity(source_pair, dest_pair)
        warped = piece.transform(
            (WIDTH, HEIGHT),
            Image.Transform.AFFINE,
            coeffs,
            resample=Image.Resampling.BICUBIC,
            fillcolor=(0, 0, 0, 0),
        )
        pieces.append(piece)
        transformed.append(warped)
        transforms.append(coeffs)
        scales.append(float(np.linalg.norm(dest_pair[1] - dest_pair[0]) / np.linalg.norm(source_pair[1] - source_pair[0])))

    joined = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    joined.alpha_composite(transformed[0])
    joined.alpha_composite(transformed[1])
    joined_array = np.asarray(joined, dtype=np.uint8).copy()
    main_component, sizes = largest_component(joined_array[:, :, 3] >= 8)
    joined_array[~main_component] = 0
    joined = Image.fromarray(joined_array, "RGBA")

    return pieces[0], pieces[1], transformed[0], transformed[1], {
        "joined": joined,
        "source_pairs": [pair.tolist() for pair in source_pairs],
        "destination_pairs": [pair.tolist() for pair in dest_pairs],
        "output_to_input_similarity_coefficients": [list(c) for c in transforms],
        "uniform_similarity_scales": scales,
        "perpendicular_scale_equals_longitudinal_scale": True,
        "upper_internal_mapping_t": UPPER_MAP_T,
        "return_internal_mapping_t": RETURN_MAP_T,
        "terminal_material_retained_beyond_mapped_anchors": True,
        "elbow_overlap_source_radius_px": ELBOW_OVERLAP_SOURCE_RADIUS,
        "joined_component_sizes_before_retention": sizes,
    }


def fit_background_plane(base: np.ndarray) -> np.ndarray:
    yy, xx = np.indices(base.shape[:2])
    region = (xx >= 250) & (xx <= 720) & (yy >= 340) & (yy <= 930)
    bright = base.min(axis=2) > 225
    sample = region & bright
    design = np.column_stack((xx[sample], yy[sample], np.ones(int(sample.sum()))))
    full_design = np.column_stack((xx.ravel(), yy.ravel(), np.ones(xx.size)))
    plane = np.empty_like(base)
    for channel in range(3):
        coefficients, *_ = np.linalg.lstsq(design, base[:, :, channel][sample], rcond=None)
        plane[:, :, channel] = np.clip(full_design @ coefficients, 0, 255).reshape(base.shape[:2]).astype(np.uint8)
    return plane


def composite(base: np.ndarray, cutout: Image.Image, revised: np.ndarray, grip_disk: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    effective = revised & ~grip_disk
    plane = fit_background_plane(base)
    # A strictly inside-only edge feather prevents a hard pale seam while ensuring the
    # outside remains byte/pixel identical after the final authoritative restore.
    blurred = np.asarray(Image.fromarray((effective * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2.0)), dtype=np.float32) / 255.0
    clear_alpha = blurred * effective.astype(np.float32)
    cleared = np.rint(plane * clear_alpha[:, :, None] + base * (1.0 - clear_alpha[:, :, None])).astype(np.uint8)

    cut = np.asarray(cutout, dtype=np.uint8)
    alpha = (cut[:, :, 3].astype(np.float32) / 255.0) * effective.astype(np.float32)
    foreground = (alpha >= (8.0 / 255.0)) & effective
    foreground_main, _ = largest_component(foreground)
    alpha *= foreground_main.astype(np.float32)
    composed = np.rint(cut[:, :, :3] * alpha[:, :, None] + cleared * (1.0 - alpha[:, :, None])).astype(np.uint8)

    # Exact prescribed restoration order.
    composed[grip_disk] = base[grip_disk]
    composed[~revised] = base[~revised]
    # Remove isolated resampling/plane-fit change speckles. The single retained change
    # component is the one spanning the complete local arm construction.
    changed = np.any(composed != base, axis=2)
    changed_main, _ = largest_component(changed)
    composed[changed & ~changed_main] = base[changed & ~changed_main]
    return composed, cleared, foreground_main, effective


def draw_guide(path: Path) -> None:
    image = Image.new("RGB", (WIDTH, HEIGHT), (247, 248, 251))
    draw = ImageDraw.Draw(image, "RGBA")
    for gx in range(0, WIDTH, 64):
        draw.line((gx, 0, gx, HEIGHT), fill=(216, 221, 230, 255), width=1)
    for gy in range(0, HEIGHT, 64):
        draw.line((0, gy, WIDTH, gy), fill=(216, 221, 230, 255), width=1)
    draw.rounded_rectangle((24, 24, WIDTH - 24, HEIGHT - 24), radius=18, outline=(40, 51, 68, 255), width=4)
    points = [tuple(map(int, p)) for p in DEST_ANCHORS]
    draw.polygon(points, fill=(244, 217, 155, 140))
    draw.line((points[0], points[1]), fill=(49, 95, 168, 40), width=124)
    draw.line((points[1], points[2]), fill=(112, 72, 168, 40), width=106)
    draw.line(points, fill=(23, 43, 77, 255), width=8, joint="curve")
    colors = [(46, 125, 50, 255), (198, 40, 40, 255), (0, 131, 143, 255)]
    radii = [17, 17, 24]
    for point, color, radius in zip(points, colors, radii):
        x, y = point
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=color, outline=(255, 255, 255, 255), width=5)
    font = ImageFont.load_default(size=22)
    title_font = ImageFont.load_default(size=32)
    draw.text((58, 58), "P10 ROUND017 - LOCAL CONSTRAINT RELEASE", fill=(23, 43, 77, 255), font=title_font)
    draw.text((58, 100), "Original public-safe geometry only - 1536 x 1024", fill=(23, 43, 77, 255), font=font)
    draw.text((630, 440), "SHOULDER (604,472)", fill=(23, 43, 77, 255), font=font)
    draw.text((120, 875), "ELBOW (370,845)", fill=(23, 43, 77, 255), font=font)
    draw.text((480, 600), "GRIP (450,625) - restore r=24", fill=(23, 43, 77, 255), font=font)
    draw.text((500, 760), "closed triangle - dilation r=62", fill=(23, 43, 77, 255), font=font)
    save_png(image, path)


def render_mask(revised: np.ndarray, current: np.ndarray, released: np.ndarray, grip_disk: np.ndarray, path: Path) -> None:
    rgb = np.zeros((HEIGHT, WIDTH, 3), dtype=np.uint8)
    rgb[current] = (240, 240, 240)
    rgb[released] = (220, 60, 160)
    rgb[grip_disk] = (0, 200, 220)
    image = Image.fromarray(rgb, "RGB")
    draw = ImageDraw.Draw(image)
    draw.line([tuple(map(int, p)) for p in DEST_ANCHORS], fill=(255, 190, 30), width=3)
    for p in DEST_ANCHORS:
        x, y = map(int, p)
        draw.ellipse((x - 5, y - 5, x + 5, y + 5), fill=(255, 255, 255))
    save_png(image, path)


def cross_section_widths(foreground: np.ndarray, p0: np.ndarray, p1: np.ndarray) -> list[int]:
    widths: list[int] = []
    vector = p1 - p0
    length = float(np.linalg.norm(vector))
    normal = np.array([-vector[1], vector[0]]) / length
    for t in (0.20, 0.35, 0.50, 0.65, 0.80):
        center = p0 + t * vector
        hits: list[bool] = []
        for offset in range(-90, 91):
            sample = np.rint(center + normal * offset).astype(int)
            x, y = int(sample[0]), int(sample[1])
            hits.append(bool(0 <= x < WIDTH and 0 <= y < HEIGHT and foreground[y, x]))
        indices = [i for i, value in enumerate(hits) if value]
        if not indices:
            widths.append(0)
            continue
        center_index = min(indices, key=lambda i: abs(i - 90))
        left = center_index
        right = center_index
        while left > 0 and hits[left - 1]:
            left -= 1
        while right + 1 < len(hits) and hits[right + 1]:
            right += 1
        widths.append(right - left + 1)
    return widths


def make_judge_panel(base: np.ndarray, final: np.ndarray, rendered_mask: Image.Image, foreground: np.ndarray, wedge: np.ndarray, path: Path) -> None:
    crop_box = (280, 360, 700, 950)
    crop_width = crop_box[2] - crop_box[0]
    crop_height = crop_box[3] - crop_box[1]
    pad = 20
    label_h = 34
    panel = Image.new("RGB", (pad * 3 + crop_width * 2, pad * 3 + (crop_height + label_h) * 2), (28, 32, 40))
    font = ImageFont.load_default(size=20)

    base_crop = Image.fromarray(base, "RGB").crop(crop_box)
    final_crop = Image.fromarray(final, "RGB").crop(crop_box)
    mask_crop = rendered_mask.convert("RGB").crop(crop_box)
    overlay = final.copy()
    overlay[foreground] = np.rint(overlay[foreground] * 0.55 + np.array([0, 210, 255]) * 0.45).astype(np.uint8)
    overlay[wedge] = np.array([255, 230, 30], dtype=np.uint8)
    overlay_crop = Image.fromarray(overlay, "RGB").crop(crop_box)

    cells = [
        ("SEALED ROUND013 CROP", base_crop),
        ("ROUND017 STRONGEST FULL-WIDTH", final_crop),
        ("REVISED MASK", mask_crop),
        ("CYAN FOREGROUND / YELLOW WEDGE", overlay_crop),
    ]
    draw = ImageDraw.Draw(panel)
    for index, (label, image) in enumerate(cells):
        col = index % 2
        row = index // 2
        x = pad + col * (crop_width + pad)
        y = pad + row * (crop_height + label_h + pad)
        draw.text((x, y), label, fill=(240, 244, 250), font=font)
        panel.paste(image, (x, y + label_h))
    save_png(panel, path)


def theoretical_wedge_table(triangle: np.ndarray) -> list[dict]:
    yy, xx = np.indices((HEIGHT, WIDTH), dtype=np.float64)
    du = squared_segment_distance(xx, yy, SHOULDER, ELBOW)
    dr = squared_segment_distance(xx, yy, ELBOW, GRIP)
    table = []
    for upper_width, return_width in ((124, 106), (70, 64), (20, 16)):
        tubes = (du <= (upper_width / 2.0) ** 2) | (dr <= (return_width / 2.0) ** 2)
        table.append({
            "upper_total_width_px": upper_width,
            "return_total_width_px": return_width,
            "triangle_pixels": int(triangle.sum()),
            "tube_occupied_triangle_pixels": int((triangle & tubes).sum()),
            "pale_triangle_pixels_remaining": int((triangle & ~tubes).sum()),
        })
    return table


def main() -> None:
    ITER.mkdir(parents=True, exist_ok=True)
    ANALYSIS.mkdir(parents=True, exist_ok=True)

    base = np.asarray(Image.open(BASE_PATH).convert("RGB"), dtype=np.uint8)
    current = np.asarray(Image.open(CURRENT_FINAL_MASK_PATH).convert("L"), dtype=np.uint8) == 255
    corridor = np.asarray(Image.open(CORRIDOR_PATH).convert("L"), dtype=np.uint8) == 255
    hilt = np.asarray(Image.open(HILT_PATH).convert("L"), dtype=np.uint8) == 255
    rear = np.asarray(Image.open(REAR_PATH).convert("L"), dtype=np.uint8) == 255
    protected = hilt | rear
    triangle, dilated_triangle = closed_triangle_and_dilation()
    released = protected & dilated_triangle
    revised = current | released
    grip_disk = circle_mask(GRIP, 24.0)
    effective = revised & ~grip_disk

    # Exact masks and original guide.
    mask_paths = {
        "triangle": ROOT / "P10_Round017_ClosedTargetTriangle_binary.png",
        "dilated_triangle": ROOT / "P10_Round017_ClosedTargetTriangleDilated62_binary.png",
        "released": ROOT / "P10_Round017_LocallyReleasedProtection_binary.png",
        "revised": ROOT / "P10_Round017_RevisedEditableMask_binary.png",
        "grip_disk": ROOT / "P10_Round017_GripRestoreDisk24_binary.png",
        "effective": ROOT / "P10_Round017_EffectiveCompositeMask_binary.png",
    }
    mask_arrays = {
        "triangle": triangle,
        "dilated_triangle": dilated_triangle,
        "released": released,
        "revised": revised,
        "grip_disk": grip_disk,
        "effective": effective,
    }
    for name, path in mask_paths.items():
        save_png(Image.fromarray((mask_arrays[name] * 255).astype(np.uint8), "L"), path)
    render_mask(revised, current, released, grip_disk, ROOT / "P10_Round017_RevisedEditableMask_rendered.png")
    draw_guide(ROOT / "P10_Round017_OriginalLocalConstraintGuide.png")

    # Preserve the exact prior raw/keyed inputs locally; derive the used despilled key.
    local_raw = ITER / "P10_Round017_candidate01_c04_raw_baked_green.png"
    local_prior_key = ITER / "P10_Round017_candidate01_c04_prior_keyed_source.png"
    shutil.copyfile(C04_RAW_PATH, local_raw)
    shutil.copyfile(C04_KEYED_PATH, local_prior_key)
    keyed, key_report = key_and_despill(Image.open(local_raw))
    keyed_path = ITER / "P10_Round017_candidate01_c04_keyed_despilled.png"
    save_png(keyed, keyed_path)
    prior_alpha = np.asarray(Image.open(local_prior_key).convert("RGBA"), dtype=np.uint8)[:, :, 3]
    used_alpha = np.asarray(keyed, dtype=np.uint8)[:, :, 3]
    key_report["used_alpha_byte_identical_to_round016_keyed_alpha"] = bool(np.array_equal(prior_alpha, used_alpha))

    socket_closed, socket_report = close_socket_holes(keyed)
    socket_closed_path = ITER / "P10_Round017_candidate01_c04_keyed_socket_closed.png"
    save_png(socket_closed, socket_closed_path)
    key_report["same_source_texture_socket_closures"] = socket_report

    upper_piece, return_piece, upper_warp, return_warp, transform_report = split_and_transform(socket_closed)
    joined = transform_report.pop("joined")
    paths = {
        "upper_source_piece": ITER / "P10_Round017_candidate01_upper_source_piece.png",
        "return_source_piece": ITER / "P10_Round017_candidate01_return_source_piece.png",
        "upper_similarity_warp": ITER / "P10_Round017_candidate01_upper_similarity_warp.png",
        "return_similarity_warp": ITER / "P10_Round017_candidate01_return_similarity_warp.png",
        "joined_cutout": ITER / "P10_Round017_candidate01_joined_at_elbow.png",
    }
    for image, path in zip((upper_piece, return_piece, upper_warp, return_warp, joined), paths.values()):
        save_png(image, path)

    final, cleared, foreground, effective_check = composite(base, joined, revised, grip_disk)
    assert np.array_equal(effective, effective_check)
    cleared_path = ITER / "P10_Round017_candidate01_local_clear.png"
    foreground_path = ITER / "P10_Round017_candidate01_changed_limb_foreground_binary.png"
    composite_path = ITER / "P10_Round017_candidate01_composite_preseal.png"
    accepted_path = ROOT / "P10_Round017_NyraKestrel_LocalConstraintRelease_v1.png"
    save_png(Image.fromarray(cleared, "RGB"), cleared_path)
    save_png(Image.fromarray((foreground * 255).astype(np.uint8), "L"), foreground_path)
    save_png(Image.fromarray(final, "RGB"), composite_path)
    shutil.copyfile(composite_path, accepted_path)

    # Exact final validation.
    diff = np.any(final != base, axis=2)
    diff_largest, diff_sizes = largest_component(diff)
    foreground_largest, foreground_sizes = largest_component(foreground)
    assert np.array_equal(foreground, foreground_largest)
    yy, xx = np.indices((HEIGHT, WIDTH), dtype=np.float64)
    shoulder_n = (xx - SHOULDER[0]) ** 2 + (yy - SHOULDER[1]) ** 2 <= 32.0 ** 2
    elbow_n = (xx - ELBOW[0]) ** 2 + (yy - ELBOW[1]) ** 2 <= 32.0 ** 2
    grip_annulus = ((xx - GRIP[0]) ** 2 + (yy - GRIP[1]) ** 2 <= 36.0 ** 2) & ~grip_disk

    pale = (final.min(axis=2) >= 220) & ((final.max(axis=2).astype(np.int16) - final.min(axis=2).astype(np.int16)) <= 26)
    wedge = triangle & pale & ~foreground & ~grip_disk
    wedge_largest, wedge_sizes = largest_component(wedge)
    head_proxy = circle_mask(np.array([100.0, 100.0]), 42.0)

    green_contamination = diff & (
        (final[:, :, 1].astype(np.int16) > final[:, :, 0].astype(np.int16) + 55)
        & (final[:, :, 1].astype(np.int16) > final[:, :, 2].astype(np.int16) + 55)
        & (final[:, :, 1] > 120)
    )
    upper_widths = cross_section_widths(foreground, SHOULDER, ELBOW)
    return_widths = cross_section_widths(foreground, ELBOW, GRIP)
    return_vector = GRIP - ELBOW
    return_angle = math.degrees(math.atan2(-return_vector[1], return_vector[0]))

    target_crop_path = ANALYSIS / "P10_Round017_StrongestTargetCrop_2x.png"
    judge_panel_path = ANALYSIS / "P10_Round017_JudgePanel.png"
    target_crop = Image.fromarray(final, "RGB").crop((280, 360, 700, 950)).resize((840, 1180), Image.Resampling.LANCZOS)
    save_png(target_crop, target_crop_path)
    make_judge_panel(
        base,
        final,
        Image.open(ROOT / "P10_Round017_RevisedEditableMask_rendered.png"),
        foreground,
        wedge_largest,
        judge_panel_path,
    )

    counts = {
        "canvas_pixels": int(WIDTH * HEIGHT),
        "current_round016_final_editable_pixels": int(current.sum()),
        "prior_corridor_pixels": int(corridor.sum()),
        "closed_triangle_pixels": int(triangle.sum()),
        "triangle_dilated_62_pixels": int(dilated_triangle.sum()),
        "currently_protected_union_pixels": int(protected.sum()),
        "locally_released_protected_pixels": int(released.sum()),
        "released_inside_prior_corridor_pixels": int((released & corridor).sum()),
        "released_outside_prior_corridor_but_inside_dilated_triangle_pixels": int((released & ~corridor).sum()),
        "released_hilt_only_pixels": int((released & hilt & ~rear).sum()),
        "released_rear_only_pixels": int((released & rear & ~hilt).sum()),
        "released_hilt_and_rear_overlap_pixels": int((released & hilt & rear).sum()),
        "revised_editable_mask_pixels": int(revised.sum()),
        "grip_restore_disk_pixels": int(grip_disk.sum()),
        "grip_restore_disk_inside_revised_mask_pixels": int((grip_disk & revised).sum()),
        "effective_composite_mask_pixels": int(effective.sum()),
        "final_changed_pixels": int(diff.sum()),
        "final_changed_inside_revised_mask_pixels": int((diff & revised).sum()),
        "final_changed_outside_revised_mask_pixels": int((diff & ~revised).sum()),
        "final_changed_inside_grip_disk_pixels": int((diff & grip_disk).sum()),
        "final_changed_hilt_zone_pixels": int((diff & hilt).sum()),
        "final_changed_rear_zone_pixels": int((diff & rear).sum()),
        "changed_limb_foreground_pixels": int(foreground.sum()),
        "green_key_contamination_pixels_among_changes": int(green_contamination.sum()),
    }

    wedge_metrics = {
        "triangle_pixels": int(triangle.sum()),
        "pale_nonforeground_pixels_in_triangle_total": int(wedge.sum()),
        "pale_component_count": len(wedge_sizes),
        "largest_uninterrupted_pale_component_pixels": int(wedge_sizes[0] if wedge_sizes else 0),
        "head_sized_area_proxy_definition": "integer pixel-center disk of radius 42 px",
        "head_sized_area_proxy_pixels": int(head_proxy.sum()),
        "largest_wedge_to_head_proxy_ratio": float((wedge_sizes[0] if wedge_sizes else 0) / head_proxy.sum()),
        "head_sized_wedge_pass": bool(wedge_sizes and wedge_sizes[0] >= 0.80 * head_proxy.sum()),
        "theoretical_fixed_anchor_width_tradeoff": theoretical_wedge_table(triangle),
    }
    connectivity = {
        "all_changed_pixels_8_connected_component_count": len(diff_sizes),
        "all_changed_pixels_component_sizes": diff_sizes,
        "all_changed_pixels_single_component": len(diff_sizes) == 1,
        "changed_pixels_in_shoulder_radius32": int((diff & shoulder_n).sum()),
        "changed_pixels_in_elbow_radius32": int((diff & elbow_n).sum()),
        "changed_pixels_in_grip_annulus_r24_to_r36": int((diff & grip_annulus).sum()),
        "foreground_8_connected_component_count": len(foreground_sizes),
        "foreground_component_sizes": foreground_sizes,
        "single_component": len(foreground_sizes) == 1,
        "foreground_pixels_in_shoulder_radius32": int((foreground & shoulder_n).sum()),
        "foreground_pixels_in_elbow_radius32": int((foreground & elbow_n).sum()),
        "foreground_pixels_in_grip_annulus_r24_to_r36": int((foreground & grip_annulus).sum()),
        "spans_all_anchor_neighborhoods": bool((foreground & shoulder_n).any() and (foreground & elbow_n).any() and (foreground & grip_annulus).any()),
        "upper_cross_section_width_samples_px": upper_widths,
        "return_cross_section_width_samples_px": return_widths,
        "upper_median_width_px": float(np.median(upper_widths)),
        "return_median_width_px": float(np.median(return_widths)),
        "elbow_to_grip_vector_px": return_vector.astype(int).tolist(),
        "elbow_to_grip_length_px": float(np.linalg.norm(return_vector)),
        "up_right_return_angle_degrees_from_positive_x_with_screen_y_inverted": return_angle,
        "steep_up_right_return_survives": bool(return_vector[0] > 0 and return_vector[1] < 0 and abs(return_vector[1]) / return_vector[0] >= 2.0),
    }

    hard_checks = {
        "accepted_byte_identical_to_candidate01_composite": accepted_path.read_bytes() == composite_path.read_bytes(),
        "all_pixels_outside_revised_mask_equal_round013": bool(np.array_equal(final[~revised], base[~revised])),
        "all_grip_disk_pixels_equal_round013": bool(np.array_equal(final[grip_disk], base[grip_disk])),
        "revised_mask_unique_values_are_0_255": sorted(np.unique(np.asarray(Image.open(mask_paths["revised"]))).tolist()) == [0, 255],
        "effective_mask_equals_revised_minus_grip_disk": bool(np.array_equal(effective, revised & ~grip_disk)),
        "one_connected_foreground_component": connectivity["single_component"],
        "all_changed_pixels_one_8_connected_component": connectivity["all_changed_pixels_single_component"],
        "foreground_spans_anchor_neighborhoods": connectivity["spans_all_anchor_neighborhoods"],
        "steep_up_right_return_survives": connectivity["steep_up_right_return_survives"],
        "no_green_key_contamination": int(green_contamination.sum()) == 0,
        "head_sized_pale_wedge": wedge_metrics["head_sized_wedge_pass"],
    }
    eligibility = "PASS" if all(hard_checks.values()) else "FAIL"

    report = {
        "schema": "codexofwar.p10-round017-local-constraint-validation",
        "version": "1.0.0",
        "generated_utc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "disposition": "PROMOTE_STRONGEST_C04_SPLIT_TRANSFORM_AS_JUDGEABLE_PROOF_WITH_FAIL_CLOSED",
        "builder_eligibility": eligibility,
        "attempts": {
            "deterministic_split_transform_attempts": 1,
            "image_generation_attempts": 0,
            "image_generation_cap": 4,
            "reason_no_generation_spent": "Fixed-anchor full-width geometry preflight proves a head-sized interior wedge cannot coexist with anatomical widths; generation cannot change that authorized geometry.",
        },
        "anchors": {
            "shoulder": SHOULDER.astype(int).tolist(),
            "elbow": ELBOW.astype(int).tolist(),
            "grip": GRIP.astype(int).tolist(),
        },
        "mask_definition": {
            "raster_rule": "integer pixel centers; inclusive closed triangle; Euclidean closed-set dilation distance <= 62 px",
            "formula": "revised = round016_final OR ((hilt_protection OR rear_leg_protection) AND dilate(closed_triangle, 62px))",
            "post_composite_restore": "inclusive Euclidean disk distance <= 24 px centered at grip",
            "effective_formula": "effective = revised AND NOT grip_disk",
            "counts": counts,
        },
        "keying": key_report,
        "split_transform": transform_report,
        "connectivity_and_thickness": connectivity,
        "wedge_metrics": wedge_metrics,
        "hard_checks": hard_checks,
        "hard_check_pass_count": sum(bool(v) for v in hard_checks.values()),
        "hard_check_total": len(hard_checks),
        "limitations": [
            "The final full-width limb is connected and exact-local, but the largest uninterrupted pale wedge is far below the head-sized area proxy.",
            "Local hilt and rear-leg protection pixels inside the revised mask are intentionally no longer immutable; exact affected counts are recorded.",
            "The source is a baked green-field RGB image; transparency is deterministic key-derived, never claimed native.",
            "This is an isolated builder proof only; no Unity work was performed.",
        ],
        "authorities": {
            "round013_base": file_record(BASE_PATH),
            "round016_current_final_mask": file_record(CURRENT_FINAL_MASK_PATH),
            "round016_corridor": file_record(CORRIDOR_PATH),
            "round016_hilt_protection": file_record(HILT_PATH),
            "round016_rear_protection": file_record(REAR_PATH),
            "round016_c04_raw": file_record(C04_RAW_PATH),
            "round016_c04_keyed": file_record(C04_KEYED_PATH),
        },
        "outputs": {
            "accepted": file_record(accepted_path),
            "candidate01_composite": file_record(composite_path),
            "raw_local_copy": file_record(local_raw),
            "prior_keyed_local_copy": file_record(local_prior_key),
            "used_keyed_despilled": file_record(keyed_path),
            "used_keyed_socket_closed": file_record(socket_closed_path),
            "upper_source_piece": file_record(paths["upper_source_piece"]),
            "return_source_piece": file_record(paths["return_source_piece"]),
            "upper_similarity_warp": file_record(paths["upper_similarity_warp"]),
            "return_similarity_warp": file_record(paths["return_similarity_warp"]),
            "joined_cutout": file_record(paths["joined_cutout"]),
            "local_clear": file_record(cleared_path),
            "foreground_binary": file_record(foreground_path),
            "coordinate_guide_svg": file_record(ROOT / "P10_Round017_OriginalLocalConstraintGuide.svg"),
            "coordinate_guide_png": file_record(ROOT / "P10_Round017_OriginalLocalConstraintGuide.png"),
            "revised_mask_rendered": file_record(ROOT / "P10_Round017_RevisedEditableMask_rendered.png"),
            "strongest_target_crop_2x": file_record(target_crop_path),
            "judge_panel": file_record(judge_panel_path),
            "masks": {name: file_record(path) for name, path in mask_paths.items()},
        },
    }

    validation_path = ROOT / "P10_Round017_Validation.json"
    validation_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "builder_eligibility": eligibility,
        "accepted": report["outputs"]["accepted"],
        "revised_mask": report["outputs"]["masks"]["revised"],
        "counts": counts,
        "connectivity": connectivity,
        "wedge": wedge_metrics,
        "hard_checks": hard_checks,
        "validation_sha256": sha256(validation_path),
    }, indent=2))


if __name__ == "__main__":
    main()
