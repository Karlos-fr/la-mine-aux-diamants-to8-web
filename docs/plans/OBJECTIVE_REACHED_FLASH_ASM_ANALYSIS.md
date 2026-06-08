# Analyse ASM - Effet graphique lorsque l'objectif de diamants est atteint

## Contexte

Cette note documente les elements identifies dans le code original TO8 autour de l'effet visible lorsque le joueur atteint l'objectif de diamants a ramasser.

Observation de reference : dans l'emulateur, lorsque l'objectif est atteint, on observe un effet graphique de cadre/ecran avec des bandes rouges et jaunes autour de la zone de jeu. Cet effet est distinct du simple clignotement de la sortie.

## Routines identifiees

### Clignotement de la sortie : `KIT.BIN:$BFA0` et `KIT.BIN:$BFB6`

La routine `BFA0` gere le clignotement de la sortie lorsque celle-ci est active.

Comportement observe dans le portage ASM genere :

```asm
BFA0 LDA $BFBE
BFA3 BNE $BFA6
BFA5 RTS
BFA6 COM $BFBF
BFA9 LDA $BFBF
BFAC BEQ $BFA5
BFAE LDX $DBB3
BFB1 LDA #$05
BFB3 STA ,X
BFB5 RTS
```

Interpretation :

- `$BFBE` sert de drapeau d'activation du clignotement de la sortie.
- `$BFBF` est inverse a chaque appel pour alterner l'affichage.
- `$DBB3` contient l'adresse de la sortie dans la grille/niveau original.
- Lorsque le clignotement est dans son etat visible, la routine ecrit la tile `0x05` a l'adresse de sortie.

La routine `BFB6` restaure la sortie :

```asm
BFB6 LDX $DBB3
BFB9 LDA #$04
BFBB STA ,X
BFBD RTS
```

Interpretation :

- La sortie alterne donc entre `0x04` et `0x05`.
- Ce mecanisme correspond au clignotement de la sortie active.
- Il ne suffit pas a expliquer le grand flash rouge/jaune visible dans l'emulateur.

### Effet de cadre/ecran : `KIT.BIN:$C073`

La routine `C073` manipule directement la memoire ecran.

Code observe :

```asm
C073 JSR $C32A
C076 LDA $5BA3
C079 PSHS A
C07B LDX #$5BCB
C07E LDA ,X
C080 STA -41,X
C083 STA -40,X
C086 STA -39,X
C089 LEAX 40,X
C08C CMPX #$5E23
C08F BNE $C07E
C091 PULS A
C093 STA $5DFA
C096 STA $5DFB
C099 STA $5DFC
C09C RTS
```

Interpretation :

- La routine ne modifie pas les tiles de niveau.
- Elle copie des octets en memoire ecran avec un pas de `40`, ce qui correspond au stride ecran utilise par les routines graphiques originales.
- Elle ecrit trois octets adjacents a chaque ligne : `-41,X`, `-40,X`, `-39,X`.
- Elle termine en ecrivant aussi trois octets en bas : `$5DFA`, `$5DFB`, `$5DFC`.
- Cela correspond a un effet de bande/cadre, coherent avec le flash rouge/jaune observe dans l'emulateur.

En prenant une base ecran plausible autour de `$5B00` avec un stride de `40`, les adresses donnent :

- `$5BA3` : ligne 4, colonne 3 environ.
- `$5BCB` : ligne 5, colonne 3 environ.
- `$5DFA-$5DFC` : ligne 19, colonnes 2 a 4 environ.
- `$5E23` : borne de fin de boucle, ligne 20 environ.

Ces coordonnees confirment que la routine agit sur une zone de cadre/ecran et non sur une cellule logique du niveau.

### Selection du plan video : `KIT.BIN:$C32A` et `KIT.BIN:$C6A0`

`C073` commence par appeler `C32A` :

```asm
C32A PSHS A
C32C LDA $E7C3
C32F ANDA #$FE
C331 STA $E7C3
C334 PULS A,PC
```

