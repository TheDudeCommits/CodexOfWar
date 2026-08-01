#!/usr/bin/env python3
"""Acquire the exact official Poly Haven Round003 1K glTF source set.

All publisher bytes are written only to the ignored P31 raw cache.  The
trackable receipt records stable publisher/API URLs and hashes, never signed
URLs, query strings, credentials, or tokens.
"""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path, PurePosixPath
from urllib.parse import urlparse
from urllib.request import Request, urlopen


P31_ROOT = Path(__file__).resolve().parents[2]
RAW_ROOT = P31_ROOT / "raw" / "polyhaven" / "round003"
RECEIPT_PATH = Path(__file__).resolve().parent / "acquisition_receipt.json"
ACCESS_DATE = "2026-08-01"
USER_AGENT = "GauntletLoop-P31-Provenance/1.0"
ASSETS = {
    "modular_fort_01": {
        "expected_name": "Modular Fort 01",
        "expected_author": "Rico Cilliers",
        "official_page": "https://polyhaven.com/a/modular_fort_01",
    },
    "gothic_statue": {
        "expected_name": "Gothic Statue",
        "expected_author": "Benny Weimer",
        "official_page": "https://polyhaven.com/a/gothic_statue",
    },
}


def fetch(url: str) -> bytes:
    request = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=60) as response:
        if response.status != 200:
            raise RuntimeError(f"HTTP {response.status}: {url}")
        return response.read()


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def safe_publisher_url(url: str) -> None:
    parsed = urlparse(url)
    if (
        parsed.scheme != "https"
        or parsed.hostname != "dl.polyhaven.org"
        or not parsed.path.startswith("/file/ph-assets/")
        or parsed.query
        or parsed.fragment
        or parsed.username
        or parsed.password
    ):
        raise RuntimeError(f"Unexpected or non-persistable publisher URL: {url}")


def safe_member_path(member: str) -> Path:
    pure = PurePosixPath(member)
    if pure.is_absolute() or ".." in pure.parts:
        raise RuntimeError(f"Unsafe publisher member path: {member}")
    return Path(*pure.parts)


def write_verified(path: Path, data: bytes, expected_md5: str, expected_size: int) -> None:
    actual_md5 = hashlib.md5(data, usedforsecurity=False).hexdigest()
    if actual_md5 != expected_md5:
        raise RuntimeError(f"MD5 mismatch for {path.name}: {actual_md5} != {expected_md5}")
    if len(data) != expected_size:
        raise RuntimeError(f"Size mismatch for {path.name}: {len(data)} != {expected_size}")
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".part")
    temporary.write_bytes(data)
    os.replace(temporary, path)


def main() -> None:
    receipt_assets: dict[str, object] = {}
    for slug, expected in ASSETS.items():
        info_url = f"https://api.polyhaven.com/info/{slug}"
        files_url = f"https://api.polyhaven.com/files/{slug}"
        info_bytes = fetch(info_url)
        files_bytes = fetch(files_url)
        info = json.loads(info_bytes)
        files = json.loads(files_bytes)
        if info.get("type") != 2 or info.get("name") != expected["expected_name"]:
            raise RuntimeError(f"Unexpected official metadata for {slug}")
        if expected["expected_author"] not in info.get("authors", {}):
            raise RuntimeError(f"Expected author missing from official metadata for {slug}")

        raw_asset_root = RAW_ROOT / f"{slug}_1k"
        raw_asset_root.mkdir(parents=True, exist_ok=True)
        (raw_asset_root / "info-api.json").write_bytes(info_bytes)
        (raw_asset_root / "files-api.json").write_bytes(files_bytes)

        selected = files["gltf"]["1k"]["gltf"]
        selected_files = {Path(urlparse(selected["url"]).path).name: {
            "url": selected["url"],
            "md5": selected["md5"],
            "size": selected["size"],
        }}
        selected_files.update(selected.get("include", {}))

        file_receipts = []
        for member, descriptor in sorted(selected_files.items()):
            safe_publisher_url(descriptor["url"])
            relative = safe_member_path(member)
            target = raw_asset_root / relative
            data = fetch(descriptor["url"])
            write_verified(target, data, descriptor["md5"], int(descriptor["size"]))
            file_receipts.append({
                "path": target.relative_to(P31_ROOT).as_posix(),
                "original_filename_or_member": member,
                "official_download_url": descriptor["url"],
                "bytes": len(data),
                "publisher_md5": descriptor["md5"],
                "sha256": sha256_bytes(data),
            })

        receipt_assets[slug] = {
            "name": info["name"],
            "author": expected["expected_author"],
            "official_page": expected["official_page"],
            "info_api_url": info_url,
            "files_api_url": files_url,
            "license": "CC0-1.0",
            "license_proof_url": "https://polyhaven.com/license",
            "access_date": ACCESS_DATE,
            "publisher_state": {
                "date_published_unix": info.get("date_published"),
                "files_hash": info.get("files_hash"),
                "polycount": info.get("polycount"),
                "dimensions_mm": info.get("dimensions"),
                "max_resolution": info.get("max_resolution"),
                "description": info.get("description"),
            },
            "selected_variant": "official glTF 1K",
            "raw_info_api_sha256": sha256_bytes(info_bytes),
            "raw_files_api_sha256": sha256_bytes(files_bytes),
            "files": file_receipts,
        }

    receipt = {
        "schema": "p31.round003.polyhaven-acquisition.v1",
        "access_date": ACCESS_DATE,
        "policy": "official Poly Haven API and dl.polyhaven.org HTTPS endpoints only; no signed URLs persisted",
        "assets": receipt_assets,
    }
    RECEIPT_PATH.write_text(json.dumps(receipt, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({
        "receipt": RECEIPT_PATH.relative_to(P31_ROOT).as_posix(),
        "asset_count": len(receipt_assets),
        "file_count": sum(len(asset["files"]) for asset in receipt_assets.values()),
    }, sort_keys=True))


if __name__ == "__main__":
    main()
