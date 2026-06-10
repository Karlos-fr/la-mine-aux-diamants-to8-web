/**
 * Role: Centralise les options d'affichage runtime.
 * Scope: Pilote zoom CSS, etirage navigateur, densite de cellules et resolution logique gameplay.
 * ISO: La densite x1 conserve la grille TO8 20x10 avec HUD; zoom et etirage sont des choix modernes d'ergonomie.
 * Notes: Les options sont persistees localement et doivent rester non bloquantes si le stockage echoue.
 */

import type { CssDisplaySize, LogicalRenderSize, RenderSurfaceSize, Size2D } from "./engine/render-types";

/** Facteur de grossissement CSS hors etirage navigateur. */
export type DisplayZoom = 1 | 2 | 3;

/** Densites disponibles pour augmenter le nombre de cellules visibles. */
export type DisplayDensity = 1 | 2 | 3;

/** Modes de rendu purement visuels; ils ne modifient jamais la simulation ni les timings. */
export type DisplayRenderMode =
  | "to8"
  | "dioramaTo8";

/** Configuration d'affichage runtime modifiable depuis la pop-in d'options. */
export interface DisplayOptions {
  /** Facteur de grossissement CSS quand l'etirage navigateur est inactif. */
  zoom: DisplayZoom;

  /** Indique si le canvas est agrandi au maximum dans l'espace navigateur sans deformation. */
  stretchToViewport: boolean;

  /** Multiplie le nombre de cellules visibles, sans changer la forme des tuiles. */
  density: DisplayDensity;

  /** Style de rendu visuel du niveau, sans effet gameplay, collision, camera logique ou timing. */
  renderMode: DisplayRenderMode;
}

/** Layout complet d'affichage, separe de la simulation gameplay. */
export interface DisplayRenderLayout {
  /** Taille logique consommee par les scenes et le renderer 2D historique. */
  readonly logicalSize: LogicalRenderSize;

  /** Surface bitmap moderne pour le Diorama TO8, separee de la resolution logique ISO. */
  readonly renderSurfaceSize: RenderSurfaceSize;

  /** Taille CSS effectivement appliquee au canvas principal. */
  readonly cssSize: CssDisplaySize;

  /** Taille CSS maximale au ratio TO8 320x200, utilisee par les ecrans historiques. */
  readonly fixedAspectCssSize: CssDisplaySize;
}

/** Largeur logique TO8 originale en pixels. */
const LOGICAL_WIDTH = 320;

/** Hauteur logique TO8 originale en pixels. */
const LOGICAL_HEIGHT = 200;

/** Largeur en cases du viewport original. */
const ORIGINAL_VIEWPORT_COLUMNS = 20;

/** Hauteur en cases du viewport original, hors HUD. */
const ORIGINAL_VIEWPORT_ROWS = 10;

/** Taille logique d'une tuile gameplay. */
const GAMEPLAY_TILE_SIZE = 16;

/** Hauteur logique du HUD gameplay. */
const GAMEPLAY_HUD_HEIGHT = 40;

/** Largeur CSS minimale pour conserver une surface utilisable. */
const MIN_CSS_WIDTH = 320;

/** Hauteur CSS minimale pour conserver une surface utilisable. */
const MIN_CSS_HEIGHT = 200;

/** Cle de persistance locale des preferences d'affichage. */
const STORAGE_KEY = "la-mine-display-options";

/** Etat mutable unique des options d'affichage, charge une fois au demarrage. */
const displayOptions: DisplayOptions = loadDisplayOptions();

/** Expose l'etat courant aux renderers et a l'UX d'options. */
export function getDisplayOptions(): DisplayOptions {
  return displayOptions;
}

/** Retourne le libelle court du mode courant pour la pop-in TO8. */
export function getDisplayModeLabel(): string {
  return displayOptions.stretchToViewport ? "Espace navigation" : "Taille fixe";
}

/** Retourne le libelle court du zoom courant pour la pop-in TO8. */
export function getDisplayZoomLabel(): string {
  return `x${displayOptions.zoom}`;
}

/** Retourne le libelle court de l'etirage navigateur. */
export function getDisplayStretchLabel(): string {
  return displayOptions.stretchToViewport ? "Oui" : "Non";
}

/** Retourne le libelle court de la densite courante. */
export function getDisplayDensityLabel(): string {
  return `x${displayOptions.density}`;
}

/** Retourne le mode de rendu visuel courant. */
export function getDisplayRenderMode(): DisplayRenderMode {
  return displayOptions.renderMode;
}

/** Retourne le libelle court du mode de rendu visuel courant. */
export function getDisplayRenderModeLabel(): string {
  return DISPLAY_RENDER_MODE_LABELS[displayOptions.renderMode];
}

