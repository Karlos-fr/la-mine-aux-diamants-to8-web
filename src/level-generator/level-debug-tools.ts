/**
 * Role: Fournit des outils de debug visuel et de comparaison pour le generateur par intention.
 * Scope: Produit dumps ASCII, overlays de zones/graphe et rapports multi-seeds sans modifier les niveaux.
 * ISO: Les comparaisons utilisent les analyses modernes des niveaux extraits; les PNG restent des references visuelles manuelles.
 * Notes: Ces helpers sont volontairement purs et legers pour rester utilisables depuis l'editeur ou des scripts locaux.
 */

import type { ModernEntityType, ModernLevelCell, ModernLevelJson, ModernTileType } from "../game/level-loader";
import { generateBaseLevel, type PartialLevelGenerationOptions } from "./level-generator";
import type { GameplayPlacedLevelGrid } from "./level-gameplay-placer";
import type { LevelLayout, LevelLayoutConnection, LevelLayoutPoint } from "./level-layout";
import {
  analyzeModernLevelStructure,
  ORIGINAL_LEVEL_STRUCTURE_AUDIT,
  type LevelStructureAnalysis
} from "./level-structure-analysis";

/** Options de rendu ASCII. */
export interface LevelAsciiDumpOptions {
  /** Indique si les coordonnees doivent etre ajoutees autour de la grille. */
  readonly showCoordinates?: boolean;
  /** Entites optionnelles a superposer aux tuiles. */
  readonly entities?: readonly ModernLevelCell<ModernEntityType>[];
  /** Spawn optionnel a superposer. */
  readonly playerSpawn?: LevelLayoutPoint;
  /** Sortie optionnelle a superposer. */
  readonly exit?: LevelLayoutPoint;
}

/** Resume d'une comparaison avec une galerie originale. */
export interface OriginalReferenceComparison {
  /** Id du niveau original le plus proche. */
  readonly originalId: string;
  /** Libelle du niveau original le plus proche. */
  readonly originalLabel: string;
  /** Chemin documentaire du PNG original extrait. */
  readonly referencePngPath: string;
  /** Similarite heuristique `0..1`, plus haut signifie plus proche. */
  readonly similarity: number;
  /** Rapport court de comparaison. */
  readonly summary: string;
}

/** Rapport de debug pour une seed generee. */
export interface GeneratedLevelDebugSample {
  /** Seed testee. */
  readonly seed: string;
  /** Niveau genere. */
  readonly level: ModernLevelJson;
  /** Analyse structurelle du niveau genere. */
  readonly analysis: LevelStructureAnalysis;
  /** Comparaison avec la reference originale la plus proche. */
  readonly nearestOriginal: OriginalReferenceComparison;
  /** Dump ASCII compact du niveau. */
  readonly ascii: string;
  /** Warnings publics du generateur. */
  readonly warnings: readonly string[];
}

/** Rapport multi-seeds pour comparaison rapide. */
export interface GeneratedLevelDebugBatch {
  /** Echantillons generes dans l'ordre demande. */
  readonly samples: readonly GeneratedLevelDebugSample[];
  /** Rapport texte compact. */
  readonly report: string;
}

/** Mapping ASCII volontairement proche des roles visuels du jeu. */
const TILE_ASCII: Readonly<Record<ModernTileType, string>> = {
  empty: " ",
  earth: ".",
  customEarth: ",",
  rock: "o",
  diamond: "*",
  monster: "m",
  customMonster: "M",
  border: "#",
  platform: "=",
  customPlatform: "-",
  specialCreature: "s",
  transformerBlock: "t"
};

/** Mapping ASCII des entites modernes. */
const ENTITY_ASCII: Readonly<Record<ModernEntityType, string>> = {
  diamond: "*",
  monster: "m",
  customMonster: "M",
  specialCreature: "s"
};

/** Dump un niveau moderne complet en ASCII. */
export function dumpModernLevelAscii(level: ModernLevelJson, options: LevelAsciiDumpOptions = {}): string {
  const grid = createTileGrid(level);
  return dumpTileGridAscii(grid, {
    ...options,
    entities: options.entities ?? level.entities,
    playerSpawn: options.playerSpawn ?? level.playerSpawn,
    exit: options.exit ?? level.exit
  });
}

