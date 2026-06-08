/**
 * Role: Orchestre l'ordre d'update du gameplay moderne.
 * Scope: Enchaine les phases runtime sans porter directement les regles gameplay ni le rendu.
 * ISO: Reproduit l'ordre macro de `KIT.BIN:$BF13`: `$CA04`, `$BC84`, `$CB07`, input, HUD et animations.
 * Notes: Les hooks restent fournis par `GameplayScene` pour limiter cette phase a une extraction d'orchestration.
 */

import type { InputState } from "../engine/input";

/** Ordre d'orchestration runtime applique a la scene courante. */
export type GameplayRuntimeMode = "normal" | "attract";

/** Famille de monstre appelee separement pour respecter `$CA04` puis `$BC84`. */
export type GameplayRuntimeMonsterKind = "monster" | "specialCreature";

/** Hooks imperatifs executes par le runtime dans un ordre stable. */
export interface GameplayRuntimeHooks {
  /** Nettoie les marqueurs temporaires du tick courant. */
  resetRuntimeTick(): void;

  /** Retourne si la sequence d'apparition du joueur est encore active. */
  isPlayerSpawning(): boolean;

  /** Avance le timer interne du spawn. */
  advanceSpawnTimer(dt: number): void;

  /** Nettoie la tuile temporaire du spawn quand l'apparition est terminee. */
  clearSpawnBlinkTileAfterSpawn(): void;

  /** Met a jour les compteurs HUD lies au temps et a l'etat du joueur. */
  advanceHudCounters(dt: number, playerSpawning: boolean): void;

  /** Traite le mouvement joueur et l'input clavier du tick. */
  advancePlayerRuntime(dt: number, input: InputState, playerSpawning: boolean): void;

  /** Avance le mouvement de camera en cours. */
  advanceCameraMove(dt: number): void;

  /** Synchronise la position pixel du joueur depuis sa position grille. */
  syncPlayerPixelPosition(): void;

  /** Avance les objets physiques comme rochers et diamants. */
  advanceFallingObjects(dt: number): void;

  /** Avance les decisions runtime d'une famille de monstres. */
  advanceMonsterRuntime(dt: number, kind: GameplayRuntimeMonsterKind): void;

  /** Avance les mouvements actifs d'une famille de monstres. */
  advanceMonsterMoves(dt: number, kind: GameplayRuntimeMonsterKind): void;

  /** Synchronise les entites visuelles des monstres. */
  syncMonsterEntitiesFromRuntimeState(): void;

  /** Consomme les evenements runtime emis par les systems. */
  consumeRuntimeEvents(): void;

  /** Avance les animations cycliques de rendu. */
  advanceRenderAnimations(dt: number): void;
}

/** Runtime minimal responsable uniquement de l'ordre d'update gameplay. */
export class GameplayRuntime {
  /** Hooks fournis par la scene gameplay. */
  private readonly hooks: GameplayRuntimeHooks;

  /** Prepare le runtime avec les hooks de scene. */
  constructor(hooks: GameplayRuntimeHooks, _mode: GameplayRuntimeMode = "normal") {
    this.hooks = hooks;
  }

  /** Execute un tick gameplay complet dans l'ordre documente et conserve. */
  update(dt: number, input: InputState): void {
    this.hooks.resetRuntimeTick();

    const playerSpawning = this.hooks.isPlayerSpawning();
    this.hooks.advanceSpawnTimer(dt);
    this.hooks.clearSpawnBlinkTileAfterSpawn();
    this.updateIsoOrder(dt, input, playerSpawning);
  }

  /** Execute l'ordre macro prouve dans `KIT.BIN:$BF13`. */
  private updateIsoOrder(dt: number, input: InputState, playerSpawning: boolean): void {
    this.hooks.advanceMonsterRuntime(dt, "monster");
    this.hooks.advanceMonsterMoves(dt, "monster");
    this.hooks.syncMonsterEntitiesFromRuntimeState();

    this.hooks.advanceMonsterRuntime(dt, "specialCreature");
    this.hooks.advanceMonsterMoves(dt, "specialCreature");
    this.hooks.syncMonsterEntitiesFromRuntimeState();

    this.hooks.advanceFallingObjects(dt);
    this.hooks.advancePlayerRuntime(dt, input, playerSpawning);
    this.hooks.advanceCameraMove(dt);
    this.hooks.syncPlayerPixelPosition();

    this.hooks.syncMonsterEntitiesFromRuntimeState();

    this.hooks.consumeRuntimeEvents();
    this.hooks.advanceHudCounters(dt, playerSpawning);
    this.hooks.advanceRenderAnimations(dt);
  }
}
