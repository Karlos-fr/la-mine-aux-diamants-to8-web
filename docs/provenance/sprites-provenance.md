# Sprites - Provenance

## Famille: animations et objets dynamiques

- Métadonnées: `docs/extraction/mine-sprites-metadata.json`
- Source d’assets: atlas `KIT.BIN:$D218-$D8D7`, rendu `KIT.BIN:$D145`
- Source mémoire: `extraction/sources/runtime/memory.bin`
- TS: `src/assets/generated/mine-sprites.ts`
- PNG dérivés:
  - `docs/extraction/sprites/player-*.png`
  - `docs/extraction/sprites/diamond-*.png`
  - `docs/extraction/sprites/rocks-*.png`
  - `docs/extraction/sprites/explosion-*.png`
  - `docs/extraction/sprites/monster-*.png`
  - `docs/extraction/sprites/objects-*.png`

### Confirmés

- Joueur:
  - `0x07`, `0x08`, `0x09`, `0x0A`, `0x0B` = cycle idle confirmé (`KIT.BIN:$CED9`).
  - `0x0C` = déplacement droite (`KIT.BIN:$CEF0`).
  - `0x0F` = déplacement gauche (`KIT.BIN:$CF4A`).
- Diamant:
  - `0x03` = animation couleur (`KIT.BIN:$D1E0`, routine liée à `CB17/CB84`).
  - `0x13` = version « sliding left » confirmée (`CB84`/`CBE2`).
- Rock:
  - `0x00` rocher statique
  - `0x12` sliding/phase de mouvement (`CB89`/`CBDD`)
- Explosion:
  - `0x14` → `0x15` → `0x16` → `0x05` confirmé par `KIT.BIN:$CCC6` + application zone 3x3 via `CCFE`.
- Objets:
  - `0x02` monstre confirmé (animation blink via `KIT.BIN:$D1BB` inversion de plans).
  - `0x04` bloc sortie / bloc protégé confirmé.
  - `0x05` vide confirmé (`CB3B` + comportement terrain).

### Suspects

- Joueur variantes visuelles:
  - `0x0D`, `0x0E`, `0x10`, `0x11` (présence visuelle conforme joueur, rôle d’animation précise non encore verrouillé).
- Objets:
  - `0x01` terre suspectée
  - `0x06` plateforme suspectée

### Non confirmés (non rejets)

- `0x18`, `0x19`, `0x1A` (`unidentified`) restent extraits mais non assignés à une mécanique définitive.

### Rejet formel

- Aucun asset de cette famille n’est rejeté pour la logique de base.
- Rejets explicites maintenus au niveau source: familles `SAPHIR.*`, `FBI.*`, `ANDROIDE.*`.

