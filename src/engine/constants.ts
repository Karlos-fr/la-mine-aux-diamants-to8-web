/**
 * Constantes globales du moteur moderne.
 *
 * Ce module fixe la resolution logique TO8 et la cadence de simulation
 * commune a toutes les scenes.
 */

/** Largeur logique TO8 en pixels. */
export const LOGICAL_WIDTH = 320;

/** Hauteur logique TO8 en pixels. */
export const LOGICAL_HEIGHT = 200;

/** Cadence fixe de simulation, proche du rythme historique PAL. */
export const FIXED_UPDATE_RATE = 50;

/** Duree d'un pas de simulation fixe en secondes. */
export const FIXED_DT_SECONDS = 1 / FIXED_UPDATE_RATE;

/** Duree maximale acceptee pour une frame afin d'eviter les spirales de retard. */
export const MAX_FRAME_DT_SECONDS = 0.25;
