/**
 * Role: Rend les fontes TO8 extraites depuis les metadata generees.
 * Scope: Dessine du texte pixel par pixel via l'interface Renderer.
 * ISO: Les glyphes viennent de `mine-fonts`, produit par extraction/provenance.
 * Notes: Le fallback `drawPixelText` reste un filet de securite si une font manque.
 */

import { mineFontMetadata } from "../assets/generated/mine-fonts";
import type { Renderer } from "../engine/renderer";

/** Dimensions d'une chaine rendue avec une font TO8. */
export interface To8FontTextMetrics {
  /** Largeur en pixels logiques. */
  readonly width: number;

  /** Hauteur en pixels logiques. */
  readonly height: number;
}

/** Dessine une chaine avec une font TO8 extraite ou un fallback pixel moderne. */
export function drawTo8FontText(
  renderer: Renderer,
  text: string,
  fontId: string,
  x: number,
  y: number,
  color: string
): void {
  const font = mineFontMetadata.fonts.find((item) => item.id === fontId);
  if (!font) {
    renderer.drawPixelText(text, x, y, color);
    return;
  }

  let cursorX = x;
  for (const character of text) {
    const glyph = font.glyphs.find((item) => item.char === character);
    if (!glyph) {
      cursorX += font.width;
      continue;
    }

    for (let row = 0; row < font.height; row += 1) {
      const bits = glyph.rows[row] ?? "";
      for (let column = 0; column < font.width; column += 1) {
        if (bits[column] === "1") {
          renderer.fillRect(cursorX + column, y + row, 1, 1, color);
        }
      }
    }
    cursorX += font.width;
  }
}

/** Mesure une chaine bitmap TO8 pour permettre des alignements dynamiques. */
export function measureTo8FontText(text: string, fontId: string): To8FontTextMetrics {
  const font = mineFontMetadata.fonts.find((item) => item.id === fontId);
  if (!font) {
    return {
      width: text.length * 6,
      height: 7
    };
  }

  return {
    width: text.length * font.width,
    height: font.height
  };
}
