/**
 * Role: Habille une grille rasterisee avec objets et motifs locaux inspires du corpus original.
 * Scope: Place rochers, diamants, plateformes complementaires et transformateurs selon les zones du layout.
 * ISO: Les densites viennent des niveaux TO8 extraits, mais les motifs restent abstraits et non copiants.
 * Notes: Le spawn, la sortie et les monstres restent reserves aux phases de placement gameplay.
 */

import type { ModernEntityType, ModernLevelCell, ModernTileType } from "../game/level-loader";
import type { LevelGenerationProfile } from "./level-profile";
import type { LevelLayout, LevelLayoutPoint, LevelLayoutRect, LevelLayoutZone } from "./level-layout";
import type { RasterizedCellRole, RasterizedLevelGrid } from "./level-rasterizer";
import type { SeededRandom } from "./seeded-random";

/** Role d'habillage local d'une zone. */
export type LevelDressingZoneRole =
  | "circulation"
  | "collection"
  | "gravity"
  | "danger"
  | "breathing"
  | "decorative";

/** Grille apres habillage structurel. */
export interface DressedLevelGrid {
  /** Largeur en cellules. */
  readonly width: number;
  /** Hauteur en cellules. */
  readonly height: number;
  /** Tuile par defaut conservee depuis la rasterisation. */
  readonly defaultTile: ModernTileType;
  /** Grille complete habillee. */
  readonly tiles: readonly (readonly ModernTileType[])[];
  /** Roles structurels herites de la rasterisation. */
  readonly roleMap: readonly (readonly RasterizedCellRole[])[];
  /** Roles d'habillage par zone. */
  readonly zoneRoles: Readonly<Record<string, LevelDressingZoneRole>>;
  /** Entites ajoutees par l'habillage, notamment les diamants. */
  readonly entities: readonly ModernLevelCell<ModernEntityType>[];
  /** Tuiles explicites differentes de `defaultTile`. */
  readonly explicitTiles: readonly ModernLevelCell<ModernTileType>[];
  /** Metadonnees compactes pour debug et futur scoring. */
  readonly metadata: LevelDressingMetadata;
}

/** Metadonnees de l'habillage. */
export interface LevelDressingMetadata {
  /** Nombre de rochers poses. */
  readonly rockCount: number;
  /** Nombre de diamants poses. */
  readonly diamondCount: number;
  /** Nombre de plateformes ajoutees par l'habillage. */
  readonly platformCount: number;
  /** Nombre de transformateurs poses. */
  readonly transformerCount: number;
  /** Resume lisible pour logs et debug. */
  readonly summary: string;
}

/** Entree de la phase d'habillage. */
export interface LevelDressingInput {
  /** Layout source qui porte les zones et budgets abstraits. */
  readonly layout: LevelLayout;
  /** Grille rasterisee par la phase 5. */
  readonly rasterizedGrid: RasterizedLevelGrid;
  /** Profil statistique utilise pour calibrer les densites. */
  readonly profile: LevelGenerationProfile;
  /** PRNG seede de la tentative courante. */
  readonly random: SeededRandom;
}

/** Point candidat annote par zone. */
interface DressingCandidate extends LevelLayoutPoint {
  /** Zone qui contient le point. */
  readonly zone: LevelLayoutZone;
}

/** Compteurs mutables pendant l'habillage. */
interface DressingCounters {
  /** Rochers poses. */
  rockCount: number;
  /** Diamants poses. */
  diamondCount: number;
  /** Plateformes ajoutees. */
  platformCount: number;
  /** Transformateurs poses. */
  transformerCount: number;
}

