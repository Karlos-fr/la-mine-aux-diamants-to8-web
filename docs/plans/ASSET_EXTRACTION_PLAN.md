# Plan Extraction Assets - La Mine Aux Diamants

Objectif: extraire les assets depuis les binaires et le portage fonctionnel, avec une preuve de provenance pour chaque asset avant integration dans le remake TypeScript moderne.

Regle de travail: ne pas utiliser les assets des autres jeux de la disquette (`SAPHIR.*`, `FBI.*`, `ANDROIDE.*`) pour La Mine Aux Diamants. Les sources valides sont `LA_MINE.BAS`, `LMINE0.BIN`, `LMINE1.BIN`, `TABLEAU.BIN`, `KIT.BIN`, `ENTET.BIN` / `ENT.BIN`, et eventuellement `6100.BIN`, `MOTOROF.BIN`, `PR.BIN` si le boot le justifie.

## Phase 1 - Base De Preuve

- [x] Confirmer la chaine de rendu des tuiles: `TABLEAU.BIN` -> `KIT.BIN:$DA10` -> grille logique -> `KIT.BIN:$D0CC` -> `KIT.BIN:$D145`.
- [x] Identifier l'atlas de tuiles utilise par `KIT.BIN:$D145`: base `$D218`, stride `0x40`, tuiles 16x16.
- [x] Extraire le rocher depuis les binaires: `tileId 0x00`, octets `$D218-$D257`.
- [x] Valider le rocher extrait contre l'oracle visuel du portage fonctionnel: diff `0/256`.
- [x] Documenter dans un rapport de provenance les routines, adresses et fichiers sources du rocher.

## Phase 2 - Extracteur Officiel Des Tuiles

- [x] Creer un script d'extraction versionne dans `tools/`.
- [x] Lire les octets depuis `extraction/sources/runtime/memory.bin` ou depuis les blocs charges de `KIT.BIN`.
- [x] Decoder les plans TO8 320x16: 32 octets plan forme, puis 32 octets plan couleur.
- [x] Generer un atlas PNG des tuiles `$D218-$D8D7`.
- [x] Generer une planche de controle agrandie avec tous les `tileId`.
- [x] Generer des metadonnees JSON/TS: `tileId`, adresse memoire, offset source, taille, statut.
- [x] Ajouter un test qui verifie que `tileId 0x00` genere exactement le PNG rocher confirme.

## Phase 3 - Identification Des Tuiles

- [x] Decoder tous les niveaux depuis `TABLEAU.BIN` via la logique de `KIT.BIN:$DA10`.
- [x] Compter les `tileId` par niveau.
- [x] Croiser les `tileId` avec les captures du portage fonctionnel.
- [x] Identifier et confirmer les tuiles statiques: vide/fond, rocher, mur, plateforme, diamant, sortie, obstacles.
- [x] Relier chaque identification a une preuve: usage dans grille, routine de collision, scoring ou rendu.
- [x] Marquer les assets non prouves en `suspected`, jamais en `confirmed`.

## Phase 4 - Sprites Et Animations

- [x] Rechercher les routines qui modifient `tileId` ou dessinent les frames joueur.
- [x] Identifier les frames joueur dans l'atlas ou dans une autre zone binaire.
- [x] Confirmer les animations: marche gauche, marche droite, chute, attente, mort si presente.
- [x] Identifier les frames de diamant anime si l'animation existe.
- [x] Identifier les autres objets animes: ennemis, effets, transitions.
- [x] Generer des atlas modernes nommes: `player`, `diamond`, `rocks`, `objects`.
- [x] Ajouter les metadonnees d'animation: ordre des frames, duree, miroir eventuel, routine source.
- [x] Corriger l'animation du diamant par rotation de couleur via `KIT.BIN:$D1E0`.
- [x] Extraire l'animation d'explosion `0x14 -> 0x15 -> 0x16 -> 0x05` via `KIT.BIN:$CCC6`.
- [x] Confirmer l'animation du monstre: `tileId 0x02` alterne entre deux formes via `KIT.BIN:$D1BB`, qui inverse `$D298-$D2B7`.
- [x] Corriger l'hypothese invalidee: `0x18` n'est plus nomme monstre et reste `unidentified`.

## Phase 5 - Fonte Et HUD

