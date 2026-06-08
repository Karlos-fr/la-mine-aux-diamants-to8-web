/**
 * Role: Centralise la progression visuelle des mouvements entre cellules.
 * Scope: Convertit une progression temporelle en progression rendue selon les options modernes.
 * ISO: Le cadencement logique reste porte par runtime-timing.ts; ce fichier ne change jamais les durees.
 * Notes: Le mode non fluide fige le rendu sur la case de depart jusqu'a l'arrivee logique.
 */

import { isSmoothMovementEnabled } from "../game-options";

/** Retourne la progression a utiliser pour le rendu d'un mouvement case par case. */
export function getMovementRenderProgress(elapsed: number, duration: number): number {
  if (duration <= 0) {
    return 1;
  }

  const progress = clamp(elapsed / duration, 0, 1);
  if (!isSmoothMovementEnabled()) {
    return progress >= 1 ? 1 : 0;
  }

  return smoothStep(progress);
}

/** Contraint une valeur numerique entre deux bornes. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Lisse une interpolation visuelle sans changer la duree logique du mouvement. */
function smoothStep(progress: number): number {
  return progress * progress * (3 - 2 * progress);
}