/** Habille une grille rasterisee avec des objets et motifs coherents par zone. */
export function dressRasterizedLevel(input: LevelDressingInput): DressedLevelGrid {
  const tiles = cloneTileGrid(input.rasterizedGrid.tiles);
  const zoneRoles = classifyZones(input.layout.zones);
  const entities: Array<ModernLevelCell<ModernEntityType>> = [];
  const counters: DressingCounters = {
    rockCount: 0,
    diamondCount: 0,
    platformCount: 0,
    transformerCount: 0
  };
  const targets = createDressingTargets(input.layout, input.profile);
  const random = input.random.fork("dressing");

  addRhythmPlatforms(input.layout.zones, zoneRoles, tiles, counters);
  placeDiamondClusters(input.layout.zones, zoneRoles, tiles, entities, counters, targets.diamonds, random.fork("diamonds"));
  placeRockGroups(input.layout.zones, zoneRoles, tiles, counters, targets.rocks, random.fork("rocks"));
  placeTransformers(input.layout.zones, zoneRoles, tiles, counters, targets.transformers, random.fork("transformers"));
  addBreathingPauses(input.layout.zones, zoneRoles, tiles, random.fork("pauses"));

  return {
    width: input.rasterizedGrid.width,
    height: input.rasterizedGrid.height,
    defaultTile: input.rasterizedGrid.defaultTile,
    tiles,
    roleMap: input.rasterizedGrid.roleMap,
    zoneRoles,
    entities,
    explicitTiles: createExplicitTiles(tiles, input.rasterizedGrid.defaultTile),
    metadata: createDressingMetadata(counters)
  };
}

/** Classe chaque zone selon sa fonction d'habillage. */
function classifyZones(zones: readonly LevelLayoutZone[]): Readonly<Record<string, LevelDressingZoneRole>> {
  return Object.fromEntries(zones.map((zone) => [zone.id, classifyZone(zone)]));
}

/** Classe une zone individuelle. */
function classifyZone(zone: LevelLayoutZone): LevelDressingZoneRole {
  if (zone.nodeKind === "start" || zone.nodeKind === "exit" || zone.nodeKind === "corridor") {
    return "circulation";
  }
  if (zone.nodeKind === "diamondObjective" || zone.nodeKind === "reward" || zone.diamondBudget > 0) {
    return "collection";
  }
  if (zone.nodeKind === "danger" || zone.dangerBudget > 0) {
    return "danger";
  }
  if (zone.nodeKind === "implicitLock" || zone.archetype === "verticalRoute") {
    return "gravity";
  }
  if (zone.optional || zone.archetype === "centralArena") {
    return "breathing";
  }
  return "decorative";
}

/** Calcule les objectifs globaux depuis le profil original et la taille courante. */
function createDressingTargets(
  layout: LevelLayout,
  profile: LevelGenerationProfile
): Readonly<Record<"rocks" | "diamonds" | "transformers", number>> {
  const cellScale = layout.width * layout.height / Math.max(1, profile.dimensions.cells.average);
  const innerCells = Math.max(1, (layout.width - 2) * (layout.height - 2));
  const rockDensity = profile.tileDensities.rock?.ratio ?? 0.08;
  const transformerDensity = profile.tileDensities.transformerBlock?.ratio ?? 0;
  return {
    rocks: clampInteger(Math.round(innerCells * rockDensity * 0.82), 3, Math.max(3, Math.floor(innerCells * 0.14))),
    diamonds: clampInteger(Math.round(profile.diamonds.present.average * cellScale * 0.9), 3, Math.max(3, Math.floor(innerCells * 0.06))),
    transformers: clampInteger(Math.round(innerCells * transformerDensity * 0.65), 0, 5)
  };
}

/** Ajoute des plateformes rythmiques sans recouvrir toutes les zones. */
function addRhythmPlatforms(
  zones: readonly LevelLayoutZone[],
  zoneRoles: Readonly<Record<string, LevelDressingZoneRole>>,
  tiles: ModernTileType[][],
  counters: DressingCounters
): void {
  for (const zone of zones) {
    const role = zoneRoles[zone.id];
    if (role !== "gravity" && role !== "collection") {
      continue;
    }

    const y = zone.rect.y + zone.rect.height - 2;
    const every = role === "gravity" ? 3 : 4;
    for (let x = zone.rect.x + 1; x < zone.rect.x + zone.rect.width - 1; x += 1) {
      if ((x + zone.rect.y) % every === 0 && canPlaceSolidTile(tiles, x, y)) {
        tiles[y][x] = "platform";
        counters.platformCount += 1;
      }
    }
  }
}

