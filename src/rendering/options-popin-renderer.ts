/**
 * Role: Pilote la pop-in d'options commune au titre et au gameplay.
 * Scope: Fournit l'UX HTML superposee au canvas et rend les categories d'options actives.
 * ISO: Le style reste proche TO8 via cadres pixels et police Thomson chargee.
 */

import { APP_VERSION } from "../app-version";
import {
  type DisplayDensity,
  type DisplayRenderMode,
  type DisplayZoom,
  getDisplayOptions,
  getDisplayDensityLabel,
  getDisplayRenderModeLabel,
  getDisplayStretchLabel,
  getDisplayZoomLabel,
  setDisplayDensity,
  setDisplayRenderMode,
  setDisplayStretchToViewport,
  setDisplayZoom
} from "../display-options";
import { getSmoothMovementLabel, setSmoothMovement } from "../game-options";

/** Categories prevues pour la future configuration. */
export const OPTIONS_MENU_CATEGORIES = [
  "Général",
  "Affichage",
  "Audio",
  "Jeu",
  "Sauvegarde",
  "A propos"
] as const;

/** Nombre de categories affichables dans la pop-in. */
export const OPTIONS_MENU_CATEGORY_COUNT = OPTIONS_MENU_CATEGORIES.length;

/** Options de rendu de la pop-in. */
export interface OptionsPopinRenderOptions {
  /** Index de categorie actuellement selectionne. */
  readonly selectedCategoryIndex: number;
  /** Libelle contextuel affiche dans la zone de contenu. */
  readonly contextLabel: string;
  /** Callback appele quand une categorie est selectionnee a la souris. */
  readonly onSelectedCategoryIndexChange: (selectedCategoryIndex: number) => void;
  /** Callback appele quand l'utilisateur ferme la pop-in a la souris. */
  readonly onClose: () => void;
}

/** References DOM internes pour mettre a jour la pop-in sans recreer l'arbre. */
interface OptionsPopinDom {
  /** Racine overlay plein ecran. */
  readonly root: HTMLDivElement;
  /** Titre de categorie dans la zone de contenu. */
  readonly contentTitle: HTMLHeadingElement;
  /** Bouton de fermeture souris de la pop-in. */
  readonly closeButton: HTMLButtonElement;
  /** Contenu interactif de la categorie courante. */
  readonly contentBody: HTMLDivElement;
  /** Boutons visuels des categories. */
  readonly categoryItems: readonly HTMLDivElement[];
}

/** DOM persistant de la pop-in, reutilise pour eviter de recreer les noeuds a chaque frame. */
let popinDom: OptionsPopinDom | undefined;

/** Timer court qui masque l'overlay si aucune scene ne le rend pendant quelques frames. */
let hideTimeout: number | undefined;

/** Signature du dernier contenu rendu, pour limiter les mutations DOM au strict necessaire. */
let renderedSignature = "";

/** Rend la pop-in d'options par-dessus la scene courante. */
export function renderOptionsPopin(options: OptionsPopinRenderOptions): void {
  const dom = ensureOptionsPopinDom();
  const selectedCategory = OPTIONS_MENU_CATEGORIES[options.selectedCategoryIndex] ?? OPTIONS_MENU_CATEGORIES[0];
  const signature = [
    options.selectedCategoryIndex,
    selectedCategory,
    options.contextLabel,
    getDisplayZoomLabel(),
    getDisplayStretchLabel(),
    getDisplayDensityLabel(),
    getDisplayRenderModeLabel(),
    getSmoothMovementLabel()
  ].join(":");

  dom.root.hidden = false;
  dom.root.setAttribute("aria-hidden", "false");
  dom.closeButton.onclick = () => {
    options.onClose();
    renderedSignature = "";
  };
  if (signature !== renderedSignature) {
    dom.contentTitle.textContent = selectedCategory;
    renderCategoryItems(dom.categoryItems, options.selectedCategoryIndex, options.onSelectedCategoryIndexChange);
    renderCategoryContent(dom.contentBody, selectedCategory, options.contextLabel);
    renderedSignature = signature;
  }

  if (hideTimeout !== undefined) {
    window.clearTimeout(hideTimeout);
  }
  hideTimeout = window.setTimeout(() => {
    dom.root.hidden = true;
    dom.root.setAttribute("aria-hidden", "true");
  }, 80);
}

