import { TO8_PALETTE } from "../assets/palette";
import type { InputState } from "../engine/input";
import type { Renderer } from "../engine/renderer";
import type { EntityState, GameState } from "../game/types";
import type { Scene } from "../engine/scene";
import { createGameLevelState } from "../game/state";
import { loadImage } from "../engine/image-loader";
import type { TileFrame } from "../engine/render-types";
import { mineFontMetadata } from "../assets/generated/mine-fonts";
import { mineSpriteMetadata } from "../assets/generated/mine-sprites";

interface AnimationClock {
  frameIndex: number;
  accumulator: number;
}

interface ViewportState {
  x: number;
  y: number;
  readonly columns: number;
  readonly rows: number;
}

interface GridMoveState {
  readonly fromX: number;
  readonly fromY: number;
  readonly toX: number;
  readonly toY: number;
  elapsed: number;
  readonly duration: number;
}

type CameraMoveState = GridMoveState;

const PLAYFIELD_HEIGHT = 160;
const RENDER_TILE_SIZE = 16;
const VIEWPORT_COLUMNS = 20;
const VIEWPORT_ROWS = 10;
const RUNTIME_GRID_STRIDE = 40;
const RUNTIME_GRID_FILL_TILE_ID = 0x04;
const INITIAL_VIEWPORT_X = 0;
const INITIAL_VIEWPORT_Y = 0;
const CAMERA_LEFT_MARGIN = 0x04;
const CAMERA_RIGHT_MARGIN = 0x0f;
const CAMERA_TOP_MARGIN = 0x02;
const CAMERA_BOTTOM_MARGIN = 0x07;
const CAMERA_MIN_X = INITIAL_VIEWPORT_X;
const CAMERA_MIN_Y = INITIAL_VIEWPORT_Y;
const PLAYER_SPAWN_BLINK_REPETITIONS = 4;
const PLAYER_SPAWN_BLINK_STEP_DURATION = 0.25;
const PLAYER_GRID_MOVE_DURATION = 0.21;
const PLAYER_WALK_FRAME_DURATION = PLAYER_GRID_MOVE_DURATION / 3;
const PLAYER_WALK_FINAL_FRAME_HOLD_DURATION = PLAYER_WALK_FRAME_DURATION;
const CAMERA_GRID_MOVE_DURATION = PLAYER_GRID_MOVE_DURATION;
const RUNTIME_GRID_BASE_ADDRESS = 0xdbb7;
const MONSTER_MOVE_INTERVAL = 0.28;
const MONSTER_GRID_MOVE_DURATION = 0.18;
const MONSTER_RUNTIME_ACTIVE_TILE_ID = 0x17;
const MONSTER_RUNTIME_TRAIL_TILE_ID = 0x80;
const PLAYER_DIGGABLE_TILE_ID = 0x01;
const ROCK_TILE_ID = 0x00;
const DIAMOND_TILE_ID = 0x03;
const RUNTIME_EMPTY_TILE_ID = 0x05;
const PLATFORM_TILE_ID = 0x06;
const HUD_TIMER_TICK_SECONDS = 1;
const HUD_PANEL_ORANGE = "#ef9300";
const HUD_RIGHT_PANEL_X = 256;
const HUD_RIGHT_PANEL_Y = PLAYFIELD_HEIGHT;
const HUD_RIGHT_COUNTER_Y = HUD_RIGHT_PANEL_Y + 20;
const HUD_GALLERY_COUNTER_X = HUD_RIGHT_PANEL_X;
const HUD_GALLERY_DIAMOND_X = HUD_RIGHT_PANEL_X + 16;
const HUD_GALLERY_DIAMOND_Y = HUD_RIGHT_PANEL_Y + 16;
const HUD_DIAMOND_COUNTER_X = HUD_RIGHT_PANEL_X + 40;
const HUD_SMALL_COUNTER_FONT_ID = "hud-digits-7";
const HUD_SMALL_COUNTER_COLOR = "#0048ff";
const HUD_SMALL_COUNTER_WIDTH = 16;
const HUD_SMALL_COUNTER_HEIGHT = 8;
const HUD_LABEL_FONT_ID = "hud-large-16";
const HUD_VALUE_FONT_ID = "hud-small-11";
const HUD_LABEL_COLOR = "#f5f5f5";
const HUD_VALUE_COLOR = "#00d8d8";
const HUD_LABELS_X = 72;
const HUD_LABELS_Y = 160;
const HUD_SCORE_X = 72;
const HUD_TIME_X = 144;
const HUD_RECORD_X = 192;
const HUD_VALUES_Y = 177;
const HUD_GALLERY_DIAMOND_WIDTH = 24;
const HUD_GALLERY_DIAMOND_HEIGHT = 16;
const HUD_GALLERY_DIAMOND_ANIMATION_FRAMES = Array.from({ length: HUD_GALLERY_DIAMOND_HEIGHT }, (_, index) => index);

