export type RuntimeTileArrivalEffect = "none" | "dig" | "collectDiamond" | "clearTrail" | "enterExit";

export interface PlayerMoveResolution {
  readonly canEnter: boolean;
  readonly tileId: number;
  readonly arrivalEffect: RuntimeTileArrivalEffect;
}

export interface PlayerCollisionTiles {
  readonly empty: number;
  readonly diggable: number;
  readonly diamond: number;
  readonly monsterTrail: number;
  readonly fallingRock: number;
  readonly fallingDiamond: number;
  readonly rock: number;
  readonly border: number;
  readonly platform: number;
}

export interface PlayerPressedDirections {
  readonly left: boolean;
  readonly right: boolean;
  readonly up: boolean;
  readonly down: boolean;
}

export function resolvePressedPlayerMove(
  pressed: PlayerPressedDirections
): { readonly x: number; readonly y: number } {
  const moveX = pressed.left ? -1 : pressed.right ? 1 : 0;
  const moveY = moveX === 0 ? pressed.up ? -1 : pressed.down ? 1 : 0 : 0;
  return { x: moveX, y: moveY };
}

export function canPlayerEnterTile(tileId: number, tiles: PlayerCollisionTiles): boolean {
  if (tileId === tiles.empty || tileId === tiles.diggable || tileId === tiles.diamond) {
    return true;
  }

  if (tileId === tiles.monsterTrail) {
    return true;
  }

  if (tileId === tiles.fallingRock || tileId === tiles.fallingDiamond) {
    return false;
  }

  if (tileId === tiles.rock || tileId === tiles.border || tileId === tiles.platform) {
    return false;
  }

  return false;
}

export function getPlayerArrivalEffect(tileId: number, tiles: PlayerCollisionTiles): RuntimeTileArrivalEffect {
  if (tileId === tiles.diggable) {
    return "dig";
  }

  if (tileId === tiles.diamond) {
    return "collectDiamond";
  }

  if (tileId === tiles.monsterTrail) {
    return "clearTrail";
  }

  return "none";
}
