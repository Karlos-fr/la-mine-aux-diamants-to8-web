import type { EntityState, LevelDefinition, TileDefinition } from "./types";
import { RUNTIME_TILE } from "./runtime-tiles";
import level01Json from "../assets/levels/level-01.json";
import level02Json from "../assets/levels/level-02.json";
import level03Json from "../assets/levels/level-03.json";
import level04Json from "../assets/levels/level-04.json";
import level05Json from "../assets/levels/level-05.json";
import level06Json from "../assets/levels/level-06.json";
import level07Json from "../assets/levels/level-07.json";
import level08Json from "../assets/levels/level-08.json";
import level09Json from "../assets/levels/level-09.json";
import level10Json from "../assets/levels/level-10.json";
import level11Json from "../assets/levels/level-11.json";
import level12Json from "../assets/levels/level-12.json";
import level13Json from "../assets/levels/level-13.json";
import level14Json from "../assets/levels/level-14.json";
import level15Json from "../assets/levels/level-15.json";
import level16Json from "../assets/levels/level-16.json";

export type ModernTileType = "empty" | "earth" | "rock" | "diamond" | "monster" | "border" | "platform";
export type ModernEntityType = "diamond" | "monster";

export interface ModernGridPoint {
  readonly x: number;
  readonly y: number;
}

export interface ModernLevelCell<TType extends string> extends ModernGridPoint {
  readonly type: TType;
}

export interface ModernLevelJson {
  readonly id: string;
  readonly label: string;
  readonly width: number;
  readonly height: number;
  readonly tileSize: number;
  readonly defaultTile: ModernTileType;
  readonly time: number;
  readonly scoreStep: number;
  readonly requiredDiamonds: number;
  readonly playerSpawn: ModernGridPoint;
  readonly exit: ModernGridPoint;
  readonly tiles: ReadonlyArray<ModernLevelCell<ModernTileType>>;
  readonly entities: ReadonlyArray<ModernLevelCell<ModernEntityType>>;
}

const RAW_LEVEL_SOURCES = [
  level01Json,
  level02Json,
  level03Json,
  level04Json,
  level05Json,
  level06Json,
  level07Json,
  level08Json,
  level09Json,
  level10Json,
  level11Json,
  level12Json,
  level13Json,
  level14Json,
  level15Json,
  level16Json
] as readonly unknown[];

const LEVEL_SOURCES = RAW_LEVEL_SOURCES.map((source, index) => validateModernLevelJson(source, index + 1));

const TILE_IDS_BY_TYPE: Readonly<Record<ModernTileType, number>> = {
  empty: RUNTIME_TILE.empty,
  earth: RUNTIME_TILE.earth,
  rock: RUNTIME_TILE.rock,
  diamond: RUNTIME_TILE.diamond,
  monster: RUNTIME_TILE.monster,
  border: RUNTIME_TILE.border,
  platform: RUNTIME_TILE.platform
};

const ROCK_TILE_IDS = [RUNTIME_TILE.rock];
const WALL_TILE_IDS = [RUNTIME_TILE.earth, RUNTIME_TILE.platform];
const DIAMOND_TILE_IDS = [RUNTIME_TILE.diamond];
const EXIT_TILE_IDS = [RUNTIME_TILE.border];
const MONSTER_TILE_IDS = [RUNTIME_TILE.monster];
const EMPTY_TILE_IDS = [RUNTIME_TILE.empty];

export const LEVEL_COUNT = LEVEL_SOURCES.length;

export function getModernLevelSource(levelNumber: number): ModernLevelJson | undefined {
  return LEVEL_SOURCES[levelNumber - 1];
}

export function loadLevelDefinition(levelNumber: number): LevelDefinition {
  const levelSource = getModernLevelSource(levelNumber);
  if (!levelSource) {
    throw new Error(`Niveau non pris en charge: ${levelNumber}`);
  }

  return buildLevelDefinition(levelSource, levelNumber);
}

