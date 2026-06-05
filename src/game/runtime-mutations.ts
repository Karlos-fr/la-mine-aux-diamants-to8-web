/**
 * Role: Centralise les mutations immediates de la grille runtime.
 * Scope: Encapsule set/clear/dig/collect, traces monstres, objets tombants et nettoyage spawn.
 * ISO: Les mutations restent immediates comme dans le runtime actuel; seules les intentions sont nommees.
 * Notes: Les exceptions `0x80` trace monstre, objets tombants et spawn blink sont documentees ici.
 */

import type { GameState } from "./types";
import { emitRuntimeEvent } from "./runtime-events";
import type { LevelRuntimeGrid } from "./runtime-grid";

/** Options necessaires aux mutations runtime centralisees. */
export interface RuntimeMutationsOptions {
  /** Etat gameplay mutable qui recoit les evenements runtime. */
  readonly state: GameState;

  /** Grille runtime mutable qui fait autorite pour les collisions et le rendu. */
  readonly runtimeGrid: LevelRuntimeGrid;

  /** Tile id representant le vide runtime. */
  readonly emptyTileId: number;
}

/** Parametres d'une collecte de diamant runtime. */
export interface CollectDiamondMutation {
  /** Colonne de la cellule collectee. */
  readonly gridX: number;

  /** Ligne de la cellule collectee. */
  readonly gridY: number;

  /** Score emis avec l'evenement `diamondCollected`. */
  readonly score: number;

  /** Callback optionnel pour desactiver l'entite visuelle associee. */
  readonly deactivateEntity?: () => void;
}

/** API minimale de mutations nommees sur la grille runtime. */
export class RuntimeMutations {
  /** Etat gameplay mutable. */
  private readonly state: GameState;

  /** Grille runtime mutable. */
  private readonly runtimeGrid: LevelRuntimeGrid;

  /** Tile id du vide runtime. */
  private readonly emptyTileId: number;

  /** Cellules deja mutees avec evenement pendant le tick courant. */
  private readonly mutatedRuntimeTilesThisTick = new Set<string>();

  /** Prepare l'API de mutation pour un etat et une grille donnes. */
  constructor(options: RuntimeMutationsOptions) {
    this.state = options.state;
    this.runtimeGrid = options.runtimeGrid;
    this.emptyTileId = options.emptyTileId;
  }

  /** Nettoie les gardes de mutation au debut d'un tick gameplay. */
  resetTick(): void {
    this.mutatedRuntimeTilesThisTick.clear();
  }

  /** Ecrit directement une tuile runtime. */
  setTile(gridX: number, gridY: number, tileId: number): void {
    this.runtimeGrid.setTile(gridX, gridY, tileId);
  }

  /** Vide une cellule avec garde anti double-evenement pour les mutations joueur. */
  clearPlayerTile(gridX: number, gridY: number): void {
    if (!this.markRuntimeTileMutation(gridX, gridY)) {
      return;
    }

    this.setTile(gridX, gridY, this.emptyTileId);
    emitRuntimeEvent(this.state, {
      type: "tileCleared",
      gridX,
      gridY
    });
  }

  /** Vide une cellule creusable par le joueur. */
  digPlayerTile(gridX: number, gridY: number): void {
    this.clearPlayerTile(gridX, gridY);
  }

  /** Collecte un diamant et emet l'evenement de score/progression associe. */
  collectDiamond(mutation: CollectDiamondMutation): void {
    this.clearPlayerTile(mutation.gridX, mutation.gridY);
    mutation.deactivateEntity?.();
    emitRuntimeEvent(this.state, {
      type: "diamondCollected",
      gridX: mutation.gridX,
      gridY: mutation.gridY,
      score: mutation.score
    });
  }

  /** Nettoie la tuile temporaire de spawn avec la meme intention qu'un clear joueur. */
  clearSpawnBlinkTile(gridX: number, gridY: number): void {
    this.clearPlayerTile(gridX, gridY);
  }

  /** Vide une cellule pour un objet tombant sans evenement joueur ni garde anti double-clear. */
  clearFallingObjectSource(gridX: number, gridY: number): void {
    this.setTile(gridX, gridY, this.emptyTileId);
  }

  /** Place la tuile runtime temporaire d'un objet en chute. */
  setFallingObjectMovingTile(gridX: number, gridY: number, tileId: number): void {
    this.setTile(gridX, gridY, tileId);
  }

  /** Place la tuile finale d'un objet tombe. */
  completeFallingObjectTile(gridX: number, gridY: number, tileId: number): void {
    this.setTile(gridX, gridY, tileId);
  }

  /** Vide la cellule source d'un rocher pousse sans evenement joueur. */
  clearPushedRockSource(gridX: number, gridY: number): void {
    this.clearFallingObjectSource(gridX, gridY);
  }

  /** Place la tuile temporaire `0x12` d'un rocher pousse horizontalement. */
  setPushedRockMovingTile(gridX: number, gridY: number, tileId: number): void {
    this.setFallingObjectMovingTile(gridX, gridY, tileId);
  }

  /** Ecrit une tuile de monstre ou de trace `0x80` directement dans la grille. */
  setMonsterTile(gridX: number, gridY: number, tileId: number): void {
    this.setTile(gridX, gridY, tileId);
  }

  /** Enregistre une mutation evenementielle et retourne si elle est nouvelle pour ce tick. */
  private markRuntimeTileMutation(gridX: number, gridY: number): boolean {
    const key = `${gridX}:${gridY}`;
    if (this.mutatedRuntimeTilesThisTick.has(key)) {
      return false;
    }

    this.mutatedRuntimeTilesThisTick.add(key);
    return true;
  }
}
