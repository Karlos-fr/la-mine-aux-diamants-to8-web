/**
 * Role: Orchestre la scene gameplay principale du portage moderne.
 * Scope: Coordonne input, systems runtime, camera, rendu, HUD, chargement assets et navigation de niveau.
 * ISO: La logique discrete reste en cellules de grille TO8 et s'appuie sur les tile ids runtime prouves.
 * Notes: Cette scene reste volontairement orchestratrice; les systems/renderers portent les details specialises.
 */

import type { InputState } from "../engine/input";
import type { Renderer } from "../engine/renderer";
import type { EntityState, FallingObjectRuntimeState, GameState, RuntimeExplosionState } from "../game/types";
import type { Scene, SceneContext } from "../engine/scene";
import { gameAudio } from "../audio/audio-engine";
import { debugOptions } from "../debug-options";
import { createGameLevelState, createGameStateFromLevelDefinition } from "../game/game-state-factory";
import { buildLevelDefinition, type ModernLevelJson } from "../game/level-loader";
import { LevelRuntimeGrid } from "../game/runtime-grid";
import { GameplayRuntime, type GameplayRuntimeMonsterKind } from "../game/gameplay-runtime";
import { RuntimeMutations } from "../game/runtime-mutations";
import { drainRuntimeEvents, emitRuntimeEvent } from "../game/runtime-events";
import { secondsFromTo8Ticks, TO8_RUNTIME_TIMING } from "../game/runtime-timing";
import {
  getCameraMoveDuration,
  getFallingObjectMoveDuration,
  getMonsterMoveDuration,
  getPlayerMoveDuration,
  getPushedRockMoveDuration
} from "../game/movement-timing";
import { getMovementRenderProgress } from "../game/movement-visuals";
import {
  AttractScriptInputSource,
  KeyboardPlayerInputSource,
  type PlayerInputSource
} from "../game/player-input-source";
import {
  RUNTIME_GRID_BASE_ADDRESS,
  RUNTIME_GRID_FILL_TILE_ID,
  RUNTIME_GRID_STRIDE,
  RUNTIME_TILE
} from "../game/runtime-tiles";
import {
  advanceCameraAfterPlayerStep as advanceCameraAfterPlayerStepSystem,
  advanceCameraMove as advanceCameraMoveSystem,
  getRenderViewportX as getRenderViewportXSystem,
  getRenderViewportY as getRenderViewportYSystem
} from "../game/systems/camera-system";
import { isOpenExitCell as isOpenExitCellSystem } from "../game/systems/exit-system";
import { resolveFallingObjectTarget as resolveFallingObjectTargetSystem } from "../game/systems/falling-object-system";
import { advanceSingleMonsterRuntime as advanceSingleMonsterRuntimeSystem } from "../game/systems/monster-system";
import {
  hasPhysicalObjectAtGrid as hasPhysicalObjectAtGridSystem,
  resolvePhysicalObjectImpact
} from "../game/systems/physical-object-system";
import { resolveRockPushTarget as resolveRockPushTargetSystem } from "../game/systems/rock-push-system";
import {
  canPlayerEnterTile as canPlayerEnterTileSystem,
  getPlayerArrivalEffect as getPlayerArrivalEffectSystem,
  type PlayerMoveResolution,
  type RuntimeTileArrivalEffect
} from "../game/systems/player-system";
import {
  getPlayerSpawnBlinkTileId as getPlayerSpawnBlinkTileIdSystem,
  isPlayerSpawning as isPlayerSpawningSystem
} from "../game/systems/spawn-system";
import type { Size2D, TileFrame } from "../engine/render-types";
import { mineSpriteMetadata } from "../assets/generated/mine-sprites";
import { RuntimeAssets } from "../assets/runtime-asset-loader";
import { getGameplayRenderSize } from "../display-options";
import { updateOptionsPopinInput } from "../options-popin-controller";
import { GameplayRenderer } from "../rendering/gameplay-renderer";
import { renderOptionsPopin } from "../rendering/options-popin-renderer";
import { TileFrameCache } from "../rendering/tile-frame-cache";

/** Horloge generique pour les animations cycliques de rendu. */
interface AnimationClock {
  /** Index de frame courant dans la sequence. */
  frameIndex: number;
  /** Temps accumule depuis le dernier changement de frame. */
  accumulator: number;
}

/** Viewport logique visible du niveau, en coordonnees de grille. */
interface ViewportState {
  /** Colonne de depart du viewport. */
  x: number;
  /** Ligne de depart du viewport. */
  y: number;
  /** Nombre de colonnes visibles. */
  columns: number;
  /** Nombre de lignes visibles. */
  rows: number;
}

/** Mouvement case par case entre deux cellules de grille. */
interface GridMoveState {
  /** Colonne de depart. */
  readonly fromX: number;
  /** Ligne de depart. */
  readonly fromY: number;
  /** Colonne cible. */
  readonly toX: number;
  /** Ligne cible. */
  readonly toY: number;
  /** Effet logique a appliquer a l'arrivee complete. */
  readonly arrivalEffect?: RuntimeTileArrivalEffect;
  /** Temps ecoule dans le pas. */
  elapsed: number;
  /** Duree totale du pas; le rendu peut interpoler ou rester discret. */
  readonly duration: number;
}

/** Alias semantique pour les mouvements de camera. */
type CameraMoveState = GridMoveState;
/** Taille de rendu d'une tuile TO8. */
const RENDER_TILE_SIZE = 16;
/** Nombre de colonnes visibles dans la fenetre niveau. */
const VIEWPORT_COLUMNS = 20;
/** Nombre de lignes visibles dans la fenetre niveau. */
const VIEWPORT_ROWS = 10;
/** Hauteur logique du HUD en bas de l'ecran gameplay. */
const GAMEPLAY_HUD_HEIGHT = 40;
/** Position initiale horizontale du viewport. */
const INITIAL_VIEWPORT_X = 0;
/** Position initiale verticale du viewport. */
const INITIAL_VIEWPORT_Y = 0;
/** Marge camera gauche issue du comportement runtime original. */
const CAMERA_LEFT_MARGIN = 0x04;
/** Marge camera droite issue du comportement runtime original. */
const CAMERA_RIGHT_MARGIN = 0x0f;
/** Marge camera haute issue du comportement runtime original. */
const CAMERA_TOP_MARGIN = 0x02;
/** Marge camera basse issue du comportement runtime original. */
const CAMERA_BOTTOM_MARGIN = 0x07;
/** Borne minimale horizontale camera. */
const CAMERA_MIN_X = INITIAL_VIEWPORT_X;
/** Borne minimale verticale camera. */
const CAMERA_MIN_Y = INITIAL_VIEWPORT_Y;
/** Nombre de cycles `0x04`/noir prouves par le compteur `6` de `KIT.BIN:$BE68`. */
const PLAYER_SPAWN_BLINK_REPETITIONS = 3;
/** Duree d'un demi-pas de blink spawn, derivee des ticks TO8. */
const PLAYER_SPAWN_BLINK_STEP_DURATION = secondsFromTo8Ticks(TO8_RUNTIME_TIMING.playerSpawnBlinkStepTicks);
/** Cadence de conversion du temps restant en score apres entree dans la sortie. */
const LEVEL_COMPLETION_BONUS_STEP_DURATION = secondsFromTo8Ticks(
  TO8_RUNTIME_TIMING.levelCompletionBonusStepTicks
);
/** Delai de transition apres epuisement du bonus de temps. */
const LEVEL_COMPLETION_TRANSITION_DELAY = secondsFromTo8Ticks(
  TO8_RUNTIME_TIMING.levelCompletionTransitionDelayTicks
);
/** Delai moderne avant de relancer le cycle idle confirme par `KIT.BIN:$CED9`. */
const PLAYER_IDLE_DELAY = secondsFromTo8Ticks(TO8_RUNTIME_TIMING.playerIdleDelayTicks);
/** Duree d'une frame de marche pendant un pas joueur. */
const PLAYER_WALK_FRAME_DURATION = getPlayerMoveDuration() / 3;
/** Maintien court de la derniere frame de marche apres l'arrivee. */
const PLAYER_WALK_FINAL_FRAME_HOLD_DURATION = PLAYER_WALK_FRAME_DURATION;
/** Intervalle de decision des monstres, derive des ticks TO8. */
const MONSTER_MOVE_INTERVAL = secondsFromTo8Ticks(TO8_RUNTIME_TIMING.monsterMoveIntervalTicks);
/** Intervalle de scan des rochers/diamants prets a tomber, derive des ticks TO8. */
const FALLING_OBJECT_SCAN_INTERVAL = secondsFromTo8Ticks(TO8_RUNTIME_TIMING.fallingObjectScanTicks);
/** Tile runtime temporaire du monstre actif. */
const MONSTER_RUNTIME_ACTIVE_TILE_ID = RUNTIME_TILE.monsterActive;
/** Trace runtime temporaire de monstre, nettoyee a la fin du pas. */
const MONSTER_RUNTIME_TRAIL_TILE_ID = RUNTIME_TILE.monsterTrail;
/** Tuile creusable par le joueur. */
const PLAYER_DIGGABLE_TILE_ID = RUNTIME_TILE.earth;
/** Tile id rocher statique. */
const ROCK_TILE_ID = RUNTIME_TILE.rock;
/** Tile id diamant statique. */
const DIAMOND_TILE_ID = RUNTIME_TILE.diamond;
/** Tile id monstre initial. */
const MONSTER_TILE_ID = RUNTIME_TILE.monster;
/** Tile id temporaire de rocher en chute. */
const FALLING_ROCK_TILE_ID = RUNTIME_TILE.fallingRock;
/** Tile id temporaire de diamant en chute. */
const FALLING_DIAMOND_TILE_ID = RUNTIME_TILE.fallingDiamond;
/** Frames runtime de l'explosion 3x3 prouvee par `KIT.BIN:$CCC6/$CCFE`. */
const EXPLOSION_TILE_SEQUENCE = [
  RUNTIME_TILE.explosion1,
  RUNTIME_TILE.explosion2,
  RUNTIME_TILE.explosion3,
  RUNTIME_TILE.empty
] as const;
/** Duree moderne d'une frame d'explosion, derivee des ticks TO8. */
const EXPLOSION_FRAME_DURATION = secondsFromTo8Ticks(TO8_RUNTIME_TIMING.explosionFrameTicks);
/** Tile id vide. */
const RUNTIME_EMPTY_TILE_ID = RUNTIME_TILE.empty;
/** Tile id plateforme solide. */
const PLATFORM_TILE_ID = RUNTIME_TILE.platform;
/** Duree en secondes d'un tick compteur temps HUD. */
const HUD_TIMER_TICK_SECONDS = secondsFromTo8Ticks(TO8_RUNTIME_TIMING.hudTimerTicks);
/** Duree d'une phase de flash quand l'objectif diamant ouvre la sortie. */
const OBJECTIVE_REACHED_FLASH_PHASE_DURATION = secondsFromTo8Ticks(
  TO8_RUNTIME_TIMING.objectiveReachedFlashPhaseTicks
);
/** Nombre de phases alternees du flash objectif, derive des six inversions de `$BD87`. */
const OBJECTIVE_REACHED_FLASH_PHASE_COUNT = TO8_RUNTIME_TIMING.objectiveReachedFlashPhaseCount;
/** Frames couleur du diamant HUD, animees par decalage de lignes. */
const HUD_GALLERY_DIAMOND_ANIMATION_FRAMES = Array.from({ length: 16 }, (_, index) => index);
/** Dernier niveau actuellement disponible. */
const LAST_LEVEL_NUMBER = 16;
/** Niveau moderne dedie a l'entree cachee `$B7C4` du mode attract. */
const ATTRACT_MODE_LEVEL_NUMBER = 18;

