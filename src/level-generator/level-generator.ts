/**
 * Role: Genere la grille de base des niveaux seedes.
 * Scope: Produit bordures, terre, vide, couloirs et plateformes dans un `ModernLevelJson` minimal.
 * ISO: S'inspire statistiquement des niveaux TO8 extraits, sans reproduire de niveau original.
 * Notes: Le placement gameplay fin sera ajoute par les phases suivantes du generateur.
 */

import type { ModernEntityType, ModernLevelCell, ModernLevelJson, ModernTileType } from "../game/level-loader";
import {
  DEFAULT_LEVEL_GENERATION_OPTIONS,
  type GeneratedLevelResult,
  type LevelGenerationDensity,
  type LevelGenerationDifficulty,
  type LevelGenerationOptions
} from "./level-generation-options";
import { createLevelDesignIntent } from "./design-intent";
import { dressRasterizedLevel } from "./level-dresser";
import { placeGameplayElements as placeStructuredGameplayElements, type GameplayPlacedLevelGrid } from "./level-gameplay-placer";
import { createLevelLayout } from "./level-layout";
import { createLevelPlanGraph } from "./level-plan-graph";
import { LEVEL_GENERATION_PROFILES, type LevelGenerationProfile } from "./level-profile";
import { rasterizeLevelLayout } from "./level-rasterizer";
import { repairGameplayGridWithStructure } from "./level-structure-repairer";
import {
  scoreGeneratedLevelCandidates,
  selectBestScoredCandidate,
  type LevelScoringCandidate
} from "./level-scorer";
import { validateGeneratedLevel, type GeneratedLevelValidationResult } from "./level-validator";
import { createSeededRandom, type SeededRandom } from "./seeded-random";

/** Largeur minimale raisonnable pour une grille jouable avec bordures. */
const MIN_GENERATED_WIDTH = 12;
/** Hauteur minimale raisonnable pour une grille jouable avec bordures. */
const MIN_GENERATED_HEIGHT = 10;
/** Largeur maximale de prudence tant que l'editeur n'a pas d'outils de perf dedies. */
const MAX_GENERATED_WIDTH = 96;
/** Hauteur maximale de prudence tant que l'editeur n'a pas d'outils de perf dedies. */
const MAX_GENERATED_HEIGHT = 64;
/** Date documentaire des niveaux generes par ce portage. */
const GENERATED_LEVEL_DATE = "2026-06-10";
/** Ratio minimum de vide interieur pour eviter les grilles trop compactes. */
const MIN_INNER_EMPTY_RATIO = 0.06;
/** Ratio maximum de plateformes pour garder une lecture proche du jeu original. */
const MAX_PLATFORM_RATIO = 0.18;
/** Rayon Manhattan preserve autour du spawn pour eviter les departs injustes. */
const SPAWN_SAFE_RADIUS = 3;
/** Distance minimale spawn-sortie en proportion de la grille. */
const MIN_EXIT_DISTANCE_RATIO = 0.45;
/** Distance minimale entre le spawn et un danger. */
const MIN_SPAWN_DANGER_DISTANCE = 6;
/** Nombre maximal de tentatives deterministes avant de retourner le meilleur resultat. */
const MAX_GENERATION_ATTEMPTS = 5;

/** Grille mutable utilisee uniquement pendant la generation. */
type GeneratedTileGrid = ModernTileType[][];

/** Placement gameplay produit par la phase 5 du generateur. */
interface GameplayPlacement {
  /** Position initiale du joueur. */
  readonly playerSpawn: GridPoint;
  /** Position de la sortie. */
  readonly exit: GridPoint;
  /** Entites modernes a declarer en plus de leurs tuiles runtime. */
  readonly entities: Array<ModernLevelCell<ModernEntityType>>;
}

/** Point de grille interne au generateur. */
interface GridPoint {
  /** Colonne de grille. */
  readonly x: number;
  /** Ligne de grille. */
  readonly y: number;
}

/** Candidat complet produit par le pipeline par intention. */
interface IntentGenerationCandidate extends LevelScoringCandidate {
  /** Resultat public correspondant au candidat. */
  readonly result: GeneratedLevelResult;
  /** Validation finale associee au JSON retourne. */
  readonly validation: GeneratedLevelValidationResult;
}

/** Options partielles acceptees par l'API de phase 4. */
export type PartialLevelGenerationOptions = Partial<LevelGenerationOptions>;

/** Genere une grille de base deterministe sous forme de niveau moderne minimal. */
export function generateBaseLevel(options: PartialLevelGenerationOptions = {}): GeneratedLevelResult {
  const resolvedOptions = resolveLevelGenerationOptions(options);
  const profile = LEVEL_GENERATION_PROFILES[resolvedOptions.profile] ?? LEVEL_GENERATION_PROFILES.original;
  const rootRandom = createSeededRandom(resolvedOptions.seed);
  const intentCandidates = Array.from({ length: MAX_GENERATION_ATTEMPTS }, (_, index) =>
    generateIntentLevelAttempt(resolvedOptions, profile, rootRandom, index + 1)
  );
  const scoredIntentCandidates = scoreGeneratedLevelCandidates(intentCandidates, profile);
  const bestIntentCandidate = selectBestScoredCandidate(scoredIntentCandidates);

  if (!hasValidationErrors(bestIntentCandidate.candidate.result.warnings)) {
    return withScoreWarning(bestIntentCandidate.candidate.result, bestIntentCandidate.score.summary);
  }

  const legacyFallback = generateBestLegacyLevel(resolvedOptions, profile, rootRandom);
  if (countValidationErrors(legacyFallback.warnings) < countValidationErrors(bestIntentCandidate.candidate.result.warnings)) {
    return {
      ...legacyFallback,
      warnings: [
        `Fallback legacy: les candidats par intention restent bloquants; meilleur score ${bestIntentCandidate.score.total.toFixed(3)}.`,
        ...legacyFallback.warnings
      ]
    };
  }

  return withScoreWarning(bestIntentCandidate.candidate.result, bestIntentCandidate.score.summary);
}

