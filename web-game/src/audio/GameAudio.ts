import type { GameplayAudioCue } from "./GameplayAudioCues";

const MAX_ACTIVE_VOICES = 28;
const MIN_GAIN = 0.0001;

interface ToneLayer {
  readonly wave: OscillatorType;
  readonly frequency: number;
  readonly frequencyEnd?: number;
  readonly gain: number;
  readonly start?: number;
  readonly duration: number;
}

interface NoiseLayer {
  readonly filter: BiquadFilterType;
  readonly frequency: number;
  readonly frequencyEnd?: number;
  readonly gain: number;
  readonly start?: number;
  readonly duration: number;
}

interface CueRecipe {
  readonly tones?: readonly ToneLayer[];
  readonly noises?: readonly NoiseLayer[];
}

const CUE_RECIPES = {
  "attack-katana-normal": {
    tones: [{ wave: "triangle", frequency: 1280, frequencyEnd: 310, gain: 0.11, duration: 0.13 }],
    noises: [{ filter: "bandpass", frequency: 2600, frequencyEnd: 900, gain: 0.13, duration: 0.12 }],
  },
  "attack-katana-special": {
    tones: [
      { wave: "sine", frequency: 720, frequencyEnd: 1760, gain: 0.09, duration: 0.18 },
      { wave: "triangle", frequency: 1850, frequencyEnd: 440, gain: 0.1, start: 0.11, duration: 0.2 },
    ],
    noises: [{ filter: "bandpass", frequency: 3300, frequencyEnd: 740, gain: 0.16, duration: 0.3 }],
  },
  "attack-greatsword-normal": {
    tones: [
      { wave: "sawtooth", frequency: 178, frequencyEnd: 58, gain: 0.13, duration: 0.26 },
      { wave: "triangle", frequency: 420, frequencyEnd: 120, gain: 0.07, duration: 0.2 },
    ],
    noises: [{ filter: "lowpass", frequency: 980, frequencyEnd: 230, gain: 0.18, duration: 0.25 }],
  },
  "attack-greatsword-special": {
    tones: [
      { wave: "sine", frequency: 72, frequencyEnd: 38, gain: 0.2, duration: 0.55 },
      { wave: "sawtooth", frequency: 260, frequencyEnd: 54, gain: 0.12, start: 0.08, duration: 0.42 },
    ],
    noises: [{ filter: "lowpass", frequency: 1200, frequencyEnd: 170, gain: 0.23, duration: 0.48 }],
  },
  "attack-twin-blades-normal": {
    tones: [
      { wave: "square", frequency: 760, frequencyEnd: 280, gain: 0.065, duration: 0.09 },
      { wave: "square", frequency: 980, frequencyEnd: 340, gain: 0.065, start: 0.07, duration: 0.1 },
    ],
    noises: [
      { filter: "highpass", frequency: 1700, gain: 0.08, duration: 0.08 },
      { filter: "highpass", frequency: 2100, gain: 0.08, start: 0.07, duration: 0.09 },
    ],
  },
  "attack-twin-blades-special": {
    tones: [
      { wave: "triangle", frequency: 420, frequencyEnd: 920, gain: 0.07, duration: 0.16 },
      { wave: "triangle", frequency: 690, frequencyEnd: 1320, gain: 0.07, start: 0.1, duration: 0.16 },
      { wave: "triangle", frequency: 960, frequencyEnd: 1760, gain: 0.07, start: 0.2, duration: 0.18 },
    ],
    noises: [{ filter: "bandpass", frequency: 1900, frequencyEnd: 3600, gain: 0.14, duration: 0.42 }],
  },
  "weapon-switch-katana": {
    tones: [{ wave: "sine", frequency: 620, frequencyEnd: 1080, gain: 0.08, duration: 0.12 }],
  },
  "weapon-switch-greatsword": {
    tones: [{ wave: "triangle", frequency: 210, frequencyEnd: 118, gain: 0.11, duration: 0.17 }],
  },
  "weapon-switch-twin-blades": {
    tones: [
      { wave: "sine", frequency: 520, frequencyEnd: 780, gain: 0.06, duration: 0.1 },
      { wave: "sine", frequency: 690, frequencyEnd: 1060, gain: 0.06, start: 0.055, duration: 0.1 },
    ],
  },
  "player-dodge": {
    tones: [{ wave: "sine", frequency: 180, frequencyEnd: 92, gain: 0.045, duration: 0.18 }],
    noises: [{ filter: "bandpass", frequency: 1200, frequencyEnd: 330, gain: 0.14, duration: 0.2 }],
  },
  "impact-katana": {
    tones: [{ wave: "triangle", frequency: 940, frequencyEnd: 260, gain: 0.1, duration: 0.09 }],
    noises: [{ filter: "highpass", frequency: 1800, gain: 0.14, duration: 0.08 }],
  },
  "impact-greatsword": {
    tones: [{ wave: "sine", frequency: 104, frequencyEnd: 44, gain: 0.2, duration: 0.24 }],
    noises: [{ filter: "lowpass", frequency: 720, frequencyEnd: 150, gain: 0.22, duration: 0.2 }],
  },
  "impact-twin-blades": {
    tones: [
      { wave: "triangle", frequency: 610, frequencyEnd: 180, gain: 0.08, duration: 0.08 },
      { wave: "triangle", frequency: 820, frequencyEnd: 220, gain: 0.08, start: 0.045, duration: 0.09 },
    ],
    noises: [{ filter: "bandpass", frequency: 1450, gain: 0.13, duration: 0.14 }],
  },
  "legacy-impact": {
    tones: [
      { wave: "sine", frequency: 132, frequencyEnd: 52, gain: 0.19, duration: 0.26 },
      { wave: "triangle", frequency: 620, frequencyEnd: 170, gain: 0.11, duration: 0.18 },
    ],
    noises: [{ filter: "lowpass", frequency: 1500, frequencyEnd: 260, gain: 0.24, duration: 0.25 }],
  },
  "enemy-bite-windup": {
    tones: [{ wave: "sawtooth", frequency: 155, frequencyEnd: 230, gain: 0.065, duration: 0.28 }],
    noises: [{ filter: "bandpass", frequency: 520, frequencyEnd: 820, gain: 0.08, duration: 0.26 }],
  },
  "enemy-bite-contact": {
    tones: [{ wave: "square", frequency: 310, frequencyEnd: 94, gain: 0.09, duration: 0.1 }],
    noises: [{ filter: "highpass", frequency: 1100, gain: 0.14, duration: 0.075 }],
  },
  "enemy-pounce-windup": {
    tones: [{ wave: "triangle", frequency: 230, frequencyEnd: 610, gain: 0.08, duration: 0.34 }],
    noises: [{ filter: "bandpass", frequency: 760, frequencyEnd: 1700, gain: 0.09, duration: 0.32 }],
  },
  "enemy-pounce-contact": {
    tones: [{ wave: "sawtooth", frequency: 210, frequencyEnd: 62, gain: 0.13, duration: 0.17 }],
    noises: [{ filter: "bandpass", frequency: 920, frequencyEnd: 280, gain: 0.17, duration: 0.15 }],
  },
  "enemy-slam-windup": {
    tones: [
      { wave: "sine", frequency: 48, frequencyEnd: 82, gain: 0.14, duration: 0.52 },
      { wave: "sawtooth", frequency: 96, frequencyEnd: 160, gain: 0.055, duration: 0.48 },
    ],
  },
  "enemy-slam-contact": {
    tones: [{ wave: "sine", frequency: 66, frequencyEnd: 31, gain: 0.24, duration: 0.38 }],
    noises: [{ filter: "lowpass", frequency: 640, frequencyEnd: 95, gain: 0.26, duration: 0.32 }],
  },
  "enemy-death": {
    tones: [
      { wave: "sawtooth", frequency: 190, frequencyEnd: 54, gain: 0.085, duration: 0.5 },
      { wave: "sine", frequency: 78, frequencyEnd: 39, gain: 0.1, start: 0.08, duration: 0.45 },
    ],
    noises: [{ filter: "lowpass", frequency: 840, frequencyEnd: 120, gain: 0.12, duration: 0.48 }],
  },
  "player-damage": {
    tones: [{ wave: "sawtooth", frequency: 154, frequencyEnd: 72, gain: 0.12, duration: 0.2 }],
    noises: [{ filter: "bandpass", frequency: 560, frequencyEnd: 210, gain: 0.17, duration: 0.18 }],
  },
  "upgrade-selected": {
    tones: [
      { wave: "sine", frequency: 440, frequencyEnd: 660, gain: 0.07, duration: 0.16 },
      { wave: "sine", frequency: 660, frequencyEnd: 990, gain: 0.07, start: 0.12, duration: 0.18 },
      { wave: "sine", frequency: 880, frequencyEnd: 1320, gain: 0.075, start: 0.24, duration: 0.24 },
    ],
  },
  "wave-cleared": {
    tones: [
      { wave: "triangle", frequency: 196, frequencyEnd: 294, gain: 0.07, duration: 0.2 },
      { wave: "triangle", frequency: 294, frequencyEnd: 440, gain: 0.07, start: 0.14, duration: 0.22 },
    ],
  },
  "run-victory": {
    tones: [
      { wave: "sine", frequency: 220, frequencyEnd: 440, gain: 0.085, duration: 0.42 },
      { wave: "sine", frequency: 330, frequencyEnd: 660, gain: 0.075, start: 0.12, duration: 0.48 },
      { wave: "sine", frequency: 440, frequencyEnd: 880, gain: 0.07, start: 0.24, duration: 0.58 },
    ],
  },
  "run-defeat": {
    tones: [
      { wave: "sawtooth", frequency: 220, frequencyEnd: 55, gain: 0.11, duration: 0.7 },
      { wave: "sine", frequency: 92, frequencyEnd: 34, gain: 0.13, start: 0.1, duration: 0.75 },
    ],
    noises: [{ filter: "lowpass", frequency: 520, frequencyEnd: 80, gain: 0.12, duration: 0.68 }],
  },
} as const satisfies Record<GameplayAudioCue, CueRecipe>;

