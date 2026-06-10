/**
 * Role: Place les elements gameplay finaux en respectant le graphe et le layout generes.
 * Scope: Choisit spawn, sortie, diamants requis, monstres et transformateurs lisibles.
 * ISO: La logique est moderne et structurelle; elle ne simule pas les routines ASM du TO8.
 * Notes: Les reparations de connectivite restent reservees a la phase de validation suivante.
 */

import type { ModernEntityType, ModernLevelCell, ModernTileType } from "../game/level-loader";
import type { LevelGenerationDifficulty } from "./level-generation-options";
import type { DressedLevelGrid, LevelDressingZoneRole } from "./level-dresser";
import type { LevelLayout, LevelLayoutPoint, LevelLayoutRect, LevelLayoutZone } from "./level-layout";
import type { SeededRandom } from "./seeded-random";

/** Grille apres placement gameplay final. */
export interface GameplayPlacedLevelGrid {
  /** Largeur en cellules. */
  readonly width: number;
  /** Hauteur en cellules. */
  readonly height: number;
  /** Tuile par defaut conservee depuis la rasterisation. */
  readonly defaultTile: ModernTileType;
  /** Grille complete apres placement gameplay. */
  readonly tiles: readonly (readonly ModernTileType[])[];
  /** Entites modernes declarees dans le niveau. */
  readonly entities: readonly ModernLevelCell<ModernEntityType>[];
  /** Tuiles explicites differentes de `defaultTile`. */
  readonly explicitTiles: readonly ModernLevelCell<ModernTileType>[];
  /** Position initiale du joueur. */
  readonly playerSpawn: LevelLayoutPoint;
  /** Position de la sortie. */
  readonly exit: LevelLayoutPoint;
  /** Objectif diamant coherent avec le placement. */
  readonly requiredDiamonds: number;
  /** Metadonnees compactes pour debug et futur scoring. */
  readonly metadata: GameplayPlacementMetadata;
}

/** Metadonnees du placement gameplay. */
export interface GameplayPlacementMetadata {
  /** Diamants presents apres placement. */
  readonly diamondCount: number;
  /** Diamants requis pour finir. */
  readonly requiredDiamonds: number;
  /** Monstres places dans les zones de danger. */
  readonly monsterCount: number;
  /** Transformateurs conserves en zones compatibles. */
  readonly transformerCount: number;
  /** Resume lisible pour logs et debug. */
  readonly summary: string;
}

/** Entree du placement gameplay. */
export interface GameplayPlacementInput {
  /** Layout source contenant graphe, zones et carte de zones. */
  readonly layout: LevelLayout;
  /** Grille habillee par la phase 6. */
  readonly dressedGrid: DressedLevelGrid;
  /** Difficulte demandee pour doser objectif et danger. */
  readonly difficulty: LevelGenerationDifficulty;
  /** PRNG seede de la tentative courante. */
  readonly random: SeededRandom;
}

/** Compteurs internes du placement gameplay. */
interface GameplayCounters {
  /** Monstres ajoutes. */
  monsterCount: number;
  /** Transformateurs conserves. */
  transformerCount: number;
}

/** Distance minimale entre spawn et danger initial. */
const MIN_SPAWN_DANGER_DISTANCE = 6;
/** Rayon nettoye autour du spawn pour eviter les departs injustes. */
const SPAWN_SAFE_RADIUS = 2;