/** Mode de pilotage de la scene gameplay. */
export type GameplaySceneMode = "normal" | "attract";

/** Options de creation de la scene gameplay moderne. */
export interface GameplaySceneOptions {
  /** Mode runtime a utiliser pour la source d'input et les sorties. */
  readonly mode?: GameplaySceneMode;
  /** Factory de retour au titre utilisee uniquement par le mode attract. */
  readonly createTitleScene?: () => Scene;
  /** Niveau JSON temporaire, utilise par l'editeur sans modifier les assets officiels. */
  readonly temporaryLevel?: ModernLevelJson;
  /** Factory de retour a l'editeur pour les tests temporaires. */
  readonly createEditorScene?: () => Scene;
}

/** Cree le viewport initial depuis le header ASM, ou depuis un fallback moderne. */
function createInitialViewport(
  initialViewport: ViewportState | undefined,
  playerStartX: number,
  playerStartY: number,
  levelWidth: number,
  levelHeight: number
): ViewportState {
  const maxX = Math.max(CAMERA_MIN_X, levelWidth - VIEWPORT_COLUMNS);
  const maxY = Math.max(CAMERA_MIN_Y, levelHeight - VIEWPORT_ROWS);
  const originX = clamp(INITIAL_VIEWPORT_X, CAMERA_MIN_X, maxX);
  const originY = clamp(INITIAL_VIEWPORT_Y, CAMERA_MIN_Y, maxY);

  if (initialViewport) {
    return {
      x: clamp(initialViewport.x, CAMERA_MIN_X, maxX),
      y: clamp(initialViewport.y, CAMERA_MIN_Y, maxY),
      columns: VIEWPORT_COLUMNS,
      rows: VIEWPORT_ROWS
    };
  }

  const isSpawnVisibleFromOrigin =
    playerStartX >= originX &&
    playerStartX < originX + VIEWPORT_COLUMNS &&
    playerStartY >= originY &&
    playerStartY < originY + VIEWPORT_ROWS;

  if (isSpawnVisibleFromOrigin) {
    return {
      x: originX,
      y: originY,
      columns: VIEWPORT_COLUMNS,
      rows: VIEWPORT_ROWS
    };
  }

  return {
    x: clamp(playerStartX - CAMERA_LEFT_MARGIN, CAMERA_MIN_X, maxX),
    y: clamp(playerStartY - CAMERA_TOP_MARGIN, CAMERA_MIN_Y, maxY),
    columns: VIEWPORT_COLUMNS,
    rows: VIEWPORT_ROWS
  };
}

export class GameplayScene implements Scene {
  /** Contexte de navigation fourni par le routeur de scenes. */
  private context: SceneContext | undefined;
  /** Etat gameplay mutable du niveau courant. */
  private readonly state: GameState;
  /** Numero de niveau courant, utilise pour HUD et transition. */
  private readonly levelNumber: number;
  /** Mode runtime courant, normal ou demonstration automatique. */
  private readonly gameplayMode: GameplaySceneMode;
  /** Grille runtime mutable qui fait autorite pour la logique discrete. */
  private readonly runtimeGrid: LevelRuntimeGrid;
  /** API centralisee pour les mutations de grille runtime. */
  private readonly runtimeMutations: RuntimeMutations;
  /** Runtime charge d'orchestrer l'ordre d'update gameplay. */
  private readonly runtime: GameplayRuntime;
  /** Source d'intention joueur active pour le niveau courant. */
  private readonly playerInputSource: PlayerInputSource;
  /** Source scriptable conservee separement pour detecter la fin `$DD`. */
  private readonly attractInputSource: AttractScriptInputSource | null = null;
  /** Factory de retour au titre pour les sorties du mode attract. */
  private readonly createTitleScene: (() => Scene) | undefined;
  /** Factory de retour editeur pour les tests temporaires. */
  private readonly createEditorScene: (() => Scene) | undefined;
  /** Renderer dedie a l'ordre de rendu gameplay ISO. */
  private readonly gameplayRenderer = new GameplayRenderer();
  /** Factory injectee pour creer la scene du niveau suivant sans cycle d'import. */
  private readonly createNextLevelScene: (currentLevelNumber: number) => Scene;
  /** Factory injectee pour recreer le niveau courant apres mort prouvee. */
  private readonly recreateLevelScene: (levelNumber: number) => Scene;
  /** Cache de frames issues des atlas gameplay. */
  private readonly tileFrameCache = new TileFrameCache({
    sourceSize: RENDER_TILE_SIZE,
    renderSize: RENDER_TILE_SIZE
  });
  /** Taille de rendu d'une tuile a l'ecran. */
  private readonly tileSize = RENDER_TILE_SIZE;
  /** Viewport logique courant sur le niveau global. */
  private readonly viewport: ViewportState;
  /** Largeur totale du niveau courant en cellules. */
  private readonly levelWidth: number;
  /** Hauteur totale du niveau courant en cellules. */
  private readonly levelHeight: number;
  /** Frames d'idle joueur issues des metadata; fallback conserve si l'extraction est incomplete. */
  private readonly playerAnimationFrames = extractFrameIdsFromMetadata("player", "idleCycle", [8, 8, 7, 8, 9]);
  /** Frames de marche vers la droite; fallback conserve si l'extraction est incomplete. */
  private readonly playerMoveRightFrames = extractFrameIdsFromMetadata("player", "moveRight", [0x0c, 0x0d, 0x0e]);
  /** Frames de marche vers la gauche; fallback conserve si l'extraction est incomplete. */
  private readonly playerMoveLeftFrames = extractFrameIdsFromMetadata("player", "moveLeft", [0x0f, 0x10, 0x11]);
  /** Frames du cycle couleur diamant; fallback conserve si l'extraction est incomplete. */
  private readonly diamondAnimationFrames = extractFrameIdsFromMetadata("diamond", "colorCycle", [3, 3, 3, 3, 3, 3, 3, 3]);
  /** Frames de clignotement monstre; fallback conserve si l'extraction est incomplete. */
  private readonly monsterAnimationFrames = extractFrameIdsFromMetadata("monster", "blinkToggle", [2, 2]);
  /** Durees de frames par animation. */
  private readonly animationDurations = {
    player: secondsFromTo8Ticks(TO8_RUNTIME_TIMING.playerAnimationFrameTicks),
    diamond: secondsFromTo8Ticks(TO8_RUNTIME_TIMING.diamondAnimationFrameTicks),
    monster: secondsFromTo8Ticks(TO8_RUNTIME_TIMING.monsterAnimationFrameTicks),
    hudDiamond: secondsFromTo8Ticks(TO8_RUNTIME_TIMING.hudDiamondAnimationFrameTicks),
    exit: secondsFromTo8Ticks(TO8_RUNTIME_TIMING.exitBlinkFrameTicks)
  };
  /** Horloges d'animation indexees par cle. */
  private readonly animationState = new Map<string, AnimationClock>();
  /** Temps ecoule depuis le debut du spawn joueur. */
  private spawnElapsed = 0;
  /** Indique si la tuile temporaire de spawn a ete nettoyee. */
  private spawnTileCleared = false;
  /** Accumulateur du pas runtime des monstres standards `0x02`. */
  private standardMonsterMoveElapsed = 0;
  /** Accumulateur du pas runtime des creatures speciales `0x17`. */
  private specialCreatureMoveElapsed = 0;
  /** Accumulateur de scan des objets physiques. */
  private fallingObjectScanElapsed = 0;
  /** Accumulateur du decrement de temps HUD. */
  private hudTimeAccumulator = 0;
  /** Indique si la conversion temps restant vers score est en cours. */
  private levelCompletionBonusActive = false;
  /** Accumulateur de cadence pour la conversion de fin de niveau. */
  private levelCompletionBonusAccumulator = 0;
  /** Delai ecoule apres la fin du bonus avant transition effective. */
  private levelCompletionTransitionElapsed = 0;
  /** Temps ecoule depuis le declenchement du flash objectif atteint. */
  private objectiveReachedFlashElapsed = 0;
  /** Indique si le flash objectif atteint est en cours de rendu. */
  private objectiveReachedFlashActive = false;
  /** Mouvement joueur actuellement interpole. */
  private playerMove: GridMoveState | null = null;
  /** Frame de marche maintenue apres arrivee. */
  private playerHeldMoveFrameId: number | null = null;
  /** Temps de maintien de la frame de marche finale. */
  private playerHeldMoveFrameElapsed = 0;
  /** Temps ecoule sans mouvement joueur avant le cycle idle. */
  private playerIdleElapsed = 0;
  /** Mouvement camera actuellement interpole. */
  private cameraMove: CameraMoveState | null = null;
  /** Direction visuelle courante du joueur. */
  private playerFacing: "idle" | "left" | "right" = "idle";
  /** Derniere direction horizontale, reutilisee pour haut/bas. */
  private lastHorizontalFacing: "left" | "right" = "right";
  /** Assets runtime charges pour le rendu gameplay. */
  private readonly runtimeAssets = new RuntimeAssets();
  /** Garde-fou pour ne demander la transition de niveau qu'une fois. */
  private levelTransitionQueued = false;
  /** Garde-fou pour ne demander le reset de niveau qu'une fois apres mort. */
  private deathResetQueued = false;
  /** Indique si la pop-in d'options est ouverte et met le gameplay en pause. */
  private optionsOpen = false;
  /** Categorie d'options selectionnee. */
  private selectedOptionsCategoryIndex = 0;
  /** Initialise l'etat runtime, la grille et les horloges d'animation du niveau. */
  constructor(
    levelNumber: number,
    createNextLevelScene: (currentLevelNumber: number) => Scene,
    recreateLevelScene: (levelNumber: number) => Scene,
    options: GameplaySceneOptions = {}
  ) {
    this.gameplayMode = options.mode ?? "normal";
    this.levelNumber = this.gameplayMode === "attract" ? ATTRACT_MODE_LEVEL_NUMBER : levelNumber;
    if (this.gameplayMode === "attract") {
      this.attractInputSource = new AttractScriptInputSource();
      this.playerInputSource = this.attractInputSource;
    } else {
      this.playerInputSource = new KeyboardPlayerInputSource();
    }
    this.createTitleScene = options.createTitleScene;
    this.createEditorScene = options.createEditorScene;
    this.createNextLevelScene = createNextLevelScene;
    this.recreateLevelScene = recreateLevelScene;
    this.state = options.temporaryLevel
      ? createGameStateFromLevelDefinition(buildLevelDefinition(options.temporaryLevel, this.levelNumber), this.levelNumber)
      : createGameLevelState(this.levelNumber);
    this.viewport = createInitialViewport(
      this.state.level.initialViewport
        ? {
            x: this.state.level.initialViewport.x,
            y: this.state.level.initialViewport.y,
            columns: VIEWPORT_COLUMNS,
            rows: VIEWPORT_ROWS
          }
        : undefined,
      this.state.level.playerStart.x,
      this.state.level.playerStart.y,
      this.state.level.width,
      this.state.level.height
    );
    this.runtimeGrid = new LevelRuntimeGrid(
      this.state.level.tiles,
      this.state.level.width,
      this.state.level.height,
      RUNTIME_GRID_STRIDE,
      RUNTIME_GRID_FILL_TILE_ID
    );
    this.runtimeMutations = new RuntimeMutations({
      state: this.state,
      runtimeGrid: this.runtimeGrid,
      emptyTileId: RUNTIME_EMPTY_TILE_ID
    });
    this.levelWidth = this.state.level.width;
    this.levelHeight = this.state.level.height;
    this.runtime = new GameplayRuntime({
      resetRuntimeTick: () => this.resetRuntimeTick(),
      isPlayerSpawning: () => this.isPlayerSpawning(),
      advanceSpawnTimer: (dt) => this.advanceSpawnTimer(dt),
      clearSpawnBlinkTileAfterSpawn: () => this.clearSpawnBlinkTileAfterSpawn(),
      advanceHudCounters: (dt, playerSpawning) => this.advanceHudCounters(dt, playerSpawning),
      advancePlayerRuntime: (dt, input, playerSpawning) => this.advancePlayerRuntime(dt, input, playerSpawning),
      advanceCameraMove: (dt) => this.advanceCameraMove(dt),
      syncPlayerPixelPosition: () => this.syncPlayerPixelPosition(),
      advanceFallingObjects: (dt) => this.advanceFallingObjects(dt),
      advanceMonsterRuntime: (dt, kind) => this.advanceMonsterRuntime(dt, kind),
      advanceMonsterMoves: (dt, kind) => this.advanceMonsterMoves(dt, kind),
      syncMonsterEntitiesFromRuntimeState: () => this.syncMonsterEntitiesFromRuntimeState(),
      consumeRuntimeEvents: () => this.consumeRuntimeEvents(),
      advanceRenderAnimations: (dt) => this.advanceRenderAnimations(dt)
    }, this.gameplayMode);
    this.animationState.set("player", { frameIndex: 0, accumulator: 0 });
    this.animationState.set("diamond", { frameIndex: 0, accumulator: 0 });
    this.animationState.set("monster", { frameIndex: 0, accumulator: 0 });
    this.animationState.set("hudDiamond", { frameIndex: 0, accumulator: 0 });
    this.animationState.set("exit", { frameIndex: 0, accumulator: 0 });
    void this.runtimeAssets.load();
  }