Interpretation :

- La routine force un etat du registre video `$E7C3`.
- Le bit 0 est remis a zero.
- Cela indique que l'effet travaille sur un plan video specifique.

La routine opposee `C6A0` existe aussi :

```asm
C6A0 PSHS A
C6A2 LDA $E7C3
C6A5 ORA #$01
C6A7 STA $E7C3
C6AA PULS A,PC
```

Interpretation :

- `C6A0` remet le bit 0 a `1`.
- Le code original alterne donc explicitement entre deux etats/plans video pour dessiner certains elements.

## Appels dans la boucle principale

La boucle principale `KIT.BIN:$BF13` appelle `C073` plusieurs fois :

```asm
BF53 JSR $C073
BF6E JSR $C073
BF8F JSR $C073
```

Elle appelle aussi les routines de sortie :

```asm
BF41 JSR $BFA0
BF47 JSR $BFB6
BF5C JSR $BFB6
BF98 JSR $BFB6
```

Interpretation :

- Le clignotement de sortie et le rafraichissement du cadre sont deux mecanismes distincts mais executes dans la meme boucle.
- L'effet graphique de l'objectif atteint n'est pas un simple changement de tile.
- Le comportement original repose sur des ecritures directes en memoire ecran, appelees regulierement dans la boucle de jeu.

## Routine liee a l'entree dans la sortie : `KIT.BIN:$BFE2`

La routine `BFE2` compare la position du joueur avec l'adresse de sortie :

```asm
BFE2 LDX $D034
BFE5 CMPX $DBB3
BFE8 BEQ $BFEB
BFEA RTS
```

Lorsque le joueur est sur la sortie, la routine entre dans une sequence plus longue qui appelle notamment :

```asm
C048 JSR $C59E
C04B JSR $BD87
C04E JSR $C5C3
C056 JSR $C073
C059 JSR $D1E0
C05C COM $C0AD
C067 JSR $D06B
```

Interpretation :

- `BFE2` gere la logique de passage par la sortie.
- `C073` continue d'etre appelee dans cette sequence.
- Le cadre/ecran fait donc partie du cycle graphique original autour de la sortie et de l'objectif atteint.

## Synthese

Deux effets doivent etre reproduits separement dans le portage moderne :

1. Le clignotement de la sortie active.
2. Le flash/cadre graphique lorsque l'objectif de diamants est atteint.

Le clignotement de sortie correspond aux tiles `0x04` et `0x05`, via `BFA0`/`BFB6`.

Le flash/cadre correspond a `C073`, qui manipule directement la memoire ecran apres selection d'un plan video via `C32A`.

## Proposition d'implementation moderne

Pour rester coherent avec l'architecture moderne, il vaut mieux ne pas reproduire ces effets comme des mutations de tiles.

Approche recommandee :

- Ajouter un etat de runtime dedie, par exemple `objectiveReachedFrameFlash`.
- Declencher cet etat au moment exact ou le compteur de diamants ramasses atteint l'objectif du niveau.
- Garder le clignotement de sortie comme un etat separe, lie a l'ouverture de la sortie.
- Rendre le flash de cadre dans la couche graphique/HUD, au-dessus du rendu du niveau.
- Reproduire visuellement le cadre rouge/jaune observe dans l'emulateur.
- Caler la cadence sur le tick runtime existant, en s'inspirant des appels frequents a `C073` dans la boucle principale.

## Points restant a verifier avant implementation definitive

- Identifier avec certitude ou et comment `$BFBE` est positionne a `1` dans le code original. La recherche dans les routines generees montre clairement son initialisation a `0`, mais pas encore son activation.
- Cartographier plus finement les octets ecran copies par `C073` vers les couleurs TO8 exactes.
- Verifier si le cadre flash reste actif tant que la sortie est ouverte ou s'il s'agit d'un effet court au moment precis ou l'objectif est atteint.

## Analyse complementaire

