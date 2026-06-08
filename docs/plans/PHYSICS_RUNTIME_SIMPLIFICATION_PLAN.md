# Plan de simplification du runtime physique

## Objectif

Revenir a un moteur physique simple, deterministe et lisible pour les collisions, chutes, poussees et impacts du portage moderne de *La Mine aux Diamants*.

Le but n'est pas de creer une architecture lourde, mais de supprimer les rustines accumulees autour des rochers, diamants, monstres et du joueur, afin de retrouver un comportement ISO plus facile a verifier face a l'ASM original.

## Principes directeurs

- [ ] Garder la grille runtime comme source de verite logique.
- [ ] Ne jamais utiliser la position rendue fluide pour decider une collision physique.
- [ ] Separer strictement decision logique et animation visuelle.
- [ ] Centraliser les regles rochers/diamants dans un seul systeme physique.
- [ ] Representer explicitement les objets en mouvement au lieu de multiplier les exceptions sur les tuiles.
- [ ] Documenter chaque ecart volontaire avec une reference ASM ou une note `TODO`.

## Phase 1 - Cartographier l'existant physique

- [x] Identifier tous les points du code moderne qui modifient la grille runtime pour la physique.
- [x] Identifier toutes les lectures de position joueur utilisees pour les collisions.
- [x] Identifier toutes les regles actuellement dispersees dans `GameplayScene`.
- [x] Lister les tuiles runtime impliquees : vide, herbe, bordure, roche, diamant, monstre, traces, explosion, objet en chute.
- [x] Relever les routines ASM deja connues pour les chutes, impacts, mort joueur et reset niveau.
- [x] Marquer les comportements actuels comme `prouve ASM`, `approximation`, ou `a verifier`.

### Resultat phase 1

#### Points modernes qui mutent la grille runtime

- `src/game/runtime-mutations.ts` centralise les mutations nommees mais reste une API immediate autour de `LevelRuntimeGrid.setTile`.
- `setTile` est la primitive brute commune a toutes les mutations.
- `clearPlayerTile`, `digPlayerTile`, `collectDiamond` gerent les effets joueur et les evenements runtime.
- `clearFallingObjectSource`, `setFallingObjectMovingTile`, `completeFallingObjectTile` gerent les objets physiques en mouvement.
- `clearPushedRockSource`, `setPushedRockMovingTile` reutilisent le meme marqueur temporaire que les chutes.
- `setMonsterTile` ecrit directement les monstres actifs et leurs traces.
- `src/screens/gameplay-scene.ts` orchestre encore directement la plupart des decisions physiques avant d'appeler ces mutations.
- `src/game/systems/monster-system.ts` modifie la grille via callback pour poser `monsterTrail` et `monsterActive`.
- Les explosions modifient encore la grille depuis `GameplayScene`, cellule par cellule, via `runtimeMutations.setTile`.

#### Lectures de position joueur utilisees pour la physique

- Le mouvement joueur utilise `Math.round(this.state.player.gridX/gridY)` comme cellule de depart.
- La collision joueur lit `runtimeGrid.getTile` puis delegue une partie de la decision a `player-system`.
- Les chutes recoivent `playerGridX` pour prioriser gauche/droite.
- `isPlayerRenderedAtGrid` arrondit une position potentiellement interpolee et reste utilise dans des decisions physiques.
- Les impacts d'objets tombants testent encore le joueur via `isPlayerRenderedAtGrid`.
- Le contact monstre/joueur teste aussi la position joueur arrondie.

#### Regles physiques encore dispersees dans `GameplayScene`

- Resolution de collision joueur et detection de poussee de rocher.
- Demarrage et finalisation du mouvement fluide joueur.
- Application des effets d'arrivee joueur : creuser, collecter diamant, nettoyer trace, entrer sortie, toucher monstre.
- Scan des rochers/diamants prets a tomber.
- Blocage special quand le joueur est sous un objet physique pose.
- Passage par `falling-object-system` pour choisir la cible de chute/glissement.
- Demarrage de chute et poussee avec pose immediate d'une tuile temporaire `0x12` ou `0x13`.
- Finalisation d'un objet physique avec impact ou pose finale.
- Synchronisation visuelle des diamants en chute.
- Detection des impacts joueur/monstre.
- Explosion 3x3, destruction de monstres, mort joueur, reset de niveau.

#### Tuiles runtime impliquees

