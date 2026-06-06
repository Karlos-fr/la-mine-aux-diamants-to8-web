# Plan de realisation - Editeur de niveaux

## Objectif

Implementer l'editeur de niveaux decrit dans `LEVEL_EDITOR_FUNCTIONAL_SPEC.md`, en l'integrant proprement a l'architecture moderne actuelle du portage TypeScript.

L'editeur doit produire et consommer le format JSON moderne des niveaux, reutiliser les assets/rendus du jeu pour afficher les tuiles avec le meme rendu que le runtime, et proposer une IHM `TO8 spirit modernise` avec font TO8 procedurale, SVG elegants et hints utiles.

## Contraintes d'architecture

- L'editeur vit dans `src/editor`.
- Le runtime gameplay reste separe de l'editeur.
- Le format JSON moderne reste sans adresse ASM.
- Le rendu de grille de l'editeur doit reutiliser les assets du jeu autant que possible.
- La scene d'edition doit respecter l'interface `Scene`.
- Le test d'un niveau edite doit passer par une entree runtime claire, sans ajouter manuellement le niveau a `src/assets/levels`.
- Les tuiles posees sur la grille doivent avoir le meme rendu que dans le jeu; les overlays d'edition se superposent au rendu gameplay.

## Phase 1 - Socle editor et branchement application

- [x] Creer le repertoire `src/editor`.
- [x] Creer `src/editor/level-editor-scene.ts` implementant `Scene`.
- [x] Ajouter une factory `createLevelEditorScene` dans `src/screens/scene-factory.ts` ou un module dedie.
- [x] Ajouter un bouton `Editeur` dans la barre debug de `src/main.ts`.
- [x] Brancher le bouton vers la scene editeur sans supprimer les boutons existants.
- [x] Afficher un premier ecran editeur vide avec titre, grille placeholder et panneaux lateraux.
- [x] Conserver le canvas principal `320x200` comme surface de rendu logique, sauf decision explicite contraire.

## Phase 2 - Modele editable de niveau

- [x] Creer `src/editor/level-editor-state.ts`.
- [x] Definir un `EditableLevelState` compatible avec `ModernLevelJson`.
- [x] Initialiser un niveau vide par defaut en `40x22`, `tileSize=16`, `defaultTile=empty`.
- [x] Representer `playerSpawn` et `exit` comme coordonnees uniques separees.
- [x] Representer les tuiles explicites sous forme optimisee pour l'edition.
- [x] Representer les entites derivees ou editables sans exposer les adresses ASM.
- [x] Fournir des helpers pour lire/ecrire une cellule.
- [x] Garantir que les mutations restent discretes en coordonnees de grille.

## Phase 3 - Serialization JSON moderne

- [x] Creer `src/editor/level-editor-serialization.ts`.
- [x] Implementer l'export stable vers `ModernLevelJson`.
- [x] Trier les cellules exportees par `y`, puis `x`.
- [x] Conserver l'ordre stable des champs JSON.
- [x] Exclure les donnees derivees inutiles.
- [x] Exclure toute adresse ASM.
- [x] Implementer l'import depuis un objet `ModernLevelJson`.
- [x] Normaliser les niveaux importes pour l'edition.
- [x] Ajouter des erreurs lisibles pour JSON invalide ou type inconnu.

## Phase 4 - Palette et types editables

- [x] Creer `src/editor/level-editor-palette.ts`.
- [x] Declarer les tuiles editables: `empty`, `earth`, `rock`, `diamond`, `border`, `platform`, `monster`, `specialCreature`, `transformerBlock`.
- [x] Declarer les outils: crayon, gomme, rectangle, selection, spawn, sortie, test.
- [x] Associer chaque tuile et outil a un libelle court.
- [x] Associer chaque tuile et outil a un hint explicatif.
- [x] Prevoir des icones SVG elegantes pour les outils et categories.
- [x] Distinguer visuellement tuiles, entites et marqueurs speciaux.
- [x] Selectionner une tuile ou un outil depuis la palette.

## Phase 5 - Rendu TO8 modernise de l'editeur

