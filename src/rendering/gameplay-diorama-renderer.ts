/**
 * Role: Rend le niveau gameplay sous forme de diorama 3D pixelise.
 * Scope: Reconstruit une scene Three.js depuis la grille runtime visible, puis la recopie dans le canvas 2D.
 * ISO: Ne modifie jamais l'etat gameplay; collisions, camera logique et timings restent portes par le runtime 2D.
 * Notes: Les blocs gardent uniquement leur face haute texturee; les objets sensibles au detourage restent en sprites.
 */

import * as THREE from "three";
import type { Renderer } from "../engine/renderer";
import type { RenderSurfaceSize, TileFrame } from "../engine/render-types";
import { getMovementRenderProgress } from "../game/movement-visuals";
import { RUNTIME_TILE } from "../game/runtime-tiles";
import type { EntityState, FallingObjectRuntimeState } from "../game/types";
import { createDiamondGeometry } from "./diorama-geometries";
import { createFrameTexture, createRepeatedFrameTexture, getFrameCacheKey } from "./diorama-textures";
import { getRenderedFallingObjectGridPosition } from "./entity-renderer";
import type { GameplayRenderContext } from "./gameplay-renderer";
import { resolvePseudo3DRenderStyle } from "./pseudo-3d-render-style";

/** Couleur de fond du diorama, identique au noir TO8. */
const DIORAMA_BACKGROUND = 0x000000;
/** Hauteur des cellules de terre, volontairement basse pour ne pas saturer la vue. */
const EARTH_HEIGHT = 0.08;
/** Hauteur des blocs solides. */
const SOLID_HEIGHT = 0.58;
/** Hauteur des entites billboard simplifiees. */
const ENTITY_HEIGHT = 0.68;
/** Hauteur des monstres cubiques en mode diorama. */
const MONSTER_CUBE_HEIGHT = 0.72;
/** Rayon horizontal du diamant facette. */
const DIAMOND_RADIUS = 0.42;
/** Demi-hauteur du diamant facette. */
const DIAMOND_HALF_HEIGHT = 0.42;
/** Rayon visuel des rochers spheriques. */
const ROCK_SPHERE_RADIUS = 0.38;
/** Nombre de repetitions horizontales de la tile rocher sur la sphere. */
const ROCK_TEXTURE_REPEAT_X = 3;
/** Nombre de repetitions verticales de la tile rocher sur la sphere. */
const ROCK_TEXTURE_REPEAT_Y = 2;
/** Couleur utilisee pour remplacer le noir de detourage externe sur les textures de sphere. */
const ROCK_EDGE_FILL_COLOR = 0x8c8c8c;
/** Taille monde des voxels issus des sprites d'explosion TO8. */
const EXPLOSION_VOXEL_SIZE = 0.055;
/** Hauteur de base des voxels d'explosion au-dessus du sol. */
const EXPLOSION_BASE_HEIGHT = 0.18;
/** Marge orthographique autour de la grille visible. */
const CAMERA_MARGIN = 1.2;
/** Marge de profondeur pour eviter les coupes near/far quand la scene pivote. */
const CAMERA_DEPTH_MARGIN = 2;
/** Hauteur fixe de la camera pour que le drag X/Z ne cree pas d'effet zoom vertical. */
const CAMERA_HEIGHT = 9.6;
/** Profondeur fixe de la camera; le drag pivote la scene au lieu de deplacer la camera. */
const CAMERA_DEPTH = 6.5;
/** Distance de reference de la camera, conservee comme minimum pour garder le rendu existant. */
const CAMERA_BASE_DISTANCE = Math.hypot(CAMERA_HEIGHT, CAMERA_DEPTH);
/** Espace de securite devant le plan near pour eviter les coupes en rotation forte. */
const CAMERA_NEAR_GUARD = 1;
/** Angle de reference utilise pour cadrer sans effet de zoom pendant le drag. */
const CAMERA_FRAME_REFERENCE_PITCH_DEG = 58;

/** Palette diorama volontairement limitee et lisible sur fond noir. */
const MATERIAL_COLORS = {
  earth: 0x28a840,
  border: 0x0001fe,
  platform: 0x78e060,
  transformerBlock: 0xf0d050,
  rock: 0x9c9c9c,
  diamond: 0x00ffff,
  monster: 0xff4040,
  specialCreature: 0xc050c8,
  player: 0xf0b040
} as const;

/** Strategie de texturage des blocs extrudes. */
type BlockTextureMode = "topOnly" | "allFaces";

/** Pixel visible extrait d'une frame d'explosion. */
interface ExplosionVoxelPixel {
  /** Position horizontale normalisee autour du centre de la tuile. */
  readonly x: number;
  /** Position profondeur normalisee autour du centre de la tuile. */
  readonly z: number;
  /** Couleur RGB Three.js. */
  readonly color: number;
}

