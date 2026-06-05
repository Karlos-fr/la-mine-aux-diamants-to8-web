/**
 * Role: Orchestre la scene gameplay principale du portage moderne.
 * Scope: Coordonne input, systems runtime, camera, rendu, HUD, chargement assets et navigation de niveau.
 * ISO: La logique discrete reste en cellules de grille TO8 et s'appuie sur les tile ids runtime prouves.
 * Notes: Cette scene reste volontairement orchestratrice; les systems/renderers portent les details specialises.
 */

import { TO8_PALETTE } from "../assets/palette";
import type { InputState } from "../engine/input";
import type { Renderer } from "../engine/renderer";
import type { EntityState, FallingObjectRuntimeState, GameState } from "../game/types";
import type { Scene, SceneContext } from "../engine/scene";
import { createGameLevelState } from "../game/state";
import { LevelRuntimeGrid } from "../game/runtime-grid";
import { drainRuntimeEvents, emitRuntimeEvent } from "../game/runtime-events";
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
  canPlayerEnterTile as canPlayerEnterTileSystem,
  getPlayerArrivalEffect as getPlayerArrivalEffectSystem,
  resolvePressedPlayerMove,
  type PlayerMoveResolution,
  type RuntimeTileArrivalEffect
} from "../game/systems/player-system";
import {
  getPlayerSpawnBlinkTileId as getPlayerSpawnBlinkTileIdSystem,
  isPlayerSpawning as isPlayerSpawningSystem
} from "../game/systems/spawn-system";
import { loadImage } from "../engine/image-loader";
import type { TileFrame } from "../engine/render-types";
import { mineSpriteMetadata } from "../assets/generated/mine-sprites";
import { getInterpolatedFallingObjectGridPosition, isEntityGridPositionVisible } from "../rendering/entity-renderer";
import { drawHudSmallCounter, drawHudTextFields } from "../rendering/hud-renderer";
import { getGridCellScreenPosition } from "../rendering/level-renderer";
import { RUNTIME_ASSET_URLS } from "../assets/runtime-assets";
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
  readonly columns: number;
  /** Nombre de lignes visibles. */
  readonly rows: number;
}

/** Mouvement fluide entre deux cellules de grille. */
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
  /** Temps ecoule dans l'interpolation. */
  elapsed: number;
  /** Duree totale de l'interpolation. */
  readonly duration: number;
}

/** Alias semantique pour les mouvements interpoles de camera. */
type CameraMoveState = GridMoveState;
/** Hauteur en pixels de la zone de jeu au-dessus du HUD. */
const PLAYFIELD_HEIGHT = 160;
/** Taille de rendu d'une tuile TO8. */
const RENDER_TILE_SIZE = 16;
/** Nombre de colonnes visibles dans la fenetre niveau. */
const VIEWPORT_COLUMNS = 20;
/** Nombre de lignes visibles dans la fenetre niveau. */
const VIEWPORT_ROWS = 10;
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
/** Nombre de repetitions tile/noir avant apparition joueur. */
const PLAYER_SPAWN_BLINK_REPETITIONS = 4;
/** Duree d'un demi-pas de blink spawn. */
const PLAYER_SPAWN_BLINK_STEP_DURATION = 0.25;
/** Duree moderne du mouvement joueur fluide d'une cellule. */
const PLAYER_GRID_MOVE_DURATION = 0.21;
/** Duree d'une frame de marche pendant un pas joueur. */
const PLAYER_WALK_FRAME_DURATION = PLAYER_GRID_MOVE_DURATION / 3;
/** Maintien court de la derniere frame de marche apres l'arrivee. */
const PLAYER_WALK_FINAL_FRAME_HOLD_DURATION = PLAYER_WALK_FRAME_DURATION;
/** Duree d'interpolation camera alignee sur le joueur. */
const CAMERA_GRID_MOVE_DURATION = PLAYER_GRID_MOVE_DURATION;
/** Intervalle de decision des monstres. */
const MONSTER_MOVE_INTERVAL = 0.28;
/** Duree d'interpolation d'un pas monstre. */
const MONSTER_GRID_MOVE_DURATION = 0.18;
/** Intervalle de scan des rochers/diamants prets a tomber. */
const FALLING_OBJECT_SCAN_INTERVAL = 0.16;
/** Duree d'interpolation d'un objet physique. */
const FALLING_OBJECT_GRID_MOVE_DURATION = 0.18;
/** Tile runtime temporaire du monstre actif. */
const MONSTER_RUNTIME_ACTIVE_TILE_ID = RUNTIME_TILE.monsterActive;
/** Trace runtime de monstre, traitee comme vide par plusieurs systems. */
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
/** Tile id vide. */
const RUNTIME_EMPTY_TILE_ID = RUNTIME_TILE.empty;
/** Tile id plateforme solide. */
const PLATFORM_TILE_ID = RUNTIME_TILE.platform;
/** Duree en secondes d'un tick compteur temps HUD. */
const HUD_TIMER_TICK_SECONDS = 1;
/** Couleur orange du panneau HUD extraite/reproduite. */
const HUD_PANEL_ORANGE = "#ef9300";
/** Position X du panneau galerie. */
const HUD_RIGHT_PANEL_X = 256;
/** Position Y des panneaux HUD. */
const HUD_RIGHT_PANEL_Y = PLAYFIELD_HEIGHT;
/** Position Y des compteurs du panneau galerie. */
const HUD_RIGHT_COUNTER_Y = HUD_RIGHT_PANEL_Y + 20;
/** Position X du compteur galerie. */
const HUD_GALLERY_COUNTER_X = HUD_RIGHT_PANEL_X;
/** Position X du diamant anime du panneau galerie. */
const HUD_GALLERY_DIAMOND_X = HUD_RIGHT_PANEL_X + 16;
/** Position Y du diamant anime du panneau galerie. */
const HUD_GALLERY_DIAMOND_Y = HUD_RIGHT_PANEL_Y + 16;
/** Position X du compteur diamants restants. */
const HUD_DIAMOND_COUNTER_X = HUD_RIGHT_PANEL_X + 40;
/** Font des petits compteurs de panneau. */
const HUD_SMALL_COUNTER_FONT_ID = "hud-digits-7";
/** Couleur bleue des petits compteurs. */
const HUD_SMALL_COUNTER_COLOR = "#0048ff";
/** Largeur effacee derriere les petits compteurs. */
const HUD_SMALL_COUNTER_WIDTH = 16;
/** Hauteur effacee derriere les petits compteurs. */
const HUD_SMALL_COUNTER_HEIGHT = 8;
/** Font des libelles HUD principaux. */
const HUD_LABEL_FONT_ID = "hud-large-16";
/** Font des valeurs HUD principales. */
const HUD_VALUE_FONT_ID = "hud-small-11";
/** Couleur des libelles HUD principaux. */
const HUD_LABEL_COLOR = "#f5f5f5";
/** Couleur cyan des valeurs HUD principales. */
const HUD_VALUE_COLOR = "#00d8d8";
/** Position X des libelles HUD principaux. */
const HUD_LABELS_X = 72;
/** Position Y des libelles HUD principaux. */
const HUD_LABELS_Y = 160;
/** Position X du score. */
const HUD_SCORE_X = 72;
/** Position X du temps. */
const HUD_TIME_X = 144;
/** Position X du record. */
const HUD_RECORD_X = 192;
/** Position Y des valeurs HUD principales. */
const HUD_VALUES_Y = 177;
/** Largeur du diamant anime du panneau galerie. */
const HUD_GALLERY_DIAMOND_WIDTH = 24;
/** Hauteur du diamant anime du panneau galerie. */
const HUD_GALLERY_DIAMOND_HEIGHT = 16;
/** Frames couleur du diamant HUD, animees par decalage de lignes. */
const HUD_GALLERY_DIAMOND_ANIMATION_FRAMES = Array.from({ length: HUD_GALLERY_DIAMOND_HEIGHT }, (_, index) => index);
/** Dernier niveau actuellement disponible. */
const LAST_LEVEL_NUMBER = 16;