/** Fait defiler les modes de rendu visuel, sans toucher a la resolution logique. */
export function cycleDisplayRenderMode(direction: -1 | 1): void {
  const index = DISPLAY_RENDER_MODES.indexOf(displayOptions.renderMode);
  const safeIndex = index >= 0 ? index : 0;
  displayOptions.renderMode = DISPLAY_RENDER_MODES[(safeIndex + direction + DISPLAY_RENDER_MODES.length) % DISPLAY_RENDER_MODES.length];
  saveDisplayOptions();
}

/** Active ou desactive l'etirage du canvas dans l'espace navigateur. */
export function toggleDisplayStretchToViewport(): void {
  displayOptions.stretchToViewport = !displayOptions.stretchToViewport;
  saveDisplayOptions();
  applyDisplayCanvasLayout();
}

/** Fait defiler les zooms CSS autorises. */
export function cycleDisplayZoom(direction: -1 | 1): void {
  const zooms = [1, 2, 3] as const;
  const index = zooms.indexOf(displayOptions.zoom);
  const safeIndex = index >= 0 ? index : 0;
  displayOptions.zoom = zooms[(safeIndex + direction + zooms.length) % zooms.length];
  saveDisplayOptions();
  applyDisplayCanvasLayout();
}

/** Fait defiler les densites de cellules visibles autorisees. */
export function cycleDisplayDensity(direction: -1 | 1): void {
  const densities = [1, 2, 3] as const;
  const index = densities.indexOf(displayOptions.density);
  const safeIndex = index >= 0 ? index : 0;
  displayOptions.density = densities[(safeIndex + direction + densities.length) % densities.length];
  saveDisplayOptions();
  applyDisplayCanvasLayout();
}

/** Calcule le layout complet d'affichage sans muter le DOM. */
export function getDisplayRenderLayout(): DisplayRenderLayout {
  const logicalSize = getDensityRenderSize(displayOptions.density);
  const cssSize = getCanvasCssSize(logicalSize);
  const layout = {
    logicalSize,
    renderSurfaceSize: getRenderSurfaceSize(cssSize),
    cssSize,
    fixedAspectCssSize: getViewportFixedAspectCanvasCssSize()
  };
  assertDisplayRenderLayout(layout);
  return layout;
}

/** Calcule la resolution logique de la scene gameplay selon les options d'affichage. */
export function getGameplayRenderSize(): LogicalRenderSize {
  return getDisplayRenderLayout().logicalSize;
}

/** Applique la taille CSS pixel-perfect du canvas via les variables partagees par la feuille de style. */
export function applyDisplayCanvasLayout(): void {
  const layout = getDisplayRenderLayout();
  document.body.style.setProperty("--game-canvas-css-width", `${layout.cssSize.width}px`);
  document.body.style.setProperty("--game-canvas-css-height", `${layout.cssSize.height}px`);
  document.body.style.setProperty("--game-canvas-fixed-aspect-css-width", `${layout.fixedAspectCssSize.width}px`);
  document.body.style.setProperty("--game-canvas-fixed-aspect-css-height", `${layout.fixedAspectCssSize.height}px`);
}

/** Calcule la taille CSS effective du canvas, distincte de la resolution logique gameplay. */
function getCanvasCssSize(logicalSize: LogicalRenderSize): CssDisplaySize {
  if (displayOptions.stretchToViewport) {
    return getViewportContainedCanvasCssSize(logicalSize);
  }

  return {
    width: logicalSize.width * displayOptions.zoom,
    height: logicalSize.height * displayOptions.zoom
  };
}

/** Calcule la resolution logique du gameplay selon la densite d'affichage. */
function getDensityRenderSize(density: DisplayDensity): LogicalRenderSize {
  const columns = ORIGINAL_VIEWPORT_COLUMNS * density;
  const rows = ORIGINAL_VIEWPORT_ROWS * density;
  return {
    width: columns * GAMEPLAY_TILE_SIZE,
    height: rows * GAMEPLAY_TILE_SIZE + GAMEPLAY_HUD_HEIGHT
  };
}

/** Calcule la plus grande taille CSS sans deformation pour une resolution logique donnee. */
function getViewportContainedCanvasCssSize(renderSize: Size2D): CssDisplaySize {
  const viewportSize = getViewportCssSize();
  const scale = Math.min(viewportSize.width / renderSize.width, viewportSize.height / renderSize.height);
  return {
    width: Math.floor(renderSize.width * scale),
    height: Math.floor(renderSize.height * scale)
  };
}

/** Calcule la surface moderne disponible pour le Diorama TO8 sans changer la resolution logique. */
function getRenderSurfaceSize(cssSize: CssDisplaySize): RenderSurfaceSize {
  const pixelRatio = getSafeDevicePixelRatio();
  return {
    width: Math.max(1, Math.floor(cssSize.width * pixelRatio)),
    height: Math.max(1, Math.floor(cssSize.height * pixelRatio))
  };
}