export function buildLevelDefinition(level: ModernLevelJson, levelNumber: number): LevelDefinition {
  const tileSize = level.tileSize;
  const tiles = buildTilesFromModernLevel(level);
  const monsterEntities: EntityState[] = findEntityPositions(level, "monster").map((position, index) => ({
    id: `monster-${index}`,
    kind: "monster",
    gridX: position.x,
    gridY: position.y,
    x: position.x * tileSize,
    y: position.y * tileSize,
    width: tileSize,
    height: tileSize,
    spriteFrameId: "tile:2",
    active: true
  }));
  const diamondEntities: EntityState[] = findEntityPositions(level, "diamond").map((diamond, index) => ({
    id: `diamond-${index}`,
    kind: "diamond",
    gridX: diamond.x,
    gridY: diamond.y,
    x: diamond.x * tileSize,
    y: diamond.y * tileSize,
    width: tileSize,
    height: tileSize,
    spriteFrameId: "tile:3",
    active: true
  }));

  return {
    id: level.id,
    name: level.label,
    width: level.width,
    height: level.height,
    tileSize,
    tiles,
    tileDefinitions: buildTileDefinitionsFromRows(tiles, level.scoreStep),
    initialEntities: [
      {
        id: "player",
        kind: "player",
        gridX: level.playerSpawn.x,
        gridY: level.playerSpawn.y,
        x: level.playerSpawn.x * tileSize,
        y: level.playerSpawn.y * tileSize,
        width: tileSize,
        height: tileSize,
        spriteFrameId: "player-idle",
        active: true
      },
      ...monsterEntities,
      ...diamondEntities
    ],
    playerStart: {
      x: level.playerSpawn.x,
      y: level.playerSpawn.y
    },
    exit: {
      x: level.exit.x,
      y: level.exit.y
    },
    meta: {
      timeLimit: level.time,
      gallery: levelNumber,
      requiredDiamonds: level.requiredDiamonds,
      scoreStep: level.scoreStep,
      nextLevelId: levelNumber < LEVEL_SOURCES.length ? LEVEL_SOURCES[levelNumber].id : undefined
    }
  };
}

function buildTileDefinitionsFromRows(tiles: readonly number[], scoreStep: number): Record<number, TileDefinition> {
  const definitions: Record<number, TileDefinition> = {};
  const uniqueTileIds = [...new Set(tiles)];
  uniqueTileIds.forEach((tileId) => {
    definitions[tileId] = createTileDefinition(tileId, scoreStep);
  });

  return definitions;
}

function createTileDefinition(tileId: number, scoreStep: number): TileDefinition {
  if (ROCK_TILE_IDS.includes(tileId)) {
    return {
      id: tileId,
      name: "rock",
      collision: "solid",
      tileFrameId: `tile:${tileId}`
    };
  }

  if (WALL_TILE_IDS.includes(tileId)) {
    return {
      id: tileId,
      name: "wall",
      collision: "solid",
      tileFrameId: `tile:${tileId}`
    };
  }

  if (DIAMOND_TILE_IDS.includes(tileId)) {
    return {
      id: tileId,
      name: "diamond",
      collision: "empty",
      collectible: {
        score: scoreStep,
        counter: "diamonds"
      },
      tileFrameId: `tile:${tileId}`
    };
  }

  if (EXIT_TILE_IDS.includes(tileId)) {
    return {
      id: tileId,
      name: "exit",
      collision: "exit",
      tileFrameId: `tile:${tileId}`
    };
  }

  if (MONSTER_TILE_IDS.includes(tileId)) {
    return {
      id: tileId,
      name: "monster",
      collision: "hazard",
      tileFrameId: `tile:${tileId}`
    };
  }

  if (EMPTY_TILE_IDS.includes(tileId)) {
    return {
      id: tileId,
      name: "empty",
      collision: "empty",
      tileFrameId: `tile:${tileId}`
    };
  }

  return {
    id: tileId,
    name: "tile",
    collision: "empty",
    tileFrameId: `tile:${tileId}`
  };
}

function buildTilesFromModernLevel(level: ModernLevelJson): number[] {
  const defaultTileId = TILE_IDS_BY_TYPE[level.defaultTile];
  const tiles = Array.from({ length: level.width * level.height }, () => defaultTileId);

  for (const tile of level.tiles) {
    tiles[tile.y * level.width + tile.x] = TILE_IDS_BY_TYPE[tile.type];
  }

  return tiles;
}

function findEntityPositions(level: ModernLevelJson, type: ModernEntityType): ModernGridPoint[] {
  return level.entities
    .filter((entity) => entity.type === type)
    .map((entity) => ({ x: entity.x, y: entity.y }));
}

