# Plan Gameplay Runtime - Collision, Terrain, Rochers Et Explosions

Objectif: construire le moteur de gameplay moderne en conservant les preuves du runtime TO8. Ce plan prend la suite du rendu niveau/entites: la grille runtime devient l'autorite pour collisions, terrain modifie, rochers, diamants, monstres et explosions.

La cible reste un portage ISO du comportement et du rendu TO8, mais dans une architecture moderne:

- les niveaux de jeu sont charges depuis `src/assets/levels/level-XX.json`;
- les preuves ASM/extraction restent dans `docs/extraction` et `docs/provenance`;
- les tile ids ASM ne doivent pas polluer le format de niveau moderne, mais peuvent rester dans la grille runtime interne;
- le gameplay reste discret case par case;
- les interpolations joueur/camera/monstres sont uniquement visuelles et ne doivent pas changer l'ordre logique original.

Convention de documentation a respecter pendant les evolutions de ce plan: [CODE_DOCUMENTATION_CONVENTION.md](../../CODE_DOCUMENTATION_CONVENTION.md).

## Principes

- La grille runtime est la source de verite logique.
- Le rendu reste une vue de la grille plus les entites animees.
- Les marqueurs internes ASM peuvent exister en grille sans etre rendus tels quels.
- Chaque regle doit etre reliee au code original avant d'etre consideree definitive.
- Le gameplay avance case par case, meme si le rendu peut etre interpole.
- Les mutations de grille visibles pendant un mouvement fluide doivent respecter l'instant logique original: une case est consommee quand le deplacement est termine, pas au debut de l'interpolation.
- Toute divergence volontaire avec le TO8 doit etre documentee comme divergence moderne temporaire ou definitive.

## Etat courant du portage

- [x] Les offsets joueur/viewport temporaires `-1/-1` ont ete retires.
- [x] Le niveau 1 est charge depuis `src/assets/levels/level-01.json`.
- [x] Les 16 JSON modernes sont generes depuis `docs/extraction/mine-levels.json`.
- [x] Les bordures externes sont explicites dans les JSON modernes.
- [x] Le spawn blink se fait sur la case de spawn runtime.
- [x] La tile de spawn temporaire est effacee apres apparition du joueur.
- [x] La camera utilise les seuils ASM connus (`4/15`, `2/7`) avec interpolation visuelle.
- [x] La recolte herbe/diamant est appliquee a l'arrivee complete du joueur sur la cellule.
- [x] L'ordre d'update gameplay est orchestre par `src/game/gameplay-runtime.ts`.
- [x] Les mutations de grille passent par `src/game/runtime-mutations.ts`.
- [x] Le rendu gameplay est separe dans `src/rendering/gameplay-renderer.ts` et ne mute pas l'etat runtime.
- [ ] Les rochers, diamants physiques, sorties et explosions restent a stabiliser par routines ASM.

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
- [x] Differer la mutation herbe/diamant jusqu'a l'arrivee complete sur la cellule cible.

## Phase 2 - Mutations de terrain et HUD

Note architecture actuelle: les anciens noms `setRuntimeTile`, `clearRuntimeTile`, `digRuntimeTile`, `collectRuntimeDiamond` ont ete remplaces par l'API dediee `RuntimeMutations`. Les intentions restent les memes, mais les mutations sont maintenant nommees par domaine: joueur, spawn, monstres et objets physiques.

- [x] Centraliser les mutations de grille dans `src/game/runtime-mutations.ts`.
- [x] Separer la decision logique d'entree (`canEnter`) de l'effet applique a l'arrivee (`onArrive`).
- [x] Garantir que les mutations actuellement declenchees par le joueur, les monstres et le spawn passent par la meme API runtime.
- [x] Mettre a jour `hud.diamonds` lors de la collecte.
- [x] Mettre a jour `hud.score` selon la valeur prouvee par l'ASM (`DA10` charge `C6FD`, niveau 1 `0x0f`; `C5C3` applique les increments et `C675` normalise le compteur decimal).
- [x] Mettre a jour `hud.time` comme compteur decimal 3 chiffres charge par `DA10` (`C723-C725`) et decremente par la logique `C63A`.
- [x] Declencher l'etat sortie/galerie quand le nombre requis de diamants est atteint.
- [x] Verifier dans l'ASM si `0x04` represente toujours une bordure ou parfois une sortie active/protegee.
- [x] Verifier si la sortie est materialisee par `0x04`, un marqueur dedie, ou une mutation apres compteur diamants.
- [x] Exposer dans le JSON moderne la sortie prouvee par l'en-tete ASM, sans confondre toutes les bordures `0x04` avec la sortie.
- [x] Autoriser la cellule de sortie uniquement quand le compteur diamants est a zero.
- [x] Remplacer l'etat `levelComplete` temporaire par une vraie transition de galerie/niveau moderne.
- [ ] Analyser la sequence visuelle/sonore originale de transition galerie/niveau pour remplacer la transition directe actuelle.

