# Utilisation de l'editeur de niveaux

## Objectif

L'editeur de niveaux permet de creer ou modifier un niveau au format JSON moderne du portage TypeScript de `La Mine aux Diamants`.

Il ne manipule pas les adresses ASM originales et ne modifie pas les niveaux officiels tant qu'un JSON exporte n'est pas ajoute manuellement au projet.

## Specification de reference

- Specification fonctionnelle: `LEVEL_EDITOR_FUNCTIONAL_SPEC.md`
- Plan de realisation: `LEVEL_EDITOR_IMPLEMENTATION_PLAN.md`
- Convention de documentation du code: `CODE_DOCUMENTATION_CONVENTION.md`

## Acces

Depuis l'application, utiliser le bouton `Editeur` dans la barre debug.

L'editeur s'affiche dans le canvas logique `320x200`, avec une grille en cellules de `16x16`.

## Edition

- Cliquer une tuile dans la palette pour choisir le crayon.
- Cliquer dans la grille pour poser la tuile.
- Clic droit dans la grille pour gommer.
- Choisir l'outil `Spawn` pour placer le depart joueur.
- Choisir l'outil `Sortie` pour placer la sortie.
- Choisir l'outil `Rectangle` pour remplir une zone.
- Choisir l'outil `Test` ou utiliser `Ctrl+T` pour lancer le niveau courant dans le runtime.

## Raccourcis

- `Ctrl+Z`: annuler.
- `Ctrl+Y`: retablir.
- `S`: outil spawn.
- `E`: outil sortie.
- `G`: outil crayon.
- `T`: outil test.
- `D`: definir la tuile selectionnee comme tuile par defaut.
- `K`: alterner le type de source documentaire.
- `Ctrl+I`: importer un JSON colle.
- `Ctrl+E`: exporter, copier si possible et telecharger le JSON.
- `Ctrl+Delete`: abandonner le brouillon local.

## Format JSON exporte

Le JSON exporte suit `ModernLevelJson`:

- `id`, `label`: identification du niveau.
- `width`, `height`, `tileSize`: dimensions logiques.
- `defaultTile`: tuile implicite.
- `time`, `scoreStep`, `requiredDiamonds`: metadonnees gameplay.
- `playerSpawn`, `exit`: coordonnees uniques.
- `tiles`: cellules explicites triees par `y`, puis `x`.
- `entities`: entites modernes sans adresse ASM.
- `source.kind`: nature documentaire du niveau.

## Limites MVP

- Les prompts remplacent temporairement des champs de formulaire plus confortables.
- Le rendu de tuiles est prepare pour reutiliser l'atlas runtime; le fallback couleur reste visible si l'atlas n'est pas injecte.
- Le chargement fichier local et le diff textuel avance ne sont pas encore finalises.
- Le retour direct du runtime vers l'editeur n'a pas encore d'IHM dediee.
- La validation reste simple et ne fait pas d'analyse avancee de jouabilite.

## Checklist d'acceptation MVP

- Ouvrir l'editeur depuis l'IHM.
- Poser `empty`, `earth`, `rock`, `diamond`, `border`, `platform`, `monster`.
- Placer spawn et sortie.
- Modifier `id`, `label`, taille, temps, score et objectif diamant.
- Exporter un JSON sans adresse ASM.
- Reimporter le JSON exporte.
- Lancer le niveau temporaire dans le runtime.
- Voir les overlays d'edition au-dessus de la grille.
- Voir la police pixel TO8 sur les titres et libelles principaux.

## Risques connus restants

- Le zoom editeur est volontairement simple et devra etre affine si l'IHM s'agrandit.
- Les animations de palette dans l'editeur devront partager exactement les clocks runtime pour un rendu ISO complet.
- Les controles par prompts devront probablement etre remplaces par des widgets canvas dedies.