- `0x00` : rocher statique, objet physique.
- `0x01` : terre/herbe creusable.
- `0x02` : monstre initial issu du niveau.
- `0x03` : diamant statique, collectible et objet physique.
- `0x04` : bordure, bloc protege ou sortie selon contexte deja documente.
- `0x05` : vide logique.
- `0x06` : plateforme/bloc solide.
- `0x12` : rocher en mouvement ou glissement, et actuellement aussi rocher pousse.
- `0x13` : diamant en mouvement ou glissement.
- `0x14`, `0x15`, `0x16` : frames d'explosion.
- `0x17` : monstre actif runtime.
- `0x80` : trace de monstre, traitee comme vide dans certains systems.

#### Routines ASM deja documentees

- `KIT.BIN:$DA10` : decodage/chargement niveau et grille runtime.
- `KIT.BIN:$CB17` : traite `0x00` et `0x03` comme objets physiques.
- `KIT.BIN:$CB3B/$CBA7` : deplacements d'objets vers les cellules `0x05`.
- `KIT.BIN:$CB89/$CBDD` : generation documentee de l'etat `0x12` pour rocher en mouvement.
- `KIT.BIN:$D1E0` : animation/cycle diamant.
- `KIT.BIN:$CC5B/$D1BB` : routines liees aux monstres.
- `KIT.BIN:$CCC6/$CCFE` : explosion 3x3 avec sequence `0x14 -> 0x15 -> 0x16 -> 0x05`.
- Flux mort/reset local observe : `CCC6 -> D9E6 -> BB14 -> BE68 -> DA10`.

#### Statut des comportements actuels

- `prouve ASM` : ids de tuiles principaux, grille `DA10`, diamant/rocher physiques `CB17`, vide `0x05`, explosion 3x3 `CCC6/$CCFE`, reset local apres mort.
- `prouve ASM partiel` : monstres `0x02/0x17/0x80`, priorite de deplacement monstre, etats temporaires `0x12/0x13`, HUD/compteurs deja documentes ailleurs.
- `approximation` : priorite exacte gauche/droite des glissements, blocage du joueur sous objet pose, interaction entre interpolation fluide et impact physique.
- `a verifier` : compteur de vies/game over complet, score de destruction monstre, priorite exacte quand joueur, monstre et objet physique arrivent sur la meme cellule pendant le meme cycle.

#### Conclusion phase 1

- La source de verite logique existe deja, mais elle est brouillee par l'utilisation de positions interpolees arrondies dans des decisions physiques.
- Le modele `fallingObjects` existe deja, mais la grille contient aussi des tuiles temporaires de mouvement, ce qui complique poussee, chute et collision.
- La phase 2 doit donc definir un modele minimal ou la grille contient les tuiles posees, tandis que les objets en mouvement portent explicitement leur nature, leur source, leur cible et leur type de mouvement.

## Phase 2 - Definir le modele logique minimal

- [x] Definir une grille statique unique contenant uniquement les tuiles posees.
- [x] Definir une liste d'objets en mouvement distincte de la grille statique.
- [x] Definir un type commun pour les mouvements physiques : chute verticale, glissement lateral, poussee horizontale.
- [x] Definir un type commun pour les impacts : joueur touche, monstre touche, explosion, pose finale.
- [x] Definir une position logique joueur entiere en cellule.
- [x] Definir une position logique monstre entiere en cellule.
- [x] Conserver les positions interpolees uniquement cote rendu.

### Resultat phase 2

#### Modele cible minimal

Le runtime physique doit rester fonde sur quatre concepts seulement.

- Grille logique posee : contient les tuiles stables du niveau, par exemple `empty`, `earth`, `rock`, `diamond`, `border`, `platform`, `monsterTrail`, `exit/protected`.
- Acteurs logiques : joueur et monstres ont une cellule entiere stable, sans interpolation dans les decisions physiques.
- Mouvements physiques actifs : liste distincte contenant les objets lourds en cours de chute, glissement ou poussee.
- Evenements/impacts : resultat d'un mouvement ou d'une collision, applique ensuite a la grille, aux acteurs, au HUD et aux effets visuels.

#### Grille logique posee

