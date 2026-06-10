/**
 * Role: Repare un candidat genere en respectant le layout et la carte de zones.
 * Scope: Corrige accessibilite theorique, spawn, sortie, diamants et entites invalides sans casser la silhouette.
 * ISO: Les reparations restent modernes et structurelles; elles ne reproduisent pas les routines TO8.
 * Notes: Ce module prepare l'integration finale du pipeline par intention sans modifier le generateur historique.
 */

import type { ModernEntityType, ModernLevelCell, ModernTileType } from "../game/level-loader";
import type {
  GameplayPlacedLevelGrid,
  GameplayPlacementMetadata
} from "./level-gameplay-placer";
import type { LevelLayout, LevelLayoutPoint, LevelLayoutZone } from "./level-layout";
import type { GeneratedLevelValidationResult } from "./level-validator";
import type { SeededRandom } from "./seeded-random";

/** Entree d'une reparation structurelle. */
export interface StructureRepairInput {
  /** Layout source a respecter. */
  readonly layout: LevelLayout;
  /** Grille gameplay a reparer. */
  readonly gameplayGrid: GameplayPlacedLevelGrid;
  /** Diagnostics de validation qui motivent la reparation. */
  readonly validation: GeneratedLevelValidationResult;
  /** PRNG seede pour les choix non ambigus. */
  readonly random: SeededRandom;
}

/** Resultat d'une reparation structurelle. */
export interface StructureRepairResult {
  /** Grille gameplay reparee ou identique si rien n'etait applicable. */
  readonly gameplayGrid: GameplayPlacedLevelGrid;
  /** Indique si au moins une reparation a ete appliquee. */
  readonly repaired: boolean;
  /** Warnings explicites des contraintes reparees. */
  readonly warnings: readonly string[];
}

/** Tuiles traversables par la validation theorique. */
const THEORETICAL_WALKABLE_TILES: readonly ModernTileType[] = [
  "empty",
  "earth",
  "diamond",
  "monster",
  "specialCreature"
];
/** Rayon de securite minimal autour du spawn. */
const SPAWN_REPAIR_RADIUS = 2;

/** Repare une grille en suivant les zones et connexions prevues par le layout. */
export function repairGameplayGridWithStructure(input: StructureRepairInput): StructureRepairResult {
  const errors = new Set(input.validation.diagnostics.filter((diagnostic) => diagnostic.severity === "error").map((diagnostic) => diagnostic.code));
  const warnings: string[] = [];
  const tiles = cloneTileGrid(input.gameplayGrid.tiles);
  let entities = [...input.gameplayGrid.entities];
  let playerSpawn = input.gameplayGrid.playerSpawn;
  let exit = input.gameplayGrid.exit;

  if (errors.has("spawn-out-of-bounds") || !isInterior(tiles, playerSpawn.x, playerSpawn.y)) {
    playerSpawn = chooseCompatiblePoint(getStartZone(input.layout), tiles, input.random.fork("repair-spawn"));
    warnings.push("Reparation structurelle: spawn replace dans la zone de depart.");
  }

  if (errors.has("exit-out-of-bounds") || !isInterior(tiles, exit.x, exit.y)) {
    exit = chooseCompatiblePoint(getExitZone(input.layout), tiles, input.random.fork("repair-exit"));
    warnings.push("Reparation structurelle: sortie replacee dans la zone finale.");
  }

  if (errors.has("spawn-enclosed")) {
    clearSpawnArea(tiles, playerSpawn);
    warnings.push("Reparation structurelle: zone de spawn ouverte sans changer de zone.");
  }

  if (errors.has("entity-on-solid-tile")) {
    repairEntityTiles(tiles, entities);
    warnings.push("Reparation structurelle: tuiles porteuses d'entites restaurees.");
  }

  if (errors.has("exit-unreachable")) {
    carvePlannedPath(input.layout, tiles, playerSpawn, exit);
    warnings.push("Reparation structurelle: chemin ouvert via les zones et connexions du layout.");
  }

  if (errors.has("not-enough-reachable-diamonds") || errors.has("diamond-objective-too-high")) {
    const addedDiamonds = addDiamondsInCollectionZones(input.layout, tiles, entities, input.gameplayGrid.requiredDiamonds, playerSpawn, exit, input.random.fork("repair-diamonds"));
    if (addedDiamonds > 0) {
      warnings.push(`Reparation structurelle: ${addedDiamonds} diamant(s) ajoute(s) dans les zones de collecte.`);
    }
    carvePathsToRequiredDiamonds(input.layout, tiles, entities, input.gameplayGrid.requiredDiamonds, playerSpawn);
    warnings.push("Reparation structurelle: acces aux diamants requis ouvert via les zones prevues.");
  }

  const reducedRocks = reduceBlockingRocksOnPlannedPaths(input.layout, tiles, playerSpawn, exit);
  if (reducedRocks > 0) {
    warnings.push(`Reparation structurelle: ${reducedRocks} rocher(s) bloquant(s) retires sur les chemins planifies.`);
  }

  tiles[exit.y][exit.x] = "border";
  entities = cleanEntities(entities, tiles, playerSpawn, exit);
  const repairedGrid = createGameplayGrid(input.gameplayGrid, tiles, entities, playerSpawn, exit);

  return {
    gameplayGrid: repairedGrid,
    repaired: warnings.length > 0,
    warnings
  };
}

