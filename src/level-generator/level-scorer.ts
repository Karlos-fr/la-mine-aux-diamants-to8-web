/**
 * Role: Note la qualite des candidats generes par intention de design.
 * Scope: Compare lisibilite, densites, structure, validation et equilibre gameplay sans modifier les niveaux.
 * ISO: Le scoring s'inspire des analyses TO8 existantes, mais ne copie ni ne rejoue de niveau original.
 * Notes: La selection est deterministe pour conserver la reproductibilite des seeds.
 */

import type { ModernTileType } from "../game/level-loader";
import type { GameplayPlacedLevelGrid } from "./level-gameplay-placer";
import type { LevelGenerationProfile } from "./level-profile";
import type { LevelLayout } from "./level-layout";
import type { GeneratedLevelValidationResult } from "./level-validator";
import { ORIGINAL_LEVEL_STRUCTURE_AUDIT, type LevelStructureFamily } from "./level-structure-analysis";

/** Nom stable d'un critere de scoring. */
export type LevelScoreCriterionName =
  | "macroStructure"
  | "mainPath"
  | "optionalZones"
  | "to8Density"
  | "originalDistance"
  | "noiseControl"
  | "riskReward"
  | "validation";

/** Detail d'un critere de scoring. */
export interface LevelScoreCriterion {
  /** Score normalise `0..1`. */
  readonly score: number;
  /** Poids utilise dans le total. */
  readonly weight: number;
  /** Resume court du critere. */
  readonly summary: string;
}

/** Candidat pret a etre note par la phase 8. */
export interface LevelScoringCandidate {
  /** Identifiant stable du candidat dans une tentative. */
  readonly id: string;
  /** Layout spatial source. */
  readonly layout: LevelLayout;
  /** Grille finale apres placement gameplay. */
  readonly gameplayGrid: GameplayPlacedLevelGrid;
  /** Resultat de validation moderne, si deja calcule. */
  readonly validation?: GeneratedLevelValidationResult;
}

/** Entree du scoring d'un candidat. */
export interface LevelScoringInput {
  /** Candidat a noter. */
  readonly candidate: LevelScoringCandidate;
  /** Profil statistique de reference. */
  readonly profile: LevelGenerationProfile;
}

/** Resultat de scoring complet. */
export interface LevelQualityScore {
  /** Identifiant du candidat note. */
  readonly candidateId: string;
  /** Score total normalise `0..1`. */
  readonly total: number;
  /** Critere par nom stable. */
  readonly criteria: Readonly<Record<LevelScoreCriterionName, LevelScoreCriterion>>;
  /** Similarite maximale estimee avec un niveau original. */
  readonly nearestOriginalSimilarity: number;
  /** Resume lisible pour logs/debug. */
  readonly summary: string;
}

/** Candidat accompagne de son score. */
export interface ScoredLevelCandidate<TCandidate extends LevelScoringCandidate = LevelScoringCandidate> {
  /** Candidat source. */
  readonly candidate: TCandidate;
  /** Score calcule. */
  readonly score: LevelQualityScore;
}

/** Poids des criteres; le total est normalise automatiquement. */
const CRITERION_WEIGHTS: Readonly<Record<LevelScoreCriterionName, number>> = {
  macroStructure: 1.35,
  mainPath: 1.15,
  optionalZones: 0.85,
  to8Density: 1,
  originalDistance: 1,
  noiseControl: 1.1,
  riskReward: 1,
  validation: 1.35
};

/** Types de tuiles suivis pour la proximite de densite. */
const DENSITY_TILE_TYPES: readonly ModernTileType[] = [
  "earth",
  "empty",
  "platform",
  "border",
  "rock",
  "diamond",
  "transformerBlock"
];