/** Dump une grille gameplay en ASCII. */
export function dumpGameplayGridAscii(gameplayGrid: GameplayPlacedLevelGrid, options: LevelAsciiDumpOptions = {}): string {
  return dumpTileGridAscii(gameplayGrid.tiles, {
    ...options,
    entities: options.entities ?? gameplayGrid.entities,
    playerSpawn: options.playerSpawn ?? gameplayGrid.playerSpawn,
    exit: options.exit ?? gameplayGrid.exit
  });
}

/** Dump une grille de tuiles en ASCII. */
export function dumpTileGridAscii(
  tiles: readonly (readonly ModernTileType[])[],
  options: LevelAsciiDumpOptions = {}
): string {
  const overlay = createOverlayMap(options);
  const rows = tiles.map((row, y) => row
    .map((tile, x) => overlay.get(toPointKey({ x, y })) ?? TILE_ASCII[tile] ?? "?")
    .join(""));

  return options.showCoordinates ? addCoordinateFrame(rows) : rows.join("\n");
}

/** Produit un overlay ASCII des zones et connexions d'un layout. */
export function dumpLayoutDebugOverlay(layout: LevelLayout, options: { readonly showCoordinates?: boolean } = {}): string {
  const rows = Array.from({ length: layout.height }, () => Array.from({ length: layout.width }, () => " "));
  for (const zone of layout.zones) {
    const marker = getZoneMarker(zone.nodeKind);
    for (let y = zone.rect.y; y < zone.rect.y + zone.rect.height; y += 1) {
      for (let x = zone.rect.x; x < zone.rect.x + zone.rect.width; x += 1) {
        if (isInside(rows, x, y)) {
          rows[y][x] = marker;
        }
      }
    }
    if (isInside(rows, zone.center.x, zone.center.y)) {
      rows[zone.center.y][zone.center.x] = marker.toUpperCase();
    }
  }
  for (const connection of layout.connections) {
    drawConnection(rows, connection);
  }

  const textRows = rows.map((row) => row.join(""));
  return options.showCoordinates ? addCoordinateFrame(textRows) : textRows.join("\n");
}

/** Genere plusieurs niveaux et retourne un rapport texte de comparaison. */
export function generateLevelDebugBatch(
  seeds: readonly string[],
  options: Omit<PartialLevelGenerationOptions, "seed"> = {}
): GeneratedLevelDebugBatch {
  const samples = seeds.map((seed) => {
    const result = generateBaseLevel({ ...options, seed });
    const analysis = analyzeModernLevelStructure(result.level);
    const nearestOriginal = compareGeneratedLevelWithOriginalReferences(analysis);
    return {
      seed,
      level: result.level,
      analysis,
      nearestOriginal,
      ascii: dumpModernLevelAscii(result.level),
      warnings: result.warnings
    };
  });

  return {
    samples,
    report: samples.map(formatDebugSampleReport).join("\n\n")
  };
}

/** Compare une analyse generee aux references originales connues. */
export function compareGeneratedLevelWithOriginalReferences(analysis: LevelStructureAnalysis): OriginalReferenceComparison {
  const comparisons = ORIGINAL_LEVEL_STRUCTURE_AUDIT.analyses.map((original, index) => {
    const similarity = estimateAnalysisSimilarity(analysis, original);
    return {
      original,
      index,
      similarity
    };
  });
  const nearest = comparisons.sort((first, second) => second.similarity - first.similarity)[0];
  const referencePngPath = `docs/extraction/levels/level-${(nearest.index + 1).toString().padStart(2, "0")}.png`;
  return {
    originalId: nearest.original.id,
    originalLabel: nearest.original.label,
    referencePngPath,
    similarity: nearest.similarity,
    summary: [
      `nearest=${nearest.original.id}`,
      `family=${nearest.original.primaryFamily}`,
      `similarity=${nearest.similarity.toFixed(2)}`,
      `png=${referencePngPath}`
    ].join(" | ")
  };
}

/** Formate un rapport lisible pour un echantillon genere. */
function formatDebugSampleReport(sample: GeneratedLevelDebugSample): string {
  return [
    `Seed ${sample.seed}`,
    `  generated=${sample.level.id} ${sample.level.width}x${sample.level.height}`,
    `  family=${sample.analysis.primaryFamily}`,
    `  nearestOriginal=${sample.nearestOriginal.summary}`,
    `  warnings=${sample.warnings.length}`
  ].join("\n");
}

