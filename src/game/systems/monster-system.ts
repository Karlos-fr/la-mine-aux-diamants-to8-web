import type { MonsterRuntimeState } from "../types";
import { isMonsterWalkableRuntimeTile } from "../runtime-tiles";

export interface MonsterSystemContext {
  readonly getTile: (gridX: number, gridY: number) => number;
  readonly setTile: (gridX: number, gridY: number, tileId: number) => void;
  readonly runtimeBaseAddress: number;
  readonly runtimeStride: number;
  readonly activeTileId: number;
  readonly trailTileId: number;
  readonly moveDuration: number;
}

export function advanceSingleMonsterRuntime(
  monster: MonsterRuntimeState,
  context: MonsterSystemContext
): void {
  let direction = monster.direction;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const delta = monsterDirectionToDelta(direction);
    const targetX = monster.gridX + delta.x;
    const targetY = monster.gridY + delta.y;

    if (isMonsterWalkableRuntimeTile(context.getTile(targetX, targetY))) {
      context.setTile(monster.gridX, monster.gridY, context.trailTileId);
      context.setTile(targetX, targetY, context.activeTileId);
      monster.movement = {
        fromX: monster.gridX,
        fromY: monster.gridY,
        toX: targetX,
        toY: targetY,
        elapsed: 0,
        duration: context.moveDuration
      };
      monster.gridX = targetX;
      monster.gridY = targetY;
      monster.direction = direction;
      monster.runtimePointer = context.runtimeBaseAddress + targetY * context.runtimeStride + targetX;
      return;
    }

    direction = decrementMonsterDirection(direction);
  }

  monster.direction = direction;
}

function monsterDirectionToDelta(direction: MonsterRuntimeState["direction"]): { readonly x: number; readonly y: number } {
  if (direction === 1) {
    return { x: -1, y: 0 };
  }

  if (direction === 2) {
    return { x: 0, y: -1 };
  }

  if (direction === 3) {
    return { x: 1, y: 0 };
  }

  return { x: 0, y: 1 };
}

function decrementMonsterDirection(direction: MonsterRuntimeState["direction"]): MonsterRuntimeState["direction"] {
  return direction === 1 ? 4 : (direction - 1) as MonsterRuntimeState["direction"];
}
