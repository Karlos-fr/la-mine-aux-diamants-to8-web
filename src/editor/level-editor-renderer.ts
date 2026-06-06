/**
 * Role: Fournit les primitives de rendu dediees a l'editeur de niveaux.
 * Scope: Mappe les tuiles modernes vers le rendu runtime ou vers un fallback TO8 lisible.
 * ISO: Les tuiles doivent viser le meme rendu que le gameplay quand l'atlas est disponible.
 * Notes: Le module reste volontairement fin pour ne pas dupliquer le renderer gameplay.
 */

import { RUNTIME_ASSET_URLS } from "../assets/runtime-assets";
import type { Renderer } from "../engine/renderer";
import { RUNTIME_TILE } from "../game/runtime-tiles";
import type { ModernTileType } from "../game/level-loader";
import { TileFrameCache } from "../rendering/tile-frame-cache";
import { EDITOR_TILE_SIZE } from "./level-editor-state";
import { editorTileFallbackColor } from "./level-editor-theme";

/** Mappe les types JSON modernes vers les ids de tuiles runtime. */
const EDITOR_TILE_TO_RUNTIME_ID: Partial<Record<ModernTileType, number>> = {
  empty: RUNTIME_TILE.empty,
  earth: RUNTIME_TILE.earth,
  rock: RUNTIME_TILE.rock,
  diamond: RUNTIME_TILE.diamond,
  border: RUNTIME_TILE.border,
  platform: RUNTIME_TILE.platform,
  monster: RUNTIME_TILE.monster,
  specialCreature: RUNTIME_TILE.specialCreature,
  transformerBlock: RUNTIME_TILE.transformerBlock
};

/** Renderer specialise de tuiles pour l'editeur. */
export class LevelEditorRenderer {
  /** URL de l'atlas runtime que l'IHM peut charger quand elle branche les assets. */
  readonly tilesAtlasUrl = RUNTIME_ASSET_URLS.tilesAtlas;

  /** Cache de frames compatible avec le runtime gameplay. */
  private readonly tileFrameCache = new TileFrameCache({
    sourceSize: EDITOR_TILE_SIZE,
    renderSize: EDITOR_TILE_SIZE
  });

  /** Image d'atlas runtime optionnelle. */
  private tilesAtlasImage: HTMLImageElement | null = null;
  /** Atlas anime des diamants optionnel. */
  private diamondAtlasImage: HTMLImageElement | null = null;
  /** Atlas anime des monstres optionnel. */
  private monsterAtlasImage: HTMLImageElement | null = null;

  /** Branche l'atlas runtime charge par l'application. */
  setTilesAtlasImage(image: HTMLImageElement): void {
    this.tilesAtlasImage = image;
  }

  /** Branche l'atlas anime des diamants charge par l'application. */
  setDiamondAtlasImage(image: HTMLImageElement): void {
    this.diamondAtlasImage = image;
  }

  /** Branche l'atlas anime des monstres charge par l'application. */
  setMonsterAtlasImage(image: HTMLImageElement): void {
    this.monsterAtlasImage = image;
  }

  /** Rend une tuile moderne avec l'atlas runtime si possible, sinon avec un fallback pixel. */
  renderTile(renderer: Renderer, tile: ModernTileType, x: number, y: number, animationFrameIndex = 0, size = EDITOR_TILE_SIZE): void {
    if (tile === "diamond" && this.diamondAtlasImage) {
      renderer.drawTileScaled(this.tileFrameCache.getAtlasFrame(this.diamondAtlasImage, `editor-diamond-${animationFrameIndex}`, animationFrameIndex), x, y, size, size);
      return;
    }

    if (tile === "monster" && this.monsterAtlasImage) {
      const frameIndex = animationFrameIndex % 2;
      renderer.drawTileScaled(this.tileFrameCache.getAtlasFrame(this.monsterAtlasImage, `editor-monster-${frameIndex}`, frameIndex), x, y, size, size);
      return;
    }

    const tileId = EDITOR_TILE_TO_RUNTIME_ID[tile];
    if (this.tilesAtlasImage && tileId !== undefined) {
      renderer.drawTileScaled(this.tileFrameCache.getTileFrame(this.tilesAtlasImage, tileId), x, y, size, size);
      return;
    }

    renderer.fillRect(x, y, size, size, editorTileFallbackColor(tile));
  }
}
