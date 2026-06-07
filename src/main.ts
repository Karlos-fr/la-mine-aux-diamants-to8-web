import "./styles.css";

import { debugOptions } from "./debug-options";
import { createThomsonDomText, setThomsonDomText } from "./dom-thomson-text";
import { mountDevAnimationGallery } from "./dev-animation-gallery";
import { applyDisplayCanvasLayout } from "./display-options";
import { createGameApp } from "./engine/game-app";
import { getModernLevelSource, LEVEL_COUNT } from "./game/level-loader";
import { createAttractGameplayScene, createGameplayScene, createLevelEditorScene } from "./screens/scene-factory";
import { StartupInfogramScene, StartupTitleScene } from "./screens/startup-screens";

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
  applyDisplayCanvasLayout();
  window.addEventListener("resize", () => applyDisplayCanvasLayout());

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

  /** Libelle accessible du selecteur de niveau. */
  const levelSelectLabel = document.createElement("label");
  levelSelectLabel.className = "debug-level-label";
  levelSelectLabel.htmlFor = "debug-level-picker";
  setThomsonDomText(levelSelectLabel, "Niveau", { ariaLabel: "Niveau" });

  /** Liste de selection directe des niveaux modernes disponibles. */
  const levelSelectShell = document.createElement("div");
  levelSelectShell.className = "debug-level-select-shell";

  /** Bouton ouvrant la liste de niveaux custom rendue en glyphes TO8. */
  const levelPickerButton = document.createElement("button");
  levelPickerButton.id = "debug-level-picker";
  levelPickerButton.className = "debug-level-picker";
  levelPickerButton.type = "button";
  levelPickerButton.setAttribute("aria-haspopup", "listbox");
  levelPickerButton.setAttribute("aria-expanded", "false");

  /** Libelle visible du niveau selectionne dans le bouton custom. */
  const levelPickerDisplay = document.createElement("span");
  levelPickerDisplay.className = "debug-level-picker-display";

  /** Indicateur visuel de select conserve dans le style pixel TO8. */
  const levelSelectArrow = document.createElement("span");
  levelSelectArrow.className = "debug-level-select-arrow";
  levelSelectArrow.append(createThomsonDomText("v"));

  /** Menu deroulant custom pour appliquer la font procedurale a chaque niveau. */
  const levelMenu = document.createElement("div");
  levelMenu.className = "debug-level-menu";
  levelMenu.role = "listbox";
  levelMenu.hidden = true;

  /** Options de niveaux exposees par le menu debug. */
  const levelOptions: Array<{ readonly levelNumber: number; readonly label: string; readonly button: HTMLButtonElement }> = [];
  for (let levelNumber = 1; levelNumber <= LEVEL_COUNT; levelNumber += 1) {
    const levelSource = getModernLevelSource(levelNumber);
    const sourceSuffix = levelSource?.source?.kind === "attract" ? " (debug niveau cache)" : "";
    const label = levelSource ? `${levelNumber} - ${levelSource.label}${sourceSuffix}` : `Niveau ${levelNumber}`;
    const optionButton = document.createElement("button");
    optionButton.className = "debug-level-menu-option";
    optionButton.type = "button";
    optionButton.role = "option";
    optionButton.dataset.levelNumber = String(levelNumber);
    setThomsonDomText(optionButton, label, { ariaLabel: label, maxLength: 32 });
    levelMenu.append(optionButton);
    levelOptions.push({ levelNumber, label, button: optionButton });
  }

  /** Bouton debug dedie au mode attract scriptable original. */
  const attractButton = document.createElement("button");
  attractButton.className = "debug-attract-button";
  attractButton.type = "button";
  setThomsonDomText(attractButton, "Debug attract", { ariaLabel: "Debug attract" });
  attractButton.title = "Lancer directement le mode attract scriptable original.";

  /** Bouton debug ouvrant l'editeur de niveaux moderne. */
  const editorButton = document.createElement("button");
  editorButton.className = "debug-editor-button";
  editorButton.type = "button";
  setThomsonDomText(editorButton, "Editeur", { ariaLabel: "Editeur" });

  /** Bouton de debug permettant de traverser les tuiles pendant les tests. */
  const ghostButton = document.createElement("button");
  ghostButton.className = "debug-ghost-button";
  ghostButton.type = "button";
  setThomsonDomText(ghostButton, "Ghost: off", { ariaLabel: "Ghost: off" });
  ghostButton.setAttribute("aria-pressed", "false");
  ghostButton.addEventListener("click", () => {
    debugOptions.ghostMode = !debugOptions.ghostMode;
    const ghostLabel = debugOptions.ghostMode ? "Ghost: on" : "Ghost: off";
    setThomsonDomText(ghostButton, ghostLabel, { ariaLabel: ghostLabel });
    ghostButton.setAttribute("aria-pressed", String(debugOptions.ghostMode));
    canvas.focus();
  });
  levelPickerButton.append(levelPickerDisplay, levelSelectArrow);
  levelSelectShell.append(levelPickerButton, levelMenu);
  syncLevelPickerDisplay(levelOptions, levelPickerDisplay, 1);
  debugToolbar.append(levelSelectLabel, levelSelectShell, attractButton, editorButton, ghostButton);
  root.append(debugToolbar);

  /** Instance applicative assemblee autour de la premiere scene historique. */
  const app = createGameApp({
    canvas,
    initialScene: () => {
      return new StartupInfogramScene();
    }
  });
  let selectedDebugLevelNumber = 1;
  const closeLevelMenu = (): void => {
    levelMenu.hidden = true;
    levelPickerButton.setAttribute("aria-expanded", "false");
  };
  const toggleLevelMenu = (): void => {
    const nextOpen = levelMenu.hidden;
    levelMenu.hidden = !nextOpen;
    levelPickerButton.setAttribute("aria-expanded", String(nextOpen));
  };
  const selectDebugLevel = (levelNumber: number): void => {
    selectedDebugLevelNumber = levelNumber;
    syncLevelPickerDisplay(levelOptions, levelPickerDisplay, selectedDebugLevelNumber);
    syncLevelMenuSelection(levelOptions, selectedDebugLevelNumber);
    closeLevelMenu();
    app.setScene(createGameplayScene(levelNumber));
    canvas.focus();
  };

  syncLevelMenuSelection(levelOptions, selectedDebugLevelNumber);
  levelPickerButton.addEventListener("click", () => {
    toggleLevelMenu();
  });
  levelPickerButton.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeLevelMenu();
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      levelOptions.find((item) => item.levelNumber === selectedDebugLevelNumber)?.button.focus();
      levelMenu.hidden = false;
      levelPickerButton.setAttribute("aria-expanded", "true");
    }
  });
  levelOptions.forEach((option) => {
    option.button.addEventListener("click", () => {
      selectDebugLevel(option.levelNumber);
    });
  });
  document.addEventListener("click", (event) => {
    if (!debugToolbar.contains(event.target as Node)) {
      closeLevelMenu();
    }
  });
  attractButton.addEventListener("click", () => {
    closeLevelMenu();
    app.setScene(createAttractGameplayScene(() => new StartupTitleScene()));
    canvas.focus();
  });
  editorButton.addEventListener("click", () => {
    closeLevelMenu();
    app.setScene(createLevelEditorScene());
    canvas.focus();
  });
  app.start();
  canvas.focus();
}

/** Synchronise le libelle pixelise du selecteur custom avec son niveau courant. */
function syncLevelPickerDisplay(
  options: ReadonlyArray<{ readonly levelNumber: number; readonly label: string }>,
  display: HTMLElement,
  selectedLevelNumber: number
): void {
  const selectedOption = options.find((option) => option.levelNumber === selectedLevelNumber);
  setThomsonDomText(display, selectedOption?.label ?? "", { maxLength: 28 });
}

/** Met a jour l'etat aria/visuel des options du menu custom. */
function syncLevelMenuSelection(
  options: ReadonlyArray<{ readonly levelNumber: number; readonly button: HTMLButtonElement }>,
  selectedLevelNumber: number
): void {
  options.forEach((option) => {
    option.button.setAttribute("aria-selected", String(option.levelNumber === selectedLevelNumber));
  });
}
