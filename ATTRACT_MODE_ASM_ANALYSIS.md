# Analyse ASM - Mode attract / entree speciale depuis l'ecran titre

## Objectif

Documenter les elements ASM qui montrent que le deuxieme ecran titre ne reste pas uniquement en attente clavier: apres un certain chemin d'inactivite/selection, il lance une entree speciale de jeu via la table originale des niveaux.

## Conclusion courte

- Le jeu original contient une entree supplementaire dans la table des niveaux.
- Cette entree est pointee par l'index `0x10`, donc apres les 16 niveaux standards indexes `0x00` a `0x0F`.
- Le deuxieme ecran titre peut ecrire `0x10` dans `$C072`, puis sauter vers le lancement jeu.
- Cette entree speciale commence a l'adresse `$B7C4`.
- Le mode active aussi `$CE32 = 1`, ce qui declenche un controle automatique/scriptable.
- La barre espace interrompt ce mode et renvoie a l'ecran titre.

## Chemin depuis l'ecran titre

Routine observee autour de `$8D90`:

```asm
8D90  86 16      ; A = 0x16
8D92  B7 C7 4D   ; stocke 0x16 en $C74D
8D95  86 10      ; A = 0x10
8D97  B7 C0 72   ; stocke 0x10 en $C072
8D9A  86 01      ; A = 1
8D9C  B7 CE 32   ; active le flag $CE32
8D9F  7F CE 31
8DA2  7F CE 33
8DA5  7F CE 34
8DA8  7E BB 00   ; saute vers le lancement jeu
```

Interpretation:

- `$C072` est l'index de niveau utilise par le loader.
- `$C74D` est lie a la valeur de galerie affichee/prepatee pour le HUD.
- `$CE32 = 1` active le mode special de demonstration automatique.
- Le saut vers `$BB00` lance le flux jeu normal.

Dans les lancements normaux depuis le titre, `$C072` et `$C74D` recoivent la meme base de galerie: `0`, `4` ou `8`. Pour le mode attract, le jeu ecrit volontairement deux valeurs differentes:

```txt
$C072 = $10  ; index technique dans la table de niveaux, donc entree 16
$C74D = $16  ; valeur galerie/HUD associee au mode special
```

La routine autour de `$C2B5` relit ensuite `$C74D`, le combine avec `$C74C`, puis separe les nibbles dans `$C735` et `$C736`. Cela confirme que `$C74D` sert au rendu/compteur de galerie plutot qu'au choix direct du pointeur de niveau.

```asm
C2B5  B6 C7 4D      ; lit $C74D
C2B8  BB C7 4C      ; ajoute $C74C
C2BB  19
C2BC  B7 C7 4D      ; reecrit $C74D
C2BF  B6 C7 4D
C2C2  84 0F
C2C4  B7 C7 36      ; chiffre bas
C2C7  B6 C7 4D
C2CA  84 F0
C2CC  44 44 44 44
C2D0  B7 C7 35      ; chiffre haut
```

## Delai de declenchement depuis le titre

Le declenchement automatique est pilote par le compteur `$8DD8`. Dans la boucle titre, ce compteur est incremente, puis compare a `$34`. Quand la valeur est atteinte, le programme saute vers la routine `$8D90`, celle qui charge l'entree speciale `$B7C4`.

```asm
8CB9  7C 8D D8      ; incremente le compteur titre
8CBC  BD 94 1F
8CBF  B6 8D D8      ; relit le compteur
8CC2  81 34         ; compare a $34
8CC4  10 27 00 C5   ; si egal, saut vers $8D90
```

Le seuil ASM est donc `$34`, soit 52 passages de boucle titre. La duree en secondes depend du rythme exact de cette boucle et des appels graphiques/temporisations qui l'entourent.

## Chargement du niveau par `$C072`

Le lancement jeu passe par `$BE68`, qui appelle `DA10`.

```asm
BE68  B6 C0 72   ; lit l'index courant dans $C072
BE6B  BD DA 10   ; charge/decode le niveau
```

