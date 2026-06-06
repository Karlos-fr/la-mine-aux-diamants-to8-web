/**
 * Role: Centralise la direction graphique de l'editeur de niveaux.
 * Scope: Fournit couleurs, libelles et constantes visuelles propres a l'IHM editor.
 * ISO: Les couleurs restent proches du rendu TO8 tout en gardant une interface lisible.
 * Notes: Le rendu gameplay reste prioritaire pour les tuiles; ces couleurs servent de fallback.
 */

import { TO8_PALETTE } from "../assets/palette";
import type { ModernTileType } from "../game/level-loader";

/** Theme visuel principal de l'editeur. */
export const LEVEL_EDITOR_THEME = {
  /** Fond general noir cathodique. */
  background: TO8_PALETTE.black,
  /** Surface interne legerement verte. */
  panelDark: "#050c08",
  /** Surface de panneau secondaire. */
  panelWarm: "#151006",
  /** Contour principal jaune TO8. */
  primaryBorder: TO8_PALETTE.yellow,
  /** Accent cyan pour les valeurs et cadres actifs. */
  accent: TO8_PALETTE.cyan,
  /** Accent vert pour la grille. */
  grid: "#1c3a2a",
  /** Texte principal. */
  text: TO8_PALETTE.white,
  /** Texte selectionne. */
  selectedText: TO8_PALETTE.yellow,
  /** Marqueur d'erreur ou entite dangereuse. */
  danger: TO8_PALETTE.red
} as const;

/** Retourne une couleur fallback pour une tuile moderne quand l'atlas n'est pas disponible. */
export function editorTileFallbackColor(tile: ModernTileType | string): string {
  if (tile === "earth") return TO8_PALETTE.green;
  if (tile === "rock") return TO8_PALETTE.gray;
  if (tile === "diamond") return TO8_PALETTE.cyan;
  if (tile === "border") return TO8_PALETTE.blue;
  if (tile === "platform") return TO8_PALETTE.lightGreen;
  if (tile === "monster" || tile === "specialCreature") return TO8_PALETTE.red;
  if (tile === "transformerBlock") return TO8_PALETTE.magenta;
  return TO8_PALETTE.black;
}
