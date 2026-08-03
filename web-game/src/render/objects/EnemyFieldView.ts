import * as THREE from "three";
import type { EnemyState } from "../../game/simulation/types";
import type { AssetRegistry } from "../loaders/AssetRegistry";
import {
  ZombieView,
  type EnemyAuthoredAttackPhase,
  type EnemyAuthoredAttackPresentation,
} from "./CharacterViews";

export type EnemyArchetype = "shambler" | "stalker" | "brute";
export type EnemyFieldPhase = "spawning" | "active" | "dying";
export type EnemyFieldMotion = "idle" | "move" | "attack" | "hit" | "dead";

export interface EnemyFieldPosition {
  readonly x: number;
  readonly z: number;
}

/**
 * Renderer-facing enemy data. The simulation remains the source of truth; this
 * deliberately contains no Three.js objects or renderer-owned timers.
 */
export interface EnemyFieldEntityState {
  readonly id: string;
  readonly archetype: EnemyArchetype;
  readonly position: EnemyFieldPosition;
  readonly yaw: number;
  readonly health: number;
  readonly maxHealth: number;
  readonly phase: EnemyFieldPhase;
  readonly motion: EnemyFieldMotion;
  readonly telegraph01: number;
  readonly alive: boolean;
  readonly hitPulse01: number;
  readonly attackPhase: EnemyAuthoredAttackPhase;
  readonly attackProgress01: number;
  readonly contactProgress01: number;
}

export interface EnemyArchetypeStyle {
  readonly bodyScale: readonly [number, number, number];
  readonly bodyTint: number;
  readonly accent: number;
  readonly telegraph: number;
  readonly postureLean: number;
  readonly tempo: number;
  readonly lockHeight: number;
  readonly telegraphRadius: number;
  readonly accessory: "none" | "vanes" | "elite-armor";
}

export const ENEMY_ARCHETYPE_STYLES: Readonly<
  Record<EnemyArchetype, EnemyArchetypeStyle>
> = Object.freeze({
  shambler: Object.freeze({
    bodyScale: [1, 1, 1] as const,
    bodyTint: 0x8ea081,
    accent: 0xb4c46d,
    telegraph: 0xe5a14b,
    postureLean: 0.075,
    tempo: 0.78,
    lockHeight: 1.54,
    telegraphRadius: 1.22,
    accessory: "none" as const,
  }),
  stalker: Object.freeze({
    bodyScale: [0.82, 1.08, 0.82] as const,
    bodyTint: 0x7a91a2,
    accent: 0x5fe0dc,
    telegraph: 0x59d7d1,
    postureLean: -0.12,
    tempo: 1.48,
    lockHeight: 1.66,
    telegraphRadius: 1.48,
    accessory: "vanes" as const,
  }),
  brute: Object.freeze({
    bodyScale: [1.31, 1.24, 1.31] as const,
    bodyTint: 0xa37b69,
    accent: 0xff6847,
    telegraph: 0xff6745,
    postureLean: 0.035,
    tempo: 0.58,
    lockHeight: 1.95,
    telegraphRadius: 1.82,
    accessory: "elite-armor" as const,
  }),
});

export interface EnemyAvatarView {
  readonly root: THREE.Group;
  update(
    state: EnemyState,
    elapsed: number,
    attack?: EnemyAuthoredAttackPresentation,
  ): void;
  dispose(): void;
}

export interface EnemyFieldViewOptions {
  /** Detached instances retained after their exit transition. */
  readonly maxPoolSize?: number;
  /** Test seam and future avatar-LOD seam; production defaults to ZombieView. */
  readonly createZombieView?: (assets: AssetRegistry) => EnemyAvatarView;
}

export interface EnemyFieldSnapshot {
  readonly schema: "gauntlet.enemy-field.v1";
  readonly activeIds: readonly string[];
  readonly retiringIds: readonly string[];
  readonly pooled: number;
  readonly createdSlots: number;
  readonly disposedSlots: number;
  readonly totalSlots: number;
}

export interface EnemyFieldInstanceSnapshot {
  readonly id: string;
  readonly archetype: EnemyArchetype;
  readonly targetable: boolean;
  readonly telegraphVisible: boolean;
  readonly telegraphOpacity: number;
  readonly telegraphForm: string;
  readonly presentationOpacity: number;
  readonly rootUuid: string;
}