La routine `DA10` utilise cet index pour chercher un pointeur dans la table `$BFC0`.

```asm
DA10  7F DB 4E
DA13  C6 02      ; taille entree table = 2 octets
DA15  3D         ; D = A * B, donc index * 2
DA16  8E BF C0   ; X = table des pointeurs de niveaux
DA19  30 8B      ; X += D
DA1B  AE 84      ; X = pointeur de niveau
```

Donc avec `$C072 = 0x10`, le jeu lit l'entree `16` de la table, apres les 16 niveaux standards.

## Table originale des niveaux

Table pointeurs observee a `$BFC0`:

```txt
0  -> $A000
1  -> $A17D
2  -> $A364
3  -> $A4BD
4  -> $A56F
5  -> $A68F
6  -> $A81A
7  -> $A969
8  -> $AAE0
9  -> $AC8A
10 -> $ADA8
11 -> $AF58
12 -> $B12D
13 -> $B272
14 -> $B436
15 -> $B609
16 -> $B7C4
```

L'entree `16` existe donc bien dans le binaire original.

## Header de l'entree speciale `$B7C4`

Octets header:

```txt
01 04 01 01 02 09 17 0F 09 09 09 0C
```

Decodage selon le format des niveaux deja utilise:

```txt
diamants requis : 14
spawn joueur    : x=2, y=9
sortie          : x=23, y=15
temps           : 09:09
score diamant   : 12
```

## Contenu decode de la grille speciale

Comptage des tuiles decodees sur la grille utile `38x20`:

```txt
0x00 : 20
0x01 : 499
0x02 : 2
0x03 : 10
0x04 : 2
0x05 : 37
0x06 : 181
0x17 : 1
0x18 : 8
```

Elements notables:

- `0x02`: deux monstres standards.
- `0x17`: une creature speciale.
- `0x18`: huit blocs transformateurs.
- `0x03`: dix diamants.

Positions notables:

```txt
0x02 at (11,10) -> $DD7B
0x02 at (5,19)  -> $DEDD
0x17 at (36,15) -> $DE5C
0x18 at (29,12) -> $DDDD
0x18 at (30,12) -> $DDDE
0x18 at (31,12) -> $DDDF
0x18 at (32,12) -> $DDE0
0x18 at (29,18) -> $DECD
0x18 at (30,18) -> $DECE
0x18 at (31,18) -> $DECF
0x18 at (32,18) -> $DED0
```

Correction d'analyse: les ids `0x1D` et `0x1F` mentionnes dans une premiere lecture ne font pas partie de la grille `$B7C4` quand on applique le decodage RLE original de `DA10`. Ils etaient un artefact de decodage, pas des tuiles a implementer pour ce mode.

## Fonctionnement du mode automatique

Le deuxieme ecran titre semble avoir au moins deux chemins:

- validation utilisateur: lancement normal avec un niveau standard;
- chemin automatique: lancement de l'entree speciale `$B7C4` avec `$CE32 = 1`.

Le flag `$CE32` est teste ensuite dans la boucle gameplay. Quand il vaut zero, le jeu lit le clavier et execute les routines joueur normales. Quand il vaut un, cette lecture normale est contournee et le jeu passe par une branche de controle automatique.

```asm
BF13  BD CA 04      ; routine monstres
BF16  B6 C7 4E
BF19  8C
BF1A  B6 CE 32      ; lit le flag demo/attract
BF1D  26 1C         ; si CE32 != 0, branche speciale
BF1F  BD E8 06      ; sinon lecture clavier normale
```

Le bloc `$CE00` confirme le role du mode. Si la barre espace est detectee, le flag automatique est efface, l'index de script est remis a zero, puis le jeu retourne au titre.

```asm
CDF9  7D CE 32      ; test CE32
CDFC  27 50         ; si zero, pas de controle automatique
CDFE  BD E8 06      ; lecture clavier
CE01  C1 20         ; comparaison avec espace
CE03  26 09
CE05  7F CE 32      ; sortie du mode automatique
CE08  7F CE 31      ; reset index script
CE0B  7E 8C 74      ; retour ecran titre
```

