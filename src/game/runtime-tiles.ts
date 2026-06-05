/**
 * Role: Centralise les identifiants runtime de grille issus du jeu TO8.
 * Scope: Fournit les tile ids et constantes memoire utilises par les systems modernes.
 * ISO: Les valeurs correspondent aux identifiants observes dans les routines ASM/provenance.
 * Notes: Les JSON modernes ne doivent pas exposer directement les adresses ASM.
 */

/** Adresse de base de la grille runtime TO8 reconstruite pour les pointeurs monstres. */
export const RUNTIME_GRID_BASE_ADDRESS = 0xdbb7;
/** Largeur memoire historique de la grille TO8, incluant les zones non visibles. */
export const RUNTIME_GRID_STRIDE = 40;

/** Identifiants de tuiles runtime prouves ou stabilises par extraction/provenance. */
export const RUNTIME_TILE = {
  /** Rocher statique, objet physique. */
  rock: 0x00,
  /** Terre/herbe creusable. */
  earth: 0x01,
  /** Monstre initial dans la grille. */
  monster: 0x02,
  /** Diamant statique et collectible. */
  diamond: 0x03,
  /** Bordure ou bloc protege/sortie selon le contexte original. */
  border: 0x04,
  /** Vide logique. */
  empty: 0x05,
  /** Plateforme/bloc solide vert. */
  platform: 0x06,
  /** Etat temporaire de rocher en mouvement. */
  fallingRock: 0x12,
  /** Etat temporaire de diamant en mouvement. */
  fallingDiamond: 0x13,
  /** Premiere frame d'explosion. */
  explosion1: 0x14,
  /** Deuxieme frame d'explosion. */
  explosion2: 0x15,
  /** Troisieme frame d'explosion. */
  explosion3: 0x16,
  /** Marqueur runtime de monstre actif. */
  monsterActive: 0x17,
  /**
   * Creature speciale placee dans certains niveaux.
   *
   * Preuves ASM: `DA10` route `0x17` vers `BC07`, puis les routines `BB24`/`CC4F`
   * la suivent via la table dediee `$DB4F`, distincte des monstres `0x02`.
   */
  specialCreature: 0x17,
  /**
   * Bloc transformateur fixe.
   *
   * Preuve ASM: la physique des rochers/diamants autour de `CB3B` teste explicitement
   * `CMPA #$18` sous l'objet en chute.
   */
  transformerBlock: 0x18,
  /**
   * Tuile graphique extraite mais non placee dans les niveaux decodes.
   *
   * `0x19` reste exclue du gameplay direct tant que son role exact n'est pas confirme.
   */
  specialCreatureGraphicCandidate: 0x19,
  /** Trace runtime de monstre, rendue et traitee comme vide dans certains systems. */
  monsterTrail: 0x80
} as const;

/** Union numerique des tile ids runtime connus. */
export type RuntimeTileId = (typeof RUNTIME_TILE)[keyof typeof RUNTIME_TILE];

/** Tile utilisee pour remplir les lectures hors grille utile. */
export const RUNTIME_GRID_FILL_TILE_ID = RUNTIME_TILE.border;

/** Indique si une tuile est traversable par la routine moderne des monstres. */
export function isMonsterWalkableRuntimeTile(tileId: number): boolean {
  return tileId === RUNTIME_TILE.empty || tileId === RUNTIME_TILE.monsterTrail;
}
