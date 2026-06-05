#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { encodePng } from "./extract-mine-assets.mjs";

const DEFAULT_PORTAGE_DIR =
  "C:\\a\\Projets\\to8-porting-kit-v2\\build\\portage\\minediamant-fbi-androides-saphir_to8-mine";

const SCALE = 4;
const GLYPH_WIDTH = 8;
const GAP = 4;
const LABEL_HEIGHT = 8;
const FOREGROUND = [255, 244, 72, 255];
const BACKGROUND = [0, 0, 0, 255];
const SHEET_BACKGROUND = [31, 31, 31, 255];

const LARGE_MAPPING = {
  0x00: "P",
  0x01: "o",
  0x02: "i",
  0x03: "n",
  0x04: "t",
  0x05: "s",
  0x06: "T",
  0x07: "e",
  0x08: "m",
  0x09: "p",
  0x0a: "R",
  0x0b: "c",
  0x0c: "d",
  0x0d: "r",
  0x0e: " ",
  0x0f: "e",
  0x10: "u",
  0x11: "l",
  0x12: "F",
  0x13: "a"
};

const DIGIT_MAPPING = {
  0x00: "0",
  0x01: "1",
  0x02: "2",
  0x03: "3",
  0x04: "4",
  0x05: "5",
  0x06: "6",
  0x07: "7",
  0x08: "8",
  0x09: "9",
  0x0e: " "
};

const FONT_DEFINITIONS = [
  {
    id: "hud-large-16",
    status: "confirmed",
    baseAddress: 0xc815,
    height: 16,
    glyphCount: 20,
    mapping: LARGE_MAPPING,
    usedBy: ["KIT.BIN:$C0FE", "KIT.BIN:$C131"],
    evidence: [
      "KIT.BIN:$C0FE passes font base $C815, string base $C74E and height $10 to renderer $C601",
      "KIT.BIN:$C131 passes font base $C815, string base $C764 and height $10 to renderer $C601",
      "indices 0x00-0x05 decode the visible word Points; 0x06-0x09 decode Temp; 0x0A/0x07/0x0B/0x01/0x0D/0x0C decode Record"
    ]
  },
  {
    id: "hud-large-16-alt",
    status: "confirmed",
    baseAddress: 0xc955,
    height: 16,
    glyphCount: 11,
    mapping: DIGIT_MAPPING,
    usedBy: ["KIT.BIN:$C0FE", "KIT.BIN:$C131"],
    evidence: [
      "KIT.BIN:$C0FE/$C131 switch to font base $C955 after calling $C32A, using the same renderer $C601",
      "font base $C955 contains the alternate 16-row numeric glyphs used with strings $C706/$C700"
    ]
  },
  {
    id: "hud-small-11",
    status: "confirmed",
    baseAddress: 0xc7a7,
    height: 11,
    glyphCount: 16,
    mapping: DIGIT_MAPPING,
    usedBy: ["KIT.BIN:$C516", "KIT.BIN:$C54D", "KIT.BIN:$C59E", "KIT.BIN:$C5C3"],
    evidence: [
      "KIT.BIN:$C516 sets font base $C7A7 and height from $C6FC before calling renderer $C601",
      "KIT.BIN:$C54D/$C59E use this path for score/time HUD fields"
    ]
  },
  {
    id: "hud-small-11-alt",
    status: "confirmed",
    baseAddress: 0xc79c,
    height: 11,
    glyphCount: 16,
    mapping: DIGIT_MAPPING,
    usedBy: ["KIT.BIN:$C526", "KIT.BIN:$C54D", "KIT.BIN:$C59E"],
    evidence: [
      "KIT.BIN:$C526 calls $C32A, sets font base $C79C, then calls renderer $C601",
      "the bytes form the alternate 11-row digit glyphs for dynamic HUD fields"
    ]
  },
  {
    id: "hud-digits-7",
    status: "confirmed",
    baseAddress: 0xc965,
    height: 7,
    glyphCount: 11,
    mapping: DIGIT_MAPPING,
    usedBy: ["KIT.BIN:$C1EF", "KIT.BIN:$C222"],
    evidence: [
      "KIT.BIN:$C1EF passes font base $C965, string base $C735 and height $07 to renderer $C601",
      "KIT.BIN:$C222 passes font base $C965, string base $C738 and height $07 to renderer $C601",
      "glyphs 0x00-0x09 render as digits 0-9"
    ]
  },
  {
    id: "hud-digits-7-alt",
    status: "confirmed",
    baseAddress: 0xc9ab,
    height: 7,
    glyphCount: 11,
    mapping: DIGIT_MAPPING,
    usedBy: ["KIT.BIN:$C1EF", "KIT.BIN:$C222"],
    evidence: [
      "KIT.BIN:$C1EF/$C222 switch to font base $C9AB after calling $C32A, using the same renderer $C601",
      "the block provides the alternate 7-row numeric rendering pass"
    ]
  }
];

