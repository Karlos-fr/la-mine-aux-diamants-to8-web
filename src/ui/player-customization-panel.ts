/**
 * Role: Construit la pop-in HTML de personnalisation du personnage joueur.
 * Scope: Edite les couleurs libres, genere des profils et synchronise la preview.
 * ISO: Cette UI moderne ne modifie ni la simulation TO8 ni les assets extraits.
 * Notes: La sauvegarde passe par le stockage centralise pour rendre le profil jouable immediatement.
 */

import { RUNTIME_ASSET_URLS } from "../assets/runtime-assets";
import {
  PLAYER_BODY_PART_LABELS,
  PLAYER_BODY_PARTS,
  createPlayerCustomization,
  isOriginalPlayerCustomization,
  sanitizeHexColor,
  type PlayerBodyPart,
  type PlayerCustomization,
  type PlayerCustomizationColors
} from "../player-customization/player-customization-model";
import {
  createPlayerCustomizationSeed,
  generateRandomPlayerCustomization
} from "../player-customization/player-customization-generator";
import {
  getActivePlayerCustomization,
  resetActivePlayerCustomization,
  setActivePlayerCustomization,
  subscribePlayerCustomization
} from "../player-customization/player-customization-storage";
import { getRecoloredPlayerAtlas } from "../player-customization/player-sprite-recolor";

/** Taille source d'une frame joueur dans l'atlas. */
const PLAYER_PREVIEW_FRAME_SIZE = 16;
/** Facteur d'agrandissement pixel-perfect de la preview. */
const PLAYER_PREVIEW_SCALE = 5;
/** Frames de preview idle gardant le personnage vivant sans trop bouger. */
const PLAYER_PREVIEW_FRAMES = [1, 1, 1, 0, 1, 2, 3, 2] as const;
/** Duree d'une frame de preview en millisecondes. */
const PLAYER_PREVIEW_FRAME_MS = 180;

/** Etat interne de la pop-in de personnalisation. */
interface PlayerCustomizationPanelState {
  /** Element racine de la pop-in. */
  readonly root: HTMLElement;
  /** Canvas de preview pixelisee. */
  readonly preview: HTMLCanvasElement;
  /** Inputs couleur par partie du corps. */
  readonly colorInputs: ReadonlyMap<PlayerBodyPart, HTMLInputElement>;
  /** Inputs hex par partie du corps. */
  readonly hexInputs: ReadonlyMap<PlayerBodyPart, HTMLInputElement>;
  /** Image atlas joueur chargee pour la preview. */
  playerAtlas: HTMLImageElement | null;
  /** Frame courante de preview. */
  previewFrameIndex: number;
  /** Horodatage de derniere frame preview. */
  lastPreviewTime: number;
  /** Profil edite localement avant sauvegarde. */
  draft: PlayerCustomization;
}

/** Cree la pop-in et ses handlers. */
export function createPlayerCustomizationPanel(): HTMLElement {
  const state = createPanelState();
  bindPanelEvents(state);
  void loadPlayerAtlas(state);
  window.requestAnimationFrame((time) => animatePreview(state, time));
  subscribePlayerCustomization((customization) => {
    state.draft = customization;
    syncPanelFieldsFromDraft(state);
    drawPreview(state);
  });
  return state.root;
}

/** Affiche la pop-in de personnalisation. */
export function openPlayerCustomizationPanel(panel: HTMLElement): void {
  panel.hidden = false;
  panel.querySelector<HTMLInputElement>("[data-player-customization-part]")?.focus();
}

/** Masque la pop-in de personnalisation. */
export function closePlayerCustomizationPanel(panel: HTMLElement): void {
  panel.hidden = true;
}

/** Assemble le DOM de la pop-in. */
function createPanelState(): PlayerCustomizationPanelState {
  const root = document.createElement("section");
  root.className = "player-customization-panel";
  root.hidden = true;
  root.setAttribute("aria-label", "Personnage");

  const card = document.createElement("div");
  card.className = "player-customization-card";

  const header = document.createElement("div");
  header.className = "player-customization-header";
  const title = document.createElement("h2");
  title.textContent = "Personnage";
  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.textContent = "X";
  closeButton.setAttribute("aria-label", "Fermer");
  closeButton.dataset.playerCustomizationClose = "true";
  header.append(title, closeButton);

  const preview = document.createElement("canvas");
  preview.className = "player-customization-preview";
  preview.width = PLAYER_PREVIEW_FRAME_SIZE * PLAYER_PREVIEW_SCALE;
  preview.height = PLAYER_PREVIEW_FRAME_SIZE * PLAYER_PREVIEW_SCALE;

  const colorsRoot = document.createElement("div");
  colorsRoot.className = "player-customization-colors";
  const colorInputs = new Map<PlayerBodyPart, HTMLInputElement>();
  const hexInputs = new Map<PlayerBodyPart, HTMLInputElement>();
  for (const part of PLAYER_BODY_PARTS) {
    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.dataset.playerCustomizationPart = part;
    const hexInput = document.createElement("input");
    hexInput.type = "text";
    hexInput.maxLength = 7;
    hexInput.dataset.playerCustomizationHex = part;
    const row = document.createElement("label");
    row.className = "player-customization-color-row";
    const label = document.createElement("span");
    label.textContent = PLAYER_BODY_PART_LABELS[part];
    row.append(label, colorInput, hexInput);
    colorsRoot.append(row);
    colorInputs.set(part, colorInput);
    hexInputs.set(part, hexInput);
  }

  const actions = document.createElement("div");
  actions.className = "player-customization-actions";
  actions.append(
    createActionButton("Aleatoire", "random"),
    createActionButton("Original", "reset")
  );

  card.append(header, preview, colorsRoot, actions);
  root.append(card);

  const state: PlayerCustomizationPanelState = {
    root,
    preview,
    colorInputs,
    hexInputs,
    playerAtlas: null,
    previewFrameIndex: 0,
    lastPreviewTime: 0,
    draft: getActivePlayerCustomization()
  };
  syncPanelFieldsFromDraft(state);
  return state;
}

