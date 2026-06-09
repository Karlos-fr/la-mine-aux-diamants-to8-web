/**
 * Role: Charge les JSON de niveaux modernes et les convertit en definitions runtime.
 * Scope: Valide le format moderne, mappe les types de tuiles vers les tile ids TO8 et cree les entites initiales.
 * ISO: Les tile ids produits renvoient aux constantes prouvees dans `runtime-tiles.ts`.
 * Notes: Le format JSON moderne reste sans adresse ASM et porte `exit` comme coordonnee logique separee.
 */

import type { EntityState, LevelDefinition, TileDefinition } from "./types";
import { RUNTIME_TILE } from "./runtime-tiles";
import {
  getWorldEntityDefinition,
  getWorldEntityDefinitions,
  getWorldTileDefinitions,
  isWorldEntityId,
  isWorldTileId,
  type WorldEntityId,
  type WorldTileId
} from "../worlds/world-registry";
import level01Json from "../assets/levels/level-01.json";
import level02Json from "../assets/levels/level-02.json";
import level03Json from "../assets/levels/level-03.json";
import level04Json from "../assets/levels/level-04.json";
import level05Json from "../assets/levels/level-05.json";
import level06Json from "../assets/levels/level-06.json";
import level07Json from "../assets/levels/level-07.json";
import level08Json from "../assets/levels/level-08.json";
import level09Json from "../assets/levels/level-09.json";
import level10Json from "../assets/levels/level-10.json";
import level11Json from "../assets/levels/level-11.json";
import level12Json from "../assets/levels/level-12.json";
import level13Json from "../assets/levels/level-13.json";
import level14Json from "../assets/levels/level-14.json";
import level15Json from "../assets/levels/level-15.json";
import level16Json from "../assets/levels/level-16.json";
import level17Json from "../assets/levels/level-17.json";
import level18Json from "../assets/levels/level-18.json";

/** Types de tuiles autorises dans les JSON modernes. */
export type ModernTileType = WorldTileId;
/** Types d'entites declarables dans les JSON modernes. */
export type ModernEntityType = WorldEntityId;
/** Nature documentaire d'un niveau moderne. */
export type ModernLevelSourceKind = "normal" | "debug" | "attract";

/** Coordonnees de grille modernes, sans adresse ASM. */
export interface ModernGridPoint {
  /** Colonne de grille. */
  readonly x: number;
  /** Ligne de grille. */
  readonly y: number;
}

/** Cellule moderne typee, utilisee pour tuiles et entites. */
export interface ModernLevelCell<TType extends string> extends ModernGridPoint {
  /** Type moderne de la cellule. */
  readonly type: TType;
}

/**
 * Format JSON moderne editable d'un niveau.
 *
 * Schema attendu:
 * `id` et `label` identifient le niveau, `width`/`height`/`tileSize`
 * definissent la grille, `defaultTile` remplit toute la carte, `tiles`
 * surcharge les cellules explicites, `entities` place les entites animees,
 * `playerSpawn`, `exit` et `initialViewport` restent des coordonnees logiques separees.
 */
export interface ModernLevelJson {
  /** Version du schema JSON moderne. */
  readonly schemaVersion?: number;
  /** Identifiant stable du niveau. */
  readonly id: string;
  /** Libelle humain affiche/documentaire. */
  readonly label: string;
  /** Auteur ou equipe de creation du niveau. */
  readonly author: string;
  /** Date de creation ou de sortie associee au niveau, au format `YYYY-MM-DD`. */
  readonly createdDate: string;
  /** Largeur logique en cellules. */
  readonly width: number;
  /** Hauteur logique en cellules. */
  readonly height: number;
  /** Taille d'une cellule en pixels. */
  readonly tileSize: number;
  /** Tuile par defaut de la grille avant application des cellules explicites. */
  readonly defaultTile: ModernTileType;
  /** Temps initial du niveau. */
  readonly time: number;
  /** Score ajoute par diamant. */
  readonly scoreStep: number;
  /** Nombre de diamants requis pour ouvrir la sortie. */
  readonly requiredDiamonds: number;
  /** Position joueur initiale en coordonnees de grille. */
  readonly playerSpawn: ModernGridPoint;
  /** Position sortie en coordonnees de grille. */
  readonly exit: ModernGridPoint;
  /** Origine viewport initiale issue du header original quand elle existe. */
  readonly initialViewport?: ModernGridPoint;
  /** Tuiles explicites differant de la tuile par defaut. */
  readonly tiles: ReadonlyArray<ModernLevelCell<ModernTileType>>;
  /** Entites placees dans le niveau. */
  readonly entities: ReadonlyArray<ModernLevelCell<ModernEntityType>>;
  /** Metadonnees facultatives de provenance, conservees pour les niveaux speciaux/debug. */
  readonly source?: {
    /** Nature fonctionnelle du niveau moderne. */
    readonly kind?: ModernLevelSourceKind;
    /** Index ASM d'origine quand il existe. */
    readonly originalLevelIndex?: string;
    /** Adresse ASM du niveau encode quand elle existe. */
    readonly originalAddress?: string;
    /** Valeur galerie/HUD originale quand elle differe de l'index technique. */
    readonly originalGalleryValue?: string;
    /** Note documentaire courte. */
    readonly note?: string;
  };
}

