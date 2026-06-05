# Startup - Provenance

## Famille: écran de démarrage

- Métadonnées: `docs/extraction/mine-startup-metadata.json`
- Source:
  - `extraction/sources/disk/infogram_map.bin` (`INFOGRAM.MAP`)
  - boot logic (`web/src/generated/game-entry.ts:showBootSplash`)
- TS générateur: `tools/extract-mine-startup.mjs`
- PNG 1:1: `docs/extraction/startup/startup-01-infogrames-presents.png`
- Routine: `ENTET.BIN:$9367` (séquence de reconstruction).

### Confirmés

- `startup-01-infogrames-presents`: confirmé comme écrans titre 320x200.

### Preuves

- Décode `LOADP INFOGRAM.MAP`, placement du logo + textes selon positions observées.
- Couleurs via routine firmware (`locate`, `print`, et commandes palette du boot path simulé).

### Rejets

- Aucun rejet interne à cette famille.
- Interdiction constante: ne jamais réutiliser `SAPHIR.*`, `FBI.*`, `ANDROIDE.*` comme source de startup.

