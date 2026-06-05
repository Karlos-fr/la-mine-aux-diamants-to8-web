export const RUNTIME_GRID_BASE_ADDRESS = 0xdbb7;
export const RUNTIME_GRID_STRIDE = 40;

export const RUNTIME_TILE = {
  rock: 0x00,
  earth: 0x01,
  monster: 0x02,
  diamond: 0x03,
  border: 0x04,
  empty: 0x05,
  platform: 0x06,
  fallingRock: 0x12,
  fallingDiamond: 0x13,
  monsterActive: 0x17,
  monsterTrail: 0x80
} as const;

export type RuntimeTileId = (typeof RUNTIME_TILE)[keyof typeof RUNTIME_TILE];

export const RUNTIME_GRID_FILL_TILE_ID = RUNTIME_TILE.border;

export function isMonsterWalkableRuntimeTile(tileId: number): boolean {
  return tileId === RUNTIME_TILE.empty || tileId === RUNTIME_TILE.monsterTrail;
}
