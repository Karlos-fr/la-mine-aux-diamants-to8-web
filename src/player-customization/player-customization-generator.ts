/**
 * Role: Genere des profils de personnage aleatoires et reproductibles.
 * Scope: Produit uniquement des couleurs utilisateur, sans toucher aux assets ou au rendu.
 * ISO: La generation est une option moderne sans lien avec le gameplay TO8 original.
 * Notes: Les couleurs sont libres mais filtrees pour garder des zones lisibles.
 */

import { createSeededRandom } from "../level-generator/seeded-random";
import { createPlayerCustomization, type PlayerCustomization } from "./player-customization-model";

/** Famille chromatique proposee pour orienter la generation aleatoire. */
export type PlayerCustomizationRandomFamily = "balanced" | "arcade" | "contrast" | "soft";

/** Options du generateur aleatoire de personnage. */
export interface RandomPlayerCustomizationOptions {
  /** Seed reproductible optionnelle. */
  readonly seed?: string | number;
  /** Famille de couleurs souhaitee. */
  readonly family?: PlayerCustomizationRandomFamily;
}

/** Genere une personnalisation joueur aleatoire et lisible. */
export function generateRandomPlayerCustomization(options: RandomPlayerCustomizationOptions = {}): PlayerCustomization {
  const seed = options.seed ?? Date.now();
  const random = createSeededRandom(String(seed));
  const family = options.family ?? "balanced";
  const skinHue = pick(random.next, [18, 24, 30, 340]);
  const hairHue = pick(random.next, [20, 28, 36, 210, 270, 320]);
  const bodyHue = pickHueByFamily(random.next, family);
  const legsHue = (bodyHue + pick(random.next, [70, 110, 160, 210])) % 360;

  return createPlayerCustomization(
    `random-${String(seed).slice(0, 24)}`,
    `Seed ${String(seed).slice(0, 12)}`,
    {
      hair: hslToHex(hairHue, pick(random.next, [45, 55, 70]), pick(random.next, [16, 22, 30])),
      skin: hslToHex(skinHue, pick(random.next, [45, 55, 65]), pick(random.next, [62, 70, 78])),
      accessory: hslToHex((bodyHue + 180) % 360, 90, family === "soft" ? 68 : 55),
      body: hslToHex(bodyHue, family === "soft" ? 58 : 82, family === "contrast" ? 42 : 50),
      arms: hslToHex(bodyHue, family === "soft" ? 50 : 74, family === "contrast" ? 48 : 56),
      legs: hslToHex(legsHue, family === "soft" ? 45 : 70, family === "contrast" ? 34 : 46),
      feet: hslToHex(pick(random.next, [0, 210, 260, 30]), pick(random.next, [0, 10, 28]), pick(random.next, [76, 84, 90]))
    }
  );
}

/** Retourne une seed courte destinee a l'UI. */
export function createPlayerCustomizationSeed(): string {
  return `player-${Date.now().toString(36)}-${Math.floor(Math.random() * 0xffff).toString(16)}`;
}

/** Choisit une teinte principale selon la famille demandee. */
function pickHueByFamily(random: () => number, family: PlayerCustomizationRandomFamily): number {
  if (family === "arcade") {
    return pick(random, [0, 55, 120, 190, 260, 305]);
  }
  if (family === "contrast") {
    return pick(random, [220, 250, 290, 340, 25]);
  }
  if (family === "soft") {
    return pick(random, [155, 190, 225, 280, 330]);
  }
  return Math.floor(random() * 360);
}

/** Selectionne un element de liste via le generateur donne. */
function pick<T>(random: () => number, values: readonly T[]): T {
  return values[Math.floor(random() * values.length)] ?? values[0];
}

/** Convertit HSL en couleur hex libre. */
function hslToHex(hue: number, saturation: number, lightness: number): string {
  const normalizedHue = ((hue % 360) + 360) % 360 / 360;
  const normalizedSaturation = saturation / 100;
  const normalizedLightness = lightness / 100;
  const q = normalizedLightness < 0.5
    ? normalizedLightness * (1 + normalizedSaturation)
    : normalizedLightness + normalizedSaturation - normalizedLightness * normalizedSaturation;
  const p = 2 * normalizedLightness - q;
  const red = hueToRgb(p, q, normalizedHue + 1 / 3);
  const green = hueToRgb(p, q, normalizedHue);
  const blue = hueToRgb(p, q, normalizedHue - 1 / 3);
  return `#${toHexByte(red)}${toHexByte(green)}${toHexByte(blue)}`;
}

/** Convertit une composante HSL en composante RGB normalisee. */
function hueToRgb(p: number, q: number, value: number): number {
  let t = value;
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

/** Formate une composante RGB normalisee en octet hex. */
function toHexByte(value: number): string {
  return Math.round(value * 255).toString(16).padStart(2, "0");
}
