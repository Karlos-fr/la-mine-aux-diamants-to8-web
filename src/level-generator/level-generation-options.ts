/**
 * Role: Definit le contrat public de generation de niveaux seedes.
 * Scope: Regroupe options, resultat et metadonnees sans implementer la generation de grille.
 * ISO: Produit cible compatible avec le JSON moderne, pas avec les structures runtime ASM.
 * Notes: Les phases suivantes brancheront ce contrat au generateur, puis a l'editeur.
 */

import type { ModernLevelJson } from "../game/level-loader";
import type { LevelGenerationProfileId } from "./level-profile";
import type { LevelGenerationSeed } from "./seeded-random";

/** Niveau de difficulte demande au futur generateur. */
export type LevelGenerationDifficulty = "easy" | "normal" | "hard" | "expert";

/** Densite globale demandee pour la grille generee. */
export type LevelGenerationDensity = "light" | "normal" | "dense";

/** Options minimales necessaires pour produire un niveau deterministe. */
export interface LevelGenerationOptions {
  /** Seed texte ou numerique fournie par l'utilisateur ou l'URL. */
  readonly seed: LevelGenerationSeed;
  /** Largeur cible en cellules. */
  readonly width: number;
  /** Hauteur cible en cellules. */
  readonly height: number;
  /** Difficulte cible, utilisee pour doser dangers et objectifs. */
  readonly difficulty: LevelGenerationDifficulty;
  /** Densite cible, utilisee pour doser terre, rochers et vide. */
  readonly density: LevelGenerationDensity;
  /** Profil statistique de reference. */
  readonly profile: LevelGenerationProfileId;
}

/** Metadonnees de generation conservees avec le resultat. */
export interface GeneratedLevelMetadata {
  /** Seed normalisee utilisee par le PRNG. */
  readonly seed: string;
  /** Etat initial numerique derive de la seed. */
  readonly initialState: number;
  /** Options effectives apres normalisation. */
  readonly options: LevelGenerationOptions;
  /** Nombre de tentatives necessaires, reserve pour la phase retries. */
  readonly attempts: number;
  /** Id du profil effectivement utilise. */
  readonly profile: LevelGenerationProfileId;
}

/** Resultat retourne par le futur generateur de niveaux. */
export interface GeneratedLevelResult {
  /** Niveau moderne pret a etre ouvert dans l'editeur ou converti en runtime. */
  readonly level: ModernLevelJson;
  /** Metadonnees utiles a la reproductibilite et au debug. */
  readonly metadata: GeneratedLevelMetadata;
  /** Avertissements non bloquants produits par generation/validation. */
  readonly warnings: readonly string[];
}

/** Options par defaut pour une generation inspiree du profil original. */
export const DEFAULT_LEVEL_GENERATION_OPTIONS: LevelGenerationOptions = {
  seed: "la-mine-2026",
  width: 40,
  height: 22,
  difficulty: "normal",
  density: "normal",
  profile: "original"
};

