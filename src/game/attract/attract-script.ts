/**
 * Role: Decode le script automatique du mode attract original.
 * Scope: Reproduit les registres logiques $CE31, $CE33 et $CE34 sans executer de code 6809.
 * ISO: Les commandes viennent de la table lue en ASM a $D878 par la routine $CE13-$CE49.
 * Notes: Ce module ne deplace pas le joueur; il fournit seulement une intention exploitable par le runtime moderne.
 */

/** Octet ASM qui marque la fin du script attract. */
export const ATTRACT_SCRIPT_END_BYTE = 0xdd;

/** Adresse originale de la table de commandes attract. */
export const ATTRACT_SCRIPT_SOURCE_ADDRESS = 0xd878;

/** Commande ASM de deplacement vers le haut. */
const ATTRACT_COMMAND_UP = 0x01;

/** Commande ASM de deplacement vers la droite. */
const ATTRACT_COMMAND_RIGHT = 0x03;

/** Commande ASM de deplacement vers le bas. */
const ATTRACT_COMMAND_DOWN = 0x05;

/** Commande ASM de deplacement vers la gauche. */
const ATTRACT_COMMAND_LEFT = 0x07;

/** Flux de commandes lu en memoire chargee depuis $D878, jusqu'au marqueur $DD inclus. */
export const ATTRACT_SCRIPT_BYTES = [
  0x11, 0x08, 0x13, 0x08, 0x15, 0x03, 0x13, 0x07, 0x11, 0x03, 0x15, 0x03,
  0x13, 0x0C, 0x11, 0x03, 0x15, 0x03, 0x13, 0x09, 0x17, 0x18, 0x01, 0x01,
  0x05, 0x05, 0x17, 0x04, 0x11, 0x03, 0x17, 0x08, 0x15, 0x09, 0x03, 0x03,
  0x10, 0x40, 0x15, 0x0A, 0x13, 0x18, 0x11, 0x08, 0x17, 0x03, 0x03, 0x03,
  0x01, 0x01, 0x15, 0x04, 0x13, 0x06, 0x17, 0x04, 0x01, 0x01, 0x13, 0x08,
  0x00, 0x00, 0x15, 0x05, 0x03, 0x01, 0x17, 0x03, 0x05, 0x13, 0x03, 0x05,
  0x07, 0x05, 0x05, 0x17, 0x09, 0x11, 0x06, 0x13, 0x05, 0x17, 0x05, 0x15,
  0x06, 0x17, 0x04, 0x11, 0x03, 0x07, 0x01, 0x00, 0x00, 0x01, 0x01,
  0xDD
] as const;

/** Direction logique produite par une commande attract de mouvement. */
export type AttractScriptDirection = "up" | "right" | "down" | "left";

/** Intention produite par le script attract pour un tick logique. */
export type AttractScriptIntent =
  | {
      /** Nature de l'intention produite. */
      readonly type: "move";
      /** Direction de deplacement demandee. */
      readonly direction: AttractScriptDirection;
      /** Commande brute ASM ayant produit l'intention. */
      readonly command: number;
    }
  | {
      /** Nature de l'intention produite. */
      readonly type: "idle";
      /** Commande brute ASM sans branche de mouvement directe. */
      readonly command: number;
    }
  | {
      /** Nature de l'intention produite. */
      readonly type: "end";
    };

/** Etat mutable equivalent aux variables ASM $CE31, $CE33 et $CE34. */
export interface AttractScriptState {
  /** Equivalent de $CE31: index courant dans la table $D878. */
  scriptIndex: number;
  /** Equivalent de $CE33: commande longue courante. */
  currentCommand: number;
  /** Equivalent de $CE34: repetitions restantes pour la commande courante. */
  remainingDuration: number;
  /** Indique que le marqueur $DD a ete atteint. */
  ended: boolean;
}

/** Cree un etat de script attract identique a l'initialisation ASM par remise a zero. */
export function createInitialAttractScriptState(): AttractScriptState {
  return {
    scriptIndex: 0,
    currentCommand: 0,
    remainingDuration: 0,
    ended: false
  };
}

/** Lit la prochaine intention du script attract en reproduisant la logique $CE13-$CE49. */
export function readNextAttractScriptIntent(state: AttractScriptState): AttractScriptIntent {
  if (state.ended) {
    return { type: "end" };
  }

  if (state.remainingDuration > 0) {
    state.remainingDuration -= 1;
    return mapAttractCommandToIntent(state.currentCommand);
  }

  const scriptByte = ATTRACT_SCRIPT_BYTES[state.scriptIndex];
  state.scriptIndex += 1;

  if (scriptByte === ATTRACT_SCRIPT_END_BYTE || scriptByte === undefined) {
    state.ended = true;
    return { type: "end" };
  }

  if (scriptByte >= 0x10) {
    state.currentCommand = scriptByte & 0x0f;
    state.remainingDuration = ATTRACT_SCRIPT_BYTES[state.scriptIndex] ?? 0;
    state.scriptIndex += 1;
    state.remainingDuration = Math.max(0, state.remainingDuration - 1);
    return mapAttractCommandToIntent(state.currentCommand);
  }

  return mapAttractCommandToIntent(scriptByte);
}

/** Convertit une commande ASM en intention moderne. */
export function mapAttractCommandToIntent(command: number): AttractScriptIntent {
  switch (command) {
    case ATTRACT_COMMAND_UP:
      return { type: "move", direction: "up", command };
    case ATTRACT_COMMAND_RIGHT:
      return { type: "move", direction: "right", command };
    case ATTRACT_COMMAND_DOWN:
      return { type: "move", direction: "down", command };
    case ATTRACT_COMMAND_LEFT:
      return { type: "move", direction: "left", command };
    default:
      return { type: "idle", command };
  }
}
