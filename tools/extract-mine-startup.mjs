#!/usr/bin/env node
import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { THOMSON_8_BIT_FONT } from "./generated-thomson-8-bit-font.mjs";

const SCREEN_WIDTH = 320;
const SCREEN_HEIGHT = 200;
const INFOGRAM_PUT = { column: 11, row: 3, x: 88, y: 24 };
const INFOGRAM_WORDMARK = { x: 0, y: 48, width: 136, height: 24 };
const PRESENTE_LAYER = { x: centeredTextX("PRESENTE", 1), y: 105, text: "PRESENTE" };
const TITLE_LINE_1 = { x: centeredTextX("LA MINE", 2), y: 132, text: "LA MINE" };
const TITLE_LINE_2 = { x: centeredTextX("AUX DIAMANTS", 2), y: 158, text: "AUX DIAMANTS" };
const STARTUP_ORANGE = [0xd8, 0x48, 0x00, 255];
const STARTUP_TITLE_YELLOW = [0xff, 0xc8, 0x00, 255];

const TO8_INTENSITIES = [
  0, 100, 127, 147, 163, 179, 191, 203,
  215, 223, 231, 239, 243, 247, 251, 255
];

const PALETTE_RGB4 = [
  [0x0, 0x0, 0x0],
  [0xf, 0x0, 0x0],
  [0x0, 0xf, 0x0],
  [0xf, 0xf, 0x0],
  [0x0, 0x0, 0xf],
  [0xf, 0x0, 0xf],
  [0xf, 0xc, 0x0],
  [0xf, 0xf, 0xf],
  [0x7, 0x7, 0x7],
  [0xa, 0x3, 0x3],
  [0x3, 0xa, 0x3],
  [0xa, 0xa, 0x3],
  [0x3, 0x3, 0xa],
  [0xa, 0x3, 0xa],
  [0x7, 0xe, 0xe],
  [0xb, 0x3, 0x0]
];

const PALETTE = PALETTE_RGB4.map(([red, green, blue]) => [
  TO8_INTENSITIES[red],
  TO8_INTENSITIES[green],
  TO8_INTENSITIES[blue],
  255
]);

