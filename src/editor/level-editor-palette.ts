/**
 * Role: Decrit la palette de tuiles et d'outils de l'editeur.
 * Scope: Centralise libelles, hints et icones SVG utilises par l'IHM.
 * ISO: Les types de tuiles correspondent au format JSON moderne et aux tile ids runtime.
 * Notes: Les SVG restent decoratifs; la grille garde le rendu jeu comme source visuelle principale.
 */

import type { ModernTileType } from "../game/level-loader";
import { getWorldTileDefinitions, type WorldTileDefinition } from "../worlds/world-registry";

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
export const LEVEL_EDITOR_TILE_PALETTE: readonly LevelEditorPaletteItem[] = getWorldTileDefinitions()
  .filter((definition) => definition.id !== "empty")
  .map(createTileItemFromDefinition);

/** Palette des outils d'edition. */
export const LEVEL_EDITOR_TOOL_PALETTE: readonly LevelEditorPaletteItem[] = [
  createToolItem("tool-pencil", "Crayon", "Poser la tuile selectionnee.", "pencil", "pencil"),
  createToolItem("tool-eraser", "Gomme", "Remettre une cellule a la tuile par defaut.", "eraser", "eraser"),
  createToolItem("tool-rectangle", "Rectangle", "Remplir une zone rectangulaire.", "rectangle", "rectangle"),
  createToolItem("tool-selection", "Déplacement", "Se déplacer dans la carte avec la souris.", "selection", "move"),
  createToolItem("tool-spawn", "Départ joueur", "Placer le point de départ joueur.", "spawn", "spawn"),
  createToolItem("tool-exit", "Sortie", "Placer la sortie du niveau.", "exit", "exit")
];

/** Type de tuile selectionne par defaut. */
export const DEFAULT_EDITOR_TILE: ModernTileType = "earth";
/** Outil selectionne par defaut. */
export const DEFAULT_EDITOR_TOOL: LevelEditorTool = "pencil";

/** Cree une entree de palette de tuile depuis le registre des mondes. */
function createTileItemFromDefinition(definition: WorldTileDefinition): LevelEditorPaletteItem {
  return {
    id: `tile-${definition.id}`,
    kind: definition.entityId ? "entity" : "tile",
    label: definition.label,
    hint: definition.hint,
    tileType: definition.id,
    svg: createTileSvg(definition.fallbackColor)
  };
}

/** Cree une entree de palette d'outil. */
function createToolItem(
  id: string,
  label: string,
  hint: string,
  tool: LevelEditorTool,
  icon: EditorToolIcon
): LevelEditorPaletteItem {
  return {
    id,
    kind: tool === "spawn" || tool === "exit" ? "marker" : "tool",
    label,
    hint,
    tool,
    svg: createToolSvg(icon)
  };
}

/** Cree une icone SVG de tuile, volontairement simple et elegante. */
function createTileSvg(color: string): string {
  return `<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="2" width="12" height="12" rx="1" fill="${color}"/><path d="M3 11h10M5 5h6" stroke="#000" stroke-opacity=".35"/></svg>`;
}

/** Identifiants des icones SVG d'outils. */
type EditorToolIcon = "pencil" | "eraser" | "rectangle" | "move" | "spawn" | "exit" | "test";

