# Phase 2 - Nouvelle Base TypeScript

Ce document resume la base moderne mise en place pour remplacer le point d'entree runtime du port TO8 automatique.

## Livrables

- App Vite + TypeScript ajoutee avec `package.json`, `tsconfig.json` et `vite.config.ts`.
- `index.html` remplace l'ancien chargement du bundle genere par le point d'entree `/src/main.ts`.
- Canvas unique `#game-screen` en 320x200 logique, centre dans la page et upscale en nearest-neighbor.
- Arborescence source creee:
  - `src/engine`: boucle fixe, input, renderer et routage de scenes.
  - `src/game`: etat minimal de shell gameplay.
  - `src/screens`: scene titre et scene gameplay provisoire.
  - `src/assets`: palette et fonte bitmap provisoires.
  - `src/tools`: liste des sources TO8 reservees au build-time.

## Runtime Moderne

- Aucune routine 6809 n'est executee.
- Aucun acces runtime a `memory.bin`, `resources.json`, `disk-resources.json`, `disk/*` ou `assets/DATA_*.bin`.
- Les anciens fichiers binaires restent dans le depot seulement comme matiere d'analyse/conversion pour les phases suivantes.
- Le shell affiche directement le canvas de jeu, sans controle emulateur ni interface de portage.

## Moteur

- `FixedGameLoop` cadence les updates a 50 Hz avec rendu navigateur decouple via `requestAnimationFrame`.
- `KeyboardInput` expose les actions modernes:
  - fleches: directions;
  - `Space`: confirmation et action;
  - `Ctrl`: action;
  - `Enter`: confirmation;
  - `Escape`: annulation future.
- `SceneRouter` route les scenes via `enter()`, `update(dt, input)` et `render(renderer)`.
- `Canvas2DRenderer` fixe la surface logique a 320x200 et desactive le lissage.

## Validation Phase 2

- `npm install` execute avec succes.
- `npm run build` execute avec succes.
- Le build Vite genere uniquement HTML/CSS/JS modernes dans `dist/`.