### `$BFBE` semble etre un drapeau dormant ou active indirectement

La recherche statique dans les artefacts du portage automatique donne uniquement :

```asm
BEB9 CLR $BFBE
BFA0 LDA $BFBE
```

Il n'y a pas de `STA $BFBE`, `INC $BFBE`, `COM $BFBE` ou `LDX #$BFBE` trouve dans les routines ASM generees.

Interpretation prudente :

- `$BFBE` est bien lu comme drapeau d'activation par `BFA0`.
- Il est remis a zero a l'initialisation du niveau par `BE68`.
- Son activation n'est pas visible dans le graphe statique actuel.
- Si ce drapeau est reellement utilise par le jeu original, son activation passe probablement par une ecriture indirecte, une zone de donnees chargee, ou une portion non couverte par les references statiques.
- Les appels directs a l'entree interne `BFA9` dans la boucle principale reutilisent l'etat courant de `$BFBF` sans inverser le drapeau.

Consequence pour le portage moderne :

- Ne pas baser l'implementation moderne uniquement sur `$BFBE`.
- Utiliser l'evenement moderne `exitOpened` comme declencheur fonctionnel, tout en gardant cette incertitude documentee.

### `C073` n'est pas uniquement un effet "objectif atteint"

La routine `C073` est appelee dans plusieurs contextes :

- pendant l'animation d'apparition du joueur au chargement du niveau (`BE68`, adresses `BEDE`, `BEE7`, `BEF6`, `BF05`);
- dans la boucle principale (`BF53`, `BF6E`, `BF8F`);
- dans la sequence de sortie (`C056`);
- dans la boucle d'attente `C0AE`.

Interpretation corrigee :

- `C073` n'est probablement pas le declencheur direct de l'effet "objectif atteint".
- C'est plutot une routine de restauration/rafraichissement d'une zone de cadre/ecran sur un plan video donne.
- Le flash rouge/jaune observe dans l'emulateur peut provenir de l'interaction entre ce rafraichissement de cadre, le plan video courant, et une autre sequence graphique.
- Pour le portage moderne, `C073` donne la forme et la logique de rendu du cadre, mais pas encore toute la condition de declenchement.

### Origine du compteur diamant affiche : `$C738`

La routine `DA10` lit les deux premiers octets de l'en-tete niveau :

```asm
DA20 EC 84      LDD ,X
DA22 FD C7 38   STD $C738
```

La routine `C222` affiche ensuite ce compteur dans le panneau droit :

```asm
C229 LDX #$C738
C22C STX $C6F6
C22F LDX #$5C45
C232 STX $C6F8
...
C23E JSR $C601
```

Le generateur moderne `tools/generate-modern-levels.mjs` s'appuie deja sur cette preuve :

- `header[0..1]` -> `$C738/$C739`;
- `C222` affiche le compteur droit depuis `$C738`;
- `requiredDiamonds` est decode par `parseBcdDigitPair(header[0], header[1])`.

Conclusion :

- Le champ moderne `requiredDiamonds` est bien fonde sur l'ASM.
- `$C738` correspond au compteur diamant affiche dans le panneau droit.
- Dans les references statiques actuelles, `$C738` est seulement initialise puis lu pour affichage; aucune decrementation directe de `$C738` n'a ete trouvee.

Point de vigilance :

- Le jeu original peut afficher une valeur cible statique plutot qu'un compteur restant, ou modifier ce compteur par une routine indirecte non detectee.
- Notre portage moderne utilise actuellement `hud.diamonds` comme compteur restant, ce qui est fonctionnellement clair mais doit rester compare au rendu original si l'on vise ISO strict.

### Compteur temps : `$C723-$C725`

`DA10` charge aussi les octets d'en-tete `+8`, `+9`, `+10` :

```asm
DA34 EC 08      LDD 8,X
DA36 FD C7 23   STD $C723
DA39 A6 0A      LDA 10,X
DA3B B7 C7 25   STA $C725
```

