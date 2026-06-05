import { FIXED_DT_SECONDS, MAX_FRAME_DT_SECONDS } from "./constants";

/**
 * Boucle de jeu a pas fixe.
 *
 * Le rendu suit `requestAnimationFrame`, tandis que la simulation avance par
 * pas constants pour conserver un gameplay stable.
 */

/** Callbacks invoques par la boucle fixe. */
export interface FixedGameLoopOptions {
  /** Met a jour la simulation avec un delta fixe. */
  update(dt: number): void;

  /** Rend l'etat courant apres les mises a jour accumulees. */
  render(): void;
}

/** Pilote la simulation fixe et le rendu canvas. */
export class FixedGameLoop {
  /** Temps accumule en attente de pas de simulation. */
  private accumulator = 0;

  /** Identifiant `requestAnimationFrame` courant. */
  private animationFrame = 0;

  /** Timestamp de la derniere frame recue. */
  private lastTimestamp = 0;

  /** Indique si la boucle est active. */
  private running = false;

  /** Prepare une boucle a partir des callbacks fournis. */
  constructor(private readonly options: FixedGameLoopOptions) {}

  /** Demarre la boucle si elle n'est pas deja active. */
  start(): void {
    if (this.running) {
      return;
    }

    this.running = true;
    this.lastTimestamp = performance.now();
    this.animationFrame = requestAnimationFrame(this.tick);
  }

  /** Arrete la boucle et vide l'accumulateur temporel. */
  stop(): void {
    if (!this.running) {
      return;
    }

    cancelAnimationFrame(this.animationFrame);
    this.running = false;
    this.accumulator = 0;
  }

  /** Traite une frame navigateur et consomme autant de pas fixes que necessaire. */
  private readonly tick = (timestamp: number): void => {
    if (!this.running) {
      return;
    }

    const elapsedSeconds = Math.min(
      (timestamp - this.lastTimestamp) / 1000,
      MAX_FRAME_DT_SECONDS
    );
    this.lastTimestamp = timestamp;
    this.accumulator += elapsedSeconds;

    while (this.accumulator >= FIXED_DT_SECONDS) {
      this.options.update(FIXED_DT_SECONDS);
      this.accumulator -= FIXED_DT_SECONDS;
    }

    this.options.render();
    this.animationFrame = requestAnimationFrame(this.tick);
  };
}
