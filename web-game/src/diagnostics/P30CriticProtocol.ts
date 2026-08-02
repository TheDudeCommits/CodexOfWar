export const P30_SCENARIO_ID = "P30-light-strike-v1" as const;
export const P30_SCENARIO_SEED = 30011 as const;
export const P30_ATTACK_EDGE_ABSOLUTE_TICK = 24 as const;
export const P30_FIXED_DELTA = 1 / 60;

export function isP30CriticScenarioRoute(location: Location = window.location): boolean {
  const params = new URLSearchParams(location.search);
  return params.get("scenario") === P30_SCENARIO_ID &&
    params.get("seed") === String(P30_SCENARIO_SEED) &&
    params.get("review") !== "1" &&
    !params.has("capture");
}
