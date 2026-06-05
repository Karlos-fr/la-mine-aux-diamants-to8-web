# Rapport de Provenance - Assets La Mine Aux Diamants

Objectif: chaque asset du remake TS doit pointer vers une source TO8 documentée, avec routine, adresse et statut de preuve.

- Fichiers exclus de source: `SAPHIR.*`, `FBI.*`, `ANDROIDE.*`
- Sources autorisées: `LA_MINE.BAS`, `LMINE0.BIN`, `LMINE1.BIN`, `TABLEAU.BIN`, `KIT.BIN`, `ENTET.BIN/ENT.BIN`, `INFOGRAM.MAP`, `memory.bin`, et blocs `KIT.BIN` reconstruits.

## Vue par famille

- [Tuiles](tiles.md)
- [Sprites / animations](sprites.md)
- [Fonte bitmap / HUD textuel](fonts.md)
- [Panneaux HUD](hud.md)
- [Ecran de démarrage (Infogrames)](startup.md)
- [Ecran titre / animations title](title.md)
- [Niveaux](levels.md)

## Convention de statut

- `confirmed` : rôle confirmé par routine + extraction + preuve croisée.
- `suspected` : correspondance visuelle confirmée, rôle/routine complémentaire à confirmer.
- `unidentified` : extrait mais non attribué à un rôle final.
- `rejected` : rejeté explicitement (familles externes ou rôle contradictoire).

## Sorties de la phase 7 (artefacts de provenance)

Tous les fichiers de provenance de famille sont dans `docs/provenance/` et pointent vers :
- fichiers binaires source (ou `.bin`/`memory.bin` lus pendant conversion),
- fichiers JSON de métadonnées dans `docs/extraction/`,
- fichiers TS générés dans `src/assets/generated/`,
- PNG d’assets dans `docs/extraction/` ou sous dossiers thématiques.

## Notes de rejet explicite

- Rejeté: toute réutilisation directe des assets `SAPHIR.*`, `FBI.*`, `ANDROIDE.*` pour `La Mine Aux Diamants`.
- Rejeté (provisoire): objets `tileId` `0x18`, `0x19`, `0x1A` tant que leur rôle n’est pas encore confirmé (`unidentified` dans la métrologie courante).
