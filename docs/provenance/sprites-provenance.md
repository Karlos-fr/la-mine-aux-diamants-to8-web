# Sprites - Provenance

## Famille: animations et objets dynamiques

- Metadonnees: `docs/extraction/mine-sprites-metadata.json`
- Source d'assets: atlas `KIT.BIN:$D218-$D8D7`, rendu `KIT.BIN:$D145`
- Source memoire: `extraction/sources/runtime/memory.bin`
- TS: `src/assets/generated/mine-sprites.ts`
- PNG derives:
  - `docs/extraction/sprites/player-*.png`
  - `docs/extraction/sprites/diamond-*.png`
  - `docs/extraction/sprites/rocks-*.png`
  - `docs/extraction/sprites/explosion-*.png`
  - `docs/extraction/sprites/monster-*.png`
  - `docs/extraction/sprites/objects-*.png`

### Confirmes

- Joueur:
  - `0x07`, `0x08`, `0x09`, `0x0A`, `0x0B` = cycle idle confirme (`KIT.BIN:$CED9`).
  - `0x0C` = deplacement droite (`KIT.BIN:$CEF0`).
  - `0x0F` = deplacement gauche (`KIT.BIN:$CF4A`).
- Diamant:
  - `0x03` = animation couleur (`KIT.BIN:$D1E0`, routines liees a `CB17/CB84`).
  - `0x13` = version sliding/mouvement confirmee (`CB84`/`CBE2`).
- Rock:
  - `0x00` rocher statique.
  - `0x12` sliding/phase de mouvement (`CB89`/`CBDD`).
- Explosion:
  - `0x14` -> `0x15` -> `0x16` -> `0x05` confirme par `KIT.BIN:$CCC6` + zone 3x3 via `CCFE`.
- Objets:
  - `0x02` monstre standard confirme, animation blink via `KIT.BIN:$D1BB`, deplacement via `KIT.BIN:$CA04`.
  - `0x04` bloc sortie / bloc protege confirme.
  - `0x05` vide confirme (`CB3B` + comportement terrain).
  - `0x17` creature speciale bleue a quatre carres jaunes, suivie separement du monstre `0x02` via `BC07`, `BB24`, `CC4F`, deplacement via `BC84`.
  - `0x18` bloc transformateur spirale, utilise par `CB3B` pour convertir rocher <-> diamant.

### Suspects

- Joueur variantes visuelles:
  - `0x0D`, `0x0E`, `0x10`, `0x11` restent a verrouiller.
- Objets:
  - `0x01` terre suspectee.
  - `0x06` plateforme suspectee.

### Non confirmes (non rejets)

- `0x19` et `0x1A` restent extraits mais non assignes a une mecanique definitive.
- `0x19` n'est pas place dans les grilles decodees et reste hors gameplay direct.

### Rejet formel

- Aucun asset de cette famille n'est rejete pour la logique de base.
- Rejets explicites maintenus au niveau source: familles `SAPHIR.*`, `FBI.*`, `ANDROIDE.*`.
