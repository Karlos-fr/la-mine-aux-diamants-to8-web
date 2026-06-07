# Analyse ASM/BIN du son - La Mine aux Diamants TO8

Objectif: reunir les preuves necessaires pour implementer proprement une couche son moderne, sans inventer de bruitages non prouves par le code original.

Date d'analyse: 2026-06-07.

## Conclusion courte

- Le materiel TO8 expose bien une sortie sonore via le PIA "Sound and Games": port B `x7CD`, donc `E7CD` dans la configuration TO observee. Les bits `PB0-PB5` forment un DAC 6 bits.
- La FD complete a revele le chaînon manquant: `KIT.BIN:$D9D3` appelle bien `KIT.BIN:$C255`.
- `KIT.BIN:$C255-$C2A4` est donc une routine bruitage active pour La Mine, appelee via `C5C3 -> D9B9 -> C255`.
- La routine `C255` ne produit pas une enveloppe DAC `E7CD`; elle bascule le bit `0x08` de `E7C1` avec deux durees courtes. C'est probablement le bruitage 1 bit utilise lors de la mise a jour score/diamant.
- `KIT.BIN:$CE9C: CLR $E7CD` reste confirme, mais correspond a une mise a zero/silence du DAC 6 bits, pas au bruitage `C255`.
- `KIT.BIN:$C6AC-$C6F2` est une routine HUD/score, pas du son.
- Aucune sequence firmware du type `LDB #$07 ; JSR $E803` n'a ete trouvee dans `KIT.BIN`, donc pas de beep firmware gameplay confirme.
- Pour une implementation moderne ISO, il faut au minimum reproduire le bruitage `C255` sur les evenements qui passent par `C5C3`, principalement ramassage/mise a jour score diamant, et garder les autres sons non prouves desactives.

## Sources inspectees

Sources locales:

- `extraction/sources/disk/kit_bin.bin`
- `extraction/sources/disk/lmine0_bin.bin`
- `extraction/sources/disk/lmine1_bin.bin`
- `extraction/sources/disk/entet_bin.bin`
- `extraction/sources/disk/ent_bin.bin`
- `extraction/sources/disk/pr_bin.bin`
- `extraction/sources/runtime/memory.bin`
- `docs/plans/phase-1-inventaire-cadrage.md`
- Artefacts externes du portage automatique dans `C:\a\Projets\to8-porting-kit-v2\build\portage\minediamant-fbi-androides-saphir_to8-mine`

Source materiel TO8 consultee:

- Documentation 6821 PIA Thomson: https://pulkomandy.tk/wiki/doku.php?id=documentations%3Adevices%3A6821

## Extraction FD complete

Image ajoutee au repo:

- `extraction/sources/disk/minediamant-fbi-androides-saphir_to8.fd`
- Taille: `327680` octets
- SHA-256 observe: `17082c451f73f23cc395e8c0079c5280975deaf1171e256d9b76b08eb36d209c`

Extraction dediee creee:

- `extraction/decoded-fd/minediamant-fbi-androides-saphir_to8/`
- `fd-inspection.json`: catalogue, geometrie, FAT, fichiers.
- `README.md`: rapport lisible.
- `files/*.raw`: 26 fichiers extraits depuis la FD.

La FD est bien une compilation de 4 jeux. Les fichiers extraits incluent notamment:

- La Mine: `LA_MINE.BAS`, `LMINE0.BIN`, `LMINE1.BIN`, `TABLEAU.BIN`, `KIT.BIN`, `ENTET.BIN`, `ENT.BIN`, `MOTOROF.BIN`.
- F.B.I: `FBI.BAS`, `LFBI1.BIN`, `FBI7.BIN`, `FBI9.BIN`.
- Androide: `ANDROIDE.BAS`, `LANDR1.BIN`, `ANDRDF.BIN`, `TABLEAU.BIN`.
- Saphir: `SAPHIR.BAS`, `LSAPH1.BIN`, `TABLES.TO7`, `DEUX.BIN`, `SAPHIR.MAP`.

