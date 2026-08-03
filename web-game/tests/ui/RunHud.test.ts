import { describe, expect, it } from "vitest";
import {
  deriveRunHudViewModel,
  getRunHudKeyIntent,
  shouldGateRunInput,
  type RunHudMode,
  type RunHudModel,
} from "../../src/ui/RunHud";

const BASE_MODEL: RunHudModel = {
  player: {
    health: { current: 84, maximum: 100 },
    stamina: { current: 37.5, maximum: 75 },
  },
  wave: 3,
  totalWaves: 8,
  enemiesRemaining: 11,
  score: 12_450,
  comboMultiplier: 2.5,
  kills: 22,
  essence: 180,
  objective: "Break the gravebound captain",
  activeWeaponId: "stormcage",
  quickSlots: [
    { id: "stormcage", name: "Stormcage", shortName: "Blade" },
    { id: "ember-bow", name: "Ember Bow", shortName: "Bow" },
    { id: "void-fists", name: "Void Fists", shortName: "Fists", available: false },
  ],
  signatureAbility: {
    name: "Violet Rupture",
    status: "cooldown",
    cooldownRemainingSeconds: 3.25,
    cooldownDurationSeconds: 10,
    inputLabel: "RMB / K",
  },
  lockedTarget: {
    name: "Gravebound Captain",
    health: { current: 240, maximum: 400 },
    elite: true,
  },
  events: [
    { id: "a", text: "+20 execution", tone: "reward" },
    { id: "b", text: "Stamina broken", tone: "danger" },
  ],
  firstUseControls: [
    { id: "move", input: "WASD", action: "Move", used: true },
    { id: "light", input: "LMB / J", action: "Strike" },
    { id: "heavy", input: "RMB / K", action: "Signature" },
  ],
  mode: { kind: "playing" },
};

describe("RunHud view-model boundary", () => {
  it("formats the required edge HUD surfaces without owning simulation state", () => {
    const view = deriveRunHudViewModel(BASE_MODEL);

    expect(view).toMatchObject({
      healthPercent: 84,
      staminaPercent: 50,
      healthText: "84 / 100",
      staminaText: "38 / 75",
      waveText: "3 / 8",
      enemiesText: "11",
      scoreText: "12,450",
      comboText: "×2.5",
      comboLive: true,
      essenceText: "180",
      objectiveText: "Break the gravebound captain",
      targetVisible: true,
      targetHealthPercent: 60,
      targetHealthText: "240 / 400",
      inputGated: false,
      modalKind: null,
      signatureInputText: "RMB / K",
      signatureStatusText: "3.3s",
      signatureCooldownPercent: 32.5,
    });
    expect(view.activeWeapon.id).toBe("stormcage");
    expect(view.visibleControls.map((control) => control.id)).toEqual(["light", "heavy"]);
    expect(view.visibleEvents).toEqual(BASE_MODEL.events);
  });

  it("clamps hostile or non-finite gauge and score values", () => {
    const view = deriveRunHudViewModel({
      ...BASE_MODEL,
      player: {
        health: { current: 800, maximum: 120 },
        stamina: { current: Number.NaN, maximum: -4 },
      },
      score: Number.POSITIVE_INFINITY,
      comboMultiplier: Number.NaN,
      enemiesRemaining: -9,
      essence: -100,
      lockedTarget: {
        name: "Fallen",
        health: { current: -1, maximum: 500 },
      },
    });

    expect(view.healthPercent).toBe(100);
    expect(view.healthText).toBe("120 / 120");
    expect(view.staminaPercent).toBe(0);
    expect(view.staminaText).toBe("0 / 0");
    expect(view.scoreText).toBe("0");
    expect(view.comboText).toBe("×1");
    expect(view.enemiesText).toBe("0");
    expect(view.essenceText).toBe("0");
    expect(view.targetVisible).toBe(false);
  });

  it("shows only the four newest feed events and six unused contextual controls", () => {
    const view = deriveRunHudViewModel({
      ...BASE_MODEL,
      events: Array.from({ length: 7 }, (_, index) => ({
        id: `event-${index}`,
        text: `Event ${index}`,
      })),
      firstUseControls: Array.from({ length: 8 }, (_, index) => ({
        id: `control-${index}`,
        input: `${index + 1}`,
        action: `Action ${index}`,
      })),
    });

    expect(view.visibleEvents.map((event) => event.id)).toEqual([
      "event-3",
      "event-4",
      "event-5",
      "event-6",
    ]);
    expect(view.visibleControls.map((control) => control.id)).toEqual([
      "control-0",
      "control-1",
      "control-2",
      "control-3",
      "control-4",
      "control-5",
    ]);
  });

  it("keeps dangerous dynamic copy as literal text for the DOM textContent sink", () => {
    const dangerousText = `<img src=x onerror="throw new Error('owned')">`;
    const view = deriveRunHudViewModel({
      ...BASE_MODEL,
      objective: dangerousText,
      lockedTarget: { name: dangerousText, health: { current: 1, maximum: 1 } },
      events: [{ id: "unsafe", text: dangerousText }],
    });

    expect(view.objectiveText).toBe(dangerousText);
    expect(view.visibleEvents[0]?.text).toBe(dangerousText);
  });

  it("fails closed when a JavaScript caller bypasses either three-item tuple", () => {
    const shortSlots = {
      ...BASE_MODEL,
      quickSlots: BASE_MODEL.quickSlots.slice(0, 2),
    } as unknown as RunHudModel;
    expect(() => deriveRunHudViewModel(shortSlots)).toThrow(/quickSlots.*exactly three/i);

    const shortChoices = {
      ...BASE_MODEL,
      mode: {
        kind: "upgrade",
        waveCleared: 3,
        choices: [{ id: "one", name: "One", description: "Only one" }],
      },
    } as unknown as RunHudModel;
    expect(() => deriveRunHudViewModel(shortChoices)).toThrow(/choices.*exactly three/i);
  });
});

