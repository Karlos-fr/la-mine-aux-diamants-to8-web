import { mineSpriteMetadata } from "./assets/generated/mine-sprites";
import { VIEWER_ASSET_URLS } from "./assets/runtime-assets";

const ATLAS_URLS: Record<string, string> = VIEWER_ASSET_URLS;

type SpriteGroup = (typeof mineSpriteMetadata.groups)[number];
type SpriteFrame = SpriteGroup["frames"][number];
type SpriteAnimation = NonNullable<SpriteGroup["animations"]>[number];

type GalleryAnimation = {
  group: SpriteGroup;
  animation: SpriteAnimation;
  frames: SpriteFrame[];
  atlasUrl: string;
};

type Player = {
  card: HTMLElement;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  image: HTMLImageElement;
  frames: SpriteFrame[];
  frameIndex: number;
  elapsedMs: number;
  frameMs: number;
  playing: boolean;
};

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

  const tick = (time: number) => {
    animatePlayers(players, time);
    window.requestAnimationFrame(tick);
  };
  window.requestAnimationFrame(tick);
}

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

function framesForAnimation(group: SpriteGroup, animation: SpriteAnimation): SpriteFrame[] {
  if ("frameCount" in animation && typeof animation.frameCount === "number") {
    return group.frames.slice(0, animation.frameCount);
  }
  return animation.frameTileIds
    .map((tileId) => group.frames.find((frame) => frame.tileId === tileId))
    .filter((frame): frame is SpriteFrame => Boolean(frame));
}

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

function drawFrame(ctx: CanvasRenderingContext2D, image: HTMLImageElement, frame: SpriteFrame): void {
  ctx.clearRect(0, 0, 16, 16);
  ctx.drawImage(image, frame.atlasX, frame.atlasY, frame.width, frame.height, 0, 0, 16, 16);
}

function label(value: string): string {
  return value.replace(/[-_]/g, " ");
}
