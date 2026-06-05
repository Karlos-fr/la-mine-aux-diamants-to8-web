#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const ROOT_DIR = resolve(".");
const SOURCE_LEVELS_PATH = join(ROOT_DIR, "docs", "extraction", "mine-levels.json");
const OUTPUT_LEVELS_DIR = join(ROOT_DIR, "src", "assets", "levels");

const TILE_TYPES = {
  0x00: "rock",
  0x01: "earth",
  0x02: "monster",
  0x03: "diamond",
  0x04: "border",
  0x05: "empty",
  0x06: "platform",
  // ASM evidence:
  // - 0x17 is decoded through KIT.BIN:$BC07 and tracked in the $DB4F special table.
  // - 0x18 is tested by the falling-object routine around KIT.BIN:$CB3B as a fixed transformer block.
  // - 0x19 is not emitted by decoded level grids; it remains a graphic/alternate frame candidate only.
  0x17: "specialCreature",
  0x18: "transformerBlock"
};

const ENTITY_TILE_TYPES = new Set(["diamond", "monster", "specialCreature"]);

function main() {
  const extraction = JSON.parse(readFileSync(SOURCE_LEVELS_PATH, "utf8"));
  mkdirSync(OUTPUT_LEVELS_DIR, { recursive: true });

  for (const sourceLevel of extraction.levels) {
    const level = buildModernLevel(sourceLevel);
    const outputPath = join(OUTPUT_LEVELS_DIR, `${level.id}.json`);
    writeFileSync(outputPath, `${JSON.stringify(level, null, 2)}\n`);
    console.log(`Wrote ${outputPath}`);
  }
}

function buildModernLevel(sourceLevel) {
  const tiles = [];
  const entities = [];
  const sourceRows = parseRows(sourceLevel.rows);
  const sourceWidth = sourceLevel.width;
  const sourceHeight = sourceLevel.height;
  const width = sourceWidth + 2;
  const height = sourceHeight + 2;

  for (let x = 0; x < width; x += 1) {
    tiles.push({ x, y: 0, type: "border" });
    tiles.push({ x, y: height - 1, type: "border" });
  }

  for (let y = 1; y < height - 1; y += 1) {
    tiles.push({ x: 0, y, type: "border" });
    tiles.push({ x: width - 1, y, type: "border" });
  }

  sourceRows.forEach((row, y) => {
    row.forEach((tileId, x) => {
      const type = TILE_TYPES[tileId];
      if (!type) {
        throw new Error(`Unknown tile id 0x${tileId.toString(16).padStart(2, "0")} at ${x},${y} in level ${sourceLevel.levelNumber}`);
      }

      if (type !== "empty") {
        tiles.push({ x: x + 1, y: y + 1, type });
      }

      if (ENTITY_TILE_TYPES.has(type)) {
        entities.push({ x: x + 1, y: y + 1, type });
      }
    });
  });

  const levelNumber = sourceLevel.levelNumber;
  return {
    schemaVersion: 1,
    id: `level-${String(levelNumber).padStart(2, "0")}`,
    label: `Galerie ${String(levelNumber).padStart(2, "0")}`,
    width,
    height,
    tileSize: 16,
    defaultTile: "empty",
    time: parseRuntimeTime(sourceLevel.headerMeta?.time?.bcdString),
    scoreStep: parseHexByte(sourceLevel.headerMeta?.levelFlags?.param2, 0x0f),
    requiredDiamonds: parseRequiredDiamonds(sourceLevel.headerMeta?.raw),
    playerSpawn: {
      x: sourceLevel.playerStart.x,
      y: sourceLevel.playerStart.y
    },
    exit: {
      x: sourceLevel.exit.x,
      y: sourceLevel.exit.y
    },
    tiles,
    entities
  };
}

function parseRequiredDiamonds(rawHeader) {
  if (!Array.isArray(rawHeader) || rawHeader.length < 2) {
    return 0;
  }

  // Preuve ASM:
  // - KIT.BIN:$DA20 lit header[0..1].
  // - KIT.BIN:$DA22 stocke ces deux octets en $C738/$C739.
  // - KIT.BIN:$C222 affiche le compteur droit depuis $C738.
  return parseBcdDigitPair(rawHeader[0], rawHeader[1]);
}

function parseBcdDigitPair(highDigit, lowDigit) {
  const high = parseHexByte(highDigit, 0);
  const low = parseHexByte(lowDigit, 0);
  return high * 10 + low;
}

function parseRows(rows) {
  return rows.map((row) => {
    if (Array.isArray(row)) {
      return row.map((value) => Number(value));
    }

    return row.trim().split(/\s+/).map((value) => Number.parseInt(value, 16));
  });
}

function parseRuntimeTime(value) {
  if (typeof value !== "string") {
    return 0;
  }

  const [left, right] = value.split(":");
  const minutes = Number.parseInt(left, 10);
  const seconds = Number.parseInt(right, 10);
  if (Number.isNaN(minutes) || Number.isNaN(seconds)) {
    return 0;
  }

  return minutes * 100 + seconds * 10;
}

function parseHexByte(value, fallback) {
  if (typeof value !== "string") {
    return fallback;
  }

  const parsed = Number.parseInt(value, 16);
  return Number.isNaN(parsed) ? fallback : parsed;
}

main();
