import type {
  HordeEnemyArchetype,
  HordeEnemyIntent,
  HordeUpgradeId,
  HordeWeaponId,
  HordeWeaponSlot,
} from "./types";

export const HORDE_FIXED_TIMESTEP = 1 / 60;
export const HORDE_MAX_WAVES = 5;
export const HORDE_DEFAULT_ARENA_RADIUS = 13.5;
export const HORDE_FORT_FRONT_Z = -4.86;
export const HORDE_PLAYER_RADIUS = 0.48;
export const HORDE_PLAYER_WALK_SPEED = 4.4;
export const HORDE_PLAYER_SPRINT_SPEED = 6.7;
export const HORDE_PLAYER_SPRINT_DRAIN_PER_TICK = 0.42;
export const HORDE_PLAYER_STAMINA_REGEN_PER_TICK = 0.52;
export const HORDE_DODGE_COST = 22;
export const HORDE_DODGE_DURATION_TICKS = 18;
export const HORDE_DODGE_INVULNERABLE_TICKS = 13;
export const HORDE_DODGE_SPEED = 10.8;
export const HORDE_PLAYER_HIT_STUN_TICKS = 14;
export const HORDE_BASE_WEAPON_DAMAGE = 28;
export const HORDE_COMBO_BASE_DURATION_TICKS = 210;
export const HORDE_COMBO_STEP = 0.25;
export const HORDE_COMBO_MAX_MULTIPLIER = 4;

export interface HordeStrikeDefinition {
  tick: number;
  damageMultiplier: number;
  range: number;
  halfArcRadians: number;
  maxTargets: number;
  radial: boolean;
  knockback: number;
  staggerTicks: number;
}

export interface HordeAttackDefinition {
  staminaCost: number;
  totalTicks: number;
  activeFirstTick: number;
  activeLastTick: number;
  strikes: readonly HordeStrikeDefinition[];
  dashSpeed: number;
  dashFirstTick: number;
  dashLastTick: number;
  movementControl: number;
}

export interface HordeSpecialDefinition extends HordeAttackDefinition {
  name: string;
  cooldownTicks: number;
}

export interface HordeWeaponDefinition {
  id: HordeWeaponId;
  slot: HordeWeaponSlot;
  label: string;
  identity: string;
  normal: HordeAttackDefinition;
  special: HordeSpecialDefinition;
}

const degrees = (value: number): number => (value * Math.PI) / 180;

export const HORDE_WEAPONS: Readonly<Record<HordeWeaponId, HordeWeaponDefinition>> = {
  katana: {
    id: "katana",
    slot: 1,
    label: "Storm Katana",
    identity: "Fast precision cuts; punishes enemies during telegraphs.",
    normal: {
      staminaCost: 10,
      totalTicks: 22,
      activeFirstTick: 7,
      activeLastTick: 8,
      strikes: [
        {
          tick: 7,
          damageMultiplier: 1,
          range: 2.75,
          halfArcRadians: degrees(38),
          maxTargets: 1,
          radial: false,
          knockback: 0.35,
          staggerTicks: 15,
        },
      ],
      dashSpeed: 2.8,
      dashFirstTick: 4,
      dashLastTick: 7,
      movementControl: 0,
    },
    special: {
      name: "Iaido Tempest",
      staminaCost: 28,
      cooldownTicks: 300,
      totalTicks: 40,
      activeFirstTick: 11,
      activeLastTick: 12,
      strikes: [
        {
          tick: 11,
          damageMultiplier: 2.55,
          range: 3.55,
          halfArcRadians: degrees(30),
          maxTargets: 3,
          radial: false,
          knockback: 1.1,
          staggerTicks: 36,
        },
      ],
      dashSpeed: 12.4,
      dashFirstTick: 3,
      dashLastTick: 11,
      movementControl: 0,
    },
  },
  greatsword: {
    id: "greatsword",
    slot: 2,
    label: "Grave Greatsword",
    identity: "Slow, expensive, wide cleaves with heavy stagger and knockback.",
    normal: {
      staminaCost: 25,
      totalTicks: 42,
      activeFirstTick: 15,
      activeLastTick: 18,
      strikes: [
        {
          tick: 16,
          damageMultiplier: 1.9,
          range: 3.35,
          halfArcRadians: degrees(82),
          maxTargets: 99,
          radial: false,
          knockback: 1.4,
          staggerTicks: 34,
        },
      ],
      dashSpeed: 2.2,
      dashFirstTick: 12,
      dashLastTick: 16,
      movementControl: 0,
    },
    special: {
      name: "Worldbreaker Quake",
      staminaCost: 40,
      cooldownTicks: 480,
      totalTicks: 68,
      activeFirstTick: 30,
      activeLastTick: 34,
      strikes: [
        {
          tick: 31,
          damageMultiplier: 3.15,
          range: 4.65,
          halfArcRadians: Math.PI,
          maxTargets: 99,
          radial: true,
          knockback: 2.5,
          staggerTicks: 60,
        },
      ],
      dashSpeed: 0,
      dashFirstTick: 0,
      dashLastTick: -1,
      movementControl: 0,
    },
  },
  "twin-blades": {
    id: "twin-blades",
    slot: 3,
    label: "Ember Twin Blades",
    identity: "Mobile two-hit strings and a sustained close-range whirlwind.",
    normal: {
      staminaCost: 16,
      totalTicks: 28,
      activeFirstTick: 6,
      activeLastTick: 14,
      strikes: [
        {
          tick: 6,
          damageMultiplier: 0.58,
          range: 2.35,
          halfArcRadians: degrees(58),
          maxTargets: 2,
          radial: false,
          knockback: 0.18,
          staggerTicks: 8,
        },
        {
          tick: 13,
          damageMultiplier: 0.72,
          range: 2.5,
          halfArcRadians: degrees(68),
          maxTargets: 3,
          radial: false,
          knockback: 0.32,
          staggerTicks: 12,
        },
      ],
      dashSpeed: 1.8,
      dashFirstTick: 3,
      dashLastTick: 13,
      movementControl: 0.38,
    },
    special: {
      name: "Cinder Whirlwind",
      staminaCost: 32,
      cooldownTicks: 360,
      totalTicks: 48,
      activeFirstTick: 6,
      activeLastTick: 32,
      strikes: [6, 11, 16, 21, 26, 31].map((tick, index) => ({
        tick,
        damageMultiplier: index === 5 ? 0.72 : 0.42,
        range: index === 5 ? 3 : 2.7,
        halfArcRadians: Math.PI,
        maxTargets: 99,
        radial: true,
        knockback: index === 5 ? 0.9 : 0.12,
        staggerTicks: index === 5 ? 24 : 6,
      })),
      dashSpeed: 0,
      dashFirstTick: 0,
      dashLastTick: -1,
      movementControl: 0.58,
    },
  },
};

