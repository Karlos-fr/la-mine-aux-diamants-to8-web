/**
 * Role: Analyse les niveaux modernes pour construire un profil de generation.
 * Scope: Produit des statistiques pures depuis `ModernLevelJson`, sans generer ni modifier de niveau.
 * ISO: Les niveaux originaux analyses restent les JSON modernes issus de l'extraction TO8.
 * Notes: Ce module prepare le generateur seede; il ne doit pas dependre du gameplay runtime.
 */

import {
  getModernLevelSource,
  NORMAL_LEVEL_COUNT,
  type ModernLevelJson,
  type ModernTileType
} from "../game/level-loader";

/** Identifiants des profils de generation connus par l'architecture. */
export type LevelGenerationProfileId = "original" | "dense" | "large" | "expert";

/** Statistiques min/max/moyenne pour une mesure numerique. */
export interface LevelProfileRange {
  /** Valeur minimale observee. */
  readonly min: number;
  /** Valeur maximale observee. */
  readonly max: number;
  /** Moyenne arithmetique observee. */
  readonly average: number;
}

/** Densite moyenne d'un type de cellule dans la grille. */
export interface LevelProfileDensity {
  /** Nombre total de cellules observees. */
  readonly count: number;
  /** Ratio sur l'ensemble des cellules analysees. */
  readonly ratio: number;
}

/** Resume d'un niveau individuel utilise pour composer un profil. */
export interface LevelProfileSample {
  /** Identifiant moderne du niveau analyse. */
  readonly id: string;
  /** Libelle humain du niveau analyse. */
  readonly label: string;
  /** Largeur en cellules. */
  readonly width: number;
  /** Hauteur en cellules. */
  readonly height: number;
  /** Nombre total de cellules. */
  readonly cellCount: number;
  /** Comptage de grille par id de tuile moderne. */
  readonly tileCounts: Readonly<Record<string, number>>;
  /** Comptage d'entites par id moderne. */
  readonly entityCounts: Readonly<Record<string, number>>;
  /** Nombre de diamants collectables declares comme entites. */
  readonly diamondCount: number;
  /** Objectif diamant du niveau. */
  readonly requiredDiamonds: number;
  /** Ratio objectif / diamants presents. */
  readonly requiredDiamondRatio: number;
  /** Distance Manhattan entre spawn et sortie. */
  readonly spawnExitDistance: number;
  /** Distance moyenne spawn-diamant, ou 0 si aucun diamant n'est declare. */
  readonly averageSpawnDiamondDistance: number;
  /** Lignes contenant au moins une plateforme. */
  readonly platformRows: readonly number[];
  /** Lignes contenant beaucoup de vide horizontal. */
  readonly corridorRows: readonly number[];
}

/** Profil agrege exploitable par les futures phases du generateur. */
export interface LevelGenerationProfile {
  /** Identifiant du profil. */
  readonly id: LevelGenerationProfileId;
  /** Libelle court affiche dans les futurs outils. */
  readonly label: string;
  /** Nombre de niveaux ayant servi a construire le profil. */
  readonly sampleCount: number;
  /** Dimensions observees. */
  readonly dimensions: {
    /** Largeur des niveaux du corpus. */
    readonly width: LevelProfileRange;
    /** Hauteur des niveaux du corpus. */
    readonly height: LevelProfileRange;
    /** Nombre de cellules du corpus. */
    readonly cells: LevelProfileRange;
  };
  /** Densites moyennes par type de tuile moderne. */
  readonly tileDensities: Readonly<Record<string, LevelProfileDensity>>;
  /** Nombre moyen d'entites par type moderne. */
  readonly entityAverages: Readonly<Record<string, number>>;
  /** Distances utiles pour placer spawn, sortie et diamants. */
  readonly distances: {
    /** Distance spawn-sortie. */
    readonly spawnExit: LevelProfileRange;
    /** Distance moyenne spawn-diamants. */
    readonly spawnDiamonds: LevelProfileRange;
  };
  /** Objectif diamant observe. */
  readonly diamonds: {
    /** Nombre de diamants presents. */
    readonly present: LevelProfileRange;
    /** Nombre de diamants requis. */
    readonly required: LevelProfileRange;
    /** Ratio requis/presents. */
    readonly requiredRatio: LevelProfileRange;
  };
  /** Structure horizontale observee. */
  readonly horizontalStructure: {
    /** Nombre de lignes contenant des plateformes. */
    readonly platformRows: LevelProfileRange;
    /** Ratio moyen d'occupation des lignes a plateformes. */
    readonly platformRowFillRatio: LevelProfileRange;
    /** Nombre de lignes ouvertes considerees comme couloirs. */
    readonly corridorRows: LevelProfileRange;
  };
  /** Diagnostics non bloquants observes pendant l'analyse. */
  readonly warnings: readonly string[];
}

