# Analyse - Estimation des durees du script attract

## Contexte

Le script attract original utilise la table memoire `$D878`. Les commandes longues ont la forme:

```txt
0x1N, duree
```

Le quartet bas `N` porte la commande courante et l'octet suivant porte un compteur brut. Exemple:

```txt
0x10 0x40
```

Cette sequence signifie commande `0` pendant `0x40` repetitions. La commande `0` ne branche pas vers une routine de mouvement directe; elle correspond donc a une attente ou animation sans deplacement joueur.

## Point important

`0x40` ne represente pas:

- 64 cycles CPU;
- 64 frames navigateur;
- 64 ticks modernes 50 Hz;
- 64 pas joueur.

`0x40` represente 64 passages par la routine de controle attract autour de `$CDF9`, via le compteur `$CE34`.

## Preuves ASM

Lecture initiale de commande:

```asm
CE13  B6 CE 31      ; A = index script
CE16  7C CE 31      ; index++
CE19  10 8E D8 78   ; Y = table script
CE1D  31 A6         ; Y = D878 + A
CE1F  E6 A4         ; B = octet script
CE21  C1 DD         ; fin de script ?
```

Commande longue:

```asm
CE35  C1 10         ; commande longue ?
CE37  25 6D
CE39  C4 0F         ; conservation du quartet bas
CE3B  F7 CE 33      ; CE33 = commande/direction
CE3E  A6 21         ; lecture de l'octet suivant
CE40  B7 CE 34      ; CE34 = compteur/duree
CE43  7C CE 31      ; index script++
CE46  F6 CE 33      ; reprise commande courante
CE49  7A CE 34      ; CE34--
```

Appel dans la boucle gameplay attract:

```asm
BF13  10 CE 6F FF
BF17  BD CA 04      ; monstres
BF1A  B6 CE 32      ; test attract/demo
BF1D  26 1C         ; si actif, saute l'input clavier normal
...
BF3B  BD BC 84      ; creature speciale
BF3E  BD CB 07      ; physique / objets
BF41  BD BF A0      ; gestion sortie/protection
BF44  BD CD F9      ; controle attract
BF47  BD BF B6
BF4A  BD BF E2
BF4D  BD D1 E0
...
BF9B  7E BF 13      ; retour boucle
```

La duree de `0x40` doit donc etre estimee comme:

```txt
64 * duree d'un passage de boucle gameplay original
```

## Pourquoi l'assimilation au pas joueur est fragile

Une premiere correction possible consistait a aligner une unite de script attract sur `playerGridMoveTicks`. Cela rend la pause visible, mais c'est conceptuellement trop grossier:

```txt
0x40 * playerGridMoveTicks
```

Cette formule assimile une repetition de script attract a un pas complet du joueur. Or le compteur `$CE34` est decompte a chaque passage par `$CDF9`, pas a chaque fin de deplacement de case.

La vraie unite a chercher est plutot:

```txt
gameLoopPassTicks
```

Ensuite:

```txt
duree pause 0x40 = 64 * gameLoopPassTicks
```

Le mouvement joueur doit rester modelise separement, car une case parcourue depend des routines de deplacement, collisions, temporisations et rendu.

## Ordres de grandeur

Si on interprete une repetition comme un tick moderne 50 Hz:

```txt
64 * 20 ms = 1,28 s
```

Cette valeur semble trop courte: la pause observee dans le jeu original parait plus visible que dans le portage.

Si on interprete une repetition comme un pas joueur calibre a `8,6` ticks:

```txt
64 * 8,6 ticks / 50 Hz = 11,008 s
```

Cette valeur risque d'etre trop longue et confond deux unites differentes.

La valeur correcte est probablement entre ces deux bornes. Elle doit etre estimee a partir du cycle-count du chemin attract idle dans la boucle gameplay originale.

## Plan de verification ulterieur

Pour obtenir une estimation plus solide:

1. Cycle-compter le chemin attract idle de `$BF13` a `$BF9B`.
2. Distinguer les couts fixes des couts dependants du niveau.
3. Identifier les routines appelees contenant des temporisations CPU ou synchronisations video.
4. Estimer `gameLoopPassTicks` depuis les cycles CPU TO8.
5. Remplacer la relation temporaire entre unite attract et pas joueur par une constante dediee.

## Recommendation d'architecture

Introduire une base temporelle plus explicite:

```ts
TO8_CPU_HZ = 1_000_000;
TO8_VIDEO_HZ = 50;
TO8_FRAME_SECONDS = 1 / TO8_VIDEO_HZ;
```

Puis separer les conversions:

```ts
secondsFromCpuCycles(cycles);
secondsFromVideoFrames(frames);
secondsFromModernTicks(ticks);
secondsFromGameLoopPasses(passes);
secondsFromAttractScriptUnits(units);
```

Les constantes actuelles comme `playerGridMoveTicks` doivent rester des calibrations gameplay modernes tant que le cycle-count ASM complet n'est pas fait.

La constante temporaire `attractScriptUnitTicks` ne doit pas etre consideree comme prouvee si elle reste alignee sur `playerGridMoveTicks`. Elle doit devenir une calibration dediee au passage de boucle attract.
