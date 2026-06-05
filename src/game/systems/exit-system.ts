/**
 * Role: Isole la reconnaissance de la cellule de sortie ouverte.
 * Scope: Compare l'etat de sortie et une coordonnee grille, sans declencher de navigation.
 * ISO: La sortie reste une coordonnee logique issue du niveau moderne.
 * Notes: L'ouverture effective est geree par les evenements runtime/HUD.
 */

/** Indique si une coordonnee correspond a la sortie actuellement ouverte. */
export function isOpenExitCell(
  exitOpen: boolean,
  exitX: number,
  exitY: number,
  gridX: number,
  gridY: number
): boolean {
  return exitOpen && gridX === exitX && gridY === exitY;
}
