/**
 * Role: Fournit la scene moderne d'edition de niveaux.
 * Scope: Rend la grille dans le canvas et expose les controles via une IHM DOM moderne.
 * ISO: Les tuiles posees reutilisent les atlas runtime; les overlays restent separes du rendu gameplay.
 * Notes: L'IHM n'est plus contrainte par le style TO8 plein canvas.
 */

import { RuntimeAssets } from "../assets/runtime-asset-loader";
import { TO8_PALETTE } from "../assets/palette";
import { THOMSON_8_BIT_FONT } from "../assets/generated/thomson-8-bit-font";
import type { InputState } from "../engine/input";
import type { Renderer } from "../engine/renderer";
import type { Scene, SceneContext } from "../engine/scene";
import { getModernLevelSource, type ModernTileType } from "../game/level-loader";
import { secondsFromTo8Ticks, TO8_RUNTIME_TIMING } from "../game/runtime-timing";
import { GameplayScene } from "../screens/gameplay-scene";
import {
  DEFAULT_EDITOR_TILE,
  DEFAULT_EDITOR_TOOL,
  LEVEL_EDITOR_TILE_PALETTE,
  LEVEL_EDITOR_TOOL_PALETTE,
  type LevelEditorPaletteItem,
  type LevelEditorTool
} from "./level-editor-palette";
import {
  setEditableLevelDefaultTile,
  setEditableLevelAuthor,
  setEditableLevelCreatedDate,
  setEditableLevelId,
  setEditableLevelLabel,
  setEditableLevelRequiredDiamonds,
  setEditableLevelScoreStep,
  setEditableLevelSize,
  setEditableLevelSourceKind,
  setEditableLevelTime
} from "./level-editor-properties";
import { LevelEditorRenderer } from "./level-editor-renderer";
import {
  EDITOR_TILE_SIZE,
  createEmptyEditableLevelState,
  getEditableTileAt,
  type EditableLevelState
} from "./level-editor-state";
import { LEVEL_EDITOR_THEME } from "./level-editor-theme";
import { exportEditableLevelToJson, parseEditableLevelJson, stringifyEditableLevel } from "./level-editor-serialization";
import {
  applyEditorRectangle,
  applyEditorToolAtCell,
  panEditorViewport,
  pointerToEditorCell,
  zoomEditorViewport,
  type LevelEditorPointerCell,
  type LevelEditorRectangleDraft,
  type LevelEditorViewport
} from "./level-editor-tools";
import { validateEditableLevel } from "./level-editor-validation";

/** Position X de la grille dans le canvas logique. */
const EDITOR_GRID_X = 0;
/** Position Y de la grille dans le canvas logique. */
const EDITOR_GRID_Y = 0;
/** Nombre de colonnes visibles dans l'editeur moderne. */
const EDITOR_VISIBLE_COLUMNS = 20;
/** Nombre de lignes visibles dans l'editeur moderne. */
const EDITOR_VISIBLE_ROWS = 12;
/** Largeur logique de la zone visible de grille. */
const EDITOR_GRID_VIEW_WIDTH = EDITOR_VISIBLE_COLUMNS * EDITOR_TILE_SIZE;
/** Hauteur logique de la zone visible de grille. */
const EDITOR_GRID_VIEW_HEIGHT = EDITOR_VISIBLE_ROWS * EDITOR_TILE_SIZE;
/** Cle de stockage local du brouillon editeur. */
const EDITOR_DRAFT_STORAGE_KEY = "la-mine-editor-draft";
/** Taille maximale de l'historique undo. */
const EDITOR_HISTORY_LIMIT = 120;
/** Cadences d'animation editeur alignees sur le runtime gameplay. */
const EDITOR_ANIMATION_FRAME_DURATIONS = {
  player: secondsFromTo8Ticks(TO8_RUNTIME_TIMING.playerAnimationFrameTicks),
  diamond: secondsFromTo8Ticks(TO8_RUNTIME_TIMING.diamondAnimationFrameTicks),
  monster: secondsFromTo8Ticks(TO8_RUNTIME_TIMING.monsterAnimationFrameTicks),
  exit: secondsFromTo8Ticks(TO8_RUNTIME_TIMING.exitBlinkFrameTicks)
} as const;
/** Couleur tres discrete de la grille editeur, volontairement non multipliee par cellule. */
const EDITOR_GRID_OVERLAY_COLOR = "rgba(134, 255, 222, 0.12)";

