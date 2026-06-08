/**
 * Role: Expose la vitrine de niveaux disponible pour l'interface moderne.
 * Scope: Convertit les sources JSON validees en metadonnees affichables, sans construire d'UI.
 * ISO: Les donnees viennent des niveaux modernes extraits ou edites, pas des PNG de documentation.
 * Notes: Les champs de progression restent neutres tant que le module de progression n'est pas branche.
 */

import { getModernLevelSource, LEVEL_COUNT, type ModernLevelJson, type ModernLevelSourceKind } from "../game/level-loader";

/** Statut fonctionnel d'un niveau dans la vitrine. */
export type LevelShowcaseAvailability = "available" | "locked";

/** Statut documentaire d'un niveau special dans la vitrine. */
export type LevelShowcaseKind = ModernLevelSourceKind | "custom";

/** Metadonnees de progression exposees par la vitrine. */
export interface LevelShowcaseProgressSummary {
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

/** Entree stable de la vitrine utilisee par la scene moderne. */
export interface LevelShowcaseEntry {
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
  readonly kind: LevelShowcaseKind;
  /** Indique si le niveau est un niveau special ou debug. */
  readonly special: boolean;
  /** Libelle court expliquant la nature speciale du niveau, si besoin. */
  readonly specialLabel: string | null;
  /** Statut fonctionnel de disponibilite pour les futures regles de progression. */
  readonly availability: LevelShowcaseAvailability;
  /** Resume de progression affiche par la fiche niveau. */
  readonly progress: LevelShowcaseProgressSummary;
  /** Source JSON complete, conservee pour le rendu dynamique de preview. */
  readonly source: ModernLevelJson;
}

/** Message de deblocage neutre tant que tous les niveaux sont disponibles. */
const DEFAULT_UNLOCK_CONDITION = "Disponible";

/** Retourne la liste ordonnee de tous les niveaux modernes connus pour la vitrine. */
export function getLevelShowcaseEntries(): LevelShowcaseEntry[] {
  const entries: LevelShowcaseEntry[] = [];
  for (let levelNumber = 1; levelNumber <= LEVEL_COUNT; levelNumber += 1) {
    const source = getModernLevelSource(levelNumber);
    if (!source) {
      continue;
    }

    entries.push(createLevelShowcaseEntry(levelNumber, source));
  }

  return entries;
}

/** Retourne une entree de vitrine par numero jouable. */
export function getLevelShowcaseEntry(levelNumber: number): LevelShowcaseEntry | undefined {
  const source = getModernLevelSource(levelNumber);
  return source ? createLevelShowcaseEntry(levelNumber, source) : undefined;
}

/** Convertit un JSON moderne valide en entree de vitrine. */
function createLevelShowcaseEntry(levelNumber: number, source: ModernLevelJson): LevelShowcaseEntry {
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
function getSpecialLevelLabel(kind: LevelShowcaseKind): string | null {
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
