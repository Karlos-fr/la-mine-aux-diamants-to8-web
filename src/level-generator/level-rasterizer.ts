/**
 * Role: Rasterise un layout structurel en grille de tuiles modernes.
 * Scope: Dessine macro-formes, couloirs, plateformes et bordures internes avant l'habillage gameplay.
 * ISO: La sortie reste une proposition moderne guidee par intention, sans copier les grilles TO8 originales.
 * Notes: Les roles de cellules sont conserves pour que scoring, habillage et reparations respectent la structure.
 */

import type { ModernLevelCell, ModernTileType } from "../game/level-loader";
import type {
  LevelLayout,
  LevelLayoutConnection,
  LevelLayoutPoint,
  LevelLayoutRect,
  LevelLayoutZone
} from "./level-layout";
import type { LevelPlanIntensity } from "./level-plan-graph";
import type { SeededRandom } from "./seeded-random";

/** Role structurel d'une cellule rasterisee. */
export type RasterizedCellRole =
  | "background"
  | "border"
  | "zone"
  | "connection"
  | "platform"
  | "internalWall"
  | "texture";

/** Grille de niveau issue de la rasterisation structurelle. */
export interface RasterizedLevelGrid {
  /** Largeur en cellules. */
  readonly width: number;
  /** Hauteur en cellules. */
  readonly height: number;
  /** Tuile par defaut conseillee pour serialiser le niveau moderne. */
  readonly defaultTile: ModernTileType;
  /** Grille complete des tuiles modernes. */
  readonly tiles: readonly (readonly ModernTileType[])[];
  /** Carte des roles structurels, separee des tuiles. */
  readonly roleMap: readonly (readonly RasterizedCellRole[])[];
  /** Tuiles explicites differentes de `defaultTile`, pretes pour `ModernLevelJson.tiles`. */
  readonly explicitTiles: readonly ModernLevelCell<ModernTileType>[];
  /** Metadonnees compactes pour debug et futur scoring. */
  readonly metadata: LevelRasterizerMetadata;
}

/** Metadonnees de rasterisation. */
export interface LevelRasterizerMetadata {
  /** Nombre de cellules vides. */
  readonly emptyCells: number;
  /** Nombre de cellules de terre. */
  readonly earthCells: number;
  /** Nombre de cellules plateforme. */
  readonly platformCells: number;
  /** Nombre de cellules bordure, internes incluses. */
  readonly borderCells: number;
  /** Ratio de cellules jouables ouvertes. */
  readonly openRatio: number;
  /** Resume lisible pour logs et debug. */
  readonly summary: string;
}

/** Tuile par defaut de la rasterisation: la terre donne une silhouette pleine puis creusee. */
const DEFAULT_RASTER_TILE: ModernTileType = "earth";
/** Bordure exterieure non jouable. */
const BORDER_TILE: ModernTileType = "border";
/** Vide traversable. */
const EMPTY_TILE: ModernTileType = "empty";
/** Plateforme solide de progression. */
const PLATFORM_TILE: ModernTileType = "platform";
/** Epaisseur maximum appliquee aux couloirs intenses. */
const MAX_CONNECTION_HALF_WIDTH = 1;

/** Rasterise un layout spatial en tuiles de base coherentes. */
export function rasterizeLevelLayout(layout: LevelLayout, random: SeededRandom): RasterizedLevelGrid {
  const tiles = createFilledGrid(layout.width, layout.height, DEFAULT_RASTER_TILE);
  const roleMap = createFilledGrid<RasterizedCellRole>(layout.width, layout.height, "background");
  drawOuterBorder(tiles, roleMap);
  drawConnections(layout.connections, tiles, roleMap);
  drawZones(layout.zones, tiles, roleMap, random.fork("zones"));
  addStructuralPlatforms(layout.zones, tiles, roleMap);
  addLocalVariations(layout.zones, tiles, roleMap, random.fork("variations"));
  const explicitTiles = createExplicitTiles(tiles, DEFAULT_RASTER_TILE);
  const metadata = createRasterizerMetadata(tiles);

  return {
    width: layout.width,
    height: layout.height,
    defaultTile: DEFAULT_RASTER_TILE,
    tiles,
    roleMap,
    explicitTiles,
    metadata
  };
}

/** Dessine la bordure exterieure du niveau. */
function drawOuterBorder(
  tiles: ModernTileType[][],
  roleMap: RasterizedCellRole[][]
): void {
  const width = tiles[0]?.length ?? 0;
  const height = tiles.length;
  for (let x = 0; x < width; x += 1) {
    setCell(tiles, roleMap, x, 0, BORDER_TILE, "border");
    setCell(tiles, roleMap, x, height - 1, BORDER_TILE, "border");
  }
  for (let y = 0; y < height; y += 1) {
    setCell(tiles, roleMap, 0, y, BORDER_TILE, "border");
    setCell(tiles, roleMap, width - 1, y, BORDER_TILE, "border");
  }
}

