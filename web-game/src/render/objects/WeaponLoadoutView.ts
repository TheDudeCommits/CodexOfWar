import * as THREE from "three";

export type WeaponVisualID = "katana" | "greatsword" | "twin-blades";

export interface WeaponLoadoutPresentation {
  activeWeapon: WeaponVisualID;
  specialCooldown01: number;
  specialActive01: number;
  elapsed: number;
}

export const WEAPON_VISUAL_STYLE: Readonly<Record<WeaponVisualID, {
  accent: number;
  glow: number;
  label: string;
}>> = Object.freeze({
  katana: { accent: 0x8ce9ff, glow: 0x25bde5, label: "MOONVEIL" },
  greatsword: { accent: 0xff9b52, glow: 0xff4d19, label: "STORMCAGE" },
  "twin-blades": { accent: 0xd7a0ff, glow: 0x8b3dff, label: "NIGHTFANG" },
});

interface ForgedWeapon {
  root: THREE.Group;
  glowMaterials: THREE.MeshStandardMaterial[];
}

function configureWeaponMesh(mesh: THREE.Mesh): void {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = true;
}

function createBladeMaterial(style: (typeof WEAPON_VISUAL_STYLE)[WeaponVisualID]): {
  steel: THREE.MeshStandardMaterial;
  glow: THREE.MeshStandardMaterial;
} {
  return {
    steel: new THREE.MeshStandardMaterial({
      color: 0xcbd5df,
      metalness: 0.88,
      roughness: 0.22,
      envMapIntensity: 1.45,
    }),
    glow: new THREE.MeshStandardMaterial({
      color: style.accent,
      emissive: style.glow,
      emissiveIntensity: 1.35,
      metalness: 0.2,
      roughness: 0.3,
      toneMapped: false,
    }),
  };
}

function buildKatana(
  geometries: THREE.BufferGeometry[],
  materials: THREE.Material[],
): ForgedWeapon {
  const root = new THREE.Group();
  root.name = "weapon-loadout.katana";
  const { steel, glow } = createBladeMaterial(WEAPON_VISUAL_STYLE.katana);
  const gripMaterial = new THREE.MeshStandardMaterial({
    color: 0x10131b,
    metalness: 0.18,
    roughness: 0.82,
  });
  materials.push(steel, glow, gripMaterial);

  const bladeGeometry = new THREE.BoxGeometry(0.052, 1.26, 0.018, 1, 5, 1);
  const edgeGeometry = new THREE.BoxGeometry(0.012, 1.23, 0.022);
  const guardGeometry = new THREE.BoxGeometry(0.29, 0.034, 0.075);
  const gripGeometry = new THREE.CylinderGeometry(0.035, 0.041, 0.34, 10);
  geometries.push(bladeGeometry, edgeGeometry, guardGeometry, gripGeometry);

  const blade = new THREE.Mesh(bladeGeometry, steel);
  blade.name = "Moonveil_Blade";
  blade.position.y = 0.82;
  blade.rotation.z = -0.045;
  const edge = new THREE.Mesh(edgeGeometry, glow);
  edge.name = "Moonveil_Edge";
  edge.position.set(0.03, 0.82, 0.012);
  edge.rotation.z = -0.045;
  const guard = new THREE.Mesh(guardGeometry, glow);
  guard.position.y = 0.18;
  const grip = new THREE.Mesh(gripGeometry, gripMaterial);
  grip.position.y = 0;
  for (const mesh of [blade, edge, guard, grip]) configureWeaponMesh(mesh);
  root.add(blade, edge, guard, grip);
  root.rotation.set(0, 0.48, 0.02);
  root.position.set(0, -0.02, 0);
  return { root, glowMaterials: [glow] };
}

function buildTwinBlade(
  side: "left" | "right",
  geometries: THREE.BufferGeometry[],
  materials: THREE.Material[],
): ForgedWeapon {
  const root = new THREE.Group();
  root.name = `weapon-loadout.twinblades.${side}`;
  const { steel, glow } = createBladeMaterial(WEAPON_VISUAL_STYLE["twin-blades"]);
  const gripMaterial = new THREE.MeshStandardMaterial({
    color: 0x17101f,
    metalness: 0.28,
    roughness: 0.66,
  });
  materials.push(steel, glow, gripMaterial);

  const bladeGeometry = new THREE.ConeGeometry(0.105, 0.78, 4, 1, false, Math.PI * 0.25);
  const fullerGeometry = new THREE.BoxGeometry(0.022, 0.48, 0.026);
  const guardGeometry = new THREE.TorusGeometry(0.105, 0.018, 6, 12);
  const gripGeometry = new THREE.CylinderGeometry(0.034, 0.038, 0.27, 8);
  geometries.push(bladeGeometry, fullerGeometry, guardGeometry, gripGeometry);

  const blade = new THREE.Mesh(bladeGeometry, steel);
  blade.name = `Nightfang_${side}_Blade`;
  blade.position.y = 0.48;
  const fuller = new THREE.Mesh(fullerGeometry, glow);
  fuller.position.set(side === "left" ? -0.016 : 0.016, 0.44, 0.035);
  const guard = new THREE.Mesh(guardGeometry, glow);
  guard.rotation.x = Math.PI * 0.5;
  guard.position.y = 0.085;
  const grip = new THREE.Mesh(gripGeometry, gripMaterial);
  grip.position.y = -0.08;
  for (const mesh of [blade, fuller, guard, grip]) configureWeaponMesh(mesh);
  root.add(blade, fuller, guard, grip);
  root.rotation.set(side === "left" ? 0.08 : -0.08, side === "left" ? -0.2 : 0.2, Math.PI);
  root.position.set(0, 0.02, 0);
  return { root, glowMaterials: [glow] };
}