/** Sources JSON brutes importees par Vite avant validation runtime legere. */
const RAW_LEVEL_SOURCES = [
  level01Json,
  level02Json,
  level03Json,
  level04Json,
  level05Json,
  level06Json,
  level07Json,
  level08Json,
  level09Json,
  level10Json,
  level11Json,
  level12Json,
  level13Json,
  level14Json,
  level15Json,
  level16Json,
  level17Json,
  level18Json
] as readonly unknown[];

/** Niveaux modernes valides au chargement du module. */
const LEVEL_SOURCES = RAW_LEVEL_SOURCES.map((source, index) => validateModernLevelJson(source, index + 1));

/** Conversion des types modernes vers les tile ids runtime prouves. */
const TILE_IDS_BY_TYPE = Object.fromEntries(
  getWorldTileDefinitions().map((tile) => [tile.id, tile.runtimeTileId])
) as Readonly<Record<ModernTileType, number>>;

/** Tile ids qui definissent un rocher dans les definitions de tuile. */
const ROCK_TILE_IDS: readonly number[] = [RUNTIME_TILE.rock];
/** Tile ids solides de type mur/terrain. */
const WALL_TILE_IDS: readonly number[] = getWorldTileDefinitions()
  .filter((tile) => tile.behavior === "earth" || tile.behavior === "platform")
  .map((tile) => tile.runtimeTileId);
/** Tile ids collectible diamant. */
const DIAMOND_TILE_IDS: readonly number[] = [RUNTIME_TILE.diamond];
/** Tile ids representant une sortie/bloc protege dans le runtime courant. */
const EXIT_TILE_IDS: readonly number[] = [RUNTIME_TILE.border];
/** Tile ids de monstre initial. */
const MONSTER_TILE_IDS: readonly number[] = [RUNTIME_TILE.monster];
/** Tile ids de creature speciale, distincte du monstre standard `0x02`. */
const SPECIAL_CREATURE_TILE_IDS: readonly number[] = [RUNTIME_TILE.specialCreature];
/** Tile ids de bloc transformateur fixe. */
const TRANSFORMER_BLOCK_TILE_IDS: readonly number[] = [RUNTIME_TILE.transformerBlock];
/** Tile ids vides. */
const EMPTY_TILE_IDS: readonly number[] = [RUNTIME_TILE.empty];

/** Nombre de niveaux modernes disponibles. */
export const LEVEL_COUNT = LEVEL_SOURCES.length;
/** Nombre de galeries appartenant a la progression normale originale. */
export const NORMAL_LEVEL_COUNT = 16;

/** Retourne le JSON moderne valide d'un niveau, ou `undefined` si absent. */
export function getModernLevelSource(levelNumber: number): ModernLevelJson | undefined {
  return LEVEL_SOURCES[levelNumber - 1];
}

/** Charge et convertit un niveau moderne en definition runtime jouable. */
export function loadLevelDefinition(levelNumber: number): LevelDefinition {
  const levelSource = getModernLevelSource(levelNumber);
  if (!levelSource) {
    throw new Error(`Niveau non pris en charge: ${levelNumber}`);
  }

  return buildLevelDefinition(levelSource, levelNumber);
}

