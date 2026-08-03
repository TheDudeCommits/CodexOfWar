export interface HordeVec2 {
  x: number;
  z: number;
}

export type HordeRunPhase = "combat" | "upgrade" | "defeat" | "victory";
export type HordeWeaponId = "katana" | "greatsword" | "twin-blades";
export type HordeWeaponSlot = 1 | 2 | 3;
export type HordeEnemyArchetype = "shambler" | "stalker" | "brute";
export type HordeEnemyPhase =
  | "pursue"
  | "flank"
  | "windup"
  | "attack"
  | "recover"
  | "hit"
  | "dead";
export type HordeEnemyIntent = "none" | "bite" | "pounce" | "slam";
export type HordeAttackPhase = "idle" | "startup" | "active" | "recovery";
export type HordePlayerMotion =
  | "idle"
  | "move"
  | "sprint"
  | "dodge"
  | "attack"
  | "special"
  | "hit"
  | "dead"
  | "victory";
export type HordePlayerActionKind = "none" | "normal" | "special";

export type HordeUpgradeId =
  | "tempered-edge"
  | "vitality-surge"
  | "deep-reserves"
  | "wind-runner"
  | "second-wind"
  | "combo-keeper"
  | "executioner"
  | "soul-magnet"
  | "battle-trance";

export interface HordeSpecialCooldowns {
  katana: number;
  greatsword: number;
  "twin-blades": number;
}

export interface HordePlayerStats {
  damageMultiplier: number;
  movementMultiplier: number;
  staminaRegenMultiplier: number;
  comboWindowBonusTicks: number;
  executionDamageMultiplier: number;
  essenceMultiplier: number;
  healOnKill: number;
}

export interface HordePlayerActionState {
  kind: HordePlayerActionKind;
  phase: HordeAttackPhase;
  elapsedTicks: number;
  durationTicks: number;
  progress01: number;
  serial: number;
  hitKeys: string[];
  facingYaw: number;
}

export interface HordePlayerState {
  position: HordeVec2;
  velocity: HordeVec2;
  yaw: number;
  health: number;
  maxHealth: number;
  stamina: number;
  maxStamina: number;
  motion: HordePlayerMotion;
  speed01: number;
  invulnerableTicksRemaining: number;
  dodgeTicksRemaining: number;
  dodgeTicksTotal: number;
  dodgeDirection: HordeVec2;
  hitStunTicksRemaining: number;
  selectedWeapon: HordeWeaponId;
  lockedTargetId: number | null;
  action: HordePlayerActionState;
  specialCooldowns: HordeSpecialCooldowns;
  stats: HordePlayerStats;
}

export interface HordeEnemyState {
  id: number;
  archetype: HordeEnemyArchetype;
  position: HordeVec2;
  velocity: HordeVec2;
  yaw: number;
  health: number;
  maxHealth: number;
  radius: number;
  phase: HordeEnemyPhase;
  intent: HordeEnemyIntent;
  phaseElapsedTicks: number;
  phaseDurationTicks: number;
  phaseProgress01: number;
  attackSerial: number;
  attackHasResolved: boolean;
  orbitSign: -1 | 1;
  staggerTicksRemaining: number;
  spawnWave: number;
}

export interface HordeComboState {
  count: number;
  multiplier: number;
  ticksRemaining: number;
  durationTicks: number;
}

export interface HordeRunState {
  schemaVersion: 1;
  seed: number;
  rngState: number;
  tick: number;
  elapsedSeconds: number;
  phase: HordeRunPhase;
  wave: number;
  maxWaves: number;
  arenaRadius: number;
  initialPlayerPosition: HordeVec2;
  player: HordePlayerState;
  enemies: HordeEnemyState[];
  score: number;
  kills: number;
  essence: number;
  combo: HordeComboState;
  upgradeChoices: HordeUpgradeId[];
  appliedUpgrades: HordeUpgradeId[];
  nextEnemyId: number;
  nextEventId: number;
}

