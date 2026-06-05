export interface CameraViewportState {
  x: number;
  y: number;
  readonly columns: number;
  readonly rows: number;
}

export interface CameraMoveState {
  readonly fromX: number;
  readonly fromY: number;
  readonly toX: number;
  readonly toY: number;
  elapsed: number;
  readonly duration: number;
}

export interface CameraSystemConfig {
  readonly leftMargin: number;
  readonly rightMargin: number;
  readonly topMargin: number;
  readonly bottomMargin: number;
  readonly minX: number;
  readonly minY: number;
  readonly levelWidth: number;
  readonly levelHeight: number;
  readonly moveDuration: number;
}

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

export function advanceCameraMove(cameraMove: CameraMoveState | null, dt: number): CameraMoveState | null {
  if (!cameraMove) {
    return null;
  }

  cameraMove.elapsed += dt;
  return cameraMove.elapsed >= cameraMove.duration ? null : cameraMove;
}

export function getRenderViewportX(viewport: CameraViewportState, cameraMove: CameraMoveState | null): number {
  if (!cameraMove) {
    return viewport.x;
  }

  const progress = clamp(cameraMove.elapsed / cameraMove.duration, 0, 1);
  return lerp(cameraMove.fromX, cameraMove.toX, smoothStep(progress));
}

export function getRenderViewportY(viewport: CameraViewportState, cameraMove: CameraMoveState | null): number {
  if (!cameraMove) {
    return viewport.y;
  }

  const progress = clamp(cameraMove.elapsed / cameraMove.duration, 0, 1);
  return lerp(cameraMove.fromY, cameraMove.toY, smoothStep(progress));
}

function getCameraMaxX(viewport: CameraViewportState, config: CameraSystemConfig): number {
  return Math.max(config.minX, config.levelWidth - viewport.columns);
}

function getCameraMaxY(viewport: CameraViewportState, config: CameraSystemConfig): number {
  return Math.max(config.minY, config.levelHeight - viewport.rows);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lerp(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

function smoothStep(progress: number): number {
  return progress * progress * (3 - 2 * progress);
}
