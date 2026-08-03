export const ACTION_BINDINGS = {
  moveForward: ["KeyW", "ArrowUp"],
  moveBackward: ["KeyS", "ArrowDown"],
  moveLeft: ["KeyA", "ArrowLeft"],
  moveRight: ["KeyD", "ArrowRight"],
  sprint: ["ShiftLeft", "ShiftRight"],
  dodge: ["Space"],
  attack: ["Mouse0", "KeyJ"],
  heavyAttack: ["Mouse2", "KeyK"],
  lockOn: ["KeyQ"],
  diagnostics: ["F3"],
  postProcessing: ["KeyP"],
  capture: ["KeyC"],
  pause: ["Escape"],
} as const;

export interface InputSnapshot {
  moveX: number;
  moveZ: number;
  sprint: boolean;
  dodgePressed: boolean;
  attackPressed: boolean;
  attackSource: "mouse-left" | "keyboard" | null;
  heavyAttackPressed: boolean;
  heavyAttackSource: "mouse-right" | "keyboard" | null;
  lockPressed: boolean;
  diagnosticsPressed: boolean;
  postPressed: boolean;
  capturePressed: boolean;
  pausePressed: boolean;
  lookX: number;
  lookY: number;
}
