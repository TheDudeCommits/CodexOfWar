import RAPIER from "@dimforge/rapier3d-compat";
import type { Vec2 } from "../game/simulation/types";

const CHARACTER_CENTER_Y = 0.92;
const FORT_CENTER_Z = -5.5;
const FORT_HALF_WIDTH = 13.4;
const FORT_HALF_DEPTH = 0.64;

export interface PhysicsEnemy {
  readonly id: string | number;
  readonly position: Vec2;
  readonly radius?: number;
  readonly halfHeight?: number;
}

interface EnemyBodyEntry {
  readonly body: RAPIER.RigidBody;
  readonly radius: number;
  readonly halfHeight: number;
}

type PhysicsEnemyInput = Vec2 | readonly PhysicsEnemy[];

export class PhysicsBridge {
  private readonly world: RAPIER.World;
  private readonly playerBody: RAPIER.RigidBody;
  private readonly playerCollider: RAPIER.Collider;
  private readonly enemyBodies = new Map<string, EnemyBodyEntry>();
  private readonly characterController: RAPIER.KinematicCharacterController;
  private fortCollider: RAPIER.Collider | null = null;

  private constructor() {
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });

    this.world.createCollider(
      RAPIER.ColliderDesc.cylinder(0.2, 11.9)
        .setTranslation(0, -0.2, 0)
        .setFriction(0.9),
    );

    this.playerBody = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, CHARACTER_CENTER_Y, 3.25),
    );
    this.playerCollider = this.world.createCollider(
      RAPIER.ColliderDesc.capsule(0.53, 0.34).setCollisionGroups(0x0001_ffff),
      this.playerBody,
    );

    this.characterController = this.world.createCharacterController(0.02);
    this.characterController.setApplyImpulsesToDynamicBodies(false);
    this.characterController.enableAutostep(0.28, 0.12, true);
    this.characterController.enableSnapToGround(0.18);
  }

  static async create(): Promise<PhysicsBridge> {
    await RAPIER.init();
    return new PhysicsBridge();
  }

  enableHordeFortCollider(): void {
    if (this.fortCollider) return;
    this.fortCollider = this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(FORT_HALF_WIDTH, 2.8, FORT_HALF_DEPTH)
        .setTranslation(0, 2.8, FORT_CENTER_Z)
        .setFriction(0.9),
    );
  }

  reset(player: Vec2, enemies: PhysicsEnemyInput): void {
    this.playerBody.setTranslation({ x: player.x, y: CHARACTER_CENTER_Y, z: player.z }, true);
    this.playerBody.setNextKinematicTranslation({
      x: player.x,
      y: CHARACTER_CENTER_Y,
      z: player.z,
    });
    this.syncEnemies(enemies, true);
    this.world.step();
  }

  resolvePlayerMovement(
    previous: Vec2,
    desired: Vec2,
    enemies: PhysicsEnemyInput,
    dt: number,
  ): Vec2 {
    this.world.timestep = dt;
    this.syncEnemies(enemies, false);
    const requested = {
      x: desired.x - previous.x,
      y: 0,
      z: desired.z - previous.z,
    };
    this.characterController.computeColliderMovement(this.playerCollider, requested);
    const resolved = this.characterController.computedMovement();
    const next = {
      x: previous.x + resolved.x,
      y: CHARACTER_CENTER_Y + resolved.y,
      z: previous.z + resolved.z,
    };
    this.playerBody.setNextKinematicTranslation(next);
    this.world.step();
    const translation = this.playerBody.translation();
    return { x: translation.x, z: translation.z };
  }

  dispose(): void {
    this.world.free();
  }

  private syncEnemies(input: PhysicsEnemyInput, wakeUp: boolean): void {
    const enemies = Array.isArray(input)
      ? input
      : [{ id: "legacy-target", position: input as Vec2 }];
    const retained = new Set<string>();
    for (const enemy of enemies) {
      const id = String(enemy.id);
      if (retained.has(id)) throw new Error(`Duplicate physics enemy id: ${id}`);
      retained.add(id);
      const radius = Math.max(0.18, Math.min(1.2, enemy.radius ?? 0.42));
      const halfHeight = Math.max(0.2, Math.min(1.4, enemy.halfHeight ?? 0.58));
      let entry = this.enemyBodies.get(id);
      if (entry && (Math.abs(entry.radius - radius) > 1e-6 || Math.abs(entry.halfHeight - halfHeight) > 1e-6)) {
        this.world.removeRigidBody(entry.body);
        this.enemyBodies.delete(id);
        entry = undefined;
      }
      if (!entry) {
        const body = this.world.createRigidBody(
          RAPIER.RigidBodyDesc.fixed().setTranslation(
            enemy.position.x,
            radius + halfHeight,
            enemy.position.z,
          ),
        );
        this.world.createCollider(
          RAPIER.ColliderDesc.capsule(halfHeight, radius).setCollisionGroups(0x0002_ffff),
          body,
        );
        entry = { body, radius, halfHeight };
        this.enemyBodies.set(id, entry);
      }
      entry.body.setTranslation({
        x: enemy.position.x,
        y: radius + halfHeight,
        z: enemy.position.z,
      }, wakeUp);
    }
    for (const [id, entry] of [...this.enemyBodies]) {
      if (retained.has(id)) continue;
      this.world.removeRigidBody(entry.body);
      this.enemyBodies.delete(id);
    }
  }
}
