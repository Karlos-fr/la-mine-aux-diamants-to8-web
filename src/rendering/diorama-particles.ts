/**
 * Role: Gere les effets de particules modernes du mode Diorama.
 * Scope: Stocke et avance des particules purement visuelles, exposees au renderer 3D.
 * ISO: Aucun effet sur le runtime, les collisions, le score ou les timings gameplay.
 * Notes: Le systeme reste volontairement petit; il sert seulement aux effets de collecte.
 */

import type { DioramaPixelParticle } from "./gameplay-renderer";

/** Duree des particules pixelisees emises a la collecte d'un diamant. */
const DIAMOND_PARTICLE_LIFETIME = 0.46;
/** Duree courte de la poussiere emise quand le joueur creuse la terre. */
const EARTH_DIG_PARTICLE_LIFETIME = 0.34;
/** Nombre maximal de particules conservees pour eviter les accumulations visuelles. */
const MAX_PARTICLES = 96;
/** Gravite visuelle appliquee aux particules Diorama. */
const DIAMOND_PARTICLE_GRAVITY = 4.2;
/** Couleurs arc-en-ciel TO8 utilisees par les particules de collecte. */
const DIAMOND_PARTICLE_COLORS = [
  0xff4040,
  0xffd040,
  0x62ff62,
  0x00ffff,
  0x4080ff,
  0xff62ff
] as const;
/** Bruns TO8 discrets utilises pour la poussiere de terre. */
const EARTH_DIG_PARTICLE_COLORS = [
  0x6b3f18,
  0x8a5a22,
  0xb07a32,
  0xd0a050
] as const;

/** Etat interne mutable d'une particule de collecte. */
interface DioramaParticleState {
  /** Position horizontale en cellules niveau. */
  gridX: number;
  /** Position profondeur en cellules niveau. */
  gridY: number;
  /** Hauteur monde courante. */
  height: number;
  /** Vitesse horizontale en cellules par seconde. */
  readonly velocityX: number;
  /** Vitesse profondeur en cellules par seconde. */
  readonly velocityY: number;
  /** Vitesse verticale monde en unites par seconde. */
  velocityHeight: number;
  /** Couleur RGB Three.js. */
  readonly color: number;
  /** Taille monde du carre pixelise. */
  readonly size: number;
  /** Age courant en secondes. */
  age: number;
  /** Duree de vie en secondes. */
  readonly lifetime: number;
}

/** Petit gestionnaire des particules modernes du Diorama. */
export class DioramaParticleSystem {
  /** Particules actuellement visibles. */
  private readonly particles: DioramaParticleState[] = [];

  /** Cree une gerbe de particules carrees autour d'un diamant collecte. */
  spawnDiamondCollection(gridX: number, gridY: number): void {
    for (let index = 0; index < DIAMOND_PARTICLE_COLORS.length * 2; index += 1) {
      const angle = index * Math.PI * 2 / (DIAMOND_PARTICLE_COLORS.length * 2);
      const speed = 1.3 + (index % 3) * 0.18;
      this.particles.push({
        gridX: gridX + 0.5,
        gridY: gridY + 0.5,
        height: 0.54,
        velocityX: Math.cos(angle) * speed,
        velocityY: Math.sin(angle) * speed * 0.72,
        velocityHeight: 1.55 + (index % 2) * 0.34,
        color: DIAMOND_PARTICLE_COLORS[index % DIAMOND_PARTICLE_COLORS.length],
        size: 0.08 + (index % 2) * 0.025,
        age: 0,
        lifetime: DIAMOND_PARTICLE_LIFETIME
      });
    }
    this.trimOverflow();
  }

  /** Cree une petite trainee de poussiere quand le joueur creuse une tuile de terre. */
  spawnEarthDig(gridX: number, gridY: number, backDirectionX: number, backDirectionY: number): void {
    const length = Math.hypot(backDirectionX, backDirectionY);
    const backX = length > 0 ? backDirectionX / length : 0;
    const backY = length > 0 ? backDirectionY / length : 0;
    for (let index = 0; index < 8; index += 1) {
      const angle = index * Math.PI * 2 / 8;
      const scatterX = Math.cos(angle) * 0.46;
      const scatterY = Math.sin(angle) * 0.32;
      this.particles.push({
        gridX: gridX + 0.5 + backX * 0.22,
        gridY: gridY + 0.5 + backY * 0.22,
        height: 0.18,
        velocityX: backX * 0.9 + scatterX,
        velocityY: backY * 0.65 + scatterY,
        velocityHeight: 0.58 + (index % 3) * 0.08,
        color: EARTH_DIG_PARTICLE_COLORS[index % EARTH_DIG_PARTICLE_COLORS.length],
        size: 0.055 + (index % 2) * 0.02,
        age: 0,
        lifetime: EARTH_DIG_PARTICLE_LIFETIME
      });
    }
    this.trimOverflow();
  }

  /** Avance les particules sans impacter le gameplay. */
  update(dt: number): void {
    for (let index = this.particles.length - 1; index >= 0; index -= 1) {
      const particle = this.particles[index];
      particle.age += dt;
      if (particle.age >= particle.lifetime) {
        this.particles.splice(index, 1);
        continue;
      }

      particle.gridX += particle.velocityX * dt;
      particle.gridY += particle.velocityY * dt;
      particle.velocityHeight -= DIAMOND_PARTICLE_GRAVITY * dt;
      particle.height = Math.max(0.12, particle.height + particle.velocityHeight * dt);
    }
  }

  /** Retourne les particules sous une forme immutable pour le renderer Diorama. */
  getParticles(): readonly DioramaPixelParticle[] {
    return this.particles.map((particle) => ({
      gridX: particle.gridX,
      gridY: particle.gridY,
      height: particle.height,
      color: particle.color,
      size: particle.size,
      progress: Math.min(1, particle.age / particle.lifetime)
    }));
  }

  /** Supprime les particules les plus anciennes si plusieurs collectes arrivent ensemble. */
  private trimOverflow(): void {
    const overflow = this.particles.length - MAX_PARTICLES;
    if (overflow > 0) {
      this.particles.splice(0, overflow);
    }
  }
}
