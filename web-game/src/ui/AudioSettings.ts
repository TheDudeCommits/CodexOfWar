import type { GameAudio } from "../audio/GameAudio";

function createRange(
  document: Document,
  labelText: string,
  value: number,
  onInput: (value: number) => void,
): HTMLLabelElement {
  const label = document.createElement("label");
  label.className = "audio-settings__range";
  const caption = document.createElement("span");
  caption.textContent = labelText;
  const input = document.createElement("input");
  input.type = "range";
  input.min = "0";
  input.max = "100";
  input.step = "1";
  input.value = String(Math.round(value * 100));
  input.setAttribute("aria-label", `${labelText} volume`);
  input.addEventListener("input", () => onInput(Number(input.value) / 100));
  label.append(caption, input);
  return label;
}

export class AudioSettings {
  private readonly root: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly toggleButton: HTMLButtonElement;
  private readonly muteButton: HTMLButtonElement;
  private expanded = false;

  constructor(host: HTMLElement, private readonly audio: GameAudio) {
    const document = host.ownerDocument;
    this.root = document.createElement("aside");
    this.root.className = "audio-settings";
    this.root.setAttribute("aria-label", "Audio settings");

    this.toggleButton = document.createElement("button");
    this.toggleButton.type = "button";
    this.toggleButton.className = "audio-settings__toggle";
    this.toggleButton.textContent = "AUDIO";
    this.toggleButton.setAttribute("aria-expanded", "false");
    this.toggleButton.addEventListener("click", () => this.setExpanded(!this.expanded));

    this.panel = document.createElement("div");
    this.panel.className = "audio-settings__panel";
    this.panel.hidden = true;

    this.muteButton = document.createElement("button");
    this.muteButton.type = "button";
    this.muteButton.className = "audio-settings__mute";
    this.muteButton.addEventListener("click", () => {
      const nextMuted = !this.audio.getSnapshot().muted;
      this.audio.setMuted(nextMuted);
      this.updateMuteButton();
    });
    this.updateMuteButton();

    const settings = audio.getSnapshot();
    this.panel.append(
      this.muteButton,
      createRange(document, "Master", settings.master, (value) => audio.setMasterVolume(value)),
      createRange(document, "SFX", settings.sfx, (value) => audio.setSfxVolume(value)),
      createRange(document, "Ambience", settings.ambience, (value) =>
        audio.setAmbienceVolume(value)),
    );
    this.root.append(this.toggleButton, this.panel);
    host.append(this.root);
  }

  dispose(): void {
    this.root.remove();
  }

  private setExpanded(expanded: boolean): void {
    this.expanded = expanded;
    this.panel.hidden = !expanded;
    this.toggleButton.setAttribute("aria-expanded", String(expanded));
    this.root.classList.toggle("is-expanded", expanded);
  }

  private updateMuteButton(): void {
    const muted = this.audio.getSnapshot().muted;
    this.muteButton.textContent = muted ? "SOUND OFF" : "SOUND ON";
    this.muteButton.setAttribute("aria-pressed", String(muted));
  }
}
