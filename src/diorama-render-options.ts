/**
 * Role: Centralise les reglages experimentaux du rendu Diorama.
 * Scope: Expose des options visuelles sans impact gameplay ni timing moteur.
 * ISO: Les valeurs modifient uniquement le rendu WebGL offscreen du mode Diorama.
 * Notes: Module volontairement petit pour permettre des essais rapides depuis le panneau lateral.
 */

/** Reglages visuels ajustables du mode Diorama. */
export interface DioramaRenderOptions {
  /** Facteur de resolution interne de la scene avant recopie dans le canvas 2D. */
  supersampling: number;
  /** Active le lissage lors de la reduction du rendu haute resolution. */
  downscaleSmoothing: boolean;
  /** Agrandit les textures TO8 avant leur upload WebGL pour stabiliser le plaquage 3D. */
  textureUpscale: number;
  /** Intensite de la lumiere ambiante Three.js. */
  ambientLight: number;
  /** Intensite de la lumiere directionnelle Three.js. */
  directionalLight: number;
  /** Opacite de l'ombre plate sous les sprites poses au sol. */
  groundShadowOpacity: number;
  /** Taille des sprites billboards poses sur la scene. */
  billboardScale: number;
}

/** Cle de stockage locale des reglages Diorama. */
const STORAGE_KEY = "la-mine-diorama-render-options";

/** Bornes de reglage pour garder un rendu exploitable et peu couteux. */
export const DIORAMA_RENDER_LIMITS = {
  textureUpscale: { min: 1, max: 8, step: 1 },
  ambientLight: { min: 0, max: 1.4, step: 0.05 },
  directionalLight: { min: 0, max: 1.4, step: 0.05 },
  groundShadowOpacity: { min: 0, max: 0.9, step: 0.05 },
  billboardScale: { min: 0.6, max: 1.3, step: 0.05 }
} as const;

/** Paliers stables de resolution interne pour eviter les artefacts pair/impair au downscale. */
export const DIORAMA_SCENE_RESOLUTION_STEPS = [1, 2, 4, 8] as const;

/** Etat mutable unique des reglages Diorama. */
const dioramaRenderOptions: DioramaRenderOptions = loadDioramaRenderOptions();

/** Retourne les reglages Diorama courants. */
export function getDioramaRenderOptions(): DioramaRenderOptions {
  return dioramaRenderOptions;
}

/** Remplace partiellement les reglages Diorama et les persiste. */
export function updateDioramaRenderOptions(patch: Partial<DioramaRenderOptions>): void {
  Object.assign(dioramaRenderOptions, sanitizeDioramaRenderOptions({
    ...dioramaRenderOptions,
    ...patch
  }));
  saveDioramaRenderOptions();
}

/** Retablit les valeurs par defaut du rendu Diorama. */
export function resetDioramaRenderOptions(): void {
  Object.assign(dioramaRenderOptions, getDefaultDioramaRenderOptions());
  saveDioramaRenderOptions();
}

/** Charge les reglages sauvegardes si disponibles. */
function loadDioramaRenderOptions(): DioramaRenderOptions {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return sanitizeDioramaRenderOptions(JSON.parse(raw));
    }
  } catch {
    // Les reglages Diorama restent optionnels en cas de stockage indisponible.
  }
  return getDefaultDioramaRenderOptions();
}

/** Persiste les reglages Diorama sans rendre le jeu dependant du stockage. */
function saveDioramaRenderOptions(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(dioramaRenderOptions));
  } catch {
    // Le stockage local est optionnel.
  }
}

/** Nettoie les valeurs externes avant reutilisation. */
function sanitizeDioramaRenderOptions(value: unknown): DioramaRenderOptions {
  const candidate = typeof value === "object" && value !== null
    ? value as Partial<DioramaRenderOptions>
    : {};
  return {
    supersampling: normalizeSceneResolution(candidate.supersampling),
    downscaleSmoothing: candidate.downscaleSmoothing !== false,
    textureUpscale: clampNumber(candidate.textureUpscale, 1, 8, 4),
    ambientLight: clampNumber(candidate.ambientLight, 0, 1.4, 0.72),
    directionalLight: clampNumber(candidate.directionalLight, 0, 1.4, 0.48),
    groundShadowOpacity: clampNumber(candidate.groundShadowOpacity, 0, 0.9, 0.45),
    billboardScale: clampNumber(candidate.billboardScale, 0.6, 1.3, 0.92)
  };
}

/** Retourne les reglages de depart du Diorama. */
function getDefaultDioramaRenderOptions(): DioramaRenderOptions {
  return {
    supersampling: 2,
    downscaleSmoothing: true,
    textureUpscale: 4,
    ambientLight: 0.72,
    directionalLight: 0.48,
    groundShadowOpacity: 0.45,
    billboardScale: 0.92
  };
}

/** Contraint une valeur numerique dans une plage connue. */
function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
}

/** Ramene la resolution scene sur un palier stable. */
function normalizeSceneResolution(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 2;
  }

  return DIORAMA_SCENE_RESOLUTION_STEPS.reduce((nearest, step) => {
    return Math.abs(step - value) < Math.abs(nearest - value) ? step : nearest;
  }, DIORAMA_SCENE_RESOLUTION_STEPS[0]);
}
