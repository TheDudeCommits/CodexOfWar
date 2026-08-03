import { ACTION_BINDINGS, type InputSnapshot } from "./actions";

function anyDown(keys: ReadonlySet<string>, bindings: readonly string[]): boolean {
  return bindings.some((binding) => keys.has(binding));
}

export class InputController {
  private readonly down = new Set<string>();
  private readonly pressed = new Set<string>();
  private lookX = 0;
  private lookY = 0;
  private canvas: HTMLCanvasElement | null = null;

  attach(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    window.addEventListener("keydown", this.onKeyDown, { passive: false });
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    window.addEventListener("mousemove", this.onMouseMove);
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("contextmenu", this.onContextMenu);
  }

  detach(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    window.removeEventListener("mousemove", this.onMouseMove);
    this.canvas?.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas?.removeEventListener("contextmenu", this.onContextMenu);
    this.canvas = null;
  }

  sample(): InputSnapshot {
    const moveX = Number(anyDown(this.down, ACTION_BINDINGS.moveRight)) -
      Number(anyDown(this.down, ACTION_BINDINGS.moveLeft));
    const moveZ = Number(anyDown(this.down, ACTION_BINDINGS.moveForward)) -
      Number(anyDown(this.down, ACTION_BINDINGS.moveBackward));
    const mouseAttackPressed = this.pressed.has("Mouse0");
    const keyboardAttackPressed = ACTION_BINDINGS.attack
      .filter((binding) => binding !== "Mouse0")
      .some((binding) => this.pressed.has(binding));
    const attackPressed = this.consumePressed(ACTION_BINDINGS.attack);
    const snapshot: InputSnapshot = {
      moveX,
      moveZ,
      sprint: anyDown(this.down, ACTION_BINDINGS.sprint),
      dodgePressed: this.consumePressed(ACTION_BINDINGS.dodge),
      attackPressed,
      attackSource: mouseAttackPressed
        ? "mouse-left"
        : keyboardAttackPressed
          ? "keyboard"
          : null,
      specialAttackPressed: this.consumePressed(ACTION_BINDINGS.specialAttack),
      weaponSlotPressed: this.consumeWeaponSlot(),
      restartPressed: this.consumePressed(ACTION_BINDINGS.restart),
      lockPressed: this.consumePressed(ACTION_BINDINGS.lockOn),
      diagnosticsPressed: this.consumePressed(ACTION_BINDINGS.diagnostics),
      postPressed: this.consumePressed(ACTION_BINDINGS.postProcessing),
      capturePressed: this.consumePressed(ACTION_BINDINGS.capture),
      pausePressed: this.consumePressed(ACTION_BINDINGS.pause),
      lookX: this.lookX,
      lookY: this.lookY,
    };
    this.lookX = 0;
    this.lookY = 0;
    return snapshot;
  }

  private consumePressed(bindings: readonly string[]): boolean {
    const wasPressed = bindings.some((binding) => this.pressed.has(binding));
    for (const binding of bindings) this.pressed.delete(binding);
    return wasPressed;
  }

  private consumeWeaponSlot(): 1 | 2 | 3 | null {
    const slots = [
      ACTION_BINDINGS.weaponOne,
      ACTION_BINDINGS.weaponTwo,
      ACTION_BINDINGS.weaponThree,
    ] as const;
    for (let index = 0; index < slots.length; index += 1) {
      if (this.consumePressed(slots[index])) return (index + 1) as 1 | 2 | 3;
    }
    return null;
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.code === "Space" || event.code.startsWith("Arrow")) event.preventDefault();
    if (!event.repeat) this.pressed.add(event.code);
    this.down.add(event.code);
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.down.delete(event.code);
  };

  private readonly onBlur = (): void => {
    this.down.clear();
    this.pressed.clear();
  };

  private readonly onMouseMove = (event: MouseEvent): void => {
    if (document.pointerLockElement !== this.canvas) return;
    this.lookX += event.movementX;
    this.lookY += event.movementY;
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.button === 0) {
      this.pressed.add("Mouse0");
      this.requestPointerLockSafely();
    } else if (event.button === 2) {
      this.pressed.add("Mouse2");
      this.requestPointerLockSafely();
    }
  };

  private requestPointerLockSafely(): void {
    const canvas = this.canvas;
    if (
      !canvas ||
      !canvas.isConnected ||
      canvas.ownerDocument !== document ||
      document.pointerLockElement === canvas
    ) {
      return;
    }

    try {
      const request = canvas.requestPointerLock();
      if (request instanceof Promise) {
        // Pointer lock may be rejected when Chromium invalidates a document
        // between the physical click and the async browser request. This is a
        // normal input hand-off, not a runtime failure, and must never become
        // an unhandled WrongDocumentError rejection.
        void request.catch(() => undefined);
      }
    } catch {
      // Older implementations can throw synchronously for the same document
      // lifecycle race. The next connected click can request lock again.
    }
  }

  private readonly onContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
  };
}