/** Scene editeur moderne, branchee sur le routeur de scenes existant. */
export class LevelEditorScene implements Scene {
  /** Etat editable courant. */
  private editorState: EditableLevelState = createEmptyEditableLevelState();
  /** Contexte de navigation courant. */
  private context: SceneContext | undefined;
  /** Renderer dedie aux tuiles de l'editeur. */
  private readonly editorRenderer = new LevelEditorRenderer();
  /** Assets runtime charges pour obtenir le meme rendu que le jeu. */
  private readonly runtimeAssets = new RuntimeAssets();
  /** Racine DOM de l'IHM moderne. */
  private editorUiRoot: HTMLElement | null = null;
  /** Viewport courant de la grille editable. */
  private readonly viewport: LevelEditorViewport = {
    gridX: EDITOR_GRID_X,
    gridY: EDITOR_GRID_Y,
    visibleColumns: EDITOR_VISIBLE_COLUMNS,
    visibleRows: EDITOR_VISIBLE_ROWS,
    offsetX: 0,
    offsetY: 0,
    zoom: 1
  };
  /** Tuile courante de la palette. */
  private selectedTile: ModernTileType = DEFAULT_EDITOR_TILE;
  /** Outil courant. */
  private selectedTool: LevelEditorTool = DEFAULT_EDITOR_TOOL;
  /** Cellule actuellement survolee. */
  private hoverCell: LevelEditorPointerCell | null = null;
  /** Brouillon du rectangle en cours. */
  private rectangleDraft: LevelEditorRectangleDraft | null = null;
  /** Etats precedents pour undo. */
  private readonly undoStack: string[] = [];
  /** Etats annules pour redo. */
  private readonly redoStack: string[] = [];
  /** Indique si le brouillon courant diverge du dernier export. */
  private dirty = false;
  /** Accumulateurs d'animation editeur par famille runtime. */
  private readonly animationElapsed = {
    player: 0,
    diamond: 0,
    monster: 0,
    exit: 0
  };
  /** Frames d'animation editeur par famille runtime. */
  private readonly animationFrameIndex = {
    player: 0,
    diamond: 0,
    monster: 0,
    exit: 0
  };
  /** Indique si la grille fine est affichee par-dessus le rendu runtime. */
  private gridOverlayVisible = true;
  /** Position de depart du drag souris pour deplacer la carte. */
  private panDragStart: { x: number; y: number; offsetX: number; offsetY: number } | null = null;
  /** Handler stable des raccourcis editeur. */
  private readonly keyDownHandler = (event: KeyboardEvent): void => {
    this.handleShortcut(event);
  };

  /** Cree une scene editeur avec un etat initial optionnel. */
  constructor(initialState?: EditableLevelState) {
    if (initialState) {
      this.editorState = initialState;
    }
  }

  /** Installe les raccourcis, l'IHM moderne et restaure un brouillon local si possible. */
  enter(context: SceneContext): void {
    this.context = context;
    document.body.classList.add("level-editor-active");
    window.addEventListener("keydown", this.keyDownHandler);
    this.restoreLocalDraft();
    this.mountModernEditorUi();
    void this.runtimeAssets.load().then(() => {
      if (this.runtimeAssets.tileAtlas) this.editorRenderer.setTilesAtlasImage(this.runtimeAssets.tileAtlas);
      if (this.runtimeAssets.playerAtlas) this.editorRenderer.setPlayerAtlasImage(this.runtimeAssets.playerAtlas);
      if (this.runtimeAssets.diamondAtlas) this.editorRenderer.setDiamondAtlasImage(this.runtimeAssets.diamondAtlas);
      if (this.runtimeAssets.monsterAtlas) this.editorRenderer.setMonsterAtlasImage(this.runtimeAssets.monsterAtlas);
      if (this.runtimeAssets.specialCreatureAtlas) this.editorRenderer.setSpecialCreatureAtlasImage(this.runtimeAssets.specialCreatureAtlas);
      this.refreshPalettePreviews();
    });
  }

  /** Detache les raccourcis et l'IHM DOM. */
  exit(): void {
    window.removeEventListener("keydown", this.keyDownHandler);
    document.body.classList.remove("level-editor-active");
    this.editorUiRoot?.remove();
    this.editorUiRoot = null;
  }

  /** Met a jour l'editeur moderne. */
  update(dt: number, input: InputState): void {
    this.advanceAnimations(dt);
    zoomEditorViewport(this.viewport, input.pointer.wheelDeltaY);
    this.updateVisibleCellCount();
    if (input.pressed.action && (input.horizontal !== 0 || input.vertical !== 0)) {
      panEditorViewport(this.viewport, this.editorState, input.horizontal, input.vertical);
    }

    this.hoverCell = pointerToEditorCell(input.pointer, this.viewport);
    this.handleGridPointer(input);
    this.refreshModernEditorUi();
  }

  /** Rend uniquement la surface d'edition: grille, tuiles et overlays. */
  render(renderer: Renderer): void {
    renderer.clear("#07100d");
    this.renderGrid(renderer);
    this.renderMarkers(renderer);
    this.renderHover(renderer);
  }

  /** Rend la grille editable a la taille reelle d'une tuile. */
  private renderGrid(renderer: Renderer): void {
    const tileSize = this.getRenderedTileSize();
    const gridWidth = this.viewport.visibleColumns * tileSize;
    const gridHeight = this.viewport.visibleRows * tileSize;
    this.viewport.gridX = Math.max(0, Math.floor((renderer.width - gridWidth) / 2));
    this.viewport.gridY = Math.max(0, Math.floor((renderer.height - gridHeight) / 2));

    renderer.fillRect(0, 0, renderer.width, renderer.height, "#020604");

    for (let y = 0; y < this.viewport.visibleRows; y += 1) {
      for (let x = 0; x < this.viewport.visibleColumns; x += 1) {
        const tile = getEditableTileAt(this.editorState, this.viewport.offsetX + x, this.viewport.offsetY + y);
        const screenX = this.viewport.gridX + x * tileSize;
        const screenY = this.viewport.gridY + y * tileSize;
        this.editorRenderer.renderTile(renderer, tile, screenX, screenY, this.getTileAnimationFrameIndex(tile), tileSize);
      }
    }

    if (this.gridOverlayVisible) {
      this.renderGridOverlay(renderer, gridWidth, gridHeight, tileSize);
    }
  }