`$CE31` est l'index du script. La routine lit un octet dans une table basee en `$D878`, puis incremente `$CE31`. La valeur `$DD` sert de marqueur de fin de script: le mode automatique est coupe et le programme revient au titre.

```asm
CE13  B6 CE 31      ; A = index script
CE16  7C CE 31      ; index++
CE19  10 8E D8 78   ; Y = table script
CE1D  31 A6         ; Y = D878 + A
CE1F  E6 A4         ; B = octet script
CE21  C1 DD         ; fin de script ?
CE23  10 26 00 0E
CE27  7F CE 32      ; sortie du mode automatique
CE2A  7F CE 31
CE2D  7E 8C 74      ; retour ecran titre
```

Quand l'octet lu est superieur ou egal a `$10`, la routine le decompose en commande et duree. Le quartet bas devient la commande courante dans `$CE33`, et l'octet suivant devient un compteur dans `$CE34`.

```asm
CE35  C1 10         ; commande longue ?
CE37  25 6D
CE39  C4 0F         ; conservation du quartet bas
CE3B  F7 CE 33      ; CE33 = commande/direction
CE3E  A6 21         ; lecture de l'octet suivant
CE40  B7 CE 34      ; CE34 = compteur/duree
CE43  7C CE 31      ; index script++
CE46  F6 CE 33      ; reprise commande courante
CE49  7A CE 34      ; duree--
```

Le bloc suivant simule ensuite des entrees et repart vers les routines normales de mouvement du joueur, notamment les blocs autour de `$CEF0`, `$CF4A`, `$CFA8`, `$CFEA`. Le mode attract reutilise donc les vraies routines de jeu, mais avec une source de commandes scriptable au lieu du clavier normal.

## Role de `$CE30`: choix clavier / manette

`$CE30` est initialise a zero au retour titre, puis peut etre modifie dans l'ecran titre par les touches `C` et `M`.

```asm
8C72  7F CE 30      ; reset du mode de controle
...
8CF7  BD E8 06      ; lecture clavier
8CFA  C1 43         ; touche 'C'
8CFC  26 0B
8CFE  7F 8D D8
8D01  7F CE 30      ; C -> CE30 = 0
...
8D08  C1 4D         ; touche 'M'
8D0A  10 26 00 9C
8D0E  7F 8D D8
8D11  86 01
8D13  B7 CE 30      ; M -> CE30 = 1
```

Interpretation fonctionnelle:

```txt
CE30 = 0 -> controle clavier
CE30 = 1 -> controle manette / entree abstraite via $E827
```

Cette interpretation est confirmee par la routine de controle joueur normale `$CD5B`: si `$CE30` vaut zero, elle scanne directement la matrice clavier via `$E7C9/$E7C8`; sinon elle saute cette partie et utilise la routine `$E827`, qui renvoie les memes codes logiques `1`, `3`, `5`, `7`.

```asm
CD6A  7D CE 30      ; test mode de controle
CD6D  26 3B         ; si CE30 != 0, saute le scan clavier direct
CD6F  86 06
CD71  B7 E7 C9      ; selection ligne clavier
CD74  B6 E7 C8      ; lecture clavier
...
CDA6  4F
CDA7  BD E8 27      ; lecture entree abstraite
CDAB  C1 01         ; haut
CDAF  C1 05         ; bas
CDB3  C1 07         ; gauche
CDB7  C1 03         ; droite
```

Point important: ce bloc `$CE30` appartient au chemin ou `$CE32 = 0`. Dans le mode attract proprement dit, le branchement `$CDFC` ne va pas vers `$CE4E`; il lit le script `$D878`, puis saute directement au dispatch de commande autour de `$CEA6`. Le mode attract n'utilise donc pas `$CE30` comme source principale de controle.

## Ordre d'execution d'une frame en mode attract

Le mode attract ne lance pas une boucle separee. Il reutilise la boucle gameplay principale, mais bifurque au moment de l'input joueur.

