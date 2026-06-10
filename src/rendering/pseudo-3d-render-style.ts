/**
 * Role: Prepare les styles visuels Diorama a partir des comportements de tuiles.
 * Scope: Traduit les tile ids runtime en intentions de rendu, sans muter le gameplay.
 * ISO: Les comportements originaux restent deduits des tile ids TO8 et des definitions de monde.
 * Notes: Le Diorama 3D consomme uniquement le comportement visuel resolu.
 */

import type { DisplayRenderMode } from "../display-options";
import type { WorldBehavior } from "../worlds/world-registry";
import { getWorldTileDefinitionByRuntimeTileId } from "../worlds/world-registry";

/** Tile ids runtime necessaires pour resoudre un comportement visuel Diorama. */
export interface Pseudo3DRenderTileIds {
  /** Tuile vide. */
  readonly empty: number;
  /** Tuile terre creusable. */
  readonly earth: number;
  /** Tuile rocher statique. */
  readonly rock: number;
  /** Tuile diamant statique. */
  readonly diamond: number;
  /** Tuile monstre standard. */
  readonly monster: number;
  /** Tuile monstre actif. */
  readonly monsterActive: number;
  /** Tuile creature speciale. */
  readonly specialCreature: number;
  /** Tuile bordure solide. */
  readonly border: number;
  /** Tuile plateforme solide. */
  readonly platform: number;
  /** Tuile bloc transformateur. */
  readonly transformerBlock: number;
  /** Tuile trace monstre. */
  readonly monsterTrail: number;
  /** Tuile rocher en chute. */
  readonly fallingRock: number;
  /** Tuile diamant en chute. */
  readonly fallingDiamond: number;
}

/** Style visuel derive du comportement de tuile, consomme par le Diorama. */
export interface Pseudo3DRenderStyle {
  /** Comportement gameplay reutilise comme categorie visuelle. */
  readonly behavior: WorldBehavior;
}

/** Resolution neutre utilisee quand le mode original ne demande aucune primitive Diorama. */
const ORIGINAL_RENDER_STYLE: Pseudo3DRenderStyle = {
  behavior: "empty"
};

/** Retourne le style visuel applicable a une tuile runtime dans le mode actif. */
export function resolvePseudo3DRenderStyle(
  renderMode: DisplayRenderMode,
  tileId: number,
  tileIds: Pseudo3DRenderTileIds
): Pseudo3DRenderStyle {
  if (renderMode === "to8") {
    return ORIGINAL_RENDER_STYLE;
  }

  return {
    behavior: resolveRuntimeTileBehavior(tileId, tileIds)
  };
}

/** Resout un comportement visuel depuis la grille runtime et le registre custom. */
function resolveRuntimeTileBehavior(tileId: number, tileIds: Pseudo3DRenderTileIds): WorldBehavior {
  const customDefinition = getWorldTileDefinitionByRuntimeTileId(tileId);
  if (customDefinition) {
    return customDefinition.behavior;
  }

  if (tileId === tileIds.empty || tileId === tileIds.monsterTrail) {
    return "empty";
  }
  if (tileId === tileIds.earth) {
    return "earth";
  }
  if (tileId === tileIds.rock || tileId === tileIds.fallingRock) {
    return "rock";
  }
  if (tileId === tileIds.diamond || tileId === tileIds.fallingDiamond) {
    return "diamond";
  }
  if (tileId === tileIds.monster || tileId === tileIds.monsterActive) {
    return "monster";
  }
  if (tileId === tileIds.specialCreature) {
    return "specialCreature";
  }
  if (tileId === tileIds.border) {
    return "border";
  }
  if (tileId === tileIds.platform) {
    return "platform";
  }
  if (tileId === tileIds.transformerBlock) {
    return "transformerBlock";
  }

  return "empty";
}