export interface GameAudioSettings {
  readonly master: number;
  readonly sfx: number;
  readonly ambience: number;
  readonly muted: boolean;
}

export interface GameAudioSnapshot extends GameAudioSettings {
  readonly unlocked: boolean;
  readonly paused: boolean;
  readonly activeVoices: number;
}

export interface GameAudioOptions {
  readonly contextFactory?: () => AudioContext;
  readonly ambienceEnabled?: boolean;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function browserAudioContext(): AudioContext {
  const scope = globalThis as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  const Constructor = scope.AudioContext ?? scope.webkitAudioContext;
  if (!Constructor) throw new Error("Web Audio is unavailable");
  return new Constructor({ latencyHint: "interactive" });
}

export class GameAudio {
  private readonly contextFactory: () => AudioContext;
  private readonly ambienceEnabled: boolean;
  private readonly gestureTargets = new Set<EventTarget>();
  private context: AudioContext | null = null;
  private masterBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private ambienceBus: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private ambienceSources: AudioScheduledSourceNode[] = [];
  private ambienceNodes: AudioNode[] = [];
  private unlockAttempt: Promise<boolean> | null = null;
  private unlocked = false;
  private paused = false;
  private disposed = false;
  private activeVoices = 0;
  private settings: GameAudioSettings = {
    master: 0.72,
    sfx: 0.86,
    ambience: 0.24,
    muted: false,
  };