/** Seuil de vide a partir duquel une ligne ressemble a un couloir horizontal. */
const CORRIDOR_EMPTY_RATIO = 0.45;

/** Profil original construit depuis les galeries normales actuellement chargees. */
export const ORIGINAL_LEVEL_GENERATION_PROFILE = buildOriginalLevelGenerationProfile();

/** Profils nommes disponibles pour les futures options de generation. */
export const LEVEL_GENERATION_PROFILES: Readonly<Record<LevelGenerationProfileId, LevelGenerationProfile>> = {
  original: ORIGINAL_LEVEL_GENERATION_PROFILE,
  dense: deriveProfileVariant(ORIGINAL_LEVEL_GENERATION_PROFILE, "dense", "Dense", {
    earth: 1.08,
    rock: 1.2,
    monster: 1.15
  }),
  large: deriveProfileVariant(ORIGINAL_LEVEL_GENERATION_PROFILE, "large", "Large", {
    earth: 0.96,
    empty: 1.18,
    platform: 1.1
  }),
  expert: deriveProfileVariant(ORIGINAL_LEVEL_GENERATION_PROFILE, "expert", "Expert", {
    rock: 1.28,
    monster: 1.35,
    specialCreature: 1.25,
    transformerBlock: 1.2
  })
};

/** Analyse un niveau moderne et retourne un echantillon statistique autonome. */
export function analyzeModernLevelForProfile(level: ModernLevelJson): LevelProfileSample {
  const grid = buildModernTileGrid(level);
  const tileCounts = countGridTiles(grid);
  const entityCounts = countEntities(level.entities);
  const diamondPositions = level.entities.filter((entity) => entity.type === "diamond");
  const platformRows = getRowsMatchingTileRatio(grid, "platform", 0);
  const corridorRows = getRowsMatchingTileRatio(grid, "empty", CORRIDOR_EMPTY_RATIO);
  const diamondDistances = diamondPositions.map((diamond) => getManhattanDistance(level.playerSpawn, diamond));
  const diamondCount = entityCounts.diamond ?? 0;

  return {
    id: level.id,
    label: level.label,
    width: level.width,
    height: level.height,
    cellCount: level.width * level.height,
    tileCounts,
    entityCounts,
    diamondCount,
    requiredDiamonds: level.requiredDiamonds,
    requiredDiamondRatio: diamondCount > 0 ? level.requiredDiamonds / diamondCount : 0,
    spawnExitDistance: getManhattanDistance(level.playerSpawn, level.exit),
    averageSpawnDiamondDistance: diamondDistances.length > 0 ? average(diamondDistances) : 0,
    platformRows,
    corridorRows
  };
}