- La grille doit contenir uniquement les tuiles qui sont reellement posees a un instant logique stable.
- Un rocher tombe ou pousse doit quitter sa cellule source dans la grille logique.
- Tant que son mouvement n'est pas termine, il doit etre represente par la liste des mouvements actifs.
- A la fin du mouvement sans impact, il redevient une vraie tuile `rock` ou `diamond` dans la grille.
- Les tuiles temporaires `0x12` et `0x13` peuvent rester des indices de rendu/compatibilite ASM, mais ne doivent plus etre indispensables a la logique de collision.

#### Acteurs logiques

- Le joueur doit avoir une cellule logique entiere, par exemple `playerCell`.
- Le rendu peut interpoler le joueur entre deux cellules, mais la collision ne doit pas lire cette position interpolee.
- Les monstres doivent suivre le meme principe : cellule logique entiere et mouvement visuel separe.
- Les entites visuelles peuvent rester dans `EntityState`, mais leurs `gridX/gridY` interpoles ne doivent pas servir de source physique.

#### Type de mouvement physique cible

Le type cible peut rester tres petit.

```ts
type PhysicsMoveKind = "fall" | "slide" | "push";

interface PhysicsObjectMove {
  readonly id: string;
  readonly objectKind: "rock" | "diamond";
  readonly moveKind: PhysicsMoveKind;
  readonly from: GridCell;
  readonly to: GridCell;
  readonly startedBy?: "gravity" | "playerPush";
  elapsed: number;
  readonly duration: number;
}
```

- `fall` : chute verticale, mortelle si elle touche joueur ou monstre.
- `slide` : bascule laterale vers bas-gauche ou bas-droite, mortelle si elle touche joueur ou monstre.
- `push` : mouvement horizontal du rocher uniquement, non assimile a une chute verticale.

#### Type d'impact cible

```ts
type PhysicsImpact =
  | { readonly type: "none" }
  | { readonly type: "placeTile"; readonly cell: GridCell; readonly tileId: number }
  | { readonly type: "hitPlayer"; readonly cell: GridCell; readonly objectKind: "rock" | "diamond" }
  | { readonly type: "hitMonster"; readonly cell: GridCell; readonly monsterId: string; readonly objectKind: "rock" | "diamond" }
  | { readonly type: "explosion"; readonly cell: GridCell };
```

- Les impacts doivent etre produits par le systeme physique, puis appliques par la scene/orchestrateur.
- Un objet pose au-dessus du joueur ne produit pas `hitPlayer`.
- Un objet deja en mouvement `fall` ou `slide` peut produire `hitPlayer`.
- Une poussee horizontale ne doit pas etre traitee comme un ecrasement vertical.

#### Position logique et position rendue

- `state.player.gridX/gridY` est actuellement double usage : logique et rendu interpole.
- La cible est de separer ce double usage.
- Option simple recommandee : ajouter un petit etat logique discret pour le joueur et les monstres, puis continuer a synchroniser `EntityState` pour le rendu.
- `EntityState.gridX/gridY` peut rester interpole cote rendu si besoin, mais ne doit plus etre lu par la physique.
- Les helpers comme `isPlayerRenderedAtGrid` doivent etre reserves au rendu, au spawn blink ou aux effets visuels.

#### Resultat attendu avant implementation

- La phase 3 devra introduire le systeme physique autour de ce modele, sans refonte massive.
- La premiere implementation peut garder les noms existants `fallingObjects` et `FallingObjectRuntimeState`, mais elle doit leur ajouter un `moveKind` pour distinguer chute, glissement et poussee.
- La grille peut temporairement continuer a poser `0x12/0x13` pour le rendu, mais la collision doit progressivement consulter la liste des mouvements actifs plutot que ces tuiles temporaires.

## Phase 3 - Centraliser les regles rochers et diamants

- [x] Creer ou consolider un systeme unique de resolution physique des objets lourds.
- [x] Appliquer la meme logique de chute aux rochers et aux diamants.
- [x] Autoriser la chute verticale si la cellule dessous est vide.
- [x] Autoriser l'ecrasement du joueur ou d'un monstre uniquement par un objet deja en mouvement de chute.
- [x] Interdire la mort immediate quand le joueur vient de creuser sous un rocher ou un diamant pose.
- [x] Autoriser la chute apres depart du joueur si la cellule dessous devient libre.
- [x] Autoriser la mort si le joueur descend ensuite dans la trajectoire d'un rocher ou diamant en chute.
- [x] Reposer l'objet comme vraie tuile `rock` ou `diamond` a la fin du mouvement si aucun impact n'a lieu.

