/**
 * Role: Regroupe les decisions discretes liees au joueur.
 * Scope: Convertit les inputs en intention de mouvement et resout collision/effet d'arrivee.
 * ISO: Le joueur reste deplace case par case, meme quand le rendu interpole le mouvement.
 * Notes: Les mutations concretes restent appliquees par l'orchestrateur runtime.
 */

/** Effet logique applique quand le joueur atteint sa cellule cible. */
export type RuntimeTileArrivalEffect = "none" | "dig" | "collectDiamond" | "clearTrail" | "enterExit" | "hitMonster";

/** Resultat d'une tentative d'entree du joueur dans une cellule. */
export interface PlayerMoveResolution {
  /** Indique si le joueur peut commencer le pas. */
  readonly canEnter: boolean;
  /** Tile id observe dans la cellule cible. */
  readonly tileId: number;
  /** Effet a appliquer a l'arrivee complete. */
  readonly arrivalEffect: RuntimeTileArrivalEffect;
}

/** Tile ids utiles a la collision joueur, injectes pour eviter les dependances globales. */
export interface PlayerCollisionTiles {
  /** Tuile vide. */
  readonly empty: number;
  /** Tuile creusable. */
  readonly diggable: number;
  /** Tuile diamant collectible. */
  readonly diamond: number;
  /** Trace runtime de monstre, nettoyable/traversable. */
  readonly monsterTrail: number;
  /** Rocher en mouvement, bloque le joueur. */
  readonly fallingRock: number;
  /** Diamant en mouvement, bloque le joueur. */
  readonly fallingDiamond: number;
  /** Rocher statique. */
  readonly rock: number;
  /** Bordure/bloc protege. */
  readonly border: number;
  /** Plateforme solide. */
  readonly platform: number;
}

/** Etat des directions pressees par l'input. */
export interface PlayerPressedDirections {
  /** Demande gauche. */
  readonly left: boolean;
  /** Demande droite. */
  readonly right: boolean;
  /** Demande haut. */
  readonly up: boolean;
  /** Demande bas. */
  readonly down: boolean;
}

/** Convertit les touches pressees en delta de grille, avec priorite horizontale. */
export function resolvePressedPlayerMove(
  pressed: PlayerPressedDirections
): { readonly x: number; readonly y: number } {
  const moveX = pressed.left ? -1 : pressed.right ? 1 : 0;
  const moveY = moveX === 0 ? pressed.up ? -1 : pressed.down ? 1 : 0 : 0;
  return { x: moveX, y: moveY };
}

/** Indique si le joueur peut entrer dans une tuile runtime. */
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

/** Determine l'effet a appliquer lorsque le joueur arrive dans une cellule. */
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
