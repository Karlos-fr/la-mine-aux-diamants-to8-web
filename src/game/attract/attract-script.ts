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

/** Flux de commandes lu par l'ASM depuis $D878, jusqu'au marqueur $DD inclus. */
export const ATTRACT_SCRIPT_BYTES = [
  0x1E, 0x89, 0x8D, 0x34, 0x25, 0x2F, 0x1F, 0x03, 0x8D, 0x2E, 0x25, 0x29,
  0xE7, 0xC0, 0x30, 0x1F, 0x26, 0xF6, 0x20, 0xD4, 0x8D, 0x22, 0x25, 0x1D,
  0x8D, 0x1E, 0x25, 0x19, 0x8D, 0x1A, 0x25, 0x15, 0x1E, 0x89, 0x8D, 0x14,
  0x25, 0x0F, 0xFD, 0xD8, 0x43, 0x8D, 0x0D, 0x25, 0x08, 0x96, 0xE6, 0x9B,
  0xF0, 0x4D, 0x26, 0x01, 0x39, 0x1A, 0x01, 0x39, 0x34, 0x7E, 0x86, 0x60,
  0x1F, 0x8B, 0x86, 0x55, 0x91, 0xFD, 0x27, 0x1D, 0x97, 0xFD, 0x86, 0x02,
  0x0D, 0x80, 0x27, 0x27, 0x0F, 0xF0, 0x86, 0x01, 0x97, 0x48, 0xBD, 0xE0,
  0x04, 0xB6, 0xD9, 0x7C, 0x97, 0x48, 0xBD, 0xE0, 0x04, 0x86, 0x02, 0x25,
  0x12, 0xD6, 0xEF, 0xD7, 0x49, 0x9E, 0xE9, 0x9F, 0x4F, 0x86, 0x01, 0xD6,
  0xE6, 0xC1, 0x01, 0x10, 0x27, 0x00, 0x0A, 0x97, 0xE5, 0x0F, 0xFD, 0x43,
  0x7D, 0x0F, 0xE5, 0x35, 0xFE, 0x0D, 0xF0, 0x26, 0x0C, 0xBD, 0xD9, 0x71,
  0x25, 0xEF, 0x86, 0x04, 0x5D, 0x27, 0xE8, 0x20, 0x18, 0x9E, 0xF3, 0x9C,
  0xF1, 0x26, 0x5E, 0x96, 0xF9, 0x91, 0xF5, 0x27, 0x08, 0x22, 0x23, 0x0F,
  0xE6, 0x0F, 0xF0, 0x20, 0xD8, 0x81, 0x09, 0x26, 0x19, 0x10, 0x9E, 0xED,
  0xBD, 0xE0, 0x1F, 0xD6, 0xF6, 0x5C, 0xA6, 0xA5, 0x97, 0xF6, 0xC6, 0x09,
  0xD7, 0xF9, 0x81, 0xC0, 0x25, 0x04, 0x84, 0x0F, 0x97, 0xF9, 0x9E, 0xE9,
  0x9F, 0xF3, 0xC6, 0x80, 0xB6, 0xD9, 0x7C, 0x81, 0x04, 0x27, 0x02, 0xCB,
  0x7F, 0x96, 0xF5, 0x91, 0xF9, 0x25, 0x02, 0xDC, 0xF7, 0x4F, 0x30, 0x8B,
  0x9F, 0xF1, 0x96, 0xFA, 0x0C, 0xFA, 0x0C, 0xF5, 0x97, 0x4C, 0xDC, 0xFB,
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
