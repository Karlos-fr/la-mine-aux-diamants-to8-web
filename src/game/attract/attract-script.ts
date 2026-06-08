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

/** Direction logique produite par une commande attract de mouvement. */
export type AttractScriptDirection = "up" | "right" | "down" | "left";

/** Commande lisible du script attract, encodee ensuite au format ASM `$D878`. */
type AttractScriptCommand = AttractScriptDirection | "idle";

/** Etape declarative du script attract moderne. */
type AttractScriptStep =
  | {
      /** Commande a produire pendant une seule unite de script. */
      readonly type: "step";
      /** Direction ou attente sans deplacement. */
      readonly command: AttractScriptCommand;
    }
  | {
      /** Commande longue ASM `$1x, duree`. */
      readonly type: "repeat";
      /** Direction ou attente repetee. */
      readonly command: AttractScriptCommand;
      /** Nombre d'unites de script, octet suivant dans le flux ASM. */
      readonly duration: number;
    }
  | {
      /** Marqueur de fin ASM `$DD`. */
      readonly type: "end";
    };

/** Commande declarative d'attente, utile pour lire la pause attract. */
const IDLE = "idle";
/** Commande declarative vers le haut. */
const U = "up";
/** Commande declarative vers la droite. */
const R = "right";
/** Commande declarative vers le bas. */
const D = "down";
/** Commande declarative vers la gauche. */
const L = "left";

/** Correspondance entre commandes lisibles et codes attendus par le dispatch ASM. */
const ATTRACT_COMMAND_BYTES: Readonly<Record<AttractScriptCommand, number>> = {
  idle: 0x00,
  up: 0x01,
  right: 0x03,
  down: 0x05,
  left: 0x07
};

/** Octets originaux lus en memoire chargee depuis `$D878`; oracle de fidelite ASM. */
const ATTRACT_SCRIPT_ORIGINAL_BYTES = [
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

/** Script attract sous forme lisible, equivalent byte-perfect au flux ASM `$D878`. */
const ATTRACT_SCRIPT = [
  repeat(U, 8),
  repeat(R, 8),
  repeat(D, 3),
  repeat(R, 7),
  repeat(U, 3),
  repeat(D, 3),
  repeat(R, 12),
  repeat(U, 3),
  repeat(D, 3),
  repeat(R, 9),
  repeat(L, 24),
  step(U),
  step(U),
  step(D),
  step(D),
  repeat(L, 4),
  repeat(U, 3),
  repeat(L, 8),
  repeat(D, 9),
  step(R),
  step(R),
  repeat(IDLE, 64),
  repeat(D, 10),
  repeat(R, 24),
  repeat(U, 8),
  repeat(L, 3),
  step(R),
  step(R),
  step(U),
  step(U),
  repeat(D, 4),
  repeat(R, 6),
  repeat(L, 4),
  step(U),
  step(U),
  repeat(R, 8),
  step(IDLE),
  step(IDLE),
  repeat(D, 5),
  step(R),
  step(U),
  repeat(L, 3),
  step(D),
  repeat(R, 3),
  step(D),
  step(L),
  step(D),
  step(D),
  repeat(L, 9),
  repeat(U, 6),
  repeat(R, 5),
  repeat(L, 5),
  repeat(D, 6),
  repeat(L, 4),
  repeat(U, 3),
  step(L),
  step(U),
  step(IDLE),
  step(IDLE),
  step(U),
  step(U),
  end()
] as const;

/** Flux encode fourni au decodeur runtime, verifie contre l'oracle ASM au chargement. */
export const ATTRACT_SCRIPT_BYTES = encodeAttractScript(ATTRACT_SCRIPT);

assertAttractScriptMatchesOriginalBytes(ATTRACT_SCRIPT_BYTES, ATTRACT_SCRIPT_ORIGINAL_BYTES);

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

/** Cree une commande courte lisible du script attract. */
function step(command: AttractScriptCommand): AttractScriptStep {
  return { type: "step", command };
}

/** Cree une commande longue lisible, equivalente a `$10 | commande, duree`. */
function repeat(command: AttractScriptCommand, duration: number): AttractScriptStep {
  return { type: "repeat", command, duration };
}

/** Cree le marqueur de fin du script attract. */
function end(): AttractScriptStep {
  return { type: "end" };
}

/** Encode le script lisible en flux d'octets compatible avec la routine ASM `$CE13-$CE49`. */
function encodeAttractScript(script: readonly AttractScriptStep[]): number[] {
  const bytes: number[] = [];
  for (const item of script) {
    if (item.type === "end") {
      bytes.push(ATTRACT_SCRIPT_END_BYTE);
      continue;
    }

    const commandByte = ATTRACT_COMMAND_BYTES[item.command];
    if (item.type === "repeat") {
      bytes.push(0x10 | commandByte, item.duration);
      continue;
    }

    bytes.push(commandByte);
  }

  return bytes;
}

/** Verifie que le script declaratif reste byte-perfect avec l'extraction `$D878`. */
function assertAttractScriptMatchesOriginalBytes(
  encodedBytes: readonly number[],
  originalBytes: readonly number[]
): void {
  if (encodedBytes.length !== originalBytes.length) {
    throw new Error(`Script attract invalide: ${encodedBytes.length} octets encodes au lieu de ${originalBytes.length}.`);
  }

  for (let index = 0; index < originalBytes.length; index += 1) {
    if (encodedBytes[index] !== originalBytes[index]) {
      throw new Error(
        `Script attract invalide a l'offset ${index}: ${formatByte(encodedBytes[index])} encode au lieu de ${formatByte(originalBytes[index])}.`
      );
    }
  }
}

/** Formate un octet pour les erreurs de verification du script attract. */
function formatByte(value: number | undefined): string {
  return `0x${(value ?? 0).toString(16).toUpperCase().padStart(2, "0")}`;
}

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
    case ATTRACT_COMMAND_BYTES.up:
      return { type: "move", direction: "up", command };
    case ATTRACT_COMMAND_BYTES.right:
      return { type: "move", direction: "right", command };
    case ATTRACT_COMMAND_BYTES.down:
      return { type: "move", direction: "down", command };
    case ATTRACT_COMMAND_BYTES.left:
      return { type: "move", direction: "left", command };
    default:
      return { type: "idle", command };
  }
}