/** Agrege plusieurs echantillons en profil de generation. */
export function aggregateLevelGenerationProfile(
  id: LevelGenerationProfileId,
  label: string,
  samples: readonly LevelProfileSample[]
): LevelGenerationProfile {
  if (samples.length === 0) {
    throw new Error("Impossible de construire un profil de generation sans niveau source.");
  }

  const totalCells = sum(samples.map((sample) => sample.cellCount));
  const tileCounts = mergeCounts(samples.map((sample) => sample.tileCounts));
  const entityCounts = mergeCounts(samples.map((sample) => sample.entityCounts));
  const profile: LevelGenerationProfile = {
    id,
    label,
    sampleCount: samples.length,
    dimensions: {
      width: summarize(samples.map((sample) => sample.width)),
      height: summarize(samples.map((sample) => sample.height)),
      cells: summarize(samples.map((sample) => sample.cellCount))
    },
    tileDensities: Object.fromEntries(
      Object.entries(tileCounts).map(([tileId, count]) => [tileId, { count, ratio: count / totalCells }])
    ),
    entityAverages: Object.fromEntries(
      Object.entries(entityCounts).map(([entityId, count]) => [entityId, count / samples.length])
    ),
    distances: {
      spawnExit: summarize(samples.map((sample) => sample.spawnExitDistance)),
      spawnDiamonds: summarize(samples.filter((sample) => sample.diamondCount > 0).map((sample) => sample.averageSpawnDiamondDistance))
    },
    diamonds: {
      present: summarize(samples.map((sample) => sample.diamondCount)),
      required: summarize(samples.map((sample) => sample.requiredDiamonds)),
      requiredRatio: summarize(samples.map((sample) => sample.requiredDiamondRatio))
    },
    horizontalStructure: {
      platformRows: summarize(samples.map((sample) => sample.platformRows.length)),
      platformRowFillRatio: summarize(samples.map((sample) => getAveragePlatformRowFillRatio(sample))),
      corridorRows: summarize(samples.map((sample) => sample.corridorRows.length))
    },
    warnings: getProfileWarnings(samples)
  };

  assertLevelGenerationProfile(profile);
  return profile;
}

/** Verifie les invariants minimaux d'un profil exploitable par le generateur. */
export function assertLevelGenerationProfile(profile: LevelGenerationProfile): void {
  if (profile.sampleCount <= 0) {
    throw new Error(`Profil ${profile.id}: aucun echantillon source.`);
  }

  if (profile.dimensions.width.average <= 0 || profile.dimensions.height.average <= 0) {
    throw new Error(`Profil ${profile.id}: dimensions invalides.`);
  }

  const totalTileRatio = sum(Object.values(profile.tileDensities).map((density) => density.ratio));
  if (Math.abs(totalTileRatio - 1) > 0.001) {
    throw new Error(`Profil ${profile.id}: densites de tuiles incoherentes (${totalTileRatio}).`);
  }

  if (!Number.isFinite(profile.diamonds.required.average)) {
    throw new Error(`Profil ${profile.id}: objectif diamant invalide.`);
  }
}

/** Construit le profil original depuis les niveaux de progression normale. */
function buildOriginalLevelGenerationProfile(): LevelGenerationProfile {
  const levels = Array.from({ length: NORMAL_LEVEL_COUNT }, (_, index) => getModernLevelSource(index + 1));
  const samples = levels.flatMap((level) => level ? [analyzeModernLevelForProfile(level)] : []);
  return aggregateLevelGenerationProfile("original", "Original", samples);
}

/** Cree une variante simple du profil original pour reserver les futurs modes. */
function deriveProfileVariant(
  source: LevelGenerationProfile,
  id: LevelGenerationProfileId,
  label: string,
  multipliers: Readonly<Record<string, number>>
): LevelGenerationProfile {
  const entityAverages = Object.fromEntries(
    Object.entries(source.entityAverages).map(([entityId, value]) => [entityId, value * (multipliers[entityId] ?? 1)])
  );
  const tileDensities = normalizeTileDensities(source.tileDensities, multipliers);
  const profile: LevelGenerationProfile = {
    ...source,
    id,
    label,
    tileDensities,
    entityAverages,
    warnings: [
      ...source.warnings,
      `Profil ${label}: variante heuristique derivee du profil original, a calibrer pendant la generation.`
    ]
  };

  assertLevelGenerationProfile(profile);
  return profile;
}

/** Construit une grille moderne complete en appliquant les surcharges de tuiles. */
function buildModernTileGrid(level: ModernLevelJson): ModernTileType[][] {
  const grid = Array.from({ length: level.height }, () => Array.from({ length: level.width }, () => level.defaultTile));
  for (const tile of level.tiles) {
    grid[tile.y][tile.x] = tile.type;
  }

  return grid;
}

