/**
 * Role: Declare l'evenement DOM qui ouvre la pop-in d'options depuis l'UI globale.
 * Scope: Decouple la barre debug des scenes qui savent afficher le panneau.
 * ISO: Evenement purement UX moderne, sans impact sur la simulation TO8.
 */

/** Nom stable de l'evenement applicatif d'ouverture des options. */
export const OPEN_OPTIONS_POPIN_EVENT = "la-mine-open-options-popin";

/** Demande a la scene active compatible d'ouvrir la pop-in d'options. */
export function dispatchOpenOptionsPopinRequest(): void {
  window.dispatchEvent(new Event(OPEN_OPTIONS_POPIN_EVENT));
}
