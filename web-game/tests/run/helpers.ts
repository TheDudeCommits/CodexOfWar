import {
  createHordeEnemyState,
  EMPTY_HORDE_INPUT,
  HordeSimulation,
  type HordeEnemyArchetype,
  type HordeEnemyState,
  type HordeGameEvent,
  type HordeInputFrame,
  type HordeVec2,
} from "../../src/game/run";

export const frame = (overrides: Partial<HordeInputFrame> = {}): HordeInputFrame => ({
  ...EMPTY_HORDE_INPUT,
  ...overrides,
});

export function stepTicks(
  simulation: HordeSimulation,
  ticks: number,
  input: HordeInputFrame = frame(),
): HordeGameEvent[] {
  const events: HordeGameEvent[] = [];
  for (let tick = 0; tick < ticks; tick += 1) {
    simulation.step(input);
    events.push(...simulation.consumeEvents());
  }
  return events;
}

export function stepUntil(
  simulation: HordeSimulation,
  predicate: (event: HordeGameEvent) => boolean,
  maximumTicks = 1000,
  input: HordeInputFrame = frame(),
): HordeGameEvent {
  for (let tick = 0; tick < maximumTicks; tick += 1) {
    simulation.step(input);
    const events = simulation.consumeEvents();
    const match = events.find(predicate);
    if (match) return match;
  }
  throw new Error(`Expected Horde Run event did not occur within ${maximumTicks} ticks.`);
}

export function passiveEnemy(
  id: number,
  archetype: HordeEnemyArchetype,
  position: HordeVec2,
  health = 2000,
): HordeEnemyState {
  const enemy = createHordeEnemyState(id, archetype, position);
  enemy.health = health;
  enemy.maxHealth = health;
  enemy.phase = "recover";
  enemy.phaseDurationTicks = 100_000;
  enemy.phaseElapsedTicks = 0;
  return enemy;
}

export function freshSimulation(seed = 1234): HordeSimulation {
  const simulation = new HordeSimulation({ seed });
  simulation.consumeEvents();
  return simulation;
}
