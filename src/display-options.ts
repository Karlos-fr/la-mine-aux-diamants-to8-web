/**
 * Role: Centralise les options d'affichage runtime.
 * Scope: Pilote la taille CSS du canvas et la resolution logique gameplay.
 * ISO: Le mode origine conserve la surface TO8 320x200; les autres modes sont des choix modernes d'ergonomie.
 * Notes: Les options sont persistees localement et doivent rester non bloquantes si le stockage echoue.
 */

import type { Size2D } from "./engine/render-types";

/** Mode principal d'affichage entre surface TO8 stricte et espace navigateur moderne. */
export type DisplayMode = "original" | "available";

/** Zooms disponibles quand la resolution logique reste celle du TO8. */
export type OriginalDisplayZoom = 1 | 2 | 3 | "fitHeight";

/** Zooms disponibles quand le canvas occupe l'espace navigateur disponible. */
export type AvailableDisplayZoom = 1 | 2 | 3;

/** Valeur de zoom persistable commune aux deux modes d'affichage. */
export type DisplayZoom = OriginalDisplayZoom | AvailableDisplayZoom;

/** Configuration d'affichage runtime modifiable depuis la pop-in d'options. */
export interface DisplayOptions {
  /** Strategie de dimensionnement du canvas et de la resolution logique gameplay. */
  mode: DisplayMode;

  /** Facteur de grossissement pixel-perfect, ou adaptation verticale en mode origine. */
  zoom: DisplayZoom;
}

/** Largeur logique TO8 originale en pixels. */
const LOGICAL_WIDTH = 320;

/** Hauteur logique TO8 originale en pixels. */
const LOGICAL_HEIGHT = 200;

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
  return displayOptions.mode === "original" ? "Origine TO8" : "Espace nav";
}

/** Retourne le libelle court du zoom courant pour la pop-in TO8. */
export function getDisplayZoomLabel(): string {
  return displayOptions.zoom === "fitHeight" ? "Hauteur" : `x${displayOptions.zoom}`;
}

/** Bascule entre rendu TO8 strict et rendu plein espace navigateur. */
export function toggleDisplayMode(): void {
  displayOptions.mode = displayOptions.mode === "original" ? "available" : "original";
  if (displayOptions.mode === "available" && displayOptions.zoom === "fitHeight") {
    displayOptions.zoom = 1;
  }
  saveDisplayOptions();
  applyDisplayCanvasLayout();
}

/** Fait defiler les zooms autorises pour le mode actif. */
export function cycleDisplayZoom(direction: -1 | 1): void {
  const zooms = displayOptions.mode === "original"
    ? [1, 2, 3, "fitHeight"] as const
    : [1, 2, 3] as const;
  const index = (zooms as readonly DisplayZoom[]).indexOf(displayOptions.zoom);
  const safeIndex = index >= 0 ? index : 0;
  displayOptions.zoom = zooms[(safeIndex + direction + zooms.length) % zooms.length];
  saveDisplayOptions();
  applyDisplayCanvasLayout();
}

/** Calcule la resolution logique de la scene gameplay selon les options d'affichage. */
export function getGameplayRenderSize(): Size2D {
  if (displayOptions.mode === "original") {
    return { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT };
  }

  const cssSize = getCanvasCssSize();
  const zoom = typeof displayOptions.zoom === "number" ? displayOptions.zoom : 1;
  return {
    width: Math.max(LOGICAL_WIDTH, Math.floor(cssSize.width / zoom)),
    height: Math.max(LOGICAL_HEIGHT, Math.floor(cssSize.height / zoom))
  };
}

/** Applique la taille CSS pixel-perfect du canvas via les variables partagees par la feuille de style. */
export function applyDisplayCanvasLayout(): void {
  const size = getCanvasCssSize();
  document.body.style.setProperty("--game-canvas-css-width", `${size.width}px`);
  document.body.style.setProperty("--game-canvas-css-height", `${size.height}px`);
}

/** Calcule la taille CSS effective du canvas, distincte de la resolution logique gameplay. */
function getCanvasCssSize(): Size2D {
  if (displayOptions.mode === "available") {
    return {
      width: Math.max(MIN_CSS_WIDTH, window.innerWidth),
      height: Math.max(MIN_CSS_HEIGHT, window.innerHeight)
    };
  }

  if (displayOptions.zoom === "fitHeight") {
    const height = Math.max(MIN_CSS_HEIGHT, window.innerHeight);
    return {
      width: Math.max(MIN_CSS_WIDTH, Math.floor(height * (LOGICAL_WIDTH / LOGICAL_HEIGHT))),
      height
    };
  }

  return {
    width: LOGICAL_WIDTH * displayOptions.zoom,
    height: LOGICAL_HEIGHT * displayOptions.zoom
  };
}

/** Recharge les options persistantes en ignorant les valeurs obsoletes ou corrompues. */
function loadDisplayOptions(): DisplayOptions {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { mode: "original", zoom: 2 };
    }
    const value = JSON.parse(raw) as Partial<DisplayOptions>;
    if ((value.mode === "original" || value.mode === "available") && isDisplayZoom(value.zoom)) {
      return { mode: value.mode, zoom: value.mode === "available" && value.zoom === "fitHeight" ? 1 : value.zoom };
    }
  } catch {
    // Les options d'affichage doivent rester non bloquantes.
  }
  return { mode: "original", zoom: 2 };
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
  return value === 1 || value === 2 || value === 3 || value === "fitHeight";
}
