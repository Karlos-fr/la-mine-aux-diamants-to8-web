/**
 * Role: Fournit les calculs de viewport et position ecran pour le rendu de niveau.
 * Scope: Convertit coordonnees grille -> ecran et applique un culling etendu.
 * ISO: La logique reste en cellules; le rendu peut interpoler le viewport visuel.
 * Notes: Aucun acces a la grille runtime n'est effectue ici.
 */

/** Viewport de rendu exprime en coordonnees de grille potentiellement interpolees. */
export interface RenderViewport {
  /** Origine horizontale du viewport. */
  readonly x: number;
  /** Origine verticale du viewport. */
  readonly y: number;
  /** Nombre de colonnes visibles. */
  readonly columns: number;
  /** Nombre de lignes visibles. */
  readonly rows: number;
}

/** Convertit une cellule de grille en position pixel ecran. */
export function getGridCellScreenPosition(
  gridX: number,
  gridY: number,
  viewport: RenderViewport,
  tileSize: number,
  boardOffsetX: number,
  boardOffsetY: number
): { readonly x: number; readonly y: number } {
  return {
    x: Math.round(boardOffsetX + (gridX - viewport.x) * tileSize),
    y: Math.round(boardOffsetY + (gridY - viewport.y) * tileSize)
  };
}

/** Indique si une cellule est visible dans le viewport avec une marge de securite. */
export function isGridCellInExpandedViewport(
  gridX: number,
  gridY: number,
  viewport: RenderViewport,
  expansion = 1
): boolean {
  const cullViewportX = Math.floor(viewport.x);
  const cullViewportY = Math.floor(viewport.y);
  return (
    gridX >= cullViewportX - expansion &&
    gridX < cullViewportX + viewport.columns + expansion + 1 &&
    gridY >= cullViewportY - expansion &&
    gridY < cullViewportY + viewport.rows + expansion + 1
  );
}
