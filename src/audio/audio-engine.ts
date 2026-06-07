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
  TITLE_MUSIC_FREQUENCY_RATIO,
  TITLE_MUSIC_DAC_TABLE,
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
  startLoopedBuffer(buffer: AudioBuffer): void {
    this.stopTitleMusic();
    const context = this.getContext();
    const destination = this.getMasterGain();
    if (!context || !destination) {
      return;
    }

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(destination);
    source.start();
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
        const frequency = Math.max(80, Math.min(1400, value * frequencyRatio));
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

  /** Retourne le temps courant du contexte audio, ou zero si indisponible. */
  currentTime(): number {
    return this.getContext()?.currentTime ?? 0;
  }
}

/** Strategie ISO originale basee sur les routines ASM identifiees. */
class OriginalAudioStrategy implements AudioStrategy {
  /** Lance la musique DAC de l'ecran 2 issue de `ENTET.BIN:$943F-$9498`. */
  startTitleMusic(engine: WebAudioAdapter): void {
    engine.startLoopedToneSequence(
      TITLE_MUSIC_DAC_TABLE,
      TITLE_MUSIC_NOTE_DURATION,
      TITLE_MUSIC_FREQUENCY_RATIO
    );
  }

  /** Stoppe la musique titre originale. */
  stopTitleMusic(engine: WebAudioAdapter): void {
    engine.stopTitleMusic();
  }

  /** Joue le bruitage score/diamant prouve par `KIT.BIN:$C255`. */
  playDiamondCollected(engine: WebAudioAdapter): void {
    this.playScoreTick(engine);
  }

  /** Joue le tick score utilise aussi pour la conversion de fin de niveau. */
  playScoreTick(engine: WebAudioAdapter): void {
    const startTime = engine.currentTime();
    engine.playSquarePulse(SCORE_TICK_HIGH_FREQUENCY, startTime, SCORE_TICK_HIGH_DURATION, 0.55);
    engine.playSquarePulse(
      SCORE_TICK_LOW_FREQUENCY,
      startTime + SCORE_TICK_HIGH_DURATION,
      SCORE_TICK_LOW_DURATION,
      0.42
    );
  }

  /** Joue les trois salves associees a l'explosion `0x14`, `0x15`, `0x16`. */
  playExplosion(engine: WebAudioAdapter): void {
    let cursor = engine.currentTime();
    for (let index = 0; index < EXPLOSION_PULSE_DURATIONS.length; index += 1) {
      engine.playSquarePulse(
        EXPLOSION_PULSE_FREQUENCIES[index],
        cursor,
        EXPLOSION_PULSE_DURATIONS[index],
        0.68 - index * 0.12
      );
      cursor += EXPLOSION_PULSE_DURATIONS[index] * 0.72;
    }
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

/** Extension WebKit historique exposee par Safari pour WebAudio. */
declare global {
  interface Window {
    /** Constructeur AudioContext prefixed disponible sur certains navigateurs. */
    webkitAudioContext?: typeof AudioContext;
  }
}
