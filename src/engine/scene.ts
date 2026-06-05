import type { InputState } from "./input";
import type { Renderer } from "./renderer";

export interface SceneContext {
  setScene(scene: Scene): void;
}

export interface Scene {
  enter?(context: SceneContext): void;
  exit?(): void;
  update(dt: number, input: InputState): void;
  render(renderer: Renderer): void;
}

export class SceneRouter implements SceneContext {
  private activeScene: Scene;
  private pendingScene: Scene | undefined;

  constructor(initialScene: Scene) {
    this.activeScene = initialScene;
    this.activeScene.enter?.(this);
  }

  setScene(scene: Scene): void {
    this.pendingScene = scene;
  }

  update(dt: number, input: InputState): void {
    this.activeScene.update(dt, input);
    this.flushPendingScene();
  }

  render(renderer: Renderer): void {
    this.activeScene.render(renderer);
  }

  private flushPendingScene(): void {
    if (!this.pendingScene) {
      return;
    }

    this.activeScene.exit?.();
    this.activeScene = this.pendingScene;
    this.pendingScene = undefined;
    this.activeScene.enter?.(this);
  }
}
