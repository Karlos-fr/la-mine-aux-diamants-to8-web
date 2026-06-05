export function isOpenExitCell(
  exitOpen: boolean,
  exitX: number,
  exitY: number,
  gridX: number,
  gridY: number
): boolean {
  return exitOpen && gridX === exitX && gridY === exitY;
}
