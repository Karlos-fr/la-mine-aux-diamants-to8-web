/**
 * Role: Centralise la creation des scenes gameplay modernes.
 * Scope: Fournit des factories pour eviter que les scenes connaissent directement les transitions niveau suivant.
 * ISO: Ne porte aucune regle TO8; preserve seulement le flux de navigation moderne.
 * Notes: Aucune scene de transition niveau n'est ajoutee tant qu'une sequence ISO n'est pas prouvee.
 */

import type { Scene } from "../engine/scene";
import { LevelEditorScene } from "../editor/level-editor-scene";
import type { ModernLevelJson } from "../game/level-loader";
import { GameplayScene } from "./gameplay-scene";
import { LevelGalleryScene } from "./level-gallery-scene";

/** Cree une scene gameplay pour le niveau demande avec injection de la factory de niveau suivant. */
export function createGameplayScene(levelNumber = 1): Scene {
  return new GameplayScene(levelNumber, createNextGameplayScene, createGameplayScene);
}

/** Cree la scene gameplay suivante sans introduire de transition non prouvee par l'ASM. */
export function createNextGameplayScene(currentLevelNumber: number): Scene {
  return createGameplayScene(currentLevelNumber + 1);
}

/** Cree la scene de gameplay reutilisee par le mode attract original. */
export function createAttractGameplayScene(createTitleScene: () => Scene): Scene {
  return new GameplayScene(1, createNextGameplayScene, createGameplayScene, {
    mode: "attract",
    createTitleScene
  });
}

/** Cree la scene editeur de niveaux moderne. */
export function createLevelEditorScene(): Scene {
  return new LevelEditorScene();
}

/** Cree la vitrine moderne des niveaux avec lancement vers le gameplay. */
export function createLevelGalleryScene(): Scene {
  return new LevelGalleryScene(createGameplayScene);
}

/** Cree une scene gameplay temporaire depuis un JSON edite, sans modifier les niveaux officiels. */
export function createTemporaryGameplayScene(level: ModernLevelJson, createEditorScene: () => Scene): Scene {
  return new GameplayScene(0, () => createEditorScene(), () => createEditorScene(), {
    temporaryLevel: level
  });
}