/** Note un candidat genere. */
export function scoreGeneratedLevelCandidate(input: LevelScoringInput): LevelQualityScore {
  const candidate = input.candidate;
  const tileCounts = countTiles(candidate.gameplayGrid.tiles);
  const nearestOriginalSimilarity = estimateNearestOriginalSimilarity(candidate.layout, candidate.gameplayGrid);
  const criteria: Readonly<Record<LevelScoreCriterionName, LevelScoreCriterion>> = {
    macroStructure: scoreMacroStructure(candidate.layout, candidate.gameplayGrid),
    mainPath: scoreMainPath(candidate.layout, candidate.gameplayGrid),
    optionalZones: scoreOptionalZones(candidate.layout),
    to8Density: scoreTo8Density(tileCounts, candidate.gameplayGrid, input.profile),
    originalDistance: scoreOriginalDistance(nearestOriginalSimilarity),
    noiseControl: scoreNoiseControl(candidate.gameplayGrid.tiles),
    riskReward: scoreRiskReward(candidate.layout, candidate.gameplayGrid),
    validation: scoreValidation(candidate.validation)
  };
  const total = calculateWeightedTotal(criteria);

  return {
    candidateId: candidate.id,
    total,
    criteria,
    nearestOriginalSimilarity,
    summary: [
      `Score ${candidate.id}`,
      `total=${total.toFixed(3)}`,
      `macro=${criteria.macroStructure.score.toFixed(2)}`,
      `density=${criteria.to8Density.score.toFixed(2)}`,
      `validation=${criteria.validation.score.toFixed(2)}`
    ].join(" | ")
  };
}

/** Note plusieurs candidats dans leur ordre courant. */
export function scoreGeneratedLevelCandidates<TCandidate extends LevelScoringCandidate>(
  candidates: readonly TCandidate[],
  profile: LevelGenerationProfile
): readonly ScoredLevelCandidate<TCandidate>[] {
  return candidates.map((candidate) => ({
    candidate,
    score: scoreGeneratedLevelCandidate({ candidate, profile })
  }));
}

/** Selectionne deterministiquement le meilleur candidat score. */
export function selectBestScoredCandidate<TCandidate extends LevelScoringCandidate>(
  scoredCandidates: readonly ScoredLevelCandidate<TCandidate>[]
): ScoredLevelCandidate<TCandidate> {
  if (scoredCandidates.length === 0) {
    throw new Error("Impossible de selectionner un candidat dans une liste vide.");
  }

  return [...scoredCandidates].sort(compareScoredCandidates)[0];
}

/** Note et selectionne le meilleur candidat en une passe. */
export function selectBestGeneratedLevelCandidate<TCandidate extends LevelScoringCandidate>(
  candidates: readonly TCandidate[],
  profile: LevelGenerationProfile
): ScoredLevelCandidate<TCandidate> {
  return selectBestScoredCandidate(scoreGeneratedLevelCandidates(candidates, profile));
}

/** Score la lisibilite de la macro-structure globale. */
function scoreMacroStructure(layout: LevelLayout, gameplayGrid: GameplayPlacedLevelGrid): LevelScoreCriterion {
  const occupiedScore = scoreRange(layout.metadata.occupiedRatio, 0.12, 0.44);
  const zoneScore = scoreRange(layout.zones.length, 4, 14);
  const connectionScore = scoreRange(layout.connections.length, Math.max(1, layout.zones.length - 2), Math.max(2, layout.zones.length + 4));
  const openRatio = getTileRatio(gameplayGrid.tiles, "empty") + getTileRatio(gameplayGrid.tiles, "earth") * 0.35;
  const readabilityScore = scoreRange(openRatio, 0.2, 0.72);
  const score = average([occupiedScore, zoneScore, connectionScore, readabilityScore]);
  return createCriterion("macroStructure", score, `zones=${layout.zones.length} occupied=${layout.metadata.occupiedRatio.toFixed(2)}`);
}

/** Score la coherence du chemin principal. */
function scoreMainPath(layout: LevelLayout, gameplayGrid: GameplayPlacedLevelGrid): LevelScoreCriterion {
  const pathLength = layout.graph.mainPathNodeIds.length;
  const distance = getManhattanDistance(gameplayGrid.playerSpawn, gameplayGrid.exit);
  const distanceRatio = distance / Math.max(1, gameplayGrid.width + gameplayGrid.height);
  const lengthScore = scoreRange(pathLength, 4, 10);
  const distanceScore = scoreRange(distanceRatio, 0.35, 0.85);
  const connectedScore = layout.connections.length >= Math.max(0, pathLength - 1) ? 1 : 0.35;
  const score = average([lengthScore, distanceScore, connectedScore]);
  return createCriterion("mainPath", score, `main=${pathLength} spawnExit=${distance}`);
}

