/**
 * Role: Rend les apercus dynamiques de niveaux pour la future vitrine.
 * Scope: Dessine un `ModernLevelJson` dans un canvas DOM, sans dependance a une scene gameplay.
 * ISO: Les tuiles utilisent les atlas runtime extraits afin de rester visuellement proches du TO8.
 * Notes: Le canvas est redimensionne en pixels reels pour conserver un rendu net sans lissage.
 */

import type { LoadedRuntimeAssets } from "../assets/runtime-asset-loader";
import { mineSpriteMetadata } from "../assets/generated/mine-sprites";
import type { ModernEntityType, ModernLevelJson, ModernTileType } from "../game/level-loader";
import { RUNTIME_TILE } from "../game/runtime-tiles";
import { getWorldEntityDefinition, getWorldTileDefinition } from "../worlds/world-registry";

/** Taille source commune des tuiles et sprites extraits. */
const PREVIEW_SOURCE_TILE_SIZE = 16;
/** Largeur maximale par defaut d'un apercu de liste. */
const DEFAULT_PREVIEW_MAX_WIDTH = 320;
/** Hauteur maximale par defaut d'un apercu de liste. */
const DEFAULT_PREVIEW_MAX_HEIGHT = 180;
/** Couleur de fond quand les assets ne sont pas encore disponibles. */
const PREVIEW_BACKGROUND_COLOR = "#000000";
/** Couleur de contour utilisee si l'atlas joueur est indisponible. */
const PREVIEW_PLAYER_FALLBACK_COLOR = "#ff0000";
/** Frames idle joueur extraites de la table ASM `$D036-$D069`. */
const PLAYER_IDLE_TILE_IDS = extractFrameIdsFromMetadata("player", "idleCycle", [8, 8, 7, 8, 9]);
/** Correspondance tile id joueur vers index de frame dans `player-atlas.png`. */
const PLAYER_TILE_ID_TO_ATLAS_FRAME = createTileIdToAtlasFrameMap("player");

/** Options de rendu pour une miniature de niveau. */
export interface LevelShowcasePreviewRenderOptions {
  /** Largeur maximale du canvas destination. */
  readonly maxWidth?: number;
  /** Hauteur maximale du canvas destination. */
  readonly maxHeight?: number;
  /** Taille minimale d'une cellule destination en pixels. */
  readonly minCellSize?: number;
  /** Autorise le rendu a la taille source 16px par cellule quand l'espace le permet. */
  readonly preferSourceTileSize?: boolean;
  /** Indices de frames animes a utiliser pour les sprites vivants de la miniature. */
  readonly animationFrameIndexes?: LevelShowcasePreviewAnimationFrameIndexes;
}

/** Indices d'animation sans simulation gameplay pour les apercus de vitrine. */
export interface LevelShowcasePreviewAnimationFrameIndexes {
  /** Index logique du cycle idle joueur. */
  readonly player: number;
  /** Index logique du cycle diamant. */
  readonly diamond: number;
  /** Index logique du cycle monstre. */
  readonly monster: number;
  /** Index logique du blink sortie. */
  readonly exit: number;
}

/** Resultat geometrique d'un rendu de preview. */
export interface LevelShowcasePreviewRenderResult {
  /** Largeur reelle du canvas apres rendu. */
  readonly width: number;
  /** Hauteur reelle du canvas apres rendu. */
  readonly height: number;
  /** Taille entiere d'une cellule destination. */
  readonly cellSize: number;
}

/** Renderer reutilisable par la liste et la fiche de la vitrine. */
export class LevelShowcasePreviewRenderer {
  /** Assets runtime optionnels; les fallbacks permettent un rendu avant chargement. */
  private assets: LoadedRuntimeAssets | null = null;

  /** Branche les atlas runtime charges par l'application. */
  setAssets(assets: LoadedRuntimeAssets | null): void {
    this.assets = assets;
  }

  /** Rend tout le niveau dans le canvas fourni et retourne sa geometrie finale. */
  renderLevelPreview(
    canvas: HTMLCanvasElement,
    level: ModernLevelJson,
    options: LevelShowcasePreviewRenderOptions = {}
  ): LevelShowcasePreviewRenderResult {
    const cellSize = resolvePreviewCellSize(level, options);
    const width = level.width * cellSize;
    const height = level.height * cellSize;
    canvas.width = width;
    canvas.height = height;
    canvas.style.imageRendering = "pixelated";

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Impossible d'initialiser le canvas de preview niveau.");
    }

    context.imageSmoothingEnabled = false;
    context.fillStyle = PREVIEW_BACKGROUND_COLOR;
    context.fillRect(0, 0, width, height);

    const animationFrameIndexes = options.animationFrameIndexes ?? DEFAULT_ANIMATION_FRAME_INDEXES;
    this.renderTiles(context, level, cellSize, animationFrameIndexes);
    this.renderEntities(context, level, cellSize, animationFrameIndexes);
    this.renderExitMarker(context, level, cellSize, animationFrameIndexes);
    this.renderPlayerSpawn(context, level, cellSize, animationFrameIndexes);

