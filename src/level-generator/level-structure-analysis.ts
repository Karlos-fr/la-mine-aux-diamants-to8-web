/**
 * Role: Analyse la structure globale des niveaux sources pour guider le futur generateur par intention.
 * Scope: Produit des mesures et familles de macro-structure depuis `ModernLevelJson`, sans generer de grille.
 * ISO: Les donnees analysees viennent des niveaux modernes extraits; les familles sont des heuristiques modernes.
 * Notes: Ces mesures servent au scoring et a l'inspiration structurelle, pas a copier des templates originaux.
 */

import {
  getModernLevelSource,
  NORMAL_LEVEL_COUNT,
  type ModernGridPoint,
  type ModernLevelJson,
  type ModernTileType
} from "../game/level-loader";

/** Familles de structures visibles en miniature dans les niveaux originaux. */
export type LevelStructureFamily =
  | "horizontalBands"
  | "roomGrid"
  | "maze"
  | "denseField"
  | "spiralFortress"
  | "verticalPlatforms"
  | "arena";

/** Mesure d'une famille detectee avec un score heuristique. */
export interface LevelStructureFamilyScore {
  /** Famille structurelle detectee. */
  readonly family: LevelStructureFamily;
  /** Score normalise `0..1`, utile au futur scoring. */
  readonly score: number;
}

/** Resume des composants connectes d'une famille de cellules. */
export interface LevelStructureComponentSummary {
  /** Nombre de composants detectes. */
  readonly count: number;
  /** Taille du plus grand composant. */
  readonly largest: number;
  /** Taille moyenne des composants. */
  readonly average: number;
  /** Taille cumulee des composants. */
  readonly total: number;
}

/** Mesures de silhouette macro-visuelle d'un niveau. */
export interface LevelStructureSilhouette {
  /** Nombre de lignes contenant un long segment ouvert. */
  readonly longOpenRows: number;
  /** Plus long segment ouvert horizontal. */
  readonly longestOpenRowRun: number;
  /** Nombre de lignes contenant une longue plateforme. */
  readonly longPlatformRows: number;
  /** Plus long segment horizontal de plateformes. */
  readonly longestPlatformRun: number;
  /** Nombre de colonnes avec un long segment de terre. */
  readonly longEarthColumns: number;
  /** Plus long segment vertical de terre. */
  readonly longestEarthColumnRun: number;
  /** Nombre de grands rectangles ouverts approximatifs. */
  readonly openRectangles: number;
  /** Score de repetition locale de blocs 4x4. */
  readonly repeatedBlockScore: number;
  /** Score approximatif de formes en anneau ou forteresse. */
  readonly ringScore: number;
}

/** Zones fonctionnelles deduites du placement gameplay existant. */
export interface LevelFunctionalZoneSummary {
  /** Distance Manhattan spawn-sortie. */
  readonly spawnExitDistance: number;
  /** Nombre de groupes de diamants proches. */
  readonly diamondZones: number;
  /** Nombre de groupes de dangers proches. */
  readonly dangerZones: number;
  /** Nombre de zones ouvertes secondaires contenant des diamants. */
  readonly optionalZones: number;
}

/** Analyse structurelle complete d'un niveau moderne. */
export interface LevelStructureAnalysis {
  /** Identifiant moderne du niveau. */
  readonly id: string;
  /** Libelle humain du niveau. */
  readonly label: string;
  /** Largeur en cellules. */
  readonly width: number;
  /** Hauteur en cellules. */
  readonly height: number;
  /** Famille dominante, choisie par score. */
  readonly primaryFamily: LevelStructureFamily;
  /** Scores de familles tries du plus probable au moins probable. */
  readonly familyScores: readonly LevelStructureFamilyScore[];
  /** Composants connectes par role structurel. */
  readonly components: {
    /** Composants de cellules ouvertes ou occupables. */
    readonly open: LevelStructureComponentSummary;
    /** Composants de terre creusable. */
    readonly earth: LevelStructureComponentSummary;
    /** Composants de plateformes. */
    readonly platform: LevelStructureComponentSummary;
    /** Composants d'obstacles solides hors terre. */
    readonly obstacle: LevelStructureComponentSummary;
  };
  /** Mesures de silhouette lisibles en miniature. */
  readonly silhouette: LevelStructureSilhouette;
  /** Resume des zones fonctionnelles. */
  readonly zones: LevelFunctionalZoneSummary;
  /** Rapport texte court pour debug et plans. */
  readonly report: string;
}