/** Place les elements gameplay finaux sur une grille habillee. */
export function placeGameplayElements(input: GameplayPlacementInput): GameplayPlacedLevelGrid {
  const tiles = cloneTileGrid(input.dressedGrid.tiles);
  const random = input.random.fork("gameplay-placement");
  const startZone = findMainPathZone(input.layout, 0) ?? input.layout.zones[0];
  const exitZone = findMainPathZone(input.layout, input.layout.graph.mainPathNodeIds.length - 1) ?? input.layout.zones[input.layout.zones.length - 1];
  const playerSpawn = chooseZonePoint(startZone, tiles, random.fork("spawn"));
  clearSafeSpawnArea(tiles, playerSpawn);
  const exit = chooseExitPoint(exitZone, tiles, playerSpawn, random.fork("exit"));
  const counters: GameplayCounters = { monsterCount: 0, transformerCount: 0 };
  let entities = cleanDressedEntities(input.dressedGrid.entities, tiles, playerSpawn, exit);

  tiles[exit.y][exit.x] = "border";
  removeUnsafeDiamondsNearSpawn(tiles, entities, playerSpawn);
  entities = ensureStructuredDiamonds(input.layout, tiles, entities, playerSpawn, exit, random.fork("diamonds"));
  normalizeTransformers(input.layout, input.dressedGrid.zoneRoles, tiles, counters);
  entities = placeDangerMonsters(input.layout, tiles, entities, playerSpawn, exit, input.difficulty, counters, random.fork("monsters"));
  const diamondCount = entities.filter((entity) => entity.type === "diamond").length;
  const requiredDiamonds = getRequiredDiamondCount(diamondCount, input.difficulty);

  return {
    width: input.dressedGrid.width,
    height: input.dressedGrid.height,
    defaultTile: input.dressedGrid.defaultTile,
    tiles,
    entities,
    explicitTiles: createExplicitTiles(tiles, input.dressedGrid.defaultTile),
    playerSpawn,
    exit,
    requiredDiamonds,
    metadata: createGameplayPlacementMetadata(diamondCount, requiredDiamonds, counters)
  };
}

/** Retrouve la zone associee a un index du chemin principal. */
function findMainPathZone(layout: LevelLayout, mainPathIndex: number): LevelLayoutZone | undefined {
  const nodeId = layout.graph.mainPathNodeIds[mainPathIndex];
  return layout.zones.find((zone) => zone.nodeId === nodeId);
}

/** Choisit un point jouable dans une zone, proche du centre. */
function chooseZonePoint(zone: LevelLayoutZone, tiles: readonly (readonly ModernTileType[])[], random: SeededRandom): LevelLayoutPoint {
  const candidates = getZonePoints(zone, tiles)
    .filter((point) => canStandOn(tiles, point.x, point.y))
    .sort((first, second) => getManhattanDistance(first, zone.center) - getManhattanDistance(second, zone.center));
  if (candidates.length === 0) {
    return clampPointToInterior(zone.center, tiles);
  }

  const bestCount = Math.max(1, Math.min(4, candidates.length));
  return random.pick(candidates.slice(0, bestCount));
}

/** Choisit la sortie dans sa zone, eloignee du spawn. */
function chooseExitPoint(
  zone: LevelLayoutZone,
  tiles: readonly (readonly ModernTileType[])[],
  playerSpawn: LevelLayoutPoint,
  random: SeededRandom
): LevelLayoutPoint {
  const candidates = getZonePoints(zone, tiles)
    .filter((point) => isInterior(tiles, point.x, point.y))
    .sort((first, second) => getManhattanDistance(second, playerSpawn) - getManhattanDistance(first, playerSpawn));
  if (candidates.length === 0) {
    return clampPointToInterior(zone.center, tiles);
  }

  const bestCount = Math.max(1, Math.min(5, candidates.length));
  return random.pick(candidates.slice(0, bestCount));
}

/** Nettoie la zone de depart pour eviter les dangers gratuits. */
function clearSafeSpawnArea(tiles: ModernTileType[][], playerSpawn: LevelLayoutPoint): void {
  for (let y = playerSpawn.y - SPAWN_SAFE_RADIUS; y <= playerSpawn.y + SPAWN_SAFE_RADIUS; y += 1) {
    for (let x = playerSpawn.x - SPAWN_SAFE_RADIUS; x <= playerSpawn.x + SPAWN_SAFE_RADIUS; x += 1) {
      if (isInterior(tiles, x, y) && getManhattanDistance(playerSpawn, { x, y }) <= SPAWN_SAFE_RADIUS) {
        tiles[y][x] = "empty";
      }
    }
  }
}

