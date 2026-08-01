#!/usr/bin/env python3
"""Validate the isolated Round005 alternate GLBs and evidence receipts.

This validator is intentionally standalone: it parses GLB/glTF structures and
PNG headers without loading repository runtime code or changing integration
state.  Run from any working directory with ``python3 validate_glbs.py``.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
import struct
from typing import Any


HERE = Path(__file__).resolve().parent
GLB_DIR = HERE / "glb"
REPORT_DIR = HERE / "reports"
BUILD_REPORT = REPORT_DIR / "build-report.json"
VALIDATION_REPORT = REPORT_DIR / "validation.json"

GLB_JSON_CHUNK = 0x4E4F534A
FROZEN_NON_PACKAGE_S04_TRIANGLES = 103_855
VISIBLE_TRIANGLE_LIMIT = 68_000
RENDERED_TRIANGLE_LIMIT = 250_000

TARGETS: dict[str, dict[str, Any]] = {
    "hero": {
        "file": "vespera_hero.glb",
        "clips": {"Idle_Loop", "Walk_Loop", "Sprint_Loop", "Roll", "Sword_Regular_A"},
        "nodes": {"weapon_socket"},
        "max_triangles": 46_000,
        "bones": 65,
        "skinned": True,
    },
    "hollow": {
        "file": "ossuary_hollow.glb",
        "clips": {"Idle", "HitReact", "Death"},
        "nodes": {"impact_socket"},
        "max_triangles": 21_000,
        "bones": 50,
        "skinned": True,
    },
    "weapon": {
        "file": "dawnbreak_claymore.glb",
        "clips": set(),
        "nodes": {"ClaymoreRoot", "GripPrimary", "GripSecondary", "ContactMarker", "BladeTip"},
        "max_triangles": 5_000,
        "bones": 0,
        "skinned": False,
    },
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def parse_glb(path: Path) -> dict[str, Any]:
    payload = path.read_bytes()
    if len(payload) < 20 or payload[:4] != b"glTF":
        raise ValueError(f"{path.name}: not a GLB")
    version, declared_length = struct.unpack_from("<II", payload, 4)
    if version != 2:
        raise ValueError(f"{path.name}: unsupported GLB version {version}")
    if declared_length != len(payload):
        raise ValueError(
            f"{path.name}: declared length {declared_length} != bytes {len(payload)}"
        )
    json_length, chunk_type = struct.unpack_from("<II", payload, 12)
    if chunk_type != GLB_JSON_CHUNK:
        raise ValueError(f"{path.name}: first GLB chunk is not JSON")
    end = 20 + json_length
    if end > len(payload):
        raise ValueError(f"{path.name}: truncated JSON chunk")
    return json.loads(payload[20:end].decode("utf-8").rstrip(" \t\r\n\0"))


def primitive_triangles(gltf: dict[str, Any], primitive: dict[str, Any]) -> int:
    mode = primitive.get("mode", 4)
    if "indices" in primitive:
        count = int(gltf["accessors"][primitive["indices"]]["count"])
    else:
        count = int(gltf["accessors"][primitive["attributes"]["POSITION"]]["count"])
    if mode == 4:  # TRIANGLES
        if count % 3:
            raise ValueError(f"indexed TRIANGLES accessor has non-multiple-of-three count {count}")
        return count // 3
    if mode in (5, 6):  # TRIANGLE_STRIP / TRIANGLE_FAN
        return max(0, count - 2)
    return 0


def animation_duration(gltf: dict[str, Any], animation: dict[str, Any]) -> float:
    duration = 0.0
    for sampler in animation.get("samplers", []):
        accessor = gltf["accessors"][sampler["input"]]
        maximum = accessor.get("max", [0.0])
        duration = max(duration, float(maximum[0] if maximum else 0.0))
    return duration


def inspect_asset(asset_id: str, target: dict[str, Any], build: dict[str, Any]) -> dict[str, Any]:
    path = GLB_DIR / target["file"]
    if not path.is_file():
        raise FileNotFoundError(path)
    gltf = parse_glb(path)
    if gltf.get("asset", {}).get("version") != "2.0":
        raise ValueError(f"{asset_id}: glTF asset version is not 2.0")
    if any("uri" in buffer for buffer in gltf.get("buffers", [])):
        raise ValueError(f"{asset_id}: GLB contains an external buffer URI")
    if any("uri" in image for image in gltf.get("images", [])):
        raise ValueError(f"{asset_id}: GLB contains an external image URI")

    primitives = [
        primitive
        for mesh in gltf.get("meshes", [])
        for primitive in mesh.get("primitives", [])
    ]
    triangles = sum(primitive_triangles(gltf, primitive) for primitive in primitives)
    clip_durations = {
        animation.get("name", ""): animation_duration(gltf, animation)
        for animation in gltf.get("animations", [])
    }
    clip_names = set(clip_durations)
    if clip_names != target["clips"]:
        raise ValueError(
            f"{asset_id}: exact clips {sorted(clip_names)} != {sorted(target['clips'])}"
        )
    node_names = {node.get("name", "") for node in gltf.get("nodes", [])}
    missing_nodes = target["nodes"] - node_names
    if missing_nodes:
        raise ValueError(f"{asset_id}: missing nodes {sorted(missing_nodes)}")
    if triangles > target["max_triangles"]:
        raise ValueError(
            f"{asset_id}: {triangles} triangles > asset limit {target['max_triangles']}"
        )

    skins = gltf.get("skins", [])
    joint_count = len(skins[0].get("joints", [])) if len(skins) == 1 else 0
    if target["skinned"]:
        if len(skins) != 1:
            raise ValueError(f"{asset_id}: expected exactly one skin, found {len(skins)}")
        if joint_count != target["bones"]:
            raise ValueError(
                f"{asset_id}: skin joints {joint_count} != expected {target['bones']}"
            )
        unskinned = [
            index
            for index, primitive in enumerate(primitives)
            if "JOINTS_0" not in primitive.get("attributes", {})
            or "WEIGHTS_0" not in primitive.get("attributes", {})
        ]
        if unskinned:
            raise ValueError(f"{asset_id}: unskinned visible primitives {unskinned}")
    elif skins:
        raise ValueError(f"{asset_id}: static weapon unexpectedly contains skins")

    digest = sha256(path)
    build_asset = build[asset_id]
    expected_digest = build_asset["output_sha256"]
    if digest != expected_digest:
        raise ValueError(f"{asset_id}: GLB hash differs from build report")
    expected_counts = {
        "triangles": int(build_asset["triangles"]),
        "primitives": int(build_asset["mesh_objects"]),
        "materials": int(build_asset["material_count"]),
        "textures": int(build_asset["texture_count"]),
    }
    actual_counts = {
        "triangles": triangles,
        "primitives": len(primitives),
        "materials": len(gltf.get("materials", [])),
        "textures": len(gltf.get("textures", [])),
    }
    if actual_counts != expected_counts:
        raise ValueError(
            f"{asset_id}: GLB counts {actual_counts} != build report {expected_counts}"
        )
    if path.stat().st_size != int(build_asset["bytes"]):
        raise ValueError(f"{asset_id}: byte size differs from build report")

    return {
        "file": f"glb/{path.name}",
        "bytes": path.stat().st_size,
        "sha256": digest,
        **actual_counts,
        "images": len(gltf.get("images", [])),
        "skins": len(skins),
        "joints": joint_count,
        "animations": dict(sorted(clip_durations.items())),
        "required_nodes": sorted(target["nodes"]),
        "self_contained": True,
    }


def png_dimensions(path: Path) -> tuple[int, int]:
    header = path.read_bytes()[:24]
    if len(header) != 24 or header[:8] != b"\x89PNG\r\n\x1a\n" or header[12:16] != b"IHDR":
        raise ValueError(f"{path.name}: invalid PNG header")
    return struct.unpack(">II", header[16:24])


def main() -> None:
    build = json.loads(BUILD_REPORT.read_text(encoding="utf-8"))
    if build.get("integrated") is not False or build.get("acceptance_claimed") is not False:
        raise ValueError("build report must remain non-integrated with no acceptance claim")

    assets = {
        asset_id: inspect_asset(asset_id, target, build)
        for asset_id, target in TARGETS.items()
    }
    visible_triangles = sum(int(asset["triangles"]) for asset in assets.values())
    visible_primitives = sum(int(asset["primitives"]) for asset in assets.values())
    materials = sum(int(asset["materials"]) for asset in assets.values())
    textures = sum(int(asset["textures"]) for asset in assets.values())
    projected_s04 = FROZEN_NON_PACKAGE_S04_TRIANGLES + 2 * visible_triangles
    if visible_triangles > VISIBLE_TRIANGLE_LIMIT:
        raise ValueError(
            f"visible package triangles {visible_triangles} > {VISIBLE_TRIANGLE_LIMIT}"
        )
    if projected_s04 > RENDERED_TRIANGLE_LIMIT:
        raise ValueError(f"projected S04 triangles {projected_s04} > {RENDERED_TRIANGLE_LIMIT}")

    package_receipt = build["package"]
    expected_package = {
        "visible_triangles": int(package_receipt["visible_triangles"]),
        "visible_primitives": int(package_receipt["visible_primitives"]),
        "materials": int(package_receipt["materials"]),
        "textures": int(package_receipt["textures"]),
    }
    actual_package = {
        "visible_triangles": visible_triangles,
        "visible_primitives": visible_primitives,
        "materials": materials,
        "textures": textures,
    }
    if actual_package != expected_package:
        raise ValueError(f"package GLB counts {actual_package} != build report {expected_package}")

    measurements = build["preview"]["contact_measurements"]
    grip_gates = {
        moment: float(measurements[moment]["secondary_palm_m"])
        for moment in ("S03_startup", "S04_contact", "S05_recovery")
    }
    if any(distance > 0.04 for distance in grip_gates.values()):
        raise ValueError(f"secondary palm gate failed: {grip_gates}")
    contact_distance = float(
        measurements["S04_contact"]["blade_to_actual_hollow_surface_m"]
    )
    if contact_distance > 0.08:
        raise ValueError(f"S04 actual mesh contact {contact_distance} m > 0.08 m")
    torso_clearance = float(measurements["S04_contact"]["torso_clearance_estimate_m"])
    if torso_clearance <= 0:
        raise ValueError(f"S04 torso clearance is non-positive: {torso_clearance} m")

    render_receipts = build["preview"]["renders"]
    required_renders = {
        "neutral.png",
        "neutral_close.png",
        "S03_startup.png",
        "S04_contact.png",
        "S05_recovery.png",
    }
    if set(render_receipts) != required_renders:
        raise ValueError(f"render set drift: {sorted(render_receipts)}")
    renders: dict[str, Any] = {}
    for name in sorted(required_renders):
        path = HERE / "renders" / name
        dimensions = list(png_dimensions(path))
        digest = sha256(path)
        receipt = render_receipts[name]
        if dimensions != [1600, 900] or dimensions != receipt["resolution"]:
            raise ValueError(f"{name}: expected 1600x900, found {dimensions}")
        if digest != receipt["sha256"] or path.stat().st_size != int(receipt["bytes"]):
            raise ValueError(f"{name}: bytes differ from build report")
        renders[name] = {
            "bytes": path.stat().st_size,
            "sha256": digest,
            "resolution": dimensions,
        }

    report = {
        "schema": "p31.round005.alt-duel-validation.v1",
        "status": "pass",
        "integrated": False,
        "acceptance_claimed": False,
        "assets": assets,
        "package": {
            **actual_package,
            "visible_triangle_limit": VISIBLE_TRIANGLE_LIMIT,
            "frozen_non_package_s04_triangles": FROZEN_NON_PACKAGE_S04_TRIANGLES,
            "projected_s04_renderer_triangles": projected_s04,
            "projected_s04_limit": RENDERED_TRIANGLE_LIMIT,
            "projected_s04_headroom": RENDERED_TRIANGLE_LIMIT - projected_s04,
        },
        "contact_gates": {
            "secondary_palm_limit_m": 0.04,
            "secondary_palm_m": grip_gates,
            "s04_actual_hollow_surface_limit_m": 0.08,
            "s04_actual_hollow_surface_m": contact_distance,
            "s04_torso_clearance_m": torso_clearance,
        },
        "renders": renders,
        "assertions": {
            "glb_2_self_contained": True,
            "build_report_byte_current": True,
            "exact_animation_sets": True,
            "required_nodes": True,
            "actor_skins_and_joint_counts": True,
            "package_budget": True,
            "contact_thresholds": True,
            "evidence_byte_current_1600x900": True,
            "non_integrated_no_acceptance_claim": True,
        },
    }
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    VALIDATION_REPORT.write_text(
        json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    print("ROUND005_ALT_VALIDATION=" + json.dumps(report, sort_keys=True))


if __name__ == "__main__":
    main()