/** Renderer WebGL offscreen utilise uniquement par le mode `Diorama TO8`. */
export class GameplayDioramaRenderer {
  /** Canvas basse resolution recopie ensuite dans le renderer 2D. */
  private readonly canvas = document.createElement("canvas");
  /** Scene Three.js reconstruite a chaque frame pour rester simple et sans etat gameplay cache. */
  private readonly scene = new THREE.Scene();
  /** Groupe contenant le niveau; lui seul pivote sous l'action de la souris. */
  private readonly contentGroup = new THREE.Group();
  /** Camera orthographique inclinee type maquette. */
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  /** Renderer WebGL sans antialiasing pour preserver le pixel-art. */
  private readonly webglRenderer = new THREE.WebGLRenderer({
    canvas: this.canvas,
    antialias: false,
    alpha: false
  });
  /** Geometrie partagee pour les blocs extrudes. */
  private readonly boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  /** Geometrie partagee pour les rochers spheriques. */
  private readonly rockGeometry = new THREE.SphereGeometry(ROCK_SPHERE_RADIUS, 16, 12);
  /** Geometrie partagee pour les diamants, avec UV adaptees a la tile TO8. */
  private readonly diamondGeometry = createDiamondGeometry(DIAMOND_RADIUS, DIAMOND_HALF_HEIGHT);
  /** Geometrie partagee pour ancrer les sprites au sol. */
  private readonly shadowGeometry = new THREE.CircleGeometry(0.36, 12);
  /** Boite de calcul reutilisee pour cadrer la scene Diorama. */
  private readonly contentBounds = new THREE.Box3();
  /** Points de calcul reutilises pour eviter les allocations du cadrage. */
  private readonly contentBoundsCorners = Array.from({ length: 8 }, () => new THREE.Vector3());
  /** Materiaux caches par couleur pour eviter de les recreer a chaque frame. */
  private readonly materials = new Map<number, THREE.MeshLambertMaterial>();
  /** Materiaux d'ombre caches par couleur et opacite. */
  private readonly shadowMaterials = new Map<string, THREE.MeshBasicMaterial>();
  /** Materiaux de particules pixelisees caches par couleur. */
  private readonly particleMaterials = new Map<number, THREE.MeshBasicMaterial>();
  /** Materiaux de faces hautes caches par frame atlas. */
  private readonly tileMaterials = new Map<string, THREE.MeshBasicMaterial>();
  /** Materiaux de diamants textures caches par frame atlas. */
  private readonly diamondMaterials = new Map<string, THREE.MeshBasicMaterial>();
  /** Materiaux de rochers spheriques caches par frame atlas. */
  private readonly rockMaterials = new Map<string, THREE.MeshBasicMaterial>();
  /** Materiaux de billboards d'entites caches par frame atlas. */
  private readonly entityBillboardMaterials = new Map<string, THREE.SpriteMaterial>();
  /** Pixels visibles des frames d'explosion caches par frame atlas. */
  private readonly explosionVoxelPixels = new Map<string, readonly ExplosionVoxelPixel[]>();
  /** Dernier facteur d'upscale ayant servi a creer les materiaux textures. */
  private lastTextureUpscale = 0;
  /** Lumiere ambiante conservee entre les frames. */
  private readonly ambientLight = new THREE.AmbientLight(0xffffff, 0.72);
  /** Lumiere directionnelle conservee entre les frames. */
  private readonly directionalLight = new THREE.DirectionalLight(0xffffff, 0.48);

  /** Initialise les contraintes pixel-art de la sortie WebGL. */
  constructor() {
    this.webglRenderer.setClearColor(DIORAMA_BACKGROUND, 1);
    this.webglRenderer.setPixelRatio(1);
    this.canvas.style.imageRendering = "pixelated";
    this.scene.background = new THREE.Color(DIORAMA_BACKGROUND);
    this.directionalLight.position.set(4, 8, 6);
  }

  /** Rend le diorama en surface moderne puis le compose dans la zone logique de jeu. */
  render(renderer: Renderer, context: GameplayRenderContext, playfieldHeight: number, playfieldSurfaceSize: RenderSurfaceSize): void {
    const width = Math.max(1, Math.floor(playfieldSurfaceSize.width));
    const height = Math.max(1, Math.floor(playfieldSurfaceSize.height));
    const internalResolutionScale = Math.max(1, Math.floor(context.dioramaRenderOptions.supersampling));
    const internalWidth = width * internalResolutionScale;
    const internalHeight = height * internalResolutionScale;
    this.resize(internalWidth, internalHeight);
    this.clearTextureDependentCachesIfNeeded(context);
    this.clearScene();
    this.addLights(context);
    this.addContentGroup(context);
    this.addGridTiles(context);
    this.addFallingObjects(context);
    this.addEntities(context);
    this.addParticles(context);
    this.configureCamera(context, width, height);
    this.webglRenderer.render(this.scene, this.camera);
    renderer.drawImage(this.canvas, 0, 0, {
      destinationSize: {
        width: renderer.width,
        height: playfieldHeight
      },
      smoothing: internalResolutionScale > 1 && context.dioramaRenderOptions.downscaleSmoothing
    });
  }

