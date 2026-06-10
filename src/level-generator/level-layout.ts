/**
 * Role: Convertit un graphe gameplay abstrait en layout spatial de zones.
 * Scope: Place zones, connexions et carte d'occupation sans produire encore de tuiles finales.
 * ISO: Le placement est moderne et intentionnel; il ne copie pas les coordonnees des niveaux TO8.
 * Notes: La phase suivante rasterisera ce layout en terre, vide, plateformes et bordures internes.
 */

import type { LevelDesignArchetype } from "./design-intent";
import type {
  LevelPlanEdgeKind,
  LevelPlanGraph,
  LevelPlanIntensity,
  LevelPlanNode,
  LevelPlanNodeKind
} from "./level-plan-graph";
import type { SeededRandom } from "./seeded-random";

/** Forme spatiale abstraite d'une zone avant rasterisation. */
export type LevelLayoutZoneShape = "rectangle" | "corridor" | "ring" | "freeform";

/** Point entier dans la future grille de niveau. */
export interface LevelLayoutPoint {
  /** Colonne de grille. */
  readonly x: number;
  /** Ligne de grille. */
  readonly y: number;
}

/** Rectangle entier dans la future grille de niveau. */
export interface LevelLayoutRect extends LevelLayoutPoint {
  /** Largeur en cellules. */
  readonly width: number;
  /** Hauteur en cellules. */
  readonly height: number;
}

/** Zone spatiale associee a un noeud du graphe gameplay. */
export interface LevelLayoutZone {
  /** Identifiant stable de zone. */
  readonly id: string;
  /** Noeud de plan associe. */
  readonly nodeId: string;
  /** Role gameplay herite du noeud. */
  readonly nodeKind: LevelPlanNodeKind;
  /** Archetype local qui guidera la rasterisation. */
  readonly archetype: LevelDesignArchetype;
  /** Forme de zone a rasteriser. */
  readonly shape: LevelLayoutZoneShape;
  /** Rectangle englobant de la zone. */
  readonly rect: LevelLayoutRect;
  /** Centre de zone utilise pour les connexions. */
  readonly center: LevelLayoutPoint;
  /** Intensite abstraite de risque/effort. */
  readonly intensity: LevelPlanIntensity;
  /** Budget diamant herite du graphe. */
  readonly diamondBudget: number;
  /** Budget danger herite du graphe. */
  readonly dangerBudget: number;
  /** Indique si la zone appartient a une branche optionnelle. */
  readonly optional: boolean;
}

/** Connexion spatiale entre deux zones. */
export interface LevelLayoutConnection {
  /** Identifiant stable de connexion. */
  readonly id: string;
  /** Arete de graphe associee. */
  readonly edgeId: string;
  /** Zone source. */
  readonly fromZoneId: string;
  /** Zone destination. */
  readonly toZoneId: string;
  /** Role gameplay de la connexion. */
  readonly kind: LevelPlanEdgeKind;
  /** Chemin Manhattan abstrait entre les zones. */
  readonly path: readonly LevelLayoutPoint[];
  /** Intensite abstraite du passage. */
  readonly intensity: LevelPlanIntensity;
}

/** Layout complet avant rasterisation en tuiles. */
export interface LevelLayout {
  /** Graphe source conserve pour debug et scoring. */
  readonly graph: LevelPlanGraph;
  /** Largeur cible en cellules. */
  readonly width: number;
  /** Hauteur cible en cellules. */
  readonly height: number;
  /** Zones spatiales issues des noeuds. */
  readonly zones: readonly LevelLayoutZone[];
  /** Connexions spatiales issues des aretes. */
  readonly connections: readonly LevelLayoutConnection[];
  /** Carte de zones separee des futures tuiles, `null` pour cellule non reservee. */
  readonly zoneMap: readonly (readonly (string | null)[])[];
  /** Metadonnees lisibles pour debug et futur scoring. */
  readonly metadata: LevelLayoutMetadata;
}

/** Metadonnees compactes du layout spatial. */
export interface LevelLayoutMetadata {
  /** Strategie dominante utilisee pour placer le chemin principal. */
  readonly strategy: LevelLayoutStrategy;
  /** Nombre de zones placees. */
  readonly zoneCount: number;
  /** Nombre de connexions placees. */
  readonly connectionCount: number;
  /** Ratio de cellules reservees par les zones. */
  readonly occupiedRatio: number;
  /** Resume lisible pour logs et futurs outils debug. */
  readonly summary: string;
}