/** Genere et selectionne le meilleur resultat avec l'ancien pipeline de fallback. */
function generateBestLegacyLevel(
  resolvedOptions: LevelGenerationOptions,
  profile: LevelGenerationProfile,
  rootRandom: SeededRandom
): GeneratedLevelResult {
  let bestAttempt: GeneratedLevelResult | undefined;

  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const result = generateLegacyLevelAttempt(resolvedOptions, profile, rootRandom, attempt);
    if (!bestAttempt || countValidationErrors(result.warnings) < countValidationErrors(bestAttempt.warnings)) {
      bestAttempt = result;
    }

    if (!hasValidationErrors(result.warnings)) {
      return result;
    }
  }

  return bestAttempt ?? generateLegacyLevelAttempt(resolvedOptions, profile, rootRandom, 1);
}

/** Ajoute le resume de score sans changer le contrat public. */
function withScoreWarning(result: GeneratedLevelResult, scoreSummary: string): GeneratedLevelResult {
  return {
    ...result,
    warnings: [scoreSummary, ...result.warnings]
  };
}

/** Execute une tentative complete du pipeline par intention. */
function generateIntentLevelAttempt(
  resolvedOptions: LevelGenerationOptions,
  profile: LevelGenerationProfile,
  rootRandom: SeededRandom,
  attempt: number
): IntentGenerationCandidate {
  const random = rootRandom.fork(`intent-attempt-${attempt}`);
  const intent = createLevelDesignIntent(resolvedOptions, random.fork("intent"));
  const graph = createLevelPlanGraph(intent, random.fork("graph"));
  const layout = createLevelLayout(graph, random.fork("layout"));
  const rasterizedGrid = rasterizeLevelLayout(layout, random.fork("raster"));
  const dressedGrid = dressRasterizedLevel({
    layout,
    rasterizedGrid,
    profile,
    random: random.fork("dress")
  });
  let gameplayGrid = placeStructuredGameplayElements({
    layout,
    dressedGrid,
    difficulty: resolvedOptions.difficulty,
    random: random.fork("gameplay")
  });
  let level = buildModernLevelJsonFromGameplayGrid(gameplayGrid, resolvedOptions, rootRandom.seed, [
    intent.summary,
    graph.metadata.summary,
    layout.metadata.summary,
    rasterizedGrid.metadata.summary,
    dressedGrid.metadata.summary,
    gameplayGrid.metadata.summary
  ]);
  let validation = validateGeneratedLevel(level);
  const warnings: string[] = [
    `Pipeline intent: ${intent.summary}`,
    `Graphe: ${graph.metadata.summary}`,
    `Layout: ${layout.metadata.summary}`
  ];

  if (!validation.valid) {
    const repair = repairGameplayGridWithStructure({
      layout,
      gameplayGrid,
      validation,
      random: random.fork("repair")
    });
    if (repair.repaired) {
      gameplayGrid = repair.gameplayGrid;
      warnings.push(...repair.warnings);
      level = buildModernLevelJsonFromGameplayGrid(gameplayGrid, resolvedOptions, rootRandom.seed, [
        intent.summary,
        graph.metadata.summary,
        layout.metadata.summary,
        rasterizedGrid.metadata.summary,
        dressedGrid.metadata.summary,
        gameplayGrid.metadata.summary
      ]);
      validation = validateGeneratedLevel(level);
    }
  }

  warnings.push(...formatValidationWarnings(validation));
  const result: GeneratedLevelResult = {
    level,
    metadata: {
      seed: rootRandom.seed,
      initialState: rootRandom.initialState,
      options: resolvedOptions,
      attempts: attempt,
      profile: resolvedOptions.profile
    },
    warnings
  };

  return {
    id: `intent-${attempt.toString().padStart(2, "0")}`,
    layout,
    gameplayGrid,
    validation,
    result
  };
}

/** Construit le JSON moderne depuis une grille gameplay du pipeline par intention. */
function buildModernLevelJsonFromGameplayGrid(
  gameplayGrid: GameplayPlacedLevelGrid,
  options: LevelGenerationOptions,
  normalizedSeed: string,
  notes: readonly string[]
): ModernLevelJson {
  const seedSlug = createSeedSlug(options.seed);
  return {
    schemaVersion: 1,
    id: `generated-${seedSlug}`,
    label: `Generation ${seedSlug}`,
    author: "Generateur procedural",
    createdDate: GENERATED_LEVEL_DATE,
    width: gameplayGrid.width,
    height: gameplayGrid.height,
    tileSize: 16,
    defaultTile: gameplayGrid.defaultTile,
    time: getTimeLimitForDifficulty(options.difficulty),
    scoreStep: 15,
    requiredDiamonds: gameplayGrid.requiredDiamonds,
    playerSpawn: gameplayGrid.playerSpawn,
    exit: gameplayGrid.exit,
    initialViewport: { x: 0, y: 0 },
    tiles: gameplayGrid.explicitTiles,
    entities: gameplayGrid.entities,
    source: {
      note: [`Niveau genere depuis la seed ${normalizedSeed}.`, ...notes].join(" ")
    }
  };
}

/** Cree un slug documentaire depuis une seed. */
function createSeedSlug(seed: LevelGenerationOptions["seed"]): string {
  return String(seed).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "seed";
}