  /** Rend une grille fine en lignes uniques pour conserver la meme epaisseur au zoom. */
  private renderGridOverlay(renderer: Renderer, gridWidth: number, gridHeight: number, tileSize: number): void {
    for (let x = 0; x <= this.viewport.visibleColumns; x += 1) {
      const lineX = this.viewport.gridX + x * tileSize;
      renderer.fillRect(lineX, this.viewport.gridY, 1, gridHeight, EDITOR_GRID_OVERLAY_COLOR);
    }

    for (let y = 0; y <= this.viewport.visibleRows; y += 1) {
      const lineY = this.viewport.gridY + y * tileSize;
      renderer.fillRect(this.viewport.gridX, lineY, gridWidth, 1, EDITOR_GRID_OVERLAY_COLOR);
    }
  }

  /** Rend les overlays de spawn et sortie sans remplacer la tuile. */
  private renderMarkers(renderer: Renderer): void {
    this.renderPlayerSpawnMarker(renderer);
    this.renderExitMarker(renderer);
  }

  /** Rend le sprite idle du joueur a l'emplacement de spawn. */
  private renderPlayerSpawnMarker(renderer: Renderer): void {
    const visibleX = this.editorState.playerSpawn.x - this.viewport.offsetX;
    const visibleY = this.editorState.playerSpawn.y - this.viewport.offsetY;
    if (visibleX < 0 || visibleY < 0 || visibleX >= this.viewport.visibleColumns || visibleY >= this.viewport.visibleRows) {
      return;
    }

    const tileSize = this.getRenderedTileSize();
    const screenX = this.viewport.gridX + visibleX * tileSize;
    const screenY = this.viewport.gridY + visibleY * tileSize;
    this.editorRenderer.renderPlayerIdle(renderer, screenX, screenY, this.animationFrameIndex.player, tileSize);
  }

  /** Rend la sortie comme la tuile runtime `0x04` clignotant avec le noir. */
  private renderExitMarker(renderer: Renderer): void {
    const visibleX = this.editorState.exit.x - this.viewport.offsetX;
    const visibleY = this.editorState.exit.y - this.viewport.offsetY;
    if (visibleX < 0 || visibleY < 0 || visibleX >= this.viewport.visibleColumns || visibleY >= this.viewport.visibleRows) {
      return;
    }

    const tileSize = this.getRenderedTileSize();
    const screenX = this.viewport.gridX + visibleX * tileSize;
    const screenY = this.viewport.gridY + visibleY * tileSize;
    const exitTile = this.animationFrameIndex.exit % 2 === 0 ? "border" : "empty";
    this.editorRenderer.renderTile(renderer, exitTile, screenX, screenY, this.animationFrameIndex.exit, tileSize);
  }

  /** Rend le curseur courant sur la grille. */
  private renderHover(renderer: Renderer): void {
    if (!this.hoverCell) {
      return;
    }

    const visibleX = this.hoverCell.x - this.viewport.offsetX;
    const visibleY = this.hoverCell.y - this.viewport.offsetY;
    const tileSize = this.getRenderedTileSize();
    const screenX = this.viewport.gridX + visibleX * tileSize;
    const screenY = this.viewport.gridY + visibleY * tileSize;
    renderer.strokeRect(screenX + 1, screenY + 1, tileSize - 2, tileSize - 2, TO8_PALETTE.yellow);
  }

  /** Rend un marqueur de spawn ou de sortie sur la grille visible. */
  private renderMarker(renderer: Renderer, gridX: number, gridY: number, label: string, color: string): void {
    const visibleX = gridX - this.viewport.offsetX;
    const visibleY = gridY - this.viewport.offsetY;
    if (visibleX < 0 || visibleY < 0 || visibleX >= this.viewport.visibleColumns || visibleY >= this.viewport.visibleRows) {
      return;
    }

    const tileSize = this.getRenderedTileSize();
    const screenX = this.viewport.gridX + visibleX * tileSize;
    const screenY = this.viewport.gridY + visibleY * tileSize;
    renderer.strokeRect(screenX + 2, screenY + 2, tileSize - 4, tileSize - 4, color);
    if (tileSize >= 12) {
      renderer.drawPixelText(label, screenX + Math.max(3, tileSize / 3), screenY + Math.max(3, tileSize / 3), color, 1);
    }
  }

  /** Monte l'IHM moderne DOM autour du canvas existant. */
  private mountModernEditorUi(): void {
    this.editorUiRoot?.remove();
    const root = document.createElement("section");
    root.className = "level-editor-modern-ui";
    root.innerHTML = this.createModernEditorMarkup();
    document.body.append(root);
    this.editorUiRoot = root;
    this.bindModernEditorUi(root);
    this.renderToolbarTitle(root);
    this.refreshModernEditorUi();
  }