/** Place des groupes de diamants dans les zones de collecte et de recompense. */
function placeDiamondClusters(
  zones: readonly LevelLayoutZone[],
  zoneRoles: Readonly<Record<string, LevelDressingZoneRole>>,
  tiles: ModernTileType[][],
  entities: Array<ModernLevelCell<ModernEntityType>>,
  counters: DressingCounters,
  targetCount: number,
  random: SeededRandom
): void {
  const collectionZones = zones.filter((zone) => zoneRoles[zone.id] === "collection");
  const fallbackZones = zones.filter((zone) => zoneRoles[zone.id] !== "circulation" && zoneRoles[zone.id] !== "danger");
  const candidateZones = collectionZones.length > 0 ? collectionZones : fallbackZones;
  const candidates = shuffled(random, candidateZones.flatMap((zone) => getZoneCandidates(zone, tiles, ["earth", "empty"])));

  for (const candidate of candidates) {
    if (counters.diamondCount >= targetCount) {
      break;
    }
    if (!canPlaceObjectTile(tiles, candidate.x, candidate.y)) {
      continue;
    }

    tiles[candidate.y][candidate.x] = "diamond";
    entities.push({ x: candidate.x, y: candidate.y, type: "diamond" });
    counters.diamondCount += 1;
    addSmallDiamondEcho(candidate, tiles, entities, counters, targetCount);
  }
}

/** Ajoute un deuxieme diamant proche quand le motif local le permet. */
function addSmallDiamondEcho(
  origin: DressingCandidate,
  tiles: ModernTileType[][],
  entities: Array<ModernLevelCell<ModernEntityType>>,
  counters: DressingCounters,
  targetCount: number
): void {
  if (counters.diamondCount >= targetCount || origin.zone.diamondBudget <= 1) {
    return;
  }

  const echo = { x: origin.x + 1, y: origin.y };
  if (canPlaceObjectTile(tiles, echo.x, echo.y)) {
    tiles[echo.y][echo.x] = "diamond";
    entities.push({ x: echo.x, y: echo.y, type: "diamond" });
    counters.diamondCount += 1;
  }
}

/** Place les rochers en groupes lisibles, avec priorite aux zones de gravite/danger. */
function placeRockGroups(
  zones: readonly LevelLayoutZone[],
  zoneRoles: Readonly<Record<string, LevelDressingZoneRole>>,
  tiles: ModernTileType[][],
  counters: DressingCounters,
  targetCount: number,
  random: SeededRandom
): void {
  const priorityRoles: readonly LevelDressingZoneRole[] = ["gravity", "danger", "decorative", "collection"];
  const candidates = shuffled(
    random,
    zones
      .filter((zone) => priorityRoles.includes(zoneRoles[zone.id]))
      .flatMap((zone) => getZoneCandidates(zone, tiles, ["earth", "empty"]))
  );

  for (const candidate of candidates) {
    if (counters.rockCount >= targetCount) {
      break;
    }
    if (!canPlaceObjectTile(tiles, candidate.x, candidate.y) || isTooDenseAround(tiles, candidate.x, candidate.y, "rock", 3)) {
      continue;
    }

    tiles[candidate.y][candidate.x] = "rock";
    counters.rockCount += 1;
    addRockNeighbor(candidate, tiles, counters, targetCount, random.fork(`${candidate.x}-${candidate.y}`));
  }
}

