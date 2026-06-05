# Plan - Niveaux JSON modernes et suppression de l'offset runtime

Objectif: remplacer les niveaux runtime derives de fichiers TS/adresses ASM par un format JSON moderne, simple a editer, puis supprimer l'offset temporaire joueur/viewport `-1/-1`.

## Constat

- Le runtime charge le niveau 1 depuis `src/assets/levels/level-01.json`.
- Les donnees extraites contiennent encore des notions proches du code original: adresses grille, tuiles numeriques, viewport adapte.
- Le rendu a utilise des offsets temporaires:
  - `PLAYER_RUNTIME_SCREEN_OFFSET_X = -1` (supprime en phase 3)
  - `PLAYER_RUNTIME_SCREEN_OFFSET_Y = -1` (supprime en phase 3)
  - `INITIAL_VIEWPORT_X = 0`
  - `INITIAL_VIEWPORT_Y = 0`
- Ces offsets compliquent:
  - position joueur;
  - ramassage herbe/diamants;
  - spawn blink;
  - collisions;
  - camera;
  - interpretation des bordures.

## Format JSON cible

Créer des fichiers de niveaux modernes, par exemple:

```json
{
  "id": "level-01",
  "label": "Galerie 01",
  "width": 38,
  "height": 20,
  "tileSize": 16,
  "time": 230,
  "scoreStep": 15,
  "requiredDiamonds": 17,
  "playerSpawn": { "x": 1, "y": 1 },
  "tiles": [
    { "x": 0, "y": 0, "type": "border" },
    { "x": 1, "y": 0, "type": "rock" },
    { "x": 2, "y": 0, "type": "earth" }
  ],
  "entities": [
    { "x": 9, "y": 1, "type": "diamond" },
    { "x": 4, "y": 4, "type": "monster" }
  ]
}
```

## Types logiques

Le JSON doit exposer des types metier, pas des `tileId` ASM.

Types initiaux:

- `empty`
- `earth`
- `rock`
- `diamond`
- `monster`
- `border`
- `platform`
- `exit`

Le mapping vers les tuiles historiques reste dans le moteur.

Mapping initial:

- `rock` -> `0x00`
- `earth` -> `0x01`
- `monster` -> `0x02`
- `diamond` -> `0x03`
- `border` / `exit` -> `0x04`, a clarifier selon contexte
- `empty` -> `0x05`
- `platform` -> `0x06`

## Phase 1 - Generation du JSON moderne

- [x] Creer un outil de conversion depuis les donnees actuelles: `tools/generate-modern-levels.mjs`.
- [x] Source temporaire: `docs/extraction/mine-levels.json`.
- [x] Sortie cible: `src/assets/levels/level-01.json` a `src/assets/levels/level-16.json`.
- [x] Supprimer les adresses originales du format runtime.
- [x] Garder les preuves ASM dans `docs/provenance` et les outils d'extraction, pas dans le JSON de jeu.

## Phase 2 - Loader runtime moderne

- [x] Creer un loader de niveaux JSON.
- [x] Remplacer dans `src/game/state.ts` la dependance directe a `mine-level-01-grid.ts`.
- [x] Construire depuis le JSON:
  - `LevelDefinition`;
  - entite joueur;
  - entites diamants;
  - entites monstres;
  - etat HUD initial;
  - grille runtime.
- [x] Conserver la possibilite d'ajouter facilement `level-02.json`, etc.

## Phase 3 - Suppression de l'offset joueur

- [x] Supprimer:
  - `PLAYER_RUNTIME_SCREEN_OFFSET_X`
  - `PLAYER_RUNTIME_SCREEN_OFFSET_Y`
- [x] Recalculer toutes les conversions joueur:
  - coordonnees grille;
  - coordonnees viewport;
  - coordonnees ecran;
  - coordonnees collision.
- [x] Le joueur doit etre rendu sur sa vraie case runtime.
- [x] Le ramassage herbe/diamant doit cibler exactement la case affichee.
- [x] Le spawn blink doit se faire sur la vraie case de spawn.

## Phase 4 - Suppression de l'offset viewport initial

- [x] Revoir:
  - `INITIAL_VIEWPORT_X`
  - `INITIAL_VIEWPORT_Y`
  - `CAMERA_MIN_X`
  - `CAMERA_MIN_Y`
- [x] Les bordures doivent venir du comportement runtime, pas d'un decalage joueur.
- [x] Representer explicitement les limites/bordures dans la grille moderne.

## Phase 5 - Camera

- [x] Garder la logique ASM deja identifiee:
  - marge gauche/droite `X=4/15`;
  - marge haut/bas `Y=2/7`;
  - bornes viewport `DBAF<=0x14`, `DBB0<=0x0c`.
- [x] Adapter ces seuils au modele sans offset.
- [x] Conserver le scroll fluide uniquement comme interpolation visuelle.

## Phase 6 - Nettoyage

- [x] Supprimer la note TODO sur l'offset temporaire une fois la migration terminee.
- [x] Mettre a jour les plans existants.
- [x] Supprimer les anciens artefacts de niveau devenus inutiles si le JSON moderne les remplace completement.

## Risques a surveiller

- Decalage entre rendu joueur et collision.
- Diamants visibles mais non collectes.
- Herbe coupee sur une case voisine.
- Spawn blink affiche au mauvais endroit.
- Bordures incorrectes en haut/gauche.
- Camera qui scrolle trop tot ou trop tard.

## Definition de fini

- Le runtime charge le niveau depuis un JSON moderne.
- Le JSON ne contient plus d'adresses ASM.
- Le joueur, les collisions, le ramassage, le spawn blink et la camera fonctionnent sans offset `-1/-1`.
- Les preuves ASM restent conservees dans la documentation/provenance, separees du format de niveau moderne.