- [x] Localiser les routines d'affichage texte/HUD.
- [x] Identifier l'adresse source de la fonte bitmap.
- [x] Extraire l'atlas de caracteres.
- [x] Reconstituer le mapping caracteres -> glyphes.
- [x] Valider la fonte sur les textes visibles: score, temps, titres, messages.
- [x] Generer une definition moderne de font bitmap typee.
- [x] Corriger le perimetre HUD: les panneaux bois gauche/droite ne sont pas des fontes mais des blocs screen.
- [x] Identifier la routine des panneaux HUD: `KIT.BIN:$C197` -> renderer `KIT.BIN:$C2D4`.
- [x] Extraire le panneau gauche depuis les tables `$C336/$C35E` et glyphes `$C3D6/$C4C6`.
- [x] Extraire le panneau droit galerie depuis les tables `$C386/$C3AE` et glyphes `$C3D6/$C4C6`.
- [x] Generer des PNG modernes et une definition TypeScript typee pour ces panneaux HUD.

## Phase 5bis - Ecrans De Demarrage

- [x] Extraire le logo Infogrames depuis `INFOGRAM.MAP` avec le decodeur `LOADP MAP`.
- [x] Recomposer l'ecran `Infogrames presente La Mine aux Diamants` en 320x200 depuis le logo extrait et la sequence boot du portage fonctionnel.
- [x] Generer les PNG modernes et metadonnees typees du premier ecran de demarrage.
- [x] Simuler `ENTET.BIN:$9367` sur les donnees `ENT.BIN:$7000-$8C62` pour reconstruire la base de l'ecran titre principal sans screenshot.
- [x] Generer les PNG modernes et metadonnees typees de la base du deuxieme ecran de demarrage.
- [x] Extraire l'animation du visage/clignement via `ENTET.BIN:$8EB6`, table `$8EF0`, glyphes `$905B`.
- [x] Extraire l'animation des etoiles/scintillements via `ENTET.BIN:$8DFF`, positions `$8E46`, indexes `$8E5C`, glyphes `$908B`.
- [x] Extraire l'animation des pieds via `ENTET.BIN:$8F2D/$8F6E`, tables `$8F92/$8F96`.
- [x] Ajouter un test de verification des animations du titre: 17 pas visage, 10 etats etoiles, 2 frames pieds, hashes et PNG.
- [x] Simuler les routines de selection/curseur titre (`ENTET.BIN:$8DDB`, `$911B/$912E/$9141`) pour les frames de menu.
- [ ] Valider les deux ecrans contre le portage fonctionnel par comparaison visuelle.

## Phase 6 - Niveaux Modernes

- [x] Extraire tous les niveaux depuis `TABLEAU.BIN`.
- [x] Decoder les en-têtes de niveau: temps, score, départ, objectifs et paramètres (avec marqueurs d'incertitude là où la sémantique reste à confirmer).
- [x] Produire des fichiers JSON/TS nommés par niveau dans `docs/extraction/levels` et `src/assets/generated/levels`.
- [x] Ajouter les positions de départ, diamants, rochers, murs et sorties.
- [x] Valider chaque niveau contre le rendu attendu via vérification automatisée (`test:levels`): dimensions, compte de cellules, présence artefacts, hash fixture et cohérence des positions.
- [x] Ajouter les fixtures visuelles niveau par niveau en PNG.

## Phase 7 - Rapport De Provenance

- [x] Creer un fichier de provenance pour chaque famille d'assets.
- [x] Pour chaque asset, indiquer: source binaire, adresse memoire, offset fichier, routine utilisatrice, statut.
- [x] Distinguer clairement `confirmed`, `suspected`, `rejected`.
- [x] Noter les assets rejetes et la raison du rejet.
- [x] Interdire l'integration dans le remake d'un asset non confirme, sauf marquage temporaire explicite.

## Phase 8 - Integration Dans Le Remake TS

- [ ] Copier uniquement les assets modernes generes: PNG, JSON, TS typés.
- [x] Supprimer toute dependance runtime aux `.bin`, `memory.bin`, `resources.json`, `disk-resources.json` et routines TO8.
- [ ] Brancher l'atlas de tuiles confirme dans le renderer moderne.
- [ ] Brancher les niveaux extraits dans le gameplay moderne.
- [ ] Brancher les sprites et animations confirmes.
- [ ] Valider le rendu 320x200 pixel-perfect.

## Phase 9 - Tests De Non Regression

- [ ] Tester que l'extracteur regenere les memes PNG depuis les memes binaires.
- [ ] Tester que le rocher extrait reste identique a la reference confirmee.
- [ ] Tester que les niveaux extraits conservent les memes `tileId`.
- [ ] Tester que le build final ne contient aucun `.bin`.
- [ ] Tester que `dist/` ne fait aucune requete vers `memory.bin`, `resources.json`, `disk/*` ou un runtime TO8.
- [ ] Ajouter des tests visuels Playwright pour titre, niveau 1 et gameplay de base.