/** Strategie de layout derivee de l'intention principale. */
export type LevelLayoutStrategy =
  | "horizontalBands"
  | "rooms"
  | "maze"
  | "spiral"
  | "fortress"
  | "denseField"
  | "centralArena"
  | "verticalRoute";

/** Marge minimale preservee pour les bordures TO8. */
const LEVEL_LAYOUT_MARGIN = 2;
/** Taille minimale d'une zone de gameplay. */
const MIN_ZONE_SIZE = 3;
/** Taille maximale d'une zone avant rasterisation pour conserver une lecture claire. */
const MAX_ZONE_SIZE = 9;
/** Rayon de recherche pour replacer une zone qui chevauche une autre. */
const FREE_RECT_SEARCH_RADIUS = 8;

/** Cree un layout spatial complet depuis un graphe gameplay abstrait. */
export function createLevelLayout(graph: LevelPlanGraph, random: SeededRandom): LevelLayout {
  const width = Math.max(12, graph.intent.parameters.width);
  const height = Math.max(10, graph.intent.parameters.height);
  const strategy = resolveLayoutStrategy(graph.intent.primaryArchetype, graph.intent.secondaryArchetype);
  const zoneBuilder = new LevelLayoutZoneBuilder(width, height, random.fork("zones"));
  const mainPathZones = placeMainPathZones(graph, strategy, zoneBuilder, random.fork("main"));
  const branchZones = placeOptionalBranchZones(graph, zoneBuilder, mainPathZones, random.fork("branches"));
  const zones = [...mainPathZones, ...branchZones];
  const connections = createLayoutConnections(graph, zones, random.fork("connections"));
  const zoneMap = createZoneMap(width, height, zones);
  const metadata = createLayoutMetadata(strategy, width, height, zones, connections);

  return {
    graph,
    width,
    height,
    zones,
    connections,
    zoneMap,
    metadata
  };
}

/** Choisit la strategie de layout principale depuis l'intention. */
function resolveLayoutStrategy(
  primaryArchetype: LevelDesignArchetype,
  secondaryArchetype: LevelDesignArchetype | null
): LevelLayoutStrategy {
  const archetype = primaryArchetype === "hybrid" ? secondaryArchetype ?? "rooms" : primaryArchetype;
  if (archetype === "horizontalBands") return "horizontalBands";
  if (archetype === "rooms") return "rooms";
  if (archetype === "maze") return "maze";
  if (archetype === "spiral") return "spiral";
  if (archetype === "fortress") return "fortress";
  if (archetype === "denseField") return "denseField";
  if (archetype === "centralArena") return "centralArena";
  return "verticalRoute";
}

/** Place les zones du chemin principal selon la strategie choisie. */
function placeMainPathZones(
  graph: LevelPlanGraph,
  strategy: LevelLayoutStrategy,
  zoneBuilder: LevelLayoutZoneBuilder,
  random: SeededRandom
): readonly LevelLayoutZone[] {
  const mainNodes = graph.mainPathNodeIds
    .map((id) => findNodeById(graph, id))
    .flatMap((node) => node ? [node] : []);
  const anchors = createMainPathAnchors(strategy, zoneBuilder.width, zoneBuilder.height, mainNodes.length);
  return mainNodes.map((node, index) => {
    const rect = createZoneRectAroundAnchor(node, anchors[index], zoneBuilder.width, zoneBuilder.height, random.fork(node.id));
    return zoneBuilder.createZone(node, rect);
  });
}

/** Place les zones optionnelles autour de leur ancre de chemin principal. */
function placeOptionalBranchZones(
  graph: LevelPlanGraph,
  zoneBuilder: LevelLayoutZoneBuilder,
  mainPathZones: readonly LevelLayoutZone[],
  random: SeededRandom
): readonly LevelLayoutZone[] {
  const zones: LevelLayoutZone[] = [];
  for (const nodeId of graph.optionalBranchNodeIds) {
    const node = findNodeById(graph, nodeId);
    const incomingEdge = graph.edges.find((edge) => edge.to === nodeId);
    const anchorZone = mainPathZones.find((zone) => zone.nodeId === incomingEdge?.from) ?? mainPathZones[random.integer(0, mainPathZones.length - 1)];
    if (!node || !anchorZone) {
      continue;
    }

    const rect = createBranchRect(node, anchorZone, zoneBuilder.width, zoneBuilder.height, random.fork(node.id));
    zones.push(zoneBuilder.createZone(node, rect));
  }

  return zones;
}

