import type { EntityState, GameState, LevelDefinition, MonsterRuntimeState, TileDefinition } from "./types";
import {
  mineLevel01Metadata,
  mineLevel01Rows
} from "../assets/generated/levels/mine-level-01-grid";

const BOARD_TILE_SIZE = mineLevel01Metadata.tileSize;
const LEVEL_ID_PREFIX = "level-01";
const RUNTIME_GRID_BASE_ADDRESS = 0xdbb7;
const RUNTIME_GRID_STRIDE = 40;

const ROCK_TILE_IDS = [0x00];
const WALL_TILE_IDS = [0x01, 0x06];
const DIAMOND_TILE_IDS = [0x03];
const EXIT_TILE_IDS = [0x04];
const MONSTER_TILE_IDS = [0x02];
const EMPTY_TILE_IDS = [0x05];

const LEVEL1_TILES = mineLevel01Rows.flatMap((row) => row);
const LEVEL1_SCORE_STEP = 0x0f;

const LEVEL1_TILE_DEFINITIONS: Record<number, TileDefinition> = buildTileDefinitionsFromRows(LEVEL1_TILES);

const LEVEL1_MONSTER_ENTITIES = findTilePositions(0x02).map((position, index) => ({
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

const LEVEL1_DIAMOND_ENTITIES = mineLevel01Metadata.tilePositions.diamonds?.map(
  (diamond: { readonly x: number; readonly y: number }, index: number) => ({
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
) ?? [];

export const LEVEL1_DEFINITION: LevelDefinition = {
  id: LEVEL_ID_PREFIX,
  name: "La mine - niveau 1",
  width: mineLevel01Metadata.width,
  height: mineLevel01Metadata.height,
  tileSize: mineLevel01Metadata.tileSize,
  tiles: LEVEL1_TILES,
  tileDefinitions: LEVEL1_TILE_DEFINITIONS,
  initialEntities: [
    {
      id: "player",
      kind: "player",
      gridX: mineLevel01Metadata.playerStart.x,
      gridY: mineLevel01Metadata.playerStart.y,
      x: mineLevel01Metadata.playerStart.x * BOARD_TILE_SIZE,
      y: mineLevel01Metadata.playerStart.y * BOARD_TILE_SIZE,
      width: BOARD_TILE_SIZE,
      height: BOARD_TILE_SIZE,
      spriteFrameId: "player-idle",
      active: true
    },
    ...LEVEL1_MONSTER_ENTITIES,
    ...LEVEL1_DIAMOND_ENTITIES
  ],
  playerStart: {
    x: mineLevel01Metadata.playerStart.x,
    y: mineLevel01Metadata.playerStart.y
  },
  meta: {
    timeLimit: parseTimeLimit(mineLevel01Metadata.timeLimit),
    gallery: 1,
    requiredDiamonds: mineLevel01Metadata.requiredDiamonds,
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

function parseTimeLimit(value: string | undefined): number {
  if (!value) {
    return 0;
  }

  const parts = value.split(":");
  if (parts.length === 2) {
    const minutes = Number.parseInt(parts[0], 10);
    const seconds = Number.parseInt(parts[1], 10);
    if (Number.isNaN(minutes) || Number.isNaN(seconds)) {
      return 0;
    }

    return minutes * 100 + seconds * 10;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function findTilePositions(tileId: number): Array<{ x: number; y: number }> {
  return mineLevel01Rows.flatMap((row, y) => {
    return row
      .map((value, x) => ({ value, x, y }))
      .filter((tile) => tile.value === tileId)
      .map(({ x, y }) => ({ x, y }));
  });
}

export const createGameShellState = createGameLevelState;
