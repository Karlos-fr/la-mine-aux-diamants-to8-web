export interface FallingObjectTargetContext {
  readonly gridX: number;
  readonly gridY: number;
  readonly playerGridX: number;
  readonly getTile: (gridX: number, gridY: number) => number;
  readonly canMoveTo: (gridX: number, gridY: number) => boolean;
  readonly isStaticFallingObjectTile: (tileId: number) => boolean;
  readonly isClearanceCellEmpty: (gridX: number, gridY: number) => boolean;
}

export function resolveFallingObjectTarget(
  context: FallingObjectTargetContext
): { readonly x: number; readonly y: number } | null {
  const belowY = context.gridY + 1;
  if (context.canMoveTo(context.gridX, belowY)) {
    return { x: context.gridX, y: belowY };
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
      return { x: sideX, y: belowY };
    }
  }

  return null;
}

function getHorizontalDirectionPriority(playerGridX: number, objectGridX: number): ReadonlyArray<-1 | 1> {
  if (playerGridX < objectGridX) {
    return [-1, 1];
  }

  if (playerGridX > objectGridX) {
    return [1, -1];
  }

  return [-1, 1];
}

function hasTwoEmptyCellsInSideColumn(context: FallingObjectTargetContext, direction: -1 | 1): boolean {
  const sideX = context.gridX + direction;
  return (
    context.isClearanceCellEmpty(sideX, context.gridY) &&
    context.isClearanceCellEmpty(sideX, context.gridY + 1)
  );
}
