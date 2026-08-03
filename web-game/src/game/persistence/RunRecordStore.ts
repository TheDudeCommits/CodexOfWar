export interface RunResult {
  score: number;
  wave: number;
  kills: number;
  victory: boolean;
}

export interface RunRecords {
  schema: "codex-of-war.run-records.v1";
  bestScore: number;
  bestWave: number;
  bestKills: number;
  victories: number;
  totalRuns: number;
  totalKills: number;
}

const STORAGE_KEY = "codex-of-war.run-records.v1";

export const EMPTY_RUN_RECORDS: RunRecords = Object.freeze({
  schema: "codex-of-war.run-records.v1",
  bestScore: 0,
  bestWave: 0,
  bestKills: 0,
  victories: 0,
  totalRuns: 0,
  totalKills: 0,
});

function safeInteger(value: unknown): number | null {
  return Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : null;
}

export function parseRunRecords(raw: string | null): RunRecords {
  if (!raw) return { ...EMPTY_RUN_RECORDS };
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (value.schema !== EMPTY_RUN_RECORDS.schema) return { ...EMPTY_RUN_RECORDS };
    const bestScore = safeInteger(value.bestScore);
    const bestWave = safeInteger(value.bestWave);
    const bestKills = safeInteger(value.bestKills);
    const victories = safeInteger(value.victories);
    const totalRuns = safeInteger(value.totalRuns);
    const totalKills = safeInteger(value.totalKills);
    if (
      bestScore === null ||
      bestWave === null ||
      bestKills === null ||
      victories === null ||
      totalRuns === null ||
      totalKills === null ||
      victories > totalRuns ||
      bestKills > totalKills
    ) {
      return { ...EMPTY_RUN_RECORDS };
    }
    return {
      schema: EMPTY_RUN_RECORDS.schema,
      bestScore,
      bestWave,
      bestKills,
      victories,
      totalRuns,
      totalKills,
    };
  } catch {
    return { ...EMPTY_RUN_RECORDS };
  }
}

export function applyRunResult(records: RunRecords, result: RunResult): RunRecords {
  const score = safeInteger(result.score);
  const wave = safeInteger(result.wave);
  const kills = safeInteger(result.kills);
  if (score === null || wave === null || kills === null) {
    throw new Error("Run result values must be non-negative safe integers");
  }
  return {
    schema: EMPTY_RUN_RECORDS.schema,
    bestScore: Math.max(records.bestScore, score),
    bestWave: Math.max(records.bestWave, wave),
    bestKills: Math.max(records.bestKills, kills),
    victories: records.victories + Number(result.victory),
    totalRuns: records.totalRuns + 1,
    totalKills: records.totalKills + kills,
  };
}

export class RunRecordStore {
  constructor(private readonly storage: Pick<Storage, "getItem" | "setItem"> = localStorage) {}

  load(): RunRecords {
    return parseRunRecords(this.storage.getItem(STORAGE_KEY));
  }

  record(result: RunResult): RunRecords {
    const next = applyRunResult(this.load(), result);
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // A private/blocked storage context must not break the run end-state.
    }
    return next;
  }
}