  /** Recupere le contexte de navigation de scene. */
  enter(context: SceneContext): void {
    this.context = context;
  }

  /** Orchestre un tick gameplay complet sans effectuer de rendu. */
  update(dt: number, input: InputState): void {
    this.updateViewportSize();

    if (this.updateOptionsPopin(input)) {
      return;
    }

    if (this.gameplayMode === "attract" && (input.justPressed.confirm || input.justPressed.action)) {
      this.queueAttractReturnToTitle();
      return;
    }

    if (this.createEditorScene && input.justPressed.cancel) {
      this.context?.setScene(this.createEditorScene());
      return;
    }

    this.runtime.update(dt, input);
  }

  /** Gere l'ouverture et la navigation de la pop-in d'options. */
  private updateOptionsPopin(input: InputState): boolean {
    if (this.gameplayMode !== "normal") {
      return false;
    }

    const result = updateOptionsPopinInput(input, {
      isOpen: this.optionsOpen,
      selectedCategoryIndex: this.selectedOptionsCategoryIndex
    });
    this.optionsOpen = result.isOpen;
    this.selectedOptionsCategoryIndex = result.selectedCategoryIndex;
    if (result.displayOptionsChanged) {
      this.updateViewportSize();
    }

    return result.consumed;
  }

  /** Nettoie les marqueurs temporaires du tick courant. */
  private resetRuntimeTick(): void {
    this.runtimeMutations.resetTick();
  }

  /** Avance le timer interne du spawn joueur. */
  private advanceSpawnTimer(dt: number): void {
    this.spawnElapsed += dt;
  }

  /** Traite le mouvement joueur et l'input clavier du tick courant. */
  private advancePlayerRuntime(dt: number, input: InputState, playerSpawning: boolean): void {
    if (this.state.gameOver || this.state.levelComplete || !this.state.player.active) {
      this.playerMove = null;
      this.clearPlayerHeldMoveFrame();
      return;
    }

    if (this.playerMove) {
      this.resetPlayerIdleDelay();
      this.advancePlayerMove(dt);
    } else if (!playerSpawning) {
      if (this.gameplayMode === "attract") {
        this.attractInputSource?.advanceScriptTick(dt);
        if (this.attractInputSource?.isEnded()) {
          this.queueAttractReturnToTitle();
          return;
        }
      }

      this.advancePlayerHeldMoveFrame(dt);
      const { x: moveX, y: moveY } = this.playerInputSource.resolveMove(input);

      if (moveX !== 0 || moveY !== 0) {
        this.resetPlayerIdleDelay();
        const playerCell = this.getPlayerLogicalCell();
        const fromX = playerCell.x;
        const fromY = playerCell.y;
        const toX = fromX + moveX;
        const toY = fromY + moveY;
        const targetRuntimeX = toX;
        const targetRuntimeY = toY;
        let collision = this.resolvePlayerMove(targetRuntimeX, targetRuntimeY);
        const pushedRockTarget =
          !collision.canEnter && collision.tileId === ROCK_TILE_ID && moveY === 0
            ? this.resolvePushedRockTarget(targetRuntimeX, targetRuntimeY, moveX)
            : null;
        if (pushedRockTarget) {
          collision = {
            canEnter: true,
            tileId: RUNTIME_EMPTY_TILE_ID,
            arrivalEffect: "none"
          };
        }

        if (moveX < 0) {
          this.playerFacing = "left";
          this.lastHorizontalFacing = "left";
        } else if (moveX > 0) {
          this.playerFacing = "right";
          this.lastHorizontalFacing = "right";
        } else if (moveY !== 0) {
          this.playerFacing = this.lastHorizontalFacing;
        }

        if (collision.canEnter) {
          this.clearPlayerHeldMoveFrame();
          this.advanceCameraAfterPlayerStep(fromX, fromY, moveX, moveY);
          if (pushedRockTarget) {
            this.startPushedRockMove(targetRuntimeX, targetRuntimeY, pushedRockTarget.x, pushedRockTarget.y);
          }
          this.playerMove = {
            fromX,
            fromY,
            toX,
            toY,
            arrivalEffect: collision.arrivalEffect,
            elapsed: 0,
            duration: getPlayerMoveDuration()
          };
        }
      } else {
        this.advancePlayerIdleDelay(dt);
      }
    }
  }

  /** Synchronise la position pixel du joueur depuis sa position grille. */
  private syncPlayerPixelPosition(): void {
    this.state.player.x = this.state.player.gridX * this.state.level.tileSize;
    this.state.player.y = this.state.player.gridY * this.state.level.tileSize;
  }

  /** Avance toutes les animations cycliques de rendu du gameplay. */
  private advanceRenderAnimations(dt: number): void {
    this.advanceExplosions(dt);
    this.queueDeathResetAfterExplosions();
    this.advanceObjectiveReachedFlash(dt);
    this.advanceAnimation("player", this.playerAnimationFrames, this.animationDurations.player, dt);
    this.advanceAnimation("diamond", this.diamondAnimationFrames, this.animationDurations.diamond, dt);
    this.advanceAnimation("monster", this.monsterAnimationFrames, this.animationDurations.monster, dt);
    this.advanceAnimation("exit", [0, 1], this.animationDurations.exit, dt);
    this.advanceAnimation(
      "hudDiamond",
      HUD_GALLERY_DIAMOND_ANIMATION_FRAMES,
      this.animationDurations.hudDiamond,
      dt
    );
  }

  /** Rend la scene gameplay dans l'ordre ISO: grille, objets/entites, HUD. */
  render(renderer: Renderer): void {
    this.updateViewportSize();

    this.gameplayRenderer.render(renderer, {
      state: this.state,
      tileAtlasLoaded: this.runtimeAssets.tileAtlasLoaded,
      assetError: this.runtimeAssets.error,
      leftHudPanelImage: this.runtimeAssets.leftHudPanel,
      rightHudPanelImage: this.runtimeAssets.rightHudPanel,
      viewport: {
        x: this.getRenderViewportX(),
        y: this.getRenderViewportY(),
        columns: this.viewport.columns,
        rows: this.viewport.rows
      },
      tileSize: this.tileSize,
      boardOffsetX: this.getBoardOffsetX(),
      boardOffsetY: this.getBoardOffsetY(),
      tileIds: {
        monster: MONSTER_TILE_ID,
        diamond: DIAMOND_TILE_ID,
        monsterActive: MONSTER_RUNTIME_ACTIVE_TILE_ID,
        specialCreature: RUNTIME_TILE.specialCreature,
        monsterTrail: MONSTER_RUNTIME_TRAIL_TILE_ID,
        rock: ROCK_TILE_ID,
        fallingRock: FALLING_ROCK_TILE_ID,
        fallingDiamond: FALLING_DIAMOND_TILE_ID,
        empty: RUNTIME_EMPTY_TILE_ID
      },
      hudDiamondColorOffset: this.animationState.get("hudDiamond")?.frameIndex ?? 0,
      specialCreatureFrameIndex: this.animationState.get("monster")?.frameIndex ?? 0,
      getRuntimeTile: (gridX, gridY) => this.runtimeGrid.getTile(gridX, gridY),
      getTileFrame: (tileId) => this.getTileFrame(tileId),
      getDiamondTileFrame: () => this.getDiamondTileFrame(),
      getMonsterTileFrame: () => this.getMonsterTileFrame(),
      getSpecialCreatureTileFrame: () => this.getSpecialCreatureTileFrame(),
      getEntityTileFrameId: (kind) => this.getEntityTileFrameId(kind),
      findEntityAtGrid: (gridX, gridY) => this.findEntityAtGrid(gridX, gridY),
      findMonsterRuntimeAtGrid: (gridX, gridY) => this.findMonsterRuntimeAtGrid(gridX, gridY),
      isPlayerRenderedAtGrid: (gridX, gridY) => this.isPlayerRenderedAtGrid(gridX, gridY),
      getPlayerSpawnBlinkTileId: (gridX, gridY) => this.getPlayerSpawnBlinkTileId(gridX, gridY),
      getExitBlinkTileId: (gridX, gridY) => this.getExitBlinkTileId(gridX, gridY),
      isPlayerSpawning: () => this.isPlayerSpawning(),
      objectiveReachedFlashPhase: this.getObjectiveReachedFlashPhase()
    });

    if (this.optionsOpen) {
      renderOptionsPopin({
        selectedCategoryIndex: this.selectedOptionsCategoryIndex,
        contextLabel: "Jeu en pause"
      });
    }
  }

  /** Retourne la resolution logique active du gameplay. */
  getRenderSize(): Size2D {
    return getGameplayRenderSize();
  }

