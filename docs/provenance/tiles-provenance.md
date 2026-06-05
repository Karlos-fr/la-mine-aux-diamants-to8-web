# Tiles - Provenance

## Famille: tuiles statiques et objets de grille

- Metadonnees: `docs/extraction/mine-tiles-metadata.json`
- Atlas d'extraction: `docs/extraction/mine-tiles-atlas-D218-D8D7.png`
- Controle: `docs/extraction/mine-tiles-D218-D8D7-control.png`
- TS: `src/assets/generated/mine-tiles.ts`
- Routine de rendu: `KIT.BIN:$D145`
- Routine de decodage grille: `KIT.BIN:$DA10`
- Source principale: `extraction/sources/runtime/memory.bin` + blocs KIT de reference

### Elements confirmes

- `tileId 0x00` rocher statique, confirme par diff visuel contre l'oracle et par les routines de physique.
- `tileId 0x02` monstre standard, confirme via `DA10`, `CC5B`, `D1BB`; deplacement dedie par `CA04`.
- `tileId 0x03` diamant, confirme via `CB17`, `D1E0` et presence coherente dans les niveaux.
- `tileId 0x04` bloc sortie / bloc protege, confirme via `DA10`, `BEA7`, `BFB6`, `BFE2`.
- `tileId 0x05` vide, confirme par routines de chute/collision (`CB3B`, `CBA7`, `BD03`...).
- `tileId 0x17` creature speciale bleue a quatre carres jaunes, confirmee via `BC07`, table dediee `$DB4F`, `BB24`, `CC4F` et deplacement dedie par `BC84`.
- `tileId 0x18` bloc transformateur spirale, confirme via `CB3B`: un rocher traversant devient diamant et un diamant traversant devient rocher.

### Suspects

- `tileId 0x01` : terrain/terre suspecte.
- `tileId 0x06` : plateforme verte suspectee.
- `tileId 0x13` : etat de diamant/rock slant confirme visuellement mais role final lie aux transitions de glissement.

### Non confirmes

- `tileId 0x19` : extrait mais non place dans les grilles decodees; candidat graphique/artefact, hors gameplay direct.
- `tileId 0x1A` : extrait, role non confirme sans preuve de routine robuste.

### Fichiers sources

- `docs/rock-bin-tile00.png` et `docs/rock-oracle-16x16.png`.
- `docs/rock-oracle-crop.png`.
