import { Canvas2DRenderer } from "./renderer";
import type { Scene } from "./scene";
import { SceneRouter } from "./scene";
import { FixedGameLoop } from "./game-loop";
import { KeyboardInput } from "./input";

/**
 * Composition racine du moteur moderne.
 *
 * Ce module connecte le canvas, les scenes, l'input clavier et la boucle fixe
 * sans exposer ces details au point d'entree applicatif.
 */

/** Options necessaires pour instancier l'application de jeu. */
export interface GameAppOptions {
  /** Canvas cible sur lequel le renderer dessine la resolution logique. */
  canvas: HTMLCanvasElement;

  /** Fabrique de la premiere scene a afficher. */
  initialScene: () => Scene;
}

/** Facade minimale de controle du cycle de vie de l'application. */
export interface GameApp {
  /** Lance la boucle de jeu. */
  start(): void;

  /** Arrete la boucle de jeu et libere les ressources d'input. */
  stop(): void;
}

/** Cree l'application en assemblant renderer, input, routeur de scenes et boucle fixe. */
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