  /** Ajuste le nombre de cases visibles selon la resolution logique courante. */
  private updateViewportSize(): void {
    const renderSize = getGameplayRenderSize();
    const columns = Math.max(1, Math.floor(renderSize.width / this.tileSize));
    const rows = Math.max(1, Math.floor((renderSize.height - GAMEPLAY_HUD_HEIGHT) / this.tileSize));

    if (this.viewport.columns !== columns || this.viewport.rows !== rows) {
      this.cameraMove = null;
    }

    this.viewport.columns = columns;
    this.viewport.rows = rows;
    this.viewport.x = clamp(this.viewport.x, CAMERA_MIN_X, Math.max(CAMERA_MIN_X, this.levelWidth - columns));
    this.viewport.y = clamp(this.viewport.y, CAMERA_MIN_Y, Math.max(CAMERA_MIN_Y, this.levelHeight - rows));
  }

  /** Centre horizontalement le niveau quand la fenetre visible est plus large que le niveau. */
  private getBoardOffsetX(): number {
    return Math.max(0, Math.floor((this.viewport.columns - this.levelWidth) * this.tileSize / 2));
  }

  /** Centre verticalement le niveau quand la fenetre visible est plus haute que le niveau. */
  private getBoardOffsetY(): number {
    return Math.max(0, Math.floor((this.viewport.rows - this.levelHeight) * this.tileSize / 2));
  }

  /** Trouve la premiere entite visuelle active occupant la cellule de grille donnee. */
  private findEntityAtGrid(gridX: number, gridY: number): EntityState | null {
    for (const entity of this.state.entities) {
      if (!entity.active) {
        continue;
      }

      if (this.isEntityAtGrid(entity, gridX, gridY)) {
        return entity;
      }
    }

    return null;
  }

  /** Trouve le monstre runtime occupant la cellule de grille donnee. */
  private findMonsterRuntimeAtGrid(gridX: number, gridY: number): GameState["monsters"][number] | null {
    for (const monster of this.state.monsters) {
      if (monster.gridX === gridX && monster.gridY === gridY) {
        return monster;
      }

      if (
        monster.movement &&
        monster.movement.toX === gridX &&
        monster.movement.toY === gridY
      ) {
        return monster;
      }
    }

    return null;
  }

  /** Indique si une entite couvre la cellule donnee apres application des offsets runtime. */
  private isEntityAtGrid(entity: EntityState, gridX: number, gridY: number): boolean {
    return entity.gridX === gridX && entity.gridY === gridY;
  }

  /** Avance le pas joueur en gardant la fluidite comme simple choix de rendu. */
  private advancePlayerMove(dt: number): void {
    if (!this.playerMove) {
      return;
    }

    this.playerMove.elapsed += dt;
    const progress = clamp(this.playerMove.elapsed / this.playerMove.duration, 0, 1);
    const renderProgress = getMovementRenderProgress(this.playerMove.elapsed, this.playerMove.duration);
    this.state.player.gridX = lerp(this.playerMove.fromX, this.playerMove.toX, renderProgress);
    this.state.player.gridY = lerp(this.playerMove.fromY, this.playerMove.toY, renderProgress);

    if (progress >= 1) {
      this.holdPlayerFinalMoveFrame();
      this.state.player.gridX = this.playerMove.toX;
      this.state.player.gridY = this.playerMove.toY;
      this.applyPlayerArrivalEffect(
        this.playerMove.toX,
        this.playerMove.toY,
        this.playerMove.arrivalEffect ?? "none"
      );
      this.playerMove = null;
    }
  }

  /** Maintient le cycle de marche tant qu'une touche directionnelle reste pressee. */
  private advancePlayerHeldMoveFrame(dt: number): void {
    if (this.playerHeldMoveFrameId === null) {
      return;
    }

    this.playerHeldMoveFrameElapsed += dt;
    if (this.playerHeldMoveFrameElapsed >= PLAYER_WALK_FINAL_FRAME_HOLD_DURATION) {
      this.clearPlayerHeldMoveFrame();
    }
  }

  /** Conserve la derniere frame de marche lorsqu'un mouvement continu va s'enchainer. */
  private holdPlayerFinalMoveFrame(): void {
    const frames = this.getPlayerDirectionalFrames();
    if (!frames || frames.length === 0) {
      return;
    }

    this.playerHeldMoveFrameId = frames[frames.length - 1];
    this.playerHeldMoveFrameElapsed = 0;
  }

  /** Efface la frame de marche maintenue quand l'input directionnel s'arrete. */
  private clearPlayerHeldMoveFrame(): void {
    this.playerHeldMoveFrameId = null;
    this.playerHeldMoveFrameElapsed = 0;
  }

  /** Reinitialise le timer d'inactivite quand le joueur bouge ou presse une direction. */
  private resetPlayerIdleDelay(): void {
    this.playerIdleElapsed = 0;
  }

  /** Avance le timer d'inactivite et bascule vers le cycle idle ASM prouve apres delai. */
  private advancePlayerIdleDelay(dt: number): void {
    if (this.playerFacing === "idle") {
      return;
    }

    this.playerIdleElapsed += dt;
    if (this.playerIdleElapsed < PLAYER_IDLE_DELAY) {
      return;
    }

    this.playerFacing = "idle";
    this.clearPlayerHeldMoveFrame();
    this.resetPlayerAnimationClock("player");
  }

  /** Redemarre une horloge d'animation depuis sa premiere frame. */
  private resetPlayerAnimationClock(animationKey: string): void {
    const clock = this.animationState.get(animationKey);
    if (!clock) {
      return;
    }

    clock.frameIndex = 0;
    clock.accumulator = 0;
  }

  /** Demarre un scroll camera quand le joueur franchit la marge viewport ASM. */
  private advanceCameraAfterPlayerStep(fromX: number, fromY: number, moveX: number, moveY: number): void {
    this.cameraMove = advanceCameraAfterPlayerStepSystem(this.viewport, fromX, fromY, moveX, moveY, {
      leftMargin: CAMERA_LEFT_MARGIN,
      rightMargin: CAMERA_RIGHT_MARGIN,
      topMargin: CAMERA_TOP_MARGIN,
      bottomMargin: CAMERA_BOTTOM_MARGIN,
      minX: CAMERA_MIN_X,
      minY: CAMERA_MIN_Y,
      levelWidth: this.levelWidth,
      levelHeight: this.levelHeight,
      moveDuration: getCameraMoveDuration()
    }) ?? this.cameraMove;
  }

  /** Avance le mouvement camera vers l'origine viewport cible. */
  private advanceCameraMove(dt: number): void {
    this.cameraMove = advanceCameraMoveSystem(this.cameraMove, dt);
  }

  /** Retourne le X de viewport interpole utilise pour le rendu. */
  private getRenderViewportX(): number {
    return getRenderViewportXSystem(this.viewport, this.cameraMove);
  }

  /** Retourne le Y de viewport interpole utilise pour le rendu. */
  private getRenderViewportY(): number {
    return getRenderViewportYSystem(this.viewport, this.cameraMove);
  }

  /** Resout si le joueur peut entrer dans une cellule cible et quel effet d'arrivee appliquer. */
  private resolvePlayerMove(gridX: number, gridY: number): PlayerMoveResolution {
    if (gridX < 0 || gridY < 0) {
      return {
        canEnter: false,
        tileId: RUNTIME_GRID_FILL_TILE_ID,
        arrivalEffect: "none"
      };
    }

    if (debugOptions.ghostMode) {
      const tileId = this.runtimeGrid.getTile(gridX, gridY);
      return {
        canEnter: true,
        tileId,
        arrivalEffect: this.getGhostPlayerArrivalEffect(gridX, gridY, tileId)
      };
    }

    if (this.hasPhysicalObjectAtGrid(gridX, gridY)) {
      return {
        canEnter: false,
        tileId: this.runtimeGrid.getTile(gridX, gridY),
        arrivalEffect: "none"
      };
    }

    if (this.findEntityKindAtGrid("diamond", gridX, gridY) !== null) {
      return {
        canEnter: true,
        tileId: DIAMOND_TILE_ID,
        arrivalEffect: "collectDiamond"
      };
    }

    const targetMonster = this.findMonsterRuntimeAtGrid(gridX, gridY);
    if (targetMonster !== null) {
      return {
        canEnter: true,
        tileId: targetMonster.kind === "specialCreature" ? RUNTIME_TILE.specialCreature : MONSTER_TILE_ID,
        arrivalEffect: "hitMonster"
      };
    }

    if (this.findEntityKindAtGrid("specialCreature", gridX, gridY) !== null) {
      return {
        canEnter: true,
        tileId: RUNTIME_TILE.specialCreature,
        arrivalEffect: "hitMonster"
      };
    }

    const tileId = this.runtimeGrid.getTile(gridX, gridY);
    if (this.isOpenExitCell(gridX, gridY)) {
      return {
        canEnter: true,
        tileId,
        arrivalEffect: "enterExit"
      };
    }

    return {
      canEnter: this.canPlayerEnterTile(tileId),
      tileId,
      arrivalEffect: this.getPlayerArrivalEffect(tileId)
    };
  }

  /** Associe un tile id runtime a l'effet declenche apres l'arrivee joueur. */
  private getPlayerArrivalEffect(tileId: number): RuntimeTileArrivalEffect {
    return getPlayerArrivalEffectSystem(tileId, this.getPlayerCollisionTiles());
  }

  /** Associe une tuile runtime a l'effet non mortel utilise par le mode debug ghost. */
  private getGhostPlayerArrivalEffect(gridX: number, gridY: number, tileId: number): RuntimeTileArrivalEffect {
    if (this.findEntityKindAtGrid("diamond", gridX, gridY) !== null || tileId === DIAMOND_TILE_ID) {
      return "collectDiamond";
    }

    if (tileId === PLAYER_DIGGABLE_TILE_ID) {
      return "dig";
    }

    if (tileId === MONSTER_RUNTIME_TRAIL_TILE_ID) {
      return "clearTrail";
    }

    if (this.isOpenExitCell(gridX, gridY)) {
      return "enterExit";
    }

    return "none";
  }

  /** Resout la cible d'une poussee horizontale de rocher, ou `null` si elle est invalide. */
  private resolvePushedRockTarget(
    rockGridX: number,
    rockGridY: number,
    moveX: number
  ): { readonly x: number; readonly y: number } | null {
    return resolveRockPushTargetSystem(rockGridX, rockGridY, moveX, {
      getTile: (gridX, gridY) => this.runtimeGrid.getTile(gridX, gridY),
      hasEntityAt: (gridX, gridY) => this.findEntityAtGrid(gridX, gridY) !== null,
      hasMonsterAt: (gridX, gridY) => this.findMonsterRuntimeAtGrid(gridX, gridY) !== null,
      hasPhysicalObjectAt: (gridX, gridY) => this.hasPhysicalObjectAtGrid(gridX, gridY),
      emptyTileId: RUNTIME_EMPTY_TILE_ID
    });
  }

  /** Indique si le joueur peut entrer dans la tuile runtime. */
  private canPlayerEnterTile(tileId: number): boolean {
    return canPlayerEnterTileSystem(tileId, this.getPlayerCollisionTiles());
  }