    return { width, height, cellSize };
  }

  /** Rend la grille de tuiles complete en appliquant la tuile par defaut. */
  private renderTiles(
    context: CanvasRenderingContext2D,
    level: ModernLevelJson,
    cellSize: number,
    animationFrameIndexes: LevelShowcasePreviewAnimationFrameIndexes
  ): void {
    for (let y = 0; y < level.height; y += 1) {
      for (let x = 0; x < level.width; x += 1) {
        this.drawTile(context, level.defaultTile, x, y, cellSize, animationFrameIndexes);
      }
    }

    for (const cell of level.tiles) {
      this.drawTile(context, cell.type, cell.x, cell.y, cellSize, animationFrameIndexes);
    }
  }

  /** Rend les entites declaratives par-dessus la grille statique. */
  private renderEntities(
    context: CanvasRenderingContext2D,
    level: ModernLevelJson,
    cellSize: number,
    animationFrameIndexes: LevelShowcasePreviewAnimationFrameIndexes
  ): void {
    for (const entity of level.entities) {
      this.drawEntity(context, entity.type, entity.x, entity.y, cellSize, animationFrameIndexes);
    }
  }

  /** Rend une tuile moderne avec atlas runtime ou couleur de secours. */
  private drawTile(
    context: CanvasRenderingContext2D,
    tile: ModernTileType,
    gridX: number,
    gridY: number,
    cellSize: number,
    animationFrameIndexes: LevelShowcasePreviewAnimationFrameIndexes
  ): void {
    const destinationX = gridX * cellSize;
    const destinationY = gridY * cellSize;
    const definition = getWorldTileDefinition(tile);
    const staticImage = this.assets?.worldTileImages.get(tile);
    if (definition?.assetUrl && staticImage) {
      this.drawAtlasFrame(context, staticImage, 0, destinationX, destinationY, cellSize);
      return;
    }

    const entityFrameImages = definition?.entityId ? this.assets?.worldEntityFrameImages.get(definition.entityId) : undefined;
    if (definition?.frameUrls && entityFrameImages?.length) {
      const frameIndex = animationFrameIndexes.monster % entityFrameImages.length;
      this.drawAtlasFrame(context, entityFrameImages[frameIndex], 0, destinationX, destinationY, cellSize);
      return;
    }

    if (tile === "diamond" && this.assets?.diamondAtlas) {
      const frameIndex = animationFrameIndexes.diamond % 8;
      this.drawAtlasFrame(context, this.assets.diamondAtlas, frameIndex, destinationX, destinationY, cellSize);
      return;
    }

    if (tile === "monster" && this.assets?.monsterAtlas) {
      const frameIndex = animationFrameIndexes.monster % 2;
      this.drawAtlasFrame(context, this.assets.monsterAtlas, frameIndex, destinationX, destinationY, cellSize);
      return;
    }

    if (tile === "specialCreature" && this.assets?.specialCreatureAtlas) {
      const frameIndex = animationFrameIndexes.monster % 2;
      this.drawAtlasFrame(context, this.assets.specialCreatureAtlas, frameIndex, destinationX, destinationY, cellSize);
      return;
    }

    const tileAtlas = this.assets?.tileAtlas;
    if (tileAtlas && definition) {
      this.drawAtlasFrame(context, tileAtlas, definition.runtimeTileId, destinationX, destinationY, cellSize);
      return;
    }

    context.fillStyle = definition?.fallbackColor ?? PREVIEW_BACKGROUND_COLOR;
    context.fillRect(destinationX, destinationY, cellSize, cellSize);
  }

  /** Rend une entite animee avec sa frame courante. */
  private drawEntity(
    context: CanvasRenderingContext2D,
    type: ModernEntityType,
    gridX: number,
    gridY: number,
    cellSize: number,
    animationFrameIndexes: LevelShowcasePreviewAnimationFrameIndexes
  ): void {
    const destinationX = gridX * cellSize;
    const destinationY = gridY * cellSize;
    const definition = getWorldEntityDefinition(type);
    const frameImages = this.assets?.worldEntityFrameImages.get(type);
    if (definition?.frameUrls && frameImages?.length) {
      const frameIndex = animationFrameIndexes.monster % frameImages.length;
      this.drawAtlasFrame(context, frameImages[frameIndex], 0, destinationX, destinationY, cellSize);
      return;
    }

    if (type === "diamond" && this.assets?.diamondAtlas) {
      const frameIndex = animationFrameIndexes.diamond % 8;
      this.drawAtlasFrame(context, this.assets.diamondAtlas, frameIndex, destinationX, destinationY, cellSize);
      return;
    }

    if (type === "monster" && this.assets?.monsterAtlas) {
      const frameIndex = animationFrameIndexes.monster % 2;
      this.drawAtlasFrame(context, this.assets.monsterAtlas, frameIndex, destinationX, destinationY, cellSize);
      return;
    }

    if (type === "specialCreature" && this.assets?.specialCreatureAtlas) {
      const frameIndex = animationFrameIndexes.monster % 2;
      this.drawAtlasFrame(context, this.assets.specialCreatureAtlas, frameIndex, destinationX, destinationY, cellSize);
      return;
    }

    context.fillStyle = definition?.fallbackColor ?? PREVIEW_BACKGROUND_COLOR;
    context.fillRect(destinationX, destinationY, cellSize, cellSize);
  }

  /** Rend le spawn joueur avec le cycle idle ou un marqueur net. */
  private renderPlayerSpawn(
    context: CanvasRenderingContext2D,
    level: ModernLevelJson,
    cellSize: number,
    animationFrameIndexes: LevelShowcasePreviewAnimationFrameIndexes
  ): void {
    const destinationX = level.playerSpawn.x * cellSize;
    const destinationY = level.playerSpawn.y * cellSize;
    if (this.assets?.playerAtlas) {
      const tileId = pickAnimationFrame(PLAYER_IDLE_TILE_IDS, animationFrameIndexes.player);
      const frameIndex = PLAYER_TILE_ID_TO_ATLAS_FRAME.get(tileId) ?? 0;
      this.drawAtlasFrame(context, this.assets.playerAtlas, frameIndex, destinationX, destinationY, cellSize);
      return;
    }

    context.strokeStyle = PREVIEW_PLAYER_FALLBACK_COLOR;
    context.lineWidth = Math.max(1, Math.floor(cellSize / 8));
    context.strokeRect(destinationX, destinationY, cellSize, cellSize);
  }

  /** Ajoute un contour de sortie sans masquer le rendu de la tuile sous-jacente. */
  private renderExitMarker(
    context: CanvasRenderingContext2D,
    level: ModernLevelJson,
    cellSize: number,
    animationFrameIndexes: LevelShowcasePreviewAnimationFrameIndexes
  ): void {
    const destinationX = level.exit.x * cellSize;
    const destinationY = level.exit.y * cellSize;
    const tileAtlas = this.assets?.tileAtlas;
    if (tileAtlas) {
      const tileId = animationFrameIndexes.exit % 2 === 0 ? RUNTIME_TILE.border : RUNTIME_TILE.empty;
      this.drawAtlasFrame(context, tileAtlas, tileId, destinationX, destinationY, cellSize);
      return;
    }

    context.fillStyle = animationFrameIndexes.exit % 2 === 0
      ? getWorldTileDefinition("border")?.fallbackColor ?? PREVIEW_BACKGROUND_COLOR
      : getWorldTileDefinition("empty")?.fallbackColor ?? PREVIEW_BACKGROUND_COLOR;
    context.fillRect(destinationX, destinationY, cellSize, cellSize);
  }

  /** Dessine une frame horizontale d'atlas de 16px vers une cellule destination entiere. */
  private drawAtlasFrame(
    context: CanvasRenderingContext2D,
    atlas: HTMLImageElement,
    frameIndex: number,
    destinationX: number,
    destinationY: number,
    cellSize: number
  ): void {
    context.drawImage(
      atlas,
      frameIndex * PREVIEW_SOURCE_TILE_SIZE,
      0,
      PREVIEW_SOURCE_TILE_SIZE,
      PREVIEW_SOURCE_TILE_SIZE,
      destinationX,
      destinationY,
      cellSize,
      cellSize
    );
  }
}

