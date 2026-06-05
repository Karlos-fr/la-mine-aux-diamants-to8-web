/**
 * Role: Definit les structures runtime partagees par le portage moderne.
 * Scope: Decrit l'etat logique du jeu, des entites, du HUD et des evenements sans dependance canvas.
 * ISO: Les champs de grille restent exprimes en cellules logiques 16x16 pour coller au runtime TO8.
 * Notes: Les types restent volontairement simples afin que les systems puissent muter l'etat discret.
 */

/** Nature de collision logique associee a une tuile runtime. */
export type TileCollision = "empty" | "solid" | "hazard" | "exit";

/** Familles d'entites actuellement portees par le runtime moderne. */
export type EntityKind =
  | "player"
  | "diamond"
  | "rock"
  | "monster";

/** Definition descriptive d'une tuile presente dans un niveau charge. */
export interface TileDefinition {
  /** Identifiant runtime de tuile, generalement un tile id TO8 prouve. */
  readonly id: number;
  /** Nom humain stable utilise pour le debug et la lecture du niveau. */
  readonly name: string;
  /** Collision logique appliquee au joueur et aux systems. */
  readonly collision: TileCollision;
  /** Information de collecte quand la tuile rapporte score/compteur. */
  readonly collectible?: {
    /** Score ajoute quand la collecte est consommee. */
    readonly score: number;
    /** Compteur HUD concerne par la collecte. */
    readonly counter: "diamonds";
  };
  /** Identifiant de frame rendu associe a la tuile. */
  readonly tileFrameId: string;
}

/** Etat mutable d'une entite runtime visible ou logique. */
export interface EntityState {
  /** Identifiant stable dans le niveau courant. */
  readonly id: string;
  /** Famille logique de l'entite. */
  readonly kind: EntityKind;
  /** Position grille courante; peut etre interpolee pendant un mouvement visuel. */
  gridX: number;
  /** Position grille courante; peut etre interpolee pendant un mouvement visuel. */
  gridY: number;
  /** Position pixel derivee de la grille pour compatibilite renderer. */
  x: number;
  /** Position pixel derivee de la grille pour compatibilite renderer. */
  y: number;
  /** Largeur de sprite en pixels. */
  readonly width: number;
  /** Hauteur de sprite en pixels. */
  readonly height: number;
  /** Identifiant de frame de sprite historique ou moderne. */
  readonly spriteFrameId: string;
  /** Indique si l'entite participe encore au rendu/logique. */
  active: boolean;
}

/** Etat runtime propre aux monstres, incluant pointeur grille compatible TO8. */
export interface MonsterRuntimeState {
  /** Identifiant runtime du monstre. */
  readonly id: string;
  /** Identifiant de l'entite visuelle associee. */
  readonly entityId: string;
  /** Adresse logique dans la grille TO8 reconstituee. */
  runtimePointer: number;
  /** Direction historique codee sur 1..4. */
  direction: 1 | 2 | 3 | 4;
  /** Position grille discrete du monstre. */
  gridX: number;
  /** Position grille discrete du monstre. */
  gridY: number;
  /** Cle d'animation utilisee par le rendu. */
  readonly animationKey: "monsterBlink";
  /** Mouvement interpole en cours, ou aucun mouvement. */
  movement: null | {
    /** Case de depart du mouvement. */
    readonly fromX: number;
    /** Case de depart du mouvement. */
    readonly fromY: number;
    /** Case d'arrivee du mouvement. */
    readonly toX: number;
    /** Case d'arrivee du mouvement. */
    readonly toY: number;
    /** Temps deja ecoule dans l'interpolation. */
    elapsed: number;
    /** Duree totale de l'interpolation visuelle. */
    readonly duration: number;
  };
}

/** Etat runtime d'un rocher ou diamant en mouvement physique. */
export interface FallingObjectRuntimeState {
  /** Identifiant unique de l'objet physique actif. */
  readonly id: string;
  /** Famille physique partageant la logique chute/glissement. */
  readonly kind: "rock" | "diamond";
  /** Tile id statique final a restaurer en fin de mouvement. */
  readonly tileId: number;
  /** Tile id temporaire pose pendant le mouvement. */
  readonly movingTileId: number;
  /** Entite visuelle associee, seulement pour les diamants actuellement. */
  readonly entityId?: string;
  /** Case de depart du mouvement. */
  fromX: number;
  /** Case de depart du mouvement. */
  fromY: number;
  /** Case cible du mouvement. */
  toX: number;
  /** Case cible du mouvement. */
  toY: number;
  /** Temps deja ecoule dans l'interpolation. */
  elapsed: number;
  /** Duree totale de l'interpolation visuelle. */
  readonly duration: number;
}

