import * as THREE from "three";
import type { AssetRegistry } from "../loaders/AssetRegistry";

const GROUND_KEYS = {
  basecolor: "material.cobble-diffuse",
  normal: "material.cobble-normal",
  orm: "material.cobble-arm",
} as const;

const SECTOR_KEYS = {
  basecolor: "material.brick-diffuse",
  normal: "material.brick-normal",
  orm: "material.brick-arm",
} as const;

function requireTexture(assets: AssetRegistry, key: string): THREE.Texture {
  const texture = assets.getTexture(key);
  if (!texture) throw new Error(`Ashwake material texture was not loaded: ${key}`);
  return texture;
}

function configureTexture(
  texture: THREE.Texture,
  repeat: number,
  maxAnisotropy: number,
): THREE.Texture {
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.setScalar(repeat);
  texture.anisotropy = Math.min(8, Math.max(1, maxAnisotropy));
  texture.needsUpdate = true;
  return texture;
}

/** Two shared PBR materials keep the authored sector coherent and bounded. */
export class AshwakeMaterials {
  readonly ground: THREE.MeshStandardMaterial;
  readonly sector: THREE.MeshStandardMaterial;

  constructor(assets: AssetRegistry, maxAnisotropy: number) {
    const groundMap = configureTexture(
      requireTexture(assets, GROUND_KEYS.basecolor),
      11,
      maxAnisotropy,
    );
    const groundNormal = configureTexture(
      requireTexture(assets, GROUND_KEYS.normal),
      11,
      maxAnisotropy,
    );
    const groundOrm = configureTexture(
      requireTexture(assets, GROUND_KEYS.orm),
      11,
      maxAnisotropy,
    );
    this.ground = new THREE.MeshStandardMaterial({
      name: "AshwakeGroundShared",
      color: 0x6d6b64,
      map: groundMap,
      normalMap: groundNormal,
      normalScale: new THREE.Vector2(0.5, 0.5),
      roughness: 0.96,
      roughnessMap: groundOrm,
      metalness: 0.0,
      metalnessMap: groundOrm,
      envMapIntensity: 0.27,
    });

    const sectorMap = configureTexture(
      requireTexture(assets, SECTOR_KEYS.basecolor),
      1,
      maxAnisotropy,
    );
    const sectorNormal = configureTexture(
      requireTexture(assets, SECTOR_KEYS.normal),
      1,
      maxAnisotropy,
    );
    const sectorOrm = configureTexture(
      requireTexture(assets, SECTOR_KEYS.orm),
      1,
      maxAnisotropy,
    );
    this.sector = new THREE.MeshStandardMaterial({
      name: "AshwakeSectorShared",
      color: 0x777872,
      map: sectorMap,
      normalMap: sectorNormal,
      normalScale: new THREE.Vector2(0.42, 0.42),
      roughness: 0.93,
      roughnessMap: sectorOrm,
      metalness: 0.0,
      metalnessMap: sectorOrm,
      envMapIntensity: 0.38,
    });
  }

  dispose(): void {
    this.ground.dispose();
    this.sector.dispose();
  }
}