function centeredTextX(text, scale) {
  return Math.floor((SCREEN_WIDTH - text.length * 8 * scale) / 2);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const rootDir = resolve(".");
  const infogramPath = firstExisting([
    args.infogramPath,
    join(rootDir, "extraction", "sources", "disk", "infogram_map.bin")
  ]);
  const outDir = resolve(args.outDir ?? join(rootDir, "docs", "extraction", "startup"));
  const generatedDir = resolve(args.generatedDir ?? join(rootDir, "src", "assets", "generated"));

  mkdirSync(outDir, { recursive: true });
  mkdirSync(generatedDir, { recursive: true });

  const infogramMap = decodeLoadpMap(readFileSync(infogramPath));
  const logoRgba = renderLoadpMapRgba(infogramMap, startupLogoPaletteColor);
  writeFileSync(join(outDir, "startup-01-infogrames-logo.png"), encodePng(infogramMap.width, infogramMap.height, logoRgba));

  const screen = Buffer.alloc(SCREEN_WIDTH * SCREEN_HEIGHT * 4);
  fill(screen, PALETTE[0]);
  blit(screen, SCREEN_WIDTH, logoRgba, infogramMap.width, infogramMap.height, INFOGRAM_PUT.x, INFOGRAM_PUT.y);
  drawTo8Text(screen, PRESENTE_LAYER.text, PRESENTE_LAYER.x, PRESENTE_LAYER.y, PALETTE[7], PALETTE[0], 1);
  drawTo8Text(screen, TITLE_LINE_1.text, TITLE_LINE_1.x, TITLE_LINE_1.y, STARTUP_TITLE_YELLOW, PALETTE[0], 2);
  drawTo8Text(screen, TITLE_LINE_2.text, TITLE_LINE_2.x, TITLE_LINE_2.y, STARTUP_TITLE_YELLOW, PALETTE[0], 2);

  writeFileSync(join(outDir, "startup-01-infogrames-presents.png"), encodePng(SCREEN_WIDTH, SCREEN_HEIGHT, screen));

  const metadata = {
    generatedBy: "tools/extract-mine-startup.mjs",
    screens: [
      {
        id: "startup-01-infogrames-presents",
        status: "confirmed",
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
        path: "startup/startup-01-infogrames-presents.png",
        rgbaSha256: sha256(screen),
        source: {
          mapFile: "INFOGRAM.MAP",
          mapPath: infogramPath,
          bootRoutine: "web/src/generated/game-entry.ts:showBootSplash",
          bootEvidence: [
            "ctx.basic.loadp(INFOGRAM.MAP, T%(1000))",
            "ctx.basic.put(11, 3, T%(1000)) -> x=88 y=24",
            "ctx.firmware.color(7, 0); locate(15, 13); print(PRESENTE)",
            "BASIC launcher contains palette word &HD6FF before loading LMINE0",
            "video oracle confirms the INFOGRAMES wordmark/underlines use the orange palette while the armadillo remains light"
          ]
        },
        layers: [
          { id: "infogrames-logo", x: INFOGRAM_PUT.x, y: INFOGRAM_PUT.y, width: infogramMap.width, height: infogramMap.height },
          { id: "presente-text", x: PRESENTE_LAYER.x, y: PRESENTE_LAYER.y, text: "PRESENTE", paletteIndex: 7 },
          { id: "title-line-1", x: TITLE_LINE_1.x, y: TITLE_LINE_1.y, text: TITLE_LINE_1.text, paletteIndex: 6 },
          { id: "title-line-2", x: TITLE_LINE_2.x, y: TITLE_LINE_2.y, text: TITLE_LINE_2.text, paletteIndex: 6 }
        ]
      }
    ],
    assets: [
      {
        id: "infogrames-logo-map",
        status: "confirmed",
        sourceFile: "INFOGRAM.MAP",
        sourcePath: infogramPath,
        path: "startup/startup-01-infogrames-logo.png",
        width: infogramMap.width,
        height: infogramMap.height,
        mode: infogramMap.mode,
        columns: infogramMap.columns,
        loadAddress: `0x${hex(infogramMap.loadAddress, 4)}`,
        declaredDataLength: infogramMap.declaredDataLength,
        rgbaSha256: sha256(logoRgba)
      }
    ]
  };

  writeFileSync(join(outDir, "..", "mine-startup-metadata.json"), `${JSON.stringify(metadata, null, 2)}\n`);
  writeFileSync(join(outDir, "..", "mine-startup-summary.md"), renderSummary(metadata));
  writeFileSync(join(generatedDir, "mine-startup.ts"), renderTypeScript(metadata));

  console.log(`Extracted startup screen assets to ${outDir}`);
}

function decodeLoadpMap(bytes) {
  if (bytes.length < 10) throw new Error("LOADP MAP file is too short");
  if (bytes[0] !== 0x00) throw new Error("Unsupported LOADP block type");
  const declaredDataLength = read16(bytes, 1);
  const loadAddress = read16(bytes, 3);
  const actualDataLength = bytes.length - 10;
  if (declaredDataLength !== actualDataLength) {
    throw new Error(`Declared LOADP data length ${declaredDataLength} does not match ${actualDataLength}`);
  }
  const endMarkerOffset = 5 + declaredDataLength;
  const endMarker = bytes.subarray(endMarkerOffset, endMarkerOffset + 5);
  if (endMarker[0] !== 0xff || endMarker[1] !== 0 || endMarker[2] !== 0 || endMarker[3] !== 0 || endMarker[4] !== 0) {
    throw new Error("Unsupported LOADP end marker");
  }
  const data = bytes.subarray(5, endMarkerOffset);
  const mapModeByte = data[0];
  const columnCountByte = data[1];
  const lineCountByte = data[2];
  if (mapModeByte !== 0x00) throw new Error(`Unsupported startup MAP mode 0x${hex(mapModeByte, 2)}`);
  const columns = columnCountByte + 1;
  const height = 8 * (lineCountByte + 1);
  const width = 8 * columns;
  const planeLength = columns * height;
  const forme = new Uint8Array(planeLength);
  const couleur = new Uint8Array(planeLength);
  const state = { plane: forme, index: 0, endCount: 0 };
  let offset = 3;
  while (offset + 1 < data.length && state.endCount < 2) {
    const byte1 = data[offset++];
    const byte2 = data[offset++];
    if (byte1 === 0 && byte2 === 0) {
      state.endCount += 1;
      state.plane = couleur;
      state.index = 0;
      continue;
    }
    if (byte1 === 0) {
      for (let count = byte2; count > 0; count -= 1) writeMapByte(state, data[offset++], columns);
      continue;
    }
    for (let count = byte1; count > 0; count -= 1) writeMapByte(state, byte2, columns);
  }
  if (state.endCount !== 2) throw new Error("Missing MAP stream terminators");
  return {
    mode: "40col",
    width,
    height,
    columns,
    forme,
    couleur,
    loadAddress,
    declaredDataLength
  };
}

