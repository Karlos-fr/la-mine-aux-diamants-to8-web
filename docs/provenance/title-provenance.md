# Title - Provenance

## Famille: écran titre + animations

- Métadonnées: `docs/extraction/mine-title-metadata.json`
- Source de données:
  - `ENT.BIN:$7000-$8C62`
  - `ENTET.BIN:$8C63-$9510`
  - routines simulées depuis le portage TS (`8DDB`, `8EB6`, `8F2D`, etc.)
- TS générateur: `tools/extract-mine-title.mjs`
- TS intégration: `src/assets/generated/mine-title.ts`
- PNG:
  - `docs/extraction/startup/startup-02-title-entet-9367.png`
  - `docs/extraction/startup/animations/title-*.png`
- Taille: 320x200

### Confirmés

- `startup-02-title-entet-9367`
- `title-face` (17 états)
- `title-sparkles` (10 états)
- `title-feet` (2 états)
- `title-selection`
- `title-menu-blocks`

### Routines de preuve

- `ENTET.BIN:$9367` + `ENTET.BIN:$8C80` : décodage écran base.
- `ENTET.BIN:$8EB6` + tables `8EF0` / glyphes `905B` : visages animés.
- `ENTET.BIN:$8DFF` + tables `8E46/8E5C` / glyphes `908B` : scintillements.
- `ENTET.BIN:$8F2D/$8F6E` + tables `8F92/8F96` : animation pieds.
- `ENTET.BIN:$8DDB`, `$911B/$912E/$9141` : sélection et animations menu.

### Rejets

- Aucun rejet interne.
- Exclusions globales: `SAPHIR.*`, `FBI.*`, `ANDROIDE.*`.

