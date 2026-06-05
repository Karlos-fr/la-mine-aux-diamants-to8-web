/**
 * Role: Fournit le journal d'evenements runtime minimal.
 * Scope: Permet d'emettre puis consommer les effets derives des mutations de grille.
 * ISO: Les evenements ne remplacent pas la grille runtime; ils documentent les consequences modernes.
 * Notes: Le journal reste volontairement simple pour eviter un event bus trop lourd.
 */

import type { GameState, RuntimeEvent } from "./types";

/** Ajoute un evenement au journal du tick courant. */
export function emitRuntimeEvent(state: GameState, event: RuntimeEvent): void {
  state.runtimeEvents.push(event);
}

/** Recupere tous les evenements en attente et vide le journal. */
export function drainRuntimeEvents(state: GameState): RuntimeEvent[] {
  const events = [...state.runtimeEvents];
  state.runtimeEvents.length = 0;
  return events;
}
