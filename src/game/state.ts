import type { EntityState, GameState, LevelDefinition, MonsterRuntimeState, TileDefinition } from "./types";
import { RUNTIME_GRID_BASE_ADDRESS, RUNTIME_GRID_STRIDE, RUNTIME_TILE } from "./runtime-tiles";
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

type ModernTileType = "empty" | "earth" | "rock" | "diamond" | "monster" | "border" | "platform" | "exit";

interface ModernLevelJson {
  readonly id: string;
  readonly label: string;
  readonly width: number;
  readonly height: number;
  readonly tileSize: number;
  readonly defaultTile: ModernTileType;
  readonly time: number;
  readonly scoreStep: number;
  readonly requiredDiamonds: number;
  readonly playerSpawn: {
    readonly x: number;
    readonly y: number;
  };
  readonly exit: {
    readonly x: number;
    readonly y: number;
  };
  readonly tiles: ReadonlyArray<{
    readonly x: number;
    readonly y: number;
    readonly type: ModernTileType;
  }>;
  readonly entities: ReadonlyArray<{
    readonly x: number;
    readonly y: number;
    readonly type: ModernTileType;
  }>;
}

const LEVEL_SOURCES = [
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
] as ReadonlyArray<ModernLevelJson>;

const TILE_IDS_BY_TYPE: Readonly<Record<ModernTileType, number>> = {
  empty: RUNTIME_TILE.empty,
  earth: RUNTIME_TILE.earth,
  rock: RUNTIME_TILE.rock,
  diamond: RUNTIME_TILE.diamond,
  monster: RUNTIME_TILE.monster,
  border: RUNTIME_TILE.border,
  platform: RUNTIME_TILE.platform,
  exit: RUNTIME_TILE.border
};

const ROCK_TILE_IDS = [RUNTIME_TILE.rock];
const WALL_TILE_IDS = [RUNTIME_TILE.earth, RUNTIME_TILE.platform];
const DIAMOND_TILE_IDS = [RUNTIME_TILE.diamond];
const EXIT_TILE_IDS = [RUNTIME_TILE.border];
const MONSTER_TILE_IDS = [RUNTIME_TILE.monster];
const EMPTY_TILE_IDS = [RUNTIME_TILE.empty];

export const LEVEL1_DEFINITION: LevelDefinition = buildLevelDefinition(LEVEL_SOURCES[0], 1);

export function createGameLevelState(levelNumber = 1): GameState {
  const levelSource = LEVEL_SOURCES[levelNumber - 1];
  if (!levelSource) {
    throw new Error(`Niveau non pris en charge: ${levelNumber}`);
  }

  const levelDefinition = buildLevelDefinition(levelSource, levelNumber);
  const entities: EntityState[] = levelDefinition.initialEntities.map((entity) => ({ ...entity }));
  const player = entities.find((entity) => entity.kind === "player");
  const monsters = createMonsterRuntimeStates(entities);
  if (!player) {
    throw new Error(`Le niveau ${levelNumber} doit contenir une entite joueur.`);
  }

  return {
    sceneId: "gameplay",
    level: levelDefinition,
    entities,
    monsters,
    fallingObjects: [],
    player,
    hud: {
      score: 0,
      time: levelDefinition.meta.timeLimit,
      record: 0,
      gallery: levelDefinition.meta.gallery,
      diamonds: levelDefinition.meta.requiredDiamonds
    },
    lives: 3,
    exitOpen: levelDefinition.meta.requiredDiamonds === 0,
    levelComplete: false,
    gameOver: false
  };
}

function buildLevelDefinition(level: ModernLevelJson, levelNumber: number): LevelDefinition {
  const tileSize = level.tileSize;
  const tiles = buildTilesFromModernLevel(level);
  const monsterEntities = findEntityPositions(level, "monster").map((position, index) => ({
    id: `monster-${index}`,
    kind: "monster" as const,
    gridX: position.x,
    gridY: position.y,
    x: position.x * tileSize,
    y: position.y * tileSize,
    width: tileSize,
    height: tileSize,
    spriteFrameId: "tile:2",
    active: true
  }));
  const diamondEntities = findEntityPositions(level, "diamond").map((diamond, index) => ({
    id: `diamond-${index}`,
    kind: "diamond" as const,
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

function createMonsterRuntimeStates(entities: readonly EntityState[]): MonsterRuntimeState[] {
  return entities
    .filter((entity) => entity.kind === "monster")
    .map((entity) => ({
      id: `runtime-${entity.id}`,
      entityId: entity.id,
      runtimePointer: RUNTIME_GRID_BASE_ADDRESS + entity.gridY * RUNTIME_GRID_STRIDE + entity.gridX,
      direction: 2 as const,
      gridX: entity.gridX,
      gridY: entity.gridY,
      animationKey: "monsterBlink",
      movement: null
    }));
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

export const createGameShellState = createGameLevelState;

function buildTilesFromModernLevel(level: ModernLevelJson): number[] {
  const defaultTileId = TILE_IDS_BY_TYPE[level.defaultTile];
  const tiles = Array.from({ length: level.width * level.height }, () => defaultTileId);

  for (const tile of level.tiles) {
    tiles[tile.y * level.width + tile.x] = TILE_IDS_BY_TYPE[tile.type];
  }

  return tiles;
}

function findEntityPositions(level: ModernLevelJson, type: ModernTileType): Array<{ x: number; y: number }> {
  return level.entities
    .filter((entity) => entity.type === type)
    .map((entity) => ({ x: entity.x, y: entity.y }));
}
