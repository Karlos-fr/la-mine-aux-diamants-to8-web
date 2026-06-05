/**
 * Role: Fournit des helpers de rendu pour entites et objets physiques.
 * Scope: Calcule culling et positions interpolees sans muter l'etat runtime.
 * ISO: Respecte le deplacement discret case par case en ne lissant que la position visuelle.
 * Notes: Les decisions de collision restent dans les systems gameplay.
 */

import type { FallingObjectRuntimeState } from "../game/types";
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

/** Calcule la position grille interpolee d'un objet tombant pour le rendu uniquement. */
export function getInterpolatedFallingObjectGridPosition(
  fallingObject: FallingObjectRuntimeState,
  progress: number
): { readonly x: number; readonly y: number } {
  const easedProgress = smoothStep(clamp(progress, 0, 1));
  return {
    x: lerp(fallingObject.fromX, fallingObject.toX, easedProgress),
    y: lerp(fallingObject.fromY, fallingObject.toY, easedProgress)
  };
}

/** Contraint une valeur entre deux bornes. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Interpole lineairement entre deux coordonnees. */
function lerp(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

/** Lisse la progression visuelle sans changer les cellules logiques. */
function smoothStep(progress: number): number {
  return progress * progress * (3 - 2 * progress);
}
