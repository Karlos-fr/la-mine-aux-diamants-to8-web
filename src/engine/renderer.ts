import { BITMAP_FONT, BITMAP_FONT_HEIGHT, BITMAP_FONT_WIDTH } from "../assets/bitmap-font";
import { TO8_PALETTE } from "../assets/palette";
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from "./constants";
import type {
  DrawImageOptions,
  DrawSpriteOptions,
  DrawTextOptions,
  SpriteFrame,
  TileFrame
} from "./render-types";

export interface Renderer {
  readonly width: number;
  readonly height: number;
  beginFrame(): void;
  clear(color?: string): void;
  fillRect(x: number, y: number, width: number, height: number, color: string): void;
  strokeRect(x: number, y: number, width: number, height: number, color: string): void;
  drawSprite(frame: SpriteFrame, x: number, y: number, options?: DrawSpriteOptions): void;
  drawTile(frame: TileFrame, x: number, y: number): void;
  drawImage(image: CanvasImageSource, x: number, y: number, options?: DrawImageOptions): void;
  drawPixelText(text: string, x: number, y: number, color: string, scale?: number): void;
  drawText(text: string, x: number, y: number, options: DrawTextOptions): void;
  measurePixelText(text: string, scale?: number): number;
}

export class Canvas2DRenderer implements Renderer {
  readonly width = LOGICAL_WIDTH;
  readonly height = LOGICAL_HEIGHT;

  private readonly context: CanvasRenderingContext2D;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.canvas.width = LOGICAL_WIDTH;
    this.canvas.height = LOGICAL_HEIGHT;
    this.canvas.style.imageRendering = "pixelated";

    const context = this.canvas.getContext("2d", { alpha: false });
    if (!context) {
      throw new Error("Impossible d'initialiser Canvas2D.");
    }

    this.context = context;
    this.context.imageSmoothingEnabled = false;
  }

  beginFrame(): void {
    this.context.imageSmoothingEnabled = false;
  }

  clear(color = TO8_PALETTE.black): void {
    this.fillRect(0, 0, this.width, this.height, color);
  }

  fillRect(x: number, y: number, width: number, height: number, color: string): void {
    this.context.fillStyle = color;
    this.context.fillRect(Math.floor(x), Math.floor(y), Math.floor(width), Math.floor(height));
  }

  strokeRect(x: number, y: number, width: number, height: number, color: string): void {
    this.context.strokeStyle = color;
    this.context.lineWidth = 1;
    this.context.strokeRect(Math.floor(x) + 0.5, Math.floor(y) + 0.5, width - 1, height - 1);
  }

  drawSprite(frame: SpriteFrame, x: number, y: number, options: DrawSpriteOptions = {}): void {
    const pivotX = frame.pivot?.x ?? 0;
    const pivotY = frame.pivot?.y ?? 0;
    const destinationX = Math.floor(x - pivotX);
    const destinationY = Math.floor(y - pivotY);
    const opacity = options.opacity ?? 1;

    this.context.save();
    this.context.globalAlpha = opacity;

    if (options.flipX || options.flipY) {
      this.context.translate(
        destinationX + (options.flipX ? frame.sourceRect.width : 0),
        destinationY + (options.flipY ? frame.sourceRect.height : 0)
      );
      this.context.scale(options.flipX ? -1 : 1, options.flipY ? -1 : 1);
      this.drawImageRegion(frame, 0, 0);
    } else {
      this.drawImageRegion(frame, destinationX, destinationY);
    }

    this.context.restore();
  }

  drawTile(frame: TileFrame, x: number, y: number): void {
    this.context.drawImage(
      frame.source,
      frame.sourceRect.x,
      frame.sourceRect.y,
      frame.sourceRect.width,
      frame.sourceRect.height,
      Math.floor(x),
      Math.floor(y),
      frame.size.width,
      frame.size.height
    );
  }

  drawImage(image: CanvasImageSource, x: number, y: number, options?: DrawImageOptions): void {
    if (!options?.sourceRect) {
      this.context.drawImage(image, Math.floor(x), Math.floor(y));
      return;
    }

    const sourceRect = options.sourceRect;
    this.context.drawImage(
      image,
      sourceRect.x,
      sourceRect.y,
      sourceRect.width,
      sourceRect.height,
      Math.floor(x),
      Math.floor(y),
      sourceRect.width,
      sourceRect.height
    );
  }

  drawPixelText(text: string, x: number, y: number, color: string, scale = 1): void {
    const glyphStep = (BITMAP_FONT_WIDTH + 1) * scale;
    let cursorX = Math.floor(x);

    for (const character of text.toUpperCase()) {
      const glyph = BITMAP_FONT[character] ?? BITMAP_FONT["?"];
      for (let row = 0; row < BITMAP_FONT_HEIGHT; row += 1) {
        for (let column = 0; column < BITMAP_FONT_WIDTH; column += 1) {
          if (glyph[row]?.[column] === "1") {
            this.fillRect(cursorX + column * scale, y + row * scale, scale, scale, color);
          }
        }
      }
      cursorX += glyphStep;
    }
  }

  measurePixelText(text: string, scale = 1): number {
    if (text.length === 0) {
      return 0;
    }

    return text.length * BITMAP_FONT_WIDTH * scale + (text.length - 1) * scale;
  }

  drawText(text: string, x: number, y: number, options: DrawTextOptions): void {
    this.drawPixelText(text, x, y, options.color, options.scale);
  }

  private drawImageRegion(frame: SpriteFrame, destinationX: number, destinationY: number): void {
    this.context.drawImage(
      frame.source,
      frame.sourceRect.x,
      frame.sourceRect.y,
      frame.sourceRect.width,
      frame.sourceRect.height,
      destinationX,
      destinationY,
      frame.sourceRect.width,
      frame.sourceRect.height
    );
  }
}
