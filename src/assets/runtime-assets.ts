export function docsExtractionAssetUrl(relativePath: string): string {
  return `/docs/extraction/${relativePath}`;
}

export const RUNTIME_ASSET_URLS = {
  tilesAtlas: docsExtractionAssetUrl("mine-tiles-atlas-D218-D8D7.png"),
  diamondAtlas: docsExtractionAssetUrl("sprites/diamond-atlas.png"),
  monsterAtlas: docsExtractionAssetUrl("sprites/monster-atlas.png"),
  hudLeftPanel: docsExtractionAssetUrl("hud/left-wood-sign.png"),
  hudRightPanel: docsExtractionAssetUrl("hud/right-gallery-sign.png"),
  startupInfogramesPresents: docsExtractionAssetUrl("startup/startup-01-infogrames-presents.png"),
  startupTitleBase: docsExtractionAssetUrl("startup/startup-02-title-entet-9367.png")
} as const;

export const VIEWER_ASSET_URLS: Record<string, string> = {
  player: docsExtractionAssetUrl("sprites/player-atlas.png"),
  diamond: RUNTIME_ASSET_URLS.diamondAtlas,
  rocks: docsExtractionAssetUrl("sprites/rocks-atlas.png"),
  explosion: docsExtractionAssetUrl("sprites/explosion-atlas.png"),
  objects: docsExtractionAssetUrl("sprites/objects-atlas.png"),
  monster: RUNTIME_ASSET_URLS.monsterAtlas
};
