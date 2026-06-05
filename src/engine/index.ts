/**
 * Facade publique du moteur.
 *
 * Ce module regroupe les types moteurs utilises par les scenes et le point
 * d'entree sans forcer les appelants a connaitre l'organisation interne.
 */

/** Types lies a l'etat d'input abstrait. */
export type { InputAction, InputState } from "./input";

/** Interface de rendu commune aux scenes. */
export type { Renderer } from "./renderer";

/** Types de base du routeur de scenes. */
export type { Scene, SceneContext } from "./scene";

/** Primitives geometriques et options de rendu exposees aux scenes. */
export type {
  DrawSpriteOptions,
  DrawTextOptions,
  Point2D,
  Rect2D,
  Size2D,
  SpriteFrame,
  TileFrame
} from "./render-types";
