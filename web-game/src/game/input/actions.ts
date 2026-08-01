export const ACTION_BINDINGS = {
  moveForward: ["KeyW", "ArrowUp"],
  moveBackward: ["KeyS", "ArrowDown"],
  moveLeft: ["KeyA", "ArrowLeft"],
  moveRight: ["KeyD", "ArrowRight"],
  sprint: ["ShiftLeft", "ShiftRight"],
  dodge: ["Space"],
  attack: ["Mouse0", "KeyJ"],
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
  lockPressed: boolean;
  diagnosticsPressed: boolean;
  postPressed: boolean;
  capturePressed: boolean;
  pausePressed: boolean;
  lookX: number;
  lookY: number;
}