const TO8_INTENSITIES = [
  0, 100, 127, 147, 163, 179, 191, 203,
  215, 223, 231, 239, 243, 247, 251, 255
] as const;

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

const HUD_GALLERY_DIAMOND_COLOR_ROWS = [
  0x4f, 0x4f, 0x1f, 0x1f, 0x5f, 0x5f, 0x5f, 0x5f,
  0x37, 0x37, 0x77, 0x77, 0x27, 0x27, 0x67, 0x67
] as const;

const LEVEL1_ATLAS_URL = new URL(
  "../../docs/extraction/mine-tiles-atlas-D218-D8D7.png",
  import.meta.url
).href;

const DIAMOND_ATLAS_URL = new URL(
  "../../docs/extraction/sprites/diamond-atlas.png",
  import.meta.url
).href;

const MONSTER_ATLAS_URL = new URL(
  "../../docs/extraction/sprites/monster-atlas.png",
  import.meta.url
).href;

const HUD_LEFT_PANEL_URL = new URL(
  "../../docs/extraction/hud/left-wood-sign.png",
  import.meta.url
).href;

const HUD_RIGHT_PANEL_URL = new URL(
  "../../docs/extraction/hud/right-gallery-sign.png",
  import.meta.url
).href;

export class GameplayScene implements Scene {
  private readonly state: GameState;
  private readonly runtimeGrid: LevelRuntimeGrid;
  private readonly tileFrames = new Map<number, TileFrame>();
  private readonly diamondFrames = new Map<number, TileFrame>();
  private readonly monsterFrames = new Map<number, TileFrame>();
  private readonly tileSourceSize = RENDER_TILE_SIZE;
  private readonly tileSize = RENDER_TILE_SIZE;
  private readonly boardOffsetX = 0;
  private readonly boardOffsetY = 0;
  private readonly viewport: ViewportState = {
    x: INITIAL_VIEWPORT_X,
    y: INITIAL_VIEWPORT_Y,
    columns: VIEWPORT_COLUMNS,
    rows: VIEWPORT_ROWS
  };
  private readonly levelWidth: number;
  private readonly levelHeight: number;
  private readonly playerAnimationFrames = extractFrameIdsFromMetadata("player", "idleCycle", [8, 8, 7, 8, 9]);
  private readonly playerMoveRightFrames = extractFrameIdsFromMetadata("player", "moveRight", [0x0c, 0x0d, 0x0e]);
  private readonly playerMoveLeftFrames = extractFrameIdsFromMetadata("player", "moveLeft", [0x0f, 0x10, 0x11]);
  private readonly diamondAnimationFrames = extractFrameIdsFromMetadata("diamond", "colorCycle", [3, 3, 3, 3, 3, 3, 3, 3]);
  private readonly monsterAnimationFrames = extractFrameIdsFromMetadata("monster", "blinkToggle", [2, 2]);
  private readonly animationDurations = {
    player: 1 / 8,
    diamond: 1 / 8,
    monster: 1 / 4,
    hudDiamond: 1 / 8
  };
  private readonly animationState = new Map<string, AnimationClock>();
  private spawnElapsed = 0;
  private spawnTileCleared = false;
  private monsterMoveElapsed = 0;
  private hudTimeAccumulator = 0;
  private playerMove: GridMoveState | null = null;
  private playerHeldMoveFrameId: number | null = null;
  private playerHeldMoveFrameElapsed = 0;
  private cameraMove: CameraMoveState | null = null;
  private playerFacing: "idle" | "left" | "right" = "idle";
  private lastHorizontalFacing: "left" | "right" = "right";
  private atlasImage: HTMLImageElement | null = null;
  private diamondAtlasImage: HTMLImageElement | null = null;
  private monsterAtlasImage: HTMLImageElement | null = null;
  private leftHudPanelImage: HTMLImageElement | null = null;
  private rightHudPanelImage: HTMLImageElement | null = null;
  private atlasError: string | null = null;

