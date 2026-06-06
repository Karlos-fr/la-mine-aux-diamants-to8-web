# Specification fonctionnelle - Editeur de niveaux

## Objectif

Concevoir un editeur de niveaux pour le portage moderne de `La Mine aux Diamants`, capable de creer, modifier, tester et exporter des niveaux au format JSON moderne utilise par le runtime TypeScript.

L'editeur doit respecter l'esprit TO8 du jeu original tout en proposant une experience moderne, lisible et efficace. Il ne doit pas devenir un outil generique sans identite visuelle: il fait partie du projet et doit reprendre ses codes graphiques.

## Public cible

- Contributeur du projet souhaitant creer ou corriger des niveaux.
- Developpeur souhaitant tester rapidement des cas de gameplay.
- Eventuellement joueur avance, si l'editeur est expose plus tard comme outil communautaire.

## Perimetre fonctionnel

### Inclus

- Creation d'un niveau moderne depuis une grille vide ou un niveau existant.
- Edition des tuiles et entites sur une grille 16x16.
- Modification des metadonnees de niveau.
- Validation des contraintes de gameplay.
- Apercu pixel-perfect du rendu TO8.
- Test rapide du niveau dans le runtime existant.
- Export JSON compatible avec `src/assets/levels/level-XX.json`.
- Import JSON moderne existant.

### Hors perimetre initial

- Edition des assets graphiques.
- Edition cycle-perfect des donnees ASM originales.
- Conversion inverse JSON vers binaire TO8.
- Publication communautaire en ligne.
- Multi-utilisateur temps reel.
- Sauvegarde serveur.

## Format de niveau cible

L'editeur doit produire le format JSON moderne actuel:

```json
{
  "schemaVersion": 1,
  "id": "level-custom-01",
  "label": "Galerie custom",
  "width": 40,
  "height": 22,
  "tileSize": 16,
  "defaultTile": "empty",
  "time": 230,
  "scoreStep": 15,
  "requiredDiamonds": 17,
  "playerSpawn": { "x": 1, "y": 1 },
  "exit": { "x": 35, "y": 18 },
  "tiles": [],
  "entities": []
}
```

Le format doit rester sans adresses ASM. Les adresses et pointeurs historiques appartiennent aux outils d'extraction et a la documentation de provenance, pas aux niveaux modernes editables.

## Types editables

### Tuiles

- `empty`: vide.
- `earth`: terre/herbe creusable.
- `rock`: rocher.
- `diamond`: diamant.
- `border`: bordure/limite solide.
- `platform`: plateforme solide.
- `monster`: monstre standard `0x02`.
- `specialCreature`: creature speciale `0x17`.
- `transformerBlock`: bloc transformateur `0x18`.

### Entites separees

L'editeur doit afficher clairement la difference entre tuile statique et entite animee quand elle existe.

- `diamond`: diamant anime et collectable.
- `monster`: monstre standard anime.
- `specialCreature`: creature speciale animee.

Le runtime actuel derive certaines entites depuis les tuiles. L'IHM doit cacher cette complexite autant que possible, mais l'export doit rester compatible avec `level-loader.ts`.

## Metadonnees editables

- Identifiant stable du niveau.
- Libelle affiche.
- Largeur et hauteur.
- Temps initial.
- Score par diamant.
- Nombre de diamants requis.
- Position du joueur.
- Position de sortie.
- Tuile par defaut.
- Nature du niveau: normal, debug, attract, custom.

## Interface utilisateur

### Direction graphique

L'IHM doit etre `TO8 spirit modernise`.

Principes visuels:

- Fond sombre type ecran cathodique, mais plus lisible qu'une simple page noire.
- Typographie procedurale TO8 pour les titres, labels principaux, compteurs et boutons importants.
- Couleurs inspirees de la palette du jeu: noir, cyan, jaune, vert, orange, rouge, bleu.
- Bordures pixel-art nettes, mais composition moderne.
- Panneaux facon bois/HUD revisites pour les zones d'outils.
- Palette et controles accompagnes d'images SVG elegantes, lisibles et coherentes avec le theme.
- Hints visuels courts pour expliquer les outils, les tuiles et les actions principales.
- Grille pixel-perfect, sans antialiasing sur les assets.
- Micro-animations utiles: selection de tuile, curseur, validation, preview de diamant/monstre.
- Pas de look "dashboard web generique".

