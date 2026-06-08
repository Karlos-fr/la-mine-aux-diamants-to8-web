/**
 * Role: Rend les apercus dynamiques de niveaux pour la future vitrine.
 * Scope: Dessine un `ModernLevelJson` dans un canvas DOM, sans dependance a une scene gameplay.
 * ISO: Les tuiles utilisent les atlas runtime extraits afin de rester visuellement proches du TO8.
 * Notes: Le canvas est redimensionne en pixels reels pour conserver un rendu net sans lissage.
 */

import type { LoadedRuntimeAssets } from "../assets/runtime-asset-loader";
import type { ModernEntityType, ModernLevelJson, ModernTileType } from "../game/level-loader";
import { RUNTIME_TILE } from "../game/runtime-tiles";

/** Taille source commune des tuiles et sprites extraits. */
const PREVIEW_SOURCE_TILE_SIZE = 16;
/** Largeur maximale par defaut d'un apercu de liste. */
const DEFAULT_PREVIEW_MAX_WIDTH = 320;
/** Hauteur maximale par defaut d'un apercu de liste. */
const DEFAULT_PREVIEW_MAX_HEIGHT = 180;
/** Couleur de fond quand les assets ne sont pas encore disponibles. */
const PREVIEW_BACKGROUND_COLOR = "#000000";
/** Couleur de contour utilisee pour rendre la sortie identifiable en miniature. */
const PREVIEW_EXIT_MARKER_COLOR = "#00ffff";
/** Couleur de contour utilisee si l'atlas joueur est indisponible. */
const PREVIEW_PLAYER_FALLBACK_COLOR = "#ff0000";

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

/** Mappe les tuiles modernes vers les ids runtime extraits. */
const PREVIEW_TILE_TO_RUNTIME_ID: Readonly<Record<ModernTileType, number>> = {
  empty: RUNTIME_TILE.empty,
  earth: RUNTIME_TILE.earth,
  rock: RUNTIME_TILE.rock,
  diamond: RUNTIME_TILE.diamond,
  monster: RUNTIME_TILE.monster,
  border: RUNTIME_TILE.border,
  platform: RUNTIME_TILE.platform,
  specialCreature: RUNTIME_TILE.specialCreature,
  transformerBlock: RUNTIME_TILE.transformerBlock
};

/** Couleurs de secours quand les atlas runtime ne sont pas encore charges. */
const PREVIEW_FALLBACK_COLORS: Readonly<Record<ModernTileType, string>> = {
  empty: "#000000",
  earth: "#00b000",
  rock: "#c0c0c0",
  diamond: "#00ffff",
  monster: "#ffffff",
  border: "#0001fe",
  platform: "#80ff80",
  specialCreature: "#ff00ff",
  transformerBlock: "#ffff00"
};

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

    this.renderTiles(context, level, cellSize);
    this.renderEntities(context, level, cellSize);
    this.renderExitMarker(context, level, cellSize);
    this.renderPlayerSpawn(context, level, cellSize);

    return { width, height, cellSize };
  }

  /** Rend la grille de tuiles complete en appliquant la tuile par defaut. */
  private renderTiles(context: CanvasRenderingContext2D, level: ModernLevelJson, cellSize: number): void {
    for (let y = 0; y < level.height; y += 1) {
      for (let x = 0; x < level.width; x += 1) {
        this.drawTile(context, level.defaultTile, x, y, cellSize);
      }
    }

    for (const cell of level.tiles) {
      this.drawTile(context, cell.type, cell.x, cell.y, cellSize);
    }
  }

  /** Rend les entites declaratives par-dessus la grille statique. */
  private renderEntities(context: CanvasRenderingContext2D, level: ModernLevelJson, cellSize: number): void {
    for (const entity of level.entities) {
      this.drawEntity(context, entity.type, entity.x, entity.y, cellSize);
    }
  }

  /** Rend une tuile moderne avec atlas runtime ou couleur de secours. */
  private drawTile(context: CanvasRenderingContext2D, tile: ModernTileType, gridX: number, gridY: number, cellSize: number): void {
    const destinationX = gridX * cellSize;
    const destinationY = gridY * cellSize;
    const tileAtlas = this.assets?.tileAtlas;
    if (tileAtlas) {
      const tileId = PREVIEW_TILE_TO_RUNTIME_ID[tile];
      this.drawAtlasFrame(context, tileAtlas, tileId, destinationX, destinationY, cellSize);
      return;
    }

    context.fillStyle = PREVIEW_FALLBACK_COLORS[tile];
    context.fillRect(destinationX, destinationY, cellSize, cellSize);
  }

  /** Rend une entite animee avec sa premiere frame disponible. */
  private drawEntity(context: CanvasRenderingContext2D, type: ModernEntityType, gridX: number, gridY: number, cellSize: number): void {
    const destinationX = gridX * cellSize;
    const destinationY = gridY * cellSize;

    if (type === "diamond" && this.assets?.diamondAtlas) {
      this.drawAtlasFrame(context, this.assets.diamondAtlas, 0, destinationX, destinationY, cellSize);
      return;
    }

    if (type === "monster" && this.assets?.monsterAtlas) {
      this.drawAtlasFrame(context, this.assets.monsterAtlas, 0, destinationX, destinationY, cellSize);
      return;
    }

    if (type === "specialCreature" && this.assets?.specialCreatureAtlas) {
      this.drawAtlasFrame(context, this.assets.specialCreatureAtlas, 0, destinationX, destinationY, cellSize);
      return;
    }

    context.fillStyle = PREVIEW_FALLBACK_COLORS[type];
    context.fillRect(destinationX, destinationY, cellSize, cellSize);
  }

  /** Rend le spawn joueur avec la premiere frame idle ou un marqueur net. */
  private renderPlayerSpawn(context: CanvasRenderingContext2D, level: ModernLevelJson, cellSize: number): void {
    const destinationX = level.playerSpawn.x * cellSize;
    const destinationY = level.playerSpawn.y * cellSize;
    if (this.assets?.playerAtlas) {
      this.drawAtlasFrame(context, this.assets.playerAtlas, 0, destinationX, destinationY, cellSize);
      return;
    }

    context.strokeStyle = PREVIEW_PLAYER_FALLBACK_COLOR;
    context.lineWidth = Math.max(1, Math.floor(cellSize / 8));
    context.strokeRect(destinationX, destinationY, cellSize, cellSize);
  }

  /** Ajoute un contour de sortie sans masquer le rendu de la tuile sous-jacente. */
  private renderExitMarker(context: CanvasRenderingContext2D, level: ModernLevelJson, cellSize: number): void {
    const destinationX = level.exit.x * cellSize;
    const destinationY = level.exit.y * cellSize;
    context.strokeStyle = PREVIEW_EXIT_MARKER_COLOR;
    context.lineWidth = Math.max(1, Math.floor(cellSize / 8));
    context.strokeRect(destinationX, destinationY, cellSize, cellSize);
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