/** Compte les types de tuiles dans une grille moderne. */
function countGridTiles(grid: readonly (readonly ModernTileType[])[]): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const row of grid) {
    for (const tileType of row) {
      counts[tileType] = (counts[tileType] ?? 0) + 1;
    }
  }

  return counts;
}

/** Compte les types d'entites declares dans un niveau moderne. */
function countEntities(entities: ModernLevelJson["entities"]): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const entity of entities) {
    counts[entity.type] = (counts[entity.type] ?? 0) + 1;
  }

  return counts;
}

/** Retourne les lignes dont le ratio d'un type de tuile depasse le seuil donne. */
function getRowsMatchingTileRatio(
  grid: readonly (readonly ModernTileType[])[],
  tileType: ModernTileType,
  minRatioExclusive: number
): readonly number[] {
  return grid
    .map((row, y) => ({
      y,
      ratio: row.filter((cell) => cell === tileType).length / row.length
    }))
    .filter((row) => row.ratio > minRatioExclusive)
    .map((row) => row.y);
}

/** Calcule le taux moyen de plateformes des lignes ou elles apparaissent. */
function getAveragePlatformRowFillRatio(sample: LevelProfileSample): number {
  if (sample.platformRows.length === 0) {
    return 0;
  }

  const platformCount = sample.tileCounts.platform ?? 0;
  return platformCount / (sample.platformRows.length * sample.width);
}

/** Fusionne plusieurs tables de comptage par cle texte. */
function mergeCounts(countGroups: readonly Readonly<Record<string, number>>[]): Readonly<Record<string, number>> {
  const merged: Record<string, number> = {};
  for (const counts of countGroups) {
    for (const [key, value] of Object.entries(counts)) {
      merged[key] = (merged[key] ?? 0) + value;
    }
  }

  return merged;
}

/** Normalise des densites apres application de multiplicateurs heuristiques. */
function normalizeTileDensities(
  source: Readonly<Record<string, LevelProfileDensity>>,
  multipliers: Readonly<Record<string, number>>
): Readonly<Record<string, LevelProfileDensity>> {
  const weighted = Object.fromEntries(
    Object.entries(source).map(([tileId, density]) => [tileId, density.ratio * (multipliers[tileId] ?? 1)])
  );
  const totalWeight = sum(Object.values(weighted));

  return Object.fromEntries(
    Object.entries(source).map(([tileId, density]) => [
      tileId,
      {
        count: density.count,
        ratio: weighted[tileId] / totalWeight
      }
    ])
  );
}

/** Produit les avertissements utiles observes dans les donnees source. */
function getProfileWarnings(samples: readonly LevelProfileSample[]): readonly string[] {
  const warnings: string[] = [];
  const impossibleStaticObjectives = samples.filter((sample) => sample.diamondCount > 0 && sample.requiredDiamonds > sample.diamondCount);
  if (impossibleStaticObjectives.length > 0) {
    warnings.push(
      `Objectif diamant superieur aux diamants initiaux sur ${impossibleStaticObjectives.length} niveaux; le generateur devra gerer transformations ou objectifs ajustes.`
    );
  }

  const levelsWithoutDiamonds = samples.filter((sample) => sample.diamondCount === 0);
  if (levelsWithoutDiamonds.length > 0) {
    warnings.push(`${levelsWithoutDiamonds.length} niveau sans diamant initial observe dans le corpus original.`);
  }

  return warnings;
}

/** Resume une serie numerique en min/max/moyenne. */
function summarize(values: readonly number[]): LevelProfileRange {
  if (values.length === 0) {
    return { min: 0, max: 0, average: 0 };
  }

  return {
    min: Math.min(...values),
    max: Math.max(...values),
    average: average(values)
  };
}

/** Calcule la distance Manhattan entre deux points de grille. */
function getManhattanDistance(
  first: { readonly x: number; readonly y: number },
  second: { readonly x: number; readonly y: number }
): number {
  return Math.abs(first.x - second.x) + Math.abs(first.y - second.y);
}

/** Calcule la somme d'une serie numerique. */
function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/** Calcule une moyenne arithmetique. */
function average(values: readonly number[]): number {
  return sum(values) / values.length;
}