  /** Ajuste la resolution interne a la surface moderne demandee pour le Diorama. */
  private resize(width: number, height: number): void {
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.webglRenderer.setSize(width, height, false);
    }
  }

  /** Vide la scene sans detruire les ressources partagees. */
  private clearScene(): void {
    while (this.scene.children.length > 0) {
      this.scene.remove(this.scene.children[0]);
    }
    while (this.contentGroup.children.length > 0) {
      this.contentGroup.remove(this.contentGroup.children[0]);
    }
  }

  /** Purge les materiaux textures quand un reglage change leur resolution source. */
  private clearTextureDependentCachesIfNeeded(context: GameplayRenderContext): void {
    const textureUpscale = getTextureUpscale(context);
    if (this.lastTextureUpscale === textureUpscale) {
      return;
    }

    this.lastTextureUpscale = textureUpscale;
    this.tileMaterials.clear();
    this.diamondMaterials.clear();
    this.rockMaterials.clear();
    this.entityBillboardMaterials.clear();
  }

  /** Repose les lumieres persistantes apres nettoyage de la scene. */
  private addLights(context: GameplayRenderContext): void {
    this.ambientLight.intensity = context.dioramaRenderOptions.ambientLight;
    this.directionalLight.intensity = context.dioramaRenderOptions.directionalLight;
    this.scene.add(this.ambientLight, this.directionalLight);
  }

  /** Ajoute le groupe niveau avec une rotation issue du controle souris. */
  private addContentGroup(context: GameplayRenderContext): void {
    const rotation = new THREE.Euler(
      degreesToRadians(context.dioramaCamera.rotationXDeg),
      degreesToRadians(context.dioramaCamera.rotationYDeg),
      degreesToRadians(context.dioramaCamera.rotationZDeg)
    );
    this.contentGroup.rotation.set(rotation.x, rotation.y, rotation.z);
    this.contentGroup.scale.setScalar(1);
    this.contentGroup.position.set(0, 0, 0);
    this.scene.add(this.contentGroup);
  }

  /** Cadre le contenu 3D reel avec un frustum qui reste valide quelle que soit la rotation. */
  private configureCamera(context: GameplayRenderContext, width: number, height: number): void {
    const aspect = width / height;
    this.contentGroup.updateMatrixWorld(true);

    this.contentBounds.setFromObject(this.contentGroup);
    if (this.contentBounds.isEmpty()) {
      this.configureFallbackCamera(context, aspect);
      return;
    }

    this.configureCameraPose(this.getCameraDistanceForContentBounds());
    const bounds = this.getCameraSpaceContentBounds();
    const fullWidth = Math.max(1, bounds.maxX - bounds.minX + CAMERA_MARGIN);
    const fullHeight = Math.max(1, bounds.maxY - bounds.minY + CAMERA_MARGIN);
    const zoom = Math.max(0.1, context.dioramaCamera.zoom);
    const viewHeight = Math.max(fullHeight / zoom, fullWidth / zoom / aspect);
    const viewWidth = viewHeight * aspect;
    const pivot = this.projectWorldPointToCameraPlane(getDioramaZoomPivotPosition(context).applyMatrix4(this.contentGroup.matrixWorld));
    const centerX = clampFrustumCenter(
      (bounds.minX + bounds.maxX) / 2 + (pivot.x - (bounds.minX + bounds.maxX) / 2) * (1 - 1 / zoom),
      bounds.minX,
      bounds.maxX,
      viewWidth
    ) + context.dioramaShakeOffset.x;
    const centerY = clampFrustumCenter(
      (bounds.minY + bounds.maxY) / 2 + (pivot.y - (bounds.minY + bounds.maxY) / 2) * (1 - 1 / zoom),
      bounds.minY,
      bounds.maxY,
      viewHeight
    ) + context.dioramaShakeOffset.y;

    this.camera.left = centerX - viewWidth / 2;
    this.camera.right = centerX + viewWidth / 2;
    this.camera.top = centerY + viewHeight / 2;
    this.camera.bottom = centerY - viewHeight / 2;
    this.camera.near = Math.max(0.01, -bounds.maxZ - CAMERA_DEPTH_MARGIN);
    this.camera.far = Math.max(this.camera.near + 1, -bounds.minZ + CAMERA_DEPTH_MARGIN);
    this.camera.updateProjectionMatrix();
  }

  /** Cadre de secours utilise si le groupe Diorama ne contient encore aucune primitive. */
  private configureFallbackCamera(context: GameplayRenderContext, aspect: number): void {
    this.configureCameraPose(CAMERA_BASE_DISTANCE);
    const compensatedRows = context.viewport.rows * getGroundDepthScale(CAMERA_FRAME_REFERENCE_PITCH_DEG);
    const viewHeight = Math.max(compensatedRows + CAMERA_MARGIN, (context.viewport.columns + CAMERA_MARGIN) / aspect);
    const viewWidth = viewHeight * aspect;
    this.camera.left = -viewWidth / 2;
    this.camera.right = viewWidth / 2;
    this.camera.top = viewHeight / 2;
    this.camera.bottom = -viewHeight / 2;
    this.camera.near = 0.1;
    this.camera.far = 100;
    this.camera.updateProjectionMatrix();
  }

  /** Place la camera sur son axe de reference sans changer le grossissement orthographique. */
  private configureCameraPose(distance: number): void {
    const scale = distance / CAMERA_BASE_DISTANCE;
    this.camera.position.set(0, CAMERA_HEIGHT * scale, CAMERA_DEPTH * scale);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateMatrixWorld(true);
  }

  /** Retourne une distance camera suffisante pour garder toute la scene devant le plan near. */
  private getCameraDistanceForContentBounds(): number {
    const min = this.contentBounds.min;
    const max = this.contentBounds.max;
    const corners = this.contentBoundsCorners;
    corners[0].set(min.x, min.y, min.z);
    corners[1].set(max.x, min.y, min.z);
    corners[2].set(min.x, max.y, min.z);
    corners[3].set(max.x, max.y, min.z);
    corners[4].set(min.x, min.y, max.z);
    corners[5].set(max.x, min.y, max.z);
    corners[6].set(min.x, max.y, max.z);
    corners[7].set(max.x, max.y, max.z);

    const cameraBackX = 0;
    const cameraBackY = CAMERA_HEIGHT / CAMERA_BASE_DISTANCE;
    const cameraBackZ = CAMERA_DEPTH / CAMERA_BASE_DISTANCE;
    let nearestContentProjection = Number.NEGATIVE_INFINITY;
    for (const corner of corners) {
      nearestContentProjection = Math.max(
        nearestContentProjection,
        corner.x * cameraBackX + corner.y * cameraBackY + corner.z * cameraBackZ
      );
    }

    return Math.max(CAMERA_BASE_DISTANCE, nearestContentProjection + CAMERA_DEPTH_MARGIN + CAMERA_NEAR_GUARD);
  }

  /** Retourne les limites du contenu dans le repere camera courant. */
  private getCameraSpaceContentBounds(): { readonly minX: number; readonly maxX: number; readonly minY: number; readonly maxY: number; readonly minZ: number; readonly maxZ: number } {
    const min = this.contentBounds.min;
    const max = this.contentBounds.max;
    const corners = this.contentBoundsCorners;
    corners[0].set(min.x, min.y, min.z);
    corners[1].set(max.x, min.y, min.z);
    corners[2].set(min.x, max.y, min.z);
    corners[3].set(max.x, max.y, min.z);
    corners[4].set(min.x, min.y, max.z);
    corners[5].set(max.x, min.y, max.z);
    corners[6].set(min.x, max.y, max.z);
    corners[7].set(max.x, max.y, max.z);

    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;
    for (const corner of corners) {
      corner.applyMatrix4(this.camera.matrixWorldInverse);
      minX = Math.min(minX, corner.x);
      maxX = Math.max(maxX, corner.x);
      minY = Math.min(minY, corner.y);
      maxY = Math.max(maxY, corner.y);
      minZ = Math.min(minZ, corner.z);
      maxZ = Math.max(maxZ, corner.z);
    }

    return { minX, maxX, minY, maxY, minZ, maxZ };
  }

  /** Projette un point monde dans le plan camera pour centrer le zoom visuel. */
  private projectWorldPointToCameraPlane(point: THREE.Vector3): { readonly x: number; readonly y: number } {
    const projected = point.clone().applyMatrix4(this.camera.matrixWorldInverse);
    return { x: projected.x, y: projected.y };
  }

  /** Convertit les tuiles visibles en volumes simples. */
  private addGridTiles(context: GameplayRenderContext): void {
    const baseLevelX = Math.floor(context.viewport.x);
    const baseLevelY = Math.floor(context.viewport.y);
    for (let y = 0; y < context.viewport.rows + 2; y += 1) {
      for (let x = 0; x < context.viewport.columns + 2; x += 1) {
        const levelX = baseLevelX + x;
        const levelY = baseLevelY + y;
        if (!isInsideRenderedLevel(context, levelX, levelY)) {
          continue;
        }

        if (isPhysicalObjectMovementCell(context, levelX, levelY)) {
          continue;
        }

        const spawnBlinkTileId = context.getPlayerSpawnBlinkTileId(levelX, levelY);
        if (spawnBlinkTileId === null) {
          continue;
        }

        const tileId = spawnBlinkTileId ?? context.getExitBlinkTileId(levelX, levelY) ?? context.getRuntimeTile(levelX, levelY);
        if (isExplosionTileId(tileId)) {
          this.addExplosionVoxels(context, levelX, levelY, tileId);
          continue;
        }

        const style = resolvePseudo3DRenderStyle("dioramaTo8", tileId, context.tileIds);
        switch (style.behavior) {
          case "earth":
            this.addTexturedBlock(context, levelX, levelY, EARTH_HEIGHT, MATERIAL_COLORS.earth, tileId);
            break;
          case "border":
            this.addTexturedBlock(context, levelX, levelY, SOLID_HEIGHT, MATERIAL_COLORS.border, tileId, "allFaces");
            break;
          case "platform":
            this.addTexturedBlock(context, levelX, levelY, SOLID_HEIGHT * 0.7, MATERIAL_COLORS.platform, tileId);
            break;
          case "transformerBlock":
            this.addTexturedBlock(context, levelX, levelY, SOLID_HEIGHT, MATERIAL_COLORS.transformerBlock, tileId, "allFaces");
            break;
          case "rock":
            this.addRock(context, levelX, levelY, context.getTileFrame(tileId));
            break;
          case "diamond":
            if (!context.findEntityAtGrid(levelX, levelY)) {
              this.addDiamond(context, levelX, levelY, context.getDiamondTileFrame());
            }
            break;
          default:
            break;
        }
      }
    }
  }

  /** Ajoute les objets physiques interpoles selon leur position visuelle courante. */
  private addFallingObjects(context: GameplayRenderContext): void {
    for (const object of context.state.fallingObjects) {
      const position = getRenderedFallingObjectGridPosition(object);
      if (!isVisibleGridPosition(context, position.x, position.y)) {
        continue;
      }

      if (object.kind === "diamond") {
        this.addDiamond(context, position.x, position.y, context.getDiamondTileFrame());
      } else {
        this.addRock(context, position.x, position.y, context.getTileFrame(object.tileId), object);
      }
    }
  }

  /** Ajoute les entites actives comme volumes lisibles en surcouche de la grille. */
  private addEntities(context: GameplayRenderContext): void {
    for (const entity of context.state.entities) {
      if (!entity.active || !isVisibleGridPosition(context, entity.gridX, entity.gridY)) {
        continue;
      }

      if (entity.kind === "player" && context.isPlayerSpawning()) {
        continue;
      }

      if (entity.kind === "diamond" && context.state.fallingObjects.some((object) => object.entityId === entity.id)) {
        continue;
      }

      this.addEntity(context, entity);
    }
  }

  /** Ajoute un bloc dont la face haute reste la vraie tile TO8. */
  private addTexturedBlock(
    context: GameplayRenderContext,
    gridX: number,
    gridY: number,
    height: number,
    sideColor: number,
    tileId: number,
    textureMode: BlockTextureMode = "topOnly",
    horizontalScale = 1
  ): void {
    const materials = textureMode === "allFaces"
      ? this.getFullyTexturedCubeMaterials(context, context.getTileFrame(tileId))
      : this.getBlockMaterials(context, tileId, sideColor);
    const mesh = new THREE.Mesh(this.boxGeometry, materials);
    const position = getWorldPosition(context, gridX, gridY);
    mesh.scale.set(horizontalScale, height, horizontalScale * getCellDepthScale());
    mesh.position.set(position.x, height / 2, position.z);
    this.contentGroup.add(mesh);
  }

  /** Ajoute un rocher comme sphere texturee, avec rotation visuelle pendant ses mouvements physiques. */
  private addRock(context: GameplayRenderContext, gridX: number, gridY: number, frame: TileFrame, movement?: FallingObjectRuntimeState): void {
    const position = getWorldPosition(context, gridX, gridY);
    this.addGroundShadow(context, position.x, position.z, 0.82, 0.34);
    const mesh = new THREE.Mesh(this.rockGeometry, this.getRockMaterial(context, frame));
    mesh.position.set(position.x, ROCK_SPHERE_RADIUS + 0.05, position.z);
    applyRockRotation(mesh, context, movement);
    this.contentGroup.add(mesh);
  }

  /** Ajoute une ombre plate pour poser un sprite dans la scene 3D. */
  private addGroundShadow(context: GameplayRenderContext, worldX: number, worldZ: number, width: number, depth: number): void {
    const mesh = new THREE.Mesh(this.shadowGeometry, this.getShadowMaterial(0x202020, context.dioramaRenderOptions.groundShadowOpacity));
    mesh.scale.set(width, depth, 1);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(worldX, 0.01, worldZ + 0.04);
    this.contentGroup.add(mesh);
  }

  /** Ajoute un diamant facette simple avec sa tile TO8 animee plaquee sur la primitive. */
  private addDiamond(context: GameplayRenderContext, gridX: number, gridY: number, frame: TileFrame): void {
    const mesh = new THREE.Mesh(this.diamondGeometry, this.getDiamondMaterial(context, frame));
    const position = getWorldPosition(context, gridX, gridY);
    mesh.position.set(position.x, 0.48, position.z);
    mesh.rotation.y = Math.PI / 4;
    this.contentGroup.add(mesh);
  }

  /** Ajoute joueur, monstres et creatures selon leur representation diorama. */
  private addEntity(context: GameplayRenderContext, entity: EntityState): void {
    if (entity.kind === "diamond") {
      this.addDiamond(context, entity.gridX, entity.gridY, context.getDiamondTileFrame());
      return;
    }

    if (entity.kind === "monster") {
      this.addEntityCube(context, entity, context.getMonsterTileFrame(entity));
      return;
    }

    if (entity.kind === "specialCreature") {
      this.addEntityCube(context, entity, context.getSpecialCreatureTileFrame());
      return;
    }

    const frame = context.getTileFrame(context.getEntityTileFrameId(entity.kind));
    const mesh = new THREE.Sprite(this.getEntityBillboardMaterial(context, frame));
    const position = getWorldPosition(context, entity.gridX, entity.gridY);
    mesh.scale.set(context.dioramaRenderOptions.billboardScale, context.dioramaRenderOptions.billboardScale, 1);
    mesh.position.set(position.x, ENTITY_HEIGHT / 2 + 0.04, position.z);
    mesh.renderOrder = entity.kind === "player" ? 8 : 6;
    this.contentGroup.add(mesh);
  }

  /** Ajoute une entite mobile comme cube 3D texture avec sa frame TO8 animee. */
  private addEntityCube(context: GameplayRenderContext, entity: EntityState, frame: TileFrame): void {
    const mesh = new THREE.Mesh(this.boxGeometry, this.getFullyTexturedCubeMaterials(context, frame));
    const position = getWorldPosition(context, entity.gridX, entity.gridY);
    mesh.scale.set(0.76, MONSTER_CUBE_HEIGHT, 0.76);
    mesh.position.set(position.x, MONSTER_CUBE_HEIGHT / 2, position.z);
    this.contentGroup.add(mesh);
  }

  /** Ajoute les particules carrees emises par les effets modernes du Diorama. */
  private addParticles(context: GameplayRenderContext): void {
    for (const particle of context.dioramaParticles) {
      if (!isVisibleGridPosition(context, particle.gridX, particle.gridY)) {
        continue;
      }

      const position = getWorldPosition(context, particle.gridX, particle.gridY);
      const mesh = new THREE.Mesh(this.boxGeometry, this.getParticleMaterial(particle.color));
      const fadeScale = 1 - particle.progress * 0.55;
      const size = particle.size * Math.max(0.35, fadeScale);
      mesh.scale.set(size, size, size);
      mesh.position.set(position.x, particle.height, position.z);
      mesh.rotation.set(particle.progress * Math.PI, particle.progress * Math.PI * 1.5, 0);
      mesh.renderOrder = 20;
      this.contentGroup.add(mesh);
    }
  }

  /** Ajoute l'explosion TO8 sous forme de petits voxels issus de la tile courante. */
  private addExplosionVoxels(context: GameplayRenderContext, gridX: number, gridY: number, tileId: number): void {
    const frame = context.getTileFrame(tileId);
    const pixels = this.getExplosionVoxelPixels(frame);
    const position = getWorldPosition(context, gridX, gridY);
    const phase = getExplosionTilePhase(tileId);
    const depthScale = getCellDepthScale();
    const expansion = phase * 0.09;

    for (const pixel of pixels) {
      const directionLength = Math.hypot(pixel.x, pixel.z);
      const directionX = directionLength > 0 ? pixel.x / directionLength : 0;
      const directionZ = directionLength > 0 ? pixel.z / directionLength : 0;
      const jitter = deterministicUnit(gridX, gridY, pixel.x, pixel.z);
      const mesh = new THREE.Mesh(this.boxGeometry, this.getParticleMaterial(pixel.color));
      mesh.scale.set(EXPLOSION_VOXEL_SIZE, EXPLOSION_VOXEL_SIZE, EXPLOSION_VOXEL_SIZE);
      mesh.position.set(
        position.x + pixel.x + directionX * expansion,
        EXPLOSION_BASE_HEIGHT + phase * 0.08 + jitter * 0.22,
        position.z + (pixel.z + directionZ * expansion) * depthScale
      );
      mesh.rotation.set(jitter * Math.PI, phase * 0.7, jitter * Math.PI * 0.5);
      mesh.renderOrder = 18;
      this.contentGroup.add(mesh);
    }
  }

  /** Retourne les faces d'un bloc selon sa strategie de texturage Diorama. */
  private getBlockMaterials(context: GameplayRenderContext, tileId: number, sideColor: number): THREE.Material[] {
    const sideMaterial = this.getMaterial(sideColor);
    const topMaterial = this.getTileMaterial(context, context.getTileFrame(tileId));

    return [
      sideMaterial,
      sideMaterial,
      topMaterial,
      sideMaterial,
      sideMaterial,
      sideMaterial
    ];
  }

  /** Retourne les faces d'un cube anime, utilise pour les monstres lisibles sous tous les angles. */
  private getFullyTexturedCubeMaterials(context: GameplayRenderContext, frame: TileFrame): THREE.Material[] {
    const frameMaterial = this.getTileMaterial(context, frame);
    return [
      frameMaterial,
      frameMaterial,
      frameMaterial,
      frameMaterial,
      frameMaterial,
      frameMaterial
    ];
  }

  /** Retourne un materiau plat reutilisable pour une couleur palette. */
  private getMaterial(color: number): THREE.MeshLambertMaterial {
    const cached = this.materials.get(color);
    if (cached) {
      return cached;
    }

    const material = new THREE.MeshLambertMaterial({
      color,
      flatShading: true
    });
    this.materials.set(color, material);
    return material;
  }

  /** Retourne un materiau d'ombre transparent reutilisable. */
  private getShadowMaterial(color: number, opacity: number): THREE.MeshBasicMaterial {
    const safeOpacity = Number(opacity.toFixed(2));
    const key = `${color}:${safeOpacity}`;
    const cached = this.shadowMaterials.get(key);
    if (cached) {
      return cached;
    }

    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: safeOpacity,
      depthWrite: false
    });
    this.shadowMaterials.set(key, material);
    return material;
  }

  /** Retourne un materiau non eclaire pour une particule carree pixelisee. */
  private getParticleMaterial(color: number): THREE.MeshBasicMaterial {
    const cached = this.particleMaterials.get(color);
    if (cached) {
      return cached;
    }

    const material = new THREE.MeshBasicMaterial({
      color
    });
    this.particleMaterials.set(color, material);
    return material;
  }

  /** Retourne un materiau texture pour une face haute de tuile. */
  private getTileMaterial(context: GameplayRenderContext, frame: TileFrame): THREE.MeshBasicMaterial {
    const textureScale = getTextureUpscale(context);
    const key = getFrameCacheKey(frame, textureScale, false);
    const cached = this.tileMaterials.get(key);
    if (cached) {
      return cached;
    }

    const material = new THREE.MeshBasicMaterial({
      map: createFrameTexture(frame, false, textureScale)
    });
    this.tileMaterials.set(key, material);
    return material;
  }

  /** Retourne un materiau de diamant texture sans transparence, les UV evitant le fond noir. */
  private getDiamondMaterial(context: GameplayRenderContext, frame: TileFrame): THREE.MeshBasicMaterial {
    const textureScale = getTextureUpscale(context);
    const key = `diamond:${getFrameCacheKey(frame, textureScale, false)}`;
    const cached = this.diamondMaterials.get(key);
    if (cached) {
      return cached;
    }

    const material = new THREE.MeshBasicMaterial({
      map: createFrameTexture(frame, false, textureScale),
      side: THREE.DoubleSide
    });
    this.diamondMaterials.set(key, material);
    return material;
  }

  /** Retourne un materiau de sphere rocher dont la texture TO8 est repetee et nettoyee. */
  private getRockMaterial(context: GameplayRenderContext, frame: TileFrame): THREE.MeshBasicMaterial {
    const textureScale = getTextureUpscale(context);
    const key = `rock:${getFrameCacheKey(frame, textureScale, false)}:${ROCK_TEXTURE_REPEAT_X}:${ROCK_TEXTURE_REPEAT_Y}`;
    const cached = this.rockMaterials.get(key);
    if (cached) {
      return cached;
    }

    const material = new THREE.MeshBasicMaterial({
      map: createRepeatedFrameTexture(frame, textureScale, ROCK_TEXTURE_REPEAT_X, ROCK_TEXTURE_REPEAT_Y, ROCK_EDGE_FILL_COLOR)
    });
    this.rockMaterials.set(key, material);
    return material;
  }

  /** Retourne un billboard detoure pour les entites, avec profondeur conservee. */
  private getEntityBillboardMaterial(context: GameplayRenderContext, frame: TileFrame): THREE.SpriteMaterial {
    const textureScale = getTextureUpscale(context);
    const key = getFrameCacheKey(frame, textureScale, true);
    const cached = this.entityBillboardMaterials.get(key);
    if (cached) {
      return cached;
    }

    const material = new THREE.SpriteMaterial({
      map: createFrameTexture(frame, true, textureScale),
      transparent: true,
      alphaTest: 0.5
    });
    this.entityBillboardMaterials.set(key, material);
    return material;
  }

  /** Extrait une fois les pixels non noirs d'une frame d'explosion TO8. */
  private getExplosionVoxelPixels(frame: TileFrame): readonly ExplosionVoxelPixel[] {
    const key = getFrameCacheKey(frame, 1, false);
    const cached = this.explosionVoxelPixels.get(key);
    if (cached) {
      return cached;
    }

    const pixels = extractExplosionVoxelPixels(frame);
    this.explosionVoxelPixels.set(key, pixels);
    return pixels;
  }
}

