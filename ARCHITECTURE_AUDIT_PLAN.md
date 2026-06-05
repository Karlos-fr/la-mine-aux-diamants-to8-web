# Plan d'audit architecture - Portage moderne ISO

Objectif: auditer puis moderniser progressivement le portage web de `La Mine aux Diamants` sans perdre la cible principale: reproduire le comportement et le rendu TO8 de facon ISO, avec une architecture TypeScript maintenable.

Ce document est un plan de realisation. Il ne remplace pas les plans gameplay existants; il organise le nettoyage architectural transversal.

## Constat actuel

- `src/screens/gameplay-scene.ts` concentre rendu, input joueur, camera, HUD, grille runtime, monstres, objets physiques, spawn, transitions de niveau et chargement d'assets.
- `src/game/state.ts` charge les 16 JSON, convertit le format moderne vers tiles runtime, cree les entites et expose l'etat initial.
- `LevelRuntimeGrid` est defini dans `gameplay-scene.ts`, alors que c'est une brique de domaine runtime.
- Les systemes joueur, monstres, objets tombants, HUD et camera commencent a avoir des frontieres naturelles.
- Les assets extraits/provenance et les assets runtime modernes sont mieux separes qu'avant, mais les references directes a `docs/extraction` restent nombreuses dans les scenes.
- `src/screens/title-scene.ts` etait une ancienne scene de titre non utilisee par le flux moderne; elle a ete supprimee en phase 7.
- `dev-animation-gallery.ts` expose le viewer developpeur d'animations via `?mode=gallery`, sans montage interne du jeu.
- Les interpolations visuelles sont melangees avec la logique discrete dans certains endroits; il faut les isoler sans changer le comportement.
- Les constantes ASM/runtime sont actuellement dispersees dans `gameplay-scene.ts`.

## Principes de refactor

- [ ] Ne jamais remplacer une regle gameplay par une hypothese non prouvee.
- [ ] Garder les preuves ASM/extraction dans `docs/extraction`, `docs/provenance` et les metadata generees.
- [ ] Garder les JSON modernes comme format runtime editable.
- [ ] Garder la grille runtime comme source logique d'autorite.
- [ ] Garder le gameplay discret case par case.
- [ ] Garder les interpolations comme couche de rendu uniquement.
- [ ] Decouper par responsabilite, pas par confort esthetique.
- [ ] Faire des migrations courtes et reversibles.

## Phase 0 - Inventaire et garde-fous

- [x] Lister les modules runtime modernes reellement utilises.
- [x] Lister les modules historiques ou temporaires potentiellement morts.
- [x] Identifier les imports directs vers `docs/extraction` utilises au runtime.
- [x] Identifier les constantes ASM/runtime actuellement dans `gameplay-scene.ts`.
- [x] Identifier les zones ou le rendu modifie implicitement la logique.
- [x] Definir une convention de nommage pour les fichiers runtime.
- [x] Definir une convention de nommage pour les fichiers de rendu.
- [x] Definir une convention de nommage pour les outils d'extraction.
- [x] Ajouter une section "Dette connue" dans ce plan si une dette est conservee volontairement.

### Inventaire Phase 0

Modules runtime modernes utilises:

- `src/main.ts`: point d'entree app, choisit jeu ou viewer via `?mode=gallery`.
- `src/engine/*`: boucle, input, scene router, renderer canvas, loader image.
- `src/screens/startup-screens.ts`: flux startup ISO actuel, Infogrames puis ecran titre.
- `src/screens/gameplay-scene.ts`: scene gameplay principale, actuellement trop chargee.
- `src/game/state.ts`: factory de niveaux et etat initial.
- `src/game/types.ts`: types runtime, encore couples a des types de rendu.
- `src/assets/generated/*`: metadata runtime generees utilisees par scenes et rendu.
- `src/assets/levels/level-XX.json`: niveaux modernes runtime.

Modules historiques, temporaires ou suspects:

- `src/screens/title-scene.ts`: ancienne scene titre supprimee en phase 7 apres confirmation d'absence de reference runtime.
- `src/dev-animation-gallery.ts`: viewer dev utile, separe du runtime jeu.
- `src/game/index.ts` et `src/engine/index.ts`: facades exports, a conserver seulement si elles restent utiles apres extraction.
- Fallbacks de frames dans `gameplay-scene.ts`: utiles en securite, mais a documenter par groupe.