  constructor(levelNumber = 1) {
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

  private async loadAtlas(): Promise<void> {
    try {
      const [tileAtlas, diamondAtlas, monsterAtlas] = await Promise.all([
        loadImage(LEVEL1_ATLAS_URL),
        loadImage(DIAMOND_ATLAS_URL),
        loadImage(MONSTER_ATLAS_URL)
      ]);
      this.atlasImage = tileAtlas;
      this.diamondAtlasImage = diamondAtlas;
      this.monsterAtlasImage = monsterAtlas;
    } catch (error) {
      this.atlasError = error instanceof Error ? error.message : String(error);
    }
  }

  private async loadHudPanels(): Promise<void> {
    const [leftPanel, rightPanel] = await Promise.all([
      loadImage(HUD_LEFT_PANEL_URL),
      loadImage(HUD_RIGHT_PANEL_URL)
    ]);
    this.leftHudPanelImage = leftPanel;
    this.rightHudPanelImage = rightPanel;
  }

  update(dt: number, input: InputState): void {
    const playerSpawning = this.isPlayerSpawning();

    this.spawnElapsed += dt;
    this.clearSpawnBlinkTileAfterSpawn();
    this.advanceHudCounters(dt, playerSpawning);

    if (this.playerMove) {
      this.advancePlayerMove(dt);
    } else if (!playerSpawning) {
      this.advancePlayerHeldMoveFrame(dt);
      const moveX = input.pressed.left ? -1 : input.pressed.right ? 1 : 0;
      const moveY = moveX === 0 ? input.pressed.up ? -1 : input.pressed.down ? 1 : 0 : 0;
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
          this.applyPlayerTileMutation(targetRuntimeX, targetRuntimeY, collision.tileId);
          this.advanceCameraAfterPlayerStep(fromX, fromY, moveX, moveY);
          this.playerMove = {
            fromX,
            fromY,
            toX,
            toY,
            elapsed: 0,
            duration: PLAYER_GRID_MOVE_DURATION
          };
        }
      }
    }
    this.advanceCameraMove(dt);

    this.state.player.x = this.state.player.gridX * this.state.level.tileSize;
    this.state.player.y = this.state.player.gridY * this.state.level.tileSize;
    this.advanceMonsterRuntime(dt);
    this.advanceMonsterMoves(dt);
    this.syncMonsterEntitiesFromRuntimeState();

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

