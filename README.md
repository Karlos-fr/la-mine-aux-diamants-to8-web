# La Mine aux Diamants TO8 - Portage moderne TypeScript

Ce dépôt contient un portage web moderne de **La Mine aux Diamants**, jeu Thomson TO8 publié par Infogrames en 1986.

Le projet est parti d'un portage automatique généré avec `TO8 Porting Kit v2`, puis a été progressivement reconstruit en TypeScript moderne avec un objectif clair : conserver un rendu et un comportement aussi proches que possible de l'original TO8, tout en obtenant une architecture lisible et maintenable.

## Objectif du projet

Le but n'est pas de créer un remake librement réinterprété, ni un moteur générique multi-jeux.

L'objectif est plutôt :

- reproduire le rendu TO8 de façon fidèle;
- conserver les règles de gameplay observées dans le code original;
- utiliser les assets extraits ou reconstruits depuis les sources ASM/BASIC quand c'est possible;
- isoler progressivement les concepts modernes : scènes, runtime, rendu, grille, entités, assets;
- garder le code suffisamment simple pour continuer le portage sans sur-architecture.

Le projet reste expérimental et en cours de portage.

## Fonctionnalités actuellement portées

- Écran Infogrames initial.
- Écran titre principal.
- Chargement de niveaux modernes en JSON.
- Rendu partiel du niveau avec caméra.
- Déplacement fluide du joueur case par case.
- Gestion de la grille runtime.
- Récolte de l'herbe et des diamants.
- HUD avec compteurs `Points`, `Temps`, `Record` et panneau galerie.
- Animation des diamants.
- Animation et déplacement des monstres.
- Chute des rochers et diamants selon les règles déjà analysées.
- Viewer développeur pour les sprites et animations extraites.

## Lancer le projet

Installer les dépendances :

```bash
npm install
```

Démarrer le serveur de développement :

```bash
npm run dev
```

Puis ouvrir l'application dans le navigateur, généralement :

```text
http://localhost:5173/
```

Construire la version de production :

```bash
npm run build
```

Prévisualiser le build :

```bash
npm run preview
```

## Contrôles

- `Espace` : avancer dans les écrans de démarrage.
- Flèches directionnelles : déplacer le personnage.
- `Ctrl` ou `Espace` : action, selon le contexte.

Le déplacement du joueur est fluide visuellement, mais reste logique : une pression déplace le personnage d'une case entière.

## Viewer développeur

Un viewer d'animations est disponible avec :

```text
http://localhost:5173/?mode=gallery
```

Il permet d'inspecter les atlas extraits et les animations déclarées dans les metadata :

- joueur;
- diamants;
- rochers;
- explosions;
- objets;
- monstres.

Ce viewer sert de support pour vérifier les assets sans mélanger ce code avec le runtime du jeu.

## Architecture

Le portage moderne est organisé autour de quelques blocs simples.

```text
src/
  assets/
    generated/          Metadata TypeScript générées depuis les extractions.
    levels/             Niveaux modernes au format JSON.
    runtime-assets.ts   Catalogue central des URLs d'assets.
    runtime-asset-loader.ts

  engine/
    game-app.ts         Assemblage canvas, input, scènes et boucle.
    game-loop.ts        Boucle de jeu à pas fixe.
    input.ts            Abstraction clavier.
    renderer.ts         Renderer Canvas 2D pixel-perfect.
    scene.ts            Contrats et routeur de scènes.

  game/
    gameplay-runtime.ts Orchestration de l'ordre d'update gameplay.
    runtime-grid.ts     Grille runtime mutable.
    runtime-mutations.ts
    runtime-tiles.ts    Tile ids runtime prouvés.
    level-loader.ts     Chargement et validation des niveaux JSON modernes.
    systems/            Systèmes gameplay ciblés.

  rendering/
    gameplay-renderer.ts
    font-renderer.ts
    hud-renderer.ts
    level-renderer.ts
    entity-renderer.ts

  screens/
    startup-screens.ts
    gameplay-scene.ts
    scene-factory.ts

  dev-animation-gallery.ts
  main.ts
  styles.css
```

## Principes d'architecture

- `GameplayScene` reste une scène : elle gère le cycle de vie, la navigation et le lien entre runtime et rendu.
- `GameplayRuntime` orchestre l'ordre d'update sans porter les règles détaillées.
- `RuntimeMutations` centralise les mutations de grille : joueur, diamants, objets tombants, monstres, spawn.
- `GameplayRenderer` lit l'état runtime et dessine la frame sans mutation.
- `RuntimeAssets` regroupe le chargement des images nécessaires au gameplay.
- Les systèmes dans `src/game/systems/` gardent les règles localisées : joueur, caméra, monstres, objets tombants, sortie, spawn.

Cette architecture vise une séparation raisonnable, pas une abstraction excessive.

## Niveaux modernes

Les niveaux utilisés par le runtime moderne sont stockés dans :

```text
src/assets/levels/
```

Ils utilisent un format JSON éditable, sans adresses mémoire originales. Le loader moderne convertit ensuite ces données vers les tile ids runtime nécessaires au rendu et au gameplay.

Le schéma est documenté dans :

```text
src/game/level-loader.ts
```

## Assets et extraction

Les assets proviennent principalement du travail d'extraction autour du jeu original :

```text
docs/extraction/
```

Les outils d'extraction sont dans :

```text
tools/
```

Scripts disponibles :

```bash
npm run extract:assets
npm run extract:fonts
npm run extract:hud
npm run extract:levels
npm run extract:startup
npm run extract:title
```

Scripts de vérification disponibles :

```bash
npm run test:assets
npm run test:fonts
npm run test:hud
npm run test:levels
npm run test:startup
npm run test:title
npm run test:asset-policy
npm run test:provenance
```

Les fichiers TypeScript dans `src/assets/generated/` sont générés. Ils ne doivent pas être modifiés à la main.

## Documentation utile

- `ASSET_EXTRACTION_PLAN.md` : historique du travail d'extraction.
- `ARCHITECTURE_AUDIT_PLAN.md` : audit d'architecture initial.
- `MODERN_ARCHITECTURE_PERFECTION_PLAN.md` : plan pragmatique de finition architecture.
- `CODE_DOCUMENTATION_CONVENTION.md` : convention de documentation du code.
- `CODE_DOCUMENTATION_ROLLOUT_PLAN.md` : suivi de l'application des commentaires.
- `docs/plans/` : plans de gameplay et de migration modernes.

## Cible de fidélité

Quand un comportement est incertain, la priorité est :

1. vérifier le code original ASM/BASIC;
2. comparer avec les assets ou metadata extraits;
3. reproduire le comportement dans l'architecture moderne;
4. documenter les hypothèses restantes dans les plans ou TODO.

Le rendu cherche le pixel-perfect quand l'information source est disponible.

## Statut

Le projet est jouable partiellement, mais le gameplay complet n'est pas terminé.

Les principaux chantiers restants concernent notamment :

- collisions avancées;
- poussée et chute complète des rochers/diamants;
- morts du joueur et des monstres;
- explosions;
- progression complète des niveaux;
- validation plus fine de certains comportements via l'ASM.

## Licence et origine

Ce dépôt est un travail technique de portage, d'analyse et de préservation autour d'un jeu TO8 existant.

Les droits du jeu original, de ses graphismes, de son code et de ses marques restent à leurs ayants droit respectifs.
