/**
 * Role: Fournit la scene DOM de vitrine des niveaux.
 * Scope: Affiche la vitrine, les apercus dynamiques et la selection clavier/souris.
 * ISO: Les apercus reutilisent les atlas runtime extraits; l'interface reste une couche moderne.
 * Notes: La scene reste une UX moderne hors canvas, mais lance le gameplay via factory injectee.
 */

import { RuntimeAssets, type LoadedRuntimeAssets } from "../assets/runtime-asset-loader";
import type { InputState } from "../engine/input";
import type { Renderer } from "../engine/renderer";
import type { Scene, SceneContext } from "../engine/scene";
import { getLevelShowcaseEntries, type LevelShowcaseEntry } from "../level-showcase/level-showcase-catalog";
import {
  getLevelProgressSummary,
  loadLevelShowcaseProgress,
  type LevelShowcaseProgressState
} from "../level-showcase/level-showcase-progress";
import { LevelShowcasePreviewRenderer } from "../level-showcase/level-showcase-preview-renderer";

/** Classe appliquee au body tant que la vitrine est active. */
const LEVEL_SHOWCASE_BODY_CLASS = "level-showcase-active";
/** Largeur maximale des miniatures de liste. */
const LEVEL_SHOWCASE_THUMB_WIDTH = 360;
/** Hauteur maximale des miniatures de liste. */
const LEVEL_SHOWCASE_THUMB_HEIGHT = 180;
/** Largeur maximale du grand apercu de fiche. */
const LEVEL_SHOWCASE_DETAIL_PREVIEW_WIDTH = 820;
/** Hauteur maximale du grand apercu de fiche. */
const LEVEL_SHOWCASE_DETAIL_PREVIEW_HEIGHT = 420;

/** Factory injectee pour lancer un niveau depuis la fiche. */
export type LevelShowcasePlaySceneFactory = (levelNumber: number) => Scene;

/** Scene de vitrine des niveaux, montee hors canvas pour garder une UX moderne. */
export class LevelShowcaseScene implements Scene {
  /** Contexte de transition fourni par le routeur. */
  private context: SceneContext | null = null;
  /** Racine DOM de la vitrine. */
  private root: HTMLElement | null = null;
  /** Niveaux disponibles dans l'ordre d'affichage. */
  private readonly entries: LevelShowcaseEntry[] = getLevelShowcaseEntries();
  /** Progression locale lue au montage de la scene. */
  private progress: LevelShowcaseProgressState = loadLevelShowcaseProgress();
  /** Chargeur d'assets runtime pour dessiner les previews dynamiques. */
  private readonly runtimeAssets = new RuntimeAssets();
  /** Renderer de miniatures partage par la liste. */
  private readonly previewRenderer = new LevelShowcasePreviewRenderer();
  /** Niveau actuellement selectionne dans la liste. */
  private selectedLevelNumber = this.entries[0]?.levelNumber ?? 1;
  /** Entree ouverte dans la fiche detaillee. */
  private detailEntry: LevelShowcaseEntry | null = null;
  /** Handler stable des raccourcis clavier de la vitrine. */
  private readonly keyDownHandler = (event: KeyboardEvent): void => {
    this.handleKeyDown(event);
  };

  /** Cree une vitrine avec la factory gameplay qui sera appelee par le bouton Jouer. */
  constructor(private readonly createPlayScene: LevelShowcasePlaySceneFactory) {}

  /** Installe la vitrine DOM et lance le chargement des previews. */
  enter(context: SceneContext): void {
    this.context = context;
    this.progress = loadLevelShowcaseProgress();
    document.body.classList.add(LEVEL_SHOWCASE_BODY_CLASS);
    window.addEventListener("keydown", this.keyDownHandler);
    this.mount();
    void this.runtimeAssets.load().then(() => {
      this.previewRenderer.setAssets(this.getLoadedPreviewAssets());
      this.renderAllPreviews();
    });
  }