/** Nettoie les entites deja presentes sur spawn, sortie ou tuiles invalides. */
function cleanDressedEntities(
  entities: readonly ModernLevelCell<ModernEntityType>[],
  tiles: readonly (readonly ModernTileType[])[],
  playerSpawn: LevelLayoutPoint,
  exit: LevelLayoutPoint
): Array<ModernLevelCell<ModernEntityType>> {
  return entities.filter((entity) => {
    if (getManhattanDistance(entity, playerSpawn) <= SPAWN_SAFE_RADIUS || getManhattanDistance(entity, exit) <= 1) {
      return false;
    }

    return tiles[entity.y]?.[entity.x] === getTileTypeForEntity(entity.type);
  });
}

/** Supprime les diamants trop proches du spawn apres nettoyage de la zone. */
function removeUnsafeDiamondsNearSpawn(
  tiles: ModernTileType[][],
  entities: Array<ModernLevelCell<ModernEntityType>>,
  playerSpawn: LevelLayoutPoint
): void {
  for (let index = entities.length - 1; index >= 0; index -= 1) {
    const entity = entities[index];
    if (entity.type === "diamond" && getManhattanDistance(entity, playerSpawn) <= SPAWN_SAFE_RADIUS) {
      tiles[entity.y][entity.x] = "empty";
      entities.splice(index, 1);
    }
  }
}

/** Garantit que les diamants servent le chemin principal et les branches optionnelles. */
function ensureStructuredDiamonds(
  layout: LevelLayout,
  tiles: ModernTileType[][],
  entities: Array<ModernLevelCell<ModernEntityType>>,
  playerSpawn: LevelLayoutPoint,
  exit: LevelLayoutPoint,
  random: SeededRandom
): Array<ModernLevelCell<ModernEntityType>> {
  const diamondZones = getDiamondPlacementZones(layout);
  for (const zone of diamondZones) {
    const existingInZone = entities.filter((entity) => entity.type === "diamond" && isPointInRect(entity, zone.rect)).length;
    const targetInZone = Math.max(1, zone.diamondBudget);
    if (existingInZone >= targetInZone) {
      continue;
    }

    const candidates = shuffled(random.fork(zone.id), getZonePoints(zone, tiles)
      .filter((point) => !isReservedPoint(point, playerSpawn, exit))
      .filter((point) => canPlaceEntityTile(tiles, point.x, point.y)));
    for (const candidate of candidates) {
      if (entities.filter((entity) => entity.type === "diamond" && isPointInRect(entity, zone.rect)).length >= targetInZone) {
        break;
      }
      tiles[candidate.y][candidate.x] = "diamond";
      entities.push({ x: candidate.x, y: candidate.y, type: "diamond" });
    }
  }

  return dedupeEntities(entities);
}

/** Retourne les zones qui doivent porter l'objectif diamant. */
function getDiamondPlacementZones(layout: LevelLayout): readonly LevelLayoutZone[] {
  const mainPathNodeIds = new Set(layout.graph.mainPathNodeIds);
  const optionalNodeIds = new Set(layout.graph.optionalBranchNodeIds);
  return layout.zones.filter((zone) => {
    if (zone.nodeKind === "start" || zone.nodeKind === "exit" || zone.nodeKind === "danger") {
      return false;
    }
    return zone.diamondBudget > 0
      || zone.nodeKind === "diamondObjective"
      || zone.nodeKind === "reward"
      || optionalNodeIds.has(zone.nodeId)
      || (mainPathNodeIds.has(zone.nodeId) && zone.nodeKind === "room" && zone.intensity !== "low");
  });
}

/** Nettoie les transformateurs hors zones compatibles, puis compte ceux conserves. */
function normalizeTransformers(
  layout: LevelLayout,
  zoneRoles: Readonly<Record<string, LevelDressingZoneRole>>,
  tiles: ModernTileType[][],
  counters: GameplayCounters
): void {
  for (let y = 1; y < tiles.length - 1; y += 1) {
    for (let x = 1; x < (tiles[y]?.length ?? 0) - 1; x += 1) {
      if (tiles[y][x] !== "transformerBlock") {
        continue;
      }

      const zone = getZoneAt(layout, x, y);
      const role = zone ? zoneRoles[zone.id] : undefined;
      if (!zone || (role !== "gravity" && role !== "danger" && zone.nodeKind !== "implicitLock")) {
        tiles[y][x] = "empty";
      } else {
        counters.transformerCount += 1;
      }
    }
  }
}