- [x] Creer `src/editor/level-editor-renderer.ts`.
- [x] Creer `src/editor/level-editor-theme.ts`.
- [x] Reutiliser les assets runtime via `RuntimeAssets`.
- [x] Reutiliser `TileFrameCache` ou une abstraction compatible.
- [x] Rendre la grille a la taille reelle d'une tuile.
- [x] Rendre les tuiles avec le meme visuel que le jeu.
- [x] Rendre diamants et monstres avec leurs animations de palette.
- [x] Rendre spawn et sortie comme overlays ou marqueurs coherents.
- [x] Superposer grille, curseur, selection et guides sans remplacer le rendu gameplay.
- [x] Utiliser la font TO8 procedurale pour titres, labels principaux, boutons et compteurs.
- [x] Integrer les SVG de palette et les hints visuels.
- [x] Eviter un rendu dashboard generique: conserver une direction graphique TO8 modernisee.

## Phase 6 - Interaction souris/clavier

- [x] Creer `src/editor/level-editor-tools.ts`.
- [x] Convertir les coordonnees souris vers cellule grille.
- [x] Implementer clic gauche pour appliquer l'outil courant.
- [x] Implementer clic droit comme gomme.
- [x] Implementer crayon pour poser une tuile ou entite.
- [x] Implementer gomme pour revenir a la tuile par defaut.
- [x] Implementer placement spawn.
- [x] Implementer placement sortie.
- [x] Implementer rectangle simple de remplissage.
- [x] Implementer selection simple ou reserver une structure claire si elle est differee.
- [x] Implementer zoom molette.
- [x] Implementer deplacement de vue avec espace maintenu.
- [x] Implementer raccourcis `Ctrl+Z`, `Ctrl+Y`, `S`, `E`, `G`, `T`.
- [x] Afficher coordonnees et contenu de cellule dans la barre de statut.

## Phase 7 - Historique, undo/redo et brouillon local

- [x] Ajouter un historique d'actions dans `level-editor-state`.
- [x] Rendre annulables pose de tuile, gomme, rectangle, spawn, sortie et metadonnees.
- [x] Implementer undo.
- [x] Implementer redo.
- [x] Limiter la taille de l'historique.
- [x] Ajouter sauvegarde automatique locale via `localStorage` ou `IndexedDB`.
- [x] Restaurer un brouillon au chargement de l'editeur.
- [x] Ajouter une action pour abandonner le brouillon.
- [x] Indiquer visuellement si l'etat courant n'est pas exporte.

## Phase 8 - Validation fonctionnelle

- [x] Creer `src/editor/level-editor-validation.ts`.
- [x] Signaler erreur si aucun spawn joueur.
- [x] Signaler erreur si plusieurs spawns sont representes par erreur interne.
- [x] Signaler erreur si aucune sortie.
- [x] Signaler erreur si plusieurs sorties sont representees par erreur interne.
- [x] Signaler erreur si coordonnees hors grille.
- [x] Signaler erreur si bordures minimales manquantes selon la regle retenue.
- [x] Signaler erreur si `requiredDiamonds` depasse les diamants disponibles, sauf confirmation explicite.
- [x] Signaler erreur si entite placee sur cellule incompatible.
- [x] Signaler erreur si tuile inconnue ou type non supporte.
- [x] Signaler avertissement si niveau sans monstre.
- [x] Signaler avertissement si niveau sans diamant.
- [x] Signaler avertissement si temps tres bas ou tres haut.
- [x] Signaler avertissement si spawn enferme.
- [x] Afficher erreurs et avertissements dans le panneau droit.

## Phase 9 - Metadonnees et panneau proprietes

- [x] Ajouter edition de `id`.
- [x] Ajouter edition de `label`.
- [x] Ajouter edition de `width` et `height` avec garde-fous.
- [x] Ajouter edition de `time`.
- [x] Ajouter edition de `scoreStep`.
- [x] Ajouter edition de `requiredDiamonds`.
- [x] Ajouter edition de `defaultTile`.
- [x] Ajouter edition de `source.kind` pour `normal`, `debug`, `attract`, `custom` si conserve.
- [x] Recalculer validation apres modification.
- [x] Eviter les modifications destructrices de taille sans confirmation UI claire.

