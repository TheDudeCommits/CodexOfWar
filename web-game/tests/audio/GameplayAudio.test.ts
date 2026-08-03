import { describe, expect, it } from "vitest";
import { GameAudio } from "../../src/audio/GameAudio";
import {
  audioCuesForHordeEvent,
  audioCuesForLegacyEvent,
} from "../../src/audio/GameplayAudioCues";
import type { HordeGameEvent, HordeWeaponId } from "../../src/game/run";
import type { GameEvent } from "../../src/game/simulation/types";

const EVENT_BASE = { id: 1, tick: 10 } as const;

function hordeEvent(event: Record<string, unknown>): HordeGameEvent {
  return { ...EVENT_BASE, ...event } as HordeGameEvent;
}

class FakeAudioParam {
  value = 1;

  setValueAtTime(value: number): this {
    this.value = value;
    return this;
  }

  setTargetAtTime(value: number): this {
    this.value = value;
    return this;
  }

  exponentialRampToValueAtTime(value: number): this {
    this.value = value;
    return this;
  }
}

class FakeGainNode {
  readonly gain = new FakeAudioParam();

  connect(): AudioNode {
    return this as unknown as AudioNode;
  }

  disconnect(): void {}
}

class FakeDynamicsCompressorNode extends FakeGainNode {
  readonly threshold = new FakeAudioParam();
  readonly knee = new FakeAudioParam();
  readonly ratio = new FakeAudioParam();
  readonly attack = new FakeAudioParam();
  readonly release = new FakeAudioParam();
}

class FakeAudioContext {
  state: AudioContextState = "suspended";
  currentTime = 0;
  sampleRate = 48_000;
  readonly destination = {} as AudioDestinationNode;
  readonly gains: FakeGainNode[] = [];
  readonly compressors: FakeDynamicsCompressorNode[] = [];
  resumeCalls = 0;
  closeCalls = 0;
  rejectResume = false;

  createGain(): GainNode {
    const gain = new FakeGainNode();
    this.gains.push(gain);
    return gain as unknown as GainNode;
  }

  createDynamicsCompressor(): DynamicsCompressorNode {
    const compressor = new FakeDynamicsCompressorNode();
    this.compressors.push(compressor);
    return compressor as unknown as DynamicsCompressorNode;
  }

  async resume(): Promise<void> {
    this.resumeCalls += 1;
    if (this.rejectResume) throw new Error("gesture denied");
    this.state = "running";
  }

  async close(): Promise<void> {
    this.closeCalls += 1;
    this.state = "closed";
  }
}

