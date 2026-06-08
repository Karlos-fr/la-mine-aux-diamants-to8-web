# Audit du panneau d'options

## Contexte

Audit du panneau d'options HTML, de ses options d'affichage et de ses points d'integration dans les scenes titre/gameplay.

Objectif: verifier que l'architecture reste proportionnee au projet, qu'elle n'accumule pas de code mort, que le decoupage reste lisible et que la documentation suit `CODE_DOCUMENTATION_CONVENTION.md`.

## Constats

### Gestion clavier dupliquee

La navigation et les commandes de la pop-in sont dupliquees entre:

- `src/screens/gameplay-scene.ts`
- `src/screens/startup-screens.ts`

Cela concerne l'ouverture/fermeture, le changement de categorie, les commandes de l'onglet Affichage et les helpers `wrapOptionCategory` / `isDisplayOptionsCategory`.

Impact: ce n'est pas encore une usine a gaz, mais chaque ajout d'option risque de demander deux modifications synchronisees.

### Restes de l'ancien rendu canvas

Le champ `visualScale` est encore present dans `OptionsPopinRenderOptions`, transmis par les scenes, mais ignore depuis le passage de la pop-in en HTML.

Les fonctions `getOptionsPopinRenderScale()` et probablement `getDisplayCssScale()` ne servent plus qu'a alimenter cette valeur ignoree.

Impact: code mort, contrat de rendu confus, intention moins lisible.

### Renderer inutile dans la pop-in HTML

`renderOptionsPopin(renderer, options)` garde un parametre `renderer` inutilise, neutralise par `void renderer`.

Impact: le module HTML semble encore dependre du renderer canvas alors que ce n'est plus le cas.

### Commentaires obsoletes

Certains commentaires ne refletent plus le modele actuel:

- `src/display-options.ts` parle encore d'un ancien modele par mode d'affichage.
- `src/rendering/options-popin-renderer.ts` indique que la pop-in est sans options actives persistantes, alors que l'onglet Affichage pilote des options persistees.

Impact: non-conformite partielle avec `CODE_DOCUMENTATION_CONVENTION.md`, surtout sur l'intention.

### Contenu de categorie trop centralise

`renderCategoryContent()` contient deja le contenu de `A propos`, `Affichage` et le fallback.

Impact: encore acceptable aujourd'hui, mais risque de grossir fortement quand Audio, Jeu et Sauvegarde recevront leurs vraies options.

## Points positifs

- L'architecture actuelle reste proportionnee au projet.
- La pop-in HTML est un bon choix pour garder un texte net avec la police Thomson.
- `display-options.ts` centralise correctement les preferences d'affichage.
- Les commentaires sont globalement presents; le probleme principal est leur fraicheur, pas leur absence.
- Le panneau n'est pas encore une usine a gaz, mais il est au bon moment pour une passe de nettoyage.

## Plan de realisation

### Phase 1 - Nettoyer le code mort

- [x] Supprimer `visualScale` de `OptionsPopinRenderOptions`.
- [x] Supprimer les passages de `visualScale` dans `GameplayScene` et `StartupTitleScene`.
- [x] Supprimer `getOptionsPopinRenderScale()` si aucune autre utilisation legitime ne reste.
- [x] Reevaluer `getDisplayCssScale()` et le supprimer s'il ne sert plus a une fonctionnalite active.
- [x] Supprimer le parametre `renderer` de `renderOptionsPopin()`.
- [x] Mettre a jour tous les appels a `renderOptionsPopin()`.
- [x] Lancer `npm run build`.

### Phase 2 - Centraliser la navigation de la pop-in

- [x] Creer un petit module dedie a la logique d'input de la pop-in, par exemple `src/options-popin-controller.ts`.
- [x] Y deplacer le changement de categorie avec boucle.
- [x] Y deplacer la detection de la categorie `Affichage`.
- [x] Y deplacer les commandes d'affichage: zoom, etirage navigateur, densite.
- [x] Conserver dans les scenes uniquement l'etat minimal: pop-in ouverte et categorie selectionnee.
- [x] Remplacer la duplication dans `GameplayScene`.
- [x] Remplacer la duplication dans `StartupTitleScene`.
- [x] Lancer `npm run build`.

### Phase 3 - Decouper le contenu des categories

- [x] Extraire le rendu du contenu `A propos` dans une fonction dediee.
- [x] Extraire le rendu du contenu `Affichage` dans une fonction dediee.
- [x] Garder un fallback clair pour les categories non encore implementees.
- [x] Verifier que le module reste simple et ne devient pas un framework d'options generique premature.
- [x] Lancer `npm run build`.

### Phase 4 - Mettre la documentation a jour

- [x] Corriger l'entete de `src/display-options.ts` pour decrire le modele actuel: zoom, etirage navigateur, densite.
- [x] Corriger l'entete de `src/rendering/options-popin-renderer.ts` pour indiquer que la pop-in rend aussi des options actives.
- [x] Verifier que chaque nouveau helper ou export respecte `CODE_DOCUMENTATION_CONVENTION.md`.
- [x] Supprimer les commentaires qui paraphrasent le code sans expliquer l'intention.
- [x] Lancer `npm run build`.

### Phase 5 - Verification finale

- [ ] Tester l'ouverture/fermeture de la pop-in depuis le titre.
- [ ] Tester l'ouverture/fermeture de la pop-in en cours de jeu.
- [ ] Verifier que le jeu reste en pause quand la pop-in est ouverte.
- [ ] Tester les commandes Affichage: gauche/droite, entree, Ctrl.
- [ ] Verifier que les libelles se mettent a jour dans la pop-in.
- [ ] Verifier que le panneau ne deborde pas dans `Affichage` et `A propos`.
- [ ] Verifier que les fichiers hors sujet ne sont pas inclus dans un commit eventuel.
