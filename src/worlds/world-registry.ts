/**
 * Role: Centralise les mondes et briques disponibles pour les niveaux modernes.
 * Scope: Declare ids JSON, comportements gameplay, assets, libelles et helpers de resolution.
 * ISO: Les comportements reutilisent les roles TO8 originaux quand aucune mecanique nouvelle n'existe.
 * Notes: Ajouter une brique custom doit passer par ce registre plutot que par des mappings disperses.
 */

import { RUNTIME_TILE } from "../game/runtime-tiles";
import customEarthUrl from "../assets/custom-worlds/mine-metal/earth.png";
import customMonsterEye01Url from "../assets/custom-worlds/mine-metal/monster-eye-01.png";
import customMonsterEye02Url from "../assets/custom-worlds/mine-metal/monster-eye-02.png";
import customMonsterEye03Url from "../assets/custom-worlds/mine-metal/monster-eye-03.png";
import customMonsterEye04Url from "../assets/custom-worlds/mine-metal/monster-eye-04.png";
import customPlatformUrl from "../assets/custom-worlds/mine-metal/platform.png";

/** Id stable du monde original, separe pour eviter les references circulaires de construction. */
const ORIGINAL_WORLD_ID = "original-to8";

/** Ids de tuiles modernes supportes par les niveaux. */
export const MODERN_TILE_IDS = [
  "empty",
  "earth",
  "customEarth",
  "rock",
  "diamond",
  "monster",
  "customMonster",
  "border",
  "platform",
  "customPlatform",
  "specialCreature",
  "transformerBlock"
] as const;

/** Ids d'entites modernes supportes par les niveaux. */
export const MODERN_ENTITY_IDS = [
  "monster",
  "customMonster",
  "specialCreature",
  "diamond"
] as const;

/** Id de tuile moderne supporte par les niveaux. */
export type WorldTileId = (typeof MODERN_TILE_IDS)[number];
/** Id d'entite moderne supporte par les niveaux. */
export type WorldEntityId = (typeof MODERN_ENTITY_IDS)[number];

/** Comportements gameplay reutilisables par les briques modernes. */
export type WorldBehavior =
  | "empty"
  | "earth"
  | "rock"
  | "diamond"
  | "monster"
  | "border"
  | "platform"
  | "specialCreature"
  | "transformerBlock";

/** Categorie de palette permettant de structurer l'IHM editeur. */
export type WorldPaletteCategory = "original" | "custom" | "mechanism";

/** Definition commune d'une tuile placable dans la grille moderne. */
export interface WorldTileDefinition {
  /** Id JSON stable. */
  readonly id: WorldTileId;
  /** Monde proprietaire de la brique. */
  readonly worldId: string;
  /** Comportement gameplay reutilise par cette tuile. */
  readonly behavior: WorldBehavior;
  /** Tile id numerique place dans la grille runtime. */
  readonly runtimeTileId: number;
  /** Libelle court affiche dans l'editeur. */
  readonly label: string;
  /** Hint editeur. */
  readonly hint: string;
  /** Couleur d'icone ou fallback quand l'asset manque. */
  readonly fallbackColor: string;
  /** Categorie d'affichage dans la palette. */
  readonly paletteCategory: WorldPaletteCategory;
  /** URL d'une tuile statique moderne, si elle remplace l'atlas TO8. */
  readonly assetUrl?: string;
  /** URLs de frames animees modernes, si la tuile est rendue comme une animation. */
  readonly frameUrls?: readonly string[];
  /** Indique si poser cette tuile doit aussi creer une entite moderne. */
  readonly entityId?: WorldEntityId;
}

/** Definition commune d'une entite declarable dans les niveaux modernes. */
export interface WorldEntityDefinition {
  /** Id JSON stable. */
  readonly id: WorldEntityId;
  /** Monde proprietaire de l'entite. */
  readonly worldId: string;
  /** Comportement gameplay reutilise par cette entite. */
  readonly behavior: Extract<WorldBehavior, "diamond" | "monster" | "specialCreature">;
  /** Famille runtime effectivement creee. */
  readonly runtimeKind: "diamond" | "monster" | "specialCreature";
  /** Tile id runtime de reference pour la grille initiale. */
  readonly runtimeTileId: number;
  /** Identifiant de frame visuelle conserve sur `EntityState.spriteFrameId`. */
  readonly spriteFrameId: string;
  /** Libelle court affiche dans l'editeur. */
  readonly label: string;
  /** Hint editeur. */
  readonly hint: string;
  /** Couleur fallback quand l'asset manque. */
  readonly fallbackColor: string;
  /** Categorie d'affichage dans la palette. */
  readonly paletteCategory: WorldPaletteCategory;
  /** URLs des frames animees modernes, si disponibles. */
  readonly frameUrls?: readonly string[];
}

/** Definition d'un monde, regroupant ses tuiles et entites. */
export interface WorldDefinition {
  /** Id stable du monde. */
  readonly id: string;
  /** Libelle humain du monde. */
  readonly label: string;
  /** Tuiles placables exposees par ce monde. */
  readonly tiles: readonly WorldTileDefinition[];
  /** Entites declarables exposees par ce monde. */
  readonly entities: readonly WorldEntityDefinition[];
}