`C54D` et `C59E` affichent cette zone via les routines de fontes.

La routine `C63A` decompte cette valeur comme un compteur decimal :

```asm
C63D LDY #$C725
C647 DEC ,Y
...
C65A DEC ,Y
C65E LDA #$09
C660 STA ,Y
```

Interpretation :

- `$C723-$C725` correspond au compteur `Temps`.
- `C63A` decremente ce compteur.
- Si le compteur arrive a expiration, la routine appelle `C131`, puis `C0AE`, puis `D9E6`, puis relance via `BB14`.

### Sequence apres entree dans la sortie

Lorsque le joueur est sur l'adresse de sortie :

```asm
BFE2 LDX $D034
BFE5 CMPX $DBB3
BFE8 BEQ $BFEB
```

La sequence `C003` verifie ensuite le compteur temps :

```asm
C003 LDA $C725
C006 CMPA #$01
C008 BNE $C048
C00A LDA $C724
C00D BNE $C048
C00F LDA $C723
C012 BNE $C048
```

Si le temps n'est pas arrive a `100`, elle passe par :

```asm
C048 JSR $C59E
C04B JSR $BD87
C04E JSR $C5C3
C051 DEC $C0AC
C056 JSR $C073
```

Interpretation :

- Apres entree dans la sortie, le jeu convertit probablement le temps restant en points.
- `C6FD` est force a `1` au debut de cette sequence (`C000 STA $C6FD`) pour incrementer le score unitaire pendant cette conversion.
- La sequence continue jusqu'a ce que le temps atteigne `100`.
- `C073` intervient alors comme rafraichissement de cadre pendant cette transition.

### Valeur de score par diamant : `$C6FD`

`DA10` charge l'octet `+11` de l'en-tete niveau :

```asm
DA3E LDA 11,X
DA40 STA $C6FD
```

`C5C3` utilise ensuite cette valeur comme nombre d'iterations d'increment de score :

```asm
C5D6 LDB $C6FD
C5D9 INC $C721
...
C5EA JSR $C675
C5ED DECB
C5EE BNE $C5D9
```

Interpretation :

- `$C6FD` est le pas de score ajoute lors d'un evenement de score, notamment la collecte.
- Pour le niveau 1, le portage moderne decode `scoreStep: 15`, coherent avec l'octet original `0x0f`.
- Pendant la sequence de sortie, `$C6FD` est remplace par `1` pour convertir le temps restant en score point par point.

## Etat de confiance apres analyse complementaire

Elements confirmes :

- `requiredDiamonds` moderne vient bien de l'en-tete niveau `header[0..1]`, via `$C738` et `C222`.
- `time` moderne vient de l'en-tete niveau `header[8..10]`, via `$C723-$C725`.
- `scoreStep` moderne vient de l'en-tete niveau `header[11]`, via `$C6FD`.
- `C073` dessine/restaure une zone de cadre en memoire ecran.
- `C073` est utilisee dans plusieurs sequences, pas uniquement au moment ou l'objectif diamant est atteint.

Elements encore ouverts :

- Le point exact ou le jeu original decide que la sortie devient active apres l'objectif diamant.
- Le point exact ou le grand effet rouge/jaune est declenche.
- La raison pour laquelle `$BFBE` est lu comme drapeau mais n'est pas active par une ecriture directe visible.
- La difference exacte entre compteur diamant affiche statique et compteur diamant restant pendant le jeu original.

Hypothese d'implementation moderne la plus sure a ce stade :

- Declencher un effet visuel moderne lors de `exitOpened`, car c'est notre evenement fonctionnel prouve par le compteur requis.
- Rendre cet effet comme un cadre/couche graphique dediee, inspiree de `C073`.
- Ne pas lier directement l'effet a `$BFBE` tant que son activation originale n'est pas retrouvee.
- Conserver dans le code une reference documentaire a cette analyse pour pouvoir ajuster si l'ASM revele plus tard le declencheur exact.