const HUD_STRINGS = [
  { id: "large-labels-main", address: 0xc74e, fontId: "hud-large-16", evidence: "KIT.BIN:$C0FE loads string base $C74E" },
  { id: "large-labels-secondary", address: 0xc764, fontId: "hud-large-16", evidence: "KIT.BIN:$C131 loads string base $C764" },
  { id: "score-digits", address: 0xc71c, fontId: "hud-small-11", evidence: "KIT.BIN:$C54D loads dynamic field base $C71C" },
  { id: "time-digits", address: 0xc723, fontId: "hud-small-11", evidence: "KIT.BIN:$C54D/$C59E load dynamic field base $C723" },
  { id: "record-digits", address: 0xc727, fontId: "hud-small-11-alt", evidence: "KIT.BIN:$C54D loads dynamic field base $C727" },
  { id: "gallery-digits", address: 0xc72e, fontId: "hud-small-11-alt", evidence: "KIT.BIN:$C54D loads dynamic field base $C72E" },
  { id: "small-counter-a", address: 0xc735, fontId: "hud-digits-7", evidence: "KIT.BIN:$C1EF loads string base $C735" },
  { id: "small-counter-b", address: 0xc738, fontId: "hud-digits-7", evidence: "KIT.BIN:$C222 loads string base $C738" }
];

function main() {
  const args = parseArgs(process.argv.slice(2));
  const rootDir = resolve(".");
  const portageDir = resolveSourceDir(args.portageDir ?? process.env.MINE_PORTAGE_DIR, rootDir);
  const memoryPath = firstExisting([
    args.memoryPath,
    join(rootDir, "extraction", "sources", "runtime", "memory.bin"),
    join(portageDir, "memory", "memory.bin")
  ]);
  const outDir = resolve(args.outDir ?? join(rootDir, "docs", "extraction"));
  const generatedDir = resolve(args.generatedDir ?? join(rootDir, "src", "assets", "generated"));
  const fontDir = join(outDir, "fonts");

  mkdirSync(fontDir, { recursive: true });
  mkdirSync(generatedDir, { recursive: true });

  const memory = readFileSync(memoryPath);
  const fonts = FONT_DEFINITIONS.map((definition) => extractFont(memory, definition, fontDir));
  const strings = HUD_STRINGS.map((definition) => extractHudString(memory, definition, fonts));

  const metadata = {
    generatedBy: basename(import.meta.url),
    source: {
      portageDir,
      memoryPath,
      excludedDiskFamilies: ["SAPHIR.*", "FBI.*", "ANDROIDE.*"]
    },
    renderer: {
      routine: "KIT.BIN:$C601",
      format: "string byte is glyph index; 0xDD terminates strings; glyph address = fontBase + glyphIndex * glyphHeight; one byte per glyph row",
      screenStrideBytes: 40,
      colorModeSwitch: "KIT.BIN:$C6A0 sets $E7C3 bit 0; KIT.BIN:$C32A clears it"
    },
    fonts,
    strings
  };

  writeFileSync(join(outDir, "mine-fonts-metadata.json"), `${JSON.stringify(metadata, null, 2)}\n`);
  writeFileSync(join(outDir, "mine-fonts-summary.md"), renderSummary(metadata));
  writeFileSync(
    join(generatedDir, "mine-fonts.ts"),
    `/**\n` +
      ` * Generated by tools/extract-mine-fonts.mjs.\n` +
      ` * Source metadata is embedded in mineFontMetadata below.\n` +
      ` * Do not edit by hand.\n` +
      ` */\n` +
      `export const mineFontMetadata = ${JSON.stringify(metadata, null, 2)} as const;\n` +
      `export type MineFontMetadata = typeof mineFontMetadata;\n`
  );

  console.log(`Extracted ${fonts.length} font tables from ${memoryPath}`);
  console.log(`Wrote ${join(outDir, "mine-fonts-metadata.json")}`);
}

