#!/usr/bin/env node
import { createServer } from "vite";

const vite = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error"
});

try {
  const { advanceSingleMonsterRuntime } = await vite.ssrLoadModule("/src/game/systems/monster-system.ts");
  const { RUNTIME_GRID_BASE_ADDRESS, RUNTIME_GRID_STRIDE, RUNTIME_TILE } = await vite.ssrLoadModule("/src/game/runtime-tiles.ts");

  verifyMonsterDoesNotEscapeFallingObjectTarget(advanceSingleMonsterRuntime, RUNTIME_GRID_BASE_ADDRESS, RUNTIME_GRID_STRIDE, RUNTIME_TILE);
  verifyMonsterStillMovesWhenUnblocked(advanceSingleMonsterRuntime, RUNTIME_GRID_BASE_ADDRESS, RUNTIME_GRID_STRIDE, RUNTIME_TILE);

  console.log("Gameplay runtime verification passed.");
} finally {
  await vite.close();
}

function verifyMonsterDoesNotEscapeFallingObjectTarget(advanceSingleMonsterRuntime, runtimeBaseAddress, runtimeStride, RUNTIME_TILE) {
  const monster = createSpecialCreature(runtimeBaseAddress, runtimeStride);
  const writes = [];
  advanceSingleMonsterRuntime(monster, {
    getTile: () => RUNTIME_TILE.empty,
    setTile: (x, y, tileId) => writes.push({ x, y, tileId }),
    isMonsterCellBlockedByPhysicalObject: (x, y) => x === 19 && y === 9,
    runtimeBaseAddress,
    runtimeStride,
    activeTileId: RUNTIME_TILE.specialCreature,
    trailTileId: RUNTIME_TILE.monsterTrail,
    moveDuration: 0.18
  });

  if (monster.gridX !== 19 || monster.gridY !== 9 || monster.movement !== null || writes.length !== 0) {
    throw new Error("Special creature escaped from a cell targeted by a falling object.");
  }
}

function verifyMonsterStillMovesWhenUnblocked(advanceSingleMonsterRuntime, runtimeBaseAddress, runtimeStride, RUNTIME_TILE) {
  const monster = createSpecialCreature(runtimeBaseAddress, runtimeStride);
  const writes = [];
  advanceSingleMonsterRuntime(monster, {
    getTile: () => RUNTIME_TILE.empty,
    setTile: (x, y, tileId) => writes.push({ x, y, tileId }),
    isMonsterCellBlockedByPhysicalObject: () => false,
    runtimeBaseAddress,
    runtimeStride,
    activeTileId: RUNTIME_TILE.specialCreature,
    trailTileId: RUNTIME_TILE.monsterTrail,
    moveDuration: 0.18
  });

  if (monster.gridX !== 20 || monster.gridY !== 9 || monster.movement === null || writes.length !== 2) {
    throw new Error("Special creature no longer moves normally when no physical object blocks it.");
  }
}

function createSpecialCreature(runtimeBaseAddress, runtimeStride) {
  return {
    kind: "specialCreature",
    id: "runtime-special-level-06",
    entityId: "specialCreature-level-06",
    runtimePointer: runtimeBaseAddress + 9 * runtimeStride + 19,
    direction: 2,
    gridX: 19,
    gridY: 9,
    animationKey: "specialCreature",
    movement: null
  };
}
