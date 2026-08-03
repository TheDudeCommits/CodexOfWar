import "./run-hud.css";

export type RunHudEventTone = "neutral" | "reward" | "danger";

export interface RunHudGauge {
  readonly current: number;
  readonly maximum: number;
}

export interface RunHudPlayerModel {
  readonly health: RunHudGauge;
  readonly stamina: RunHudGauge;
}

export interface RunHudQuickSlot {
  readonly id: string;
  readonly name: string;
  readonly shortName?: string;
  readonly available?: boolean;
}

export type RunHudQuickSlots = readonly [
  RunHudQuickSlot,
  RunHudQuickSlot,
  RunHudQuickSlot,
];

export type RunHudSignatureStatus = "ready" | "cooldown" | "disabled";

export interface RunHudSignatureAbility {
  readonly name: string;
  readonly status: RunHudSignatureStatus;
  readonly cooldownRemainingSeconds?: number;
  readonly cooldownDurationSeconds?: number;
  readonly inputLabel?: string;
}

export interface RunHudLockedTarget {
  readonly name: string;
  readonly health: RunHudGauge;
  readonly elite?: boolean;
}

export interface RunHudEvent {
  readonly id: string;
  readonly text: string;
  readonly tone?: RunHudEventTone;
}

export interface RunHudControlHint {
  readonly id: string;
  readonly input: string;
  readonly action: string;
  readonly used?: boolean;
}

export interface RunHudUpgradeChoice {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly tag?: string;
}

export type RunHudUpgradeChoices = readonly [
  RunHudUpgradeChoice,
  RunHudUpgradeChoice,
  RunHudUpgradeChoice,
];

export type RunHudMode =
  | { readonly kind: "playing" }
  | {
      readonly kind: "upgrade";
      readonly waveCleared: number;
      readonly choices: RunHudUpgradeChoices;
      readonly title?: string;
    }
  | { readonly kind: "paused" }
  | { readonly kind: "defeat" }
  | { readonly kind: "victory" };

export interface RunHudModel {
  readonly player: RunHudPlayerModel;
  readonly wave: number;
  readonly totalWaves?: number;
  readonly enemiesRemaining: number;
  readonly score: number;
  readonly comboMultiplier: number;
  readonly kills: number;
  readonly essence: number;
  readonly objective: string;
  readonly activeWeaponId: string;
  readonly quickSlots: RunHudQuickSlots;
  readonly signatureAbility: RunHudSignatureAbility;
  readonly lockedTarget?: RunHudLockedTarget;
  readonly events?: readonly RunHudEvent[];
  readonly firstUseControls?: readonly RunHudControlHint[];
  readonly mode: RunHudMode;
}

export interface RunHudCallbacks {
  readonly onUpgradeSelected?: (choice: RunHudUpgradeChoice, index: number) => void;
  readonly onQuickSlotSelected?: (slot: RunHudQuickSlot, index: number) => void;
  readonly onPauseRequested?: () => void;
  readonly onResumeRequested?: () => void;
  readonly onRestartRequested?: () => void;
  readonly onInputGateChange?: (inputGated: boolean) => void;
}

export interface RunHudOptions {
  readonly listenForKeyboard?: boolean;
}

export interface RunHudRenderState {
  readonly inputGated: boolean;
  readonly modalKind: Exclude<RunHudMode["kind"], "playing"> | null;
}

export type RunHudKeyIntent =
  | { readonly kind: "choose-upgrade"; readonly index: 0 | 1 | 2 }
  | { readonly kind: "select-quick-slot"; readonly index: 0 | 1 | 2 }
  | { readonly kind: "pause" }
  | { readonly kind: "resume" }
  | { readonly kind: "restart" };

export interface RunHudViewModel {
  readonly healthPercent: number;
  readonly staminaPercent: number;
  readonly healthText: string;
  readonly staminaText: string;
  readonly waveText: string;
  readonly enemiesText: string;
  readonly scoreText: string;
  readonly comboText: string;
  readonly comboLive: boolean;
  readonly essenceText: string;
  readonly objectiveText: string;
  readonly activeWeapon: RunHudQuickSlot;
  readonly signatureInputText: string;
  readonly signatureStatusText: string;
  readonly signatureCooldownPercent: number;
  readonly targetVisible: boolean;
  readonly targetHealthPercent: number;
  readonly targetHealthText: string;
  readonly visibleControls: readonly RunHudControlHint[];
  readonly visibleEvents: readonly RunHudEvent[];
  readonly inputGated: boolean;
  readonly modalKind: RunHudRenderState["modalKind"];
}

