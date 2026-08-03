import * as THREE from "three";

export type WeaponVisualID = "katana" | "greatsword" | "twin-blades";
export type WeaponActionKind = "none" | "normal" | "special";

export interface WeaponLoadoutPresentation {
  activeWeapon: WeaponVisualID;
  specialCooldown01: number;
  specialActive01: number;
  elapsed: number;
  /** Existing simulation action, consumed only as a deterministic pose driver. */
  actionKind?: WeaponActionKind;
  actionProgress01?: number;
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

/** Relative to Nyra's authored hand rig, not world units. */
export const WEAPON_PRESENTATION_SCALE: Readonly<Record<WeaponVisualID, number>> =
  Object.freeze({
    katana: 0.64,
    greatsword: 0.52,
    "twin-blades": 0.62,
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
      color: 0x9aa8b4,
      metalness: 0.88,
      roughness: 0.34,
      envMapIntensity: 1.08,
    }),
    glow: new THREE.MeshStandardMaterial({
      color: new THREE.Color(style.accent).multiplyScalar(0.68),
      emissive: style.glow,
      emissiveIntensity: 0.72,
      metalness: 0.34,
      roughness: 0.38,
      toneMapped: true,
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
  root.rotation.set(0, 0.34, 0.1);
  root.position.set(0, -0.04, 0.02);
  root.scale.setScalar(WEAPON_PRESENTATION_SCALE.katana);
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
  root.position.set(side === "left" ? -0.015 : 0.015, 0.015, 0.02);
  root.scale.setScalar(WEAPON_PRESENTATION_SCALE["twin-blades"]);
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
  private readonly authoredGreatswordScale: THREE.Vector3 | null;
  private readonly authoredGreatswordRotation: THREE.Euler | null;
  private activeWeapon: WeaponVisualID | null = null;

  constructor(heroRoot: THREE.Object3D) {
    this.authoredGreatsword = heroRoot.getObjectByName("stormcage-two-hand-socket") ?? null;
    this.authoredGreatswordScale = this.authoredGreatsword?.scale.clone() ?? null;
    this.authoredGreatswordRotation = this.authoredGreatsword?.rotation.clone() ?? null;
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
    this.applyPresentationPose(state);
    const specialPulse = state.specialActive01 > 0
      ? 0.24 + Math.sin(state.elapsed * 24) * 0.08
      : 0;
    const readiness = 1 - THREE.MathUtils.clamp(state.specialCooldown01, 0, 1);
    const intensity = 0.42 + readiness * 0.46 + specialPulse;
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
    if (this.authoredGreatsword) {
      this.authoredGreatsword.visible = true;
      if (this.authoredGreatswordScale) {
        this.authoredGreatsword.scale.copy(this.authoredGreatswordScale);
      }
      if (this.authoredGreatswordRotation) {
        this.authoredGreatsword.rotation.copy(this.authoredGreatswordRotation);
      }
    }
  }

  private applyPresentationPose(state: WeaponLoadoutPresentation): void {
    const actionKind = state.actionKind ?? "none";
    const progress = THREE.MathUtils.clamp(state.actionProgress01 ?? 0, 0, 1);
    const arc = actionKind === "none" ? 0 : Math.sin(progress * Math.PI);
    const direction = actionKind === "none" ? 0 : Math.sin(progress * Math.PI * 2);

    if (this.katana) {
      this.katana.root.position.set(0, -0.04, 0.02);
      this.katana.root.scale.setScalar(WEAPON_PRESENTATION_SCALE.katana);
      if (actionKind === "special") {
        this.katana.root.rotation.set(
          -0.42 * arc,
          0.34 + 0.55 * direction,
          0.1 + 0.38 * arc,
        );
      } else {
        this.katana.root.rotation.set(
          -0.08 * arc,
          0.34 + 0.24 * direction,
          0.1 + 0.22 * arc,
        );
      }
    }

    if (this.twinLeft && this.twinRight) {
      this.twinLeft.root.position.set(-0.015 - arc * 0.055, 0.015, 0.02);
      this.twinRight.root.position.set(0.015 + arc * 0.055, 0.015, 0.02);
      this.twinLeft.root.scale.setScalar(WEAPON_PRESENTATION_SCALE["twin-blades"]);
      this.twinRight.root.scale.setScalar(WEAPON_PRESENTATION_SCALE["twin-blades"]);
      const specialOpen = actionKind === "special" ? 0.34 : 0.18;
      const specialTilt = actionKind === "special" ? 0.26 : 0.12;
      this.twinLeft.root.rotation.set(
        0.08 + specialTilt * direction,
        -0.2 - specialOpen * arc,
        Math.PI - specialOpen * arc,
      );
      this.twinRight.root.rotation.set(
        -0.08 - specialTilt * direction,
        0.2 + specialOpen * arc,
        Math.PI + specialOpen * arc,
      );
    }

    if (this.authoredGreatsword && this.authoredGreatswordScale) {
      this.authoredGreatsword.scale
        .copy(this.authoredGreatswordScale)
        .multiplyScalar(WEAPON_PRESENTATION_SCALE.greatsword);
      if (this.authoredGreatswordRotation) {
        this.authoredGreatsword.rotation.copy(this.authoredGreatswordRotation);
      }
      if (state.activeWeapon === "greatsword" && actionKind !== "none") {
        if (actionKind === "special") {
          this.authoredGreatsword.rotation.set(
            -0.28 * arc,
            0.54 + 2.15 * arc,
            -0.55 * direction,
          );
        } else {
          this.authoredGreatsword.rotation.set(
            0.08 * arc,
            0.54 + 1.45 * direction,
            -0.65 * arc,
          );
        }
      }
    }
  }

  private setVisibility(activeWeapon: WeaponVisualID): void {
    this.activeWeapon = activeWeapon;
    if (this.authoredGreatsword) this.authoredGreatsword.visible = activeWeapon === "greatsword";
    if (this.katana) this.katana.root.visible = activeWeapon === "katana";
    if (this.twinLeft) this.twinLeft.root.visible = activeWeapon === "twin-blades";
    if (this.twinRight) this.twinRight.root.visible = activeWeapon === "twin-blades";
  }
}