/** Execute une tentative deterministe complete, puis applique les reparations locales possibles. */
function generateLegacyLevelAttempt(
  resolvedOptions: LevelGenerationOptions,
  profile: LevelGenerationProfile,
  rootRandom: SeededRandom,
  attempt: number
): GeneratedLevelResult {
  const random = rootRandom.fork(`attempt-${attempt}`);
  const grid = createFilledGrid(resolvedOptions.width, resolvedOptions.height, "earth");
  const warnings: string[] = [];

  applyBorder(grid);
  carveHorizontalCorridors(grid, profile, resolvedOptions, random.fork("corridors"));
  carveEarthPockets(grid, profile, resolvedOptions, random.fork("pockets"));
  placePlatformBands(grid, profile, resolvedOptions, random.fork("platforms"));
  softenUniformAreas(grid, random.fork("texture"));
  const gameplay = placeGameplayElements(grid, profile, resolvedOptions, random.fork("gameplay"), warnings);
  let level = buildModernLevelJson(grid, resolvedOptions, gameplay);
  let validation = validateGeneratedLevel(level);
  const repairWarnings = repairGeneratedLevel(grid, gameplay, level, validation, random.fork("repair"));
  if (repairWarnings.length > 0) {
    warnings.push(...repairWarnings);
    level = buildModernLevelJson(grid, resolvedOptions, gameplay);
    validation = validateGeneratedLevel(level);
  }
  warnings.push(...formatValidationWarnings(validation));

  return {
    level,
    metadata: {
      seed: rootRandom.seed,
      initialState: rootRandom.initialState,
      options: resolvedOptions,
      attempts: attempt,
      profile: resolvedOptions.profile
    },
    warnings
  };
}

/** Normalise les options utilisateur avant generation deterministe. */
export function resolveLevelGenerationOptions(options: PartialLevelGenerationOptions): LevelGenerationOptions {
  return {
    seed: options.seed ?? DEFAULT_LEVEL_GENERATION_OPTIONS.seed,
    width: clampInteger(options.width ?? DEFAULT_LEVEL_GENERATION_OPTIONS.width, MIN_GENERATED_WIDTH, MAX_GENERATED_WIDTH),
    height: clampInteger(options.height ?? DEFAULT_LEVEL_GENERATION_OPTIONS.height, MIN_GENERATED_HEIGHT, MAX_GENERATED_HEIGHT),
    difficulty: options.difficulty ?? DEFAULT_LEVEL_GENERATION_OPTIONS.difficulty,
    density: options.density ?? DEFAULT_LEVEL_GENERATION_OPTIONS.density,
    profile: options.profile ?? DEFAULT_LEVEL_GENERATION_OPTIONS.profile
  };
}

/** Cree une grille remplie d'une tuile moderne. */
function createFilledGrid(width: number, height: number, tileType: ModernTileType): GeneratedTileGrid {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => tileType));
}

/** Pose une bordure complete autour de la grille. */
function applyBorder(grid: GeneratedTileGrid): void {
  const width = getGridWidth(grid);
  const height = grid.length;
  for (let x = 0; x < width; x += 1) {
    grid[0][x] = "border";
    grid[height - 1][x] = "border";
  }

  for (let y = 1; y < height - 1; y += 1) {
    grid[y][0] = "border";
    grid[y][width - 1] = "border";
  }
}

/** Creuse quelques couloirs horizontaux, structure tres presente dans les galeries originales. */
function carveHorizontalCorridors(
  grid: GeneratedTileGrid,
  profile: LevelGenerationProfile,
  options: LevelGenerationOptions,
  random: SeededRandom
): void {
  const width = getGridWidth(grid);
  const height = grid.length;
  const densityFactor = getDensityFactor(options.density);
  const corridorCount = clampInteger(
    Math.round(profile.horizontalStructure.corridorRows.average * height / profile.dimensions.height.average * densityFactor),
    1,
    Math.max(1, Math.floor((height - 2) / 3))
  );
  const usedRows = new Set<number>();

  for (let index = 0; index < corridorCount; index += 1) {
    const row = pickUnusedInteriorRow(random, usedRows, height);
    const segments = random.integer(1, 3);
    for (let segment = 0; segment < segments; segment += 1) {
      const segmentWidth = random.integer(Math.max(4, Math.floor(width * 0.25)), Math.max(5, Math.floor(width * 0.68)));
      const startX = random.integer(1, Math.max(1, width - segmentWidth - 1));
      carveHorizontalSegment(grid, row, startX, segmentWidth);
      if (row + 1 < height - 1 && random.chance(0.35)) {
        carveHorizontalSegment(grid, row + 1, startX + random.integer(-2, 2), Math.max(3, segmentWidth - random.integer(1, 5)));
      }
    }
  }
}

/** Ajoute des poches de vide et de petites respirations dans la terre. */
function carveEarthPockets(
  grid: GeneratedTileGrid,
  profile: LevelGenerationProfile,
  options: LevelGenerationOptions,
  random: SeededRandom
): void {
  const width = getGridWidth(grid);
  const height = grid.length;
  const innerCells = (width - 2) * (height - 2);
  const targetEmpty = Math.round(innerCells * getTargetInnerEmptyRatio(profile, options));
  let carved = countInteriorTiles(grid, "empty");
  let guard = innerCells * 4;

  while (carved < targetEmpty && guard > 0) {
    guard -= 1;
    const centerX = random.integer(1, width - 2);
    const centerY = random.integer(1, height - 2);
    const radiusX = random.integer(1, 4);
    const radiusY = random.integer(1, 2);
    for (let y = centerY - radiusY; y <= centerY + radiusY; y += 1) {
      for (let x = centerX - radiusX; x <= centerX + radiusX; x += 1) {
        if (!isInterior(grid, x, y) || grid[y][x] !== "earth") {
          continue;
        }

        const distance = Math.abs(x - centerX) / Math.max(1, radiusX) + Math.abs(y - centerY) / Math.max(1, radiusY);
        if (distance <= 1.25 && random.chance(0.72)) {
          grid[y][x] = "empty";
          carved += 1;
        }
      }
    }
  }
}

