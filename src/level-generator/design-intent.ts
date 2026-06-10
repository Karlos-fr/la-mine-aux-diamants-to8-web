/**
 * Role: Decrit l'intention de design avant toute generation de grille.
 * Scope: Choisit un archetype, des traits de rythme et des contraintes abstraites depuis options et seed.
 * ISO: Aucun comportement TO8 n'est encode ici; les niveaux originaux ne servent qu'a ponderer les intentions.
 * Notes: Ce module prepare le futur graphe gameplay sans modifier le generateur actuel.
 */

import type {
  LevelGenerationDensity,
  LevelGenerationDifficulty,
  LevelGenerationOptions
} from "./level-generation-options";
import type { LevelGenerationProfileId } from "./level-profile";
import {
  ORIGINAL_LEVEL_STRUCTURE_AUDIT,
  type LevelStructureFamily
} from "./level-structure-analysis";
import type { SeededRandom } from "./seeded-random";

/** Archetype de haut niveau que le futur layout devra concretiser. */
export type LevelDesignArchetype =
  | "horizontalBands"
  | "rooms"
  | "maze"
  | "spiral"
  | "fortress"
  | "denseField"
  | "centralArena"
  | "verticalRoute"
  | "hybrid";

/** Traits continus qui decrivent le rythme et l'ambition d'un niveau. */
export interface LevelDesignIntentTraits {
  /** Complexite globale de la structure et du graphe gameplay. */
  readonly complexity: number;
  /** Tendance a suivre un chemin principal unique. */
  readonly linearity: number;
  /** Quantite attendue de branches optionnelles. */
  readonly branching: number;
  /** Force de la symetrie ou repetition volontaire. */
  readonly symmetry: number;
  /** Densite de danger planifiee, avant placement concret. */
  readonly riskDensity: number;
  /** Part relative des zones optionnelles. */
  readonly optionalZoneRatio: number;
  /** Importance de la progression verticale. */
  readonly verticality: number;
  /** Taille relative des espaces ouverts. */
  readonly openness: number;
  /** Presence de motifs repetes ou structures modulaires. */
  readonly repetition: number;
}

/** Intention serialisable produite avant graphe, layout et rasterisation. */
export interface LevelDesignIntent {
  /** Archetype principal a concretiser. */
  readonly primaryArchetype: LevelDesignArchetype;
  /** Archetype secondaire optionnel pour les niveaux hybrides ou nuances. */
  readonly secondaryArchetype: LevelDesignArchetype | null;
  /** Famille structurelle originale qui a le plus influence le tirage. */
  readonly sourceFamilyHint: LevelStructureFamily;
  /** Traits numeriques normalises pour les phases suivantes. */
  readonly traits: LevelDesignIntentTraits;
  /** Options qui ont influence cette intention. */
  readonly parameters: {
    /** Profil statistique de reference. */
    readonly profile: LevelGenerationProfileId;
    /** Difficulte de generation demandee. */
    readonly difficulty: LevelGenerationDifficulty;
    /** Densite de generation demandee. */
    readonly density: LevelGenerationDensity;
    /** Largeur cible en cellules. */
    readonly width: number;
    /** Hauteur cible en cellules. */
    readonly height: number;
  };
  /** Resume lisible pour logs, warnings ou futurs panneaux debug. */
  readonly summary: string;
}

/** Poids minimal pour eviter qu'un archetype disparaisse completement. */
const MIN_ARCHETYPE_WEIGHT = 0.08;
/** Probabilite de creer une intention hybride quand l'archetype le permet. */
const HYBRID_PROBABILITY = 0.24;
/** Variance maximale appliquee aux traits issus de l'archetype. */
const TRAIT_JITTER = 0.12;

/** Matrice de correspondance entre familles observees et archetypes creables. */
const ARCHETYPES_BY_STRUCTURE_FAMILY: Readonly<Record<LevelStructureFamily, LevelDesignArchetype>> = {
  horizontalBands: "horizontalBands",
  roomGrid: "rooms",
  maze: "maze",
  denseField: "denseField",
  spiralFortress: "spiral",
  verticalPlatforms: "verticalRoute",
  arena: "centralArena"
};