  /** Cree le markup statique de l'IHM moderne. */
  private createModernEditorMarkup(): string {
    return `
      <header class="level-editor-toolbar" aria-label="Barre d'outils editeur">
        <div class="level-editor-toolbar-brand">
          <canvas class="level-editor-toolbar-title" data-editor-toolbar-title width="496" height="16" aria-label="La Mine aux Diamants - Editeur"></canvas>
        </div>
        <button type="button" data-editor-action="new">Nouveau</button>
        <button type="button" data-editor-action="import">Importer</button>
        <button type="button" data-editor-action="export">Exporter</button>
        <span class="level-editor-toolbar-separator"></span>
        <button type="button" data-editor-action="undo">Annuler</button>
        <button type="button" data-editor-action="redo">Retablir</button>
        <span class="level-editor-toolbar-separator"></span>
        <button type="button" data-editor-action="zoom-out">-</button>
        <span class="level-editor-zoom-label" data-editor-zoom>100%</span>
        <button type="button" data-editor-action="zoom-in">+</button>
        <label class="level-editor-toolbar-toggle"><input data-editor-grid-toggle type="checkbox" checked /> Grille</label>
        <button type="button" class="level-editor-toolbar-primary" data-editor-action="test">Tester</button>
      </header>
      <main class="level-editor-workbench" aria-label="Editeur de niveau">
        <aside class="level-editor-panel level-editor-panel-left" aria-label="Palette de niveau">
          <section class="level-editor-section">
            <div class="level-editor-panel-header">
              <span>Palette</span>
              <small>Rendu jeu</small>
            </div>
            <div class="level-editor-palette" data-editor-palette></div>
          </section>
          <section class="level-editor-section">
            <div class="level-editor-panel-header level-editor-tools-title">
              <span>Outils</span>
              <small>Edition</small>
            </div>
            <div class="level-editor-tools" data-editor-tools></div>
          </section>
        </aside>
        <aside class="level-editor-panel level-editor-panel-right" aria-label="Proprietes du niveau">
          <section class="level-editor-section">
            <div class="level-editor-panel-header">
              <span>Proprietes</span>
              <small data-editor-dirty>A jour</small>
            </div>
            <label class="level-editor-field">ID<input data-editor-field="id" type="text" /></label>
            <label class="level-editor-field">Nom<input data-editor-field="label" type="text" /></label>
            <label class="level-editor-field">Auteur<input data-editor-field="author" type="text" /></label>
            <label class="level-editor-field">Date<input data-editor-field="createdDate" type="date" /></label>
            <div class="level-editor-field-grid">
              <label class="level-editor-field">Largeur<input data-editor-field="width" type="number" min="10" max="80" /></label>
              <label class="level-editor-field">Hauteur<input data-editor-field="height" type="number" min="8" max="60" /></label>
            </div>
            <div class="level-editor-field-grid">
              <label class="level-editor-field">Temps<input data-editor-field="time" type="number" min="1" max="999" /></label>
              <label class="level-editor-field">Score<input data-editor-field="scoreStep" type="number" min="0" max="9999" /></label>
            </div>
            <label class="level-editor-field">Diamants requis<input data-editor-field="requiredDiamonds" type="number" min="0" max="999" /></label>
          </section>
          <section class="level-editor-section">
            <div class="level-editor-panel-header">
              <span>Verification</span>
              <small>Live</small>
            </div>
            <div class="level-editor-diagnostics" data-editor-diagnostics></div>
          </section>
        </aside>
      </main>
      <footer class="level-editor-statusbar" aria-label="Statut editeur">
        <span data-editor-status-position>X : - Y : -</span>
        <span data-editor-status-tool>Outil : Crayon</span>
        <span data-editor-status-level></span>
        <span class="level-editor-status-hint">Molette : zoom | Outil deplacement : drag souris | Clic droit : effacer</span>
      </footer>
    `;
  }

  /** Branche les evenements de l'IHM moderne. */
  private bindModernEditorUi(root: HTMLElement): void {
    const palette = root.querySelector<HTMLElement>("[data-editor-palette]");
    const tools = root.querySelector<HTMLElement>("[data-editor-tools]");
    if (palette) {
      palette.replaceChildren(...LEVEL_EDITOR_TILE_PALETTE.map((item) => this.createPaletteButton(item)));
    }
    if (tools) {
      tools.replaceChildren(...LEVEL_EDITOR_TOOL_PALETTE.map((item) => this.createToolButton(item)));
    }

    root.querySelectorAll<HTMLInputElement>("[data-editor-field]").forEach((input) => {
      input.addEventListener("change", () => this.applyModernFieldChange(input));
    });
    root.querySelector<HTMLElement>("[data-editor-action='export']")?.addEventListener("click", () => this.exportCurrentLevel());
    root.querySelector<HTMLElement>("[data-editor-action='import']")?.addEventListener("click", () => this.importFromLocalFile());
    root.querySelector<HTMLElement>("[data-editor-action='test']")?.addEventListener("click", () => this.startRuntimeTest());
    root.querySelector<HTMLElement>("[data-editor-action='new']")?.addEventListener("click", () => this.discardLocalDraft());
    root.querySelector<HTMLElement>("[data-editor-action='undo']")?.addEventListener("click", () => this.undo());
    root.querySelector<HTMLElement>("[data-editor-action='redo']")?.addEventListener("click", () => this.redo());
    root.querySelector<HTMLElement>("[data-editor-action='zoom-in']")?.addEventListener("click", () => {
      this.viewport.zoom = Math.min(2, this.viewport.zoom === 0.5 ? 1 : this.viewport.zoom + 1);
      this.refreshModernEditorUi();
    });
    root.querySelector<HTMLElement>("[data-editor-action='zoom-out']")?.addEventListener("click", () => {
      this.viewport.zoom = Math.max(0.5, this.viewport.zoom === 2 ? 1 : this.viewport.zoom - 0.5);
      this.refreshModernEditorUi();
    });
    root.querySelector<HTMLInputElement>("[data-editor-grid-toggle]")?.addEventListener("change", (event) => {
      this.gridOverlayVisible = event.currentTarget instanceof HTMLInputElement ? event.currentTarget.checked : this.gridOverlayVisible;
    });
  }

