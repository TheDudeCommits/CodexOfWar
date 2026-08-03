import "./styles.css";
import { installCaptureHooks } from "./diagnostics/captureHooks";
import {
  installCowReviewHarness,
  installCowReviewReadyGate,
} from "./diagnostics/CowReviewHarness";
import { installP30CriticHarness } from "./diagnostics/P30CriticHarness";
import { isP30CriticScenarioRoute } from "./diagnostics/P30CriticProtocol";
import { GameApp } from "./render/app/GameApp";

const p30CriticScenario = isP30CriticScenarioRoute();
const reviewReadyGate = p30CriticScenario ? null : installCowReviewReadyGate();

async function boot(): Promise<void> {
  const root = document.querySelector<HTMLElement>("#game-root");
  if (!root) throw new Error("#game-root is missing");
  const app = await GameApp.create(root);
  const params = new URLSearchParams(window.location.search);
  const reviewMode = params.get("review") === "1";
  const captureScenario = params.get("capture");
  if (p30CriticScenario) {
    app.prepareP30HeavyStrikeScenario();
    installP30CriticHarness(app);
    document.documentElement.dataset.gameReady = "true";
    app.start();
  } else {
    if (captureScenario) app.runCaptureScenario(captureScenario);
    else if (!reviewMode) app.start();
    installCaptureHooks(app);
    const review = installCowReviewHarness(app, reviewMode);
    reviewReadyGate?.resolve(await review.ready);
  }
  window.addEventListener("beforeunload", () => app.dispose(), { once: true });
}

void boot().catch((error: unknown) => {
  reviewReadyGate?.reject(error);
  console.error(error);
  document.documentElement.dataset.gameReady = "error";
  const root = document.querySelector<HTMLElement>("#game-root");
  if (root) {
    root.innerHTML = `<div class="boot-error"><strong>THE GATE WOULD NOT OPEN</strong><span></span></div>`;
    const detail = root.querySelector<HTMLElement>(".boot-error span");
    if (detail) detail.textContent = error instanceof Error ? error.message : String(error);
  }
});
