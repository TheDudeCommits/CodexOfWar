import { ACTION_BINDINGS, type InputSnapshot } from "./actions";

export type LookCaptureMode = "none" | "pointer-lock" | "drag";

export interface LookCaptureTelemetry {
  readonly mode: LookCaptureMode;
  readonly pointerLocked: boolean;
  readonly dragging: boolean;
}

function anyDown(keys: ReadonlySet<string>, bindings: readonly string[]): boolean {
  return bindings.some((binding) => keys.has(binding));
}

export class InputController {
  private readonly down = new Set<string>();
  private readonly pressed = new Set<string>();
  private lookX = 0;
  private lookY = 0;
  private canvas: HTMLCanvasElement | null = null;
  private dragLookActive = false;
  private pointerLockPending = false;

  attach(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    window.addEventListener("keydown", this.onKeyDown, { passive: false });
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    window.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("pointercancel", this.onPointerUp);
    document.addEventListener("pointerlockchange", this.onPointerLockChange);
    document.addEventListener("pointerlockerror", this.onPointerLockError);
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("contextmenu", this.onContextMenu);
  }

  detach(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    window.removeEventListener("mousemove", this.onMouseMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("pointercancel", this.onPointerUp);
    document.removeEventListener("pointerlockchange", this.onPointerLockChange);
    document.removeEventListener("pointerlockerror", this.onPointerLockError);
    this.canvas?.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas?.removeEventListener("contextmenu", this.onContextMenu);
    this.suspendLookCapture();
    this.canvas = null;
  }

  getLookCaptureTelemetry(): LookCaptureTelemetry {
    const pointerLocked = document.pointerLockElement === this.canvas;
    return {
      mode: pointerLocked ? "pointer-lock" : this.dragLookActive ? "drag" : "none",
      pointerLocked,
      dragging: this.dragLookActive,
    };
  }

  /** Clears transient look state when gameplay input is gated by a modal or pause. */
  suspendLookCapture(): void {
    this.lookX = 0;
    this.lookY = 0;
    this.dragLookActive = false;
    this.pointerLockPending = false;
    if (document.pointerLockElement === this.canvas) void document.exitPointerLock();
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
      if (this.consumePressed(slots[index]!)) return (index + 1) as 1 | 2 | 3;
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
    this.suspendLookCapture();
  };

  private readonly onMouseMove = (event: MouseEvent): void => {
    if (document.pointerLockElement !== this.canvas && !this.dragLookActive) return;
    this.lookX += event.movementX;
    this.lookY += event.movementY;
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.button === 0) {
      this.pressed.add("Mouse0");
    } else if (event.button === 2) {
      this.pressed.add("Mouse2");
    } else return;

    // Pointer lock is preferred, but browsers and embedded review surfaces may
    // reject it. Pointer capture keeps click-drag look fully usable in that case.
    this.dragLookActive = true;
    try {
      this.canvas?.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is an optional fallback; window-level pointerup still
      // clears the drag if the browser declines it.
    }
    this.requestPointerLockSafely();
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (event.button !== 0 && event.button !== 2) return;
    this.dragLookActive = false;
    try {
      if (this.canvas?.hasPointerCapture(event.pointerId)) {
        this.canvas.releasePointerCapture(event.pointerId);
      }
    } catch {
      // The pointer may already have been released by pointer-lock or a modal.
    }
  };

  private readonly onPointerLockChange = (): void => {
    this.pointerLockPending = false;
    if (document.pointerLockElement === this.canvas) this.dragLookActive = false;
  };

  private readonly onPointerLockError = (): void => {
    this.pointerLockPending = false;
  };

  private requestPointerLockSafely(): void {
    const canvas = this.canvas;
    if (
      !canvas ||
      !canvas.isConnected ||
      canvas.ownerDocument !== document ||
      document.pointerLockElement === canvas ||
      this.pointerLockPending
    ) {
      return;
    }

    try {
      this.pointerLockPending = true;
      const request = canvas.requestPointerLock();
      if (request instanceof Promise) {
        // Pointer lock may be rejected when Chromium invalidates a document
        // between the physical click and the async browser request. This is a
        // normal input hand-off, not a runtime failure, and must never become
        // an unhandled WrongDocumentError rejection.
        void request.catch(() => undefined).finally(() => {
          this.pointerLockPending = false;
        });
      } else {
        this.pointerLockPending = false;
      }
    } catch {
      // Older implementations can throw synchronously for the same document
      // lifecycle race. The next connected click can request lock again.
      this.pointerLockPending = false;
    }
  }

  private readonly onContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
  };
}
