# Plan d'ajustement des cadences runtime TO8

## Objectif

Remplacer les durees modernes arbitraires du gameplay par des cadences logiques exprimees en ticks TO8, afin de rapprocher le portage moderne du comportement original, en particulier pour le mode attract.

Le moteur moderne conserve un rendu fluide, mais les decisions gameplay doivent etre cadencees par une horloge logique stable et documentee.

## Base retenue

- CPU TO8: Motorola 6809E a 1 MHz.
- Cadence video PAL utile: 50 Hz.
- Tick logique moderne cible: 1 / 50 s = 20 ms.
- Le portage possede deja une boucle fixe a 50 Hz dans `src/engine/constants.ts`.

Le chantier ne consiste donc pas a changer la boucle globale, mais a remplacer les constantes locales en secondes par des cadences entieres en ticks, prouvees ou documentees.

## Phase 1 - Inventaire des cadences modernes

- [x] Lister toutes les constantes de duree en secondes dans le runtime gameplay.
- [x] Convertir chaque duree actuelle en nombre de ticks a 50 Hz.
- [x] Identifier les valeurs non entieres comme `0.21s` ou `0.25s`.
- [x] Classer chaque cadence par domaine: joueur, spawn, monstres, physique, animations, HUD, attract.
- [x] Documenter les valeurs actuelles et leur statut: prouvee ASM, hypothese stable, ou reglage moderne.

### Inventaire phase 1

| Domaine | Ancienne valeur | Ticks a 50 Hz | Statut |
| --- | ---: | ---: | --- |
| Spawn joueur, demi-blink | `0.25s` | `12.5` | Hypothese moderne, routine `$BE68` a affiner |
| Mouvement joueur | `0.21s` | `10.5` | Hypothese moderne, interpolation visuelle |
| Delai idle joueur | `0.8s` | `40` | Hypothese moderne liee a `$CED9` |
| Decision monstres | `0.28s` | `14` | Hypothese moderne, routines `CA04`/`BC84` a affiner |
| Interpolation monstres | `0.18s` | `9` | Hypothese moderne, rendu fluide |
| Scan physique | `0.16s` | `8` | Hypothese moderne, routine `CB07` a affiner |
| Interpolation physique | `0.18s` | `9` | Hypothese moderne, rendu fluide |
| Explosion | `0.12s` | `6` | Hypothese moderne, routines `CCC6`/`CCFE` a affiner |
| HUD temps | `1s` | `50` | Cadence historique du compteur temps |

## Phase 2 - Table centrale de cadences TO8

- [x] Creer une table centrale de constantes en ticks, sans modifier encore le comportement.
- [x] Ajouter un helper `secondsFromTicks(ticks)` ou equivalent.
- [x] Remplacer progressivement les constantes en secondes par des constantes derivees de ticks.
- [x] Garder les interpolations visuelles en secondes derivees, pas en nombres magiques.
- [x] Documenter chaque constante avec la routine ASM associee quand elle est connue.

Implementation: `src/game/runtime-timing.ts` centralise `TO8_RUNTIME_TIMING` et `secondsFromTo8Ticks`. `src/screens/gameplay-scene.ts` derive maintenant ses durees gameplay depuis cette table.

## Phase 3 - Separation stricte logique/rendu

- [x] Identifier les endroits ou une interpolation visuelle influence encore une decision logique.
- [x] Garantir que les decisions de grille se font sur ticks entiers.
- [x] Conserver le rendu fluide uniquement comme interpolation entre deux etats logiques.
- [x] Verifier le joueur, la camera, les monstres et les objets physiques.
- [x] Documenter les cas ou le rendu interpole doit rester visible sans changer l'ordre logique.

### Notes phase 3

- Les recherches logiques d'entites dans `src/screens/gameplay-scene.ts` n'utilisent plus `Math.round` sur `gridX/gridY`.
- Les entites interpolees restent visibles via le rendu fluide, mais elles ne deviennent plus occupantes d'une cellule logique par simple arrondi.
- Les monstres restent pilotes par leur etat runtime discret (`monster.gridX/gridY`) et leur cible de mouvement (`movement.toX/toY`) pour les collisions.
- Les objets physiques mutent la grille au demarrage et a la fin du mouvement; leur interpolation reste visuelle.
- La camera interpole uniquement le viewport de rendu et ne modifie pas les coordonnees de grille.

## Phase 4 - Cadence du spawn joueur

- [x] Reanalyser la routine ASM `$BE68` et les routines appelees autour du spawn.
- [x] Determiner si le blink de spawn depend d'une boucle CPU ou d'un compteur de frame.
- [x] Convertir la sequence de spawn en ticks entiers.
- [x] Remplacer la duree moderne `PLAYER_SPAWN_BLINK_STEP_DURATION`.
- [x] Verifier que la sequence reste `0x04`, noir, repetee, puis apparition joueur.
- [x] Documenter les incertitudes restantes si la temporisation exacte n'est pas prouvable.