/** Convertit une position grille en coordonnees monde centrees sur le viewport. */
function getWorldPosition(
  context: GameplayRenderContext,
  gridX: number,
  gridY: number
): { readonly x: number; readonly z: number } {
  const depthScale = getGroundDepthScale(CAMERA_FRAME_REFERENCE_PITCH_DEG);
  return {
    x: gridX - context.viewport.x - context.viewport.columns / 2 + 0.5,
    z: (gridY - context.viewport.y - context.viewport.rows / 2 + 0.5) * depthScale
  };
}

/** Retourne le pivot du zoom molette: position joueur meme pendant la mort, sinon centre de la scene. */
function getDioramaZoomPivotPosition(context: GameplayRenderContext): THREE.Vector3 {
  if (isVisibleGridPosition(context, context.state.player.gridX, context.state.player.gridY)) {
    const playerPosition = getWorldPosition(context, context.state.player.gridX, context.state.player.gridY);
    return new THREE.Vector3(playerPosition.x, 0, playerPosition.z);
  }

  return new THREE.Vector3(0, 0, 0);
}

/** Applique une rotation de roulement purement visuelle au rocher en mouvement. */
function applyRockRotation(mesh: THREE.Mesh, context: GameplayRenderContext, movement: FallingObjectRuntimeState | undefined): void {
  if (!movement) {
    mesh.rotation.set(0.35, 0.4, 0.15);
    return;
  }

  const progress = getMovementRenderProgress(movement.elapsed, movement.duration);
  const from = getWorldPosition(context, movement.fromX, movement.fromY);
  const to = getWorldPosition(context, movement.toX, movement.toY);
  const deltaX = to.x - from.x;
  const deltaZ = to.z - from.z;
  const distance = Math.hypot(deltaX, deltaZ);
  if (distance <= 0) {
    return;
  }

  const axis = new THREE.Vector3(deltaZ, 0, -deltaX).normalize();
  const rollAngle = (distance / ROCK_SPHERE_RADIUS) * progress;
  mesh.setRotationFromAxisAngle(axis, rollAngle);
}