/** Cree la structure HTML de la pop-in si necessaire. */
function ensureOptionsPopinDom(): OptionsPopinDom {
  if (popinDom) {
    return popinDom;
  }

  const root = document.createElement("div");
  root.className = "options-popin-overlay";
  root.hidden = true;
  root.setAttribute("aria-hidden", "true");

  const panel = document.createElement("section");
  panel.className = "options-popin";
  panel.setAttribute("aria-label", "Options");

  const title = document.createElement("h2");
  title.className = "options-popin__title";
  title.textContent = "Options";

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "options-popin__close";
  closeButton.setAttribute("aria-label", "Fermer");
  closeButton.textContent = "x";

  const body = document.createElement("div");
  body.className = "options-popin__body";

  const categories = document.createElement("nav");
  categories.className = "options-popin__categories";
  categories.setAttribute("aria-label", "Catégories");
  const categoryItems = OPTIONS_MENU_CATEGORIES.map((category) => {
    const item = document.createElement("div");
    item.className = "options-popin__category";
    item.textContent = category;
    categories.append(item);
    return item;
  });

  const content = document.createElement("article");
  content.className = "options-popin__content";

  const contentTitle = document.createElement("h3");
  contentTitle.className = "options-popin__content-title";

  const contentBody = document.createElement("div");
  contentBody.className = "options-popin__content-body";

  content.append(contentTitle, contentBody);
  body.append(categories, content);
  panel.append(title, closeButton, body);
  root.append(panel);
  document.body.append(root);

  popinDom = { root, contentTitle, closeButton, contentBody, categoryItems };
  return popinDom;
}

/** Met a jour l'etat visuel et les actions souris de la liste des categories. */
function renderCategoryItems(
  categoryItems: readonly HTMLDivElement[],
  selectedIndex: number,
  onSelectedCategoryIndexChange: (selectedCategoryIndex: number) => void
): void {
  categoryItems.forEach((item, index) => {
    const selected = index === selectedIndex;
    item.classList.toggle("options-popin__category--selected", selected);
    item.textContent = selected ? `> ${OPTIONS_MENU_CATEGORIES[index]}` : OPTIONS_MENU_CATEGORIES[index];
    item.setAttribute("role", "button");
    item.setAttribute("tabindex", "0");
    item.setAttribute("aria-current", selected ? "true" : "false");
    item.onclick = () => {
      onSelectedCategoryIndexChange(index);
      renderedSignature = "";
    };
  });
}

/** Remplit la zone de contenu de la categorie active. */
function renderCategoryContent(container: HTMLDivElement, category: string, contextLabel: string): void {
  container.replaceChildren();

  if (category === "A propos") {
    renderAboutContent(container);
    return;
  }

  if (category === "Affichage") {
    renderDisplayContent(container);
    return;
  }

  if (category === "Jeu") {
    renderGameContent(container);
    return;
  }

  renderPlaceholderContent(container, contextLabel);
}

/** Rend le contenu informatif et credits de la categorie A propos. */
function renderAboutContent(container: HTMLDivElement): void {
  appendLines(container, [
    { text: "Jeu original 1986", colorClass: "options-popin__line--muted" },
    { text: "Philippe Bruneel" },
    { text: "Christian Lemaire" },
    { text: "", colorClass: "options-popin__line--spacer" },
    { text: "Modification 2026", colorClass: "options-popin__line--muted" },
    { text: "github.com/Karlos-fr", colorClass: "options-popin__line--cyan", href: "https://github.com/Karlos-fr" },
    { text: "", colorClass: "options-popin__line--spacer" },
    { text: `Version ${APP_VERSION}`, colorClass: "options-popin__line--green" }
  ]);
}