## Cadence ASM du flash graphique

### Routine `BD87`: inversion rapide d'un bit video

La routine `BD87` est le candidat le plus net pour l'effet de flash visible :

```asm
BD87  PSHS X,B,A
BD89  LDB #$06
BD8B  LDA $E7C1
BD8E  EORA #$08
BD90  STA $E7C1
BD93  LDX #$0002
BD96  LEAX -1,X
BD98  BNE $BD96
BD9A  DECB
BD9B  BNE $BD8B
BD9D  PULS A,X,B,PC
```

Comportement prouve :

- La routine effectue `6` inversions successives du bit `0x08` du registre video `$E7C1`.
- Comme le nombre d'inversions est pair, le registre finit dans son etat initial.
- Le delai interne est minuscule : `LDX #$0002`, puis une boucle de decrement de deux iterations.
- Cette routine produit donc un flash tres court au niveau machine, pas une animation longue geree par une table.

### Appel connu de `BD87`

Le seul appel direct identifie se trouve dans la sequence de sortie / bonus temps autour de `BFE2/C003` :

```asm
C048  JSR $C59E
C04B  JSR $BD87
C04E  JSR $C5C3
C051  DEC $C0AC
C054  BNE $C003
C056  JSR $C073
C059  JSR $D1E0
C05C  COM $C0AD
C05F  LDA $C0AD
C062  BNE $C067
C064  JSR $D1BB
C067  JSR $D06B
C06A  LDA #$0A
C06C  STA $C0AC
C06F  LBRA $C003
```

Comportement prouve :

- `BD87` est appelee a chaque tour de cette boucle.
- `$C0AC` cadence une operation plus lourde toutes les `10` iterations.
- Toutes les `10` iterations, le code appelle `C073`, `D1E0`, puis alterne `D1BB` une fois sur deux via `$C0AD`.
- `D1E0` correspond a la rotation/copie des couleurs utilisee notamment par les diamants.
- `D1BB` complemente et permute des blocs de donnees graphiques/couleur.

### Relation avec l'objectif de diamants

Ce que l'ASM prouve directement :

- L'objectif de diamants vient de l'en-tete de niveau, copie par `DA10` vers `$C738`.
- L'affichage du compteur de diamants lit ensuite cette valeur via les routines HUD, notamment `C222`.
- L'ouverture de sortie est geree par le compteur logique du jeu, puis la tuile de sortie alterne entre `0x04` et `0x05` via les routines deja identifiees autour de `BFA0/BFB6`.

Ce qui n'est pas encore prouve par un appel direct :

- Je n'ai pas trouve d'appel explicite a `BD87` exactement au moment ou le compteur de diamants atteint l'objectif.
- La video/emulation montre pourtant un flash de cadre au moment ou l'objectif est atteint.
- L'hypothese la plus solide pour le portage moderne est donc de declencher un flash equivalent au moment ou notre evenement `exitOpened` est emis, car c'est le moment fonctionnel correspondant a l'objectif atteint.

### Transposition moderne recommandee

Pour rester fidele sans copier aveuglement une temporisation CPU invisible dans un navigateur :

- Declencher l'effet quand le compteur de diamants restant passe a `0` et que la sortie devient active.
- Reproduire la structure ASM de `BD87` avec `6` phases de flash.
- Comme la boucle ASM interne est trop courte pour etre transposee telle quelle en rendu `requestAnimationFrame`, etaler ces `6` phases sur quelques frames visibles.
- Utiliser le rendu observe : cadre superieur rouge et bord inferieur jaune pendant les phases actives, puis retour au rendu normal.

Point important : la cadence exacte machine est donc `6` inversions du bit `0x08` de `$E7C1`, mais la duree visuelle percue depend du balayage video et de l'emulateur. Pour le portage moderne, la fidelite utile consiste a conserver le nombre de phases et le declencheur gameplay, puis a choisir une duree frame par frame suffisamment visible.