describe("RunHud signature ability cue", () => {
  it("announces readiness and uses the compact default input hint", () => {
    const view = deriveRunHudViewModel({
      ...BASE_MODEL,
      signatureAbility: {
        name: "Violet Rupture",
        status: "ready",
      },
    });

    expect(view.signatureStatusText).toBe("READY");
    expect(view.signatureCooldownPercent).toBe(0);
    expect(view.signatureInputText).toBe("RMB / K");
  });

  it("fails safe for malformed cooldown timing and exposes a sealed state", () => {
    const malformed = deriveRunHudViewModel({
      ...BASE_MODEL,
      signatureAbility: {
        name: "Violet Rupture",
        status: "cooldown",
        cooldownRemainingSeconds: Number.NaN,
        cooldownDurationSeconds: 0,
      },
    });
    const disabled = deriveRunHudViewModel({
      ...BASE_MODEL,
      signatureAbility: { name: "Violet Rupture", status: "disabled" },
    });

    expect(malformed.signatureStatusText).toBe("0.0s");
    expect(malformed.signatureCooldownPercent).toBe(0);
    expect(disabled.signatureStatusText).toBe("SEALED");
    expect(disabled.signatureCooldownPercent).toBe(100);
  });
});

describe("RunHud modal and keyboard input boundary", () => {
  const choices = [
    { id: "edge", name: "Serrated Edge", description: "+20% weapon damage" },
    { id: "heart", name: "Ashen Heart", description: "+25 maximum health" },
    { id: "step", name: "Void Step", description: "Dodge leaves a damaging echo" },
  ] as const;

  it.each([
    [{ kind: "playing" }, false],
    [{ kind: "upgrade", waveCleared: 3, choices }, true],
    [{ kind: "paused" }, true],
    [{ kind: "defeat" }, true],
    [{ kind: "victory" }, true],
  ] satisfies readonly (readonly [RunHudMode, boolean])[])(
    "gates camera/game input for %o = %s",
    (mode, expected) => {
      expect(shouldGateRunInput(mode)).toBe(expected);
      expect(deriveRunHudViewModel({ ...BASE_MODEL, mode }).inputGated).toBe(expected);
    },
  );

  it("routes 1/2/3 to weapons during play and upgrades while the choice modal is open", () => {
    expect(getRunHudKeyIntent(BASE_MODEL, "Digit2")).toEqual({
      kind: "select-quick-slot",
      index: 1,
    });
    const upgradeModel: RunHudModel = {
      ...BASE_MODEL,
      mode: { kind: "upgrade", waveCleared: 3, choices },
    };
    expect(getRunHudKeyIntent(upgradeModel, "Numpad3")).toEqual({
      kind: "choose-upgrade",
      index: 2,
    });
    expect(getRunHudKeyIntent(upgradeModel, "Escape")).toBeNull();
  });

  it("routes lifecycle keys without mutating the mode", () => {
    expect(getRunHudKeyIntent(BASE_MODEL, "Escape")).toEqual({ kind: "pause" });
    expect(getRunHudKeyIntent({ ...BASE_MODEL, mode: { kind: "paused" } }, "Escape")).toEqual({
      kind: "resume",
    });
    expect(getRunHudKeyIntent({ ...BASE_MODEL, mode: { kind: "defeat" } }, "KeyR")).toEqual({
      kind: "restart",
    });
    expect(getRunHudKeyIntent({ ...BASE_MODEL, mode: { kind: "victory" } }, "Enter")).toEqual({
      kind: "restart",
    });
    expect(BASE_MODEL.mode).toEqual({ kind: "playing" });
  });
});