const INTEGER_FORMATTER = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const MAX_VISIBLE_EVENTS = 4;
const MAX_VISIBLE_CONTROLS = 5;

export function deriveRunHudViewModel(model: RunHudModel): RunHudViewModel {
  assertThreeItems(model.quickSlots, "RunHudModel.quickSlots");
  if (model.mode.kind === "upgrade") {
    assertThreeItems(model.mode.choices, "RunHudMode.upgrade.choices");
  }

  const health = normalizeGauge(model.player.health);
  const stamina = normalizeGauge(model.player.stamina);
  const activeWeapon =
    model.quickSlots.find((slot) => slot.id === model.activeWeaponId) ?? model.quickSlots[0];
  const combo = Math.max(1, finiteOr(model.comboMultiplier, 1));
  const targetHealth = model.lockedTarget
    ? normalizeGauge(model.lockedTarget.health)
    : { current: 0, maximum: 1, percent: 0 };
  const signature = deriveSignatureView(model.signatureAbility);
  const totalWaves = model.totalWaves === undefined
    ? ""
    : ` / ${formatInteger(Math.max(1, model.totalWaves))}`;

  return {
    healthPercent: health.percent,
    staminaPercent: stamina.percent,
    healthText: `${formatInteger(health.current)} / ${formatInteger(health.maximum)}`,
    staminaText: `${formatInteger(stamina.current)} / ${formatInteger(stamina.maximum)}`,
    waveText: `${formatInteger(Math.max(1, model.wave))}${totalWaves}`,
    enemiesText: formatInteger(Math.max(0, model.enemiesRemaining)),
    scoreText: formatInteger(Math.max(0, model.score)),
    comboText: `×${formatCombo(combo)}`,
    comboLive: combo > 1,
    essenceText: formatInteger(Math.max(0, model.essence)),
    objectiveText: model.objective,
    activeWeapon,
    signatureInputText: model.signatureAbility.inputLabel?.trim() || "RMB / K",
    signatureStatusText: signature.statusText,
    signatureCooldownPercent: signature.cooldownPercent,
    targetVisible: Boolean(model.lockedTarget && targetHealth.current > 0),
    targetHealthPercent: targetHealth.percent,
    targetHealthText: `${formatInteger(targetHealth.current)} / ${formatInteger(targetHealth.maximum)}`,
    visibleControls: (model.firstUseControls ?? [])
      .filter((control) => !control.used)
      .slice(0, MAX_VISIBLE_CONTROLS),
    visibleEvents: (model.events ?? []).slice(-MAX_VISIBLE_EVENTS),
    inputGated: model.mode.kind !== "playing",
    modalKind: model.mode.kind === "playing" ? null : model.mode.kind,
  };
}

export function getRunHudKeyIntent(model: RunHudModel, key: string): RunHudKeyIntent | null {
  const slotIndex = getNumberKeyIndex(key);
  if (model.mode.kind === "upgrade") {
    return slotIndex === null ? null : { kind: "choose-upgrade", index: slotIndex };
  }

  if (model.mode.kind === "playing") {
    if (key === "Escape") return { kind: "pause" };
    return slotIndex === null ? null : { kind: "select-quick-slot", index: slotIndex };
  }

  if (model.mode.kind === "paused") {
    return key === "Escape" ? { kind: "resume" } : null;
  }

  if (key === "Enter" || key === "KeyR" || key.toLowerCase() === "r") {
    return { kind: "restart" };
  }
  return null;
}

export function shouldGateRunInput(mode: RunHudMode): boolean {
  return mode.kind !== "playing";
}

