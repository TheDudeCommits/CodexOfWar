import * as THREE from "three";
import type { AssetRegistry } from "../loaders/AssetRegistry";
import { AshwakeMaterials } from "../materials/AshwakeMaterials";

const SECTOR_KEYS = [
  "environment.ashwake-arena",
  "environment.ruin-doorway",
  "environment.ruin-wall",
  "environment.ruin-pillar",
  "environment.ruin-stairs",
  "environment.ruin-rocks",
] as const;

const MATERIAL_KEYS = [
  "material.cobble-diffuse",
  "material.cobble-normal",
  "material.cobble-arm",
  "material.brick-diffuse",
  "material.brick-normal",
  "material.brick-arm",
] as const;

type SectorKey = (typeof SECTOR_KEYS)[number];

interface SectorPlacement {
  key: SectorKey;
  name: string;
  position: readonly [number, number, number];
  rotation: number;
  scale: readonly [number, number, number];
}

const MAIN_PLACEMENTS: readonly SectorPlacement[] = [
  {
    key: "environment.ruin-doorway",
    name: "central-gate",
    position: [0, 0, -8.75],
    rotation: Math.PI / 2,
    scale: [0.72, 0.72, 0.72],
  },
  {
    key: "environment.ruin-wall",
    name: "west-curtain-wall",
    position: [-5.55, 0, -9.05],
    rotation: Math.PI / 2,
    scale: [0.72, 0.72, 0.72],
  },
  {
    key: "environment.ruin-wall",
    name: "east-curtain-wall",
    position: [5.55, 0, -9.05],
    rotation: Math.PI / 2,
    scale: [0.72, 0.72, 0.72],
  },
  {
    key: "environment.ruin-pillar",
    name: "west-round-tower",
    position: [-9.25, 0, -8.7],
    rotation: 0.07,
    scale: [0.36, 0.36, 0.36],
  },
  {
    key: "environment.ruin-pillar",
    name: "east-round-tower",
    position: [9.25, 0, -8.7],
    rotation: -0.08,
    scale: [0.36, 0.36, 0.36],
  },
  {
    key: "environment.ashwake-arena",
    name: "west-return-buttress",
    position: [-7.1, 0, -5.6],
    rotation: -0.24,
    scale: [0.43, 0.43, 0.43],
  },
  {
    key: "environment.ashwake-arena",
    name: "east-return-buttress",
    position: [7.15, 0, -5.75],
    rotation: 0.23,
    scale: [0.43, 0.43, 0.43],
  },
  {
    key: "environment.ruin-stairs",
    name: "west-wall-stair",
    position: [-3.25, 0, -7.45],
    rotation: Math.PI / 2,
    scale: [0.33, 0.33, 0.33],
  },
  {
    key: "environment.ruin-rocks",
    name: "gothic-statue",
    position: [4.25, 0.48, -5.55],
    rotation: -0.28,
    scale: [1.58, 1.58, 1.58],
  },
];

const DISTANT_PLACEMENTS: readonly SectorPlacement[] = [
  {
    key: "environment.ruin-wall",
    name: "distant-west-wall",
    position: [-7.8, 0, -18.2],
    rotation: Math.PI / 2,
    scale: [0.96, 0.96, 0.96],
  },
  {
    key: "environment.ruin-wall",
    name: "distant-central-wall",
    position: [0, 0, -18.7],
    rotation: Math.PI / 2,
    scale: [0.98, 0.98, 0.98],
  },
  {
    key: "environment.ruin-wall",
    name: "distant-east-wall",
    position: [7.8, 0, -18.2],
    rotation: Math.PI / 2,
    scale: [0.96, 0.96, 0.96],
  },
  {
    key: "environment.ruin-pillar",
    name: "distant-west-watchtower",
    position: [-13.2, 0, -18.9],
    rotation: 0.05,
    scale: [0.55, 0.55, 0.55],
  },
  {
    key: "environment.ruin-pillar",
    name: "distant-east-watchtower",
    position: [13.2, 0, -18.9],
    rotation: -0.04,
    scale: [0.55, 0.55, 0.55],
  },
];

