#!/usr/bin/env node
import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const DEFAULT_PORTAGE_DIR =
  "C:\\a\\Projets\\to8-porting-kit-v2\\build\\portage\\minediamant-fbi-androides-saphir_to8-mine";

const SCREEN_WIDTH = 320;
const SCREEN_HEIGHT = 200;
const SCREEN_STRIDE_BYTES = 40;
const BLOCK_WIDTH = 8;
const BLOCK_HEIGHT = 8;
const PANEL_COLUMNS = 8;
const PANEL_ROWS = 5;
const PANEL_WIDTH = PANEL_COLUMNS * BLOCK_WIDTH;
const PANEL_HEIGHT = PANEL_ROWS * BLOCK_HEIGHT;

const TO8_INTENSITIES = [
  0, 100, 127, 147, 163, 179, 191, 203,
  215, 223, 231, 239, 243, 247, 251, 255
];

const TO8_DEFAULT_RGB4 = [
  [0x0, 0x0, 0x0],
  [0xf, 0x0, 0x0],
  [0x0, 0xf, 0x0],
  [0xf, 0xf, 0x0],
  [0x0, 0x0, 0xf],
  [0xf, 0x0, 0xf],
  [0x0, 0xf, 0xf],
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

const PALETTE = TO8_DEFAULT_RGB4.map(([red, green, blue]) => [
  TO8_INTENSITIES[red],
  TO8_INTENSITIES[green],
  TO8_INTENSITIES[blue],
  255
]);

const PANELS = [
  {
    id: "left-wood-sign",
    name: "La mine aux diamants sign",
    screenAddress: 0x5900,
    screenX: 0,
    screenY: 160,
    shapeIndexAddress: 0xc336,
    colorIndexAddress: 0xc35e,
    evidence: [
      "KIT.BIN:$C197 sets destination $5900, shape table $C336 and glyph base $C3D6",
      "KIT.BIN:$C197 then switches page with $C32A and uses color table $C35E with glyph base $C4C6",
      "KIT.BIN:$C2D4 renders an 8x5 grid of 8x8 blocks, so the panel is 64x40 pixels"
    ]
  },
  {
    id: "right-gallery-sign",
    name: "Galerie sign",
    screenAddress: 0x5920,
    screenX: 256,
    screenY: 160,
    shapeIndexAddress: 0xc386,
    colorIndexAddress: 0xc3ae,
    evidence: [
      "KIT.BIN:$C197 sets destination $5920, shape table $C386 and glyph base $C3D6",
      "KIT.BIN:$C197 then switches page with $C32A and uses color table $C3AE with glyph base $C4C6",
      "KIT.BIN:$C1EF/$C222 draw the gallery counters at $5C40/$5C45 inside this panel"
    ]
  }
];

const SHAPE_GLYPH_BASE = 0xc3d6;
const COLOR_GLYPH_BASE = 0xc4c6;
const TABLE_LENGTH = PANEL_COLUMNS * PANEL_ROWS;

function main() {
  const args = parseArgs(process.argv.slice(2));
  const rootDir = resolve(".");
  const portageDir = resolveSourceDir(args.portageDir ?? process.env.MINE_PORTAGE_DIR, rootDir);
  const memoryPath = firstExisting([
    args.memoryPath,
    join(rootDir, "extraction", "sources", "runtime", "memory.bin"),
    join(portageDir, "memory", "memory.bin")
  ]);
  const kitBlocksDir = firstExisting([
    args.kitBlocksDir,
    join(portageDir, "memory", "blocks")
  ]);
  const outDir = resolve(args.outDir ?? join(rootDir, "docs", "extraction", "hud"));
  const generatedDir = resolve(args.generatedDir ?? join(rootDir, "src", "assets", "generated"));

  mkdirSync(outDir, { recursive: true });
  mkdirSync(generatedDir, { recursive: true });

  const sourceMemory = Buffer.from(readFileSync(memoryPath));
  overlayKitBlocks(sourceMemory, kitBlocksDir);

  const extractedPanels = PANELS.map((panel) => extractPanel(sourceMemory, panel));
  for (const panel of extractedPanels) {
    writeFileSync(join(outDir, `${panel.id}.png`), encodePng(panel.width, panel.height, panel.rgba));
  }

  const atlas = buildAtlas(extractedPanels);
  writeFileSync(join(outDir, "hud-wood-panels-atlas.png"), encodePng(atlas.width, atlas.height, atlas.rgba));

  const metadata = {
    generatedBy: "tools/extract-mine-hud.mjs",
    source: {
      portageDir,
      memoryPath,
      kitBlocksDir,
      binary: "KIT.BIN",
      routine: "KIT.BIN:$C197",
      renderer: "KIT.BIN:$C2D4",
      colorPlaneSwitch: "KIT.BIN:$C32A clears $E7C3 bit 0",
      shapePlaneSwitch: "KIT.BIN:$C6A0 sets $E7C3 bit 0"
    },
    format: {
      mode: "TO8 320x16",
      screenWidth: SCREEN_WIDTH,
      screenHeight: SCREEN_HEIGHT,
      screenStrideBytes: SCREEN_STRIDE_BYTES,
      panelWidth: PANEL_WIDTH,
      panelHeight: PANEL_HEIGHT,
      grid: "8 columns x 5 rows of 8x8 blocks",
      shapeGlyphBase: `0x${hex(SHAPE_GLYPH_BASE, 4)}`,
      colorGlyphBase: `0x${hex(COLOR_GLYPH_BASE, 4)}`,
      colorFormula: "foreground/background from TO8 320x16 attribute byte"
    },
    panels: extractedPanels.map(({ rgba, shapePlane, colorPlane, ...panel }) => ({
      ...panel,
      rgbaSha256: sha256(rgba),
      shapePlaneSha256: sha256(shapePlane),
      colorPlaneSha256: sha256(colorPlane)
    })),
    atlas: {
      path: "hud/hud-wood-panels-atlas.png",
      width: atlas.width,
      height: atlas.height,
      rgbaSha256: sha256(atlas.rgba)
    }
  };

  writeFileSync(join(outDir, "..", "mine-hud-metadata.json"), JSON.stringify(metadata, null, 2));
  writeFileSync(join(outDir, "..", "mine-hud-summary.md"), renderSummary(metadata));
  writeFileSync(join(generatedDir, "mine-hud.ts"), renderTypeScriptMetadata(metadata));

  console.log(`Extracted ${extractedPanels.length} HUD panels to ${outDir}`);
}

function extractPanel(memory, panel) {
  const shapePlane = new Uint8Array(PANEL_WIDTH * PANEL_HEIGHT);
  const colorPlane = new Uint8Array(PANEL_WIDTH * PANEL_HEIGHT);
  drawPanelPlane(memory, shapePlane, panel.shapeIndexAddress, SHAPE_GLYPH_BASE);
  drawPanelPlane(memory, colorPlane, panel.colorIndexAddress, COLOR_GLYPH_BASE);

  const rgba = Buffer.alloc(PANEL_WIDTH * PANEL_HEIGHT * 4);
  for (let y = 0; y < PANEL_HEIGHT; y += 1) {
    for (let byteX = 0; byteX < PANEL_COLUMNS; byteX += 1) {
      const offset = y * PANEL_COLUMNS + byteX;
      const shapeByte = shapePlane[offset];
      const colorByte = colorPlane[offset];
      for (let bit = 0; bit < 8; bit += 1) {
        const x = byteX * 8 + bit;
        const shape = (shapeByte & (0x80 >> bit)) !== 0;
        writePixel(rgba, PANEL_WIDTH, x, y, PALETTE[colorIndexFromAttribute(colorByte, shape)]);
      }
    }
  }

  return {
    id: panel.id,
    name: panel.name,
    status: "confirmed",
    path: `hud/${panel.id}.png`,
    width: PANEL_WIDTH,
    height: PANEL_HEIGHT,
    screenAddress: `0x${hex(panel.screenAddress, 4)}`,
    screenX: panel.screenX,
    screenY: panel.screenY,
    shapeIndexAddress: `0x${hex(panel.shapeIndexAddress, 4)}`,
    shapeIndexBytes: bytesAt(memory, panel.shapeIndexAddress, TABLE_LENGTH),
    colorIndexAddress: `0x${hex(panel.colorIndexAddress, 4)}`,
    colorIndexBytes: bytesAt(memory, panel.colorIndexAddress, TABLE_LENGTH),
    shapeGlyphBase: `0x${hex(SHAPE_GLYPH_BASE, 4)}`,
    colorGlyphBase: `0x${hex(COLOR_GLYPH_BASE, 4)}`,
    usedBy: ["KIT.BIN:$C197", "KIT.BIN:$C2D4"],
    evidence: panel.evidence,
    shapePlane: Buffer.from(shapePlane),
    colorPlane: Buffer.from(colorPlane),
    rgba
  };
}

function drawPanelPlane(memory, plane, indexAddress, glyphBase) {
  for (let blockRow = 0; blockRow < PANEL_ROWS; blockRow += 1) {
    for (let blockCol = 0; blockCol < PANEL_COLUMNS; blockCol += 1) {
      const blockIndex = blockRow * PANEL_COLUMNS + blockCol;
      const glyphIndex = memory[indexAddress + blockIndex];
      const glyphAddress = glyphBase + glyphIndex * BLOCK_HEIGHT;
      for (let row = 0; row < BLOCK_HEIGHT; row += 1) {
        const targetOffset = (blockRow * BLOCK_HEIGHT + row) * PANEL_COLUMNS + blockCol;
        plane[targetOffset] = memory[glyphAddress + row];
      }
    }
  }
}

function buildAtlas(panels) {
  const width = panels.length * PANEL_WIDTH;
  const height = PANEL_HEIGHT;
  const rgba = Buffer.alloc(width * height * 4);
  fill(rgba, [0, 0, 0, 0]);
  for (let index = 0; index < panels.length; index += 1) {
    blit(rgba, width, panels[index].rgba, PANEL_WIDTH, PANEL_HEIGHT, index * PANEL_WIDTH, 0);
  }
  return { width, height, rgba };
}

function colorIndexFromAttribute(attribute, shape) {
  const background = ((attribute & 0x07) | ((~attribute & 0x80) >> 4)) & 0x0f;
  const foreground = (((attribute >> 3) & 0x07) | ((~attribute & 0x40) >> 3)) & 0x0f;
  return shape ? foreground : background;
}

function writePixel(rgba, width, x, y, color) {
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
  const buffer = Buffer.alloc(13);
  buffer.writeUInt32BE(width, 0);
  buffer.writeUInt32BE(height, 4);
  buffer[8] = 8;
  buffer[9] = 6;
  return buffer;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function renderSummary(metadata) {
  const rows = metadata.panels.map((panel) => {
    return `| ${panel.id} | ${panel.status} | ${panel.screenAddress} | ${panel.width}x${panel.height} | ${panel.path} | ${panel.evidence.join("<br>")} |`;
  });
  return [
    "# Mine HUD Extraction",
    "",
    `Source routine: \`${metadata.source.routine}\``,
    `Renderer: \`${metadata.source.renderer}\``,
    "",
    "## Panels",
    "",
    "| id | status | screen | size | png | evidence |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows,
    "",
    "## Notes",
    "",
    "- The panel graphics are not screenshots; they are reconstructed from the index tables and bitmap glyph bases used by `KIT.BIN:$C197`.",
    "- The left sign is drawn at `$5900` and the right gallery sign at `$5920`, both in the original 320x200 screen HUD area.",
    ""
  ].join("\n");
}

function renderTypeScriptMetadata(metadata) {
  return `/**\n` +
    ` * Generated by tools/extract-mine-hud.mjs.\n` +
    ` * Source metadata is embedded in mineHudMetadata below.\n` +
    ` * Do not edit by hand.\n` +
    ` */\n` +
    `export const mineHudMetadata = ${JSON.stringify(metadata, null, 2)} as const;\n` +
    `export type MineHudMetadata = typeof mineHudMetadata;\n`;
}

function parseArgs(args) {
  const parsed = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--portage-dir") parsed.portageDir = args[++i];
    else if (arg === "--memory") parsed.memoryPath = args[++i];
    else if (arg === "--kit-blocks-dir") parsed.kitBlocksDir = args[++i];
    else if (arg === "--out-dir") parsed.outDir = args[++i];
    else if (arg === "--generated-dir") parsed.generatedDir = args[++i];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function overlayKitBlocks(memory, blocksDir) {
  if (!blocksDir || !existsSync(blocksDir)) return;
  for (const fileName of readdirSync(blocksDir)) {
    if (!fileName.startsWith("load-004-KIT.BIN-block-")) continue;
    const match = fileName.match(/\$([0-9A-F]{4})-\$([0-9A-F]{4})\.bin$/i);
    if (!match) continue;
    const start = Number.parseInt(match[1], 16);
    const bytes = readFileSync(join(blocksDir, fileName));
    bytes.copy(memory, start);
  }
}

function resolveSourceDir(candidate, rootDir) {
  if (candidate && existsSync(candidate)) return candidate;
  if (existsSync(DEFAULT_PORTAGE_DIR)) return DEFAULT_PORTAGE_DIR;
  return rootDir;
}

function firstExisting(paths) {
  for (const path of paths) {
    if (path && existsSync(path)) return path;
  }
  throw new Error(`None of these paths exist: ${paths.filter(Boolean).join(", ")}`);
}

function bytesAt(memory, address, length) {
  return Array.from(memory.subarray(address, address + length)).map((value) => `0x${hex(value, 2)}`);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function hex(value, width) {
  return value.toString(16).toUpperCase().padStart(width, "0");
}

main();