/**
 * Swaps a real visible loadout on Nyra's authored hand/socket hierarchy.
 * It deliberately owns only presentation; weapon timing and damage remain
 * deterministic simulation state.
 */
export class WeaponLoadoutView {
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly authoredGreatsword: THREE.Object3D | null;
  private readonly katana: ForgedWeapon | null;
  private readonly twinLeft: ForgedWeapon | null;
  private readonly twinRight: ForgedWeapon | null;
  private activeWeapon: WeaponVisualID | null = null;

  constructor(heroRoot: THREE.Object3D) {
    this.authoredGreatsword = heroRoot.getObjectByName("stormcage-two-hand-socket") ?? null;
    const weaponSocket = heroRoot.getObjectByName("weapon_socket") ?? null;
    const leftHand = heroRoot.getObjectByName("hand_l") ?? null;
    const rightHand = heroRoot.getObjectByName("hand_r") ?? null;

    this.katana = weaponSocket ? buildKatana(this.geometries, this.materials) : null;
    this.twinLeft = leftHand ? buildTwinBlade("left", this.geometries, this.materials) : null;
    this.twinRight = rightHand ? buildTwinBlade("right", this.geometries, this.materials) : null;
    if (weaponSocket && this.katana) weaponSocket.add(this.katana.root);
    if (leftHand && this.twinLeft) leftHand.add(this.twinLeft.root);
    if (rightHand && this.twinRight) rightHand.add(this.twinRight.root);
    this.setVisibility("greatsword");
  }

  update(state: WeaponLoadoutPresentation): void {
    if (state.activeWeapon !== this.activeWeapon) this.setVisibility(state.activeWeapon);
    const specialPulse = state.specialActive01 > 0
      ? 0.65 + Math.sin(state.elapsed * 32) * 0.25
      : 0;
    const readiness = 1 - THREE.MathUtils.clamp(state.specialCooldown01, 0, 1);
    const intensity = 0.75 + readiness * 0.85 + specialPulse * 2.2;
    const visibleGlow = state.activeWeapon === "katana"
      ? this.katana?.glowMaterials ?? []
      : state.activeWeapon === "twin-blades"
        ? [...(this.twinLeft?.glowMaterials ?? []), ...(this.twinRight?.glowMaterials ?? [])]
        : [];
    for (const material of visibleGlow) material.emissiveIntensity = intensity;
  }

  getActiveAnchors(): THREE.Object3D[] {
    if (this.activeWeapon === "katana") return this.katana ? [this.katana.root] : [];
    if (this.activeWeapon === "twin-blades") {
      return [this.twinLeft?.root, this.twinRight?.root].filter(
        (value): value is THREE.Group => value !== null && value !== undefined,
      );
    }
    return this.authoredGreatsword ? [this.authoredGreatsword] : [];
  }

  restoreGpuResources(): void {
    for (const geometry of this.geometries) {
      if (geometry.index) geometry.index.needsUpdate = true;
      for (const attribute of Object.values(geometry.attributes) as THREE.BufferAttribute[]) {
        attribute.needsUpdate = true;
      }
    }
    for (const material of this.materials) material.needsUpdate = true;
  }

  dispose(): void {
    this.katana?.root.removeFromParent();
    this.twinLeft?.root.removeFromParent();
    this.twinRight?.root.removeFromParent();
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
    this.geometries.length = 0;
    this.materials.length = 0;
    if (this.authoredGreatsword) this.authoredGreatsword.visible = true;
  }

  private setVisibility(activeWeapon: WeaponVisualID): void {
    this.activeWeapon = activeWeapon;
    if (this.authoredGreatsword) this.authoredGreatsword.visible = activeWeapon === "greatsword";
    if (this.katana) this.katana.root.visible = activeWeapon === "katana";
    if (this.twinLeft) this.twinLeft.root.visible = activeWeapon === "twin-blades";
    if (this.twinRight) this.twinRight.root.visible = activeWeapon === "twin-blades";
  }
}
