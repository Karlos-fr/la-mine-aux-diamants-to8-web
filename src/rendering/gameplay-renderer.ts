/**
 * Role: Orchestre le rendu complet de la scene gameplay.
 * Scope: Dessine grille visible, objets physiques, entites et HUD sans muter l'etat runtime.
 * ISO: Conserve l'ordre de rendu actuel: fond, grille, objets/entites par couches, panneaux HUD.
 * Notes: Les decisions gameplay restent dans `GameplayScene` et les systems; ce renderer ne fait que lire.
 */

import { TO8_PALETTE } from "../assets/palette";
import type { Renderer } from "../engine/renderer";
import type { TileFrame } from "../engine/render-types";
import type { EntityState, GameState } from "../game/types";
import { getInterpolatedFallingObjectGridPosition, isEntityGridPositionVisible } from "./entity-renderer";
import { drawHudSmallCounter, drawHudTextFields } from "./hud-renderer";
import { getGridCellScreenPosition } from "./level-renderer";

/** Hauteur en pixels de la zone de jeu au-dessus du HUD. */
const PLAYFIELD_HEIGHT = 160;
/** Couleur rouge observee lors du flash objectif atteint. */
const OBJECTIVE_FLASH_RED = "#ff4040";
/** Couleur jaune observee lors du flash objectif atteint. */
const OBJECTIVE_FLASH_YELLOW = "#fff040";
/** Epaisseur du cadre de flash objectif. */
const OBJECTIVE_FLASH_BORDER_SIZE = 4;
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

/** Viewport de niveau utilise par le renderer gameplay. */
export interface GameplayRenderViewport {
  /** Origine horizontale visible. */
  readonly x: number;

  /** Origine verticale visible. */
  readonly y: number;

  /** Nombre de colonnes visibles. */
  readonly columns: number;

  /** Nombre de lignes visibles. */
  readonly rows: number;
}

/** Tile ids speciaux dont le renderer a besoin pour conserver l'ordre ISO. */
export interface GameplayRenderTileIds {
  /** Tuile monstre de depart. */
  readonly monster: number;

  /** Tuile diamant statique. */
  readonly diamond: number;

  /** Tuile monstre actif. */
  readonly monsterActive: number;

  /** Tuile creature speciale `0x17`, distincte du monstre standard `0x02`. */
  readonly specialCreature: number;

  /** Tuile trace monstre. */
  readonly monsterTrail: number;

  /** Tuile rocher statique. */
  readonly rock: number;

  /** Tuile rocher en chute. */
  readonly fallingRock: number;

  /** Tuile diamant en chute. */
  readonly fallingDiamond: number;

  /** Tuile vide. */
  readonly empty: number;
}

/** Contexte de rendu fourni par la scene gameplay a chaque frame. */
export interface GameplayRenderContext {
  /** Etat gameplay lu par le renderer. */
  readonly state: GameState;

  /** Indique si l'atlas principal est charge. */
  readonly tileAtlasLoaded: boolean;

  /** Erreur de chargement asset lisible, si presente. */
  readonly assetError: string | null;

  /** Panneau HUD gauche charge. */
  readonly leftHudPanelImage: HTMLImageElement | null;

  /** Panneau HUD droit charge. */
  readonly rightHudPanelImage: HTMLImageElement | null;

  /** Viewport logique interpole pour cette frame. */
  readonly viewport: GameplayRenderViewport;

  /** Taille de tuile en pixels. */
  readonly tileSize: number;

  /** Decalage horizontal de la zone de jeu. */
  readonly boardOffsetX: number;

  /** Decalage vertical de la zone de jeu. */
  readonly boardOffsetY: number;

  /** Tile ids speciaux utilises par le rendu. */
  readonly tileIds: GameplayRenderTileIds;

  /** Offset couleur courant du diamant de panneau HUD. */
  readonly hudDiamondColorOffset: number;

  /** Lit une tuile runtime. */
  readonly getRuntimeTile: (gridX: number, gridY: number) => number;

  /** Retourne la frame atlas d'une tuile. */
  readonly getTileFrame: (tileId: number) => TileFrame;

  /** Retourne la frame animee du diamant. */
  readonly getDiamondTileFrame: () => TileFrame;