## Phase 3 - Rochers et diamants physiques

- [x] Analyser les routines de chute verticale des objets `0x00`, `0x03`, `0x12`, `0x13`.
- [x] Introduire un `FallingObjectRuntimeState` pour rochers et diamants.
- [x] Faire tomber un rocher si la case dessous est vide.
- [x] Faire tomber un diamant si la case dessous est vide.
- [x] Gerer le glissement lateral minimal: si le dessous est un objet physique statique `0x00`/`0x03` et que deux cases vides en colonne existent a gauche ou a droite, l'objet bascule sur ce cote.
- [x] Prioriser le cote du joueur quand les deux directions de glissement sont possibles.
- [x] Conserver un rendu fluide entre cases, sans changer la logique discrete.
- [x] Poser la tile finale a la fin du pas physique, avec `0x12/0x13` comme marqueurs runtime temporaires pendant le mouvement.
- [x] Verifier que `0x12` et `0x13` sont des etats runtime generes partageant la famille visuelle rocher/diamant.
- [x] Garantir que les mutations declenchees par les objets physiques passent par la meme API runtime.
- [ ] Raffiner si besoin la priorite exacte gauche/droite contre la routine ASM complete.

## Phase 4 - Poussee des rochers

- [x] Analyser les routines joueur qui poussent un rocher horizontalement.
- [x] Autoriser la poussee gauche/droite uniquement si la case derriere le rocher est vide.
- [x] Interdire la poussee verticale.
- [x] Synchroniser animation joueur, rocher et grille runtime.
- [x] Verifier si la poussee declenche un etat special `0x12`.
- [x] Conserver une poussee logique d'une case entiere, avec interpolation visuelle du rocher.

Notes phase 4:

- Preuve locale: `docs/extraction/mine-levels.json` et `tools/decode-mine-levels.mjs` referencent `KIT.BIN:$BC84 allows 0x00 movement/push behavior`.
- La poussee moderne utilise `0x12` comme tuile temporaire de rocher en mouvement, coherente avec les metadata sprites qui documentent `KIT.BIN:$CB89/$CBDD generate 0x12 from rock state`.
- La poussee reste horizontale uniquement; la case derriere le rocher doit etre `0x05` et libre d'entite/runtime object.

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

- [x] Ordonner les updates selon le runtime actuel conserve: spawn/HUD, joueur, camera, objets physiques, monstres, evenements, animations.
- [x] Eviter les doubles updates joueur d'une meme case pendant une frame via `RuntimeMutations`.
- [ ] Ajouter des marqueurs d'etat pour les cases deja traitees si l'ASM utilise des tuiles temporaires.
- [ ] Documenter chaque divergence volontaire entre ASM et portage moderne.
- [x] Definir une file d'evenements runtime par tick pour les evenements deja portes: `tileCleared`, `diamondCollected`, `exitOpened`, `levelCompleted`.
- [x] Eviter que le rendu fluide puisse modifier l'ordre des mutations logiques pour joueur, camera, monstres et objets physiques deja portes.
- [ ] Etendre la file d'evenements runtime aux explosions, morts et reset niveau quand ces gameplay seront implementes.

## Phase 8 - Sortie et progression niveau

- [ ] Analyser dans l'ASM la condition d'ouverture/sortie apres collecte des diamants requis.
- [x] Activer la sortie selon le mecanisme moderne actuel.
- [x] Detecter l'entree joueur dans la sortie active.
- [x] Enchainer vers le niveau suivant depuis les JSON modernes `level-XX.json`.
- [ ] Conserver le rendu HUD galerie/diamants ISO pendant la transition.

## Notes de prudence

- `GameplayRuntime` est maintenant l'autorite moderne pour l'ordre d'update; ne pas reintroduire un ordre concurrent dans `GameplayScene`.
- `RuntimeMutations` est maintenant l'autorite moderne pour les mutations de grille; ne pas ajouter de mutation directe dans les renderers.
- `GameplayRenderer` est lecture seule; tout nouvel effet visuel doit recevoir ses donnees depuis le runtime.
- Ne pas afficher directement `0x17` et `0x80` tant que leur rendu exact n'est pas stabilise.
- Ne pas supposer que la fixture PNG globale est le gameplay; elle reste une extraction de carte, pas la vue runtime.
- Ne pas convertir `0x01` en obstacle definitif: l'utilisateur signale que le joueur doit couper la herbe et laisser une case noire.
- Ne pas supprimer une tile collectable au debut d'un mouvement fluide: la mutation visible doit arriver quand le joueur occupe completement la case.
- Ne pas confondre JSON moderne et preuve originale: si une regle manque dans le JSON, retourner a l'ASM/extraction plutot que deviner.