## Phase 10 - Import / Export UI

- [x] Ajouter action `Importer`.
- [x] Supporter collage JSON.
- [x] Supporter chargement fichier JSON local si possible.
- [x] Supporter selection d'un niveau existant du projet.
- [x] Ajouter action `Exporter`.
- [x] Copier le JSON exporte dans le presse-papiers si autorise.
- [x] Telecharger un fichier `.json`.
- [x] Afficher un preview textuel du JSON.
- [x] Proposer un nom `level-custom-XX.json`.
- [x] Afficher un diff textuel si le niveau importe vient d'un fichier existant.

## Phase 11 - Test runtime du niveau edite

- [x] Ajouter une entree runtime temporaire pour charger un `ModernLevelJson` non importe statiquement.
- [x] Creer une factory de scene gameplay temporaire pour niveau edite.
- [x] Ajouter bouton `Tester` dans l'editeur.
- [x] Lancer le niveau courant dans `GameplayScene` ou une scene compatible.
- [x] Ajouter un retour vers l'editeur en conservant l'etat.
- [x] Permettre l'activation du ghost mode pendant le test.
- [x] Verifier que le test ne modifie pas les niveaux officiels.
- [x] Verifier que les erreurs de validation bloquantes empechent le test ou demandent confirmation explicite.

## Phase 12 - Integration visuelle finale

- [x] Appliquer le theme TO8 modernise complet.
- [x] Ajouter fond sombre cathodique subtil.
- [x] Ajouter panneaux lateraux style HUD/bois modernise.
- [x] Ajouter SVG definitifs pour palette et outils.
- [x] Ajouter hints courts et lisibles.
- [x] Ajouter micro-animations utiles: selection, curseur, validation.
- [x] Verifier lisibilite desktop.
- [x] Verifier utilisabilite minimale mobile ou petit ecran si l'editeur reste accessible.
- [x] Verifier que l'IHM ne pollue pas le rendu ISO du jeu hors editeur.

## Phase 13 - Documentation et criteres d'acceptation

- [x] Documenter l'utilisation de l'editeur dans `README.md` ou un document dedie.
- [x] Referencer `LEVEL_EDITOR_FUNCTIONAL_SPEC.md`.
- [x] Documenter le format JSON exporte.
- [x] Documenter les limites MVP.
- [x] Documenter comment tester un niveau temporaire.
- [x] Ajouter une checklist d'acceptation MVP.
- [x] Ajouter les risques connus restants.

## Phase 14 - Verification finale

- [x] Ouvrir l'editeur depuis l'IHM.
- [x] Poser les tuiles MVP: `empty`, `earth`, `rock`, `diamond`, `border`, `platform`, `monster`.
- [x] Placer spawn et sortie.
- [x] Modifier les metadonnees principales.
- [x] Exporter un JSON valide.
- [x] Reimporter le JSON exporte.
- [x] Tester le niveau dans le runtime.
- [x] Verifier que le rendu des tuiles posees correspond au jeu.
- [x] Verifier que les overlays d'edition peuvent etre affiches sans remplacer les tuiles.
- [x] Verifier que la font TO8 procedurale est visible sur les elements principaux.
- [x] Verifier qu'aucune adresse ASM n'apparait dans l'export.

## Livrables attendus

- Modules `src/editor/*`.
- Scene editeur accessible depuis l'IHM.
- Import/export JSON moderne.
- Validation fonctionnelle MVP.
- Test runtime d'un niveau temporaire.
- Theme TO8 modernise avec SVG et hints.
- Documentation d'utilisation.

## Notes de prudence

- Ne pas complexifier la validation de jouabilite au MVP.
- Ne pas reintegrer d'adresses ASM dans le JSON moderne.
- Ne pas dupliquer massivement le renderer gameplay si une abstraction reutilisable suffit.
- Ne pas rendre l'editeur dependant du mode debug permanent du jeu.
- Garder les phases committables separement pour limiter les regressions.













