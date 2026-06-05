/**
 * Role: Determine les cibles de chute/glissement des rochers et diamants.
 * Scope: Prend un contexte de grille en callback pour rester independant de la scene.
 * ISO: Reproduit la chute verticale directe puis la bascule laterale sous contrainte de support physique.
 * Notes: Les traces monstre et autres exceptions sont decidees par le contexte appelant.
 */

/** Contexte minimal necessaire pour resoudre le mouvement d'un objet physique. */
export interface FallingObjectTargetContext {
  /** Colonne courante de l'objet. */
  readonly gridX: number;
  /** Ligne courante de l'objet. */
  readonly gridY: number;
  /** Colonne joueur, utilisee pour prioriser le cote de bascule. */
  readonly playerGridX: number;
  /** Lecture de tuile runtime. */
  readonly getTile: (gridX: number, gridY: number) => number;
  /** Verifie si l'objet peut occuper une cellule cible. */
  readonly canMoveTo: (gridX: number, gridY: number) => boolean;
  /** Indique si une tuile peut servir de support physique statique. */
  readonly isStaticFallingObjectTile: (tileId: number) => boolean;
  /** Verifie si une cellule laterale compte comme vide pour la bascule. */
  readonly isClearanceCellEmpty: (gridX: number, gridY: number) => boolean;
}

/** Cible resolue pour un objet physique et nature logique du mouvement. */
export interface FallingObjectResolvedTarget {
  /** Colonne cible du mouvement. */
  readonly x: number;
  /** Ligne cible du mouvement. */
  readonly y: number;
  /** Nature physique du mouvement resolu. */
  readonly moveKind: "fall" | "slide";
}

/** Calcule la prochaine cellule cible d'un rocher/diamant, ou `null` si l'objet reste immobile. */
export function resolveFallingObjectTarget(
  context: FallingObjectTargetContext
): FallingObjectResolvedTarget | null {
  const belowY = context.gridY + 1;
  if (context.canMoveTo(context.gridX, belowY)) {
    return { x: context.gridX, y: belowY, moveKind: "fall" };
  }

  if (!context.isStaticFallingObjectTile(context.getTile(context.gridX, belowY))) {
    return null;
  }

  const horizontalDirections = getHorizontalDirectionPriority(context.playerGridX, context.gridX);

  for (const direction of horizontalDirections) {
    const sideX = context.gridX + direction;
    if (
      hasTwoEmptyCellsInSideColumn(context, direction) &&
      context.canMoveTo(sideX, belowY)
    ) {
      return { x: sideX, y: belowY, moveKind: "slide" };
    }
  }

  return null;
}

/** Priorise le cote du joueur quand les deux bascules laterales sont possibles. */
function getHorizontalDirectionPriority(playerGridX: number, objectGridX: number): ReadonlyArray<-1 | 1> {
  if (playerGridX < objectGridX) {
    return [-1, 1];
  }

  if (playerGridX > objectGridX) {
    return [1, -1];
  }

  return [-1, 1];
}

/** Verifie la contrainte de deux cases vides en colonne sur le cote de bascule. */
function hasTwoEmptyCellsInSideColumn(context: FallingObjectTargetContext, direction: -1 | 1): boolean {
  const sideX = context.gridX + direction;
  return (
    context.isClearanceCellEmpty(sideX, context.gridY) &&
    context.isClearanceCellEmpty(sideX, context.gridY + 1)
  );
}