  /** Dessine le titre de toolbar avec la font bitmap TO8 procedurale du moteur. */
  private renderToolbarTitle(root: HTMLElement): void {
    const canvas = root.querySelector<HTMLCanvasElement>("[data-editor-toolbar-title]");
    const context = canvas?.getContext("2d");
    if (!canvas || !context) {
      return;
    }

    const title = "La Mine aux Diamants";
    const suffix = " - Editeur";
    const font = THOMSON_8_BIT_FONT;
    const scale = 2;
    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, canvas.width, canvas.height);
    let cursorX = 0;

    const drawText = (text: string, color: string): void => {
      context.fillStyle = color;
      for (const character of text) {
        const glyph = font.glyphs[character] ?? font.glyphs["?"];
        if (!glyph) {
          cursorX += font.width * scale;
          continue;
        }

        for (let row = 0; row < font.height; row += 1) {
          const bits = glyph[row] ?? "";
          for (let column = 0; column < font.width; column += 1) {
            if (bits[column] === "1") {
              context.fillRect(cursorX + column * scale, row * scale, scale, scale);
            }
          }
        }
        cursorX += font.width * scale;
      }
    };

    drawText(title, "#4488ff");
    drawText(suffix, "#f4f7ff");
  }

  /** Cree un bouton de palette moderne. */
  private createPaletteButton(item: LevelEditorPaletteItem): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "level-editor-chip";
    button.dataset.tile = item.tileType ?? "";
    button.title = item.hint;
    button.innerHTML = `<canvas class="level-editor-chip-preview" data-editor-preview-tile="${item.tileType ?? ""}" width="32" height="32" aria-hidden="true"></canvas><span class="level-editor-chip-text"><span class="level-editor-chip-label">${item.label}</span><small>${item.hint}</small></span>`;
    const preview = button.querySelector<HTMLCanvasElement>("[data-editor-preview-tile]");
    if (preview && item.tileType) {
      this.editorRenderer.renderTilePreview(preview, item.tileType);
    }
    button.addEventListener("click", () => {
      if (item.tileType) {
        this.selectedTile = item.tileType;
        this.selectedTool = "pencil";
        this.refreshModernEditorUi();
      }
    });
    return button;
  }

  /** Redessine les apercus de palette depuis les atlas runtime charges. */
  private refreshPalettePreviews(): void {
    this.editorUiRoot?.querySelectorAll<HTMLCanvasElement>("[data-editor-preview-tile]").forEach((canvas) => {
      const tileType = canvas.dataset.editorPreviewTile as ModernTileType | undefined;
      if (tileType) {
        this.editorRenderer.renderTilePreview(canvas, tileType);
      }
    });
  }

  /** Cree un bouton d'outil moderne. */
  private createToolButton(item: LevelEditorPaletteItem): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "level-editor-tool-button";
    button.dataset.tool = item.tool ?? "";
    button.title = item.hint;
    button.innerHTML = `${item.svg}<span>${item.label}</span>`;
    button.addEventListener("click", () => {
      if (item.tool) {
        this.selectedTool = item.tool;
        this.refreshModernEditorUi();
      }
    });
    return button;
  }

  /** Synchronise l'IHM DOM avec l'etat courant. */
  private refreshModernEditorUi(): void {
    const root = this.editorUiRoot;
    if (!root) {
      return;
    }

    root.querySelectorAll<HTMLElement>("[data-tile]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.tile === this.selectedTile);
    });
    root.querySelectorAll<HTMLElement>("[data-tool]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.tool === this.selectedTool);
    });
    this.setFieldValue(root, "id", this.editorState.id);
    this.setFieldValue(root, "label", this.editorState.label);
    this.setFieldValue(root, "author", this.editorState.author);
    this.setFieldValue(root, "createdDate", this.editorState.createdDate);
    this.setFieldValue(root, "width", String(this.editorState.width));
    this.setFieldValue(root, "height", String(this.editorState.height));
    this.setFieldValue(root, "time", String(this.editorState.time));
    this.setFieldValue(root, "scoreStep", String(this.editorState.scoreStep));
    this.setFieldValue(root, "requiredDiamonds", String(this.editorState.requiredDiamonds));
    const dirty = root.querySelector<HTMLElement>("[data-editor-dirty]");
    if (dirty) dirty.textContent = this.dirty ? "Brouillon" : "A jour";
    const zoom = root.querySelector<HTMLElement>("[data-editor-zoom]");
    if (zoom) zoom.textContent = `${Math.round(this.viewport.zoom * 100)}%`;
    const statusPosition = root.querySelector<HTMLElement>("[data-editor-status-position]");
    if (statusPosition) {
      statusPosition.textContent = this.hoverCell ? `X : ${this.hoverCell.x}  Y : ${this.hoverCell.y}` : "X : -  Y : -";
    }
    const statusTool = root.querySelector<HTMLElement>("[data-editor-status-tool]");
    if (statusTool) statusTool.textContent = `Outil : ${this.getSelectedToolLabel()}`;
    const statusLevel = root.querySelector<HTMLElement>("[data-editor-status-level]");
    if (statusLevel) statusLevel.textContent = `${this.editorState.label} - ${this.editorState.width}x${this.editorState.height}`;
    const diagnostics = validateEditableLevel(this.editorState).slice(0, 4);
    const diagnosticsRoot = root.querySelector<HTMLElement>("[data-editor-diagnostics]");
    if (diagnosticsRoot) {
      diagnosticsRoot.replaceChildren(
        ...diagnostics.map((diagnostic) => {
          const item = document.createElement("p");
          item.className = `level-editor-diagnostic level-editor-diagnostic-${diagnostic.severity}`;
          item.textContent = diagnostic.message;
          return item;
        })
      );
    }
  }

  /** Affecte une valeur de champ sans perturber la saisie active. */
  private setFieldValue(root: HTMLElement, field: string, value: string): void {
    const input = root.querySelector<HTMLInputElement>(`[data-editor-field='${field}']`);
    if (input && document.activeElement !== input && input.value !== value) {
      input.value = value;
    }
  }

  /** Applique une modification de champ DOM. */
  private applyModernFieldChange(input: HTMLInputElement): void {
    const field = input.dataset.editorField;
    this.recordHistory();
    if (field === "id") setEditableLevelId(this.editorState, input.value);
    if (field === "label") setEditableLevelLabel(this.editorState, input.value);
    if (field === "author") setEditableLevelAuthor(this.editorState, input.value);
    if (field === "createdDate") setEditableLevelCreatedDate(this.editorState, input.value);
    if (field === "width" || field === "height") setEditableLevelSize(this.editorState, Number(this.getFieldValue("width")), Number(this.getFieldValue("height")));
    if (field === "time") setEditableLevelTime(this.editorState, Number(input.value));
    if (field === "scoreStep") setEditableLevelScoreStep(this.editorState, Number(input.value));
    if (field === "requiredDiamonds") setEditableLevelRequiredDiamonds(this.editorState, Number(input.value));
    this.markDirtyAndSaveDraft();
    this.refreshModernEditorUi();
  }

  /** Retourne la valeur d'un champ DOM moderne. */
  private getFieldValue(field: string): string {
    return this.editorUiRoot?.querySelector<HTMLInputElement>(`[data-editor-field='${field}']`)?.value ?? "0";
  }

  /** Retourne le libelle utilisateur de l'outil selectionne. */
  private getSelectedToolLabel(): string {
    return LEVEL_EDITOR_TOOL_PALETTE.find((item) => item.tool === this.selectedTool)?.label ?? this.selectedTool;
  }

  /** Traite une interaction pointeur sur la grille. */
  private handleGridPointer(input: InputState): void {
    if (this.selectedTool === "selection") {
      this.handleMousePan(input);
      return;
    }

    if (this.selectedTool === "test" && input.pointer.justPressed) {
      this.startRuntimeTest();
      return;
    }

    const cell = this.hoverCell;
    if (!cell) {
      return;
    }

    if (input.pointer.rightJustPressed || input.pointer.rightPressed) {
      this.recordHistory();
      applyEditorToolAtCell(this.editorState, "eraser", this.selectedTile, cell);
      this.markDirtyAndSaveDraft();
      return;
    }

    if (this.selectedTool === "rectangle") {
      this.handleRectanglePointer(input, cell);
      return;
    }

    if (input.pointer.justPressed || (input.pointer.pressed && (this.selectedTool === "pencil" || this.selectedTool === "eraser"))) {
      this.recordHistory();
      applyEditorToolAtCell(this.editorState, this.selectedTool, this.selectedTile, cell);
      this.markDirtyAndSaveDraft();
    }
  }

  /** Traite l'outil rectangle simple. */
  private handleRectanglePointer(input: InputState, cell: LevelEditorPointerCell): void {
    if (input.pointer.justPressed) {
      this.rectangleDraft = { start: cell, end: cell };
    } else if (input.pointer.pressed && this.rectangleDraft) {
      this.rectangleDraft = { start: this.rectangleDraft.start, end: cell };
    } else if (input.pointer.justReleased && this.rectangleDraft) {
      this.recordHistory();
      applyEditorRectangle(this.editorState, this.selectedTile, { start: this.rectangleDraft.start, end: cell });
      this.rectangleDraft = null;
      this.markDirtyAndSaveDraft();
    }
  }

  /** Deplace le viewport avec la souris lorsque l'outil deplacement est actif. */
  private handleMousePan(input: InputState): void {
    if (input.pointer.justPressed) {
      this.panDragStart = {
        x: input.pointer.x,
        y: input.pointer.y,
        offsetX: this.viewport.offsetX,
        offsetY: this.viewport.offsetY
      };
      return;
    }

    if (!input.pointer.pressed || !this.panDragStart) {
      if (input.pointer.justReleased) {
        this.panDragStart = null;
      }
      return;
    }

    const tileSize = this.getRenderedTileSize();
    const dx = Math.round((this.panDragStart.x - input.pointer.x) / tileSize);
    const dy = Math.round((this.panDragStart.y - input.pointer.y) / tileSize);
    this.viewport.offsetX = this.clampViewportOffset(this.panDragStart.offsetX + dx, this.editorState.width, this.viewport.visibleColumns);
    this.viewport.offsetY = this.clampViewportOffset(this.panDragStart.offsetY + dy, this.editorState.height, this.viewport.visibleRows);
  }

  /** Met a jour le nombre de cellules visibles selon le zoom courant. */
  private updateVisibleCellCount(): void {
    const tileSize = this.getRenderedTileSize();
    this.viewport.visibleColumns = Math.max(1, Math.min(this.editorState.width, Math.floor(EDITOR_GRID_VIEW_WIDTH / tileSize)));
    this.viewport.visibleRows = Math.max(1, Math.min(this.editorState.height, Math.floor(EDITOR_GRID_VIEW_HEIGHT / tileSize)));
    this.viewport.offsetX = this.clampViewportOffset(this.viewport.offsetX, this.editorState.width, this.viewport.visibleColumns);
    this.viewport.offsetY = this.clampViewportOffset(this.viewport.offsetY, this.editorState.height, this.viewport.visibleRows);
  }

  /** Retourne la taille de rendu d'une tuile selon le zoom. */
  private getRenderedTileSize(): number {
    return Math.max(4, Math.round(EDITOR_TILE_SIZE * this.viewport.zoom));
  }

  /** Contraint un offset de viewport. */
  private clampViewportOffset(value: number, totalSize: number, visibleSize: number): number {
    return Math.min(Math.max(0, value), Math.max(0, totalSize - visibleSize));
  }

  /** Avance les animations legeres de l'editeur. */
  private advanceAnimations(dt: number): void {
    this.advanceEditorAnimation("player", dt);
    this.advanceEditorAnimation("diamond", dt);
    this.advanceEditorAnimation("monster", dt);
    this.advanceEditorAnimation("exit", dt);
  }

  /** Avance une horloge d'animation editeur alignee sur les constantes runtime. */
  private advanceEditorAnimation(animationKey: keyof typeof EDITOR_ANIMATION_FRAME_DURATIONS, dt: number): void {
    const duration = EDITOR_ANIMATION_FRAME_DURATIONS[animationKey];
    this.animationElapsed[animationKey] += dt;
    while (this.animationElapsed[animationKey] >= duration) {
      this.animationElapsed[animationKey] -= duration;
      this.animationFrameIndex[animationKey] = (this.animationFrameIndex[animationKey] + 1) % 64;
    }
  }

  /** Retourne la frame correspondant a la famille runtime de la tuile donnee. */
  private getTileAnimationFrameIndex(tile: ModernTileType): number {
    if (tile === "diamond") {
      return this.animationFrameIndex.diamond;
    }

    if (tile === "monster" || tile === "specialCreature") {
      return this.animationFrameIndex.monster;
    }

    return 0;
  }

  /** Traite les raccourcis clavier propres a l'editeur. */
  private handleShortcut(event: KeyboardEvent): void {
    if (event.ctrlKey && event.code === "KeyZ") {
      this.undo();
      event.preventDefault();
      return;
    }
    if (event.ctrlKey && event.code === "KeyY") {
      this.redo();
      event.preventDefault();
      return;
    }
    if (event.ctrlKey && event.code === "Delete") {
      this.discardLocalDraft();
      event.preventDefault();
      return;
    }
    if (event.ctrlKey && event.code === "KeyI") {
      this.importFromPrompt();
      event.preventDefault();
      return;
    }
    if (event.ctrlKey && event.code === "KeyL") {
      this.importFromLocalFile();
      event.preventDefault();
      return;
    }
    if (event.ctrlKey && event.code === "KeyO") {
      this.importExistingProjectLevel();
      event.preventDefault();
      return;
    }
    if (event.ctrlKey && event.code === "KeyE") {
      this.exportCurrentLevel();
      event.preventDefault();
      return;
    }
    if (event.code === "KeyS") this.selectedTool = "spawn";
    if (event.code === "KeyE") this.selectedTool = "exit";
    if (event.code === "KeyG") this.selectedTool = "pencil";
    if (event.code === "KeyT") {
      this.selectedTool = "test";
      if (event.ctrlKey) {
        this.startRuntimeTest();
      }
    }
    if (event.code === "KeyD") {
      this.recordHistory();
      setEditableLevelDefaultTile(this.editorState, this.selectedTile);
      this.markDirtyAndSaveDraft();
    }
    if (event.code === "KeyK") {
      this.recordHistory();
      this.cycleSourceKind();
      this.markDirtyAndSaveDraft();
    }
    this.refreshModernEditorUi();
  }

  /** Alterne le type de source documentaire du niveau. */
  private cycleSourceKind(): void {
    const kinds = ["normal", "debug", "attract", "custom"] as const;
    const index = kinds.indexOf(this.editorState.sourceKind);
    setEditableLevelSourceKind(this.editorState, kinds[(index + 1) % kinds.length]);
  }

  /** Enregistre l'etat courant avant une mutation annulable. */
  private recordHistory(): void {
    this.undoStack.push(stringifyEditableLevel(this.editorState));
    if (this.undoStack.length > EDITOR_HISTORY_LIMIT) {
      this.undoStack.shift();
    }
    this.redoStack.length = 0;
  }

  /** Annule la derniere mutation si possible. */
  private undo(): void {
    const previous = this.undoStack.pop();
    if (!previous) {
      return;
    }
    this.redoStack.push(stringifyEditableLevel(this.editorState));
    this.editorState = parseEditableLevelJson(previous);
    this.markDirtyAndSaveDraft();
    this.refreshModernEditorUi();
  }

  /** Retablit la derniere mutation annulee si possible. */
  private redo(): void {
    const next = this.redoStack.pop();
    if (!next) {
      return;
    }
    this.undoStack.push(stringifyEditableLevel(this.editorState));
    this.editorState = parseEditableLevelJson(next);
    this.markDirtyAndSaveDraft();
    this.refreshModernEditorUi();
  }

  /** Marque l'etat courant comme modifie et sauvegarde le brouillon. */
  private markDirtyAndSaveDraft(): void {
    this.dirty = true;
    try {
      window.localStorage.setItem(EDITOR_DRAFT_STORAGE_KEY, stringifyEditableLevel(this.editorState));
    } catch {
      // Le stockage local est optionnel.
    }
  }

  /** Restaure le brouillon local sauvegarde. */
  private restoreLocalDraft(): void {
    try {
      const draft = window.localStorage.getItem(EDITOR_DRAFT_STORAGE_KEY);
      if (draft) {
        this.editorState = parseEditableLevelJson(draft);
        this.dirty = true;
      }
    } catch {
      // Un brouillon invalide ne doit pas bloquer l'editeur.
    }
  }

  /** Abandonne le brouillon local et revient a un niveau vide. */
  private discardLocalDraft(): void {
    this.editorState = createEmptyEditableLevelState();
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.dirty = false;
    try {
      window.localStorage.removeItem(EDITOR_DRAFT_STORAGE_KEY);
    } catch {
      // Le stockage local est optionnel.
    }
    this.refreshModernEditorUi();
  }

  /** Importe un JSON colle par l'utilisateur. */
  private importFromPrompt(): void {
    const value = window.prompt("Coller JSON niveau");
    if (!value) {
      return;
    }
    this.replaceStateFromJsonWithDiff(value);
  }

  /** Importe un JSON depuis un fichier local choisi par l'utilisateur. */
  private importFromLocalFile(): void {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) {
        return;
      }
      void file.text().then((content) => this.replaceStateFromJsonWithDiff(content));
    });
    input.click();
  }

  /** Importe un niveau officiel deja charge dans le projet. */
  private importExistingProjectLevel(): void {
    const value = window.prompt("Numero de niveau projet");
    if (!value) {
      return;
    }
    const levelNumber = Number(value);
    const source = Number.isFinite(levelNumber) ? getModernLevelSource(levelNumber) : undefined;
    if (!source) {
      window.alert("Niveau introuvable");
      return;
    }
    this.replaceStateFromJsonWithDiff(JSON.stringify(source, null, 2));
  }

  /** Remplace l'etat courant depuis JSON apres affichage d'un diff textuel simple. */
  private replaceStateFromJsonWithDiff(json: string): void {
    try {
      const nextState = parseEditableLevelJson(json);
      const diff = this.createTextDiffSummary(stringifyEditableLevel(this.editorState), stringifyEditableLevel(nextState));
      if (diff && !window.confirm(diff)) {
        return;
      }
      this.recordHistory();
      this.editorState = nextState;
      this.markDirtyAndSaveDraft();
      this.refreshModernEditorUi();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "JSON invalide");
    }
  }

  /** Cree un resume court des differences avant import. */
  private createTextDiffSummary(before: string, after: string): string {
    if (before === after) {
      return "";
    }
    return `Remplacer le niveau courant ?\nAvant: ${before.length} caracteres\nApres: ${after.length} caracteres`;
  }

  /** Exporte le niveau courant vers presse-papiers et fichier local. */
  private exportCurrentLevel(): void {
    const json = stringifyEditableLevel(this.editorState);
    void navigator.clipboard?.writeText(json).catch(() => undefined);
    this.downloadJson(json, `${this.editorState.id || "level-custom"}.json`);
    this.dirty = false;
    this.refreshModernEditorUi();
  }

  /** Telecharge un fichier JSON depuis une chaine. */
  private downloadJson(json: string, fileName: string): void {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  /** Lance le niveau courant dans le runtime gameplay temporaire. */
  private startRuntimeTest(): void {
    const blockingDiagnostic = validateEditableLevel(this.editorState).find((diagnostic) => diagnostic.severity === "error");
    if (blockingDiagnostic && !window.confirm(`${blockingDiagnostic.message}. Tester quand meme ?`)) {
      return;
    }
    const temporaryLevel = exportEditableLevelToJson(this.editorState);
    const recreateEditor = (): Scene => new LevelEditorScene(this.editorState);
    this.context?.setScene(
      new GameplayScene(0, () => recreateEditor(), () => recreateEditor(), {
        temporaryLevel,
        createEditorScene: recreateEditor
      })
    );
  }
}