interface MaterialBaseline {
  readonly material: THREE.Material;
  readonly opacity: number;
  readonly color: THREE.Color | null;
  readonly emissive: THREE.Color | null;
  readonly emissiveIntensity: number | null;
  readonly styleable: boolean;
}

interface SharedGeometry {
  readonly shamblerTelegraph: THREE.BufferGeometry;
  readonly stalkerTelegraph: THREE.BufferGeometry;
  readonly bruteTelegraph: THREE.BufferGeometry;
  readonly transitionRing: THREE.RingGeometry;
  readonly shoulderGuard: THREE.BufferGeometry;
  readonly stalkerVane: THREE.BufferGeometry;
  readonly eliteHalo: THREE.TorusGeometry;
}

interface EnemySlot {
  id: string | null;
  archetype: EnemyArchetype;
  readonly root: THREE.Group;
  readonly body: THREE.Group;
  readonly avatar: EnemyAvatarView;
  readonly avatarMaterials: MaterialBaseline[];
  readonly accessoryMaterial: THREE.MeshStandardMaterial;
  readonly telegraphMaterial: THREE.MeshBasicMaterial;
  readonly transitionMaterial: THREE.MeshBasicMaterial;
  readonly telegraph: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  readonly telegraphDetail: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  readonly transitionRing: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  readonly shoulderLeft: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  readonly shoulderRight: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  readonly stalkerVaneLeft: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  readonly stalkerVaneRight: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  readonly eliteHalo: THREE.Mesh<THREE.TorusGeometry, THREE.MeshStandardMaterial>;
  readonly lockAnchor: THREE.Object3D;
  readonly tint: THREE.Color;
  readonly accent: THREE.Color;
  bornAt: number;
  deathStartedAt: number | null;
  retireStartedAt: number | null;
  phaseOffset: number;
  lastState: EnemyFieldEntityState | null;
  targetable: boolean;
  presentationOpacity: number;
  disposed: boolean;
}

const SPAWN_SECONDS = 0.34;
const DEATH_SECONDS = 0.62;
const RETIRE_SECONDS = 0.48;
const GROUND_Y = 0.032;

export interface EnemyAttackPoseSample {
  readonly phase: EnemyAuthoredAttackPhase;
  readonly contactWeight: number;
  readonly bodyPosition: readonly [number, number, number];
  readonly bodyRotation: readonly [number, number, number];
  readonly bodyScale: readonly [number, number, number];
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function smootherStep(value: number): number {
  const t = clamp01(value);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function contactEnvelope(progress: number, contact: number): number {
  const width = 0.22;
  return 1 - clamp01(Math.abs(progress - contact) / width);
}

/** Distinct full-avatar silhouettes layered over the compatible native clip. */
export function sampleEnemyAttackPose(
  archetype: EnemyArchetype,
  phase: EnemyAuthoredAttackPhase,
  progress01: number,
  contactProgress01: number,
): EnemyAttackPoseSample {
  const progress = clamp01(progress01);
  const contact = clamp01(contactProgress01);
  const anticipation = phase === "anticipation" ? smootherStep(progress) : 0;
  const committed = phase === "committed" ? contactEnvelope(progress, contact) : 0;
  const recovery = phase === "recovery" ? 1 - smootherStep(progress) : 0;
  const force = Math.max(committed, recovery * 0.7);

  if (archetype === "stalker") {
    return {
      phase,
      contactWeight: committed,
      bodyPosition: [0, -0.28 * anticipation + 0.2 * committed, -0.92 * force],
      bodyRotation: [-0.5 * anticipation + 0.82 * force, 0, 0.08 * force],
      bodyScale: [1 + 0.08 * committed, 1 - 0.18 * anticipation + 0.08 * committed, 1.08],
    };
  }
  if (archetype === "brute") {
    return {
      phase,
      contactWeight: committed,
      bodyPosition: [0, 0.12 * anticipation - 0.2 * committed, -0.34 * force],
      bodyRotation: [0.24 * anticipation - 0.74 * force, 0, -0.04 * force],
      bodyScale: [1 + 0.06 * anticipation, 1 + 0.08 * anticipation - 0.12 * committed, 1.05],
    };
  }
  return {
    phase,
    contactWeight: committed,
    bodyPosition: [0, -0.1 * anticipation, -0.48 * force],
    bodyRotation: [0.28 * anticipation - 0.5 * force, 0, 0.11 * force],
    bodyScale: [1, 1 - 0.08 * anticipation, 1 + 0.04 * committed],
  };
}

function stablePhase(id: string): number {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) / 0xffffffff) * Math.PI * 2;
}

