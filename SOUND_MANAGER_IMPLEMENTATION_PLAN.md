# Plan - Gestionnaire sonore original et moderne

Objectif: ajouter une couche audio propre au portage moderne, capable de reproduire les sons prouves du jeu TO8 original tout en reservant un mode sonore moderne separable.

## Phase 1 - Architecture audio minimale

- [x] Creer un module `src/audio` dedie, sans dependance gameplay circulaire.
- [x] Definir deux modes sonores: `original` et `modern`.
- [x] Exposer une facade unique `gameAudio` pour les scenes.
- [x] Garder le mode `original` actif par defaut.
- [x] Prevoir le deverrouillage WebAudio apres geste utilisateur navigateur.

## Phase 2 - Profils originaux prouves ASM

- [x] Encoder le bruitage score/diamant d'apres `KIT.BIN:$C255`.
- [x] Encoder le bruitage explosion d'apres les appels `KIT.BIN:$CCFB/$CD03/$CD0B -> $BD9F`.
- [x] Encoder la musique de l'ecran 2 d'apres le generateur DAC `ENTET.BIN:$943F-$9498` et sa table `$94A5-$9524`.
- [x] Reutiliser le bruitage score pour la conversion temps restant vers points en fin de niveau.

## Phase 3 - Integration runtime moderne

- [x] Lancer la musique originale en entrant dans l'ecran titre.
- [x] Arreter la musique originale en quittant l'ecran titre.
- [x] Jouer le bruitage diamant lors de `diamondCollected`.
- [x] Jouer le bruitage score pendant chaque pas de bonus de fin de niveau.
- [x] Jouer le bruitage explosion quand une explosion 3x3 demarre.

## Phase 4 - Mode moderne futur

- [x] Garder une strategie `modern` separee mais silencieuse pour l'instant.
- [ ] Ajouter plus tard des sons modernes non ISO sans modifier les points d'accroche gameplay.
- [ ] Ajouter plus tard une interface de selection/persistence du mode sonore si necessaire.

## Contraintes d'integration

- Le gameplay ne doit pas connaitre WebAudio.
- Les sons originaux doivent rester nommes par intention metier, pas par adresse ASM dans les scenes.
- Les adresses ASM restent documentees dans les commentaires du module audio et dans `SOUND_ASM_ANALYSIS.md`.
- Le mode moderne ne doit jamais alterer le mode original.