function extractFont(memory, definition, fontDir) {
  const glyphs = [];
  for (let glyphId = 0; glyphId < definition.glyphCount; glyphId += 1) {
    const address = definition.baseAddress + glyphId * definition.height;
    const bytes = Array.from(memory.subarray(address, address + definition.height));
    glyphs.push({
      glyphId,
      hexId: `0x${hex(glyphId, 2)}`,
      char: definition.mapping[glyphId] ?? null,
      address: hexAddress(address),
      bytes: bytes.map((value) => `0x${hex(value, 2)}`),
      rows: bytes.map((value) => byteToRow(value)),
      byteSha256: sha256(Buffer.from(bytes))
    });
  }

  const atlas = renderFontAtlas(glyphs, definition.height);
  const png = `fonts/${definition.id}-atlas.png`;
  writeFileSync(join(fontDir, `${definition.id}-atlas.png`), encodePng(atlas.width, atlas.height, atlas.rgba));

  return {
    id: definition.id,
    status: definition.status,
    baseAddress: hexAddress(definition.baseAddress),
    height: definition.height,
    width: GLYPH_WIDTH,
    glyphCount: definition.glyphCount,
    png,
    usedBy: definition.usedBy,
    evidence: definition.evidence,
    glyphs
  };
}

function extractHudString(memory, definition, fonts) {
  const bytes = [];
  for (let address = definition.address; address < definition.address + 80; address += 1) {
    const value = memory[address];
    if (value === 0xdd) break;
    bytes.push(value);
  }
  const font = fonts.find((candidate) => candidate.id === definition.fontId);
  const mapping = Object.fromEntries(font.glyphs.map((glyph) => [glyph.glyphId, glyph.char]));
  const decoded = bytes.map((value) => mapping[value] ?? `[${hex(value, 2)}]`).join("");
  return {
    id: definition.id,
    address: hexAddress(definition.address),
    fontId: definition.fontId,
    terminator: "0xDD",
    byteLength: bytes.length + 1,
    bytes: bytes.map((value) => `0x${hex(value, 2)}`),
    decoded,
    status: decoded.includes("[") ? "partial" : "confirmed",
    evidence: [definition.evidence]
  };
}

function renderFontAtlas(glyphs, glyphHeight) {
  const cellWidth = GLYPH_WIDTH * SCALE;
  const cellHeight = glyphHeight * SCALE + LABEL_HEIGHT;
  const width = glyphs.length * cellWidth + Math.max(0, glyphs.length - 1) * GAP;
  const height = cellHeight;
  const rgba = Buffer.alloc(width * height * 4);
  fill(rgba, SHEET_BACKGROUND);
  glyphs.forEach((glyph, index) => {
    const x = index * (cellWidth + GAP);
    drawGlyph(rgba, width, x, 0, glyph.rows, SCALE);
    drawTinyHex(rgba, width, x + 1, glyphHeight * SCALE + 1, glyph.hexId);
  });
  return { width, height, rgba };
}

function drawGlyph(rgba, targetWidth, dx, dy, rows, scale) {
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x += 1) {
      const color = row[x] === "1" ? FOREGROUND : BACKGROUND;
      for (let sy = 0; sy < scale; sy += 1) {
        for (let sx = 0; sx < scale; sx += 1) {
          writePixel(rgba, targetWidth, dx + x * scale + sx, dy + y * scale + sy, color);
        }
      }
    }
  });
}

