/**
 * Role: Centralise les options d'affichage runtime.
 * Scope: Pilote la taille CSS du canvas et la resolution logique gameplay.
 * ISO: Le mode origine conserve la surface TO8 320x200; les autres modes sont des choix modernes d'ergonomie.
 * Notes: Les options sont persistees localement et doivent rester non bloquantes si le stockage echoue.
 */

import type { Size2D } from "./engine/render-types";

/** Facteur de grossissement CSS hors etirage navigateur. */
export type DisplayZoom = 1 | 2 | 3;

/** Densites disponibles pour augmenter le nombre de cellules visibles. */
export type DisplayDensity = 1 | 2 | 3;

/** Configuration d'affichage runtime modifiable depuis la pop-in d'options. */
export interface DisplayOptions {
  /** Facteur de grossissement CSS quand l'etirage navigateur est inactif. */
  zoom: DisplayZoom;

  /** Indique si le canvas est agrandi au maximum dans l'espace navigateur sans deformation. */
  stretchToViewport: boolean;

  /** Multiplie le nombre de cellules visibles, sans changer la forme des tuiles. */
  density: DisplayDensity;
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

/** Retourne l'echelle CSS effective entre resolution logique gameplay et canvas navigateur. */
export function getDisplayCssScale(): number {
  const cssSize = getCanvasCssSize();
  const renderSize = getGameplayRenderSize();
  return Math.max(1, Math.min(cssSize.width / renderSize.width, cssSize.height / renderSize.height));
}

/** Retourne l'echelle logique de l'overlay options pour garder une taille UX stable. */
export function getOptionsPopinRenderScale(): number {
  return getDisplayCssScale() <= 1 ? 2 : 1;
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

/** Calcule la resolution logique de la scene gameplay selon les options d'affichage. */
export function getGameplayRenderSize(): Size2D {
  return getDensityRenderSize(displayOptions.density);
}

/** Applique la taille CSS pixel-perfect du canvas via les variables partagees par la feuille de style. */
export function applyDisplayCanvasLayout(): void {
  const size = getCanvasCssSize();
  const fixedAspectSize = getViewportFixedAspectCanvasCssSize();
  document.body.style.setProperty("--game-canvas-css-width", `${size.width}px`);
  document.body.style.setProperty("--game-canvas-css-height", `${size.height}px`);
  document.body.style.setProperty("--game-canvas-fixed-aspect-css-width", `${fixedAspectSize.width}px`);
  document.body.style.setProperty("--game-canvas-fixed-aspect-css-height", `${fixedAspectSize.height}px`);
}

/** Calcule la taille CSS effective du canvas, distincte de la resolution logique gameplay. */
function getCanvasCssSize(): Size2D {
  const renderSize = getGameplayRenderSize();
  if (displayOptions.stretchToViewport) {
    return getViewportContainedCanvasCssSize(renderSize);
  }

  return {
    width: renderSize.width * displayOptions.zoom,
    height: renderSize.height * displayOptions.zoom
  };
}

/** Calcule la resolution logique du gameplay selon la densite d'affichage. */
function getDensityRenderSize(density: DisplayDensity): Size2D {
  const columns = ORIGINAL_VIEWPORT_COLUMNS * density;
  const rows = ORIGINAL_VIEWPORT_ROWS * density;
  return {
    width: columns * GAMEPLAY_TILE_SIZE,
    height: rows * GAMEPLAY_TILE_SIZE + GAMEPLAY_HUD_HEIGHT
  };
}

/** Calcule la plus grande taille CSS sans deformation pour une resolution logique donnee. */
function getViewportContainedCanvasCssSize(renderSize: Size2D): Size2D {
  const viewportSize = getViewportCssSize();
  const scale = Math.min(viewportSize.width / renderSize.width, viewportSize.height / renderSize.height);
  return {
    width: Math.floor(renderSize.width * scale),
    height: Math.floor(renderSize.height * scale)
  };
}

/** Calcule la plus grande taille viewport possible en conservant le ratio TO8 320x200. */
function getViewportFixedAspectCanvasCssSize(): Size2D {
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
function getViewportCssSize(): Size2D {
  return {
    width: Math.max(MIN_CSS_WIDTH, window.innerWidth),
    height: Math.max(MIN_CSS_HEIGHT, window.innerHeight)
  };
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
        density: legacyValue.mode === "available" && isDisplayDensity(legacyValue.zoom) ? legacyValue.zoom : 1
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
        density: value.density
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

/** Retourne la configuration d'affichage par defaut. */
function getDefaultDisplayOptions(): DisplayOptions {
  return {
    zoom: 2,
    stretchToViewport: false,
    density: 1
  };
}