Extrait de la boucle autour de `$BF13`:

```asm
BF13  10 CE 6F FF
BF17  BD CA 04      ; monstres
BF1A  B6 CE 32      ; test attract/demo
BF1D  26 1C         ; si actif, saute l'input clavier normal
BF1F  BD E8 06      ; lecture clavier normale
...
BF3B  BD BC 84      ; creature speciale
BF3E  BD CB 07      ; physique / objets
BF41  BD BF A0      ; gestion tile de sortie/protection
BF44  BD CD F9      ; controle attract ou input supplementaire
BF47  BD BF B6      ; restauration tile sortie/protection
BF4A  BD BF E2      ; changement de galerie/niveau si necessaire
BF4D  BD D1 E0      ; rendu/effets
...
BF83  BD CD 5B      ; input joueur normal dans le flux non attract
```

Consequence pour le portage moderne: un `AttractModeScene` devrait idealement reutiliser la scene gameplay et ses systemes, en remplacant uniquement la source d'entree du joueur par un script. Les monstres, la creature speciale, la physique des rochers/diamants, les compteurs et le rendu doivent rester ceux du runtime normal.

## Retour au titre en mode attract

Un autre test de `$CE32` apparait autour de `$C037`. Cette adresse n'est pas appelee directement par un `JSR`: elle est atteinte par continuite depuis la routine de sortie/progression de niveau autour de `$BFE2`.

Le bloc `$BFE2` compare la position joueur `$D034` avec le pointeur de sortie `$DBB3`. Si le joueur n'est pas sur la sortie, la routine retourne immediatement. Si le joueur est sur la sortie, le jeu incremente `$C072`, gere le retour a zero apres `$10`, met a jour le HUD/score, puis arrive au test `$C037`.

```asm
BFE2  BE D0 34      ; X = position joueur
BFE5  BC DB B3      ; compare avec pointeur sortie
BFE8  27 01
BFEA  39            ; pas sur la sortie -> retour
BFEB  7C C0 72      ; niveau/galerie suivante
BFEE  B6 C0 72
BFF1  81 10
BFF3  26 03
BFF5  7F C0 72      ; retour a zero apres $10
BFF8  BD D0 6B
BFFB  BD C2 AF
BFFE  86 01
C000  B7 C6 FD
...
C037  B6 CE 32      ; test attract/demo
```

Quand `$CE32` est actif, la routine ne reprend pas la boucle de partie normale: elle saute directement vers `$8C74`, c'est-a-dire le retour/reinitialisation de l'ecran titre.

```asm
C037  B6 CE 32      ; test attract/demo
C03A  26 09         ; si actif, retour titre
C03C  BD C0 AE
C03F  BD CD 5B      ; sinon input joueur normal
C042  7E BB 14      ; reprise partie
C045  7E 8C 74      ; retour titre
```

Cela confirme que le mode attract est une demonstration temporaire. Si la demonstration atteint la sortie, elle revient au titre au lieu de poursuivre une progression normale.

## Mapping des commandes de script

La routine de dispatch autour de `$CEA0` compare la commande courante a quatre valeurs. Ces valeurs appellent les memes blocs de deplacement que le joueur normal:

```asm
CEA0  BD E8 27
CEA3  10 25 FE C0
CEA7  C1 01         ; commande 1
CEA9  10 27 00 FC   ; vers $CFA9 / deplacement haut
CEAD  C1 05         ; commande 5
CEAF  10 27 01 38   ; vers $CFEB / deplacement bas
CEB3  C1 07         ; commande 7
CEB5  10 27 00 92   ; vers $CF4B / deplacement gauche
CEB9  C1 03         ; commande 3
CEBB  10 27 00 32   ; vers $CEF1 / deplacement droite
CEBF  20 19         ; sinon animation/attente
```

Mapping prouve:

```txt
1 -> haut
3 -> droite
5 -> bas
7 -> gauche
autre valeur -> pas de branche de mouvement directe, donc attente/animation joueur
```