  /** Detache la vitrine DOM et ses handlers. */
  exit(): void {
    window.removeEventListener("keydown", this.keyDownHandler);
    document.body.classList.remove(LEVEL_SHOWCASE_BODY_CLASS);
    this.root?.remove();
    this.root = null;
    this.context = null;
    this.detailEntry = null;
  }

  /** La scene DOM ne depend pas du tick moteur. */
  update(_dt: number, _input: InputState): void {
    // La vitrine repose sur les evenements DOM; le tick reste volontairement neutre.
  }

  /** Nettoie le canvas cache afin de ne pas laisser une image gameplay derriere l'UI. */
  render(renderer: Renderer): void {
    renderer.clear("#000000");
  }

  /** Monte la structure HTML de liste des niveaux. */
  private mount(): void {
    const appRoot = document.querySelector<HTMLElement>("#app");
    if (!appRoot) {
      throw new Error("Element #app introuvable pour la vitrine des niveaux.");
    }

    const shell = document.createElement("section");
    shell.className = "level-showcase-shell";
    shell.setAttribute("aria-label", "Vitrine des niveaux");

    const header = document.createElement("header");
    header.className = "level-showcase-header";

    const titleGroup = document.createElement("div");
    const eyebrow = document.createElement("p");
    eyebrow.className = "level-showcase-eyebrow";
    eyebrow.textContent = "Vitrine";
    const title = document.createElement("h1");
    title.className = "level-showcase-title";
    title.textContent = "Niveaux";
    titleGroup.append(eyebrow, title);

    const count = document.createElement("p");
    count.className = "level-showcase-count";
    count.textContent = `${this.entries.length} niveaux`;
    header.append(titleGroup, count);

    const list = document.createElement("div");
    list.className = "level-showcase-list";
    list.role = "list";
    for (const entry of this.entries) {
      list.append(this.createLevelCard(entry));
    }

    shell.append(header, list);
    appRoot.append(shell);
    this.root = shell;
    this.renderAllPreviews();
    this.syncSelection();
  }

  /** Cree une carte de niveau avec apercu dynamique et metadonnees essentielles. */
  private createLevelCard(entry: LevelShowcaseEntry): HTMLElement {
    const progress = getLevelProgressSummary(entry, this.progress);
    const card = document.createElement("article");
    card.className = "level-showcase-card";
    card.role = "listitem";
    card.dataset.levelNumber = String(entry.levelNumber);

    const previewButton = document.createElement("button");
    previewButton.className = "level-showcase-preview-button";
    previewButton.type = "button";
    previewButton.setAttribute("aria-label", `Selectionner ${entry.name}`);
    previewButton.addEventListener("click", () => {
      this.selectLevel(entry.levelNumber);
      this.openLevelDetail(entry);
    });

    const canvas = document.createElement("canvas");
    canvas.className = "level-showcase-preview";
    canvas.dataset.levelNumber = String(entry.levelNumber);
    previewButton.append(canvas);

    const body = document.createElement("div");
    body.className = "level-showcase-card-body";

    const heading = document.createElement("h2");
    heading.className = "level-showcase-card-title";
    heading.textContent = `${entry.levelNumber}. ${entry.name}`;

    const meta = document.createElement("dl");
    meta.className = "level-showcase-meta";
    this.appendMeta(meta, "Auteur", entry.author);
    this.appendMeta(meta, "Date", entry.createdDate);
    this.appendMeta(meta, "Diamants", String(entry.requiredDiamonds));
    this.appendMeta(meta, "Temps", String(entry.timeLimit));
    this.appendMeta(meta, "Progression", progress.completed ? "Termine" : "A faire");
    this.appendMeta(meta, "Deblocage", progress.unlockCondition);

    if (entry.specialLabel) {
      const badge = document.createElement("span");
      badge.className = "level-showcase-badge";
      badge.textContent = entry.specialLabel;
      body.append(heading, badge, meta);
    } else {
      body.append(heading, meta);
    }

    card.append(previewButton, body);
    return card;
  }

  /** Ajoute une ligne de definition dans les metadonnees de carte. */
  private appendMeta(list: HTMLDListElement, label: string, value: string): void {
    const term = document.createElement("dt");
    term.textContent = label;
    const description = document.createElement("dd");
    description.textContent = value;
    list.append(term, description);
  }

