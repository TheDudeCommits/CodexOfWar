import {
  HORDE_FIXED_TIMESTEP,
  HORDE_UPGRADES,
  HORDE_WEAPON_BY_SLOT,
  HORDE_WEAPONS,
  type HordeEnemyArchetype,
  type HordeEnemyState,
  type HordeGameEvent,
  type HordeRunState,
} from "../../game/run";
import type { PlayerState } from "../../game/simulation/types";
import type {
  RunHudEvent,
  RunHudMode,
  RunHudModel,
  RunHudQuickSlots,
  RunHudUpgradeChoices,
} from "../../ui/RunHud";
import type { EnemyFieldEntityState } from "../objects/EnemyFieldView";
import type { WeaponLoadoutPresentation } from "../objects/WeaponLoadoutView";

const ARCHETYPE_NAMES: Readonly<Record<HordeEnemyArchetype, string>> = {
  shambler: "Ash Shambler",
  stalker: "Veil Stalker",
  brute: "Grave Brute",
};

export function toLegacyPlayerState(state: HordeRunState): PlayerState {
  const player = state.player;
  const attacking = player.action.kind !== "none";
  const attackPhase = attacking ? player.action.phase : "idle";
  const attackFrame = attacking ? Math.round(player.action.progress01 * 25) : -1;
  const motion: PlayerState["motion"] =
    player.motion === "move" ||
    player.motion === "sprint" ||
    player.motion === "dodge" ||
    player.motion === "attack"
      ? player.motion
      : player.motion === "special"
        ? "attack"
        : "idle";

  return {
    position: { ...player.position },
    yaw: player.yaw,
    health: player.health,
    maxHealth: player.maxHealth,
    stamina: player.stamina,
    maxStamina: player.maxStamina,
    motion,
    speed01: player.speed01,
    attackElapsed: attacking ? player.action.elapsedTicks * HORDE_FIXED_TIMESTEP : 0,
    attackFrame,
    attackPhase,
    attackSerial: player.action.serial,
    attackHasHit: player.action.hitKeys.length > 0,
    dodgeRemaining: player.dodgeTicksRemaining * HORDE_FIXED_TIMESTEP,
    dodgeDirection: { ...player.dodgeDirection },
    invulnerableRemaining: player.invulnerableTicksRemaining * HORDE_FIXED_TIMESTEP,
  };
}

export function toEnemyFieldEntity(enemy: HordeEnemyState): EnemyFieldEntityState {
  const dead = enemy.phase === "dead" || enemy.health <= 0;
  const motion: EnemyFieldEntityState["motion"] = dead
    ? "dead"
    : enemy.phase === "hit"
      ? "hit"
      : enemy.phase === "windup" || enemy.phase === "attack"
        ? "attack"
        : enemy.phase === "pursue" || enemy.phase === "flank"
          ? "move"
          : "idle";
  return {
    id: String(enemy.id),
    archetype: enemy.archetype,
    position: { ...enemy.position },
    yaw: enemy.yaw,
    health: enemy.health,
    maxHealth: enemy.maxHealth,
    phase: dead ? "dying" : "active",
    motion,
    telegraph01: enemy.phase === "windup" ? enemy.phaseProgress01 : 0,
    alive: !dead,
    hitPulse01:
      enemy.phase === "hit" && enemy.phaseDurationTicks > 0
        ? 1 - enemy.phaseProgress01
        : 0,
  };
}

export function toWeaponLoadoutPresentation(state: HordeRunState): WeaponLoadoutPresentation {
  const weapon = HORDE_WEAPONS[state.player.selectedWeapon];
  const cooldown = state.player.specialCooldowns[state.player.selectedWeapon];
  return {
    activeWeapon: state.player.selectedWeapon,
    specialCooldown01: cooldown / weapon.special.cooldownTicks,
    specialActive01:
      state.player.action.kind === "special" ? 1 - state.player.action.progress01 : 0,
    elapsed: state.elapsedSeconds,
  };
}

