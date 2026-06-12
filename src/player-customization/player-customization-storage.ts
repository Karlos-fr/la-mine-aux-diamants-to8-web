/**
 * Role: Persiste et expose le profil de personnalisation joueur actif.
 * Scope: Centralise localStorage, etat memoire et notifications de changement.
 * ISO: Aucun comportement gameplay original ne depend de ce stockage moderne.
 * Notes: Le stockage est optionnel; le profil original reste le fallback.
 */

import {
  DEFAULT_PLAYER_CUSTOMIZATION,
  sanitizePlayerCustomization,
  type PlayerCustomization
} from "./player-customization-model";

/** Cle localStorage versionnee du profil joueur actif. */
const PLAYER_CUSTOMIZATION_STORAGE_KEY = "la-mine-player-customization-v1";

/** Listener appele quand le profil actif change. */
export type PlayerCustomizationListener = (customization: PlayerCustomization) => void;

/** Profil actif garde en memoire pour eviter de relire le stockage a chaque frame. */
let activePlayerCustomization = loadPlayerCustomization();
/** Listeners UI/runtime interesses par les changements du profil. */
const listeners = new Set<PlayerCustomizationListener>();

/** Retourne le profil joueur actif. */
export function getActivePlayerCustomization(): PlayerCustomization {
  return activePlayerCustomization;
}

/** Remplace le profil actif, le persiste et notifie les consommateurs. */
export function setActivePlayerCustomization(customization: PlayerCustomization): void {
  activePlayerCustomization = sanitizePlayerCustomization(customization);
  savePlayerCustomization(activePlayerCustomization);
  for (const listener of listeners) {
    listener(activePlayerCustomization);
  }
}

/** Retablit le profil original extrait. */
export function resetActivePlayerCustomization(): void {
  setActivePlayerCustomization(DEFAULT_PLAYER_CUSTOMIZATION);
}

/** Abonne un consommateur aux changements du profil actif. */
export function subscribePlayerCustomization(listener: PlayerCustomizationListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Charge le profil depuis localStorage sans rendre l'app dependante du stockage. */
function loadPlayerCustomization(): PlayerCustomization {
  try {
    const raw = window.localStorage.getItem(PLAYER_CUSTOMIZATION_STORAGE_KEY);
    if (raw) {
      return sanitizePlayerCustomization(JSON.parse(raw));
    }
  } catch {
    // La personnalisation reste optionnelle si le stockage navigateur est indisponible.
  }

  return DEFAULT_PLAYER_CUSTOMIZATION;
}

/** Sauvegarde le profil actif dans localStorage si possible. */
function savePlayerCustomization(customization: PlayerCustomization): void {
  try {
    window.localStorage.setItem(PLAYER_CUSTOMIZATION_STORAGE_KEY, JSON.stringify(customization));
  } catch {
    // Le jeu reste jouable sans persistance locale.
  }
}
