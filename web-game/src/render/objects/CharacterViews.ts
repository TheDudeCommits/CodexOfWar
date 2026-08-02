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

const ROUND005_VISUAL_LANE_OFFSET = 0.62;
const ROUND005_TOE_IN_YAW = 0.5;
const ROUND005_WEAPON_AXIAL_ROLL = 0.6;

const BLADE_FX_LOCAL_ENVELOPE = Object.freeze({
  minX: -0.31,
  maxX: 0.36,
  minY: 0.2,
  maxY: 1.71,
  maxZ: 0.064,
});

interface RibbonPoint {
  x: number;
  y: number;
  halfWidth: number;
}

interface BladeTrailLayer {
  name: "edge-halo" | "hot-core" | "afterimage" | "energy-slivers";
  material: THREE.MeshBasicMaterial;
  peakOpacity: number;
}

export interface BladeTrailFxSample {
  phase: "absent" | "peak";
  active: boolean;
  intensity: number;
  attack01: number;
}

export interface BladeTrailFxTelemetry extends BladeTrailFxSample {
  schema: "cow.blade-fx.v1";
  attachment: "authored-weapon-local" | "fallback-weapon-local" | "hero-local";
  bladePoseDriven: true;
  bladeAxis: "+Y";
  layers: Array<{
    name: BladeTrailLayer["name"];
    opacity: number;
    additive: true;
    depthWrite: false;
  }>;
  localEnvelope: typeof BLADE_FX_LOCAL_ENVELOPE;
  textures: 0;
}

export interface BladeTrailFxAuditApi {
  telemetry: () => BladeTrailFxTelemetry;
  setAuditVisible: (visible: boolean) => void;
}

declare global {
  interface Window {
    __COW_BLADE_FX__?: BladeTrailFxAuditApi;
  }
}

