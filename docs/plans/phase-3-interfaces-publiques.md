# Phase 3 - Interfaces Publiques

Ce document resume les contrats TypeScript publics ajoutes pour stabiliser l'architecture du remake avant les phases de conversion d'assets, de rendu pixel-perfect et de gameplay.

## Engine

- `InputState` expose les actions clavier courantes, les transitions `justPressed`/`justReleased` et les axes directionnels normalises.
- `Scene` garde le cycle public `enter(context)`, `update(dt, input)` et `render(renderer)`.
- `Renderer` expose les operations de rendu modernes:
  - effacement ecran;
  - rectangles remplis/contours;
  - sprites;
  - tuiles;
  - texte bitmap.
- Les types de rendu partages sont dans `src/engine/render-types.ts`: `Point2D`, `Size2D`, `Rect2D`, `SpriteFrame`, `TileFrame`, `DrawSpriteOptions`, `DrawTextOptions`.
- `src/engine/index.ts` sert de facade publique pour les imports futurs.

## Game

- `TileDefinition` decrit les tuiles par id, nom, collision, collecte optionnelle et rendu.
- `LevelDefinition` decrit une galerie moderne: dimensions, taille de tuile, couche de tuiles, definitions, entites initiales, depart joueur et metadata de progression.
- `EntityState` couvre joueur, diamants, rochers, portes, marqueurs et effets.
- `HudState` couvre score, temps, record, galerie et diamants restants.
- `GameState` regroupe scene courante, niveau, entites, joueur, HUD, vies, fin de niveau et game over.
- `src/game/index.ts` sert de facade publique pour les imports futurs.

## Integration Actuelle

- Le shell gameplay provisoire utilise deja `GameState`.
- Le niveau provisoire `SHELL_LEVEL` respecte `LevelDefinition`.
- Le renderer Canvas2D implemente les nouveaux appels `drawSprite`, `drawTile` et `drawText`.

## Validation Phase 3

- `npm run build` execute avec succes.
