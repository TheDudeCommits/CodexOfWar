export const FIXED_TIMESTEP = 1 / 60;
export const MAX_FRAME_DELTA = 0.1;
export const MAX_SUBSTEPS = 6;

export const PLAYER_WALK_SPEED = 4.15;
export const PLAYER_SPRINT_SPEED = 6.65;
export const PLAYER_DODGE_SPEED = 12.4;
export const PLAYER_DODGE_DURATION = 0.31;
export const PLAYER_DODGE_COST = 26;
export const PLAYER_SPRINT_DRAIN = 22;
export const PLAYER_STAMINA_REGEN = 18;
export const ARENA_PLAY_RADIUS = 10.4;

export const ATTACK_STARTUP_LAST_FRAME = 7;
export const ATTACK_ACTIVE_FIRST_FRAME = 8;
export const ATTACK_ACTIVE_LAST_FRAME = 11;
export const ATTACK_HIT_FRAME = 9;
export const ATTACK_RECOVERY_LAST_FRAME = 25;
export const ATTACK_DURATION = (ATTACK_RECOVERY_LAST_FRAME + 1) * FIXED_TIMESTEP;
export const ATTACK_RANGE = 2.25;
export const ATTACK_HALF_ANGLE = Math.PI * 0.46;
export const ATTACK_DAMAGE = 34;

export const HEAVY_CONTACT_DAMAGE = 25;
export const HEAVY_ACTIVE_FIRST_RELATIVE_TICK = 22;
export const HEAVY_ACTIVE_LAST_RELATIVE_TICK = 23;
export const HEAVY_NEUTRAL_RELATIVE_TICK = 50;

export interface SimulationTuning {
  walkSpeed: number;
  sprintSpeed: number;
  attackDamage: number;
  attackRange: number;
}

export const LIVE_TUNING: SimulationTuning = {
  walkSpeed: PLAYER_WALK_SPEED,
  sprintSpeed: PLAYER_SPRINT_SPEED,
  attackDamage: ATTACK_DAMAGE,
  attackRange: ATTACK_RANGE,
};

export const P30_REVIEW_TUNING: SimulationTuning = {
  walkSpeed: 3,
  sprintSpeed: 5,
  attackDamage: 10,
  attackRange: 2.05,
};
