# Analyse ASM - Fin de niveau et bonus de temps

## Objectif

Documenter le comportement original quand le joueur atteint la sortie ouverte du niveau.

Observation utilisateur a verifier : quand le joueur arrive sur la case de fin, le compteur de points augmente pendant que le compteur de temps restant est decremente jusqu'a zero.

## Routines ASM analysees

- `KIT.BIN:$BFE2` / boucle `C003` : entree de fin de niveau et conversion du temps restant.
- `KIT.BIN:$C59E` : decrement et rendu du compteur de temps.
- `KIT.BIN:$C5C3` : increment et rendu du compteur de score.
- `KIT.BIN:$C63A` : decrement decimal du temps en memoire.
- `KIT.BIN:$C675` : propagation des retenues decimales du score.
- `KIT.BIN:$C516`, `$C526`, `$C601` : routines generiques d'affichage des chiffres.
- `KIT.BIN:$DA10` : chargement initial des valeurs de niveau, dont temps et score par diamant.

## Detection de sortie atteinte

La routine `BFE2` commence par comparer deux pointeurs :

```asm
BFE2  LDX $D034
BFE5  CMPX $DBB3
BFE8  BEQ $BFEB
BFEA  RTS
```

Interpretation :

- `$D034` contient la position/pointeur courant lie au joueur ou a la cellule active.
- `$DBB3` contient la position/pointeur de la sortie.
- Si les deux ne correspondent pas, la routine retourne immediatement.
- Si les deux correspondent, la sequence de fin de niveau demarre.

## Initialisation de la conversion temps vers score

Une fois la sortie atteinte, la routine initialise explicitement `$C6FD` a `1` :

```asm
BFFE  LDA #$01
C000  STA $C6FD
```

Point important :

- `$C6FD` est aussi charge au demarrage du niveau par `DA10` avec la valeur de score par diamant.
- Pour la sequence de fin, le code force cette valeur a `1`.
- La conversion du temps restant vers le score se fait donc par increments unitaires repetes, pas par le score standard des diamants.

## Boucle principale de conversion

La boucle de fin commence en `C003` et teste si le temps est arrive a `001` / `000` selon les trois digits stockes :

```asm
C003  LDA $C725
C006  CMPA #$01
C008  BNE $C048
C00A  LDA $C724
C00D  BNE $C048
C00F  LDA $C723
C012  BNE $C048
```

Si le temps n'est pas termine, la boucle execute :

```asm
C048  JSR $C59E
C04B  JSR $BD87
C04E  JSR $C5C3
C051  DEC $C0AC
C054  BNE $C003
```

Comportement prouve :

- `C59E` est appelee avant `C5C3`.
- `C59E` decremente et reaffiche le temps.
- `C5C3` incremente et reaffiche le score.
- La boucle revient ensuite en `C003` tant que le temps n'a pas atteint la condition de fin.
- `BD87` produit le petit effet video/flash deja documente separement.

## Decrement du temps via `C59E` puis `C63A`

`C59E` prepare l'affichage du temps et appelle `C63A` :

```asm
C59E  LDX #$5BBA
C5A3  STX $C6F8
C5A6  LDX #$C723
C5A9  STX $C6F6
C5AC  JSR $C63A
```

`C63A` decremente un compteur decimal stocke sur `$C723-$C725` :

```asm
C63D  LDY #$C725
C641  LDA ,Y
C647  DEC ,Y
```

Si le digit courant vaut zero, la routine remonte au digit precedent et applique les retenues decimales avec des `9` :

```asm
C64B  LEAY -1,Y
C65A  DEC ,Y
C65C  LEAY 1,Y
C65E  LDA #$09
C660  STA ,Y
```

Conclusion :

- Le temps est gere comme un compteur decimal/Bcd-like sur trois emplacements memoire.
- Pendant la fin de niveau, il est decremente progressivement par `C59E`/`C63A`.

## Increment du score via `C5C3`

`C5C3` configure le score en cible :

```asm
C5C5  LDX #$5BB1
C5C8  STX $C6F8
C5CB  LDX #$C71C
C5CE  STX $C6F6
C5D6  LDB $C6FD
```

Puis la boucle ajoute `$C6FD` fois une unite au dernier digit du score :

```asm
C5D9  INC $C721
C5EA  JSR $C675
C5ED  DECB
C5EE  BNE $C5D9
```

`C675` propage les retenues decimales sur `$C71C-$C721` :

```asm
C685  LDU #$C721
C688  LDA 0,U
C68A  CMPA #$09
C68E  SUBA #$0A
C692  INC -1,U
```

Conclusion :

- Le score est stocke comme une suite de digits decimaux sur `$C71C-$C721`.
- `C5C3` ajoute `$C6FD` unites au score.
- En fin de niveau, `$C6FD` vaut `1`, donc chaque tour de boucle ajoute `1` point.

## Cadence visuelle pendant la conversion

La boucle contient un compteur `$C0AC` :

```asm
C051  DEC $C0AC
C054  BNE $C003
C056  JSR $C073
C059  JSR $D1E0
C05C  COM $C0AD
C064  JSR $D1BB
C06A  LDA #$0A
C06C  STA $C0AC
C06F  LBRA $C003
```

Comportement prouve :

- Le decrement temps + increment score se produit a chaque tour de boucle.
- Toutes les `10` iterations, le code execute une mise a jour plus lourde : `C073`, `D1E0`, alternance `D1BB`, puis reset de `$C0AC` a `0x0A`.
- Cette cadence est probablement responsable de l'animation/couleur pendant la sequence de bonus.

## Fin de conversion

Quand le temps est considere termine, le code nettoie/raffiche le temps, puis sort vers la suite du jeu :

```asm
C014  CLR $C725
C017  LDX #$5BBA
C01D  LDX #$C723
C028  JSR $C516
C02B  LDX #$C72E
C031  JSR $C526
C034  CLR $C6FE
C037  LDA $CE32
C03C  JSR $C0AE
C03F  JSR $CD5B
C042  JMP $BB14
C045  JMP $8C74
```

Interpretation :

- Le compteur temps est stabilise/reaffiche a zero.
- Le jeu applique ensuite une attente/transition.
- Selon `$CE32`, le retour se fait vers une branche differente, probablement selon contexte normal/chargeur/sequence.

## Conclusion pour le portage moderne

Le comportement observe est confirme par l'ASM :

- L'arrivee du joueur sur la sortie declenche une sequence dediee.
- Le jeu force l'increment de score a `1` via `$C6FD`.
- A chaque tour de boucle, le temps restant est decremente et le score est incremente.
- La sequence continue jusqu'a epuisement du compteur temps.
- Le rendu HUD est mis a jour pendant cette conversion.
- Une cadence secondaire toutes les `10` iterations anime/rafraichit certains plans graphiques.

Implication moderne recommandee :

- Ne pas passer instantanement au niveau suivant quand le joueur atteint la sortie.
- Introduire un etat runtime `levelBonusCounting` ou equivalent.
- Pendant cet etat, bloquer le controle joueur et la physique active.
- Decrementer progressivement `hud.time` jusqu'a `0`.
- Incrementer `hud.score` de `1` a chaque decrement de temps.
- Passer au niveau suivant seulement apres la fin de cette conversion et un court delai de transition.