/** Ajoute parfois un voisin pour creer un groupe de rochers identifiable. */
function addRockNeighbor(
  origin: DressingCandidate,
  tiles: ModernTileType[][],
  counters: DressingCounters,
  targetCount: number,
  random: SeededRandom
): void {
  if (counters.rockCount >= targetCount || !random.chance(origin.zone.archetype === "denseField" ? 0.55 : 0.28)) {
    return;
  }

  const offset = random.pick([
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: -1 }
  ]);
  const x = origin.x + offset.x;
  const y = origin.y + offset.y;
  if (canPlaceObjectTile(tiles, x, y)) {
    tiles[y][x] = "rock";
    counters.rockCount += 1;
  }
}

/** Place les transformateurs dans les zones ou ils creent un enjeu lisible. */
function placeTransformers(
  zones: readonly LevelLayoutZone[],
  zoneRoles: Readonly<Record<string, LevelDressingZoneRole>>,
  tiles: ModernTileType[][],
  counters: DressingCounters,
  targetCount: number,
  random: SeededRandom
): void {
  if (targetCount <= 0) {
    return;
  }

  const candidates = shuffled(
    random,
    zones
      .filter((zone) => zoneRoles[zone.id] === "gravity" || zoneRoles[zone.id] === "danger")
      .flatMap((zone) => getZoneCandidates(zone, tiles, ["earth", "empty"]))
      .filter((point) => hasVerticalPlaySpace(tiles, point.x, point.y))
  );

  for (const candidate of candidates) {
    if (counters.transformerCount >= targetCount) {
      break;
    }
    if (!canPlaceObjectTile(tiles, candidate.x, candidate.y)) {
      continue;
    }

    tiles[candidate.y][candidate.x] = "transformerBlock";
    counters.transformerCount += 1;
  }
}

/** Creuse de petites pauses visuelles dans les zones de respiration. */
function addBreathingPauses(
  zones: readonly LevelLayoutZone[],
  zoneRoles: Readonly<Record<string, LevelDressingZoneRole>>,
  tiles: ModernTileType[][],
  random: SeededRandom
): void {
  const breathingZones = zones.filter((zone) => zoneRoles[zone.id] === "breathing");
  for (const zone of breathingZones) {
    const attempts = Math.max(1, Math.floor((zone.rect.width * zone.rect.height) / 12));
    for (let index = 0; index < attempts; index += 1) {
      const x = random.integer(zone.rect.x + 1, zone.rect.x + zone.rect.width - 2);
      const y = random.integer(zone.rect.y + 1, zone.rect.y + zone.rect.height - 2);
      if (isInterior(tiles, x, y) && tiles[y][x] === "earth") {
        tiles[y][x] = "empty";
      }
    }
  }
}

/** Retourne les candidats d'une zone pour une liste de tuiles acceptables. */
function getZoneCandidates(
  zone: LevelLayoutZone,
  tiles: readonly (readonly ModernTileType[])[],
  acceptedTiles: readonly ModernTileType[]
): readonly DressingCandidate[] {
  const candidates: DressingCandidate[] = [];
  forEachCellInRect(shrinkRect(zone.rect, 1), (x, y) => {
    if (acceptedTiles.includes(tiles[y]?.[x]) && !isNearZoneEdge(zone.rect, x, y)) {
      candidates.push({ x, y, zone });
    }
  });

  return candidates;
}

/** Indique si une cellule peut recevoir un objet solide/collectable. */
function canPlaceObjectTile(tiles: readonly (readonly ModernTileType[])[], x: number, y: number): boolean {
  const tile = tiles[y]?.[x];
  return isInterior(tiles, x, y) && (tile === "earth" || tile === "empty");
}

/** Indique si une cellule peut recevoir une plateforme. */
function canPlaceSolidTile(tiles: readonly (readonly ModernTileType[])[], x: number, y: number): boolean {
  const tile = tiles[y]?.[x];
  return isInterior(tiles, x, y) && tile !== "border" && tile !== "rock" && tile !== "diamond" && tile !== "transformerBlock";
}

