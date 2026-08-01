#!/usr/bin/env python3
"""Seal the deterministic P10 Round016 receipt and README from current artifacts."""

from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import re

from PIL import Image


ROOT = Path(__file__).resolve().parent
P10 = ROOT.parent.parent
BASE = P10 / "Round013" / "ElbowReturnTriangle" / "Iterations" / "P10_Round013_ElbowReturnTriangle_candidate04.png"
COORD = P10 / "Round014" / "TrailingReturnWedge" / "Iterations" / "P10_Round014_TrailingReturnWedge_candidate04.png"
EVIDENCE = ROOT / "P10_Round016_DeterministicCompositeEvidence.json"
ACCEPTED = ROOT / "P10_Round016_NyraKestrel_TwoSegmentLimb_v1.png"
SOURCE = ROOT / "Iterations" / "P10_Round016_TwoSegmentLimb_candidate04_protected.png"
RECEIPT = ROOT / "P10_Round016_TwoSegmentLimbReceipt.json"
README = ROOT / "README.md"

PRESCRIPTION = "Freeze the sealed Round013 authority and its already-correct original grip, hilt, rear leg, leading arm, identity, lighting, and framing; inside one newly verified trailing-arm-only hard mask, replace only the trailing limb between shoulder and preserved grip with an anatomical two-segment silhouette that descends to Round014 candidate04's far-low-left elbow vertex and reverses steeply up-right to the original inward grip, leaving one uninterrupted head-sized pale wedge between the segments; change nothing else."

