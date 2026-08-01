#!/usr/bin/env python3
"""Publish exact processed Round003 bytes into the web runtime asset tree."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
import shutil


P31_ROOT = Path(__file__).resolve().parents[2]
PROJECT_ROOT = P31_ROOT.parents[1]
PUBLIC_ROOT = PROJECT_ROOT / "web-game/public/assets/environment/ashwake"
RECEIPT_PATH = Path(__file__).resolve().parent / "runtime_publish_receipt.json"

MAPPINGS = (
    ("processed/polyhaven/round003/geometry/fort_buttress.glb", "geometry/fort_buttress.glb"),
    ("processed/polyhaven/round003/geometry/fort_gate.glb", "geometry/fort_gate.glb"),
    ("processed/polyhaven/round003/geometry/fort_wall.glb", "geometry/fort_wall.glb"),
    ("processed/polyhaven/round003/geometry/fort_tower.glb", "geometry/fort_tower.glb"),
    ("processed/polyhaven/round003/geometry/fort_stairs.glb", "geometry/fort_stairs.glb"),
    ("processed/polyhaven/round003/geometry/gothic_statue.glb", "geometry/gothic_statue.glb"),
    ("processed/polyhaven/round003/materials/ground/ashwake_ground_basecolor.webp", "materials/ground/ashwake_ground_basecolor.webp"),
    ("processed/polyhaven/round003/materials/ground/ashwake_ground_normal.webp", "materials/ground/ashwake_ground_normal.webp"),
    ("processed/polyhaven/round003/materials/ground/ashwake_ground_orm.webp", "materials/ground/ashwake_ground_orm.webp"),
    ("processed/polyhaven/round003/materials/sector/ashwake_sector_basecolor.webp", "materials/sector/ashwake_sector_basecolor.webp"),
    ("processed/polyhaven/round003/materials/sector/ashwake_sector_normal.webp", "materials/sector/ashwake_sector_normal.webp"),
    ("processed/polyhaven/round003/materials/sector/ashwake_sector_orm.webp", "materials/sector/ashwake_sector_orm.webp"),
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def main() -> None:
    results = []
    for source_relative, destination_relative in MAPPINGS:
        source = P31_ROOT / source_relative
        destination = PUBLIC_ROOT / destination_relative
        if not source.is_file():
            raise RuntimeError(f"Missing processed asset: {source}")
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, destination)
        source_hash = sha256(source)
        destination_hash = sha256(destination)
        if source_hash != destination_hash or source.stat().st_size != destination.stat().st_size:
            raise RuntimeError(f"Runtime publish mismatch: {destination}")
        results.append({
            "source_path": source.relative_to(PROJECT_ROOT).as_posix(),
            "runtime_path": destination.relative_to(PROJECT_ROOT).as_posix(),
            "bytes": destination.stat().st_size,
            "sha256": destination_hash,
            "byte_identical": True,
        })
    receipt = {
        "schema": "p31.round003.runtime-publish.v1",
        "policy": "real byte-identical runtime copies; no symlinks",
        "files": results,
        "totals": {"files": len(results), "bytes": sum(item["bytes"] for item in results)},
    }
    RECEIPT_PATH.write_text(json.dumps(receipt, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(receipt["totals"], sort_keys=True))


if __name__ == "__main__":
    main()
