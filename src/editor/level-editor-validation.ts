/**
 * Role: Valide fonctionnellement un niveau edite.
 * Scope: Produit erreurs bloquantes et avertissements simples pour l'IHM editor.
 * ISO: Les regles restent compatibles avec le format moderne, sans reutiliser les adresses ASM.
 * Notes: La validation de jouabilite avancee est volontairement hors MVP.
 */

import type { ModernTileType } from "../game/level-loader";
import {
  getEditableExplicitTiles,
  getEditableTileAt,
  isInsideEditableLevel,
  type EditableLevelState
} from "./level-editor-state";

/** Severite d'un diagnostic editeur. */
export type LevelEditorDiagnosticSeverity = "error" | "warning";

/** Diagnostic affiche dans l'IHM editeur. */
export interface LevelEditorDiagnostic {
  /** Niveau de gravite. */
  readonly severity: LevelEditorDiagnosticSeverity;

  /** Message court et lisible. */
  readonly message: string;
}

/** Tuiles modernes supportees par l'editeur MVP. */
const SUPPORTED_TILES: readonly ModernTileType[] = [
  "empty",
  "earth",
  "rock",
  "diamond",
  "border",
  "platform",
  "monster",
  "specialCreature",
  "transformerBlock"
];

/** Valide un niveau editable et retourne les diagnostics. */
export function validateEditableLevel(state: EditableLevelState): LevelEditorDiagnostic[] {
  const diagnostics: LevelEditorDiagnostic[] = [];
  const explicitTiles = getEditableExplicitTiles(state);

  if (!isInsideEditableLevel(state, state.playerSpawn.x, state.playerSpawn.y)) {
    diagnostics.push({ severity: "error", message: "Spawn hors grille" });
  }

  if (!isInsideEditableLevel(state, state.exit.x, state.exit.y)) {
    diagnostics.push({ severity: "error", message: "Sortie hors grille" });
  }

  if (!hasMinimalBorders(state)) {
    diagnostics.push({ severity: "error", message: "Bordures incompletes" });
  }

  const diamondCount = explicitTiles.filter((cell) => cell.type === "diamond").length;
  if (state.requiredDiamonds > diamondCount) {
    diagnostics.push({ severity: "error", message: "Objectif diamants trop haut" });
  }

  if (diamondCount === 0) {
    diagnostics.push({ severity: "warning", message: "Aucun diamant" });
  }

  if (!explicitTiles.some((cell) => cell.type === "monster")) {
    diagnostics.push({ severity: "warning", message: "Aucun monstre" });
  }

  if (state.time < 30 || state.time > 999) {
    diagnostics.push({ severity: "warning", message: "Temps atypique" });
  }

  if (isSpawnEnclosed(state)) {
    diagnostics.push({ severity: "warning", message: "Spawn enferme" });
  }

  for (const cell of explicitTiles) {
    if (!isInsideEditableLevel(state, cell.x, cell.y)) {
      diagnostics.push({ severity: "error", message: `Cellule hors grille ${cell.x}/${cell.y}` });
    }
    if (!SUPPORTED_TILES.includes(cell.type)) {
      diagnostics.push({ severity: "error", message: `Tuile inconnue ${cell.type}` });
    }
  }

  for (const entity of state.entities) {
    if (!isInsideEditableLevel(state, entity.x, entity.y)) {
      diagnostics.push({ severity: "error", message: `Entite hors grille ${entity.x}/${entity.y}` });
      continue;
    }

    const tile = getEditableTileAt(state, entity.x, entity.y);
    if (tile === "border" || tile === "rock" || tile === "platform") {
      diagnostics.push({ severity: "error", message: `Entite incompatible ${entity.x}/${entity.y}` });
    }
  }

  return diagnostics;
}

/** Verifie une bordure minimale sur le contour du niveau. */
function hasMinimalBorders(state: EditableLevelState): boolean {
  for (let x = 0; x < state.width; x += 1) {
    if (getEditableTileAt(state, x, 0) !== "border") return false;
    if (getEditableTileAt(state, x, state.height - 1) !== "border") return false;
  }

  for (let y = 0; y < state.height; y += 1) {
    if (getEditableTileAt(state, 0, y) !== "border") return false;
    if (getEditableTileAt(state, state.width - 1, y) !== "border") return false;
  }

  return true;
}

/** Signale un spawn entoure de cellules solides cardinales. */
function isSpawnEnclosed(state: EditableLevelState): boolean {
  const neighbours = [
    { x: state.playerSpawn.x - 1, y: state.playerSpawn.y },
    { x: state.playerSpawn.x + 1, y: state.playerSpawn.y },
    { x: state.playerSpawn.x, y: state.playerSpawn.y - 1 },
    { x: state.playerSpawn.x, y: state.playerSpawn.y + 1 }
  ];

  return neighbours.every((cell) => !isInsideEditableLevel(state, cell.x, cell.y) || isSolidForSpawn(state, cell.x, cell.y));
}

/** Indique si une cellule bloque le spawn pour la validation simple. */
function isSolidForSpawn(state: EditableLevelState, x: number, y: number): boolean {
  const tile = getEditableTileAt(state, x, y);
  return tile === "border" || tile === "rock" || tile === "platform";
}
