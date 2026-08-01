#!/usr/bin/env python3
"""Convert the two shared Round003 PBR texture triplets to ordinary WebP."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
import shutil
import subprocess


P31_ROOT = Path(__file__).resolve().parents[2]
OUTPUT_ROOT = P31_ROOT / "processed" / "polyhaven" / "round003" / "materials"
RECEIPT_PATH = Path(__file__).resolve().parent / "texture_build_receipt.json"
CWEBP = shutil.which("cwebp")

JOBS = (
    {
        "role": "ground-basecolor",
        "source": P31_ROOT / "raw/polyhaven/textures/mossy_cobblestone_1k/mossy_cobblestone_diff_1k.jpg",
        "output": OUTPUT_ROOT / "ground/ashwake_ground_basecolor.webp",
        "flags": ["-q", "84", "-sharp_yuv", "-m", "6", "-mt", "-metadata", "none"],
        "source_id": "PH-COBBLE",
    },
    {
        "role": "ground-normal-opengl",
        "source": P31_ROOT / "raw/polyhaven/textures/mossy_cobblestone_1k/mossy_cobblestone_nor_gl_1k.jpg",
        "output": OUTPUT_ROOT / "ground/ashwake_ground_normal.webp",
        "flags": ["-q", "92", "-sharp_yuv", "-m", "6", "-mt", "-metadata", "none"],
        "source_id": "PH-COBBLE",
    },
    {
        "role": "ground-orm",
        "source": P31_ROOT / "raw/polyhaven/textures/mossy_cobblestone_1k/mossy_cobblestone_arm_1k.jpg",
        "output": OUTPUT_ROOT / "ground/ashwake_ground_orm.webp",
        "flags": ["-q", "90", "-sharp_yuv", "-m", "6", "-mt", "-metadata", "none"],
        "source_id": "PH-COBBLE",
    },
    {
        "role": "sector-basecolor",
        "source": P31_ROOT / "raw/polyhaven/round003/modular_fort_01_1k/textures/modular_fort_01_wall_diff_1k.jpg",
        "output": OUTPUT_ROOT / "sector/ashwake_sector_basecolor.webp",
        "flags": ["-q", "84", "-sharp_yuv", "-m", "6", "-mt", "-metadata", "none"],
        "source_id": "PH-FORT",
    },
    {
        "role": "sector-normal-opengl",
        "source": P31_ROOT / "raw/polyhaven/round003/modular_fort_01_1k/textures/modular_fort_01_wall_nor_gl_1k.jpg",
        "output": OUTPUT_ROOT / "sector/ashwake_sector_normal.webp",
        "flags": ["-q", "92", "-sharp_yuv", "-m", "6", "-mt", "-metadata", "none"],
        "source_id": "PH-FORT",
    },
    {
        "role": "sector-orm",
        "source": P31_ROOT / "raw/polyhaven/round003/modular_fort_01_1k/textures/modular_fort_01_wall_arm_1k.jpg",
        "output": OUTPUT_ROOT / "sector/ashwake_sector_orm.webp",
        "flags": ["-q", "90", "-sharp_yuv", "-m", "6", "-mt", "-metadata", "none"],
        "source_id": "PH-FORT",
    },
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def main() -> None:
    if CWEBP is None:
        raise RuntimeError("cwebp 1.6+ is required")
    version = subprocess.run([CWEBP, "-version"], check=True, capture_output=True, text=True).stdout.strip()
    results = []
    for job in JOBS:
        source = Path(job["source"])
        output = Path(job["output"])
        if not source.is_file():
            raise RuntimeError(f"Missing verified source texture: {source}")
        output.parent.mkdir(parents=True, exist_ok=True)
        command = [CWEBP, *job["flags"], str(source), "-o", str(output)]
        subprocess.run(command, check=True, capture_output=True, text=True)
        results.append({
            "role": job["role"],
            "source_id": job["source_id"],
            "source_path": source.relative_to(P31_ROOT).as_posix(),
            "source_bytes": source.stat().st_size,
            "source_sha256": sha256(source),
            "output_path": output.relative_to(P31_ROOT).as_posix(),
            "output_bytes": output.stat().st_size,
            "output_sha256": sha256(output),
            "command": ["cwebp", *job["flags"], source.name, "-o", output.name],
        })
    receipt = {
        "schema": "p31.round003.texture-build.v1",
        "access_date": "2026-08-01",
        "cwebp": version,
        "policy": "ordinary 1024x1024 WebP; basecolor is sRGB; OpenGL normals and packed AO/roughness/metallic are linear",
        "outputs": results,
        "totals": {
            "files": len(results),
            "source_bytes": sum(item["source_bytes"] for item in results),
            "output_bytes": sum(item["output_bytes"] for item in results),
        },
    }
    RECEIPT_PATH.write_text(json.dumps(receipt, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(receipt["totals"], sort_keys=True))


if __name__ == "__main__":
    main()
