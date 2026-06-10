/**
 * Role: Gere les reglages camera souris du mode Diorama TO8.
 * Scope: Convertit l'input logique en rotation/zoom visuels, sans toucher au gameplay.
 * ISO: La camera Diorama ne modifie jamais la camera runtime ni les positions de grille.
 * Notes: Les coordonnees d'entree restent celles du canvas logique.
 */

import type { InputState } from "../engine/input";
import type { GameplayDioramaCameraSettings } from "./gameplay-renderer";

/** Rotation X initiale de la scene diorama. */
const DEFAULT_ROTATION_X_DEG = 350;
/** Rotation Y initiale de la scene diorama. */
const DEFAULT_ROTATION_Y_DEG = 350;
/** Rotation Z initiale de la scene diorama. */
const DEFAULT_ROTATION_Z_DEG = 0;
/** Zoom initial du groupe diorama. */
const DEFAULT_ZOOM = 1;
/** Zoom minimal du groupe diorama. */
const MIN_ZOOM = 0.45;
/** Zoom maximal du groupe diorama. */
const MAX_ZOOM = 3;
/** Sensibilite de la molette du mode diorama. */
const WHEEL_ZOOM_FACTOR = 0.0015;
/** Sensibilite du drag souris pour pivoter la scene. */
const MOUSE_DEGREES_PER_PIXEL = 0.7;

/** Etat initial du drag souris. */
interface DioramaDragStart {
  /** Position horizontale logique du pointeur au debut du drag. */
  readonly pointerX: number;
  /** Position verticale logique du pointeur au debut du drag. */
  readonly pointerY: number;
  /** Indique si le drag droit modifie l'axe Z. */
  readonly rightButton: boolean;
  /** Rotation X initiale. */
  readonly rotationXDeg: number;
  /** Rotation Y initiale. */
  readonly rotationYDeg: number;
  /** Rotation Z initiale. */
  readonly rotationZDeg: number;
}

/** Controleur de camera purement visuel pour le Diorama TO8. */
export class DioramaCameraController {
  /** Reglages camera courants. */
  private settings: GameplayDioramaCameraSettings = {
    rotationXDeg: DEFAULT_ROTATION_X_DEG,
    rotationYDeg: DEFAULT_ROTATION_Y_DEG,
    rotationZDeg: DEFAULT_ROTATION_Z_DEG,
    zoom: DEFAULT_ZOOM
  };
  /** Point de depart du drag souris courant. */
  private dragStart: DioramaDragStart | null = null;

  /** Retourne les reglages a fournir au renderer. */
  getSettings(): GameplayDioramaCameraSettings {
    return this.settings;
  }

  /** Avance les reglages depuis l'input logique courant. */
  update(input: InputState, enabled: boolean, playfieldHeight: number): void {
    if (!enabled) {
      this.dragStart = null;
      return;
    }

    if (input.pointer.inside && input.pointer.y < playfieldHeight && input.pointer.wheelDeltaY !== 0) {
      const zoomDelta = -input.pointer.wheelDeltaY * WHEEL_ZOOM_FACTOR;
      this.settings = {
        ...this.settings,
        zoom: clamp(this.settings.zoom * (1 + zoomDelta), MIN_ZOOM, MAX_ZOOM)
      };
    }

    const startsLeftDrag = input.pointer.justPressed && input.pointer.inside && input.pointer.y < playfieldHeight;
    const startsRightDrag = input.pointer.rightJustPressed && input.pointer.inside && input.pointer.y < playfieldHeight;
    if (startsLeftDrag || startsRightDrag) {
      this.dragStart = {
        pointerX: input.pointer.x,
        pointerY: input.pointer.y,
        rightButton: startsRightDrag,
        rotationXDeg: this.settings.rotationXDeg,
        rotationYDeg: this.settings.rotationYDeg,
        rotationZDeg: this.settings.rotationZDeg
      };
    }

    if (!input.pointer.pressed && !input.pointer.rightPressed) {
      this.dragStart = null;
      return;
    }

    if (!this.dragStart) {
      return;
    }

    const deltaX = input.pointer.x - this.dragStart.pointerX;
    const deltaY = input.pointer.y - this.dragStart.pointerY;
    const deltaRotationX = -deltaY * MOUSE_DEGREES_PER_PIXEL;
    const deltaRotationY = deltaX * MOUSE_DEGREES_PER_PIXEL;
    const deltaRotationZ = deltaX * MOUSE_DEGREES_PER_PIXEL;
    this.settings = this.dragStart.rightButton
      ? {
          rotationXDeg: this.dragStart.rotationXDeg,
          rotationYDeg: this.dragStart.rotationYDeg + deltaRotationY,
          rotationZDeg: this.dragStart.rotationZDeg + deltaRotationZ,
          zoom: this.settings.zoom
        }
      : {
          rotationXDeg: this.dragStart.rotationXDeg + deltaRotationX,
          rotationYDeg: this.dragStart.rotationYDeg + deltaRotationY,
          rotationZDeg: this.dragStart.rotationZDeg,
          zoom: this.settings.zoom
        };
  }
}

/** Contraint une valeur numerique dans une plage. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