/** Convertit un JSON moderne deja valide en `LevelDefinition` runtime. */
export function buildLevelDefinition(level: ModernLevelJson, levelNumber: number): LevelDefinition {
  const tileSize = level.tileSize;
  const tiles = buildTilesFromModernLevel(level);
  const entities = getWorldEntityDefinitions()
    .flatMap((definition) => createEntityStatesFromModernType(level, definition.id, tileSize));

  return {
    id: level.id,
    name: level.label,
    width: level.width,
    height: level.height,
    tileSize,
    tiles,
    tileDefinitions: buildTileDefinitionsFromRows(tiles, level.scoreStep),
    initialEntities: [
      {
        id: "player",
        kind: "player",
        gridX: level.playerSpawn.x,
        gridY: level.playerSpawn.y,
        x: level.playerSpawn.x * tileSize,
        y: level.playerSpawn.y * tileSize,
        width: tileSize,
        height: tileSize,
        spriteFrameId: "player-idle",
        active: true
      },
      ...entities
    ],
    playerStart: {
      x: level.playerSpawn.x,
      y: level.playerSpawn.y
    },
    exit: {
      x: level.exit.x,
      y: level.exit.y
    },
    initialViewport: level.initialViewport
      ? {
          x: level.initialViewport.x,
          y: level.initialViewport.y
        }
      : undefined,
    meta: {
      timeLimit: level.time,
      gallery: parseOptionalHexByte(level.source?.originalGalleryValue) ?? levelNumber,
      requiredDiamonds: level.requiredDiamonds,
      scoreStep: level.scoreStep,
      nextLevelId: levelNumber < NORMAL_LEVEL_COUNT ? LEVEL_SOURCES[levelNumber].id : undefined
    }
  };
}

/** Cree les definitions de tuiles uniquement pour les tile ids presents dans la grille. */
function buildTileDefinitionsFromRows(tiles: readonly number[], scoreStep: number): Record<number, TileDefinition> {
  const definitions: Record<number, TileDefinition> = {};
  const uniqueTileIds = [...new Set(tiles)];
  uniqueTileIds.forEach((tileId) => {
    definitions[tileId] = createTileDefinition(tileId, scoreStep);
  });

  return definitions;
}

/** Cree une definition descriptive pour un tile id runtime donne. */
function createTileDefinition(tileId: number, scoreStep: number): TileDefinition {
  if (ROCK_TILE_IDS.includes(tileId)) {
    return {
      id: tileId,
      name: "rock",
      collision: "solid",
      tileFrameId: `tile:${tileId}`
    };
  }

  if (WALL_TILE_IDS.includes(tileId)) {
    return {
      id: tileId,
      name: "wall",
      collision: "solid",
      tileFrameId: `tile:${tileId}`
    };
  }

  if (DIAMOND_TILE_IDS.includes(tileId)) {
    return {
      id: tileId,
      name: "diamond",
      collision: "empty",
      collectible: {
        score: scoreStep,
        counter: "diamonds"
      },
      tileFrameId: `tile:${tileId}`
    };
  }

  if (EXIT_TILE_IDS.includes(tileId)) {
    return {
      id: tileId,
      name: "exit",
      collision: "exit",
      tileFrameId: `tile:${tileId}`
    };
  }

  if (MONSTER_TILE_IDS.includes(tileId)) {
    return {
      id: tileId,
      name: "monster",
      collision: "hazard",
      tileFrameId: `tile:${tileId}`
    };
  }

  if (SPECIAL_CREATURE_TILE_IDS.includes(tileId)) {
    return {
      id: tileId,
      name: "specialCreature",
      collision: "hazard",
      tileFrameId: `tile:${tileId}`
    };
  }

  if (TRANSFORMER_BLOCK_TILE_IDS.includes(tileId)) {
    return {
      id: tileId,
      name: "transformerBlock",
      collision: "solid",
      tileFrameId: `tile:${tileId}`
    };
  }

  if (EMPTY_TILE_IDS.includes(tileId)) {
    return {
      id: tileId,
      name: "empty",
      collision: "empty",
      tileFrameId: `tile:${tileId}`
    };
  }

  return {
    id: tileId,
    name: "tile",
    collision: "empty",
    tileFrameId: `tile:${tileId}`
  };
}