  render(renderer: Renderer): void {
    renderer.clear(TO8_PALETTE.black);
    this.drawPlayfield(renderer);
    this.drawEntities(renderer);
    this.drawHud(renderer);
  }

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
        const screenX = Math.round(this.boardOffsetX + (levelX - renderViewportX) * this.tileSize);
        const screenY = Math.round(this.boardOffsetY + (levelY - renderViewportY) * this.tileSize);
        const tileId = this.runtimeGrid.getRuntimeTile(levelX, levelY);
        const isDynamicTile = tileId === 2 || tileId === 3 || tileId === MONSTER_RUNTIME_ACTIVE_TILE_ID;
        const hasDynamicEntity = isDynamicTile && (
          this.findEntityAtGrid(levelX, levelY) !== null ||
          (tileId === MONSTER_RUNTIME_ACTIVE_TILE_ID && this.findMonsterRuntimeAtGrid(levelX, levelY) !== null)
        );
        const hasPlayerEntity = this.state.player.active && this.isPlayerRenderedAtGrid(levelX, levelY);
        const spawnBlinkTileId = this.getPlayerSpawnBlinkTileId(levelX, levelY);

        if (spawnBlinkTileId === null) {
          renderer.fillRect(
            screenX,
            screenY,
            this.tileSize,
            this.tileSize,
            TO8_PALETTE.black
          );
          continue;
        }

        const renderTileId =
          tileId === MONSTER_RUNTIME_TRAIL_TILE_ID || tileId === MONSTER_RUNTIME_ACTIVE_TILE_ID
            ? 0x05
            : tileId;
        const frame = this.getTileFrame(spawnBlinkTileId ?? renderTileId);
        if ((hasDynamicEntity || hasPlayerEntity) && spawnBlinkTileId === undefined) {
          continue;
        }