PROMPTS = {
    1: """Use case: stylized-concept
Asset type: isolated original 2D armored trailing-limb cutout, P10 Round016 Two-Segment Limb, candidate 01 of 04
Input role: Image 1 is an ORIGINAL public-safe exact-anchor geometry guide only. Follow its shoulder center at screen x604,y472, elbow center x370,y845, and terminal wrist/hand interface x450,y625 on a 1536x1024 canvas. Do not render its text, labels, arrows, circles, colored guide lines, protected hilt, protected leg, torso diagram, or border.
Primary request: Generate ONLY one isolated armored left arm/sleeve cutout, with no body and no weapon. The upper arm descends from shoulder x604,y472 far down-left to an unmistakable anatomical elbow vertex at x370,y845. At that elbow the forearm makes a sharp reversal and rises steeply up-right to end at the preserved inward grip interface x450,y625. Two distinct connected anatomical segments; deep V silhouette; one uninterrupted pale/transparent head-sized wedge between the segments.
Style/material: premium original 2D painterly character-concept cutout matching dark blackened-steel segmented bracers, deep cobalt quilted cloth, tiny restrained oxidized-copper fasteners; realistic anatomy and restrained studio light from upper-left.
Composition: full 1536x1024 landscape coordinate field; all nontransparent pixels confined to the one arm around the exact anchors.
Output: transparent background preferred; otherwise perfectly flat chroma-green keyable field with no shadow.
Constraints: exactly one arm only; no torso, head, hair, face, hand gripping a weapon, weapon, hilt, leg, boot, character, scenery, text, labels, arrows, circles, logo, watermark, particles, glow, motion blur, cast shadow, detached fragment, extra limb, redesign, or border. Original 2D only.""",
    2: """Use case: stylized-concept
Asset type: isolated original 2D armored trailing-limb cutout, P10 Round016 Two-Segment Limb, candidate 02 of 04
Input role: Image 1 is an ORIGINAL public-safe exact-anchor diagram only. Follow the three screen anchors on a 1536x1024 canvas: shoulder (604,472), far-low-left elbow (370,845), terminal inward-grip interface (450,625). Render none of the diagram, labels, arrows, hilt, protected leg, context shapes, or border.
Generate ONLY one connected armored limb on transparent background. Segment one runs shoulder to elbow. Segment two visibly reverses direction at the elbow and returns steeply up-right to the terminal interface. Emphasize the far-low-left elbow as the lowest and leftmost limb vertex. Preserve a clean uninterrupted transparent wedge between the two segments at least head-sized.
Appearance: original 2D painterly realistic fantasy armor; deep cobalt quilted upper sleeve, blackened-steel segmented elbow and forearm plates, restrained oxidized-copper rivets, upper-left studio light; crisp alpha edge.
No complete person, torso, head, face, hair, weapon, hilt, hand around an object, leg, boot, ground, shadow, scenery, diagram text, mark, logo, watermark, effect, extra limb, detached part, or crop. Exactly one isolated arm, fully inside 1536x1024.""",
    3: """Use case: stylized-concept
Asset type: isolated original 2D armored trailing-limb cutout, P10 Round016 Two-Segment Limb, candidate 03 of 04
Image 1 is an original geometry-only guide. Copy only its exact three anchor positions on the full 1536x1024 canvas: open shoulder socket centered (604,472), armored elbow joint centered (370,845), open wrist/grip-interface cuff centered (450,625). Render none of the guide graphics or contextual hilt/leg/body.
Generate exactly one connected bent arm cutout. From the shoulder socket it travels diagonally down-left to the far-low-left elbow. It then visibly reverses and travels steeply up-right to the wrist interface. The elbow is the lowest and leftmost point. The two thick segments must remain separated except at the elbow and leave the triangular interior transparent; do not straighten or mirror the V.
Materials: original 2D hand-painted realistic cobalt quilted sleeve and blackened-steel segmented armor, subtle copper rivets, restrained upper-left lighting, crisp silhouette.
Background: transparent alpha only, no checkerboard pattern drawn into pixels and no cast shadow.
Hard exclusions: no person, torso, shoulder body, head, face, hair, hand, weapon, hilt, grip object, leg, boot, ground, scenery, text, diagram, arrows, circles, border, watermark, logo, glow, particles, extra limb, detached pieces. One arm only.""",
    4: """Use case: stylized-concept
Asset type: isolated original 2D armored trailing-limb cutout, P10 Round016 Two-Segment Limb, candidate 04 of 04 FINAL CAP
Image 1 is original coordinate geometry only. On its full 1536x1024 field, place the shoulder opening exactly at (604,472), the anatomical elbow center exactly at (370,845), and the wrist opening exactly at (450,625). Render no guide graphics or context.
ONE OBJECT ONLY: a single connected deep-V armored arm. Upper arm descends down-left from shoulder to elbow. Forearm sharply reverses and rises steeply up-right from elbow to wrist. The elbow is the far-low-left vertex; preserve a clear open triangular wedge between segments. Do not straighten, mirror, rotate away from, or relocate this topology.
Appearance: original 2D realistic painterly concept-art cutout; deep cobalt quilted sleeve, blackened-steel segmented plates, restrained copper rivets; crisp edge, no shadow.
Background: perfectly uniform flat pure chroma green #00FF00 across every non-object pixel, with no checkerboard, texture, gradient, shadow, or halo.
No full character, torso, head, face, hair, hand, weapon, hilt, leg, boot, ground, scenery, labels, text, arrows, circles, border, logo, watermark, effects, extra limb, detached fragment. Exactly one isolated arm only. Final generation cap.""",
}

DECISIONS = {
    1: "REJECT: clear articulated V and good material family, but no native alpha; checkerboard is baked into RGB and exact placement requires deterministic keying and remapping.",
    2: "REJECT: essentially straight/monotonic and ineligible as a two-segment reversal; checkerboard is baked into RGB.",
    3: "REJECT: valid V source with bulky elbow, but checkerboard is baked into RGB and exact placement requires deterministic keying and remapping.",
    4: "STRONGEST SOURCE / PROTECTED FINAL FAIL: clean keyable green field and clearest deep V. Piecewise similarity mapping hits all anchors, but mandatory hilt/rear-leg restoration breaks the visible V and wedge and leaves a detached residual.",
}


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def record(path: Path, relative_to: Path = ROOT) -> dict:
    data = path.read_bytes()
    suffix = path.suffix.lower().lstrip(".")
    dims = None
    mode = None
    if suffix == "png":
        with Image.open(path) as im:
            dims = {"width": im.width, "height": im.height}
            mode = im.mode
    elif suffix == "svg":
        text = data.decode("utf-8")
        width = re.search(r'width="(\d+)"', text)
        height = re.search(r'height="(\d+)"', text)
        if width and height:
            dims = {"width": int(width.group(1)), "height": int(height.group(1))}
    return {
        "path": str(path.relative_to(relative_to)),
        "sha256": hashlib.sha256(data).hexdigest(),
        "byte_size": len(data),
        "dimensions_px": dims,
        "mode": mode,
        "format": suffix,
    }


