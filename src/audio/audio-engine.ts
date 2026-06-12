/**
 * Role: Fournit une facade sonore pour le portage moderne.
 * Scope: Gere les modes audio original/moderne et encapsule WebAudio hors gameplay.
 * ISO: Le mode `original` reproduit les routines identifiees dans `SOUND_ASM_ANALYSIS.md`.
 * Notes: Le contexte audio reste paresseux pour respecter les contraintes navigateur.
 */

import {
  KIT_BD9F_EXPLOSION_DELAY_TABLE,
  KIT_BD9F_EXPLOSION_FRAME_PASSES,
  KIT_BD9F_EXPLOSION_HALF_PULSE_SCALE,
  KIT_BD9F_EXPLOSION_INITIAL_PULSE_COUNT,
  KIT_BD9F_EXPLOSION_TONE_CODES,
  KIT_C255_SCORE_TICK_SEGMENTS,
  ORIGINAL_MASTER_GAIN,
  THEODORE_AUDIO_SAMPLE_RATE,
  THEODORE_MAX_SOUND_LEVEL,
  TO8_SOUND_CPU_CYCLES_PER_SECOND,
  TITLE_MUSIC_DAC_TABLE,
  TITLE_MUSIC_FREQUENCY_RATIO,
  TITLE_MUSIC_NOTE_DURATION,
  type KitC255SoundSegment
} from "./original-sound-profiles";

/** Modes sonores proposes par le portage moderne. */
export type AudioMode = "original" | "modern";

/** Intentions audio exposees aux scenes sans detail WebAudio. */
export interface GameAudio {
  /** Change le mode sonore courant. */
  setMode(mode: AudioMode): void;
  /** Retourne le mode sonore courant. */
  getMode(): AudioMode;
  /** Prepare le contexte audio apres un geste utilisateur si le navigateur l'exige. */
  unlock(): void;
  /** Coupe explicitement toute demande de musique titre hors ecran 2. */
  disarmTitleMusic(): void;
  /** Lance la musique de l'ecran titre quand le mode courant la fournit. */
  startTitleMusic(): void;
  /** Arrete la musique de l'ecran titre. */
  stopTitleMusic(): void;
  /** Joue le bruitage de collecte diamant / score. */
  playDiamondCollected(): void;
  /** Joue un tick de conversion temps vers score en fin de niveau. */
  playScoreTick(): void;
  /** Joue le bruitage d'explosion si le mode courant en fournit un. */
  playExplosion(): void;
}

/** Strategie sonore commune aux modes original et moderne. */
interface AudioStrategy {
  /** Lance la musique de titre propre au mode. */
  startTitleMusic(engine: WebAudioAdapter): void;
  /** Arrete la musique de titre propre au mode. */
  stopTitleMusic(engine: WebAudioAdapter): void;
  /** Joue le son de collecte diamant. */
  playDiamondCollected(engine: WebAudioAdapter): void;
  /** Joue le tick de score. */
  playScoreTick(engine: WebAudioAdapter): void;
  /** Joue l'explosion. */
  playExplosion(engine: WebAudioAdapter): void;
}

/** Constructeur AudioContext compatible navigateurs prefixed. */
type AudioContextConstructor = typeof AudioContext;

/** Adaptateur WebAudio minimal partage par les strategies sonores. */
class WebAudioAdapter {
  /** Contexte audio cree a la premiere utilisation. */
  private context: AudioContext | null = null;
  /** Gain maitre commun. */
  private masterGain: GainNode | null = null;
  /** Source bouclee de la musique titre. */
  private titleMusicSource: AudioBufferSourceNode | null = null;
  /** Timers actifs de la sequence musicale titre originale. */
  private titleMusicTimers: number[] = [];
  /** Oscillateurs deja programmes pour la sequence musicale titre. */
  private titleMusicOscillators: AudioScheduledSourceNode[] = [];
  /** Gains intermediaires de la sequence musicale titre. */
  private titleMusicGains: GainNode[] = [];
  /** Retourne le contexte audio courant, en le creant si necessaire. */
  getContext(): AudioContext | null {
    const AudioContextCtor: AudioContextConstructor | undefined = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContextCtor) {
      return null;
    }

    if (!this.context) {
      this.context = new AudioContextCtor();
      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = ORIGINAL_MASTER_GAIN;
      this.masterGain.connect(this.context.destination);
    }

