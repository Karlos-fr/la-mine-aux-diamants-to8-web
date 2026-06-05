import type { HudState } from "../game/types";
import type { Renderer } from "../engine/renderer";
import { drawTo8FontText } from "./font-renderer";

export interface HudTextRenderConfig {
  readonly labelFontId: string;
  readonly valueFontId: string;
  readonly labelColor: string;
  readonly valueColor: string;
  readonly labelsX: number;
  readonly labelsY: number;
  readonly scoreX: number;
  readonly timeX: number;
  readonly recordX: number;
  readonly valuesY: number;
}

export interface HudSmallCounterRenderConfig {
  readonly fontId: string;
  readonly color: string;
}

export function drawHudTextFields(renderer: Renderer, hud: HudState, config: HudTextRenderConfig): void {
  drawTo8FontText(renderer, "Points  Temps  Record", config.labelFontId, config.labelsX, config.labelsY, config.labelColor);
  drawTo8FontText(renderer, padNumber(hud.score, 6), config.valueFontId, config.scoreX, config.valuesY, config.valueColor);
  drawTo8FontText(renderer, padNumber(hud.time, 3), config.valueFontId, config.timeX, config.valuesY, config.valueColor);
  drawTo8FontText(renderer, padNumber(hud.record, 6), config.valueFontId, config.recordX, config.valuesY, config.valueColor);
}

export function drawHudSmallCounter(
  renderer: Renderer,
  value: number,
  digits: number,
  x: number,
  y: number,
  config: HudSmallCounterRenderConfig
): void {
  drawTo8FontText(renderer, padNumber(value, digits), config.fontId, x, y, config.color);
}

export function padNumber(value: number, size: number): string {
  return value.toString().padStart(size, "0").slice(-size);
}
