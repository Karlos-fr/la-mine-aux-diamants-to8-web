# Plan d'implementation - Entites speciales 0x17 et 0x18

## Objectif

Ajouter proprement les comportements originaux associes aux tuiles `0x17` et `0x18`, en conservant un rendu et une logique proches de l'ASM, mais dans l'architecture moderne actuelle.

Le portage moderne ne doit plus traiter `0x17` et `0x18` comme de simples variantes du monstre `0x02`. Ces tuiles doivent devenir des entites ou mecanismes distincts, avec une responsabilite claire dans les donnees de niveau, la physique, le rendu et les collisions.

## Etat ASM et interpretation actuelle

- `0x02` : monstre standard deja porte, suivi via la table speciale autour de `$DAF4` et anime par complement de plan forme dans `D1BB`.
- `0x17` : entite speciale placee dans les niveaux, enregistree par `BC07` dans une table dediee autour de `$DB4F`, puis traitee separement de `0x02` dans les routines `BB24` / `CC4F`.
- `0x18` : tuile fixe placee dans les niveaux et testee explicitement dans la physique des rochers/diamants autour de `CB3B`.
- `0x19` : tuile graphique extraite, non placee directement dans les niveaux; a considerer comme artefact/frame/etat graphique a confirmer, sans implementation gameplay directe pour l'instant.

Correspondance graphique confirmee depuis `docs/extraction/sprites/objects-atlas.png` :

- `0x17` correspond a la creature bleue avec quatre carres jaunes, avec explosion en 9 diamants.
- `0x18` correspond au bloc fixe transformateur en spirale bleue, qui transforme un rocher traversant en diamant, et inversement.

## Principes d'architecture

- Garder les tuiles de grille pour le terrain statique et les mecanismes fixes.
- Garder les entites runtime pour les acteurs dynamiques, comme le monstre `0x02` et la creature speciale `0x17`.
- Ne pas ajouter de logique specifique lourde dans `GameplayScene` si elle peut vivre dans un systeme dedie.
- Reutiliser les systemes existants : loader niveau, renderer gameplay, physique rocher/diamant, collisions mortelles, explosions, HUD.
- Ne pas implementer `0x19` comme entite tant que l'ASM ne prouve pas son role gameplay.

## Phase 1 - Stabiliser la semantique des tuiles

- [x] Renommer la classification moderne de `0x17` en type logique dedie, par exemple `specialCreature`.
- [x] Renommer la classification moderne de `0x18` en type logique dedie, par exemple `transformerBlock`.
- [x] Retirer le mapping actuel qui assimile `0x17` et `0x18` a `"monster"` dans la generation des niveaux modernes.
- [x] Regenerer les JSON modernes de niveaux avec les nouveaux types logiques.
- [x] Verifier que `0x19` reste exclu des entites de niveau tant qu'il n'apparait pas dans les grilles decodees.
- [x] Documenter dans le code la preuve ASM associee a `0x17`, `0x18` et `0x19`.

## Phase 2 - Adapter le modele runtime

- [x] Ajouter un type d'entite runtime pour `specialCreature`.
- [x] Ajouter un type de tuile/mecanisme fixe pour `transformerBlock`.
- [x] Etendre les types de niveau modernes pour accepter `specialCreature` et `transformerBlock`.
- [x] Adapter le loader pour instancier `specialCreature` comme entite dynamique.
- [x] Adapter le loader pour garder `transformerBlock` comme tuile fixe dans la grille.
- [x] Garantir que le monstre standard `0x02` conserve son fonctionnement actuel sans regression.

## Phase 3 - Rendu des nouvelles tuiles et entites

- [x] Extraire ou declarer explicitement les frames graphiques utilisees pour `0x17` et `0x18`.
- [x] Afficher `transformerBlock` comme tuile statique du playfield.
- [x] Afficher `specialCreature` comme entite dynamique, separee du rendu des monstres `0x02`.
- [x] Ne pas afficher `0x19` directement dans les niveaux.
- [x] Ajouter une note de prudence sur `0x19` : frame/artefact a confirmer avant toute utilisation.
- [x] Conserver la priorite de rendu actuelle : terrain, entites physiques, monstres/creatures, joueur, effets.

## Phase 4 - Comportement du bloc transformateur 0x18