/** Retourne la zone de depart du chemin principal. */
function getStartZone(layout: LevelLayout): LevelLayoutZone {
  const nodeId = layout.graph.mainPathNodeIds[0];
  return layout.zones.find((zone) => zone.nodeId === nodeId) ?? layout.zones[0];
}

/** Retourne la zone finale du chemin principal. */
function getExitZone(layout: LevelLayout): LevelLayoutZone {
  const nodeId = layout.graph.mainPathNodeIds[layout.graph.mainPathNodeIds.length - 1];
  return layout.zones.find((zone) => zone.nodeId === nodeId) ?? layout.zones[layout.zones.length - 1];
}

/** Choisit un point compatible dans une zone. */
function chooseCompatiblePoint(zone: LevelLayoutZone, tiles: readonly (readonly ModernTileType[])[], random: SeededRandom): LevelLayoutPoint {
  const candidates = getZonePoints(zone, tiles)
    .filter((point) => isInterior(tiles, point.x, point.y))
    .sort((first, second) => getManhattanDistance(first, zone.center) - getManhattanDistance(second, zone.center));
  if (candidates.length === 0) {
    return clampPointToInterior(zone.center, tiles);
  }

  return random.pick(candidates.slice(0, Math.min(4, candidates.length)));
}

/** Ouvre un petit disque Manhattan autour du spawn. */
function clearSpawnArea(tiles: ModernTileType[][], playerSpawn: LevelLayoutPoint): void {
  for (let y = playerSpawn.y - SPAWN_REPAIR_RADIUS; y <= playerSpawn.y + SPAWN_REPAIR_RADIUS; y += 1) {
    for (let x = playerSpawn.x - SPAWN_REPAIR_RADIUS; x <= playerSpawn.x + SPAWN_REPAIR_RADIUS; x += 1) {
      if (isInterior(tiles, x, y) && getManhattanDistance(playerSpawn, { x, y }) <= SPAWN_REPAIR_RADIUS) {
        tiles[y][x] = "empty";
      }
    }
  }
}

/** Restaure les tuiles attendues sous les entites declarees. */
function repairEntityTiles(tiles: ModernTileType[][], entities: readonly ModernLevelCell<ModernEntityType>[]): void {
  for (const entity of entities) {
    if (isInterior(tiles, entity.x, entity.y)) {
      tiles[entity.y][entity.x] = getTileTypeForEntity(entity.type);
    }
  }
}

/** Ouvre un chemin en suivant les connexions et centres de zones du layout. */
function carvePlannedPath(
  layout: LevelLayout,
  tiles: ModernTileType[][],
  from: LevelLayoutPoint,
  to: LevelLayoutPoint
): void {
  const path = createMainPathPoints(layout, from, to);
  carvePathPoints(tiles, path);
}