/** Traits de base par archetype avant modulation options/seed. */
const BASE_TRAITS_BY_ARCHETYPE: Readonly<Record<LevelDesignArchetype, LevelDesignIntentTraits>> = {
  horizontalBands: createTraits(0.48, 0.72, 0.3, 0.62, 0.38, 0.22, 0.24, 0.28, 0.78),
  rooms: createTraits(0.62, 0.46, 0.58, 0.52, 0.42, 0.42, 0.22, 0.52, 0.68),
  maze: createTraits(0.78, 0.36, 0.72, 0.18, 0.58, 0.52, 0.28, 0.62, 0.34),
  spiral: createTraits(0.72, 0.68, 0.42, 0.44, 0.48, 0.32, 0.22, 0.36, 0.56),
  fortress: createTraits(0.68, 0.58, 0.46, 0.72, 0.54, 0.38, 0.34, 0.34, 0.72),
  denseField: createTraits(0.56, 0.42, 0.32, 0.16, 0.62, 0.24, 0.18, 0.18, 0.36),
  centralArena: createTraits(0.54, 0.48, 0.38, 0.58, 0.52, 0.28, 0.2, 0.74, 0.44),
  verticalRoute: createTraits(0.66, 0.58, 0.44, 0.32, 0.46, 0.36, 0.82, 0.3, 0.5),
  hybrid: createTraits(0.7, 0.5, 0.62, 0.38, 0.54, 0.48, 0.5, 0.46, 0.52)
};

/** Cree une intention de design deterministe depuis les options et un PRNG seede. */
export function createLevelDesignIntent(options: LevelGenerationOptions, random: SeededRandom): LevelDesignIntent {
  const weightedFamilies = getWeightedStructureFamilies(options);
  const sourceFamilyHint = pickWeighted(random.fork("source-family"), weightedFamilies);
  const primaryFromFamily = ARCHETYPES_BY_STRUCTURE_FAMILY[sourceFamilyHint];
  const primaryArchetype = refinePrimaryArchetype(primaryFromFamily, options, random.fork("primary"));
  const secondaryArchetype = pickSecondaryArchetype(primaryArchetype, options, random.fork("secondary"));
  const finalPrimary = secondaryArchetype && random.fork("hybrid").chance(HYBRID_PROBABILITY)
    ? "hybrid"
    : primaryArchetype;
  const traits = createIntentTraits(finalPrimary, secondaryArchetype, options, random.fork("traits"));

  return {
    primaryArchetype: finalPrimary,
    secondaryArchetype,
    sourceFamilyHint,
    traits,
    parameters: {
      profile: options.profile,
      difficulty: options.difficulty,
      density: options.density,
      width: options.width,
      height: options.height
    },
    summary: formatLevelDesignIntentSummary(finalPrimary, secondaryArchetype, sourceFamilyHint, traits)
  };
}

/** Formate une intention pour debug, logs et futurs panneaux d'inspection. */
export function formatLevelDesignIntentSummary(
  primaryArchetype: LevelDesignArchetype,
  secondaryArchetype: LevelDesignArchetype | null,
  sourceFamilyHint: LevelStructureFamily,
  traits: LevelDesignIntentTraits
): string {
  const secondary = secondaryArchetype ? ` + ${secondaryArchetype}` : "";
  return [
    `Intent ${primaryArchetype}${secondary}`,
    `source=${sourceFamilyHint}`,
    `complexity=${traits.complexity.toFixed(2)}`,
    `linearity=${traits.linearity.toFixed(2)}`,
    `branches=${traits.branching.toFixed(2)}`,
    `risk=${traits.riskDensity.toFixed(2)}`
  ].join(" | ");
}

/** Produit des poids de familles depuis l'audit original et les options modernes. */
function getWeightedStructureFamilies(options: LevelGenerationOptions): readonly WeightedValue<LevelStructureFamily>[] {
  const averagedScores = averageOriginalFamilyScores();
  return Object.entries(averagedScores).map(([family, score]) => ({
    value: family as LevelStructureFamily,
    weight: Math.max(MIN_ARCHETYPE_WEIGHT, score * getProfileFamilyWeight(family as LevelStructureFamily, options.profile))
  }));
}