export function hordeEventToHudEvent(event: HordeGameEvent): RunHudEvent | null {
  const id = `horde-${event.id}`;
  switch (event.type) {
    case "wave-started":
      return { id, text: `Wave ${event.wave} · ${event.enemyCount} hostiles`, tone: "danger" };
    case "weapon-switched":
      return { id, text: `${HORDE_WEAPONS[event.weapon].label} drawn` };
    case "special-started":
      return { id, text: HORDE_WEAPONS[event.weapon].special.name, tone: "reward" };
    case "enemy-telegraph":
      return {
        id,
        text: `${ARCHETYPE_NAMES[event.archetype]} prepares ${event.intent}`,
        tone: "danger",
      };
    case "enemy-attack-hit":
      return { id, text: `${event.damage} damage taken`, tone: "danger" };
    case "enemy-attack-evaded":
      return { id, text: "Perfect evade", tone: "reward" };
    case "enemy-defeated":
      return {
        id,
        text: `+${event.scoreAwarded} · ${ARCHETYPE_NAMES[event.archetype]} felled`,
        tone: "reward",
      };
    case "combo-broken":
      return { id, text: `Combo broken · ${event.previousCount} hits`, tone: "danger" };
    case "wave-cleared":
      return { id, text: `Wave ${event.wave} purged`, tone: "reward" };
    case "upgrade-selected":
      return { id, text: `${HORDE_UPGRADES[event.upgrade].label} awakened`, tone: "reward" };
    case "player-defeated":
      return { id, text: "The horde prevails", tone: "danger" };
    case "run-victory":
      return { id, text: "Horde broken", tone: "reward" };
    default:
      return null;
  }
}

const QUICK_SLOTS: RunHudQuickSlots = ([1, 2, 3] as const).map((slot) => {
  const id = HORDE_WEAPON_BY_SLOT[slot];
  const weapon = HORDE_WEAPONS[id];
  return { id, name: weapon.label, shortName: weapon.label.replace(/^(Storm|Grave|Ember) /, "") };
}) as unknown as RunHudQuickSlots;

function upgradeChoices(state: HordeRunState): RunHudUpgradeChoices {
  if (state.upgradeChoices.length !== 3) {
    throw new Error("Horde upgrade phase requires exactly three choices");
  }
  return state.upgradeChoices.map((id) => ({
    id,
    name: HORDE_UPGRADES[id].label,
    description: HORDE_UPGRADES[id].description,
    tag: "AWAKENING",
  })) as unknown as RunHudUpgradeChoices;
}

function deriveMode(state: HordeRunState, paused: boolean): RunHudMode {
  if (paused && state.phase === "combat") return { kind: "paused" };
  if (state.phase === "upgrade") {
    return { kind: "upgrade", waveCleared: state.wave, choices: upgradeChoices(state) };
  }
  if (state.phase === "defeat") return { kind: "defeat" };
  if (state.phase === "victory") return { kind: "victory" };
  return { kind: "playing" };
}

export function toRunHudModel(
  state: HordeRunState,
  paused: boolean,
  events: readonly RunHudEvent[],
  awaitingEngagement = false,
): RunHudModel {
  const player = state.player;
  const weapon = HORDE_WEAPONS[player.selectedWeapon];
  const cooldownTicks = player.specialCooldowns[player.selectedWeapon];
  const locked = player.lockedTargetId === null
    ? undefined
    : state.enemies.find((enemy) => enemy.id === player.lockedTargetId && enemy.health > 0);
  const objective = state.phase === "combat"
    ? awaitingEngagement
      ? "Move, lock, or strike to begin the horde."
      : "Purge the horde. Read the rings. Dodge on impact."
    : state.phase === "upgrade"
      ? "Choose one awakening for the next wave."
      : state.phase === "victory"
        ? "The horde is broken."
        : "Rise and challenge the horde again.";

  return {
    player: {
      health: { current: player.health, maximum: player.maxHealth },
      stamina: { current: player.stamina, maximum: player.maxStamina },
    },
    wave: state.wave,
    totalWaves: state.maxWaves,
    enemiesRemaining: state.enemies.filter((enemy) => enemy.phase !== "dead" && enemy.health > 0).length,
    score: state.score,
    comboMultiplier: state.combo.multiplier,
    kills: state.kills,
    essence: state.essence,
    objective,
    activeWeaponId: player.selectedWeapon,
    quickSlots: QUICK_SLOTS,
    signatureAbility: {
      name: weapon.special.name,
      status: state.phase !== "combat" ? "disabled" : cooldownTicks > 0 ? "cooldown" : "ready",
      cooldownRemainingSeconds: cooldownTicks * HORDE_FIXED_TIMESTEP,
      cooldownDurationSeconds: weapon.special.cooldownTicks * HORDE_FIXED_TIMESTEP,
      inputLabel: "RMB / K",
    },
    ...(locked
      ? {
          lockedTarget: {
            name: ARCHETYPE_NAMES[locked.archetype],
            health: { current: locked.health, maximum: locked.maxHealth },
            elite: locked.archetype === "brute",
          },
        }
      : {}),
    events,
    firstUseControls: [
      { id: "move", input: "WASD", action: "MOVE" },
      { id: "strike", input: "LMB / J", action: "STRIKE" },
      { id: "dodge", input: "SPACE", action: "DODGE" },
      { id: "special", input: "RMB / K", action: "SIGNATURE" },
      { id: "lock", input: "Q", action: "LOCK" },
    ],
    mode: deriveMode(state, paused),
  };
}