function writeMapByte(state, value, columns) {
  if (state.index < 0 || state.index >= state.plane.length) throw new Error("Decoded MAP byte exceeds plane length");
  state.plane[state.index] = value;
  state.index += columns;
  if (state.index >= state.plane.length) state.index -= state.plane.length - 1;
}

function renderLoadpMapRgba(map, paletteColor = (paletteIndex) => PALETTE[paletteIndex]) {
  const rgba = Buffer.alloc(map.width * map.height * 4);
  let offset = 0;
  for (let y = 0; y < map.height; y += 1) {
    for (let blockX = 0; blockX < map.columns; blockX += 1) {
      const shapeByte = map.forme[offset];
      const colorByte = map.couleur[offset];
      offset += 1;
      const [foreground, background] = colorIndexesFromAttribute(colorByte);
      for (let bit = 0; bit < 8; bit += 1) {
        const x = blockX * 8 + bit;
        const paletteIndex = (shapeByte & (0x80 >> bit)) !== 0 ? foreground : background;
        const color = paletteColor(paletteIndex, x, y);
        writePixel(rgba, map.width, x, y, color);
      }
    }
  }
  return rgba;
}

function startupLogoPaletteColor(paletteIndex, x, y) {
  if (paletteIndex === 6 && x === 72 && (y === 14 || y === 15)) {
    return PALETTE[4];
  }
  if (paletteIndex === 7 && y === 42 && x >= 4 && x < 136) {
    return STARTUP_ORANGE;
  }
  if (paletteIndex === 7 && y >= 62 && y < 70 && x >= 4 && x < 136) {
    return STARTUP_ORANGE;
  }
  if (
    paletteIndex === 7 &&
    x >= INFOGRAM_WORDMARK.x &&
    x < INFOGRAM_WORDMARK.x + INFOGRAM_WORDMARK.width &&
    y >= INFOGRAM_WORDMARK.y &&
    y < INFOGRAM_WORDMARK.y + INFOGRAM_WORDMARK.height
  ) {
    return STARTUP_ORANGE;
  }
  return PALETTE[paletteIndex];
}

function colorIndexesFromAttribute(attribute) {
  const background = ((attribute & 0x07) | ((~attribute & 0x80) >> 4)) & 0x0f;
  const foreground = (((attribute >> 3) & 0x07) | ((~attribute & 0x40) >> 3)) & 0x0f;
  return [foreground, background];
}

function drawTo8Text(rgba, text, x, y, foreground, background, scale = 1) {
  for (let index = 0; index < text.length; index += 1) {
    drawTo8Glyph(rgba, x + index * 8 * scale, y, text[index], foreground, background, scale);
  }
}

function drawTo8Glyph(rgba, originX, originY, char, foreground, background, scale = 1) {
  for (let y = 0; y < 8 * scale; y += 1) {
    for (let x = 0; x < 8 * scale; x += 1) writePixel(rgba, SCREEN_WIDTH, originX + x, originY + y, background);
  }
  if (char === " ") return;
  const glyph = THOMSON_8_BIT_FONT.glyphs[char] ?? THOMSON_8_BIT_FONT.glyphs[char.toUpperCase()] ?? THOMSON_8_BIT_FONT.glyphs["?"];
  for (let y = 0; y < glyph.length; y += 1) {
    for (let x = 0; x < glyph[y].length; x += 1) {
      if (glyph[y][x] !== "1") continue;
      for (let yy = 0; yy < scale; yy += 1) {
        for (let xx = 0; xx < scale; xx += 1) {
          writePixel(rgba, SCREEN_WIDTH, originX + x * scale + xx, originY + y * scale + yy, foreground);
        }
      }
    }
  }
}