La chaine La Mine prouvee par les chaines BASIC/LOADM est:

```txt
AUTO.BAT -> RUN "LA_MINE"
LA_MINE.BAS -> LOADM "LMINE0",,R
LMINE0.BIN -> "0:LMINE1  .BIN"
LMINE1.BIN -> "0:TABLEAU .BIN", "0:KIT     .BIN", "0:ENTET   .BIN", "0:ENT     .BIN", "0:MOTOROF .BIN"
```

Les fichiers des autres jeux contiennent plusieurs ecritures non nulles vers `E7CD`, donc des routines sonores existent bien sur la compilation. Elles ne sont pas chargees par la chaine La Mine ci-dessus.

## Chargement des BIN utiles

Les en-tetes LOADM/BIN donnent les zones suivantes:

| Fichier | Bloc principal observe | Role |
|---|---:|---|
| `LMINE1.BIN` | `$4100-$4562` | chargeur/initialisation |
| `LMINE0.BIN` | `$D800-$DBFF` | chargeur dynamique initial |
| `TABLEAU.BIN` | `$A000-$B9AC` | donnees niveaux/decor |
| `KIT.BIN` | `$BB00-$DBB6` | routines gameplay, HUD, sprites, physique |
| `ENTET.BIN` | `$8C63-$9562` | ecran titre/entete |
| `ENT.BIN` | `$7000-$8C62` | donnees graphiques/intro |
| `PR.BIN` | `$6100-$B437` | branche multi-jeux/boot, hors runtime moderne de La Mine |

Le gameplay moderne reproduit essentiellement `KIT.BIN`, plus les donnees decodees depuis `TABLEAU.BIN`/`ENT.BIN`.

## Materiel son TO8 pertinent

La documentation du PIA Thomson indique:

- PIA "Sound and Games": port B `x7CD`.
- Sur TO, les acces observes utilisent la famille `E7xx`, donc le port DAC est `E7CD`.
- `PB0-PB5` correspondent aux bits DAC `0..5`.
- `PB6/PB7` servent aussi aux boutons joystick.

Consequence pour le portage:

- Une ecriture non nulle repetee vers `E7CD` pourrait produire un signal DAC.
- Une ecriture `CLR $E7CD` met la sortie DAC a zero.
- Utiliser le DAC et les entrees joystick en meme temps est delicat sur la machine originale, mais le portage moderne peut decoupler ces contraintes.

## Scan des acces son possibles

Acces `E7CD` trouves dans les zones chargees:

| Zone | Adresse | Instruction | Interpretation |
|---|---:|---|---|
| `KIT.BIN` | `$CE9C` | `CLR $E7CD` | silence DAC, confirme dans une routine executee |
| `ENTET.BIN` | `$9427/$944F/$946A` | ecritures `E7CD` vues par scan brut | non retenues: aucun appel ou branchement vers ces adresses; zone probablement donnee/code auto-desassemble |
| `PR.BIN`/`ENT.BIN` | multiples | ecritures `E7CD` | hors runtime moderne La Mine; liees au boot/branches/intro, non gameplay KIT |

Acces `E7C1` trouves dans `KIT.BIN`:

- `$BD8B/$BD90`
- `$BDFF/$BE04`
- `$BE1E/$BE23`

Ces acces ne sont pas retenus comme son gameplay TO:

- D'apres la documentation materiel TO, le son DAC utile est sur `E7CD`, pas `E7C1`.
- Les routines concernees appartiennent aux effets graphiques d'explosion/temporisation (`BD87`, `BD9F`, `BDC9`...), pas a des appels d'evenements sonores.

## Faux positifs audio du portage automatique

Le plan d'inventaire historique listait:

- `DATA_C255_C29D_016`, note "Son court candidat"
- `DATA_C6AC_C6F2_024`, note "Son court candidat"