export class RunHud {
  private readonly layer: HTMLDivElement;
  private readonly callbacks: RunHudCallbacks;
  private readonly ownerWindow: Window;
  private readonly healthFill: HTMLDivElement;
  private readonly healthValue: HTMLSpanElement;
  private readonly staminaFill: HTMLDivElement;
  private readonly staminaValue: HTMLSpanElement;
  private readonly waveValue: HTMLElement;
  private readonly enemyCount: HTMLElement;
  private readonly scoreValue: HTMLElement;
  private readonly comboValue: HTMLElement;
  private readonly essenceValue: HTMLElement;
  private readonly objectiveValue: HTMLElement;
  private readonly targetPanel: HTMLElement;
  private readonly targetName: HTMLElement;
  private readonly targetHealthFill: HTMLDivElement;
  private readonly targetHealthValue: HTMLElement;
  private readonly feed: HTMLOListElement;
  private readonly controls: HTMLElement;
  private readonly weaponName: HTMLElement;
  private readonly signatureName: HTMLElement;
  private readonly signatureInput: HTMLElement;
  private readonly signatureState: HTMLElement;
  private readonly signatureDial: HTMLElement;
  private readonly quickSlotButtons: readonly [HTMLButtonElement, HTMLButtonElement, HTMLButtonElement];
  private readonly pauseButton: HTMLButtonElement;
  private readonly modal: HTMLElement;
  private readonly upgradePanel: HTMLElement;
  private readonly upgradeEyebrow: HTMLElement;
  private readonly upgradeTitle: HTMLElement;
  private readonly upgradeButtons: readonly [HTMLButtonElement, HTMLButtonElement, HTMLButtonElement];
  private readonly upgradeNames: readonly [HTMLElement, HTMLElement, HTMLElement];
  private readonly upgradeDescriptions: readonly [HTMLElement, HTMLElement, HTMLElement];
  private readonly upgradeTags: readonly [HTMLElement, HTMLElement, HTMLElement];
  private readonly pausePanel: HTMLElement;
  private readonly resumeButton: HTMLButtonElement;
  private readonly outcomePanel: HTMLElement;
  private readonly outcomeEyebrow: HTMLElement;
  private readonly outcomeTitle: HTMLElement;
  private readonly outcomeScore: HTMLElement;
  private readonly outcomeKills: HTMLElement;
  private readonly outcomeWave: HTMLElement;
  private readonly restartButton: HTMLButtonElement;
  private readonly keydownHandler: (event: KeyboardEvent) => void;
  private model: RunHudModel | null = null;
  private lastCombo = 1;
  private lastMode: RunHudMode["kind"] | null = null;
  private gateState = false;
  private eventSignature = "";
  private controlSignature = "";