/** Cree les points du chemin principal, en privilegiant les connexions existantes. */
function createMainPathPoints(layout: LevelLayout, from: LevelLayoutPoint, to: LevelLayoutPoint): readonly LevelLayoutPoint[] {
  const zones = layout.graph.mainPathNodeIds
    .map((nodeId) => layout.zones.find((zone) => zone.nodeId === nodeId))
    .flatMap((zone) => zone ? [zone] : []);
  const path: LevelLayoutPoint[] = [from];

  for (let index = 0; index < zones.length - 1; index += 1) {
    const current = zones[index];
    const next = zones[index + 1];
    const connection = layout.connections.find((item) => item.fromZoneId === current.id && item.toZoneId === next.id)
      ?? layout.connections.find((item) => item.fromZoneId === next.id && item.toZoneId === current.id);
    path.push(current.center);
    if (connection) {
      path.push(...connection.path);
    } else {
      path.push(...createManhattanPath(current.center, next.center));
    }
    path.push(next.center);
  }

  path.push(to);
  return path;
}

/** Creuse les points d'un chemin sans toucher aux bordures externes. */
function carvePathPoints(tiles: ModernTileType[][], path: readonly LevelLayoutPoint[]): void {
  for (let index = 0; index < path.length - 1; index += 1) {
    const segment = createManhattanPath(path[index], path[index + 1]);
    for (const point of segment) {
      clearPathCell(tiles, point);
    }
  }
}

/** Vide une cellule de chemin en retirant seulement les obstacles bloquants. */
function clearPathCell(tiles: ModernTileType[][], point: LevelLayoutPoint): void {
  if (!isInterior(tiles, point.x, point.y)) {
    return;
  }

  if (!THEORETICAL_WALKABLE_TILES.includes(tiles[point.y][point.x])) {
    tiles[point.y][point.x] = "empty";
  }
}

/** Ajoute des diamants dans les zones de collecte plutot qu'en positions arbitraires. */
function addDiamondsInCollectionZones(
  layout: LevelLayout,
  tiles: ModernTileType[][],
  entities: Array<ModernLevelCell<ModernEntityType>>,
  requiredDiamonds: number,
  playerSpawn: LevelLayoutPoint,
  exit: LevelLayoutPoint,
  random: SeededRandom
): number {
  const missing = Math.max(0, requiredDiamonds - entities.filter((entity) => entity.type === "diamond").length);
  if (missing === 0) {
    return 0;
  }

  const zones = getCollectionZones(layout);
  const candidates = shuffled(random, zones.flatMap((zone) => getZonePoints(zone, tiles)))
    .filter((point) => getManhattanDistance(point, playerSpawn) > SPAWN_REPAIR_RADIUS)
    .filter((point) => getManhattanDistance(point, exit) > 1)
    .filter((point) => canPlaceDiamond(tiles, point));
  let added = 0;
  for (const point of candidates) {
    if (added >= missing) {
      break;
    }

    tiles[point.y][point.x] = "diamond";
    entities.push({ x: point.x, y: point.y, type: "diamond" });
    added += 1;
  }

  return added;
}

/** Ouvre l'acces aux diamants requis en suivant le chemin principal puis leurs zones. */
function carvePathsToRequiredDiamonds(
  layout: LevelLayout,
  tiles: ModernTileType[][],
  entities: readonly ModernLevelCell<ModernEntityType>[],
  requiredDiamonds: number,
  playerSpawn: LevelLayoutPoint
): void {
  const diamonds = entities.filter((entity) => entity.type === "diamond").slice(0, requiredDiamonds);
  for (const diamond of diamonds) {
    const zone = getZoneAt(layout, diamond.x, diamond.y);
    const anchor = zone?.center ?? diamond;
    carvePathPoints(tiles, [...createMainPathPoints(layout, playerSpawn, anchor), diamond]);
    tiles[diamond.y][diamond.x] = "diamond";
  }
}