- [x] Integrer `transformerBlock` dans le systeme de physique rocher/diamant.
- [x] Reproduire le comportement ASM observe autour de `CB3B` : lorsqu'un objet tombe sur `0x18`, il traverse le bloc si la case deux lignes plus bas est vide.
- [x] Transformer un rocher traversant en diamant en chute.
- [x] Verifier via ASM si un diamant traversant doit devenir un rocher en chute.
- [x] Ne pas transformer les objets pousses horizontalement, sauf preuve ASM contraire.
- [x] Ne pas detruire le bloc `0x18` lors de la transformation.
- [x] Conserver les interactions mortelles deja implementees pour les objets en chute apres transformation.

## Phase 5 - Comportement de la creature speciale 0x17

- [x] Analyser plus finement les routines `BC07`, `BB24`, `CC4F`, `D06B` pour isoler le cycle d'activite de `0x17`.
- [x] Determiner si `0x17` se deplace comme le monstre `0x02`, reste fixe, ou suit une logique specifique.
- [x] Implementer le comportement minimal prouve par ASM.
- [x] Gerer la collision avec le joueur selon le comportement original.
- [x] Gerer la collision avec rocher/diamant tombant selon le comportement original.
- [x] Si l'explosion en 9 diamants est confirmee, reutiliser le systeme d'explosion existant avec une variante qui depose des diamants.
- [x] Ne pas coupler cette explosion au monstre standard `0x02`.

## Phase 6 - Explosion en 9 diamants

- [x] Identifier les routines ASM responsables de l'explosion/sortie de `0x17`.
- [x] Ajouter un type d'effet ou de resultat d'explosion `diamondBurst`.
- [x] Convertir les cases valides de la zone 3x3 autour de la creature en diamants.
- [x] Respecter les contraintes de grille : bordures, blocs fixes, sortie, joueur, objets actifs.
- [x] Reutiliser l'animation d'explosion existante si l'original l'utilise.
- [x] Mettre a jour les compteurs HUD si les diamants crees doivent compter comme diamants a recolter.

## Phase 7 - Integration avec collisions et gameplay

- [x] Verifier que le joueur ne traverse pas `specialCreature` hors mode ghost.
- [x] Verifier que le joueur ne traverse pas `transformerBlock` hors mode ghost si l'ASM le traite comme bloc solide.
- [x] Verifier si `transformerBlock` est franchissable par le joueur dans l'original.
- [x] Verifier que les monstres `0x02` reagissent correctement aux cases `0x17` et `0x18`.
- [x] Verifier que les rochers et diamants actifs ne creent pas de doublons de rendu pendant la transformation.
- [x] Garantir que le mode ghost reste un outil de debug et contourne aussi ces nouvelles interactions.

## Phase 8 - Nettoyage des assets et provenance

- [x] Mettre a jour les fichiers de provenance pour distinguer `0x17`, `0x18` et `0x19`.
- [x] Corriger les noms dans les metadata si les roles sont confirmes.
- [x] Eviter d'utiliser la tuile `0x19` dans le runtime tant que son role n'est pas prouve.
- [x] Ajouter une note dans les plans existants si l'ancien mapping `0x17/0x18 -> monster` devient obsolete.
- [x] Supprimer ou isoler toute logique runtime qui traite `0x17` et `0x18` comme monstre standard.

## Phase 9 - Validation manuelle ciblee

- [ ] Charger un niveau contenant `0x17` et verifier que la creature apparait au bon endroit.
- [ ] Charger un niveau contenant `0x18` et verifier que le bloc transformateur apparait au bon endroit.
- [ ] Faire tomber un rocher sur `0x18` et verifier la transformation en diamant.
- [ ] Faire tomber un diamant sur `0x18` et verifier si l'inversion en rocher est conforme.
- [ ] Declencher la destruction de `0x17` et verifier l'explosion en 9 diamants si confirmee.
- [ ] Verifier qu'aucune regression n'apparait sur le niveau 1 et le monstre standard `0x02`.

## Definition de fini

- [ ] `0x17` et `0x18` ne sont plus modelises comme `"monster"` generique.
- [ ] Le monstre standard `0x02` fonctionne comme avant.
- [ ] Le bloc transformateur `0x18` reproduit le comportement ASM de transformation des objets en chute.
- [ ] La creature speciale `0x17` dispose d'un type runtime dedie.
- [ ] L'explosion en 9 diamants est implementee uniquement si elle est confirmee par ASM ou reference video fiable.
- [ ] `0x19` reste hors gameplay direct tant que son role n'est pas confirme.