function finite(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function cloneState(state: EnemyFieldEntityState): EnemyFieldEntityState {
  return {
    ...state,
    position: { x: state.position.x, z: state.position.z },
  };
}

function createSharedGeometry(): SharedGeometry {
  const shamblerTelegraph = new THREE.RingGeometry(
    0.8,
    1,
    40,
    1,
    0.34,
    Math.PI * 0.68,
  );
  shamblerTelegraph.name = "telegraph.shambler-bite-arc";
  const stalkerShape = new THREE.Shape();
  stalkerShape.moveTo(0, 2.1);
  stalkerShape.lineTo(0.42, 0.76);
  stalkerShape.lineTo(0.16, 0.84);
  stalkerShape.lineTo(0.12, 0.2);
  stalkerShape.lineTo(-0.12, 0.2);
  stalkerShape.lineTo(-0.16, 0.84);
  stalkerShape.lineTo(-0.42, 0.76);
  stalkerShape.closePath();
  const stalkerTelegraph = new THREE.ShapeGeometry(stalkerShape);
  stalkerTelegraph.name = "telegraph.stalker-pounce-lane";
  const bruteTelegraph = new THREE.RingGeometry(0.76, 1, 24, 1, 0, Math.PI * 0.32);
  bruteTelegraph.name = "telegraph.brute-slam-segment";
  const transitionRing = new THREE.RingGeometry(0.92, 1, 48);
  const shoulderGuard = new THREE.ConeGeometry(0.22, 0.42, 4, 1);
  const stalkerVane = new THREE.ConeGeometry(0.085, 0.46, 3, 1);
  const eliteHalo = new THREE.TorusGeometry(0.5, 0.035, 6, 32);
  for (const geometry of [
    shamblerTelegraph,
    stalkerTelegraph,
    bruteTelegraph,
    transitionRing,
    shoulderGuard,
    stalkerVane,
    eliteHalo,
  ]) {
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  }
  return {
    shamblerTelegraph,
    stalkerTelegraph,
    bruteTelegraph,
    transitionRing,
    shoulderGuard,
    stalkerVane,
    eliteHalo,
  };
}

function isolateAvatarMaterials(root: THREE.Object3D): MaterialBaseline[] {
  const copies = new Map<THREE.Material, THREE.Material>();
  const baselines: MaterialBaseline[] = [];

  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    const source = Array.isArray(node.material) ? node.material : [node.material];
    const isolated = source.map((material) => {
      const existing = copies.get(material);
      if (existing) return existing;
      const copy = material.clone();
      // Dithered alpha gives spawn/death transitions a restrained dissolve
      // without adding per-enemy shader programs. Existing transparent
      // materials retain their authored blending path.
      if (!copy.transparent) copy.alphaHash = true;
      copy.needsUpdate = true;
      copies.set(material, copy);
      const styled = copy as THREE.Material & {
        color?: THREE.Color;
        emissive?: THREE.Color;
        emissiveIntensity?: number;
      };
      baselines.push({
        material: copy,
        opacity: copy.opacity,
        color: styled.color?.clone() ?? null,
        emissive: styled.emissive?.clone() ?? null,
        emissiveIntensity: styled.emissiveIntensity ?? null,
        styleable:
          copy instanceof THREE.MeshStandardMaterial ||
          copy instanceof THREE.MeshLambertMaterial ||
          copy instanceof THREE.MeshPhongMaterial,
      });
      return copy;
    });
    node.material = Array.isArray(node.material) ? isolated : isolated[0]!;
  });

  return baselines;
}

function markTextureResources(material: THREE.Material): void {
  material.needsUpdate = true;
  for (const value of Object.values(material as unknown as Record<string, unknown>)) {
    if (value instanceof THREE.Texture) value.needsUpdate = true;
  }
}

/**
 * Keyed, pooled presentation adapter for a combat horde. It intentionally owns
 * no AI, damage, score, or progression state.
 */