describe("gameplay audio event mapping", () => {
  it("maps every weapon normal, special, switch, and impact to a distinct cue", () => {
    const weapons: HordeWeaponId[] = ["katana", "greatsword", "twin-blades"];
    const cues = new Set<string>();
    for (const weapon of weapons) {
      const normal = audioCuesForHordeEvent(hordeEvent({
        type: "attack-started",
        weapon,
        attackSerial: 1,
        staminaCost: 10,
      }));
      const special = audioCuesForHordeEvent(hordeEvent({
        type: "special-started",
        weapon,
        attackSerial: 2,
        staminaCost: 20,
        cooldownTicks: 120,
      }));
      const switched = audioCuesForHordeEvent(hordeEvent({
        type: "weapon-switched",
        weapon,
        slot: weapon === "katana" ? 1 : weapon === "greatsword" ? 2 : 3,
      }));
      const impact = audioCuesForHordeEvent(hordeEvent({
        type: "enemy-hit",
        enemyId: 7,
        archetype: "shambler",
        weapon,
        special: false,
        strikeIndex: 0,
        damage: 20,
        remainingHealth: 40,
        attackSerial: 1,
      }));
      expect(normal).toEqual([`attack-${weapon}-normal`]);
      expect(special).toEqual([`attack-${weapon}-special`]);
      expect(switched).toEqual([`weapon-switch-${weapon}`]);
      expect(impact).toEqual([`impact-${weapon}`]);
      for (const cue of [...normal, ...special, ...switched, ...impact]) cues.add(cue);
    }
    expect(cues.size).toBe(12);
  });

  it("maps bite, pounce, and slam windups and contacts plus the remaining run feedback", () => {
    const intentions = [
      ["shambler", "bite"],
      ["stalker", "pounce"],
      ["brute", "slam"],
    ] as const;
    for (const [archetype, intent] of intentions) {
      expect(audioCuesForHordeEvent(hordeEvent({
        type: "enemy-telegraph",
        enemyId: 4,
        archetype,
        intent,
        attackSerial: 3,
        resolveInTicks: 20,
      }))).toEqual([`enemy-${intent}-windup`]);
      expect(audioCuesForHordeEvent(hordeEvent({
        type: "enemy-attack-hit",
        enemyId: 4,
        archetype,
        attackSerial: 3,
        damage: 12,
        remainingHealth: 88,
      }))).toEqual([`enemy-${intent}-contact`, "player-damage"]);
    }

    expect(audioCuesForHordeEvent(hordeEvent({
      type: "dodge-started",
      staminaCost: 18,
      invulnerableTicks: 15,
    }))).toEqual(["player-dodge"]);
    expect(audioCuesForHordeEvent(hordeEvent({
      type: "enemy-defeated",
      enemyId: 4,
      archetype: "brute",
      weapon: "greatsword",
      scoreAwarded: 100,
      essenceAwarded: 20,
      comboMultiplier: 2,
    }))).toEqual(["enemy-death"]);
    expect(audioCuesForHordeEvent(hordeEvent({
      type: "upgrade-selected",
      upgrade: "tempered-edge",
      choiceIndex: 0,
    }))).toEqual(["upgrade-selected"]);
    expect(audioCuesForHordeEvent(hordeEvent({
      type: "run-victory",
      score: 1000,
      kills: 12,
      essence: 90,
    }))).toEqual(["run-victory"]);
    expect(audioCuesForHordeEvent(hordeEvent({
      type: "player-defeated",
      wave: 3,
      score: 400,
    }))).toEqual(["run-defeat"]);
  });

  it("keeps the legacy route event-driven without changing its simulation events", () => {
    const attack = { type: "attack-started", tick: 1, attackSerial: 1 } as GameEvent;
    const hit = {
      type: "enemy-hit",
      tick: 2,
      damage: 34,
      remainingHealth: 66,
      attackSerial: 1,
    } as GameEvent;
    const defeated = { type: "enemy-defeated", tick: 3, attackSerial: 1 } as GameEvent;
    expect(audioCuesForLegacyEvent(attack)).toEqual(["attack-greatsword-normal"]);
    expect(audioCuesForLegacyEvent(hit)).toEqual(["legacy-impact"]);
    expect(audioCuesForLegacyEvent(defeated)).toEqual(["enemy-death", "run-victory"]);
  });
});

describe("GameAudio gesture and bus behavior", () => {
  it("stays lazy and muted until a gesture unlocks a running context", async () => {
    const context = new FakeAudioContext();
    let factoryCalls = 0;
    const audio = new GameAudio({
      contextFactory: () => {
        factoryCalls += 1;
        return context as unknown as AudioContext;
      },
      ambienceEnabled: false,
    });
    const gestureTarget = new EventTarget();
    audio.attachGestureUnlock(gestureTarget);
    audio.setMuted(true);

    expect(factoryCalls).toBe(0);
    expect(audio.getSnapshot()).toMatchObject({ unlocked: false, muted: true });
    expect(audio.playCue("player-dodge")).toBe(false);
    gestureTarget.dispatchEvent(new Event("pointerdown"));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(factoryCalls).toBe(1);
    expect(context.resumeCalls).toBe(1);
    expect(audio.getSnapshot().unlocked).toBe(true);
    expect(context.gains).toHaveLength(3);
    expect(context.compressors).toHaveLength(1);
    expect(context.compressors[0]!.threshold.value).toBe(-12);
    expect(context.compressors[0]!.ratio.value).toBe(16);
    expect(context.gains[0]!.gain.value).toBe(0);
    expect(audio.playCue("player-dodge")).toBe(false);

    audio.setMuted(false);
    expect(context.gains[0]!.gain.value).toBeCloseTo(0.72);
    audio.setPaused(true);
    expect(context.gains[1]!.gain.value).toBe(0);
    expect(context.gains[2]!.gain.value).toBe(0);
    audio.setSfxVolume(0.33);
    audio.setAmbienceVolume(0.11);
    audio.setPaused(false);
    expect(context.gains[1]!.gain.value).toBeCloseTo(0.33);
    expect(context.gains[2]!.gain.value).toBeCloseTo(0.11);
    await expect(audio.unlock()).resolves.toBe(true);
    expect(factoryCalls).toBe(1);
    audio.dispose();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(context.closeCalls).toBe(1);
  });

  it("swallows a rejected autoplay resume instead of surfacing an error", async () => {
    const context = new FakeAudioContext();
    context.rejectResume = true;
    const audio = new GameAudio({
      contextFactory: () => context as unknown as AudioContext,
      ambienceEnabled: false,
    });
    await expect(audio.unlock()).resolves.toBe(false);
    expect(audio.getSnapshot().unlocked).toBe(false);
    audio.dispose();
  });
});
