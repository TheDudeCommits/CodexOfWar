import * as THREE from "three";
import type { WorldState } from "../game/simulation/types";
import type { RuntimeMetrics } from "../diagnostics/PerfDiagnostics";

export class Hud {
  private readonly layer: HTMLElement;
  private readonly playerHealth: HTMLElement;
  private readonly stamina: HTMLElement;
  private readonly enemyHealth: HTMLElement;
  private readonly enemyValue: HTMLElement;
  private readonly objective: HTMLElement;
  private readonly objectiveTitle: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly lockReticle: HTMLElement;
  private readonly lockLabel: HTMLElement;
  private readonly toastElement: HTMLElement;
  private readonly contextOverlay: HTMLElement;
  private readonly diagnostics: HTMLElement;
  private hintEngaged = false;
  private toastTimeout = 0;
  private diagnosticsVisible = false;
  private readonly projected = new THREE.Vector3();

  constructor(host: HTMLElement) {
    host.insertAdjacentHTML(
      "beforeend",
      `<div class="hud" aria-live="polite">
        <div class="vignette" aria-hidden="true"></div>
        <section class="objective-chip" data-ui="objective">
          <span class="eyebrow">ASHWAKE TRIAL · I</span>
          <strong data-ui="objective-title">Break the Hollow</strong>
          <span class="objective-sub">Bring its vitality to zero</span>
        </section>
        <section class="enemy-status" aria-label="Enemy vitality">
          <div class="enemy-heading"><span>THE HOLLOW</span><span data-ui="enemy-value">100</span></div>
          <div class="meter meter--enemy"><i data-ui="enemy-health"></i></div>
        </section>
        <section class="player-status" aria-label="Player status">
          <div class="sigil" aria-hidden="true">GL</div>
          <div class="player-meters">
            <div class="meter-label"><span>VITALITY</span><span>100</span></div>
            <div class="meter meter--health"><i data-ui="player-health"></i></div>
            <div class="meter-label meter-label--small"><span>VIGOR</span></div>
            <div class="meter meter--stamina"><i data-ui="stamina"></i></div>
          </div>
        </section>
        <div class="lock-reticle" data-ui="lock-reticle" aria-hidden="true">
          <span></span><b data-ui="lock-label">LOCKED</b>
        </div>
        <div class="control-hint" data-ui="hint">
          <span><kbd>WASD</kbd> MOVE</span>
          <span><kbd>SHIFT</kbd> SPRINT</span>
          <span><kbd>SPACE</kbd> DODGE</span>
          <span><kbd>LMB</kbd> STRIKE</span>
          <span><kbd>Q</kbd> LOCK</span>
        </div>
        <div class="toast" data-ui="toast"></div>
        <pre class="diagnostics" data-ui="diagnostics"></pre>
        <div class="context-overlay" data-ui="context-overlay" role="status">
          <div class="context-mark">GL</div>
          <strong>THE VEIL HAS FALTERED</strong>
          <span>WebGL context lost. Waiting for the renderer to recover…</span>
        </div>
      </div>`,
    );
    this.layer = this.require(host, ".hud");
    this.playerHealth = this.require(host, "[data-ui='player-health']");
    this.stamina = this.require(host, "[data-ui='stamina']");
    this.enemyHealth = this.require(host, "[data-ui='enemy-health']");
    this.enemyValue = this.require(host, "[data-ui='enemy-value']");
    this.objective = this.require(host, "[data-ui='objective']");
    this.objectiveTitle = this.require(host, "[data-ui='objective-title']");
    this.hint = this.require(host, "[data-ui='hint']");
    this.lockReticle = this.require(host, "[data-ui='lock-reticle']");
    this.lockLabel = this.require(host, "[data-ui='lock-label']");
    this.toastElement = this.require(host, "[data-ui='toast']");
    this.contextOverlay = this.require(host, "[data-ui='context-overlay']");
    this.diagnostics = this.require(host, "[data-ui='diagnostics']");
  }