/** Score la presence de branches optionnelles utiles. */
function scoreOptionalZones(layout: LevelLayout): LevelScoreCriterion {
  const optionalCount = layout.graph.optionalBranchNodeIds.length;
  const loopCount = layout.graph.loopEdgeIds.length;
  const optionalScore = scoreRange(optionalCount, 1, 6);
  const loopScore = loopCount > 0 ? scoreRange(loopCount, 1, 4) : 0.45;
  const score = average([optionalScore, loopScore]);
  return createCriterion("optionalZones", score, `optional=${optionalCount} loops=${loopCount}`);
}

/** Score la proximite des densites avec le profil original. */
function scoreTo8Density(
  tileCounts: Readonly<Record<string, number>>,
  gameplayGrid: GameplayPlacedLevelGrid,
  profile: LevelGenerationProfile
): LevelScoreCriterion {
  const totalCells = Math.max(1, gameplayGrid.width * gameplayGrid.height);
  const errors = DENSITY_TILE_TYPES.map((tileType) => {
    const actual = (tileCounts[tileType] ?? 0) / totalCells;
    const expected = profile.tileDensities[tileType]?.ratio ?? 0;
    return Math.min(1, Math.abs(actual - expected) / Math.max(0.04, expected + 0.02));
  });
  const score = clamp01(1 - average(errors));
  return createCriterion("to8Density", score, `densityError=${average(errors).toFixed(2)}`);
}

/** Penalise les candidats trop proches d'un niveau original. */
function scoreOriginalDistance(nearestOriginalSimilarity: number): LevelScoreCriterion {
  const score = clamp01(1 - nearestOriginalSimilarity);
  return createCriterion("originalDistance", score, `nearest=${nearestOriginalSimilarity.toFixed(2)}`);
}

/** Score l'absence de bruit uniforme ou de damier chaotique. */
function scoreNoiseControl(tiles: readonly (readonly ModernTileType[])[]): LevelScoreCriterion {
  const sameNeighborRatio = getSameNeighborRatio(tiles);
  const checkerRatio = getCheckerLikeRatio(tiles);
  const clusterScore = scoreRange(sameNeighborRatio, 0.42, 0.82);
  const checkerPenalty = clamp01(checkerRatio * 1.8);
  const score = clamp01(clusterScore - checkerPenalty * 0.45);
  return createCriterion("noiseControl", score, `same=${sameNeighborRatio.toFixed(2)} checker=${checkerRatio.toFixed(2)}`);
}

/** Score l'equilibre entre recompenses, dangers et objectifs. */
function scoreRiskReward(layout: LevelLayout, gameplayGrid: GameplayPlacedLevelGrid): LevelScoreCriterion {
  const diamondCount = gameplayGrid.entities.filter((entity) => entity.type === "diamond").length;
  const monsterCount = gameplayGrid.entities.filter((entity) => entity.type === "monster" || entity.type === "specialCreature").length;
  const transformerCount = countTileType(gameplayGrid.tiles, "transformerBlock");
  const diamondBudget = Math.max(1, layout.graph.metadata.diamondBudget);
  const dangerBudget = Math.max(1, layout.graph.metadata.dangerBudget);
  const diamondScore = scoreRatio(diamondCount, diamondBudget, 0.8, 2.4);
  const dangerScore = layout.graph.metadata.dangerBudget === 0
    ? (monsterCount === 0 ? 1 : 0.55)
    : scoreRatio(monsterCount + transformerCount * 0.5, dangerBudget, 0.45, 2.2);
  const objectiveScore = gameplayGrid.requiredDiamonds <= diamondCount && gameplayGrid.requiredDiamonds > 0 ? 1 : 0.35;
  const score = average([diamondScore, dangerScore, objectiveScore]);
  return createCriterion("riskReward", score, `diamonds=${diamondCount}/${diamondBudget} danger=${monsterCount}+${transformerCount}`);
}

