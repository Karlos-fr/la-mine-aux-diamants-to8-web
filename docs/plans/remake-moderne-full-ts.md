# Remake Moderne De La Mine Aux Diamants

Objectif: remplacer le port automatique TO8 par un vrai jeu TypeScript moderne, en rendu 320x200 pixel-perfect, sans runtime d'emulation, sans routines 6809 executees, sans disque virtuel et sans fichiers `.bin` dans le livrable final.

## Phase 1 - Inventaire Et Cadrage

- [x] Identifier les ressources utiles du port actuel: screenshots, tilemaps, sprites, fontes, palettes, sons et niveaux.
- [x] Lister les fichiers TO8 utilises uniquement comme entrees de conversion build-time.
- [x] Documenter les ecrans de reference: intro, titre, niveau 1, HUD, game over et fin.
- [x] Capturer ou confirmer les regles de gameplay observees: deplacement, collisions, collecte, score, temps, galerie et record.
- [x] Definir les criteres d'acceptation pixel-perfect pour `docs/title.png` et `docs/level-1.png`.

## Phase 2 - Nouvelle Base TypeScript

- [x] Remplacer le depot statique actuel par une app Vite + TypeScript.
- [x] Creer l'arborescence source: `src/engine`, `src/game`, `src/screens`, `src/assets`, `src/tools`.
- [x] Configurer Canvas2D en resolution logique fixe 320x200 avec upscale nearest-neighbor.
- [x] Ajouter une boucle de jeu fixe a 50 Hz, decouplee du rendu navigateur.
- [x] Implementer le routage de scenes avec `Scene.enter()`, `Scene.update(dt)` et `Scene.render(renderer)`.
- [x] Mettre en place le clavier moderne: fleches, espace, Ctrl et Entree.
- [x] Ajouter un shell minimal sans interface emulateur.

## Phase 3 - Interfaces Publiques

- [x] Definir `InputState` pour les touches et actions courantes.
- [x] Definir `Renderer` pour sprites, tuiles, rectangles, texte bitmap et effacement ecran.
- [x] Definir `TileDefinition` avec id, nom, collision, collectible et rendu.
- [x] Definir `LevelDefinition` avec dimensions, couche de tuiles, entites initiales et meta progression.
- [x] Definir `EntityState` pour joueur, objets, diamants et obstacles.
- [x] Definir `HudState` pour score, temps, record et galerie.
- [x] Definir `GameState` pour scene courante, niveau, entites, score, temps, vie et progression.

## Phase 4 - Conversion Des Assets

- [ ] Creer un script build-time de lecture des ressources TO8 existantes avec validation visuelle obligatoire.
- [ ] Convertir les sprites confirmes en atlas PNG et metadata JSON/TS.
- [ ] Convertir les fontes bitmap confirmees en atlas ou definitions TS utilisables par le renderer.
- [ ] Convertir les palettes TO8 confirmees en constantes TS nommees.
- [ ] Convertir les tilemaps confirmees en definitions de niveaux modernes.
- [ ] Produire des fixtures visuelles verifiees contre le portage fonctionnel.
- [x] Supprimer toute dependance runtime aux fichiers `.bin`.

Note: les conversions candidates precedentes de phase 4 ont ete invalidees faute de preuve visuelle et supprimees du depot.

## Phase 5 - Rendu Pixel-Perfect

