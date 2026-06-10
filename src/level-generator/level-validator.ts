/**
 * Role: Valide les niveaux produits par le generateur seede.
 * Scope: Controle la structure moderne et quelques contraintes de jouabilite theorique.
 * ISO: Ne simule pas le moteur TO8; verifie seulement les invariants utiles avant runtime.
 * Notes: Les reparations et retries restent separes pour garder les diagnostics explicites.
 */

import type { ModernGridPoint, ModernLevelJson, ModernTileType } from "../game/level-loader";
import { getModernEntityIds, getModernTileIds } from "../worlds/world-registry";

/** Severite d'un diagnostic de generation. */
export type GeneratedLevelDiagnosticSeverity = "error" | "warning";

/** Diagnostic structure retourne par la validation du generateur. */
export interface GeneratedLevelDiagnostic {
  /** Niveau de gravite du probleme detecte. */
  readonly severity: GeneratedLevelDiagnosticSeverity;
  /** Code stable exploitable par de futurs outils UI/tests. */
  readonly code: string;
  /** Message court et lisible. */
  readonly message: string;
}

/** Resultat complet de validation d'un niveau genere. */
export interface GeneratedLevelValidationResult {
  /** Vrai si aucun diagnostic bloquant n'a ete emis. */
  readonly valid: boolean;
  /** Ensemble des diagnostics trouves. */
  readonly diagnostics: readonly GeneratedLevelDiagnostic[];
}

/** Tuiles considerees franchissables pour une validation theorique simple. */
const THEORETICAL_WALKABLE_TILES: readonly ModernTileType[] = [
  "empty",
  "earth",
  "diamond",
  "monster",
  "specialCreature"
];
/** Tuiles solides qui enferment le spawn dans la validation simple. */
const SPAWN_BLOCKING_TILES: readonly ModernTileType[] = [
  "border",
  "rock",
  "platform",
  "transformerBlock"
];
/** Ratio de cellules solides au-dela duquel le niveau devient probablement illisible. */
const MAX_SOLID_RATIO_WARNING = 0.78;
/** Ratio de cellules vides au-dela duquel le niveau devient probablement trop creux. */
const MAX_EMPTY_RATIO_WARNING = 0.62;

/** Valide un niveau moderne genere et retourne erreurs bloquantes et warnings. */
export function validateGeneratedLevel(level: ModernLevelJson): GeneratedLevelValidationResult {
  const diagnostics: GeneratedLevelDiagnostic[] = [];
  const grid = buildTileGrid(level);

  validateDimensions(level, diagnostics);
  validatePoints(level, diagnostics);
  validateCells(level, diagnostics);
  validateMinimalBorders(level, grid, diagnostics);
  validateEntities(level, grid, diagnostics);
  validateDiamonds(level, grid, diagnostics);
  validateSpawnFreedom(level, grid, diagnostics);
  validateTheoreticalReachability(level, grid, diagnostics);
  validateDensity(level, grid, diagnostics);

  return {
    valid: !diagnostics.some((diagnostic) => diagnostic.severity === "error"),
    diagnostics
  };
}

/** Construit une grille complete en appliquant les tuiles explicites valides en bornes. */
function buildTileGrid(level: ModernLevelJson): ModernTileType[][] {
  const grid = Array.from({ length: Math.max(0, level.height) }, () =>
    Array.from({ length: Math.max(0, level.width) }, () => level.defaultTile)
  );
  for (const tile of level.tiles) {
    if (isInsideLevel(level, tile)) {
      grid[tile.y][tile.x] = tile.type;
    }
  }

  return grid;
}

/** Controle les dimensions minimales du niveau. */
function validateDimensions(level: ModernLevelJson, diagnostics: GeneratedLevelDiagnostic[]): void {
  if (!Number.isInteger(level.width) || level.width < 3 || !Number.isInteger(level.height) || level.height < 3) {
    diagnostics.push({
      severity: "error",
      code: "invalid-dimensions",
      message: "Dimensions de niveau invalides"
    });
  }

  if (!Number.isInteger(level.tileSize) || level.tileSize <= 0) {
    diagnostics.push({
      severity: "error",
      code: "invalid-tile-size",
      message: "Taille de tuile invalide"
    });
  }
}

/** Controle les points obligatoires du niveau. */
function validatePoints(level: ModernLevelJson, diagnostics: GeneratedLevelDiagnostic[]): void {
  if (!isInsideLevel(level, level.playerSpawn)) {
    diagnostics.push({
      severity: "error",
      code: "spawn-out-of-bounds",
      message: "Spawn hors grille"
    });
  }

  if (!isInsideLevel(level, level.exit)) {
    diagnostics.push({
      severity: "error",
      code: "exit-out-of-bounds",
      message: "Sortie hors grille"
    });
  }
}

