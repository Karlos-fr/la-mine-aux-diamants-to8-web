import "./styles.css";

import { debugOptions } from "./debug-options";
import { mountDevAnimationGallery } from "./dev-animation-gallery";
import { createGameApp } from "./engine/game-app";
import { getModernLevelSource, LEVEL_COUNT } from "./game/level-loader";
import { createGameplayScene } from "./screens/scene-factory";
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

  /** Barre de controles debug gardee hors canvas pour ne pas polluer le rendu ISO. */
  const debugToolbar = document.createElement("div");
  debugToolbar.className = "debug-toolbar";

  /** Libelle accessible du select de niveau. */
  const levelSelectLabel = document.createElement("label");
  levelSelectLabel.className = "debug-level-label";
  levelSelectLabel.htmlFor = "debug-level-select";
  levelSelectLabel.textContent = "Niveau";

  /** Liste de selection directe des niveaux modernes disponibles. */
  const levelSelect = document.createElement("select");
  levelSelect.id = "debug-level-select";
  levelSelect.className = "debug-level-select";
  for (let levelNumber = 1; levelNumber <= LEVEL_COUNT; levelNumber += 1) {
    const levelSource = getModernLevelSource(levelNumber);
    const option = document.createElement("option");
    option.value = String(levelNumber);
    option.textContent = levelSource ? `${levelNumber} - ${levelSource.label}` : `Niveau ${levelNumber}`;
    levelSelect.append(option);
  }

  /** Bouton de debug permettant de traverser les tuiles pendant les tests. */
  const ghostButton = document.createElement("button");
  ghostButton.className = "debug-ghost-button";
  ghostButton.type = "button";
  ghostButton.textContent = "Ghost: off";
  ghostButton.setAttribute("aria-pressed", "false");
  ghostButton.addEventListener("click", () => {
    debugOptions.ghostMode = !debugOptions.ghostMode;
    ghostButton.textContent = debugOptions.ghostMode ? "Ghost: on" : "Ghost: off";
    ghostButton.setAttribute("aria-pressed", String(debugOptions.ghostMode));
    canvas.focus();
  });
  debugToolbar.append(levelSelectLabel, levelSelect, ghostButton);
  root.append(debugToolbar);

  /** Instance applicative assemblee autour de la premiere scene historique. */
  const app = createGameApp({
    canvas,
    initialScene: () => {
      return new StartupInfogramScene();
    }
  });
  levelSelect.addEventListener("change", () => {
    const levelNumber = Number(levelSelect.value);
    app.setScene(createGameplayScene(levelNumber));
    canvas.focus();
  });
  app.start();
  canvas.focus();
}
