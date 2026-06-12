import "./styles.css";

import { debugOptions } from "./debug-options";
import { mountDevAnimationGallery } from "./dev-animation-gallery";
import { applyDisplayCanvasLayout } from "./display-options";
import { createGameApp } from "./engine/game-app";
import { getModernLevelSource, LEVEL_COUNT } from "./game/level-loader";
import { createAttractGameplayScene, createGameplayScene, createLevelEditorScene, createLevelShowcaseScene } from "./screens/scene-factory";
import { StartupInfogramScene } from "./screens/startup-infogram-scene";
import { StartupTitleScene } from "./screens/startup-screens";
import {
  closePlayerCustomizationPanel,
  createPlayerCustomizationPanel,
  openPlayerCustomizationPanel
} from "./ui/player-customization-panel";

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

/** Parametres applicatifs optionnels transmis dans la query string. */
const routeParams = new URLSearchParams(window.location.search);
/** Mode applicatif optionnel transmis dans la query string. */
const mode = routeParams.get("mode");
/** Niveau optionnel transmis dans la query string pour ouvrir directement un niveau. */
const directLevelNumber = parseDirectLevelNumber(routeParams);

/** Cle de persistance de l'etat d'epinglage de la barre debug. */
const DEBUG_TOOLBAR_PINNED_STORAGE_KEY = "la-mine-debug-toolbar-pinned";

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
  debugToolbar.dataset.pinned = loadDebugToolbarPinned() ? "true" : "false";

  /** Icone identifiant la barre de debug. */
  const debugToolbarIcon = document.createElement("span");
  debugToolbarIcon.className = "debug-toolbar-icon";
  debugToolbarIcon.setAttribute("aria-hidden", "true");
  debugToolbarIcon.innerHTML = `
    <svg viewBox="0 0 24 24" focusable="false">
      <path d="M9 3h6v3h-1v2h4v3h2v3h-2v4h-3v3H9v-3H6v-4H4v-3h2V8h4V6H9V3Zm0 8h2v2H9v-2Zm4 0h2v2h-2v-2Zm-4 4h6v2H9v-2Z" />
    </svg>
  `;

  /** Libelle accessible du selecteur de niveau. */
  const levelSelectLabel = document.createElement("label");
  levelSelectLabel.className = "debug-level-label";
  levelSelectLabel.htmlFor = "debug-level-picker";
  levelSelectLabel.textContent = "Niveau";

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
  levelSelectArrow.textContent = "v";

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
    optionButton.textContent = label;
    optionButton.setAttribute("aria-label", label);
    levelMenu.append(optionButton);
    levelOptions.push({ levelNumber, label, button: optionButton });
  }

  /** Bouton debug dedie au mode attract scriptable original. */
  const attractButton = document.createElement("button");
  attractButton.className = "debug-attract-button";
  attractButton.type = "button";
  attractButton.textContent = "Attract mode";
  attractButton.title = "Lancer directement le mode attract scriptable original.";

  /** Bouton debug ouvrant la vitrine moderne des niveaux. */
  const showcaseButton = document.createElement("button");
  showcaseButton.className = "debug-showcase-button";
  showcaseButton.type = "button";
  showcaseButton.textContent = "Vitrine";

  /** Bouton debug ouvrant l'editeur de niveaux moderne. */
  const editorButton = document.createElement("button");
  editorButton.className = "debug-editor-button";
  editorButton.type = "button";
  editorButton.textContent = "Editeur";

  /** Bouton debug ouvrant la personnalisation moderne du personnage. */
  const characterButton = document.createElement("button");
  characterButton.className = "debug-character-button";
  characterButton.type = "button";
  characterButton.textContent = "Personnage";

  /** Bouton de debug permettant de traverser les tuiles pendant les tests. */
  const ghostButton = document.createElement("button");
  ghostButton.className = "debug-ghost-button";
  ghostButton.type = "button";
  ghostButton.textContent = "Ghost: off";
  ghostButton.setAttribute("aria-label", "Ghost: off");
  ghostButton.setAttribute("aria-pressed", "false");
  ghostButton.addEventListener("click", () => {
    debugOptions.ghostMode = !debugOptions.ghostMode;
    const ghostLabel = debugOptions.ghostMode ? "Ghost: on" : "Ghost: off";
    ghostButton.textContent = ghostLabel;
    ghostButton.setAttribute("aria-label", ghostLabel);
    ghostButton.setAttribute("aria-pressed", String(debugOptions.ghostMode));
    canvas.focus();
  });

  /** Bouton d'epinglage de la barre debug. */
  const debugToolbarPinButton = document.createElement("button");
  debugToolbarPinButton.className = "debug-toolbar-pin-button";
  debugToolbarPinButton.type = "button";
  debugToolbarPinButton.innerHTML = `
    <svg viewBox="0 0 24 24" focusable="false">
      <path d="M8 3h8v2l-2 2v4l4 4v2h-5v4h-2v-4H6v-2l4-4V7L8 5V3Z" />
    </svg>
  `;
  syncDebugToolbarPinButton(debugToolbar, debugToolbarPinButton);
  debugToolbarPinButton.addEventListener("click", () => {
    const nextPinned = debugToolbar.dataset.pinned !== "true";
    debugToolbar.dataset.pinned = nextPinned ? "true" : "false";
    saveDebugToolbarPinned(nextPinned);
    syncDebugToolbarPinButton(debugToolbar, debugToolbarPinButton);
    canvas.focus();
  });
  levelPickerButton.append(levelPickerDisplay, levelSelectArrow);
  levelSelectShell.append(levelPickerButton, levelMenu);
  let selectedDebugLevelNumber = directLevelNumber ?? 1;
  syncLevelPickerDisplay(levelOptions, levelPickerDisplay, selectedDebugLevelNumber);
  debugToolbar.append(debugToolbarIcon, levelSelectLabel, levelSelectShell, attractButton, showcaseButton, editorButton, characterButton, ghostButton, debugToolbarPinButton);
  root.append(debugToolbar);
  const playerCustomizationPanel = createPlayerCustomizationPanel();
  root.append(playerCustomizationPanel);

  /** Instance applicative assemblee autour de la premiere scene historique. */
  const app = createGameApp({
    canvas,
    initialScene: () => {
      return createInitialSceneFromRoute(mode, directLevelNumber);
    }
  });
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
  showcaseButton.addEventListener("click", () => {
    closeLevelMenu();
    app.setScene(createLevelShowcaseScene());
  });
  editorButton.addEventListener("click", () => {
    closeLevelMenu();
    closePlayerCustomizationPanel(playerCustomizationPanel);
    app.setScene(createLevelEditorScene());
    canvas.focus();
  });
  characterButton.addEventListener("click", () => {
    closeLevelMenu();
    openPlayerCustomizationPanel(playerCustomizationPanel);
  });
  if (mode === "character") {
    window.requestAnimationFrame(() => openPlayerCustomizationPanel(playerCustomizationPanel));
  }
  app.start();
  canvas.focus();
}