/** Cree les connexions spatiales entre zones depuis les aretes du graphe. */
function createLayoutConnections(
  graph: LevelPlanGraph,
  zones: readonly LevelLayoutZone[],
  random: SeededRandom
): readonly LevelLayoutConnection[] {
  return graph.edges.flatMap((edge, index) => {
    const fromZone = zones.find((zone) => zone.nodeId === edge.from);
    const toZone = zones.find((zone) => zone.nodeId === edge.to);
    if (!fromZone || !toZone) {
      return [];
    }

    return [{
      id: `connection-${(index + 1).toString().padStart(2, "0")}`,
      edgeId: edge.id,
      fromZoneId: fromZone.id,
      toZoneId: toZone.id,
      kind: edge.kind,
      path: createConnectionPath(fromZone.center, toZone.center, random.fork(edge.id)),
      intensity: edge.intensity
    }];
  });
}

/** Cree les points d'ancrage du chemin principal pour une strategie. */
function createMainPathAnchors(
  strategy: LevelLayoutStrategy,
  width: number,
  height: number,
  count: number
): readonly LevelLayoutPoint[] {
  if (strategy === "horizontalBands") return createHorizontalBandAnchors(width, height, count);
  if (strategy === "rooms") return createRoomGridAnchors(width, height, count);
  if (strategy === "maze") return createMazeAnchors(width, height, count);
  if (strategy === "spiral") return createSpiralAnchors(width, height, count);
  if (strategy === "fortress") return createFortressAnchors(width, height, count);
  if (strategy === "denseField") return createDenseFieldAnchors(width, height, count);
  if (strategy === "centralArena") return createCentralArenaAnchors(width, height, count);
  return createVerticalRouteAnchors(width, height, count);
}

/** Cree des ancres en bandes horizontales. */
function createHorizontalBandAnchors(width: number, height: number, count: number): readonly LevelLayoutPoint[] {
  return Array.from({ length: count }, (_, index) => {
    const band = index % 3;
    const progress = count <= 1 ? 0 : index / (count - 1);
    return {
      x: interpolate(LEVEL_LAYOUT_MARGIN + 2, width - LEVEL_LAYOUT_MARGIN - 3, progress),
      y: interpolate(LEVEL_LAYOUT_MARGIN + 2, height - LEVEL_LAYOUT_MARGIN - 3, (band + 0.5) / 3)
    };
  });
}

/** Cree des ancres de chambres connectees en grille souple. */
function createRoomGridAnchors(width: number, height: number, count: number): readonly LevelLayoutPoint[] {
  const columns = Math.max(2, Math.ceil(Math.sqrt(count)));
  const rows = Math.max(2, Math.ceil(count / columns));
  return Array.from({ length: count }, (_, index) => ({
    x: interpolate(LEVEL_LAYOUT_MARGIN + 3, width - LEVEL_LAYOUT_MARGIN - 4, (index % columns + 0.5) / columns),
    y: interpolate(LEVEL_LAYOUT_MARGIN + 3, height - LEVEL_LAYOUT_MARGIN - 4, (Math.floor(index / columns) + 0.5) / rows)
  }));
}

/** Cree des ancres de labyrinthe avec un parcours serpentin lisible. */
function createMazeAnchors(width: number, height: number, count: number): readonly LevelLayoutPoint[] {
  const rows = Math.max(2, Math.min(4, Math.ceil(count / 3)));
  return Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / Math.ceil(count / rows));
    const columnProgress = (index % Math.ceil(count / rows)) / Math.max(1, Math.ceil(count / rows) - 1);
    const progress = row % 2 === 0 ? columnProgress : 1 - columnProgress;
    return {
      x: interpolate(LEVEL_LAYOUT_MARGIN + 2, width - LEVEL_LAYOUT_MARGIN - 3, progress),
      y: interpolate(LEVEL_LAYOUT_MARGIN + 2, height - LEVEL_LAYOUT_MARGIN - 3, (row + 0.5) / rows)
    };
  });
}

