# Plan de realisation - Vitrine des niveaux

## Objectif

Construire une vitrine moderne des niveaux disponibles, avec une ambiance TO8 et la police utilisee par l'overlay debug. L'utilisateur doit pouvoir parcourir les niveaux, voir un apercu global rendu dynamiquement depuis les JSON, ouvrir une fiche detaillee puis lancer la partie.

Tous les niveaux sont visibles dans une premiere version. L'architecture doit cependant prevoir un futur systeme de deblocage et de progression.

## Decisions actees

- [ ] Utiliser un rendu dynamique des apercus, pas les PNG statiques de `docs/extraction/levels/`.
- [ ] Reutiliser les donnees modernes de `src/assets/levels/*.json`.
- [ ] Garder une interface HTML moderne pour la vitrine et les fiches.
- [ ] Utiliser la font TO8 deja chargee par l'application.
- [ ] Donner une ambiance TO8 cyan/bleu/noir coherente avec l'overlay debug, sans enfermer toute l'UX dans le canvas.
- [ ] Prevoir score, record, temps, progression et conditions de deblocage des maintenant, meme si les valeurs sont initialisees a un etat neutre.

## Phase 1 - Catalogue de niveaux

- [x] Creer un module dedie, par exemple `src/level-gallery/level-catalog.ts`.
- [x] Exposer une liste ordonnee de niveaux depuis `getModernLevelSource` et `LEVEL_COUNT`.
- [x] Definir un type de metadonnees de vitrine: numero, id, nom, auteur, date, temps, objectif diamants, type de source, statut.
- [x] Exclure ou marquer explicitement les niveaux speciaux/debug comme le niveau attract cache.
- [x] Ajouter les champs futurs sans logique complexe: `locked`, `unlockCondition`, `bestScore`, `bestTime`, `completed`.
- [x] Documenter les champs selon `CODE_DOCUMENTATION_CONVENTION.md`.

## Phase 2 - Modele de progression

- [x] Creer un module de progression leger, par exemple `src/level-gallery/level-progress.ts`.
- [x] Definir une structure stable pour progression locale: niveaux termines, meilleur score, meilleur temps, record.
- [x] Lire/ecrire cette progression via `localStorage` avec fallback silencieux si indisponible.
- [x] Initialiser tous les niveaux en visible/debloque pour la premiere version.
- [x] Prevoir une fonction `isLevelUnlocked(level, progress)` afin que le futur deblocage n'oblige pas a refondre l'UI.
- [x] Ne pas brancher encore la fin de niveau si cela demande une refonte gameplay; ajouter une tache ulterieure claire.

## Phase 3 - Renderer de miniatures dynamiques

- [x] Creer un renderer de preview dedie, par exemple `src/level-gallery/level-preview-renderer.ts`.
- [x] Reutiliser les atlas runtime et la logique de mapping deja presente dans `LevelEditorRenderer` quand c'est raisonnable.
- [x] Rendre tout le niveau dans un canvas miniature, avec `imageSmoothingEnabled = false`.
- [x] Calculer une echelle entiere ou pixel-perfect compatible avec la taille de carte pour eviter le flou.
- [x] Afficher spawn, sortie, tuiles, diamants, monstres et creature speciale de maniere lisible.
- [x] Gerer les niveaux larges en conservant les proportions sans deformation.
- [x] Ajouter un fallback visuel si les assets ne sont pas encore charges.

## Phase 4 - Scene vitrine

- [x] Creer une scene, par exemple `src/screens/level-gallery-scene.ts`.
- [x] Monter une racine DOM dediee a l'entree dans `enter()`.
- [x] Nettoyer tous les handlers et noeuds DOM dans `exit()`.
- [x] Afficher la liste des niveaux sous forme de cartes ou lignes denses avec preview, titre et infos essentielles.
- [x] Garder la navigation clavier minimale: fleches/tab, entree pour ouvrir la fiche, echap/retour pour quitter si applicable.
- [x] Prevoir les etats visuels: selection, hover, locked futur, completed futur.
- [x] Conserver le canvas principal disponible ou masque proprement selon le style retenu.

## Phase 5 - Fiche niveau

- [x] Ouvrir une fiche au clic sur l'apercu ou la ligne niveau.
- [x] Afficher un grand apercu dynamique du niveau.
- [x] Afficher les metadonnees: nom, auteur, date de creation, objectif diamants, temps initial.
- [x] Afficher les informations de progression: score, record, meilleur temps, statut termine/non termine.
- [x] Afficher les conditions de deblocage, meme si elles disent `Disponible`.
- [x] Ajouter un bouton `Jouer` qui lance `createGameplayScene(levelNumber)`.
- [x] Ajouter un bouton retour vers la liste.

## Phase 6 - Navigation application

- [x] Ajouter une factory `createLevelGalleryScene()` dans `src/screens/scene-factory.ts`.
- [x] Ajouter un bouton d'acces dans l'overlay debug ou le titre selon le choix UX initial.
- [x] Garder l'acces editeur existant intact.
- [x] Verifier que lancer un niveau depuis la vitrine met a jour le selecteur debug si necessaire, ou documenter que le selecteur reste un outil debug independant.
- [x] S'assurer que le retour depuis une partie terminee pourra revenir plus tard vers la vitrine sans cycle d'import fragile.

## Phase 7 - Style et integration TO8

- [x] Ajouter les styles dans `src/styles.css` ou extraire une section claire.
- [x] Utiliser la font TO8 webfont deja empaquetee.
- [x] Reprendre les couleurs cyan `#00ffff`, bleu `#0001fe`, noir transparent et motifs TO8 quand cela sert la lisibilite.
- [x] Eviter une interface trop lourde: les previews doivent rester le centre de l'ecran.
- [x] Verifier que les textes longs ne debordent pas sur mobile et desktop.
- [x] Garder les apercus nets, sans lissage navigateur.

## Phase 8 - Verification

- [ ] Lancer `npm run build`.
- [ ] Tester l'ouverture de la vitrine.
- [ ] Tester l'ouverture d'une fiche niveau.
- [ ] Tester le bouton `Jouer`.
- [ ] Verifier le rendu dynamique de plusieurs niveaux, dont un niveau large et le niveau attract/debug.
- [ ] Verifier la navigation clavier minimale.
- [ ] Verifier qu'aucun changement ne casse l'editeur ni le gameplay.

## Notes

- Le rendu dynamique doit etre concu pour servir aussi aux niveaux crees dans l'editeur.
- Les PNG de `docs/extraction/levels/` restent utiles comme reference visuelle, mais ne doivent pas devenir la source de verite.
- Les donnees de progression peuvent commencer avec des valeurs neutres; le plus important est de poser une API propre.
- Le deblocage futur doit etre une regle de progression, pas une condition dispersee dans l'UI.
