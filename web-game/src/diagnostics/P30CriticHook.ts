import type { GameApp } from "../render/app/GameApp";

export interface P30CriticHook {
  readonly schema: "p30.r011.runtime-hook.v1";
  whenReady: () => Promise<void>;
  armCaptureTicks: (ticks: number[]) => void;
  resume: () => void;
  snapshot: () => Record<string, unknown>;
  runReceipt: () => Record<string, unknown>;
  resourceReceipt: () => Record<string, unknown>;
}

declare global {
  interface Window {
    __P30_CRITIC__?: P30CriticHook;
  }
}

export function installP30CriticHook(app: GameApp): P30CriticHook {
  const hook: P30CriticHook = Object.freeze({
    schema: "p30.r011.runtime-hook.v1",
    whenReady: () => Promise.resolve(),
    armCaptureTicks: (ticks: number[]) => app.armP30CriticCaptureTicks([...ticks]),
    resume: () => app.resumeP30CriticCapture(),
    snapshot: () => app.getP30CriticSnapshot(),
    runReceipt: () => app.getP30CriticRunReceipt(),
    resourceReceipt: () => app.getP30CriticResourceReceipt(),
  });
  Object.defineProperty(window, "__P30_CRITIC__", {
    configurable: true,
    enumerable: false,
    writable: false,
    value: hook,
  });
  document.documentElement.dataset.gameReady = "true";
  return hook;
}
