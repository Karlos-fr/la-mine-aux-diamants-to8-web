import type { Scene } from "../engine/scene";
import { GameplayScene } from "./gameplay-scene";

export function createGameplayScene(levelNumber = 1): Scene {
  return new GameplayScene(levelNumber, createNextGameplayScene);
}

export function createNextGameplayScene(currentLevelNumber: number): Scene {
  return createGameplayScene(currentLevelNumber + 1);
}