/** Construit la grille aplatie de tile ids runtime depuis les cellules modernes. */
function buildTilesFromModernLevel(level: ModernLevelJson): number[] {
  const defaultTileId = TILE_IDS_BY_TYPE[level.defaultTile];
  const tiles = Array.from({ length: level.width * level.height }, () => defaultTileId);

  for (const tile of level.tiles) {
    tiles[tile.y * level.width + tile.x] = TILE_IDS_BY_TYPE[tile.type];
  }

  return tiles;
}

/** Cree les entites runtime associees a un type moderne via le registre de mondes. */
function createEntityStatesFromModernType(level: ModernLevelJson, type: ModernEntityType, tileSize: number): EntityState[] {
  const definition = getWorldEntityDefinition(type);
  if (!definition) {
    return [];
  }

  return findEntityPositions(level, type).map((position, index) => ({
    id: `${type}-${index}`,
    kind: definition.runtimeKind,
    gridX: position.x,
    gridY: position.y,
    x: position.x * tileSize,
    y: position.y * tileSize,
    width: tileSize,
    height: tileSize,
    spriteFrameId: definition.spriteFrameId,
    active: true
  }));
}

/** Extrait les positions des entites d'un type donne depuis le JSON moderne. */
function findEntityPositions(level: ModernLevelJson, type: ModernEntityType): ModernGridPoint[] {
  return level.entities
    .filter((entity) => entity.type === type)
    .map((entity) => ({ x: entity.x, y: entity.y }));
}

/** Convertit une chaine hexadecimale optionnelle de provenance en octet numerique. */
function parseOptionalHexByte(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 16);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/** Valide legerement un JSON de niveau et retourne une structure typee. */
function validateModernLevelJson(source: unknown, levelNumber: number): ModernLevelJson {
  const level = expectRecord(source, `level ${levelNumber}`);
  const width = expectPositiveInteger(level.width, levelNumber, "width");
  const height = expectPositiveInteger(level.height, levelNumber, "height");
  const tileSize = expectPositiveInteger(level.tileSize, levelNumber, "tileSize");

  return {
    id: expectString(level.id, levelNumber, "id"),
    label: expectString(level.label, levelNumber, "label"),
    author: expectString(level.author, levelNumber, "author"),
    createdDate: expectIsoDateString(level.createdDate, levelNumber, "createdDate"),
    width,
    height,
    tileSize,
    defaultTile: expectModernTileType(level.defaultTile, levelNumber, "defaultTile"),
    time: expectNonNegativeInteger(level.time, levelNumber, "time"),
    scoreStep: expectNonNegativeInteger(level.scoreStep, levelNumber, "scoreStep"),
    requiredDiamonds: expectNonNegativeInteger(level.requiredDiamonds, levelNumber, "requiredDiamonds"),
    playerSpawn: expectGridPoint(level.playerSpawn, levelNumber, "playerSpawn", width, height),
    exit: expectGridPoint(level.exit, levelNumber, "exit", width, height),
    initialViewport: expectOptionalGridPoint(level.initialViewport, levelNumber, "initialViewport", width, height),
    tiles: expectLevelCells(level.tiles, levelNumber, "tiles", width, height, expectModernTileType),
    entities: expectLevelCells(level.entities, levelNumber, "entities", width, height, expectModernEntityType),
    source: expectOptionalLevelSource(level.source, levelNumber)
  };
}

/** Valide les metadonnees facultatives de provenance d'un niveau moderne. */
function expectOptionalLevelSource(source: unknown, levelNumber: number): ModernLevelJson["source"] {
  if (source === undefined) {
    return undefined;
  }

  const record = expectRecord(source, `level ${levelNumber}.source`);
  const kind = record.kind;
  if (kind !== undefined && kind !== "normal" && kind !== "debug" && kind !== "attract") {
    throw new Error(`Niveau ${levelNumber}: source.kind contient une valeur inconnue: ${String(kind)}.`);
  }
  const validatedKind = kind as ModernLevelSourceKind | undefined;

  return {
    kind: validatedKind,
    originalLevelIndex: expectOptionalString(record.originalLevelIndex, levelNumber, "source.originalLevelIndex"),
    originalAddress: expectOptionalString(record.originalAddress, levelNumber, "source.originalAddress"),
    originalGalleryValue: expectOptionalString(record.originalGalleryValue, levelNumber, "source.originalGalleryValue"),
    note: expectOptionalString(record.note, levelNumber, "source.note")
  };
}

