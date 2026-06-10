/**
 * Role: Construit un graphe gameplay abstrait depuis une intention de design.
 * Scope: Decrit progression, branches, boucles et roles de zones sans choisir de positions de grille.
 * ISO: Aucun layout TO8 n'est encode ici; ce graphe est une couche moderne avant rasterisation.
 * Notes: Le futur layout utilisera ce graphe pour dessiner des structures coherentes et non du bruit.
 */

import type { LevelDesignArchetype, LevelDesignIntent } from "./design-intent";
import type { SeededRandom } from "./seeded-random";

/** Role fonctionnel d'un noeud du plan abstrait. */
export type LevelPlanNodeKind =
  | "start"
  | "room"
  | "corridor"
  | "diamondObjective"
  | "danger"
  | "reward"
  | "implicitLock"
  | "exit";

/** Role fonctionnel d'une connexion entre deux noeuds. */
export type LevelPlanEdgeKind =
  | "mainPath"
  | "optionalBranch"
  | "loop"
  | "shortcut"
  | "rewardDeadEnd";

/** Intensite abstraite associee a un noeud ou une arete. */
export type LevelPlanIntensity = "low" | "medium" | "high";

/** Noeud abstrait du futur niveau. */
export interface LevelPlanNode {
  /** Identifiant stable dans le graphe genere. */
  readonly id: string;
  /** Role gameplay du noeud. */
  readonly kind: LevelPlanNodeKind;
  /** Position ordonnee sur le chemin principal, ou `null` pour une branche. */
  readonly mainPathIndex: number | null;
  /** Archetype local qui guidera le futur layout de zone. */
  readonly archetype: LevelDesignArchetype;
  /** Intensite de risque ou d'effort attendue dans cette zone. */
  readonly intensity: LevelPlanIntensity;
  /** Indique si la zone doit contenir des diamants. */
  readonly diamondBudget: number;
  /** Indique si la zone doit contenir des dangers. */
  readonly dangerBudget: number;
  /** Indique si cette zone est optionnelle pour finir le niveau. */
  readonly optional: boolean;
}

/** Arete abstraite entre deux noeuds du plan. */
export interface LevelPlanEdge {
  /** Identifiant stable de l'arete. */
  readonly id: string;
  /** Noeud source. */
  readonly from: string;
  /** Noeud destination. */
  readonly to: string;
  /** Role gameplay de la connexion. */
  readonly kind: LevelPlanEdgeKind;
  /** Intensite attendue du passage. */
  readonly intensity: LevelPlanIntensity;
}

/** Graphe gameplay produit avant layout spatial. */
export interface LevelPlanGraph {
  /** Intention source conservee pour debug et scoring. */
  readonly intent: LevelDesignIntent;
  /** Noeuds abstraits du plan. */
  readonly nodes: readonly LevelPlanNode[];
  /** Connexions abstraites entre noeuds. */
  readonly edges: readonly LevelPlanEdge[];
  /** Ids du chemin principal, de depart vers sortie. */
  readonly mainPathNodeIds: readonly string[];
  /** Ids des branches optionnelles. */
  readonly optionalBranchNodeIds: readonly string[];
  /** Ids des aretes de boucle ou raccourci. */
  readonly loopEdgeIds: readonly string[];
  /** Metadonnees compactes pour debug et futur scoring. */
  readonly metadata: LevelPlanGraphMetadata;
}

/** Metadonnees lisibles du graphe abstrait. */
export interface LevelPlanGraphMetadata {
  /** Nombre de noeuds sur le chemin principal. */
  readonly mainPathLength: number;
  /** Nombre de branches optionnelles. */
  readonly optionalBranches: number;
  /** Nombre de boucles et raccourcis. */
  readonly loops: number;
  /** Budget total de diamants abstraits. */
  readonly diamondBudget: number;
  /** Budget total de dangers abstraits. */
  readonly dangerBudget: number;
  /** Resume lisible pour logs et debug UI. */
  readonly summary: string;
}

/** Longueur minimale du chemin principal pour avoir un vrai debut/milieu/fin. */
const MIN_MAIN_PATH_LENGTH = 4;
/** Longueur maximale avant layout pour eviter un graphe trop bavard. */
const MAX_MAIN_PATH_LENGTH = 10;
/** Nombre maximal de branches optionnelles creees a cette phase. */
const MAX_OPTIONAL_BRANCHES = 6;
/** Nombre maximal de boucles abstraites creees a cette phase. */
const MAX_LOOP_EDGES = 4;

