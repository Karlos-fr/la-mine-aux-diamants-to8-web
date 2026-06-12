/**
 * Role: Decrit le profil moderne de personnalisation du joueur.
 * Scope: Fournit types, valeurs par defaut et validation des couleurs libres utilisateur.
 * ISO: Le profil original garde l'atlas joueur extrait sans recoloration.
 * Notes: Les couleurs sont libres; les suggestions UI ne contraignent pas le modele.
 */

/** Parties du sprite joueur personnalisables par recoloration. */
export type PlayerBodyPart = "hair" | "skin" | "accessory" | "body" | "arms" | "legs" | "feet";

/** Couleurs libres appliquees aux parties visibles du sprite joueur. */
export interface PlayerCustomizationColors {
  /** Couleur des cheveux ajoutes par masque sur le haut de la tete. */
  readonly hair: string;
  /** Couleur de peau du visage et des mains. */
  readonly skin: string;
  /** Couleur du detail cyan original, conserve comme accessoire/cou. */
  readonly accessory: string;
  /** Couleur principale du torse. */
  readonly body: string;
  /** Couleur des bras quand ils sont separables du torse. */
  readonly arms: string;
  /** Couleur des jambes. */
  readonly legs: string;
  /** Couleur des pieds. */
  readonly feet: string;
}

/** Profil complet sauvegarde et applique au rendu joueur. */
export interface PlayerCustomization {
  /** Version du format localStorage. */
  readonly version: 1;
  /** Identifiant court du profil. */
  readonly id: string;
  /** Libelle affiche dans l'UI. */
  readonly label: string;
  /** Couleurs par partie du corps. */
  readonly colors: PlayerCustomizationColors;
}

/** Couleurs libres par defaut, proches du sprite TO8 extrait. */
export const DEFAULT_PLAYER_CUSTOMIZATION: PlayerCustomization = {
  version: 1,
  id: "original",
  label: "Original",
  colors: {
    hair: "#7b3f2a",
    skin: "#e79393",
    accessory: "#00ffff",
    body: "#ff0000",
    arms: "#ff0000",
    legs: "#ef9300",
    feet: "#cbcbcb"
  }
};

/** Ordre stable des parties dans l'UI. */
export const PLAYER_BODY_PARTS: readonly PlayerBodyPart[] = ["hair", "skin", "accessory", "body", "arms", "legs", "feet"];

/** Libelles courts affiches dans l'editeur de personnage. */
export const PLAYER_BODY_PART_LABELS: Record<PlayerBodyPart, string> = {
  hair: "Cheveux",
  skin: "Peau",
  accessory: "Detail",
  body: "Corps",
  arms: "Bras",
  legs: "Jambes",
  feet: "Pieds"
};

/** Suggestions de depart sans limiter les couleurs utilisateur. */
export const PLAYER_CUSTOMIZATION_PRESETS: readonly PlayerCustomization[] = [
  DEFAULT_PLAYER_CUSTOMIZATION,
  createPlayerCustomization("mineur-bleu", "Mineur bleu", {
    hair: "#5a3424",
    skin: "#f0a0a0",
    accessory: "#00ffff",
    body: "#005cff",
    arms: "#005cff",
    legs: "#ef9300",
    feet: "#d8d8d8"
  }),
  createPlayerCustomization("exploratrice", "Exploratrice", {
    hair: "#2b1a12",
    skin: "#d88c6c",
    accessory: "#40ffff",
    body: "#30c050",
    arms: "#30c050",
    legs: "#8030d0",
    feet: "#f0f0f0"
  })
];

/** Cree un profil valide a partir de couleurs libres. */
export function createPlayerCustomization(
  id: string,
  label: string,
  colors: PlayerCustomizationColors
): PlayerCustomization {
  return {
    version: 1,
    id,
    label,
    colors: sanitizePlayerCustomizationColors(colors)
  };
}

/** Valide une personnalisation chargee depuis une source non fiable. */
export function sanitizePlayerCustomization(value: unknown): PlayerCustomization {
  if (!isRecord(value)) {
    return DEFAULT_PLAYER_CUSTOMIZATION;
  }

  return createPlayerCustomization(
    typeof value.id === "string" && value.id.trim() ? value.id : DEFAULT_PLAYER_CUSTOMIZATION.id,
    typeof value.label === "string" && value.label.trim() ? value.label : DEFAULT_PLAYER_CUSTOMIZATION.label,
    sanitizePlayerCustomizationColors(isRecord(value.colors) ? value.colors : DEFAULT_PLAYER_CUSTOMIZATION.colors)
  );
}

/** Valide et complete les couleurs libres d'un profil. */
export function sanitizePlayerCustomizationColors(value: unknown): PlayerCustomizationColors {
  const source = isRecord(value) ? value : {};
  return {
    hair: sanitizeHexColor(source.hair, DEFAULT_PLAYER_CUSTOMIZATION.colors.hair),
    skin: sanitizeHexColor(source.skin, DEFAULT_PLAYER_CUSTOMIZATION.colors.skin),
    accessory: sanitizeHexColor(source.accessory, DEFAULT_PLAYER_CUSTOMIZATION.colors.accessory),
    body: sanitizeHexColor(source.body, DEFAULT_PLAYER_CUSTOMIZATION.colors.body),
    arms: sanitizeHexColor(source.arms, DEFAULT_PLAYER_CUSTOMIZATION.colors.arms),
    legs: sanitizeHexColor(source.legs, DEFAULT_PLAYER_CUSTOMIZATION.colors.legs),
    feet: sanitizeHexColor(source.feet, DEFAULT_PLAYER_CUSTOMIZATION.colors.feet)
  };
}

/** Normalise une couleur hex libre au format `#rrggbb`. */
export function sanitizeHexColor(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  const fullMatch = /^#?([0-9a-f]{6})$/i.exec(trimmed);
  if (fullMatch) {
    return `#${fullMatch[1].toLowerCase()}`;
  }

  const shortMatch = /^#?([0-9a-f]{3})$/i.exec(trimmed);
  if (shortMatch) {
    const [red, green, blue] = shortMatch[1].toLowerCase();
    return `#${red}${red}${green}${green}${blue}${blue}`;
  }

  return fallback;
}

/** Indique si une personnalisation correspond au rendu original. */
export function isOriginalPlayerCustomization(customization: PlayerCustomization): boolean {
  return customization.id === DEFAULT_PLAYER_CUSTOMIZATION.id;
}

/** Verifie qu'une valeur JavaScript peut etre inspectee comme objet. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