References directes a `docs/extraction` dans le runtime:

- `src/screens/gameplay-scene.ts`: atlas tuiles, diamants, monstres, panneaux HUD.
- `src/screens/startup-screens.ts`: ecrans startup et animations titre.
- `src/dev-animation-gallery.ts`: atlas viewer.

Constantes ASM/runtime actuellement dispersees:

- `RUNTIME_GRID_STRIDE`, `RUNTIME_GRID_FILL_TILE_ID`, `RUNTIME_GRID_BASE_ADDRESS`.
- Tile ids: `0x00`, `0x01`, `0x03`, `0x04`, `0x05`, `0x06`, `0x12`, `0x13`, `0x17`, `0x80`.
- Seuils camera ASM: `0x04`, `0x0f`, `0x02`, `0x07`.
- Timings modernes: joueur, camera, monstres, objets tombants, HUD.
- Donnees HUD encodees en dur: diamant panneau, couleurs TO8, positions.

Zones ou le rendu et la logique restent proches:

- `drawPlayfield` masque certaines tiles runtime dynamiques (`0x17`, `0x80`, `0x12`, `0x13`) comme vide.
- `drawEntitiesAndObjects` gere l'ordre de rendu gameplay directement dans la scene.
- Les entites diamants sont synchronisees depuis les objets tombants pendant l'interpolation.
- Le HUD calcule et rend des donnees TO8 directement dans `gameplay-scene.ts`.
- Les helpers de couleur TO8 et fontes HUD sont dans la scene gameplay.

Conventions retenues:

- Fichiers runtime domaine: `src/game/runtime-*.ts`.
- Systems gameplay: `src/game/systems/*-system.ts`.
- Rendu gameplay: `src/rendering/*-renderer.ts` ou `src/screens/renderers/*` si on veut garder le rendu pres des scenes.
- Assets runtime: `src/assets/runtime-assets.ts`.
- Outils extraction/generation: `tools/extract-*.mjs`, `tools/decode-*.mjs`, `tools/generate-*.mjs`.
- Plans transversaux: racine du repo si l'impact est global, `docs/plans/` si le plan est specifique a une feature.

Dette connue:

- `GameplayScene` reste le god file principal tant que les phases 1 a 5 ne sont pas realisees.
- Le runtime connait encore des chemins `docs/extraction`; une facade assets doit absorber cela.
- `src/game/types.ts` importe `TileFrame`, donc le domaine runtime depend encore du rendu.
- `levelComplete` et transition directe niveau suivant sont modernes, pas encore sequence ISO originale.
- Les objets physiques implementent le glissement lateral minimal; la priorite exacte gauche/droite reste a raffiner contre ASM complet.
- Les tests unitaires runtime modernes n'existent pas encore.

## Phase 1 - Decoupage du domaine runtime

- [x] Extraire `LevelRuntimeGrid` vers `src/game/runtime-grid.ts`.
- [x] Ajouter des methodes explicites sur la grille: `getTile`, `setTile`, `clearTile`, `isInside`, `isEmpty`.
- [x] Remplacer les appels directs `runtimeGrid.getRuntimeTile` par une API nommee selon le domaine.
- [x] Remplacer les appels directs `runtimeGrid.setRuntimeTile` par une API de mutation centralisee.
- [x] Extraire les tile ids runtime vers `src/game/runtime-tiles.ts`.
- [x] Documenter dans `runtime-tiles.ts` les correspondances prouvees par ASM.
- [x] Separer les types runtime purs des types de rendu.
- [x] Supprimer les imports de rendu depuis `src/game/types.ts` si possible.

## Phase 2 - Loader de niveaux modernes

- [x] Extraire les imports des 16 JSON vers `src/game/level-loader.ts`.
- [x] Extraire `ModernLevelJson` vers un type public dedie.
- [x] Extraire `buildLevelDefinition` depuis `state.ts`.
- [x] Renommer `state.ts` si son role devient uniquement factory d'etat.
- [x] Conserver `createGameLevelState(levelNumber)` comme facade publique stable.
- [x] Encapsuler le mapping `ModernTileType -> tileId runtime`.
- [x] Gerer proprement les niveaux absents ou futurs.
- [x] Preparer la future edition de niveaux sans adresses ASM.
- [x] Verifier que `level.exit` reste dans le meme repere logique que `playerSpawn`.