### Notes phase 3

- `FallingObjectRuntimeState` porte maintenant `moveKind: "fall" | "slide" | "push"`.
- Les chutes verticales et glissements lateraux sont crees par la gravite avec `moveKind` `fall` ou `slide`.
- `falling-object-system` retourne maintenant explicitement la cible et le `moveKind`, ce qui evite a `GameplayScene` de deduire la nature physique depuis les coordonnees.
- La poussee horizontale de rocher est conservee dans la meme liste d'objets interpoles, mais avec `moveKind: "push"`.
- Les impacts mortels joueur/monstre sont limites aux mouvements gravitaires, pas aux poussees horizontales.
- Les chutes et impacts utilisent maintenant une cellule joueur logique discrete via `getPlayerLogicalCell`, au lieu de la position rendue/interpolee.
- Quand le joueur est en mouvement fluide, sa cellule physique cible est utilisee pour les decisions de chute.
- Un objet gravitaire qui termine une case de chute ou glissement peut maintenant enchainer immediatement une nouvelle chute avant le prochain scan global.
- La poussee horizontale reste exclue de cet enchainement : un rocher pousse se repose et redevient poussable.
- Il reste a extraire davantage la resolution physique hors de `GameplayScene` et a supprimer les decisions basees sur la position rendue.

## Phase 4 - Simplifier la poussee horizontale des rochers

- [x] Faire de la poussee un mouvement physique explicite, distinct d'une chute.
- [x] Autoriser la poussee uniquement pour les rochers.
- [x] Autoriser la poussee uniquement horizontalement.
- [x] Autoriser la poussee uniquement si la cellule cible est libre selon la grille logique.
- [x] Garantir qu'un rocher tombe puis repose au sol redevient poussable.
- [x] Garantir qu'un rocher en mouvement ne peut pas etre pousse.

### Notes phase 4

- `rock-push-system` centralise maintenant la resolution de cible d'une poussee de rocher.
- La poussee accepte uniquement `moveX = -1` ou `moveX = 1`; tout mouvement vertical ou nul est refuse.
- La scene ne tente une poussee que si la cellule cible du joueur contient un rocher statique `0x00`.
- La cellule derriere le rocher doit etre le vide logique `0x05` et ne pas etre occupee par entite, monstre ou objet physique actif.
- Une poussee cree un objet physique `moveKind: "push"`, distinct de `fall` et `slide`.
- Les impacts mortels ignorent `moveKind: "push"`, donc une poussee horizontale ne se comporte pas comme une chute.
- Un rocher pousse ou tombe est repose comme vraie tuile `rock` en fin de mouvement si aucun impact n'a lieu; il redevient donc poussable.
- Un rocher en mouvement ne peut pas etre pousse, car sa cellule source/cible est couverte par `hasFallingObjectAtGrid`.

## Phase 5 - Revoir les interactions joueur/grille

- [x] Appliquer la recolte d'herbe uniquement a l'arrivee complete du joueur sur la cellule.
- [x] Appliquer la recolte de diamant uniquement a l'arrivee complete du joueur sur la cellule.
- [x] Garantir que le joueur reste affiche au-dessus d'un diamant recolte.
- [x] Bloquer le joueur contre les bordures et murs depuis la grille logique.
- [x] Bloquer le joueur contre les rochers non poussables depuis la grille logique.
- [x] Conserver les diamants poses comme cellules collectables, pas comme murs.
- [x] Declencher la mort si le joueur entre en contact avec un monstre selon les regles ASM verifiees.

### Notes phase 5

- La recolte d'herbe et de diamant est deja differee jusqu'a `applyPlayerArrivalEffect`, appelee uniquement quand le pas fluide du joueur atteint `progress >= 1`.
- Le diamant est traversable par `player-system`, puis converti en evenement `collectDiamond` a l'arrivee complete.
- Le rendu evite de dessiner la tuile dynamique sous le joueur actif, ce qui preserve la priorite visuelle du joueur pendant la collecte.
- Les bordures, plateformes, rochers statiques et objets physiques temporaires restent bloquants via `canPlayerEnterTile`.
- Un rocher statique peut devenir traversable uniquement quand une poussee horizontale valide a ete resolue par `rock-push-system`.
- Les diamants ne doivent pas etre bloques comme des murs : le plan initial a ete corrige pour refléter le comportement de collecte ISO.
- Le contact avec un monstre produit l'effet d'arrivee `hitMonster`, declenche explosion et mort joueur.

