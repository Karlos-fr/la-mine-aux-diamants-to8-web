/**
 * Role: Decrit les profils sonores derives des routines ASM originales.
 * Scope: Centralise tables DAC, frequences et enveloppes avant rendu WebAudio.
 * ISO: Les constantes citent les routines TO8 identifiees dans `SOUND_ASM_ANALYSIS.md`.
 * Notes: Le rendu reste une approximation WebAudio moderne, sans emulation cycle-pres du 6809.
 */

/** Table DAC lue par la routine `ENTET.BIN:$943F-$9498` pour la musique de l'ecran 2. */
export const TITLE_MUSIC_DAC_TABLE = [
  0x34, 0x43, 0x47, 0x43, 0x3b, 0x5a, 0x47, 0x3b, 0x31, 0x3b, 0x43, 0x3b,
  0x34, 0x50, 0x43, 0x34, 0x26, 0x31, 0x34, 0x31, 0x3b, 0x20, 0x22, 0x31,
  0x34, 0x2b, 0x34, 0x47, 0x43, 0x34, 0x3b, 0x43, 0x31, 0x43, 0x31, 0x2b,
  0x26, 0x31, 0x34, 0x31, 0x3b, 0x43, 0x3b, 0x31, 0x22, 0x2b, 0x31, 0x34,
  0x3b, 0x43, 0x47, 0x50, 0x31, 0x43, 0x3b, 0x5a, 0x50, 0x43, 0x3b, 0x2b,
  0x34, 0x34, 0x34, 0x3b, 0x3b, 0x34, 0x31, 0x50, 0x47, 0x3b, 0x5a, 0x31,
  0x34, 0x47, 0x43, 0x5a, 0x50, 0x43, 0x65, 0x50, 0x3b, 0x34, 0x31, 0x50,
  0x5a, 0x47, 0x31, 0x34, 0x31, 0x43, 0x50, 0x43, 0x65, 0x43, 0x3b, 0x34,
  0x31, 0x26, 0x3b, 0x43, 0x47, 0x3b, 0x34, 0x31, 0x2b, 0x3b, 0x34, 0x47,
  0x43, 0x34, 0x31, 0x2b, 0x26, 0x20, 0x31, 0x34, 0x31, 0x26, 0x1c, 0x31,
  0x34, 0x1c, 0x20, 0x22, 0x26, 0x2b
] as const;

/** Duree moderne d'une note de la table titre, calibree sur la capture active de la musique. */
export const TITLE_MUSIC_NOTE_DURATION = 0.211;

/** Constante de conversion des delais de la table titre vers une frequence audible. */
export const TITLE_MUSIC_FREQUENCY_RATIO = 23000;

/** Volume prudent du mode original pour respecter le rendu TO8 sans saturer le navigateur. */
export const ORIGINAL_MASTER_GAIN = 0.18;

/** Frequence d'echantillonnage audio utilisee par Theodore pour le signal Thomson. */
export const THEODORE_AUDIO_SAMPLE_RATE = 22050;

/** Niveau sonore maximal 6 bits du DAC Thomson dans Theodore. */
export const THEODORE_MAX_SOUND_LEVEL = 0x3f;

/** Frequence dominante du bruitage diamant mesuree sur la capture, inspiree de `KIT.BIN:$C255`. */
export const SCORE_TICK_HIGH_FREQUENCY = 1850;

/** Frequence secondaire du bruitage diamant, plus grave pour reproduire la retombee finale. */
export const SCORE_TICK_LOW_FREQUENCY = 155;

/** Duree du segment haut du bruitage score/diamant. */
export const SCORE_TICK_HIGH_DURATION = 0.078;

/** Duree du segment bas du bruitage score/diamant pour atteindre environ 100 ms actifs. */
export const SCORE_TICK_LOW_DURATION = 0.027;

/** Durees des trois salves d'explosion synchronisees avec les tuiles `0x14`, `0x15`, `0x16`. */
export const EXPLOSION_PULSE_DURATIONS = [0.28, 0.29, 0.28] as const;

/** Frequences centrales tres graves du bruitage explosion original 1-bit, calibrees a l'oreille depuis la capture. */
export const EXPLOSION_PULSE_FREQUENCIES = [145, 95, 65] as const;