  /** Retourne les tile ids runtime qui bloquent le mouvement joueur. */
  private getPlayerCollisionTiles() {
    return {
      empty: RUNTIME_EMPTY_TILE_ID,
      diggable: PLAYER_DIGGABLE_TILE_ID,
      diamond: DIAMOND_TILE_ID,
      monsterTrail: MONSTER_RUNTIME_TRAIL_TILE_ID,
      fallingRock: FALLING_ROCK_TILE_ID,
      fallingDiamond: FALLING_DIAMOND_TILE_ID,
      rock: ROCK_TILE_ID,
      border: RUNTIME_GRID_FILL_TILE_ID,
      platform: PLATFORM_TILE_ID,
      transformerBlock: RUNTIME_TILE.transformerBlock
    };
  }

  /** Applique creusement, collecte de diamant ou fin de niveau apres l'arrivee. */
  private applyPlayerArrivalEffect(gridX: number, gridY: number, effect: RuntimeTileArrivalEffect): void {
    if (effect === "dig") {
      this.digRuntimeTile(gridX, gridY);
      return;
    }

    if (effect === "collectDiamond") {
      this.collectRuntimeDiamond(gridX, gridY);
      return;
    }

    if (effect === "clearTrail") {
      this.clearRuntimeTile(gridX, gridY);
      return;
    }

    if (effect === "enterExit") {
      emitRuntimeEvent(this.state, {
        type: "levelCompleted",
        levelNumber: this.levelNumber,
        nextLevelId: this.state.level.meta.nextLevelId
      });
      return;
    }

    if (effect === "hitMonster") {
      this.startMonsterContactExplosion(gridX, gridY);
    }
  }

  /** Efface une tuile runtime, avec emission optionnelle de l'evenement gameplay associe. */
  private clearRuntimeTile(gridX: number, gridY: number, emitEvent = true): void {
    if (!emitEvent) {
      this.runtimeMutations.clearFallingObjectSource(gridX, gridY);
      return;
    }

    this.runtimeMutations.clearPlayerTile(gridX, gridY);
  }

  /** Retire une tuile creusable runtime de la grille du niveau. */
  private digRuntimeTile(gridX: number, gridY: number): void {
    this.runtimeMutations.digPlayerTile(gridX, gridY);
  }

  /** Retire une tuile diamant runtime et emet les donnees de score/progression. */
  private collectRuntimeDiamond(gridX: number, gridY: number): void {
    this.runtimeMutations.collectDiamond({
      gridX,
      gridY,
      score: this.state.level.meta.scoreStep,
      deactivateEntity: () => this.deactivateEntityAtGrid("diamond", gridX, gridY)
    });
  }

  /** Avance les scans d'objets en chute et leurs mouvements actifs. */
  private advanceFallingObjects(dt: number): void {
    if (this.state.levelComplete) {
      return;
    }

    this.advanceActiveFallingObjects(dt);

    this.fallingObjectScanElapsed += dt;
    if (this.fallingObjectScanElapsed < FALLING_OBJECT_SCAN_INTERVAL) {
      return;
    }

    this.fallingObjectScanElapsed %= FALLING_OBJECT_SCAN_INTERVAL;
    this.startReadyFallingObjects();
  }

  /** Avance les objets deja en chute vers leurs cellules de destination. */
  private advanceActiveFallingObjects(dt: number): void {
    for (let index = this.state.fallingObjects.length - 1; index >= 0; index -= 1) {
      const fallingObject = this.state.fallingObjects[index];
      fallingObject.elapsed += dt;
      this.syncFallingObjectEntity(fallingObject);

      if (fallingObject.elapsed < fallingObject.duration) {
        continue;
      }

      const shouldRemoveFallingObject = this.completeFallingObject(fallingObject);
      if (shouldRemoveFallingObject) {
        this.state.fallingObjects.splice(index, 1);
      }
    }
  }

  /** Scanne la grille runtime et demarre les chutes de rochers ou diamants eligibles. */
  private startReadyFallingObjects(): void {
    for (let y = this.levelHeight - 2; y >= 0; y -= 1) {
      for (let x = 0; x < this.levelWidth; x += 1) {
        const tileId = this.runtimeGrid.getTile(x, y);
        if (!this.isPhysicalFallingTile(tileId)) {
          continue;
        }

        if (this.isFallingObjectBlockedByPlayer(x, y)) continue;

        const target = this.resolveFallingObjectTarget(x, y);
        if (!target) {
          continue;
        }

        this.startFallingObject(x, y, target.x, target.y, tileId, target.moveKind, target.transformedTileId);
      }
    }
  }

  /** Resout la prochaine cible de chute avec chute verticale et regles de bascule laterale. */
  private resolveFallingObjectTarget(
    gridX: number,
    gridY: number
  ): {
    readonly x: number;
    readonly y: number;
    readonly moveKind: "fall" | "slide";
    readonly transformedTileId?: number;
  } | null {
    return resolveFallingObjectTargetSystem({
      gridX,
      gridY,
      playerGridX: this.getPlayerLogicalCell().x,
      getTile: (x, y) => this.runtimeGrid.getTile(x, y),
      canMoveTo: (x, y) => this.canFallingObjectMoveTo(x, y),
      isStaticFallingObjectTile: (tileId) => this.isFallingObjectStaticTile(tileId),
      isClearanceCellEmpty: (x, y) => this.isFallingObjectClearanceCellEmpty(x, y),
      transformerBlockTileId: RUNTIME_TILE.transformerBlock,
      transformFallingTile: (tileId) => this.getTransformerResultTileId(tileId)
    });
  }

  /** Retourne le tile final apres traversee ASM du bloc transformateur `0x18`. */
  private getTransformerResultTileId(tileId: number): number {
    if (tileId === ROCK_TILE_ID || tileId === FALLING_ROCK_TILE_ID) {
      return DIAMOND_TILE_ID;
    }

    if (tileId === DIAMOND_TILE_ID || tileId === FALLING_DIAMOND_TILE_ID) {
      return ROCK_TILE_ID;
    }

    return tileId;
  }

  /** Indique si une cellule de degagement lateral est suffisamment vide pour la physique. */
  private isFallingObjectClearanceCellEmpty(gridX: number, gridY: number): boolean {
    return (
      this.isFallingObjectEmptyRuntimeTile(this.runtimeGrid.getTile(gridX, gridY)) &&
      !this.hasPhysicalObjectAtGrid(gridX, gridY) &&
      !this.isPlayerLogicalAtGrid(gridX, gridY)
    );
  }

  /** Indique si une tuile statique peut servir de support aux regles de bascule laterale. */
  private isFallingObjectStaticTile(tileId: number): boolean {
    return tileId === ROCK_TILE_ID || tileId === DIAMOND_TILE_ID;
  }

  /** Indique si un objet en chute peut occuper la cellule cible. */
  private canFallingObjectMoveTo(gridX: number, gridY: number): boolean {
    return (
      (
        this.isFallingObjectEmptyRuntimeTile(this.runtimeGrid.getTile(gridX, gridY)) ||
        this.findMonsterRuntimeAtGrid(gridX, gridY) !== null ||
        this.findEntityKindAtGrid("specialCreature", gridX, gridY) !== null
      ) &&
      !this.hasPhysicalObjectAtGrid(gridX, gridY)
    );
  }

  /** Indique si un objet soumis a la gravite est volontairement retenu quand le joueur est dessous. */
  private isFallingObjectBlockedByPlayer(gridX: number, gridY: number): boolean {
    return (
      this.isPlayerLogicalAtGrid(gridX, gridY + 1) ||
      (
        this.runtimeGrid.getTile(gridX, gridY) === DIAMOND_TILE_ID &&
        this.isPlayerLogicalAtGrid(gridX, gridY)
      )
    );
  }

  /** Indique si une tuile runtime est vide pour le mouvement d'un objet en chute. */
  private isFallingObjectEmptyRuntimeTile(tileId: number): boolean {
    return tileId === RUNTIME_EMPTY_TILE_ID || tileId === MONSTER_RUNTIME_TRAIL_TILE_ID;
  }

  /** Demarre un mouvement d'objet en chute et met immediatement la grille runtime a jour. */
  private startFallingObject(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    tileId: number,
    moveKind: "fall" | "slide",
    finalTileId = tileId,
    duration = getFallingObjectMoveDuration()
  ): void {
    const kind = finalTileId === DIAMOND_TILE_ID || finalTileId === FALLING_DIAMOND_TILE_ID ? "diamond" : "rock";
    const movingTileId = kind === "diamond" ? FALLING_DIAMOND_TILE_ID : FALLING_ROCK_TILE_ID;
    const sourceDiamondEntity = this.findEntityKindAtGrid("diamond", fromX, fromY);
    const entity = kind === "diamond" ? sourceDiamondEntity : null;
    const targetMonster = this.findMonsterRuntimeAtGrid(toX, toY);
    const fallingObject: FallingObjectRuntimeState = {
      id: `falling-${kind}-${fromX}-${fromY}-${Date.now()}`,
      kind,
      moveKind,
      tileId: kind === "diamond" ? DIAMOND_TILE_ID : ROCK_TILE_ID,
      movingTileId,
      entityId: entity?.id,
      targetMonsterId: targetMonster?.id,
      fromX,
      fromY,
      toX,
      toY,
      elapsed: 0,
      duration
    };

    if (sourceDiamondEntity && kind === "rock") {
      sourceDiamondEntity.active = false;
    }

    this.runtimeMutations.clearFallingObjectSource(fromX, fromY);
    this.runtimeMutations.setFallingObjectMovingTile(toX, toY, movingTileId);
    this.state.fallingObjects.push(fallingObject);
  }

  /** Demarre une poussee horizontale de rocher comme mouvement physique non mortel. */
  private startPushedRockMove(fromX: number, fromY: number, toX: number, toY: number): void {
    this.runtimeMutations.clearPushedRockSource(fromX, fromY);
    this.runtimeMutations.setPushedRockMovingTile(toX, toY, FALLING_ROCK_TILE_ID);
    this.state.fallingObjects.push({
      id: `pushed-rock-${fromX}-${fromY}-${Date.now()}`,
      kind: "rock",
      moveKind: "push",
      tileId: ROCK_TILE_ID,
      movingTileId: FALLING_ROCK_TILE_ID,
      fromX,
      fromY,
      toX,
      toY,
      elapsed: 0,
      duration: getPushedRockMoveDuration()
    });
  }

  /** Finalise un objet physique quand sa duree de mouvement atteint la destination. */
  private completeFallingObject(fallingObject: FallingObjectRuntimeState): boolean {
    const impact = this.applyFallingObjectImpact(fallingObject);
    if (impact === "explosion") {
      return true;
    }

    this.runtimeMutations.completeFallingObjectTile(fallingObject.toX, fallingObject.toY, fallingObject.tileId);

    if (fallingObject.entityId) {
      const entity = this.state.entities.find((item) => item.id === fallingObject.entityId);
      if (entity) {
        entity.gridX = fallingObject.toX;
        entity.gridY = fallingObject.toY;
        entity.x = entity.gridX * this.state.level.tileSize;
        entity.y = entity.gridY * this.state.level.tileSize;
      }
    } else if (fallingObject.kind === "diamond") {
      this.createRuntimeDiamondEntity(fallingObject.toX, fallingObject.toY);
    }

    if (fallingObject.moveKind !== "push") {
      const nextTarget = this.resolveFallingObjectTarget(fallingObject.toX, fallingObject.toY);
      if (nextTarget) {
        this.startFallingObject(
          fallingObject.toX,
          fallingObject.toY,
          nextTarget.x,
          nextTarget.y,
          fallingObject.tileId,
          nextTarget.moveKind,
          nextTarget.transformedTileId
        );
      }
    }

    return true;
  }

