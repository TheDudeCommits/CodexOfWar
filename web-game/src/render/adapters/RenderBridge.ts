import type * as THREE from "three";
import type { HordeGameEvent, HordeRunState } from "../../game/run";
import type { PlayerState } from "../../game/simulation/types";
import type { GameEvent, WorldState } from "../../game/simulation/types";
import type { ThirdPersonCamera } from "../app/ThirdPersonCamera";
import type { AssetRegistry } from "../loaders/AssetRegistry";
import { ArenaView } from "../objects/ArenaView";
import { CombatFx } from "../objects/CombatFx";
import { HeroView, ZombieView } from "../objects/CharacterViews";
import {
  EnemyFieldView,
  type EnemyFieldEntityState,
} from "../objects/EnemyFieldView";
import {
  WeaponLoadoutView,
  type WeaponLoadoutPresentation,
} from "../objects/WeaponLoadoutView";

export interface PresentationAssetReceipt {
  schema: "gauntlet.presentation-assets.v1";
  proceduralFallbackActive: boolean;
  views: {
    hero: { authored: boolean; fallbackReason: string | null; animations: string[] };
    hollow: { authored: boolean; fallbackReason: string | null; animations: string[] };
    arenaSector: { authored: boolean; fallbackReason: string | null };
  };
}

export class RenderBridge {
  readonly arena: ArenaView;
  readonly hero: HeroView;
  readonly zombie: ZombieView;
  readonly enemyField: EnemyFieldView;
  readonly weaponLoadout: WeaponLoadoutView;
  readonly combatFx = new CombatFx();

  constructor(
    scene: THREE.Scene,
    private readonly cameraController: ThirdPersonCamera,
    assets: AssetRegistry,
    maxAnisotropy: number,
  ) {
    this.arena = new ArenaView(assets, maxAnisotropy);
    this.hero = new HeroView(assets);
    this.zombie = new ZombieView(assets);
    this.enemyField = new EnemyFieldView(assets);
    this.enemyField.root.visible = false;
    this.weaponLoadout = new WeaponLoadoutView(this.hero.root);
    scene.add(
      this.arena.root,
      this.hero.root,
      this.zombie.root,
      this.enemyField.root,
      this.combatFx.root,
    );
  }

  update(state: WorldState, dt: number): void {
    this.arena.update(state.elapsed);
    this.hero.update(state.player, state.elapsed);
    this.zombie.update(state.enemy, state.elapsed);
    this.combatFx.update(dt, state.elapsed);
  }

  updateHorde(
    player: PlayerState,
    enemies: readonly EnemyFieldEntityState[],
    weapon: WeaponLoadoutPresentation,
    elapsed: number,
    dt: number,
  ): void {
    this.arena.update(elapsed);
    // The loadout establishes visibility and authored-weapon scale first.
    // HeroView then owns the final greatsword rotation and closes the support
    // hand against that final transform.
    this.weaponLoadout.update(weapon);
    this.hero.update(player, elapsed, weapon);
    this.enemyField.update(enemies, elapsed);
    this.combatFx.update(dt, elapsed);
  }

  updateWeaponLoadout(state: WeaponLoadoutPresentation): void {
    this.weaponLoadout.update(state);
  }

  setEnemyFieldEnabled(enabled: boolean): void {
    this.enemyField.root.visible = enabled;
    this.zombie.root.visible = !enabled;
  }

  updateEnemyField(states: readonly EnemyFieldEntityState[], elapsed: number): void {
    this.enemyField.update(states, elapsed);
  }

  handleEvents(events: readonly GameEvent[], state: WorldState): void {
    for (const event of events) {
      if (event.type !== "enemy-hit") continue;
      const dx = state.enemy.position.x - state.player.position.x;
      const dz = state.enemy.position.z - state.player.position.z;
      const length = Math.hypot(dx, dz);
      const directionX = length > 0.0001 ? dx / length : 0;
      const directionZ = length > 0.0001 ? dz / length : -1;
      this.combatFx.burst(
        state.enemy.position.x,
        1.34,
        state.enemy.position.z,
        directionX,
        directionZ,
        event.attackSerial,
        event.remainingHealth <= 0,
      );
      this.cameraController.kickShake(event.remainingHealth <= 0 ? 1.55 : 1);
    }
  }

  handleHordeEvents(events: readonly HordeGameEvent[], state: HordeRunState): void {
    for (const event of events) {
      if (event.type === "enemy-hit") {
        const enemy = state.enemies.find((candidate) => candidate.id === event.enemyId);
        if (!enemy) continue;
        const dx = enemy.position.x - state.player.position.x;
        const dz = enemy.position.z - state.player.position.z;
        const magnitude = Math.hypot(dx, dz);
        this.combatFx.burst(
          enemy.position.x,
          enemy.archetype === "brute" ? 1.72 : 1.34,
          enemy.position.z,
          magnitude > 0.0001 ? dx / magnitude : 0,
          magnitude > 0.0001 ? dz / magnitude : -1,
          event.attackSerial,
          event.remainingHealth <= 0,
          { weapon: event.weapon, special: event.special },
        );
        this.cameraController.kickShake(event.remainingHealth <= 0 ? 1.55 : event.special ? 1.3 : 1);
      } else if (event.type === "enemy-attack-hit") {
        this.cameraController.kickShake(1.3);
      } else if (event.type === "enemy-attack-evaded") {
        this.cameraController.kickShake(0.35);
      }
    }
  }

  get assetReceipt(): PresentationAssetReceipt {
    return {
      schema: "gauntlet.presentation-assets.v1",
      proceduralFallbackActive:
        this.hero.usingFallback || this.zombie.usingFallback || this.arena.usingFallback,
      views: {
        hero: {
          authored: !this.hero.usingFallback,
          fallbackReason: this.hero.fallbackReason,
          animations: [...this.hero.animationNames],
        },
        hollow: {
          authored: !this.zombie.usingFallback,
          fallbackReason: this.zombie.fallbackReason,
          animations: [...this.zombie.animationNames],
        },
        arenaSector: {
          authored: !this.arena.usingFallback,
          fallbackReason: this.arena.fallbackReason,
        },
      },
    };
  }

  restoreGpuResources(): void {
    for (const root of [
      this.arena.root,
      this.hero.root,
      this.zombie.root,
      this.combatFx.root,
    ]) {
      root.traverse((node) => {
        if (!(node as THREE.Mesh).isMesh) return;
        const mesh = node as THREE.Mesh;
        if (mesh.geometry.index) mesh.geometry.index.needsUpdate = true;
        for (const attribute of Object.values(
          mesh.geometry.attributes,
        ) as THREE.BufferAttribute[]) {
          attribute.needsUpdate = true;
        }
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const material of materials) {
          material.needsUpdate = true;
          for (const value of Object.values(material as unknown as Record<string, unknown>)) {
            if ((value as THREE.Texture)?.isTexture) {
              (value as THREE.Texture).needsUpdate = true;
            }
          }
        }
      });
    }
    this.weaponLoadout.restoreGpuResources();
    this.enemyField.restoreGpuResources();
  }

  dispose(): void {
    this.arena.dispose();
    this.weaponLoadout.dispose();
    this.hero.dispose();
    this.zombie.dispose();
    this.enemyField.dispose();
    this.combatFx.dispose();
  }
}