const FOREGROUND_PLACEMENTS: readonly SectorPlacement[] = [
  {
    key: "environment.ashwake-arena",
    name: "west-low-foreground-fragment",
    position: [-10.6, -0.04, 5.9],
    rotation: 0.7,
    scale: [0.46, 0.18, 0.46],
  },
  {
    key: "environment.ruin-wall",
    name: "east-low-foreground-fragment",
    position: [10.9, -0.03, 4.4],
    rotation: -0.95,
    scale: [0.47, 0.16, 0.47],
  },
];

export class ArenaView {
  readonly root = new THREE.Group();
  readonly usingFallback: boolean;
  readonly fallbackReason: string | null;
  private readonly ownedGeometries: THREE.BufferGeometry[] = [];
  private readonly ownedMaterials: THREE.Material[] = [];
  private readonly embers: THREE.Points;
  private readonly materials: AshwakeMaterials | null;
  private ground: THREE.Mesh | null = null;
  private hordeGroundExtended = false;

  constructor(assets: AssetRegistry, maxAnisotropy = 1) {
    const missingGeometry = SECTOR_KEYS.filter((key) => assets.instantiate(key) === null);
    const missingTextures = MATERIAL_KEYS.filter((key) => assets.getTexture(key) === null);
    const missing = [...missingGeometry, ...missingTextures];
    this.usingFallback = missing.length > 0;
    this.fallbackReason = missing.length > 0 ? `missing ${missing.join(", ")}` : null;
    this.materials = this.usingFallback ? null : new AshwakeMaterials(assets, maxAnisotropy);
    this.embers = this.createEmbers();

    if (this.usingFallback) this.buildProceduralFallback();
    else this.buildAuthoredSector(assets);
    this.root.add(this.embers);
  }

  update(elapsed: number): void {
    this.embers.rotation.y = elapsed * 0.006;
    this.embers.position.y = Math.sin(elapsed * 0.42) * 0.035;
    const material = this.embers.material;
    if (material instanceof THREE.PointsMaterial) {
      material.opacity = 0.2 + Math.sin(elapsed * 1.3 + 0.4) * 0.025;
    }
  }

  extendGroundForHorde(): void {
    if (this.hordeGroundExtended || !this.ground) return;
    this.hordeGroundExtended = true;
    const authored = this.materials !== null;
    this.ground.geometry = this.trackGeometry(
      new THREE.PlaneGeometry(authored ? 120 : 100, authored ? 120 : 100),
    );
    if (!this.materials) return;
    const repeat = 11 * (120 / 64);
    const textures = new Set([
      this.materials.ground.map,
      this.materials.ground.normalMap,
      this.materials.ground.roughnessMap,
      this.materials.ground.metalnessMap,
    ]);
    for (const texture of textures) {
      if (!texture) continue;
      texture.repeat.setScalar(repeat);
      texture.needsUpdate = true;
    }
  }

  dispose(): void {
    this.materials?.dispose();
    for (const geometry of this.ownedGeometries) geometry.dispose();
    for (const material of this.ownedMaterials) material.dispose();
    this.ownedGeometries.length = 0;
    this.ownedMaterials.length = 0;
  }

  private buildAuthoredSector(assets: AssetRegistry): void {
    if (!this.materials) return;
    this.root.name = "environment.ashwake-fort-sector.authored";

    const ground = new THREE.Mesh(
      this.trackGeometry(new THREE.PlaneGeometry(64, 64, 1, 1)),
      this.materials.ground,
    );
    ground.name = "ashwake-ground-plane-no-visible-platform-edge";
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.035, -5);
    ground.receiveShadow = true;
    this.ground = ground;
    this.root.add(ground);

