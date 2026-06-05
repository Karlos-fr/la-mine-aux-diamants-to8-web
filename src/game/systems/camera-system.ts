/**
 * Role: Gere la camera logique et son interpolation visuelle.
 * Scope: Applique les seuils de viewport et calcule la position rendue sans acceder au canvas.
 * ISO: Les marges de declenchement viennent du comportement TO8 deja reporte dans la scene.
 * Notes: La camera reste discrete cote logique et fluide cote rendu.
 */

/** Etat logique du viewport exprime en coordonnees de grille. */
export interface CameraViewportState {
  /** Colonne logique de debut du viewport. */
  x: number;
  /** Ligne logique de debut du viewport. */
  y: number;
  /** Nombre de colonnes visibles. */
  readonly columns: number;
  /** Nombre de lignes visibles. */
  readonly rows: number;
}

/** Mouvement interpole de camera entre deux positions discretes. */
export interface CameraMoveState {
  /** Colonne de depart. */
  readonly fromX: number;
  /** Ligne de depart. */
  readonly fromY: number;
  /** Colonne cible. */
  readonly toX: number;
  /** Ligne cible. */
  readonly toY: number;
  /** Temps deja ecoule dans l'interpolation. */
  elapsed: number;
  /** Duree totale de l'interpolation. */
  readonly duration: number;
}

/** Configuration stable de la camera pour un niveau donne. */
export interface CameraSystemConfig {
  /** Marge gauche de declenchement camera. */
  readonly leftMargin: number;
  /** Marge droite de declenchement camera. */
  readonly rightMargin: number;
  /** Marge haute de declenchement camera. */
  readonly topMargin: number;
  /** Marge basse de declenchement camera. */
  readonly bottomMargin: number;
  /** Borne minimale horizontale du viewport. */
  readonly minX: number;
  /** Borne minimale verticale du viewport. */
  readonly minY: number;
  /** Largeur du niveau en cellules. */
  readonly levelWidth: number;
  /** Hauteur du niveau en cellules. */
  readonly levelHeight: number;
  /** Duree de l'interpolation visuelle. */
  readonly moveDuration: number;
}

/** Avance la camera apres un pas joueur discret et retourne une interpolation si le viewport change. */
export function advanceCameraAfterPlayerStep(
  viewport: CameraViewportState,
  fromX: number,
  fromY: number,
  moveX: number,
  moveY: number,
  config: CameraSystemConfig
): CameraMoveState | null {
  const screenX = fromX - viewport.x;
  const screenY = fromY - viewport.y;
  const previousViewportX = viewport.x;
  const previousViewportY = viewport.y;
  const cameraMaxX = getCameraMaxX(viewport, config);
  const cameraMaxY = getCameraMaxY(viewport, config);

  if (moveX > 0 && screenX === config.rightMargin && viewport.x < cameraMaxX) {
    viewport.x += 1;
  } else if (moveX < 0 && screenX === config.leftMargin && viewport.x > config.minX) {
    viewport.x -= 1;
  }

  if (moveY > 0 && screenY === config.bottomMargin && viewport.y < cameraMaxY) {
    viewport.y += 1;
  } else if (moveY < 0 && screenY === config.topMargin && viewport.y > config.minY) {
    viewport.y -= 1;
  }

  if (viewport.x === previousViewportX && viewport.y === previousViewportY) {
    return null;
  }

  return {
    fromX: previousViewportX,
    fromY: previousViewportY,
    toX: viewport.x,
    toY: viewport.y,
    elapsed: 0,
    duration: config.moveDuration
  };
}

/** Avance l'interpolation camera en cours et la termine si sa duree est atteinte. */
export function advanceCameraMove(cameraMove: CameraMoveState | null, dt: number): CameraMoveState | null {
  if (!cameraMove) {
    return null;
  }

  cameraMove.elapsed += dt;
  return cameraMove.elapsed >= cameraMove.duration ? null : cameraMove;
}

/** Calcule la coordonnee X de viewport a utiliser pour le rendu. */
export function getRenderViewportX(viewport: CameraViewportState, cameraMove: CameraMoveState | null): number {
  if (!cameraMove) {
    return viewport.x;
  }

  const progress = clamp(cameraMove.elapsed / cameraMove.duration, 0, 1);
  return lerp(cameraMove.fromX, cameraMove.toX, smoothStep(progress));
}

/** Calcule la coordonnee Y de viewport a utiliser pour le rendu. */
export function getRenderViewportY(viewport: CameraViewportState, cameraMove: CameraMoveState | null): number {
  if (!cameraMove) {
    return viewport.y;
  }

  const progress = clamp(cameraMove.elapsed / cameraMove.duration, 0, 1);
  return lerp(cameraMove.fromY, cameraMove.toY, smoothStep(progress));
}

/** Calcule la borne maximale horizontale en fonction de la largeur du niveau. */
function getCameraMaxX(viewport: CameraViewportState, config: CameraSystemConfig): number {
  return Math.max(config.minX, config.levelWidth - viewport.columns);
}

/** Calcule la borne maximale verticale en fonction de la hauteur du niveau. */
function getCameraMaxY(viewport: CameraViewportState, config: CameraSystemConfig): number {
  return Math.max(config.minY, config.levelHeight - viewport.rows);
}

/** Contraint une valeur numerique entre deux bornes. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Interpole lineairement deux valeurs. */
function lerp(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

/** Lisse une interpolation pour eviter un mouvement camera trop mecanique. */
function smoothStep(progress: number): number {
  return progress * progress * (3 - 2 * progress);
}
