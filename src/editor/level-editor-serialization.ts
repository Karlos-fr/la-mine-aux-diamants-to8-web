/**
 * Role: Convertit les niveaux editables vers et depuis le JSON moderne.
 * Scope: Produit un export stable, sans adresse ASM ni donnee derivee inutile.
 * ISO: Le format exporte reste celui du portage moderne, pas le format binaire TO8.
 * Notes: Les erreurs d'import restent explicites pour guider l'IHM editeur.
 */

import type {
  ModernEntityType,
  ModernLevelCell,
  ModernLevelJson,
  ModernLevelSourceKind,
  ModernTileType
} from "../game/level-loader";
import {
  EDITOR_TILE_SIZE,
  createEmptyEditableLevelState,
  getEditableExplicitTiles,
  setEditableTileAt,
  sortEditableCellsByGridPosition,
  type EditableLevelState
} from "./level-editor-state";

/** Erreur specialisee pour les imports JSON editeur invalides. */
export class LevelEditorSerializationError extends Error {
  /** Cree une erreur d'import/export lisible par l'IHM. */
  constructor(message: string) {
    super(message);
    this.name = "LevelEditorSerializationError";
  }
}

/** Exporte l'etat editable vers un objet JSON moderne stable. */
export function exportEditableLevelToJson(state: EditableLevelState): ModernLevelJson {
  return {
    schemaVersion: state.schemaVersion,
    id: state.id,
    label: state.label,
    width: state.width,
    height: state.height,
    tileSize: state.tileSize,
    defaultTile: state.defaultTile,
    time: state.time,
    scoreStep: state.scoreStep,
    requiredDiamonds: state.requiredDiamonds,
    playerSpawn: { ...state.playerSpawn },
    exit: { ...state.exit },
    tiles: getEditableExplicitTiles(state),
    entities: [...state.entities].sort(sortEditableCellsByGridPosition),
    source: {
      kind: normalizeExportSourceKind(state.sourceKind),
      note: "Niveau cree depuis l'editeur moderne."
    }
  };
}

/** Exporte l'etat editable sous forme de chaine JSON lisible. */
export function stringifyEditableLevel(state: EditableLevelState): string {
  return `${JSON.stringify(exportEditableLevelToJson(state), null, 2)}\n`;
}

/** Importe et normalise un objet JSON moderne dans l'etat editable. */
export function importEditableLevelFromJson(source: unknown): EditableLevelState {
  const json = assertModernLevelJsonLike(source);
  const state = createEmptyEditableLevelState();
  state.schemaVersion = 1;
  state.id = json.id;
  state.label = json.label;
  state.width = json.width;
  state.height = json.height;
  state.tileSize = json.tileSize;
  state.defaultTile = json.defaultTile;
  state.time = json.time;
  state.scoreStep = json.scoreStep;
  state.requiredDiamonds = json.requiredDiamonds;
  state.playerSpawn = { ...json.playerSpawn };
  state.exit = { ...json.exit };
  state.sourceKind = json.source?.kind ?? "custom";
  state.tilesByKey.clear();
  for (const tile of json.tiles) {
    setEditableTileAt(state, tile.x, tile.y, tile.type);
  }
  state.entities = [...json.entities].sort(sortEditableCellsByGridPosition);
  return state;
}

/** Parse une chaine JSON et retourne un etat editable normalise. */
export function parseEditableLevelJson(text: string): EditableLevelState {
  try {
    return importEditableLevelFromJson(JSON.parse(text));
  } catch (error) {
    if (error instanceof LevelEditorSerializationError) {
      throw error;
    }

    throw new LevelEditorSerializationError("JSON invalide ou illisible.");
  }
}

/** Normalise la nature exportee pour rester compatible avec le loader actuel. */
function normalizeExportSourceKind(kind: ModernLevelSourceKind | "custom"): ModernLevelSourceKind {
  return kind === "custom" ? "debug" : kind;
}

