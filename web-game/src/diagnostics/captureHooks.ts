import type { RuntimeMetrics } from "./PerfDiagnostics";
import type { HordeRunState } from "../game/run";
import type { InputFrame, WorldState } from "../game/simulation/types";
import type { GameApp } from "../render/app/GameApp";
import type { EnemyFieldSnapshot } from "../render/objects/EnemyFieldView";

export interface GauntletHarness {
  version: "0.1.0";
  ready: true;
  fixedTimestep: number;
  manifestVersion: number | null;
  mode: "horde" | "legacy";
  legacyCaptureAvailable: boolean;
  getAssetLoadReceipt: () => ReturnType<GameApp["getAssetLoadReceipt"]>;
  getSnapshot: () => WorldState | HordeRunState;
  getHordeSnapshot: () => HordeRunState;
  getEnemyFieldSnapshot: () => EnemyFieldSnapshot;
  getCameraTelemetry: () => ReturnType<GameApp["getCameraTelemetry"]>;
  getInputCaptureTelemetry: () => ReturnType<GameApp["getInputCaptureTelemetry"]>;
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
  const requireLegacyCapture = (): void => {
    if (app.isHordeRunMode) {
      throw new Error(
        "Legacy deterministic capture operations are unavailable in Horde mode. Use getSnapshot() or getHordeSnapshot() for the live run.",
      );
    }
  };
  const harness: GauntletHarness = {
    version: "0.1.0",
    ready: true,
    fixedTimestep: 1 / 60,
    manifestVersion: app.assetManifestVersion,
    mode: app.isHordeRunMode ? "horde" : "legacy",
    legacyCaptureAvailable: !app.isHordeRunMode,
    getAssetLoadReceipt: () => app.getAssetLoadReceipt(),
    getSnapshot: () => app.isHordeRunMode ? app.getHordeSnapshot() : app.getSnapshot(),
    getHordeSnapshot: () => app.getHordeSnapshot(),
    getEnemyFieldSnapshot: () => app.getEnemyFieldSnapshot(),
    getCameraTelemetry: () => app.getCameraTelemetry(),
    getInputCaptureTelemetry: () => app.getInputCaptureTelemetry(),
    getMetrics: () => app.getMetrics(),
    stepFrames: (frames, input = {}) => {
      requireLegacyCapture();
      app.stepDeterministic(frames, input);
      return app.getSnapshot();
    },
    runScenario: (name) => {
      requireLegacyCapture();
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