  /** Cree une entite diamant runtime lorsqu'un rocher est transforme par le bloc `0x18`. */
  private createRuntimeDiamondEntity(gridX: number, gridY: number): void {
    if (this.findEntityKindAtGrid("diamond", gridX, gridY)) {
      return;
    }

    this.state.entities.push({
      id: `diamond-runtime-${gridX}-${gridY}-${Date.now()}`,
      kind: "diamond",
      gridX,
      gridY,
      x: gridX * this.state.level.tileSize,
      y: gridY * this.state.level.tileSize,
      width: this.state.level.tileSize,
      height: this.state.level.tileSize,
      spriteFrameId: "tile:3",
      active: true
    });
  }

  /** Synchronise le rendu d'une entite physique sans modifier sa cadence runtime. */
  private syncFallingObjectEntity(fallingObject: FallingObjectRuntimeState): void {
    if (!fallingObject.entityId) {
      return;
    }

    const entity = this.state.entities.find((item) => item.id === fallingObject.entityId);
    if (!entity) {
      return;
    }

    const renderProgress = getMovementRenderProgress(fallingObject.elapsed, fallingObject.duration);
    entity.gridX = lerp(fallingObject.fromX, fallingObject.toX, renderProgress);
    entity.gridY = lerp(fallingObject.fromY, fallingObject.toY, renderProgress);
    entity.x = entity.gridX * this.state.level.tileSize;
    entity.y = entity.gridY * this.state.level.tileSize;
  }

  /** Indique si la tuile participe a la gravite rocher/diamant. */
  private isPhysicalFallingTile(tileId: number): boolean {
    return tileId === ROCK_TILE_ID || tileId === DIAMOND_TILE_ID;
  }

  /** Indique si un objet physique actif cible ou occupe deja la cellule. */
  private hasPhysicalObjectAtGrid(gridX: number, gridY: number): boolean {
    return hasPhysicalObjectAtGridSystem(this.state.fallingObjects, gridX, gridY);
  }

  /** Ouvre la sortie du niveau quand l'objectif de diamants est atteint. */
  private updateLevelExitStateAfterDiamondCollection(): void {
    if (this.state.hud.diamonds !== 0 || this.state.exitOpen) {
      return;
    }

    this.state.exitOpen = true;
    this.startObjectiveReachedFlash();
    emitRuntimeEvent(this.state, {
      type: "exitOpened",
      gridX: this.state.level.exit.x,
      gridY: this.state.level.exit.y
    });
  }

  /** Applique les effets d'impact mortels quand un rocher ou diamant atteint sa cible. */
  private applyFallingObjectImpact(fallingObject: FallingObjectRuntimeState): "none" | "explosion" {
    if (debugOptions.ghostMode && this.isPlayerLogicalAtGrid(fallingObject.toX, fallingObject.toY)) {
      return "none";
    }

    const targetMonsterId = fallingObject.targetMonsterId ??
      this.findMonsterRuntimeAtGrid(fallingObject.toX, fallingObject.toY)?.id;
    const impact = resolvePhysicalObjectImpact(fallingObject, {
      isPlayerAtTarget: this.isPlayerLogicalAtGrid(fallingObject.toX, fallingObject.toY),
      targetMonsterId
    });

    if (impact.type === "hitPlayer") {
      this.startExplosion(fallingObject.toX, fallingObject.toY);
      this.killPlayer(impact.objectKind === "diamond" ? "fallingDiamond" : "fallingRock");
      return "explosion";
    }

    const monster = impact.type === "hitMonster" && impact.monsterId
      ? this.findMonsterRuntimeById(impact.monsterId)
      : null;
    if (monster) {
      this.deactivateMonster(monster);
      this.startExplosion(
        fallingObject.toX,
        fallingObject.toY,
        monster.kind === "specialCreature" ? "diamonds" : "clear"
      );
      return "explosion";
    }

    const specialCreature = this.findEntityKindAtGrid("specialCreature", fallingObject.toX, fallingObject.toY);
    if (specialCreature) {
      this.deactivateSpecialCreature(specialCreature);
      this.startExplosion(fallingObject.toX, fallingObject.toY, "diamonds");
      return "explosion";
    }

    return "none";
  }

  /** Demarre la sequence d'explosion 3x3 prouvee autour d'une cellule cible. */
  private startExplosion(centerX: number, centerY: number, result: RuntimeExplosionState["result"] = "clear"): void {
    const cells = this.getExplosionCells(centerX, centerY);
    if (cells.length === 0) {
      return;
    }

    const explosion: RuntimeExplosionState = {
      id: `explosion-${centerX}-${centerY}-${Date.now()}`,
      centerX,
      centerY,
      cells,
      frameIndex: 0,
      elapsed: 0,
      frameDuration: EXPLOSION_FRAME_DURATION,
      result
    };
    this.state.explosions.push(explosion);
    gameAudio.playExplosion();
    this.applyExplosionFrame(explosion);
    this.deactivateEntitiesInExplosion(explosion);
    if (!debugOptions.ghostMode && explosion.cells.some((cell) => this.isPlayerLogicalAtGrid(cell.x, cell.y))) {
      this.killPlayer("explosion");
    }
  }

  /** Retourne les cellules d'explosion 3x3 en preservant les bordures protegees `0x04`. */
  private getExplosionCells(centerX: number, centerY: number): RuntimeExplosionState["cells"] {
    const cells: Array<{ readonly x: number; readonly y: number }> = [];
    for (let y = centerY - 1; y <= centerY + 1; y += 1) {
      for (let x = centerX - 1; x <= centerX + 1; x += 1) {
        if (this.runtimeGrid.getTile(x, y) === RUNTIME_GRID_FILL_TILE_ID) {
          continue;
        }

        cells.push({ x, y });
      }
    }

    return cells;
  }

  /** Avance les explosions actives et les retire apres la derniere frame vide. */
  private advanceExplosions(dt: number): void {
    for (let index = this.state.explosions.length - 1; index >= 0; index -= 1) {
      const explosion = this.state.explosions[index];
      explosion.elapsed += dt;
      while (explosion.elapsed >= explosion.frameDuration) {
        explosion.elapsed -= explosion.frameDuration;
        explosion.frameIndex += 1;
        this.applyExplosionFrame(explosion);
        if (explosion.frameIndex >= EXPLOSION_TILE_SEQUENCE.length - 1) {
          this.applyExplosionResult(explosion);
          this.state.explosions.splice(index, 1);
          break;
        }
      }
    }
  }

  /** Applique la frame de tuile d'explosion courante a chaque cellule non protegee. */
  private applyExplosionFrame(explosion: RuntimeExplosionState): void {
    const tileId = EXPLOSION_TILE_SEQUENCE[Math.min(explosion.frameIndex, EXPLOSION_TILE_SEQUENCE.length - 1)];
    for (const cell of explosion.cells) {
      this.runtimeMutations.setTile(cell.x, cell.y, tileId);
    }
  }

  /** Applique le resultat final d'une explosion apres la derniere frame visuelle. */
  private applyExplosionResult(explosion: RuntimeExplosionState): void {
    if (explosion.result !== "diamonds") {
      return;
    }

    let createdDiamonds = 0;
    for (const cell of explosion.cells) {
      if (this.isOpenExitCell(cell.x, cell.y)) {
        continue;
      }

      this.runtimeMutations.setTile(cell.x, cell.y, DIAMOND_TILE_ID);
      this.createRuntimeDiamondEntity(cell.x, cell.y);
      createdDiamonds += 1;
    }

    this.state.hud.diamonds += createdDiamonds;
    if (createdDiamonds > 0) {
      this.state.exitOpen = false;
    }
  }

  /** Desactive les entites couvertes par une explosion; les monstres sont retires separement. */
  private deactivateEntitiesInExplosion(explosion: RuntimeExplosionState): void {
    for (const entity of this.state.entities) {
      if (!entity.active || entity.kind === "player") {
        continue;
      }

      if (explosion.cells.some((cell) => this.isEntityAtGrid(entity, cell.x, cell.y))) {
        entity.active = false;
      }
    }
  }

  /** Applique les effets de bord produits par la file d'evenements runtime decouplee. */
  private consumeRuntimeEvents(): void {
    for (const event of drainRuntimeEvents(this.state)) {
      if (event.type === "diamondCollected") {
        this.incrementScore(event.score);
        this.state.hud.diamonds = Math.max(0, this.state.hud.diamonds - 1);
        gameAudio.playDiamondCollected();
        this.updateLevelExitStateAfterDiamondCollection();
        continue;
      }

      if (event.type === "levelCompleted") {
        this.startLevelCompletionBonus();
      }
    }
  }

  /** Indique si la cellule donnee est la sortie actuellement ouverte. */
  private isOpenExitCell(gridX: number, gridY: number): boolean {
    return isOpenExitCellSystem(
      this.state.exitOpen,
      this.state.level.exit.x,
      this.state.level.exit.y,
      gridX,
      gridY
    );
  }

  /** Retourne la tuile visuelle clignotante de la sortie active sans muter la grille runtime. */
  private getExitBlinkTileId(gridX: number, gridY: number): number | undefined {
    if (!this.isOpenExitCell(gridX, gridY)) {
      return undefined;
    }

    const frameIndex = this.animationState.get("exit")?.frameIndex ?? 0;
    return frameIndex % 2 === 0 ? RUNTIME_GRID_FILL_TILE_ID : RUNTIME_EMPTY_TILE_ID;
  }

  /** Declenche le flash cadre quand l'objectif diamant vient d'etre atteint. */
  private startObjectiveReachedFlash(): void {
    this.objectiveReachedFlashElapsed = 0;
    this.objectiveReachedFlashActive = true;
  }

  /** Avance la sequence moderne du flash objectif atteint. */
  private advanceObjectiveReachedFlash(dt: number): void {
    if (!this.objectiveReachedFlashActive) {
      return;
    }

    this.objectiveReachedFlashElapsed += dt;
    if (this.objectiveReachedFlashElapsed >= OBJECTIVE_REACHED_FLASH_PHASE_DURATION * OBJECTIVE_REACHED_FLASH_PHASE_COUNT) {
      this.objectiveReachedFlashActive = false;
    }
  }

  /** Retourne la phase visible courante du flash objectif, ou rien si l'effet est termine. */
  private getObjectiveReachedFlashPhase(): number | null {
    if (!this.objectiveReachedFlashActive) {
      return null;
    }

    return Math.min(
      OBJECTIVE_REACHED_FLASH_PHASE_COUNT - 1,
      Math.floor(this.objectiveReachedFlashElapsed / OBJECTIVE_REACHED_FLASH_PHASE_DURATION)
    );
  }

