import { FIXED_DT_SECONDS, MAX_FRAME_DT_SECONDS } from "./constants";

export interface FixedGameLoopOptions {
  update(dt: number): void;
  render(): void;
}

export class FixedGameLoop {
  private accumulator = 0;
  private animationFrame = 0;
  private lastTimestamp = 0;
  private running = false;

  constructor(private readonly options: FixedGameLoopOptions) {}

  start(): void {
    if (this.running) {
      return;
    }

    this.running = true;
    this.lastTimestamp = performance.now();
    this.animationFrame = requestAnimationFrame(this.tick);
  }

  stop(): void {
    if (!this.running) {
      return;
    }

    cancelAnimationFrame(this.animationFrame);
    this.running = false;
    this.accumulator = 0;
  }

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