  update(state: WorldState, camera: THREE.Camera, locked: boolean): void {
    const playerHealth01 = state.player.health / state.player.maxHealth;
    const stamina01 = state.player.stamina / state.player.maxStamina;
    const enemyHealth01 = state.enemy.health / state.enemy.maxHealth;
    this.playerHealth.style.width = `${playerHealth01 * 100}%`;
    this.stamina.style.width = `${stamina01 * 100}%`;
    this.enemyHealth.style.width = `${enemyHealth01 * 100}%`;
    this.enemyValue.textContent = Math.ceil(state.enemy.health).toString().padStart(3, "0");
    this.enemyHealth.parentElement?.classList.toggle("is-critical", enemyHealth01 > 0 && enemyHealth01 <= 0.34);

    if (state.objectiveComplete) {
      this.objective.classList.add("is-complete");
      this.objectiveTitle.textContent = "Hollow broken";
      this.lockLabel.textContent = "FELLED";
    } else {
      this.objective.classList.remove("is-complete");
      this.objectiveTitle.textContent = "Break the Hollow";
      this.lockLabel.textContent = "LOCKED";
    }

    if (!this.hintEngaged && state.elapsed > 7) this.hint.classList.add("is-hidden");
    this.updateReticle(state, camera, locked);
  }

  markEngaged(): void {
    if (this.hintEngaged) return;
    this.hintEngaged = true;
    window.setTimeout(() => this.hint.classList.add("is-hidden"), 2300);
  }

  toast(message: string, tone: "normal" | "danger" = "normal"): void {
    window.clearTimeout(this.toastTimeout);
    this.toastElement.textContent = message;
    this.toastElement.classList.toggle("is-danger", tone === "danger");
    this.toastElement.classList.add("is-visible");
    this.toastTimeout = window.setTimeout(() => this.toastElement.classList.remove("is-visible"), 1800);
  }

  showContextLost(lost: boolean): void {
    this.contextOverlay.classList.toggle("is-visible", lost);
  }

  toggleDiagnostics(force?: boolean): boolean {
    this.diagnosticsVisible = force ?? !this.diagnosticsVisible;
    this.diagnostics.classList.toggle("is-visible", this.diagnosticsVisible);
    return this.diagnosticsVisible;
  }

  updateDiagnostics(metrics: RuntimeMetrics): void {
    if (!this.diagnosticsVisible) return;
    this.diagnostics.textContent = [
      `FPS       ${metrics.fps.toFixed(1)}`,
      `SIM       ${metrics.simulationHz.toFixed(1)} Hz`,
      `FRAME     ${metrics.frameMilliseconds.toFixed(2)} ms`,
      `RENDER    ${metrics.postMilliseconds.toFixed(2)} ms`,
      `DRAWS     ${metrics.drawCalls}`,
      `TRIS      ${metrics.triangles.toLocaleString()}`,
      `POST      ${metrics.postEnabled ? "ON" : "OFF"}`,
      "F3 TOGGLE · P POST · C CAPTURE",
    ].join("\n");
  }

  dispose(): void {
    window.clearTimeout(this.toastTimeout);
    this.layer.remove();
  }

  private updateReticle(state: WorldState, camera: THREE.Camera, locked: boolean): void {
    const visible = locked && state.enemy.health > 0;
    this.lockReticle.classList.toggle("is-visible", visible);
    if (!visible) return;
    this.projected.set(state.enemy.position.x, 2.35, state.enemy.position.z).project(camera);
    const x = (this.projected.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-this.projected.y * 0.5 + 0.5) * window.innerHeight;
    this.lockReticle.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
  }

  private require(host: HTMLElement, selector: string): HTMLElement {
    const element = host.querySelector<HTMLElement>(selector);
    if (!element) throw new Error(`HUD element missing: ${selector}`);
    return element;
  }
}