/** Calcule une compensation qui garde les cellules proches du carre malgre l'inclinaison. */
function getGroundDepthScale(pitchDeg: number): number {
  return 1 / Math.max(0.55, Math.sin(degreesToRadians(pitchDeg)));
}

/** Retourne la profondeur monde d'une cellule, identique a l'espacement Z de la grille. */
function getCellDepthScale(): number {
  return getGroundDepthScale(CAMERA_FRAME_REFERENCE_PITCH_DEG);
}

/** Convertit un angle degre en radians. */
function degreesToRadians(degrees: number): number {
  return degrees * Math.PI / 180;
}

/** Retourne le facteur d'upscale texture entier courant. */
function getTextureUpscale(context: GameplayRenderContext): number {
  return Math.max(1, Math.floor(context.dioramaRenderOptions.textureUpscale));
}

/** Contraint le centre d'un frustum sans inverser la plage si la vue est plus grande que le contenu. */
function clampFrustumCenter(center: number, min: number, max: number, size: number): number {
  if (size >= max - min) {
    return (min + max) / 2;
  }

  return Math.max(min + size / 2, Math.min(max - size / 2, center));
}

/** Indique si une tuile runtime correspond a une frame d'explosion TO8. */
function isExplosionTileId(tileId: number): boolean {
  return tileId === RUNTIME_TILE.explosion1 || tileId === RUNTIME_TILE.explosion2 || tileId === RUNTIME_TILE.explosion3;
}

