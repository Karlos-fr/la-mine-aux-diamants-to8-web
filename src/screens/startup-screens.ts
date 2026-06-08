/**
 * Role: Orchestre les deux ecrans startup ISO avant l'entree gameplay.
 * Scope: Charge les images, gere les timers/input et delegue le rendu a `startup-renderer`.
 * ISO: Les assets et positions viennent des extractions Infogrames/title.
 * Notes: Le second ecran titre est anime via les frames extraites.
 */

import { mineTitleMetadata } from "../assets/generated/mine-title";
import type { InputState } from "../engine/input";
import { loadImage } from "../engine/image-loader";
import type { Renderer } from "../engine/renderer";
import type { Scene, SceneContext } from "../engine/scene";
import { RUNTIME_ASSET_URLS, docsExtractionAssetUrl } from "../assets/runtime-assets";
import { gameAudio } from "../audio/audio-engine";
import { secondsFromTo8Ticks, TO8_RUNTIME_TIMING } from "../game/runtime-timing";
import { updateOptionsPopinInput } from "../options-popin-controller";
import { renderOptionsPopin } from "../rendering/options-popin-renderer";
import { renderStartupInfogram, renderStartupTitle, type StartupTitleFrame } from "../rendering/startup-renderer";
import { createAttractGameplayScene, createGameplayScene } from "./scene-factory";

/** Seuil ASM `$34`: nombre de passages de boucle titre avant lancement attract. */
const TITLE_ATTRACT_IDLE_TICKS = 0x34;
/** Duree moderne d'un passage de boucle titre `$8DD8`, centralisee dans `runtime-timing.ts`. */
const TITLE_ATTRACT_IDLE_TICK_DURATION = secondsFromTo8Ticks(TO8_RUNTIME_TIMING.titleAttractLoopTicks);
/** Classe CSS qui conserve le ratio TO8 des ecrans startup quelle que soit l'option gameplay. */
const STARTUP_FIXED_ASPECT_CLASS = "startup-screen-fixed-aspect";

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

  /** Arrete la musique de titre quand le flux quitte l'ecran 2. */
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

/** Scene du second ecran startup: titre principal anime et attente de la barre/action. */
export class StartupTitleScene implements Scene {
  /** Contexte de scene fourni par le routeur pour lancer le gameplay. */
  private context: SceneContext | undefined;
  /** Accumulateur de temps pour les scintillements. */
  private sparkleElapsed = 0;
  /** Accumulateur de temps pour le visage. */
  private faceElapsed = 0;
  /** Accumulateur de temps pour les pieds. */
  private feetElapsed = 0;
  /** Index courant de frame scintillement. */
  private sparkleIndex = 0;
  /** Index courant de frame visage. */
  private faceIndex = 0;
  /** Index courant de frame pieds. */
  private feetIndex = 0;
  /** Compteur logique d'inactivite equivalent a `$8DD8` dans l'ASM. */
  private attractIdleTicks = 0;
  /** Temps accumule avant le prochain passage logique du compteur `$8DD8`. */
  private attractIdleElapsed = 0;
  /** Indique si la pop-in d'options est ouverte sur le titre. */
  private optionsOpen = false;
  /** Categorie d'options selectionnee. */
  private selectedOptionsCategoryIndex = 0;

  /** Image de base plein ecran du titre. */
  private baseImage: HTMLImageElement | undefined;
  /** Frames extraites du visage. */
  private readonly faceFrames: StartupTitleFrame[];
  /** Frames extraites des etoiles/scintillements. */
  private readonly sparkleFrames: StartupTitleFrame[];
  /** Frames extraites des pieds. */
  private readonly feetFrames: StartupTitleFrame[];
  /** URL runtime centralisee de l'image de base du titre. */
  private readonly baseImagePath = RUNTIME_ASSET_URLS.startupTitleBase;

  /** Cache des images de visage chargees. */
  private readonly faceImageCache = new Map<string, HTMLImageElement>();
  /** Cache des images de scintillement chargees. */
  private readonly sparkleImageCache = new Map<string, HTMLImageElement>();
  /** Cache des images de pieds chargees. */
  private readonly feetImageCache = new Map<string, HTMLImageElement>();

  /** Frequence moderne de scintillement. */
  private readonly sparkleTiming = 1 / 12;
  /** Frequence moderne de l'animation visage. */
  private readonly faceTiming = 1 / 14;
  /** Frequence moderne de l'animation pieds. */
  private readonly feetTiming = 1 / 6;

  /** Extrait les listes de frames metadata et lance leur chargement image. */
  constructor() {
    const faceAnimation = mineTitleMetadata.animations.find((animation) => animation.id === "title-face");
    const sparkleAnimation = mineTitleMetadata.animations.find((animation) => animation.id === "title-sparkles");
    const feetAnimation = mineTitleMetadata.animations.find((animation) => animation.id === "title-feet");

    this.faceFrames = Array.from(faceAnimation?.frames ?? []).map((frame) => ({
      path: frame.path,
      x: frame.x,
      y: frame.y
    }));
    this.sparkleFrames = Array.from(sparkleAnimation?.frames ?? []).map((frame) => ({
      ...frame
    }));
    this.feetFrames = Array.from(feetAnimation?.frames ?? []).map((frame) => ({
      ...frame
    }));

    if (this.faceFrames.length === 0 || this.feetFrames.length === 0 || this.sparkleFrames.length === 0) {
      throw new Error("Assets d'animation de titre manquants.");
    }

    const baseImageUrl = this.baseImagePath;
    void loadImage(baseImageUrl).then((image) => {
      this.baseImage = image;
    }).catch(() => undefined);

    this.queueLoading(this.faceFrames, this.faceImageCache);
    this.queueLoading(this.sparkleFrames, this.sparkleImageCache);
    this.queueLoading(this.feetFrames, this.feetImageCache);
  }

