/**
 * Role: Cache les `TileFrame` crees depuis les atlas gameplay.
 * Scope: Evite de reconstruire les rectangles source pour tuiles, diamants et monstres.
 * ISO: Les offsets d'atlas restent calcules selon les tile ids / indices extraits.
 * Notes: Le cache ne charge pas les images; il les recoit deja chargees.
 */

import type { TileFrame } from "../engine/render-types";

/** Dimensions communes utilisees pour creer des frames depuis un atlas. */
export interface TileFrameCacheConfig {
  /** Taille source d'une frame dans l'atlas. */
  readonly sourceSize: number;
  /** Taille de rendu d'une frame a l'ecran. */
  readonly renderSize: number;
}

/** Cache de frames reutilise par le rendu gameplay. */
export class TileFrameCache {
  /** Frames indexees par tile id runtime. */
  private readonly tileFrames = new Map<number, TileFrame>();
  /** Frames d'atlas animes indexees par cle descriptive. */
  private readonly animationFrames = new Map<string, TileFrame>();

  /** Cree un cache avec les dimensions d'atlas/rendu donnees. */
  constructor(private readonly config: TileFrameCacheConfig) {}

  /** Retourne la frame d'une tuile runtime depuis l'atlas principal. */
  getTileFrame(atlasImage: HTMLImageElement, tileId: number): TileFrame {
    const existing = this.tileFrames.get(tileId);
    if (existing) {
      return existing;
    }

    const frame = this.createFrame(`tile-${tileId}`, atlasImage, tileId * this.config.sourceSize, 0);
    this.tileFrames.set(tileId, frame);
    return frame;
  }

  /** Retourne une frame d'atlas animee depuis une cle de cache et un indice. */
  getAtlasFrame(atlasImage: HTMLImageElement, cacheKey: string, frameIndex: number): TileFrame {
    const existing = this.animationFrames.get(cacheKey);
    if (existing) {
      return existing;
    }

    const frame = this.createFrame(cacheKey, atlasImage, frameIndex * this.config.sourceSize, 0);
    this.animationFrames.set(cacheKey, frame);
    return frame;
  }

  /** Construit une frame avec rectangle source et taille de destination. */
  private createFrame(id: string, atlasImage: HTMLImageElement, sourceX: number, sourceY: number): TileFrame {
    return {
      id,
      source: atlasImage,
      sourceRect: {
        x: sourceX,
        y: sourceY,
        width: this.config.sourceSize,
        height: this.config.sourceSize
      },
      size: {
        width: this.config.renderSize,
        height: this.config.renderSize
      }
    };
  }
}
