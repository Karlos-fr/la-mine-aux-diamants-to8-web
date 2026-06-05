#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const rootDir = resolve(".");

const provenanceFiles = [
  "docs/provenance/ASSET_PROVENANCE.md",
  "docs/provenance/tiles-provenance.md",
  "docs/provenance/sprites-provenance.md",
  "docs/provenance/fonts-provenance.md",
  "docs/provenance/hud-provenance.md",
  "docs/provenance/startup-provenance.md",
  "docs/provenance/title-provenance.md",
  "docs/provenance/levels-provenance.md"
];

const requiredInputs = [
  "docs/extraction/mine-tiles-metadata.json",
  "docs/extraction/mine-sprites-metadata.json",
  "docs/extraction/mine-fonts-metadata.json",
  "docs/extraction/mine-hud-metadata.json",
  "docs/extraction/mine-startup-metadata.json",
  "docs/extraction/mine-title-metadata.json",
  "docs/extraction/mine-levels.json",
  "src/assets/generated/mine-tiles.ts",
  "src/assets/generated/mine-sprites.ts",
  "src/assets/generated/mine-fonts.ts",
  "src/assets/generated/mine-hud.ts",
  "src/assets/generated/mine-startup.ts",
  "src/assets/generated/mine-title.ts",
  "src/assets/generated/mine-levels.ts",
  "src/assets/generated/levels/mine-level-01.ts",
  "src/assets/generated/levels/mine-level-16.ts",
  "docs/extraction/levels/mine-level-01.json",
  "docs/extraction/levels/mine-level-16.json"
];

for (const file of provenanceFiles) {
  const provenancePath = join(rootDir, file);
  if (!existsSync(provenancePath)) {
    throw new Error(`Missing provenance file: ${provenancePath}`);
  }
}

for (const file of requiredInputs) {
  const sourcePath = join(rootDir, file);
  if (!existsSync(sourcePath)) {
    throw new Error(`Missing required source/asset file: ${sourcePath}`);
  }
}

const exclusion = "SAPHIR.*";
const globalProvenance = readFileSync(join(rootDir, "docs/provenance/ASSET_PROVENANCE.md"), "utf8");
if (!globalProvenance.includes(exclusion)) {
  throw new Error("Missing global exclusion notice for SAPHIR.*");
}

const levels = JSON.parse(readFileSync(join(rootDir, "docs/extraction/mine-levels.json"), "utf8"));
if (!Array.isArray(levels.levelArtifacts) || levels.levelArtifacts.length !== 16) {
  throw new Error("mine-levels.json does not expose 16 levelArtifacts");
}

console.log("Provenance verification OK: required family files and required outputs are present.");