/** Score la compatibilite avec le validateur. */
function scoreValidation(validation: GeneratedLevelValidationResult | undefined): LevelScoreCriterion {
  if (!validation) {
    return createCriterion("validation", 0.65, "validation=missing");
  }

  const errors = validation.diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
  const warnings = validation.diagnostics.filter((diagnostic) => diagnostic.severity === "warning").length;
  const score = clamp01(1 - errors * 0.35 - warnings * 0.08);
  return createCriterion("validation", score, `errors=${errors} warnings=${warnings}`);
}

/** Estime la similarite maximale avec les analyses originales disponibles. */
function estimateNearestOriginalSimilarity(layout: LevelLayout, gameplayGrid: GameplayPlacedLevelGrid): number {
  const family = mapLayoutStrategyToStructureFamily(layout.metadata.strategy);
  const densitySignature = createDensitySignature(gameplayGrid.tiles);
  const similarities = ORIGINAL_LEVEL_STRUCTURE_AUDIT.analyses.map((analysis) => {
    const familySimilarity = analysis.primaryFamily === family ? 0.35 : 0;
    const dimensionSimilarity = 1 - clamp01(
      (Math.abs(analysis.width - gameplayGrid.width) + Math.abs(analysis.height - gameplayGrid.height))
        / Math.max(1, analysis.width + analysis.height)
    );
    const silhouetteSimilarity = estimateSilhouetteSimilarity(layout, analysis.primaryFamily);
    const densitySimilarity = 1 - clamp01(Math.abs(densitySignature.solidRatio - estimateOriginalSolidRatio(analysis.primaryFamily)));
    return clamp01(familySimilarity + dimensionSimilarity * 0.2 + silhouetteSimilarity * 0.25 + densitySimilarity * 0.2);
  });
  return similarities.length > 0 ? Math.max(...similarities) : 0;
}

/** Convertit une strategie de layout en famille structurelle comparable. */
function mapLayoutStrategyToStructureFamily(strategy: LevelLayout["metadata"]["strategy"]): LevelStructureFamily {
  if (strategy === "horizontalBands") return "horizontalBands";
  if (strategy === "rooms") return "roomGrid";
  if (strategy === "maze") return "maze";
  if (strategy === "spiral" || strategy === "fortress") return "spiralFortress";
  if (strategy === "verticalRoute") return "verticalPlatforms";
  if (strategy === "centralArena") return "arena";
  return "denseField";
}

/** Estime une similarite de silhouette sans copier de grille originale. */
function estimateSilhouetteSimilarity(layout: LevelLayout, family: LevelStructureFamily): number {
  const expectedFamily = mapLayoutStrategyToStructureFamily(layout.metadata.strategy);
  if (expectedFamily !== family) {
    return 0.25;
  }

  const zoneDensity = layout.zones.length / Math.max(1, layout.width * layout.height / 64);
  return clamp01(0.45 + scoreRange(zoneDensity, 0.4, 1.8) * 0.4);
}

/** Approximation volontairement grossiere d'un ratio solide par famille originale. */
function estimateOriginalSolidRatio(family: LevelStructureFamily): number {
  if (family === "horizontalBands" || family === "verticalPlatforms") return 0.28;
  if (family === "roomGrid" || family === "arena") return 0.22;
  if (family === "maze" || family === "spiralFortress") return 0.35;
  return 0.42;
}

/** Cree une signature de densite compacte. */
function createDensitySignature(tiles: readonly (readonly ModernTileType[])[]): { readonly solidRatio: number } {
  const total = Math.max(1, tiles.length * (tiles[0]?.length ?? 0));
  const solid = countTileType(tiles, "border")
    + countTileType(tiles, "rock")
    + countTileType(tiles, "platform")
    + countTileType(tiles, "transformerBlock");
  return { solidRatio: solid / total };
}

/** Compare deux candidats scores, avec tie-break stable par id. */
function compareScoredCandidates<TCandidate extends LevelScoringCandidate>(
  first: ScoredLevelCandidate<TCandidate>,
  second: ScoredLevelCandidate<TCandidate>
): number {
  if (second.score.total !== first.score.total) {
    return second.score.total - first.score.total;
  }

  return first.candidate.id.localeCompare(second.candidate.id);
}

