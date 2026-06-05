/**
 * Role: Encapsule la grille runtime mutable d'un niveau.
 * Scope: Fournit lectures/ecritures bornees et compatibilite avec les anciens noms d'API.
 * ISO: Les lectures hors grille retournent la tuile de remplissage, comme une bordure logique.
 * Notes: La grille reste la source d'autorite du gameplay discret.
 */

/** Grille mutable de tile ids runtime pour un niveau charge. */
export class LevelRuntimeGrid {
  /** Donnees de grille aplaties, limitees a la largeur utile moderne. */
  private readonly runtimeTiles: number[];

  /** Cree une grille runtime a partir des tiles modernes converties. */
  constructor(
    tiles: readonly number[],
    /** Largeur utile en cellules. */
    private readonly usefulWidth: number,
    /** Hauteur utile en cellules. */
    private readonly usefulHeight: number,
    /** Largeur memoire historique utilisee pour les tests hors borne horizontale. */
    readonly stride: number,
    /** Tuile renvoyee quand une lecture sort de la grille utile. */
    private readonly fillTileId: number
  ) {
    this.runtimeTiles = [...tiles];
  }

  /** Verifie si une coordonnee appartient a la grille utile moderne. */
  isInside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && y < this.usefulHeight && x < this.usefulWidth;
  }

  /** Lit une tuile runtime, avec remplissage de bordure hors grille utile. */
  getTile(x: number, y: number): number {
    if (x < 0 || y < 0 || y >= this.usefulHeight || x >= this.stride) {
      return this.fillTileId;
    }

    if (x >= this.usefulWidth) {
      return this.fillTileId;
    }

    return this.runtimeTiles[y * this.usefulWidth + x] ?? this.fillTileId;
  }

  /** Ecrit une tuile runtime si la coordonnee est dans la grille utile. */
  setTile(x: number, y: number, tileId: number): void {
    if (!this.isInside(x, y)) {
      return;
    }

    this.runtimeTiles[y * this.usefulWidth + x] = tileId;
  }

  /** Remplace une cellule par la tuile vide fournie par l'appelant. */
  clearTile(x: number, y: number, emptyTileId: number): void {
    this.setTile(x, y, emptyTileId);
  }

  /** Indique si une cellule contient la tuile vide fournie. */
  isEmpty(x: number, y: number, emptyTileId: number): boolean {
    return this.getTile(x, y) === emptyTileId;
  }

  /** Alias de compatibilite conserve pendant la migration architecturale. */
  getRuntimeTile(x: number, y: number): number {
    return this.getTile(x, y);
  }

  /** Alias de compatibilite conserve pendant la migration architecturale. */
  setRuntimeTile(x: number, y: number, tileId: number): void {
    this.setTile(x, y, tileId);
  }
}