/** Genere un graphe gameplay coherent depuis une intention de design. */
export function createLevelPlanGraph(intent: LevelDesignIntent, random: SeededRandom): LevelPlanGraph {
  const nodeBuilder = new LevelPlanNodeBuilder(intent);
  const edgeBuilder = new LevelPlanEdgeBuilder();
  const mainPathNodeIds = createMainPath(intent, random.fork("main-path"), nodeBuilder, edgeBuilder);
  const optionalBranchNodeIds = createOptionalBranches(intent, random.fork("branches"), mainPathNodeIds, nodeBuilder, edgeBuilder);
  const loopEdgeIds = createLoops(intent, random.fork("loops"), mainPathNodeIds, edgeBuilder);
  const nodes = nodeBuilder.nodes;
  const edges = edgeBuilder.edges;
  const metadata = createGraphMetadata(intent, nodes, mainPathNodeIds, optionalBranchNodeIds, loopEdgeIds);

  return {
    intent,
    nodes,
    edges,
    mainPathNodeIds,
    optionalBranchNodeIds,
    loopEdgeIds,
    metadata
  };
}

/** Cree le chemin principal garanti entre depart et sortie. */
function createMainPath(
  intent: LevelDesignIntent,
  random: SeededRandom,
  nodeBuilder: LevelPlanNodeBuilder,
  edgeBuilder: LevelPlanEdgeBuilder
): readonly string[] {
  const length = getMainPathLength(intent, random);
  const nodeIds: string[] = [];
  for (let index = 0; index < length; index += 1) {
    const kind = getMainPathNodeKind(index, length, intent, random.fork(`kind-${index}`));
    const node = nodeBuilder.createNode(kind, index, {
      optional: false,
      intensity: getMainPathIntensity(index, length, intent),
      diamondBudget: getMainPathDiamondBudget(kind, index, length, intent),
      dangerBudget: getMainPathDangerBudget(kind, intent)
    });
    nodeIds.push(node.id);
    if (index > 0) {
      edgeBuilder.createEdge(nodeIds[index - 1], node.id, "mainPath", getMainPathIntensity(index, length, intent));
    }
  }

  return nodeIds;
}

/** Ajoute des branches optionnelles contenant recompenses, dangers ou impasses utiles. */
function createOptionalBranches(
  intent: LevelDesignIntent,
  random: SeededRandom,
  mainPathNodeIds: readonly string[],
  nodeBuilder: LevelPlanNodeBuilder,
  edgeBuilder: LevelPlanEdgeBuilder
): readonly string[] {
  const branchCount = Math.min(MAX_OPTIONAL_BRANCHES, Math.round(intent.traits.branching * 5 + intent.traits.optionalZoneRatio * 3));
  const branchNodeIds: string[] = [];
  for (let branchIndex = 0; branchIndex < branchCount; branchIndex += 1) {
    const anchorIndex = random.integer(1, Math.max(1, mainPathNodeIds.length - 2));
    const branchLength = random.chance(intent.traits.complexity) ? 2 : 1;
    let previousNodeId = mainPathNodeIds[anchorIndex];
    for (let step = 0; step < branchLength; step += 1) {
      const kind = getOptionalNodeKind(intent, random.fork(`branch-${branchIndex}-${step}`), step, branchLength);
      const node = nodeBuilder.createNode(kind, null, {
        optional: true,
        intensity: getBranchIntensity(intent, random.fork(`branch-intensity-${branchIndex}-${step}`)),
        diamondBudget: kind === "reward" || kind === "diamondObjective" ? random.integer(1, 3) : random.integer(0, 1),
        dangerBudget: kind === "danger" ? random.integer(1, 3) : random.chance(intent.traits.riskDensity) ? 1 : 0
      });
      branchNodeIds.push(node.id);
      edgeBuilder.createEdge(
        previousNodeId,
        node.id,
        step === branchLength - 1 && kind === "reward" ? "rewardDeadEnd" : "optionalBranch",
        node.intensity
      );
      previousNodeId = node.id;
    }
  }

  return branchNodeIds;
}

