/**
 * Role: Recolore l'atlas joueur original selon le profil actif.
 * Scope: Travaille en canvas offscreen et retourne un atlas compatible `TileFrame`.
 * ISO: Les frames, dimensions et indices restent ceux de l'atlas joueur extrait.
 * Notes: La segmentation combine couleurs source et masques simples par partie.
 */

import type { TileFrame } from "../engine/render-types";
import type { PlayerBodyPart, PlayerCustomization } from "./player-customization-model";
import { isOriginalPlayerCustomization } from "./player-customization-model";

/** Taille d'une frame joueur extraite. */
const PLAYER_FRAME_SIZE = 16;
/** Nombre de frames presentes dans l'atlas joueur extrait. */
const PLAYER_FRAME_COUNT = 11;
/** Couleur source de la peau dans l'atlas extrait. */
const SOURCE_SKIN = "e79393";
/** Couleur source du detail cyan du joueur. */
const SOURCE_ACCESSORY = "00ffff";
/** Couleur source du corps rouge. */
const SOURCE_BODY = "ff0000";
/** Couleur source des jambes orange. */
const SOURCE_LEGS = "ef9300";
/** Couleur source des pieds gris. */
const SOURCE_FEET = "cbcbcb";

/** Atlas recolore pret a etre consomme par le cache de frames. */
export interface RecoloredPlayerAtlas {
  /** Canvas source contenant toutes les frames recolorees. */
  readonly image: HTMLCanvasElement;
  /** Signature stable du profil utilise pour construire le canvas. */
  readonly signature: string;
}

/** Cache par image source et signature de personnalisation. */
const recoloredAtlasCache = new WeakMap<CanvasImageSource, Map<string, RecoloredPlayerAtlas>>();

/** Retourne une frame joueur originale ou recoloree selon le profil actif. */
export function getPlayerCustomizationTileFrame(
  atlasImage: HTMLImageElement,
  frameIndex: number,
  customization: PlayerCustomization
): TileFrame {
  if (isOriginalPlayerCustomization(customization)) {
    return createPlayerTileFrame(atlasImage, `player-${frameIndex}`, frameIndex);
  }

  const recoloredAtlas = getRecoloredPlayerAtlas(atlasImage, customization);
  return createPlayerTileFrame(
    recoloredAtlas.image,
    `player-custom-${recoloredAtlas.signature}-${frameIndex}`,
    frameIndex
  );
}

/** Cree ou retourne l'atlas joueur recolore pour un profil donne. */
export function getRecoloredPlayerAtlas(
  atlasImage: CanvasImageSource,
  customization: PlayerCustomization
): RecoloredPlayerAtlas {
  const signature = getPlayerCustomizationSignature(customization);
  let imageCache = recoloredAtlasCache.get(atlasImage);
  if (!imageCache) {
    imageCache = new Map();
    recoloredAtlasCache.set(atlasImage, imageCache);
  }

  const cached = imageCache.get(signature);
  if (cached) {
    return cached;
  }

  const canvas = document.createElement("canvas");
  canvas.width = PLAYER_FRAME_SIZE * PLAYER_FRAME_COUNT;
  canvas.height = PLAYER_FRAME_SIZE;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Impossible de recolorer le joueur: canvas indisponible.");
  }

  context.imageSmoothingEnabled = false;
  context.drawImage(atlasImage, 0, 0);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  recolorPlayerImageData(image, customization);
  context.putImageData(image, 0, 0);

  const recoloredAtlas = { image: canvas, signature };
  imageCache.set(signature, recoloredAtlas);
  return recoloredAtlas;
}

/** Retourne une signature stable des couleurs appliquees. */
export function getPlayerCustomizationSignature(customization: PlayerCustomization): string {
  return [
    customization.colors.hair,
    customization.colors.skin,
    customization.colors.accessory,
    customization.colors.body,
    customization.colors.arms,
    customization.colors.legs,
    customization.colors.feet
  ].join("|");
}

/** Recolore les pixels joueur selon leur partie identifiee. */
function recolorPlayerImageData(image: ImageData, customization: PlayerCustomization): void {
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const offset = (y * image.width + x) * 4;
      if (image.data[offset + 3] === 0) {
        continue;
      }

      const sourceColor = toHexKey(image.data[offset], image.data[offset + 1], image.data[offset + 2]);
      const frameX = x % PLAYER_FRAME_SIZE;
      const frameY = y;
      const part = getPlayerBodyPartForSourcePixel(sourceColor, frameX, frameY);
      if (!part) {
        continue;
      }

      const [red, green, blue] = parseHexColor(customization.colors[part]);
      image.data[offset] = red;
      image.data[offset + 1] = green;
      image.data[offset + 2] = blue;
    }
  }
}

/** Identifie la partie du corps associee a un pixel source. */
function getPlayerBodyPartForSourcePixel(sourceColor: string, frameX: number, frameY: number): PlayerBodyPart | null {
  if (sourceColor === SOURCE_SKIN) {
    return isHairMaskPixel(frameX, frameY) ? "hair" : "skin";
  }
  if (sourceColor === SOURCE_ACCESSORY) {
    return "accessory";
  }
  if (sourceColor === SOURCE_BODY) {
    return isArmMaskPixel(frameX, frameY) ? "arms" : "body";
  }
  if (sourceColor === SOURCE_LEGS) {
    return "legs";
  }
  if (sourceColor === SOURCE_FEET) {
    return "feet";
  }

  return null;
}

/** Masque moderne separant les cheveux du reste de la tete source. */
function isHairMaskPixel(frameX: number, frameY: number): boolean {
  return frameY <= 1 || (frameY === 2 && (frameX <= 5 || frameX >= 10));
}

/** Masque moderne separant les bras du torse rouge original. */
function isArmMaskPixel(frameX: number, frameY: number): boolean {
  return frameY >= 7 && frameY <= 10 && (frameX <= 4 || frameX >= 11);
}

/** Cree une frame joueur depuis un atlas original ou recolore. */
function createPlayerTileFrame(source: CanvasImageSource, id: string, frameIndex: number): TileFrame {
  return {
    id,
    source,
    sourceRect: {
      x: frameIndex * PLAYER_FRAME_SIZE,
      y: 0,
      width: PLAYER_FRAME_SIZE,
      height: PLAYER_FRAME_SIZE
    },
    size: {
      width: PLAYER_FRAME_SIZE,
      height: PLAYER_FRAME_SIZE
    }
  };
}

/** Convertit une couleur RGB en cle hex minuscule sans prefixe. */
function toHexKey(red: number, green: number, blue: number): string {
  return `${toHexByte(red)}${toHexByte(green)}${toHexByte(blue)}`;
}

/** Parse une couleur `#rrggbb` valide en composantes RGB. */
function parseHexColor(color: string): readonly [number, number, number] {
  return [
    Number.parseInt(color.slice(1, 3), 16),
    Number.parseInt(color.slice(3, 5), 16),
    Number.parseInt(color.slice(5, 7), 16)
  ];
}

/** Formate un octet en hexadecimal minuscule. */
function toHexByte(value: number): string {
  return value.toString(16).padStart(2, "0");
}
