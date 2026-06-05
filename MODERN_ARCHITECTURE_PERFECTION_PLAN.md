# Plan de finition architecture moderne pragmatique

Objectif: finir de rendre l'architecture confortable pour poursuivre le portage ISO de `La Mine aux Diamants`, sans transformer ce petit jeu en moteur generique.

Ce plan exclut volontairement les tests automatises.

## Positionnement

L'architecture actuelle est deja bonne pour continuer. Ce plan ne cherche pas une architecture "parfaite" abstraite, mais une architecture juste assez propre pour:

- garder le comportement TO8 lisible;
- eviter les bugs subtils de grille runtime;
- continuer le gameplay sans empiler de dette;
- garder `GameplayScene` comprehensible;
- ne pas sur-decouper un jeu qui reste petit.

## Ce qu'on ne cherche pas

- [ ] Creer un moteur generique multi-jeux.
- [ ] Transformer chaque system en classe complexe.
- [ ] Introduire un event bus riche si une mutation directe claire suffit.
- [ ] Decouper les constantes en dix fichiers si elles restent lisibles.
- [ ] Implementer une transition ISO non prouvee par l'ASM.

## Phase 1 - Rendre `GameplayScene` plus legere

- [ ] Extraire un `GameplayRuntime` simple qui orchestre l'ordre d'update.
- [ ] Garder `GameplayScene` responsable de la scene, du chargement assets, du render et de la navigation.
- [ ] Deplacer dans `GameplayRuntime` les appels aux systems existants.
- [ ] Garder l'ordre actuel: spawn/HUD, joueur, camera, objets physiques, monstres, animations.
- [ ] Documenter cet ordre dans le fichier runtime.
- [ ] Ne pas modifier les regles gameplay pendant cette extraction.

## Phase 2 - Clarifier les mutations de grille

- [ ] Creer une petite API `RuntimeMutations`.
- [ ] Centraliser `setTile`, `clearTile`, `dig`, `collectDiamond`, traces monstres et spawn cleanup.
- [ ] Distinguer clairement les mutations joueur, monstres et objets physiques.
- [ ] Garder les exceptions connues documentees: traces monstre `0x80`, objets tombants, spawn blink.
- [ ] Eviter que le garde-fou anti double mutation bloque la physique.
- [ ] Laisser les mutations immediates tant que c'est le comportement le plus proche du runtime actuel.

## Phase 3 - Extraire un `GameplayRenderer` unique

- [ ] Creer un `GameplayRenderer` qui orchestre grille, objets, entites et HUD.
- [ ] Deplacer `drawPlayfield` hors de `GameplayScene`.
- [ ] Deplacer `drawEntitiesAndObjects` hors de `GameplayScene`.
- [ ] Deplacer `drawFallingRockObjects` hors de `GameplayScene`.
- [ ] Deplacer le rendu HUD restant hors de `GameplayScene`.
- [ ] Garder l'ordre de rendu ISO actuel.
- [ ] Interdire toute mutation runtime dans le renderer.

## Phase 4 - Simplifier le chargement des assets runtime

- [ ] Creer un `RuntimeAssets` explicitement charge avant rendu gameplay.
- [ ] Regrouper atlas tuiles, atlas diamant, atlas monstre et panneaux HUD.
- [ ] Eviter les champs `HTMLImageElement | null` disperses dans `GameplayScene`.
- [ ] Garder `runtime-assets.ts` comme catalogue d'URLs.
- [ ] Garder les erreurs de chargement lisibles a l'ecran.
- [ ] Ne pas deplacer les assets ni supprimer de fichiers dans cette phase.

## Phase 5 - Navigation et transitions seulement si utile

- [ ] Garder `scene-factory.ts` comme point central de creation gameplay.
- [ ] Ne pas ajouter de scene de transition tant que l'ASM ne justifie pas une sequence precise.
- [ ] Si une transition galerie/niveau est prouvee, creer une scene dediee minimale.
- [ ] Clarifier plus tard game over / temps a zero quand le gameplay correspondant sera implemente.
- [ ] Ne pas bloquer le gameplay actuel sur cette phase.

## Phase 6 - Nettoyage final raisonnable

- [ ] Rechercher les facades devenues inutiles seulement apres les phases precedentes.
- [ ] Supprimer `src/game/state.ts`, `src/game/index.ts` ou `src/engine/index.ts` uniquement si leur inutilite est prouvee.
- [ ] Revoir les fallbacks de frames et documenter ceux qu'on garde.
- [ ] Mettre a jour `ARCHITECTURE_AUDIT_PLAN.md` pour pointer vers ce plan pragmatique.
- [ ] Garder les outils d'extraction et preuves intactes.

## Definition de fini pragmatique

- [ ] `GameplayScene` est courte et lit comme une orchestration.
- [ ] Les mutations de grille sont centralisees et explicites.
- [ ] Le rendu gameplay est dans un renderer dedie.
- [ ] Les assets runtime sont charges dans un objet clair.
- [ ] Les systems restent simples et proches des regles ISO.
- [ ] Aucune abstraction ne masque le comportement TO8.
- [ ] Le code reste plus facile a modifier pour terminer le gameplay qu'avant le refactor.
