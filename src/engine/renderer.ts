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

/**
 * Renderer canvas pixel-perfect.
 *
 * Ce module fournit une abstraction de dessin adaptee a la resolution TO8,
 * tout en gardant les scenes independantes de l'API Canvas 2D.
 */

/** Contrat de rendu consomme par les scenes. */
export interface Renderer {
  /** Largeur logique de rendu. */
  readonly width: number;

  /** Hauteur logique de rendu. */
  readonly height: number;

  /** Prepare le contexte avant de dessiner une nouvelle frame. */
  beginFrame(): void;

  /** Efface l'ecran avec une couleur, noir TO8 par defaut. */
  clear(color?: string): void;

  /** Dessine un rectangle plein en coordonnees logiques. */
  fillRect(x: number, y: number, width: number, height: number, color: string): void;

  /** Dessine le contour d'un rectangle en coordonnees logiques. */
  strokeRect(x: number, y: number, width: number, height: number, color: string): void;

  /** Dessine une frame de sprite avec options de retournement et opacite. */
  drawSprite(frame: SpriteFrame, x: number, y: number, options?: DrawSpriteOptions): void;

  /** Dessine une tuile sans transformation. */
  drawTile(frame: TileFrame, x: number, y: number): void;

  /** Dessine une image complete ou une region source. */
  drawImage(image: CanvasImageSource, x: number, y: number, options?: DrawImageOptions): void;

  /** Dessine du texte avec la police bitmap interne. */
  drawPixelText(text: string, x: number, y: number, color: string, scale?: number): void;

  /** Dessine du texte via l'interface d'options standardisee. */
  drawText(text: string, x: number, y: number, options: DrawTextOptions): void;

  /** Mesure la largeur du texte bitmap en pixels logiques. */
  measurePixelText(text: string, scale?: number): number;
}

/** Implementation Canvas 2D du renderer logique. */
export class Canvas2DRenderer implements Renderer {
  /** Largeur logique fixe. */
  readonly width = LOGICAL_WIDTH;

  /** Hauteur logique fixe. */
  readonly height = LOGICAL_HEIGHT;

  /** Contexte Canvas 2D configure en pixel art. */
  private readonly context: CanvasRenderingContext2D;

  /** Initialise le canvas a la resolution logique TO8. */
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

  /** Reactive le rendu sans lissage au debut de chaque frame. */
  beginFrame(): void {
    this.context.imageSmoothingEnabled = false;
  }

  /** Remplit toute la surface logique avec la couleur choisie. */
  clear(color = TO8_PALETTE.black): void {
    this.fillRect(0, 0, this.width, this.height, color);
  }

  /** Dessine un rectangle plein aligne sur les pixels entiers. */
  fillRect(x: number, y: number, width: number, height: number, color: string): void {
    this.context.fillStyle = color;
    this.context.fillRect(Math.floor(x), Math.floor(y), Math.floor(width), Math.floor(height));
  }

  /** Dessine un contour net en compensant le demi-pixel Canvas. */
  strokeRect(x: number, y: number, width: number, height: number, color: string): void {
    this.context.strokeStyle = color;
    this.context.lineWidth = 1;
    this.context.strokeRect(Math.floor(x) + 0.5, Math.floor(y) + 0.5, width - 1, height - 1);
  }

  /** Dessine une frame de sprite en respectant pivot, flip et opacite. */
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

  /** Dessine une frame de tuile a sa taille cible. */
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

  /** Dessine une image complete ou une sous-region sans lissage. */
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

  /** Dessine une chaine avec la police bitmap embarquee. */
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

  /** Mesure la largeur d'une chaine rendue avec `drawPixelText`. */
  measurePixelText(text: string, scale = 1): number {
    if (text.length === 0) {
      return 0;
    }

    return text.length * BITMAP_FONT_WIDTH * scale + (text.length - 1) * scale;
  }

  /** Adapte `DrawTextOptions` vers le rendu de police bitmap. */
  drawText(text: string, x: number, y: number, options: DrawTextOptions): void {
    this.drawPixelText(text, x, y, options.color, options.scale);
  }

  /** Dessine une region source de sprite vers une position destination. */
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