    void this.context.resume().catch(() => undefined);
    return this.context;
  }

  /** Retourne le gain maitre si WebAudio est disponible. */
  getMasterGain(): GainNode | null {
    this.getContext();
    return this.masterGain;
  }

  /** Tente de deverrouiller le contexte audio apres interaction utilisateur. */
  unlock(): void {
    void this.getContext()?.resume().catch(() => undefined);
  }

  /** Lance une boucle DAC deja convertie en buffer audio. */
  startLoopedBuffer(buffer: AudioBuffer, loopStart = 0, loopEnd = buffer.duration, offset = loopStart): void {
    this.stopTitleMusic();
    const context = this.getContext();
    const destination = this.getMasterGain();
    if (!context || !destination) {
      return;
    }

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = loopStart;
    source.loopEnd = loopEnd;
    source.connect(destination);
    source.start(0, offset);
    this.titleMusicSource = source;
  }

  /** Lance une sequence cyclique de notes depuis la table musicale de titre. */
  startLoopedToneSequence(values: readonly number[], noteDuration: number, frequencyRatio: number): void {
    this.stopTitleMusic();
    const context = this.getContext();
    const destination = this.getMasterGain();
    if (!context || !destination || values.length === 0) {
      return;
    }

    const scheduleCycle = () => {
      const startTime = context.currentTime + 0.035;
      values.forEach((value, index) => {
        if (value <= 0) {
          return;
        }

        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const frequency = Math.max(80, Math.min(1400, frequencyRatio / value));
        const noteStart = startTime + index * noteDuration;
        const noteEnd = noteStart + noteDuration * 0.82;
        oscillator.type = "square";
        oscillator.frequency.setValueAtTime(frequency, noteStart);
        gain.gain.setValueAtTime(0, noteStart);
        gain.gain.linearRampToValueAtTime(0.2, noteStart + 0.006);
        gain.gain.setValueAtTime(0.2, Math.max(noteStart + 0.006, noteEnd - 0.014));
        gain.gain.linearRampToValueAtTime(0, noteEnd);
        oscillator.connect(gain);
        gain.connect(destination);
        oscillator.start(noteStart);
        oscillator.stop(noteEnd + 0.01);
        this.titleMusicOscillators.push(oscillator);
        this.titleMusicGains.push(gain);
      });

      const timer = window.setTimeout(scheduleCycle, values.length * noteDuration * 1000);
      this.titleMusicTimers.push(timer);
    };

    scheduleCycle();
  }

  /** Stoppe la musique titre si elle tourne. */
  stopTitleMusic(): void {
    this.titleMusicSource?.stop();
    this.titleMusicSource?.disconnect();
    this.titleMusicSource = null;
    this.titleMusicTimers.forEach((timer) => window.clearTimeout(timer));
    this.titleMusicTimers = [];
    this.titleMusicOscillators.forEach((oscillator) => {
      try {
        oscillator.stop();
      } catch {
        // Un oscillateur deja stoppe par WebAudio ne doit pas faire echouer l'arret global.
      }
      oscillator.disconnect();
    });
    this.titleMusicGains.forEach((gain) => gain.disconnect());
    this.titleMusicOscillators = [];
    this.titleMusicGains = [];
  }

  /** Cree un buffer depuis des niveaux materiels 6 bits, avec la conversion Theodore. */
  createThomsonLevelBuffer(levels: readonly number[]): AudioBuffer | null {
    const context = this.getContext();
    if (!context || levels.length === 0) {
      return null;
    }

    const buffer = context.createBuffer(1, levels.length, THEODORE_AUDIO_SAMPLE_RATE);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < levels.length; index += 1) {
      channel[index] = thomsonLevelToFloat(levels[index]);
    }

    return buffer;
  }

  /** Joue un buffer materiel 6 bits non boucle. */
  playThomsonLevels(levels: readonly number[]): void {
    const context = this.getContext();
    const destination = this.getMasterGain();
    const buffer = this.createThomsonLevelBuffer(levels);
    if (!context || !destination || !buffer) {
      return;
    }

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(destination);
    source.start();
  }

}

/** Strategie ISO originale basee sur les routines ASM identifiees. */
class OriginalAudioStrategy implements AudioStrategy {
  /** Lance la musique DAC de l'ecran 2 issue de `ENTET.BIN:$943F-$9498`. */
  startTitleMusic(engine: WebAudioAdapter): void {
    engine.startLoopedToneSequence(TITLE_MUSIC_DAC_TABLE, TITLE_MUSIC_NOTE_DURATION, TITLE_MUSIC_FREQUENCY_RATIO);
  }

