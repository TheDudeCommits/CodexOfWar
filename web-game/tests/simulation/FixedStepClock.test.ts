import { describe, expect, it } from "vitest";
import { FIXED_TIMESTEP } from "../../src/game/simulation/constants";
import { FixedStepClock } from "../../src/game/simulation/FixedStepClock";

describe("FixedStepClock", () => {
  it("produces the same sixty ticks from different render cadences", () => {
    const run = (frameDelta: number, frameCount: number): number => {
      const clock = new FixedStepClock();
      let ticks = 0;
      for (let frame = 0; frame < frameCount; frame += 1) {
        clock.consume(frameDelta, () => {
          ticks += 1;
        });
      }
      return ticks;
    };
    expect(run(FIXED_TIMESTEP, 60)).toBe(60);
    expect(run(FIXED_TIMESTEP * 2, 30)).toBe(60);
  });

  it("caps runaway catch-up work", () => {
    const clock = new FixedStepClock();
    let ticks = 0;
    clock.consume(10, () => {
      ticks += 1;
    });
    expect(ticks).toBeLessThanOrEqual(6);
  });

  it("stops with zero interpolation when a capture update requests a pause", () => {
    const clock = new FixedStepClock();
    let ticks = 0;
    const alpha = clock.consume(FIXED_TIMESTEP * 4, () => {
      ticks += 1;
      return false;
    });
    expect(ticks).toBe(1);
    expect(alpha).toBe(0);
  });
});