  /** Rend toutes les miniatures actuellement presentes dans le DOM. */
  private renderAllPreviews(): void {
    if (!this.root) {
      return;
    }

    for (const canvas of this.root.querySelectorAll<HTMLCanvasElement>(".level-showcase-preview")) {
      const levelNumber = Number(canvas.dataset.levelNumber);
      const entry = this.entries.find((item) => item.levelNumber === levelNumber);
      if (!entry) {
        continue;
      }

      this.previewRenderer.renderLevelPreview(canvas, entry.source, {
        maxWidth: canvas.classList.contains("level-showcase-detail-preview") ? LEVEL_SHOWCASE_DETAIL_PREVIEW_WIDTH : LEVEL_SHOWCASE_THUMB_WIDTH,
        maxHeight: canvas.classList.contains("level-showcase-detail-preview") ? LEVEL_SHOWCASE_DETAIL_PREVIEW_HEIGHT : LEVEL_SHOWCASE_THUMB_HEIGHT,
        minCellSize: canvas.classList.contains("level-showcase-detail-preview") ? 4 : 2
      });
    }
  }

  /** Ouvre la fiche detaillee d'un niveau selectionne. */
  private openLevelDetail(entry: LevelShowcaseEntry): void {
    this.detailEntry = entry;
    this.selectLevel(entry.levelNumber);
    this.renderDetailPanel(entry);
  }

  /** Ferme la fiche detaillee et rend le focus a la carte selectionnee. */
  private closeLevelDetail(): void {
    this.detailEntry = null;
    this.root?.querySelector<HTMLElement>(".level-showcase-detail")?.remove();
    this.focusSelectedCard();
  }

  /** Rend ou remplace le panneau de fiche niveau. */
  private renderDetailPanel(entry: LevelShowcaseEntry): void {
    if (!this.root) {
      return;
    }

    this.root.querySelector<HTMLElement>(".level-showcase-detail")?.remove();

    const progress = getLevelProgressSummary(entry, this.progress);
    const detail = document.createElement("aside");
    detail.className = "level-showcase-detail";
    detail.setAttribute("aria-label", `Fiche ${entry.name}`);

    const panel = document.createElement("div");
    panel.className = "level-showcase-detail-panel";

    const header = document.createElement("header");
    header.className = "level-showcase-detail-header";
    const title = document.createElement("h2");
    title.className = "level-showcase-detail-title";
    title.textContent = `${entry.levelNumber}. ${entry.name}`;
    const closeButton = document.createElement("button");
    closeButton.className = "level-showcase-detail-close";
    closeButton.type = "button";
    closeButton.textContent = "X";
    closeButton.setAttribute("aria-label", "Fermer la fiche niveau");
    closeButton.addEventListener("click", () => this.closeLevelDetail());
    header.append(title, closeButton);

    const content = document.createElement("div");
    content.className = "level-showcase-detail-content";

    const preview = document.createElement("canvas");
    preview.className = "level-showcase-preview level-showcase-detail-preview";
    preview.dataset.levelNumber = String(entry.levelNumber);

    const meta = document.createElement("dl");
    meta.className = "level-showcase-detail-meta";
    this.appendMeta(meta, "Auteur", entry.author);
    this.appendMeta(meta, "Date", entry.createdDate);
    this.appendMeta(meta, "Dimensions", `${entry.width} x ${entry.height}`);
    this.appendMeta(meta, "Objectif diamants", String(entry.requiredDiamonds));
    this.appendMeta(meta, "Temps initial", String(entry.timeLimit));
    this.appendMeta(meta, "Score diamant", String(entry.scoreStep));
    this.appendMeta(meta, "Meilleur score", formatNullableNumber(progress.bestScore));
    this.appendMeta(meta, "Record", formatNullableNumber(progress.bestRecord));
    this.appendMeta(meta, "Meilleur temps", formatNullableTime(progress.bestTime));
    this.appendMeta(meta, "Progression", progress.completed ? "Termine" : "A faire");
    this.appendMeta(meta, "Deblocage", progress.unlockCondition);

    const actions = document.createElement("div");
    actions.className = "level-showcase-detail-actions";
    const playButton = document.createElement("button");
    playButton.className = "level-showcase-play-button";
    playButton.type = "button";
    playButton.textContent = progress.locked ? "Verrouille" : "Jouer";
    playButton.disabled = progress.locked;
    playButton.addEventListener("click", () => {
      if (!progress.locked) {
        this.context?.setScene(this.createPlayScene(entry.levelNumber));
      }
    });
    actions.append(playButton);

    content.append(preview, meta);
    panel.append(header, content, actions);
    detail.append(panel);
    this.root.append(detail);
    this.renderAllPreviews();
    playButton.focus();
  }