/** Retire seulement les rochers bloquants sur les chemins planifies. */
function reduceBlockingRocksOnPlannedPaths(
  layout: LevelLayout,
  tiles: ModernTileType[][],
  playerSpawn: LevelLayoutPoint,
  exit: LevelLayoutPoint
): number {
  const before = countTileType(tiles, "rock");
  carvePathPoints(tiles, createMainPathPoints(layout, playerSpawn, exit));
  return before - countTileType(tiles, "rock");
}

/** Retourne les zones de collecte compatibles. */
function getCollectionZones(layout: LevelLayout): readonly LevelLayoutZone[] {
  const optionalNodeIds = new Set(layout.graph.optionalBranchNodeIds);
  const zones = layout.zones.filter((zone) =>
    zone.diamondBudget > 0
    || zone.nodeKind === "diamondObjective"
    || zone.nodeKind === "reward"
    || optionalNodeIds.has(zone.nodeId)
  );
  return zones.length > 0 ? zones : layout.zones.filter((zone) => zone.nodeKind !== "start" && zone.nodeKind !== "exit" && zone.nodeKind !== "danger");
}

/** Nettoie les entites incompatibles avec la grille reparee. */
function cleanEntities(
  entities: readonly ModernLevelCell<ModernEntityType>[],
  tiles: readonly (readonly ModernTileType[])[],
  playerSpawn: LevelLayoutPoint,
  exit: LevelLayoutPoint
): Array<ModernLevelCell<ModernEntityType>> {
  const seen = new Set<string>();
  const cleaned: Array<ModernLevelCell<ModernEntityType>> = [];
  for (const entity of entities) {
    const key = `${entity.type}:${entity.x}:${entity.y}`;
    const tile = tiles[entity.y]?.[entity.x];
    if (seen.has(key) || getManhattanDistance(entity, playerSpawn) <= SPAWN_REPAIR_RADIUS || getManhattanDistance(entity, exit) <= 1) {
      continue;
    }
    if (tile === getTileTypeForEntity(entity.type)) {
      seen.add(key);
      cleaned.push(entity);
    }
  }

  return cleaned;
}

/** Reconstruit une grille gameplay complete avec metadonnees actualisees. */
function createGameplayGrid(
  source: GameplayPlacedLevelGrid,
  tiles: readonly (readonly ModernTileType[])[],
  entities: readonly ModernLevelCell<ModernEntityType>[],
  playerSpawn: LevelLayoutPoint,
  exit: LevelLayoutPoint
): GameplayPlacedLevelGrid {
  const diamondCount = entities.filter((entity) => entity.type === "diamond").length;
  const monsterCount = entities.filter((entity) => entity.type === "monster" || entity.type === "specialCreature").length;
  const transformerCount = countTileType(tiles, "transformerBlock");
  const requiredDiamonds = Math.min(source.requiredDiamonds, diamondCount);
  return {
    ...source,
    tiles,
    entities,
    explicitTiles: createExplicitTiles(tiles, source.defaultTile),
    playerSpawn,
    exit,
    requiredDiamonds,
    metadata: createMetadata(diamondCount, requiredDiamonds, monsterCount, transformerCount)
  };
}

/** Cree les metadonnees de placement apres reparation. */
function createMetadata(
  diamondCount: number,
  requiredDiamonds: number,
  monsterCount: number,
  transformerCount: number
): GameplayPlacementMetadata {
  return {
    diamondCount,
    requiredDiamonds,
    monsterCount,
    transformerCount,
    summary: [
      "Gameplay repaired",
      `diamonds=${diamondCount}`,
      `required=${requiredDiamonds}`,
      `monsters=${monsterCount}`,
      `transformers=${transformerCount}`
    ].join(" | ")
  };
}

/** Convertit une entite moderne vers la tuile attendue. */
function getTileTypeForEntity(entityType: ModernEntityType): ModernTileType {
  if (entityType === "customMonster") {
    return "customMonster";
  }

  return entityType;
}

