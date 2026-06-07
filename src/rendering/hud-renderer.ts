/**
 * Role: Rend les champs texte et compteurs du HUD gameplay.
 * Scope: Formate les valeurs et delegue le dessin glyphes au renderer de fonte TO8.
 * ISO: Les libelles/couleurs/positions sont fournis par la scene depuis les donnees deja reproduites.
 * Notes: Ce module ne lit ni ne mute la grille runtime.
 */

import type { HudState } from "../game/types";
import type { Renderer } from "../engine/renderer";
import { drawTo8FontText, measureTo8FontText } from "./font-renderer";

/** Configuration de rendu des libelles et valeurs HUD principaux. */
export interface HudTextRenderConfig {
  /** Font des libelles `Points Temps Record`. */
  readonly labelFontId: string;
  /** Font des valeurs numeriques principales. */
  readonly valueFontId: string;
  /** Couleur des libelles. */
  readonly labelColor: string;
  /** Couleur des valeurs. */
  readonly valueColor: string;
  /** Debut horizontal de la zone disponible entre les panneaux HUD. */
  readonly fieldAreaX: number;
  /** Largeur horizontale disponible pour repartir les trois champs. */
  readonly fieldAreaWidth: number;
  /** Position Y des libelles. */
  readonly labelsY: number;
  /** Position Y des valeurs. */
  readonly valuesY: number;
}

/** Configuration de rendu des petits compteurs du panneau galerie. */
export interface HudSmallCounterRenderConfig {
  /** Font des petits chiffres. */
  readonly fontId: string;
  /** Couleur des petits chiffres. */
  readonly color: string;
}

/** Dessine les libelles et valeurs principales du HUD. */
export function drawHudTextFields(renderer: Renderer, hud: HudState, config: HudTextRenderConfig): void {
  const fields = [
    { label: "Points", value: padNumber(hud.score, 6) },
    { label: "Temps", value: padNumber(hud.time, 3) },
    { label: "Record", value: padNumber(hud.record, 6) }
  ] as const;

  fields.forEach((field, index) => {
    const centerX = config.fieldAreaX + config.fieldAreaWidth * ((index * 2 + 1) / (fields.length * 2));
    const labelMetrics = measureTo8FontText(field.label, config.labelFontId);
    const valueMetrics = measureTo8FontText(field.value, config.valueFontId);
    drawTo8FontText(
      renderer,
      field.label,
      config.labelFontId,
      Math.round(centerX - labelMetrics.width / 2),
      config.labelsY,
      config.labelColor
    );
    drawTo8FontText(
      renderer,
      field.value,
      config.valueFontId,
      Math.round(centerX - valueMetrics.width / 2),
      config.valuesY,
      config.valueColor
    );
  });
}

/** Dessine un petit compteur a largeur fixe. */
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

/** Formate un nombre a largeur fixe en gardant les derniers chiffres visibles. */
export function padNumber(value: number, size: number): string {
  return value.toString().padStart(size, "0").slice(-size);
}