### Structure d'ecran

L'editeur doit proposer une disposition en trois zones:

- Zone centrale: grille editable, affichee a la taille reelle d'une tuile.
- Zone gauche: palette de tuiles et entites.
- Zone droite: proprietes du niveau, selection courante, validation et export.

En bas:

- Barre de statut indiquant coordonnees, type de cellule, erreurs, mode d'outil.
- Boutons d'action rapide: tester, importer, exporter, annuler, retablir.

### Modes d'outil

- Crayon: poser une tuile ou entite.
- Gomme: remettre a la tuile par defaut.
- Rectangle: remplir une zone.
- Selection: selectionner/deplacer une zone.
- Spawn: placer le joueur.
- Sortie: placer la sortie.
- Test: lancer le niveau dans le runtime.

### Navigation et raccourcis

- Clic gauche: appliquer l'outil.
- Clic droit: gomme selon preference utilisateur.
- Molette: zoom.
- Espace maintenu: deplacer la vue.
- `Ctrl+Z`: annuler.
- `Ctrl+Y` ou `Ctrl+Shift+Z`: retablir.
- `S`: outil spawn.
- `E`: outil sortie.
- `G`: afficher/masquer grille.
- `T`: tester le niveau.

## Rendu de la grille

L'editeur doit fusionner edition et preview.

Les briques et objets poses sur la grille doivent avoir le meme rendu que dans le jeu. Les overlays d'edition, comme selection, curseur, grille ou guides, doivent se superposer sans remplacer le rendu gameplay.

Le rendu de grille doit reutiliser autant que possible les assets et renderers existants:

- atlas de tuiles runtime;
- atlas diamants;
- atlas monstres;
- panneaux HUD si necessaire;
- font TO8 procedurale.

## Validation fonctionnelle

L'editeur doit signaler les erreurs bloquantes:

- Aucun spawn joueur.
- Plusieurs spawns joueurs.
- Aucune sortie.
- Plusieurs sorties si le format reste mono-sortie.
- Coordonnees hors grille.
- Niveau sans bordures minimales si le gameplay le requiert.
- `requiredDiamonds` superieur au nombre de diamants disponibles, sauf confirmation explicite.
- Entite placee sur une cellule incompatible.
- Tuiles inconnues ou types non supportes.

L'editeur doit signaler les avertissements:

- Niveau sans monstre.
- Niveau sans diamant.
- Temps tres bas ou tres haut.
- Spawn enferme.

## Test in-editor

L'utilisateur doit pouvoir lancer le niveau courant dans le runtime sans l'ajouter manuellement a `src/assets/levels`.

Comportement attendu:

- Le niveau edite est converti en `ModernLevelJson`.
- Le runtime charge une definition temporaire.
- Le jeu demarre directement sur ce niveau.
- Le bouton retour ramene a l'editeur en conservant l'etat.
- Le mode ghost peut etre active pour debug.

## Import / Export

### Import

- Coller un JSON.
- Charger un fichier JSON local.
- Selectionner un niveau existant du projet.
- Verifier et normaliser le JSON importe.

### Export

- Copier JSON dans le presse-papiers.
- Telecharger un fichier `.json`.
- Afficher un diff textuel si le niveau vient d'un fichier existant.
- Proposer un nom `level-custom-XX.json`.

L'export doit etre stable:

- ordre des champs constant;
- indentation lisible;
- tri optionnel des cellules par `y`, puis `x`;
- absence d'adresses ASM;
- absence de donnees derivees inutiles.

## Historique et annulation

L'editeur doit maintenir un historique local.

Operations annulables:

- pose de tuile;
- gomme;
- remplissage rectangle;
- deplacement selection;
- modification metadonnees;
- import;
- placement spawn/sortie.

L'historique peut etre limite en taille pour eviter une consommation excessive.

## Sauvegarde locale

L'editeur doit proposer une sauvegarde automatique locale.

Mecanisme initial:

- `localStorage` ou `IndexedDB`.
- Brouillon restaure au chargement.
- Bouton "abandonner le brouillon".
- Indication visible quand l'etat courant n'est pas exporte.

## Accessibilite et ergonomie

- Tous les boutons doivent avoir un label textuel.
- Les couleurs ne doivent pas etre le seul indicateur d'etat.
- Les raccourcis doivent etre visibles dans une aide.
- Le zoom doit permettre une edition confortable.
- La grille doit rester utilisable a la souris sur ecran standard.

## Architecture attendue

L'editeur doit rester separe du runtime gameplay.

Modules possibles:

- `src/editor/level-editor-scene.ts`: scene principale de l'editeur.
- `src/editor/level-editor-state.ts`: etat editable.
- `src/editor/level-editor-tools.ts`: outils crayon/gomme/rectangle/selection.
- `src/editor/level-editor-validation.ts`: validation.
- `src/editor/level-editor-serialization.ts`: import/export JSON.
- `src/editor/level-editor-renderer.ts`: rendu UI et grille.
- `src/editor/level-editor-theme.ts`: theme TO8 modernise.

Le runtime doit exposer une entree de test temporaire, mais l'editeur ne doit pas connaitre les details internes de `GameplayScene` au-dela d'une factory claire.

## Integration IHM existante

L'editeur pourra etre accessible depuis la barre debug actuelle via un bouton:

- `Editeur`

A terme, un ecran dedie peut remplacer la barre debug pour une navigation plus propre:

- Jouer.
- Choisir niveau.
- Editeur.
- Attract.
- Options debug.

## Criteres d'acceptation MVP

- L'utilisateur peut ouvrir l'editeur.
- Une grille 40x22 est visible.
- La palette permet de poser au moins: `empty`, `earth`, `rock`, `diamond`, `border`, `platform`, `monster`.
- Le spawn et la sortie sont placables.
- Les metadonnees principales sont editables.
- Le niveau peut etre exporte en JSON valide.
- Le JSON exporte peut etre recharge par le loader apres ajout au projet.
- Le niveau courant peut etre teste directement dans le runtime.
- L'interface utilise la font TO8 procedurale pour les elements principaux.
- L'apparence generale evoque le TO8 sans sacrifier la lisibilite moderne.

## Criteres d'acceptation version avancee

- Import de niveaux existants.
- Undo/redo complet.
- Outils rectangle et selection.
- Validation avec erreurs et avertissements.
- Overlays d'edition activables/desactivables sans changer le rendu gameplay des tuiles.
- Animation des diamants et monstres dans la palette.
- Sauvegarde automatique de brouillon.
- Export stable et diff lisible.
- Test avec ghost mode.

## Risques identifies

- Confusion entre tuiles et entites derivees.
- Divergence entre ce que l'editeur affiche et ce que le runtime interprete.
- Trop grande complexite UI pour un besoin de production de niveaux simple.
- Tentation de reintegrer des adresses ASM dans le format moderne.
- Validation de jouabilite trop ambitieuse pour le MVP.

## Recommandation de decoupage

### Phase 1 - MVP edition/export

- Grille.
- Palette simple.
- Spawn/sortie.
- Metadonnees.
- Export JSON.
- Validation minimale.

### Phase 2 - Integration runtime

- Import niveau existant.
- Test direct dans le jeu.
- Retour editeur.
- Ghost mode.

### Phase 3 - UX TO8 modernisee

- Theme visuel complet.
- Font TO8 procedurale.
- Palette animee.
- Panneaux style HUD/bois modernises.

### Phase 4 - Outils productivite

- Undo/redo.
- Rectangle.
- Selection/deplacement.
- Sauvegarde locale.

### Phase 5 - Validation avancee

- Detection spawn bloque.
- Coherence diamants/objectifs.
- Avertissements gameplay.

## Position produit

L'editeur doit etre un outil de creation rapide, fiable et coherent avec le portage moderne. Il doit aider a produire des niveaux jouables sans casser l'objectif principal du projet: reproduire `La Mine aux Diamants` dans une architecture moderne, en conservant une forte fidelite visuelle et comportementale au TO8.
