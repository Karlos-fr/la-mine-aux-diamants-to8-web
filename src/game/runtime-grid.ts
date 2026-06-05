export class LevelRuntimeGrid {
  private readonly runtimeTiles: number[];

  constructor(
    tiles: readonly number[],
    private readonly usefulWidth: number,
    private readonly usefulHeight: number,
    readonly stride: number,
    private readonly fillTileId: number
  ) {
    this.runtimeTiles = [...tiles];
  }

  isInside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && y < this.usefulHeight && x < this.usefulWidth;
  }

  getTile(x: number, y: number): number {
    if (x < 0 || y < 0 || y >= this.usefulHeight || x >= this.stride) {
      return this.fillTileId;
    }

    if (x >= this.usefulWidth) {
      return this.fillTileId;
    }

    return this.runtimeTiles[y * this.usefulWidth + x] ?? this.fillTileId;
  }

  setTile(x: number, y: number, tileId: number): void {
    if (!this.isInside(x, y)) {
      return;
    }

    this.runtimeTiles[y * this.usefulWidth + x] = tileId;
  }

  clearTile(x: number, y: number, emptyTileId: number): void {
    this.setTile(x, y, emptyTileId);
  }

  isEmpty(x: number, y: number, emptyTileId: number): boolean {
    return this.getTile(x, y) === emptyTileId;
  }

  getRuntimeTile(x: number, y: number): number {
    return this.getTile(x, y);
  }

  setRuntimeTile(x: number, y: number, tileId: number): void {
    this.setTile(x, y, tileId);
  }
}
