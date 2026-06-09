/**
 * Role: Charge les images declarees par le registre de mondes.
 * Scope: Fournit un point unique pour les assets statiques et frames animees custom.
 * ISO: Ne connait pas les assets originaux TO8, seulement les ressources de mondes modernes.
 * Notes: Les renderers consomment les maps par id moderne afin d'eviter les mappings disperses.
 */

import { loadImage } from "../engine/image-loader";
import { getWorldEntityDefinitions, getWorldTileDefinitions } from "./world-registry";

/** Images chargees depuis les definitions de mondes. */
export interface LoadedWorldAssetImages {
  /** Images statiques indexees par id de tuile moderne. */
  readonly tileImages: ReadonlyMap<string, HTMLImageElement>;
  /** Frames animees indexees par id d'entite moderne. */
  readonly entityFrameImages: ReadonlyMap<string, readonly HTMLImageElement[]>;
}

/** Charge toutes les images declarees par le registre de mondes. */
export async function loadWorldAssetImages(): Promise<LoadedWorldAssetImages> {
  const [tileImages, entityFrameImages] = await Promise.all([
    loadWorldTileImages(),
    loadWorldEntityFrameImages()
  ]);

  return {
    tileImages,
    entityFrameImages
  };
}

/** Charge les images statiques declarees par le registre de mondes. */
async function loadWorldTileImages(): Promise<ReadonlyMap<string, HTMLImageElement>> {
  const entries = await Promise.all(
    getWorldTileDefinitions()
      .filter((definition) => definition.assetUrl)
      .map(async (definition) => [definition.id, await loadImage(definition.assetUrl)] as const)
  );
  return new Map(entries);
}

/** Charge les frames animees declarees par le registre de mondes. */
async function loadWorldEntityFrameImages(): Promise<ReadonlyMap<string, readonly HTMLImageElement[]>> {
  const entries = await Promise.all(
    getWorldEntityDefinitions()
      .filter((definition) => definition.frameUrls && definition.frameUrls.length > 0)
      .map(async (definition) => [
        definition.id,
        await Promise.all(definition.frameUrls?.map((url) => loadImage(url)) ?? [])
      ] as const)
  );
  return new Map(entries);
}
