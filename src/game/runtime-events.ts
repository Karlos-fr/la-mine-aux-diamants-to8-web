import type { GameState, RuntimeEvent } from "./types";

export function emitRuntimeEvent(state: GameState, event: RuntimeEvent): void {
  state.runtimeEvents.push(event);
}

export function drainRuntimeEvents(state: GameState): RuntimeEvent[] {
  const events = [...state.runtimeEvents];
  state.runtimeEvents.length = 0;
  return events;
}