  constructor(host: HTMLElement, callbacks: RunHudCallbacks = {}, options: RunHudOptions = {}) {
    const document = host.ownerDocument;
    const ownerWindow = document.defaultView;
    if (!ownerWindow) throw new Error("RunHud requires a host attached to a browser document");

    this.callbacks = callbacks;
    this.ownerWindow = ownerWindow;
    this.layer = element(document, "div", "run-hud");
    this.layer.dataset.runHud = "true";

    const mission = element(document, "section", "run-hud__mission forged-edge");
    mission.ariaLabel = "Current wave and objective";
    const missionTopline = element(document, "div", "run-hud__mission-topline");
    missionTopline.append(element(document, "span", "run-hud__eyebrow", "WAVE"));
    this.waveValue = element(document, "strong", "run-hud__wave-value", "1");
    missionTopline.append(this.waveValue);
    missionTopline.append(element(document, "span", "run-hud__enemy-label", "REMAINING"));
    this.enemyCount = element(document, "strong", "run-hud__enemy-count", "0");
    missionTopline.append(this.enemyCount);
    this.objectiveValue = element(document, "p", "run-hud__objective", "Survive the horde");
    mission.append(missionTopline, this.objectiveValue);

    const rewards = element(document, "section", "run-hud__rewards");
    rewards.ariaLabel = "Run score and essence";
    const scoreGroup = element(document, "div", "run-hud__score-group");
    scoreGroup.append(element(document, "span", "run-hud__eyebrow", "SCORE"));
    this.scoreValue = element(document, "strong", "run-hud__score", "0");
    scoreGroup.append(this.scoreValue);
    this.comboValue = element(document, "span", "run-hud__combo", "×1");
    this.comboValue.ariaLive = "polite";
    scoreGroup.append(this.comboValue);
    const essenceGroup = element(document, "div", "run-hud__essence");
    const essenceMark = element(document, "i", "run-hud__essence-mark");
    essenceMark.ariaHidden = "true";
    essenceGroup.append(essenceMark, element(document, "span", "run-hud__eyebrow", "ESSENCE"));
    this.essenceValue = element(document, "strong", "run-hud__essence-value", "0");
    essenceGroup.append(this.essenceValue);
    this.pauseButton = element(document, "button", "run-hud__pause-button", "Ⅱ");
    this.pauseButton.type = "button";
    this.pauseButton.ariaLabel = "Pause run";
    this.pauseButton.title = "Pause (Escape)";
    this.pauseButton.addEventListener("click", () => this.callbacks.onPauseRequested?.());
    rewards.append(scoreGroup, essenceGroup, this.pauseButton);

    const player = element(document, "section", "run-hud__player");
    player.ariaLabel = "Player health and stamina";
    const vitality = this.createMeter(document, "HEALTH", "run-hud__meter--health");
    this.healthFill = vitality.fill;
    this.healthValue = vitality.value;
    const stamina = this.createMeter(document, "STAMINA", "run-hud__meter--stamina");
    this.staminaFill = stamina.fill;
    this.staminaValue = stamina.value;
    player.append(vitality.root, stamina.root);

    const loadout = element(document, "section", "run-hud__loadout forged-edge");
    loadout.ariaLabel = "Weapons and signature ability";
    const activeWeapon = element(document, "div", "run-hud__active-weapon");
    const activeCopy = element(document, "div", "run-hud__active-copy");
    activeCopy.append(element(document, "span", "run-hud__eyebrow", "ACTIVE WEAPON"));
    this.weaponName = element(document, "strong", "run-hud__weapon-name", "Weapon");
    activeCopy.append(this.weaponName);
    const signature = element(document, "div", "run-hud__signature");
    this.signatureDial = element(document, "i", "run-hud__signature-dial");
    this.signatureDial.ariaHidden = "true";
    const signatureCopy = element(document, "span", "run-hud__signature-copy");
    this.signatureName = element(document, "b", "run-hud__signature-name", "Signature");
    this.signatureState = element(document, "em", "run-hud__signature-state", "READY");
    signatureCopy.append(this.signatureName, this.signatureState);
    this.signatureInput = element(document, "kbd", "run-hud__signature-input", "RMB / K");
    signature.append(this.signatureDial, signatureCopy, this.signatureInput);
    activeWeapon.append(activeCopy, signature);
    const slotRail = element(document, "div", "run-hud__slots");
    this.quickSlotButtons = [0, 1, 2].map((index) => {
      const button = element(document, "button", "run-hud__slot");
      button.type = "button";
      button.dataset.slot = String(index);
      button.append(
        element(document, "kbd", "run-hud__slot-key", String(index + 1)),
        element(document, "span", "run-hud__slot-name", "Weapon"),
      );
      button.addEventListener("click", () => this.selectQuickSlot(index as 0 | 1 | 2));
      return button;
    }) as [HTMLButtonElement, HTMLButtonElement, HTMLButtonElement];
    slotRail.append(...this.quickSlotButtons);
    loadout.append(activeWeapon, slotRail);

    this.targetPanel = element(document, "section", "run-hud__target");
    this.targetPanel.ariaHidden = "true";
    const targetHeading = element(document, "div", "run-hud__target-heading");
    this.targetName = element(document, "strong", "run-hud__target-name", "Target");
    this.targetHealthValue = element(document, "span", "run-hud__target-value", "0 / 0");
    targetHeading.append(this.targetName, this.targetHealthValue);
    const targetMeter = element(document, "div", "run-hud__target-meter");
    this.targetHealthFill = element(document, "div", "run-hud__target-fill");
    targetMeter.append(this.targetHealthFill);
    this.targetPanel.append(targetHeading, targetMeter);

    this.feed = element(document, "ol", "run-hud__feed");
    this.feed.ariaLabel = "Recent combat events";
    this.feed.ariaLive = "polite";

    this.controls = element(document, "aside", "run-hud__controls");
    this.controls.ariaLabel = "Contextual controls";

    this.modal = element(document, "div", "run-hud__modal");
    this.modal.ariaHidden = "true";
    const modalShade = element(document, "div", "run-hud__modal-shade");
    modalShade.ariaHidden = "true";

    this.upgradePanel = element(document, "section", "run-hud__modal-panel run-hud__upgrade-panel");
    this.upgradePanel.setAttribute("role", "dialog");
    this.upgradePanel.setAttribute("aria-modal", "true");
    this.upgradeEyebrow = element(document, "span", "run-hud__modal-eyebrow", "WAVE CLEARED");
    this.upgradeTitle = element(document, "h2", "run-hud__modal-title", "Choose an awakening");
    const upgradeInstruction = element(
      document,
      "p",
      "run-hud__modal-instruction",
      "Choose one. The horde will not wait.",
    );
    const choices = element(document, "div", "run-hud__upgrade-choices");
    const upgradeButtons: HTMLButtonElement[] = [];
    const upgradeNames: HTMLElement[] = [];
    const upgradeDescriptions: HTMLElement[] = [];
    const upgradeTags: HTMLElement[] = [];
    for (let index = 0; index < 3; index += 1) {
      const button = element(document, "button", "run-hud__upgrade-choice");
      button.type = "button";
      button.dataset.choice = String(index);
      const key = element(document, "kbd", "run-hud__choice-key", String(index + 1));
      const tag = element(document, "span", "run-hud__choice-tag", "FORGE");
      const name = element(document, "strong", "run-hud__choice-name", "Upgrade");
      const description = element(document, "span", "run-hud__choice-description", "Description");
      button.append(key, tag, name, description);
      button.addEventListener("click", () => this.chooseUpgrade(index as 0 | 1 | 2));
      upgradeButtons.push(button);
      upgradeNames.push(name);
      upgradeDescriptions.push(description);
      upgradeTags.push(tag);
    }
    this.upgradeButtons = asTriple(upgradeButtons, "upgrade buttons");
    this.upgradeNames = asTriple(upgradeNames, "upgrade names");
    this.upgradeDescriptions = asTriple(upgradeDescriptions, "upgrade descriptions");
    this.upgradeTags = asTriple(upgradeTags, "upgrade tags");
    choices.append(...this.upgradeButtons);
    this.upgradePanel.append(this.upgradeEyebrow, this.upgradeTitle, upgradeInstruction, choices);

    this.pausePanel = element(document, "section", "run-hud__modal-panel run-hud__pause-panel");
    this.pausePanel.setAttribute("role", "dialog");
    this.pausePanel.setAttribute("aria-modal", "true");
    this.pausePanel.append(
      element(document, "span", "run-hud__modal-eyebrow", "HORDE RUN"),
      element(document, "h2", "run-hud__modal-title", "The world holds its breath"),
      element(document, "p", "run-hud__modal-instruction", "Paused"),
    );
    this.resumeButton = element(document, "button", "run-hud__modal-action", "Return to battle");
    this.resumeButton.type = "button";
    this.resumeButton.addEventListener("click", () => this.callbacks.onResumeRequested?.());
    this.pausePanel.append(this.resumeButton);

    this.outcomePanel = element(document, "section", "run-hud__modal-panel run-hud__outcome-panel");
    this.outcomePanel.setAttribute("role", "dialog");
    this.outcomePanel.setAttribute("aria-modal", "true");
    this.outcomeEyebrow = element(document, "span", "run-hud__modal-eyebrow", "RUN ENDED");
    this.outcomeTitle = element(document, "h2", "run-hud__modal-title", "The horde prevails");
    const outcomeStats = element(document, "dl", "run-hud__outcome-stats");
    this.outcomeScore = this.appendOutcomeStat(document, outcomeStats, "SCORE");
    this.outcomeKills = this.appendOutcomeStat(document, outcomeStats, "KILLS");
    this.outcomeWave = this.appendOutcomeStat(document, outcomeStats, "WAVE");
    this.restartButton = element(document, "button", "run-hud__modal-action", "Begin another run");
    this.restartButton.type = "button";
    this.restartButton.addEventListener("click", () => this.callbacks.onRestartRequested?.());
    this.outcomePanel.append(
      this.outcomeEyebrow,
      this.outcomeTitle,
      outcomeStats,
      this.restartButton,
    );

    this.modal.append(modalShade, this.upgradePanel, this.pausePanel, this.outcomePanel);
    this.layer.append(
      mission,
      rewards,
      player,
      loadout,
      this.targetPanel,
      this.feed,
      this.controls,
      this.modal,
    );
    host.append(this.layer);

    this.keydownHandler = (event) => this.handleKeydown(event);
    if (options.listenForKeyboard !== false) {
      ownerWindow.addEventListener("keydown", this.keydownHandler);
    }
  }

