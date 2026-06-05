import "./styles.css";

import { mountDevAnimationGallery } from "./dev-animation-gallery";
import { createGameApp } from "./engine/game-app";
import { StartupInfogramScene } from "./screens/startup-screens";

const root = document.querySelector<HTMLElement>("#app");

if (!root) {
  throw new Error("Element #app introuvable.");
}

const mode = new URLSearchParams(window.location.search).get("mode");

if (mode === "gallery") {
  mountDevAnimationGallery(root);
} else {
  const existingCanvas = root.querySelector<HTMLCanvasElement>("#game-screen");
  const canvas = existingCanvas ?? document.createElement("canvas");
  if (!existingCanvas) {
    canvas.id = "game-screen";
    canvas.width = 320;
    canvas.height = 200;
    canvas.tabIndex = 0;
    canvas.setAttribute("aria-label", "Ecran du jeu");
    root.append(canvas);
  }

  const app = createGameApp({
    canvas,
    initialScene: () => {
      return new StartupInfogramScene();
    }
  });
  app.start();
  canvas.focus();
}
