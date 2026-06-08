# Plan option mouvements fluides

## Objectif

Ajouter une option de jeu permettant d'activer ou desactiver les mouvements fluides du gameplay.

Cette option doit concerner les interpolations de deplacement:

- joueur;
- camera;
- rochers pousses;
- rochers et diamants en chute ou glissade;
- monstres et creatures speciales.

Elle ne doit pas couper les animations cycliques independantes comme le blink monstre, le diamant anime, l'idle joueur, les explosions, la sortie ou le HUD.

## Principes d'architecture

- L'option appartient a la categorie `Jeu`, pas a `Affichage`.
- La logique runtime doit rester discrete et case par case.
- Les cadences de `runtime-timing.ts` sont la reference ISO moderne et ne doivent jamais dependre de cette option.
- Desactiver l'effet doit rendre les mouvements non interpoles visuellement, sans changer le temps mis pour parcourir une case.
- Les collisions, impacts, collectes, explosions et mutations de grille doivent passer par les memes chemins que le mode fluide.
- Les tests manuels doivent couvrir les interactions dangereuses: chute sur joueur, chute sur monstre, rocher pousse, camera et collecte.

## Etat actuel resume

- Le joueur utilise `playerMove` avec `from/to`, `elapsed`, `duration`.
- La camera utilise `cameraMove` via `camera-system.ts`.
- Les objets physiques utilisent `state.fallingObjects` avec `elapsed` et `duration`.
- Les monstres sont deplaces logiquement immediatement, mais gardent `monster.movement` pour le rendu interpole.
- La progression rendue est centralisee par `getMovementRenderProgress()`.

## Plan de realisation

### Phase 1 - Creer les options de jeu persistantes

- [x] Creer un module `src/game-options.ts`.
- [x] Y definir une interface `GameOptions`.
- [x] Ajouter l'option booleenne `smoothMovement`.
- [x] Ajouter une valeur par defaut `smoothMovement: true`.
- [x] Ajouter le chargement depuis `localStorage` avec validation defensive.
- [x] Ajouter la persistance non bloquante dans `localStorage`.
- [x] Exposer `getGameOptions()`.
- [x] Exposer `isSmoothMovementEnabled()`.
- [x] Exposer `toggleSmoothMovement()`.
- [x] Documenter le fichier selon `CODE_DOCUMENTATION_CONVENTION.md`.
- [x] Lancer `npm run build`.

### Phase 2 - Ajouter l'UX dans la pop-in Options > Jeu

- [x] Ajouter le libelle de l'option dans la categorie `Jeu`.
- [x] Afficher l'etat courant: `Oui` / `Non`.
- [x] Ajouter un raccourci clavier clair pour basculer l'option quand la categorie `Jeu` est active.
- [x] Etendre `options-popin-controller.ts` sans dupliquer de logique dans les scenes.
- [x] Garder le controle simple tant qu'il n'y a qu'une option dans `Jeu`.
- [x] Mettre a jour la signature de rendu de la pop-in pour qu'elle se rafraichisse quand `smoothMovement` change.
- [x] Verifier que `Affichage` continue de piloter zoom, etirage et densite.
- [x] Lancer `npm run build`.

### Phase 3 - Centraliser les durees de reference de mouvement

- [x] Creer une facade `src/game/movement-timing.ts`.
- [x] Garder les durees sources dans `src/game/runtime-timing.ts`.
- [x] Ne pas importer `isSmoothMovementEnabled()` dans cette facade.
- [x] Ne pas ajouter de duree effective liee aux options utilisateur.
- [x] `getPlayerMoveDuration()` retourne toujours la duree de reference.
- [x] `getCameraMoveDuration()` retourne toujours la duree de reference.
- [x] `getMonsterMoveDuration()` retourne toujours la duree de reference.
- [x] `getFallingObjectMoveDuration()` retourne toujours la duree de reference.
- [x] `getPushedRockMoveDuration()` retourne toujours la duree de reference.
- [x] Exporter aussi les intervalles non concernes par l'option seulement si cela evite une incoherence d'import.
- [x] Eviter de disperser les conversions de ticks dans les blocs metier.
- [x] Documenter que `runtime-timing.ts` porte les cadences sources et que l'option de fluidification agit ailleurs.
- [x] Lancer `npm run build`.

### Phase 4 - Adapter le rendu joueur et camera

- [x] Ajouter un helper de progression visuelle qui lit `smoothMovement`.
- [x] En mode fluide, conserver l'interpolation actuelle.
- [x] En mode non fluide, rendre une position discrete sans modifier `playerMove.duration`.
- [x] Garantir que `applyPlayerArrivalEffect()` passe toujours par le meme chemin.
- [x] Verifier que la frame finale du joueur ne reste pas bloquee en mode non fluide.
- [x] Adapter `camera-system.ts` pour basculer uniquement la progression rendue du scroll.
- [x] Verifier que le viewport logique reste correctement clamp.
- [x] Lancer `npm run build`.

Notes phase 4:

- `src/game/movement-visuals.ts` transforme seulement la progression rendue.
- Quand `smoothMovement` est desactive, le rendu reste sur la cellule de depart jusqu'a l'arrivee logique.
- Les durees de `playerMove` et `cameraMove` restent issues de `movement-timing.ts`, donc de `runtime-timing.ts`.

### Phase 5 - Adapter le rendu des monstres

- [x] Garder `monster.movement.duration` identique quel que soit le mode.
- [x] En mode non fluide, placer visuellement le monstre sur une cellule discrete sans supprimer `monster.movement` trop tot.
- [x] Verifier que la tuile trace de monstre est nettoyee correctement.
- [x] Verifier que `syncMonsterEntitiesFromRuntimeState()` ne modifie pas l'ordre logique.
- [x] Verifier que le contact joueur/monstre reste logique et non dependant de l'interpolation.
- [x] Lancer `npm run build`.

Notes phase 5:

- `monster-system.ts` continue de creer `monster.movement` avec la duree de reference.
- `advanceMonsterMoves()` garde le nettoyage de trace a la fin de cette duree.
- `syncMonsterEntitiesFromRuntimeState()` utilise seulement `getMovementRenderProgress()` pour choisir la position affichee.
- Le contact joueur/monstre reste base sur `getMonsterRenderedContactCell()`, qui renvoie une cellule discrete.

### Phase 6 - Adapter le rendu rochers et diamants

- [x] Garder `startFallingObject()` sur la duree de reference.
- [x] Garder `startPushedRockMove()` sur la duree de reference.
- [x] Adapter uniquement le rendu des objets physiques pour supprimer l'interpolation visuelle si l'option est inactive.
- [x] Garantir que `completeFallingObject()` reste toujours appele.
- [x] Garantir que les impacts joueur et monstres passent par `applyFallingObjectImpact()`.
- [x] Verifier que `syncFallingObjectEntity()` ne change pas les durees ni les finalisations.
- [x] Verifier que les diamants associes a une entite visuelle se repositionnent correctement.
- [x] Verifier que les tuiles temporaires de chute/poussee ne restent pas bloquees.
- [x] Lancer `npm run build`.

Notes phase 6:

- `advanceActiveFallingObjects()` continue de finaliser uniquement apres `fallingObject.duration`.
- `syncFallingObjectEntity()` utilise `getMovementRenderProgress()` seulement pour la position affichee.
- `entity-renderer.ts` utilise aussi `getMovementRenderProgress()` pour les rochers/diamants portes par les tuiles runtime.
- Les impacts restent centralises dans `applyFallingObjectImpact()` puis `completeFallingObject()`.
- Les rochers sans entite dediee restent portes par les tuiles runtime temporaires deja posees en cible.

### Phase 7 - Nettoyage des interpolations

- [x] Rechercher les usages directs de `smoothStep()` et `lerp()` lies aux mouvements.
- [x] Supprimer ou proteger les interpolations devenues invalides en mode non fluide.
- [x] Verifier que les animations cycliques restent intactes.
- [x] Verifier que les commentaires distinguent bien logique discrete et rendu visuel.
- [x] Supprimer tout helper devenu mort apres refactor.
- [x] Lancer `npm run build`.

Notes phase 7:

- `smoothStep()` ne reste que dans `src/game/movement-visuals.ts`, le point unique de progression rendue.
- Les usages directs de `lerp()` recoivent une progression deja filtree par `getMovementRenderProgress()`.
- Les animations cycliques restent separees: diamant, monstre blink, idle joueur, explosions, sortie et HUD.
- Les commentaires de types/systems parlent des durees de pas et non plus d'une interpolation obligatoire.

### Phase 8 - Verification manuelle

- [ ] Tester avec `smoothMovement: true`.
- [ ] Tester avec `smoothMovement: false`.
- [ ] Verifier un deplacement joueur horizontal et vertical.
- [ ] Verifier une collecte de diamant.
- [ ] Verifier une entree dans la sortie.
- [ ] Verifier un scroll camera.
- [ ] Verifier un rocher pousse.
- [ ] Verifier une chute de rocher simple.
- [ ] Verifier une chute de diamant simple.
- [ ] Verifier une chute sur le joueur.
- [ ] Verifier une chute sur un monstre.
- [ ] Verifier le deplacement d'un monstre standard.
- [ ] Verifier le deplacement d'une creature speciale.
- [ ] Verifier que la pause options ne laisse pas d'interpolation avancer.
- [ ] Verifier que les options sont persistees apres rechargement.

### Phase 9 - Documentation et commit

- [ ] Mettre a jour l'audit ou la documentation locale si une decision d'architecture change.
- [ ] Verifier que les fichiers modifies respectent `CODE_DOCUMENTATION_CONVENTION.md`.
- [ ] Lancer `npm run build`.
- [ ] Controler `git status --short`.
- [ ] Ne pas inclure les fichiers hors sujet dans le commit.
- [ ] Committer avec un message explicite.