function validateModernLevelJson(source: unknown, levelNumber: number): ModernLevelJson {
  const level = expectRecord(source, `level ${levelNumber}`);
  const width = expectPositiveInteger(level.width, levelNumber, "width");
  const height = expectPositiveInteger(level.height, levelNumber, "height");
  const tileSize = expectPositiveInteger(level.tileSize, levelNumber, "tileSize");

  return {
    id: expectString(level.id, levelNumber, "id"),
    label: expectString(level.label, levelNumber, "label"),
    width,
    height,
    tileSize,
    defaultTile: expectModernTileType(level.defaultTile, levelNumber, "defaultTile"),
    time: expectNonNegativeInteger(level.time, levelNumber, "time"),
    scoreStep: expectNonNegativeInteger(level.scoreStep, levelNumber, "scoreStep"),
    requiredDiamonds: expectNonNegativeInteger(level.requiredDiamonds, levelNumber, "requiredDiamonds"),
    playerSpawn: expectGridPoint(level.playerSpawn, levelNumber, "playerSpawn", width, height),
    exit: expectGridPoint(level.exit, levelNumber, "exit", width, height),
    tiles: expectLevelCells(level.tiles, levelNumber, "tiles", width, height, expectModernTileType),
    entities: expectLevelCells(level.entities, levelNumber, "entities", width, height, expectModernEntityType)
  };
}

function expectLevelCells<TType extends string>(
  value: unknown,
  levelNumber: number,
  field: string,
  width: number,
  height: number,
  expectType: (value: unknown, levelNumber: number, field: string) => TType
): Array<ModernLevelCell<TType>> {
  if (!Array.isArray(value)) {
    throw new Error(`Niveau ${levelNumber}: ${field} doit etre un tableau.`);
  }

  return value.map((cell, index) => {
    const record = expectRecord(cell, `level ${levelNumber}.${field}[${index}]`);
    return {
      ...expectGridPoint(record, levelNumber, `${field}[${index}]`, width, height),
      type: expectType(record.type, levelNumber, `${field}[${index}].type`)
    };
  });
}

function expectGridPoint(
  value: unknown,
  levelNumber: number,
  field: string,
  width: number,
  height: number
): ModernGridPoint {
  const point = expectRecord(value, `level ${levelNumber}.${field}`);
  const x = expectNonNegativeInteger(point.x, levelNumber, `${field}.x`);
  const y = expectNonNegativeInteger(point.y, levelNumber, `${field}.y`);
  if (x >= width || y >= height) {
    throw new Error(`Niveau ${levelNumber}: ${field} (${x}, ${y}) hors grille ${width}x${height}.`);
  }

  return { x, y };
}

function expectModernTileType(value: unknown, levelNumber: number, field: string): ModernTileType {
  if (
    value === "empty" ||
    value === "earth" ||
    value === "rock" ||
    value === "diamond" ||
    value === "monster" ||
    value === "border" ||
    value === "platform"
  ) {
    return value;
  }

  throw new Error(`Niveau ${levelNumber}: ${field} contient une tuile moderne inconnue: ${String(value)}.`);
}

function expectModernEntityType(value: unknown, levelNumber: number, field: string): ModernEntityType {
  if (value === "diamond" || value === "monster") {
    return value;
  }

  throw new Error(`Niveau ${levelNumber}: ${field} contient une entite moderne inconnue: ${String(value)}.`);
}

function expectString(value: unknown, levelNumber: number, field: string): string {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  throw new Error(`Niveau ${levelNumber}: ${field} doit etre une chaine non vide.`);
}

function expectPositiveInteger(value: unknown, levelNumber: number, field: string): number {
  if (Number.isInteger(value) && value > 0) {
    return value;
  }

  throw new Error(`Niveau ${levelNumber}: ${field} doit etre un entier positif.`);
}

function expectNonNegativeInteger(value: unknown, levelNumber: number, field: string): number {
  if (Number.isInteger(value) && value >= 0) {
    return value;
  }

  throw new Error(`Niveau ${levelNumber}: ${field} doit etre un entier positif ou nul.`);
}

function expectRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value;
  }

  throw new Error(`${label} doit etre un objet.`);
}