  update(model: RunHudModel): RunHudRenderState {
    const view = deriveRunHudViewModel(model);
    const previousMode = this.lastMode;
    this.model = model;
    this.lastMode = model.mode.kind;

    this.setMeter(this.healthFill, this.healthValue, view.healthPercent, view.healthText);
    this.setMeter(this.staminaFill, this.staminaValue, view.staminaPercent, view.staminaText);
    this.waveValue.textContent = view.waveText;
    this.enemyCount.textContent = view.enemiesText;
    this.scoreValue.textContent = view.scoreText;
    this.essenceValue.textContent = view.essenceText;
    this.objectiveValue.textContent = view.objectiveText;
    this.updateCombo(model.comboMultiplier, view);
    this.updateLoadout(model, view);
    this.updateTarget(model.lockedTarget, view);
    this.updateEvents(view.visibleEvents);
    this.updateControls(view.visibleControls);
    this.updateModal(model);

    this.layer.classList.toggle("is-input-gated", view.inputGated);
    this.layer.dataset.mode = model.mode.kind;
    if (this.gateState !== view.inputGated) {
      this.gateState = view.inputGated;
      this.callbacks.onInputGateChange?.(view.inputGated);
    }
    if (previousMode !== model.mode.kind) this.focusModal(model.mode.kind);

    return { inputGated: view.inputGated, modalKind: view.modalKind };
  }