/** Controle les cellules explicites et les types connus. */
function validateCells(level: ModernLevelJson, diagnostics: GeneratedLevelDiagnostic[]): void {
  const supportedTiles = getModernTileIds();
  if (!supportedTiles.includes(level.defaultTile)) {
    diagnostics.push({
      severity: "error",
      code: "unknown-default-tile",
      message: `Tuile par defaut inconnue: ${level.defaultTile}`
    });
  }

  for (const tile of level.tiles) {
    if (!isInsideLevel(level, tile)) {
      diagnostics.push({
        severity: "error",
        code: "tile-out-of-bounds",
        message: `Tuile hors grille ${tile.x}/${tile.y}`
      });
    }
    if (!supportedTiles.includes(tile.type)) {
      diagnostics.push({
        severity: "error",
        code: "unknown-tile",
        message: `Tuile inconnue: ${tile.type}`
      });
    }
  }
}

/** Controle la bordure complete autour de la grille. */
function validateMinimalBorders(
  level: ModernLevelJson,
  grid: readonly (readonly ModernTileType[])[],
  diagnostics: GeneratedLevelDiagnostic[]
): void {
  if (level.width < 3 || level.height < 3) {
    return;
  }

  for (let x = 0; x < level.width; x += 1) {
    if (getTileAt(grid, x, 0) !== "border" || getTileAt(grid, x, level.height - 1) !== "border") {
      diagnostics.push({
        severity: "error",
        code: "incomplete-border",
        message: "Bordures horizontales incompletes"
      });
      return;
    }
  }

  for (let y = 0; y < level.height; y += 1) {
    if (getTileAt(grid, 0, y) !== "border" || getTileAt(grid, level.width - 1, y) !== "border") {
      diagnostics.push({
        severity: "error",
        code: "incomplete-border",
        message: "Bordures verticales incompletes"
      });
      return;
    }
  }
}

/** Controle les entites modernes et leur compatibilite de cellule initiale. */
function validateEntities(
  level: ModernLevelJson,
  grid: readonly (readonly ModernTileType[])[],
  diagnostics: GeneratedLevelDiagnostic[]
): void {
  const supportedEntities = getModernEntityIds();
  for (const entity of level.entities) {
    if (!isInsideLevel(level, entity)) {
      diagnostics.push({
        severity: "error",
        code: "entity-out-of-bounds",
        message: `Entite hors grille ${entity.x}/${entity.y}`
      });
      continue;
    }

    if (!supportedEntities.includes(entity.type)) {
      diagnostics.push({
        severity: "error",
        code: "unknown-entity",
        message: `Entite inconnue: ${entity.type}`
      });
    }

    const tile = getTileAt(grid, entity.x, entity.y);
    if (tile === "border" || tile === "rock" || tile === "platform" || tile === "transformerBlock") {
      diagnostics.push({
        severity: "error",
        code: "entity-on-solid-tile",
        message: `Entite incompatible avec une tuile solide ${entity.x}/${entity.y}`
      });
    }
  }
}

/** Controle l'objectif diamant par rapport aux diamants presents. */
function validateDiamonds(
  level: ModernLevelJson,
  grid: readonly (readonly ModernTileType[])[],
  diagnostics: GeneratedLevelDiagnostic[]
): void {
  const diamondEntities = level.entities.filter((entity) => entity.type === "diamond");
  const diamondTiles = countTiles(grid, "diamond");
  if (diamondEntities.length === 0 || diamondTiles === 0) {
    diagnostics.push({
      severity: "warning",
      code: "no-diamonds",
      message: "Aucun diamant initial"
    });
  }

  if (level.requiredDiamonds > diamondEntities.length) {
    diagnostics.push({
      severity: "error",
      code: "diamond-objective-too-high",
      message: "Objectif diamants superieur aux diamants initiaux"
    });
  }
}

/** Signale un spawn enferme par les cellules solides cardinales. */
function validateSpawnFreedom(
  level: ModernLevelJson,
  grid: readonly (readonly ModernTileType[])[],
  diagnostics: GeneratedLevelDiagnostic[]
): void {
  if (!isInsideLevel(level, level.playerSpawn)) {
    return;
  }

  const blocked = getCardinalNeighbours(level.playerSpawn)
    .every((point) => !isInsideLevel(level, point) || SPAWN_BLOCKING_TILES.includes(getTileAt(grid, point.x, point.y)));
  if (blocked) {
    diagnostics.push({
      severity: "error",
      code: "spawn-enclosed",
      message: "Spawn enferme"
    });
  }
}