export class EnemyFieldView {
  readonly root = new THREE.Group();

  private readonly active = new Map<string, EnemySlot>();
  private readonly retiring = new Map<string, EnemySlot>();
  private readonly pool: EnemySlot[] = [];
  private readonly allSlots = new Set<EnemySlot>();
  private readonly geometry = createSharedGeometry();
  private readonly createZombieView: (assets: AssetRegistry) => EnemyAvatarView;
  private readonly maxPoolSize: number;
  private createdSlots = 0;
  private disposedSlots = 0;
  private disposed = false;

  constructor(
    private readonly assets: AssetRegistry,
    options: EnemyFieldViewOptions = {},
  ) {
    this.root.name = "enemy-field";
    this.maxPoolSize = Math.max(0, Math.floor(options.maxPoolSize ?? 18));
    this.createZombieView =
      options.createZombieView ?? ((registry) => new ZombieView(registry));
  }

  /**
   * Reconciles a simulation snapshot by stable id. Call once per rendered
   * frame. Asset instances are created only when no pooled slot is available.
   */
  update(states: readonly EnemyFieldEntityState[], elapsed: number): void {
    this.assertUsable();
    const frameElapsed = finite(elapsed);
    const incoming = new Map<string, EnemyFieldEntityState>();
    for (const state of states) {
      if (state.id.length === 0) throw new Error("EnemyFieldView requires non-empty ids");
      if (incoming.has(state.id)) {
        throw new Error(`EnemyFieldView received duplicate id: ${state.id}`);
      }
      incoming.set(state.id, state);
    }

    for (const [id, state] of incoming) {
      let slot = this.active.get(id);
      if (!slot) {
        slot = this.retiring.get(id);
        if (slot) this.retiring.delete(id);
        else slot = this.acquireSlot();
        this.activateSlot(slot, state, frameElapsed);
      }
      this.presentActiveSlot(slot, state, frameElapsed);
    }

    for (const [id, slot] of [...this.active]) {
      if (incoming.has(id)) continue;
      this.active.delete(id);
      slot.targetable = false;
      slot.retireStartedAt = frameElapsed;
      if (slot.deathStartedAt === null) slot.deathStartedAt = frameElapsed;
      this.retiring.set(id, slot);
    }

    for (const [id, slot] of [...this.retiring]) {
      this.presentRetiringSlot(slot, frameElapsed);
      if (frameElapsed - (slot.retireStartedAt ?? frameElapsed) < RETIRE_SECONDS) continue;
      this.retiring.delete(id);
      this.releaseSlot(slot);
    }
  }

  /** Preallocates detached slots for predictable horde-spawn frame time. */
  reserve(count: number): void {
    this.assertUsable();
    const target = Math.max(0, Math.min(Math.floor(count), this.maxPoolSize));
    while (this.pool.length < target) {
      const slot = this.createSlot();
      slot.root.visible = false;
      this.pool.push(slot);
    }
  }

  getLockTargetAnchor(id: string): THREE.Object3D | null {
    const slot = this.active.get(id);
    return slot?.targetable ? slot.lockAnchor : null;
  }

  inspect(id: string): EnemyFieldInstanceSnapshot | null {
    const slot = this.active.get(id) ?? this.retiring.get(id);
    if (!slot || slot.id === null) return null;
    return {
      id: slot.id,
      archetype: slot.archetype,
      targetable: slot.targetable,
      telegraphVisible: slot.telegraph.visible,
      telegraphOpacity: slot.telegraphMaterial.opacity,
      telegraphForm: slot.telegraph.geometry.name,
      presentationOpacity: slot.presentationOpacity,
      rootUuid: slot.root.uuid,
    };
  }

  get snapshot(): EnemyFieldSnapshot {
    return {
      schema: "gauntlet.enemy-field.v1",
      activeIds: [...this.active.keys()].sort(),
      retiringIds: [...this.retiring.keys()].sort(),
      pooled: this.pool.length,
      createdSlots: this.createdSlots,
      disposedSlots: this.disposedSlots,
      totalSlots: this.allSlots.size,
    };
  }

