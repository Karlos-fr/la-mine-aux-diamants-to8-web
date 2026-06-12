/**
 * Role: Facade publique du domaine `game`.
 * Scope: Regroupe les types, loaders, factories et helpers runtime utiles aux autres modules.
 * ISO: Les exports ASM/runtime restent delegues aux modules de provenance dedies.
 * Notes: Facade conservee pour stabiliser les imports pendant le refactor.
 */

/** Types runtime principaux du domaine gameplay. */
export type {
  FallingObjectRuntimeState,
  EntityKind,
  EntityState,
  GameState,
  HudState,
  LevelDefinition,
  RuntimeEvent,
  TileCollision,
  TileDefinition
} from "./types";
/** Helpers de journal d'evenements runtime. */
export { drainRuntimeEvents, emitRuntimeEvent } from "./runtime-events";
/** Types publics du format JSON moderne. */
export type { ModernEntityType, ModernGridPoint, ModernLevelCell, ModernLevelJson, ModernTileType } from "./level-loader";
/** Loader et conversion des niveaux modernes. */
export {
  LEVEL_COUNT,
  buildLevelDefinition,
  getModernLevelSource,
  loadLevelDefinition
} from "./level-loader";
/** Factories d'etat gameplay. */
export {
  LEVEL1_DEFINITION,
  createGameLevelState,
  createGameShellState
} from "./game-state-factory";
/** Grille runtime mutable. */
export { LevelRuntimeGrid } from "./runtime-grid";
/** Constantes et helpers de tuiles runtime. */
export {
  RUNTIME_GRID_BASE_ADDRESS,
  RUNTIME_GRID_FILL_TILE_ID,
  RUNTIME_GRID_STRIDE,
  RUNTIME_TILE,
  getRuntimeGridStrideForLevel,
  isMonsterWalkableRuntimeTile
} from "./runtime-tiles";
