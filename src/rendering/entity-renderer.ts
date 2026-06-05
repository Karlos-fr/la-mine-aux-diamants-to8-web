import type { FallingObjectRuntimeState } from "../game/types";
import type { RenderViewport } from "./level-renderer";
import { isGridCellInExpandedViewport } from "./level-renderer";

export function isEntityGridPositionVisible(
  gridX: number,
  gridY: number,
  viewport: RenderViewport,
  expansion = 1
): boolean {
  return isGridCellInExpandedViewport(gridX, gridY, viewport, expansion);
}

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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lerp(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

function smoothStep(progress: number): number {
  return progress * progress * (3 - 2 * progress);
}
