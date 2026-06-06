/**
 * Role: Decrit la palette de tuiles et d'outils de l'editeur.
 * Scope: Centralise libelles, hints et icones SVG utilises par l'IHM.
 * ISO: Les types de tuiles correspondent au format JSON moderne et aux tile ids runtime.
 * Notes: Les SVG restent decoratifs; la grille garde le rendu jeu comme source visuelle principale.
 */

import type { ModernTileType } from "../game/level-loader";

/** Outils disponibles dans l'editeur. */
export type LevelEditorTool =
  | "pencil"
  | "eraser"
  | "rectangle"
  | "selection"
  | "spawn"
  | "exit"
  | "test";

/** Categorie de palette pour structurer l'IHM. */
export type LevelEditorPaletteKind = "tile" | "entity" | "marker" | "tool";

/** Entree de palette commune aux tuiles et outils. */
export interface LevelEditorPaletteItem {
  /** Identifiant stable de l'entree. */
  readonly id: string;
  /** Categorie fonctionnelle. */
  readonly kind: LevelEditorPaletteKind;
  /** Libelle court affiche dans l'IHM. */
  readonly label: string;
  /** Hint court explique a l'utilisateur. */
  readonly hint: string;
  /** Icone SVG inline elegante et themable. */
  readonly svg: string;
  /** Type de tuile associe quand l'entree pose une tuile. */
  readonly tileType?: ModernTileType;
  /** Outil associe quand l'entree change de mode. */
  readonly tool?: LevelEditorTool;
}

/** Palette des tuiles editables du niveau. */
export const LEVEL_EDITOR_TILE_PALETTE: readonly LevelEditorPaletteItem[] = [
  createTileItem("tile-empty", "Vide", "Case vide traversable.", "empty", "#101018"),
  createTileItem("tile-earth", "Terre creusable", "Terre creusable par le joueur.", "earth", "#28a840"),
  createTileItem("tile-rock", "Rocher", "Rocher soumis a la gravite.", "rock", "#909090"),
  createTileItem("tile-diamond", "Diamant", "Diamant collectable et anime.", "diamond", "#58c8f0"),
  createTileItem("tile-border", "Bordure", "Bordure solide du niveau.", "border", "#2450d8"),
  createTileItem("tile-platform", "Plateforme", "Plateforme solide verte.", "platform", "#78e060"),
  createTileItem("tile-monster", "Monstre", "Monstre standard mobile.", "monster", "#d83838"),
  createTileItem("tile-special", "Creature speciale", "Creature speciale 0x17.", "specialCreature", "#c050c8"),
  createTileItem("tile-transformer", "Bloc transformateur", "Bloc transformateur 0x18.", "transformerBlock", "#f0d050")
];

/** Palette des outils d'edition. */
export const LEVEL_EDITOR_TOOL_PALETTE: readonly LevelEditorPaletteItem[] = [
  createToolItem("tool-pencil", "Crayon", "Poser la tuile selectionnee.", "pencil", "#f0d050"),
  createToolItem("tool-eraser", "Gomme", "Remettre une cellule a la tuile par defaut.", "eraser", "#f5f5f5"),
  createToolItem("tool-rectangle", "Rectangle", "Remplir une zone rectangulaire.", "rectangle", "#58c8f0"),
  createToolItem("tool-selection", "Deplacement", "Se deplacer dans la carte avec la souris.", "selection", "#78e060"),
  createToolItem("tool-spawn", "Depart joueur", "Placer le point de depart joueur.", "spawn", "#d83838"),
  createToolItem("tool-exit", "Sortie", "Placer la sortie du niveau.", "exit", "#f0d050"),
  createToolItem("tool-test", "Tester le niveau", "Tester le niveau dans le runtime.", "test", "#67ff68")
];

/** Type de tuile selectionne par defaut. */
export const DEFAULT_EDITOR_TILE: ModernTileType = "earth";
/** Outil selectionne par defaut. */
export const DEFAULT_EDITOR_TOOL: LevelEditorTool = "pencil";

/** Cree une entree de palette de tuile. */
function createTileItem(
  id: string,
  label: string,
  hint: string,
  tileType: ModernTileType,
  color: string
): LevelEditorPaletteItem {
  return {
    id,
    kind: tileType === "monster" || tileType === "specialCreature" || tileType === "diamond" ? "entity" : "tile",
    label,
    hint,
    tileType,
    svg: createTileSvg(color)
  };
}

/** Cree une entree de palette d'outil. */
function createToolItem(
  id: string,
  label: string,
  hint: string,
  tool: LevelEditorTool,
  color: string
): LevelEditorPaletteItem {
  return {
    id,
    kind: tool === "spawn" || tool === "exit" ? "marker" : "tool",
    label,
    hint,
    tool,
    svg: createToolSvg(color)
  };
}

/** Cree une icone SVG de tuile, volontairement simple et elegante. */
function createTileSvg(color: string): string {
  return `<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="2" width="12" height="12" rx="1" fill="${color}"/><path d="M3 11h10M5 5h6" stroke="#000" stroke-opacity=".35"/></svg>`;
}

/** Cree une icone SVG d'outil, style curseur/etoile TO8 modernise. */
function createToolSvg(color: string): string {
  return `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="${color}"/><path d="M8 4v8M4 8h8" stroke="#000" stroke-opacity=".4"/></svg>`;
}