    const doorwayShape = new THREE.Shape();
    doorwayShape.moveTo(-0.86, 0);
    doorwayShape.lineTo(0.86, 0);
    doorwayShape.lineTo(0.86, 1.16);
    doorwayShape.absarc(0, 1.16, 0.86, 0, Math.PI, false);
    doorwayShape.lineTo(-0.86, 0);
    const doorwayField = new THREE.Mesh(
      this.trackGeometry(new THREE.ShapeGeometry(doorwayShape, 16)),
      this.trackMaterial(
        new THREE.MeshBasicMaterial({
          color: 0x060b0e,
          fog: true,
          toneMapped: false,
        }),
      ),
    );
    doorwayField.name = "dark-gate-contrast-field";
    doorwayField.position.set(0, 0.02, -9.72);
    this.root.add(doorwayField);

    for (const placement of [
      ...DISTANT_PLACEMENTS,
      ...MAIN_PLACEMENTS,
      ...FOREGROUND_PLACEMENTS,
    ]) {
      this.addPlacement(assets, placement, this.materials.sector);
    }

    const statuePedestal = new THREE.Mesh(
      this.trackGeometry(new THREE.CylinderGeometry(0.92, 1.08, 0.48, 12, 1)),
      this.materials.sector,
    );
    statuePedestal.name = "gothic-statue-pedestal";
    statuePedestal.position.set(4.25, 0.22, -5.55);
    statuePedestal.rotation.y = 0.14;
    statuePedestal.castShadow = true;
    statuePedestal.receiveShadow = true;
    this.root.add(statuePedestal);
  }

  private addPlacement(
    assets: AssetRegistry,
    placement: SectorPlacement,
    material: THREE.Material,
  ): void {
    const instance = assets.instantiate(placement.key);
    if (!instance) return;
    instance.name = `${placement.name}.authored-instance`;
    instance.position.set(...placement.position);
    instance.rotation.y = placement.rotation;
    instance.scale.set(...placement.scale);
    instance.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      node.material = material;
      node.castShadow = true;
      node.receiveShadow = true;
      node.frustumCulled = true;
    });
    this.root.add(instance);
  }

  private buildProceduralFallback(): void {
    this.root.name = "environment.ashwake-arena.procedural-fallback";
    const stone = this.trackMaterial(
      new THREE.MeshStandardMaterial({ color: 0x20262a, roughness: 0.94, metalness: 0 }),
    );
    const ground = new THREE.Mesh(this.trackGeometry(new THREE.PlaneGeometry(42, 42)), stone);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.035;
    ground.receiveShadow = true;
    this.ground = ground;
    this.root.add(ground);

    const fallbackPieces: readonly (readonly [number, number, number, number, number])[] = [
      [-6.4, 2.2, -8.6, 4.5, 4.4],
      [0, 2.65, -8.8, 4.3, 5.3],
      [6.4, 2.2, -8.6, 4.5, 4.4],
    ];
    for (const [x, y, z, width, height] of fallbackPieces) {
      const piece = new THREE.Mesh(
        this.trackGeometry(new THREE.BoxGeometry(width, height, 1.4)),
        stone,
      );
      piece.position.set(x, y, z);
      piece.castShadow = true;
      piece.receiveShadow = true;
      this.root.add(piece);
    }
  }

  private createEmbers(): THREE.Points {
    const count = 64;
    const positions = new Float32Array(count * 3);
    let value = 0xa51c_2026;
    const sample = (): number => {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 0x1_0000_0000;
    };
    for (let index = 0; index < count; index += 1) {
      const radius = 2.4 + sample() * 8.2;
      const angle = sample() * Math.PI * 2;
      positions[index * 3] = Math.sin(angle) * radius;
      positions[index * 3 + 1] = 0.16 + sample() * 2.6;
      positions[index * 3 + 2] = Math.cos(angle) * radius - 1.4;
    }
    const geometry = this.trackGeometry(new THREE.BufferGeometry());
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = this.trackMaterial(
      new THREE.PointsMaterial({
        color: 0xd57a51,
        size: 0.026,
        transparent: true,
        opacity: 0.2,
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