/** Valide un tableau de cellules modernes et leurs coordonnees. */
function expectLevelCells<TType extends string>(
  value: unknown,
  levelNumber: number,
  field: string,
  width: number,
  height: number,
  expectType: (value: unknown, levelNumber: number, field: string) => TType
): Array<ModernLevelCell<TType>> {
  if (!Array.isArray(value)) {
    throw new Error(`Niveau ${levelNumber}: ${field} doit etre un tableau.`);
  }

  return value.map((cell, index) => {
    const record = expectRecord(cell, `level ${levelNumber}.${field}[${index}]`);
    return {
      ...expectGridPoint(record, levelNumber, `${field}[${index}]`, width, height),
      type: expectType(record.type, levelNumber, `${field}[${index}].type`)
    };
  });
}

/** Valide une coordonnee de grille et ses bornes. */
function expectGridPoint(
  value: unknown,
  levelNumber: number,
  field: string,
  width: number,
  height: number
): ModernGridPoint {
  const point = expectRecord(value, `level ${levelNumber}.${field}`);
  const x = expectNonNegativeInteger(point.x, levelNumber, `${field}.x`);
  const y = expectNonNegativeInteger(point.y, levelNumber, `${field}.y`);
  if (x >= width || y >= height) {
    throw new Error(`Niveau ${levelNumber}: ${field} (${x}, ${y}) hors grille ${width}x${height}.`);
  }

  return { x, y };
}

/** Valide une coordonnee de grille facultative et ses bornes. */
function expectOptionalGridPoint(
  value: unknown,
  levelNumber: number,
  field: string,
  width: number,
  height: number
): ModernGridPoint | undefined {
  if (value === undefined) {
    return undefined;
  }

  return expectGridPoint(value, levelNumber, field, width, height);
}

/** Valide un type de tuile moderne sans accepter `exit` comme tuile placable. */
function expectModernTileType(value: unknown, levelNumber: number, field: string): ModernTileType {
  if (isWorldTileId(value)) {
    return value;
  }

  throw new Error(`Niveau ${levelNumber}: ${field} contient une tuile moderne inconnue: ${String(value)}.`);
}

/** Valide un type d'entite moderne. */
function expectModernEntityType(value: unknown, levelNumber: number, field: string): ModernEntityType {
  if (isWorldEntityId(value)) {
    return value;
  }

  throw new Error(`Niveau ${levelNumber}: ${field} contient une entite moderne inconnue: ${String(value)}.`);
}

/** Valide une chaine non vide. */
function expectString(value: unknown, levelNumber: number, field: string): string {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  throw new Error(`Niveau ${levelNumber}: ${field} doit etre une chaine non vide.`);
}

/** Valide une date ISO simple sans heure. */
function expectIsoDateString(value: unknown, levelNumber: number, field: string): string {
  const date = expectString(value, levelNumber, field);
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }

  throw new Error(`Niveau ${levelNumber}: ${field} doit etre une date ISO YYYY-MM-DD.`);
}

/** Valide une chaine facultative. */
function expectOptionalString(value: unknown, levelNumber: number, field: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return expectString(value, levelNumber, field);
}

/** Valide un entier strictement positif. */
function expectPositiveInteger(value: unknown, levelNumber: number, field: string): number {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  throw new Error(`Niveau ${levelNumber}: ${field} doit etre un entier positif.`);
}

/** Valide un entier positif ou nul. */
function expectNonNegativeInteger(value: unknown, levelNumber: number, field: string): number {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return value;
  }

  throw new Error(`Niveau ${levelNumber}: ${field} doit etre un entier positif ou nul.`);
}

/** Valide qu'une valeur inconnue est un objet indexable. */
function expectRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  throw new Error(`${label} doit etre un objet.`);
}