/** Retourne la phase visuelle courte de la tile d'explosion courante. */
function getExplosionTilePhase(tileId: number): number {
  if (tileId === RUNTIME_TILE.explosion2) {
    return 1;
  }
  if (tileId === RUNTIME_TILE.explosion3) {
    return 2;
  }
  return 0;
}

/** Extrait les pixels colores d'une frame atlas pour les materialiser en voxels. */
function extractExplosionVoxelPixels(frame: TileFrame): readonly ExplosionVoxelPixel[] {
  const canvas = document.createElement("canvas");
  canvas.width = frame.sourceRect.width;
  canvas.height = frame.sourceRect.height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Impossible de lire une frame d'explosion Diorama.");
  }

  context.imageSmoothingEnabled = false;
  context.drawImage(
    frame.source,
    frame.sourceRect.x,
    frame.sourceRect.y,
    frame.sourceRect.width,
    frame.sourceRect.height,
    0,
    0,
    canvas.width,
    canvas.height
  );

  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const pixels: ExplosionVoxelPixel[] = [];
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const offset = (y * canvas.width + x) * 4;
      const alpha = image.data[offset + 3];
      const red = image.data[offset];
      const green = image.data[offset + 1];
      const blue = image.data[offset + 2];
      if (alpha === 0 || (red === 0 && green === 0 && blue === 0)) {
        continue;
      }

      pixels.push({
        x: (x + 0.5) / canvas.width - 0.5,
        z: (y + 0.5) / canvas.height - 0.5,
        color: red << 16 | green << 8 | blue
      });
    }
  }

  return pixels;
}