/** Branche les interactions de la pop-in. */
function bindPanelEvents(state: PlayerCustomizationPanelState): void {
  state.root.querySelector<HTMLElement>("[data-player-customization-close]")?.addEventListener("click", () => {
    closePlayerCustomizationPanel(state.root);
  });
  state.root.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    const colorPart = target.dataset.playerCustomizationPart as PlayerBodyPart | undefined;
    const hexPart = target.dataset.playerCustomizationHex as PlayerBodyPart | undefined;
    if (colorPart) {
      updateDraftColor(state, colorPart, target.value);
      syncPanelFieldsFromDraft(state);
    } else if (hexPart) {
      updateDraftColor(state, hexPart, target.value);
      syncPanelFieldsFromDraft(state);
    }
  });
  state.root.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const action = target.dataset.playerCustomizationAction;
    if (action === "random") {
      applyRandomDraft(state);
    } else if (action === "reset") {
      resetActivePlayerCustomization();
    }
  });
}

/** Charge l'atlas joueur original pour la preview. */
async function loadPlayerAtlas(state: PlayerCustomizationPanelState): Promise<void> {
  const image = new Image();
  image.src = RUNTIME_ASSET_URLS.playerAtlas;
  await image.decode();
  state.playerAtlas = image;
  drawPreview(state);
}

/** Anime la preview joueur sans dependance au moteur runtime. */
function animatePreview(state: PlayerCustomizationPanelState, time: number): void {
  if (time - state.lastPreviewTime >= PLAYER_PREVIEW_FRAME_MS) {
    state.lastPreviewTime = time;
    state.previewFrameIndex = (state.previewFrameIndex + 1) % PLAYER_PREVIEW_FRAMES.length;
    drawPreview(state);
  }
  window.requestAnimationFrame((nextTime) => animatePreview(state, nextTime));
}

/** Dessine la preview du profil courant. */
function drawPreview(state: PlayerCustomizationPanelState): void {
  const context = state.preview.getContext("2d");
  if (!context) {
    return;
  }

  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, state.preview.width, state.preview.height);
  if (!state.playerAtlas) {
    return;
  }

  const atlas = isOriginalPlayerCustomization(state.draft)
    ? state.playerAtlas
    : getRecoloredPlayerAtlas(state.playerAtlas, state.draft).image;
  const frameIndex = PLAYER_PREVIEW_FRAMES[state.previewFrameIndex];
  context.drawImage(
    atlas,
    frameIndex * PLAYER_PREVIEW_FRAME_SIZE,
    0,
    PLAYER_PREVIEW_FRAME_SIZE,
    PLAYER_PREVIEW_FRAME_SIZE,
    0,
    0,
    state.preview.width,
    state.preview.height
  );
}

/** Synchronise les champs HTML depuis le brouillon courant. */
function syncPanelFieldsFromDraft(state: PlayerCustomizationPanelState): void {
  for (const part of PLAYER_BODY_PARTS) {
    const color = state.draft.colors[part];
    const colorInput = state.colorInputs.get(part);
    const hexInput = state.hexInputs.get(part);
    if (colorInput) colorInput.value = color;
    if (hexInput) hexInput.value = color;
  }
  drawPreview(state);
}

/** Met a jour une couleur libre du brouillon. */
function updateDraftColor(state: PlayerCustomizationPanelState, part: PlayerBodyPart, value: string): void {
  const colors = {
    ...state.draft.colors,
    [part]: sanitizeHexColor(value, state.draft.colors[part])
  } as PlayerCustomizationColors;
  state.draft = createPlayerCustomization("custom", "Personnalise", colors);
  setActivePlayerCustomization(state.draft);
}

/** Applique un profil aleatoire depuis la seed et la famille choisies. */
function applyRandomDraft(state: PlayerCustomizationPanelState): void {
  state.draft = generateRandomPlayerCustomization({
    seed: createPlayerCustomizationSeed()
  });
  setActivePlayerCustomization(state.draft);
}

/** Cree un bouton d'action standardise. */
function createActionButton(label: string, action: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.dataset.playerCustomizationAction = action;
  return button;
}
