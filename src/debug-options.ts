/**
 * Role: Expose les options de debug runtime activees depuis l'IHM.
 * Scope: Partage de petits flags developpeur entre l'interface et les scenes sans dependance DOM.
 * ISO: Ces options ne font pas partie du comportement original et doivent rester explicitement opt-in.
 * Notes: Le mode ghost sert uniquement a tester rapidement les niveaux et collisions.
 */

/** Options de debug mutables pour la session navigateur courante. */
export const debugOptions = {
  /** Rend le joueur immortel et traversant pour tester les niveaux. */
  ghostMode: false
};
