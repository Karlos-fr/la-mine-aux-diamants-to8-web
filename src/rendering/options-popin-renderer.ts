/**
 * Role: Rend la pop-in d'options commune au titre et au gameplay.
 * Scope: Fournit uniquement l'UX de navigation par categories, sans options actives.
 * ISO: Le style reste volontairement proche TO8: aplats, cadres pixels et font Thomson.
 */

import { THOMSON_8_BIT_FONT } from "../assets/generated/thomson-8-bit-font";
import { TO8_PALETTE } from "../assets/palette";
import { APP_VERSION } from "../app-version";
import { getDisplayModeLabel, getDisplayZoomLabel } from "../display-options";
import type { Renderer } from "../engine/renderer";

/** Categories prevues pour la future configuration. */
export const OPTIONS_MENU_CATEGORIES = [
  "General",
  "Affichage",
  "Audio",
  "Jeu",
  "Sauvegarde",
  "A propos"
] as const;

/** Nombre de categories affichables dans la pop-in. */
export const OPTIONS_MENU_CATEGORY_COUNT = OPTIONS_MENU_CATEGORIES.length;

/** Options de rendu de la pop-in. */
export interface OptionsPopinRenderOptions {
  /** Index de categorie actuellement selectionne. */
  readonly selectedCategoryIndex: number;
  /** Libelle contextuel affiche dans la zone de contenu. */
  readonly contextLabel: string;
}

const PANEL_WIDTH = 288;
const PANEL_HEIGHT = 172;
const TAB_WIDTH = 104;
const TITLE_Y_PADDING = 10;
const CONTENT_HEIGHT = 104;
const TEXT_SCALE = 1;
const TITLE_SCALE = 1;
const FONT_WIDTH = THOMSON_8_BIT_FONT.width;
const FONT_HEIGHT = THOMSON_8_BIT_FONT.height;
const GLYPHS = THOMSON_8_BIT_FONT.glyphs as Record<string, readonly string[]>;

/** Rend la pop-in d'options par-dessus la scene courante. */
export function renderOptionsPopin(renderer: Renderer, options: OptionsPopinRenderOptions): void {
  renderer.fillRect(0, 0, renderer.width, renderer.height, "rgba(0, 0, 0, 0.58)");

  const panelX = Math.floor((renderer.width - PANEL_WIDTH) / 2);
  const panelY = Math.floor((renderer.height - PANEL_HEIGHT) / 2);
  renderer.fillRect(panelX, panelY, PANEL_WIDTH, PANEL_HEIGHT, TO8_PALETTE.ink);
  renderer.strokeRect(panelX, panelY, PANEL_WIDTH, PANEL_HEIGHT, TO8_PALETTE.cyan);
  renderer.strokeRect(panelX + 2, panelY + 2, PANEL_WIDTH - 4, PANEL_HEIGHT - 4, TO8_PALETTE.blue);

  drawCenteredThomsonText(renderer, "Options", panelX, panelY + TITLE_Y_PADDING, PANEL_WIDTH, TO8_PALETTE.yellow, TITLE_SCALE);
  renderer.fillRect(panelX + 8, panelY + 28, PANEL_WIDTH - 16, 1, TO8_PALETTE.blue);

  const tabsX = panelX + 12;
  const tabsY = panelY + 38;
  const contentX = panelX + TAB_WIDTH + 22;
  const contentY = tabsY;
  const contentWidth = PANEL_WIDTH - TAB_WIDTH - 34;

  renderCategoryTabs(renderer, tabsX, tabsY, options.selectedCategoryIndex);

  renderer.strokeRect(contentX, contentY, contentWidth, CONTENT_HEIGHT, TO8_PALETTE.darkGray);
  renderer.fillRect(contentX + 1, contentY + 1, contentWidth - 2, CONTENT_HEIGHT - 2, "#080810");

  const selectedCategory = OPTIONS_MENU_CATEGORIES[options.selectedCategoryIndex] ?? OPTIONS_MENU_CATEGORIES[0];
  drawThomsonText(renderer, selectedCategory, contentX + 8, contentY + 10, TO8_PALETTE.white, TEXT_SCALE);
  if (selectedCategory === "A propos") {
    renderAboutContent(renderer, contentX + 8, contentY + 30);
  } else if (selectedCategory === "Affichage") {
    renderDisplayContent(renderer, contentX + 8, contentY + 30);
  } else {
    drawThomsonText(renderer, "Options a venir", contentX + 8, contentY + 34, TO8_PALETTE.gray, TEXT_SCALE);
    drawThomsonText(renderer, options.contextLabel, contentX + 8, contentY + 58, TO8_PALETTE.cyan, TEXT_SCALE);
  }

  renderer.fillRect(panelX + 8, panelY + PANEL_HEIGHT - 24, PANEL_WIDTH - 16, 1, TO8_PALETTE.blue);
  drawThomsonText(renderer, "Echap: retour", panelX + 14, panelY + PANEL_HEIGHT - 15, TO8_PALETTE.lightGreen, TEXT_SCALE);
  drawThomsonText(renderer, "Haut/bas: categorie", panelX + 124, panelY + PANEL_HEIGHT - 15, TO8_PALETTE.lightGreen, TEXT_SCALE);
}