/** Sprite frame id du monstre oeil custom. */
export const CUSTOM_MONSTER_EYE_SPRITE_FRAME_ID = "custom:mine-metal-monster-eye";

/** Monde original TO8 conserve comme reference du portage. */
export const ORIGINAL_WORLD: WorldDefinition = {
  id: "original-to8",
  label: "Original TO8",
  tiles: [
    createOriginalTile("empty", "empty", RUNTIME_TILE.empty, "Vide", "Cellule vide.", "#000000"),
    createOriginalTile("earth", "earth", RUNTIME_TILE.earth, "Terre creusable", "Terre creusable par le joueur.", "#28a840"),
    createOriginalTile("rock", "rock", RUNTIME_TILE.rock, "Rocher", "Rocher soumis a la gravite.", "#909090"),
    createOriginalTile("diamond", "diamond", RUNTIME_TILE.diamond, "Diamant", "Diamant collectable et anime.", "#58c8f0", "diamond"),
    createOriginalTile("border", "border", RUNTIME_TILE.border, "Bordure", "Bordure solide du niveau.", "#2450d8"),
    createOriginalTile("platform", "platform", RUNTIME_TILE.platform, "Plateforme", "Plateforme solide verte.", "#78e060"),
    createOriginalTile("monster", "monster", RUNTIME_TILE.monster, "Monstre", "Monstre standard mobile.", "#d83838", "monster"),
    createOriginalTile(
      "specialCreature",
      "specialCreature",
      RUNTIME_TILE.specialCreature,
      "Creature speciale",
      "Creature mobile speciale.",
      "#c050c8",
      "specialCreature"
    ),
    createOriginalTile(
      "transformerBlock",
      "transformerBlock",
      RUNTIME_TILE.transformerBlock,
      "Bloc transformateur",
      "Transforme les rochers et diamants.",
      "#f0d050",
      undefined,
      "mechanism"
    )
  ],
  entities: [
    createOriginalEntity("diamond", "diamond", RUNTIME_TILE.diamond, "tile:3", "Diamant", "Diamant collectable et anime.", "#58c8f0"),
    createOriginalEntity("monster", "monster", RUNTIME_TILE.monster, "tile:2", "Monstre", "Monstre standard mobile.", "#d83838"),
    createOriginalEntity(
      "specialCreature",
      "specialCreature",
      RUNTIME_TILE.specialCreature,
      "tile:17",
      "Creature speciale",
      "Creature mobile speciale.",
      "#c050c8"
    )
  ]
};

/** Monde custom mine metallique, premiere extension graphique du portage. */
export const MINE_METAL_WORLD: WorldDefinition = {
  id: "mine-metal",
  label: "Mine metal",
  tiles: [
    {
      id: "customEarth",
      worldId: "mine-metal",
      behavior: "earth",
      runtimeTileId: 0x101,
      label: "Terre metal",
      hint: "Terre alternative creusable.",
      fallbackColor: "#5c3400",
      paletteCategory: "custom",
      assetUrl: customEarthUrl
    },
    {
      id: "customPlatform",
      worldId: "mine-metal",
      behavior: "platform",
      runtimeTileId: 0x102,
      label: "Rail metal",
      hint: "Plateforme alternative solide.",
      fallbackColor: "#485258",
      paletteCategory: "custom",
      assetUrl: customPlatformUrl
    },
    {
      id: "customMonster",
      worldId: "mine-metal",
      behavior: "monster",
      runtimeTileId: RUNTIME_TILE.monster,
      label: "Oeil jaune",
      hint: "Monstre alternatif mobile.",
      fallbackColor: "#ffe800",
      paletteCategory: "custom",
      frameUrls: [
        customMonsterEye01Url,
        customMonsterEye02Url,
        customMonsterEye03Url,
        customMonsterEye04Url
      ],
      entityId: "customMonster"
    }
  ],
  entities: [
    {
      id: "customMonster",
      worldId: "mine-metal",
      behavior: "monster",
      runtimeKind: "monster",
      runtimeTileId: RUNTIME_TILE.monster,
      spriteFrameId: CUSTOM_MONSTER_EYE_SPRITE_FRAME_ID,
      label: "Oeil jaune",
      hint: "Monstre alternatif mobile.",
      fallbackColor: "#ffe800",
      paletteCategory: "custom",
      frameUrls: [
        customMonsterEye01Url,
        customMonsterEye02Url,
        customMonsterEye03Url,
        customMonsterEye04Url
      ]
    }
  ]
};

/** Tous les mondes actifs dans l'application. */
export const WORLD_DEFINITIONS = [
  ORIGINAL_WORLD,
  MINE_METAL_WORLD
] as const satisfies readonly WorldDefinition[];

/** Definitions de tuiles indexees sans contrainte d'ordre d'affichage. */
const WORLD_TILE_DEFINITIONS_BY_ID = new Map(
  WORLD_DEFINITIONS.flatMap((world) => world.tiles).map((tile) => [tile.id, tile])
);

