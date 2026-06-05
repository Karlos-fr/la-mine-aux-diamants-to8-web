#!/usr/bin/env node
import { deflateSync, inflateSync } from "node:zlib";
import { mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const SOURCE_PNG = "C:/Users/qjsf8838/Downloads/thomson-8-bit/thomson-8-bit.png";
const GENERATED_TS = "src/assets/generated/thomson-8-bit-font.ts";
const GENERATED_MJS = "tools/generated-thomson-8-bit-font.mjs";
const DOCS_DIR = "docs/extraction/fonts";
const DOCS_PNG = join(DOCS_DIR, "thomson-8-bit-specimen.png");
const GLYPH_WIDTH = 8;
const GLYPH_HEIGHT = 8;

const rows = [
  { x: 3, y: 17, text: "BASIC 512 V1.0" },
  { x: 3, y: 25, text: "(C) Microsoft 1986" },
  { x: 3, y: 35, text: "503135 bytes free" },
  { x: 3, y: 44, text: "OK" },
  { x: 3, y: 62, text: "ABCDEFGHIJKLMNOPQR" },
  { x: 3, y: 70, text: "STUVWXYZabcdefghij" },
  { x: 3, y: 80, text: "klmnopqrstuvwxyz" },
  { x: 3, y: 97, text: "!\"#$%&'()*+,-./012" },
  { x: 3, y: 106, text: "3456789:;<=>?@[\\]" },
  { x: 3, y: 115, text: "^_`{|}~ÀÂÇÈÉÊ" },
  { x: 3, y: 124, text: "àâçèéêùüû" }
];

main();

function main() {
  const image = decodePngRgb(readFileSync(SOURCE_PNG));
  const glyphs = {};
  for (const row of rows) {
    for (let index = 0; index < row.text.length; index += 1) {
      const char = row.text[index];
      if (char === " " || glyphs[char]) continue;
      glyphs[char] = extractGlyph(image, row.x + index * GLYPH_WIDTH, row.y);
    }
  }
  glyphs[" "] = Array.from({ length: GLYPH_HEIGHT }, () => "00000000");

  mkdirSync(resolve("src/assets/generated"), { recursive: true });
  mkdirSync(DOCS_DIR, { recursive: true });
  writeFileSync(GENERATED_TS, renderTypeScript(glyphs));
  writeFileSync(GENERATED_MJS, renderJavaScript(glyphs));
  writeFileSync(DOCS_PNG, readFileSync(SOURCE_PNG));

  if (existsSync("src/assets/fonts")) rmSync("src/assets/fonts", { recursive: true, force: true });
  console.log(`Generated ${Object.keys(glyphs).length} Thomson glyphs to ${GENERATED_TS}`);
}

function extractGlyph(image, originX, originY) {
  const rows = [];
  for (let y = 0; y < GLYPH_HEIGHT; y += 1) {
    let row = "";
    for (let x = 0; x < GLYPH_WIDTH; x += 1) {
      row += isInk(image, originX + x, originY + y) ? "1" : "0";
    }
    rows.push(row);
  }
  return normalizeGlyphRows(rows);
}

function normalizeGlyphRows(rows) {
  const inkRows = rows
    .map((row, index) => row.includes("1") ? index : -1)
    .filter((index) => index >= 0);
  if (inkRows.length === 0) return rows;

  const firstInkRow = Math.min(...inkRows);
  const lastInkRow = Math.max(...inkRows);
  const targetLastInkRow = GLYPH_HEIGHT - 2;
  const shift = targetLastInkRow - lastInkRow;
  if (shift === 0) return rows;

  const normalized = Array.from({ length: GLYPH_HEIGHT }, () => "0".repeat(GLYPH_WIDTH));
  for (let sourceY = firstInkRow; sourceY <= lastInkRow; sourceY += 1) {
    const targetY = sourceY + shift;
    if (targetY < 0 || targetY >= GLYPH_HEIGHT) continue;
    normalized[targetY] = rows[sourceY];
  }
  return normalized;
}

function isInk(image, x, y) {
  const offset = (y * image.width + x) * 3;
  const red = image.rgb[offset];
  const green = image.rgb[offset + 1];
  const blue = image.rgb[offset + 2];
  return blue > 120 && red < 90 && green < 140;
}

function decodePngRgb(bytes) {
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  let bitDepth = 0;
  const idat = [];
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === "IDAT") {
      idat.push(data);
    }
    offset += length + 12;
  }
  if (bitDepth !== 8 || colorType !== 2) throw new Error(`Unsupported PNG format: bitDepth=${bitDepth}, colorType=${colorType}`);

  const inflated = inflateSync(Buffer.concat(idat));
  const bytesPerPixel = 3;
  const rowBytes = width * bytesPerPixel;
  const rgb = Buffer.alloc(width * height * bytesPerPixel);
  let rawOffset = 0;
  let rgbOffset = 0;
  let previous = Buffer.alloc(rowBytes);
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[rawOffset++];
    const row = Buffer.alloc(rowBytes);
    for (let x = 0; x < rowBytes; x += 1) {
      const left = x >= bytesPerPixel ? row[x - bytesPerPixel] : 0;
      const up = previous[x];
      const upLeft = x >= bytesPerPixel ? previous[x - bytesPerPixel] : 0;
      let value = inflated[rawOffset++];
      if (filter === 1) value = (value + left) & 0xff;
      else if (filter === 2) value = (value + up) & 0xff;
      else if (filter === 3) value = (value + Math.floor((left + up) / 2)) & 0xff;
      else if (filter === 4) value = (value + paeth(left, up, upLeft)) & 0xff;
      else if (filter !== 0) throw new Error(`Unsupported PNG filter ${filter}`);
      row[x] = value;
    }
    row.copy(rgb, rgbOffset);
    rgbOffset += rowBytes;
    previous = row;
  }
  return { width, height, rgb };
}

function paeth(left, up, upLeft) {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upLeftDistance = Math.abs(estimate - upLeft);
  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) return left;
  if (upDistance <= upLeftDistance) return up;
  return upLeft;
}

function renderTypeScript(glyphs) {
  const sorted = Object.fromEntries(Object.entries(glyphs).sort(([a], [b]) => a.localeCompare(b)));
  return `// Generated by tools/generate-thomson-font.mjs from Patrick H. Lauke's Thomson 8-bit specimen.\n` +
    `// Source: https://www.splintered.co.uk/experiments/815\n` +
    `// License: Creative Commons Attribution 3.0.\n` +
    `export const THOMSON_8_BIT_FONT = ${JSON.stringify({ width: GLYPH_WIDTH, height: GLYPH_HEIGHT, glyphs: sorted }, null, 2)} as const;\n` +
    `export type Thomson8BitFont = typeof THOMSON_8_BIT_FONT;\n`;
}

function renderJavaScript(glyphs) {
  const sorted = Object.fromEntries(Object.entries(glyphs).sort(([a], [b]) => a.localeCompare(b)));
  return `// Generated by tools/generate-thomson-font.mjs from Patrick H. Lauke's Thomson 8-bit specimen.\n` +
    `// Source: https://www.splintered.co.uk/experiments/815\n` +
    `// License: Creative Commons Attribution 3.0.\n` +
    `export const THOMSON_8_BIT_FONT = ${JSON.stringify({ width: GLYPH_WIDTH, height: GLYPH_HEIGHT, glyphs: sorted }, null, 2)};\n`;
}