  constructor(options: GameAudioOptions = {}) {
    this.contextFactory = options.contextFactory ?? browserAudioContext;
    this.ambienceEnabled = options.ambienceEnabled ?? true;
  }

  attachGestureUnlock(target: EventTarget): void {
    if (this.disposed || this.gestureTargets.has(target)) return;
    this.gestureTargets.add(target);
    target.addEventListener("pointerdown", this.onGesture, { capture: true, passive: true });
    target.addEventListener("touchstart", this.onGesture, { capture: true, passive: true });
    target.addEventListener("keydown", this.onGesture, { capture: true });
  }

  async unlock(): Promise<boolean> {
    if (this.disposed) return false;
    if (this.unlocked && this.context?.state === "running") return true;
    if (this.unlockAttempt) return this.unlockAttempt;
    this.unlockAttempt = this.performUnlock();
    const result = await this.unlockAttempt;
    this.unlockAttempt = null;
    return result;
  }

  getSnapshot(): GameAudioSnapshot {
    return {
      ...this.settings,
      unlocked: this.unlocked,
      paused: this.paused,
      activeVoices: this.activeVoices,
    };
  }

  setMasterVolume(value: number): void {
    this.settings = { ...this.settings, master: clamp01(value) };
    this.updateBusGains();
  }