  /** Retourne la frame animee du monstre. */
  readonly getMonsterTileFrame: () => TileFrame;

  /** Retourne la frame d'entite non speciale. */
  readonly getEntityTileFrameId: (kind: string) => number;

  /** Trouve une entite active a une cellule. */
  readonly findEntityAtGrid: (gridX: number, gridY: number) => EntityState | null;

  /** Trouve un monstre runtime a une cellule. */
  readonly findMonsterRuntimeAtGrid: (gridX: number, gridY: number) => unknown | null;

  /** Indique si le joueur couvre visuellement une cellule. */
  readonly isPlayerRenderedAtGrid: (gridX: number, gridY: number) => boolean;

  /** Retourne la tuile de clignotement spawn, noir, ou absence de remplacement. */
  readonly getPlayerSpawnBlinkTileId: (gridX: number, gridY: number) => number | null | undefined;

  /** Retourne la tuile de clignotement sortie active, ou absence de remplacement. */
  readonly getExitBlinkTileId: (gridX: number, gridY: number) => number | undefined;

  /** Indique si le joueur est encore dans l'animation de spawn. */
  readonly isPlayerSpawning: () => boolean;

  /** Phase courante du flash objectif atteint, ou rien si l'effet est inactif. */
  readonly objectiveReachedFlashPhase: number | null;
}

/** Renderer gameplay unique, sans mutation runtime. */
export class GameplayRenderer {
  /** Rend la frame gameplay complete dans l'ordre ISO courant. */
  render(renderer: Renderer, context: GameplayRenderContext): void {
    renderer.clear(TO8_PALETTE.black);
    if (!context.tileAtlasLoaded && context.assetError) {
      this.drawAssetError(renderer, context.assetError);
      return;
    }

    this.drawPlayfield(renderer, context);
    this.drawEntitiesAndObjects(renderer, context);
    this.drawHud(renderer, context);
    this.drawObjectiveReachedFlash(renderer, context);
  }

  /** Affiche une erreur de chargement asset directement dans la resolution logique. */
  private drawAssetError(renderer: Renderer, message: string): void {
    renderer.drawPixelText("ERREUR ASSETS", 76, 82, TO8_PALETTE.yellow, 2);
    renderer.drawPixelText(message.toUpperCase(), 24, 108, TO8_PALETTE.white, 1);
  }

  /** Rend la grille visible du niveau courant. */
  private drawPlayfield(renderer: Renderer, context: GameplayRenderContext): void {
    if (!context.tileAtlasLoaded) {
      return;
    }

    renderer.fillRect(0, 0, renderer.width, PLAYFIELD_HEIGHT, TO8_PALETTE.black);

    const baseLevelX = Math.floor(context.viewport.x);
    const baseLevelY = Math.floor(context.viewport.y);

    for (let y = 0; y < context.viewport.rows + 2; y += 1) {
      for (let x = 0; x < context.viewport.columns + 2; x += 1) {
        const levelX = baseLevelX + x;
        const levelY = baseLevelY + y;
        const screenPosition = getGridCellScreenPosition(
          levelX,
          levelY,
          context.viewport,
          context.tileSize,
          context.boardOffsetX,
          context.boardOffsetY
        );
        const tileId = context.getRuntimeTile(levelX, levelY);
        const isDynamicTile =
          tileId === context.tileIds.monster ||
          tileId === context.tileIds.diamond ||
          tileId === context.tileIds.monsterActive ||
          tileId === context.tileIds.fallingRock ||
          tileId === context.tileIds.fallingDiamond;
        const hasDynamicEntity = isDynamicTile && (
          context.findEntityAtGrid(levelX, levelY) !== null ||
          (tileId === context.tileIds.monsterActive && context.findMonsterRuntimeAtGrid(levelX, levelY) !== null)
        );
        const hasPlayerEntity = context.state.player.active && context.isPlayerRenderedAtGrid(levelX, levelY);
        const spawnBlinkTileId = context.getPlayerSpawnBlinkTileId(levelX, levelY);
        const exitBlinkTileId = context.getExitBlinkTileId(levelX, levelY);

        if (spawnBlinkTileId === null) {
          renderer.fillRect(
            screenPosition.x,
            screenPosition.y,
            context.tileSize,
            context.tileSize,
            TO8_PALETTE.black
          );
          continue;
        }

        const renderTileId =
          tileId === context.tileIds.monsterTrail || tileId === context.tileIds.monsterActive
            ? context.tileIds.empty
            : tileId === context.tileIds.fallingRock || tileId === context.tileIds.fallingDiamond
              ? context.tileIds.empty
              : exitBlinkTileId ?? tileId;
        const frame = context.getTileFrame(spawnBlinkTileId ?? renderTileId);
        if ((hasDynamicEntity || hasPlayerEntity) && spawnBlinkTileId === undefined) {
          continue;
        }

        renderer.drawTile(frame, screenPosition.x, screenPosition.y);
      }
    }
  }

