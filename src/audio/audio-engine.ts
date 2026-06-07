/**
 * Role: Fournit une facade sonore pour le portage moderne.
 * Scope: Gere les modes audio original/moderne et encapsule WebAudio hors gameplay.
 * ISO: Le mode `original` reproduit les routines identifiees dans `SOUND_ASM_ANALYSIS.md`.
 * Notes: Le contexte audio reste paresseux pour respecter les contraintes navigateur.
 */

import {
  EXPLOSION_PULSE_DURATIONS,
  EXPLOSION_PULSE_FREQUENCIES,
  ORIGINAL_MASTER_GAIN,
  SCORE_TICK_HIGH_DURATION,
  SCORE_TICK_HIGH_FREQUENCY,
  SCORE_TICK_LOW_DURATION,
  SCORE_TICK_LOW_FREQUENCY,
  THEODORE_AUDIO_SAMPLE_RATE,
  THEODORE_MAX_SOUND_LEVEL,
  TITLE_MUSIC_DAC_TABLE,
  TITLE_MUSIC_FREQUENCY_RATIO,
  TITLE_MUSIC_NOTE_DURATION
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
  /** Joue le bruitage d'explosion original. */
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

  /** Lance une boucle de niveaux DAC 6 bits echantillonnee comme Theodore. */
  startLoopedDacSequence(values: readonly number[], holdSeconds: number): void {
    const samplesPerValue = Math.max(1, Math.round(holdSeconds * THEODORE_AUDIO_SAMPLE_RATE));
    const levels: number[] = [];
    values.forEach((value) => {
      const level = value & THEODORE_MAX_SOUND_LEVEL;
      for (let repeat = 0; repeat < samplesPerValue; repeat += 1) {
        levels.push(level);
      }
    });

    const buffer = this.createThomsonLevelBuffer(levels);
    if (buffer) {
      this.startLoopedBuffer(buffer);
    }
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

  /** Joue un oscillateur carre avec enveloppe simple. */
  playSquarePulse(frequency: number, startTime: number, duration: number, gainValue: number): void {
    const context = this.getContext();
    const destination = this.getMasterGain();
    if (!context || !destination) {
      return;
    }

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(frequency, startTime);
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(gainValue, startTime + 0.006);
    gain.gain.linearRampToValueAtTime(0, startTime + duration);
    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration + 0.01);
  }

  /** Cree un buffer mono depuis une table DAC 6 bits. */
  createDacBuffer(samples: readonly number[], sampleRate: number, sampleHold = 1): AudioBuffer | null {
    const context = this.getContext();
    if (!context || samples.length === 0) {
      return null;
    }

    const hold = Math.max(1, Math.floor(sampleHold));
    const buffer = context.createBuffer(1, samples.length * hold, sampleRate);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < samples.length; index += 1) {
      const value = ((samples[index] & 0x3f) / 31.5) - 1;
      for (let repeat = 0; repeat < hold; repeat += 1) {
        channel[index * hold + repeat] = value;
      }
    }

    return buffer;
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

  /** Retourne le temps courant du contexte audio, ou zero si indisponible. */
  currentTime(): number {
    return this.getContext()?.currentTime ?? 0;
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

  /** Joue l'approximation synthetique de secours du tick score. */
  private playSynthScoreTick(engine: WebAudioAdapter): void {
    engine.playThomsonLevels(createMutedCarrierLevels([
      { frequency: SCORE_TICK_HIGH_FREQUENCY, duration: SCORE_TICK_HIGH_DURATION },
      { frequency: SCORE_TICK_LOW_FREQUENCY, duration: SCORE_TICK_LOW_DURATION }
    ]));
  }

  /** Joue les trois salves associees a l'explosion `0x14`, `0x15`, `0x16`. */
  playExplosion(engine: WebAudioAdapter): void {
    this.playSynthExplosion(engine);
  }

  /** Joue l'approximation synthetique de secours de l'explosion. */
  private playSynthExplosion(engine: WebAudioAdapter): void {
    const segments = EXPLOSION_PULSE_DURATIONS.map((duration, index) => ({
      frequency: EXPLOSION_PULSE_FREQUENCIES[index],
      duration
    }));
    engine.playThomsonLevels(createMutedCarrierLevels(segments));
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
  /** Indique si la scene titre demande une musique active. */
  private titleMusicRequested = false;
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
    this.titleMusicRequested = false;
    this.titleMusicPlaying = false;
    this.strategies[this.mode].stopTitleMusic(this.engine);
  }

  /** Lance la musique de titre du mode courant. */
  startTitleMusic(): void {
    this.titleMusicRequested = true;
    if (this.titleMusicPlaying) {
      return;
    }

    this.strategies[this.mode].startTitleMusic(this.engine);
    this.titleMusicPlaying = true;
  }

  /** Stoppe la musique de titre du mode courant. */
  stopTitleMusic(): void {
    this.titleMusicRequested = false;
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

/** Segment de porteuse mute/unmute reproduisant les bascules `E7C1` du jeu. */
interface MutedCarrierSegment {
  /** Frequence de bascule mute/unmute en hertz. */
  readonly frequency: number;
  /** Duree du segment en secondes. */
  readonly duration: number;
}

/** Cree des niveaux 6 bits en alternant les extremites DAC pour obtenir une porteuse TO8 perceptive. */
function createMutedCarrierLevels(segments: readonly MutedCarrierSegment[]): number[] {
  const levels: number[] = [];
  const soundLevel = THEODORE_MAX_SOUND_LEVEL;
  for (const segment of segments) {
    const sampleCount = Math.max(1, Math.round(segment.duration * THEODORE_AUDIO_SAMPLE_RATE));
    const halfPeriodSamples = Math.max(1, Math.round(THEODORE_AUDIO_SAMPLE_RATE / (segment.frequency * 2)));
    for (let index = 0; index < sampleCount; index += 1) {
      const muted = Math.floor(index / halfPeriodSamples) % 2 === 1;
      levels.push(muted ? 0 : soundLevel);
    }
  }

  return levels;
}

/** Extension WebKit historique exposee par Safari pour WebAudio. */
declare global {
  interface Window {
    /** Constructeur AudioContext prefixed disponible sur certains navigateurs. */
    webkitAudioContext?: typeof AudioContext;
  }
}
