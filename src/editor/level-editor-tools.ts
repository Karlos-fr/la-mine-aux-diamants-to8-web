/**
 * Role: Regroupe les operations d'interaction de l'editeur de niveaux.
 * Scope: Convertit le pointeur en cellule et applique les outils sans connaitre le rendu.
 * ISO: Toutes les modifications restent en coordonnees discretes de grille 16x16.
 * Notes: Le module evite de concentrer la logique d'edition dans la scene.
 */

import type { PointerInputState } from "../engine/input";
import type { ModernEntityType, ModernTileType } from "../game/level-loader";
import { getWorldTileDefinition } from "../worlds/world-registry";
import type { LevelEditorTool } from "./level-editor-palette";
import {
  EDITOR_TILE_SIZE,
  clearEditableEntityAt,
  clearEditableTileAt,
  isInsideEditableLevel,
  setEditableEntityAt,
  setEditableExit,
  setEditablePlayerSpawn,
  setEditableTileAt,
  type EditableLevelState
} from "./level-editor-state";

/** Pas de zoom autorises: chaque valeur produit une taille de tuile entiere. */
export const LEVEL_EDITOR_ZOOM_STEPS = [0.5, 1, 2] as const;

/** Viewport de grille propre a l'editeur. */
export interface LevelEditorViewport {
  /** Coordonne X ecran du coin haut gauche de grille. */
  gridX: number;

  /** Coordonne Y ecran du coin haut gauche de grille. */
  gridY: number;

  /** Nombre de colonnes visibles. */
  visibleColumns: number;

  /** Nombre de lignes visibles. */
  visibleRows: number;

  /** Decalage colonne dans le niveau complet. */
  offsetX: number;

  /** Decalage ligne dans le niveau complet. */
  offsetY: number;

  /** Facteur de zoom entier ou demi-entier. */
  zoom: number;
}

/** Cellule de niveau sous le pointeur. */
export interface LevelEditorPointerCell {
  /** Coordonne X dans le niveau complet. */
  readonly x: number;

  /** Coordonne Y dans le niveau complet. */
  readonly y: number;
}

/** Etat minimal d'un outil rectangle. */
export interface LevelEditorRectangleDraft {
  /** Premiere cellule du rectangle. */
  readonly start: LevelEditorPointerCell;

  /** Derniere cellule connue du rectangle. */
  readonly end: LevelEditorPointerCell;
}

/** Convertit le pointeur logique en cellule de niveau. */
export function pointerToEditorCell(
  pointer: PointerInputState,
  viewport: LevelEditorViewport
): LevelEditorPointerCell | null {
  if (!pointer.inside) {
    return null;
  }

  const scaledTileSize = getEditorViewportTileSize(viewport);
  const localX = pointer.x - viewport.gridX;
  const localY = pointer.y - viewport.gridY;
  if (localX < 0 || localY < 0) {
    return null;
  }

  const visibleX = Math.floor(localX / scaledTileSize);
  const visibleY = Math.floor(localY / scaledTileSize);
  if (visibleX < 0 || visibleY < 0 || visibleX >= viewport.visibleColumns || visibleY >= viewport.visibleRows) {
    return null;
  }

  return {
    x: viewport.offsetX + visibleX,
    y: viewport.offsetY + visibleY
  };
}

/** Applique un outil simple sur une cellule. */
export function applyEditorToolAtCell(
  state: EditableLevelState,
  tool: LevelEditorTool,
  tile: ModernTileType,
  cell: LevelEditorPointerCell
): void {
  if (!isInsideEditableLevel(state, cell.x, cell.y)) {
    return;
  }

  if (tool === "eraser") {
    clearEditableTileAt(state, cell.x, cell.y);
    return;
  }

  if (tool === "spawn") {
    setEditablePlayerSpawn(state, cell);
    return;
  }

  if (tool === "exit") {
    setEditableExit(state, cell);
    return;
  }

  if (tool === "pencil") {
    setEditableTileAt(state, cell.x, cell.y, tile);
    const entityType = getEditableEntityType(tile);
    if (entityType) {
      setEditableEntityAt(state, cell.x, cell.y, entityType);
    } else {
      clearEditableEntityAt(state, cell.x, cell.y);
    }
  }
}

/** Remplit un rectangle inclusif avec la tuile courante. */
export function applyEditorRectangle(
  state: EditableLevelState,
  tile: ModernTileType,
  draft: LevelEditorRectangleDraft
): void {
  const minX = Math.min(draft.start.x, draft.end.x);
  const maxX = Math.max(draft.start.x, draft.end.x);
  const minY = Math.min(draft.start.y, draft.end.y);
  const maxY = Math.max(draft.start.y, draft.end.y);

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      setEditableTileAt(state, x, y, tile);
      const entityType = getEditableEntityType(tile);
      if (entityType) {
        setEditableEntityAt(state, x, y, entityType);
      } else {
        clearEditableEntityAt(state, x, y);
      }
    }
  }
}

/** Retourne l'entite a exporter quand une tuile moderne est aussi un sprite vivant. */
function getEditableEntityType(tile: ModernTileType): ModernEntityType | null {
  return getWorldTileDefinition(tile)?.entityId ?? null;
}

/** Deplace la vue de grille avec les axes clavier. */
export function panEditorViewport(viewport: LevelEditorViewport, state: EditableLevelState, dx: number, dy: number): void {
  viewport.offsetX = clamp(viewport.offsetX + dx, 0, Math.max(0, state.width - viewport.visibleColumns));
  viewport.offsetY = clamp(viewport.offsetY + dy, 0, Math.max(0, state.height - viewport.visibleRows));
}

/** Applique un zoom discret autour de la grille. */
export function zoomEditorViewport(viewport: LevelEditorViewport, wheelDeltaY: number): void {
  if (wheelDeltaY === 0) {
    return;
  }

  const currentIndex = LEVEL_EDITOR_ZOOM_STEPS.reduce((nearestIndex, zoom, index) => {
    return Math.abs(zoom - viewport.zoom) < Math.abs(LEVEL_EDITOR_ZOOM_STEPS[nearestIndex] - viewport.zoom) ? index : nearestIndex;
  }, 0);
  const nextIndex = wheelDeltaY < 0 ? currentIndex + 1 : currentIndex - 1;
  viewport.zoom = LEVEL_EDITOR_ZOOM_STEPS[clamp(nextIndex, 0, LEVEL_EDITOR_ZOOM_STEPS.length - 1)];
}

/** Retourne la taille de tuile effectivement dessinee pour le viewport. */
export function getEditorViewportTileSize(_viewport: Pick<LevelEditorViewport, "zoom">): number {
  return EDITOR_TILE_SIZE;
}

/** Contraint une valeur numerique entre deux bornes. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
