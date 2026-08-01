import * as THREE from "three";
import type { AssetRegistry } from "../loaders/AssetRegistry";

const RUIN_KEYS = [
  "environment.ashwake-arena",
  "environment.ruin-doorway",
  "environment.ruin-wall",
  "environment.ruin-pillar",
  "environment.ruin-stairs",
  "environment.ruin-rocks",
] as const;

interface RuinPlacement {
  key: (typeof RUIN_KEYS)[number];
  position: readonly [number, number, number];
  rotation: number;
  scale: readonly [number, number, number];
}

const RUIN_PLACEMENTS: readonly RuinPlacement[] = [
  {
    key: "environment.ashwake-arena",
    position: [-6.3, 0, -8.8],
    rotation: 0.12,
    scale: [4.6, 4.6, 4.6],
  },
  {
    key: "environment.ruin-doorway",
    position: [0.05, 0, -8.65],
    rotation: Math.PI / 2,
    scale: [4.25, 4.25, 4.25],
  },
  {
    key: "environment.ruin-wall",
    position: [-3.25, 0, -8.35],
    rotation: 0.05,
    scale: [3.65, 3.15, 2.25],
  },
  {
    key: "environment.ruin-wall",
    position: [3.15, 0, -8.25],
    rotation: -0.08,
    scale: [3.7, 2.75, 2.2],
  },
  {
    key: "environment.ruin-pillar",
    position: [-5.0, 0, -6.8],
    rotation: -0.1,
    scale: [2.5, 4.05, 2.5],
  },
  {
    key: "environment.ruin-pillar",
    position: [5.15, 0, -6.65],
    rotation: 0.14,
    scale: [2.5, 3.6, 2.5],
  },
  {
    key: "environment.ruin-stairs",
    position: [0.2, 0.06, -5.55],
    rotation: Math.PI,
    scale: [4.8, 2.1, 4.0],
  },
  {
    key: "environment.ruin-rocks",
    position: [-4.1, 0.03, -4.9],
    rotation: 0.35,
    scale: [2.1, 1.45, 2.1],
  },
  {
    key: "environment.ruin-rocks",
    position: [4.2, 0.03, -4.65],
    rotation: -0.52,
    scale: [1.65, 1.2, 1.65],
  },
  // Kept in the camera's left-side travel lane so this art pass does not imply
  // that the separately tracked boom-obstruction defect was repaired.
  {
    key: "environment.ruin-pillar",
    position: [-4.85, 0, 6.2],
    rotation: 0.2,
    scale: [2.25, 3.4, 2.25],
  },
];

export class ArenaView {
  readonly root = new THREE.Group();
  readonly usingFallback: boolean;
  readonly fallbackReason: string | null;
  private readonly ownedGeometries: THREE.BufferGeometry[] = [];
  private readonly ownedMaterials: THREE.Material[] = [];
  private readonly ritualMaterial: THREE.MeshBasicMaterial;
  private readonly embers: THREE.Points;

