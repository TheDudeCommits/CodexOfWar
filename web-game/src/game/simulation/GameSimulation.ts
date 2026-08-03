import {
  ARENA_PLAY_RADIUS,
  ATTACK_ACTIVE_FIRST_FRAME,
  ATTACK_ACTIVE_LAST_FRAME,
  ATTACK_HALF_ANGLE,
  ATTACK_HIT_FRAME,
  ATTACK_RECOVERY_LAST_FRAME,
  ATTACK_STARTUP_LAST_FRAME,
  HEAVY_ACTIVE_FIRST_RELATIVE_TICK,
  HEAVY_ACTIVE_LAST_RELATIVE_TICK,
  HEAVY_CONTACT_DAMAGE,
  HEAVY_NEUTRAL_RELATIVE_TICK,
  LIVE_TUNING,
  PLAYER_DODGE_COST,
  PLAYER_DODGE_DURATION,
  PLAYER_DODGE_SPEED,
  PLAYER_SPRINT_DRAIN,
  PLAYER_STAMINA_REGEN,
  type SimulationTuning,
} from "./constants";
import { approachAngle, clamp, directionToYaw, dot, length, normalized, yawToForward } from "./math";
import type { GameEvent, InputFrame, Vec2, WorldState } from "./types";

export const EMPTY_INPUT: InputFrame = {
  moveX: 0,
  moveZ: 0,
  sprint: false,
  dodgePressed: false,
  attackPressed: false,
  heavyAttackPressed: false,
};

export interface InitialWorldOptions {
  playerPosition?: Vec2;
  enemyPosition?: Vec2;
}

export function createInitialWorld(options: InitialWorldOptions = {}): WorldState {
  const playerPosition = options.playerPosition ?? { x: 0, z: 3.25 };
  const enemyPosition = options.enemyPosition ?? { x: 0, z: -0.15 };
  return {
    tick: 0,
    elapsed: 0,
    objectiveComplete: false,
    player: {
      position: { ...playerPosition },
      yaw: 0,
      health: 100,
      maxHealth: 100,
      stamina: 100,
      maxStamina: 100,
      motion: "idle",
      speed01: 0,
      attackElapsed: 0,
      attackFrame: -1,
      attackPhase: "idle",
      attackKind: "none",
      heavyRelativeTick: -1,
      attackSerial: 0,
      attackHasHit: false,
      dodgeRemaining: 0,
      dodgeDirection: { x: 0, z: -1 },
      invulnerableRemaining: 0,
    },
    enemy: {
      position: { ...enemyPosition },
      positionY: 0,
      yaw: Math.PI,
      health: 100,
      maxHealth: 100,
      motion: "idle",
      hitStunRemaining: 0,
      idlePhase: 0,
    },
  };
}

export class GameSimulation {
  state: WorldState;
  private readonly pendingEvents: GameEvent[] = [];
  private tuning: SimulationTuning;
  private eventTickOffset = 0;

  constructor(initialState: WorldState = createInitialWorld(), tuning: SimulationTuning = LIVE_TUNING) {
    this.state = initialState;
    this.tuning = tuning;
  }

  reset(
    initialState: WorldState = createInitialWorld(),
    tuning: SimulationTuning = this.tuning,
    eventTickOffset = 0,
  ): void {
    this.state = initialState;
    this.tuning = tuning;
    this.eventTickOffset = eventTickOffset;
    this.pendingEvents.length = 0;
  }

