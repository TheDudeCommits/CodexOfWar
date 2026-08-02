import { FIXED_TIMESTEP, MAX_FRAME_DELTA, MAX_SUBSTEPS } from "./constants";

export class FixedStepClock {
  private accumulator = 0;

  reset(): void {
    this.accumulator = 0;
  }

  consume(realDelta: number, step: (dt: number) => void | boolean): number {
    this.accumulator += Math.min(Math.max(realDelta, 0), MAX_FRAME_DELTA);
    let substeps = 0;
    while (this.accumulator + Number.EPSILON >= FIXED_TIMESTEP && substeps < MAX_SUBSTEPS) {
      const continueStepping = step(FIXED_TIMESTEP);
      this.accumulator -= FIXED_TIMESTEP;
      substeps += 1;
      if (continueStepping === false) {
        this.accumulator = 0;
        break;
      }
    }
    if (substeps === MAX_SUBSTEPS) this.accumulator = Math.min(this.accumulator, FIXED_TIMESTEP);
    return this.accumulator / FIXED_TIMESTEP;
  }
}
