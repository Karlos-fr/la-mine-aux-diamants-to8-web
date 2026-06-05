export interface Point2D {
  readonly x: number;
  readonly y: number;
}

export interface Size2D {
  readonly width: number;
  readonly height: number;
}

export interface Rect2D extends Point2D, Size2D {}

export interface SpriteFrame {
  readonly id: string;
  readonly source: CanvasImageSource;
  readonly sourceRect: Rect2D;
  readonly pivot?: Point2D;
}

export interface TileFrame {
  readonly id: string;
  readonly source: CanvasImageSource;
  readonly sourceRect: Rect2D;
  readonly size: Size2D;
}

export interface DrawSpriteOptions {
  readonly flipX?: boolean;
  readonly flipY?: boolean;
  readonly opacity?: number;
}

export interface DrawTextOptions {
  readonly color: string;
  readonly scale?: number;
}

export interface DrawImageOptions {
  readonly sourceRect?: Rect2D;
}
