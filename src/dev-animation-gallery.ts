import { mineSpriteMetadata } from "./assets/generated/mine-sprites";
import { VIEWER_ASSET_URLS } from "./assets/runtime-assets";

/**
 * Viewer developpeur des animations extraites.
 *
 * Cet outil se monte avec `?mode=gallery` et permet de verifier rapidement les
 * atlas sprites et les sequences de frames declarees dans les metadata.
 */

/** Alias local des atlas affichables par groupe de sprites. */
const ATLAS_URLS: Record<string, string> = VIEWER_ASSET_URLS;

/** Groupe de sprites issu des metadata generees. */
type SpriteGroup = (typeof mineSpriteMetadata.groups)[number];

/** Frame de sprite issue d'un groupe metadata. */
type SpriteFrame = SpriteGroup["frames"][number];

/** Animation declaree dans un groupe metadata. */
type SpriteAnimation = NonNullable<SpriteGroup["animations"]>[number];

/** Animation prete a etre rendue sous forme de carte dans le viewer. */
type GalleryAnimation = {
  /** Groupe metadata auquel appartient l'animation. */
  group: SpriteGroup;

  /** Definition metadata de l'animation. */
  animation: SpriteAnimation;

  /** Frames resolues dans l'ordre de lecture. */
  frames: SpriteFrame[];

  /** URL de l'atlas contenant les frames. */
  atlasUrl: string;
};

/** Etat runtime d'une carte animee du viewer. */
type Player = {
  /** Carte DOM de l'animation. */
  card: HTMLElement;

  /** Canvas de preview 16x16. */
  canvas: HTMLCanvasElement;

  /** Contexte 2D du canvas de preview. */
  ctx: CanvasRenderingContext2D;

  /** Image atlas chargee. */
  image: HTMLImageElement;

  /** Frames jouees par la preview. */
  frames: SpriteFrame[];

  /** Index de frame courant. */
  frameIndex: number;

  /** Timestamp de reference pour la cadence d'animation. */
  elapsedMs: number;

  /** Duree d'une frame en millisecondes. */
  frameMs: number;

  /** Indique si la preview animee tourne. */
  playing: boolean;
};

/** Monte le viewer dans l'element racine fourni. */
export function mountDevAnimationGallery(root: HTMLElement): void {
  root.innerHTML = "";
  root.className = "dev-gallery-shell";

  const page = document.createElement("section");
  page.className = "dev-gallery-page";

  const header = document.createElement("header");
  header.className = "dev-gallery-header";
  header.innerHTML = `
    <div>
      <p class="dev-gallery-eyebrow">La Mine aux Diamants</p>
      <h1 class="dev-gallery-title">Animations decodees</h1>
      <p class="dev-gallery-help">Viewer developpeur: ouvrir avec <code>?mode=gallery</code>.</p>
    </div>
  `;

  const gallery = document.createElement("div");
  gallery.className = "dev-gallery-grid";

  page.append(header, gallery);
  root.append(page);

  const players = createCards(gallery);

  /** Boucle d'animation du viewer synchronisee sur `requestAnimationFrame`. */
  const tick = (time: number) => {
    animatePlayers(players, time);
    window.requestAnimationFrame(tick);
  };
  window.requestAnimationFrame(tick);
}

