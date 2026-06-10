/**
 * Role: Centralise la navigation clavier de la pop-in d'options.
 * Scope: Met a jour l'etat minimal de la pop-in et applique les commandes d'affichage partagees.
 * ISO: Ces commandes sont une UX moderne et ne portent pas de regle runtime TO8 prouvee.
 * Notes: Le module reste volontairement petit pour eviter un framework d'options premature.
 */

import {
  cycleDisplayDensity,
  cycleDisplayRenderMode,
  cycleDisplayZoom,
  toggleDisplayStretchToViewport
} from "./display-options";
import type { InputState } from "./engine/input";
import { toggleSmoothMovement } from "./game-options";
import { OPTIONS_MENU_CATEGORIES, OPTIONS_MENU_CATEGORY_COUNT } from "./rendering/options-popin-renderer";

/** Etat minimal que les scenes doivent conserver pour la pop-in. */
export interface OptionsPopinInputState {
  /** Indique si la pop-in est visible et doit consommer l'input. */
  readonly isOpen: boolean;

  /** Index de categorie actuellement selectionne dans la pop-in. */
  readonly selectedCategoryIndex: number;
}

/** Resultat d'un tick d'input applique a la pop-in. */
export interface OptionsPopinInputResult extends OptionsPopinInputState {
  /** Indique si la scene doit interrompre son traitement normal de l'input. */
  readonly consumed: boolean;

  /** Indique si Echap vient d'ouvrir ou fermer la pop-in. */
  readonly toggledOpen: boolean;

  /** Indique si une option d'affichage a change et demande une resynchronisation de rendu. */
  readonly displayOptionsChanged: boolean;

  /** Indique si une option gameplay moderne a change. */
  readonly gameOptionsChanged: boolean;
}

/** Applique les commandes clavier communes de la pop-in d'options. */
export function updateOptionsPopinInput(
  input: InputState,
  state: OptionsPopinInputState
): OptionsPopinInputResult {
  if (input.justPressed.cancel) {
    return {
      isOpen: !state.isOpen,
      selectedCategoryIndex: state.selectedCategoryIndex,
      consumed: true,
      toggledOpen: true,
      displayOptionsChanged: false,
      gameOptionsChanged: false
    };
  }

  if (!state.isOpen) {
    return {
      ...state,
      consumed: false,
      toggledOpen: false,
      displayOptionsChanged: false,
      gameOptionsChanged: false
    };
  }

  let selectedCategoryIndex = state.selectedCategoryIndex;
  if (input.justPressed.up) {
    selectedCategoryIndex = wrapOptionCategory(selectedCategoryIndex - 1);
  }
  if (input.justPressed.down) {
    selectedCategoryIndex = wrapOptionCategory(selectedCategoryIndex + 1);
  }

  const displayOptionsChanged = updateDisplayOptionsFromInput(input, selectedCategoryIndex);
  const gameOptionsChanged = updateGameOptionsFromInput(input, selectedCategoryIndex);

  return {
    isOpen: state.isOpen,
    selectedCategoryIndex,
    consumed: true,
    toggledOpen: false,
    displayOptionsChanged,
    gameOptionsChanged
  };
}

/** Applique les raccourcis de l'onglet Affichage quand cette categorie est active. */
function updateDisplayOptionsFromInput(input: InputState, selectedCategoryIndex: number): boolean {
  if (!isDisplayOptionsCategory(selectedCategoryIndex)) {
    return false;
  }

  let changed = false;
  if (input.justPressed.left) {
    cycleDisplayZoom(-1);
    changed = true;
  }
  if (input.justPressed.right) {
    cycleDisplayZoom(1);
    changed = true;
  }
  if (input.justPressed.confirm) {
    toggleDisplayStretchToViewport();
    changed = true;
  }
  if (input.justPressed.action && !input.justPressed.confirm) {
    cycleDisplayDensity(1);
    changed = true;
  }
  if (input.justPressed.modifier) {
    cycleDisplayRenderMode(1);
    changed = true;
  }
  return changed;
}

/** Applique les raccourcis de l'onglet Jeu quand cette categorie est active. */
function updateGameOptionsFromInput(input: InputState, selectedCategoryIndex: number): boolean {
  if (!isGameOptionsCategory(selectedCategoryIndex)) {
    return false;
  }

  if (!input.justPressed.confirm) {
    return false;
  }

  toggleSmoothMovement();
  return true;
}

/** Contraint l'index de categorie avec boucle. */
function wrapOptionCategory(index: number): number {
  return (index + OPTIONS_MENU_CATEGORY_COUNT) % OPTIONS_MENU_CATEGORY_COUNT;
}

/** Indique si la categorie active pilote les options d'affichage. */
function isDisplayOptionsCategory(index: number): boolean {
  return OPTIONS_MENU_CATEGORIES[index] === "Affichage";
}

/** Indique si la categorie active pilote les options de ressenti gameplay. */
function isGameOptionsCategory(index: number): boolean {
  return OPTIONS_MENU_CATEGORIES[index] === "Jeu";
}