/** Retourne une valeur stable 0..1 pour varier legerement les voxels sans bruit temporel. */
function deterministicUnit(gridX: number, gridY: number, localX: number, localZ: number): number {
  const seed = Math.sin((gridX * 12.9898 + gridY * 78.233 + localX * 37.719 + localZ * 19.173) * 43758.5453);
  return seed - Math.floor(seed);
}

/** Evite de dessiner la version statique d'un objet physique deja rendu en mouvement. */
function isPhysicalObjectMovementCell(context: GameplayRenderContext, gridX: number, gridY: number): boolean {
  return context.state.fallingObjects.some((object) => isFallingObjectMovementCell(object, gridX, gridY));
}

/** Verifie les deux cases logiques occupees pendant une chute, glissade ou poussee. */
function isFallingObjectMovementCell(object: FallingObjectRuntimeState, gridX: number, gridY: number): boolean {
  return (
    (object.fromX === gridX && object.fromY === gridY) ||
    (object.toX === gridX && object.toY === gridY)
  );
}

/** Verifie qu'une cellule existe dans le niveau rendu. */
function isInsideRenderedLevel(context: GameplayRenderContext, gridX: number, gridY: number): boolean {
  return gridX >= 0 && gridY >= 0 && gridX < context.state.level.width && gridY < context.state.level.height;
}

/** Verifie qu'une position grille, meme interpolee, reste proche du viewport visible. */
function isVisibleGridPosition(context: GameplayRenderContext, gridX: number, gridY: number): boolean {
  return (
    gridX >= context.viewport.x - 1 &&
    gridX < context.viewport.x + context.viewport.columns + 1 &&
    gridY >= context.viewport.y - 1 &&
    gridY < context.viewport.y + context.viewport.rows + 1
  );
}
