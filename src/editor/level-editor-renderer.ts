/**
 * Role: Fournit les primitives de rendu dediees a l'editeur de niveaux.
 * Scope: Mappe les tuiles modernes vers le rendu runtime ou vers un fallback TO8 lisible.
 * ISO: Les tuiles doivent viser le meme rendu que le gameplay quand l'atlas est disponible.
 * Notes: Le module reste volontairement fin pour ne pas dupliquer le renderer gameplay.
 */

import { RUNTIME_ASSET_URLS } from "../assets/runtime-assets";
import { mineSpriteMetadata } from "../assets/generated/mine-sprites";
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

/** Frames idle joueur extraites de la table ASM `$D036-$D069`. */
const PLAYER_IDLE_TILE_IDS = extractFrameIdsFromMetadata("player", "idleCycle", [8, 8, 7, 8, 9]);
/** Correspondance tile id joueur vers index de frame dans `player-atlas.png`. */
const PLAYER_TILE_ID_TO_ATLAS_FRAME = createTileIdToAtlasFrameMap("player");

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
  /** Atlas anime du joueur optionnel. */
  private playerAtlasImage: HTMLImageElement | null = null;
  /** Atlas anime des diamants optionnel. */
  private diamondAtlasImage: HTMLImageElement | null = null;
  /** Atlas anime des monstres optionnel. */
  private monsterAtlasImage: HTMLImageElement | null = null;
  /** Atlas anime de la creature speciale optionnel. */
  private specialCreatureAtlasImage: HTMLImageElement | null = null;

  /** Branche l'atlas runtime charge par l'application. */
  setTilesAtlasImage(image: HTMLImageElement): void {
    this.tilesAtlasImage = image;
  }

  /** Branche l'atlas joueur charge par l'application. */
  setPlayerAtlasImage(image: HTMLImageElement): void {
    this.playerAtlasImage = image;
  }

  /** Branche l'atlas anime des diamants charge par l'application. */
  setDiamondAtlasImage(image: HTMLImageElement): void {
    this.diamondAtlasImage = image;
  }

  /** Branche l'atlas anime des monstres charge par l'application. */
  setMonsterAtlasImage(image: HTMLImageElement): void {
    this.monsterAtlasImage = image;
  }

  /** Branche l'atlas anime de la creature speciale charge par l'application. */
  setSpecialCreatureAtlasImage(image: HTMLImageElement): void {
    this.specialCreatureAtlasImage = image;
  }

  /** Rend une tuile moderne avec l'atlas runtime si possible, sinon avec un fallback pixel. */
  renderTile(renderer: Renderer, tile: ModernTileType, x: number, y: number, animationFrameIndex = 0, size = EDITOR_TILE_SIZE): void {
    if (tile === "diamond" && this.diamondAtlasImage) {
      const frameIndex = animationFrameIndex % 8;
      renderer.drawTileScaled(this.tileFrameCache.getAtlasFrame(this.diamondAtlasImage, `editor-diamond-${frameIndex}`, frameIndex), x, y, size, size);
      return;
    }

    if (tile === "monster" && this.monsterAtlasImage) {
      const frameIndex = animationFrameIndex % 2;
      renderer.drawTileScaled(this.tileFrameCache.getAtlasFrame(this.monsterAtlasImage, `editor-monster-${frameIndex}`, frameIndex), x, y, size, size);
      return;
    }

    if (tile === "specialCreature" && this.specialCreatureAtlasImage) {
      const frameIndex = animationFrameIndex % 2;
      renderer.drawTileScaled(
        this.tileFrameCache.getAtlasFrame(this.specialCreatureAtlasImage, `editor-special-creature-${frameIndex}`, frameIndex),
        x,
        y,
        size,
        size
      );
      return;
    }

    const tileId = EDITOR_TILE_TO_RUNTIME_ID[tile];
    if (this.tilesAtlasImage && tileId !== undefined) {
      renderer.drawTileScaled(this.tileFrameCache.getTileFrame(this.tilesAtlasImage, tileId), x, y, size, size);
      return;
    }

    renderer.fillRect(x, y, size, size, editorTileFallbackColor(tile));
  }

  /** Rend le joueur en cycle idle pour marquer le spawn dans la grille. */
  renderPlayerIdle(renderer: Renderer, x: number, y: number, animationFrameIndex = 0, size = EDITOR_TILE_SIZE): void {
    if (!this.playerAtlasImage || PLAYER_IDLE_TILE_IDS.length === 0) {
      renderer.strokeRect(x + 2, y + 2, size - 4, size - 4, "#ff4444");
      renderer.drawPixelText("J", x + Math.max(3, size / 3), y + Math.max(3, size / 3), "#ff4444", 1);
      return;
    }

    const tileId = PLAYER_IDLE_TILE_IDS[animationFrameIndex % PLAYER_IDLE_TILE_IDS.length];
    const atlasFrameIndex = PLAYER_TILE_ID_TO_ATLAS_FRAME.get(tileId) ?? 0;
    renderer.drawTileScaled(
      this.tileFrameCache.getAtlasFrame(this.playerAtlasImage, `editor-player-idle-${atlasFrameIndex}`, atlasFrameIndex),
      x,
      y,
      size,
      size
    );
  }

  /** Rend un apercu DOM de palette avec la premiere frame disponible de la tuile. */
  renderTilePreview(canvas: HTMLCanvasElement, tile: ModernTileType): void {
    const size = canvas.width;
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, canvas.width, canvas.height);

    if (tile === "diamond" && this.diamondAtlasImage) {
      this.drawPreviewFrame(context, this.tileFrameCache.getAtlasFrame(this.diamondAtlasImage, "preview-diamond-0", 0), size);
      return;
    }

    if (tile === "monster" && this.monsterAtlasImage) {
      this.drawPreviewFrame(context, this.tileFrameCache.getAtlasFrame(this.monsterAtlasImage, "preview-monster-0", 0), size);
      return;
    }

    if (tile === "specialCreature" && this.specialCreatureAtlasImage) {
      this.drawPreviewFrame(context, this.tileFrameCache.getAtlasFrame(this.specialCreatureAtlasImage, "preview-special-creature-0", 0), size);
      return;
    }

    const tileId = EDITOR_TILE_TO_RUNTIME_ID[tile];
    if (this.tilesAtlasImage && tileId !== undefined) {
      this.drawPreviewFrame(context, this.tileFrameCache.getTileFrame(this.tilesAtlasImage, tileId), size);
      return;
    }

    context.fillStyle = editorTileFallbackColor(tile);
    context.fillRect(0, 0, size, size);
  }

  /** Dessine une frame runtime dans un canvas DOM de preview. */
  private drawPreviewFrame(context: CanvasRenderingContext2D, frame: ReturnType<TileFrameCache["getTileFrame"]>, size: number): void {
    context.drawImage(
      frame.source,
      frame.sourceRect.x,
      frame.sourceRect.y,
      frame.sourceRect.width,
      frame.sourceRect.height,
      0,
      0,
      size,
      size
    );
  }
}

/** Extrait une animation depuis les metadata de sprites, avec fallback local. */
function extractFrameIdsFromMetadata(groupId: string, animationId: string, fallbackFrames: readonly number[]): number[] {
  const animation = mineSpriteMetadata.groups
    .find((group) => group.id === groupId)
    ?.animations.find((item) => item.id === animationId);
  if (Array.isArray(animation?.frameTileIds) && animation.frameTileIds.length > 0) {
    return [...animation.frameTileIds];
  }

  return [...fallbackFrames];
}

/** Cree la correspondance tile id -> position dans l'atlas extrait. */
function createTileIdToAtlasFrameMap(groupId: string): Map<number, number> {
  const frames = mineSpriteMetadata.groups.find((group) => group.id === groupId)?.frames ?? [];
  return new Map(frames.map((frame, index) => [frame.tileId, index]));
}
