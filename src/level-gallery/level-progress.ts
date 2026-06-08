/**
 * Role: Gere la progression locale utilisee par la future vitrine des niveaux.
 * Scope: Fournit lecture/ecriture `localStorage` et helpers purs, sans modifier le gameplay.
 * ISO: Ne porte aucune regle TO8; ces donnees sont une couche moderne de confort utilisateur.
 * Notes: Tous les niveaux restent debloques tant que les regles de progression ne sont pas decidees.
 */

import type { LevelCatalogEntry, LevelCatalogProgressSummary } from "./level-catalog";

/** Version de schema locale pour permettre des migrations futures. */
const LEVEL_PROGRESS_SCHEMA_VERSION = 1;
/** Cle de stockage navigateur dediee a la progression de la vitrine. */
const LEVEL_PROGRESS_STORAGE_KEY = "la-mine-level-gallery-progress";
/** Condition neutre tant que le deblocage progressif n'est pas active. */
const DEFAULT_UNLOCK_CONDITION = "Disponible";

/** Progression persistante associee a un niveau. */
export interface StoredLevelProgress {
  /** Indique si le niveau a deja ete termine. */
  readonly completed: boolean;
  /** Meilleur score atteint sur ce niveau. */
  readonly bestScore: number | null;
  /** Record affiche pour ce niveau, distinct du score si une regle future le separe. */
  readonly bestRecord: number | null;
  /** Meilleur temps de completion en secondes; `null` tant qu'il n'est pas mesure. */
  readonly bestTime: number | null;
  /** Date ISO de derniere completion connue. */
  readonly lastCompletedDate: string | null;
}

/** Etat complet de progression locale. */
export interface LevelGalleryProgressState {
  /** Version de schema de l'objet stocke. */
  readonly schemaVersion: 1;
  /** Progression indexee par identifiant stable de niveau. */
  readonly levels: Record<string, StoredLevelProgress>;
}

/** Resultat minimal d'une partie terminee, pret pour un branchement gameplay futur. */
export interface LevelCompletionProgressResult {
  /** Score final atteint pendant la partie. */
  readonly score: number;
  /** Record final affiche pendant la partie. */
  readonly record: number;
  /** Temps de completion en secondes, si disponible. */
  readonly completionTime: number | null;
  /** Date ISO de completion. */
  readonly completedDate: string;
}

/** Cree un etat de progression vide mais valide. */
export function createEmptyLevelGalleryProgress(): LevelGalleryProgressState {
  return {
    schemaVersion: LEVEL_PROGRESS_SCHEMA_VERSION,
    levels: {}
  };
}

/** Charge la progression depuis le navigateur avec fallback silencieux. */
export function loadLevelGalleryProgress(): LevelGalleryProgressState {
  if (!canUseLocalStorage()) {
    return createEmptyLevelGalleryProgress();
  }

  try {
    const raw = window.localStorage.getItem(LEVEL_PROGRESS_STORAGE_KEY);
    if (!raw) {
      return createEmptyLevelGalleryProgress();
    }

    return normalizeLevelGalleryProgress(JSON.parse(raw));
  } catch {
    return createEmptyLevelGalleryProgress();
  }
}

/** Persiste la progression locale si le stockage navigateur est disponible. */
export function saveLevelGalleryProgress(progress: LevelGalleryProgressState): void {
  if (!canUseLocalStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(LEVEL_PROGRESS_STORAGE_KEY, JSON.stringify(normalizeLevelGalleryProgress(progress)));
  } catch {
    // Le stockage local est une aide de confort; le jeu doit rester fonctionnel sans lui.
  }
}

/** Retourne la progression stockee d'un niveau ou une valeur vide. */
export function getStoredLevelProgress(progress: LevelGalleryProgressState, levelId: string): StoredLevelProgress {
  return normalizeStoredLevelProgress(progress.levels[levelId]);
}

/** Indique si un niveau est accessible selon les futures regles de deblocage. */
export function isLevelUnlocked(_level: LevelCatalogEntry, _progress: LevelGalleryProgressState): boolean {
  return true;
}

