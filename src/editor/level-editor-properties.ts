/**
 * Role: Encapsule les mutations de metadonnees d'un niveau editable.
 * Scope: Applique garde-fous de taille, temps, score et objectif diamant.
 * ISO: Les metadonnees restent dans le format JSON moderne sans adresse originale.
 * Notes: L'IHM canvas peut appeler ces helpers depuis des prompts ou controles dedies.
 */

import type { ModernLevelSourceKind, ModernTileType } from "../game/level-loader";
import { type EditableLevelState } from "./level-editor-state";

/** Largeur minimale acceptee pour un niveau edite. */
export const EDITOR_MIN_LEVEL_WIDTH = 10;
/** Hauteur minimale acceptee pour un niveau edite. */
export const EDITOR_MIN_LEVEL_HEIGHT = 8;
/** Largeur maximale acceptee pour un niveau edite. */
export const EDITOR_MAX_LEVEL_WIDTH = 80;
/** Hauteur maximale acceptee pour un niveau edite. */
export const EDITOR_MAX_LEVEL_HEIGHT = 60;

/** Met a jour l'identifiant stable du niveau. */
export function setEditableLevelId(state: EditableLevelState, id: string): void {
  state.id = sanitizeIdentifier(id);
}

/** Met a jour le libelle humain du niveau. */
export function setEditableLevelLabel(state: EditableLevelState, label: string): void {
  state.label = label.trim() || state.label;
}

/** Met a jour la taille du niveau avec garde-fous non destructeurs simples. */
export function setEditableLevelSize(state: EditableLevelState, width: number, height: number): void {
  state.width = clamp(Math.floor(width), EDITOR_MIN_LEVEL_WIDTH, EDITOR_MAX_LEVEL_WIDTH);
  state.height = clamp(Math.floor(height), EDITOR_MIN_LEVEL_HEIGHT, EDITOR_MAX_LEVEL_HEIGHT);
}

/** Met a jour le temps limite. */
export function setEditableLevelTime(state: EditableLevelState, time: number): void {
  state.time = clamp(Math.floor(time), 1, 999);
}

/** Met a jour le pas de score. */
export function setEditableLevelScoreStep(state: EditableLevelState, scoreStep: number): void {
  state.scoreStep = clamp(Math.floor(scoreStep), 0, 9999);
}

/** Met a jour l'objectif de diamants. */
export function setEditableLevelRequiredDiamonds(state: EditableLevelState, requiredDiamonds: number): void {
  state.requiredDiamonds = clamp(Math.floor(requiredDiamonds), 0, 999);
}

/** Met a jour la tuile par defaut du niveau. */
export function setEditableLevelDefaultTile(state: EditableLevelState, defaultTile: ModernTileType): void {
  state.defaultTile = defaultTile;
}

/** Met a jour le type de source documentaire. */
export function setEditableLevelSourceKind(state: EditableLevelState, sourceKind: ModernLevelSourceKind | "custom"): void {
  state.sourceKind = sourceKind;
}

/** Nettoie un identifiant pour export JSON. */
function sanitizeIdentifier(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-") || "custom-level";
}

/** Contraint une valeur numerique. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