  setSfxVolume(value: number): void {
    this.settings = { ...this.settings, sfx: clamp01(value) };
    this.updateBusGains();
  }

  setAmbienceVolume(value: number): void {
    this.settings = { ...this.settings, ambience: clamp01(value) };
    this.updateBusGains();
  }

  setMuted(muted: boolean): void {
    this.settings = { ...this.settings, muted };
    this.updateBusGains();
  }

  setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    this.updateBusGains();
  }

  playCue(cue: GameplayAudioCue): boolean {
    const context = this.context;
    const output = this.sfxBus;
    if (
      !this.unlocked ||
      !context ||
      !output ||
      context.state !== "running" ||
      this.disposed ||
      this.paused ||
      this.settings.muted ||
      this.settings.master <= 0 ||
      this.settings.sfx <= 0 ||
      this.activeVoices >= MAX_ACTIVE_VOICES
    ) {
      return false;
    }

    const recipe: CueRecipe = CUE_RECIPES[cue];
    const sources: AudioScheduledSourceNode[] = [];
    const nodes: AudioNode[] = [];
    let tail: AudioScheduledSourceNode | null = null;
    let tailEnd = 0;
    const baseTime = context.currentTime + 0.005;

    for (const tone of recipe.tones ?? []) {
      const start = baseTime + (tone.start ?? 0);
      const end = start + tone.duration;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = tone.wave;
      oscillator.frequency.setValueAtTime(tone.frequency, start);
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(1, tone.frequencyEnd ?? tone.frequency),
        end,
      );
      gain.gain.setValueAtTime(MIN_GAIN, start);
      gain.gain.exponentialRampToValueAtTime(tone.gain, start + Math.min(0.012, tone.duration * 0.2));
      gain.gain.exponentialRampToValueAtTime(MIN_GAIN, end);
      oscillator.connect(gain).connect(output);
      oscillator.start(start);
      oscillator.stop(end + 0.01);
      sources.push(oscillator);
      nodes.push(oscillator, gain);
      if (end > tailEnd) {
        tail = oscillator;
        tailEnd = end;
      }
    }

    for (const noise of recipe.noises ?? []) {
      const start = baseTime + (noise.start ?? 0);
      const end = start + noise.duration;
      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();
      source.buffer = this.getNoiseBuffer(context);
      filter.type = noise.filter;
      filter.Q.value = noise.filter === "bandpass" ? 0.8 : 0.42;
      filter.frequency.setValueAtTime(noise.frequency, start);
      filter.frequency.exponentialRampToValueAtTime(
        Math.max(1, noise.frequencyEnd ?? noise.frequency),
        end,
      );
      gain.gain.setValueAtTime(MIN_GAIN, start);
      gain.gain.exponentialRampToValueAtTime(noise.gain, start + Math.min(0.009, noise.duration * 0.18));
      gain.gain.exponentialRampToValueAtTime(MIN_GAIN, end);
      source.connect(filter).connect(gain).connect(output);
      source.start(start, 0, noise.duration);
      sources.push(source);
      nodes.push(source, filter, gain);
      if (end > tailEnd) {
        tail = source;
        tailEnd = end;
      }
    }

