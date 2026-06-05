#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const rootDir = resolve(".");
const levelsPath = join(rootDir, "docs", "extraction", "mine-levels.json");
const generatedLevelsDir = join(rootDir, "src", "assets", "generated", "levels");

if (!existsSync(levelsPath)) {
  throw new Error(`Missing decoded levels: ${levelsPath}`);
}

const metadata = JSON.parse(readFileSync(levelsPath, "utf8"));

if (metadata.decoder.routine !== "KIT.BIN:$DA10") {
  throw new Error(`Unexpected decoder routine: ${metadata.decoder.routine}`);
}

if (metadata.levels.length !== 16) {
  throw new Error(`Expected 16 levels, got ${metadata.levels.length}`);
}

if (!Array.isArray(metadata.levelArtifacts) || metadata.levelArtifacts.length !== 16) {
  throw new Error(`Expected 16 level artifacts, got ${metadata.levelArtifacts?.length}`);
}

if (metadata.renderedLevels.length !== 16) {
  throw new Error(`Expected 16 rendered levels, got ${metadata.renderedLevels.length}`);
}

for (const level of metadata.levels) {
  if (!level.headerMeta?.time) {
    throw new Error(`Missing level time metadata on level ${level.levelNumber}`);
  }
  if (level.width !== 38 || level.height !== 20) {
    throw new Error(`Unexpected level dimensions on level ${level.levelNumber}`);
  }
  const total = Object.values(level.counts).reduce((sum, count) => sum + count, 0);
  if (total !== 760) {
    throw new Error(`Expected 760 decoded cells on level ${level.levelNumber}, got ${total}`);
  }
  if (typeof level.headerMeta.player?.x !== "number" || typeof level.headerMeta.player?.y !== "number") {
    throw new Error(`Missing player header coordinates on level ${level.levelNumber}`);
  }
  if (typeof level.headerMeta.exit?.x !== "number" || typeof level.headerMeta.exit?.y !== "number") {
    throw new Error(`Missing exit header coordinates on level ${level.levelNumber}`);
  }
  const expectedTotal = level.tilePositions.diamonds.length + level.tilePositions.rocks.length + level.tilePositions.walls.length + level.tilePositions.exits.length;
  if (expectedTotal > total) {
    throw new Error(`Unexpected position accounting on level ${level.levelNumber}: extracted classes ${expectedTotal} exceed total cells ${total}`);
  }
}

for (const renderedLevel of metadata.renderedLevels) {
  const pngPath = join(rootDir, "docs", "extraction", renderedLevel.png);
  if (!existsSync(pngPath)) {
    throw new Error(`Missing rendered level PNG: ${pngPath}`);
  }
  if (renderedLevel.width !== 608 || renderedLevel.height !== 320) {
    throw new Error(`Unexpected rendered dimensions for level ${renderedLevel.levelNumber}`);
  }
}

for (const artifact of metadata.levelArtifacts) {
  const jsonPath = join(rootDir, "docs", "extraction", artifact.json);
  const tsBasename = artifact.ts.replace(/^levels[\\/]/, "");
  const tsPathCandidates = [
    join(rootDir, "src", "assets", "generated", artifact.ts),
    join(generatedLevelsDir, tsBasename),
    join(generatedLevelsDir, artifact.ts)
  ];
  const tsPath = tsPathCandidates.find((path) => existsSync(path));
  const pngPath = join(rootDir, "docs", "extraction", artifact.png);
  if (!existsSync(jsonPath)) {
    throw new Error(`Missing per-level JSON artifact: ${jsonPath}`);
  }
  if (!tsPath) {
    throw new Error(`Missing per-level TS artifact: ${artifact.ts}`);
  }
  if (!existsSync(pngPath)) {
    throw new Error(`Missing per-level PNG artifact in levelArtifacts: ${pngPath}`);
  }

  const levelArtifact = JSON.parse(readFileSync(jsonPath, "utf8"));
  if (levelArtifact.levelNumber !== artifact.levelNumber) {
    throw new Error(`Level number mismatch in artifact ${artifact.ts}`);
  }
  if (typeof levelArtifact.headerMeta?.player?.x !== "number" || typeof levelArtifact.headerMeta?.player?.y !== "number") {
    throw new Error(`Missing player header coordinates in artifact ${artifact.ts}`);
  }
  if (!levelArtifact.positions || !Array.isArray(levelArtifact.positions.diamonds) || !Array.isArray(levelArtifact.positions.rocks)) {
    throw new Error(`Missing position arrays in artifact ${artifact.ts}`);
  }
  if (levelArtifact.counts && levelArtifact.tileClassification) {
    if (levelArtifact.counts["0x03"] !== undefined && levelArtifact.counts["0x03"] !== levelArtifact.positions.diamonds.length) {
      throw new Error(`Diamond count mismatch for artifact ${artifact.ts}`);
    }
    if (levelArtifact.counts["0x00"] !== undefined && levelArtifact.counts["0x00"] + (levelArtifact.counts["0x12"] ?? 0) !== levelArtifact.positions.rocks.length) {
      throw new Error(`Rock/rock-left count mismatch for artifact ${artifact.ts}`);
    }
  }
  const tsContent = readFileSync(tsPath, "utf8");
  if (!tsContent.includes("export const mineLevel")) {
    throw new Error(`Missing mineLevel export in artifact ${artifact.ts}`);
  }
}

const rock = metadata.tileIdentifications["0x00"];
if (rock?.status !== "confirmed" || rock?.name !== "rock") {
  throw new Error("Rock tile 0x00 is not confirmed in level metadata");
}

const diamond = metadata.tileIdentifications["0x03"];
if (diamond?.status !== "confirmed" || diamond?.name !== "diamond") {
  throw new Error("Diamond tile 0x03 is not confirmed in level metadata");
}

const exitBlock = metadata.tileIdentifications["0x04"];
if (exitBlock?.status !== "confirmed" || exitBlock?.name !== "exit_block") {
  throw new Error("Exit block tile 0x04 is not confirmed in level metadata");
}

for (const level of metadata.levels) {
  if (!level.exit) {
    throw new Error(`Missing exit coordinates on level ${level.levelNumber}`);
  }
}

console.log(`Level verification OK: ${metadata.levels.length} levels, 760 cells each`);
