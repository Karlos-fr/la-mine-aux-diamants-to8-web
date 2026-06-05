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
  0x17: "monster",
  0x18: "monster"
};

const ENTITY_TILE_TYPES = new Set(["diamond", "monster"]);

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
    requiredDiamonds: Number(sourceLevel.counts?.["0x03"] ?? 0),
    playerSpawn: {
      x: sourceLevel.playerStart.x,
      y: sourceLevel.playerStart.y
    },
    tiles,
    entities
  };
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