  get inputGated(): boolean {
    return this.gateState;
  }

  dispose(): void {
    this.ownerWindow.removeEventListener("keydown", this.keydownHandler);
    this.layer.remove();
    this.model = null;
  }

  private createMeter(
    document: Document,
    label: string,
    modifier: string,
  ): { root: HTMLElement; fill: HTMLDivElement; value: HTMLSpanElement } {
    const root = element(document, "div", `run-hud__meter-group ${modifier}`);
    const heading = element(document, "div", "run-hud__meter-heading");
    const labelElement = element(document, "span", "run-hud__meter-label", label);
    const value = element(document, "span", "run-hud__meter-value", "0 / 0");
    heading.append(labelElement, value);
    const track = element(document, "div", "run-hud__meter-track");
    track.setAttribute("role", "meter");
    track.setAttribute("aria-label", label.toLowerCase());
    const fill = element(document, "div", "run-hud__meter-fill");
    track.append(fill);
    root.append(heading, track);
    return { root, fill, value };
  }

  private appendOutcomeStat(document: Document, list: HTMLDListElement, label: string): HTMLElement {
    const group = element(document, "div", "run-hud__outcome-stat");
    group.append(element(document, "dt", "run-hud__outcome-label", label));
    const value = element(document, "dd", "run-hud__outcome-value", "0");
    group.append(value);
    list.append(group);
    return value;
  }

  private setMeter(
    fill: HTMLDivElement,
    value: HTMLSpanElement,
    percent: number,
    text: string,
  ): void {
    fill.style.setProperty("--run-value", `${percent}%`);
    const track = fill.parentElement;
    track?.setAttribute("aria-valuenow", percent.toFixed(0));
    track?.setAttribute("aria-valuemin", "0");
    track?.setAttribute("aria-valuemax", "100");
    value.textContent = text;
  }

  private updateCombo(rawCombo: number, view: RunHudViewModel): void {
    const combo = Math.max(1, finiteOr(rawCombo, 1));
    this.comboValue.textContent = view.comboText;
    this.comboValue.classList.toggle("is-live", view.comboLive);
    if (combo > this.lastCombo) {
      this.comboValue.classList.remove("is-bumped");
      void this.comboValue.offsetWidth;
      this.comboValue.classList.add("is-bumped");
    }
    this.lastCombo = combo;
  }

