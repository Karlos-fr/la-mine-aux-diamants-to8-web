/**
 * Role: Resout la poussee horizontale discrete des rochers.
 * Scope: Verifie uniquement la regle logique de poussee; l'orchestrateur applique ensuite mutations et animation.
 * ISO: Un rocher ne peut etre pousse qu'a gauche ou droite vers une cellule vide libre.
 * Notes: La poussee reste distincte d'une chute et ne produit pas d'impact mortel.
 */

/** Contexte minimal necessaire pour tester une poussee de rocher. */
export interface RockPushContext {
  /** Lit une tuile runtime dans la grille logique. */
  readonly getTile: (gridX: number, gridY: number) => number;
  /** Indique si une cellule est occupee par une entite visible/logique. */
  readonly hasEntityAt: (gridX: number, gridY: number) => boolean;
  /** Indique si une cellule est occupee par un monstre runtime. */
  readonly hasMonsterAt: (gridX: number, gridY: number) => boolean;
  /** Indique si une cellule est occupee ou ciblee par un objet physique actif. */
  readonly hasPhysicalObjectAt: (gridX: number, gridY: number) => boolean;
  /** Tile id du vide logique. */
  readonly emptyTileId: number;
}

/** Cellule cible d'une poussee de rocher valide. */
export interface RockPushTarget {
  /** Colonne cible du rocher pousse. */
  readonly x: number;
  /** Ligne cible du rocher pousse. */
  readonly y: number;
}

/** Resout la cible d'une poussee horizontale, ou `null` si elle est impossible. */
export function resolveRockPushTarget(
  rockGridX: number,
  rockGridY: number,
  moveX: number,
  context: RockPushContext
): RockPushTarget | null {
  if (moveX !== -1 && moveX !== 1) {
    return null;
  }

  const targetX = rockGridX + moveX;
  const targetY = rockGridY;
  if (context.getTile(targetX, targetY) !== context.emptyTileId) {
    return null;
  }

  if (
    context.hasEntityAt(targetX, targetY) ||
    context.hasMonsterAt(targetX, targetY) ||
    context.hasPhysicalObjectAt(targetX, targetY)
  ) {
    return null;
  }

  return { x: targetX, y: targetY };
}
