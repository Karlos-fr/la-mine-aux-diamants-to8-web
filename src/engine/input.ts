/**
 * Abstraction clavier du moteur.
 *
 * Ce module convertit les touches physiques du navigateur en actions de jeu
 * stables, puis expose un snapshot par frame.
 */

/** Actions logiques consommees par les scenes. */
export type InputAction =
  | "up"
  | "down"
  | "left"
  | "right"
  | "confirm"
  | "action"
  | "cancel";

/** Etat de pointeur expose aux scenes qui utilisent la souris. */
export interface PointerInputState {
  /** Coordonne X logique dans le canvas 320x200. */
  readonly x: number;

  /** Coordonne Y logique dans le canvas 320x200. */
  readonly y: number;

  /** Indique si le pointeur est au-dessus de la surface logique. */
  readonly inside: boolean;

  /** Bouton principal maintenu. */
  readonly pressed: boolean;

  /** Bouton principal active sur cette frame. */
  readonly justPressed: boolean;

  /** Bouton principal relache sur cette frame. */
  readonly justReleased: boolean;

  /** Bouton secondaire maintenu. */
  readonly rightPressed: boolean;

  /** Bouton secondaire active sur cette frame. */
  readonly rightJustPressed: boolean;

  /** Bouton secondaire relache sur cette frame. */
  readonly rightJustReleased: boolean;

  /** Delta molette accumule depuis la frame precedente. */
  readonly wheelDeltaY: number;
}

/** Etat complet d'input pour une frame de simulation. */
export interface InputState {
  /** Actions maintenues enfoncees. */
  readonly pressed: Readonly<Record<InputAction, boolean>>;

  /** Actions devenues actives depuis le dernier commit. */
  readonly justPressed: Readonly<Record<InputAction, boolean>>;

  /** Actions relachees depuis le dernier commit. */
  readonly justReleased: Readonly<Record<InputAction, boolean>>;

  /** Axe horizontal normalise. */
  readonly horizontal: -1 | 0 | 1;

  /** Axe vertical normalise. */
  readonly vertical: -1 | 0 | 1;

  /** Etat pointeur optionnel mais toujours initialise. */
  readonly pointer: PointerInputState;
}

/** Liste canonique des actions a exposer dans chaque snapshot. */
const ACTIONS: readonly InputAction[] = [
  "up",
  "down",
  "left",
  "right",
  "confirm",
  "action",
  "cancel"
];

/** Correspondance entre codes clavier navigateur et actions de jeu. */
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

/** Ecoute le clavier et produit des snapshots d'actions independants du DOM. */
export class KeyboardInput {
  /** Actions actuellement maintenues. */
  private readonly current = new Set<InputAction>();

  /** Actions maintenues lors du snapshot precedent. */
  private readonly previous = new Set<InputAction>();
  /** Etat courant du bouton principal. */
  private pointerPressed = false;
  /** Etat courant du bouton secondaire. */
  private pointerRightPressed = false;
  /** Etat precedent du bouton principal. */
  private previousPointerPressed = false;
  /** Etat precedent du bouton secondaire. */
  private previousPointerRightPressed = false;
  /** Position X logique du pointeur. */
  private pointerX = 0;
  /** Position Y logique du pointeur. */
  private pointerY = 0;
  /** Presence du pointeur dans le canvas. */
  private pointerInside = false;
  /** Delta molette accumule. */
  private wheelDeltaY = 0;

  /** Handler stable pour pouvoir detacher proprement `keydown`. */
  private readonly keyDownHandler: EventListener = (event) => {
    if (event instanceof KeyboardEvent) {
      this.onKeyDown(event);
    }
  };
  /** Handler stable pour pouvoir detacher proprement `keyup`. */
  private readonly keyUpHandler: EventListener = (event) => {
    if (event instanceof KeyboardEvent) {
      this.onKeyUp(event);
    }
  };
  /** Handler stable pour `pointermove`. */
  private readonly pointerMoveHandler: EventListener = (event) => {
    if (event instanceof PointerEvent) {
      this.onPointerMove(event);
    }
  };
  /** Handler stable pour `pointerdown`. */
  private readonly pointerDownHandler: EventListener = (event) => {
    if (event instanceof PointerEvent) {
      this.onPointerDown(event);
    }
  };
  /** Handler stable pour `pointerup`. */
  private readonly pointerUpHandler: EventListener = (event) => {
    if (event instanceof PointerEvent) {
      this.onPointerUp(event);
    }
  };
  /** Handler stable pour `pointerleave`. */
  private readonly pointerLeaveHandler: EventListener = () => {
    this.pointerInside = false;
    this.pointerPressed = false;
    this.pointerRightPressed = false;
  };
  /** Handler stable pour `wheel`. */
  private readonly wheelHandler: EventListener = (event) => {
    if (event instanceof WheelEvent) {
      this.onWheel(event);
    }
  };
  /** Handler stable pour bloquer le menu contextuel pendant l'edition. */
  private readonly contextMenuHandler: EventListener = (event) => {
    event.preventDefault();
  };