  /** Rend les entites et objets physiques selon les couches actuelles. */
  private drawEntitiesAndObjects(renderer: Renderer, context: GameplayRenderContext): void {
    if (!context.tileAtlasLoaded) {
      return;
    }

    this.drawEntitiesByLayer(renderer, context, false);
    this.drawPhysicalObjects(renderer, context);
    this.drawEntitiesByLayer(renderer, context, true);
  }

  /** Rend les objets physiques actifs avec interpolation visuelle. */
  private drawPhysicalObjects(renderer: Renderer, context: GameplayRenderContext): void {
    const cullViewportX = Math.floor(context.viewport.x);
    const cullViewportY = Math.floor(context.viewport.y);

    for (const fallingObject of context.state.fallingObjects) {
      const progress = fallingObject.elapsed / fallingObject.duration;
      const { x: gridX, y: gridY } = getInterpolatedFallingObjectGridPosition(fallingObject, progress);
      if (
        gridX < cullViewportX - 1 ||
        gridX >= cullViewportX + context.viewport.columns + 2 ||
        gridY < cullViewportY - 1 ||
        gridY >= cullViewportY + context.viewport.rows + 2
      ) {
        continue;
      }

      const frame = fallingObject.kind === "diamond"
        ? context.getDiamondTileFrame()
        : context.getTileFrame(context.tileIds.rock);
      renderer.drawTile(
        frame,
        Math.round(context.boardOffsetX + (gridX - context.viewport.x) * context.tileSize),
        Math.round(context.boardOffsetY + (gridY - context.viewport.y) * context.tileSize)
      );
    }
  }

  /** Rend les entites non joueur puis joueur selon la couche demandee. */
  private drawEntitiesByLayer(renderer: Renderer, context: GameplayRenderContext, playerLayer: boolean): void {
    for (const entity of context.state.entities) {
      if (!entity.active) {
        continue;
      }

      if ((entity.kind === "player") !== playerLayer) {
        continue;
      }

      if (entity.kind === "player" && context.isPlayerSpawning()) {
        continue;
      }

      if (entity.kind === "rock") {
        continue;
      }

      if (entity.kind === "diamond" && context.state.fallingObjects.some((object) => object.entityId === entity.id)) {
        continue;
      }

      const cullViewportX = Math.floor(context.viewport.x);
      const cullViewportY = Math.floor(context.viewport.y);
      const entityGridX = entity.gridX;
      const entityGridY = entity.gridY;
      if (!isEntityGridPositionVisible(
        entityGridX,
        entityGridY,
        { x: cullViewportX, y: cullViewportY, columns: context.viewport.columns, rows: context.viewport.rows }
      )) {
        continue;
      }

      const frame = entity.kind === "diamond"
        ? context.getDiamondTileFrame()
        : entity.kind === "monster"
          ? context.getMonsterTileFrame()
          : entity.kind === "specialCreature"
            ? context.getTileFrame(context.tileIds.specialCreature)
            : context.getTileFrame(context.getEntityTileFrameId(entity.kind));
      renderer.drawTile(
        frame,
        Math.round(context.boardOffsetX + (entityGridX - context.viewport.x) * context.tileSize),
        Math.round(context.boardOffsetY + (entityGridY - context.viewport.y) * context.tileSize)
      );
    }
  }