/** Place les monstres uniquement dans les zones de danger prevues par le graphe. */
function placeDangerMonsters(
  layout: LevelLayout,
  tiles: ModernTileType[][],
  entities: Array<ModernLevelCell<ModernEntityType>>,
  playerSpawn: LevelLayoutPoint,
  exit: LevelLayoutPoint,
  difficulty: LevelGenerationDifficulty,
  counters: GameplayCounters,
  random: SeededRandom
): Array<ModernLevelCell<ModernEntityType>> {
  const dangerZones = layout.zones.filter((zone) => zone.dangerBudget > 0 || zone.nodeKind === "danger");
  for (const zone of dangerZones) {
    const target = getMonsterTargetForZone(zone, difficulty);
    const candidates = shuffled(random.fork(zone.id), getZonePoints(zone, tiles)
      .filter((point) => getManhattanDistance(point, playerSpawn) >= MIN_SPAWN_DANGER_DISTANCE)
      .filter((point) => !isReservedPoint(point, playerSpawn, exit))
      .filter((point) => canPlaceMonsterTile(tiles, point.x, point.y)));
    let placedInZone = 0;
    for (const candidate of candidates) {
      if (placedInZone >= target) {
        break;
      }

      tiles[candidate.y][candidate.x] = "monster";
      entities.push({ x: candidate.x, y: candidate.y, type: "monster" });
      placedInZone += 1;
      counters.monsterCount += 1;
    }
  }

  return dedupeEntities(entities);
}

/** Calcule le nombre de monstres d'une zone de danger. */
function getMonsterTargetForZone(zone: LevelLayoutZone, difficulty: LevelGenerationDifficulty): number {
  const difficultyBonus = difficulty === "easy" ? -1 : difficulty === "hard" ? 1 : difficulty === "expert" ? 2 : 0;
  const intensityBonus = zone.intensity === "high" ? 1 : 0;
  return clampInteger(zone.dangerBudget + difficultyBonus + intensityBonus, difficulty === "easy" ? 0 : 1, 4);
}

/** Objectif diamant final: assez exigeant, mais jamais arbitraire au-dessus des diamants places. */
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

/** Cree les metadonnees publiques du placement gameplay. */
function createGameplayPlacementMetadata(
  diamondCount: number,
  requiredDiamonds: number,
  counters: GameplayCounters
): GameplayPlacementMetadata {
  return {
    diamondCount,
    requiredDiamonds,
    monsterCount: counters.monsterCount,
    transformerCount: counters.transformerCount,
    summary: [
      "Gameplay",
      `diamonds=${diamondCount}`,
      `required=${requiredDiamonds}`,
      `monsters=${counters.monsterCount}`,
      `transformers=${counters.transformerCount}`
    ].join(" | ")
  };
}

/** Retourne les points interieurs d'une zone. */
function getZonePoints(zone: LevelLayoutZone, tiles: readonly (readonly ModernTileType[])[]): readonly LevelLayoutPoint[] {
  const points: LevelLayoutPoint[] = [];
  forEachCellInRect(shrinkRect(zone.rect, 1), (x, y) => {
    if (isInterior(tiles, x, y)) {
      points.push({ x, y });
    }
  });

  return points;
}

/** Retrouve la zone qui contient une cellule. */
function getZoneAt(layout: LevelLayout, x: number, y: number): LevelLayoutZone | undefined {
  const zoneId = layout.zoneMap[y]?.[x];
  return zoneId ? layout.zones.find((zone) => zone.id === zoneId) : undefined;
}

/** Indique si le joueur peut etre pose sur cette cellule. */
function canStandOn(tiles: readonly (readonly ModernTileType[])[], x: number, y: number): boolean {
  const tile = tiles[y]?.[x];
  return tile === "empty" || tile === "earth" || tile === "diamond";
}

