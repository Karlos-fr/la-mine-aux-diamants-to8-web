export interface RenderViewport {
  readonly x: number;
  readonly y: number;
  readonly columns: number;
  readonly rows: number;
}

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