/** Dessine les couloirs entre zones avant les zones, pour conserver une macro-structure continue. */
function drawConnections(
  connections: readonly LevelLayoutConnection[],
  tiles: ModernTileType[][],
  roleMap: RasterizedCellRole[][]
): void {
  for (const connection of connections) {
    const halfWidth = getConnectionHalfWidth(connection.intensity);
    for (const point of connection.path) {
      fillDisc(tiles, roleMap, point, halfWidth, EMPTY_TILE, "connection");
    }
  }
}

/** Dessine les zones principales en respectant leur forme abstraite. */
function drawZones(
  zones: readonly LevelLayoutZone[],
  tiles: ModernTileType[][],
  roleMap: RasterizedCellRole[][],
  random: SeededRandom
): void {
  for (const zone of zones) {
    if (zone.shape === "ring") {
      drawRingZone(zone, tiles, roleMap);
    } else if (zone.shape === "corridor") {
      drawCorridorZone(zone, tiles, roleMap);
    } else if (zone.shape === "freeform") {
      drawFreeformZone(zone, tiles, roleMap, random.fork(zone.id));
    } else {
      drawRectangleZone(zone, tiles, roleMap);
    }
  }
}

/** Dessine une salle rectangulaire lisible. */
function drawRectangleZone(
  zone: LevelLayoutZone,
  tiles: ModernTileType[][],
  roleMap: RasterizedCellRole[][]
): void {
  fillRect(tiles, roleMap, shrinkRect(zone.rect, 1), EMPTY_TILE, "zone");
  if (zone.nodeKind === "implicitLock" || zone.nodeKind === "danger") {
    strokeRect(tiles, roleMap, zone.rect, BORDER_TILE, "internalWall");
  }
}

/** Dessine un couloir comme une zone longue et plus fine. */
function drawCorridorZone(
  zone: LevelLayoutZone,
  tiles: ModernTileType[][],
  roleMap: RasterizedCellRole[][]
): void {
  const rect = zone.rect.width >= zone.rect.height
    ? { ...zone.rect, y: zone.center.y, height: 1 }
    : { ...zone.rect, x: zone.center.x, width: 1 };
  fillRect(tiles, roleMap, rect, EMPTY_TILE, "zone");
}

/** Dessine une zone en anneau ou enceinte. */
function drawRingZone(
  zone: LevelLayoutZone,
  tiles: ModernTileType[][],
  roleMap: RasterizedCellRole[][]
): void {
  fillRect(tiles, roleMap, shrinkRect(zone.rect, 1), EMPTY_TILE, "zone");
  strokeRect(tiles, roleMap, zone.rect, BORDER_TILE, "internalWall");
  if (zone.rect.width >= 5 && zone.rect.height >= 5) {
    strokeRect(tiles, roleMap, shrinkRect(zone.rect, 2), PLATFORM_TILE, "platform");
  }
}

/** Dessine une zone organique tout en gardant une silhouette stable. */
function drawFreeformZone(
  zone: LevelLayoutZone,
  tiles: ModernTileType[][],
  roleMap: RasterizedCellRole[][],
  random: SeededRandom
): void {
  const rect = shrinkRect(zone.rect, 1);
  const radiusX = Math.max(1, rect.width / 2);
  const radiusY = Math.max(1, rect.height / 2);
  forEachCellInRect(rect, (x, y) => {
    const normalizedX = Math.abs(x - zone.center.x) / radiusX;
    const normalizedY = Math.abs(y - zone.center.y) / radiusY;
    const distance = normalizedX + normalizedY * 0.85;
    const stableEdgeNoise = random.fork(`${x},${y}`).next() * 0.22;
    if (distance <= 1.05 + stableEdgeNoise) {
      setPlayableCell(tiles, roleMap, x, y, EMPTY_TILE, "zone");
    }
  });
}

/** Ajoute des plateformes structurelles selon les archetypes, sans remplir toute la carte. */
function addStructuralPlatforms(
  zones: readonly LevelLayoutZone[],
  tiles: ModernTileType[][],
  roleMap: RasterizedCellRole[][]
): void {
  for (const zone of zones) {
    if (zone.archetype === "horizontalBands") {
      drawHorizontalPlatform(zone, tiles, roleMap, zone.rect.y + zone.rect.height - 2);
    } else if (zone.archetype === "verticalRoute") {
      const y = zone.rect.y + 1 + zone.rect.height % 2;
      drawHorizontalPlatform(zone, tiles, roleMap, y);
    } else if (zone.nodeKind === "reward" || zone.nodeKind === "diamondObjective") {
      drawHorizontalPlatform(zone, tiles, roleMap, zone.rect.y + zone.rect.height - 2);
    }
  }
}

