export type InputAction =
  | "up"
  | "down"
  | "left"
  | "right"
  | "confirm"
  | "action"
  | "cancel";

export interface InputState {
  readonly pressed: Readonly<Record<InputAction, boolean>>;
  readonly justPressed: Readonly<Record<InputAction, boolean>>;
  readonly justReleased: Readonly<Record<InputAction, boolean>>;
  readonly horizontal: -1 | 0 | 1;
  readonly vertical: -1 | 0 | 1;
}

const ACTIONS: readonly InputAction[] = [
  "up",
  "down",
  "left",
  "right",
  "confirm",
  "action",
  "cancel"
];

const KEYBOARD_MAP: Readonly<Record<string, readonly InputAction[]>> = {
  ArrowUp: ["up"],
  ArrowDown: ["down"],
  ArrowLeft: ["left"],
  ArrowRight: ["right"],
  Space: ["confirm", "action"],
  ControlLeft: ["action"],
  ControlRight: ["action"],
  Enter: ["confirm"],
  Escape: ["cancel"]
};

export class KeyboardInput {
  private readonly current = new Set<InputAction>();
  private readonly previous = new Set<InputAction>();
  private readonly keyDownHandler: EventListener = (event) => {
    if (event instanceof KeyboardEvent) {
      this.onKeyDown(event);
    }
  };
  private readonly keyUpHandler: EventListener = (event) => {
    if (event instanceof KeyboardEvent) {
      this.onKeyUp(event);
    }
  };

  constructor(private readonly target: HTMLElement | Window = window) {
    this.target.addEventListener("keydown", this.keyDownHandler);
    this.target.addEventListener("keyup", this.keyUpHandler);
  }

  snapshot(): InputState {
    const pressed = this.createActionRecord((action) => this.current.has(action));
    const justPressed = this.createActionRecord(
      (action) => this.current.has(action) && !this.previous.has(action)
    );
    const justReleased = this.createActionRecord(
      (action) => !this.current.has(action) && this.previous.has(action)
    );

    return {
      pressed,
      justPressed,
      justReleased,
      horizontal: pressed.left === pressed.right ? 0 : pressed.left ? -1 : 1,
      vertical: pressed.up === pressed.down ? 0 : pressed.up ? -1 : 1
    };
  }

  commit(): void {
    this.previous.clear();
    for (const action of this.current) {
      this.previous.add(action);
    }
  }

  dispose(): void {
    this.target.removeEventListener("keydown", this.keyDownHandler);
    this.target.removeEventListener("keyup", this.keyUpHandler);
    this.current.clear();
    this.previous.clear();
  }

  private onKeyDown(event: KeyboardEvent): void {
    const actions = KEYBOARD_MAP[event.code];
    if (!actions) {
      return;
    }

    event.preventDefault();
    for (const action of actions) {
      this.current.add(action);
    }
  }

  private onKeyUp(event: KeyboardEvent): void {
    const actions = KEYBOARD_MAP[event.code];
    if (!actions) {
      return;
    }

    event.preventDefault();
    for (const action of actions) {
      this.current.delete(action);
    }
  }

  private createActionRecord(
    predicate: (action: InputAction) => boolean
  ): Record<InputAction, boolean> {
    const record = {} as Record<InputAction, boolean>;
    for (const action of ACTIONS) {
      record[action] = predicate(action);
    }
    return record;
  }
}