  /** Recupere le contexte de navigation de la scene. */
  enter(context: SceneContext): void {
    this.context = context;
    document.body.classList.add(STARTUP_FIXED_ASPECT_CLASS);
    gameAudio.startTitleMusic();
  }

  /** Arrete la musique quand le joueur quitte le second ecran. */
  exit(): void {
    document.body.classList.remove(STARTUP_FIXED_ASPECT_CLASS);
    gameAudio.stopTitleMusic();
  }

  /** Avance les clocks d'animation, lance le jeu ou le mode attract selon l'inactivite. */
  update(dt: number, input: InputState): void {
    if (this.updateOptionsPopin(input)) {
      return;
    }

    this.sparkleElapsed += dt;
    this.faceElapsed += dt;
    this.feetElapsed += dt;

    while (this.sparkleElapsed >= this.sparkleTiming && this.sparkleFrames.length > 0) {
      this.sparkleElapsed -= this.sparkleTiming;
      this.sparkleIndex = (this.sparkleIndex + 1) % this.sparkleFrames.length;
    }

    while (this.faceElapsed >= this.faceTiming && this.faceFrames.length > 0) {
      this.faceElapsed -= this.faceTiming;
      this.faceIndex = (this.faceIndex + 1) % this.faceFrames.length;
    }

    while (this.feetElapsed >= this.feetTiming && this.feetFrames.length > 0) {
      this.feetElapsed -= this.feetTiming;
      this.feetIndex = (this.feetIndex + 1) % this.feetFrames.length;
    }

    if (input.justPressed.confirm || input.justPressed.action) {
      gameAudio.unlock();
      gameAudio.stopTitleMusic();
      this.context?.setScene(createGameplayScene(1));
      return;
    }

    if (hasAnyJustPressedInput(input)) {
      this.attractIdleTicks = 0;
      this.attractIdleElapsed = 0;
      return;
    }

    this.attractIdleElapsed += dt;
    while (this.attractIdleElapsed >= TITLE_ATTRACT_IDLE_TICK_DURATION) {
      this.attractIdleElapsed -= TITLE_ATTRACT_IDLE_TICK_DURATION;
      this.attractIdleTicks += 1;
      if (this.attractIdleTicks >= TITLE_ATTRACT_IDLE_TICKS) {
        gameAudio.stopTitleMusic();
        this.context?.setScene(createAttractGameplayScene(() => new StartupTitleScene()));
        return;
      }
    }
  }

  /** Rend l'image de base et les overlays animes courants. */
  render(renderer: Renderer): void {
    const currentSparkle = this.sparkleFrames[this.sparkleIndex];
    const currentFace = this.faceFrames[this.faceIndex];
    const currentFeet = pick(this.feetFrames, this.feetIndex) ?? this.feetFrames[0];

    renderStartupTitle(renderer, {
      baseImage: this.baseImage,
      currentSparkle,
      currentFace,
      currentFeet,
      sparkleImage: this.sparkleImageCache.get(currentSparkle.path),
      faceImage: this.faceImageCache.get(currentFace.path),
      feetImage: this.feetImageCache.get(currentFeet.path)
    });

    if (this.optionsOpen) {
      renderOptionsPopin({
        selectedCategoryIndex: this.selectedOptionsCategoryIndex,
        contextLabel: "Ecran titre"
      });
    }
  }

  /** Gere l'ouverture et la navigation de la pop-in d'options. */
  private updateOptionsPopin(input: InputState): boolean {
    const result = updateOptionsPopinInput(input, {
      isOpen: this.optionsOpen,
      selectedCategoryIndex: this.selectedOptionsCategoryIndex
    });
    this.optionsOpen = result.isOpen;
    this.selectedOptionsCategoryIndex = result.selectedCategoryIndex;
    if (result.toggledOpen) {
      this.attractIdleTicks = 0;
      this.attractIdleElapsed = 0;
    }

    return result.consumed;
  }

  /** Charge une liste de frames image dans le cache fourni. */
  private queueLoading(
    frames: StartupTitleFrame[],
    cache: Map<string, HTMLImageElement>
  ): void {
    frames.forEach((frame) => {
      if (!frame.path) {
        return;
      }

      const url = docsExtractionAssetUrl(frame.path);
      void loadImage(url).then((image) => {
        cache.set(frame.path, image);
      }).catch(() => undefined);
    });
  }
}

/** Retourne l'element d'un tableau si l'index existe. */
function pick<T>(value: ReadonlyArray<T> | undefined, index: number): T | undefined {
  return value?.[index];
}

/** Indique si une action utilisateur vient d'etre pressee sur le titre. */
function hasAnyJustPressedInput(input: InputState): boolean {
  return (
    input.justPressed.up ||
    input.justPressed.down ||
    input.justPressed.left ||
    input.justPressed.right ||
    input.justPressed.confirm ||
    input.justPressed.action ||
    input.justPressed.cancel
  );
}
