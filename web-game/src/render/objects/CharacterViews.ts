import * as THREE from "three";
import {
  ATTACK_DURATION,
  PLAYER_DODGE_DURATION,
} from "../../game/simulation/constants";
import { clamp } from "../../game/simulation/math";
import type { EnemyState, PlayerState } from "../../game/simulation/types";
import type { AssetRegistry } from "../loaders/AssetRegistry";

const HERO_REQUIRED_CLIPS = [
  "Idle_Loop",
  "Walk_Loop",
  "Sprint_Loop",
  "Roll",
  "Sword_Regular_A",
] as const;

function shadowBlob(radius: number, opacity: number): {
  mesh: THREE.Mesh;
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
} {
  const geometry = new THREE.CircleGeometry(radius, 32);
  const material = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.014;
  return { mesh, geometry, material };
}

function configureAndCloneMaterials(
  root: THREE.Object3D,
  owned: THREE.Material[],
  configure: (material: THREE.Material) => void,
): void {
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    const original = Array.isArray(node.material) ? node.material : [node.material];
    const cloned = original.map((material) => {
      const next = material.clone();
      configure(next);
      owned.push(next);
      return next;
    });
    node.material = Array.isArray(node.material) ? cloned : cloned[0]!;
    node.castShadow = true;
    node.receiveShadow = true;
  });
}

class DeterministicAnimator {
  private readonly mixer: THREE.AnimationMixer;
  private readonly actions = new Map<string, THREE.AnimationAction>();
  private activeName = "";

  constructor(
    private readonly root: THREE.Object3D,
    clips: readonly THREE.AnimationClip[],
  ) {
    this.mixer = new THREE.AnimationMixer(root);
    for (const clip of clips) this.actions.set(clip.name, this.mixer.clipAction(clip));
  }

  has(name: string): boolean {
    return this.actions.has(name);
  }

  setTime(name: string, seconds: number, loop: boolean): void {
    const action = this.actions.get(name);
    if (!action) return;
    if (this.activeName !== name) {
      const previous = this.actions.get(this.activeName);
      previous?.stop();
      action.reset();
      action.enabled = true;
      action.setEffectiveWeight(1);
      action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
      action.clampWhenFinished = !loop;
      action.play();
      this.activeName = name;
    }
    const duration = action.getClip().duration;
    action.time = loop
      ? ((seconds % duration) + duration) % duration
      : clamp(seconds, 0, Math.max(0, duration - 0.0001));
    this.mixer.update(0);
  }

  getDuration(name: string): number {
    return this.actions.get(name)?.getClip().duration ?? 0;
  }

  dispose(): void {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.root);
  }
}

export class HeroView {
  readonly root = new THREE.Group();
  readonly usingFallback: boolean;
  readonly fallbackReason: string | null;
  readonly animationNames: string[];
  private readonly ownedGeometries: THREE.BufferGeometry[] = [];
  private readonly ownedMaterials: THREE.Material[] = [];
  private readonly visual = new THREE.Group();
  private readonly weaponTrail: THREE.Mesh;
  private readonly trailMaterial: THREE.MeshBasicMaterial;
  private animator: DeterministicAnimator | null = null;
  private fallbackWeapon: THREE.Group | null = null;