  /** Attache l'input a une cible DOM, `window` par defaut. */
  constructor(
    private readonly target: HTMLElement | Window = window,
    private readonly pointerTarget?: HTMLElement
  ) {
    this.target.addEventListener("keydown", this.keyDownHandler);
    this.target.addEventListener("keyup", this.keyUpHandler);
    this.pointerTarget?.addEventListener("pointermove", this.pointerMoveHandler);
    this.pointerTarget?.addEventListener("pointerdown", this.pointerDownHandler);
    this.pointerTarget?.addEventListener("pointerup", this.pointerUpHandler);
    this.pointerTarget?.addEventListener("pointerleave", this.pointerLeaveHandler);
    this.pointerTarget?.addEventListener("wheel", this.wheelHandler, { passive: false });
    this.pointerTarget?.addEventListener("contextmenu", this.contextMenuHandler);
  }

  /** Produit l'etat d'input courant sans modifier l'historique. */
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
      vertical: pressed.up === pressed.down ? 0 : pressed.up ? -1 : 1,
      pointer: {
        x: this.pointerX,
        y: this.pointerY,
        inside: this.pointerInside,
        pressed: this.pointerPressed,
        justPressed: this.pointerPressed && !this.previousPointerPressed,
        justReleased: !this.pointerPressed && this.previousPointerPressed,
        rightPressed: this.pointerRightPressed,
        rightJustPressed: this.pointerRightPressed && !this.previousPointerRightPressed,
        rightJustReleased: !this.pointerRightPressed && this.previousPointerRightPressed,
        wheelDeltaY: this.wheelDeltaY
      }
    };
  }

  /** Valide la frame courante comme reference pour les transitions suivantes. */
  commit(): void {
    this.previous.clear();
    for (const action of this.current) {
      this.previous.add(action);
    }
    this.previousPointerPressed = this.pointerPressed;
    this.previousPointerRightPressed = this.pointerRightPressed;
    this.wheelDeltaY = 0;
  }

  /** Detache les listeners et vide les etats internes. */
  dispose(): void {
    this.target.removeEventListener("keydown", this.keyDownHandler);
    this.target.removeEventListener("keyup", this.keyUpHandler);
    this.pointerTarget?.removeEventListener("pointermove", this.pointerMoveHandler);
    this.pointerTarget?.removeEventListener("pointerdown", this.pointerDownHandler);
    this.pointerTarget?.removeEventListener("pointerup", this.pointerUpHandler);
    this.pointerTarget?.removeEventListener("pointerleave", this.pointerLeaveHandler);
    this.pointerTarget?.removeEventListener("wheel", this.wheelHandler);
    this.pointerTarget?.removeEventListener("contextmenu", this.contextMenuHandler);
    this.current.clear();
    this.previous.clear();
  }

  /** Convertit un evenement `keydown` en actions maintenues. */
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

  /** Convertit un evenement `keyup` en relachement d'actions. */
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

  /** Met a jour la position logique du pointeur. */
  private onPointerMove(event: PointerEvent): void {
    this.updatePointerPosition(event);
  }

  /** Met a jour l'etat presse du pointeur. */
  private onPointerDown(event: PointerEvent): void {
    this.updatePointerPosition(event);
    if (event.button === 2) {
      this.pointerRightPressed = true;
    } else {
      this.pointerPressed = true;
    }
    event.preventDefault();
  }

  /** Met a jour l'etat relache du pointeur. */
  private onPointerUp(event: PointerEvent): void {
    this.updatePointerPosition(event);
    if (event.button === 2) {
      this.pointerRightPressed = false;
    } else {
      this.pointerPressed = false;
    }
    event.preventDefault();
  }

  /** Cumule la molette pour le zoom editeur. */
  private onWheel(event: WheelEvent): void {
    this.wheelDeltaY += event.deltaY;
    event.preventDefault();
  }

  /** Convertit la position navigateur en coordonnees logiques. */
  private updatePointerPosition(event: PointerEvent): void {
    if (!this.pointerTarget) {
      return;
    }

    const bounds = this.pointerTarget.getBoundingClientRect();
    const logicalWidth = this.pointerTarget instanceof HTMLCanvasElement ? this.pointerTarget.width : this.pointerTarget.clientWidth;
    const logicalHeight = this.pointerTarget instanceof HTMLCanvasElement ? this.pointerTarget.height : this.pointerTarget.clientHeight;
    this.pointerX = bounds.width === 0 ? 0 : ((event.clientX - bounds.left) / bounds.width) * logicalWidth;
    this.pointerY = bounds.height === 0 ? 0 : ((event.clientY - bounds.top) / bounds.height) * logicalHeight;
    this.pointerInside =
      event.clientX >= bounds.left &&
      event.clientX <= bounds.right &&
      event.clientY >= bounds.top &&
      event.clientY <= bounds.bottom;
  }

  /** Cree un record booleen complet pour toutes les actions connues. */
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
