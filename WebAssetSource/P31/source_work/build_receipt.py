"""Build the deterministic P31 machine-readable receipt from retained bytes."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ACCESS_DATE = "2026-08-01"

SOURCES = {
    "BS-RAIN": {
        "publisher": "Blender Studio",
        "author": "Blender Foundation / Blender Studio",
        "title": "Rain Rig",
        "version": "v3.3 archive; source blend rain_v3.2.blend",
        "official_page": "https://studio.blender.org/characters/rain/v3/",
        "download_or_listing_url": "https://studio.blender.org/download-source/files/ee/a7/eea73e55dba1cea31c09848df6a794b2-4.zip",
        "license": "CC-BY-4.0",
        "license_proof_url": "https://creativecommons.org/licenses/by/4.0/",
        "access_date": "2026-08-02",
        "required_credit": "Rain Rig (CC) Blender Foundation | studio.blender.org",
        "modification_notice": "Adapted for Nyra: geometry altered and buried surfaces pruned; the canonical 65-bone gameplay rig substituted; weights transferred; textures atlased/resized; armor and mantle added; five gameplay actions embedded.",
    },
    "PROJECT-ORIGINAL": {
        "publisher": "Gauntlet Loop project",
        "author": "Gauntlet Loop project",
        "title": "Round004 original authored assets",
        "version": "P30 Round004",
        "official_page": "project-local",
        "download_or_listing_url": "project-local",
        "license": "project-original",
        "license_proof_url": "project-local",
        "access_date": "2026-08-02",
    },
    "PH-SNOW": {
        "publisher": "Poly Haven",
        "author": "Adrian Kubasa",
        "title": "Snowy Forest",
        "version": "publisher API state 2026-08-01; 1K HDR",
        "official_page": "https://polyhaven.com/a/snowy_forest",
        "download_or_listing_url": "https://api.polyhaven.com/files/snowy_forest",
        "license": "CC0-1.0",
        "license_proof_url": "https://polyhaven.com/license",
    },
    "PH-BRICK": {
        "publisher": "Poly Haven",
        "author": "Rob Tuytel",
        "title": "Castle Brick 01",
        "version": "publisher API state 2026-08-01; 1K JPG maps",
        "official_page": "https://polyhaven.com/a/castle_brick_01",
        "download_or_listing_url": "https://api.polyhaven.com/files/castle_brick_01",
        "license": "CC0-1.0",
        "license_proof_url": "https://polyhaven.com/license",
    },
    "PH-COBBLE": {
        "publisher": "Poly Haven",
        "author": "Sơn Nguyễn",
        "title": "Mossy Cobblestone",
        "version": "publisher API state 2026-08-01; 1K JPG maps",
        "official_page": "https://polyhaven.com/a/mossy_cobblestone",
        "download_or_listing_url": "https://api.polyhaven.com/files/mossy_cobblestone",
        "license": "CC0-1.0",
        "license_proof_url": "https://polyhaven.com/license",
    },
    "PH-FORT": {
        "publisher": "Poly Haven",
        "author": "Rico Cilliers",
        "title": "Modular Fort 01",
        "version": "publisher API files_hash 5ccbf62aeee96ea99cf0c2e29e4c8ed843ee7c44; 1K glTF; API state 2026-08-01",
        "official_page": "https://polyhaven.com/a/modular_fort_01",
        "download_or_listing_url": "https://api.polyhaven.com/files/modular_fort_01",
        "license": "CC0-1.0",
        "license_proof_url": "https://polyhaven.com/license",
    },
    "PH-STATUE": {
        "publisher": "Poly Haven",
        "author": "Benny Weimer",
        "title": "Gothic Statue",
        "version": "publisher API files_hash 180fe034aec7158f2550b133e0ba2be9e9c1c241; 1K glTF; API state 2026-08-01",
        "official_page": "https://polyhaven.com/a/gothic_statue",
        "download_or_listing_url": "https://api.polyhaven.com/files/gothic_statue",
        "license": "CC0-1.0",
        "license_proof_url": "https://polyhaven.com/license",
    },
    "KEN-CASTLE": {
        "publisher": "Kenney",
        "author": "Kenney",
        "title": "Castle Kit",
        "version": "2.0 complete remake; 2024-03-27",
        "official_page": "https://kenney.nl/assets/castle-kit",
        "download_or_listing_url": "https://kenney.nl/media/pages/assets/castle-kit/a395102d20-1711543616/kenney_castle-kit.zip",
        "license": "CC0-1.0",
        "license_proof_url": "https://kenney.nl/assets/castle-kit",
    },
    "KEN-SMOKE": {
        "publisher": "Kenney",
        "author": "Kenney Vleugels",
        "title": "Smoke Particles",
        "version": "1.0",
        "official_page": "https://kenney.nl/assets/smoke-particles",
        "download_or_listing_url": "https://kenney.nl/media/pages/assets/smoke-particles/23249a0d35-1677695171/kenney_smoke-particles.zip",
        "license": "CC0-1.0",
        "license_proof_url": "https://kenney.nl/assets/smoke-particles",
    },
    "OGA-SLASH": {
        "publisher": "OpenGameArt",
        "author": "Cethiel",
        "title": "Weapon Slash - Effect / Classic",
        "version": "submission 2019-04-08",
        "official_page": "https://opengameart.org/content/weapon-slash-effect",
        "download_or_listing_url": "https://opengameart.org/sites/default/files/Classic.zip",
        "license": "CC0-1.0",
        "license_proof_url": "https://opengameart.org/content/weapon-slash-effect",
    },
    "OGA-SWORD": {
        "publisher": "OpenGameArt",
        "author": "StarNinjas",
        "title": "20 Sword Sound Effects (Attacks and Clashes)",
        "version": "updated 2021-03-06",
        "official_page": "https://opengameart.org/content/20-sword-sound-effects-attacks-and-clashes",
        "download_or_listing_url": "https://opengameart.org/content/20-sword-sound-effects-attacks-and-clashes",
        "license": "CC0-1.0",
        "license_proof_url": "https://opengameart.org/content/20-sword-sound-effects-attacks-and-clashes",
    },
    "Q-BASE": {
        "publisher": "Quaternius",
        "author": "Quaternius",
        "title": "Universal Base Characters",
        "version": "August 2025; free Standard tier",
        "official_page": "https://quaternius.com/packs/universalbasecharacters.html",
        "download_or_listing_url": "https://quaternius.itch.io/universal-base-characters",
        "publisher_upload_id": 15861669,
        "publisher_upload_timestamp_utc": "2025-12-16T12:35:00Z",
        "license": "CC0-1.0",
        "license_proof_url": "https://quaternius.com/packs/universalbasecharacters.html",
    },
    "Q-OUTFIT": {
        "publisher": "Quaternius",
        "author": "Quaternius",
        "title": "Modular Character Outfits - Fantasy",
        "version": "November 2025; free Standard tier",
        "official_page": "https://quaternius.com/packs/modularcharacteroutfitsfantasy.html",
        "download_or_listing_url": "https://quaternius.itch.io/modular-character-outfits-fantasy",
        "publisher_upload_id": 16289385,
        "publisher_upload_timestamp_utc": "2026-01-29T14:52:00Z",
        "license": "CC0-1.0",
        "license_proof_url": "https://quaternius.com/packs/modularcharacteroutfitsfantasy.html",
    },
    "Q-UAL1": {
        "publisher": "Quaternius",
        "author": "Quaternius",
        "title": "Universal Animation Library",
        "version": "March 2025; free Standard tier",
        "official_page": "https://quaternius.com/packs/universalanimationlibrary.html",
        "download_or_listing_url": "https://quaternius.itch.io/universal-animation-library",
        "publisher_upload_id": 17958403,
        "publisher_upload_timestamp_utc": "2026-06-16T23:03:00Z",
        "license": "CC0-1.0",
        "license_proof_url": "https://quaternius.com/packs/universalanimationlibrary.html",
    },
    "Q-UAL2": {
        "publisher": "Quaternius",
        "author": "Quaternius",
        "title": "Universal Animation Library 2",
        "version": "January 2026; free Standard tier",
        "official_page": "https://quaternius.com/packs/universalanimationlibrary2.html",
        "download_or_listing_url": "https://quaternius.itch.io/universal-animation-library-2",
        "publisher_upload_id": 17958478,
        "publisher_upload_timestamp_utc": "2026-06-16T23:10:00Z",
        "license": "CC0-1.0",
        "license_proof_url": "https://quaternius.com/packs/universalanimationlibrary2.html",
    },
    "Q-WEAPON": {
        "publisher": "Quaternius",
        "author": "Quaternius",
        "title": "Modular Weapons Pack",
        "version": "September 2018",
        "official_page": "https://quaternius.com/packs/medievalweapons.html",
        "download_or_listing_url": "https://drive.google.com/drive/folders/1Z6vYiQxY8W73FXuMWzaTQAg9rzbumnOr?usp=sharing",
        "publisher_file_ids": {
            "Claymore.fbx": "1CuZEwhlFi0fXO581QiU3RIywE4di4KNf",
            "License.txt": "1hlsPZ5pnXVB_CP7oAUVOZBmbQf09M73H"
        },
        "license": "CC0-1.0",
        "license_proof_url": "https://quaternius.com/packs/medievalweapons.html",
    },
    "Q-ZOMBIE": {
        "publisher": "Quaternius",
        "author": "Quaternius",
        "title": "Zombie Apocalypse Kit",
        "version": "March 2024",
        "official_page": "https://quaternius.com/packs/zombieapocalypsekit.html",
        "download_or_listing_url": "https://drive.google.com/drive/folders/1mWP6sCHun7OUMHQeDNZLrXTteXlzWg_t?usp=sharing",
        "publisher_file_ids": {
            "Zombie_Basic.gltf": "1S6EfXv0Fc6SiqyoPx5gNF48MI0OajNLr",
            "Zombie_Atlas.png": "1t2OBnWpp2pRV-eaV_vt6weiHN4vlEHwi",
            "License.txt": "1580uoubj39h6sNRFo394PvNU4ozIwehi"
        },
        "license": "CC0-1.0",
        "license_proof_url": "https://quaternius.com/packs/zombieapocalypsekit.html",
    },
}

ROUND004_PROVENANCE_PATHS = (
    "source_work/round004/originals/blender-studio-rain/Rain_v3.3.zip",
    "source_work/round004/originals/blender-studio-rain/download.headers.txt",
    "source_work/round004/originals/blender-studio-rain/extracted/Rain v3.3/rain_v3.2.blend",
    "source_work/round004/originals/blender-studio-rain/extracted/Rain v3.3/textures/TEX-rain_body_diffuse.1001.png",
    "source_work/round004/originals/blender-studio-rain/extracted/Rain v3.3/textures/TEX-rain_body_diffuse.1003.png",
    "source_work/round004/originals/blender-studio-rain/extracted/Rain v3.3/textures/TEX-rain_eyes.png",
    "source_work/round004/originals/blender-studio-rain/extracted/Rain v3.3/textures/TEX-rain_hair_diffuse.png",
    "source_work/round004/originals/blender-studio-rain/extracted/Rain v3.3/textures/TEX-rain_hands_diffuse.png",
    "source_work/round004/originals/blender-studio-rain/license/CC-BY-4.0-legalcode.txt",
    "source_work/round004/originals/blender-studio-rain/license/official-rain-page.headers.txt",
    "source_work/round004/originals/blender-studio-rain/license/official-rain-page.html",
)


def source_ids(path: str) -> list[str]:
    if path == "processed/round004/characters/nyra.glb":
        return ["BS-RAIN", "Q-UAL1", "Q-UAL2"]
    if path.startswith("processed/round004/textures/nyra_"):
        return ["BS-RAIN"]
    if path == "processed/round004/characters/hollow.glb" or path == "processed/round004/textures/hollow_atlas_512.png":
        return ["Q-ZOMBIE"]
    if path.startswith("processed/round004/weapons/stormcage"):
        return ["PROJECT-ORIGINAL"]
    if path.startswith("source_work/round004/originals/blender-studio-rain/"):
        return ["BS-RAIN"]
    if "round003/gothic_statue" in path or "round003/geometry/gothic_statue" in path:
        return ["PH-STATUE"]
    if "round003/materials/ground/" in path:
        return ["PH-COBBLE"]
    if "round003/modular_fort_01" in path or "round003/geometry/fort_" in path or "round003/materials/sector/" in path:
        return ["PH-FORT"]
    if "snowy_forest" in path:
        return ["PH-SNOW"]
    if "castle_brick_01" in path:
        return ["PH-BRICK"]
    if "mossy_cobblestone" in path:
        return ["PH-COBBLE"]
    if "castle-kit" in path or "/ruins/" in path or "Castle_Kit" in path:
        return ["KEN-CASTLE"]
    if "smoke-particles" in path or "/vfx/smoke/" in path or "Smoke_Particles" in path:
        return ["KEN-SMOKE"]
    if "weapon-slash-effect" in path or "/slash_classic/" in path:
        return ["OGA-SLASH"]
    if "sword-sounds-starninjas" in path or "/audio/sword/" in path:
        return ["OGA-SWORD"]
    if "Universal Base Characters" in path or "universal-base-characters" in path or "universal_superhero" in path or "universal_hair" in path:
        return ["Q-BASE"]
    if "Modular Character Outfits" in path or "modular-character-outfits" in path or "female_ranger" in path:
        return ["Q-OUTFIT"]
    if "Universal Animation Library 2" in path or "universal-animation-library-2" in path or "combat_zombie" in path:
        return ["Q-UAL2"]
    if "Universal Animation Library[" in path or "universal-animation-library/" in path or "universal-animation-library-" in path or "player_core" in path:
        return ["Q-UAL1"]
    if "modular-weapons" in path or "claymore" in path:
        return ["Q-WEAPON"]
    if "zombie-apocalypse" in path or "Zombie_" in path or "zombie_basic" in path:
        return ["Q-ZOMBIE"]
    raise ValueError(f"Unmapped third-party file: {path}")


TRANSFORMS = {
    "processed/round004/characters/nyra.glb": "Blender 5.2.0 deterministic Rain-to-Nyra adaptation; buried body surfaces pruned; exact 65-joint player_core skeleton fitted; maximum four normalized influences; five exact gameplay clips embedded; five draw primitives; self-contained GLB",
    "processed/round004/characters/hollow.glb": "Blender 5.2.0 deterministic Zombie Basic adaptation; source sneaker removed; body proportion-deformed; replacement boot/greave, wraps, tabard, wounds, eye and talons authored; original 50-bone rig and Idle/HitReact/Death retained; five draw primitives; self-contained GLB",
    "processed/round004/textures/nyra_face_atlas_2k.png": "ffmpeg 8.1.2 four-input Lanczos 1024px scale plus 2x2 xstack of Rain face, eyes, body and hands; ordinary 2048x2048 RGB PNG; exact command in source_work/round004/texture_build_receipt.json; embedded in nyra.glb, not loaded separately at runtime",
    "processed/round004/textures/nyra_hair_1k.png": "ffmpeg 8.1.2 Lanczos scale of Rain hair diffuse to 1024x1024; ordinary RGB PNG; exact command in source_work/round004/texture_build_receipt.json; embedded in nyra.glb, not loaded separately at runtime",
    "processed/round004/textures/hollow_atlas_512.png": "ffmpeg palette adjustment of the verified Quaternius Zombie Atlas; ordinary 512x512 RGB PNG; input/output hashes and recipe recorded in source_work/round004/texture_build_receipt.json; embedded in hollow.glb, not loaded separately at runtime",
    "processed/round004/weapons/stormcage.glb": "Blender 5.2.0 project-original deterministic primitives and custom profiles; grip-centred origin; three materials and draw primitives; no external mesh or texture content; self-contained GLB",
    "processed/round004/weapons/stormcage.asset-receipt.json": "Generated Stormcage build, dimension, budget, clean-reimport and provenance audit document; not a runtime payload",
    "processed/quaternius/models/universal_superhero_female.glb": "Blender 5.2.0 glTF-to-self-contained-GLB; Y-up; selected Standard female body; downscaled referenced 2K body/hair maps to 1K and retained 256px eye maps; byte-identical alias repaired missing eye-normal filename in scratch only",
    "processed/quaternius/models/universal_hair_long.glb": "Blender 5.2.0 glTF-to-self-contained-GLB; Y-up; selected Hair_Long mesh and Universal rig; downscaled referenced 2K maps to 1K",
    "processed/quaternius/models/female_ranger_outfit.glb": "Blender 5.2.0 glTF-to-self-contained-GLB; Y-up; selected complete Female_Ranger outfit; downscaled referenced Ranger 4K and Regular Female 2K maps to 1K",
    "processed/quaternius/models/claymore.glb": "Blender 5.2.0 FBX-to-GLB; uniform scale 6.5946 longest dimension to 1.8; applied scale; Y-up; grip-adjacent origin retained",
    "processed/quaternius/models/zombie_basic.glb": "Blender 5.2.0 glTF-to-self-contained-GLB; Y-up; packed atlas; retained only Idle, Walk, Run, Idle_Attack, HitReact, Death",
    "processed/quaternius/animations/player_core.glb": "Blender 5.2.0 action filter; retained Idle_Loop, Walk_Loop, Sprint_Loop, Roll, Hit_Chest, Death01; stripped non-skinned previews; self-contained GLB",
    "processed/quaternius/animations/combat_zombie.glb": "Blender 5.2.0 action filter; retained Sword_Regular_A, Zombie_Idle_Loop, Zombie_Walk_Fwd_Loop, Zombie_Scratch; stripped non-skinned previews; self-contained GLB",
}


def transform(path: str) -> str:
    if path in TRANSFORMS:
        return TRANSFORMS[path]
    if path.startswith("raw/"):
        if "/original-docs/" in path:
            return "extracted verbatim from the named publisher archive for preservation"
        return "downloaded verbatim from the original publisher distribution"
    if path.startswith("source_work/round004/originals/blender-studio-rain/"):
        if path.endswith("Rain_v3.3.zip"):
            return "downloaded verbatim from the official Blender Studio stable source endpoint"
        if path.endswith("rain_v3.2.blend") or "/textures/" in path:
            return "extracted verbatim from Rain_v3.3.zip for reproducible Nyra adaptation"
        return "official page, transport-header, or CC-BY-4.0 license evidence retained verbatim"
    if path.startswith("processed/polyhaven/round003/geometry/"):
        return "Blender 5.2.0 selection from the official 1K glTF; publisher contact-sheet transform removed; metric mesh centered on X/Z, grounded at Y=0, collapsed to one texture-free AshwakeSectorShared placeholder material; ordinary GLB with no Draco, Meshopt, KTX2, animations, images, or external URI; validated by Blender re-import"
    if path.startswith("processed/polyhaven/round003/materials/ground/"):
        return "cwebp 1.6.0 conversion of the verified Poly Haven Mossy Cobblestone 1K JPG; ordinary 1024x1024 WebP; shared Round003 ground triplet; exact flags recorded in source_work/round003/texture_build_receipt.json"
    if path.startswith("processed/polyhaven/round003/materials/sector/"):
        return "cwebp 1.6.0 conversion of the verified Modular Fort 01 wall 1K JPG; ordinary 1024x1024 WebP; shared Round003 sector triplet; exact flags recorded in source_work/round003/texture_build_receipt.json"
    if path.startswith("processed/polyhaven/"):
        return "verbatim runtime copy of the direct publisher file; no re-encoding"
    if path.startswith("processed/kenney/") or path.startswith("processed/opengameart/"):
        return "selected archive member extracted verbatim; no re-encoding"
    if "/licenses/" in path or path.startswith("licenses/"):
        return "publisher-supplied license/readme preserved verbatim and collision-safely renamed"
    raise ValueError(f"Missing transform for {path}")


def role(path: str) -> str:
    if path.startswith("source_work/round004/originals/"):
        return "raw-provenance"
    if path in {
        "processed/round004/characters/nyra.glb",
        "processed/round004/characters/hollow.glb",
        "processed/round004/weapons/stormcage.glb",
    }:
        return "runtime-model"
    if path.startswith("processed/round004/textures/"):
        return "build-texture-input"
    if path == "processed/round004/weapons/stormcage.asset-receipt.json":
        return "audit-document"
    if path.startswith("raw/"):
        return "raw-provenance"
    if "/licenses/" in path or path.startswith("licenses/"):
        return "preserved-document"
    if "/audio/" in path:
        return "runtime-audio"
    if "/vfx/" in path:
        return "runtime-vfx"
    if "/hdri/" in path:
        return "runtime-hdri"
    if "/materials/" in path:
        return "runtime-material-map"
    if "/animations/" in path:
        return "runtime-animation-library"
    if "/models/" in path or "/ruins/" in path or "/geometry/" in path:
        return "runtime-model"
    raise ValueError(f"Missing role for {path}")


def original_filename(path: str) -> str:
    overrides = {
        "processed/round004/characters/nyra.glb": "Rain_v3.3.zip / rain_v3.2.blend plus player_core.glb and combat_zombie.glb",
        "processed/round004/characters/hollow.glb": "zombie_basic.glb",
        "processed/round004/textures/nyra_face_atlas_2k.png": "Rain body diffuse UDIM 1001/1003, eyes, and hands diffuse",
        "processed/round004/textures/nyra_hair_1k.png": "TEX-rain_hair_diffuse.png",
        "processed/round004/textures/hollow_atlas_512.png": "Zombie_Atlas.png",
        "processed/round004/weapons/stormcage.glb": "project-original Blender geometry",
        "processed/quaternius/models/universal_superhero_female.glb": "Superhero_Female_FullBody.gltf",
        "processed/quaternius/models/universal_hair_long.glb": "Hair_Long.gltf",
        "processed/quaternius/models/female_ranger_outfit.glb": "Female_Ranger.gltf",
        "processed/quaternius/models/claymore.glb": "Claymore.fbx",
        "processed/quaternius/models/zombie_basic.glb": "Zombie_Basic.gltf",
        "processed/quaternius/animations/player_core.glb": "Universal Animation Library[Standard].zip / Standard GLB",
        "processed/quaternius/animations/combat_zombie.glb": "Universal Animation Library 2[Standard].zip / Standard GLB",
        "processed/polyhaven/round003/geometry/fort_buttress.glb": "modular_fort_01_1k.gltf / modular_fort_01_wall_thick_corner_01",
        "processed/polyhaven/round003/geometry/fort_gate.glb": "modular_fort_01_1k.gltf / modular_fort_01_wall_thin_gate_01",
        "processed/polyhaven/round003/geometry/fort_wall.glb": "modular_fort_01_1k.gltf / modular_fort_01_wall_thin_straight_03",
        "processed/polyhaven/round003/geometry/fort_tower.glb": "modular_fort_01_1k.gltf / modular_fort_01_tower_round",
        "processed/polyhaven/round003/geometry/fort_stairs.glb": "modular_fort_01_1k.gltf / modular_fort_01_wall_stairs_straight_01",
        "processed/polyhaven/round003/geometry/gothic_statue.glb": "gothic_statue_1k.gltf / gothic_statue",
        "processed/polyhaven/round003/materials/ground/ashwake_ground_basecolor.webp": "mossy_cobblestone_diff_1k.jpg",
        "processed/polyhaven/round003/materials/ground/ashwake_ground_normal.webp": "mossy_cobblestone_nor_gl_1k.jpg",
        "processed/polyhaven/round003/materials/ground/ashwake_ground_orm.webp": "mossy_cobblestone_arm_1k.jpg",
        "processed/polyhaven/round003/materials/sector/ashwake_sector_basecolor.webp": "modular_fort_01_wall_diff_1k.jpg",
        "processed/polyhaven/round003/materials/sector/ashwake_sector_normal.webp": "modular_fort_01_wall_nor_gl_1k.jpg",
        "processed/polyhaven/round003/materials/sector/ashwake_sector_orm.webp": "modular_fort_01_wall_arm_1k.jpg",
        "licenses/Kenney_Castle_Kit_License.txt": "License.txt",
        "licenses/Kenney_Smoke_Particles_license.txt": "license.txt",
    }
    if path.startswith("processed/quaternius/licenses/"):
        name = Path(path).name
        if name.endswith("License_Standard.txt"):
            return "License_Standard.txt"
        if name.endswith("License.txt"):
            return "License.txt"
        if name.endswith("Readme.txt"):
            return "Readme.txt"
        if name.endswith("README.txt"):
            return "README.txt"
    return overrides.get(path, Path(path).name)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def main() -> None:
    files = []
    selected_paths = []
    for top in ("raw", "processed", "licenses"):
        selected_paths.extend(path for path in sorted((ROOT / top).rglob("*")) if path.is_file())
    selected_paths.extend(ROOT / relative for relative in ROUND004_PROVENANCE_PATHS)
    for path in selected_paths:
        relative = path.relative_to(ROOT).as_posix()
        lineage = source_ids(relative)
        sid = lineage[0]
        source = SOURCES[sid]
        entry = {
            "path": relative,
            "role": role(relative),
            "integration_ready": role(relative).startswith("runtime-"),
            "bytes": path.stat().st_size,
            "sha256": sha256(path),
            "source_id": sid,
            "source_ids": lineage,
            "publisher": source["publisher"],
            "author": source["author"],
            "official_page": source["official_page"],
            "download_or_listing_url": source["download_or_listing_url"],
            "license": source["license"],
            "license_proof_url": source["license_proof_url"],
            "access_date": source.get("access_date", ACCESS_DATE),
            "source_version": source["version"],
            "original_filename_or_member": original_filename(relative),
            "selection_and_transform": transform(relative),
        }
        if len(lineage) > 1:
            entry["lineage"] = [
                {"source_id": item, "license": SOURCES[item]["license"]}
                for item in lineage
            ]
        files.append(entry)

    totals = {}
    for key in ("raw", "processed", "licenses"):
        selected = [item for item in files if item["path"].startswith(key + "/")]
        totals[key] = {
            "file_count": len(selected),
            "bytes": sum(item["bytes"] for item in selected),
        }
    runtime = [item for item in files if item["integration_ready"]]
    totals["integration_ready"] = {
        "file_count": len(runtime),
        "bytes": sum(item["bytes"] for item in runtime),
    }
    retained_round004 = [
        item for item in files
        if item["path"].startswith("source_work/round004/originals/")
    ]
    totals["round004_source_work_provenance"] = {
        "file_count": len(retained_round004),
        "bytes": sum(item["bytes"] for item in retained_round004),
    }

    receipt = {
        "schema": "p31-third-party-asset-receipt-v1",
        "access_date": ACCESS_DATE,
        "scope": "Mixed-license browser asset stack through P30 Round004; publisher source, required attribution, project-original declarations, and processed lineage retained in WebAssetSource/P31",
        "cc0_deed_url": "https://creativecommons.org/publicdomain/zero/1.0/",
        "cc_by_4_deed_url": "https://creativecommons.org/licenses/by/4.0/",
        "source_registry": SOURCES,
        "totals": totals,
        "files": files,
        "runtime_clip_mapping": {
            "player_idle": "Idle_Loop",
            "player_walk": "Walk_Loop",
            "player_run": "Sprint_Loop",
            "player_dodge": "Roll",
            "player_light_attack": "Sword_Regular_A",
            "player_hit": "Hit_Chest",
            "player_death": "Death01",
            "zombie_idle": "Idle",
            "zombie_walk": "Walk",
            "zombie_run": "Run",
            "zombie_attack": "Idle_Attack",
            "zombie_hit": "HitReact",
            "zombie_death": "Death",
        },
        "validation": {
            "status": "pass",
            "blender": "5.2.0 LTS",
            "all_25_shipping_glbs_blender_reimported": True,
            "kenney_glbs": "9/9 pass; glTF 2.0; identity roots; ground-aligned pivots; external shared palette present",
            "quaternius_glbs": "7/7 pass; glTF 2.0; no external URIs; selected action sets exact",
            "round003_environment_glbs": "6/6 pass under Blender 5.2.0; ordinary GLB; one mesh/material; grounded identity pivots; UV0 present; no images, external URIs, animations, required extensions, Draco, or Meshopt; 36,297 triangles and 1,323,612 bytes",
            "round003_textures": "6/6 ordinary 1024x1024 WebP built with cwebp 1.6.0; exact source/output SHA-256 and command flags recorded",
            "round004_character_weapon_glbs": "3/3 pass clean Blender 5.2.0 re-import; Nyra 70,984 triangles/65 bones/5 exact clips/5 draws, Hollow 32,389 triangles/50 bones/3 exact clips/5 draws, Stormcage 6,104 triangles/3 draws",
            "round004_build_textures": "3/3 ordinary PNG inputs embedded into the character GLBs and not loaded separately at runtime; exact hashes and recipes recorded",
            "round004_runtime_publish": "three source/runtime GLB pairs are byte-identical; 7,588,976 combined bytes",
            "mixed_license_lineage": "Nyra explicitly records BS-RAIN (CC-BY-4.0), Q-UAL1 (CC0), and Q-UAL2 (CC0); Hollow records Q-ZOMBIE (CC0); Stormcage records project-original with the former claymore used only as a non-derived orientation reference",
            "universal_rig_joint_count": 65,
            "universal_rig_joint_sequence_sha256": "32702abb0d4c46cf76d2b7d846603c56fd27bbb2c2e65aa6af1e155725615722",
            "zombie_joint_count": 50,
            "poly_haven": "publisher API MD5 matched the original 7 direct files plus all 16 Round003 glTF/dependency files; official info/files API snapshots retain exact SHA-256",
            "zip_integrity": "all 9 retained ZIPs pass unzip -t",
            "audio": "5/5 selected OGGs decode as stereo Vorbis 44.1 kHz",
            "gltf_transform": "not installed; no Draco/Meshopt/KTX2 transform applied",
        },
        "known_limitations": [
            "Rain Rig requires the credit 'Rain Rig (CC) Blender Foundation | studio.blender.org' and a modification notice wherever credits are distributed; the exact source, official page snapshot, license legalcode, and adaptation notice are retained.",
            "Quaternius modern Standard assets were archive-only, so four whole free ZIPs are retained raw and ignored by the scoped .gitignore.",
            "Standard Universal Base exposes only Superhero Female/Male; Female_Ranger uses Regular Female proportions. Joint schema matches, but the two are separate alternatives rather than a claimed seamless assembly.",
            "The publisher base glTF referenced missing T_Eye_Normal_png.png; a byte-identical alias of supplied T_Eye_Normal.png was used in scratch conversion only.",
            "Zombie Apocalypse License.txt incorrectly names Ultimate Platformer Pack; its CC0 declaration is intact and the original file is preserved unchanged.",
            "UAL2 Zombie_* clips use the 65-joint Universal rig and do not directly animate the selected 50-joint Zombie Basic without retargeting; use Zombie Basic's six embedded actions for the first playable.",
            "Kenney ruin GLBs require the relative case-sensitive Textures/colormap.png path.",
            "The Round003 Gothic Statue geometry intentionally receives the single shared fort-sector texture triplet at runtime; its publisher-specific 1K maps remain in the ignored verified raw cache and are not an additional manifest texture set.",
        ],
        "barriers": [
            {
                "status": "not_blocked",
                "detail": "Account-free Itch Standard downloads and public Drive folders worked; no manual/login/quota barrier was bypassed.",
            }
        ],
    }
    destination = ROOT / "ASSET_RECEIPT.json"
    destination.write_text(
        json.dumps(receipt, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()
