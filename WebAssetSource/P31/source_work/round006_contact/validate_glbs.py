#!/usr/bin/env python3
"""Static GLB, texture-contract, budget, and frozen-boundary validation."""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path
import struct
from typing import Any
import zlib


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
HERO_GLB = HERE / "glb/nyra.glb"
WEAPON_GLB = HERE / "glb/stormcage.glb"
HOLLOW_GLB = ROOT / "WebAssetSource/P31/processed/round005/characters/hollow.glb"
BUILD_REPORT = HERE / "reports/build-report.json"
CONTACT_REPORT = HERE / "reports/contact-validation.json"
REPORT_PATH = HERE / "reports/static-validation.json"

GLB_JSON = 0x4E4F534A
GLB_BIN = 0x004E4942

EXPECTED_FROZEN = {
    "web-game/public/assets/manifest.json": "373e2af4dd5173f68c4e45cc7c0b5eede06fc135839c25f43a512369a760ba75",
    "web-game/public/assets/models/ashwake/hollow.glb": "f53a481f118c48dff825b8f98427957e6201434848416ff265f22eb2b07e689d",
    "web-game/src/render/objects/CharacterViews.ts": "79a6e97d04a6f9a19b86baa8344a46caf7d962f43fc1f5d916ebafbce5b1bab6",
    "web-game/src/render/objects/ArenaView.ts": "93bb02f9ac9d95fbcb82de8a14fd587f3b9e3414180b1d47a10bb1c5173e4f1b",
    "web-game/src/ui/Hud.ts": "027f362bb1446c2606d7a8278b05458335a00f370904c2979bdac87d9b8fe3d5",
    "web-game/src/render/app/ThirdPersonCamera.ts": "9fd0b53dc77689581a4a747a3aadc2e592f8ecf5c84d9b69c44273075f3d2fdd",
    "web-game/src/game/simulation/FixedStepClock.ts": "1f99d2125d0e77f6ec9c4a0ae7deabfe80b03a88ca6ddece3a61129cc77ca081",
    "web-game/src/game/simulation/GameSimulation.ts": "dd51f0266e5b5006c134ffbc1a861158b87939b42927ea521934637d16c11196",
    "web-game/src/game/simulation/constants.ts": "96ccfddbf9141e85370abc550a56a41f62cbce6e9a1e62001fd3a53fd99700f9",
    "web-game/src/game/simulation/math.ts": "a437f63ed8da7b2d9be20da95193c3faaacec2a77e5b5b3260db033fbbe404dc",
    "web-game/src/game/simulation/types.ts": "277dfbad2a00f468a95f7105a259cfecff81e3c120da6166c97c3364739c1c22",
    "web-game/src/physics/PhysicsBridge.ts": "c0cdf7832cbb5c25cac51141c5d9ab38a9ad607fe411670035e61ca4c5db4054",
    "web-game/src/game/input/InputController.ts": "86e0599f939a52e548ad0434eb5e815d1e72a39dda80a20ea8499ff2484000ed",
    "web-game/src/game/input/actions.ts": "76ff3949700b1eaa17900386a9d46060e460a60ab56b932f9531bcd02e64b161",
    "web-game/src/diagnostics/CowReviewHarness.ts": "28a0631b5f9264ea8a1eccf6dd17cd918b011ab632a44f3d8bce93c2d9e2e34c",
    "web-game/src/diagnostics/PerfDiagnostics.ts": "fe13926df4082795e6974592909f3e522a9d1047175d376fb9267b312f596c05",
    "web-game/src/diagnostics/captureHooks.ts": "13779544e298b585df160ac31c411dd1e884eb9a1e3df23a66cafdc0c460ae61",
    "web-game/src/render/adapters/RenderBridge.ts": "441ee1c40f8b7f07ae82539fee85e9091eff1050a526d7df5b82388ef66a9468",
}