function writePixel(rgba, width, x, y, color) {
  if (x < 0 || y < 0 || x >= width || y >= Math.floor(rgba.length / (width * 4))) return;
  const offset = (y * width + x) * 4;
  rgba[offset] = color[0];
  rgba[offset + 1] = color[1];
  rgba[offset + 2] = color[2];
  rgba[offset + 3] = color[3];
}

function fill(rgba, color) {
  for (let offset = 0; offset < rgba.length; offset += 4) {
    rgba[offset] = color[0];
    rgba[offset + 1] = color[1];
    rgba[offset + 2] = color[2];
    rgba[offset + 3] = color[3];
  }
}

function blit(target, targetWidth, source, sourceWidth, sourceHeight, targetX, targetY) {
  for (let y = 0; y < sourceHeight; y += 1) {
    for (let x = 0; x < sourceWidth; x += 1) {
      const sourceOffset = (y * sourceWidth + x) * 4;
      const targetOffset = ((targetY + y) * targetWidth + targetX + x) * 4;
      source.copy(target, targetOffset, sourceOffset, sourceOffset + 4);
    }
  }
}

function scaleRgba(width, height, rgba, scale) {
  const scaled = Buffer.alloc(width * scale * height * scale * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceOffset = (y * width + x) * 4;
      for (let sy = 0; sy < scale; sy += 1) {
        for (let sx = 0; sx < scale; sx += 1) {
          const targetOffset = ((y * scale + sy) * width * scale + x * scale + sx) * 4;
          rgba.copy(scaled, targetOffset, sourceOffset, sourceOffset + 4);
        }
      }
    }
  }
  return scaled;
}

function encodePng(width, height, rgba) {
  const rowLength = width * 4;
  const raw = Buffer.alloc((rowLength + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (rowLength + 1)] = 0;
    rgba.copy(raw, y * (rowLength + 1) + 1, y * rowLength, (y + 1) * rowLength);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr(width, height)),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

function ihdr(width, height) {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(width, 0);
  data.writeUInt32BE(height, 4);
  data[8] = 8;
  data[9] = 6;
  return data;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 0);
  return Buffer.concat([length, typeBytes, data, crc]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function renderSummary(metadata) {
  return [
    "# Mine Startup Extraction",
    "",
    "## Screens",
    "",
    "| id | status | size | png | source |",
    "| --- | --- | --- | --- | --- |",
    ...metadata.screens.map((screen) =>
      `| ${screen.id} | ${screen.status} | ${screen.width}x${screen.height} | ${screen.path} | ${screen.source.mapFile} + ${screen.source.bootRoutine} |`
    ),
    "",
    "## Assets",
    "",
    "| id | status | size | png | source |",
    "| --- | --- | --- | --- | --- |",
    ...metadata.assets.map((asset) =>
      `| ${asset.id} | ${asset.status} | ${asset.width}x${asset.height} | ${asset.path} | ${asset.sourceFile} |`
    ),
    ""
  ].join("\n");
}

function renderTypeScript(metadata) {
  return `// Generated by tools/extract-mine-startup.mjs. Do not edit by hand.\n` +
    `export const mineStartupMetadata = ${JSON.stringify(metadata, null, 2)} as const;\n` +
    `export type MineStartupMetadata = typeof mineStartupMetadata;\n`;
}

function parseArgs(args) {
  const parsed = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--infogram") parsed.infogramPath = args[++i];
    else if (arg === "--out-dir") parsed.outDir = args[++i];
    else if (arg === "--generated-dir") parsed.generatedDir = args[++i];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function firstExisting(paths) {
  for (const path of paths) {
    if (path && existsSync(path)) return path;
  }
  throw new Error(`None of these paths exist: ${paths.filter(Boolean).join(", ")}`);
}

function read16(bytes, offset) {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function hex(value, length) {
  return value.toString(16).toUpperCase().padStart(length, "0");
}

main();