/** Moyenne les scores de famille observes sur les niveaux originaux. */
function averageOriginalFamilyScores(): Readonly<Record<LevelStructureFamily, number>> {
  const totals = createFamilyScoreRecord(0);
  for (const analysis of ORIGINAL_LEVEL_STRUCTURE_AUDIT.analyses) {
    for (const score of analysis.familyScores) {
      totals[score.family] += score.score;
    }
  }

  const count = Math.max(1, ORIGINAL_LEVEL_STRUCTURE_AUDIT.analyses.length);
  return mapFamilyScores(totals, (score) => score / count);
}

/** Ajuste les familles selon les profils nommes existants. */
function getProfileFamilyWeight(family: LevelStructureFamily, profile: LevelGenerationProfileId): number {
  if (profile === "large" && (family === "maze" || family === "arena")) {
    return 1.35;
  }

  if (profile === "dense" && family === "denseField") {
    return 1.55;
  }

  if (profile === "expert" && (family === "spiralFortress" || family === "maze")) {
    return 1.4;
  }

  return 1;
}

/** Nuance l'archetype principal selon taille, difficulte et tirage. */
function refinePrimaryArchetype(
  archetype: LevelDesignArchetype,
  options: LevelGenerationOptions,
  random: SeededRandom
): LevelDesignArchetype {
  if (archetype === "spiral" && random.chance(0.45)) {
    return "fortress";
  }

  if (options.height > options.width * 0.75 && random.chance(0.55)) {
    return "verticalRoute";
  }

  if (options.difficulty === "expert" && archetype === "centralArena" && random.chance(0.5)) {
    return "maze";
  }

  return archetype;
}

/** Choisit un archetype secondaire compatible avec le principal. */
function pickSecondaryArchetype(
  primaryArchetype: LevelDesignArchetype,
  options: LevelGenerationOptions,
  random: SeededRandom
): LevelDesignArchetype | null {
  const candidates = getSecondaryArchetypeCandidates(primaryArchetype, options);
  if (candidates.length === 0 || !random.chance(getSecondaryChance(options.difficulty))) {
    return null;
  }

  return random.pick(candidates);
}

/** Retourne les archetypes secondaires compatibles avec l'intention principale. */
function getSecondaryArchetypeCandidates(
  primaryArchetype: LevelDesignArchetype,
  options: LevelGenerationOptions
): readonly LevelDesignArchetype[] {
  if (primaryArchetype === "maze") {
    return options.difficulty === "easy" ? ["rooms"] : ["rooms", "fortress", "denseField"];
  }

  if (primaryArchetype === "rooms") {
    return ["horizontalBands", "centralArena", "denseField"];
  }

  if (primaryArchetype === "horizontalBands") {
    return ["rooms", "verticalRoute", "denseField"];
  }

  if (primaryArchetype === "spiral" || primaryArchetype === "fortress") {
    return ["rooms", "maze", "centralArena"];
  }

  if (primaryArchetype === "centralArena") {
    return ["rooms", "fortress", "horizontalBands"];
  }

  if (primaryArchetype === "verticalRoute") {
    return ["horizontalBands", "rooms", "maze"];
  }

  if (primaryArchetype === "denseField") {
    return ["rooms", "horizontalBands"];
  }

  return [];
}

/** Retourne la chance de choisir un archetype secondaire selon la difficulte. */
function getSecondaryChance(difficulty: LevelGenerationDifficulty): number {
  if (difficulty === "easy") {
    return 0.15;
  }

  if (difficulty === "hard") {
    return 0.42;
  }

  if (difficulty === "expert") {
    return 0.58;
  }

  return 0.3;
}

/** Cree les traits finaux depuis archetypes, options et jitter seede. */
function createIntentTraits(
  primaryArchetype: LevelDesignArchetype,
  secondaryArchetype: LevelDesignArchetype | null,
  options: LevelGenerationOptions,
  random: SeededRandom
): LevelDesignIntentTraits {
  const primaryTraits = BASE_TRAITS_BY_ARCHETYPE[primaryArchetype];
  const secondaryTraits = secondaryArchetype ? BASE_TRAITS_BY_ARCHETYPE[secondaryArchetype] : primaryTraits;
  const mixedTraits = mixTraits(primaryTraits, secondaryTraits, secondaryArchetype ? 0.34 : 0);
  const optionAdjustedTraits = applyOptionTraitAdjustments(mixedTraits, options);
  return jitterTraits(optionAdjustedTraits, random);
}