/** Audit agrege des niveaux originaux, reserve aux futures phases de scoring. */
export interface LevelStructureAudit {
  /** Analyses individuelles dans l'ordre des galeries normales. */
  readonly analyses: readonly LevelStructureAnalysis[];
  /** Rapport texte multi-niveaux. */
  readonly report: string;
}

/** Seuil de longueur horizontale qui indique une macro-ligne lisible. */
const LONG_ROW_RATIO = 0.4;
/** Seuil de longueur verticale qui indique une colonne structurelle lisible. */
const LONG_COLUMN_RATIO = 0.55;
/** Taille minimale d'une zone ouverte pour etre traitee comme rectangle/salle. */
const MIN_OPEN_RECTANGLE_AREA = 20;
/** Distance maximale entre objets pour composer une zone fonctionnelle. */
const FUNCTIONAL_ZONE_DISTANCE = 4;

/** Audit structurel des 16 galeries normales connues. */
export const ORIGINAL_LEVEL_STRUCTURE_AUDIT = buildOriginalLevelStructureAudit();

/** Construit l'audit structurel des galeries originales normales. */
export function buildOriginalLevelStructureAudit(): LevelStructureAudit {
  const analyses = Array.from({ length: NORMAL_LEVEL_COUNT }, (_, index) => getModernLevelSource(index + 1))
    .flatMap((level) => level ? [analyzeModernLevelStructure(level)] : []);
  return {
    analyses,
    report: analyses.map((analysis) => analysis.report).join("\n")
  };
}

/** Analyse la macro-structure d'un niveau moderne. */
export function analyzeModernLevelStructure(level: ModernLevelJson): LevelStructureAnalysis {
  const grid = buildTileGrid(level);
  const components = {
    open: summarizeComponents(findComponents(grid, isOpenTile)),
    earth: summarizeComponents(findComponents(grid, (tile) => tile === "earth" || tile === "customEarth")),
    platform: summarizeComponents(findComponents(grid, (tile) => tile === "platform" || tile === "customPlatform")),
    obstacle: summarizeComponents(findComponents(grid, isObstacleTile))
  };
  const silhouette = analyzeSilhouette(grid);
  const zones = analyzeFunctionalZones(level, grid);
  const familyScores = scoreStructureFamilies(level, components, silhouette, zones);
  const analysis: Omit<LevelStructureAnalysis, "report"> = {
    id: level.id,
    label: level.label,
    width: level.width,
    height: level.height,
    primaryFamily: familyScores[0]?.family ?? "denseField",
    familyScores,
    components,
    silhouette,
    zones
  };

  return {
    ...analysis,
    report: formatLevelStructureReport(analysis)
  };
}

/** Formate une analyse pour lecture humaine dans les plans ou logs. */
export function formatLevelStructureReport(analysis: Omit<LevelStructureAnalysis, "report">): string {
  const families = analysis.familyScores
    .slice(0, 3)
    .map((score) => `${score.family}:${score.score.toFixed(2)}`)
    .join(", ");
  return [
    `${analysis.id} ${analysis.label}`,
    `  family=${analysis.primaryFamily} (${families})`,
    `  open=${analysis.components.open.count}/${analysis.components.open.largest} earth=${analysis.components.earth.count}/${analysis.components.earth.largest} platform=${analysis.components.platform.count}/${analysis.components.platform.largest}`,
    `  silhouette=openRows:${analysis.silhouette.longOpenRows} platformRows:${analysis.silhouette.longPlatformRows} rectangles:${analysis.silhouette.openRectangles} repeated:${analysis.silhouette.repeatedBlockScore} ring:${analysis.silhouette.ringScore.toFixed(2)}`,
    `  zones=diamonds:${analysis.zones.diamondZones} dangers:${analysis.zones.dangerZones} optional:${analysis.zones.optionalZones} spawnExit:${analysis.zones.spawnExitDistance}`
  ].join("\n");
}

/** Construit une grille complete en appliquant les tuiles explicites. */
function buildTileGrid(level: ModernLevelJson): ModernTileType[][] {
  const grid = Array.from({ length: level.height }, () => Array.from({ length: level.width }, () => level.defaultTile));
  for (const tile of level.tiles) {
    if (isInsideGrid(grid, tile.x, tile.y)) {
      grid[tile.y][tile.x] = tile.type;
    }
  }

  return grid;
}