/** Etat d'animation par defaut pour les previews statiques avant le premier tick. */
const DEFAULT_ANIMATION_FRAME_INDEXES: LevelShowcasePreviewAnimationFrameIndexes = {
  player: 0,
  diamond: 0,
  monster: 0,
  exit: 0
};

/** Calcule une taille de cellule entiere qui conserve les proportions du niveau. */
function resolvePreviewCellSize(level: ModernLevelJson, options: LevelShowcasePreviewRenderOptions): number {
  const maxWidth = Math.max(1, Math.floor(options.maxWidth ?? DEFAULT_PREVIEW_MAX_WIDTH));
  const maxHeight = Math.max(1, Math.floor(options.maxHeight ?? DEFAULT_PREVIEW_MAX_HEIGHT));
  const maxCellSize = Math.floor(Math.min(maxWidth / level.width, maxHeight / level.height));
  const preferredCellSize = options.preferSourceTileSize === false
    ? maxCellSize
    : Math.min(PREVIEW_SOURCE_TILE_SIZE, maxCellSize);
  return Math.max(options.minCellSize ?? 1, preferredCellSize);
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

/** Retourne une frame d'animation en protegeant les listes vides. */
function pickAnimationFrame(frames: readonly number[], frameIndex: number): number {
  if (frames.length === 0) {
    return 0;
  }

  return frames[frameIndex % frames.length];
}
