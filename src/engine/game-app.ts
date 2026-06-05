import { Canvas2DRenderer } from "./renderer";
import type { Scene } from "./scene";
import { SceneRouter } from "./scene";
import { FixedGameLoop } from "./game-loop";
import { KeyboardInput } from "./input";

export interface GameAppOptions {
  canvas: HTMLCanvasElement;
  initialScene: () => Scene;
}

export interface GameApp {
  start(): void;
  stop(): void;
}

export function createGameApp(options: GameAppOptions): GameApp {
  const renderer = new Canvas2DRenderer(options.canvas);
  const input = new KeyboardInput(window);
  const scenes = new SceneRouter(options.initialScene());

  const loop = new FixedGameLoop({
    update(dt) {
      scenes.update(dt, input.snapshot());
      input.commit();
    },
    render() {
      renderer.beginFrame();
      scenes.render(renderer);
    }
  });

  return {
    start() {
      loop.start();
    },
    stop() {
      loop.stop();
      input.dispose();
    }
  };
}
