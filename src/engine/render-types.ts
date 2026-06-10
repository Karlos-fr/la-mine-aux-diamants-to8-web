/**
 * Types geometriques et options de rendu.
 *
 * Ces contrats gardent le renderer canvas et les scenes decouples tout en
 * manipulant des rectangles et frames explicites.
 */

/** Point 2D dans l'espace logique du jeu. */
export interface Point2D {
  /** Coordonnees horizontales en pixels. */
  readonly x: number;

  /** Coordonnees verticales en pixels. */
  readonly y: number;
}

/** Taille 2D en pixels. */
export interface Size2D {
  /** Largeur en pixels. */
  readonly width: number;

  /** Hauteur en pixels. */
  readonly height: number;
}

/** Taille logique dans laquelle les scenes expriment leurs coordonnees. */
export interface LogicalRenderSize extends Size2D {}

/** Taille de la surface bitmap cible pour un rendu moderne haute resolution. */
export interface RenderSurfaceSize extends Size2D {}

/** Taille CSS finale du canvas dans la page navigateur. */
export interface CssDisplaySize extends Size2D {}

/** Rectangle source ou destination compose d'une position et d'une taille. */
export interface Rect2D extends Point2D, Size2D {}

/** Frame de sprite, avec pivot optionnel pour l'ancrage de rendu. */
export interface SpriteFrame {
  /** Identifiant stable de la frame. */
  readonly id: string;

  /** Image source contenant la frame. */
  readonly source: CanvasImageSource;

  /** Rectangle de decoupe dans l'image source. */
  readonly sourceRect: Rect2D;

  /** Pivot optionnel soustrait a la position de dessin. */
  readonly pivot?: Point2D;
}

/** Frame de tuile dessinee a taille fixe dans la grille. */
export interface TileFrame {
  /** Identifiant stable de la frame. */
  readonly id: string;

  /** Image source contenant la tuile. */
  readonly source: CanvasImageSource;

  /** Rectangle de decoupe dans l'image source. */
  readonly sourceRect: Rect2D;

  /** Taille de rendu de la tuile. */
  readonly size: Size2D;
}

/** Options supplementaires pour le dessin de sprites. */
export interface DrawSpriteOptions {
  /** Retourne horizontalement la frame. */
  readonly flipX?: boolean;

  /** Retourne verticalement la frame. */
  readonly flipY?: boolean;

  /** Opacite appliquee pendant le dessin. */
  readonly opacity?: number;
}

/** Options pour le texte bitmap du renderer. */
export interface DrawTextOptions {
  /** Couleur CSS du texte. */
  readonly color: string;

  /** Facteur d'echelle pixel-perfect. */
  readonly scale?: number;
}

/** Options pour dessiner une image complete ou une region source. */
export interface DrawImageOptions {
  /** Rectangle source optionnel a extraire de l'image. */
  readonly sourceRect?: Rect2D;

  /** Taille destination optionnelle, utile pour reduire une image haute resolution. */
  readonly destinationSize?: Size2D;

  /** Active ponctuellement le lissage Canvas pendant ce dessin. */
  readonly smoothing?: boolean;
}
