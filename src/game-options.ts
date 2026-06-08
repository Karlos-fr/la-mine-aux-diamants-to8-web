/**
 * Role: Centralise les options modernes de ressenti gameplay.
 * Scope: Persiste et expose les choix qui modifient la presentation du gameplay sans toucher aux assets TO8.
 * ISO: La logique runtime reste discrete; ces options pilotent uniquement des conforts modernes.
 * Notes: Le stockage local est optionnel et ne doit jamais empecher le jeu de demarrer.
 */

/** Configuration gameplay moderne modifiable depuis la pop-in d'options. */
export interface GameOptions {
  /** Active les interpolations visuelles des deplacements case par case. */
  smoothMovement: boolean;
}

/** Cle de persistance locale des preferences gameplay. */
const STORAGE_KEY = "la-mine-game-options";

/** Etat mutable unique des options gameplay, charge une fois au demarrage. */
const gameOptions: GameOptions = loadGameOptions();

/** Expose l'etat courant aux scenes et a l'UX d'options. */
export function getGameOptions(): GameOptions {
  return gameOptions;
}

/** Indique si les deplacements visuels doivent etre interpoles. */
export function isSmoothMovementEnabled(): boolean {
  return gameOptions.smoothMovement;
}

/** Retourne le libelle court de l'option de mouvements fluides. */
export function getSmoothMovementLabel(): string {
  return gameOptions.smoothMovement ? "Oui" : "Non";
}

/** Active ou desactive les mouvements fluides modernes. */
export function toggleSmoothMovement(): void {
  gameOptions.smoothMovement = !gameOptions.smoothMovement;
  saveGameOptions();
}

/** Recharge les options persistantes en ignorant les valeurs obsoletes ou corrompues. */
function loadGameOptions(): GameOptions {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return getDefaultGameOptions();
    }

    const value = JSON.parse(raw) as Partial<GameOptions>;
    if (typeof value.smoothMovement === "boolean") {
      return {
        smoothMovement: value.smoothMovement
      };
    }
  } catch {
    // Les options gameplay doivent rester non bloquantes.
  }

  return getDefaultGameOptions();
}

/** Persiste les options gameplay sans rendre le jeu dependant du stockage navigateur. */
function saveGameOptions(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(gameOptions));
  } catch {
    // Le stockage local est optionnel.
  }
}

/** Retourne la configuration gameplay par defaut. */
function getDefaultGameOptions(): GameOptions {
  return {
    smoothMovement: true
  };
}
