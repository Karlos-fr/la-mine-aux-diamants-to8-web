# Plan Runtime Niveau 1 - Vue, Bordures Et Entites

Objectif: reproduire le chargement/runtime du niveau a partir des preuves du code original, sans utiliser la fixture globale comme ecran final. La fixture `docs/extraction/levels/mine-level-01.png` reste une carte complete extraite; le jeu affiche une fenetre partielle pilotee par les variables runtime.

## Preuves ASM/portage

- Decode niveau: `KIT.BIN:$DA10`.
- Grille runtime: base `DBB7`, stride `0x28` / 40 colonnes.
- Zone utile decodee: 38 colonnes x 20 lignes.
- Cellules de remplissage hors zone utile: `tileId 0x04`, via `DA43: LDD #$0404` avant remplissage.
- Viewport rendu: `KIT.BIN:$D0CC`.
- Dimensions viewport: `D0CC: LDD #$1309`, puis boucles inclusives `CMPA #$14` et `CMPA #$0A`, donc 20 colonnes x 10 lignes.
- Origine viewport: `DBAF` pour X et `DBB0` pour Y, utilises par `D0D2-D0E7`.
- Buffer de vue: `D8D9`, 20 colonnes x 10 lignes.
- Blit tuiles: `D115-D144` relit `D8D9`, place la tuile courante en `$D217`, puis appelle `KIT.BIN:$D145`.
- Atlas tuiles: `KIT.BIN:$D145`, base `$D218`, stride `0x40`, tuiles 16x16.
- Spawn joueur: header niveau bytes `+4/+5`, stockes comme position grille; niveau 1 decode en `(1,1) -> 0xDC09`.
- Pointeur joueur runtime: `$D034`.
- Animation idle joueur: `KIT.BIN:$CED9`, table `$D036-$D069`, ecrit la frame courante a l'adresse pointee par `$D034`.
- Diamants: `tileId 0x03`, animation couleur par `KIT.BIN:$D1E0`, rotation du plan couleur `$D2F8-$D317`.
- Monstres: `tileId 0x02`, positions speciales detectees par `KIT.BIN:$DA10` et routines `BC07/CC5B`.
- Animation monstre: `KIT.BIN:$D1BB`, inversion/complement du plan forme `$D298-$D2B7`.

## Architecture runtime a ajouter

- `ViewportState`
  - `x`: origine grille runtime, source `DBAF`.
  - `y`: origine grille runtime, source `DBB0`.
  - `columns`: 20.
  - `rows`: 10.
  - `stride`: 40.
  - `fillTileId`: `0x04`.

- `LevelRuntimeGrid`
  - garde la grille utile `38x20`.
  - expose `getRuntimeTile(x, y)` avec stride 40.
  - retourne `0x04` hors largeur utile mais dans la fenetre runtime, afin de rendre les bordures/limites bleu-jaune.

- `EntityState` a etendre
  - `gridX`, `gridY` pour position logique prouvee.
  - `x`, `y` restent en pixels runtime.
  - `animationKey` pour `playerIdle`, `diamondColorCycle`, `monsterBlink`.
  - `movement` optionnel pour monstres, a brancher apres preuve des routines de deplacement.

## Implementation cible

- [x] Remplacer le rendu direct `level.tiles[y * width + x]` par une lecture `LevelRuntimeGrid.getRuntimeTile(viewport.x + x, viewport.y + y)`.
- [x] Conserver viewport `20x10`, mais piloter son origine par `ViewportState` et non par constantes fixes non documentees.
- [x] Dessiner les bordures/limites via `tileId 0x04` quand la fenetre sort de la zone utile `38x20`.
- [x] Corriger le point de spawn joueur depuis `mineLevel01Metadata.playerStart`.
- [x] Faire du joueur une entite animee avec les frames `player.idleCycle` extraites depuis `$D036-$D069`.
- [x] Faire des diamants des entites animees utilisant les frames `diamond.colorCycle` extraites depuis `KIT.BIN:$D1E0`.
- [x] Faire des monstres des entites animees utilisant les frames `monster.blinkToggle` extraites depuis `KIT.BIN:$D1BB`.
- [x] Ajouter un modele `MonsterRuntimeState` separe, puis implementer le deplacement seulement apres analyse des routines qui modifient les positions speciales `0x02`.
- [x] Implementer le scrolling dynamique lie au joueur d'apres les seuils ASM: marges ecran `X=4/15`, `Y=2/7`, bornes viewport `DBAF<=0x14`, `DBB0<=0x0c`.
- [ ] Basculer la suite gameplay/collision vers `docs/plans/gameplay-collision-runtime-plan.md`.

## Hors scope immediat

- Deplacement exact des monstres tant que les routines de decision/collision associees a `CC5B`, `CC57`, `BC07` et la boucle principale ne sont pas completement tracees.
- Chute rochers/diamants et explosions, meme si les assets sont deja extraits.