/** Recherche les composants connectes d'un type logique de tuile. */
function findComponents(
  grid: readonly (readonly ModernTileType[])[],
  matches: (tile: ModernTileType) => boolean
): readonly LevelStructureComponent[] {
  const components: LevelStructureComponent[] = [];
  const visited = new Set<string>();
  for (let y = 0; y < grid.length; y += 1) {
    for (let x = 0; x < getGridWidth(grid); x += 1) {
      const key = toPointKey({ x, y });
      if (visited.has(key) || !matches(grid[y][x])) {
        continue;
      }
      components.push(floodComponent(grid, { x, y }, matches, visited));
    }
  }

  return components;
}

/** Etend un composant connecte depuis un point de depart. */
function floodComponent(
  grid: readonly (readonly ModernTileType[])[],
  start: ModernGridPoint,
  matches: (tile: ModernTileType) => boolean,
  visited: Set<string>
): LevelStructureComponent {
  const queue: ModernGridPoint[] = [start];
  let size = 0;
  let minX = start.x;
  let maxX = start.x;
  let minY = start.y;
  let maxY = start.y;
  visited.add(toPointKey(start));

  while (queue.length > 0) {
    const point = queue.shift();
    if (!point) {
      continue;
    }

    size += 1;
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
    for (const neighbour of getCardinalNeighbours(point)) {
      const key = toPointKey(neighbour);
      if (!isInsideGrid(grid, neighbour.x, neighbour.y) || visited.has(key) || !matches(grid[neighbour.y][neighbour.x])) {
        continue;
      }
      visited.add(key);
      queue.push(neighbour);
    }
  }

  return { size, minX, maxX, minY, maxY };
}

/** Resume des composants en nombres utiles au scoring. */
function summarizeComponents(components: readonly LevelStructureComponent[]): LevelStructureComponentSummary {
  const total = sum(components.map((component) => component.size));
  return {
    count: components.length,
    largest: Math.max(0, ...components.map((component) => component.size)),
    average: components.length > 0 ? total / components.length : 0,
    total
  };
}

/** Mesure les grandes lignes et formes lisibles de la grille. */
function analyzeSilhouette(grid: readonly (readonly ModernTileType[])[]): LevelStructureSilhouette {
  const width = getGridWidth(grid);
  const height = grid.length;
  const openRowRuns = grid.map((row) => getLongestRun(row, isOpenTile));
  const platformRowRuns = grid.map((row) => getLongestRun(row, (tile) => tile === "platform" || tile === "customPlatform"));
  const earthColumnRuns = Array.from({ length: width }, (_, x) => getLongestColumnRun(grid, x, (tile) => tile === "earth" || tile === "customEarth"));
  const openComponents = findComponents(grid, isOpenTile);

  return {
    longOpenRows: openRowRuns.filter((run) => run >= width * LONG_ROW_RATIO).length,
    longestOpenRowRun: Math.max(0, ...openRowRuns),
    longPlatformRows: platformRowRuns.filter((run) => run >= width * LONG_ROW_RATIO).length,
    longestPlatformRun: Math.max(0, ...platformRowRuns),
    longEarthColumns: earthColumnRuns.filter((run) => run >= height * LONG_COLUMN_RATIO).length,
    longestEarthColumnRun: Math.max(0, ...earthColumnRuns),
    openRectangles: countOpenRectangles(openComponents),
    repeatedBlockScore: countRepeatedBlockSignatures(grid),
    ringScore: estimateRingScore(grid, openComponents)
  };
}

/** Analyse les zones fonctionnelles visibles dans le JSON moderne. */
function analyzeFunctionalZones(level: ModernLevelJson, grid: readonly (readonly ModernTileType[])[]): LevelFunctionalZoneSummary {
  const diamondPoints = level.entities.filter((entity) => entity.type === "diamond");
  const dangerPoints = level.entities.filter((entity) => entity.type === "monster" || entity.type === "customMonster" || entity.type === "specialCreature");
  const openComponents = findComponents(grid, isOpenTile);
  return {
    spawnExitDistance: getManhattanDistance(level.playerSpawn, level.exit),
    diamondZones: clusterPoints(diamondPoints, FUNCTIONAL_ZONE_DISTANCE),
    dangerZones: clusterPoints(dangerPoints, FUNCTIONAL_ZONE_DISTANCE),
    optionalZones: openComponents.filter((component) => isOptionalOpenComponent(component, level, diamondPoints)).length
  };
}

