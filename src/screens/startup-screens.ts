import { mineTitleMetadata } from "../assets/generated/mine-title";
import type { InputState } from "../engine/input";
import { TO8_PALETTE } from "../assets/palette";
import { loadImage } from "../engine/image-loader";
import type { Renderer } from "../engine/renderer";
import type { Scene, SceneContext } from "../engine/scene";
import { RUNTIME_ASSET_URLS, docsExtractionAssetUrl } from "../assets/runtime-assets";
import { createGameplayScene } from "./scene-factory";

interface DecodedFrame {
  readonly path: string;
  readonly x?: number;
  readonly y?: number;
}

function pick<T>(value: ReadonlyArray<T> | undefined, index: number): T | undefined {
  return value?.[index];
}

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
    if (!this.backgroundImage) {
      renderer.clear(TO8_PALETTE.black);
      if (this.backgroundError) {
        renderer.drawPixelText("ERREUR INFOGRAMES", 72, 92, TO8_PALETTE.yellow, 2);
        renderer.drawPixelText(this.backgroundError.slice(0, 40), 40, 112, TO8_PALETTE.white);
      } else {
        renderer.drawPixelText("CHARGEMENT...", 112, 92, TO8_PALETTE.yellow, 1);
      }
      return;
    }
    renderer.clear(TO8_PALETTE.black);
    renderer.drawImage(this.backgroundImage, 0, 0);
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
  private readonly faceFrames: DecodedFrame[];
  private readonly sparkleFrames: DecodedFrame[];
  private readonly feetFrames: DecodedFrame[];
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
    if (!this.baseImage) {
      renderer.clear("#000000");
      return;
    }

    renderer.clear("#000000");
    renderer.drawImage(this.baseImage, 0, 0);

    const currentSparkle = this.sparkleFrames[this.sparkleIndex];
    const sparkleImage = this.sparkleImageCache.get(currentSparkle.path);
    if (sparkleImage) {
      renderer.drawImage(sparkleImage, 0, 0);
    }

    const currentFace = this.faceFrames[this.faceIndex];
    const currentFeet = pick(this.feetFrames, this.feetIndex) ?? this.feetFrames[0];
    const faceImage = this.faceImageCache.get(currentFace.path);
    const feetImage = this.feetImageCache.get(currentFeet.path);
    if (faceImage) {
      renderer.drawImage(faceImage, currentFace.x ?? 192, currentFace.y ?? 24);
    }
    if (feetImage) {
      renderer.drawImage(feetImage, currentFeet.x ?? 144, currentFeet.y ?? 162);
    }

  }

  private queueLoading(
    frames: DecodedFrame[],
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