  /** Stoppe la musique titre originale. */
  stopTitleMusic(engine: WebAudioAdapter): void {
    engine.stopTitleMusic();
  }

  /** Joue le bruitage score/diamant prouve par `KIT.BIN:$C255`. */
  playDiamondCollected(engine: WebAudioAdapter): void {
    this.playSynthScoreTick(engine);
  }

  /** Joue le tick score utilise aussi pour la conversion de fin de niveau. */
  playScoreTick(engine: WebAudioAdapter): void {
    this.playDiamondCollected(engine);
  }

  /** Joue la routine 1 bit `KIT.BIN:$C255`, prouvee pour score/diamant. */
  private playSynthScoreTick(engine: WebAudioAdapter): void {
    engine.playThomsonLevels(createKitC255ScoreTickLevels(KIT_C255_SCORE_TICK_SEGMENTS));
  }

  /** Joue la salve 1 bit appelee entre les frames d'explosion par `KIT.BIN:$BD9F`. */
  playExplosion(engine: WebAudioAdapter): void {
    engine.playThomsonLevels(createKitBd9fExplosionLevels());
  }
}

/** Strategie reservee aux sons modernes futurs; elle reste silencieuse pour l'instant. */
class ModernAudioStrategy implements AudioStrategy {
  /** Le mode moderne n'a pas encore de musique titre. */
  startTitleMusic(_engine: WebAudioAdapter): void {
    return;
  }

  /** Le mode moderne n'a rien a stopper pour l'instant. */
  stopTitleMusic(engine: WebAudioAdapter): void {
    engine.stopTitleMusic();
  }

  /** Son moderne de diamant reserve pour une phase future. */
  playDiamondCollected(_engine: WebAudioAdapter): void {
    return;
  }

  /** Son moderne de score reserve pour une phase future. */
  playScoreTick(_engine: WebAudioAdapter): void {
    return;
  }

  /** Son moderne d'explosion reserve pour une phase future. */
  playExplosion(_engine: WebAudioAdapter): void {
    return;
  }
}

/** Gestionnaire sonore global du jeu. */
class GameAudioManager implements GameAudio {
  /** Adaptateur WebAudio partage. */
  private readonly engine = new WebAudioAdapter();
  /** Strategies disponibles par mode sonore. */
  private readonly strategies: Record<AudioMode, AudioStrategy> = {
    original: new OriginalAudioStrategy(),
    modern: new ModernAudioStrategy()
  };
  /** Mode sonore courant. */
  private mode: AudioMode = "original";
  /** Indique si la musique titre est deja programmee. */
  private titleMusicPlaying = false;

  /** Installe le deverrouillage navigateur sur les premiers gestes utilisateur. */
  constructor() {
    const unlock = () => this.unlock();
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
  }

  /** Change le mode sonore courant. */
  setMode(mode: AudioMode): void {
    if (this.mode === mode) {
      return;
    }

    this.stopTitleMusic();
    this.mode = mode;
  }

  /** Retourne le mode sonore courant. */
  getMode(): AudioMode {
    return this.mode;
  }

  /** Deverrouille le contexte audio navigateur. */
  unlock(): void {
    this.engine.unlock();
  }

  /** Desarme la musique titre sans autoriser de relance sur le prochain geste utilisateur. */
  disarmTitleMusic(): void {
    this.titleMusicPlaying = false;
    this.strategies[this.mode].stopTitleMusic(this.engine);
  }

  /** Lance la musique de titre du mode courant. */
  startTitleMusic(): void {
    if (this.titleMusicPlaying) {
      return;
    }

    this.strategies[this.mode].startTitleMusic(this.engine);
    this.titleMusicPlaying = true;
  }

  /** Stoppe la musique de titre du mode courant. */
  stopTitleMusic(): void {
    this.titleMusicPlaying = false;
    this.strategies[this.mode].stopTitleMusic(this.engine);
  }

  /** Joue le son de diamant du mode courant. */
  playDiamondCollected(): void {
    this.strategies[this.mode].playDiamondCollected(this.engine);
  }

  /** Joue le tick score du mode courant. */
  playScoreTick(): void {
    this.strategies[this.mode].playScoreTick(this.engine);
  }

