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
    const snapshot: InputSnapshot = {
      moveX,
      moveZ,
      sprint: anyDown(this.down, ACTION_BINDINGS.sprint),
      dodgePressed: this.consumePressed(ACTION_BINDINGS.dodge),
      attackPressed: this.consumePressed(ACTION_BINDINGS.attack),
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
      if (document.pointerLockElement !== this.canvas) void this.canvas?.requestPointerLock();
    }
  };

  private readonly onContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
  };
}