/** Melange deux ensembles de traits selon un poids secondaire. */
function mixTraits(
  primaryTraits: LevelDesignIntentTraits,
  secondaryTraits: LevelDesignIntentTraits,
  secondaryWeight: number
): LevelDesignIntentTraits {
  return mapTraitPair(primaryTraits, secondaryTraits, (primary, secondary) => primary * (1 - secondaryWeight) + secondary * secondaryWeight);
}

/** Module les traits selon difficulte, densite et taille de niveau. */
function applyOptionTraitAdjustments(traits: LevelDesignIntentTraits, options: LevelGenerationOptions): LevelDesignIntentTraits {
  const difficulty = getDifficultyTraitAdjustments(options.difficulty);
  const density = getDensityTraitAdjustments(options.density);
  const aspectVerticality = options.height > options.width * 0.65 ? 0.1 : -0.04;
  return {
    complexity: clamp01(traits.complexity + difficulty.complexity),
    linearity: clamp01(traits.linearity + difficulty.linearity),
    branching: clamp01(traits.branching + difficulty.branching),
    symmetry: clamp01(traits.symmetry),
    riskDensity: clamp01(traits.riskDensity + difficulty.riskDensity + density.riskDensity),
    optionalZoneRatio: clamp01(traits.optionalZoneRatio + difficulty.optionalZoneRatio),
    verticality: clamp01(traits.verticality + aspectVerticality),
    openness: clamp01(traits.openness + density.openness),
    repetition: clamp01(traits.repetition + density.repetition)
  };
}

/** Retourne les ajustements lies a la difficulte. */
function getDifficultyTraitAdjustments(difficulty: LevelGenerationDifficulty): TraitAdjustments {
  if (difficulty === "easy") {
    return { complexity: -0.12, linearity: 0.12, branching: -0.12, riskDensity: -0.18, optionalZoneRatio: -0.06 };
  }

  if (difficulty === "hard") {
    return { complexity: 0.08, linearity: -0.04, branching: 0.08, riskDensity: 0.12, optionalZoneRatio: 0.06 };
  }

  if (difficulty === "expert") {
    return { complexity: 0.16, linearity: -0.08, branching: 0.14, riskDensity: 0.2, optionalZoneRatio: 0.1 };
  }

  return { complexity: 0, linearity: 0, branching: 0, riskDensity: 0, optionalZoneRatio: 0 };
}

/** Retourne les ajustements lies a la densite globale. */
function getDensityTraitAdjustments(density: LevelGenerationDensity): DensityTraitAdjustments {
  if (density === "light") {
    return { openness: 0.12, repetition: -0.04, riskDensity: -0.04 };
  }

  if (density === "dense") {
    return { openness: -0.12, repetition: 0.06, riskDensity: 0.06 };
  }

  return { openness: 0, repetition: 0, riskDensity: 0 };
}

/** Ajoute une variation deterministe aux traits sans changer leur interpretation. */
function jitterTraits(traits: LevelDesignIntentTraits, random: SeededRandom): LevelDesignIntentTraits {
  return mapTraits(traits, (value, key) => {
    const amplitude = key === "symmetry" || key === "repetition" ? TRAIT_JITTER * 0.75 : TRAIT_JITTER;
    return clamp01(value + random.next() * amplitude * 2 - amplitude);
  });
}

/** Choisit une valeur selon une distribution de poids. */
function pickWeighted<TValue>(random: SeededRandom, values: readonly WeightedValue<TValue>[]): TValue {
  const totalWeight = values.reduce((total, item) => total + item.weight, 0);
  let cursor = random.next() * totalWeight;
  for (const item of values) {
    cursor -= item.weight;
    if (cursor <= 0) {
      return item.value;
    }
  }

  return values[values.length - 1].value;
}