### Notes Phase 2

- `src/game/level-loader.ts` porte maintenant les imports JSON, le type public `ModernLevelJson`, la conversion JSON moderne -> `LevelDefinition` et le mapping `ModernTileType -> RUNTIME_TILE`.
- `src/game/game-state-factory.ts` porte uniquement la creation de `GameState` et les etats runtime derives, notamment les pointeurs monstres calcules depuis la grille logique.
- `src/game/state.ts` reste une facade de compatibilite pour ne pas casser les imports existants, mais le role effectif a ete renomme vers `game-state-factory.ts`.
- `playerSpawn` et `exit` restent dans le meme repere logique moderne: coordonnees de grille issues du JSON, sans adresse ASM runtime.

## Phase 3 - Systems gameplay

- [x] Extraire un `PlayerSystem` pour input, mouvement case par case et effets d'arrivee.
- [x] Extraire un `CameraSystem` pour seuils ASM, bornes et interpolation visuelle.
- [x] Extraire un `MonsterSystem` pour direction, marqueurs `0x17/0x80`, interpolation et sync entite.
- [x] Extraire un `FallingObjectSystem` pour rochers/diamants physiques.
- [x] Extraire un `SpawnSystem` pour blink spawn et nettoyage de la tile temporaire.
- [x] Extraire un `ExitSystem` pour ouverture sortie et transition niveau.
- [x] Definir l'ordre d'update des systems dans un seul endroit.
- [x] Documenter l'ordre d'update attendu par rapport au runtime original.
- [x] Interdire qu'un system modifie directement le rendu.

### Notes Phase 3

- Les systems extraits vivent dans `src/game/systems/` et restent sans dependance renderer/canvas.
- `GameplayScene.update` conserve l'ordre d'orchestration actuel: spawn/HUD, joueur, camera, objets physiques, monstres, sync entites, animations.
- `PlayerSystem` porte la decision collision/effet d'arrivee; l'orchestration input et interpolation reste temporairement dans la scene pour eviter de modifier le comportement case-par-case.
- `CameraSystem` porte les seuils ASM, bornes de viewport et interpolation visuelle.
- `FallingObjectSystem` porte la resolution de cible rocher/diamant, dont chute verticale directe et bascule laterale sous contrainte de support physique.
- `MonsterSystem` porte la direction, la rotation de direction et les marqueurs runtime `0x17`/`0x80`.
- `SpawnSystem` porte la sequence blink; le nettoyage effectif de tile reste orchestre par la scene via la grille runtime.
- `ExitSystem` porte la reconnaissance de cellule de sortie ouverte; la navigation de scene reste volontairement dans `GameplayScene`.

## Phase 4 - Mutations et evenements runtime

- [x] Introduire un petit journal d'evenements runtime: `tileCleared`, `diamondCollected`, `exitOpened`, `levelCompleted`.
- [x] Faire emettre les evenements par les systems gameplay.
- [x] Faire consommer les evenements par le HUD et les transitions.
- [x] Eviter les doubles mutations d'une meme case pendant un tick.
- [x] Decider si les mutations doivent etre appliquees immediatement ou en fin de tick.
- [x] Conserver l'application a l'arrivee pour joueur et objets physiques.
- [x] Ajouter une structure pour les cellules deja traitees par tick si necessaire.

### Notes Phase 4

- `GameState.runtimeEvents` porte le journal d'evenements runtime.
- `src/game/runtime-events.ts` fournit `emitRuntimeEvent` et `drainRuntimeEvents`.
- Les mutations de grille restent appliquees immediatement afin de conserver le comportement discret actuel et l'ordre d'update deja stabilise.
- Les effets derives passent par le journal: score/diamants HUD, ouverture de sortie et transition de niveau.
- `GameplayScene` garde une protection locale `mutatedRuntimeTilesThisTick` pour eviter deux nettoyages concurrents de la meme cellule pendant un tick.

## Phase 5 - Rendu gameplay

- [x] Extraire un `LevelRenderer` pour la grille visible.
- [x] Extraire un `EntityRenderer` pour joueur, monstres, diamants et objets tombants.
- [x] Extraire un `HudRenderer` pour panneaux bois, compteurs et diamant HUD.
- [x] Extraire un `FontRenderer` TO8 pour les fontes generees.
- [ ] Extraire un `StartupRenderer` ou simplifier les scenes startup.
- [x] Garder la couche rendu sans mutation de grille.
- [ ] Remplacer les constructions de `TileFrame` en scene par un cache d'assets dedie.
- [ ] Centraliser les URLs d'assets runtime.

