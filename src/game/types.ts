export type TileCollision = "empty" | "solid" | "hazard" | "exit";

export type EntityKind =
  | "player"
  | "diamond"
  | "rock"
  | "monster";

export interface TileDefinition {
  readonly id: number;
  readonly name: string;
  readonly collision: TileCollision;
  readonly collectible?: {
    readonly score: number;
    readonly counter: "diamonds";
  };
  readonly tileFrameId: string;
}

export interface EntityState {
  readonly id: string;
  readonly kind: EntityKind;
  gridX: number;
  gridY: number;
  x: number;
  y: number;
  readonly width: number;
  readonly height: number;
  readonly spriteFrameId: string;
  active: boolean;
}

export interface MonsterRuntimeState {
  readonly id: string;
  readonly entityId: string;
  runtimePointer: number;
  direction: 1 | 2 | 3 | 4;
  gridX: number;
  gridY: number;
  readonly animationKey: "monsterBlink";
  movement: null | {
    readonly fromX: number;
    readonly fromY: number;
    readonly toX: number;
    readonly toY: number;
    elapsed: number;
    readonly duration: number;
  };
}

export interface FallingObjectRuntimeState {
  readonly id: string;
  readonly kind: "rock" | "diamond";
  readonly tileId: number;
  readonly movingTileId: number;
  readonly entityId?: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  elapsed: number;
  readonly duration: number;
}

export interface HudState {
  score: number;
  time: number;
  record: number;
  gallery: number;
  diamonds: number;
}

export type RuntimeEvent =
  | {
      readonly type: "tileCleared";
      readonly gridX: number;
      readonly gridY: number;
    }
  | {
      readonly type: "diamondCollected";
      readonly gridX: number;
      readonly gridY: number;
      readonly score: number;
    }
  | {
      readonly type: "exitOpened";
      readonly gridX: number;
      readonly gridY: number;
    }
  | {
      readonly type: "levelCompleted";
      readonly levelNumber: number;
      readonly nextLevelId?: string;
    };

export interface LevelDefinition {
  readonly id: string;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly tileSize: number;
  readonly tiles: readonly number[];
  readonly tileDefinitions: Readonly<Record<number, TileDefinition>>;
  readonly initialEntities: readonly EntityState[];
  readonly playerStart: {
    readonly x: number;
    readonly y: number;
  };
  readonly exit: {
    readonly x: number;
    readonly y: number;
  };
  readonly meta: {
    readonly timeLimit: number;
    readonly gallery: number;
    readonly requiredDiamonds: number;
    readonly scoreStep: number;
    readonly nextLevelId?: string;
  };
}

export interface GameState {
  sceneId: string;
  level: LevelDefinition;
  entities: EntityState[];
  monsters: MonsterRuntimeState[];
  fallingObjects: FallingObjectRuntimeState[];
  runtimeEvents: RuntimeEvent[];
  player: EntityState;
  hud: HudState;
  lives: number;
  exitOpen: boolean;
  levelComplete: boolean;
  gameOver: boolean;
}