/** Place des plateformes sous forme de bandes et segments lisibles. */
function placePlatformBands(
  grid: GeneratedTileGrid,
  profile: LevelGenerationProfile,
  options: LevelGenerationOptions,
  random: SeededRandom
): void {
  const width = getGridWidth(grid);
  const height = grid.length;
  const targetPlatforms = Math.round(width * height * getTargetPlatformRatio(profile, options));
  let placed = countInteriorTiles(grid, "platform");
  const rowCount = clampInteger(
    Math.round(profile.horizontalStructure.platformRows.average * height / profile.dimensions.height.average),
    1,
    Math.max(1, height - 2)
  );
  const usedRows = new Set<number>();

  while (placed < targetPlatforms && usedRows.size < rowCount) {
    const row = pickUnusedInteriorRow(random, usedRows, height);
    const segmentCount = random.integer(1, 3);
    for (let segment = 0; segment < segmentCount && placed < targetPlatforms; segment += 1) {
      const segmentWidth = random.integer(4, Math.max(5, Math.floor(width * 0.45)));
      const startX = random.integer(1, Math.max(1, width - segmentWidth - 1));
      for (let x = startX; x < startX + segmentWidth && x < width - 1 && placed < targetPlatforms; x += 1) {
        if (grid[row][x] !== "border") {
          if (grid[row][x] !== "platform") {
            placed += 1;
          }
          grid[row][x] = "platform";
        }
      }
    }
  }
}

/** Ajoute quelques variations locales pour casser les grands rectangles uniformes. */
function softenUniformAreas(grid: GeneratedTileGrid, random: SeededRandom): void {
  const width = getGridWidth(grid);
  const height = grid.length;
  const attempts = Math.floor(width * height * 0.035);
  for (let index = 0; index < attempts; index += 1) {
    const x = random.integer(1, width - 2);
    const y = random.integer(1, height - 2);
    if (grid[y][x] === "earth" && countSameNeighbors(grid, x, y, "earth") >= 4 && random.chance(0.45)) {
      grid[y][x] = "empty";
    }
  }
}

/** Place les elements gameplay obligatoires et les premiers dangers/collectables. */
function placeGameplayElements(
  grid: GeneratedTileGrid,
  profile: LevelGenerationProfile,
  options: LevelGenerationOptions,
  random: SeededRandom,
  warnings: string[]
): GameplayPlacement {
  const playerSpawn = pickSpawnPosition(grid, random.fork("spawn"));
  carveSafeSpawnArea(grid, playerSpawn);
  const exit = pickExitPosition(grid, playerSpawn, random.fork("exit"));
  grid[exit.y][exit.x] = "border";

  const entities: Array<ModernLevelCell<ModernEntityType>> = [];
  placeDiamonds(grid, profile, options, random.fork("diamonds"), entities, warnings, playerSpawn, exit);
  placeRocks(grid, profile, options, random.fork("rocks"), playerSpawn, exit, warnings);
  placeTransformers(grid, profile, options, random.fork("transformers"), playerSpawn, exit);
  placeMonsters(grid, profile, options, random.fork("monsters"), entities, warnings, playerSpawn, exit);

  return {
    playerSpawn,
    exit,
    entities
  };
}

/** Construit le JSON moderne minimal depuis la grille generee. */
function buildModernLevelJson(grid: GeneratedTileGrid, options: LevelGenerationOptions, gameplay: GameplayPlacement): ModernLevelJson {
  const seedSlug = String(options.seed).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "seed";
  const diamondCount = gameplay.entities.filter((entity) => entity.type === "diamond").length;
  return {
    schemaVersion: 1,
    id: `generated-${seedSlug}`,
    label: `Generation ${seedSlug}`,
    author: "Generateur procedural",
    createdDate: GENERATED_LEVEL_DATE,
    width: getGridWidth(grid),
    height: grid.length,
    tileSize: 16,
    defaultTile: "earth",
    time: getTimeLimitForDifficulty(options.difficulty),
    scoreStep: 15,
    requiredDiamonds: getRequiredDiamondCount(diamondCount, options.difficulty),
    playerSpawn: gameplay.playerSpawn,
    exit: gameplay.exit,
    initialViewport: { x: 0, y: 0 },
    tiles: serializeExplicitTiles(grid, "earth"),
    entities: gameplay.entities,
    source: {
      note: `Niveau genere depuis la seed ${String(options.seed)}.`
    }
  };
}

