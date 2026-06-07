/**
 * Role: Centralise les cadences runtime exprimees en ticks TO8.
 * Scope: Fournit les durees gameplay derivees de l'horloge logique 50 Hz.
 * ISO: Le TO8 cible PAL est cadence autour de 50 Hz, soit un tick logique de 20 ms.
 * Notes: Les constantes non encore prouvees par ASM restent marquees comme hypotheses modernes.
 */

import { FIXED_UPDATE_RATE } from "../engine/constants";

/** Nombre de ticks logiques TO8 par seconde dans le portage moderne. */
export const TO8_RUNTIME_TICKS_PER_SECOND = FIXED_UPDATE_RATE;

/** Convertit un nombre entier de ticks TO8 en secondes pour les interpolations modernes. */
export function secondsFromTo8Ticks(ticks: number): number {
  return ticks / TO8_RUNTIME_TICKS_PER_SECOND;
}

/** Cadences gameplay exprimees en ticks TO8 entiers. */
export const TO8_RUNTIME_TIMING = {
  /**
   * Duree moderne d'un passage de boucle titre pour le compteur attract `$8DD8`.
   *
   * Le seuil ASM reste `$34` passages, mais un passage de boucle titre original
   * n'est pas un tick moteur moderne 50 Hz. Valeur de calibration moderne en
   * attente d'une mesure video/emulateur.
   */
  titleAttractLoopTicks: 13,
  /** Demi-pas du blink spawn `0x04` puis noir; `$BE68` boucle 6 fois avec delais CPU `$CD5B`. */
  playerSpawnBlinkStepTicks: 13,
  /** Duree du pas joueur fluide; approximation moderne arrondie depuis 10,5 ticks. */
  playerGridMoveTicks: 11,
  /** Delai avant animation idle, lie a `$CED9` mais encore cadence moderne. */
  playerIdleDelayTicks: 40,
  /** Intervalle de decision monstre; `CA04`/`BC84` sont appeles par boucle ASM, valeur moderne centralisee. */
  monsterMoveIntervalTicks: 14,
  /** Duree visuelle d'un pas monstre; interpolation moderne decouplee de la decision logique. */
  monsterGridMoveTicks: 9,
  /**
   * Intervalle de scan physique; `$CB07` parcourt `$DBE0-$DEFF` puis les routines de mouvement
   * utilisent le delai CPU `$CD5B`, donc la physique ne doit pas avancer a chaque petite frame moderne.
   */
  fallingObjectScanTicks: 14,
  /** Duree visuelle d'une chute/glissade; ralentie pour suivre le scan physique original global. */
  fallingObjectGridMoveTicks: 14,
  /** Duree d'une frame d'explosion; approximation moderne deja entiere. */
  explosionFrameTicks: 6,
  /** Cadence du cycle idle joueur, approximation moderne liee aux frames extraites. */
  playerAnimationFrameTicks: 6,
  /** Cadence du cycle couleur diamant; `$D1E0` anime le plan couleur, valeur moderne centralisee. */
  diamondAnimationFrameTicks: 6,
  /** Cadence du blink monstre; `$D1BB` modifie les plans graphiques, valeur moderne centralisee. */
  monsterAnimationFrameTicks: 13,
  /** Cadence du diamant HUD, distincte de la logique de collecte. */
  hudDiamondAnimationFrameTicks: 6,
  /** Cadence du blink de sortie ouverte, rendu moderne sans mutation de grille. */
  exitBlinkFrameTicks: 13,
  /** Duree d'une phase visible du flash objectif; `BD87` inverse `$E7C1` six fois. */
  objectiveReachedFlashPhaseTicks: 2,
  /** Nombre de phases du flash objectif, calque sur les six inversions de `KIT.BIN:$BD87`. */
  objectiveReachedFlashPhaseCount: 6,
  /** Cadence moderne de conversion temps restant vers score apres entree sortie. */
  levelCompletionBonusStepTicks: 2,
  /** Delai court apres conversion complete avant passage au niveau suivant. */
  levelCompletionTransitionDelayTicks: 25,
  /** Cadence du compteur HUD temps en secondes historiques. */
  hudTimerTicks: TO8_RUNTIME_TICKS_PER_SECOND
} as const;
