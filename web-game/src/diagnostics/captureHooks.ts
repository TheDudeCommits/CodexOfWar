import type { RuntimeMetrics } from "./PerfDiagnostics";
import type { InputFrame, WorldState } from "../game/simulation/types";
import type { GameApp } from "../render/app/GameApp";

export interface GauntletHarness {
  version: "0.1.0";
  ready: true;
  fixedTimestep: number;
  manifestVersion: number | null;
  getAssetLoadReceipt: () => ReturnType<GameApp["getAssetLoadReceipt"]>;
  getSnapshot: () => WorldState;
  getMetrics: () => RuntimeMetrics;
  stepFrames: (frames: number, input?: Partial<InputFrame>) => WorldState;
  runScenario: (name: "overview" | "combat" | "victory" | "judge") => WorldState;
  capturePng: () => string;
  setPostProcessing: (enabled: boolean) => void;
}

declare global {
  interface Window {
    __GAUNTLET__: GauntletHarness;
  }
}

export function installCaptureHooks(app: GameApp): GauntletHarness {
  const harness: GauntletHarness = {
    version: "0.1.0",
    ready: true,
    fixedTimestep: 1 / 60,
    manifestVersion: app.assetManifestVersion,
    getAssetLoadReceipt: () => app.getAssetLoadReceipt(),
    getSnapshot: () => app.getSnapshot(),
    getMetrics: () => app.getMetrics(),
    stepFrames: (frames, input = {}) => {
      app.stepDeterministic(frames, input);
      return app.getSnapshot();
    },
    runScenario: (name) => {
      app.runCaptureScenario(name);
      return app.getSnapshot();
    },
    capturePng: () => app.capturePng(),
    setPostProcessing: (enabled) => app.setPostProcessing(enabled),
  };
  window.__GAUNTLET__ = harness;
  document.documentElement.dataset.gameReady = "true";
  return harness;
}