/** Cree toutes les cartes du viewer et retourne leurs etats d'animation. */
function createCards(container: HTMLElement): Player[] {
  const animations = collectAnimations();
  return animations.map((item) => {
    const card = document.createElement("article");
    card.className = "dev-gallery-card";

    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 16;
    canvas.className = "dev-gallery-sprite-preview";

    const title = document.createElement("div");
    title.className = "dev-gallery-card-title";
    title.innerHTML = `
      <span>${label(item.group.id)} / ${label(item.animation.id)}</span>
      <span class="dev-gallery-status-pill">${item.animation.status}</span>
    `;

    const strip = document.createElement("div");
    strip.className = "dev-gallery-frame-strip";
    item.frames.forEach((frame) => {
      const chip = document.createElement("span");
      chip.textContent = `${frame.hexId} ${frame.name}`;
      strip.append(chip);
    });

    const evidence = document.createElement("p");
    evidence.className = "dev-gallery-evidence";
    evidence.textContent = item.animation.evidence?.[0] ?? item.group.evidence?.[0] ?? "";

    const controls = document.createElement("div");
    controls.className = "dev-gallery-card-controls";
    const playButton = document.createElement("button");
    playButton.type = "button";
    playButton.textContent = "Pause";
    const speed = document.createElement("input");
    speed.type = "range";
    speed.min = "80";
    speed.max = "600";
    speed.step = "20";
    speed.value = item.group.id === "explosion" ? "240" : "180";
    controls.append(playButton, speed);

    const atlas = document.createElement("img");
    atlas.className = "dev-gallery-atlas-preview";
    atlas.src = item.atlasUrl;
    atlas.alt = `${item.group.id} atlas`;

    card.append(title, canvas, controls, strip, evidence, atlas);
    container.append(card);

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D unavailable.");
    ctx.imageSmoothingEnabled = false;

    const image = new Image();
    image.src = item.atlasUrl;
    image.addEventListener("load", () => drawFrame(ctx, image, item.frames[0]));

    const player: Player = {
      card,
      canvas,
      ctx,
      image,
      frames: item.frames,
      frameIndex: 0,
      elapsedMs: 0,
      frameMs: Number(speed.value),
      playing: true
    };

    playButton.addEventListener("click", () => {
      player.playing = !player.playing;
      playButton.textContent = player.playing ? "Pause" : "Lecture";
    });
    speed.addEventListener("input", () => {
      player.frameMs = Number(speed.value);
    });

    return player;
  });
}

/** Collecte les animations disposant a la fois de metadata et d'un atlas visible. */
function collectAnimations(): GalleryAnimation[] {
  const cards: GalleryAnimation[] = [];
  for (const group of mineSpriteMetadata.groups) {
    const atlasUrl = ATLAS_URLS[group.id];
    if (!atlasUrl || !group.animations) continue;
    for (const animation of group.animations) {
      const frames = framesForAnimation(group, animation);
      if (frames.length === 0) continue;
      cards.push({ group, animation, frames, atlasUrl });
    }
  }
  return cards;
}

/** Resout la liste de frames d'une animation depuis ses tile ids ou son frame count. */
function framesForAnimation(group: SpriteGroup, animation: SpriteAnimation): SpriteFrame[] {
  if ("frameCount" in animation && typeof animation.frameCount === "number") {
    return group.frames.slice(0, animation.frameCount);
  }
  return animation.frameTileIds
    .map((tileId) => group.frames.find((frame) => frame.tileId === tileId))
    .filter((frame): frame is SpriteFrame => Boolean(frame));
}

/** Avance et redessine toutes les previews animees. */
function animatePlayers(players: Player[], time: number): void {
  for (const player of players) {
    if (!player.image.complete || player.frames.length === 0) continue;
    if (!player.playing || player.frames.length === 1) {
      drawFrame(player.ctx, player.image, player.frames[player.frameIndex]);
      continue;
    }
    if (player.elapsedMs === 0) player.elapsedMs = time;
    const delta = time - player.elapsedMs;
    if (delta >= player.frameMs) {
      player.elapsedMs = time;
      player.frameIndex = (player.frameIndex + 1) % player.frames.length;
      drawFrame(player.ctx, player.image, player.frames[player.frameIndex]);
    }
  }
}

/** Dessine une frame metadata dans le canvas 16x16 de preview. */
function drawFrame(ctx: CanvasRenderingContext2D, image: HTMLImageElement, frame: SpriteFrame): void {
  ctx.clearRect(0, 0, 16, 16);
  ctx.drawImage(image, frame.atlasX, frame.atlasY, frame.width, frame.height, 0, 0, 16, 16);
}

/** Transforme un identifiant technique en libelle lisible. */
function label(value: string): string {
  return value.replace(/[-_]/g, " ");
}
