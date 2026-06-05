export function isPlayerSpawning(
  spawnElapsed: number,
  blinkRepetitions: number,
  blinkStepDuration: number
): boolean {
  return spawnElapsed < blinkRepetitions * 2 * blinkStepDuration;
}

export function getPlayerSpawnBlinkTileId(
  spawnElapsed: number,
  blinkStepDuration: number,
  fillTileId: number,
  isSpawning: boolean,
  isPlayerRenderedAtGrid: boolean
): number | null | undefined {
  if (!isSpawning || !isPlayerRenderedAtGrid) {
    return undefined;
  }

  const step = Math.floor(spawnElapsed / blinkStepDuration);
  return step % 2 === 0 ? fillTileId : null;
}
