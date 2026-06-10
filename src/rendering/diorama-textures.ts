/**
 * Role: Prepare les textures canvas pixel-art utilisees par le rendu Diorama.
 * Scope: Convertit des frames atlas en `CanvasTexture`, avec detourage ou repetition.
 * ISO: Ces operations ne lisent que les assets de rendu et ne modifient pas le gameplay.
 * Notes: Les textures restent sans mipmaps et en nearest-neighbor pour preserver le style TO8.
 */

import * as THREE from "three";
import type { TileFrame } from "../engine/render-types";

/** Construit une texture pixel-perfect depuis une frame atlas ou custom. */
export function createFrameTexture(frame: TileFrame, transparentEdgeBlack = false, textureScale = 1): THREE.CanvasTexture {
  const scale = Math.max(1, Math.floor(textureScale));
  const canvas = document.createElement("canvas");
  canvas.width = frame.sourceRect.width * scale;
  canvas.height = frame.sourceRect.height * scale;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Impossible de preparer une texture diorama.");
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
  if (transparentEdgeBlack) {
    makeEdgeBlackTransparent(context, canvas.width, canvas.height);
  }
  return createNearestCanvasTexture(canvas);
}

/** Construit une texture repetee pour plaquer une tile TO8 sur une primitive arrondie. */
export function createRepeatedFrameTexture(
  frame: TileFrame,
  textureScale: number,
  repeatX: number,
  repeatY: number,
  edgeFillColor: number
): THREE.CanvasTexture {
  const scale = Math.max(1, Math.floor(textureScale));
  const tileWidth = frame.sourceRect.width * scale;
  const tileHeight = frame.sourceRect.height * scale;
  const tileCanvas = document.createElement("canvas");
  tileCanvas.width = tileWidth;
  tileCanvas.height = tileHeight;
  const tileContext = tileCanvas.getContext("2d");
  if (!tileContext) {
    throw new Error("Impossible de preparer une texture repetee diorama.");
  }

  tileContext.imageSmoothingEnabled = false;
  tileContext.drawImage(
    frame.source,
    frame.sourceRect.x,
    frame.sourceRect.y,
    frame.sourceRect.width,
    frame.sourceRect.height,
    0,
    0,
    tileWidth,
    tileHeight
  );
  replaceEdgeBlack(tileContext, tileWidth, tileHeight, edgeFillColor);

  const canvas = document.createElement("canvas");
  canvas.width = tileWidth * Math.max(1, Math.floor(repeatX));
  canvas.height = tileHeight * Math.max(1, Math.floor(repeatY));
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Impossible de composer une texture repetee diorama.");
  }

  context.imageSmoothingEnabled = false;
  for (let y = 0; y < canvas.height; y += tileHeight) {
    for (let x = 0; x < canvas.width; x += tileWidth) {
      context.drawImage(tileCanvas, x, y);
    }
  }

  return createNearestCanvasTexture(canvas);
}

/** Retourne une cle stable pour cacher les materiaux issus d'une frame. */
export function getFrameCacheKey(frame: TileFrame, textureScale: number, transparentEdgeBlack: boolean): string {
  const source = frame.source instanceof HTMLImageElement
    ? frame.source.currentSrc || frame.source.src
    : "canvas-source";
  return [
    source,
    frame.sourceRect.x,
    frame.sourceRect.y,
    frame.sourceRect.width,
    frame.sourceRect.height,
    textureScale,
    transparentEdgeBlack ? "alpha-edge" : "opaque"
  ].join(":");
}

/** Cree une texture Three.js sans filtrage ni mipmap. */
function createNearestCanvasTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

/** Detoure uniquement le noir connecte aux bords pour conserver les details noirs internes. */
function makeEdgeBlackTransparent(context: CanvasRenderingContext2D, width: number, height: number): void {
  const image = context.getImageData(0, 0, width, height);
  const data = image.data;
  const visited = new Uint8Array(width * height);
  const stack: number[] = [];

  for (let x = 0; x < width; x += 1) {
    pushBlackPixel(stack, visited, data, width, x, 0);
    pushBlackPixel(stack, visited, data, width, x, height - 1);
  }
  for (let y = 1; y < height - 1; y += 1) {
    pushBlackPixel(stack, visited, data, width, 0, y);
    pushBlackPixel(stack, visited, data, width, width - 1, y);
  }

  while (stack.length > 0) {
    const index = stack.pop();
    if (index === undefined) {
      continue;
    }

    const pixelOffset = index * 4;
    data[pixelOffset + 3] = 0;
    const x = index % width;
    const y = Math.floor(index / width);
    pushBlackPixel(stack, visited, data, width, x + 1, y);
    pushBlackPixel(stack, visited, data, width, x - 1, y);
    pushBlackPixel(stack, visited, data, width, x, y + 1);
    pushBlackPixel(stack, visited, data, width, x, y - 1);
  }

  context.putImageData(image, 0, 0);
}

/** Remplace le noir connecte aux bords par une couleur de support, sans toucher aux details internes. */
function replaceEdgeBlack(context: CanvasRenderingContext2D, width: number, height: number, fillColor: number): void {
  const image = context.getImageData(0, 0, width, height);
  const data = image.data;
  const visited = new Uint8Array(width * height);
  const stack: number[] = [];
  const color = hexColorToRgb(fillColor);

  for (let x = 0; x < width; x += 1) {
    pushBlackPixel(stack, visited, data, width, x, 0);
    pushBlackPixel(stack, visited, data, width, x, height - 1);
  }
  for (let y = 1; y < height - 1; y += 1) {
    pushBlackPixel(stack, visited, data, width, 0, y);
    pushBlackPixel(stack, visited, data, width, width - 1, y);
  }

  while (stack.length > 0) {
    const index = stack.pop();
    if (index === undefined) {
      continue;
    }

    const pixelOffset = index * 4;
    data[pixelOffset] = color.r;
    data[pixelOffset + 1] = color.g;
    data[pixelOffset + 2] = color.b;
    data[pixelOffset + 3] = 255;
    const x = index % width;
    const y = Math.floor(index / width);
    pushBlackPixel(stack, visited, data, width, x + 1, y);
    pushBlackPixel(stack, visited, data, width, x - 1, y);
    pushBlackPixel(stack, visited, data, width, x, y + 1);
    pushBlackPixel(stack, visited, data, width, x, y - 1);
  }

  context.putImageData(image, 0, 0);
}

/** Convertit une couleur hexadecimale Three.js en composantes canvas. */
function hexColorToRgb(color: number): { readonly r: number; readonly g: number; readonly b: number } {
  return {
    r: (color >> 16) & 0xff,
    g: (color >> 8) & 0xff,
    b: color & 0xff
  };
}

/** Empile un pixel noir non visite si ses coordonnees restent dans l'image. */
function pushBlackPixel(
  stack: number[],
  visited: Uint8Array,
  data: Uint8ClampedArray,
  width: number,
  x: number,
  y: number
): void {
  const height = visited.length / width;
  if (x < 0 || y < 0 || x >= width || y >= height) {
    return;
  }

  const index = y * width + x;
  if (visited[index] === 1) {
    return;
  }
  visited[index] = 1;

  const pixelOffset = index * 4;
  if (data[pixelOffset] === 0 && data[pixelOffset + 1] === 0 && data[pixelOffset + 2] === 0) {
    stack.push(index);
  }
}