- [x] Implementer le renderer Canvas2D avec ImageData ou atlas pixel-perfect.
- [ ] Extraire des atlas source-derived depuis les `.bin` disponibles avec validation visuelle obligatoire.
- [ ] Extraire des frames confirmees pour personnage, diamants et rochers.
- [ ] Extraire des glyphes/fontes confirmes depuis les `.bin`.
- [ ] Decoder `TABLEAU.BIN` avec preuve visuelle contre le portage fonctionnel.
- [ ] Brancher le renderer moderne sur des assets confirmes uniquement.
- [ ] Separer le manifeste runtime du rapport build-time d'extraction.
- [x] Verifier que le bundle `dist/` ne contient plus de reference `.bin`, `disk/`, `memory.bin` ou `resources.json`.
- [ ] Implementer le rendu du niveau 1 a partir d'une definition de niveau confirmee.
- [ ] Implementer le rendu du titre a partir d'un asset `ENTET` confirme.
- [ ] Implementer le HUD fixe apres validation visuelle.
- [ ] Verifier que les couleurs et dimensions restent conformes aux references 320x200.
- [ ] Finaliser les atlas tuiles/sprites/fontes nommes.
- [ ] Ajouter une option debug locale pour afficher la grille/tuiles sans l'exposer dans l'UI finale.

Note: les extractions et branchements Phase 5 precedents ont ete invalides visuellement et supprimes du runtime.

## Phase 6 - Gameplay Moderne

- [x] Implementer la scene intro.
- [x] Implementer la scene titre et le passage au jeu via clavier.
- [ ] Implementer le joueur: position grille/pixel, animation et deplacement.
- [ ] Implementer la vue runtime niveau 20x10 prouvee par `KIT.BIN:$D0CC`, avec bordures `tileId 0x04`.
- [ ] Implementer les entites niveau prouvees: spawn joueur, diamants animes et monstres animes.
- [ ] Implementer les collisions solides et limites de niveau.
- [ ] Implementer les diamants et la collecte.
- [ ] Implementer le score et le record.
- [ ] Implementer le timer.
- [ ] Implementer la galerie et la progression de niveau.
- [ ] Implementer les conditions de fin de niveau.
- [ ] Implementer game over et redemarrage.
- [ ] Ajuster le comportement pour correspondre aux observations du port TO8.

## Phase 7 - Tests Et Validation

- [ ] Ajouter des tests unitaires pour conversion d'assets.
- [ ] Ajouter des tests unitaires pour collisions.
- [ ] Ajouter des tests unitaires pour collecte et score.
- [ ] Ajouter des tests unitaires pour timer et progression.
- [ ] Ajouter Playwright pour ouvrir le jeu localement.
- [ ] Tester que l'ecran titre correspond a `docs/title.png`.
- [ ] Tester que le niveau 1 correspond a `docs/level-1.png`.
- [ ] Tester un parcours minimal: titre, demarrage, deplacement, collecte, collision, game over.
- [ ] Executer `npm run build`.
- [ ] Verifier qu'aucun `.bin` n'existe dans le depot final.
- [ ] Verifier qu'aucun `.bin` n'existe dans `dist/`.
- [ ] Verifier qu'aucune requete runtime ne cible `memory.bin`, `resources.json` ou `disk/*`.

## Phase 8 - Nettoyage Du Livrable

- [ ] Supprimer `memory.bin` du depot final.
- [x] Supprimer `assets/DATA_*.bin` du depot final.
- [ ] Supprimer `disk/` du depot final.
- [x] Supprimer `resources.json`, `disk-resources.json` et `resources.md` si devenus inutiles.
- [x] Supprimer le bundle automatique minifie `assets/index-*.js`.
- [ ] Supprimer le CSS genere du port automatique s'il n'est plus utilise.
- [ ] Mettre a jour `README.md` pour expliquer le remake moderne et non le port TO8 automatique.
- [ ] Documenter le workflow: conversion d'assets, lancement dev, build, tests et publication.

## Notes De Realisation

- [x] Le kit `C:\a\Projets\to8-porting-kit-v2` reste une source d'analyse et de conversion, pas un runtime final.
- [x] Les fichiers TO8 originaux peuvent etre lus pendant les scripts build-time, mais ne doivent pas etre servis au navigateur.
- [x] La fidelite visee est visuelle et gameplay, pas une reproduction octet par octet de la machine TO8.
- [ ] Toute nouvelle abstraction doit rester orientee jeu moderne: scenes, assets, entites, niveaux et rendu.
