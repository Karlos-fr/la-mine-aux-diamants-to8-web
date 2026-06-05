import type { TileFrame } from "../engine/render-types";

export interface TileFrameCacheConfig {
  readonly sourceSize: number;
  readonly renderSize: number;
}

export class TileFrameCache {
  private readonly tileFrames = new Map<number, TileFrame>();
  private readonly animationFrames = new Map<string, TileFrame>();

  constructor(private readonly config: TileFrameCacheConfig) {}

  getTileFrame(atlasImage: HTMLImageElement, tileId: number): TileFrame {
    const existing = this.tileFrames.get(tileId);
    if (existing) {
      return existing;
    }

    const frame = this.createFrame(`tile-${tileId}`, atlasImage, tileId * this.config.sourceSize, 0);
    this.tileFrames.set(tileId, frame);
    return frame;
  }

  getAtlasFrame(atlasImage: HTMLImageElement, cacheKey: string, frameIndex: number): TileFrame {
    const existing = this.animationFrames.get(cacheKey);
    if (existing) {
      return existing;
    }

    const frame = this.createFrame(cacheKey, atlasImage, frameIndex * this.config.sourceSize, 0);
    this.animationFrames.set(cacheKey, frame);
    return frame;
  }

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
