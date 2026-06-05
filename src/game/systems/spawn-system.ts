/**
 * Role: Gere la sequence visuelle de spawn joueur.
 * Scope: Calcule la duree du blink et la tuile a rendre pendant cette phase.
 * ISO: Reproduit `KIT.BIN:$BE68`: 6 demi-etapes, donc 3 cycles `0x04` puis noir.
 * Notes: Le nettoyage de grille reste orchestre hors de ce system.
 */

/** Indique si le joueur est encore dans la fenetre de blink de spawn. */
export function isPlayerSpawning(
  spawnElapsed: number,
  blinkRepetitions: number,
  blinkStepDuration: number
): boolean {
  return spawnElapsed < blinkRepetitions * 2 * blinkStepDuration;
}

/** Retourne la tuile de blink spawn, `null` pour noir, ou `undefined` hors spawn. */
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