/** Cree la scene initiale demandee par l'URL, ou le flux startup historique par defaut. */
function createInitialSceneFromRoute(mode: string | null, levelNumber: number | null) {
  if (levelNumber !== null) {
    return createGameplayScene(levelNumber);
  }

  if (mode === "editor") {
    return createLevelEditorScene();
  }

  if (mode === "showcase") {
    return createLevelShowcaseScene();
  }

  if (mode === "attract") {
    return createAttractGameplayScene(() => new StartupTitleScene());
  }

  return new StartupInfogramScene();
}

/** Decode le parametre `level` en numero jouable valide. */
function parseDirectLevelNumber(params: URLSearchParams): number | null {
  const rawLevel = params.get("level");
  if (rawLevel === null) {
    return null;
  }

  const levelNumber = Number(rawLevel);
  if (!Number.isInteger(levelNumber) || levelNumber < 1 || levelNumber > LEVEL_COUNT) {
    return null;
  }

  return levelNumber;
}

/** Synchronise le libelle pixelise du selecteur custom avec son niveau courant. */
function syncLevelPickerDisplay(
  options: ReadonlyArray<{ readonly levelNumber: number; readonly label: string }>,
  display: HTMLElement,
  selectedLevelNumber: number
): void {
  const selectedOption = options.find((option) => option.levelNumber === selectedLevelNumber);
  display.textContent = selectedOption?.label ?? "";
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

/** Charge l'etat d'epinglage de la barre debug. */
function loadDebugToolbarPinned(): boolean {
  try {
    return window.localStorage.getItem(DEBUG_TOOLBAR_PINNED_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

/** Persiste l'etat d'epinglage de la barre debug. */
function saveDebugToolbarPinned(pinned: boolean): void {
  try {
    window.localStorage.setItem(DEBUG_TOOLBAR_PINNED_STORAGE_KEY, String(pinned));
  } catch {
    // Le stockage local est optionnel pour l'UX debug.
  }
}

/** Synchronise les libelles accessibles du bouton d'epinglage. */
function syncDebugToolbarPinButton(toolbar: HTMLElement, button: HTMLButtonElement): void {
  const pinned = toolbar.dataset.pinned === "true";
  const label = pinned ? "Masquer automatiquement la barre debug" : "Epingler la barre debug";
  button.title = label;
  button.setAttribute("aria-label", label);
  button.setAttribute("aria-pressed", String(pinned));
}