export interface HordeEnemyDefinition {
  archetype: HordeEnemyArchetype;
  maxHealth: number;
  radius: number;
  speed: number;
  engageRange: number;
  attackRange: number;
  attackHalfArcRadians: number;
  windupTicks: number;
  attackTicks: number;
  hitTick: number;
  recoverTicks: number;
  damage: number;
  intent: Exclude<HordeEnemyIntent, "none">;
  score: number;
  essence: number;
}

export const HORDE_ENEMIES: Readonly<Record<HordeEnemyArchetype, HordeEnemyDefinition>> = {
  shambler: {
    archetype: "shambler",
    maxHealth: 72,
    radius: 0.54,
    speed: 1.65,
    engageRange: 1.55,
    attackRange: 1.9,
    attackHalfArcRadians: degrees(48),
    windupTicks: 34,
    attackTicks: 9,
    hitTick: 3,
    recoverTicks: 38,
    damage: 12,
    intent: "bite",
    score: 100,
    essence: 10,
  },
  stalker: {
    archetype: "stalker",
    maxHealth: 55,
    radius: 0.46,
    speed: 2.85,
    engageRange: 2.25,
    attackRange: 2.05,
    attackHalfArcRadians: degrees(36),
    windupTicks: 18,
    attackTicks: 13,
    hitTick: 6,
    recoverTicks: 25,
    damage: 10,
    intent: "pounce",
    score: 160,
    essence: 14,
  },
  brute: {
    archetype: "brute",
    maxHealth: 190,
    radius: 0.78,
    speed: 1.05,
    engageRange: 2.45,
    attackRange: 3.05,
    attackHalfArcRadians: degrees(105),
    windupTicks: 55,
    attackTicks: 12,
    hitTick: 5,
    recoverTicks: 58,
    damage: 28,
    intent: "slam",
    score: 320,
    essence: 26,
  },
};

export const HORDE_WAVES: readonly (readonly HordeEnemyArchetype[])[] = [
  ["shambler", "shambler", "shambler"],
  ["shambler", "shambler", "shambler", "stalker", "stalker"],
  ["shambler", "shambler", "stalker", "stalker", "brute"],
  ["shambler", "shambler", "shambler", "stalker", "stalker", "stalker", "brute"],
  ["shambler", "shambler", "shambler", "shambler", "stalker", "stalker", "stalker", "brute", "brute"],
];

export interface HordeUpgradeDefinition {
  id: HordeUpgradeId;
  label: string;
  description: string;
}

export const HORDE_UPGRADES: Readonly<Record<HordeUpgradeId, HordeUpgradeDefinition>> = {
  "tempered-edge": {
    id: "tempered-edge",
    label: "Tempered Edge",
    description: "+20% weapon damage.",
  },
  "vitality-surge": {
    id: "vitality-surge",
    label: "Vitality Surge",
    description: "+30 maximum health and heal 30.",
  },
  "deep-reserves": {
    id: "deep-reserves",
    label: "Deep Reserves",
    description: "+25 maximum stamina and refill it.",
  },
  "wind-runner": {
    id: "wind-runner",
    label: "Wind Runner",
    description: "+15% movement and dodge speed.",
  },
  "second-wind": {
    id: "second-wind",
    label: "Second Wind",
    description: "+35% stamina regeneration.",
  },
  "combo-keeper": {
    id: "combo-keeper",
    label: "Combo Keeper",
    description: "+90 ticks to the combo window.",
  },
  executioner: {
    id: "executioner",
    label: "Executioner",
    description: "+50% damage to enemies below 30% health.",
  },
  "soul-magnet": {
    id: "soul-magnet",
    label: "Soul Magnet",
    description: "+30% essence from kills.",
  },
  "battle-trance": {
    id: "battle-trance",
    label: "Battle Trance",
    description: "Heal 6 health after every kill.",
  },
};

export const HORDE_UPGRADE_POOL = Object.freeze(Object.keys(HORDE_UPGRADES) as HordeUpgradeId[]);

export const HORDE_WEAPON_BY_SLOT: Readonly<Record<HordeWeaponSlot, HordeWeaponId>> = {
  1: "katana",
  2: "greatsword",
  3: "twin-blades",
};