/** Cree des ancres suivant une spirale rectangulaire. */
function createSpiralAnchors(width: number, height: number, count: number): readonly LevelLayoutPoint[] {
  const bounds = {
    left: LEVEL_LAYOUT_MARGIN + 2,
    top: LEVEL_LAYOUT_MARGIN + 2,
    right: width - LEVEL_LAYOUT_MARGIN - 3,
    bottom: height - LEVEL_LAYOUT_MARGIN - 3
  };
  const anchors: LevelLayoutPoint[] = [];
  for (let index = 0; index < count; index += 1) {
    const turn = index / Math.max(1, count - 1);
    const shrink = Math.floor(turn * Math.min(width, height) * 0.18);
    const side = index % 4;
    const local = Math.floor(index / 4) / Math.max(1, Math.ceil(count / 4) - 1);
    const left = bounds.left + shrink;
    const right = bounds.right - shrink;
    const top = bounds.top + shrink;
    const bottom = bounds.bottom - shrink;
    if (side === 0) anchors.push({ x: interpolate(left, right, local), y: top });
    if (side === 1) anchors.push({ x: right, y: interpolate(top, bottom, local) });
    if (side === 2) anchors.push({ x: interpolate(right, left, local), y: bottom });
    if (side === 3) anchors.push({ x: left, y: interpolate(bottom, top, local) });
  }

  return anchors;
}

/** Cree des ancres autour d'une enceinte centrale. */
function createFortressAnchors(width: number, height: number, count: number): readonly LevelLayoutPoint[] {
  const anchors = createSpiralAnchors(width, height, count);
  return anchors.map((anchor, index) => index === Math.floor(count / 2)
    ? { x: Math.floor(width / 2), y: Math.floor(height / 2) }
    : anchor);
}

/** Cree des ancres courtes et compactes pour un champ dense. */
function createDenseFieldAnchors(width: number, height: number, count: number): readonly LevelLayoutPoint[] {
  return Array.from({ length: count }, (_, index) => ({
    x: interpolate(LEVEL_LAYOUT_MARGIN + 3, width - LEVEL_LAYOUT_MARGIN - 4, count <= 1 ? 0 : index / (count - 1)),
    y: interpolate(height * 0.32, height * 0.68, index % 2 === 0 ? 0.25 : 0.75)
  }));
}

/** Cree des ancres autour d'une grande zone centrale. */
function createCentralArenaAnchors(width: number, height: number, count: number): readonly LevelLayoutPoint[] {
  const center = { x: Math.floor(width / 2), y: Math.floor(height / 2) };
  return Array.from({ length: count }, (_, index) => {
    if (index === Math.floor(count / 2)) return center;
    const angle = Math.PI * 2 * index / Math.max(1, count);
    return {
      x: clampInteger(Math.round(center.x + Math.cos(angle) * width * 0.32), LEVEL_LAYOUT_MARGIN + 2, width - LEVEL_LAYOUT_MARGIN - 3),
      y: clampInteger(Math.round(center.y + Math.sin(angle) * height * 0.32), LEVEL_LAYOUT_MARGIN + 2, height - LEVEL_LAYOUT_MARGIN - 3)
    };
  });
}

/** Cree des ancres dominant la progression verticale. */
function createVerticalRouteAnchors(width: number, height: number, count: number): readonly LevelLayoutPoint[] {
  return Array.from({ length: count }, (_, index) => ({
    x: interpolate(width * 0.25, width * 0.75, index % 2 === 0 ? 0.2 : 0.8),
    y: interpolate(LEVEL_LAYOUT_MARGIN + 2, height - LEVEL_LAYOUT_MARGIN - 3, count <= 1 ? 0 : index / (count - 1))
  }));
}

/** Cree un rectangle de zone autour d'une ancre. */
function createZoneRectAroundAnchor(
  node: LevelPlanNode,
  anchor: LevelLayoutPoint,
  width: number,
  height: number,
  random: SeededRandom
): LevelLayoutRect {
  const baseSize = getZoneBaseSize(node);
  const zoneWidth = clampInteger(baseSize + random.integer(-1, 2), MIN_ZONE_SIZE, MAX_ZONE_SIZE);
  const zoneHeight = clampInteger(baseSize + random.integer(-1, 1), MIN_ZONE_SIZE, MAX_ZONE_SIZE);
  return clampRectToPlayableArea({
    x: anchor.x - Math.floor(zoneWidth / 2),
    y: anchor.y - Math.floor(zoneHeight / 2),
    width: zoneWidth,
    height: zoneHeight
  }, width, height);
}

