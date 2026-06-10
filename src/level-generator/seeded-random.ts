/**
 * Role: Fournit un generateur pseudo-aleatoire deterministe pour les niveaux seedes.
 * Scope: Convertit des seeds texte/nombre en tirages reproductibles, sans utiliser `Math.random`.
 * ISO: Aucun comportement TO8 n'est porte ici; c'est un outil moderne pour la generation.
 * Notes: L'algorithme doit rester stable pour que les anciennes seeds regenerent les memes niveaux.
 */

/** Seed acceptee par le generateur de niveaux. */
export type LevelGenerationSeed = string | number;

/** Etat public minimal d'un PRNG seedable. */
export interface SeededRandom {
  /** Seed normalisee en texte, utile pour les URLs et l'affichage. */
  readonly seed: string;
  /** Etat initial 32 bits derive de la seed normalisee. */
  readonly initialState: number;
  /** Retourne un flottant dans `[0, 1)`. */
  readonly next: () => number;
  /** Retourne un entier inclusif dans `[min, max]`. */
  readonly integer: (min: number, max: number) => number;
  /** Retourne vrai selon une probabilite `0..1`. */
  readonly chance: (probability: number) => boolean;
  /** Choisit une entree dans une liste non vide. */
  readonly pick: <TValue>(values: readonly TValue[]) => TValue;
  /** Derive un nouveau PRNG depuis la seed courante et un suffixe stable. */
  readonly fork: (suffix: string | number) => SeededRandom;
}

/** Prefixe de seed utilise quand aucune seed n'est fournie par l'appelant. */
const DEFAULT_SEED = "la-mine-generated";
/** Offset FNV-1a 32 bits. */
const FNV_OFFSET_BASIS = 0x811c9dc5;
/** Prime FNV-1a 32 bits. */
const FNV_PRIME = 0x01000193;
/** Taille maximale d'un entier non signe 32 bits. */
const UINT32_SIZE = 0x100000000;

/** Cree un PRNG deterministe a partir d'une seed texte ou numerique. */
export function createSeededRandom(seed: LevelGenerationSeed): SeededRandom {
  const normalizedSeed = normalizeSeed(seed);
  const initialState = hashSeedToUint32(normalizedSeed);
  let state = initialState;

  const next = (): number => {
    state = state + 0x6d2b79f5 | 0;
    let value = Math.imul(state ^ state >>> 15, 1 | state);
    value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
    return ((value ^ value >>> 14) >>> 0) / UINT32_SIZE;
  };

  return {
    seed: normalizedSeed,
    initialState,
    next,
    integer: (min, max) => getRandomInteger(next, min, max),
    chance: (probability) => next() < clampProbability(probability),
    pick: (values) => pickRandomValue(next, values),
    fork: (suffix) => createSeededRandom(`${normalizedSeed}/${normalizeSeed(suffix)}`)
  };
}

/** Normalise une seed pour obtenir une representation stable et partageable. */
export function normalizeSeed(seed: LevelGenerationSeed | null | undefined): string {
  const text = String(seed ?? DEFAULT_SEED).trim();
  return text.length > 0 ? text : DEFAULT_SEED;
}

/** Hash une seed texte en entier non signe 32 bits. */
export function hashSeedToUint32(seed: string): number {
  let hash = FNV_OFFSET_BASIS;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME);
  }

  return hash >>> 0;
}

/** Tire un entier inclusif dans une plage ordonnee ou non. */
function getRandomInteger(next: () => number, min: number, max: number): number {
  const lower = Math.ceil(Math.min(min, max));
  const upper = Math.floor(Math.max(min, max));
  return lower + Math.floor(next() * (upper - lower + 1));
}

/** Contraint une probabilite dans la plage exploitable. */
function clampProbability(probability: number): number {
  return Math.max(0, Math.min(1, probability));
}

/** Choisit une valeur dans une liste non vide. */
function pickRandomValue<TValue>(next: () => number, values: readonly TValue[]): TValue {
  if (values.length === 0) {
    throw new Error("Impossible de choisir une valeur dans une liste vide.");
  }

  return values[Math.floor(next() * values.length)];
}

