/**
 * Role: Decrit les profils sonores derives des routines ASM originales.
 * Scope: Centralise tables DAC, boucles ASM et enveloppes avant rendu WebAudio.
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

/** Cadence CPU retenue pour convertir les boucles 6809 de `KIT.BIN:$C255` en durees WebAudio. */
export const TO8_SOUND_CPU_CYCLES_PER_SECOND = 1_000_000;

/** Segment de la routine bruitage `KIT.BIN:$C255`, tables `$C2A6/$C2AC`. */
export interface KitC255SoundSegment {
  /** Nombre de bascules du bit `0x08` de `$E7C1`, valeur `X` dans la routine ASM. */
  readonly toggleCount: number;
  /** Compteur de boucle d'attente `B`, restaure a chaque bascule par `PSHS/PULS $04`. */
  readonly delayLoopCount: number;
}

/** Tables ASM exactes du bruitage score/diamant `KIT.BIN:$C255`. */
export const KIT_C255_SCORE_TICK_SEGMENTS: readonly KitC255SoundSegment[] = [
  { toggleCount: 0x0050, delayLoopCount: 0x30 },
  { toggleCount: 0x0060, delayLoopCount: 0x60 }
] as const;

/** Codes parcourus par `KIT.BIN:$BD9F` entre les frames `0x14`, `0x15`, `0x16`. */
export const KIT_BD9F_EXPLOSION_TONE_CODES = [0x33, 0x31] as const;

/** Table de delais `KIT.BIN:$BE5A`; seuls les index bas de `33` et `31` sont utilises ici. */
export const KIT_BD9F_EXPLOSION_DELAY_TABLE = [
  0x00, 0x77, 0x70, 0x69, 0x62, 0x5c, 0x56, 0x50,
  0x4b, 0x46, 0x41, 0x3c, 0x38, 0x34
] as const;

/** Nombre de salves `BD9F`, une apres chacune des trois frames visibles d'explosion. */
export const KIT_BD9F_EXPLOSION_FRAME_PASSES = 3;

/** Compteur bas initialise par `KIT.BIN:$CCD7` dans `$BDC5/$BDC6` avant l'explosion. */
export const KIT_BD9F_EXPLOSION_INITIAL_PULSE_COUNT = 0x0d;