/** Calcule le total pondere. */
function calculateWeightedTotal(criteria: Readonly<Record<LevelScoreCriterionName, LevelScoreCriterion>>): number {
  const weightedTotal = Object.values(criteria).reduce((total, criterion) => total + criterion.score * criterion.weight, 0);
  const totalWeight = Object.values(criteria).reduce((total, criterion) => total + criterion.weight, 0);
  return clamp01(weightedTotal / Math.max(1, totalWeight));
}

/** Cree un critere avec son poids configure. */
function createCriterion(name: LevelScoreCriterionName, score: number, summary: string): LevelScoreCriterion {
  return {
    score: clamp01(score),
    weight: CRITERION_WEIGHTS[name],
    summary
  };
}

/** Compte les tuiles par id. */
function countTiles(tiles: readonly (readonly ModernTileType[])[]): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const row of tiles) {
    for (const tile of row) {
      counts[tile] = (counts[tile] ?? 0) + 1;
    }
  }

  return counts;
}

/** Compte un type de tuile donne. */
function countTileType(tiles: readonly (readonly ModernTileType[])[], tileType: ModernTileType): number {
  return tiles.reduce((total, row) => total + row.filter((tile) => tile === tileType).length, 0);
}

/** Retourne le ratio d'un type de tuile. */
function getTileRatio(tiles: readonly (readonly ModernTileType[])[], tileType: ModernTileType): number {
  return countTileType(tiles, tileType) / Math.max(1, tiles.length * (tiles[0]?.length ?? 0));
}

/** Mesure le taux de voisins orthogonaux identiques. */
function getSameNeighborRatio(tiles: readonly (readonly ModernTileType[])[]): number {
  let same = 0;
  let total = 0;
  for (let y = 1; y < tiles.length - 1; y += 1) {
    for (let x = 1; x < (tiles[y]?.length ?? 0) - 1; x += 1) {
      for (const neighbor of [tiles[y - 1]?.[x], tiles[y + 1]?.[x], tiles[y]?.[x - 1], tiles[y]?.[x + 1]]) {
        total += 1;
        if (neighbor === tiles[y][x]) {
          same += 1;
        }
      }
    }
  }

  return total > 0 ? same / total : 0;
}

/** Detecte les alternances locales type damier, souvent signe de bruit non structurel. */
function getCheckerLikeRatio(tiles: readonly (readonly ModernTileType[])[]): number {
  let checkerLike = 0;
  let total = 0;
  for (let y = 1; y < tiles.length - 1; y += 1) {
    for (let x = 1; x < (tiles[y]?.length ?? 0) - 1; x += 1) {
      const center = tiles[y][x];
      const horizontalDifferent = tiles[y]?.[x - 1] !== center && tiles[y]?.[x + 1] !== center;
      const verticalDifferent = tiles[y - 1]?.[x] !== center && tiles[y + 1]?.[x] !== center;
      total += 1;
      if (horizontalDifferent && verticalDifferent) {
        checkerLike += 1;
      }
    }
  }

  return total > 0 ? checkerLike / total : 0;
}

/** Score une valeur attendue dans une plage ideale. */
function scoreRange(value: number, minIdeal: number, maxIdeal: number): number {
  if (value >= minIdeal && value <= maxIdeal) {
    return 1;
  }

  const distance = value < minIdeal ? minIdeal - value : value - maxIdeal;
  const tolerance = Math.max(1, maxIdeal - minIdeal);
  return clamp01(1 - distance / tolerance);
}

/** Score un ratio observe/attendu dans une plage ideale. */
function scoreRatio(actual: number, expected: number, minRatio: number, maxRatio: number): number {
  return scoreRange(actual / Math.max(1, expected), minRatio, maxRatio);
}

/** Calcule une distance Manhattan. */
function getManhattanDistance(
  first: { readonly x: number; readonly y: number },
  second: { readonly x: number; readonly y: number }
): number {
  return Math.abs(first.x - second.x) + Math.abs(first.y - second.y);
}

/** Calcule une moyenne. */
function average(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0) / Math.max(1, values.length);
}

/** Contraint un score normalise. */
function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