/** Dessine une ligne de plateforme bornee a l'interieur d'une zone. */
function drawHorizontalPlatform(
  zone: LevelLayoutZone,
  tiles: ModernTileType[][],
  roleMap: RasterizedCellRole[][],
  y: number
): void {
  const fromX = zone.rect.x + 1;
  const toX = zone.rect.x + zone.rect.width - 2;
  for (let x = fromX; x <= toX; x += 1) {
    setPlayableCell(tiles, roleMap, x, y, PLATFORM_TILE, "platform");
  }
}

/** Ajoute des variations locales faibles sans casser les silhouettes principales. */
function addLocalVariations(
  zones: readonly LevelLayoutZone[],
  tiles: ModernTileType[][],
  roleMap: RasterizedCellRole[][],
  random: SeededRandom
): void {
  for (const zone of zones) {
    if (zone.archetype === "denseField" || zone.archetype === "maze") {
      addRepeatedEarthMotifs(zone, tiles, roleMap);
    }
    if (zone.shape === "rectangle" && zone.intensity !== "low") {
      addEdgeBreathing(zone, tiles, roleMap, random.fork(zone.id));
    }
  }
}

/** Ajoute de petits motifs repetes uniquement dans les zones denses/labyrinthiques. */
function addRepeatedEarthMotifs(
  zone: LevelLayoutZone,
  tiles: ModernTileType[][],
  roleMap: RasterizedCellRole[][]
): void {
  const step = zone.archetype === "maze" ? 3 : 4;
  for (let y = zone.rect.y + 2; y < zone.rect.y + zone.rect.height - 2; y += step) {
    for (let x = zone.rect.x + 2; x < zone.rect.x + zone.rect.width - 2; x += step) {
      if ((x + y + zone.id.length) % (step + 1) === 0) {
        setPlayableCell(tiles, roleMap, x, y, DEFAULT_RASTER_TILE, "texture");
      }
    }
  }
}

/** Ouvre quelques respirations pres des bords internes d'une zone. */
function addEdgeBreathing(
  zone: LevelLayoutZone,
  tiles: ModernTileType[][],
  roleMap: RasterizedCellRole[][],
  random: SeededRandom
): void {
  const attempts = Math.max(1, Math.floor((zone.rect.width + zone.rect.height) / 5));
  for (let index = 0; index < attempts; index += 1) {
    const horizontal = random.chance(0.5);
    const x = horizontal
      ? random.integer(zone.rect.x + 1, zone.rect.x + zone.rect.width - 2)
      : random.pick([zone.rect.x + 1, zone.rect.x + zone.rect.width - 2]);
    const y = horizontal
      ? random.pick([zone.rect.y + 1, zone.rect.y + zone.rect.height - 2])
      : random.integer(zone.rect.y + 1, zone.rect.y + zone.rect.height - 2);
    if (roleMap[y]?.[x] === "background") {
      setPlayableCell(tiles, roleMap, x, y, EMPTY_TILE, "texture");
    }
  }
}

/** Cree les tuiles explicites differentes de la tuile par defaut. */
function createExplicitTiles(
  tiles: readonly (readonly ModernTileType[])[],
  defaultTile: ModernTileType
): readonly ModernLevelCell<ModernTileType>[] {
  const explicitTiles: ModernLevelCell<ModernTileType>[] = [];
  for (let y = 0; y < tiles.length; y += 1) {
    for (let x = 0; x < tiles[y].length; x += 1) {
      const type = tiles[y][x];
      if (type !== defaultTile) {
        explicitTiles.push({ x, y, type });
      }
    }
  }

  return explicitTiles;
}

/** Cree les metadonnees de rasterisation. */
function createRasterizerMetadata(tiles: readonly (readonly ModernTileType[])[]): LevelRasterizerMetadata {
  const counts = countTiles(tiles);
  const total = Math.max(1, tiles.length * (tiles[0]?.length ?? 0));
  const openRatio = counts.empty / total;
  return {
    emptyCells: counts.empty,
    earthCells: counts.earth,
    platformCells: counts.platform,
    borderCells: counts.border,
    openRatio,
    summary: [
      "Raster",
      `empty=${counts.empty}`,
      `earth=${counts.earth}`,
      `platform=${counts.platform}`,
      `border=${counts.border}`,
      `open=${openRatio.toFixed(2)}`
    ].join(" | ")
  };
}

