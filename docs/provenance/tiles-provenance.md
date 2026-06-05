# Tiles - Provenance

## Famille: tuiles statiques

- Métadonnées: `docs/extraction/mine-tiles-metadata.json`
- Atals d’extraction: `docs/extraction/mine-tiles-atlas-D218-D8D7.png`
- Contrôle: `docs/extraction/mine-tiles-D218-D8D7-control.png`
- TS: `src/assets/generated/mine-tiles.ts`
- Routine de rendu: `KIT.BIN:$D145`
- Routine de décodage grille: `KIT.BIN:$DA10`
- Source principale: `extraction/sources/runtime/memory.bin` + blocs KIT de reference

### Éléments confirmés

- `tileId 0x00` rocher statique (atlas `$D218-$D257`), confirmé par diff visuel contre l’oracle et routine.
- `tileId 0x03` (diamant) confirmé via routines `CB17`, `D1E0` et présence cohérente niveau + animation.
- `tileId 0x04` (bloc sortie / bloc protégé) confirmé via routines `DA10`, `BEA7`, `BFB6`, `BFE2`.
- `tileId 0x05` (vide) confirmé par routines de chute/collision (`CB3B`, `CBA7`, `BD03`...).
- `tileId 0x02` (monstre) confirmé via routines `DA10`, `CC5B`, `D1BB`.
- `tileId 0x17` (cible/état spécial) confirmé via `BC07`, `D1BB`/`CC57`.

### Suspects

- `tileId 0x01` : terrain/terre suspecté.
- `tileId 0x06` : platforme verte suspectée.
- `tileId 0x13` : état de diamant/rock slant confirmé visuellement mais rôle final en lien avec logique de glissement.

### Non confirmés

- `tileId 0x18`, `0x19`, `0x1A` : extraits (voir status `unidentified` dans metadata), rôle non confirmé sans preuve de routine robuste.

### Fichiers sources

- `docs/rock-bin-tile00.png` (oracle d’extraction rocher) + `docs/rock-oracle-16x16.png` (référence visuelle historique).
- `docs/rock-oracle-crop.png` (panneau de découpe visuelle de contrôle).