  private updateLoadout(model: RunHudModel, view: RunHudViewModel): void {
    this.weaponName.textContent = view.activeWeapon.name;
    this.signatureName.textContent = model.signatureAbility.name;
    this.signatureInput.textContent = view.signatureInputText;
    this.signatureState.textContent = view.signatureStatusText;
    this.signatureDial.style.setProperty("--run-cooldown", `${view.signatureCooldownPercent}%`);
    this.signatureDial.dataset.status = model.signatureAbility.status;
    this.signatureState.dataset.status = model.signatureAbility.status;

    model.quickSlots.forEach((slot, index) => {
      const button = this.quickSlotButtons[index];
      if (!button) throw new Error(`RunHud quick-slot button ${index} is missing`);
      const name = button.querySelector<HTMLElement>(".run-hud__slot-name");
      if (!name) throw new Error("RunHud slot name is missing");
      name.textContent = slot.shortName?.trim() || slot.name;
      button.classList.toggle("is-active", slot.id === model.activeWeaponId);
      button.disabled = slot.available === false;
      button.ariaPressed = String(slot.id === model.activeWeaponId);
      button.ariaLabel = `Equip weapon slot ${index + 1}`;
    });
  }

  private updateTarget(target: RunHudLockedTarget | undefined, view: RunHudViewModel): void {
    this.targetPanel.classList.toggle("is-visible", view.targetVisible);
    this.targetPanel.classList.toggle("is-elite", Boolean(target?.elite));
    this.targetPanel.ariaHidden = String(!view.targetVisible);
    this.targetName.textContent = target?.name ?? "";
    this.targetHealthValue.textContent = view.targetHealthText;
    this.targetHealthFill.style.setProperty("--run-value", `${view.targetHealthPercent}%`);
  }

  private updateEvents(events: readonly RunHudEvent[]): void {
    const signature = events.map((event) => `${event.id}\u0000${event.tone ?? "neutral"}\u0000${event.text}`).join("\u0001");
    if (signature === this.eventSignature) return;
    this.eventSignature = signature;
    this.feed.replaceChildren(
      ...events.map((event) => {
        const item = element(this.feed.ownerDocument, "li", "run-hud__feed-item");
        item.dataset.tone = event.tone ?? "neutral";
        item.textContent = event.text;
        return item;
      }),
    );
    this.feed.classList.toggle("is-visible", events.length > 0);
  }

  private updateControls(controls: readonly RunHudControlHint[]): void {
    const signature = controls.map((control) => `${control.id}\u0000${control.input}\u0000${control.action}`).join("\u0001");
    if (signature === this.controlSignature) return;
    this.controlSignature = signature;
    this.controls.replaceChildren(
      ...controls.map((control) => {
        const hint = element(this.controls.ownerDocument, "span", "run-hud__control");
        const key = element(this.controls.ownerDocument, "kbd", "run-hud__control-key");
        key.textContent = control.input;
        const action = element(this.controls.ownerDocument, "span", "run-hud__control-action");
        action.textContent = control.action;
        hint.append(key, action);
        return hint;
      }),
    );
    this.controls.classList.toggle("is-visible", controls.length > 0);
  }

  private updateModal(model: RunHudModel): void {
    const modalVisible = model.mode.kind !== "playing";
    this.modal.classList.toggle("is-visible", modalVisible);
    this.modal.ariaHidden = String(!modalVisible);
    this.pauseButton.classList.toggle("is-hidden", model.mode.kind !== "playing");
    this.upgradePanel.classList.toggle("is-visible", model.mode.kind === "upgrade");
    this.pausePanel.classList.toggle("is-visible", model.mode.kind === "paused");
    const outcomeVisible = model.mode.kind === "defeat" || model.mode.kind === "victory";
    this.outcomePanel.classList.toggle("is-visible", outcomeVisible);

    if (model.mode.kind === "upgrade") {
      this.upgradeEyebrow.textContent = `WAVE ${formatInteger(model.mode.waveCleared)} CLEARED`;
      this.upgradeTitle.textContent = model.mode.title?.trim() || "Choose an awakening";
      model.mode.choices.forEach((choice, index) => {
        const name = this.upgradeNames[index];
        const description = this.upgradeDescriptions[index];
        const tag = this.upgradeTags[index];
        const button = this.upgradeButtons[index];
        if (!name || !description || !tag || !button) {
          throw new Error(`RunHud upgrade choice ${index} is missing`);
        }
        name.textContent = choice.name;
        description.textContent = choice.description;
        tag.textContent = choice.tag?.trim() || "FORGE";
        button.ariaLabel = `Choose upgrade ${index + 1}`;
      });
    }

    if (outcomeVisible) {
      const victory = model.mode.kind === "victory";
      this.outcomePanel.classList.toggle("is-victory", victory);
      this.outcomeEyebrow.textContent = victory ? "HORDE BROKEN" : "RUN ENDED";
      this.outcomeTitle.textContent = victory ? "The night remembers your name" : "The horde prevails";
      this.outcomeScore.textContent = formatInteger(Math.max(0, model.score));
      this.outcomeKills.textContent = formatInteger(Math.max(0, model.kills));
      this.outcomeWave.textContent = formatInteger(Math.max(1, model.wave));
      this.restartButton.textContent = victory ? "Challenge the horde again" : "Rise again";
    }
  }

