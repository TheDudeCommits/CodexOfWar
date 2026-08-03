export const P30_PROTOCOL_ID = "P30-R012A-BLIND-v1" as const;
export const P30_RUNTIME_HOOK_SCHEMA = "p30.r012a.runtime-hook.v1" as const;
export const P30_SNAPSHOT_SCHEMA = "p30.r012a.snapshot.v1" as const;
export const P30_RUN_RECEIPT_SCHEMA = "p30.r012a.run-receipt.v1" as const;
export const P30_RESOURCE_RECEIPT_SCHEMA = "p30.r012a.resource-receipt.v1" as const;
export const P30_SCENARIO_ID = "P30-heavy-strike-v1" as const;
export const P30_SCENARIO_SEED = 30012 as const;
export const P30_HEAVY_RISING_EDGE_ABSOLUTE_TICK = 24 as const;
export const P30_FIXED_DELTA_NUMERATOR = 1 as const;
export const P30_FIXED_DELTA_DENOMINATOR = 60 as const;
export const P30_FIXED_DELTA =
  P30_FIXED_DELTA_NUMERATOR / P30_FIXED_DELTA_DENOMINATOR;

export type P30TargetOffsetMicrometres = readonly [number, number, number];

export interface P30ResetOptions {
  seed: typeof P30_SCENARIO_SEED;
  targetOffsetMicrometres: P30TargetOffsetMicrometres;
}

export function assertP30ResetOptions(
  value: P30ResetOptions,
): asserts value is P30ResetOptions {
  if (!value || value.seed !== P30_SCENARIO_SEED) {
    throw new Error(`P30 critic reset requires seed ${P30_SCENARIO_SEED}`);
  }
  const offset = value.targetOffsetMicrometres;
  if (!Array.isArray(offset) || offset.length !== 3) {
    throw new Error("targetOffsetMicrometres must contain exactly [right, up, forward]");
  }
  for (const component of offset) {
    if (!Number.isSafeInteger(component)) {
      throw new Error(
        `targetOffsetMicrometres components must be signed safe integers: ${String(component)}`,
      );
    }
  }
}

export function isP30CriticScenarioRoute(location: Location = window.location): boolean {
  const params = new URLSearchParams(location.search);
  return params.get("scenario") === P30_SCENARIO_ID &&
    params.get("seed") === String(P30_SCENARIO_SEED) &&
    params.get("review") !== "1" &&
    !params.has("capture");
}