/** Rend les options d'affichage deja actives. */
function renderDisplayContent(renderer: Renderer, x: number, y: number): void {
  const lines = [
    { text: "Mode", color: TO8_PALETTE.gray },
    { text: getDisplayModeLabel(), color: TO8_PALETTE.cyan },
    { text: "Zoom", color: TO8_PALETTE.gray },
    { text: getDisplayZoomLabel(), color: TO8_PALETTE.lightGreen },
    { text: "Entree: mode", color: TO8_PALETTE.white },
    { text: "< >: zoom", color: TO8_PALETTE.white }
  ] as const;

  lines.forEach((line, index) => {
    drawThomsonText(renderer, line.text, x, y + index * 12, line.color, TEXT_SCALE);
  });
}

/** Rend les credits et informations de version. */
function renderAboutContent(renderer: Renderer, x: number, y: number): void {
  const lines = [
    { text: "Jeu original 1986", color: TO8_PALETTE.gray },
    { text: "Philippe Bruneel", color: TO8_PALETTE.white },
    { text: "Christian Lemaire", color: TO8_PALETTE.white },
    { text: "Modification 2026", color: TO8_PALETTE.gray },
    { text: "github.com/Karlos-fr", color: TO8_PALETTE.cyan },
    { text: `Version ${APP_VERSION}`, color: TO8_PALETTE.lightGreen }
  ] as const;

  lines.forEach((line, index) => {
    drawThomsonText(renderer, line.text, x, y + index * 12, line.color, TEXT_SCALE);
  });
}

/** Rend la liste des categories de gauche. */
function renderCategoryTabs(renderer: Renderer, x: number, y: number, selectedIndex: number): void {
  for (let index = 0; index < OPTIONS_MENU_CATEGORIES.length; index += 1) {
    const tabY = y + index * 15;
    const selected = index === selectedIndex;
    if (selected) {
      renderer.fillRect(x, tabY - 2, TAB_WIDTH, 12, TO8_PALETTE.blue);
      renderer.strokeRect(x, tabY - 2, TAB_WIDTH, 12, TO8_PALETTE.cyan);
      drawThomsonText(renderer, ">", x + 4, tabY, TO8_PALETTE.yellow, TEXT_SCALE);
    }

    drawThomsonText(
      renderer,
      OPTIONS_MENU_CATEGORIES[index],
      x + (selected ? 14 : 8),
      tabY,
      selected ? TO8_PALETTE.white : TO8_PALETTE.gray,
      TEXT_SCALE
    );
  }
}

/** Centre un texte Thomson dans une largeur donnee. */
function drawCenteredThomsonText(renderer: Renderer, text: string, x: number, y: number, width: number, color: string, scale: number): void {
  const textWidth = measureThomsonText(text, scale);
  drawThomsonText(renderer, text, x + Math.floor((width - textWidth) / 2), y, color, scale);
}

/** Dessine du texte avec la font Thomson 8-bit procedurale. */
function drawThomsonText(renderer: Renderer, text: string, x: number, y: number, color: string, scale: number): void {
  let cursorX = Math.floor(x);
  for (const character of text) {
    const glyph = GLYPHS[character] ?? GLYPHS["?"];
    for (let row = 0; row < FONT_HEIGHT; row += 1) {
      const bits = glyph?.[row] ?? "";
      for (let column = 0; column < FONT_WIDTH; column += 1) {
        if (bits[column] === "1") {
          renderer.fillRect(cursorX + column * scale, y + row * scale, scale, scale, color);
        }
      }
    }
    cursorX += FONT_WIDTH * scale;
  }
}

/** Mesure une chaine rendue avec la font Thomson. */
function measureThomsonText(text: string, scale: number): number {
  return text.length * FONT_WIDTH * scale;
}
