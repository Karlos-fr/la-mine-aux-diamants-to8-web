import { mineTitleMetadata } from "../assets/generated/mine-title";
import type { InputState } from "../engine/input";
import { loadImage } from "../engine/image-loader";
import type { Renderer } from "../engine/renderer";
import type { Scene, SceneContext } from "../engine/scene";
import { RUNTIME_ASSET_URLS, docsExtractionAssetUrl } from "../assets/runtime-assets";
import { renderStartupInfogram, renderStartupTitle, type StartupTitleFrame } from "../rendering/startup-renderer";
import { createGameplayScene } from "./scene-factory";

export class StartupInfogramScene implements Scene {
  private context: SceneContext | undefined;
  private elapsed = 0;
  private backgroundImage: HTMLImageElement | undefined;
  private backgroundError: string | null = null;

  private readonly backgroundImageUrl = RUNTIME_ASSET_URLS.startupInfogramesPresents;

  constructor() {
    void loadImage(this.backgroundImageUrl).then((image) => {
      this.backgroundImage = image;
    }).catch((error) => {
      this.backgroundError = error instanceof Error ? error.message : String(error);
    });
  }

  enter(context: SceneContext): void {
    this.context = context;
  }

  update(dt: number, input: InputState): void {
    this.elapsed += dt;

    const skip = this.backgroundImage !== undefined && (
      this.elapsed > 2 || input.justPressed.confirm || input.justPressed.action || input.justPressed.cancel
    );
    if (skip) {
      this.context?.setScene(new StartupTitleScene());
    }
  }

  render(renderer: Renderer): void {
    renderStartupInfogram(renderer, this.backgroundImage, this.backgroundError);
  }
}

export class StartupTitleScene implements Scene {
  private context: SceneContext | undefined;
  private sparkleElapsed = 0;
  private faceElapsed = 0;
  private feetElapsed = 0;
  private sparkleIndex = 0;
  private faceIndex = 0;
  private feetIndex = 0;

  private baseImage: HTMLImageElement | undefined;
  private readonly faceFrames: StartupTitleFrame[];
  private readonly sparkleFrames: StartupTitleFrame[];
  private readonly feetFrames: StartupTitleFrame[];
  private readonly baseImagePath = RUNTIME_ASSET_URLS.startupTitleBase;

  private readonly faceImageCache = new Map<string, HTMLImageElement>();
  private readonly sparkleImageCache = new Map<string, HTMLImageElement>();
  private readonly feetImageCache = new Map<string, HTMLImageElement>();

  private readonly sparkleTiming = 1 / 12;
  private readonly faceTiming = 1 / 14;
  private readonly feetTiming = 1 / 6;

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

  enter(context: SceneContext): void {
    this.context = context;
  }

  update(dt: number, input: InputState): void {
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
      this.context?.setScene(createGameplayScene(1));
    }
  }

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
  }

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

function pick<T>(value: ReadonlyArray<T> | undefined, index: number): T | undefined {
  return value?.[index];
}
