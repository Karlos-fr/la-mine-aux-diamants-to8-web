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

  /** Attache l'input a une cible DOM, `window` par defaut. */
  constructor(private readonly target: HTMLElement | Window = window) {
    this.target.addEventListener("keydown", this.keyDownHandler);
    this.target.addEventListener("keyup", this.keyUpHandler);
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
      vertical: pressed.up === pressed.down ? 0 : pressed.up ? -1 : 1
    };
  }

  /** Valide la frame courante comme reference pour les transitions suivantes. */
  commit(): void {
    this.previous.clear();
    for (const action of this.current) {
      this.previous.add(action);
    }
  }

  /** Detache les listeners et vide les etats internes. */
  dispose(): void {
    this.target.removeEventListener("keydown", this.keyDownHandler);
    this.target.removeEventListener("keyup", this.keyUpHandler);
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