/** Conversion des intensites 4 bits TO8 vers RGB 8 bits. */
const TO8_INTENSITIES = [
  0, 100, 127, 147, 163, 179, 191, 203,
  215, 223, 231, 239, 243, 247, 251, 255
] as const;

/** Palette RGB4 TO8 par defaut utilisee pour decoder les attributs HUD. */
const TO8_DEFAULT_RGB4 = [
  [0x0, 0x0, 0x0],
  [0xf, 0x0, 0x0],
  [0x0, 0xf, 0x0],
  [0xf, 0xf, 0x0],
  [0x0, 0x0, 0xf],
  [0xf, 0x0, 0xf],
  [0x0, 0xf, 0xf],
  [0xf, 0xf, 0xf],
  [0x7, 0x7, 0x7],
  [0xa, 0x3, 0x3],
  [0x3, 0xa, 0x3],
  [0xa, 0xa, 0x3],
  [0x3, 0x3, 0xa],
  [0xa, 0x3, 0xa],
  [0x7, 0xe, 0xe],
  [0xb, 0x3, 0x0]
] as const;

/** Plan de forme du diamant affiche dans le panneau galerie. */
const HUD_GALLERY_DIAMOND_SHAPE_BLOCKS = [
  [
    [0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x03, 0x07],
    [0x08, 0x1c, 0x3e, 0x7f, 0xff, 0xff, 0xff, 0xff],
    [0x00, 0x00, 0x00, 0x00, 0x80, 0xc0, 0xe0, 0xf0]
  ],
  [
    [0x07, 0x03, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00],
    [0xff, 0xff, 0xff, 0xff, 0x7f, 0x3e, 0x1c, 0x08],
    [0xf0, 0xe0, 0xc0, 0x80, 0x00, 0x00, 0x00, 0x00]
  ]
] as const;

/** Lignes de couleurs du diamant de panneau galerie. */
const HUD_GALLERY_DIAMOND_COLOR_ROWS = [
  0x4f, 0x4f, 0x1f, 0x1f, 0x5f, 0x5f, 0x5f, 0x5f,
  0x37, 0x37, 0x77, 0x77, 0x27, 0x27, 0x67, 0x67
] as const;

export class GameplayScene implements Scene {
  /** Contexte de navigation fourni par le routeur de scenes. */
  private context: SceneContext | undefined;
  /** Etat gameplay mutable du niveau courant. */
  private readonly state: GameState;
  /** Numero de niveau courant, utilise pour HUD et transition. */
  private readonly levelNumber: number;
  /** Grille runtime mutable qui fait autorite pour la logique discrete. */
  private readonly runtimeGrid: LevelRuntimeGrid;
  /** Factory injectee pour creer la scene du niveau suivant sans cycle d'import. */
  private readonly createNextLevelScene: (currentLevelNumber: number) => Scene;
  /** Cache de frames issues des atlas gameplay. */
  private readonly tileFrameCache = new TileFrameCache({
    sourceSize: RENDER_TILE_SIZE,
    renderSize: RENDER_TILE_SIZE
  });
  /** Taille source d'une tuile dans les atlas. */
  private readonly tileSourceSize = RENDER_TILE_SIZE;
  /** Taille de rendu d'une tuile a l'ecran. */
  private readonly tileSize = RENDER_TILE_SIZE;
  /** Decalage horizontal de la zone de jeu. */
  private readonly boardOffsetX = 0;
  /** Decalage vertical de la zone de jeu. */
  private readonly boardOffsetY = 0;
  /** Viewport logique courant sur le niveau global. */
  private readonly viewport: ViewportState = {
    x: INITIAL_VIEWPORT_X,
    y: INITIAL_VIEWPORT_Y,
    columns: VIEWPORT_COLUMNS,
    rows: VIEWPORT_ROWS
  };
  /** Largeur totale du niveau courant en cellules. */
  private readonly levelWidth: number;
  /** Hauteur totale du niveau courant en cellules. */
  private readonly levelHeight: number;
  /** Frames d'idle joueur issues des metadata avec fallback. */
  private readonly playerAnimationFrames = extractFrameIdsFromMetadata("player", "idleCycle", [8, 8, 7, 8, 9]);
  /** Frames de marche vers la droite. */
  private readonly playerMoveRightFrames = extractFrameIdsFromMetadata("player", "moveRight", [0x0c, 0x0d, 0x0e]);
  /** Frames de marche vers la gauche. */
  private readonly playerMoveLeftFrames = extractFrameIdsFromMetadata("player", "moveLeft", [0x0f, 0x10, 0x11]);
  /** Frames du cycle couleur diamant. */
  private readonly diamondAnimationFrames = extractFrameIdsFromMetadata("diamond", "colorCycle", [3, 3, 3, 3, 3, 3, 3, 3]);
  /** Frames de clignotement monstre. */
  private readonly monsterAnimationFrames = extractFrameIdsFromMetadata("monster", "blinkToggle", [2, 2]);
  /** Durees de frames par animation. */
  private readonly animationDurations = {
    player: 1 / 8,
    diamond: 1 / 8,
    monster: 1 / 4,
    hudDiamond: 1 / 8
  };
  /** Horloges d'animation indexees par cle. */
  private readonly animationState = new Map<string, AnimationClock>();
  /** Temps ecoule depuis le debut du spawn joueur. */
  private spawnElapsed = 0;
  /** Indique si la tuile temporaire de spawn a ete nettoyee. */
  private spawnTileCleared = false;
  /** Accumulateur du pas runtime monstre. */
  private monsterMoveElapsed = 0;
  /** Accumulateur de scan des objets physiques. */
  private fallingObjectScanElapsed = 0;
  /** Accumulateur du decrement de temps HUD. */
  private hudTimeAccumulator = 0;
  /** Mouvement joueur actuellement interpole. */
  private playerMove: GridMoveState | null = null;
  /** Frame de marche maintenue apres arrivee. */
  private playerHeldMoveFrameId: number | null = null;
  /** Temps de maintien de la frame de marche finale. */
  private playerHeldMoveFrameElapsed = 0;
  /** Mouvement camera actuellement interpole. */
  private cameraMove: CameraMoveState | null = null;
  /** Direction visuelle courante du joueur. */
  private playerFacing: "idle" | "left" | "right" = "idle";
  /** Derniere direction horizontale, reutilisee pour haut/bas. */
  private lastHorizontalFacing: "left" | "right" = "right";
  /** Cellules deja nettoyees via evenement pendant le tick courant. */
  private readonly mutatedRuntimeTilesThisTick = new Set<string>();
  /** Atlas principal des tuiles. */
  private atlasImage: HTMLImageElement | null = null;
  /** Atlas anime des diamants. */
  private diamondAtlasImage: HTMLImageElement | null = null;
  /** Atlas anime des monstres. */
  private monsterAtlasImage: HTMLImageElement | null = null;
  /** Panneau HUD gauche charge. */
  private leftHudPanelImage: HTMLImageElement | null = null;
  /** Panneau HUD droit charge. */
  private rightHudPanelImage: HTMLImageElement | null = null;
  /** Derniere erreur de chargement d'atlas/panneau. */
  private atlasError: string | null = null;
  /** Garde-fou pour ne demander la transition de niveau qu'une fois. */
  private levelTransitionQueued = false;

