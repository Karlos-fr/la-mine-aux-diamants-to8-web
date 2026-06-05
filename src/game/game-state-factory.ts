import type { EntityState, GameState, MonsterRuntimeState } from "./types";
import { loadLevelDefinition } from "./level-loader";
import { RUNTIME_GRID_BASE_ADDRESS, RUNTIME_GRID_STRIDE } from "./runtime-tiles";

export const LEVEL1_DEFINITION = loadLevelDefinition(1);

export function createGameLevelState(levelNumber = 1): GameState {
  const levelDefinition = loadLevelDefinition(levelNumber);
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
    runtimeEvents: [],
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

function createMonsterRuntimeStates(entities: readonly EntityState[]): MonsterRuntimeState[] {
  const initialDirection: MonsterRuntimeState["direction"] = 2;
  return entities
    .filter((entity) => entity.kind === "monster")
    .map((entity) => ({
      id: `runtime-${entity.id}`,
      entityId: entity.id,
      runtimePointer: RUNTIME_GRID_BASE_ADDRESS + entity.gridY * RUNTIME_GRID_STRIDE + entity.gridX,
      direction: initialDirection,
      gridX: entity.gridX,
      gridY: entity.gridY,
      animationKey: "monsterBlink",
      movement: null
    }));
}

export const createGameShellState = createGameLevelState;