### Notes phase 4

- `$BB14` saute vers `$BE68`, qui recharge le niveau, initialise la grille et prepare le pointeur joueur `$D034`.
- `$BE68` initialise `$C09D` a `0x06`, ce qui prouve 6 demi-etapes, donc 3 cycles `0x04` puis vide/noir.
- La boucle compare la tuile pointee par `$D034` a `0x05`: si elle vaut `0x05`, elle devient `0x04`; sinon elle est incrementee, ce qui ramene le cas attendu `0x04` vers `0x05`.
- La temporisation visible depend d'appels de rendu/animation et de la boucle CPU `$CD5B` (`LDX #$0FA0`, puis boucle `LEAX -1,X / BNE`), pas d'un compteur de frame PAL explicite.
- Le portage conserve donc une cadence logique entiere de `13` ticks TO8 par demi-etape, soit `0.26s`, derivee du comportement actuel et documentee dans `src/game/runtime-timing.ts`.
- Incertitude restante: la conversion exacte cycles CPU vers PAL n'est pas entierement reconstruite, car `$BE68` melange rendu, animations `D1E0/D1BB`, rafraichissements et delais CPU. La valeur retenue est une approximation documentee, pas une preuve cycle-perfect.

## Phase 5 - Cadence des monstres et creatures speciales

- [x] Reanalyser les appels ASM `CA04` et `BC84` dans la boucle principale.
- [x] Verifier si les monstres avancent a chaque boucle logique ou via un compteur intermediaire.
- [x] Convertir `MONSTER_MOVE_INTERVAL` en ticks entiers.
- [x] Convertir `MONSTER_GRID_MOVE_DURATION` en ticks entiers pour le rendu fluide.
- [x] Distinguer explicitement monstre standard `0x02` et creature speciale `0x17` si leurs cadences different.
- [x] Valider que le mode attract utilise la meme cadence que l'original.

### Notes phase 5

- `$CA04` est appele une seule fois depuis la boucle principale a `$BF17`.
- `$BC84` est appele une seule fois depuis la meme boucle principale a `$BF3B`.
- Aucun compteur dedie aux monstres n'a ete identifie autour de ces appels: les deux routines avancent au rythme du tour de boucle gameplay original.
- La boucle principale contient des appels de delai/rendu comme `$CD5B`, mais la conversion exacte d'un tour complet vers ticks PAL reste trop indirecte pour etre affirmee cycle-perfect.
- Le portage conserve donc une cadence moderne centralisee de `14` ticks pour les decisions monstres et `9` ticks pour leur interpolation visuelle.
- Le monstre standard `0x02` et la creature speciale `0x17` ont deja des directions/rotations distinctes dans `src/game/systems/monster-system.ts`; leur cadence reste commune, comme leurs appels sont dans le meme tour de boucle gameplay.
- Le mode attract passe par le meme `GameplayScene` et le meme `advanceMonsterRuntime`, donc il utilise la meme cadence moderne que le gameplay normal. L'ecart restant est documente pour la phase 8: l'ordre et la cadence de lecture du script attract doivent etre ajustes autour de cette boucle.

## Phase 6 - Cadence de la physique rochers/diamants

- [x] Reanalyser l'appel ASM `CB07` dans la boucle principale.
- [x] Determiner si le scan physique se produit a chaque boucle ou selon une temporisation.
- [x] Convertir `FALLING_OBJECT_SCAN_INTERVAL` en ticks entiers.
- [x] Convertir `FALLING_OBJECT_GRID_MOVE_DURATION` en ticks entiers.
- [x] Verifier que la logique de chute reste discrete et que le rendu reste seulement interpolatif.
- [x] Verifier les interactions: joueur, monstre, diamant, rocher, transformateur.

### Notes phase 6

- `$CB07` est appele une seule fois depuis la boucle principale a `$BF3E`.
- La routine parcourt la grille runtime de `$DBE0` a `$DEFF` et appelle `$CB17` pour classifier ou faire evoluer chaque cellule physique.
- Aucun compteur dedie au scan physique n'a ete identifie autour de `$CB07`; la physique originale avance donc au rythme du tour de boucle gameplay.
- Le portage conserve `8` ticks pour le scan physique moderne et `9` ticks pour l'interpolation visuelle des objets.
- Les mutations de grille restent discretes: source effacee et tuile temporaire posee au demarrage, tuile finale posee a la completion.
- Les interactions joueur/monstre/diamant/rocher/transformateur restent gerees par la grille runtime et les files d'objets physiques; l'interpolation ne sert qu'au rendu.

## Phase 7 - Cadence des animations runtime

- [x] Reanalyser `D1E0` pour l'animation couleur des diamants.
- [x] Reanalyser `D1BB` pour le blink monstre et les tuiles associees.
- [x] Reanalyser `CCC6` / `CCFE` pour la cadence des explosions.
- [x] Convertir les durees d'animation en ticks entiers.
- [x] Distinguer animations purement visuelles et animations qui modifient la grille.
- [x] Garder les animations HUD separees si elles ne participent pas a la logique gameplay.