/** Indique si une cellule a de l'espace vertical pour un transformateur. */
function hasVerticalPlaySpace(tiles: readonly (readonly ModernTileType[])[], x: number, y: number): boolean {
  const above = tiles[y - 1]?.[x];
  const below = tiles[y + 1]?.[x];
  return (above === "empty" || above === "earth" || above === "rock" || above === "diamond")
    && (below === "empty" || below === "earth");
}

/** Limite les amas trop compacts d'une meme tuile. */
function isTooDenseAround(
  tiles: readonly (readonly ModernTileType[])[],
  x: number,
  y: number,
  tileType: ModernTileType,
  maxNeighbors: number
): boolean {
  let count = 0;
  for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      if (offsetX === 0 && offsetY === 0) {
        continue;
      }
      if (tiles[y + offsetY]?.[x + offsetX] === tileType) {
        count += 1;
      }
    }
  }

  return count >= maxNeighbors;
}

/** Evite de placer les objets sur les cellules qui definissent le contour d'une zone. */
function isNearZoneEdge(rect: LevelLayoutRect, x: number, y: number): boolean {
  return x <= rect.x || y <= rect.y || x >= rect.x + rect.width - 1 || y >= rect.y + rect.height - 1;
}

/** Cree les metadonnees publiques de l'habillage. */
function createDressingMetadata(counters: DressingCounters): LevelDressingMetadata {
  return {
    rockCount: counters.rockCount,
    diamondCount: counters.diamondCount,
    platformCount: counters.platformCount,
    transformerCount: counters.transformerCount,
    summary: [
      "Dressing",
      `rocks=${counters.rockCount}`,
      `diamonds=${counters.diamondCount}`,
      `platforms=${counters.platformCount}`,
      `transformers=${counters.transformerCount}`
    ].join(" | ")
  };
}

/** Convertit la grille complete en cellules explicites. */
function createExplicitTiles(
  tiles: readonly (readonly ModernTileType[])[],
  defaultTile: ModernTileType
): readonly ModernLevelCell<ModernTileType>[] {
  const explicitTiles: ModernLevelCell<ModernTileType>[] = [];
  for (let y = 0; y < tiles.length; y += 1) {
    for (let x = 0; x < (tiles[y]?.length ?? 0); x += 1) {
      const type = tiles[y][x];
      if (type !== defaultTile) {
        explicitTiles.push({ x, y, type });
      }
    }
  }

  return explicitTiles;
}

/** Clone une grille de tuiles readonly en grille mutable. */
function cloneTileGrid(tiles: readonly (readonly ModernTileType[])[]): ModernTileType[][] {
  return tiles.map((row) => [...row]);
}

/** Itere sur les cellules d'un rectangle. */
function forEachCellInRect(rect: LevelLayoutRect, callback: (x: number, y: number) => void): void {
  for (let y = rect.y; y < rect.y + rect.height; y += 1) {
    for (let x = rect.x; x < rect.x + rect.width; x += 1) {
      callback(x, y);
    }
  }
}

/** Retrecit un rectangle pour eviter ses bords. */
function shrinkRect(rect: LevelLayoutRect, margin: number): LevelLayoutRect {
  return {
    x: rect.x + margin,
    y: rect.y + margin,
    width: Math.max(1, rect.width - margin * 2),
    height: Math.max(1, rect.height - margin * 2)
  };
}

/** Melange une liste avec le PRNG seede. */
function shuffled<TValue>(random: SeededRandom, values: readonly TValue[]): readonly TValue[] {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = random.integer(0, index);
    const current = copy[index];
    copy[index] = copy[swapIndex];
    copy[swapIndex] = current;
  }

  return copy;
}

/** Indique si un point est dans la zone interieure jouable. */
function isInterior(tiles: readonly (readonly ModernTileType[])[], x: number, y: number): boolean {
  return y > 0 && y < tiles.length - 1 && x > 0 && x < (tiles[0]?.length ?? 0) - 1;
}

/** Contraint un entier dans une plage. */
function clampInteger(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}
