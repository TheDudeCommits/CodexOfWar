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

/**
 * The combat simulation is bounded to an eleven-metre arena, but the camera can
 * orbit beyond the original single fort facade. These placements close the
 * other three sightlines with real authored fort modules so Horde mode reads as
 * a contained ruin rather than a textured plane disappearing into a void.
 */
const HORDE_PERIMETER_PLACEMENTS: readonly SectorPlacement[] = [
  {
    key: "environment.ruin-doorway",
    name: "horde-south-gate",
    position: [0, 0, 14.2],
    rotation: -Math.PI / 2,
    scale: [0.64, 0.64, 0.64],
  },
  {
    key: "environment.ruin-wall",
    name: "horde-south-west-wall",
    position: [-6.9, 0, 14.5],
    rotation: -Math.PI / 2,
    scale: [0.68, 0.68, 0.68],
  },
  {
    key: "environment.ruin-wall",
    name: "horde-south-east-wall",
    position: [6.9, 0, 14.5],
    rotation: -Math.PI / 2,
    scale: [0.68, 0.68, 0.68],
  },
  {
    key: "environment.ruin-pillar",
    name: "horde-south-west-tower",
    position: [-12.1, 0, 12.2],
    rotation: 0.08,
    scale: [0.42, 0.42, 0.42],
  },
  {
    key: "environment.ruin-pillar",
    name: "horde-south-east-tower",
    position: [12.1, 0, 12.2],
    rotation: -0.08,
    scale: [0.42, 0.42, 0.42],
  },
  {
    key: "environment.ruin-wall",
    name: "horde-west-return-wall-a",
    position: [-14.15, 0, 6.4],
    rotation: 0,
    scale: [0.7, 0.7, 0.7],
  },
  {
    key: "environment.ruin-wall",
    name: "horde-west-return-wall-b",
    position: [-14.45, 0, -1.1],
    rotation: 0,
    scale: [0.7, 0.7, 0.7],
  },
  {
    key: "environment.ruin-wall",
    name: "horde-east-return-wall-a",
    position: [14.15, 0, 6.4],
    rotation: Math.PI,
    scale: [0.7, 0.7, 0.7],
  },
  {
    key: "environment.ruin-wall",
    name: "horde-east-return-wall-b",
    position: [14.45, 0, -1.1],
    rotation: Math.PI,
    scale: [0.7, 0.7, 0.7],
  },
  {
    key: "environment.ashwake-arena",
    name: "horde-west-broken-return",
    position: [-12.9, -0.03, -6.5],
    rotation: 0.27,
    scale: [0.52, 0.48, 0.52],
  },
  {
    key: "environment.ashwake-arena",
    name: "horde-east-broken-return",
    position: [12.9, -0.03, -6.5],
    rotation: -0.27,
    scale: [0.52, 0.48, 0.52],
  },
];

interface BrazierPresentation {
  flame: THREE.Mesh;
  light: THREE.PointLight;
  phase: number;
}

export class ArenaView {
  readonly root = new THREE.Group();
  readonly usingFallback: boolean;
  readonly fallbackReason: string | null;
  private readonly ownedGeometries: THREE.BufferGeometry[] = [];
  private readonly ownedMaterials: THREE.Material[] = [];
  private readonly embers: THREE.Points;
  private readonly ash: THREE.Points;
  private readonly materials: AshwakeMaterials | null;
  private readonly braziers: BrazierPresentation[] = [];
  private ground: THREE.Mesh | null = null;
  private hordeGroundExtended = false;

  constructor(
    private readonly assets: AssetRegistry,
    maxAnisotropy = 1,
  ) {
    const missingGeometry = SECTOR_KEYS.filter((key) => assets.instantiate(key) === null);
    const missingTextures = MATERIAL_KEYS.filter((key) => assets.getTexture(key) === null);
    const missing = [...missingGeometry, ...missingTextures];
    this.usingFallback = missing.length > 0;
    this.fallbackReason = missing.length > 0 ? `missing ${missing.join(", ")}` : null;
    this.materials = this.usingFallback ? null : new AshwakeMaterials(assets, maxAnisotropy);
    this.embers = this.createEmbers();
    this.ash = this.createAshFall();

    if (this.usingFallback) this.buildProceduralFallback();
    else this.buildAuthoredSector(assets);
    this.root.add(this.embers, this.ash);
  }