/** Rend les preferences d'affichage actives avec controles retro cliquables. */
function renderDisplayContent(container: HTMLDivElement): void {
  const options = getDisplayOptions();
  appendSelectControl(container, "Zoom", String(options.zoom), [
    { value: "1", label: "x1" },
    { value: "2", label: "x2" },
    { value: "3", label: "x3" }
  ], (value) => setDisplayZoom(Number(value) as DisplayZoom));
  appendCheckboxControl(container, "Etirage navigateur", options.stretchToViewport, (checked) => setDisplayStretchToViewport(checked));
  appendSelectControl(container, "Densité", String(options.density), [
    { value: "1", label: "x1" },
    { value: "2", label: "x2" },
    { value: "3", label: "x3" }
  ], (value) => setDisplayDensity(Number(value) as DisplayDensity));
  appendSelectControl(container, "Rendu", options.renderMode, [
    { value: "to8", label: "TO8 original" },
    { value: "dioramaTo8", label: "Diorama TO8" }
  ], (value) => setDisplayRenderMode(value as DisplayRenderMode));
}

/** Rend les preferences qui modifient le ressenti gameplay moderne. */
function renderGameContent(container: HTMLDivElement): void {
  appendCheckboxControl(container, "Mouvements fluides", getSmoothMovementLabel() === "Oui", (checked) => setSmoothMovement(checked));
}

/** Rend le contenu temporaire des categories sans options actives pour l'instant. */
function renderPlaceholderContent(container: HTMLDivElement, contextLabel: string): void {
  appendLines(container, [
    { text: "Options à venir", colorClass: "options-popin__line--muted" },
    { text: contextLabel, colorClass: "options-popin__line--cyan" }
  ]);
}

/** Ajoute des lignes de texte dans la zone de contenu. */
function appendLines(container: HTMLDivElement, lines: ReadonlyArray<{ readonly text: string; readonly colorClass?: string; readonly href?: string }>): void {
  lines.forEach((line) => {
    const element = document.createElement("p");
    element.className = line.colorClass ? `options-popin__line ${line.colorClass}` : "options-popin__line";
    if (line.href) {
      const link = document.createElement("a");
      link.className = "options-popin__link";
      link.href = line.href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = line.text;
      element.append(link);
    } else {
      element.textContent = line.text;
    }
    container.append(element);
  });
}

/** Ajoute une vraie liste de selection stylisee dans l'esprit TO8. */
function appendSelectControl(
  container: HTMLDivElement,
  label: string,
  value: string,
  values: ReadonlyArray<{ readonly value: string; readonly label: string }>,
  onChange: (value: string) => void
): void {
  const row = createControlRow(label);
  const select = document.createElement("select");
  select.className = "options-popin__select";
  values.forEach((selectValue) => {
    const option = document.createElement("option");
    option.value = selectValue.value;
    option.textContent = selectValue.label;
    select.append(option);
  });
  select.value = value;
  select.addEventListener("change", () => {
    onChange(select.value);
    renderedSignature = "";
  });
  row.append(select);
  container.append(row);
}

/** Ajoute une case a cocher retro au format [x]. */
function appendCheckboxControl(container: HTMLDivElement, label: string, checked: boolean, onChange: (checked: boolean) => void): void {
  const row = createControlRow(label);
  const button = document.createElement("button");
  button.type = "button";
  button.className = "options-popin__checkbox";
  button.textContent = checked ? "[x]" : "[ ]";
  button.setAttribute("aria-pressed", String(checked));
  button.addEventListener("click", () => {
    onChange(!checked);
    renderedSignature = "";
  });
  row.append(button);
  container.append(row);
}

/** Cree la structure commune label + controle d'une option. */
function createControlRow(label: string): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "options-popin__option-row";

  const labelElement = document.createElement("span");
  labelElement.className = "options-popin__option-label";
  labelElement.textContent = label;
  row.append(labelElement);
  return row;
}