/** Valide minimalement la forme d'un niveau moderne importable. */
function assertModernLevelJsonLike(source: unknown): ModernLevelJson {
  if (!isRecord(source)) {
    throw new LevelEditorSerializationError("Le niveau importe doit etre un objet JSON.");
  }

  const requiredStrings = ["id", "label", "defaultTile"];
  for (const field of requiredStrings) {
    if (typeof source[field] !== "string") {
      throw new LevelEditorSerializationError(`Champ texte manquant ou invalide: ${field}.`);
    }
  }

  const requiredNumbers = ["width", "height", "time", "scoreStep", "requiredDiamonds"];
  for (const field of requiredNumbers) {
    if (typeof source[field] !== "number" || !Number.isFinite(source[field])) {
      throw new LevelEditorSerializationError(`Champ numerique manquant ou invalide: ${field}.`);
    }
  }

  const tileSize = typeof source.tileSize === "number" ? source.tileSize : EDITOR_TILE_SIZE;
  if (!isGridPoint(source.playerSpawn)) {
    throw new LevelEditorSerializationError("Champ playerSpawn manquant ou invalide.");
  }

  if (!isGridPoint(source.exit)) {
    throw new LevelEditorSerializationError("Champ exit manquant ou invalide.");
  }

  const tiles = assertCells(source.tiles, "tiles", isModernTileType);
  const entities = assertCells(source.entities ?? [], "entities", isModernEntityType);
  const id = source.id as string;
  const label = source.label as string;
  const width = source.width as number;
  const height = source.height as number;
  const time = source.time as number;
  const scoreStep = source.scoreStep as number;
  const requiredDiamonds = source.requiredDiamonds as number;

  return {
    schemaVersion: 1,
    id,
    label,
    width,
    height,
    tileSize,
    defaultTile: assertModernTileType(source.defaultTile),
    time,
    scoreStep,
    requiredDiamonds,
    playerSpawn: { x: source.playerSpawn.x, y: source.playerSpawn.y },
    exit: { x: source.exit.x, y: source.exit.y },
    tiles,
    entities,
    source: isRecord(source.source)
      ? {
          kind: isModernLevelSourceKind(source.source.kind) ? source.source.kind : undefined,
          note: typeof source.source.note === "string" ? source.source.note : undefined
        }
      : undefined
  };
}

/** Valide une collection de cellules typees. */
function assertCells<TType extends string>(
  value: unknown,
  fieldName: string,
  isType: (value: unknown) => value is TType
): ModernLevelCell<TType>[] {
  if (!Array.isArray(value)) {
    throw new LevelEditorSerializationError(`Champ ${fieldName} invalide: tableau attendu.`);
  }

  return value.map((cell, index) => {
    if (!isRecord(cell) || typeof cell.x !== "number" || typeof cell.y !== "number") {
      throw new LevelEditorSerializationError(`Cellule ${fieldName}[${index}] invalide.`);
    }

    const type = cell.type;
    if (!isType(type)) {
      throw new LevelEditorSerializationError(`Cellule ${fieldName}[${index}] invalide.`);
    }

    return { x: cell.x, y: cell.y, type };
  }).sort(sortEditableCellsByGridPosition);
}

/** Valide et retourne un type de tuile moderne. */
function assertModernTileType(value: unknown): ModernTileType {
  if (!isModernTileType(value)) {
    throw new LevelEditorSerializationError(`Type de tuile non supporte: ${String(value)}.`);
  }

  return value;
}

/** Indique si une valeur est un type de tuile moderne supporte. */
function isModernTileType(value: unknown): value is ModernTileType {
  return (
    value === "empty" ||
    value === "earth" ||
    value === "rock" ||
    value === "diamond" ||
    value === "monster" ||
    value === "border" ||
    value === "platform" ||
    value === "specialCreature" ||
    value === "transformerBlock"
  );
}

/** Indique si une valeur est un type d'entite moderne supporte. */
function isModernEntityType(value: unknown): value is ModernEntityType {
  return value === "diamond" || value === "monster" || value === "specialCreature";
}

/** Indique si une valeur est une nature de niveau supportee par le loader. */
function isModernLevelSourceKind(value: unknown): value is ModernLevelSourceKind {
  return value === "normal" || value === "debug" || value === "attract";
}

/** Indique si une valeur est une coordonnee de grille. */
function isGridPoint(value: unknown): value is { readonly x: number; readonly y: number } {
  return isRecord(value) && Number.isInteger(value.x) && Number.isInteger(value.y);
}

/** Indique si une valeur est un objet indexable. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
