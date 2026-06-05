# Levels - Provenance

## Famille: niveaux

- Métadonnées: `docs/extraction/mine-levels.json`
- Décodage: `tools/decode-mine-levels.mjs`
- Source: `extraction/sources/runtime/memory.bin` + `extraction/sources/disk/tableau_bin.bin`
- Routine principale: `KIT.BIN:$DA10`
- Pointeur niveaux: `0xBFC0` (16 niveaux)
- Grille logique: `38x20`, stride `40`, base grille `0xDBE0`
- RLE: byte <= `0x7F` (direct) / byte > `0x7F` (run-length)
- Artefacts:
  - `docs/extraction/levels/mine-level-XX.json`
  - `docs/extraction/levels/mine-level-XX.png`
  - `src/assets/generated/levels/mine-level-XX.ts`
  - `src/assets/generated/mine-levels.ts`

### Confirmés

- Nombre de niveaux: 16
- Dimensions: 760 cellules logiques par niveau
- Sortie/entrée joueurs et objets reconstruites depuis l’en-tête (`+4/+5`, `+6/+7`) et grille décodée.
- Tile IDs: présence et répartition cohérentes avec extraction.

### Champs d’en-tête

Pour chaque niveau:
- time (bytes `+8/+9`) = décodage BCD **inféré** (requiert validation finale contre une table de score officielle si disponible).
- `param1` (byte `+10`) et `param2` (byte `+11`) : paramètres gameplay conservés pour réutilisation.

### Rejets

- Aucun niveau rejeté.
- `tileId` non attribués (ex. `0x18`) marqués `unidentified`, utilisés en mode non actif en attendant confirmation de rôle.