### Notes phase 7

- `$D1E0` fait tourner les octets du plan couleur du diamant `0x03`; dans le portage, cette animation reste purement visuelle via l'atlas diamant.
- `$D1BB` modifie les plans graphiques du monstre et des tuiles associees; dans le portage, le blink monstre reste purement visuel via l'atlas monstre.
- `$CCC6` orchestre l'explosion et appelle `$CCFE` avec les frames `0x14`, `0x15`, `0x16`, puis `0x05`; dans le portage, l'explosion conserve une mutation de grille 3x3.
- Les cadences `1/8s` et `1/4s` de `src/screens/gameplay-scene.ts` sont remplacees par des ticks entiers centralises dans `src/game/runtime-timing.ts`.
- Le diamant HUD garde une cadence separee du diamant de gameplay car il n'intervient pas dans les collisions ni la collecte.
- La sortie ouverte clignote en rendu moderne sans muter la grille runtime, afin de conserver la cellule logique de sortie.

## Phase 8 - Cadence du script attract

- [x] Reanalyser `$CDF9` et les variables `$CE31`, `$CE33`, `$CE34`.
- [x] Determiner a quelle cadence le script attract est lu dans la boucle originale.
- [x] Decoupler la lecture du script attract de la fin de l'interpolation joueur.
- [x] Reproduire l'ordre ASM confirme: monde, physique, monstres, puis input attract si necessaire.
- [x] Garantir que la mort en attract ne relance jamais un gameplay normal jouable.
- [x] Documenter les points de sortie: espace, fin `$DD`, sortie de niveau, mort.

### Notes phase 8

- `$CDF9` est appele depuis la boucle principale apres `$BC84`, `$CB07` et `$BFA0`.
- `$CE31` porte l'index dans la table `$D878`, `$CE33` la commande longue courante et `$CE34` le compteur de repetition.
- `AttractScriptInputSource` avance maintenant explicitement d'un tick via `advanceScriptTick`, ce qui evite de consommer le script uniquement quand le joueur n'est plus en interpolation.
- `GameplayRuntime` possede un ordre `attract`: monstres, physique, joueur/script, camera, evenements, animations. L'ordre normal reste inchange.
- La mort en mode attract appelle le retour titre apres explosion au lieu de recreer le niveau cache en gameplay clavier.
- Les sorties documentees sont: appui espace/action, marqueur `$DD`, entree dans la sortie de niveau, mort du joueur.
- Limite restante: la cadence exacte d'un tour de boucle ASM reste approximee par les ticks modernes centralises; le script est decouple de l'interpolation, mais le rendu fluide reste moderne.

## Phase 9 - Table de provenance des cadences

- [x] Creer ou mettre a jour un document de reference des cadences runtime.
- [x] Pour chaque systeme, indiquer routine ASM, cadence en ticks, statut et justification.
- [x] Marquer explicitement les valeurs encore approximatives.
- [x] Referencer ce document depuis les plans gameplay/attract pertinents.
- [x] Eviter les nouvelles constantes temporelles non documentees dans le gameplay.

### Notes phase 9

- Le document `TO8_RUNTIME_TIMING.md` centralise les cadences retenues, les routines ASM associees, les statuts et les limites.
- La table TypeScript `src/game/runtime-timing.ts` est la source runtime moderne des constantes en ticks.
- Les valeurs approximatives sont explicitement marquees comme hypotheses modernes ou approximations documentees.
- Les plans de gameplay/attract doivent renvoyer a ce document pour eviter les constantes temporelles non tracees.

## Phase 10 - Stabilisation progressive

- [x] Appliquer les changements par systeme, en commencant par attract/monstres.
- [ ] Conserver des commits separes par domaine de cadence.
- [ ] Verifier visuellement le niveau 1 apres chaque domaine critique.
- [ ] Verifier le mode attract apres chaque domaine critique.
- [x] Ajuster uniquement les cadences dont l'ASM ne donne pas une valeur directement exploitable.

### Notes phase 10

- Les changements ont ete appliques par domaines: cadences centrales, separation logique/rendu, spawn, monstres, physique, animations, attract.
- Les cadences ajustees sont celles qui etaient deja modernes et non directement prouvables cycle-perfect; elles sont maintenant exprimees en ticks entiers et documentees.
- Les commits separes restent a faire sur demande explicite.
- Les verifications visuelles niveau 1 et attract restent a faire avec lancement de l'application, sur demande explicite.

## Regles de mise en oeuvre

- [ ] Ne pas remplacer une valeur arbitraire par une autre valeur arbitraire sans justification.
- [ ] Preferer des nombres de ticks entiers.
- [ ] Garder le gameplay logique independant du rendu fluide.
- [ ] Documenter chaque ecart volontaire avec une raison claire.
- [ ] Preserver l'architecture moderne: l'ASM sert de reference comportementale, pas de runtime execute.