/** Indique si un diamant peut etre place. */
function canPlaceDiamond(tiles: readonly (readonly ModernTileType[])[], point: LevelLayoutPoint): boolean {
  const tile = tiles[point.y]?.[point.x];
  return isInterior(tiles, point.x, point.y) && (tile === "empty" || tile === "earth");
}

/** Retrouve la zone contenant une cellule. */
function getZoneAt(layout: LevelLayout, x: number, y: number): LevelLayoutZone | undefined {
  const zoneId = layout.zoneMap[y]?.[x];
  return zoneId ? layout.zones.find((zone) => zone.id === zoneId) : undefined;
}

/** Retourne les points interieurs d'une zone. */
function getZonePoints(zone: LevelLayoutZone, tiles: readonly (readonly ModernTileType[])[]): readonly LevelLayoutPoint[] {
  const points: LevelLayoutPoint[] = [];
  for (let y = zone.rect.y + 1; y < zone.rect.y + zone.rect.height - 1; y += 1) {
    for (let x = zone.rect.x + 1; x < zone.rect.x + zone.rect.width - 1; x += 1) {
      if (isInterior(tiles, x, y)) {
        points.push({ x, y });
      }
    }
  }

  return points;
}

/** Cree un chemin Manhattan entre deux points. */
function createManhattanPath(from: LevelLayoutPoint, to: LevelLayoutPoint): readonly LevelLayoutPoint[] {
  const points: LevelLayoutPoint[] = [];
  const stepX = from.x <= to.x ? 1 : -1;
  for (let x = from.x; x !== to.x + stepX; x += stepX) {
    points.push({ x, y: from.y });
  }
  const stepY = from.y <= to.y ? 1 : -1;
  for (let y = from.y + stepY; y !== to.y + stepY; y += stepY) {
    points.push({ x: to.x, y });
  }
  return points;
}

/** Convertit la grille complete en tuiles explicites. */
function createExplicitTiles(
  tiles: readonly (readonly ModernTileType[])[],
  defaultTile: ModernTileType
): readonly ModernLevelCell<ModernTileType>[] {
  const explicitTiles: ModernLevelCell<ModernTileType>[] = [];
  for (let y = 0; y < tiles.length; y += 1) {
    for (let x = 0; x < (tiles[y]?.length ?? 0); x += 1) {
      const type = tiles[y][x];
      if (type !== defaultTile) {
        explicitTiles.push({ x, y, type });
      }
    }
  }

  return explicitTiles;
}

/** Clone une grille de tuiles readonly en grille mutable. */
function cloneTileGrid(tiles: readonly (readonly ModernTileType[])[]): ModernTileType[][] {
  return tiles.map((row) => [...row]);
}

/** Melange une liste avec le PRNG seede. */
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

/** Compte un type de tuile donne. */
function countTileType(tiles: readonly (readonly ModernTileType[])[], tileType: ModernTileType): number {
  return tiles.reduce((total, row) => total + row.filter((tile) => tile === tileType).length, 0);
}

/** Contraint un point dans l'interieur de la grille. */
function clampPointToInterior(point: LevelLayoutPoint, tiles: readonly (readonly ModernTileType[])[]): LevelLayoutPoint {
  return {
    x: clampInteger(point.x, 1, Math.max(1, (tiles[0]?.length ?? 2) - 2)),
    y: clampInteger(point.y, 1, Math.max(1, tiles.length - 2))
  };
}

/** Calcule une distance Manhattan. */
function getManhattanDistance(first: LevelLayoutPoint, second: LevelLayoutPoint): number {
  return Math.abs(first.x - second.x) + Math.abs(first.y - second.y);
}

/** Indique si une cellule est dans l'interieur jouable. */
function isInterior(tiles: readonly (readonly ModernTileType[])[], x: number, y: number): boolean {
  return y > 0 && y < tiles.length - 1 && x > 0 && x < (tiles[0]?.length ?? 0) - 1;
}

/** Contraint un entier dans une plage. */
function clampInteger(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}