/** Controle un chemin theorique vers la sortie et assez de diamants accessibles. */
function validateTheoreticalReachability(
  level: ModernLevelJson,
  grid: readonly (readonly ModernTileType[])[],
  diagnostics: GeneratedLevelDiagnostic[]
): void {
  if (!isInsideLevel(level, level.playerSpawn) || !isInsideLevel(level, level.exit)) {
    return;
  }

  const reachable = floodFillReachable(level, grid);
  const exitReachable = reachable.has(toPointKey(level.exit));
  if (!exitReachable) {
    diagnostics.push({
      severity: "error",
      code: "exit-unreachable",
      message: "Aucun chemin theorique vers la sortie"
    });
  }

  const reachableDiamonds = level.entities
    .filter((entity) => entity.type === "diamond")
    .filter((entity) => reachable.has(toPointKey(entity)));
  if (reachableDiamonds.length < level.requiredDiamonds) {
    diagnostics.push({
      severity: "error",
      code: "not-enough-reachable-diamonds",
      message: "Diamants accessibles insuffisants pour l'objectif"
    });
  }
}

/** Controle les densites extremes qui nuisent a la lisibilite. */
function validateDensity(
  level: ModernLevelJson,
  grid: readonly (readonly ModernTileType[])[],
  diagnostics: GeneratedLevelDiagnostic[]
): void {
  const totalCells = Math.max(1, level.width * level.height);
  const solidCount = countTiles(grid, "border") + countTiles(grid, "rock") + countTiles(grid, "platform") + countTiles(grid, "transformerBlock");
  const emptyCount = countTiles(grid, "empty");
  if (solidCount / totalCells > MAX_SOLID_RATIO_WARNING) {
    diagnostics.push({
      severity: "warning",
      code: "very-solid-level",
      message: "Densite solide tres elevee"
    });
  }

  if (emptyCount / totalCells > MAX_EMPTY_RATIO_WARNING) {
    diagnostics.push({
      severity: "warning",
      code: "very-empty-level",
      message: "Niveau tres ouvert"
    });
  }
}

/** Calcule les cellules accessibles en considerant la terre creusable. */
function floodFillReachable(level: ModernLevelJson, grid: readonly (readonly ModernTileType[])[]): ReadonlySet<string> {
  const visited = new Set<string>();
  const queue: ModernGridPoint[] = [level.playerSpawn];

  while (queue.length > 0) {
    const point = queue.shift();
    if (!point || visited.has(toPointKey(point))) {
      continue;
    }

    visited.add(toPointKey(point));
    for (const neighbour of getCardinalNeighbours(point)) {
      if (!isInsideLevel(level, neighbour) || visited.has(toPointKey(neighbour))) {
        continue;
      }
      if (isTheoreticallyWalkable(level, grid, neighbour)) {
        queue.push(neighbour);
      }
    }
  }

  return visited;
}

/** Indique si une cellule peut etre traversee par le chemin theorique. */
function isTheoreticallyWalkable(
  level: ModernLevelJson,
  grid: readonly (readonly ModernTileType[])[],
  point: ModernGridPoint
): boolean {
  if (point.x === level.exit.x && point.y === level.exit.y) {
    return true;
  }

  return THEORETICAL_WALKABLE_TILES.includes(getTileAt(grid, point.x, point.y));
}

/** Retourne les voisins cardinaux d'un point. */
function getCardinalNeighbours(point: ModernGridPoint): readonly ModernGridPoint[] {
  return [
    { x: point.x - 1, y: point.y },
    { x: point.x + 1, y: point.y },
    { x: point.x, y: point.y - 1 },
    { x: point.x, y: point.y + 1 }
  ];
}

/** Compte les tuiles d'un type donne dans une grille. */
function countTiles(grid: readonly (readonly ModernTileType[])[], tileType: ModernTileType): number {
  return grid.reduce((total, row) => total + row.filter((tile) => tile === tileType).length, 0);
}

/** Retourne la tuile a une coordonnee supposee dans la grille. */
function getTileAt(grid: readonly (readonly ModernTileType[])[], x: number, y: number): ModernTileType {
  return grid[y]?.[x] ?? "border";
}

/** Indique si un point appartient a la grille du niveau. */
function isInsideLevel(level: ModernLevelJson, point: ModernGridPoint): boolean {
  return point.x >= 0 && point.y >= 0 && point.x < level.width && point.y < level.height;
}

/** Encode un point pour les ensembles de positions. */
function toPointKey(point: ModernGridPoint): string {
  return `${point.x}:${point.y}`;
}
