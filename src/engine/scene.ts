import type { InputState } from "./input";
import type { Size2D } from "./render-types";
import type { Renderer } from "./renderer";

/**
 * Contrats de scenes et routeur minimal.
 *
 * Le moteur conserve une seule scene active et applique les transitions apres
 * l'update pour eviter de changer de scene au milieu d'une frame.
 */

/** Contexte fourni aux scenes pour demander une transition. */
export interface SceneContext {
  /** Programme la scene qui deviendra active apres l'update courante. */
  setScene(scene: Scene): void;
}

/** Interface commune a toutes les scenes du jeu. */
export interface Scene {
  /** Hook appele quand la scene devient active. */
  enter?(context: SceneContext): void;

  /** Hook appele avant que la scene soit remplacee. */
  exit?(): void;

  /** Met a jour la scene avec le delta fixe et l'etat d'input courant. */
  update(dt: number, input: InputState): void;

  /** Retourne une resolution logique specifique pour la scene, si necessaire. */
  getRenderSize?(): Size2D;

  /** Dessine la scene sur le renderer logique. */
  render(renderer: Renderer): void;
}

/** Callback appele quand le routeur installe une nouvelle scene active. */
export type SceneChangeHandler = (scene: Scene) => void;

/** Routeur responsable de la scene active et des transitions differees. */
export class SceneRouter implements SceneContext {
  /** Scene actuellement mise a jour et rendue. */
  private activeScene: Scene;

  /** Scene programmee pour remplacer l'actuelle apres l'update. */
  private pendingScene: Scene | undefined;

  /** Installe la premiere scene et appelle son hook d'entree. */
  constructor(initialScene: Scene, private readonly onSceneChange?: SceneChangeHandler) {
    this.activeScene = initialScene;
    this.activeScene.enter?.(this);
    this.onSceneChange?.(this.activeScene);
  }

  /** Programme une transition de scene pour la fin de l'update courante. */
  setScene(scene: Scene): void {
    this.pendingScene = scene;
  }

  /** Met a jour la scene active puis applique une transition eventuelle. */
  update(dt: number, input: InputState): void {
    this.activeScene.update(dt, input);
    this.flushPendingScene();
  }

  /** Rend la scene active. */
  render(renderer: Renderer): void {
    const renderSize = this.activeScene.getRenderSize?.();
    if (renderSize) {
      renderer.setLogicalSize(renderSize.width, renderSize.height);
    } else {
      renderer.resetLogicalSize();
    }
    this.activeScene.render(renderer);
  }

  /** Remplace la scene active si une transition a ete demandee. */
  private flushPendingScene(): void {
    if (!this.pendingScene) {
      return;
    }

    this.activeScene.exit?.();
    this.activeScene = this.pendingScene;
    this.pendingScene = undefined;
    this.activeScene.enter?.(this);
    this.onSceneChange?.(this.activeScene);
  }
}