/** Calcule la plus grande taille viewport possible en conservant le ratio TO8 320x200. */
function getViewportFixedAspectCanvasCssSize(): CssDisplaySize {
  const viewportSize = getViewportCssSize();
  const widthFromHeight = Math.floor(viewportSize.height * (LOGICAL_WIDTH / LOGICAL_HEIGHT));
  if (widthFromHeight <= viewportSize.width) {
    return {
      width: widthFromHeight,
      height: viewportSize.height
    };
  }

  return {
    width: viewportSize.width,
    height: Math.floor(viewportSize.width * (LOGICAL_HEIGHT / LOGICAL_WIDTH))
  };
}

/** Retourne la taille navigateur minimale que le jeu accepte pour ses calculs CSS. */
function getViewportCssSize(): CssDisplaySize {
  return {
    width: Math.max(MIN_CSS_WIDTH, window.innerWidth),
    height: Math.max(MIN_CSS_HEIGHT, window.innerHeight)
  };
}

/** Retourne un device pixel ratio borne pour eviter les surfaces modernes absurdes. */
function getSafeDevicePixelRatio(): number {
  return Math.max(1, Math.min(3, window.devicePixelRatio || 1));
}

/** Verifie les invariants minimaux du layout avant son utilisation par les renderers. */
function assertDisplayRenderLayout(layout: DisplayRenderLayout): void {
  const sizes = [
    layout.logicalSize,
    layout.renderSurfaceSize,
    layout.cssSize,
    layout.fixedAspectCssSize
  ];
  if (sizes.some((size) => size.width < 1 || size.height < 1)) {
    throw new Error("Layout d'affichage invalide: taille nulle ou negative.");
  }
}

/** Recharge les options persistantes en ignorant les valeurs obsoletes ou corrompues. */
function loadDisplayOptions(): DisplayOptions {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return getDefaultDisplayOptions();
    }
    const value = JSON.parse(raw) as Partial<DisplayOptions>;
    const legacyValue = value as Partial<DisplayOptions> & { readonly mode?: "original" | "available" };
    if (legacyValue.mode === "original" || legacyValue.mode === "available") {
      return {
        zoom: isDisplayZoom(legacyValue.zoom) ? legacyValue.zoom : 2,
        stretchToViewport: legacyValue.mode === "available",
        density: legacyValue.mode === "available" && isDisplayDensity(legacyValue.zoom) ? legacyValue.zoom : 1,
        renderMode: "to8"
      };
    }
    if (
      isDisplayZoom(value.zoom) &&
      typeof value.stretchToViewport === "boolean" &&
      isDisplayDensity(value.density)
    ) {
      return {
        zoom: value.zoom,
        stretchToViewport: value.stretchToViewport,
        density: value.density,
        renderMode: normalizeDisplayRenderMode(value.renderMode)
      };
    }
  } catch {
    // Les options d'affichage doivent rester non bloquantes.
  }
  return getDefaultDisplayOptions();
}

/** Persiste les options d'affichage sans rendre le jeu dependant du stockage navigateur. */
function saveDisplayOptions(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(displayOptions));
  } catch {
    // Le stockage local est optionnel.
  }
}

/** Valide une valeur de zoom issue du stockage local avant reutilisation. */
function isDisplayZoom(value: unknown): value is DisplayZoom {
  return value === 1 || value === 2 || value === 3;
}

/** Valide une densite issue du stockage local avant reutilisation. */
function isDisplayDensity(value: unknown): value is DisplayDensity {
  return value === 1 || value === 2 || value === 3;
}

/** Valide un mode de rendu issu du stockage local avant reutilisation. */
function isDisplayRenderMode(value: unknown): value is DisplayRenderMode {
  return (
    value === "to8" ||
    value === "dioramaTo8"
  );
}

/** Migre les anciennes valeurs de mode de rendu vers les modes encore exposes. */
function normalizeDisplayRenderMode(value: unknown): DisplayRenderMode {
  if (value === "dioramaTo8HighResolution") {
    return "dioramaTo8";
  }

  return isDisplayRenderMode(value) ? value : "to8";
}

/** Retourne la configuration d'affichage par defaut. */
function getDefaultDisplayOptions(): DisplayOptions {
  return {
    zoom: 2,
    stretchToViewport: false,
    density: 1,
    renderMode: "to8"
  };
}

/** Libelles affichables des modes de rendu purement visuels. */
const DISPLAY_RENDER_MODE_LABELS: Record<DisplayRenderMode, string> = {
  to8: "TO8 original",
  dioramaTo8: "Diorama TO8"
};

/** Ordre de cycle des modes de rendu visuel. */
const DISPLAY_RENDER_MODES: readonly DisplayRenderMode[] = [
  "to8",
  "dioramaTo8"
];
