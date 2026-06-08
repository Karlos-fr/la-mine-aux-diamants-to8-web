/**
 * Role: Expose le catalogue de niveaux disponible pour la vitrine moderne.
 * Scope: Convertit les sources JSON validees en metadonnees affichables, sans construire d'UI.
 * ISO: Les donnees viennent des niveaux modernes extraits ou edites, pas des PNG de documentation.
 * Notes: Les champs de progression restent neutres tant que le module de progression n'est pas branche.
 */

import { getModernLevelSource, LEVEL_COUNT, type ModernLevelJson, type ModernLevelSourceKind } from "../game/level-loader";

/** Statut fonctionnel d'un niveau dans la vitrine. */
export type LevelCatalogAvailability = "available" | "locked";

/** Statut documentaire d'un niveau special dans le catalogue. */
export type LevelCatalogKind = ModernLevelSourceKind | "custom";

/** Metadonnees de progression exposees par la vitrine. */
export interface LevelCatalogProgressSummary {
  /** Indique si le niveau est verrouille par les futures regles de progression. */
  readonly locked: boolean;
  /** Condition de deblocage affichee dans la fiche niveau. */
  readonly unlockCondition: string;
  /** Meilleur score connu; `null` tant que la progression n'est pas branchee. */
  readonly bestScore: number | null;
  /** Record connu; `null` tant que la progression n'est pas branchee. */
  readonly bestRecord: number | null;
  /** Meilleur temps connu en secondes; `null` tant que la progression n'est pas branchee. */
  readonly bestTime: number | null;
  /** Indique si le niveau a deja ete termine. */
  readonly completed: boolean;
}

/** Entree stable du catalogue utilisee par la future scene vitrine. */
export interface LevelCatalogEntry {
  /** Numero jouable utilise par `createGameplayScene`. */
  readonly levelNumber: number;
  /** Identifiant stable issu du JSON moderne. */
  readonly id: string;
  /** Nom humain du niveau. */
  readonly name: string;
  /** Auteur documentaire du niveau. */
  readonly author: string;
  /** Date de creation ou de sortie associee au niveau. */
  readonly createdDate: string;
  /** Largeur du niveau en cellules. */
  readonly width: number;
  /** Hauteur du niveau en cellules. */
  readonly height: number;
  /** Temps initial du niveau, en secondes gameplay historiques. */
  readonly timeLimit: number;
  /** Objectif de diamants requis pour ouvrir la sortie. */
  readonly requiredDiamonds: number;
  /** Score ajoute par diamant collecte. */
  readonly scoreStep: number;
  /** Nature documentaire du niveau. */
  readonly kind: LevelCatalogKind;
  /** Indique si le niveau est un niveau special ou debug. */
  readonly special: boolean;
  /** Libelle court expliquant la nature speciale du niveau, si besoin. */
  readonly specialLabel: string | null;
  /** Statut fonctionnel de disponibilite pour les futures regles de progression. */
  readonly availability: LevelCatalogAvailability;
  /** Resume de progression affiche par la fiche niveau. */
  readonly progress: LevelCatalogProgressSummary;
  /** Source JSON complete, conservee pour le rendu dynamique de preview. */
  readonly source: ModernLevelJson;
}

/** Message de deblocage neutre tant que tous les niveaux sont disponibles. */
const DEFAULT_UNLOCK_CONDITION = "Disponible";

/** Retourne le catalogue ordonne de tous les niveaux modernes connus. */
export function getLevelCatalogEntries(): LevelCatalogEntry[] {
  const entries: LevelCatalogEntry[] = [];
  for (let levelNumber = 1; levelNumber <= LEVEL_COUNT; levelNumber += 1) {
    const source = getModernLevelSource(levelNumber);
    if (!source) {
      continue;
    }

    entries.push(createLevelCatalogEntry(levelNumber, source));
  }

  return entries;
}

/** Retourne une entree de catalogue par numero jouable. */
export function getLevelCatalogEntry(levelNumber: number): LevelCatalogEntry | undefined {
  const source = getModernLevelSource(levelNumber);
  return source ? createLevelCatalogEntry(levelNumber, source) : undefined;
}

/** Convertit un JSON moderne valide en entree de vitrine. */
function createLevelCatalogEntry(levelNumber: number, source: ModernLevelJson): LevelCatalogEntry {
  const kind = source.source?.kind ?? "normal";
  const specialLabel = getSpecialLevelLabel(kind);
  const locked = false;

  return {
    levelNumber,
    id: source.id,
    name: source.label,
    author: source.author,
    createdDate: source.createdDate,
    width: source.width,
    height: source.height,
    timeLimit: source.time,
    requiredDiamonds: source.requiredDiamonds,
    scoreStep: source.scoreStep,
    kind,
    special: specialLabel !== null,
    specialLabel,
    availability: locked ? "locked" : "available",
    progress: {
      locked,
      unlockCondition: DEFAULT_UNLOCK_CONDITION,
      bestScore: null,
      bestRecord: null,
      bestTime: null,
      completed: false
    },
    source
  };
}

/** Retourne un libelle clair pour les niveaux hors progression normale. */
function getSpecialLevelLabel(kind: LevelCatalogKind): string | null {
  if (kind === "attract") {
    return "Mode attract cache";
  }

  if (kind === "debug") {
    return "Niveau debug";
  }

  if (kind === "custom") {
    return "Niveau custom";
  }

  return null;
}
