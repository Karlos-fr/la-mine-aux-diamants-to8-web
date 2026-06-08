# Cadences runtime TO8 du portage moderne

## Base d'horloge

- Machine cible: Thomson TO8.
- CPU: Motorola 6809E a 1 MHz.
- Cadence video PAL retenue: 50 Hz.
- Tick logique moderne: 20 ms.
- Source moderne: `src/engine/constants.ts` expose `FIXED_UPDATE_RATE = 50`.
- Table runtime: `src/game/runtime-timing.ts`.

## Regle d'architecture

La logique gameplay doit avancer en ticks entiers. Le rendu moderne peut interpoler entre deux etats logiques, mais il ne doit pas devenir une source de verite pour les collisions, la collecte, les monstres ou la physique.

## Table des cadences

| Systeme | Routine ASM | Cadence moderne | Statut | Justification |
| --- | --- | ---: | --- | --- |
| Spawn demi-blink | `$BE68`, `$CD5B` | 13 ticks | Approximation documentee | `$BE68` boucle `$C09D = 0x06`; la temporisation depend de delais CPU et de rendus intermediaires |
| Mouvement joueur | Routines joueur autour de `$CE..` | 8,6 ticks | Calibration moderne | Duree ajustee entre 8 et 9 ticks apres comparaison visuelle avec l'original, notamment via le mode attract |
| Unite script attract | `$CDF9`, `$CE33`, `$CE34`, table `$D878` | 8,6 ticks | Calibration moderne | Les durees raw du script sont des repetitions de commande; une attente `0x10 0x40` dure donc `0x40` unites, alignees par defaut sur le pas joueur |
| Idle joueur | `$CED9` et metadata joueur | 40 ticks | Hypothese moderne | Delai moderne conserve, exprime en ticks entiers |
| Decision monstre standard | `$CA04` | 14 ticks | Hypothese moderne centralisee | `$CA04` est appele par boucle principale; la conversion exacte du tour ASM reste indirecte |
| Decision creature speciale | `$BC84` | 14 ticks | Hypothese moderne centralisee | `$BC84` est appele dans la meme boucle que `$CA04`; cadence commune conservee |
| Mouvement monstre | Rendu moderne | 9 ticks | Rendu moderne | Duree de pas decouplee de la decision logique |
| Scan physique rocher/diamant | `$CB07`, `$CB17` | 14 ticks | Hypothese moderne centralisee | `$CB07` scanne la grille par boucle principale; cadence moderne conservee en ticks |
| Mouvement physique | Rendu moderne | 14 ticks | Rendu moderne | Chute/glissade visible decouplee de la mutation de grille |
| Explosion | `$CCC6`, `$CCFE` | 6 ticks | Hypothese moderne | Frames `0x14`, `0x15`, `0x16`, `0x05`; cadence moderne centralisee |
| Diamant gameplay | `$D1E0` | 6 ticks | Visuel moderne | `$D1E0` modifie le plan couleur original; portage via atlas anime |
| Blink monstre | `$D1BB` | 13 ticks | Visuel moderne | `$D1BB` modifie les plans graphiques; portage via atlas anime |
| Diamant HUD | Rendu HUD moderne, inspire animations ASM | 6 ticks | Visuel moderne | Ne participe pas aux collisions ni a la collecte |
| Sortie ouverte | `$BFB6`, rendu moderne | 13 ticks | Visuel moderne | Blink visuel sans mutation de la grille runtime |
| Compteur temps HUD | Logique compteur temps | 50 ticks | Stable | Une seconde logique par decrement du compteur temps |
| Compteur titre attract | `$8DD8`, comparaison `$34` | 13 ticks par passage | Calibration moderne | Le seuil ASM est prouve; la duree exacte d'un passage titre depend des routines graphiques/temporisations |
| Script attract | `$CDF9`, `$CE31`, `$CE33`, `$CE34` | 1 lecture par tick attract moderne disponible | Partiel | Lecture decouplee du rendu joueur; ordre attract dedie dans `GameplayRuntime` |

## Points encore non cycle-perfect

- La duree exacte d'un tour complet de boucle ASM n'est pas reconstruite au cycle CPU pres.
- Les routines de rendu et de delai CPU, notamment `$CD5B`, rendent la conversion vers frames PAL indirecte.
- Les cadences modernes privilegient des ticks entiers et une architecture lisible plutot qu'une emulation cycle-exacte.
- Le mode attract est rapproche de l'ordre ASM, avec un rendu controle par les options modernes.

## Regle pour les futures modifications

- Toute nouvelle cadence gameplay doit etre ajoutee dans `src/game/runtime-timing.ts`.
- Toute nouvelle cadence doit etre referencee ici avec son statut.
- Les secondes litterales dans le gameplay doivent rester exceptionnelles et documentees.
- Une valeur prouvee par ASM doit remplacer une hypothese moderne des qu'elle est suffisamment etablie.