  /** Initialise l'etat runtime, la grille et les horloges d'animation du niveau. */
  constructor(levelNumber: number, createNextLevelScene: (currentLevelNumber: number) => Scene) {
    this.levelNumber = levelNumber;
    this.createNextLevelScene = createNextLevelScene;
    this.state = createGameLevelState(levelNumber);
    this.runtimeGrid = new LevelRuntimeGrid(
      this.state.level.tiles,
      this.state.level.width,
      this.state.level.height,
      RUNTIME_GRID_STRIDE,
      RUNTIME_GRID_FILL_TILE_ID
    );
    this.levelWidth = this.state.level.width;
    this.levelHeight = this.state.level.height;
    this.animationState.set("player", { frameIndex: 0, accumulator: 0 });
    this.animationState.set("diamond", { frameIndex: 0, accumulator: 0 });
    this.animationState.set("monster", { frameIndex: 0, accumulator: 0 });
    this.animationState.set("hudDiamond", { frameIndex: 0, accumulator: 0 });
    void this.loadAtlas();
    void this.loadHudPanels();
  }

  /** Recupere le contexte de navigation de scene. */
  enter(context: SceneContext): void {
    this.context = context;
  }

  /** Charge les atlas gameplay obligatoires. */
  private async loadAtlas(): Promise<void> {
    try {
      const [tileAtlas, diamondAtlas, monsterAtlas] = await Promise.all([
        loadImage(RUNTIME_ASSET_URLS.tilesAtlas),
        loadImage(RUNTIME_ASSET_URLS.diamondAtlas),
        loadImage(RUNTIME_ASSET_URLS.monsterAtlas)
      ]);
      this.atlasImage = tileAtlas;
      this.diamondAtlasImage = diamondAtlas;
      this.monsterAtlasImage = monsterAtlas;
    } catch (error) {
      this.atlasError = error instanceof Error ? error.message : String(error);
    }
  }

  /** Charge les panneaux HUD extraits. */
  private async loadHudPanels(): Promise<void> {
    try {
      const [leftPanel, rightPanel] = await Promise.all([
        loadImage(RUNTIME_ASSET_URLS.hudLeftPanel),
        loadImage(RUNTIME_ASSET_URLS.hudRightPanel)
      ]);
      this.leftHudPanelImage = leftPanel;
      this.rightHudPanelImage = rightPanel;
    } catch (error) {
      this.atlasError = error instanceof Error ? error.message : String(error);
    }
  }

  /** Orchestre un tick gameplay complet sans effectuer de rendu. */
  update(dt: number, input: InputState): void {
    this.mutatedRuntimeTilesThisTick.clear();
    const playerSpawning = this.isPlayerSpawning();

    this.spawnElapsed += dt;
    this.clearSpawnBlinkTileAfterSpawn();
    this.advanceHudCounters(dt, playerSpawning);

    if (this.playerMove) {
      this.advancePlayerMove(dt);
    } else if (!playerSpawning) {
      this.advancePlayerHeldMoveFrame(dt);
      const { x: moveX, y: moveY } = resolvePressedPlayerMove(input.pressed);
      if (moveX !== 0 || moveY !== 0) {
        const fromX = Math.round(this.state.player.gridX);
        const fromY = Math.round(this.state.player.gridY);
        const toX = fromX + moveX;
        const toY = fromY + moveY;
        const targetRuntimeX = toX;
        const targetRuntimeY = toY;
        const collision = this.resolvePlayerMove(targetRuntimeX, targetRuntimeY);

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
          this.playerMove = {
            fromX,
            fromY,
            toX,
            toY,
            arrivalEffect: collision.arrivalEffect,
            elapsed: 0,
            duration: PLAYER_GRID_MOVE_DURATION
          };
        }
      }
    }
    this.advanceCameraMove(dt);

    this.state.player.x = this.state.player.gridX * this.state.level.tileSize;
    this.state.player.y = this.state.player.gridY * this.state.level.tileSize;
    this.advanceFallingObjects(dt);
    this.advanceMonsterRuntime(dt);
    this.advanceMonsterMoves(dt);
    this.syncMonsterEntitiesFromRuntimeState();
    this.consumeRuntimeEvents();