  /** Joue le son d'explosion du mode courant. */
  playExplosion(): void {
    this.strategies[this.mode].playExplosion(this.engine);
  }
}

/** Facade sonore partagee par les scenes. */
export const gameAudio: GameAudio = new GameAudioManager();

/** Convertit un niveau sonore Thomson 6 bits en amplitude WebAudio, comme `GetAudioSample` de Theodore. */
function thomsonLevelToFloat(level: number): number {
  if (level < 0) {
    return 0;
  }

  const clampedLevel = Math.max(0, Math.min(THEODORE_MAX_SOUND_LEVEL, Math.floor(level)));
  return (clampedLevel / THEODORE_MAX_SOUND_LEVEL) * 2 - 1;
}

/** Cree les niveaux 1 bit de la routine `KIT.BIN:$C255` a partir de ses boucles ASM. */
function createKitC255ScoreTickLevels(segments: readonly KitC255SoundSegment[]): number[] {
  const levels: number[] = [];
  let currentLevel = THEODORE_MAX_SOUND_LEVEL;
  let fractionalSamples = 0;

  for (const segment of segments) {
    const cyclesPerToggle = estimateKitC255CyclesPerToggle(segment.delayLoopCount);
    const samplesPerToggle = cyclesPerToggle * THEODORE_AUDIO_SAMPLE_RATE / TO8_SOUND_CPU_CYCLES_PER_SECOND;

    for (let toggleIndex = 0; toggleIndex < segment.toggleCount; toggleIndex += 1) {
      const exactSamples = samplesPerToggle + fractionalSamples;
      const sampleCount = Math.max(1, Math.floor(exactSamples));
      fractionalSamples = exactSamples - sampleCount;
      for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
        levels.push(currentLevel);
      }
      currentLevel = currentLevel === 0 ? THEODORE_MAX_SOUND_LEVEL : 0;
    }
  }

  return levels;
}

/** Estime les cycles entre deux `STA $E7C1` consecutifs dans la boucle `$C28F-$C2A0`. */
function estimateKitC255CyclesPerToggle(delayLoopCount: number): number {
  return 31 + delayLoopCount * 5;
}

/** Cree les niveaux 1 bit de la pause sonore `KIT.BIN:$BD9F/$BDC9` utilisee par l'explosion. */
function createKitBd9fExplosionLevels(): number[] {
  const levels: number[] = [];
  let currentLevel = THEODORE_MAX_SOUND_LEVEL;
  let fractionalSamples = 0;

  for (let pass = 0; pass < KIT_BD9F_EXPLOSION_FRAME_PASSES; pass += 1) {
    const pulseCount = KIT_BD9F_EXPLOSION_INITIAL_PULSE_COUNT + pass;
    for (const toneCode of KIT_BD9F_EXPLOSION_TONE_CODES) {
      const delayLoopCount = KIT_BD9F_EXPLOSION_DELAY_TABLE[toneCode & 0x0f] ?? 0x50;
      const samplesPerHalfPulse = (
        estimateKitBd9fExplosionCyclesPerHalfPulse(delayLoopCount)
        * KIT_BD9F_EXPLOSION_HALF_PULSE_SCALE
        * THEODORE_AUDIO_SAMPLE_RATE
        / TO8_SOUND_CPU_CYCLES_PER_SECOND
      );

      for (let pulseIndex = 0; pulseIndex < pulseCount * 2; pulseIndex += 1) {
        const exactSamples = samplesPerHalfPulse + fractionalSamples;
        const sampleCount = Math.max(1, Math.floor(exactSamples));
        fractionalSamples = exactSamples - sampleCount;
        for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
          levels.push(currentLevel);
        }
        currentLevel = currentLevel === 0 ? THEODORE_MAX_SOUND_LEVEL : 0;
      }
    }
  }

  return levels;
}

/** Estime la duree du couple `BDC9 -> BE3A` entre deux changements du bit `0x08` de `$E7C1`. */
function estimateKitBd9fExplosionCyclesPerHalfPulse(delayLoopCount: number): number {
  return 45 + delayLoopCount * 21;
}

/** Extension WebKit historique exposee par Safari pour WebAudio. */
declare global {
  interface Window {
    /** Constructeur AudioContext prefixed disponible sur certains navigateurs. */
    webkitAudioContext?: typeof AudioContext;
  }
}
