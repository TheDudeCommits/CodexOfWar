import { describe, expect, it } from "vitest";
import {
  applyRunResult,
  EMPTY_RUN_RECORDS,
  parseRunRecords,
  RunRecordStore,
} from "../../src/game/persistence/RunRecordStore";

describe("RunRecordStore", () => {
  it("records personal bests and lifetime totals without lowering records", () => {
    const first = applyRunResult(EMPTY_RUN_RECORDS, {
      score: 4200,
      wave: 3,
      kills: 18,
      victory: false,
    });
    const second = applyRunResult(first, {
      score: 3900,
      wave: 5,
      kills: 15,
      victory: true,
    });
    expect(second).toMatchObject({
      bestScore: 4200,
      bestWave: 5,
      bestKills: 18,
      victories: 1,
      totalRuns: 2,
      totalKills: 33,
    });
  });

  it("fails closed on corrupt, negative, or internally impossible data", () => {
    expect(parseRunRecords("not-json")).toEqual(EMPTY_RUN_RECORDS);
    expect(parseRunRecords(JSON.stringify({
      ...EMPTY_RUN_RECORDS,
      bestScore: -1,
    }))).toEqual(EMPTY_RUN_RECORDS);
    expect(parseRunRecords(JSON.stringify({
      ...EMPTY_RUN_RECORDS,
      victories: 2,
      totalRuns: 1,
    }))).toEqual(EMPTY_RUN_RECORDS);
  });

  it("keeps gameplay alive when persistence writes are blocked", () => {
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("blocked");
      },
    };
    const records = new RunRecordStore(storage).record({
      score: 900,
      wave: 1,
      kills: 4,
      victory: false,
    });
    expect(records.totalRuns).toBe(1);
    expect(records.bestScore).toBe(900);
  });
});