function roundFx(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function sampleBladeTrailFx(
  attackPhase: PlayerState["attackPhase"],
  attackElapsed: number,
): BladeTrailFxSample {
  const attack01 = attackElapsed > 0
    ? clamp(attackElapsed / ATTACK_DURATION, 0, 1)
    : 0;
  if (attackPhase !== "active") {
    return { phase: "absent", active: false, intensity: 0, attack01: roundFx(attack01) };
  }

  // The authored active window is only four fixed ticks. Keep the blade-bound
  // stack fully legible through that window, with its crest at the tick-34
  // contact pose, instead of expanding a screen-space sweep fan.
  const contactCrest = 1 - Math.min(1, Math.abs(attack01 - 0.42) / 0.16);
  return {
    phase: "peak",
    active: true,
    intensity: roundFx(0.78 + contactCrest * 0.22),
    attack01: roundFx(attack01),
  };
}

function createRibbonGeometry(
  paths: readonly (readonly RibbonPoint[])[],
  z: number,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  let vertexOffset = 0;

  for (const path of paths) {
    for (const point of path) {
      positions.push(point.x - point.halfWidth, point.y, z);
      positions.push(point.x + point.halfWidth, point.y, z);
    }
    for (let index = 0; index < path.length - 1; index += 1) {
      const base = vertexOffset + index * 2;
      indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    }
    vertexOffset += path.length * 2;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

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
  private readonly weaponTrail = new THREE.Group();
  private readonly trailLayers: BladeTrailLayer[] = [];
  private readonly bladeFxAuditApi: BladeTrailFxAuditApi = {
    telemetry: () => this.getFxTelemetry(),
    setAuditVisible: (visible) => {
      this.trailAuditVisible = visible;
      this.applyTrailVisuals();
    },
  };
  private trailAttachment: BladeTrailFxTelemetry["attachment"] = "hero-local";
  private trailSample = sampleBladeTrailFx("idle", 0);
  private trailAuditVisible = true;
  private animator: DeterministicAnimator | null = null;
  private fallbackWeapon: THREE.Group | null = null;

  constructor(assets: AssetRegistry) {
    const hero = assets.instantiateWithAnimations("character.hero");
    const weapon = assets.instantiateWithAnimations("weapon.claymore");
    const legacyClips = [
      ...assets.getAnimations("animation.player-core"),
      ...assets.getAnimations("animation.combat"),
    ];
    const clips = hero && hero.animations.length > 0 ? hero.animations : legacyClips;
    const available = new Set(clips.map((clip) => clip.name));
    const weaponSocket =
      hero?.scene.getObjectByName("weapon_socket") ??
      hero?.scene.getObjectByName("hand_r") ??
      null;
    const missingClips = HERO_REQUIRED_CLIPS.filter((name) => !available.has(name));
    const missing: string[] = [];
    if (!hero) missing.push("character.hero");
    if (!weapon) missing.push("weapon.claymore");
    if (!weaponSocket) missing.push("character.hero:weapon_socket");
    if (missingClips.length > 0) missing.push(`clips:${missingClips.join("|")}`);
    this.usingFallback = missing.length > 0;
    this.fallbackReason = missing.length > 0 ? `missing ${missing.join(", ")}` : null;
    this.animationNames = clips.map((clip) => clip.name).sort();

    const blob = shadowBlob(0.65, 0.34);
    this.ownedGeometries.push(blob.geometry);
    this.ownedMaterials.push(blob.material);
    this.root.add(blob.mesh, this.visual);

    if (this.usingFallback) this.buildProceduralFallback();
    else if (hero && weapon && weaponSocket) {
      this.root.name = "character.hero.nyra.round005";
      hero.scene.name = "nyra-visible-model";
      hero.scene.scale.setScalar(1.22);
      hero.scene.rotation.y = Math.PI - ROUND005_TOE_IN_YAW;
      hero.scene.position.x = -ROUND005_VISUAL_LANE_OFFSET;
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
      weapon.scene.name = "stormcage-two-hand-socket";
      weapon.scene.position.set(0, 0, 0);
      // Roll around the authored +Y blade axis so the broad face remains
      // readable from the frozen gameplay camera without moving either grip
      // marker or the contact line.
      weapon.scene.rotation.set(0, ROUND005_WEAPON_AXIAL_ROLL, 0);
      weapon.scene.scale.setScalar(1);
      weaponSocket.add(weapon.scene);
      this.visual.add(hero.scene);
      this.animator = new DeterministicAnimator(hero.scene, clips);
    }

    this.weaponTrail.name = "fx.weapon-trail";
    this.weaponTrail.visible = false;

    const addLayer = (
      name: BladeTrailLayer["name"],
      geometry: THREE.BufferGeometry,
      color: number,
      peakOpacity: number,
      renderOrder: number,
    ): void => {
      const material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthTest: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      material.forceSinglePass = true;
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = `fx.weapon-trail.${name}`;
      mesh.renderOrder = renderOrder;
      mesh.frustumCulled = true;
      this.ownedGeometries.push(geometry);
      this.ownedMaterials.push(material);
      this.trailLayers.push({ name, material, peakOpacity });
      this.weaponTrail.add(mesh);
    };

    addLayer(
      "edge-halo",
      createRibbonGeometry([[
        { x: 0.16, y: 0.2, halfWidth: 0.008 },
        { x: 0.19, y: 0.44, halfWidth: 0.036 },
        { x: 0.205, y: 0.78, halfWidth: 0.052 },
        { x: 0.2, y: 1.12, halfWidth: 0.046 },
        { x: 0.175, y: 1.47, halfWidth: 0.028 },
        { x: 0.055, y: 1.71, halfWidth: 0.003 },
      ]], 0.058),
      0x27c9ff,
      0.3,
      22,
    );
    addLayer(
      "afterimage",
      createRibbonGeometry([[
        { x: -0.17, y: 0.61, halfWidth: 0.004 },
        { x: -0.225, y: 0.84, halfWidth: 0.02 },
        { x: -0.27, y: 1.08, halfWidth: 0.035 },
        { x: -0.245, y: 1.34, halfWidth: 0.029 },
        { x: -0.16, y: 1.57, halfWidth: 0.014 },
        { x: -0.045, y: 1.7, halfWidth: 0.002 },
      ]], 0.055),
      0x1688bc,
      0.2,
      23,
    );
    addLayer(
      "hot-core",
      createRibbonGeometry([[
        { x: 0.158, y: 0.25, halfWidth: 0.003 },
        { x: 0.174, y: 0.51, halfWidth: 0.008 },
        { x: 0.181, y: 0.84, halfWidth: 0.01 },
        { x: 0.176, y: 1.18, halfWidth: 0.009 },
        { x: 0.15, y: 1.49, halfWidth: 0.006 },
        { x: 0.045, y: 1.705, halfWidth: 0.001 },
      ]], 0.064),
      0xd8ffff,
      0.94,
      24,
    );
    addLayer(
      "energy-slivers",
      createRibbonGeometry([
        [
          { x: 0.245, y: 0.57, halfWidth: 0.001 },
          { x: 0.302, y: 0.67, halfWidth: 0.012 },
          { x: 0.326, y: 0.8, halfWidth: 0.009 },
          { x: 0.287, y: 0.92, halfWidth: 0.001 },
        ],
        [
          { x: 0.238, y: 0.98, halfWidth: 0.001 },
          { x: 0.306, y: 1.09, halfWidth: 0.013 },
          { x: 0.347, y: 1.22, halfWidth: 0.009 },
          { x: 0.298, y: 1.34, halfWidth: 0.001 },
        ],
        [
          { x: 0.22, y: 1.36, halfWidth: 0.001 },
          { x: 0.286, y: 1.46, halfWidth: 0.011 },
          { x: 0.304, y: 1.55, halfWidth: 0.008 },
          { x: 0.253, y: 1.62, halfWidth: 0.001 },
        ],
      ], 0.061),
      0x79efff,
      0.68,
      25,
    );

    const authoredWeapon = this.root.getObjectByName("stormcage-two-hand-socket");
    const weaponFxParent = authoredWeapon ?? this.fallbackWeapon ?? this.root;
    this.trailAttachment = authoredWeapon
      ? "authored-weapon-local"
      : this.fallbackWeapon
        ? "fallback-weapon-local"
        : "hero-local";
    weaponFxParent.add(this.weaponTrail);
    if (typeof window !== "undefined") window.__COW_BLADE_FX__ = this.bladeFxAuditApi;
  }

  update(state: PlayerState, elapsed: number): void {
    this.root.position.set(state.position.x, 0, state.position.z);
    this.root.rotation.y = -state.yaw;

    if (this.animator) this.updateAuthoredAnimation(state, elapsed);
    else this.updateFallbackAnimation(state, elapsed);

    this.trailSample = sampleBladeTrailFx(state.attackPhase, state.attackElapsed);
    this.applyTrailVisuals();
  }

  getFxTelemetry(): BladeTrailFxTelemetry {
    return {
      schema: "cow.blade-fx.v1",
      ...this.trailSample,
      attachment: this.trailAttachment,
      bladePoseDriven: true,
      bladeAxis: "+Y",
      layers: this.trailLayers.map((layer) => ({
        name: layer.name,
        opacity: roundFx(layer.material.opacity),
        additive: true,
        depthWrite: false,
      })),
      localEnvelope: BLADE_FX_LOCAL_ENVELOPE,
      textures: 0,
    };
  }

  dispose(): void {
    if (
      typeof window !== "undefined" &&
      window.__COW_BLADE_FX__ === this.bladeFxAuditApi
    ) {
      window.__COW_BLADE_FX__ = undefined;
    }
    this.animator?.dispose();
    for (const geometry of this.ownedGeometries) geometry.dispose();
    for (const material of this.ownedMaterials) material.dispose();
    this.ownedGeometries.length = 0;
    this.ownedMaterials.length = 0;
  }

  private applyTrailVisuals(): void {
    const visible = this.trailSample.active && this.trailAuditVisible;
    this.weaponTrail.visible = visible;
    this.weaponTrail.scale.x = 0.92 + this.trailSample.intensity * 0.08;
    for (const layer of this.trailLayers) {
      layer.material.opacity = visible
        ? roundFx(layer.peakOpacity * this.trailSample.intensity)
        : 0;
    }
  }

  private updateAuthoredAnimation(state: PlayerState, elapsed: number): void {
    const animator = this.animator!;
    if (state.motion === "attack") {
      // The Round005 attack key times were authored directly against the
      // deterministic simulation clock (24 fps). Preserve that clock so the
      // frame-4 contact pose lands on runtime tick 34 instead of compressing
      // the 0.4167 s clip across the 0.4333 s attack state.
      animator.setTime("Sword_Regular_A", state.attackElapsed, false);
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
      this.root.name = "character.hollow.round005";
      zombie.scene.name = "hollow-visible-model";
      zombie.scene.scale.setScalar(1.16);
      zombie.scene.rotation.y = Math.PI - ROUND005_TOE_IN_YAW;
      // The frozen simulation centers stay untouched; a small visual-only
      // offset keeps the opposed silhouettes readable at combat distance.
      // The enemy root faces the opposite direction, so the matching local-X
      // sign produces the opposing world-space side of the combat lane.
      zombie.scene.position.x = -ROUND005_VISUAL_LANE_OFFSET;
      configureAndCloneMaterials(zombie.scene, this.ownedMaterials, (material) => {
        if (material instanceof THREE.MeshStandardMaterial) {
          material.envMapIntensity = 1.15;
          material.roughness = Math.min(0.86, material.roughness);
          if (
            material.name.includes("WetWounds") ||
            material.name.includes("HotEye") ||
            material.name.includes("GravefireRot")
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