/** Ajoute des boucles et raccourcis selon l'archetype et la linearite. */
function createLoops(
  intent: LevelDesignIntent,
  random: SeededRandom,
  mainPathNodeIds: readonly string[],
  edgeBuilder: LevelPlanEdgeBuilder
): readonly string[] {
  const loopCount = Math.min(MAX_LOOP_EDGES, Math.round((1 - intent.traits.linearity) * 3 + intent.traits.complexity * 2));
  const loopEdgeIds: string[] = [];
  for (let index = 0; index < loopCount; index += 1) {
    if (mainPathNodeIds.length < 4) {
      break;
    }

    const fromIndex = random.integer(0, mainPathNodeIds.length - 3);
    const toIndex = random.integer(fromIndex + 2, mainPathNodeIds.length - 1);
    const kind: LevelPlanEdgeKind = random.chance(0.35) ? "shortcut" : "loop";
    const edge = edgeBuilder.createEdge(mainPathNodeIds[fromIndex], mainPathNodeIds[toIndex], kind, getLoopIntensity(intent));
    loopEdgeIds.push(edge.id);
  }

  return loopEdgeIds;
}

/** Calcule la longueur du chemin principal depuis les traits d'intention. */
function getMainPathLength(intent: LevelDesignIntent, random: SeededRandom): number {
  const baseLength = MIN_MAIN_PATH_LENGTH + Math.round(intent.traits.complexity * 4 + (1 - intent.traits.linearity) * 2);
  const archetypeBonus = intent.primaryArchetype === "maze" || intent.primaryArchetype === "spiral" || intent.primaryArchetype === "verticalRoute" ? 1 : 0;
  return clampInteger(baseLength + archetypeBonus + random.integer(-1, 1), MIN_MAIN_PATH_LENGTH, MAX_MAIN_PATH_LENGTH);
}

/** Choisit le role d'un noeud du chemin principal. */
function getMainPathNodeKind(
  index: number,
  length: number,
  intent: LevelDesignIntent,
  random: SeededRandom
): LevelPlanNodeKind {
  if (index === 0) {
    return "start";
  }

  if (index === length - 1) {
    return "exit";
  }

  if (index === Math.floor(length * 0.62) && intent.traits.complexity > 0.55) {
    return "implicitLock";
  }

  if (index === Math.floor(length * 0.45) || random.chance(intent.traits.optionalZoneRatio * 0.28)) {
    return "diamondObjective";
  }

  if (random.chance(intent.traits.riskDensity * 0.45)) {
    return "danger";
  }

  return random.chance(intent.traits.openness) ? "room" : "corridor";
}

/** Choisit le role d'un noeud optionnel. */
function getOptionalNodeKind(
  intent: LevelDesignIntent,
  random: SeededRandom,
  step: number,
  branchLength: number
): LevelPlanNodeKind {
  if (step === branchLength - 1 && random.chance(0.72)) {
    return random.chance(0.65) ? "reward" : "diamondObjective";
  }

  if (random.chance(intent.traits.riskDensity)) {
    return "danger";
  }

  return random.chance(intent.traits.openness) ? "room" : "corridor";
}

/** Retourne l'intensite d'un noeud du chemin principal. */
function getMainPathIntensity(index: number, length: number, intent: LevelDesignIntent): LevelPlanIntensity {
  const progress = index / Math.max(1, length - 1);
  const value = progress * 0.5 + intent.traits.riskDensity * 0.35 + intent.traits.complexity * 0.15;
  return toIntensity(value);
}

/** Retourne l'intensite d'une branche optionnelle. */
function getBranchIntensity(intent: LevelDesignIntent, random: SeededRandom): LevelPlanIntensity {
  return toIntensity(intent.traits.riskDensity * 0.55 + intent.traits.complexity * 0.25 + random.next() * 0.2);
}

/** Retourne l'intensite d'une boucle ou raccourci. */
function getLoopIntensity(intent: LevelDesignIntent): LevelPlanIntensity {
  return toIntensity(intent.traits.complexity * 0.55 + intent.traits.riskDensity * 0.3);
}

/** Calcule le budget diamant abstrait d'un noeud principal. */
function getMainPathDiamondBudget(
  kind: LevelPlanNodeKind,
  index: number,
  length: number,
  intent: LevelDesignIntent
): number {
  if (kind === "diamondObjective") {
    return intent.primaryArchetype === "denseField" ? 4 : 2;
  }

  if (kind === "reward") {
    return 2;
  }

  const progress = index / Math.max(1, length - 1);
  return progress > 0.25 && progress < 0.9 ? Math.round(intent.traits.optionalZoneRatio) : 0;
}

/** Calcule le budget danger abstrait d'un noeud principal. */
function getMainPathDangerBudget(kind: LevelPlanNodeKind, intent: LevelDesignIntent): number {
  if (kind === "danger") {
    return intent.traits.riskDensity > 0.7 ? 3 : 2;
  }

  if (kind === "implicitLock") {
    return intent.traits.riskDensity > 0.55 ? 1 : 0;
  }

  return 0;
}

