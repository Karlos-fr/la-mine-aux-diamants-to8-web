/**
 * Role: Rend la font Thomson procedurale dans des elements DOM.
 * Scope: Fournit une couche de texte pixelisee pour les overlays HTML hors canvas.
 * ISO: Les glyphes viennent de la font Thomson generee, pas d'une police systeme moderne.
 * Notes: Ce renderer garde les controles HTML accessibles en separant texte visible et aria-label.
 */

import { THOMSON_8_BIT_FONT } from "./assets/generated/thomson-8-bit-font";

/** Options de rendu DOM pour une chaine Thomson. */
export interface ThomsonDomTextOptions {
  /** Libelle accessible applique au conteneur quand necessaire. */
  readonly ariaLabel?: string;

  /** Longueur maximale visible avant troncature, utile pour les selects debug. */
  readonly maxLength?: number;
}

/** Largeur d'un glyphe de la font Thomson generee. */
const FONT_WIDTH = THOMSON_8_BIT_FONT.width;

/** Hauteur d'un glyphe de la font Thomson generee. */
const FONT_HEIGHT = THOMSON_8_BIT_FONT.height;

/** Table de glyphes proceduraux indexee par caractere. */
const GLYPHS = THOMSON_8_BIT_FONT.glyphs as Record<string, readonly string[]>;

/** Remplace le contenu visible d'un element par du texte Thomson pixelise. */
export function setThomsonDomText(
  element: HTMLElement,
  text: string,
  options: ThomsonDomTextOptions = {}
): void {
  element.replaceChildren(createThomsonDomText(text, options));
  if (options.ariaLabel !== undefined) {
    element.setAttribute("aria-label", options.ariaLabel);
  }
}

/** Cree un noeud de texte pixelise reutilisable dans les overlays HTML. */
export function createThomsonDomText(text: string, options: ThomsonDomTextOptions = {}): HTMLElement {
  const displayText = normalizeText(text, options.maxLength);
  const container = document.createElement("span");
  container.className = "to8-dom-text";
  container.setAttribute("aria-hidden", "true");
  container.style.setProperty("--to8-text-columns", String(displayText.length * FONT_WIDTH));
  container.style.setProperty("--to8-text-rows", String(FONT_HEIGHT));

  for (let charIndex = 0; charIndex < displayText.length; charIndex += 1) {
    appendGlyphPixels(container, displayText[charIndex], charIndex * FONT_WIDTH);
  }

  return container;
}

/** Ajoute les pixels allumes d'un glyphe au conteneur DOM. */
function appendGlyphPixels(container: HTMLElement, character: string, offsetX: number): void {
  const glyph = GLYPHS[character] ?? GLYPHS["?"] ?? GLYPHS[" "];
  for (let row = 0; row < FONT_HEIGHT; row += 1) {
    const bits = glyph?.[row] ?? "";
    for (let column = 0; column < FONT_WIDTH; column += 1) {
      if (bits[column] !== "1") {
        continue;
      }

      const pixel = document.createElement("span");
      pixel.className = "to8-dom-text__pixel";
      pixel.style.setProperty("--to8-pixel-x", String(offsetX + column));
      pixel.style.setProperty("--to8-pixel-y", String(row));
      container.append(pixel);
    }
  }
}

/** Normalise les libelles DOM vers le jeu de glyphes Thomson disponible. */
function normalizeText(text: string, maxLength: number | undefined): string {
  const upperText = text.toUpperCase();
  if (maxLength === undefined || upperText.length <= maxLength) {
    return upperText;
  }

  return `${upperText.slice(0, Math.max(0, maxLength - 1))}~`;
}