  constructor(assets: AssetRegistry) {
    const hero = assets.instantiateWithAnimations("character.hero");
    const weapon = assets.instantiateWithAnimations("weapon.claymore");
    const clips = [
      ...assets.getAnimations("animation.player-core"),
      ...assets.getAnimations("animation.combat"),
    ];
    const available = new Set(clips.map((clip) => clip.name));
    const rightHand = hero?.scene.getObjectByName("hand_r") ?? null;
    const missingClips = HERO_REQUIRED_CLIPS.filter((name) => !available.has(name));
    const missing: string[] = [];
    if (!hero) missing.push("character.hero");
    if (!weapon) missing.push("weapon.claymore");
    if (!rightHand) missing.push("character.hero:hand_r");
    if (missingClips.length > 0) missing.push(`clips:${missingClips.join("|")}`);
    this.usingFallback = missing.length > 0;
    this.fallbackReason = missing.length > 0 ? `missing ${missing.join(", ")}` : null;
    this.animationNames = clips.map((clip) => clip.name).sort();

    const blob = shadowBlob(0.65, 0.34);
    this.ownedGeometries.push(blob.geometry);
    this.ownedMaterials.push(blob.material);
    this.root.add(blob.mesh, this.visual);

    if (this.usingFallback) this.buildProceduralFallback();
    else if (hero && weapon && rightHand) {
      this.root.name = "character.hero.nyra.round004";
      hero.scene.name = "nyra-visible-model";
      hero.scene.scale.setScalar(1.36);
      hero.scene.rotation.y = Math.PI;
      configureAndCloneMaterials(hero.scene, this.ownedMaterials, (material) => {
        if (material instanceof THREE.MeshStandardMaterial) {
          material.envMapIntensity = 1.25;
          material.roughness = Math.min(0.78, material.roughness);
        }
      });
      configureAndCloneMaterials(weapon.scene, this.ownedMaterials, (material) => {
        if (material instanceof THREE.MeshStandardMaterial) {
          material.opacity = 1;
          material.alphaTest = 0;
          material.transparent = false;
          material.envMapIntensity = 1.38;
          if (material.name.includes("Aether")) {
            material.metalness = Math.min(0.08, material.metalness);
            material.roughness = Math.min(0.32, material.roughness);
          } else {
            material.metalness = Math.max(0.48, material.metalness);
            material.roughness = Math.min(0.46, material.roughness);
          }
        }
      });
      weapon.scene.name = "stormcage-right-hand";
      weapon.scene.position.set(0.004, -0.209, 0.018);
      // Stormcage preserves the prior +Y blade convention but is centered on its
      // two-hand grip, so the local offset seats the upper grip in Nyra's palm.
      weapon.scene.rotation.set(-Math.PI / 2, 0.05, Math.PI);
      weapon.scene.scale.setScalar(0.87);
      rightHand.add(weapon.scene);
      this.visual.add(hero.scene);
      this.animator = new DeterministicAnimator(hero.scene, clips);
    }

    this.trailMaterial = new THREE.MeshBasicMaterial({
      color: 0x3191a8,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    this.ownedMaterials.push(this.trailMaterial);
    const trailGeometry = new THREE.RingGeometry(0.96, 1.52, 40, 1, -0.65, 2.05);
    this.ownedGeometries.push(trailGeometry);
    this.weaponTrail = new THREE.Mesh(trailGeometry, this.trailMaterial);
    this.weaponTrail.name = "fx.weapon-trail";
    this.weaponTrail.position.set(0.05, 1.22, -0.1);
    this.weaponTrail.rotation.set(0, 0, -0.62);
    this.weaponTrail.visible = false;
    this.root.add(this.weaponTrail);
  }

  update(state: PlayerState, elapsed: number): void {
    this.root.position.set(state.position.x, 0, state.position.z);
    this.root.rotation.y = -state.yaw;

    if (this.animator) this.updateAuthoredAnimation(state, elapsed);
    else this.updateFallbackAnimation(state, elapsed);

    const attack01 = state.attackElapsed > 0
      ? clamp(state.attackElapsed / ATTACK_DURATION, 0, 1)
      : 0;
    const trailActive = state.attackPhase === "active";
    this.weaponTrail.visible = trailActive;
    this.weaponTrail.rotation.z = -0.72 + attack01 * 1.28;
    this.weaponTrail.scale.setScalar(0.82 + Math.sin(attack01 * Math.PI) * 0.22);
    this.trailMaterial.opacity = trailActive
      ? 0.055 + Math.sin(clamp((attack01 - 0.26) * 4.6, 0, 1) * Math.PI) * 0.145
      : 0;
  }

  dispose(): void {
    this.animator?.dispose();
    for (const geometry of this.ownedGeometries) geometry.dispose();
    for (const material of this.ownedMaterials) material.dispose();
    this.ownedGeometries.length = 0;
    this.ownedMaterials.length = 0;
  }

  private updateAuthoredAnimation(state: PlayerState, elapsed: number): void {
    const animator = this.animator!;
    if (state.motion === "attack") {
      const duration = animator.getDuration("Sword_Regular_A");
      const attack01 = clamp(state.attackElapsed / ATTACK_DURATION, 0, 1);
      animator.setTime("Sword_Regular_A", attack01 * duration, false);
      return;
    }
    if (state.motion === "dodge") {
      const duration = animator.getDuration("Roll");
      const dodge01 = clamp(1 - state.dodgeRemaining / PLAYER_DODGE_DURATION, 0, 1);
      animator.setTime("Roll", dodge01 * duration, false);
      return;
    }
    if (state.motion === "sprint") {
      animator.setTime("Sprint_Loop", elapsed * 1.14, true);
      return;
    }
    if (state.motion === "move") {
      animator.setTime("Walk_Loop", elapsed * 1.05, true);
      return;
    }
    animator.setTime("Idle_Loop", elapsed, true);
  }

  private buildProceduralFallback(): void {
    this.root.name = "character.hero.procedural-fallback";
    const armor = new THREE.MeshStandardMaterial({
      color: 0x26313b,
      roughness: 0.42,
      metalness: 0.68,
    });
    const cloth = new THREE.MeshStandardMaterial({ color: 0x632c28, roughness: 0.9 });
    this.ownedMaterials.push(armor, cloth);
    const bodyGeometry = new THREE.CapsuleGeometry(0.38, 0.72, 6, 10);
    const headGeometry = new THREE.SphereGeometry(0.27, 12, 10);
    this.ownedGeometries.push(bodyGeometry, headGeometry);
    const body = new THREE.Mesh(bodyGeometry, armor);
    body.position.y = 1.12;
    const head = new THREE.Mesh(headGeometry, cloth);
    head.position.y = 1.87;
    body.castShadow = true;
    head.castShadow = true;
    this.visual.add(body, head);

    const weapon = new THREE.Group();
    const bladeGeometry = new THREE.BoxGeometry(0.12, 1.55, 0.045);
    const gripGeometry = new THREE.CylinderGeometry(0.045, 0.05, 0.42, 8);
    this.ownedGeometries.push(bladeGeometry, gripGeometry);
    const blade = new THREE.Mesh(bladeGeometry, armor);
    blade.position.y = 0.96;
    const grip = new THREE.Mesh(gripGeometry, cloth);
    grip.position.y = 0.04;
    weapon.add(blade, grip);
    weapon.position.set(0.48, 1.1, 0);
    weapon.rotation.z = -0.62;
    this.fallbackWeapon = weapon;
    this.visual.add(weapon);
  }

  private updateFallbackAnimation(state: PlayerState, elapsed: number): void {
    const moving = state.motion === "move" || state.motion === "sprint";
    this.visual.position.y = moving ? Math.abs(Math.sin(elapsed * 10)) * 0.04 : 0;
    if (!this.fallbackWeapon) return;
    if (state.attackElapsed > 0) {
      const attack01 = clamp(state.attackElapsed / ATTACK_DURATION, 0, 1);
      this.fallbackWeapon.rotation.y = -1.1 + attack01 * 2.5;
    } else this.fallbackWeapon.rotation.y = 0;
  }
}

interface FlashMaterial {
  material: THREE.MeshStandardMaterial;
  emissive: THREE.Color;
  intensity: number;
}

export class ZombieView {
  readonly root = new THREE.Group();
  readonly usingFallback: boolean;
  readonly fallbackReason: string | null;
  readonly animationNames: string[];
  private readonly ownedGeometries: THREE.BufferGeometry[] = [];
  private readonly ownedMaterials: THREE.Material[] = [];
  private readonly visual = new THREE.Group();
  private readonly flashMaterials: FlashMaterial[] = [];
  private animator: DeterministicAnimator | null = null;
  private deathStartedAt: number | null = null;

  constructor(assets: AssetRegistry) {
    const zombie = assets.instantiateWithAnimations("character.hollow");
    const required = ["Idle", "HitReact", "Death"];
    const available = new Set(zombie?.animations.map((clip) => clip.name) ?? []);
    const missingClips = required.filter((name) => !available.has(name));
    const missing: string[] = [];
    if (!zombie) missing.push("character.hollow");
    if (missingClips.length > 0) missing.push(`clips:${missingClips.join("|")}`);
    this.usingFallback = missing.length > 0;
    this.fallbackReason = missing.length > 0 ? `missing ${missing.join(", ")}` : null;
    this.animationNames = zombie?.animations.map((clip) => clip.name).sort() ?? [];

    const blob = shadowBlob(0.76, 0.38);
    this.ownedGeometries.push(blob.geometry);
    this.ownedMaterials.push(blob.material);
    this.root.add(blob.mesh, this.visual);

    if (this.usingFallback) this.buildProceduralFallback();
    else if (zombie) {
      this.root.name = "character.hollow.round004";
      zombie.scene.name = "hollow-visible-model";
      zombie.scene.scale.setScalar(1.74);
      zombie.scene.rotation.y = Math.PI;
      configureAndCloneMaterials(zombie.scene, this.ownedMaterials, (material) => {
        if (material instanceof THREE.MeshStandardMaterial) {
          material.envMapIntensity = 1.15;
          material.roughness = Math.min(0.86, material.roughness);
          if (
            material.name.includes("WetWounds") ||
            material.name.includes("HotEye")
          ) {
            this.flashMaterials.push({
              material,
              emissive: material.emissive.clone(),
              intensity: material.emissiveIntensity,
            });
          }
        }
      });
      this.visual.add(zombie.scene);
      this.animator = new DeterministicAnimator(zombie.scene, zombie.animations);
    }
  }

  update(state: EnemyState, elapsed: number): void {
    this.root.position.set(state.position.x, 0, state.position.z);
    this.root.rotation.y = -state.yaw;

    if (state.motion === "dead") {
      if (this.deathStartedAt === null) this.deathStartedAt = elapsed;
      const deathElapsed = elapsed - this.deathStartedAt;
      if (this.animator) this.animator.setTime("Death", deathElapsed, false);
      else this.visual.rotation.z += (-1.42 - this.visual.rotation.z) * 0.08;
      this.applyHitFlash(0.08);
      return;
    }
    this.deathStartedAt = null;

    if (state.motion === "hit") {
      const hit01 = clamp(state.hitStunRemaining / 0.28, 0, 1);
      if (this.animator) {
        const duration = this.animator.getDuration("HitReact");
        this.animator.setTime("HitReact", (1 - hit01) * duration, false);
      } else {
        this.visual.rotation.z = Math.sin(hit01 * Math.PI) * 0.22;
        this.visual.position.z = hit01 * 0.2;
      }
      this.applyHitFlash(hit01);
      return;
    }

    this.visual.rotation.z *= 0.78;
    this.visual.position.z *= 0.75;
    this.applyHitFlash(0);
    if (this.animator) this.animator.setTime("Idle", elapsed, true);
    else this.visual.position.y = Math.sin(elapsed * 2.4 + state.idlePhase * 0.15) * 0.024;
  }

  dispose(): void {
    this.animator?.dispose();
    for (const geometry of this.ownedGeometries) geometry.dispose();
    for (const material of this.ownedMaterials) material.dispose();
    this.ownedGeometries.length = 0;
    this.ownedMaterials.length = 0;
  }

  private applyHitFlash(amount: number): void {
    for (const entry of this.flashMaterials) {
      if (amount > 0) {
        entry.material.emissive.setRGB(0.5, 0.03, 0.006);
        entry.material.emissiveIntensity = entry.intensity + amount * 0.58;
      } else {
        entry.material.emissive.copy(entry.emissive);
        entry.material.emissiveIntensity = entry.intensity;
      }
    }
  }

  private buildProceduralFallback(): void {
    this.root.name = "character.hollow.procedural-fallback";
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x53614a,
      roughness: 0.9,
      metalness: 0.02,
    });
    const eyeMaterial = new THREE.MeshStandardMaterial({
      color: 0xff6f3f,
      emissive: 0xd5331e,
      emissiveIntensity: 2.5,
      roughness: 0.3,
    });
    this.ownedMaterials.push(bodyMaterial, eyeMaterial);
    const bodyGeometry = new THREE.CapsuleGeometry(0.46, 0.82, 6, 10);
    const headGeometry = new THREE.IcosahedronGeometry(0.34, 1);
    this.ownedGeometries.push(bodyGeometry, headGeometry);
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 1.08;
    const head = new THREE.Mesh(headGeometry, eyeMaterial);
    head.position.set(0, 1.92, -0.02);
    body.castShadow = true;
    head.castShadow = true;
    this.visual.add(body, head);
  }
}
