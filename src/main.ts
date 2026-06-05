import "./styles.css";

import { mountDevAnimationGallery } from "./dev-animation-gallery";
import { createGameApp } from "./engine/game-app";
import { StartupInfogramScene } from "./screens/startup-screens";

/**
 * Point d'entree navigateur.
 *
 * Ce module choisit entre le jeu et le viewer developpeur selon l'URL, puis
 * monte l'application dans `#app`.
 */

/** Element racine fourni par la page HTML. */
const root = document.querySelector<HTMLElement>("#app");

if (!root) {
  throw new Error("Element #app introuvable.");
}

/** Mode applicatif optionnel transmis dans la query string. */
const mode = new URLSearchParams(window.location.search).get("mode");

if (mode === "gallery") {
  mountDevAnimationGallery(root);
} else {
  /** Canvas existant eventuel, utile quand le DOM est prehydrate ou modifie en dev. */
  const existingCanvas = root.querySelector<HTMLCanvasElement>("#game-screen");

  /** Canvas logique utilise par le renderer principal. */
  const canvas = existingCanvas ?? document.createElement("canvas");
  if (!existingCanvas) {
    canvas.id = "game-screen";
    canvas.width = 320;
    canvas.height = 200;
    canvas.tabIndex = 0;
    canvas.setAttribute("aria-label", "Ecran du jeu");
    root.append(canvas);
  }

  /** Instance applicative assemblee autour de la premiere scene historique. */
  const app = createGameApp({
    canvas,
    initialScene: () => {
      return new StartupInfogramScene();
    }
  });
  app.start();
  canvas.focus();
}
