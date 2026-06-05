import { mineSpriteMetadata } from "./assets/generated/mine-sprites";
import { createGameApp } from "./engine/game-app";
import { StartupInfogramScene } from "./screens/startup-screens";

const ATLAS_URLS: Record<string, string> = {
  player: new URL("../docs/extraction/sprites/player-atlas.png", import.meta.url).href,
  diamond: new URL("../docs/extraction/sprites/diamond-atlas.png", import.meta.url).href,
  rocks: new URL("../docs/extraction/sprites/rocks-atlas.png", import.meta.url).href,
  explosion: new URL("../docs/extraction/sprites/explosion-atlas.png", import.meta.url).href,
  objects: new URL("../docs/extraction/sprites/objects-atlas.png", import.meta.url).href,
  monster: new URL("../docs/extraction/sprites/monster-atlas.png", import.meta.url).href
};

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

export function mountAnimationGallery(root: HTMLElement): void {
  root.innerHTML = "";
  root.className = "page-shell";

  const page = document.createElement("section");
  page.className = "animation-page";

  const header = document.createElement("header");
  header.className = "animation-header";
  header.innerHTML = `
    <div>
      <p class="eyebrow">La Mine aux Diamants</p>
      <h1>Animations decodees</h1>
    </div>
    <div class="view-actions">
      <button class="mode-button mode-button-active" type="button" data-view="animations">Animations</button>
      <button class="mode-button" type="button" data-view="game">Jeu</button>
    </div>
  `;

  const gallery = document.createElement("div");
  gallery.className = "animation-grid";

  const gameMount = document.createElement("div");
  gameMount.className = "game-mount hidden";
  gameMount.innerHTML = `<canvas id="game-screen" width="320" height="200" tabindex="0" aria-label="Ecran du jeu"></canvas>`;

  page.append(header, gallery, gameMount);
  root.append(page);

  const players = createCards(gallery);
  let gameStarted = false;
  let stopGame: (() => void) | null = null;

  header.querySelectorAll<HTMLButtonElement>(".mode-button").forEach((button) => {
    button.addEventListener("click", () => {
      const view = button.dataset.view;
      header.querySelectorAll(".mode-button").forEach((candidate) => {
        candidate.classList.toggle("mode-button-active", candidate === button);
      });
      gallery.classList.toggle("hidden", view !== "animations");
      gameMount.classList.toggle("hidden", view !== "game");
      if (view === "game" && !gameStarted) {
        stopGame = mountGame(gameMount);
        gameStarted = true;
      }
    });
  });

  const tick = (time: number) => {
    animatePlayers(players, time);
    window.requestAnimationFrame(tick);
  };
  window.requestAnimationFrame(tick);

  window.addEventListener("beforeunload", () => stopGame?.(), { once: true });
}

function createCards(container: HTMLElement): Player[] {
  const animations = collectAnimations();
  return animations.map((item) => {
    const card = document.createElement("article");
    card.className = "animation-card";

    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 16;
    canvas.className = "sprite-preview";

    const title = document.createElement("div");
    title.className = "card-title";
    title.innerHTML = `
      <span>${label(item.group.id)} / ${label(item.animation.id)}</span>
      <span class="status-pill">${item.animation.status}</span>
    `;

    const strip = document.createElement("div");
    strip.className = "frame-strip";
    item.frames.forEach((frame) => {
      const chip = document.createElement("span");
      chip.textContent = `${frame.hexId} ${frame.name}`;
      strip.append(chip);
    });

    const evidence = document.createElement("p");
    evidence.className = "evidence";
    evidence.textContent = item.animation.evidence?.[0] ?? item.group.evidence?.[0] ?? "";

    const controls = document.createElement("div");
    controls.className = "card-controls";
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
    atlas.className = "atlas-preview";
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

function mountGame(gameMount: HTMLElement): () => void {
  const canvas = gameMount.querySelector<HTMLCanvasElement>("#game-screen");
  if (!canvas) throw new Error("Canvas #game-screen introuvable.");
  const app = createGameApp({
    canvas,
    initialScene: () => new StartupInfogramScene()
  });
  app.start();
  canvas.focus();
  return () => app.stop();
}

function label(value: string): string {
  return value.replace(/[-_]/g, " ");
}