Les commandes longues utilisent l'octet haut comme marqueur de duree et le quartet bas comme commande. Exemple: `$25 $2F` signifie commande `$05`, donc bas, pendant `$2F` passages de routine.

## Debut du script `$D878` decode comme flux de commandes

La zone `$D878` ressemble aussi a du code 6809 valide si on la desassemble lineairement. Mais dans le mode attract, la routine `$CE13` la lit explicitement comme une table d'octets. Le decodage ci-dessous applique donc strictement la logique observee dans `$CE13-$CE49`.

```txt
$D878 : 1E 89 -> commande E, duree 137, attente/animation
$D87A : 8D 34 -> commande D, duree 52, attente/animation
$D87C : 25 2F -> commande 5, duree 47, bas
$D87E : 1F 03 -> commande F, duree 3, attente/animation
$D880 : 8D 2E -> commande D, duree 46, attente/animation
$D882 : 25 29 -> commande 5, duree 41, bas
$D884 : E7 C0 -> commande 7, duree 192, gauche
$D886 : 30 1F -> commande 0, duree 31, attente/animation
```

Les commandes `D`, `E`, `F`, `0`, `2`, `4`, `6`, `8`, `9`, `A`, `B`, `C` n'ont pas de branche de mouvement directe dans le dispatch observe. Leur effet pratique est donc une attente ou une animation sans deplacement direct, sauf interaction indirecte via les routines appelees autour de l'animation joueur.

Conclusion pour ces commandes: elles ne representent pas des actions gameplay supplementaires prouvees. Pour une premiere implementation ISO raisonnable, elles doivent etre traitees comme des commandes d'attente/animation, pas comme des directions cachees.

## Point restant a mesurer

La duree reelle en secondes correspondant aux 52 passages de boucle titre n'est pas deduisible proprement du seul dump statique. La boucle appelle des routines graphiques et des temporisations, notamment autour de `$941F`, et la duree depend du rythme machine effectif.

Ce point doit etre mesure sur reference video, emulateur TO8 ou instrumentation du portage. Il n'est pas bloquant pour l'architecture: le seuil logique original est bien `$34`.

## Recommandation d'implementation moderne

Ne pas l'integrer comme simple niveau `17` jouable. L'ASM montre que cette entree est lancee avec un mode de controle specifique.

Approche conseillee:

- creer un niveau JSON separe, par exemple `attract-mode.json`, derive de `$B7C4`;
- creer une scene ou un mode runtime dedie `AttractGameplayScene`;
- lancer ce mode depuis `StartupTitleScene` apres temporisation;
- garder la barre espace comme sortie du mode attract vers le titre;
- rejouer le script de commandes base sur `$D878`, `$CE31`, `$CE33`, `$CE34`;
- reutiliser les routines modernes existantes de physique, collision, monstres, camera et HUD, comme l'ASM reutilise ses routines de jeu;
- revenir au titre a la fin ou lors d'une condition de sortie, sans modifier la progression normale;
- traiter les commandes sans mouvement direct comme attente/animation;
- ne pas ajouter de gestion pour `0x1D` ou `0x1F` dans ce mode: ces tuiles ne sont pas presentes dans la grille `$B7C4` correctement decodee.

## Synthese des points fermes

- Declenchement depuis le titre: compteur `$8DD8 == $34`.
- Chargement de l'entree cachee: `$C072 = $10`, pointeur `$B7C4`.
- Valeur galerie/HUD speciale: `$C74D = $16`.
- Activation demo: `$CE32 = 1`.
- Script demo: table `$D878`, index `$CE31`, commande `$CE33`, duree `$CE34`.
- Commandes de mouvement: `1` haut, `3` droite, `5` bas, `7` gauche.
- Sorties du mode: barre espace, fin de script `$DD`, ou sortie atteinte en mode attract.
- Grille cachee: uniquement les tuiles utiles `0x00`, `0x01`, `0x02`, `0x03`, `0x04`, `0x05`, `0x06`, `0x17`, `0x18`.