function drawTinyHex(rgba, width, x, y, text) {
  let cursor = x;
  for (const char of text) {
    const rows = TINY_FONT[char] ?? TINY_FONT["0"];
    rows.forEach((row, rowIndex) => {
      for (let col = 0; col < row.length; col += 1) {
        if (row[col] === "1") writePixel(rgba, width, cursor + col, y + rowIndex, [255, 255, 255, 255]);
      }
    });
    cursor += 4;
  }
}

const TINY_FONT = {
  "0": ["111", "101", "101", "101", "111"],
  "1": ["010", "110", "010", "010", "111"],
  "2": ["111", "001", "111", "100", "111"],
  "3": ["111", "001", "111", "001", "111"],
  "4": ["101", "101", "111", "001", "001"],
  "5": ["111", "100", "111", "001", "111"],
  "6": ["111", "100", "111", "101", "111"],
  "7": ["111", "001", "010", "010", "010"],
  "8": ["111", "101", "111", "101", "111"],
  "9": ["111", "101", "111", "001", "111"],
  "A": ["111", "101", "111", "101", "101"],
  "B": ["110", "101", "110", "101", "110"],
  "C": ["111", "100", "100", "100", "111"],
  "D": ["110", "101", "101", "101", "110"],
  "E": ["111", "100", "110", "100", "111"],
  "F": ["111", "100", "110", "100", "100"],
  "x": ["000", "101", "010", "101", "000"]
};

function renderSummary(metadata) {
  const lines = [];
  lines.push("# Mine Fonts And HUD - Phase 5 Summary");
  lines.push("");
  lines.push(`Renderer: \`${metadata.renderer.routine}\``);
  lines.push(`Format: ${metadata.renderer.format}`);
  lines.push("");
  lines.push("## Font Tables");
  lines.push("");
  lines.push("| Font | Status | Base | Size | Glyphs | PNG | Evidence |");
  lines.push("| --- | --- | --- | --- | ---: | --- | --- |");
  for (const font of metadata.fonts) {
    lines.push(`| ${font.id} | \`${font.status}\` | \`${font.baseAddress}\` | ${font.width}x${font.height} | ${font.glyphCount} | \`${font.png}\` | ${font.evidence.join("<br>")} |`);
  }
  lines.push("");
  lines.push("## HUD Strings");
  lines.push("");
  lines.push("| Id | Status | Address | Font | Decoded | Bytes | Evidence |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- |");
  for (const string of metadata.strings) {
    lines.push(`| ${string.id} | \`${string.status}\` | \`${string.address}\` | ${string.fontId} | \`${string.decoded}\` | ${string.bytes.join(" ")} \`0xDD\` | ${string.evidence.join("<br>")} |`);
  }
  return `${lines.join("\n")}\n`;
}

function byteToRow(value) {
  let row = "";
  for (let bit = 0; bit < 8; bit += 1) {
    row += (value & (0x80 >> bit)) !== 0 ? "1" : "0";
  }
  return row;
}

function fill(rgba, color) {
  for (let offset = 0; offset < rgba.length; offset += 4) {
    rgba[offset] = color[0];
    rgba[offset + 1] = color[1];
    rgba[offset + 2] = color[2];
    rgba[offset + 3] = color[3];
  }
}

function writePixel(rgba, width, x, y, color) {
  const offset = (y * width + x) * 4;
  rgba[offset] = color[0];
  rgba[offset + 1] = color[1];
  rgba[offset + 2] = color[2];
  rgba[offset + 3] = color[3];
}

function parseArgs(args) {
  const parsed = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--portage-dir") parsed.portageDir = args[++i];
    else if (arg === "--memory") parsed.memoryPath = args[++i];
    else if (arg === "--out-dir") parsed.outDir = args[++i];
    else if (arg === "--generated-dir") parsed.generatedDir = args[++i];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
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
  throw new Error(`Missing source file. Tried: ${paths.filter(Boolean).join(", ")}`);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function hexAddress(value) {
  return `0x${hex(value, 4)}`;
}

function hex(value, length) {
  return value.toString(16).toUpperCase().padStart(length, "0");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}
