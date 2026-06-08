# Plan de realisation - Mode attract / demo automatique

## Objectif

Implementer le mode attract original de `La Mine aux Diamants` dans l'architecture moderne TypeScript, a partir des preuves documentees dans `ATTRACT_MODE_ASM_ANALYSIS.md`.

Le mode attract ne doit pas devenir un gameplay parallele. Il doit reutiliser le runtime moderne existant: chargement de niveau, camera, collisions, physique, monstres, creature speciale, HUD, rendu et transitions. La difference doit se limiter a la source d'entree joueur et aux regles de sortie du mode.

Les cadences runtime et les limites de synchronisation attract sont documentees dans `TO8_RUNTIME_TIMING.md`.

## Principes techniques

- Reutiliser `GameplayScene` et les systemes runtime existants autant que possible.
- Ajouter un mode de fonctionnement explicite, par exemple `gameplayMode: "normal" | "attract"`.
- Injecter une source d'input scriptable au lieu de lire le clavier normal pendant le mode attract.
- Garder le niveau cache comme donnee moderne separee du parcours normal.
- Ne pas faire progresser la partie normale quand la demo se termine.
- Revenir a l'ecran titre sur barre espace, fin de script `$DD`, ou sortie atteinte en mode attract.
- Garder l'implementation lisible et petite: pas de moteur de demo separe si le runtime courant suffit.

## Preuves ASM de reference

- Declenchement titre: compteur `$8DD8 == $34`.
- Niveau charge: `$C072 = $10`, pointeur `$B7C4`.
- Valeur galerie/HUD speciale: `$C74D = $16`.
- Activation demo: `$CE32 = 1`.
- Script demo: table `$D878`, index `$CE31`, commande `$CE33`, duree `$CE34`.
- Commandes mouvement: `1 = haut`, `3 = droite`, `5 = bas`, `7 = gauche`.
- Commandes sans mouvement direct: attente / animation.
- Sorties: barre espace, fin de script `$DD`, sortie atteinte.
- Grille cachee: tuiles `0x00`, `0x01`, `0x02`, `0x03`, `0x04`, `0x05`, `0x06`, `0x17`, `0x18`.

## Phase 1 - Stabiliser la donnee du niveau cache

- [x] Verifier que le niveau cache decode depuis `$B7C4` est stocke dans un JSON moderne dedie.
- [x] Renommer ou documenter clairement ce niveau comme donnee attract, meme s'il reste jouable via la selection de niveaux pour debug.
- [x] Ajouter dans le JSON ou dans un manifeste runtime une metadonnee indiquant qu'il provient de l'entree ASM `0x10 / $B7C4`.
- [x] S'assurer que ce niveau n'est pas considere comme le niveau suivant normal apres la galerie 16.
- [x] S'assurer que son `requiredDiamonds`, son temps, son score par diamant, son spawn et sa sortie reprennent le header ASM.

## Phase 2 - Modeliser le script `$D878`

- [x] Creer un module dedie au script attract, par exemple `src/game/attract/attract-script.ts`.
- [x] Encoder les octets utiles du script `$D878` dans une constante documentee.
- [x] Implementer un decodeur minimal reproduisant `$CE31`, `$CE33`, `$CE34`.
- [x] Gerer les commandes longues: octet `>= 0x10`, commande `octet & 0x0F`, duree = octet suivant.
- [x] Gerer les commandes courtes: octet `< 0x10`, commande immediate d'une unite logique.
- [x] Gerer la fin de script `$DD`.
- [x] Mapper `1`, `3`, `5`, `7` vers les directions runtime existantes.
- [x] Mapper toute autre commande vers `idle` / attente / animation sans mouvement direct.
- [x] Documenter dans l'entete du module les adresses ASM `$CE13-$CE49` et `$D878`.

## Phase 3 - Introduire une source d'input scriptable

- [x] Identifier l'interface actuelle entre `GameplayScene` et les commandes joueur.
- [x] Extraire ou formaliser une abstraction simple de source d'input joueur si elle n'existe pas deja.
- [x] Implementer une source `KeyboardPlayerInputSource` pour conserver le comportement normal.
- [x] Implementer une source `AttractScriptInputSource` basee sur le decodeur `$D878`.
- [x] Faire produire a `AttractScriptInputSource` les memes intentions de deplacement que le clavier.
- [x] S'assurer que les commandes `idle` ne bloquent pas les animations globales, les monstres ou la physique.
- [x] Eviter toute logique specifique attract dans les systemes de physique ou de collision.

## Phase 4 - Ajouter le mode attract a `GameplayScene`

