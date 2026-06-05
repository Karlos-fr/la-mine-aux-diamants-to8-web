# Plan Gameplay Runtime - Collision, Terrain, Rochers Et Explosions

Objectif: construire le moteur de gameplay moderne en conservant les preuves du runtime TO8. Ce plan prend la suite du rendu niveau/entites: la grille runtime devient l'autorite pour collisions, terrain modifie, rochers, diamants, monstres et explosions.

## Principes

- La grille runtime est la source de verite logique.
- Le rendu reste une vue de la grille plus les entites animees.
- Les marqueurs internes ASM peuvent exister en grille sans etre rendus tels quels.
- Chaque regle doit etre reliee au code original avant d'etre consideree definitive.
- Le gameplay avance case par case, meme si le rendu peut etre interpole.

## Tuiles runtime connues a stabiliser

- `0x00`: rocher.
- `0x01`: terrain/herbe a creuser, a verifier dans l'ASM avant de changer sa collision definitive.
- `0x02`: monstre detecte au chargement.
- `0x03`: diamant.
- `0x04`: bordure/limite/sortie protegee selon contexte runtime.
- `0x05`: vide.
- `0x06`: plateforme/mur statique, statut exact a verifier.
- `0x12`: etat derive de rocher en chute/glissement.
- `0x13`: etat derive de diamant en chute/glissement.
- `0x14`, `0x15`, `0x16`: explosion.
- `0x17`: marqueur runtime actif/special, utilise par les routines de monstres; ne pas afficher directement pour l'instant.
- `0x80`: marqueur runtime temporaire; ne pas afficher directement.

## Phase 1 - Moteur de collision joueur

- [x] Remplacer le clamp simple du joueur par une requete `canPlayerEnterTile(tileId)`.
- [x] Bloquer le joueur sur les bordures/limites runtime, notamment `0x04`.
- [x] Bloquer le joueur sur les rochers `0x00`, sauf cas de poussee horizontale valide.
- [x] Bloquer le joueur sur les plateformes/murs statiques apres verification de `0x06`.
- [x] Autoriser le joueur a entrer dans le vide `0x05`.
- [x] Autoriser le joueur a entrer dans le terrain/herbe `0x01`, puis convertir la case en vide `0x05`.
- [x] Autoriser le joueur a collecter un diamant `0x03`, puis convertir la case en vide `0x05` et mettre a jour score/compteurs.
- [x] Garder la logique compatible avec le mouvement fluide case-par-case deja en place.

## Phase 2 - Mutations de terrain et HUD

- [ ] Centraliser les mutations de grille dans des methodes explicites: `setRuntimeTile`, `clearRuntimeTile`, `collectRuntimeTile`.
- [x] Mettre a jour `hud.diamonds` lors de la collecte.
- [x] Mettre a jour `hud.score` selon la valeur prouvee par l'ASM (`DA10` charge `C6FD`, niveau 1 `0x0f`; `C5C3` applique les increments et `C675` normalise le compteur decimal).
- [x] Mettre a jour `hud.time` comme compteur decimal 3 chiffres charge par `DA10` (`C723-C725`) et decremente par la logique `C63A`.
- [ ] Declencher l'etat sortie/galerie quand le nombre requis de diamants est atteint.
- [ ] Verifier dans l'ASM si `0x04` represente toujours une bordure ou parfois une sortie active/protegee.

## Phase 3 - Rochers et diamants physiques

- [ ] Analyser les routines de chute/glissement des objets `0x00`, `0x03`, `0x12`, `0x13`.
- [ ] Introduire un `FallingObjectRuntimeState` pour rochers et diamants.
- [ ] Faire tomber un rocher si la case dessous est vide.
- [ ] Faire tomber un diamant si la case dessous est vide.
- [ ] Gerer le glissement lateral seulement apres preuve ASM.
- [ ] Conserver un rendu fluide entre cases, sans changer la logique discrete.

## Phase 4 - Poussee des rochers

- [ ] Analyser les routines joueur qui poussent un rocher horizontalement.
- [ ] Autoriser la poussee gauche/droite uniquement si la case derriere le rocher est vide.
- [ ] Interdire la poussee verticale.
- [ ] Synchroniser animation joueur, rocher et grille runtime.
- [ ] Verifier si la poussee declenche un etat special `0x12`.

## Phase 5 - Collisions mortelles

- [ ] Detecter chute de rocher/diamant sur joueur.
- [ ] Detecter chute de rocher/diamant sur monstre.
- [ ] Detecter contact joueur/monstre selon les routines originales.
- [ ] Distinguer collision directe, explosion, perte de vie et reset niveau.

## Phase 6 - Explosion

- [ ] Utiliser les frames `0x14`, `0x15`, `0x16`, puis `0x05`.
- [ ] Reproduire la zone d'explosion prouvee par `KIT.BIN:$CCC6/$CCFE`.
- [ ] Ne pas effacer les cellules protegees/bordures si l'ASM les preserve.
- [ ] Supprimer le monstre touche par un rocher avec explosion.
- [ ] Mettre a jour score si le code original attribue des points.

## Phase 7 - Integration boucle runtime

- [ ] Ordonner les updates selon le runtime original: joueur, terrain, objets physiques, monstres, animations, explosions.
- [ ] Eviter les doubles updates d'une meme case pendant une frame.
- [ ] Ajouter des marqueurs d'etat pour les cases deja traitees si l'ASM utilise des tuiles temporaires.
- [ ] Documenter chaque divergence volontaire entre ASM et portage moderne.

## Notes de prudence

- Ne pas afficher directement `0x17` et `0x80` tant que leur rendu exact n'est pas stabilise.
- Ne pas supposer que la fixture PNG globale est le gameplay; elle reste une extraction de carte, pas la vue runtime.
- Ne pas convertir `0x01` en obstacle definitif: l'utilisateur signale que le joueur doit couper la herbe et laisser une case noire.