### Notes Phase 5

- `src/rendering/font-renderer.ts` porte le rendu des fontes TO8 generees.
- `src/rendering/hud-renderer.ts` porte le rendu texte HUD et les petits compteurs.
- `src/rendering/level-renderer.ts` porte les calculs viewport -> ecran et culling de grille.
- `src/rendering/entity-renderer.ts` porte le culling entite et l'interpolation visuelle des objets tombants.
- `GameplayScene` reste l'orchestrateur du rendu pour conserver l'ordre ISO actuel: grille, objets/entites, HUD.
- Le rendu extrait ne mute pas la grille runtime.
- Le cache `TileFrame` reste temporairement dans `GameplayScene`; une extraction d'asset cache dediee est repoussee a la phase 6 pour eviter de melanger rendu et chemins d'assets.
- Les URLs d'assets runtime restent a centraliser en phase 6, qui est explicitement dediee aux assets.

## Phase 6 - Assets runtime et extraction

- [x] Creer une facade `src/assets/runtime-assets.ts`.
- [x] Centraliser les URLs vers atlas tuiles, sprites, HUD, startup et title.
- [x] Distinguer les assets runtime obligatoires des assets de viewer.
- [x] Eviter que les scenes connaissent directement les chemins `docs/extraction`.
- [x] Garder les outils d'extraction dans `tools/`.
- [x] Garder les preuves d'extraction dans `docs/extraction` et `docs/provenance`.
- [x] Verifier si des PNG/metadata inutilises peuvent etre supprimes plus tard.
- [x] Ne supprimer aucun asset tant que le viewer ou une preuve ne depend pas de lui.

### Notes Phase 6

- `src/assets/runtime-assets.ts` centralise les URLs vers `docs/extraction`.
- `RUNTIME_ASSET_URLS` regroupe les assets obligatoires du jeu: atlas tuiles, atlas diamants/monstres, panneaux HUD, startup Infogrames et ecran titre.
- `VIEWER_ASSET_URLS` regroupe les atlas utiles au viewer developpeur.
- `docsExtractionAssetUrl` reste disponible pour charger les frames d'animation referencees par metadata sans que les scenes reconstruisent elles-memes le chemin `docs/extraction`.
- Aucun asset n'a ete supprime pendant cette phase: la verification d'inutilisation reste volontairement conservative, car certains fichiers servent de preuves ou de support viewer.

## Phase 7 - Scenes et navigation

- [x] Confirmer si `src/screens/title-scene.ts` est mort.
- [x] Supprimer `title-scene.ts` si aucune route ne l'utilise.
- [x] Clarifier le role de `StartupInfogramScene`.
- [x] Clarifier le role de `StartupTitleScene`.
- [ ] Introduire une scene ou transition dediee pour le passage de niveau si l'ASM le justifie.
- [x] Eviter que `GameplayScene` instancie directement la scene suivante sans passer par une intention de navigation.
- [x] Ajouter une petite abstraction de scene factory si utile.
- [x] Garder le flux startup ISO comme reference.

### Notes Phase 7

- `src/screens/title-scene.ts` etait l'ancien ecran titre temporaire: il n'etait reference par aucun flux runtime moderne.
- `StartupInfogramScene` reste le premier ecran ISO: affichage Infogrames/presente, passage automatique ou par action vers le titre.
- `StartupTitleScene` reste le second ecran ISO anime: titre principal, attente action/espace, puis lancement du niveau 1.
- `src/screens/scene-factory.ts` centralise la creation des scenes gameplay et injecte la factory de niveau suivant pour eviter les cycles d'import.
- `GameplayScene` ne construit plus directement la scene suivante dans le flux normal; il utilise la factory injectee par `createGameplayScene`.
- La transition dediee de galerie/niveau reste non implementee tant que la sequence ASM n'est pas analysee plus finement.

## Phase 8 - Viewer et outils developpeur

