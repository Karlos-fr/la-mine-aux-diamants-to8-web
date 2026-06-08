# Analyse de synchronisation du mode attract

## Contexte

Le mode attract charge le niveau cache extrait de l'ASM et pilote le joueur via le script original. Le symptome observe est le suivant : le joueur meurt pendant l'attract mode, puis le niveau respawn en devenant jouable au clavier par l'utilisateur.

Cette analyse documente les causes probables identifiees dans le portage moderne et les points a verifier dans l'ASM avant correction definitive.

## Probleme certain : perte du mode attract apres la mort

Dans `src/screens/gameplay-scene.ts`, la logique de reset apres mort recree la scene avec `recreateLevelScene(this.levelNumber)`.

En mode attract, `this.levelNumber` vaut `18`, mais `recreateLevelScene` pointe vers la fabrique de gameplay normal. Le resultat est donc :

- mort du joueur en attract mode ;
- explosion / reset ;
- recreation du niveau 18 ;
- perte du mode `attract` ;
- niveau cache jouable au clavier, ce qui est incorrect.

Le comportement attendu, d'apres le role du flag ASM `$CE32` et la logique de demonstration, semble plutot etre : une mort en mode attract doit sortir du mode demo et revenir a l'ecran titre.

## Probleme probable : ordre d'execution different de l'ASM

L'ordre de boucle observe dans l'ASM semble etre approximativement :

```asm
monstres
creature speciale
physique / objets
sortie / tuile protegee
controle attract / input
restauration sortie / protection
transition / rendu
```

Dans le portage moderne, l'ordre runtime est plutot :

```text
joueur
camera
objets qui tombent
monstres
collisions monstres
evenements
rendu
```

Cette difference est importante pour le mode attract : le script original a probablement ete calibre avec l'ordre ASM. Si le joueur est avance avant les monstres et la physique au lieu d'etre traite apres certaines routines du monde, la trajectoire peut diverger et provoquer une collision qui n'existe pas dans l'original.

## Probleme probable : cadence du script attract

Le script attract est consomme via `AttractScriptInputSource`. Dans le runtime moderne, une nouvelle commande de mouvement est lue seulement quand le joueur n'est pas deja en interpolation de deplacement.

Cela cree une cadence moderne :

- les commandes de mouvement dependent de la duree fluide du deplacement joueur ;
- les commandes d'attente peuvent etre consommees a une cadence differente ;
- les monstres et les objets utilisent leurs propres durees et intervalles modernes.

Dans l'ASM, le script semble etre cadence par la boucle de jeu originale et par les compteurs `$CE31`, `$CE33` et `$CE34`. Il faut donc eviter de regler ce probleme uniquement en ajustant des vitesses au hasard : la bonne correction doit probablement rapprocher l'horloge attract du modele ASM.

## Suspect a verifier : directions initiales des monstres

Le portage moderne initialise les monstres avec une direction simplifiee. Si l'ASM initialise les monstres du niveau attract avec des directions precises, le script peut etre correct mais diverger a cause de l'IA moderne.

Points a verifier :

- ou l'ASM initialise les directions des monstres ;
- si les directions dependent du niveau ;
- si le niveau attract possede des directions ou etats initiaux particuliers ;
- si l'ordre de decision des monstres correspond bien au portage.

## Suspect a verifier : coordonnees du niveau cache

Le niveau cache moderne ajoute la bordure et applique les conventions de grille du portage. Pour les niveaux normaux, ces conventions ont ete stabilisees, mais le mode attract est plus sensible car le script est une sequence fixe.

Points a verifier :

- position exacte du spawn joueur dans le niveau original ;
- position exacte des monstres ;
- position de la sortie ;
- coherence entre les coordonnees ASM sans bordure et les coordonnees JSON modernes avec bordure ;
- absence d'offset implicite restant pour le niveau 18.

## Conclusion

Il y a deux niveaux de correction a prevoir.

Premier correctif, faible risque : en mode attract, la mort ne doit pas recreer un gameplay normal. Elle doit revenir a l'ecran titre, ou relancer explicitement un attract mode si l'ASM le confirme.

Second correctif, plus structurel : synchroniser le runtime attract avec l'ASM. Cela implique probablement :

- une politique de reset dediee au mode attract ;
- une cadence de lecture du script plus proche de `$CE31/$CE33/$CE34` ;
- un ordre d'execution specifique ou compatible pour monstres, physique et joueur ;
- une validation des directions initiales des monstres ;
- une verification des coordonnees du niveau cache.

L'objectif n'est pas de rendre le mode attract jouable, mais de reproduire une demonstration automatique robuste, non interactive, et fidele au comportement original.