/** Applique les reparations locales qui ne changent pas l'identite de la seed principale. */
function repairGeneratedLevel(
  grid: GeneratedTileGrid,
  gameplay: GameplayPlacement,
  level: ModernLevelJson,
  validation: GeneratedLevelValidationResult,
  random: SeededRandom
): readonly string[] {
  const errors = new Set(validation.diagnostics.filter((diagnostic) => diagnostic.severity === "error").map((diagnostic) => diagnostic.code));
  const warnings: string[] = [];

  if (errors.size === 0) {
    return warnings;
  }

  if (errors.has("spawn-enclosed")) {
    carveSafeSpawnArea(grid, gameplay.playerSpawn);
    warnings.push("Reparation: zone de spawn ouverte.");
  }

  if (errors.has("entity-on-solid-tile")) {
    repairEntityTiles(grid, gameplay.entities);
    warnings.push("Reparation: tuiles d'entites restaurees.");
  }

  if (errors.has("diamond-objective-too-high")) {
    const missingDiamonds = Math.max(0, level.requiredDiamonds - gameplay.entities.filter((entity) => entity.type === "diamond").length);
    const addedDiamonds = addDiamondsNearSpawn(grid, gameplay, missingDiamonds, random.fork("missing-diamonds"));
    if (addedDiamonds > 0) {
      warnings.push(`Reparation: ${addedDiamonds} diamant(s) ajoute(s).`);
    }
  }

  if (errors.has("exit-unreachable") || errors.has("not-enough-reachable-diamonds")) {
    carveManhattanPath(grid, gameplay.playerSpawn, gameplay.exit, random.fork("exit-path"));
    warnings.push("Reparation: chemin theorique ouvert vers la sortie.");
  }

  if (errors.has("not-enough-reachable-diamonds")) {
    const repairedDiamonds = carveRequiredDiamondPaths(grid, gameplay, level.requiredDiamonds, random.fork("diamond-paths"));
    if (repairedDiamonds > 0) {
      warnings.push(`Reparation: chemin ouvert vers ${repairedDiamonds} diamant(s).`);
    }
  }

  grid[gameplay.exit.y][gameplay.exit.x] = "border";
  return warnings;
}

/** Restaure la tuile correspondant aux entites qui auraient ete recouvertes par un solide. */
function repairEntityTiles(grid: GeneratedTileGrid, entities: readonly ModernLevelCell<ModernEntityType>[]): void {
  for (const entity of entities) {
    if (isInterior(grid, entity.x, entity.y)) {
      grid[entity.y][entity.x] = getTileTypeForEntity(entity.type);
    }
  }
}

/** Ajoute quelques diamants pres d'une zone ouverte si un objectif invalide en demande. */
function addDiamondsNearSpawn(
  grid: GeneratedTileGrid,
  gameplay: GameplayPlacement,
  count: number,
  random: SeededRandom
): number {
  if (count <= 0) {
    return 0;
  }

  const candidates = shuffled(
    random,
    getInteriorPoints(grid)
      .filter((point) => getManhattanDistance(point, gameplay.playerSpawn) >= SPAWN_SAFE_RADIUS)
      .filter((point) => !isSamePoint(point, gameplay.exit))
      .filter((point) => grid[point.y][point.x] === "empty" || grid[point.y][point.x] === "earth")
  );
  let added = 0;
  for (const point of candidates) {
    if (added >= count) {
      break;
    }

    grid[point.y][point.x] = "diamond";
    gameplay.entities.push({ x: point.x, y: point.y, type: "diamond" });
    added += 1;
  }

  return added;
}

/** Ouvre des chemins directs vers les diamants requis, sans simuler toute la physique. */
function carveRequiredDiamondPaths(
  grid: GeneratedTileGrid,
  gameplay: GameplayPlacement,
  requiredDiamonds: number,
  random: SeededRandom
): number {
  const diamonds = gameplay.entities
    .filter((entity) => entity.type === "diamond")
    .sort((first, second) => getManhattanDistance(first, gameplay.playerSpawn) - getManhattanDistance(second, gameplay.playerSpawn))
    .slice(0, requiredDiamonds);

  for (const diamond of diamonds) {
    carveManhattanPath(grid, gameplay.playerSpawn, diamond, random.fork(`${diamond.x}-${diamond.y}`));
    grid[diamond.y][diamond.x] = "diamond";
  }

  return diamonds.length;
}

/** Creuse un chemin Manhattan simple entre deux points interieurs. */
function carveManhattanPath(grid: GeneratedTileGrid, start: GridPoint, end: GridPoint, random: SeededRandom): void {
  const horizontalFirst = random.chance(0.5);
  if (horizontalFirst) {
    carveHorizontalPath(grid, start.x, end.x, start.y, end);
    carveVerticalPath(grid, start.y, end.y, end.x, end);
    return;
  }

  carveVerticalPath(grid, start.y, end.y, start.x, end);
  carveHorizontalPath(grid, start.x, end.x, end.y, end);
}

/** Creuse la portion horizontale d'un chemin Manhattan. */
function carveHorizontalPath(grid: GeneratedTileGrid, fromX: number, toX: number, y: number, end: GridPoint): void {
  const step = fromX <= toX ? 1 : -1;
  for (let x = fromX; x !== toX + step; x += step) {
    clearPathCell(grid, { x, y }, end);
  }
}

/** Creuse la portion verticale d'un chemin Manhattan. */
function carveVerticalPath(grid: GeneratedTileGrid, fromY: number, toY: number, x: number, end: GridPoint): void {
  const step = fromY <= toY ? 1 : -1;
  for (let y = fromY; y !== toY + step; y += step) {
    clearPathCell(grid, { x, y }, end);
  }
}

/** Vide une cellule de chemin sans detruire la destination ni les bordures externes. */
function clearPathCell(grid: GeneratedTileGrid, point: GridPoint, end: GridPoint): void {
  if (!isInterior(grid, point.x, point.y) || isSamePoint(point, end)) {
    return;
  }

  grid[point.y][point.x] = "empty";
}

/** Compare deux points de grille. */
function isSamePoint(first: GridPoint, second: GridPoint): boolean {
  return first.x === second.x && first.y === second.y;
}

/** Convertit une entite moderne vers sa tuile de grille initiale. */
function getTileTypeForEntity(entityType: ModernEntityType): ModernTileType {
  if (entityType === "customMonster") {
    return "customMonster";
  }

  return entityType;
}

/** Formate les diagnostics de validation pour le contrat `warnings` existant. */
function formatValidationWarnings(validation: GeneratedLevelValidationResult): readonly string[] {
  return validation.diagnostics.map((diagnostic) => `${diagnostic.severity}: ${diagnostic.code}: ${diagnostic.message}`);
}