/** Retourne le libelle de condition de deblocage actuellement applicable. */
export function getLevelUnlockCondition(_level: LevelCatalogEntry, _progress: LevelGalleryProgressState): string {
  return DEFAULT_UNLOCK_CONDITION;
}

/** Construit le resume de progression attendu par les fiches de niveau. */
export function getLevelProgressSummary(level: LevelCatalogEntry, progress: LevelGalleryProgressState): LevelCatalogProgressSummary {
  const stored = getStoredLevelProgress(progress, level.id);
  const locked = !isLevelUnlocked(level, progress);

  return {
    locked,
    unlockCondition: getLevelUnlockCondition(level, progress),
    bestScore: stored.bestScore,
    bestRecord: stored.bestRecord,
    bestTime: stored.bestTime,
    completed: stored.completed
  };
}

/** Met a jour immuablement la progression apres completion d'un niveau. */
export function updateLevelCompletionProgress(
  progress: LevelGalleryProgressState,
  level: Pick<LevelCatalogEntry, "id">,
  result: LevelCompletionProgressResult
): LevelGalleryProgressState {
  const previous = getStoredLevelProgress(progress, level.id);
  return {
    schemaVersion: LEVEL_PROGRESS_SCHEMA_VERSION,
    levels: {
      ...progress.levels,
      [level.id]: {
        completed: true,
        bestScore: maxNullable(previous.bestScore, result.score),
        bestRecord: maxNullable(previous.bestRecord, result.record),
        bestTime: minNullable(previous.bestTime, result.completionTime),
        lastCompletedDate: result.completedDate
      }
    }
  };
}

/** Verifie l'acces au stockage navigateur sans declencher d'erreur en contexte restreint. */
function canUseLocalStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

/** Normalise un objet inconnu vers le schema de progression courant. */
function normalizeLevelGalleryProgress(value: unknown): LevelGalleryProgressState {
  if (!isRecord(value) || value.schemaVersion !== LEVEL_PROGRESS_SCHEMA_VERSION || !isRecord(value.levels)) {
    return createEmptyLevelGalleryProgress();
  }

  const levels: Record<string, StoredLevelProgress> = {};
  for (const [levelId, stored] of Object.entries(value.levels)) {
    levels[levelId] = normalizeStoredLevelProgress(stored);
  }

  return {
    schemaVersion: LEVEL_PROGRESS_SCHEMA_VERSION,
    levels
  };
}

/** Normalise une entree de progression niveau vers une forme sure. */
function normalizeStoredLevelProgress(value: unknown): StoredLevelProgress {
  if (!isRecord(value)) {
    return createEmptyStoredLevelProgress();
  }

  return {
    completed: value.completed === true,
    bestScore: normalizeNullableNumber(value.bestScore),
    bestRecord: normalizeNullableNumber(value.bestRecord),
    bestTime: normalizeNullableNumber(value.bestTime),
    lastCompletedDate: typeof value.lastCompletedDate === "string" ? value.lastCompletedDate : null
  };
}

/** Cree une progression vide pour un niveau jamais joue. */
function createEmptyStoredLevelProgress(): StoredLevelProgress {
  return {
    completed: false,
    bestScore: null,
    bestRecord: null,
    bestTime: null,
    lastCompletedDate: null
  };
}

/** Garde uniquement les nombres finis positifs ou `null`. */
function normalizeNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

/** Retourne le maximum entre une valeur existante nullable et une nouvelle valeur. */
function maxNullable(previous: number | null, next: number): number {
  return previous === null ? next : Math.max(previous, next);
}

/** Retourne le minimum entre une valeur existante nullable et une nouvelle valeur nullable. */
function minNullable(previous: number | null, next: number | null): number | null {
  if (next === null) {
    return previous;
  }

  return previous === null ? next : Math.min(previous, next);
}

/** Indique si une valeur inconnue peut etre lue comme un dictionnaire. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
