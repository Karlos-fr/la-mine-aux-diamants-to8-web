#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { renderTileRgba } from "./extract-mine-assets.mjs";

const DEFAULT_PORTAGE_DIR =
  "C:\\a\\Projets\\to8-porting-kit-v2\\build\\portage\\minediamant-fbi-androides-saphir_to8-mine";
const ROCK_ADDRESS = 0xd218;
const TILE_SIZE_BYTES = 0x40;
const EXPECTED_ROCK_RGBA_SHA256 =
  "42d9069123a72a99809133f6d1b977da8c5421200e32b10a83a3ed0a5803d218";

const rootDir = resolve(".");
const portageDir = existsSync(DEFAULT_PORTAGE_DIR) ? DEFAULT_PORTAGE_DIR : rootDir;
const memoryPath = firstExisting([
  process.env.MINE_MEMORY_BIN,
  join(portageDir, "memory", "memory.bin"),
  join(rootDir, "extraction", "sources", "runtime", "memory.bin")
]);
const metadataPath = join(rootDir, "docs", "extraction", "mine-tiles-metadata.json");
const spritesMetadataPath = join(rootDir, "docs", "extraction", "mine-sprites-metadata.json");

const memory = readFileSync(memoryPath);
const rockBytes = memory.subarray(ROCK_ADDRESS, ROCK_ADDRESS + TILE_SIZE_BYTES);
const rockRgba = renderTileRgba(rockBytes);
const actualHash = sha256(rockRgba);

if (actualHash !== EXPECTED_ROCK_RGBA_SHA256) {
  throw new Error(`Rock tile hash mismatch: expected ${EXPECTED_ROCK_RGBA_SHA256}, got ${actualHash}`);
}

if (!existsSync(metadataPath)) {
  throw new Error(`Missing metadata file: ${metadataPath}`);
}
if (!existsSync(spritesMetadataPath)) {
  throw new Error(`Missing sprites metadata file: ${spritesMetadataPath}`);
}

const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
const metadataHash = metadata?.confirmedAssets?.rock?.rgbaSha256;
if (metadataHash !== EXPECTED_ROCK_RGBA_SHA256) {
  throw new Error(`Metadata rock hash mismatch: expected ${EXPECTED_ROCK_RGBA_SHA256}, got ${metadataHash}`);
}

const spritesMetadata = JSON.parse(readFileSync(spritesMetadataPath, "utf8"));
const player = spritesMetadata.groups.find((group) => group.id === "player");
if (!player || player.status !== "confirmed") {
  throw new Error("Missing confirmed player sprite group");
}

const idleCycle = player.animations.find((animation) => animation.id === "idleCycle");
if (!idleCycle || idleCycle.status !== "confirmed" || idleCycle.sourceAddress !== "0xD036-0xD069") {
  throw new Error("Missing confirmed player idle cycle from $D036-$D069");
}

for (const requiredTileId of [0x07, 0x08, 0x09, 0x0a, 0x0b]) {
  if (!idleCycle.uniqueFrameTileIds.includes(requiredTileId)) {
    throw new Error(`Idle cycle does not include tile 0x${requiredTileId.toString(16).toUpperCase()}`);
  }
}

for (const animationId of ["moveRight", "moveLeft", "moveVertical"]) {
  const animation = player.animations.find((candidate) => candidate.id === animationId);
  if (!animation || animation.status !== "confirmed") {
    throw new Error(`Missing confirmed player animation: ${animationId}`);
  }
}

const diamond = spritesMetadata.groups.find((group) => group.id === "diamond");
const diamondCycle = diamond?.animations.find((animation) => animation.id === "colorCycle");
if (!diamondCycle || diamondCycle.status !== "confirmed" || diamondCycle.frameCount !== 8) {
  throw new Error("Missing confirmed 8-frame diamond color cycle");
}

const explosion = spritesMetadata.groups.find((group) => group.id === "explosion");
const blast = explosion?.animations.find((animation) => animation.id === "blast3x3");
if (!blast || blast.status !== "confirmed") {
  throw new Error("Missing confirmed explosion animation");
}

const monster = spritesMetadata.groups.find((group) => group.id === "monster");
const monsterBlink = monster?.animations.find((animation) => animation.id === "blinkToggle");
if (!monster || monster.status !== "confirmed" || !monsterBlink || monsterBlink.status !== "confirmed") {
  throw new Error("Missing confirmed monster blink animation");
}

if (monster.frames.length !== 2 || monster.frames.some((frame) => frame.tileId !== 0x02)) {
  throw new Error("Monster blink must alternate the two tileId 0x02 frames produced by KIT.BIN:$D1BB");
}

console.log(`Asset verification OK: rock tile 0x00 ${actualHash}`);

function firstExisting(paths) {
  for (const path of paths) {
    if (path && existsSync(path)) return path;
  }
  throw new Error(`Missing memory source. Tried: ${paths.filter(Boolean).join(", ")}`);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}