/** Compte les tuiles principales de la grille. */
function countTiles(tiles: readonly (readonly ModernTileType[])[]): Record<"empty" | "earth" | "platform" | "border", number> {
  const counts = { empty: 0, earth: 0, platform: 0, border: 0 };
  for (const row of tiles) {
    for (const tile of row) {
      if (tile === "empty") counts.empty += 1;
      if (tile === "earth") counts.earth += 1;
      if (tile === "platform") counts.platform += 1;
      if (tile === "border") counts.border += 1;
    }
  }

  return counts;
}

/** Remplit un disque carre Manhattan autour d'un point. */
function fillDisc(
  tiles: ModernTileType[][],
  roleMap: RasterizedCellRole[][],
  center: LevelLayoutPoint,
  halfWidth: number,
  tile: ModernTileType,
  role: RasterizedCellRole
): void {
  for (let y = center.y - halfWidth; y <= center.y + halfWidth; y += 1) {
    for (let x = center.x - halfWidth; x <= center.x + halfWidth; x += 1) {
      if (Math.abs(center.x - x) + Math.abs(center.y - y) <= halfWidth + MAX_CONNECTION_HALF_WIDTH) {
        setPlayableCell(tiles, roleMap, x, y, tile, role);
      }
    }
  }
}

/** Remplit un rectangle. */
function fillRect(
  tiles: ModernTileType[][],
  roleMap: RasterizedCellRole[][],
  rect: LevelLayoutRect,
  tile: ModernTileType,
  role: RasterizedCellRole
): void {
  forEachCellInRect(rect, (x, y) => setPlayableCell(tiles, roleMap, x, y, tile, role));
}

/** Trace le contour d'un rectangle. */
function strokeRect(
  tiles: ModernTileType[][],
  roleMap: RasterizedCellRole[][],
  rect: LevelLayoutRect,
  tile: ModernTileType,
  role: RasterizedCellRole
): void {
  for (let x = rect.x; x < rect.x + rect.width; x += 1) {
    setPlayableCell(tiles, roleMap, x, rect.y, tile, role);
    setPlayableCell(tiles, roleMap, x, rect.y + rect.height - 1, tile, role);
  }
  for (let y = rect.y; y < rect.y + rect.height; y += 1) {
    setPlayableCell(tiles, roleMap, rect.x, y, tile, role);
    setPlayableCell(tiles, roleMap, rect.x + rect.width - 1, y, tile, role);
  }
}

/** Itere sur les cellules d'un rectangle. */
function forEachCellInRect(rect: LevelLayoutRect, callback: (x: number, y: number) => void): void {
  for (let y = rect.y; y < rect.y + rect.height; y += 1) {
    for (let x = rect.x; x < rect.x + rect.width; x += 1) {
      callback(x, y);
    }
  }
}

/** Retrecit un rectangle sans produire de dimensions negatives. */
function shrinkRect(rect: LevelLayoutRect, margin: number): LevelLayoutRect {
  return {
    x: rect.x + margin,
    y: rect.y + margin,
    width: Math.max(1, rect.width - margin * 2),
    height: Math.max(1, rect.height - margin * 2)
  };
}

/** Cree une grille mutable remplie. */
function createFilledGrid<TValue>(width: number, height: number, value: TValue): TValue[][] {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => value));
}

/** Fixe une cellule en preservant la bordure exterieure. */
function setPlayableCell(
  tiles: ModernTileType[][],
  roleMap: RasterizedCellRole[][],
  x: number,
  y: number,
  tile: ModernTileType,
  role: RasterizedCellRole
): void {
  if (x <= 0 || y <= 0 || y >= tiles.length - 1 || x >= (tiles[0]?.length ?? 0) - 1) {
    return;
  }
  setCell(tiles, roleMap, x, y, tile, role);
}

/** Fixe une cellule si elle est dans la grille. */
function setCell(
  tiles: ModernTileType[][],
  roleMap: RasterizedCellRole[][],
  x: number,
  y: number,
  tile: ModernTileType,
  role: RasterizedCellRole
): void {
  if (!tiles[y] || tiles[y][x] === undefined || !roleMap[y] || roleMap[y][x] === undefined) {
    return;
  }
  tiles[y][x] = tile;
  roleMap[y][x] = role;
}

/** Retourne la demi-epaisseur structurelle d'un couloir. */
function getConnectionHalfWidth(intensity: LevelPlanIntensity): number {
  if (intensity === "high") return 1;
  return 0;
}
