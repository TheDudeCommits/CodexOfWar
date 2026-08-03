import RAPIER from "@dimforge/rapier3d-compat";
import type { Vec2 } from "../game/simulation/types";

const CHARACTER_CENTER_Y = 0.92;

export class PhysicsBridge {
  private readonly world: RAPIER.World;
  private readonly playerBody: RAPIER.RigidBody;
  private readonly playerCollider: RAPIER.Collider;
  private readonly enemyBody: RAPIER.RigidBody;
  private readonly characterController: RAPIER.KinematicCharacterController;
  private enemyVerticalOffset = 0;

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

    this.enemyBody = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0.94, -0.15),
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.capsule(0.58, 0.42).setCollisionGroups(0x0002_ffff),
      this.enemyBody,
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

  reset(player: Vec2, enemy: Vec2, enemyVerticalOffset = 0): void {
    this.enemyVerticalOffset = enemyVerticalOffset;
    this.playerBody.setTranslation({ x: player.x, y: CHARACTER_CENTER_Y, z: player.z }, true);
    this.playerBody.setNextKinematicTranslation({
      x: player.x,
      y: CHARACTER_CENTER_Y,
      z: player.z,
    });
    this.enemyBody.setTranslation(
      { x: enemy.x, y: 0.94 + this.enemyVerticalOffset, z: enemy.z },
      true,
    );
    this.world.step();
  }

  resolvePlayerMovement(previous: Vec2, desired: Vec2, enemy: Vec2, dt: number): Vec2 {
    this.world.timestep = dt;
    this.enemyBody.setTranslation(
      { x: enemy.x, y: 0.94 + this.enemyVerticalOffset, z: enemy.z },
      false,
    );
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
}
