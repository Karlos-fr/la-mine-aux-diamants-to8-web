/**
 * Role: Rend les deux ecrans startup ISO.
 * Scope: Dessine l'ecran Infogrames et l'ecran titre anime a partir d'images deja chargees.
 * ISO: Les positions et images viennent des extractions startup/title.
 * Notes: Les timers et transitions restent dans les scenes startup.
 */

import { TO8_PALETTE } from "../assets/palette";
import type { Renderer } from "../engine/renderer";

/** Frame d'animation title extraite avec son chemin et sa position ecran optionnelle. */
export interface StartupTitleFrame {
  /** Chemin relatif dans `docs/extraction`. */
  readonly path: string;
  /** Position X de rendu si la frame n'est pas plein ecran. */
  readonly x?: number;
  /** Position Y de rendu si la frame n'est pas plein ecran. */
  readonly y?: number;
}

/** Etat de rendu instantane de l'ecran titre. */
export interface StartupTitleRenderState {
  /** Image de base plein ecran du titre. */
  readonly baseImage?: HTMLImageElement;
  /** Frame courante de scintillement. */
  readonly currentSparkle?: StartupTitleFrame;
  /** Frame courante du visage. */
  readonly currentFace?: StartupTitleFrame;
  /** Frame courante des pieds. */
  readonly currentFeet?: StartupTitleFrame;
  /** Image chargee du scintillement courant. */
  readonly sparkleImage?: HTMLImageElement;
  /** Image chargee du visage courant. */
  readonly faceImage?: HTMLImageElement;
  /** Image chargee des pieds courants. */
  readonly feetImage?: HTMLImageElement;
}

/** Rend l'ecran Infogrames ou son etat de chargement/erreur. */
export function renderStartupInfogram(
  renderer: Renderer,
  backgroundImage: HTMLImageElement | undefined,
  backgroundError: string | null
): void {
  if (!backgroundImage) {
    renderer.clear(TO8_PALETTE.black);
    if (backgroundError) {
      renderer.drawPixelText("ERREUR INFOGRAMES", 72, 92, TO8_PALETTE.yellow, 2);
      renderer.drawPixelText(backgroundError.slice(0, 40), 40, 112, TO8_PALETTE.white);
    }
    return;
  }

  renderer.clear(TO8_PALETTE.black);
  renderer.drawImage(backgroundImage, 0, 0);
}

/** Rend l'ecran titre anime a partir de l'etat instantane fourni. */
export function renderStartupTitle(renderer: Renderer, state: StartupTitleRenderState): void {
  if (!state.baseImage) {
    renderer.clear("#000000");
    return;
  }

  renderer.clear("#000000");
  renderer.drawImage(state.baseImage, 0, 0);

  if (state.sparkleImage) {
    renderer.drawImage(state.sparkleImage, 0, 0);
  }

  if (state.faceImage && state.currentFace) {
    renderer.drawImage(state.faceImage, state.currentFace.x ?? 192, state.currentFace.y ?? 24);
  }

  if (state.feetImage && state.currentFeet) {
    renderer.drawImage(state.feetImage, state.currentFeet.x ?? 144, state.currentFeet.y ?? 162);
  }
}
