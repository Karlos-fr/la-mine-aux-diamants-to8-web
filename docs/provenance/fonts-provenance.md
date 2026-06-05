# Fonts - Provenance

## Famille: fonte bitmap / rendu texte

- Métadonnées: `docs/extraction/mine-fonts-metadata.json`
- Source mémoire: `extraction/sources/runtime/memory.bin`
- TS: `src/assets/generated/mine-fonts.ts`
- PNG:
  - `docs/extraction/fonts/hud-large-16-atlas.png`
  - `docs/extraction/fonts/hud-large-16-alt-atlas.png`
  - `docs/extraction/fonts/hud-small-11-atlas.png`
  - `docs/extraction/fonts/hud-small-11-alt-atlas.png`
  - `docs/extraction/fonts/hud-digits-7-atlas.png`
  - `docs/extraction/fonts/hud-digits-7-alt-atlas.png`
- Routine: `KIT.BIN:$C601`
- Source d’appels:
  - `KIT.BIN:$C0FE`, `$C131`, `$C1EF`, `$C222`, `$C54D`, `$C59E`, `$C516`

## Confirmés

Toutes les familles de fontes sont `confirmed` dans la metadata:

- `hud-large-16`
- `hud-large-16-alt`
- `hud-small-11`
- `hud-small-11-alt`
- `hud-digits-7`
- `hud-digits-7-alt`

## Sources de preuve

- Formats TO8 vérifiés (terminateur `0xDD`, hauteur de glyphe par routine).
- Mapping caractères d’exemple (`Points`, `Temps`, `Record`) confirmé via tables d’indices `C74E`, `C764`, `C71C`, `C723`, `C727`, `C72E`, `C735`, `C738`.

## Rejets

- Aucun rejet interne à cette famille.
- Exclusions globales inchangées : `SAPHIR.*`, `FBI.*`, `ANDROIDE.*`.