/** Cree les metadonnees compactes du graphe. */
function createGraphMetadata(
  intent: LevelDesignIntent,
  nodes: readonly LevelPlanNode[],
  mainPathNodeIds: readonly string[],
  optionalBranchNodeIds: readonly string[],
  loopEdgeIds: readonly string[]
): LevelPlanGraphMetadata {
  const diamondBudget = nodes.reduce((total, node) => total + node.diamondBudget, 0);
  const dangerBudget = nodes.reduce((total, node) => total + node.dangerBudget, 0);
  return {
    mainPathLength: mainPathNodeIds.length,
    optionalBranches: optionalBranchNodeIds.length,
    loops: loopEdgeIds.length,
    diamondBudget,
    dangerBudget,
    summary: [
      `Graph ${intent.primaryArchetype}`,
      `main=${mainPathNodeIds.length}`,
      `optional=${optionalBranchNodeIds.length}`,
      `loops=${loopEdgeIds.length}`,
      `diamonds=${diamondBudget}`,
      `danger=${dangerBudget}`
    ].join(" | ")
  };
}

/** Convertit une valeur normalisee en intensite lisible. */
function toIntensity(value: number): LevelPlanIntensity {
  if (value >= 0.66) {
    return "high";
  }

  if (value >= 0.34) {
    return "medium";
  }

  return "low";
}

/** Contraint un entier dans une plage. */
function clampInteger(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

/** Constructeur de noeuds gardant des ids stables et lisibles. */
class LevelPlanNodeBuilder {
  /** Noeuds crees dans leur ordre de generation. */
  readonly nodes: LevelPlanNode[] = [];
  /** Compteur interne utilise pour creer les ids. */
  private nextId = 1;

  /** Conserve l'intention pour propager l'archetype local par defaut. */
  constructor(private readonly intent: LevelDesignIntent) {}

  /** Cree et enregistre un noeud de plan. */
  createNode(
    kind: LevelPlanNodeKind,
    mainPathIndex: number | null,
    options: CreatePlanNodeOptions
  ): LevelPlanNode {
    const node: LevelPlanNode = {
      id: `node-${this.nextId.toString().padStart(2, "0")}`,
      kind,
      mainPathIndex,
      archetype: this.resolveLocalArchetype(kind, options.optional),
      intensity: options.intensity,
      diamondBudget: options.diamondBudget,
      dangerBudget: options.dangerBudget,
      optional: options.optional
    };
    this.nextId += 1;
    this.nodes.push(node);
    return node;
  }

  /** Choisit l'archetype local a donner a une future zone de layout. */
  private resolveLocalArchetype(kind: LevelPlanNodeKind, optional: boolean): LevelDesignArchetype {
    if (kind === "corridor" && this.intent.primaryArchetype === "rooms") {
      return "horizontalBands";
    }

    if (kind === "danger" && this.intent.secondaryArchetype) {
      return this.intent.secondaryArchetype;
    }

    if (optional && this.intent.secondaryArchetype) {
      return this.intent.secondaryArchetype;
    }

    return this.intent.primaryArchetype === "hybrid"
      ? this.intent.secondaryArchetype ?? "rooms"
      : this.intent.primaryArchetype;
  }
}

/** Constructeur d'aretes gardant des ids stables et lisibles. */
class LevelPlanEdgeBuilder {
  /** Aretes crees dans leur ordre de generation. */
  readonly edges: LevelPlanEdge[] = [];
  /** Compteur interne utilise pour creer les ids. */
  private nextId = 1;

  /** Cree et enregistre une arete de plan. */
  createEdge(from: string, to: string, kind: LevelPlanEdgeKind, intensity: LevelPlanIntensity): LevelPlanEdge {
    const edge: LevelPlanEdge = {
      id: `edge-${this.nextId.toString().padStart(2, "0")}`,
      from,
      to,
      kind,
      intensity
    };
    this.nextId += 1;
    this.edges.push(edge);
    return edge;
  }
}

/** Options necessaires pour creer un noeud de plan. */
interface CreatePlanNodeOptions {
  /** Indique si le noeud appartient a une branche optionnelle. */
  readonly optional: boolean;
  /** Intensite abstraite de la zone. */
  readonly intensity: LevelPlanIntensity;
  /** Budget diamant abstrait. */
  readonly diamondBudget: number;
  /** Budget danger abstrait. */
  readonly dangerBudget: number;
}