Les artefacts du portage automatique les classaient audio avec l'evidence:

- `not reachable from control-flow`
- `high byte variation with low silence ratio`

Cette evidence est insuffisante et meme dangereuse ici: "not reachable" signifie que le bloc a ete classe par heuristique, pas par preuve de routine son active.

Verification complementaire dans le desassemblage genere:

- Repertoire inspecte: `C:\a\Projets\to8-porting-kit-v2\build\portage\minediamant-fbi-androides-saphir_to8-mine`.
- `analysis/calls.json` contient `0` reference d'appel vers `$C255`, mais cette absence est contredite par le scan direct de la FD complete: `KIT.BIN:$D9D3` contient `BD C2 55`, donc `JSR $C255`.
- `analysis/calls.json` contient `0` reference d'appel vers `$C6AC`.
- `analysis/entities.json` classe `$C255-$C29D` comme `asset:C255:C29D`, `kind: asset`, `confidence: candidate`, evidence `not reachable from control-flow`.
- `analysis/entities.json` classe `$C6AC-$C6F2` comme `asset:C6AC:C6F2`, `kind: asset`, `confidence: candidate`, evidence `not reachable from control-flow`.
- Le meme graphe confirme les appels firmware actifs vers `$E806` et `$E827` depuis `KIT.BIN`, mais ceux-ci correspondent au clavier/controle et non a un appel son.

Cette verification explique le piege: le porting-kit a detecte `C255` comme "asset audio" non atteignable, mais son graphe d'appels n'a pas capture la route `C5C3 -> D9B9 -> C255`. La FD complete et le scan direct de `KIT.BIN.raw` doivent donc primer.

### `KIT.BIN:$C255-$C2A4`

Desassemblage fiable:

```asm
$C255  PSHS $36
$C257  CLRB
$C258  LDY #$C739
$C25C  LDA ,Y
$C25E  CMPA #$00
$C260  BEQ $C266
$C262  DEC ,Y
$C264  BRA $C280
$C266  LEAY -1,Y
$C268  INCB
$C269  LDA ,Y
$C26B  CMPA #$00
$C26D  BEQ $C266
$C26F  CMPY #$C737
$C273  BEQ $C280
$C275  DEC ,Y
$C277  LEAY 1,Y
$C279  LDA #$09
$C27B  STA ,Y
$C27D  DECB
$C27E  BNE $C277
$C280  LDY #$C2A6
$C284  LDU #$C2AC
$C287  LDB ,U+
$C289  CMPB #$DD
$C28B  BEQ $C2A4
$C28D  LDX ,Y++
$C28F  PSHS $04
$C291  LDA $E7C1
$C294  EORA #$08
$C296  STA $E7C1
$C299  DECB
$C29A  BNE $C299
$C29C  PULS $04
$C29E  LEAX -1,X
$C2A0  BNE $C28F
$C2A2  BRA $C287
$C2A4  PULS $B6
```

Tables immediates:

```txt
$C2A6: 00 50 00 60 DD DD
$C2AC: 30 60 DD
$C737: DD
$C738: FF
$C739: FF
$C73A: DD
```

Interpretation:

- Cette routine a une structure de generateur de tonalite: deux durees `X` (`$0050`, `$0060`) et deux compteurs `B` (`$30`, `$60`) pilotent une boucle qui bascule un bit.
- Elle bascule `$E7C1` avec `EORA #$08`, pas le DAC `E7CD`.
- La FD complete prouve un appel direct: `KIT.BIN:$D9D3: JSR $C255`.
- Les references vers `$C2A6/$C2AC` restent internes a `$C255`.
- Conclusion: routine bruitage active, a reproduire dans le portage moderne.

Pseudo-code exploitable:

```txt
state = [$C737, $C738, $C739] avec sentinelles autour de la zone

Si $C739 > 0:
  decrementer $C739
Sinon:
  remonter vers $C738 puis $C737 jusqu'a trouver un compteur non nul
  propager des valeurs $09 vers les compteurs de droite

Pour chaque segment sonore:
  durations = [$0050, $0060]
  repeatCounts = [$30, $60]

  Pour segment 0:
    X = $0050
    B = $30
    Repeter X fois:
      basculer bit 3 de $E7C1: E7C1 = E7C1 XOR $08
      attendre B iterations via boucle DECB/BNE

  Pour segment 1:
    X = $0060
    B = $60
    Repeter X fois:
      basculer bit 3 de $E7C1
      attendre B iterations

  Stop sur sentinelle $DD dans la table repeatCounts
```

Notes implementation Web Audio:

- Reproduire `C255` comme un son 1 bit, pas comme un sample PCM DAC `E7CD`.
- Utiliser une onde carree ou un `AudioWorklet`/buffer qui alterne deux segments.
- Les durees relatives sont plus importantes que la frequence absolue au premier passage: segment 1 court/aigu (`B=$30`, `X=$0050`), puis segment 2 plus long/grave (`B=$60`, `X=$0060`).
- Pour une approximation ISO initiale, convertir les boucles 6809 avec la cadence deja documentee dans `TO8_RUNTIME_TIMING.md`; raffiner ensuite a l'oreille/emulateur si necessaire.
- Ne pas rejouer `C255` si le compteur `$C738/$C739` serait nul dans l'ASM, afin d'eviter un clic parasite hors update score/diamants.

### Chaine d'appel active vers `C255`

Preuve dans `KIT.BIN.raw` extrait depuis la FD:

```asm
$C5C3  PSHS $76
...
$C5F0  JSR $C516
$C5F3  LDX #$C727
$C5F6  STX $C6F6
$C5F9  JSR $C526
$C5FC  JSR $D9B9
$C5FF  PULS $F6
```

`C5C3` est appelee par plusieurs routines liees au score/deplacement:

```txt
$C04E -> JSR $C5C3
$CDF0 -> JSR $C5C3
$CF14 -> JSR $C5C3
$CF70 -> JSR $C5C3
$CFC6 -> JSR $C5C3
$D008 -> JSR $C5C3
```

La route joueur vers diamant est notamment visible autour de `$CDE3-$CDF3`:

```asm
$CDE3  CMPA #$03
$CDE5  BEQ $CDF0
...
$CDF0  JSR $C5C3
$CDF3  LDA #$05
$CDF5  STA ,X
```

`D9B9` decide ensuite si le bruitage et le rendu compteur doivent etre joues:

```asm
$D9B9  PSHS $02
$D9BB  LDA $C739
$D9BE  CMPA #$01
$D9C0  BNE $D9C7
$D9C2  LDA $C738
$D9C5  BEQ $D9DB
$D9C7  LDA $C739
$D9CA  BNE $D9D3
$D9CC  LDA $C738
$D9CF  BNE $D9D3
$D9D1  PULS $82
$D9D3  JSR $C255
$D9D6  JSR $C222
$D9D9  PULS $82
```

Interpretation pratique:

- `C5C3` met a jour les champs de score/HUD.
- `D9B9` teste le compteur `$C738/$C739`, qui correspond aux petits compteurs de galerie/diamants.
- Si le compteur n'est pas nul, la routine joue `C255`, puis rafraichit le panneau droit via `C222`.
- Le cas special `$C739 == 1 && $C738 == 0` passe par `$D9DB`, qui lance une sequence avec `D9A3/D9B2` avant de revenir vers `$D9C7`.

### `KIT.BIN:$C6AC-$C6F2`

Desassemblage fiable:

```asm
$C6AC  PSHS $76
$C6AE  LDX #$C71C
$C6B1  LDY #$C73D
$C6B5  LDA ,X+
$C6B7  CMPA ,Y+
$C6B9  BHI $C6C4
$C6BB  BCS $C6F1
$C6BD  CMPX #$C722
$C6C0  BNE $C6B5
$C6C2  PULS $F6
$C6C4  LDX #$C71C
$C6C7  LDY #$C73D
$C6CB  LDA ,X+
$C6CD  STA ,Y+
$C6CF  CMPX #$C722
$C6D2  BNE $C6CB
$C6D4  LDB #$0B
$C6D6  STB $C6FC
$C6D9  LDX #$5BC0
$C6DC  STX $C6F8
$C6DF  LDX #$C73D
$C6E2  STX $C6F6
$C6E5  JSR $C516
$C6E8  LDX #$C727
$C6EB  STX $C6F6
$C6EE  JSR $C526
$C6F1  PULS $F6
```

Interpretation:

- Compare `C71C-C721` avec `C73D-C742`.
- Met a jour des champs HUD via les renderers de fontes `$C516/$C526`.
- Aucun acces son.
- Conclusion: faux positif audio, routine HUD/record.

## Routine `KIT.BIN:$CE9B-$CEA2`

Extrait:

```asm
$CE9B  CLRA
$CE9C  CLR $E7CD
$CE9F  JSR $E827
$CEA2  LBCS $CD65
```

Contexte:

- Cette zone appartient au traitement clavier/attract/player control autour de `$CDF9-$CEA8`.
- `CLR $E7CD` force le DAC a zero.
- Aucun motif adjacent n'ecrit une enveloppe ou une valeur non nulle vers `E7CD`.

Interpretation:

- C'est une protection/silence DAC avant lecture firmware/clavier, pas un bruitage.
- Pour le portage moderne, cela justifie de remettre les sons a l'etat silence quand le jeu est en pause/transition si une couche son est ajoutee.

## Firmware `E803`, `E806`, `E827`

References pertinentes trouvees:

| Adresse appelante | Appel | Interpretation |
|---|---|---|
| `KIT:$BF1F`, `KIT:$C0C5`, `KIT:$CDFE` | `JSR $E806` | lecture clavier firmware |
| `KIT:$C0C0`, `KIT:$CDAA`, `KIT:$CE9F` | `JSR $E827` | lecture/etat clavier ou attente firmware selon contexte |
| `KIT:$D812` | `LDB #$11 ; JSR $E803` | initialisation affichage/controle, pas beep |

Sequences absentes:

- Pas de `LDB #$07 ; JSR $E803` dans `KIT.BIN`.
- Pas d'appel firmware son explicite identifie dans la boucle gameplay.

## Evenements gameplay modernes a exposer au systeme son

Maintenant que `C255` est prouve dans `KIT.BIN`, l'architecture moderne peut exposer des evenements propres. Cela permettra:

- de jouer le bruitage ISO `C255` pour les evenements qui passent par `C5C3`;
- de garder les autres evenements silencieux tant qu'ils ne sont pas prouves;
- d'activer facilement une piste "modernisee" plus tard, separee du mode ISO.

Evenements recommandes:

| Evenement moderne | Source runtime actuelle | Statut ASM son |
|---|---|---|
| `diamondCollected` | `RuntimeEvent` existant | jouer `C255`, prouve via `CDE3/CDF0 -> C5C3 -> D9B9 -> C255` |
| `exitOpened` | `RuntimeEvent` existant | pas de son original prouve; effet visuel prouve separement |
| `levelCompleted` | `RuntimeEvent` existant | pas de son dedie prouve; le bonus score peut reutiliser `C255` si le flux moderne passe par l'equivalent `C5C3` |
| `playerKilled` | a ajouter lors de `killPlayer(...)` | pas de son original prouve |
| `explosionStarted` | a ajouter dans `startExplosion(...)` | pas de son original prouve |
| `rockPushed` | a ajouter lors de la poussee rocher | pas de son original prouve |
| `fallingObjectLanded` | a ajouter dans `completeFallingObject(...)` | pas de son original prouve |
| `monsterKilled` | a ajouter lors de `deactivateMonster(...)` par impact/explosion | pas de son original prouve |
| `spawnBlink` | optionnel, sequence `BE68` | pas de son original prouve |

