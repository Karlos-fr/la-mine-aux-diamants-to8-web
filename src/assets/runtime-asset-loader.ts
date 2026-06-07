/**
 * Role: Charge et expose les images runtime du gameplay.
 * Scope: Regroupe atlas tuiles, atlas sprites animes et panneaux HUD dans un objet explicite.
 * ISO: Les URLs restent definies dans `runtime-assets.ts`; ce module ne deplace aucun asset.
 * Notes: Les erreurs sont conservees sous forme lisible pour l'affichage/debug scene.
 */

import { loadImage } from "../engine/image-loader";
import { RUNTIME_ASSET_URLS } from "./runtime-assets";

/** Images runtime chargees pour la scene gameplay. */
export interface LoadedRuntimeAssets {
  /** Atlas principal des tuiles niveau. */
  readonly tileAtlas: HTMLImageElement;

  /** Atlas anime du joueur. */
  readonly playerAtlas: HTMLImageElement;

  /** Atlas anime des diamants. */
  readonly diamondAtlas: HTMLImageElement;

  /** Atlas anime des monstres. */
  readonly monsterAtlas: HTMLImageElement;

  /** Atlas anime de la creature speciale. */
  readonly specialCreatureAtlas: HTMLImageElement;

  /** Panneau HUD gauche. */
  readonly leftHudPanel: HTMLImageElement;

  /** Panneau HUD droit. */
  readonly rightHudPanel: HTMLImageElement;
}

/** Chargeur/facade des assets runtime gameplay. */
export class RuntimeAssets {
  /** Images chargees, ou `null` tant que le chargement n'est pas termine. */
  private loadedAssets: LoadedRuntimeAssets | null = null;

  /** Derniere erreur lisible produite par le chargement. */
  private loadError: string | null = null;

  /** Promesse de chargement partagee pour eviter les doubles chargements. */
  private loadingPromise: Promise<void> | null = null;

  /** Atlas principal des tuiles, si charge. */
  get tileAtlas(): HTMLImageElement | null {
    return this.loadedAssets?.tileAtlas ?? null;
  }

  /** Atlas anime du joueur, si charge. */
  get playerAtlas(): HTMLImageElement | null {
    return this.loadedAssets?.playerAtlas ?? null;
  }

  /** Atlas anime des diamants, si charge. */
  get diamondAtlas(): HTMLImageElement | null {
    return this.loadedAssets?.diamondAtlas ?? null;
  }

  /** Atlas anime des monstres, si charge. */
  get monsterAtlas(): HTMLImageElement | null {
    return this.loadedAssets?.monsterAtlas ?? null;
  }

  /** Atlas anime de la creature speciale, si charge. */
  get specialCreatureAtlas(): HTMLImageElement | null {
    return this.loadedAssets?.specialCreatureAtlas ?? null;
  }

  /** Panneau HUD gauche, si charge. */
  get leftHudPanel(): HTMLImageElement | null {
    return this.loadedAssets?.leftHudPanel ?? null;
  }

  /** Panneau HUD droit, si charge. */
  get rightHudPanel(): HTMLImageElement | null {
    return this.loadedAssets?.rightHudPanel ?? null;
  }

  /** Erreur lisible du dernier chargement, si presente. */
  get error(): string | null {
    return this.loadError;
  }

  /** Indique si l'atlas principal est disponible pour le rendu niveau. */
  get tileAtlasLoaded(): boolean {
    return this.tileAtlas !== null;
  }

  /** Lance le chargement des images runtime et memorise le resultat. */
  load(): Promise<void> {
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    this.loadingPromise = this.loadAll();
    return this.loadingPromise;
  }

  /** Retourne l'atlas de tuiles charge ou leve une erreur utilisateur. */
  requireTileAtlas(): HTMLImageElement {
    if (!this.tileAtlas) {
      throw new Error(this.loadError ?? "Atlas de tuiles non charge.");
    }

    return this.tileAtlas;
  }

  /** Charge tous les assets runtime declares dans le catalogue d'URLs. */
  private async loadAll(): Promise<void> {
    try {
      const [tileAtlas, playerAtlas, diamondAtlas, monsterAtlas, specialCreatureAtlas, leftHudPanel, rightHudPanel] = await Promise.all([
        loadImage(RUNTIME_ASSET_URLS.tilesAtlas),
        loadImage(RUNTIME_ASSET_URLS.playerAtlas),
        loadImage(RUNTIME_ASSET_URLS.diamondAtlas),
        loadImage(RUNTIME_ASSET_URLS.monsterAtlas),
        loadImage(RUNTIME_ASSET_URLS.specialCreatureAtlas),
        loadImage(RUNTIME_ASSET_URLS.hudLeftPanel),
        loadImage(RUNTIME_ASSET_URLS.hudRightPanel)
      ]);
      this.loadedAssets = {
        tileAtlas,
        playerAtlas,
        diamondAtlas,
        monsterAtlas,
        specialCreatureAtlas,
        leftHudPanel,
        rightHudPanel
      };
      this.loadError = null;
    } catch (error) {
      this.loadError = error instanceof Error ? error.message : String(error);
    }
  }
}
