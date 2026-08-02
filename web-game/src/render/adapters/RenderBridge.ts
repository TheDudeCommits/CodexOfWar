import type * as THREE from "three";
import type { GameEvent, WorldState } from "../../game/simulation/types";
import type { ThirdPersonCamera } from "../app/ThirdPersonCamera";
import type { AssetRegistry } from "../loaders/AssetRegistry";
import { ArenaView } from "../objects/ArenaView";
import { CombatFx } from "../objects/CombatFx";
import { HeroView, ZombieView } from "../objects/CharacterViews";

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
    scene.add(this.arena.root, this.hero.root, this.zombie.root, this.combatFx.root);
  }

  update(state: WorldState, dt: number): void {
    this.arena.update(state.elapsed);
    this.hero.update(state.player, state.elapsed);
    this.zombie.update(state.enemy, state.elapsed);
    this.combatFx.update(dt, state.elapsed);
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
  }

  dispose(): void {
    this.arena.dispose();
    this.hero.dispose();
    this.zombie.dispose();
    this.combatFx.dispose();
  }
}
