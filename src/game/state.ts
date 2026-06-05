/**
 * Role: Facade de compatibilite pour l'ancien module `state`.
 * Scope: Reexporte la factory d'etat moderne sans porter de logique propre.
 * ISO: Aucune regle ISO ici; la logique vit dans `game-state-factory.ts`.
 * Notes: A supprimer seulement quand tous les imports historiques auront disparu.
 */

/** Reexports publics stables de creation d'etat gameplay. */
export {
  LEVEL1_DEFINITION,
  createGameLevelState,
  createGameShellState
} from "./game-state-factory";