/** Cree un rectangle de branche pres d'une zone d'ancrage. */
function createBranchRect(
  node: LevelPlanNode,
  anchorZone: LevelLayoutZone,
  width: number,
  height: number,
  random: SeededRandom
): LevelLayoutRect {
  const distance = random.integer(4, 8);
  const direction = random.pick([
    { x: -1, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: -1 },
    { x: 0, y: 1 }
  ]);
  const anchor = {
    x: anchorZone.center.x + direction.x * distance,
    y: anchorZone.center.y + direction.y * distance
  };
  return createZoneRectAroundAnchor(node, anchor, width, height, random.fork("rect"));
}

/** Calcule une taille de base selon role et intensite. */
function getZoneBaseSize(node: LevelPlanNode): number {
  if (node.kind === "corridor") return 3;
  if (node.kind === "start" || node.kind === "exit") return 4;
  if (node.kind === "diamondObjective" || node.kind === "reward") return 5;
  if (node.kind === "implicitLock" || node.kind === "danger") return node.intensity === "high" ? 6 : 5;
  return node.intensity === "high" ? 7 : 6;
}

/** Cree un chemin Manhattan entre deux centres de zones. */
function createConnectionPath(from: LevelLayoutPoint, to: LevelLayoutPoint, random: SeededRandom): readonly LevelLayoutPoint[] {
  return random.chance(0.5)
    ? [...createHorizontalPath(from.x, to.x, from.y), ...createVerticalPath(from.y, to.y, to.x).slice(1)]
    : [...createVerticalPath(from.y, to.y, from.x), ...createHorizontalPath(from.x, to.x, to.y).slice(1)];
}

/** Cree une portion horizontale de chemin. */
function createHorizontalPath(fromX: number, toX: number, y: number): readonly LevelLayoutPoint[] {
  const step = fromX <= toX ? 1 : -1;
  const path: LevelLayoutPoint[] = [];
  for (let x = fromX; x !== toX + step; x += step) {
    path.push({ x, y });
  }
  return path;
}

/** Cree une portion verticale de chemin. */
function createVerticalPath(fromY: number, toY: number, x: number): readonly LevelLayoutPoint[] {
  const step = fromY <= toY ? 1 : -1;
  const path: LevelLayoutPoint[] = [];
  for (let y = fromY; y !== toY + step; y += step) {
    path.push({ x, y });
  }
  return path;
}

/** Cree la carte de zones separee des futures tuiles. */
function createZoneMap(width: number, height: number, zones: readonly LevelLayoutZone[]): readonly (readonly (string | null)[])[] {
  const map = Array.from({ length: height }, () => Array.from({ length: width }, (): string | null => null));
  for (const zone of zones) {
    for (let y = zone.rect.y; y < zone.rect.y + zone.rect.height; y += 1) {
      for (let x = zone.rect.x; x < zone.rect.x + zone.rect.width; x += 1) {
        if (x >= 0 && y >= 0 && x < width && y < height) {
          map[y][x] = zone.id;
        }
      }
    }
  }

  return map;
}

/** Cree les metadonnees du layout. */
function createLayoutMetadata(
  strategy: LevelLayoutStrategy,
  width: number,
  height: number,
  zones: readonly LevelLayoutZone[],
  connections: readonly LevelLayoutConnection[]
): LevelLayoutMetadata {
  const occupiedCells = zones.reduce((total, zone) => total + zone.rect.width * zone.rect.height, 0);
  const occupiedRatio = occupiedCells / Math.max(1, width * height);
  return {
    strategy,
    zoneCount: zones.length,
    connectionCount: connections.length,
    occupiedRatio,
    summary: [
      `Layout ${strategy}`,
      `zones=${zones.length}`,
      `connections=${connections.length}`,
      `occupied=${occupiedRatio.toFixed(2)}`
    ].join(" | ")
  };
}

/** Retourne un noeud par id. */
function findNodeById(graph: LevelPlanGraph, id: string): LevelPlanNode | undefined {
  return graph.nodes.find((node) => node.id === id);
}

/** Interpole et arrondit entre deux bornes. */
function interpolate(from: number, to: number, ratio: number): number {
  return Math.round(from + (to - from) * ratio);
}

