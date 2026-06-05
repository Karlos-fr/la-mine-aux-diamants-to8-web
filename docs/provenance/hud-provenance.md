# HUD - Provenance

## Famille: panneaux HUD

- Métadonnées: `docs/extraction/mine-hud-metadata.json`
- Source mémoire: `extraction/sources/runtime/memory.bin`
- Source blocks: blocs KIT de reference
- TS: `src/assets/generated/mine-hud.ts`
- PNG 1:1: `docs/extraction/hud/left-wood-sign.png`, `right-gallery-sign.png`.
- Routine de rendu HUD: `KIT.BIN:$C197`
- Routine de blit blocs: `KIT.BIN:$C2D4`

### Confirmés

- `left-wood-sign` (`0x5900`, 64x40) confirmé (`KIT.BIN:$C197`, `C2D4`, tables `C336/C35E`, glyphes `C3D6/C4C6`).
- `right-gallery-sign` (`0x5920`, 64x40) confirmé (`KIT.BIN:$C197`, `C2D4`, tables `C386/C3AE`, glyphes `C3D6/C4C6`).

### Preuves principales

- `KIT.BIN:$C197` configure destination + tables de formes/couleurs.
- `KIT.BIN:$C2D4` rend une grille 8x5 de blocs 8x8.
- `KIT.BIN:$C1EF` et `$C222` composent les compteurs galerie dans le panneau droit.

### Rejets

- Aucun rejet de panneau confirmé pour cette famille.
- Exclusions globales maintenues: `SAPHIR.*`, `FBI.*`, `ANDROIDE.*`.