        renderer.drawTile(
          frame,
          screenX,
          screenY
        );
      }
    }
  }

  private drawEntities(renderer: Renderer): void {
    if (!this.atlasImage) {
      return;
    }

    for (const entity of this.state.entities) {
      if (!entity.active) {
        continue;
      }

      if (entity.kind === "player" && this.isPlayerSpawning()) {
        continue;
      }

      if (entity.kind === "rock" || entity.kind === "door") {
        continue;
      }

      const renderViewportX = this.getRenderViewportX();
      const renderViewportY = this.getRenderViewportY();
      const cullViewportX = Math.floor(renderViewportX);
      const cullViewportY = Math.floor(renderViewportY);
      const entityGridX = entity.gridX;
      const entityGridY = entity.gridY;
      if (
        entityGridX < cullViewportX - 1 ||
        entityGridX >= cullViewportX + this.viewport.columns + 2 ||
        entityGridY < cullViewportY - 1 ||
        entityGridY >= cullViewportY + this.viewport.rows + 2
      ) {
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

  private isEntityAtGrid(entity: EntityState, gridX: number, gridY: number): boolean {
    return Math.round(entity.gridX) === gridX && Math.round(entity.gridY) === gridY;
  }

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
      this.playerMove = null;
    }
  }

  private advancePlayerHeldMoveFrame(dt: number): void {
    if (this.playerHeldMoveFrameId === null) {
      return;
    }

    this.playerHeldMoveFrameElapsed += dt;
    if (this.playerHeldMoveFrameElapsed >= PLAYER_WALK_FINAL_FRAME_HOLD_DURATION) {
      this.clearPlayerHeldMoveFrame();
    }
  }

  private holdPlayerFinalMoveFrame(): void {
    const frames = this.getPlayerDirectionalFrames();
    if (!frames || frames.length === 0) {
      return;
    }

    this.playerHeldMoveFrameId = frames[frames.length - 1];
    this.playerHeldMoveFrameElapsed = 0;
  }

  private clearPlayerHeldMoveFrame(): void {
    this.playerHeldMoveFrameId = null;
    this.playerHeldMoveFrameElapsed = 0;
  }

  private advanceCameraAfterPlayerStep(fromX: number, fromY: number, moveX: number, moveY: number): void {
    const screenX = fromX - this.viewport.x;
    const screenY = fromY - this.viewport.y;
    const previousViewportX = this.viewport.x;
    const previousViewportY = this.viewport.y;

    const cameraMaxX = this.getCameraMaxX();
    const cameraMaxY = this.getCameraMaxY();

    if (moveX > 0 && screenX === CAMERA_RIGHT_MARGIN && this.viewport.x < cameraMaxX) {
      this.viewport.x += 1;
    } else if (moveX < 0 && screenX === CAMERA_LEFT_MARGIN && this.viewport.x > CAMERA_MIN_X) {
      this.viewport.x -= 1;
    }

    if (moveY > 0 && screenY === CAMERA_BOTTOM_MARGIN && this.viewport.y < cameraMaxY) {
      this.viewport.y += 1;
    } else if (moveY < 0 && screenY === CAMERA_TOP_MARGIN && this.viewport.y > CAMERA_MIN_Y) {
      this.viewport.y -= 1;
    }

    if (this.viewport.x !== previousViewportX || this.viewport.y !== previousViewportY) {
      this.cameraMove = {
        fromX: previousViewportX,
        fromY: previousViewportY,
        toX: this.viewport.x,
        toY: this.viewport.y,
        elapsed: 0,
        duration: CAMERA_GRID_MOVE_DURATION
      };
    }
  }

  private advanceCameraMove(dt: number): void {
    if (!this.cameraMove) {
      return;
    }

    this.cameraMove.elapsed += dt;
    if (this.cameraMove.elapsed >= this.cameraMove.duration) {
      this.cameraMove = null;
    }
  }

  private getCameraMaxX(): number {
    return Math.max(CAMERA_MIN_X, this.levelWidth - this.viewport.columns);
  }

  private getCameraMaxY(): number {
    return Math.max(CAMERA_MIN_Y, this.levelHeight - this.viewport.rows);
  }

  private getRenderViewportX(): number {
    if (!this.cameraMove) {
      return this.viewport.x;
    }

    const progress = clamp(this.cameraMove.elapsed / this.cameraMove.duration, 0, 1);
    return lerp(this.cameraMove.fromX, this.cameraMove.toX, smoothStep(progress));
  }

  private getRenderViewportY(): number {
    if (!this.cameraMove) {
      return this.viewport.y;
    }

    const progress = clamp(this.cameraMove.elapsed / this.cameraMove.duration, 0, 1);
    return lerp(this.cameraMove.fromY, this.cameraMove.toY, smoothStep(progress));
  }

  private resolvePlayerMove(gridX: number, gridY: number): { readonly canEnter: boolean; readonly tileId: number } {
    if (gridX < 0 || gridY < 0) {
      return {
        canEnter: false,
        tileId: RUNTIME_GRID_FILL_TILE_ID
      };
    }

    if (this.findEntityKindAtGrid("diamond", gridX, gridY) !== null) {
      return {
        canEnter: true,
        tileId: DIAMOND_TILE_ID
      };
    }

    const tileId = this.runtimeGrid.getRuntimeTile(gridX, gridY);
    return {
      canEnter: this.canPlayerEnterTile(tileId),
      tileId
    };
  }

  private canPlayerEnterTile(tileId: number): boolean {
    if (tileId === RUNTIME_EMPTY_TILE_ID || tileId === PLAYER_DIGGABLE_TILE_ID || tileId === DIAMOND_TILE_ID) {
      return true;
    }

    if (tileId === MONSTER_RUNTIME_TRAIL_TILE_ID) {
      return true;
    }

    if (tileId === ROCK_TILE_ID || tileId === RUNTIME_GRID_FILL_TILE_ID || tileId === PLATFORM_TILE_ID) {
      return false;
    }

    return false;
  }

  private applyPlayerTileMutation(gridX: number, gridY: number, tileId: number): void {
    if (tileId === PLAYER_DIGGABLE_TILE_ID || tileId === MONSTER_RUNTIME_TRAIL_TILE_ID) {
      this.runtimeGrid.setRuntimeTile(gridX, gridY, RUNTIME_EMPTY_TILE_ID);
      return;
    }

    if (tileId === DIAMOND_TILE_ID) {
      this.runtimeGrid.setRuntimeTile(gridX, gridY, RUNTIME_EMPTY_TILE_ID);
      this.incrementScore(this.state.level.meta.scoreStep);
      this.state.hud.diamonds = Math.max(0, this.state.hud.diamonds - 1);
      this.deactivateEntityAtGrid("diamond", gridX, gridY);
    }
  }

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

  private incrementScore(amount: number): void {
    this.state.hud.score = incrementBcdCounter(this.state.hud.score, amount, 6);
    this.state.hud.record = Math.max(this.state.hud.record, this.state.hud.score);
  }

  private deactivateEntityAtGrid(kind: EntityState["kind"], gridX: number, gridY: number): void {
    const entity = this.findEntityKindAtGrid(kind, gridX, gridY);

    if (entity) {
      entity.active = false;
    }
  }

  private findEntityKindAtGrid(kind: EntityState["kind"], gridX: number, gridY: number): EntityState | null {
    return this.state.entities.find((item) =>
      item.kind === kind &&
      item.active &&
      Math.round(item.gridX) === gridX &&
      Math.round(item.gridY) === gridY
    ) ?? null;
  }

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

  private advanceSingleMonsterRuntime(monster: GameState["monsters"][number]): void {
    let direction = monster.direction;

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const delta = monsterDirectionToDelta(direction);
      const targetX = monster.gridX + delta.x;
      const targetY = monster.gridY + delta.y;

      if (isMonsterWalkableRuntimeTile(this.runtimeGrid.getRuntimeTile(targetX, targetY))) {
        this.runtimeGrid.setRuntimeTile(monster.gridX, monster.gridY, MONSTER_RUNTIME_TRAIL_TILE_ID);
        this.runtimeGrid.setRuntimeTile(targetX, targetY, MONSTER_RUNTIME_ACTIVE_TILE_ID);
        monster.movement = {
          fromX: monster.gridX,
          fromY: monster.gridY,
          toX: targetX,
          toY: targetY,
          elapsed: 0,
          duration: MONSTER_GRID_MOVE_DURATION
        };
        monster.gridX = targetX;
        monster.gridY = targetY;
        monster.direction = direction;
        monster.runtimePointer = RUNTIME_GRID_BASE_ADDRESS + targetY * RUNTIME_GRID_STRIDE + targetX;
        return;
      }

      direction = decrementMonsterDirection(direction);
    }

    monster.direction = direction;
  }

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

  private isPlayerSpawning(): boolean {
    return this.spawnElapsed < PLAYER_SPAWN_BLINK_REPETITIONS * 2 * PLAYER_SPAWN_BLINK_STEP_DURATION;
  }

  private clearSpawnBlinkTileAfterSpawn(): void {
    if (this.spawnTileCleared || this.isPlayerSpawning()) {
      return;
    }

    const spawnGridX = Math.round(this.state.player.gridX);
    const spawnGridY = Math.round(this.state.player.gridY);
    this.runtimeGrid.setRuntimeTile(spawnGridX, spawnGridY, RUNTIME_EMPTY_TILE_ID);

    this.spawnTileCleared = true;
  }

  private getPlayerSpawnBlinkTileId(gridX: number, gridY: number): number | null | undefined {
    if (!this.isPlayerSpawning() || !this.isPlayerRenderedAtGrid(gridX, gridY)) {
      return undefined;
    }

    const step = Math.floor(this.spawnElapsed / PLAYER_SPAWN_BLINK_STEP_DURATION);
    return step % 2 === 0 ? RUNTIME_GRID_FILL_TILE_ID : null;
  }

  private isPlayerRenderedAtGrid(gridX: number, gridY: number): boolean {
    return (
      Math.round(this.state.player.gridX) === gridX &&
      Math.round(this.state.player.gridY) === gridY
    );
  }

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

  private getTileFrame(tileId: number): TileFrame {
    const existing = this.tileFrames.get(tileId);
    if (existing) {
      return existing;
    }

    const frame: TileFrame = {
      id: `tile-${tileId}`,
      source: this.atlasImage as HTMLImageElement,
      sourceRect: {
        x: tileId * this.tileSourceSize,
        y: 0,
        width: this.tileSourceSize,
        height: this.tileSourceSize
      },
      size: {
        width: this.tileSize,
        height: this.tileSize
      }
    };
    this.tileFrames.set(tileId, frame);
    return frame;
  }

  private getDiamondTileFrame(): TileFrame {
    const diamondAnimation = this.animationState.get("diamond");
    const frameIndex = diamondAnimation
      ? diamondAnimation.frameIndex % this.diamondAnimationFrames.length
      : 0;
    const existing = this.diamondFrames.get(frameIndex);
    if (existing) {
      return existing;
    }

    if (!this.diamondAtlasImage) {
      return this.getTileFrame(0x03);
    }

    const frame: TileFrame = {
      id: `diamond-${frameIndex}`,
      source: this.diamondAtlasImage,
      sourceRect: {
        x: frameIndex * this.tileSourceSize,
        y: 0,
        width: this.tileSourceSize,
        height: this.tileSourceSize
      },
      size: {
        width: this.tileSize,
        height: this.tileSize
      }
    };
    this.diamondFrames.set(frameIndex, frame);
    return frame;
  }

  private getMonsterTileFrame(): TileFrame {
    const monsterAnimation = this.animationState.get("monster");
    const frameIndex = monsterAnimation
      ? monsterAnimation.frameIndex % this.monsterAnimationFrames.length
      : 0;
    const existing = this.monsterFrames.get(frameIndex);
    if (existing) {
      return existing;
    }

    if (!this.monsterAtlasImage) {
      return this.getTileFrame(0x02);
    }

    const frame: TileFrame = {
      id: `monster-${frameIndex}`,
      source: this.monsterAtlasImage,
      sourceRect: {
        x: frameIndex * this.tileSourceSize,
        y: 0,
        width: this.tileSourceSize,
        height: this.tileSourceSize
      },
      size: {
        width: this.tileSize,
        height: this.tileSize
      }
    };
    this.monsterFrames.set(frameIndex, frame);
    return frame;
  }

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

    this.drawHudFontText(renderer, "Points  Temps  Record", HUD_LABEL_FONT_ID, HUD_LABELS_X, HUD_LABELS_Y, HUD_LABEL_COLOR);
    this.drawHudFontText(renderer, padNumber(hud.score, 6), HUD_VALUE_FONT_ID, HUD_SCORE_X, HUD_VALUES_Y, HUD_VALUE_COLOR);
    this.drawHudFontText(renderer, padNumber(hud.time, 3), HUD_VALUE_FONT_ID, HUD_TIME_X, HUD_VALUES_Y, HUD_VALUE_COLOR);
    this.drawHudFontText(renderer, padNumber(hud.record, 6), HUD_VALUE_FONT_ID, HUD_RECORD_X, HUD_VALUES_Y, HUD_VALUE_COLOR);
  }

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
    this.drawHudDigitText(renderer, padNumber(this.state.hud.gallery, 2), HUD_GALLERY_COUNTER_X, HUD_RIGHT_COUNTER_Y);
    this.drawHudDigitText(renderer, padNumber(this.state.hud.diamonds, 2), HUD_DIAMOND_COUNTER_X, HUD_RIGHT_COUNTER_Y);
  }

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

  private drawHudDigitText(renderer: Renderer, text: string, x: number, y: number): void {
    this.drawHudFontText(renderer, text, HUD_SMALL_COUNTER_FONT_ID, x, y, HUD_SMALL_COUNTER_COLOR);
  }

  private drawHudFontText(renderer: Renderer, text: string, fontId: string, x: number, y: number, color: string): void {
    const font = mineFontMetadata.fonts.find((item) => item.id === fontId);
    if (!font) {
      renderer.drawPixelText(text, x, y, color);
      return;
    }

    let cursorX = x;
    for (const character of text) {
      const glyph = font.glyphs.find((item) => item.char === character);
      if (!glyph) {
        cursorX += font.width;
        continue;
      }

      for (let row = 0; row < font.height; row += 1) {
        const bits = glyph.rows[row] ?? "";
        for (let column = 0; column < font.width; column += 1) {
          if (bits[column] === "1") {
            renderer.fillRect(cursorX + column, y + row, 1, 1, color);
          }
        }
      }
      cursorX += font.width;
    }
  }
}