/** Cree un record de scores de familles initialise a une valeur. */
function createFamilyScoreRecord(value: number): Record<LevelStructureFamily, number> {
  return {
    horizontalBands: value,
    roomGrid: value,
    maze: value,
    denseField: value,
    spiralFortress: value,
    verticalPlatforms: value,
    arena: value
  };
}

/** Transforme tous les scores de familles. */
function mapFamilyScores(
  scores: Readonly<Record<LevelStructureFamily, number>>,
  transform: (value: number) => number
): Readonly<Record<LevelStructureFamily, number>> {
  return {
    horizontalBands: transform(scores.horizontalBands),
    roomGrid: transform(scores.roomGrid),
    maze: transform(scores.maze),
    denseField: transform(scores.denseField),
    spiralFortress: transform(scores.spiralFortress),
    verticalPlatforms: transform(scores.verticalPlatforms),
    arena: transform(scores.arena)
  };
}

/** Cree un ensemble de traits avec des arguments compacts. */
function createTraits(
  complexity: number,
  linearity: number,
  branching: number,
  symmetry: number,
  riskDensity: number,
  optionalZoneRatio: number,
  verticality: number,
  openness: number,
  repetition: number
): LevelDesignIntentTraits {
  return {
    complexity,
    linearity,
    branching,
    symmetry,
    riskDensity,
    optionalZoneRatio,
    verticality,
    openness,
    repetition
  };
}

/** Transforme chaque trait independamment. */
function mapTraits(
  traits: LevelDesignIntentTraits,
  transform: (value: number, key: keyof LevelDesignIntentTraits) => number
): LevelDesignIntentTraits {
  return {
    complexity: transform(traits.complexity, "complexity"),
    linearity: transform(traits.linearity, "linearity"),
    branching: transform(traits.branching, "branching"),
    symmetry: transform(traits.symmetry, "symmetry"),
    riskDensity: transform(traits.riskDensity, "riskDensity"),
    optionalZoneRatio: transform(traits.optionalZoneRatio, "optionalZoneRatio"),
    verticality: transform(traits.verticality, "verticality"),
    openness: transform(traits.openness, "openness"),
    repetition: transform(traits.repetition, "repetition")
  };
}

/** Transforme une paire de traits champ par champ. */
function mapTraitPair(
  primaryTraits: LevelDesignIntentTraits,
  secondaryTraits: LevelDesignIntentTraits,
  transform: (primary: number, secondary: number) => number
): LevelDesignIntentTraits {
  return {
    complexity: transform(primaryTraits.complexity, secondaryTraits.complexity),
    linearity: transform(primaryTraits.linearity, secondaryTraits.linearity),
    branching: transform(primaryTraits.branching, secondaryTraits.branching),
    symmetry: transform(primaryTraits.symmetry, secondaryTraits.symmetry),
    riskDensity: transform(primaryTraits.riskDensity, secondaryTraits.riskDensity),
    optionalZoneRatio: transform(primaryTraits.optionalZoneRatio, secondaryTraits.optionalZoneRatio),
    verticality: transform(primaryTraits.verticality, secondaryTraits.verticality),
    openness: transform(primaryTraits.openness, secondaryTraits.openness),
    repetition: transform(primaryTraits.repetition, secondaryTraits.repetition)
  };
}

/** Contraint un nombre dans la plage `0..1`. */
function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** Valeur associee a un poids pour un tirage deterministe. */
interface WeightedValue<TValue> {
  /** Valeur tiree si son segment de poids est selectionne. */
  readonly value: TValue;
  /** Poids relatif strictement positif. */
  readonly weight: number;
}

/** Ajustements portes par la difficulte. */
interface TraitAdjustments {
  /** Variation de complexite. */
  readonly complexity: number;
  /** Variation de linearite. */
  readonly linearity: number;
  /** Variation de branches. */
  readonly branching: number;
  /** Variation de risque. */
  readonly riskDensity: number;
  /** Variation de zones optionnelles. */
  readonly optionalZoneRatio: number;
}

/** Ajustements portes par la densite. */
interface DensityTraitAdjustments {
  /** Variation d'ouverture. */
  readonly openness: number;
  /** Variation de repetition. */
  readonly repetition: number;
  /** Variation de risque. */
  readonly riskDensity: number;
}