/** Indique si une entite collectable peut etre posee. */
function canPlaceEntityTile(tiles: readonly (readonly ModernTileType[])[], x: number, y: number): boolean {
  const tile = tiles[y]?.[x];
  return isInterior(tiles, x, y) && (tile === "empty" || tile === "earth");
}

/** Indique si un monstre peut etre pose sur cette cellule. */
function canPlaceMonsterTile(tiles: readonly (readonly ModernTileType[])[], x: number, y: number): boolean {
  return tiles[y]?.[x] === "empty" && countWalkableNeighbors(tiles, x, y) >= 2;
}

/** Compte les voisins de circulation immediate. */
function countWalkableNeighbors(tiles: readonly (readonly ModernTileType[])[], x: number, y: number): number {
  return [
    tiles[y - 1]?.[x],
    tiles[y + 1]?.[x],
    tiles[y]?.[x - 1],
    tiles[y]?.[x + 1]
  ].filter((tile) => tile === "empty" || tile === "earth").length;
}

/** Indique si un point est reserve par spawn ou sortie. */
function isReservedPoint(point: LevelLayoutPoint, playerSpawn: LevelLayoutPoint, exit: LevelLayoutPoint): boolean {
  return getManhattanDistance(point, playerSpawn) <= SPAWN_SAFE_RADIUS || getManhattanDistance(point, exit) <= 1;
}

/** Convertit une entite moderne vers la tuile qui doit la porter au depart. */
function getTileTypeForEntity(entityType: ModernEntityType): ModernTileType {
  if (entityType === "customMonster") {
    return "customMonster";
  }

  return entityType;
}

/** Dedoublonne les entites par position et type. */
function dedupeEntities(
  entities: readonly ModernLevelCell<ModernEntityType>[]
): Array<ModernLevelCell<ModernEntityType>> {
  const seen = new Set<string>();
  const deduped: Array<ModernLevelCell<ModernEntityType>> = [];
  for (const entity of entities) {
    const key = `${entity.type}:${entity.x}:${entity.y}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(entity);
    }
  }

  return deduped;
}

/** Convertit la grille complete en cellules explicites. */
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

/** Itere sur les cellules d'un rectangle. */
function forEachCellInRect(rect: LevelLayoutRect, callback: (x: number, y: number) => void): void {
  for (let y = rect.y; y < rect.y + rect.height; y += 1) {
    for (let x = rect.x; x < rect.x + rect.width; x += 1) {
      callback(x, y);
    }
  }
}

/** Retrecit un rectangle pour eviter ses bords. */
function shrinkRect(rect: LevelLayoutRect, margin: number): LevelLayoutRect {
  return {
    x: rect.x + margin,
    y: rect.y + margin,
    width: Math.max(1, rect.width - margin * 2),
    height: Math.max(1, rect.height - margin * 2)
  };
}

/** Contraint un point au rectangle interieur de la grille. */
function clampPointToInterior(point: LevelLayoutPoint, tiles: readonly (readonly ModernTileType[])[]): LevelLayoutPoint {
  return {
    x: clampInteger(point.x, 1, Math.max(1, (tiles[0]?.length ?? 2) - 2)),
    y: clampInteger(point.y, 1, Math.max(1, tiles.length - 2))
  };
}

/** Indique si un point est dans un rectangle. */
function isPointInRect(point: LevelLayoutPoint, rect: LevelLayoutRect): boolean {
  return point.x >= rect.x
    && point.y >= rect.y
    && point.x < rect.x + rect.width
    && point.y < rect.y + rect.height;
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

/** Calcule une distance Manhattan. */
function getManhattanDistance(first: LevelLayoutPoint, second: LevelLayoutPoint): number {
  return Math.abs(first.x - second.x) + Math.abs(first.y - second.y);
}

/** Indique si un point est dans la zone interieure jouable. */
function isInterior(tiles: readonly (readonly ModernTileType[])[], x: number, y: number): boolean {
  return y > 0 && y < tiles.length - 1 && x > 0 && x < (tiles[0]?.length ?? 0) - 1;
}

/** Contraint un entier dans une plage. */
function clampInteger(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}
