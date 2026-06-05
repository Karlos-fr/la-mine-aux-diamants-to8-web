/**
 * Role: Centralise la creation des scenes gameplay modernes.
 * Scope: Fournit des factories pour eviter que les scenes connaissent directement les transitions niveau suivant.
 * ISO: Ne porte aucune regle TO8; preserve seulement le flux de navigation moderne.
 * Notes: La scene startup reste creee directement pour eviter les cycles d'import.
 */

import type { Scene } from "../engine/scene";
import { GameplayScene } from "./gameplay-scene";

/** Cree une scene gameplay pour le niveau demande avec injection de la factory de niveau suivant. */
export function createGameplayScene(levelNumber = 1): Scene {
  return new GameplayScene(levelNumber, createNextGameplayScene);
}

/** Cree la scene gameplay qui suit le niveau courant. */
export function createNextGameplayScene(currentLevelNumber: number): Scene {
  return createGameplayScene(currentLevelNumber + 1);
}
