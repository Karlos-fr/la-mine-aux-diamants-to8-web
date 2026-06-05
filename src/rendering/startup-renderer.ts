import { TO8_PALETTE } from "../assets/palette";
import type { Renderer } from "../engine/renderer";

export interface StartupTitleFrame {
  readonly path: string;
  readonly x?: number;
  readonly y?: number;
}

export interface StartupTitleRenderState {
  readonly baseImage?: HTMLImageElement;
  readonly currentSparkle?: StartupTitleFrame;
  readonly currentFace?: StartupTitleFrame;
  readonly currentFeet?: StartupTitleFrame;
  readonly sparkleImage?: HTMLImageElement;
  readonly faceImage?: HTMLImageElement;
  readonly feetImage?: HTMLImageElement;
}

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
    } else {
      renderer.drawPixelText("CHARGEMENT...", 112, 92, TO8_PALETTE.yellow, 1);
    }
    return;
  }

  renderer.clear(TO8_PALETTE.black);
  renderer.drawImage(backgroundImage, 0, 0);
}

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
