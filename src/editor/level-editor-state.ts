/**
 * Role: Porte l'etat editable d'un niveau moderne.
 * Scope: Fournit une representation mutable en grille, compatible avec `ModernLevelJson`.
 * ISO: Le format reste sans adresse ASM; seules les coordonnees de grille modernes sont exposees.
 * Notes: Les mutations restent discretes, cellule par cellule, comme le runtime gameplay.
 */

import type {
  ModernEntityType,
  ModernGridPoint,
  ModernLevelCell,
  ModernLevelSourceKind,
  ModernTileType
} from "../game/level-loader";

/** Largeur par defaut d'un niveau editable. */
export const EDITOR_DEFAULT_LEVEL_WIDTH = 40;
/** Hauteur par defaut d'un niveau editable. */
export const EDITOR_DEFAULT_LEVEL_HEIGHT = 22;
/** Taille logique TO8 d'une tuile. */
export const EDITOR_TILE_SIZE = 16;

/** Cellule d'entite editable, conservee hors des tuiles explicites. */
export type EditableEntityCell = ModernLevelCell<ModernEntityType>;

/** Etat editable principal manipule par la scene editeur. */
export interface EditableLevelState {
  /** Version de schema exportee. */
  schemaVersion: 1;
  /** Identifiant stable du niveau. */
  id: string;
  /** Libelle humain du niveau. */
  label: string;
  /** Largeur en cellules. */
  width: number;
  /** Hauteur en cellules. */
  height: number;
  /** Taille d'une cellule en pixels logiques. */
  tileSize: number;
  /** Tuile implicite appliquee aux cellules sans surcharge. */
  defaultTile: ModernTileType;
  /** Temps initial. */
  time: number;
  /** Score ajoute par diamant. */
  scoreStep: number;
  /** Nombre de diamants requis. */
  requiredDiamonds: number;
  /** Position unique du joueur. */
  playerSpawn: ModernGridPoint;
  /** Position unique de sortie. */
  exit: ModernGridPoint;
  /** Tuiles explicites indexees par cle `x,y`. */
  tilesByKey: Map<string, ModernTileType>;
  /** Entites editables, separees des tuiles. */
  entities: EditableEntityCell[];
  /** Nature documentaire du niveau. */
  sourceKind: ModernLevelSourceKind | "custom";
}

/** Cree un niveau vide compatible avec le format JSON moderne. */
export function createEmptyEditableLevelState(): EditableLevelState {
  return {
    schemaVersion: 1,
    id: "level-custom-01",
    label: "Galerie custom",
    width: EDITOR_DEFAULT_LEVEL_WIDTH,
    height: EDITOR_DEFAULT_LEVEL_HEIGHT,
    tileSize: EDITOR_TILE_SIZE,
    defaultTile: "empty",
    time: 230,
    scoreStep: 15,
    requiredDiamonds: 0,
    playerSpawn: { x: 1, y: 1 },
    exit: { x: EDITOR_DEFAULT_LEVEL_WIDTH - 2, y: EDITOR_DEFAULT_LEVEL_HEIGHT - 2 },
    tilesByKey: new Map<string, ModernTileType>(),
    entities: [],
    sourceKind: "custom"
  };
}

/** Lit la tuile effective d'une cellule, en appliquant la tuile par defaut. */
export function getEditableTileAt(state: EditableLevelState, x: number, y: number): ModernTileType {
  return state.tilesByKey.get(createGridKey(x, y)) ?? state.defaultTile;
}

/** Pose une tuile explicite ou retire la surcharge si elle vaut la tuile par defaut. */
export function setEditableTileAt(state: EditableLevelState, x: number, y: number, tile: ModernTileType): void {
  if (!isInsideEditableLevel(state, x, y)) {
    return;
  }

  const key = createGridKey(x, y);
  if (tile === state.defaultTile) {
    state.tilesByKey.delete(key);
  } else {
    state.tilesByKey.set(key, tile);
  }
}

/** Retire la surcharge d'une cellule pour revenir a la tuile par defaut. */
export function clearEditableTileAt(state: EditableLevelState, x: number, y: number): void {
  state.tilesByKey.delete(createGridKey(x, y));
  clearEditableEntityAt(state, x, y);
}

/** Pose ou remplace une entite editable a une coordonnee donnee. */
export function setEditableEntityAt(state: EditableLevelState, x: number, y: number, type: ModernEntityType): void {
  if (!isInsideEditableLevel(state, x, y)) {
    return;
  }

  clearEditableEntityAt(state, x, y);
  state.entities.push({ x, y, type });
  state.entities.sort(sortEditableCellsByGridPosition);
}

/** Retire toute entite editable a une coordonnee donnee. */
export function clearEditableEntityAt(state: EditableLevelState, x: number, y: number): void {
  state.entities = state.entities.filter((entity) => entity.x !== x || entity.y !== y);
}

/** Deplace le spawn joueur en coordonnees discretes. */
export function setEditablePlayerSpawn(state: EditableLevelState, point: ModernGridPoint): void {
  if (isInsideEditableLevel(state, point.x, point.y)) {
    state.playerSpawn = { ...point };
  }
}

/** Deplace la sortie en coordonnees discretes. */
export function setEditableExit(state: EditableLevelState, point: ModernGridPoint): void {
  if (isInsideEditableLevel(state, point.x, point.y)) {
    state.exit = { ...point };
  }
}

/** Retourne les tuiles explicites dans un ordre stable. */
export function getEditableExplicitTiles(state: EditableLevelState): ModernLevelCell<ModernTileType>[] {
  return Array.from(state.tilesByKey.entries())
    .map(([key, type]) => {
      const [x, y] = parseGridKey(key);
      return { x, y, type };
    })
    .sort(sortEditableCellsByGridPosition);
}

/** Indique si une coordonnee appartient a la grille editable. */
export function isInsideEditableLevel(state: EditableLevelState, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < state.width && y < state.height;
}

/** Cree une cle stable pour une cellule de grille. */
function createGridKey(x: number, y: number): string {
  return `${x},${y}`;
}

/** Decode une cle de cellule de grille. */
function parseGridKey(key: string): readonly [number, number] {
  const [x, y] = key.split(",").map(Number);
  return [x, y];
}

/** Trie les cellules par ligne puis colonne pour produire un export stable. */
export function sortEditableCellsByGridPosition<TCell extends ModernGridPoint>(left: TCell, right: TCell): number {
  return left.y - right.y || left.x - right.x;
}

