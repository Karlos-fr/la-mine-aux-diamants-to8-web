/**
 * Role: Construit le panneau HTML de reglages visuels du mode Diorama.
 * Scope: Gere uniquement l'UX de test du rendu, sans connaitre le gameplay.
 * ISO: Les controles modifient des options de rendu modernes sans impact simulation.
 * Notes: Le panneau reste volontairement leger et monte depuis `main.ts`.
 */

import { getDisplayRenderMode } from "../display-options";
import {
  DIORAMA_RENDER_LIMITS,
  DIORAMA_SCENE_RESOLUTION_STEPS,
  getDioramaRenderOptions,
  resetDioramaRenderOptions,
  updateDioramaRenderOptions,
  type DioramaRenderOptions
} from "../diorama-render-options";

/** Controle HTML du panneau avec synchronisation depuis les options courantes. */
interface DioramaPanelControl {
  /** Racine DOM du controle. */
  readonly root: HTMLElement;
  /** Recharge la valeur affichee depuis les options persistantes. */
  readonly sync: () => void;
}

/** Cree le panneau lateral de tests du rendu Diorama. */
export function createDioramaRenderPanel(): HTMLElement {
  const panel = document.createElement("aside");
  panel.className = "diorama-render-panel";
  panel.hidden = true;

  const title = document.createElement("h2");
  title.className = "diorama-render-panel__title";
  title.textContent = "Diorama";

  const note = document.createElement("p");
  note.className = "diorama-render-panel__note";
  note.textContent = "Rendu uniquement";

  const form = document.createElement("div");
  form.className = "diorama-render-panel__controls";

  const controls = [
    createDioramaPresetRangeControl("Resolution interne", "supersampling", DIORAMA_SCENE_RESOLUTION_STEPS),
    createDioramaCheckboxControl("Lissage recopie", "downscaleSmoothing"),
    createDioramaRangeControl("Textures", "textureUpscale", DIORAMA_RENDER_LIMITS.textureUpscale, true),
    createDioramaRangeControl("Ambiante", "ambientLight", DIORAMA_RENDER_LIMITS.ambientLight, true),
    createDioramaRangeControl("Directionnelle", "directionalLight", DIORAMA_RENDER_LIMITS.directionalLight, true),
    createDioramaRangeControl("Ombres", "groundShadowOpacity", DIORAMA_RENDER_LIMITS.groundShadowOpacity, true),
    createDioramaRangeControl("Sprites", "billboardScale", DIORAMA_RENDER_LIMITS.billboardScale, true)
  ];
  form.append(...controls.map((control) => control.root));

  const resetButton = document.createElement("button");
  resetButton.className = "diorama-render-panel__reset";
  resetButton.type = "button";
  resetButton.textContent = "Reset";
  resetButton.addEventListener("click", () => {
    resetDioramaRenderOptions();
    controls.forEach((control) => control.sync());
  });

  panel.append(title, note, form, resetButton);
  return panel;
}

/** Masque le panneau Diorama hors gameplay et hors mode de rendu Diorama. */
export function syncDioramaRenderPanelVisibility(panel: HTMLElement, isGameplaySceneActive: boolean): void {
  panel.hidden = !isGameplaySceneActive || getDisplayRenderMode() !== "dioramaTo8";
}

/** Cree un slider numerique indexe sur des paliers discrets. */
function createDioramaPresetRangeControl(
  label: string,
  key: Extract<keyof DioramaRenderOptions, "supersampling">,
  presets: readonly number[]
): DioramaPanelControl {
  const root = document.createElement("label");
  root.className = "diorama-render-panel__field";

  const header = document.createElement("span");
  header.className = "diorama-render-panel__field-header";
  const name = document.createElement("span");
  name.textContent = label;
  const value = document.createElement("span");
  value.className = "diorama-render-panel__value";
  header.append(name, value);

  const input = document.createElement("input");
  input.className = "diorama-render-panel__range";
  input.type = "range";
  input.min = "0";
  input.max = String(presets.length - 1);
  input.step = "1";
  input.addEventListener("input", () => {
    const optionValue = presets[Number(input.value)] ?? presets[0];
    updateDioramaRenderOptions({ [key]: optionValue });
    value.textContent = formatDioramaOptionValue(key, optionValue);
  });

  const sync = (): void => {
    const optionValue = getDioramaRenderOptions()[key];
    const presetIndex = Math.max(0, presets.indexOf(optionValue));
    input.value = String(presetIndex);
    value.textContent = formatDioramaOptionValue(key, optionValue);
  };
  sync();
  root.append(header, input);
  return { root, sync };
}

/** Cree un slider numerique lie a une option Diorama continue. */
function createDioramaRangeControl(
  label: string,
  key: Extract<keyof DioramaRenderOptions, "supersampling" | "textureUpscale" | "ambientLight" | "directionalLight" | "groundShadowOpacity" | "billboardScale">,
  limits: { readonly min: number; readonly max: number; readonly step: number },
  secondary = false
): DioramaPanelControl {
  const root = document.createElement("label");
  root.className = "diorama-render-panel__field";
  if (secondary) {
    root.classList.add("diorama-render-panel__field--secondary");
  }

  const header = document.createElement("span");
  header.className = "diorama-render-panel__field-header";
  const name = document.createElement("span");
  name.textContent = label;
  const value = document.createElement("span");
  value.className = "diorama-render-panel__value";
  header.append(name, value);

  const input = document.createElement("input");
  input.className = "diorama-render-panel__range";
  input.type = "range";
  input.min = String(limits.min);
  input.max = String(limits.max);
  input.step = String(limits.step);
  input.addEventListener("input", () => {
    updateDioramaRenderOptions({ [key]: Number(input.value) });
    value.textContent = formatDioramaOptionValue(key, Number(input.value));
  });

  const sync = (): void => {
    const optionValue = getDioramaRenderOptions()[key];
    input.value = String(optionValue);
    value.textContent = formatDioramaOptionValue(key, optionValue);
  };
  sync();
  root.append(header, input);
  return { root, sync };
}

/** Cree une case a cocher liee a une option Diorama booleenne. */
function createDioramaCheckboxControl(
  label: string,
  key: Extract<keyof DioramaRenderOptions, "downscaleSmoothing">
): DioramaPanelControl {
  const root = document.createElement("label");
  root.className = "diorama-render-panel__field diorama-render-panel__field--check";

  const input = document.createElement("input");
  input.className = "diorama-render-panel__checkbox";
  input.type = "checkbox";
  input.addEventListener("change", () => {
    updateDioramaRenderOptions({ [key]: input.checked });
  });

  const text = document.createElement("span");
  text.textContent = label;
  const sync = (): void => {
    input.checked = getDioramaRenderOptions()[key];
  };
  sync();
  root.append(input, text);
  return { root, sync };
}

/** Formate une valeur de reglage pour le panneau Diorama. */
function formatDioramaOptionValue(key: keyof DioramaRenderOptions, value: number): string {
  return key === "supersampling" || key === "textureUpscale" ? `x${value.toFixed(0)}` : value.toFixed(2);
}