  restoreGpuResources(): void {
    this.assertUsable();
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    for (const slot of this.allSlots) {
      slot.root.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return;
        geometries.add(node.geometry);
        const nodeMaterials = Array.isArray(node.material) ? node.material : [node.material];
        for (const material of nodeMaterials) materials.add(material);
      });
    }
    for (const geometry of geometries) {
      if (geometry.index) geometry.index.needsUpdate = true;
      for (const attribute of Object.values(
        geometry.attributes,
      ) as THREE.BufferAttribute[]) {
        attribute.needsUpdate = true;
      }
    }
    for (const material of materials) markTextureResources(material);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const slot of [...this.allSlots]) this.disposeSlot(slot);
    this.active.clear();
    this.retiring.clear();
    this.pool.length = 0;
    for (const geometry of Object.values(this.geometry)) geometry.dispose();
    this.root.clear();
  }

  private acquireSlot(): EnemySlot {
    return this.pool.pop() ?? this.createSlot();
  }

  private activateSlot(
    slot: EnemySlot,
    state: EnemyFieldEntityState,
    elapsed: number,
  ): void {
    slot.id = state.id;
    slot.bornAt = elapsed;
    slot.deathStartedAt = null;
    slot.retireStartedAt = null;
    slot.phaseOffset = stablePhase(state.id);
    slot.targetable = false;
    slot.lastState = cloneState(state);
    slot.root.name = `enemy-field.instance.${state.id}`;
    slot.root.visible = true;
    if (slot.root.parent !== this.root) this.root.add(slot.root);
    this.applyArchetype(slot, state.archetype);
    this.active.set(state.id, slot);
  }

  private presentActiveSlot(
    slot: EnemySlot,
    state: EnemyFieldEntityState,
    elapsed: number,
  ): void {
    if (slot.archetype !== state.archetype) this.applyArchetype(slot, state.archetype);
    const dead = !state.alive || state.phase === "dying" || state.motion === "dead";
    if (dead && slot.deathStartedAt === null) slot.deathStartedAt = elapsed;
    if (!dead && slot.deathStartedAt !== null) {
      slot.deathStartedAt = null;
      slot.bornAt = elapsed;
    }
    slot.lastState = cloneState(state);
    this.presentSlot(slot, state, elapsed, dead);
  }

  private presentRetiringSlot(slot: EnemySlot, elapsed: number): void {
    const previous = slot.lastState;
    if (!previous) return;
    this.presentSlot(
      slot,
      { ...previous, phase: "dying", motion: "dead", alive: false, telegraph01: 0 },
      elapsed,
      true,
    );
  }

  private presentSlot(
    slot: EnemySlot,
    state: EnemyFieldEntityState,
    elapsed: number,
    dead: boolean,
  ): void {
    const style = ENEMY_ARCHETYPE_STYLES[slot.archetype];
    const hitPulse = clamp01(state.hitPulse01);
    const spawn01 = smootherStep((elapsed - slot.bornAt) / SPAWN_SECONDS);
    const death01 =
      dead && slot.deathStartedAt !== null
        ? smootherStep((elapsed - slot.deathStartedAt) / DEATH_SECONDS)
        : 0;
    const retire01 =
      slot.retireStartedAt === null
        ? 0
        : smootherStep((elapsed - slot.retireStartedAt) / RETIRE_SECONDS);
    const opacity = clamp01(spawn01 * (1 - Math.max(death01, retire01)));
    const health01 = clamp01(state.health / Math.max(1, state.maxHealth));

    slot.root.position.set(finite(state.position.x), 0, finite(state.position.z));
    slot.root.rotation.set(0, -finite(state.yaw), 0);
    slot.presentationOpacity = opacity;
    slot.targetable = !dead && opacity > 0.3 && state.health > 0;

    const avatarMotion: EnemyState["motion"] = dead
      ? "dead"
      : state.motion === "hit" || hitPulse > 0.02
        ? "hit"
        : "idle";
    const attackPresentation: EnemyAuthoredAttackPresentation = {
      phase: state.attackPhase,
      progress01: state.attackProgress01,
      contactProgress01: state.contactProgress01,
    };
    slot.avatar.update(
      {
        position: { x: 0, z: 0 },
        yaw: 0,
        health: Math.max(0, finite(state.health)),
        maxHealth: Math.max(1, finite(state.maxHealth, 1)),
        motion: avatarMotion,
        hitStunRemaining: avatarMotion === "hit" ? Math.max(0.02, hitPulse * 0.28) : 0,
        idlePhase: slot.phaseOffset,
      },
      elapsed,
      attackPresentation,
    );

    const tempo = elapsed * style.tempo * Math.PI * 2 + slot.phaseOffset;
    const movement = state.motion === "move" ? 1 : state.motion === "attack" ? 0.72 : 0.3;
    const breathe = Math.sin(tempo) * 0.018 * movement;
    const attackPose = sampleEnemyAttackPose(
      slot.archetype,
      state.attackPhase,
      state.attackProgress01,
      state.contactProgress01,
    );
    const spawnScale = 0.78 + spawn01 * 0.22;
    const deathScale = 1 - death01 * 0.08;
    slot.body.scale.set(
      style.bodyScale[0] * attackPose.bodyScale[0] * spawnScale * deathScale,
      style.bodyScale[1] * attackPose.bodyScale[1] * (0.9 + spawn01 * 0.1) * deathScale * (1 - hitPulse * 0.045),
      style.bodyScale[2] * attackPose.bodyScale[2] * spawnScale * deathScale * (1 + hitPulse * 0.06),
    );
    slot.body.position.set(
      attackPose.bodyPosition[0],
      breathe - death01 * 0.13 - hitPulse * 0.07 + attackPose.bodyPosition[1],
      hitPulse * 0.16 + attackPose.bodyPosition[2],
    );
    slot.body.rotation.x = attackPose.bodyRotation[0] + hitPulse * 0.22;
    slot.body.rotation.y = attackPose.bodyRotation[1];
    slot.body.rotation.z =
      style.postureLean +
      attackPose.bodyRotation[2] +
      Math.sin(tempo * 0.5) * 0.012 +
      Math.sign(Math.sin(slot.phaseOffset) || 1) * hitPulse * 0.12;

    this.updateMaterials(slot, opacity, hitPulse, health01);
    this.updateGroundCues(slot, state, elapsed, opacity, spawn01, death01);
  }

  private updateMaterials(
    slot: EnemySlot,
    opacity: number,
    hitPulse: number,
    health01: number,
  ): void {
    for (const baseline of slot.avatarMaterials) {
      const styled = baseline.material as THREE.Material & {
        color?: THREE.Color;
        emissive?: THREE.Color;
        emissiveIntensity?: number;
      };
      baseline.material.opacity = baseline.opacity * opacity;
      baseline.material.visible = opacity > 0.002;
      if (baseline.styleable && baseline.color && styled.color) {
        styled.color.copy(baseline.color).multiply(slot.tint);
        styled.color.lerp(slot.accent, hitPulse * 0.12);
      }
      if (baseline.emissive && styled.emissive) {
        const accentAmount = 0.025 + (1 - health01) * 0.035 + hitPulse * 0.22;
        styled.emissive.copy(baseline.emissive).lerp(slot.accent, accentAmount);
      }
      if (baseline.emissiveIntensity !== null && styled.emissiveIntensity !== undefined) {
        styled.emissiveIntensity = baseline.emissiveIntensity + hitPulse * 0.38;
      }
    }
    slot.accessoryMaterial.opacity = opacity;
    slot.accessoryMaterial.visible = opacity > 0.002;
    slot.accessoryMaterial.emissiveIntensity = 0.22 + hitPulse * 0.42;
  }

  private updateGroundCues(
    slot: EnemySlot,
    state: EnemyFieldEntityState,
    elapsed: number,
    opacity: number,
    spawn01: number,
    death01: number,
  ): void {
    const style = ENEMY_ARCHETYPE_STYLES[slot.archetype];
    const telegraph = clamp01(state.telegraph01);
    const pulse = 0.5 + Math.sin(elapsed * 11 + slot.phaseOffset) * 0.5;
    slot.telegraph.visible = opacity > 0.02 && state.alive && telegraph > 0.015;
    slot.telegraphDetail.visible =
      slot.telegraph.visible && slot.archetype !== "stalker";
    slot.telegraphMaterial.opacity =
      slot.telegraph.visible ? opacity * (0.07 + telegraph * (0.28 + pulse * 0.07)) : 0;
    const authoredScale = slot.archetype === "stalker" ? 0.72 : 1;
    const telegraphScale =
      style.telegraphRadius * authoredScale * (0.9 + telegraph * 0.1 + pulse * 0.012);
    slot.telegraph.scale.setScalar(telegraphScale);
    slot.telegraphDetail.scale.setScalar(
      telegraphScale * (slot.archetype === "brute" ? 0.92 : 0.76),
    );
    if (slot.archetype === "shambler") {
      slot.telegraph.rotation.z = -Math.PI * 0.34;
      slot.telegraphDetail.rotation.z = Math.PI * 0.66;
    } else if (slot.archetype === "stalker") {
      slot.telegraph.rotation.z = 0;
    } else {
      const settle = (1 - telegraph) * 0.16;
      slot.telegraph.rotation.z = -Math.PI * 0.16 - settle;
      slot.telegraphDetail.rotation.z = Math.PI * 0.84 + settle;
    }
    slot.accessoryMaterial.emissiveIntensity += telegraph * 0.3;

    const transitionStrength = Math.max(1 - spawn01, death01);
    slot.transitionRing.visible = transitionStrength > 0.015 && opacity > 0.002;
    slot.transitionMaterial.opacity = transitionStrength * 0.34;
    const transitionScale = style.telegraphRadius * (0.54 + (1 - transitionStrength) * 0.62);
    slot.transitionRing.scale.setScalar(transitionScale);
  }

  private applyArchetype(slot: EnemySlot, archetype: EnemyArchetype): void {
    slot.archetype = archetype;
    const style = ENEMY_ARCHETYPE_STYLES[archetype];
    slot.tint.setHex(style.bodyTint);
    slot.accent.setHex(style.accent);
    slot.accessoryMaterial.color.setHex(style.accent).multiplyScalar(0.62);
    slot.accessoryMaterial.emissive.setHex(style.accent).multiplyScalar(0.18);
    slot.telegraphMaterial.color.setHex(style.telegraph);
    slot.transitionMaterial.color.setHex(style.accent);
    slot.lockAnchor.position.set(0, style.lockHeight, 0);

    const telegraphGeometry = archetype === "shambler"
      ? this.geometry.shamblerTelegraph
      : archetype === "stalker"
        ? this.geometry.stalkerTelegraph
        : this.geometry.bruteTelegraph;
    slot.telegraph.geometry = telegraphGeometry;
    slot.telegraphDetail.geometry = telegraphGeometry;

    const showVanes = style.accessory === "vanes";
    slot.stalkerVaneLeft.visible = showVanes;
    slot.stalkerVaneRight.visible = showVanes;
    const showArmor = style.accessory === "elite-armor";
    slot.shoulderLeft.visible = showArmor;
    slot.shoulderRight.visible = showArmor;
    // The former head-height torus read as a floating debug bar in profile.
    slot.eliteHalo.visible = false;
  }

  private releaseSlot(slot: EnemySlot): void {
    slot.root.removeFromParent();
    slot.root.visible = false;
    slot.id = null;
    slot.lastState = null;
    slot.targetable = false;
    slot.retireStartedAt = null;
    slot.deathStartedAt = null;
    if (this.pool.length < this.maxPoolSize) this.pool.push(slot);
    else this.disposeSlot(slot);
  }

  private createSlot(): EnemySlot {
    const avatar = this.createZombieView(this.assets);
    const avatarMaterials = isolateAvatarMaterials(avatar.root);
    const root = new THREE.Group();
    const body = new THREE.Group();
    const accessories = new THREE.Group();
    root.add(body);
    body.add(avatar.root, accessories);

    const accessoryMaterial = new THREE.MeshStandardMaterial({
      color: 0x77928a,
      emissive: 0x173b39,
      emissiveIntensity: 0.22,
      roughness: 0.48,
      metalness: 0.62,
      transparent: true,
      opacity: 1,
      depthWrite: true,
    });
    const shoulderLeft = new THREE.Mesh(this.geometry.shoulderGuard, accessoryMaterial);
    const shoulderRight = new THREE.Mesh(this.geometry.shoulderGuard, accessoryMaterial);
    shoulderLeft.name = "enemy-field.brute-shoulder-left";
    shoulderRight.name = "enemy-field.brute-shoulder-right";
    shoulderLeft.position.set(-0.4, 1.38, 0.01);
    shoulderRight.position.set(0.4, 1.38, 0.01);
    shoulderLeft.rotation.z = -1.03;
    shoulderRight.rotation.z = 1.03;
    shoulderLeft.scale.set(0.88, 0.72, 1.02);
    shoulderRight.scale.copy(shoulderLeft.scale);

    const stalkerVaneLeft = new THREE.Mesh(this.geometry.stalkerVane, accessoryMaterial);
    const stalkerVaneRight = new THREE.Mesh(this.geometry.stalkerVane, accessoryMaterial);
    stalkerVaneLeft.name = "enemy-field.stalker-vane-left";
    stalkerVaneRight.name = "enemy-field.stalker-vane-right";
    stalkerVaneLeft.position.set(-0.2, 1.33, 0.16);
    stalkerVaneRight.position.set(0.2, 1.33, 0.16);
    stalkerVaneLeft.rotation.z = -0.52;
    stalkerVaneRight.rotation.z = 0.52;

    const eliteHalo = new THREE.Mesh(this.geometry.eliteHalo, accessoryMaterial);
    eliteHalo.name = "enemy-field.brute-elite-halo";
    eliteHalo.position.set(0, 2.22, 0.08);
    eliteHalo.rotation.x = Math.PI / 2;
    accessories.add(
      shoulderLeft,
      shoulderRight,
      stalkerVaneLeft,
      stalkerVaneRight,
      eliteHalo,
    );

    const telegraphMaterial = new THREE.MeshBasicMaterial({
      color: 0xe5a14b,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
      toneMapped: true,
    });
    const telegraph = new THREE.Mesh(this.geometry.shamblerTelegraph, telegraphMaterial);
    telegraph.name = "enemy-field.attack-telegraph";
    telegraph.position.y = GROUND_Y;
    telegraph.rotation.x = -Math.PI / 2;
    telegraph.renderOrder = 5;
    const telegraphDetail = new THREE.Mesh(
      this.geometry.shamblerTelegraph,
      telegraphMaterial,
    );
    telegraphDetail.name = "enemy-field.attack-telegraph-detail";
    telegraphDetail.position.y = GROUND_Y + 0.001;
    telegraphDetail.rotation.x = -Math.PI / 2;
    telegraphDetail.renderOrder = 5;
    root.add(telegraph, telegraphDetail);

    const transitionMaterial = new THREE.MeshBasicMaterial({
      color: 0xb4c46d,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const transitionRing = new THREE.Mesh(this.geometry.transitionRing, transitionMaterial);
    transitionRing.name = "enemy-field.spawn-death-ring";
    transitionRing.position.y = GROUND_Y + 0.002;
    transitionRing.rotation.x = -Math.PI / 2;
    transitionRing.renderOrder = 4;
    root.add(transitionRing);

    const lockAnchor = new THREE.Object3D();
    lockAnchor.name = "enemy-field.lock-target-anchor";
    root.add(lockAnchor);

    const slot: EnemySlot = {
      id: null,
      archetype: "shambler",
      root,
      body,
      avatar,
      avatarMaterials,
      accessoryMaterial,
      telegraphMaterial,
      transitionMaterial,
      telegraph,
      telegraphDetail,
      transitionRing,
      shoulderLeft,
      shoulderRight,
      stalkerVaneLeft,
      stalkerVaneRight,
      eliteHalo,
      lockAnchor,
      tint: new THREE.Color(),
      accent: new THREE.Color(),
      bornAt: 0,
      deathStartedAt: null,
      retireStartedAt: null,
      phaseOffset: 0,
      lastState: null,
      targetable: false,
      presentationOpacity: 0,
      disposed: false,
    };
    this.applyArchetype(slot, "shambler");
    this.allSlots.add(slot);
    this.createdSlots += 1;
    return slot;
  }

  private disposeSlot(slot: EnemySlot): void {
    if (slot.disposed) return;
    slot.disposed = true;
    slot.root.removeFromParent();
    slot.avatar.dispose();
    for (const baseline of slot.avatarMaterials) baseline.material.dispose();
    slot.accessoryMaterial.dispose();
    slot.telegraphMaterial.dispose();
    slot.transitionMaterial.dispose();
    slot.root.clear();
    this.allSlots.delete(slot);
    this.disposedSlots += 1;
  }

  private assertUsable(): void {
    if (this.disposed) throw new Error("EnemyFieldView has been disposed");
  }
}