/** Attribue des scores de familles a partir des mesures structurelles. */
function scoreStructureFamilies(
  level: ModernLevelJson,
  components: LevelStructureAnalysis["components"],
  silhouette: LevelStructureSilhouette,
  zones: LevelFunctionalZoneSummary
): readonly LevelStructureFamilyScore[] {
  const area = Math.max(1, level.width * level.height);
  const openDominance = components.open.total > 0 ? components.open.largest / components.open.total : 0;
  const rockDensity = countLevelTiles(level, "rock") / area;
  const diamondDensity = level.entities.filter((entity) => entity.type === "diamond").length / area;
  const scores: LevelStructureFamilyScore[] = [
    { family: "horizontalBands", score: clamp01(silhouette.longPlatformRows / 4 + silhouette.longestPlatformRun / level.width * 0.55) },
    { family: "roomGrid", score: clamp01(silhouette.openRectangles / 6 + silhouette.repeatedBlockScore / 24) },
    { family: "maze", score: clamp01(openDominance * 0.75 + silhouette.longOpenRows / 6 + zones.dangerZones / 18) },
    { family: "denseField", score: clamp01(rockDensity * 3 + diamondDensity * 5 + components.open.count / 60) },
    { family: "spiralFortress", score: clamp01(silhouette.ringScore + silhouette.longPlatformRows / 14 + components.platform.count / 36) },
    { family: "verticalPlatforms", score: clamp01(silhouette.longEarthColumns / Math.max(1, level.width) + components.platform.count / 28) },
    { family: "arena", score: clamp01(getArenaScore(level, components, silhouette)) }
  ];
  return scores.sort((left, right) => right.score - left.score || left.family.localeCompare(right.family));
}

/** Compte les grands composants ouverts ressemblant a des salles. */
function countOpenRectangles(components: readonly LevelStructureComponent[]): number {
  return components.filter((component) => {
    const width = component.maxX - component.minX + 1;
    const height = component.maxY - component.minY + 1;
    const area = width * height;
    return area >= MIN_OPEN_RECTANGLE_AREA && component.size / area >= 0.45;
  }).length;
}

/** Compte les signatures 4x4 qui se repetent, symptome de motifs humains. */
function countRepeatedBlockSignatures(grid: readonly (readonly ModernTileType[])[]): number {
  const signatures = new Map<string, number>();
  for (let y = 1; y < grid.length - 4; y += 2) {
    for (let x = 1; x < getGridWidth(grid) - 4; x += 2) {
      const signature = getBlockSignature(grid, x, y, 4, 4);
      signatures.set(signature, (signatures.get(signature) ?? 0) + 1);
    }
  }

  return [...signatures.values()].filter((count) => count >= 3).length;
}

/** Estime la presence d'anneaux ou enceintes en combinant taille et remplissage de composants ouverts. */
function estimateRingScore(
  grid: readonly (readonly ModernTileType[])[],
  openComponents: readonly LevelStructureComponent[]
): number {
  const width = getGridWidth(grid);
  const height = grid.length;
  const innerArea = Math.max(1, (width - 2) * (height - 2));
  const largeRooms = openComponents.filter((component) => component.size >= innerArea * 0.08);
  const enclosedLargeRooms = largeRooms.filter((component) => {
    const touchesBorder = component.minX <= 1 || component.minY <= 1 || component.maxX >= width - 2 || component.maxY >= height - 2;
    return !touchesBorder;
  });
  return clamp01(enclosedLargeRooms.length / 3 + largeRooms.length / 8);
}

/** Evalue si un niveau ressemble a une arene ou grande zone centrale. */
function getArenaScore(
  level: ModernLevelJson,
  components: LevelStructureAnalysis["components"],
  silhouette: LevelStructureSilhouette
): number {
  const area = Math.max(1, level.width * level.height);
  return components.open.largest / area * 2 + silhouette.openRectangles / 10;
}

/** Indique si un composant ouvert est une zone optionnelle plausible. */
function isOptionalOpenComponent(
  component: LevelStructureComponent,
  level: ModernLevelJson,
  diamondPoints: readonly ModernGridPoint[]
): boolean {
  const containsSpawn = isPointInsideComponent(level.playerSpawn, component);
  const containsExit = isPointInsideComponent(level.exit, component);
  const containsDiamond = diamondPoints.some((point) => isPointInsideComponent(point, component));
  return containsDiamond && !containsSpawn && !containsExit;
}

/** Regroupe des points proches en zones fonctionnelles. */
function clusterPoints(points: readonly ModernGridPoint[], maxDistance: number): number {
  const visited = new Set<string>();
  let clusters = 0;
  for (const point of points) {
    if (visited.has(toPointKey(point))) {
      continue;
    }

    clusters += 1;
    const queue: ModernGridPoint[] = [point];
    visited.add(toPointKey(point));
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) {
        continue;
      }
      for (const other of points) {
        const key = toPointKey(other);
        if (!visited.has(key) && getManhattanDistance(current, other) <= maxDistance) {
          visited.add(key);
          queue.push(other);
        }
      }
    }
  }

  return clusters;
}