## Proposition d'architecture moderne

Fichiers conseilles:

- `src/audio/audio-events.ts`
- `src/audio/audio-engine.ts`
- `src/audio/to8-sound-profiles.ts`
- `src/game/runtime-audio-events.ts` si l'on veut garder la nomenclature cote domaine gameplay.

### `audio-events.ts`

Definir les evenements sonores abstraits:

```ts
export type GameAudioEvent =
  | { readonly type: "diamondCollected" }
  | { readonly type: "exitOpened" }
  | { readonly type: "levelCompleted" }
  | { readonly type: "playerKilled"; readonly reason: "fallingRock" | "fallingDiamond" | "monsterContact" | "explosion" }
  | { readonly type: "explosionStarted"; readonly result: "clear" | "diamonds" }
  | { readonly type: "rockPushed" }
  | { readonly type: "fallingObjectLanded"; readonly kind: "rock" | "diamond" }
  | { readonly type: "monsterKilled"; readonly kind: "monster" | "specialCreature" };
```

### `audio-engine.ts`

Responsabilites:

- Initialiser un `AudioContext` seulement apres interaction utilisateur.
- Exposer `setMuted(boolean)`.
- Exposer `play(event: GameAudioEvent)`.
- En mode ISO strict, jouer uniquement les evenements prouves, donc `diamondCollected`/score via le profil `C255`.
- En mode optionnel modernise, jouer des blips synthetiques courts.

### `to8-sound-profiles.ts`

Deux profils:

```ts
export const TO8_ISO_PROFILE = {
  diamondCollected: "kitC255ScoreTick",
  exitOpened: null,
  levelCompleted: null,
  playerKilled: null,
  explosionStarted: null,
  rockPushed: null,
  fallingObjectLanded: null,
  monsterKilled: null
};

export const TO8_MODERNIZED_DEBUG_PROFILE = {
  // Bruitages non ISO, a garder optionnels.
};
```

## Statut ISO recommande

Pour rester honnete avec les preuves:

- Presenter uniquement `C255` comme bruitage original prouve pour la route score/diamant.
- Implementer l'infrastructure son, oui.
- Le profil ISO ne doit pas etre muet pour `diamondCollected` si le score/compteur est effectivement mis a jour.
- Eventuellement ajouter un toggle debug/modernise pour tester une proposition sonore, mais l'etiqueter explicitement non ISO.

## Points encore verifiables plus tard

Ces points ne bloquent pas l'implementation d'une architecture son propre, mais peuvent enrichir le profil ISO si l'on obtient une preuve supplementaire:

- Capturer l'audio d'une execution emulateur de la disquette originale pendant:
  - ramassage diamant;
  - ouverture sortie;
  - explosion monstre;
  - mort joueur;
  - fin de niveau.
- Tracer dynamiquement les ecritures vers `E7CD` pendant ces actions.
- Confirmer si `PR.BIN` ou `ENTET.BIN` produisent un son hors gameplay, par exemple pendant l'intro ou le boot.
- Verifier si une variante disque ou une autre branche contient une routine son appelee que la branche La Mine n'utilise pas.

## Decision d'implementation

Etat actuel suffisant pour implementation:

- Oui pour une couche technique son moderne.
- Oui pour un bus d'evenements sonores gameplay.
- Oui pour un mode ISO qui joue `C255` sur `diamondCollected`/score.
- Non pour les autres bruitages actifs, car explosion, mort joueur, poussee rocher et sortie ouverte ne sont pas encore prouves par la branche La Mine.

La prochaine implementation devrait donc viser une architecture extensible, avec un premier bruitage ISO `kitC255ScoreTick` et des autres evenements silencieux.