/** Indique si une tentative contient encore des erreurs de validation. */
function hasValidationErrors(warnings: readonly string[]): boolean {
  return countValidationErrors(warnings) > 0;
}

/** Compte les erreurs de validation dans les warnings publics du generateur. */
function countValidationErrors(warnings: readonly string[]): number {
  return warnings.filter((warning) => warning.startsWith("error:")).length;
}

/** Choisit une position de spawn dans une zone interieure respirable. */
function pickSpawnPosition(grid: GeneratedTileGrid, random: SeededRandom): GridPoint {
  const candidates = getInteriorPoints(grid)
    .filter((point) => point.x <= Math.ceil(getGridWidth(grid) * 0.38))
    .filter((point) => point.y <= Math.ceil(grid.length * 0.55))
    .filter((point) => grid[point.y][point.x] === "empty" || grid[point.y][point.x] === "earth");

  return random.pick(candidates.length > 0 ? candidates : getInteriorPoints(grid));
}

/** Ouvre une petite zone sure autour du spawn. */
function carveSafeSpawnArea(grid: GeneratedTileGrid, spawn: GridPoint): void {
  for (let y = spawn.y - 1; y <= spawn.y + 1; y += 1) {
    for (let x = spawn.x - 1; x <= spawn.x + 1; x += 1) {
      if (isInterior(grid, x, y)) {
        grid[y][x] = "empty";
      }
    }
  }
}

/** Choisit une sortie assez eloignee du spawn. */
function pickExitPosition(grid: GeneratedTileGrid, spawn: GridPoint, random: SeededRandom): GridPoint {
  const minDistance = Math.floor((getGridWidth(grid) + grid.length) * MIN_EXIT_DISTANCE_RATIO);
  const candidates = getInteriorPoints(grid)
    .filter((point) => getManhattanDistance(point, spawn) >= minDistance)
    .filter((point) => point.x >= Math.floor(getGridWidth(grid) * 0.45) || point.y >= Math.floor(grid.length * 0.55));

  return random.pick(candidates.length > 0 ? candidates : getInteriorPoints(grid));
}

/** Place les diamants selon le profil et la difficulte. */
function placeDiamonds(
  grid: GeneratedTileGrid,
  profile: LevelGenerationProfile,
  options: LevelGenerationOptions,
  random: SeededRandom,
  entities: Array<ModernLevelCell<ModernEntityType>>,
  warnings: string[],
  spawn: GridPoint,
  exit: GridPoint
): void {
  const targetCount = clampInteger(
    Math.round(profile.diamonds.present.average * getDifficultyObjectFactor(options.difficulty) * getObjectDensityFactor(options.density)),
    3,
    Math.max(3, Math.floor(getInteriorCellCount(grid) * 0.08))
  );
  const candidates = shuffled(
    random,
    getInteriorPoints(grid)
      .filter((point) => !isReservedPoint(point, spawn, exit))
      .filter((point) => getManhattanDistance(point, spawn) > 4)
      .filter((point) => grid[point.y][point.x] === "earth" || grid[point.y][point.x] === "empty")
  );

  const placed = placeEntityBackedTiles(grid, candidates, targetCount, "diamond", "diamond", entities);
  if (placed < targetCount) {
    warnings.push(`Diamants places partiellement: ${placed}/${targetCount}.`);
  }
}

/** Place les rochers comme tuiles physiques statiques. */
function placeRocks(
  grid: GeneratedTileGrid,
  profile: LevelGenerationProfile,
  options: LevelGenerationOptions,
  random: SeededRandom,
  spawn: GridPoint,
  exit: GridPoint,
  warnings: string[]
): void {
  const rockDensity = profile.tileDensities.rock?.ratio ?? 0.08;
  const targetCount = clampInteger(
    Math.round(getInteriorCellCount(grid) * rockDensity * getObjectDensityFactor(options.density) * getDifficultyObjectFactor(options.difficulty)),
    4,
    Math.max(4, Math.floor(getInteriorCellCount(grid) * 0.16))
  );
  const candidates = shuffled(
    random,
    getInteriorPoints(grid)
      .filter((point) => !isReservedPoint(point, spawn, exit))
      .filter((point) => getManhattanDistance(point, spawn) > SPAWN_SAFE_RADIUS)
      .filter((point) => grid[point.y][point.x] === "earth" || grid[point.y][point.x] === "empty")
  );
  const placed = placeTiles(grid, candidates, targetCount, "rock");
  if (placed < targetCount) {
    warnings.push(`Rochers places partiellement: ${placed}/${targetCount}.`);
  }
}

/** Place quelques blocs transformateurs, surtout sur les profils/difficultes avances. */
function placeTransformers(
  grid: GeneratedTileGrid,
  profile: LevelGenerationProfile,
  options: LevelGenerationOptions,
  random: SeededRandom,
  spawn: GridPoint,
  exit: GridPoint
): void {
  const baseCount = Math.round(profile.tileDensities.transformerBlock?.count ?? 0) / Math.max(1, profile.sampleCount);
  const difficultyBonus = options.difficulty === "hard" || options.difficulty === "expert" ? 1 : 0;
  const targetCount = clampInteger(Math.round(baseCount * 0.55) + difficultyBonus, 0, 6);
  const candidates = shuffled(
    random,
    getInteriorPoints(grid)
      .filter((point) => !isReservedPoint(point, spawn, exit))
      .filter((point) => getManhattanDistance(point, spawn) > MIN_SPAWN_DANGER_DISTANCE)
      .filter((point) => grid[point.y][point.x] === "earth" || grid[point.y][point.x] === "empty")
  );
  placeTiles(grid, candidates, targetCount, "transformerBlock");
}