  update(elapsed: number): void {
    this.embers.rotation.y = elapsed * 0.006;
    this.embers.position.y = Math.sin(elapsed * 0.42) * 0.035;
    const material = this.embers.material;
    if (material instanceof THREE.PointsMaterial) {
      material.opacity = 0.2 + Math.sin(elapsed * 1.3 + 0.4) * 0.025;
    }
    this.ash.rotation.y = -elapsed * 0.0025;
    this.ash.position.y = -((elapsed * 0.12) % 1.8);
    for (const brazier of this.braziers) {
      const pulse =
        Math.sin(elapsed * 7.1 + brazier.phase) * 0.08 +
        Math.sin(elapsed * 13.7 + brazier.phase * 1.7) * 0.035;
      brazier.flame.scale.set(0.88 - pulse * 0.5, 1 + pulse, 0.88 - pulse * 0.5);
      brazier.light.intensity = 2.55 + pulse * 2.2;
    }
  }

  extendGroundForHorde(): void {
    if (this.hordeGroundExtended || !this.ground) return;
    this.hordeGroundExtended = true;
    const authored = this.materials !== null;
    this.ground.geometry = this.trackGeometry(
      new THREE.PlaneGeometry(authored ? 120 : 100, authored ? 120 : 100),
    );
    if (this.materials) {
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
    this.buildHordeDressing();
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
    parent: THREE.Object3D = this.root,
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
    parent.add(instance);
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

  private buildHordeDressing(): void {
    const dressing = new THREE.Group();
    dressing.name = "environment.horde-perimeter-and-atmosphere";

    if (this.materials) {
      for (const placement of HORDE_PERIMETER_PLACEMENTS) {
        this.addPlacement(this.assets, placement, this.materials.sector, dressing);
      }
      this.addRubbleRing(dressing, this.materials.sector);
      this.addFortBanners(dressing);
    }
    this.addBraziers(dressing);
    this.addScorchedGround(dressing);
    this.root.add(dressing);
  }

  private addRubbleRing(parent: THREE.Group, material: THREE.Material): void {
    const geometry = this.trackGeometry(new THREE.DodecahedronGeometry(1, 0));
    let value = 0x9e37_79b9;
    const sample = (): number => {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 0x1_0000_0000;
    };
    for (let index = 0; index < 34; index += 1) {
      const angle = (index / 34) * Math.PI * 2 + (sample() - 0.5) * 0.17;
      const radius = 12.15 + sample() * 2.25;
      const rubble = new THREE.Mesh(geometry, material);
      rubble.name = `horde-perimeter-rubble-${index}`;
      rubble.position.set(Math.sin(angle) * radius, 0.08, Math.cos(angle) * radius + 1.8);
      rubble.rotation.set(sample() * 1.4, sample() * Math.PI, sample() * 1.1);
      rubble.scale.set(
        0.22 + sample() * 0.52,
        0.14 + sample() * 0.34,
        0.2 + sample() * 0.48,
      );
      rubble.castShadow = true;
      rubble.receiveShadow = true;
      parent.add(rubble);
    }
  }

  private addFortBanners(parent: THREE.Group): void {
    const cloth = this.trackMaterial(
      new THREE.MeshStandardMaterial({
        color: 0x4d1118,
        roughness: 0.88,
        metalness: 0,
        side: THREE.DoubleSide,
      }),
    );
    const geometry = this.trackGeometry(new THREE.PlaneGeometry(1.15, 3.15, 1, 4));
    for (const [index, x] of [-3.05, 3.05].entries()) {
      const banner = new THREE.Mesh(geometry, cloth);
      banner.name = `ashwake-fort-banner-${index}`;
      banner.position.set(x, 3.25, -8.28);
      banner.rotation.y = Math.PI;
      banner.castShadow = true;
      parent.add(banner);
    }
  }

  private addBraziers(parent: THREE.Group): void {
    const iron = this.trackMaterial(
      new THREE.MeshStandardMaterial({ color: 0x17191a, roughness: 0.58, metalness: 0.72 }),
    );
    const flameMaterial = this.trackMaterial(
      new THREE.MeshBasicMaterial({
        color: 0xff7b36,
        transparent: true,
        opacity: 0.86,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: true,
      }),
    );
    const standGeometry = this.trackGeometry(new THREE.CylinderGeometry(0.1, 0.17, 0.78, 8));
    const bowlGeometry = this.trackGeometry(new THREE.CylinderGeometry(0.42, 0.24, 0.24, 10));
    const flameGeometry = this.trackGeometry(new THREE.SphereGeometry(0.24, 8, 6));
    const positions = [
      [-7.4, 0, -5.5],
      [7.4, 0, -5.5],
      [-8.8, 0, 8.4],
      [8.8, 0, 8.4],
    ] as const;
    for (const [index, position] of positions.entries()) {
      const brazier = new THREE.Group();
      brazier.name = `horde-brazier-${index}`;
      brazier.position.set(position[0], position[1], position[2]);
      const stand = new THREE.Mesh(standGeometry, iron);
      stand.position.y = 0.39;
      stand.castShadow = true;
      const bowl = new THREE.Mesh(bowlGeometry, iron);
      bowl.position.y = 0.82;
      bowl.castShadow = true;
      const flame = new THREE.Mesh(flameGeometry, flameMaterial);
      flame.name = `horde-brazier-flame-${index}`;
      flame.position.y = 1.08;
      flame.scale.set(0.8, 1.35, 0.8);
      const light = new THREE.PointLight(0xff7434, 2.55, 7.5, 2);
      light.name = `horde-brazier-light-${index}`;
      light.position.y = 1.22;
      brazier.add(stand, bowl, flame, light);
      parent.add(brazier);
      this.braziers.push({ flame, light, phase: index * 1.73 });
    }
  }

  private addScorchedGround(parent: THREE.Group): void {
    const material = this.trackMaterial(
      new THREE.MeshBasicMaterial({
        color: 0x120d0c,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
        toneMapped: true,
      }),
    );
    const geometry = this.trackGeometry(new THREE.CircleGeometry(1, 15));
    const patches = [
      [-4.8, -0.6, 1.7, 0.7],
      [3.6, 2.5, 2.1, 0.9],
      [-1.2, 6.1, 1.45, 0.62],
      [6.8, -2.2, 1.25, 0.55],
      [-7.4, 5.4, 1.7, 0.74],
      [1.4, -4.4, 1.15, 0.48],
    ] as const;
    for (const [index, [x, z, sx, sz]] of patches.entries()) {
      const patch = new THREE.Mesh(geometry, material);
      patch.name = `horde-ground-scorch-${index}`;
      patch.rotation.x = -Math.PI / 2;
      patch.rotation.z = index * 0.73;
      patch.position.set(x, -0.025, z);
      patch.scale.set(sx, sz, 1);
      parent.add(patch);
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

  private createAshFall(): THREE.Points {
    const count = 148;
    const positions = new Float32Array(count * 3);
    let value = 0x6d2b_79f5;
    const sample = (): number => {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 0x1_0000_0000;
    };
    for (let index = 0; index < count; index += 1) {
      const radius = 3 + sample() * 15;
      const angle = sample() * Math.PI * 2;
      positions[index * 3] = Math.sin(angle) * radius;
      positions[index * 3 + 1] = 0.4 + sample() * 7.4;
      positions[index * 3 + 2] = Math.cos(angle) * radius + 1.8;
    }
    const geometry = this.trackGeometry(new THREE.BufferGeometry());
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = this.trackMaterial(
      new THREE.PointsMaterial({
        color: 0xc7c1b6,
        size: 0.035,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
        sizeAttenuation: true,
        fog: true,
      }),
    );
    const ash = new THREE.Points(geometry, material);
    ash.name = "ashwake-falling-ash";
    return ash;
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
