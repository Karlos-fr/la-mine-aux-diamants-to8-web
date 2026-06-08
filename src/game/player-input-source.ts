/**
 * Role: Normalise les sources d'intention de mouvement joueur.
 * Scope: Fournit une interface commune pour le clavier moderne et le futur script attract ASM.
 * ISO: Le script attract s'appuie sur les commandes `$D878` decodees par `$CE13-$CE49`.
 * Notes: Les sources produisent seulement un delta de grille; collisions et effets restent dans `GameplayScene`.
 */

import type { InputState } from "../engine/input";
import {
  createInitialAttractScriptState,
  readNextAttractScriptIntent,
  type AttractScriptState
} from "./attract/attract-script";
import { getAttractScriptUnitDuration } from "./movement-timing";
import { resolvePressedPlayerMove } from "./systems/player-system";

/** Intention de mouvement joueur exprimee en delta de grille. */
export interface PlayerMoveIntent {
  /** Delta horizontal demande. */
  readonly x: number;
  /** Delta vertical demande. */
  readonly y: number;
}

/** Source abstraite d'intention joueur pour le runtime gameplay. */
export interface PlayerInputSource {
  /** Retourne le mouvement voulu pour le tick courant. */
  resolveMove(input: InputState): PlayerMoveIntent;
}

/** Source d'input joueur basee sur le clavier moderne existant. */
export class KeyboardPlayerInputSource implements PlayerInputSource {
  /** Convertit l'etat clavier courant en delta discret de grille. */
  resolveMove(input: InputState): PlayerMoveIntent {
    return resolvePressedPlayerMove(input.pressed);
  }
}

/** Source d'input joueur basee sur le script automatique du mode attract. */
export class AttractScriptInputSource implements PlayerInputSource {
  /** Etat mutable equivalent aux variables ASM `$CE31`, `$CE33`, `$CE34`. */
  private readonly scriptState: AttractScriptState = createInitialAttractScriptState();
  /** Derniere intention lue par le tick attract courant. */
  private currentIntent: ReturnType<typeof readNextAttractScriptIntent> = { type: "idle", command: 0 };
  /** Temps deja passe sur une intention d'attente attract. */
  private idleIntentElapsed = 0;
  /** Indique que l'attente courante doit encore retenir la lecture du script. */
  private idleIntentHolding = false;
  /** Indique que le marqueur `$DD` a ete atteint. */
  private ended = false;

  /** Avance le script d'une unite logique disponible, comme l'appel regulier a `$CDF9`. */
  advanceScriptTick(dt: number): void {
    if (this.ended) {
      return;
    }

    if (this.shouldHoldCurrentIdleIntent(dt)) {
      return;
    }

    const intent = readNextAttractScriptIntent(this.scriptState);
    if (intent.type === "end") {
      this.ended = true;
      this.currentIntent = intent;
      this.idleIntentHolding = false;
      return;
    }

    this.currentIntent = intent;
    this.idleIntentElapsed = 0;
    this.idleIntentHolding = intent.type === "idle";
  }

  /** Retient les commandes d'attente `0` pendant leur vraie unite de script attract. */
  private shouldHoldCurrentIdleIntent(dt: number): boolean {
    if (this.currentIntent.type !== "idle" || !this.idleIntentHolding) {
      return false;
    }

    this.idleIntentElapsed += dt;
    if (this.idleIntentElapsed < getAttractScriptUnitDuration()) {
      return true;
    }

    this.idleIntentElapsed -= getAttractScriptUnitDuration();
    this.idleIntentHolding = false;
    return false;
  }

  /** Convertit la commande courante du script en delta discret de grille. */
  resolveMove(_input: InputState): PlayerMoveIntent {
    const intent = this.currentIntent;

    if (intent.type === "idle") {
      return { x: 0, y: 0 };
    }

    if (intent.type === "end") {
      return { x: 0, y: 0 };
    }

    if (intent.direction === "up") {
      return { x: 0, y: -1 };
    }

    if (intent.direction === "right") {
      return { x: 1, y: 0 };
    }

    if (intent.direction === "down") {
      return { x: 0, y: 1 };
    }

    return { x: -1, y: 0 };
  }

  /** Indique si le script a atteint son marqueur de fin `$DD`. */
  isEnded(): boolean {
    return this.ended;
  }
}
