/**
 * Registre central des assets runtime.
 *
 * Les scenes passent par ce module pour eviter de disperser les chemins vers
 * `docs/extraction` dans le code applicatif.
 */

/** Construit une URL publique vers un asset conserve dans `docs/extraction`. */
export function docsExtractionAssetUrl(relativePath: string): string {
  return `/docs/extraction/${relativePath}`;
}

/** Assets utilises par le runtime principal du jeu. */
export const RUNTIME_ASSET_URLS = {
  tilesAtlas: docsExtractionAssetUrl("mine-tiles-atlas-D218-D8D7.png"),
  playerAtlas: docsExtractionAssetUrl("sprites/player-atlas.png"),
  diamondAtlas: docsExtractionAssetUrl("sprites/diamond-atlas.png"),
  monsterAtlas: docsExtractionAssetUrl("sprites/monster-atlas.png"),
  specialCreatureAtlas: docsExtractionAssetUrl("sprites/specialCreature-atlas.png"),
  hudLeftPanel: docsExtractionAssetUrl("hud/left-wood-sign.png"),
  hudRightPanel: docsExtractionAssetUrl("hud/right-gallery-sign.png"),
  startupInfogramesPresents: docsExtractionAssetUrl("startup/startup-01-infogrames-presents.png"),
  startupTitleBase: docsExtractionAssetUrl("startup/startup-02-title-entet-9367.png")
} as const;

/** Assets supplementaires exposes par le viewer developpeur d'animations. */
export const VIEWER_ASSET_URLS: Record<string, string> = {
  player: RUNTIME_ASSET_URLS.playerAtlas,
  diamond: RUNTIME_ASSET_URLS.diamondAtlas,
  rocks: docsExtractionAssetUrl("sprites/rocks-atlas.png"),
  explosion: docsExtractionAssetUrl("sprites/explosion-atlas.png"),
  objects: docsExtractionAssetUrl("sprites/objects-atlas.png"),
  monster: RUNTIME_ASSET_URLS.monsterAtlas,
  specialCreature: RUNTIME_ASSET_URLS.specialCreatureAtlas
};