  /** Transforme les assets charges en objet complet attendu par le renderer de preview. */
  private getLoadedPreviewAssets(): LoadedRuntimeAssets | null {
    const tileAtlas = this.runtimeAssets.tileAtlas;
    const playerAtlas = this.runtimeAssets.playerAtlas;
    const diamondAtlas = this.runtimeAssets.diamondAtlas;
    const monsterAtlas = this.runtimeAssets.monsterAtlas;
    const specialCreatureAtlas = this.runtimeAssets.specialCreatureAtlas;
    const leftHudPanel = this.runtimeAssets.leftHudPanel;
    const rightHudPanel = this.runtimeAssets.rightHudPanel;
    if (!tileAtlas || !playerAtlas || !diamondAtlas || !monsterAtlas || !specialCreatureAtlas || !leftHudPanel || !rightHudPanel) {
      return null;
    }

    return {
      tileAtlas,
      playerAtlas,
      diamondAtlas,
      monsterAtlas,
      specialCreatureAtlas,
      leftHudPanel,
      rightHudPanel
    };
  }

  /** Selectionne un niveau dans la liste. */
  private selectLevel(levelNumber: number): void {
    this.selectedLevelNumber = levelNumber;
    this.syncSelection();
  }

  /** Deplace la selection selon un delta dans la liste. */
  private moveSelection(delta: number): void {
    const currentIndex = this.entries.findIndex((entry) => entry.levelNumber === this.selectedLevelNumber);
    const nextIndex = clamp(currentIndex + delta, 0, this.entries.length - 1);
    const nextEntry = this.entries[nextIndex];
    if (nextEntry) {
      this.selectLevel(nextEntry.levelNumber);
      this.focusSelectedCard();
    }
  }

  /** Synchronise l'etat visuel de selection des cartes. */
  private syncSelection(): void {
    if (!this.root) {
      return;
    }

    for (const card of this.root.querySelectorAll<HTMLElement>(".level-showcase-card")) {
      const selected = Number(card.dataset.levelNumber) === this.selectedLevelNumber;
      card.dataset.selected = String(selected);
    }
  }

  /** Donne le focus au bouton de preview de la carte selectionnee. */
  private focusSelectedCard(): void {
    const button = this.root?.querySelector<HTMLButtonElement>(
      `.level-showcase-card[data-level-number="${this.selectedLevelNumber}"] .level-showcase-preview-button`
    );
    button?.focus();
  }

  /** Gere la navigation clavier minimale de la vitrine. */
  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.root) {
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      this.moveSelection(1);
      return;
    }

    if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      this.moveSelection(-1);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const entry = this.entries.find((item) => item.levelNumber === this.selectedLevelNumber);
      if (entry) {
        this.openLevelDetail(entry);
      }
      return;
    }

    if (event.key === "Escape" && this.detailEntry) {
      event.preventDefault();
      this.closeLevelDetail();
    }
  }
}

/** Contraint une valeur numerique entre deux bornes. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Formate un nombre nullable pour la fiche niveau. */
function formatNullableNumber(value: number | null): string {
  return value === null ? "-" : String(value);
}

/** Formate un temps nullable exprime en secondes. */
function formatNullableTime(value: number | null): string {
  return value === null ? "-" : `${value}s`;
}
