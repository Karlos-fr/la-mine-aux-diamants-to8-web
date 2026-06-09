# Ajouter une brique custom

Ce projet centralise les mondes, tuiles, entites et comportements dans `src/worlds/world-registry.ts`.
Pour ajouter une brique simple, il ne faut plus modifier les renderers, le loader ou l'editeur.

## Tuile statique

1. Ajouter le PNG 16x16 dans `src/assets/custom-worlds/<world>/`.
2. Importer ce PNG dans `src/worlds/world-registry.ts`.
3. Ajouter une entree `WorldTileDefinition` dans le monde cible.
4. Choisir un `behavior` existant: `earth`, `platform`, `border`, `transformerBlock`, etc.
5. Choisir un `runtimeTileId`.
   - Pour une variante graphique statique, utiliser un id custom hors atlas original, par exemple `0x101`.
   - Pour une tuile originale, conserver les constantes `RUNTIME_TILE`.
6. Lancer `npm run build`.

## Entite animee

1. Ajouter les frames PNG 16x16 dans `src/assets/custom-worlds/<world>/`.
2. Importer les frames dans `src/worlds/world-registry.ts`.
3. Ajouter une entree `WorldEntityDefinition`.
4. Ajouter une entree `WorldTileDefinition` avec `entityId` si l'entite doit etre posable depuis la palette.
5. Reutiliser un comportement existant quand c'est possible: `monster`, `diamond` ou `specialCreature`.
6. Donner un `spriteFrameId` stable pour que le gameplay conserve l'apparence pendant le rendu.
7. Lancer `npm run build`.

## Exemple mine-metal

Le monde `mine-metal` declare aujourd'hui:

- `customEarth`, une terre creusable avec le comportement `earth`;
- `customPlatform`, une plateforme solide avec le comportement `platform`;
- `customMonster`, un monstre anime avec le comportement `monster`.

Ces briques apparaissent dans l'editeur, dans la vitrine et en gameplay sans mappings locaux supplementaires.