  /** Programme la transition directe vers le niveau suivant quand le joueur atteint la sortie ouverte. */
  private queueNextLevelTransition(): void {
    if (this.levelTransitionQueued) {
      return;
    }

    this.levelTransitionQueued = true;
    if (this.levelNumber < LAST_LEVEL_NUMBER) {
      this.context?.setScene(this.createNextLevelScene(this.levelNumber));
    }
  }

  /** Programme le retour au titre pour les sorties du mode attract. */
  private queueAttractReturnToTitle(): void {
    if (this.levelTransitionQueued) {
      return;
    }

    this.levelTransitionQueued = true;
    if (this.createTitleScene) {
      this.context?.setScene(this.createTitleScene());
    }
  }

  /** Avance temps, score et compteurs de panneaux; la navigation game-over reste differee. */
  private advanceHudCounters(dt: number, playerSpawning: boolean): void {
    if (this.levelCompletionBonusActive) {
      this.advanceLevelCompletionBonus(dt);
      return;
    }

    if (playerSpawning || this.state.gameOver || this.state.levelComplete || this.state.hud.time <= 0) {
      return;
    }

    this.hudTimeAccumulator += dt;
    while (this.hudTimeAccumulator >= HUD_TIMER_TICK_SECONDS && this.state.hud.time > 0) {
      this.hudTimeAccumulator -= HUD_TIMER_TICK_SECONDS;
      this.state.hud.time = decrementBcdCounter(this.state.hud.time, 3);
      if (this.state.hud.time === 0) {
        this.state.gameOver = true;
      }
    }
  }

  /** Incremente le compteur de score pseudo-BCD avec une recompense gameplay. */
  private incrementScore(amount: number): void {
    this.state.hud.score = incrementBcdCounter(this.state.hud.score, amount, 6);
    this.state.hud.record = Math.max(this.state.hud.record, this.state.hud.score);
  }

  /** Demarre la sequence de conversion du temps restant en score apres sortie. */
  private startLevelCompletionBonus(): void {
    if (this.state.levelComplete) {
      return;
    }

    this.state.levelComplete = true;
    this.playerMove = null;
    this.clearPlayerHeldMoveFrame();
    this.levelCompletionBonusActive = true;
    this.levelCompletionBonusAccumulator = 0;
    this.levelCompletionTransitionElapsed = 0;
  }

  /** Convertit progressivement le temps restant en score comme la boucle `KIT.BIN:$BFE2/C003`. */
  private advanceLevelCompletionBonus(dt: number): void {
    if (this.state.hud.time <= 0) {
      this.advanceLevelCompletionTransitionDelay(dt);
      return;
    }

    this.levelCompletionBonusAccumulator += dt;
    while (this.levelCompletionBonusAccumulator >= LEVEL_COMPLETION_BONUS_STEP_DURATION && this.state.hud.time > 0) {
      this.levelCompletionBonusAccumulator -= LEVEL_COMPLETION_BONUS_STEP_DURATION;
      this.state.hud.time = decrementBcdCounter(this.state.hud.time, 3);
      this.incrementScore(1);
      gameAudio.playScoreTick();
    }

    if (this.state.hud.time <= 0) {
      this.levelCompletionBonusAccumulator = 0;
      this.levelCompletionTransitionElapsed = 0;
    }
  }

  /** Attend un court instant apres le bonus avant de changer de scene. */
  private advanceLevelCompletionTransitionDelay(dt: number): void {
    this.levelCompletionTransitionElapsed += dt;
    if (this.levelCompletionTransitionElapsed < LEVEL_COMPLETION_TRANSITION_DELAY) {
      return;
    }

    this.levelCompletionBonusActive = false;
    if (this.gameplayMode === "attract") {
      this.queueAttractReturnToTitle();
    } else {
      this.queueNextLevelTransition();
    }
  }

  /** Desactive la premiere entite d'un type trouvee a la cellule de grille donnee. */
  private deactivateEntityAtGrid(kind: EntityState["kind"], gridX: number, gridY: number): void {
    const entity = this.findEntityKindAtGrid(kind, gridX, gridY);

    if (entity) {
      entity.active = false;
    }
  }

  /** Trouve la premiere entite active d'un type donne a la cellule de grille donnee. */
  private findEntityKindAtGrid(kind: EntityState["kind"], gridX: number, gridY: number): EntityState | null {
    return this.state.entities.find((item) =>
      item.kind === kind &&
      item.active &&
      item.gridX === gridX &&
      item.gridY === gridY
    ) ?? null;
  }

  /** Repercute les positions des monstres runtime sans laisser la fluidite piloter la logique. */
  private syncMonsterEntitiesFromRuntimeState(): void {
    for (const monster of this.state.monsters) {
      const entity = this.state.entities.find((item) => item.id === monster.entityId);
      if (!entity) {
        continue;
      }

      entity.gridX = monster.gridX;
      entity.gridY = monster.gridY;
      if (monster.movement) {
        const renderProgress = getMovementRenderProgress(monster.movement.elapsed, monster.movement.duration);
        entity.gridX = lerp(monster.movement.fromX, monster.movement.toX, renderProgress);
        entity.gridY = lerp(monster.movement.fromY, monster.movement.toY, renderProgress);
      }

      entity.x = entity.gridX * this.state.level.tileSize;
      entity.y = entity.gridY * this.state.level.tileSize;
    }

    this.resolvePlayerMonsterContact();
  }

  /** Termine la vie courante quand le joueur et un monstre partagent une cellule. */
  private resolvePlayerMonsterContact(): void {
    if (!this.state.player.active || this.state.gameOver || this.isPlayerSpawning()) {
      return;
    }

    const playerCell = this.getPlayerMonsterContactCell();
    const monsterContact = !debugOptions.ghostMode ? this.findMonsterRuntimeTouchingPlayer(playerCell.x, playerCell.y) : null;
    if (monsterContact) {
      this.startMonsterContactExplosion(monsterContact.x, monsterContact.y);
    }
  }

  /** Retourne la cellule joueur utilisee par le contact monstre, sans anticiper le pas en cours. */
  private getPlayerMonsterContactCell(): { readonly x: number; readonly y: number } {
    if (this.playerMove) {
      return {
        x: this.playerMove.fromX,
        y: this.playerMove.fromY
      };
    }

    return this.getPlayerLogicalCell();
  }

  /** Declenche l'explosion joueur/monstre en retirant d'abord le monstre du rendu. */
  private startMonsterContactExplosion(gridX: number, gridY: number): void {
    const monster = this.findMonsterRuntimeAtGrid(gridX, gridY);
    if (monster) {
      this.deactivateMonster(monster);
    }

    this.startExplosion(gridX, gridY);
    this.killPlayer("monsterContact");
  }

  /** Trouve un monstre dont la zone de contact touche le joueur, comme les lectures voisines de `KIT.BIN:$CA04`. */
  private findMonsterRuntimeTouchingPlayer(
    playerGridX: number,
    playerGridY: number
  ): { readonly monster: GameState["monsters"][number]; readonly x: number; readonly y: number } | null {
    for (const monster of this.state.monsters) {
      const monsterCell = this.getMonsterRenderedContactCell(monster);
      if (isAdjacentOrSameCell(playerGridX, playerGridY, monsterCell.x, monsterCell.y)) {
        return {
          monster,
          x: monsterCell.x,
          y: monsterCell.y
        };
      }
    }

    return null;
  }

  /** Retourne la cellule de contact discrete d'un monstre pendant son pas. */
  private getMonsterRenderedContactCell(monster: GameState["monsters"][number]): { readonly x: number; readonly y: number } {
    if (!monster.movement) {
      return {
        x: monster.gridX,
        y: monster.gridY
      };
    }

    const progress = clamp(monster.movement.elapsed / monster.movement.duration, 0, 1);
    if (progress < 1) {
      return {
        x: monster.movement.fromX,
        y: monster.movement.fromY
      };
    }

    return {
      x: monster.movement.toX,
      y: monster.movement.toY
    };
  }

  /** Desactive une creature speciale touchee par un objet en chute; le burst diamant est gere separement. */
  private deactivateSpecialCreature(entity: EntityState): void {
    entity.active = false;
    this.runtimeMutations.setTile(entity.gridX, entity.gridY, RUNTIME_EMPTY_TILE_ID);
  }

  /** Desactive un monstre touche par un objet en chute; le visuel d'explosion est gere separement. */
  private deactivateMonster(monster: GameState["monsters"][number]): void {
    const entity = this.state.entities.find((item) => item.id === monster.entityId);
    if (entity) {
      entity.active = false;
    }

    const monsterIndex = this.state.monsters.indexOf(monster);
    if (monsterIndex >= 0) {
      this.state.monsters.splice(monsterIndex, 1);
    }
  }

  /** Trouve un monstre runtime par id stable, meme s'il a bouge apres ciblage de l'impact. */
  private findMonsterRuntimeById(monsterId: string): GameState["monsters"][number] | null {
    return this.state.monsters.find((monster) => monster.id === monsterId) ?? null;
  }

  /** Marque le joueur comme mort pour l'implementation actuelle de vie/reset. */
  private killPlayer(_reason: "fallingRock" | "fallingDiamond" | "monsterContact" | "explosion"): void {
    if (this.state.gameOver) {
      return;
    }

    this.state.player.active = false;
    this.state.gameOver = true;
    this.playerMove = null;
    this.clearPlayerHeldMoveFrame();
  }

  /** Recharge le niveau courant apres la fin de la sequence d'explosion de mort prouvee. */
  private queueDeathResetAfterExplosions(): void {
    if (!this.state.gameOver || this.deathResetQueued || this.state.explosions.length > 0) {
      return;
    }

    this.deathResetQueued = true;
    if (this.gameplayMode === "attract") {
      this.queueAttractReturnToTitle();
      return;
    }

    this.context?.setScene(this.recreateLevelScene(this.levelNumber));
  }

  /** Avance le timing de decision d'une famille de monstres et demande de nouveaux mouvements quand necessaire. */
  private advanceMonsterRuntime(dt: number, kind: GameplayRuntimeMonsterKind): void {
    if (this.state.levelComplete) {
      return;
    }

    const elapsed = kind === "specialCreature"
      ? this.specialCreatureMoveElapsed + dt
      : this.standardMonsterMoveElapsed + dt;
    if (elapsed < MONSTER_MOVE_INTERVAL) {
      this.setMonsterMoveElapsed(kind, elapsed);
      return;
    }

    this.setMonsterMoveElapsed(kind, elapsed % MONSTER_MOVE_INTERVAL);

    for (const monster of this.state.monsters) {
      if (monster.kind !== kind) {
        continue;
      }

      this.advanceSingleMonsterRuntime(monster);
    }
  }

  /** Met a jour l'accumulateur de cadence de la famille de monstres demandee. */
  private setMonsterMoveElapsed(kind: GameplayRuntimeMonsterKind, elapsed: number): void {
    if (kind === "specialCreature") {
      this.specialCreatureMoveElapsed = elapsed;
      return;
    }

    this.standardMonsterMoveElapsed = elapsed;
  }