/** Definitions d'entites indexees sans contrainte d'ordre d'affichage. */
const WORLD_ENTITY_DEFINITIONS_BY_ID = new Map(
  WORLD_DEFINITIONS.flatMap((world) => world.entities).map((entity) => [entity.id, entity])
);

/** Definition aplatie de toutes les tuiles modernes, dans l'ordre de palette. */
export const WORLD_TILE_DEFINITIONS = MODERN_TILE_IDS.map((id) => requireWorldTileDefinition(id));
/** Definition aplatie de toutes les entites modernes, dans l'ordre de palette. */
export const WORLD_ENTITY_DEFINITIONS = MODERN_ENTITY_IDS.map((id) => requireWorldEntityDefinition(id));

/** Retourne toutes les tuiles modernes dans l'ordre de palette. */
export function getWorldTileDefinitions(): readonly WorldTileDefinition[] {
  return WORLD_TILE_DEFINITIONS;
}

/** Retourne toutes les entites modernes dans l'ordre de declaration. */
export function getWorldEntityDefinitions(): readonly WorldEntityDefinition[] {
  return WORLD_ENTITY_DEFINITIONS;
}

/** Retourne une definition de tuile par id moderne. */
export function getWorldTileDefinition(id: string): WorldTileDefinition | undefined {
  return WORLD_TILE_DEFINITIONS_BY_ID.get(id as WorldTileId);
}

/** Retourne une definition d'entite par id moderne. */
export function getWorldEntityDefinition(id: string): WorldEntityDefinition | undefined {
  return WORLD_ENTITY_DEFINITIONS_BY_ID.get(id as WorldEntityId);
}

/** Retourne une definition d'entite par sprite frame id runtime. */
export function getWorldEntityDefinitionBySpriteFrameId(spriteFrameId: string): WorldEntityDefinition | undefined {
  return WORLD_ENTITY_DEFINITIONS.find((entity) => entity.spriteFrameId === spriteFrameId);
}

/** Indique si une valeur inconnue est un id de tuile moderne supporte. */
export function isWorldTileId(value: unknown): value is WorldTileId {
  return typeof value === "string" && getWorldTileDefinition(value) !== undefined;
}

/** Indique si une valeur inconnue est un id d'entite moderne supporte. */
export function isWorldEntityId(value: unknown): value is WorldEntityId {
  return typeof value === "string" && getWorldEntityDefinition(value) !== undefined;
}

/** Retourne les ids de tuiles modernes supportes. */
export function getModernTileIds(): readonly WorldTileId[] {
  return MODERN_TILE_IDS;
}

/** Retourne les ids d'entites modernes supportes. */
export function getModernEntityIds(): readonly WorldEntityId[] {
  return MODERN_ENTITY_IDS;
}

/** Retourne la definition associee a un tile id runtime custom. */
export function getWorldTileDefinitionByRuntimeTileId(tileId: number): WorldTileDefinition | undefined {
  return WORLD_TILE_DEFINITIONS.find((tile) => tile.runtimeTileId === tileId && tile.worldId !== ORIGINAL_WORLD.id);
}

/** Cree une tuile du monde original. */
function createOriginalTile(
  id: WorldTileId,
  behavior: WorldBehavior,
  runtimeTileId: number,
  label: string,
  hint: string,
  fallbackColor: string,
  entityId?: WorldEntityId,
  paletteCategory: WorldPaletteCategory = "original"
): WorldTileDefinition {
  return {
    id,
    worldId: ORIGINAL_WORLD_ID,
    behavior,
    runtimeTileId,
    label,
    hint,
    fallbackColor,
    paletteCategory,
    entityId
  };
}

/** Cree une entite du monde original. */
function createOriginalEntity(
  id: WorldEntityId,
  behavior: WorldEntityDefinition["behavior"],
  runtimeTileId: number,
  spriteFrameId: string,
  label: string,
  hint: string,
  fallbackColor: string
): WorldEntityDefinition {
  return {
    id,
    worldId: ORIGINAL_WORLD_ID,
    behavior,
    runtimeKind: behavior,
    runtimeTileId,
    spriteFrameId,
    label,
    hint,
    fallbackColor,
    paletteCategory: "original"
  };
}

/** Retourne une tuile declaree ou signale un registre incoherent au demarrage. */
function requireWorldTileDefinition(id: WorldTileId): WorldTileDefinition {
  const definition = WORLD_TILE_DEFINITIONS_BY_ID.get(id);
  if (!definition) {
    throw new Error(`Tuile de monde manquante dans le registre: ${id}`);
  }

  return definition;
}

/** Retourne une entite declaree ou signale un registre incoherent au demarrage. */
function requireWorldEntityDefinition(id: WorldEntityId): WorldEntityDefinition {
  const definition = WORLD_ENTITY_DEFINITIONS_BY_ID.get(id);
  if (!definition) {
    throw new Error(`Entite de monde manquante dans le registre: ${id}`);
  }

  return definition;
}
