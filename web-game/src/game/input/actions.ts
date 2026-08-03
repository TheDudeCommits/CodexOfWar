export const ACTION_BINDINGS = {
  moveForward: ["KeyW", "ArrowUp"],
  moveBackward: ["KeyS", "ArrowDown"],
  moveLeft: ["KeyA", "ArrowLeft"],
  moveRight: ["KeyD", "ArrowRight"],
  sprint: ["ShiftLeft", "ShiftRight"],
  dodge: ["Space"],
  attack: ["Mouse0", "KeyJ"],
  specialAttack: ["Mouse2", "KeyK"],
  weaponOne: ["Digit1", "Numpad1"],
  weaponTwo: ["Digit2", "Numpad2"],
  weaponThree: ["Digit3", "Numpad3"],
  restart: ["KeyR", "Enter"],
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
  specialAttackPressed: boolean;
  weaponSlotPressed: 1 | 2 | 3 | null;
  restartPressed: boolean;
  lockPressed: boolean;
  diagnosticsPressed: boolean;
  postPressed: boolean;
  capturePressed: boolean;
  pausePressed: boolean;
  lookX: number;
  lookY: number;
}
