# Phase 1 - Inventaire Et Cadrage

Ce document fixe l'etat de reference pour le remake moderne de **La Mine aux Diamants**. Il separe les sources utiles a la conversion build-time des elements qui ne doivent pas survivre dans le runtime final.

## Sources Consultees

- Depot courant: `README.md`, `resources.json`, `disk-resources.json`, `docs/title.png`, `docs/level-1.png`, `assets/`, `disk/`.
- Kit: `C:\a\Projets\to8-porting-kit-v2\README-la-mine-aux-diamants.md`.
- Artefacts du kit: `build/portage/minediamant-fbi-androides-saphir_to8-mine/assets`, `memory/memory-map.md`, `boot-mine-complete/boot-plan.json`.

## Ressources Utiles

Le catalogue actuel expose 56 ressources runtime, mais toutes ne doivent pas devenir des assets du remake. Pour le jeu moderne, elles servent d'entrees d'analyse et de conversion.

| Famille | Nombre | Usage remake |
|---|---:|---|
| Screenshots d'observation | 2 | Oracle visuel pour titre et premier niveau, pas source d'assets |
| Tilemaps candidates | 2 | Base de conversion niveaux/fonds |
| Sprites candidats | 2 | Base de conversion joueur/objets |
| Fontes candidates | 21 | Base de conversion texte bitmap/HUD |
| Palette candidate | 1 | Base de conversion couleurs TO8 |
| Audio candidat | 2 | Base de conversion sons courts |
| Ressources disque | 27 | Entrees build-time seulement, pas runtime |

Ressources graphiques candidates identifiees:

| Type | ID | Source | Taille | Notes |
|---|---|---|---:|---|
| tilemap | `DATA_A000_B9AC_007` | `data_A000_B9AC_007` | 6573 | Probable decor/niveau |
| tilemap | `DATA_7000_8C62_076` | `data_7000_8C62_076` | 7267 | Probable decor/niveau |
| sprite | `DATA_C39E_C41D_019` | `data_C39E_C41D_019` | 128 | 16x64, palette TO8 |
| sprite | `DATA_8F9C_901B_065` | `data_8F9C_901B_065` | 128 | 16x64, palette TO8 |
| palette | `DATA_CCB4_CCC3_040` | `data_CCB4_CCC3_040` | 16 | Palette candidate |
| audio | `DATA_C255_C29D_016` | `data_C255_C29D_016` | 73 | Son court candidat |
| audio | `DATA_C6AC_C6F2_024` | `data_C6AC_C6F2_024` | 71 | Son court candidat |
| font | `DATA_C336_C39D_018` et autres | multiples | 104-128 | Fontes 8 px candidates |

## Entrees TO8 Build-Time

Ces fichiers peuvent etre lus par les futurs scripts de conversion, mais ne doivent pas etre servis ni importes tels quels dans le runtime final.

| Fichier TO8 | Role observe | Usage remake |
|---|---|---|
| `LMINE1.BIN` | Chargeur/initialisation mine | Oracle comportement seulement |
| `ANTIBUG.BIN` | Patch/preload | Oracle seulement |
| `TABLEAU.BIN` | Donnees niveau/decor a `$A000` | Conversion tilemap/niveau |
| `KIT.BIN` | Routines/donnees partagees | Conversion sprites/fontes/regles si necessaire |
| `ENTET.BIN` | Ecran titre + entree `$8C63` | Conversion titre/assets |
| `ENT.BIN` | Donnees graphiques a `$7000` | Conversion tilemap/niveau |
| `6100.BIN` | Donnees courtes/preload | A verifier |
| `MOTOROF.BIN` | Controle cassette/moteur TO8 | Ignorer dans runtime moderne |
| `LMINE0.BIN` | Chargeur dynamique initial | Oracle seulement |
| `INFOGRAM.MAP` | Splash intro | Conversion intro |
| `LA_MINE.BAS` | Script de lancement | Documentation boot/oracle |

La disquette contient aussi d'autres fichiers de jeux ou branches (`SAPHIR`, `FBI`, `ANDROIDE`, etc.). Ils ne sont pas charges par le boot-plan complet de la mine et doivent rester hors scope du remake, sauf si une observation future prouve une dependance cachee.

## Boot Observe

Le port jouable actuel est base sur un boot-plan manuel. Les LOADM actifs sont:

1. `LMINE1.BIN`, exec `$4100`
2. `ANTIBUG.BIN`, exec `$0000`
3. `TABLEAU.BIN`, exec `$8C63`
4. `KIT.BIN`, exec `$0000`
5. `ENTET.BIN`, exec `$8C63`
6. `ENT.BIN`, exec `$8C63`
7. `6100.BIN`, exec `$8C63`
8. `MOTOROF.BIN`, exec `$DF00`
9. `LMINE0.BIN`, exec `$D800`

Autres charges actives:

- `INFOGRAM.MAP` en `LOADP`, utilise pour le splash.
- `LA_MINE.BAS`, utilise comme script de lancement/oracle.

Pour le remake, ce boot ne doit pas etre reproduit. Il sert a localiser les assets et a verifier le comportement.

## Ecrans Observes

| Ecran | Capture/oracle disponible | Etat |
|---|---|---|
| Intro Infogrames | `INFOGRAM.MAP` dans les ressources disque | A convertir/capturer en phase assets |
| Titre | `docs/title.png` | Capture du portage precedent, oracle visuel uniquement |
| Niveau 1 + HUD | `docs/level-1.png` | Capture du portage precedent, oracle visuel uniquement |
| Game over | Non disponible dans le depot | A capturer avec l'oracle actuel |
| Fin de jeu | Non disponible dans le depot | A capturer avec l'oracle actuel |

Metriques des captures disponibles:

| Fichier | Taille image | Taille logique cible | Couleurs uniques | SHA-256 |
|---|---:|---:|---:|---|
| `docs/title.png` | 1280x800 | 320x200, scale 4 | 14 | `FB594C4A1013B10520B3BA307B14BA46E1DE4D032D82AB438B956F23DB7D2103` |
| `docs/level-1.png` | 1280x800 | 320x200, scale 4 | 15 | `602C71918DBA898ECB50070C2B617ACCE4B301E1433DBEE2CD06E7B7002FE026` |

## Gameplay Observe

Observations confirmees par README et references visuelles:

- Resolution de jeu logique: 320x200.
- Rendu final: pixels nets, sans anti-aliasing, upscale x4 dans les screenshots fournis.
- Commandes du port actuel:
  - `Space`: avancer depuis intro/titre.
  - `C`: selectionner le clavier.
  - `Enter`: valider/demarrer.
  - Fleches: deplacer le personnage.
  - `Ctrl` ou `Space`: action.
- Le niveau 1 demarre avec:
  - score `000000`;
  - temps `229`;
  - record `000000`;
  - galerie `01`;
  - compteur de diamants `17`.
- Le HUD occupe la bande basse noire, avec etiquettes `Points`, `Temps`, `Record`, `Galerie`.
- Le terrain du niveau 1 contient:
  - bordure bleue/jaune;
  - zones vertes/noires;
  - rochers gris;
  - diamants collectables;
  - au moins un marqueur carre rouge/bleu;
  - un couloir horizontal vert clair.

Regles probables a confirmer pendant la reconstruction:

- Le joueur se deplace sur une grille ou pseudo-grille, mais l'unite exacte reste a mesurer.
- Les rochers, bordures et couloirs verts clairs semblent solides.
- Les diamants incrementent le score et decremente le compteur restant de la galerie.
- Le timer descend depuis `229`; la cadence exacte doit etre mesuree.
- Les conditions de fin de niveau dependent probablement du compteur de diamants et/ou de la sortie de galerie.
- Le role du marqueur rouge/bleu doit etre observe avant implementation definitive.

## Criteres D'Acceptation Pixel-Perfect

Pour valider le remake moderne:

- Le canvas logique doit rester exactement en 320x200.
- Le rendu affiche doit utiliser un upscale nearest-neighbor, sans interpolation.
- Le screenshot du titre doit matcher `docs/title.png` apres comparaison a echelle equivalente, sans utiliser ce screenshot comme asset source.
- Le screenshot initial du niveau 1 doit matcher `docs/level-1.png` apres comparaison a echelle equivalente, sans utiliser ce screenshot comme asset source.
- Le rendu ne doit pas introduire d'anti-aliasing: les couleurs doivent rester issues de la palette cible.
- Les tests visuels doivent figer le premier frame du niveau 1 avec `Points=000000`, `Temps=229`, `Record=000000`, `Galerie=01`, diamants `17`.
- Une tolerance de pixel-diff ne sera acceptee qu'apres justification documentee; la cible par defaut est 0 pixel different pour les ecrans statiques.

## Definition De Fin Phase 1

- Inventaire des ressources utiles etabli.
- Entrees TO8 build-time separees du futur runtime moderne.
- Ecrans de reference disponibles et manquants documentes.
- Regles observees et inconnues critiques notees.
- Criteres pixel-perfect initiaux definis.