export interface HordeInputFrame {
  moveX: number;
  moveZ: number;
  sprint: boolean;
  dodgePressed: boolean;
  attackPressed: boolean;
  specialPressed: boolean;
  weaponSlot1Pressed: boolean;
  weaponSlot2Pressed: boolean;
  weaponSlot3Pressed: boolean;
  upgradeChoice?: 0 | 1 | 2;
  restartPressed: boolean;
  faceYaw?: number;
  lockTargetId?: number | null;
}

export interface HordeLockCandidate {
  enemyId: number;
  archetype: HordeEnemyArchetype;
  position: HordeVec2;
  distance: number;
  angleFromFacing: number;
  score: number;
}

interface HordeEventBase {
  id: number;
  tick: number;
}

export type HordeGameEvent =
  | (HordeEventBase & {
      type: "wave-started";
      wave: number;
      enemyCount: number;
    })
  | (HordeEventBase & {
      type: "weapon-switched";
      weapon: HordeWeaponId;
      slot: HordeWeaponSlot;
    })
  | (HordeEventBase & {
      type: "attack-started";
      weapon: HordeWeaponId;
      attackSerial: number;
      staminaCost: number;
    })
  | (HordeEventBase & {
      type: "attack-rejected";
      weapon: HordeWeaponId;
      reason: "busy" | "stamina" | "inactive";
    })
  | (HordeEventBase & {
      type: "special-started";
      weapon: HordeWeaponId;
      attackSerial: number;
      staminaCost: number;
      cooldownTicks: number;
    })
  | (HordeEventBase & {
      type: "special-rejected";
      weapon: HordeWeaponId;
      reason: "busy" | "cooldown" | "stamina" | "inactive";
    })
  | (HordeEventBase & {
      type: "dodge-started";
      staminaCost: number;
      invulnerableTicks: number;
    })
  | (HordeEventBase & {
      type: "enemy-telegraph";
      enemyId: number;
      archetype: HordeEnemyArchetype;
      intent: Exclude<HordeEnemyIntent, "none">;
      attackSerial: number;
      resolveInTicks: number;
    })
  | (HordeEventBase & {
      type: "enemy-attack-hit";
      enemyId: number;
      archetype: HordeEnemyArchetype;
      attackSerial: number;
      damage: number;
      remainingHealth: number;
    })
  | (HordeEventBase & {
      type: "enemy-attack-evaded";
      enemyId: number;
      archetype: HordeEnemyArchetype;
      attackSerial: number;
    })
  | (HordeEventBase & {
      type: "enemy-attack-missed";
      enemyId: number;
      archetype: HordeEnemyArchetype;
      attackSerial: number;
    })
  | (HordeEventBase & {
      type: "enemy-hit";
      enemyId: number;
      archetype: HordeEnemyArchetype;
      weapon: HordeWeaponId;
      special: boolean;
      strikeIndex: number;
      damage: number;
      remainingHealth: number;
      attackSerial: number;
    })
  | (HordeEventBase & {
      type: "enemy-defeated";
      enemyId: number;
      archetype: HordeEnemyArchetype;
      weapon: HordeWeaponId;
      scoreAwarded: number;
      essenceAwarded: number;
      comboMultiplier: number;
    })
  | (HordeEventBase & {
      type: "combo-broken";
      previousCount: number;
      reason: "timeout" | "player-hit";
    })
  | (HordeEventBase & {
      type: "wave-cleared";
      wave: number;
      score: number;
    })
  | (HordeEventBase & {
      type: "upgrade-offered";
      wave: number;
      choices: HordeUpgradeId[];
    })
  | (HordeEventBase & {
      type: "upgrade-selected";
      upgrade: HordeUpgradeId;
      choiceIndex: 0 | 1 | 2;
    })
  | (HordeEventBase & {
      type: "player-defeated";
      wave: number;
      score: number;
    })
  | (HordeEventBase & {
      type: "run-victory";
      score: number;
      kills: number;
      essence: number;
    })
  | (HordeEventBase & {
      type: "run-restarted";
      seed: number;
    });

export interface HordeSimulationOptions {
  seed?: number;
  playerPosition?: HordeVec2;
  arenaRadius?: number;
}