/** Retourne le plus long run horizontal d'une ligne. */
function getLongestRun(row: readonly ModernTileType[], matches: (tile: ModernTileType) => boolean): number {
  let current = 0;
  let longest = 0;
  for (const tile of row) {
    if (matches(tile)) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }

  return longest;
}

/** Retourne le plus long run vertical d'une colonne. */
function getLongestColumnRun(
  grid: readonly (readonly ModernTileType[])[],
  x: number,
  matches: (tile: ModernTileType) => boolean
): number {
  let current = 0;
  let longest = 0;
  for (let y = 0; y < grid.length; y += 1) {
    if (matches(grid[y][x])) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }

  return longest;
}

/** Cree une signature locale compacte pour detecter les repetitions de motifs. */
function getBlockSignature(
  grid: readonly (readonly ModernTileType[])[],
  startX: number,
  startY: number,
  width: number,
  height: number
): string {
  const rows: string[] = [];
  for (let y = startY; y < startY + height; y += 1) {
    rows.push(grid[y].slice(startX, startX + width).map(getTileSignatureChar).join(""));
  }

  return rows.join("/");
}

/** Compte les tuiles explicites et implicites d'un type dans un niveau. */
function countLevelTiles(level: ModernLevelJson, tileType: ModernTileType): number {
  const grid = buildTileGrid(level);
  return grid.reduce((total, row) => total + row.filter((tile) => tile === tileType).length, 0);
}

/** Indique si une tuile participe aux espaces ouverts ou occupables. */
function isOpenTile(tile: ModernTileType): boolean {
  return tile === "empty" || tile === "diamond" || tile === "monster" || tile === "customMonster" || tile === "specialCreature";
}

/** Indique si une tuile est un obstacle solide hors terre creusable. */
function isObstacleTile(tile: ModernTileType): boolean {
  return tile === "border" || tile === "rock" || tile === "transformerBlock";
}

/** Convertit une tuile en caractere de signature structurelle. */
function getTileSignatureChar(tile: ModernTileType): string {
  if (tile === "empty") return " ";
  if (tile === "earth" || tile === "customEarth") return ".";
  if (tile === "platform" || tile === "customPlatform") return "=";
  if (tile === "rock") return "o";
  if (tile === "diamond") return "*";
  if (tile === "monster" || tile === "customMonster") return "m";
  if (tile === "specialCreature") return "s";
  if (tile === "transformerBlock") return "t";
  return "#";
}

/** Indique si un point se trouve dans la boite englobante d'un composant. */
function isPointInsideComponent(point: ModernGridPoint, component: LevelStructureComponent): boolean {
  return point.x >= component.minX && point.x <= component.maxX && point.y >= component.minY && point.y <= component.maxY;
}

/** Retourne les voisins cardinaux d'un point. */
function getCardinalNeighbours(point: ModernGridPoint): readonly ModernGridPoint[] {
  return [
    { x: point.x - 1, y: point.y },
    { x: point.x + 1, y: point.y },
    { x: point.x, y: point.y - 1 },
    { x: point.x, y: point.y + 1 }
  ];
}

/** Indique si une coordonnee appartient a la grille. */
function isInsideGrid(grid: readonly (readonly ModernTileType[])[], x: number, y: number): boolean {
  return y >= 0 && y < grid.length && x >= 0 && x < getGridWidth(grid);
}

/** Calcule la distance Manhattan entre deux points. */
function getManhattanDistance(first: ModernGridPoint, second: ModernGridPoint): number {
  return Math.abs(first.x - second.x) + Math.abs(first.y - second.y);
}

/** Encode un point pour les ensembles de visite. */
function toPointKey(point: ModernGridPoint): string {
  return `${point.x}:${point.y}`;
}

/** Retourne la largeur d'une grille. */
function getGridWidth(grid: readonly (readonly ModernTileType[])[]): number {
  return grid[0]?.length ?? 0;
}

/** Somme une serie numerique. */
function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/** Contraint un score dans la plage `0..1`. */
function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** Composant connecte interne avec boite englobante. */
interface LevelStructureComponent {
  /** Nombre de cellules du composant. */
  readonly size: number;
  /** Borne gauche. */
  readonly minX: number;
  /** Borne droite. */
  readonly maxX: number;
  /** Borne haute. */
  readonly minY: number;
  /** Borne basse. */
  readonly maxY: number;
}