/** Cree une icone SVG d'outil coloree et lisible. */
function createToolSvg(icon: EditorToolIcon): string {
  if (icon === "pencil") {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#ffd84d" d="M4 17.5 15.7 5.8l2.5 2.5L6.5 20H4z"/><path fill="#ff8b3d" d="m16.9 4.6 1.1-1.1a1.7 1.7 0 0 1 2.4 0l.1.1a1.7 1.7 0 0 1 0 2.4l-1.1 1.1z"/><path fill="#3b2b00" d="M4 17.5 6.5 20H4z"/></svg>`;
  }

  if (icon === "eraser") {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><g transform="rotate(-41 12 12)"><path fill="#2f4961" d="M5.2 15.2h13.1l-1.4 2.2H6.4z"/><path fill="#d94d55" d="M3.2 8.3h11.2a1.5 1.5 0 0 1 1.5 1.5v5.5H3.2a1.9 1.9 0 0 1-1.9-1.9v-3.2a1.9 1.9 0 0 1 1.9-1.9z"/><path fill="#e06368" d="M3.6 8.3h9.2v4.8H1.3v-2.9a1.9 1.9 0 0 1 1.9-1.9z"/><path fill="#c83d49" d="M1.3 13.1h11.5v2.2H3.2a1.9 1.9 0 0 1-1.9-1.9z"/><path fill="#5f7892" d="M14.4 8.3h4.2a3.1 3.1 0 0 1 3.1 3.1v.8a3.1 3.1 0 0 1-3.1 3.1h-4.2z"/><path fill="#4a657e" d="M14.4 13.1h7a3.1 3.1 0 0 1-2.8 2.2h-4.2z"/></g></svg>`;
  }

  if (icon === "rectangle") {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="15" height="12" rx="2" fill="#5dd8ff"/><path fill="none" stroke="#eaffff" stroke-width="1.7" stroke-dasharray="3 2" d="M7 8h9v6H7z"/><path fill="#1a5d7a" d="M4 17h15v2H4z"/></svg>`;
  }

  if (icon === "move") {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#7cff8a" d="M12 2 8.4 5.6h2.3v4.1H6.6V7.4L3 11l3.6 3.6v-2.3h4.1v4.1H8.4L12 20l3.6-3.6h-2.3v-4.1h4.1v2.3L21 11l-3.6-3.6v2.3h-4.1V5.6h2.3z"/></svg>`;
  }

  if (icon === "spawn") {
    return `<svg class="level-editor-pixel-tool-icon" viewBox="0 0 16 16" aria-hidden="true" shape-rendering="crispEdges"><path fill="#e79393" d="M5 0h1v1H5zM6 0h1v1H6zM9 0h1v1H9zM10 0h1v1H10zM4 1h1v1H4zM5 1h1v1H5zM6 1h1v1H6zM7 1h1v1H7zM8 1h1v1H8zM9 1h1v1H9zM10 1h1v1H10zM11 1h1v1H11zM3 2h1v1H3zM4 2h1v1H4zM7 2h1v1H7zM8 2h1v1H8zM11 2h1v1H11zM12 2h1v1H12zM3 3h1v1H3zM4 3h1v1H4zM7 3h1v1H7zM8 3h1v1H8zM11 3h1v1H11zM12 3h1v1H12zM3 4h1v1H3zM4 4h1v1H4zM5 4h1v1H5zM6 4h1v1H6zM7 4h1v1H7zM8 4h1v1H8zM9 4h1v1H9zM10 4h1v1H10zM11 4h1v1H11zM12 4h1v1H12zM4 5h1v1H4zM5 5h1v1H5zM6 5h1v1H6zM7 5h1v1H7zM8 5h1v1H8zM9 5h1v1H9zM10 5h1v1H10zM11 5h1v1H11z"/><path fill="#00ffff" d="M6 6h1v1H6zM7 6h1v1H7zM8 6h1v1H8zM9 6h1v1H9zM6 7h1v1H6zM7 7h1v1H7zM8 7h1v1H8zM9 7h1v1H9z"/><path fill="#ff0000" d="M5 8h1v1H5zM6 8h1v1H6zM7 8h1v1H7zM8 8h1v1H8zM9 8h1v1H9zM10 8h1v1H10zM4 9h1v1H4zM6 9h1v1H6zM7 9h1v1H7zM8 9h1v1H8zM9 9h1v1H9zM11 9h1v1H11zM4 10h1v1H4zM6 10h1v1H6zM7 10h1v1H7zM8 10h1v1H8zM9 10h1v1H9zM11 10h1v1H11zM5 11h1v1H5zM6 11h1v1H6zM7 11h1v1H7zM8 11h1v1H8zM9 11h1v1H9zM10 11h1v1H10z"/><path fill="#ef9300" d="M5 12h1v1H5zM6 12h1v1H6zM7 12h1v1H7zM8 12h1v1H8zM9 12h1v1H9zM10 12h1v1H10zM5 13h1v1H5zM10 13h1v1H10zM5 14h1v1H5zM10 14h1v1H10z"/><path fill="#cbcbcb" d="M3 15h1v1H3zM4 15h1v1H4zM5 15h1v1H5zM10 15h1v1H10zM11 15h1v1H11zM12 15h1v1H12z"/></svg>`;
  }

  if (icon === "exit") {
    return `<svg class="level-editor-pixel-tool-icon" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" shape-rendering="crispEdges"><rect width="24" height="24" fill="#0000ff"/><g fill="#ffff00"><rect x="3" y="3" width="3" height="3"/><rect x="9" y="3" width="3" height="3"/><rect x="15" y="3" width="3" height="3"/><rect x="21" y="3" width="3" height="3"/><rect x="3" y="9" width="3" height="3"/><rect x="9" y="9" width="3" height="3"/><rect x="15" y="9" width="3" height="3"/><rect x="21" y="9" width="3" height="3"/><rect x="3" y="15" width="3" height="3"/><rect x="9" y="15" width="3" height="3"/><rect x="15" y="15" width="3" height="3"/><rect x="21" y="15" width="3" height="3"/><rect x="3" y="21" width="3" height="3"/><rect x="9" y="21" width="3" height="3"/><rect x="15" y="21" width="3" height="3"/><rect x="21" y="21" width="3" height="3"/></g></svg>`;
  }

  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#53ff91" d="M8 5v14l11-7z"/><path fill="#1d6b40" d="M5 5h2v14H5z"/></svg>`;
}