/** Etat des compteurs HUD gameplay. */
export interface HudState {
  /** Score courant encode comme compteur decimal moderne. */
  score: number;
  /** Temps restant affiche par le HUD. */
  time: number;
  /** Meilleur score courant. */
  record: number;
  /** Numero de galerie/niveau affiche. */
  gallery: number;
  /** Diamants restant a collecter. */
  diamonds: number;
}

/** Journal minimal d'evenements derives des mutations runtime. */
export type RuntimeEvent =
  /** Signale qu'une cellule est devenue vide. */
  | {
      readonly type: "tileCleared";
      readonly gridX: number;
      readonly gridY: number;
    }
  /** Signale qu'un diamant a ete collecte et doit impacter HUD/score. */
  | {
      readonly type: "diamondCollected";
      readonly gridX: number;
      readonly gridY: number;
      readonly score: number;
    }
  /** Signale que la sortie logique est ouverte. */
  | {
      readonly type: "exitOpened";
      readonly gridX: number;
      readonly gridY: number;
    }
  /** Signale que le niveau courant est termine. */
  | {
      readonly type: "levelCompleted";
      readonly levelNumber: number;
      readonly nextLevelId?: string;
    };

/** Definition runtime complete d'un niveau moderne pret a jouer. */
export interface LevelDefinition {
  /** Identifiant stable du niveau moderne. */
  readonly id: string;
  /** Libelle humain du niveau. */
  readonly name: string;
  /** Largeur utile de la grille en cellules. */
  readonly width: number;
  /** Hauteur utile de la grille en cellules. */
  readonly height: number;
  /** Taille d'une cellule en pixels. */
  readonly tileSize: number;
  /** Grille runtime aplatie en tile ids. */
  readonly tiles: readonly number[];
  /** Definitions des tile ids presents dans ce niveau. */
  readonly tileDefinitions: Readonly<Record<number, TileDefinition>>;
  /** Entites creees au chargement du niveau. */
  readonly initialEntities: readonly EntityState[];
  /** Position initiale joueur en coordonnees de grille. */
  readonly playerStart: {
    readonly x: number;
    readonly y: number;
  };
  /** Position logique de sortie en coordonnees de grille. */
  readonly exit: {
    readonly x: number;
    readonly y: number;
  };
  /** Metadonnees gameplay du niveau. */
  readonly meta: {
    /** Temps initial du niveau. */
    readonly timeLimit: number;
    /** Numero de galerie affiche. */
    readonly gallery: number;
    /** Nombre de diamants requis avant ouverture sortie. */
    readonly requiredDiamonds: number;
    /** Incrementation de score par diamant. */
    readonly scoreStep: number;
    /** Identifiant du niveau suivant, s'il existe. */
    readonly nextLevelId?: string;
  };
}

/** Etat complet mutable de la scene gameplay courante. */
export interface GameState {
  /** Identifiant de scene pour debug/orchestration. */
  sceneId: string;
  /** Definition immuable du niveau courant. */
  level: LevelDefinition;
  /** Entites runtime visibles/logiques. */
  entities: EntityState[];
  /** Etats specialises des monstres. */
  monsters: MonsterRuntimeState[];
  /** Objets physiques actuellement interpoles. */
  fallingObjects: FallingObjectRuntimeState[];
  /** Evenements runtime emis pendant le tick. */
  runtimeEvents: RuntimeEvent[];
  /** Reference directe vers l'entite joueur. */
  player: EntityState;
  /** Etat courant du HUD. */
  hud: HudState;
  /** Nombre de vies reserve pour la suite du portage. */
  lives: number;
  /** Indique si la sortie peut etre empruntee. */
  exitOpen: boolean;
  /** Indique si le niveau courant est termine. */
  levelComplete: boolean;
  /** Indique si la partie est terminee. */
  gameOver: boolean;
}
