#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const rootDir = resolve(".");

const TEMPORARY_ALLOWED_TILE_IDS = new Map([
  [
    0x01,
    "Temporary level-1 integration: suspected terrain/wall tile. Keep explicit until collision/render semantics are fully confirmed."
  ],
  [
    0x06,
    "Temporary level-1 integration: suspected platform/wall tile. Keep explicit until collision/render semantics are fully confirmed."
  ]
]);

const REQUIRED_CONFIRMED_SPRITE_GROUPS = ["player", "diamond", "monster"];

function main() {
  const tileMetadata = readJson("docs/extraction/mine-tiles-metadata.json");
  const spriteMetadata = readJson("docs/extraction/mine-sprites-metadata.json");
  const hudMetadata = readJson("docs/extraction/mine-hud-metadata.json");
  const startupMetadata = readJson("docs/extraction/mine-startup-metadata.json");
  const titleMetadata = readJson("docs/extraction/mine-title-metadata.json");
  const levelRows = readGeneratedLevelRows("src/assets/generated/levels/mine-level-01-grid.ts");

  const tileStatusById = new Map(tileMetadata.tiles.map((tile) => [tile.tileId, tile.status]));
  const integratedTileIds = [...new Set(levelRows.flat())].sort((left, right) => left - right);

  for (const tileId of integratedTileIds) {
    const status = tileStatusById.get(tileId);
    if (status === "confirmed") {
      continue;
    }

    if (TEMPORARY_ALLOWED_TILE_IDS.has(tileId)) {
      continue;
    }

    fail(
      `Integrated tileId 0x${hex(tileId, 2)} has status ${JSON.stringify(status)} and is not explicitly allowed.`
    );
  }

  for (const [tileId, reason] of TEMPORARY_ALLOWED_TILE_IDS) {
    if (typeof reason !== "string" || reason.length < 20) {
      fail(`Temporary allowlist entry 0x${hex(tileId, 2)} must include a precise reason.`);
    }
  }

  for (const groupId of REQUIRED_CONFIRMED_SPRITE_GROUPS) {
    const group = spriteMetadata.groups.find((candidate) => candidate.id === groupId);
    if (!group) {
      fail(`Integrated sprite group ${groupId} is missing from metadata.`);
    }
    if (group.status !== "confirmed") {
      fail(`Integrated sprite group ${groupId} must be confirmed, got ${group.status}.`);
    }
  }

  for (const panel of hudMetadata.panels) {
    if (panel.status !== "confirmed") {
      fail(`Integrated HUD panel ${panel.id} must be confirmed, got ${panel.status}.`);
    }
  }

  for (const screen of startupMetadata.screens) {
    if (screen.status !== "confirmed") {
      fail(`Integrated startup screen ${screen.id} must be confirmed, got ${screen.status}.`);
    }
  }

  for (const screen of titleMetadata.screens) {
    if (screen.status !== "confirmed") {
      fail(`Integrated title screen ${screen.id} must be confirmed, got ${screen.status}.`);
    }
  }

  for (const animation of titleMetadata.animations) {
    if (animation.status !== "confirmed") {
      fail(`Integrated title animation ${animation.id} must be confirmed, got ${animation.status}.`);
    }
  }

  console.log(
    `Asset integration policy OK: ${integratedTileIds.length} level tiles checked, ` +
      `${TEMPORARY_ALLOWED_TILE_IDS.size} explicit temporary tile allowlist entries.`
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(join(rootDir, path), "utf8"));
}

function readGeneratedLevelRows(path) {
  const source = readFileSync(join(rootDir, path), "utf8");
  const marker = "export const mineLevel01Rows =";
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) {
    fail(`${path} does not export mineLevel01Rows.`);
  }

  const arrayStart = source.indexOf("[", markerIndex);
  if (arrayStart === -1) {
    fail(`${path} does not contain a rows array.`);
  }

  let depth = 0;
  for (let index = arrayStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "[") depth += 1;
    if (char === "]") depth -= 1;
    if (depth === 0) {
      return JSON.parse(source.slice(arrayStart, index + 1));
    }
  }

  fail(`${path} rows array is not closed.`);
}

function hex(value, width) {
  return value.toString(16).toUpperCase().padStart(width, "0");
}

function fail(message) {
  throw new Error(message);
}

main();