- [x] Separer clairement `animation-gallery.ts` du runtime jeu.
- [x] Renommer le viewer si necessaire en `dev-animation-gallery`.
- [x] Isoler les styles du viewer des styles runtime.
- [x] Verifier que le viewer continue d'exposer les animations utiles.
- [ ] Ajouter si besoin un viewer de tuiles runtime et de niveaux JSON.
- [x] Documenter comment utiliser `?mode=gallery`.
- [x] Eviter que le viewer impose des dependances au bundle jeu principal si possible.

### Notes Phase 8

- `src/animation-gallery.ts` a ete remplace par `src/dev-animation-gallery.ts`.
- Le viewer developpeur n'embarque plus un montage interne du jeu; le choix viewer/jeu reste uniquement dans `src/main.ts`.
- Les styles du viewer sont prefixes `dev-gallery-*` pour eviter les collisions avec le runtime jeu.
- Le viewer reste accessible via `http://localhost:5173/?mode=gallery`.
- Le viewer expose toujours les animations issues de `mineSpriteMetadata` et les atlas `VIEWER_ASSET_URLS`.
- Un viewer de tuiles runtime / niveaux JSON reste optionnel et non implemente pour le moment.

## Phase 9 - Code mort et dette technique

- [ ] Rechercher les exports non utilises.
- [ ] Rechercher les fichiers non importes.
- [ ] Rechercher les constantes obsoletes.
- [ ] Rechercher les types generiques inutilises: `ladder`, `door`, `marker`, `effect`, etc.
- [ ] Rechercher les fallbacks temporaires de frames et les documenter.
- [ ] Rechercher les textes de chargement temporaires.
- [ ] Rechercher les logs ou fichiers de dev commites par erreur.
- [ ] Supprimer uniquement apres preuve d'inutilisation.

## Phase 10 - Robustesse TypeScript

- [ ] Reduire les assertions `as` non necessaires.
- [ ] Typer les JSON modernes plus strictement.
- [ ] Ajouter des validateurs runtime legers pour les JSON de niveaux.
- [ ] Eviter que `ModernTileType` accepte `exit` si le JSON ne cree pas de tile `exit` directement.
- [ ] Remplacer les magic numbers par des constantes nommees quand elles sont stables.
- [ ] Garder les adresses ASM uniquement dans documentation/provenance, pas dans les types runtime modernes.
- [ ] Verifier l'impact de `noUnusedLocals` apres extraction des modules.

## Phase 11 - Tests et verification future

- [ ] Ajouter des tests unitaires pour `LevelRuntimeGrid`.
- [ ] Ajouter des tests unitaires pour conversion JSON -> grille runtime.
- [ ] Ajouter des tests unitaires pour ouverture sortie.
- [ ] Ajouter des tests unitaires pour collecte diamant/herbe.
- [ ] Ajouter des tests unitaires pour chute verticale.
- [ ] Ajouter des tests unitaires pour glissement lateral minimal.
- [ ] Ajouter des tests de non-regression sur compteurs HUD.
- [ ] Ajouter une verification de coherence des 16 JSON modernes.
- [ ] Garder les tests de provenance separes des tests runtime modernes.

## Phase 12 - Ordre de realisation recommande

- [ ] Extraire d'abord `runtime-tiles.ts`.
- [ ] Extraire ensuite `runtime-grid.ts`.
- [ ] Extraire le loader de niveaux.
- [ ] Extraire `HudRenderer`, car c'est peu risque et tres local.
- [ ] Extraire `CameraSystem`, car il est assez autonome.
- [ ] Extraire `PlayerSystem`, apres stabilisation des mutations.
- [ ] Extraire `FallingObjectSystem`, avant d'ajouter morts/explosions.
- [ ] Extraire `MonsterSystem`, avant collisions mortelles.
- [ ] Faire seulement ensuite les phases gameplay suivantes: poussee, morts, explosions.

## Definition de fini

- [ ] `GameplayScene` orchestre les systems mais ne contient plus leur logique interne.
- [ ] La logique runtime peut etre lue sans lire le code de rendu canvas.
- [ ] Le rendu peut etre lu sans lire les routines de collision.
- [ ] Les JSON modernes restent la seule source runtime des niveaux.
- [ ] Les preuves ASM restent consultables et reliees aux decisions importantes.
- [ ] Aucun comportement ISO deja obtenu n'est perdu.
- [ ] Le code mort identifie est supprime ou documente.
- [ ] Le plan gameplay peut continuer avec poussee, morts et explosions sur une base plus claire.
