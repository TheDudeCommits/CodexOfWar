#!/usr/bin/env python3
"""Run two independent factory-startup Blender builds and compare bytes."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
import subprocess


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
BUILDER = HERE / "build_contact.py"
BLENDER = "/opt/homebrew/bin/blender"
OUTPUTS = (
    HERE / "glb/nyra.glb",
    HERE / "glb/stormcage.glb",
    HERE / "textures/nyra_round006_basecolor.png",
    HERE / "textures/nyra_round006_normal.png",
    HERE / "textures/nyra_round006_orm.png",
    HERE / "textures/stormcage_round006_basecolor.png",
    HERE / "textures/stormcage_round006_normal.png",
    HERE / "textures/stormcage_round006_orm.png",
)


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run_build(process_id: int) -> dict[str, object]:
    completed = subprocess.run(
        [
            BLENDER,
            "--factory-startup",
            "--disable-autoexec",
            "--background",
            "--python",
            str(BUILDER),
        ],
        cwd=ROOT,
        check=False,
        capture_output=True,
        text=True,
    )
    if completed.returncode != 0:
        raise RuntimeError(
            f"clean build {process_id} failed ({completed.returncode})\n"
            f"{completed.stdout[-4000:]}\n{completed.stderr[-4000:]}"
        )
    return {
        "process": process_id,
        "command": f"{BLENDER} --factory-startup --disable-autoexec --background --python {BUILDER}",
        "exit_code": completed.returncode,
        "outputs": {
            str(path.relative_to(HERE)): {
                "bytes": path.stat().st_size,
                "sha256": digest(path),
            }
            for path in OUTPUTS
        },
    }


def main() -> None:
    runs = [run_build(1), run_build(2)]
    if runs[0]["outputs"] != runs[1]["outputs"]:
        raise RuntimeError("clean-process output hashes differ")
    report = {
        "schema": "p31.round006.clean-process-determinism.v1",
        "status": "pass",
        "integrated": False,
        "acceptance_claimed": False,
        "clean_processes": 2,
        "factory_startup": True,
        "disable_autoexec": True,
        "byte_identical": True,
        "runs": runs,
    }
    output = HERE / "reports/determinism.json"
    output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print("ROUND006_DETERMINISM=" + json.dumps(report, sort_keys=True))


if __name__ == "__main__":
    main()
