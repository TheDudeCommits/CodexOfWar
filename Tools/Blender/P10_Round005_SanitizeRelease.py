#!/usr/bin/env python3
"""Sanitize P10 Round005 release artifacts without changing rendered pixels."""

from __future__ import annotations

import hashlib
import json
import re
import shutil
import struct
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
ROUND_ROOT = ROOT / "ArtSource" / "P10" / "Round005"
PREFLIGHT = ROUND_ROOT / "Preflight"
ITERATIONS = PREFLIGHT / "Iterations"
MODEL_ROOT = (
    ROOT
    / "game"
    / "Assets"
    / "CodexOfWar"
    / "Heroes"
    / "P10"
    / "Round005"
    / "Models"
)
PUBLIC_CAPTURE_ROOT = (
    ROOT
    / "progress"
    / "public"
    / "captures"
    / "P10"
    / "round-005-preflight"
)
AUDIT_PATH = PREFLIGHT / "P10_Round005_Audit.json"

PRIMARY_IMAGES = {
    "Front_Decisive.png": PREFLIGHT / "P10_Round005_Front.png",
    "Face_Diagnostic.png": PREFLIGHT / "P10_Round005_Face.png",
    "Grip_Diagnostic.png": PREFLIGHT / "P10_Round005_Grip.png",
    "Combat_Decisive.png": PREFLIGHT / "P10_Round005_Combat.png",
}
SOURCE_IMAGES = [
    PREFLIGHT / f"P10_Round005_{name}.png"
    for name in (
        "Front",
        "ThreeQuarter",
        "Back",
        "Profile",
        "Face",
        "Hands",
        "Feet",
        "Combat",
        "Grip",
    )
]
PROBE_IMAGES = [
    ITERATIONS / "Probe01_Rejected.png",
    ITERATIONS / "Probe02_AcceptedForFreeze.png",
]
FBX_PATHS = sorted(MODEL_ROOT.glob("*.fbx"))
JSON_REPORTS = [
    PREFLIGHT / "P10_Round005_FBXCleanImport.json",
    ITERATIONS / "FBXImport01_Rejected_FullReport.json",
    ITERATIONS / "FBXImport02_Rejected_FullReport.json",
]
STRIP_PNG_CHUNKS = {b"tEXt", b"zTXt", b"iTXt", b"eXIf", b"oFFs"}
FBX_NATIVE_PATH_RE = re.compile(
    rb"/Users/[ -~]*?einar_release_v1\.blend"
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def repository_path(path: Path) -> str:
    return path.resolve().relative_to(ROOT).as_posix()


def png_chunks(payload: bytes) -> list[tuple[bytes, bytes]]:
    signature = b"\x89PNG\r\n\x1a\n"
    if not payload.startswith(signature):
        raise RuntimeError("Invalid PNG signature")
    chunks = []
    offset = len(signature)
    while offset < len(payload):
        if offset + 12 > len(payload):
            raise RuntimeError("Truncated PNG chunk header")
        length = struct.unpack(">I", payload[offset : offset + 4])[0]
        end = offset + 12 + length
        if end > len(payload):
            raise RuntimeError("Truncated PNG chunk payload")
        chunk_type = payload[offset + 4 : offset + 8]
        chunk = payload[offset:end]
        chunks.append((chunk_type, chunk))
        offset = end
        if chunk_type == b"IEND":
            break
    if offset != len(payload):
        raise RuntimeError("Unexpected bytes after PNG IEND")
    return chunks


def visual_fingerprint(payload: bytes) -> str:
    digest = hashlib.sha256()
    for chunk_type, chunk in png_chunks(payload):
        if chunk_type in {b"IHDR", b"PLTE", b"tRNS", b"IDAT"}:
            digest.update(chunk)
    return digest.hexdigest()


def sanitize_png(path: Path) -> dict[str, object]:
    before = path.read_bytes()
    before_visual = visual_fingerprint(before)
    kept = bytearray(b"\x89PNG\r\n\x1a\n")
    for chunk_type, chunk in png_chunks(before):
        if chunk_type in STRIP_PNG_CHUNKS:
            continue
        else:
            kept.extend(chunk)
    after = bytes(kept)
    after_visual = visual_fingerprint(after)
    if before_visual != after_visual:
        raise RuntimeError(f"Visual PNG payload changed: {path}")
    path.write_bytes(after)
    return {
        "path": repository_path(path),
        "stripped_chunk_types_by_policy": sorted(
            chunk_type.decode("ascii") for chunk_type in STRIP_PNG_CHUNKS
        ),
        "visual_payload_sha256": after_visual,
        "bytes": path.stat().st_size,
        "sha256": sha256(path),
    }


def sanitize_fbx(path: Path) -> dict[str, object]:
    payload = path.read_bytes()
    matches = FBX_NATIVE_PATH_RE.findall(payload)
    if len(matches) > 1:
        raise RuntimeError(f"Multiple private native-file paths in {path}")
    if matches:
        private_value = matches[0]
        safe_label = b"CodexOfWar/P10/Round005/EinarSource.blend"
        if len(safe_label) > len(private_value):
            raise RuntimeError(f"Private FBX field unexpectedly short: {path}")
        replacement = safe_label + (b" " * (len(private_value) - len(safe_label)))
        payload = payload.replace(private_value, replacement)
        path.write_bytes(payload)
    sanitized_payload = path.read_bytes()
    safe_label = b"CodexOfWar/P10/Round005/EinarSource.blend"
    if b"/Users/" in sanitized_payload:
        raise RuntimeError(f"Private user path remains in FBX: {path}")
    if sanitized_payload.count(safe_label) != 1:
        raise RuntimeError(f"Sanitized native-file label missing in FBX: {path}")
    return {
        "path": repository_path(path),
        "native_file_field_sanitized": True,
        "native_file_label": safe_label.decode("ascii"),
        "bytes": path.stat().st_size,
        "sha256": sha256(path),
    }


def sanitize_string(value: str) -> str:
    root_prefix = str(ROOT.resolve()) + "/"
    if value.startswith(root_prefix):
        return value[len(root_prefix) :]
    return value


def sanitize_json_value(value):
    if isinstance(value, dict):
        return {key: sanitize_json_value(item) for key, item in value.items()}
    if isinstance(value, list):
        return [sanitize_json_value(item) for item in value]
    if isinstance(value, str):
        return sanitize_string(value)
    return value


def sanitize_json_report(path: Path) -> dict[str, object]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    sanitized = sanitize_json_value(payload)
    path.write_text(
        json.dumps(sanitized, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    return {
        "path": repository_path(path),
        "bytes": path.stat().st_size,
        "sha256": sha256(path),
    }


def refresh_iteration_receipts() -> None:
    for stem in ("Probe01_Rejected", "Probe02_AcceptedForFreeze"):
        receipt_path = ITERATIONS / f"{stem}.json"
        receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
        receipt["sha256"] = sha256(ITERATIONS / receipt["image"])
        receipt_path.write_text(
            json.dumps(receipt, indent=2) + "\n",
            encoding="utf-8",
        )
    for stem in ("FBXImport01_Rejected", "FBXImport02_Rejected"):
        receipt_path = ITERATIONS / f"{stem}.json"
        receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
        for key in ("preserved_full_report", "preserved_diagnostic_render"):
            artifact = ROOT / receipt[key]["path"]
            receipt[key]["sha256"] = sha256(artifact)
        receipt_path.write_text(
            json.dumps(receipt, indent=2) + "\n",
            encoding="utf-8",
        )


def refresh_audit_delivery(
    png_records: list[dict[str, object]],
    fbx_records: list[dict[str, object]],
    json_records: list[dict[str, object]],
) -> None:
    audit = json.loads(AUDIT_PATH.read_text(encoding="utf-8"))
    for record in audit["delivery"]["files"]:
        artifact = ROOT / record["path"]
        record["bytes"] = artifact.stat().st_size
        record["sha256"] = sha256(artifact)
    audit["release_sanitization"] = {
        "pipeline": repository_path(Path(__file__)),
        "pipeline_sha256": sha256(Path(__file__)),
        "rendered_pixels_changed": False,
        "png_metadata": png_records,
        "fbx_native_file_fields": fbx_records,
        "json_path_receipts": json_records,
        "policy": (
            "Remove checkout-specific or volatile metadata while preserving "
            "PNG critical image chunks and FBX geometry/material payloads."
        ),
    }
    AUDIT_PATH.write_text(
        json.dumps(audit, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def assert_release_privacy() -> None:
    checked = [
        *SOURCE_IMAGES,
        *PROBE_IMAGES,
        *FBX_PATHS,
        *JSON_REPORTS,
        AUDIT_PATH,
        *PUBLIC_CAPTURE_ROOT.glob("*.png"),
    ]
    for path in checked:
        payload = path.read_bytes()
        if b"/Users/" in payload:
            raise RuntimeError(f"Private user path remains: {path}")


def main() -> None:
    missing = [
        path
        for path in [*SOURCE_IMAGES, *PROBE_IMAGES, *FBX_PATHS, *JSON_REPORTS]
        if not path.is_file()
    ]
    if missing:
        raise FileNotFoundError(f"Missing release artifacts: {missing}")

    png_records = [sanitize_png(path) for path in [*SOURCE_IMAGES, *PROBE_IMAGES]]
    fbx_records = [sanitize_fbx(path) for path in FBX_PATHS]
    json_records = [sanitize_json_report(path) for path in JSON_REPORTS]
    refresh_iteration_receipts()

    PUBLIC_CAPTURE_ROOT.mkdir(parents=True, exist_ok=True)
    for public_name, source in PRIMARY_IMAGES.items():
        shutil.copyfile(source, PUBLIC_CAPTURE_ROOT / public_name)

    refresh_audit_delivery(png_records, fbx_records, json_records)
    assert_release_privacy()
    print("[P10:R5] Release sanitization complete")
    print(f"[P10:R5] PNGs sanitized: {len(png_records)}")
    print(f"[P10:R5] FBXs sanitized: {len(fbx_records)}")
    print(f"[P10:R5] JSON reports sanitized: {len(json_records)}")


if __name__ == "__main__":
    main()