/** Place monstres standards et creatures speciales avec un minimum d'espace. */
function placeMonsters(
  grid: GeneratedTileGrid,
  profile: LevelGenerationProfile,
  options: LevelGenerationOptions,
  random: SeededRandom,
  entities: Array<ModernLevelCell<ModernEntityType>>,
  warnings: string[],
  spawn: GridPoint,
  exit: GridPoint
): void {
  const monsterCount = clampInteger(
    Math.round((profile.entityAverages.monster ?? 6) * getDifficultyMonsterFactor(options.difficulty)),
    options.difficulty === "easy" ? 1 : 2,
    Math.max(2, Math.floor(getInteriorCellCount(grid) * 0.035))
  );
  const specialCount = clampInteger(
    Math.round((profile.entityAverages.specialCreature ?? 0) * getSpecialCreatureFactor(options.difficulty)),
    0,
    5
  );
  const candidates = shuffled(
    random,
    getInteriorPoints(grid)
      .filter((point) => !isReservedPoint(point, spawn, exit))
      .filter((point) => getManhattanDistance(point, spawn) >= MIN_SPAWN_DANGER_DISTANCE)
      .filter((point) => grid[point.y][point.x] === "empty")
      .filter((point) => countWalkableNeighbors(grid, point.x, point.y) >= 2)
  );

  const placedMonsters = placeEntityBackedTiles(grid, candidates, monsterCount, "monster", "monster", entities);
  const remainingCandidates = candidates.filter((point) => grid[point.y][point.x] === "empty");
  const placedSpecials = placeEntityBackedTiles(grid, remainingCandidates, specialCount, "specialCreature", "specialCreature", entities);
  if (placedMonsters < monsterCount) {
    warnings.push(`Monstres places partiellement: ${placedMonsters}/${monsterCount}.`);
  }
  if (placedSpecials < specialCount) {
    warnings.push(`Creatures speciales placees partiellement: ${placedSpecials}/${specialCount}.`);
  }
}

/** Place des tuiles associees a une entite moderne. */
function placeEntityBackedTiles(
  grid: GeneratedTileGrid,
  candidates: readonly GridPoint[],
  targetCount: number,
  tileType: ModernTileType,
  entityType: ModernEntityType,
  entities: Array<ModernLevelCell<ModernEntityType>>
): number {
  let placed = 0;
  for (const point of candidates) {
    if (placed >= targetCount) {
      break;
    }

    if (grid[point.y][point.x] === "border" || grid[point.y][point.x] === "platform") {
      continue;
    }

    grid[point.y][point.x] = tileType;
    entities.push({ x: point.x, y: point.y, type: entityType });
    placed += 1;
  }

  return placed;
}

/** Place des tuiles simples sur une liste de candidats. */
function placeTiles(grid: GeneratedTileGrid, candidates: readonly GridPoint[], targetCount: number, tileType: ModernTileType): number {
  let placed = 0;
  for (const point of candidates) {
    if (placed >= targetCount) {
      break;
    }

    if (grid[point.y][point.x] === "border" || grid[point.y][point.x] === "platform") {
      continue;
    }

    grid[point.y][point.x] = tileType;
    placed += 1;
  }

  return placed;
}

/** Retourne toutes les cellules interieures de la grille. */
function getInteriorPoints(grid: GeneratedTileGrid): readonly GridPoint[] {
  const points: GridPoint[] = [];
  for (let y = 1; y < grid.length - 1; y += 1) {
    for (let x = 1; x < getGridWidth(grid) - 1; x += 1) {
      points.push({ x, y });
    }
  }

  return points;
}

/** Melange une liste avec le PRNG seede pour conserver la reproductibilite. */
function shuffled<TValue>(random: SeededRandom, values: readonly TValue[]): readonly TValue[] {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = random.integer(0, index);
    const current = copy[index];
    copy[index] = copy[swapIndex];
    copy[swapIndex] = current;
  }

  return copy;
}

/** Indique si un point doit rester libre pour le depart ou la sortie. */
function isReservedPoint(point: GridPoint, spawn: GridPoint, exit: GridPoint): boolean {
  return getManhattanDistance(point, spawn) <= SPAWN_SAFE_RADIUS || getManhattanDistance(point, exit) <= 1;
}

/** Compte les voisins permettant a une entite de circuler au depart. */
function countWalkableNeighbors(grid: GeneratedTileGrid, x: number, y: number): number {
  return [
    grid[y - 1]?.[x],
    grid[y + 1]?.[x],
    grid[y]?.[x - 1],
    grid[y]?.[x + 1]
  ].filter((tileType) => tileType === "empty" || tileType === "earth").length;
}

/** Compte les cellules interieures, hors bordure. */
function getInteriorCellCount(grid: GeneratedTileGrid): number {
  return Math.max(0, getGridWidth(grid) - 2) * Math.max(0, grid.length - 2);
}

/** Calcule la distance Manhattan entre deux points de grille. */
function getManhattanDistance(first: GridPoint, second: GridPoint): number {
  return Math.abs(first.x - second.x) + Math.abs(first.y - second.y);
}

/** Adapte la quantite d'objets collectables/physiques selon la difficulte. */
function getDifficultyObjectFactor(difficulty: LevelGenerationDifficulty): number {
  if (difficulty === "easy") {
    return 0.82;
  }

  if (difficulty === "hard") {
    return 1.12;
  }

  if (difficulty === "expert") {
    return 1.28;
  }

  return 1;
}

/** Adapte la quantite d'objets selon la densite globale demandee. */
function getObjectDensityFactor(density: LevelGenerationDensity): number {
  if (density === "light") {
    return 0.82;
  }

  if (density === "dense") {
    return 1.18;
  }

  return 1;
}