  step(input: InputFrame, dt: number): void {
    const { player, enemy } = this.state;
    const tick = this.state.tick + this.eventTickOffset;
    this.state.elapsed += dt;
    enemy.idlePhase += dt;

    player.invulnerableRemaining = Math.max(0, player.invulnerableRemaining - dt);
    enemy.hitStunRemaining = Math.max(0, enemy.hitStunRemaining - dt);
    if (enemy.health > 0) enemy.motion = enemy.hitStunRemaining > 0 ? "hit" : "idle";

    const requestedMove = normalized(
      { x: input.moveX, z: input.moveZ },
      yawToForward(player.yaw),
    );
    const inputMagnitude = clamp(Math.hypot(input.moveX, input.moveZ), 0, 1);

    if (
      input.dodgePressed &&
      player.dodgeRemaining <= 0 &&
      player.attackFrame < 0 &&
      player.stamina >= PLAYER_DODGE_COST
    ) {
      player.stamina -= PLAYER_DODGE_COST;
      player.dodgeRemaining = PLAYER_DODGE_DURATION;
      player.invulnerableRemaining = PLAYER_DODGE_DURATION * 0.72;
      player.dodgeDirection = inputMagnitude > 0 ? requestedMove : yawToForward(player.yaw);
      player.yaw = directionToYaw(player.dodgeDirection);
      this.pendingEvents.push({ type: "dodge-started", tick });
    }

    let heavyStarted = false;
    if (input.heavyAttackPressed && enemy.health > 0) {
      if (player.attackFrame < 0 && player.dodgeRemaining <= 0) {
        player.attackFrame = 0;
        player.heavyRelativeTick = 0;
        player.attackElapsed = dt;
        player.attackPhase = "startup";
        player.attackKind = "heavy";
        player.attackSerial += 1;
        player.attackHasHit = false;
        heavyStarted = true;
        this.pendingEvents.push({ type: "heavy-started", tick, attackSerial: player.attackSerial });
      } else {
        this.pendingEvents.push({
          type: "attack-rejected-busy",
          tick,
          attackSerial: player.attackSerial,
        });
      }
    }

    if (input.attackPressed && !input.heavyAttackPressed && enemy.health > 0) {
      if (player.attackFrame < 0 && player.dodgeRemaining <= 0) {
        player.attackFrame = 0;
        player.attackElapsed = Number.EPSILON;
        player.attackPhase = "startup";
        player.attackKind = "light";
        player.heavyRelativeTick = -1;
        player.attackSerial += 1;
        player.attackHasHit = false;
        this.pendingEvents.push({ type: "attack-started", tick, attackSerial: player.attackSerial });
      } else {
        this.pendingEvents.push({
          type: "attack-rejected-busy",
          tick,
          attackSerial: player.attackSerial,
        });
      }
    }

    let staminaRegenerates = true;
    if (player.dodgeRemaining > 0) {
      player.motion = "dodge";
      player.speed01 = 1;
      const dodgeFade = clamp(player.dodgeRemaining / 0.12, 0.2, 1);
      this.movePlayer(player.dodgeDirection, PLAYER_DODGE_SPEED * dodgeFade, dt);
      player.dodgeRemaining = Math.max(0, player.dodgeRemaining - dt);
      staminaRegenerates = false;
    } else if (player.attackFrame >= 0) {
      player.motion = "attack";
      player.speed01 = 0;
      if (typeof input.faceYaw === "number") {
        player.yaw = approachAngle(player.yaw, input.faceYaw, dt * 22);
      }

      if (player.attackKind === "heavy") {
        if (!heavyStarted) player.heavyRelativeTick += 1;
        const relativeTick = player.heavyRelativeTick;
        if (relativeTick >= HEAVY_NEUTRAL_RELATIVE_TICK) {
          player.attackFrame = -1;
          player.attackElapsed = 0;
          player.attackPhase = "idle";
          player.attackKind = "none";
          player.heavyRelativeTick = -1;
          player.attackHasHit = false;
          player.motion = "idle";
        } else {
          player.attackFrame = relativeTick;
          player.attackElapsed = (relativeTick + 1) * dt;
          if (relativeTick < HEAVY_ACTIVE_FIRST_RELATIVE_TICK) player.attackPhase = "startup";
          else if (relativeTick <= HEAVY_ACTIVE_LAST_RELATIVE_TICK) player.attackPhase = "active";
          else player.attackPhase = "recovery";
        }
      } else {
        const attackFrame = player.attackFrame;
        if (attackFrame <= ATTACK_STARTUP_LAST_FRAME) player.attackPhase = "startup";
        else if (attackFrame >= ATTACK_ACTIVE_FIRST_FRAME && attackFrame <= ATTACK_ACTIVE_LAST_FRAME) {
          player.attackPhase = "active";
        } else player.attackPhase = "recovery";

        player.attackElapsed = (attackFrame + 1) * dt;
        if (attackFrame === ATTACK_HIT_FRAME && !player.attackHasHit) this.tryAttackHit(tick);

        if (attackFrame >= ATTACK_RECOVERY_LAST_FRAME) {
          player.attackFrame = -1;
          player.attackElapsed = 0;
          player.attackHasHit = false;
          player.attackKind = "none";
        } else player.attackFrame += 1;
      }
    } else if (inputMagnitude > 0) {
      player.attackPhase = "idle";
      player.attackKind = "none";
      player.heavyRelativeTick = -1;
      const wantsSprint = input.sprint && player.stamina > 0.5;
      const speed = wantsSprint ? this.tuning.sprintSpeed : this.tuning.walkSpeed;
      player.motion = wantsSprint ? "sprint" : "move";
      player.speed01 = wantsSprint ? 1 : 0.62;
      this.movePlayer(requestedMove, speed * inputMagnitude, dt);

      const facingYaw = typeof input.faceYaw === "number" ? input.faceYaw : directionToYaw(requestedMove);
      player.yaw = approachAngle(player.yaw, facingYaw, dt * 15);
      if (wantsSprint) {
        player.stamina = Math.max(0, player.stamina - PLAYER_SPRINT_DRAIN * dt);
        staminaRegenerates = false;
      }
    } else {
      player.attackPhase = "idle";
      player.attackKind = "none";
      player.heavyRelativeTick = -1;
      player.motion = "idle";
      player.speed01 = 0;
      if (typeof input.faceYaw === "number") {
        player.yaw = approachAngle(player.yaw, input.faceYaw, dt * 14);
      }
    }

    if (staminaRegenerates) {
      player.stamina = Math.min(player.maxStamina, player.stamina + PLAYER_STAMINA_REGEN * dt);
    }

    enemy.yaw = directionToYaw({
      x: player.position.x - enemy.position.x,
      z: player.position.z - enemy.position.z,
    });
    this.state.tick += 1;
  }