/** Contraint un rectangle aux marges jouables. */
function clampRectToPlayableArea(rect: LevelLayoutRect, width: number, height: number): LevelLayoutRect {
  return {
    x: clampInteger(rect.x, LEVEL_LAYOUT_MARGIN, Math.max(LEVEL_LAYOUT_MARGIN, width - LEVEL_LAYOUT_MARGIN - rect.width)),
    y: clampInteger(rect.y, LEVEL_LAYOUT_MARGIN, Math.max(LEVEL_LAYOUT_MARGIN, height - LEVEL_LAYOUT_MARGIN - rect.height)),
    width: rect.width,
    height: rect.height
  };
}

/** Contraint un entier dans une plage. */
function clampInteger(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

/** Constructeur de zones qui evite les chevauchements incoherents. */
class LevelLayoutZoneBuilder {
  /** Zones deja placees. */
  private readonly zones: LevelLayoutZone[] = [];
  /** Compteur interne des ids de zones. */
  private nextZoneId = 1;

  /** Dimensions cible et PRNG de replacement. */
  constructor(
    readonly width: number,
    readonly height: number,
    private readonly random: SeededRandom
  ) {}

  /** Cree une zone et la replace pres de sa position si besoin. */
  createZone(node: LevelPlanNode, requestedRect: LevelLayoutRect): LevelLayoutZone {
    const rect = this.findFreeRect(requestedRect);
    const zone: LevelLayoutZone = {
      id: `zone-${this.nextZoneId.toString().padStart(2, "0")}`,
      nodeId: node.id,
      nodeKind: node.kind,
      archetype: node.archetype,
      shape: this.resolveZoneShape(node),
      rect,
      center: getRectCenter(rect),
      intensity: node.intensity,
      diamondBudget: node.diamondBudget,
      dangerBudget: node.dangerBudget,
      optional: node.optional
    };
    this.nextZoneId += 1;
    this.zones.push(zone);
    return zone;
  }

  /** Trouve un rectangle libre proche du rectangle demande. */
  private findFreeRect(requestedRect: LevelLayoutRect): LevelLayoutRect {
    if (!this.overlapsExisting(requestedRect)) {
      return requestedRect;
    }

    for (let radius = 1; radius <= FREE_RECT_SEARCH_RADIUS; radius += 1) {
      const candidates = this.createShiftCandidates(requestedRect, radius);
      for (const candidate of candidates) {
        const clamped = clampRectToPlayableArea(candidate, this.width, this.height);
        if (!this.overlapsExisting(clamped)) {
          return clamped;
        }
      }
    }

    return requestedRect;
  }

  /** Cree des positions candidates autour d'un rectangle. */
  private createShiftCandidates(rect: LevelLayoutRect, radius: number): readonly LevelLayoutRect[] {
    const shifts = [
      { x: -radius, y: 0 },
      { x: radius, y: 0 },
      { x: 0, y: -radius },
      { x: 0, y: radius },
      { x: -radius, y: -radius },
      { x: radius, y: -radius },
      { x: -radius, y: radius },
      { x: radius, y: radius }
    ];
    return shifts
      .sort(() => this.random.next() - 0.5)
      .map((shift) => ({ ...rect, x: rect.x + shift.x, y: rect.y + shift.y }));
  }

  /** Indique si un rectangle chevauche une zone deja placee. */
  private overlapsExisting(rect: LevelLayoutRect): boolean {
    return this.zones.some((zone) => doRectsOverlap(rect, zone.rect));
  }

  /** Choisit une forme de zone selon role et archetype local. */
  private resolveZoneShape(node: LevelPlanNode): LevelLayoutZoneShape {
    if (node.kind === "corridor") return "corridor";
    if (node.archetype === "spiral" || node.archetype === "fortress") return "ring";
    if (node.archetype === "maze" || node.archetype === "denseField") return "freeform";
    return "rectangle";
  }
}

/** Calcule le centre entier d'un rectangle. */
function getRectCenter(rect: LevelLayoutRect): LevelLayoutPoint {
  return {
    x: rect.x + Math.floor(rect.width / 2),
    y: rect.y + Math.floor(rect.height / 2)
  };
}

/** Indique si deux rectangles se chevauchent avec une cellule de respiration. */
function doRectsOverlap(first: LevelLayoutRect, second: LevelLayoutRect): boolean {
  return first.x - 1 < second.x + second.width
    && first.x + first.width + 1 > second.x
    && first.y - 1 < second.y + second.height
    && first.y + first.height + 1 > second.y;
}
