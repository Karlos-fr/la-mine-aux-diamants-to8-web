/**
 * Role: Fournit des helpers de rendu pour entites et objets physiques.
 * Scope: Calcule culling et positions affichees sans muter l'etat runtime.
 * ISO: Respecte le deplacement discret case par case en ne modifiant que la position visuelle.
 * Notes: Les decisions de collision restent dans les systems gameplay.
 */

import type { FallingObjectRuntimeState } from "../game/types";
import { getMovementRenderProgress } from "../game/movement-visuals";
import type { RenderViewport } from "./level-renderer";
import { isGridCellInExpandedViewport } from "./level-renderer";

/** Indique si une position grille d'entite doit etre consideree visible dans le viewport etendu. */
export function isEntityGridPositionVisible(
  gridX: number,
  gridY: number,
  viewport: RenderViewport,
  expansion = 1
): boolean {
  return isGridCellInExpandedViewport(gridX, gridY, viewport, expansion);
}

/** Calcule la position grille affichee d'un objet physique pour le rendu uniquement. */
export function getRenderedFallingObjectGridPosition(
  fallingObject: FallingObjectRuntimeState
): { readonly x: number; readonly y: number } {
  const renderProgress = getMovementRenderProgress(fallingObject.elapsed, fallingObject.duration);
  return {
    x: lerp(fallingObject.fromX, fallingObject.toX, renderProgress),
    y: lerp(fallingObject.fromY, fallingObject.toY, renderProgress)
  };
}

/** Interpole lineairement entre deux coordonnees. */
function lerp(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}
