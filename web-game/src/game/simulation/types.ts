export interface Vec2 {
  x: number;
  z: number;
}

export type PlayerMotion = "idle" | "move" | "sprint" | "dodge" | "attack" | "heavy";
export type EnemyMotion = "idle" | "hit" | "dead";
export type AttackPhase = "idle" | "startup" | "active" | "recovery";
export type AttackKind = "light" | "heavy" | null;

export interface PlayerState {
  position: Vec2;
  yaw: number;
  health: number;
  maxHealth: number;
  stamina: number;
  maxStamina: number;
  motion: PlayerMotion;
  speed01: number;
  attackElapsed: number;
  attackFrame: number;
  attackPhase: AttackPhase;
  attackKind: AttackKind;
  attackSerial: number;
  attackHasHit: boolean;
  dodgeRemaining: number;
  dodgeDirection: Vec2;
  invulnerableRemaining: number;
}

export interface EnemyState {
  position: Vec2;
  verticalOffset: number;
  yaw: number;
  health: number;
  maxHealth: number;
  motion: EnemyMotion;
  hitStunRemaining: number;
  idlePhase: number;
}

export interface WorldState {
  tick: number;
  elapsed: number;
  player: PlayerState;
  enemy: EnemyState;
  objectiveComplete: boolean;
}

export interface InputFrame {
  moveX: number;
  moveZ: number;
  sprint: boolean;
  dodgePressed: boolean;
  attackPressed: boolean;
  heavyAttackPressed?: boolean;
  faceYaw?: number;
}

export type GameEvent =
  | {
      type: "attack-started";
      tick: number;
      attackSerial: number;
    }
  | {
      type: "attack-rejected-busy";
      tick: number;
      attackSerial: number;
    }
  | {
      type: "heavy-attack-started";
      tick: number;
      attackSerial: number;
    }
  | {
      type: "heavy-attack-rejected-busy";
      tick: number;
      attackSerial: number;
    }
  | {
      type: "heavy-contact";
      tick: number;
      attackSerial: number;
    }
  | {
      type: "heavy-damage";
      tick: number;
      damage: number;
      remainingHealth: number;
      attackSerial: number;
    }
  | {
      type: "enemy-hit";
      tick: number;
      damage: number;
      remainingHealth: number;
      attackSerial: number;
    }
  | {
      type: "enemy-defeated";
      tick: number;
      attackSerial: number;
    }
  | {
      type: "dodge-started";
      tick: number;
    };