def sha256_bytes(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def sha256(path: Path) -> str:
    return sha256_bytes(path.read_bytes())


def parse_glb(path: Path) -> tuple[dict[str, Any], bytes, int]:
    payload = path.read_bytes()
    if len(payload) < 28 or payload[:4] != b"glTF":
        raise ValueError(f"{path.name}: not a GLB")
    version, declared = struct.unpack_from("<II", payload, 4)
    if version != 2 or declared != len(payload):
        raise ValueError(f"{path.name}: invalid GLB 2 header")
    json_length, json_type = struct.unpack_from("<II", payload, 12)
    if json_type != GLB_JSON:
        raise ValueError(f"{path.name}: first chunk is not JSON")
    json_end = 20 + json_length
    gltf = json.loads(payload[20:json_end].decode("utf-8").rstrip(" \t\r\n\0"))
    bin_length, bin_type = struct.unpack_from("<II", payload, json_end)
    if bin_type != GLB_BIN:
        raise ValueError(f"{path.name}: second chunk is not BIN")
    bin_start = json_end + 8
    if bin_start + bin_length > len(payload):
        raise ValueError(f"{path.name}: truncated BIN chunk")
    return gltf, payload, bin_start


def primitive_triangles(gltf: dict[str, Any], primitive: dict[str, Any]) -> int:
    accessor = gltf["accessors"][
        primitive["indices"] if "indices" in primitive else primitive["attributes"]["POSITION"]
    ]
    count = int(accessor["count"])
    mode = int(primitive.get("mode", 4))
    if mode == 4:
        return count // 3
    if mode in (5, 6):
        return max(0, count - 2)
    return 0


def animation_duration(gltf: dict[str, Any], animation: dict[str, Any]) -> float:
    result = 0.0
    for sampler in animation.get("samplers", []):
        maximum = gltf["accessors"][sampler["input"]].get("max", [0.0])
        result = max(result, float(maximum[0] if maximum else 0.0))
    return result


def inspect_asset(path: Path) -> dict[str, Any]:
    gltf, payload, bin_start = parse_glb(path)
    if gltf.get("asset", {}).get("version") != "2.0":
        raise ValueError(f"{path.name}: asset.version is not 2.0")
    if any("uri" in buffer for buffer in gltf.get("buffers", [])):
        raise ValueError(f"{path.name}: external buffer URI")
    if any("uri" in image for image in gltf.get("images", [])):
        raise ValueError(f"{path.name}: external image URI")
    primitives = [
        primitive
        for mesh in gltf.get("meshes", [])
        for primitive in mesh.get("primitives", [])
    ]
    parents: dict[int, int] = {}
    for parent_index, node in enumerate(gltf.get("nodes", [])):
        for child in node.get("children", []):
            parents[int(child)] = parent_index
    image_bytes: dict[str, bytes] = {}
    for image in gltf.get("images", []):
        view = gltf["bufferViews"][image["bufferView"]]
        start = bin_start + int(view.get("byteOffset", 0))
        end = start + int(view["byteLength"])
        image_bytes[image.get("name", "")] = payload[start:end]
    return {
        "path": path,
        "gltf": gltf,
        "sha256": sha256_bytes(payload),
        "bytes": len(payload),
        "primitives": len(primitives),
        "triangles": sum(primitive_triangles(gltf, primitive) for primitive in primitives),
        "materials": len(gltf.get("materials", [])),
        "textures": len(gltf.get("textures", [])),
        "images": len(gltf.get("images", [])),
        "geometries": len(gltf.get("meshes", [])),
        "skins": len(gltf.get("skins", [])),
        "joints": len(gltf.get("skins", [{}])[0].get("joints", [])) if gltf.get("skins") else 0,
        "animations": {
            animation.get("name", ""): animation_duration(gltf, animation)
            for animation in gltf.get("animations", [])
        },
        "parents": parents,
        "image_bytes": image_bytes,
    }


def decode_rgba_png(payload: bytes) -> tuple[int, int, list[tuple[int, int, int, int]]]:
    if payload[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("not PNG")
    offset = 8
    width = height = 0
    compressed = bytearray()
    while offset < len(payload):
        length = struct.unpack_from(">I", payload, offset)[0]
        kind = payload[offset + 4 : offset + 8]
        data = payload[offset + 8 : offset + 8 + length]
        offset += 12 + length
        if kind == b"IHDR":
            width, height, depth, color_type, *_ = struct.unpack(">IIBBBBB", data)
            if depth != 8 or color_type != 6:
                raise ValueError("expected RGBA8 PNG")
        elif kind == b"IDAT":
            compressed.extend(data)
        elif kind == b"IEND":
            break
    raw = zlib.decompress(bytes(compressed))
    stride = width * 4
    pixels: list[tuple[int, int, int, int]] = []
    for y in range(height):
        row = raw[y * (stride + 1) : (y + 1) * (stride + 1)]
        if row[0] != 0:
            raise ValueError("expected deterministic filter type 0")
        pixels.extend(tuple(row[index : index + 4]) for index in range(1, len(row), 4))
    return width, height, pixels


def texture_semantics(asset: dict[str, Any], prefix: str, material_name: str) -> dict[str, Any]:
    gltf = asset["gltf"]
    material = next(material for material in gltf["materials"] if material.get("name") == material_name)
    pbr = material.get("pbrMetallicRoughness", {})
    slots = {
        "base_color": pbr.get("baseColorTexture", {}).get("index"),
        "normal": material.get("normalTexture", {}).get("index"),
        "orm_metallic_roughness": pbr.get("metallicRoughnessTexture", {}).get("index"),
        "orm_occlusion": material.get("occlusionTexture", {}).get("index"),
    }
    if any(index is None for index in slots.values()):
        raise ValueError(f"{material_name}: incomplete PBR slots {slots}")
    if slots["orm_metallic_roughness"] != slots["orm_occlusion"]:
        raise ValueError(f"{material_name}: ORM texture is not shared")

    image_names: dict[str, str] = {}
    for slot, texture_index in slots.items():
        source = gltf["textures"][texture_index]["source"]
        image_names[slot] = gltf["images"][source].get("name", "")
    required = {
        "base_color": f"{prefix}_basecolor",
        "normal": f"{prefix}_normal",
        "orm_metallic_roughness": f"{prefix}_orm",
        "orm_occlusion": f"{prefix}_orm",
    }
    if image_names != required:
        raise ValueError(f"{material_name}: PBR image mapping {image_names} != {required}")

    reports: dict[str, Any] = {}
    unique_payloads = {
        "base_color": asset["image_bytes"][required["base_color"]],
        "normal": asset["image_bytes"][required["normal"]],
        "orm": asset["image_bytes"][required["orm_occlusion"]],
    }
    decoded: dict[str, list[tuple[int, int, int, int]]] = {}
    for kind, payload in unique_payloads.items():
        width, height, pixels = decode_rgba_png(payload)
        if (width, height) != (256, 256):
            raise ValueError(f"{material_name}/{kind}: expected 256x256")
        decoded[kind] = pixels
        ranges = [max(pixel[channel] for pixel in pixels) - min(pixel[channel] for pixel in pixels) for channel in range(3)]
        reports[kind] = {
            "sha256": sha256_bytes(payload),
            "bytes": len(payload),
            "resolution": [width, height],
            "unique_rgb": len({pixel[:3] for pixel in pixels}),
            "channel_ranges": ranges,
        }
    if reports["base_color"]["unique_rgb"] < 32 or max(reports["base_color"]["channel_ranges"]) < 32:
        raise ValueError(f"{material_name}: base color is placeholder-like")
    normal_pixels = decoded["normal"]
    detail_fraction = sum(
        1 for red, green, _blue, _alpha in normal_pixels if abs(red - 128) + abs(green - 128) > 10
    ) / len(normal_pixels)
    mean_blue = sum(pixel[2] for pixel in normal_pixels) / len(normal_pixels)
    reports["normal"]["detail_fraction"] = detail_fraction
    reports["normal"]["mean_blue"] = mean_blue
    if detail_fraction < 0.10 or mean_blue < 180:
        raise ValueError(f"{material_name}: normal map is flat or non-tangent-space")
    orm_ranges = reports["orm"]["channel_ranges"]
    if any(channel_range < 18 for channel_range in orm_ranges):
        raise ValueError(f"{material_name}: ORM channels lack authored variation {orm_ranges}")
    reports["colorspace_contract"] = {
        "base_color": "sRGB glTF baseColorTexture",
        "normal": "linear tangent-space normalTexture",
        "orm": "linear R=occlusion G=roughness B=metallic",
    }
    return reports


def node_parent_name(asset: dict[str, Any], child_name: str) -> str | None:
    nodes = asset["gltf"].get("nodes", [])
    child_index = next(index for index, node in enumerate(nodes) if node.get("name") == child_name)
    parent_index = asset["parents"].get(child_index)
    return nodes[parent_index].get("name") if parent_index is not None else None


def main() -> None:
    build = json.loads(BUILD_REPORT.read_text(encoding="utf-8"))
    contact = json.loads(CONTACT_REPORT.read_text(encoding="utf-8"))
    if build.get("integrated") is not False or build.get("acceptance_claimed") is not False:
        raise ValueError("build must stay non-integrated with no acceptance claim")
    if contact.get("status") != "pass":
        raise ValueError("contact validation is not passing/current")

    hero = inspect_asset(HERO_GLB)
    weapon = inspect_asset(WEAPON_GLB)
    hollow = inspect_asset(HOLLOW_GLB)
    if set(hero["animations"]) != {"Idle_Loop", "Walk_Loop", "Sprint_Loop", "Roll", "Sword_Regular_A"}:
        raise ValueError(f"hero animation drift {sorted(hero['animations'])}")
    if weapon["animations"] or weapon["skins"]:
        raise ValueError("weapon must remain static")
    if hero["skins"] != 1 or hero["joints"] != 65:
        raise ValueError(f"hero skin contract {hero['skins']}/{hero['joints']}")
    if node_parent_name(hero, "weapon_socket") != "hand_r":
        raise ValueError("weapon_socket is not a hand_r child")
    hero_nodes = {node.get("name", "") for node in hero["gltf"].get("nodes", [])}
    weapon_nodes = {node.get("name", "") for node in weapon["gltf"].get("nodes", [])}
    if not {"weapon_socket", "left_palm_grip_target"}.issubset(hero_nodes):
        raise ValueError("hero grip nodes missing")
    if not {"ClaymoreRoot", "GripPrimary", "GripSecondary", "secondary_grip", "ContactMarker", "BladeTip"}.issubset(weapon_nodes):
        raise ValueError("weapon grip/contact nodes missing")
    if hero["triangles"] > 42_000 or weapon["triangles"] > 3_000 or hollow["triangles"] > 16_000:
        raise ValueError("per-asset triangle cap exceeded")

    texture_reports = {
        "nyra": texture_semantics(hero, "nyra_round006", "Nyra_TealCloth"),
        "stormcage": texture_semantics(weapon, "stormcage_round006", "Dawnbreak_Steel"),
    }
    package_triangles = hero["triangles"] + hollow["triangles"] + weapon["triangles"]
    package_primitives = hero["primitives"] + hollow["primitives"] + weapon["primitives"]
    projected = {
        "triangles": 103_855 + 2 * package_triangles,
        "calls": 42 + 2 * package_primitives,
        "textures": 24 + hero["textures"] + hollow["textures"] + weapon["textures"],
        "geometries": 16 + hero["geometries"] + hollow["geometries"] + weapon["geometries"],
    }
    limits = {"triangles": 250_000, "calls": 100, "textures": 32, "geometries": 64}
    if package_triangles > 68_000:
        raise ValueError(f"package triangles {package_triangles} > 68000")
    for key, value in projected.items():
        if value > limits[key]:
            raise ValueError(f"projected {key} {value} > {limits[key]}")

    frozen: dict[str, Any] = {}
    for relative, expected in EXPECTED_FROZEN.items():
        path = ROOT / relative
        actual = sha256(path)
        if actual != expected:
            raise ValueError(f"frozen drift {relative}: {actual} != {expected}")
        frozen[relative] = actual

    manifest = json.loads((ROOT / "web-game/public/assets/manifest.json").read_text(encoding="utf-8"))
    manifest_assets = manifest["assets"]
    bindings = {
        "character.hero": manifest_assets["character.hero"]["url"],
        "character.hollow": manifest_assets["character.hollow"]["url"],
        "weapon.claymore": manifest_assets["weapon.claymore"]["url"],
    }
    expected_bindings = {
        "character.hero": "/assets/models/ashwake/nyra.glb",
        "character.hollow": "/assets/models/ashwake/hollow.glb",
        "weapon.claymore": "/assets/models/ashwake/stormcage.glb",
    }
    if bindings != expected_bindings:
        raise ValueError(f"manifest binding drift {bindings}")

    def public(asset: dict[str, Any]) -> dict[str, Any]:
        return {
            key: asset[key]
            for key in (
                "sha256", "bytes", "primitives", "triangles", "materials", "textures",
                "images", "geometries", "skins", "joints", "animations",
            )
        }

    report = {
        "schema": "p31.round006.static-glb-validation.v1",
        "status": "pass",
        "integrated": False,
        "acceptance_claimed": False,
        "assets": {
            "hero": public(hero),
            "weapon": public(weapon),
            "frozen_hollow": public(hollow),
        },
        "texture_semantics": texture_reports,
        "package": {
            "visible_triangles": package_triangles,
            "visible_primitives": package_primitives,
            "projected_s04": projected,
            "limits": limits,
        },
        "frozen_boundary": {
            "files": frozen,
            "manifest_bindings": bindings,
        },
        "assertions": {
            "self_contained_glb2": True,
            "exact_clip_and_skin_contract": True,
            "right_hand_socket_and_explicit_secondary_grip": True,
            "embedded_semantic_base_normal_orm": True,
            "contact_bvh_report_current": True,
            "resource_caps": True,
            "frozen_runtime_boundary": True,
        },
    }
    REPORT_PATH.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print("ROUND006_STATIC_VALIDATION=" + json.dumps(report, sort_keys=True))


if __name__ == "__main__":
    main()
