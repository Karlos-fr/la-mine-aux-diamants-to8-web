/**
 * Role: Fournit la scene moderne d'edition de niveaux.
 * Scope: Rend la grille dans le canvas et expose les controles via une IHM DOM moderne.
 * ISO: Les tuiles posees reutilisent les atlas runtime; les overlays restent separes du rendu gameplay.
 * Notes: L'IHM n'est plus contrainte par le style TO8 plein canvas.
 */

import { RuntimeAssets } from "../assets/runtime-asset-loader";
import { TO8_PALETTE } from "../assets/palette";
import type { InputState } from "../engine/input";
import type { Renderer } from "../engine/renderer";
import type { Scene, SceneContext } from "../engine/scene";
import { getModernLevelSource, type ModernTileType } from "../game/level-loader";
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
import { LEVEL_EDITOR_THEME, editorTileFallbackColor } from "./level-editor-theme";
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
const EDITOR_GRID_X = 24;
/** Position Y de la grille dans le canvas logique. */
const EDITOR_GRID_Y = 18;
/** Nombre de colonnes visibles dans l'editeur moderne. */
const EDITOR_VISIBLE_COLUMNS = 17;
/** Nombre de lignes visibles dans l'editeur moderne. */
const EDITOR_VISIBLE_ROWS = 10;
/** Largeur logique de la zone visible de grille. */
const EDITOR_GRID_VIEW_WIDTH = EDITOR_VISIBLE_COLUMNS * EDITOR_TILE_SIZE;
/** Hauteur logique de la zone visible de grille. */
const EDITOR_GRID_VIEW_HEIGHT = EDITOR_VISIBLE_ROWS * EDITOR_TILE_SIZE;
/** Cle de stockage local du brouillon editeur. */
const EDITOR_DRAFT_STORAGE_KEY = "la-mine-editor-draft";
/** Taille maximale de l'historique undo. */
const EDITOR_HISTORY_LIMIT = 120;
/** Duree d'une frame d'animation dans l'editeur. */
const EDITOR_ANIMATION_FRAME_DURATION = 0.12;

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
  /** Accumulateur d'animation palette. */
  private animationElapsed = 0;
  /** Frame d'animation courante pour tuiles animees. */
  private animationFrameIndex = 0;
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
      if (this.runtimeAssets.diamondAtlas) this.editorRenderer.setDiamondAtlasImage(this.runtimeAssets.diamondAtlas);
      if (this.runtimeAssets.monsterAtlas) this.editorRenderer.setMonsterAtlasImage(this.runtimeAssets.monsterAtlas);
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
    this.renderEditorBackdrop(renderer);
    this.renderGrid(renderer);
    this.renderMarkers(renderer);
    this.renderHover(renderer);
    this.renderCanvasStatus(renderer);
  }

  /** Rend un fond sobre, moderne et non intrusif. */
  private renderEditorBackdrop(renderer: Renderer): void {
    renderer.fillRect(0, 0, renderer.width, renderer.height, "#07100d");
    renderer.fillRect(14, 8, 292, 178, "#0d1713");
    renderer.strokeRect(14, 8, 292, 178, "#24483e");
    renderer.drawPixelText("LEVEL EDITOR", 24, 192, TO8_PALETTE.cyan, 1);
  }

  /** Rend la grille editable a la taille reelle d'une tuile. */
  private renderGrid(renderer: Renderer): void {
    const tileSize = this.getRenderedTileSize();
    const gridWidth = this.viewport.visibleColumns * tileSize;
    const gridHeight = this.viewport.visibleRows * tileSize;
    renderer.fillRect(EDITOR_GRID_X - 2, EDITOR_GRID_Y - 2, gridWidth + 4, gridHeight + 4, "#020604");
    renderer.strokeRect(EDITOR_GRID_X - 2, EDITOR_GRID_Y - 2, gridWidth + 4, gridHeight + 4, LEVEL_EDITOR_THEME.accent);

    for (let y = 0; y < this.viewport.visibleRows; y += 1) {
      for (let x = 0; x < this.viewport.visibleColumns; x += 1) {
        const tile = getEditableTileAt(this.editorState, this.viewport.offsetX + x, this.viewport.offsetY + y);
        const screenX = EDITOR_GRID_X + x * tileSize;
        const screenY = EDITOR_GRID_Y + y * tileSize;
        this.editorRenderer.renderTile(renderer, tile, screenX, screenY, this.animationFrameIndex, tileSize);
        if (this.gridOverlayVisible) {
          renderer.strokeRect(screenX, screenY, tileSize, tileSize, "rgba(134, 255, 222, 0.24)");
        }
      }
    }
  }

  /** Rend les overlays de spawn et sortie sans remplacer la tuile. */
  private renderMarkers(renderer: Renderer): void {
    this.renderMarker(renderer, this.editorState.playerSpawn.x, this.editorState.playerSpawn.y, "J", TO8_PALETTE.red);
    this.renderMarker(renderer, this.editorState.exit.x, this.editorState.exit.y, "S", TO8_PALETTE.yellow);
  }

  /** Rend le curseur courant sur la grille. */
  private renderHover(renderer: Renderer): void {
    if (!this.hoverCell) {
      return;
    }

    const visibleX = this.hoverCell.x - this.viewport.offsetX;
    const visibleY = this.hoverCell.y - this.viewport.offsetY;
    const tileSize = this.getRenderedTileSize();
    const screenX = EDITOR_GRID_X + visibleX * tileSize;
    const screenY = EDITOR_GRID_Y + visibleY * tileSize;
    renderer.strokeRect(screenX + 1, screenY + 1, tileSize - 2, tileSize - 2, TO8_PALETTE.yellow);
  }

  /** Rend un statut compact dans le canvas. */
  private renderCanvasStatus(renderer: Renderer): void {
    const hover = this.hoverCell
      ? `X${this.hoverCell.x} Y${this.hoverCell.y} ${getEditableTileAt(this.editorState, this.hoverCell.x, this.hoverCell.y)}`
      : "SURVOLER UNE CELLULE";
    renderer.drawPixelText(hover.slice(0, 32), 138, 192, TO8_PALETTE.white, 1);
  }

  /** Rend un marqueur de spawn ou de sortie sur la grille visible. */
  private renderMarker(renderer: Renderer, gridX: number, gridY: number, label: string, color: string): void {
    const visibleX = gridX - this.viewport.offsetX;
    const visibleY = gridY - this.viewport.offsetY;
    if (visibleX < 0 || visibleY < 0 || visibleX >= this.viewport.visibleColumns || visibleY >= this.viewport.visibleRows) {
      return;
    }

    const tileSize = this.getRenderedTileSize();
    const screenX = EDITOR_GRID_X + visibleX * tileSize;
    const screenY = EDITOR_GRID_Y + visibleY * tileSize;
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
    this.refreshModernEditorUi();
  }

  /** Cree le markup statique de l'IHM moderne. */
  private createModernEditorMarkup(): string {
    return `
      <aside class="level-editor-panel level-editor-panel-left" aria-label="Palette de niveau">
        <div class="level-editor-panel-header">
          <span>Palette</span>
          <small>Tiles & entites</small>
        </div>
        <div class="level-editor-palette" data-editor-palette></div>
        <div class="level-editor-panel-header level-editor-tools-title">
          <span>Outils</span>
          <small>Edition</small>
        </div>
        <div class="level-editor-tools" data-editor-tools></div>
      </aside>
      <aside class="level-editor-panel level-editor-panel-right" aria-label="Proprietes du niveau">
        <div class="level-editor-panel-header">
          <span>Proprietes</span>
          <small data-editor-dirty>Synchro</small>
        </div>
        <label class="level-editor-field">ID<input data-editor-field="id" type="text" /></label>
        <label class="level-editor-field">Nom<input data-editor-field="label" type="text" /></label>
        <div class="level-editor-field-grid">
          <label class="level-editor-field">Largeur<input data-editor-field="width" type="number" min="10" max="80" /></label>
          <label class="level-editor-field">Hauteur<input data-editor-field="height" type="number" min="8" max="60" /></label>
        </div>
        <div class="level-editor-field-grid">
          <label class="level-editor-field">Temps<input data-editor-field="time" type="number" min="1" max="999" /></label>
          <label class="level-editor-field">Score<input data-editor-field="scoreStep" type="number" min="0" max="9999" /></label>
        </div>
        <label class="level-editor-field">Diamants requis<input data-editor-field="requiredDiamonds" type="number" min="0" max="999" /></label>
        <div class="level-editor-actions">
          <button type="button" data-editor-action="export">Exporter</button>
          <button type="button" data-editor-action="import">Importer</button>
          <button type="button" data-editor-action="test">Tester</button>
        </div>
        <label class="level-editor-toggle"><input data-editor-grid-toggle type="checkbox" checked /> Grille visible</label>
        <div class="level-editor-diagnostics" data-editor-diagnostics></div>
      </aside>
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
    root.querySelector<HTMLElement>("[data-editor-action='import']")?.addEventListener("click", () => this.importFromPrompt());
    root.querySelector<HTMLElement>("[data-editor-action='test']")?.addEventListener("click", () => this.startRuntimeTest());
    root.querySelector<HTMLInputElement>("[data-editor-grid-toggle]")?.addEventListener("change", (event) => {
      this.gridOverlayVisible = event.currentTarget instanceof HTMLInputElement ? event.currentTarget.checked : this.gridOverlayVisible;
    });
  }

  /** Cree un bouton de palette moderne. */
  private createPaletteButton(item: LevelEditorPaletteItem): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "level-editor-chip";
    button.dataset.tile = item.tileType ?? "";
    button.title = item.hint;
    button.innerHTML = `<span class="level-editor-chip-preview" style="--tile-color:${item.tileType ? editorTileFallbackColor(item.tileType) : "#111"}"></span><span>${item.label}</span>`;
    button.addEventListener("click", () => {
      if (item.tileType) {
        this.selectedTile = item.tileType;
        this.selectedTool = "pencil";
        this.refreshModernEditorUi();
      }
    });
    return button;
  }

  /** Cree un bouton d'outil moderne. */
  private createToolButton(item: LevelEditorPaletteItem): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "level-editor-tool-button";
    button.dataset.tool = item.tool ?? "";
    button.title = item.hint;
    button.textContent = item.label;
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
    this.setFieldValue(root, "width", String(this.editorState.width));
    this.setFieldValue(root, "height", String(this.editorState.height));
    this.setFieldValue(root, "time", String(this.editorState.time));
    this.setFieldValue(root, "scoreStep", String(this.editorState.scoreStep));
    this.setFieldValue(root, "requiredDiamonds", String(this.editorState.requiredDiamonds));
    const dirty = root.querySelector<HTMLElement>("[data-editor-dirty]");
    if (dirty) dirty.textContent = this.dirty ? "Brouillon" : "A jour";
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
    this.animationElapsed += dt;
    while (this.animationElapsed >= EDITOR_ANIMATION_FRAME_DURATION) {
      this.animationElapsed -= EDITOR_ANIMATION_FRAME_DURATION;
      this.animationFrameIndex = (this.animationFrameIndex + 1) % 8;
    }
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
    window.prompt("JSON exporte", json);
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
