/**
 * Role: Fournit une facade nommee pour les durees de deplacement gameplay.
 * Scope: Expose les cadences sources centralisees dans runtime-timing.ts sans lire les options utilisateur.
 * ISO: Ces durees portent le cadencement de reference; la fluidification ne doit jamais les modifier.
 * Notes: L'option de mouvements fluides doit agir uniquement sur la position rendue entre deux cases.
 */

import { secondsFromTo8Ticks, TO8_RUNTIME_TIMING } from "./runtime-timing";

/** Duree source du pas joueur, derivee des ticks runtime centralises. */
const PLAYER_MOVE_DURATION = secondsFromTo8Ticks(TO8_RUNTIME_TIMING.playerGridMoveTicks);

/** Duree source du scroll camera, alignee sur le pas joueur moderne. */
const CAMERA_MOVE_DURATION = PLAYER_MOVE_DURATION;

/** Duree source du pas monstre, derivee des ticks runtime centralises. */
const MONSTER_MOVE_DURATION = secondsFromTo8Ticks(TO8_RUNTIME_TIMING.monsterGridMoveTicks);

/** Duree source d'une chute ou glissade de rocher/diamant. */
const FALLING_OBJECT_MOVE_DURATION = secondsFromTo8Ticks(TO8_RUNTIME_TIMING.fallingObjectGridMoveTicks);

/** Duree source d'un rocher pousse, synchronisee avec le pas joueur. */
const PUSHED_ROCK_MOVE_DURATION = PLAYER_MOVE_DURATION;

/** Retourne la duree de reference d'un pas joueur. */
export function getPlayerMoveDuration(): number {
  return PLAYER_MOVE_DURATION;
}

/** Retourne la duree de reference d'un scroll camera. */
export function getCameraMoveDuration(): number {
  return CAMERA_MOVE_DURATION;
}

/** Retourne la duree de reference d'un pas monstre. */
export function getMonsterMoveDuration(): number {
  return MONSTER_MOVE_DURATION;
}

/** Retourne la duree de reference d'une chute ou glissade physique. */
export function getFallingObjectMoveDuration(): number {
  return FALLING_OBJECT_MOVE_DURATION;
}

/** Retourne la duree de reference d'un rocher pousse par le joueur. */
export function getPushedRockMoveDuration(): number {
  return PUSHED_ROCK_MOVE_DURATION;
}