def main() -> None:
    evidence = json.loads(EVIDENCE.read_text(encoding="utf-8"))
    base_record = record(BASE, P10)
    coord_record = record(COORD, P10)
    guide_svg = record(ROOT / "P10_Round016_OriginalTwoSegmentLimbGuide.svg")
    guide_png = record(ROOT / "P10_Round016_OriginalTwoSegmentLimbGuide.png")
    final_mask = record(ROOT / "P10_Round016_TrailingLimbHardMask_binary.png")

    artifacts = []
    for path in sorted(ROOT.rglob("*")):
        if not path.is_file() or path in {RECEIPT, README}:
            continue
        artifacts.append(record(path))

    attempts = []
    for item in evidence["candidates"]:
        i = item["candidate"]
        attempts.append({
            "candidate_id": f"two-segment-limb-candidate-{i:02d}",
            "generation_mode": "isolated original-2D limb generation from exact-anchor public-safe guide only; no whole-frame generation or inpainting",
            "input_roles": [{
                "role": "Round016 original public-safe exact-anchor geometry guide only; no supplied-image pixels",
                "path": guide_png["path"],
                "sha256": guide_png["sha256"],
            }],
            "exact_prompt": PROMPTS[i],
            "native_output_has_alpha": False,
            "raw_background_disposition": "RGB baked checkerboard" if i < 4 else "RGB clean keyable green field; requested green approximated rather than literal uniform #00FF00",
            "keying": {
                "candidates_01_to_03": "background iff minimum RGB > 218 and channel spread < 16; close alpha with 3x3 MaxFilter then 3x3 MinFilter; no native transparency claimed",
                "candidate_04": "background iff G > R+55, G > B+55, and G > 120; close alpha with 3x3 MaxFilter then 3x3 MinFilter; no native transparency claimed",
            },
            "source_anchors_shoulder_elbow_grip": item["source_anchors"],
            "destination_anchors_shoulder_elbow_grip": evidence["destination_anchors"],
            "piecewise_similarity_output_to_input": item["piecewise_similarity_output_to_input"],
            "lineage": {k: v for k, v in item.items() if k in {"raw", "keyed", "anchored", "composite", "protected"}},
            "pixel_equality": item["pixel_equality"],
            "native_builder_decision": DECISIONS[i],
        })

    accepted = record(ACCEPTED)
    source = record(SOURCE)
    receipt = {
        "schema": "codexofwar.original-2d-two-segment-limb-receipt",
        "version": "1.0.0",
        "receipt_id": "P10-Round016-TwoSegmentLimbReceipt",
        "generated_utc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "scope": {
            "project_asset": "P10 Nyra Kestrel",
            "round": "Round016",
            "judged_unit": "Two-Segment Limb Silhouette only",
            "scope_class": "one bounded original 2D trailing-limb cutout/composite proof only",
            "builder_eligibility": "FAIL",
            "final_disposition": "PROMOTED_CANDIDATE04_PROTECTED_COMPOSITE_BYTE_IDENTICALLY_AS_STRONGEST_BOUNDED_EVIDENCE_WITH_TARGET_FAIL",
            "attempt_cap": 4,
            "generated_outputs_spent": 4,
            "cap_exhausted": True,
            "fresh_criticism_performed": False,
            "paid_3d_generation_authorized": False,
            "engine_integration_authorized": False,
        },
        "exact_critic_prescription": PRESCRIPTION,
        "authorities": {
            "sealed_round013_base": {
                **base_record,
                "role": "untouched complete base and absolute authority for grip, hilt, rear leg, leading arm, identity, lighting, framing, and every non-target pixel",
            },
            "round014_candidate04_coordinate_authority_only": {
                **coord_record,
                "role": "coordinate authority only for the far-low-left elbow vertex at 370,845; its altered pixels were never supplied to generation, keying, compositing, or protection",
            },
            "exact_anchors": {
                "shoulder": [604, 472],
                "far_low_left_elbow": [370, 845],
                "preserved_inward_grip": [450, 625],
                "target_paths": ["M 604 472 L 370 845", "M 370 845 L 450 625"],
            },
        },
        "original_public_safe_guide": {
            "authorship": "original SVG; no embedded raster, external image, third-party pose pixels, franchise pixels, or supplied reference pixels",
            "svg": guide_svg,
            "rendered_png": guide_png,
        },
        "hard_mask": {
            "svg": record(ROOT / "P10_Round016_TrailingLimbHardMask.svg"),
            "binary_png": final_mask,
            "verified_unique_values": [0, 255],
            "meaning": "white is editable; black is sealed Round013 authority",
            "counts": evidence["mask_counts"],
            "occlusion_breakdown": {
                "hilt_only": evidence["mask_counts"]["corridor_pixels_occluded_by_hilt_zone"] - evidence["mask_counts"]["corridor_pixels_occluded_by_both_zones"],
                "rear_leg_only": evidence["mask_counts"]["corridor_pixels_occluded_by_rear_leg_zone"] - evidence["mask_counts"]["corridor_pixels_occluded_by_both_zones"],
                "both_hilt_and_rear_leg": evidence["mask_counts"]["corridor_pixels_occluded_by_both_zones"],
            },
            "centerline_samples": [
                {"point": [604,472], "protection": "editable"},
                {"point": [580,510], "protection": "editable"},
                {"point": [550,558], "protection": "hilt"},
                {"point": [520,606], "protection": "hilt+rear-leg"},
                {"point": [490,654], "protection": "hilt+rear-leg"},
                {"point": [460,702], "protection": "rear-leg"},
                {"point": [430,750], "protection": "rear-leg"},
                {"point": [400,798], "protection": "rear-leg"},
                {"point": [370,845], "protection": "rear-leg"},
                {"point": [390,790], "protection": "rear-leg"},
                {"point": [410,735], "protection": "rear-leg"},
                {"point": [430,680], "protection": "hilt"},
                {"point": [450,625], "protection": "hilt/preserved-grip"},
            ],
            "pixel_equality_evidence": {
                "every_candidate_all_pixels_outside_final_mask_equal_round013_base": True,
                "every_candidate_all_hilt_protection_zone_pixels_equal_round013_base": True,
                "every_candidate_all_rear_leg_protection_zone_pixels_equal_round013_base": True,
            },
        },
        "generation": {
            "execution_path": "managed image-generation tool",
            "model": "not exposed by managed tool",
            "native_output_size": "1536x1024",
            "output_format": "PNG RGB",
            "workflow": "isolated cutouts only; no Round015 whole-frame inpainting repeated; four raw outputs preserved",
            "attempts": attempts,
        },
        "accepted_copy": {
            **accepted,
            "source_candidate": str(SOURCE.relative_to(ROOT)),
            "source_sha256": source["sha256"],
            "byte_identical_to_source": ACCEPTED.read_bytes() == SOURCE.read_bytes(),
            "promotion_reason": "candidate04 is the cleanest keyable, most legible native deep-V source and the strongest deterministic exact-anchor composite, even though protection makes the final target fail",
        },
        "feasibility_finding": {
            "status": "MUTUALLY_INCOMPATIBLE_CONSTRAINTS_AT_CURRENT_ANCHORS",
            "finding": "The required elbow at 370,845 and the return centerline to the preserved grip at 450,625 lie on the sealed Round013 rear-leg and/or hilt/grip pixels. An honest mask that protects every such pixel necessarily occludes the elbow and every sampled point on the return, so it cannot simultaneously show one continuous elbow-to-grip forearm and an uninterrupted head-sized wedge.",
            "visible_protected_result": "Only a shoulder-side armored fragment and a small far-low residual remain visible after authoritative restoration; the V is broken, the return is not continuous, and the wedge is not established.",
            "builder_eligibility": "FAIL",
        },
        "native_decision": {
            "selected_candidate": 4,
            "unprotected_composite": "Has the intended deep-V source topology at exact anchors but includes socket-like holes and necessarily overwrites protected authority before restoration.",
            "protected_composite": "FAIL: protected hilt and rear leg are restored exactly, breaking the visible two-segment path and leaving a detached residual; no uninterrupted head-sized pale wedge.",
            "not_independent_criticism": True,
        },
        "candid_limitations": [
            "No generated raw has native alpha; candidates01-03 bake a checkerboard and candidate04 uses an approximated green key field.",
            "Exact anchors require deterministic piecewise similarity remapping rather than native generator placement.",
            "Candidate04 contains socket-like openings at limb endpoints and elbow that are not natural final anatomy.",
            "Mandatory protection removes 54,019 of 77,360 corridor pixels and makes the final visible limb discontinuous.",
            "The accepted copy is evidence preservation only and remains ineligible for the requested Two-Segment Limb Silhouette target.",
        ],
        "privacy_and_originality_scope": {
            "private_benchmark_archive_accessed": False,
            "third_party_pose_pixels_used": False,
            "franchise_pixels_used": False,
            "supplied_reference_pixels_beyond_bounded_project_authorities": False,
            "round014_pixels_used_in_generation_or_compositing": False,
            "personal_data_in_prompts_or_artifacts": False,
            "original_2d_only": True,
            "claims_not_made": [
                "benchmark pass, benchmark comparison, or benchmark victory",
                "successful Two-Segment Limb Silhouette",
                "paid-3D, 3D, rig, mesh, UV, deformation, collision, animation, LOD, engine, game-ready, or production-ready status",
                "legal originality, exclusivity, copyright clearance, or trademark clearance",
            ],
        },
        "round016_artifact_manifest_excluding_receipt_and_readme": artifacts,
    }
    RECEIPT.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")

    readme = f"""# P10 Round016 — Two-Segment Limb Silhouette

Disposition: **PROMOTED STRONGEST BOUNDED EVIDENCE; TARGET FAIL**.

The sealed Round013 candidate04 remains the untouched base. Round014 candidate04 contributes only the far-low-left elbow coordinate `(370,845)`; none of its altered pixels enter generation or compositing. The intended target is shoulder `(604,472)` → elbow `(370,845)` → steep up-right return → preserved grip `(450,625)`.

Four isolated limb-only outputs were generated. Candidate04 is strongest because its RGB green field keys cleanly and its native deep V maps exactly to the three anchors via two recorded similarity transforms. No raw output has native alpha; the keyed PNGs are deterministic derived cutouts.

The newly verified final binary mask has only values `0` and `255`. Of 77,360 unprotected corridor pixels, mandatory hilt/rear-leg restoration removes 54,019, leaving 23,341 editable. Candidate04 protection is pixel-identical to Round013 outside the final mask and throughout the complete conservative hilt and rear-leg protection zones.

Feasibility finding: the current anchor prescription and preserved-pixel constraints are mutually incompatible. The elbow coordinate and every sampled return-centerline point to the grip fall on protected rear-leg and/or hilt/grip pixels. The protected result therefore breaks the V, has no continuous steep return, leaves a detached residual, and does not establish an uninterrupted head-sized wedge. Builder eligibility remains **FAIL**.

Accepted evidence copy: `P10_Round016_NyraKestrel_TwoSegmentLimb_v1.png`
SHA-256: `{accepted['sha256']}`
Bytes: `{accepted['byte_size']}`
Dimensions: `1536x1024` RGB
Byte-identical source: `Iterations/P10_Round016_TwoSegmentLimb_candidate04_protected.png`

See `P10_Round016_TwoSegmentLimbReceipt.json` for exact prompts, input roles, hashes, byte counts, dimensions, key thresholds, transforms, cutout/composite lineage, mask proof, centerline occlusion evidence, native decisions, cap accounting, privacy, limitations, and the original-2D-only claim boundary. No fresh criticism was performed here.
"""
    README.write_text(readme, encoding="utf-8")


if __name__ == "__main__":
    main()
