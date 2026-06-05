import type { EntityState, GameState, LevelDefinition, MonsterRuntimeState, TileDefinition } from "./types";
import level01Json from "../assets/levels/level-01.json";

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

const LEVEL1_SOURCE = level01Json as ModernLevelJson;
const BOARD_TILE_SIZE = LEVEL1_SOURCE.tileSize;
const RUNTIME_GRID_BASE_ADDRESS = 0xdbb7;
const RUNTIME_GRID_STRIDE = 40;
const TILE_IDS_BY_TYPE: Readonly<Record<ModernTileType, number>> = {
  empty: 0x05,
  earth: 0x01,
  rock: 0x00,
  diamond: 0x03,
  monster: 0x02,
  border: 0x04,
  platform: 0x06,
  exit: 0x04
};

const ROCK_TILE_IDS = [0x00];
const WALL_TILE_IDS = [0x01, 0x06];
const DIAMOND_TILE_IDS = [0x03];
const EXIT_TILE_IDS = [0x04];
const MONSTER_TILE_IDS = [0x02];
const EMPTY_TILE_IDS = [0x05];

const LEVEL1_TILES = buildTilesFromModernLevel(LEVEL1_SOURCE);
const LEVEL1_SCORE_STEP = LEVEL1_SOURCE.scoreStep;

const LEVEL1_TILE_DEFINITIONS: Record<number, TileDefinition> = buildTileDefinitionsFromRows(LEVEL1_TILES);

const LEVEL1_MONSTER_ENTITIES = findEntityPositions("monster").map((position, index) => ({
  id: `monster-${index}`,
  kind: "monster" as const,
  gridX: position.x,
  gridY: position.y,
  x: position.x * BOARD_TILE_SIZE,
  y: position.y * BOARD_TILE_SIZE,
  width: BOARD_TILE_SIZE,
  height: BOARD_TILE_SIZE,
  spriteFrameId: "tile:2",
  active: true
}));

const LEVEL1_DIAMOND_ENTITIES = findEntityPositions("diamond").map(
  (diamond, index) => ({
    id: `diamond-${index}`,
    kind: "diamond" as const,
    gridX: diamond.x,
    gridY: diamond.y,
    x: diamond.x * BOARD_TILE_SIZE,
    y: diamond.y * BOARD_TILE_SIZE,
    width: BOARD_TILE_SIZE,
    height: BOARD_TILE_SIZE,
    spriteFrameId: "tile:3",
    active: true
  })
);

export const LEVEL1_DEFINITION: LevelDefinition = {
  id: LEVEL1_SOURCE.id,
  name: LEVEL1_SOURCE.label,
  width: LEVEL1_SOURCE.width,
  height: LEVEL1_SOURCE.height,
  tileSize: LEVEL1_SOURCE.tileSize,
  tiles: LEVEL1_TILES,
  tileDefinitions: LEVEL1_TILE_DEFINITIONS,
  initialEntities: [
    {
      id: "player",
      kind: "player",
      gridX: LEVEL1_SOURCE.playerSpawn.x,
      gridY: LEVEL1_SOURCE.playerSpawn.y,
      x: LEVEL1_SOURCE.playerSpawn.x * BOARD_TILE_SIZE,
      y: LEVEL1_SOURCE.playerSpawn.y * BOARD_TILE_SIZE,
      width: BOARD_TILE_SIZE,
      height: BOARD_TILE_SIZE,
      spriteFrameId: "player-idle",
      active: true
    },
    ...LEVEL1_MONSTER_ENTITIES,
    ...LEVEL1_DIAMOND_ENTITIES
  ],
  playerStart: {
    x: LEVEL1_SOURCE.playerSpawn.x,
    y: LEVEL1_SOURCE.playerSpawn.y
  },
  meta: {
    timeLimit: LEVEL1_SOURCE.time,
    gallery: 1,
    requiredDiamonds: LEVEL1_SOURCE.requiredDiamonds,
    scoreStep: LEVEL1_SCORE_STEP
  }
};

export function createGameLevelState(levelNumber = 1): GameState {
  if (levelNumber !== 1) {
    throw new Error(`Niveau non pris en charge: ${levelNumber}`);
  }

  const entities: EntityState[] = LEVEL1_DEFINITION.initialEntities.map((entity) => ({ ...entity }));
  const player = entities.find((entity) => entity.kind === "player");
  const monsters = createMonsterRuntimeStates(entities);
  if (!player) {
    throw new Error("Le niveau 1 doit contenir une entité joueur.");
  }

  return {
    sceneId: "gameplay",
    level: LEVEL1_DEFINITION,
    entities,
    monsters,
    player,
    hud: {
      score: 0,
      time: LEVEL1_DEFINITION.meta.timeLimit,
      record: 0,
      gallery: LEVEL1_DEFINITION.meta.gallery,
      diamonds: LEVEL1_DEFINITION.meta.requiredDiamonds
    },
    lives: 3,
    levelComplete: false,
    gameOver: false
  };
}

function buildTileDefinitionsFromRows(tiles: readonly number[]): Record<number, TileDefinition> {
  const definitions: Record<number, TileDefinition> = {};
  const uniqueTileIds = [...new Set(tiles)];
  uniqueTileIds.forEach((tileId) => {
    definitions[tileId] = createTileDefinition(tileId);
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

function createTileDefinition(tileId: number): TileDefinition {
  if (ROCK_TILE_IDS.includes(tileId)) {
    return {
      id: tileId,
      name: "rock",
      collision: "solid",
      render: { tileFrameId: `tile:${tileId}` }
    };
  }

  if (WALL_TILE_IDS.includes(tileId)) {
    return {
      id: tileId,
      name: "wall",
      collision: "solid",
      render: { tileFrameId: `tile:${tileId}` }
    };
  }

  if (DIAMOND_TILE_IDS.includes(tileId)) {
    return {
      id: tileId,
      name: "diamond",
      collision: "empty",
      collectible: {
        score: LEVEL1_SCORE_STEP,
        counter: "diamonds"
      },
      render: { tileFrameId: `tile:${tileId}` }
    };
  }

  if (EXIT_TILE_IDS.includes(tileId)) {
    return {
      id: tileId,
      name: "exit",
      collision: "exit",
      render: { tileFrameId: `tile:${tileId}` }
    };
  }

  if (MONSTER_TILE_IDS.includes(tileId)) {
    return {
      id: tileId,
      name: "monster",
      collision: "hazard",
      render: { tileFrameId: `tile:${tileId}` }
    };
  }

  if (EMPTY_TILE_IDS.includes(tileId)) {
    return {
      id: tileId,
      name: "empty",
      collision: "empty",
      render: { tileFrameId: `tile:${tileId}` }
    };
  }

  return {
    id: tileId,
    name: "tile",
    collision: "empty",
    render: { tileFrameId: `tile:${tileId}` }
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

function findEntityPositions(type: ModernTileType): Array<{ x: number; y: number }> {
  return LEVEL1_SOURCE.entities
    .filter((entity) => entity.type === type)
    .map((entity) => ({ x: entity.x, y: entity.y }));
}
