/**
 * Role: Gere le premier ecran startup Infogrames avant le titre anime.
 * Scope: Charge l'image extraite, gere le skip temporise/input et navigue vers `StartupTitleScene`.
 * ISO: L'image plein ecran vient des extractions Infogrames originales.
 * Notes: Le ratio TO8 reste force pendant cet ecran, independamment des options gameplay.
 */

import { gameAudio } from "../audio/audio-engine";
import type { InputState } from "../engine/input";
import { loadImage } from "../engine/image-loader";
import type { Renderer } from "../engine/renderer";
import type { Scene, SceneContext } from "../engine/scene";
import { RUNTIME_ASSET_URLS } from "../assets/runtime-assets";
import { renderStartupInfogram } from "../rendering/startup-renderer";
import { StartupTitleScene } from "./startup-screens";

/** Classe CSS qui conserve le ratio TO8 des ecrans startup quelle que soit l'option gameplay. */
const STARTUP_FIXED_ASPECT_CLASS = "startup-screen-fixed-aspect";

/** Scene du premier ecran startup: logo Infogrames/presente puis transition titre. */
export class StartupInfogramScene implements Scene {
  /** Contexte de scene fourni par le routeur pour naviguer vers l'ecran titre. */
  private context: SceneContext | undefined;
  /** Temps ecoule depuis l'entree dans l'ecran Infogrames. */
  private elapsed = 0;
  /** Image plein ecran chargee de l'ecran Infogrames/presente. */
  private backgroundImage: HTMLImageElement | undefined;
  /** Message d'erreur de chargement affiche si l'image manque. */
  private backgroundError: string | null = null;

  /** URL runtime centralisee de l'image Infogrames. */
  private readonly backgroundImageUrl = RUNTIME_ASSET_URLS.startupInfogramesPresents;

  /** Lance le chargement asynchrone de l'image Infogrames. */
  constructor() {
    void loadImage(this.backgroundImageUrl).then((image) => {
      this.backgroundImage = image;
    }).catch((error) => {
      this.backgroundError = error instanceof Error ? error.message : String(error);
    });
  }

  /** Recupere le contexte de navigation de la scene. */
  enter(context: SceneContext): void {
    this.context = context;
    document.body.classList.add(STARTUP_FIXED_ASPECT_CLASS);
    gameAudio.disarmTitleMusic();
  }

  /** Nettoie le ratio force et coupe toute musique de titre residuelle. */
  exit(): void {
    document.body.classList.remove(STARTUP_FIXED_ASPECT_CLASS);
    gameAudio.stopTitleMusic();
  }

  /** Avance le timer et passe au titre apres delai ou action utilisateur. */
  update(dt: number, input: InputState): void {
    this.elapsed += dt;

    const skip = this.backgroundImage !== undefined && (
      this.elapsed > 2 || input.justPressed.confirm || input.justPressed.action || input.justPressed.cancel
    );
    if (skip) {
      this.context?.setScene(new StartupTitleScene());
    }
  }

  /** Rend l'ecran Infogrames ou son etat chargement/erreur. */
  render(renderer: Renderer): void {
    renderStartupInfogram(renderer, this.backgroundImage, this.backgroundError);
  }
}