- [x] Ajouter une option de creation de scene ou de chargement, par exemple `{ mode: "normal" | "attract" }`.
- [x] En mode normal, conserver strictement le comportement actuel.
- [x] En mode attract, charger le niveau cache et utiliser `AttractScriptInputSource`.
- [x] En mode attract, ignorer le controle joueur clavier normal pour le deplacement.
- [x] Garder la barre espace comme sortie du mode attract dans la phase 6.
- [x] En mode attract, conserver monstres, creature speciale, chutes, transformations, collecte, mort et rendu via les systemes existants.
- [x] En mode attract, neutraliser toute progression normale de galerie a la fin de la demo.
- [x] Verifier dans le code que le mode attract reste une option explicite et ne fuit pas dans les niveaux normaux.

## Phase 5 - Brancher le declenchement depuis le deuxieme ecran titre

- [x] Localiser dans le runtime moderne l'ecran titre avec le bonhomme anime.
- [x] Ajouter un compteur d'inactivite logique equivalent au compteur ASM `$8DD8`.
- [x] Definir un seuil constant documente `0x34`, soit 52 passages logiques.
- [x] Reinitialiser ce compteur sur input utilisateur pertinent, comme le titre original.
- [x] Quand le seuil est atteint, lancer `GameplayScene` en mode attract avec le niveau cache.
- [x] Conserver le lancement normal par barre espace vers le flux de jeu existant.
- [x] Ne pas mesurer encore la duree en secondes comme verite ISO: documenter que le seuil logique est prouve, mais la duree murale reste a calibrer.

## Phase 6 - Gerer les sorties du mode attract

- [x] Ajouter la sortie par barre espace depuis le mode attract vers l'ecran titre.
- [x] Ajouter la sortie par fin de script `$DD` vers l'ecran titre.
- [x] Ajouter la sortie quand le joueur atteint la sortie du niveau en mode attract.
- [x] S'assurer que la sortie du mode attract ne change pas le niveau courant normal, le score persistant ou la progression.
- [x] Reinitialiser l'etat du script attract a chaque nouveau lancement.
- [x] Reinitialiser proprement les etats runtime temporaires au retour titre.

## Phase 7 - HUD et valeur galerie speciale

- [x] Verifier comment le HUD moderne affiche le numero de galerie.
- [x] En mode attract, afficher ou preparer la valeur speciale equivalente a `$C74D = $16` si le HUD courant expose cette information.
- [x] Si le HUD moderne ne permet pas ce rendu proprement, documenter l'ecart temporaire plutot que complexifier le systeme.
- [x] S'assurer que le compteur de diamants requis utilise bien `14`.
- [x] S'assurer que le score par diamant utilise bien `12`.
- [x] S'assurer que le temps initial utilise bien le header attract.

## Phase 8 - Integration UI et debug

- [x] Garder le niveau cache selectionnable manuellement uniquement comme outil de debug si cela reste utile.
- [x] Distinguer dans la liste de niveaux le niveau jouable de debug et le mode attract automatique.
- [x] Ajouter un libelle explicite, par exemple `Mode attract cache`.
- [x] Eviter que la selection manuelle active automatiquement le script, sauf si une option debug dediee le demande.
- [x] Si necessaire, ajouter une option de debug temporaire pour lancer directement le mode attract scriptable.

## Phase 9 - Documentation et conventions

- [ ] Mettre a jour `ATTRACT_MODE_ASM_ANALYSIS.md` si l'implementation revele un ecart.
- [ ] Ajouter les references ASM dans les entetes des nouveaux fichiers TypeScript selon `CODE_DOCUMENTATION_CONVENTION.md`.
- [ ] Documenter les constantes critiques: `$34`, `$B7C4`, `$D878`, `$DD`, commandes `1/3/5/7`.
- [ ] Mettre a jour le README si le mode attract devient une fonctionnalite visible.
- [ ] Ajouter une note de calibration future pour la duree reelle en secondes.

## Phase 10 - Validation manuelle ciblee

- [ ] Lancer l'application uniquement quand l'implementation est prete a etre verifiee.
- [ ] Verifier que l'ecran titre normal lance toujours le jeu comme avant.
- [ ] Verifier qu'apres inactivite, le mode attract charge le niveau cache.
- [ ] Verifier que le joueur bouge automatiquement selon le script.
- [ ] Verifier que monstres, creature speciale, diamants, rochers, HUD et camera restent actifs.
- [ ] Verifier que la barre espace quitte le mode attract vers le titre.
- [ ] Verifier que la fin de script revient au titre.
- [ ] Verifier qu'atteindre la sortie revient au titre sans progresser dans les niveaux normaux.

## Hors scope volontaire

- [ ] Ne pas implementer d'emulation 6809.
- [ ] Ne pas creer un deuxieme moteur de gameplay pour la demo.
- [ ] Ne pas ajouter de tuiles `0x1D` ou `0x1F` pour ce mode.
- [ ] Ne pas figer une duree en secondes pretendument ISO sans mesure video ou emulateur.
- [ ] Ne pas transformer le niveau cache en galerie normale du jeu.
