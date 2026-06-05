/**
 * Role: Centralise les helpers logiques autour des objets physiques actifs.
 * Scope: Travaille sur la liste des mouvements rocher/diamant sans dependre du rendu ni des tuiles temporaires.
 * ISO: Les objets lourds restent resolus en cellules discretes, meme quand le rendu les interpole.
 * Notes: Ce systeme sert a decoupler progressivement la logique des marqueurs runtime `0x12/0x13`.
 */

import type { FallingObjectRuntimeState } from "../types";

/** Resultat logique d'un impact potentiel d'objet physique. */
export type PhysicalObjectImpact =
  | { readonly type: "none" }
  | { readonly type: "hitPlayer"; readonly objectKind: FallingObjectRuntimeState["kind"] }
  | { readonly type: "hitMonster"; readonly monsterId?: string };

/** Indique si un objet physique actif occupe ou cible une cellule logique. */
export function hasPhysicalObjectAtGrid(
  physicalObjects: readonly FallingObjectRuntimeState[],
  gridX: number,
  gridY: number
): boolean {
  return physicalObjects.some((physicalObject) =>
    (physicalObject.fromX === gridX && physicalObject.fromY === gridY) ||
    (physicalObject.toX === gridX && physicalObject.toY === gridY)
  );
}

/** Resout l'impact logique d'un objet physique qui atteint sa cellule cible. */
export function resolvePhysicalObjectImpact(
  physicalObject: FallingObjectRuntimeState,
  context: {
    /** Indique si le joueur occupe logiquement la cible de l'objet. */
    readonly isPlayerAtTarget: boolean;
    /** Identifiant du monstre occupant la cible, si aucun monstre n'a ete capture au depart. */
    readonly targetMonsterId?: string;
  }
): PhysicalObjectImpact {
  if (physicalObject.moveKind === "push") {
    return { type: "none" };
  }

  if (context.isPlayerAtTarget) {
    return { type: "hitPlayer", objectKind: physicalObject.kind };
  }

  const monsterId = physicalObject.targetMonsterId ?? context.targetMonsterId;
  if (monsterId) {
    return { type: "hitMonster", monsterId };
  }

  return { type: "none" };
}