## Phase 6 - Revoir les impacts et explosions

- [x] Centraliser le declenchement des explosions.
- [x] Declencher une explosion quand un rocher ou diamant en chute touche le joueur.
- [x] Declencher une explosion quand un rocher ou diamant en chute touche un monstre.
- [x] Ne pas declencher d'explosion quand un joueur creuse sous un objet pose.
- [x] Bloquer les entrees joueur pendant l'etat mort.
- [x] Recharger le niveau courant apres la sequence de mort selon la routine ASM deja analysee.
- [x] Garder une note ouverte sur l'existence ou non d'un compteur de vies tant que l'ASM n'est pas formellement prouve.

### Notes phase 6

- Les explosions passent par `startExplosion`, qui applique la sequence runtime `0x14 -> 0x15 -> 0x16 -> 0x05` sur une zone 3x3.
- Les cellules protegees `0x04` sont preservees pendant l'explosion.
- Les objets physiques `moveKind: "fall"` et `moveKind: "slide"` peuvent tuer joueur ou monstre a l'impact.
- Les objets physiques `moveKind: "push"` ne declenchent pas d'impact mortel.
- Creuser sous un rocher ou diamant pose ne passe pas par `applyFallingObjectImpact`, donc ne declenche pas d'explosion.
- La mort joueur desactive le joueur, active `gameOver`, annule le mouvement courant et bloque les entrees.
- Apres la fin des explosions, la scene recharge le niveau courant selon le flux ASM deja documente `CCC6 -> D9E6 -> BB14 -> BE68 -> DA10`.
- Les tests de mort par explosion et contact monstre utilisent maintenant la cellule joueur logique discrete, pas la position rendue/interpolee.
- Le compteur de vies reste volontairement non implemente tant qu'aucune routine ASM complete ne l'a prouve.

## Phase 7 - Isoler animation et rendu

- [x] Laisser le moteur physique produire des mouvements de cellule a cellule.
- [x] Laisser la scene transformer ces mouvements en animations fluides.
- [x] Supprimer les decisions physiques basees sur `x`, `y`, `gridX` interpole ou position arrondie pendant une animation.
- [x] Utiliser l'interpolation uniquement pour dessiner joueur, monstres, rochers et diamants.
- [x] Garantir que la camera suit le rendu sans influencer la logique.

### Notes phase 7

- Les mouvements joueur, monstres, rochers et diamants restent definis par des cellules source/cible entieres.
- Les impacts physiques des objets lourds utilisent la cellule logique joueur via `getPlayerLogicalCell`.
- Les explosions et contacts monstres utilisent aussi la cellule logique joueur.
- Le depart d'un nouveau pas joueur utilise maintenant la cellule logique joueur, pas un arrondi direct de la position rendue.
- L'interpolation `lerp/smoothStep` reste conservee pour le rendu fluide du joueur, des monstres, de la camera et des objets physiques.
- `isPlayerRenderedAtGrid` reste utilise pour le rendu, le culling de tuile sous joueur et le clignotement de spawn.
- La camera suit une interpolation visuelle de viewport et n'ecrit pas dans la logique de collision.
- Des tuiles temporaires `0x12/0x13` restent encore dans la grille pour compatibilite rendu/runtime actuel; leur nettoyage est reporte a la phase 8.

## Phase 8 - Nettoyer les rustines existantes

- [x] Supprimer les protections locales contradictoires autour du joueur sous objet.
- [ ] Supprimer les checks physiques redondants dans `GameplayScene`.
- [ ] Supprimer les usages de tuiles temporaires qui restent dans la grille apres mouvement.
- [x] Supprimer les fonctions mortes issues des corrections successives.
- [x] Renommer les fonctions restantes pour distinguer clairement logique, rendu et mutation de grille.

### Notes phase 8