/** Cree une grille complete depuis un niveau moderne. */
function createTileGrid(level: ModernLevelJson): ModernTileType[][] {
  const grid = Array.from({ length: level.height }, () => Array.from({ length: level.width }, () => level.defaultTile));
  for (const tile of level.tiles) {
    if (grid[tile.y]?.[tile.x] !== undefined) {
      grid[tile.y][tile.x] = tile.type;
    }
  }

  return grid;
}

/** Cree une couche d'overlay pour spawn, sortie et entites. */
function createOverlayMap(options: LevelAsciiDumpOptions): ReadonlyMap<string, string> {
  const overlay = new Map<string, string>();
  for (const entity of options.entities ?? []) {
    overlay.set(toPointKey(entity), ENTITY_ASCII[entity.type] ?? "?");
  }
  if (options.exit) {
    overlay.set(toPointKey(options.exit), "E");
  }
  if (options.playerSpawn) {
    overlay.set(toPointKey(options.playerSpawn), "S");
  }

  return overlay;
}

/** Ajoute un cadre de coordonnees simple a un dump ASCII. */
function addCoordinateFrame(rows: readonly string[]): string {
  const width = rows[0]?.length ?? 0;
  const header = `   ${Array.from({ length: width }, (_, index) => String(index % 10)).join("")}`;
  const body = rows.map((row, y) => `${String(y).padStart(2, "0")} ${row}`);
  return [header, ...body].join("\n");
}

/** Dessine une connexion dans l'overlay de layout. */
function drawConnection(rows: string[][], connection: LevelLayoutConnection): void {
  for (const point of connection.path) {
    if (isInside(rows, point.x, point.y) && rows[point.y][point.x] === " ") {
      rows[point.y][point.x] = connection.kind === "mainPath" ? "+" : ":";
    }
  }
}

/** Retourne un marqueur court pour un role de zone. */
function getZoneMarker(nodeKind: string): string {
  if (nodeKind === "start") return "s";
  if (nodeKind === "exit") return "e";
  if (nodeKind === "danger") return "x";
  if (nodeKind === "diamondObjective" || nodeKind === "reward") return "d";
  if (nodeKind === "implicitLock") return "l";
  if (nodeKind === "corridor") return "c";
  return "r";
}

/** Estime la similarite de deux analyses structurelles. */
function estimateAnalysisSimilarity(generated: LevelStructureAnalysis, original: LevelStructureAnalysis): number {
  const familyScore = generated.primaryFamily === original.primaryFamily ? 0.32 : 0;
  const dimensionScore = 1 - clamp01(
    (Math.abs(generated.width - original.width) + Math.abs(generated.height - original.height))
      / Math.max(1, original.width + original.height)
  );
  const silhouetteScore = average([
    scoreSimilarity(generated.silhouette.longOpenRows, original.silhouette.longOpenRows),
    scoreSimilarity(generated.silhouette.longPlatformRows, original.silhouette.longPlatformRows),
    scoreSimilarity(generated.silhouette.openRectangles, original.silhouette.openRectangles),
    scoreSimilarity(generated.silhouette.ringScore, original.silhouette.ringScore)
  ]);
  const zoneScore = average([
    scoreSimilarity(generated.zones.diamondZones, original.zones.diamondZones),
    scoreSimilarity(generated.zones.dangerZones, original.zones.dangerZones),
    scoreSimilarity(generated.zones.optionalZones, original.zones.optionalZones)
  ]);
  return clamp01(familyScore + dimensionScore * 0.18 + silhouetteScore * 0.32 + zoneScore * 0.18);
}

/** Score la similarite de deux nombres positifs. */
function scoreSimilarity(first: number, second: number): number {
  return 1 - clamp01(Math.abs(first - second) / Math.max(1, Math.abs(second)));
}

/** Verifie une coordonnee dans un tableau 2D de caracteres. */
function isInside(rows: readonly (readonly string[])[], x: number, y: number): boolean {
  return y >= 0 && y < rows.length && x >= 0 && x < (rows[y]?.length ?? 0);
}

/** Encode un point en cle de map. */
function toPointKey(point: { readonly x: number; readonly y: number }): string {
  return `${point.x}:${point.y}`;
}

/** Calcule une moyenne. */
function average(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0) / Math.max(1, values.length);
}

/** Contraint un score normalise. */
function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