  /** Dessine panneaux, compteurs, libelles et diamant anime du HUD. */
  private drawHud(renderer: Renderer, context: GameplayRenderContext): void {
    const { hud } = context.state;
    renderer.fillRect(0, PLAYFIELD_HEIGHT, 320, 40, TO8_PALETTE.black);

    if (context.leftHudPanelImage) {
      renderer.drawImage(context.leftHudPanelImage, 0, PLAYFIELD_HEIGHT);
    }
    if (context.rightHudPanelImage) {
      renderer.drawImage(context.rightHudPanelImage, HUD_RIGHT_PANEL_X, HUD_RIGHT_PANEL_Y);
      this.drawDynamicGalleryPanelContent(renderer, context);
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

  /** Dessine les compteurs live du panneau galerie droit. */
  private drawDynamicGalleryPanelContent(renderer: Renderer, context: GameplayRenderContext): void {
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
    this.drawHudGalleryDiamond(renderer, context.hudDiamondColorOffset);
    this.drawHudDigitValue(renderer, context.state.hud.gallery, HUD_GALLERY_COUNTER_X, HUD_RIGHT_COUNTER_Y);
    this.drawHudDigitValue(renderer, context.state.hud.diamonds, HUD_DIAMOND_COUNTER_X, HUD_RIGHT_COUNTER_Y);
  }

  /** Dessine l'animation ASM du diamant de panneau galerie. */
  private drawHudGalleryDiamond(renderer: Renderer, colorOffset: number): void {
    renderer.fillRect(
      HUD_GALLERY_DIAMOND_X,
      HUD_GALLERY_DIAMOND_Y,
      HUD_GALLERY_DIAMOND_WIDTH,
      HUD_GALLERY_DIAMOND_HEIGHT,
      HUD_PANEL_ORANGE
    );

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

  /** Dessine un compteur HUD bleu a deux chiffres. */
  private drawHudDigitValue(renderer: Renderer, value: number, x: number, y: number): void {
    drawHudSmallCounter(renderer, value, 2, x, y, {
      fontId: HUD_SMALL_COUNTER_FONT_ID,
      color: HUD_SMALL_COUNTER_COLOR
    });
  }

  /** Dessine le flash de cadre declenche quand l'objectif de diamants est atteint. */
  private drawObjectiveReachedFlash(renderer: Renderer, context: GameplayRenderContext): void {
    if (context.objectiveReachedFlashPhase === null || context.objectiveReachedFlashPhase % 2 !== 0) {
      return;
    }

    renderer.fillRect(0, 0, renderer.width, OBJECTIVE_FLASH_BORDER_SIZE, OBJECTIVE_FLASH_RED);
    renderer.fillRect(0, 0, OBJECTIVE_FLASH_BORDER_SIZE, PLAYFIELD_HEIGHT, OBJECTIVE_FLASH_RED);
    renderer.fillRect(
      renderer.width - OBJECTIVE_FLASH_BORDER_SIZE,
      0,
      OBJECTIVE_FLASH_BORDER_SIZE,
      PLAYFIELD_HEIGHT,
      OBJECTIVE_FLASH_YELLOW
    );
    renderer.fillRect(
      0,
      renderer.height - OBJECTIVE_FLASH_BORDER_SIZE,
      renderer.width,
      OBJECTIVE_FLASH_BORDER_SIZE,
      OBJECTIVE_FLASH_YELLOW
    );
  }
}

/** Convertit un attribut TO8 en couleur CSS selon le plan forme/couleur. */
function to8ColorFromAttribute(attribute: number, shape: boolean): string {
  const background = ((attribute & 0x07) | ((~attribute & 0x80) >> 4)) & 0x0f;
  const foreground = (((attribute >> 3) & 0x07) | ((~attribute & 0x40) >> 3)) & 0x0f;
  const [red, green, blue] = TO8_DEFAULT_RGB4[shape ? foreground : background];
  return rgbToHex(TO8_INTENSITIES[red], TO8_INTENSITIES[green], TO8_INTENSITIES[blue]);
}

/** Convertit des canaux RGB en couleur hex CSS. */
function rgbToHex(red: number, green: number, blue: number): string {
  return `#${hexByte(red)}${hexByte(green)}${hexByte(blue)}`;
}

/** Formate un octet couleur sous forme hexadecimale. */
function hexByte(value: number): string {
  return value.toString(16).padStart(2, "0");
}
