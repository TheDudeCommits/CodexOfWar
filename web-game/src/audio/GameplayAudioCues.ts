import type { HordeGameEvent, HordeWeaponId } from "../game/run";
import type { GameEvent } from "../game/simulation/types";

export type GameplayAudioCue =
  | `attack-${HordeWeaponId}-normal`
  | `attack-${HordeWeaponId}-special`
  | `impact-${HordeWeaponId}`
  | `weapon-switch-${HordeWeaponId}`
  | "player-dodge"
  | "enemy-bite-windup"
  | "enemy-bite-contact"
  | "enemy-pounce-windup"
  | "enemy-pounce-contact"
  | "enemy-slam-windup"
  | "enemy-slam-contact"
  | "enemy-death"
  | "player-damage"
  | "upgrade-selected"
  | "wave-cleared"
  | "run-victory"
  | "run-defeat"
  | "legacy-impact";

const EMPTY_CUES: readonly GameplayAudioCue[] = Object.freeze([]);

export function audioCuesForHordeEvent(
  event: HordeGameEvent,
): readonly GameplayAudioCue[] {
  switch (event.type) {
    case "weapon-switched":
      return [`weapon-switch-${event.weapon}`];
    case "attack-started":
      return [`attack-${event.weapon}-normal`];
    case "special-started":
      return [`attack-${event.weapon}-special`];
    case "dodge-started":
      return ["player-dodge"];
    case "enemy-telegraph":
      return [`enemy-${event.intent}-windup`];
    case "enemy-attack-hit":
      return [
        event.archetype === "brute"
          ? "enemy-slam-contact"
          : event.archetype === "stalker"
            ? "enemy-pounce-contact"
            : "enemy-bite-contact",
        "player-damage",
      ];
    case "enemy-hit":
      return [`impact-${event.weapon}`];
    case "enemy-defeated":
      return ["enemy-death"];
    case "wave-cleared":
      return ["wave-cleared"];
    case "upgrade-selected":
      return ["upgrade-selected"];
    case "player-defeated":
      return ["run-defeat"];
    case "run-victory":
      return ["run-victory"];
    default:
      return EMPTY_CUES;
  }
}

export function audioCuesForLegacyEvent(
  event: GameEvent,
): readonly GameplayAudioCue[] {
  switch (event.type) {
    case "attack-started":
      return ["attack-greatsword-normal"];
    case "dodge-started":
      return ["player-dodge"];
    case "enemy-hit":
      return ["legacy-impact"];
    case "enemy-defeated":
      return ["enemy-death", "run-victory"];
    default:
      return EMPTY_CUES;
  }
}

export function collectHordeAudioCues(
  events: readonly HordeGameEvent[],
): GameplayAudioCue[] {
  return events.flatMap(audioCuesForHordeEvent);
}

export function collectLegacyAudioCues(
  events: readonly GameEvent[],
): GameplayAudioCue[] {
  return events.flatMap(audioCuesForLegacyEvent);
}