  /** Avance un monstre selon les regles de mouvement de patrouille originales. */
  private advanceSingleMonsterRuntime(monster: GameState["monsters"][number]): void {
    advanceSingleMonsterRuntimeSystem(monster, {
      getTile: (x, y) => this.hasPhysicalObjectAtGrid(x, y)
        ? RUNTIME_GRID_FILL_TILE_ID
        : this.runtimeGrid.getTile(x, y),
      setTile: (x, y, tileId) => this.runtimeMutations.setMonsterTile(x, y, tileId),
      runtimeBaseAddress: RUNTIME_GRID_BASE_ADDRESS,
      runtimeStride: RUNTIME_GRID_STRIDE,
      activeTileId: monster.kind === "specialCreature" ? RUNTIME_TILE.specialCreature : MONSTER_RUNTIME_ACTIVE_TILE_ID,
      trailTileId: MONSTER_RUNTIME_TRAIL_TILE_ID,
      moveDuration: getMonsterMoveDuration()
    });
  }

  /** Avance les mouvements actifs d'une famille de monstres et valide les pas termines. */
  private advanceMonsterMoves(dt: number, kind: GameplayRuntimeMonsterKind): void {
    if (this.state.levelComplete) {
      return;
    }

    for (const monster of this.state.monsters) {
      if (monster.kind !== kind) {
        continue;
      }

      if (!monster.movement) {
        continue;
      }

      monster.movement.elapsed += dt;
      if (monster.movement.elapsed >= monster.movement.duration) {
        this.clearCompletedMonsterTrail(monster);
        monster.movement = null;
      }
    }
  }

  /** Restaure la case quittee par un monstre quand la trace `0x80` n'est plus necessaire. */
  private clearCompletedMonsterTrail(monster: GameState["monsters"][number]): void {
    const movement = monster.movement;
    if (!movement) {
      return;
    }

    if (this.runtimeGrid.getTile(movement.fromX, movement.fromY) === MONSTER_RUNTIME_TRAIL_TILE_ID) {
      this.runtimeMutations.clearMonsterTrailTile(movement.fromX, movement.fromY);
    }
  }

  /** Indique si la sequence initiale de clignotement spawn est encore en cours. */
  private isPlayerSpawning(): boolean {
    return isPlayerSpawningSystem(
      this.spawnElapsed,
      PLAYER_SPAWN_BLINK_REPETITIONS,
      PLAYER_SPAWN_BLINK_STEP_DURATION
    );
  }

  /** Efface la tuile de bordure temporaire utilisee par le clignotement spawn. */
  private clearSpawnBlinkTileAfterSpawn(): void {
    if (this.spawnTileCleared || this.isPlayerSpawning()) {
      return;
    }

    const spawnGridX = Math.round(this.state.player.gridX);
    const spawnGridY = Math.round(this.state.player.gridY);
    this.runtimeMutations.clearSpawnBlinkTile(spawnGridX, spawnGridY);

    this.spawnTileCleared = true;
  }

  /** Retourne le tile id temporaire de spawn ou la frame noire du clignotement. */
  private getPlayerSpawnBlinkTileId(gridX: number, gridY: number): number | null | undefined {
    return getPlayerSpawnBlinkTileIdSystem(
      this.spawnElapsed,
      PLAYER_SPAWN_BLINK_STEP_DURATION,
      RUNTIME_GRID_FILL_TILE_ID,
      this.isPlayerSpawning(),
      this.isPlayerRenderedAtGrid(gridX, gridY)
    );
  }

  /** Indique si le sprite joueur couvre visuellement une cellule de grille. */
  private isPlayerRenderedAtGrid(gridX: number, gridY: number): boolean {
    return (
      Math.round(this.state.player.gridX) === gridX &&
      Math.round(this.state.player.gridY) === gridY
    );
  }

  /** Retourne la cellule gameplay discrete du joueur, independante de l'interpolation visuelle. */
  private getPlayerLogicalCell(): { readonly x: number; readonly y: number } {
    if (this.playerMove) {
      return {
        x: this.playerMove.toX,
        y: this.playerMove.toY
      };
    }

    return {
      x: Math.round(this.state.player.gridX),
      y: Math.round(this.state.player.gridY)
    };
  }

  /** Indique si le joueur occupe logiquement une cellule pour les decisions physiques. */
  private isPlayerLogicalAtGrid(gridX: number, gridY: number): boolean {
    const playerCell = this.getPlayerLogicalCell();
    return playerCell.x === gridX && playerCell.y === gridY;
  }

  /** Resout un tile-frame id par defaut pour un type d'entite non joueur. */
  private getEntityTileFrameId(kind: string): number {
    if (kind === "player") {
      const movingFrames = this.getPlayerDirectionalFrames();
      if (movingFrames) {
        return this.getPlayerMoveFrameId(movingFrames);
      }

      const playerAnimation = this.animationState.get("player");
      if (!playerAnimation) {
        return this.playerAnimationFrames[0];
      }

      return this.playerAnimationFrames[playerAnimation.frameIndex % this.playerAnimationFrames.length];
    }

    if (kind === "diamond") {
      const diamondAnimation = this.animationState.get("diamond");
      if (!diamondAnimation) {
        return this.diamondAnimationFrames[0];
      }

      return this.diamondAnimationFrames[diamondAnimation.frameIndex % this.diamondAnimationFrames.length];
    }

    if (kind === "monster") {
      const monsterAnimation = this.animationState.get("monster");
      if (!monsterAnimation) {
        return this.monsterAnimationFrames[0];
      }

      return this.monsterAnimationFrames[monsterAnimation.frameIndex % this.monsterAnimationFrames.length];
    }

    return 0;
  }

  /** Retourne le jeu de frames de marche correspondant a l'orientation joueur courante. */
  private getPlayerDirectionalFrames(): readonly number[] | null {
    if (!this.playerMove && this.playerFacing === "idle") {
      return null;
    }

    if (this.playerFacing === "left") {
      return this.playerMoveLeftFrames;
    }

    if (this.playerFacing === "right") {
      return this.playerMoveRightFrames;
    }

    return null;
  }

  /** Selectionne la frame de marche joueur courante dans un jeu de frames de mouvement. */
  private getPlayerMoveFrameId(frames: readonly number[]): number {
    if (frames.length === 0) {
      return this.playerAnimationFrames[0];
    }

    if (this.playerHeldMoveFrameId !== null) {
      return this.playerHeldMoveFrameId;
    }

    if (!this.playerMove) {
      return frames[0];
    }

    const frameIndex = Math.min(
      frames.length - 1,
      Math.floor(this.playerMove.elapsed / PLAYER_WALK_FRAME_DURATION)
    );
    return frames[frameIndex];
  }

  /** Avance une horloge d'animation cyclique nommee et retourne sa frame courante. */
  private advanceAnimation(
    animationKey: string,
    frames: readonly number[],
    frameDuration: number,
    dt: number
  ): void {
    if (frames.length <= 1 || frameDuration <= 0) {
      return;
    }

    const clock = this.animationState.get(animationKey);
    if (!clock) {
      return;
    }

    clock.accumulator += dt;
    while (clock.accumulator >= frameDuration) {
      clock.accumulator -= frameDuration;
      clock.frameIndex = (clock.frameIndex + 1) % frames.length;
    }
  }

  /** Recupere la frame d'atlas cachee pour un tile id de niveau standard. */
  private getTileFrame(tileId: number): TileFrame {
    return this.tileFrameCache.getTileFrame(this.getTileAtlasImage(), tileId);
  }

  /** Recupere la frame d'atlas animee courante pour les diamants du niveau. */
  private getDiamondTileFrame(): TileFrame {
    const diamondAnimation = this.animationState.get("diamond");
    const frameIndex = diamondAnimation
      ? diamondAnimation.frameIndex % this.diamondAnimationFrames.length
      : 0;
    if (!this.runtimeAssets.diamondAtlas) {
      return this.getTileFrame(DIAMOND_TILE_ID);
    }

    return this.tileFrameCache.getAtlasFrame(this.runtimeAssets.diamondAtlas, `diamond-${frameIndex}`, frameIndex);
  }

  /** Recupere la frame d'atlas animee courante du monstre. */
  private getMonsterTileFrame(): TileFrame {
    const monsterAnimation = this.animationState.get("monster");
    const frameIndex = monsterAnimation
      ? monsterAnimation.frameIndex % this.monsterAnimationFrames.length
      : 0;
    if (!this.runtimeAssets.monsterAtlas) {
      return this.getTileFrame(MONSTER_TILE_ID);
    }

    return this.tileFrameCache.getAtlasFrame(this.runtimeAssets.monsterAtlas, `monster-${frameIndex}`, frameIndex);
  }

  /** Recupere la frame d'atlas animee courante de la creature speciale. */
  private getSpecialCreatureTileFrame(): TileFrame {
    const frameIndex = (this.animationState.get("monster")?.frameIndex ?? 0) % 2;
    if (!this.runtimeAssets.specialCreatureAtlas) {
      return this.getTileFrame(RUNTIME_TILE.specialCreature);
    }

    return this.tileFrameCache.getAtlasFrame(
      this.runtimeAssets.specialCreatureAtlas,
      `special-creature-${frameIndex}`,
      frameIndex
    );
  }

  /** Retourne l'atlas de tuiles charge ou leve une erreur lisible utilisateur. */
  private getTileAtlasImage(): HTMLImageElement {
    return this.runtimeAssets.requireTileAtlas();
  }
}

/** Extrait les ids de frames d'animation depuis les metadata, avec fallback si les donnees sont incompletes. */
function extractFrameIdsFromMetadata(
  groupId: string,
  animationId: string,
  fallbackFrames: readonly number[]
): number[] {
  const animation = mineSpriteMetadata.groups
    .find((group) => group.id === groupId)
    ?.animations.find((item) => item.id === animationId);
  if (Array.isArray(animation?.frameTileIds) && animation.frameTileIds.length > 0) {
    return [...animation.frameTileIds];
  }

  return [...fallbackFrames];
}

/** Contraint une valeur numerique entre deux bornes inclusives. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Interpole lineairement entre deux valeurs numeriques. */
function lerp(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

/** Indique si deux cellules sont identiques ou adjacentes orthogonalement. */
function isAdjacentOrSameCell(firstX: number, firstY: number, secondX: number, secondY: number): boolean {
  return Math.abs(firstX - secondX) + Math.abs(firstY - secondY) <= 1;
}

/** Incremente un compteur decimal avec retour a zero selon le nombre de chiffres configure. */
function incrementBcdCounter(value: number, amount: number, digits: number): number {
  const maxValue = 10 ** digits;
  return (Math.max(0, Math.floor(value)) + Math.max(0, Math.floor(amount))) % maxValue;
}

/** Decremente un compteur decimal sans passer sous zero. */
function decrementBcdCounter(value: number, digits: number): number {
  const current = Math.max(0, Math.floor(value));
  if (current <= 0) {
    return 0;
  }

  const text = current.toString().padStart(digits, "0");
  const nextDigits = text.split("").map((digit) => Number.parseInt(digit, 10));
  for (let index = nextDigits.length - 1; index >= 0; index -= 1) {
    if (nextDigits[index] > 0) {
      nextDigits[index] -= 1;
      break;
    }

    nextDigits[index] = 9;
  }

  return Number.parseInt(nextDigits.join(""), 10);
}

