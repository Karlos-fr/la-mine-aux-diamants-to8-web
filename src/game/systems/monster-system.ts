/**
 * Role: Gere le pas runtime d'un monstre.
 * Scope: Deplace un monstre sur la grille, pose les marqueurs runtime et met a jour son pointeur.
 * ISO: Les routines `CA04` et `BC84` utilisent deux tables de rotation distinctes.
 * Notes: Le mouvement stocke sa duree de reference; la scene decide seulement de la progression rendue.
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
  /** Duree de reference du pas. */
  readonly moveDuration: number;
}

/** Avance un monstre d'un pas discret si une direction traversable est disponible. */
export function advanceSingleMonsterRuntime(
  monster: MonsterRuntimeState,
  context: MonsterSystemContext
): void {
  let direction = monster.direction;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const delta = monsterDirectionToDelta(monster.kind, direction);
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
      monster.direction = rotateMonsterDirectionAfterMove(monster.kind, direction);
      monster.runtimePointer = context.runtimeBaseAddress + targetY * context.runtimeStride + targetX;
      return;
    }

    direction = rotateMonsterDirectionAfterBlockedAttempt(monster.kind, direction);
  }

  monster.direction = direction;
}

/** Convertit la direction historique 1..4 en delta de grille selon le type d'entite ASM. */
function monsterDirectionToDelta(
  kind: MonsterRuntimeState["kind"],
  direction: MonsterRuntimeState["direction"]
): { readonly x: number; readonly y: number } {
  if (kind === "specialCreature") {
    return specialCreatureDirectionToDelta(direction);
  }

  return standardMonsterDirectionToDelta(direction);
}

/** Convertit la direction du monstre standard `0x02` selon la routine `CA04`. */
function standardMonsterDirectionToDelta(
  direction: MonsterRuntimeState["direction"]
): { readonly x: number; readonly y: number } {
  if (direction === 1) {
    return { x: 0, y: 1 };
  }

  if (direction === 2) {
    return { x: -1, y: 0 };
  }

  if (direction === 3) {
    return { x: 0, y: -1 };
  }

  return { x: 1, y: 0 };
}

/** Convertit la direction de la creature speciale `0x17` selon la routine `BC84`. */
function specialCreatureDirectionToDelta(
  direction: MonsterRuntimeState["direction"]
): { readonly x: number; readonly y: number } {
  if (direction === 1) {
    return { x: 0, y: -1 };
  }

  if (direction === 2) {
    return { x: 1, y: 0 };
  }

  if (direction === 3) {
    return { x: 0, y: 1 };
  }

  return { x: -1, y: 0 };
}

/** Tourne la direction apres un essai bloque selon le type d'entite ASM. */
function rotateMonsterDirectionAfterBlockedAttempt(
  kind: MonsterRuntimeState["kind"],
  direction: MonsterRuntimeState["direction"]
): MonsterRuntimeState["direction"] {
  if (kind === "specialCreature") {
    return decrementMonsterDirection(direction);
  }

  return incrementMonsterDirection(direction);
}

/** Tourne la direction standard dans l'ordre original quand la voie courante est bloquee. */
function incrementMonsterDirection(direction: MonsterRuntimeState["direction"]): MonsterRuntimeState["direction"] {
  if (direction === 1) {
    return 2;
  }

  if (direction === 2) {
    return 3;
  }

  if (direction === 3) {
    return 4;
  }

  return 1;
}

/** Tourne la direction speciale dans l'ordre inverse quand la voie courante est bloquee. */
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

/** Prepare la direction du prochain pas apres un mouvement reussi, comme `CA04` ou `BC84`. */
function rotateMonsterDirectionAfterMove(
  kind: MonsterRuntimeState["kind"],
  direction: MonsterRuntimeState["direction"]
): MonsterRuntimeState["direction"] {
  if (kind === "specialCreature") {
    return incrementMonsterDirection(direction);
  }

  return decrementMonsterDirection(direction);
}