    this.advanceAnimation("player", this.playerAnimationFrames, this.animationDurations.player, dt);
    this.advanceAnimation("diamond", this.diamondAnimationFrames, this.animationDurations.diamond, dt);
    this.advanceAnimation("monster", this.monsterAnimationFrames, this.animationDurations.monster, dt);
    this.advanceAnimation(
      "hudDiamond",
      HUD_GALLERY_DIAMOND_ANIMATION_FRAMES,
      this.animationDurations.hudDiamond,
      dt
    );
  }

  /** Rend la scene gameplay dans l'ordre ISO: grille, objets/entites, HUD. */
  render(renderer: Renderer): void {
    renderer.clear(TO8_PALETTE.black);
    this.drawPlayfield(renderer);
    this.drawEntitiesAndObjects(renderer);
    this.drawHud(renderer);
  }

  /** Rend la grille visible du niveau courant. */
  private drawPlayfield(renderer: Renderer): void {
    if (!this.atlasImage) {
      return;
    }

    renderer.fillRect(0, 0, renderer.width, PLAYFIELD_HEIGHT, TO8_PALETTE.black);

    const renderViewportX = this.getRenderViewportX();
    const renderViewportY = this.getRenderViewportY();
    const baseLevelX = Math.floor(renderViewportX);
    const baseLevelY = Math.floor(renderViewportY);

    for (let y = 0; y < this.viewport.rows + 2; y += 1) {
      for (let x = 0; x < this.viewport.columns + 2; x += 1) {
        const levelX = baseLevelX + x;
        const levelY = baseLevelY + y;
        const screenPosition = getGridCellScreenPosition(
          levelX,
          levelY,
          { x: renderViewportX, y: renderViewportY, columns: this.viewport.columns, rows: this.viewport.rows },
          this.tileSize,
          this.boardOffsetX,
          this.boardOffsetY
        );
        const tileId = this.runtimeGrid.getTile(levelX, levelY);
        const isDynamicTile =
          tileId === MONSTER_TILE_ID ||
          tileId === DIAMOND_TILE_ID ||
          tileId === MONSTER_RUNTIME_ACTIVE_TILE_ID ||
          tileId === FALLING_ROCK_TILE_ID ||
          tileId === FALLING_DIAMOND_TILE_ID;
        const hasDynamicEntity = isDynamicTile && (
          this.findEntityAtGrid(levelX, levelY) !== null ||
          (tileId === MONSTER_RUNTIME_ACTIVE_TILE_ID && this.findMonsterRuntimeAtGrid(levelX, levelY) !== null)
        );
        const hasPlayerEntity = this.state.player.active && this.isPlayerRenderedAtGrid(levelX, levelY);
        const spawnBlinkTileId = this.getPlayerSpawnBlinkTileId(levelX, levelY);

        if (spawnBlinkTileId === null) {
          renderer.fillRect(
            screenPosition.x,
            screenPosition.y,
            this.tileSize,
            this.tileSize,
            TO8_PALETTE.black
          );
          continue;
        }

        const renderTileId =
          tileId === MONSTER_RUNTIME_TRAIL_TILE_ID || tileId === MONSTER_RUNTIME_ACTIVE_TILE_ID
            ? RUNTIME_EMPTY_TILE_ID
            : tileId === FALLING_ROCK_TILE_ID || tileId === FALLING_DIAMOND_TILE_ID
            ? RUNTIME_EMPTY_TILE_ID
            : tileId;
        const frame = this.getTileFrame(spawnBlinkTileId ?? renderTileId);
        if ((hasDynamicEntity || hasPlayerEntity) && spawnBlinkTileId === undefined) {
          continue;
        }

        renderer.drawTile(
          frame,
          screenPosition.x,
          screenPosition.y
        );
      }
    }
  }

  /** Rend les entites et objets physiques selon les couches actuelles. */
  private drawEntitiesAndObjects(renderer: Renderer): void {
    if (!this.atlasImage) {
      return;
    }

    this.drawEntitiesByLayer(renderer, false);
    this.drawFallingRockObjects(renderer);
    this.drawEntitiesByLayer(renderer, true);
  }

  /** Rend les rochers en chute avec interpolation visuelle. */
  private drawFallingRockObjects(renderer: Renderer): void {
    const renderViewportX = this.getRenderViewportX();
    const renderViewportY = this.getRenderViewportY();
    const cullViewportX = Math.floor(renderViewportX);
    const cullViewportY = Math.floor(renderViewportY);

    for (const fallingObject of this.state.fallingObjects) {
      if (fallingObject.kind !== "rock") {
        continue;
      }

      const progress = fallingObject.elapsed / fallingObject.duration;
      const { x: gridX, y: gridY } = getInterpolatedFallingObjectGridPosition(fallingObject, progress);
      if (
        gridX < cullViewportX - 1 ||
        gridX >= cullViewportX + this.viewport.columns + 2 ||
        gridY < cullViewportY - 1 ||
        gridY >= cullViewportY + this.viewport.rows + 2
      ) {
        continue;
      }

      renderer.drawTile(
        this.getTileFrame(ROCK_TILE_ID),
        Math.round(this.boardOffsetX + (gridX - renderViewportX) * this.tileSize),
        Math.round(this.boardOffsetY + (gridY - renderViewportY) * this.tileSize)
      );
    }
  }

  /** Rend les entites non joueur puis joueur selon la couche demandee. */
  private drawEntitiesByLayer(renderer: Renderer, playerLayer: boolean): void {
    for (const entity of this.state.entities) {
      if (!entity.active) {
        continue;
      }

      if ((entity.kind === "player") !== playerLayer) {
        continue;
      }

      if (entity.kind === "player" && this.isPlayerSpawning()) {
        continue;
      }

      if (entity.kind === "rock") {
        continue;
      }

      const renderViewportX = this.getRenderViewportX();
      const renderViewportY = this.getRenderViewportY();
      const cullViewportX = Math.floor(renderViewportX);
      const cullViewportY = Math.floor(renderViewportY);
      const entityGridX = entity.gridX;
      const entityGridY = entity.gridY;
      if (!isEntityGridPositionVisible(
        entityGridX,
        entityGridY,
        { x: cullViewportX, y: cullViewportY, columns: this.viewport.columns, rows: this.viewport.rows }
      )) {
        continue;
      }

      const frame = entity.kind === "diamond"
        ? this.getDiamondTileFrame()
        : entity.kind === "monster"
          ? this.getMonsterTileFrame()
          : this.getTileFrame(this.getEntityTileFrameId(entity.kind));
      renderer.drawTile(
        frame,
        Math.round(this.boardOffsetX + (entityGridX - renderViewportX) * this.tileSize),
        Math.round(this.boardOffsetY + (entityGridY - renderViewportY) * this.tileSize)
      );
    }
  }

  /** Finds the first active visual entity occupying the given grid cell. */
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

  /** Finds the runtime monster occupying the given grid cell. */
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

  /** Returns whether an entity covers the given grid cell after runtime offsets. */
  private isEntityAtGrid(entity: EntityState, gridX: number, gridY: number): boolean {
    return Math.round(entity.gridX) === gridX && Math.round(entity.gridY) === gridY;
  }

  /** Advances the smooth player step currently in progress. */
  private advancePlayerMove(dt: number): void {
    if (!this.playerMove) {
      return;
    }

    this.playerMove.elapsed += dt;
    const progress = clamp(this.playerMove.elapsed / this.playerMove.duration, 0, 1);
    const easedProgress = smoothStep(progress);
    this.state.player.gridX = lerp(this.playerMove.fromX, this.playerMove.toX, easedProgress);
    this.state.player.gridY = lerp(this.playerMove.fromY, this.playerMove.toY, easedProgress);

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

  /** Keeps the walking frame cycling while a direction key remains held. */
  private advancePlayerHeldMoveFrame(dt: number): void {
    if (this.playerHeldMoveFrameId === null) {
      return;
    }

    this.playerHeldMoveFrameElapsed += dt;
    if (this.playerHeldMoveFrameElapsed >= PLAYER_WALK_FINAL_FRAME_HOLD_DURATION) {
      this.clearPlayerHeldMoveFrame();
    }
  }

  /** Holds the last walking frame when continuous movement is about to continue. */
  private holdPlayerFinalMoveFrame(): void {
    const frames = this.getPlayerDirectionalFrames();
    if (!frames || frames.length === 0) {
      return;
    }

    this.playerHeldMoveFrameId = frames[frames.length - 1];
    this.playerHeldMoveFrameElapsed = 0;
  }

  /** Clears the held walking frame when directional input stops. */
  private clearPlayerHeldMoveFrame(): void {
    this.playerHeldMoveFrameId = null;
    this.playerHeldMoveFrameElapsed = 0;
  }

  /** Starts a smooth camera scroll when the player crosses the ASM viewport margin. */
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
      moveDuration: CAMERA_GRID_MOVE_DURATION
    }) ?? this.cameraMove;
  }

  /** Advances the camera interpolation toward its target viewport origin. */
  private advanceCameraMove(dt: number): void {
    this.cameraMove = advanceCameraMoveSystem(this.cameraMove, dt);
  }

  /** Returns the interpolated viewport X used for rendering. */
  private getRenderViewportX(): number {
    return getRenderViewportXSystem(this.viewport, this.cameraMove);
  }

  /** Returns the interpolated viewport Y used for rendering. */
  private getRenderViewportY(): number {
    return getRenderViewportYSystem(this.viewport, this.cameraMove);
  }

  /** Resolves whether the player can enter a target cell and which arrival effect applies. */
  private resolvePlayerMove(gridX: number, gridY: number): PlayerMoveResolution {
    if (gridX < 0 || gridY < 0) {
      return {
        canEnter: false,
        tileId: RUNTIME_GRID_FILL_TILE_ID,
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

  /** Maps a runtime tile id to the effect triggered after player arrival. */
  private getPlayerArrivalEffect(tileId: number): RuntimeTileArrivalEffect {
    return getPlayerArrivalEffectSystem(tileId, this.getPlayerCollisionTiles());
  }

  /** Returns whether the player can enter the runtime tile. */
  private canPlayerEnterTile(tileId: number): boolean {
    return canPlayerEnterTileSystem(tileId, this.getPlayerCollisionTiles());
  }

  /** Returns runtime tile ids that block the player's movement. */
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
      platform: PLATFORM_TILE_ID
    };
  }

  /** Applies grass digging, diamond collection, or exit completion after arrival. */
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
    }
  }

  /** Writes a runtime tile mutation and records it for same-tick systems. */
  private setTile(gridX: number, gridY: number, tileId: number): void {
    this.runtimeGrid.setTile(gridX, gridY, tileId);
  }

  /** Clears a runtime tile, optionally emitting the gameplay tile-cleared event. */
  private clearRuntimeTile(gridX: number, gridY: number, emitEvent = true): void {
    if (emitEvent && !this.markRuntimeTileMutation(gridX, gridY)) {
      return;
    }

    this.setTile(gridX, gridY, RUNTIME_EMPTY_TILE_ID);
    if (emitEvent) {
      emitRuntimeEvent(this.state, {
        type: "tileCleared",
        gridX,
        gridY
      });
    }
  }

  /** Removes a diggable runtime tile from the level grid. */
  private digRuntimeTile(gridX: number, gridY: number): void {
    this.clearRuntimeTile(gridX, gridY);
  }

  /** Removes a runtime diamond tile and emits score/progression data. */
  private collectRuntimeDiamond(gridX: number, gridY: number): void {
    this.clearRuntimeTile(gridX, gridY);
    this.deactivateEntityAtGrid("diamond", gridX, gridY);
    emitRuntimeEvent(this.state, {
      type: "diamondCollected",
      gridX,
      gridY,
      score: this.state.level.meta.scoreStep
    });
  }

  /** Advances falling-object scans and active smooth falling animations. */
  private advanceFallingObjects(dt: number): void {
    this.advanceActiveFallingObjects(dt);

    this.fallingObjectScanElapsed += dt;
    if (this.fallingObjectScanElapsed < FALLING_OBJECT_SCAN_INTERVAL) {
      return;
    }

    this.fallingObjectScanElapsed %= FALLING_OBJECT_SCAN_INTERVAL;
    this.startReadyFallingObjects();
  }

  /** Advances objects already falling toward their destination cells. */
  private advanceActiveFallingObjects(dt: number): void {
    for (let index = this.state.fallingObjects.length - 1; index >= 0; index -= 1) {
      const fallingObject = this.state.fallingObjects[index];
      fallingObject.elapsed += dt;
      this.syncFallingObjectEntity(fallingObject);

      if (fallingObject.elapsed < fallingObject.duration) {
        continue;
      }

      this.completeFallingObject(fallingObject);
      this.state.fallingObjects.splice(index, 1);
    }
  }

  /** Scans the runtime grid and starts eligible rock or diamond falls. */
  private startReadyFallingObjects(): void {
    for (let y = this.levelHeight - 2; y >= 0; y -= 1) {
      for (let x = 0; x < this.levelWidth; x += 1) {
        const tileId = this.runtimeGrid.getTile(x, y);
        if (!this.isPhysicalFallingTile(tileId)) {
          continue;
        }

        const target = this.resolveFallingObjectTarget(x, y);
        if (!target) {
          continue;
        }

        this.startFallingObject(x, y, target.x, target.y, tileId);
      }
    }
  }

  /** Resolves the next falling target using vertical fall and side-roll rules. */
  private resolveFallingObjectTarget(
    gridX: number,
    gridY: number
  ): { readonly x: number; readonly y: number } | null {
    return resolveFallingObjectTargetSystem({
      gridX,
      gridY,
      playerGridX: Math.round(this.state.player.gridX),
      getTile: (x, y) => this.runtimeGrid.getTile(x, y),
      canMoveTo: (x, y) => this.canFallingObjectMoveTo(x, y),
      isStaticFallingObjectTile: (tileId) => this.isFallingObjectStaticTile(tileId),
      isClearanceCellEmpty: (x, y) => this.isFallingObjectClearanceCellEmpty(x, y)
    });
  }

  /** Returns whether a side-roll clearance cell is empty enough for falling physics. */
  private isFallingObjectClearanceCellEmpty(gridX: number, gridY: number): boolean {
    return (
      this.isFallingObjectEmptyRuntimeTile(this.runtimeGrid.getTile(gridX, gridY)) &&
      !this.hasFallingObjectAtGrid(gridX, gridY) &&
      !this.isPlayerRenderedAtGrid(gridX, gridY)
    );
  }

  /** Returns whether a static tile can support side-roll falling rules. */
  private isFallingObjectStaticTile(tileId: number): boolean {
    return tileId === ROCK_TILE_ID || tileId === DIAMOND_TILE_ID;
  }

  /** Returns whether a falling object may occupy the target cell. */
  private canFallingObjectMoveTo(gridX: number, gridY: number): boolean {
    return (
      this.isFallingObjectEmptyRuntimeTile(this.runtimeGrid.getTile(gridX, gridY)) &&
      !this.hasFallingObjectAtGrid(gridX, gridY) &&
      !this.isPlayerRenderedAtGrid(gridX, gridY)
    );
  }

  /** Returns whether a runtime tile is empty for falling-object movement. */
  private isFallingObjectEmptyRuntimeTile(tileId: number): boolean {
    return tileId === RUNTIME_EMPTY_TILE_ID || tileId === MONSTER_RUNTIME_TRAIL_TILE_ID;
  }

  /** Starts a smooth falling-object move and updates the runtime grid immediately. */
  private startFallingObject(fromX: number, fromY: number, toX: number, toY: number, tileId: number): void {
    const kind = tileId === DIAMOND_TILE_ID || tileId === FALLING_DIAMOND_TILE_ID ? "diamond" : "rock";
    const movingTileId = kind === "diamond" ? FALLING_DIAMOND_TILE_ID : FALLING_ROCK_TILE_ID;
    const entity = kind === "diamond" ? this.findEntityKindAtGrid("diamond", fromX, fromY) : null;
    const fallingObject: FallingObjectRuntimeState = {
      id: `falling-${kind}-${fromX}-${fromY}-${Date.now()}`,
      kind,
      tileId: kind === "diamond" ? DIAMOND_TILE_ID : ROCK_TILE_ID,
      movingTileId,
      entityId: entity?.id,
      fromX,
      fromY,
      toX,
      toY,
      elapsed: 0,
      duration: FALLING_OBJECT_GRID_MOVE_DURATION
    };

    this.clearRuntimeTile(fromX, fromY, false);
    this.setTile(toX, toY, movingTileId);
    this.state.fallingObjects.push(fallingObject);
  }

  /** Finalizes a falling object once its smooth movement reaches the destination. */
  private completeFallingObject(fallingObject: FallingObjectRuntimeState): void {
    this.setTile(fallingObject.toX, fallingObject.toY, fallingObject.tileId);

    if (fallingObject.entityId) {
      const entity = this.state.entities.find((item) => item.id === fallingObject.entityId);
      if (entity) {
        entity.gridX = fallingObject.toX;
        entity.gridY = fallingObject.toY;
        entity.x = entity.gridX * this.state.level.tileSize;
        entity.y = entity.gridY * this.state.level.tileSize;
      }
    }
  }

  /** Synchronizes the visual entity matching a falling runtime tile. */
  private syncFallingObjectEntity(fallingObject: FallingObjectRuntimeState): void {
    if (!fallingObject.entityId) {
      return;
    }

    const entity = this.state.entities.find((item) => item.id === fallingObject.entityId);
    if (!entity) {
      return;
    }

    const progress = clamp(fallingObject.elapsed / fallingObject.duration, 0, 1);
    const easedProgress = smoothStep(progress);
    entity.gridX = lerp(fallingObject.fromX, fallingObject.toX, easedProgress);
    entity.gridY = lerp(fallingObject.fromY, fallingObject.toY, easedProgress);
    entity.x = entity.gridX * this.state.level.tileSize;
    entity.y = entity.gridY * this.state.level.tileSize;
  }

  /** Returns whether the tile participates in rock/diamond gravity. */
  private isPhysicalFallingTile(tileId: number): boolean {
    return tileId === ROCK_TILE_ID || tileId === DIAMOND_TILE_ID;
  }

  /** Returns whether an active falling object already targets or occupies the cell. */
  private hasFallingObjectAtGrid(gridX: number, gridY: number): boolean {
    return this.state.fallingObjects.some((fallingObject) =>
      (fallingObject.fromX === gridX && fallingObject.fromY === gridY) ||
      (fallingObject.toX === gridX && fallingObject.toY === gridY)
    );
  }

  /** Opens the level exit when the diamond objective is completed. */
  private updateLevelExitStateAfterDiamondCollection(): void {
    if (this.state.hud.diamonds === 0) {
      this.state.exitOpen = true;
      emitRuntimeEvent(this.state, {
        type: "exitOpened",
        gridX: this.state.level.exit.x,
        gridY: this.state.level.exit.y
      });
    }
  }

  /** Applies side effects produced by the decoupled runtime event queue. */
  private consumeRuntimeEvents(): void {
    for (const event of drainRuntimeEvents(this.state)) {
      if (event.type === "diamondCollected") {
        this.incrementScore(event.score);
        this.state.hud.diamonds = Math.max(0, this.state.hud.diamonds - 1);
        this.updateLevelExitStateAfterDiamondCollection();
        continue;
      }

      if (event.type === "levelCompleted") {
        this.state.levelComplete = true;
        this.queueNextLevelTransition();
      }
    }
  }

  /** Records a runtime-grid mutation and returns whether it is new this tick. */
  private markRuntimeTileMutation(gridX: number, gridY: number): boolean {
    const key = `${gridX}:${gridY}`;
    if (this.mutatedRuntimeTilesThisTick.has(key)) {
      return false;
    }

    this.mutatedRuntimeTilesThisTick.add(key);
    return true;
  }

  /** Returns whether the given cell is the currently opened exit. */
  private isOpenExitCell(gridX: number, gridY: number): boolean {
    return isOpenExitCellSystem(
      this.state.exitOpen,
      this.state.level.exit.x,
      this.state.level.exit.y,
      gridX,
      gridY
    );
  }

  /** Queues the next-level transition once the player reaches an open exit. */
  private queueNextLevelTransition(): void {
    if (this.levelTransitionQueued) {
      return;
    }

    this.levelTransitionQueued = true;
    if (this.levelNumber < LAST_LEVEL_NUMBER) {
      this.context?.setScene(this.createNextLevelScene(this.levelNumber));
    }
  }

  /** Advances time, score, and panel counters on the HUD. */
  private advanceHudCounters(dt: number, playerSpawning: boolean): void {
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

  /** Increments the current BCD-like score counter by a gameplay reward. */
  private incrementScore(amount: number): void {
    this.state.hud.score = incrementBcdCounter(this.state.hud.score, amount, 6);
    this.state.hud.record = Math.max(this.state.hud.record, this.state.hud.score);
  }

  /** Deactivates the first entity of a kind found at the given grid cell. */
  private deactivateEntityAtGrid(kind: EntityState["kind"], gridX: number, gridY: number): void {
    const entity = this.findEntityKindAtGrid(kind, gridX, gridY);

    if (entity) {
      entity.active = false;
    }
  }

  /** Finds the first active entity of a kind at the given grid cell. */
  private findEntityKindAtGrid(kind: EntityState["kind"], gridX: number, gridY: number): EntityState | null {
    return this.state.entities.find((item) =>
      item.kind === kind &&
      item.active &&
      Math.round(item.gridX) === gridX &&
      Math.round(item.gridY) === gridY
    ) ?? null;
  }

  /** Mirrors runtime monster positions into their visual entity records. */
  private syncMonsterEntitiesFromRuntimeState(): void {
    for (const monster of this.state.monsters) {
      const entity = this.state.entities.find((item) => item.id === monster.entityId);
      if (!entity) {
        continue;
      }

      entity.gridX = monster.gridX;
      entity.gridY = monster.gridY;
      if (monster.movement) {
        const progress = clamp(monster.movement.elapsed / monster.movement.duration, 0, 1);
        const easedProgress = smoothStep(progress);
        entity.gridX = lerp(monster.movement.fromX, monster.movement.toX, easedProgress);
        entity.gridY = lerp(monster.movement.fromY, monster.movement.toY, easedProgress);
      }

      entity.x = entity.gridX * this.state.level.tileSize;
      entity.y = entity.gridY * this.state.level.tileSize;
    }
  }

  /** Advances monster decision timing and requests new moves when due. */
  private advanceMonsterRuntime(dt: number): void {
    this.monsterMoveElapsed += dt;
    if (this.monsterMoveElapsed < MONSTER_MOVE_INTERVAL) {
      return;
    }

    this.monsterMoveElapsed %= MONSTER_MOVE_INTERVAL;

    for (const monster of this.state.monsters) {
      this.advanceSingleMonsterRuntime(monster);
    }
  }

  /** Advances one monster according to the original patrol-style movement rules. */
  private advanceSingleMonsterRuntime(monster: GameState["monsters"][number]): void {
    advanceSingleMonsterRuntimeSystem(monster, {
      getTile: (x, y) => this.runtimeGrid.getTile(x, y),
      setTile: (x, y, tileId) => this.setTile(x, y, tileId),
      runtimeBaseAddress: RUNTIME_GRID_BASE_ADDRESS,
      runtimeStride: RUNTIME_GRID_STRIDE,
      activeTileId: MONSTER_RUNTIME_ACTIVE_TILE_ID,
      trailTileId: MONSTER_RUNTIME_TRAIL_TILE_ID,
      moveDuration: MONSTER_GRID_MOVE_DURATION
    });
  }

  /** Advances active smooth monster moves and commits completed steps. */
  private advanceMonsterMoves(dt: number): void {
    for (const monster of this.state.monsters) {
      if (!monster.movement) {
        continue;
      }

      monster.movement.elapsed += dt;
      if (monster.movement.elapsed >= monster.movement.duration) {
        monster.movement = null;
      }
    }
  }

  /** Returns whether the initial spawn blink sequence is still running. */
  private isPlayerSpawning(): boolean {
    return isPlayerSpawningSystem(
      this.spawnElapsed,
      PLAYER_SPAWN_BLINK_REPETITIONS,
      PLAYER_SPAWN_BLINK_STEP_DURATION
    );
  }

  /** Clears the temporary border tile used by the spawn blink effect. */
  private clearSpawnBlinkTileAfterSpawn(): void {
    if (this.spawnTileCleared || this.isPlayerSpawning()) {
      return;
    }

    const spawnGridX = Math.round(this.state.player.gridX);
    const spawnGridY = Math.round(this.state.player.gridY);
    this.clearRuntimeTile(spawnGridX, spawnGridY);

    this.spawnTileCleared = true;
  }

  /** Returns the temporary spawn tile id or black frame for the blink animation. */
  private getPlayerSpawnBlinkTileId(gridX: number, gridY: number): number | null | undefined {
    return getPlayerSpawnBlinkTileIdSystem(
      this.spawnElapsed,
      PLAYER_SPAWN_BLINK_STEP_DURATION,
      RUNTIME_GRID_FILL_TILE_ID,
      this.isPlayerSpawning(),
      this.isPlayerRenderedAtGrid(gridX, gridY)
    );
  }

  /** Returns whether the player sprite currently visually covers a grid cell. */
  private isPlayerRenderedAtGrid(gridX: number, gridY: number): boolean {
    return (
      Math.round(this.state.player.gridX) === gridX &&
      Math.round(this.state.player.gridY) === gridY
    );
  }

  /** Resolves a default tile-frame id for a non-player entity kind. */
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

  /** Returns the walking frame set that matches the current player facing. */
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

  /** Picks the current player walking frame from a movement frame set. */
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

    const progress = clamp(this.playerMove.elapsed / this.playerMove.duration, 0, 1);
    const frameIndex = Math.min(
      frames.length - 1,
      Math.floor(this.playerMove.elapsed / PLAYER_WALK_FRAME_DURATION)
    );
    return frames[frameIndex];
  }

  /** Advances a named looping animation clock and returns its current frame id. */
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

  /** Gets the cached atlas frame for a regular level tile id. */
  private getTileFrame(tileId: number): TileFrame {
    return this.tileFrameCache.getTileFrame(this.getTileAtlasImage(), tileId);
  }

  /** Gets the current animated diamond atlas frame for level diamonds. */
  private getDiamondTileFrame(): TileFrame {
    const diamondAnimation = this.animationState.get("diamond");
    const frameIndex = diamondAnimation
      ? diamondAnimation.frameIndex % this.diamondAnimationFrames.length
      : 0;
    if (!this.diamondAtlasImage) {
      return this.getTileFrame(DIAMOND_TILE_ID);
    }

    return this.tileFrameCache.getAtlasFrame(this.diamondAtlasImage, `diamond-${frameIndex}`, frameIndex);
  }

  /** Gets the current animated monster atlas frame. */
  private getMonsterTileFrame(): TileFrame {
    const monsterAnimation = this.animationState.get("monster");
    const frameIndex = monsterAnimation
      ? monsterAnimation.frameIndex % this.monsterAnimationFrames.length
      : 0;
    if (!this.monsterAtlasImage) {
      return this.getTileFrame(MONSTER_TILE_ID);
    }

    return this.tileFrameCache.getAtlasFrame(this.monsterAtlasImage, `monster-${frameIndex}`, frameIndex);
  }

  /** Draws panels, counters, labels, and the gallery diamond HUD. */
  private drawHud(renderer: Renderer): void {
    const { hud } = this.state;
    renderer.fillRect(0, PLAYFIELD_HEIGHT, 320, 40, TO8_PALETTE.black);

    if (this.leftHudPanelImage) {
      renderer.drawImage(this.leftHudPanelImage, 0, PLAYFIELD_HEIGHT);
    }
    if (this.rightHudPanelImage) {
      renderer.drawImage(this.rightHudPanelImage, HUD_RIGHT_PANEL_X, HUD_RIGHT_PANEL_Y);
      this.drawDynamicGalleryPanelContent(renderer);
    }

    drawHudTextFields(renderer, hud, {
      labelFontId: HUD_LABEL_FONT_ID,
      valueFontId: HUD_VALUE_FONT_ID,
      labelColor: HUD_LABEL_COLOR,
      valueColor: HUD_VALUE_COLOR,
      labelsX: HUD_LABELS_X,
      labelsY: HUD_LABELS_Y,
      scoreX: HUD_SCORE_X,
      timeX: HUD_TIME_X,
      recordX: HUD_RECORD_X,
      valuesY: HUD_VALUES_Y
    });
  }

  /** Draws the live gallery number and remaining-diamond counters over the right panel. */
  private drawDynamicGalleryPanelContent(renderer: Renderer): void {
    renderer.fillRect(
      HUD_GALLERY_COUNTER_X,
      HUD_RIGHT_COUNTER_Y,
      HUD_SMALL_COUNTER_WIDTH,
      HUD_SMALL_COUNTER_HEIGHT,
      HUD_PANEL_ORANGE
    );
    renderer.fillRect(
      HUD_DIAMOND_COUNTER_X,
      HUD_RIGHT_COUNTER_Y,
      HUD_SMALL_COUNTER_WIDTH,
      HUD_SMALL_COUNTER_HEIGHT,
      HUD_PANEL_ORANGE
    );
    this.drawHudGalleryDiamond(renderer);
    this.drawHudDigitValue(renderer, this.state.hud.gallery, HUD_GALLERY_COUNTER_X, HUD_RIGHT_COUNTER_Y);
    this.drawHudDigitValue(renderer, this.state.hud.diamonds, HUD_DIAMOND_COUNTER_X, HUD_RIGHT_COUNTER_Y);
  }

  /** Draws the ASM-style panel diamond animation with independent color bands. */
  private drawHudGalleryDiamond(renderer: Renderer): void {
    renderer.fillRect(
      HUD_GALLERY_DIAMOND_X,
      HUD_GALLERY_DIAMOND_Y,
      HUD_GALLERY_DIAMOND_WIDTH,
      HUD_GALLERY_DIAMOND_HEIGHT,
      HUD_PANEL_ORANGE
    );

    const animation = this.animationState.get("hudDiamond");
    const colorOffset = animation?.frameIndex ?? 0;
    for (let blockRow = 0; blockRow < HUD_GALLERY_DIAMOND_SHAPE_BLOCKS.length; blockRow += 1) {
      for (let blockColumn = 0; blockColumn < HUD_GALLERY_DIAMOND_SHAPE_BLOCKS[blockRow].length; blockColumn += 1) {
        const block = HUD_GALLERY_DIAMOND_SHAPE_BLOCKS[blockRow][blockColumn];
        for (let row = 0; row < 8; row += 1) {
          const globalRow = blockRow * 8 + row;
          const shapeByte = block[row];
          const colorByte = HUD_GALLERY_DIAMOND_COLOR_ROWS[
            (globalRow + colorOffset) % HUD_GALLERY_DIAMOND_COLOR_ROWS.length
          ];
          for (let bit = 0; bit < 8; bit += 1) {
            const shape = (shapeByte & (0x80 >> bit)) !== 0;
            const color = to8ColorFromAttribute(colorByte, shape);
            renderer.fillRect(
              HUD_GALLERY_DIAMOND_X + blockColumn * 8 + bit,
              HUD_GALLERY_DIAMOND_Y + globalRow,
              1,
              1,
              color
            );
          }
        }
      }
    }
  }

  /** Draws a blue two-digit HUD value using extracted TO8 glyphs. */
  private drawHudDigitValue(renderer: Renderer, value: number, x: number, y: number): void {
    drawHudSmallCounter(renderer, value, 2, x, y, {
      fontId: HUD_SMALL_COUNTER_FONT_ID,
      color: HUD_SMALL_COUNTER_COLOR
    });
  }

  /** Returns the loaded tile atlas or throws a user-facing loading error. */
  private getTileAtlasImage(): HTMLImageElement {
    if (!this.atlasImage) {
      throw new Error("Atlas de tuiles non charge.");
    }

    return this.atlasImage;
  }
}

