/**
 * Role: Pilote la pop-in d'options commune au titre et au gameplay.
 * Scope: Fournit l'UX HTML superposee au canvas et rend les categories d'options actives.
 * ISO: Le style reste proche TO8 via cadres pixels et police Thomson chargee.
 */

import { APP_VERSION } from "../app-version";
import {
  getDisplayDensityLabel,
  getDisplayModeLabel,
  getDisplayStretchLabel,
  getDisplayZoomLabel
} from "../display-options";
import { getSmoothMovementLabel } from "../game-options";

/** Categories prevues pour la future configuration. */
export const OPTIONS_MENU_CATEGORIES = [
  "General",
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
}

/** References DOM internes pour mettre a jour la pop-in sans recreer l'arbre. */
interface OptionsPopinDom {
  /** Racine overlay plein ecran. */
  readonly root: HTMLDivElement;
  /** Titre de categorie dans la zone de contenu. */
  readonly contentTitle: HTMLHeadingElement;
  /** Contenu textuel de la categorie courante. */
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
    getDisplayModeLabel(),
    getDisplayZoomLabel(),
    getDisplayStretchLabel(),
    getDisplayDensityLabel(),
    getSmoothMovementLabel()
  ].join(":");

  dom.root.hidden = false;
  dom.root.setAttribute("aria-hidden", "false");
  if (signature !== renderedSignature) {
    dom.contentTitle.textContent = selectedCategory;
    renderCategoryItems(dom.categoryItems, options.selectedCategoryIndex);
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

  const body = document.createElement("div");
  body.className = "options-popin__body";

  const categories = document.createElement("nav");
  categories.className = "options-popin__categories";
  categories.setAttribute("aria-label", "Categories");
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

  const footer = document.createElement("footer");
  footer.className = "options-popin__footer";
  footer.textContent = "Echap: retour    Haut/bas: categorie";

  content.append(contentTitle, contentBody);
  body.append(categories, content);
  panel.append(title, body, footer);
  root.append(panel);
  document.body.append(root);

  popinDom = { root, contentTitle, contentBody, categoryItems };
  return popinDom;
}

/** Met a jour l'etat visuel de la liste des categories. */
function renderCategoryItems(categoryItems: readonly HTMLDivElement[], selectedIndex: number): void {
  categoryItems.forEach((item, index) => {
    const selected = index === selectedIndex;
    item.classList.toggle("options-popin__category--selected", selected);
    item.textContent = selected ? `> ${OPTIONS_MENU_CATEGORIES[index]}` : OPTIONS_MENU_CATEGORIES[index];
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

/** Rend les preferences d'affichage actives et leurs raccourcis clavier. */
function renderDisplayContent(container: HTMLDivElement): void {
  appendLines(container, [
    { text: "Mode", colorClass: "options-popin__line--muted" },
    { text: getDisplayModeLabel(), colorClass: "options-popin__line--cyan" },
    { text: "Zoom", colorClass: "options-popin__line--muted" },
    { text: getDisplayZoomLabel(), colorClass: "options-popin__line--green" },
    { text: "Etirage navigateur", colorClass: "options-popin__line--muted" },
    { text: getDisplayStretchLabel(), colorClass: "options-popin__line--cyan" },
    { text: "Densite", colorClass: "options-popin__line--muted" },
    { text: getDisplayDensityLabel(), colorClass: "options-popin__line--green" },
    { text: "< >: zoom" },
    { text: "Entree: etirage" },
    { text: "Ctrl: densite" }
  ]);
}

/** Rend les preferences qui modifient le ressenti gameplay moderne. */
function renderGameContent(container: HTMLDivElement): void {
  appendLines(container, [
    { text: "Mouvements fluides", colorClass: "options-popin__line--muted" },
    { text: getSmoothMovementLabel(), colorClass: "options-popin__line--green" },
    { text: "Entree: changer" }
  ]);
}

/** Rend le contenu temporaire des categories sans options actives pour l'instant. */
function renderPlaceholderContent(container: HTMLDivElement, contextLabel: string): void {
  appendLines(container, [
    { text: "Options a venir", colorClass: "options-popin__line--muted" },
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