    if (!tail) return false;
    this.activeVoices += 1;
    tail.onended = () => {
      for (const source of sources) source.onended = null;
      for (const node of nodes) node.disconnect();
      this.activeVoices = Math.max(0, this.activeVoices - 1);
    };
    return true;
  }

  playCues(cues: readonly GameplayAudioCue[]): number {
    let played = 0;
    for (const cue of cues) played += Number(this.playCue(cue));
    return played;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const target of this.gestureTargets) {
      target.removeEventListener("pointerdown", this.onGesture, true);
      target.removeEventListener("touchstart", this.onGesture, true);
      target.removeEventListener("keydown", this.onGesture, true);
    }
    this.gestureTargets.clear();
    for (const source of this.ambienceSources) {
      try {
        source.stop();
      } catch {
        // A source may already have ended during page teardown.
      }
    }
    for (const node of this.ambienceNodes) node.disconnect();
    this.ambienceSources = [];
    this.ambienceNodes = [];
    const context = this.context;
    this.context = null;
    this.masterBus = null;
    this.sfxBus = null;
    this.ambienceBus = null;
    this.unlocked = false;
    if (context && context.state !== "closed") void context.close().catch(() => undefined);
  }

  private async performUnlock(): Promise<boolean> {
    try {
      const context = this.context ?? this.contextFactory();
      this.context = context;
      this.ensureAudioGraph(context);
      if (context.state === "suspended") await context.resume();
      this.unlocked = context.state === "running";
      if (this.unlocked) {
        if (this.ambienceEnabled) this.startAmbience(context);
        this.updateBusGains();
      }
      return this.unlocked;
    } catch {
      this.unlocked = false;
      return false;
    }
  }

  private ensureAudioGraph(context: AudioContext): void {
    if (this.masterBus && this.sfxBus && this.ambienceBus) return;
    this.masterBus = context.createGain();
    this.sfxBus = context.createGain();
    this.ambienceBus = context.createGain();
    this.sfxBus.connect(this.masterBus);
    this.ambienceBus.connect(this.masterBus);
    this.masterBus.connect(context.destination);
    this.updateBusGains();
  }

  private updateBusGains(): void {
    const context = this.context;
    if (!context || !this.masterBus || !this.sfxBus || !this.ambienceBus) return;
    const now = context.currentTime;
    this.masterBus.gain.setTargetAtTime(
      this.settings.muted ? 0 : this.settings.master,
      now,
      0.012,
    );
    this.sfxBus.gain.setTargetAtTime(this.paused ? 0 : this.settings.sfx, now, 0.01);
    this.ambienceBus.gain.setTargetAtTime(
      this.paused ? 0 : this.settings.ambience,
      now,
      this.paused ? 0.035 : 0.18,
    );
  }

  private startAmbience(context: AudioContext): void {
    if (this.ambienceSources.length > 0 || !this.ambienceBus) return;
    const droneA = context.createOscillator();
    const droneB = context.createOscillator();
    const droneGainA = context.createGain();
    const droneGainB = context.createGain();
    droneA.type = "sine";
    droneA.frequency.value = 43.65;
    droneB.type = "triangle";
    droneB.frequency.value = 65.41;
    droneGainA.gain.value = 0.045;
    droneGainB.gain.value = 0.018;
    droneA.connect(droneGainA).connect(this.ambienceBus);
    droneB.connect(droneGainB).connect(this.ambienceBus);

    const wind = context.createBufferSource();
    const windFilter = context.createBiquadFilter();
    const windGain = context.createGain();
    wind.buffer = this.getNoiseBuffer(context);
    wind.loop = true;
    windFilter.type = "bandpass";
    windFilter.frequency.value = 310;
    windFilter.Q.value = 0.32;
    windGain.gain.value = 0.035;
    wind.connect(windFilter).connect(windGain).connect(this.ambienceBus);

    const now = context.currentTime;
    droneA.start(now);
    droneB.start(now);
    wind.start(now);
    this.ambienceSources = [droneA, droneB, wind];
    this.ambienceNodes = [droneA, droneB, droneGainA, droneGainB, wind, windFilter, windGain];
  }

  private getNoiseBuffer(context: AudioContext): AudioBuffer {
    if (this.noiseBuffer) return this.noiseBuffer;
    const length = Math.max(1, Math.floor(context.sampleRate));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const channel = buffer.getChannelData(0);
    let state = 0x51f0_7a3d;
    for (let index = 0; index < channel.length; index += 1) {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      channel[index] = ((state >>> 0) / 0x8000_0000 - 1) * 0.72;
    }
    this.noiseBuffer = buffer;
    return buffer;
  }

  private readonly onGesture = (): void => {
    void this.unlock();
  };
}