  private focusModal(mode: RunHudMode["kind"]): void {
    if (mode === "upgrade") this.upgradeButtons[0].focus({ preventScroll: true });
    else if (mode === "paused") this.resumeButton.focus({ preventScroll: true });
    else if (mode === "defeat" || mode === "victory") {
      this.restartButton.focus({ preventScroll: true });
    }
  }

  private handleKeydown(event: KeyboardEvent): void {
    if (!this.model || event.repeat || isEditableTarget(event.target)) return;
    const intent = getRunHudKeyIntent(this.model, event.code || event.key);
    if (!intent) return;
    event.preventDefault();
    event.stopPropagation();
    if (intent.kind === "choose-upgrade") this.chooseUpgrade(intent.index);
    else if (intent.kind === "select-quick-slot") this.selectQuickSlot(intent.index);
    else if (intent.kind === "pause") this.callbacks.onPauseRequested?.();
    else if (intent.kind === "resume") this.callbacks.onResumeRequested?.();
    else this.callbacks.onRestartRequested?.();
  }

  private chooseUpgrade(index: 0 | 1 | 2): void {
    if (this.model?.mode.kind !== "upgrade") return;
    this.callbacks.onUpgradeSelected?.(this.model.mode.choices[index], index);
  }

  private selectQuickSlot(index: 0 | 1 | 2): void {
    if (this.model?.mode.kind !== "playing") return;
    const slot = this.model.quickSlots[index];
    if (slot.available === false) return;
    this.callbacks.onQuickSlotSelected?.(slot, index);
  }
}

function deriveSignatureView(ability: RunHudSignatureAbility): {
  statusText: string;
  cooldownPercent: number;
} {
  if (ability.status === "ready") return { statusText: "READY", cooldownPercent: 0 };
  if (ability.status === "disabled") return { statusText: "SEALED", cooldownPercent: 100 };

  const remaining = Math.max(0, finiteOr(ability.cooldownRemainingSeconds, 0));
  const duration = Math.max(0.001, finiteOr(ability.cooldownDurationSeconds, remaining || 1));
  return {
    statusText: `${remaining.toFixed(remaining < 10 ? 1 : 0)}s`,
    cooldownPercent: clamp01(remaining / duration) * 100,
  };
}

function normalizeGauge(gauge: RunHudGauge): { current: number; maximum: number; percent: number } {
  const maximum = Math.max(0, finiteOr(gauge.maximum, 0));
  const current = Math.min(maximum, Math.max(0, finiteOr(gauge.current, 0)));
  return {
    current,
    maximum,
    percent: maximum === 0 ? 0 : (current / maximum) * 100,
  };
}

function formatInteger(value: number): string {
  return INTEGER_FORMATTER.format(Math.round(finiteOr(value, 0)));
}

function formatCombo(value: number): string {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
}

function finiteOr(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) ? value : fallback;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function assertThreeItems(value: readonly unknown[], label: string): void {
  if (value.length !== 3) throw new Error(`${label} must contain exactly three items`);
}

function asTriple<T>(values: readonly T[], label: string): [T, T, T] {
  assertThreeItems(values, label);
  const first = values[0];
  const second = values[1];
  const third = values[2];
  if (first === undefined || second === undefined || third === undefined) {
    throw new Error(`${label} must contain exactly three items`);
  }
  return [first, second, third];
}

function getNumberKeyIndex(key: string): 0 | 1 | 2 | null {
  if (key === "1" || key === "Digit1" || key === "Numpad1") return 0;
  if (key === "2" || key === "Digit2" || key === "Numpad2") return 1;
  if (key === "3" || key === "Digit3" || key === "Numpad3") return 2;
  return null;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.matches("input, textarea, select");
}

function element<K extends keyof HTMLElementTagNameMap>(
  document: Document,
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
