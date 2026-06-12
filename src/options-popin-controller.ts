/**
 * Role: Centralise la navigation clavier de la pop-in d'options.
 * Scope: Met a jour l'etat minimal de la pop-in sans piloter directement les options.
 * ISO: Ces commandes sont une UX moderne et ne portent pas de regle runtime TO8 prouvee.
 * Notes: Le module reste volontairement petit pour eviter un framework d'options premature.
 */

import type { InputState } from "./engine/input";
import { OPTIONS_MENU_CATEGORY_COUNT } from "./rendering/options-popin-renderer";

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

  return {
    isOpen: state.isOpen,
    selectedCategoryIndex,
    consumed: true,
    toggledOpen: false,
    displayOptionsChanged: false,
    gameOptionsChanged: false
  };
}

/** Contraint l'index de categorie avec boucle. */
function wrapOptionCategory(index: number): number {
  return (index + OPTIONS_MENU_CATEGORY_COUNT) % OPTIONS_MENU_CATEGORY_COUNT;
}