  reconcilePlayerPosition(position: Vec2): void {
    this.state.player.position.x = position.x;
    this.state.player.position.z = position.z;
  }

  consumeEvents(): GameEvent[] {
    return this.pendingEvents.splice(0, this.pendingEvents.length);
  }

  applyHeavyGeometryContact(tick: number, separationMeters: number): boolean {
    const { player, enemy } = this.state;
    if (
      player.attackKind !== "heavy" || player.attackHasHit ||
      player.heavyRelativeTick < HEAVY_ACTIVE_FIRST_RELATIVE_TICK ||
      player.heavyRelativeTick > HEAVY_ACTIVE_LAST_RELATIVE_TICK ||
      enemy.health !== enemy.maxHealth
    ) return false;
    player.attackHasHit = true;
    enemy.health = Math.max(0, enemy.health - HEAVY_CONTACT_DAMAGE);
    const separationMicrometres = Math.round(separationMeters * 1_000_000);
    this.pendingEvents.push({
      type: "heavy-contact",
      tick,
      heavyRelativeTick: player.heavyRelativeTick,
      attackSerial: player.attackSerial,
      separationMicrometres,
    });
    this.pendingEvents.push({
      type: "heavy-damage",
      tick,
      heavyRelativeTick: player.heavyRelativeTick,
      damage: HEAVY_CONTACT_DAMAGE,
      remainingHealth: enemy.health,
      attackSerial: player.attackSerial,
    });
    return true;
  }

  private movePlayer(direction: Vec2, speed: number, dt: number): void {
    const position = this.state.player.position;
    position.x += direction.x * speed * dt;
    position.z += direction.z * speed * dt;

    const radius = length(position);
    if (radius > ARENA_PLAY_RADIUS) {
      const boundary = normalized(position);
      position.x = boundary.x * ARENA_PLAY_RADIUS;
      position.z = boundary.z * ARENA_PLAY_RADIUS;
    }
  }

  private tryAttackHit(tick: number): void {
    const { player, enemy } = this.state;
    const toEnemy = {
      x: enemy.position.x - player.position.x,
      z: enemy.position.z - player.position.z,
    };
    const distance = length(toEnemy);
    if (distance > this.tuning.attackRange || distance < 0.0001) return;

    const alignment = clamp(dot(yawToForward(player.yaw), normalized(toEnemy)), -1, 1);
    if (Math.acos(alignment) > ATTACK_HALF_ANGLE) return;

    player.attackHasHit = true;
    enemy.health = Math.max(0, enemy.health - this.tuning.attackDamage);
    enemy.hitStunRemaining = 0.28;
    enemy.motion = enemy.health > 0 ? "hit" : "dead";
    this.pendingEvents.push({
      type: "enemy-hit",
      tick,
      damage: this.tuning.attackDamage,
      remainingHealth: enemy.health,
      attackSerial: player.attackSerial,
    });

    if (enemy.health <= 0) {
      this.state.objectiveComplete = true;
      this.pendingEvents.push({ type: "enemy-defeated", tick, attackSerial: player.attackSerial });
    }
  }
}