class LevelRuntimeGrid {
  private readonly runtimeTiles: number[];

  constructor(
    tiles: readonly number[],
    private readonly usefulWidth: number,
    private readonly usefulHeight: number,
    readonly stride: number,
    private readonly fillTileId: number
  ) {
    this.runtimeTiles = [...tiles];
  }

  getRuntimeTile(x: number, y: number): number {
    if (x < 0 || y < 0 || y >= this.usefulHeight || x >= this.stride) {
      return this.fillTileId;
    }

    if (x >= this.usefulWidth) {
      return this.fillTileId;
    }

    return this.runtimeTiles[y * this.usefulWidth + x] ?? this.fillTileId;
  }

  setRuntimeTile(x: number, y: number, tileId: number): void {
    if (x < 0 || y < 0 || y >= this.usefulHeight || x >= this.usefulWidth) {
      return;
    }

    this.runtimeTiles[y * this.usefulWidth + x] = tileId;
  }
}

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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function lerp(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

function smoothStep(progress: number): number {
  return progress * progress * (3 - 2 * progress);
}

function to8ColorFromAttribute(attribute: number, shape: boolean): string {
  const background = ((attribute & 0x07) | ((~attribute & 0x80) >> 4)) & 0x0f;
  const foreground = (((attribute >> 3) & 0x07) | ((~attribute & 0x40) >> 3)) & 0x0f;
  const [red, green, blue] = TO8_DEFAULT_RGB4[shape ? foreground : background];
  return rgbToHex(TO8_INTENSITIES[red], TO8_INTENSITIES[green], TO8_INTENSITIES[blue]);
}

function rgbToHex(red: number, green: number, blue: number): string {
  return `#${hexByte(red)}${hexByte(green)}${hexByte(blue)}`;
}

function hexByte(value: number): string {
  return value.toString(16).padStart(2, "0");
}

function decrementMonsterDirection(direction: 1 | 2 | 3 | 4): 1 | 2 | 3 | 4 {
  return direction === 1 ? 4 : ((direction - 1) as 1 | 2 | 3 | 4);
}

function monsterDirectionToDelta(direction: 1 | 2 | 3 | 4): { readonly x: number; readonly y: number } {
  if (direction === 1) {
    return { x: -1, y: 0 };
  }

  if (direction === 2) {
    return { x: 0, y: -1 };
  }

  if (direction === 3) {
    return { x: 1, y: 0 };
  }

  return { x: 0, y: 1 };
}

function isMonsterWalkableRuntimeTile(tileId: number): boolean {
  return tileId === 0x05 || tileId === MONSTER_RUNTIME_TRAIL_TILE_ID;
}

function incrementBcdCounter(value: number, amount: number, digits: number): number {
  const maxValue = 10 ** digits;
  return (Math.max(0, Math.floor(value)) + Math.max(0, Math.floor(amount))) % maxValue;
}

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

function padNumber(value: number, size: number): string {
  return Math.max(0, Math.floor(value)).toString().padStart(size, "0");
}