/** Adapte la pression des monstres selon la difficulte. */
function getDifficultyMonsterFactor(difficulty: LevelGenerationDifficulty): number {
  if (difficulty === "easy") {
    return 0.55;
  }

  if (difficulty === "hard") {
    return 1.18;
  }

  if (difficulty === "expert") {
    return 1.45;
  }

  return 0.9;
}

/** Adapte la presence des creatures speciales selon la difficulte. */
function getSpecialCreatureFactor(difficulty: LevelGenerationDifficulty): number {
  if (difficulty === "easy") {
    return 0;
  }

  if (difficulty === "hard") {
    return 1.1;
  }

  if (difficulty === "expert") {
    return 1.5;
  }

  return 0.7;
}

/** Calcule l'objectif de diamants depuis les diamants places. */
function getRequiredDiamondCount(diamondCount: number, difficulty: LevelGenerationDifficulty): number {
  if (diamondCount <= 0) {
    return 0;
  }

  const ratioByDifficulty: Readonly<Record<LevelGenerationDifficulty, number>> = {
    easy: 0.55,
    normal: 0.7,
    hard: 0.85,
    expert: 1
  };

  return clampInteger(Math.floor(diamondCount * ratioByDifficulty[difficulty]), 1, diamondCount);
}

/** Convertit une grille complete en cellules explicites differentes de la tuile par defaut. */
function serializeExplicitTiles(grid: GeneratedTileGrid, defaultTile: ModernTileType): Array<ModernLevelCell<ModernTileType>> {
  const cells: Array<ModernLevelCell<ModernTileType>> = [];
  for (let y = 0; y < grid.length; y += 1) {
    for (let x = 0; x < getGridWidth(grid); x += 1) {
      const type = grid[y][x];
      if (type !== defaultTile) {
        cells.push({ x, y, type });
      }
    }
  }

  return cells;
}

/** Retourne un ratio cible de vide interieur a partir du profil et de la densite demandee. */
function getTargetInnerEmptyRatio(profile: LevelGenerationProfile, options: LevelGenerationOptions): number {
  const emptyDensity = profile.tileDensities.empty?.ratio ?? MIN_INNER_EMPTY_RATIO;
  return Math.max(MIN_INNER_EMPTY_RATIO, emptyDensity * getDensityFactor(options.density));
}

/** Retourne un ratio cible de plateformes. */
function getTargetPlatformRatio(profile: LevelGenerationProfile, options: LevelGenerationOptions): number {
  const platformDensity = profile.tileDensities.platform?.ratio ?? 0.07;
  return Math.min(MAX_PLATFORM_RATIO, platformDensity * getPlatformDensityFactor(options.density));
}

/** Adapte la densite generale de vide selon l'option moderne. */
function getDensityFactor(density: LevelGenerationDensity): number {
  if (density === "light") {
    return 1.3;
  }

  if (density === "dense") {
    return 0.75;
  }

  return 1;
}

/** Adapte la densite de plateformes selon l'option moderne. */
function getPlatformDensityFactor(density: LevelGenerationDensity): number {
  if (density === "light") {
    return 0.8;
  }

  if (density === "dense") {
    return 1.2;
  }

  return 1;
}

/** Retourne un temps provisoire selon la difficulte, avant placement gameplay fin. */
function getTimeLimitForDifficulty(difficulty: LevelGenerationDifficulty): number {
  if (difficulty === "easy") {
    return 300;
  }

  if (difficulty === "hard") {
    return 220;
  }

  if (difficulty === "expert") {
    return 180;
  }

  return 250;
}

/** Selectionne une ligne interieure non encore utilisee. */
function pickUnusedInteriorRow(random: SeededRandom, usedRows: Set<number>, height: number): number {
  for (let attempt = 0; attempt < height * 2; attempt += 1) {
    const row = random.integer(1, height - 2);
    if (!usedRows.has(row)) {
      usedRows.add(row);
      return row;
    }
  }

  for (let row = 1; row < height - 1; row += 1) {
    if (!usedRows.has(row)) {
      usedRows.add(row);
      return row;
    }
  }

  return 1;
}

/** Creuse un segment horizontal en preservant les bordures. */
function carveHorizontalSegment(grid: GeneratedTileGrid, row: number, startX: number, length: number): void {
  const width = getGridWidth(grid);
  for (let x = Math.max(1, startX); x < Math.min(width - 1, startX + length); x += 1) {
    if (grid[row][x] === "earth") {
      grid[row][x] = "empty";
    }
  }
}

/** Compte les voisins orthogonaux d'un type donne. */
function countSameNeighbors(grid: GeneratedTileGrid, x: number, y: number, tileType: ModernTileType): number {
  return [
    grid[y - 1]?.[x],
    grid[y + 1]?.[x],
    grid[y]?.[x - 1],
    grid[y]?.[x + 1]
  ].filter((neighbor) => neighbor === tileType).length;
}

/** Compte les cellules interieures d'un type donne. */
function countInteriorTiles(grid: GeneratedTileGrid, tileType: ModernTileType): number {
  let count = 0;
  for (let y = 1; y < grid.length - 1; y += 1) {
    for (let x = 1; x < getGridWidth(grid) - 1; x += 1) {
      if (grid[y][x] === tileType) {
        count += 1;
      }
    }
  }

  return count;
}

/** Indique si une cellule appartient a l'interieur jouable de la grille. */
function isInterior(grid: GeneratedTileGrid, x: number, y: number): boolean {
  return y > 0 && y < grid.length - 1 && x > 0 && x < getGridWidth(grid) - 1;
}

/** Retourne la largeur d'une grille non vide. */
function getGridWidth(grid: GeneratedTileGrid): number {
  return grid[0]?.length ?? 0;
}

/** Contraint un entier dans une plage. */
function clampInteger(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}
