/**
 * Role: Gere le pas runtime d'un monstre.
 * Scope: Deplace un monstre sur la grille, pose les marqueurs runtime et met a jour son pointeur.
 * ISO: Les directions conservent le codage historique 1..4 et les traces runtime `0x80`.
 * Notes: L'interpolation visuelle est stockee dans l'etat mais consommee par la scene/rendu.
 */

import type { MonsterRuntimeState } from "../types";
import { isMonsterWalkableRuntimeTile } from "../runtime-tiles";

/** Acces minimaux fournis par la scene pour faire avancer un monstre. */
export interface MonsterSystemContext {
  /** Lit une tuile runtime. */
  readonly getTile: (gridX: number, gridY: number) => number;
  /** Ecrit une tuile runtime. */
  readonly setTile: (gridX: number, gridY: number, tileId: number) => void;
  /** Adresse de base runtime TO8 pour recalculer le pointeur. */
  readonly runtimeBaseAddress: number;
  /** Stride runtime TO8 pour recalculer le pointeur. */
  readonly runtimeStride: number;
  /** Tile id temporaire du monstre actif. */
  readonly activeTileId: number;
  /** Tile id de trace laissee par le monstre. */
  readonly trailTileId: number;
  /** Duree d'interpolation visuelle du pas. */
  readonly moveDuration: number;
}

/** Avance un monstre d'un pas discret si une direction traversable est disponible. */
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

/** Convertit la direction historique 1..4 en delta de grille. */
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

/** Tourne la direction dans l'ordre original quand la voie courante est bloquee. */
function decrementMonsterDirection(direction: MonsterRuntimeState["direction"]): MonsterRuntimeState["direction"] {
  if (direction === 1) {
    return 4;
  }

  if (direction === 2) {
    return 1;
  }

  if (direction === 3) {
    return 2;
  }

  return 3;
}
