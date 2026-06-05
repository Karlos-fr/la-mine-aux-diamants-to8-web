/**
 * Role: Cree l'etat runtime initial d'une partie ou d'un niveau.
 * Scope: Assemble LevelDefinition, entites, HUD, monstres et files runtime.
 * ISO: Les pointeurs monstres utilisent la base/stride runtime TO8 centralises.
 * Notes: `createGameLevelState` reste la facade stable pour les scenes.
 */

import type { EntityState, GameState, MonsterRuntimeState } from "./types";
import { loadLevelDefinition } from "./level-loader";
import { RUNTIME_GRID_BASE_ADDRESS, RUNTIME_GRID_STRIDE } from "./runtime-tiles";

/** Definition du premier niveau, exposee pour compatibilite et inspection. */
export const LEVEL1_DEFINITION = loadLevelDefinition(1);

/** Cree l'etat complet initial pour un niveau donne. */
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

/** Cree les etats runtime specialises des monstres a partir des entites de niveau. */
function createMonsterRuntimeStates(entities: readonly EntityState[]): MonsterRuntimeState[] {
  /** Direction initiale moderne conservee pour tous les monstres au chargement. */
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

/** Alias historique conserve pour compatibilite avec les anciennes integrations. */
export const createGameShellState = createGameLevelState;