- La protection joueur sous objet pose est conservee comme regle volontaire, mais son commentaire precise maintenant qu'elle concerne un objet gravitaire statique tenu par la presence logique du joueur.
- Les anciens noms lies uniquement a la chute ont ete clarifies quand ils couvrent aussi glissement ou poussee.
- `hasFallingObjectAtGrid` devient `hasPhysicalObjectAtGrid`, car la liste contient maintenant `fall`, `slide` et `push`.
- `startPushedRock` devient `startPushedRockMove`, pour indiquer qu'il s'agit d'un mouvement physique horizontal non mortel.
- Les anciens appels aux noms remplaces ont ete retires.
- Les tuiles temporaires `0x12/0x13` restent volontairement en grille pour l'instant : elles servent encore de marqueurs runtime/rendu et de blocage simple pour certains systems comme les monstres.
- La suppression complete de ces tuiles temporaires demandera d'abord que les systems non joueur consultent explicitement la liste des objets physiques actifs.
- `GameplayScene` conserve encore des checks physiques d'orchestration; leur extraction complete est repoussee apres stabilisation des cas critiques de phase 9.

### Mini-plan phase 8 - Decoupler `0x12/0x13` de la logique physique

Objectif: ne plus faire dependre les collisions modernes des tuiles temporaires `0x12` et `0x13`, tout en evitant une suppression brutale qui casserait le rendu ou les systems encore branches sur la grille.

- [x] Creer un petit systeme `physical-object-system` pour centraliser les checks sur les objets physiques actifs.
- [x] Deplacer hors de `GameplayScene` le test d'occupation source/cible d'un objet actif.
- [x] Deplacer hors de `GameplayScene` les decisions d'impact joueur/monstre quand un objet physique arrive.
- [x] Adapter la collision joueur pour consulter explicitement les objets physiques actifs plutot que seulement les tuiles `0x12/0x13`.
- [x] Adapter la logique monstre pour considerer les objets physiques actifs comme bloquants, meme si la grille ne porte plus de tuile temporaire.
- [x] Adapter le rendu des rochers et diamants en mouvement pour s'appuyer prioritairement sur `state.fallingObjects`.
- [x] Conserver provisoirement `0x12/0x13` comme marqueurs de compatibilite ASM/rendu tant que le rendu et les systems n'ont pas tous ete decouples.
- [x] Une fois le decouplage termine, choisir explicitement entre deux options:
- Option A retenue: garder `0x12/0x13` dans la grille runtime comme etats compatibles ASM, mais sans role de source de verite collision.
- Option B: retirer `0x12/0x13` de la grille moderne pendant les mouvements, et les utiliser uniquement comme metadata/provenance ou frames de rendu.
- [x] Documenter l'option retenue avec la raison ISO/moderne.

Decision: l'option A est retenue a ce stade.

- Raison ISO: `0x12` et `0x13` sont documentes comme etats runtime generes par les routines originales, donc les conserver dans la grille preserve une trace proche du comportement TO8.
- Raison moderne: la source de verite collision/rendu actif devient `state.fallingObjects`; les tuiles `0x12/0x13` restent des marqueurs compatibles, pas le coeur de la logique.
- Raison pragmatique: retirer totalement `0x12/0x13` obligerait a adapter plusieurs chemins de rendu/debug/provenance sans gain gameplay immediat.
- Critere futur: l'option B pourra etre reconsideree uniquement si `0x12/0x13` provoquent un bug concret ou bloquent une evolution de rendu.

## Phase 9 - Verifier les cas critiques

- [ ] Joueur creuse sous un rocher : pas de mort immediate.
- [ ] Joueur creuse sous un diamant : pas de mort immediate.
- [ ] Joueur quitte la cellule sous un rocher : le rocher peut tomber.
- [ ] Joueur descend ensuite sous un rocher en chute : mort.
- [ ] Joueur descend ensuite sous un diamant en chute : mort.
- [ ] Rocher tombe au sol puis redevient poussable.
- [ ] Rocher pousse horizontalement puis redevient poussable une fois pose.
- [ ] Rocher tombe sur monstre : explosion et disparition du monstre.
- [ ] Diamant tombe sur monstre : explosion et disparition du monstre.
- [ ] Objet en chute ne se duplique pas dans la grille.
- [ ] Objet en chute ne reste pas bloque sous forme de tuile temporaire.

## Phase 10 - Documentation finale

- [ ] Documenter le modele physique retenu dans le fichier source du systeme.
- [ ] Documenter les routines ASM utilisees comme reference.
- [ ] Ajouter les cas non prouves dans `TODO.md`.
- [ ] Mettre a jour le plan `gameplay-collision-runtime-plan.md` si des items deviennent obsoletes.
- [ ] Conserver ce plan comme reference de simplification tant que la physique n'est pas stabilisee.