  constructor(assets: AssetRegistry) {
    const requiredKeys = [
      ...RUIN_KEYS,
      "material.cobble-diffuse",
      "material.cobble-normal",
      "material.cobble-arm",
      "material.brick-diffuse",
      "material.brick-normal",
      "material.brick-arm",
    ];
    const missing = requiredKeys.filter((key) => {
      if (key.startsWith("material.")) return assets.getTexture(key) === null;
      return assets.instantiate(key) === null;
    });
    this.usingFallback = missing.length > 0;
    this.fallbackReason = missing.length > 0 ? `missing ${missing.join(", ")}` : null;

    this.ritualMaterial = this.trackMaterial(
      new THREE.MeshBasicMaterial({
        color: 0xd46d43,
        transparent: true,
        opacity: 0.42,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.embers = this.createEmbers();

    if (this.usingFallback) this.buildProceduralFallback();
    else this.buildAuthoredSector(assets);
    this.root.add(this.embers);
  }

  update(elapsed: number): void {
    this.ritualMaterial.opacity = 0.34 + Math.sin(elapsed * 1.8) * 0.08;
    this.embers.rotation.y = elapsed * 0.012;
    this.embers.position.y = Math.sin(elapsed * 0.48) * 0.06;
  }

  dispose(): void {
    for (const geometry of this.ownedGeometries) geometry.dispose();
    for (const material of this.ownedMaterials) material.dispose();
    this.ownedGeometries.length = 0;
    this.ownedMaterials.length = 0;
  }

  private buildAuthoredSector(assets: AssetRegistry): void {
    this.root.name = "environment.ashwake-arena.authored";
    const cobble = this.makePbrMaterial(
      assets,
      "material.cobble-diffuse",
      "material.cobble-normal",
      "material.cobble-arm",
      5.2,
      5.2,
      0.94,
      0.04,
    );
    const brick = this.makePbrMaterial(
      assets,
      "material.brick-diffuse",
      "material.brick-normal",
      "material.brick-arm",
      2.8,
      2.8,
      0.88,
      0.055,
    );

    const ground = new THREE.Mesh(this.trackGeometry(new THREE.CylinderGeometry(12, 12.25, 0.42, 72)), cobble);
    ground.position.y = -0.25;
    ground.receiveShadow = true;
    this.root.add(ground);

    const sectorFoundation = new THREE.Mesh(
      this.trackGeometry(new THREE.BoxGeometry(15.5, 0.62, 3.45, 1, 1, 1)),
      brick,
    );
    sectorFoundation.position.set(0, -0.06, -8.35);
    sectorFoundation.castShadow = true;
    sectorFoundation.receiveShadow = true;
    this.root.add(sectorFoundation);

    let ruinPaletteMaterial: THREE.Material | null = null;
    for (const placement of RUIN_PLACEMENTS) {
      const ruin = assets.instantiate(placement.key);
      if (!ruin) continue;
      ruin.position.set(...placement.position);
      ruin.rotation.y = placement.rotation;
      ruin.scale.set(...placement.scale);
      ruin.name = `${placement.key}.authored-instance`;
      ruin.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return;
        if (!ruinPaletteMaterial) {
          const sourceMaterial = Array.isArray(node.material) ? node.material[0] : node.material;
          if (sourceMaterial) {
            ruinPaletteMaterial = this.trackMaterial(sourceMaterial.clone());
            if (ruinPaletteMaterial instanceof THREE.MeshStandardMaterial) {
              ruinPaletteMaterial.color.setHex(0x7b8790);
              ruinPaletteMaterial.envMapIntensity = 0.82;
              ruinPaletteMaterial.roughness = 0.88;
              ruinPaletteMaterial.metalness = 0.015;
            }
          }
        }
        if (ruinPaletteMaterial) node.material = ruinPaletteMaterial;
        node.castShadow = true;
        node.receiveShadow = true;
      });
      this.root.add(ruin);
    }

    const ring = new THREE.Mesh(
      this.trackGeometry(new THREE.TorusGeometry(4.8, 0.038, 6, 80)),
      this.ritualMaterial,
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.024;
    this.root.add(ring);

    const innerRing = new THREE.Mesh(
      this.trackGeometry(new THREE.TorusGeometry(2.05, 0.018, 5, 64)),
      this.ritualMaterial,
    );
    innerRing.rotation.x = Math.PI / 2;
    innerRing.position.y = 0.027;
    this.root.add(innerRing);
  }

  private buildProceduralFallback(): void {
    this.root.name = "environment.ashwake-arena.procedural-fallback";
    const stone = this.trackMaterial(
      new THREE.MeshStandardMaterial({ color: 0x20242a, roughness: 0.92, metalness: 0.04 }),
    );
    const ground = new THREE.Mesh(this.trackGeometry(new THREE.CylinderGeometry(12, 12.2, 0.42, 64)), stone);
    ground.position.y = -0.25;
    ground.receiveShadow = true;
    this.root.add(ground);

    const fallbackPieces: readonly (readonly [number, number, number, number, number])[] = [
      [-5.7, 2.1, -8.4, 2.2, 4.2],
      [-2.5, 1.65, -8.6, 2.4, 3.3],
      [0, 2.3, -8.75, 2.1, 4.6],
      [2.65, 1.85, -8.55, 2.5, 3.7],
      [5.8, 2.2, -8.2, 2.1, 4.4],
      [-4.8, 1.9, 6.2, 1.7, 3.8],
    ];
    for (const [x, y, z, width, height] of fallbackPieces) {
      const piece = new THREE.Mesh(
        this.trackGeometry(new THREE.BoxGeometry(width, height, 1.1)),
        stone,
      );
      piece.position.set(x, y, z);
      piece.castShadow = true;
      piece.receiveShadow = true;
      this.root.add(piece);
    }
  }

  private makePbrMaterial(
    assets: AssetRegistry,
    diffuseKey: string,
    normalKey: string,
    armKey: string,
    repeatX: number,
    repeatY: number,
    roughness: number,
    metalness: number,
  ): THREE.MeshStandardMaterial {
    const map = assets.getTexture(diffuseKey)!;
    const normalMap = assets.getTexture(normalKey)!;
    const armMap = assets.getTexture(armKey)!;
    for (const texture of [map, normalMap, armMap]) texture.repeat.set(repeatX, repeatY);
    return this.trackMaterial(
      new THREE.MeshStandardMaterial({
        color: 0xc8c0af,
        map,
        normalMap,
        normalScale: new THREE.Vector2(0.72, 0.72),
        roughness,
        roughnessMap: armMap,
        metalness,
        metalnessMap: armMap,
        envMapIntensity: 0.95,
      }),
    );
  }

  private createEmbers(): THREE.Points {
    const count = 110;
    const positions = new Float32Array(count * 3);
    let value = 0xa51c_2026;
    const random = (): number => {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 0x1_0000_0000;
    };
    for (let index = 0; index < count; index += 1) {
      const radius = 1.7 + random() * 9.1;
      const angle = random() * Math.PI * 2;
      positions[index * 3] = Math.sin(angle) * radius;
      positions[index * 3 + 1] = 0.18 + random() * 3.9;
      positions[index * 3 + 2] = Math.cos(angle) * radius;
    }
    const geometry = this.trackGeometry(new THREE.BufferGeometry());
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = this.trackMaterial(
      new THREE.PointsMaterial({
        color: 0xe98b5b,
        size: 0.04,
        transparent: true,
        opacity: 0.48,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      }),
    );
    return new THREE.Points(geometry, material);
  }

  private trackGeometry<T extends THREE.BufferGeometry>(geometry: T): T {
    this.ownedGeometries.push(geometry);
    return geometry;
  }

  private trackMaterial<T extends THREE.Material>(material: T): T {
    this.ownedMaterials.push(material);
    return material;
  }
}
