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

  const horizontalDirections = context.playerGridX < context.gridX
    ? [-1, 1] as const
    : context.playerGridX > context.gridX
      ? [1, -1] as const
      : [-1, 1] as const;

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

function hasTwoEmptyCellsInSideColumn(context: FallingObjectTargetContext, direction: -1 | 1): boolean {
  const sideX = context.gridX + direction;
  return (
    context.isClearanceCellEmpty(sideX, context.gridY) &&
    context.isClearanceCellEmpty(sideX, context.gridY + 1)
  );
}