/** Extracts animation frame ids from metadata, preserving a fallback for incomplete data. */
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

/** Clamps a numeric value between inclusive bounds. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Linearly interpolates between two numeric values. */
function lerp(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

/** Applies a smooth-step easing curve for camera interpolation. */
function smoothStep(progress: number): number {
  return progress * progress * (3 - 2 * progress);
}

/** Converts a TO8 attribute byte into the corresponding CSS color. */
function to8ColorFromAttribute(attribute: number, shape: boolean): string {
  const background = ((attribute & 0x07) | ((~attribute & 0x80) >> 4)) & 0x0f;
  const foreground = (((attribute >> 3) & 0x07) | ((~attribute & 0x40) >> 3)) & 0x0f;
  const [red, green, blue] = TO8_DEFAULT_RGB4[shape ? foreground : background];
  return rgbToHex(TO8_INTENSITIES[red], TO8_INTENSITIES[green], TO8_INTENSITIES[blue]);
}

/** Converts RGB channels into a CSS hexadecimal color. */
function rgbToHex(red: number, green: number, blue: number): string {
  return `#${hexByte(red)}${hexByte(green)}${hexByte(blue)}`;
}

/** Formats an 8-bit color channel as a two-character hexadecimal byte. */
function hexByte(value: number): string {
  return value.toString(16).padStart(2, "0");
}

/** Increments a decimal counter with wraparound at the configured digit count. */
function incrementBcdCounter(value: number, amount: number, digits: number): number {
  const maxValue = 10 ** digits;
  return (Math.max(0, Math.floor(value)) + Math.max(0, Math.floor(amount))) % maxValue;
}

/** Decrements a decimal counter without going below zero. */
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

